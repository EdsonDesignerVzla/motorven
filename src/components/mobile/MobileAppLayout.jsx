import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './mobile.css';
import {
  ArrowLeft,
  ClipboardList,
  Home,
  LayoutDashboard,
  LayoutGrid,
  Monitor,
  Moon,
  Package,
  Sun,
  Wallet
} from 'lucide-react';
import motorvenLogo from '../../assets/logo_motorven_limpio.png';
import MobileHomeView from './MobileHomeView';
import MobileDashboardView from './MobileDashboardView';
import MobileOrdersView from './MobileOrdersView';
import MobileInventoryView from './MobileInventoryView';
import MobileCxCView from './MobileCxCView';
import MobileMenuView from './MobileMenuView';
import SalesPOSView from '../../views/SalesPOSView';
import PredictiveAnalyticsView from '../../views/PredictiveAnalyticsView';
import AppConfigModal from '../AppConfigModal';
import { canAccessModule } from '../../services/authService';
import { formatBs } from '../../services/formatService';
import {
  canAccessMobileCxC,
  canAccessMobileDashboard,
  canAccessMobileInventory,
  canAccessMobilePresale,
  isCommercialPresaleOrder,
  normalizeOrderStatus,
  resolveDailyRate
} from './mobileOrderHelpers';

const MODULE_LABELS = {
  dashboard: 'Resumen General Ejecutivo',
  predictibilidad: 'Predictibilidad & Alertas',
  ventas: 'Facturación POS Caja',
  cxc: 'Cuentas por Cobrar (CxC)'
};

export default function MobileAppLayout({
  products = [],
  clients = [],
  purchases = [],
  orders = [],
  sales = [],
  profitInvoices = [],
  profitCollections = [],
  profitBankAccounts = [],
  profitCashDesks = [],
  profitAccountsPayable = [],
  profitReturns = [],
  profitSellers = [],
  profitZones = [],
  usersList = [],
  config = {},
  currentUser,
  theme = 'light',
  onToggleTheme,
  onSwitchToDesktop,
  onSaveOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onProceedToPOS,
  pendingOrderToBill = null,
  onClearPendingOrder,
  onProcessSale,
  onSaveConfig,
  onSaveClient,
  onDeleteClient,
  onApproveClient,
  onRejectClient,
  onOpenOrdersSalesModal,
  onSyncProfit,
  onLogout
}) {
  const [mobileTab, setMobileTab] = useState('home'); // 'home' | 'pedidos' | 'menu' | 'ventas'
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Estado para enrutamiento cruzado hacia Preventa o Detalle de Pedido
  const [orderIntent, setOrderIntent] = useState({
    key: 0,
    subTab: 'mis_pedidos',
    product: null,
    client: null
  });
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);

  const tasaBcv = resolveDailyRate(config);

  const userInitials = useMemo(() => {
    const name = String(currentUser?.nombre || currentUser?.username || 'SM').trim();
    return name
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SM';
  }, [currentUser]);

  // Si se solicita facturar un pedido desde móvil, abrir POS Caja automáticamente
  useEffect(() => {
    if (pendingOrderToBill) {
      setMobileTab('ventas');
    }
  }, [pendingOrderToBill]);

  // Bloqueo estricto de documento en móvil (Cero elastic scroll en PWA Home)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add('mobile-screen-locked');
    body.classList.add('mobile-screen-locked');

    const preventGlobalScroll = (e) => {
      if (mobileTab === 'home') {
        e.preventDefault();
        return;
      }
      if (!e.target?.closest?.('.mobile-scroll-view')) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventGlobalScroll, { passive: false });
    return () => {
      html.classList.remove('mobile-screen-locked');
      body.classList.remove('mobile-screen-locked');
      document.removeEventListener('touchmove', preventGlobalScroll);
    };
  }, [mobileTab]);

  // Contar solo pedidos comerciales activos (excluye SOLICITUD_CLIENTE, facturados y anulados)
  const activePendingOrdersCount = useMemo(() => {
    return (Array.isArray(orders) ? orders : []).filter((o) => {
      if (!isCommercialPresaleOrder(o)) return false;
      const st = normalizeOrderStatus(o);
      return !st.isBilled && !st.isCancelled;
    }).length;
  }, [orders]);

  const handleNavigateSubmodule = useCallback((modId) => {
    if (modId === 'config' || modId === 'configuracion') {
      setShowConfigModal(true);
      return;
    }
    if (modId === 'pedidos') {
      setSelectedOrderForDetail(null);
      setOrderIntent((prev) => ({
        key: prev.key + 1,
        subTab: 'mis_pedidos',
        product: null,
        client: null
      }));
    }
    setMobileTab(modId);
  }, []);

  const handleCreateOrder = useCallback(() => {
    setSelectedOrderForDetail(null);
    setOrderIntent((prev) => ({
      key: prev.key + 1,
      subTab: 'crear',
      product: null,
      client: null
    }));
    setMobileTab('pedidos');
  }, []);

  const handleOpenOrderDetail = useCallback((order) => {
    setSelectedOrderForDetail(order || null);
    setMobileTab('pedidos');
  }, []);

  const handleConsumeOrderContext = useCallback(() => {
    setOrderIntent((prev) => ({
      ...prev,
      product: null,
      client: null
    }));
  }, []);

  const handleProceedToMobilePOS = useCallback(
    (order) => {
      onProceedToPOS?.(order);
      setMobileTab('ventas');
    },
    [onProceedToPOS]
  );

  const isMainTab = ['home', 'dashboard', 'pedidos', 'cxc', 'inventario', 'menu'].includes(mobileTab);

  // Barra inferior con Inicio, Resumen, Preventa, Cobranzas, Almacén y Menú
  const dockItems = useMemo(() => {
    const items = [
      { id: 'home', label: 'Inicio', icon: Home, badge: null }
    ];
    if (canAccessMobileDashboard(currentUser)) {
      items.push({
        id: 'dashboard',
        label: 'Resumen',
        icon: LayoutDashboard,
        badge: null
      });
    }
    if (canAccessMobilePresale(currentUser)) {
      items.push({
        id: 'pedidos',
        label: 'Preventa',
        icon: ClipboardList,
        badge: activePendingOrdersCount > 0 ? activePendingOrdersCount : null
      });
    }
    if (canAccessMobileCxC(currentUser)) {
      items.push({
        id: 'cxc',
        label: 'Cobranzas',
        icon: Wallet,
        badge: null
      });
    }
    if (canAccessMobileInventory(currentUser)) {
      items.push({
        id: 'inventario',
        label: 'Almacén',
        icon: Package,
        badge: null
      });
    }
    items.push({
      id: 'menu',
      label: 'Menú',
      icon: LayoutGrid,
      badge: null,
      activeOverride: !['home', 'dashboard', 'pedidos', 'cxc', 'inventario'].includes(mobileTab)
    });
    return items;
  }, [currentUser, activePendingOrdersCount, mobileTab]);

  return (
    <div className="mobile-app-root">
      {/* 1. HEADER MÓVIL FIJO (STITCH TOP APP BAR) */}
      <header className="mobile-header-bar">
        <button
          type="button"
          className="mobile-header-brand"
          onClick={() => setMobileTab('home')}
        >
          <div className="mobile-brand-mark">
            <img src={motorvenLogo} alt="SIGNUM MOTORVEN" className="mobile-header-logo" />
          </div>
          <div className="mobile-brand-titles">
            <span className="mobile-brand-title">SIGNUM</span>
            <span className="mobile-brand-sub">MOTORVEN ERP</span>
          </div>
        </button>

        <div className="mobile-header-actions">
          <div className="mobile-rate-pill" title="Tasa Oficial BCV del día">
            <span className="mobile-rate-badge">BCV</span>
            <span className="mobile-rate-value">
              {formatBs(tasaBcv).replace(/^Bs\.\s*/, '')}
            </span>
          </div>

          {onToggleTheme && (
            <button
              type="button"
              className="mobile-icon-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              aria-label="Cambiar tema visual"
            >
              {theme === 'dark' ? <Sun size={15} color="#fbbf24" /> : <Moon size={15} />}
            </button>
          )}

          {onSwitchToDesktop && (
            <button
              type="button"
              className="mobile-btn-switch-pc"
              onClick={onSwitchToDesktop}
              title="Cambiar a Versión Completa de Escritorio (PC)"
            >
              <Monitor size={13} />
              <span>PC</span>
            </button>
          )}

          <button
            type="button"
            className="mobile-avatar-pill"
            onClick={() => setMobileTab('menu')}
            title="Perfil y Menú"
          >
            {userInitials}
          </button>
        </div>
      </header>

      {/* 2. CONTENIDO PRINCIPAL */}
      {mobileTab === 'home' ? (
        <MobileHomeView
          products={products}
          orders={orders}
          clients={clients}
          profitInvoices={profitInvoices}
          sales={sales}
          profitCollections={profitCollections}
          config={config}
          currentUser={currentUser}
          onNavigate={handleNavigateSubmodule}
          onCreateOrder={handleCreateOrder}
          onOpenOrderDetail={handleOpenOrderDetail}
        />
      ) : (
        <main className="mobile-scroll-view">
          {!isMainTab && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--mob-border)'
              }}
            >
              <button
                type="button"
                className="mobile-chip"
                onClick={() => setMobileTab('home')}
                style={{ color: 'var(--mob-navy)' }}
              >
                <ArrowLeft size={14} /> Volver al Inicio
              </button>
              <span className="mobile-pill-badge info">
                {MODULE_LABELS[mobileTab] || mobileTab.toUpperCase()}
              </span>
            </div>
          )}

          {mobileTab === 'dashboard' && (
            <MobileDashboardView
              products={products}
              sales={sales}
              orders={orders}
              profitInvoices={profitInvoices}
              profitCollections={profitCollections}
              profitAccountsPayable={profitAccountsPayable}
              profitSellers={profitSellers}
              usersList={usersList}
              config={config}
              currentUser={currentUser}
              onNavigate={handleNavigateSubmodule}
              onSyncProfit={onSyncProfit}
            />
          )}

          {mobileTab === 'pedidos' && (
            <MobileOrdersView
              orders={orders}
              products={products}
              clients={clients}
              profitInvoices={profitInvoices}
              sales={sales}
              profitSellers={profitSellers}
              config={config}
              currentUser={currentUser}
              onSaveOrder={onSaveOrder}
              onUpdateOrderStatus={onUpdateOrderStatus}
              onDeleteOrder={onDeleteOrder}
              onProceedToPOS={handleProceedToMobilePOS}
              onSwitchToDesktop={onSwitchToDesktop}
              initialSubTab={orderIntent.subTab}
              initialProduct={orderIntent.product}
              initialClient={orderIntent.client}
              initialContextKey={orderIntent.key}
              selectedOrder={selectedOrderForDetail}
              onConsumeInitialContext={handleConsumeOrderContext}
              onClearSelectedOrder={() => setSelectedOrderForDetail(null)}
            />
          )}

          {mobileTab === 'cxc' && (
            <MobileCxCView
              clients={clients}
              profitInvoices={profitInvoices}
              profitCollections={profitCollections}
              sales={sales}
              config={config}
              currentUser={currentUser}
              profitSellers={profitSellers}
              onSyncProfit={onSyncProfit}
              onSelectClientForOrder={(cli) => {
                setSelectedOrderForDetail(null);
                setOrderIntent((prev) => ({
                  key: prev.key + 1,
                  subTab: 'crear',
                  product: null,
                  client: cli
                }));
                setMobileTab('pedidos');
              }}
            />
          )}

          {mobileTab === 'inventario' && (
            <MobileInventoryView
              products={products}
              config={config}
              currentUser={currentUser}
              onSyncProfit={onSyncProfit}
            />
          )}

          {mobileTab === 'menu' && (
            <MobileMenuView
              currentUser={currentUser}
              config={config}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onSwitchToDesktop={onSwitchToDesktop}
              onNavigateTab={handleNavigateSubmodule}
              onSyncProfit={onSyncProfit}
              onLogout={onLogout}
            />
          )}

          {mobileTab === 'predictibilidad' && (
            <PredictiveAnalyticsView
              products={products}
              sales={sales}
              orders={orders}
              purchases={purchases}
              profitInvoices={profitInvoices}
              profitAccountsPayable={profitAccountsPayable}
              profitBankAccounts={profitBankAccounts}
              profitCashDesks={profitCashDesks}
              config={config}
              onNavigate={handleNavigateSubmodule}
            />
          )}

          {/* Facturación directa si se pasa un pedido desde Detalle hacia Caja */}
          {mobileTab === 'ventas' && (
            <SalesPOSView
              products={products}
              clients={clients}
              orders={orders}
              sales={sales}
              profitInvoices={profitInvoices}
              profitSellers={profitSellers}
              profitZones={profitZones}
              profitReturns={profitReturns}
              profitCollections={profitCollections}
              config={config}
              currentUser={currentUser}
              onSaveClient={onSaveClient}
              onDeleteClient={onDeleteClient}
              onApproveClient={onApproveClient}
              onRejectClient={onRejectClient}
              onSyncProfit={onSyncProfit}
              onProcessSale={onProcessSale}
              onOpenOrdersSalesModal={onOpenOrdersSalesModal}
              pendingOrderToBill={pendingOrderToBill}
              onClearPendingOrder={onClearPendingOrder}
            />
          )}
        </main>
      )}

      {/* 3. BOTTOM NAVIGATION BAR ENFOCADA (Inicio / Preventa / Menú) */}
      <nav className="mobile-bottom-dock" aria-label="Navegación Principal Móvil">
        {dockItems.map((tab) => {
          const IconComp = tab.icon;
          const isActive = tab.activeOverride ? true : mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`mobile-dock-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleNavigateSubmodule(tab.id)}
            >
              <IconComp size={19} />
              {tab.badge && <span className="mobile-dock-badge">{tab.badge}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal de Configuración del Sistema */}
      <AppConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={config}
        onSaveConfig={onSaveConfig}
        currentUser={currentUser}
        products={products}
        clients={clients}
      />
    </div>
  );
}
