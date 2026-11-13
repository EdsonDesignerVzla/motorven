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
  profit_stock_by_warehouse: 'stock_by_warehouse',
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

const OFFICIAL_BACKEND_URL = 'https://api.signummotorven.com';

let activeDiscoveredRealtimeUrl = null;

function isLocalOrLanHostname(h) {
  if (!h) return false;
  const lower = String(h).toLowerCase().trim();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(lower)) return true;
  if (lower.endsWith('.local') || lower.endsWith('.lan')) return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|26\.)/.test(lower)) return true;
  return false;
}

function isValidCustomRealtimeUrl(rawUrl, pageProtocol = 'https:', pageHostname = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const clean = rawUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(clean)) return false;
  if (clean.includes('loca.lt')) return false;
  try {
    const parsed = new URL(clean);
    const isPageLocal = isLocalOrLanHostname(pageHostname);
    if (!isPageLocal) {
      if (clean.endsWith('/sb') || isLocalOrLanHostname(parsed.hostname)) return false;
    }
    if (pageProtocol === 'https:' && parsed.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function resolveRealtimeBaseUrl() {
  if (typeof window === 'undefined' || !window.location) {
    return activeDiscoveredRealtimeUrl || OFFICIAL_BACKEND_URL;
  }
  const { protocol, hostname } = window.location;

  if (activeDiscoveredRealtimeUrl && isValidCustomRealtimeUrl(activeDiscoveredRealtimeUrl, protocol, hostname)) {
    return activeDiscoveredRealtimeUrl;
  }

  try {
    const custom = window.localStorage.getItem('signum_custom_backend_url');
    if (custom) {
      const clean = custom.trim().replace(/\/+$/, '');
      if (isValidCustomRealtimeUrl(clean, protocol, hostname)) {
        return clean;
      }
      // Limpiar automáticamente URLs obsoletas (loca.lt, /sb en dominio público o HTTP en HTTPS)
      window.localStorage.removeItem('signum_custom_backend_url');
    }
  } catch (_) {}

  return OFFICIAL_BACKEND_URL;
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
let isReconnectingSse = false;
let lastSseProbeAt = 0;
let networkSyncStarted = false;
let lastResyncAt = 0;

// Timeouts adaptados al túnel HTTPS de Cloudflare (latencia real de 1-5 s). Con 2.5-3 s las
// consultas se abortaban constantemente y los equipos remotos dejaban de recibir cambios.
const getNetworkTimeoutFor = (url) => (/^https:\/\//i.test(String(url || '')) ? 10000 : 4000);
const getHealthTimeoutFor = (url) => (/^https:\/\//i.test(String(url || '')) ? 9000 : 2500);

/**
 * El servidor indicó que este equipo perdió eventos (estuvo desconectado más tiempo del que
 * cubre el historial en memoria, o el servidor se reinició). Se solicita una recarga completa
 * de datos para que el equipo vuelva a quedar sincronizado sin tener que refrescar la página.
 */
function requestFullResync(reason) {
  const now = Date.now();
  if (now - lastResyncAt < 15000) return;
  lastResyncAt = now;
  console.warn(`[RealtimeSyncBridge] Resincronización completa solicitada (${reason}).`);
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('signum_realtime_resync_required', { detail: { reason } }));
    } catch (_) {}
  }
}

async function pollDeltaChanges() {
  if (isPollingInFlight) return;
  const baseUrl = resolveRealtimeBaseUrl();
  if (!baseUrl || typeof fetch === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  isPollingInFlight = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getNetworkTimeoutFor(baseUrl));
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
    if (data?.resync === true && typeof data?.seq === 'number') {
      lastProcessedSeq = data.seq;
      requestFullResync('historial-incompleto');
      return;
    }
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

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isReconnectingSse = false;

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
          if (typeof parsed.bootSeq === 'number' && lastProcessedSeq > 0 && lastProcessedSeq < parsed.bootSeq) {
            lastProcessedSeq = Number(parsed.seq || parsed.bootSeq);
            requestFullResync('servidor-reiniciado');
            return;
          }
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
      if (reconnectTimer || isReconnectingSse) return;
      isReconnectingSse = true;
      reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        if (activeSubscribers.size === 0) {
          isReconnectingSse = false;
          return;
        }
        const now = Date.now();
        if (now - lastSseProbeAt > 20000) {
          lastSseProbeAt = now;
          try {
            // Consultar primero backend_url.json publicado por el servidor de la oficina SVR-MOTORVEN
            const basePath = window.location.pathname.endsWith('/')
              ? window.location.pathname
              : window.location.pathname.replace(/\/[^/]*$/, '/');
            const resp = await fetch(`${window.location.origin}${basePath}backend_url.json?t=${Date.now()}`, { cache: 'no-store' });
            let foundHealthy = false;
            if (resp.ok) {
              const parsed = await resp.json();
              for (const rawCand of [parsed?.url, parsed?.fallbackTunnelUrl]) {
                const candidate = (rawCand || '').trim().replace(/\/+$/, '');
                if (candidate && isValidCustomRealtimeUrl(candidate, window.location.protocol, window.location.hostname)) {
                  const ctrl = new AbortController();
                  const tid = setTimeout(() => ctrl.abort(), getHealthTimeoutFor(candidate));
                  const healthResp = await fetch(`${candidate}/health`, { cache: 'no-store', signal: ctrl.signal }).catch(() => null);
                  clearTimeout(tid);
                  if (healthResp && healthResp.ok) {
                    activeDiscoveredRealtimeUrl = candidate;
                    window.localStorage.setItem('signum_custom_backend_url', candidate);
                    foundHealthy = true;
                    break;
                  }
                }
              }
            }
            if (!foundHealthy) {
              const ctrl = new AbortController();
              const tid = setTimeout(() => ctrl.abort(), getHealthTimeoutFor(OFFICIAL_BACKEND_URL));
              const healthResp = await fetch(`${OFFICIAL_BACKEND_URL}/health`, { cache: 'no-store', signal: ctrl.signal }).catch(() => null);
              clearTimeout(tid);
              if (healthResp && healthResp.ok) {
                activeDiscoveredRealtimeUrl = OFFICIAL_BACKEND_URL;
                window.localStorage.setItem('signum_custom_backend_url', OFFICIAL_BACKEND_URL);
              }
            }
          } catch (_) {}
        }
        isReconnectingSse = false;
        connectSseStream();
        pollDeltaChanges();
      }, 3000);
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

  // Sincronización híbrida continua:
  // 1) SSE push (< 50ms)
  // 2) Delta polling ligero cada 3.5s (solo consulta ?since=seq, ~70 bytes) para garantizar
  //    sincronización instantánea incluso si Cloudflare o redes móviles hacen buffering de SSE.
  pollTimer = setInterval(() => {
    if (activeSubscribers.size > 0) {
      pollDeltaChanges();
      if (!isReconnectingSse && (!sseSource || sseSource.readyState === 2)) {
        connectSseStream();
      }
    }
  }, 3500);

  const handleWakeUp = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    pollDeltaChanges();
    if (!sseSource || sseSource.readyState === 2) {
      connectSseStream();
    }
  };

  const handleBackendUpdated = (evt) => {
    if (evt?.detail?.url) {
      const candidate = String(evt.detail.url).trim().replace(/\/+$/, '');
      if (isValidCustomRealtimeUrl(candidate, window.location?.protocol, window.location?.hostname)) {
        activeDiscoveredRealtimeUrl = candidate;
      }
    }
    connectSseStream();
    pollDeltaChanges();
  };

  window.addEventListener('focus', handleWakeUp);
  window.addEventListener('online', handleWakeUp);
  window.addEventListener('pageshow', handleWakeUp);
  window.addEventListener('signum_backend_url_updated', handleBackendUpdated);
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

  // 4. Transmitir al servidor Supabase Central para sincronizar otros navegadores y dispositivos (PC, Laptop, iPhone, Android, Tablet)
  const baseUrl = resolveRealtimeBaseUrl();
  const isTestEnv = typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test');
  if (baseUrl && !isTestEnv && typeof fetch !== 'undefined') {
    const bodyStr = JSON.stringify({
      table: payload.table || payload.tableId,
      tableId: payload.tableId || payload.table,
      action: payload.action || 'RECONCILE',
      eventType: payload.action === 'DELETE' ? 'DELETE' : 'UPDATE',
      key: payload.key || null,
      item: payload.item || payload.data || null,
      clientId: CLIENT_ID
    });
    const headers = {
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true',
      'ngrok-skip-browser-warning': 'true'
    };
    fetch(`${baseUrl}/realtime/v1/broadcast`, {
      method: 'POST',
      headers,
      body: bodyStr
    }).catch(() => {
      if (baseUrl !== OFFICIAL_BACKEND_URL) {
        fetch(`${OFFICIAL_BACKEND_URL}/realtime/v1/broadcast`, {
          method: 'POST',
          headers,
          body: bodyStr
        }).catch(() => {});
      }
    });
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
