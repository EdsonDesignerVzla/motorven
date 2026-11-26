import React, { useState, useMemo } from 'react';
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
  Smartphone,
  Scale,
  Sparkles
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
  onToggleSidebar,
  orders = []
}) {
  const ventasOrdersCount = useMemo(() => {
    if (!Array.isArray(orders)) return 0;
    return orders.filter(o => {
      if (!o) return false;
      const tDoc = String(o.tipoDoc || o.tipo_doc || '').trim().toUpperCase();
      if (tDoc === 'SOLICITUD_CLIENTE') return false;
      const idUpper = String(o.id || '').toUpperCase();
      const docUpper = String(o.numeroDoc || o.numero_doc || '').toUpperCase();
      if (idUpper.includes('TEST') || docUpper.includes('TEST')) return false;
      const st = String(o.status || o.estado || '').trim().toUpperCase();
      return (st === 'APROBADO' || st === 'EN_CAJA' || st === 'EMITIDO') && Array.isArray(o.items) && o.items.length > 0;
    }).length;
  }, [orders]);

  const pipelineOrdersCount = useMemo(() => {
    if (!Array.isArray(orders)) return 0;
    return orders.filter(o => {
      if (!o) return false;
      const tDoc = String(o.tipoDoc || o.tipo_doc || '').trim().toUpperCase();
      if (tDoc === 'SOLICITUD_CLIENTE') return false;
      const idUpper = String(o.id || '').toUpperCase();
      const docUpper = String(o.numeroDoc || o.numero_doc || '').toUpperCase();
      if (idUpper.includes('TEST') || docUpper.includes('TEST')) return false;
      const st = String(o.status || o.estado || '').trim().toUpperCase();
      return !['FACTURADO', 'ANULADO', 'ANULADA', 'CADUCADO', 'EXPIRADO', 'RECHAZADO'].includes(st) && Array.isArray(o.items) && o.items.length > 0;
    }).length;
  }, [orders]);
  const allMenuItems = [
    // I. SÍNTESIS EJECUTIVA (CONSOLIDADO VEN-NIF 1 AL 6)
    {
      id: 'dashboard',
      label: 'Resumen General',
      icon: LayoutDashboard,
      section: 'DIRECCIÓN & SÍNTESIS FINANCIERA',
      sectionBadge: 'GRUPOS 1–6',
      sectionColor: '#38bdf8',
      codeTag: '1–6',
      codeColor: '#38bdf8',
      accountingHint: 'Síntesis Consolidada BA VEN-NIF 2 (Balance General + Estado de Resultados)'
    },
    {
      id: 'predictibilidad',
      label: 'Predictibilidad & Alertas',
      icon: Sparkles,
      section: 'DIRECCIÓN & SÍNTESIS FINANCIERA',
      sectionBadge: 'FORESIGHT',
      sectionColor: '#8b5cf6',
      codeTag: 'PROY',
      codeColor: '#8b5cf6',
      accountingHint: 'Inteligencia Predictiva — Proyecciones de agotamiento, márgenes y horizonte de tesorería'
    },

    // II. CUENTAS REALES (BALANCE GENERAL — SALDOS ACUMULATIVOS)
    {
      id: 'caja',
      label: 'Caja Chica & Bancos',
      icon: Wallet,
      section: 'CUENTAS REALES • BALANCE GENERAL',
      sectionBadge: 'GRUPOS 1–3',
      sectionColor: '#10b981',
      codeTag: '1.01',
      codeColor: '#10b981',
      accountingHint: 'Cuenta Real — 1. Activo Disponible (1.01.01 Cajas/Zelle y 1.01.02 Bancos Nacionales | Deudora)'
    },
    {
      id: 'cxc',
      label: 'Cuentas por Cobrar (CxC)',
      icon: DollarSign,
      section: 'CUENTAS REALES • BALANCE GENERAL',
      sectionBadge: 'GRUPOS 1–3',
      sectionColor: '#10b981',
      codeTag: '1.01.03',
      codeColor: '#10b981',
      accountingHint: 'Cuenta Real — 1. Activo Exigible (1.01.03.001 CxC Comerciales, 1.02 Anticipos y 1.03 Otras | Deudora)'
    },
    {
      id: 'inventario',
      label: normalizeRole(currentUser?.rol) === 'VENTAS' ? 'Catálogo de Lubricantes' : 'Inventario de Lubricantes',
      icon: Droplet,
      section: 'CUENTAS REALES • BALANCE GENERAL',
      sectionBadge: 'GRUPOS 1–3',
      sectionColor: '#10b981',
      codeTag: '1.04',
      codeColor: '#10b981',
      accountingHint: 'Cuenta Real — 1. Activo Realizable (1.04.01.001 Inventario de Mercancía | Deudora)'
    },
    {
      id: 'compras',
      label: 'Compras & Proveedores',
      icon: ShoppingBag,
      section: 'CUENTAS REALES • BALANCE GENERAL',
      sectionBadge: 'GRUPOS 1–3',
      sectionColor: '#10b981',
      codeTag: '2.02/1.04',
      codeColor: '#f59e0b',
      accountingHint: 'Cuenta Real — 2. Pasivo Comercial (2.02.02.* CxP) + Entrada a 1.04 Inventario y 1.05.01.005 Crédito Fiscal'
    },
    {
      id: 'cxp',
      label: 'Cuentas por Pagar (CxP)',
      icon: Building2,
      section: 'CUENTAS REALES • BALANCE GENERAL',
      sectionBadge: 'GRUPOS 1–3',
      sectionColor: '#10b981',
      codeTag: '2.02.02',
      codeColor: '#ef4444',
      accountingHint: 'Cuenta Real — 2. Pasivo Comercial (2.02.02.001–003 CxP Comerciales, Keyton, Kontigo | Acreedora)'
    },
    {
      id: 'pasivos',
      label: 'Cuentas de Pasivo',
      icon: Scale,
      section: 'CUENTAS REALES • BALANCE GENERAL',
      sectionBadge: 'GRUPOS 1–3',
      sectionColor: '#10b981',
      codeTag: '2.01–06',
      codeColor: '#ef4444',
      accountingHint: 'Cuenta Real — 2. Pasivo General (2.02.01 Socios, 2.03 Parafiscales, 2.04 Laborales | Acreedora)'
    },
    {
      id: 'auditoria',
      label: 'Auditoría & Contable',
      icon: ShieldCheck,
      section: 'CUENTAS REALES • BALANCE GENERAL',
      sectionBadge: 'GRUPOS 1–3',
      sectionColor: '#10b981',
      codeTag: '3.01–02',
      codeColor: '#a855f7',
      accountingHint: 'Cuenta Real — 3. Patrimonio (3.01 Capital, 3.02 Superávit/Déficit), 1.06 Activo Fijo y Cierre Contable'
    },

    // III. CUENTAS NOMINALES (ESTADO DE RESULTADOS — CIERRAN AL 31/12)
    {
      id: 'ventas',
      label: 'Ventas \u0026 POS Mostrador',
      icon: ShoppingCart,
      section: 'CUENTAS NOMINALES • RESULTADOS',
      sectionBadge: 'GRUPOS 4–6',
      sectionColor: '#3b82f6',
      codeTag: '4.01',
      codeColor: '#3b82f6',
      accountingHint: 'Cuenta Nominal — 4. Ingresos Operacionales (4.01.01.001 Ventas, 4.01.02 Descuentos/Devoluciones | Acreedora*)'
    },
    {
      id: 'rentabilidad',
      label: 'Rentabilidad & BI',
      icon: TrendingUp,
      section: 'CUENTAS NOMINALES • RESULTADOS',
      sectionBadge: 'GRUPOS 4–6',
      sectionColor: '#3b82f6',
      codeTag: '5.01',
      codeColor: '#8b5cf6',
      accountingHint: 'Cuenta Nominal — 5. Costos de Ventas & Kardex (5.01.01.001 Costo de Venta vs 4.01 Ingresos | Deudora)'
    },
    {
      id: 'vendedores',
      label: 'Fuerza de Ventas',
      icon: Award,
      section: 'CUENTAS NOMINALES • RESULTADOS',
      sectionBadge: 'GRUPOS 4–6',
      sectionColor: '#3b82f6',
      codeTag: '6.01',
      codeColor: '#ec4899',
      accountingHint: 'Cuenta Nominal — 6. Egresos Comerciales (6.01.01.011 Comisiones de Vendedores y Metas | Deudora)'
    },

    // IV. MÓDULOS ESTRUCTURALES (PRE-ASIENTO, TRIBUTARIO SENIAT & GOBIERNO)
    {
      id: 'preventa',
      label: 'Preventa Móvil (Vendedor)',
      icon: Smartphone,
      section: 'CUENTAS / MÓDULOS ESTRUCTURALES',
      sectionBadge: 'CONTROL & FISCAL',
      sectionColor: '#94a3b8',
      codeTag: 'PRE',
      codeColor: '#06b6d4',
      accountingHint: 'Módulo Estructural Pre-Contable — Captura de pedidos en ruta previo al devengo en 4.01.01.001'
    },
    {
      id: 'pedidos',
      label: 'Flujo Comercial & Pedidos',
      icon: Truck,
      section: 'CUENTAS / MÓDULOS ESTRUCTURALES',
      sectionBadge: 'CONTROL & FISCAL',
      sectionColor: '#94a3b8',
      codeTag: 'FLUJO',
      codeColor: '#06b6d4',
      accountingHint: 'Módulo Estructural Pre-Contable — Valida 1.04 Stock y 1.01.03 Crédito antes de facturar'
    },
    {
      id: 'reportes',
      label: 'Libros Fiscales SENIAT',
      icon: FileSpreadsheet,
      section: 'CUENTAS / MÓDULOS ESTRUCTURALES',
      sectionBadge: 'CONTROL & FISCAL',
      sectionColor: '#94a3b8',
      codeTag: '1.05/2.03',
      codeColor: '#eab308',
      accountingHint: 'Módulo Estructural Tributario — Compensa 1.05.01.005 Crédito Fiscal vs 2.03.01.005 Débito Fiscal y Retenciones'
    },
    {
      id: 'usuarios',
      label: 'Gestión de Usuarios',
      icon: Users,
      section: 'CUENTAS / MÓDULOS ESTRUCTURALES',
      sectionBadge: 'CONTROL & FISCAL',
      sectionColor: '#94a3b8',
      codeTag: 'RBAC',
      codeColor: '#94a3b8',
      accountingHint: 'Módulo Estructural de Control Interno — Segregación de funciones y autoría de asientos'
    },
    {
      id: 'notificaciones',
      label: 'Notificaciones & Alertas',
      icon: Bell,
      section: 'CUENTAS / MÓDULOS ESTRUCTURALES',
      sectionBadge: 'CONTROL & FISCAL',
      sectionColor: '#94a3b8',
      codeTag: 'ALERTA',
      codeColor: '#94a3b8',
      accountingHint: 'Módulo Estructural de Supervisión — Vigilancia de vencimientos en CxC (1.01.03), Stock (1.04) y CxP (2.02)'
    },
    {
      id: 'configuracion',
      label: 'Configuración General',
      icon: Settings,
      section: 'CUENTAS / MÓDULOS ESTRUCTURALES',
      sectionBadge: 'CONTROL & FISCAL',
      sectionColor: '#94a3b8',
      codeTag: 'VEN-NIF',
      codeColor: '#94a3b8',
      accountingHint: 'Módulo Estructural de Parametrización — Tasa oficial BCV USD/Bs y reglas de PLAN_DE_CUENTAS_MOTORVEN'
    }
  ];

  // Filtrar los módulos permitidos según el rol activo o permisos personalizados
  const visibleMenuItems = allMenuItems.filter((item) =>
    currentUser ? canAccessModule(currentUser.rol, item.id, currentUser) : true
  );

  // Agrupar ítems visibles respetando el orden estructural contable
  const groupedMenuSections = useMemo(() => {
    const groups = [];
    visibleMenuItems.forEach((item) => {
      const secName = item.section || 'MÓDULOS';
      let existing = groups.find((g) => g.title === secName);
      if (!existing) {
        existing = {
          title: secName,
          badge: item.sectionBadge || '',
          color: item.sectionColor || '#94a3b8',
          items: []
        };
        groups.push(existing);
      }
      existing.items.push(item);
    });
    return groups;
  }, [visibleMenuItems]);

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
              {groupedMenuSections.map((group, gIdx) => (
                <React.Fragment key={group.title}>
                  {!sidebarCollapsed ? (
                    <li
                      className="nav-section-header"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: gIdx === 0 ? '0.15rem 0.65rem 0.25rem 0.65rem' : '0.75rem 0.65rem 0.25rem 0.65rem',
                        marginTop: gIdx === 0 ? '0' : '0.35rem',
                        borderTop: gIdx === 0 ? 'none' : '1px solid var(--border-glass)',
                        userSelect: 'none'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          letterSpacing: '0.6px',
                          color: group.color,
                          textTransform: 'uppercase',
                          lineHeight: 1.2
                        }}
                      >
                        {group.title}
                      </span>
                      {group.badge && (
                        <span
                          style={{
                            fontSize: '0.54rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: `${group.color}1f`,
                            color: group.color,
                            border: `1px solid ${group.color}40`,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {group.badge}
                        </span>
                      )}
                    </li>
                  ) : (
                    gIdx > 0 && (
                      <li
                        aria-hidden="true"
                        style={{
                          borderTop: '1px solid var(--border-glass)',
                          margin: '0.35rem 0.35rem'
                        }}
                      />
                    )
                  )}

                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const badgeCount = item.id === 'ventas' ? ventasOrdersCount : (item.id === 'pedidos' ? pipelineOrdersCount : 0);
                    const showBadge = badgeCount > 0;
                    const baseTitle = item.accountingHint ? `${item.label} • ${item.accountingHint}` : item.label;
                    const badgeTitle = item.id === 'ventas'
                      ? `${item.label} (${badgeCount} orden${badgeCount === 1 ? '' : 'es'} en cola de caja) • ${item.accountingHint || ''}`
                      : `${item.label} (${badgeCount} orden${badgeCount === 1 ? '' : 'es'} en flujo comercial) • ${item.accountingHint || ''}`;
                    return (
                      <li key={item.id} className={`nav-item ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
                        <button
                          onClick={() => handleSelectTab(item.id)}
                          title={showBadge ? badgeTitle : baseTitle}
                          style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                        >
                          <span className="nav-icon-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
                            <Icon size={18} />
                            {sidebarCollapsed && showBadge && (
                              <span style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-6px',
                                background: 'var(--motorven-red, #dc2626)',
                                color: '#fff',
                                fontSize: '0.62rem',
                                fontWeight: 900,
                                minWidth: '15px',
                                height: '15px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 6px rgba(220, 38, 38, 0.7)'
                              }}>
                                {badgeCount}
                              </span>
                            )}
                          </span>
                          {!sidebarCollapsed && (
                            <span className="nav-item-label" style={{ flex: 1, textAlign: 'left', lineHeight: 1.25 }}>
                              {item.label}
                            </span>
                          )}
                          {!sidebarCollapsed && item.codeTag && !showBadge && (
                            <span
                              style={{
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                fontFamily: 'var(--font-code, monospace)',
                                padding: '1px 5px',
                                borderRadius: '5px',
                                background: `${item.codeColor || '#94a3b8'}18`,
                                color: item.codeColor || 'var(--text-muted)',
                                border: `1px solid ${item.codeColor || '#94a3b8'}38`,
                                marginLeft: '4px',
                                flexShrink: 0
                              }}
                            >
                              {item.codeTag}
                            </span>
                          )}
                          {!sidebarCollapsed && showBadge && (
                            <span style={{
                              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                              color: '#ffffff',
                              fontSize: '0.68rem',
                              fontWeight: 900,
                              padding: '1px 6px',
                              borderRadius: '10px',
                              boxShadow: '0 0 8px rgba(239, 68, 68, 0.45)',
                              animation: 'pulse 2s infinite',
                              marginLeft: '4px',
                              flexShrink: 0
                            }}>
                              {badgeCount}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
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
            {!sidebarCollapsed && (
              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.3)', color: '#fff', fontWeight: 800 }}>LIVE</span>
            )}
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

          {/* Botón Cerrar Sesión / Salida del Sistema */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="nav-logout-btn"
              title="Cerrar Sesión y Salir del Sistema"
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
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
              }}
            >
              <LogOut size={16} />
              {!sidebarCollapsed && <span style={{ flex: 1 }}>Cerrar Sesión</span>}
              {!sidebarCollapsed && (
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 800 }}>
                  SALIR
                </span>
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
