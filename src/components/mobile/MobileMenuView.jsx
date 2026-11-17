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
  Receipt,
  Scale
} from 'lucide-react';

import { isMasterOrGerencia } from '../../services/authService';

export default function MobileMenuView({
  currentUser,
  theme,
  onToggleTheme,
  onSwitchToDesktop,
  onNavigateTab,
  onSyncProfit,
  onLogout
}) {
  const isMaster = isMasterOrGerencia(currentUser);

  const menuSections = [
    {
      title: 'Cuentas Reales • Balance General (Grupos 1–3)',
      items: [
        { id: 'flujo_caja', label: 'Caja Chica & Bancos (1.01 Activo)', icon: Building2, color: '#10b981' },
        { id: 'cxc', label: 'Cuentas por Cobrar CxC (1.01.03 Activo)', icon: DollarSign, color: '#10b981' },
        { id: 'compras', label: 'Compras & Proveedores (2.02 / 1.04)', icon: FileText, color: '#f59e0b' },
        { id: 'cxp', label: 'Cuentas por Pagar CxP (2.02.02 Pasivo)', icon: Receipt, color: '#ef4444' },
        { id: 'pasivos', label: 'Cuentas de Pasivo (2.01-06 Pasivo)', icon: Scale, color: '#d97706' },
        { id: 'auditoria', label: 'Auditoría & Contable (3.01-02)', icon: ShieldCheck, color: '#0ea5e9' }
      ]
    },
    {
      title: 'Cuentas Nominales • Resultados (Grupos 4–6)',
      items: [
        { id: 'ventas', label: 'Ventas & POS Mostrador (4.01 Ingresos)', icon: ShoppingCart, color: '#3b82f6' },
        { id: 'rentabilidad', label: 'Rentabilidad & BI (5.01 Costos & Kardex)', icon: TrendingUp, color: '#8b5cf6' },
        { id: 'vendedores', label: 'Fuerza de Ventas (6.01 Comisiones)', icon: Users, color: '#ec4899' }
      ]
    },
    {
      title: 'Módulos Estructurales • Pre-Asiento, Fiscal & Gobierno',
      items: [
        { id: 'pedidos', label: 'Flujo Comercial & Pedidos (Pre-Asiento)', icon: Truck, color: '#06b6d4' },
        { id: 'seniat', label: 'Libros Fiscales SENIAT (1.05 vs 2.03)', icon: ShieldCheck, color: '#eab308' },
        ...(isMaster ? [{ id: 'usuarios', label: 'Usuarios & Permisología (Control RBAC)', icon: Users, color: '#94a3b8' }] : []),
        { id: 'config', label: 'Configuración General (Parámetros BCV)', icon: Settings, color: '#94a3b8' }
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
