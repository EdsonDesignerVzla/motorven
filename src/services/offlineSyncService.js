/**
 * Servicio de Sincronización Offline-First para SIGNUM MOTORVEN
 * Maneja persistencia local de transacciones pendientes, detección de conectividad
 * y reintento automático hacia Supabase en orden cronológico.
 */

import * as defaultSupabaseHandlers from './supabaseService.js';

if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map();
  globalThis.localStorage = {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, val) => { memoryStore.set(key, String(val)); },
    removeItem: (key) => { memoryStore.delete(key); },
    clear: () => { memoryStore.clear(); },
    get length() { return memoryStore.size; },
    key: (i) => Array.from(memoryStore.keys())[i] ?? null
  };
}

const SYNC_QUEUE_KEY = 'signum_offline_sync_queue';
const SYNC_STATUS_EVENT = 'signum:sync-status-changed';

let isSyncing = false;
let listeners = [];

/**
 * Obtiene la cola actual de sincronizaciones pendientes
 */
export const getSyncQueue = () => {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.entity === 'string' && item.entity.trim().length > 0);
  } catch (err) {
    console.error("[OfflineSync] Error leyendo cola de sincronización:", err);
    return [];
  }
};

/**
 * Guarda la cola de sincronización en localStorage
 */
const saveSyncQueue = (queue) => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    notifySubscribers();
  } catch (err) {
    console.error("[OfflineSync] Error guardando cola de sincronización:", err);
  }
};

/**
 * Agrega una acción a la cola de sincronización
 * @param {string} entity 'config' | 'product' | 'client' | 'supplier' | 'sale' | 'purchase' | 'cash_movement' | 'fiscal_closure' | 'user' | 'notification' | 'order' | 'order_status' | 'seller_zone'
 * @param {'INSERT' | 'UPDATE' | 'DELETE'} action
 * @param {any} data Datos de la entidad a sincronizar
 */
export const enqueueSyncAction = (entity, action, data) => {
  if (entity && typeof entity === 'object') {
    const obj = entity;
    entity = obj.entity || 'notification';
    action = obj.action || 'UPDATE';
    data = obj.data ?? obj.payload ?? {};
  }
  if (!entity || typeof entity !== 'string') return null;

  const queue = getSyncQueue();
  
  // Evitar duplicación innecesaria para updates repetidos del mismo ID
  const itemId = data?.id;
  let existingIndex = -1;
  if (itemId && action !== 'DELETE') {
    existingIndex = queue.findIndex(item => item.entity === entity && item.data?.id === itemId);
  }

  const newItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    entity,
    action,
    data,
    timestamp: new Date().toISOString(),
    attempts: 0,
    lastError: null
  };

  if (existingIndex >= 0) {
    // Reemplazar con los datos más recientes
    queue[existingIndex] = {
      ...queue[existingIndex],
      action,
      data,
      timestamp: newItem.timestamp
    };
  } else {
    queue.push(newItem);
  }

  saveSyncQueue(queue);
  console.log(`[OfflineSync] Operación encolada (${entity} - ${action}):`, data);

  // Intentar sincronizar de inmediato si hay conexión a internet
  if (isNetworkOnline()) {
    setTimeout(() => {
      flushSyncQueue();
    }, 300);
  }

  return newItem;
};

/**
 * Elimina un elemento de la cola tras sincronizarse con éxito
 */
export const removeSyncAction = (actionId) => {
  const queue = getSyncQueue();
  const updated = queue.filter(item => item.id !== actionId);
  saveSyncQueue(updated);
};

/**
 * Retorna la cantidad de elementos pendientes en la cola
 */
export const getPendingSyncCount = () => {
  return getSyncQueue().length;
};

/**
 * Limpia toda la cola de sincronización (en caso de reset forzado)
 */
export const clearSyncQueue = () => {
  saveSyncQueue([]);
};

/**
 * Verifica si el navegador reporta conexión a internet
 */
export const isNetworkOnline = () => {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
};

/**
 * Notifica a todos los suscriptores suscritos al estado de sincronización
 */
const notifySubscribers = () => {
  const status = {
    isOnline: isNetworkOnline(),
    isSyncing,
    pendingCount: getPendingSyncCount()
  };

  listeners.forEach(callback => {
    try {
      callback(status);
    } catch (e) {
      console.error("[OfflineSync] Error notificando suscriptor:", e);
    }
  });

  // Notificar también vía evento global en window
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: status }));
  }
};

/**
 * Se suscribe a los cambios de estado de sincronización (para componentes de React como HeaderBar)
 * @param {Function} callback ({ isOnline, isSyncing, pendingCount }) => void
 * @returns {Function} Función para cancelar suscripción
 */
export const subscribeSyncStatus = (callback) => {
  listeners.push(callback);
  // Llamada inicial inmediata
  callback({
    isOnline: isNetworkOnline(),
    isSyncing,
    pendingCount: getPendingSyncCount()
  });

  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
};

/**
 * Función que procesa y sube los elementos de la cola hacia Supabase
 * @param {object} serviceHandlers Métodos de persistencia directos de Supabase
 */
export const flushSyncQueue = async (serviceHandlers = null) => {
  if (isSyncing) return { success: false, reason: 'ALREADY_SYNCING' };
  if (!isNetworkOnline()) return { success: false, reason: 'OFFLINE' };

  const queue = getSyncQueue();
  if (queue.length === 0) {
    notifySubscribers();
    return { success: true, count: 0 };
  }

  isSyncing = true;
  notifySubscribers();

  let processedCount = 0;
  let failedCount = 0;

  console.log(`[OfflineSync] Procesando ${queue.length} elementos pendientes...`);

  // Usar handlers inyectados o los handlers de Supabase por defecto
  const handlers = serviceHandlers || defaultSupabaseHandlers;

  const currentQueue = [...queue];

  for (const item of currentQueue) {
    try {
      let syncSuccess = false;

      switch (item.entity) {
        case 'config':
          if (handlers.pushConfigToSupabase) {
            await handlers.pushConfigToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'product':
          if (item.action === 'DELETE') {
            if (handlers.deleteSupabaseProductDirect) {
              await handlers.deleteSupabaseProductDirect(item.data.id);
            }
          } else {
            if (handlers.pushProductToSupabase) {
              await handlers.pushProductToSupabase(item.data);
            }
          }
          syncSuccess = true;
          break;

        case 'client':
          if (handlers.pushClientToSupabase) {
            await handlers.pushClientToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'supplier':
          if (handlers.pushSupplierToSupabase) {
            await handlers.pushSupplierToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'sale':
          if (handlers.pushSaleToSupabase) {
            await handlers.pushSaleToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'purchase':
          if (handlers.pushPurchaseToSupabase) {
            await handlers.pushPurchaseToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'cash_movement':
          if (handlers.pushCashMovementToSupabase) {
            await handlers.pushCashMovementToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'fiscal_closure':
          if (handlers.pushFiscalClosureToSupabase) {
            await handlers.pushFiscalClosureToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'user':
          if (item.action === 'DELETE') {
            if (handlers.deleteSupabaseUserDirect) {
              await handlers.deleteSupabaseUserDirect(item.data.id);
            }
          } else {
            if (handlers.pushUserToSupabase) {
              await handlers.pushUserToSupabase(item.data);
            }
          }
          syncSuccess = true;
          break;

        case 'user_log':
          if (handlers.pushUserLogToSupabase) {
            await handlers.pushUserLogToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'seller_target':
          if (handlers.updateSupabaseSellerTarget) {
            await handlers.updateSupabaseSellerTarget(item.data.coVen, {
              metaLitrosMes: item.data.metaLitrosMes,
              comisionPct: item.data.comisionPct
            });
            syncSuccess = true;
          }
          break;

        case 'seller_zone':
          if (handlers.updateSupabaseSellerZone) {
            await handlers.updateSupabaseSellerZone(item.data.coVen, {
              coZon: item.data.coZon,
              zona: item.data.zona
            });
            syncSuccess = true;
          }
          break;

        case 'seller_global_target':
          if (handlers.updateSupabaseGlobalSellersTarget) {
            await handlers.updateSupabaseGlobalSellersTarget(
              item.data.activeSellerCodes,
              item.data.totalLitrosMeta
            );
            syncSuccess = true;
          }
          break;

        case 'order':
        case 'orders':
          if (item.action === 'DELETE') {
            if (handlers.deleteSupabaseOrderDirect) {
              await handlers.deleteSupabaseOrderDirect(item.data?.id || item.data);
            }
          } else if (handlers.pushOrderToSupabase) {
            await handlers.pushOrderToSupabase(item.data);
          } else if (handlers.saveSupabaseOrder) {
            await handlers.saveSupabaseOrder(item.data);
          }
          syncSuccess = true;
          break;

        case 'order_status':
          if (handlers.updateOrderStatusDirect) {
            await handlers.updateOrderStatusDirect(
              item.data.orderId,
              item.data.nuevoEstado
            );
          } else if (handlers.updateSupabaseOrderStatus) {
            await handlers.updateSupabaseOrderStatus(
              item.data.orderId,
              item.data.nuevoEstado,
              item.data.metadata || {}
            );
          }
          syncSuccess = true;
          break;

        case 'sales':
          if (item.action === 'DELETE' && handlers.deleteSaleDirect) {
            await handlers.deleteSaleDirect(item.data);
            syncSuccess = true;
          } else if (handlers.pushSaleToSupabase) {
            await handlers.pushSaleToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'profit_invoice':
        case 'profit_invoices':
          if (item.action === 'DELETE' && handlers.deleteProfitInvoiceDirect) {
            await handlers.deleteProfitInvoiceDirect(item.data);
            syncSuccess = true;
          } else if (handlers.pushProfitInvoiceToSupabase) {
            await handlers.pushProfitInvoiceToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'profit_collection':
        case 'profit_collections':
          if (handlers.pushProfitCollectionToSupabase) {
            await handlers.pushProfitCollectionToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'profit_bank_account':
        case 'bank_account':
          if (item.action === 'DELETE' && handlers.deleteProfitBankAccountDirect) {
            await handlers.deleteProfitBankAccountDirect(item.data);
            syncSuccess = true;
          } else if (handlers.pushProfitBankAccountToSupabase) {
            await handlers.pushProfitBankAccountToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'profit_cash_desk':
        case 'cash_desk':
          if (item.action === 'DELETE' && handlers.deleteProfitCashDeskDirect) {
            await handlers.deleteProfitCashDeskDirect(item.data);
            syncSuccess = true;
          } else if (handlers.pushProfitCashDeskToSupabase) {
            await handlers.pushProfitCashDeskToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'profit_accounts_payable':
          if (item.action === 'DELETE' && handlers.deleteProfitAccountsPayableDirect) {
            await handlers.deleteProfitAccountsPayableDirect(item.data);
            syncSuccess = true;
          } else if (handlers.pushProfitAccountsPayableToSupabase) {
            await handlers.pushProfitAccountsPayableToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'profit_supplier_payment':
          if (handlers.pushProfitSupplierPaymentToSupabase) {
            await handlers.pushProfitSupplierPaymentToSupabase(item.data);
            syncSuccess = true;
          }
          break;

        case 'notification':
          if (item.action === 'MARK_ALL_READ' && handlers.markAllSupabaseNotificationsRead) {
            await handlers.markAllSupabaseNotificationsRead();
          } else if (item.action === 'UPDATE' && item.data?.id && handlers.markSupabaseNotificationRead) {
            await handlers.markSupabaseNotificationRead(item.data.id);
          } else if (handlers.saveSupabaseNotification) {
            await handlers.saveSupabaseNotification(item.data);
          }
          syncSuccess = true;
          break;

        default:
          console.warn(`[OfflineSync] Entidad no reconocida: ${item.entity}`);
          syncSuccess = true; // Quitar de cola para no bloquear
      }

      if (syncSuccess) {
        removeSyncAction(item.id);
        processedCount++;
      }
    } catch (err) {
      console.error(`[OfflineSync] Error sincronizando elemento ${item.id} (${item.entity}):`, err);
      const updatedQueue = getSyncQueue().map(q =>
        q.id === item.id
          ? { ...q, attempts: (q.attempts || 0) + 1, lastError: err?.message || String(err) }
          : q
      );
      saveSyncQueue(updatedQueue);
      failedCount++;
      
      // Si el error es de red, pausar la sincronización para no saturar
      if (!isNetworkOnline() || err?.message?.includes('network') || err?.message?.includes('fetch') || err?.message?.includes('timeout')) {
        break;
      }
    }
  }

  isSyncing = false;
  notifySubscribers();

  if (processedCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('signum_offline_queue_flushed', {
        detail: { processedCount, failedCount }
      })
    );
  }

  console.log(`[OfflineSync] Proceso finalizado. Sincronizados: ${processedCount}, Fallidos/Pendientes: ${failedCount}`);
  return { success: failedCount === 0, processedCount, failedCount };
};

/**
 * Inicializa los listeners globales de red para sincronización automática
 */
export const initOfflineSyncListeners = () => {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    console.log("[OfflineSync] Conexión de red restablecida. Verificando cola...");
    notifySubscribers();
    setTimeout(() => {
      flushSyncQueue();
    }, 500);
  };

  const handleOffline = () => {
    console.warn("[OfflineSync] Modo Offline activado. Las operaciones se guardarán localmente.");
    notifySubscribers();
  };

  const handleFocusOrVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') {
      return;
    }
    if (isNetworkOnline() && getPendingSyncCount() > 0 && !isSyncing) {
      flushSyncQueue();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleFocusOrVisibility);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleFocusOrVisibility);
  }

  // Intervalo de latido periódico rápido (cada 8 segundos si hay pendientes tras reinicio de servidor)
  const intervalId = setInterval(() => {
    if (isNetworkOnline() && getPendingSyncCount() > 0 && !isSyncing) {
      flushSyncQueue();
    }
  }, 8000);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('focus', handleFocusOrVisibility);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    }
    clearInterval(intervalId);
  };
};

