import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  Search,
  Filter,
  Printer,
  X,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  CreditCard,
  FileText,
  Eye,
  Edit2,
  Trash2,
  Plus,
  Download,
  ChevronRight,
  Check,
  AlertCircle,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateAccountsPayablePDF, generateThirdPartyStatementPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';
import { soundFX } from '../services/soundService';

// Helpers de fechas y redondeo
const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

const isFiscalInvoiceType = (tipo) => String(tipo || '').toUpperCase().trim() === 'FACT';

const getDocTypeLabel = (tipo) => {
  const t = String(tipo || '').toUpperCase().trim();
  if (t === 'FACT' || t === 'FACTURA') return 'Factura Fiscal';
  if (t === 'NE' || t === 'NOTA_ENTREGA') return 'Nota de Entrega';
  if (t === 'ADEL') return 'Adelanto';
  if (t === 'N/CR' || t === 'NC') return 'Nota de Crédito';
  if (t === 'N/DB' || t === 'ND') return 'Nota de Débito';
  if (t === 'OC') return 'Orden de Compra';
  return t || 'Documento';
};

// Sincroniza montos en USD <-> Bs, Base Imponible, IVA 16% (si FACT) y Saldos sin duplicar lógica
const syncPayableAmounts = (next, changedField, rawValue, fallbackRate) => {
  const parsedRate = Number(next.tasaCambio || 0);
  const rate = parsedRate > 0 ? parsedRate : Math.max(0.0001, Number(fallbackRate || 1));
  const isFact = isFiscalInvoiceType(next.tipoDoc);
  const appliesIva = isFact && !next.exentoIva;

  const setFromTotalUsd = (totalU, keepRawField = null) => {
    const tU = Math.max(0, Number(totalU || 0));
    const tB = round2(tU * rate);
    if (keepRawField !== 'montoNetUsd') next.montoNetUsd = tU.toFixed(2);
    if (keepRawField !== 'montoNetBs') next.montoNetBs = tB.toFixed(2);
    if (appliesIva) {
      const bU = round2(tU / 1.16);
      const iU = round2(tU - bU);
      next.baseImponibleUsd = bU.toFixed(2);
      next.ivaUsd = iU.toFixed(2);
      next.baseImponibleBs = round2(bU * rate).toFixed(2);
      next.ivaBs = round2(iU * rate).toFixed(2);
    } else {
      next.baseImponibleUsd = tU.toFixed(2);
      next.baseImponibleBs = tB.toFixed(2);
      next.ivaUsd = '0.00';
      next.ivaBs = '0.00';
    }
  };

  const setFromTotalBs = (totalB, keepRawField = null) => {
    const tB = Math.max(0, Number(totalB || 0));
    const tU = round2(tB / rate);
    if (keepRawField !== 'montoNetBs') next.montoNetBs = tB.toFixed(2);
    if (keepRawField !== 'montoNetUsd') next.montoNetUsd = tU.toFixed(2);
    if (appliesIva) {
      const bB = round2(tB / 1.16);
      const iB = round2(tB - bB);
      next.baseImponibleBs = bB.toFixed(2);
      next.ivaBs = iB.toFixed(2);
      next.baseImponibleUsd = round2(bB / rate).toFixed(2);
      next.ivaUsd = round2(iB / rate).toFixed(2);
    } else {
      next.baseImponibleBs = tB.toFixed(2);
      next.baseImponibleUsd = tU.toFixed(2);
      next.ivaBs = '0.00';
      next.ivaUsd = '0.00';
    }
  };

  if (changedField === 'tipoDoc' || changedField === 'exentoIva') {
    if (!isFact) next.exentoIva = false;
    if (next.monedaIngreso === 'BS') {
      setFromTotalBs(next.montoNetBs);
    } else {
      setFromTotalUsd(next.montoNetUsd);
    }
  } else if (changedField === 'tasaCambio') {
    if (Number(rawValue || 0) > 0) {
      if (next.monedaIngreso === 'BS') {
        const bB = Math.max(0, Number(next.baseImponibleBs || 0));
        const iB = appliesIva ? Math.max(0, Number(next.ivaBs || 0)) : 0;
        const tB = Math.max(0, Number(next.montoNetBs || 0));
        const aB = Math.max(0, Number(next.abonosBs || 0));
        next.baseImponibleUsd = round2(bB / rate).toFixed(2);
        next.ivaUsd = round2(iB / rate).toFixed(2);
        next.montoNetUsd = round2(tB / rate).toFixed(2);
        next.abonosUsd = round2(aB / rate).toFixed(2);
      } else {
        const bU = Math.max(0, Number(next.baseImponibleUsd || 0));
        const iU = appliesIva ? Math.max(0, Number(next.ivaUsd || 0)) : 0;
        const tU = Math.max(0, Number(next.montoNetUsd || 0));
        const aU = Math.max(0, Number(next.abonosUsd || 0));
        next.baseImponibleBs = round2(bU * rate).toFixed(2);
        next.ivaBs = round2(iU * rate).toFixed(2);
        next.montoNetBs = round2(tU * rate).toFixed(2);
        next.abonosBs = round2(aU * rate).toFixed(2);
      }
    }
  } else if (changedField === 'baseImponibleUsd') {
    next.monedaIngreso = 'US$';
    const bU = Math.max(0, Number(rawValue || 0));
    const iU = appliesIva ? round2(bU * 0.16) : 0;
    const tU = round2(bU + iU);
    next.baseImponibleBs = round2(bU * rate).toFixed(2);
    next.ivaUsd = iU.toFixed(2);
    next.ivaBs = round2(iU * rate).toFixed(2);
    next.montoNetUsd = tU.toFixed(2);
    next.montoNetBs = round2(tU * rate).toFixed(2);
  } else if (changedField === 'baseImponibleBs') {
    next.monedaIngreso = 'BS';
    const bB = Math.max(0, Number(rawValue || 0));
    const iB = appliesIva ? round2(bB * 0.16) : 0;
    const tB = round2(bB + iB);
    next.baseImponibleUsd = round2(bB / rate).toFixed(2);
    next.ivaBs = iB.toFixed(2);
    next.ivaUsd = round2(iB / rate).toFixed(2);
    next.montoNetBs = tB.toFixed(2);
    next.montoNetUsd = round2(tB / rate).toFixed(2);
  } else if (changedField === 'ivaUsd') {
    next.monedaIngreso = 'US$';
    const bU = Math.max(0, Number(next.baseImponibleUsd || 0));
    const iU = Math.max(0, Number(rawValue || 0));
    const tU = round2(bU + iU);
    next.ivaBs = round2(iU * rate).toFixed(2);
    next.montoNetUsd = tU.toFixed(2);
    next.montoNetBs = round2(tU * rate).toFixed(2);
  } else if (changedField === 'ivaBs') {
    next.monedaIngreso = 'BS';
    const bB = Math.max(0, Number(next.baseImponibleBs || 0));
    const iB = Math.max(0, Number(rawValue || 0));
    const tB = round2(bB + iB);
    next.ivaUsd = round2(iB / rate).toFixed(2);
    next.montoNetBs = tB.toFixed(2);
    next.montoNetUsd = round2(tB / rate).toFixed(2);
  } else if (changedField === 'montoNetUsd') {
    next.monedaIngreso = 'US$';
    setFromTotalUsd(rawValue, 'montoNetUsd');
  } else if (changedField === 'montoNetBs') {
    next.monedaIngreso = 'BS';
    setFromTotalBs(rawValue, 'montoNetBs');
  } else if (changedField === 'abonosUsd') {
    next.monedaIngreso = 'US$';
    const aU = Math.max(0, Number(rawValue || 0));
    next.abonosBs = round2(aU * rate).toFixed(2);
  } else if (changedField === 'abonosBs') {
    next.monedaIngreso = 'BS';
    const aB = Math.max(0, Number(rawValue || 0));
    next.abonosUsd = round2(aB / rate).toFixed(2);
  }

  const finalTotalUsd = Math.max(0, Number(next.montoNetUsd || 0));
  const finalAbonosUsd = Math.max(0, Number(next.abonosUsd || 0));
  const finalTotalBs = Math.max(0, Number(next.montoNetBs || 0));
  const finalAbonosBs = Math.max(0, Number(next.abonosBs || 0));

  next.saldoUsd = round2(Math.max(0, finalTotalUsd - finalAbonosUsd)).toFixed(2);
  next.saldoBs = round2(Math.max(0, finalTotalBs - finalAbonosBs)).toFixed(2);
  return next;
};

const getTodayIso = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseDateSafe = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatDateShort = (dateInput) => {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toIsoDateInput = (dateInput) => {
  if (!dateInput) return getTodayIso();
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
  if (isNaN(d.getTime())) return getTodayIso();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Generador de texto consolidado para búsqueda omnicanal en CxP (facturas, notas, proveedores, montos, etc.)
const buildPayableSearchString = (p) => {
  if (!p) return '';
  const tipo = String(p.tipoDoc || '').toUpperCase().trim();
  const nro = String(p.nroDoc || '').trim();
  const nroNoZeros = nro.replace(/^0+/, '') || nro;
  const nroPadded = /^\d+$/.test(nro) ? nro.padStart(8, '0') : nro;

  const typeAliases = [];
  if (tipo === 'FACT' || tipo === 'FACTURA' || tipo.includes('FACT')) {
    typeAliases.push('factura', 'facturas', 'fact', 'fiscal', 'doc', 'documento');
  } else if (tipo === 'NE' || tipo === 'NOTA_ENTREGA' || tipo.includes('NOTA')) {
    typeAliases.push('nota', 'notas', 'entrega', 'entregas', 'nota de entrega', 'remision', 'ne');
  } else if (tipo === 'ADEL' || tipo.includes('ANTICIP') || tipo.includes('ADEL')) {
    typeAliases.push('adelanto', 'adelantos', 'anticipo', 'anticipos', 'adel');
  } else if (tipo === 'N/CR' || tipo === 'NC' || tipo.includes('CREDIT')) {
    typeAliases.push('nota de credito', 'credito', 'creditos', 'nc', 'n/cr');
  } else if (tipo === 'N/DB' || tipo === 'ND' || tipo.includes('DEBIT')) {
    typeAliases.push('nota de debito', 'debito', 'debitos', 'nd', 'n/db');
  }
  typeAliases.push(tipo.toLowerCase());

  const docCombos = [
    nro,
    `#${nro}`,
    nroNoZeros,
    `#${nroNoZeros}`,
    nroPadded,
    `${tipo}-${nro}`,
    `${tipo} ${nro}`,
    `${tipo} #${nro}`
  ];

  if (tipo === 'FACT' || tipo === 'FACTURA' || tipo.includes('FACT')) {
    docCombos.push(
      `factura ${nro}`,
      `factura #${nro}`,
      `facturas ${nro}`,
      `factura ${nroNoZeros}`,
      `factura #${nroNoZeros}`,
      `fact ${nro}`,
      `fact #${nro}`
    );
  } else if (tipo === 'NE' || tipo.includes('NOTA')) {
    docCombos.push(`nota ${nro}`, `nota #${nro}`, `entrega ${nro}`, `ne ${nro}`);
  }

  const prov = String(p.provNombre || '').toLowerCase();
  const rif = String(p.provRif || '').toLowerCase();
  const rifClean = rif.replace(/[^a-z0-9]/g, '');

  let statusText = '';
  if (p.isSolvente) {
    statusText = 'solvente pagado pagada al dia solventes';
  } else if (p.isVencido) {
    statusText = `vencido vencida vencidas mora atrasado vencida hace ${p.diffDays}d`;
  } else {
    statusText = 'por vencer vigente al dia pendiente pendientes';
  }

  return [
    typeAliases.join(' '),
    docCombos.join(' '),
    prov,
    rif,
    rifClean,
    String(p.fecEmis || ''),
    String(p.fecVenc || ''),
    String(p.fechaEmisionIso || ''),
    String(p.fechaVencimientoIso || ''),
    statusText,
    String(p.montoNetUsd || ''),
    String(p.saldoUsd || ''),
    String(p.abonosUsd || ''),
    String(p.saldoBs || ''),
    String(p.observaciones || '').toLowerCase(),
    String(p.descrip || '').toLowerCase(),
    String(p.comentario || '').toLowerCase()
  ].join(' ').toLowerCase();
};

export default function AccountsPayableModal({
  isOpen,
  onClose,
  accountsPayable = [],
  profitAccountsPayable = [],
  suppliers = [],
  profitSuppliers = [],
  bankAccounts = [],
  cashDesks = [],
  supplierPayments = [],
  config = {},
  currentUser = null,
  onRegisterPayment,
  onSaveDocument,
  onDeleteDocument
}) {
  const notify = useNotification();
  const parteARef = useRef(null);

  // Scroll horizontal superior sincronizado y vertical derecho para Parte B
  const topScrollRef = useRef(null);
  const tableScrollRef = useRef(null);
  const tableElRef = useRef(null);
  const [tableWidth, setTableWidth] = useState(1350);

  const isSyncingTop = useRef(false);
  const isSyncingTable = useRef(false);

  const handleTopScroll = () => {
    if (isSyncingTop.current) return;
    isSyncingTable.current = true;
    if (tableScrollRef.current && topScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    setTimeout(() => { isSyncingTable.current = false; }, 30);
  };

  const handleTableScroll = () => {
    if (isSyncingTable.current) return;
    isSyncingTop.current = true;
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    setTimeout(() => { isSyncingTop.current = false; }, 30);
  };

  const tasaBcv = Number(config?.tasaDolar) || 899.27;
  const rawKeystone = Number(config?.tasaKeystone ?? config?.tasa_keystone ?? 0);
  const tasaKeystone = (rawKeystone > 100 || tasaBcv <= 100)
    ? (rawKeystone || tasaBcv)
    : round2(tasaBcv * 1.03);

  // Estados de filtros
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VENCIDO' | 'VIGENTE' | 'SOLVENTE' | 'VENCIDO_1_15' | 'VENCIDO_16_30' | 'VENCIDO_OVER_30'
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  // Overrides locales en memoria para respuesta instantánea
  const [localDocOverrides, setLocalDocOverrides] = useState({});
  const [deletingKey, setDeletingKey] = useState(null);

  // PARTE A: Estado del formulario para registrar pago a proveedor
  const [pagoDocKey, setPagoDocKey] = useState('');
  const [pagoDocSearch, setPagoDocSearch] = useState('');
  const [pagoTasa, setPagoTasa] = useState(String(tasaKeystone));

  useEffect(() => {
    setPagoTasa(String(tasaKeystone));
  }, [tasaKeystone]);
  const [pagoFecha, setPagoFecha] = useState(getTodayIso());
  const [pagoCuentaKey, setPagoCuentaKey] = useState('');
  const [pagoMontoUsd, setPagoMontoUsd] = useState('');
  const [pagoMontoBs, setPagoMontoBs] = useState('');
  const [pagoReferencia, setPagoReferencia] = useState('');
  const [pagoObservaciones, setPagoObservaciones] = useState('');
  const [isSavingPago, setIsSavingPago] = useState(false);
  const [pagoFeedback, setPagoFeedback] = useState(null);

  // Modales
  const [selectedPayableDetail, setSelectedPayableDetail] = useState(null);
  const [editingPayable, setEditingPayable] = useState(null);
  const [isCreatingPayable, setIsCreatingPayable] = useState(false);
  const [isSavingPayable, setIsSavingPayable] = useState(false);

  // Catálogo unificado de Caja y Bancos para pagar a proveedores
  const catalogCuentas = useMemo(() => {
    const list = [];
    if (Array.isArray(cashDesks) && cashDesks.length > 0) {
      cashDesks.forEach(d => {
        if (!d) return;
        const code = d.coCaja || d.co_caja || d.id || 'CAJA';
        const desc = d.descripcion || d.desCaja || d.des_caja || d.nombre || d.descrip || 'Caja Efectivo';
        const key = `CAJA-${d.id || code}`;
        const label = `[${code} • ${d.moneda || 'USD'}] ${desc} • Saldo: ${formatUsd(d.saldoUsd || 0)}`;
        list.push({
          key,
          id: d.id || code,
          rawId: d.id || code,
          nombre: `${code} - ${desc}`,
          label,
          accountType: 'CAJA',
          kind: 'CAJA',
          moneda: d.moneda || 'USD',
          saldoUsd: Number(d.saldoUsd || 0)
        });
      });
    }
    if (Array.isArray(bankAccounts) && bankAccounts.length > 0) {
      bankAccounts.forEach(b => {
        if (!b) return;
        const key = `BANCO-${b.id || b.codCta || Math.random()}`;
        const label = `${b.banco || b.nombre || 'Banco'} (${b.numCta ? '...' + String(b.numCta).slice(-4) : 'Cta'}) • ${formatUsd(b.saldoUsd || 0)}`;
        list.push({
          key,
          id: b.id || b.codCta,
          rawId: b.id || b.codCta,
          nombre: `${b.banco || ''} - ${b.numCta || ''}`.trim(),
          label,
          accountType: 'BANCO',
          kind: 'BANCO',
          moneda: b.moneda || 'BS',
          saldoUsd: Number(b.saldoUsd || 0)
        });
      });
    }
    if (list.length === 0) {
      list.push(
        { key: 'CAJA-DEF-USD', id: 'CAJA-DEF-USD', rawId: 'CAJA-DEF-USD', nombre: 'Caja Operativa Principal USD', label: 'Caja Operativa Principal USD (Efectivo)', accountType: 'CAJA', kind: 'CAJA', moneda: 'USD', saldoUsd: 0 },
        { key: 'BANCO-DEF-BS', id: 'BANCO-DEF-BS', rawId: 'BANCO-DEF-BS', nombre: 'Banco Nacional Transferencia (Bs.)', label: 'Banco Nacional Transferencia (Bs.)', accountType: 'BANCO', kind: 'BANCO', moneda: 'BS', saldoUsd: 0 }
      );
    }
    return list;
  }, [cashDesks, bankAccounts]);

  // Preseleccionar primera cuenta si no hay ninguna
  useMemo(() => {
    if (!pagoCuentaKey && catalogCuentas.length > 0) {
      setPagoCuentaKey(catalogCuentas[0].key);
    }
  }, [catalogCuentas, pagoCuentaKey]);

  // Conjunto base de cuentas por pagar
  const targetPayables = useMemo(() => {
    return (Array.isArray(profitAccountsPayable) && profitAccountsPayable.length > 0)
      ? profitAccountsPayable
      : (Array.isArray(accountsPayable) ? accountsPayable : []);
  }, [accountsPayable, profitAccountsPayable]);

  // Lista de tipos de documentos únicos
  const docTypes = useMemo(() => {
    const setTypes = new Set(targetPayables.map(p => (p.tipoDoc || p.tipo_doc || '').trim()).filter(Boolean));
    return Array.from(setTypes);
  }, [targetPayables]);

  // Lista de proveedores únicos
  const supplierList = useMemo(() => {
    const setProvs = new Set();
    targetPayables.forEach(p => {
      const name = (p.provNombre || p.prov_nombre || '').trim();
      if (name) setProvs.add(name);
    });
    return Array.from(setProvs).sort();
  }, [targetPayables]);

  // Procesamiento integral de Cuentas por Pagar (fechas, saldos, días de mora y estado)
  const processedPayables = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return targetPayables
      .filter(p => {
        if (!p) return false;
        const pKey = String(p.id || p.nroDoc || p.nro_doc || '');
        if (localDocOverrides[pKey]?._deleted) return false;
        if (p?.anulado) return false;
        return true;
      })
      .map(p => {
        const pKey = String(p.id || p.nroDoc || p.nro_doc || '');
        const override = localDocOverrides[pKey] || {};
        const merged = { ...p, ...override };
        const pTs = Date.parse(p.updated_at || p.fechaSincronizacion || p.fecha_sincronizacion || '') || 0;
        const ovTs = Date.parse(override?._localSavedAt || override?.updated_at || override?.fechaSincronizacion || '') || 0;
        const resolved = (pTs > 0 && ovTs > 0 && pTs > ovTs) ? p : merged;

        const tipoDoc = (resolved.tipoDoc || resolved.tipo_doc || 'FACT').toUpperCase().trim();
        const nroDoc = String(resolved.nroDoc || resolved.nro_doc || 'S/N').trim();
        const provNombre = resolved.provNombre || resolved.prov_nombre || 'Proveedor General';
        const provRif = resolved.provRif || resolved.prov_rif || resolved.coProv || resolved.co_prov || 'J-00000000';

        const montoNetUsd = Number(resolved.montoNetUsd ?? resolved.monto_net_usd ?? (tasaKeystone > 0 ? Number(resolved.montoNetBs || resolved.monto_net_bs || 0) / tasaKeystone : 0));
        const saldoBs = Number(resolved.saldoBs ?? resolved.saldo_bs ?? 0);
        const rawSaldoUsd = Number(resolved.saldoUsd ?? resolved.saldo_usd ?? (tasaKeystone > 0 ? saldoBs / tasaKeystone : montoNetUsd));
        const saldoUsd = Math.max(0, round2(rawSaldoUsd));

        // Abonos registrados
        const rawAbonosVal = resolved.abonosUsd ?? resolved.abonos_usd;
        const abonosUsd = rawAbonosVal !== undefined && rawAbonosVal !== null
          ? round2(Number(rawAbonosVal))
          : Math.max(0, round2(montoNetUsd - saldoUsd));
        const abonosBs = round2(abonosUsd * tasaKeystone);

        // Fechas
        const fecEmis = resolved.fechaEmision || resolved.fec_emis;
        const fecVenc = resolved.fechaVencimiento || resolved.fec_venc || fecEmis;
        const dueDate = fecVenc ? parseDateSafe(fecVenc) : today;
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isSolvente = saldoUsd <= 0.01;
        const isVencido = !isSolvente && diffDays > 0;

        let tramo = 'VIGENTE';
        if (isSolvente) {
          tramo = 'SOLVENTE';
        } else if (isVencido) {
          if (diffDays <= 15) tramo = '1_15';
          else if (diffDays <= 30) tramo = '16_30';
          else tramo = 'OVER_30';
        }

        // Historial de pagos específicos
        const matchingPayments = (supplierPayments || []).filter(pay => {
          if (!pay) return false;
          const matchProv = (pay.provRif && provRif && String(pay.provRif).trim() === String(provRif).trim()) ||
            (pay.provNombre && provNombre && String(pay.provNombre).trim().toLowerCase() === String(provNombre).trim().toLowerCase());
          const matchDoc = pay.descrip && pay.descrip.includes(nroDoc);
          return matchProv || matchDoc;
        });

        const docTasa = Number(resolved.tasa || 0) > 10 ? Number(resolved.tasa) : tasaKeystone;
        const resolvedNetBs = Number(resolved.montoNetBs || resolved.monto_net_bs || 0);
        const displayNetBs = resolvedNetBs > 0 && String(resolved.moneda || '').toUpperCase().includes('BS')
          ? round2(resolvedNetBs)
          : round2(montoNetUsd * docTasa);

        return {
          ...resolved,
          id: resolved.id || `CXP-${tipoDoc}-${nroDoc}-${provRif}`,
          tipoDoc,
          tipoDocLabel: getDocTypeLabel(tipoDoc),
          nroDoc,
          provNombre,
          provRif,
          fecEmis: fecEmis ? formatDateShort(fecEmis) : 'N/A',
          fecVenc: fecVenc ? formatDateShort(fecVenc) : 'N/A',
          fechaEmisionIso: toIsoDateInput(fecEmis),
          fechaVencimientoIso: toIsoDateInput(fecVenc),
          diasCredito: Number(resolved.diasCredito ?? resolved.dias_credito ?? 15),
          tasa: docTasa,
          montoNetUsd: round2(montoNetUsd),
          montoNetBs: displayNetBs,
          abonosUsd,
          abonosBs: round2(abonosUsd * docTasa),
          saldoUsd,
          saldoBs: round2(saldoUsd * docTasa),
          baseImponibleUsd: resolved.baseImponibleUsd !== undefined ? round2(resolved.baseImponibleUsd) : (isFiscalInvoiceType(tipoDoc) ? round2(montoNetUsd / 1.16) : round2(montoNetUsd)),
          ivaUsd: resolved.ivaUsd !== undefined ? round2(resolved.ivaUsd) : (isFiscalInvoiceType(tipoDoc) ? round2(montoNetUsd - round2(montoNetUsd / 1.16)) : 0),
          isSolvente,
          isVencido,
          diffDays,
          tramo,
          historialPagos: matchingPayments
        };
      });
  }, [targetPayables, localDocOverrides, tasaKeystone, supplierPayments]);

  // Documentos con saldo pendiente seleccionables en Parte A
  const payableDocsWithBalance = useMemo(() => {
    return processedPayables.filter(p => p.saldoUsd > 0.01);
  }, [processedPayables]);

  // Documentos filtrados por el buscador dentro del selector de Parte A
  const searchedPayableDocs = useMemo(() => {
    if (!pagoDocSearch.trim()) return payableDocsWithBalance;
    const rawTokens = pagoDocSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return payableDocsWithBalance.filter(d => {
      const searchStr = buildPayableSearchString(d);
      return rawTokens.every(token => searchStr.includes(token));
    });
  }, [payableDocsWithBalance, pagoDocSearch]);

  // Documento actualmente seleccionado en Parte A
  const selectedPagoDoc = useMemo(() => {
    if (!pagoDocKey) return null;
    return processedPayables.find(p => String(p.id) === String(pagoDocKey) || String(p.nroDoc) === String(pagoDocKey)) || null;
  }, [processedPayables, pagoDocKey]);

  // Filtrado de la tabla principal (Parte B)
  const filteredPayables = useMemo(() => {
    const rawTokens = searchFilter.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return processedPayables.filter(p => {
      // Búsqueda inteligente multi-criterio y multi-término (factura, proveedor, RIF, número de documento, etc.)
      if (rawTokens.length > 0) {
        const searchStr = buildPayableSearchString(p);
        const matchesAll = rawTokens.every(token => searchStr.includes(token));
        if (!matchesAll) return false;
      }

      // Tipo de documento
      if (docTypeFilter !== 'ALL' && p.tipoDoc !== docTypeFilter) {
        return false;
      }

      // Proveedor
      if (supplierFilter !== 'ALL' && p.provNombre !== supplierFilter) {
        return false;
      }

      // Estado: las PAGADAS (Solventes) no aparecen en el listview por defecto ('ALL'), solo en 'SOLVENTE'
      if (statusFilter === 'ALL' && p.isSolvente) return false;
      if (statusFilter === 'VIGENTE' && (p.isVencido || p.isSolvente)) return false;
      if (statusFilter === 'VENCIDO' && (!p.isVencido || p.isSolvente)) return false;
      if (statusFilter === 'SOLVENTE' && !p.isSolvente) return false;
      if (statusFilter === 'VENCIDO_1_15' && p.tramo !== '1_15') return false;
      if (statusFilter === 'VENCIDO_16_30' && p.tramo !== '16_30') return false;
      if (statusFilter === 'VENCIDO_OVER_30' && p.tramo !== 'OVER_30') return false;

      return true;
    });
  }, [processedPayables, searchFilter, docTypeFilter, supplierFilter, statusFilter]);

  // Descripción de filtros activos en Parte B para imprimir exactamente lo mostrado en la tabla
  const activeFiltersLabel = useMemo(() => {
    const statusLabels = {
      ALL: 'Todos los Estados',
      VIGENTE: 'Solo Por Vencer (Al Día)',
      VENCIDO: 'Todas las Vencidas',
      SOLVENTE: 'Solo Solventes (Pagadas)',
      VENCIDO_1_15: 'Vencidas 1 a 15 días',
      VENCIDO_16_30: 'Vencidas 16 a 30 días',
      VENCIDO_OVER_30: 'Vencidas más de 30 días'
    };
    const parts = [
      `Proveedor: ${supplierFilter === 'ALL' ? 'Todos' : supplierFilter}`,
      `Doc.: ${docTypeFilter === 'ALL' ? 'Todos' : docTypeFilter}`,
      `Estado: ${statusLabels[statusFilter] || statusFilter}`
    ];
    if (searchFilter.trim()) {
      parts.push(`Búsqueda: "${searchFilter.trim()}"`);
    }
    return parts.join(' • ');
  }, [searchFilter, docTypeFilter, supplierFilter, statusFilter]);

  const handlePrintFilteredReport = () => {
    generateAccountsPayablePDF({
      payables: filteredPayables,
      suppliers,
      config: { ...config, tasaDolar: tasaBcv, tasaKeystone },
      currentUser,
      filterSummary: activeFiltersLabel
    });
  };

  // Sincronización del ancho del scroll superior con la tabla
  useEffect(() => {
    const updateWidth = () => {
      if (tableElRef.current) {
        setTableWidth(Math.max(1350, tableElRef.current.scrollWidth));
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 120);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [filteredPayables.length]);

  // Contadores para pestañas rápidas
  const countStats = useMemo(() => {
    let vencidos = 0;
    let alDia = 0;
    let solventes = 0;
    processedPayables.forEach(p => {
      if (p.isSolvente) solventes++;
      else if (p.isVencido) vencidos++;
      else alDia++;
    });
    return {
      all: vencidos + alDia,
      vencidos,
      alDia,
      solventes
    };
  }, [processedPayables]);

  // Métricas Consolidadas (solo consideran deudas no solventes)
  const totalCarteraUsd = useMemo(() => {
    return processedPayables.filter(p => !p.isSolvente).reduce((acc, p) => acc + p.saldoUsd, 0);
  }, [processedPayables]);

  const totalCarteraBs = useMemo(() => {
    return round2(totalCarteraUsd * tasaKeystone);
  }, [totalCarteraUsd, tasaKeystone]);

  const totalVencidoUsd = useMemo(() => {
    return processedPayables.filter(p => p.isVencido).reduce((acc, p) => acc + p.saldoUsd, 0);
  }, [processedPayables]);

  const totalVigenteUsd = Math.max(0, totalCarteraUsd - totalVencidoUsd);

  const countProveedoresConDeuda = useMemo(() => {
    const setProvs = new Set(processedPayables.filter(p => !p.isSolvente).map(p => p.provRif || p.provNombre));
    return setProvs.size;
  }, [processedPayables]);

  // ========================================================================
  // Handlers de Parte A: Selección y Registro de Pago a Proveedor
  // ========================================================================
  const handleSelectDocForPago = (docIdentifier) => {
    const doc = processedPayables.find(d => String(d.id) === String(docIdentifier) || String(d.nroDoc) === String(docIdentifier));
    if (doc) {
      setPagoDocKey(doc.id || doc.nroDoc);
      const rate = Number(pagoTasa) > 0 ? Number(pagoTasa) : tasaKeystone;
      const rest = round2(doc.saldoUsd);
      setPagoMontoUsd(String(rest.toFixed(2)));
      setPagoMontoBs(String(round2(rest * rate).toFixed(2)));
      setPagoObservaciones(`Abono a ${doc.tipoDoc} #${doc.nroDoc} - ${doc.provNombre}`);

      // Desplazamiento suave al formulario de Parte A
      if (parteARef.current) {
        parteARef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleTasaChange = (val) => {
    setPagoTasa(val);
    const rate = Number(val);
    const usd = Number(pagoMontoUsd);
    if (rate > 0 && !isNaN(usd) && pagoMontoUsd !== '') {
      setPagoMontoBs(String(round2(usd * rate).toFixed(2)));
    }
  };

  const handleMontoUsdChange = (val) => {
    setPagoMontoUsd(val);
    const usd = Number(val);
    const rate = Number(pagoTasa);
    if (!isNaN(usd) && val !== '' && rate > 0) {
      setPagoMontoBs(String(round2(usd * rate).toFixed(2)));
    } else if (val === '') {
      setPagoMontoBs('');
    }
  };

  const handleMontoBsChange = (val) => {
    setPagoMontoBs(val);
    const bs = Number(val);
    const rate = Number(pagoTasa);
    if (!isNaN(bs) && val !== '' && rate > 0) {
      setPagoMontoUsd(String(round2(bs / rate).toFixed(2)));
    } else if (val === '') {
      setPagoMontoUsd('');
    }
  };

  const handleSubmitPago = async (e) => {
    e.preventDefault();
    setPagoFeedback(null);

    if (!selectedPagoDoc) {
      const msg = 'Seleccione un documento de Cuenta por Pagar válido.';
      setPagoFeedback({ type: 'error', message: msg });
      notify.warning(msg);
      return;
    }

    const tasaNum = Number(pagoTasa);
    if (!tasaNum || isNaN(tasaNum) || tasaNum <= 0) {
      const msg = 'Ingrese una tasa válida (mayor a 0).';
      setPagoFeedback({ type: 'error', message: msg });
      notify.warning(msg);
      return;
    }

    if (!pagoFecha) {
      const msg = 'La fecha del pago es requerida.';
      setPagoFeedback({ type: 'error', message: msg });
      notify.warning(msg);
      return;
    }

    const cuentaObj = catalogCuentas.find(c => c.key === pagoCuentaKey) || catalogCuentas[0];
    if (!cuentaObj) {
      const msg = 'Seleccione una cuenta de Caja o Banco válida.';
      setPagoFeedback({ type: 'error', message: msg });
      notify.warning(msg);
      return;
    }

    const abonoUsd = round2(Number(pagoMontoUsd));
    if (!abonoUsd || isNaN(abonoUsd) || abonoUsd <= 0) {
      const msg = 'Ingrese un monto de pago válido mayor a $0.00.';
      setPagoFeedback({ type: 'error', message: msg });
      notify.warning(msg);
      return;
    }

    if (abonoUsd > round2(selectedPagoDoc.saldoUsd + 0.01)) {
      const msg = `El monto a pagar ($${abonoUsd.toFixed(2)}) no puede superar el saldo pendiente ($${selectedPagoDoc.saldoUsd.toFixed(2)}).`;
      setPagoFeedback({ type: 'error', message: msg });
      notify.warning(msg);
      return;
    }

    const effectiveAbonoUsd = Math.min(abonoUsd, selectedPagoDoc.saldoUsd);
    const effectiveAbonoBs = round2(effectiveAbonoUsd * tasaNum);
    const nuevoSaldoUsd = round2(Math.max(0, selectedPagoDoc.saldoUsd - effectiveAbonoUsd));
    const nuevoSaldoBs = round2(nuevoSaldoUsd * tasaNum);
    const nuevoAbonosUsd = round2((selectedPagoDoc.abonosUsd || 0) + effectiveAbonoUsd);

    setIsSavingPago(true);
    try {
      const docKey = String(selectedPagoDoc.id || selectedPagoDoc.nroDoc);
      const pagoRecord = {
        id: `PAG-${Date.now().toString().slice(-6)}`,
        pagoNum: `PAG-${Date.now().toString().slice(-6)}`,
        fechaPago: pagoFecha,
        coProv: selectedPagoDoc.provRif,
        provNombre: selectedPagoDoc.provNombre,
        provRif: selectedPagoDoc.provRif,
        montoUsd: effectiveAbonoUsd,
        montoBs: effectiveAbonoBs,
        tasa: tasaNum,
        moneda: cuentaObj.moneda === 'USD' ? 'US$' : 'BS',
        cuentaId: cuentaObj.id,
        cuentaNombre: cuentaObj.nombre,
        accountType: cuentaObj.accountType,
        referencia: pagoReferencia.trim(),
        descrip: pagoObservaciones.trim() || `Pago ${selectedPagoDoc.tipoDoc} #${selectedPagoDoc.nroDoc} - ${selectedPagoDoc.provNombre}`,
        anulado: false
      };

      const savedAtIso = new Date().toISOString();
      const updatedPayablePayload = {
        ...selectedPagoDoc,
        saldoUsd: nuevoSaldoUsd,
        saldoBs: nuevoSaldoBs,
        abonosUsd: nuevoAbonosUsd,
        tasa: tasaNum,
        historialPagos: [pagoRecord, ...(selectedPagoDoc.historialPagos || [])],
        fechaSincronizacion: savedAtIso,
        updated_at: savedAtIso,
        _localSavedAt: savedAtIso
      };

      // 1. Actualización inmediata local
      setLocalDocOverrides(prev => ({
        ...prev,
        [docKey]: updatedPayablePayload,
        [selectedPagoDoc.nroDoc]: updatedPayablePayload
      }));

      // 2. Persistir en Supabase y Caja/Bancos
      if (onRegisterPayment) {
        await onRegisterPayment({
          updatedDoc: updatedPayablePayload,
          paymentPayload: pagoRecord,
          selectedAccount: cuentaObj
        });
      }

      soundFX.success();
      const successMsg = `Pago registrado con éxito a ${selectedPagoDoc.provNombre} por ${formatUsd(effectiveAbonoUsd)} (${formatBs(effectiveAbonoBs)}). Nuevo Saldo: ${formatUsd(nuevoSaldoUsd)}`;
      setPagoFeedback({ type: 'success', message: successMsg });
      notify.success(successMsg);

      setPagoReferencia('');
      if (nuevoSaldoUsd > 0) {
        setPagoMontoUsd(String(nuevoSaldoUsd.toFixed(2)));
        setPagoMontoBs(String(round2(nuevoSaldoUsd * tasaNum).toFixed(2)));
      } else {
        setPagoMontoUsd('0.00');
        setPagoMontoBs('0.00');
        setPagoDocKey('');
      }
    } catch (err) {
      console.error('Error al registrar pago CxP:', err);
      soundFX.error();
      const errMsg = 'Ocurrió un error al registrar el pago: ' + (err.message || 'Error del servidor');
      setPagoFeedback({ type: 'error', message: errMsg });
      notify.error(errMsg);
    } finally {
      setIsSavingPago(false);
    }
  };

  // ========================================================================
  // Handlers de Creación / Edición de Documentos CxP
  // ========================================================================
  const handleOpenNewPayableModal = () => {
    setIsCreatingPayable(true);
    const randomNum = Math.floor(100 + Math.random() * 900);
    const todayIso = getTodayIso();
    const vencDate = new Date();
    vencDate.setDate(vencDate.getDate() + 15);
    const defaultRate = round2(tasaBcv || tasaKeystone);

    setEditingPayable({
      id: null,
      originalNroDoc: null,
      tipoDoc: 'FACT',
      nroDoc: String(randomNum),
      provNombre: '',
      provRif: '',
      fechaEmisionIso: todayIso,
      fechaVencimientoIso: toIsoDateInput(vencDate),
      diasCredito: 15,
      monedaIngreso: 'US$',
      tasaCambio: String(defaultRate),
      exentoIva: false,
      baseImponibleUsd: '0.00',
      baseImponibleBs: '0.00',
      ivaUsd: '0.00',
      ivaBs: '0.00',
      montoNetUsd: '0.00',
      montoNetBs: '0.00',
      abonosUsd: '0.00',
      abonosBs: '0.00',
      saldoUsd: '0.00',
      saldoBs: '0.00',
      observaciones: ''
    });
  };

  const handleOpenEditPayableModal = (p) => {
    setIsCreatingPayable(false);
    const tipo = String(p.tipoDoc || 'FACT').toUpperCase().trim();
    const isFact = isFiscalInvoiceType(tipo);
    const docRate = Number(p.tasa || 0) > 10 ? round2(p.tasa) : round2(isFact ? tasaBcv : tasaKeystone);
    const monedaIngreso = String(p.moneda || '').toUpperCase().includes('BS') ? 'BS' : 'US$';
    const totalUsd = round2(p.montoNetUsd || 0);
    const totalBs = Number(p.montoNetBs || 0) > 0 && monedaIngreso === 'BS'
      ? round2(p.montoNetBs)
      : round2(totalUsd * docRate);
    const exentoIva = isFact && (Boolean(p.exentoIva) || (p.ivaUsd !== undefined && Number(p.ivaUsd) === 0 && totalUsd > 0));
    const baseUsd = isFact && !exentoIva
      ? (p.baseImponibleUsd !== undefined ? round2(p.baseImponibleUsd) : round2(totalUsd / 1.16))
      : totalUsd;
    const ivaUsd = isFact && !exentoIva
      ? (p.ivaUsd !== undefined ? round2(p.ivaUsd) : round2(totalUsd - baseUsd))
      : 0;
    const baseBs = isFact && !exentoIva
      ? (p.baseImponibleBs !== undefined && monedaIngreso === 'BS' ? round2(p.baseImponibleBs) : round2(baseUsd * docRate))
      : totalBs;
    const ivaBs = isFact && !exentoIva
      ? (p.ivaBs !== undefined && monedaIngreso === 'BS' ? round2(p.ivaBs) : round2(totalBs - baseBs))
      : 0;
    const abonosUsd = round2(p.abonosUsd || 0);
    const abonosBs = round2(abonosUsd * docRate);
    const saldoUsd = round2(Math.max(0, totalUsd - abonosUsd));
    const saldoBs = round2(Math.max(0, totalBs - abonosBs));

    setEditingPayable({
      id: p.id,
      originalNroDoc: p.nroDoc,
      tipoDoc: tipo,
      nroDoc: p.nroDoc,
      provNombre: p.provNombre,
      provRif: p.provRif,
      fechaEmisionIso: p.fechaEmisionIso || getTodayIso(),
      fechaVencimientoIso: p.fechaVencimientoIso || getTodayIso(),
      diasCredito: Number(p.diasCredito || 15),
      monedaIngreso,
      tasaCambio: String(docRate),
      exentoIva,
      baseImponibleUsd: baseUsd.toFixed(2),
      baseImponibleBs: baseBs.toFixed(2),
      ivaUsd: ivaUsd.toFixed(2),
      ivaBs: ivaBs.toFixed(2),
      montoNetUsd: totalUsd.toFixed(2),
      montoNetBs: totalBs.toFixed(2),
      abonosUsd: abonosUsd.toFixed(2),
      abonosBs: abonosBs.toFixed(2),
      saldoUsd: saldoUsd.toFixed(2),
      saldoBs: saldoBs.toFixed(2),
      observaciones: p.observaciones || p.descrip || '',
      historialPagos: p.historialPagos || []
    });
  };

  const handleEditFieldChange = (field, value) => {
    setEditingPayable(prev => {
      if (!prev) return prev;
      let next = { ...prev, [field]: value };

      if (field === 'provNombre') {
        const match = suppliers.find(s => (s.nombre || s.razonSocial || '').toLowerCase() === String(value).toLowerCase());
        if (match && match.rif) {
          next.provRif = match.rif;
        }
      }

      if (field === 'fechaEmisionIso' || field === 'diasCredito') {
        const emisionDate = parseDateSafe(next.fechaEmisionIso);
        const dc = Math.max(0, Number(next.diasCredito || 0));
        const venc = new Date(emisionDate);
        venc.setDate(venc.getDate() + dc);
        next.fechaVencimientoIso = toIsoDateInput(venc);
      }

      if (field === 'fechaVencimientoIso') {
        const emisionDate = parseDateSafe(next.fechaEmisionIso);
        const vencDate = parseDateSafe(next.fechaVencimientoIso);
        const diffCredit = Math.round((vencDate.getTime() - emisionDate.getTime()) / (1000 * 60 * 60 * 24));
        next.diasCredito = Math.max(0, diffCredit);
      }

      const numericOrTaxFields = [
        'tipoDoc', 'exentoIva', 'tasaCambio',
        'baseImponibleUsd', 'baseImponibleBs',
        'ivaUsd', 'ivaBs',
        'montoNetUsd', 'montoNetBs',
        'abonosUsd', 'abonosBs'
      ];
      if (numericOrTaxFields.includes(field)) {
        next = syncPayableAmounts(next, field, value, tasaBcv || tasaKeystone);
      }

      return next;
    });
  };

  const handleSaveEditedPayable = async (e) => {
    e.preventDefault();
    if (!editingPayable) return;

    const nroDoc = String(editingPayable.nroDoc || '').trim();
    if (!nroDoc) {
      notify.warning('El número de documento es obligatorio.');
      return;
    }
    if (!String(editingPayable.provNombre || '').trim()) {
      notify.warning('El Nombre del Proveedor es obligatorio.');
      return;
    }

    const docTasa = Math.max(0.0001, round2(Number(editingPayable.tasaCambio || tasaBcv || tasaKeystone)));
    const isFact = isFiscalInvoiceType(editingPayable.tipoDoc);
    const montoNetUsd = round2(Math.max(0, Number(editingPayable.montoNetUsd || 0)));
    const montoNetBs = editingPayable.monedaIngreso === 'BS' && Number(editingPayable.montoNetBs || 0) > 0
      ? round2(Number(editingPayable.montoNetBs))
      : round2(montoNetUsd * docTasa);
    const abonosUsd = round2(Math.min(montoNetUsd, Math.max(0, Number(editingPayable.abonosUsd || 0))));
    const saldoUsd = round2(Math.max(0, montoNetUsd - abonosUsd));
    const saldoBs = round2(saldoUsd * docTasa);
    const baseImponibleUsd = isFact ? round2(Number(editingPayable.baseImponibleUsd || 0)) : montoNetUsd;
    const baseImponibleBs = isFact ? round2(Number(editingPayable.baseImponibleBs || baseImponibleUsd * docTasa)) : montoNetBs;
    const ivaUsd = isFact && !editingPayable.exentoIva ? round2(Number(editingPayable.ivaUsd || 0)) : 0;
    const ivaBs = isFact && !editingPayable.exentoIva ? round2(Number(editingPayable.ivaBs || ivaUsd * docTasa)) : 0;
    const provRif = String(editingPayable.provRif || 'J-00000000').trim().toUpperCase();

    const payload = {
      id: editingPayable.id || `CXP-${editingPayable.tipoDoc}-${nroDoc}-${provRif.replace(/[^A-Za-z0-9]/g, '')}`,
      tipoDoc: editingPayable.tipoDoc,
      nroDoc,
      coProv: provRif,
      provNombre: String(editingPayable.provNombre || '').trim(),
      provRif,
      fechaEmision: editingPayable.fechaEmisionIso,
      fechaVencimiento: editingPayable.fechaVencimientoIso,
      diasCredito: Number(editingPayable.diasCredito || 0),
      baseImponibleUsd,
      baseImponibleBs,
      ivaUsd,
      ivaBs,
      exentoIva: Boolean(editingPayable.exentoIva),
      montoNetUsd,
      montoNetBs,
      saldoUsd,
      saldoBs,
      abonosUsd,
      tasa: docTasa,
      moneda: editingPayable.monedaIngreso === 'BS' ? 'BS' : 'US$',
      observaciones: editingPayable.observaciones || '',
      historialPagos: editingPayable.historialPagos || []
    };

    const savedAtIso = new Date().toISOString();
    const overridePayload = {
      ...payload,
      fechaSincronizacion: savedAtIso,
      updated_at: savedAtIso,
      _localSavedAt: savedAtIso
    };

    setIsSavingPayable(true);
    try {
      setLocalDocOverrides(prev => {
        const next = { ...prev };
        if (editingPayable.originalNroDoc && editingPayable.originalNroDoc !== nroDoc) {
          next[editingPayable.originalNroDoc] = { _deleted: true };
        }
        next[payload.id] = overridePayload;
        next[nroDoc] = overridePayload;
        return next;
      });

      if (onSaveDocument) {
        await onSaveDocument(payload);
      }

      soundFX.success();
      if (saldoUsd <= 0.01) {
        if (pagoDocKey === payload.id || pagoDocKey === nroDoc) {
          setPagoDocKey('');
          setPagoMontoUsd('');
          setPagoMontoBs('');
        }
        notify.success(`Documento CxP #${nroDoc} marcado como PAGADA y movido a Solventes.`);
      } else {
        notify.success(`Documento CxP #${nroDoc} guardado exitosamente.`);
      }
      setEditingPayable(null);
    } catch (err) {
      console.error('Error guardando documento CxP:', err);
      soundFX.error();
      notify.error('No se pudo guardar el documento: ' + (err.message || 'Error del servidor'));
    } finally {
      setIsSavingPayable(false);
    }
  };

  // ========================================================================
  // Handler de Eliminación de Documento CxP
  // ========================================================================
  const handleDeletePayableRow = async (p) => {
    if (!window.confirm(`¿Está seguro de eliminar el documento ${p.tipoDoc} #${p.nroDoc} de "${p.provNombre}" por ${formatUsd(p.saldoUsd)}? Esta acción no se puede deshacer.`)) {
      return;
    }

    const docKey = String(p.id || p.nroDoc).trim();
    setDeletingKey(docKey);
    try {
      setLocalDocOverrides(prev => ({
        ...prev,
        [docKey]: { _deleted: true },
        [p.nroDoc]: { _deleted: true }
      }));

      if (pagoDocKey === docKey || pagoDocKey === p.nroDoc) {
        setPagoDocKey('');
        setPagoMontoUsd('');
        setPagoMontoBs('');
      }

      if (onDeleteDocument) {
        await onDeleteDocument(p);
      }

      soundFX.success();
      notify.success(`Documento ${p.tipoDoc} #${p.nroDoc} eliminado de Cuentas por Pagar.`);
    } catch (err) {
      console.error('Error al eliminar documento CxP:', err);
      soundFX.error();
      notify.error('Error al eliminar: ' + (err.message || 'Error del servidor'));
    } finally {
      setDeletingKey(null);
    }
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    const headers = [
      'Tipo Doc',
      'Nro Documento',
      'Proveedor',
      'RIF',
      'Fecha Emision',
      'Fecha Vencimiento',
      'Dias Credito',
      'Estatus',
      'Monto Original (USD)',
      'Total Pagado (USD)',
      'Saldo Pendiente (USD)',
      'Saldo Pendiente (Bs.)'
    ];

    const rows = filteredPayables.map(p => [
      `"${p.tipoDoc}"`,
      `"${p.nroDoc}"`,
      `"${p.provNombre.replace(/"/g, '""')}"`,
      `"${p.provRif}"`,
      `"${p.fecEmis}"`,
      `"${p.fecVenc}"`,
      p.diasCredito,
      `"${p.isSolvente ? 'Solvente' : (p.isVencido ? `Vencida ${p.diffDays}d` : `Por Vencer ${Math.abs(p.diffDays)}d`)}"`,
      p.montoNetUsd.toFixed(2),
      p.abonosUsd.toFixed(2),
      p.saldoUsd.toFixed(2),
      p.saldoBs.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cuentas_Por_Pagar_Motorven_${getTodayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.info('Reporte CSV de Cuentas por Pagar descargado.');
  };

  return (
    <section 
      className="accounts-payable-view card printable-document"
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
        background: 'var(--bg-card-header)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(2,132,199,0.15), rgba(16,185,129,0.25))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-blue)'
          }}>
            <Building2 size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              Cuentas por Pagar (CxP) & Proveedores Supabase
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Control de Pasivos y Facturas de Compra • Tasa KEYSTONE: {formatBs(tasaKeystone)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Botón Nueva Cuenta por Pagar */}
          <button
            type="button"
            onClick={handleOpenNewPayableModal}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700
            }}
          >
            <Plus size={16} />
            <span>+ Nueva Cuenta por Pagar</span>
          </button>

          {/* Botón Exportar CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.85rem', fontSize: '0.82rem' }}
            title="Descargar datos en Excel / CSV"
          >
            <Download size={15} />
            <span className="hide-on-mobile">Exportar CSV</span>
          </button>

          {/* Botón Estado de Cuenta Proveedor PDF */}
          <button
            type="button"
            onClick={() => generateThirdPartyStatementPDF({
              entity: {
                nombre: supplierFilter === 'ALL' ? 'Todos los Proveedores (Cartera Filtrada)' : supplierFilter,
                rif: filteredPayables[0]?.rif || ''
              },
              entityType: 'SUPPLIER',
              documents: filteredPayables.map(p => ({
                ...p,
                numeroDoc: p.nroDoc,
                fecha: p.fechaEmision,
                fechaVencimiento: p.fechaVencimiento,
                totalUsd: p.montoTotalUsd,
                restanteUsd: p.saldoUsd
              })),
              config,
              currentUser
            })}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.85rem', fontSize: '0.82rem' }}
            title="Descargar Estado de Cuenta de Proveedor(es) en formato Carta PDF"
          >
            <FileText size={15} />
            <span className="hide-on-mobile">Estado de Cuenta</span>
          </button>

          {/* Botón Imprimir Reporte PDF Oficial */}
          <button
            type="button"
            onClick={handlePrintFilteredReport}
            className="btn btn-print-report"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}
            title="Descargar Reporte Oficial de Cuentas por Pagar en PDF según los filtros activos"
          >
            <Printer size={16} color="#ffffff" />
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      {/* RESUMEN KPIS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        padding: '1.25rem 1.75rem',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-glass)'
      }}>
        {/* Total Cartera por Pagar */}
        <div style={{
          background: 'var(--bg-card-glass)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          borderLeft: '4px solid var(--brand-blue)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Pasivos CxP
            </span>
            <DollarSign size={16} style={{ color: 'var(--brand-blue)' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatUsd(totalCarteraUsd)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {formatBs(totalCarteraBs)}
          </div>
        </div>

        {/* Vencido */}
        <div style={{
          background: 'var(--bg-card-glass)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          borderLeft: '4px solid #ef4444'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Deuda Vencida
            </span>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#dc2626' }}>
            {formatUsd(totalVencidoUsd)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {countStats.vencidos} documentos vencidos
          </div>
        </div>

        {/* Por Vencer */}
        <div style={{
          background: 'var(--bg-card-glass)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          borderLeft: '4px solid #10b981'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Deuda por Vencer
            </span>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669' }}>
            {formatUsd(totalVigenteUsd)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {countStats.alDia} documentos vigentes
          </div>
        </div>

        {/* Proveedores */}
        <div style={{
          background: 'var(--bg-card-glass)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          borderLeft: '4px solid #f59e0b'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Proveedores Acreedores
            </span>
            <Building2 size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {countProveedoresConDeuda}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Total documentos: {processedPayables.length}
          </div>
        </div>
      </div>

      {/* CUERPO PRINCIPAL (PARTE A + PARTE B) */}
      <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ========================================================
            PARTE A: FORMULARIO "PARA REGISTRAR PAGOS A PROVEEDORES"
        ======================================================== */}
        <div 
          ref={parteARef}
          style={{
            background: 'var(--bg-card-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '14px',
            padding: '1.35rem 1.6rem',
            boxShadow: 'var(--shadow-card, 0 8px 24px rgba(0,0,0,0.3))'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border-glass)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)'
              }}>
                Parte A
              </span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Para Registrar Pagos a Proveedores (Amortización y Cancelación de Pasivos)
              </h3>
            </div>

            {selectedPagoDoc && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.4rem 0.9rem',
                borderRadius: '10px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-glass)',
                fontSize: '0.8rem',
                flexWrap: 'wrap'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Doc: <strong style={{ color: 'var(--brand-blue)', fontFamily: 'var(--font-code)' }}>#{selectedPagoDoc.tipoDoc} {selectedPagoDoc.nroDoc}</strong>
                </span>
                <span style={{ color: 'var(--border-glass)' }}>|</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Proveedor: <strong style={{ color: 'var(--text-primary)' }}>{selectedPagoDoc.provNombre}</strong>
                </span>
                <span style={{ color: 'var(--border-glass)' }}>|</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Monto: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>{formatUsd(selectedPagoDoc.montoNetUsd)}</strong>
                </span>
                <span style={{ color: 'var(--border-glass)' }}>|</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Pagado: <strong style={{ color: '#10b981', fontFamily: 'var(--font-code)' }}>{formatUsd(selectedPagoDoc.abonosUsd)}</strong>
                </span>
                <span style={{ color: 'var(--border-glass)' }}>|</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Saldo Pendiente: <strong style={{ color: '#ef4444', fontFamily: 'var(--font-code)' }}>{formatUsd(selectedPagoDoc.saldoUsd)}</strong>
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitPago} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
            {/* Selector de Documento por Pagar */}
            <div style={{ minWidth: '240px', gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Documento por Pagar Asociado *
                </label>
                {pagoDocSearch.trim() && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--brand-blue)', fontFamily: 'var(--font-code)' }}>
                    {searchedPayableDocs.length} de {payableDocsWithBalance.length} encontradas
                  </span>
                )}
              </div>

              {/* Buscador interactivo por Nro Doc, Proveedor o RIF */}
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <input
                  type="text"
                  value={pagoDocSearch}
                  onChange={(e) => setPagoDocSearch(e.target.value)}
                  placeholder="Buscar por N° doc, proveedor o RIF..."
                  className="input-modern"
                  style={{
                    width: '100%',
                    padding: '0.45rem 1.8rem 0.45rem 2.1rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px'
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                {pagoDocSearch && (
                  <button
                    type="button"
                    onClick={() => setPagoDocSearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={pagoDocKey}
                onChange={(e) => handleSelectDocForPago(e.target.value)}
                required
                className="select-modern"
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}
              >
                {searchedPayableDocs.length === 0 ? (
                  <option value="">
                    {payableDocsWithBalance.length === 0
                      ? '— Sin obligaciones pendientes con saldo —'
                      : `— Sin coincidencias para "${pagoDocSearch}" —`}
                  </option>
                ) : (
                  <>
                    <option value="">— Seleccione documento a pagar ({searchedPayableDocs.length} pendientes) —</option>
                    {searchedPayableDocs.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.tipoDoc} #{doc.nroDoc} • {doc.provNombre.slice(0, 24)} • RIF: {doc.provRif} • Saldo: ${doc.saldoUsd.toFixed(2)}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Campo: TASA (Decimal, multimoneda) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Tasa (Bs/USD) *
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                required
                value={pagoTasa}
                onChange={(e) => handleTasaChange(e.target.value)}
                placeholder="Ej. 899.27"
                className="input-modern"
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: '#10b981' }}
              />
            </div>

            {/* Campo: FECHA (Date, default hoy) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Fecha de Pago *
              </label>
              <input
                type="date"
                required
                value={pagoFecha}
                onChange={(e) => setPagoFecha(e.target.value)}
                className="input-modern"
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Campo: CAJA Y BANCOS DE ORIGEN (Efectivo / Transferencia) */}
            <div style={{ minWidth: '220px', gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--brand-blue)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Cuenta Origen (Caja o Banco de Pago) *
              </label>
              <select
                required
                value={pagoCuentaKey}
                onChange={(e) => setPagoCuentaKey(e.target.value)}
                className="select-modern"
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}
              >
                <optgroup label="Cajas Operativas (Efectivo / Custodia)">
                  {catalogCuentas.filter(c => c.accountType === 'CAJA').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Cuentas Bancarias (Transferencias / Liquidación)">
                  {catalogCuentas.filter(c => c.accountType === 'BANCO').map(b => (
                    <option key={b.key} value={b.key}>{b.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Monto Abono en USD */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Monto Pago (USD) *
                </label>
                {selectedPagoDoc && selectedPagoDoc.saldoUsd > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMontoUsdChange(String(selectedPagoDoc.saldoUsd.toFixed(2)))}
                    style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    title="Cargar saldo total pendiente"
                  >
                    Saldo Restante ({formatUsd(selectedPagoDoc.saldoUsd)})
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={pagoMontoUsd}
                onChange={(e) => handleMontoUsdChange(e.target.value)}
                placeholder="0.00"
                className="input-modern"
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Equivalente en Bolívares (Bs.) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Equivalente en Bs.
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pagoMontoBs}
                onChange={(e) => handleMontoBsChange(e.target.value)}
                placeholder="0.00"
                className="input-modern"
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}
              />
            </div>

            {/* N° Referencia / Comprobante */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                N° Referencia / Comprobante (Opcional)
              </label>
              <input
                type="text"
                value={pagoReferencia}
                onChange={(e) => setPagoReferencia(e.target.value)}
                placeholder="Ej. Ref. Transferencia / Pago Móvil / Recibo #1234"
                className="input-modern"
                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}
              />
            </div>

            {/* Botón de Enviar */}
            <div>
              <button
                type="submit"
                disabled={isSavingPago || !selectedPagoDoc}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  cursor: (isSavingPago || !selectedPagoDoc) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSavingPago ? (
                  <>
                    <RefreshCw size={15} className="spin-animation" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Registrar Pago</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {pagoFeedback && (
            <div style={{
              marginTop: '1rem',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: pagoFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: pagoFeedback.type === 'success' ? '#10b981' : '#ef4444',
              border: `1px solid ${pagoFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
            }}>
              {pagoFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{pagoFeedback.message}</span>
            </div>
          )}
        </div>

        {/* ========================================================
            PARTE B: REPORTE DE DOCUMENTOS CXP & ACCIONES
        ======================================================== */}
        <div style={{
          background: 'var(--bg-card-glass)',
          border: '1px solid var(--border-glass)',
          borderRadius: '14px',
          padding: '1.25rem 1.6rem',
          boxShadow: 'var(--shadow-card, 0 8px 24px rgba(0,0,0,0.3))'
        }}>
          {/* Encabezado de Parte B */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
            paddingBottom: '0.85rem',
            borderBottom: '1px solid var(--border-glass)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(2, 132, 199, 0.2)',
                color: 'var(--brand-blue)',
                border: '1px solid rgba(2, 132, 199, 0.4)'
              }}>
                Parte B
              </span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Reporte de Documentos CxP — Facturas y Pasivos de Compra ({filteredPayables.length} documentos listados)
              </h3>
            </div>

            <button
              type="button"
              onClick={handlePrintFilteredReport}
              className="btn btn-print-report"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.9rem', fontSize: '0.8rem', flexShrink: 0 }}
              title={`Imprimir en PDF los ${filteredPayables.length} documento(s) mostrados en la tabla (${activeFiltersLabel})`}
            >
              <Printer size={15} color="#ffffff" />
              <span>Imprimir Reporte ({filteredPayables.length})</span>
            </button>
          </div>

          {/* BARRA DE FILTROS Y PESTAÑAS RÁPIDAS */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            {/* Fila 1: Buscador y Selectores */}
            <div style={{
              display: 'flex',
              gap: '0.85rem',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <div className="search-wrapper" style={{ flex: '1 1 260px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por factura, nota, tipo, proveedor, RIF, doc #..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="input-modern"
                  style={{ width: '100%', paddingLeft: '2.4rem' }}
                />
              </div>

              {/* Selector de Proveedor */}
              <select
                className="filter-select"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                style={{ minWidth: '180px' }}
              >
                <option value="ALL">Todos los Proveedores ({supplierList.length})</option>
                {supplierList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Selector de Tipo de Documento */}
              <select
                className="filter-select"
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                style={{ minWidth: '160px' }}
              >
                <option value="ALL">Todos los Documentos</option>
                {docTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Selector de Estado detallado */}
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: '170px' }}
              >
                <option value="ALL">Todos los Estados ({processedPayables.length})</option>
                <option value="VIGENTE">Solo Por Vencer (Al Día)</option>
                <option value="VENCIDO">Todas las Vencidas</option>
                <option value="SOLVENTE">Solo Solventes (Pagadas)</option>
                <option value="VENCIDO_1_15">Vencidas 1 a 15 días</option>
                <option value="VENCIDO_16_30">Vencidas 16 a 30 días</option>
                <option value="VENCIDO_OVER_30">Vencidas más de 30 días</option>
              </select>
            </div>

            {/* Fila 2: Pestañas Rápidas estilo CxC */}
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: statusFilter === 'ALL' ? '1px solid var(--brand-blue)' : '1px solid var(--border-glass)',
                  background: statusFilter === 'ALL' ? 'rgba(2, 132, 199, 0.2)' : 'var(--bg-surface)',
                  color: statusFilter === 'ALL' ? 'var(--brand-blue)' : 'var(--text-muted)'
                }}
              >
                Todos ({countStats.all})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('VENCIDO')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: statusFilter === 'VENCIDO' ? '1px solid #ef4444' : '1px solid var(--border-glass)',
                  background: statusFilter === 'VENCIDO' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-surface)',
                  color: statusFilter === 'VENCIDO' ? '#ef4444' : 'var(--text-muted)'
                }}
              >
                Vencidos ({countStats.vencidos})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('VIGENTE')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: statusFilter === 'VIGENTE' ? '1px solid #10b981' : '1px solid var(--border-glass)',
                  background: statusFilter === 'VIGENTE' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-surface)',
                  color: statusFilter === 'VIGENTE' ? '#10b981' : 'var(--text-muted)'
                }}
              >
                Al Día / Por Vencer ({countStats.alDia})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('SOLVENTE')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: statusFilter === 'SOLVENTE' ? '1px solid #3b82f6' : '1px solid var(--border-glass)',
                  background: statusFilter === 'SOLVENTE' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-surface)',
                  color: statusFilter === 'SOLVENTE' ? '#3b82f6' : 'var(--text-muted)'
                }}
              >
                Solventes ({countStats.solventes})
              </button>
            </div>
          </div>

          {/* Estilos dedicados para scroll horizontal superior y vertical derecho */}
          <style>{`
            .cxp-top-scrollbar::-webkit-scrollbar {
              height: 9px;
            }
            .cxp-top-scrollbar::-webkit-scrollbar-track {
              background: rgba(15, 23, 42, 0.6);
              border-radius: 6px;
            }
            .cxp-top-scrollbar::-webkit-scrollbar-thumb {
              background: var(--brand-blue, #0284c7);
              border-radius: 6px;
            }
            .cxp-top-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #38bdf8;
            }
            .cxp-hide-bottom-scrollbar::-webkit-scrollbar:horizontal {
              display: none !important;
              height: 0 !important;
            }
            .cxp-table-scroll-container::-webkit-scrollbar:vertical {
              width: 8px;
            }
            .cxp-table-scroll-container::-webkit-scrollbar-track {
              background: rgba(15, 23, 42, 0.6);
              border-radius: 6px;
            }
            .cxp-table-scroll-container::-webkit-scrollbar-thumb {
              background: var(--brand-blue, #0284c7);
              border-radius: 6px;
            }
            .cxp-table-scroll-container::-webkit-scrollbar-thumb:hover {
              background: #38bdf8;
            }
            .cxp-report-table {
              border-collapse: separate !important;
              border-spacing: 0 !important;
            }
            .cxp-report-table thead th {
              position: sticky;
              top: 0;
              z-index: 20;
              background-color: var(--bg-header, #070c18);
              border-bottom: 1px solid var(--border-glass);
              white-space: nowrap;
            }
            .cxp-report-table tbody td {
              border-bottom: 1px solid var(--border-glass);
            }
            .cxp-report-table tfoot td {
              position: sticky;
              bottom: 0;
              z-index: 20;
              background-color: var(--bg-header, #070c18);
              border-top: 2px solid var(--border-glass);
              white-space: nowrap;
            }
          `}</style>

          {/* TABLA DE DOCUMENTOS CXP CON COLUMNA ACCIONES */}
          {filteredPayables.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem', color: '#10b981', opacity: 0.8 }} />
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>No se encontraron obligaciones con los filtros seleccionados.</p>
              <span style={{ fontSize: '0.85rem' }}>Todos los pagos a proveedores están al día según los criterios.</span>
            </div>
          ) : (
            <>
              {/* Barra de desplazamiento horizontal superior sincronizada con la tabla */}
              <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="cxp-top-scrollbar"
                style={{
                  width: '100%',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  height: '11px',
                  marginBottom: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '6px'
                }}
              >
                <div style={{ width: `${tableWidth}px`, height: '1px' }} />
              </div>

              {/* Contenedor de la tabla con scroll vertical derecho y horizontal superior sincronizado */}
              <div
                ref={tableScrollRef}
                onScroll={handleTableScroll}
                className="cxp-table-scroll-container cxp-hide-bottom-scrollbar"
                style={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: '620px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)',
                  position: 'relative'
                }}
              >
                <table
                  ref={tableElRef}
                  className="cxp-report-table"
                  style={{
                    width: '100%',
                    minWidth: '1350px',
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    textAlign: 'left',
                    fontSize: '0.86rem'
                  }}
                >
                  <thead>
                    <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Documento</th>
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Proveedor / RIF</th>
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Emisión</th>
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vencimiento</th>
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Estatus / Vencimiento</th>
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Monto Original</th>
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Abonos</th>
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Saldo Pendiente</th>
                    {/* COLUMNA ACCIONES IDÉNTICA A CUENTAS POR COBRAR */}
                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayables.map((p, idx) => {
                    const isSelectedForPago = pagoDocKey === p.id || pagoDocKey === p.nroDoc;
                    return (
                      <tr
                        key={p.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-glass)',
                          background: isSelectedForPago 
                            ? 'rgba(16, 185, 129, 0.08)' 
                            : (idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)')
                        }}
                      >
                        {/* 1. Documento */}
                        <td style={{ padding: '0.85rem 0.9rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: isFiscalInvoiceType(p.tipoDoc) ? 'rgba(0,43,122,0.14)' : (p.tipoDoc === 'NE' ? 'rgba(245, 158, 11, 0.16)' : 'rgba(100,116,139,0.15)'),
                              color: isFiscalInvoiceType(p.tipoDoc) ? 'var(--brand-blue)' : (p.tipoDoc === 'NE' ? '#d97706' : 'var(--text-secondary)'),
                              fontSize: '0.73rem',
                              fontWeight: 700
                            }}>
                              {p.tipoDoc}
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
                              #{p.nroDoc}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: isFiscalInvoiceType(p.tipoDoc) ? 'var(--brand-blue)' : 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                            {p.tipoDocLabel || getDocTypeLabel(p.tipoDoc)}
                          </div>
                        </td>

                        {/* 2. Proveedor / RIF */}
                        <td style={{ padding: '0.85rem 0.9rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.provNombre}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>{p.provRif}</div>
                        </td>

                        {/* 3. Emisión */}
                        <td style={{ padding: '0.85rem 0.9rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'var(--font-code)' }}>
                          {p.fecEmis}
                        </td>

                        {/* 4. Vencimiento */}
                        <td style={{ padding: '0.85rem 0.9rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'var(--font-code)' }}>
                          {p.fecVenc}
                        </td>

                        {/* 5. Estatus / Vencimiento */}
                        <td style={{ padding: '0.85rem 0.9rem' }}>
                          {p.isSolvente ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#3b82f6'
                            }}>
                              <CheckCircle2 size={12} />
                              Solvente / Pagado
                            </span>
                          ) : p.isVencido ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: p.diffDays > 30 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: p.diffDays > 30 ? '#dc2626' : '#d97706'
                            }}>
                              <Clock size={12} />
                              Vencida hace {p.diffDays}d
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#059669'
                            }}>
                              <CheckCircle2 size={12} />
                              Por Vencer ({Math.abs(p.diffDays)}d)
                            </span>
                          )}
                        </td>

                        {/* 6. Monto Original */}
                        <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                          <div>{formatUsd(p.montoNetUsd)}</div>
                        </td>

                        {/* 7. Abonos Registrados */}
                        <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right', fontWeight: 600, color: '#10b981', fontFamily: 'var(--font-code)' }}>
                          <div>{formatUsd(p.abonosUsd)}</div>
                        </td>

                        {/* 8. Saldo Pendiente */}
                        <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right' }}>
                          <div style={{
                            fontWeight: 700,
                            color: p.isSolvente ? 'var(--brand-blue)' : '#dc2626',
                            fontFamily: 'var(--font-code)',
                            fontSize: '0.9rem'
                          }}>
                            {formatUsd(p.saldoUsd)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            {formatBs(p.saldoBs)}
                          </div>
                        </td>

                        {/* 9. ACCIONES: Pagar + Ver + EDITAR + ELIMINAR (Idéntico a CxC) */}
                        <td style={{ padding: '0.85rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            {/* Botón $ Pagar (adaptación directa de $ Cobrar) */}
                            {p.saldoUsd > 0.01 && (
                              <button
                                type="button"
                                onClick={() => handleSelectDocForPago(p.id)}
                                className="btn"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  borderRadius: '7px',
                                  background: isSelectedForPago ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                                  color: isSelectedForPago ? '#ffffff' : '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.35)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  cursor: 'pointer'
                                }}
                                title="Cargar en Parte A para registrar pago a proveedor"
                              >
                                <DollarSign size={13} />
                                <span>Pagar</span>
                              </button>
                            )}

                            {/* Botón Ver Detalle */}
                            <button
                              type="button"
                              onClick={() => setSelectedPayableDetail(p)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.55rem', borderRadius: '7px' }}
                              title="Ver Detalle y Auditoría"
                            >
                              <Eye size={14} />
                            </button>

                            {/* Botón Editar Documento */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditPayableModal(p)}
                              className="btn"
                              style={{
                                padding: '0.35rem 0.55rem',
                                borderRadius: '7px',
                                background: 'rgba(217, 119, 6, 0.15)',
                                color: '#fbbf24',
                                border: '1px solid rgba(217, 119, 6, 0.35)',
                                cursor: 'pointer'
                              }}
                              title="Editar datos del documento CxP"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Botón Eliminar Documento */}
                            <button
                              type="button"
                              disabled={deletingKey === (p.id || p.nroDoc)}
                              onClick={() => handleDeletePayableRow(p)}
                              className="btn"
                              style={{
                                padding: '0.35rem 0.55rem',
                                borderRadius: '7px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                cursor: 'pointer'
                              }}
                              title="Eliminar documento de Cuenta por Pagar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ background: 'var(--bg-table-header)' }}>
                  <tr>
                    <td colSpan={5} style={{ padding: '0.75rem 0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      TOTALES DEL REPORTE ({filteredPayables.length} DOCUMENTOS):
                    </td>
                    <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}>
                      {formatUsd(filteredPayables.reduce((a, b) => a + b.montoNetUsd, 0))}
                    </td>
                    <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#10b981' }}>
                      {formatUsd(filteredPayables.reduce((a, b) => a + b.abonosUsd, 0))}
                    </td>
                    <td style={{ padding: '0.75rem 0.9rem', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#ef4444' }}>
                      <div>{formatUsd(filteredPayables.reduce((a, b) => a + b.saldoUsd, 0))}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatBs(filteredPayables.reduce((a, b) => a + b.saldoBs, 0))}</div>
                    </td>
                    <td style={{ padding: '0.75rem 0.9rem' }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
        </div>
      </div>

      {/* ========================================================
          MODAL 1: VER DETALLE DEL DOCUMENTO CXP
      ======================================================== */}
      {selectedPayableDetail && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-glass)',
              background: 'var(--bg-card-header)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                    Detalle CxP: {selectedPayableDetail.tipoDoc} #{selectedPayableDetail.nroDoc}
                  </h3>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: isFiscalInvoiceType(selectedPayableDetail.tipoDoc) ? 'rgba(2, 132, 199, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                    color: isFiscalInvoiceType(selectedPayableDetail.tipoDoc) ? '#38bdf8' : '#fbbf24'
                  }}>
                    {selectedPayableDetail.tipoDocLabel || getDocTypeLabel(selectedPayableDetail.tipoDoc)}
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Proveedor: {selectedPayableDetail.provNombre} • RIF: {selectedPayableDetail.provRif}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayableDetail(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.85rem',
                background: 'var(--bg-surface)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
                fontSize: '0.82rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Proveedor:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedPayableDetail.provNombre}</strong>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>{selectedPayableDetail.provRif}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Estado de Pago:</span>
                  <strong style={{ color: selectedPayableDetail.isSolvente ? '#3b82f6' : (selectedPayableDetail.isVencido ? '#ef4444' : '#10b981') }}>
                    {selectedPayableDetail.isSolvente ? 'Solvente / Cancelado' : (selectedPayableDetail.isVencido ? `Vencida hace ${selectedPayableDetail.diffDays}d` : `Por Vencer (${Math.abs(selectedPayableDetail.diffDays)}d)`)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Fecha Emisión:</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>{selectedPayableDetail.fecEmis}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Fecha Vencimiento:</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>{selectedPayableDetail.fecVenc}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Días de Crédito:</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>{selectedPayableDetail.diasCredito} días</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Días de Vencido:</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: selectedPayableDetail.isVencido ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                    {selectedPayableDetail.isVencido ? `${selectedPayableDetail.diffDays} días` : '0 días (Al Día)'}
                  </span>
                </div>
              </div>

              {/* Desglose Financiero */}
              <div style={{
                background: 'var(--bg-surface)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}>
                {isFiscalInvoiceType(selectedPayableDetail.tipoDoc) && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      <span>Base Imponible / Subtotal:</span>
                      <span style={{ fontFamily: 'var(--font-code)' }}>
                        {formatUsd(selectedPayableDetail.baseImponibleUsd)} ({formatBs(round2(selectedPayableDetail.baseImponibleUsd * (selectedPayableDetail.tasa || tasaKeystone)))})
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span>IVA Fiscal (16%):</span>
                      <span style={{ fontFamily: 'var(--font-code)' }}>
                        {formatUsd(selectedPayableDetail.ivaUsd)} ({formatBs(round2(selectedPayableDetail.ivaUsd * (selectedPayableDetail.tasa || tasaKeystone)))})
                      </span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Monto Total Obligación:</span>
                  <span style={{ fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                    {formatUsd(selectedPayableDetail.montoNetUsd)} ({formatBs(selectedPayableDetail.montoNetBs)})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 700 }}>
                  <span>Pagos / Abonos Realizados:</span>
                  <span style={{ fontFamily: 'var(--font-code)' }}>- {formatUsd(selectedPayableDetail.abonosUsd)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: selectedPayableDetail.isSolvente ? 'var(--brand-blue)' : '#ef4444', fontWeight: 800, fontSize: '0.98rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-glass)' }}>
                  <span>Saldo Pendiente por Pagar:</span>
                  <span style={{ fontFamily: 'var(--font-code)' }}>{formatUsd(selectedPayableDetail.saldoUsd)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <span>Equivalente en Bolívares (Tasa {formatBs(selectedPayableDetail.tasa || tasaKeystone)}):</span>
                  <span style={{ fontFamily: 'var(--font-code)' }}>{formatBs(selectedPayableDetail.saldoBs)}</span>
                </div>
              </div>

              {/* Historial de Pagos a Proveedor */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  Historial de Pagos a Proveedor Asociados
                </h4>
                {(!selectedPayableDetail.historialPagos || selectedPayableDetail.historialPagos.length === 0) ? (
                  <div style={{ padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No se registran pagos previos para este documento en la sesión actual.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                          <th style={{ padding: '0.5rem 0.65rem' }}>Fecha</th>
                          <th style={{ padding: '0.5rem 0.65rem' }}>N° Pago / Ref</th>
                          <th style={{ padding: '0.5rem 0.65rem' }}>Cuenta / Origen</th>
                          <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Monto USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPayableDetail.historialPagos.map((hp, hIdx) => (
                          <tr key={hp.id || hIdx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                            <td style={{ padding: '0.5rem 0.65rem', fontFamily: 'var(--font-code)' }}>{hp.fechaPago ? formatDateShort(hp.fechaPago) : 'Hoy'}</td>
                            <td style={{ padding: '0.5rem 0.65rem' }}>{hp.pagoNum || hp.referencia || 'Pago S/N'}</td>
                            <td style={{ padding: '0.5rem 0.65rem' }}>{hp.cuentaNombre || hp.accountType || 'Caja / Banco'}</td>
                            <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-code)' }}>
                              {formatUsd(hp.montoUsd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                {selectedPayableDetail.saldoUsd > 0.01 && (
                  <button
                    type="button"
                    onClick={() => {
                      const doc = selectedPayableDetail;
                      setSelectedPayableDetail(null);
                      handleSelectDocForPago(doc.id);
                    }}
                    className="btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      fontWeight: 700,
                      borderRadius: '8px',
                      padding: '0.5rem 0.85rem'
                    }}
                  >
                    <DollarSign size={14} />
                    <span>Pagar Saldo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const doc = selectedPayableDetail;
                    setSelectedPayableDetail(null);
                    handleOpenEditPayableModal(doc);
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                >
                  <Edit2 size={14} />
                  <span>Editar Documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayableDetail(null)}
                  className="btn btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: CREAR / EDITAR DOCUMENTO DE CUENTA POR PAGAR
      ======================================================== */}
      {editingPayable && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.15rem 1.5rem',
              borderBottom: '1px solid var(--border-glass)',
              background: 'var(--bg-card-header)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <Edit2 size={18} color="#fbbf24" />
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {isCreatingPayable ? 'Nueva Cuenta por Pagar / Documento de Compra' : `Editar Documento CxP: #${editingPayable.nroDoc}`}
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 9px',
                  borderRadius: '999px',
                  background: isFiscalInvoiceType(editingPayable.tipoDoc) ? 'rgba(2, 132, 199, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: isFiscalInvoiceType(editingPayable.tipoDoc) ? '#38bdf8' : '#fbbf24',
                  border: isFiscalInvoiceType(editingPayable.tipoDoc) ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(251, 191, 36, 0.4)'
                }}>
                  {isFiscalInvoiceType(editingPayable.tipoDoc) ? 'FACTURA FISCAL • CON IVA' : `${getDocTypeLabel(editingPayable.tipoDoc).toUpperCase()} • SIN IVA`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingPayable(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedPayable} style={{ padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              {/* Selector Claro: Factura Fiscal vs Nota de Entrega + Otros + N° Doc */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 0.85fr', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Tipo de Documento * (Factura Fiscal o Nota de Entrega)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => handleEditFieldChange('tipoDoc', 'FACT')}
                      style={{
                        padding: '0.5rem 0.65rem',
                        borderRadius: '9px',
                        border: isFiscalInvoiceType(editingPayable.tipoDoc) ? '1.5px solid #38bdf8' : '1px solid var(--border-glass)',
                        background: isFiscalInvoiceType(editingPayable.tipoDoc) ? 'rgba(2, 132, 199, 0.18)' : 'var(--bg-surface)',
                        color: isFiscalInvoiceType(editingPayable.tipoDoc) ? '#38bdf8' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Factura Fiscal (FACT)</div>
                      <div style={{ fontSize: '0.67rem', opacity: 0.85 }}>SENIAT • Desglosa IVA 16%</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditFieldChange('tipoDoc', 'NE')}
                      style={{
                        padding: '0.5rem 0.65rem',
                        borderRadius: '9px',
                        border: editingPayable.tipoDoc === 'NE' ? '1.5px solid #fbbf24' : '1px solid var(--border-glass)',
                        background: editingPayable.tipoDoc === 'NE' ? 'rgba(245, 158, 11, 0.18)' : 'var(--bg-surface)',
                        color: editingPayable.tipoDoc === 'NE' ? '#fbbf24' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Nota de Entrega (NE)</div>
                      <div style={{ fontSize: '0.67rem', opacity: 0.85 }}>Control interno • Sin IVA</div>
                    </button>
                  </div>
                  <select
                    className="select-modern"
                    value={editingPayable.tipoDoc}
                    onChange={(e) => handleEditFieldChange('tipoDoc', e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.7rem', fontSize: '0.78rem' }}
                  >
                    <option value="FACT">FACTURA FISCAL (FACT) — Con IVA</option>
                    <option value="NE">NOTA DE ENTREGA (NE) — Sin IVA</option>
                    <option value="ADEL">ADELANTO / ANTICIPO (ADEL)</option>
                    <option value="N/DB">NOTA DE DÉBITO (N/DB)</option>
                    <option value="OC">ORDEN DE COMPRA (OC)</option>
                  </select>
                </div>

                {/* Número de Documento */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    N° de Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPayable.nroDoc}
                    onChange={(e) => handleEditFieldChange('nroDoc', e.target.value)}
                    placeholder="Ej. 516"
                    className="input-modern"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-code)' }}
                  />
                  <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Documento activo: <strong style={{ color: 'var(--text-primary)' }}>{getDocTypeLabel(editingPayable.tipoDoc)}</strong>
                  </div>
                </div>
              </div>

              {/* Proveedor y RIF */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Nombre del Proveedor *
                  </label>
                  <input
                    type="text"
                    required
                    list="suppliers-datalist"
                    value={editingPayable.provNombre}
                    onChange={(e) => handleEditFieldChange('provNombre', e.target.value)}
                    placeholder="Ej. Keystone, C.A."
                    className="input-modern"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                  />
                  <datalist id="suppliers-datalist">
                    {supplierList.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    RIF del Proveedor *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPayable.provRif}
                    onChange={(e) => handleEditFieldChange('provRif', e.target.value)}
                    placeholder="Ej. J-311153659"
                    className="input-modern"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontFamily: 'var(--font-code)' }}
                  />
                </div>
              </div>

              {/* Fechas y Crédito */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Fecha Emisión *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingPayable.fechaEmisionIso}
                    onChange={(e) => handleEditFieldChange('fechaEmisionIso', e.target.value)}
                    className="input-modern"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Días de Crédito
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingPayable.diasCredito}
                    onChange={(e) => handleEditFieldChange('diasCredito', e.target.value)}
                    className="input-modern"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem', fontFamily: 'var(--font-code)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Fecha Vencimiento *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingPayable.fechaVencimientoIso}
                    onChange={(e) => handleEditFieldChange('fechaVencimientoIso', e.target.value)}
                    className="input-modern"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Tasa de Cambio y Conversión Bidireccional USD <-> Bs */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                padding: '0.95rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      Montos en Divisas ($ USD) y Bolívares (Bs.)
                    </span>
                    <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)' }}>
                      Escriba en cualquiera de las dos monedas para calcular automáticamente su equivalente.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#34d399' }}>Tasa Bs/USD:</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      required
                      value={editingPayable.tasaCambio}
                      onChange={(e) => handleEditFieldChange('tasaCambio', e.target.value)}
                      className="input-modern"
                      style={{ width: '105px', padding: '0.32rem 0.5rem', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: '#34d399' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleEditFieldChange('tasaCambio', String(round2(tasaBcv)))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.35)', background: 'rgba(2, 132, 199, 0.12)', color: '#38bdf8' }}
                    >
                      BCV ({formatBs(tasaBcv)})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditFieldChange('tasaCambio', String(round2(tasaKeystone)))}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(251, 191, 36, 0.35)', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}
                    >
                      KEY ({formatBs(tasaKeystone)})
                    </button>
                  </div>
                </div>

                {/* Desglose Fiscal de IVA solo si es Factura Fiscal (FACT) */}
                {isFiscalInvoiceType(editingPayable.tipoDoc) ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.65rem', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8' }}>
                        Factura Fiscal SENIAT — {editingPayable.exentoIva ? 'Exenta de IVA (0%)' : 'IVA 16% Desglosado'}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.73rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(editingPayable.exentoIva)}
                          onChange={(e) => handleEditFieldChange('exentoIva', e.target.checked)}
                        />
                        <span>Factura Exenta (0% IVA)</span>
                      </label>
                    </div>

                    {/* Base Imponible */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.28rem' }}>
                          Base Imponible / Subtotal ($ USD)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingPayable.baseImponibleUsd}
                          onChange={(e) => handleEditFieldChange('baseImponibleUsd', e.target.value)}
                          className="input-modern"
                          style={{ width: '100%', padding: '0.52rem 0.7rem', fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-code)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.28rem' }}>
                          Base Imponible / Subtotal (Bs.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingPayable.baseImponibleBs}
                          onChange={(e) => handleEditFieldChange('baseImponibleBs', e.target.value)}
                          className="input-modern"
                          style={{ width: '100%', padding: '0.52rem 0.7rem', fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-code)' }}
                        />
                      </div>
                    </div>

                    {/* Monto del IVA (16%) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: editingPayable.exentoIva ? '#10b981' : '#38bdf8', marginBottom: '0.28rem' }}>
                          Monto IVA 16% ($ USD)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={Boolean(editingPayable.exentoIva)}
                          value={editingPayable.ivaUsd}
                          onChange={(e) => handleEditFieldChange('ivaUsd', e.target.value)}
                          className="input-modern"
                          style={{ width: '100%', padding: '0.52rem 0.7rem', fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: editingPayable.exentoIva ? '#10b981' : '#38bdf8' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: editingPayable.exentoIva ? '#10b981' : '#38bdf8', marginBottom: '0.28rem' }}>
                          Monto IVA 16% (Bs.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={Boolean(editingPayable.exentoIva)}
                          value={editingPayable.ivaBs}
                          onChange={(e) => handleEditFieldChange('ivaBs', e.target.value)}
                          className="input-modern"
                          style={{ width: '100%', padding: '0.52rem 0.7rem', fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: editingPayable.exentoIva ? '#10b981' : '#38bdf8' }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '0.45rem 0.7rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(251, 191, 36, 0.28)', fontSize: '0.74rem', fontWeight: 700, color: '#fbbf24' }}>
                    {getDocTypeLabel(editingPayable.tipoDoc)} — Documento Exento de IVA (No genera Crédito Fiscal)
                  </div>
                )}

                {/* Total Factura / Monto Original en USD y Bs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.28rem' }}>
                      {isFiscalInvoiceType(editingPayable.tipoDoc) ? 'Total Factura con IVA ($ USD) *' : 'Monto Original ($ USD) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editingPayable.montoNetUsd}
                      onChange={(e) => handleEditFieldChange('montoNetUsd', e.target.value)}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.55rem 0.7rem', fontSize: '0.88rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.45)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.28rem' }}>
                      {isFiscalInvoiceType(editingPayable.tipoDoc) ? 'Total Factura con IVA (Bs.) *' : 'Monto Original (Bs.) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editingPayable.montoNetBs}
                      onChange={(e) => handleEditFieldChange('montoNetBs', e.target.value)}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.55rem 0.7rem', fontSize: '0.88rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.45)' }}
                    />
                  </div>
                </div>

                {/* Abonos y Saldo Pendiente en Ambas Monedas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#10b981', marginBottom: '0.28rem' }}>
                      Pagado / Abonos ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingPayable.abonosUsd}
                      onChange={(e) => handleEditFieldChange('abonosUsd', e.target.value)}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.83rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: '#10b981' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#10b981', marginBottom: '0.28rem' }}>
                      Pagado / Abonos (Bs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingPayable.abonosBs}
                      onChange={(e) => handleEditFieldChange('abonosBs', e.target.value)}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.83rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: '#10b981' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.28rem' }}>
                      Saldo Pendiente (USD / Bs)
                    </label>
                    <div style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      fontFamily: 'var(--font-code)',
                      lineHeight: 1.25
                    }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ef4444' }}>
                        {formatUsd(Number(editingPayable.saldoUsd || 0))}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formatBs(Number(editingPayable.saldoBs || 0))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banda de equivalencia multimoneda */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid var(--border-glass)',
                  fontSize: '0.72rem'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Moneda de ingreso: <strong style={{ color: editingPayable.monedaIngreso === 'BS' ? '#38bdf8' : '#34d399' }}>
                      {editingPayable.monedaIngreso === 'BS' ? 'Bolívares (Bs.)' : 'Divisas ($ USD)'}
                    </strong>
                  </span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    Equivalente Total: {formatUsd(Number(editingPayable.montoNetUsd || 0))} ⇄ {formatBs(Number(editingPayable.montoNetBs || 0))}
                    {isFiscalInvoiceType(editingPayable.tipoDoc) && ` • IVA: ${formatUsd(Number(editingPayable.ivaUsd || 0))} / ${formatBs(Number(editingPayable.ivaBs || 0))}`}
                  </span>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Observaciones / Notas
                </label>
                <input
                  type="text"
                  value={editingPayable.observaciones}
                  onChange={(e) => handleEditFieldChange('observaciones', e.target.value)}
                  placeholder="Detalles sobre la factura o condiciones de pago"
                  className="input-modern"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingPayable(null)}
                  className="btn btn-secondary"
                  disabled={isSavingPayable}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPayable}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.6rem 1.25rem',
                    fontWeight: 700
                  }}
                >
                  {isSavingPayable ? (
                    <>
                      <RefreshCw size={15} className="spin-animation" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Guardar Documento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
