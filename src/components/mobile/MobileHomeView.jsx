import React from 'react';
import {
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart,
  MessageCircle,
  ShieldCheck,
  Zap,
  Smartphone,
  Building2,
  ShoppingBag,
  FileSpreadsheet,
  Users,
  Award,
  Settings
} from 'lucide-react';
import { formatUsd, formatBs, getProductWarehouseStocks, resolveProductLitersPerUnit } from '../../services/formatService';
import { detectUserDevice } from './deviceDetection';

export default function MobileHomeView({
  currentUser,
  config = {},
  products = [],
  clients = [],
  orders = [],
  sales = [],
  profitInvoices = [],
  profitBankAccounts = [],
  profitPurchases = [],
  profitSellers = [],
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

  const totalLitrosDisponibles = products.reduce(
    (acc, p) => acc + (getProductWarehouseStocks(p).total * resolveProductLitersPerUnit(p)),
    0
  );
  const totalOrdersCount = orders.length;
  const lastOrder = orders[0] || null;

  const userName = currentUser?.nombre?.split(' ')[0] || 'Operador';
  const userInitial = userName.charAt(0).toUpperCase();

  // Definición de todos los módulos del sistema (4 por línea en GridView)
  const systemModules = [
    // Fila 1: Operaciones Principales
    {
      id: 'pedidos',
      label: 'Pedidos',
      icon: ShoppingCart,
      gradient: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
      accentColor: '#38bdf8',
      kpi: `${totalOrdersCount} Docs`,
      badge: totalOrdersCount > 0 ? totalOrdersCount : null
    },
    {
      id: 'cxc',
      label: 'Cobranzas',
      icon: DollarSign,
      gradient: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
      accentColor: clientesEnMora > 0 ? '#ef4444' : '#34d399',
      kpi: formatUsd(totalDeudaUsd),
      badge: clientesEnMora > 0 ? clientesEnMora : null
    },
    {
      id: 'inventario',
      label: 'Stock',
      icon: Package,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      accentColor: '#fbbf24',
      kpi: `${products.length} SKUs`
    },
    {
      id: 'ventas',
      label: 'Ventas POS',
      icon: Zap,
      gradient: 'linear-gradient(135deg, #e60012 0%, #991b1b 100%)',
      accentColor: '#f87171',
      kpi: formatUsd(totalVentasUsd)
    },

    // Fila 2: Finanzas, Tesorería & SENIAT
    {
      id: 'cxc',
      label: 'Tasa BCV',
      icon: ShieldCheck,
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
      accentColor: '#34d399',
      kpi: formatBs(tasaBcv)
    },
    {
      id: 'flujo_caja',
      label: 'Caja/Bancos',
      icon: Building2,
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
      accentColor: '#22d3ee',
      kpi: `${profitBankAccounts.length || 3} Ctas`
    },
    {
      id: 'compras',
      label: 'Compras',
      icon: ShoppingBag,
      gradient: 'linear-gradient(135deg, #eab308 0%, #854d0e 100%)',
      accentColor: '#facc15',
      kpi: `${profitPurchases.length || 0} Docs`
    },
    {
      id: 'seniat',
      label: 'SENIAT',
      icon: FileSpreadsheet,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
      accentColor: '#818cf8',
      kpi: 'IVA / ISLR'
    },

    // Fila 3: Fuerza de Ventas, Analítica & Control
    {
      id: 'vendedores',
      label: 'Vendedores',
      icon: Award,
      gradient: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
      accentColor: '#c084fc',
      kpi: `${profitSellers.length || 0} Asesores`
    },
    {
      id: 'rentabilidad',
      label: 'Rentabilidad',
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
      accentColor: '#fb923c',
      kpi: 'BI Metas'
    },
    {
      id: 'usuarios',
      label: 'Usuarios',
      icon: Users,
      gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      accentColor: '#f472b6',
      kpi: 'Seguridad'
    },
    {
      id: 'config',
      label: 'Ajustes',
      icon: Settings,
      gradient: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
      accentColor: '#94a3b8',
      kpi: 'General'
    }
  ];

  return (
    <div className="mobile-canvas-view">
      
      {/* 1. BARRA SUPERIOR DE BIENVENIDA Y DETECCIÓN INTELIGENTE DE DISPOSITIVO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box', flexShrink: 0, paddingBottom: '2px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
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
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
              flexShrink: 0
            }}
          >
            {userInitial}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Hola, {userName}
              </span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981', flexShrink: 0 }} />
            </div>
            <div style={{ fontSize: '0.60rem', color: '#94a3b8', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {/* 2. GRIDVIEW DE TODOS LOS MÓDULOS (4 KPIS MÁXIMO POR LÍNEA, FILAS SUCESIVAS) */}
      <div style={{ width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ fontSize: '0.58rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '4px', paddingLeft: '2px' }}>
          Módulos del Sistema (4 por línea)
        </div>

        <div className="mobile-modules-gridview">
          {systemModules.map((mod, idx) => {
            const IconComponent = mod.icon;
            return (
              <div
                key={`${mod.id}-${idx}`}
                className="mobile-module-tile"
                style={{ '--mod-accent': mod.accentColor }}
                onClick={() => onNavigateTab(mod.id)}
              >
                <div className="mobile-module-icon-wrap" style={{ background: mod.gradient }}>
                  <IconComponent size={15} />
                  {mod.badge && (
                    <span className="mobile-module-badge">{mod.badge}</span>
                  )}
                </div>
                <div className="mobile-module-title">{mod.label}</div>
                <div className="mobile-module-kpi">{mod.kpi}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. HUB DE ACCIÓN INMEDIATA CON BOTONES ERGONÓMICOS TÁCTILES */}
      <div className="mobile-focus-widget" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
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
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '4px 8px',
              gap: '8px',
              cursor: 'pointer'
            }}
            onClick={() => onNavigateTab('pedidos')}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lastOrder.clienteNombre || 'Cliente General'}
              </div>
              <div style={{ fontSize: '0.56rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Pedido #{lastOrder.numeroDoc || lastOrder.id} • {lastOrder.condicionPago || 'CONTADO'}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#10b981', fontFamily: 'monospace' }}>
                {formatUsd(lastOrder.totalUsd || lastOrder.totalNetoUsd || 0)}
              </div>
              <span style={{ fontSize: '0.52rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                {lastOrder.estatus || 'ACTIVO'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.64rem', color: '#64748b', textAlign: 'center', padding: '2px' }}>
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
