import React, { useState } from 'react';
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
import AppConfigModal from '../AppConfigModal';
import { formatBs } from '../../services/formatService';

export default function MobileAppLayout({
  products = [],
  clients = [],
  orders = [],
  sales = [],
  profitInvoices = [],
  profitCollections = [],
  profitBankAccounts = [],
  profitAccountsPayable = [],
  profitSupplierPayments = [],
  profitPurchases = [],
  profitSellers = [],
  profitZones = [],
  config = {},
  currentUser,
  theme,
  onToggleTheme,
  onSwitchToDesktop,
  onSaveOrder,
  onProceedToPOS,
  onSyncProfit,
  onLogout
}) {
  const [mobileTab, setMobileTab] = useState('home'); // 'home' | 'pedidos' | 'cxc' | 'inventario' | 'menu' | <module_id>
  const [showConfigModal, setShowConfigModal] = useState(false);

  const tasaBcv = Number(config?.tasaDolar || 827.73);

  // Cantidad de clientes en mora para badge en bottom bar
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
      
      {/* HEADER MÓVIL FIJO (Compatible con Notch y Dynamic Island) */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <img src={motorvenLogo} alt="MOTORVEN" className="mobile-brand-img" />
        </div>

        <div className="mobile-header-rates">
          <div className="mobile-bcv-pill" title="Tasa Oficial BCV en vivo">
            <span>BCV:</span>
            <span>Bs. {tasaBcv.toFixed(2)}</span>
          </div>
        </div>

        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-desktop-switch-btn"
            onClick={onSwitchToDesktop}
            title="Cambiar a versión de pantalla completa para computadora"
          >
            <Monitor size={12} />
            <span>PC</span>
          </button>
        </div>
      </header>

      {/* ÁREA DE CONTENIDO */}
      <main className="mobile-content-container">
        
        {/* Barra de regreso cuando se navega a un módulo secundario */}
        {!isMainTab && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <button
              type="button"
              onClick={() => setMobileTab('menu')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                borderRadius: '10px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={14} /> Volver al Menú
            </button>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
              Módulo: {mobileTab}
            </span>
          </div>
        )}

        {/* 1. INICIO */}
        {mobileTab === 'home' && (
          <MobileHomeView
            currentUser={currentUser}
            config={config}
            products={products}
            clients={clients}
            orders={orders}
            sales={sales}
            profitInvoices={profitInvoices}
            onNavigateTab={setMobileTab}
          />
        )}

        {/* 2. PEDIDOS / PREVENTA MÓVIL */}
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
            onSyncProfit={onSyncProfit}
          />
        )}

        {/* 3. COBRANZAS (CXC) */}
        {mobileTab === 'cxc' && (
          <MobileCxCView
            clients={clients}
            sales={sales}
            profitInvoices={profitInvoices}
            config={config}
          />
        )}

        {/* 4. STOCK & INVENTARIO */}
        {mobileTab === 'inventario' && (
          <MobileInventoryView
            products={products}
            config={config}
            onSelectProductForOrder={() => setMobileTab('pedidos')}
          />
        )}

        {/* 5. MENÚ PRINCIPAL */}
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
            sales={sales}
            profitInvoices={profitInvoices}
            config={config}
            currentUser={currentUser}
            onSyncProfit={onSyncProfit}
          />
        )}

        {mobileTab === 'flujo_caja' && (
          <CashflowView
            bankAccounts={profitBankAccounts}
            config={config}
            currentUser={currentUser}
            clients={clients}
          />
        )}

        {mobileTab === 'compras' && (
          <PurchasesView
            purchases={profitPurchases}
            config={config}
            currentUser={currentUser}
          />
        )}

        {mobileTab === 'seniat' && (
          <TaxReportsView
            sales={sales}
            profitInvoices={profitInvoices}
            purchases={profitPurchases}
            config={config}
            currentUser={currentUser}
          />
        )}

        {mobileTab === 'usuarios' && (
          <UsersManagementView
            currentUser={currentUser}
            config={config}
          />
        )}

      </main>

      {/* BARRA INFERIOR DE NAVEGACIÓN TÁCTIL (BOTTOM BAR) */}
      <nav className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-tab ${mobileTab === 'home' ? 'active' : ''}`}
          onClick={() => setMobileTab('home')}
        >
          <Home size={20} />
          <span>Inicio</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${mobileTab === 'pedidos' ? 'active' : ''}`}
          onClick={() => setMobileTab('pedidos')}
        >
          <ShoppingCart size={20} />
          <span>Pedidos</span>
          {orders.length > 0 && (
            <span className="mobile-nav-badge">{orders.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${mobileTab === 'cxc' ? 'active' : ''}`}
          onClick={() => setMobileTab('cxc')}
        >
          <DollarSign size={20} />
          <span>Cobranzas</span>
          {clientsInMoraCount > 0 && (
            <span className="mobile-nav-badge" style={{ background: '#f59e0b' }}>{clientsInMoraCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${mobileTab === 'inventario' ? 'active' : ''}`}
          onClick={() => setMobileTab('inventario')}
        >
          <Package size={20} />
          <span>Stock</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${!['home', 'pedidos', 'cxc', 'inventario'].includes(mobileTab) ? 'active' : ''}`}
          onClick={() => setMobileTab('menu')}
        >
          <Menu size={20} />
          <span>Menú</span>
        </button>
      </nav>

      {/* Modal de Configuración si se abre desde el menú */}
      {showConfigModal && (
        <AppConfigModal
          config={config}
          onClose={() => setShowConfigModal(false)}
        />
      )}

    </div>
  );
}
