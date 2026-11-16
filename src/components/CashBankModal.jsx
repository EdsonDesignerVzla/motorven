import React, { useState, useMemo, useRef } from 'react';
import {
  Wallet,
  Landmark,
  PlusCircle,
  Plus,
  Edit2,
  Trash2,
  Save,
  ShieldAlert,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RefreshCw,
  Printer,
  X,
  Search,
  Filter,
  AlertTriangle,
  Building2,
  DollarSign,
  Calculator,
  Calendar,
  Layers,
  List,
  ArrowRightLeft,
  Users
} from 'lucide-react';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import { generateCashflowPDF, generateExpenseVoucherPDF } from '../services/pdfReportService';
import { buildExpenseAccountOptions } from '../utils/profitabilityUtils';
import {
  matchesCashDesk,
  matchesBankAccount,
  applyTreasuryBalanceDelta,
  resolveExchangeRates,
  computeBankAccountValuation,
  computeBankBalancesSummary,
  computeCashDesksSummary,
  validateSufficientTreasuryBalance,
  resolveTreasuryAccountForMovement,
  computeMovementReversalDelta,
  doesMovementBelongToAccount,
  summarizeAccountMovements,
  toLocalDateKey,
  filterMovementsByPeriod,
  classifyMovementDocOrigin,
  filterMovementsByDocOrigin,
  loadCajaFiscalSplitOverrides,
  saveCajaFiscalSplitOverride,
  computeCashDeskFiscalBreakdown,
  computeCashDesksFiscalTotals,
  loadPartnerPayableAccounts,
  upsertPartnerPayableAccountInList,
  removePartnerPayableAccountFromList,
  computePartnerPayableSummary
} from '../utils/treasuryAccountUtils';
import { useNotification } from '../context/NotificationContext';

// Calcula el siguiente código correlativo CAJA-XX comenzando desde CAJA-01
const getNextCajaCorrelative = (desks = []) => {
  let maxNum = 0;
  (desks || []).forEach(d => {
    const code = String(d?.coCaja || d?.co_caja || d?.id || '').toUpperCase();
    const match = code.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  const nextNum = Math.max(1, maxNum + 1);
  return `CAJA-${String(nextNum).padStart(2, '0')}`;
};

// Calcula el siguiente código correlativo de Cuenta Bancaria (01, 02... 11...)
const getNextBankCorrelative = (accounts = []) => {
  let maxNum = 0;
  (accounts || []).forEach(b => {
    const code = String(b?.codCta || b?.cod_cta || b?.id || '').toUpperCase();
    const match = code.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  const nextNum = Math.max(1, maxNum + 1);
  return String(nextNum).padStart(2, '0');
};

export default function CashBankModal({
  cashDesks = [],
  bankAccounts = [],
  cashMovements = [],
  partnerPayableAccounts = null,
  onSavePartnerPayableAccount,
  onDeletePartnerPayableAccount,
  profitIncomeExpenseAccounts = [],
  onAddMovement,
  onUpdateMovement,
  onDeleteMovement,
  onUpdateCashDesk,
  onDeleteCashDesk,
  onUpdateBankAccount,
  onDeleteBankAccount,
  config = {},
  currentUser,
  initialTab = 'cajas'
}) {
  const notify = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab || 'cajas'); // 'cajas' | 'bancos' | 'movimientos' | 'arqueo'
  const [bankSearch, setBankSearch] = useState('');
  const [movSearch, setMovSearch] = useState('');
  const [movSort, setMovSort] = useState({ field: 'fecha', direction: 'desc' });
  const [deletingMovId, setDeletingMovId] = useState(null);
  const todayDateKey = toLocalDateKey(new Date()) || new Date().toISOString().slice(0, 10);
  const currentMonthKey = todayDateKey.slice(0, 7);
  const createDefaultPeriodFilter = () => ({
    periodMode: 'ALL',
    refDate: todayDateKey,
    refMonth: currentMonthKey,
    fromDate: `${currentMonthKey}-01`,
    toDate: todayDateKey
  });

  const [cajaMovFilterId, setCajaMovFilterId] = useState('ALL');
  const [cajaMovTypeFilter, setCajaMovTypeFilter] = useState('ALL');
  const [cajaMovDocFilter, setCajaMovDocFilter] = useState('ALL');
  const [cajaScopeFilter, setCajaScopeFilter] = useState('ALL'); // 'ALL' | 'FISCAL' | 'NO_FISCAL'
  const [collapsedCajas, setCollapsedCajas] = useState(() => new Set());
  const [fiscalSplitOverrides, setFiscalSplitOverrides] = useState(() => loadCajaFiscalSplitOverrides());
  const [cajaPeriodFilter, setCajaPeriodFilter] = useState(createDefaultPeriodFilter);
  const [bankMovFilterId, setBankMovFilterId] = useState('ALL');
  const [bankMovTypeFilter, setBankMovTypeFilter] = useState('ALL');
  const [bankMovDocFilter, setBankMovDocFilter] = useState('ALL');
  const [bankPeriodFilter, setBankPeriodFilter] = useState(createDefaultPeriodFilter);
  const [movPeriodFilter, setMovPeriodFilter] = useState(createDefaultPeriodFilter);
  const [editingMovId, setEditingMovId] = useState(null);
  const [inlineMovDraft, setInlineMovDraft] = useState(null);
  const [savingMovId, setSavingMovId] = useState(null);
  const [movDeleteSecurityModal, setMovDeleteSecurityModal] = useState({
    isOpen: false,
    step: 1,
    movement: null,
    confirmChecked: false,
    confirmText: ''
  });
  const cajaMovSectionRef = useRef(null);
  const bankMovSectionRef = useRef(null);

  // Estado para nuevo movimiento de caja / banco / transferencia
  const [showNewMovForm, setShowNewMovForm] = useState(false);
  const [movAccountKind, setMovAccountKind] = useState('CAJA'); // 'CAJA' | 'BANCO'
  const [selectedDeskId, setSelectedDeskId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [movTransferDestKind, setMovTransferDestKind] = useState('BANCO'); // 'CAJA' | 'BANCO'
  const [movTransferDestId, setMovTransferDestId] = useState('');
  const [movType, setMovType] = useState('EGRESO'); // 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA'
  const [movCategoria, setMovCategoria] = useState('GASTO_OPERATIVO');
  const [movCuentaGasto, setMovCuentaGasto] = useState('');
  const [movConcept, setMovConcept] = useState('');
  const [movMontoUsd, setMovMontoUsd] = useState('');
  const [movMontoBs, setMovMontoBs] = useState('');
  const [movMetodo, setMovMetodo] = useState('EFECTIVO_USD');
  const [movFiscalScope, setMovFiscalScope] = useState('NO_FISCAL'); // 'FISCAL' | 'NO_FISCAL'
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expenseAccountOptions = useMemo(
    () => buildExpenseAccountOptions(profitIncomeExpenseAccounts),
    [profitIncomeExpenseAccounts]
  );

  // Estado para arqueo interactivo
  const [arqueoDeskId, setArqueoDeskId] = useState('');
  const [lastArqueoActa, setLastArqueoActa] = useState(null);

  // Estado para crear / editar caja registradora
  const [showCajaForm, setShowCajaForm] = useState(false);
  const [editingCajaId, setEditingCajaId] = useState(null);
  const [cajaForm, setCajaForm] = useState({
    coCaja: 'CAJA-07',
    descripcion: '',
    moneda: 'USD',
    responsable: 'Administración',
    activa: true,
    saldoUsd: '0',
    saldoBs: '0',
    saldoFiscalUsd: '0',
    saldoNoFiscalUsd: '0',
    saldoFiscalBs: '0',
    saldoNoFiscalBs: '0'
  });

  // Estado para Modal CRUD de Cuentas por Pagar Pasivas (Socio · 2.02.01.001)
  const [localPartnerAccounts, setLocalPartnerAccounts] = useState(() => loadPartnerPayableAccounts());
  const effectivePartnerAccounts = useMemo(
    () => (Array.isArray(partnerPayableAccounts) ? partnerPayableAccounts : localPartnerAccounts),
    [partnerPayableAccounts, localPartnerAccounts]
  );
  const partnerPayableSummary = useMemo(
    () => computePartnerPayableSummary(effectivePartnerAccounts, config),
    [effectivePartnerAccounts, config]
  );
  const [showPartnerAccountsModal, setShowPartnerAccountsModal] = useState(false);
  const [editingPartnerAccId, setEditingPartnerAccId] = useState(null);
  const [confirmDeletePartnerId, setConfirmDeletePartnerId] = useState(null);
  const [partnerAccForm, setPartnerAccForm] = useState({
    codigo: 'SOC-02',
    nombre: '',
    titular: '',
    moneda: 'USD',
    saldoUsd: '0',
    saldoBs: '0',
    activa: true,
    observaciones: ''
  });

  const getNextPartnerCode = (accountsList = []) => {
    let maxNum = 0;
    (accountsList || []).forEach(a => {
      const code = String(a?.codigo || a?.id || '').toUpperCase();
      const match = code.match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n > maxNum) maxNum = n;
      }
    });
    return `SOC-${String(maxNum + 1).padStart(2, '0')}`;
  };

  const resetPartnerAccForm = (accountsList = effectivePartnerAccounts) => {
    setEditingPartnerAccId(null);
    setConfirmDeletePartnerId(null);
    setPartnerAccForm({
      codigo: getNextPartnerCode(accountsList),
      nombre: '',
      titular: '',
      moneda: 'USD',
      saldoUsd: '0',
      saldoBs: '0',
      activa: true,
      observaciones: ''
    });
  };

  const handleOpenPartnerModal = () => {
    resetPartnerAccForm(effectivePartnerAccounts);
    setShowPartnerAccountsModal(true);
  };

  const handleEditPartnerAccount = (acc) => {
    if (!acc) return;
    setEditingPartnerAccId(acc.id);
    setConfirmDeletePartnerId(null);
    setPartnerAccForm({
      codigo: acc.codigo || acc.id || 'SOCIO-01',
      nombre: acc.nombre || 'Cuenta por Pagar Socio',
      titular: acc.titular || '',
      moneda: acc.moneda || 'USD',
      saldoUsd: String(round2(Number(acc.saldoUsd || 0))),
      saldoBs: String(round2(Number(acc.saldoBs || 0))),
      activa: acc.activa !== false,
      observaciones: acc.observaciones || ''
    });
  };

  const handleSavePartnerAccountSubmit = (e) => {
    e.preventDefault();
    const cleanNombre = String(partnerAccForm.nombre || '').trim();
    if (!cleanNombre) {
      notify.warning('Ingrese el nombre de la Cuenta por Pagar Socio.');
      return;
    }
    const cleanCodigo = String(partnerAccForm.codigo || getNextPartnerCode(effectivePartnerAccounts)).trim().toUpperCase();
    const payload = {
      id: editingPartnerAccId || cleanCodigo,
      codigo: cleanCodigo,
      nombre: cleanNombre,
      titular: String(partnerAccForm.titular || '').trim() || 'Socio',
      codigoContable: '2.02.01.001',
      moneda: partnerAccForm.moneda === 'BS' ? 'BS' : 'USD',
      saldoUsd: Math.max(0, round2(Number(partnerAccForm.saldoUsd || 0))),
      saldoBs: Math.max(0, round2(Number(partnerAccForm.saldoBs || 0))),
      activa: partnerAccForm.activa !== false,
      observaciones: String(partnerAccForm.observaciones || '').trim()
    };

    const nextList = upsertPartnerPayableAccountInList(effectivePartnerAccounts, payload);
    setLocalPartnerAccounts(nextList);
    if (onSavePartnerPayableAccount) {
      onSavePartnerPayableAccount(payload);
    }
    notify.success(
      editingPartnerAccId
        ? `Cuenta pasiva "${payload.nombre}" actualizada correctamente.`
        : `Cuenta pasiva "${payload.nombre}" creada y disponible en CxP.`
    );
    resetPartnerAccForm(nextList);
  };

  const handleConfirmDeletePartnerAccount = (acc) => {
    if (!acc) return;
    const nextList = removePartnerPayableAccountFromList(effectivePartnerAccounts, acc.id || acc.codigo);
    setLocalPartnerAccounts(nextList);
    if (onDeletePartnerPayableAccount) {
      onDeletePartnerPayableAccount(acc.id || acc.codigo);
    }
    if (editingPartnerAccId === acc.id) {
      resetPartnerAccForm(nextList);
    } else {
      setConfirmDeletePartnerId(null);
    }
    notify.info(`Cuenta por Pagar Socio "${acc.nombre}" eliminada.`);
  };

  // Estado para crear / editar / guardar cuentas bancarias
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBankId, setEditingBankId] = useState(null);
  const [bankForm, setBankForm] = useState({
    codCta: '11',
    bancoNombre: '',
    cuentaANombreDe: 'GRUPO MOTORVEN, C.A.',
    numCta: '',
    moneda: 'BS',
    saldoBs: '0',
    saldoUsd: '0'
  });

  // Edición rápida en línea por fila de cuenta bancaria
  const [inlineBankEditId, setInlineBankEditId] = useState(null);
  const [inlineBankDraft, setInlineBankDraft] = useState(null);

  // Estado de Doble Seguridad para Eliminar Cuenta Bancaria
  const [bankDeleteSecurityModal, setBankDeleteSecurityModal] = useState({
    isOpen: false,
    step: 1, // 1 = Primera Confirmación, 2 = Segunda Confirmación (Bloqueo Final)
    bank: null,
    confirmChecked: false,
    confirmText: ''
  });

  // Estado para arqueo interactivo
  const [denomCounts, setDenomCounts] = useState({
    b100: 0,
    b50: 0,
    b20: 0,
    b10: 0,
    b5: 0,
    b1: 0,
    bsEfectivo: 0
  });

  const { tasaBcv, tasaKeystone } = useMemo(() => resolveExchangeRates(config), [config]);

  const cashSummary = useMemo(
    () => computeCashDesksSummary(cashDesks, { tasaDolar: tasaBcv, tasaKeystone }),
    [cashDesks, tasaBcv, tasaKeystone]
  );
  const cashFiscalTotals = useMemo(
    () => computeCashDesksFiscalTotals(cashDesks, cashMovements, bankAccounts, { tasaDolar: tasaBcv, tasaKeystone }, fiscalSplitOverrides),
    [cashDesks, cashMovements, bankAccounts, tasaBcv, tasaKeystone, fiscalSplitOverrides]
  );
  const totalCajasUsd = cashSummary.totalUsd;
  const totalCajasBs = cashSummary.totalBs;

  const bankSummary = useMemo(
    () => computeBankBalancesSummary(bankAccounts, { tasaDolar: tasaBcv, tasaKeystone }),
    [bankAccounts, tasaBcv, tasaKeystone]
  );
  const totalBancosBs = bankSummary.totalBs;
  const totalBancosUsd = bankSummary.totalUsd;

  // Total Consolidado
  const totalConsolidadoUsd = round2(totalCajasUsd + totalBancosUsd);
  const totalConsolidadoBs = round2(totalCajasBs + totalBancosBs);

  // Filtrado de bancos
  const filteredBankAccounts = useMemo(() => {
    let list = Array.isArray(bankAccounts) ? [...bankAccounts] : [];
    if (bankSearch.trim()) {
      const q = bankSearch.toLowerCase();
      list = list.filter(b =>
        (b.bancoNombre || b.banco_nombre || '').toLowerCase().includes(q) ||
        (b.cuentaANombreDe || b.cuenta_a_nombre_de || b.titular || 'GRUPO MOTORVEN, C.A.').toLowerCase().includes(q) ||
        (b.numCta || b.num_cta || '').toLowerCase().includes(q) ||
        (b.codCta || b.cod_cta || '').toLowerCase().includes(q) ||
        (b.moneda || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [bankAccounts, bankSearch]);

  const sortMovementsArray = (rows = []) => {
    const list = Array.isArray(rows) ? [...rows] : [];
    const dir = movSort.direction === 'asc' ? 1 : -1;
    const field = movSort.field || 'fecha';
    const getSortValue = (m) => {
      switch (field) {
        case 'fecha':
          return new Date(m?.fecha || m?.createdAt || 0).getTime() || 0;
        case 'tipo':
          return String(m?.tipo || '');
        case 'concepto':
          return String(m?.concepto || m?.descripcion || '');
        case 'cuenta':
          return String(m?.cuentaNombre || m?.cuenta_nombre || m?.cajaOBanco || m?.caja_o_banco || m?.metodoPago || m?.metodo || '');
        case 'usuario':
          return String(m?.usuario || 'Sistema');
        case 'montoUsd':
          return Number(m?.montoUsd ?? m?.monto_usd ?? 0) || 0;
        case 'montoBs':
          return Number(m?.montoBs ?? m?.monto_bs ?? 0) || 0;
        default:
          return 0;
      }
    };
    list.sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      }
      return cmp * dir;
    });
    return list;
  };

  // Filtrado por período, búsqueda y ordenamiento de movimientos generales
  const filteredMovements = useMemo(() => {
    let list = filterMovementsByPeriod(
      Array.isArray(cashMovements) ? cashMovements : [],
      movPeriodFilter
    );
    if (movSearch.trim()) {
      const q = movSearch.toLowerCase();
      list = list.filter(m =>
        (m.concepto || '').toLowerCase().includes(q) ||
        (m.usuario || '').toLowerCase().includes(q) ||
        (m.tipo || '').toLowerCase().includes(q) ||
        (m.metodoPago || m.metodo || '').toLowerCase().includes(q) ||
        (m.cuentaNombre || m.cajaOBanco || '').toLowerCase().includes(q)
      );
    }
    return sortMovementsArray(list);
  }, [cashMovements, movSearch, movSort, movPeriodFilter]);

  const handleMovSort = (field) => {
    setMovSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDesc = field === 'fecha' || field === 'montoUsd' || field === 'montoBs';
      return { field, direction: defaultDesc ? 'desc' : 'asc' };
    });
  };

  const renderMovSortableTh = (label, field, align = 'left') => {
    const isActive = movSort.field === field;
    const justify = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
    return (
      <th
        onClick={() => handleMovSort(field)}
        title={`Ordenar por ${label}`}
        style={{
          padding: '0.85rem 1rem',
          fontWeight: 600,
          color: isActive ? '#38bdf8' : 'var(--text-secondary)',
          textAlign: align,
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: justify, gap: '5px' }}>
          <span>{label}</span>
          {isActive ? (
            movSort.direction === 'asc'
              ? <ArrowUp size={12} color="#38bdf8" />
              : <ArrowDown size={12} color="#38bdf8" />
          ) : (
            <ArrowUpDown size={12} style={{ opacity: 0.6 }} />
          )}
        </div>
      </th>
    );
  };

  const movementAccountOptions = useMemo(() => {
    const opts = [];
    (cashDesks || []).forEach((d, idx) => {
      const key = String(d?.id || d?.coCaja || idx).trim();
      const label = `${d?.coCaja || d?.co_caja || key} — ${d?.descripcion || d?.desCaja || 'Caja'}`;
      opts.push({ value: `CAJA:${key}`, kind: 'CAJA', record: d, label });
    });
    (bankAccounts || []).forEach((b, idx) => {
      const key = String(b?.id || b?.codCta || idx).trim();
      const label = `${b?.codCta || b?.cod_cta || key} — ${b?.bancoNombre || b?.banco_nombre || 'Banco'}`;
      opts.push({ value: `BANCO:${key}`, kind: 'BANCO', record: b, label });
    });
    return opts;
  }, [cashDesks, bankAccounts]);

  const handleOpenEditMovementRow = (m) => {
    if (!m) return;
    const rowKey = m.id || `${m.fecha}-${m.concepto}`;
    const targetAcc = resolveTreasuryAccountForMovement(m, cashDesks, bankAccounts);
    let accountKey = '';
    if (targetAcc?.kind === 'CAJA' && targetAcc.record) {
      accountKey = `CAJA:${String(targetAcc.record.id || targetAcc.record.coCaja || '').trim()}`;
    } else if (targetAcc?.kind === 'BANCO' && targetAcc.record) {
      accountKey = `BANCO:${String(targetAcc.record.id || targetAcc.record.codCta || '').trim()}`;
    }

    setEditingMovId(rowKey);
    setInlineMovDraft({
      fechaIso: toLocalDateKey(m.fecha || m.createdAt || new Date()) || todayDateKey,
      tipo: String(m.tipo || 'EGRESO').toUpperCase() === 'INGRESO' ? 'INGRESO' : 'EGRESO',
      concepto: m.concepto || '',
      accountKey,
      metodoPago: m.metodoPago || m.metodo_pago || m.metodo || '',
      montoUsd: String(Number(m.montoUsd ?? m.monto_usd ?? 0)),
      montoBs: String(Number(m.montoBs ?? m.monto_bs ?? 0))
    });
  };

  const handleCancelEditMovementRow = () => {
    setEditingMovId(null);
    setInlineMovDraft(null);
  };

  const handleSaveMovementRow = async (m) => {
    if (!m || !onUpdateMovement) return;
    const rowKey = m.id || `${m.fecha}-${m.concepto}`;
    if (editingMovId !== rowKey || !inlineMovDraft) {
      handleOpenEditMovementRow(m);
      notify?.info('Modo edición activado. Modifica los campos de la fila y presiona Guardar.');
      return;
    }

    const cleanConcepto = String(inlineMovDraft.concepto || '').trim();
    if (!cleanConcepto) {
      notify?.warning('El concepto del movimiento no puede quedar vacío.');
      return;
    }

    const parsedUsd = round2(Number(inlineMovDraft.montoUsd || 0));
    const parsedBs = round2(Number(inlineMovDraft.montoBs || 0));
    if (parsedUsd <= 0 && parsedBs <= 0) {
      notify?.warning('Indica un monto válido mayor a cero en USD o Bs.');
      return;
    }

    const originalDateKey = toLocalDateKey(m.fecha || m.createdAt);
    const nextFecha = inlineMovDraft.fechaIso
      ? (inlineMovDraft.fechaIso === originalDateKey && m.fecha
          ? m.fecha
          : `${inlineMovDraft.fechaIso}T12:00:00.000Z`)
      : m.fecha;

    const selectedOpt = movementAccountOptions.find((opt) => opt.value === inlineMovDraft.accountKey) || null;
    let nextCuentaId = m.cuentaId ?? m.cuenta_id ?? '';
    let nextCajaId = m.cajaId ?? m.caja_id ?? '';
    let nextCuentaNombre = m.cuentaNombre ?? m.cuenta_nombre ?? m.cajaOBanco ?? m.caja_o_banco ?? '';

    if (selectedOpt?.record) {
      if (selectedOpt.kind === 'CAJA') {
        nextCajaId = selectedOpt.record.id || selectedOpt.record.coCaja || '';
        nextCuentaId = nextCajaId;
        nextCuentaNombre = selectedOpt.record.descripcion || selectedOpt.record.coCaja || selectedOpt.label;
      } else {
        nextCuentaId = selectedOpt.record.id || selectedOpt.record.codCta || '';
        nextCajaId = '';
        nextCuentaNombre = selectedOpt.record.bancoNombre || selectedOpt.record.banco_nombre || selectedOpt.record.codCta || selectedOpt.label;
      }
    }

    const nextMetodo = String(inlineMovDraft.metodoPago || m.metodoPago || m.metodo || '').trim() || 'EFECTIVO';
    const nextMov = {
      ...m,
      fecha: nextFecha,
      tipo: inlineMovDraft.tipo === 'INGRESO' ? 'INGRESO' : 'EGRESO',
      concepto: cleanConcepto,
      cuentaId: nextCuentaId,
      cajaId: nextCajaId,
      cuentaNombre: nextCuentaNombre,
      cajaOBanco: nextCuentaNombre,
      metodo: nextMetodo,
      metodoPago: nextMetodo,
      montoUsd: parsedUsd,
      montoBs: parsedBs
    };

    try {
      setSavingMovId(rowKey);
      await onUpdateMovement(m, nextMov);
      setEditingMovId(null);
      setInlineMovDraft(null);
      notify?.success('Movimiento actualizado y saldo recalculado correctamente.');
    } catch (err) {
      console.error('Error al guardar movimiento:', err);
      notify?.error(err?.message || 'No se pudo actualizar el movimiento.');
    } finally {
      setSavingMovId(null);
    }
  };

  const handleRequestDeleteMovement = (m) => {
    if (!m || !onDeleteMovement) return;
    setMovDeleteSecurityModal({
      isOpen: true,
      step: 1,
      movement: m,
      confirmChecked: false,
      confirmText: ''
    });
  };

  const handleConfirmFinalDeleteMovement = async () => {
    const targetMov = movDeleteSecurityModal.movement;
    if (!targetMov || !onDeleteMovement) return;

    const typed = String(movDeleteSecurityModal.confirmText || '').trim().toUpperCase();
    if (!movDeleteSecurityModal.confirmChecked || typed !== 'ELIMINAR') {
      notify?.warning('Completa la casilla y escribe exactamente ELIMINAR para continuar.');
      return;
    }

    const rowKey = targetMov.id || `${targetMov.fecha}-${targetMov.concepto}`;
    try {
      setDeletingMovId(rowKey);
      await onDeleteMovement(targetMov);
      if (editingMovId === rowKey) {
        setEditingMovId(null);
        setInlineMovDraft(null);
      }
      setMovDeleteSecurityModal({
        isOpen: false,
        step: 1,
        movement: null,
        confirmChecked: false,
        confirmText: ''
      });
      notify?.success('Movimiento eliminado y saldo revertido con Doble Seguridad.');
    } catch (err) {
      console.error('Error al eliminar movimiento:', err);
      notify?.error(err?.message || 'No se pudo eliminar el movimiento.');
    } finally {
      setDeletingMovId(null);
    }
  };

  const renderPeriodFilterControls = (periodFilter, onChangePeriodFilter) => {
    const activeMode = periodFilter?.periodMode || 'ALL';
    const updateFilter = (patch) => {
      if (!onChangePeriodFilter) return;
      onChangePeriodFilter((prev) => ({ ...prev, ...patch }));
    };

    const modeOptions = [
      { id: 'ALL', label: 'Todos' },
      { id: 'DIA', label: 'Día' },
      { id: 'SEMANA', label: 'Semana' },
      { id: 'MES', label: 'Mes' },
      { id: 'PERIODO', label: 'Período' }
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
          <Calendar size={14} color="#38bdf8" />
          <span>Período:</span>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)', gap: '3px', flexWrap: 'wrap' }}>
          {modeOptions.map((opt) => {
            const isActive = activeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateFilter({ periodMode: opt.id })}
                style={{
                  padding: '0.32rem 0.65rem',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #38bdf8' : '1px solid transparent',
                  background: isActive ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
                  color: isActive ? '#38bdf8' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {(activeMode === 'DIA' || activeMode === 'SEMANA') && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={periodFilter?.refDate || todayDateKey}
              onChange={(e) => updateFilter({ refDate: e.target.value })}
              className="input-modern"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', width: 'auto' }}
              title={activeMode === 'SEMANA' ? 'Selecciona cualquier día de la semana (Lun–Dom)' : 'Selecciona el día exacto'}
            />
            {activeMode === 'SEMANA' && (
              <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>Lun–Dom</span>
            )}
          </div>
        )}

        {activeMode === 'MES' && (
          <input
            type="month"
            value={periodFilter?.refMonth || currentMonthKey}
            onChange={(e) => updateFilter({ refMonth: e.target.value })}
            className="input-modern"
            style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', width: 'auto' }}
            title="Selecciona el mes a consultar"
          />
        )}

        {activeMode === 'PERIODO' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={periodFilter?.fromDate || `${currentMonthKey}-01`}
              onChange={(e) => updateFilter({ fromDate: e.target.value })}
              className="input-modern"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', width: 'auto' }}
              title="Fecha inicial"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>a</span>
            <input
              type="date"
              value={periodFilter?.toDate || todayDateKey}
              onChange={(e) => updateFilter({ toDate: e.target.value })}
              className="input-modern"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', width: 'auto' }}
              title="Fecha final"
            />
          </div>
        )}
      </div>
    );
  };

  const renderMovementsTable = (rows = [], emptyMsg = 'No se han registrado movimientos aún.') => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2.25rem 1rem', color: 'var(--text-muted)' }}>
          <ArrowRightLeft size={32} style={{ margin: '0 auto 0.6rem', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{emptyMsg}</p>
        </div>
      );
    }
    return (
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
              {renderMovSortableTh('Fecha', 'fecha', 'left')}
              {renderMovSortableTh('Tipo', 'tipo', 'left')}
              {renderMovSortableTh('Concepto', 'concepto', 'left')}
              {renderMovSortableTh('Cuenta / Método', 'cuenta', 'left')}
              {renderMovSortableTh('Usuario', 'usuario', 'left')}
              {renderMovSortableTh('Monto USD', 'montoUsd', 'right')}
              {renderMovSortableTh('Monto Bs', 'montoBs', 'right')}
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', whiteSpace: 'nowrap' }}>Vale PDF / Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, idx) => {
              const isIngreso = m.tipo === 'INGRESO';
              const movUsd = Number(m.montoUsd ?? m.monto_usd ?? 0);
              const movBs = Number(m.montoBs ?? m.monto_bs ?? 0);
              const accountLabel = m.cuentaNombre || m.cuenta_nombre || m.cajaOBanco || m.caja_o_banco || m.metodoPago || m.metodo || 'Efectivo';
              const methodLabel = m.metodoPago || m.metodo_pago || m.metodo || '';
              const rowKey = m.id || `${m.fecha}-${m.concepto}`;
              const isDeleting = deletingMovId === rowKey;
              const isSaving = savingMovId === rowKey;
              const isEditingRow = editingMovId === rowKey && !!inlineMovDraft;
              return (
                <tr
                  key={m.id || idx}
                  style={{
                    borderBottom: '1px solid var(--border-glass)',
                    background: isEditingRow
                      ? 'rgba(245, 158, 11, 0.08)'
                      : (idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)')
                  }}
                >
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {isEditingRow ? (
                      <input
                        type="date"
                        value={inlineMovDraft.fechaIso || ''}
                        onChange={(e) => setInlineMovDraft(prev => ({ ...prev, fechaIso: e.target.value }))}
                        className="input-modern"
                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.78rem', width: '132px' }}
                      />
                    ) : (
                      m.fecha ? new Date(m.fecha).toLocaleString() : 'N/A'
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    {isEditingRow ? (
                      <select
                        value={inlineMovDraft.tipo}
                        onChange={(e) => setInlineMovDraft(prev => ({ ...prev, tipo: e.target.value }))}
                        className="select-modern"
                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.78rem', minWidth: '105px' }}
                      >
                        <option value="INGRESO">INGRESO</option>
                        <option value="EGRESO">EGRESO</option>
                      </select>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: isIngreso ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isIngreso ? '#059669' : '#dc2626'
                      }}>
                        {isIngreso ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        {m.tipo}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: 'var(--text-primary)', minWidth: isEditingRow ? '200px' : 'auto' }}>
                    {isEditingRow ? (
                      <input
                        type="text"
                        value={inlineMovDraft.concepto}
                        onChange={(e) => setInlineMovDraft(prev => ({ ...prev, concepto: e.target.value }))}
                        className="input-modern"
                        style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem', width: '100%' }}
                        placeholder="Concepto del movimiento"
                      />
                    ) : (
                      m.concepto
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', minWidth: isEditingRow ? '190px' : 'auto' }}>
                    {isEditingRow ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <select
                          value={inlineMovDraft.accountKey}
                          onChange={(e) => setInlineMovDraft(prev => ({ ...prev, accountKey: e.target.value }))}
                          className="select-modern"
                          style={{ padding: '0.3rem 0.45rem', fontSize: '0.76rem', width: '100%' }}
                        >
                          <option value="">-- Mantener cuenta --</option>
                          {movementAccountOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={inlineMovDraft.metodoPago}
                          onChange={(e) => setInlineMovDraft(prev => ({ ...prev, metodoPago: e.target.value }))}
                          className="input-modern"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', width: '100%' }}
                          placeholder="Método / Ref"
                        />
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600 }}>{accountLabel}</div>
                        {methodLabel && methodLabel !== accountLabel && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{methodLabel}</div>
                        )}
                      </>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                    {m.usuario || 'Sistema'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: isIngreso ? '#059669' : '#dc2626' }}>
                    {isEditingRow ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={inlineMovDraft.montoUsd}
                        onChange={(e) => {
                          const val = e.target.value;
                          const numUsd = Number(val || 0);
                          setInlineMovDraft(prev => ({
                            ...prev,
                            montoUsd: val,
                            montoBs: !Number.isNaN(numUsd) && tasaBcv > 0
                              ? String(round2(numUsd * tasaBcv))
                              : prev.montoBs
                          }));
                        }}
                        className="input-modern"
                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.8rem', width: '95px', textAlign: 'right', fontFamily: 'var(--font-code)' }}
                      />
                    ) : (
                      formatUsd(movUsd)
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {isEditingRow ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={inlineMovDraft.montoBs}
                        onChange={(e) => setInlineMovDraft(prev => ({ ...prev, montoBs: e.target.value }))}
                        className="input-modern"
                        style={{ padding: '0.3rem 0.45rem', fontSize: '0.8rem', width: '110px', textAlign: 'right', fontFamily: 'var(--font-code)' }}
                      />
                    ) : (
                      formatBs(movBs)
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 7px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => generateExpenseVoucherPDF({ movement: m, config, currentUser })}
                        title="Generar Comprobante / Vale de Caja en PDF"
                      >
                        <Printer size={12} /> Vale PDF
                      </button>

                      {onUpdateMovement && (
                        <>
                          {!isEditingRow ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleOpenEditMovementRow(m)}
                              title="Editar campos de este movimiento"
                              style={{
                                padding: '4px 7px',
                                borderRadius: '6px',
                                border: '1px solid rgba(245, 158, 11, 0.45)',
                                background: 'rgba(245, 158, 11, 0.14)',
                                color: '#fbbf24',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={12} /> Editar
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={handleCancelEditMovementRow}
                              title="Cancelar edición"
                              style={{
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-glass)',
                                background: 'rgba(148, 163, 184, 0.12)',
                                color: '#cbd5e1',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={12} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={isSaving}
                            onClick={() => handleSaveMovementRow(m)}
                            title={isEditingRow ? 'Guardar cambios y recalcular saldos' : 'Activar edición para guardar cambios'}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: isEditingRow ? 'none' : '1px solid rgba(16, 185, 129, 0.4)',
                              background: isEditingRow
                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                : 'rgba(16, 185, 129, 0.12)',
                              color: isEditingRow ? '#ffffff' : '#34d399',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: isSaving ? 'wait' : 'pointer',
                              opacity: isSaving ? 0.6 : 1
                            }}
                          >
                            <Save size={12} /> {isSaving ? '...' : 'Guardar'}
                          </button>
                        </>
                      )}

                      {onDeleteMovement && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={isDeleting}
                          onClick={() => handleRequestDeleteMovement(m)}
                          title="Eliminar movimiento con Doble Seguridad y revertir su saldo"
                          style={{
                            padding: '4px 7px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: isDeleting ? 'wait' : 'pointer',
                            opacity: isDeleting ? 0.55 : 1
                          }}
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderScopedMovementsListView = ({
    scopeKind,
    accountsList = [],
    selectedAccountKey = 'ALL',
    onSelectAccountKey,
    typeFilter = 'ALL',
    onChangeTypeFilter,
    docFilter = 'ALL',
    onChangeDocFilter,
    periodFilter,
    onChangePeriodFilter,
    sectionRef
  }) => {
    const isCajaScope = scopeKind === 'CAJA';
    const selectedRecord = selectedAccountKey === 'ALL'
      ? null
      : accountsList.find((acc) => {
          const accKey = String(acc?.id || acc?.coCaja || acc?.codCta || '').trim();
          return accKey === selectedAccountKey;
        }) || null;

    const scopedByAccount = (cashMovements || []).filter((m) =>
      doesMovementBelongToAccount(m, scopeKind, selectedRecord, cashDesks, bankAccounts)
    );
    const scopedByPeriod = sortMovementsArray(
      filterMovementsByPeriod(scopedByAccount, periodFilter)
    );
    const docCounts = scopedByPeriod.reduce(
      (acc, m) => {
        const origin = classifyMovementDocOrigin(m);
        acc.all += 1;
        if (origin === 'FISCAL') acc.fiscal += 1;
        else acc.noFiscal += 1;
        return acc;
      },
      { all: 0, fiscal: 0, noFiscal: 0 }
    );
    const scopedAllTypes = filterMovementsByDocOrigin(scopedByPeriod, docFilter);
    const summary = summarizeAccountMovements(scopedAllTypes);
    const displayedRows = typeFilter === 'ALL'
      ? scopedAllTypes
      : scopedAllTypes.filter((m) => String(m?.tipo || '').toUpperCase() === typeFilter);

    const activeAccountTitle = selectedRecord
      ? (isCajaScope
          ? `${selectedRecord.coCaja || selectedRecord.co_caja || ''} — ${selectedRecord.descripcion || ''}`
          : `${selectedRecord.codCta || selectedRecord.cod_cta || ''} — ${selectedRecord.bancoNombre || selectedRecord.banco_nombre || ''}`)
      : (isCajaScope ? 'Todas las Cajas Registradoras' : 'Todas las Cuentas Bancarias');

    return (
      <div
        ref={sectionRef}
        style={{
          marginTop: '1.65rem',
          padding: '1.25rem',
          background: 'var(--bg-card-glass)',
          border: '1px solid var(--border-glass)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <List size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ListView de Movimientos (Entradas y Salidas) — {activeAccountTitle}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Mostrando {displayedRows.length} movimiento(s) {selectedRecord ? 'de la cuenta seleccionada' : (isCajaScope ? 'del catálogo de Cajas' : 'del catálogo Bancario')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={selectedAccountKey}
              onChange={(e) => onSelectAccountKey(e.target.value)}
              className="select-modern"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', minWidth: '220px' }}
              title="Filtrar movimientos por cuenta específica"
            >
              <option value="ALL">
                {isCajaScope ? `Todas las Cajas (${accountsList.length})` : `Todos los Bancos (${accountsList.length})`}
              </option>
              {accountsList.map((acc, idx) => {
                const key = String(acc?.id || acc?.coCaja || acc?.codCta || idx).trim();
                const label = isCajaScope
                  ? `${acc.coCaja || acc.co_caja || key} — ${acc.descripcion || ''}`
                  : `${acc.codCta || acc.cod_cta || key} — ${acc.bancoNombre || acc.banco_nombre || ''}`;
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
            </select>

            <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)', gap: '3px' }}>
              {[
                { id: 'ALL', label: `Todos (${summary.totalCount})`, color: '#38bdf8' },
                { id: 'INGRESO', label: `Entradas (${summary.entradasCount})`, color: '#10b981' },
                { id: 'EGRESO', label: `Salidas (${summary.salidasCount})`, color: '#ef4444' }
              ].map((t) => {
                const isActive = typeFilter === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeTypeFilter(t.id)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: isActive ? `1px solid ${t.color}` : '1px solid transparent',
                      background: isActive ? 'rgba(15, 23, 42, 0.7)' : 'transparent',
                      color: isActive ? t.color : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {typeof onChangeDocFilter === 'function' && (
              <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)', gap: '3px' }}>
                {[
                  { id: 'ALL', label: `Docs: Todos (${docCounts.all})`, color: '#94a3b8' },
                  { id: 'FISCAL', label: `Fiscal (${docCounts.fiscal})`, color: '#a855f7' },
                  { id: 'NO_FISCAL', label: `No Fiscal / N/E (${docCounts.noFiscal})`, color: '#f59e0b' }
                ].map((d) => {
                  const isActive = docFilter === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onChangeDocFilter(d.id)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        border: isActive ? `1px solid ${d.color}` : '1px solid transparent',
                        background: isActive ? 'rgba(15, 23, 42, 0.7)' : 'transparent',
                        color: isActive ? d.color : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '0.95rem', padding: '0.6rem 0.85rem', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.35)', border: '1px solid var(--border-glass)' }}>
          {renderPeriodFilterControls(periodFilter, onChangePeriodFilter)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>Total Entradas ({summary.entradasCount})</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-code)' }}>+ {formatUsd(summary.entradasUsd)}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>{formatBs(summary.entradasBs)}</div>
          </div>
          <div style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>Total Salidas ({summary.salidasCount})</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f87171', fontFamily: 'var(--font-code)' }}>- {formatUsd(summary.salidasUsd)}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>{formatBs(summary.salidasBs)}</div>
          </div>
          <div style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>Flujo Neto Período</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: summary.netoUsd >= 0 ? '#38bdf8' : '#f87171', fontFamily: 'var(--font-code)' }}>
              {summary.netoUsd >= 0 ? '+' : ''}{formatUsd(summary.netoUsd)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>{formatBs(summary.netoBs)}</div>
          </div>
        </div>

        {renderMovementsTable(
          displayedRows,
          `No hay ${typeFilter === 'INGRESO' ? 'entradas' : (typeFilter === 'EGRESO' ? 'salidas' : 'movimientos')} registrados para ${activeAccountTitle}.`
        )}
      </div>
    );
  };

  // Selección de caja física para arqueo (evita mezclar cajas digitales como Zelle/Binance)
  const effectiveArqueoDesk = useMemo(() => {
    if (!Array.isArray(cashDesks) || cashDesks.length === 0) return null;
    if (arqueoDeskId) {
      const match = cashDesks.find(d => matchesCashDesk(d, arqueoDeskId));
      if (match) return match;
    }
    const physicalUsdDesk = cashDesks.find(d => {
      const desc = String(d?.descripcion || d?.desCaja || '').toUpperCase();
      return String(d?.moneda || '').toUpperCase() === 'USD'
        && !desc.includes('ZELLE')
        && !desc.includes('USDT')
        && !desc.includes('USDC')
        && !desc.includes('BINANCE')
        && !desc.includes('KONTIGO');
    });
    return physicalUsdDesk || cashDesks[0];
  }, [cashDesks, arqueoDeskId]);

  const arqueoSystemUsd = Number(effectiveArqueoDesk?.saldoUsd ?? effectiveArqueoDesk?.saldo_usd ?? cashSummary.physicalUsd ?? 0);
  const arqueoSystemBs = Number(effectiveArqueoDesk?.saldoBs ?? effectiveArqueoDesk?.saldo_bs ?? cashSummary.physicalBs ?? 0);

  // Conteo físico del arqueo
  const arqueoTotalUsd = useMemo(() => {
    return (
      (denomCounts.b100 || 0) * 100 +
      (denomCounts.b50 || 0) * 50 +
      (denomCounts.b20 || 0) * 20 +
      (denomCounts.b10 || 0) * 10 +
      (denomCounts.b5 || 0) * 5 +
      (denomCounts.b1 || 0) * 1
    );
  }, [denomCounts]);

  const arqueoTotalBs = Number(denomCounts.bsEfectivo || 0);
  const arqueoDiferenciaUsd = round2(arqueoTotalUsd - arqueoSystemUsd);
  const arqueoDiferenciaBs = round2(arqueoTotalBs - arqueoSystemBs);

  const handleRegisterArqueo = async ({ applyAdjustment = false } = {}) => {
    if (!effectiveArqueoDesk) {
      notify.warning('No hay una caja seleccionada para auditar.');
      return;
    }
    const isBsDesk = String(effectiveArqueoDesk.moneda || '').toUpperCase() === 'BS';
    const diffUsd = arqueoDiferenciaUsd;
    const diffBs = arqueoDiferenciaBs;
    const relevantDiff = isBsDesk ? diffBs : diffUsd;

    const acta = {
      fecha: new Date().toISOString(),
      cajaId: effectiveArqueoDesk.id || effectiveArqueoDesk.coCaja,
      cajaNombre: effectiveArqueoDesk.descripcion,
      moneda: effectiveArqueoDesk.moneda || 'USD',
      contadoUsd: arqueoTotalUsd,
      sistemaUsd: arqueoSystemUsd,
      diferenciaUsd: diffUsd,
      contadoBs: arqueoTotalBs,
      sistemaBs: arqueoSystemBs,
      diferenciaBs: diffBs,
      ajustado: applyAdjustment && Math.abs(relevantDiff) >= 0.01,
      auditor: currentUser?.nombre || currentUser?.username || 'Auditor'
    };

    try {
      setIsSubmitting(true);
      if (applyAdjustment && Math.abs(relevantDiff) >= 0.01) {
        const adjType = relevantDiff > 0 ? 'INGRESO' : 'EGRESO';
        const absUsd = isBsDesk
          ? (tasaBcv > 0 ? round2(Math.abs(diffBs) / tasaBcv) : Math.abs(diffUsd))
          : round2(Math.abs(diffUsd));
        const absBs = isBsDesk
          ? round2(Math.abs(diffBs))
          : round2(absUsd * tasaBcv);

        if (adjType === 'EGRESO') {
          const check = validateSufficientTreasuryBalance(effectiveArqueoDesk, {
            deltaUsd: -absUsd,
            deltaBs: -absBs,
            label: effectiveArqueoDesk.descripcion
          });
          if (!check.ok) {
            notify.error(check.message);
            return;
          }
        }

        if (onAddMovement) {
          await onAddMovement({
            id: `ARQ-${Date.now()}`,
            fecha: new Date().toISOString(),
            tipo: adjType,
            categoria: 'ARQUEO_AJUSTE',
            concepto: `Ajuste por Arqueo (${effectiveArqueoDesk.coCaja || effectiveArqueoDesk.descripcion}): ${adjType === 'INGRESO' ? 'Sobrante' : 'Faltante'}`,
            montoUsd: absUsd,
            monto_usd: absUsd,
            montoBs: absBs,
            monto_bs: absBs,
            metodo: isBsDesk ? 'EFECTIVO_BS' : 'EFECTIVO_USD',
            metodoPago: isBsDesk ? 'EFECTIVO_BS' : 'EFECTIVO_USD',
            cuentaId: effectiveArqueoDesk.id || effectiveArqueoDesk.coCaja,
            cajaId: effectiveArqueoDesk.id || effectiveArqueoDesk.coCaja,
            cuentaNombre: effectiveArqueoDesk.descripcion,
            cajaOBanco: effectiveArqueoDesk.descripcion,
            tasa: tasaBcv,
            usuario: acta.auditor
          });
        }
        if (onUpdateCashDesk) {
          const deltaUsd = relevantDiff > 0 ? absUsd : -absUsd;
          const deltaBs = relevantDiff > 0 ? absBs : -absBs;
          await onUpdateCashDesk(applyTreasuryBalanceDelta(effectiveArqueoDesk, { deltaUsd, deltaBs, clampZero: false }));
        }
      }
      setLastArqueoActa(acta);
      notify.success(
        applyAdjustment && Math.abs(relevantDiff) >= 0.01
          ? `Arqueo registrado y saldo ajustado en ${effectiveArqueoDesk.descripcion}.`
          : `Acta de arqueo registrada para ${effectiveArqueoDesk.descripcion}.`
      );
    } catch (err) {
      console.error(err);
      notify.error('Error al registrar el arqueo: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar movimiento o transferencia interna
  const handleSaveMovement = async (e) => {
    e.preventDefault();
    if (!movConcept.trim()) {
      notify.warning('Por favor ingrese el concepto del movimiento');
      return;
    }
    const montoUsd = parseFloat(movMontoUsd) || 0;
    const montoBs = parseFloat(movMontoBs) || 0;
    if (montoUsd <= 0 && montoBs <= 0) {
      notify.warning('Por favor ingrese un monto válido en USD o Bs');
      return;
    }

    const effectiveUsd = montoUsd > 0 ? round2(montoUsd) : (tasaBcv > 0 ? round2(montoBs / tasaBcv) : 0);
    const effectiveBs = montoBs > 0 ? round2(montoBs) : round2(effectiveUsd * tasaBcv);
    const operatorName = currentUser?.nombre || currentUser?.username || 'Cajero';

    const sourceRecord = movAccountKind === 'CAJA'
      ? cashDesks.find(d => matchesCashDesk(d, selectedDeskId))
      : bankAccounts.find(b => matchesBankAccount(b, selectedBankId));

    if ((movAccountKind === 'BANCO' || movType === 'TRANSFERENCIA') && !sourceRecord) {
      notify.warning(`Seleccione ${movAccountKind === 'CAJA' ? 'la caja' : 'la cuenta bancaria'} afectada.`);
      return;
    }

    if (movType === 'TRANSFERENCIA') {
      const destRecord = movTransferDestKind === 'CAJA'
        ? cashDesks.find(d => matchesCashDesk(d, movTransferDestId))
        : bankAccounts.find(b => matchesBankAccount(b, movTransferDestId));
      if (!destRecord) {
        notify.warning('Seleccione la cuenta o caja destino de la transferencia interna.');
        return;
      }
      const sameAccount = movAccountKind === movTransferDestKind
        && String(sourceRecord.id || sourceRecord.coCaja || sourceRecord.codCta) === String(destRecord.id || destRecord.coCaja || destRecord.codCta);
      if (sameAccount) {
        notify.warning('La cuenta origen y destino no pueden ser la misma.');
        return;
      }
      const balCheck = validateSufficientTreasuryBalance(sourceRecord, {
        deltaUsd: -effectiveUsd,
        deltaBs: -effectiveBs,
        label: sourceRecord.descripcion || sourceRecord.bancoNombre
      });
      if (!balCheck.ok) {
        notify.error(balCheck.message);
        return;
      }

      try {
        setIsSubmitting(true);
        const nowIso = new Date().toISOString();
        const originLabel = sourceRecord.descripcion || sourceRecord.bancoNombre || sourceRecord.id;
        const destLabel = destRecord.descripcion || destRecord.bancoNombre || destRecord.id;

        if (movAccountKind === 'CAJA' && onUpdateCashDesk) {
          await onUpdateCashDesk(applyTreasuryBalanceDelta(sourceRecord, { deltaUsd: -effectiveUsd, deltaBs: -effectiveBs, clampZero: false, nowIso }));
        } else if (movAccountKind === 'BANCO' && onUpdateBankAccount) {
          await onUpdateBankAccount(applyTreasuryBalanceDelta(sourceRecord, { deltaUsd: -effectiveUsd, deltaBs: -effectiveBs, clampZero: false, nowIso }));
        }

        if (movTransferDestKind === 'CAJA' && onUpdateCashDesk) {
          await onUpdateCashDesk(applyTreasuryBalanceDelta(destRecord, { deltaUsd: effectiveUsd, deltaBs: effectiveBs, clampZero: false, nowIso }));
        } else if (movTransferDestKind === 'BANCO' && onUpdateBankAccount) {
          await onUpdateBankAccount(applyTreasuryBalanceDelta(destRecord, { deltaUsd: effectiveUsd, deltaBs: effectiveBs, clampZero: false, nowIso }));
        }

        if (onAddMovement) {
          await onAddMovement({
            id: `TRF-OUT-${Date.now()}`,
            fecha: nowIso,
            tipo: 'EGRESO',
            categoria: 'TRANSFERENCIA_INTERNA',
            concepto: `Transferencia a ${destLabel}: ${movConcept.trim()}`,
            montoUsd: effectiveUsd,
            monto_usd: effectiveUsd,
            montoBs: effectiveBs,
            monto_bs: effectiveBs,
            metodo: movMetodo,
            metodoPago: movMetodo,
            cuentaId: sourceRecord.id || sourceRecord.coCaja || sourceRecord.codCta,
            cajaId: movAccountKind === 'CAJA' ? (sourceRecord.id || sourceRecord.coCaja) : null,
            cuentaNombre: originLabel,
            cajaOBanco: originLabel,
            tasa: tasaBcv,
            usuario: operatorName
          });
          await onAddMovement({
            id: `TRF-IN-${Date.now() + 1}`,
            fecha: nowIso,
            tipo: 'INGRESO',
            categoria: 'TRANSFERENCIA_INTERNA',
            concepto: `Transferencia desde ${originLabel}: ${movConcept.trim()}`,
            montoUsd: effectiveUsd,
            monto_usd: effectiveUsd,
            montoBs: effectiveBs,
            monto_bs: effectiveBs,
            metodo: movMetodo,
            metodoPago: movMetodo,
            cuentaId: destRecord.id || destRecord.coCaja || destRecord.codCta,
            cajaId: movTransferDestKind === 'CAJA' ? (destRecord.id || destRecord.coCaja) : null,
            cuentaNombre: destLabel,
            cajaOBanco: destLabel,
            tasa: tasaBcv,
            usuario: operatorName
          });
        }

        setMovConcept('');
        setMovMontoUsd('');
        setMovMontoBs('');
        setShowNewMovForm(false);
        notify.success(`Transferencia interna registrada (${originLabel} → ${destLabel}).`);
      } catch (err) {
        console.error(err);
        notify.error('Error al registrar transferencia: ' + (err.message || 'Error desconocido'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (movType === 'EGRESO' && sourceRecord) {
      const balCheck = validateSufficientTreasuryBalance(sourceRecord, {
        deltaUsd: -effectiveUsd,
        deltaBs: -effectiveBs,
        label: sourceRecord.descripcion || sourceRecord.bancoNombre
      });
      if (!balCheck.ok) {
        notify.error(balCheck.message);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const nowIso = new Date().toISOString();
      const targetLabel = sourceRecord ? (sourceRecord.descripcion || sourceRecord.bancoNombre || sourceRecord.id) : 'Caja General';
      const targetId = sourceRecord ? (sourceRecord.id || sourceRecord.coCaja || sourceRecord.codCta) : '';
      const selectedProfitAcc = expenseAccountOptions.profitAccounts.find((a) => a.code === movCuentaGasto);
      const rawConceptTrimmed = movConcept.trim();
      const hasDocTag = /\[(?:NO[\s_-]*)?FISCAL\]|FACTURA|\bNE[-\s#]*\d+|\bFAC[-\s#]*\d+/i.test(rawConceptTrimmed);
      const taggedConcepto = movAccountKind === 'CAJA' && !hasDocTag
        ? `[${movFiscalScope === 'FISCAL' ? 'FISCAL' : 'NO FISCAL'}] ${rawConceptTrimmed}`
        : rawConceptTrimmed;
      const newMov = {
        id: `MOV-${Date.now()}`,
        fecha: nowIso,
        tipo: movType,
        categoria: movType === 'INGRESO' ? 'DEPOSITO_MANUAL' : (movCategoria || 'GASTO_OPERATIVO'),
        cuentaGasto: selectedProfitAcc?.code || null,
        cuentaGastoDesc: selectedProfitAcc?.descrip || '',
        concepto: taggedConcepto,
        fiscalScope: movAccountKind === 'CAJA' ? movFiscalScope : undefined,
        referenciaTipo: movAccountKind === 'CAJA' ? movFiscalScope : undefined,
        montoUsd: effectiveUsd,
        monto_usd: effectiveUsd,
        montoBs: effectiveBs,
        monto_bs: effectiveBs,
        metodo: movMetodo,
        metodoPago: movMetodo,
        cuentaId: targetId,
        cajaId: movAccountKind === 'CAJA' ? targetId : null,
        cuentaNombre: targetLabel,
        cajaOBanco: targetLabel,
        tasa: tasaBcv,
        usuario: operatorName
      };

      if (sourceRecord) {
        const deltaUsd = movType === 'INGRESO' ? effectiveUsd : -effectiveUsd;
        const deltaBs = movType === 'INGRESO' ? effectiveBs : -effectiveBs;
        if (movAccountKind === 'CAJA' && onUpdateCashDesk) {
          await onUpdateCashDesk(applyTreasuryBalanceDelta(sourceRecord, { deltaUsd, deltaBs, clampZero: false, nowIso }));
        } else if (movAccountKind === 'BANCO' && onUpdateBankAccount) {
          await onUpdateBankAccount(applyTreasuryBalanceDelta(sourceRecord, { deltaUsd, deltaBs, clampZero: false, nowIso }));
        }
      }

      if (onAddMovement) {
        await onAddMovement(newMov);
      }

      setMovConcept('');
      setMovCuentaGasto('');
      setMovMontoUsd('');
      setMovMontoBs('');
      setShowNewMovForm(false);
      notify.success('Movimiento registrado correctamente');
    } catch (err) {
      console.error(err);
      notify.error('Error al registrar movimiento: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir formulario para crear nueva caja con correlativo automático CAJA-XX
  const handleOpenCreateCaja = () => {
    const nextCode = getNextCajaCorrelative(cashDesks);
    setEditingCajaId(null);
    setCajaForm({
      coCaja: nextCode,
      descripcion: '',
      moneda: 'USD',
      responsable: 'Administración',
      activa: true,
      saldoUsd: '0',
      saldoBs: '0',
      saldoFiscalUsd: '0',
      saldoNoFiscalUsd: '0',
      saldoFiscalBs: '0',
      saldoNoFiscalBs: '0'
    });
    setShowCajaForm(true);
    setShowNewMovForm(false);
  };

  // Abrir formulario para editar una caja existente
  const handleOpenEditCaja = (desk) => {
    if (!desk) return;
    const bd = computeCashDeskFiscalBreakdown(
      desk,
      cashMovements,
      cashDesks,
      bankAccounts,
      { tasaDolar: tasaBcv, tasaKeystone },
      fiscalSplitOverrides
    );
    setEditingCajaId(desk.id);
    setCajaForm({
      coCaja: desk.coCaja || desk.co_caja || 'CAJA-01',
      descripcion: desk.descripcion || desk.desCaja || '',
      moneda: desk.moneda || 'USD',
      responsable: desk.responsable || 'Administración',
      activa: desk.activa !== false,
      saldoUsd: String(bd.totalUsd),
      saldoBs: String(bd.totalBs),
      saldoFiscalUsd: String(bd.fiscalUsd),
      saldoNoFiscalUsd: String(bd.noFiscalUsd),
      saldoFiscalBs: String(bd.fiscalBs),
      saldoNoFiscalBs: String(bd.noFiscalBs)
    });
    setShowCajaForm(true);
    setShowNewMovForm(false);
  };

  // Guardar caja nueva o editada
  const handleSaveCaja = async (e) => {
    e.preventDefault();
    const cleanCode = String(cajaForm.coCaja || '').trim().toUpperCase() || getNextCajaCorrelative(cashDesks);
    const cleanDesc = String(cajaForm.descripcion || '').trim();
    if (!cleanDesc) {
      notify.warning('Por favor ingrese el nombre o descripción de la caja');
      return;
    }

    if (!editingCajaId) {
      const duplicate = cashDesks.find(d => matchesCashDesk(d, cleanCode));
      if (duplicate) {
        notify.warning(`Ya existe una caja con el código ${cleanCode} (${duplicate.descripcion}).`);
        return;
      }
    }

    const fUsd = Math.max(0, parseFloat(cajaForm.saldoFiscalUsd) || 0);
    const nfUsd = Math.max(0, parseFloat(cajaForm.saldoNoFiscalUsd) || 0);
    const fBs = Math.max(0, parseFloat(cajaForm.saldoFiscalBs) || 0);
    const nfBs = Math.max(0, parseFloat(cajaForm.saldoNoFiscalBs) || 0);
    const parsedUsd = round2(fUsd + nfUsd);
    const parsedBs = round2(fBs + nfBs);

    try {
      setIsSubmitting(true);
      const id = editingCajaId || cleanCode.toLowerCase();
      const targetDesk = cashDesks.find(d => matchesCashDesk(d, id) || matchesCashDesk(d, cleanCode)) || { id, coCaja: cleanCode };
      const bd = computeCashDeskFiscalBreakdown(
        targetDesk,
        cashMovements,
        cashDesks,
        bankAccounts,
        { tasaDolar: tasaBcv, tasaKeystone },
        fiscalSplitOverrides
      );
      const nextOverrides = saveCajaFiscalSplitOverride(cleanCode, {
        baseFiscalUsd: round2(fUsd),
        baseFiscalBs: round2(fBs),
        movFiscalBaselineUsd: bd.fiscalMovNetUsd,
        movFiscalBaselineBs: bd.fiscalMovNetBs,
        updatedAt: new Date().toISOString()
      });
      setFiscalSplitOverrides(nextOverrides);

      const payload = {
        id,
        coCaja: cleanCode,
        co_caja: cleanCode,
        descripcion: cleanDesc,
        desCaja: cleanDesc,
        des_caja: cleanDesc,
        moneda: cajaForm.moneda || 'USD',
        responsable: String(cajaForm.responsable || 'Administración').trim() || 'Administración',
        activa: Boolean(cajaForm.activa),
        saldoUsd: parsedUsd,
        saldo_usd: parsedUsd,
        saldoBs: parsedBs,
        saldo_bs: parsedBs
      };

      if (onUpdateCashDesk) {
        await onUpdateCashDesk(payload);
      }

      setShowCajaForm(false);
      setEditingCajaId(null);
      notify.success(
        editingCajaId
          ? `Caja ${cleanCode} (${cleanDesc}) actualizada exitosamente`
          : `Nueva caja ${cleanCode} (${cleanDesc}) creada exitosamente`
      );
    } catch (err) {
      console.error(err);
      notify.error('Error al guardar la caja: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar caja registradora
  const handleDeleteCaja = async (desk) => {
    if (!desk) return;
    const code = desk.coCaja || desk.co_caja || desk.id;
    if (!window.confirm(`¿Está seguro de eliminar la caja ${code} — "${desk.descripcion}"?`)) {
      return;
    }
    try {
      if (onDeleteCashDesk) {
        await onDeleteCashDesk(desk.id || code);
      }
      notify.info(`Caja ${code} eliminada del catálogo.`);
    } catch (err) {
      console.error(err);
      notify.error('No se pudo eliminar la caja: ' + (err.message || 'Error desconocido'));
    }
  };

  // =========================================================
  // ACCIONES DE CUENTAS BANCARIAS: CREAR, EDITAR, GUARDAR, ELIMINAR (DOBLE SEGURIDAD)
  // =========================================================
  const handleOpenCreateBank = () => {
    const nextCode = getNextBankCorrelative(bankAccounts);
    setEditingBankId(null);
    setInlineBankEditId(null);
    setInlineBankDraft(null);
    setBankForm({
      codCta: nextCode,
      bancoNombre: '',
      cuentaANombreDe: 'GRUPO MOTORVEN, C.A.',
      numCta: '',
      moneda: 'BS',
      saldoBs: '0',
      saldoUsd: '0'
    });
    setShowBankForm(true);
  };

  const handleOpenEditBank = (b) => {
    if (!b) return;
    const code = b.codCta || b.cod_cta || '01';
    const id = b.id || `CTA-${code}`;
    const holder = b.cuentaANombreDe || b.cuenta_a_nombre_de || b.titular || 'GRUPO MOTORVEN, C.A.';
    const valuation = computeBankAccountValuation(b, { tasaDolar: tasaBcv, tasaKeystone });

    setShowBankForm(false);
    setEditingBankId(null);
    setInlineBankEditId(id);
    setInlineBankDraft({
      id,
      codCta: code,
      bancoNombre: b.bancoNombre || b.banco_nombre || '',
      cuentaANombreDe: holder,
      numCta: b.numCta || b.num_cta || '',
      moneda: b.moneda || 'BS',
      saldoBs: String(round2(valuation.bs)),
      saldoUsd: String(round2(valuation.usd))
    });
  };

  const handleSaveBankRecord = async (recordData, isInline = false) => {
    const cleanCode = String(recordData.codCta || '').trim() || getNextBankCorrelative(bankAccounts);
    const cleanBanco = String(recordData.bancoNombre || '').trim();
    const cleanTitular = String(recordData.cuentaANombreDe || 'GRUPO MOTORVEN, C.A.').trim() || 'GRUPO MOTORVEN, C.A.';
    const cleanNumCta = String(recordData.numCta || '').trim();

    if (!cleanBanco) {
      notify.warning('Por favor ingrese el nombre de la Institución Bancaria');
      return;
    }

    if (!isInline && !editingBankId) {
      const duplicate = bankAccounts.find(b => matchesBankAccount(b, cleanCode));
      if (duplicate) {
        notify.warning(`Ya existe una cuenta bancaria con el código ${cleanCode} (${duplicate.bancoNombre || duplicate.banco_nombre}).`);
        return;
      }
    }

    const hasBs = recordData.saldoBs !== undefined && recordData.saldoBs !== '';
    const hasUsd = recordData.saldoUsd !== undefined && recordData.saldoUsd !== '';
    const rawBsVal = hasBs ? (parseFloat(recordData.saldoBs) || 0) : 0;
    const rawUsdVal = hasUsd ? (parseFloat(recordData.saldoUsd) || 0) : 0;

    const parsedBs = hasBs
      ? round2(rawBsVal)
      : (hasUsd && tasaBcv > 0 ? round2(rawUsdVal * tasaBcv) : 0);
    const parsedUsd = hasUsd
      ? round2(rawUsdVal)
      : (tasaBcv > 0 ? round2(parsedBs / tasaBcv) : 0);

    try {
      setIsSubmitting(true);
      const id = recordData.id || editingBankId || `CTA-${cleanCode}`;
      const payload = {
        id,
        codCta: cleanCode,
        cod_cta: cleanCode,
        bancoNombre: cleanBanco,
        banco_nombre: cleanBanco,
        cuentaANombreDe: cleanTitular,
        cuenta_a_nombre_de: cleanTitular,
        titular: cleanTitular,
        numCta: cleanNumCta,
        num_cta: cleanNumCta,
        moneda: String(recordData.moneda || 'BS').toUpperCase(),
        saldoBs: parsedBs,
        saldo_bs: parsedBs,
        saldoUsd: parsedUsd,
        saldo_usd: parsedUsd,
        fechaActualizacion: new Date().toISOString()
      };

      if (onUpdateBankAccount) {
        await onUpdateBankAccount(payload);
      }

      setShowBankForm(false);
      setEditingBankId(null);
      setInlineBankEditId(null);
      setInlineBankDraft(null);
      notify.success(
        isInline || editingBankId
          ? `Cuenta bancaria ${cleanCode} (${cleanBanco}) guardada exitosamente`
          : `Nueva cuenta bancaria ${cleanCode} (${cleanBanco}) creada y guardada exitosamente`
      );
    } catch (err) {
      console.error(err);
      notify.error('Error al guardar la cuenta bancaria: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBankForm = async (e) => {
    e.preventDefault();
    await handleSaveBankRecord(bankForm, false);
  };

  // Iniciar flujo de Doble Seguridad para Eliminar Cuenta Bancaria
  const handleRequestDeleteBank = (b) => {
    if (!b) return;
    setBankDeleteSecurityModal({
      isOpen: true,
      step: 1,
      bank: b,
      confirmChecked: false,
      confirmText: ''
    });
  };

  const handleConfirmDeleteBankFinal = async () => {
    const targetBank = bankDeleteSecurityModal.bank;
    if (!targetBank) return;
    const code = String(targetBank.codCta || targetBank.cod_cta || '').trim();
    const typed = String(bankDeleteSecurityModal.confirmText || '').trim().toUpperCase();
    const isTextValid = typed === 'ELIMINAR' || (code && typed === code.toUpperCase());

    if (!bankDeleteSecurityModal.confirmChecked || !isTextValid) {
      notify.warning('Complete la doble verificación de seguridad (casilla + escribir ELIMINAR) para continuar.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (onDeleteBankAccount) {
        await onDeleteBankAccount(targetBank.id || `CTA-${code}`);
      }
      setBankDeleteSecurityModal({
        isOpen: false,
        step: 1,
        bank: null,
        confirmChecked: false,
        confirmText: ''
      });
      if (editingBankId === targetBank.id) {
        setShowBankForm(false);
        setEditingBankId(null);
      }
      if (inlineBankEditId === targetBank.id) {
        setInlineBankEditId(null);
        setInlineBankDraft(null);
      }
      notify.info(`Cuenta bancaria ${code} — ${targetBank.bancoNombre || targetBank.banco_nombre} eliminada definitivamente.`);
    } catch (err) {
      console.error(err);
      notify.error('No se pudo eliminar la cuenta bancaria: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función de reporte PDF oficial
  const handlePrint = () => {
    generateCashflowPDF({
      bankAccounts,
      cashDesks,
      cashMovements,
      config: { ...config, tasaDolar: tasaBcv },
      currentUser
    });
  };

  return (
    <section 
      className="cash-bank-view card printable-document"
      style={{
        width: '100%',
        minWidth: 0,
        position: 'relative',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-main, #0f172a)',
        padding: 0,
        overflow: 'visible',
        borderRadius: '16px',
        border: '1px solid var(--border-glass)',
        boxShadow: 'none'
      }}
    >
        {/* ENCABEZADO */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-glass)',
          background: 'var(--bg-card-header)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(0,43,122,0.15), rgba(2,132,199,0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-blue)'
            }}>
              <Wallet size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Caja Chica & Tesorería Bancaria
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Control Bimonetario Supabase • Tasa BCV: {formatBs(tasaBcv)} • Tasa KEY: {formatBs(tasaKeystone)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <button
              onClick={handlePrint}
              className="btn btn-print-report"
              title="Descargar Reporte Oficial de Caja y Bancos en PDF"
            >
              <Printer size={16} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
          </div>
        </div>

        {/* RESUMEN KPIS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          padding: '1.25rem 1.75rem',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-glass)'
        }}>
          {/* Card Efectivo en Cajas */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {cajaScopeFilter === 'FISCAL'
                  ? 'Efectivo en Cajas (Solo Fiscal)'
                  : cajaScopeFilter === 'NO_FISCAL'
                    ? 'Efectivo en Cajas (Solo No Fiscal)'
                    : 'Efectivo en Cajas (Fiscal + No Fiscal)'}
              </span>
              <Wallet size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatUsd(
                cajaScopeFilter === 'FISCAL'
                  ? cashFiscalTotals.fiscalUsd
                  : cajaScopeFilter === 'NO_FISCAL'
                    ? cashFiscalTotals.noFiscalUsd
                    : totalCajasUsd
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(
                cajaScopeFilter === 'FISCAL'
                  ? cashFiscalTotals.fiscalBs
                  : cajaScopeFilter === 'NO_FISCAL'
                    ? cashFiscalTotals.noFiscalBs
                    : totalCajasBs
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.45rem', fontSize: '0.73rem', fontFamily: 'var(--font-code)' }}>
              <span style={{ padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.14)', color: '#c084fc', fontWeight: 700 }}>
                Fiscal: {formatUsd(cashFiscalTotals.fiscalUsd)}
              </span>
              <span style={{ padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b', fontWeight: 700 }}>
                No Fiscal: {formatUsd(cashFiscalTotals.noFiscalUsd)}
              </span>
            </div>
          </div>

          {/* Card Bancos Profit */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #0284c7'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Disponibilidad Bancaria ({bankAccounts?.length || 0} Cuentas)
              </span>
              <Landmark size={16} style={{ color: '#0284c7' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatUsd(totalBancosUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(totalBancosBs)}
            </div>
          </div>

          {/* Card Total Consolidado */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #8b5cf6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Liquidez Total Motorven
              </span>
              <DollarSign size={16} style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
              {formatUsd(totalConsolidadoUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(totalConsolidadoBs)}
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.75rem 0',
          borderBottom: '1px solid var(--border-glass)',
          background: 'var(--bg-card-glass)'
        }}>
          <button
            onClick={() => setActiveTab('cajas')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'cajas' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'cajas' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Wallet size={16} />
            Cajas Registradoras ({cashDesks?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('bancos')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'bancos' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'bancos' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Landmark size={16} />
            Cuentas Bancarias ({bankAccounts?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('arqueo')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'arqueo' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'arqueo' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Calculator size={16} />
            Arqueo & Conteo Físico
          </button>

          <button
            onClick={() => setActiveTab('movimientos')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'movimientos' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'movimientos' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ArrowRightLeft size={16} />
            Movimientos ({cashMovements?.length || 0})
          </button>

          <button
            type="button"
            onClick={handleOpenPartnerModal}
            style={{
              marginLeft: '0.5rem',
              marginBottom: '0.45rem',
              padding: '0.52rem 1rem',
              borderRadius: '10px',
              border: '1px solid #f59e0b',
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              color: '#92400e',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 1px 3px rgba(217, 119, 6, 0.14)'
            }}
            title="Crear, editar, guardar y eliminar Cuenta por Pagar Socio (Pasivo 2.02.01.001)"
          >
            <Users size={15} />
            Cuenta por Pagar Socio ({effectivePartnerAccounts.length})
          </button>
        </div>

        {/* CONTENIDO DE LA PESTAÑA */}
        <div style={{ width: '100%', minWidth: 0, padding: '1.5rem 1.75rem' }}>
          {/* 1. PESTAÑA: CAJAS REGISTRADORAS */}
          {activeTab === 'cajas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Catálogo oficial de Cajas Operativas (Efectivo $, Efectivo Bs, Zelle, USDT Binance, USDC Kontigo App) sincronizado con Supabase.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (showCajaForm && !editingCajaId) {
                        setShowCajaForm(false);
                      } else {
                        handleOpenCreateCaja();
                      }
                    }}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      border: 'none',
                      color: '#fff'
                    }}
                  >
                    <Plus size={16} />
                    <span>{showCajaForm && !editingCajaId ? 'Cancelar Nueva Caja' : 'Crear Nueva Caja'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewMovForm(!showNewMovForm);
                      if (!showNewMovForm) setShowCajaForm(false);
                    }}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    <PlusCircle size={16} />
                    <span>{showNewMovForm ? 'Cancelar Movimiento' : 'Nuevo Movimiento de Caja'}</span>
                  </button>
                </div>
              </div>

              {/* FORMULARIO PARA CREAR O EDITAR CAJA REGISTRADORA */}
              {showCajaForm && (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1.35rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow-card)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Wallet size={18} color="#10b981" />
                      {editingCajaId ? `Editar Caja Registradora (${cajaForm.coCaja})` : `Crear Nueva Caja Operativa (Correlativo Sugerido: ${cajaForm.coCaja})`}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCajaForm(false);
                        setEditingCajaId(null);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveCaja}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Código (Correlativo)
                        </label>
                        <input
                          type="text"
                          className="input-modern"
                          placeholder="Ej: CAJA-07"
                          value={cajaForm.coCaja}
                          onChange={(e) => setCajaForm(prev => ({ ...prev, coCaja: e.target.value.toUpperCase() }))}
                          style={{ width: '100%', fontFamily: 'var(--font-code)', fontWeight: 700 }}
                          required
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Nombre de la Caja
                        </label>
                        <input
                          type="text"
                          className="input-modern"
                          placeholder="Ej: Caja Efectivo $ (Valencia), Caja Zelle, Caja USDT (Binance)..."
                          value={cajaForm.descripcion}
                          onChange={(e) => setCajaForm(prev => ({ ...prev, descripcion: e.target.value }))}
                          style={{ width: '100%' }}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Moneda
                        </label>
                        <select
                          className="filter-select"
                          value={cajaForm.moneda}
                          onChange={(e) => setCajaForm(prev => ({ ...prev, moneda: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value="USD">$ — Dólares (USD)</option>
                          <option value="BS">Bs. — Bolívares (VES)</option>
                          <option value="USDT">USDT — Binance / Cripto</option>
                          <option value="USDC">USDC — Kontigo App / Digital</option>
                          <option value="USD/BS">USD / Bs. — Bimonetaria</option>
                          <option value="EUR">€ — Euros (EUR)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Responsable
                        </label>
                        <input
                          type="text"
                          list="caja-responsables-list"
                          className="input-modern"
                          placeholder="Ej: Administración, Gerencia..."
                          value={cajaForm.responsable}
                          onChange={(e) => setCajaForm(prev => ({ ...prev, responsable: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                        <datalist id="caja-responsables-list">
                          <option value="Administración" />
                          <option value="Gerencia" />
                          <option value="Cajero Principal" />
                          <option value="Tesorería" />
                        </datalist>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Estado
                        </label>
                        <select
                          className="filter-select"
                          value={cajaForm.activa ? 'ACTIVA' : 'INACTIVA'}
                          onChange={(e) => setCajaForm(prev => ({ ...prev, activa: e.target.value === 'ACTIVA' }))}
                          style={{ width: '100%' }}
                        >
                          <option value="ACTIVA">● Activa</option>
                          <option value="INACTIVA">○ Inactiva</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#c084fc', marginBottom: '0.35rem' }}>
                          Saldo Fiscal ({cajaForm.moneda === 'BS' ? 'Bs.' : 'USD $'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-modern"
                          placeholder="0.00"
                          value={cajaForm.moneda === 'BS' ? cajaForm.saldoFiscalBs : cajaForm.saldoFiscalUsd}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = parseFloat(raw) || 0;
                            setCajaForm(prev => {
                              if (prev.moneda === 'BS') {
                                const nfBs = parseFloat(prev.saldoNoFiscalBs) || 0;
                                const fUsd = tasaBcv > 0 ? round2(num / tasaBcv) : 0;
                                const nfUsd = parseFloat(prev.saldoNoFiscalUsd) || 0;
                                return {
                                  ...prev,
                                  saldoFiscalBs: raw,
                                  saldoFiscalUsd: String(fUsd),
                                  saldoBs: String(round2(num + nfBs)),
                                  saldoUsd: String(round2(fUsd + nfUsd))
                                };
                              }
                              const nfUsd = parseFloat(prev.saldoNoFiscalUsd) || 0;
                              const fBs = tasaBcv > 0 ? round2(num * tasaBcv) : 0;
                              const nfBs = parseFloat(prev.saldoNoFiscalBs) || 0;
                              return {
                                ...prev,
                                saldoFiscalUsd: raw,
                                saldoFiscalBs: String(fBs),
                                saldoUsd: String(round2(num + nfUsd)),
                                saldoBs: String(round2(fBs + nfBs))
                              };
                            });
                          }}
                          style={{ width: '100%', fontFamily: 'var(--font-code)' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.35rem' }}>
                          Saldo No Fiscal ({cajaForm.moneda === 'BS' ? 'Bs.' : 'USD $'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-modern"
                          placeholder="0.00"
                          value={cajaForm.moneda === 'BS' ? cajaForm.saldoNoFiscalBs : cajaForm.saldoNoFiscalUsd}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = parseFloat(raw) || 0;
                            setCajaForm(prev => {
                              if (prev.moneda === 'BS') {
                                const fBs = parseFloat(prev.saldoFiscalBs) || 0;
                                const nfUsd = tasaBcv > 0 ? round2(num / tasaBcv) : 0;
                                const fUsd = parseFloat(prev.saldoFiscalUsd) || 0;
                                return {
                                  ...prev,
                                  saldoNoFiscalBs: raw,
                                  saldoNoFiscalUsd: String(nfUsd),
                                  saldoBs: String(round2(fBs + num)),
                                  saldoUsd: String(round2(fUsd + nfUsd))
                                };
                              }
                              const fUsd = parseFloat(prev.saldoFiscalUsd) || 0;
                              const nfBs = tasaBcv > 0 ? round2(num * tasaBcv) : 0;
                              const fBs = parseFloat(prev.saldoFiscalBs) || 0;
                              return {
                                ...prev,
                                saldoNoFiscalUsd: raw,
                                saldoNoFiscalBs: String(nfBs),
                                saldoUsd: String(round2(fUsd + num)),
                                saldoBs: String(round2(fBs + nfBs))
                              };
                            });
                          }}
                          style={{ width: '100%', fontFamily: 'var(--font-code)' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#10b981', marginBottom: '0.35rem' }}>
                          Total Consolidado (Fiscal + No Fiscal)
                        </label>
                        <div className="input-modern" style={{ width: '100%', fontFamily: 'var(--font-code)', fontWeight: 800, color: '#10b981' }}>
                          {cajaForm.moneda === 'BS'
                            ? `${formatBs(cajaForm.saldoBs)} (${formatUsd(cajaForm.saldoUsd)})`
                            : `${formatUsd(cajaForm.saldoUsd)} (${formatBs(cajaForm.saldoBs)})`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCajaForm(false);
                          setEditingCajaId(null);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary"
                        style={{
                          padding: '0.5rem 1.35rem',
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          border: 'none',
                          color: '#fff'
                        }}
                      >
                        {isSubmitting ? 'Guardando...' : (editingCajaId ? 'Guardar Cambios de Caja' : 'Crear Caja Registradora')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* FORMULARIO DE NUEVO MOVIMIENTO */}
              {showNewMovForm && (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)',
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow-card)'
                }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Registrar Entrada, Salida o Transferencia Interna de Tesorería
                  </h4>
                  <form onSubmit={handleSaveMovement}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Tipo de Operación
                        </label>
                        <select
                          className="filter-select"
                          value={movType}
                          onChange={(e) => setMovType(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="EGRESO">Egreso / Gasto Operativo</option>
                          <option value="INGRESO">Ingreso / Depósito Efectivo</option>
                          <option value="TRANSFERENCIA">Transferencia Interna (Caja ↔ Banco)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          {movType === 'TRANSFERENCIA' ? 'Origen (Tipo)' : 'Tipo de Cuenta'}
                        </label>
                        <select
                          className="filter-select"
                          value={movAccountKind}
                          onChange={(e) => {
                            setMovAccountKind(e.target.value);
                            setSelectedDeskId('');
                            setSelectedBankId('');
                          }}
                          style={{ width: '100%' }}
                        >
                          <option value="CAJA">Caja Operativa</option>
                          <option value="BANCO">Cuenta Bancaria</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          {movType === 'TRANSFERENCIA'
                            ? (movAccountKind === 'CAJA' ? 'Caja Origen *' : 'Banco Origen *')
                            : (movAccountKind === 'CAJA' ? 'Caja Afectada' : 'Cuenta Bancaria *')}
                        </label>
                        {movAccountKind === 'CAJA' ? (
                          <select
                            className="filter-select"
                            value={selectedDeskId}
                            onChange={(e) => setSelectedDeskId(e.target.value)}
                            style={{ width: '100%' }}
                            required={movType === 'TRANSFERENCIA'}
                          >
                            <option value="">{movType === 'TRANSFERENCIA' ? '-- Seleccionar Caja --' : 'Caja General (Solo Registro)'}</option>
                            {cashDesks.map(d => (
                              <option key={d.id || d.coCaja} value={d.id || d.coCaja}>
                                {d.coCaja || d.co_caja} - {d.descripcion} ({d.moneda === 'BS' ? formatBs(d.saldoBs ?? d.saldo_bs ?? 0) : formatUsd(d.saldoUsd ?? d.saldo_usd ?? 0)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            className="filter-select"
                            value={selectedBankId}
                            onChange={(e) => setSelectedBankId(e.target.value)}
                            style={{ width: '100%' }}
                            required
                          >
                            <option value="">-- Seleccionar Cuenta Bancaria --</option>
                            {bankAccounts.map(b => (
                              <option key={b.id || b.codCta} value={b.id || b.codCta}>
                                {b.codCta || b.cod_cta} - {b.bancoNombre || b.banco_nombre} ({formatBs(b.saldoBs ?? b.saldo_bs ?? 0)})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {movAccountKind === 'CAJA' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Sub-caja / Naturaleza
                          </label>
                          <select
                            className="filter-select"
                            value={movFiscalScope}
                            onChange={(e) => setMovFiscalScope(e.target.value)}
                            style={{ width: '100%', fontWeight: 700 }}
                          >
                            <option value="NO_FISCAL">No Fiscal (Notas de Entrega / Interno)</option>
                            <option value="FISCAL">Fiscal (Facturas / SENIAT)</option>
                          </select>
                        </div>
                      )}

                      {movType === 'TRANSFERENCIA' && (
                        <>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              Destino (Tipo)
                            </label>
                            <select
                              className="filter-select"
                              value={movTransferDestKind}
                              onChange={(e) => {
                                setMovTransferDestKind(e.target.value);
                                setMovTransferDestId('');
                              }}
                              style={{ width: '100%' }}
                            >
                              <option value="BANCO">Cuenta Bancaria</option>
                              <option value="CAJA">Caja Operativa</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              {movTransferDestKind === 'CAJA' ? 'Caja Destino *' : 'Banco Destino *'}
                            </label>
                            <select
                              className="filter-select"
                              value={movTransferDestId}
                              onChange={(e) => setMovTransferDestId(e.target.value)}
                              style={{ width: '100%' }}
                              required
                            >
                              <option value="">-- Seleccionar Destino --</option>
                              {(movTransferDestKind === 'CAJA' ? cashDesks : bankAccounts).map(acc => {
                                const accId = acc.id || acc.coCaja || acc.codCta;
                                const accLabel = movTransferDestKind === 'CAJA'
                                  ? `${acc.coCaja || acc.co_caja} - ${acc.descripcion}`
                                  : `${acc.codCta || acc.cod_cta} - ${acc.bancoNombre || acc.banco_nombre}`;
                                return (
                                  <option key={accId} value={accId}>{accLabel}</option>
                                );
                              })}
                            </select>
                          </div>
                        </>
                      )}

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Método de Pago / Canal
                        </label>
                        <select
                          className="filter-select"
                          value={movMetodo}
                          onChange={(e) => setMovMetodo(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="EFECTIVO_USD">Efectivo Divisas ($)</option>
                          <option value="EFECTIVO_BS">Efectivo Bolívares (Bs.)</option>
                          <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                          <option value="PAGO_MOVIL">Pago Móvil</option>
                          <option value="ZELLE">Zelle USD</option>
                          <option value="USDT">Binance USDT</option>
                          <option value="USDC">Kontigo USDC</option>
                          <option value="PUNTO_DE_VENTA">Punto de Venta</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Monto USD
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="input-modern"
                          value={movMontoUsd}
                          onChange={(e) => {
                            const rawVal = e.target.value;
                            setMovMontoUsd(rawVal);
                            const val = parseFloat(rawVal);
                            if (rawVal === '' || isNaN(val) || val <= 0) {
                              setMovMontoBs('');
                            } else {
                              setMovMontoBs((val * tasaBcv).toFixed(2));
                            }
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Monto Bs (BCV: {formatBs(tasaBcv)})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="input-modern"
                          value={movMontoBs}
                          onChange={(e) => {
                            const rawVal = e.target.value;
                            setMovMontoBs(rawVal);
                            const valBs = parseFloat(rawVal);
                            if (rawVal === '' || isNaN(valBs) || valBs <= 0) {
                              setMovMontoUsd('');
                            } else if (tasaBcv > 0) {
                              setMovMontoUsd((valBs / tasaBcv).toFixed(2));
                            }
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    {movType !== 'TRANSFERENCIA' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Categoría P&L
                          </label>
                          <select
                            className="filter-select"
                            value={movCategoria}
                            onChange={(e) => setMovCategoria(e.target.value)}
                            style={{ width: '100%' }}
                          >
                            {movType === 'INGRESO' ? (
                              <>
                                <option value="DEPOSITO_MANUAL">Reposición / Aporte</option>
                                <option value="VENTAS">Ventas / Ingreso Operativo</option>
                                <option value="COBRO_CXC">Cobro CxC</option>
                              </>
                            ) : (
                              expenseAccountOptions.standardCategories.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))
                            )}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Cuenta Profit Plus
                          </label>
                          <select
                            className="filter-select"
                            value={movCuentaGasto}
                            onChange={(e) => {
                              const code = e.target.value;
                              setMovCuentaGasto(code);
                              const acc = expenseAccountOptions.profitAccounts.find((a) => a.code === code);
                              if (acc && movType === 'EGRESO' && ['NOMINA', 'COMISIONES', 'FLETES', 'IMPUESTOS'].includes(acc.pnlBucket)) {
                                setMovCategoria(acc.pnlBucket);
                              }
                            }}
                            style={{ width: '100%' }}
                          >
                            <option value="">-- Sin cuenta contable Profit --</option>
                            {expenseAccountOptions.profitAccounts.map((acc) => (
                              <option key={acc.id} value={acc.code}>{acc.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        Concepto / Motivo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Pago de suministros, Viáticos, Anticipo o Reposición de Caja Chica..."
                        className="input-modern"
                        value={movConcept}
                        onChange={(e) => setMovConcept(e.target.value)}
                        style={{ width: '100%' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowNewMovForm(false)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1.25rem' }}
                      >
                        {isSubmitting ? 'Guardando...' : 'Confirmar Registro'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* BARRA DE FILTRO FISCAL / NO FISCAL DE CAJAS */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '0.85rem',
                padding: '0.7rem 1rem',
                borderRadius: '10px',
                background: 'var(--bg-card-glass)',
                border: '1px solid var(--border-glass)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    División de Cajas:
                  </span>
                  <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)', gap: '4px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'ALL', label: `Consolidado F + NF (${cashDesks.length})`, color: '#10b981' },
                      { id: 'FISCAL', label: `Solo Fiscal (${formatUsd(cashFiscalTotals.fiscalUsd)})`, color: '#a855f7' },
                      { id: 'NO_FISCAL', label: `Solo No Fiscal (${formatUsd(cashFiscalTotals.noFiscalUsd)})`, color: '#f59e0b' }
                    ].map((opt) => {
                      const isActive = cajaScopeFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCajaScopeFilter(opt.id);
                            setCajaMovDocFilter(opt.id === 'ALL' ? 'ALL' : opt.id);
                          }}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: isActive ? `1px solid ${opt.color}` : '1px solid transparent',
                            background: isActive ? 'rgba(15, 23, 42, 0.75)' : 'transparent',
                            color: isActive ? opt.color : 'var(--text-muted)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {cajaScopeFilter === 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsedCajas.size >= cashDesks.length) {
                        setCollapsedCajas(new Set());
                      } else {
                        setCollapsedCajas(new Set(cashDesks.map((d, i) => String(d.coCaja || d.co_caja || d.id || `CAJA-0${i + 1}`).toUpperCase())));
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem' }}
                  >
                    {collapsedCajas.size >= cashDesks.length ? 'Expandir Sub-cajas' : 'Contraer Sub-cajas'}
                  </button>
                )}
              </div>

              {/* TABLA OFICIAL DE CAJAS OPERATIVAS DEL SISTEMA (PADRE = FISCAL + NO FISCAL) */}
              <div style={{
                overflowX: 'auto',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
                marginBottom: '1.5rem',
                background: 'var(--bg-card-glass)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Código</th>
                      <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Nombre de la Caja / División</th>
                      <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Naturaleza</th>
                      <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Moneda</th>
                      <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Responsable</th>
                      <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Estado</th>
                      {(cajaScopeFilter === 'ALL' || cajaScopeFilter === 'FISCAL') && (
                        <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: '#c084fc', textAlign: 'right' }}>Saldo Fiscal</th>
                      )}
                      {(cajaScopeFilter === 'ALL' || cajaScopeFilter === 'NO_FISCAL') && (
                        <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: '#f59e0b', textAlign: 'right' }}>Saldo No Fiscal</th>
                      )}
                      {cajaScopeFilter === 'ALL' && (
                        <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: '#10b981', textAlign: 'right' }}>Total Consolidado</th>
                      )}
                      <th style={{ padding: '0.8rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashDesks.map((desk, idx) => {
                      const code = String(desk.coCaja || desk.co_caja || `CAJA-0${idx + 1}`).toUpperCase();
                      const isActiva = desk.activa !== false;
                      const monedaDisplay = desk.moneda === 'BS' ? 'Bs.' : (desk.moneda === 'USD' ? '$ (USD)' : desk.moneda);
                      const bd = cashFiscalTotals.byDeskKey.get(code) || computeCashDeskFiscalBreakdown(
                        desk,
                        cashMovements,
                        cashDesks,
                        bankAccounts,
                        { tasaDolar: tasaBcv, tasaKeystone },
                        fiscalSplitOverrides
                      );
                      const isBsDesk = String(desk.moneda || '').toUpperCase() === 'BS';
                      const fmtPrimary = (usd, bs) => (isBsDesk ? formatBs(bs) : formatUsd(usd));
                      const fmtSecondary = (usd, bs) => (isBsDesk ? formatUsd(usd) : formatBs(bs));
                      const isExpanded = !collapsedCajas.has(code);

                      const jumpToSubMovs = (docScope) => {
                        const key = String(desk.id || desk.coCaja || '').trim();
                        setCajaMovFilterId(key || 'ALL');
                        setCajaMovDocFilter(docScope);
                        setTimeout(() => cajaMovSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
                      };

                      const openNewSubMov = (docScope) => {
                        setMovAccountKind('CAJA');
                        setSelectedDeskId(desk.id || desk.coCaja);
                        setMovFiscalScope(docScope === 'FISCAL' ? 'FISCAL' : 'NO_FISCAL');
                        setShowNewMovForm(true);
                        setShowCajaForm(false);
                      };

                      if (cajaScopeFilter === 'FISCAL' || cajaScopeFilter === 'NO_FISCAL') {
                        const isF = cajaScopeFilter === 'FISCAL';
                        const subCode = isF ? `${code}-F` : `${code}-NF`;
                        const subUsd = isF ? bd.fiscalUsd : bd.noFiscalUsd;
                        const subBs = isF ? bd.fiscalBs : bd.noFiscalBs;
                        const movCount = isF ? bd.fiscalMovCount : bd.noFiscalMovCount;
                        return (
                          <tr
                            key={subCode}
                            style={{
                              borderBottom: '1px solid var(--border-glass)',
                              background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)'
                            }}
                          >
                            <td style={{ padding: '0.75rem 0.9rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: isF ? '#c084fc' : '#f59e0b' }}>
                              {subCode}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {desk.descripcion} — <span style={{ color: isF ? '#c084fc' : '#f59e0b' }}>{isF ? 'Fiscal' : 'No Fiscal'}</span>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                {movCount} movimiento(s) · Caja padre: {code}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: isF ? 'rgba(168, 85, 247, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                                color: isF ? '#c084fc' : '#f59e0b',
                                border: `1px solid ${isF ? 'rgba(168, 85, 247, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                              }}>
                                {isF ? 'Sub-caja Fiscal' : 'Sub-caja No Fiscal'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center', fontWeight: 700 }}>
                              <span style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.76rem',
                                background: desk.moneda === 'BS' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(2, 132, 199, 0.14)',
                                color: desk.moneda === 'BS' ? '#d97706' : 'var(--brand-blue)'
                              }}>
                                {monedaDisplay}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {desk.responsable || 'Administración'}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                background: isActiva ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                                color: isActiva ? '#059669' : 'var(--text-muted)',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}>
                                ● {isActiva ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                              <div style={{ fontWeight: 700, color: isF ? '#c084fc' : '#f59e0b' }}>
                                {fmtPrimary(subUsd, subBs)}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {fmtSecondary(subUsd, subBs)}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  onClick={() => jumpToSubMovs(isF ? 'FISCAL' : 'NO_FISCAL')}
                                  className="btn"
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    background: 'rgba(56, 189, 248, 0.14)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.35)'
                                  }}
                                  title={`Ver movimientos ${isF ? 'Fiscales' : 'No Fiscales'} de ${code}`}
                                >
                                  <List size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openNewSubMov(isF ? 'FISCAL' : 'NO_FISCAL')}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', borderRadius: '6px' }}
                                  title={`Registrar movimiento ${isF ? 'Fiscal' : 'No Fiscal'} en ${code}`}
                                >
                                  <PlusCircle size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCaja(desk)}
                                  className="btn"
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    background: 'rgba(217, 119, 6, 0.15)',
                                    color: '#d97706',
                                    border: '1px solid rgba(217, 119, 6, 0.3)'
                                  }}
                                  title="Editar distribución Fiscal / No Fiscal de la caja"
                                >
                                  <Edit2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <React.Fragment key={desk.id || code}>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border-glass)',
                              background: 'var(--bg-card-glass)',
                              fontWeight: 600
                            }}
                          >
                            <td
                              onClick={() => {
                                setCollapsedCajas((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(code)) next.delete(code);
                                  else next.add(code);
                                  return next;
                                });
                              }}
                              style={{ padding: '0.75rem 0.9rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--brand-blue)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              title="Clic para expandir o contraer Fiscal / No Fiscal"
                            >
                              <span style={{ display: 'inline-block', width: '14px', color: 'var(--text-muted)' }}>
                                {isExpanded ? '▾' : '▸'}
                              </span>
                              {code}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {desk.descripcion}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '20px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.32)'
                              }}>
                                Consolidada (F + NF)
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center', fontWeight: 700 }}>
                              <span style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.76rem',
                                background: desk.moneda === 'BS' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(2, 132, 199, 0.14)',
                                color: desk.moneda === 'BS' ? '#d97706' : 'var(--brand-blue)'
                              }}>
                                {monedaDisplay}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {desk.responsable || 'Administración'}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                background: isActiva ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                                color: isActiva ? '#059669' : 'var(--text-muted)',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}>
                                ● {isActiva ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#c084fc', fontWeight: 700 }}>
                              {fmtPrimary(bd.fiscalUsd, bd.fiscalBs)}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#f59e0b', fontWeight: 700 }}>
                              {fmtPrimary(bd.noFiscalUsd, bd.noFiscalBs)}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                              <div style={{ fontWeight: 800, color: '#10b981' }}>
                                {fmtPrimary(bd.totalUsd, bd.totalBs)}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {fmtSecondary(bd.totalUsd, bd.totalBs)}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  onClick={() => jumpToSubMovs('ALL')}
                                  className="btn"
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    background: 'rgba(56, 189, 248, 0.14)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Ver todos los movimientos de esta caja"
                                >
                                  <List size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openNewSubMov('NO_FISCAL')}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', borderRadius: '6px' }}
                                  title="Registrar ingreso o egreso en esta caja"
                                >
                                  <PlusCircle size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCaja(desk)}
                                  className="btn"
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    background: 'rgba(217, 119, 6, 0.15)',
                                    color: '#d97706',
                                    border: '1px solid rgba(217, 119, 6, 0.3)'
                                  }}
                                  title="Editar datos o reparto Fiscal / No Fiscal"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCaja(desk)}
                                  className="btn"
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.25)'
                                  }}
                                  title="Eliminar caja"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <>
                              {/* Sub-fila Fiscal */}
                              <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-surface)', fontSize: '0.8rem' }}>
                                <td style={{ padding: '0.5rem 0.9rem 0.5rem 1.85rem', fontFamily: 'var(--font-code)', color: '#c084fc', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  └─ {code}-F
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-secondary)' }}>
                                  {desk.descripcion} — <strong style={{ color: '#c084fc' }}>Fiscal</strong>
                                  <span style={{ marginLeft: '0.45rem', fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                                    ({bd.fiscalMovCount} mov.)
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '0.14rem 0.5rem',
                                    borderRadius: '20px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    background: 'rgba(168, 85, 247, 0.12)',
                                    color: '#c084fc',
                                    border: '1px solid rgba(168, 85, 247, 0.3)'
                                  }}>
                                    Sub-caja Fiscal
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{monedaDisplay}</td>
                                <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.76rem' }}>{desk.responsable || 'Administración'}</td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, color: '#c084fc' }}>
                                  {fmtPrimary(bd.fiscalUsd, bd.fiscalBs)}
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>—</td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>
                                  {fmtPrimary(bd.fiscalUsd, bd.fiscalBs)}
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => jumpToSubMovs('FISCAL')}
                                      className="btn"
                                      style={{ padding: '0.22rem 0.48rem', fontSize: '0.71rem', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.14)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}
                                      title={`Ver movimientos Fiscales de ${code}`}
                                    >
                                      <List size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openNewSubMov('FISCAL')}
                                      className="btn"
                                      style={{ padding: '0.22rem 0.48rem', fontSize: '0.71rem', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.14)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}
                                      title={`Registrar movimiento Fiscal en ${code}`}
                                    >
                                      <PlusCircle size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Sub-fila No Fiscal */}
                              <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-surface)', fontSize: '0.8rem' }}>
                                <td style={{ padding: '0.5rem 0.9rem 0.5rem 1.85rem', fontFamily: 'var(--font-code)', color: '#f59e0b', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  └─ {code}-NF
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-secondary)' }}>
                                  {desk.descripcion} — <strong style={{ color: '#f59e0b' }}>No Fiscal</strong>
                                  <span style={{ marginLeft: '0.45rem', fontSize: '0.71rem', color: 'var(--text-muted)' }}>
                                    ({bd.noFiscalMovCount} mov.)
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '0.14rem 0.5rem',
                                    borderRadius: '20px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.3)'
                                  }}>
                                    Sub-caja No Fiscal
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{monedaDisplay}</td>
                                <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.76rem' }}>{desk.responsable || 'Administración'}</td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>—</td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, color: '#f59e0b' }}>
                                  {fmtPrimary(bd.noFiscalUsd, bd.noFiscalBs)}
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>
                                  {fmtPrimary(bd.noFiscalUsd, bd.noFiscalBs)}
                                </td>
                                <td style={{ padding: '0.5rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => jumpToSubMovs('NO_FISCAL')}
                                      className="btn"
                                      style={{ padding: '0.22rem 0.48rem', fontSize: '0.71rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                                      title={`Ver movimientos No Fiscales de ${code}`}
                                    >
                                      <List size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openNewSubMov('NO_FISCAL')}
                                      className="btn"
                                      style={{ padding: '0.22rem 0.48rem', fontSize: '0.71rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                                      title={`Registrar movimiento No Fiscal en ${code}`}
                                    >
                                      <PlusCircle size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-table-header)', borderTop: '2px solid var(--border-glass)', fontWeight: 800 }}>
                      <td colSpan={6} style={{ padding: '0.8rem 0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                        {cajaScopeFilter === 'FISCAL'
                          ? 'Total Cajas Fiscales'
                          : cajaScopeFilter === 'NO_FISCAL'
                            ? 'Total Cajas No Fiscales'
                            : 'Sumatoria Total Cajas (Fiscal + No Fiscal)'}
                      </td>
                      {(cajaScopeFilter === 'ALL' || cajaScopeFilter === 'FISCAL') && (
                        <td style={{ padding: '0.8rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#c084fc' }}>
                          <div>{formatUsd(cashFiscalTotals.fiscalUsd)}</div>
                          <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatBs(cashFiscalTotals.fiscalBs)}</div>
                        </td>
                      )}
                      {(cajaScopeFilter === 'ALL' || cajaScopeFilter === 'NO_FISCAL') && (
                        <td style={{ padding: '0.8rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#f59e0b' }}>
                          <div>{formatUsd(cashFiscalTotals.noFiscalUsd)}</div>
                          <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatBs(cashFiscalTotals.noFiscalBs)}</div>
                        </td>
                      )}
                      {cajaScopeFilter === 'ALL' && (
                        <td style={{ padding: '0.8rem 0.9rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#10b981' }}>
                          <div>{formatUsd(cashFiscalTotals.totalUsd)}</div>
                          <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatBs(cashFiscalTotals.totalBs)}</div>
                        </td>
                      )}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {renderScopedMovementsListView({
                scopeKind: 'CAJA',
                accountsList: cashDesks,
                selectedAccountKey: cajaMovFilterId,
                onSelectAccountKey: setCajaMovFilterId,
                typeFilter: cajaMovTypeFilter,
                onChangeTypeFilter: setCajaMovTypeFilter,
                docFilter: cajaMovDocFilter,
                onChangeDocFilter: setCajaMovDocFilter,
                periodFilter: cajaPeriodFilter,
                onChangePeriodFilter: setCajaPeriodFilter,
                sectionRef: cajaMovSectionRef
              })}
            </div>
          )}

          {/* 2. PESTAÑA: CUENTAS BANCARIAS */}
          {activeTab === 'bancos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-wrapper" style={{ flex: '1 1 320px' }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por institución bancaria, cuenta a nombre de, número de cuenta o código..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    className="input-modern"
                    style={{ width: '100%', paddingLeft: '2.4rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Total Cuentas: <strong>{filteredBankAccounts.length}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (showBankForm && !editingBankId) {
                        setShowBankForm(false);
                      } else {
                        handleOpenCreateBank();
                      }
                    }}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1.1rem',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 600
                    }}
                  >
                    <Plus size={16} />
                    <span>{showBankForm && !editingBankId ? 'Cancelar Creación' : 'Crear Cuenta Bancaria'}</span>
                  </button>
                </div>
              </div>

              {/* FORMULARIO PARA CREAR / EDITAR / GUARDAR CUENTA BANCARIA */}
              {showBankForm && (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1.35rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(2, 132, 199, 0.45)',
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow-card)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Landmark size={18} color="#0284c7" />
                      <span>
                        {editingBankId
                          ? `Editar Cuenta Bancaria (Cód: ${bankForm.codCta})`
                          : `Crear Nueva Cuenta Bancaria (Correlativo Sugerido: ${bankForm.codCta})`}
                      </span>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: 'rgba(2, 132, 199, 0.16)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.35)'
                      }}>
                        Tasa BCV: {formatBs(tasaBcv)}
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBankForm(false);
                        setEditingBankId(null);
                        setInlineBankEditId(null);
                        setInlineBankDraft(null);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveBankForm}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Código (Cód)
                        </label>
                        <input
                          type="text"
                          className="input-modern"
                          placeholder="Ej: 11"
                          value={bankForm.codCta}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setBankForm(prev => ({ ...prev, codCta: val }));
                            setInlineBankDraft(prev => (prev ? { ...prev, codCta: val } : prev));
                          }}
                          style={{ width: '100%', fontFamily: 'var(--font-code)', fontWeight: 700 }}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Institución Bancaria
                        </label>
                        <input
                          type="text"
                          list="bancos-venezuela-list"
                          className="input-modern"
                          placeholder="Ej: BANCO MERCANTIL, C.A."
                          value={bankForm.bancoNombre}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setBankForm(prev => ({ ...prev, bancoNombre: val }));
                            setInlineBankDraft(prev => (prev ? { ...prev, bancoNombre: val } : prev));
                          }}
                          style={{ width: '100%', fontWeight: 600 }}
                          required
                        />
                        <datalist id="bancos-venezuela-list">
                          <option value="BANCO NACIONAL DE CREDITO" />
                          <option value="BANCO MERCANTIL, C.A." />
                          <option value="BANESCO BANCO UNIVERSAL" />
                          <option value="BANCO PROVINCIAL, S.A. BANCO UNIVERSAL" />
                          <option value="BANCAMIGA BANCO UNIVERSAL" />
                          <option value="BANCO DEL CARIBE" />
                          <option value="BANCO DE VENEZUELA" />
                          <option value="BANPLUS BANCO UNIVERSAL" />
                          <option value="BANCO EXTERIOR" />
                          <option value="BANCARIBE" />
                        </datalist>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Cuenta a Nombre de:
                        </label>
                        <input
                          type="text"
                          list="titulares-motorven-list"
                          className="input-modern"
                          placeholder="Ej: GRUPO MOTORVEN, C.A."
                          value={bankForm.cuentaANombreDe}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBankForm(prev => ({ ...prev, cuentaANombreDe: val }));
                            setInlineBankDraft(prev => (prev ? { ...prev, cuentaANombreDe: val } : prev));
                          }}
                          style={{ width: '100%', fontWeight: 600 }}
                          required
                        />
                        <datalist id="titulares-motorven-list">
                          <option value="GRUPO MOTORVEN, C.A." />
                          <option value="MOTORVEN, C.A." />
                          <option value="ADMINISTRACIÓN MOTORVEN" />
                          <option value="GERENCIA GENERAL" />
                        </datalist>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Número de Cuenta
                        </label>
                        <input
                          type="text"
                          className="input-modern"
                          placeholder="Ej: 01050000000000000000"
                          value={bankForm.numCta}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBankForm(prev => ({ ...prev, numCta: val }));
                            setInlineBankDraft(prev => (prev ? { ...prev, numCta: val } : prev));
                          }}
                          style={{ width: '100%', fontFamily: 'monospace' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Moneda
                        </label>
                        <select
                          className="filter-select"
                          value={bankForm.moneda}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBankForm(prev => ({ ...prev, moneda: val }));
                            setInlineBankDraft(prev => (prev ? { ...prev, moneda: val } : prev));
                          }}
                          style={{ width: '100%' }}
                        >
                          <option value="BS">BS — Bolívares</option>
                          <option value="USD">USD — Dólares ($)</option>
                          <option value="EUR">EUR — Euros (€)</option>
                          <option value="USDT">USDT — Digital</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Saldo en Bs
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-modern"
                          placeholder="0.00"
                          value={bankForm.saldoBs}
                          onChange={(e) => {
                            const valBs = e.target.value;
                            const numBs = parseFloat(valBs);
                            const calcUsd = (valBs === '' || valBs === '-' || isNaN(numBs))
                              ? ''
                              : (tasaBcv > 0 ? (numBs / tasaBcv).toFixed(2) : '0.00');
                            setBankForm(prev => ({
                              ...prev,
                              saldoBs: valBs,
                              saldoUsd: calcUsd
                            }));
                            setInlineBankDraft(prev => (prev ? {
                              ...prev,
                              saldoBs: valBs,
                              saldoUsd: calcUsd
                            } : prev));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Contravalor USD ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-modern"
                          placeholder="0.00"
                          value={bankForm.saldoUsd}
                          onChange={(e) => {
                            const valUsd = e.target.value;
                            const numUsd = parseFloat(valUsd);
                            const calcBs = (valUsd === '' || valUsd === '-' || isNaN(numUsd))
                              ? ''
                              : (tasaBcv > 0 ? (numUsd * tasaBcv).toFixed(2) : '0.00');
                            setBankForm(prev => ({
                              ...prev,
                              saldoUsd: valUsd,
                              saldoBs: calcBs
                            }));
                            setInlineBankDraft(prev => (prev ? {
                              ...prev,
                              saldoUsd: valUsd,
                              saldoBs: calcBs
                            } : prev));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBankForm(false);
                          setEditingBankId(null);
                          setInlineBankEditId(null);
                          setInlineBankDraft(null);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.5rem 1.35rem',
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 700
                        }}
                      >
                        <Save size={15} />
                        <span>{isSubmitting ? 'Guardando...' : 'Guardar Cuenta Bancaria'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Cód</th>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Institución Bancaria</th>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Cuenta a Nombre de:</th>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Número de Cuenta</th>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Moneda</th>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Saldo en Bs</th>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Contravalor USD</th>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBankAccounts.map((b, idx) => {
                      const code = b.codCta || b.cod_cta || String(idx + 1).padStart(2, '0');
                      const rowId = b.id || `CTA-${code}`;
                      const isEditingRow = inlineBankEditId === rowId && inlineBankDraft;
                      const valuation = computeBankAccountValuation(b, { tasaDolar: tasaBcv, tasaKeystone });
                      const saldoBs = valuation.bs;
                      const saldoUsd = valuation.usd;
                      const isNegative = saldoBs < 0;
                      const titularNombre = b.cuentaANombreDe || b.cuenta_a_nombre_de || b.titular || 'GRUPO MOTORVEN, C.A.';

                      return (
                        <tr 
                          key={rowId}
                          style={{
                            borderBottom: '1px solid var(--border-glass)',
                            background: isEditingRow
                              ? 'rgba(2, 132, 199, 0.08)'
                              : (idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)')
                          }}
                        >
                          <td style={{ padding: '0.8rem 0.9rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--brand-blue)' }}>
                            {isEditingRow ? (
                              <input
                                type="text"
                                className="input-modern"
                                value={inlineBankDraft.codCta}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setInlineBankDraft(prev => ({ ...prev, codCta: val }));
                                  if (editingBankId === rowId) setBankForm(prev => ({ ...prev, codCta: val }));
                                }}
                                style={{ width: '58px', padding: '0.3rem 0.45rem', fontSize: '0.82rem', fontWeight: 700 }}
                              />
                            ) : (
                              code
                            )}
                          </td>

                          <td style={{ padding: '0.8rem 0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isEditingRow ? (
                              <input
                                type="text"
                                className="input-modern"
                                value={inlineBankDraft.bancoNombre}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setInlineBankDraft(prev => ({ ...prev, bancoNombre: val }));
                                  if (editingBankId === rowId) setBankForm(prev => ({ ...prev, bancoNombre: val }));
                                }}
                                style={{ width: '100%', minWidth: '170px', padding: '0.3rem 0.5rem', fontSize: '0.82rem', fontWeight: 600 }}
                              />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Building2 size={16} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                                <span>{b.bancoNombre || b.banco_nombre}</span>
                              </div>
                            )}
                          </td>

                          {/* NUEVA COLUMNA AL LADO DERECHO DE INSTITUCIÓN BANCARIA: CUENTA A NOMBRE DE: */}
                          <td style={{ padding: '0.8rem 0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isEditingRow ? (
                              <input
                                type="text"
                                list="titulares-motorven-list"
                                className="input-modern"
                                value={inlineBankDraft.cuentaANombreDe}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInlineBankDraft(prev => ({ ...prev, cuentaANombreDe: val }));
                                  if (editingBankId === rowId) setBankForm(prev => ({ ...prev, cuentaANombreDe: val }));
                                }}
                                style={{ width: '100%', minWidth: '170px', padding: '0.3rem 0.5rem', fontSize: '0.82rem', fontWeight: 600 }}
                              />
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.22rem 0.6rem',
                                borderRadius: '6px',
                                background: 'rgba(15, 23, 42, 0.05)',
                                border: '1px solid var(--border-glass)',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                              }}>
                                {titularNombre}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '0.8rem 0.9rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input
                                type="text"
                                className="input-modern"
                                value={inlineBankDraft.numCta}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInlineBankDraft(prev => ({ ...prev, numCta: val }));
                                  if (editingBankId === rowId) setBankForm(prev => ({ ...prev, numCta: val }));
                                }}
                                style={{ width: '100%', minWidth: '165px', padding: '0.3rem 0.5rem', fontSize: '0.82rem', fontFamily: 'monospace' }}
                              />
                            ) : (
                              b.numCta || b.num_cta || 'N/A'
                            )}
                          </td>

                          <td style={{ padding: '0.8rem 0.9rem', textAlign: 'center' }}>
                            {isEditingRow ? (
                              <select
                                className="filter-select"
                                value={inlineBankDraft.moneda}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInlineBankDraft(prev => ({ ...prev, moneda: val }));
                                  if (editingBankId === rowId) setBankForm(prev => ({ ...prev, moneda: val }));
                                }}
                                style={{ padding: '0.28rem 0.45rem', fontSize: '0.8rem' }}
                              >
                                <option value="BS">BS</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="USDT">USDT</option>
                              </select>
                            ) : (
                              <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                background: 'rgba(0,43,122,0.08)',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}>
                                {b.moneda || 'BS'}
                              </span>
                            )}
                          </td>

                          <td style={{
                            padding: '0.8rem 0.9rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isNegative ? 'var(--brand-red)' : 'var(--text-primary)'
                          }}>
                            {isEditingRow ? (
                              <input
                                type="number"
                                step="0.01"
                                className="input-modern"
                                value={inlineBankDraft.saldoBs}
                                onChange={(e) => {
                                  const vBs = e.target.value;
                                  const nBs = parseFloat(vBs);
                                  const calcUsd = (vBs === '' || vBs === '-' || isNaN(nBs))
                                    ? ''
                                    : (tasaBcv > 0 ? (nBs / tasaBcv).toFixed(2) : '0.00');
                                  setInlineBankDraft(prev => ({
                                    ...prev,
                                    saldoBs: vBs,
                                    saldoUsd: calcUsd
                                  }));
                                  if (editingBankId === rowId) {
                                    setBankForm(prev => ({
                                      ...prev,
                                      saldoBs: vBs,
                                      saldoUsd: calcUsd
                                    }));
                                  }
                                }}
                                style={{ width: '125px', textAlign: 'right', padding: '0.3rem 0.45rem', fontSize: '0.82rem', fontWeight: 700 }}
                              />
                            ) : (
                              formatBs(saldoBs)
                            )}
                          </td>

                          <td style={{
                            padding: '0.8rem 0.9rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isNegative ? 'var(--brand-red)' : '#059669'
                          }}>
                            {isEditingRow ? (
                              <input
                                type="number"
                                step="0.01"
                                className="input-modern"
                                value={inlineBankDraft.saldoUsd}
                                onChange={(e) => {
                                  const vUsd = e.target.value;
                                  const nUsd = parseFloat(vUsd);
                                  const calcBs = (vUsd === '' || vUsd === '-' || isNaN(nUsd))
                                    ? ''
                                    : (tasaBcv > 0 ? (nUsd * tasaBcv).toFixed(2) : '0.00');
                                  setInlineBankDraft(prev => ({
                                    ...prev,
                                    saldoUsd: vUsd,
                                    saldoBs: calcBs
                                  }));
                                  if (editingBankId === rowId) {
                                    setBankForm(prev => ({
                                      ...prev,
                                      saldoUsd: vUsd,
                                      saldoBs: calcBs
                                    }));
                                  }
                                }}
                                style={{ width: '110px', textAlign: 'right', padding: '0.3rem 0.45rem', fontSize: '0.82rem', fontWeight: 700 }}
                              />
                            ) : (
                              formatUsd(saldoUsd)
                            )}
                          </td>

                          {/* COLUMNA DE ACCIONES: MOVIMIENTOS, CREAR, EDITAR, GUARDAR, ELIMINAR */}
                          <td style={{ padding: '0.8rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem' }}>
                              {/* Acción: Ver Movimientos */}
                              <button
                                type="button"
                                onClick={() => {
                                  const key = String(rowId || code || '').trim();
                                  setBankMovFilterId(key || 'ALL');
                                  setTimeout(() => bankMovSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
                                }}
                                className="btn"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.28rem',
                                  padding: '0.32rem 0.55rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  background: 'rgba(56, 189, 248, 0.14)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.35)'
                                }}
                                title="Ver ListView de entradas y salidas de esta cuenta bancaria"
                              >
                                <List size={12} />
                                <span>Movs</span>
                              </button>

                              {/* Acción: Editar */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditBank(b)}
                                className="btn"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.28rem',
                                  padding: '0.32rem 0.55rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  background: 'rgba(217, 119, 6, 0.14)',
                                  color: '#d97706',
                                  border: '1px solid rgba(217, 119, 6, 0.3)'
                                }}
                                title="Editar esta cuenta bancaria"
                              >
                                <Edit2 size={12} />
                                <span>Editar</span>
                              </button>

                              {/* Acción: Guardar */}
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => {
                                  if (isEditingRow && inlineBankDraft) {
                                    handleSaveBankRecord(inlineBankDraft, true);
                                  } else {
                                    handleSaveBankRecord({
                                      id: rowId,
                                      codCta: code,
                                      bancoNombre: b.bancoNombre || b.banco_nombre,
                                      cuentaANombreDe: titularNombre,
                                      numCta: b.numCta || b.num_cta,
                                      moneda: b.moneda || 'BS',
                                      saldoBs,
                                      saldoUsd
                                    }, true);
                                  }
                                }}
                                className="btn"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.28rem',
                                  padding: '0.32rem 0.55rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  background: isEditingRow ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(16, 185, 129, 0.14)',
                                  color: isEditingRow ? '#ffffff' : '#059669',
                                  border: '1px solid rgba(16, 185, 129, 0.35)'
                                }}
                                title="Guardar cambios de la cuenta bancaria"
                              >
                                <Save size={12} />
                                <span>Guardar</span>
                              </button>

                              {/* Acción: Eliminar (Doble Seguridad) */}
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteBank(b)}
                                className="btn"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.28rem',
                                  padding: '0.32rem 0.55rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.28)'
                                }}
                                title="Eliminar cuenta bancaria (Protegido con Doble Seguridad)"
                              >
                                <Trash2 size={12} />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {renderScopedMovementsListView({
                scopeKind: 'BANCO',
                accountsList: bankAccounts,
                selectedAccountKey: bankMovFilterId,
                onSelectAccountKey: setBankMovFilterId,
                typeFilter: bankMovTypeFilter,
                onChangeTypeFilter: setBankMovTypeFilter,
                docFilter: bankMovDocFilter,
                onChangeDocFilter: setBankMovDocFilter,
                periodFilter: bankPeriodFilter,
                onChangePeriodFilter: setBankPeriodFilter,
                sectionRef: bankMovSectionRef
              })}

              {/* MODAL DE DOBLE SEGURIDAD PARA ELIMINAR CUENTA BANCARIA */}
              {bankDeleteSecurityModal.isOpen && bankDeleteSecurityModal.bank && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(15, 23, 42, 0.72)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '520px',
                      background: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary, #0f172a)',
                      borderRadius: '16px',
                      border: '2px solid rgba(239, 68, 68, 0.45)',
                      boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Cabecera de Seguridad */}
                    <div
                      style={{
                        padding: '1.15rem 1.4rem',
                        background: bankDeleteSecurityModal.step === 1
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(239, 68, 68, 0.16))'
                          : 'linear-gradient(135deg, rgba(220, 38, 38, 0.22), rgba(153, 27, 27, 0.25))',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.18)',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {bankDeleteSecurityModal.step === 1 ? <ShieldAlert size={22} /> : <Lock size={22} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#dc2626' }}>
                            Protocolo de Doble Seguridad • Paso {bankDeleteSecurityModal.step} de 2
                          </div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {bankDeleteSecurityModal.step === 1
                              ? '1ra Confirmación: Solicitud de Baja Bancaria'
                              : '2da Confirmación: Bloqueo de Seguridad Definitivo'}
                          </h3>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBankDeleteSecurityModal({
                            isOpen: false,
                            step: 1,
                            bank: null,
                            confirmChecked: false,
                            confirmText: ''
                          })
                        }
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Cuerpo del Modal */}
                    <div style={{ padding: '1.35rem 1.4rem' }}>
                      {/* Ficha Resumen de la Cuenta a Eliminar */}
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '10px',
                          padding: '0.9rem 1rem',
                          marginBottom: '1.1rem',
                          fontSize: '0.84rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Código:</span>
                          <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--brand-blue)' }}>
                            {bankDeleteSecurityModal.bank.codCta || bankDeleteSecurityModal.bank.cod_cta}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Institución Bancaria:</span>
                          <strong>{bankDeleteSecurityModal.bank.bancoNombre || bankDeleteSecurityModal.bank.banco_nombre}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Cuenta a Nombre de:</span>
                          <strong>
                            {bankDeleteSecurityModal.bank.cuentaANombreDe ||
                              bankDeleteSecurityModal.bank.cuenta_a_nombre_de ||
                              bankDeleteSecurityModal.bank.titular ||
                              'GRUPO MOTORVEN, C.A.'}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Número de Cuenta:</span>
                          <strong style={{ fontFamily: 'monospace' }}>
                            {bankDeleteSecurityModal.bank.numCta || bankDeleteSecurityModal.bank.num_cta || 'N/A'}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Saldo Actual:</span>
                          <strong style={{ color: '#059669' }}>
                            {formatBs(Number(bankDeleteSecurityModal.bank.saldoBs || bankDeleteSecurityModal.bank.saldo_bs || 0))}
                          </strong>
                        </div>
                      </div>

                      {bankDeleteSecurityModal.step === 1 ? (
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.65rem',
                              alignItems: 'flex-start',
                              padding: '0.85rem',
                              borderRadius: '10px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              color: 'var(--text-primary)',
                              fontSize: '0.84rem',
                              marginBottom: '1.2rem'
                            }}
                          >
                            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <strong>Advertencia de Seguridad (Nivel 1/2):</strong> Está a punto de iniciar el proceso de eliminación de una cuenta bancaria oficial de tesorería. Para evitar eliminaciones accidentales, esta acción requiere superar un segundo control de seguridad.
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() =>
                                setBankDeleteSecurityModal({
                                  isOpen: false,
                                  step: 1,
                                  bank: null,
                                  confirmChecked: false,
                                  confirmText: ''
                                })
                              }
                              className="btn btn-secondary"
                              style={{ padding: '0.5rem 1rem' }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBankDeleteSecurityModal(prev => ({
                                  ...prev,
                                  step: 2,
                                  confirmChecked: false,
                                  confirmText: ''
                                }))
                              }
                              className="btn"
                              style={{
                                padding: '0.5rem 1.15rem',
                                background: '#d97706',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Continuar a 2da Verificación de Seguridad →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div
                            style={{
                              padding: '0.9rem',
                              borderRadius: '10px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              marginBottom: '1rem'
                            }}
                          >
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.6rem',
                                cursor: 'pointer',
                                fontSize: '0.84rem',
                                fontWeight: 600,
                                marginBottom: '0.85rem'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={bankDeleteSecurityModal.confirmChecked}
                                onChange={(e) =>
                                  setBankDeleteSecurityModal(prev => ({
                                    ...prev,
                                    confirmChecked: e.target.checked
                                  }))
                                }
                                style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#dc2626' }}
                              />
                              <span>
                                Confirmo bajo mi responsabilidad administrativa que deseo dar de baja esta cuenta bancaria.
                              </span>
                            </label>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.35rem' }}>
                                Para desbloquear el botón final, escriba la palabra <strong>ELIMINAR</strong> (o el código <strong>{bankDeleteSecurityModal.bank.codCta || bankDeleteSecurityModal.bank.cod_cta}</strong>):
                              </label>
                              <input
                                type="text"
                                className="input-modern"
                                placeholder="Escriba ELIMINAR para confirmar"
                                value={bankDeleteSecurityModal.confirmText}
                                onChange={(e) =>
                                  setBankDeleteSecurityModal(prev => ({
                                    ...prev,
                                    confirmText: e.target.value
                                  }))
                                }
                                style={{
                                  width: '100%',
                                  fontWeight: 700,
                                  letterSpacing: '0.05em',
                                  border: '1px solid rgba(239, 68, 68, 0.5)'
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() =>
                                setBankDeleteSecurityModal(prev => ({
                                  ...prev,
                                  step: 1
                                }))
                              }
                              className="btn btn-secondary"
                              style={{ padding: '0.5rem 1rem' }}
                            >
                              ← Volver al Paso 1
                            </button>

                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setBankDeleteSecurityModal({
                                    isOpen: false,
                                    step: 1,
                                    bank: null,
                                    confirmChecked: false,
                                    confirmText: ''
                                  })
                                }
                                className="btn btn-secondary"
                                style={{ padding: '0.5rem 1rem' }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={
                                  isSubmitting ||
                                  !bankDeleteSecurityModal.confirmChecked ||
                                  (String(bankDeleteSecurityModal.confirmText || '').trim().toUpperCase() !== 'ELIMINAR' &&
                                    String(bankDeleteSecurityModal.confirmText || '').trim().toUpperCase() !==
                                      String(bankDeleteSecurityModal.bank.codCta || bankDeleteSecurityModal.bank.cod_cta || '').trim().toUpperCase())
                                }
                                onClick={handleConfirmDeleteBankFinal}
                                className="btn"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  padding: '0.5rem 1.2rem',
                                  background:
                                    bankDeleteSecurityModal.confirmChecked &&
                                    (String(bankDeleteSecurityModal.confirmText || '').trim().toUpperCase() === 'ELIMINAR' ||
                                      String(bankDeleteSecurityModal.confirmText || '').trim().toUpperCase() ===
                                        String(bankDeleteSecurityModal.bank.codCta || bankDeleteSecurityModal.bank.cod_cta || '').trim().toUpperCase())
                                      ? 'linear-gradient(135deg, #dc2626, #991b1b)'
                                      : 'rgba(148, 163, 184, 0.35)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  cursor:
                                    bankDeleteSecurityModal.confirmChecked &&
                                    (String(bankDeleteSecurityModal.confirmText || '').trim().toUpperCase() === 'ELIMINAR' ||
                                      String(bankDeleteSecurityModal.confirmText || '').trim().toUpperCase() ===
                                        String(bankDeleteSecurityModal.bank.codCta || bankDeleteSecurityModal.bank.cod_cta || '').trim().toUpperCase())
                                      ? 'pointer'
                                      : 'not-allowed'
                                }}
                              >
                                <Trash2 size={15} />
                                <span>{isSubmitting ? 'Eliminando...' : 'Eliminar Cuenta Definitivamente'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. PESTAÑA: ARQUEO DE CAJA */}
          {activeTab === 'arqueo' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Arqueo de Efectivo Físico & Conciliación
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Seleccione la caja física a auditar e ingrese billetes USD y efectivo Bs para comparar contra su saldo en sistema.
                  </p>
                </div>

                <div style={{ minWidth: '280px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Caja a Auditar
                  </label>
                  <select
                    className="filter-select"
                    value={effectiveArqueoDesk?.id || effectiveArqueoDesk?.coCaja || ''}
                    onChange={(e) => setArqueoDeskId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {cashDesks.map(d => (
                      <option key={d.id || d.coCaja} value={d.id || d.coCaja}>
                        {d.coCaja || d.co_caja} - {d.descripcion} ({d.moneda === 'BS' ? formatBs(d.saldoBs ?? d.saldo_bs ?? 0) : formatUsd(d.saldoUsd ?? d.saldo_usd ?? 0)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Tabla de Conteo */}
                <div style={{
                  background: 'var(--bg-card-glass)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)'
                }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Conteo de Denominaciones USD y Efectivo Bs
                  </h4>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {[
                      { key: 'b100', val: 100, label: 'Billetes de $100' },
                      { key: 'b50', val: 50, label: 'Billetes de $50' },
                      { key: 'b20', val: 20, label: 'Billetes de $20' },
                      { key: 'b10', val: 10, label: 'Billetes de $10' },
                      { key: 'b5', val: 5, label: 'Billetes de $5' },
                      { key: 'b1', val: 1, label: 'Billetes de $1' }
                    ].map(den => (
                      <div key={den.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                          {den.label}
                        </span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="input-modern"
                          style={{ width: '80px', textAlign: 'center' }}
                          value={denomCounts[den.key] || ''}
                          onChange={(e) => setDenomCounts({ ...denomCounts, [den.key]: parseInt(e.target.value, 10) || 0 })}
                        />
                        <span style={{ width: '90px', textAlign: 'right', fontWeight: 600, fontSize: '0.88rem', color: 'var(--brand-blue)' }}>
                          {formatUsd((denomCounts[den.key] || 0) * den.val)}
                        </span>
                      </div>
                    ))}

                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                          Total Bolívares (Efectivo Bs)
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="input-modern"
                          style={{ width: '130px', textAlign: 'right' }}
                          value={denomCounts.bsEfectivo || ''}
                          onChange={(e) => setDenomCounts({ ...denomCounts, bsEfectivo: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen de Diferencias USD & Bs */}
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Resultado del Arqueo — {effectiveArqueoDesk?.descripcion || 'Caja Seleccionada'}
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                      <div style={{ background: 'var(--bg-card-glass)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Físico Contado USD:</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#059669' }}>{formatUsd(arqueoTotalUsd)}</span>
                      </div>

                      <div style={{ background: 'var(--bg-card-glass)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Físico Contado Bs:</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#059669' }}>{formatBs(arqueoTotalBs)}</span>
                      </div>

                      <div style={{ background: 'var(--bg-card-glass)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saldo en Sistema USD:</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatUsd(arqueoSystemUsd)}</span>
                      </div>

                      <div style={{ background: 'var(--bg-card-glass)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saldo en Sistema Bs:</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatBs(arqueoSystemBs)}</span>
                      </div>

                      <div style={{
                        background: Math.abs(arqueoDiferenciaUsd) < 0.01 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(230, 0, 18, 0.08)',
                        padding: '0.85rem',
                        borderRadius: '8px',
                        border: `1px solid ${Math.abs(arqueoDiferenciaUsd) < 0.01 ? '#10b981' : '#e60012'}`
                      }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diferencia USD:</span>
                        <span style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: Math.abs(arqueoDiferenciaUsd) < 0.01 ? '#059669' : '#dc2626'
                        }}>
                          {formatUsd(arqueoDiferenciaUsd)}
                          {Math.abs(arqueoDiferenciaUsd) < 0.01 && ' (Cuadrado)'}
                        </span>
                      </div>

                      <div style={{
                        background: Math.abs(arqueoDiferenciaBs) < 0.01 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(230, 0, 18, 0.08)',
                        padding: '0.85rem',
                        borderRadius: '8px',
                        border: `1px solid ${Math.abs(arqueoDiferenciaBs) < 0.01 ? '#10b981' : '#e60012'}`
                      }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diferencia Bs:</span>
                        <span style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: Math.abs(arqueoDiferenciaBs) < 0.01 ? '#059669' : '#dc2626'
                        }}>
                          {formatBs(arqueoDiferenciaBs)}
                          {Math.abs(arqueoDiferenciaBs) < 0.01 && ' (Cuadrado)'}
                        </span>
                      </div>
                    </div>

                    {lastArqueoActa && (
                      <div style={{ marginTop: '0.9rem', padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Último arqueo registrado: <strong>{lastArqueoActa.cajaNombre}</strong> ({new Date(lastArqueoActa.fecha).toLocaleTimeString()}) por {lastArqueoActa.auditor}.
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleRegisterArqueo({ applyAdjustment: true })}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.75rem' }}
                    >
                      <Save size={16} />
                      Guardar Arqueo / Ajustar
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="btn btn-print-report"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}
                    >
                      <Printer size={16} color="#ffffff" />
                      Imprimir Reporte
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. PESTAÑA: MOVIMIENTOS RECIENTES */}
          {activeTab === 'movimientos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-wrapper" style={{ flex: '1 1 300px' }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por concepto, método, caja/banco o usuario..."
                    value={movSearch}
                    onChange={(e) => setMovSearch(e.target.value)}
                    className="input-modern"
                    style={{ width: '100%', paddingLeft: '2.4rem' }}
                  />
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Movimientos: <strong>{filteredMovements.length}</strong>
                </div>
              </div>

              <div style={{ marginBottom: '1rem', padding: '0.65rem 0.9rem', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.35)', border: '1px solid var(--border-glass)' }}>
                {renderPeriodFilterControls(movPeriodFilter, setMovPeriodFilter)}
              </div>

              {renderMovementsTable(filteredMovements, 'No se han registrado movimientos de caja aún.')}
            </div>
          )}
        </div>

        {/* MODAL DE DOBLE SEGURIDAD PARA ELIMINAR MOVIMIENTO */}
        {movDeleteSecurityModal.isOpen && movDeleteSecurityModal.movement && (() => {
          const targetMov = movDeleteSecurityModal.movement;
          const targetAcc = resolveTreasuryAccountForMovement(targetMov, cashDesks, bankAccounts);
          const { sign, deltaUsd, deltaBs } = computeMovementReversalDelta(targetMov);
          const isReadyStep2 =
            movDeleteSecurityModal.confirmChecked &&
            String(movDeleteSecurityModal.confirmText || '').trim().toUpperCase() === 'ELIMINAR';

          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(2, 6, 23, 0.8)',
                backdropFilter: 'blur(6px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '510px',
                  background: 'var(--bg-card-glass)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
                }}
              >
                <div
                  style={{
                    padding: '1.1rem 1.4rem',
                    background: movDeleteSecurityModal.step === 1
                      ? 'rgba(245, 158, 11, 0.14)'
                      : 'rgba(239, 68, 68, 0.16)',
                    borderBottom: '1px solid rgba(239, 68, 68, 0.28)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: movDeleteSecurityModal.step === 1
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(239, 68, 68, 0.25)',
                        color: movDeleteSecurityModal.step === 1 ? '#fbbf24' : '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {movDeleteSecurityModal.step === 1 ? <ShieldAlert size={20} /> : <Lock size={20} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: movDeleteSecurityModal.step === 1 ? '#fbbf24' : '#f87171' }}>
                        Protocolo de Doble Seguridad • Paso {movDeleteSecurityModal.step} de 2
                      </div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {movDeleteSecurityModal.step === 1
                          ? 'Confirmar Eliminación de Movimiento'
                          : 'Autorización Definitiva de Reversión'}
                      </h4>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMovDeleteSecurityModal({ isOpen: false, step: 1, movement: null, confirmChecked: false, confirmText: '' })}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                    title="Cancelar"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={{ padding: '1.35rem 1.45rem' }}>
                  <div
                    style={{
                      padding: '0.9rem 1rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid var(--border-glass)',
                      marginBottom: '1.1rem',
                      fontSize: '0.84rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: targetMov.tipo === 'INGRESO' ? '#34d399' : '#f87171' }}>
                        {targetMov.tipo || 'MOVIMIENTO'}
                      </span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {targetMov.fecha ? new Date(targetMov.fecha).toLocaleString() : 'Sin fecha'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                      {targetMov.concepto || targetMov.id}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}>
                      <span>{targetAcc ? targetAcc.label : (targetMov.cuentaNombre || targetMov.cajaOBanco || 'Sin cuenta')}</span>
                      <strong>{formatUsd(Math.abs(deltaUsd))} {Math.abs(deltaBs) > 0 ? `/ ${formatBs(Math.abs(deltaBs))}` : ''}</strong>
                    </div>
                  </div>

                  {movDeleteSecurityModal.step === 1 ? (
                    <>
                      <p style={{ margin: '0 0 1.2rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {targetAcc ? (
                          <>
                            Al eliminar este movimiento,{' '}
                            <strong style={{ color: sign > 0 ? '#34d399' : '#f87171' }}>
                              {sign > 0 ? 'se reintegrarán' : 'se descontarán'} {formatUsd(Math.abs(deltaUsd))}
                            </strong>{' '}
                            en <strong>{targetAcc.label}</strong>. Esta acción afectará los saldos de tesorería.
                          </>
                        ) : (
                          'No se identificó una cuenta asociada automáticamente; se eliminará el registro del historial.'
                        )}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setMovDeleteSecurityModal({ isOpen: false, step: 1, movement: null, confirmChecked: false, confirmText: '' })}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setMovDeleteSecurityModal(prev => ({ ...prev, step: 2 }))}
                          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}
                        >
                          Continuar al Paso 2 →
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                          marginBottom: '1rem',
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={movDeleteSecurityModal.confirmChecked}
                          onChange={(e) => setMovDeleteSecurityModal(prev => ({ ...prev, confirmChecked: e.target.checked }))}
                          style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>
                          Confirmo bajo mi responsabilidad que deseo eliminar este movimiento y revertir su impacto en caja/banco de forma permanente.
                        </span>
                      </label>

                      <div style={{ marginBottom: '1.2rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                          Para desbloquear el botón final, escribe la palabra <strong>ELIMINAR</strong>:
                        </label>
                        <input
                          type="text"
                          value={movDeleteSecurityModal.confirmText}
                          onChange={(e) => setMovDeleteSecurityModal(prev => ({ ...prev, confirmText: e.target.value }))}
                          placeholder="ELIMINAR"
                          className="input-modern"
                          style={{ width: '100%', fontFamily: 'var(--font-code)', fontWeight: 700, textTransform: 'uppercase' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.7rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setMovDeleteSecurityModal(prev => ({ ...prev, step: 1, confirmChecked: false, confirmText: '' }))}
                        >
                          ← Volver
                        </button>
                        <button
                          type="button"
                          disabled={!isReadyStep2 || !!deletingMovId}
                          onClick={handleConfirmFinalDeleteMovement}
                          className="btn"
                          style={{
                            background: isReadyStep2 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(148, 163, 184, 0.2)',
                            color: isReadyStep2 ? '#ffffff' : '#64748b',
                            border: 'none',
                            fontWeight: 700,
                            cursor: isReadyStep2 ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Trash2 size={15} />
                          {deletingMovId ? 'Eliminando...' : 'Eliminar Definitivamente'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* MODAL CRUD: CUENTAS POR PAGAR PASIVAS (SOCIOS · 2.02.01.001) */}
      {showPartnerAccountsModal && (
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
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.25)'
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '1.15rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#fef3c7',
                    color: '#b45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Cuenta por Pagar Socio (Pasivo Contable)
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Código Contable <strong>2.02.01.001</strong> · Naturaleza Acreedora · Disponible en CxP como Cuenta Origen
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPartnerAccountsModal(false)}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: '8px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Resumen Pasivo Socios */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '0.85rem'
                }}
              >
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                    Total Pasivo con Socios
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309', marginTop: '0.2rem' }}>
                    {formatUsd(partnerPayableSummary.totalUsd)}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#78350f' }}>
                    Ref. {formatBs(partnerPayableSummary.totalBs)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    gridColumn: 'span 2'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Efecto en Tesorería &amp; Cuentas por Pagar (CxP)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
                    Cuando canceles una factura en <strong>CxP</strong> eligiendo una <strong>Cuenta por Pagar Socio</strong> como origen, la deuda con el proveedor se saldará y el monto se acumulará aquí como pasivo por pagar al socio, <strong>sin descontar efectivo de Cajas ni Bancos</strong>.
                  </div>
                </div>
              </div>

              {/* Formulario Crear / Editar */}
              <form
                onSubmit={handleSavePartnerAccountSubmit}
                style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                    {editingPartnerAccId ? 'Editar Cuenta por Pagar Socio' : 'Nueva Cuenta por Pagar Socio'}
                  </span>
                  {editingPartnerAccId && (
                    <button
                      type="button"
                      onClick={() => resetPartnerAccForm(effectivePartnerAccounts)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#64748b',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Código *
                    </label>
                    <input
                      type="text"
                      required
                      value={partnerAccForm.codigo}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                      placeholder="SOCIO-01"
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
                      value={partnerAccForm.nombre}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Cuenta por Pagar Socio — Edson"
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
                      value={partnerAccForm.titular}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, titular: e.target.value }))}
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
                      value={partnerAccForm.moneda}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, moneda: e.target.value }))}
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
                      value={partnerAccForm.saldoUsd}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, saldoUsd: e.target.value }))}
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
                      value={partnerAccForm.saldoBs}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, saldoBs: e.target.value }))}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Estado
                    </label>
                    <select
                      value={partnerAccForm.activa ? 'true' : 'false'}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, activa: e.target.value === 'true' }))}
                      className="select-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    >
                      <option value="true">Activa (Visible en CxP)</option>
                      <option value="false">Inactiva (Oculta en CxP)</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Observaciones
                    </label>
                    <input
                      type="text"
                      value={partnerAccForm.observaciones}
                      onChange={(e) => setPartnerAccForm(f => ({ ...f, observaciones: e.target.value }))}
                      placeholder="Nota o acuerdo de reembolso con el socio..."
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.9rem' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '0.55rem 1.15rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#b45309',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.84rem',
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

              {/* Tabla de Cuentas Registradas */}
              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Código</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Cuenta / Socio</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Moneda</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Estado</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Saldo Pasivo</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectivePartnerAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                          No hay cuentas por pagar a socios registradas. Crea una arriba.
                        </td>
                      </tr>
                    ) : (
                      effectivePartnerAccounts.map(acc => (
                        <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                            {acc.codigo}
                          </td>
                          <td style={{ padding: '0.7rem 0.85rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{acc.nombre}</div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              Titular: {acc.titular || 'Socio'} · Cta {acc.codigoContable || '2.02.01.001'}
                            </div>
                          </td>
                          <td style={{ padding: '0.7rem 0.85rem' }}>
                            <span style={{ padding: '0.18rem 0.55rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '0.73rem' }}>
                              {acc.moneda}
                            </span>
                          </td>
                          <td style={{ padding: '0.7rem 0.85rem' }}>
                            <span
                              style={{
                                padding: '0.18rem 0.55rem',
                                borderRadius: '999px',
                                background: acc.activa !== false ? '#dcfce7' : '#f1f5f9',
                                color: acc.activa !== false ? '#166534' : '#64748b',
                                fontWeight: 700,
                                fontSize: '0.73rem'
                              }}
                            >
                              {acc.activa !== false ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#b45309' }}>{formatUsd(acc.saldoUsd || 0)}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatBs(acc.saldoBs || 0)}</div>
                          </td>
                          <td style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleEditPartnerAccount(acc)}
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
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}
                                title="Editar cuenta"
                              >
                                <Edit2 size={13} />
                                Editar
                              </button>
                              {confirmDeletePartnerId === acc.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDeletePartnerAccount(acc)}
                                    style={{
                                      padding: '0.35rem 0.55rem',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: '#dc2626',
                                      color: '#fff',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
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
                                      fontSize: '0.75rem'
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
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                  }}
                                  title="Eliminar cuenta"
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
          </div>
        </div>
      )}
    </section>
  );
}
