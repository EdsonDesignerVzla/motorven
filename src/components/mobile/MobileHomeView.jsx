import React from 'react';
import {
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart,
  MessageCircle,
  ShieldCheck,
  Zap,
  Smartphone
} from 'lucide-react';
import { formatUsd, formatBs } from '../../services/formatService';
import { detectUserDevice } from './deviceDetection';

export default function MobileHomeView({
  currentUser,
  config = {},
  products = [],
  clients = [],
  orders = [],
  sales = [],
  profitInvoices = [],
  onNavigateTab
}) {
  const deviceInfo = detectUserDevice();
  const tasaBcv = Number(config?.tasaDolar || 827.73);
  const tasaKeystone = Number(config?.tasaKeystone || 850.00);

  // Cálculos consolidados para KPIs
  const allInvoices = profitInvoices.length > 0 ? profitInvoices : sales;
  const totalVentasUsd = allInvoices.reduce((acc, s) => acc + Number(s.totalUsd || s.total_usd || s.totalNetoUsd || 0), 0);
  const totalVentasBs = totalVentasUsd * tasaBcv;

  const clientesConSaldo = clients.filter(c => Number(c.saldoUsd || c.saldo_usd || 0) > 0);
  const totalDeudaUsd = clientesConSaldo.reduce((acc, c) => acc + Number(c.saldoUsd || c.saldo_usd || 0), 0);
  const clientesEnMora = clients.filter(c => Number(c.diasMora || c.dias_mora || 0) > 0).length;

  const totalLitrosDisponibles = products.reduce((acc, p) => acc + (Number(p.stockActual || p.stock || 0) * (Number(p.litrosUnidad || 19))), 0);
  const totalOrdersCount = orders.length;
  const lastOrder = orders[0] || null;

  const userName = currentUser?.nombre?.split(' ')[0] || 'Operador';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="mobile-canvas-view">
      
      {/* 1. BARRA SUPERIOR DE BIENVENIDA Y DETECCIÓN INTELIGENTE DE DISPOSITIVO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, paddingBottom: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #001a4d 100%)',
              border: '1.5px solid #38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.78rem',
              fontWeight: 900,
              color: '#ffffff',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)'
            }}
          >
            {userInitial}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                Hola, {userName}
              </span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
            </div>
            <div style={{ fontSize: '0.60rem', color: '#94a3b8', lineHeight: 1 }}>
              {currentUser?.cargo || currentUser?.rol || 'Administrador'}
            </div>
          </div>
        </div>

        {/* Insignia del Dispositivo Detectado en Tiempo Real (iPhone / Android) */}
        <div className="mobile-device-tag" title={`Dispositivo detectado: ${deviceInfo.model} (${deviceInfo.screenWidth}x${deviceInfo.screenHeight})`}>
          {deviceInfo.isApple ? <span style={{ fontSize: '0.75rem' }}></span> : <Smartphone size={10} />}
          <span>{deviceInfo.model}</span>
        </div>
      </div>

      {/* 2. GRIDVIEW DE KPIS PEQUEÑOS Y ELEGANTES (ESTILO WIDGETS APPLE iOS 2x2) */}
      <div className="mobile-kpi-gridview" style={{ flexShrink: 0 }}>
        
        {/* KPI 1: Tasa Oficial BCV */}
        <div
          className="mobile-kpi-card"
          style={{ '--kpi-accent': '#10b981', '--kpi-icon-bg': 'rgba(16, 185, 129, 0.15)' }}
          onClick={() => onNavigateTab('cxc')}
        >
          <div className="mobile-kpi-header">
            <span className="mobile-kpi-label">TASA BCV</span>
            <div className="mobile-kpi-icon">
              <ShieldCheck size={12} />
            </div>
          </div>
          <div className="mobile-kpi-value" style={{ color: '#34d399' }}>
            Bs. {tasaBcv.toFixed(2)}
          </div>
          <div className="mobile-kpi-subtext">
            Planta: <strong style={{ color: '#fbbf24' }}>Bs. {tasaKeystone.toFixed(2)}</strong>
          </div>
        </div>

        {/* KPI 2: Ventas y Facturación */}
        <div
          className="mobile-kpi-card"
          style={{ '--kpi-accent': '#0284c7', '--kpi-icon-bg': 'rgba(2, 132, 199, 0.15)' }}
          onClick={() => onNavigateTab('pedidos')}
        >
          <div className="mobile-kpi-header">
            <span className="mobile-kpi-label">VENTAS TOTALES</span>
            <div className="mobile-kpi-icon">
              <TrendingUp size={12} />
            </div>
          </div>
          <div className="mobile-kpi-value" style={{ color: '#38bdf8' }}>
            {formatUsd(totalVentasUsd)}
          </div>
          <div className="mobile-kpi-subtext">
            Total: <strong>{formatBs(totalVentasBs)}</strong>
          </div>
        </div>

        {/* KPI 3: Cuentas por Cobrar (CxC) */}
        <div
          className="mobile-kpi-card"
          style={{ '--kpi-accent': clientesEnMora > 0 ? '#ef4444' : '#f59e0b', '--kpi-icon-bg': clientesEnMora > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}
          onClick={() => onNavigateTab('cxc')}
        >
          <div className="mobile-kpi-header">
            <span className="mobile-kpi-label">CARTERA CXC</span>
            <div className="mobile-kpi-icon">
              <DollarSign size={12} />
            </div>
          </div>
          <div className="mobile-kpi-value" style={{ color: '#fbbf24' }}>
            {formatUsd(totalDeudaUsd)}
          </div>
          <div className="mobile-kpi-subtext" style={{ color: clientesEnMora > 0 ? '#fca5a5' : '#86efac' }}>
            {clientesEnMora > 0 ? `⚠️ ${clientesEnMora} en mora` : '✅ Cartera al día'}
          </div>
        </div>

        {/* KPI 4: Stock Oilstone */}
        <div
          className="mobile-kpi-card"
          style={{ '--kpi-accent': '#a855f7', '--kpi-icon-bg': 'rgba(168, 85, 247, 0.15)' }}
          onClick={() => onNavigateTab('inventario')}
        >
          <div className="mobile-kpi-header">
            <span className="mobile-kpi-label">OILSTONE LUBES</span>
            <div className="mobile-kpi-icon">
              <Package size={12} />
            </div>
          </div>
          <div className="mobile-kpi-value" style={{ color: '#c084fc' }}>
            {products.length} SKUs
          </div>
          <div className="mobile-kpi-subtext">
            Stock: <strong>{Math.round(totalLitrosDisponibles).toLocaleString('es-VE')} Lts</strong>
          </div>
        </div>

      </div>

      {/* 3. LANZADOR VISUAL DE ACCIONES RÁPIDAS (VISUAL APP LAUNCHER) */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.58rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px', paddingLeft: '2px' }}>
          Módulos Táctiles Principales
        </div>

        <div className="mobile-launcher-grid">
          
          {/* Botón 1: Preventa / Pedidos */}
          <div className="mobile-launcher-tile" onClick={() => onNavigateTab('pedidos')}>
            <div className="mobile-launcher-icon-wrap" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)' }}>
              <ShoppingCart size={17} />
              {totalOrdersCount > 0 && (
                <span className="mobile-launcher-badge">{totalOrdersCount}</span>
              )}
            </div>
            <span className="mobile-launcher-label">Preventa Pedidos</span>
          </div>

          {/* Botón 2: Cobranzas WhatsApp */}
          <div className="mobile-launcher-tile" onClick={() => onNavigateTab('cxc')}>
            <div className="mobile-launcher-icon-wrap" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)' }}>
              <MessageCircle size={17} />
              {clientesEnMora > 0 && (
                <span className="mobile-launcher-badge" style={{ background: '#f59e0b' }}>{clientesEnMora}</span>
              )}
            </div>
            <span className="mobile-launcher-label">Cobranzas WhatsApp</span>
          </div>

          {/* Botón 3: Catálogo Stock Oilstone */}
          <div className="mobile-launcher-tile" onClick={() => onNavigateTab('inventario')}>
            <div className="mobile-launcher-icon-wrap" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' }}>
              <Package size={17} />
            </div>
            <span className="mobile-launcher-label">Catálogo Aceites</span>
          </div>

          {/* Botón 4: Ventas POS */}
          <div className="mobile-launcher-tile" onClick={() => onNavigateTab('ventas')}>
            <div className="mobile-launcher-icon-wrap" style={{ background: 'linear-gradient(135deg, #e60012 0%, #991b1b 100%)' }}>
              <Zap size={17} />
            </div>
            <span className="mobile-launcher-label">Ventas POS</span>
          </div>

        </div>
      </div>

      {/* 4. HUB DE ACCIÓN INMEDIATA CON BOTONES ERGONÓMICOS TÁCTILES */}
      <div className="mobile-focus-widget" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            ⚡ Actividad Comercial Reciente
          </span>
          <span style={{ fontSize: '0.58rem', color: '#38bdf8', fontWeight: 800, cursor: 'pointer' }} onClick={() => onNavigateTab('pedidos')}>
            Ver todos ({totalOrdersCount}) →
          </span>
        </div>

        {/* Resumen del último pedido */}
        {lastOrder ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '5px 8px',
              cursor: 'pointer'
            }}
            onClick={() => onNavigateTab('pedidos')}
          >
            <div style={{ maxWidth: '65%' }}>
              <div style={{ fontWeight: 800, fontSize: '0.74rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lastOrder.clienteNombre || 'Cliente General'}
              </div>
              <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>
                Pedido #{lastOrder.numeroDoc || lastOrder.id} • {lastOrder.condicionPago || 'CONTADO'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, fontSize: '0.80rem', color: '#10b981', fontFamily: 'monospace' }}>
                {formatUsd(lastOrder.totalUsd || lastOrder.totalNetoUsd || 0)}
              </div>
              <span style={{ fontSize: '0.54rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                {lastOrder.estatus || 'ACTIVO'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.66rem', color: '#64748b', textAlign: 'center', padding: '3px' }}>
            Listo para crear pedidos de lubricantes Oilstone.
          </div>
        )}

        {/* Botones de acción directa rápida para el pulgar */}
        <div className="mobile-quick-actions-bar">
          <button
            type="button"
            className="mobile-quick-action-btn primary"
            onClick={() => onNavigateTab('pedidos')}
          >
            <ShoppingCart size={13} />
            <span>+ Crear Pedido</span>
          </button>

          <button
            type="button"
            className="mobile-quick-action-btn success"
            onClick={() => onNavigateTab('cxc')}
          >
            <MessageCircle size={13} />
            <span>💬 Enviar Cobro</span>
          </button>
        </div>
      </div>

    </div>
  );
}
