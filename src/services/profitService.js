/**
 * Servicio de datos en tiempo real - SIGNUM MOTORVEN
 * La conexion con Profit Plus 2K8 fue ELIMINADA. Supabase es la unica fuente de verdad.
 * Las funciones legadas se conservan como stubs sin red para no romper las importaciones.
 */
import { supabase } from './supabaseService.js';
import { subscribeToRealtimeSync } from './realtimeSyncBridge.js';

const DISCONNECTED_MSG = 'Conexion con Profit Plus eliminada. Supabase es la unica fuente de datos.';
const disconnected = (extra = {}) => ({ success: false, disconnected: true, error: DISCONNECTED_MSG, ...extra });

export async function getProfitBridgeStatus() {
  return {
    isAvailable: false,
    driveOnline: false,
    driveHealth: 'OFFLINE',
    dbHealth: 'DISCONNECTED',
    server: null,
    database: null,
    isSyncing: false,
    lastSyncTime: null,
    lastSyncStats: null
  };
}

export async function getProfitRealtimeProducts() { return null; }
export async function getProfitRealtimeClients() { return null; }
export async function getProfitDashboardKPIs() { return null; }
export async function triggerProfitSync() { return disconnected(); }

/**
 * Suscribe la aplicación a eventos de TIEMPO REAL (Realtime) en Supabase
 * Funciona tanto en todos los navegadores como en todos los dispositivos (PC, Laptop, Smartphone, Tablet, iPhone)
 */
export function subscribeToRealtimeChanges({
  onProductsChange,
  onClientsChange,
  onConfigChange,
  onOrdersChange,
  onBankAccountsChange,
  onCashDesksChange,
  onCollectionsChange,
  onInvoicesChange,
  onSuppliersChange,
  onPurchasesChange,
  onAccountsPayableChange,
  onSupplierPaymentsChange,
  onSellersChange,
  onZonesChange,
  onTransportsChange,
  onCustomerReturnsChange,
  onInventoryAdjustmentsChange,
  onWarehouseTransfersChange,
  onIslrConceptsChange,
  onBeneficiariesChange,
  onPaymentOrdersChange,
  onIslrWithholdingsChange,
  onAuditTrailsChange,
  onUsersChange,
  onSalesChange,
  onCashMovementsChange,
  onFiscalClosuresChange
}) {
  const tableCallbacks = {
    users: onUsersChange,
    products: onProductsChange,
    clients: onClientsChange,
    config: onConfigChange,
    orders: onOrdersChange,
    order_items: onOrdersChange,
    profit_bank_accounts: onBankAccountsChange,
    bank_accounts: onBankAccountsChange,
    profit_cash_desks: onCashDesksChange,
    cash_desks: onCashDesksChange,
    profit_collections: onCollectionsChange,
    collections: onCollectionsChange,
    profit_invoices: onInvoicesChange,
    invoices: onInvoicesChange,
    profit_suppliers: onSuppliersChange,
    suppliers: onSuppliersChange,
    profit_purchases: onPurchasesChange,
    purchases: onPurchasesChange,
    profit_accounts_payable: onAccountsPayableChange,
    accounts_payable: onAccountsPayableChange,
    profit_supplier_payments: onSupplierPaymentsChange,
    supplier_payments: onSupplierPaymentsChange,
    profit_sellers: onSellersChange,
    sellers: onSellersChange,
    profit_zones: onZonesChange,
    zones: onZonesChange,
    profit_transports: onTransportsChange,
    transports: onTransportsChange,
    profit_customer_returns: onCustomerReturnsChange,
    customer_returns: onCustomerReturnsChange,
    profit_inventory_adjustments: onInventoryAdjustmentsChange,
    inventory_adjustments: onInventoryAdjustmentsChange,
    profit_warehouse_transfers: onWarehouseTransfersChange,
    warehouse_transfers: onWarehouseTransfersChange,
    profit_islr_concepts: onIslrConceptsChange,
    islr_concepts: onIslrConceptsChange,
    profit_beneficiaries: onBeneficiariesChange,
    beneficiaries: onBeneficiariesChange,
    profit_payment_orders: onPaymentOrdersChange,
    payment_orders: onPaymentOrdersChange,
    profit_islr_withholdings: onIslrWithholdingsChange,
    islr_withholdings: onIslrWithholdingsChange,
    profit_audit_trails: onAuditTrailsChange,
    audit_trails: onAuditTrailsChange,
    sales: onSalesChange,
    cash_movements: onCashMovementsChange,
    fiscal_closures: onFiscalClosuresChange
  };

  // 1. Suscribir al motor multi-dispositivo SSE + Delta Polling + BroadcastChannel
  const unsubscribeBridge = subscribeToRealtimeSync((evt) => {
    if (!evt) return;
    const rawTable = evt.table || evt.tableId;
    const handler = tableCallbacks[rawTable] || tableCallbacks[evt.tableId];
    if (typeof handler === 'function') {
      handler({
        eventType: evt.eventType || (evt.action === 'DELETE' ? 'DELETE' : 'UPDATE'),
        table: rawTable,
        new: evt.item || null,
        old: evt.action === 'DELETE' ? (evt.item || { id: evt.key }) : null,
        key: evt.key
      });
    }
  });

  // 2. Mantener canal WebSocket nativo de Supabase por compatibilidad si se conecta a Supabase Cloud
  let channel = null;
  try {
    channel = supabase
      .channel('signum-profit-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const handler = tableCallbacks[payload?.table];
        if (typeof handler === 'function') {
          handler(payload);
        }
      })
      .subscribe();
  } catch (_) {}

  return () => {
    unsubscribeBridge();
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    }
  };
}

export async function fetchProfitEndpoint(endpointPath) {
  return { success: false, status: 0, statusText: 'DISCONNECTED', timeMs: 0, url: endpointPath, error: DISCONNECTED_MSG };
}

export async function writeProfitUser() { return disconnected({ queued: false }); }
export async function writeProfitSeller() { return disconnected({ queued: false }); }
export async function writeProfitProduct() { return disconnected({ queued: false }); }
export async function writeProfitClient() { return disconnected({ queued: false }); }
export async function compareProfitEntity() { return disconnected(); }
export async function writeProfitSale() { return disconnected({ queued: false }); }
export async function writeProfitOrder() { return disconnected({ queued: false }); }
export async function writeProfitPurchase() { return disconnected({ queued: false }); }
export async function writeProfitSupplier() { return disconnected({ queued: false }); }
export async function writeProfitCashMovement() { return disconnected({ queued: false }); }

export async function getAllProfitDatabases() {
  return { success: true, source: 'disconnected', serverInfo: null, databases: [] };
}
export async function getProfitDatabaseTables(dbName) { return disconnected({ database: dbName }); }
export async function getProfitDatabaseTableData() { return disconnected(); }
export async function executeProfitDatabaseQuery() { return disconnected(); }
export async function getProfitTableColumns() { return disconnected(); }
export async function saveProfitDatabaseRecord() { return disconnected(); }
export async function deleteProfitDatabaseRecord() { return disconnected(); }
export async function createProfitDatabaseBackup() { return disconnected(); }
export async function getProfitDatabaseBackups() { return { success: false, backups: [] }; }
