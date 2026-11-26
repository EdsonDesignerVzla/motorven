import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Database,
  FileText,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Check,
  X,
  Calendar
} from 'lucide-react';
import {
  REAL_CONFIG,
  REAL_CLIENTS,
  REAL_PROFIT_SELLERS,
  REAL_PROFIT_INVOICES
} from '../data/supabaseRealData';
import {
  getSupabaseConfig,
  getSupabaseClients,
  getSupabaseProfitSellers,
  getSupabaseProfitInvoices,
  getSupabaseSales,
  saveSupabaseProfitInvoice,
  deleteSupabaseSale,
  getScopedCxcDeleteKeys,
  isCxcEntryDeleted,
  markCxcDocDeleted,
  sanitizeCxcDeletedDocsStorage
} from '../services/supabaseService';
import { subscribeToRealtimeChanges } from '../services/profitService';
import { formatUsd, formatBs } from '../services/formatService';
import { getNextInvoiceCorrelativo, getNextNotaEntregaCorrelativo } from '../services/fiscalService';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';
import { isCxcInvoiceCancelled, inferCxcDocType, getCxcScopedDocKey } from '../utils/cxcUtils';
import { resolveRateMeta, resolveRecordRateType, resolveEffectiveRateNumber, isDirectCurrencyRateType, RATE_TYPE_META } from '../utils/rateClassificationUtils';

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

const FORMA_PAGO_DIAS = {
  '01': 0,
  '02': 7,
  '03': 15,
  '04': 21,
  '05': 30,
  '06': 45,
  '07': 60
};

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

const normalizeSearchText = (str) =>
  String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getTodayIso = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseDateSafe = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? new Date() : dateStr;
  }
  const s = String(dateStr).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const dmyMatch = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toIsoDateInput = (dateInput) => {
  if (!dateInput) return getTodayIso();
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const dmyMatch = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }
  const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
  if (isNaN(d.getTime())) return getTodayIso();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateShort = (dateInput) => {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const canonicalDocLookupKey = (rawDocOrKey, tipoDoc = 'FACTURA') =>
  getCxcScopedDocKey(rawDocOrKey, tipoDoc);

const resolveSellerFromCatalog = (rawId, rawName, sellerCatalog) => {
  const idTrim = String(rawId || '').trim().toUpperCase();
  const nameTrim = String(rawName || '').trim();

  if (idTrim && idTrim !== 'OF' && sellerCatalog.has(idTrim)) {
    return {
      sellerId: idTrim,
      sellerName: sellerCatalog.get(idTrim) || nameTrim || idTrim
    };
  }

  const candidates = [nameTrim, idTrim].filter(Boolean);
  for (const candidate of candidates) {
    const normCandidate = normalizeSearchText(candidate);
    if (!normCandidate || normCandidate === 'of' || normCandidate === 'oficina') continue;
    for (const [catId, catName] of sellerCatalog.entries()) {
      const normCatName = normalizeSearchText(catName);
      if (
        normCatName === normCandidate ||
        (normCandidate.length >= 4 && normCatName.includes(normCandidate)) ||
        (normCatName.length >= 4 && normCandidate.includes(normCatName))
      ) {
        return {
          sellerId: catId,
          sellerName: catName
        };
      }
    }
  }

  if (idTrim && idTrim.length <= 5 && !idTrim.includes(' ')) {
    return {
      sellerId: idTrim,
      sellerName: sellerCatalog.get(idTrim) || nameTrim || (idTrim === 'OF' ? 'Oficina' : idTrim)
    };
  }

  return {
    sellerId: 'OF',
    sellerName: nameTrim || sellerCatalog.get('OF') || 'Oficina'
  };
};

const inferDocType = (raw) => {
  const explicit = String(raw?.tipoDoc || raw?.tipo_doc || raw?.docType || '').toUpperCase().trim();
  if (explicit === 'NOTA_ENTREGA' || explicit === 'N/E' || explicit === 'NE') {
    return 'NOTA_ENTREGA';
  }
  const idStr = String(raw?.id || '').toUpperCase().trim();
  const factStr = String(raw?.factNum || raw?.factura || raw?.numeroDoc || '').toUpperCase().trim();
  const origStr = String(raw?.pedidoOrigenDoc || raw?.pedido_origen_doc || '').toUpperCase().trim();
  if (
    idStr.startsWith('NE-') ||
    idStr.startsWith('NDE-') ||
    factStr.startsWith('NE-') ||
    factStr.startsWith('NDE-') ||
    factStr.startsWith('NE') ||
    origStr.startsWith('PED-NE')
  ) {
    return 'NOTA_ENTREGA';
  }
  return 'FACTURA';
};

export default function ProfitCxcStandaloneView() {
  const [config, setConfig] = useState(REAL_CONFIG);
  const [profitInvoices, setProfitInvoices] = useState(REAL_PROFIT_INVOICES);
  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState(REAL_CLIENTS);
  const [sellers, setSellers] = useState(REAL_PROFIT_SELLERS);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingRowKey, setSavingRowKey] = useState(null);
  const [statusBanner, setStatusBanner] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date().toLocaleTimeString('es-VE'));

  // Filtros y Ordenamiento (Por defecto: Fecha de Emisión de Mayor a Menor)
  const [docTypeFilter, setDocTypeFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('docType');
      if (p === 'FACTURA' || p === 'NOTA_ENTREGA' || p === 'ALL') return p;
    }
    return 'ALL';
  });
  const [statusFilter, setStatusFilter] = useState('PENDIENTES'); // 'PENDIENTES' | 'VENCIDA' | 'POR_VENCER' | 'PAGADA' | 'ALL'
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState('fechaEmision');
  const [sortDirection, setSortDirection] = useState('desc'); // 'desc' = Mayor a Menor (Más reciente primero)

  // Ediciones en memoria antes o durante el guardado (key -> campos editados)
  const [editedRows, setEditedRows] = useState({});
  const [localOverrides, setLocalOverrides] = useState({});

  const tasaBcv = Number(config?.tasaDolar) > 0 ? Number(config.tasaDolar) : 451.51;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Tabla Cuentas por Cobrar (Profit) — GRUPO MOTORVEN';
    }
  }, []);

  const showNotice = useCallback((type, text) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const loadDatabaseData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [cfgData, invData, salesData, cliData, selData] = await Promise.all([
          getSupabaseConfig().catch(() => null),
          getSupabaseProfitInvoices().catch(() => null),
          getSupabaseSales().catch(() => null),
          getSupabaseClients().catch(() => null),
          getSupabaseProfitSellers().catch(() => null)
        ]);
        if (cfgData) setConfig(cfgData);
        if (Array.isArray(invData) && invData.length > 0) setProfitInvoices(invData);
        if (Array.isArray(salesData)) setSales(salesData);
        if (Array.isArray(cliData) && cliData.length > 0) setClients(cliData);
        if (Array.isArray(selData) && selData.length > 0) setSellers(selData);
        setLastSyncTime(new Date().toLocaleTimeString('es-VE'));
        if (!silent) {
          showNotice('success', 'Datos de Cuentas por Cobrar leídos y sincronizados desde la base de datos Profit.');
        }
      } catch (err) {
        console.error('Error cargando CxC Profit:', err);
        if (!silent) {
          showNotice('error', 'Error leyendo la base de datos; mostrando respaldo activo.');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showNotice]
  );

  useEffect(() => {
    loadDatabaseData(false);
    const unsubscribe = subscribeToRealtimeChanges({
      onInvoicesChange: () => loadDatabaseData(true),
      onSalesChange: () => loadDatabaseData(true),
      onCollectionsChange: () => loadDatabaseData(true),
      onConfigChange: () => loadDatabaseData(true)
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadDatabaseData]);

  const sellerCatalog = useMemo(() => {
    const map = new Map();
    (REAL_PROFIT_SELLERS || []).forEach((s) => {
      const id = String(s.id || s.co_ven || '').trim().toUpperCase();
      if (id) map.set(id, s.name || s.ven_des || id);
    });
    (sellers || []).forEach((s) => {
      const id = String(s.id || s.co_ven || '').trim().toUpperCase();
      if (id) map.set(id, s.name || s.ven_des || id);
    });
    return map;
  }, [sellers]);

  // Construcción unificada de la tabla de Cuentas por Cobrar de Profit
  const allDocuments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rawMap = new Map();
    const canonicalKeyToRawKey = new Map();
    const delSet = new Set(sanitizeCxcDeletedDocsStorage().map((k) => String(k).trim()).filter(Boolean));
    const isDocDeleted = (docOrObj) => isCxcEntryDeleted(docOrObj, delSet);

    (profitInvoices || []).forEach((inv) => {
      const key = String(inv.factNum || inv.id || '').trim();
      if (!key || isDocDeleted(inv)) return;
      const docType = inferDocType(inv);
      const cKey = canonicalDocLookupKey(inv, docType);
      const isPosFormat = /^0+\d+$/.test(key) || /^NE-0+\d+$/i.test(key);
      const resolvedInvSeller = resolveSellerFromCatalog(
        inv.vendedorId || inv.co_ven,
        inv.vendedorNombre || inv.vendedor,
        sellerCatalog
      );
      const normalizedInv = {
        ...inv,
        vendedorId: resolvedInvSeller.sellerId,
        vendedorNombre: resolvedInvSeller.sellerName,
        _source: isPosFormat ? 'POS' : 'PROFIT',
        _isPosSale: isPosFormat
      };

      const existingRawKey = cKey ? canonicalKeyToRawKey.get(cKey) : null;
      if (existingRawKey && rawMap.has(existingRawKey)) {
        const existing = rawMap.get(existingRawKey);
        const existingRif = String(existing.clienteRif || existing.rif || '').replace(/[-.\s]/g, '').toUpperCase();
        const incomingRif = String(inv.clienteRif || inv.rif || '').replace(/[-.\s]/g, '').toUpperCase();
        const sameClient =
          (existingRif && incomingRif && existingRif === incomingRif) ||
          normalizeSearchText(existing.clienteNombre) === normalizeSearchText(inv.clienteNombre);

        if (sameClient) {
          // Unificar duplicado ej. "583" (KB) y "000583" (OF) conservando el número limpio y el vendedor real
          const preferredKey = /^0+\d+$/.test(existingRawKey) && !/^0+\d+$/.test(key) ? key : existingRawKey;
          const mergedSeller = resolveSellerFromCatalog(
            existing.vendedorId && existing.vendedorId !== 'OF' ? existing.vendedorId : normalizedInv.vendedorId,
            existing.vendedorNombre || normalizedInv.vendedorNombre,
            sellerCatalog
          );
          if (preferredKey !== existingRawKey) {
            rawMap.delete(existingRawKey);
          }
          rawMap.set(preferredKey, {
            ...existing,
            ...normalizedInv,
            factNum: preferredKey,
            vendedorId: mergedSeller.sellerId,
            vendedorNombre: mergedSeller.sellerName
          });
          if (cKey) canonicalKeyToRawKey.set(cKey, preferredKey);
          return;
        }
      }

      const existingSameRaw = rawMap.get(key);
      const mapKey =
        existingSameRaw && canonicalDocLookupKey(existingSameRaw, inferDocType(existingSameRaw)) !== cKey
          ? (cKey || `${docType}:${key}`)
          : key;
      rawMap.set(mapKey, normalizedInv);
      if (cKey) canonicalKeyToRawKey.set(cKey, mapKey);
    });

    (sales || []).forEach((sale) => {
      const rawTipo = String(sale.tipoDoc || sale.tipo_doc || '').toUpperCase().trim();
      const saleIdUpper = String(sale.id || '').toUpperCase().trim();
      if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION' || saleIdUpper.startsWith('NOTA_DEBITO-')) return;
      const saleDocType = inferDocType(sale);
      const isNotaEntregaSale = saleDocType === 'NOTA_ENTREGA';
      const key = String(sale.factura || sale.factNum || sale.numeroDoc || sale.id || '').trim();
      if (!key || isDocDeleted({ ...sale, tipoDoc: saleDocType })) return;

      const cKey = canonicalDocLookupKey({ ...sale, factNum: key, tipoDoc: saleDocType }, saleDocType);
      const rawMapHasSameCKey =
        rawMap.has(key) &&
        canonicalDocLookupKey(rawMap.get(key), inferDocType(rawMap.get(key))) === cKey;
      const existingRawKey = rawMap.has(cKey) ? cKey : (rawMapHasSameCKey ? key : cKey ? canonicalKeyToRawKey.get(cKey) : null);

      const rawSaleTotal = Number(sale.totalUsd ?? sale.totNetoUsd ?? 0);
      const rawSaleIva = Number(sale.impuestoUsd ?? sale.ivaUsd ?? 0);
      const rawSaleSub = Number(
        sale.subtotalUsd ??
          sale.totBrutoUsd ??
          (rawSaleIva > 0 && rawSaleTotal > rawSaleIva ? rawSaleTotal - rawSaleIva : rawSaleTotal)
      );
      const neNetoSinIva = round2(
        rawSaleSub > 0 && rawSaleSub < rawSaleTotal
          ? rawSaleSub
          : rawSaleIva > 0 && rawSaleTotal > rawSaleIva
          ? rawSaleTotal - rawSaleIva
          : rawSaleSub
      );
      const effectiveTotBruto = isNotaEntregaSale ? neNetoSinIva : round2(rawSaleSub);
      const effectiveIva = isNotaEntregaSale ? 0 : round2(rawSaleIva);
      const effectiveTotNeto = isNotaEntregaSale
        ? neNetoSinIva
        : round2(rawSaleTotal || effectiveTotBruto + effectiveIva);

      const hasExplicitCobros = Array.isArray(sale.historialCobros) && sale.historialCobros.length > 0;
      const effectiveAbonos = hasExplicitCobros
        ? Number(sale.abonosUsd ?? sale.montoPagadoUsd ?? 0)
        : 0;
      const effectiveSaldo = Math.max(0, round2(effectiveTotNeto - effectiveAbonos));

      const resolvedSaleSeller = resolveSellerFromCatalog(
        sale.vendedorId,
        sale.vendedor || sale.vendedorNombre,
        sellerCatalog
      );

      if (!existingRawKey) {
        const existingSameRaw = rawMap.get(key);
        const mapKey =
          existingSameRaw && canonicalDocLookupKey(existingSameRaw, inferDocType(existingSameRaw)) !== cKey
            ? (cKey || `${saleDocType}:${key}`)
            : key;
        rawMap.set(mapKey, {
          id: sale.id || `DOC-${key}`,
          factNum: key,
          tipoDoc: saleDocType,
          fechaEmision: sale.fechaEmision || sale.fecha || getTodayIso(),
          fechaVencimiento: sale.fechaVencimiento || sale.fechaEmision || sale.fecha || getTodayIso(),
          clienteId: sale.clienteId || '',
          clienteNombre: sale.cliente || sale.clienteNombre || 'Cliente General',
          clienteRif: sale.rif || sale.clienteRif || 'N/A',
          vendedorId: resolvedSaleSeller.sellerId,
          vendedorNombre: resolvedSaleSeller.sellerName,
          formaPago: Number(sale.diasCredito || 0) > 0 ? '03' : '01',
          diasCredito: sale.diasCredito !== undefined ? Number(sale.diasCredito) : 0,
          diasVencidoCustom: sale.diasVencidoCustom !== undefined ? sale.diasVencidoCustom : null,
          totBrutoUsd: effectiveTotBruto,
          ivaUsd: effectiveIva,
          totNetoUsd: effectiveTotNeto,
          abonosUsd: effectiveAbonos,
          saldoUsd: effectiveSaldo,
          moneda: sale.moneda || 'USD',
          tasa: Number(sale.tasa || sale.tasaDolar || tasaBcv),
          anulada: Boolean(sale.anulada),
          items: sale.items || [],
          observaciones: sale.observaciones || '',
          historialCobros: sale.historialCobros || [],
          _source: 'POS',
          _isPosSale: true
        });
        if (cKey) canonicalKeyToRawKey.set(cKey, mapKey);
      } else {
        const existing = rawMap.get(existingRawKey);
        const resolvedMergedSeller = resolveSellerFromCatalog(
          existing.vendedorId && existing.vendedorId !== 'OF' ? existing.vendedorId : resolvedSaleSeller.sellerId,
          existing.vendedorNombre || resolvedSaleSeller.sellerName,
          sellerCatalog
        );
        rawMap.set(existingRawKey, {
          ...existing,
          fechaEmision: existing.fechaEmision || sale.fechaEmision || sale.fecha,
          vendedorId: resolvedMergedSeller.sellerId,
          vendedorNombre: resolvedMergedSeller.sellerName,
          _source: existing._source || 'POS',
          _isPosSale: true
        });
      }
    });

    Object.entries(localOverrides).forEach(([key, override]) => {
      if (override?._deleted) {
        rawMap.delete(key);
        const delTipo = override._tipoDoc ? inferCxcDocType({ tipoDoc: override._tipoDoc }) : inferCxcDocType(key);
        const delNum = String(key).replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').replace(/^0+(?=\d)/, '').trim();
        for (const [mapK, mapVal] of Array.from(rawMap.entries())) {
          if (mapK === key) {
            rawMap.delete(mapK);
            continue;
          }
          if (inferCxcDocType(mapVal) !== delTipo) continue;
          const mapNum = String(mapVal?.factNum || mapK).replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').replace(/^0+(?=\d)/, '').trim();
          if (delNum && mapNum === delNum) {
            rawMap.delete(mapK);
          }
        }
        return;
      }
      const existing = rawMap.get(key) || {};
      rawMap.set(key, { ...existing, ...override });
    });

    const processed = [];
    rawMap.forEach((inv, mapKey) => {
      if (isCxcInvoiceCancelled(inv)) return;

      const factNum = String(inv.factNum || inv.factura || mapKey).trim();
      const tipoDoc = inferCxcDocType(inv);
      const isNotaEntrega = tipoDoc === 'NOTA_ENTREGA';
      const isPosDoc =
        Boolean(inv._isPosSale) ||
        inv._source === 'POS' ||
        /^0+\d+$/.test(factNum) ||
        /^NE-0+\d+$/i.test(factNum);

      const rawNeto = Number(inv.totNetoUsd ?? inv.totalUsd ?? inv.totBrutoUsd ?? 0);
      const rawIva = Number(inv.ivaUsd ?? inv.impuestoUsd ?? 0);
      const rawBrutoCandidate = Number(
        inv.totBrutoUsd ??
          inv.subtotalUsd ??
          (isNotaEntrega
            ? rawIva > 0 && rawNeto > rawIva
              ? rawNeto - rawIva
              : rawNeto
            : round2(rawNeto / 1.16))
      );
      const totBrutoUsd = isNotaEntrega
        ? round2(
            rawBrutoCandidate > 0 && rawBrutoCandidate < rawNeto
              ? rawBrutoCandidate
              : rawIva > 0 && rawNeto > rawIva
              ? rawNeto - rawIva
              : rawBrutoCandidate
          )
        : round2(rawBrutoCandidate);
      const ivaUsd = isNotaEntrega
        ? 0
        : round2(inv.ivaUsd !== undefined ? Number(inv.ivaUsd) : Math.max(0, rawNeto - totBrutoUsd));
      const montoFacturaUsd = isNotaEntrega
        ? totBrutoUsd
        : round2(Number(inv.totNetoUsd ?? totBrutoUsd + ivaUsd));

      const hasCobroHistory = Array.isArray(inv.historialCobros) && inv.historialCobros.length > 0;
      const hasManualOverride = Boolean(localOverrides[factNum]);
      let abonosUsd = 0;
      if (isPosDoc && !hasCobroHistory && !hasManualOverride && Number(inv.saldoUsd ?? 0) <= 0.01) {
        abonosUsd = 0;
      } else if (inv.abonosUsd !== undefined && inv.abonosUsd !== null && !isNaN(Number(inv.abonosUsd))) {
        abonosUsd = round2(Math.max(0, Number(inv.abonosUsd)));
      } else if (inv.saldoUsd !== undefined && inv.saldoUsd !== null && !isNaN(Number(inv.saldoUsd))) {
        const baseForAbonos =
          !isNotaEntrega || Number(inv.saldoUsd) <= montoFacturaUsd ? montoFacturaUsd : rawNeto;
        abonosUsd = round2(Math.max(0, baseForAbonos - Number(inv.saldoUsd)));
      }
      if (abonosUsd > montoFacturaUsd) abonosUsd = montoFacturaUsd;
      const restanteUsd = round2(Math.max(0, montoFacturaUsd - abonosUsd));
      const isCarteraActiva = restanteUsd > 0.01 || hasManualOverride || Boolean(inv._customCreated);

      const fechaEmisionDate = parseDateSafe(inv.fechaEmision || inv.fecha);
      const fechaEmisionIso = toIsoDateInput(inv.fechaEmision || inv.fecha);

      let diasCredito =
        inv.diasCredito !== undefined && inv.diasCredito !== null && inv.diasCredito !== ''
          ? Number(inv.diasCredito)
          : FORMA_PAGO_DIAS[String(inv.formaPago || '').trim()] ?? null;

      let fechaVencDate;
      let fechaVencIso;
      if (inv.fechaVencimiento) {
        fechaVencDate = parseDateSafe(inv.fechaVencimiento);
        fechaVencIso = toIsoDateInput(inv.fechaVencimiento);
      } else {
        const dc = diasCredito !== null && !isNaN(diasCredito) && diasCredito > 0 ? diasCredito : 15;
        fechaVencDate = new Date(fechaEmisionDate);
        fechaVencDate.setDate(fechaVencDate.getDate() + dc);
        fechaVencIso = toIsoDateInput(fechaVencDate);
      }

      const diffEmisVenc = Math.round(
        (fechaVencDate.getTime() - fechaEmisionDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffEmisVenc > 0) {
        diasCredito = diffEmisVenc;
      } else if (diasCredito === null || isNaN(diasCredito) || diasCredito <= 0) {
        diasCredito = 15;
        fechaVencDate = new Date(fechaEmisionDate);
        fechaVencDate.setDate(fechaVencDate.getDate() + 15);
        fechaVencIso = toIsoDateInput(fechaVencDate);
      }

      const vencMidnight = new Date(fechaVencDate);
      vencMidnight.setHours(0, 0, 0, 0);
      const diffVencDays = Math.floor((today.getTime() - vencMidnight.getTime()) / (1000 * 60 * 60 * 24));

      const rawDiasVencidos =
        inv.diasVencidoCustom !== undefined &&
        inv.diasVencidoCustom !== null &&
        inv.diasVencidoCustom !== '' &&
        Number(inv.diasVencidoCustom) > 0
          ? Math.max(Number(inv.diasVencidoCustom), Math.max(0, diffVencDays))
          : Math.max(0, diffVencDays);
      const diasVencidos = restanteUsd <= 0.01 ? 0 : rawDiasVencidos;

      const clientObj = clients.find(
        (c) =>
          (inv.clienteId && c.id === inv.clienteId) ||
          (inv.clienteRif && c.rif === inv.clienteRif) ||
          (inv.clienteNombre && c.name?.toLowerCase() === inv.clienteNombre?.toLowerCase())
      );
      const { sellerId, sellerName } = resolveSellerFromCatalog(
        inv.vendedorId,
        inv.vendedorNombre || inv.vendedor,
        sellerCatalog
      );
      const tasaDoc = Number(inv.tasa || tasaBcv) || tasaBcv;
      const estado = restanteUsd <= 0.01 ? 'PAGADA' : diasVencidos > 0 ? 'VENCIDA' : 'POR_VENCER';
      const rifClean = String(inv.clienteRif || clientObj?.rif || 'J-00000000-0');

      processed.push({
        id: inv.id || `INV-${factNum}`,
        factura: factNum,
        factNum,
        tipoDoc,
        vendedorId: sellerId,
        vendedorNombre: sellerName,
        vendedorDisplay: sellerName && sellerName !== sellerId ? `${sellerId} - ${sellerName}` : sellerId,
        clienteId: inv.clienteId || clientObj?.id || 'CLI-GEN',
        cliente: inv.clienteNombre || clientObj?.name || 'Cliente General',
        rif: rifClean,
        fechaEmision: fechaEmisionDate,
        fechaEmisionIso,
        fechaVencimiento: fechaVencDate,
        fechaVencimientoIso: fechaVencIso,
        diasCredito: Number(diasCredito || 0),
        diasVencidos: Number(diasVencidos || 0),
        subtotalUsd: totBrutoUsd,
        ivaUsd,
        montoFacturaUsd,
        abonosUsd,
        restanteUsd,
        tasa: tasaDoc,
        tipoTasa: resolveRecordRateType(inv, 'BCV'),
        tasaPago: resolveEffectiveRateNumber(inv, tasaDoc),
        monedaPago: inv.monedaPago || inv.moneda_pago || (isDirectCurrencyRateType(inv.tipoTasa ?? inv.tipo_tasa) ? 'USD' : 'BS'),
        estado,
        isCarteraActiva,
        observaciones: inv.observaciones || '',
        historialCobros: Array.isArray(inv.historialCobros) ? inv.historialCobros : [],
        _customCreated: Boolean(inv._customCreated),
        _isPosDoc: isPosDoc
      });
    });

    return processed;
  }, [profitInvoices, sales, clients, sellerCatalog, tasaBcv, localOverrides]);

  // Obtener valores actuales de una fila (combinando fila base + edición en curso y recalculando su estado)
  const getRowEffective = useCallback(
    (row) => {
      const draft = editedRows[row.factNum];
      if (!draft) return row;
      const merged = { ...row, ...draft };
      const restante = round2(Math.max(0, Number(merged.restanteUsd ?? 0)));
      const diasVenc = restante <= 0.01 ? 0 : Math.max(0, Number(merged.diasVencidos ?? 0));
      const estado = restante <= 0.01 ? 'PAGADA' : diasVenc > 0 ? 'VENCIDA' : 'POR_VENCER';
      return {
        ...merged,
        restanteUsd: restante,
        diasVencidos: diasVenc,
        estado,
        isCarteraActiva: true
      };
    },
    [editedRows]
  );

  // Construir índice de búsqueda multicriterio dinámico para cualquier fila
  const buildRowSearchBlob = useCallback(
    (eff) => {
      const emisDate = parseDateSafe(eff.fechaEmisionIso || eff.fechaEmision);
      const vencDate = parseDateSafe(eff.fechaVencimientoIso || eff.fechaVencimiento);
      const emisionShort = formatDateShort(emisDate);
      const vencShort = formatDateShort(vencDate);
      const mesEmisionNombre = !isNaN(emisDate.getTime()) ? MESES_ES[emisDate.getMonth()] || '' : '';
      const mesVencNombre = !isNaN(vencDate.getTime()) ? MESES_ES[vencDate.getMonth()] || '' : '';
      const estadoKeywords =
        eff.estado === 'VENCIDA'
          ? 'vencida vencido vencidos mora atrasada atrasado pendiente pendientes'
          : eff.estado === 'POR_VENCER'
          ? 'al dia por vencer vigente corriente pendiente pendientes'
          : 'pagada pagado pagadas solvente solventes cobrada cancelada';
      const tipoKeywords =
        eff.tipoDoc === 'NOTA_ENTREGA'
          ? 'nota de entrega notas ne n/e sin iva'
          : 'factura facturas fiscal fiscales seniat iva';
      const rifClean = String(eff.rif || '');
      const montoUsd = Number(eff.montoFacturaUsd || 0);
      const abonosUsd = Number(eff.abonosUsd || 0);
      const restUsd = Number(eff.restanteUsd || 0);
      const restBs = round2(restUsd * tasaBcv);

      return normalizeSearchText(
        [
          eff.vendedorId,
          eff.vendedorNombre,
          `${eff.vendedorId} - ${eff.vendedorNombre}`,
          eff.factura,
          `#${eff.factura}`,
          String(eff.factura || '').replace(/^0+/, ''),
          eff.factNum,
          eff.tipoDoc,
          tipoKeywords,
          rifClean,
          rifClean.replace(/[-.\s]/g, ''),
          eff.cliente,
          eff.clienteId,
          eff.fechaEmisionIso,
          emisionShort,
          emisionShort.replace(/\//g, '-'),
          mesEmisionNombre,
          eff.fechaVencimientoIso,
          vencShort,
          vencShort.replace(/\//g, '-'),
          mesVencNombre,
          `${eff.diasVencidos}`,
          `${eff.diasVencidos} dias`,
          `${eff.diasCredito}`,
          `${eff.diasCredito} dias`,
          montoUsd.toFixed(2),
          montoUsd.toFixed(2).replace('.', ','),
          String(montoUsd),
          abonosUsd.toFixed(2),
          abonosUsd.toFixed(2).replace('.', ','),
          String(abonosUsd),
          restUsd.toFixed(2),
          restUsd.toFixed(2).replace('.', ','),
          String(restUsd),
          restBs.toFixed(2),
          restBs.toFixed(2).replace('.', ','),
          eff.estado,
          estadoKeywords,
          eff.observaciones || ''
        ].join(' ')
      );
    },
    [tasaBcv]
  );

  // Rango de fechas normalizado (soporta tanto Desde <= Hasta como Desde >= Hasta de mayor a menor)
  const normalizedDateRange = useMemo(() => {
    if (dateFrom && dateTo) {
      return dateFrom <= dateTo
        ? { minDate: dateFrom, maxDate: dateTo }
        : { minDate: dateTo, maxDate: dateFrom };
    }
    return {
      minDate: dateFrom || '',
      maxDate: dateTo || ''
    };
  }, [dateFrom, dateTo]);

  // Contadores en vivo para los selectores de Tipo Doc, Vendedor y Estado
  const filterCounts = useMemo(() => {
    const queryTokens = normalizeSearchText(searchTerm)
      .split(/\s+/)
      .map((t) => t.replace(/^(\$|bs\.?)/i, ''))
      .filter(Boolean);

    const byDocType = { ALL: 0, FACTURA: 0, NOTA_ENTREGA: 0 };
    const byStatus = { PENDIENTES: 0, VENCIDA: 0, POR_VENCER: 0, PAGADA: 0, ALL: 0 };
    const bySeller = new Map();

    allDocuments.forEach((doc) => {
      const eff = getRowEffective(doc);

      if (normalizedDateRange.minDate && eff.fechaEmisionIso < normalizedDateRange.minDate) return;
      if (normalizedDateRange.maxDate && eff.fechaEmisionIso > normalizedDateRange.maxDate) return;

      if (queryTokens.length > 0) {
        const blob = buildRowSearchBlob(eff);
        if (!queryTokens.every((token) => blob.includes(token))) return;
      }

      const matchesStatus =
        statusFilter === 'PENDIENTES'
          ? eff.isCarteraActiva
          : statusFilter === 'ALL'
          ? true
          : eff.estado === statusFilter;

      const matchesDocType = docTypeFilter === 'ALL' || eff.tipoDoc === docTypeFilter;
      const matchesSeller = sellerFilter === 'ALL' || eff.vendedorId === sellerFilter;

      // Conteo por Tipo Doc (respetando estado y vendedor actual)
      if (matchesStatus && matchesSeller) {
        byDocType.ALL++;
        if (eff.tipoDoc === 'NOTA_ENTREGA') byDocType.NOTA_ENTREGA++;
        else byDocType.FACTURA++;
      }

      // Conteo por Vendedor (respetando tipoDoc y estado actual)
      if (matchesDocType && matchesStatus) {
        const vId = eff.vendedorId || 'OF';
        bySeller.set(vId, (bySeller.get(vId) || 0) + 1);
      }

      // Conteo por Estado (respetando tipoDoc y vendedor actual)
      if (matchesDocType && matchesSeller) {
        byStatus.ALL++;
        if (eff.isCarteraActiva) byStatus.PENDIENTES++;
        if (eff.estado === 'VENCIDA') byStatus.VENCIDA++;
        else if (eff.estado === 'POR_VENCER') byStatus.POR_VENCER++;
        else if (eff.estado === 'PAGADA') byStatus.PAGADA++;
      }
    });

    const sellerOptions = Array.from(new Set([...bySeller.keys(), ...sellerCatalog.keys()]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((vId) => ({
        id: vId,
        name: sellerCatalog.get(vId) || vId,
        count: bySeller.get(vId) || 0
      }));

    return { byDocType, byStatus, sellerOptions };
  }, [
    allDocuments,
    searchTerm,
    normalizedDateRange,
    statusFilter,
    docTypeFilter,
    sellerFilter,
    sellerCatalog,
    getRowEffective,
    buildRowSearchBlob
  ]);

  // Filtrado por todas las palabras claves, rango de fechas y ordenamiento (Fecha de Mayor a Menor, etc.)
  const filteredRows = useMemo(() => {
    const queryTokens = normalizeSearchText(searchTerm)
      .split(/\s+/)
      .map((t) => t.replace(/^(\$|bs\.?)/i, ''))
      .filter(Boolean);

    return allDocuments
      .filter((doc) => {
        const eff = getRowEffective(doc);

        if (docTypeFilter !== 'ALL' && eff.tipoDoc !== docTypeFilter) return false;

        if (statusFilter === 'PENDIENTES') {
          if (!eff.isCarteraActiva) return false;
        } else if (statusFilter !== 'ALL' && eff.estado !== statusFilter) {
          return false;
        }

        if (sellerFilter !== 'ALL' && eff.vendedorId !== sellerFilter) return false;

        // Filtro por rango de fecha de emisión (soporta tanto Desde <= Hasta como Mayor a Menor)
        if (normalizedDateRange.minDate && eff.fechaEmisionIso < normalizedDateRange.minDate) return false;
        if (normalizedDateRange.maxDate && eff.fechaEmisionIso > normalizedDateRange.maxDate) return false;

        // Buscador multi-palabra clave: todas las palabras escritas deben coincidir en cualquier campo del documento
        if (queryTokens.length > 0) {
          const blob = buildRowSearchBlob(eff);
          const allMatch = queryTokens.every((token) => blob.includes(token));
          if (!allMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const effA = getRowEffective(a);
        const effB = getRowEffective(b);

        if (sortField === 'fechaEmision' || sortField === 'fechaVencimiento') {
          const isoKey = sortField === 'fechaEmision' ? 'fechaEmisionIso' : 'fechaVencimientoIso';
          const isoA = String(effA[isoKey] || '');
          const isoB = String(effB[isoKey] || '');
          if (isoA !== isoB) {
            return sortDirection === 'asc'
              ? isoA.localeCompare(isoB)
              : isoB.localeCompare(isoA);
          }
          return sortDirection === 'asc'
            ? String(effA.factura).localeCompare(String(effB.factura), 'es', { numeric: true })
            : String(effB.factura).localeCompare(String(effA.factura), 'es', { numeric: true });
        }

        let valA = effA[sortField];
        let valB = effB[sortField];

        if (valA instanceof Date) valA = valA.getTime();
        if (valB instanceof Date) valB = valB.getTime();

        if (typeof valA === 'string' && typeof valB === 'string') {
          const cmp = valA.localeCompare(valB, 'es', { numeric: true });
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
        } else {
          const numA = Number(valA ?? 0);
          const numB = Number(valB ?? 0);
          if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
          if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
        }

        return sortDirection === 'asc'
          ? String(effA.factura).localeCompare(String(effB.factura), 'es', { numeric: true })
          : String(effB.factura).localeCompare(String(effA.factura), 'es', { numeric: true });
      });
  }, [
    allDocuments,
    docTypeFilter,
    statusFilter,
    sellerFilter,
    searchTerm,
    normalizedDateRange,
    sortField,
    sortDirection,
    getRowEffective,
    buildRowSearchBlob
  ]);

  // Resumen KPI
  const summaryMetrics = useMemo(() => {
    const totalMontoFacturaUsd = round2(
      filteredRows.reduce((acc, r) => acc + Number(getRowEffective(r).montoFacturaUsd || 0), 0)
    );
    const totalAbonosUsd = round2(
      filteredRows.reduce((acc, r) => acc + Number(getRowEffective(r).abonosUsd || 0), 0)
    );
    const totalRestanteUsd = round2(
      filteredRows.reduce((acc, r) => acc + Number(getRowEffective(r).restanteUsd || 0), 0)
    );
    let totalVencidoUsd = 0;
    let totalPorVencerUsd = 0;
    let countVencidas = 0;
    let countPorVencer = 0;
    filteredRows.forEach((r) => {
      const eff = getRowEffective(r);
      const restante = Number(eff.restanteUsd || 0);
      if (eff.estado === 'VENCIDA') {
        countVencidas++;
        totalVencidoUsd += restante;
      } else if (eff.estado === 'POR_VENCER') {
        countPorVencer++;
        totalPorVencerUsd += restante;
      }
    });
    totalVencidoUsd = round2(totalVencidoUsd);
    totalPorVencerUsd = round2(totalPorVencerUsd);
    return {
      totalMontoFacturaUsd,
      totalAbonosUsd,
      totalRestanteUsd,
      totalVencidoUsd,
      totalPorVencerUsd,
      countTotal: filteredRows.length,
      countVencidas,
      countPorVencer
    };
  }, [filteredRows, getRowEffective]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSortPresetChange = (val) => {
    const [field, dir] = String(val).split(':');
    if (field && dir) {
      setSortField(field);
      setSortDirection(dir);
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ verticalAlign: 'middle', opacity: 0.45 }} />;
    }
    return sortDirection === 'desc' ? (
      <ArrowDown size={13} style={{ verticalAlign: 'middle', color: '#002b7a' }} />
    ) : (
      <ArrowUp size={13} style={{ verticalAlign: 'middle', color: '#002b7a' }} />
    );
  };

  // Manejar cambio en cualquier celda editable
  const handleCellChange = (row, field, rawVal) => {
    const current = getRowEffective(row);
    const next = { ...current, [field]: rawVal };

    if (field === 'vendedorId') {
      const code = String(rawVal || '').toUpperCase().trim();
      next.vendedorId = code;
      if (sellerCatalog.has(code)) {
        next.vendedorNombre = sellerCatalog.get(code);
      }
    }

    if (field === 'fechaEmisionIso' || field === 'diasCredito') {
      const emisionDate = parseDateSafe(next.fechaEmisionIso);
      const dc = Math.max(0, Number(next.diasCredito || 0));
      const venc = new Date(emisionDate);
      venc.setDate(venc.getDate() + dc);
      next.fechaVencimientoIso = toIsoDateInput(venc);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      venc.setHours(0, 0, 0, 0);
      const diffVenc = Math.floor((today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
      next.diasVencidos = Math.max(0, diffVenc);
    }

    if (field === 'fechaVencimientoIso') {
      const emisionDate = parseDateSafe(next.fechaEmisionIso);
      const vencDate = parseDateSafe(next.fechaVencimientoIso);
      const diffCredit = Math.round((vencDate.getTime() - emisionDate.getTime()) / (1000 * 60 * 60 * 24));
      next.diasCredito = Math.max(0, diffCredit);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      vencDate.setHours(0, 0, 0, 0);
      const diffVenc = Math.floor((today.getTime() - vencDate.getTime()) / (1000 * 60 * 60 * 24));
      next.diasVencidos = Math.max(0, diffVenc);
    }

    if (field === 'montoFacturaUsd' || field === 'abonosUsd' || field === 'tipoDoc') {
      const total = Math.max(0, Number(next.montoFacturaUsd || 0));
      const abonos = Math.min(total, Math.max(0, Number(next.abonosUsd || 0)));
      next.restanteUsd = round2(Math.max(0, total - abonos));
      if (next.tipoDoc === 'NOTA_ENTREGA') {
        next.ivaUsd = 0;
        next.subtotalUsd = round2(total);
      } else {
        const base = round2(total / 1.16);
        next.subtotalUsd = base;
        next.ivaUsd = round2(total - base);
      }
    }

    if (field === 'restanteUsd') {
      const total = Math.max(0, Number(next.montoFacturaUsd || 0));
      const rest = Math.min(total, Math.max(0, Number(rawVal || 0)));
      next.restanteUsd = round2(rest);
      next.abonosUsd = round2(Math.max(0, total - rest));
    }

    setEditedRows((prev) => ({
      ...prev,
      [row.factNum]: next
    }));
  };

  // Construir payload para saveSupabaseProfitInvoice
  const buildSavePayload = (effectiveRow, originalFactNum) => {
    const factKey = String(effectiveRow.factura || effectiveRow.factNum || originalFactNum).trim();
    const isNotaEntrega = effectiveRow.tipoDoc === 'NOTA_ENTREGA';
    const canonicalFactId = isNotaEntrega
      ? (factKey.toUpperCase().startsWith('NE-') ? factKey : `NE-${factKey}`)
      : factKey.replace(/^(FAC-|INV-)/i, '');
    const montoFacturaUsd = round2(Number(effectiveRow.montoFacturaUsd || 0));
    const subtotalUsd = isNotaEntrega
      ? montoFacturaUsd
      : round2(Number(effectiveRow.subtotalUsd || montoFacturaUsd / 1.16));
    const ivaUsd = isNotaEntrega ? 0 : round2(montoFacturaUsd - subtotalUsd);
    const abonosUsd = round2(Math.min(montoFacturaUsd, Math.max(0, Number(effectiveRow.abonosUsd || 0))));
    const restanteUsd = round2(Math.max(0, montoFacturaUsd - abonosUsd));

    const correlativeChanged = Boolean(originalFactNum) && factKey !== String(originalFactNum).trim();
    const resolvedId = correlativeChanged ? canonicalFactId : (effectiveRow.id || canonicalFactId);

    return {
      id: resolvedId,
      factNum: factKey,
      originalFactNum: originalFactNum || factKey,
      tipoDoc: effectiveRow.tipoDoc || 'FACTURA',
      vendedorId: String(effectiveRow.vendedorId || 'OF').trim().toUpperCase(),
      vendedorNombre: String(effectiveRow.vendedorNombre || sellerCatalog.get(effectiveRow.vendedorId) || '').trim(),
      clienteId: effectiveRow.clienteId || `CLI-${factKey}`,
      clienteNombre: String(effectiveRow.cliente || 'Cliente General').trim(),
      clienteRif: String(effectiveRow.rif || 'J-00000000-0').trim().toUpperCase(),
      fechaEmision: effectiveRow.fechaEmisionIso || getTodayIso(),
      fechaVencimiento: effectiveRow.fechaVencimientoIso || getTodayIso(),
      diasCredito: Number(effectiveRow.diasCredito || 0),
      diasVencidoCustom: Number(effectiveRow.diasVencidos || 0),
      totBrutoUsd: subtotalUsd,
      ivaUsd,
      totNetoUsd: montoFacturaUsd,
      abonosUsd,
      saldoUsd: restanteUsd,
      tasa: Number(effectiveRow.tasa || tasaBcv),
      observaciones: effectiveRow.observaciones || '',
      historialCobros: effectiveRow.historialCobros || [],
      _customCreated: true
    };
  };

  const handleSaveSingleRow = async (row) => {
    const effective = getRowEffective(row);
    const payload = buildSavePayload(effective, row.factNum);
    setSavingRowKey(row.factNum);
    try {
      await saveSupabaseProfitInvoice(payload);
      setLocalOverrides((prev) => ({
        ...prev,
        [payload.factNum]: payload
      }));
      setEditedRows((prev) => {
        const next = { ...prev };
        delete next[row.factNum];
        return next;
      });
      showNotice('success', `Documento #${payload.factNum} (${payload.clienteNombre}) guardado en la base de datos Profit.`);
    } catch (err) {
      console.error('Error guardando fila CxC:', err);
      showNotice('error', `No se pudo guardar #${payload.factNum}: ${err.message || 'Error de red'}`);
    } finally {
      setSavingRowKey(null);
    }
  };

  const handleSaveAllChanges = async () => {
    const keys = Object.keys(editedRows);
    if (keys.length === 0) {
      showNotice('info', 'No hay cambios pendientes por guardar.');
      return;
    }
    setSavingAll(true);
    try {
      const newOverrides = {};
      for (const key of keys) {
        const draft = editedRows[key];
        const payload = buildSavePayload(draft, key);
        await saveSupabaseProfitInvoice(payload);
        newOverrides[payload.factNum] = payload;
      }
      setLocalOverrides((prev) => ({ ...prev, ...newOverrides }));
      setEditedRows({});
      showNotice('success', `Se guardaron ${keys.length} documento(s) exitosamente en la base de datos Profit.`);
    } catch (err) {
      console.error('Error guardando cambios masivos CxC:', err);
      showNotice('error', 'Ocurrió un error al guardar algunos cambios.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleAddNewRow = () => {
    const isNE = docTypeFilter === 'NOTA_ENTREGA';
    const nextCorrelativo = isNE
      ? getNextNotaEntregaCorrelativo(sales, profitInvoices)
      : getNextInvoiceCorrelativo(sales, profitInvoices);
    const newFactNum = isNE
      ? (String(nextCorrelativo).toUpperCase().startsWith('NE-') ? String(nextCorrelativo) : `NE-${nextCorrelativo}`)
      : String(nextCorrelativo).replace(/^(FAC-|INV-)/i, '');
    const todayIso = getTodayIso();
    const venc = new Date();
    venc.setDate(venc.getDate() + 15);
    const vencIso = toIsoDateInput(venc);

    const newDoc = {
      id: newFactNum,
      factNum: newFactNum,
      factura: newFactNum,
      tipoDoc: isNE ? 'NOTA_ENTREGA' : 'FACTURA',
      vendedorId: 'OF',
      vendedorNombre: sellerCatalog.get('OF') || 'Oficina',
      clienteId: `CLI-${newFactNum}`,
      clienteNombre: 'NUEVO CLIENTE CXC',
      cliente: 'NUEVO CLIENTE CXC',
      clienteRif: 'J-00000000-0',
      rif: 'J-00000000-0',
      fechaEmision: todayIso,
      fechaEmisionIso: todayIso,
      fechaVencimiento: vencIso,
      fechaVencimientoIso: vencIso,
      diasCredito: 15,
      diasVencidoCustom: 0,
      diasVencidos: 0,
      totBrutoUsd: 100,
      subtotalUsd: 100,
      ivaUsd: isNE ? 0 : 16,
      totNetoUsd: isNE ? 100 : 116,
      montoFacturaUsd: isNE ? 100 : 116,
      abonosUsd: 0,
      saldoUsd: isNE ? 100 : 116,
      restanteUsd: isNE ? 100 : 116,
      tasa: tasaBcv,
      observaciones: '',
      _customCreated: true
    };

    setLocalOverrides((prev) => ({
      ...prev,
      [newFactNum]: newDoc
    }));
    setEditedRows((prev) => ({
      ...prev,
      [newFactNum]: newDoc
    }));
    showNotice('info', `Nueva fila #${newFactNum} agregada. Edite los datos y presione "Guardar".`);
  };

  const handleDeleteRow = async (row) => {
    if (!window.confirm(`¿Eliminar el documento #${row.factNum} (${row.cliente}) de Cuentas por Cobrar?`)) {
      return;
    }
    const keysToDelete = getScopedCxcDeleteKeys(row);
    try {
      setLocalOverrides((prev) => {
        const next = { ...prev };
        keysToDelete.forEach((k) => {
          next[k] = { _deleted: true };
        });
        return next;
      });
      setEditedRows((prev) => {
        const next = { ...prev };
        delete next[row.factNum];
        return next;
      });
      markCxcDocDeleted(row);
      await deleteSupabaseSale(row);
      showNotice('success', `Documento #${row.factNum} eliminado de la base de datos.`);
    } catch (err) {
      console.error('Error eliminando fila CxC:', err);
      showNotice('error', 'Error al eliminar el documento.');
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Vendedor',
      'Nombre Vendedor',
      'Nro Documento',
      'Tipo Doc',
      'RIF',
      'Nombre Cliente',
      'Fecha Emision',
      'Fecha Vencimiento',
      'Dias Vencido',
      'Dias Credito',
      'Monto Factura (USD)',
      'Abonos (USD)',
      'Restante (USD)',
      'Restante (Bs)',
      'Observaciones'
    ];
    const rows = filteredRows.map((r) => {
      const eff = getRowEffective(r);
      return [
        `"${eff.vendedorId}"`,
        `"${eff.vendedorNombre}"`,
        `"${eff.factura}"`,
        `"${eff.tipoDoc}"`,
        `"${eff.rif}"`,
        `"${eff.cliente}"`,
        formatDateShort(eff.fechaEmisionIso),
        formatDateShort(eff.fechaVencimientoIso),
        eff.diasVencidos,
        eff.diasCredito,
        Number(eff.montoFacturaUsd || 0).toFixed(2),
        Number(eff.abonosUsd || 0).toFixed(2),
        Number(eff.restanteUsd || 0).toFixed(2),
        round2(Number(eff.restanteUsd || 0) * tasaBcv).toFixed(2),
        `"${String(eff.observaciones || '').replace(/"/g, '""')}"`
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Tabla_Profit_CxC_${getTodayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingChangesCount = Object.keys(editedRows).length;
  const activeSortPreset = `${sortField}:${sortDirection}`;

  return (
    <div className="profit-cxc-blank-page" data-theme="light">
      <style>{`
        .profit-cxc-blank-page {
          --bg-input: transparent;
          --surface-input: #ffffff;
          --text-primary: #0f172a;
          color-scheme: light !important;
          min-height: 100vh;
          width: 100%;
          background: #ffffff !important;
          color: #0f172a !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 22px 26px;
          box-sizing: border-box;
        }
        .profit-cxc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          padding-bottom: 16px;
          border-bottom: 2px solid #0f172a;
          margin-bottom: 18px;
        }
        .profit-cxc-toolbar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 16px;
        }
        .profit-cxc-toolbar-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
        }
        /* Forzar fondo claro y máxima legibilidad en buscador y selectores de barra de herramientas */
        .profit-cxc-blank-page .profit-cxc-toolbar input,
        .profit-cxc-blank-page .profit-cxc-toolbar select {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #94a3b8 !important;
          box-shadow: none !important;
          border-radius: 7px !important;
          padding: 6px 10px !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          color-scheme: light !important;
        }
        .profit-cxc-blank-page .profit-cxc-toolbar input::placeholder {
          color: #64748b !important;
          font-weight: 400 !important;
        }
        .profit-cxc-blank-page .profit-cxc-toolbar input:focus,
        .profit-cxc-blank-page .profit-cxc-toolbar select:focus {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.18) !important;
        }
        .profit-cxc-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .profit-cxc-kpi-card {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 8px;
          padding: 10px 14px;
        }
        .profit-cxc-table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #94a3b8;
          border-radius: 8px;
          background: #ffffff !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
        }
        .profit-cxc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          background: #ffffff !important;
          color: #0f172a !important;
        }
        .profit-cxc-table th {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          font-weight: 800;
          text-align: left;
          padding: 10px 8px;
          border-bottom: 2px solid #475569;
          border-right: 1px solid #cbd5e1;
          white-space: nowrap;
          user-select: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .profit-cxc-table th:hover {
          background: #e2e8f0 !important;
        }
        .profit-cxc-table td {
          padding: 4px 6px;
          border-bottom: 1px solid #cbd5e1;
          border-right: 1px solid #e2e8f0;
          vertical-align: middle;
          background: inherit !important;
          color: #0f172a !important;
        }
        .profit-cxc-table tbody tr {
          background: #ffffff !important;
        }
        .profit-cxc-table tbody tr:nth-child(even) {
          background: #f8fafc !important;
        }
        .profit-cxc-table tbody tr:hover {
          background: #e0f2fe !important;
        }
        .profit-cxc-table tbody tr.row-dirty {
          background: #fef9c3 !important;
        }
        /* Forzar que los inputs y selects de la tabla se adapten al fondo de su celda y sean 100% legibles */
        .profit-cxc-blank-page .profit-cxc-table input.profit-cxc-input,
        .profit-cxc-blank-page .profit-cxc-table select.profit-cxc-input {
          width: 100% !important;
          box-sizing: border-box !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          color: #0f172a !important;
          font-size: 12.5px !important;
          font-family: inherit !important;
          padding: 5px 6px !important;
          border-radius: 5px !important;
          color-scheme: light !important;
          transition: border-color 0.15s, background-color 0.15s !important;
        }
        .profit-cxc-blank-page .profit-cxc-table select.profit-cxc-input option {
          background: #ffffff !important;
          color: #0f172a !important;
        }
        .profit-cxc-blank-page .profit-cxc-table input.profit-cxc-input:hover:not(:focus),
        .profit-cxc-blank-page .profit-cxc-table select.profit-cxc-input:hover:not(:focus) {
          border-color: #94a3b8 !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
        }
        .profit-cxc-blank-page .profit-cxc-table input.profit-cxc-input:focus,
        .profit-cxc-blank-page .profit-cxc-table select.profit-cxc-input:focus {
          outline: none !important;
          border-color: #0284c7 !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.22) !important;
        }
        /* Colores de texto legibles de alto contraste sobre el fondo claro */
        .profit-cxc-blank-page .profit-cxc-table input.profit-cxc-input.text-navy {
          color: #002b7a !important;
        }
        .profit-cxc-blank-page .profit-cxc-table select.profit-cxc-input.text-ne {
          color: #b45309 !important;
        }
        .profit-cxc-blank-page .profit-cxc-table select.profit-cxc-input.text-fact {
          color: #0369a1 !important;
        }
        .profit-cxc-blank-page .profit-cxc-table input.profit-cxc-input.text-danger {
          color: #b91c1c !important;
        }
        .profit-cxc-blank-page .profit-cxc-table input.profit-cxc-input.text-success {
          color: #047857 !important;
        }
        .profit-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 13px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          transition: all 0.15s;
        }
        .profit-btn:hover {
          background: #f1f5f9;
        }
        .profit-btn-primary {
          background: #002b7a;
          color: #ffffff;
          border-color: #002b7a;
        }
        .profit-btn-primary:hover {
          background: #0284c7;
          border-color: #0284c7;
        }
        .profit-btn-success {
          background: #059669;
          color: #ffffff;
          border-color: #059669;
        }
        .profit-btn-success:hover {
          background: #047857;
        }
        .profit-btn-print {
          background: #dc2626;
          color: #ffffff;
          border-color: #dc2626;
        }
        .profit-btn-print:hover {
          background: #b91c1c;
        }
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body, html, .profit-cxc-blank-page {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .profit-cxc-table-wrap {
            border: 1px solid #000000 !important;
            overflow: visible !important;
            box-shadow: none !important;
          }
          .profit-cxc-table th {
            background: #e2e8f0 !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .profit-cxc-table td {
            border: 1px solid #64748b !important;
            color: #000000 !important;
            padding: 4px 5px !important;
          }
          .profit-cxc-blank-page .profit-cxc-table input.profit-cxc-input,
          .profit-cxc-blank-page .profit-cxc-table select.profit-cxc-input {
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
            color: #000000 !important;
          }
        }
      `}</style>

      {/* ENCABEZADO DE LA PÁGINA EN BLANCO */}
      <header className="profit-cxc-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={24} color="#002b7a" />
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              TABLA DE CUENTAS POR COBRAR (BASE DE DATOS PROFIT)
            </h1>
          </div>
          <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
            <strong>GRUPO MOTORVEN</strong> • RIF: {config?.rif || 'J-50185716-7'} • Tasa BCV:{' '}
            <strong>{formatBs(tasaBcv)}</strong> • Última lectura BD: <strong>{lastSyncTime}</strong> •{' '}
            <strong>{filteredRows.length} registros en vista</strong>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN: LEER, GUARDAR E IMPRIMIR */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="profit-btn"
            onClick={() => loadDatabaseData(false)}
            disabled={loading}
            title="Volver a leer los datos actuales de la base de datos Profit"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Leyendo BD...' : 'Leer Base de Datos'}</span>
          </button>

          <button
            type="button"
            className="profit-btn profit-btn-primary"
            onClick={handleAddNewRow}
            title="Insertar un nuevo registro en la tabla"
          >
            <Plus size={15} />
            <span>+ Nuevo Registro</span>
          </button>

          <button
            type="button"
            className="profit-btn profit-btn-success"
            onClick={handleSaveAllChanges}
            disabled={savingAll}
            title="Guardar todos los cambios realizados en la base de datos Profit"
          >
            <Save size={15} />
            <span>
              {savingAll
                ? 'Guardando...'
                : pendingChangesCount > 0
                ? `Guardar Cambios (${pendingChangesCount})`
                : 'Guardar en Base de Datos'}
            </span>
          </button>

          <button
            type="button"
            className="profit-btn profit-btn-print"
            onClick={() => window.print()}
            title="Imprimir directamente esta página en blanco"
          >
            <Printer size={15} />
            <span>Imprimir Tabla</span>
          </button>

          <button
            type="button"
            className="profit-btn"
            onClick={() =>
              generateAccountsReceivablePDF(
                filteredRows,
                summaryMetrics,
                config,
                docTypeFilter === 'NOTA_ENTREGA' ? 'NOTA_ENTREGA' : 'FACTURA'
              )
            }
            title="Descargar reporte en formato PDF"
          >
            <FileText size={15} color="#002b7a" />
            <span>Exportar PDF</span>
          </button>

          <button
            type="button"
            className="profit-btn"
            onClick={handleExportCSV}
            title="Descargar tabla en Excel / CSV"
          >
            <FileSpreadsheet size={15} color="#059669" />
            <span>Excel / CSV</span>
          </button>
        </div>
      </header>

      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          padding: '8px 14px',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '12px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
          fontWeight: 600
        }}
      >
        <span>
          Vista auxiliar de hoja de trabajo e impresión. Para registrar cobros con impacto en Caja/Banco y recibos en{' '}
          <code>profit_collections</code>, utilice el módulo principal de Cuentas por Cobrar.
        </span>
        <a
          href="?tab=cxc"
          style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >
          Ir al Módulo CxC Principal →
        </a>
      </div>

      {/* AVISO / NOTIFICACIÓN DE LECTURA Y GUARDADO */}
      {statusBanner && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '14px',
            fontSize: '13px',
            fontWeight: 600,
            background:
              statusBanner.type === 'error'
                ? '#fef2f2'
                : statusBanner.type === 'info'
                ? '#eff6ff'
                : '#ecfdf5',
            color:
              statusBanner.type === 'error'
                ? '#991b1b'
                : statusBanner.type === 'info'
                ? '#1e40af'
                : '#065f46',
            border: `1px solid ${
              statusBanner.type === 'error'
                ? '#fecaca'
                : statusBanner.type === 'info'
                ? '#bfdbfe'
                : '#a7f3d0'
            }`
          }}
        >
          {statusBanner.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* RESUMEN DE TOTALES */}
      <div className="profit-cxc-kpis">
        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #002b7a' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Total Monto Documentos
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {formatUsd(summaryMetrics.totalMontoFacturaUsd)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#334155' }}>
            {formatBs(summaryMetrics.totalMontoFacturaUsd * tasaBcv)}
          </div>
        </div>

        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Total Abonos Cobrados
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
            {formatUsd(summaryMetrics.totalAbonosUsd)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#334155' }}>
            {formatBs(summaryMetrics.totalAbonosUsd * tasaBcv)}
          </div>
        </div>

        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Total Saldo Restante por Cobrar
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>
            {formatUsd(summaryMetrics.totalRestanteUsd)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#334155' }}>
            {formatBs(summaryMetrics.totalRestanteUsd * tasaBcv)}
          </div>
        </div>

        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #e11d48', background: '#fff1f2' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9f1239', textTransform: 'uppercase' }}>
            Monto Vencido (En Mora)
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#be123c', marginTop: '2px' }}>
            {formatUsd(summaryMetrics.totalVencidoUsd)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#881337' }}>
            {formatBs(summaryMetrics.totalVencidoUsd * tasaBcv)}
            {summaryMetrics.totalRestanteUsd > 0 && (
              <span> • {((summaryMetrics.totalVencidoUsd / summaryMetrics.totalRestanteUsd) * 100).toFixed(1)}%</span>
            )}
          </div>
        </div>

        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Estado de Cartera
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            <span style={{ color: '#b91c1c' }}>{summaryMetrics.countVencidas} Vencidas</span> /{' '}
            <span style={{ color: '#047857' }}>{summaryMetrics.countPorVencer} Al Día</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#334155' }}>
            Al día: {formatUsd(summaryMetrics.totalPorVencerUsd)} • {summaryMetrics.countTotal} docs
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA MULTICRITERIO Y FILTROS DE FECHA / ESTADO (OCULTA AL IMPRIMIR) */}
      <div className="profit-cxc-toolbar no-print">
        <div className="profit-cxc-toolbar-row">
          {/* Buscador por todas las palabras claves */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: '1 1 340px',
              position: 'relative'
            }}
          >
            <Search size={16} color="#002b7a" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cualquier palabra clave (cliente, RIF, factura, vendedor, fecha, mes, monto, estado...)"
              style={{ width: '100%' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  border: 'none',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Selector directo de Orden por Fecha (Mayor a Menor / Menor a Mayor) y Columnas */}
          <label
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Ordenar por:
            <select
              value={activeSortPreset}
              onChange={(e) => handleSortPresetChange(e.target.value)}
            >
              <option value="fechaEmision:desc">Fecha Emisión: Mayor a Menor (Más Recientes Primero)</option>
              <option value="fechaEmision:asc">Fecha Emisión: Menor a Mayor (Más Antiguas Primero)</option>
              <option value="fechaVencimiento:desc">Fecha Vencimiento: Mayor a Menor (Más Recientes)</option>
              <option value="fechaVencimiento:asc">Fecha Vencimiento: Menor a Mayor (Más Antiguas)</option>
              <option value="diasVencidos:desc">Días de Vencido: Mayor a Menor</option>
              <option value="diasVencidos:asc">Días de Vencido: Menor a Mayor</option>
              <option value="diasCredito:desc">Días de Crédito: Mayor a Menor</option>
              <option value="diasCredito:asc">Días de Crédito: Menor a Mayor</option>
              <option value="montoFacturaUsd:desc">Monto Factura USD: Mayor a Menor</option>
              <option value="montoFacturaUsd:asc">Monto Factura USD: Menor a Mayor</option>
              <option value="abonosUsd:desc">Abonos USD: Mayor a Menor</option>
              <option value="abonosUsd:asc">Abonos USD: Menor a Mayor</option>
              <option value="restanteUsd:desc">Saldo Restante USD: Mayor a Menor</option>
              <option value="restanteUsd:asc">Saldo Restante USD: Menor a Mayor</option>
              <option value="factura:desc">N° Factura / Documento: Mayor a Menor</option>
              <option value="factura:asc">N° Factura / Documento: Menor a Mayor</option>
              <option value="cliente:asc">Nombre Cliente: A → Z</option>
              <option value="cliente:desc">Nombre Cliente: Z → A</option>
              <option value="rif:asc">RIF: A → Z</option>
              <option value="rif:desc">RIF: Z → A</option>
              <option value="vendedorId:asc">Vendedor: A → Z</option>
              <option value="vendedorId:desc">Vendedor: Z → A</option>
              <option value="tipoDoc:asc">Tipo Documento: A → Z</option>
              <option value="tipoDoc:desc">Tipo Documento: Z → A</option>
            </select>
          </label>
        </div>

        <div className="profit-cxc-toolbar-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
          {/* Filtro por Rango de Fechas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} color="#002b7a" /> Filtrar Fecha Emisión:
            </span>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Desde:
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Hasta:
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                className="profit-btn"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                style={{ padding: '4px 8px', fontSize: '11.5px' }}
              >
                Limpiar Fechas
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Tipo Doc:
              <select
                value={docTypeFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setDocTypeFilter(val);
                  if (typeof window !== 'undefined' && window.history?.replaceState) {
                    const url = new URL(window.location.href);
                    url.searchParams.set('docType', val);
                    window.history.replaceState({}, '', url.toString());
                  }
                }}
              >
                <option value="ALL">Todos (Facturas + Notas de Entrega) ({filterCounts.byDocType.ALL})</option>
                <option value="FACTURA">Solo Facturas Fiscales (SENIAT) ({filterCounts.byDocType.FACTURA})</option>
                <option value="NOTA_ENTREGA">Solo Notas de Entrega (Sin IVA) ({filterCounts.byDocType.NOTA_ENTREGA})</option>
              </select>
            </label>

            <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Vendedor:
              <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
                <option value="ALL">Todos los Vendedores</option>
                {filterCounts.sellerOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} — {v.name} ({v.count})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Estado:
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="PENDIENTES">Pendientes por Cobrar ({filterCounts.byStatus.PENDIENTES})</option>
                <option value="VENCIDA">Solo Vencidas ({filterCounts.byStatus.VENCIDA})</option>
                <option value="POR_VENCER">Solo Al Día (Por Vencer) ({filterCounts.byStatus.POR_VENCER})</option>
                <option value="PAGADA">Pagadas / Solventes ({filterCounts.byStatus.PAGADA})</option>
                <option value="ALL">Todos los Registros ({filterCounts.byStatus.ALL})</option>
              </select>
            </label>

            {(searchTerm || dateFrom || dateTo || sellerFilter !== 'ALL' || statusFilter !== 'PENDIENTES') && (
              <button
                type="button"
                className="profit-btn"
                onClick={() => {
                  setSearchTerm('');
                  setDateFrom('');
                  setDateTo('');
                  setSellerFilter('ALL');
                  setStatusFilter('PENDIENTES');
                }}
                style={{ padding: '5px 10px', fontSize: '11.5px', color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2' }}
                title="Restablecer todos los filtros"
              >
                <X size={13} />
                <span>Restablecer Filtros</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLA DE CUENTAS POR COBRAR DE PROFIT (FONDO CLARO ADAPTABLE Y 100% LEGIBLE) */}
      <div className="profit-cxc-table-wrap">
        <table className="profit-cxc-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('vendedorId')} style={{ width: '78px' }}>
                Vendedor {renderSortIcon('vendedorId')}
              </th>
              <th onClick={() => handleSort('factura')} style={{ width: '95px' }}>
                Factura / Doc {renderSortIcon('factura')}
              </th>
              <th onClick={() => handleSort('tipoDoc')} style={{ width: '115px' }}>
                Tipo {renderSortIcon('tipoDoc')}
              </th>
              <th onClick={() => handleSort('rif')} style={{ width: '120px' }}>
                RIF {renderSortIcon('rif')}
              </th>
              <th onClick={() => handleSort('cliente')} style={{ minWidth: '220px' }}>
                Nombre Cliente {renderSortIcon('cliente')}
              </th>
              <th onClick={() => handleSort('fechaEmision')} style={{ width: '128px' }}>
                Fecha Emisión {renderSortIcon('fechaEmision')}
              </th>
              <th onClick={() => handleSort('fechaVencimiento')} style={{ width: '128px' }}>
                Fecha Venc. {renderSortIcon('fechaVencimiento')}
              </th>
              <th onClick={() => handleSort('diasVencidos')} style={{ width: '88px', textAlign: 'center' }}>
                Días Venc. {renderSortIcon('diasVencidos')}
              </th>
              <th onClick={() => handleSort('diasCredito')} style={{ width: '82px', textAlign: 'center' }}>
                Días Créd. {renderSortIcon('diasCredito')}
              </th>
              <th style={{ width: '98px', textAlign: 'center' }}>
                Clasif. Tasa
              </th>
              <th style={{ width: '105px', textAlign: 'right' }}>
                Tasa Pago
              </th>
              <th onClick={() => handleSort('montoFacturaUsd')} style={{ width: '115px', textAlign: 'right' }}>
                Monto (USD) {renderSortIcon('montoFacturaUsd')}
              </th>
              <th onClick={() => handleSort('abonosUsd')} style={{ width: '110px', textAlign: 'right' }}>
                Abonos (USD) {renderSortIcon('abonosUsd')}
              </th>
              <th onClick={() => handleSort('restanteUsd')} style={{ width: '115px', textAlign: 'right' }}>
                Restante (USD) {renderSortIcon('restanteUsd')}
              </th>
              <th style={{ width: '130px', textAlign: 'right' }}>Equiv. Restante (Bs)</th>
              <th className="no-print" style={{ width: '115px', textAlign: 'center' }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="16" style={{ padding: '32px', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                  No se encontraron registros de Cuentas por Cobrar con las palabras claves o filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const eff = getRowEffective(row);
                const isDirty = Boolean(editedRows[row.factNum]);
                const isSavingThis = savingRowKey === row.factNum;
                const isOverdue = Number(eff.diasVencidos) > 0 && Number(eff.restanteUsd) > 0.01;
                return (
                  <tr key={row.id || row.factNum} className={isDirty ? 'row-dirty' : ''}>
                    {/* 1. Vendedor */}
                    <td>
                      <input
                        type="text"
                        className="profit-cxc-input text-navy"
                        value={eff.vendedorId}
                        onChange={(e) => handleCellChange(row, 'vendedorId', e.target.value)}
                        style={{ fontWeight: 800, textAlign: 'center' }}
                        title={eff.vendedorNombre}
                      />
                    </td>

                    {/* 2. Factura / N° Doc */}
                    <td>
                      <input
                        type="text"
                        className="profit-cxc-input text-navy"
                        value={eff.factura}
                        onChange={(e) => handleCellChange(row, 'factura', e.target.value)}
                        style={{ fontWeight: 800 }}
                      />
                    </td>

                    {/* 3. Tipo Doc */}
                    <td>
                      <select
                        className={`profit-cxc-input ${eff.tipoDoc === 'NOTA_ENTREGA' ? 'text-ne' : 'text-fact'}`}
                        value={eff.tipoDoc}
                        onChange={(e) => handleCellChange(row, 'tipoDoc', e.target.value)}
                        style={{ fontWeight: 700, fontSize: '11.5px' }}
                      >
                        <option value="FACTURA">FACTURA</option>
                        <option value="NOTA_ENTREGA">NOTA ENTREGA</option>
                      </select>
                    </td>

                    {/* 4. RIF */}
                    <td>
                      <input
                        type="text"
                        className="profit-cxc-input"
                        value={eff.rif}
                        onChange={(e) => handleCellChange(row, 'rif', e.target.value)}
                        style={{ fontFamily: 'monospace', fontWeight: 600 }}
                      />
                    </td>

                    {/* 5. Nombre Cliente */}
                    <td>
                      <input
                        type="text"
                        className="profit-cxc-input"
                        value={eff.cliente}
                        onChange={(e) => handleCellChange(row, 'cliente', e.target.value)}
                        style={{ fontWeight: 700 }}
                      />
                    </td>

                    {/* 6. Fecha Emisión */}
                    <td>
                      <input
                        type="date"
                        className="profit-cxc-input"
                        value={eff.fechaEmisionIso}
                        onChange={(e) => handleCellChange(row, 'fechaEmisionIso', e.target.value)}
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* 7. Fecha Vencimiento */}
                    <td>
                      <input
                        type="date"
                        className="profit-cxc-input"
                        value={eff.fechaVencimientoIso}
                        onChange={(e) => handleCellChange(row, 'fechaVencimientoIso', e.target.value)}
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* 8. Días de Vencido */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        className={`profit-cxc-input ${isOverdue ? 'text-danger' : 'text-success'}`}
                        value={eff.diasVencidos}
                        onChange={(e) => handleCellChange(row, 'diasVencidos', Number(e.target.value || 0))}
                        style={{ textAlign: 'center', fontWeight: 800 }}
                      />
                    </td>

                    {/* 9. Días de Crédito */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        className="profit-cxc-input"
                        value={eff.diasCredito}
                        onChange={(e) => handleCellChange(row, 'diasCredito', Number(e.target.value || 0))}
                        style={{ textAlign: 'center', fontWeight: 600 }}
                      />
                    </td>

                    {/* 9b. Clasificación Tasa */}
                    <td style={{ textAlign: 'center' }}>
                      {(() => {
                        const rType = resolveRecordRateType(eff, 'BCV');
                        const rMeta = resolveRateMeta(rType, 'BCV');
                        return (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            background: rMeta.bg,
                            color: rMeta.color,
                            border: `1px solid ${rMeta.border}`
                          }}>
                            {rMeta.badgeText}
                          </span>
                        );
                      })()}
                    </td>

                    {/* 9c. Tasa Aplicada */}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                      {isDirectCurrencyRateType(eff.tipoTasa) ? (RATE_TYPE_META[eff.tipoTasa]?.shortLabel || 'Divisa USD') : formatBs(resolveEffectiveRateNumber(eff, tasaBcv))}
                    </td>

                    {/* 10. Monto Factura USD */}
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="profit-cxc-input"
                        value={eff.montoFacturaUsd}
                        onChange={(e) => handleCellChange(row, 'montoFacturaUsd', e.target.value)}
                        style={{ textAlign: 'right', fontWeight: 800 }}
                      />
                    </td>

                    {/* 11. Abonos USD */}
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="profit-cxc-input text-success"
                        value={eff.abonosUsd}
                        onChange={(e) => handleCellChange(row, 'abonosUsd', e.target.value)}
                        style={{ textAlign: 'right', fontWeight: 800 }}
                      />
                    </td>

                    {/* 12. Restante USD */}
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        className={`profit-cxc-input ${Number(eff.restanteUsd) > 0.01 ? 'text-danger' : 'text-navy'}`}
                        value={eff.restanteUsd}
                        onChange={(e) => handleCellChange(row, 'restanteUsd', e.target.value)}
                        style={{ textAlign: 'right', fontWeight: 800 }}
                      />
                    </td>

                    {/* 13. Equivalente Restante Bs */}
                    <td
                      style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#1e293b',
                        whiteSpace: 'nowrap',
                        paddingRight: '8px'
                      }}
                    >
                      {formatBs(Number(eff.restanteUsd || 0) * tasaBcv)}
                    </td>

                    {/* 14. Acciones (Guardar / Eliminar) */}
                    <td className="no-print" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleSaveSingleRow(row)}
                          disabled={isSavingThis}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: '1px solid',
                            borderColor: isDirty ? '#059669' : '#cbd5e1',
                            background: isDirty ? '#059669' : '#ffffff',
                            color: isDirty ? '#ffffff' : '#0f172a',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Guardar esta fila en la base de datos Profit"
                        >
                          {isSavingThis ? <RefreshCw size={12} /> : isDirty ? <Save size={12} /> : <Check size={12} />}
                          <span>{isDirty ? 'Guardar' : 'OK'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '5px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Eliminar registro"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredRows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #0f172a' }}>
                <td colSpan="11" style={{ padding: '10px 8px', textAlign: 'right', textTransform: 'uppercase', color: '#0f172a' }}>
                  Totales ({filteredRows.length} documentos):
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f172a' }}>
                  {formatUsd(summaryMetrics.totalMontoFacturaUsd)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#047857' }}>
                  {formatUsd(summaryMetrics.totalAbonosUsd)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#b91c1c' }}>
                  {formatUsd(summaryMetrics.totalRestanteUsd)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#0f172a' }}>
                  {formatBs(summaryMetrics.totalRestanteUsd * tasaBcv)}
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
