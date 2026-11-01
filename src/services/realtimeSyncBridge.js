/**
 * CANAL DE SINCRONIZACIÓN EN TIEMPO REAL - SIGNUM MOTORVEN
 * Permite que cualquier reconciliación efectuada en Supabase o en el Comparador de Bases de Datos
 * actualice de inmediato e imperceptiblemente la memoria y componentes de la aplicación
 * tanto en la misma ventana (modal) como entre distintas pestañas del navegador.
 */

const CHANNEL_NAME = 'signum_realtime_data_sync_channel';
const CUSTOM_EVENT_NAME = 'signum_realtime_data_reconciled';

let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (err) {
  console.warn('[RealtimeSyncBridge] BroadcastChannel no soportado, usando CustomEvent:', err);
}

/**
 * Emite un evento de reconciliación hacia toda la aplicación (misma pestaña y otras pestañas)
 * @param {Object} payload 
 * @param {string} payload.tableId - 'products' | 'clients' | 'warehouses' | 'bank_accounts' | 'sellers' | 'suppliers' | 'invoices' | 'inventory_adjustments' | 'warehouse_transfers' | 'product_lines'
 * @param {string} payload.action - 'RECONCILE' | 'DELETE' | 'SYNC_CATALOG_ALL'
 * @param {string} payload.key - Identificador único (SKU, RIF, Nro Factura, etc.)
 * @param {Object} [payload.item] - Renglón reconciliado y normalizado
 * @param {Array} [payload.allTableData] - Conjunto completo si fue sincronización global
 */
export const broadcastReconcileChange = (payload) => {
  const eventPayload = {
    ...payload,
    timestamp: Date.now()
  };

  // 1. Notificar a otras pestañas/ventanas abiertas mediante BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(eventPayload);
    } catch (e) {
      console.warn('[RealtimeSyncBridge] Error enviando a BroadcastChannel:', e);
    }
  }

  // 2. Notificar en la pestaña actual (para vistas montadas, modales y App.jsx)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: eventPayload }));
    } catch (e) {
      console.warn('[RealtimeSyncBridge] Error enviando CustomEvent:', e);
    }
  }
};

/**
 * Suscribe un callback a cualquier evento de reconciliación en tiempo real
 * @param {Function} callback - ({ tableId, action, key, item, allTableData, timestamp }) => void
 * @returns {Function} Función para cancelar la suscripción
 */
export const subscribeToRealtimeSync = (callback) => {
  if (typeof window === 'undefined') return () => {};

  // Listener para la misma pestaña / ventana
  const handleCustomEvent = (event) => {
    if (event.detail && typeof callback === 'function') {
      callback(event.detail);
    }
  };

  // Listener para otras pestañas / ventanas
  const handleBroadcastMessage = (event) => {
    if (event.data && typeof callback === 'function') {
      callback(event.data);
    }
  };

  // Listener para cambios en almacenamiento compartido
  const handleStorageEvent = (event) => {
    if (event.key === 'sm_products_v4_fiscal' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          callback({
            tableId: 'products',
            action: 'STORAGE_UPDATE',
            key: 'ALL',
            allTableData: parsed,
            timestamp: Date.now()
          });
        }
      } catch (_) {}
    } else if (event.key === 'sm_clients_v4_fiscal' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          callback({
            tableId: 'clients',
            action: 'STORAGE_UPDATE',
            key: 'ALL',
            allTableData: parsed,
            timestamp: Date.now()
          });
        }
      } catch (_) {}
    }
  };

  window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  return () => {
    window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
  };
};
