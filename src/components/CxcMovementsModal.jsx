import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Printer,
  Calendar,
  Search,
  Hash,
  RotateCcw,
  Check,
  Receipt,
  DollarSign,
  Filter,
  ChevronUp,
  Layers,
  Edit2
} from 'lucide-react';
import { formatUsd, formatBs, formatNumberUs, round2 } from '../services/formatService';
import {
  getNextCxcMovementCorrelativo,
  commitCxcMovementCorrelativo,
  setCxcMovementCorrelativo,
  clearCxcMovementCorrelativoForce,
  getCxcMovementReportCorrelativo,
  setCxcMovementReportCorrelativo,
  commitCxcMovementReportCorrelativo
} from '../services/fiscalService';
import { saveSupabaseProfitCollection, fetchEuroRateDetails } from '../services/supabaseService';
import { REAL_PROFIT_SELLERS } from '../data/supabaseRealData';
import { resolveExchangeRates } from '../utils/treasuryAccountUtils';
import {
  CXC_RATE_ORDER,
  CXC_RATE_BUCKETS,
  normalizeCxcRateType,
  classifyCollectionRateType,
  groupMovementsByRateType,
  summarizeDailyMovementsByCaja
} from '../utils/cxcUtils';
import {
  isDirectCurrencyRateType,
  inferDirectCurrencyFromAccountOrMethod
} from '../utils/rateClassificationUtils';
import { generateCollectionReceiptPDF, generateCreditDebitNotePDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

const getTodayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toIsoDateOnly = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    // Si es fecha pura o medianoche UTC (Profit Plus), conservar la fecha calendario sin desplazamiento
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(s)) {
      return s.slice(0, 10);
    }
    const dmyMatch = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    const parsedTs = new Date(s);
    if (!isNaN(parsedTs.getTime())) {
      const y = parsedTs.getFullYear();
      const m = String(parsedTs.getMonth() + 1).padStart(2, '0');
      const day = String(parsedTs.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateShort = (dateStr) => {
  const iso = toIsoDateOnly(dateStr);
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const formatDateLongEs = (isoDate) => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || 'Sin fecha';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `${weekdays[dt.getDay()]}, ${String(d).padStart(2, '0')} de ${months[m - 1]} de ${y}`;
};

const extractDisplayTime = (rawDate) => {
  if (!rawDate || typeof rawDate !== 'string') return '';
  const trimmed = rawDate.trim();
  if (!trimmed.includes('T') && !trimmed.includes(' ')) return '';
  if (/T00:00:00(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(trimmed)) return '';
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const canonicalDocKey = (rawNum, tipoDoc = 'FACTURA') => {
  const clean = String(rawNum || '').trim().toUpperCase();
  if (!clean) return '';
  const isNe =
    String(tipoDoc || '').toUpperCase().includes('NOTA_ENTREGA') ||
    String(tipoDoc || '').toUpperCase() === 'N/E' ||
    String(tipoDoc || '').toUpperCase() === 'NE' ||
    clean.startsWith('NE');
  const numPart = clean.replace(/^(FAC-|FACT-|NE-|NDE-|NE|N\/E)/i, '').replace(/^0+(?=\d)/, '');
  return `${isNe ? 'NE' : 'FAC'}:${numPart}`;
};

const normalizeCorrelativoDisplay = (rawCode) => {
  const s = String(rawCode ?? '').trim();
  if (!s) return 'S/N';
  const digits = s.replace(/[^0-9]/g, '');
  if (digits && digits.length <= 6) {
    return digits.padStart(6, '0');
  }
  return s;
};

const resolvePaymentMethodLabel = (rawMethod, accountType) => {
  const m = String(rawMethod || '').toUpperCase().trim();
  if (m === 'EFEC' || m === 'EFECTIVO' || m === 'EFECTIVO_USD' || m === 'EFECTIVO_BS') return 'EFECTIVO';
  if (m === 'TRANS' || m === 'TRANSFERENCIA' || m === 'TRANSFERENCIA_BS' || m === 'DEPO') return m === 'DEPO' ? 'DEPÓSITO' : 'TRANSFERENCIA';
  if (m === 'PAGO_MOVIL' || m === 'PM') return 'PAGO MÓVIL';
  if (m === 'ZELLE') return 'ZELLE';
  if (m === 'USDT') return 'USDT';
  if (m === 'CHEQUE' || m === 'CHEQ') return 'CHEQUE';
  if (m) return m;
  return accountType === 'CAJA' ? 'EFECTIVO' : 'TRANSFERENCIA';
};

/**
 * Normaliza un registro de `profit_collections` (tanto de Profit histórico como del sistema actual).
 */
const resolveCollectionAmounts = (col, fallbackTasa = 827.73) => {
  const rawUsd = Number(col?.montoUsd ?? col?.monto_usd ?? 0) || 0;
  const rawBs = Number(col?.montoBs ?? col?.monto_bs ?? 0) || 0;
  const cTasa = Number(col?.tasa || 0);
  const effectiveTasa = cTasa > 10 ? cTasa : (Number(fallbackTasa) > 1 ? Number(fallbackTasa) : 827.73);

  let usdVal = rawUsd;
  let bsVal = rawBs;
  if (cTasa > 10 && rawBs > 0 && Math.abs((rawUsd * cTasa) - rawBs) <= Math.max(2, rawBs * 0.05)) {
    usdVal = rawUsd;
    bsVal = rawBs;
  } else if (cTasa > 10 && rawUsd > 0 && (Math.abs(rawUsd - rawBs) < 1 || rawBs === 0)) {
    usdVal = round2(rawUsd / cTasa);
    bsVal = rawBs > 0 ? rawBs : rawUsd;
  } else if (rawUsd <= 0 && rawBs > 0 && effectiveTasa > 0) {
    usdVal = round2(rawBs / effectiveTasa);
    bsVal = rawBs;
  } else if (usdVal > 0 && bsVal <= 0 && effectiveTasa > 0) {
    bsVal = round2(usdVal * effectiveTasa);
  }
  return {
    tasa: effectiveTasa,
    usdVal: round2(usdVal),
    bsVal: round2(bsVal)
  };
};

/**
 * Consolida y deduplica los movimientos de cobro provenientes de `historialCobros` de documentos y `profit_collections`.
 */
const buildInvoiceMovementsList = ({
  documents = [],
  collections = [],
  fallbackTasa = 827.73
}) => {
  const docByNum = new Map();
  const docByCanon = new Map();

  (documents || []).forEach((doc) => {
    if (!doc) return;
    const fNum = String(doc.factNum || doc.factura || doc.numeroDoc || '').trim();
    if (!fNum) return;
    docByNum.set(fNum, doc);
    docByCanon.set(canonicalDocKey(fNum, doc.tipoDoc), doc);
    docByCanon.set(canonicalDocKey(fNum, 'FACTURA'), docByCanon.get(canonicalDocKey(fNum, 'FACTURA')) || doc);
  });

  const rows = [];
  const seenKeys = new Set();

  const pushUniqueMovement = (entry) => {
    if (!entry || Number(entry.montoUsd || 0) <= 0) return;
    const corrDigits = String(entry.correlativo || '').replace(/[^0-9]/g, '');
    const canon = canonicalDocKey(entry.factNum, entry.tipoDoc);
    const sig = `${corrDigits || entry.rawId}|${canon}|${entry.fechaIso}|${round2(entry.montoUsd).toFixed(2)}`;
    if (seenKeys.has(sig)) return;
    seenKeys.add(sig);
    rows.push(entry);
  };

  // 1. Movimientos guardados en historialCobros de cada documento (prioridad por detalle completo)
  (documents || []).forEach((doc) => {
    if (!doc || !Array.isArray(doc.historialCobros)) return;
    doc.historialCobros.forEach((h, idx) => {
      if (!h || h.anulado) return;
      const tasaVal = Number(h.tasa || doc.tasa || fallbackTasa) || fallbackTasa;
      const montoUsd = round2(h.montoUsd ?? (Number(h.montoBs || 0) > 0 && tasaVal > 0 ? Number(h.montoBs) / tasaVal : 0));
      const montoBs = round2(h.montoBs ?? (montoUsd * tasaVal));
      const fechaRaw = h.fecha || doc.fechaEmision || doc.fechaEmisionIso || getTodayIso();
      const fechaIso = toIsoDateOnly(fechaRaw) || getTodayIso();
      const rawCorr = h.correlativo ?? h.cobNum ?? '';
      const tipoDoc = h.tipoDoc || doc.tipoDoc || 'FACTURA';
      const factNum = String(h.factNum || doc.factNum || doc.factura || '').trim();
      const cuentaNombre = h.cuentaNombre || h.cuentaDestino || h.cuentaId || 'Caja / Banco';

      pushUniqueMovement({
        id: h.id || `hist-${factNum}-${rawCorr || idx}-${fechaIso}`,
        rawId: h.id || `${factNum}-${idx}`,
        histId: h.id || null,
        collectionId: h.collectionId || null,
        correlativo: normalizeCorrelativoDisplay(rawCorr),
        correlativoNum: parseInt(String(rawCorr).replace(/[^0-9]/g, ''), 10) || 0,
        fechaRaw,
        fechaIso,
        fechaDisplay: formatDateShort(fechaIso),
        horaDisplay: extractDisplayTime(fechaRaw),
        factNum,
        tipoDoc,
        clienteId: doc.clienteId || '',
        clienteNombre: doc.cliente || doc.clienteNombre || 'Cliente General',
        clienteRif: doc.rif || doc.clienteRif || '',
        vendedorId: String(h.cobradorId || h.vendedorId || h.vendedor_id || doc.vendedorId || 'OF').trim(),
        vendedorNombre: String(h.cobradorNombre || h.vendedorNombre || doc.vendedorNombre || '').trim(),
        formaPago: resolvePaymentMethodLabel(h.formaPago, h.accountType),
        cuentaId: h.cuentaId || '',
        cuentaNombre,
        accountType: h.accountType || 'BANCO',
        referencia: String(h.referencia || '').trim(),
        observaciones: String(h.observaciones || h.descrip || '').trim(),
        tasa: tasaVal,
        tipoTasa: normalizeCxcRateType(h.tipoTasa || h.tipo_tasa),
        monedaPago: h.monedaPago || h.moneda_pago || h.moneda || '',
        montoUsd,
        montoBs,
        montoFacturaUsd: Number(doc.montoFacturaUsd || 0),
        restanteDocUsd: Number(doc.restanteUsd || 0),
        source: 'DOC_HISTORIAL'
      });
    });
  });

  // 2. Movimientos globales desde profit_collections
  (collections || []).forEach((c, cIdx) => {
    if (!c || c.anulado) return;
    const fechaRaw = c.fecha || c.fec_cob || c.fechaCobro || c.fechaSincronizacion || '';
    const fechaIso = toIsoDateOnly(fechaRaw);
    if (!fechaIso) return;

    const { tasa: tasaVal, usdVal: totalColUsd, bsVal: totalColBs } = resolveCollectionAmounts(c, fallbackTasa);
    if (totalColUsd <= 0) return;

    const formas = Array.isArray(c.formasPago) ? c.formasPago : [];
    const fp0 = formas[0] || {};
    const inferredAccType = fp0.codCta ? 'BANCO' : (fp0.codCaja ? 'CAJA' : (String(c.cuentaId || '').includes('cta') ? 'BANCO' : 'CAJA'));
    const formaLabel = resolvePaymentMethodLabel(fp0.formaPago || fp0.tipo || c.formaPago, inferredAccType);
    const referencia = String(fp0.referencia || c.referencia || '').trim();
    const cuentaNombre = String(
      c.cuentaNombre ||
      fp0.banco ||
      (fp0.codCaja ? `Caja ${fp0.codCaja}` : '') ||
      (fp0.codCta ? `Cuenta ${fp0.codCta}` : '') ||
      c.cuentaId ||
      'Tesorería'
    ).trim();

    const rawCorr = c.correlativo ?? c.cobNum ?? c.cob_num ?? '';
    const corrFormatted = normalizeCorrelativoDisplay(rawCorr);
    const corrNumeric = parseInt(String(rawCorr).replace(/[^0-9]/g, ''), 10) || 0;

    const docsAfectados = Array.isArray(c.documentosAfectados) && c.documentosAfectados.length > 0
      ? c.documentosAfectados
      : null;

    if (docsAfectados) {
      const totalWeights = docsAfectados.reduce((acc, d) => {
        const w = Number(d?.montoCobradoUsd || 0) > 0
          ? Number(d.montoCobradoUsd)
          : Number(d?.montoCobrado || 0);
        return acc + (w > 0 ? w : 0);
      }, 0);

      docsAfectados.forEach((aff, aIdx) => {
        const rawDocNum = String(aff?.numDoc || '').trim();
        const affDocTypeUpper = String(aff?.tipoDoc || '').toUpperCase().trim();
        const affType =
          affDocTypeUpper.includes('N/E') ||
          affDocTypeUpper === 'NE' ||
          affDocTypeUpper.includes('NOTA_ENTREGA') ||
          affDocTypeUpper.includes('NOTA') ||
          rawDocNum.toUpperCase().startsWith('NE-')
            ? 'NOTA_ENTREGA'
            : 'FACTURA';
        const matchedDoc = docByNum.get(rawDocNum) || docByCanon.get(canonicalDocKey(rawDocNum, affType));

        let itemUsd = Number(aff?.montoCobradoUsd || 0);
        if (itemUsd <= 0) {
          if (docsAfectados.length === 1) {
            itemUsd = totalColUsd;
          } else {
            const w = Number(aff?.montoCobrado || 0);
            itemUsd = totalWeights > 0 ? round2((w / totalWeights) * totalColUsd) : round2(totalColUsd / docsAfectados.length);
          }
        }
        const itemBs = docsAfectados.length === 1
          ? totalColBs
          : round2(itemUsd * tasaVal);

        pushUniqueMovement({
          id: `${c.id || `col-${cIdx}`}-${rawDocNum || aIdx}`,
          rawId: `${c.id || cIdx}-${aIdx}`,
          collectionId: c.id || null,
          affectedDocsCount: docsAfectados.length,
          correlativo: corrFormatted,
          correlativoNum: corrNumeric,
          fechaRaw,
          fechaIso,
          fechaDisplay: formatDateShort(fechaIso),
          horaDisplay: extractDisplayTime(fechaRaw),
          factNum: matchedDoc?.factNum || rawDocNum || 'S/N',
          tipoDoc: matchedDoc?.tipoDoc || affType,
          clienteId: matchedDoc?.clienteId || c.clienteId || '',
          clienteNombre: matchedDoc?.cliente || c.clienteNombre || 'Cliente General',
          clienteRif: matchedDoc?.rif || c.clienteRif || '',
          vendedorId: String(c.cobradorId || c.vendedorId || c.vendedor_id || matchedDoc?.vendedorId || 'OF').trim(),
          vendedorNombre: String(c.cobradorNombre || c.vendedorNombre || matchedDoc?.vendedorNombre || '').trim(),
          formaPago: formaLabel,
          cuentaId: c.cuentaId || fp0.codCta || fp0.codCaja || '',
          cuentaNombre,
          accountType: inferredAccType,
          referencia,
          observaciones: String(c.descrip || '').trim(),
          tasa: tasaVal,
          tipoTasa: normalizeCxcRateType(c.tipoTasa || c.tipo_tasa || fp0.tipoTasa),
          monedaPago: c.monedaPago || c.moneda_pago || fp0.moneda || '',
          montoUsd: round2(itemUsd),
          montoBs: round2(itemBs),
          montoFacturaUsd: Number(matchedDoc?.montoFacturaUsd || 0),
          restanteDocUsd: Number(matchedDoc?.restanteUsd || 0),
          source: 'PROFIT_COLLECTION'
        });
      });
    } else {
      const inferredFallbackTipo = /NOTA\s+DE\s+ENTREGA|NOTA_ENTREGA|\bN\/E\b|\bNE-\d+/i.test(String(c.descrip || ''))
        ? 'NOTA_ENTREGA'
        : 'FACTURA';
      pushUniqueMovement({
        id: String(c.id || `col-${cIdx}`),
        rawId: String(c.id || cIdx),
        collectionId: c.id || null,
        affectedDocsCount: 0,
        correlativo: corrFormatted,
        correlativoNum: corrNumeric,
        fechaRaw,
        fechaIso,
        fechaDisplay: formatDateShort(fechaIso),
        horaDisplay: extractDisplayTime(fechaRaw),
        factNum: 'GENERAL',
        tipoDoc: inferredFallbackTipo,
        clienteId: c.clienteId || '',
        clienteNombre: c.clienteNombre || 'Cliente General',
        clienteRif: c.clienteRif || '',
        vendedorId: String(c.cobradorId || c.vendedorId || c.vendedor_id || 'OF').trim(),
        vendedorNombre: String(c.cobradorNombre || c.vendedorNombre || '').trim(),
        formaPago: formaLabel,
        cuentaId: c.cuentaId || fp0.codCta || fp0.codCaja || '',
        cuentaNombre,
        accountType: inferredAccType,
        referencia,
        observaciones: String(c.descrip || '').trim(),
        tasa: tasaVal,
        tipoTasa: normalizeCxcRateType(c.tipoTasa || c.tipo_tasa || fp0.tipoTasa),
        monedaPago: c.monedaPago || c.moneda_pago || fp0.moneda || '',
        montoUsd: totalColUsd,
        montoBs: totalColBs,
        montoFacturaUsd: 0,
        restanteDocUsd: 0,
        source: 'PROFIT_COLLECTION'
      });
    }
  });

  rows.sort((a, b) => {
    if (a.fechaIso !== b.fechaIso) return b.fechaIso.localeCompare(a.fechaIso);
    if (b.correlativoNum !== a.correlativoNum) return b.correlativoNum - a.correlativoNum;
    return String(b.fechaRaw || '').localeCompare(String(a.fechaRaw || ''));
  });

  return rows;
};

export function CxcMovementsModal({
  isOpen = false,
  onClose,
  documents = [],
  collections = [],
  catalogCuentas = [],
  sellers = [],
  config = {},
  tasaBcv = 827.73,
  currentUser = null,
  initialDocument = null,
  onRegisterCollection,
  onSaveDocument,
  onUpdateCollection,
  onUpdateLocalDoc
}) {
  let notify = { success: () => {}, error: () => {}, warning: () => {}, info: () => {} };
  try {
    const hook = useNotification();
    if (hook) notify = hook;
  } catch (_) {}

  // Catálogo unificado de cobradores / vendedores para el dropdown de edición
  const { sellerCatalogOptions, sellerNameByCode } = useMemo(() => {
    const byCode = new Map();
    const pool = [
      ...(Array.isArray(sellers) ? sellers : []),
      ...(Array.isArray(config?.profitSellers) ? config.profitSellers : []),
      ...(Array.isArray(REAL_PROFIT_SELLERS) ? REAL_PROFIT_SELLERS : [])
    ];
    pool.forEach((s) => {
      if (!s) return;
      const code = String(s.coVen || s.co_ven || s.id || '').trim().toUpperCase();
      const name = String(s.venDes || s.ven_des || s.nombre || s.name || '').trim();
      if (!code || !name) return;
      if (!byCode.has(code)) {
        byCode.set(code, { code, name });
      }
    });
    if (!byCode.has('OF')) {
      byCode.set('OF', { code: 'OF', name: 'Oficina Principal' });
    }
    (documents || []).forEach((d) => {
      const code = String(d?.vendedorId || '').trim().toUpperCase();
      const name = String(d?.vendedorNombre || '').trim();
      if (code && name && !byCode.has(code)) {
        byCode.set(code, { code, name });
      }
    });
    (collections || []).forEach((c) => {
      const code = String(c?.cobradorId || c?.vendedorId || '').trim().toUpperCase();
      const name = String(c?.cobradorNombre || c?.vendedorNombre || '').trim();
      if (code && name && !byCode.has(code)) {
        byCode.set(code, { code, name });
      }
    });
    const list = Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const nameMap = new Map(list.map((item) => [item.code, item.name]));
    return { sellerCatalogOptions: list, sellerNameByCode: nameMap };
  }, [sellers, config?.profitSellers, documents, collections]);

  // Tasas operativas de referencia (BCV, Euro, Keystone)
  const effectiveTasaBcv = useMemo(
    () => (Number(tasaBcv || config?.tasaDolar || 0) > 1 ? Number(tasaBcv || config?.tasaDolar) : 827.73),
    [tasaBcv, config?.tasaDolar]
  );
  const [liveEuroRate, setLiveEuroRate] = useState(
    () => (Number(config?.tasaEuro || config?.tasa_euro || 0) > 1 ? Number(config?.tasaEuro || config?.tasa_euro) : 963.21)
  );
  const effectiveTasaKeystone = useMemo(
    () => resolveExchangeRates({ ...(config || {}), tasaDolar: effectiveTasaBcv }).tasaKeystone,
    [config, effectiveTasaBcv]
  );
  const rateRefMap = useMemo(
    () => ({
      tasaBcv: effectiveTasaBcv,
      tasaEuro: liveEuroRate,
      tasaKeystone: effectiveTasaKeystone
    }),
    [effectiveTasaBcv, liveEuroRate, effectiveTasaKeystone]
  );

  // Filtros
  const [selectedDay, setSelectedDay] = useState(initialDocument ? 'ALL' : getTodayIso());
  const [focusedFactNum, setFocusedFactNum] = useState(initialDocument?.factNum || '');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL'); // 'ALL' | 'FACTURA' | 'NOTA_ENTREGA'
  const [rateTypeFilter, setRateTypeFilter] = useState('ALL'); // 'ALL' | 'BCV' | 'EURO' | 'KEYSTONE' | 'PERSONALIZADA'
  const [searchQuery, setSearchQuery] = useState('');

  // Correlativos (Movimientos & Reporte Impreso + Edición manual por fila)
  const [correlativoRefreshKey, setCorrelativoRefreshKey] = useState(0);
  const [showCorrelativoModal, setShowCorrelativoModal] = useState(false);
  const [manualMovInput, setManualMovInput] = useState('');
  const [manualReportInput, setManualReportInput] = useState('');
  const [autoIncrementReportOnPrint, setAutoIncrementReportOnPrint] = useState(false);
  const [editingMovementCorr, setEditingMovementCorr] = useState(null);
  const [editMovCorrInput, setEditMovCorrInput] = useState('');
  const [editMovFechaInput, setEditMovFechaInput] = useState('');
  const [editMovCobradorId, setEditMovCobradorId] = useState('');
  const [isSavingEditMovCorr, setIsSavingEditMovCorr] = useState(false);

  // Formulario para insertar nuevo movimiento / abono directamente desde el modal
  const [showInsertPanel, setShowInsertPanel] = useState(true);
  const [insertDocKey, setInsertDocKey] = useState(initialDocument?.factNum || '');
  const [insertDocSearch, setInsertDocSearch] = useState('');
  const [insertCorrelativo, setInsertCorrelativo] = useState('');
  const [insertFecha, setInsertFecha] = useState(getTodayIso());
  const [insertTipoTasa, setInsertTipoTasa] = useState('BCV');
  const [insertTasa, setInsertTasa] = useState(String(effectiveTasaBcv));
  const [insertFormaPago, setInsertFormaPago] = useState('TRANSFERENCIA');
  const [insertCuentaKey, setInsertCuentaKey] = useState('');
  const [insertMontoUsd, setInsertMontoUsd] = useState('');
  const [insertMontoBs, setInsertMontoBs] = useState('');
  const [insertReferencia, setInsertReferencia] = useState('');
  const [insertObservaciones, setInsertObservaciones] = useState('');
  const [isSavingMovement, setIsSavingMovement] = useState(false);

  const nextMovCorrelativo = useMemo(
    () => (correlativoRefreshKey >= 0 ? getNextCxcMovementCorrelativo(collections, documents) : '000001'),
    [collections, documents, correlativoRefreshKey]
  );

  const currentReportCorrelativo = useMemo(
    () => (correlativoRefreshKey >= 0 ? getCxcMovementReportCorrelativo() : '000001'),
    [correlativoRefreshKey]
  );

  const wasOpenRef = useRef(false);
  const lastInitialDocRef = useRef(null);

  // Obtener tasa Euro BCV actualizada al abrir el modal
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    fetchEuroRateDetails()
      .then((res) => {
        if (active && res && Number(res.rate) > 10) {
          setLiveEuroRate(Number(res.rate));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Sincronizar estado únicamente al abrir el modal o cambiar la factura enfocada
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      lastInitialDocRef.current = null;
      return;
    }
    const targetFactNum = initialDocument?.factNum ? String(initialDocument.factNum) : '';
    const justOpened = !wasOpenRef.current;
    const initialDocChanged = lastInitialDocRef.current !== targetFactNum;

    if (!justOpened && !initialDocChanged) return;
    wasOpenRef.current = true;
    lastInitialDocRef.current = targetFactNum;

    const rate = round2(effectiveTasaBcv);
    setInsertTipoTasa('BCV');
    setInsertTasa(rate.toFixed(2));
    setInsertFecha(getTodayIso());
    setInsertCorrelativo(getNextCxcMovementCorrelativo(collections, documents));

    if (targetFactNum) {
      setFocusedFactNum(targetFactNum);
      setInsertDocKey(targetFactNum);
      setSelectedDay('ALL');
      setShowInsertPanel(true);
      const rest = round2(initialDocument.restanteUsd || 0);
      if (rest > 0.01) {
        setInsertMontoUsd(rest.toFixed(2));
        setInsertMontoBs(round2(rest * rate).toFixed(2));
      } else {
        setInsertMontoUsd('');
        setInsertMontoBs('');
      }
    } else {
      setFocusedFactNum('');
      setInsertDocKey('');
      setInsertDocSearch('');
      setSearchQuery('');
      setRateTypeFilter('ALL');
      setSelectedDay(getTodayIso());
      setInsertMontoUsd('');
      setInsertMontoBs('');
    }
  }, [isOpen, initialDocument, effectiveTasaBcv, collections, documents]);

  // Incrementar correlativo del reporte tras imprimir (cubre botón Imprimir y atajo nativo Ctrl + P)
  useEffect(() => {
    if (!isOpen || !autoIncrementReportOnPrint) return;
    const handleAfterPrint = () => {
      commitCxcMovementReportCorrelativo(currentReportCorrelativo);
      setCorrelativoRefreshKey(k => k + 1);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [isOpen, autoIncrementReportOnPrint, currentReportCorrelativo]);

  // Mantener actualizado el input correlativo al registrar un movimiento
  useEffect(() => {
    setInsertCorrelativo(nextMovCorrelativo);
  }, [nextMovCorrelativo]);

  // Default cuenta destino cuando cargue el catálogo
  useEffect(() => {
    if (!insertCuentaKey && Array.isArray(catalogCuentas) && catalogCuentas.length > 0) {
      setInsertCuentaKey(catalogCuentas[0].key);
    }
  }, [catalogCuentas, insertCuentaKey]);

  // Sincronizar forma de pago y moneda directa por defecto con la Caja / Banco seleccionada
  useEffect(() => {
    const acc = (catalogCuentas || []).find(c => c.key === insertCuentaKey);
    if (!acc) return;
    if (acc.accountType === 'CAJA') {
      const mUpper = String(acc.nombre || '').toUpperCase();
      if (mUpper.includes('USDT') || mUpper.includes('BINANCE')) setInsertFormaPago('USDT');
      else if (mUpper.includes('ZELLE')) setInsertFormaPago('ZELLE');
      else setInsertFormaPago('EFECTIVO');
    } else if (insertFormaPago === 'EFECTIVO') {
      setInsertFormaPago('TRANSFERENCIA');
    }

    const directFromAcc = inferDirectCurrencyFromAccountOrMethod(acc, { includeBinanceFromAccount: true });
    if (directFromAcc) {
      setInsertTipoTasa(directFromAcc);
      setInsertTasa('0');
      setInsertMontoBs('0');
    } else if (isDirectCurrencyRateType(insertTipoTasa)) {
      const bcvStr = round2(effectiveTasaBcv).toFixed(2);
      setInsertTipoTasa('BCV');
      setInsertTasa(bcvStr);
      const u = Number(insertMontoUsd);
      if (!isNaN(u) && insertMontoUsd !== '') {
        setInsertMontoBs(round2(u * Number(bcvStr)).toFixed(2));
      }
    }
  }, [insertCuentaKey]);

  // Consolidar y clasificar todos los movimientos por renglón de tasa (Fiscal: BCV o moneda directa; moneda directa muestra 0 en Bs/Tasa)
  const allMovements = useMemo(
    () =>
      buildInvoiceMovementsList({ documents, collections, fallbackTasa: effectiveTasaBcv }).map((m) => {
        const tipoTasa = classifyCollectionRateType(m, rateRefMap);
        const isDirect = isDirectCurrencyRateType(tipoTasa);
        const codeUpper = String(m.vendedorId || '').trim().toUpperCase();
        const resolvedName =
          (m.vendedorNombre && m.vendedorNombre.trim().toUpperCase() !== codeUpper ? m.vendedorNombre.trim() : '') ||
          sellerNameByCode.get(codeUpper) ||
          m.vendedorNombre ||
          m.vendedorId ||
          'Oficina';
        return {
          ...m,
          vendedorId: codeUpper || 'OF',
          vendedorNombre: resolvedName,
          tipoTasa,
          tipoTasaLabel: CXC_RATE_BUCKETS[tipoTasa]?.label || 'Tasa BCV',
          isDirectCurrency: isDirect,
          monedaPago: isDirect ? 'USD' : (m.monedaPago || 'BS'),
          tasa: isDirect ? 0 : m.tasa,
          montoBs: isDirect ? 0 : m.montoBs
        };
      }),
    [documents, collections, effectiveTasaBcv, rateRefMap, sellerNameByCode]
  );

  // Días recientes disponibles con movimientos para selector rápido
  const recentActiveDays = useMemo(() => {
    const dayTotals = new Map();
    allMovements.forEach((m) => {
      if (!m.fechaIso) return;
      const prev = dayTotals.get(m.fechaIso) || { fechaIso: m.fechaIso, count: 0, usd: 0 };
      prev.count += 1;
      prev.usd = round2(prev.usd + m.montoUsd);
      dayTotals.set(m.fechaIso, prev);
    });
    return Array.from(dayTotals.values())
      .sort((a, b) => b.fechaIso.localeCompare(a.fechaIso))
      .slice(0, 8);
  }, [allMovements]);

  // Filtrar movimientos
  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allMovements.filter((m) => {
      if (selectedDay && selectedDay !== 'ALL' && m.fechaIso !== selectedDay) {
        return false;
      }
      if (focusedFactNum) {
        const targetCanon = canonicalDocKey(focusedFactNum, initialDocument?.tipoDoc);
        const movCanon = canonicalDocKey(m.factNum, m.tipoDoc);
        if (String(m.factNum) !== String(focusedFactNum) && targetCanon !== movCanon) {
          return false;
        }
      }
      if (docTypeFilter !== 'ALL' && m.tipoDoc !== docTypeFilter) {
        return false;
      }
      if (rateTypeFilter !== 'ALL' && m.tipoTasa !== rateTypeFilter) {
        return false;
      }
      if (q) {
        const hay = `${m.correlativo} ${m.factNum} ${m.clienteNombre} ${m.clienteRif} ${m.vendedorNombre} ${m.vendedorId} ${m.referencia} ${m.cuentaNombre} ${m.formaPago} ${m.observaciones} ${m.tipoTasaLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allMovements, selectedDay, focusedFactNum, docTypeFilter, rateTypeFilter, searchQuery, initialDocument]);

  // Desglose global por renglones de tasa y sumatoria consolidada por Caja / Banco
  const overallRateBreakdown = useMemo(
    () => groupMovementsByRateType(filteredMovements, rateRefMap),
    [filteredMovements, rateRefMap]
  );
  const overallCajaBreakdown = useMemo(
    () => summarizeDailyMovementsByCaja(filteredMovements),
    [filteredMovements]
  );

  // Agrupar movimientos por día y clasificar internamente por renglón de tasa
  const movementsByDay = useMemo(() => {
    const map = new Map();
    filteredMovements.forEach((m) => {
      const key = m.fechaIso || 'SIN-FECHA';
      if (!map.has(key)) {
        map.set(key, {
          fechaIso: key,
          fechaDisplay: formatDateShort(key),
          fechaLarga: formatDateLongEs(key),
          items: [],
          totalUsd: 0,
          totalBs: 0
        });
      }
      const grp = map.get(key);
      grp.items.push(m);
      grp.totalUsd = round2(grp.totalUsd + Number(m.montoUsd || 0));
      grp.totalBs = round2(grp.totalBs + Number(m.montoBs || 0));
    });
    return Array.from(map.values())
      .sort((a, b) => b.fechaIso.localeCompare(a.fechaIso))
      .map((grp) => ({
        ...grp,
        rateBreakdown: groupMovementsByRateType(grp.items, rateRefMap)
      }));
  }, [filteredMovements, rateRefMap]);

  // Métricas resumen
  const summaryStats = useMemo(() => {
    const totalUsd = filteredMovements.reduce((acc, m) => acc + Number(m.montoUsd || 0), 0);
    const totalBs = filteredMovements.reduce((acc, m) => acc + Number(m.montoBs || 0), 0);
    const numericCorrs = filteredMovements.map(m => m.correlativoNum).filter(n => n > 0);
    const minCorr = numericCorrs.length > 0 ? String(Math.min(...numericCorrs)).padStart(6, '0') : null;
    const maxCorr = numericCorrs.length > 0 ? String(Math.max(...numericCorrs)).padStart(6, '0') : null;
    return {
      count: filteredMovements.length,
      daysCount: movementsByDay.length,
      totalUsd: round2(totalUsd),
      totalBs: round2(totalBs),
      minCorr,
      maxCorr
    };
  }, [filteredMovements, movementsByDay]);

  // Selector de documento para insertar abono
  const selectableDocs = useMemo(() => {
    const q = insertDocSearch.trim().toLowerCase();
    const list = (documents || []).filter((d) => {
      if (!d || d.anulada) return false;
      if (q) {
        const hay = `${d.factNum} ${d.factura} ${d.cliente} ${d.rif} ${d.vendedorNombre || d.vendedorId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Ordenar pendientes primero y luego más recientes
    return list.sort((a, b) => {
      const aPend = Number(a.restanteUsd || 0) > 0.01 ? 0 : 1;
      const bPend = Number(b.restanteUsd || 0) > 0.01 ? 0 : 1;
      if (aPend !== bPend) return aPend - bPend;
      return String(b.fechaEmisionIso || '').localeCompare(String(a.fechaEmisionIso || ''));
    });
  }, [documents, insertDocSearch]);

  const selectedInsertDoc = useMemo(() => {
    if (!insertDocKey) return null;
    return (documents || []).find(d => String(d.factNum) === String(insertDocKey)) || null;
  }, [documents, insertDocKey]);

  const isInsertDocFiscal = useMemo(
    () => Boolean(selectedInsertDoc && String(selectedInsertDoc.tipoDoc || '').toUpperCase() !== 'NOTA_ENTREGA'),
    [selectedInsertDoc]
  );

  const resolvePresetRateValue = (tipoKey) => {
    if (isDirectCurrencyRateType(tipoKey)) return '0';
    if (tipoKey === 'EURO') return round2(liveEuroRate).toFixed(2);
    if (tipoKey === 'KEYSTONE') return round2(effectiveTasaKeystone).toFixed(2);
    return round2(effectiveTasaBcv).toFixed(2);
  };

  const handlePickInsertDoc = (factNum) => {
    setInsertDocKey(factNum);
    const doc = (documents || []).find(d => String(d.factNum) === String(factNum));
    if (doc) {
      const isFiscal = String(doc.tipoDoc || '').toUpperCase() !== 'NOTA_ENTREGA';
      const currentIsDirect = isDirectCurrencyRateType(insertTipoTasa);
      let nextRateNum = Number(insertTasa) > 0 ? Number(insertTasa) : effectiveTasaBcv;
      if (isFiscal && insertTipoTasa === 'EURO') {
        setInsertTipoTasa('BCV');
        const bcvStr = round2(effectiveTasaBcv).toFixed(2);
        setInsertTasa(bcvStr);
        nextRateNum = Number(bcvStr);
      }
      const rest = round2(Math.max(0, Number(doc.restanteUsd || 0)));
      setInsertMontoUsd(rest > 0 ? rest.toFixed(2) : '');
      setInsertMontoBs(currentIsDirect ? '0' : (rest > 0 ? round2(rest * nextRateNum).toFixed(2) : ''));
    }
  };

  const handleInsertTipoTasaChange = (nextTipo) => {
    const nextIsDirect = isDirectCurrencyRateType(nextTipo);
    if (isInsertDocFiscal && nextTipo === 'EURO') {
      setInsertTipoTasa('BCV');
      const bcvStr = round2(effectiveTasaBcv).toFixed(2);
      setInsertTasa(bcvStr);
      const u = Number(insertMontoUsd);
      if (!isNaN(u) && insertMontoUsd !== '') {
        setInsertMontoBs(round2(u * Number(bcvStr)).toFixed(2));
      }
      notify.info('Los documentos fiscales no permiten Tasa Euro; use BCV, Keystone, Personalizada o moneda directa.');
      return;
    }
    setInsertTipoTasa(nextTipo);
    if (nextTipo === 'PERSONALIZADA') {
      return;
    }
    if (nextIsDirect) {
      setInsertTasa('0');
      setInsertMontoBs('0');
      return;
    }
    const presetStr = resolvePresetRateValue(nextTipo);
    setInsertTasa(presetStr);
    const r = Number(presetStr);
    const u = Number(insertMontoUsd);
    if (r > 0 && !isNaN(u) && insertMontoUsd !== '') {
      setInsertMontoBs(round2(u * r).toFixed(2));
    }
  };

  const handleInsertTasaChange = (val) => {
    setInsertTasa(val);
    const r = Number(val);
    const u = Number(insertMontoUsd);
    if (r > 0 && !isNaN(u) && insertMontoUsd !== '') {
      setInsertMontoBs(round2(u * r).toFixed(2));
    }
  };

  const handleInsertUsdChange = (val) => {
    setInsertMontoUsd(val);
    if (isDirectCurrencyRateType(insertTipoTasa)) {
      setInsertMontoBs('0');
      return;
    }
    const r = Number(insertTasa);
    const u = Number(val);
    if (r > 0 && !isNaN(u) && val !== '') {
      setInsertMontoBs(round2(u * r).toFixed(2));
    } else if (val === '') {
      setInsertMontoBs('');
    }
  };

  const handleInsertBsChange = (val) => {
    setInsertMontoBs(val);
    const r = Number(insertTasa);
    const b = Number(val);
    if (r > 0 && !isNaN(b) && val !== '') {
      setInsertMontoUsd(round2(b / r).toFixed(2));
    } else if (val === '') {
      setInsertMontoUsd('');
    }
  };

  // Insertar nuevo movimiento / abono con correlativo
  const handleInsertMovement = async (e) => {
    e.preventDefault();
    if (!selectedInsertDoc) {
      notify.warning('Seleccione una Factura o Nota de Entrega para asociar el movimiento.');
      return;
    }
    const isDirectCurrency = isDirectCurrencyRateType(insertTipoTasa);
    const rate = isDirectCurrency ? 0 : Number(insertTasa);
    if (!isDirectCurrency && (!rate || isNaN(rate) || rate <= 0)) {
      notify.warning('Ingrese una Tasa válida mayor a 0.');
      return;
    }
    if (!insertFecha) {
      notify.warning('La Fecha del movimiento es obligatoria.');
      return;
    }
    const cuentaObj = (catalogCuentas || []).find(c => c.key === insertCuentaKey);
    if (!cuentaObj) {
      notify.warning('Seleccione una Caja o Banco válido.');
      return;
    }
    const abonoUsd = round2(Number(insertMontoUsd));
    if (!abonoUsd || isNaN(abonoUsd) || abonoUsd <= 0) {
      notify.warning('Ingrese un monto de abono válido mayor a $0.00.');
      return;
    }
    const maxAllowed = round2(Number(selectedInsertDoc.restanteUsd || 0));
    if (Number(selectedInsertDoc.montoFacturaUsd || 0) > 0.01 && maxAllowed <= 0.01) {
      notify.warning(`El documento #${selectedInsertDoc.factNum} ya está completamente pagado (Restante: $0.00).`);
      return;
    }
    if (maxAllowed > 0.01 && abonoUsd > round2(maxAllowed + 0.01)) {
      notify.warning(`El monto ($${formatNumberUs(abonoUsd)}) supera el saldo restante del documento ($${formatNumberUs(maxAllowed)}).`);
      return;
    }

    const rawCorrDigits = String(insertCorrelativo || nextMovCorrelativo).replace(/[^0-9]/g, '');
    const correlativoFinal = rawCorrDigits
      ? String(Math.max(1, parseInt(rawCorrDigits, 10))).padStart(6, '0')
      : nextMovCorrelativo;

    const effectiveUsd = maxAllowed > 0.01 ? Math.min(abonoUsd, maxAllowed) : abonoUsd;
    const typedBs = round2(Number(insertMontoBs));
    const computedBs = isDirectCurrency ? 0 : round2(effectiveUsd * rate);
    const effectiveBs = isDirectCurrency
      ? 0
      : ((typedBs > 0 && Math.abs(computedBs - typedBs) < Math.max(2, rate * 0.015))
          ? typedBs
          : computedBs);
    const factKey = String(selectedInsertDoc.factNum);
    const newAbonosUsd = round2(Math.min(
      Number(selectedInsertDoc.montoFacturaUsd || (Number(selectedInsertDoc.abonosUsd || 0) + effectiveUsd)),
      Number(selectedInsertDoc.abonosUsd || 0) + effectiveUsd
    ));
    const newRestanteUsd = round2(Math.max(0, Number(selectedInsertDoc.montoFacturaUsd || 0) - newAbonosUsd));

    const movNowIso = new Date().toISOString();
    const fechaCompleta = insertFecha === getTodayIso() ? movNowIso : `${insertFecha}T12:00:00.000Z`;
    const normalizedInsertTipo = normalizeCxcRateType(insertTipoTasa);
    const effectiveTipoTasa = selectedInsertDoc.tipoDoc !== 'NOTA_ENTREGA'
      ? (normalizedInsertTipo === 'EURO' ? 'BCV' : (normalizedInsertTipo || 'BCV'))
      : (normalizedInsertTipo || 'PERSONALIZADA');
    const persistedRate = isDirectCurrency ? 1 : rate;
    const monedaPagoVal = isDirectCurrency ? 'USD' : 'BS';
    const obsFinal = insertObservaciones.trim() || (
      isDirectCurrency
        ? `Mov. #${correlativoFinal} • Abono ${selectedInsertDoc.tipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura'} #${factKey} [${CXC_RATE_BUCKETS[effectiveTipoTasa]?.label || effectiveTipoTasa}]`
        : `Mov. #${correlativoFinal} • Abono ${selectedInsertDoc.tipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura'} #${factKey} @ Tasa ${rate} [${effectiveTipoTasa}]`
    );

    setIsSavingMovement(true);
    try {
      const collectionIdGenerated = `cob-mov-${correlativoFinal}-${Date.now().toString().slice(-5)}`;
      const cobroRecord = {
        id: `mov-${correlativoFinal}-${Date.now().toString().slice(-4)}`,
        collectionId: collectionIdGenerated,
        correlativo: correlativoFinal,
        cobNum: correlativoFinal,
        factNum: factKey,
        tipoDoc: selectedInsertDoc.tipoDoc,
        fecha: fechaCompleta,
        tasa: persistedRate,
        tasaPago: persistedRate,
        tipoTasa: effectiveTipoTasa,
        monedaPago: monedaPagoVal,
        montoUsd: effectiveUsd,
        montoBs: effectiveBs,
        formaPago: insertFormaPago,
        cuentaKey: cuentaObj.key,
        cuentaId: cuentaObj.rawId || cuentaObj.id,
        cuentaNombre: cuentaObj.nombre,
        accountType: cuentaObj.accountType,
        moneda: cuentaObj.moneda,
        referencia: insertReferencia.trim(),
        observaciones: obsFinal
      };

      const collectionPayload = {
        id: collectionIdGenerated,
        correlativo: correlativoFinal,
        cobNum: correlativoFinal,
        fecha: fechaCompleta,
        clienteId: selectedInsertDoc.clienteId || '',
        clienteNombre: selectedInsertDoc.cliente || 'Cliente General',
        clienteRif: selectedInsertDoc.rif || '',
        vendedorId: selectedInsertDoc.vendedorId || 'OF',
        montoUsd: effectiveUsd,
        montoBs: effectiveBs,
        tasa: persistedRate,
        tasaPago: persistedRate,
        tipoTasa: effectiveTipoTasa,
        tipo_tasa: effectiveTipoTasa,
        monedaPago: monedaPagoVal,
        moneda_pago: monedaPagoVal,
        cuentaId: cuentaObj.rawId || cuentaObj.id,
        cuentaNombre: cuentaObj.nombre,
        descrip: obsFinal,
        formasPago: [{
          formaPago: insertFormaPago,
          monto: effectiveBs,
          montoUsd: effectiveUsd,
          tipoTasa: effectiveTipoTasa,
          tasaPago: persistedRate,
          moneda: monedaPagoVal,
          referencia: insertReferencia.trim(),
          codCaja: cuentaObj.accountType === 'CAJA' ? (cuentaObj.rawId || cuentaObj.id) : '',
          codCta: cuentaObj.accountType === 'BANCO' ? (cuentaObj.rawId || cuentaObj.id) : '',
          banco: cuentaObj.accountType === 'BANCO' ? (cuentaObj.rawId || cuentaObj.id) : ''
        }],
        documentosAfectados: [{
          numDoc: factKey,
          tipoDoc: selectedInsertDoc.tipoDoc === 'NOTA_ENTREGA' ? 'N/E' : 'FACT',
          montoCobrado: effectiveBs,
          montoCobradoUsd: effectiveUsd
        }]
      };

      const updatedInvoicePayload = {
        ...selectedInsertDoc,
        factNum: factKey,
        tipoDoc: selectedInsertDoc.tipoDoc,
        fechaEmision: selectedInsertDoc.fechaEmisionIso,
        fechaVencimiento: selectedInsertDoc.fechaVencimientoIso,
        clienteId: selectedInsertDoc.clienteId,
        clienteNombre: selectedInsertDoc.cliente,
        clienteRif: selectedInsertDoc.rif,
        vendedorId: selectedInsertDoc.vendedorId,
        vendedorNombre: selectedInsertDoc.vendedorNombre,
        diasCredito: selectedInsertDoc.diasCredito,
        diasVencidoCustom: selectedInsertDoc.diasVencidoCustom,
        totBrutoUsd: selectedInsertDoc.subtotalUsd,
        ivaUsd: selectedInsertDoc.tipoDoc === 'NOTA_ENTREGA' ? 0 : selectedInsertDoc.ivaUsd,
        totNetoUsd: selectedInsertDoc.montoFacturaUsd,
        abonosUsd: newAbonosUsd,
        saldoUsd: newRestanteUsd,
        tasa: rate,
        historialCobros: [cobroRecord, ...(selectedInsertDoc.historialCobros || [])]
      };

      if (onRegisterCollection) {
        await onRegisterCollection({
          updatedDoc: updatedInvoicePayload,
          collectionPayload,
          selectedAccount: cuentaObj,
          factNum: factKey,
          tipoDoc: selectedInsertDoc.tipoDoc,
          clienteId: selectedInsertDoc.clienteId,
          clienteNombre: selectedInsertDoc.cliente,
          vendedorId: selectedInsertDoc.vendedorId,
          fecha: fechaCompleta,
          tasa: rate,
          montoUsd: effectiveUsd,
          montoBs: effectiveBs,
          moneda: cuentaObj.moneda,
          accountType: cuentaObj.accountType,
          accountId: cuentaObj.rawId || cuentaObj.id,
          cuentaDestino: cuentaObj.nombre,
          formaPago: insertFormaPago,
          referencia: insertReferencia.trim(),
          observaciones: obsFinal,
          updatedInvoice: updatedInvoicePayload
        });
      }

      if (onUpdateLocalDoc) {
        onUpdateLocalDoc(factKey, updatedInvoicePayload, newRestanteUsd);
      }

      commitCxcMovementCorrelativo(correlativoFinal);
      setCorrelativoRefreshKey(k => k + 1);
      setInsertReferencia('');
      setInsertObservaciones('');
      if (newRestanteUsd > 0.01) {
        setInsertMontoUsd(newRestanteUsd.toFixed(2));
        setInsertMontoBs(isDirectCurrency ? '0' : round2(newRestanteUsd * rate).toFixed(2));
      } else {
        setInsertMontoUsd('');
        setInsertMontoBs('');
      }
      if (selectedDay !== 'ALL' && insertFecha !== selectedDay) {
        setSelectedDay(insertFecha);
      }

      notify.success(`Movimiento #${correlativoFinal} registrado en #${factKey} (${formatUsd(effectiveUsd)}).`);
    } catch (err) {
      console.error('Error registrando movimiento CxC:', err);
      notify.error('No se pudo registrar el movimiento: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingMovement(false);
    }
  };

  // Handlers de fijación manual de correlativos
  const handleOpenCorrelativoModal = () => {
    setManualMovInput(nextMovCorrelativo);
    setManualReportInput(currentReportCorrelativo);
    setShowCorrelativoModal(true);
  };

  const handleSaveManualCorrelativos = () => {
    const movSaved = setCxcMovementCorrelativo(manualMovInput || '1');
    const repSaved = setCxcMovementReportCorrelativo(manualReportInput || '1');
    setInsertCorrelativo(movSaved);
    setCorrelativoRefreshKey(k => k + 1);
    setShowCorrelativoModal(false);
    notify.success(`Correlativos fijados: Movimiento #${movSaved} • Reporte #${repSaved}`);
  };

  const handleResetAutoMovCorrelativo = () => {
    clearCxcMovementCorrelativoForce();
    const fresh = getNextCxcMovementCorrelativo(collections, documents);
    setManualMovInput(fresh);
    setInsertCorrelativo(fresh);
    setCorrelativoRefreshKey(k => k + 1);
    notify.info(`Correlativo de movimientos restaurado en automático (#${fresh})`);
  };

  const handlePrintWithCtrlP = () => {
    window.print();
  };

  // Editar manualmente correlativo, fecha y cobrador de un movimiento puntual ya registrado
  const handleOpenEditMovementCorr = (mov) => {
    if (!mov) return;
    const rawDigits = String(mov.correlativo || '').replace(/[^0-9]/g, '');
    setEditMovCorrInput(rawDigits ? rawDigits.padStart(6, '0').slice(-6) : '000001');
    setEditMovFechaInput(mov.fechaIso || toIsoDateOnly(mov.fechaRaw) || getTodayIso());

    const rawCode = String(mov.vendedorId || '').trim().toUpperCase();
    const rawName = String(mov.vendedorNombre || '').trim().toLowerCase();
    const matchedOption =
      sellerCatalogOptions.find((s) => s.code === rawCode) ||
      sellerCatalogOptions.find((s) => rawName && s.name.toLowerCase() === rawName) ||
      sellerCatalogOptions.find((s) => rawName && s.name.toLowerCase().includes(rawName));
    setEditMovCobradorId(matchedOption?.code || rawCode || 'OF');
    setEditingMovementCorr(mov);
  };

  const handleSaveMovementCorrelativoEdit = async (e) => {
    e.preventDefault();
    if (!editingMovementCorr) return;
    const cleanDigits = String(editMovCorrInput || '').replace(/[^0-9]/g, '');
    const parsedNum = parseInt(cleanDigits, 10);
    if (!cleanDigits || isNaN(parsedNum) || parsedNum < 1) {
      notify.warning('Ingrese un número de correlativo válido (mayor o igual a 1).');
      return;
    }

    const newFechaIso = String(editMovFechaInput || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newFechaIso)) {
      notify.warning('Seleccione una fecha válida para el movimiento.');
      return;
    }

    const selectedSellerOpt =
      sellerCatalogOptions.find((s) => s.code === String(editMovCobradorId || '').trim().toUpperCase()) || null;
    const newSellerCode = selectedSellerOpt?.code || String(editMovCobradorId || 'OF').trim().toUpperCase() || 'OF';
    const newSellerName = selectedSellerOpt?.name || sellerNameByCode.get(newSellerCode) || newSellerCode;

    const newCorr = String(Math.min(999999, parsedNum)).padStart(6, '0');
    const newFechaFull =
      newFechaIso === editingMovementCorr.fechaIso && editingMovementCorr.fechaRaw
        ? editingMovementCorr.fechaRaw
        : `${newFechaIso}T12:00:00.000Z`;

    const oldCorrDigits = String(editingMovementCorr.correlativo || '').replace(/[^0-9]/g, '');
    const oldCorrNormalized = oldCorrDigits ? oldCorrDigits.padStart(6, '0') : '';
    const targetCanon = canonicalDocKey(editingMovementCorr.factNum, editingMovementCorr.tipoDoc);
    const targetAmount = round2(editingMovementCorr.montoUsd || 0);
    const editedAtIso = new Date().toISOString();

    setIsSavingEditMovCorr(true);
    try {
      const updatedDocPromises = [];
      const updatedColPromises = [];
      const touchedColIds = new Set();

      // 1. Actualizar entradas coincidentes en historialCobros de documentos
      (documents || []).forEach((doc) => {
        if (!doc || !Array.isArray(doc.historialCobros) || doc.historialCobros.length === 0) return;
        let docModified = false;
        const docCanon = canonicalDocKey(doc.factNum || doc.factura || '', doc.tipoDoc);
        const nextHist = doc.historialCobros.map((h) => {
          if (!h) return h;
          const byHistId = Boolean(editingMovementCorr.histId && h.id && String(h.id) === String(editingMovementCorr.histId));
          const hCorrRaw = String(h.correlativo ?? h.cobNum ?? '').replace(/[^0-9]/g, '');
          const hCorrNorm = hCorrRaw ? hCorrRaw.padStart(6, '0') : '';
          const hDate = toIsoDateOnly(h.fecha || doc.fechaEmision || doc.fechaEmisionIso || '');
          const hTasa = Number(h.tasa || doc.tasa || tasaBcv) || tasaBcv;
          const hUsd = round2(h.montoUsd ?? (Number(h.montoBs || 0) > 0 && hTasa > 0 ? Number(h.montoBs) / hTasa : 0));
          const hCanon = canonicalDocKey(h.factNum || doc.factNum || doc.factura || '', h.tipoDoc || doc.tipoDoc);

          const bySignature =
            hCanon === targetCanon &&
            hDate === editingMovementCorr.fechaIso &&
            Math.abs(hUsd - targetAmount) <= 0.02 &&
            (!oldCorrNormalized || hCorrNorm === oldCorrNormalized);

          const isMatch = byHistId || (docCanon === targetCanon && bySignature) || bySignature;
          if (!isMatch) return h;
          docModified = true;
          return {
            ...h,
            correlativo: newCorr,
            cobNum: newCorr,
            fecha: newFechaFull,
            vendedorId: newSellerCode,
            vendedorNombre: newSellerName,
            cobradorId: newSellerCode,
            cobradorNombre: newSellerName
          };
        });

        if (docModified) {
          const updatedDocPayload = {
            ...doc,
            factNum: String(doc.factNum),
            tipoDoc: doc.tipoDoc,
            fechaEmision: doc.fechaEmisionIso || doc.fechaEmision,
            fechaVencimiento: doc.fechaVencimientoIso || doc.fechaVencimiento,
            clienteId: doc.clienteId,
            clienteNombre: doc.cliente || doc.clienteNombre,
            clienteRif: doc.rif || doc.clienteRif,
            vendedorId: doc.vendedorId,
            vendedorNombre: doc.vendedorNombre,
            diasCredito: doc.diasCredito,
            diasVencidoCustom: doc.diasVencidoCustom,
            totBrutoUsd: doc.subtotalUsd ?? doc.totBrutoUsd,
            ivaUsd: doc.tipoDoc === 'NOTA_ENTREGA' ? 0 : (doc.ivaUsd ?? 0),
            totNetoUsd: doc.montoFacturaUsd ?? doc.totNetoUsd,
            abonosUsd: doc.abonosUsd ?? 0,
            saldoUsd: doc.restanteUsd ?? doc.saldoUsd ?? 0,
            tasa: Number(doc.tasa || tasaBcv),
            historialCobros: nextHist
          };
          if (onUpdateLocalDoc) {
            onUpdateLocalDoc(String(doc.factNum), updatedDocPayload, Number(doc.restanteUsd ?? 0));
          }
          if (onSaveDocument) {
            updatedDocPromises.push(onSaveDocument(updatedDocPayload));
          }
        }
      });

      // 2. Actualizar registros coincidentes en profit_collections para evitar duplicados o desincronización
      (collections || []).forEach((col) => {
        if (!col || col.anulado) return;
        const colIdStr = String(col.id || '');
        const byColId = Boolean(
          (editingMovementCorr.collectionId && colIdStr === String(editingMovementCorr.collectionId)) ||
          (editingMovementCorr.source === 'PROFIT_COLLECTION' && colIdStr && editingMovementCorr.rawId && String(editingMovementCorr.rawId).startsWith(colIdStr))
        );

        const colCorrRaw = String(col.correlativo ?? col.cobNum ?? col.cob_num ?? '').replace(/[^0-9]/g, '');
        const colCorrNorm = colCorrRaw ? colCorrRaw.padStart(6, '0') : '';
        const colDate = toIsoDateOnly(col.fecha || col.fec_cob || col.fechaCobro || col.fechaSincronizacion || '');
        const { usdVal: colUsd } = resolveCollectionAmounts(col, tasaBcv);
        const affected = Array.isArray(col.documentosAfectados) ? col.documentosAfectados : [];
        const matchesDocAffected = affected.some((aff) => {
          const affNum = String(aff?.numDoc || '').trim();
          const affType = String(aff?.tipoDoc || '').toUpperCase().includes('N/E') || affNum.toUpperCase().startsWith('NE-')
            ? 'NOTA_ENTREGA'
            : 'FACTURA';
          const affCanon = canonicalDocKey(affNum, affType);
          const affUsd = round2(Number(aff?.montoCobradoUsd || 0));
          return affCanon === targetCanon && (affUsd <= 0 || Math.abs(affUsd - targetAmount) <= 0.05 || Math.abs(colUsd - targetAmount) <= 0.05);
        });

        const bySignature =
          colDate === editingMovementCorr.fechaIso &&
          (!oldCorrNormalized || colCorrNorm === oldCorrNormalized) &&
          (matchesDocAffected || (editingMovementCorr.factNum === 'GENERAL' && Math.abs(colUsd - targetAmount) <= 0.05));

        if ((byColId || bySignature) && colIdStr && !touchedColIds.has(colIdStr)) {
          touchedColIds.add(colIdStr);
          const updatedCol = {
            ...col,
            correlativo: newCorr,
            cobNum: newCorr,
            cob_num: newCorr,
            fecha: newFechaFull,
            fec_cob: newFechaFull,
            vendedorId: newSellerCode,
            vendedor_id: newSellerCode,
            vendedorNombre: newSellerName,
            cobradorId: newSellerCode,
            cobradorNombre: newSellerName,
            _localEditedAt: editedAtIso
          };
          if (onUpdateCollection) {
            updatedColPromises.push(onUpdateCollection(updatedCol));
          } else {
            updatedColPromises.push(saveSupabaseProfitCollection(updatedCol));
          }
        }
      });

      await Promise.all([...updatedDocPromises, ...updatedColPromises]);

      if (selectedDay && selectedDay !== 'ALL' && newFechaIso !== selectedDay) {
        setSelectedDay(newFechaIso);
      }
      setCorrelativoRefreshKey(k => k + 1);
      notify.success(`Movimiento #${newCorr} actualizado (${formatDateShort(newFechaIso)} • Cobrador: ${newSellerName}).`);
      setEditingMovementCorr(null);
    } catch (err) {
      console.error('Error editando movimiento CxC:', err);
      notify.error('No se pudo actualizar el movimiento: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingEditMovCorr(false);
    }
  };

  if (!isOpen) return null;

  const filterSummaryText = [
    selectedDay === 'ALL' ? 'Todos los días' : `Día: ${formatDateShort(selectedDay)}`,
    focusedFactNum ? `Documento: #${focusedFactNum}` : 'Todas las facturas y N.E.',
    docTypeFilter === 'FACTURA' ? 'Solo Facturas Fiscales' : (docTypeFilter === 'NOTA_ENTREGA' ? 'Solo Notas de Entrega' : ''),
    rateTypeFilter !== 'ALL'
      ? `Renglón: ${CXC_RATE_BUCKETS[rateTypeFilter]?.label || rateTypeFilter}`
      : 'Clasificado por Tasas y Monedas Directas (BCV, Euro, Keystone, Pers., Efectivo USD, Zelle, Binance USDT, Kontigo USDC)'
  ].filter(Boolean).join(' • ');

  const modalNode = (
    <>
      <style>{`
        @media screen {
          .cxc-movements-print-only {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: letter portrait;
            margin: 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          #printable-cxc-movements-report,
          #printable-cxc-movements-report * {
            box-sizing: border-box !important;
          }
          html body:has(.cxc-movements-portal-backdrop) #root,
          body:has(.cxc-movements-portal-backdrop) #root {
            display: none !important;
            visibility: hidden !important;
          }
          .cxc-movements-portal-backdrop {
            position: static !important;
            inset: auto !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
          }
          .cxc-movements-portal-card {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .cxc-movements-screen-only,
          .no-print {
            display: none !important;
          }
          .cxc-movements-print-only {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 1px !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }
          .cxc-print-table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 7.4pt !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .cxc-print-table thead {
            display: table-header-group !important;
          }
          .cxc-print-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cxc-print-table th,
          .cxc-print-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 3px 3.5px !important;
            color: #0f172a !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            vertical-align: middle !important;
          }
          .cxc-print-table th {
            background: #e2e8f0 !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cxc-print-day-block {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            margin-bottom: 10px !important;
          }
          .cxc-print-day-header {
            width: 100% !important;
            max-width: 100% !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .cxc-print-footer-totals {
            width: 100% !important;
            max-width: 100% !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .cxc-print-shell {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border: none !important;
          }
          .cxc-print-shell > tbody > tr {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .cxc-print-shell > tbody > tr > td,
          .cxc-print-shell > tfoot > tr > td {
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .cxc-print-shell > tfoot {
            display: table-footer-group !important;
          }
          .cxc-print-footer-spacer {
            height: 20mm !important;
          }
          .cxc-print-fixed-signatures {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            padding: 6px 2px 0 2px !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 3rem !important;
            font-size: 8.5pt !important;
            color: #334155 !important;
            text-align: center !important;
          }
        }
      `}</style>

      <div
        className="cxc-movements-portal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(3, 7, 18, 0.86)',
          backdropFilter: 'blur(8px)',
          zIndex: 10020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overflowY: 'auto'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !showCorrelativoModal && !editingMovementCorr && onClose) onClose();
        }}
      >
        <div
          className="cxc-movements-portal-card"
          style={{
            background: 'var(--bg-modal, #0c1427)',
            border: '1px solid var(--border-glass, rgba(255,255,255,0.12))',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1460px',
            maxHeight: '94vh',
            overflowY: 'auto',
            boxShadow: '0 25px 60px rgba(0,0,0,0.75)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* ============================================================== */}
          {/* INTERFAZ EN PANTALLA (.cxc-movements-screen-only)               */}
          {/* ============================================================== */}
          <div className="cxc-movements-screen-only no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem 1.5rem' }}>
            {/* HEADER SUPERIOR */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                }}>
                  <Layers size={20} color="#ffffff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                      Movimientos & Abonos de Facturas (Por Día)
                    </h2>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 9px',
                      borderRadius: '999px',
                      background: 'rgba(99, 102, 241, 0.18)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99, 102, 241, 0.45)',
                      fontFamily: 'var(--font-code)'
                    }}>
                      Reporte N° {currentReportCorrelativo}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 9px',
                      borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.16)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      fontFamily: 'var(--font-code)'
                    }}>
                      Próx. Mov: #{nextMovCorrelativo}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Control cronológico diario con inserción directa de pagos, asignación manual de correlativo e impresión vía <strong style={{ color: '#e2e8f0' }}>Ctrl + P</strong>.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleOpenCorrelativoModal}
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '9px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 3px 12px rgba(79, 70, 229, 0.35)'
                  }}
                  title="Fijar manualmente el N° de Correlativo de Movimientos y del Reporte Impreso"
                >
                  <Hash size={15} />
                  <span>Fijar Correlativo (#{nextMovCorrelativo})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInsertPanel(v => !v)}
                  className="btn btn-primary"
                  style={{
                    padding: '0.5rem 0.9rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {showInsertPanel ? <ChevronUp size={15} /> : <Plus size={15} />}
                  <span>{showInsertPanel ? 'Ocultar Inserción' : '+ Insertar Movimiento'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintWithCtrlP}
                  className="btn btn-print-report"
                  style={{
                    padding: '0.5rem 0.95rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Imprimir Reporte de Movimientos con su correlativo (también funciona presionando Ctrl + P)"
                >
                  <Printer size={15} color="#ffffff" />
                  <span>Imprimir (Ctrl + P)</span>
                </button>

                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-muted)',
                      borderRadius: '8px',
                      padding: '0.45rem',
                      cursor: 'pointer'
                    }}
                    title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* KPI STRIP */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Movimientos Listados</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {summaryStats.count} <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#94a3b8' }}>({summaryStats.daysCount} día{summaryStats.daysCount === 1 ? '' : 's'})</span>
                </div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 700 }}>Total Abonado (USD)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {formatUsd(summaryStats.totalUsd)}
                </div>
              </div>
              <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', borderRadius: '10px', padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>Equivalente Total (Bs.)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {formatBs(summaryStats.totalBs)}
                </div>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '10px', padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>Rango / Correlativo Reporte</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#e0e7ff', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span>REP-#{currentReportCorrelativo}</span>
                  <button
                    type="button"
                    onClick={() => {
                      commitCxcMovementReportCorrelativo(currentReportCorrelativo);
                      setCorrelativoRefreshKey(k => k + 1);
                    }}
                    style={{
                      background: 'rgba(99,102,241,0.22)',
                      border: '1px solid rgba(165,180,252,0.4)',
                      color: '#c7d2fe',
                      borderRadius: '6px',
                      padding: '2px 7px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title="Avanzar manualmente al siguiente correlativo del reporte"
                  >
                    +1 Rep.
                  </button>
                </div>
              </div>
            </div>

            {/* DESGLOSE POR RENGLÓN DE TASA (BCV, EURO, KEYSTONE, PERSONALIZADA) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem' }}>
              {overallRateBreakdown.groups.map((rg) => {
                const activeFilter = rateTypeFilter === rg.id;
                return (
                  <button
                    key={rg.id}
                    type="button"
                    onClick={() => setRateTypeFilter(prev => (prev === rg.id ? 'ALL' : rg.id))}
                    style={{
                      textAlign: 'left',
                      background: activeFilter ? rg.badgeBg : 'rgba(255,255,255,0.025)',
                      border: activeFilter ? `1.5px solid ${rg.color}` : `1px solid ${rg.border}`,
                      borderRadius: '10px',
                      padding: '0.6rem 0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Clic para filtrar este renglón de tasa"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: rg.color, textTransform: 'uppercase' }}>
                        {rg.label}{rg.id === 'BCV' ? ' (incl. Fiscal)' : ''}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)', color: '#cbd5e1', background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '999px' }}>
                        {rg.count} mov{rg.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                      <strong style={{ fontSize: '0.96rem', color: '#ffffff' }}>{formatUsd(rg.totalUsd)}</strong>
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 700 }}>{formatBs(rg.totalBs)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PANEL DE INSERCIÓN DIRECTA DE MOVIMIENTO / ABONO */}
            {showInsertPanel && (
              <form
                onSubmit={handleInsertMovement}
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(16, 185, 129, 0.32)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={17} color="#10b981" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                      Insertar Nuevo Movimiento / Abono en Factura
                    </span>
                  </div>
                  {selectedInsertDoc && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', fontFamily: 'var(--font-code)', flexWrap: 'wrap' }}>
                      <span style={{ color: '#94a3b8' }}>Doc: <strong style={{ color: '#fff' }}>#{selectedInsertDoc.factNum}</strong></span>
                      <span style={{ color: '#94a3b8' }}>Cobrador: <strong style={{ color: '#38bdf8' }}>{selectedInsertDoc.vendedorNombre || selectedInsertDoc.vendedorId || 'Oficina'}</strong></span>
                      <span style={{ color: '#94a3b8' }}>Total: <strong style={{ color: '#e2e8f0' }}>{formatUsd(selectedInsertDoc.montoFacturaUsd)}</strong></span>
                      <span style={{ color: '#10b981' }}>Abonado: <strong>{formatUsd(selectedInsertDoc.abonosUsd)}</strong></span>
                      <span style={{ color: '#f87171', fontWeight: 800 }}>Restante: {formatUsd(selectedInsertDoc.restanteUsd)}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem' }}>
                  {/* Factura / NE asociada */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Factura / Nota de Entrega Asociada *
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={insertDocSearch}
                        onChange={(e) => setInsertDocSearch(e.target.value)}
                        placeholder="Filtrar N°, cliente o RIF..."
                        className="input-modern"
                        style={{ width: '42%', padding: '0.5rem 0.65rem', fontSize: '0.8rem' }}
                      />
                      <select
                        value={insertDocKey}
                        onChange={(e) => handlePickInsertDoc(e.target.value)}
                        required
                        className="input-modern"
                        style={{ width: '58%', padding: '0.5rem 0.65rem', fontSize: '0.8rem' }}
                      >
                        <option value="">-- Seleccionar Factura / N.E. --</option>
                        {selectableDocs.slice(0, 250).map((d) => {
                          const isPaid = Number(d.montoFacturaUsd || 0) > 0.01 && Number(d.restanteUsd || 0) <= 0.01;
                          return (
                            <option key={d.id || d.factNum} value={d.factNum} disabled={isPaid}>
                              #{d.factNum} ({d.tipoDoc === 'NOTA_ENTREGA' ? 'N/E' : 'FAC'}) • {String(d.cliente || '').slice(0, 26)} • {isPaid ? 'SOLVENTE ($0.00)' : `Rest: $${formatNumberUs(d.restanteUsd || 0)}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Correlativo Movimiento */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Correlativo Mov. *
                    </label>
                    <input
                      type="text"
                      value={insertCorrelativo}
                      onChange={(e) => setInsertCorrelativo(e.target.value)}
                      required
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem', fontFamily: 'var(--font-code)', fontWeight: 800, color: '#a5b4fc' }}
                    />
                  </div>

                  {/* Fecha del movimiento */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Fecha Movimiento *
                    </label>
                    <input
                      type="date"
                      value={insertFecha}
                      onChange={(e) => setInsertFecha(e.target.value)}
                      required
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}
                    />
                  </div>

                  {/* Forma de Pago */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Método de Pago *
                    </label>
                    <select
                      value={insertFormaPago}
                      onChange={(e) => setInsertFormaPago(e.target.value)}
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}
                    >
                      <option value="EFECTIVO">Efectivo ($ / Bs.)</option>
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="PAGO_MOVIL">Pago Móvil</option>
                      <option value="ZELLE">Zelle</option>
                      <option value="USDT">USDT / Cripto</option>
                      <option value="DEPOSITO">Depósito Bancario</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  {/* Caja / Banco Destino */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Caja o Banco Destino *
                    </label>
                    <select
                      value={insertCuentaKey}
                      onChange={(e) => setInsertCuentaKey(e.target.value)}
                      required
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.8rem' }}
                    >
                      {(catalogCuentas || []).map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label || c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selector y Valor de Tasa / Moneda Directa */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                        {isDirectCurrencyRateType(insertTipoTasa) ? 'Moneda Directa' : 'Tasa (Bs/USD) *'}
                      </label>
                      {isInsertDocFiscal && (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#34d399', background: 'rgba(16, 185, 129, 0.16)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '1px 5px', borderRadius: '4px' }}>
                          BCV / Keystone / Pers.
                        </span>
                      )}
                    </div>
                    <select
                      value={isInsertDocFiscal && insertTipoTasa === 'EURO' ? 'BCV' : insertTipoTasa}
                      onChange={(e) => handleInsertTipoTasaChange(e.target.value)}
                      className="input-modern"
                      style={{
                        width: '100%',
                        padding: '0.46rem 0.55rem',
                        fontSize: '0.79rem',
                        fontWeight: 700,
                        color: CXC_RATE_BUCKETS[isInsertDocFiscal && insertTipoTasa === 'EURO' ? 'BCV' : insertTipoTasa]?.color || '#10b981'
                      }}
                    >
                      <option value="BCV">Tasa BCV — {formatBs(effectiveTasaBcv)}</option>
                      <option value="EURO" disabled={isInsertDocFiscal}>
                        Tasa Euro — {formatBs(liveEuroRate)}{isInsertDocFiscal ? ' (Solo N.E.)' : ''}
                      </option>
                      <option value="KEYSTONE">
                        Tasa Keystone — {formatBs(effectiveTasaKeystone)}
                      </option>
                      <option value="PERSONALIZADA">
                        Personalizada (Manual)
                      </option>
                      <option value="USD">Divisa Efectivo USD (Directa)</option>
                      <option value="ZELLE">Divisa Zelle (USD) (Directa)</option>
                      <option value="USDT">Divisa Binance (USDT) (Directa)</option>
                      <option value="USDC">Divisas Kontigo (USDC) (Directa)</option>
                    </select>
                    {isDirectCurrencyRateType(insertTipoTasa) ? (
                      <div
                        className="input-modern"
                        style={{
                          width: '100%',
                          marginTop: '5px',
                          padding: '0.38rem 0.6rem',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-code)',
                          color: CXC_RATE_BUCKETS[insertTipoTasa]?.color || '#22c55e',
                          fontWeight: 700
                        }}
                      >
                        {CXC_RATE_BUCKETS[insertTipoTasa]?.label} (Tasa Bs: 0)
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={insertTasa}
                        readOnly={insertTipoTasa !== 'PERSONALIZADA'}
                        onChange={(e) => {
                          if (insertTipoTasa !== 'PERSONALIZADA') return;
                          handleInsertTasaChange(e.target.value);
                        }}
                        placeholder="Ingrese tasa manual..."
                        required
                        className="input-modern"
                        style={{
                          width: '100%',
                          marginTop: '5px',
                          padding: '0.38rem 0.6rem',
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-code)',
                          color: insertTipoTasa === 'PERSONALIZADA' ? '#c084fc' : '#10b981',
                          fontWeight: 700,
                          opacity: insertTipoTasa === 'PERSONALIZADA' ? 1 : 0.85,
                          borderColor: insertTipoTasa === 'PERSONALIZADA' ? 'rgba(192, 132, 252, 0.55)' : undefined
                        }}
                        title={
                          insertTipoTasa === 'PERSONALIZADA'
                            ? 'Ingrese manualmente la tasa en Bs/USD'
                            : 'Tasa calculada según el tipo seleccionado'
                        }
                      />
                    )}
                  </div>

                  {/* Monto USD */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                        Abono (USD) *
                      </label>
                      {selectedInsertDoc && Number(selectedInsertDoc.restanteUsd || 0) > 0.01 && (
                        <button
                          type="button"
                          onClick={() => handleInsertUsdChange(String(round2(selectedInsertDoc.restanteUsd).toFixed(2)))}
                          style={{
                            background: 'rgba(16, 185, 129, 0.16)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            color: '#34d399',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            cursor: 'pointer'
                          }}
                        >
                          Total (${formatNumberUs(selectedInsertDoc.restanteUsd)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={insertMontoUsd}
                      onChange={(e) => handleInsertUsdChange(e.target.value)}
                      required
                      placeholder="0.00"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.85rem', fontFamily: 'var(--font-code)', fontWeight: 800, color: '#ffffff' }}
                    />
                  </div>

                  {/* Equivalente Bs */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Equivalente (Bs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      readOnly={isDirectCurrencyRateType(insertTipoTasa)}
                      value={isDirectCurrencyRateType(insertTipoTasa) ? '0' : insertMontoBs}
                      onChange={(e) => {
                        if (isDirectCurrencyRateType(insertTipoTasa)) return;
                        handleInsertBsChange(e.target.value);
                      }}
                      placeholder="0.00"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.84rem', fontFamily: 'var(--font-code)', color: '#38bdf8', fontWeight: 700 }}
                    />
                  </div>

                  {/* Referencia */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      N° Referencia / Comprobante
                    </label>
                    <input
                      type="text"
                      value={insertReferencia}
                      onChange={(e) => setInsertReferencia(e.target.value)}
                      placeholder="Ej. Ref. 009182 / Recibo"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}
                    />
                  </div>

                  {/* Observaciones */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Observaciones / Detalle
                    </label>
                    <input
                      type="text"
                      value={insertObservaciones}
                      onChange={(e) => setInsertObservaciones(e.target.value)}
                      placeholder="Nota del pago (opcional)"
                      className="input-modern"
                      style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.82rem' }}
                    />
                  </div>

                  {/* Botón Guardar Movimiento */}
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={isSavingMovement}
                      className="btn"
                      style={{
                        width: '100%',
                        padding: '0.58rem 0.9rem',
                        borderRadius: '9px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <Check size={16} />
                      <span>{isSavingMovement ? 'Guardando...' : `Insertar Mov. #${insertCorrelativo || nextMovCorrelativo}`}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* BARRA DE FILTROS POR DÍA Y FACTURA */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Filter size={15} color="#38bdf8" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>Filtrar por Día:</span>
                  <input
                    type="date"
                    value={selectedDay === 'ALL' ? '' : selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value || 'ALL')}
                    className="input-modern"
                    style={{ padding: '0.38rem 0.6rem', fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedDay(getTodayIso())}
                    style={{
                      padding: '0.38rem 0.7rem',
                      borderRadius: '7px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      border: selectedDay === getTodayIso() ? '1px solid #10b981' : '1px solid var(--border-glass)',
                      background: selectedDay === getTodayIso() ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.04)',
                      color: selectedDay === getTodayIso() ? '#34d399' : '#cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDay('ALL')}
                    style={{
                      padding: '0.38rem 0.7rem',
                      borderRadius: '7px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      border: selectedDay === 'ALL' ? '1px solid #38bdf8' : '1px solid var(--border-glass)',
                      background: selectedDay === 'ALL' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.04)',
                      color: selectedDay === 'ALL' ? '#38bdf8' : '#cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    Todos los Días
                  </button>

                  {/* Pill de Factura enfocada */}
                  {focusedFactNum && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.35rem 0.7rem',
                      borderRadius: '999px',
                      background: 'rgba(245, 158, 11, 0.16)',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      color: '#fbbf24',
                      fontSize: '0.76rem',
                      fontWeight: 800
                    }}>
                      <span>Factura #{focusedFactNum}</span>
                      <button
                        type="button"
                        onClick={() => setFocusedFactNum('')}
                        style={{ background: 'transparent', border: 'none', color: '#fbbf24', cursor: 'pointer', padding: 0, display: 'flex' }}
                        title="Quitar filtro de factura"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', flexWrap: 'wrap', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)', gap: '3px' }}>
                    {[
                      { id: 'ALL', label: 'Todas Tasas' },
                      ...CXC_RATE_ORDER.map((rk) => ({
                        id: rk,
                        label: rk === 'PERSONALIZADA' ? 'Pers.' : CXC_RATE_BUCKETS[rk].shortLabel
                      }))
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRateTypeFilter(opt.id)}
                        style={{
                          padding: '0.3rem 0.55rem',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: rateTypeFilter === opt.id ? (CXC_RATE_BUCKETS[opt.id]?.color || '#10b981') : 'transparent',
                          color: rateTypeFilter === opt.id ? '#0f172a' : 'var(--text-muted)'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)', gap: '3px' }}>
                    {[
                      { id: 'ALL', label: 'Todos' },
                      { id: 'FACTURA', label: 'Facturas' },
                      { id: 'NOTA_ENTREGA', label: 'N. Entrega' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDocTypeFilter(opt.id)}
                        style={{
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: docTypeFilter === opt.id ? '#0284c7' : 'transparent',
                          color: docTypeFilter === opt.id ? '#ffffff' : 'var(--text-muted)'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar correlativo, factura, cliente, ref..."
                      className="input-modern"
                      style={{ padding: '0.4rem 0.7rem 0.4rem 2rem', fontSize: '0.8rem', minWidth: '240px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Días recientes con actividad */}
              {recentActiveDays.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '2px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Días recientes con abonos:</span>
                  {recentActiveDays.map(day => (
                    <button
                      key={day.fechaIso}
                      type="button"
                      onClick={() => setSelectedDay(day.fechaIso)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-code)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: selectedDay === day.fechaIso ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                        background: selectedDay === day.fechaIso ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.04)',
                        color: selectedDay === day.fechaIso ? '#38bdf8' : '#cbd5e1'
                      }}
                    >
                      {formatDateShort(day.fechaIso)} ({day.count} • {formatUsd(day.usd)})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* LISTADO POR DÍA EN PANTALLA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {movementsByDay.length === 0 ? (
                <div style={{
                  padding: '2.5rem',
                  textAlign: 'center',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-glass)',
                  color: 'var(--text-muted)'
                }}>
                  <Calendar size={34} color="#64748b" style={{ marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.95rem' }}>
                    No se encontraron movimientos para los filtros actuales
                  </div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Puede cambiar a "Todos los Días" o registrar un nuevo abono en el panel superior.
                  </div>
                  {selectedDay !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedDay('ALL')}
                      style={{
                        marginTop: '0.8rem',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(56, 189, 248, 0.45)',
                        background: 'rgba(56, 189, 248, 0.16)',
                        color: '#38bdf8',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Ver Todos los Días
                    </button>
                  )}
                </div>
              ) : (
                movementsByDay.map((dayGroup) => (
                  <div
                    key={dayGroup.fechaIso}
                    style={{
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: 'rgba(15, 23, 42, 0.45)'
                    }}
                  >
                    {/* Cabecera del Día */}
                    <div style={{
                      padding: '0.65rem 1rem',
                      background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.18), rgba(79, 70, 229, 0.12))',
                      borderBottom: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={15} color="#38bdf8" />
                        <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>
                          {dayGroup.fechaLarga}
                        </strong>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '1px 8px',
                          borderRadius: '999px',
                          background: 'rgba(255,255,255,0.1)',
                          color: '#cbd5e1'
                        }}>
                          {dayGroup.items.length} mov{dayGroup.items.length === 1 ? '.' : 's.'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}>
                        <span style={{ color: '#10b981', fontWeight: 800 }}>Subtotal Día: {formatUsd(dayGroup.totalUsd)}</span>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>{dayGroup.totalBs > 0 ? formatBs(dayGroup.totalBs) : '0'}</span>
                      </div>
                    </div>

                    {/* Tablas clasificadas por renglón de tasa dentro del día */}
                    {(dayGroup.rateBreakdown?.nonEmptyGroups || []).map((rateGroup) => (
                      <div key={`${dayGroup.fechaIso}-${rateGroup.id}`} style={{ borderTop: '1px solid var(--border-glass)' }}>
                        <div style={{
                          padding: '0.45rem 1rem',
                          background: rateGroup.badgeBg,
                          borderBottom: `1px solid ${rateGroup.border}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: rateGroup.color,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em'
                            }}>
                              {rateGroup.label}{rateGroup.id === 'BCV' ? ' (Incluye Documentos Fiscales)' : ''}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-code)',
                              color: '#e2e8f0',
                              background: 'rgba(15, 23, 42, 0.55)',
                              padding: '1px 7px',
                              borderRadius: '999px'
                            }}>
                              {rateGroup.count} mov{rateGroup.count === 1 ? '' : 's.'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontFamily: 'var(--font-code)', fontSize: '0.78rem' }}>
                            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Subtotal {rateGroup.shortLabel}: <strong style={{ color: '#10b981' }}>{formatUsd(rateGroup.totalUsd)}</strong></span>
                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{rateGroup.isDirectCurrency ? '0' : formatBs(rateGroup.totalBs)}</span>
                          </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '1040px' }}>
                            <thead>
                              <tr style={{ background: 'rgba(2, 6, 23, 0.45)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '0.55rem 0.75rem' }}>Correlativo</th>
                                <th style={{ padding: '0.55rem 0.75rem' }}>Fecha / Hora</th>
                                <th style={{ padding: '0.55rem 0.75rem' }}>Factura / N.E.</th>
                                <th style={{ padding: '0.55rem 0.75rem' }}>Cliente / RIF</th>
                                <th style={{ padding: '0.55rem 0.75rem' }}>Método Pago</th>
                                <th style={{ padding: '0.55rem 0.75rem' }}>Caja / Banco</th>
                                <th style={{ padding: '0.55rem 0.75rem' }}>Ref. / Detalle</th>
                                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>Tasa</th>
                                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>Abono USD</th>
                                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>Equiv. Bs.</th>
                                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>Recibo / Correl.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rateGroup.items.map((mov) => (
                                <tr key={mov.id} style={{ borderTop: '1px solid var(--border-glass)' }}>
                                  <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-code)', fontWeight: 800, color: '#a5b4fc', whiteSpace: 'nowrap' }}>
                                    #{mov.correlativo}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-code)', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                                    <div>{mov.fechaDisplay}</div>
                                    {mov.horaDisplay && (
                                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{mov.horaDisplay}</div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFocusedFactNum(mov.factNum);
                                        handlePickInsertDoc(mov.factNum);
                                      }}
                                      style={{
                                        background: mov.tipoDoc === 'NOTA_ENTREGA' ? 'rgba(217, 119, 6, 0.14)' : 'rgba(2, 132, 199, 0.14)',
                                        border: mov.tipoDoc === 'NOTA_ENTREGA' ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid rgba(2, 132, 199, 0.35)',
                                        color: mov.tipoDoc === 'NOTA_ENTREGA' ? '#fbbf24' : '#38bdf8',
                                        borderRadius: '6px',
                                        padding: '2px 7px',
                                        fontFamily: 'var(--font-code)',
                                        fontWeight: 700,
                                        fontSize: '0.76rem',
                                        cursor: 'pointer'
                                      }}
                                      title="Filtrar solo los movimientos de este documento"
                                    >
                                      #{mov.factNum}
                                    </button>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', maxWidth: '220px' }}>
                                    <div style={{ fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.clienteNombre}>
                                      {mov.clienteNombre}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'var(--font-code)' }}>
                                      {mov.clienteRif || '—'}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      Cobrador: {mov.vendedorNombre || mov.vendedorId || 'Oficina'}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                                    <span style={{
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      background: 'rgba(16, 185, 129, 0.12)',
                                      color: '#34d399',
                                      fontSize: '0.72rem',
                                      fontWeight: 700
                                    }}>
                                      {mov.formaPago}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#e2e8f0', maxWidth: '180px' }}>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.cuentaNombre}>
                                      {mov.cuentaNombre}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#cbd5e1', maxWidth: '200px' }}>
                                    {mov.referencia && (
                                      <div style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: '#f8fafc', fontSize: '0.76rem' }}>
                                        Ref: {mov.referencia}
                                      </div>
                                    )}
                                    {mov.observaciones && (
                                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.observaciones}>
                                        {mov.observaciones}
                                      </div>
                                    )}
                                    {!mov.referencia && !mov.observaciones && '—'}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                    <div>{mov.isDirectCurrency ? '0' : formatBs(mov.tasa)}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: rateGroup.color }}>{rateGroup.shortLabel}</div>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>
                                    {formatUsd(mov.montoUsd)}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                                    {mov.isDirectCurrency ? '0' : formatBs(mov.montoBs)}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const isCreditNoteMov =
                                            String(mov.formaPago || '').toUpperCase() === 'NOTA_CREDITO' ||
                                            String(mov.accountType || '').toUpperCase() === 'NOTA_CREDITO' ||
                                            /^NC-/i.test(String(mov.correlativo || ''));
                                          if (isCreditNoteMov) {
                                            generateCreditDebitNotePDF({
                                              docData: {
                                                tipoDoc: 'NOTA_CREDITO',
                                                numeroDoc: mov.correlativo,
                                                documentoAfectado: mov.factNum,
                                                fecha: mov.fechaRaw || mov.fechaIso,
                                                clienteNombre: mov.clienteNombre,
                                                clienteRif: mov.clienteRif,
                                                tasaDolar: mov.tasa,
                                                subtotalUsd: mov.montoUsd,
                                                ivaUsd: 0,
                                                totalUsd: mov.montoUsd,
                                                motivo: mov.observaciones || `Nota de Crédito #${mov.correlativo} sobre #${mov.factNum}`,
                                                observaciones: mov.observaciones
                                              },
                                              config,
                                              currentUser
                                            });
                                            return;
                                          }
                                          const saldoAnt = round2(Number(mov.restanteDocUsd || 0) + Number(mov.montoUsd || 0));
                                          const saldoRest = round2(Math.max(0, Number(mov.restanteDocUsd || 0)));
                                          generateCollectionReceiptPDF({
                                            receipt: {
                                              cobNum: mov.correlativo,
                                              factNum: mov.factNum,
                                              tipoDoc: mov.tipoDoc,
                                              fecha: mov.fechaRaw || mov.fechaIso,
                                              clienteNombre: mov.clienteNombre,
                                              cliDes: mov.clienteNombre,
                                              coCli: mov.clienteId,
                                              clienteRif: mov.clienteRif,
                                              rif: mov.clienteRif,
                                              vendedorId: mov.vendedorId,
                                              vendedorNombre: mov.vendedorNombre,
                                              cobradorId: mov.vendedorId,
                                              cobradorNombre: mov.vendedorNombre,
                                              tasa: mov.tasa,
                                              tasaPago: mov.tasa,
                                              tipoTasa: mov.tipoTasa,
                                              monedaPago: mov.monedaPago,
                                              montoUsd: mov.montoUsd,
                                              montoBs: mov.montoBs,
                                              formaPago: mov.formaPago,
                                              referencia: mov.referencia,
                                              cuentaNombre: mov.cuentaNombre,
                                              observaciones: mov.observaciones,
                                              descrip: mov.observaciones || `Cobro #${mov.correlativo} Doc #${mov.factNum}`
                                            },
                                            allocations: [{
                                              factNum: mov.factNum,
                                              tipoDoc: mov.tipoDoc,
                                              tipoTasa: mov.tipoTasa,
                                              tasaPago: mov.tasa,
                                              tasa: mov.tasa,
                                              abonoUsd: mov.montoUsd,
                                              montoBs: mov.montoBs,
                                              saldoAnteriorUsd: saldoAnt > 0 ? saldoAnt : mov.montoUsd,
                                              saldoRestanteUsd: saldoRest
                                            }],
                                            config,
                                            currentUser
                                          });
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '0.32rem 0.5rem', borderRadius: '6px' }}
                                        title={`Imprimir Recibo de Cobro #${mov.correlativo}`}
                                      >
                                        <Receipt size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditMovementCorr(mov)}
                                        className="btn"
                                        style={{
                                          padding: '0.32rem 0.5rem',
                                          borderRadius: '6px',
                                          background: 'rgba(245, 158, 11, 0.16)',
                                          color: '#fbbf24',
                                          border: '1px solid rgba(245, 158, 11, 0.4)',
                                          cursor: 'pointer'
                                        }}
                                        title={`Editar correlativo, fecha y cobrador de este movimiento (#${mov.correlativo})`}
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}

              {/* Resúmenes en Pantalla: Por Renglón de Tasa y Por Caja / Banco */}
              {filteredMovements.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '0.85rem', marginTop: '0.25rem' }}>
                  <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.55)' }}>
                    <div style={{ padding: '0.6rem 0.9rem', background: 'rgba(16, 185, 129, 0.12)', borderBottom: '1px solid var(--border-glass)', fontSize: '0.78rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                      Resumen Total por Renglón de Tasa
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(2, 6, 23, 0.45)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.45rem 0.75rem', textAlign: 'left' }}>Clasificación</th>
                          <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>Movs.</th>
                          <th style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>Total USD</th>
                          <th style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>Total Bs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overallRateBreakdown.nonEmptyGroups.map((rg) => (
                          <tr key={`scr-rg-${rg.id}`} style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <td style={{ padding: '0.45rem 0.75rem', fontWeight: 700, color: rg.color }}>{rg.label}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-code)' }}>{rg.count}</td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, color: '#10b981' }}>{formatUsd(rg.totalUsd)}</td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#38bdf8' }}>{rg.isDirectCurrency ? '0' : formatBs(rg.totalBs)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', fontWeight: 900 }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>TOTAL TODAS LAS TASAS</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-code)' }}>{overallRateBreakdown.totals.count}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#10b981' }}>{formatUsd(overallRateBreakdown.totals.totalUsd)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#38bdf8' }}>{formatBs(overallRateBreakdown.totals.totalBs)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.55)' }}>
                    <div style={{ padding: '0.6rem 0.9rem', background: 'rgba(56, 189, 248, 0.12)', borderBottom: '1px solid var(--border-glass)', fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                      Resumen Total por Caja / Banco
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(2, 6, 23, 0.45)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.45rem 0.75rem', textAlign: 'left' }}>Caja / Banco</th>
                          <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>Movs.</th>
                          <th style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>Total USD</th>
                          <th style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>Total Bs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overallCajaBreakdown.rows.map((cj) => (
                          <tr key={`scr-cj-${cj.key}`} style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <td style={{ padding: '0.45rem 0.75rem', fontWeight: 700, color: '#f8fafc' }}>{cj.cuentaNombre}</td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-code)' }}>{cj.count}</td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, color: '#10b981' }}>{formatUsd(cj.totalUsd)}</td>
                            <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#38bdf8' }}>{cj.totalBs > 0 ? formatBs(cj.totalBs) : '0'}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', fontWeight: 900 }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>TOTAL POR CAJAS ({overallCajaBreakdown.rows.length})</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontFamily: 'var(--font-code)' }}>{overallCajaBreakdown.totals.count}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#10b981' }}>{formatUsd(overallCajaBreakdown.totals.totalUsd)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#38bdf8' }}>{formatBs(overallCajaBreakdown.totals.totalBs)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* FORMATO IMPRESIÓN CTRL + P (#printable-cxc-movements-report)   */}
          {/* ============================================================== */}
          <div id="printable-cxc-movements-report" className="cxc-movements-print-only">
            <table className="cxc-print-shell">
              <tbody>
                <tr>
                  <td>
                    {/* Membrete Oficial */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '8px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>
                          {config?.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.'}
                        </div>
                        <div style={{ fontSize: '8.5pt', color: '#334155' }}>
                          RIF: {config?.rif || 'J-30401927-4'} • {config?.direccion || 'Venezuela'}
                        </div>
                        <div style={{ fontSize: '8pt', color: '#475569' }}>
                          Tel: {config?.telefono || ''} • Tasa BCV: {formatBs(effectiveTasaBcv)} • Euro: {formatBs(liveEuroRate)} • Keystone: {formatBs(effectiveTasaKeystone)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10.5pt', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
                          REPORTE DE MOVIMIENTOS Y ABONOS CXC
                        </div>
                        <div style={{
                          display: 'inline-block',
                          marginTop: '3px',
                          padding: '3px 10px',
                          border: '1.5px solid #0f172a',
                          borderRadius: '4px',
                          fontSize: '10.5pt',
                          fontWeight: 900,
                          fontFamily: 'monospace'
                        }}>
                          CORRELATIVO N° {currentReportCorrelativo}
                        </div>
                        <div style={{ fontSize: '8pt', color: '#475569', marginTop: '3px' }}>
                          Impreso: {new Date().toLocaleDateString('es-VE')} {new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>
                      </div>
                    </div>

                    {/* Meta de Filtros y Rango de Correlativos */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 10px', marginBottom: '10px', fontSize: '8.5pt' }}>
                      <div>
                        <strong>Criterio:</strong> {filterSummaryText}
                      </div>
                      <div>
                        <strong>Movimientos:</strong> {summaryStats.count}
                        {summaryStats.minCorr && (
                          <span style={{ marginLeft: '8px' }}>
                            (Corr. Mov: #{summaryStats.minCorr}{summaryStats.maxCorr && summaryStats.maxCorr !== summaryStats.minCorr ? ` al #${summaryStats.maxCorr}` : ''})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tablas Agrupadas por Día y Clasificadas por Renglón de Tasa */}
                    {movementsByDay.map((dayGroup) => (
                      <div key={`print-${dayGroup.fechaIso}`} className="cxc-print-day-block">
                        <div
                          className="cxc-print-day-header"
                          style={{
                            background: '#cbd5e1',
                            border: '1px solid #64748b',
                            padding: '4px 7px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                            fontWeight: 900,
                            fontSize: '8.2pt'
                          }}
                        >
                          <span>DÍA: {dayGroup.fechaLarga.toUpperCase()} ({dayGroup.items.length} movs.)</span>
                          <span style={{ whiteSpace: 'nowrap', fontSize: '8pt' }}>TOTAL DÍA: {formatUsd(dayGroup.totalUsd)} | {dayGroup.totalBs > 0 ? formatBs(dayGroup.totalBs) : '0'}</span>
                        </div>

                        {(dayGroup.rateBreakdown?.nonEmptyGroups || []).map((rateGroup) => (
                          <div key={`print-${dayGroup.fechaIso}-${rateGroup.id}`} style={{ marginTop: '5px', marginBottom: '6px', width: '100%' }}>
                            <div
                              className="cxc-print-day-header"
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #94a3b8',
                                borderBottom: 'none',
                                padding: '3px 7px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '6px',
                                flexWrap: 'nowrap',
                                fontWeight: 800,
                                fontSize: '7.4pt'
                              }}
                            >
                              <span style={{ flex: '1 1 auto', minWidth: 0 }}>{rateGroup.printTitle} ({rateGroup.count} mov{rateGroup.count === 1 ? '' : 's.'})</span>
                              <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '7.4pt' }}>SUBTOTAL {rateGroup.shortLabel}: {formatUsd(rateGroup.totalUsd)} | {rateGroup.isDirectCurrency ? '0' : formatBs(rateGroup.totalBs)}</span>
                            </div>
                            <table className="cxc-print-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '8%', whiteSpace: 'nowrap' }}>Correl.</th>
                                  <th style={{ width: '8%', whiteSpace: 'nowrap' }}>Doc.</th>
                                  <th style={{ width: '20%' }}>Cliente / RIF</th>
                                  <th style={{ width: '11%' }}>Método</th>
                                  <th style={{ width: '11%' }}>Caja / Banco</th>
                                  <th style={{ width: '8%' }}>Ref.</th>
                                  <th style={{ width: '11%', textAlign: 'right', whiteSpace: 'nowrap' }}>Tasa</th>
                                  <th style={{ width: '10%', textAlign: 'right', whiteSpace: 'nowrap' }}>Abono $</th>
                                  <th style={{ width: '13%', textAlign: 'right', whiteSpace: 'nowrap' }}>Equiv. Bs.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rateGroup.items.map((mov) => (
                                  <tr key={`p-${mov.id}`}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '7.1pt' }}>#{mov.correlativo}</td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '7.1pt' }}>#{mov.factNum}</td>
                                    <td>
                                      <div style={{ fontWeight: 700, fontSize: '7.2pt' }}>{mov.clienteNombre}</div>
                                      {mov.clienteRif && <div style={{ fontSize: '6.8pt', color: '#475569' }}>{mov.clienteRif}</div>}
                                    </td>
                                    <td style={{ fontSize: '7.0pt' }}>{mov.formaPago}</td>
                                    <td style={{ fontSize: '7.0pt' }}>{mov.cuentaNombre}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '7.0pt' }}>{mov.referencia || '—'}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '7.1pt', whiteSpace: 'nowrap' }}>{mov.isDirectCurrency ? '0' : formatBs(mov.tasa)}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: '7.1pt', whiteSpace: 'nowrap' }}>{formatUsd(mov.montoUsd)}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '7.1pt', whiteSpace: 'nowrap' }}>{mov.isDirectCurrency ? '0' : formatBs(mov.montoBs)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Cuadro Final de Clasificación y Sumatoria Total por Renglón de Tasa */}
                    <div className="cxc-print-footer-totals" style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '8.8pt', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                        RESUMEN Y SUMATORIA FINAL POR RENGLÓN DE TASA (TODAS LAS TASAS)
                      </div>
                      <table className="cxc-print-table">
                        <thead>
                          <tr>
                            <th style={{ width: '48%', textAlign: 'left' }}>Renglón / Clasificación de Tasa</th>
                            <th style={{ width: '14%', textAlign: 'center' }}>Movimientos</th>
                            <th style={{ width: '19%', textAlign: 'right' }}>Total Divisas (USD)</th>
                            <th style={{ width: '19%', textAlign: 'right' }}>Total Bolívares (Bs.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overallRateBreakdown.groups.map((rg) => (
                            <tr key={`sum-${rg.id}`}>
                              <td style={{ fontWeight: 700 }}>
                                {rg.label}{rg.id === 'BCV' ? ' (incl. Documentos Fiscales)' : ''}
                              </td>
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{rg.count}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatUsd(rg.totalUsd)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{rg.isDirectCurrency ? '0' : formatBs(rg.totalBs)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: '#e2e8f0', fontWeight: 900, fontSize: '9.5pt' }}>
                            <td>TOTAL GENERAL TODAS LAS TASAS ({summaryStats.daysCount} día(s))</td>
                            <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{overallRateBreakdown.totals.count}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatUsd(overallRateBreakdown.totals.totalUsd)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{overallRateBreakdown.totals.totalBs > 0 ? formatBs(overallRateBreakdown.totals.totalBs) : '0'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Cuadro Final de Sumatoria Total por Caja / Banco */}
                    <div className="cxc-print-footer-totals" style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '8.8pt', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                        RESUMEN Y SUMATORIA FINAL POR CAJA / BANCO
                      </div>
                      <table className="cxc-print-table">
                        <thead>
                          <tr>
                            <th style={{ width: '48%', textAlign: 'left' }}>Caja / Banco Receptor</th>
                            <th style={{ width: '14%', textAlign: 'center' }}>Movimientos</th>
                            <th style={{ width: '19%', textAlign: 'right' }}>Total Divisas (USD)</th>
                            <th style={{ width: '19%', textAlign: 'right' }}>Total Bolívares (Bs.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overallCajaBreakdown.rows.map((cj) => (
                            <tr key={`sum-caja-${cj.key}`}>
                              <td style={{ fontWeight: 700 }}>{cj.cuentaNombre}</td>
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{cj.count}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatUsd(cj.totalUsd)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{cj.totalBs > 0 ? formatBs(cj.totalBs) : '0'}</td>
                            </tr>
                          ))}
                          <tr style={{ background: '#e2e8f0', fontWeight: 900, fontSize: '9.5pt' }}>
                            <td>TOTAL GENERAL POR CAJAS ({overallCajaBreakdown.rows.length} caja(s)/banco(s))</td>
                            <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{overallCajaBreakdown.totals.count}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatUsd(overallCajaBreakdown.totals.totalUsd)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{overallCajaBreakdown.totals.totalBs > 0 ? formatBs(overallCajaBreakdown.totals.totalBs) : '0'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <div className="cxc-print-footer-spacer">&nbsp;</div>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Firmas ancladas al pie de página de cada hoja impresa */}
            <div className="cxc-print-fixed-signatures">
              <div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px' }}>
                  <strong>Elaborado por:</strong> {currentUser?.nombre || 'Cobranzas / Administración'}
                </div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px' }}>
                  <strong>Revisado y Conformado (Gerencia / Tesorería)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODAL PARA ASIGNAR MANUALMENTE CORRELATIVO DE MOVIMIENTOS Y REPORTE */}
      {/* ================================================================== */}
      {showCorrelativoModal && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCorrelativoModal(false);
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '540px',
            background: 'var(--bg-card, #111827)',
            border: '1px solid rgba(99, 102, 241, 0.45)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 55px rgba(0,0,0,0.85)'
          }}>
            <div style={{
              padding: '1.1rem 1.35rem',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.22), rgba(2,132,199,0.12))',
              borderBottom: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Hash size={18} color="#a5b4fc" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  Fijar Correlativo de Movimientos y Reporte CxC
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrelativoModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Bloque 1: Correlativo de cada Movimiento */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99, 102, 241, 0.35)', borderRadius: '12px', padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase' }}>
                    Próximo N° Correlativo de Movimiento / Abono
                  </span>
                  <span style={{ fontFamily: 'var(--font-code)', fontWeight: 900, fontSize: '1rem', color: '#ffffff' }}>
                    #{String(Math.max(1, parseInt(String(manualMovInput || '1').replace(/[^0-9]/g, ''), 10) || 1)).padStart(6, '0')}
                  </span>
                </div>
                <input
                  type="text"
                  value={manualMovInput}
                  onChange={(e) => setManualMovInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="Ej. 000001"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid rgba(99, 102, 241, 0.5)',
                    background: 'rgba(0,0,0,0.35)',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    letterSpacing: '3px',
                    textAlign: 'center'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setManualMovInput('000001')}
                    style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-glass)', color: '#e2e8f0', fontSize: '0.74rem', cursor: 'pointer' }}
                  >
                    000001 (Iniciar en 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualMovInput('000100')}
                    style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-glass)', color: '#e2e8f0', fontSize: '0.74rem', cursor: 'pointer' }}
                  >
                    000100
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAutoMovCorrelativo}
                    style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', fontSize: '0.74rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RotateCcw size={12} />
                    <span>Automático</span>
                  </button>
                </div>
              </div>

              {/* Bloque 2: Correlativo del Reporte Impreso (Ctrl + P) */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(14, 165, 233, 0.35)', borderRadius: '12px', padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                    N° Correlativo del Reporte Impreso (Ctrl + P)
                  </span>
                  <span style={{ fontFamily: 'var(--font-code)', fontWeight: 900, fontSize: '1rem', color: '#ffffff' }}>
                    REP-#{String(Math.max(1, parseInt(String(manualReportInput || '1').replace(/[^0-9]/g, ''), 10) || 1)).padStart(6, '0')}
                  </span>
                </div>
                <input
                  type="text"
                  value={manualReportInput}
                  onChange={(e) => setManualReportInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="Ej. 000001"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid rgba(14, 165, 233, 0.5)',
                    background: 'rgba(0,0,0,0.35)',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    letterSpacing: '3px',
                    textAlign: 'center'
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.65rem', fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoIncrementReportOnPrint}
                    onChange={(e) => setAutoIncrementReportOnPrint(e.target.checked)}
                  />
                  <span>Incrementar automáticamente (+1) el correlativo del reporte al imprimir con el botón</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCorrelativoModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 1rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualCorrelativos}
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.2rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Check size={16} />
                  <span>Guardar y Fijar Correlativos</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL PARA EDITAR MANUALMENTE EL CORRELATIVO DE UN MOVIMIENTO      */}
      {/* ================================================================== */}
      {editingMovementCorr && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 10060,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingEditMovCorr) setEditingMovementCorr(null);
          }}
        >
          <form
            onSubmit={handleSaveMovementCorrelativoEdit}
            style={{
              width: '100%',
              maxWidth: '470px',
              background: 'var(--bg-card, #111827)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 55px rgba(0,0,0,0.85)'
            }}
          >
            <div style={{
              padding: '1rem 1.25rem',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(79,70,229,0.12))',
              borderBottom: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={17} color="#fbbf24" />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
                  Editar Movimiento de Cobro
                </h3>
              </div>
              <button
                type="button"
                disabled={isSavingEditMovCorr}
                onClick={() => setEditingMovementCorr(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: '10px',
                padding: '0.75rem 0.9rem',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Documento: <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-code)' }}>#{editingMovementCorr.factNum}</strong></span>
                  <span>Fecha: <strong style={{ color: '#e2e8f0' }}>{editingMovementCorr.fechaDisplay}</strong></span>
                </div>
                <div style={{ color: '#f8fafc', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingMovementCorr.clienteNombre}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ color: '#10b981', fontWeight: 800, fontFamily: 'var(--font-code)' }}>
                    {formatUsd(editingMovementCorr.montoUsd)} | {formatBs(editingMovementCorr.montoBs)}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: '#a5b4fc', fontFamily: 'var(--font-code)' }}>
                    Actual: #{editingMovementCorr.correlativo}
                  </span>
                </div>
                <div style={{ fontSize: '0.73rem', color: '#38bdf8', fontWeight: 600 }}>
                  Cobrador actual: {editingMovementCorr.vendedorNombre || editingMovementCorr.vendedorId || 'Oficina'}
                </div>
                {Number(editingMovementCorr.affectedDocsCount || 0) > 1 && (
                  <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '2px' }}>
                    Nota: Este cobro aplica a {editingMovementCorr.affectedDocsCount} documentos y actualizará su N° de recibo compartido, fecha y cobrador.
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                    Nuevo N° Correlativo del Movimiento *
                  </label>
                  <span style={{ fontFamily: 'var(--font-code)', fontWeight: 900, fontSize: '0.95rem', color: '#ffffff' }}>
                    #{String(Math.max(1, parseInt(String(editMovCorrInput || '1').replace(/[^0-9]/g, ''), 10) || 1)).padStart(6, '0')}
                  </span>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={editMovCorrInput}
                  onChange={(e) => setEditMovCorrInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="Ej. 000015"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    border: '1.5px solid rgba(245, 158, 11, 0.55)',
                    background: 'rgba(0,0,0,0.35)',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    letterSpacing: '3px',
                    textAlign: 'center'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={editMovFechaInput}
                    onChange={(e) => setEditMovFechaInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.58rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)',
                      background: 'rgba(0,0,0,0.35)',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      fontFamily: 'var(--font-code)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Cobrador *
                  </label>
                  <select
                    required
                    value={editMovCobradorId}
                    onChange={(e) => setEditMovCobradorId(e.target.value)}
                    className="select-modern"
                    style={{
                      width: '100%',
                      padding: '0.58rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(56, 189, 248, 0.45)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      fontWeight: 600
                    }}
                  >
                    {sellerCatalogOptions.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(() => {
                const candidateNum = parseInt(String(editMovCorrInput || '').replace(/[^0-9]/g, ''), 10);
                if (!candidateNum || candidateNum < 1) return null;
                const candidatePadded = String(Math.min(999999, candidateNum)).padStart(6, '0');
                if (candidatePadded === editingMovementCorr.correlativo) return null;
                const conflict = allMovements.find(m => m.id !== editingMovementCorr.id && m.correlativo === candidatePadded);
                if (!conflict) return null;
                return (
                  <div style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fbbf24',
                    fontSize: '0.75rem'
                  }}>
                    Aviso: Ya existe otro movimiento con el correlativo #{candidatePadded} (Doc #{conflict.factNum} del {conflict.fechaDisplay}). Puede guardarlo si desea ajustarlo así.
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  disabled={isSavingEditMovCorr}
                  onClick={() => setEditingMovementCorr(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 1rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditMovCorr}
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.2rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Check size={16} />
                  <span>{isSavingEditMovCorr ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}

export default CxcMovementsModal;
