/**
 * Servicio de Integración y Sincronización en Tiempo Real con Profit Plus 2K8
 * SIGNUM MOTORVEN
 */
import { supabase } from './supabaseService.js';
import { PROFIT_DATABASES_CATALOG, PROFIT_SERVER_INFO } from '../data/profitDatabasesCatalog.js';

const BRIDGE_API_URL = 'http://localhost:3005';
const LOCAL_STORAGE_PROFIT_KPIS_KEY = 'signum_profit_dashboard_kpis';

/**
 * Consulta el estado de conexión del puente Profit Plus 2K8 y el estado físico del disco
 */
export async function getProfitBridgeStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`${BRIDGE_API_URL}/api/profit/status`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.lastSyncStats?.kpis) {
        try {
          localStorage.setItem(LOCAL_STORAGE_PROFIT_KPIS_KEY, JSON.stringify(data.lastSyncStats.kpis));
        } catch (_) {}
      }
      return {
        isAvailable: data.online === true,
        driveOnline: data.driveOnline !== false,
        driveHealth: data.driveHealth || 'ONLINE',
        dbHealth: data.dbHealth || 'ONLINE',
        server: data.server,
        database: data.database,
        isSyncing: data.isSyncing,
        lastSyncTime: data.lastSyncTime,
        lastSyncStats: data.lastSyncStats
      };
    }
  } catch (_) {
    // Si el micro-servicio local no está activo en el puerto 3005
  }

  return {
    isAvailable: false,
    driveOnline: false,
    driveHealth: 'OFFLINE',
    dbHealth: 'DISCONNECTED',
    server: '26.229.220.202:1433',
    database: 'GRUMOTOR',
    isSyncing: false,
    lastSyncTime: null,
    lastSyncStats: null
  };
}

/**
 * Consulta directa en tiempo real de productos/artículos a Profit Plus
 */
export async function getProfitRealtimeProducts() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(`${BRIDGE_API_URL}/api/profit/products`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const json = await response.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Consulta directa en tiempo real de clientes a Profit Plus
 */
export async function getProfitRealtimeClients() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(`${BRIDGE_API_URL}/api/profit/clients`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const json = await response.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Obtiene las métricas en tiempo real calculadas de Profit Plus para el Dashboard
 */
export async function getProfitDashboardKPIs() {
  // 1. Intentar obtener desde el bridge en vivo
  try {
    const status = await getProfitBridgeStatus();
    if (status.lastSyncStats?.kpis) {
      return status.lastSyncStats.kpis;
    }
  } catch (_) {}

  // 2. Intentar leer desde caché local solo si vino del bridge
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_PROFIT_KPIS_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (_) {}

  // Si no hay bridge activo, retornar null para que el Dashboard compute directamente desde Supabase
  return null;
}

/**
 * Solicita la sincronización manual inmediata con Profit Plus 2K8
 */
export async function triggerProfitSync() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${BRIDGE_API_URL}/api/profit/sync`, {
      method: 'POST',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result.kpis) {
        try {
          localStorage.setItem(LOCAL_STORAGE_PROFIT_KPIS_KEY, JSON.stringify(result.kpis));
        } catch (_) {}
      }
      return result;
    } else {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al ejecutar sincronización en el puente');
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al comunicar con el servidor Profit Plus.');
    }
    throw err;
  }
}

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

/**
 * Consulta cualquier endpoint del puente Profit y mide la latencia de respuesta
 */
export async function fetchProfitEndpoint(endpointPath) {
  const start = performance.now();
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const url = `${BRIDGE_API_URL}${cleanPath}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const elapsed = Math.round(performance.now() - start);
    const data = await response.json().catch(() => null);
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      timeMs: elapsed,
      url,
      data
    };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return {
      success: false,
      status: 0,
      statusText: err.name === 'AbortError' ? 'TIMEOUT' : 'DISCONNECTED',
      timeMs: elapsed,
      url,
      error: err.message
    };
  }
}

/**
 * ==============================================================================
 * ESCRITURA BIDIRECCIONAL HACIA PROFIT PLUS (SQL SERVER) Y SUPABASE
 * ==============================================================================
 */

/**
 * Escribe o elimina un usuario / asesor en Profit Plus (vendedor) y Supabase
 */
export async function writeProfitUser(user, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, user }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitUser] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Escribe o elimina un asesor en Profit Plus (vendedor)
 */
export async function writeProfitSeller(seller, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, seller }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitSeller] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Escribe o elimina un producto / lubricante en Profit Plus (art) y Supabase
 */
export async function writeProfitProduct(product, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, product }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitProduct] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Escribe o elimina un cliente en Profit Plus (clientes) y Supabase
 */
export async function writeProfitClient(client, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitClient] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Consulta la comparativa en tiempo real entre Profit Plus y Supabase
 * @param {'product' | 'client' | 'seller'} entity
 * @param {string} id
 */
export async function compareProfitEntity(entity, id) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/compare/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[compareProfitEntity] Aviso:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Escribe o anula una venta / factura en Profit Plus (factura & reng_fac)
 */
export async function writeProfitSale(sale, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sale }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitSale] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Escribe o actualiza un pedido / cotización en Profit Plus (pedidos & reng_ped)
 */
export async function writeProfitOrder(order, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, order }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitOrder] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Escribe o registra una compra en Profit Plus (compras & reng_com)
 */
export async function writeProfitPurchase(purchase, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, purchase }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitPurchase] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Escribe, edita o elimina un proveedor en Profit Plus (prov)
 */
export async function writeProfitSupplier(supplier, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/supplier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, supplier }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitSupplier] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Registra un movimiento de caja o cobro en Profit Plus (cobros / mov_caj)
 */
export async function writeProfitCashMovement(movement, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/write/cash-movement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, movement }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    console.warn('[writeProfitCashMovement] Aviso comunicando con Profit Bridge:', err.message);
    return { success: false, queued: true, error: err.message };
  }
}

/**
 * Consulta todas las 26 bases de datos del servidor SQL Server
 */
export async function getAllProfitDatabases(forceRefresh = false) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/databases/all?refresh=${forceRefresh}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.databases)) {
        return {
          success: true,
          source: data.source || 'live',
          serverInfo: PROFIT_SERVER_INFO,
          databases: data.databases
        };
      }
    }
  } catch (_) {}

  return {
    success: true,
    source: 'fallback_catalog',
    serverInfo: PROFIT_SERVER_INFO,
    databases: PROFIT_DATABASES_CATALOG
  };
}

/**
 * Obtiene el inventario de tablas de una base de datos específica
 */
export async function getProfitDatabaseTables(dbName) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/tables?db=${encodeURIComponent(dbName)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  return {
    success: false,
    database: dbName,
    error: 'Servidor Profit Bridge no disponible. Inicie el servidor con scripts\\profit-bridge\\iniciar_servidor_profit.bat.'
  };
}

/**
 * Consulta registros paginados de una tabla en cualquier base de datos
 */
export async function getProfitDatabaseTableData(dbName, tableName, page = 1, limit = 50, search = '') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const params = new URLSearchParams({
      db: dbName,
      table: tableName,
      page: String(page),
      limit: String(limit),
      search
    });
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/table-data?${params.toString()}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    return { success: false, error: err.message };
  }

  return {
    success: false,
    error: 'No se pudo conectar con el servidor SQL Server. Comprueba que Radmin VPN esté conectado.'
  };
}

/**
 * Ejecuta una consulta SELECT interactiva en cualquier base de datos
 */
export async function executeProfitDatabaseQuery(dbName, query) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db: dbName, query }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Consulta la estructura y columnas de una tabla en Profit Plus
 */
export async function getProfitTableColumns(dbName, tableName) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/columns?db=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
  return { success: false, error: 'Error comunicando con Profit Bridge' };
}

/**
 * Guarda o modifica un registro en la base de datos de Profit Plus (SQL Server)
 */
export async function saveProfitDatabaseRecord(dbName, tableName, record, action = 'SAVE') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/record/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db: dbName, table: tableName, record, action }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Elimina un registro de una tabla en Profit Plus (SQL Server)
 */
export async function deleteProfitDatabaseRecord(dbName, tableName, keyField, keyValue) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/record/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db: dbName, table: tableName, keyField, keyValue }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Dispara una copia de seguridad nativa SQL Server o snapshot descargable
 */
export async function createProfitDatabaseBackup(dbName = 'GRUMOTOR', type = 'native') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db: dbName, type }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Obtiene el historial de copias de seguridad de la base de datos
 */
export async function getProfitDatabaseBackups(dbName = 'GRUMOTOR') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BRIDGE_API_URL}/api/profit/database/backups?db=${encodeURIComponent(dbName)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
  return { success: false, backups: [] };
}

