import React, { useMemo } from 'react';
import {
  ArrowRight,
  ClipboardList,
  Droplets,
  LayoutDashboard,
  Package,
  PackageCheck,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet
} from 'lucide-react';
import { canAccessModule } from '../../services/authService';
import {
  formatBs,
  formatUnitVe,
  formatUsd,
  getProductWarehouseStocks,
  resolveProductLitersPerUnit,
  round2
} from '../../services/formatService';
import {
  toDateKey,
  normalizeDashboardSalesDocs,
  summarizeSalesWindows,
  summarizeCollectionsWindow
} from '../../services/dashboardMetricsService';
import { consolidateClientReceivables } from '../../utils/cxcUtils';
import { detectUserDevice } from './deviceDetection';
import {
  canAccessMobileCxC,
  canAccessMobileDashboard,
  canAccessMobileInventory,
  canAccessMobilePredictibilidad,
  canAccessMobilePresale,
  computeOrderMetrics,
  getOrderNumber,
  isCommercialPresaleOrder,
  normalizeOrderStatus,
  resolveDailyRate
} from './mobileOrderHelpers';

export default function MobileHomeView({
  products = [],
  orders = [],
  clients = [],
  profitInvoices = [],
  sales = [],
  profitCollections = [],
  config,
  currentUser,
  onNavigate,
  onCreateOrder,
  onOpenOrderDetail
}) {
  const tasaBcv = resolveDailyRate(config);
  const device = useMemo(() => detectUserDevice(), []);

  const userFullName = String(currentUser?.nombre || currentUser?.username || 'Equipo Motorven').trim();
  const firstName = userFullName.split(/\s+/)[0] || 'Usuario';
  const initials = userFullName
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SM';

  const canDashboard = canAccessMobileDashboard(currentUser);
  const canPredictibilidad = canAccessMobilePredictibilidad(currentUser);
  const canPresale = canAccessMobilePresale(currentUser);
  const canInventory = canAccessMobileInventory(currentUser);
  const canCxC = canAccessMobileCxC(currentUser);

  const resumenMetrics = useMemo(() => {
    if (!canDashboard) {
      return { ventasHoyUsd: 0, ventasMesUsd: 0, cobradoMesUsd: 0 };
    }
    const todayKey = toDateKey(new Date());
    const anioActivo = config?.ejercicioFiscalActivo || new Date().getFullYear();
    const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
    const docs = normalizeDashboardSalesDocs({
      profitInvoices,
      sales,
      products,
      tasaBcv
    });
    const { ventasDelDia, ventasAcumuladoMes } = summarizeSalesWindows({
      ventasDocsNormalizados: docs,
      todayKey,
      anioActivo,
      ventasMesFilter: currentMonthStr,
      metaMensualBase: Number(config?.metaComercialLitros) || 20000
    });
    const { mes: cobranzaMes } = summarizeCollectionsWindow({
      profitCollections,
      tasaBcv,
      todayKey,
      monthPrefix: `${anioActivo}-${currentMonthStr}`
    });
    return {
      ventasHoyUsd: round2(ventasDelDia.usd),
      ventasMesUsd: round2(ventasAcumuladoMes.usd),
      cobradoMesUsd: round2(cobranzaMes.usd)
    };
  }, [canDashboard, config, profitInvoices, sales, products, profitCollections, tasaBcv]);

  const cxcMetrics = useMemo(() => {
    if (!canCxC) {
      return { totalPorCobrarUsd: 0, totalPorCobrarBs: 0, clientesConSaldo: 0, clientesEnMora: 0 };
    }
    const list = consolidateClientReceivables({
      clients,
      profitInvoices,
      profitCollections,
      sales,
      tasaBcv,
      includePendingDocs: true
    });
    let totalUsd = 0;
    let clientesConSaldo = 0;
    let clientesEnMora = 0;
    list.forEach((c) => {
      const saldo = Number(c.saldoUsd || c.totalSaldoUsd || 0);
      if (saldo > 0.01) {
        totalUsd += saldo;
        clientesConSaldo += 1;
        if (c.isMora) clientesEnMora += 1;
      }
    });
    return {
      totalPorCobrarUsd: round2(totalUsd),
      totalPorCobrarBs: round2(totalUsd * tasaBcv),
      clientesConSaldo,
      clientesEnMora
    };
  }, [canCxC, clients, profitInvoices, profitCollections, sales, tasaBcv]);

  const metrics = useMemo(() => {
    const commercialOrders = (Array.isArray(orders) ? orders : [])
      .filter(isCommercialPresaleOrder)
      .sort((a, b) => {
        const da = new Date(a.fechaEmision || a.created_at || 0).getTime() || 0;
        const db = new Date(b.fechaEmision || b.created_at || 0).getTime() || 0;
        return db - da;
      });

    let activeOrdersCount = 0;
    let approvedOrdersCount = 0;
    let retainedOrdersCount = 0;
    let billedOrdersCount = 0;
    let activeOrdersUsd = 0;
    let activeOrdersLiters = 0;

    commercialOrders.forEach((o) => {
      const st = normalizeOrderStatus(o);
      if (st.isBilled) {
        billedOrdersCount += 1;
        return;
      }
      if (st.isCancelled) return;

      activeOrdersCount += 1;
      if (st.isRetained) retainedOrdersCount += 1;
      else if (st.isApproved) approvedOrdersCount += 1;

      const m = computeOrderMetrics(o, tasaBcv);
      activeOrdersUsd += m.totalUsd;
      activeOrdersLiters += m.totalLitros;
    });

    // BR-INV-001: solo existencias consolidadas (Alm 01 + Alm 02) > 0
    let totalLitrosDisponibles = 0;
    let totalBultosActivos = 0;
    let skusConStock = 0;
    let hiddenZeroCount = 0;

    (Array.isArray(products) ? products : []).forEach((p) => {
      const stocks = getProductWarehouseStocks(p);
      const stockTotal = Math.max(0, Number(stocks.stock01 || 0)) + Math.max(0, Number(stocks.stock02 || 0));
      if (stockTotal <= 0) {
        hiddenZeroCount += 1;
        return;
      }
      skusConStock += 1;
      totalBultosActivos += stockTotal;
      const lpu = resolveProductLitersPerUnit(p);
      totalLitrosDisponibles += stockTotal * lpu;
    });

    const activeOrders = commercialOrders.filter((o) => {
      const st = normalizeOrderStatus(o);
      return !st.isBilled && !st.isCancelled;
    });

    return {
      activeOrdersCount,
      approvedOrdersCount,
      retainedOrdersCount,
      billedOrdersCount,
      activeOrdersUsd: round2(activeOrdersUsd),
      activeOrdersBs: round2(activeOrdersUsd * tasaBcv),
      activeOrdersLiters: round2(activeOrdersLiters),
      totalLitrosDisponibles: round2(totalLitrosDisponibles),
      totalBultosActivos: round2(totalBultosActivos),
      skusConStock,
      hiddenZeroCount,
      lastOrder: activeOrders[0] || commercialOrders[0] || null
    };
  }, [orders, products, tasaBcv]);

  const lastOrderStatus = metrics.lastOrder ? normalizeOrderStatus(metrics.lastOrder) : null;
  const lastOrderMetrics = metrics.lastOrder ? computeOrderMetrics(metrics.lastOrder, tasaBcv) : null;
  const activeModulesCount = [canDashboard, canPresale, canCxC, canInventory].filter(Boolean).length;

  return (
    <div className="mobile-canvas-view">
      {/* 1. Saludo y Dispositivo */}
      <div className="mobile-greeting-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <div className="mobile-user-avatar">
            {initials}
            <span className="mobile-online-dot" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: 'var(--mob-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              Hola, {firstName}
            </div>
            <div
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: 'var(--mob-text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentUser?.rol || 'ASESOR'} • Operaciones Móviles
            </div>
          </div>
        </div>

        <span className="mobile-device-tag" title={`${device.model} (${device.screenWidth}x${device.screenHeight})`}>
          <Smartphone size={11} />
          {device.brand !== 'Generic' ? device.brand : device.model}
        </span>
      </div>

      {/* Acceso Directo a SIGNUM FORESIGHT: Predictibilidad & Alertas */}
      {canPredictibilidad && (
        <button
          type="button"
          onClick={() => onNavigate?.('predictibilidad')}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            border: '1px solid rgba(139, 92, 246, 0.45)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.22)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#ddd6fe" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.74rem', fontWeight: 900, letterSpacing: '0.03em' }}>
                PREDICTIBILIDAD & ALERTAS (FORESIGHT)
              </div>
              <div style={{ fontSize: '0.58rem', color: '#e0e7ff', fontWeight: 600 }}>
                Proyecciones de demanda, quiebre de stock, márgenes y flujo de caja
              </div>
            </div>
          </div>
          <ArrowRight size={15} color="#ffffff" />
        </button>
      )}

      {/* 2. Telemetría Ejecutiva (Preventa + Inventario Consolidado) */}
      <div className="mobile-telemetry-row">
        <div
          className="mobile-telemetry-card"
          onClick={() => onNavigate?.(canPresale ? 'pedidos' : 'inventario')}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mobile-telemetry-label">Preventas Activas</span>
            <ClipboardList size={13} color="var(--mob-navy)" />
          </div>
          <div className="mobile-telemetry-value" style={{ color: 'var(--mob-navy)' }}>
            {formatUsd(metrics.activeOrdersUsd)}
          </div>
          <div className="mobile-telemetry-sub">
            {metrics.activeOrdersCount} pedido(s) • {formatBs(metrics.activeOrdersBs)}
          </div>
        </div>

        <div
          className="mobile-telemetry-card"
          onClick={() => onNavigate?.(canInventory ? 'inventario' : (canCxC ? 'cxc' : 'pedidos'))}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mobile-telemetry-label">Volumen Planta &gt;0</span>
            <PackageCheck size={13} color="var(--mob-green)" />
          </div>
          <div className="mobile-telemetry-value" style={{ color: 'var(--mob-green)' }}>
            {formatUnitVe(metrics.totalLitrosDisponibles, 0)} L
          </div>
          <div className="mobile-telemetry-sub">
            {metrics.skusConStock} SKUs ({metrics.hiddenZeroCount} en 0 ocultos)
          </div>
        </div>
      </div>

      {/* 3. Fichas de Módulos Activos: Resumen General, Preventa, Cobranzas (CxC) & Inventario Consolidado */}
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns:
            activeModulesCount === 4 || activeModulesCount === 2
              ? 'repeat(2, minmax(0, 1fr))'
              : activeModulesCount === 3
                ? 'repeat(3, minmax(0, 1fr))'
                : '1fr',
          gridTemplateRows: activeModulesCount === 4 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
          gap: '7px'
        }}
      >
        {canDashboard && (
          <button
            type="button"
            onClick={() => onNavigate?.('dashboard')}
            className="mobile-module-tile"
            style={{
              width: '100%',
              minWidth: 0,
              height: '100%',
              minHeight: 0,
              padding: '9px 10px',
              borderRadius: '14px',
              textAlign: 'left',
              borderColor: 'var(--mob-border-strong)'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
              <div
                className="mobile-module-icon-wrap"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--mob-navy-soft)',
                  color: 'var(--mob-navy)'
                }}
              >
                <LayoutDashboard size={15} />
              </div>
              <span className="mobile-pill-badge info" style={{ fontSize: '0.50rem', padding: '2px 6px' }}>
                EJECUTIVO
              </span>
            </div>

            <div style={{ marginTop: '4px', width: '100%' }}>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.73rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                RESUMEN GENERAL
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--mob-text-muted)', fontWeight: 600, marginTop: '1px' }}>
                Ventas • Stock • CxC • CxP
              </div>
            </div>

            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                marginTop: '4px',
                paddingTop: '5px',
                borderTop: '1px solid var(--mob-border)',
                fontSize: '0.58rem',
                color: 'var(--mob-text-secondary)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fact. Mes:</span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-green)' }}>
                  {formatUsd(resumenMetrics.ventasMesUsd)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cobrado Mes:</span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-cyan)' }}>
                  {formatUsd(resumenMetrics.cobradoMesUsd)}
                </strong>
              </div>
            </div>
          </button>
        )}

        {canPresale && (
          <button
            type="button"
            onClick={() => onNavigate?.('pedidos')}
            className="mobile-module-tile featured-navy"
            style={{
              height: '100%',
              minHeight: 0,
              padding: '9px 10px',
              borderRadius: '14px',
              textAlign: 'left'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
              <div
                className="mobile-module-icon-wrap"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8'
                }}
              >
                <ClipboardList size={15} />
              </div>
              <span
                style={{
                  background: metrics.activeOrdersCount > 0 ? '#e60012' : 'rgba(56, 189, 248, 0.22)',
                  color: '#ffffff',
                  fontFamily: 'var(--font-code)',
                  fontSize: '0.56rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '9999px'
                }}
              >
                {metrics.activeOrdersCount} act.
              </span>
            </div>

            <div style={{ marginTop: '4px' }}>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.73rem', fontWeight: 800, color: '#ffffff' }}>
                PREVENTA
              </div>
              <div style={{ fontSize: '0.58rem', color: '#bae6fd', fontWeight: 600, marginTop: '1px' }}>
                ATP 72h
              </div>
            </div>

            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                marginTop: '4px',
                paddingTop: '5px',
                borderTop: '1px solid rgba(255, 255, 255, 0.14)',
                fontSize: '0.58rem',
                color: '#e0f2fe'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Caja / Ret:</span>
                <strong style={{ fontFamily: 'var(--font-code)' }}>
                  {metrics.approvedOrdersCount} / {metrics.retainedOrdersCount}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6ee7b7' }}>
                <span>Facturados:</span>
                <strong style={{ fontFamily: 'var(--font-code)' }}>{metrics.billedOrdersCount}</strong>
              </div>
            </div>
          </button>
        )}

        {canCxC && (
          <button
            type="button"
            onClick={() => onNavigate?.('cxc')}
            className="mobile-module-tile"
            style={{
              width: '100%',
              minWidth: 0,
              height: '100%',
              minHeight: 0,
              padding: '9px 10px',
              borderRadius: '14px',
              textAlign: 'left',
              borderColor: 'var(--mob-border-strong)'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
              <div
                className="mobile-module-icon-wrap"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--mob-cyan-soft)',
                  color: 'var(--mob-cyan)'
                }}
              >
                <Wallet size={15} />
              </div>
              <span
                className={`mobile-pill-badge ${cxcMetrics.clientesEnMora > 0 ? 'warning' : 'success'}`}
                style={{ fontSize: '0.50rem', padding: '2px 6px' }}
              >
                {cxcMetrics.clientesEnMora > 0 ? `${cxcMetrics.clientesEnMora} MORA` : 'AL DÍA'}
              </span>
            </div>

            <div style={{ marginTop: '4px', width: '100%' }}>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.73rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                COBRANZAS / CXC
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--mob-text-muted)', fontWeight: 600, marginTop: '1px' }}>
                Cartera & Cobros
              </div>
            </div>

            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                marginTop: '4px',
                paddingTop: '5px',
                borderTop: '1px solid var(--mob-border)',
                fontSize: '0.58rem',
                color: 'var(--mob-text-secondary)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Por Cobrar:</span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-navy)' }}>
                  {formatUsd(cxcMetrics.totalPorCobrarUsd)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Con Saldo:</span>
                <strong
                  style={{
                    fontFamily: 'var(--font-code)',
                    color: cxcMetrics.clientesEnMora > 0 ? 'var(--mob-red)' : 'var(--mob-green)'
                  }}
                >
                  {cxcMetrics.clientesConSaldo} cli.
                </strong>
              </div>
            </div>
          </button>
        )}

        {canInventory && (
          <button
            type="button"
            onClick={() => onNavigate?.('inventario')}
            className="mobile-module-tile"
            style={{
              width: '100%',
              minWidth: 0,
              height: '100%',
              minHeight: 0,
              padding: '9px 10px',
              borderRadius: '14px',
              textAlign: 'left',
              borderColor: 'var(--mob-border-strong)'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
              <div
                className="mobile-module-icon-wrap"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--mob-green-soft)',
                  color: 'var(--mob-green)'
                }}
              >
                <Package size={15} />
              </div>
              <span className="mobile-pill-badge info" style={{ fontSize: '0.50rem', padding: '2px 6px' }}>
                SOLO LECTURA
              </span>
            </div>

            <div style={{ marginTop: '4px', width: '100%' }}>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.73rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                ALMACÉN / STOCK
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--mob-text-muted)', fontWeight: 600, marginTop: '1px' }}>
                Alm 01 + Alm 02
              </div>
            </div>

            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                marginTop: '4px',
                paddingTop: '5px',
                borderTop: '1px solid var(--mob-border)',
                fontSize: '0.58rem',
                color: 'var(--mob-text-secondary)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SKUs Activos:</span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-red)' }}>
                  {metrics.skusConStock} SKU
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bultos Fís.:</span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--mob-navy)' }}>
                  {formatUnitVe(metrics.totalBultosActivos, 0)}
                </strong>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* 4. Última Preventa Reciente + Botones Directos */}
      <div className="mobile-focus-widget">
        <div
          onClick={() => {
            if (metrics.lastOrder && onOpenOrderDetail && canPresale) {
              onOpenOrderDetail(metrics.lastOrder);
            } else {
              onNavigate?.(canPresale ? 'pedidos' : 'inventario');
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer',
            padding: '2px 2px 4px'
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mobile-telemetry-label">Última Preventa</span>
              {lastOrderStatus && (
                <span className={`mobile-pill-badge ${lastOrderStatus.tone}`} style={{ fontSize: '0.54rem', padding: '1px 6px' }}>
                  {lastOrderStatus.label}
                </span>
              )}
            </div>
            {metrics.lastOrder ? (
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: 'var(--mob-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '2px'
                }}
              >
                {getOrderNumber(metrics.lastOrder)} • {metrics.lastOrder.clienteNombre || metrics.lastOrder.cliente || 'Cliente'}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
                Stock activo listo ({formatUnitVe(metrics.totalLitrosDisponibles, 0)} L)
              </div>
            )}
          </div>

          {metrics.lastOrder && lastOrderMetrics ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                  {formatUsd(lastOrderMetrics.totalUsd)}
                </div>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.62rem', fontWeight: 700, color: 'var(--mob-text-muted)' }}>
                  {formatBs(lastOrderMetrics.totalBs)}
                </div>
              </div>
              <ArrowRight size={14} color="var(--mob-text-muted)" />
            </div>
          ) : (
            <span style={{ fontSize: '0.66rem', color: 'var(--mob-cyan)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} /> ATP 72h
            </span>
          )}
        </div>

        <div className="mobile-quick-actions-bar">
          {canPresale && (
            <button
              type="button"
              className="mobile-quick-action-btn primary"
              onClick={() => (onCreateOrder ? onCreateOrder() : onNavigate?.('pedidos'))}
            >
              <Plus size={15} /> Nueva Preventa
            </button>
          )}
          {canCxC ? (
            <button
              type="button"
              className="mobile-quick-action-btn success"
              onClick={() => onNavigate?.('cxc')}
            >
              <Wallet size={15} /> Cobranzas CxC
            </button>
          ) : canInventory ? (
            <button
              type="button"
              className="mobile-quick-action-btn success"
              onClick={() => onNavigate?.('inventario')}
            >
              <Droplets size={15} /> Ver Inventario
            </button>
          ) : (
            <button
              type="button"
              className="mobile-quick-action-btn success"
              onClick={() => onNavigate?.('pedidos')}
            >
              <ClipboardList size={15} /> Mis Pedidos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
