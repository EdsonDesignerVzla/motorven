import React, { useState, useMemo } from 'react';
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
  ArrowRightLeft
} from 'lucide-react';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import { useNotification } from '../context/NotificationContext';
import {
  loadPartnerPayableAccounts,
  upsertPartnerPayableAccountInList,
  removePartnerPayableAccountFromList,
  applyPartnerPayableBalanceDeltaInList,
  resolveExchangeRates
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

  // --- Movimientos Manuales de Pasivo Socio ---
  const [manualMovements, setManualMovements] = useState(() => loadPartnerLiabilityMovements());

  const effectiveAccountsPayable = useMemo(
    () => (Array.isArray(profitAccountsPayable) && profitAccountsPayable.length > 0 ? profitAccountsPayable : accountsPayable),
    [profitAccountsPayable, accountsPayable]
  );

  const metrics = useMemo(
    () =>
      computePasivosDashboardMetrics({
        partnerAccounts: effectivePartnerAccounts,
        otherLiabilityAccounts,
        accountsPayable: effectiveAccountsPayable,
        supplierPayments,
        config
      }),
    [effectivePartnerAccounts, otherLiabilityAccounts, effectiveAccountsPayable, supplierPayments, config]
  );

  const unifiedMovements = useMemo(
    () =>
      buildUnifiedPartnerMovementsLedger({
        partnerAccounts: effectivePartnerAccounts,
        manualMovements,
        supplierPayments
      }),
    [effectivePartnerAccounts, manualMovements, supplierPayments]
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

  // --- Modal Cargo / Abono Directo a Socio ---
  const [showMovModal, setShowMovModal] = useState(false);
  const [movForm, setMovForm] = useState({
    cuentaId: '',
    tipo: 'ABONO_SOCIO',
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
      fecha: new Date().toISOString().split('T')[0],
      montoUsd: '',
      montoBs: '',
      referencia: '',
      concepto: ''
    });
    setShowMovModal(true);
  };

  const handleSubmitPartnerMovement = (e) => {
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

    const deltaPayload = {
      targetRef: targetAcc.id || targetAcc.codigo,
      deltaUsd: round2(sign * effectiveUsd),
      deltaBs: round2(sign * effectiveBs)
    };
    const nextPartnerList = applyPartnerPayableBalanceDeltaInList(effectivePartnerAccounts, deltaPayload);
    setLocalPartnerAccounts(nextPartnerList);
    if (onAdjustPartnerPayableBalance) {
      onAdjustPartnerPayableBalance(deltaPayload);
    }

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
      usuario: currentUser?.nombre || currentUser?.username || 'ADMINISTRACION'
    });
    setManualMovements(nextMovs);
    setShowMovModal(false);
    notify.success(
      movForm.tipo === 'ABONO_SOCIO'
        ? `Abono/amortización por ${formatUsd(effectiveUsd)} registrado a "${targetAcc.nombre}".`
        : `Cargo pasivo por ${formatUsd(effectiveUsd)} acumulado en "${targetAcc.nombre}".`
    );
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

  const handleDeleteManualMovement = (mov) => {
    if (!mov || mov.origen !== 'MANUAL_PASIVOS') return;
    const reverseSign = mov.tipo === 'ABONO_SOCIO' ? 1 : -1;
    const deltaPayload = {
      targetRef: mov.cuentaId || mov.cuentaCodigo,
      deltaUsd: round2(reverseSign * Number(mov.montoUsd || 0)),
      deltaBs: round2(reverseSign * Number(mov.montoBs || 0))
    };
    const nextPartnerList = applyPartnerPayableBalanceDeltaInList(effectivePartnerAccounts, deltaPayload);
    setLocalPartnerAccounts(nextPartnerList);
    if (onAdjustPartnerPayableBalance) {
      onAdjustPartnerPayableBalance(deltaPayload);
    }
    setManualMovements((prev) => deletePartnerLiabilityMovementFromList(prev, mov.id));
    notify.info('Movimiento manual de pasivo revertido.');
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', paddingBottom: '2rem' }}>
      {/* HEADER DEL MÓDULO */}
      <div
        className="card-surface"
        style={{
          padding: '1.35rem 1.6rem',
          borderRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(255,251,235,0.9) 0%, rgba(255,255,255,0.95) 100%)',
          border: '1px solid #fde68a'
        }}
      >
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
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              Cuentas de Pasivo
            </h1>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
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
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#1e293b',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
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
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
            Pasivo Socios (2.02.01.001)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#b45309', marginTop: '0.25rem' }}>
            {formatUsd(metrics.sociosUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
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
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
            CxP Proveedores (2.02.02)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
            {formatUsd(metrics.proveedoresUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
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
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#075985', textTransform: 'uppercase' }}>
            CxP Pagadas por Socios
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0369a1', marginTop: '0.25rem' }}>
            {formatUsd(metrics.pagosAsumidosSociosUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
            {metrics.pagosAsumidosSociosCount} pago(s) imputado(s) desde CxP
          </div>
        </div>

        <div
          className="card-surface"
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '14px',
            borderLeft: '4px solid #4f46e5'
          }}
        >
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#3730a3', textTransform: 'uppercase' }}>
            Total Pasivos Monitoreados
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#312e81', marginTop: '0.25rem' }}>
            {formatUsd(metrics.totalPasivosMonitoreadosUsd)}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
            {formatBs(metrics.totalPasivosMonitoreadosBs)} · Socios + Proveedores + Otros
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL CON PESTAÑAS */}
      <div className="card-surface" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '0 1rem',
            gap: '0.25rem',
            flexWrap: 'wrap'
          }}
        >
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
              color: activeSubTab === 'socios' ? '#b45309' : '#64748b',
              borderBottom: activeSubTab === 'socios' ? '2px solid #b45309' : '2px solid transparent',
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
              color: activeSubTab === 'catalogo' ? 'var(--brand-blue, #002b7a)' : '#64748b',
              borderBottom: activeSubTab === 'catalogo' ? '2px solid var(--brand-blue, #002b7a)' : '2px solid transparent',
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
              color: activeSubTab === 'movimientos' ? 'var(--brand-blue, #002b7a)' : '#64748b',
              borderBottom: activeSubTab === 'movimientos' ? '2px solid var(--brand-blue, #002b7a)' : '2px solid transparent',
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
                  <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>
                    Cuentas por Pagar Pasivas — Socios / Accionistas (2.02.01.001)
                  </h2>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Todas las cuentas activas aquí aparecen automáticamente en el dropdown <strong>Cuenta Origen</strong> de <strong>Cuentas por Pagar (CxP)</strong> sin descontar efectivo de Caja ni Bancos.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenPartnerMovementModal(effectivePartnerAccounts[0], 'ABONO_SOCIO')}
                    disabled={effectivePartnerAccounts.length === 0}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #0284c7',
                      background: '#f0f9ff',
                      color: '#0369a1',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: effectivePartnerAccounts.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
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

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
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
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                          No hay Cuentas por Pagar Socio registradas. Haz clic en <strong>Crear Cuenta Socio</strong> para añadir la primera.
                        </td>
                      </tr>
                    ) : (
                      effectivePartnerAccounts.map((acc) => (
                        <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.8rem 1rem', fontWeight: 800, color: '#0f172a' }}>
                            {acc.codigo}
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{acc.nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Socio / Titular: {acc.titular || 'Socio'}
                              {acc.observaciones ? ` · ${acc.observaciones}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                            {acc.codigoContable || '2.02.01.001'}
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.74rem' }}>
                              {acc.moneda || 'USD'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '999px',
                                background: acc.activa !== false ? '#dcfce7' : '#f1f5f9',
                                color: acc.activa !== false ? '#166534' : '#64748b',
                                fontWeight: 700,
                                fontSize: '0.74rem'
                              }}
                            >
                              {acc.activa !== false ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: '#b45309', fontSize: '0.94rem' }}>
                              {formatUsd(acc.saldoUsd || 0)}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                              {formatBs(acc.saldoBs || 0)}
                            </div>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenPartnerMovementModal(acc, 'ABONO_SOCIO')}
                                style={{
                                  padding: '0.35rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid #bae6fd',
                                  background: '#f0f9ff',
                                  color: '#0369a1',
                                  cursor: 'pointer',
                                  fontSize: '0.74rem',
                                  fontWeight: 700
                                }}
                                title="Registrar cargo o abono en esta cuenta"
                              >
                                Cargo/Abono
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditPartner(acc)}
                                style={{
                                  padding: '0.35rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  color: '#334155',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 600
                                }}
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
                                    style={{
                                      padding: '0.35rem 0.5rem',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#fff',
                                      color: '#64748b',
                                      cursor: 'pointer',
                                      fontSize: '0.74rem'
                                    }}
                                  >
                                    No
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePartnerId(acc.id)}
                                  style={{
                                    padding: '0.35rem 0.55rem',
                                    borderRadius: '6px',
                                    border: '1px solid #fecaca',
                                    background: '#fef2f2',
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    fontSize: '0.74rem',
                                    fontWeight: 600
                                  }}
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
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      Cuentas Auxiliares de Otros Pasivos ({otherLiabilityAccounts.length})
                    </h2>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
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
                      background: 'var(--brand-blue, #002b7a)',
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

                <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
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
                        <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.7rem 0.9rem', fontWeight: 700, color: '#0f172a' }}>{acc.codigo}</td>
                          <td style={{ padding: '0.7rem 0.9rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{acc.nombre}</div>
                            <div style={{ fontSize: '0.73rem', color: '#64748b' }}>Acreedor: {acc.acreedor}</div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', fontFamily: 'monospace', color: '#334155' }}>{acc.codigoContable}</td>
                          <td style={{ padding: '0.7rem 0.9rem', fontSize: '0.76rem', color: '#475569' }}>
                            {PASIVO_SUBGROUP_LABELS[acc.subgrupo] || acc.subgrupo}
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#312e81' }}>{formatUsd(acc.saldoUsd || 0)}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatBs(acc.saldoBs || 0)}</div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditOther(acc)}
                                style={{
                                  padding: '0.3rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  color: '#334155',
                                  cursor: 'pointer',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
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
                                    style={{
                                      padding: '0.3rem 0.5rem',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#fff',
                                      color: '#64748b',
                                      cursor: 'pointer',
                                      fontSize: '0.74rem'
                                    }}
                                  >
                                    No
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteOtherId(acc.id)}
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    borderRadius: '6px',
                                    border: '1px solid #fecaca',
                                    background: '#fef2f2',
                                    color: '#b91c1c',
                                    cursor: 'pointer',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
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
                  <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                    Plan de Cuentas Oficial — Grupo 2: Pasivos ({filteredPlanRows.length})
                  </h3>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
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

                <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0', maxHeight: '420px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', position: 'sticky', top: 0 }}>
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
                            borderBottom: '1px solid #f1f5f9',
                            background: row.imputable ? '#fff' : '#f8fafc'
                          }}
                        >
                          <td style={{ padding: '0.55rem 0.85rem', fontFamily: 'monospace', fontWeight: row.imputable ? 600 : 800, color: '#0f172a' }}>
                            {row.codigo}
                          </td>
                          <td
                            style={{
                              padding: '0.55rem 0.85rem',
                              paddingLeft: `${0.85 + Math.max(0, (row.nivel || 1) - 1) * 0.75}rem`,
                              fontWeight: row.imputable ? 500 : 800,
                              color: row.imputable ? '#1e293b' : '#002b7a'
                            }}
                          >
                            {row.nombre}
                          </td>
                          <td style={{ padding: '0.55rem 0.85rem', color: '#64748b' }}>Nivel {row.nivel}</td>
                          <td style={{ padding: '0.55rem 0.85rem', fontSize: '0.75rem', color: '#475569' }}>
                            {row.imputable ? (PASIVO_SUBGROUP_LABELS[row.subgrupo] || 'Imputable') : 'Agrupación Contable'}
                          </td>
                          <td style={{ padding: '0.55rem 0.85rem', textAlign: 'right' }}>
                            {row.imputable && row.codigo !== '2.02.01.001' && (
                              <button
                                type="button"
                                onClick={() => handleOpenCreateOther(row)}
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  color: '#1e293b',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
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
                                  border: '1px solid #fcd34d',
                                  background: '#fffbeb',
                                  color: '#92400e',
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
                    <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
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

              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
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
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                          No hay movimientos registrados aún en Cuentas de Pasivo Socio.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((mov) => {
                        const isAbono = mov.tipo === 'ABONO_SOCIO';
                        return (
                          <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap', fontWeight: 600, color: '#334155' }}>
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
                                  background: isAbono ? '#dcfce7' : '#fef3c7',
                                  color: isAbono ? '#166534' : '#92400e',
                                  fontWeight: 700,
                                  fontSize: '0.73rem'
                                }}
                              >
                                {isAbono ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                                {isAbono ? 'ABONO A SOCIO' : (mov.origen === 'CXP_PAGO_PROVEEDOR' ? 'PAGO CXP SOCIO' : 'CARGO PASIVO')}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>
                              {mov.cuentaNombre}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ color: '#0f172a' }}>{mov.concepto}</div>
                              {mov.referencia && (
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Ref: {mov.referencia}</div>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: isAbono ? '#15803d' : '#b45309' }}>
                              {isAbono ? '-' : '+'}{formatUsd(mov.montoUsd || 0)}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#475569' }}>
                              {formatBs(mov.montoBs || 0)}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                              {mov.origen === 'MANUAL_PASIVOS' ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteManualMovement(mov)}
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    borderRadius: '6px',
                                    border: '1px solid #fecaca',
                                    background: '#fef2f2',
                                    color: '#b91c1c',
                                    fontSize: '0.73rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}
                                  title="Revertir movimiento manual"
                                >
                                  <Trash2 size={12} />
                                  Revertir
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Desde CxP</span>
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
      {showPartnerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.58)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.28)'
            }}
          >
            <div
              style={{
                padding: '1.1rem 1.4rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingPartnerAccId ? 'Editar Cuenta por Pagar Socio' : 'Nueva Cuenta por Pagar Socio'}
                </h3>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Código Contable <strong>2.02.01.001</strong> · Sincronizada con dropdown Origen en CxP
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPartnerModal(false)}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmitPartnerAccount} style={{ padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowPartnerModal(false)}
                  style={{
                    padding: '0.5rem 0.95rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.83rem',
                    cursor: 'pointer'
                  }}
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
      )}

      {/* MODAL CARGO / ABONO DIRECTO A CUENTA SOCIO */}
      {showMovModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.58)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '540px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.28)'
            }}
          >
            <div style={{ padding: '1rem 1.35rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Registrar Cargo / Abono a Cuenta Socio
              </h3>
              <button
                type="button"
                onClick={() => setShowMovModal(false)}
                style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitPartnerMovement} style={{ padding: '1.2rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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

                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowMovModal(false)}
                  style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
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
      )}

      {/* MODAL CREAR / EDITAR OTRA CUENTA DE PASIVO */}
      {showOtherModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.58)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.28)'
            }}
          >
            <div style={{ padding: '1rem 1.35rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                {editingOtherId ? 'Editar Cuenta de Pasivo' : 'Nueva Cuenta Auxiliar de Pasivo'}
              </h3>
              <button
                type="button"
                onClick={() => setShowOtherModal(false)}
                style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitOtherAccount} style={{ padding: '1.2rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowOtherModal(false)}
                  style={{ padding: '0.48rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.48rem 1.05rem', borderRadius: '8px', border: 'none', background: 'var(--brand-blue, #002b7a)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Save size={14} />
                  {editingOtherId ? 'Guardar Cambios' : 'Crear Cuenta de Pasivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
