import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  inferTreasuryAccountKind,
  matchesCashDesk,
  matchesBankAccount,
  applyTreasuryBalanceDelta,
  resolveTreasuryTargetForPaymentMethod,
  resolveTreasuryAccountForMovement,
  computeMovementReversalDelta,
  computeMovementEditAccountAdjustments,
  dedupeCashMovements,
  upsertCashMovementInList,
  removeCashMovementFromList,
  resolveExchangeRates,
  loadPartnerPayableAccounts,
  upsertPartnerPayableAccountInList,
  removePartnerPayableAccountFromList,
  applyPartnerPayableBalanceDeltaInList
} from './utils/treasuryAccountUtils';
import { removePartnerLiabilityMovementByCashId } from './utils/liabilityAccountUtils';
import { normalizeRateType, isDirectCurrencyRateType } from './utils/rateClassificationUtils';
import { resolveInvoiceLitros, resolveInvoiceCajas, matchesSeller } from './services/commissionService';
import { ShieldAlert, Smartphone } from 'lucide-react';
import Navigation from './components/Navigation';
import HeaderBar from './components/HeaderBar';
import MobileAppLayout from './components/mobile/MobileAppLayout';

import DashboardView from './views/DashboardView';
import InventoryView from './views/InventoryView';
import SalesPOSView from './views/SalesPOSView';
import PurchasesView from './views/PurchasesView';
import SellersView from './views/SellersView';
import ProfitabilityView from './views/ProfitabilityView';
import CashflowView from './views/CashflowView';
import TaxReportsView from './views/TaxReportsView';
import AuditLedgerView from './views/AuditLedgerView';
import UsersManagementView from './views/UsersManagementView';
import SupabaseTablesView from './views/SupabaseTablesView';
import ProfitCxcStandaloneView from './views/ProfitCxcStandaloneView';
import DeviceSimulatorView from './views/DeviceSimulatorView';
import SellerOrderPOSView from './views/SellerOrderPOSView';
import PasivosView from './views/PasivosView';
import LoginView from './views/LoginView';
import OrdersSalesModal from './components/OrdersSalesModal';
import AppConfigModal from './components/AppConfigModal';
import CashBankModal from './components/CashBankModal';
import AccountsReceivableModal from './components/AccountsReceivableModal';
import AccountsPayableModal from './components/AccountsPayableModal';
import DebtCollectionIntelligenceModal from './components/DebtCollectionIntelligenceModal';
import NotificationsCenterModal from './components/NotificationsCenterModal';
import ModuleErrorBoundary from './components/ModuleErrorBoundary';
import signumLogoImg from './assets/logo_signum_transpatente.png';
import { useNotification } from './context/NotificationContext';
import { evaluateClientCreditPortfolioSummary } from './services/creditPolicyService';
import {
  INITIAL_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_FISCAL_CLOSURES,
  DEFAULT_PROFIT_SELLERS,
  INITIAL_ORDERS
} from './data/mockData';
import {
  REAL_CONFIG,
  REAL_PRODUCTS,
  REAL_CLIENTS,
  REAL_ORDERS,
  REAL_PROFIT_SELLERS,
  REAL_PROFIT_INVOICES,
  REAL_PROFIT_COLLECTIONS,
  REAL_PROFIT_ACCOUNTS_PAYABLE,
  REAL_PROFIT_SUPPLIER_PAYMENTS,
  REAL_PROFIT_PURCHASES,
  REAL_PROFIT_SUPPLIERS,
  REAL_PROFIT_BANK_ACCOUNTS,
  REAL_PROFIT_CASH_DESKS,
  REAL_PROFIT_ZONES,
  REAL_PROFIT_TRANSPORTS,
  REAL_PROFIT_CUSTOMER_RETURNS,
  REAL_PROFIT_INVENTORY_ADJUSTMENTS,
  REAL_PROFIT_WAREHOUSE_TRANSFERS,
  REAL_PROFIT_ISLR_CONCEPTS,
  REAL_PROFIT_BENEFICIARIES,
  REAL_PROFIT_PAYMENT_ORDERS,
  REAL_PROFIT_WAREHOUSES,
  REAL_PROFIT_PRODUCT_LINES,
  REAL_PROFIT_PRODUCT_CATEGORIES,
  REAL_PROFIT_PRODUCT_SUBLINES,
  REAL_PROFIT_CURRENCIES
} from './data/supabaseRealData';

import {
  seedDatabaseIfEmpty,
  ensureInventoryReconcileEpoch,
  getSupabaseConfig,
  updateSupabaseConfig,
  getSupabaseProducts,
  saveSupabaseProduct,
  deleteSupabaseProduct,
  getSupabaseClients,
  saveSupabaseClient,
  deleteSupabaseClient,
  getSupabaseSuppliers,
  getSupabaseSales,
  processSupabaseSale,
  recordFiscalAdjustmentSaleInSupabase,
  getSupabaseCashMovements,
  addSupabaseCashMovement,
  updateSupabaseCashMovement,
  deleteSupabaseCashMovement,
  getSupabasePurchases,
  saveSupabasePurchase,
  getSupabaseOrders,
  saveSupabaseOrder,
  updateSupabaseOrderStatus,
  getSupabaseProfitBankAccounts,
  updateSupabaseProfitBankAccount,
  deleteSupabaseProfitBankAccount,
  getSupabaseProfitCashDesks,
  updateSupabaseProfitCashDesk,
  deleteSupabaseProfitCashDesk,
  getSupabaseProfitCollections,
  saveSupabaseProfitCollection,
  deleteSupabaseProfitCollection,
  getSupabaseProfitInvoices,
  saveSupabaseProfitInvoice,
  updateSupabaseInvoiceDocument,
  getSupabaseProfitSuppliers,
  getSupabaseProfitPurchases,
  getSupabaseProfitAccountsPayable,
  saveSupabaseProfitAccountsPayable,
  deleteSupabaseProfitAccountsPayable,
  getSupabaseProfitSupplierPayments,
  saveSupabaseProfitSupplierPayment,
  getSupabaseProfitSellers,
  updateSupabaseSellerPhoto,
  updateSupabaseSellerTarget,
  updateSupabaseSellerZone,
  updateSupabaseGlobalSellersTarget,
  getSupabaseProfitZones,
  saveSupabaseProfitZone,
  deleteSupabaseProfitZone,
  getSupabaseProfitTransports,
  getSupabaseProfitReturns,
  getSupabaseProfitInventoryAdjustments,
  getSupabaseProfitWarehouseTransfers,
  getSupabaseProfitIslrConcepts,
  getSupabaseProfitBeneficiaries,
  getSupabaseProfitPaymentOrders,
  getSupabaseProfitIslrWithholdings,
  getSupabaseProfitAuditTrails,
  getSupabaseProfitWarehouses,
  getSupabaseProfitProductLines,
  getSupabaseProfitProductCategories,
  getSupabaseProfitProductSublines,
  getSupabaseProfitCurrencies,
  fetchBcvRate,
  getSupabaseFiscalClosures,
  saveSupabaseFiscalClosure,
  getSupabaseUsers,
  saveSupabaseUser,
  deleteSupabaseOrder,
  deleteSupabaseSale,
  checkAndExpireOverdueOrders,
  getSupabasePurchaseRequisitions,
  saveSupabasePurchaseRequisition,
  getSupabasePurchaseOrders,
  saveSupabasePurchaseOrder,
  getSupabaseGoodsReceiptNotesMerged,
  saveSupabaseGoodsReceiptNote,
  getSupabaseProfitPaymentOrdersMerged,
  saveSupabaseProfitPaymentOrder,
  saveSupabaseProfitPurchase,
  saveSupabaseProfitWarehouseTransfer,
  saveSupabaseProfitInventoryAdjustment,
  saveSupabaseProfitCustomerReturn,
  getSupabaseProfitReturnsMerged,
  getSupabaseProfitInventoryAdjustmentsMerged,
  getSupabaseProfitWarehouseTransfersMerged,
  saveSupabaseNotification,
  logUserActivity,
  getSupabaseProfitIncomeExpenseAccounts,
  getSupabaseCommissionSettlements,
  getSupabaseExpenses,
  saveSupabaseExpense,
  deleteSupabaseExpense,
  getSupabaseEmployees,
  saveSupabaseEmployee,
  deleteSupabaseEmployee,
  getSupabasePayroll,
  saveSupabasePayroll,
  deleteSupabasePayroll,
  isCxcEntryDeleted,
  sanitizeCxcDeletedDocsStorage
} from './services/supabaseService';

// Excluye facturas/NE/ventas marcadas como eliminadas (tombstones CxC) para que nunca
// reaparezcan por respuestas de red tardías, respaldos estáticos o recargas en curso.
const filterOutDeletedCxcDocs = (list) => {
  if (!Array.isArray(list) || list.length === 0) return Array.isArray(list) ? list : [];
  try {
    const delSet = new Set(sanitizeCxcDeletedDocsStorage());
    if (delSet.size === 0) return list;
    return list.filter(doc => !doc || !isCxcEntryDeleted(doc, delSet));
  } catch (_) {
    return list;
  }
};
import soundFX from './services/soundService';
import {
  initOfflineSyncListeners,
  flushSyncQueue,
  getPendingSyncCount
} from './services/offlineSyncService';
import { formatBs, formatNumberUs } from './services/formatService';
import { deleteStorageOrder, deleteStorageSale } from './services/storageService';
import {
  getActiveUser,
  getUsersList,
  logout as authLogout,
  canAccessModule,
  canApproveClients,
  getClientApprovalStatus,
  ROLE_PERMISSIONS,
  DEFAULT_TABS_BY_ROLE,
  normalizeRole,
  DEFAULT_USERS,
  sortUsersByHierarchy
} from './services/authService';
import { subscribeToRealtimeChanges } from './services/profitService';
import {
  dedupePayablesList,
  dedupeSupplierPaymentsList,
  doesPayableMatchDocument,
  doProvidersMatch
} from './utils/cxpUtils';
import {
  inferCxcDocType,
  isCreditOrDebitNoteDoc,
  normalizeCollectionWriteAmounts,
  reconcileClientsWithRealCxc,
  buildCxcCreditDebitNoteResult
} from './utils/cxcUtils';
import { subscribeToRealtimeSync, broadcastReconcileChange, getRealtimeClientId } from './services/realtimeSyncBridge';
import {
  getEraScopedCanonicalDocKey,
  formatDocumentControlNumber,
  commitInvoiceCorrelativo,
  commitNotaEntregaCorrelativo
} from './services/fiscalService';


function MainApp() {
  const [currentUser, setCurrentUser] = useState(() => {
    return getActiveUser() || null;
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam) return tabParam;
      if (window.location.hash) {
        const h = window.location.hash.replace('#', '');
        if (h && h !== 'supabase-tables' && h !== 'device-simulator') return h;
      }
    }
    return 'dashboard';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== 'undefined' && window.location.hash) {
        const h = window.location.hash.replace('#', '');
        if (h && h !== 'supabase-tables' && h !== 'device-simulator') {
          setActiveTab(h);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Restablecer scroll al inicio al cambiar de módulo para evitar vistas sobremontadas o cortadas
  useEffect(() => {
    const mainEl = document.querySelector('.content-body');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [activeTab]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('signum_sidebar_collapsed') === 'true';
  });
  const [partnerPayableAccounts, setPartnerPayableAccountsState] = useState(() => {
    return loadPartnerPayableAccounts();
  });
  // Cargar modo inicial (por defecto claro, o el persistido por el usuario)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('signum_theme') || 'light';
  });

  // Detección y Persistencia de Modo Móvil (Smartphones & iPhone) vs Escritorio (PC)
  const [deviceViewMode, setDeviceViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem('signum_device_view_mode');
      if (saved === 'desktop' || saved === 'mobile') return saved;
      if (typeof window !== 'undefined') {
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
        const isSmallScreen = window.innerWidth <= 768;
        if (isMobileUA || isSmallScreen) return 'mobile';
      }
    } catch (_) {}
    return 'desktop';
  });

  const handleSwitchToDesktop = () => {
    setDeviceViewMode('desktop');
    try {
      localStorage.setItem('signum_device_view_mode', 'desktop');
    } catch (_) {}
    if (notify?.info) notify.info('Cambiado a vista completa de computadora (PC)');
  };

  const handleSwitchToMobile = () => {
    setDeviceViewMode('mobile');
    try {
      localStorage.setItem('signum_device_view_mode', 'mobile');
    } catch (_) {}
    if (notify?.info) notify.info('Cambiado a versión optimizada para celulares');
  };
  const [config, setConfigState] = useState(() => {
    try {
      const cached = localStorage.getItem('signum_app_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Number(parsed.tasaDolar) > 500) return parsed;
      }
    } catch (_) {}
    return REAL_CONFIG;
  });

  const notify = useNotification();

  useEffect(() => {
    if (config) {
      window.dispatchEvent(new CustomEvent('signum_config_updated', { detail: config }));
    }
  }, [config]);
  const [products, setProductsState] = useState(() => {
    ensureInventoryReconcileEpoch();
    const sortAsc = (arr) =>
      Array.isArray(arr)
        ? [...arr].sort((a, b) =>
            String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
          )
        : [];
    try {
      const cached = localStorage.getItem('sm_products_v4_fiscal');
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasStaleOil = Array.isArray(parsed) && parsed.some(p => String(p?.id || p?.codigo || '').startsWith('OIL-'));
        const p000003 = Array.isArray(parsed) && parsed.find(p => String(p?.codigo || p?.id || '').trim() === '000003');
        const p001201 = Array.isArray(parsed) && parsed.find(p => String(p?.codigo || p?.id || '').trim() === '001201');
        const hasCorruptedDoubledDump =
          Number(p000003?.stock ?? p000003?.stockAlmacen02 ?? 0) === 730 &&
          Number(p001201?.stockAlmacen01 ?? 0) === 152 &&
          Number(p001201?.stockAlmacen02 ?? 0) === 152;
        if (
          Array.isArray(parsed) &&
          parsed.length >= 25 &&
          !hasStaleOil &&
          !hasCorruptedDoubledDump
        ) {
          return sortAsc(parsed);
        }
      }
    } catch (_) {}
    return sortAsc(REAL_PRODUCTS);
  });
  const [clients, setClientsState] = useState(() => {
    try {
      const cached = localStorage.getItem('sm_clients_v4_fiscal');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 600) return parsed;
      }
    } catch (_) {}
    return REAL_CLIENTS;
  });
  const [orders, setOrdersState] = useState(() => {
    try {
      const cached = localStorage.getItem('sm_orders_v4_pipeline');
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasBadItems =
          Array.isArray(parsed) &&
          parsed.some(o =>
            !Array.isArray(o?.items) ||
            o.items.length === 0 ||
            o.items.some(it => String(it?.articuloId || it?.productoId || it?.codigo || '').startsWith('OIL-'))
          );
        const cleanList = Array.isArray(parsed)
          ? parsed.filter(o => {
              if (!o || !o.id) return false;
              const idUpper = String(o.id).toUpperCase();
              const docUpper = String(o.numeroDoc || o.numero_doc || '').toUpperCase();
              if (idUpper.includes('TEST') || docUpper.includes('TEST')) return false;
              if (!Array.isArray(o.items) || o.items.length === 0) return false;
              return true;
            })
          : [];
        if (cleanList.length >= 1 && !hasBadItems) return cleanList;
      }
    } catch (_) {}
    return REAL_ORDERS || [];
  });
  const [profitBankAccounts, setProfitBankAccounts] = useState(() => REAL_PROFIT_BANK_ACCOUNTS || []);
  const [profitCashDesks, setProfitCashDesks] = useState(() => REAL_PROFIT_CASH_DESKS || []);
  const profitBankAccountsRef = useRef(profitBankAccounts);
  const profitCashDesksRef = useRef(profitCashDesks);
  useEffect(() => {
    profitBankAccountsRef.current = profitBankAccounts;
  }, [profitBankAccounts]);
  useEffect(() => {
    profitCashDesksRef.current = profitCashDesks;
  }, [profitCashDesks]);
  const [profitCollections, setProfitCollections] = useState(() => REAL_PROFIT_COLLECTIONS || []);
  const [profitInvoices, setProfitInvoices] = useState(() => filterOutDeletedCxcDocs(REAL_PROFIT_INVOICES || []));
  const [profitSuppliers, setProfitSuppliers] = useState(() => REAL_PROFIT_SUPPLIERS || []);
  const [profitPurchases, setProfitPurchases] = useState(() => REAL_PROFIT_PURCHASES || []);
  const [profitAccountsPayable, setProfitAccountsPayable] = useState(() => REAL_PROFIT_ACCOUNTS_PAYABLE || []);
  const [profitSupplierPayments, setProfitSupplierPayments] = useState(() => REAL_PROFIT_SUPPLIER_PAYMENTS || []);
  const [profitSellers, setProfitSellers] = useState(() => REAL_PROFIT_SELLERS || DEFAULT_PROFIT_SELLERS || []);
  const [profitZones, setProfitZones] = useState(() => REAL_PROFIT_ZONES || []);
  const [profitTransports, setProfitTransports] = useState(() => REAL_PROFIT_TRANSPORTS || []);
  const [profitReturns, setProfitReturns] = useState(() => REAL_PROFIT_CUSTOMER_RETURNS || []);
  const [profitInventoryAdjustments, setProfitInventoryAdjustments] = useState(() => REAL_PROFIT_INVENTORY_ADJUSTMENTS || []);
  const [profitWarehouseTransfers, setProfitWarehouseTransfers] = useState(() => REAL_PROFIT_WAREHOUSE_TRANSFERS || []);
  const [profitIslrConcepts, setProfitIslrConcepts] = useState(() => REAL_PROFIT_ISLR_CONCEPTS || []);
  const [profitBeneficiaries, setProfitBeneficiaries] = useState(() => REAL_PROFIT_BENEFICIARIES || []);
  const [profitPaymentOrders, setProfitPaymentOrders] = useState(() => REAL_PROFIT_PAYMENT_ORDERS || []);
  const [profitIslrWithholdings, setProfitIslrWithholdings] = useState([]);
  const [profitAuditTrails, setProfitAuditTrails] = useState([]);
  const [profitWarehouses, setProfitWarehouses] = useState(() => REAL_PROFIT_WAREHOUSES || []);
  const [profitProductLines, setProfitProductLines] = useState(() => REAL_PROFIT_PRODUCT_LINES || []);
  const [profitProductCategories, setProfitProductCategories] = useState(() => REAL_PROFIT_PRODUCT_CATEGORIES || []);
  const [profitProductSublines, setProfitProductSublines] = useState(() => REAL_PROFIT_PRODUCT_SUBLINES || []);
  const [profitCurrencies, setProfitCurrencies] = useState(() => REAL_PROFIT_CURRENCIES || []);
  const [profitIncomeExpenseAccounts, setProfitIncomeExpenseAccounts] = useState([]);
  const [commissionSettlements, setCommissionSettlements] = useState([]);
  const [expenses, setExpensesState] = useState([]);
  const [payroll, setPayrollState] = useState([]);
  const [employees, setEmployeesState] = useState([]);
  const [pendingOrderToBill, setPendingOrderToBill] = useState(null);
  const [preselectedClient, setPreselectedClient] = useState(null);
  const [ordersSalesModalTab, setOrdersSalesModalTab] = useState('nuevo');
  const [ordersSalesModalOrder, setOrdersSalesModalOrder] = useState(null);
  const [showDebtCollectionModal, setShowDebtCollectionModal] = useState(false);
  const [suppliers, setSuppliersState] = useState(() => []);
  const [sales, setSalesState] = useState(() => []);
  const [purchases, setPurchasesState] = useState(() => []);
  const [purchaseRequisitions, setPurchaseRequisitions] = useState(() => []);
  const [purchaseOrders, setPurchaseOrders] = useState(() => []);
  const [goodsReceiptNotes, setGoodsReceiptNotes] = useState(() => []);
  const [cashMovements, setCashMovementsState] = useState(() => []);
  const [fiscalClosures, setFiscalClosures] = useState(() => []);
  const [usersList, setUsersList] = useState(() => getUsersList());
  const [globalSearch, setGlobalSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Directorio oficial de clientes sincronizado en tiempo real con CxC abierta (profitInvoices + sales)
  const syncedClients = useMemo(
    () =>
      reconcileClientsWithRealCxc({
        clients,
        profitInvoices,
        sales,
        tasaBcv: resolveExchangeRates(config).tasaBcv
      }).clients,
    [clients, profitInvoices, sales, config?.tasaDolar]
  );

  const handleOpenOrdersSalesModal = (tab = 'nuevo', order = null) => {
    setOrdersSalesModalTab(tab);
    setOrdersSalesModalOrder(order);
    setActiveTab('pedidos');
  };

  const handleSelectClientForModule = (client, targetTab = 'ventas') => {
    if (client) setPreselectedClient(client);
    setActiveTab(targetTab);
  };

  // Asegurar siempre modo claro en el elemento <html> y localStorage al cargar
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('signum_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('signum_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Atajo de teclado universal Ctrl+B / Cmd+B para expandir/contraer el menú lateral
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cargar datos iniciales desde Supabase y sincronizar Tasa BCV
  useEffect(() => {
    let isMounted = true;
    const cleanupOfflineListeners = initOfflineSyncListeners();

    // Limpiar explícitamente cualquier dato de prueba o caché obsoleto para asegurar lectura viva de Supabase
    try {
      localStorage.removeItem('signum_profit_dashboard_kpis');
    } catch (_) {}

    let isRefreshingApp = false;
    let isPreReadFlush = false;
    let pendingRefresh = false;

    const initApp = async () => {
      if (isRefreshingApp) {
        pendingRefresh = true;
        return;
      }
      isRefreshingApp = true;
      try {
        // CRÍTICO: Si hay operaciones pendientes en la cola local o en signum_cxc_custom_docs_v1,
        // empujarlas al servidor central ANTES de leer las tablas para nunca sobrescribir cambios locales con datos viejos.
        isPreReadFlush = true;
        try {
          await flushSyncQueue();
        } catch (syncErr) {
          console.warn('[InitApp] Cola pendiente se reintentará al reconectar servidor:', syncErr);
        } finally {
          isPreReadFlush = false;
        }

        // Ola 1 (prioritaria): datos operativos críticos antes de saturar el túnel con históricos extensos
        const [cfg, prods, clis, ords, facs, sls, usrs, pWarehouses] = await Promise.all([
          getSupabaseConfig(),
          getSupabaseProducts(),
          getSupabaseClients(),
          getSupabaseOrders(),
          getSupabaseProfitInvoices(),
          getSupabaseSales(),
          getSupabaseUsers(),
          getSupabaseProfitWarehouses()
        ]);

        if (isMounted) {
          let activeConfig = cfg;
          if (!cfg) {
            await seedDatabaseIfEmpty();
            activeConfig = await getSupabaseConfig();
          }
          setConfigState(activeConfig);
          setProductsState(prods || []);
          setClientsState(clis || []);
          setOrdersState(ords || []);
          setProfitInvoices(filterOutDeletedCxcDocs(facs || []));
          setSalesState(filterOutDeletedCxcDocs(sls || []));
          setProfitWarehouses(pWarehouses || []);
        }

        // Ola 2: módulos financieros, históricos y catálogos auxiliares
        const [
          bnks, cdesks, cobs, sups, cash, purs, closures,
          pSups, pPurs, pCxp, pPays, pSellers, pZones, pTrans, pReturns, pAdjustments, pTransfers,
          pIslr, pBen, pOrders, pWithholdings, pAuditTrails,
          pLines, pCategories, pSublines, pCurrs,
          pReqs, pPOs, pRecs,
          pIncExpAccounts, pSettlements, pExpenses, pEmployees, pPayroll
        ] = await Promise.all([
          getSupabaseProfitBankAccounts(),
          getSupabaseProfitCashDesks(),
          getSupabaseProfitCollections(),
          getSupabaseSuppliers(),
          getSupabaseCashMovements(),
          getSupabasePurchases(),
          getSupabaseFiscalClosures(),
          getSupabaseProfitSuppliers(),
          getSupabaseProfitPurchases(),
          getSupabaseProfitAccountsPayable(),
          getSupabaseProfitSupplierPayments(),
          getSupabaseProfitSellers(),
          getSupabaseProfitZones(),
          getSupabaseProfitTransports(),
          getSupabaseProfitReturnsMerged(),
          getSupabaseProfitInventoryAdjustmentsMerged(),
          getSupabaseProfitWarehouseTransfersMerged(),
          getSupabaseProfitIslrConcepts(),
          getSupabaseProfitBeneficiaries(),
          getSupabaseProfitPaymentOrdersMerged(),
          getSupabaseProfitIslrWithholdings(),
          getSupabaseProfitAuditTrails(),
          getSupabaseProfitProductLines(),
          getSupabaseProfitProductCategories(),
          getSupabaseProfitProductSublines(),
          getSupabaseProfitCurrencies(),
          getSupabasePurchaseRequisitions(),
          getSupabasePurchaseOrders(),
          getSupabaseGoodsReceiptNotesMerged(),
          getSupabaseProfitIncomeExpenseAccounts(),
          getSupabaseCommissionSettlements(),
          getSupabaseExpenses(),
          getSupabaseEmployees(),
          getSupabasePayroll()
        ]);
        
        if (isMounted) {
          const activeConfig = cfg || await getSupabaseConfig();
          if (cfg) setConfigState(activeConfig);
          // products / clients / orders / profitInvoices / sales ya se cargaron en la Ola 1.
          // No se re-asignan aquí con esa foto vieja: si durante la Ola 2 se eliminó o editó un
          // documento (o llegó un cambio en tiempo real), se resucitaría el estado anterior.
          setProfitBankAccounts(bnks || []);
          setProfitCashDesks(cdesks || []);
          setProfitCollections(cobs || []);
          setProfitSuppliers(pSups || []);
          setProfitPurchases(pPurs || []);
          setProfitAccountsPayable(pCxp || []);
          setProfitSupplierPayments(pPays || []);
          setProfitSellers(pSellers || []);
          setProfitZones(pZones || []);
          setProfitTransports(pTrans || []);
          setProfitReturns(pReturns || []);
          setProfitInventoryAdjustments(pAdjustments || []);
          setProfitWarehouseTransfers(pTransfers || []);
          setProfitIslrConcepts(pIslr || []);
          setProfitBeneficiaries(pBen || []);
          setProfitPaymentOrders(pOrders || []);
          setProfitIslrWithholdings(pWithholdings || []);
          setProfitAuditTrails(pAuditTrails || []);
          setProfitWarehouses(pWarehouses || []);
          setProfitProductLines(pLines || []);
          setProfitProductCategories(pCategories || []);
          setProfitProductSublines(pSublines || []);
          setProfitCurrencies(pCurrs || []);
          setProfitIncomeExpenseAccounts(pIncExpAccounts || []);
          setCommissionSettlements(pSettlements || []);
          setExpensesState(pExpenses || []);
          setEmployeesState(pEmployees || []);
          setPayrollState(pPayroll || []);
          setSuppliersState(sups || []);
          setPurchasesState(purs || []);
          setPurchaseRequisitions(pReqs || []);
          setPurchaseOrders(pPOs || []);
          setGoodsReceiptNotes(pRecs || []);
          setCashMovementsState(cash || []);
          setFiscalClosures(closures || []);
          if (usrs && usrs.length > 0) {
            const cleanUsrs = usrs.filter(u => u && u.username && u.username.toLowerCase() !== 'sysadmin' && u.id !== 'usr-sysadmin');
            const hasMasterAdmin = cleanUsrs.some(u => normalizeRole(u.rol) === 'ADMINISTRADOR MASTER' || u.username?.toLowerCase() === 'edson designer');
            let combinedUsers = cleanUsrs;
            if (!hasMasterAdmin) {
              const masterDefault = DEFAULT_USERS.find(u => u.username?.toLowerCase() === 'edson designer' || u.id === 'usr-muq3bdll');
              if (masterDefault) {
                combinedUsers = [masterDefault, ...cleanUsrs];
                saveSupabaseUser(masterDefault, { id: 'usr-muq3bdll', nombre: 'Edson Designer', rol: 'ADMINISTRADOR MASTER' }).catch(() => {});
              }
            }
            const sortedUsers = sortUsersByHierarchy(combinedUsers);
            setUsersList(sortedUsers);
            try {
              localStorage.setItem('signum_users_list', JSON.stringify(sortedUsers));
            } catch (_) {}
            const activeUser = getActiveUser();
            if (activeUser) {
              const matched = sortedUsers.find(
                (u) => u.id === activeUser.id || (u.username && activeUser.username && u.username.toLowerCase() === activeUser.username.toLowerCase())
              );
              if (matched) {
                setCurrentUser(matched);
                try {
                  localStorage.setItem('signum_active_user', JSON.stringify(matched));
                } catch (_) {}
              }
            } else {
              setCurrentUser(null);
            }
          }

          // Sincronizar tasa BCV de forma asíncrona en segundo plano (sin congelar el splash)
          fetchBcvRate().then(async (liveRate) => {
            if (liveRate && activeConfig?.tasaDolar && liveRate !== activeConfig.tasaDolar) {
              console.log(`[BCV Sync Inicial] Tasa actualizada a: Bs. ${liveRate}`);
              const updatedCfg = await updateSupabaseConfig({ tasaDolar: liveRate });
              if (isMounted) setConfigState(updatedCfg);
            }
          }).catch((bcvErr) => {
            console.warn('Verificación inicial BCV en segundo plano:', bcvErr);
          });

          // Finalizar splash de inmediato una vez cargada la información
          setLoading(false);
        }
      } catch (err) {
        console.error('Error cargando los datos iniciales de Supabase:', err);
        if (isMounted) {
          // En caso de incidencia de red, no bloquear la aplicación y permitir entrar
          setLoading(false);
        }
      } finally {
        isRefreshingApp = false;
        if (pendingRefresh && isMounted) {
          pendingRefresh = false;
          initApp();
        }
      }
    };

    initApp();

    const handleQueueFlushed = () => {
      if (!isMounted || isPreReadFlush) return;
      initApp();
    };
    window.addEventListener('signum_offline_queue_flushed', handleQueueFlushed);
    // El canal realtime detectó eventos perdidos (equipo desconectado o servidor reiniciado):
    // recargar los datos desde el servidor central para volver a quedar sincronizado.
    window.addEventListener('signum_realtime_resync_required', handleQueueFlushed);

    return () => {
      isMounted = false;
      window.removeEventListener('signum_offline_queue_flushed', handleQueueFlushed);
      window.removeEventListener('signum_realtime_resync_required', handleQueueFlushed);
      if (cleanupOfflineListeners) cleanupOfflineListeners();
    };
  }, []);

  // Suscripción en Tiempo Real: Reconciliaciones desde el Comparador (Modal o Nueva Pestaña)
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeSync(({ tableId, action, eventType, key, item, allTableData, clientId }) => {
      const isSelfEvent = clientId === getRealtimeClientId();
      const isDeleteAction = action === 'DELETE' || eventType === 'DELETE';
      console.log(`[App Realtime Sync] Recibida reconciliación en tabla '${tableId}' (Acción: ${action}, Clave: ${key})`);

      if (tableId === 'products') {
        if ((action === 'SYNC_CATALOG_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProductsState(allTableData);
          if (!isSelfEvent) {
            try {
              localStorage.setItem('sm_products_v4_fiscal', JSON.stringify(allTableData));
            } catch (_) {}
          }

          return;
        }

        if (action === 'DELETE') {
          setProductsState(prev => {
            const next = prev.filter(p => p.codigo !== key && p.id !== key);
            if (!isSelfEvent) {
              try { localStorage.setItem('sm_products_v4_fiscal', JSON.stringify(next)); } catch (_) {}
            }
            return next;
          });

          return;
        }

        if (item) {
          setProductsState(prev => {
            const index = prev.findIndex(p => p.codigo === key || p.id === key);
            let next;
            if (index >= 0) {
              next = [...prev];
              next[index] = { ...next[index], ...item };
            } else {
              next = [...prev, item];
            }
            if (!isSelfEvent) {
              try {
                localStorage.setItem('sm_products_v4_fiscal', JSON.stringify(next));
              } catch (_) {}
            }
            return next;
          });

        }
      } else if (tableId === 'clients') {
        if ((action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setClientsState(allTableData);
          return;
        }

        if (action === 'DELETE') {
          setClientsState(prev => {
            const next = prev.filter(c => c.rif !== key && c.codigo !== key && c.id !== key);
            if (!isSelfEvent) {
              try { localStorage.setItem('sm_clients_v4_fiscal', JSON.stringify(next)); } catch (_) {}
            }
            return next;
          });

          return;
        }

        if (item) {
          setClientsState(prev => {
            const index = prev.findIndex(c => c.rif === key || c.codigo === key || c.id === key);
            let next;
            if (index >= 0) {
              next = [...prev];
              next[index] = { ...next[index], ...item };
            } else {
              next = [...prev, item];
            }
            if (!isSelfEvent) {
              try {
                localStorage.setItem('sm_clients_v4_fiscal', JSON.stringify(next));
              } catch (_) {}
            }
            return next;
          });

        }
      } else if (tableId === 'warehouses') {
        const filterOnlyTwo = (list) =>
          (list || []).filter(w => {
            const code = String(w?.coAlm || w?.co_alm || w?.coAlma || w?.co_alma || w?.id || '').replace(/^ALM-/, '').trim();
            return code === '01' || code === '02';
          });
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitWarehouses(filterOnlyTwo(allTableData));
          return;
        }
        if (item) {
          const normKey = String(key || item.id || item.coAlm || '').replace(/^ALM-/, '').trim();
          if (normKey !== '01' && normKey !== '02') return;
          setProfitWarehouses(prev => {
            const index = prev.findIndex(w => String(w.coAlm || w.co_alm || w.coAlma || w.co_alma || w.id || '').replace(/^ALM-/, '') === normKey);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return filterOnlyTwo(next);
            }
            return filterOnlyTwo([...prev, item]);
          });

        }
      } else if (tableId === 'bank_accounts') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitBankAccounts(allTableData);
          return;
        }
        if (action === 'DELETE') {
          const delKey = String(key || item?.codCta || item?.cod_cta || item?.id || '').trim();
          if (delKey) {
            setProfitBankAccounts(prev => prev.filter(b =>
              String(b.codCta || b.cod_cta || b.id || '').trim() !== delKey &&
              String(b.id || '').trim() !== delKey
            ));
          }
          return;
        }
        if (item) {
          const resolvedCodCta = String(item.codCta || item.cod_cta || item.id || key || '').trim();
          const resolvedHolder = item.cuentaANombreDe ?? item.cuenta_a_nombre_de ?? item.titular;
          const resolvedSaldoBs = item.saldoBs ?? item.saldo_bs;
          const resolvedSaldoUsd = item.saldoUsd ?? item.saldo_usd;
          const normalizedItem = {
            ...item,
            ...(resolvedCodCta ? { codCta: resolvedCodCta, cod_cta: resolvedCodCta } : {}),
            ...(item.numCta !== undefined || item.num_cta !== undefined ? { numCta: item.numCta ?? item.num_cta, num_cta: item.numCta ?? item.num_cta } : {}),
            ...(item.bancoNombre !== undefined || item.banco_nombre !== undefined ? { bancoNombre: item.bancoNombre ?? item.banco_nombre, banco_nombre: item.bancoNombre ?? item.banco_nombre } : {}),
            ...(resolvedHolder !== undefined ? { titular: resolvedHolder, cuentaANombreDe: resolvedHolder, cuenta_a_nombre_de: resolvedHolder } : {}),
            ...(resolvedSaldoBs !== undefined ? { saldoBs: Number(resolvedSaldoBs || 0), saldo_bs: Number(resolvedSaldoBs || 0) } : {}),
            ...(resolvedSaldoUsd !== undefined ? { saldoUsd: Number(resolvedSaldoUsd || 0), saldo_usd: Number(resolvedSaldoUsd || 0) } : {})
          };
          setProfitBankAccounts(prev => {
            const index = prev.findIndex(b => b.codCta === resolvedCodCta || b.cod_cta === resolvedCodCta || b.id === resolvedCodCta || b.id === key);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...normalizedItem };
              return next;
            }
            return [...prev, normalizedItem];
          });
        }
      } else if (tableId === 'sellers') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitSellers(allTableData);
          return;
        }
        if (item) {
          const cleanKey = String(key || item.coVen || item.co_ven || '').trim().replace(/^usr-seller-/i, '').toLowerCase();
          setProfitSellers(prev => {
            const index = prev.findIndex(s => {
              const sCode = String(s.coVen || s.co_ven || s.id || '').trim().replace(/^usr-seller-/i, '').toLowerCase();
              return cleanKey && sCode === cleanKey;
            });
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item, coVen: next[index].coVen || item.coVen, co_ven: next[index].co_ven || item.co_ven };
              return next;
            }
            return [...prev, item];
          });

        }
      } else if (tableId === 'suppliers') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitSuppliers(allTableData);
          setSuppliersState(allTableData);
          return;
        }
        if (item) {
          setProfitSuppliers(prev => {
            const index = prev.findIndex(s => s.coProv === key || s.co_prov === key || s.id === key || s.rif === key);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [...prev, item];
          });
          setSuppliersState(prev => {
            const index = prev.findIndex(s => s.coProv === key || s.co_prov === key || s.id === key || s.rif === key);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [...prev, item];
          });

        }
      } else if (tableId === 'invoices') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitInvoices(filterOutDeletedCxcDocs(allTableData));
          return;
        }
        if (action === 'DELETE') {
          const targetTipo = inferCxcDocType(item || key);
          const targetCanon = item && typeof item === 'object'
            ? getEraScopedCanonicalDocKey(item, item?.tipoDoc || item?.tipo_doc || targetTipo)
            : getEraScopedCanonicalDocKey(key, targetTipo);
          const targetId = String(item?.id || (typeof key === 'string' && !/^\d+$/.test(key) ? key : '') || '').trim();
          setProfitInvoices(prev => (prev || []).filter(f => {
            if (!f) return false;
            const fId = String(f.id ?? '').trim();
            const fCanon = getEraScopedCanonicalDocKey(f);
            if (targetCanon && fCanon) return fCanon !== targetCanon;
            return targetId ? fId !== targetId : true;
          }));
          return;
        }
        if (item) {
          const resolvedNum = String(item.factNum ?? item.fact_num ?? item.facturaNumero ?? '').trim();
          const resolvedId = String(item.id ?? '').trim();
          const resolvedTotBrutoUsd = item.totBrutoUsd ?? item.tot_bruto_usd ?? item.totalBrutoUsd;
          const resolvedIvaUsd = item.ivaUsd ?? item.iva_usd;
          const resolvedTotNetoUsd = item.totNetoUsd ?? item.tot_neto_usd ?? item.totalNetoUsd;
          const resolvedAbonosUsd = item.abonosUsd ?? item.abonos_usd;
          const resolvedSaldoUsd = item.saldoUsd ?? item.saldo_usd;
          const resolvedSaldoBs = item.saldoBs ?? item.saldo_bs;
          const resolvedFechaSinc = item.fechaSincronizacion ?? item.fecha_sincronizacion ?? item.updated_at;
          const normalizedInvItem = {
            ...item,
            ...(resolvedNum ? { factNum: resolvedNum, fact_num: isNaN(Number(resolvedNum)) ? resolvedNum : Number(resolvedNum) } : {}),
            ...(item.tipo_doc !== undefined || item.tipoDoc !== undefined ? { tipoDoc: item.tipoDoc ?? item.tipo_doc, tipo_doc: item.tipoDoc ?? item.tipo_doc } : {}),
            ...(item.fec_emis !== undefined || item.fechaEmision !== undefined ? { fechaEmision: item.fechaEmision ?? item.fec_emis, fec_emis: item.fechaEmision ?? item.fec_emis } : {}),
            ...(item.fec_venc !== undefined || item.fechaVencimiento !== undefined ? { fechaVencimiento: item.fechaVencimiento ?? item.fec_venc, fec_venc: item.fechaVencimiento ?? item.fec_venc } : {}),
            ...(resolvedTotBrutoUsd !== undefined ? { totBrutoUsd: Number(resolvedTotBrutoUsd), tot_bruto_usd: Number(resolvedTotBrutoUsd) } : {}),
            ...(resolvedIvaUsd !== undefined ? { ivaUsd: Number(resolvedIvaUsd), iva_usd: Number(resolvedIvaUsd) } : {}),
            ...(resolvedTotNetoUsd !== undefined ? { totNetoUsd: Number(resolvedTotNetoUsd), tot_neto_usd: Number(resolvedTotNetoUsd) } : {}),
            ...(resolvedAbonosUsd !== undefined ? { abonosUsd: Number(resolvedAbonosUsd), abonos_usd: Number(resolvedAbonosUsd) } : {}),
            ...(resolvedSaldoUsd !== undefined ? { saldoUsd: Number(resolvedSaldoUsd), saldo_usd: Number(resolvedSaldoUsd) } : {}),
            ...(resolvedSaldoBs !== undefined ? { saldoBs: Number(resolvedSaldoBs), saldo_bs: Number(resolvedSaldoBs) } : {}),
            ...(resolvedFechaSinc ? { fechaSincronizacion: resolvedFechaSinc, updated_at: item.updated_at || resolvedFechaSinc } : {})
          };
          setProfitInvoices(prev => {
            const targetCanon = getEraScopedCanonicalDocKey(normalizedInvItem);
            const targetKey = String(key || resolvedId || resolvedNum).replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
            const targetId = String(key || resolvedId).trim();
            const index = prev.findIndex(f => {
              const fCanon = getEraScopedCanonicalDocKey(f);
              if (targetCanon && fCanon) {
                return fCanon === targetCanon;
              }
              const fNum = String(f.factNum ?? f.fact_num ?? f.facturaNumero ?? f.id ?? '').replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
              const fId = String(f.id ?? '').trim();
              return (targetId && fId === targetId) || (targetKey && fNum === targetKey);
            });
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...normalizedInvItem };
              return next;
            }
            return [normalizedInvItem, ...prev];
          });
        }
      } else if (tableId === 'inventory_adjustments') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitInventoryAdjustments(allTableData);
          return;
        }
        if (item) {
          setProfitInventoryAdjustments(prev => {
            const index = prev.findIndex(a => a.ajueNum === key || a.ajue_num === key || a.id === key);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [...prev, item];
          });
        }
      } else if (tableId === 'warehouse_transfers') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitWarehouseTransfers(allTableData);
          return;
        }
        if (item) {
          setProfitWarehouseTransfers(prev => {
            const index = prev.findIndex(t => t.trasNum === key || t.tras_num === key || t.id === key);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [...prev, item];
          });
        }
      } else if (tableId === 'product_lines') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitProductLines(allTableData);
          return;
        }
        if (item) {
          setProfitProductLines(prev => {
            const index = prev.findIndex(l => l.coLin === key || l.co_lin === key || l.id === key);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [...prev, item];
          });
        }
      } else if (tableId === 'product_sublines') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setProfitProductSublines(allTableData);
          return;
        }
        if (item) {
          setProfitProductSublines(prev => {
            const index = prev.findIndex(s => s.coSubl === key || s.co_subl === key || s.id === key);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [...prev, item];
          });
        }
      } else if (tableId === 'users') {
        if ((action === 'STORAGE_UPDATE' || action === 'SYNC_ALL') && Array.isArray(allTableData)) {
          const sorted = sortUsersByHierarchy(allTableData);
          setUsersList(sorted);
          try { localStorage.setItem('signum_users_list', JSON.stringify(sorted)); } catch (_) {}
          setCurrentUser(prev => {
            if (!prev) return prev;
            const matched = sorted.find(
              u => u.id === prev.id || (u.username && prev.username && u.username.toLowerCase() === prev.username.toLowerCase())
            );
            if (matched) {
              try { localStorage.setItem('signum_active_user', JSON.stringify(matched)); } catch (_) {}
              return matched;
            }
            return prev;
          });
          return;
        }

        if (action === 'DELETE') {
          setUsersList(prev => {
            const next = prev.filter(u => String(u.id).trim() !== String(key).trim() && String(u.username || '').toLowerCase() !== String(key).toLowerCase());
            const sorted = sortUsersByHierarchy(next);
            try { localStorage.setItem('signum_users_list', JSON.stringify(sorted)); } catch (_) {}
            return sorted;
          });

          return;
        }

        if (item) {
          setUsersList(prev => {
            const index = prev.findIndex(u => String(u.id).trim() === String(key).trim() || String(u.username || '').toLowerCase() === String(item.username || '').toLowerCase());
            let next;
            if (index >= 0) {
              next = [...prev];
              next[index] = { ...next[index], ...item };
            } else {
              next = [...prev, item];
            }
            const sorted = sortUsersByHierarchy(next);
            try { localStorage.setItem('signum_users_list', JSON.stringify(sorted)); } catch (_) {}
            return sorted;
          });

          // Si el usuario en sesión activa fue modificado, actualizar sesión de inmediato usando estado funcional
          setCurrentUser(prev => {
            if (!prev) return prev;
            if (prev.id === item.id || (prev.username && item.username && prev.username.toLowerCase() === item.username.toLowerCase())) {
              const updated = { ...prev, ...item };
              try { localStorage.setItem('signum_active_user', JSON.stringify(updated)); } catch (_) {}
              return updated;
            }
            return prev;
          });

        }
      } else if (tableId === 'orders') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setOrdersState(allTableData);
          return;
        }
        if (action === 'DELETE') {
          setOrdersState(prev => prev.filter(o => String(o.id) !== String(key) && String(o.numeroPedido || '') !== String(key)));
          return;
        }
        if (item) {
          if (!isSelfEvent && action === 'CREATE' && item.status !== 'FACTURADO') {
            soundFX.cashierOrderChime(config?.sonidosNotificacion !== false);
            if (notify?.info) {
              const isClientReq = String(item.tipoDoc || item.tipo_doc || '').toUpperCase() === 'SOLICITUD_CLIENTE';
              notify.info(
                isClientReq
                  ? `🆕 ¡Nueva solicitud de cliente en Flujo Comercial! ${item.clienteNombre || 'Cliente'} (${item.clienteRif || ''}) - Vendedor: ${item.vendedorNombre || item.vendedorId || ''}`
                  : `🔔 ¡Nueva orden en Caja! #${item.numeroDoc || item.id} (${item.clienteNombre || 'Cliente'} - $${formatNumberUs(item.totalUsd || 0)})`,
                { duration: 6000 }
              );
            }
          }
          setOrdersState(prev => {
            const index = prev.findIndex(o => String(o.id) === String(key || item.id) || (item.numeroPedido && o.numeroPedido === item.numeroPedido));
            const normalizedOrderPatch = (item.status && !item.estado)
              ? { ...item, estado: item.status }
              : (!item.status && item.estado ? { ...item, status: item.estado } : item);
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...normalizedOrderPatch };
              return next;
            }
            return [normalizedOrderPatch, ...prev];
          });
        }
      } else if (tableId === 'sales') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setSalesState(filterOutDeletedCxcDocs(allTableData));
          return;
        }
        if (action === 'DELETE') {
          const targetCanon = item && typeof item === 'object'
            ? getEraScopedCanonicalDocKey(item, item?.tipoDoc || item?.tipo_doc || '')
            : getEraScopedCanonicalDocKey(key, '');
          const targetKey = String(key || item?.id || item?.numeroDoc || item?.factNum || '').replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
          const targetId = String(key || item?.id || '').trim();
          setSalesState(prev => prev.filter(s => {
            const sNum = String(s.numeroDoc || s.numero_doc || '').replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
            const sId = String(s.id || '').trim();
            const sCanon = getEraScopedCanonicalDocKey(s);
            if (targetCanon && sCanon) return sCanon !== targetCanon;
            return (targetKey ? sNum !== targetKey : true) && (targetId ? sId !== targetId : true);
          }));
          return;
        }
        if (item) {
          const resolvedSaldoUsd = item.saldoUsd ?? item.saldo_usd;
          const resolvedSaldoBs = item.saldoBs ?? item.saldo_bs;
          const resolvedAbonosUsd = item.abonosUsd ?? item.abonos_usd;
          const resolvedTotalUsd = item.totalUsd ?? item.total_usd ?? item.totNetoUsd ?? item.tot_neto_usd;
          const normalizedSaleItem = {
            ...item,
            ...(item.numero_doc !== undefined || item.numeroDoc !== undefined ? { numeroDoc: item.numeroDoc ?? item.numero_doc, numero_doc: item.numeroDoc ?? item.numero_doc } : {}),
            ...(resolvedTotalUsd !== undefined ? { totalUsd: Number(resolvedTotalUsd), total_usd: Number(resolvedTotalUsd) } : {}),
            ...(resolvedSaldoUsd !== undefined ? { saldoUsd: Number(resolvedSaldoUsd), saldo_usd: Number(resolvedSaldoUsd) } : {}),
            ...(resolvedSaldoBs !== undefined ? { saldoBs: Number(resolvedSaldoBs), saldo_bs: Number(resolvedSaldoBs) } : {}),
            ...(resolvedAbonosUsd !== undefined ? { abonosUsd: Number(resolvedAbonosUsd), abonos_usd: Number(resolvedAbonosUsd) } : {})
          };
          setSalesState(prev => {
            const targetCanon = getEraScopedCanonicalDocKey(normalizedSaleItem);
            const targetKey = String(key || item.id || item.numeroDoc || item.numero_doc || '').replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
            const targetId = String(key || item.id || '').trim();
            const index = prev.findIndex(s => {
              const sCanon = getEraScopedCanonicalDocKey(s);
              if (targetCanon && sCanon) {
                return sCanon === targetCanon;
              }
              const sNum = String(s.numeroDoc || s.numero_doc || s.id || '').replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
              const sId = String(s.id || '').trim();
              return (targetId && sId === targetId) || (targetKey && sNum === targetKey);
            });
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...normalizedSaleItem };
              return next;
            }
            return [normalizedSaleItem, ...prev];
          });
        }
      } else if (tableId === 'purchases') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setPurchasesState(allTableData);
          return;
        }
        if (isDeleteAction) {
          const delKey = String(key || item?.id || '').trim();
          if (delKey) {
            setPurchasesState(prev => (prev || []).filter(p => String(p?.id || '').trim() !== delKey));
          }
          return;
        }
        if (item) {
          setPurchasesState(prev => {
            const index = prev.findIndex(p => String(p.id) === String(key || item.id) || (item.facturaNumero && p.facturaNumero === item.facturaNumero));
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [item, ...prev];
          });
        }
      } else if (tableId === 'cash_movements') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setCashMovementsState(dedupeCashMovements(allTableData));
          return;
        }
        if (isDeleteAction) {
          const delTarget = item || (key ? { id: key } : null);
          if (delTarget || key) {
            setCashMovementsState(prev => removeCashMovementFromList(prev, delTarget || key));
          }
          return;
        }
        if (item) {
          try {
            const rawDel = localStorage.getItem('sm_deleted_cash_movements_v1');
            const delSet = rawDel ? new Set(JSON.parse(rawDel).map(x => String(x || '').trim())) : null;
            const itemId = String(item.id || key || '').trim();
            if (delSet && itemId && delSet.has(itemId)) {
              return;
            }
          } catch (_) {}
          setCashMovementsState(prev => upsertCashMovementInList(prev, item));
        }
      } else if (tableId === 'fiscal_closures') {
        if ((action === 'RECONCILE_ALL' || action === 'STORAGE_UPDATE') && Array.isArray(allTableData)) {
          setFiscalClosures(allTableData);
          return;
        }
        if (isDeleteAction) {
          const delKey = String(key || item?.id || '').trim();
          if (delKey) {
            setFiscalClosures(prev => (prev || []).filter(c => String(c?.id || '').trim() !== delKey));
          }
          return;
        }
        if (item) {
          setFiscalClosures(prev => {
            const index = prev.findIndex(c => String(c.id) === String(key || item.id));
            if (index >= 0) {
              const next = [...prev];
              next[index] = { ...next[index], ...item };
              return next;
            }
            return [item, ...prev];
          });
        }
      } else if (tableId === 'config' && item && typeof item === 'object') {
        setConfigState(prev => ({ ...prev, ...item }));
      } else if (tableId === 'cash_desks') {
        if (Array.isArray(allTableData)) {
          setProfitCashDesks(allTableData);
          return;
        }
        if (action === 'DELETE') {
          const delKey = String(key || item?.id || item?.coCaja || item?.co_caja || '').trim();
          if (delKey) {
            setProfitCashDesks(prev => (prev || []).filter(d =>
              String(d.id || d.coCaja || d.co_caja || '').trim() !== delKey &&
              String(d.coCaja || d.co_caja || '').trim() !== delKey
            ));
          }
          return;
        }
        if (item) {
          const resolvedId = String(item.id || item.coCaja || item.co_caja || key || '').trim();
          const resolvedCod = String(item.coCaja || item.co_caja || resolvedId || '').trim();
          const resolvedSaldoUsd = item.saldoUsd ?? item.saldo_usd;
          const resolvedSaldoBs = item.saldoBs ?? item.saldo_bs;
          const normalizedDesk = {
            ...item,
            ...(resolvedId ? { id: resolvedId } : {}),
            ...(resolvedCod ? { coCaja: resolvedCod, co_caja: resolvedCod } : {}),
            ...(item.descrip !== undefined || item.nombre !== undefined ? { descrip: item.descrip ?? item.nombre, nombre: item.nombre ?? item.descrip } : {}),
            ...(resolvedSaldoUsd !== undefined ? { saldoUsd: Number(resolvedSaldoUsd || 0), saldo_usd: Number(resolvedSaldoUsd || 0) } : {}),
            ...(resolvedSaldoBs !== undefined ? { saldoBs: Number(resolvedSaldoBs || 0), saldo_bs: Number(resolvedSaldoBs || 0) } : {})
          };
          setProfitCashDesks(prev => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex(d => {
              const dId = String(d.id || d.coCaja || d.co_caja || '').trim();
              const dCod = String(d.coCaja || d.co_caja || dId || '').trim();
              return dId === resolvedId || dCod === resolvedCod || (key && (dId === String(key) || dCod === String(key)));
            });
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...normalizedDesk };
              return list;
            }
            return [...list, normalizedDesk];
          });
        }
      } else if (tableId === 'collections') {
        if (Array.isArray(allTableData)) {
          setProfitCollections(allTableData);
          return;
        }
        if (action === 'DELETE') {
          setProfitCollections(prev => (prev || []).filter(c => String(c.id) !== String(key) && String(c.cobNum || c.cob_num) !== String(key)));
          return;
        }
        if (item) {
          setProfitCollections(prev => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex(c => String(c.id) === String(item.id || key) || String(c.cobNum || c.cob_num) === String(item.cobNum || key));
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...item };
              return list;
            }
            return [item, ...list];
          });
        }
      } else if (tableId === 'accounts_payable') {
        if (Array.isArray(allTableData)) {
          setProfitAccountsPayable(dedupePayablesList(allTableData));
          return;
        }
        if (isDeleteAction) {
          const delKey = String(key || item?.id || '').trim();
          setProfitAccountsPayable(prev => (prev || []).filter(p => {
            if (!p) return false;
            if (item && (item.nroDoc || item.nro_doc || item.coProv || item.co_prov || item.provRif || item.prov_rif)) {
              return !doesPayableMatchDocument(p, item);
            }
            return delKey ? String(p.id || '').trim() !== delKey : true;
          }));
          return;
        }
        if (item) {
          const resolvedId = String(item.id || '').trim();
          const resolvedNro = String(item.nroDoc ?? item.nro_doc ?? '').trim();
          const resolvedMontoNetUsd = item.montoNetUsd ?? item.monto_net_usd;
          const resolvedSaldoUsd = item.saldoUsd ?? item.saldo_usd;
          const resolvedSaldoBs = item.saldoBs ?? item.saldo_bs;
          const resolvedAbonosUsd = item.abonosUsd ?? item.abonos_usd;
          const resolvedFechaSinc = item.fechaSincronizacion ?? item.fecha_sincronizacion ?? item.updated_at;
          const normalizedCxp = {
            ...item,
            ...(resolvedId ? { id: resolvedId } : {}),
            ...(resolvedNro ? { nroDoc: resolvedNro, nro_doc: resolvedNro } : {}),
            ...(item.tipo_doc !== undefined || item.tipoDoc !== undefined ? { tipoDoc: item.tipoDoc ?? item.tipo_doc, tipo_doc: item.tipoDoc ?? item.tipo_doc } : {}),
            ...(item.prov_nombre !== undefined || item.provNombre !== undefined ? { provNombre: item.provNombre ?? item.prov_nombre, prov_nombre: item.provNombre ?? item.prov_nombre } : {}),
            ...(item.prov_rif !== undefined || item.provRif !== undefined ? { provRif: item.provRif ?? item.prov_rif, prov_rif: item.provRif ?? item.prov_rif } : {}),
            ...(item.fec_emis !== undefined || item.fechaEmision !== undefined ? { fechaEmision: item.fechaEmision ?? item.fec_emis, fec_emis: item.fechaEmision ?? item.fec_emis } : {}),
            ...(item.fec_venc !== undefined || item.fechaVencimiento !== undefined ? { fechaVencimiento: item.fechaVencimiento ?? item.fec_venc, fec_venc: item.fechaVencimiento ?? item.fec_venc } : {}),
            ...(resolvedMontoNetUsd !== undefined ? { montoNetUsd: Number(resolvedMontoNetUsd), monto_net_usd: Number(resolvedMontoNetUsd) } : {}),
            ...(resolvedSaldoUsd !== undefined ? { saldoUsd: Number(resolvedSaldoUsd), saldo_usd: Number(resolvedSaldoUsd) } : {}),
            ...(resolvedSaldoBs !== undefined ? { saldoBs: Number(resolvedSaldoBs), saldo_bs: Number(resolvedSaldoBs) } : {}),
            ...(resolvedAbonosUsd !== undefined ? { abonosUsd: Number(resolvedAbonosUsd), abonos_usd: Number(resolvedAbonosUsd) } : {}),
            ...(resolvedFechaSinc ? { fechaSincronizacion: resolvedFechaSinc, updated_at: item.updated_at || resolvedFechaSinc } : {})
          };
          setProfitAccountsPayable(prev => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex(p =>
              doesPayableMatchDocument(p, normalizedCxp) ||
              (key && String(p?.id || '').trim() === String(key).trim())
            );
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...normalizedCxp };
              return dedupePayablesList(list);
            }
            return dedupePayablesList([normalizedCxp, ...list]);
          });
        }
      } else if (tableId === 'supplier_payments') {
        if (Array.isArray(allTableData)) {
          setProfitSupplierPayments(dedupeSupplierPaymentsList(allTableData));
          return;
        }
        if (isDeleteAction) {
          const delKey = String(key || item?.id || item?.pagoNum || item?.pago_num || '').trim();
          if (delKey) {
            setProfitSupplierPayments(prev => (prev || []).filter(p =>
              String(p.id || '').trim() !== delKey &&
              String(p.pagoNum ?? p.pago_num ?? '').trim() !== delKey
            ));
          }
          return;
        }
        if (item) {
          setProfitSupplierPayments(prev => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex(p => String(p.id) === String(item.id || key) || (item.pagoNum && String(p.pagoNum ?? p.pago_num ?? '') === String(item.pagoNum)));
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...item };
              return dedupeSupplierPaymentsList(list);
            }
            return dedupeSupplierPaymentsList([item, ...list]);
          });
        }
      } else if (tableId === 'zones') {
        if (Array.isArray(allTableData)) {
          setProfitZones(allTableData);
          return;
        }
        if (action === 'DELETE') {
          const delId = String(item?.id || '').trim().toUpperCase();
          const delCoZon = String(item?.coZon || item?.co_zon || key || '').trim().toUpperCase();
          setProfitZones(prev => (prev || []).filter(z => {
            const zId = String(z?.id || '').trim().toUpperCase();
            const zCode = String(z?.coZon || z?.co_zon || '').trim().toUpperCase();
            return (!delId || zId !== delId) && (!delCoZon || zCode !== delCoZon);
          }));
          return;
        }
        if (item) {
          const itemCode = String(item.coZon || item.co_zon || '').trim().toUpperCase();
          setProfitZones(prev => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex(z =>
              (item.id && String(z.id) === String(item.id)) ||
              (itemCode && String(z.coZon || z.co_zon || '').trim().toUpperCase() === itemCode)
            );
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...item };
            } else {
              list.push(item);
            }
            return list.sort((a, b) =>
              String(a.coZon || a.co_zon || '').localeCompare(String(b.coZon || b.co_zon || ''), undefined, { numeric: true })
            );
          });
        }
      } else if (tableId === 'transports' && Array.isArray(allTableData)) {
        setProfitTransports(allTableData);
      } else if (tableId === 'customer_returns' && Array.isArray(allTableData)) {
        setProfitReturns(allTableData);
      }
    });

    return () => unsubscribe();
  }, []);

  // Rutina de Expiración Automática de Órdenes Caducadas (>72h) y Liberación de Stock ATP (Sugerencia 2)
  useEffect(() => {
    let timerId = null;
    const runSweep = async () => {
      try {
        const expired = await checkAndExpireOverdueOrders();
        if (Array.isArray(expired) && expired.length > 0) {
          soundFX.orderExpired(config?.sonidosNotificacion !== false);
          if (notify?.warning) {
            notify.warning(
              `⏰ Se liberó la reserva de stock de ${expired.length} pedido(s) por superar las 72 horas de vigencia.`,
              { duration: 7000 }
            );
          }
          const freshOrders = await getSupabaseOrders();
          if (freshOrders) setOrdersState(freshOrders);
          const freshProds = await getSupabaseProducts();
          if (freshProds) setProductsState(freshProds);
        }
      } catch (sweepErr) {
        console.warn('[72h Sweep] Error en barrido de órdenes caducadas:', sweepErr);
      }
    };

    const initialTimeout = setTimeout(runSweep, 6000);
    timerId = setInterval(runSweep, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (timerId) clearInterval(timerId);
    };
  }, [config, notify]);

  // Limpieza automática y auto-reconciliación de órdenes huérfanas o pruebas en localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sm_orders_v4_pipeline');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(o => {
            if (!o || !o.id) return false;
            const idUpper = String(o.id).toUpperCase();
            const docUpper = String(o.numeroDoc || o.numero_doc || '').toUpperCase();
            if (idUpper.includes('TEST') || docUpper.includes('TEST')) return false;
            if (!Array.isArray(o.items) || o.items.length === 0) return false;
            return true;
          });
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('sm_orders_v4_pipeline', JSON.stringify(cleaned));
            setOrdersState(cleaned.length > 0 ? cleaned : REAL_ORDERS);
          }
        }
      }
    } catch (_) {}
  }, []);

  // Alerta automática diaria cuando falten <= 3 días para el vencimiento de crédito de clientes
  useEffect(() => {
    if (!currentUser || !Array.isArray(clients) || clients.length === 0) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const guardKey = `sm_credit_3d_sweep_${todayKey}_${currentUser.id || currentUser.username || 'usr'}`;
    try {
      if (sessionStorage.getItem(guardKey)) return;
    } catch (_) {}

    const timer = setTimeout(async () => {
      try {
        const { tasaBcv: tasa } = resolveExchangeRates(config);
        const expiringClients = [];
        for (const cl of syncedClients) {
          if (!cl || cl.inactivo) continue;
          const summary = evaluateClientCreditPortfolioSummary({
            client: cl,
            profitInvoices,
            sales,
            tasaBcv: tasa
          });
          if (summary.alerta3Dias) {
            expiringClients.push({ client: cl, summary });
          }
        }

        if (expiringClients.length > 0) {
          try { sessionStorage.setItem(guardKey, '1'); } catch (_) {}
          if (notify?.warning) {
            const topNames = expiringClients
              .slice(0, 3)
              .map(({ client, summary }) => `${client.nombre || client.razonSocial} (${summary.diasRestantesMin === 0 ? 'HOY' : `${summary.diasRestantesMin}d`})`)
              .join(', ');
            notify.warning(
              `⏳ Crédito por vencer (≤ 3 días): ${expiringClients.length} cliente(s) próximo(s) a vencimiento: ${topNames}${expiringClients.length > 3 ? '...' : ''}.`,
              { duration: 7500 }
            );
          }
          // Registrar en Centro de Notificaciones (idempotente por cliente y fecha)
          for (const { client, summary } of expiringClients.slice(0, 15)) {
            const safeClientKey = String(client.id || client.codigo || client.rif || 'cli').replace(/[^a-zA-Z0-9_-]/g, '');
            await saveSupabaseNotification({
              id: `notif_cred3d_${todayKey}_${safeClientKey}`,
              tipo: 'cxc',
              severidad: summary.diasRestantesMin === 0 ? 'critica' : 'advertencia',
              modulo: 'cxc',
              titulo: `Crédito por vencer (${summary.diasRestantesMin === 0 ? 'HOY' : `${summary.diasRestantesMin} día(s)`}): ${client.nombre || client.rif}`,
              mensaje: `Al cliente ${client.nombre || ''} (${client.rif || ''}) le falta(n) ${summary.diasRestantesMin} día(s) para finalizar su crédito (${summary.docProximoVencer || 'Documento abierto'}, saldo $${formatNumberUs(summary.evalPolicy?.saldoDeudorUsd || 0)}).`,
              destinatario_rol: 'VENTAS',
              destinatario_usuario: client.vendedorAsignado || 'ALL',
              origen: 'MONITOR_CREDITO',
              metadata: {
                clienteId: client.id || client.codigo,
                clienteNombre: client.nombre,
                diasRestantes: summary.diasRestantesMin,
                documento: summary.docProximoVencer,
                vendedorAsignado: client.vendedorAsignado || ''
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[Credit 3D Alert] Error verificando créditos por vencer:', err);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [currentUser, syncedClients, profitInvoices, sales, config?.tasaDolar, notify]);

  // Sincronizar currentUser de forma atómica con usersList y localStorage
  const handleUpdateCurrentUser = (updatedUser) => {
    if (!updatedUser) return;
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('signum_active_user', JSON.stringify(updatedUser));
    } catch (_) {}
    setUsersList(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      let changed = false;
      const next = prev.map(u => {
        if (u.id === updatedUser.id || (u.username && updatedUser.username && u.username.toLowerCase() === updatedUser.username.toLowerCase())) {
          changed = true;
          return { ...u, ...updatedUser };
        }
        return u;
      });
      if (!changed) return prev;
      const sorted = sortUsersByHierarchy(next);
      try {
        localStorage.setItem('signum_users_list', JSON.stringify(sorted));
      } catch (_) {}
      return sorted;
    });
  };

  const handleUsersUpdated = async (savedUser) => {
    const freshUsers = await getSupabaseUsers();
    setUsersList(freshUsers);
    try {
      localStorage.setItem('signum_users_list', JSON.stringify(freshUsers));
    } catch (_) {}

    if (savedUser && currentUser && (savedUser.id === currentUser.id || savedUser.username?.toLowerCase() === currentUser.username?.toLowerCase())) {
      handleUpdateCurrentUser(savedUser);
    } else if (currentUser) {
      const matching = freshUsers.find(u => u.id === currentUser.id || u.username?.toLowerCase() === currentUser.username?.toLowerCase());
      if (matching) {
        handleUpdateCurrentUser(matching);
      }
    }

    try {
      const freshSellers = await getSupabaseProfitSellers();
      if (freshSellers && freshSellers.length > 0) setProfitSellers(freshSellers);
    } catch (_) {}
  };

  // Sincronizar currentUser cuando usersList se actualiza desde servidor o almacenamiento
  useEffect(() => {
    if (!usersList || usersList.length === 0) return;
    setCurrentUser(prev => {
      if (!prev) return prev;
      const matched = usersList.find(
        (u) => u.id === prev.id || (u.username && prev.username && u.username.toLowerCase() === prev.username.toLowerCase())
      );
      if (matched && (matched.foto !== prev.foto || matched.nombre !== prev.nombre || matched.cargo !== prev.cargo)) {
        try {
          localStorage.setItem('signum_active_user', JSON.stringify(matched));
        } catch (_) {}
        return matched;
      }
      return prev;
    });
  }, [usersList]);

  // Asegurar que la pestaña activa corresponda a los permisos del usuario
  useEffect(() => {
    if (currentUser && !canAccessModule(currentUser.rol, activeTab, currentUser)) {
      const norm = normalizeRole(currentUser.rol);
      const allowedModules = (Array.isArray(currentUser.modulos) && currentUser.modulos.length > 0)
        ? currentUser.modulos
        : (ROLE_PERMISSIONS[norm] || ['ventas']);
      const preferredTab = DEFAULT_TABS_BY_ROLE[norm];
      const fallbackTab = allowedModules.includes(preferredTab)
        ? preferredTab
        : (allowedModules[0] || 'ventas');
      setActiveTab(fallbackTab);
    }
  }, [currentUser, activeTab]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    const norm = normalizeRole(user?.rol);
    const allowedModules = (Array.isArray(user?.modulos) && user.modulos.length > 0)
      ? user.modulos
      : (ROLE_PERMISSIONS[norm] || ['ventas']);
    const targetTab = DEFAULT_TABS_BY_ROLE[norm] || 'ventas';
    const destinationTab = allowedModules.includes(targetTab) ? targetTab : (allowedModules[0] || 'ventas');
    setActiveTab(destinationTab);
  };

  const handleLogout = () => {
    authLogout();
    setCurrentUser(null);
  };

  // Sincronización periódica en tiempo real con el Banco Central de Venezuela (BCV)
  useEffect(() => {
    const syncBcvRateSilently = async () => {
      try {
        const liveRate = await fetchBcvRate();
        if (liveRate && config?.tasaDolar && liveRate !== config.tasaDolar) {
          console.log(`[BCV Sync Automático] Actualizando tasa a: Bs. ${liveRate} (anterior: Bs. ${config.tasaDolar})`);
          const updatedConfig = await updateSupabaseConfig({ tasaDolar: liveRate });
          setConfigState(updatedConfig);
        }
      } catch (err) {
        console.warn("[BCV Sync Automático] No se pudo verificar la tasa:", err);
      }
    };

    // Polling en tiempo real cada 60 segundos (1 minuto)
    const interval = setInterval(syncBcvRateSilently, 60000);

    // Sincronizar de inmediato al recuperar foco de la ventana
    const handleFocus = () => {
      syncBcvRateSilently();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [config?.tasaDolar]);

  // Sincronización periódica automática con Supabase (cada 2 minutos)
  useEffect(() => {
    let isRunning = false;

    const syncProfitSilently = async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        await handleSyncProfit();
        console.log('[Profit Sync Automático] Datos actualizados ✓', new Date().toLocaleTimeString('es-VE'));
      } catch (err) {
        console.warn('[Profit Sync Automático] Error silencioso:', err?.message || err);
      } finally {
        isRunning = false;
      }
    };

    // Polling cada 2 minutos
    const interval = setInterval(syncProfitSilently, 2 * 60 * 1000);

    // Sincronizar también al recuperar el foco de la ventana
    const handleFocusProfit = () => syncProfitSilently();
    window.addEventListener('focus', handleFocusProfit);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusProfit);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suscripción a Cambios en TIEMPO REAL (Supabase Realtime) para Supabase y base de datos
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeChanges({
      onUsersChange: async (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en usuarios desde Supabase:', payload?.eventType);
        const updatedUsers = await getSupabaseUsers();
        if (updatedUsers && updatedUsers.length > 0) {
          setUsersList(updatedUsers);
          const activeUser = getActiveUser();
          if (activeUser) {
            const matched = updatedUsers.find(u => u.id === activeUser.id || (u.username && activeUser.username && u.username.toLowerCase() === activeUser.username.toLowerCase()));
            if (matched) {
              setCurrentUser(matched);
              try { localStorage.setItem('signum_active_user', JSON.stringify(matched)); } catch (_) {}
            }
          }
        }
      },
      onProductsChange: async () => {
        console.log('⚡ [Realtime] Recargando catálogo de productos...');
        const updatedProds = await getSupabaseProducts();
        if (updatedProds && updatedProds.length > 0) {
          setProductsState(updatedProds);
        }
      },
      onClientsChange: async () => {
        console.log('⚡ [Realtime] Recargando cartera de clientes...');
        const updatedClis = await getSupabaseClients();
        if (updatedClis && updatedClis.length > 0) {
          setClientsState(updatedClis);
        }
      },
      onConfigChange: async () => {
        const updatedCfg = await getSupabaseConfig();
        if (updatedCfg) {
          setConfigState(updatedCfg);
        }
      },
      onOrdersChange: async () => {
        console.log('⚡ [Realtime] Recargando pedidos y preventa...');
        const updatedOrds = await getSupabaseOrders();
        if (updatedOrds) {
          setOrdersState(updatedOrds);
        }
      },
      onBankAccountsChange: async () => {
        console.log('⚡ [Realtime] Recargando cuentas bancarias...');
        const updatedBnks = await getSupabaseProfitBankAccounts();
        if (updatedBnks) setProfitBankAccounts(updatedBnks);
      },
      onCashDesksChange: async () => {
        console.log('⚡ [Realtime] Recargando cajas registradoras Profit...');
        const updatedDesks = await getSupabaseProfitCashDesks();
        if (updatedDesks) setProfitCashDesks(updatedDesks);
      },
      onCollectionsChange: async () => {
        console.log('⚡ [Realtime] Recargando cobranzas Profit...');
        const updatedCobs = await getSupabaseProfitCollections();
        if (updatedCobs) setProfitCollections(updatedCobs);
      },
      onInvoicesChange: async () => {
        console.log('⚡ [Realtime] Recargando facturas Profit...');
        const updatedFacs = await getSupabaseProfitInvoices();
        if (updatedFacs) setProfitInvoices(filterOutDeletedCxcDocs(updatedFacs));
      },
      onSuppliersChange: async () => {
        console.log('⚡ [Realtime] Recargando proveedores...');
        const [updatedProfitSups, updatedNativeSups] = await Promise.all([
          getSupabaseProfitSuppliers(),
          getSupabaseSuppliers()
        ]);
        if (updatedProfitSups) setProfitSuppliers(updatedProfitSups);
        if (updatedNativeSups) setSuppliersState(updatedNativeSups);
      },
      onPurchasesChange: async () => {
        console.log('⚡ [Realtime] Recargando compras...');
        const [updatedProfitPurs, updatedNativePurs] = await Promise.all([
          getSupabaseProfitPurchases(),
          getSupabasePurchases()
        ]);
        if (updatedProfitPurs) setProfitPurchases(updatedProfitPurs);
        if (updatedNativePurs) setPurchasesState(updatedNativePurs);
      },
      onAccountsPayableChange: async () => {
        console.log('⚡ [Realtime] Recargando CxP Profit...');
        const updatedCxp = await getSupabaseProfitAccountsPayable();
        if (updatedCxp) setProfitAccountsPayable(updatedCxp);
      },
      onSupplierPaymentsChange: async () => {
        console.log('⚡ [Realtime] Recargando pagos a proveedores...');
        const updatedPays = await getSupabaseProfitSupplierPayments();
        if (updatedPays) setProfitSupplierPayments(updatedPays);
      },
      onSellersChange: async () => {
        console.log('⚡ [Realtime] Recargando fuerza de ventas...');
        const updatedSellers = await getSupabaseProfitSellers();
        if (updatedSellers) setProfitSellers(updatedSellers);
      },
      onZonesChange: async () => {
        console.log('⚡ [Realtime] Recargando zonas de despacho Profit...');
        const updatedZones = await getSupabaseProfitZones();
        if (updatedZones) setProfitZones(updatedZones);
      },
      onTransportsChange: async () => {
        console.log('⚡ [Realtime] Recargando flota / transportistas Profit...');
        const updatedTransports = await getSupabaseProfitTransports();
        if (updatedTransports) setProfitTransports(updatedTransports);
      },
      onCustomerReturnsChange: async () => {
        console.log('⚡ [Realtime] Recargando devoluciones de clientes Profit...');
        const updatedReturns = await getSupabaseProfitReturns();
        if (updatedReturns) setProfitReturns(updatedReturns);
      },
      onInventoryAdjustmentsChange: async () => {
        console.log('⚡ [Realtime] Recargando ajustes de inventario Profit...');
        const updatedAju = await getSupabaseProfitInventoryAdjustments();
        if (updatedAju) setProfitInventoryAdjustments(updatedAju);
      },
      onWarehouseTransfersChange: async () => {
        console.log('⚡ [Realtime] Recargando traslados entre almacenes Profit...');
        const updatedTra = await getSupabaseProfitWarehouseTransfers();
        if (updatedTra) setProfitWarehouseTransfers(updatedTra);
      },
      onIslrConceptsChange: async () => {
        console.log('⚡ [Realtime] Recargando conceptos ISLR SENIAT...');
        const updatedIslr = await getSupabaseProfitIslrConcepts();
        if (updatedIslr) setProfitIslrConcepts(updatedIslr);
      },
      onBeneficiariesChange: async () => {
        console.log('⚡ [Realtime] Recargando beneficiarios Profit...');
        const updatedBen = await getSupabaseProfitBeneficiaries();
        if (updatedBen) setProfitBeneficiaries(updatedBen);
      },
      onPaymentOrdersChange: async () => {
        console.log('⚡ [Realtime] Recargando órdenes de pago Profit...');
        const updatedOrders = await getSupabaseProfitPaymentOrdersMerged();
        if (updatedOrders) setProfitPaymentOrders(updatedOrders);
      },
      onIslrWithholdingsChange: async () => {
        console.log('⚡ [Realtime] Recargando comprobantes ISLR...');
        const updatedWithholdings = await getSupabaseProfitIslrWithholdings();
        if (updatedWithholdings) setProfitIslrWithholdings(updatedWithholdings);
      },
      onAuditTrailsChange: async () => {
        console.log('⚡ [Realtime] Recargando pistas de auditoría forense...');
        const updatedTrails = await getSupabaseProfitAuditTrails();
        if (updatedTrails) setProfitAuditTrails(updatedTrails);
      },
      onSalesChange: async () => {
        console.log('⚡ [Realtime] Recargando ventas Supabase...');
        const updatedSales = await getSupabaseSales();
        if (updatedSales) setSalesState(filterOutDeletedCxcDocs(updatedSales));
      },
      onCashMovementsChange: async () => {
        console.log('⚡ [Realtime] Recargando movimientos de caja Supabase...');
        const updatedCash = await getSupabaseCashMovements();
        if (updatedCash) setCashMovementsState(updatedCash);
      },
      onFiscalClosuresChange: async () => {
        console.log('⚡ [Realtime] Recargando cierres fiscales Supabase...');
        const updatedClosures = await getSupabaseFiscalClosures();
        if (updatedClosures) setFiscalClosures(updatedClosures);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Función para forzar sincronización y recarga inmediata desde Supabase
  const handleSyncProfit = async () => {
    try {
      // 0. Empujar primero operaciones locales pendientes para evitar sobrescribirlas al recargar
      if (getPendingSyncCount() > 0) {
        await flushSyncQueue().catch(() => {});
      }
      // 1. Recargar inmediatamente los datos más recientes desde Supabase
      const [
        latestProds, latestClis, latestOrds, latestBnks, latestCobs, latestFacs, latestSales,
        latestSups, latestPurs, latestCxp, latestPays, latestSellers, latestZones, latestTrans,
        latestReturns, latestAju, latestTra, latestIslr, latestBen, latestOrders, latestWithholdings,
        latestTrails, latestWarehouses, latestLines, latestCategories, latestCurrs,
        latestIncExp, latestSettlements, latestExpenses, latestEmployees, latestPayroll,
        latestCashDesks, latestCashMovements
      ] = await Promise.all([
        getSupabaseProducts(),
        getSupabaseClients(),
        getSupabaseOrders(),
        getSupabaseProfitBankAccounts(),
        getSupabaseProfitCollections(),
        getSupabaseProfitInvoices(),
        getSupabaseSales(),
        getSupabaseProfitSuppliers(),
        getSupabaseProfitPurchases(),
        getSupabaseProfitAccountsPayable(),
        getSupabaseProfitSupplierPayments(),
        getSupabaseProfitSellers(),
        getSupabaseProfitZones(),
        getSupabaseProfitTransports(),
        getSupabaseProfitReturns(),
        getSupabaseProfitInventoryAdjustments(),
        getSupabaseProfitWarehouseTransfers(),
        getSupabaseProfitIslrConcepts(),
        getSupabaseProfitBeneficiaries(),
        getSupabaseProfitPaymentOrdersMerged(),
        getSupabaseProfitIslrWithholdings(),
        getSupabaseProfitAuditTrails(),
        getSupabaseProfitWarehouses(),
        getSupabaseProfitProductLines(),
        getSupabaseProfitProductCategories(),
        getSupabaseProfitCurrencies(),
        getSupabaseProfitIncomeExpenseAccounts(),
        getSupabaseCommissionSettlements(),
        getSupabaseExpenses(),
        getSupabaseEmployees(),
        getSupabasePayroll(),
        getSupabaseProfitCashDesks(),
        getSupabaseCashMovements()
      ]);
      if (latestProds && latestProds.length > 0) setProductsState(latestProds);
      if (latestClis && latestClis.length > 0) setClientsState(latestClis);
      if (latestOrds) setOrdersState(latestOrds);
      if (latestBnks) setProfitBankAccounts(latestBnks);
      if (latestCobs) setProfitCollections(latestCobs);
      if (latestFacs) setProfitInvoices(filterOutDeletedCxcDocs(latestFacs));
      if (latestSales) setSalesState(filterOutDeletedCxcDocs(latestSales));
      if (latestSups) setProfitSuppliers(latestSups);
      if (latestPurs) setProfitPurchases(latestPurs);
      if (latestCxp) setProfitAccountsPayable(latestCxp);
      if (latestPays) setProfitSupplierPayments(latestPays);
      if (latestSellers) setProfitSellers(latestSellers);
      if (latestZones) setProfitZones(latestZones);
      if (latestTrans) setProfitTransports(latestTrans);
      if (latestReturns) setProfitReturns(latestReturns);
      if (latestAju) setProfitInventoryAdjustments(latestAju);
      if (latestTra) setProfitWarehouseTransfers(latestTra);
      if (latestIslr) setProfitIslrConcepts(latestIslr);
      if (latestBen) setProfitBeneficiaries(latestBen);
      if (latestOrders) setProfitPaymentOrders(latestOrders);
      if (latestWithholdings) setProfitIslrWithholdings(latestWithholdings);
      if (latestTrails) setProfitAuditTrails(latestTrails);
      if (latestWarehouses) setProfitWarehouses(latestWarehouses);
      if (latestLines) setProfitProductLines(latestLines);
      if (latestCategories) setProfitProductCategories(latestCategories);
      if (latestCurrs) setProfitCurrencies(latestCurrs);
      if (latestIncExp) setProfitIncomeExpenseAccounts(latestIncExp);
      if (latestSettlements) setCommissionSettlements(latestSettlements);
      if (latestExpenses) setExpensesState(latestExpenses);
      if (latestEmployees) setEmployeesState(latestEmployees);
      if (latestPayroll) setPayrollState(latestPayroll);
      if (latestCashDesks) setProfitCashDesks(latestCashDesks);
      if (latestCashMovements) setCashMovementsState(dedupeCashMovements(latestCashMovements));
      return true;
    } catch (err) {
      console.warn('Sync Profit feedback:', err.message);
      return false;
    }
  };


  // Actualizar Tasa del Dólar BCV
  const handleUpdateTasa = async (nuevaTasa) => {
    try {
      const updatedConfig = await updateSupabaseConfig({ tasaDolar: nuevaTasa });
      setConfigState(updatedConfig);
      notify.success(`Tasa BCV actualizada exitosamente a ${nuevaTasa} Bs./USD`);
    } catch (err) {
      console.error(err);
      notify.error("Error actualizando la tasa en Supabase");
    }
  };

  // Actualizar Tasa Keystone
  const handleUpdateTasaKeystone = async (nuevaTasa) => {
    try {
      const updatedConfig = await updateSupabaseConfig({ tasaKeystone: nuevaTasa });
      setConfigState(updatedConfig);
      notify.success(`Tasa Keystone actualizada exitosamente a ${nuevaTasa} Bs./USD`);
    } catch (err) {
      console.error(err);
      notify.error("Error actualizando la tasa Keystone en Supabase");
    }
  };

  // Actualizar Configuración General de Toda la Aplicación
  const handleSaveConfig = async (newConfigData) => {
    try {
      const updatedConfig = await updateSupabaseConfig(newConfigData);
      setConfigState(updatedConfig);
      notify.success("Configuración general guardada exitosamente");
      return updatedConfig;
    } catch (err) {
      console.error('Error guardando configuración:', err);
      notify.error("Error al guardar la configuración en el servidor");
      throw err;
    }
  };

  // Guardar / Editar Producto
  const handleSaveProduct = async (productData) => {
    try {
      const saved = await saveSupabaseProduct(productData);
      setProductsState(prev => {
        const index = prev.findIndex(p =>
          (saved.id && p.id === saved.id) ||
          (saved.codigo && p.codigo === saved.codigo)
        );
        let updated;
        if (index >= 0) {
          updated = [...prev];
          updated[index] = saved;
        } else {
          updated = [...prev, saved];
        }
        return updated.sort((a, b) =>
          String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
        );
      });
      broadcastReconcileChange({
        tableId: 'products',
        action: 'RECONCILE',
        key: saved.codigo || saved.id,
        item: saved
      });
      notify.success(`Producto "${saved.nombre || saved.descripcion || saved.codigo}" guardado en inventario.`);
      return saved;
    } catch (err) {
      console.error(err);
      notify.error("Error al guardar el lubricante en la base de datos");
      throw err;
    }
  };

  // Eliminar Producto
  const handleDeleteProduct = async (id) => {
    const confirmed = await notify.confirm({
      title: '¿Eliminar Lubricante?',
      message: '¿Está seguro de eliminar este lubricante del inventario de forma permanente?',
      confirmText: 'Sí, Eliminar Lubricante',
      cancelText: 'Cancelar',
      isDestructive: true
    });
    if (!confirmed) return;

    try {
      const targetId = String(id).trim();
      await deleteSupabaseProduct(targetId);
      setProductsState(prev => prev.filter(p =>
        String(p.id).trim() !== targetId &&
        String(p.codigo || '').trim() !== targetId
      ));
      broadcastReconcileChange({
        tableId: 'products',
        action: 'DELETE',
        key: targetId
      });
      notify.success("Lubricante eliminado del inventario correctamente");
    } catch (err) {
      console.error(err);
      notify.error("Error al eliminar el lubricante de la base de datos");
    }
  };

  // Guardar / Actualizar Cliente (soporta flujo de aprobación desde vendedores -> Caja Principal)
  const handleSaveClient = async (clientData) => {
    try {
      const userCanApprove = canApproveClients(currentUser);
      const nowIso = new Date().toISOString();
      const incomingStatus = getClientApprovalStatus(clientData);
      const isPendingSubmission = !userCanApprove || incomingStatus === 'PENDIENTE';

      const normalizedPayload = {
        ...clientData,
        estadoAprobacion: userCanApprove ? (clientData.estadoAprobacion || 'APROBADO') : 'PENDIENTE',
        inactivo: userCanApprove
          ? (incomingStatus === 'RECHAZADO' ? true : Boolean(clientData.inactivo))
          : true,
        limiteCreditoUsd: userCanApprove ? Number(clientData.limiteCreditoUsd || 0) : 0,
        diasCredito: userCanApprove ? Number(clientData.diasCredito || 0) : 0,
        solicitadoPor: clientData.solicitadoPor || currentUser?.nombre || currentUser?.username || 'Operador',
        solicitadoPorUsername: clientData.solicitadoPorUsername || currentUser?.username || '',
        fechaSolicitud: clientData.fechaSolicitud || nowIso,
        aprobadoPor: userCanApprove ? (clientData.aprobadoPor || currentUser?.nombre || currentUser?.username || '') : '',
        aprobadoPorUsername: userCanApprove ? (clientData.aprobadoPorUsername || currentUser?.username || '') : '',
        fechaAprobacion: userCanApprove ? (clientData.fechaAprobacion || nowIso) : null
      };

      const saved = await saveSupabaseClient(normalizedPayload);
      setClientsState(prev => {
        const index = prev.findIndex(c => c.id === saved.id || (saved.codigo && c.codigo === saved.codigo));
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = saved;
          return updated;
        } else {
          return [saved, ...prev];
        }
      });

      if (isPendingSubmission && !userCanApprove) {
        notify.success(`Solicitud enviada: "${saved.nombre || saved.rif}" espera aprobación de Caja Principal (Vanessa).`);
        saveSupabaseNotification({
          tipo: 'clientes',
          severidad: 'advertencia',
          modulo: 'ventas',
          titulo: `Nuevo cliente por aprobar: ${saved.nombre || saved.rif}`,
          mensaje: `${normalizedPayload.solicitadoPor} envió el cliente ${saved.nombre} (${saved.rif}) para aprobación en Caja Principal.`,
          destinatario_rol: 'CAJA',
          destinatario_usuario: 'caja',
          origen: 'PREVENTA',
          metadata: { clientId: saved.id, rif: saved.rif }
        }).catch(() => {});
      } else {
        notify.success(`Cliente "${saved.nombre || saved.rif}" guardado exitosamente.`);
      }

      logUserActivity({
        usuarioId: currentUser?.id || 'system',
        usuarioNombre: currentUser?.nombre || 'Operador',
        usuarioRol: currentUser?.rol || 'SISTEMA',
        accion: isPendingSubmission && !userCanApprove ? 'SOLICITAR_CLIENTE' : 'GUARDAR_CLIENTE',
        modulo: 'CLIENTES',
        detalles: `${saved.nombre} (${saved.rif}) - Estado: ${saved.estadoAprobacion || 'APROBADO'}`
      }).catch(() => {});

      return saved;
    } catch (err) {
      console.error(err);
      notify.error("Error al guardar los datos del cliente");
    }
  };

  // Aprobar Cliente Pendiente (Vanessa en Caja, Rosibel en Cobranzas, Yheyson, Manuel, Edson)
  const handleApproveClient = async (client, overrides = {}) => {
    if (!canApproveClients(currentUser)) {
      notify.error('No tienes permisos para aprobar nuevos clientes.');
      return null;
    }
    try {
      const nowIso = new Date().toISOString();
      const updatedPayload = {
        ...client,
        ...overrides,
        limiteCreditoUsd: Number(overrides.limiteCreditoUsd ?? client.limiteCreditoUsd ?? 0),
        diasCredito: Number(overrides.diasCredito ?? client.diasCredito ?? 0),
        estadoAprobacion: 'APROBADO',
        inactivo: false,
        aprobadoPor: currentUser?.nombre || currentUser?.username || 'Caja Principal',
        aprobadoPorUsername: currentUser?.username || '',
        fechaAprobacion: nowIso,
        motivoRechazo: ''
      };
      const saved = await saveSupabaseClient(updatedPayload);
      setClientsState(prev => {
        const index = prev.findIndex(c => c.id === saved.id || (saved.codigo && c.codigo === saved.codigo));
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = saved;
          return updated;
        }
        return [saved, ...prev];
      });
      notify.success(`Cliente "${saved.nombre || saved.rif}" aprobado y habilitado para pedidos/facturación.`);

      saveSupabaseNotification({
        tipo: 'clientes',
        severidad: 'exito',
        modulo: 'preventa',
        titulo: `Cliente aprobado: ${saved.nombre || saved.rif}`,
        mensaje: `${updatedPayload.aprobadoPor} aprobó al cliente ${saved.nombre} (${saved.rif}). Ya puede recibir pedidos.`,
        destinatario_rol: 'VENTAS',
        destinatario_usuario: saved.solicitadoPorUsername || 'ALL',
        origen: 'CAJA',
        metadata: { clientId: saved.id, rif: saved.rif }
      }).catch(() => {});

      logUserActivity({
        usuarioId: currentUser?.id || 'system',
        usuarioNombre: currentUser?.nombre || 'Caja Principal',
        usuarioRol: currentUser?.rol || 'CAJA',
        accion: 'APROBAR_CLIENTE',
        modulo: 'CLIENTES',
        detalles: `Aprobado cliente ${saved.nombre} (${saved.rif})`
      }).catch(() => {});

      return saved;
    } catch (err) {
      console.error(err);
      notify.error('Error al aprobar el cliente');
      return null;
    }
  };

  // Rechazar Solicitud de Cliente
  const handleRejectClient = async (client, motivo = '') => {
    if (!canApproveClients(currentUser)) {
      notify.error('No tienes permisos para rechazar solicitudes de clientes.');
      return null;
    }
    try {
      const nowIso = new Date().toISOString();
      const updatedPayload = {
        ...client,
        estadoAprobacion: 'RECHAZADO',
        inactivo: true,
        aprobadoPor: currentUser?.nombre || currentUser?.username || 'Caja Principal',
        aprobadoPorUsername: currentUser?.username || '',
        fechaAprobacion: nowIso,
        motivoRechazo: motivo || 'Solicitud rechazada por Caja Principal'
      };
      const saved = await saveSupabaseClient(updatedPayload);
      setClientsState(prev => {
        const index = prev.findIndex(c => c.id === saved.id || (saved.codigo && c.codigo === saved.codigo));
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = saved;
          return updated;
        }
        return [saved, ...prev];
      });
      notify.warning(`Solicitud de "${saved.nombre || saved.rif}" rechazada.`);

      saveSupabaseNotification({
        tipo: 'clientes',
        severidad: 'advertencia',
        modulo: 'preventa',
        titulo: `Solicitud de cliente rechazada: ${saved.nombre || saved.rif}`,
        mensaje: `${updatedPayload.aprobadoPor} rechazó el registro de ${saved.nombre}. Motivo: ${updatedPayload.motivoRechazo}`,
        destinatario_rol: 'VENTAS',
        destinatario_usuario: saved.solicitadoPorUsername || 'ALL',
        origen: 'CAJA',
        metadata: { clientId: saved.id, rif: saved.rif }
      }).catch(() => {});

      logUserActivity({
        usuarioId: currentUser?.id || 'system',
        usuarioNombre: currentUser?.nombre || 'Caja Principal',
        usuarioRol: currentUser?.rol || 'CAJA',
        accion: 'RECHAZAR_CLIENTE',
        modulo: 'CLIENTES',
        detalles: `Rechazado cliente ${saved.nombre} (${saved.rif}): ${updatedPayload.motivoRechazo}`
      }).catch(() => {});

      return saved;
    } catch (err) {
      console.error(err);
      notify.error('Error al rechazar la solicitud del cliente');
      return null;
    }
  };

  // Eliminar Cliente
  const handleDeleteClient = async (id, options = {}) => {
    if (!options?.skipConfirm) {
      const confirmed = await notify.confirm({
        title: '¿Eliminar Cliente?',
        message: '¿Está seguro de eliminar o desactivar este cliente de la cartera comercial y de Supabase?',
        confirmText: 'Sí, Eliminar Cliente',
        cancelText: 'Cancelar',
        isDestructive: true
      });
      if (!confirmed) return false;
    }

    try {
      const targetClient = clients.find(c => c.id === id || c.codigo === id || c.rif === id);
      await deleteSupabaseClient(id);
      setClientsState(prev => prev.filter(c => c.id !== id && c.codigo !== id && c.rif !== id));
      notify.success(`Cliente "${targetClient?.nombre || id}" eliminado de la cartera correctamente`);

      logUserActivity({
        usuarioId: currentUser?.id || 'system',
        usuarioNombre: currentUser?.nombre || currentUser?.username || 'Operador',
        usuarioRol: currentUser?.rol || 'OPERADOR',
        accion: 'ELIMINAR_CLIENTE',
        modulo: 'CLIENTES',
        detalles: `Eliminado cliente ${targetClient?.nombre || ''} (${targetClient?.rif || id})`
      }).catch(() => {});

      return true;
    } catch (err) {
      console.error(err);
      notify.error("Error al eliminar el cliente de la base de datos");
      return false;
    }
  };

  // Procesar Venta / POS
  const handleProcessSale = async (saleData) => {
    try {
      const newSale = await processSupabaseSale(saleData);

      // Asegurar incorporación inmediata de la nueva venta en sales y profitInvoices sin re-descargar 5 tablas completas
      if (newSale && (newSale.id || newSale.numeroDoc)) {
        const newCanonKey = getEraScopedCanonicalDocKey(newSale);
        const sKey = String(newSale.numeroDoc || newSale.id || '').trim();
        setSalesState(prev => {
          const idx = prev.findIndex(s =>
            (newCanonKey && getEraScopedCanonicalDocKey(s) === newCanonKey) ||
            String(s.id || '').trim() === String(newSale.id || '').trim() ||
            (sKey && String(s.numeroDoc || '').trim() === sKey && String(s.tipoDoc || 'FACTURA') === String(newSale.tipoDoc || 'FACTURA'))
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...newSale };
            return next;
          }
          return [newSale, ...prev];
        });

        const tipoUpper = String(newSale.tipoDoc || 'FACTURA').toUpperCase().trim();
        if (tipoUpper !== 'NOTA_CREDITO' && tipoUpper !== 'COTIZACION') {
          const isNeDoc = tipoUpper === 'NOTA_ENTREGA';
          const netoUsd = isNeDoc ? Number(newSale.subtotalUsd || newSale.totalUsd || 0) : Number(newSale.totalUsd || 0);
          const estadoUpper = String(newSale.estado || '').toUpperCase().trim();
          const isSettledSale = estadoUpper === 'PAGADO' || estadoUpper === 'PAGADA' || estadoUpper === 'COBRADA';
          const goesToReceivables = !isSettledSale && (
            Number(newSale.diasCredito || 0) > 0 ||
            estadoUpper === 'PENDIENTE' ||
            tipoUpper === 'FACTURA' ||
            tipoUpper === 'NOTA_ENTREGA'
          );
          const saldoVal = goesToReceivables
            ? Number(newSale.saldoUsd !== undefined && Number(newSale.saldoUsd) > 0 ? newSale.saldoUsd : netoUsd)
            : 0;
          const resolvedSellerObj = (profitSellers || []).find(s =>
            matchesSeller(s, saleData.vendedorId || saleData.vendedorCoVen || newSale.vendedor || '')
          );
          const resolvedVendedorId =
            saleData.vendedorCoVen ||
            resolvedSellerObj?.coVen ||
            resolvedSellerObj?.co_ven ||
            saleData.vendedorId ||
            'OF';
          const resolvedLitros = resolveInvoiceLitros({ ...saleData, items: newSale.items || saleData.items || [] });
          const resolvedCajas = resolveInvoiceCajas({ ...saleData, items: newSale.items || saleData.items || [] });
          const previewInv = {
            id: newSale.id,
            factNum: newSale.numeroDoc,
            numeroDoc: newSale.numeroDoc,
            numeroControl: newSale.numeroControl,
            tipoDoc: newSale.tipoDoc,
            condicionPago: newSale.condicionPago,
            clienteId: newSale.clienteId,
            clienteNombre: newSale.clienteNombre,
            clienteRif: newSale.clienteRif,
            vendedorId: resolvedVendedorId,
            vendedorNombre: newSale.vendedor || resolvedSellerObj?.venDes || resolvedSellerObj?.nombre || '',
            totBrutoUsd: newSale.subtotalUsd,
            ivaUsd: isNeDoc ? 0 : newSale.ivaUsd,
            totNetoUsd: netoUsd,
            saldoUsd: saldoVal,
            abonosUsd: Math.max(0, Number((netoUsd - saldoVal).toFixed(2))),
            diasCredito: newSale.diasCredito || 0,
            fechaEmision: newSale.fechaEmision || newSale.fecha,
            fechaVencimiento: newSale.fechaVencimiento || newSale.fechaEmision || newSale.fecha,
            fechaUltimoCobro: saldoVal <= 0.01 ? (newSale.fechaEmision || newSale.fecha) : null,
            totalLitros: resolvedLitros,
            totalCajas: resolvedCajas,
            tasa: newSale.tasaDolar,
            status: saldoVal <= 0.01 ? 'COBRADA' : 'PENDIENTE',
            items: newSale.items || []
          };
          setProfitInvoices(prev => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex(p =>
              (newCanonKey && getEraScopedCanonicalDocKey(p) === newCanonKey) ||
              String(p.id || '').trim() === String(previewInv.id || '').trim()
            );
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...previewInv };
              return list;
            }
            return [previewInv, ...list];
          });
        }

        // Facturas y Notas de Entrega (incluso de contado) pasan a CxC; no ingresan directo a Caja/Banco al emitirse
        const isCredSale = Number(newSale.diasCredito || saleData.diasCredito || 0) > 0
          || String(newSale.condicionPago || saleData.condicionPago || '').toUpperCase().includes('CREDITO')
          || String(newSale.estado || '').toUpperCase() === 'PENDIENTE';
        if (
          !isCredSale &&
          tipoUpper !== 'FACTURA' &&
          tipoUpper !== 'NOTA_ENTREGA' &&
          tipoUpper !== 'NOTA_CREDITO' &&
          tipoUpper !== 'COTIZACION'
        ) {
          try {
            const targetAccount = saleData.selectedAccount
              || saleData.cuentaDestino
              || resolveTreasuryTargetForPaymentMethod(
                newSale.metodoPago || saleData.metodoPago,
                profitCashDesksRef.current,
                profitBankAccountsRef.current
              )?.accountRef;
            if (targetAccount) {
              const deltaUsd = Number((newSale.totalUsd ?? saleData.totalUsd ?? 0).toFixed(2));
              const deltaBs = Number((newSale.totalBs ?? saleData.totalBs ?? 0).toFixed(2));
              await applyTreasuryAccountDelta({
                account: targetAccount,
                deltaUsd,
                deltaBs,
                clampZero: false
              });
            }
            const refreshedMovs = await getSupabaseCashMovements();
            if (Array.isArray(refreshedMovs)) {
              setCashMovementsState([...refreshedMovs]);
            }
          } catch (treasuryErr) {
            console.warn('[handleProcessSale] No se pudo actualizar tesorería para venta contado:', treasuryErr);
          }
        }

        if (newSale._offlineQueued) {
          notify.warning(`Factura #${newSale.numeroDoc || newSale.id} guardada localmente en modo contingencia y encolada para subir al servidor.`);
        }
      }

      // Si la venta se originó de una Nota de Pedido de Preventa:
      // Conservar el pedido y marcarlo como FACTURADO con los totales reales (evita borrar órdenes desde POS).
      const originOrderId = saleData.pedidoOrigenId || saleData.pedidoOrigenDoc;
      if (originOrderId && (!saleData.preserveOriginOrderOnSale || saleData.markOriginOrderBilled)) {
        try {
          const existingOrder = (orders || []).find(o =>
            o &&
            (o.id === originOrderId ||
              o.numeroDoc === originOrderId ||
              (saleData.pedidoOrigenId && o.id === saleData.pedidoOrigenId) ||
              (saleData.pedidoOrigenDoc && (o.numeroDoc === saleData.pedidoOrigenDoc || o.id === saleData.pedidoOrigenDoc)))
          );
          if (existingOrder) {
            const billedOrder = {
              ...existingOrder,
              status: 'FACTURADO',
              estado: 'FACTURADO',
              nroFactura: newSale?.numeroDoc || saleData.numeroDoc || existingOrder.nroFactura,
              nro_factura: newSale?.numeroDoc || saleData.numeroDoc || existingOrder.nro_factura,
              facturaId: newSale?.id || existingOrder.facturaId,
              factura_id: newSale?.id || existingOrder.factura_id,
              fechaFactura: newSale?.fechaEmision || newSale?.fecha || new Date().toISOString(),
              fecha_factura: newSale?.fechaEmision || newSale?.fecha || new Date().toISOString(),
              metodoPagoFactura: newSale?.metodoPago || saleData.metodoPago,
              totalBrutoUsd: newSale?.subtotalUsd ?? saleData.subtotalUsd ?? existingOrder.totalBrutoUsd,
              ivaUsd: newSale?.ivaUsd ?? saleData.ivaUsd ?? existingOrder.ivaUsd,
              igtfUsd: newSale?.igtfUsd ?? saleData.igtfUsd ?? existingOrder.igtfUsd,
              totalNetoUsd: newSale?.totalUsd ?? saleData.totalUsd ?? existingOrder.totalNetoUsd,
              totalUsd: newSale?.totalUsd ?? saleData.totalUsd ?? existingOrder.totalUsd,
              saldoUsd: newSale?.saldoUsd ?? saleData.saldoUsd ?? existingOrder.saldoUsd
            };
            await saveSupabaseOrder(billedOrder, { skipStockValidation: true });
            setOrdersState(prev =>
              prev.map(o => (o.id === existingOrder.id ? billedOrder : o))
            );
          } else if (saleData.deleteOriginOrderOnSale) {
            await deleteSupabaseOrder(originOrderId);
          }
        } catch (statusErr) {
          console.warn('[handleProcessSale] Error actualizando orden origen a FACTURADO:', statusErr);
        }
      }

      // Refrescar inventario en pantalla tras descuento de Almacén 01 / Almacén 02
      if (!saleData.skipStockAdjustment) {
        try {
          const updatedProds = await getSupabaseProducts();
          if (Array.isArray(updatedProds) && updatedProds.length > 0) {
            setProductsState(updatedProds);
          }
        } catch (_) {}
      }

      return newSale;
    } catch (err) {
      console.error(err);
      if (err && typeof err === 'object') err._notifiedByApp = true;
      notify.error(err?.isValidationError ? err.message : "Error al procesar la venta en el servidor");
      throw err;
    }
  };

  // Registrar Compra y Generar Cuenta por Pagar (CxP)
  const handleRegisterPurchase = async (purchaseData) => {
    try {
      const created = await saveSupabasePurchase(purchaseData);
      setPurchasesState((prev) => [created, ...prev]);
      const updatedProds = await getSupabaseProducts();
      setProductsState(updatedProds);

      const rawNum = String(purchaseData.numeroFacturaProv || purchaseData.numeroControl || created?.id || '').trim();
      const tipoDocRaw = String(purchaseData.tipoDoc || 'FACTURA').toUpperCase();
      let tipoDocCxp = 'FACT';
      if (tipoDocRaw === 'NOTA_CREDITO') tipoDocCxp = 'N/CR';
      else if (tipoDocRaw === 'NOTA_DEBITO') tipoDocCxp = 'N/DB';

      const provRif = String(purchaseData.proveedorRif || 'J-00000000').trim().toUpperCase();
      const provNombre = String(purchaseData.proveedorNombre || 'Proveedor General').trim();
      const tasaDolar = Number(purchaseData.tasaDolar || config?.tasaDolar || 1);

      const totalFacturaUsd = Number(purchaseData.totalUsd || 0);
      const retIvaUsd = Number(purchaseData.retencionIvaUsd || 0);
      const retIslrUsd = Number(purchaseData.retencionIslrUsd || 0);
      const netoPagarUsd = purchaseData.montoNetoPagarUsd !== undefined
        ? Number(purchaseData.montoNetoPagarUsd)
        : Math.max(0, Number((totalFacturaUsd - retIvaUsd - retIslrUsd).toFixed(2)));

      const isContado = purchaseData.condicionPago === 'CONTADO';
      const diasCredito = isContado ? 0 : Math.max(0, Number(purchaseData.diasCredito ?? 15));

      const fechaEmision = purchaseData.fecha ? purchaseData.fecha.split('T')[0] : new Date().toISOString().split('T')[0];
      const emisionDate = new Date(fechaEmision);
      const vencDate = new Date(emisionDate);
      vencDate.setDate(vencDate.getDate() + diasCredito);
      const fechaVencimiento = vencDate.toISOString().split('T')[0];

      const saldoUsd = isContado ? 0 : netoPagarUsd;
      const saldoBs = Number((saldoUsd * tasaDolar).toFixed(2));
      const abonosUsd = isContado ? netoPagarUsd : 0;
      const montoNetBs = Number((netoPagarUsd * tasaDolar).toFixed(2));

      // 1. Integración automática a Cuentas por Pagar (CxP)
      let cxpSavedOk = true;
      try {
        const payablePayload = {
          id: `DOC-CP-${tipoDocCxp}-${rawNum}-${provRif.replace(/[^A-Za-z0-9]/g, '')}`,
          tipoDoc: tipoDocCxp,
          nroDoc: rawNum,
          coProv: provRif,
          provNombre,
          provRif,
          fechaEmision,
          fechaVencimiento,
          diasCredito,
          montoNetUsd: netoPagarUsd,
          montoNetBs,
          saldoUsd: tipoDocRaw === 'NOTA_CREDITO' && purchaseData.documentoAfectado ? 0 : saldoUsd,
          saldoBs: tipoDocRaw === 'NOTA_CREDITO' && purchaseData.documentoAfectado ? 0 : saldoBs,
          abonosUsd: tipoDocRaw === 'NOTA_CREDITO' && purchaseData.documentoAfectado ? netoPagarUsd : abonosUsd,
          tasa: tasaDolar,
          moneda: 'US$',
          observaciones: `Compra ${tipoDocRaw} #${rawNum} - ${purchaseData.producto || ''} (${purchaseData.cantidad || 0} unid.)`,
          historialPagos: []
        };

        await handleSaveCxpDocument(payablePayload);

        // Si es Nota de Crédito y afecta una factura específica, descontar el saldo de la factura afectada
        if (tipoDocRaw === 'NOTA_CREDITO' && purchaseData.documentoAfectado) {
          const affNum = String(purchaseData.documentoAfectado).trim().toUpperCase();
          setProfitAccountsPayable(prevList => {
            const list = Array.isArray(prevList) ? [...prevList] : [];
            const idx = list.findIndex(p =>
              doesPayableMatchDocument(p, {
                id: purchaseData.documentoAfectado,
                nroDoc: affNum,
                tipoDoc: 'FACT',
                provRif,
                coProv: provRif,
                provNombre
              })
            );
            if (idx >= 0) {
              const currentDoc = list[idx];
              const nuevoSaldo = Math.max(0, Number(((currentDoc.saldoUsd || 0) - netoPagarUsd).toFixed(2)));
              const nuevoAbonos = Number(((currentDoc.abonosUsd || 0) + netoPagarUsd).toFixed(2));
              const updatedDoc = {
                ...currentDoc,
                saldoUsd: nuevoSaldo,
                saldoBs: Number((nuevoSaldo * (currentDoc.tasa || tasaDolar)).toFixed(2)),
                abonosUsd: nuevoAbonos,
                observaciones: `${currentDoc.observaciones || ''} | Afectada por NC #${rawNum} (-$${netoPagarUsd})`.trim()
              };
              saveSupabaseProfitAccountsPayable(updatedDoc).catch(() => {});
              list[idx] = updatedDoc;
            }
            return list;
          });
        }
      } catch (cxpErr) {
        cxpSavedOk = false;
        console.warn('[handleRegisterPurchase] Error al registrar documento CxP:', cxpErr);
        notify.warning(`La compra se guardó, pero hubo un problema generando la Cuenta por Pagar (CxP): ${cxpErr?.message || ''}`);
      }

      // 2. Reflejar en profitPurchases para Libro Diario, reportes y vistas analíticas
      const mappedProfitItems = Array.isArray(purchaseData.items) && purchaseData.items.length > 0
        ? purchaseData.items.map((it, idx) => ({
            rengNum: idx + 1,
            articuloId: it.codigo || it.productoId || 'LUB-PROV',
            codigo: it.codigo || '',
            descripcion: it.descripcion || it.producto || 'Lubricante Proveedor',
            unidadVenta: 'Caja',
            cantidad: Number(it.cantidad || 0),
            litrosUnitarios: 1,
            litrosTotales: Number(it.cantidad || 0),
            precioUnitario: Number(it.costoUnitarioUsd || 0),
            fleteUsd: Number(it.fleteUsd || 0),
            almacen: String(it.almacen || purchaseData.almacen || '01').includes('02') ? '02' : '01',
            totalNeto: Number(it.subtotalUsd ?? (Number(it.cantidad || 0) * Number(it.costoUnitarioUsd || 0)))
          }))
        : [{
            rengNum: 1,
            articuloId: purchaseData.productoCodigo || purchaseData.producto || 'LUB-PROV',
            codigo: purchaseData.productoCodigo || '',
            descripcion: purchaseData.producto || 'Lubricante Proveedor',
            unidadVenta: 'Caja',
            cantidad: Number(purchaseData.cantidad || 0),
            litrosUnitarios: 1,
            litrosTotales: Number(purchaseData.cantidad || 0),
            precioUnitario: Number(purchaseData.costoUnitarioUsd || 0),
            fleteUsd: Number(purchaseData.fleteUsd || 0),
            almacen: String(purchaseData.almacen || '01').includes('02') ? '02' : '01',
            totalNeto: Number(purchaseData.subtotalUsd || 0)
          }];

      const nextProfitPurchase = {
        id: `COM-${Date.now().toString(36).toUpperCase()}`,
        factNum: rawNum || Date.now().toString().slice(-6),
        facturaProv: rawNum,
        tipoDoc: tipoDocRaw,
        documentoAfectado: purchaseData.documentoAfectado || '',
        almacen: String(purchaseData.almacen || '01').includes('02') ? '02' : '01',
        fleteUsd: Number(purchaseData.fleteUsd || 0),
        fechaEmision: purchaseData.fecha || new Date().toISOString(),
        fechaVencimiento: vencDate.toISOString(),
        coProv: provRif,
        provNombre,
        provRif,
        totBrutoUsd: Number(purchaseData.subtotalUsd || 0),
        totBrutoBs: Number(((purchaseData.subtotalUsd || 0) * tasaDolar).toFixed(2)),
        ivaUsd: Number((purchaseData.ivaGeneralUsd || purchaseData.ivaReducidaUsd || 0)),
        ivaBs: Number(((purchaseData.ivaGeneralUsd || purchaseData.ivaReducidaUsd || 0) * tasaDolar).toFixed(2)),
        totNetoUsd: totalFacturaUsd,
        totNetoBs: Number((totalFacturaUsd * tasaDolar).toFixed(2)),
        saldoUsd: tipoDocRaw === 'NOTA_CREDITO' ? 0 : saldoUsd,
        saldoBs: tipoDocRaw === 'NOTA_CREDITO' ? 0 : saldoBs,
        status: (tipoDocRaw === 'NOTA_CREDITO' || saldoUsd <= 0.01) ? 'PAGADA' : 'SALDO_PENDIENTE',
        anulada: false,
        formaPag: isContado ? '01' : '04',
        co_us_in: purchaseData.receptor || currentUser?.nombre || 'PROCURA',
        items: mappedProfitItems,
        fechaSincronizacion: new Date().toISOString()
      };
      setProfitPurchases(prev => [nextProfitPurchase, ...(Array.isArray(prev) ? prev : [])]);
      saveSupabaseProfitPurchase({
        ...nextProfitPurchase,
        fact_num: nextProfitPurchase.factNum,
        factura_prov: nextProfitPurchase.facturaProv,
        fec_emis: nextProfitPurchase.fechaEmision,
        fec_venc: nextProfitPurchase.fechaVencimiento,
        co_prov: nextProfitPurchase.coProv,
        prov_nombre: nextProfitPurchase.provNombre,
        prov_rif: nextProfitPurchase.provRif,
        tot_bruto_usd: nextProfitPurchase.totBrutoUsd,
        tot_bruto_bs: nextProfitPurchase.totBrutoBs,
        iva_usd: nextProfitPurchase.ivaUsd,
        iva_bs: nextProfitPurchase.ivaBs,
        tot_neto_usd: nextProfitPurchase.totNetoUsd,
        tot_neto_bs: nextProfitPurchase.totNetoBs,
        saldo_usd: nextProfitPurchase.saldoUsd,
        saldo_bs: nextProfitPurchase.saldoBs,
        forma_pag: nextProfitPurchase.formaPag,
        fecha_sincronizacion: nextProfitPurchase.fechaSincronizacion
      }).catch((err) => {
        console.warn('[handleRegisterPurchase] Error sincronizando profit_purchases:', err?.message || err);
      });

      // 3. Actualizar saldo pendiente del proveedor en cartera (suppliers + profitSuppliers)
      if (provRif && netoPagarUsd > 0) {
        const debtDelta = tipoDocRaw === 'NOTA_CREDITO' ? -netoPagarUsd : (isContado ? 0 : netoPagarUsd);
        if (debtDelta !== 0) {
          const matchesSup = (s) =>
            String(s?.rif || '').trim().toUpperCase() === provRif ||
            String(s?.coProv || s?.co_prov || '').trim().toUpperCase() === provRif ||
            (purchaseData.proveedorId && String(s?.id || '') === String(purchaseData.proveedorId));

          setSuppliersState(prev =>
            (Array.isArray(prev) ? prev : []).map(s => {
              if (!matchesSup(s)) return s;
              const currentDebt = Number(s.saldoPendienteUsd ?? s.saldo_pendiente_usd ?? 0);
              const newDebt = Math.max(0, Number((currentDebt + debtDelta).toFixed(2)));
              return { ...s, saldoPendienteUsd: newDebt, saldo_pendiente_usd: newDebt };
            })
          );
          setProfitSuppliers(prev =>
            (Array.isArray(prev) ? prev : []).map(s => {
              if (!matchesSup(s)) return s;
              const currentDebt = Number(s.saldoUsd ?? s.saldo_usd ?? 0);
              const newDebt = Math.max(0, Number((currentDebt + debtDelta).toFixed(2)));
              return { ...s, saldoUsd: newDebt, saldo_usd: newDebt };
            })
          );
        }
      }

      if (cxpSavedOk) {
        notify.success("Compra registrada y Cuenta por Pagar (CxP) generada exitosamente");
      }
      return created;
    } catch (err) {
      console.error("Error al registrar compra:", err);
      notify.error(err?.message || "Error al registrar la compra en el sistema");
      throw err;
    }
  };

  // Registrar Traslado entre Almacenes (Alm 01 <-> Alm 02)
  const handleSaveWarehouseTransfer = async (transferData) => {
    try {
      const saved = await saveSupabaseProfitWarehouseTransfer(transferData);
      setProfitWarehouseTransfers((prev) => [saved, ...(prev || []).filter(t => t.id !== saved.id)]);
      const updatedProds = await getSupabaseProducts();
      setProductsState(updatedProds);
      notify.success(`Traslado ${saved.trasNum || ''} procesado y stock actualizado`);
      return saved;
    } catch (err) {
      console.error('Error al procesar traslado:', err);
      notify.error(err?.message || 'Error al procesar el traslado entre almacenes');
      throw err;
    }
  };

  // Registrar Ajuste / Merma de Inventario
  const handleSaveInventoryAdjustment = async (adjData) => {
    try {
      const saved = await saveSupabaseProfitInventoryAdjustment(adjData);
      setProfitInventoryAdjustments((prev) => [saved, ...(prev || []).filter(a => a.id !== saved.id)]);
      const updatedProds = await getSupabaseProducts();
      setProductsState(updatedProds);
      notify.success(`Ajuste ${saved.ajueNum || ''} registrado correctamente`);
      return saved;
    } catch (err) {
      console.error('Error al registrar ajuste:', err);
      notify.error(err?.message || 'Error al registrar el ajuste de inventario');
      throw err;
    }
  };

  // Registrar Devolución de Cliente / Nota de Crédito
  const handleSaveCustomerReturn = async (retData) => {
    try {
      const saved = await saveSupabaseProfitCustomerReturn(retData);
      setProfitReturns((prev) => [saved, ...(prev || []).filter(r => r.id !== saved.id)]);
      if (retData.reenterStock !== false) {
        const updatedProds = await getSupabaseProducts();
        setProductsState(updatedProds);
      }
      notify.success(`Devolución / NC ${saved.ncNum || ''} registrada`);
      return saved;
    } catch (err) {
      console.error('Error al registrar devolución:', err);
      notify.error('Error al registrar la devolución de cliente');
      throw err;
    }
  };

  // Guardar Requisición de Compra (REQ)
  const handleSavePurchaseRequisition = async (reqData) => {
    try {
      const saved = await saveSupabasePurchaseRequisition(reqData);
      setPurchaseRequisitions((prev) => [saved, ...(prev || []).filter(r => r.id !== saved.id)]);
      notify.success(`Requisición ${saved.numeroDoc || ''} guardada`);
      return saved;
    } catch (err) {
      console.error('Error guardando requisición:', err);
      notify.error('Error al guardar la requisición de compra');
      throw err;
    }
  };

  // Guardar Orden de Compra (OC)
  const handleSavePurchaseOrder = async (poData) => {
    try {
      const saved = await saveSupabasePurchaseOrder(poData);
      setPurchaseOrders((prev) => [saved, ...(prev || []).filter(o => o.id !== saved.id)]);
      notify.success(`Orden de Compra ${saved.numeroDoc || ''} emitida`);
      return saved;
    } catch (err) {
      console.error('Error guardando orden de compra:', err);
      notify.error('Error al guardar la orden de compra');
      throw err;
    }
  };

  // Registrar Nota de Recepción de Mercancía (REC)
  const handleSaveGoodsReceiptNote = async (recData) => {
    try {
      const saved = await saveSupabaseGoodsReceiptNote(recData);
      setGoodsReceiptNotes((prev) => [saved, ...(prev || []).filter(r => r.id !== saved.id)]);
      if (recData.applyStock !== false) {
        const updatedProds = await getSupabaseProducts();
        setProductsState(updatedProds);
      }
      notify.success(`Nota de Recepción ${saved.numeroDoc || ''} registrada`);
      return saved;
    } catch (err) {
      console.error('Error guardando recepción:', err);
      notify.error('Error al registrar la nota de recepción');
      throw err;
    }
  };

  // Guardar Orden de Pago (OP)
  const handleSavePaymentOrder = async (opData) => {
    try {
      const saved = await saveSupabaseProfitPaymentOrder(opData);
      setProfitPaymentOrders((prev) => [saved, ...(prev || []).filter(o => o.id !== saved.id)]);
      notify.success(`Orden de Pago ${saved.ordNum || ''} registrada`);
      return saved;
    } catch (err) {
      console.error('Error guardando orden de pago:', err);
      notify.error('Error al guardar la orden de pago');
      throw err;
    }
  };

  // Agregar Movimiento de Caja
  const handleAddCashMovement = async (mov) => {
    try {
      await addSupabaseCashMovement(mov);
      const updatedMovs = await getSupabaseCashMovements();
      setCashMovementsState([...updatedMovs]);
      notify.success("Movimiento registrado en caja chica correctamente");
    } catch (err) {
      console.error(err);
      notify.error("Error al registrar el movimiento en la caja chica");
      throw err;
    }
  };

  // Editar Movimiento de Caja y ajustar diferencial neto en caja/banco
  const handleUpdateCashMovement = async (prevMov, nextMovData) => {
    try {
      const targetMov = nextMovData && typeof nextMovData === 'object' ? nextMovData : prevMov;
      if (!targetMov || !targetMov.id) {
        notify.warning('No se identificó el movimiento a actualizar');
        return null;
      }

      const desksList = Array.isArray(profitCashDesksRef.current) && profitCashDesksRef.current.length > 0
        ? profitCashDesksRef.current
        : profitCashDesks;
      const banksList = Array.isArray(profitBankAccountsRef.current) && profitBankAccountsRef.current.length > 0
        ? profitBankAccountsRef.current
        : profitBankAccounts;

      const adjustments = prevMov
        ? computeMovementEditAccountAdjustments(prevMov, targetMov, desksList, banksList)
        : [];

      for (const adj of adjustments) {
        await applyTreasuryAccountDelta({
          account: {
            kind: adj.account.kind,
            id: adj.account.id,
            coCaja: adj.account.code,
            codCta: adj.account.code
          },
          deltaUsd: adj.deltaUsd,
          deltaBs: adj.deltaBs,
          clampZero: adj.clampZero
        });
      }

      const savedMov = await updateSupabaseCashMovement(targetMov);
      setCashMovementsState((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((m) => String(m?.id || '').trim() === String(savedMov.id).trim());
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...savedMov };
          return list;
        }
        return [savedMov, ...list];
      });
      notify.success('Movimiento actualizado y conciliado en tesorería correctamente');
      return savedMov;
    } catch (err) {
      console.error('Error actualizando movimiento de caja:', err);
      notify.error('Error al actualizar movimiento: ' + (err?.message || 'Error desconocido'));
      throw err;
    }
  };

  // Eliminar Movimiento de Caja y revertir su efecto en la caja/banco correspondiente
  const handleDeleteCashMovement = async (movOrId) => {
    try {
      const targetId = String(typeof movOrId === 'object' ? (movOrId?.id || '') : (movOrId || '')).trim();
      const targetMov = (typeof movOrId === 'object' && movOrId)
        ? movOrId
        : (cashMovements || []).find((m) => String(m?.id || '').trim() === targetId);

      if (!targetMov && !targetId) {
        notify.warning('No se identificó el movimiento a eliminar');
        return;
      }

      const desksList = Array.isArray(profitCashDesksRef.current) && profitCashDesksRef.current.length > 0
        ? profitCashDesksRef.current
        : profitCashDesks;
      const banksList = Array.isArray(profitBankAccountsRef.current) && profitBankAccountsRef.current.length > 0
        ? profitBankAccountsRef.current
        : profitBankAccounts;

      const resolvedAccount = targetMov
        ? resolveTreasuryAccountForMovement(targetMov, desksList, banksList)
        : null;
      const { sign, deltaUsd, deltaBs } = computeMovementReversalDelta(targetMov);

      if (resolvedAccount && (Math.abs(deltaUsd) > 0 || Math.abs(deltaBs) > 0)) {
        await applyTreasuryAccountDelta({
          account: {
            kind: resolvedAccount.kind,
            id: resolvedAccount.id,
            coCaja: resolvedAccount.code,
            codCta: resolvedAccount.code
          },
          deltaUsd,
          deltaBs,
          clampZero: sign < 0
        });
      }

      const remainingLocal = await deleteSupabaseCashMovement(targetMov || targetId);
      const nextList = Array.isArray(remainingLocal)
        ? remainingLocal
        : (await getSupabaseCashMovements().catch(() => []));
      setCashMovementsState([...nextList]);

      const movCatUpper = String(targetMov?.categoria || '').trim().toUpperCase();
      const linkedPartnerId =
        targetMov?.partnerAccountId ||
        targetMov?.partner_account_id ||
        (String(targetMov?.referenciaTipo || targetMov?.referencia_tipo || '').toUpperCase() === 'PASIVO_SOCIO'
          ? (targetMov?.referenciaId || targetMov?.referencia_id)
          : '');
      if (movCatUpper === 'ABONO_PASIVO_SOCIO' && linkedPartnerId) {
        const revUsd = Math.abs(Number(targetMov?.montoUsd ?? targetMov?.monto_usd ?? 0));
        const revBs = Math.abs(Number(targetMov?.montoBs ?? targetMov?.monto_bs ?? 0));
        const revSign = String(targetMov?.tipo || '').toUpperCase() === 'INGRESO' ? -1 : 1;
        setPartnerPayableAccountsState(prev =>
          applyPartnerPayableBalanceDeltaInList(prev, {
            targetRef: linkedPartnerId,
            deltaUsd: Number((revSign * revUsd).toFixed(2)),
            deltaBs: Number((revSign * revBs).toFixed(2))
          })
        );
        removePartnerLiabilityMovementByCashId(targetMov?.id || targetId);
      }

      if (resolvedAccount) {
        const actionWord = sign > 0 ? 'reintegrado en' : 'descontado de';
        notify.success(`Movimiento eliminado y saldo ${actionWord} ${resolvedAccount.label}`);
      } else {
        notify.success('Movimiento eliminado del historial de caja');
      }
    } catch (err) {
      console.error('Error eliminando movimiento de caja:', err);
      notify.error('Error al eliminar el movimiento: ' + (err?.message || 'Error desconocido'));
      throw err;
    }
  };

  const handleUpdateCashDesk = async (desk) => {
    await updateSupabaseProfitCashDesk(desk);
    const fresh = await getSupabaseProfitCashDesks();
    if (fresh) setProfitCashDesks(fresh);
  };

  const handleDeleteCashDesk = async (deskId) => {
    await deleteSupabaseProfitCashDesk(deskId);
    const fresh = await getSupabaseProfitCashDesks();
    if (fresh) setProfitCashDesks(fresh);
  };

  const handleUpdateBankAccount = async (bankAcc) => {
    await updateSupabaseProfitBankAccount(bankAcc);
    const fresh = await getSupabaseProfitBankAccounts();
    if (fresh) setProfitBankAccounts(fresh);
  };

  const handleDeleteBankAccount = async (bankId) => {
    await deleteSupabaseProfitBankAccount(bankId);
    const fresh = await getSupabaseProfitBankAccounts();
    if (fresh) setProfitBankAccounts(fresh);
  };

  const handleSaveExpense = async (expense) => {
    const saved = await saveSupabaseExpense(expense);
    const fresh = await getSupabaseExpenses();
    setExpensesState(fresh);
    return saved;
  };

  const handleDeleteExpense = async (id) => {
    const updated = await deleteSupabaseExpense(id);
    setExpensesState(updated);
  };

  const handleSaveEmployee = async (employee) => {
    const saved = await saveSupabaseEmployee(employee);
    const fresh = await getSupabaseEmployees();
    setEmployeesState(fresh);
    return saved;
  };

  const handleDeleteEmployee = async (id) => {
    const updated = await deleteSupabaseEmployee(id);
    setEmployeesState(updated);
  };

  const handleSavePayroll = async (rec) => {
    const saved = await saveSupabasePayroll(rec);
    const fresh = await getSupabasePayroll();
    setPayrollState(fresh);
    return saved;
  };

  const handleDeletePayroll = async (id) => {
    const updated = await deleteSupabasePayroll(id);
    setPayrollState(updated);
  };

  // Ejecutar Cierre Fiscal Diario (Reporte Z)
  const handleExecuteCierreZ = async (cierreZ, closedSaleIds = []) => {
    try {
      const saved = await saveSupabaseFiscalClosure(cierreZ, closedSaleIds);
      setFiscalClosures(prev => [saved, ...prev]);
      // Actualizar estado local de ventas marcándolas como cerradas bajo este Z
      if (closedSaleIds.length > 0) {
        setSalesState(prev => prev.map(s => {
          if (closedSaleIds.includes(s.id)) {
            return { ...s, cerrada: true, cierre_z_id: saved.id, cierreZId: saved.id };
          }
          return s;
        }));
      }
      notify.success(`Cierre Fiscal Z #${saved.numeroZ ?? saved.numero_z ?? ''} generado exitosamente`);
      return saved;
    } catch (err) {
      console.error("Error al registrar el Cierre Z:", err);
      notify.error("Error al registrar el Cierre Z en el sistema");
      throw err;
    }
  };

  // Guardar nuevo Pedido / Cotización
  const handleSaveOrder = async (orderData) => {
    try {
      const saved = await saveSupabaseOrder(orderData);
      const enrichedSaved = {
        ...orderData,
        ...saved,
        items: Array.isArray(saved?.items) && saved.items.length > 0 ? saved.items : (orderData.items || []),
        diasCredito: orderData.diasCredito ?? saved?.diasCredito ?? 0,
        fechaEmision: orderData.fechaEmision || saved?.fechaEmision || new Date().toISOString(),
        fechaVencimiento: orderData.fechaVencimiento || saved?.fechaVencimiento,
        modalidadVenta: orderData.modalidadVenta || saved?.modalidadVenta || 'PREVENTA',
        creditOverrideApproved: orderData.creditOverrideApproved ?? saved?.creditOverrideApproved,
        creditOverrideAuthorizer: orderData.creditOverrideAuthorizer ?? saved?.creditOverrideAuthorizer,
        creditOverrideJustification: orderData.creditOverrideJustification ?? saved?.creditOverrideJustification,
        observaciones: orderData.observaciones || orderData.notas || saved?.comentarios || ''
      };
      setOrdersState(prev => {
        const index = prev.findIndex(o => o.id === enrichedSaved.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = enrichedSaved;
          return updated;
        } else {
          return [enrichedSaved, ...prev];
        }
      });
      if (enrichedSaved._offlineQueued) {
        notify.warning(`Pedido #${enrichedSaved.numeroDoc || enrichedSaved.id} guardado localmente sin conexión y encolado para sincronizar.`);
      } else if (enrichedSaved.status !== 'FACTURADO') {
        const isClientReq = String(enrichedSaved.tipoDoc || enrichedSaved.tipo_doc || '').toUpperCase() === 'SOLICITUD_CLIENTE';
        const stUpper = String(enrichedSaved.status || 'PENDIENTE').toUpperCase();
        if (isClientReq) {
          if (stUpper === 'PENDIENTE_APROBACION') {
            soundFX.cashierOrderChime(config?.sonidosNotificacion !== false);
            notify.success(`Solicitud de cliente #${enrichedSaved.numeroDoc || enrichedSaved.id} enviada a Flujo Comercial para aprobación.`);
          }
        } else if (stUpper === 'RETENIDO_CREDITO') {
          notify.warning(`Pedido #${enrichedSaved.numeroDoc || enrichedSaved.orderNumber || ''} guardado en estado RETENIDO POR CRÉDITO (requiere aprobación antes de Caja).`);
        } else if (stUpper === 'PENDIENTE') {
          notify.info(`Borrador #${enrichedSaved.numeroDoc || enrichedSaved.orderNumber || ''} guardado sin enviar a Caja.`);
        } else if (stUpper === 'APROBADO') {
          soundFX.cashierOrderChime(config?.sonidosNotificacion !== false);
          notify.success(`Pedido #${enrichedSaved.numeroDoc || enrichedSaved.orderNumber || ''} guardado y enviado a Caja exitosamente`);
        }
      }
      return enrichedSaved;
    } catch (err) {
      console.error('Error guardando pedido:', err);
      notify.error(err?.isValidationError ? err.message : 'Error al guardar el pedido en la base de datos');
      throw err;
    }
  };

  // Actualizar estado de Pedido / Despacho
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const updated = await updateSupabaseOrderStatus(orderId, newStatus);
      setOrdersState(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: newStatus, estado: newStatus } : o))
      );
      notify.success(`Estado del pedido actualizado a "${newStatus}"`);
      return updated;
    } catch (err) {
      console.error('Error actualizando estado de pedido:', err);
      notify.error('Error actualizando el estado del pedido');
      throw err;
    }
  };

  // Eliminar Pedido / Preventa / Orden de Entrega
  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteSupabaseOrder(orderId);
      deleteStorageOrder(orderId);
      setOrdersState(prev => prev.filter(o => o.id !== orderId && o.numeroDoc !== orderId));
      notify.success('Orden / Pedido eliminado correctamente');
      return true;
    } catch (err) {
      console.error('Error eliminando pedido:', err);
      notify.error('Error al eliminar el pedido');
      throw err;
    }
  };

  // Eliminar Factura / Venta / Documento CxC (sin colisión cruzada FACTURA vs NOTA_ENTREGA)
  const handleDeleteSale = async (saleIdOrDoc) => {
    try {
      const isObj = typeof saleIdOrDoc === 'object' && saleIdOrDoc !== null;
      const rawId = isObj ? String(saleIdOrDoc?.id || '').trim() : String(saleIdOrDoc || '').trim();
      const rawNum = isObj
        ? String(saleIdOrDoc?.factNum || saleIdOrDoc?.factura || saleIdOrDoc?.numeroDoc || saleIdOrDoc?.id || '').trim()
        : String(saleIdOrDoc || '').trim();
      const targetTipo = inferCxcDocType(saleIdOrDoc);
      const targetCanon = getEraScopedCanonicalDocKey(saleIdOrDoc, targetTipo);
      const cleanNum = rawNum.replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
      const cleanId = rawId;

      await deleteSupabaseSale(saleIdOrDoc);
      if (cleanId) deleteStorageSale(cleanId, { skipStockAdjustment: true });
      if (rawNum && rawNum !== cleanId) deleteStorageSale(rawNum, { skipStockAdjustment: true });

      const doesEntryMatchDeletedTarget = (entry) => {
        if (!entry) return false;
        const entryId = String(entry.id || '').trim();
        if (cleanId && entryId && entryId === cleanId && inferCxcDocType(entry) === targetTipo) {
          return true;
        }
        const entryCanon = getEraScopedCanonicalDocKey(entry);
        if (targetCanon && entryCanon) {
          return entryCanon === targetCanon;
        }
        if (cleanNum && inferCxcDocType(entry) === targetTipo) {
          const eNum = String(entry.factNum || entry.fact_num || entry.numeroDoc || entry.numero_doc || '').replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
          return eNum === cleanNum;
        }
        return false;
      };

      const matchedSales = (sales || []).filter(doesEntryMatchDeletedTarget);
      const originOrderKeys = new Set();
      const deletedSaleKeysUpper = new Set(
        [cleanId, rawNum, cleanNum].filter(Boolean).map(v => v.toUpperCase())
      );
      matchedSales.forEach(s => {
        [s?.pedidoOrigenId, s?.pedido_origen_id, s?.pedidoOrigenDoc, s?.pedido_origen_doc].forEach(val => {
          const t = String(val || '').trim();
          if (t) originOrderKeys.add(t);
        });
        [s?.id, s?.numeroDoc, s?.numero_doc, s?.factNum].forEach(val => {
          const t = String(val || '').trim().toUpperCase();
          if (t) deletedSaleKeysUpper.add(t);
        });
      });
      if (isObj) {
        [saleIdOrDoc?.pedidoOrigenId, saleIdOrDoc?.pedido_origen_id, saleIdOrDoc?.pedidoOrigenDoc, saleIdOrDoc?.pedido_origen_doc].forEach(val => {
          const t = String(val || '').trim();
          if (t) originOrderKeys.add(t);
        });
      }
      const isTargetNe = targetTipo === 'NOTA_ENTREGA';

      setSalesState(prev => (prev || []).filter(s => !doesEntryMatchDeletedTarget(s)));
      setProfitInvoices(prev => (prev || []).filter(p => !doesEntryMatchDeletedTarget(p)));
      setOrdersState(prev => (prev || []).map(ord => {
        if (!ord || String(ord.status || ord.estado || '').toUpperCase().trim() !== 'FACTURADO') {
          return ord;
        }
        const ordId = String(ord.id || '').trim();
        const ordDoc = String(ord.numeroDoc || ord.numero_doc || ord.numeroPedido || ord.numero_pedido || '').trim();
        const matchesOrigin = (ordId && originOrderKeys.has(ordId)) || (ordDoc && originOrderKeys.has(ordDoc));
        const ordFacId = String(ord.facturaId || ord.factura_id || '').trim().toUpperCase();
        const ordNroFac = String(ord.nroFactura || ord.nro_factura || '').trim().toUpperCase();
        const ordIsNe = /^(NE-|NDE-)/i.test(ordNroFac) || String(ord.tipoDoc || ord.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA';
        const ordCleanNro = ordNroFac.replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
        const matchesInvoice =
          (ordFacId && deletedSaleKeysUpper.has(ordFacId)) ||
          (ordNroFac && ordIsNe === isTargetNe && (deletedSaleKeysUpper.has(ordNroFac) || (ordCleanNro && deletedSaleKeysUpper.has(ordCleanNro))));
        if (!matchesOrigin && !matchesInvoice) return ord;
        return {
          ...ord,
          status: 'APROBADO',
          estado: 'APROBADO',
          nroFactura: null,
          nro_factura: null,
          facturaId: null,
          factura_id: null,
          fechaFactura: null,
          fecha_factura: null
        };
      }));
      notify.success('Documento eliminado y saldo actualizado con éxito');
      return true;
    } catch (err) {
      console.error('Error eliminando documento:', err);
      notify.error('Error al eliminar el documento');
      throw err;
    }
  };

  // Guardar o Editar Documento CxC (Factura Fiscal / Nota de Entrega)
  const handleSaveCxcDocument = async (docData) => {
    const { _skipSaleInsert, ...persistDocData } = docData || {};
    const saved = await saveSupabaseProfitInvoice(persistDocData);
    if (!saved) return null;
    const isNoteDoc = isCreditOrDebitNoteDoc(saved) || isCreditOrDebitNoteDoc(persistDocData);
    const isNewManualDoc = Boolean(persistDocData?._customCreated) && !_skipSaleInsert && !isNoteDoc;

    if (isNewManualDoc && saved.factNum) {
      if (String(saved.tipoDoc || '').toUpperCase() === 'NOTA_ENTREGA') {
        commitNotaEntregaCorrelativo(saved.factNum);
      } else {
        commitInvoiceCorrelativo(saved.factNum);
      }
    }
    const savedCanonKey = getEraScopedCanonicalDocKey(saved);
    setProfitInvoices(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex(p =>
        (savedCanonKey && getEraScopedCanonicalDocKey(p) === savedCanonKey) ||
        String(p.id) === String(saved.id)
      );
      if (idx >= 0) {
        const mergedItems = Array.isArray(saved.items) && saved.items.length > 0 ? saved.items : (list[idx].items || []);
        list[idx] = { ...list[idx], ...saved, items: mergedItems };
        return list;
      }
      return [saved, ...list];
    });
    setSalesState(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      if (isNoteDoc) {
        // Las Notas de Débito/Crédito se registran en Libro de Ventas únicamente mediante fiscalSaleRecord
        return list;
      }
      const idx = list.findIndex(s =>
        (savedCanonKey && getEraScopedCanonicalDocKey(s) === savedCanonKey) ||
        String(s.id) === String(saved.id)
      );
      if (idx >= 0) {
        const mergedItems = Array.isArray(saved.items) && saved.items.length > 0 ? saved.items : (list[idx].items || []);
        list[idx] = {
          ...list[idx],
          ...saved,
          items: mergedItems,
          numeroDoc: saved.factNum,
          fecha: saved.fechaEmision,
          fechaEmision: saved.fechaEmision,
          fechaVencimiento: saved.fechaVencimiento,
          diasCredito: saved.diasCredito,
          condicionPago: Number(saved.diasCredito || 0) > 0 ? 'CREDITO' : 'CONTADO',
          totalUsd: saved.totNetoUsd,
          totalBs: saved.totNetoBs,
          saldoUsd: saved.saldoUsd,
          saldo_usd: saved.saldoUsd,
          saldoBs: saved.saldoBs,
          saldo_bs: saved.saldoBs,
          abonosUsd: saved.abonosUsd,
          abonos_usd: saved.abonosUsd,
          abonosBs: saved.abonosBs,
          estado: Number(saved.saldoUsd || 0) <= 0.01 ? 'PAGADO' : 'PENDIENTE'
        };
        return list;
      }
      if (!isNewManualDoc) {
        return list;
      }
      // Si es un documento nuevo manual de CxC, agregarlo a la lista de ventas
      const newSaleItem = {
        id: saved.id,
        numeroDoc: saved.factNum,
        numeroControl: saved.numeroControl || `00-${String(saved.factNum).replace(/\D/g, '').padStart(6, '0')}`,
        tipoDoc: saved.tipoDoc,
        fecha: saved.fechaEmision,
        fechaEmision: saved.fechaEmision,
        fechaVencimiento: saved.fechaVencimiento,
        diasCredito: saved.diasCredito,
        clienteId: saved.clienteId,
        clienteNombre: saved.clienteNombre,
        clienteRif: saved.clienteRif,
        clienteDireccion: saved.clienteDireccion,
        clienteTelefono: saved.clienteTelefono,
        vendedor: saved.vendedorNombre,
        tasaDolar: saved.tasa,
        subtotalUsd: saved.totBrutoUsd,
        ivaUsd: saved.ivaUsd,
        totalUsd: saved.totNetoUsd,
        subtotalBs: saved.totBrutoBs,
        ivaBs: saved.ivaBs,
        totalBs: saved.totNetoBs,
        saldoUsd: saved.saldoUsd,
        saldoBs: saved.saldoBs,
        abonosUsd: saved.abonosUsd,
        abonosBs: saved.abonosBs,
        condicionPago: Number(saved.diasCredito || 0) > 0 ? 'CREDITO' : 'CONTADO',
        estado: Number(saved.saldoUsd || 0) <= 0.01 ? 'PAGADO' : 'PENDIENTE',
        items: saved.items || []
      };
      return [newSaleItem, ...list];
    });
    return saved;
  };

  // Actualizar datos de una Factura o Nota de Entrega existente (correlativo, fecha/hora, cliente, montos)
  const handleUpdateInvoiceDocument = async (originalDoc, updatedDocData) => {
    const saved = await updateSupabaseInvoiceDocument(originalDoc, updatedDocData);
    if (!saved) return null;

    const oldId = String(originalDoc?.id || '').trim().toUpperCase();
    const oldEraKey = getEraScopedCanonicalDocKey(originalDoc);
    const savedId = String(saved.id || '').trim().toUpperCase();
    const savedEraKey = getEraScopedCanonicalDocKey(saved);
    const renamed = (oldId && savedId && oldId !== savedId) || (oldEraKey && savedEraKey && oldEraKey !== savedEraKey);

    setProfitInvoices(prev => {
      const base = Array.isArray(prev) ? [...prev] : [];
      const list = renamed
        ? base.filter(p => {
            const pId = String(p.id || '').trim().toUpperCase();
            const pEraKey = getEraScopedCanonicalDocKey(p);
            return !(oldId && pId === oldId) && !(oldEraKey && pEraKey === oldEraKey);
          })
        : base;
      const idx = list.findIndex(p => {
        const pId = String(p.id || '').trim().toUpperCase();
        const pEraKey = getEraScopedCanonicalDocKey(p);
        return (savedId && pId === savedId) || (savedEraKey && pEraKey === savedEraKey);
      });
      if (idx >= 0) {
        const mergedItems = Array.isArray(saved.items) && saved.items.length > 0 ? saved.items : (list[idx].items || []);
        list[idx] = { ...list[idx], ...saved, items: mergedItems };
        return list;
      }
      return [saved, ...list];
    });

    setSalesState(prev => {
      const base = Array.isArray(prev) ? [...prev] : [];
      const list = renamed
        ? base.filter(s => {
            const sId = String(s.id || '').trim().toUpperCase();
            const sEraKey = getEraScopedCanonicalDocKey(s);
            return !(oldId && sId === oldId) && !(oldEraKey && sEraKey === oldEraKey);
          })
        : base;
      const idx = list.findIndex(s => {
        const sId = String(s.id || '').trim().toUpperCase();
        const sEraKey = getEraScopedCanonicalDocKey(s);
        return (savedId && sId === savedId) || (savedEraKey && sEraKey === savedEraKey);
      });
      const nextSalePatch = {
        ...saved,
        ...(saved.seriesEra ? { seriesEra: saved.seriesEra } : {}),
        numeroDoc: saved.numeroDoc || saved.factNum,
        numeroControl: saved.numeroControl || formatDocumentControlNumber(saved.factNum || saved.numeroDoc, saved.tipoDoc),
        fecha: saved.fechaEmision,
        fechaEmision: saved.fechaEmision,
        fechaVencimiento: saved.fechaVencimiento,
        diasCredito: saved.diasCredito,
        condicionPago: saved.condicionPago || (Number(saved.diasCredito || 0) > 0 ? 'CREDITO' : 'CONTADO'),
        metodoPago: saved.metodoPago || (Number(saved.diasCredito || 0) > 0 ? 'CREDITO' : 'EFECTIVO_USD'),
        vendedor: saved.vendedorNombre || saved.vendedor || '',
        subtotalUsd: saved.totBrutoUsd,
        ivaUsd: saved.ivaUsd,
        totalUsd: saved.totNetoUsd,
        subtotalBs: saved.totBrutoBs,
        ivaBs: saved.ivaBs,
        totalBs: saved.totNetoBs,
        saldoUsd: saved.saldoUsd,
        saldo_usd: saved.saldoUsd,
        saldoBs: saved.saldoBs,
        saldo_bs: saved.saldoBs,
        abonosUsd: saved.abonosUsd,
        abonos_usd: saved.abonosUsd,
        abonosBs: saved.abonosBs,
        estado: Number(saved.saldoUsd || 0) <= 0.01 ? 'PAGADO' : 'PENDIENTE'
      };
      if (idx >= 0) {
        const mergedItems = Array.isArray(saved.items) && saved.items.length > 0 ? saved.items : (list[idx].items || []);
        list[idx] = { ...list[idx], ...nextSalePatch, items: mergedItems };
        return list;
      }
      return [{ ...nextSalePatch, items: saved.items || [] }, ...list];
    });

    return saved;
  };

  // Helper unificado para acreditar/debitar Cajas Operativas y Cuentas Bancarias en USD y Bs
  const applyTreasuryAccountDelta = async ({ account, deltaUsd = 0, deltaBs = 0, clampZero = false }) => {
    if (!account) return null;
    const accountKind = inferTreasuryAccountKind(account);
    if (accountKind === 'CAJA') {
      let currentDesks = Array.isArray(profitCashDesksRef.current) ? profitCashDesksRef.current : [];
      let targetDesk = currentDesks.find((d) => matchesCashDesk(d, account));
      if (!targetDesk) {
        try {
          const freshDesks = await getSupabaseProfitCashDesks();
          if (Array.isArray(freshDesks) && freshDesks.length > 0) {
            currentDesks = freshDesks;
            targetDesk = freshDesks.find((d) => matchesCashDesk(d, account));
          }
        } catch (_) {}
      }
      if (!targetDesk) {
        console.warn('[applyTreasuryAccountDelta] Caja destino no encontrada:', account);
        return null;
      }
      const updatedDesk = applyTreasuryBalanceDelta(targetDesk, { deltaUsd, deltaBs, clampZero });
      const nextDesks = currentDesks.map((d) => (matchesCashDesk(d, updatedDesk) ? updatedDesk : d));
      profitCashDesksRef.current = nextDesks;
      setProfitCashDesks(nextDesks);
      await updateSupabaseProfitCashDesk(updatedDesk);
      return updatedDesk;
    }

    if (accountKind === 'BANCO') {
      let currentBanks = Array.isArray(profitBankAccountsRef.current) ? profitBankAccountsRef.current : [];
      let targetBank = currentBanks.find((b) => matchesBankAccount(b, account));
      if (!targetBank) {
        try {
          const freshBanks = await getSupabaseProfitBankAccounts();
          if (Array.isArray(freshBanks) && freshBanks.length > 0) {
            currentBanks = freshBanks;
            targetBank = freshBanks.find((b) => matchesBankAccount(b, account));
          }
        } catch (_) {}
      }
      if (!targetBank) {
        console.warn('[applyTreasuryAccountDelta] Cuenta bancaria destino no encontrada:', account);
        return null;
      }
      const updatedBank = applyTreasuryBalanceDelta(targetBank, { deltaUsd, deltaBs, clampZero });
      const nextBanks = currentBanks.map((b) => (matchesBankAccount(b, updatedBank) ? updatedBank : b));
      profitBankAccountsRef.current = nextBanks;
      setProfitBankAccounts(nextBanks);
      await updateSupabaseProfitBankAccount(updatedBank);
      return updatedBank;
    }
    return null;
  };

  // Registrar Cobro en Cuentas por Cobrar (Parte A) y actualizar Abonos, Tesorería y Flujo de Caja
  const handleRegisterCxcCollection = async (payloadOrParams) => {
    const raw = payloadOrParams || {};
    const rawDocToSave = raw.updatedDoc || raw.updatedInvoice || null;
    const isNowFullyPaid = rawDocToSave && Number(rawDocToSave.saldoUsd ?? rawDocToSave.saldo_usd ?? 1) <= 0.01;
    const docToSave = rawDocToSave
      ? {
          ...rawDocToSave,
          ...(isNowFullyPaid
            ? {
                fechaUltimoCobro:
                  raw.fecha ||
                  raw.collectionPayload?.fecha ||
                  rawDocToSave.fechaUltimoCobro ||
                  new Date().toISOString().split('T')[0]
              }
            : {})
        }
      : null;
    const targetCanon = docToSave ? getEraScopedCanonicalDocKey(docToSave) : '';
    const prevDocSnapshot = docToSave
      ? (profitInvoices || []).find(p =>
          (targetCanon && getEraScopedCanonicalDocKey(p) === targetCanon) ||
          (docToSave.id && String(p.id) === String(docToSave.id))
        ) || null
      : null;

    let savedDoc = null;
    if (docToSave) {
      savedDoc = await handleSaveCxcDocument(docToSave);
      if (!savedDoc) {
        throw new Error('No se pudo actualizar el documento CxC en el servidor.');
      }
    }

    const effectiveDocType = raw.tipoDoc || savedDoc?.tipoDoc || docToSave?.tipoDoc || 'FACTURA';
    const isNeDocCobro = String(effectiveDocType || '').toUpperCase().trim() === 'NOTA_ENTREGA';
    const fiscalScopeTag = raw.fiscalScope || (isNeDocCobro ? 'NO_FISCAL' : 'FISCAL');
    const resolvedMonedaPago = raw.monedaPago || raw.collectionPayload?.monedaPago || (String(raw.tipoTasa || raw.collectionPayload?.tipoTasa || raw.moneda || '').toUpperCase().includes('USD') || String(raw.moneda || '').toUpperCase() === 'US$' ? 'USD' : 'BS');
    const resolvedTipoTasa = normalizeRateType(raw.tipoTasa ?? raw.collectionPayload?.tipoTasa, {
      tipoDoc: effectiveDocType,
      monedaPago: resolvedMonedaPago,
      fallback: 'BCV'
    });
    const isDirectUsdRate = isDirectCurrencyRateType(resolvedTipoTasa);
    const baseRate = Number(raw.collectionPayload?.tasaPago || raw.tasaPago || raw.collectionPayload?.tasa || raw.tasa || config?.tasaDolar || 1) || 1;
    const rawAmounts = normalizeCollectionWriteAmounts({
      montoUsd: raw.collectionPayload?.montoUsd ?? raw.montoUsd ?? 0,
      montoBs: raw.collectionPayload?.montoBs ?? raw.montoBs ?? 0,
      tasa: baseRate
    });
    const finalMontoBs = isDirectUsdRate && Number(raw.collectionPayload?.montoBs ?? raw.montoBs ?? 0) === 0
      ? 0
      : rawAmounts.montoBs;

    let colPayload = raw.collectionPayload
      ? {
          ...raw.collectionPayload,
          montoUsd: rawAmounts.montoUsd,
          montoBs: finalMontoBs,
          tasa: rawAmounts.tasa,
          tipoTasa: resolvedTipoTasa,
          tasaPago: Number(raw.collectionPayload?.tasaPago ?? raw.tasaPago ?? rawAmounts.tasa ?? baseRate),
          monedaPago: isDirectUsdRate ? 'USD' : resolvedMonedaPago
        }
      : null;

    if (!colPayload && (rawAmounts.montoUsd > 0 || finalMontoBs > 0)) {
      const cobNum = `COB-${Date.now().toString().slice(-6)}`;
      colPayload = {
        id: `cob-${cobNum}`,
        cobNum,
        fecha: raw.fecha || new Date().toISOString().split('T')[0],
        clienteId: raw.clienteId || '',
        clienteNombre: raw.clienteNombre || 'Cliente General',
        clienteRif: raw.clienteRif || '',
        vendedorId: raw.vendedorId || 'OF',
        montoUsd: rawAmounts.montoUsd,
        montoBs: finalMontoBs,
        tasa: rawAmounts.tasa,
        tipoTasa: resolvedTipoTasa,
        tasaPago: Number(raw.tasaPago ?? rawAmounts.tasa ?? baseRate),
        monedaPago: isDirectUsdRate ? 'USD' : resolvedMonedaPago,
        cuentaId: raw.accountId || raw.cuentaId || '',
        cuentaNombre: raw.cuentaDestino || raw.cuentaNombre || '',
        descrip: raw.observaciones || `Cobro ${raw.tipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura'} #${raw.factNum || ''}`,
        formasPago: [{
          formaPago: raw.formaPago === 'EFECTIVO' ? 'EFEC' : 'TRANS',
          monto: finalMontoBs,
          montoUsd: rawAmounts.montoUsd,
          tipoTasa: resolvedTipoTasa,
          tasaPago: Number(raw.tasaPago ?? rawAmounts.tasa ?? baseRate),
          referencia: raw.referencia || '',
          codCaja: raw.accountType === 'CAJA' ? (raw.accountId || '') : '',
          codCta: raw.accountType === 'BANCO' ? (raw.accountId || '') : ''
        }],
        documentosAfectados: [{
          numDoc: raw.factNum || '',
          tipoDoc: raw.tipoDoc === 'NOTA_ENTREGA' ? 'N/E' : 'FACT',
          montoCobrado: finalMontoBs,
          montoCobradoUsd: rawAmounts.montoUsd
        }]
      };
    }

    let savedCob = null;
    if (colPayload) {
      try {
        savedCob = await saveSupabaseProfitCollection(colPayload);
        if (savedCob) {
          setProfitCollections(prev => [savedCob, ...(Array.isArray(prev) ? prev.filter(c => String(c.id) !== String(savedCob.id)) : [])]);
        }
      } catch (cobErr) {
        if (prevDocSnapshot) {
          await handleSaveCxcDocument(prevDocSnapshot).catch(() => {});
        }
        throw cobErr;
      }
    }

    const account = raw.selectedAccount || (raw.accountType ? {
      kind: raw.accountType,
      rawId: raw.accountId,
      accountType: raw.accountType,
      id: raw.accountId,
      codCta: raw.accountType === 'BANCO' ? raw.accountId : undefined,
      coCaja: raw.accountType === 'CAJA' ? raw.accountId : undefined,
      nombre: raw.cuentaDestino || ''
    } : null);

    if (account) {
      const montoUsd = Number(savedCob?.montoUsd ?? colPayload?.montoUsd ?? rawAmounts.montoUsd ?? 0);
      const montoBs = Number(savedCob?.montoBs ?? colPayload?.montoBs ?? rawAmounts.montoBs ?? 0);
      try {
        await applyTreasuryAccountDelta({ account, deltaUsd: montoUsd, deltaBs: montoBs, clampZero: false });
      } catch (acctErr) {
        console.error('[handleRegisterCxcCollection] Error actualizando saldo de caja/banco:', acctErr?.message || acctErr);
        if (prevDocSnapshot) {
          await handleSaveCxcDocument(prevDocSnapshot).catch(() => {});
        }
        throw new Error('No se pudo acreditar el cobro en la caja/banco seleccionada: ' + (acctErr?.message || acctErr));
      }
    }

    const montoCobradoUsd = Number(savedCob?.montoUsd ?? colPayload?.montoUsd ?? rawAmounts.montoUsd ?? 0);
    const montoCobradoBs = Number(savedCob?.montoBs ?? colPayload?.montoBs ?? rawAmounts.montoBs ?? 0);

    // Registrar movimiento INGRESO en Flujo de Caja / Caja Chica enlazado a su Sub-caja (Fiscal vs No Fiscal)
    if (montoCobradoUsd > 0) {
      try {
        const isCajaDest = inferTreasuryAccountKind(account) === 'CAJA';
        const cajaTargetId = isCajaDest ? (account?.rawId || account?.id || account?.coCaja || '') : '';
        const cajaTargetCode = String(account?.coCaja || account?.co_caja || cajaTargetId || '').trim().toUpperCase();
        const subCajaCode = raw.subcaja || (isCajaDest && cajaTargetCode ? `${cajaTargetCode}-${isNeDocCobro ? 'NF' : 'F'}` : '');
        const rawConcepto = colPayload?.descrip || `Cobro CxC ${raw.clienteNombre || savedDoc?.clienteNombre || ''} (#${raw.factNum || savedDoc?.factNum || ''})`.trim();
        const hasDocIndicator = /FACTURA\s+FISCAL|NOTA\s+DE\s+ENTREGA|\[(?:NO[\s_-]*)?FISCAL\]/i.test(rawConcepto);
        const movConcepto = hasDocIndicator
          ? rawConcepto
          : `[${fiscalScopeTag === 'FISCAL' ? 'FISCAL' : 'NO FISCAL'}] ${rawConcepto}`;
        const mov = {
          tipo: 'INGRESO',
          categoria: 'COBRO_CXC',
          concepto: movConcepto,
          tipoDoc: effectiveDocType,
          fiscalScope: fiscalScopeTag,
          subcaja: subCajaCode,
          referenciaTipo: fiscalScopeTag,
          referenciaId: String(raw.factNum || savedDoc?.factNum || ''),
          montoUsd: montoCobradoUsd,
          montoBs: montoCobradoBs,
          tasa: Number(colPayload?.tasaPago || colPayload?.tasa || rawAmounts.tasa || config?.tasaDolar || 1),
          tipoTasa: colPayload?.tipoTasa || resolvedTipoTasa,
          tasaPago: Number(colPayload?.tasaPago || colPayload?.tasa || rawAmounts.tasa || config?.tasaDolar || 1),
          monedaPago: colPayload?.monedaPago || (isDirectUsdRate ? 'USD' : 'BS'),
          moneda: raw.moneda || (account?.moneda === 'USD' ? 'US$' : 'BS'),
          cajaId: isCajaDest ? (cajaTargetId || null) : null,
          cuentaId: account?.rawId || account?.id || colPayload?.cuentaId || '',
          cuentaNombre: account?.nombre || colPayload?.cuentaNombre || '',
          cajaOBanco: account?.nombre || colPayload?.cuentaNombre || '',
          referencia: raw.referencia || savedCob?.cobNum || colPayload?.cobNum || '',
          fecha: colPayload?.fecha || raw.fecha || new Date().toISOString().split('T')[0],
          usuario: currentUser?.nombre || currentUser?.username || 'COBRANZAS'
        };
        const createdMov = await addSupabaseCashMovement(mov);
        if (createdMov) {
          setCashMovementsState(prev => upsertCashMovementInList(prev, createdMov));
        }
      } catch (movErr) {
        console.warn('[handleRegisterCxcCollection] No se pudo registrar ingreso en flujo de caja:', movErr?.message || movErr);
      }
    }

    const clienteId = colPayload?.clienteId || raw.clienteId || savedDoc?.clienteId;
    const clienteRif = colPayload?.clienteRif || raw.clienteRif || savedDoc?.clienteRif;

    if (montoCobradoUsd > 0 && (clienteId || clienteRif)) {
      setClientsState(prev => {
        const list = Array.isArray(prev) ? [...prev] : [];
        return list.map(c => {
          const matches = (clienteId && (String(c.id) === String(clienteId) || String(c.codigo) === String(clienteId))) ||
                          (clienteRif && String(c.rif) === String(clienteRif));
          if (matches) {
            const currentDebt = Number(c.saldoDeudorUsd || 0);
            const nuevoSaldoDeudor = Number(Math.max(0, currentDebt - montoCobradoUsd).toFixed(2));
            const updatedClient = {
              ...c,
              saldoDeudorUsd: nuevoSaldoDeudor,
              saldo_deudor_usd: nuevoSaldoDeudor
            };
            saveSupabaseClient(updatedClient).catch(() => {});
            return updatedClient;
          }
          return c;
        });
      });
    }

    return savedDoc || savedCob;
  };

  // Emitir Nota de Crédito (rebaja deuda) o Nota de Débito (aumenta deuda) desde CxC
  const handleIssueCxcCreditDebitNote = async (params) => {
    const result = buildCxcCreditDebitNoteResult(params);
    const {
      updatedAffectedDoc,
      createdDebitDoc,
      fiscalSaleRecord,
      clientDebtDeltaUsd,
      notePdfData
    } = result;

    if (updatedAffectedDoc) {
      await handleSaveCxcDocument({ ...updatedAffectedDoc, _skipSaleInsert: true });
    }

    if (createdDebitDoc) {
      await handleSaveCxcDocument({ ...createdDebitDoc, _skipSaleInsert: true });
    }

    if (fiscalSaleRecord) {
      try {
        const persistedSale = await recordFiscalAdjustmentSaleInSupabase(fiscalSaleRecord);
        const saleItem = persistedSale || fiscalSaleRecord;
        setSalesState(prev => [
          saleItem,
          ...(Array.isArray(prev) ? prev.filter(s => String(s?.id) !== String(saleItem.id)) : [])
        ]);
      } catch (saleErr) {
        console.warn('[handleIssueCxcCreditDebitNote] Aviso registrando nota en Libro de Ventas:', saleErr?.message || saleErr);
      }
    }

    const refDoc = params?.affectedDoc || updatedAffectedDoc || createdDebitDoc;
    const clienteId = refDoc?.clienteId || '';
    const clienteRif = refDoc?.rif || refDoc?.clienteRif || '';
    if (Math.abs(clientDebtDeltaUsd) > 0 && (clienteId || clienteRif)) {
      setClientsState(prev => {
        const list = Array.isArray(prev) ? [...prev] : [];
        return list.map(c => {
          const matches = (clienteId && (String(c.id) === String(clienteId) || String(c.codigo) === String(clienteId))) ||
                          (clienteRif && String(c.rif) === String(clienteRif));
          if (matches) {
            const currentDebt = Number(c.saldoDeudorUsd || 0);
            const nuevoSaldoDeudor = Number(Math.max(0, currentDebt + clientDebtDeltaUsd).toFixed(2));
            const updatedClient = {
              ...c,
              saldoDeudorUsd: nuevoSaldoDeudor,
              saldo_deudor_usd: nuevoSaldoDeudor
            };
            saveSupabaseClient(updatedClient).catch(() => {});
            return updatedClient;
          }
          return c;
        });
      });
    }

    return {
      ...result,
      notePdfData
    };
  };

  const resolveCxcTreasuryAccount = (hint = {}) => {
    if (!hint) return null;
    const formaUpper = String(hint.formaPago || hint.accountType || '').trim().toUpperCase();
    if (formaUpper === 'NOTA_CREDITO' || formaUpper === 'N/CR' || formaUpper === 'NCR') {
      return null;
    }

    const desks = Array.isArray(profitCashDesksRef.current) ? profitCashDesksRef.current : [];
    const banks = Array.isArray(profitBankAccountsRef.current) ? profitBankAccountsRef.current : [];
    const accountObj = hint.account && typeof hint.account === 'object' ? hint.account : hint;
    const inferredKind = inferTreasuryAccountKind(accountObj);
    const normStr = (v) => String(v || '').trim().toUpperCase();
    const cuentaIdHint = normStr(hint.cuentaId || accountObj.rawId || accountObj.id || accountObj.coCaja || accountObj.codCta);
    const cuentaNombreHint = normStr(hint.cuentaNombre || accountObj.nombre || accountObj.descripcion || accountObj.banco);

    if (inferredKind === 'CAJA' || (!inferredKind && (cuentaIdHint.includes('CAJ') || cuentaNombreHint.includes('CAJA')))) {
      const matchedDesk = desks.find((d) =>
        matchesCashDesk(d, accountObj) ||
        (cuentaIdHint && matchesCashDesk(d, cuentaIdHint)) ||
        (cuentaNombreHint && (normStr(d.nombre) === cuentaNombreHint || normStr(d.descripcion) === cuentaNombreHint))
      );
      if (matchedDesk) return { kind: 'CAJA', account: { ...matchedDesk, kind: 'CAJA', accountType: 'CAJA' } };
    }

    if (inferredKind === 'BANCO' || !inferredKind) {
      const matchedBank = banks.find((b) =>
        matchesBankAccount(b, accountObj) ||
        (cuentaIdHint && matchesBankAccount(b, cuentaIdHint)) ||
        (cuentaNombreHint && (normStr(b.nombre) === cuentaNombreHint || normStr(b.banco) === cuentaNombreHint || normStr(b.numCta) === cuentaNombreHint))
      );
      if (matchedBank) return { kind: 'BANCO', account: { ...matchedBank, kind: 'BANCO', accountType: 'BANCO' } };
    }

    const fallbackDesk = desks.find((d) =>
      matchesCashDesk(d, accountObj) ||
      (cuentaIdHint && matchesCashDesk(d, cuentaIdHint)) ||
      (cuentaNombreHint && normStr(d.nombre) === cuentaNombreHint)
    );
    if (fallbackDesk) return { kind: 'CAJA', account: { ...fallbackDesk, kind: 'CAJA', accountType: 'CAJA' } };

    if (inferredKind === 'CAJA' || inferredKind === 'BANCO') {
      return { kind: inferredKind, account: { ...accountObj, kind: inferredKind, accountType: inferredKind } };
    }
    return null;
  };

  const isSameTreasuryAccount = (acctA, acctB) => {
    if (!acctA || !acctB || acctA.kind !== acctB.kind) return false;
    return acctA.kind === 'CAJA'
      ? matchesCashDesk(acctA.account, acctB.account)
      : matchesBankAccount(acctA.account, acctB.account);
  };

  const adjustCxcClientDebt = ({ clienteId, clienteRif, deltaUsd = 0 }) => {
    const cleanDelta = Number(Number(deltaUsd || 0).toFixed(2));
    if (Math.abs(cleanDelta) < 0.005 || (!clienteId && !clienteRif)) return;
    setClientsState((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      return list.map((c) => {
        const matches =
          (clienteId && (String(c.id) === String(clienteId) || String(c.codigo) === String(clienteId))) ||
          (clienteRif && String(c.rif) === String(clienteRif));
        if (!matches) return c;
        const currentDebt = Number(c.saldoDeudorUsd || 0);
        const nuevoSaldoDeudor = Number(Math.max(0, currentDebt + cleanDelta).toFixed(2));
        const updatedClient = {
          ...c,
          saldoDeudorUsd: nuevoSaldoDeudor,
          saldo_deudor_usd: nuevoSaldoDeudor
        };
        saveSupabaseClient(updatedClient).catch(() => {});
        return updatedClient;
      });
    });
  };

  const findMatchingCxcCashMovement = ({
    factNum = '',
    cobNum = '',
    correlativo = '',
    referencia = '',
    fecha = '',
    montoUsd = 0,
    cuentaId = '',
    cuentaNombre = ''
  } = {}) => {
    const list = Array.isArray(cashMovements) ? cashMovements : [];
    const stripZeros = (v) => String(v || '').trim().replace(/^#/, '').replace(/^0+/, '') || String(v || '').trim();
    const normFact = stripZeros(factNum);
    const refTokens = new Set(
      [referencia, cobNum, correlativo]
        .map((v) => String(v || '').trim().toUpperCase().replace(/^#/, ''))
        .filter((v) => v && v !== 'S/R' && v !== '-')
    );
    const fechaDay = String(fecha || '').slice(0, 10);
    const acctIdUpper = String(cuentaId || '').trim().toUpperCase();
    const acctNameUpper = String(cuentaNombre || '').trim().toUpperCase();

    let best = null;
    let bestScore = 0;

    list.forEach((m) => {
      if (!m || m.anulado) return;
      const cat = String(m.categoria || '').trim().toUpperCase();
      const tipo = String(m.tipo || '').trim().toUpperCase();
      if (cat !== 'COBRO_CXC' || tipo !== 'INGRESO') return;

      const movDoc = stripZeros(m.referenciaId || m.referencia_id || '');
      const movConcept = String(m.concepto || '').toUpperCase();
      const docMatches =
        (normFact && movDoc === normFact) ||
        (normFact && movConcept.includes(`#${normFact}`));
      if (normFact && !docMatches) return;

      const movRefUpper = String(m.referencia || '').trim().toUpperCase().replace(/^#/, '');
      const refMatched = Boolean(movRefUpper && refTokens.has(movRefUpper));
      const movDay = String(m.fecha || '').slice(0, 10);
      const dayMatched = Boolean(fechaDay && movDay === fechaDay);
      const usdMatched = Math.abs(Number(m.montoUsd || 0) - Number(montoUsd || 0)) <= 0.05;
      const movAcctId = String(m.cuentaId || m.cajaId || '').trim().toUpperCase();
      const movAcctName = String(m.cuentaNombre || m.cajaOBanco || '').trim().toUpperCase();
      const acctMatched =
        (acctIdUpper && movAcctId === acctIdUpper) ||
        (acctNameUpper && movAcctName === acctNameUpper);

      let score = docMatches ? 10 : 0;
      if (refMatched) score += 40;
      if (usdMatched) score += 25;
      if (dayMatched) score += 15;
      if (acctMatched) score += 10;

      if (refMatched || (docMatches && usdMatched && dayMatched)) {
        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      }
    });

    return best;
  };

  // Actualizar metadatos o datos financieros de un cobro / movimiento CxC
  const handleUpdateCxcCollection = async (collectionData, reconcileMeta = null) => {
    let savedCob = null;
    if (collectionData && collectionData.id) {
      savedCob = await saveSupabaseProfitCollection(collectionData);
      if (savedCob) {
        setProfitCollections(prev => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex(c => String(c.id) === String(savedCob.id));
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...savedCob };
            return list;
          }
          return [savedCob, ...list];
        });
      }
    }

    if (!reconcileMeta) {
      return savedCob;
    }

    const updatedDocsList = Array.isArray(reconcileMeta.updatedDocs)
      ? reconcileMeta.updatedDocs
      : (reconcileMeta.updatedDoc ? [reconcileMeta.updatedDoc] : []);
    for (const docPayload of updatedDocsList) {
      if (docPayload) {
        await handleSaveCxcDocument(docPayload);
      }
    }

    const oldMontoUsd = Number(reconcileMeta.oldMontoUsd || 0);
    const newMontoUsd = Number(reconcileMeta.newMontoUsd || 0);
    const oldMontoBs = Number(reconcileMeta.oldMontoBs || 0);
    const newMontoBs = Number(reconcileMeta.newMontoBs || 0);
    const oldForma = String(reconcileMeta.oldFormaPago || '').trim().toUpperCase();
    const newForma = String(reconcileMeta.newFormaPago || '').trim().toUpperCase();
    const corrStr = String(reconcileMeta.correlativo || '');
    const isOldCreditNote = oldForma === 'NOTA_CREDITO' || /^NC-/i.test(corrStr);
    const isNewCreditNote = newForma === 'NOTA_CREDITO';

    const oldAcct = !isOldCreditNote
      ? resolveCxcTreasuryAccount({
          account: reconcileMeta.oldAccount,
          cuentaId: reconcileMeta.oldCuentaId,
          cuentaNombre: reconcileMeta.oldCuentaNombre,
          formaPago: oldForma
        })
      : null;

    const newAcct = !isNewCreditNote
      ? resolveCxcTreasuryAccount({
          account: reconcileMeta.newAccount,
          cuentaId: reconcileMeta.newCuentaId,
          cuentaNombre: reconcileMeta.newCuentaNombre,
          formaPago: newForma
        })
      : null;

    if (oldAcct && newAcct && isSameTreasuryAccount(oldAcct, newAcct)) {
      const deltaUsd = Number((newMontoUsd - oldMontoUsd).toFixed(2));
      const deltaBs = Number((newMontoBs - oldMontoBs).toFixed(2));
      if (Math.abs(deltaUsd) >= 0.01 || Math.abs(deltaBs) >= 0.01) {
        await applyTreasuryAccountDelta({
          account: newAcct.account,
          deltaUsd,
          deltaBs,
          clampZero: true
        });
      }
    } else {
      if (oldAcct && (oldMontoUsd > 0 || oldMontoBs > 0)) {
        await applyTreasuryAccountDelta({
          account: oldAcct.account,
          deltaUsd: -oldMontoUsd,
          deltaBs: -oldMontoBs,
          clampZero: true
        });
      }
      if (newAcct && (newMontoUsd > 0 || newMontoBs > 0)) {
        await applyTreasuryAccountDelta({
          account: newAcct.account,
          deltaUsd: newMontoUsd,
          deltaBs: newMontoBs,
          clampZero: false
        });
      }
    }

    try {
      const matchedMov = findMatchingCxcCashMovement({
        factNum: reconcileMeta.factNum,
        cobNum: reconcileMeta.cobNum,
        correlativo: reconcileMeta.correlativo,
        referencia: reconcileMeta.oldReferencia,
        fecha: reconcileMeta.oldFecha,
        montoUsd: oldMontoUsd,
        cuentaId: reconcileMeta.oldCuentaId,
        cuentaNombre: reconcileMeta.oldCuentaNombre
      });

      if (matchedMov) {
        if (isNewCreditNote) {
          const remaining = await deleteSupabaseCashMovement(matchedMov);
          setCashMovementsState((prev) =>
            Array.isArray(remaining) ? remaining : prev.filter((m) => String(m?.id) !== String(matchedMov.id))
          );
        } else {
          const resolvedNewAccount = newAcct?.account || reconcileMeta.newAccount;
          const isCajaDest = inferTreasuryAccountKind(resolvedNewAccount) === 'CAJA';
          const cajaTargetId = isCajaDest ? (resolvedNewAccount?.rawId || resolvedNewAccount?.id || resolvedNewAccount?.coCaja || '') : '';
          const cajaTargetCode = String(resolvedNewAccount?.coCaja || resolvedNewAccount?.co_caja || cajaTargetId || '').trim().toUpperCase();
          const isNeDoc = String(reconcileMeta.tipoDoc || matchedMov.tipoDoc || '').toUpperCase().includes('NOTA');
          const subCajaCode = isCajaDest && cajaTargetCode
            ? `${cajaTargetCode}-${isNeDoc ? 'NF' : 'F'}`
            : '';
          const nextMonedaPago = String(reconcileMeta.monedaPago || '').toUpperCase() === 'USD' ? 'USD' : 'BS';
          const updatedMovPayload = {
            ...matchedMov,
            montoUsd: newMontoUsd,
            montoBs: newMontoBs,
            tasa: Number(reconcileMeta.newTasa || matchedMov.tasa || 1),
            tasaPago: Number(reconcileMeta.newTasa || matchedMov.tasaPago || 1),
            tipoTasa: reconcileMeta.newTipoTasa || matchedMov.tipoTasa || 'BCV',
            monedaPago: nextMonedaPago,
            moneda: nextMonedaPago === 'USD' ? 'US$' : (resolvedNewAccount?.moneda === 'USD' ? 'US$' : 'BS'),
            cajaId: isCajaDest ? (cajaTargetId || null) : null,
            subcaja: subCajaCode,
            cuentaId: resolvedNewAccount?.rawId || resolvedNewAccount?.id || reconcileMeta.newCuentaId || matchedMov.cuentaId || '',
            cuentaNombre: resolvedNewAccount?.nombre || reconcileMeta.newCuentaNombre || matchedMov.cuentaNombre || '',
            cajaOBanco: resolvedNewAccount?.nombre || reconcileMeta.newCuentaNombre || matchedMov.cajaOBanco || '',
            referencia: reconcileMeta.newReferencia !== undefined ? String(reconcileMeta.newReferencia || '') : matchedMov.referencia,
            concepto: reconcileMeta.observaciones
              ? `${matchedMov.fiscalScope === 'FISCAL' ? '[FISCAL]' : '[NO FISCAL]'} Cobro CxC ${reconcileMeta.clienteNombre || ''} (#${reconcileMeta.factNum || ''}) • ${reconcileMeta.observaciones}`.trim()
              : matchedMov.concepto
          };
          const savedMov = await updateSupabaseCashMovement(updatedMovPayload);
          if (savedMov) {
            setCashMovementsState((prev) => upsertCashMovementInList(prev, savedMov));
          }
        }
      }
    } catch (movErr) {
      console.warn('[handleUpdateCxcCollection] Aviso actualizando movimiento en Caja:', movErr?.message || movErr);
    }

    const debtDeltaUsd = Number((oldMontoUsd - newMontoUsd).toFixed(2));
    if (Math.abs(debtDeltaUsd) >= 0.005) {
      adjustCxcClientDebt({
        clienteId: reconcileMeta.clienteId,
        clienteRif: reconcileMeta.clienteRif,
        deltaUsd: debtDeltaUsd
      });
    }

    return savedCob;
  };

  // Eliminar completamente o desagregar un cobro CxC reconciliando documento, profit_collections, caja/banco, flujo de caja y saldo cliente
  const handleDeleteCxcCollection = async ({
    movement,
    updatedDocs = [],
    updatedCollections = [],
    deletedCollectionIds = [],
    oldAccount = null
  } = {}) => {
    for (const docPayload of updatedDocs) {
      if (docPayload) {
        await handleSaveCxcDocument(docPayload);
      }
    }

    for (const colPayload of updatedCollections) {
      if (colPayload && colPayload.id) {
        await handleUpdateCxcCollection(colPayload, null);
      }
    }

    const delIds = Array.from(new Set((deletedCollectionIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
    for (const colId of delIds) {
      await deleteSupabaseProfitCollection(colId);
    }
    if (delIds.length > 0) {
      const delSet = new Set(delIds);
      setProfitCollections((prev) => (Array.isArray(prev) ? prev.filter((c) => !delSet.has(String(c?.id || '').trim())) : []));
    }

    if (movement) {
      const revUsd = Number(movement.montoUsd || 0);
      const revBs = Number(movement.montoBs || 0);
      const formaUpper = String(movement.formaPago || '').trim().toUpperCase();
      const acctTypeUpper = String(movement.accountType || '').trim().toUpperCase();
      const corrStr = String(movement.correlativo || '');
      const isCreditNoteMov =
        formaUpper === 'NOTA_CREDITO' ||
        acctTypeUpper === 'NOTA_CREDITO' ||
        /^NC-/i.test(corrStr);

      if (!isCreditNoteMov) {
        const resolvedAcct = resolveCxcTreasuryAccount({
          account: oldAccount,
          cuentaId: movement.cuentaId,
          cuentaNombre: movement.cuentaNombre || movement.bancoCuenta,
          formaPago: formaUpper
        });
        if (resolvedAcct && (revUsd > 0 || revBs > 0)) {
          await applyTreasuryAccountDelta({
            account: resolvedAcct.account,
            deltaUsd: -revUsd,
            deltaBs: -revBs,
            clampZero: true
          });
        }

        try {
          const matchedMov = findMatchingCxcCashMovement({
            factNum: movement.factNum,
            cobNum: movement.cobNum || movement.collectionId,
            correlativo: movement.correlativo,
            referencia: movement.referencia,
            fecha: movement.fecha,
            montoUsd: revUsd,
            cuentaId: movement.cuentaId,
            cuentaNombre: movement.cuentaNombre || movement.bancoCuenta
          });
          if (matchedMov) {
            const remaining = await deleteSupabaseCashMovement(matchedMov);
            setCashMovementsState((prev) =>
              Array.isArray(remaining) ? remaining : removeCashMovementFromList(prev, matchedMov.id)
            );
          }
        } catch (movErr) {
          console.warn('[handleDeleteCxcCollection] Aviso eliminando movimiento en Caja:', movErr?.message || movErr);
        }
      }

      if (revUsd > 0) {
        adjustCxcClientDebt({
          clienteId: movement.clienteId,
          clienteRif: movement.rif || movement.clienteRif,
          deltaUsd: revUsd
        });
      }
    }

    return true;
  };

  // Guardar o Editar Documento CxP (Factura de Compra, Adelanto, etc.)
  const handleSaveCxpDocument = async (payableData) => {
    const saved = await saveSupabaseProfitAccountsPayable(payableData);
    if (!saved) return null;
    setProfitAccountsPayable(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex(p => doesPayableMatchDocument(p, saved));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...saved };
        return list;
      }
      return [saved, ...list];
    });
    return saved;
  };

  // Eliminar / Anular Documento CxP (protegido contra colisión de nroDoc entre proveedores)
  const handleDeleteCxpDocument = async (payableOrId) => {
    try {
      const isObj = payableOrId && typeof payableOrId === 'object';
      const rawId = isObj ? String(payableOrId?.id || '').trim() : String(payableOrId || '').trim();
      await deleteSupabaseProfitAccountsPayable(payableOrId);
      setProfitAccountsPayable(prev => (prev || []).filter(p => {
        if (!p) return false;
        if (isObj) return !doesPayableMatchDocument(p, payableOrId);
        return String(p.id || '').trim() !== rawId;
      }));
      notify.success('Documento de Cuenta por Pagar eliminado con éxito');
      return true;
    } catch (err) {
      console.error('Error eliminando documento CxP:', err);
      notify.error('Error al eliminar el documento de Cuenta por Pagar');
      throw err;
    }
  };

  // CRUD de Cuentas por Pagar Pasivas (Socios · 2.02.01.001)
  const handleSavePartnerPayableAccount = (accountPayload) => {
    setPartnerPayableAccountsState(prev => upsertPartnerPayableAccountInList(prev, accountPayload));
  };

  const handleDeletePartnerPayableAccount = (idOrCode) => {
    setPartnerPayableAccountsState(prev => removePartnerPayableAccountFromList(prev, idOrCode));
  };

  const handleAdjustPartnerPayableBalance = async ({
    targetRef,
    deltaUsd = 0,
    deltaBs = 0,
    treasuryAccount = null,
    skipTreasuryDeduction = false
  }) => {
    const absUsd = Math.abs(Number(deltaUsd || 0));
    const absBs = Math.abs(Number(deltaBs || 0));
    let createdCashMovementId = null;

    if (treasuryAccount && !skipTreasuryDeduction && deltaUsd < 0 && absUsd > 0) {
      await applyTreasuryAccountDelta({
        account: treasuryAccount,
        deltaUsd: -absUsd,
        deltaBs: -absBs,
        clampZero: true
      });
      const isCaja = inferTreasuryAccountKind(treasuryAccount) === 'CAJA';
      const tasaOp = Number(treasuryAccount.tasa || config?.tasaDolar || 827.73);
      const movPayload = {
        tipo: 'EGRESO',
        categoria: 'ABONO_PASIVO_SOCIO',
        cuentaGasto: '2.02.01.001',
        cuentaGastoDesc: 'Cuentas por Pagar Socio',
        concepto: treasuryAccount.concepto || `Abono / Reembolso a Cuenta Pasiva Socio (${targetRef})`,
        montoUsd: Number(absUsd.toFixed(2)),
        montoBs: Number(absBs.toFixed(2)),
        tasa: tasaOp,
        tasaPago: tasaOp,
        tipoTasa: String(treasuryAccount.moneda || '').toUpperCase() === 'BS' ? 'BCV' : 'USD',
        monedaPago: String(treasuryAccount.moneda || '').toUpperCase() === 'BS' ? 'BS' : 'USD',
        moneda: String(treasuryAccount.moneda || '').toUpperCase() === 'BS' ? 'BS' : 'US$',
        metodo: treasuryAccount.metodoPago || (isCaja ? 'EFECTIVO_USD' : 'TRANSFERENCIA'),
        metodoPago: treasuryAccount.metodoPago || (isCaja ? 'EFECTIVO_USD' : 'TRANSFERENCIA'),
        cajaId: isCaja ? (treasuryAccount.rawId || treasuryAccount.id || null) : null,
        cuentaId: treasuryAccount.rawId || treasuryAccount.id || '',
        cuentaNombre: treasuryAccount.label || '',
        cajaOBanco: treasuryAccount.label || '',
        accountKind: isCaja ? 'CAJA' : 'BANCO',
        partnerAccountId: String(targetRef || ''),
        referenciaTipo: 'PASIVO_SOCIO',
        referenciaId: String(targetRef || ''),
        referencia: treasuryAccount.referencia || String(targetRef || ''),
        fecha: treasuryAccount.fecha || new Date().toISOString().split('T')[0],
        usuario: currentUser?.nombre || currentUser?.username || 'TESORERÍA'
      };
      const createdMov = await addSupabaseCashMovement(movPayload);
      if (createdMov) {
        createdCashMovementId = createdMov.id || null;
        setCashMovementsState(prev => upsertCashMovementInList(prev, createdMov));
      }
    }

    setPartnerPayableAccountsState(prev =>
      applyPartnerPayableBalanceDeltaInList(prev, { targetRef, deltaUsd, deltaBs })
    );
    return createdCashMovementId;
  };

  // Registrar Pago a Proveedor en Cuentas por Pagar (Parte A) con atomicidad y egreso en flujo de caja
  const handleRegisterCxpPayment = async ({ updatedDoc, paymentPayload, selectedAccount }) => {
    const prevDocSnapshot = (profitAccountsPayable || []).find(p => doesPayableMatchDocument(p, updatedDoc)) || null;
    const savedDoc = await handleSaveCxpDocument(updatedDoc);

    let savedPay = null;
    if (paymentPayload) {
      try {
        savedPay = await saveSupabaseProfitSupplierPayment(paymentPayload);
        if (savedPay) {
          setProfitSupplierPayments(prev => dedupeSupplierPaymentsList([savedPay, ...(Array.isArray(prev) ? prev : [])]));
        }
      } catch (payErr) {
        if (prevDocSnapshot) {
          await handleSaveCxpDocument(prevDocSnapshot).catch(() => {});
        }
        throw payErr;
      }
    }

    const isPartnerPayableSource = Boolean(
      selectedAccount && (
        selectedAccount.accountType === 'PASIVO_SOCIO'
        || selectedAccount.kind === 'PASIVO_SOCIO'
        || String(selectedAccount.key || selectedAccount.id || '').startsWith('SOCIO-')
      )
    );

    if (selectedAccount) {
      const montoUsd = Number(paymentPayload?.montoUsd || 0);
      const montoBs = Number(paymentPayload?.montoBs || 0);
      if (isPartnerPayableSource) {
        setPartnerPayableAccountsState(prev =>
          applyPartnerPayableBalanceDeltaInList(prev, {
            targetRef: selectedAccount.rawId || selectedAccount.id || selectedAccount.key,
            deltaUsd: montoUsd,
            deltaBs: montoBs
          })
        );
      } else {
        try {
          await applyTreasuryAccountDelta({
            account: selectedAccount,
            deltaUsd: -montoUsd,
            deltaBs: -montoBs,
            clampZero: true
          });
        } catch (acctErr) {
          console.error('[handleRegisterCxpPayment] Error debitando caja/banco:', acctErr?.message || acctErr);
          if (prevDocSnapshot) {
            await handleSaveCxpDocument(prevDocSnapshot).catch(() => {});
          }
          throw new Error('No se pudo debitar la cuenta bancaria/caja seleccionada: ' + (acctErr?.message || acctErr));
        }
      }
    }

    // Registrar movimiento EGRESO en Caja Chica / Flujo de Caja solo si salió de Caja o Banco (no aplica cuando lo asume un Pasivo Socio)
    const montoPagadoUsd = Number(paymentPayload?.montoUsd || 0);
    if (montoPagadoUsd > 0 && !isPartnerPayableSource) {
      try {
        const payRateType = normalizeRateType(paymentPayload?.tipoTasa, {
          tipoDoc: updatedDoc?.tipoDoc || updatedDoc?.tipo_doc,
          monedaPago: paymentPayload?.monedaPago || paymentPayload?.moneda,
          fallback: 'BCV'
        });
        const payTasa = Number(paymentPayload?.tasaPago || paymentPayload?.tasa || config?.tasaDolar || 1);
        const isCashSource = Boolean(
          selectedAccount && (
            selectedAccount.accountType === 'CAJA' ||
            selectedAccount.kind === 'CAJA' ||
            inferTreasuryAccountKind(selectedAccount) === 'CAJA'
          )
        );
        const mov = {
          tipo: 'EGRESO',
          categoria: 'PAGO_PROVEEDOR',
          concepto: paymentPayload?.descrip || `Pago a proveedor ${paymentPayload?.provNombre || savedDoc?.provNombre || ''} (${updatedDoc?.tipoDoc || 'DOC'} #${updatedDoc?.nroDoc || ''})`.trim(),
          montoUsd: montoPagadoUsd,
          montoBs: Number(paymentPayload?.montoBs || 0),
          tasa: payTasa,
          tipoTasa: payRateType,
          tasaPago: payTasa,
          monedaPago: paymentPayload?.monedaPago || (payRateType === 'USD' ? 'USD' : 'BS'),
          moneda: paymentPayload?.moneda || (selectedAccount?.moneda === 'USD' ? 'US$' : 'BS'),
          cajaId: isCashSource ? (selectedAccount?.rawId || selectedAccount?.id || paymentPayload?.cajaId || null) : null,
          accountKind: isCashSource ? 'CAJA' : 'BANCO',
          cuentaId: selectedAccount?.rawId || selectedAccount?.id || paymentPayload?.cuentaId || '',
          cuentaNombre: selectedAccount?.nombre || paymentPayload?.cuentaNombre || '',
          referencia: paymentPayload?.referencia || savedPay?.pagoNum || '',
          fecha: paymentPayload?.fechaPago || new Date().toISOString().split('T')[0],
          usuario: currentUser?.nombre || currentUser?.username || 'TESORERIA'
        };
        const createdMov = await addSupabaseCashMovement(mov);
        if (createdMov) {
          setCashMovementsState(prev => upsertCashMovementInList(prev, createdMov));
        }
      } catch (movErr) {
        console.warn('[handleRegisterCxpPayment] No se pudo registrar egreso en flujo de caja:', movErr?.message || movErr);
      }
    }

    const providerContext = paymentPayload || savedDoc;
    if (providerContext && montoPagadoUsd > 0) {
      setSuppliersState(prev => {
        const list = Array.isArray(prev) ? [...prev] : [];
        return list.map(s => {
          if (doProvidersMatch(s, providerContext)) {
            const currentDebt = Number(s.saldoPendienteUsd ?? s.saldo_pendiente_usd ?? 0);
            const newDebt = Math.max(0, Number((currentDebt - montoPagadoUsd).toFixed(2)));
            return {
              ...s,
              saldoPendienteUsd: newDebt,
              saldo_pendiente_usd: newDebt
            };
          }
          return s;
        });
      });
    }

    return savedDoc;
  };

  // Proceder a facturar un Pedido en el POS
  const handleProceedToInvoiceFromOrder = (order) => {
    setPendingOrderToBill(order);
    setActiveTab('ventas');
  };

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loader-container">
          <img src={signumLogoImg} alt="SIGNUM MOTORVEN" className="loader-logo" />
          <div className="loader-spinner"></div>
          <div className="loader-subtext">Iniciando SIGNUM MOTORVEN...</div>
          <div className="loader-progress-bar">
            <div className="loader-progress-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error-screen">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-text">Error de Conexión</div>
          <div className="error-message">{error}</div>
          <button onClick={() => window.location.reload()} className="retry-btn">
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, mostrar pantalla interna de Login
  if (!currentUser) {
    return (
      <LoginView
        usersList={usersList}
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  const handleUpdateSellerTarget = async (coVen, data) => {
    setProfitSellers(prev => {
      const base = (prev && prev.length > 0) ? [...prev] : [...DEFAULT_PROFIT_SELLERS];
      return base.map(s => {
        const c = (s.coVen || s.co_ven || s.id || '').toString().trim();
        if (c === coVen.toString().trim()) {
          return {
            ...s,
            metaLitrosMes: Number(data.metaLitrosMes),
            meta_litros_mes: Number(data.metaLitrosMes),
            comisionPct: Number(data.comisionPct),
            comision_pct: Number(data.comisionPct)
          };
        }
        return s;
      });
    });
    try {
      await updateSupabaseSellerTarget(coVen, data);
      const fresh = await getSupabaseProfitSellers();
      if (fresh && fresh.length > 0) setProfitSellers(fresh);
    } catch (err) {
      console.warn('[Fuerza de Ventas] Guardado reactivo local. Supabase:', err?.message);
    }
  };

  const handleUpdateGlobalTarget = async (totalLitrosMeta) => {
    const currentList = (profitSellers && profitSellers.length > 0) ? profitSellers : DEFAULT_PROFIT_SELLERS;
    const activeCodes = currentList.map(s => (s.coVen || s.co_ven || s.id || '').toString().trim()).filter(Boolean);
    const quotaPerSeller = activeCodes.length > 0 ? parseFloat((totalLitrosMeta / activeCodes.length).toFixed(2)) : totalLitrosMeta;

    setProfitSellers(prev => {
      const base = (prev && prev.length > 0) ? [...prev] : [...DEFAULT_PROFIT_SELLERS];
      return base.map(s => ({
        ...s,
        metaLitrosMes: quotaPerSeller,
        meta_litros_mes: quotaPerSeller
      }));
    });

    try {
      await updateSupabaseConfig({ metaComercialLitros: totalLitrosMeta });
      setConfigState(prev => ({ ...prev, metaComercialLitros: totalLitrosMeta }));
    } catch (e) {
      console.warn('[Fuerza de Ventas] Error actualizando config global:', e.message);
    }

    try {
      await updateSupabaseGlobalSellersTarget(activeCodes, totalLitrosMeta);
      const fresh = await getSupabaseProfitSellers();
      if (fresh && fresh.length > 0) setProfitSellers(fresh);
    } catch (err) {
      console.warn('[Fuerza de Ventas] Error persistiendo meta distribuida en Supabase:', err?.message);
    }
  };

  const handleUpdateSellerPhoto = async (coVen, photoUrl) => {
    const targetClean = String(coVen || '').trim().replace(/^usr-seller-/i, '').toLowerCase();
    setProfitSellers(prev => {
      const base = (prev && prev.length > 0) ? [...prev] : [...DEFAULT_PROFIT_SELLERS];
      return base.map(s => {
        const c = (s.coVen || s.co_ven || s.id || '').toString().trim().replace(/^usr-seller-/i, '').toLowerCase();
        if (c === targetClean) {
          return { ...s, foto: photoUrl || '' };
        }
        return s;
      });
    });
    try {
      await updateSupabaseSellerPhoto(coVen, photoUrl);
      const fresh = await getSupabaseProfitSellers();
      if (fresh && fresh.length > 0) setProfitSellers(fresh);
      const freshUsers = await getSupabaseUsers();
      if (freshUsers && freshUsers.length > 0) setUsersList(freshUsers);
    } catch (err) {
      console.warn('[Fuerza de Ventas] Error actualizando foto asesor:', err?.message);
    }
  };

  const handleUpdateSellerZone = async (coVen, zoneData) => {
    const cleanTargetCoVen = String(coVen || '').trim().replace(/^usr-seller-/i, '').trim() || String(coVen || '').trim();
    const targetCoZon = String(typeof zoneData === 'object' ? (zoneData.coZon || zoneData.co_zon || '') : (zoneData || '')).trim().toUpperCase();
    const targetZonDes = typeof zoneData === 'object'
      ? (zoneData.zona || zoneData.zonDes || zoneData.zon_des || '')
      : ((profitZones || []).find(z => String(z.coZon || z.co_zon || '').trim().toUpperCase() === targetCoZon)?.zonDes || targetCoZon);

    if (targetCoZon) {
      const currentSellersList = (profitSellers && profitSellers.length > 0) ? profitSellers : DEFAULT_PROFIT_SELLERS;
      const occupant = currentSellersList.find((s) => {
        if (!s || s.activo === false) return false;
        const sCode = String(s.coVen || s.co_ven || s.id || '').trim().replace(/^usr-seller-/i, '').trim().toUpperCase();
        const sZone = String(s.coZon || s.co_zon || '').trim().toUpperCase();
        return sZone === targetCoZon && sCode !== cleanTargetCoVen.toUpperCase();
      });
      if (occupant) {
        const occName = occupant.venDes || occupant.ven_des || occupant.nombre || occupant.coVen || 'otro vendedor';
        throw new Error(`La Zona ${targetCoZon} es exclusiva y ya está asignada a ${occName}. Libérala primero o crea una zona nueva.`);
      }
    }

    setProfitSellers(prev => {
      const base = (prev && prev.length > 0) ? [...prev] : [...DEFAULT_PROFIT_SELLERS];
      let matchedAny = false;
      const mapped = base.map(s => {
        const c = (s.coVen || s.co_ven || s.id || '').toString().trim().replace(/^usr-seller-/i, '').trim();
        if (c.toUpperCase() === cleanTargetCoVen.toUpperCase()) {
          matchedAny = true;
          return {
            ...s,
            coZon: targetCoZon,
            co_zon: targetCoZon,
            zona: targetZonDes
          };
        }
        return s;
      });
      if (!matchedAny) {
        const matchedUsr = (usersList || []).find(u =>
          String(u?.co_ven || u?.coVen || '').trim().toUpperCase() === cleanTargetCoVen.toUpperCase()
        );
        const venName = matchedUsr?.nombre || cleanTargetCoVen;
        mapped.push({
          id: cleanTargetCoVen,
          coVen: cleanTargetCoVen,
          co_ven: cleanTargetCoVen,
          venDes: venName,
          ven_des: venName,
          cedula: matchedUsr?.cedula || '',
          telefonos: matchedUsr?.phone || matchedUsr?.telefono || '',
          foto: matchedUsr?.foto || '',
          avatar: matchedUsr?.avatar || '',
          comisionPct: 3.0,
          metaLitrosMes: 3000,
          activo: true,
          coZon: targetCoZon,
          co_zon: targetCoZon,
          zona: targetZonDes
        });
      }
      return mapped;
    });

    try {
      await updateSupabaseSellerZone(cleanTargetCoVen, { coZon: targetCoZon, zona: targetZonDes });
      const fresh = await getSupabaseProfitSellers();
      if (fresh && fresh.length > 0) setProfitSellers(fresh);
    } catch (err) {
      console.warn('[Fuerza de Ventas] Error actualizando zona de asesor:', err?.message);
    }
  };

  const handleSaveProfitZone = async (zoneData) => {
    const savedZone = await saveSupabaseProfitZone(zoneData, profitZones);
    const savedCode = String(savedZone.coZon || savedZone.co_zon || '').trim().toUpperCase();
    const savedName = String(savedZone.zonDes || savedZone.zon_des || '').trim();

    setProfitZones(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const filtered = list.filter(z => {
        const zId = String(z?.id || '').trim();
        const zCode = String(z?.coZon || z?.co_zon || '').trim().toUpperCase();
        return zId !== String(savedZone.id) && zCode !== savedCode;
      });
      filtered.push(savedZone);
      return filtered.sort((a, b) =>
        String(a.coZon || a.co_zon || '').localeCompare(String(b.coZon || b.co_zon || ''), undefined, { numeric: true })
      );
    });

    // Sincronizar el nombre actualizado de la zona en el vendedor asignado (si aplica)
    const affectedSellers = (profitSellers || []).filter(
      s => String(s?.coZon || s?.co_zon || '').trim().toUpperCase() === savedCode && String(s?.zona || '').trim() !== savedName
    );
    if (affectedSellers.length > 0) {
      setProfitSellers(prev =>
        (prev || []).map(s =>
          String(s?.coZon || s?.co_zon || '').trim().toUpperCase() === savedCode
            ? { ...s, zona: savedName }
            : s
        )
      );
      await Promise.all(
        affectedSellers.map(s =>
          updateSupabaseSellerZone(s.coVen || s.co_ven || s.id, { coZon: savedCode, zona: savedName }).catch(() => {})
        )
      );
    }

    return savedZone;
  };

  const handleDeleteProfitZone = async (zoneOrCoZon) => {
    const targetId = typeof zoneOrCoZon === 'object' ? String(zoneOrCoZon?.id || '').trim() : '';
    const targetCode = String(
      typeof zoneOrCoZon === 'object' ? (zoneOrCoZon?.coZon || zoneOrCoZon?.co_zon || '') : (zoneOrCoZon || '')
    ).trim().toUpperCase();

    await deleteSupabaseProfitZone(zoneOrCoZon);

    setProfitZones(prev =>
      (prev || []).filter(z => {
        const zId = String(z?.id || '').trim();
        const zCode = String(z?.coZon || z?.co_zon || '').trim().toUpperCase();
        return (!targetId || zId !== targetId) && (!targetCode || zCode !== targetCode);
      })
    );

    if (targetCode) {
      const affectedSellers = (profitSellers || []).filter(
        s => String(s?.coZon || s?.co_zon || '').trim().toUpperCase() === targetCode
      );
      if (affectedSellers.length > 0) {
        setProfitSellers(prev =>
          (prev || []).map(s =>
            String(s?.coZon || s?.co_zon || '').trim().toUpperCase() === targetCode
              ? { ...s, coZon: '', co_zon: '', zona: '' }
              : s
          )
        );
        await Promise.all(
          affectedSellers.map(s =>
            updateSupabaseSellerZone(s.coVen || s.co_ven || s.id, { coZon: '', zona: '' }).catch(() => {})
          )
        );
      }
    }
    return true;
  };

  if (deviceViewMode === 'mobile') {
    return (
      <MobileAppLayout
        products={products}
        clients={syncedClients}
        suppliers={suppliers}
        purchases={purchases}
        cashMovements={cashMovements}
        fiscalClosures={fiscalClosures}
        orders={orders}
        sales={sales}
        profitInvoices={profitInvoices}
        profitCollections={profitCollections}
        profitBankAccounts={profitBankAccounts}
        profitCashDesks={profitCashDesks}
        profitAccountsPayable={profitAccountsPayable}
        profitSupplierPayments={profitSupplierPayments}
        profitPurchases={profitPurchases}
        profitSuppliers={profitSuppliers}
        profitIslrConcepts={profitIslrConcepts}
        profitBeneficiaries={profitBeneficiaries}
        profitPaymentOrders={profitPaymentOrders}
        profitIslrWithholdings={profitIslrWithholdings}
        profitReturns={profitReturns}
        profitSellers={profitSellers}
        profitZones={profitZones}
        usersList={usersList}
        config={config}
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSwitchToDesktop={handleSwitchToDesktop}
        onSaveOrder={handleSaveOrder}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onDeleteOrder={handleDeleteOrder}
        onProceedToPOS={handleProceedToInvoiceFromOrder}
        pendingOrderToBill={pendingOrderToBill}
        onClearPendingOrder={() => setPendingOrderToBill(null)}
        onProcessSale={handleProcessSale}
        onSaveConfig={handleSaveConfig}
        onSaveProduct={handleSaveProduct}
        onSaveClient={handleSaveClient}
        onDeleteClient={handleDeleteClient}
        onApproveClient={handleApproveClient}
        onRejectClient={handleRejectClient}
        onRegisterPurchase={handleRegisterPurchase}
        onAddCashMovement={handleAddCashMovement}
        onUpdateCashMovement={handleUpdateCashMovement}
        onDeleteCashMovement={handleDeleteCashMovement}
        onUpdateCashDesk={handleUpdateCashDesk}
        onDeleteCashDesk={handleDeleteCashDesk}
        onUpdateBankAccount={handleUpdateBankAccount}
        onDeleteBankAccount={handleDeleteBankAccount}
        onExecuteCierreZ={handleExecuteCierreZ}
        onOpenOrdersSalesModal={handleOpenOrdersSalesModal}
        onUsersUpdated={handleUsersUpdated}
        onUpdateCurrentUser={handleUpdateCurrentUser}
        onSyncProfit={handleSyncProfit}
        onUpdateSellerTarget={handleUpdateSellerTarget}
        onUpdateGlobalTarget={handleUpdateGlobalTarget}
        onUpdateSellerPhoto={handleUpdateSellerPhoto}
        onUpdateSellerZone={handleUpdateSellerZone}
        onCommissionSettlementsChange={setCommissionSettlements}
        profitIncomeExpenseAccounts={profitIncomeExpenseAccounts}
        profitInventoryAdjustments={profitInventoryAdjustments}
        commissionSettlements={commissionSettlements}
        expenses={expenses}
        payroll={payroll}
        employees={employees}
        onSaveExpense={handleSaveExpense}
        onDeleteExpense={handleDeleteExpense}
        onSaveEmployee={handleSaveEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onSavePayroll={handleSavePayroll}
        onDeletePayroll={handleDeletePayroll}
        partnerPayableAccounts={partnerPayableAccounts}
        onSavePartnerPayableAccount={handleSavePartnerPayableAccount}
        onDeletePartnerPayableAccount={handleDeletePartnerPayableAccount}
        onAdjustPartnerPayableBalance={handleAdjustPartnerPayableBalance}
        profitAuditTrails={profitAuditTrails}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        config={config}
        onUpdateTasa={handleUpdateTasa}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenOrdersSalesModal={handleOpenOrdersSalesModal}
        onOpenCashBankModal={() => setActiveTab('caja')}
        onOpenAccountsReceivableModal={() => setActiveTab('cxc')}
        onOpenAccountsPayableModal={() => setActiveTab('cxp')}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        orders={orders}
      />

      <div className="main-wrapper">
        <HeaderBar
          config={config}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onUpdateTasa={handleUpdateTasa}
          onUpdateTasaKeystone={handleUpdateTasaKeystone}
          onSaveConfig={handleSaveConfig}
          onNavigate={setActiveTab}
          currentUser={currentUser}
          onUpdateCurrentUser={handleUpdateCurrentUser}
          onLogout={handleLogout}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          onSyncProfit={handleSyncProfit}
          onOpenOrdersSalesModal={handleOpenOrdersSalesModal}
          productsCount={products?.length || 29}
          clientsCount={syncedClients?.length || 631}
          products={products}
          clients={syncedClients}
          sales={sales}
          orders={orders}
          suppliers={suppliers}
          cashMovements={cashMovements}
        />

        <main className="content-body">
          {activeTab === 'dashboard' && canAccessModule(currentUser?.rol, 'dashboard', currentUser) && (
            <DashboardView
              products={products}
              sales={sales}
              clients={syncedClients}
              orders={orders}
              profitInvoices={profitInvoices}
              profitCollections={profitCollections}
              profitBankAccounts={profitBankAccounts}
              profitAccountsPayable={profitAccountsPayable}
              profitSupplierPayments={profitSupplierPayments}
              profitPurchases={profitPurchases}
              profitSellers={profitSellers}
              config={config}
              currentUser={currentUser}
              onNavigate={setActiveTab}
              onSyncProfit={handleSyncProfit}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onApproveClient={handleApproveClient}
              onRejectClient={handleRejectClient}
              profitZones={profitZones}
              onOpenOrdersSalesModal={handleOpenOrdersSalesModal}
              onSelectClientForModule={handleSelectClientForModule}
            />
          )}

          {activeTab === 'preventa' && canAccessModule(currentUser?.rol, 'preventa', currentUser) && (
            <ModuleErrorBoundary moduleName="Preventa Móvil (Vendedor)">
              <SellerOrderPOSView
                products={products}
                clients={syncedClients}
                orders={orders}
                profitInvoices={profitInvoices}
                profitCollections={profitCollections}
                sales={sales}
                profitSellers={profitSellers}
                config={config}
                profitZones={profitZones}
                currentUser={currentUser}
                onSaveOrder={handleSaveOrder}
                onSaveClient={handleSaveClient}
                onApproveClient={handleApproveClient}
                onRejectClient={handleRejectClient}
                onSyncProfit={handleSyncProfit}
              />
            </ModuleErrorBoundary>
          )}

          {activeTab === 'pedidos' && canAccessModule(currentUser?.rol, 'pedidos', currentUser) && (
            <OrdersSalesModal
              orders={orders}
              clients={syncedClients}
              products={products}
              config={config}
              profitZones={profitZones}
              profitTransports={profitTransports}
              profitSellers={profitSellers}
              profitInvoices={profitInvoices}
              sales={sales}
              onSaveOrder={handleSaveOrder}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onProcessSale={handleProcessSale}
              onDeleteOrder={handleDeleteOrder}
              onDeleteSale={handleDeleteSale}
              onSyncProfit={handleSyncProfit}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onApproveClient={handleApproveClient}
              onRejectClient={handleRejectClient}
              currentUser={currentUser}
              initialTab={ordersSalesModalTab}
              initialOrder={ordersSalesModalOrder}
              onProceedToPOS={handleProceedToInvoiceFromOrder}
              onSaveCxcDocument={handleSaveCxcDocument}
              onUpdateInvoiceDocument={handleUpdateInvoiceDocument}
            />
          )}

          {activeTab === 'inventario' && canAccessModule(currentUser?.rol, 'inventario', currentUser) && (
            <InventoryView
              products={products}
              config={config}
              inventoryAdjustments={profitInventoryAdjustments}
              warehouseTransfers={profitWarehouseTransfers}
              profitInvoices={profitInvoices}
              sales={sales}
              purchases={purchases}
              profitPurchases={profitPurchases}
              goodsReceiptNotes={goodsReceiptNotes}
              profitReturns={profitReturns}
              profitSuppliers={profitSuppliers}
              onSyncProfit={handleSyncProfit}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onSaveTransfer={handleSaveWarehouseTransfer}
              onSaveAdjustment={handleSaveInventoryAdjustment}
              globalSearch={globalSearch}
              currentUser={currentUser}
              warehouses={profitWarehouses}
              productLines={profitProductLines}
              productCategories={profitProductCategories}
            />
          )}

          {activeTab === 'ventas' && canAccessModule(currentUser?.rol, 'ventas', currentUser) && (
            <SalesPOSView
              products={products}
              clients={syncedClients}
              orders={orders}
              sales={sales}
              profitSellers={profitSellers}
              profitZones={profitZones}
              config={config}
              profitReturns={profitReturns}
              profitInvoices={profitInvoices}
              profitCollections={profitCollections}
              onSyncProfit={handleSyncProfit}
              onProcessSale={handleProcessSale}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onApproveClient={handleApproveClient}
              onRejectClient={handleRejectClient}
              onSaveCustomerReturn={handleSaveCustomerReturn}
              onOpenOrdersSalesModal={handleOpenOrdersSalesModal}
              currentUser={currentUser}
              pendingOrderToBill={pendingOrderToBill}
              onClearPendingOrder={() => setPendingOrderToBill(null)}
              preselectedClient={preselectedClient}
              onClearPreselectedClient={() => setPreselectedClient(null)}
            />
          )}

          {activeTab === 'vendedores' && canAccessModule(currentUser?.rol, 'vendedores', currentUser) && (
            <ModuleErrorBoundary moduleName="Fuerza de Ventas">
              <SellersView
                profitSellers={profitSellers}
                usersList={usersList}
                profitInvoices={profitInvoices}
                profitCollections={profitCollections}
                profitBankAccounts={profitBankAccounts}
                clients={syncedClients}
                orders={orders}
                config={config}
                onSyncProfit={handleSyncProfit}
                onUpdateSellerTarget={handleUpdateSellerTarget}
                onUpdateGlobalTarget={handleUpdateGlobalTarget}
                onUpdateSellerPhoto={handleUpdateSellerPhoto}
                onUpdateSellerZone={handleUpdateSellerZone}
                onSaveProfitZone={handleSaveProfitZone}
                onDeleteProfitZone={handleDeleteProfitZone}
                onAddCashMovement={handleAddCashMovement}
                onCommissionSettlementsChange={setCommissionSettlements}
                profitZones={profitZones}
                currentUser={currentUser}
              />
            </ModuleErrorBoundary>
          )}

          {activeTab === 'rentabilidad' && canAccessModule(currentUser?.rol, 'rentabilidad', currentUser) && (
            <ProfitabilityView
              products={products}
              profitInvoices={profitInvoices}
              sales={sales}
              profitPurchases={profitPurchases}
              profitSellers={profitSellers}
              profitTransports={profitTransports}
              profitZones={profitZones}
              profitReturns={profitReturns}
              profitInventoryAdjustments={profitInventoryAdjustments}
              profitIslrWithholdings={profitIslrWithholdings}
              profitIncomeExpenseAccounts={profitIncomeExpenseAccounts}
              profitCashDesks={profitCashDesks}
              profitBankAccounts={profitBankAccounts}
              cashMovements={cashMovements}
              commissionSettlements={commissionSettlements}
              expenses={expenses}
              payroll={payroll}
              employees={employees}
              clients={syncedClients}
              config={config}
              onSyncProfit={handleSyncProfit}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
              onSaveEmployee={handleSaveEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onSavePayroll={handleSavePayroll}
              onDeletePayroll={handleDeletePayroll}
              onAddCashMovement={handleAddCashMovement}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'compras' && canAccessModule(currentUser?.rol, 'compras', currentUser) && (
            <PurchasesView
              products={products}
              suppliers={suppliers}
              purchases={purchases}
              config={config}
              onSaveProduct={handleSaveProduct}
              onRegisterPurchase={handleRegisterPurchase}
              purchaseRequisitions={purchaseRequisitions}
              purchaseOrders={purchaseOrders}
              goodsReceiptNotes={goodsReceiptNotes}
              onSaveRequisition={handleSavePurchaseRequisition}
              onSavePurchaseOrder={handleSavePurchaseOrder}
              onSaveGoodsReceipt={handleSaveGoodsReceiptNote}
              onSavePaymentOrder={handleSavePaymentOrder}
              onOpenCxpModule={() => setActiveTab('cxp')}
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
              onSyncProfit={handleSyncProfit}
            />
          )}

          {/* MÓDULO 8: CAJA CHICA & BANCOS */}
          {activeTab === 'caja' && canAccessModule(currentUser?.rol, 'caja', currentUser) && (
            <CashBankModal
              cashDesks={profitCashDesks}
              bankAccounts={profitBankAccounts}
              cashMovements={cashMovements}
              profitIncomeExpenseAccounts={profitIncomeExpenseAccounts}
              onAddMovement={handleAddCashMovement}
              onUpdateMovement={handleUpdateCashMovement}
              onDeleteMovement={handleDeleteCashMovement}
              onUpdateCashDesk={handleUpdateCashDesk}
              onDeleteCashDesk={handleDeleteCashDesk}
              onUpdateBankAccount={handleUpdateBankAccount}
              onDeleteBankAccount={handleDeleteBankAccount}
              partnerPayableAccounts={partnerPayableAccounts}
              onAdjustPartnerPayableBalance={handleAdjustPartnerPayableBalance}
              config={config}
              currentUser={currentUser}
            />
          )}

          {/* MÓDULO 8.1: CUENTAS POR COBRAR (CXC) & AGING */}
          {activeTab === 'cxc' && canAccessModule(currentUser?.rol, 'cxc', currentUser) && (
            <AccountsReceivableModal
              invoices={sales}
              profitInvoices={profitInvoices}
              products={products}
              clients={syncedClients}
              sellers={profitSellers}
              profitSellers={profitSellers}
              profitZones={profitZones}
              bankAccounts={profitBankAccounts}
              cashDesks={profitCashDesks}
              collections={profitCollections}
              config={config}
              currentUser={currentUser}
              onOpenCollectionIntelligence={() => setShowDebtCollectionModal(true)}
              onDeleteSale={handleDeleteSale}
              onSaveDocument={handleSaveCxcDocument}
              onRegisterCollection={handleRegisterCxcCollection}
              onUpdateCollection={handleUpdateCxcCollection}
              onDeleteCollection={handleDeleteCxcCollection}
              onIssueCreditDebitNote={handleIssueCxcCreditDebitNote}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onApproveClient={handleApproveClient}
              onRejectClient={handleRejectClient}
              preselectedClient={preselectedClient}
              onClearPreselectedClient={() => setPreselectedClient(null)}
            />
          )}

          {/* MÓDULO 8.2: CUENTAS POR PAGAR (CXP) & PROVEEDORES */}
          {activeTab === 'cxp' && canAccessModule(currentUser?.rol, 'cxp', currentUser) && (
            <AccountsPayableModal
              accountsPayable={profitAccountsPayable}
              profitAccountsPayable={profitAccountsPayable}
              suppliers={profitSuppliers}
              profitSuppliers={profitSuppliers}
              bankAccounts={profitBankAccounts}
              cashDesks={profitCashDesks}
              partnerPayableAccounts={partnerPayableAccounts}
              supplierPayments={profitSupplierPayments}
              config={config}
              currentUser={currentUser}
              onRegisterPayment={handleRegisterCxpPayment}
              onSaveDocument={handleSaveCxpDocument}
              onDeleteDocument={handleDeleteCxpDocument}
            />
          )}

          {/* MÓDULO 8.3: CUENTAS DE PASIVO & SOCIOS (2.02.01.001) */}
          {activeTab === 'pasivos' && canAccessModule(currentUser?.rol, 'pasivos', currentUser) && (
            <PasivosView
              partnerPayableAccounts={partnerPayableAccounts}
              onSavePartnerPayableAccount={handleSavePartnerPayableAccount}
              onDeletePartnerPayableAccount={handleDeletePartnerPayableAccount}
              onAdjustPartnerPayableBalance={handleAdjustPartnerPayableBalance}
              accountsPayable={profitAccountsPayable}
              profitAccountsPayable={profitAccountsPayable}
              supplierPayments={profitSupplierPayments}
              cashDesks={profitCashDesks}
              bankAccounts={profitBankAccounts}
              onDeleteCashMovement={handleDeleteCashMovement}
              config={config}
              currentUser={currentUser}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'reportes' && canAccessModule(currentUser?.rol, 'reportes', currentUser) && (
            <TaxReportsView
              sales={sales}
              purchases={purchases}
              suppliers={suppliers}
              profitSuppliers={profitSuppliers}
              fiscalClosures={fiscalClosures}
              onExecuteCierreZ={handleExecuteCierreZ}
              config={config}
              currentUser={currentUser}
              profitIslrConcepts={profitIslrConcepts}
              profitBeneficiaries={profitBeneficiaries}
              profitPaymentOrders={profitPaymentOrders}
              profitIslrWithholdings={profitIslrWithholdings}
              profitAccountsPayable={profitAccountsPayable}
              profitPurchases={profitPurchases}
              onSyncProfit={handleSyncProfit}
            />
          )}

          {activeTab === 'auditoria' && canAccessModule(currentUser?.rol, 'auditoria', currentUser) && (
            <AuditLedgerView
              profitInvoices={profitInvoices}
              profitCollections={profitCollections}
              profitPurchases={profitPurchases}
              profitSupplierPayments={profitSupplierPayments}
              profitBankAccounts={profitBankAccounts}
              profitCashDesks={profitCashDesks}
              cashDesks={profitCashDesks}
              profitAuditTrails={profitAuditTrails}
              cashMovements={cashMovements}
              usersList={usersList}
              config={config}
              onSyncProfit={handleSyncProfit}
              currentUser={currentUser}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'usuarios' && canAccessModule(currentUser?.rol, 'usuarios', currentUser) && (
            <UsersManagementView
              currentUser={currentUser}
              usersList={usersList}
              config={config}
              onUpdateCurrentUser={handleUpdateCurrentUser}
              onUsersUpdated={handleUsersUpdated}
            />
          )}


          {/* MÓDULO: CENTRO DE NOTIFICACIONES & ALERTAS */}
          {activeTab === 'notificaciones' && canAccessModule(currentUser?.rol, 'notificaciones', currentUser) && (
            <NotificationsCenterModal
              isOpen={true}
              onClose={() => setActiveTab('dashboard')}
              config={config}
              currentUser={currentUser}
              products={products}
              clients={syncedClients}
              onNavigate={setActiveTab}
            />
          )}

          {/* MÓDULO: CONFIGURACIÓN GENERAL DEL SISTEMA */}
          {activeTab === 'configuracion' && canAccessModule(currentUser?.rol, 'configuracion', currentUser) && (
            <AppConfigModal
              isOpen={true}
              onClose={() => setActiveTab('dashboard')}
              config={config}
              onSaveConfig={handleSaveConfig}
              currentUser={currentUser}
              products={products}
              clients={syncedClients}
            />
          )}

          {/* Pantalla de Acceso No Autorizado */}
          {currentUser && !canAccessModule(currentUser?.rol, activeTab, currentUser) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '62vh',
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              animation: 'fadeIn 0.25s ease-out'
            }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '2px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                marginBottom: '1.25rem',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)'
              }}>
                <ShieldAlert size={38} />
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 0.5rem 0' }}>
                Módulo No Autorizado
              </h2>
              <p style={{ maxWidth: '480px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
                Su perfil institucional de <strong style={{ color: 'var(--text-primary)' }}>{currentUser.rol}</strong> ({currentUser.nombre}) no cuenta con autorización para visualizar o manipular este módulo del sistema.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const norm = normalizeRole(currentUser.rol);
                  const allowed = (Array.isArray(currentUser.modulos) && currentUser.modulos.length > 0)
                    ? currentUser.modulos
                    : (ROLE_PERMISSIONS[norm] || ['ventas']);
                  const pref = DEFAULT_TABS_BY_ROLE[norm];
                  setActiveTab(allowed.includes(pref) ? pref : (allowed[0] || 'ventas'));
                }}
                style={{ padding: '0.65rem 1.25rem', fontWeight: 700 }}
              >
                Ir a Módulo Principal Autorizado
              </button>
            </div>
          )}
        </main>




        {/* Modal de Inteligencia de Cobranza & WhatsApp */}
        <DebtCollectionIntelligenceModal
          isOpen={showDebtCollectionModal}
          onClose={() => setShowDebtCollectionModal(false)}
          profitInvoices={profitInvoices}
          clients={syncedClients}
          profitSellers={profitSellers}
          profitBankAccounts={profitBankAccounts}
          config={config}
        />

        {/* Botón flotante para alternar a Modo Celular */}
        <button
          type="button"
          className="no-print"
          onClick={handleSwitchToMobile}
          style={{
            position: 'fixed',
            bottom: '18px',
            right: '18px',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '30px',
            padding: '8px 14px',
            fontSize: '0.75rem',
            fontWeight: 800,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Activar versión optimizada para celulares y iPhone"
        >
          <Smartphone size={15} /> Modo Celular 📱
        </button>

      </div>
    </div>
  );
}

export default function App() {
  const isDeviceSimulator = typeof window !== 'undefined' && (
    window.location.search.includes('view=device-simulator') ||
    window.location.search.includes('view=devices') ||
    window.location.hash === '#device-simulator'
  );

  const isSupabaseTablesTab = typeof window !== 'undefined' && (
    window.location.search.includes('view=supabase-tables') ||
    window.location.hash === '#supabase-tables'
  );

  const isProfitCxcTab = typeof window !== 'undefined' && (
    window.location.search.includes('view=profit-cxc') ||
    window.location.hash === '#profit-cxc'
  );


  if (isDeviceSimulator) {
    return <DeviceSimulatorView />;
  }

  if (isSupabaseTablesTab) {
    return <SupabaseTablesView />;
  }

  if (isProfitCxcTab) {
    return <ProfitCxcStandaloneView />;
  }


  return <MainApp />;
}
