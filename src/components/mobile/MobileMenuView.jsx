import React from 'react';
import {
  Monitor,
  Moon,
  Sun,
  LogOut,
  RefreshCw,
  ShoppingCart,
  FileText,
  DollarSign,
  ShieldCheck,
  Users,
  Settings,
  HelpCircle,
  Truck,
  Building2,
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';

export default function MobileMenuView({
  currentUser,
  theme,
  onToggleTheme,
  onSwitchToDesktop,
  onNavigateTab,
  onSyncProfit,
  onLogout
}) {
  const isMaster = currentUser?.rol === 'ADMIN_SISTEMA' || currentUser?.rol === 'MASTER';

  const menuSections = [
    {
      title: 'Operaciones Comerciales',
      items: [
        { id: 'ventas', label: 'Ventas & POS Mostrador', icon: ShoppingCart, color: '#10b981' },
        { id: 'pedidos', label: 'Flujo Comercial & Pedidos', icon: Truck, color: '#38bdf8' },
        { id: 'fuerza_ventas', label: 'Fuerza de Ventas', icon: Users, color: '#a855f7' },
        { id: 'rentabilidad', label: 'Rentabilidad & BI', icon: TrendingUp, color: '#f59e0b' }
      ]
    },
    {
      title: 'Finanzas & SENIAT',
      items: [
        { id: 'cxc', label: 'Cuentas por Cobrar (CxC)', icon: DollarSign, color: '#10b981' },
        { id: 'cxp', label: 'Cuentas por Pagar (CxP)', icon: Receipt, color: '#ef4444' },
        { id: 'flujo_caja', label: 'Caja Chica & Bancos', icon: Building2, color: '#06b6d4' },
        { id: 'seniat', label: 'Libros Fiscales SENIAT', icon: ShieldCheck, color: '#3b82f6' },
        { id: 'compras', label: 'Compras & Proveedores', icon: FileText, color: '#eab308' }
      ]
    },
    {
      title: 'Sistema & Configuración',
      items: [
        ...(isMaster ? [{ id: 'usuarios', label: 'Usuarios & Permisología', icon: Users, color: '#ec4899' }] : []),
        { id: 'config', label: 'Configuración General', icon: Settings, color: '#94a3b8' }
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1.5rem' }}>
      
      {/* 1. Tarjeta de Usuario */}
      <div
        className="mobile-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '1rem'
        }}
      >
        <div
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            color: '#fff',
            flexShrink: 0
          }}
        >
          {currentUser?.avatar || '👤'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser?.nombre || 'Usuario'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {currentUser?.cargo || currentUser?.rol || 'Administrador'}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#38bdf8', marginTop: '2px' }}>
            {currentUser?.email || 'operador@motorven.com'}
          </div>
        </div>
      </div>

      {/* 2. Botón Destacado: Cambiar a Versión de Escritorio */}
      <button
        type="button"
        onClick={onSwitchToDesktop}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(30, 58, 138, 0.3) 100%)',
          border: '1px solid rgba(96, 165, 250, 0.4)',
          borderRadius: '14px',
          padding: '0.85rem 1rem',
          color: '#ffffff',
          cursor: 'pointer',
          width: '100%'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#3b82f6', borderRadius: '10px', padding: '6px', color: '#fff', display: 'flex' }}>
            <Monitor size={18} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Ver Versión Computadora (PC)</div>
            <div style={{ fontSize: '0.66rem', color: '#93c5fd' }}>Activar pantalla completa de escritorio</div>
          </div>
        </div>
        <ChevronRight size={16} color="#60a5fa" />
      </button>

      {/* 3. Acciones Rápidas (Tema & Sincronización) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={onToggleTheme}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '0.75rem',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {theme === 'dark' ? <Sun size={16} color="#f59e0b" /> : <Moon size={16} color="#38bdf8" />}
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onSyncProfit) onSyncProfit();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '0.75rem',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} color="#10b981" />
          <span>Sincronizar</span>
        </button>
      </div>

      {/* 4. Lista de Módulos del Sistema */}
      {menuSections.map((sec, sIdx) => (
        <div key={sIdx} className="mobile-card" style={{ padding: '0.65rem 0.85rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: '6px', paddingLeft: '4px' }}>
            {sec.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sec.items.map((item, iIdx) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigateTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 6px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: iIdx === sec.items.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ color: item.color, display: 'flex' }}>
                      <IconComp size={16} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.label}</span>
                  </div>
                  <ChevronRight size={14} color="#64748b" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 5. Botón de Cerrar Sesión */}
      <button
        type="button"
        onClick={onLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '0.85rem',
          color: '#ef4444',
          fontSize: '0.85rem',
          fontWeight: 800,
          cursor: 'pointer',
          width: '100%'
        }}
      >
        <LogOut size={16} /> Cerrar Sesión
      </button>

      <div style={{ textAlign: 'center', fontSize: '0.62rem', color: '#64748b', marginTop: '4px' }}>
        SIGNUM MOTORVEN • v4.2 Móvil PWA
      </div>

    </div>
  );
}
