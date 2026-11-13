import React, { useState, useEffect } from 'react';
import './mobile.css';
import {
  Home,
  ShoppingCart,
  DollarSign,
  Package,
  Menu,
  Monitor,
  ShieldCheck,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import motorvenLogo from '../../assets/logo_motorven_limpio.png';
import MobileHomeView from './MobileHomeView';
import MobileCxCView from './MobileCxCView';
import MobileInventoryView from './MobileInventoryView';
import MobileMenuView from './MobileMenuView';
import SellerOrderPOSView from '../../views/SellerOrderPOSView';
import SalesPOSView from '../../views/SalesPOSView';
import CashflowView from '../../views/CashflowView';
import PurchasesView from '../../views/PurchasesView';
import TaxReportsView from '../../views/TaxReportsView';
import UsersManagementView from '../../views/UsersManagementView';
import SellersView from '../../views/SellersView';
import ProfitabilityView from '../../views/ProfitabilityView';
import AppConfigModal from '../AppConfigModal';
import { formatBs } from '../../services/formatService';

export default function MobileAppLayout({
  products = [],
  clients = [],
  suppliers = [],
  purchases = [],
  cashMovements = [],
  fiscalClosures = [],
  orders = [],
  sales = [],
  profitInvoices = [],
  profitCollections = [],
  profitBankAccounts = [],
  profitCashDesks = [],
  profitAccountsPayable = [],
  profitSupplierPayments = [],
  profitPurchases = [],
  profitSuppliers = [],
  profitIslrConcepts = [],
  profitBeneficiaries = [],
  profitPaymentOrders = [],
  profitIslrWithholdings = [],
  profitReturns = [],
  profitSellers = [],
  profitZones = [],
  usersList = [],
  config = {},
  currentUser,
  theme,
  onToggleTheme,
  onSwitchToDesktop,
  onSaveOrder,
  onProceedToPOS,
  onProcessSale,
  onSaveConfig,
  onSaveProduct,
  onSaveClient,
  onRegisterPurchase,
  onAddCashMovement,
  onExecuteCierreZ,
  onOpenOrdersSalesModal,
  onUsersUpdated,
  onUpdateCurrentUser,
  onSyncProfit,
  onLogout
}) {
  const [mobileTab, setMobileTab] = useState('home'); // 'home' | 'pedidos' | 'cxc' | 'inventario' | 'menu' | <module_id>
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Bloqueo total de desplazamiento en viewport del celular para Cero-Scroll garantizado
  useEffect(() => {
    document.documentElement.classList.add('mobile-screen-locked');
    document.body.classList.add('mobile-screen-locked');

    const handleTouchMove = (e) => {
      // Si está en la pantalla de inicio, bloquear cualquier intento de arrastre / rebote de Safari/Chrome
      if (mobileTab === 'home') {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.documentElement.classList.remove('mobile-screen-locked');
      document.body.classList.remove('mobile-screen-locked');
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [mobileTab]);

  const tasaBcv = Number(config?.tasaDolar || 827.73);

  // Cantidad de clientes en mora para badge en bottom dock
  const clientsInMoraCount = clients.filter(c => {
    const s = Number(c.saldoUsd || c.saldo_usd || 0);
    const m = Number(c.diasMora || c.dias_mora || 0);
    return s > 0.01 && m > 0;
  }).length;

  const isMainTab = ['home', 'pedidos', 'cxc', 'inventario', 'menu'].includes(mobileTab);

  const handleNavigateSubmodule = (modId) => {
    if (modId === 'config') {
      setShowConfigModal(true);
      return;
    }
    setMobileTab(modId);
  };

  return (
    <div className="mobile-app-root">
      
      {/* 1. HEADER MÓVIL FIJO (Compatible con Notch y Dynamic Island) */}
      <header className="mobile-header-bar">
        <div className="mobile-header-left">
          <img src={motorvenLogo} alt="MOTORVEN" className="mobile-header-logo" />
        </div>

        <div className="mobile-rate-pill" title="Tasa Oficial BCV en vivo">
          <span>BCV:</span>
          <span>Bs. {tasaBcv.toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="mobile-btn-switch-pc"
            onClick={onSwitchToDesktop}
            title="Cambiar a versión de pantalla completa para computadora"
          >
            <Monitor size={12} />
            <span>PC</span>
          </button>
        </div>
      </header>

      {/* 2. CONTENIDO PRINCIPAL: Cero-Scroll en Inicio, Scroll en Listas */}
      {mobileTab === 'home' ? (
        <MobileHomeView
          currentUser={currentUser}
          config={config}
          products={products}
          clients={clients}
          orders={orders}
          sales={sales}
          profitInvoices={profitInvoices}
          profitBankAccounts={profitBankAccounts}
          profitPurchases={profitPurchases}
          profitSellers={profitSellers}
          onNavigateTab={handleNavigateSubmodule}
        />
      ) : (
        <main className="mobile-scroll-view">
          
          {/* Barra de regreso cuando se navega a un módulo secundario */}
          {!isMainTab && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <button
                type="button"
                onClick={() => setMobileTab('home')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={14} /> Volver al Inicio
              </button>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                Módulo: {mobileTab}
              </span>
            </div>
          )}

          {/* 2.1 PEDIDOS / PREVENTA MÓVIL */}
          {mobileTab === 'pedidos' && (
            <SellerOrderPOSView
              products={products}
              clients={clients}
              orders={orders}
              profitInvoices={profitInvoices}
              sales={sales}
              profitSellers={profitSellers}
              config={config}
              profitZones={profitZones}
              currentUser={currentUser}
              onSaveOrder={onSaveOrder}
              onProceedToPOS={onProceedToPOS}
              onProcessSale={onProcessSale}
              onSyncProfit={onSyncProfit}
            />
          )}

          {/* 2.2 COBRANZAS (CXC) */}
          {mobileTab === 'cxc' && (
            <MobileCxCView
              clients={clients}
              sales={sales}
              profitInvoices={profitInvoices}
              config={config}
            />
          )}

          {/* 2.3 STOCK & INVENTARIO */}
          {mobileTab === 'inventario' && (
            <MobileInventoryView
              products={products}
              config={config}
              onSelectProductForOrder={() => setMobileTab('pedidos')}
            />
          )}

          {/* 2.4 MENÚ PRINCIPAL */}
          {mobileTab === 'menu' && (
            <MobileMenuView
              currentUser={currentUser}
              theme={theme}
              onToggleTheme={onToggleTheme}
              onSwitchToDesktop={onSwitchToDesktop}
              onNavigateTab={handleNavigateSubmodule}
              onSyncProfit={onSyncProfit}
              onLogout={onLogout}
            />
          )}

          {/* Módulos secundarios cuando se seleccionan desde el menú */}
          {mobileTab === 'ventas' && (
            <SalesPOSView
              products={products}
              clients={clients}
              orders={orders}
              sales={sales}
              profitSellers={profitSellers}
              config={config}
              profitReturns={profitReturns}
              profitInvoices={profitInvoices}
              profitCollections={profitCollections}
              onSyncProfit={onSyncProfit}
              onProcessSale={onProcessSale}
              onOpenOrdersSalesModal={onOpenOrdersSalesModal}
              currentUser={currentUser}
            />
          )}

          {(mobileTab === 'flujo_caja' || mobileTab === 'cxp') && (
            <CashflowView
              key={mobileTab}
              products={products}
              cashMovements={cashMovements}
              clients={clients}
              suppliers={suppliers}
              sales={sales}
              profitBankAccounts={profitBankAccounts}
              profitCashDesks={profitCashDesks}
              profitAccountsPayable={profitAccountsPayable}
              profitCollections={profitCollections}
              profitInvoices={profitInvoices}
              profitSellers={profitSellers}
              onSyncProfit={onSyncProfit}
              config={config}
              onAddCashMovement={onAddCashMovement}
              onSaveClient={onSaveClient}
              currentUser={currentUser}
              initialTab={mobileTab === 'cxp' ? 'CXP' : 'SPLIT'}
            />
          )}

          {mobileTab === 'compras' && (
            <PurchasesView
              products={products}
              suppliers={suppliers}
              purchases={purchases}
              config={config}
              onSaveProduct={onSaveProduct}
              onRegisterPurchase={onRegisterPurchase}
              currentUser={currentUser}
              profitSuppliers={profitSuppliers}
              profitPurchases={profitPurchases}
              profitAccountsPayable={profitAccountsPayable}
              profitSupplierPayments={profitSupplierPayments}
              profitIslrConcepts={profitIslrConcepts}
              profitBeneficiaries={profitBeneficiaries}
              profitPaymentOrders={profitPaymentOrders}
              profitIslrWithholdings={profitIslrWithholdings}
              profitInvoices={profitInvoices}
              sales={sales}
              onSyncProfit={onSyncProfit}
            />
          )}

          {mobileTab === 'seniat' && (
            <TaxReportsView
              sales={sales}
              purchases={purchases}
              suppliers={suppliers}
              fiscalClosures={fiscalClosures}
              onExecuteCierreZ={onExecuteCierreZ}
              profitInvoices={profitInvoices}
              profitIslrConcepts={profitIslrConcepts}
              profitBeneficiaries={profitBeneficiaries}
              profitPaymentOrders={profitPaymentOrders}
              profitIslrWithholdings={profitIslrWithholdings}
              profitAccountsPayable={profitAccountsPayable}
              profitPurchases={profitPurchases}
              config={config}
              currentUser={currentUser}
              onSyncProfit={onSyncProfit}
            />
          )}

          {mobileTab === 'usuarios' && (
            <UsersManagementView
              currentUser={currentUser}
              usersList={usersList}
              onUsersUpdated={onUsersUpdated}
              onUpdateCurrentUser={onUpdateCurrentUser}
              config={config}
            />
          )}

          {mobileTab === 'vendedores' && (
            <SellersView
              profitSellers={profitSellers}
              profitInvoices={profitInvoices}
              profitCollections={profitCollections}
              profitBankAccounts={profitBankAccounts}
              clients={clients}
              orders={orders}
              config={config}
              onSyncProfit={onSyncProfit}
              onUpdateSellerTarget={async () => {}}
              onUpdateSellerPhoto={async () => {}}
              onUpdateSellerZone={async () => {}}
              onUpdateGlobalTarget={async () => {}}
            />
          )}

          {mobileTab === 'rentabilidad' && (
            <ProfitabilityView
              products={products}
              profitInvoices={profitInvoices}
              profitPurchases={profitPurchases}
              profitSellers={profitSellers}
              profitZones={profitZones}
              config={config}
            />
          )}

        </main>
      )}

      {/* 3. BARRA INFERIOR DE NAVEGACIÓN FIJA (BOTTOM DOCK) */}
      <nav className="mobile-bottom-dock">
        <button
          type="button"
          className={`mobile-dock-btn ${mobileTab === 'home' ? 'active' : ''}`}
          onClick={() => setMobileTab('home')}
        >
          <Home size={19} />
          <span>Inicio</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${mobileTab === 'pedidos' ? 'active' : ''}`}
          onClick={() => setMobileTab('pedidos')}
        >
          <ShoppingCart size={19} />
          <span>Pedidos</span>
          {orders.length > 0 && (
            <span className="mobile-dock-badge">{orders.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${mobileTab === 'cxc' ? 'active' : ''}`}
          onClick={() => setMobileTab('cxc')}
        >
          <DollarSign size={19} />
          <span>Cobranzas</span>
          {clientsInMoraCount > 0 && (
            <span className="mobile-dock-badge" style={{ background: '#f59e0b' }}>{clientsInMoraCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${mobileTab === 'inventario' ? 'active' : ''}`}
          onClick={() => setMobileTab('inventario')}
        >
          <Package size={19} />
          <span>Stock</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${!['home', 'pedidos', 'cxc', 'inventario'].includes(mobileTab) ? 'active' : ''}`}
          onClick={() => setMobileTab('menu')}
        >
          <Menu size={19} />
          <span>Menú</span>
        </button>
      </nav>

      {/* Modal de Configuración si se abre desde el menú */}
      {showConfigModal && (
        <AppConfigModal
          isOpen={showConfigModal}
          config={config}
          onSaveConfig={onSaveConfig}
          currentUser={currentUser}
          products={products}
          clients={clients}
          onClose={() => setShowConfigModal(false)}
        />
      )}

    </div>
  );
}
