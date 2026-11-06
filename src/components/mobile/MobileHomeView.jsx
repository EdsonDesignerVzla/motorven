import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Users,
  AlertCircle,
  FileText,
  Clock,
  ChevronRight,
  ShieldCheck,
  Zap,
  PhoneCall,
  Share2
} from 'lucide-react';
import { formatUsd, formatBs } from '../../services/formatService';

export default function MobileHomeView({
  currentUser,
  config = {},
  products = [],
  clients = [],
  orders = [],
  sales = [],
  profitInvoices = [],
  onNavigateTab,
  onOpenExecutivePdf
}) {
  const tasaBcv = Number(config?.tasaDolar || 827.73);
  const tasaKeystone = Number(config?.tasaKeystone || 850.00);

  // KPIs Rápidos
  const totalOrders = orders.length;
  const recentOrders = orders.slice(0, 4);

  // Clientes con deuda
  const clientesConSaldo = clients.filter(c => Number(c.saldoUsd || c.saldo_usd || 0) > 0);
  const totalDeudaUsd = clientesConSaldo.reduce((acc, c) => acc + Number(c.saldoUsd || c.saldo_usd || 0), 0);
  const totalDeudaBs = totalDeudaUsd * tasaBcv;

  // Total ventas / facturas
  const allInvoices = profitInvoices.length > 0 ? profitInvoices : sales;
  const totalVentasUsd = allInvoices.reduce((acc, s) => acc + Number(s.totalUsd || s.total_usd || s.totalNetoUsd || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      
      {/* 1. Tarjeta de Bienvenida y Usuario */}
      <div
        className="mobile-card"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.4) 0%, rgba(2, 132, 199, 0.2) 100%)',
          borderColor: 'rgba(2, 132, 199, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div style={{ fontSize: '0.68rem', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
            Portal Móvil SIGNUM
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
            {currentUser?.nombre || 'Operador Motorven'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            {currentUser?.cargo || currentUser?.rol || 'Administrador Master'}
          </div>
        </div>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}
        >
          {currentUser?.avatar || '🛢️'}
        </div>
      </div>

      {/* 2. Tarjeta Tasa Oficial BCV Destacada */}
      <div
        className="mobile-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 78, 59, 0.25) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.35)',
          padding: '0.85rem 1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.66rem', color: '#6ee7b7', fontWeight: 800, textTransform: 'uppercase' }}>
              TASA OFICIAL BCV (VIGENTE)
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace', margin: '2px 0' }}>
              Bs. {tasaBcv.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              Keystone Planta: <strong style={{ color: '#fbbf24' }}>Bs. {tasaKeystone.toFixed(2)}</strong>
            </div>
          </div>
          <div
            style={{
              background: '#10b981',
              color: '#022c22',
              borderRadius: '20px',
              padding: '3px 8px',
              fontSize: '0.65rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <ShieldCheck size={12} /> EN VIVO
          </div>
        </div>
      </div>

      {/* 3. Accesos Rápidos Táctiles (Grid de 2 Columnas) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={() => onNavigateTab('pedidos')}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.7) 0%, rgba(3, 105, 161, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '14px',
            padding: '0.85rem',
            textAlign: 'left',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ fontSize: '1.4rem' }}>📝</div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Nuevo Pedido</div>
          <div style={{ fontSize: '0.65rem', color: '#bae6fd' }}>Preventa y lubricantes</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('cxc')}
          style={{
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.7) 0%, rgba(4, 120, 87, 0.8) 100%)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '14px',
            padding: '0.85rem',
            textAlign: 'left',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ fontSize: '1.4rem' }}>💰</div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Cobranzas CxC</div>
          <div style={{ fontSize: '0.65rem', color: '#a7f3d0' }}>Recordatorio WhatsApp</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('inventario')}
          style={{
            background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.7) 0%, rgba(180, 83, 9, 0.8) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '14px',
            padding: '0.85rem',
            textAlign: 'left',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ fontSize: '1.4rem' }}>🛢️</div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Stock & Precios</div>
          <div style={{ fontSize: '0.65rem', color: '#fde68a' }}>{products.length} productos Oilstone</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('menu')}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            padding: '0.85rem',
            textAlign: 'left',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ fontSize: '1.4rem' }}>📊</div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Más Módulos</div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>POS, Reportes, PC</div>
        </button>
      </div>

      {/* 4. Resumen de Cartera y Cobranzas */}
      <div className="mobile-card">
        <div className="mobile-card-title">
          <TrendingUp size={16} color="#10b981" /> Resumen de Cobranzas
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Total Cartera Pendiente</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
              {formatUsd(totalDeudaUsd)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Equivalente en Bolívares</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
              {formatBs(totalDeudaBs)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span>Clientes con saldo: <strong>{clientesConSaldo.length}</strong></span>
          <button
            type="button"
            onClick={() => onNavigateTab('cxc')}
            style={{ background: 'none', border: 'none', color: '#38bdf8', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem' }}
          >
            Ver listado <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* 5. Últimos Pedidos Recientes */}
      <div className="mobile-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="mobile-card-title" style={{ margin: 0 }}>
            <Clock size={16} color="#38bdf8" /> Pedidos Recientes
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('pedidos')}
            style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Ver todos ({totalOrders})
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.78rem' }}>
            No hay pedidos recientes registrados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentOrders.map((ord, idx) => (
              <div
                key={ord.id || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#f1f5f9' }}>
                    {ord.clienteNombre || 'Cliente General'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                    {ord.numeroDoc || ord.id} • {ord.condicionPago || 'CONTADO'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, color: '#10b981', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    {formatUsd(ord.totalUsd || ord.totalNetoUsd || 0)}
                  </div>
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: ord.estatus === 'FACTURADO' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(217, 119, 6, 0.2)',
                      color: ord.estatus === 'FACTURADO' ? '#34d399' : '#fbbf24'
                    }}
                  >
                    {ord.estatus || 'REGISTRADO'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
