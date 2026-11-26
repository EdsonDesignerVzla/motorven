import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Scale,
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Search,
  Building2,
  ArrowRightLeft,
  Eye,
  Printer,
  Download
} from 'lucide-react';
import rawAutoTable from 'jspdf-autotable';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import {
  createBaseReport,
  addSummaryCards,
  addSectionHeader,
  addGrandTotalBox,
  addSignatures,
  finalizeAndSave,
  printPDFDocument
} from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';
import {
  loadPartnerPayableAccounts,
  upsertPartnerPayableAccountInList,
  removePartnerPayableAccountFromList,
  applyPartnerPayableBalanceDeltaInList,
  resolveExchangeRates,
  validateSufficientTreasuryBalance
} from '../utils/treasuryAccountUtils';
import {
  loadOtherLiabilityAccounts,
  upsertOtherLiabilityAccountInList,
  removeOtherLiabilityAccountFromList,
  loadPartnerLiabilityMovements,
  recordPartnerLiabilityMovement,
  deletePartnerLiabilityMovementFromList,
  getOfficialPlanDeCuentasPasivos,
  buildUnifiedPartnerMovementsLedger,
  computePasivosDashboardMetrics,
  PASIVO_SUBGROUP_LABELS
} from '../utils/liabilityAccountUtils';
import { filterRecordsFromSystemStart } from '../utils/dateRangeFilterUtils';

const getNextCorrelativeCode = (items = [], prefix = 'SOC') => {
  let maxNum = 0;
  (items || []).forEach((item) => {
    const code = String(item?.codigo || item?.id || '').toUpperCase();
    const match = code.match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  });
  return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
};

export default function PasivosView({
  partnerPayableAccounts = null,
  onSavePartnerPayableAccount,
  onDeletePartnerPayableAccount,
  onAdjustPartnerPayableBalance,
  accountsPayable = [],
  profitAccountsPayable = [],
  supplierPayments = [],
  cashDesks = [],
  bankAccounts = [],
  onDeleteCashMovement,
  config = {},
  currentUser = null,
  onNavigate
}) {
  const { notify } = useNotification();
  const { tasaBcv } = resolveExchangeRates(config);
  const [activeSubTab, setActiveSubTab] = useState('socios');

  // --- Estado de Cuentas por Pagar Socio (2.02.01.001) ---
  const [localPartnerAccounts, setLocalPartnerAccounts] = useState(() => loadPartnerPayableAccounts());
  const effectivePartnerAccounts = useMemo(
    () => (Array.isArray(partnerPayableAccounts) ? partnerPayableAccounts : localPartnerAccounts),
    [partnerPayableAccounts, localPartnerAccounts]
  );

  // --- Estado de Otras Cuentas de Pasivo (Plan 2.x) ---
  const [otherLiabilityAccounts, setOtherLiabilityAccounts] = useState(() => loadOtherLiabilityAccounts());

  // --- Movimientos Manuales de Pasivo Socio (desde 01/11/2026) ---
  const [manualMovements, setManualMovements] = useState(() => filterRecordsFromSystemStart(loadPartnerLiabilityMovements()));

  const effectiveAccountsPayable = useMemo(
    () => filterRecordsFromSystemStart(Array.isArray(profitAccountsPayable) && profitAccountsPayable.length > 0 ? profitAccountsPayable : accountsPayable),
    [profitAccountsPayable, accountsPayable]
  );

  const scopedSupplierPayments = useMemo(
    () => filterRecordsFromSystemStart(supplierPayments),
    [supplierPayments]
  );

  const metrics = useMemo(
    () =>
      computePasivosDashboardMetrics({
        partnerAccounts: effectivePartnerAccounts,
        otherLiabilityAccounts,
        accountsPayable: effectiveAccountsPayable,
        supplierPayments: scopedSupplierPayments,
        config
      }),
    [effectivePartnerAccounts, otherLiabilityAccounts, effectiveAccountsPayable, scopedSupplierPayments, config]
  );

  const unifiedMovements = useMemo(
    () =>
      buildUnifiedPartnerMovementsLedger({
        partnerAccounts: effectivePartnerAccounts,
        manualMovements: filterRecordsFromSystemStart(manualMovements),
        supplierPayments: scopedSupplierPayments
      }),
    [effectivePartnerAccounts, manualMovements, scopedSupplierPayments]
  );

  const planPasivosRows = useMemo(() => getOfficialPlanDeCuentasPasivos(), []);

  // --- Modal / Formulario CRUD Cuenta por Pagar Socio ---
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartnerAccId, setEditingPartnerAccId] = useState(null);
  const [confirmDeletePartnerId, setConfirmDeletePartnerId] = useState(null);
  const [partnerForm, setPartnerForm] = useState(() => ({
    codigo: getNextCorrelativeCode(loadPartnerPayableAccounts(), 'SOC'),
    nombre: '',
    titular: '',
    moneda: 'USD',
    saldoUsd: '0',
    saldoBs: '0',
    activa: true,
    observaciones: ''
  }));

  // --- Opciones de Caja Chica & Banco para abonos con desembolso ---
  const treasuryAccountOptions = useMemo(() => {
    const opts = [];
    (Array.isArray(cashDesks) ? cashDesks : []).forEach((d, idx) => {
      if (!d || d.activa === false) return;
      const rawId = d.id || d.coCaja || d.co_caja || `CAJA-${idx}`;
      const code = d.coCaja || d.co_caja || rawId;
      const desc = d.descripcion || d.desCaja || d.des_caja || 'Caja Chica';
      const mon = String(d.moneda || 'USD').toUpperCase();
      const balStr = mon === 'BS' ? formatBs(d.saldoBs ?? d.saldo_bs ?? 0) : formatUsd(d.saldoUsd ?? d.saldo_usd ?? 0);
      opts.push({
        value: `CAJA:${rawId}`,
        kind: 'CAJA',
        record: d,
        shortLabel: `${code} - ${desc}`,
        label: `[${code} • ${mon}] ${desc} (${balStr})`
      });
    });
    (Array.isArray(bankAccounts) ? bankAccounts : []).forEach((b, idx) => {
      if (!b || b.activa === false) return;
      const rawId = b.id || b.codCta || b.cod_cta || `BANCO-${idx}`;
      const code = b.codCta || b.cod_cta || rawId;
      const desc = b.bancoNombre || b.banco_nombre || b.banco || 'Cuenta Bancaria';
      const mon = String(b.moneda || 'BS').toUpperCase();
      const balStr = mon === 'BS' ? formatBs(b.saldoBs ?? b.saldo_bs ?? 0) : formatUsd(b.saldoUsd ?? b.saldo_usd ?? 0);
      opts.push({
        value: `BANCO:${rawId}`,
        kind: 'BANCO',
        record: b,
        shortLabel: `${code} - ${desc}`,
        label: `[${code} • ${mon}] ${desc} (${balStr})`
      });
    });
    return opts;
  }, [cashDesks, bankAccounts]);

  // --- Modal Cargo / Abono Directo a Socio ---
  const [showMovModal, setShowMovModal] = useState(false);
  const [movForm, setMovForm] = useState({
    cuentaId: '',
    tipo: 'ABONO_SOCIO',
    treasuryAccountKey: 'SOLO_CONTABLE',
    fecha: new Date().toISOString().split('T')[0],
    montoUsd: '',
    montoBs: '',
    referencia: '',
    concepto: ''
  });

  // --- Modal / Formulario CRUD Otras Cuentas de Pasivo ---
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [editingOtherId, setEditingOtherId] = useState(null);
  const [confirmDeleteOtherId, setConfirmDeleteOtherId] = useState(null);
  const [viewingLiabilityModal, setViewingLiabilityModal] = useState(null); // { kind: 'PARTNER' | 'OTHER', account }
  const [otherForm, setOtherForm] = useState({
    codigo: 'PAS-02',
    codigoContable: '2.02.01.002',
    nombre: '',
    acreedor: '',
    subgrupo: 'PASIVO_SOCIOS',
    moneda: 'USD',
    saldoUsd: '0',
    saldoBs: '0',
    activa: true,
    observaciones: ''
  });

  // --- Filtros de Catálogo y Movimientos ---
  const [planSearch, setPlanSearch] = useState('');
  const [planSubgroupFilter, setPlanSubgroupFilter] = useState('ALL');
  const [movSearch, setMovSearch] = useState('');
  const [movAccountFilter, setMovAccountFilter] = useState('ALL');

  const filteredPlanRows = useMemo(() => {
    const q = String(planSearch || '').trim().toLowerCase();
    return planPasivosRows.filter((row) => {
      if (planSubgroupFilter !== 'ALL' && row.subgrupo && row.subgrupo !== planSubgroupFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(row.codigo || '').toLowerCase().includes(q)
        || String(row.nombre || '').toLowerCase().includes(q)
        || String(row.subgrupo || '').toLowerCase().includes(q)
      );
    });
  }, [planPasivosRows, planSearch, planSubgroupFilter]);

  const filteredMovements = useMemo(() => {
    const q = String(movSearch || '').trim().toLowerCase();
    return unifiedMovements.filter((m) => {
      if (movAccountFilter !== 'ALL') {
        const filterUpper = movAccountFilter.toUpperCase();
        const cid = String(m.cuentaId || '').toUpperCase();
        const cname = String(m.cuentaNombre || '').toUpperCase();
        if (cid !== filterUpper && !cname.includes(filterUpper)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        String(m.concepto || '').toLowerCase().includes(q)
        || String(m.cuentaNombre || '').toLowerCase().includes(q)
        || String(m.proveedor || '').toLowerCase().includes(q)
        || String(m.referencia || '').toLowerCase().includes(q)
      );
    });
  }, [unifiedMovements, movSearch, movAccountFilter]);

  // --- Handlers CRUD Cuentas por Pagar Socio ---
  const resetPartnerForm = (list = effectivePartnerAccounts) => {
    setEditingPartnerAccId(null);
    setPartnerForm({
      codigo: getNextCorrelativeCode(list, 'SOC'),
      nombre: '',
      titular: '',
      moneda: 'USD',
      saldoUsd: '0',
      saldoBs: '0',
      activa: true,
      observaciones: ''
    });
  };

  const handleOpenCreatePartner = () => {
    resetPartnerForm(effectivePartnerAccounts);
    setShowPartnerModal(true);
  };

  const handleOpenEditPartner = (acc) => {
    if (!acc) return;
    setEditingPartnerAccId(acc.id);
    setPartnerForm({
      codigo: acc.codigo || acc.id || 'SOC-01',
      nombre: acc.nombre || 'Cuenta por Pagar Socio',
      titular: acc.titular || '',
      moneda: acc.moneda === 'BS' ? 'BS' : 'USD',
      saldoUsd: String(round2(Number(acc.saldoUsd || 0))),
      saldoBs: String(round2(Number(acc.saldoBs || 0))),
      activa: acc.activa !== false,
      observaciones: acc.observaciones || ''
    });
    setShowPartnerModal(true);
  };

  const handleSubmitPartnerAccount = (e) => {
    e.preventDefault();
    const cleanNombre = String(partnerForm.nombre || '').trim();
    if (!cleanNombre) {
      notify.warning('Ingrese el nombre de la Cuenta por Pagar Socio.');
      return;
    }
    const cleanCodigo = String(
      partnerForm.codigo || getNextCorrelativeCode(effectivePartnerAccounts, 'SOC')
    ).trim().toUpperCase();

    const payload = {
      id: editingPartnerAccId || `cta-${cleanCodigo.toLowerCase()}`,
      codigo: cleanCodigo,
      nombre: cleanNombre,
      titular: String(partnerForm.titular || '').trim() || 'Socio',
      codigoContable: '2.02.01.001',
      moneda: partnerForm.moneda === 'BS' ? 'BS' : 'USD',
      saldoUsd: Math.max(0, round2(Number(partnerForm.saldoUsd || 0))),
      saldoBs: Math.max(0, round2(Number(partnerForm.saldoBs || 0))),
      activa: partnerForm.activa !== false,
      observaciones: String(partnerForm.observaciones || '').trim()
    };

    const nextList = upsertPartnerPayableAccountInList(effectivePartnerAccounts, payload);
    setLocalPartnerAccounts(nextList);
    if (onSavePartnerPayableAccount) {
      onSavePartnerPayableAccount(payload);
    }
    notify.success(
      editingPartnerAccId
        ? `Cuenta por Pagar Socio "${payload.nombre}" actualizada y sincronizada con CxP.`
        : `Cuenta por Pagar Socio "${payload.nombre}" creada y disponible en CxP.`
    );
    setShowPartnerModal(false);
    resetPartnerForm(nextList);
  };

  const handleConfirmDeletePartner = (acc) => {
    if (!acc) return;
    const nextList = removePartnerPayableAccountFromList(effectivePartnerAccounts, acc.id || acc.codigo);
    setLocalPartnerAccounts(nextList);
    if (onDeletePartnerPayableAccount) {
      onDeletePartnerPayableAccount(acc.id || acc.codigo);
    }
    setConfirmDeletePartnerId(null);
    notify.info(`Cuenta por Pagar Socio "${acc.nombre}" eliminada.`);
  };

  // --- Handlers Cargo / Abono Manual a Socio ---
  const handleOpenPartnerMovementModal = (acc = null, defaultTipo = 'ABONO_SOCIO') => {
    const target = acc || effectivePartnerAccounts[0] || null;
    setMovForm({
      cuentaId: target?.id || '',
      tipo: defaultTipo,
      treasuryAccountKey: treasuryAccountOptions[0]?.value || 'SOLO_CONTABLE',
      fecha: new Date().toISOString().split('T')[0],
      montoUsd: '',
      montoBs: '',
      referencia: '',
      concepto: ''
    });
    setShowMovModal(true);
  };

  const handleSubmitPartnerMovement = async (e) => {
    e.preventDefault();
    const targetAcc = effectivePartnerAccounts.find(
      (a) => a.id === movForm.cuentaId || a.codigo === movForm.cuentaId
    );
    if (!targetAcc) {
      notify.warning('Seleccione una Cuenta por Pagar Socio.');
      return;
    }
    const usd = round2(Number(movForm.montoUsd || 0));
    const bs = round2(Number(movForm.montoBs || 0));
    if (!(usd > 0) && !(bs > 0)) {
      notify.warning('Ingrese un monto válido mayor a 0.');
      return;
    }
    const effectiveUsd = usd > 0 ? usd : (tasaBcv > 0 ? round2(bs / tasaBcv) : 0);
    const effectiveBs = bs > 0 ? bs : round2(effectiveUsd * tasaBcv);
    const sign = movForm.tipo === 'ABONO_SOCIO' ? -1 : 1;

    if (sign < 0 && effectiveUsd > Number(targetAcc.saldoUsd || 0) + 0.01) {
      notify.warning(
        `El abono (${formatUsd(effectiveUsd)}) supera el saldo pasivo actual de "${targetAcc.nombre}" (${formatUsd(targetAcc.saldoUsd || 0)}).`
      );
      return;
    }

    let treasuryAccountPayload = null;
    if (movForm.tipo === 'ABONO_SOCIO' && movForm.treasuryAccountKey && movForm.treasuryAccountKey !== 'SOLO_CONTABLE') {
      const selectedOpt = treasuryAccountOptions.find((o) => o.value === movForm.treasuryAccountKey);
      if (!selectedOpt) {
        notify.warning('Seleccione una cuenta de Caja Chica o Banco válida.');
        return;
      }
      const balCheck = validateSufficientTreasuryBalance(selectedOpt.record, {
        deltaUsd: -effectiveUsd,
        deltaBs: -effectiveBs,
        label: selectedOpt.shortLabel
      });
      if (!balCheck.ok) {
        notify.error(balCheck.message);
        return;
      }
      const rec = selectedOpt.record;
      const isCaja = selectedOpt.kind === 'CAJA';
      const moneda = String(rec.moneda || (isCaja ? 'USD' : 'BS')).toUpperCase();
      treasuryAccountPayload = {
        kind: selectedOpt.kind,
        id: rec.id || rec.coCaja || rec.codCta,
        rawId: rec.id || rec.coCaja || rec.codCta,
        coCaja: rec.coCaja || rec.co_caja || '',
        codCta: rec.codCta || rec.cod_cta || '',
        moneda,
        label: selectedOpt.shortLabel,
        metodoPago: isCaja ? (moneda === 'BS' ? 'EFECTIVO_BS' : 'EFECTIVO_USD') : 'TRANSFERENCIA',
        concepto: movForm.concepto.trim() || `Abono / Reembolso a ${targetAcc.codigo} (${targetAcc.nombre})`,
        referencia: movForm.referencia.trim(),
        fecha: movForm.fecha,
        tasa: tasaBcv
      };
    }

    const deltaPayload = {
      targetRef: targetAcc.id || targetAcc.codigo,
      deltaUsd: round2(sign * effectiveUsd),
      deltaBs: round2(sign * effectiveBs),
      treasuryAccount: treasuryAccountPayload
    };

    try {
      let createdCashMovementId = null;
      if (onAdjustPartnerPayableBalance) {
        createdCashMovementId = await onAdjustPartnerPayableBalance(deltaPayload);
      }
      const nextPartnerList = applyPartnerPayableBalanceDeltaInList(effectivePartnerAccounts, {
        targetRef: deltaPayload.targetRef,
        deltaUsd: deltaPayload.deltaUsd,
        deltaBs: deltaPayload.deltaBs
      });
      setLocalPartnerAccounts(nextPartnerList);

      const nextMovs = recordPartnerLiabilityMovement(manualMovements, {
        fecha: movForm.fecha,
        tipo: movForm.tipo,
        cuentaId: targetAcc.id,
        cuentaCodigo: targetAcc.codigo,
        cuentaNombre: `${targetAcc.codigo} - ${targetAcc.nombre}`,
        montoUsd: effectiveUsd,
        montoBs: effectiveBs,
        concepto: movForm.concepto,
        referencia: movForm.referencia,
        cashMovementId: createdCashMovementId || '',
        treasuryAccountId: treasuryAccountPayload?.id || '',
        treasuryAccountLabel: treasuryAccountPayload?.label || '',
        usuario: currentUser?.nombre || currentUser?.username || 'ADMINISTRACION'
      });
      setManualMovements(nextMovs);
      setShowMovModal(false);
      notify.success(
        movForm.tipo === 'ABONO_SOCIO'
          ? treasuryAccountPayload
            ? `Abono por ${formatUsd(effectiveUsd)} registrado a "${targetAcc.nombre}" y descontado de ${treasuryAccountPayload.label}.`
            : `Abono interno por ${formatUsd(effectiveUsd)} registrado a "${targetAcc.nombre}".`
          : `Cargo pasivo por ${formatUsd(effectiveUsd)} acumulado en "${targetAcc.nombre}".`
      );
    } catch (err) {
      console.error('Error registrando movimiento de pasivo socio:', err);
      notify.error('No se pudo completar el movimiento: ' + (err?.message || 'Error desconocido'));
    }
  };

  // --- Handlers CRUD Otras Cuentas de Pasivo ---
  const resetOtherForm = (list = otherLiabilityAccounts) => {
    setEditingOtherId(null);
    setOtherForm({
      codigo: getNextCorrelativeCode(list, 'PAS'),
      codigoContable: '2.06.01.001',
      nombre: '',
      acreedor: '',
      subgrupo: 'OTROS_PASIVOS',
      moneda: 'USD',
      saldoUsd: '0',
      saldoBs: '0',
      activa: true,
      observaciones: ''
    });
  };

  const handleOpenCreateOther = (presetPlanRow = null) => {
    resetOtherForm(otherLiabilityAccounts);
    if (presetPlanRow) {
      setOtherForm((prev) => ({
        ...prev,
        codigoContable: presetPlanRow.codigo || '2.06.01.001',
        nombre: presetPlanRow.nombre || '',
        subgrupo: presetPlanRow.subgrupo || 'OTROS_PASIVOS'
      }));
    }
    setShowOtherModal(true);
  };

  const handleOpenEditOther = (acc) => {
    if (!acc) return;
    setEditingOtherId(acc.id);
    setOtherForm({
      codigo: acc.codigo || 'PAS-01',
      codigoContable: acc.codigoContable || '2.06.01.001',
      nombre: acc.nombre || '',
      acreedor: acc.acreedor || '',
      subgrupo: acc.subgrupo || 'OTROS_PASIVOS',
      moneda: acc.moneda === 'BS' ? 'BS' : 'USD',
      saldoUsd: String(round2(Number(acc.saldoUsd || 0))),
      saldoBs: String(round2(Number(acc.saldoBs || 0))),
      activa: acc.activa !== false,
      observaciones: acc.observaciones || ''
    });
    setShowOtherModal(true);
  };

  const handleSubmitOtherAccount = (e) => {
    e.preventDefault();
    const cleanNombre = String(otherForm.nombre || '').trim();
    if (!cleanNombre) {
      notify.warning('Ingrese el nombre de la cuenta de pasivo.');
      return;
    }
    const cleanCodigo = String(
      otherForm.codigo || getNextCorrelativeCode(otherLiabilityAccounts, 'PAS')
    ).trim().toUpperCase();

    const payload = {
      id: editingOtherId || `pas-${cleanCodigo.toLowerCase()}`,
      codigo: cleanCodigo,
      codigoContable: String(otherForm.codigoContable || '2.06.01.001').trim(),
      nombre: cleanNombre,
      acreedor: String(otherForm.acreedor || '').trim() || 'Acreedor',
      subgrupo: otherForm.subgrupo || 'OTROS_PASIVOS',
      moneda: otherForm.moneda === 'BS' ? 'BS' : 'USD',
      saldoUsd: Math.max(0, round2(Number(otherForm.saldoUsd || 0))),
      saldoBs: Math.max(0, round2(Number(otherForm.saldoBs || 0))),
      activa: otherForm.activa !== false,
      observaciones: String(otherForm.observaciones || '').trim()
    };

    const next = upsertOtherLiabilityAccountInList(otherLiabilityAccounts, payload);
    setOtherLiabilityAccounts(next);
    setShowOtherModal(false);
    resetOtherForm(next);
    notify.success(
      editingOtherId
        ? `Cuenta de pasivo "${payload.nombre}" actualizada.`
        : `Cuenta de pasivo "${payload.nombre}" creada.`
    );
  };

  const handleConfirmDeleteOther = (acc) => {
    if (!acc) return;
    const next = removeOtherLiabilityAccountFromList(otherLiabilityAccounts, acc.id || acc.codigo);
    setOtherLiabilityAccounts(next);
    setConfirmDeleteOtherId(null);
    notify.info(`Cuenta de pasivo "${acc.nombre}" eliminada.`);
  };

  const handleDeleteManualMovement = async (mov) => {
    if (!mov || !['MANUAL_PASIVOS', 'CAJA_BANCOS'].includes(mov.origen)) return;
    if (mov.cashMovementId && onDeleteCashMovement) {
      await onDeleteCashMovement(mov.cashMovementId);
      setManualMovements((prev) => deletePartnerLiabilityMovementFromList(prev, mov.id));
      setLocalPartnerAccounts(loadPartnerPayableAccounts());
      notify.info('Movimiento de abono y su desembolso en Caja/Banco revertidos.');
      return;
    }
    const reverseSign = mov.tipo === 'ABONO_SOCIO' ? 1 : -1;
    const deltaPayload = {
      targetRef: mov.cuentaId || mov.cuentaCodigo,
      deltaUsd: round2(reverseSign * Number(mov.montoUsd || 0)),
      deltaBs: round2(reverseSign * Number(mov.montoBs || 0)),
      skipTreasuryDeduction: true
    };
    const nextPartnerList = applyPartnerPayableBalanceDeltaInList(effectivePartnerAccounts, deltaPayload);
    setLocalPartnerAccounts(nextPartnerList);
    if (onAdjustPartnerPayableBalance) {
      await onAdjustPartnerPayableBalance(deltaPayload);
    }
    setManualMovements((prev) => deletePartnerLiabilityMovementFromList(prev, mov.id));
    notify.info('Movimiento manual de pasivo revertido.');
  };

  // --- Helpers Ver & Imprimir Estado de Cuenta / Ficha de Pasivo ---
  const getPartnerAccountMovements = (acc) => {
    if (!acc) return [];
    const accId = String(acc.id || '').trim().toUpperCase();
    const accCode = String(acc.codigo || '').trim().toUpperCase();
    return unifiedMovements.filter((m) => {
      if (!m) return false;
      const mId = String(m.cuentaId || '').trim().toUpperCase();
      const mCode = String(m.cuentaCodigo || '').trim().toUpperCase();
      const mName = String(m.cuentaNombre || '').trim().toUpperCase();
      return (
        (accId && mId === accId) ||
        (accCode && (mCode === accCode || mId === accCode || mName.startsWith(`${accCode} `) || mName.includes(`${accCode} -`)))
      );
    });
  };

  const buildAccountSummaryStats = (acc, kind = 'PARTNER') => {
    const isPartner = kind === 'PARTNER';
    const movs = isPartner ? getPartnerAccountMovements(acc) : [];
    let cargosUsd = 0;
    let cargosBs = 0;
    let abonosUsd = 0;
    let abonosBs = 0;
    movs.forEach((m) => {
      const usd = round2(Number(m?.montoUsd || 0));
      const bs = round2(Number(m?.montoBs || 0) || (tasaBcv > 0 ? usd * tasaBcv : 0));
      if (m?.tipo === 'ABONO_SOCIO') {
        abonosUsd = round2(abonosUsd + usd);
        abonosBs = round2(abonosBs + bs);
      } else {
        cargosUsd = round2(cargosUsd + usd);
        cargosBs = round2(cargosBs + bs);
      }
    });
    const saldoUsd = round2(Number(acc?.saldoUsd || 0));
    const saldoBs = round2(Number(acc?.saldoBs || 0) || (tasaBcv > 0 ? saldoUsd * tasaBcv : 0));
    return {
      isPartner,
      movs,
      cargosUsd,
      cargosBs,
      abonosUsd,
      abonosBs,
      saldoUsd,
      saldoBs
    };
  };

  const handlePrintLiabilityAccount = (acc, kind = 'PARTNER', { downloadOnly = false } = {}) => {
    if (!acc) return;
    try {
      const { isPartner, movs, cargosUsd, abonosUsd, saldoUsd, saldoBs } = buildAccountSummaryStats(acc, kind);
      const titularLabel = isPartner ? (acc.titular || 'Socio Principal') : (acc.acreedor || 'Acreedor');
      const codeContable = acc.codigoContable || (isPartner ? '2.02.01.001' : '2.06.01.001');

      const { doc, startX, tableWidth, startY } = createBaseReport({
        title: isPartner ? 'ESTADO DE CUENTA — PASIVO SOCIO' : 'FICHA DE CUENTA DE PASIVO',
        subtitle: `${acc.codigo} · ${acc.nombre} (${titularLabel}) · Cuenta Contable ${codeContable}`,
        moduleCode: isPartner ? 'PAS-SOC' : 'PAS-AUX',
        currentUser,
        config,
        rateValue: tasaBcv
      });

      let cursorY = addSummaryCards(
        doc,
        startY,
        [
          {
            label: 'Saldo Pasivo Actual',
            value: formatUsd(saldoUsd),
            subtext: formatBs(saldoBs),
            color: [217, 119, 6],
            valueColor: [180, 83, 9]
          },
          isPartner
            ? {
                label: 'Cargos (+ Pasivo)',
                value: formatUsd(cargosUsd),
                subtext: `${movs.filter((m) => m.tipo !== 'ABONO_SOCIO').length} movimiento(s)`,
                color: [14, 165, 233],
                valueColor: [3, 105, 161]
              }
            : {
                label: 'Subgrupo Contable',
                value: codeContable,
                subtext: PASIVO_SUBGROUP_LABELS[acc.subgrupo] || acc.subgrupo || 'Pasivo',
                color: [14, 165, 233],
                valueColor: [3, 105, 161]
              },
          isPartner
            ? {
                label: 'Abonos (- Pasivo)',
                value: formatUsd(abonosUsd),
                subtext: `${movs.filter((m) => m.tipo === 'ABONO_SOCIO').length} reembolso(s)`,
                color: [5, 150, 105],
                valueColor: [4, 120, 87]
              }
            : {
                label: 'Acreedor / Ente',
                value: titularLabel,
                subtext: acc.codigo,
                color: [5, 150, 105],
                valueColor: [4, 120, 87]
              },
          {
            label: 'Estatus / Moneda',
            value: acc.activa !== false ? 'ACTIVA' : 'INACTIVA',
            subtext: `Moneda base: ${acc.moneda || 'USD'}`,
            color: [0, 43, 122],
            valueColor: [0, 43, 122]
          }
        ],
        tableWidth,
        startX
      );

      cursorY = addSectionHeader(
        doc,
        cursorY,
        isPartner ? `Detalle de Movimientos — ${acc.codigo} (${acc.nombre})` : `Ficha Técnica Contable — ${acc.codigo}`,
        acc.observaciones ? `Observaciones: ${acc.observaciones}` : `Titular / Acreedor: ${titularLabel} • Plan BA VEN-NIF ${codeContable}`,
        tableWidth,
        startX
      );

      if (isPartner) {
        const bodyRows = movs.length > 0
          ? movs.map((m) => {
              const isAbono = m.tipo === 'ABONO_SOCIO';
              const tipoLabel = isAbono ? 'ABONO A SOCIO' : (m.origen === 'CXP_PAGO_PROVEEDOR' ? 'PAGO CXP SOCIO' : 'CARGO PASIVO');
              const detailLines = [m.concepto || 'Movimiento de pasivo'];
              if (m.treasuryAccountLabel) detailLines.push(`Tesorería: ${m.treasuryAccountLabel}`);
              if (m.proveedor) detailLines.push(`Proveedor: ${m.proveedor}`);
              return [
                m.fecha || '—',
                tipoLabel,
                detailLines.join(' | '),
                m.referencia || '—',
                `${isAbono ? '-' : '+'}${formatUsd(m.montoUsd || 0)}`,
                formatBs(m.montoBs || 0)
              ];
            })
          : [[
              new Date().toISOString().split('T')[0],
              'SALDO ACTUAL',
              'Cuenta sin movimientos detallados en el historial de sesión.',
              acc.codigo,
              formatUsd(saldoUsd),
              formatBs(saldoBs)
            ]];

        rawAutoTable(doc, {
          startY: cursorY,
          margin: { left: startX, right: startX },
          tableWidth,
          head: [['FECHA', 'TIPO / ORIGEN', 'CONCEPTO / PROVEEDOR / TESORERÍA', 'REFERENCIA', 'MONTO USD', 'MONTO BS.']],
          body: bodyRows,
          styles: { fontSize: 7.4, cellPadding: 1.6, overflow: 'linebreak' },
          headStyles: { fillColor: [0, 43, 122], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4 },
          columnStyles: {
            0: { cellWidth: 21 },
            1: { cellWidth: 27 },
            2: { cellWidth: 67.9 },
            3: { cellWidth: 22 },
            4: { cellWidth: 20, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' }
          }
        });
      } else {
        rawAutoTable(doc, {
          startY: cursorY,
          margin: { left: startX, right: startX },
          tableWidth,
          head: [['CAMPO CONTABLE', 'DETALLE DE LA CUENTA AUXILIAR DE PASIVO']],
          body: [
            ['Código Auxiliar', acc.codigo],
            ['Nombre de Cuenta', acc.nombre],
            ['Código Plan Contable', codeContable],
            ['Subgrupo BA VEN-NIF', PASIVO_SUBGROUP_LABELS[acc.subgrupo] || acc.subgrupo || 'Otros Pasivos'],
            ['Acreedor / Ente', titularLabel],
            ['Moneda / Estatus', `${acc.moneda || 'USD'} · ${acc.activa !== false ? 'Activa' : 'Inactiva'}`],
            ['Saldo Pasivo USD', formatUsd(saldoUsd)],
            ['Equivalente Bolívares', formatBs(saldoBs)],
            ['Observaciones', acc.observaciones || 'Sin observaciones registradas']
          ],
          styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
          headStyles: { fillColor: [0, 43, 122], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 127.9 } }
        });
      }

      const afterTableY = (doc.lastAutoTable?.finalY || cursorY + 25) + 4;
      const afterTotalsY = addGrandTotalBox(
        doc,
        afterTableY,
        isPartner
          ? [
              { label: 'Total Cargos (+)', value: formatUsd(cargosUsd), color: [3, 105, 161] },
              { label: 'Total Abonos (-)', value: formatUsd(abonosUsd), color: [4, 120, 87] },
              { label: 'Saldo Pasivo Pendiente', value: `${formatUsd(saldoUsd)}`, subtext: formatBs(saldoBs), color: [180, 83, 9] }
            ]
          : [
              { label: 'Cuenta Contable', value: codeContable, color: [0, 43, 122] },
              { label: 'Saldo Pasivo USD', value: formatUsd(saldoUsd), color: [180, 83, 9] },
              { label: 'Saldo Pasivo Bs.', value: formatBs(saldoBs), color: [71, 85, 105] }
            ],
        tableWidth,
        startX
      );

      addSignatures(
        doc,
        afterTotalsY,
        ['Elaborado por Administración', isPartner ? 'Conforme Socio / Titular' : 'Revisado Contabilidad', 'Autorizado por Gerencia'],
        tableWidth,
        startX
      );

      const fileSlug = `${isPartner ? 'Estado_Cuenta' : 'Ficha_Pasivo'}_${String(acc.codigo || acc.id || 'SOC').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      finalizeAndSave(doc, fileSlug, currentUser, { skipSave: !downloadOnly });
      if (!downloadOnly) {
        printPDFDocument(doc);
        notify.success(`Vista de impresión preparada para ${acc.codigo} (${acc.nombre}).`);
      } else {
        notify.success(`PDF descargado: ${fileSlug}`);
      }
    } catch (err) {
      console.error('Error generando PDF/impresión de Cuenta de Pasivo:', err);
      notify.error('No se pudo generar la impresión: ' + (err?.message || 'Error desconocido'));
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', paddingBottom: '2rem' }}>
      {/* HEADER DEL MÓDULO */}
      <div className="card-surface pasivos-hero-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.95rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(180, 83, 9, 0.25)'
            }}
          >
            <Scale size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-heading)' }}>
              Cuentas de Pasivo
            </h1>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Gestión integral de Cuentas por Pagar Socios (<strong>2.02.01.001</strong>) y Pasivos Contables Grupo 2 (BA VEN-NIF 2 · Tasa BCV: Bs. {tasaBcv.toFixed(2)})
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleOpenCreatePartner}
            style={{
              padding: '0.6rem 1.05rem',
              borderRadius: '10px',
              border: 'none',
              background: '#b45309',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 6px rgba(180, 83, 9, 0.25)'
            }}
          >
            <Plus size={16} />
            Nueva Cuenta por Pagar Socio
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('cxp')}
              className="pasivos-btn-secondary"
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.84rem',
                gap: '0.45rem'
              }}
            >
              <Building2 size={15} />
              Ir a Cuentas por Pagar (CxP)
            </button>
          )}
        </div>
      </div>

      {/* KPIS DE PASIVOS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))',
          gap: '1rem'
        }}
      >
        <div
          className="card-surface"
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '14px',
            borderLeft: '4px solid #d97706'
          }}
        >
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
            Pasivo Socios (2.02.01.001)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '0.25rem' }}>
            {formatUsd(metrics.sociosUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {formatBs(metrics.sociosBs)} · {metrics.sociosActiveCount} cuenta(s) activa(s)
          </div>
        </div>

        <div
          className="card-surface"
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '14px',
            borderLeft: '4px solid #dc2626'
          }}
        >
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--semaforo-rojo)', textTransform: 'uppercase' }}>
            CxP Proveedores (2.02.02)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--semaforo-rojo)', marginTop: '0.25rem' }}>
            {formatUsd(metrics.proveedoresUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {formatBs(metrics.proveedoresBs)} · {metrics.proveedoresDocsCount} doc(s) pendiente(s)
          </div>
        </div>

        <div
          className="card-surface"
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '14px',
            borderLeft: '4px solid #0284c7'
          }}
        >
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--neon-cyan)', textTransform: 'uppercase' }}>
            CxP Pagadas por Socios
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--neon-cyan)', marginTop: '0.25rem' }}>
            {formatUsd(metrics.pagosAsumidosSociosUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {metrics.pagosAsumidosSociosCount} pago(s) imputado(s) desde CxP
          </div>
        </div>

        <div
          className="card-surface"
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '14px',
            borderLeft: '4px solid #6366f1'
          }}
        >
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
            Total Pasivos Monitoreados
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {formatUsd(metrics.totalPasivosMonitoreadosUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {formatBs(metrics.totalPasivosMonitoreadosBs)} · Socios + Proveedores + Otros
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL CON PESTAÑAS */}
      <div className="card-surface" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div className="pasivos-tabs-bar">
          <button
            type="button"
            onClick={() => setActiveSubTab('socios')}
            style={{
              padding: '0.85rem 1.2rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.88rem',
              color: activeSubTab === 'socios' ? 'var(--accent-amber)' : 'var(--text-muted)',
              borderBottom: activeSubTab === 'socios' ? '2px solid var(--accent-amber)' : '2px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <Users size={16} />
            Cuentas por Pagar Socio ({effectivePartnerAccounts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('catalogo')}
            style={{
              padding: '0.85rem 1.2rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.88rem',
              color: activeSubTab === 'catalogo' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              borderBottom: activeSubTab === 'catalogo' ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <BookOpen size={16} />
            Catálogo Oficial &amp; Otros Pasivos ({planPasivosRows.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('movimientos')}
            style={{
              padding: '0.85rem 1.2rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.88rem',
              color: activeSubTab === 'movimientos' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              borderBottom: activeSubTab === 'movimientos' ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <ArrowRightLeft size={16} />
            Movimientos de Pasivos ({unifiedMovements.length})
          </button>
        </div>

        <div style={{ padding: '1.4rem 1.6rem' }}>
          {/* PESTAÑA 1: CUENTAS POR PAGAR SOCIO (2.02.01.001) */}
          {activeSubTab === 'socios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                    Cuentas por Pagar Pasivas — Socios / Accionistas (2.02.01.001)
                  </h2>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Todas las cuentas activas aquí aparecen automáticamente en el dropdown <strong style={{ color: 'var(--text-primary)' }}>Cuenta Origen</strong> de <strong style={{ color: 'var(--text-primary)' }}>Cuentas por Pagar (CxP)</strong> sin descontar efectivo de Caja ni Bancos.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenPartnerMovementModal(effectivePartnerAccounts[0], 'ABONO_SOCIO')}
                    disabled={effectivePartnerAccounts.length === 0}
                    className="pasivos-btn-info"
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      cursor: effectivePartnerAccounts.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ArrowRightLeft size={14} />
                    Registrar Cargo / Abono
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCreatePartner}
                    style={{
                      padding: '0.5rem 0.95rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#b45309',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Plus size={14} />
                    Crear Cuenta Socio
                  </button>
                </div>
              </div>

              <div className="pasivos-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Cuenta / Titular</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Cuenta Contable</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Moneda</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Saldo Pasivo</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectivePartnerAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay Cuentas por Pagar Socio registradas. Haz clic en <strong>Crear Cuenta Socio</strong> para añadir la primera.
                        </td>
                      </tr>
                    ) : (
                      effectivePartnerAccounts.map((acc) => (
                        <tr key={acc.id}>
                          <td style={{ padding: '0.8rem 1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {acc.codigo}
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{acc.nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Socio / Titular: {acc.titular || 'Socio'}
                              {acc.observaciones ? ` · ${acc.observaciones}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--neon-cyan)' }}>
                            {acc.codigoContable || '2.02.01.001'}
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', background: 'var(--semaforo-amarillo-bg)', color: 'var(--accent-amber)', border: '1px solid rgba(245, 158, 11, 0.35)', fontWeight: 700, fontSize: '0.74rem' }}>
                              {acc.moneda || 'USD'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '999px',
                                background: acc.activa !== false ? 'var(--semaforo-verde-bg)' : 'var(--bg-pill)',
                                color: acc.activa !== false ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                border: acc.activa !== false ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-glass)',
                                fontWeight: 700,
                                fontSize: '0.74rem'
                              }}
                            >
                              {acc.activa !== false ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--accent-amber)', fontSize: '0.94rem' }}>
                              {formatUsd(acc.saldoUsd || 0)}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              {formatBs(acc.saldoBs || 0)}
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setViewingLiabilityModal({ kind: 'PARTNER', account: acc })}
                                className="pasivos-btn-secondary"
                                title="Ver ficha detallada y movimientos de esta cuenta"
                              >
                                <Eye size={13} />
                                Ver
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintLiabilityAccount(acc, 'PARTNER', { downloadOnly: false })}
                                className="pasivos-btn-secondary"
                                title="Imprimir estado de cuenta de esta cuenta pasiva"
                              >
                                <Printer size={13} />
                                Imprimir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPartnerMovementModal(acc, 'ABONO_SOCIO')}
                                className="pasivos-btn-info"
                                title="Registrar cargo o abono en esta cuenta"
                              >
                                Cargo/Abono
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditPartner(acc)}
                                className="pasivos-btn-secondary"
                              >
                                <Edit2 size={13} />
                                Editar
                              </button>
                              {confirmDeletePartnerId === acc.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDeletePartner(acc)}
                                    style={{
                                      padding: '0.35rem 0.55rem',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: '#dc2626',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '0.74rem',
                                      fontWeight: 700
                                    }}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePartnerId(null)}
                                    className="pasivos-btn-secondary"
                                  >
                                    No
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePartnerId(acc.id)}
                                  className="pasivos-btn-danger"
                                >
                                  <Trash2 size={13} />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: CATÁLOGO OFICIAL & OTROS PASIVOS (GRUPO 2) */}
          {activeSubTab === 'catalogo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
              {/* Cuentas Auxiliares de Otros Pasivos */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      Cuentas Auxiliares de Otros Pasivos ({otherLiabilityAccounts.length})
                    </h2>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Administra préstamos bancarios, aportes transitorios de socios (2.02.01.002), retenciones u obligaciones laborales.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateOther(null)}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--motorven-navy, #002b7a)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Plus size={14} />
                    Nueva Cuenta de Pasivo
                  </button>
                </div>

                <div className="pasivos-table-wrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.9rem' }}>Código</th>
                        <th style={{ padding: '0.65rem 0.9rem' }}>Cuenta / Acreedor</th>
                        <th style={{ padding: '0.65rem 0.9rem' }}>Cta. Contable</th>
                        <th style={{ padding: '0.65rem 0.9rem' }}>Subgrupo</th>
                        <th style={{ padding: '0.65rem 0.9rem', textAlign: 'right' }}>Saldo Pasivo</th>
                        <th style={{ padding: '0.65rem 0.9rem', textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherLiabilityAccounts.map((acc) => (
                        <tr key={acc.id}>
                          <td style={{ padding: '0.7rem 0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{acc.codigo}</td>
                          <td style={{ padding: '0.7rem 0.9rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acc.nombre}</div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Acreedor: {acc.acreedor}</div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', fontFamily: 'monospace', color: 'var(--neon-cyan)' }}>{acc.codigoContable}</td>
                          <td style={{ padding: '0.7rem 0.9rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {PASIVO_SUBGROUP_LABELS[acc.subgrupo] || acc.subgrupo}
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{formatUsd(acc.saldoUsd || 0)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatBs(acc.saldoBs || 0)}</div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setViewingLiabilityModal({ kind: 'OTHER', account: acc })}
                                className="pasivos-btn-secondary"
                                title="Ver ficha contable de esta cuenta"
                              >
                                <Eye size={12} />
                                Ver
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintLiabilityAccount(acc, 'OTHER', { downloadOnly: false })}
                                className="pasivos-btn-secondary"
                                title="Imprimir ficha de esta cuenta de pasivo"
                              >
                                <Printer size={12} />
                                Imprimir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditOther(acc)}
                                className="pasivos-btn-secondary"
                              >
                                <Edit2 size={12} />
                                Editar
                              </button>
                              {confirmDeleteOtherId === acc.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDeleteOther(acc)}
                                    style={{
                                      padding: '0.3rem 0.55rem',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: '#dc2626',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '0.74rem',
                                      fontWeight: 700
                                    }}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteOtherId(null)}
                                    className="pasivos-btn-secondary"
                                  >
                                    No
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteOtherId(acc.id)}
                                  className="pasivos-btn-danger"
                                >
                                  <Trash2 size={12} />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Plan de Cuentas Oficial Grupo 2 (27 cuentas) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.65rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                    Plan de Cuentas Oficial — Grupo 2: Pasivos ({filteredPlanRows.length})
                  </h3>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={planSearch}
                        onChange={(e) => setPlanSearch(e.target.value)}
                        placeholder="Buscar código o cuenta..."
                        className="input-modern"
                        style={{ padding: '0.42rem 0.65rem 0.42rem 1.9rem', fontSize: '0.8rem', minWidth: '210px' }}
                      />
                    </div>
                    <select
                      value={planSubgroupFilter}
                      onChange={(e) => setPlanSubgroupFilter(e.target.value)}
                      className="select-modern"
                      style={{ padding: '0.42rem 0.7rem', fontSize: '0.8rem' }}
                    >
                      <option value="ALL">Todos los subgrupos</option>
                      {Object.entries(PASIVO_SUBGROUP_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>{lbl}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pasivos-table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', position: 'sticky', top: 0, zIndex: 2 }}>
                        <th style={{ padding: '0.6rem 0.85rem' }}>Código</th>
                        <th style={{ padding: '0.6rem 0.85rem' }}>Nombre de la Cuenta</th>
                        <th style={{ padding: '0.6rem 0.85rem' }}>Nivel</th>
                        <th style={{ padding: '0.6rem 0.85rem' }}>Tipo / Subgrupo</th>
                        <th style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlanRows.map((row) => (
                        <tr
                          key={row.codigo}
                          style={{
                            background: row.imputable ? 'transparent' : 'var(--bg-glass-accent)'
                          }}
                        >
                          <td style={{ padding: '0.55rem 0.85rem', fontFamily: 'monospace', fontWeight: row.imputable ? 600 : 800, color: row.imputable ? 'var(--neon-cyan)' : 'var(--text-primary)' }}>
                            {row.codigo}
                          </td>
                          <td
                            style={{
                              padding: '0.55rem 0.85rem',
                              paddingLeft: `${0.85 + Math.max(0, (row.nivel || 1) - 1) * 0.75}rem`,
                              fontWeight: row.imputable ? 500 : 800,
                              color: row.imputable ? 'var(--text-primary)' : 'var(--accent-primary)'
                            }}
                          >
                            {row.nombre}
                          </td>
                          <td style={{ padding: '0.55rem 0.85rem', color: 'var(--text-muted)' }}>Nivel {row.nivel}</td>
                          <td style={{ padding: '0.55rem 0.85rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {row.imputable ? (PASIVO_SUBGROUP_LABELS[row.subgrupo] || 'Imputable') : 'Agrupación Contable'}
                          </td>
                          <td style={{ padding: '0.55rem 0.85rem', textAlign: 'right' }}>
                            {row.imputable && row.codigo !== '2.02.01.001' && (
                              <button
                                type="button"
                                onClick={() => handleOpenCreateOther(row)}
                                className="pasivos-btn-secondary"
                                style={{ fontSize: '0.72rem' }}
                              >
                                + Crear Auxiliar
                              </button>
                            )}
                            {row.codigo === '2.02.01.001' && (
                              <button
                                type="button"
                                onClick={handleOpenCreatePartner}
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(245, 158, 11, 0.45)',
                                  background: 'var(--semaforo-amarillo-bg)',
                                  color: 'var(--accent-amber)',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                + Cuenta Socio
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: HISTORIAL DE MOVIMIENTOS Y PAGOS POR SOCIOS */}
          {activeSubTab === 'movimientos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={movSearch}
                      onChange={(e) => setMovSearch(e.target.value)}
                      placeholder="Buscar proveedor, concepto o referencia..."
                      className="input-modern"
                      style={{ padding: '0.45rem 0.7rem 0.45rem 2rem', fontSize: '0.82rem', minWidth: '250px' }}
                    />
                  </div>
                  <select
                    value={movAccountFilter}
                    onChange={(e) => setMovAccountFilter(e.target.value)}
                    className="select-modern"
                    style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                  >
                    <option value="ALL">Todas las Cuentas por Pagar Socio</option>
                    {effectivePartnerAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.codigo} · {acc.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenPartnerMovementModal(effectivePartnerAccounts[0], 'ABONO_SOCIO')}
                  disabled={effectivePartnerAccounts.length === 0}
                  style={{
                    padding: '0.5rem 0.95rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0369a1',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: effectivePartnerAccounts.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Plus size={15} />
                  Registrar Cargo / Abono a Socio
                </button>
              </div>

              <div className="pasivos-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Fecha</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Tipo / Origen</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Cuenta Pasivo Socio</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Concepto / Proveedor</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Monto USD</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Monto Bs.</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay movimientos registrados aún en Cuentas de Pasivo Socio.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((mov) => {
                        const isAbono = mov.tipo === 'ABONO_SOCIO';
                        return (
                          <tr key={mov.id}>
                            <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {mov.fecha || '—'}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '999px',
                                  background: isAbono ? 'var(--semaforo-verde-bg)' : 'var(--semaforo-amarillo-bg)',
                                  color: isAbono ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                                  border: isAbono ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                                  fontWeight: 700,
                                  fontSize: '0.73rem'
                                }}
                              >
                                {isAbono ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                                {isAbono ? 'ABONO A SOCIO' : (mov.origen === 'CXP_PAGO_PROVEEDOR' ? 'PAGO CXP SOCIO' : 'CARGO PASIVO')}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {mov.cuentaNombre}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ color: 'var(--text-primary)' }}>{mov.concepto}</div>
                              {mov.treasuryAccountLabel && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--accent-sky, #0284c7)', fontWeight: 600 }}>
                                  Tesorería origen: {mov.treasuryAccountLabel}
                                </div>
                              )}
                              {mov.referencia && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ref: {mov.referencia}</div>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: isAbono ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                              {isAbono ? '-' : '+'}{formatUsd(mov.montoUsd || 0)}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {formatBs(mov.montoBs || 0)}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                              {(mov.origen === 'MANUAL_PASIVOS' || (mov.origen === 'CAJA_BANCOS' && mov.cashMovementId && onDeleteCashMovement)) ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteManualMovement(mov)}
                                  className="pasivos-btn-danger"
                                  title="Revertir movimiento y conciliar saldos"
                                >
                                  <Trash2 size={12} />
                                  Revertir
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {mov.origen === 'CAJA_BANCOS' ? 'Desde Caja/Bancos' : 'Desde CxP'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR / EDITAR CUENTA POR PAGAR SOCIO */}
      {showPartnerModal && (() => {
        const modalNode = (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-modal-overlay)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem'
            }}
            onClick={() => setShowPartnerModal(false)}
          >
            <div
              className="pasivos-modal-card"
              style={{ maxWidth: '680px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pasivos-modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                    {editingPartnerAccId ? 'Editar Cuenta por Pagar Socio' : 'Nueva Cuenta por Pagar Socio'}
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Código Contable <strong>2.02.01.001</strong> · Sincronizada con dropdown Origen en CxP
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPartnerModal(false)}
                  className="pasivos-btn-secondary"
                  style={{ width: '32px', height: '32px', justifyContent: 'center', padding: 0, borderRadius: '8px' }}
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleSubmitPartnerAccount} style={{ padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Código *
                    </label>
                    <input
                      type="text"
                      required
                      value={partnerForm.codigo}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                      placeholder="SOC-01"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Nombre de la Cuenta *
                    </label>
                    <input
                      type="text"
                      required
                      value={partnerForm.nombre}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Cuenta por Pagar Socio Principal"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Socio / Titular
                    </label>
                    <input
                      type="text"
                      value={partnerForm.titular}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, titular: e.target.value }))}
                      placeholder="Nombre del socio"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Moneda Principal
                    </label>
                    <select
                      value={partnerForm.moneda}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, moneda: e.target.value }))}
                      className="select-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    >
                      <option value="USD">Dólares ($ USD)</option>
                      <option value="BS">Bolívares (Bs.)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Saldo Pasivo USD ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={partnerForm.saldoUsd}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, saldoUsd: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Saldo Pasivo Bs.
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={partnerForm.saldoBs}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, saldoBs: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Estado
                    </label>
                    <select
                      value={partnerForm.activa ? 'true' : 'false'}
                      onChange={(e) => setPartnerForm((f) => ({ ...f, activa: e.target.value === 'true' }))}
                      className="select-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    >
                      <option value="true">Activa (Visible en CxP)</option>
                      <option value="false">Inactiva (Oculta en CxP)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={partnerForm.observaciones}
                    onChange={(e) => setPartnerForm((f) => ({ ...f, observaciones: e.target.value }))}
                    placeholder="Acuerdo o nota de respaldo con el socio..."
                    className="input-modern"
                    style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)' }}>
                  <button
                    type="button"
                    onClick={() => setShowPartnerModal(false)}
                    className="pasivos-btn-secondary"
                    style={{ padding: '0.5rem 0.95rem', borderRadius: '8px', fontSize: '0.83rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1.1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#b45309',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Save size={15} />
                    {editingPartnerAccId ? 'Guardar Cambios' : 'Crear y Guardar Cuenta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
      })()}

      {/* MODAL CARGO / ABONO DIRECTO A CUENTA SOCIO */}
      {showMovModal && (() => {
        const modalNode = (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-modal-overlay)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem'
            }}
            onClick={() => setShowMovModal(false)}
          >
            <div
              className="pasivos-modal-card"
              style={{ maxWidth: '540px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pasivos-modal-header">
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  Registrar Cargo / Abono a Cuenta Socio
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMovModal(false)}
                  className="pasivos-btn-secondary"
                  style={{ width: '30px', height: '30px', justifyContent: 'center', padding: 0, borderRadius: '8px' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitPartnerMovement} style={{ padding: '1.2rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Cuenta por Pagar Socio *
                  </label>
                  <select
                    required
                    value={movForm.cuentaId}
                    onChange={(e) => setMovForm((f) => ({ ...f, cuentaId: e.target.value }))}
                    className="select-modern"
                    style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                  >
                    {effectivePartnerAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.codigo} · {acc.nombre} (Saldo: {formatUsd(acc.saldoUsd || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Tipo de Operación *
                    </label>
                    <select
                      value={movForm.tipo}
                      onChange={(e) => setMovForm((f) => ({ ...f, tipo: e.target.value }))}
                      className="select-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    >
                      <option value="ABONO_SOCIO">Abono / Reembolso al Socio (- Pasivo)</option>
                      <option value="CARGO_PASIVO">Nuevo Cargo / Compromiso (+ Pasivo)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Fecha *
                    </label>
                    <input
                      type="date"
                      required
                      value={movForm.fecha}
                      onChange={(e) => setMovForm((f) => ({ ...f, fecha: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>
                </div>

                {movForm.tipo === 'ABONO_SOCIO' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Cuenta de Caja Chica / Banco de donde sale el pago *
                    </label>
                    <select
                      value={movForm.treasuryAccountKey}
                      onChange={(e) => setMovForm((f) => ({ ...f, treasuryAccountKey: e.target.value }))}
                      className="select-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    >
                      {treasuryAccountOptions.some((o) => o.kind === 'CAJA') && (
                        <optgroup label="Cajas Chicas Operativas (1.01.01)">
                          {treasuryAccountOptions.filter((o) => o.kind === 'CAJA').map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </optgroup>
                      )}
                      {treasuryAccountOptions.some((o) => o.kind === 'BANCO') && (
                        <optgroup label="Cuentas Bancarias (1.01.02)">
                          {treasuryAccountOptions.filter((o) => o.kind === 'BANCO').map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="SOLO_CONTABLE">Ajuste Interno / Compensación (Sin salida de Caja ni Banco)</option>
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Monto USD ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={movForm.montoUsd}
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = Number(val || 0);
                        setMovForm((f) => ({
                          ...f,
                          montoUsd: val,
                          montoBs: num > 0 && tasaBcv > 0 ? String(round2(num * tasaBcv)) : '0'
                        }));
                      }}
                      placeholder="0.00"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Equivalente Bs.
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={movForm.montoBs}
                      onChange={(e) => setMovForm((f) => ({ ...f, montoBs: e.target.value }))}
                      placeholder="0.00"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Referencia / Comprobante
                  </label>
                  <input
                    type="text"
                    value={movForm.referencia}
                    onChange={(e) => setMovForm((f) => ({ ...f, referencia: e.target.value }))}
                    placeholder="Ej: TRF-00412 / Recibo Socio"
                    className="input-modern"
                    style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Concepto / Detalle *
                  </label>
                  <input
                    type="text"
                    required
                    value={movForm.concepto}
                    onChange={(e) => setMovForm((f) => ({ ...f, concepto: e.target.value }))}
                    placeholder="Ej: Reembolso parcial a socio por pago a proveedor..."
                    className="input-modern"
                    style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)' }}>
                  <button
                    type="button"
                    onClick={() => setShowMovModal(false)}
                    className="pasivos-btn-secondary"
                    style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '0.48rem 1.05rem', borderRadius: '8px', border: 'none', background: '#0369a1', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Save size={14} />
                    Guardar Movimiento
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
      })()}

      {/* MODAL CREAR / EDITAR OTRA CUENTA DE PASIVO */}
      {showOtherModal && (() => {
        const modalNode = (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-modal-overlay)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem'
            }}
            onClick={() => setShowOtherModal(false)}
          >
            <div
              className="pasivos-modal-card"
              style={{ maxWidth: '640px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pasivos-modal-header">
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  {editingOtherId ? 'Editar Cuenta de Pasivo' : 'Nueva Cuenta Auxiliar de Pasivo'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowOtherModal(false)}
                  className="pasivos-btn-secondary"
                  style={{ width: '30px', height: '30px', justifyContent: 'center', padding: 0, borderRadius: '8px' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitOtherAccount} style={{ padding: '1.2rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Código Interno *
                    </label>
                    <input
                      type="text"
                      required
                      value={otherForm.codigo}
                      onChange={(e) => setOtherForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Cuenta Contable (Grupo 2) *
                    </label>
                    <input
                      type="text"
                      required
                      value={otherForm.codigoContable}
                      onChange={(e) => setOtherForm((f) => ({ ...f, codigoContable: e.target.value }))}
                      placeholder="2.02.01.002"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Subgrupo Pasivo
                    </label>
                    <select
                      value={otherForm.subgrupo}
                      onChange={(e) => setOtherForm((f) => ({ ...f, subgrupo: e.target.value }))}
                      className="select-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    >
                      {Object.entries(PASIVO_SUBGROUP_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>{lbl}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Nombre de la Cuenta *
                    </label>
                    <input
                      type="text"
                      required
                      value={otherForm.nombre}
                      onChange={(e) => setOtherForm((f) => ({ ...f, nombre: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Acreedor / Ente
                    </label>
                    <input
                      type="text"
                      value={otherForm.acreedor}
                      onChange={(e) => setOtherForm((f) => ({ ...f, acreedor: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Moneda
                    </label>
                    <select
                      value={otherForm.moneda}
                      onChange={(e) => setOtherForm((f) => ({ ...f, moneda: e.target.value }))}
                      className="select-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    >
                      <option value="USD">Dólares ($ USD)</option>
                      <option value="BS">Bolívares (Bs.)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Saldo Pasivo USD ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={otherForm.saldoUsd}
                      onChange={(e) => setOtherForm((f) => ({ ...f, saldoUsd: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Saldo Pasivo Bs.
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={otherForm.saldoBs}
                      onChange={(e) => setOtherForm((f) => ({ ...f, saldoBs: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.83rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)' }}>
                  <button
                    type="button"
                    onClick={() => setShowOtherModal(false)}
                    className="pasivos-btn-secondary"
                    style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '0.48rem 1.05rem', borderRadius: '8px', border: 'none', background: 'var(--motorven-navy, #002b7a)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Save size={14} />
                    {editingOtherId ? 'Guardar Cambios' : 'Crear Cuenta de Pasivo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
      })()}

      {/* MODAL VER FICHA Y ESTADO DE CUENTA DETALLADO (PARTNER / OTHER) */}
      {viewingLiabilityModal?.account && (() => {
        const acc = viewingLiabilityModal.account;
        const kind = viewingLiabilityModal.kind || 'PARTNER';
        const { isPartner, movs, cargosUsd, abonosUsd, saldoUsd, saldoBs } = buildAccountSummaryStats(acc, kind);
        const codeContable = acc.codigoContable || (isPartner ? '2.02.01.001' : '2.06.01.001');
        const holderLabel = isPartner ? (acc.titular || 'Socio Principal') : (acc.acreedor || 'Acreedor');

        const modalNode = (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-modal-overlay)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem'
            }}
            onClick={() => setViewingLiabilityModal(null)}
          >
            <div
              className="pasivos-modal-card"
              style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pasivos-modal-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {acc.codigo} · {acc.nombre}
                    </h3>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(14, 165, 233, 0.14)', color: 'var(--neon-cyan)', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                      {codeContable}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: acc.activa !== false ? 'var(--semaforo-verde-bg)' : 'var(--bg-pill)', color: acc.activa !== false ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {acc.activa !== false ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {isPartner ? 'Socio / Titular' : 'Acreedor / Ente'}: <strong style={{ color: 'var(--text-primary)' }}>{holderLabel}</strong> · Moneda base: {acc.moneda || 'USD'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingLiabilityModal(null)}
                  className="pasivos-modal-close"
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '1.25rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.75rem 0.9rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Saldo Pasivo Actual</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '0.2rem' }}>{formatUsd(saldoUsd)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{formatBs(saldoBs)}</div>
                  </div>
                  {isPartner ? (
                    <>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.75rem 0.9rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Cargos (+ Pasivo)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neon-cyan)', marginTop: '0.2rem' }}>{formatUsd(cargosUsd)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{movs.filter((m) => m.tipo !== 'ABONO_SOCIO').length} cargo(s)</div>
                      </div>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.75rem 0.9rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Abonos (- Pasivo)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '0.2rem' }}>{formatUsd(abonosUsd)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{movs.filter((m) => m.tipo === 'ABONO_SOCIO').length} abono(s)</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.75rem 0.9rem', gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Subgrupo BA VEN-NIF 2</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                        {PASIVO_SUBGROUP_LABELS[acc.subgrupo] || acc.subgrupo || 'Otros Pasivos'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Cuenta {codeContable}</div>
                    </div>
                  )}
                </div>

                {acc.observaciones && (
                  <div style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Observaciones:</strong> {acc.observaciones}
                  </div>
                )}

                {isPartner && (
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      Movimientos e Imputaciones de esta Cuenta ({movs.length})
                    </h4>
                    <div className="pasivos-table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', position: 'sticky', top: 0, zIndex: 2 }}>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Fecha</th>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Tipo / Origen</th>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Concepto / Tesorería</th>
                            <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>USD</th>
                            <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>Bs.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movs.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '1.35rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No hay movimientos registrados para esta cuenta todavía.
                              </td>
                            </tr>
                          ) : (
                            movs.map((m) => {
                              const isAb = m.tipo === 'ABONO_SOCIO';
                              return (
                                <tr key={m.id}>
                                  <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{m.fecha || '—'}</td>
                                  <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, color: isAb ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                                    {isAb ? 'ABONO A SOCIO' : (m.origen === 'CXP_PAGO_PROVEEDOR' ? 'PAGO CXP SOCIO' : 'CARGO PASIVO')}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.75rem' }}>
                                    <div style={{ color: 'var(--text-primary)' }}>{m.concepto}</div>
                                    {m.treasuryAccountLabel && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)' }}>Tesorería: {m.treasuryAccountLabel}</div>
                                    )}
                                    {m.referencia && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ref: {m.referencia}</div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: isAb ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                                    {isAb ? '-' : '+'}{formatUsd(m.montoUsd || 0)}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    {formatBs(m.montoBs || 0)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintLiabilityAccount(acc, kind, { downloadOnly: false })}
                      style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Printer size={14} />
                      Imprimir
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintLiabilityAccount(acc, kind, { downloadOnly: true })}
                      className="pasivos-btn-secondary"
                      style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem' }}
                    >
                      <Download size={14} />
                      Descargar PDF
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isPartner && (
                      <button
                        type="button"
                        onClick={() => {
                          setViewingLiabilityModal(null);
                          handleOpenPartnerMovementModal(acc, 'ABONO_SOCIO');
                        }}
                        className="pasivos-btn-info"
                        style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem' }}
                      >
                        <ArrowRightLeft size={14} />
                        Cargo/Abono
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setViewingLiabilityModal(null);
                        if (isPartner) handleOpenEditPartner(acc);
                        else handleOpenEditOther(acc);
                      }}
                      className="pasivos-btn-secondary"
                      style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem' }}
                    >
                      <Edit2 size={14} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingLiabilityModal(null)}
                      className="pasivos-btn-secondary"
                      style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem' }}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
      })()}
    </section>
  );
}
