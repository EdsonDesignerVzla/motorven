import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  ShoppingBag,
  Wallet,
  FileSpreadsheet,
  DollarSign,
  Building2,
  Droplet,
  Sun,
  Moon,
  LogOut,
  Users,
  Award,
  TrendingUp,
  ShieldCheck,
  Server,
  Database,
  Settings,
  Bell,
  Smartphone
} from 'lucide-react';
import MotorvenLogo from './MotorvenLogo';
import { canAccessModule, getRoleMeta, normalizeRole, isMasterAdmin } from '../services/authService';

export default function Navigation({
  activeTab,
  setActiveTab,
  config,
  onUpdateTasa,
  mobileOpen,
  setMobileOpen,
  theme,
  onToggleTheme,
  currentUser,
  onLogout,
  onOpenOrdersSalesModal,
  onOpenCashBankModal,
  onOpenAccountsReceivableModal,
  onOpenAccountsPayableModal,
  sidebarCollapsed = false,
  onToggleSidebar
}) {
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard Ejecutivo', icon: LayoutDashboard },
    { id: 'preventa', label: 'Preventa Móvil (Vendedor)', icon: Smartphone },
    { id: 'pedidos', label: 'Flujo Comercial & Pedidos', icon: Truck },
    {
      id: 'inventario',
      label: normalizeRole(currentUser?.rol) === 'VENTAS' ? 'Catálogo de Lubricantes' : 'Inventario de Lubricantes',
      icon: Droplet
    },
    { id: 'ventas', label: 'Ventas \u0026 POS Mostrador', icon: ShoppingCart },
    { id: 'vendedores', label: 'Fuerza de Ventas', icon: Award },
    { id: 'rentabilidad', label: 'Rentabilidad & BI', icon: TrendingUp },
    { id: 'compras', label: 'Compras & Proveedores', icon: ShoppingBag },
    { id: 'caja', label: 'Caja Chica & Bancos', icon: Wallet },
    { id: 'cxc', label: 'Cuentas por Cobrar (CxC)', icon: DollarSign },
    { id: 'cxp', label: 'Cuentas por Pagar (CxP)', icon: Building2 },
    { id: 'reportes', label: 'Libros Fiscales SENIAT', icon: FileSpreadsheet },
    { id: 'auditoria', label: 'Auditoría & Contable', icon: ShieldCheck },
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: Users },
    { id: 'notificaciones', label: 'Notificaciones & Alertas', icon: Bell },
    { id: 'configuracion', label: 'Configuración General', icon: Settings }
  ];

  // Filtrar los módulos permitidos según el rol activo o permisos personalizados
  const visibleMenuItems = allMenuItems.filter((item) =>
    currentUser ? canAccessModule(currentUser.rol, item.id, currentUser) : true
  );

  const handleSelectTab = (id) => {
    setActiveTab(id);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Overlay Backdrop for Mobile Navigation */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div>
          <div className="brand-header" style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between',
              width: '100%',
              marginBottom: sidebarCollapsed ? '0.25rem' : '0.65rem'
            }}>
              {!sidebarCollapsed ? (
                <div className="brand-full-logo" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <MotorvenLogo width={180} height="auto" />
                </div>
              ) : (
                <div className="brand-collapsed-logo" style={{ display: 'flex', justifyContent: 'center' }}>
                  <MotorvenLogo width={36} height="auto" />
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="logo-slogan">GESTIÓN QUE IMPULSA RESULTADOS</div>
            )}
          </div>

          <nav>
            <ul className="nav-menu">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id} className={`nav-item ${isActive ? 'active' : ''}`}>
                    <button onClick={() => handleSelectTab(item.id)} title={item.label}>
                      <Icon size={18} />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div style={{
          padding: sidebarCollapsed ? '0.75rem 0.25rem' : '1rem 0.65rem',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>

          {/* Botón Visor de Dispositivos */}
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?view=device-simulator`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              width: '100%',
              padding: sidebarCollapsed ? '0.65rem' : '0.65rem 0.85rem',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(2, 132, 199, 0.2) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            title="Visor Responsive: Probar en iPhone, Android, Tablet y PC en una ventana nueva"
          >
            <Smartphone size={16} />
            {!sidebarCollapsed && <span style={{ flex: 1 }}>Visor Responsive</span>}
            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.3)', color: '#fff', fontWeight: 800 }}>LIVE</span>
          </button>

          {/* Selector de Tema Claro / Oscuro */}
          {onToggleTheme && (
            <div
              className="theme-switch-wrapper"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              style={{
                width: '100%',
                justifyContent: sidebarCollapsed ? 'center' : 'stretch'
              }}
              role="button"
              tabIndex={0}
            >
              {sidebarCollapsed ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  {theme === 'dark' ? <Moon size={15} color="var(--motorven-gold)" /> : <Sun size={15} color="#ca8a04" />}
                </div>
              ) : (
                <>
                  <div className="theme-switch-slider" />
                  <div className={`theme-switch-option ${theme === 'light' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
                    <Sun size={14} className="icon-sun" />
                    <span>Claro</span>
                  </div>
                  <div className={`theme-switch-option ${theme === 'dark' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
                    <Moon size={14} className="icon-moon" />
                    <span>Oscuro</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
