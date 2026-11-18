import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  ClipboardList,
  LogOut,
  Monitor,
  Moon,
  Package,
  RefreshCw,
  Settings,
  Sun,
  Wallet
} from 'lucide-react';
import { canAccessModule } from '../../services/authService';
import { canAccessMobileCxC, canAccessMobileInventory } from './mobileOrderHelpers';

const MENU_SECTIONS = [
  {
    title: 'Módulos Móviles Activos',
    items: [
      {
        id: 'pedidos',
        accessKey: 'pedidos',
        label: 'Preventa Móvil y Mis Pedidos',
        sub: 'Generar preventa ATP 72h, NE Alm 02 y Fiscal Alm 01',
        icon: ClipboardList,
        color: 'var(--mob-navy)',
        bg: 'var(--mob-navy-soft)'
      },
      {
        id: 'cxc',
        accessKey: 'cxc',
        label: 'Cuentas por Cobrar (CxC)',
        sub: 'Cartera de clientes, cobranzas, moras y estados de cuenta',
        icon: Wallet,
        color: 'var(--mob-cyan)',
        bg: 'var(--mob-cyan-soft)'
      },
      {
        id: 'inventario',
        accessKey: 'inventario',
        label: 'Almacén e Inventario Consolidado',
        sub: 'Alm 01 SENIAT + Alm 02 Bóveda • Solo Lectura y PDF',
        icon: Package,
        color: 'var(--mob-green)',
        bg: 'var(--mob-green-soft)'
      }
    ]
  },
  {
    title: 'Ajustes del Sistema',
    items: [
      {
        id: 'config',
        accessKey: 'configuracion',
        label: 'Configuración ERP',
        sub: 'Tasa BCV, empresa e impuestos',
        icon: Settings,
        color: 'var(--mob-text-muted)',
        bg: 'var(--mob-surface-high)'
      }
    ]
  }
];

export default function MobileMenuView({
  currentUser,
  config,
  theme = 'light',
  onToggleTheme,
  onSwitchToDesktop,
  onNavigateTab,
  onSyncProfit,
  onLogout
}) {
  const [syncing, setSyncing] = useState(false);

  const userName = String(currentUser?.nombre || currentUser?.username || 'Usuario Motorven').trim();
  const initials = userName
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SM';

  const visibleSections = useMemo(() => {
    return MENU_SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => {
        if (item.id === 'inventario') return canAccessMobileInventory(currentUser);
        if (item.id === 'cxc') return canAccessMobileCxC(currentUser);
        return canAccessModule(currentUser?.rol, item.accessKey, currentUser);
      })
    })).filter((sec) => sec.items.length > 0);
  }, [currentUser]);

  const handleSync = async () => {
    if (!onSyncProfit || syncing) return;
    setSyncing(true);
    try {
      await onSyncProfit({ silent: false });
    } catch {
      // Notificado desde App.jsx
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '0.5rem' }}>
      {/* 1. Perfil Ejecutivo del Usuario */}
      <div className="mobile-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div className="mobile-user-avatar" style={{ width: '44px', height: '44px', fontSize: '0.92rem' }}>
          {initials}
          <span className="mobile-online-dot" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--mob-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {userName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
            <span className="mobile-pill-badge info">{currentUser?.rol || 'OPERADOR'}</span>
            {currentUser?.username && (
              <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.66rem', color: 'var(--mob-text-muted)' }}>
                @{currentUser.username}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Controles del Sistema: Versión PC / Tema / Sincronizar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {onSwitchToDesktop && (
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="mobile-card"
            style={{
              gridColumn: '1 / -1',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              background: 'var(--mob-navy-soft)',
              borderColor: 'var(--mob-border-strong)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mob-navy)', fontWeight: 800, fontSize: '0.80rem' }}>
              <Monitor size={17} /> Ver Versión Computadora (PC)
            </div>
            <ChevronRight size={16} color="var(--mob-navy)" />
          </button>
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="mobile-card"
            style={{
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              cursor: 'pointer',
              fontSize: '0.76rem',
              fontWeight: 800,
              color: 'var(--mob-text)'
            }}
          >
            {theme === 'dark' ? <Sun size={16} color="var(--mob-amber)" /> : <Moon size={16} color="var(--mob-navy)" />}
            {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
          </button>
        )}

        {onSyncProfit && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="mobile-card"
            style={{
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              cursor: 'pointer',
              fontSize: '0.76rem',
              fontWeight: 800,
              color: 'var(--mob-cyan)'
            }}
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Profit'}
          </button>
        )}
      </div>

      {/* 3. Módulos Activos (Solo Preventa y Ajustes) */}
      {visibleSections.map((sec) => (
        <div key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="mobile-telemetry-label" style={{ paddingLeft: '4px' }}>
            {sec.title}
          </div>
          <div className="mobile-card" style={{ padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {sec.items.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigateTab?.(item.id)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: '9px 10px',
                    borderRadius: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        background: item.bg,
                        color: item.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <IconComp size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.80rem', fontWeight: 800, color: 'var(--mob-text)' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--mob-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.sub}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={15} color="var(--mob-text-subtle)" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 4. Cerrar Sesión + Footer Institucional Real */}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="mobile-card"
          style={{
            padding: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'var(--mob-red-soft)',
            borderColor: 'var(--mob-red)',
            color: 'var(--mob-red)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          <LogOut size={16} /> Cerrar Sesión Segura
        </button>
      )}

      <div style={{ textAlign: 'center', padding: '6px 0 2px', fontSize: '0.66rem', color: 'var(--mob-text-muted)' }}>
        <div style={{ fontWeight: 800, color: 'var(--mob-text-secondary)' }}>
          {config?.marcaOficial || 'OILSTONE ® por KEYSTONE, C.A.'}
        </div>
        <div style={{ fontFamily: 'var(--font-code)', marginTop: '2px' }}>
          {config?.nombreEmpresa || 'SIGNUM MOTORVEN C.A.'} • RIF {config?.rif || 'J-31115365-9'}
        </div>
      </div>
    </div>
  );
}
