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
  Wallet
} from 'lucide-react';
import {
  formatUsd,
  formatBs,
  resolveProductUnit,
  resolveProductLitersPerUnit
} from '../services/formatService';
import ExecutiveSummaryModal from '../components/ExecutiveSummaryModal';
import { DEFAULT_PROFIT_SELLERS } from '../data/mockData';
import { generateDashboardPDF } from '../services/pdfReportService';
import { getEraScopedCanonicalDocKey, dedupeCanonicalDocs } from '../services/fiscalService';
import { resolveExchangeRates } from '../utils/treasuryAccountUtils';
import {
  toDateKey,
  summarizeCollectionsWindow
} from '../services/dashboardMetricsService';
import { isCxcInvoiceCancelled, isCreditOrDebitNoteDoc } from '../utils/cxcUtils';

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
  profitCollections = [],
  profitSellers = [],
  config = {},
  currentUser,
  onNavigate,
  onSyncProfit
}) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pestaña activa del Resumen General: 'ALL' | 'facturacion' | 'inventario' | 'cobranzas'
  const [activeBlock, setActiveBlock] = useState('ALL');

  // Fecha local de hoy (refresca cada minuto para cubrir el cambio de día con la pantalla abierta)
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const k = toDateKey(new Date());
      setTodayKey(prev => (prev === k ? prev : k));
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const { tasaBcv } = useMemo(() => resolveExchangeRates(config), [config]);
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

  // Lista efectiva de vendedores para meta mensual real de litros
  const effectiveSellersList = useMemo(() => {
    if (Array.isArray(profitSellers) && profitSellers.length > 0) {
      const byName = new Map();
      profitSellers.forEach(s => {
        const name = (s.venDes || s.ven_des || s.nombre || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const code = (s.coVen || s.co_ven || s.id || '').trim();
        if (!byName.has(key) || (code.length <= 4 && (byName.get(key).coVen?.length || 0) > 4)) {
          byName.set(key, {
            ...s,
            coVen: code,
            venDes: name,
            metaLitrosMes: Number(s.metaLitrosMes ?? s.meta_litros_mes ?? 3000)
          });
        }
      });
      return Array.from(byName.values());
    }
    return DEFAULT_PROFIT_SELLERS;
  }, [profitSellers]);

  const metaMensualBase = useMemo(() => {
    const sumMensual = effectiveSellersList.reduce((acc, s) => {
      const val = Number(s?.metaLitrosMes ?? s?.meta_litros_mes);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    return sumMensual > 0 ? sumMensual : (Number(config?.metaComercialLitros) || 20000.00);
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

    return docs;
  }, [profitInvoices, sales, products, tasaBcv]);

  const resumirVentas = (docs) => {
    const skuSet = new Set();
    const clientes = new Set();
    let usd = 0;
    let bs = 0;
    let litros = 0;

    docs.forEach(d => {
      usd += d.usd;
      bs += d.bs;
      litros += d.litros;
      if (d.cliente) clientes.add(d.cliente);
      d.items.forEach(it => {
        if (!it.esServicio && it.sku) skuSet.add(it.sku);
      });
    });

    return {
      usd: parseFloat(usd.toFixed(2)),
      bs: parseFloat(bs.toFixed(2)),
      litros: parseFloat(litros.toFixed(2)),
      cajas: parseFloat((litros / 11.35).toFixed(1)),
      documentos: docs.length,
      clientes: clientes.size,
      skus: skuSet.size
    };
  };

  const ventasDelDia = useMemo(() => {
    const hoy = resumirVentas(ventasDocsNormalizados.filter(d => d.dateKey === todayKey));
    const [ty, tm, td] = todayKey.split('-').map(Number);
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
  }, [ventasDocsNormalizados, todayKey]);

  const ventasAcumuladoMes = useMemo(() => {
    const prefix = `${anioActivo}-${ventasMesFilter}`;
    const resumen = resumirVentas(
      ventasDocsNormalizados.filter(d => d.dateKey.startsWith(prefix) && d.dateKey <= todayKey)
    );
    const monthIdx = Number(ventasMesFilter);
    const diasDelMes = new Date(Number(anioActivo), monthIdx, 0).getDate();
    const currentPrefix = todayKey.substring(0, 7);
    let diasTranscurridos = 0;
    if (prefix === currentPrefix) diasTranscurridos = Number(todayKey.substring(8, 10));
    else if (prefix < currentPrefix) diasTranscurridos = diasDelMes;

    const esMesEnCurso = prefix === currentPrefix;
    const promedioDiarioUsd = diasTranscurridos > 0 ? resumen.usd / diasTranscurridos : 0;
    const promedioDiarioLitros = diasTranscurridos > 0 ? resumen.litros / diasTranscurridos : 0;
    const meta = Number(metaMensualBase) || 0;

    return {
      ...resumen,
      diasDelMes,
      diasTranscurridos,
      esMesEnCurso,
      esFuturo: prefix > currentPrefix,
      promedioDiarioUsd: parseFloat(promedioDiarioUsd.toFixed(2)),
      promedioDiarioLitros: parseFloat(promedioDiarioLitros.toFixed(1)),
      proyeccionLitros: esMesEnCurso ? parseFloat((promedioDiarioLitros * diasDelMes).toFixed(1)) : resumen.litros,
      proyeccionUsd: esMesEnCurso ? parseFloat((promedioDiarioUsd * diasDelMes).toFixed(2)) : resumen.usd,
      metaLitros: meta,
      pctMeta: meta > 0 ? parseFloat(((resumen.litros / meta) * 100).toFixed(1)) : 0
    };
  }, [ventasDocsNormalizados, ventasMesFilter, anioActivo, todayKey, metaMensualBase]);

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

      const costo = Number(p.costoUsd ?? p.costo_usd ?? p.costo ?? p.costo_unitario ?? 0) || 0;
      valUsd += cant * costo;
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
  // 3. COBRANZAS — COBRANZA DEL DÍA & ACUMULADA DEL MES (DATOS REALES)
  // =========================================================================
  const cobranzasMesPrefix = `${anioActivo}-${cobranzasMesFilter}`;

  const { hoy: cobranzaDelDia, mes: cobranzaAcumuladaMes } = useMemo(
    () =>
      summarizeCollectionsWindow({
        profitCollections,
        tasaBcv,
        todayKey,
        monthPrefix: cobranzasMesPrefix
      }),
    [profitCollections, tasaBcv, todayKey, cobranzasMesPrefix]
  );

  // Facturado del mismo mes seleccionado en Cobranzas para calcular % recaudado vs. facturado
  const facturadoMesCobranzaUsd = useMemo(() => {
    const sum = ventasDocsNormalizados
      .filter(d => d.dateKey.startsWith(cobranzasMesPrefix) && d.dateKey <= todayKey)
      .reduce((acc, d) => acc + d.usd, 0);
    return parseFloat(sum.toFixed(2));
  }, [ventasDocsNormalizados, cobranzasMesPrefix, todayKey]);

  const cobranzaVsFacturadoPct = useMemo(() => {
    if (facturadoMesCobranzaUsd <= 0) return cobranzaAcumuladaMes.usd > 0 ? 100 : 0;
    return parseFloat(((cobranzaAcumuladaMes.usd / facturadoMesCobranzaUsd) * 100).toFixed(1));
  }, [cobranzaAcumuladaMes.usd, facturadoMesCobranzaUsd]);

  // Payload consolidado para Vista Previa / PDF si el gerente desea imprimir
  const ventasMesLabel = MONTHS_LIST.find(m => m.id === ventasMesFilter)?.label || ventasMesFilter;
  const cobranzasMesLabel = MONTHS_LIST.find(m => m.id === cobranzasMesFilter)?.label || cobranzasMesFilter;

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

      {/* SELECTOR RÁPIDO DE LOS 3 APARTADOS */}
      <div className="rg-tabs-row">
        <div className="rg-tabs-pills">
          {[
            { id: 'ALL', label: 'Todos los Apartados', tone: 'tone-all' },
            { id: 'facturacion', label: '1. Facturación', tone: 'tone-facturacion' },
            { id: 'inventario', label: '2. Inventario', tone: 'tone-inventario' },
            { id: 'cobranzas', label: '3. Cobranzas', tone: 'tone-cobranzas' }
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
                <span className="rg-date-pill">{todayLabel}</span>
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

            {/* Tarjeta 1B: Acumulado Mensual */}
            <div className="rg-card accent-cyan">
              <div className="rg-card-head">
                <span className="rg-card-title">
                  <Calendar size={18} color="var(--neon-cyan)" />
                  ACUMULADO MENSUAL
                </span>
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
                <span className="rg-date-pill">{todayLabel}</span>
              </div>

              <div className="rg-metrics-split">
                <div className="rg-metric-tile">
                  <div className="rg-metric-label">
                    <DollarSign size={13} /> Total Cobrado Hoy
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

            {/* Tarjeta 3B: Cobranza Acumulada del Mes */}
            <div className="rg-card accent-teal">
              <div className="rg-card-head">
                <span className="rg-card-title">
                  <Calendar size={18} color="var(--neon-cyan)" />
                  COBRANZA ACUMULADA DEL MES
                </span>
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
        </section>
      )}

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
