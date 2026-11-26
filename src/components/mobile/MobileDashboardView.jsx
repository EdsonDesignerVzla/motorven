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
import { formatUsd, formatBs } from '../../services/formatService';
import {
  calculateStockoutProjections,
  analyzeMarginCompression,
  generateEarlyWarningRadar
} from '../../services/predictiveEngineService';
import ExecutiveSummaryModal from '../ExecutiveSummaryModal';
import { DEFAULT_PROFIT_SELLERS } from '../../data/mockData';
import { generateDashboardPDF } from '../../services/pdfReportService';
import { resolveExchangeRates } from '../../utils/treasuryAccountUtils';
import {
  toDateKey,
  summarizeCollectionsWindow,
  summarizeKeystonePayables,
  normalizeDashboardSalesDocs,
  summarizeSalesWindows,
  summarizeInventoryStock
} from '../../services/dashboardMetricsService';
import { buildSalesDepartmentSellers } from '../../services/commissionService';
import {
  TEMP_COLLECTIONS_ADJUSTMENT_ENABLED,
  canManageTempCollectionsAdjustment,
  readTempCollectionsLocalReverted,
  writeTempCollectionsLocalReverted,
  subscribeTempCollectionsToggle,
  applyTempCollectionsAdjustment
} from '../../config/tempCollectionsAdjustment';

function getSemaforoMeta(pct) {
  if (pct < 50) return { level: 'rojo', text: 'Semáforo: Crítico (<50%)', color: 'var(--mob-red, #dc2626)' };
  if (pct < 80) return { level: 'amarillo', text: 'Semáforo: En Progreso (50-80%)', color: 'var(--mob-amber, #f59e0b)' };
  return { level: 'verde', text: 'Semáforo: Meta Alcanzada (>80%)', color: 'var(--mob-green, #10b981)' };
}

export default function MobileDashboardView({
  products = [],
  sales = [],
  orders = [],
  profitInvoices = [],
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

  // Pestaña activa del Resumen General Móvil: 'ALL' | 'facturacion' | 'inventario' | 'cobranzas' | 'cxp-keystone'
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

  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const k = toDateKey(new Date());
      setTodayKey((prev) => (prev === k ? prev : k));
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const { tasaBcv, tasaKeystone } = useMemo(() => resolveExchangeRates(config), [config]);
  const anioActivo = config?.ejercicioFiscalActivo || new Date().getFullYear();

  const MONTHS_LIST = useMemo(() => {
    const all = [
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
    ];
    return Number(anioActivo) <= 2026 ? all.filter((m) => Number(m.id) >= 11) : all;
  }, [anioActivo]);

  const currentMonthStr = useMemo(() => {
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    return Number(anioActivo) <= 2026 && Number(m) < 11 ? '11' : m;
  }, [anioActivo]);
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

  const effectiveSellersList = useMemo(() => {
    const baseProfit =
      Array.isArray(profitSellers) && profitSellers.length > 0 ? profitSellers : DEFAULT_PROFIT_SELLERS;
    return buildSalesDepartmentSellers(usersList, baseProfit);
  }, [profitSellers, usersList]);

  const metaMensualBase = useMemo(() => {
    if (effectiveSellersList.length > 0) {
      return effectiveSellersList.reduce((acc, s) => {
        const val = Number(s?.metaLitrosMes ?? s?.meta_litros_mes);
        return acc + (Number.isFinite(val) && val > 0 ? val : 0);
      }, 0);
    }
    return Number(config?.metaComercialLitros) || 20000.0;
  }, [effectiveSellersList, config?.metaComercialLitros]);

  // 1. FACTURACIÓN (VENTAS DEL DÍA & ACUMULADO MENSUAL)
  const ventasDocsNormalizados = useMemo(
    () =>
      normalizeDashboardSalesDocs({
        profitInvoices,
        sales,
        products,
        tasaBcv
      }),
    [profitInvoices, sales, products, tasaBcv]
  );

  const { ventasDelDia, ventasAcumuladoMes } = useMemo(
    () =>
      summarizeSalesWindows({
        ventasDocsNormalizados,
        todayKey,
        anioActivo,
        ventasMesFilter,
        metaMensualBase
      }),
    [ventasDocsNormalizados, todayKey, anioActivo, ventasMesFilter, metaMensualBase]
  );

  // 2. INVENTARIO (STOCK EN ALMACÉN & VALORIZACIÓN)
  const { stockTotalLitros, stockValorizadoUsd, stockBreakdownItems, stockBreakdownLabel } = useMemo(
    () => summarizeInventoryStock(products),
    [products]
  );

  // 3. COBRANZAS (COBRANZA DEL DÍA & ACUMULADA DEL MES)
  const cobranzasMesPrefix = `${anioActivo}-${cobranzasMesFilter}`;
  const baseCollectionsWindow = useMemo(
    () =>
      summarizeCollectionsWindow({
        profitCollections,
        tasaBcv,
        todayKey,
        monthPrefix: cobranzasMesPrefix
      }),
    [profitCollections, tasaBcv, todayKey, cobranzasMesPrefix]
  );

  const { hoy: cobranzaDelDia, mes: cobranzaAcumuladaMes } = useMemo(
    () =>
      applyTempCollectionsAdjustment({
        summary: baseCollectionsWindow,
        todayKey,
        monthPrefix: cobranzasMesPrefix,
        tasaBcv,
        localReverted: canToggleTempCollections && tempCollectionsReverted
      }),
    [
      baseCollectionsWindow,
      todayKey,
      cobranzasMesPrefix,
      tasaBcv,
      canToggleTempCollections,
      tempCollectionsReverted
    ]
  );

  const facturadoMesCobranzaUsd = useMemo(() => {
    const sum = ventasDocsNormalizados
      .filter((d) => d.dateKey.startsWith(cobranzasMesPrefix) && d.dateKey <= todayKey)
      .reduce((acc, d) => acc + d.usd, 0);
    return parseFloat(sum.toFixed(2));
  }, [ventasDocsNormalizados, cobranzasMesPrefix, todayKey]);

  const cobranzaVsFacturadoPct = useMemo(() => {
    if (facturadoMesCobranzaUsd <= 0) return cobranzaAcumuladaMes.usd > 0 ? 100 : 0;
    return parseFloat(((cobranzaAcumuladaMes.usd / facturadoMesCobranzaUsd) * 100).toFixed(1));
  }, [cobranzaAcumuladaMes.usd, facturadoMesCobranzaUsd]);

  // 4. CUENTAS POR PAGAR KEYSTONE
  const cxpKeystone = useMemo(
    () =>
      summarizeKeystonePayables({
        profitAccountsPayable,
        tasaKeystone,
        todayKey
      }),
    [profitAccountsPayable, tasaKeystone, todayKey]
  );

  // 5. RADAR PREDICTIVO & ALERTAS TEMPRANAS (SIGNUM FORESIGHT)
  const predictiveSummary = useMemo(() => {
    const startMs = new Date('2026-11-01T00:00:00').getTime();
    const effectiveLookbackDays = Math.min(30, Math.max(1, Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000)) + 1));
    const stockoutProjections = calculateStockoutProjections(products, sales, orders, {
      leadTimeDays: 7,
      targetCoverageDays: 30,
      lookbackDays: effectiveLookbackDays
    });
    const marginAnalysis = analyzeMarginCompression(products, {
      minSafeMarginPct: 18
    });
    const radarAlerts = generateEarlyWarningRadar({
      stockoutProjections,
      marginAnalysis,
      cashflowForecast: {}
    });
    const criticas = radarAlerts.filter((a) => a.severidad === 'CRITICA').length;
    const advertencias = radarAlerts.filter((a) => a.severidad === 'ADVERTENCIA').length;
    const stockRiskCount = stockoutProjections.filter(
      (p) => p.urgencia === 'CRITICO' || p.urgencia === 'AGOTADO'
    ).length;
    const divergentCostCount = marginAnalysis.filter(
      (m) => Math.abs(Number(m.costo01 || 0) - Number(m.costo02 || 0)) > 0.01
    ).length;
    return {
      criticas,
      advertencias,
      stockRiskCount,
      divergentCostCount,
      topAlert: radarAlerts[0] || null
    };
  }, [products, sales, orders]);

  const ventasMesLabel = MONTHS_LIST.find((m) => m.id === ventasMesFilter)?.label || ventasMesFilter;
  const cobranzasMesLabel = MONTHS_LIST.find((m) => m.id === cobranzasMesFilter)?.label || cobranzasMesFilter;
  const semMeta = getSemaforoMeta(ventasAcumuladoMes.pctMeta);

  const enrichedKpiData = useMemo(
    () => ({
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
    }),
    [
      ventasAcumuladoMes,
      cobranzaAcumuladaMes.usd,
      cobranzaVsFacturadoPct,
      stockTotalLitros,
      stockValorizadoUsd
    ]
  );

  const cobranzasSummaryForPdf = useMemo(
    () => ({
      acumulada: cobranzaAcumuladaMes.usd,
      enBs: cobranzaAcumuladaMes.bsReal,
      enBsUsd: cobranzaAcumuladaMes.bsUsd,
      efectivoZelle: cobranzaAcumuladaMes.divisasUsd
    }),
    [cobranzaAcumuladaMes]
  );

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
      const effectiveConfig =
        customConfig && typeof customConfig === 'object' ? { ...config, ...customConfig } : config;
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
      console.error('[MobileDashboardView] Error generando PDF:', err);
      alert('Error generando el reporte PDF: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <div className="mob-rg-container">
      {/* Toast Feedback de Sincronización */}
      {syncFeedback && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '11px',
            background: 'var(--mob-green-soft)',
            border: '1px solid var(--mob-green)',
            color: 'var(--mob-green)',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <CheckCircle2 size={15} />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* CABECERA EJECUTIVA MÓVIL: RESUMEN GENERAL */}
      <div className="mob-rg-hero">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #002b7a 0%, #0284c7 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              <LayoutDashboard size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-tech)',
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  color: 'var(--mob-text)',
                  letterSpacing: '0.04em'
                }}
              >
                RESUMEN GENERAL
              </div>
              <div
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 600,
                  color: 'var(--mob-text-muted)',
                  textTransform: 'capitalize',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <Calendar size={11} />
                <span>{todayLabel}</span>
              </div>
            </div>
          </div>

          <span className="mobile-pill-badge info" style={{ fontSize: '0.56rem' }}>
            GRUPOS 1–6
          </span>
        </div>

        {/* Acciones Rápidas: Sincronizar / Vista Previa / PDF */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
          {typeof onSyncProfit === 'function' && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="mobile-chip"
              style={{
                justifyContent: 'center',
                padding: '6px 8px',
                borderRadius: '10px',
                fontSize: '0.68rem',
                color: 'var(--mob-cyan)'
              }}
            >
              <RefreshCw
                size={13}
                style={{
                  flexShrink: 0,
                  animation: isSyncing ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span>{isSyncing ? 'Sincroniz...' : 'Sincronizar'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="mobile-chip"
            style={{
              justifyContent: 'center',
              padding: '6px 8px',
              borderRadius: '10px',
              fontSize: '0.68rem'
            }}
          >
            <Eye size={13} />
            <span>Vista Previa</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrintReport(activeBlock)}
            className="mobile-chip"
            style={{
              justifyContent: 'center',
              padding: '6px 8px',
              borderRadius: '10px',
              fontSize: '0.68rem',
              background: 'linear-gradient(135deg, #e60012 0%, #b3000e 100%)',
              borderColor: '#e60012',
              color: '#ffffff'
            }}
          >
            <Printer size={13} />
            <span>Reporte PDF</span>
          </button>
        </div>
      </div>

      {/* SELECTOR RÁPIDO DE LOS 4 APARTADOS */}
      <div className="mobile-chips-row">
        {[
          { id: 'ALL', label: 'Todos (1–4)' },
          { id: 'facturacion', label: '1. Facturación' },
          { id: 'inventario', label: '2. Inventario' },
          { id: 'cobranzas', label: '3. Cobranzas' },
          { id: 'cxp-keystone', label: '4. CxP Keystone' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveBlock(tab.id)}
            className={`mobile-chip ${activeBlock === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. FACTURACIÓN (VENTAS DEL DÍA & ACUMULADO MENSUAL)                       */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'facturacion') && (
        <section className="mob-rg-section" aria-label="1. Facturación">
          <div className="mob-rg-section-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--mob-cyan-soft)',
                  color: 'var(--mob-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Receipt size={15} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-tech)',
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    color: 'var(--mob-cyan)'
                  }}
                >
                  1. FACTURACIÓN
                </div>
                <div style={{ fontSize: '0.60rem', color: 'var(--mob-text-muted)', fontWeight: 600 }}>
                  Facturación del día y acumulado mensual ($ / L)
                </div>
              </div>
            </div>

            {onNavigate && (
              <button
                type="button"
                className="mobile-chip"
                onClick={() => onNavigate('pedidos')}
                style={{ padding: '4px 9px', fontSize: '0.64rem', color: 'var(--mob-navy)' }}
              >
                <span>Preventa</span>
                <ArrowUpRight size={12} />
              </button>
            )}
          </div>

          {/* Tarjeta 1A: Ventas del Día */}
          <div className="mob-rg-card accent-emerald">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-tech)',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: 'var(--mob-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Clock size={14} color="var(--mob-green)" />
                VENTAS DEL DÍA
              </span>
              <span className="mobile-pill-badge success" style={{ fontSize: '0.56rem', textTransform: 'capitalize' }}>
                {todayLabel}
              </span>
            </div>

            <div className="mob-rg-metrics-grid">
              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">
                  <DollarSign size={11} /> Monto Facturado
                </div>
                <div className="mob-rg-metric-val" style={{ color: 'var(--mob-green)' }}>
                  {formatUsd(ventasDelDia.usd)}
                </div>
                <div className="mob-rg-metric-sub">{formatBs(ventasDelDia.bs)}</div>
              </div>

              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">
                  <Droplet size={11} /> Lubricantes Vendidos
                </div>
                <div className="mob-rg-metric-val" style={{ color: 'var(--mob-cyan)' }}>
                  {ventasDelDia.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                </div>
                <div className="mob-rg-metric-sub" style={{ color: 'var(--mob-amber)' }}>
                  ({ventasDelDia.cajas.toLocaleString('es-VE')} cajas)
                </div>
              </div>
            </div>

            <div className="mob-rg-card-footer">
              <span>
                <strong>{ventasDelDia.documentos}</strong> docs • <strong>{ventasDelDia.clientes}</strong> cli. •{' '}
                <strong>{ventasDelDia.skus}</strong> SKUs
              </span>
              <span>
                Ayer: <strong>{formatUsd(ventasDelDia.ayerUsd)}</strong> /{' '}
                {ventasDelDia.ayerLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
              </span>
            </div>
          </div>

          {/* Tarjeta 1B: Acumulado Mensual */}
          <div className="mob-rg-card accent-cyan">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-tech)',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: 'var(--mob-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Calendar size={14} color="var(--mob-cyan)" />
                ACUMULADO MENSUAL
              </span>

              <select
                value={ventasMesFilter}
                onChange={(e) => setVentasMesFilter(e.target.value)}
                className="mob-rg-month-select"
                aria-label="Mes de facturación acumulado"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mob-rg-metrics-grid">
              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">
                  <DollarSign size={11} /> Monto Acumulado
                </div>
                <div className="mob-rg-metric-val" style={{ color: 'var(--mob-green)' }}>
                  {formatUsd(ventasAcumuladoMes.usd)}
                </div>
                <div className="mob-rg-metric-sub">{formatBs(ventasAcumuladoMes.bs)}</div>
                <div className="mob-rg-metric-note">
                  Prom. diario: {formatUsd(ventasAcumuladoMes.promedioDiarioUsd)}
                </div>
              </div>

              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">
                  <Droplet size={11} /> Lubricantes Acum.
                </div>
                <div className="mob-rg-metric-val" style={{ color: 'var(--mob-cyan)' }}>
                  {ventasAcumuladoMes.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                </div>
                <div className="mob-rg-metric-sub" style={{ color: 'var(--mob-amber)' }}>
                  ({ventasAcumuladoMes.cajas.toLocaleString('es-VE')} cajas)
                </div>
                <div className="mob-rg-metric-note">
                  Prom. diario: {ventasAcumuladoMes.promedioDiarioLitros.toLocaleString('es-VE')} L
                </div>
              </div>
            </div>

            <div>
              <div className="mob-rg-card-footer">
                <span>
                  Meta mes: <strong>{ventasAcumuladoMes.metaLitros.toLocaleString('es-VE')} L</strong> •{' '}
                  <strong style={{ color: semMeta.color }}>{ventasAcumuladoMes.pctMeta}%</strong>
                </span>
                <span>
                  {ventasAcumuladoMes.esFuturo
                    ? 'Mes aún no iniciado'
                    : ventasAcumuladoMes.esMesEnCurso
                      ? `Día ${ventasAcumuladoMes.diasTranscurridos}/${ventasAcumuladoMes.diasDelMes} • Proy.: ${ventasAcumuladoMes.proyeccionLitros.toLocaleString('es-VE')} L`
                      : `Mes cerrado • ${ventasAcumuladoMes.documentos} docs`}
                </span>
              </div>
              <div className="mob-rg-progress-track">
                <div
                  className="mob-rg-progress-fill"
                  style={{
                    width: `${Math.min(ventasAcumuladoMes.pctMeta, 100)}%`,
                    background: semMeta.color
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. INVENTARIO (STOCK EN ALMACÉN & VALORIZACIÓN STOCK)                     */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'inventario') && (
        <section className="mob-rg-section" aria-label="2. Inventario">
          <div className="mob-rg-section-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(124, 58, 237, 0.14)',
                  color: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Package size={15} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-tech)',
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    color: '#8b5cf6'
                  }}
                >
                  2. INVENTARIO
                </div>
                <div style={{ fontSize: '0.60rem', color: 'var(--mob-text-muted)', fontWeight: 600 }}>
                  Existencia física total en litros y valorización
                </div>
              </div>
            </div>

            {onNavigate && (
              <button
                type="button"
                className="mobile-chip"
                onClick={() => onNavigate('inventario')}
                style={{ padding: '4px 9px', fontSize: '0.64rem', color: 'var(--mob-navy)' }}
              >
                <span>Ir a Almacén</span>
                <ArrowUpRight size={12} />
              </button>
            )}
          </div>

          {/* Tarjeta 2A: Stock en Almacén */}
          <div
            className="mob-rg-card accent-violet"
            onClick={() => onNavigate?.('inventario')}
            style={{ cursor: onNavigate ? 'pointer' : 'default' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'rgba(124, 58, 237, 0.14)',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Package size={21} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="mob-rg-metric-label">Stock en Almacén</div>
                  <div
                    className="mob-rg-metric-val"
                    style={{ fontSize: 'clamp(1.08rem, 4.4vw, 1.32rem)', color: 'var(--mob-text)', marginTop: '2px' }}
                  >
                    {stockTotalLitros.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}{' '}
                    L
                  </div>
                </div>
              </div>
              <ArrowUpRight size={18} color="var(--mob-text-muted)" />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }} title={stockBreakdownLabel}>
              {stockBreakdownItems.length > 0 ? (
                stockBreakdownItems.map((item) => (
                  <span
                    key={item}
                    style={{
                      fontFamily: 'var(--font-code)',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      background: 'rgba(124, 58, 237, 0.12)',
                      color: '#8b5cf6',
                      border: '1px solid rgba(139, 92, 246, 0.25)'
                    }}
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="mobile-pill-badge info">0 Unidades</span>
              )}
            </div>
          </div>

          {/* Tarjeta 2B: Valorización Stock */}
          <div
            className="mob-rg-card accent-emerald"
            onClick={() => onNavigate?.('inventario')}
            style={{ cursor: onNavigate ? 'pointer' : 'default' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'var(--mob-green-soft)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: 'var(--mob-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <DollarSign size={21} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="mob-rg-metric-label">Valorización Stock</div>
                  <div
                    className="mob-rg-metric-val"
                    style={{ fontSize: 'clamp(1.08rem, 4.4vw, 1.32rem)', color: 'var(--mob-green)', marginTop: '2px' }}
                  >
                    {formatUsd(stockValorizadoUsd)}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={18} color="var(--mob-green)" />
            </div>

            <div className="mob-rg-card-footer">
              <span>
                <strong>Costo reposición total</strong>
              </span>
              <span>{formatBs(stockValorizadoUsd * tasaBcv)}</span>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. COBRANZAS (COBRANZA DEL DÍA & ACUMULADA DEL MES)                       */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'cobranzas') && (
        <section className="mob-rg-section" aria-label="3. Cobranzas">
          <div className="mob-rg-section-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--mob-green-soft)',
                  color: 'var(--mob-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Wallet size={15} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-tech)',
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    color: 'var(--mob-green)'
                  }}
                >
                  3. COBRANZAS
                </div>
                <div style={{ fontSize: '0.60rem', color: 'var(--mob-text-muted)', fontWeight: 600 }}>
                  Recaudación real del día y acumulada del mes
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {TEMP_COLLECTIONS_ADJUSTMENT_ENABLED && canToggleTempCollections && (
                <button
                  type="button"
                  className="mobile-chip"
                  onClick={handleToggleTempCollections}
                  title={
                    tempCollectionsReverted
                      ? 'Solo MASTER: restaurar ajuste 20/11'
                      : 'Solo MASTER: revertir ajuste 20/11 a datos reales'
                  }
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.60rem',
                    borderColor: tempCollectionsReverted ? 'var(--mob-border)' : 'var(--mob-green)',
                    color: tempCollectionsReverted ? 'var(--mob-text-secondary)' : 'var(--mob-green)'
                  }}
                >
                  <RotateCcw size={11} />
                  <span>{tempCollectionsReverted ? 'Real (20/11)' : 'Revertir 20/11'}</span>
                </button>
              )}
              {onNavigate && (
                <button
                  type="button"
                  className="mobile-chip"
                  onClick={() => onNavigate('cxc')}
                  style={{ padding: '4px 9px', fontSize: '0.64rem', color: 'var(--mob-navy)' }}
                >
                  <span>Ir a CxC</span>
                  <ArrowUpRight size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Tarjeta 3A: Cobranza del Día */}
          <div className="mob-rg-card accent-emerald">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-tech)',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: 'var(--mob-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Clock size={14} color="var(--mob-green)" />
                COBRANZA DEL DÍA
              </span>
              <span className="mobile-pill-badge success" style={{ fontSize: '0.56rem', textTransform: 'capitalize' }}>
                {todayLabel}
              </span>
            </div>

            <div className="mob-rg-metrics-grid">
              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">
                  <DollarSign size={11} /> Total Cobrado Hoy
                </div>
                <div className="mob-rg-metric-val" style={{ color: 'var(--mob-green)' }}>
                  {formatUsd(cobranzaDelDia.usd)}
                </div>
                <div className="mob-rg-metric-sub">{formatBs(cobranzaDelDia.bsEquiv)}</div>
              </div>

              <div className="mob-rg-metric-box" style={{ justifyContent: 'space-between' }}>
                <div className="mob-rg-metric-label">Composición Día</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--mob-text-secondary)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                      Divisas
                    </span>
                    <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-text)' }}>
                      {formatUsd(cobranzaDelDia.divisasUsd)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--mob-text-secondary)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7' }} />
                      Bs.
                    </span>
                    <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-text)' }}>
                      {formatUsd(cobranzaDelDia.bsUsd)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="mob-rg-card-footer">
              <span>
                <strong>{cobranzaDelDia.recibos}</strong> {cobranzaDelDia.recibos === 1 ? 'recibo' : 'recibos'} •{' '}
                <strong>{cobranzaDelDia.clientes}</strong> {cobranzaDelDia.clientes === 1 ? 'cliente' : 'clientes'}
              </span>
              <span>
                Ayer: <strong>{formatUsd(cobranzaDelDia.ayerUsd)}</strong> ({cobranzaDelDia.ayerRecibos} rec.)
              </span>
            </div>
          </div>

          {/* Tarjeta 3B: Cobranza Acumulada del Mes */}
          <div className="mob-rg-card accent-teal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-tech)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--mob-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Calendar size={14} color="var(--mob-cyan)" />
                COBRANZA DEL MES
              </span>

              <select
                value={cobranzasMesFilter}
                onChange={(e) => setCobranzasMesFilter(e.target.value)}
                className="mob-rg-month-select"
                aria-label="Mes de cobranza acumulada"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mob-rg-metrics-grid">
              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">
                  <DollarSign size={11} /> Cobrado {cobranzasMesLabel.split(' ')[0]}
                </div>
                <div className="mob-rg-metric-val" style={{ color: 'var(--mob-green)' }}>
                  {formatUsd(cobranzaAcumuladaMes.usd)}
                </div>
                <div className="mob-rg-metric-sub">{formatBs(cobranzaAcumuladaMes.bsEquiv)}</div>
                <div className="mob-rg-metric-note">
                  Prom. diario: {formatUsd(cobranzaAcumuladaMes.promedioDiarioUsd)}
                </div>
              </div>

              <div className="mob-rg-metric-box" style={{ justifyContent: 'space-between' }}>
                <div className="mob-rg-metric-label">Composición Mes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--mob-text-secondary)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                      Divisas
                    </span>
                    <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-text)' }}>
                      {formatUsd(cobranzaAcumuladaMes.divisasUsd)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--mob-text-secondary)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7' }} />
                      Bs.
                    </span>
                    <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-text)' }}>
                      {formatUsd(cobranzaAcumuladaMes.bsUsd)}
                    </strong>
                  </div>
                  {cobranzaAcumuladaMes.bsReal > 0 && (
                    <div
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--font-code)',
                        fontSize: '0.58rem',
                        color: 'var(--mob-text-muted)'
                      }}
                    >
                      {formatBs(cobranzaAcumuladaMes.bsReal)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="mob-rg-card-footer">
                <span>
                  <strong>{cobranzaAcumuladaMes.recibos}</strong> rec. •{' '}
                  <strong>{cobranzaAcumuladaMes.clientes}</strong> cli.
                  {facturadoMesCobranzaUsd > 0 && (
                    <>
                      {' '}
                      • Cobrado vs. Fact.:{' '}
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
                      ? `Día ${cobranzaAcumuladaMes.diasTranscurridos}/${cobranzaAcumuladaMes.diasDelMes} • Proy.: ${formatUsd(cobranzaAcumuladaMes.proyeccionUsd)}`
                      : 'Mes cerrado'}
                </span>
              </div>
              {facturadoMesCobranzaUsd > 0 && (
                <div className="mob-rg-progress-track">
                  <div
                    className="mob-rg-progress-fill"
                    style={{
                      width: `${Math.min(cobranzaVsFacturadoPct, 100)}%`,
                      background: getSemaforoMeta(cobranzaVsFacturadoPct).color
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. CUENTAS POR PAGAR KEYSTONE (SUMATORIA DEL SALDO ACTUAL PENDIENTE)      */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'cxp-keystone') && (
        <section className="mob-rg-section" aria-label="4. Cuentas por Pagar Keystone">
          <div className="mob-rg-section-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--mob-amber-soft)',
                  color: 'var(--mob-amber)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Building2 size={15} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-tech)',
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    color: 'var(--mob-amber)'
                  }}
                >
                  4. CXP KEYSTONE
                </div>
                <div style={{ fontSize: '0.60rem', color: 'var(--mob-text-muted)', fontWeight: 600 }}>
                  Cuentas por pagar pendientes a Keystone, C.A.
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta 4A: Saldo Actual Total CxP Keystone */}
          <div className="mob-rg-card accent-amber">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'var(--mob-amber-soft)',
                    border: '1px solid rgba(217, 119, 6, 0.35)',
                    color: 'var(--mob-amber)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Building2 size={21} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="mob-rg-metric-label">Saldo Por Pagar • Keystone</div>
                  <div
                    className="mob-rg-metric-val"
                    style={{
                      fontSize: 'clamp(1.08rem, 4.4vw, 1.32rem)',
                      color: cxpKeystone.saldoTotalUsd > 0 ? 'var(--mob-amber)' : 'var(--mob-green)',
                      marginTop: '2px'
                    }}
                  >
                    {formatUsd(cxpKeystone.saldoTotalUsd)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {cxpKeystone.desglosePorTipo.length > 0 ? (
                cxpKeystone.desglosePorTipo.map((item) => (
                  <span key={item.label} className="mobile-pill-badge warning" style={{ fontSize: '0.60rem' }}>
                    {item.count} {item.label} • {formatUsd(item.usd)}
                  </span>
                ))
              ) : (
                <span className="mobile-pill-badge success">Solvente • Sin saldo pendiente</span>
              )}
            </div>

            <div className="mob-rg-card-footer">
              <span>
                <strong>{cxpKeystone.documentosPendientes}</strong>{' '}
                {cxpKeystone.documentosPendientes === 1 ? 'cuenta pendiente' : 'cuentas pendientes'}
              </span>
              <span>{formatBs(cxpKeystone.saldoTotalBs)}</span>
            </div>
          </div>

          {/* Tarjeta 4B: Desglose Vigente vs. Vencido */}
          <div className={`mob-rg-card ${cxpKeystone.saldoVencidoUsd > 0 ? 'accent-rose' : 'accent-amber'}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-tech)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--mob-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <DollarSign
                  size={14}
                  color={cxpKeystone.saldoVencidoUsd > 0 ? 'var(--mob-red)' : 'var(--mob-amber)'}
                />
                ESTADO SALDO KEYSTONE
              </span>

              <span
                className={`mobile-pill-badge ${
                  cxpKeystone.saldoTotalUsd <= 0
                    ? 'success'
                    : cxpKeystone.saldoVencidoUsd > 0
                      ? 'danger'
                      : 'warning'
                }`}
              >
                {cxpKeystone.saldoTotalUsd <= 0
                  ? 'Solvente'
                  : cxpKeystone.saldoVencidoUsd > 0
                    ? `${cxpKeystone.vencidoPct}% Vencido`
                    : 'Al Día'}
              </span>
            </div>

            <div className="mob-rg-metrics-grid">
              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">Por Vencer (Vigente)</div>
                <div className="mob-rg-metric-val" style={{ color: 'var(--mob-green)' }}>
                  {formatUsd(cxpKeystone.saldoVigenteUsd)}
                </div>
                <div className="mob-rg-metric-note">
                  {cxpKeystone.docsVigentes} {cxpKeystone.docsVigentes === 1 ? 'documento' : 'documentos'}
                </div>
              </div>

              <div className="mob-rg-metric-box">
                <div className="mob-rg-metric-label">Vencido (En Mora)</div>
                <div
                  className="mob-rg-metric-val"
                  style={{ color: cxpKeystone.saldoVencidoUsd > 0 ? 'var(--mob-red)' : 'var(--mob-text)' }}
                >
                  {formatUsd(cxpKeystone.saldoVencidoUsd)}
                </div>
                <div className="mob-rg-metric-note">
                  {cxpKeystone.docsVencidos} {cxpKeystone.docsVencidos === 1 ? 'documento' : 'documentos'}
                </div>
              </div>
            </div>

            <div className="mob-rg-card-footer">
              <span>
                Proveedor: <strong>Keystone, C.A.</strong> (J-31115365-9)
              </span>
              <span>
                Tasa Keystone: <strong>{formatBs(tasaKeystone)}</strong>
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. RADAR PREDICTIVO & ALERTAS TEMPRANAS (SIGNUM FORESIGHT)                */}
      {/* ========================================================================= */}
      {activeBlock === 'ALL' && (
        <section className="mob-rg-section" aria-label="5. Radar Predictivo & Alertas Tempranas">
          <div className="mob-rg-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'rgba(139, 92, 246, 0.14)',
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Sparkles size={17} />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-tech)',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      color: 'var(--mob-text)'
                    }}
                  >
                    SIGNUM FORESIGHT • RADAR PREDICTIVO
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--mob-text-muted)', fontWeight: 600 }}>
                    Proyecciones de stockout, costos Alm 01/02 y márgenes
                  </div>
                </div>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('predictibilidad')}
                  style={{
                    padding: '6px 11px',
                    borderRadius: '8px',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    background: 'rgba(139, 92, 246, 0.12)',
                    color: '#8b5cf6',
                    fontFamily: 'var(--font-tech)',
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  Abrir <ArrowUpRight size={13} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              <span className={`mobile-pill-badge ${predictiveSummary.criticas > 0 ? 'danger' : 'success'}`}>
                {predictiveSummary.criticas} Alertas Críticas
              </span>
              <span className="mobile-pill-badge warning">
                {predictiveSummary.stockRiskCount} SKUs Riesgo Quiebre
              </span>
              {predictiveSummary.divergentCostCount > 0 && (
                <span className="mobile-pill-badge info">
                  {predictiveSummary.divergentCostCount} SKUs Costo Divergente Alm 01/02
                </span>
              )}
            </div>

            {predictiveSummary.topAlert && (
              <div className="mob-rg-card-footer" style={{ marginTop: '4px' }}>
                <span style={{ fontSize: '0.64rem' }}>
                  <strong>Prioridad #1:</strong> {predictiveSummary.topAlert.titulo || predictiveSummary.topAlert.title}
                </span>
              </div>
            )}
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
