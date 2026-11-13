import React, { useState, useMemo } from 'react';
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
  RefreshCw,
  Printer,
  X,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building2,
  DollarSign,
  Calculator,
  Calendar,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import { generateCashflowPDF, generateExpenseVoucherPDF } from '../services/pdfReportService';
import {
  matchesCashDesk,
  matchesBankAccount,
  applyTreasuryBalanceDelta,
  resolveExchangeRates,
  computeBankAccountValuation,
  computeBankBalancesSummary,
  computeCashDesksSummary,
  validateSufficientTreasuryBalance
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
  onAddMovement,
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

  // Estado para nuevo movimiento de caja / banco / transferencia
  const [showNewMovForm, setShowNewMovForm] = useState(false);
  const [movAccountKind, setMovAccountKind] = useState('CAJA'); // 'CAJA' | 'BANCO'
  const [selectedDeskId, setSelectedDeskId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [movTransferDestKind, setMovTransferDestKind] = useState('BANCO'); // 'CAJA' | 'BANCO'
  const [movTransferDestId, setMovTransferDestId] = useState('');
  const [movType, setMovType] = useState('EGRESO'); // 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA'
  const [movConcept, setMovConcept] = useState('');
  const [movMontoUsd, setMovMontoUsd] = useState('');
  const [movMontoBs, setMovMontoBs] = useState('');
  const [movMetodo, setMovMetodo] = useState('EFECTIVO_USD');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    saldoBs: '0'
  });

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

  // Filtrado de movimientos
  const filteredMovements = useMemo(() => {
    let list = Array.isArray(cashMovements) ? [...cashMovements] : [];
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
    return list;
  }, [cashMovements, movSearch]);

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
      const newMov = {
        id: `MOV-${Date.now()}`,
        fecha: nowIso,
        tipo: movType,
        categoria: movType === 'INGRESO' ? 'DEPOSITO_MANUAL' : 'GASTO_OPERATIVO',
        concepto: movConcept.trim(),
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
      saldoBs: '0'
    });
    setShowCajaForm(true);
    setShowNewMovForm(false);
  };

  // Abrir formulario para editar una caja existente
  const handleOpenEditCaja = (desk) => {
    if (!desk) return;
    setEditingCajaId(desk.id);
    setCajaForm({
      coCaja: desk.coCaja || desk.co_caja || 'CAJA-01',
      descripcion: desk.descripcion || desk.desCaja || '',
      moneda: desk.moneda || 'USD',
      responsable: desk.responsable || 'Administración',
      activa: desk.activa !== false,
      saldoUsd: String(Number(desk.saldoUsd ?? desk.saldo_usd ?? 0)),
      saldoBs: String(Number(desk.saldoBs ?? desk.saldo_bs ?? 0))
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

    const parsedUsd = Math.max(0, parseFloat(cajaForm.saldoUsd) || 0);
    const parsedBs = Math.max(0, parseFloat(cajaForm.saldoBs) || 0);

    try {
      setIsSubmitting(true);
      const id = editingCajaId || cleanCode.toLowerCase();
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
                Efectivo en Cajas
              </span>
              <Wallet size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatUsd(totalCajasUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(totalCajasBs)}
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
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Saldo Registrado (USD $)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-modern"
                          placeholder="0.00"
                          value={cajaForm.saldoUsd}
                          onChange={(e) => {
                            const valUsd = e.target.value;
                            const numUsd = parseFloat(valUsd);
                            const calcBs = (valUsd === '' || valUsd === '-' || isNaN(numUsd))
                              ? ''
                              : (tasaBcv > 0 ? (numUsd * tasaBcv).toFixed(2) : '0.00');
                            setCajaForm(prev => ({
                              ...prev,
                              saldoUsd: valUsd,
                              saldoBs: calcBs
                            }));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Saldo Registrado (Bs.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-modern"
                          placeholder="0.00"
                          value={cajaForm.saldoBs}
                          onChange={(e) => {
                            const valBs = e.target.value;
                            const numBs = parseFloat(valBs);
                            const calcUsd = (valBs === '' || valBs === '-' || isNaN(numBs))
                              ? ''
                              : (tasaBcv > 0 ? (numBs / tasaBcv).toFixed(2) : '0.00');
                            setCajaForm(prev => ({
                              ...prev,
                              saldoBs: valBs,
                              saldoUsd: calcUsd
                            }));
                          }}
                          style={{ width: '100%' }}
                        />
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

              {/* TABLA OFICIAL DE CAJAS OPERATIVAS DEL SISTEMA */}
              <div style={{
                overflowX: 'auto',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
                marginBottom: '1.5rem',
                background: 'var(--bg-card-glass)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.87rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Código</th>
                      <th style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Nombre de la Caja</th>
                      <th style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Moneda</th>
                      <th style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Responsable</th>
                      <th style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Saldo Registrado</th>
                      <th style={{ padding: '0.8rem 1rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashDesks.map((desk, idx) => {
                      const code = desk.coCaja || desk.co_caja || `CAJA-0${idx + 1}`;
                      const isActiva = desk.activa !== false;
                      const monedaDisplay = desk.moneda === 'BS' ? 'Bs.' : (desk.moneda === 'USD' ? '$ (USD)' : desk.moneda);
                      const saldoUsd = Number(desk.saldoUsd ?? desk.saldo_usd ?? 0);
                      const saldoBs = Number(desk.saldoBs ?? desk.saldo_bs ?? 0);

                      return (
                        <tr
                          key={desk.id || code}
                          style={{
                            borderBottom: '1px solid var(--border-glass)',
                            background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)'
                          }}
                        >
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--brand-blue)' }}>
                            {code}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {desk.descripcion}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>
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
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {desk.responsable || 'Administración'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
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
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {desk.moneda === 'BS' ? formatBs(saldoBs) : formatUsd(saldoUsd)}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              {desk.moneda === 'BS' ? formatUsd(saldoUsd) : formatBs(saldoBs)}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setMovAccountKind('CAJA');
                                  setSelectedDeskId(desk.id || desk.coCaja);
                                  setShowNewMovForm(true);
                                  setShowCajaForm(false);
                                }}
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
                                title="Editar datos o saldo de la caja"
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* GRILLA DE TARJETAS DE CAJAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem' }}>
                {cashDesks.map(desk => {
                  const isActiva = desk.activa !== false;
                  return (
                    <div
                      key={desk.id}
                      style={{
                        background: 'var(--bg-card-glass)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '14px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: 'var(--shadow-card)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              background: 'rgba(0,43,122,0.1)',
                              color: 'var(--brand-blue)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              marginBottom: '0.35rem',
                              fontFamily: 'var(--font-code)'
                            }}>
                              {desk.coCaja || desk.co_caja}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {desk.descripcion}
                            </h3>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '20px',
                              background: isActiva ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.15)',
                              color: isActiva ? '#059669' : 'var(--text-muted)',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              <CheckCircle2 size={12} /> {isActiva ? 'Activa' : 'Inactiva'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditCaja(desk)}
                              style={{
                                background: 'rgba(217, 119, 6, 0.12)',
                                border: '1px solid rgba(217, 119, 6, 0.25)',
                                color: '#d97706',
                                borderRadius: '6px',
                                padding: '0.25rem 0.4rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Editar Caja"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div style={{
                          background: 'var(--bg-surface)',
                          padding: '1rem',
                          borderRadius: '10px',
                          marginBottom: '1rem'
                        }}>
                          {desk.moneda === 'BS' ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo Disponible Bs.:</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {formatBs(Number(desk.saldoBs || desk.saldo_bs || 0))}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo Equivalente USD:</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  {formatUsd(Number(desk.saldoUsd || desk.saldo_usd || 0))}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo Disponible USD:</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {formatUsd(Number(desk.saldoUsd || desk.saldo_usd || 0))}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo Equivalente Bs:</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  {formatBs(Number(desk.saldoBs || desk.saldo_bs || 0))}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid var(--border-glass)',
                        paddingTop: '0.75rem',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)'
                      }}>
                        <span>Responsable: <strong>{desk.responsable || 'Administración'}</strong></span>
                        <span>Moneda: <strong>{desk.moneda || 'USD'}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
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

                          {/* COLUMNA DE ACCIONES: CREAR, EDITAR, GUARDAR, ELIMINAR */}
                          <td style={{ padding: '0.8rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
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

              {filteredMovements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <ArrowRightLeft size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>No se han registrado movimientos de caja aún.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Concepto</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cuenta / Método</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Usuario</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Monto USD</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Monto Bs</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>Vale PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.map((m, idx) => {
                        const isIngreso = m.tipo === 'INGRESO';
                        const movUsd = Number(m.montoUsd ?? m.monto_usd ?? 0);
                        const movBs = Number(m.montoBs ?? m.monto_bs ?? 0);
                        const accountLabel = m.cuentaNombre || m.cuenta_nombre || m.cajaOBanco || m.caja_o_banco || m.metodoPago || m.metodo || 'Efectivo';
                        const methodLabel = m.metodoPago || m.metodo_pago || m.metodo || '';
                        return (
                          <tr
                            key={m.id || idx}
                            style={{
                              borderBottom: '1px solid var(--border-glass)',
                              background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)'
                            }}
                          >
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                              {m.fecha ? new Date(m.fecha).toLocaleString() : 'N/A'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
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
                            </td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {m.concepto}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                              <div style={{ fontWeight: 600 }}>{accountLabel}</div>
                              {methodLabel && methodLabel !== accountLabel && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{methodLabel}</div>
                              )}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                              {m.usuario || 'Sistema'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: isIngreso ? '#059669' : '#dc2626' }}>
                              {formatUsd(movUsd)}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                              {formatBs(movBs)}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                onClick={() => generateExpenseVoucherPDF({ movement: m, config, currentUser })}
                                title="Generar Comprobante / Vale de Caja en PDF"
                              >
                                <Printer size={12} /> Vale PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
    </section>
  );
}
