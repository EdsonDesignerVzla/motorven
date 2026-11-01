/**
 * Servicio de datos en tiempo real - SIGNUM MOTORVEN
 * La conexion con Profit Plus 2K8 fue ELIMINADA. Supabase es la unica fuente de verdad.
 * Las funciones legadas se conservan como stubs sin red para no romper las importaciones.
 */
import { supabase } from './supabaseService.js';

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
export async function triggerProfitSync() { throw new Error(DISCONNECTED_MSG); }

/**
 * Suscribe la aplicación a eventos de TIEMPO REAL (Realtime) en Supabase
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
  const channel = supabase
    .channel('signum-profit-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en usuarios:', payload.eventType);
        if (onUsersChange) onUsersChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en productos:', payload.eventType);
        if (onProductsChange) onProductsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clients' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en clientes:', payload.eventType);
        if (onClientsChange) onClientsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'config' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en configuración:', payload.eventType);
        if (onConfigChange) onConfigChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en pedidos/preventa:', payload.eventType);
        if (onOrdersChange) onOrdersChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_bank_accounts' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en cuentas bancarias:', payload.eventType);
        if (onBankAccountsChange) onBankAccountsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_cash_desks' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en cajas registradoras:', payload.eventType);
        if (onCashDesksChange) onCashDesksChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_collections' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en cobranzas Profit:', payload.eventType);
        if (onCollectionsChange) onCollectionsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_invoices' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en facturas Profit:', payload.eventType);
        if (onInvoicesChange) onInvoicesChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_suppliers' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en proveedores Profit:', payload.eventType);
        if (onSuppliersChange) onSuppliersChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_purchases' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en compras Profit:', payload.eventType);
        if (onPurchasesChange) onPurchasesChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_accounts_payable' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en CxP Profit:', payload.eventType);
        if (onAccountsPayableChange) onAccountsPayableChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_supplier_payments' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en pagos a proveedores:', payload.eventType);
        if (onSupplierPaymentsChange) onSupplierPaymentsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_sellers' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en vendedores Profit:', payload.eventType);
        if (onSellersChange) onSellersChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_zones' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en zonas Profit:', payload.eventType);
        if (onZonesChange) onZonesChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_transports' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en transportes Profit:', payload.eventType);
        if (onTransportsChange) onTransportsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_customer_returns' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en devoluciones de clientes Profit:', payload.eventType);
        if (onCustomerReturnsChange) onCustomerReturnsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_inventory_adjustments' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en ajustes de inventario Profit:', payload.eventType);
        if (onInventoryAdjustmentsChange) onInventoryAdjustmentsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_warehouse_transfers' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en traslados entre almacenes Profit:', payload.eventType);
        if (onWarehouseTransfersChange) onWarehouseTransfersChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_islr_concepts' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en conceptos ISLR Profit:', payload.eventType);
        if (onIslrConceptsChange) onIslrConceptsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_beneficiaries' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en beneficiarios Profit:', payload.eventType);
        if (onBeneficiariesChange) onBeneficiariesChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_payment_orders' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en órdenes de pago Profit:', payload.eventType);
        if (onPaymentOrdersChange) onPaymentOrdersChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_islr_withholdings' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en comprobantes ISLR Profit:', payload.eventType);
        if (onIslrWithholdingsChange) onIslrWithholdingsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profit_audit_trails' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en pistas de auditoría Profit:', payload.eventType);
        if (onAuditTrailsChange) onAuditTrailsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sales' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en ventas:', payload.eventType);
        if (onSalesChange) onSalesChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'purchases' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en compras:', payload.eventType);
        if (onPurchasesChange) onPurchasesChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cash_movements' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en movimientos de caja:', payload.eventType);
        if (onCashMovementsChange) onCashMovementsChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'suppliers' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en proveedores:', payload.eventType);
        if (onSuppliersChange) onSuppliersChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fiscal_closures' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en cierres fiscales:', payload.eventType);
        if (onFiscalClosuresChange) onFiscalClosuresChange(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_items' },
      (payload) => {
        console.log('⚡ [Realtime] Cambio detectado en renglones de pedido:', payload.eventType);
        if (onOrdersChange) onOrdersChange(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 [Realtime Status]:', status);
    });

  return () => {
    supabase.removeChannel(channel);
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
