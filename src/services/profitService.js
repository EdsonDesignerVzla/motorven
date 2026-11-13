/**
 * Servicio de suscripción en tiempo real - SIGNUM MOTORVEN
 * Canalizado exclusivamente sobre Supabase + realtimeSyncBridge.
 */
import { supabase } from './supabaseService.js';
import { subscribeToRealtimeSync } from './realtimeSyncBridge.js';

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

  const debounceTimers = new Map();
  const scheduleHandler = (tableKey, handler, payload) => {
    if (typeof handler !== 'function') return;
    const prevTimer = debounceTimers.get(tableKey);
    if (prevTimer) clearTimeout(prevTimer);
    const tid = setTimeout(() => {
      debounceTimers.delete(tableKey);
      handler(payload);
    }, 350);
    debounceTimers.set(tableKey, tid);
  };

  // 1. Suscribir al motor multi-dispositivo SSE + Delta Polling + BroadcastChannel
  // Ignorar eventos originados en esta misma pestaña para evitar recargas redundantes de tablas completas
  const unsubscribeBridge = subscribeToRealtimeSync((evt) => {
    if (!evt) return;
    const rawTable = evt.table || evt.tableId;
    const handler = tableCallbacks[rawTable] || tableCallbacks[evt.tableId];
    if (typeof handler === 'function') {
      scheduleHandler(String(rawTable || evt.tableId), handler, {
        eventType: evt.eventType || (evt.action === 'DELETE' ? 'DELETE' : 'UPDATE'),
        table: rawTable,
        new: evt.item || null,
        old: evt.action === 'DELETE' ? (evt.item || { id: evt.key }) : null,
        key: evt.key
      });
    }
  }, { ignoreSelfEvents: true });

  // 2. Mantener canal WebSocket nativo únicamente cuando se apunte a Supabase Cloud (*.supabase.co);
  // el servidor propio usa SSE (/realtime/v1/events) + Delta Polling (/realtime/v1/changes), evitando errores 502 WS.
  let channel = null;
  try {
    const backendHost = String(supabase?.supabaseUrl || '').toLowerCase();
    if (backendHost.includes('.supabase.co')) {
      channel = supabase
        .channel('signum-profit-realtime')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const handler = tableCallbacks[payload?.table];
          if (typeof handler === 'function') {
            scheduleHandler(String(payload?.table), handler, payload);
          }
        })
        .subscribe();
    }
  } catch (_) {}

  return () => {
    for (const tid of debounceTimers.values()) clearTimeout(tid);
    debounceTimers.clear();
    unsubscribeBridge();
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    }
  };
}
