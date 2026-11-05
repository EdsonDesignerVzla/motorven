/**
 * CANAL DE SINCRONIZACIÓN EN TIEMPO REAL MULTI-DISPOSITIVO Y MULTI-NAVEGADOR - SIGNUM MOTORVEN
 * Sincroniza instantáneamente en tiempo real:
 * 1. Misma pestaña (CustomEvent)
 * 2. Otras pestañas del mismo navegador (BroadcastChannel + localStorage event fallback para iOS/Safari)
 * 3. Todos los navegadores y dispositivos en red: PC, Laptop, Smartphone, Tablet, iPhone, iPad
 *    mediante Server-Sent Events (SSE /realtime/v1/events) + Delta Polling (/realtime/v1/changes)
 *    + reconexión automática en visibilitychange / pageshow / focus / online.
 */

const CHANNEL_NAME = 'signum_realtime_data_sync_channel';
const CUSTOM_EVENT_NAME = 'signum_realtime_data_reconciled';
const STORAGE_SIGNAL_KEY = 'signum_rt_cross_tab_signal';

const CLIENT_ID = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// Mapa bidireccional entre nombres de tablas PostgREST y tableId de la UI
const DB_TABLE_TO_UI_ID = {
  products: 'products',
  clients: 'clients',
  users: 'users',
  config: 'config',
  orders: 'orders',
  order_items: 'orders',
  sales: 'sales',
  purchases: 'purchases',
  suppliers: 'suppliers',
  cash_movements: 'cash_movements',
  fiscal_closures: 'fiscal_closures',
  notifications: 'notifications',
  profit_sellers: 'sellers',
  sellers: 'sellers',
  profit_warehouses: 'warehouses',
  warehouses: 'warehouses',
  profit_bank_accounts: 'bank_accounts',
  bank_accounts: 'bank_accounts',
  profit_cash_desks: 'cash_desks',
  cash_desks: 'cash_desks',
  profit_invoices: 'invoices',
  invoices: 'invoices',
  profit_collections: 'collections',
  collections: 'collections',
  profit_suppliers: 'profit_suppliers',
  profit_purchases: 'profit_purchases',
  profit_accounts_payable: 'accounts_payable',
  profit_supplier_payments: 'supplier_payments',
  profit_zones: 'zones',
  zones: 'zones',
  profit_transports: 'transports',
  transports: 'transports',
  profit_customer_returns: 'customer_returns',
  profit_inventory_adjustments: 'inventory_adjustments',
  inventory_adjustments: 'inventory_adjustments',
  profit_warehouse_transfers: 'warehouse_transfers',
  warehouse_transfers: 'warehouse_transfers',
  profit_product_lines: 'product_lines',
  product_lines: 'product_lines',
  profit_product_sublines: 'product_sublines',
  product_sublines: 'product_sublines',
  profit_product_categories: 'product_categories',
  product_categories: 'product_categories',
  profit_currencies: 'currencies',
  profit_islr_concepts: 'islr_concepts',
  profit_beneficiaries: 'beneficiaries',
  profit_payment_orders: 'payment_orders',
  profit_islr_withholdings: 'islr_withholdings',
  profit_audit_trails: 'audit_trails'
};

let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (_) {
  broadcastChannel = null;
}

function resolveRealtimeBaseUrl() {
  if (typeof window === 'undefined' || !window.location) {
    return 'http://127.0.0.1:54321';
  }
  const { protocol, hostname, origin } = window.location;
  const isStaticCloud =
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.netlify.app') ||
    hostname.endsWith('.github.io') ||
    hostname.endsWith('.onrender.com') ||
    hostname.endsWith('.pages.dev') ||
    hostname.endsWith('.railway.app') ||
    hostname.endsWith('.fly.dev');
  if (isStaticCloud) {
    try {
      const custom = window.localStorage.getItem('signum_custom_backend_url');
      if (custom && /^https?:\/\//i.test(custom.trim())) return custom.trim().replace(/\/+$/, '');
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
        const envUrl = import.meta.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, '');
        if (/^https?:\/\//i.test(envUrl) && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
          return envUrl;
        }
      }
    } catch (_) {}
    return null;
  }
  if ((protocol === 'http:' || protocol === 'https:') && origin && origin !== 'null') {
    return `${origin}/sb`;
  }
  return 'http://127.0.0.1:54321';
}

let lastProcessedSeq = 0;
const recentEventFingerprints = new Set();

function rememberFingerprint(fp) {
  if (!fp) return false;
  if (recentEventFingerprints.has(fp)) return true;
  recentEventFingerprints.add(fp);
  if (recentEventFingerprints.size > 400) {
    const first = recentEventFingerprints.values().next().value;
    recentEventFingerprints.delete(first);
  }
  return false;
}

function normalizeIncomingEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rawTable = raw.table || raw.tableId || 'system';
  const uiTableId = DB_TABLE_TO_UI_ID[rawTable] || raw.tableId || rawTable;
  const eventType = raw.eventType || (raw.action === 'DELETE' ? 'DELETE' : 'UPDATE');
  const action = raw.action || (raw.eventType === 'DELETE' ? 'DELETE' : 'RECONCILE');
  return {
    seq: Number(raw.seq || 0),
    table: rawTable,
    tableId: uiTableId,
    eventType,
    action,
    key: raw.key ?? raw.item?.id ?? raw.item?.co_ven ?? raw.item?.coVen ?? raw.item?.codigo ?? null,
    item: raw.item ?? raw.new ?? null,
    allTableData: raw.allTableData || null,
    clientId: raw.clientId || null,
    timestamp: raw.timestamp || Date.now()
  };
}

const activeSubscribers = new Set();

function notifyLocalSubscribers(eventDetail) {
  for (const cb of activeSubscribers) {
    try {
      cb(eventDetail);
    } catch (err) {
      console.warn('[RealtimeSyncBridge] Error en suscriptor:', err);
    }
  }
}

function handleRemoteEntry(rawEntry) {
  const normalized = normalizeIncomingEntry(rawEntry);
  if (!normalized) return;

  if (normalized.seq > 0) {
    if (normalized.seq <= lastProcessedSeq) return;
    lastProcessedSeq = normalized.seq;
  }

  // Si este mismo cliente originó el broadcast explícito, ya fue procesado localmente
  if (normalized.clientId && normalized.clientId === CLIENT_ID) {
    return;
  }

  const fp = normalized.seq
    ? `seq:${normalized.seq}`
    : `${normalized.tableId}:${normalized.action}:${normalized.key}:${normalized.timestamp}`;
  if (rememberFingerprint(fp)) return;

  notifyLocalSubscribers(normalized);
}

let sseSource = null;
let pollTimer = null;
let reconnectTimer = null;
let isPollingInFlight = false;
let networkSyncStarted = false;

async function pollDeltaChanges() {
  if (isPollingInFlight) return;
  const baseUrl = resolveRealtimeBaseUrl();
  if (!baseUrl || typeof fetch === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  isPollingInFlight = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${baseUrl}/realtime/v1/changes?since=${lastProcessedSeq}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'bypass-tunnel-reminder': 'true',
        'ngrok-skip-browser-warning': 'true'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data?.changes) && data.changes.length > 0) {
      for (const entry of data.changes) {
        handleRemoteEntry(entry);
      }
    } else if (typeof data?.seq === 'number' && lastProcessedSeq === 0) {
      lastProcessedSeq = data.seq;
    }
  } catch (_) {
    // Silencioso en modo offline o durante pruebas unitarias sin servidor
  } finally {
    isPollingInFlight = false;
  }
}

function connectSseStream() {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return;
  const baseUrl = resolveRealtimeBaseUrl();
  if (!baseUrl) return;

  if (sseSource) {
    try {
      sseSource.close();
    } catch (_) {}
    sseSource = null;
  }

  try {
    const es = new window.EventSource(`${baseUrl}/realtime/v1/events`);
    sseSource = es;

    es.onmessage = (evt) => {
      if (!evt?.data) return;
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed.type === 'CONNECTED') {
          if (typeof parsed.seq === 'number' && lastProcessedSeq === 0) {
            lastProcessedSeq = parsed.seq;
          } else if (typeof parsed.seq === 'number' && parsed.seq > lastProcessedSeq) {
            pollDeltaChanges();
          }
          return;
        }
        handleRemoteEntry(parsed);
      } catch (_) {}
    };

    es.onerror = () => {
      try {
        es.close();
      } catch (_) {}
      if (sseSource === es) sseSource = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (activeSubscribers.size > 0) connectSseStream();
      }, 3500);
    };
  } catch (_) {}
}

function ensureNetworkRealtimeStarted() {
  if (networkSyncStarted || typeof window === 'undefined') return;
  // Evitar abrir intervalos permanentes en entorno de tests automatizados Vitest/JSDOM
  const isTestEnv = typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test');
  if (isTestEnv) return;

  networkSyncStarted = true;
  connectSseStream();
  pollDeltaChanges();

  // Si el canal Server-Sent Events (SSE) está abierto (readyState === 1), los cambios llegan
  // en < 50ms por push directo sin consumir peticiones HTTP. El polling solo actúa como
  // red de seguridad cada 25s o de inmediato si SSE se desconecta (por ejemplo, en móviles).
  pollTimer = setInterval(() => {
    if (activeSubscribers.size > 0) {
      const isSseConnected = sseSource && sseSource.readyState === 1;
      if (!isSseConnected) {
        pollDeltaChanges();
      }
    }
  }, 3500);

  setInterval(() => {
    if (activeSubscribers.size > 0) {
      pollDeltaChanges();
    }
  }, 25000);

  const handleWakeUp = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    pollDeltaChanges();
    if (!sseSource || sseSource.readyState === 2) {
      connectSseStream();
    }
  };

  window.addEventListener('focus', handleWakeUp);
  window.addEventListener('online', handleWakeUp);
  window.addEventListener('pageshow', handleWakeUp);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleWakeUp);
  }
}

/**
 * Emite un evento de reconciliación hacia toda la aplicación:
 * misma pestaña, otras pestañas del navegador y todos los dispositivos conectados en red.
 */
export const broadcastReconcileChange = (payload) => {
  const eventPayload = {
    ...payload,
    clientId: CLIENT_ID,
    timestamp: Date.now()
  };

  // 1. Notificar a otras pestañas del mismo navegador mediante BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(eventPayload);
    } catch (_) {}
  }

  // 2. Fallback universal por localStorage para Safari iOS / WebViews móviles
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_SIGNAL_KEY, JSON.stringify(eventPayload));
    } catch (_) {}
  }

  // 3. Notificar en la pestaña actual (vistas montadas, modales y App.jsx)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: eventPayload }));
    } catch (_) {}
  }

  // 4. Transmitir al servidor Supabase Local para sincronizar otros navegadores y dispositivos (PC, Laptop, iPhone, Android, Tablet)
  const baseUrl = resolveRealtimeBaseUrl();
  const isTestEnv = typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test');
  if (baseUrl && !isTestEnv && typeof fetch !== 'undefined') {
    fetch(`${baseUrl}/realtime/v1/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        table: payload.table || payload.tableId,
        tableId: payload.tableId || payload.table,
        action: payload.action || 'RECONCILE',
        eventType: payload.action === 'DELETE' ? 'DELETE' : 'UPDATE',
        key: payload.key || null,
        item: payload.item || null,
        clientId: CLIENT_ID
      })
    }).catch(() => {});
  }
};

/**
 * Suscribe un callback a cualquier evento de reconciliación en tiempo real
 * @param {Function} callback - ({ tableId, table, action, eventType, key, item, allTableData, timestamp }) => void
 * @returns {Function} Función para cancelar la suscripción
 */
export const subscribeToRealtimeSync = (callback) => {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};

  activeSubscribers.add(callback);
  ensureNetworkRealtimeStarted();

  const handleCustomEvent = (event) => {
    if (event.detail) {
      callback(event.detail);
    }
  };

  const handleBroadcastMessage = (event) => {
    if (event.data && event.data.clientId !== CLIENT_ID) {
      callback(event.data);
    }
  };

  const handleStorageEvent = (event) => {
    if (!event.newValue) return;
    if (event.key === STORAGE_SIGNAL_KEY) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed && parsed.clientId !== CLIENT_ID) {
          const fp = `${parsed.tableId}:${parsed.action}:${parsed.key}:${parsed.timestamp}`;
          if (!rememberFingerprint(fp)) {
            callback(parsed);
          }
        }
      } catch (_) {}
      return;
    }

    const storageKeyToTableId = {
      sm_products_v4_fiscal: 'products',
      sm_clients_v4_fiscal: 'clients',
      signum_users_list: 'users',
      sm_sellers_v4_native: 'sellers',
      sm_orders_v4_native: 'orders',
      sm_config_v4_fiscal: 'config'
    };

    const mappedTableId = storageKeyToTableId[event.key];
    if (mappedTableId) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          callback({
            tableId: mappedTableId,
            table: mappedTableId,
            action: 'STORAGE_UPDATE',
            key: 'ALL',
            allTableData: parsed,
            timestamp: Date.now()
          });
        } else if (parsed && typeof parsed === 'object' && mappedTableId === 'config') {
          callback({
            tableId: 'config',
            table: 'config',
            action: 'RECONCILE',
            key: '1',
            item: parsed,
            timestamp: Date.now()
          });
        }
      } catch (_) {}
    } else if (event.key === 'signum_active_user') {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed && typeof parsed === 'object') {
          callback({
            tableId: 'users',
            table: 'users',
            action: 'RECONCILE',
            key: parsed.id || parsed.username,
            item: parsed,
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
    activeSubscribers.delete(callback);
    window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
  };
};
