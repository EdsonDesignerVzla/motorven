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
  Check
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
  CXC_DELETED_DOCS_KEY,
  getScopedCxcDeleteKeys,
  isCxcEntryDeleted,
  sanitizeCxcDeletedDocsStorage
} from '../services/supabaseService';
import { subscribeToRealtimeChanges } from '../services/profitService';
import { formatUsd, formatBs } from '../services/formatService';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';

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

const getTodayIso = () => new Date().toISOString().split('T')[0];

const parseDateSafe = (dateStr) => {
  if (!dateStr) return new Date();
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
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

const formatDateShort = (dateInput) => {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  // Filtros
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
  const [sortField, setSortField] = useState('diasVencidos');
  const [sortDirection, setSortDirection] = useState('desc');

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

  const loadDatabaseData = useCallback(async (silent = false) => {
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
  }, [showNotice]);

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
    (sellers || REAL_PROFIT_SELLERS).forEach((s) => {
      const id = String(s.id || s.co_ven || '').trim();
      if (id) map.set(id, s.name || s.ven_des || id);
    });
    return map;
  }, [sellers]);

  // Construcción unificada de la tabla de Cuentas por Cobrar de Profit
  const allDocuments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rawMap = new Map();
    const delSet = new Set(sanitizeCxcDeletedDocsStorage().map((k) => String(k).trim()).filter(Boolean));
    const isDocDeleted = (docOrObj) => isCxcEntryDeleted(docOrObj, delSet);

    (profitInvoices || []).forEach((inv) => {
      const key = String(inv.factNum || inv.id || '').trim();
      if (!key || isDocDeleted(inv)) return;
      const isPosFormat = /^0+\d+$/.test(key) || /^NE-0+\d+$/i.test(key);
      rawMap.set(key, { ...inv, _source: isPosFormat ? 'POS' : 'PROFIT', _isPosSale: isPosFormat });
    });

    (sales || []).forEach((sale) => {
      const rawTipo = String(sale.tipoDoc || sale.tipo_doc || '').toUpperCase().trim();
      if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION') return;
      const saleDocType = inferDocType(sale);
      const isNotaEntregaSale = saleDocType === 'NOTA_ENTREGA';
      const key = String(sale.factura || sale.factNum || sale.numeroDoc || sale.id || '').trim();
      if (!key || isDocDeleted({ ...sale, tipoDoc: saleDocType })) return;

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

      if (!rawMap.has(key)) {
        rawMap.set(key, {
          id: sale.id || `DOC-${key}`,
          factNum: key,
          tipoDoc: saleDocType,
          fechaEmision: sale.fechaEmision || sale.fecha || getTodayIso(),
          fechaVencimiento: sale.fechaVencimiento || sale.fechaEmision || sale.fecha || getTodayIso(),
          clienteId: sale.clienteId || '',
          clienteNombre: sale.cliente || sale.clienteNombre || 'Cliente General',
          clienteRif: sale.rif || sale.clienteRif || 'N/A',
          vendedorId: sale.vendedorId || 'OF',
          vendedorNombre: sale.vendedor || sale.vendedorNombre || '',
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
      }
    });

    Object.entries(localOverrides).forEach(([key, override]) => {
      if (override?._deleted) {
        rawMap.delete(key);
        return;
      }
      const existing = rawMap.get(key) || {};
      rawMap.set(key, { ...existing, ...override });
    });

    const processed = [];
    rawMap.forEach((inv, mapKey) => {
      if (inv.anulada) return;

      const factNum = String(inv.factNum || inv.factura || mapKey).trim();
      const tipoDoc = inferDocType(inv);
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

      const diasVencidos =
        inv.diasVencidoCustom !== undefined && inv.diasVencidoCustom !== null && inv.diasVencidoCustom !== ''
          ? Number(inv.diasVencidoCustom)
          : Math.max(0, diffVencDays);

      const clientObj = clients.find(
        (c) =>
          (inv.clienteId && c.id === inv.clienteId) ||
          (inv.clienteRif && c.rif === inv.clienteRif) ||
          (inv.clienteNombre && c.name?.toLowerCase() === inv.clienteNombre?.toLowerCase())
      );
      const rawSellerId = String(inv.vendedorId || 'OF').trim();
      const isFullNameInId = rawSellerId.length > 4 && rawSellerId.includes(' ');
      const sellerId = isFullNameInId ? 'OF' : rawSellerId;
      const sellerName =
        inv.vendedorNombre ||
        (isFullNameInId ? rawSellerId : sellerCatalog.get(sellerId) || sellerId || 'Oficina');
      const tasaDoc = Number(inv.tasa || tasaBcv) || tasaBcv;

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
        rif: inv.clienteRif || clientObj?.rif || 'J-00000000-0',
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
        estado: restanteUsd <= 0.01 ? 'PAGADA' : diasVencidos > 0 ? 'VENCIDA' : 'POR_VENCER',
        observaciones: inv.observaciones || '',
        historialCobros: Array.isArray(inv.historialCobros) ? inv.historialCobros : [],
        _customCreated: Boolean(inv._customCreated),
        _isPosDoc: isPosDoc
      });
    });

    return processed;
  }, [profitInvoices, sales, clients, sellerCatalog, tasaBcv, localOverrides]);

  // Filtrado y ordenamiento
  const filteredRows = useMemo(() => {
    return allDocuments
      .filter((doc) => {
        if (docTypeFilter !== 'ALL' && doc.tipoDoc !== docTypeFilter) return false;

        if (statusFilter === 'PENDIENTES') {
          const hasEdit = Boolean(editedRows[doc.factNum]) || Boolean(localOverrides[doc.factNum]);
          if (doc.restanteUsd <= 0.01 && !hasEdit && !doc._customCreated && !doc._isPosDoc) return false;
        } else if (statusFilter !== 'ALL' && doc.estado !== statusFilter) {
          return false;
        }

        if (sellerFilter !== 'ALL' && doc.vendedorId !== sellerFilter) return false;

        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          const match =
            String(doc.factNum).toLowerCase().includes(q) ||
            String(doc.cliente).toLowerCase().includes(q) ||
            String(doc.rif).toLowerCase().includes(q) ||
            String(doc.vendedorId).toLowerCase().includes(q) ||
            String(doc.vendedorNombre).toLowerCase().includes(q) ||
            String(doc.observaciones || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (valA instanceof Date) valA = valA.getTime();
        if (valB instanceof Date) valB = valB.getTime();
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc'
            ? valA.localeCompare(valB, 'es', { numeric: true })
            : valB.localeCompare(valA, 'es', { numeric: true });
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [allDocuments, docTypeFilter, statusFilter, sellerFilter, searchTerm, sortField, sortDirection, editedRows, localOverrides]);

  // Resumen KPI
  const summaryMetrics = useMemo(() => {
    const totalMontoFacturaUsd = round2(filteredRows.reduce((acc, r) => acc + r.montoFacturaUsd, 0));
    const totalAbonosUsd = round2(filteredRows.reduce((acc, r) => acc + r.abonosUsd, 0));
    const totalRestanteUsd = round2(filteredRows.reduce((acc, r) => acc + r.restanteUsd, 0));
    const countVencidas = filteredRows.filter((r) => r.estado === 'VENCIDA').length;
    const countPorVencer = filteredRows.filter((r) => r.estado === 'POR_VENCER').length;
    return {
      totalMontoFacturaUsd,
      totalAbonosUsd,
      totalRestanteUsd,
      countTotal: filteredRows.length,
      countVencidas,
      countPorVencer
    };
  }, [filteredRows]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Obtener valores actuales de una fila (combinando fila base + edición en curso)
  const getRowEffective = (row) => {
    const draft = editedRows[row.factNum];
    if (!draft) return row;
    return { ...row, ...draft };
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
    const montoFacturaUsd = round2(Number(effectiveRow.montoFacturaUsd || 0));
    const subtotalUsd = isNotaEntrega
      ? montoFacturaUsd
      : round2(Number(effectiveRow.subtotalUsd || montoFacturaUsd / 1.16));
    const ivaUsd = isNotaEntrega ? 0 : round2(montoFacturaUsd - subtotalUsd);
    const abonosUsd = round2(Math.min(montoFacturaUsd, Math.max(0, Number(effectiveRow.abonosUsd || 0))));
    const restanteUsd = round2(Math.max(0, montoFacturaUsd - abonosUsd));

    return {
      id: effectiveRow.id || `INV-${factKey}`,
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
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const newFactNum = isNE ? `NE-${randomNum}` : `${randomNum}`;
    const todayIso = getTodayIso();
    const venc = new Date();
    venc.setDate(venc.getDate() + 15);
    const vencIso = toIsoDateInput(venc);

    const newDoc = {
      id: `INV-${newFactNum}`,
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
      if (typeof localStorage !== 'undefined') {
        const delList = sanitizeCxcDeletedDocsStorage();
        keysToDelete.forEach((k) => {
          if (!delList.includes(k)) delList.push(k);
        });
        localStorage.setItem(CXC_DELETED_DOCS_KEY, JSON.stringify(delList));
      }
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

  return (
    <div className="profit-cxc-blank-page">
      <style>{`
        .profit-cxc-blank-page {
          min-height: 100vh;
          width: 100%;
          background: #ffffff;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 24px 28px;
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
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 16px;
        }
        .profit-cxc-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .profit-cxc-kpi-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px 14px;
        }
        .profit-cxc-table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #94a3b8;
          border-radius: 8px;
          background: #ffffff;
        }
        .profit-cxc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          background: #ffffff;
          color: #0f172a;
        }
        .profit-cxc-table th {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 700;
          text-align: left;
          padding: 9px 8px;
          border-bottom: 2px solid #64748b;
          border-right: 1px solid #cbd5e1;
          white-space: nowrap;
          user-select: none;
          cursor: pointer;
        }
        .profit-cxc-table td {
          padding: 5px 6px;
          border-bottom: 1px solid #cbd5e1;
          border-right: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .profit-cxc-table tbody tr:nth-child(even) {
          background: #f8fafc;
        }
        .profit-cxc-table tbody tr:hover {
          background: #eff6ff;
        }
        .profit-cxc-table tbody tr.row-dirty {
          background: #fefce8 !important;
        }
        .profit-cxc-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid transparent;
          background: transparent;
          color: #0f172a;
          font-size: 12.5px;
          font-family: inherit;
          padding: 4px 5px;
          border-radius: 4px;
          transition: border-color 0.15s, background 0.15s;
        }
        .profit-cxc-input:hover {
          border-color: #cbd5e1;
          background: #ffffff;
        }
        .profit-cxc-input:focus {
          outline: none;
          border-color: #0284c7;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }
        .profit-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 13px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
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
          .profit-cxc-input {
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
          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
            <strong>GRUPO MOTORVEN</strong> • RIF: {config?.rif || 'J-50185716-7'} • Tasa BCV:{' '}
            <strong>{formatBs(tasaBcv)}</strong> • Última lectura BD: <strong>{lastSyncTime}</strong> •{' '}
            <span>{filteredRows.length} registros en vista</span>
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
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Monto Documentos
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
            {formatUsd(summaryMetrics.totalMontoFacturaUsd)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#475569' }}>
            {formatBs(summaryMetrics.totalMontoFacturaUsd * tasaBcv)}
          </div>
        </div>

        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Abonos Cobrados
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
            {formatUsd(summaryMetrics.totalAbonosUsd)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#475569' }}>
            {formatBs(summaryMetrics.totalAbonosUsd * tasaBcv)}
          </div>
        </div>

        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Saldo Restante por Cobrar
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
            {formatUsd(summaryMetrics.totalRestanteUsd)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#475569' }}>
            {formatBs(summaryMetrics.totalRestanteUsd * tasaBcv)}
          </div>
        </div>

        <div className="profit-cxc-kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Estado de Cartera
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            <span style={{ color: '#dc2626' }}>{summaryMetrics.countVencidas} Vencidas</span> /{' '}
            <span style={{ color: '#059669' }}>{summaryMetrics.countPorVencer} Al Día</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#475569' }}>
            Total listados: {summaryMetrics.countTotal} documentos
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA (OCULTA AL IMPRIMIR) */}
      <div className="profit-cxc-toolbar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 280px', maxWidth: '420px' }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por factura, nota, RIF, cliente o vendedor..."
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#ffffff',
              color: '#0f172a'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Tipo Doc:
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600
              }}
            >
              <option value="ALL">Todos (Facturas + Notas de Entrega)</option>
              <option value="FACTURA">Solo Facturas Fiscales (SENIAT)</option>
              <option value="NOTA_ENTREGA">Solo Notas de Entrega (Sin IVA)</option>
            </select>
          </label>

          <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Vendedor:
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600
              }}
            >
              <option value="ALL">Todos los Vendedores</option>
              {Array.from(new Set(allDocuments.map((d) => d.vendedorId)))
                .sort()
                .map((vId) => (
                  <option key={vId} value={vId}>
                    {vId} — {sellerCatalog.get(vId) || vId}
                  </option>
                ))}
            </select>
          </label>

          <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Estado:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600
              }}
            >
              <option value="PENDIENTES">Pendientes por Cobrar</option>
              <option value="VENCIDA">Solo Vencidas</option>
              <option value="POR_VENCER">Solo Al Día (Por Vencer)</option>
              <option value="PAGADA">Pagadas / Solventes</option>
              <option value="ALL">Todos los Registros</option>
            </select>
          </label>
        </div>
      </div>

      {/* TABLA DE CUENTAS POR COBRAR DE PROFIT (EDITABLE, IMPRIMIBLE Y GUARDABLE) */}
      <div className="profit-cxc-table-wrap">
        <table className="profit-cxc-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('vendedorId')} style={{ width: '90px' }}>
                Vendedor <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('factura')} style={{ width: '95px' }}>
                Factura / Doc <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('tipoDoc')} style={{ width: '95px' }}>
                Tipo <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('rif')} style={{ width: '115px' }}>
                RIF <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('cliente')} style={{ minWidth: '210px' }}>
                Nombre Cliente <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('fechaEmision')} style={{ width: '115px' }}>
                Fecha Emisión <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('fechaVencimiento')} style={{ width: '115px' }}>
                Fecha Venc. <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('diasVencidos')} style={{ width: '85px', textAlign: 'center' }}>
                Días Venc. <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('diasCredito')} style={{ width: '80px', textAlign: 'center' }}>
                Días Créd. <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('montoFacturaUsd')} style={{ width: '115px', textAlign: 'right' }}>
                Monto (USD) <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('abonosUsd')} style={{ width: '110px', textAlign: 'right' }}>
                Abonos (USD) <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th onClick={() => handleSort('restanteUsd')} style={{ width: '115px', textAlign: 'right' }}>
                Restante (USD) <ArrowUpDown size={11} style={{ verticalAlign: 'middle' }} />
              </th>
              <th style={{ width: '125px', textAlign: 'right' }}>Equiv. Restante (Bs)</th>
              <th className="no-print" style={{ width: '115px', textAlign: 'center' }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="14" style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                  No se encontraron registros de Cuentas por Cobrar con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const eff = getRowEffective(row);
                const isDirty = Boolean(editedRows[row.factNum]);
                const isSavingThis = savingRowKey === row.factNum;
                return (
                  <tr key={row.id || row.factNum} className={isDirty ? 'row-dirty' : ''}>
                    {/* 1. Vendedor */}
                    <td>
                      <input
                        type="text"
                        className="profit-cxc-input"
                        value={eff.vendedorId}
                        onChange={(e) => handleCellChange(row, 'vendedorId', e.target.value)}
                        style={{ fontWeight: 700, width: '52px' }}
                        title={eff.vendedorNombre}
                      />
                    </td>

                    {/* 2. Factura / N° Doc */}
                    <td>
                      <input
                        type="text"
                        className="profit-cxc-input"
                        value={eff.factura}
                        onChange={(e) => handleCellChange(row, 'factura', e.target.value)}
                        style={{ fontWeight: 700, color: '#002b7a' }}
                      />
                    </td>

                    {/* 3. Tipo Doc */}
                    <td>
                      <select
                        className="profit-cxc-input"
                        value={eff.tipoDoc}
                        onChange={(e) => handleCellChange(row, 'tipoDoc', e.target.value)}
                        style={{
                          fontWeight: 600,
                          fontSize: '11.5px',
                          color: eff.tipoDoc === 'NOTA_ENTREGA' ? '#b45309' : '#0369a1'
                        }}
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
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      />
                    </td>

                    {/* 5. Nombre Cliente */}
                    <td>
                      <input
                        type="text"
                        className="profit-cxc-input"
                        value={eff.cliente}
                        onChange={(e) => handleCellChange(row, 'cliente', e.target.value)}
                        style={{ fontWeight: 600 }}
                      />
                    </td>

                    {/* 6. Fecha Emisión */}
                    <td>
                      <input
                        type="date"
                        className="profit-cxc-input"
                        value={eff.fechaEmisionIso}
                        onChange={(e) => handleCellChange(row, 'fechaEmisionIso', e.target.value)}
                      />
                    </td>

                    {/* 7. Fecha Vencimiento */}
                    <td>
                      <input
                        type="date"
                        className="profit-cxc-input"
                        value={eff.fechaVencimientoIso}
                        onChange={(e) => handleCellChange(row, 'fechaVencimientoIso', e.target.value)}
                      />
                    </td>

                    {/* 8. Días de Vencido */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        className="profit-cxc-input"
                        value={eff.diasVencidos}
                        onChange={(e) => handleCellChange(row, 'diasVencidos', Number(e.target.value || 0))}
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          color: eff.diasVencidos > 0 && eff.restanteUsd > 0.01 ? '#dc2626' : '#059669'
                        }}
                      />
                    </td>

                    {/* 9. Días de Crédito */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        className="profit-cxc-input"
                        value={eff.diasCredito}
                        onChange={(e) => handleCellChange(row, 'diasCredito', Number(e.target.value || 0))}
                        style={{ textAlign: 'center' }}
                      />
                    </td>

                    {/* 10. Monto Factura USD */}
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="profit-cxc-input"
                        value={eff.montoFacturaUsd}
                        onChange={(e) => handleCellChange(row, 'montoFacturaUsd', e.target.value)}
                        style={{ textAlign: 'right', fontWeight: 700 }}
                      />
                    </td>

                    {/* 11. Abonos USD */}
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="profit-cxc-input"
                        value={eff.abonosUsd}
                        onChange={(e) => handleCellChange(row, 'abonosUsd', e.target.value)}
                        style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}
                      />
                    </td>

                    {/* 12. Restante USD */}
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="profit-cxc-input"
                        value={eff.restanteUsd}
                        onChange={(e) => handleCellChange(row, 'restanteUsd', e.target.value)}
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          color: Number(eff.restanteUsd) > 0.01 ? '#dc2626' : '#0284c7'
                        }}
                      />
                    </td>

                    {/* 13. Equivalente Restante Bs */}
                    <td
                      style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#334155',
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
                            background: isDirty ? '#059669' : '#f8fafc',
                            color: isDirty ? '#ffffff' : '#334155',
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
                <td colSpan="9" style={{ padding: '10px 8px', textAlign: 'right', textTransform: 'uppercase' }}>
                  Totales ({filteredRows.length} documentos):
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f172a' }}>
                  {formatUsd(summaryMetrics.totalMontoFacturaUsd)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#059669' }}>
                  {formatUsd(summaryMetrics.totalAbonosUsd)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#dc2626' }}>
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
