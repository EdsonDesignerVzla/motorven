import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  DollarSign,
  Download,
  Droplet,
  LineChart as LineChartIcon,
  Search,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import {
  calculateStockoutProjections,
  analyzeMarginCompression,
  simulatePriceAdjustment,
  forecastCashflow,
  generateEarlyWarningRadar
} from '../services/predictiveEngineService';
import { formatUsd, formatBs } from '../services/formatService';
import { generatePredictiveReportPDF } from '../services/pdfReportService';

export default function PredictiveAnalyticsView({
  products = [],
  sales = [],
  orders = [],
  purchases = [],
  profitInvoices = [],
  profitAccountsPayable = [],
  profitBankAccounts = [],
  profitCashDesks = [],
  expenses = [],
  payroll = [],
  config = {},
  onNavigate
}) {
  const tasaBcv = Number(config?.tasaDolar || 827.73);

  // Estados de control
  const [horizonDays, setHorizonDays] = useState(30);
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'inventario' | 'margenes' | 'flujocaja'
  const [warehouseFilter, setWarehouseFilter] = useState('ALL'); // 'ALL' | '01' | '02'
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('TODOS');
  const [minSafeMargin, setMinSafeMargin] = useState(18);

  // Estados del Simulador What-If
  const [simSelectedSku, setSimSelectedSku] = useState(products[0]?.codigo || '');
  const [simCostDeltaPct, setSimCostDeltaPct] = useState(10);
  const [simTargetMarginPct, setSimTargetMarginPct] = useState(25);

  // 1. Cálculos del Motor Predictivo
  const stockoutProjections = useMemo(() => {
    return calculateStockoutProjections(products, sales, orders, {
      leadTimeDays: 7,
      targetCoverageDays: horizonDays,
      lookbackDays: 30
    });
  }, [products, sales, orders, horizonDays]);

  const marginAnalysis = useMemo(() => {
    return analyzeMarginCompression(products, {
      minSafeMarginPct: minSafeMargin
    });
  }, [products, minSafeMargin]);

  // Run-rate diario de ventas para el flujo de caja
  const salesRunRateDaily = useMemo(() => {
    let totalSales30d = 0;
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    (sales || []).forEach(s => {
      const d = new Date(s.fecha || s.fec_emis || 0).getTime();
      if (d >= cutoff) totalSales30d += Number(s.totalUsd || s.totalNeto || 0);
    });
    return totalSales30d / 30;
  }, [sales]);

  const cashflowForecast = useMemo(() => {
    return forecastCashflow({
      bankAccounts: profitBankAccounts,
      cashDesks: profitCashDesks,
      cxcInvoices: profitInvoices.filter(i => (Number(i.saldoUsd || i.saldo || 0) > 0)),
      cxpAccounts: profitAccountsPayable.filter(p => (Number(p.saldoUsd || p.saldo || 0) > 0)),
      expenses,
      payroll,
      salesRunRateDaily,
      horizonDays,
      tasaBcv
    });
  }, [profitBankAccounts, profitCashDesks, profitInvoices, profitAccountsPayable, expenses, payroll, salesRunRateDaily, horizonDays, tasaBcv]);

  const earlyWarnings = useMemo(() => {
    return generateEarlyWarningRadar({
      stockoutProjections,
      marginAnalysis,
      cashflowForecast
    });
  }, [stockoutProjections, marginAnalysis, cashflowForecast]);

  // Contadores ejecutivos
  const criticalAlertsCount = earlyWarnings.filter(w => w.severidad === 'CRITICA').length;
  const criticalStockCount = stockoutProjections.filter(p => p.urgencia === 'CRITICO' || p.urgencia === 'AGOTADO').length;
  const squeezedMarginCount = marginAnalysis.filter(m => m.tieneCompresion || m.tienePerdida).length;

  // Filtrado de inventario
  const filteredStockoutProjections = useMemo(() => {
    return stockoutProjections.filter(item => {
      if (warehouseFilter === '01' && !(item.stock01 > 0 || item.consumoDiario > 0)) return false;
      if (warehouseFilter === '02' && !(item.stock02 > 0 || item.consumoDiario > 0)) return false;
      if (urgencyFilter !== 'TODOS' && item.urgencia !== urgencyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = item.codigo.toLowerCase();
        const desc = item.descripcion.toLowerCase();
        const visc = (item.viscosidad || '').toLowerCase();
        if (!code.includes(q) && !desc.includes(q) && !visc.includes(q)) return false;
      }
      return true;
    });
  }, [stockoutProjections, warehouseFilter, urgencyFilter, searchQuery]);

  // Producto actual en el Simulador
  const activeSimProduct = useMemo(() => {
    return products.find(p => String(p.codigo || p.id) === String(simSelectedSku)) || products[0] || {};
  }, [products, simSelectedSku]);

  const simulationResult = useMemo(() => {
    const cost = Number(activeSimProduct.costoUsd || activeSimProduct.costo_usd || activeSimProduct.costo || 25);
    const price = Number(activeSimProduct.precioUsdDetal || activeSimProduct.precio_usd_detal || activeSimProduct.precioUsd || 35);
    return simulatePriceAdjustment({
      currentCost: cost,
      currentPrice: price,
      costDeltaPct: simCostDeltaPct,
      targetMarginPct: simTargetMarginPct
    });
  }, [activeSimProduct, simCostDeltaPct, simTargetMarginPct]);

  // Exportar PDF
  const handleExportPDF = () => {
    try {
      generatePredictiveReportPDF({
        earlyWarnings,
        stockoutProjections,
        marginAnalysis,
        cashflowForecast,
        horizonDays,
        tasaBcv
      });
    } catch (err) {
      console.warn('PDF export error:', err);
    }
  };

  return (
    <div className="view-container" style={{ padding: '1.25rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* CABECERA PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                SIGNUM FORESIGHT
              </h1>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(124, 58, 237, 0.35)',
                  color: '#8b5cf6',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Inteligencia Predictiva
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Proyecciones dinámicas, quiebres de stock por almacén, compresión de margen y horizonte de tesorería
            </p>
          </div>
        </div>

        {/* SELECTOR DE HORIZONTE Y ACCIONES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '3px',
              gap: '2px'
            }}
          >
            {[
              { days: 7, label: '7D' },
              { days: 15, label: '15D' },
              { days: 30, label: '30D' },
              { days: 60, label: '60D' }
            ].map(opt => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setHorizonDays(opt.days)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: horizonDays === opt.days ? 'var(--motorven-navy, #002b7a)' : 'transparent',
                  color: horizonDays === opt.days ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '7px 12px', borderRadius: '9px' }}
          >
            <Download size={14} /> Exportar Proyección PDF
          </button>
        </div>
      </div>

      {/* 4 CARDS DE IMPACTO EJECUTIVO (KPI RADAR) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.9rem',
          marginBottom: '1.3rem'
        }}
      >
        {/* Card 1: Alertas Críticas */}
        <div
          className="rg-card"
          style={{
            background: criticalAlertsCount > 0 ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, var(--bg-card) 100%)' : 'var(--bg-card)',
            borderLeft: `4px solid ${criticalAlertsCount > 0 ? '#ef4444' : '#10b981'}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Alertas Críticas
            </span>
            <ShieldAlert size={18} color={criticalAlertsCount > 0 ? '#ef4444' : '#10b981'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: criticalAlertsCount > 0 ? '#ef4444' : 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
            {criticalAlertsCount}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {criticalAlertsCount > 0 ? 'Requieren intervención inmediata' : 'Sin alertas de alta severidad'}
          </div>
        </div>

        {/* Card 2: Quiebre Inminente de Stock */}
        <div
          className="rg-card"
          style={{
            background: criticalStockCount > 0 ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 100%)' : 'var(--bg-card)',
            borderLeft: `4px solid ${criticalStockCount > 0 ? '#f59e0b' : '#10b981'}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Riesgo Quiebre &lt; 7 Días
            </span>
            <AlertTriangle size={18} color={criticalStockCount > 0 ? '#f59e0b' : '#10b981'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: criticalStockCount > 0 ? '#f59e0b' : 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
            {criticalStockCount} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>SKUs</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {criticalStockCount > 0 ? 'Agotamiento antes del lead time' : 'Cobertura suficiente'}
          </div>
        </div>

        {/* Card 3: Márgenes Comprimidos */}
        <div
          className="rg-card"
          style={{
            background: squeezedMarginCount > 0 ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, var(--bg-card) 100%)' : 'var(--bg-card)',
            borderLeft: `4px solid ${squeezedMarginCount > 0 ? '#a855f7' : '#10b981'}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Márgenes en Riesgo (&lt;{minSafeMargin}%)
            </span>
            <TrendingDown size={18} color={squeezedMarginCount > 0 ? '#a855f7' : '#10b981'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: squeezedMarginCount > 0 ? '#a855f7' : 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
            {squeezedMarginCount} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>SKUs</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Compresión por nuevos costos de compra
          </div>
        </div>

        {/* Card 4: Saldo Proyectado en Tesorería */}
        <div
          className="rg-card"
          style={{
            background: cashflowForecast.tieneBrechaLiquidez ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, var(--bg-card) 100%)' : 'var(--bg-card)',
            borderLeft: `4px solid ${cashflowForecast.tieneBrechaLiquidez ? '#ef4444' : '#10b981'}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Flujo Proyectado ({horizonDays}D)
            </span>
            <DollarSign size={18} color={cashflowForecast.tieneBrechaLiquidez ? '#ef4444' : '#10b981'} />
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: cashflowForecast.saldoFinalProyectadoUsd >= 0 ? '#10b981' : '#ef4444',
              fontFamily: 'var(--font-tech)'
            }}
          >
            {formatUsd(cashflowForecast.saldoFinalProyectadoUsd)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {cashflowForecast.tieneBrechaLiquidez ? `Déficit proyectado el ${cashflowForecast.fechaSaldoMinimo}` : 'Posición de caja positiva'}
          </div>
        </div>
      </div>

      {/* PESTAÑAS PRINCIPALES DEL MÓDULO */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'radar', label: 'Radar de Alertas Tempranas', icon: AlertTriangle, count: earlyWarnings.length },
          { id: 'inventario', label: 'Agotamiento & Quiebre (Stockout)', icon: Droplet, count: criticalStockCount },
          { id: 'margenes', label: 'Costos, Márgenes & Simulador', icon: Calculator, count: squeezedMarginCount },
          { id: 'flujocaja', label: `Flujo de Caja (${horizonDays} Días)`, icon: LineChartIcon }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 1rem',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--motorven-red, #e60012)' : '3px solid transparent',
                background: 'transparent',
                color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} color={isActive ? 'var(--motorven-red, #e60012)' : 'currentColor'} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: tab.id === 'radar' && criticalAlertsCount > 0 ? '#ef4444' : 'rgba(230, 0, 18, 0.15)',
                    color: tab.id === 'radar' && criticalAlertsCount > 0 ? '#ffffff' : 'var(--motorven-red, #e60012)'
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RADAR DE ALERTAS TEMPRANAS */}
      {/* ========================================================================= */}
      {activeTab === 'radar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {earlyWarnings.length === 0 ? (
            <div className="rg-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <CheckCircle2 size={42} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Todos los parámetros se encuentran en rango óptimo
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                No se detectaron quiebres inminentes de stock, compresión de margen ni brechas de liquidez en el horizonte de {horizonDays} días.
              </p>
            </div>
          ) : (
            earlyWarnings.map(alert => {
              const isCrit = alert.severidad === 'CRITICA';
              const isWarn = alert.severidad === 'ADVERTENCIA';
              const badgeBg = isCrit ? 'rgba(239, 68, 68, 0.12)' : (isWarn ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)');
              const badgeBorder = isCrit ? 'rgba(239, 68, 68, 0.35)' : (isWarn ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)');
              const badgeColor = isCrit ? '#ef4444' : (isWarn ? '#f59e0b' : '#10b981');

              return (
                <div
                  key={alert.id}
                  className="rg-card"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    borderLeft: `4px solid ${badgeColor}`,
                    padding: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.85rem', minWidth: 0 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '9px',
                        background: badgeBg,
                        border: `1px solid ${badgeBorder}`,
                        color: badgeColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isCrit ? <ShieldAlert size={20} /> : (isWarn ? <AlertTriangle size={20} /> : <Zap size={20} />)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {alert.titulo}
                        </h4>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '6px',
                            background: badgeBg,
                            border: `1px solid ${badgeBorder}`,
                            color: badgeColor,
                            textTransform: 'uppercase'
                          }}
                        >
                          {alert.severidad}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          • {alert.categoria}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {alert.descripcion}
                      </p>
                    </div>
                  </div>

                  {alert.meta?.sugerenciaCompra && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onNavigate?.('compras')}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      <ShoppingBag size={13} style={{ marginRight: '4px' }} />
                      Reordenar {alert.meta.sugerenciaCompra} unds
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AGOTAMIENTO DE INVENTARIO & STOCKOUT ETA */}
      {/* ========================================================================= */}
      {activeTab === 'inventario' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* BARRA DE FILTROS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar por código o viscosidad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem'
                  }}
                />
              </div>

              {/* Selector de Almacén */}
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem'
                }}
              >
                <option value="ALL">🏢 Ambos Almacenes (Consolidado)</option>
                <option value="01">Depósito 01 (Fiscal)</option>
                <option value="02">Depósito 02 (Entrega / Bóveda)</option>
              </select>

              {/* Filtro de Urgencia */}
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem'
                }}
              >
                <option value="TODOS">Todos los estados de rotación</option>
                <option value="CRITICO">🚨 Crítico (&lt; 7 días)</option>
                <option value="REORDEN">⚠️ Punto de Reorden (7–30 días)</option>
                <option value="OPTIMO">✅ Óptimo (30–90 días)</option>
                <option value="EXCESO">📦 Sobre-Stock (&gt; 90 días)</option>
                <option value="AGOTADO">❌ Stock Agotado (0)</option>
              </select>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Mostrando <strong>{filteredStockoutProjections.length}</strong> de {stockoutProjections.length} productos
            </div>
          </div>

          {/* TABLA PREDICTIVA DE INVENTARIO */}
          <div className="rg-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-container-low, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 14px' }}>SKU / Producto</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Alm 01</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Alm 02</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Comprometido</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>ATP Libre</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Consumo/Día</th>
                  <th style={{ padding: '10px 14px', minWidth: '150px' }}>Cobertura</th>
                  <th style={{ padding: '10px 14px' }}>Quiebre ETA</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Sugerencia Compra</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockoutProjections.map(item => {
                  const isCrit = item.urgencia === 'CRITICO' || item.urgencia === 'AGOTADO';
                  const isWarn = item.urgencia === 'REORDEN';
                  const coveragePct = Math.min(100, (item.diasCobertura / 45) * 100);
                  const barColor = isCrit ? '#ef4444' : (isWarn ? '#f59e0b' : '#10b981');

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isCrit ? 'rgba(239, 68, 68, 0.03)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
                          {item.codigo}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {item.descripcion} ({item.viscosidad})
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                        {item.stock01}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                        {item.stock02}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>
                        {item.comprometidoPreventa > 0 ? `-${item.comprometidoPreventa}` : '0'}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: item.stockDisponibleAtp <= 0 ? '#ef4444' : 'var(--text-main)' }}>
                        {item.stockDisponibleAtp}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.76rem' }}>
                        {item.consumoDiario > 0 ? `${item.consumoDiario} /d` : '—'}
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', borderRadius: '4px', background: 'var(--surface-container-high, #e2e8f0)', overflow: 'hidden' }}>
                            <div style={{ width: `${coveragePct}%`, height: '100%', background: barColor }} />
                          </div>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, minWidth: '40px', color: barColor }}>
                            {item.diasCobertura >= 999 ? '∞' : `${item.diasCobertura} d`}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', fontSize: '0.76rem', color: isCrit ? '#ef4444' : 'var(--text-muted)', fontWeight: isCrit ? 700 : 500 }}>
                        {item.fechaEstimadaQuiebre || 'Sin agotamiento previsto'}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: isCrit ? 'rgba(239, 68, 68, 0.15)' : (isWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                            color: barColor,
                            textTransform: 'uppercase'
                          }}
                        >
                          {item.urgencia}
                        </span>
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {item.sugerenciaCompra > 0 ? (
                          <div>
                            <span style={{ fontWeight: 800, color: 'var(--motorven-navy, #002b7a)' }}>
                              +{item.sugerenciaCompra} {item.unidad}
                            </span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              ≈ {formatUsd(item.costoEstimadoReposicionUsd)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Stock cubierto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COSTOS, MÁRGENES & SIMULADOR WHAT-IF */}
      {/* ========================================================================= */}
      {activeTab === 'margenes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* Panel Izquierdo: Simulador Interactivo What-If */}
          <div className="rg-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(124, 58, 237, 0.15)',
                  color: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Calculator size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Simulador de Impacto ("What-If")
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Calcula el impacto si el proveedor aumenta el costo en el nuevo cargamento
                </p>
              </div>
            </div>

            {/* Selector de Producto a Simular */}
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Seleccionar Producto
              </label>
              <select
                value={simSelectedSku}
                onChange={(e) => setSimSelectedSku(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.84rem'
                }}
              >
                {products.map(p => (
                  <option key={p.id} value={p.codigo}>
                    {p.codigo} — {p.descripcion} (Costo actual: ${p.costoUsd || p.costo || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Slider 1: Variación de Costo (%) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Variación en Costo de Reposición:</span>
                <span style={{ fontWeight: 800, color: simCostDeltaPct > 0 ? '#ef4444' : '#10b981', fontFamily: 'var(--font-tech)' }}>
                  {simCostDeltaPct > 0 ? `+${simCostDeltaPct}%` : `${simCostDeltaPct}%`}
                </span>
              </div>
              <input
                type="range"
                min="-20"
                max="50"
                step="1"
                value={simCostDeltaPct}
                onChange={(e) => setSimCostDeltaPct(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>-20% (Rebaja)</span>
                <span>0% (Sin cambio)</span>
                <span>+50% (Aumento)</span>
              </div>
            </div>

            {/* Slider 2: Margen Objetivo (%) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Margen Bruto Objetivo Deseado:</span>
                <span style={{ fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-tech)' }}>
                  {simTargetMarginPct}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                value={simTargetMarginPct}
                onChange={(e) => setSimTargetMarginPct(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>10% (Mínimo)</span>
                <span>25% (Estándar)</span>
                <span>50% (Alto)</span>
              </div>
            </div>

            {/* RESULTADOS DE LA SIMULACIÓN */}
            <div
              style={{
                background: 'var(--surface-container-low, rgba(0,0,0,0.03))',
                borderRadius: '10px',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Costo Actual:</span>
                <span style={{ fontWeight: 700 }}>{formatUsd(simulationResult.currentCost)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Costo Proyectado con Aumento:</span>
                <span style={{ fontWeight: 800, color: '#ef4444' }}>{formatUsd(simulationResult.projectedCost)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Precio Venta Actual:</span>
                <span style={{ fontWeight: 700 }}>{formatUsd(simulationResult.currentPrice)}</span>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Margen Resultante si NO subes precio:</span>
                <span
                  style={{
                    fontWeight: 800,
                    color: simulationResult.projectedMarginWithCurrentPricePct < minSafeMargin ? '#ef4444' : '#10b981'
                  }}
                >
                  {simulationResult.projectedMarginWithCurrentPricePct}% ({formatUsd(simulationResult.projectedMarginWithCurrentPriceUsd)})
                </span>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '10px',
                  marginTop: '6px'
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                  💡 Precio Sugerido para mantener {simTargetMarginPct}% de Margen:
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)', marginTop: '2px' }}>
                  {formatUsd(simulationResult.suggestedPriceToKeepMargin)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Ajuste necesario: +{formatUsd(simulationResult.priceAdjustmentUsd)} (+{simulationResult.priceAdjustmentPct}%)
                </div>
              </div>
            </div>
          </div>

          {/* Panel Derecho: Tabla de Márgenes en Riesgo */}
          <div className="rg-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Auditoría de Compresión de Márgenes
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Productos con margen inferior al umbral de seguridad ({minSafeMargin}%)
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444'
                }}
              >
                {squeezedMarginCount} Comprimidos
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>SKU</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Costo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>P. Detal</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Margen $</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Margen %</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {marginAnalysis.map(item => {
                    const isSqueezed = item.tieneCompresion;
                    const isLoss = item.tienePerdida;
                    const color = isLoss ? '#ef4444' : (isSqueezed ? '#f59e0b' : '#10b981');

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: isLoss ? 'rgba(239, 68, 68, 0.05)' : (isSqueezed ? 'rgba(245, 158, 11, 0.03)' : 'transparent')
                        }}
                      >
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-tech)' }}>{item.codigo}</span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.descripcion}</div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                          {formatUsd(item.costoGeneral)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                          {formatUsd(item.precioDetal01)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color }}>
                          {formatUsd(item.margenPrincipalUsd)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color }}>
                          {item.margenPrincipalPct}%
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '5px',
                              background: isLoss ? '#ef4444' : (isSqueezed ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                              color: isLoss ? '#ffffff' : color
                            }}
                          >
                            {item.estadoMargen}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FLUJO DE CAJA PREDICTIVO (CASHFLOW HORIZON) */}
      {/* ========================================================================= */}
      {activeTab === 'flujocaja' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* GRÁFICO RECHARTS DE FLUJO DE CAJA */}
          <div className="rg-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Curva de Liquidez Proyectada ({horizonDays} Días)
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Proyección de saldo disponible en bancos y cajas cruzando cobros previstos de CxC y compromisos de pago en CxP
                </p>
              </div>

              {cashflowForecast.tieneBrechaLiquidez && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#ef4444',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  <ShieldAlert size={14} />
                  Alerta: Saldo negativo previsto de {formatUsd(cashflowForecast.saldoMinimoUsd)} el {cashflowForecast.fechaSaldoMinimo}
                </div>
              )}
            </div>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={cashflowForecast.proyeccionesDiarias}
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" opacity={0.6} />
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={(val) => val.slice(5)}
                    stroke="var(--text-muted)"
                    fontSize={11}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatUsd(val), 'Saldo Proyectado']}
                    labelFormatter={(label) => `Fecha: ${label}`}
                    contentStyle={{
                      background: 'var(--bg-card, #ffffff)',
                      borderColor: 'var(--border-color, #cbd5e1)',
                      borderRadius: '8px',
                      fontSize: '0.78rem'
                    }}
                  />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Límite Cero ($0)', fill: '#ef4444', fontSize: 10 }} />
                  <Area
                    type="monotone"
                    dataKey="saldoProyectadoUsd"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSaldo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABLA DÍA POR DÍA DE FLUJO */}
          <div className="rg-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.88rem' }}>
              Cronograma Detallado de Flujo de Fondos Previsto
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-container-low, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 14px' }}>Día / Fecha</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right', color: '#10b981' }}>Cobros Previstos</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right', color: '#ef4444' }}>Pagos Comprometidos</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right' }}>Flujo Neto Diario</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right' }}>Saldo Proyectado (USD)</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right' }}>Saldo en Bs (BCV)</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center' }}>Condición</th>
                </tr>
              </thead>
              <tbody>
                {cashflowForecast.proyeccionesDiarias.slice(0, 20).map(d => {
                  const isNeg = d.saldoProyectadoUsd < 0;
                  return (
                    <tr
                      key={d.dayIndex}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isNeg ? 'rgba(239, 68, 68, 0.06)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '8px 14px', fontWeight: 600 }}>
                        {d.fecha} (Día {d.dayIndex + 1})
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                        +{formatUsd(d.ingresosPrevistos)}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>
                        -{formatUsd(d.egresosComprometidos)}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700 }}>
                        {formatUsd(d.flujoNetoDia)}
                      </td>
                      <td
                        style={{
                          padding: '8px 14px',
                          textAlign: 'right',
                          fontWeight: 800,
                          fontFamily: 'var(--font-tech)',
                          color: isNeg ? '#ef4444' : 'var(--text-main)'
                        }}
                      >
                        {formatUsd(d.saldoProyectadoUsd)}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        {formatBs(d.saldoProyectadoBs)}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isNeg ? '#ef4444' : 'rgba(16, 185, 129, 0.15)',
                            color: isNeg ? '#ffffff' : '#10b981'
                          }}
                        >
                          {isNeg ? 'DÉFICIT' : 'CUBIERTO'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
