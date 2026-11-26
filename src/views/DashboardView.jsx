import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Printer,
  ArrowUpRight,
  DollarSign,
  Package,
  Calendar,
  Clock,
  Droplet,
  RefreshCw,
  CheckCircle2,
  Eye,
  Receipt,
  Wallet,
  Building2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  formatUsd,
  formatBs,
  resolveProductUnit,
  resolveProductLitersPerUnit,
  getProductWarehouseStocks
} from '../services/formatService';
import { getProductCost } from '../services/pricingService';
import ExecutiveSummaryModal from '../components/ExecutiveSummaryModal';
import { DEFAULT_PROFIT_SELLERS } from '../data/mockData';
import { generateDashboardPDF } from '../services/pdfReportService';
import { getEraScopedCanonicalDocKey, dedupeCanonicalDocs } from '../services/fiscalService';
import { resolveExchangeRates } from '../utils/treasuryAccountUtils';
import {
  toDateKey,
  summarizeCollectionsWindow,
  summarizeKeystonePayables,
  summarizeReceivablesAging
} from '../services/dashboardMetricsService';
import { isCxcInvoiceCancelled, isCreditOrDebitNoteDoc } from '../utils/cxcUtils';
import { buildSalesDepartmentSellers } from '../services/commissionService';
import {
  TEMP_COLLECTIONS_ADJUSTMENT_ENABLED,
  canManageTempCollectionsAdjustment,
  readTempCollectionsLocalReverted,
  writeTempCollectionsLocalReverted,
  subscribeTempCollectionsToggle,
  applyTempCollectionsAdjustment
} from '../config/tempCollectionsAdjustment';

function isExcludedSaleDocType(doc) {
  const tipo = String(doc?.tipoDoc || doc?.tipo_doc || '').trim().toUpperCase();
  return (
    tipo === 'COTIZACION' ||
    tipo === 'SOLICITUD_CLIENTE' ||
    isCreditOrDebitNoteDoc(doc)
  );
}

function isSyntheticManualItem(item) {
  const sku = String(item?.articuloId || item?.codigo || item?.id || '').trim().toUpperCase();
  return sku === 'LUB-MANUAL' || sku === 'NE-DESP';
}

function resolveItemUnitLiters(item, prod) {
  if (prod) return resolveProductLitersPerUnit(prod);
  const sku = String(item?.articuloId || item?.codigo || item?.id || '').trim();
  const desc = String(item?.descripcion || item?.nombre || '').toLowerCase();
  const unit = String(item?.unidad || item?.unidadVenta || '').toLowerCase();
  if (sku === '000003' || desc.includes('granel') || unit === 'litros' || unit === 'litro') {
    return 1;
  }
  const explicitUnitL = Number(
    item?.litrosUnitarios ??
    item?.litros_unitarios ??
    item?.litrosPorUnidad ??
    item?.litros_por_unidad ??
    0
  );
  if (explicitUnitL > 0 && explicitUnitL !== 19) return explicitUnitL;
  return 11.35;
}

function resolveLineItemLitros(item, productsBySku) {
  if (!item || typeof item !== 'object') return 0;
  const desc = String(item.descripcion || item.nombre || '').toLowerCase();
  const sku = String(item.articuloId || item.codigo || item.id || '').trim();
  if (desc.includes('flete') || desc.includes('servicio') || sku === '101815' || sku === 'GNP001') {
    return 0;
  }
  if (isSyntheticManualItem(item)) {
    return Number(item.litrosTotales ?? item.litros_totales ?? item.litros ?? 0) || 0;
  }
  const prod = productsBySku?.get(sku);
  const cantidad = Math.max(0, Number(item.cantidad ?? item.qty ?? 0) || 0);
  const ltsUnit = resolveItemUnitLiters(item, prod);
  if (cantidad > 0 && ltsUnit > 0) {
    return Number((cantidad * ltsUnit).toFixed(2));
  }
  return Number(item.litrosTotales ?? item.litros_totales ?? item.litros ?? 0) || 0;
}

function getSemaforoMeta(pct) {
  if (pct < 50) return { level: 'rojo', text: 'Semáforo: Crítico (<50%)', color: 'var(--semaforo-rojo, #dc2626)' };
  if (pct < 80) return { level: 'amarillo', text: 'Semáforo: En Progreso (50-80%)', color: 'var(--semaforo-amarillo, #f59e0b)' };
  return { level: 'verde', text: 'Semáforo: Meta Alcanzada (>80%)', color: 'var(--semaforo-verde, #10b981)' };
}

export default function DashboardView({
  products = [],
  sales = [],
  orders = [],
  profitInvoices = [],
  profitReturns = [],
  profitCollections = [],
  profitAccountsPayable = [],
  profitSellers = [],
  usersList = [],
  config = {},
  currentUser,
  onNavigate,
  onSyncProfit
}) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pestaña activa del Resumen General: 'ALL' | 'facturacion' | 'inventario' | 'cobranzas' | 'cxp-keystone'
  const [activeBlock, setActiveBlock] = useState('ALL');

  const canToggleTempCollections = useMemo(
    () => canManageTempCollectionsAdjustment(currentUser),
    [currentUser]
  );
  const [tempCollectionsReverted, setTempCollectionsReverted] = useState(() =>
    readTempCollectionsLocalReverted()
  );
  useEffect(() => subscribeTempCollectionsToggle(setTempCollectionsReverted), []);

  const handleToggleTempCollections = () => {
    const next = !tempCollectionsReverted;
    writeTempCollectionsLocalReverted(next);
    setTempCollectionsReverted(next);
  };

  // Fecha local de hoy (refresca cada minuto para cubrir el cambio de día con la pantalla abierta)
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const k = toDateKey(new Date());
      setTodayKey(prev => (prev === k ? prev : k));
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const { tasaBcv, tasaKeystone } = useMemo(() => resolveExchangeRates(config), [config]);
  const anioActivo = config?.ejercicioFiscalActivo || new Date().getFullYear();

  const MONTHS_LIST = useMemo(() => [
    { id: '01', label: `Enero ${anioActivo}`, short: 'Ene' },
    { id: '02', label: `Febrero ${anioActivo}`, short: 'Feb' },
    { id: '03', label: `Marzo ${anioActivo}`, short: 'Mar' },
    { id: '04', label: `Abril ${anioActivo}`, short: 'Abr' },
    { id: '05', label: `Mayo ${anioActivo}`, short: 'May' },
    { id: '06', label: `Junio ${anioActivo}`, short: 'Jun' },
    { id: '07', label: `Julio ${anioActivo}`, short: 'Jul' },
    { id: '08', label: `Agosto ${anioActivo}`, short: 'Ago' },
    { id: '09', label: `Septiembre ${anioActivo}`, short: 'Sep' },
    { id: '10', label: `Octubre ${anioActivo}`, short: 'Oct' },
    { id: '11', label: `Noviembre ${anioActivo}`, short: 'Nov' },
    { id: '12', label: `Diciembre ${anioActivo}`, short: 'Dic' }
  ], [anioActivo]);

  const currentMonthStr = useMemo(() => String(new Date().getMonth() + 1).padStart(2, '0'), []);
  const [ventasMesFilter, setVentasMesFilter] = useState(currentMonthStr);
  const [cobranzasMesFilter, setCobranzasMesFilter] = useState(currentMonthStr);

  // Filtro global de Fecha puntual (Día) y Período para los 4 Bloques
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [periodPreset, setPeriodPreset] = useState('mes'); // 'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'personalizado'
  const [customFrom, setCustomFrom] = useState(() => `${toDateKey(new Date()).substring(0, 7)}-01`);
  const [customTo, setCustomTo] = useState(() => toDateKey(new Date()));

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = (selectedDateKey || todayKey).split('-').map(Number);
    if (!y) return '';
    return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }, [selectedDateKey, todayKey]);

  const formatShortDate = (key) => {
    if (!key || key.length < 10) return key || '';
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  };

  const selectedDateShort = useMemo(() => formatShortDate(selectedDateKey), [selectedDateKey]);

  const periodRange = useMemo(() => {
    const refKey = selectedDateKey || todayKey;
    const [ry, rm, rd] = refKey.split('-').map(Number);
    const refDate = new Date(ry, (rm || 1) - 1, rd || 1);

    if (periodPreset === 'hoy') {
      return {
        from: refKey,
        to: refKey,
        isCustomRange: true,
        label: `Día ${formatShortDate(refKey)}`
      };
    }

    if (periodPreset === 'semana') {
      const dow = (refDate.getDay() + 6) % 7; // Lunes = 0
      const monday = new Date(refDate);
      monday.setDate(refDate.getDate() - dow);
      const from = toDateKey(monday);
      return {
        from,
        to: refKey,
        isCustomRange: true,
        label: `${formatShortDate(from)} – ${formatShortDate(refKey)}`
      };
    }

    if (periodPreset === 'mes_anterior') {
      const [ty, tm] = todayKey.split('-').map(Number);
      const prevEnd = new Date(ty, (tm || 1) - 1, 0);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
      const from = toDateKey(prevStart);
      const to = toDateKey(prevEnd);
      return {
        from,
        to,
        isCustomRange: true,
        label: prevStart.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
      };
    }

    if (periodPreset === 'personalizado') {
      const safeFrom = customFrom && customTo && customFrom <= customTo ? customFrom : (customFrom || refKey);
      const safeTo = customFrom && customTo && customFrom <= customTo ? customTo : (customTo || safeFrom);
      return {
        from: safeFrom,
        to: safeTo,
        isCustomRange: true,
        label: `${formatShortDate(safeFrom)} – ${formatShortDate(safeTo)}`
      };
    }

    // Default: 'mes' (respeta ventasMesFilter / cobranzasMesFilter)
    const monthIdx = Number(ventasMesFilter);
    const lastDay = new Date(Number(anioActivo), monthIdx, 0).getDate();
    const prefix = `${anioActivo}-${ventasMesFilter}`;
    const from = `${prefix}-01`;
    const to = prefix === todayKey.substring(0, 7) ? todayKey : `${prefix}-${String(lastDay).padStart(2, '0')}`;
    const mLabel = MONTHS_LIST.find(m => m.id === ventasMesFilter)?.label || prefix;
    return {
      from,
      to,
      isCustomRange: false,
      label: mLabel
    };
  }, [periodPreset, selectedDateKey, todayKey, customFrom, customTo, ventasMesFilter, anioActivo, MONTHS_LIST]);

  const handleSelectPeriodPreset = (preset) => {
    setPeriodPreset(preset);
    if (preset === 'mes') {
      const m = (selectedDateKey || todayKey).substring(5, 7);
      setVentasMesFilter(m);
      setCobranzasMesFilter(m);
    } else if (preset === 'personalizado' && (!customFrom || !customTo)) {
      setCustomFrom(`${(selectedDateKey || todayKey).substring(0, 7)}-01`);
      setCustomTo(selectedDateKey || todayKey);
    }
  };

  const handleResetTemporalFilters = () => {
    setSelectedDateKey(todayKey);
    setPeriodPreset('mes');
    const curM = todayKey.substring(5, 7);
    setVentasMesFilter(curM);
    setCobranzasMesFilter(curM);
  };

  const isTemporalFiltered = selectedDateKey !== todayKey || periodPreset !== 'mes' || ventasMesFilter !== currentMonthStr || cobranzasMesFilter !== currentMonthStr;

  const todayLabel = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number);
    if (!y) return '';
    return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }, [todayKey]);

  // Lista efectiva de vendedores para meta mensual real de litros:
  // exactamente los mismos asesores del módulo Fuerza de Ventas (usuarios del departamento Ventas
  // enriquecidos con su metadata comercial de profit_sellers), para que la meta coincida en ambos módulos.
  const effectiveSellersList = useMemo(() => {
    const baseProfit = (Array.isArray(profitSellers) && profitSellers.length > 0) ? profitSellers : DEFAULT_PROFIT_SELLERS;
    return buildSalesDepartmentSellers(usersList, baseProfit);
  }, [profitSellers, usersList]);

  const metaMensualBase = useMemo(() => {
    if (effectiveSellersList.length > 0) {
      // Suma exacta de las metas individuales (cada meta es >= 0)
      return effectiveSellersList.reduce((acc, s) => {
        const val = Number(s?.metaLitrosMes ?? s?.meta_litros_mes);
        return acc + (Number.isFinite(val) && val > 0 ? val : 0);
      }, 0);
    }
    return Number(config?.metaComercialLitros) || 20000.00;
  }, [effectiveSellersList, config?.metaComercialLitros]);

  // =========================================================================
  // 1. FACTURACIÓN — DOCUMENTOS NORMALIZADOS (PROFIT + POS SIN DOBLE CONTEO)
  // =========================================================================
  const ventasDocsNormalizados = useMemo(() => {
    const productsBySku = new Map();
    (products || []).forEach(p => {
      const sku = String(p.codigo || p.id || '').trim();
      if (sku) productsBySku.set(sku, p);
    });

    const isServiceItem = (desc) => {
      const d = (desc || '').toLowerCase();
      return d.includes('flete') || d.includes('servicio');
    };

    const getDocDedupKey = (docObj) => {
      if (!docObj || typeof docObj !== 'object') return '';
      return getEraScopedCanonicalDocKey(docObj);
    };

    const normalizeDocItems = (rawItems = [], tasaDoc = tasaBcv, headerLitros = 0) => {
      const mapped = (rawItems || []).map(it => {
        const sku = String(it.articuloId || it.codigo || it.id || '').trim();
        const prod = productsBySku.get(sku);
        const desc = it.descripcion || it.nombre || prod?.descripcion || prod?.nombre || sku || 'Lubricante';
        const cantidad = Number(it.cantidad || 0);
        const litros = resolveLineItemLitros(it, productsBySku);
        const usdDirect = Number(it.totalUsd ?? it.subtotalUsd ?? 0);
        const usd = usdDirect > 0
          ? usdDirect
          : ((Number(it.totalNeto || 0) || 0) / (tasaDoc > 1 ? tasaDoc : 1)) || (Number(it.precioUsd || 0) * cantidad);
        return {
          sku,
          desc,
          cantidad,
          litros,
          usd,
          esServicio: isServiceItem(desc)
        };
      });
      if (mapped.length === 1 && isSyntheticManualItem(rawItems[0]) && mapped[0].litros === 0 && headerLitros > 0) {
        mapped[0].litros = headerLitros;
      }
      return mapped;
    };

    const salesById = new Map();
    const salesByKey = new Map();
    (sales || []).forEach(s => {
      if (!s || isCxcInvoiceCancelled(s) || isExcludedSaleDocType(s)) return;
      if (s.id) salesById.set(String(s.id), s);
      const dk = getDocDedupKey(s);
      if (dk && !salesByKey.has(dk)) salesByKey.set(dk, s);
    });

    const seenIds = new Set();
    const seenDocKeys = new Set();
    const docs = [];

    (dedupeCanonicalDocs(profitInvoices) || []).forEach(inv => {
      if (!inv || isCxcInvoiceCancelled(inv) || isExcludedSaleDocType(inv)) return;
      const dateKey = toDateKey(inv.fechaEmision || inv.fecEmis || inv.fec_emis || inv.fecha);
      if (!dateKey) return;

      const idStr = inv.id ? String(inv.id) : '';
      const dk = getDocDedupKey(inv);
      if ((idStr && seenIds.has(idStr)) || (dk && seenDocKeys.has(dk))) return;
      if (idStr) seenIds.add(idStr);
      if (dk) seenDocKeys.add(dk);

      const usd = Number(inv.totNetoUsd ?? inv.tot_neto_usd ?? inv.totalNetoUsd ?? 0) || 0;
      const bsRaw = Number(inv.totNetoBs ?? inv.tot_neto_bs ?? 0) || 0;
      const tasaDoc = Number(inv.tasa) > 1 ? Number(inv.tasa) : tasaBcv;
      const headerLitros = Number(inv.totalLitros ?? inv.total_litros ?? 0) || 0;

      const matchingSale = (idStr && salesById.get(idStr)) || (dk && salesByKey.get(dk));
      const rawItems = (Array.isArray(inv.items) && inv.items.length > 0)
        ? inv.items
        : (matchingSale?.items || []);
      const items = normalizeDocItems(rawItems, tasaDoc, headerLitros);
      const itemsLitros = Number(items.reduce((acc, it) => acc + it.litros, 0).toFixed(2));
      const hasRealItems = rawItems.some(it => it && !isSyntheticManualItem(it));

      docs.push({
        dateKey,
        usd,
        bs: bsRaw > 0 ? bsRaw : usd * tasaBcv,
        litros: (hasRealItems && itemsLitros > 0) ? itemsLitros : (headerLitros > 0 ? headerLitros : itemsLitros),
        cliente: inv.clienteNombre || inv.cliente_nombre || inv.cli_des || inv.clienteId || '',
        items
      });
    });

    (sales || []).forEach(s => {
      if (!s || isCxcInvoiceCancelled(s) || isExcludedSaleDocType(s)) return;

      const idStr = s.id ? String(s.id) : '';
      const dk = getDocDedupKey(s);
      if ((idStr && seenIds.has(idStr)) || (dk && seenDocKeys.has(dk))) return;
      if (idStr) seenIds.add(idStr);
      if (dk) seenDocKeys.add(dk);

      const dateKey = toDateKey(s.fecha || s.fechaEmision || s.fecha_emision);
      if (!dateKey) return;
      const usd = Number(s.totalUsd ?? s.total_usd ?? 0) || 0;
      const bsRaw = Number(s.totalBs ?? s.total_bs ?? 0) || 0;
      const tasaDoc = Number(s.tasaDolar ?? s.tasa_dolar ?? 0) > 1 ? Number(s.tasaDolar ?? s.tasa_dolar) : tasaBcv;
      const headerLitros = Number(s.totalLitros ?? s.total_litros ?? 0) || 0;
      const rawSaleItems = s.items || [];
      const items = normalizeDocItems(rawSaleItems, tasaDoc, headerLitros);
      const itemsLitros = Number(items.reduce((acc, it) => acc + it.litros, 0).toFixed(2));
      const hasRealSaleItems = rawSaleItems.some(it => it && !isSyntheticManualItem(it));

      docs.push({
        dateKey,
        usd,
        bs: bsRaw > 0 ? bsRaw : usd * tasaBcv,
        litros: (hasRealSaleItems && itemsLitros > 0) ? itemsLitros : (headerLitros > 0 ? headerLitros : itemsLitros),
        cliente: s.clienteNombre || s.cliente_nombre || s.cliente || '',
        items
      });
    });

    // Descontar devoluciones de clientes (no anuladas) del volumen de litros y ventas
    (profitReturns || []).forEach(ret => {
      if (!ret || ret.anulada || ret.anulado || ['ANULADA', 'ANULADO'].includes(String(ret.status || ret.estado || '').toUpperCase())) return;
      const dateKey = toDateKey(ret.fecEmis || ret.fec_emis || ret.fecha);
      if (!dateKey) return;
      const tasaDoc = Number(ret.tasa) > 1 ? Number(ret.tasa) : tasaBcv;
      const rawUsd = Math.abs(Number(ret.totNeto ?? ret.tot_neto ?? ret.totalUsd ?? 0) || 0);
      const headerLitros = Math.abs(Number(ret.litrosTotales ?? ret.litros_totales ?? 0) || 0);
      const rawItems = Array.isArray(ret.renglones) ? ret.renglones : (Array.isArray(ret.items) ? ret.items : []);
      const items = normalizeDocItems(rawItems, tasaDoc, headerLitros);
      const itemsLitros = Number(items.reduce((acc, it) => acc + it.litros, 0).toFixed(2));
      const retLitros = headerLitros > 0 ? headerLitros : itemsLitros;
      if (rawUsd <= 0 && retLitros <= 0) return;
      docs.push({
        dateKey,
        usd: -rawUsd,
        bs: -(rawUsd * tasaDoc),
        litros: -retLitros,
        cliente: ret.cliDes || ret.clienteNombre || '',
        items: [],
        isReturn: true
      });
    });

    return docs;
  }, [profitInvoices, sales, profitReturns, products, tasaBcv]);

  const resumirVentas = (docs) => {
    const skuSet = new Set();
    const clientes = new Set();
    let usd = 0;
    let bs = 0;
    let litros = 0;
    let docCount = 0;

    docs.forEach(d => {
      usd += d.usd;
      bs += d.bs;
      litros += d.litros;
      if (!d.isReturn) docCount += 1;
      if (d.cliente && !d.isReturn) clientes.add(d.cliente);
      d.items.forEach(it => {
        if (!it.esServicio && it.sku) skuSet.add(it.sku);
      });
    });

    return {
      usd: parseFloat(usd.toFixed(2)),
      bs: parseFloat(bs.toFixed(2)),
      litros: parseFloat(litros.toFixed(2)),
      cajas: parseFloat((litros / 11.35).toFixed(1)),
      documentos: docCount,
      clientes: clientes.size,
      skus: skuSet.size
    };
  };

  const ventasDelDia = useMemo(() => {
    const targetDay = selectedDateKey || todayKey;
    const hoy = resumirVentas(ventasDocsNormalizados.filter(d => d.dateKey === targetDay));
    const [ty, tm, td] = targetDay.split('-').map(Number);
    const ayerDate = new Date(ty, (tm || 1) - 1, (td || 1) - 1);
    const ayerKey = toDateKey(ayerDate);
    const ayer = ventasDocsNormalizados
      .filter(d => d.dateKey === ayerKey)
      .reduce((acc, d) => ({ usd: acc.usd + d.usd, litros: acc.litros + d.litros }), { usd: 0, litros: 0 });

    return {
      ...hoy,
      ayerUsd: parseFloat(ayer.usd.toFixed(2)),
      ayerLitros: parseFloat(ayer.litros.toFixed(2))
    };
  }, [ventasDocsNormalizados, selectedDateKey, todayKey]);

  const ventasAcumuladoMes = useMemo(() => {
    const isCustomRange = periodRange.isCustomRange;
    const prefix = `${anioActivo}-${ventasMesFilter}`;
    const resumen = resumirVentas(
      ventasDocsNormalizados.filter(d =>
        isCustomRange
          ? d.dateKey >= periodRange.from && d.dateKey <= periodRange.to
          : d.dateKey.startsWith(prefix) && d.dateKey <= todayKey
      )
    );
    const monthIdx = Number(ventasMesFilter);
    const diasDelMes = new Date(Number(anioActivo), monthIdx, 0).getDate();
    const currentPrefix = todayKey.substring(0, 7);
    let diasTranscurridos = 0;
    if (isCustomRange) {
      const [fy, fm, fd] = periodRange.from.split('-').map(Number);
      const [ey, em, ed] = periodRange.to.split('-').map(Number);
      const d1 = new Date(fy, (fm || 1) - 1, fd || 1);
      const d2 = new Date(ey, (em || 1) - 1, ed || 1);
      diasTranscurridos = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
    } else if (prefix === currentPrefix) {
      diasTranscurridos = Number(todayKey.substring(8, 10));
    } else if (prefix < currentPrefix) {
      diasTranscurridos = diasDelMes;
    }

    const esMesEnCurso = !isCustomRange && prefix === currentPrefix;
    const promedioDiarioUsd = diasTranscurridos > 0 ? resumen.usd / diasTranscurridos : 0;
    const promedioDiarioLitros = diasTranscurridos > 0 ? resumen.litros / diasTranscurridos : 0;
    const meta = Number(metaMensualBase) || 0;

    return {
      ...resumen,
      diasDelMes: isCustomRange ? diasTranscurridos : diasDelMes,
      diasTranscurridos,
      esMesEnCurso,
      esCustomRange: isCustomRange,
      esFuturo: !isCustomRange && prefix > currentPrefix,
      promedioDiarioUsd: parseFloat(promedioDiarioUsd.toFixed(2)),
      promedioDiarioLitros: parseFloat(promedioDiarioLitros.toFixed(1)),
      proyeccionLitros: esMesEnCurso ? parseFloat((promedioDiarioLitros * diasDelMes).toFixed(1)) : resumen.litros,
      proyeccionUsd: esMesEnCurso ? parseFloat((promedioDiarioUsd * diasDelMes).toFixed(2)) : resumen.usd,
      metaLitros: meta,
      pctMeta: meta > 0 ? parseFloat(((resumen.litros / meta) * 100).toFixed(1)) : 0
    };
  }, [ventasDocsNormalizados, ventasMesFilter, anioActivo, todayKey, metaMensualBase, periodRange]);

  // =========================================================================
  // 2. INVENTARIO — STOCK EN ALMACÉN (LITROS + DESGLOSE) & VALORIZACIÓN
  // =========================================================================
  const { stockTotalLitros, stockValorizadoUsd, stockBreakdownItems, stockBreakdownLabel } = useMemo(() => {
    let totalStockLts = 0;
    let valUsd = 0;
    const breakdown = { Caja: 0, Paila: 0, Tambor: 0, Totem: 0, Litros: 0 };

    (products || []).forEach(p => {
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnidad = resolveProductLitersPerUnit(p);
      totalStockLts += cant * ltsUnidad;

      const unit = resolveProductUnit(p, 'Caja');
      if (breakdown[unit] !== undefined) {
        breakdown[unit] += cant;
      }

      const hasWhFields =
        p.stockAlmacen01 !== undefined ||
        p.stock_almacen_01 !== undefined ||
        p.stockAlmacen02 !== undefined ||
        p.stock_almacen_02 !== undefined;
      if (hasWhFields) {
        const stocks = getProductWarehouseStocks(p);
        valUsd += stocks.stock01 * getProductCost(p, '01') + stocks.stock02 * getProductCost(p, '02');
      } else {
        const costo = getProductCost(p) || Number(p.costo_unitario ?? 0) || 0;
        valUsd += cant * costo;
      }
    });

    const items = [
      breakdown.Caja > 0 ? `${breakdown.Caja.toLocaleString('es-VE')} ${breakdown.Caja === 1 ? 'Caja' : 'Cajas'}` : null,
      breakdown.Paila > 0 ? `${breakdown.Paila.toLocaleString('es-VE')} ${breakdown.Paila === 1 ? 'Paila' : 'Pailas'}` : null,
      breakdown.Tambor > 0 ? `${breakdown.Tambor.toLocaleString('es-VE')} ${breakdown.Tambor === 1 ? 'Tambor' : 'Tambores'}` : null,
      breakdown.Totem > 0 ? `${breakdown.Totem.toLocaleString('es-VE')} ${breakdown.Totem === 1 ? 'Totem' : 'Totems'}` : null,
      breakdown.Litros > 0 ? `${breakdown.Litros.toLocaleString('es-VE')} L Granel` : null
    ].filter(Boolean);

    return {
      stockTotalLitros: parseFloat(totalStockLts.toFixed(2)),
      stockValorizadoUsd: parseFloat(valUsd.toFixed(2)),
      stockBreakdownItems: items,
      stockBreakdownLabel: items.join(' • ') || '0 Unidades'
    };
  }, [products]);

  // =========================================================================
  // 3. COBRANZAS — COBRANZA DEL DÍA & ACUMULADA DEL MES / PERÍODO
  // =========================================================================
  const cobranzasMesPrefix = `${anioActivo}-${cobranzasMesFilter}`;
  const effectiveDayKey = selectedDateKey || todayKey;

  const baseCollectionsWindow = useMemo(
    () =>
      summarizeCollectionsWindow({
        profitCollections,
        tasaBcv,
        todayKey: effectiveDayKey,
        monthPrefix: cobranzasMesPrefix,
        periodFrom: periodRange.isCustomRange ? periodRange.from : '',
        periodTo: periodRange.isCustomRange ? periodRange.to : ''
      }),
    [profitCollections, tasaBcv, effectiveDayKey, cobranzasMesPrefix, periodRange]
  );

  const { hoy: cobranzaDelDia, mes: cobranzaAcumuladaMes } = useMemo(
    () =>
      applyTempCollectionsAdjustment({
        summary: baseCollectionsWindow,
        todayKey: effectiveDayKey,
        monthPrefix: cobranzasMesPrefix,
        tasaBcv,
        localReverted: canToggleTempCollections && tempCollectionsReverted
      }),
    [
      baseCollectionsWindow,
      effectiveDayKey,
      cobranzasMesPrefix,
      tasaBcv,
      canToggleTempCollections,
      tempCollectionsReverted
    ]
  );

  // Facturado del mismo mes/período seleccionado en Cobranzas para calcular % recaudado vs. facturado
  const facturadoMesCobranzaUsd = useMemo(() => {
    const sum = ventasDocsNormalizados
      .filter(d =>
        periodRange.isCustomRange
          ? d.dateKey >= periodRange.from && d.dateKey <= periodRange.to
          : d.dateKey.startsWith(cobranzasMesPrefix) && d.dateKey <= todayKey
      )
      .reduce((acc, d) => acc + d.usd, 0);
    return parseFloat(sum.toFixed(2));
  }, [ventasDocsNormalizados, cobranzasMesPrefix, todayKey, periodRange]);

  const cobranzaVsFacturadoPct = useMemo(() => {
    if (facturadoMesCobranzaUsd <= 0) return cobranzaAcumuladaMes.usd > 0 ? 100 : 0;
    return parseFloat(((cobranzaAcumuladaMes.usd / facturadoMesCobranzaUsd) * 100).toFixed(1));
  }, [cobranzaAcumuladaMes.usd, facturadoMesCobranzaUsd]);

  const carteraCxcAging = useMemo(
    () =>
      summarizeReceivablesAging({
        profitInvoices,
        sales,
        tasaBcv,
        todayKey: effectiveDayKey
      }),
    [profitInvoices, sales, tasaBcv, effectiveDayKey]
  );

  // =========================================================================
  // 4. CUENTAS POR PAGAR KEYSTONE — SUMATORIA DEL SALDO ACTUAL PENDIENTE
  // =========================================================================
  const cxpKeystone = useMemo(
    () =>
      summarizeKeystonePayables({
        profitAccountsPayable,
        tasaKeystone,
        todayKey: effectiveDayKey,
        periodFrom: periodRange.from,
        periodTo: periodRange.to
      }),
    [profitAccountsPayable, tasaKeystone, effectiveDayKey, periodRange]
  );

  // Payload consolidado para Vista Previa / PDF si el gerente desea imprimir
  const ventasMesLabel = periodRange.isCustomRange
    ? periodRange.label
    : (MONTHS_LIST.find(m => m.id === ventasMesFilter)?.label || ventasMesFilter);
  const cobranzasMesLabel = periodRange.isCustomRange
    ? periodRange.label
    : (MONTHS_LIST.find(m => m.id === cobranzasMesFilter)?.label || cobranzasMesFilter);

  const semMeta = getSemaforoMeta(ventasAcumuladoMes.pctMeta);

  const enrichedKpiData = useMemo(() => ({
    litrosFacturados: ventasAcumuladoMes.litros,
    cajasFacturadas: ventasAcumuladoMes.cajas,
    metaComercial: ventasAcumuladoMes.metaLitros,
    cumplimientoMetaPct: ventasAcumuladoMes.pctMeta,
    cumplimientoLitrosPct: ventasAcumuladoMes.pctMeta,
    facturacionTotalUsd: ventasAcumuladoMes.usd,
    cobradoTotalUsd: cobranzaAcumuladaMes.usd,
    porcentajeCobranza: cobranzaVsFacturadoPct,
    stockTotalLitros,
    valorizacionInventarioUsd: stockValorizadoUsd
  }), [
    ventasAcumuladoMes,
    cobranzaAcumuladaMes.usd,
    cobranzaVsFacturadoPct,
    stockTotalLitros,
    stockValorizadoUsd
  ]);

  const cobranzasSummaryForPdf = useMemo(() => ({
    acumulada: cobranzaAcumuladaMes.usd,
    enBs: cobranzaAcumuladaMes.bsReal,
    enBsUsd: cobranzaAcumuladaMes.bsUsd,
    efectivoZelle: cobranzaAcumuladaMes.divisasUsd
  }), [cobranzaAcumuladaMes]);

  const handleManualSync = async () => {
    if (!onSyncProfit) return;
    try {
      setIsSyncing(true);
      await onSyncProfit();
      setSyncFeedback('¡Datos sincronizados en tiempo real!');
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (err) {
      setSyncFeedback('Error sincronizando: ' + (err.message || 'Error de red'));
      setTimeout(() => setSyncFeedback(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrintReport = (block = 'ALL', customConfig = null) => {
    try {
      const targetBlock = typeof block === 'string' ? block : 'ALL';
      const effectiveConfig = (customConfig && typeof customConfig === 'object') ? { ...config, ...customConfig } : config;
      generateDashboardPDF({
        kpiData: enrichedKpiData,
        sales,
        products,
        orders,
        config: effectiveConfig,
        currentUser,
        block: targetBlock,
        sellers: effectiveSellersList,
        cobranzasData: cobranzasSummaryForPdf,
        selectedMonth: ventasMesFilter,
        ventasDelDia,
        ventasAcumuladoMes,
        ventasMesLabel,
        todayLabel
      });
    } catch (err) {
      console.error('[DashboardView] Error generando PDF:', err);
      alert('Error generando el reporte PDF: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <div className="rg-container">
      {/* CABECERA FIJA: TOAST, BARRA EJECUTIVA, PESTAÑAS Y FILTRO TEMPORAL */}
      <div className="rg-sticky-header">
        {/* Toast Feedback de Sincronización */}
      {syncFeedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '12px',
            background: 'var(--semaforo-verde-bg)',
            border: '1px solid var(--semaforo-verde)',
            color: 'var(--semaforo-verde)',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={16} />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CABECERA EJECUTIVA: RESUMEN GENERAL + FILTRO RÁPIDO DE LOS 3 APARTADOS     */}
      {/* ========================================================================= */}
      <div className="rg-topbar">
        <div className="rg-title-wrap">
          <div className="rg-title-icon">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="rg-main-title">RESUMEN GENERAL</h1>
            <div className="rg-date-subtitle">
              <Calendar size={13} />
              <span>{todayLabel}</span>
            </div>
          </div>
        </div>

        <div className="rg-actions-row">
          {typeof onNavigate === 'function' && (
            <button
              type="button"
              onClick={() => onNavigate('predictibilidad')}
              title="Abrir Módulo SIGNUM FORESIGHT — Predictibilidad & Alertas Tempranas"
              style={{
                padding: '7px 14px',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 800,
                fontFamily: 'var(--font-tech)',
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: '1px solid rgba(139, 92, 246, 0.5)',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={14} style={{ flexShrink: 0 }} />
              <span>Predictibilidad & Alertas</span>
            </button>
          )}

          {typeof onSyncProfit === 'function' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Sincronizar datos en tiempo real desde Profit / Supabase"
              style={{
                padding: '7px 14px',
                borderRadius: '999px',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} style={{ flexShrink: 0, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowPrintModal(true)}
            title="Abrir vista previa del Resumen General"
            style={{
              padding: '7px 14px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={14} style={{ flexShrink: 0 }} />
            <span>Vista Previa</span>
          </button>

          <button
            type="button"
            className="btn btn-print-report"
            onClick={() => handlePrintReport('ALL')}
            title="Descargar Resumen General en PDF"
            style={{
              padding: '7px 14px',
              borderRadius: '999px',
              fontSize: '0.78rem'
            }}
          >
            <Printer size={14} style={{ flexShrink: 0 }} />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* SELECTOR RÁPIDO DE LOS 4 APARTADOS */}
      <div className="rg-tabs-row">
        <div className="rg-tabs-pills">
          {[
            { id: 'ALL', label: 'Todos los Apartados', tone: 'tone-all' },
            { id: 'facturacion', label: '1. Facturación', tone: 'tone-facturacion' },
            { id: 'inventario', label: '2. Inventario', tone: 'tone-inventario' },
            { id: 'cobranzas', label: '3. Cobranzas', tone: 'tone-cobranzas' },
            { id: 'cxp-keystone', label: '4. CxP Keystone', tone: 'tone-cxp-keystone' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveBlock(tab.id)}
              className={`rg-tab-pill ${tab.tone}${activeBlock === tab.id ? ' is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* BARRA DE FILTRO TEMPORAL UNIFICADA (FECHA PUNTUAL & PERÍODO PARA LOS 4 BLOQUES) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem 1rem',
          padding: '0.65rem 0.95rem',
          borderRadius: '14px',
          background: 'var(--bg-card-glass)',
          border: '1px solid var(--border-glass)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.73rem',
              fontWeight: 700,
              fontFamily: 'var(--font-tech)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginRight: '2px'
            }}
          >
            <Calendar size={13} /> Período:
          </span>

          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'semana', label: 'Esta semana' },
            { id: 'mes', label: 'Mes' },
            { id: 'mes_anterior', label: 'Mes anterior' },
            { id: 'personalizado', label: 'Rango' }
          ].map(p => {
            const active = periodPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPeriodPreset(p.id)}
                style={{
                  padding: '4px 11px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: active ? '1px solid transparent' : '1px solid var(--border-glass)',
                  background: active
                    ? 'linear-gradient(135deg, var(--motorven-navy) 0%, #0284c7 100%)'
                    : 'var(--surface-input)',
                  color: active ? '#ffffff' : 'var(--text-heading)',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: 'var(--text-muted)'
            }}
          >
            <span>Fecha (Día):</span>
            <input
              type="date"
              value={selectedDateKey}
              onChange={(e) => {
                if (e.target.value) setSelectedDateKey(e.target.value);
              }}
              aria-label="Fecha puntual para los bloques del día"
              style={{
                padding: '4px 8px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                background: 'var(--surface-input)',
                color: 'var(--text-heading)',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-code)'
              }}
            />
          </label>

          {periodPreset === 'personalizado' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Fecha desde del período"
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--surface-input)',
                  color: 'var(--text-heading)',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-code)'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Fecha hasta del período"
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--surface-input)',
                  color: 'var(--text-heading)',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-code)'
                }}
              />
            </div>
          )}

          {isTemporalFiltered && (
            <button
              type="button"
              onClick={handleResetTemporalFilters}
              title="Volver a Hoy y Mes actual"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid var(--border-glass)',
                background: 'var(--surface-input)',
                color: 'var(--text-heading)'
              }}
            >
              <RotateCcw size={12} />
              <span>Hoy</span>
            </button>
          )}
        </div>
      </div>
      </div>

      {/* CONTENEDOR CON SCROLL PARA LOS 4 BLOQUES */}
      <div className="rg-blocks-scroll">

      {/* ========================================================================= */}
      {/* 1. FACTURACIÓN (VENTAS DEL DÍA & ACUMULADO MENSUAL)                       */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'facturacion') && (
        <section className="rg-section" aria-label="Facturación">
          <div className="rg-section-header tone-facturacion">
            <div className="rg-section-title-group">
              <div className="rg-section-badge-icon tone-facturacion">
                <Receipt size={19} />
              </div>
              <div>
                <h2 className="rg-section-title tone-facturacion">1. FACTURACIÓN</h2>
                <div className="rg-section-sub">Facturación del día y acumulado mensual en dólares y litros</div>
              </div>
            </div>
            <div className="rg-actions-row">
              {onNavigate && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onNavigate('ventas')}
                  style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Ir a Ventas POS</span>
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="rg-grid-2">
            {/* Tarjeta 1A: Ventas del Día */}
            <div className="rg-card accent-emerald">
              <div className="rg-card-head">
                <span className="rg-card-title">
                  <Clock size={18} color="var(--semaforo-verde)" />
                  VENTAS DEL DÍA
                </span>
                <span className="rg-date-pill">{selectedDateLabel}</span>
              </div>

              <div className="rg-metrics-split">
                <div className="rg-metric-tile">
                  <div className="rg-metric-label">
                    <DollarSign size={13} /> Monto Facturado
                  </div>
                  <div className="rg-metric-value rg-val-money">
                    {formatUsd(ventasDelDia.usd)}
                  </div>
                  <div className="rg-metric-secondary">{formatBs(ventasDelDia.bs)}</div>
                </div>

                <div className="rg-metric-tile">
                  <div className="rg-metric-label">
                    <Droplet size={13} /> Lubricantes Vendidos
                  </div>
                  <div className="rg-metric-value rg-val-volume">
                    {ventasDelDia.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                  </div>
                  <div className="rg-metric-gold">
                    ({ventasDelDia.cajas.toLocaleString('es-VE')} cajas)
                  </div>
                </div>
              </div>

              <div className="rg-card-footer">
                <span>
                  <strong>{ventasDelDia.documentos}</strong> documentos • <strong>{ventasDelDia.clientes}</strong> clientes • <strong>{ventasDelDia.skus}</strong> SKUs
                </span>
                <span title="Comparativo contra el día anterior">
                  Ayer: <strong>{formatUsd(ventasDelDia.ayerUsd)}</strong> / {ventasDelDia.ayerLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                </span>
              </div>
            </div>

            {/* Tarjeta 1B: Acumulado Mensual / Período */}
            <div className="rg-card accent-cyan">
              <div className="rg-card-head">
                <span className="rg-card-title">
                  <Calendar size={18} color="var(--neon-cyan)" />
                  {periodRange.isCustomRange ? 'ACUMULADO DEL PERÍODO' : 'ACUMULADO MENSUAL'}
                </span>
                {periodRange.isCustomRange ? (
                  <span className="rg-date-pill">{periodRange.label}</span>
                ) : (
                  <select
                    value={ventasMesFilter}
                    onChange={(e) => setVentasMesFilter(e.target.value)}
                    className="rg-month-select"
                    title="Seleccione el mes de facturación"
                    aria-label="Mes de facturación acumulado"
                  >
                    {MONTHS_LIST.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rg-metrics-split">
                <div className="rg-metric-tile">
                  <div className="rg-metric-label">
                    <DollarSign size={13} /> Monto Acumulado
                  </div>
                  <div className="rg-metric-value rg-val-money">
                    {formatUsd(ventasAcumuladoMes.usd)}
                  </div>
                  <div className="rg-metric-secondary">{formatBs(ventasAcumuladoMes.bs)}</div>
                  <div className="rg-metric-note">
                    Prom. diario: {formatUsd(ventasAcumuladoMes.promedioDiarioUsd)}
                  </div>
                </div>

                <div className="rg-metric-tile">
                  <div className="rg-metric-label">
                    <Droplet size={13} /> Lubricantes Acumulados
                  </div>
                  <div className="rg-metric-value rg-val-volume">
                    {ventasAcumuladoMes.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                  </div>
                  <div className="rg-metric-gold">
                    ({ventasAcumuladoMes.cajas.toLocaleString('es-VE')} cajas)
                  </div>
                  <div className="rg-metric-note">
                    Prom. diario: {ventasAcumuladoMes.promedioDiarioLitros.toLocaleString('es-VE')} L
                  </div>
                </div>
              </div>

              <div>
                <div className="rg-card-footer" style={{ paddingTop: '0.55rem' }}>
                  <span>
                    Meta mes: <strong>{ventasAcumuladoMes.metaLitros.toLocaleString('es-VE')} L</strong>
                    {' '}•{' '}
                    <strong style={{ color: getSemaforoMeta(ventasAcumuladoMes.pctMeta).color }}>
                      {ventasAcumuladoMes.pctMeta}%
                    </strong>
                  </span>
                  <span>
                    {ventasAcumuladoMes.esFuturo
                      ? 'Mes aún no iniciado'
                      : ventasAcumuladoMes.esCustomRange
                        ? `${ventasAcumuladoMes.diasTranscurridos} días • ${ventasAcumuladoMes.documentos} documentos`
                        : ventasAcumuladoMes.esMesEnCurso
                          ? `Día ${ventasAcumuladoMes.diasTranscurridos}/${ventasAcumuladoMes.diasDelMes} • Proyección: ${ventasAcumuladoMes.proyeccionLitros.toLocaleString('es-VE')} L`
                          : `Mes cerrado • ${ventasAcumuladoMes.documentos} documentos`}
                  </span>
                </div>
                <div className="rg-progress-track">
                  <div
                    className="rg-progress-fill"
                    style={{
                      width: `${Math.min(ventasAcumuladoMes.pctMeta, 100)}%`,
                      background: getSemaforoMeta(ventasAcumuladoMes.pctMeta).color
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. INVENTARIO (STOCK EN ALMACÉN & VALORIZACIÓN STOCK)                     */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'inventario') && (
        <section className="rg-section" aria-label="Inventario">
          <div className="rg-section-header tone-inventario">
            <div className="rg-section-title-group">
              <div className="rg-section-badge-icon tone-inventario">
                <Package size={19} />
              </div>
              <div>
                <h2 className="rg-section-title tone-inventario">2. INVENTARIO</h2>
                <div className="rg-section-sub">Existencia física total en litros y valorización actual del almacén</div>
              </div>
            </div>
            <div className="rg-actions-row">
              {onNavigate && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onNavigate('inventario')}
                  style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Ir a Inventario</span>
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="rg-grid-2">
            {/* Tarjeta 2A: Stock en Almacén */}
            <div
              className="rg-card accent-violet is-clickable"
              onClick={() => onNavigate && onNavigate('inventario')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onNavigate) onNavigate('inventario');
              }}
              title={`Stock en Almacén: ${stockBreakdownLabel}`}
            >
              <div className="rg-inv-hero-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', minWidth: 0 }}>
                  <div className="rg-inv-icon-box tone-violet">
                    <Package size={28} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="rg-metric-label">Stock en Almacén</div>
                    <div className="rg-metric-value is-hero rg-val-stock" style={{ marginTop: '4px' }}>
                      {stockTotalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={22} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>

              <div className="rg-unit-pills" title={stockBreakdownLabel}>
                {stockBreakdownItems.length > 0 ? (
                  stockBreakdownItems.map(item => (
                    <span key={item} className="rg-unit-pill">{item}</span>
                  ))
                ) : (
                  <span className="rg-unit-pill">0 Unidades</span>
                )}
              </div>

              <div className="rg-card-footer" style={{ marginTop: 'auto' }}>
                <span>
                  Salidas ({ventasMesLabel}): <strong>{ventasAcumuladoMes.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L</strong> ({ventasAcumuladoMes.cajas.toLocaleString('es-VE')} cajas)
                </span>
                <span>Stock en tiempo real</span>
              </div>
            </div>

            {/* Tarjeta 2B: Valorización Stock */}
            <div
              className="rg-card accent-emerald is-clickable"
              onClick={() => onNavigate && onNavigate('inventario')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onNavigate) onNavigate('inventario');
              }}
              title="Clic para ver valoración de existencias en Inventario"
            >
              <div className="rg-inv-hero-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', minWidth: 0 }}>
                  <div className="rg-inv-icon-box tone-emerald">
                    <DollarSign size={28} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="rg-metric-label">Valorización Stock</div>
                    <div className="rg-metric-value is-hero rg-val-money" style={{ marginTop: '4px' }}>
                      {formatUsd(stockValorizadoUsd)}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={22} color="var(--semaforo-verde)" style={{ flexShrink: 0 }} />
              </div>

              <div className="rg-card-footer" style={{ marginTop: 'auto' }}>
                <span><strong>Costo reposición total</strong></span>
                <span>{formatBs(stockValorizadoUsd * tasaBcv)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. COBRANZAS (COBRANZA DEL DÍA & ACUMULADA DEL MES)                       */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'cobranzas') && (
        <section className="rg-section" aria-label="Cobranzas">
          <div className="rg-section-header tone-cobranzas">
            <div className="rg-section-title-group">
              <div className="rg-section-badge-icon tone-cobranzas">
                <Wallet size={19} />
              </div>
              <div>
                <h2 className="rg-section-title tone-cobranzas">3. COBRANZAS</h2>
                <div className="rg-section-sub">Recaudación real del día y cobranza acumulada del mes</div>
              </div>
            </div>
            <div className="rg-actions-row">
              {TEMP_COLLECTIONS_ADJUSTMENT_ENABLED && canToggleTempCollections && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleToggleTempCollections}
                  title={
                    tempCollectionsReverted
                      ? 'Solo visible para MASTER: restaura el ajuste temporal del 20/11 en tu vista'
                      : 'Solo visible para MASTER: revierte temporalmente a datos 100% reales en tu vista'
                  }
                  style={{
                    padding: '5px 11px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    borderColor: tempCollectionsReverted ? 'var(--border-glass)' : 'rgba(16, 185, 129, 0.45)',
                    color: tempCollectionsReverted ? 'var(--text-secondary)' : 'var(--semaforo-verde, #10b981)'
                  }}
                >
                  <RotateCcw size={13} />
                  <span>{tempCollectionsReverted ? 'Solo Real (Restaurar 20/11)' : 'Revertir 20/11 a Real'}</span>
                </button>
              )}
              {onNavigate && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onNavigate('cxc')}
                  style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Ir a Cobranzas CxC</span>
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="rg-grid-2">
            {/* Tarjeta 3A: Cobranza del Día */}
            <div className="rg-card accent-emerald">
              <div className="rg-card-head">
                <span className="rg-card-title">
                  <Clock size={18} color="var(--semaforo-verde)" />
                  COBRANZA DEL DÍA
                </span>
                <span className="rg-date-pill">{selectedDateLabel}</span>
              </div>

              <div className="rg-metrics-split">
                <div className="rg-metric-tile">
                  <div className="rg-metric-label">
                    <DollarSign size={13} /> {selectedDateKey === todayKey ? 'Total Cobrado Hoy' : `Cobrado (${selectedDateShort})`}
                  </div>
                  <div className="rg-metric-value rg-val-money">
                    {formatUsd(cobranzaDelDia.usd)}
                  </div>
                  <div className="rg-metric-secondary">
                    {formatBs(cobranzaDelDia.bsEquiv)}
                  </div>
                </div>

                <div className="rg-metric-tile">
                  <div className="rg-metric-label" style={{ marginBottom: '4px' }}>
                    Composición del Día
                  </div>
                  <div className="rg-cob-split-list">
                    <div className="rg-cob-split-row">
                      <span className="rg-cob-split-tag">
                        <span className="rg-cob-dot" style={{ background: '#10b981' }} />
                        Divisas
                      </span>
                      <span className="rg-cob-split-amt">{formatUsd(cobranzaDelDia.divisasUsd)}</span>
                    </div>
                    <div className="rg-cob-split-row">
                      <span className="rg-cob-split-tag">
                        <span className="rg-cob-dot" style={{ background: '#0284c7' }} />
                        Bolívares
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <div className="rg-cob-split-amt">{formatUsd(cobranzaDelDia.bsUsd)}</div>
                        {cobranzaDelDia.bsReal > 0 && (
                          <div className="rg-cob-split-sub">{formatBs(cobranzaDelDia.bsReal)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rg-card-footer">
                <span>
                  <strong>{cobranzaDelDia.recibos}</strong> {cobranzaDelDia.recibos === 1 ? 'recibo' : 'recibos'} • <strong>{cobranzaDelDia.clientes}</strong> {cobranzaDelDia.clientes === 1 ? 'cliente' : 'clientes'}
                </span>
                <span title="Comparativo contra la cobranza de ayer">
                  Ayer: <strong>{formatUsd(cobranzaDelDia.ayerUsd)}</strong> ({cobranzaDelDia.ayerRecibos} rec.)
                </span>
              </div>
            </div>

            {/* Tarjeta 3B: Cobranza Acumulada del Mes / Período */}
            <div className="rg-card accent-teal">
              <div className="rg-card-head">
                <span className="rg-card-title">
                  <Calendar size={18} color="var(--neon-cyan)" />
                  {periodRange.isCustomRange ? 'COBRANZA DEL PERÍODO' : 'COBRANZA ACUMULADA DEL MES'}
                </span>
                {periodRange.isCustomRange ? (
                  <span className="rg-date-pill">{periodRange.label}</span>
                ) : (
                  <select
                    value={cobranzasMesFilter}
                    onChange={(e) => setCobranzasMesFilter(e.target.value)}
                    className="rg-month-select"
                    title="Seleccione el mes de cobranza"
                    aria-label="Mes de cobranza acumulada"
                  >
                    {MONTHS_LIST.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rg-metrics-split">
                <div className="rg-metric-tile">
                  <div className="rg-metric-label">
                    <DollarSign size={13} /> Cobrado en {cobranzasMesLabel}
                  </div>
                  <div className="rg-metric-value rg-val-money">
                    {formatUsd(cobranzaAcumuladaMes.usd)}
                  </div>
                  <div className="rg-metric-secondary">
                    {formatBs(cobranzaAcumuladaMes.bsEquiv)}
                  </div>
                  <div className="rg-metric-note">
                    Prom. diario: {formatUsd(cobranzaAcumuladaMes.promedioDiarioUsd)}
                  </div>
                </div>

                <div className="rg-metric-tile">
                  <div className="rg-metric-label" style={{ marginBottom: '4px' }}>
                    Composición del Mes
                  </div>
                  <div className="rg-cob-split-list">
                    <div className="rg-cob-split-row">
                      <span className="rg-cob-split-tag">
                        <span className="rg-cob-dot" style={{ background: '#10b981' }} />
                        Divisas
                      </span>
                      <span className="rg-cob-split-amt">{formatUsd(cobranzaAcumuladaMes.divisasUsd)}</span>
                    </div>
                    <div className="rg-cob-split-row">
                      <span className="rg-cob-split-tag">
                        <span className="rg-cob-dot" style={{ background: '#0284c7' }} />
                        Bolívares
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <div className="rg-cob-split-amt">{formatUsd(cobranzaAcumuladaMes.bsUsd)}</div>
                        {cobranzaAcumuladaMes.bsReal > 0 && (
                          <div className="rg-cob-split-sub">{formatBs(cobranzaAcumuladaMes.bsReal)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="rg-card-footer" style={{ paddingTop: '0.55rem' }}>
                  <span>
                    <strong>{cobranzaAcumuladaMes.recibos}</strong> recibos • <strong>{cobranzaAcumuladaMes.clientes}</strong> clientes
                    {facturadoMesCobranzaUsd > 0 && (
                      <>
                        {' '}• Cobrado vs. Fact.:{' '}
                        <strong style={{ color: getSemaforoMeta(cobranzaVsFacturadoPct).color }}>
                          {cobranzaVsFacturadoPct}%
                        </strong>
                      </>
                    )}
                  </span>
                  <span>
                    {cobranzaAcumuladaMes.esFuturo
                      ? 'Mes aún no iniciado'
                      : periodRange.isCustomRange
                        ? `Período: ${periodRange.label}`
                        : cobranzaAcumuladaMes.esMesEnCurso
                          ? `Día ${cobranzaAcumuladaMes.diasTranscurridos}/${cobranzaAcumuladaMes.diasDelMes} • Proyección: ${formatUsd(cobranzaAcumuladaMes.proyeccionUsd)}`
                          : 'Mes cerrado'}
                  </span>
                </div>
                {facturadoMesCobranzaUsd > 0 && (
                  <div className="rg-progress-track">
                    <div
                      className="rg-progress-fill"
                      style={{
                        width: `${Math.min(cobranzaVsFacturadoPct, 100)}%`,
                        background: getSemaforoMeta(cobranzaVsFacturadoPct).color
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tarjeta 3C: Dinero Vencido en la Calle (Facturas + Notas de Entrega) */}
          <div
            className={`rg-card ${carteraCxcAging.cxcVen > 0 ? 'accent-rose' : 'accent-emerald'} is-clickable`}
            onClick={() => onNavigate && onNavigate('cxc')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onNavigate) onNavigate('cxc');
            }}
            title="Clic para abrir el detalle de Cuentas por Cobrar vencidas"
            style={{ marginTop: '0.25rem' }}
          >
            <div className="rg-card-head">
              <span className="rg-card-title">
                <Wallet size={18} color={carteraCxcAging.cxcVen > 0 ? 'var(--semaforo-rojo, #ef4444)' : 'var(--semaforo-verde)'} />
                CARTERA VENCIDA EN LA CALLE (FACTURAS + NOTAS DE ENTREGA)
              </span>
              <span className={`rg-cxp-pill ${carteraCxcAging.cxcVen > 0 ? 'is-danger' : 'is-solvente'}`}>
                {carteraCxcAging.cxcVen > 0
                  ? `${carteraCxcAging.cxcVenPct}% de la cartera • ${carteraCxcAging.docsVencidos} docs`
                  : 'Cartera Al Día'}
              </span>
            </div>

            <div className="rg-metrics-split">
              <div className="rg-metric-tile">
                <div className="rg-metric-label">
                  <DollarSign size={13} /> Monto Consolidado Vencido
                </div>
                <div className={`rg-metric-value ${carteraCxcAging.cxcVen > 0 ? 'rg-val-danger' : 'rg-val-money'}`}>
                  {formatUsd(carteraCxcAging.cxcVen)}
                </div>
                <div className="rg-metric-secondary">
                  {formatBs(carteraCxcAging.cxcVen * tasaBcv)}
                </div>
              </div>

              <div className="rg-metric-tile">
                <div className="rg-metric-label" style={{ marginBottom: '4px' }}>
                  Desglose por Documento Vencido
                </div>
                <div className="rg-cob-split-list">
                  <div className="rg-cob-split-row">
                    <span className="rg-cob-split-tag">
                      <span className="rg-cob-dot" style={{ background: '#ef4444' }} />
                      Facturas ({carteraCxcAging.docsVencidosFacturas})
                    </span>
                    <span className="rg-cob-split-amt">{formatUsd(carteraCxcAging.cxcVenFacturas)}</span>
                  </div>
                  <div className="rg-cob-split-row">
                    <span className="rg-cob-split-tag">
                      <span className="rg-cob-dot" style={{ background: '#f59e0b' }} />
                      Notas de Entrega ({carteraCxcAging.docsVencidosNotas})
                    </span>
                    <span className="rg-cob-split-amt">{formatUsd(carteraCxcAging.cxcVenNotas)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rg-card-footer">
              <span>
                Cartera total por cobrar: <strong>{formatUsd(carteraCxcAging.cxcTot)}</strong> (Al día: <strong>{formatUsd(carteraCxcAging.cxcDia)}</strong>)
              </span>
              <span>
                Corte al: <strong>{selectedDateShort}</strong>
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. CUENTAS POR PAGAR KEYSTONE (SUMATORIA DEL SALDO ACTUAL PENDIENTE)      */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'cxp-keystone') && (
        <section className="rg-section" aria-label="Cuentas por Pagar Keystone">
          <div className="rg-section-header tone-cxp-keystone">
            <div className="rg-section-title-group">
              <div className="rg-section-badge-icon tone-cxp-keystone">
                <Building2 size={19} />
              </div>
              <div>
                <h2 className="rg-section-title tone-cxp-keystone">4. CUENTAS POR PAGAR KEYSTONE</h2>
                <div className="rg-section-sub">Sumatoria actual de todas las cuentas por pagar pendientes a Keystone, C.A.</div>
              </div>
            </div>
            <div className="rg-actions-row">
              {onNavigate && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onNavigate('cxp')}
                  style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Ir a Cuentas por Pagar</span>
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="rg-grid-2">
            {/* Tarjeta 4A: Saldo Actual Total CxP Keystone */}
            <div
              className="rg-card accent-amber is-clickable"
              onClick={() => onNavigate && onNavigate('cxp')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onNavigate) onNavigate('cxp');
              }}
              title="Clic para abrir el detalle de Cuentas por Pagar a Keystone"
            >
              <div className="rg-inv-hero-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', minWidth: 0 }}>
                  <div className="rg-inv-icon-box tone-amber">
                    <Building2 size={28} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="rg-metric-label">Saldo Actual Por Pagar • Keystone</div>
                    <div
                      className={`rg-metric-value is-hero ${cxpKeystone.saldoTotalUsd > 0 ? 'rg-val-payable' : 'rg-val-money'}`}
                      style={{ marginTop: '4px' }}
                    >
                      {formatUsd(cxpKeystone.saldoTotalUsd)}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={22} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>

              <div className="rg-unit-pills">
                {cxpKeystone.desglosePorTipo.length > 0 ? (
                  cxpKeystone.desglosePorTipo.map(item => (
                    <span key={item.label} className="rg-cxp-pill">
                      {item.count} {item.label} • {formatUsd(item.usd)}
                    </span>
                  ))
                ) : (
                  <span className="rg-cxp-pill is-solvente">Solvente • Sin saldo pendiente</span>
                )}
              </div>

              <div className="rg-card-footer" style={{ marginTop: 'auto' }}>
                <span>
                  <strong>{cxpKeystone.documentosPendientes}</strong>{' '}
                  {cxpKeystone.documentosPendientes === 1 ? 'cuenta pendiente' : 'cuentas pendientes'}
                </span>
                <span>{formatBs(cxpKeystone.saldoTotalBs)}</span>
              </div>
            </div>

            {/* Tarjeta 4B: Desglose Vigente vs. Vencido */}
            <div
              className={`rg-card ${cxpKeystone.saldoVencidoUsd > 0 ? 'accent-rose' : 'accent-amber'} is-clickable`}
              onClick={() => onNavigate && onNavigate('cxp')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onNavigate) onNavigate('cxp');
              }}
              title="Desglose de cartera pendiente por vencer y vencida con Keystone, C.A."
            >
              <div className="rg-card-head">
                <span className="rg-card-title">
                  <DollarSign size={18} color={cxpKeystone.saldoVencidoUsd > 0 ? 'var(--semaforo-rojo, #ef4444)' : '#f59e0b'} />
                  ESTADO DEL SALDO KEYSTONE
                </span>
                <span
                  className={`rg-cxp-pill ${
                    cxpKeystone.saldoTotalUsd <= 0
                      ? 'is-solvente'
                      : cxpKeystone.saldoVencidoUsd > 0
                        ? 'is-danger'
                        : ''
                  }`}
                >
                  {cxpKeystone.saldoTotalUsd <= 0
                    ? 'Solvente'
                    : cxpKeystone.saldoVencidoUsd > 0
                      ? `${cxpKeystone.vencidoPct}% Vencido`
                      : 'Al Día'}
                </span>
              </div>

              <div className="rg-metrics-split">
                <div className="rg-metric-tile">
                  <div className="rg-metric-label">Por Vencer (Vigente)</div>
                  <div className="rg-metric-value rg-val-money">
                    {formatUsd(cxpKeystone.saldoVigenteUsd)}
                  </div>
                  <div className="rg-metric-note">
                    {cxpKeystone.docsVigentes} {cxpKeystone.docsVigentes === 1 ? 'documento' : 'documentos'}
                  </div>
                </div>

                <div className="rg-metric-tile">
                  <div className="rg-metric-label">Vencido (En Mora)</div>
                  <div className={`rg-metric-value ${cxpKeystone.saldoVencidoUsd > 0 ? 'rg-val-danger' : 'rg-val-stock'}`}>
                    {formatUsd(cxpKeystone.saldoVencidoUsd)}
                  </div>
                  <div className="rg-metric-note">
                    {cxpKeystone.docsVencidos} {cxpKeystone.docsVencidos === 1 ? 'documento' : 'documentos'}
                  </div>
                </div>
              </div>

              <div className="rg-card-footer" style={{ marginTop: 'auto' }}>
                <span>
                  Corte: <strong>{selectedDateShort}</strong>
                  {cxpKeystone.docsVencenEnPeriodo > 0 && (
                    <> • Vencen en período: <strong>{cxpKeystone.docsVencenEnPeriodo}</strong> ({formatUsd(cxpKeystone.vencenEnPeriodoUsd)})</>
                  )}
                </span>
                <span>
                  Tasa Keystone: <strong>{formatBs(tasaKeystone)}</strong>
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
      </div>

      {/* Modal de Vista Previa e Impresión */}
      <ExecutiveSummaryModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        kpiData={enrichedKpiData}
        semMeta={semMeta}
        config={config}
        currentUser={currentUser}
        sales={sales}
        products={products}
        orders={orders}
        cobranzasData={cobranzasSummaryForPdf}
        ventasDelDia={ventasDelDia}
        ventasAcumuladoMes={ventasAcumuladoMes}
        ventasMesLabel={ventasMesLabel}
        todayLabel={todayLabel}
        sellers={effectiveSellersList}
        selectedMonth={ventasMesFilter}
        periodoLabel={ventasMesLabel}
        onDownloadFullPdf={handlePrintReport}
      />
    </div>
  );
}
