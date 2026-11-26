import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_FISCAL_CLOSURES,
  INITIAL_ORDERS
} from '../data/mockData.js';
import {
  REAL_CONFIG,
  REAL_PRODUCTS,
  REAL_CLIENTS,
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
  REAL_PROFIT_CURRENCIES,
  REAL_USERS,
  REAL_ORDERS,
  REAL_SALES,
  REAL_PURCHASES,
  REAL_SUPPLIERS,
  REAL_CASH_MOVEMENTS,
  REAL_FISCAL_CLOSURES,
  REAL_NOTIFICATIONS
} from '../data/supabaseRealData.js';
import {
  calculateFiscalTaxes,
  generateFiscalControlNumber,
  generateDeliveryNoteControlNumber,
  formatDocumentControlNumber,
  generateVatRetentionVoucherNumber,
  getNextInvoiceCorrelativo,
  commitInvoiceCorrelativo,
  getNextNotaEntregaCorrelativo,
  commitNotaEntregaCorrelativo,
  getCanonicalDocKey,
  getEraScopedCanonicalDocKey,
  isLegacyPreNovInvoice,
  dedupeCanonicalDocs
} from './fiscalService.js';
import {
  inferCxcDocType,
  normalizeCollectionWriteAmounts
} from '../utils/cxcUtils.js';
import {
  normalizeRateType,
  isFiscalDocumentForRatePolicy,
  isDirectCurrencyRateType
} from '../utils/rateClassificationUtils.js';
import { resolveProductUnit, resolveProductLitersPerUnit, getProductWarehouseStocks, validateWarehouseStockForDocument } from './formatService.js';
import { isCreditPaymentCondition, resolveCreditDaysFromTerm, calculateExpirationDate, preserveDateWithTime, parseInvoiceDateInfo } from './creditPolicyService.js';
import {
  getConfig as getStorageConfig,
  updateConfig as updateStorageConfig,
  getProducts as getStorageProducts,
  saveProduct as saveStorageProduct,
  patchProductsStockInStorage,
  deleteProduct as deleteStorageProduct,
  getClients as getStorageClients,
  saveClient as saveStorageClient,
  deleteClient as deleteStorageClient,
  getSuppliers as getStorageSuppliers,
  saveSupplier as saveStorageSupplier,
  getSales as getStorageSales,
  saveSale as saveStorageSale,
  saveFiscalAdjustmentSale as saveStorageFiscalAdjustmentSale,
  getPurchases as getStoragePurchases,
  savePurchase as saveStoragePurchase,
  updateStoragePurchase,
  getCashMovements as getStorageCashMovements,
  addCashMovement as addStorageCashMovement,
  updateCashMovement as updateStorageCashMovement,
  deleteCashMovement as deleteStorageCashMovement,
  getFiscalClosures as getStorageFiscalClosures,
  saveFiscalClosure as saveStorageFiscalClosure,
  closeSalesInStorage,
  getUserLogs as getStorageUserLogs,
  addUserLog as addStorageUserLog,
  getOrders as getStorageOrders,
  saveOrder as saveStorageOrder,
  updateOrderStatus as updateStorageOrderStatus,
  getStorageSellers,
  saveStorageSeller,
  saveStorageAllSellers,
  getStorageNotifications,
  saveStorageNotification,
  markStorageNotificationRead,
  markAllStorageNotificationsRead,
  deleteStorageNotification,
  deleteStorageOrder,
  deleteStorageSale,
  getCommissionSettlements as getStorageCommissionSettlements,
  saveCommissionSettlement as saveStorageCommissionSettlement,
  deleteCommissionSettlement as deleteStorageCommissionSettlement,
  getStorageEmployees,
  saveStorageEmployee,
  deleteStorageEmployee,
  getStoragePayroll,
  saveStoragePayroll,
  deleteStoragePayroll,
  getStorageExpenses,
  saveStorageExpense,
  deleteStorageExpense
} from './storageService.js';
import {
  normalizeProfitCollectionUsd,
  matchesSeller,
  resolveInvoiceLitros,
  resolveInvoiceCajas
} from './commissionService.js';
export { normalizeProfitCollectionUsd };
import {
  DEFAULT_USERS,
  ROLE_PERMISSIONS,
  sortUsersByHierarchy,
  getUsersList,
  normalizeRole,
  getRoleMeta,
  getUserDepartment
} from './authService.js';
import {
  enqueueSyncAction,
  getSyncQueue,
  isNetworkOnline,
  flushSyncQueue
} from './offlineSyncService.js';
import { broadcastReconcileChange, getRealtimeClientId } from './realtimeSyncBridge.js';
import {
  buildCxpCompositeKey,
  buildCxpLookupKeys,
  buildCxpStableId,
  dedupePayablesList,
  dedupeSupplierPaymentsList,
  doesPayableMatchDocument,
  normalizeProviderRif,
  normalizeDocNumber,
  normalizeDocType
} from '../utils/cxpUtils.js';
import { dedupeCashMovements, resolveOpeningBalanceMeta, mergeOpeningBalanceFields } from '../utils/treasuryAccountUtils.js';
import { round2 } from './formatService.js';

const OFFICIAL_BACKEND_URL = 'https://api.signummotorven.com';
const DEFAULT_SUPABASE_URL = OFFICIAL_BACKEND_URL;
const DEFAULT_SUPABASE_ANON_KEY = 'local-free-token';

const configuredSupabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
const isTestEnv = typeof process !== 'undefined' && Boolean(process.env?.VITEST || process.env?.NODE_ENV === 'test');

function isLocalOrLanHostname(h) {
  if (!h) return false;
  const lower = String(h).toLowerCase().trim();
  if (LOCAL_HOSTNAMES.includes(lower)) return true;
  if (lower.endsWith('.local') || lower.endsWith('.lan')) return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|26\.)/.test(lower)) return true;
  return false;
}

function isValidSavedBackendUrl(rawUrl, pageProtocol = 'https:', pageHostname = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const clean = rawUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(clean)) return false;
  if (clean.includes('loca.lt') || clean.includes('trycloudflare.com')) return false;
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

const resolveInitialSupabaseUrl = (configured) => {
  try {
    if (typeof window === 'undefined' || !window.location || !/^https?:$/.test(window.location.protocol)) {
      return configured || OFFICIAL_BACKEND_URL;
    }

    const { protocol, hostname } = window.location;

    // Limpiar automáticamente cualquier URL obsoleta en localStorage (loca.lt, /sb en nube o HTTP en HTTPS)
    try {
      const savedCustom = window.localStorage.getItem('signum_custom_backend_url');
      if (savedCustom) {
        const cleanSaved = savedCustom.trim().replace(/\/+$/, '');
        if (isValidSavedBackendUrl(cleanSaved, protocol, hostname)) {
          return cleanSaved;
        }
        window.localStorage.removeItem('signum_custom_backend_url');
      }
    } catch (_) {}

    return OFFICIAL_BACKEND_URL;
  } catch (_) {
    return OFFICIAL_BACKEND_URL;
  }
};

let currentBackendUrl = resolveInitialSupabaseUrl(configuredSupabaseUrl);

// Nunca bloquear llamadas a Supabase en GitHub Pages o dominio propio signummotorven.com
export const isStaticCloudHost = false;

let backendDiscoveryPromise = null;
let backendDiscoveryInFlight = false;
let initialDiscoveryCompleted = false;
let lastDiscoveryAt = 0;

// El túnel HTTPS (Cloudflare) o conexiones/equipos lentos pueden tardar varios segundos;
// damos holgura amplia para no marcar el servidor como caído innecesariamente (si responde rápido, retorna al instante).
const getHealthTimeoutFor = (url) => (/^https:\/\//i.test(String(url || '')) ? 20000 : 6000);

async function probeBackendHealth(candidateUrl, timeoutMs = getHealthTimeoutFor(candidateUrl)) {
  if (!candidateUrl || typeof fetch === 'undefined') return false;
  try {
    const clean = candidateUrl.trim().replace(/\/+$/, '');
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${clean}/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'bypass-tunnel-reminder': 'true',
        'ngrok-skip-browser-warning': 'true'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(tid);
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function discoverActiveBackendUrl(force = false) {
  if (isTestEnv || typeof window === 'undefined' || typeof fetch === 'undefined') {
    initialDiscoveryCompleted = true;
    return currentBackendUrl;
  }
  const now = Date.now();
  // Reutilizar SIEMPRE un descubrimiento en curso (aunque sea forzado): antes cada petición
  // fallida lanzaba su propio descubrimiento y saturaba el túnel con decenas de /health.
  if (backendDiscoveryInFlight && backendDiscoveryPromise) {
    return backendDiscoveryPromise;
  }
  if (!force && backendDiscoveryPromise && (now - lastDiscoveryAt < 8000)) {
    return backendDiscoveryPromise;
  }
  lastDiscoveryAt = now;
  backendDiscoveryInFlight = true;

  backendDiscoveryPromise = (async () => {
    try {
      const candidates = [];
      let publishedPrimaryUrl = null;
      const pageProtocol = window.location?.protocol || 'https:';
      const pageHostname = window.location?.hostname || '';
      const isPageLocal = isLocalOrLanHostname(pageHostname);

      // 1. Parámetro ?server= en la barra de direcciones (y limpiar barra si estaba viejo)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paramUrl = urlParams.get('server') || urlParams.get('backend');
        if (paramUrl && isValidSavedBackendUrl(paramUrl, pageProtocol, pageHostname)) {
          const cleanParam = paramUrl.trim().replace(/\/+$/, '');
          if (!candidates.includes(cleanParam)) candidates.push(cleanParam);
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
          }
        }
      } catch (_) {}

      // 2. Si se abre por HTTP en la red local de la oficina (LAN), priorizar el servidor central real (192.168.0.3)
      if (isPageLocal && pageProtocol === 'http:') {
        const localCandidates = [
          'http://192.168.0.3:54321',
          window.location.origin && window.location.origin !== 'null' ? `${window.location.origin}/sb` : null,
          'http://127.0.0.1:54321',
          'http://localhost:54321'
        ];
        for (const lc of localCandidates) {
          if (lc && !candidates.includes(lc)) candidates.push(lc);
        }
      }

      // 3. backend_url.json publicado automáticamente por el servidor central (192.168.0.3)
      try {
        const basePath = window.location.pathname.endsWith('/')
          ? window.location.pathname
          : window.location.pathname.replace(/\/[^/]*$/, '/');
        const jsonUrl = `${window.location.origin}${basePath}backend_url.json?t=${Date.now()}`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(jsonUrl, { cache: 'no-store', signal: controller.signal });
        clearTimeout(tid);
        if (resp.ok) {
          const parsed = await resp.json();
          for (const rawCandidate of [parsed?.url, parsed?.fallbackTunnelUrl]) {
            if (rawCandidate && isValidSavedBackendUrl(rawCandidate, pageProtocol, pageHostname)) {
              const cleanJsonUrl = rawCandidate.trim().replace(/\/+$/, '');
              if (!publishedPrimaryUrl) publishedPrimaryUrl = cleanJsonUrl;
              if (!candidates.includes(cleanJsonUrl)) candidates.push(cleanJsonUrl);
            }
          }
          if (isPageLocal && pageProtocol === 'http:' && Array.isArray(parsed?.lanUrls)) {
            for (const lan of parsed.lanUrls) {
              if (lan && /^http:\/\//i.test(lan)) {
                const cleanLan = lan.trim().replace(/\/+$/, '');
                if (!candidates.includes(cleanLan)) candidates.push(cleanLan);
              }
            }
          }
        }
      } catch (_) {}

      // 4. Dominio oficial HTTPS y fallback a URL guardada en localStorage si es válida
      if (!candidates.includes(OFFICIAL_BACKEND_URL)) {
        candidates.push(OFFICIAL_BACKEND_URL);
      }
      try {
        const savedCustom = window.localStorage.getItem('signum_custom_backend_url');
        if (savedCustom && isValidSavedBackendUrl(savedCustom, pageProtocol, pageHostname)) {
          const cleanSaved = savedCustom.trim().replace(/\/+$/, '');
          if (!candidates.includes(cleanSaved)) candidates.push(cleanSaved);
        }
      } catch (_) {}

      for (const candidate of candidates) {
        if (!candidate || candidate.includes('loca.lt')) continue;
        const healthy = await probeBackendHealth(candidate);
        if (healthy) {
          currentBackendUrl = candidate;
          try {
            window.localStorage.setItem('signum_custom_backend_url', candidate);
            window.dispatchEvent(new CustomEvent('signum_backend_url_updated', { detail: { url: candidate } }));
          } catch (_) {}
          isSupabaseAvailable = true;
          initialDiscoveryCompleted = true;
          return candidate;
        }
      }

      // Si ningún /health respondió a tiempo, adoptar la URL publicada por el servidor central o el dominio oficial
      currentBackendUrl = publishedPrimaryUrl || OFFICIAL_BACKEND_URL;
      try {
        window.localStorage.setItem('signum_custom_backend_url', currentBackendUrl);
        window.dispatchEvent(new CustomEvent('signum_backend_url_updated', { detail: { url: currentBackendUrl } }));
      } catch (_) {}
    } catch (_) {}
    initialDiscoveryCompleted = true;
    return currentBackendUrl;
  })().finally(() => {
    backendDiscoveryInFlight = false;
  });

  return backendDiscoveryPromise;
}

if (!isTestEnv && typeof window !== 'undefined') {
  discoverActiveBackendUrl(true).catch(() => {});
}

export const getActiveBackendUrl = () => currentBackendUrl;

export const setCustomBackendUrl = (url) => {
  try {
    if (!url || typeof url !== 'string' || !url.trim()) {
      localStorage.removeItem('signum_custom_backend_url');
    } else {
      const clean = url.trim().replace(/\/+$/, '');
      currentBackendUrl = clean;
      localStorage.setItem('signum_custom_backend_url', clean);
    }
    window.location.reload();
  } catch (_) {}
};

function rewriteRequestUrl(rawInput, targetBaseUrl) {
  try {
    const str = typeof rawInput === 'string' ? rawInput : (rawInput?.url || String(rawInput));
    const match = str.match(/^https?:\/\/[^/]+(?:\/sb)?(\/(?:rest|storage|realtime|health|api|admin)\/.*)$/);
    if (match && targetBaseUrl) {
      return `${targetBaseUrl.replace(/\/+$/, '')}${match[1]}`;
    }
    return str;
  } catch (_) {
    return rawInput;
  }
}

const RETRYABLE_GATEWAY_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 530]);
let hadReadFallbackSinceOnline = false;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const notifyBackendRecoveredIfNeeded = () => {
  if (!hadReadFallbackSinceOnline || typeof window === 'undefined') return;
  hadReadFallbackSinceOnline = false;
  try {
    window.dispatchEvent(new CustomEvent('signum_realtime_resync_required', { detail: { reason: 'backend-recovered' } }));
  } catch (_) {}
};

const dynamicSupabaseFetch = async (input, init) => {
  if (isTestEnv || typeof fetch === 'undefined') {
    return fetch(input, init);
  }
  // Esperar siempre el descubrimiento inicial para garantizar uso del servidor activo de la oficina
  if (!initialDiscoveryCompleted && backendDiscoveryPromise) {
    try {
      await backendDiscoveryPromise;
    } catch (_) {}
  }

  const maxAttempts = 3;
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (init?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const targetUrl = rewriteRequestUrl(input, currentBackendUrl);
    try {
      const res = await fetch(targetUrl, { ...init, cache: 'no-store' });
      if (res.status < 500 && res.status !== 404) {
        isSupabaseAvailable = true;
        notifyBackendRecoveredIfNeeded();
        return res;
      }
      if (res.status === 404) {
        // 404 en /rest/v1/... puede indicar túnel obsoleto; probar descubrimiento una vez
        if (attempt === 0) {
          const prevUrl = currentBackendUrl;
          const discovered = await discoverActiveBackendUrl(true);
          if (discovered && discovered !== prevUrl) {
            continue;
          }
        }
        isSupabaseAvailable = true;
        return res;
      }
      lastResponse = res;
      if (!RETRYABLE_GATEWAY_STATUSES.has(res.status) || attempt === maxAttempts - 1) {
        return res;
      }
    } catch (err) {
      lastError = err;
      if (err?.name === 'AbortError' || init?.signal?.aborted || attempt === maxAttempts - 1) {
        throw err;
      }
    }

    // Reintento tras error transitorio de túnel (502/503/504/530/red) aunque la URL siga siendo la oficial
    await sleepMs(700 * (attempt + 1));
    try {
      await discoverActiveBackendUrl(false);
    } catch (_) {}
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Failed to fetch');
};

export const supabase = createClient(currentBackendUrl, supabaseAnonKey, {
  global: {
    fetch: dynamicSupabaseFetch,
    headers: {
      'bypass-tunnel-reminder': 'true',
      'ngrok-skip-browser-warning': 'true'
    }
  }
});

/**
 * Corrige URLs públicas de Storage guardadas con otro host (p. ej. http://localhost:54321/...)
 * para que las fotos se vean desde cualquier equipo de la red.
 */
export const normalizeStorageUrl = (url) => {
  if (!url || typeof url !== 'string' || url.startsWith('data:')) return url;
  if (url.includes('user_kenterbertf2_1793628')) return null;
  const match = url.match(/^https?:\/\/[^/]+(?:\/sb)?\/(storage\/v1\/object\/public\/.+)$/);
  if (!match) return url;
  return `${currentBackendUrl.replace(/\/+$/, '')}/${match[1]}`;
};

/**
 * Traduce errores de red a un mensaje entendible para el usuario.
 */
export const describeSupabaseError = (err, fallback = 'Error en la base de datos.') => {
  const msg = err?.message || String(err || '');
  if (/Failed to fetch|NetworkError|ERR_CONNECTION|timeout|Load failed/i.test(msg)) {
    return 'Sin conexión directa con el servidor local; los cambios se guardaron localmente y se sincronizarán al reconectar.';
  }
  return msg || fallback;
};

let isSupabaseAvailable = true;

export const isSupabaseOnline = () => isSupabaseAvailable;

export const resetSupabaseOnlineStatus = () => {
  isSupabaseAvailable = true;
};

const withTimeout = (promise, ms) => {
  let timeoutMs = 60000;
  try {
    const isLocal = typeof window !== 'undefined' && window.location && LOCAL_HOSTNAMES.includes(window.location.hostname);
    timeoutMs = isLocal
      ? (ms ? Math.max(ms, 20000) : 35000)
      : (ms ? Math.max(ms, 35000) : 60000);
  } catch (_) {
    timeoutMs = ms ? Math.max(ms, 35000) : 60000;
  }
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Supabase connection timeout")), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

export const isStaticFallbackList = (list) => Boolean(list && list.__isStaticFallback);

const markStaticFallback = (list) => {
  if (Array.isArray(list)) {
    try {
      Object.defineProperty(list, '__isStaticFallback', {
        value: true,
        enumerable: false,
        configurable: true
      });
    } catch (_) {}
  }
  return list;
};

const runSupabaseQueryWithRetry = async (queryFactory, timeoutMs = 65000, maxRetries = 2) => {
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(queryFactory(), timeoutMs);
      if (result?.error && attempt < maxRetries && /timeout|network|fetch|aborted|502|503|504/i.test(String(result.error.message || ''))) {
        lastErr = result.error;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && /timeout|network|fetch|aborted/i.test(String(err?.message || ''))) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Supabase connection timeout');
};

const markSupabaseOffline = (err, action = '') => {
  const msg = err?.message || String(err);
  if (!isNetworkOnline()) {
    isSupabaseAvailable = false;
  }
  if (/^get/i.test(action)) {
    hadReadFallbackSinceOnline = true;
  }
  console.warn(`[Supabase Offline Fallback] ${action}:`, msg);
  if (typeof window !== 'undefined' && /^(save|update|delete|create|add|commit)/i.test(action)) {
    try {
      window.dispatchEvent(new CustomEvent('signum_offline_fallback_warning', {
        detail: {
          action,
          message: 'Aviso: Sin respuesta del servidor central. El cambio se encoló en modo contingencia y se enviará al reconectar.'
        }
      }));
    } catch (_) {}
  }
};

// --- Mappings ---

const CORE_CONFIG_FIELDS = [
  ['nombreEmpresa', 'nombre_empresa', 'string'],
  ['marcaOficial', 'marca_oficial', 'string'],
  ['rif', 'rif', 'string'],
  ['direccion', 'direccion', 'string'],
  ['telefono', 'telefono', 'string'],
  ['email', 'email', 'string'],
  ['instagram', 'instagram', 'string'],
  ['tasaDolar', 'tasa_dolar', 'number'],
  ['monedaPrincipal', 'moneda_principal', 'string'],
  ['monedaSecundaria', 'moneda_secundaria', 'string'],
  ['almacenActual', 'almacen_actual', 'string'],
  ['ivaPorcentaje', 'iva_porcentaje', 'number'],
  ['igtfPorcentaje', 'igtf_porcentaje', 'number'],
  ['metaComercialLitros', 'meta_comercial_litros', 'number']
];

const EXTENDED_CONFIG_FIELDS = [
  ['pieDePagina', 'pie_de_pagina', 'string'],
  ['tasaKeystone', 'tasa_keystone', 'number'],
  ['margenKeystonePorcentaje', 'margen_keystone_porcentaje', 'number'],
  ['diasCreditoDefecto', 'dias_credito_defecto', 'number'],
  ['limiteCreditoDefecto', 'limite_credito_defecto', 'number'],
  ['aprobadorCreditoDefecto', 'aprobador_credito_defecto', 'string'],
  ['aprobadoresCredito', 'aprobadores_credito', 'raw'],
  ['alertaStockMinimoDias', 'alerta_stock_minimo_dias', 'number'],
  ['leadTimeDiasDefecto', 'lead_time_dias_defecto', 'number'],
  ['margenGananciaAceites', 'margen_ganancia_aceites', 'number'],
  ['activarAlertasQuiebre', 'activar_alertas_quiebre', 'boolean'],
  ['bloqueoMoraDias', 'bloqueo_mora_dias', 'number'],
  ['alertaAmarillaMoraDias', 'alerta_amarilla_mora_dias', 'number'],
  ['plantillaWhatsapp', 'plantilla_whatsapp', 'string'],
  ['syncIntervalSec', 'sync_interval_sec', 'number'],
  ['offlineFirstEnabled', 'offline_first_enabled', 'boolean'],
  ['sonidosNotificacion', 'sonidos_notificacion', 'boolean'],
  ['ejercicioFiscalActivo', 'ejercicio_fiscal_activo', 'number'],
  ['periodoFiscalInicio', 'periodo_fiscal_inicio', 'string'],
  ['periodoFiscalFin', 'periodo_fiscal_fin', 'string'],
  ['historialEjercicios', 'historial_ejercicios', 'raw']
];

const mapConfigToDb = (c, { coreOnly = false } = {}) => {
  const fields = coreOnly ? CORE_CONFIG_FIELDS : [...CORE_CONFIG_FIELDS, ...EXTENDED_CONFIG_FIELDS];
  const payload = { id: 1, updated_at: new Date().toISOString() };
  for (const [camelKey, snakeKey] of fields) {
    const val = c[camelKey] !== undefined ? c[camelKey] : c[snakeKey];
    if (val === undefined) continue;
    payload[snakeKey] = val;
    if (!coreOnly && camelKey !== snakeKey) {
      payload[camelKey] = val;
    }
  }
  return payload;
};

const mapConfigFromDb = (c) => {
  if (!c) return null;
  const cachedLocal = getStorageConfig() || {};
  const mapped = { ...cachedLocal };
  for (const [camelKey, snakeKey, type] of [...CORE_CONFIG_FIELDS, ...EXTENDED_CONFIG_FIELDS]) {
    const rawVal = c[snakeKey] !== undefined ? c[snakeKey] : c[camelKey];
    if (rawVal === undefined || rawVal === null) continue;
    if (type === 'number') {
      const n = Number(rawVal);
      if (!Number.isNaN(n)) mapped[camelKey] = n;
    } else if (type === 'boolean') {
      mapped[camelKey] = Boolean(rawVal);
    } else {
      mapped[camelKey] = rawVal;
    }
  }
  return mapped;
};

export const inferProductLineAndFamily = (p) => {
  const code = String(p.codigo || p.id || '').toUpperCase();
  const desc = String(p.descripcion || p.nombre || '').toUpperCase();
  const cat = String(p.categoria || '').toUpperCase();

  let linea = p.linea || p.co_lin || p.coLin;
  let linea_descripcion = p.linea_descripcion || p.lineaDescripcion || p.lin_des || p.linDes;
  let familia = p.familia || p.co_sub || p.coSub;
  let familia_descripcion = p.familia_descripcion || p.familiaDescripcion || p.subl_des || p.sublDes;
  let co_cat = p.co_cat || p.coCat || 'MIN';

  if (!linea) {
    if (code.includes('DIESEL') || desc.includes('DIESEL') || cat.includes('DIESEL')) {
      linea = 'LUB-DIE';
      linea_descripcion = 'LUBRICANTES MOTOR DIÉSEL PESADO';
      familia = 'DIE-50';
      familia_descripcion = 'Diésel Monogrado SAE 50 CF/CF-2';
    } else if (desc.includes('HIDRA') || cat.includes('HIDRA') || desc.includes('AW68')) {
      linea = 'LUB-HID';
      linea_descripcion = 'LUBRICANTES HIDRÁULICOS & INDUSTRIALES';
      familia = 'HID-68';
      familia_descripcion = 'Hidráulicos Anti-desgaste ISO VG 68';
      co_cat = 'IND';
    } else if (desc.includes('DEXRON') || desc.includes('ATF') || (cat.includes('TRANSMISION') && desc.includes('AUTOMATICA'))) {
      linea = 'LUB-TRA';
      linea_descripcion = 'LUBRICANTES TRANSMISIÓN & CAJAS';
      familia = 'TRA-AUT';
      familia_descripcion = 'Transmisión Automática Dexron II / Mercon';
      co_cat = 'IND';
    } else if (desc.includes('TRANS-MANUAL') || desc.includes('SAE 140') || desc.includes('GL-4')) {
      linea = 'LUB-TRA';
      linea_descripcion = 'LUBRICANTES TRANSMISIÓN & CAJAS';
      familia = 'TRA-MAN';
      familia_descripcion = 'Transmisión Manual y Diferenciales SAE 140 GL-4';
      co_cat = 'IND';
    } else if (desc.includes('2 TIEMPOS') || desc.includes('2T') || desc.includes('4 TIEMPOS') || desc.includes('MOTOS')) {
      linea = 'LUB-MOT';
      linea_descripcion = 'LUBRICANTES MOTOS 4T / 2T';
      familia = desc.includes('2') ? 'MOT-2T' : 'MOT-4T';
      familia_descripcion = desc.includes('2') ? 'Motos 2 Tiempos API TC JASO FB' : 'Motos 4 Tiempos 20W-50 JASO MA2';
    } else if (desc.includes('FUERA DE BORDA') || desc.includes('TC-W3')) {
      linea = 'LUB-GAS';
      linea_descripcion = 'LUBRICANTES MOTOR GASOLINA';
      familia = 'MAR-FB';
      familia_descripcion = 'Marino Fuera de Borda TC-W3';
    } else if (code === '101815' || desc.includes('FLETE')) {
      linea = 'SER-LOG';
      linea_descripcion = 'SERVICIOS & LOGÍSTICA';
      familia = 'SER-FLE';
      familia_descripcion = 'Servicios de Flete y Distribución';
      co_cat = 'IND';
    } else if (code === 'GNP001' || desc.includes('PUBLICIDAD') || desc.includes('PROPAGANDA')) {
      linea = 'GAS-OPE';
      linea_descripcion = 'GASTOS OPERACIONALES NO PRODUCTIVOS';
      familia = 'GAS-NOP';
      familia_descripcion = 'Gastos Operacionales y Publicidad';
      co_cat = 'IND';
    } else {
      linea = 'LUB-GAS';
      linea_descripcion = 'LUBRICANTES MOTOR GASOLINA';
      if (desc.includes('SEMI') || desc.includes('R500')) {
        familia = 'SEM-GAS';
        familia_descripcion = 'Semi-Sintético Alta Tecnología R500';
        co_cat = 'SEM';
      } else if (desc.includes('25W-60') || desc.includes('ALTO KILOMETRAJE')) {
        familia = 'AK-GAS';
        familia_descripcion = 'Alto Kilometraje SAE 25W-60';
      } else {
        familia = 'MIN-GAS';
        familia_descripcion = 'Mineral Motor Gasolina';
      }
    }
  }

  return {
    linea,
    linea_descripcion,
    lineaDescripcion: linea_descripcion,
    co_lin: linea,
    coLin: linea,
    familia,
    familia_descripcion,
    familiaDescripcion: familia_descripcion,
    co_sub: familia,
    coSub: familia,
    co_cat,
    coCat: co_cat
  };
};

const mapProductToDb = (p) => {
  const precioUsdDetal = Number(p.precioUsdDetal ?? p.precio_usd_detal ?? p.precio ?? p.precioVenta ?? 0) || 0;
  const precioUsdMayor = Number(p.precioUsdMayor ?? p.precio_usd_mayor ?? (precioUsdDetal > 0 ? precioUsdDetal : 0)) || 0;
  const costoUsd = Number(p.costoUsd ?? p.costo_usd ?? p.costo ?? 0) || 0;
  const costoUsd01 = Number(p.costoUsd01 ?? p.costo_usd_01 ?? costoUsd) || 0;
  const costoUsd02 = Number(p.costoUsd02 ?? p.costo_usd_02 ?? costoUsd) || 0;
  const precioUsdDetal01 = Number(p.precioUsdDetal01 ?? p.precio_usd_detal_01 ?? precioUsdDetal) || 0;
  const precioUsdDetal02 = Number(p.precioUsdDetal02 ?? p.precio_usd_detal_02 ?? precioUsdDetal) || 0;
  const precioUsdMayor01 = Number(p.precioUsdMayor01 ?? p.precio_usd_mayor_01 ?? (precioUsdMayor > 0 ? precioUsdMayor : precioUsdDetal01)) || 0;
  const precioUsdMayor02 = Number(p.precioUsdMayor02 ?? p.precio_usd_mayor_02 ?? (precioUsdMayor > 0 ? precioUsdMayor : precioUsdDetal02)) || 0;
  const litrosPorUnidad = resolveProductLitersPerUnit(p);
  const comprometido = Number(p.comprometido ?? 0) || 0;
  const stockMinimo = Number(p.stockMinimo ?? p.stock_minimo ?? 0) || 0;
  const hierarchy = inferProductLineAndFamily(p);
  const warehouseStocks = getProductWarehouseStocks(p);
  const stock = warehouseStocks.total;
  const stock01 = warehouseStocks.stock01;
  const stock02 = warehouseStocks.stock02;
  const cleanId = String(p.id || p.codigo || '').trim() || `OIL_${Date.now()}`;
  const cleanCodigo = String(p.codigo || cleanId).trim();

  return {
    id: cleanId,
    codigo: cleanCodigo,
    co_art: cleanId,
    oem: p.oem || '',
    descripcion: p.descripcion || p.nombre || '',
    nombre: p.nombre || p.descripcion || '',
    marca: p.marca || 'OILSTONE',
    categoria: p.categoria || 'Lubricantes',
    viscosidad: p.viscosidad || '',
    norma_api: p.normaApi || p.norma_api || '',
    normaApi: p.normaApi || p.norma_api || '',
    presentaciones_disponibles: p.presentacionesDisponibles || p.presentaciones_disponibles || [],
    presentacionesDisponibles: p.presentacionesDisponibles || p.presentaciones_disponibles || [],
    unidad: resolveProductUnit(p, 'Caja'),
    litros_por_unidad: litrosPorUnidad,
    litrosPorUnidad,
    stock,
    stockAlmacen01: stock01,
    stock_almacen_01: stock01,
    stockAlmacen02: stock02,
    stock_almacen_02: stock02,
    comprometido,
    stock_minimo: stockMinimo,
    stockMinimo,
    costo_usd: costoUsd,
    costoUsd,
    costo: costoUsd,
    costo_usd_01: costoUsd01,
    costoUsd01,
    costo_usd_02: costoUsd02,
    costoUsd02,
    precio_usd_detal: precioUsdDetal,
    precioUsdDetal,
    precio_usd_detal_01: precioUsdDetal01,
    precioUsdDetal01,
    precio_usd_detal_02: precioUsdDetal02,
    precioUsdDetal02,
    precio_usd_mayor: precioUsdMayor,
    precioUsdMayor,
    precio_usd_mayor_01: precioUsdMayor01,
    precioUsdMayor01,
    precio_usd_mayor_02: precioUsdMayor02,
    precioUsdMayor02,
    precio: precioUsdDetal,
    precioUsd: precioUsdDetal,
    precioVenta: precioUsdDetal,
    precioMayor: precioUsdMayor,
    aplica_iva: p.aplicaIva !== undefined ? p.aplicaIva : (p.aplica_iva !== undefined ? p.aplica_iva : true),
    aplicaIva: p.aplicaIva !== undefined ? p.aplicaIva : (p.aplica_iva !== undefined ? p.aplica_iva : true),
    color_etiqueta: p.colorEtiqueta || p.color_etiqueta || '#002b7a',
    colorEtiqueta: p.colorEtiqueta || p.color_etiqueta || '#002b7a',
    imagen: resolveFallbackProductImage(p),
    especificaciones: p.especificaciones || {},
    linea: hierarchy.linea,
    linea_descripcion: hierarchy.linea_descripcion,
    lineaDescripcion: hierarchy.lineaDescripcion,
    co_lin: hierarchy.co_lin,
    coLin: hierarchy.coLin,
    familia: hierarchy.familia,
    familia_descripcion: hierarchy.familia_descripcion,
    familiaDescripcion: hierarchy.familiaDescripcion,
    co_sub: hierarchy.co_sub,
    coSub: hierarchy.coSub,
    co_cat: hierarchy.co_cat,
    coCat: hierarchy.coCat,
    almacen: p.almacen || '01: ALMACÉN PRINCIPAL / MOSTRADOR | 02: ALMACÉN CENTRAL / BÓVEDA',
    co_alm: p.co_alm || p.coAlm || '01,02',
    coAlm: p.coAlm || p.co_alm || '01,02',
    almacenes: Array.isArray(p.almacenes) ? p.almacenes : ['01', '02'],
    ubicacion: p.ubicacion || '01: Almacén Principal • 02: Almacén Central',
    updated_at: p.updated_at || new Date().toISOString()
  };
};

const INVENTORY_RECONCILE_EPOCH_KEY = 'signum_inventory_reconcile_epoch';
const INVENTORY_RECONCILE_EPOCH = '2026-11-18_reconciled_v1';
const INVENTORY_RECONCILE_CUTOFF_ISO = '2026-11-18T21:00:00.000Z';

// Invalida cachés de inventario y deltas pre-conciliación para evitar que pestañas previas muestren/reapliquen saldos inflados
export const ensureInventoryReconcileEpoch = () => {
  if (isTestEnv || typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(INVENTORY_RECONCILE_EPOCH_KEY) === INVENTORY_RECONCILE_EPOCH) {
      return false;
    }
    localStorage.removeItem('sm_products_v4_fiscal');
    try {
      const rawQueue = localStorage.getItem('signum_offline_sync_queue');
      if (rawQueue) {
        const parsed = JSON.parse(rawQueue);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(item => {
            if (!item || item.entity !== 'stock_delta') return true;
            const ts = String(item.timestamp || item.createdAt || '');
            return ts >= INVENTORY_RECONCILE_CUTOFF_ISO;
          });
          if (filtered.length !== parsed.length) {
            localStorage.setItem('signum_offline_sync_queue', JSON.stringify(filtered));
          }
        }
      }
    } catch (_) {}
    localStorage.setItem(INVENTORY_RECONCILE_EPOCH_KEY, INVENTORY_RECONCILE_EPOCH);
    return true;
  } catch (_) {
    return false;
  }
};

const PRODUCT_LIGHT_COLUMNS = [
  'id', 'codigo', 'co_art', 'sku', 'oem', 'descripcion', 'nombre', 'marca', 'categoria',
  'viscosidad', 'norma_api', 'normaApi', 'presentaciones_disponibles', 'presentacionesDisponibles',
  'unidad', 'litros_por_unidad', 'litrosPorUnidad',
  'stock', 'stock_almacen_01', 'stockAlmacen01', 'stock_almacen_02', 'stockAlmacen02', 'stock_alm_01', 'stock_alm_02',
  'comprometido', 'stock_minimo', 'stockMinimo',
  'costo_usd', 'costoUsd', 'costo', 'costo_usd_01', 'costoUsd01', 'costo_usd_02', 'costoUsd02',
  'precio_usd_detal', 'precioUsdDetal', 'precio_usd_detal_01', 'precioUsdDetal01', 'precio_usd_detal_02', 'precioUsdDetal02',
  'precio_usd_mayor', 'precioUsdMayor', 'precio_usd_mayor_01', 'precioUsdMayor01', 'precio_usd_mayor_02', 'precioUsdMayor02',
  'precio', 'precioUsd', 'precioVenta', 'aplica_iva', 'aplicaIva', 'color_etiqueta', 'colorEtiqueta',
  'especificaciones', 'linea', 'linea_descripcion', 'lineaDescripcion', 'co_lin', 'coLin',
  'familia', 'familia_descripcion', 'familiaDescripcion', 'co_sub', 'coSub', 'co_cat', 'coCat', 'co_subl', 'coSubl',
  'almacen', 'co_alm', 'coAlm', 'almacenes', 'ubicacion', 'anulado', 'inactivo', 'updated_at'
].join(',');

const REAL_PRODUCT_IMAGE_BY_KEY = (() => {
  const map = new Map();
  if (Array.isArray(REAL_PRODUCTS)) {
    for (const rp of REAL_PRODUCTS) {
      if (!rp || !rp.imagen) continue;
      if (rp.id) map.set(String(rp.id).trim().toUpperCase(), rp.imagen);
      if (rp.codigo) map.set(String(rp.codigo).trim().toUpperCase(), rp.imagen);
    }
  }
  return map;
})();

const resolveFallbackProductImage = (p) => {
  if (p?.imagen) return p.imagen;
  const kId = String(p?.id || '').trim().toUpperCase();
  const kCode = String(p?.codigo || p?.co_art || '').trim().toUpperCase();
  if (kCode && REAL_PRODUCT_IMAGE_BY_KEY.has(kCode)) return REAL_PRODUCT_IMAGE_BY_KEY.get(kCode);
  if (kId && REAL_PRODUCT_IMAGE_BY_KEY.has(kId)) return REAL_PRODUCT_IMAGE_BY_KEY.get(kId);
  return '';
};

const mapProductFromDb = (p) => {
  if (!p) return null;
  const precioUsdDetal = Number(p.precioUsdDetal ?? p.precio_usd_detal ?? p.precio ?? p.precioVenta ?? 0) || Number(p.precio_usd_detal ?? p.precioUsdDetal ?? 0) || 0;
  const precioUsdMayor = Number(p.precioUsdMayor ?? p.precio_usd_mayor ?? (precioUsdDetal > 0 ? precioUsdDetal : 0)) || Number(p.precio_usd_mayor ?? p.precioUsdMayor ?? 0) || 0;
  const costoUsd = Number(p.costoUsd ?? p.costo_usd ?? p.costo ?? 0) || Number(p.costo_usd ?? p.costoUsd ?? 0) || 0;
  const costoUsd01 = Number(p.costoUsd01 ?? p.costo_usd_01 ?? costoUsd) || 0;
  const costoUsd02 = Number(p.costoUsd02 ?? p.costo_usd_02 ?? costoUsd) || 0;
  const precioUsdDetal01 = Number(p.precioUsdDetal01 ?? p.precio_usd_detal_01 ?? precioUsdDetal) || 0;
  const precioUsdDetal02 = Number(p.precioUsdDetal02 ?? p.precio_usd_detal_02 ?? precioUsdDetal) || 0;
  const precioUsdMayor01 = Number(p.precioUsdMayor01 ?? p.precio_usd_mayor_01 ?? (precioUsdMayor > 0 ? precioUsdMayor : precioUsdDetal01)) || 0;
  const precioUsdMayor02 = Number(p.precioUsdMayor02 ?? p.precio_usd_mayor_02 ?? (precioUsdMayor > 0 ? precioUsdMayor : precioUsdDetal02)) || 0;
  const litrosPorUnidad = resolveProductLitersPerUnit(p);
  const comprometido = Number(p.comprometido ?? 0) || 0;
  const stockMinimo = Number(p.stock_minimo ?? p.stockMinimo ?? 0) || 0;

  const hierarchy = inferProductLineAndFamily(p);
  const warehouseStocks = getProductWarehouseStocks(p);
  const stock = warehouseStocks.total;
  const stock01 = warehouseStocks.stock01;
  const stock02 = warehouseStocks.stock02;

  return {
    id: p.id,
    codigo: p.codigo || p.id,
    oem: p.oem || '',
    descripcion: p.descripcion || p.nombre || '',
    nombre: p.nombre || p.descripcion || '',
    marca: p.marca || 'OILSTONE',
    categoria: p.categoria || 'Lubricantes',
    viscosidad: p.viscosidad || '',
    normaApi: p.norma_api || p.normaApi || '',
    norma_api: p.norma_api || p.normaApi || '',
    presentacionesDisponibles: p.presentaciones_disponibles || p.presentacionesDisponibles || [],
    presentaciones_disponibles: p.presentaciones_disponibles || p.presentacionesDisponibles || [],
    unidad: resolveProductUnit(p, 'Caja'),
    litrosPorUnidad,
    litros_por_unidad: litrosPorUnidad,
    stock,
    stockAlmacen01: stock01,
    stock_almacen_01: stock01,
    stockAlmacen02: stock02,
    stock_almacen_02: stock02,
    comprometido,
    stockMinimo,
    stock_minimo: stockMinimo,
    costoUsd,
    costo_usd: costoUsd,
    costo: costoUsd,
    costoUsd01,
    costo_usd_01: costoUsd01,
    costoUsd02,
    costo_usd_02: costoUsd02,
    precioUsdDetal,
    precio_usd_detal: precioUsdDetal,
    precioUsdDetal01,
    precio_usd_detal_01: precioUsdDetal01,
    precioUsdDetal02,
    precio_usd_detal_02: precioUsdDetal02,
    precioUsdMayor,
    precio_usd_mayor: precioUsdMayor,
    precioUsdMayor01,
    precio_usd_mayor_01: precioUsdMayor01,
    precioUsdMayor02,
    precio_usd_mayor_02: precioUsdMayor02,
    precio: precioUsdDetal,
    precioUsd: precioUsdDetal,
    precioVenta: precioUsdDetal,
    precioMayor: precioUsdMayor,
    aplicaIva: p.aplica_iva !== undefined ? p.aplica_iva : (p.aplicaIva !== undefined ? p.aplicaIva : true),
    aplica_iva: p.aplica_iva !== undefined ? p.aplica_iva : (p.aplicaIva !== undefined ? p.aplicaIva : true),
    colorEtiqueta: p.color_etiqueta || p.colorEtiqueta || '#002b7a',
    color_etiqueta: p.color_etiqueta || p.colorEtiqueta || '#002b7a',
    imagen: resolveFallbackProductImage(p),
    especificaciones: p.especificaciones || {},
    linea: hierarchy.linea,
    linea_descripcion: hierarchy.linea_descripcion,
    lineaDescripcion: hierarchy.lineaDescripcion,
    co_lin: hierarchy.co_lin,
    coLin: hierarchy.coLin,
    familia: hierarchy.familia,
    familia_descripcion: hierarchy.familia_descripcion,
    familiaDescripcion: hierarchy.familiaDescripcion,
    co_sub: hierarchy.co_sub,
    coSub: hierarchy.coSub,
    co_cat: hierarchy.co_cat,
    coCat: hierarchy.coCat,
    almacen: p.almacen || '01: ALMACÉN PRINCIPAL / MOSTRADOR | 02: ALMACÉN CENTRAL / BÓVEDA',
    co_alm: p.co_alm || p.coAlm || '01,02',
    coAlm: p.coAlm || p.co_alm || '01,02',
    almacenes: Array.isArray(p.almacenes) ? p.almacenes : ['01', '02'],
    ubicacion: p.ubicacion || '01: Almacén Principal • 02: Almacén Central'
  };
};

const mapClientToDb = (c) => ({
  id: c.id,
  codigo: c.codigo || c.id,
  nombre: c.nombre,
  rif: c.rif,
  telefono: c.telefono || '',
  email: c.email || '',
  direccion: c.direccion || '',
  limite_credito_usd: Number(c.limiteCreditoUsd ?? c.limite_credito_usd ?? 0),
  saldo_deudor_usd: Number(c.saldoDeudorUsd ?? c.saldo_deudor_usd ?? 0),
  dias_credito: Number(c.diasCredito ?? c.dias_credito ?? 0),
  tipo_cliente: c.tipoCliente || c.tipo_cliente || 'Mayorista',
  tipo_persona: c.tipoPersona || c.tipo_persona || c.tipoContribuyente || '',
  nit: c.nit || '',
  direccion2: c.direccion2 || '',
  ciudad: c.ciudad || '',
  estado: c.estado || '',
  zip: c.zip || '',
  fax: c.fax || '',
  website: c.website || '',
  responsable: c.responsable || '',
  saldo_inicial: Number(c.saldoInicial ?? c.saldo_inicial ?? 0),
  descuento_pronto_pago: Number(c.descuentoProntoPago ?? c.descuento_pronto_pago ?? 0),
  descuento_global: Number(c.descuentoGlobal ?? c.descuento_global ?? 0),
  zona_venta: c.zonaVenta || c.zona_venta || '',
  segmento: c.segmento || '',
  vendedor_asignado: c.vendedorAsignado || c.vendedor_asignado || '',
  tipo_iva: c.tipoIva || c.tipo_iva || '1',
  es_contribuyente: Boolean(c.esContribuyente ?? c.es_contribuyente ?? true),
  es_contribuyente_especial: Boolean(c.esContribuyenteEspecial ?? c.es_contribuyente_especial ?? false),
  porcentaje_retencion_especial: Number(c.porcentajeRetencionEspecial ?? c.porcentaje_retencion_especial ?? 0),
  inactivo: Boolean(c.inactivo ?? false),
  sin_credito: Boolean(c.sinCredito ?? c.sin_credito ?? false),
  fecha_registro: c.fechaRegistro || c.fecha_registro || '',
  ultima_factura: c.ultimaFactura || c.ultima_factura || '',
  fecha_ultima_venta: c.fechaUltimaVenta || c.fecha_ultima_venta || '',
  monto_ultima_venta: Number(c.montoUltimaVenta ?? c.monto_ultima_venta ?? 0),
  comentarios: c.comentarios || '',
  estado_aprobacion: String(c.estadoAprobacion || c.estado_aprobacion || 'APROBADO').toUpperCase(),
  solicitado_por: c.solicitadoPor || c.solicitado_por || '',
  solicitado_por_username: c.solicitadoPorUsername || c.solicitado_por_username || '',
  fecha_solicitud: c.fechaSolicitud || c.fecha_solicitud || null,
  aprobado_por: c.aprobadoPor || c.aprobado_por || '',
  aprobado_por_username: c.aprobadoPorUsername || c.aprobado_por_username || '',
  fecha_aprobacion: c.fechaAprobacion || c.fecha_aprobacion || null,
  motivo_rechazo: c.motivoRechazo || c.motivo_rechazo || '',
  imagen_documento: c.imagenDocumento || c.imagen_documento || '',
  imagen_local: c.imagenLocal || c.imagen_local || ''
});

const mapClientFromDb = (c) => {
  if (!c) return null;
  const estadoAprobacion = String(c.estado_aprobacion || c.estadoAprobacion || 'APROBADO').toUpperCase();
  return {
    id: c.id,
    codigo: c.codigo || c.id,
    nombre: c.nombre || '',
    rif: c.rif || '',
    telefono: c.telefono || '',
    email: c.email || '',
    direccion: c.direccion || '',
    limiteCreditoUsd: Number(c.limite_credito_usd ?? c.limiteCreditoUsd ?? 0),
    saldoDeudorUsd: Number(c.saldo_deudor_usd ?? c.saldoDeudorUsd ?? 0),
    diasCredito: Number(c.dias_credito ?? c.diasCredito ?? 0),
    tipoCliente: c.tipo_cliente || c.tipoCliente || 'Mayorista',
    tipoPersona: String(c.tipo_persona || c.tipoPersona || c.tipoContribuyente || '').trim().toUpperCase(),
    nit: c.nit || '',
    direccion2: c.direccion2 || '',
    ciudad: c.ciudad || '',
    estado: c.estado || '',
    zip: c.zip || '',
    fax: c.fax || '',
    website: c.website || '',
    responsable: c.responsable || '',
    saldoInicial: Number(c.saldo_inicial ?? c.saldoInicial ?? 0),
    descuentoProntoPago: Number(c.descuento_pronto_pago ?? c.descuentoProntoPago ?? 0),
    descuentoGlobal: Number(c.descuento_global ?? c.descuentoGlobal ?? 0),
    zonaVenta: c.zona_venta || c.zonaVenta || '',
    segmento: c.segmento || '',
    vendedorAsignado: c.vendedor_asignado || c.vendedorAsignado || '',
    tipoIva: c.tipo_iva || c.tipoIva || '1',
    esContribuyente: Boolean(c.es_contribuyente ?? c.esContribuyente ?? true),
    esContribuyenteEspecial: Boolean(c.es_contribuyente_especial ?? c.esContribuyenteEspecial ?? false),
    porcentajeRetencionEspecial: Number(c.porcentaje_retencion_especial ?? c.porcentajeRetencionEspecial ?? 0),
    inactivo: Boolean(c.inactivo),
    sinCredito: Boolean(c.sin_credito ?? c.sinCredito),
    fechaRegistro: c.fecha_registro || c.fechaRegistro || '',
    ultimaFactura: c.ultima_factura || c.ultimaFactura || '',
    fechaUltimaVenta: c.fecha_ultima_venta || c.fechaUltimaVenta || '',
    montoUltimaVenta: Number(c.monto_ultima_venta ?? c.montoUltimaVenta ?? 0),
    comentarios: c.comentarios || '',
    estadoAprobacion,
    estado_aprobacion: estadoAprobacion,
    solicitadoPor: c.solicitado_por || c.solicitadoPor || '',
    solicitadoPorUsername: c.solicitado_por_username || c.solicitadoPorUsername || '',
    fechaSolicitud: c.fecha_solicitud || c.fechaSolicitud || '',
    aprobadoPor: c.aprobado_por || c.aprobadoPor || '',
    aprobadoPorUsername: c.aprobado_por_username || c.aprobadoPorUsername || '',
    fechaAprobacion: c.fecha_aprobacion || c.fechaAprobacion || '',
    motivoRechazo: c.motivo_rechazo || c.motivoRechazo || '',
    imagenDocumento: c.imagen_documento || c.imagenDocumento || '',
    imagenLocal: c.imagen_local || c.imagenLocal || ''
  };
};

const mapSupplierToDb = (s) => ({
  id: s.id,
  codigo: s.codigo || s.id,
  nombre: s.nombre,
  rif: s.rif,
  contacto: s.contacto || s.personaContacto || s.persona_contacto || '',
  persona_contacto: s.personaContacto || s.persona_contacto || s.contacto || '',
  telefono: s.telefono || '',
  email: s.email || '',
  direccion: s.direccion || '',
  tipo_proveedor: s.tipoProveedor || s.tipo_proveedor || 'Nacional',
  dias_credito: Number(s.diasCredito ?? s.dias_credito ?? 30),
  saldo_pendiente_usd: Number(s.saldoPendienteUsd ?? s.saldo_pendiente_usd ?? 0)
});

const mapSupplierFromDb = (s) => {
  if (!s) return null;
  const contacto = s.contacto || s.persona_contacto || s.personaContacto || '';
  const tipoProveedor = s.tipo_proveedor || s.tipoProveedor || 'Nacional';
  const saldoPendienteUsd = Number(s.saldo_pendiente_usd ?? s.saldoPendienteUsd ?? 0);
  const diasCredito = Number(s.dias_credito ?? s.diasCredito ?? 30);
  return {
    id: s.id,
    codigo: s.codigo || s.id,
    nombre: s.nombre || '',
    rif: s.rif || '',
    contacto,
    personaContacto: contacto,
    telefono: s.telefono || '',
    email: s.email || '',
    direccion: s.direccion || '',
    tipoProveedor,
    diasCredito,
    saldoPendienteUsd
  };
};

const mapSaleToDb = (s) => ({
  id: s.id,
  numero_doc: s.numeroDoc || s.numero_doc,
  numero_control: s.numeroControl || s.numero_control || formatDocumentControlNumber(s.numeroDoc || s.numero_doc || s.id, s.tipoDoc || s.tipo_doc),
  tipo_doc: s.tipoDoc || s.tipo_doc || 'FACTURA',
  ...(s.seriesEra || s.series_era ? { series_era: s.seriesEra || s.series_era } : {}),
  documento_afectado: s.documentoAfectado || s.documento_afectado || '',
  fecha: s.fecha,
  cliente_id: s.clienteId || s.cliente_id,
  cliente_nombre: s.clienteNombre || s.cliente_nombre,
  cliente_rif: s.clienteRif || s.cliente_rif,
  tasa_dolar: s.tasaDolar || s.tasa_dolar,
  condicion_pago: s.condicionPago || s.condicion_pago,
  items: s.items,
  subtotal_usd: s.subtotalUsd || s.subtotal_usd,
  base_exenta_usd: s.baseExentaUsd || s.base_exenta_usd || 0,
  base_general_usd: String(s.tipoDoc || s.tipo_doc || '').toUpperCase().trim() === 'NOTA_ENTREGA' ? 0 : (s.baseGeneralUsd || s.base_general_usd || 0),
  iva_general_usd: s.ivaGeneralUsd || s.iva_general_usd || 0,
  base_reducida_usd: s.baseReducidaUsd || s.base_reducida_usd || 0,
  iva_reducida_usd: s.ivaReducidaUsd || s.iva_reducida_usd || 0,
  base_adicional_usd: s.baseAdicionalUsd || s.base_adicional_usd || 0,
  iva_adicional_usd: s.ivaAdicionalUsd || s.iva_adicional_usd || 0,
  iva_usd: s.ivaUsd || s.iva_usd,
  igtf_usd: s.igtfUsd || s.igtf_usd || 0,
  total_usd: s.totalUsd || s.total_usd,
  subtotal_bs: s.subtotalBs || s.subtotal_bs,
  base_exenta_bs: s.baseExentaBs || s.base_exenta_bs || 0,
  base_general_bs: String(s.tipoDoc || s.tipo_doc || '').toUpperCase().trim() === 'NOTA_ENTREGA' ? 0 : (s.baseGeneralBs || s.base_general_bs || 0),
  iva_general_bs: s.ivaGeneralBs || s.iva_general_bs || 0,
  base_reducida_bs: s.baseReducidaBs || s.base_reducida_bs || 0,
  iva_reducida_bs: s.ivaReducidaBs || s.iva_reducida_bs || 0,
  base_adicional_bs: s.baseAdicionalBs || s.base_adicional_bs || 0,
  iva_adicional_bs: s.ivaAdicionalBs || s.iva_adicional_bs || 0,
  iva_bs: s.ivaBs || s.iva_bs,
  igtf_bs: s.igtfBs || s.igtf_bs || 0,
  total_bs: s.totalBs || s.total_bs,
  retencion_iva_bs: s.retencionIvaBs || s.retencion_iva_bs || 0,
  comprobante_retencion_iva: s.comprobanteRetencionIva || s.comprobante_retencion_iva || '',
  saldo_usd: Number(s.saldoUsd ?? s.saldo_usd ?? (s.estado === 'PENDIENTE' ? (s.totalUsd || s.total_usd || 0) : 0)),
  saldo_bs: Number(s.saldoBs ?? s.saldo_bs ?? (s.estado === 'PENDIENTE' ? (s.totalBs || s.total_bs || 0) : 0)),
  dias_credito: Number(s.diasCredito ?? s.dias_credito ?? 0),
  fecha_emision: s.fechaEmision || s.fecha_emision || s.fecha,
  fecha_vencimiento: s.fechaVencimiento || s.fecha_vencimiento || null,
  estado: s.estado,
  metodo_pago: s.metodoPago || s.metodo_pago,
  tipo_tasa: normalizeRateType(s.tipoTasa ?? s.tipo_tasa, {
    tipoDoc: s.tipoDoc || s.tipo_doc,
    monedaPago: s.monedaPago || s.moneda_pago,
    fallback: 'BCV'
  }),
  tasa_pago: Number(s.tasaPago ?? s.tasa_pago ?? s.tasaDolar ?? s.tasa_dolar ?? 0) || null,
  moneda_pago: s.monedaPago || s.moneda_pago || (String(s.tipoTasa ?? s.tipo_tasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
  vendedor: s.vendedor,
  cierre_z_id: s.cierreZId || s.cierre_z_id || null,
  cerrada: Boolean(s.cerrada),
  pedido_origen_id: s.pedidoOrigenId || s.pedido_origen_id || null,
  pedido_origen_doc: s.pedidoOrigenDoc || s.pedido_origen_doc || null
});

const mapSaleFromDb = (s) => {
  if (!s) return null;
  const rawNum = String(s.numero_doc ?? s.numeroDoc ?? s.id ?? '').trim();
  const isNe =
    String(s.tipo_doc || s.tipoDoc || '').toUpperCase() === 'NOTA_ENTREGA' ||
    rawNum.toUpperCase().startsWith('NE-') ||
    String(s.id || '').toUpperCase().startsWith('NE-');
  const resolvedTipoDoc = isNe ? 'NOTA_ENTREGA' : (s.tipo_doc || s.tipoDoc || 'FACTURA');
  const rawSubUsd = Number(s.subtotal_usd ?? s.subtotalUsd ?? s.base_imponible_usd ?? 0);
  const rawIvaUsd = Number(s.iva_usd ?? s.ivaUsd ?? s.monto_iva_usd ?? 0);
  const rawTotUsd = Number(s.total_usd ?? s.totalUsd ?? 0);
  const neBaseUsd = rawSubUsd > 0 && rawSubUsd < rawTotUsd
    ? rawSubUsd
    : (rawIvaUsd > 0 && rawTotUsd > rawIvaUsd ? Number((rawTotUsd - rawIvaUsd).toFixed(2)) : (rawSubUsd || rawTotUsd));
  const effectiveSubUsd = isNe ? neBaseUsd : rawSubUsd;
  const effectiveTotUsd = isNe ? neBaseUsd : rawTotUsd;
  const effectiveTasa = Number(s.tasa_dolar ?? s.tasaDolar ?? s.tasa_bcv ?? 0);
  const effectiveSubBs = isNe && effectiveTasa > 0 ? Number((effectiveSubUsd * effectiveTasa).toFixed(2)) : Number(s.subtotal_bs ?? s.subtotalBs ?? s.base_imponible_bs ?? 0);
  const effectiveTotBs = isNe ? effectiveSubBs : Number(s.total_bs ?? s.totalBs ?? 0);
  const rawCond = String(s.condicion_pago ?? s.condicionPago ?? '').toUpperCase().trim();
  const rawEst = String(s.estado ?? s.status ?? '').toUpperCase().trim();
  const isAnnulledSale = Boolean(
    s.anulada ||
    s.anulado ||
    ['ANULADA', 'ANULADO', 'VOID'].includes(String(s.status || '').toUpperCase().trim()) ||
    ['ANULADA', 'ANULADO', 'VOID'].includes(String(s.estado || '').toUpperCase().trim())
  );
  const isExplicitPaidContado =
    (rawCond === 'CONTADO' && s.metodo_pago !== 'CREDITO' && Number(s.dias_credito ?? s.diasCredito ?? 0) === 0 && rawEst !== 'PENDIENTE') ||
    rawEst === 'PAGADO' ||
    rawEst === 'COBRADA';
  const isPending = !isExplicitPaidContado && (
    rawEst === 'PENDIENTE' ||
    s.metodo_pago === 'CREDITO' ||
    (rawCond && rawCond !== 'CONTADO') ||
    isNe
  );

  return {
    id: s.id,
    numeroDoc: s.numero_doc ?? s.numeroDoc,
    numeroControl: s.numero_control || s.numeroControl || (isNe ? generateDeliveryNoteControlNumber(rawNum) : '00-000000'),
    tipoDoc: resolvedTipoDoc,
    seriesEra: s.series_era || s.seriesEra || '',
    documentoAfectado: s.documento_afectado || s.documentoAfectado || '',
    fecha: s.fecha,
    clienteId: s.cliente_id ?? s.clienteId,
    clienteNombre: s.cliente_nombre ?? s.clienteNombre,
    clienteRif: s.cliente_rif ?? s.clienteRif,
    tasaDolar: effectiveTasa,
    condicionPago: s.condicion_pago ?? s.condicionPago,
    items: typeof s.items === 'string' ? (() => { try { return JSON.parse(s.items); } catch { return []; } })() : (Array.isArray(s.items) ? s.items : []),
    subtotalUsd: effectiveSubUsd,
    baseExentaUsd: Number(s.base_exenta_usd ?? s.baseExentaUsd ?? 0),
    baseGeneralUsd: isNe ? 0 : Number(s.base_general_usd ?? s.subtotal_usd ?? s.subtotalUsd ?? 0),
    ivaGeneralUsd: isNe ? 0 : Number(s.iva_general_usd ?? s.iva_usd ?? s.ivaUsd ?? 0),
    baseReducidaUsd: Number(s.base_reducida_usd ?? s.baseReducidaUsd ?? 0),
    ivaReducidaUsd: isNe ? 0 : Number(s.iva_reducida_usd ?? s.ivaReducidaUsd ?? 0),
    baseAdicionalUsd: Number(s.base_adicional_usd ?? s.baseAdicionalUsd ?? 0),
    ivaAdicionalUsd: isNe ? 0 : Number(s.iva_adicional_usd ?? s.ivaAdicionalUsd ?? 0),
    ivaUsd: isNe ? 0 : rawIvaUsd,
    igtfUsd: isNe ? 0 : Number(s.igtf_usd ?? s.igtfUsd ?? s.monto_igtf_usd ?? 0),
    totalUsd: effectiveTotUsd,
    subtotalBs: effectiveSubBs,
    baseExentaBs: Number(s.base_exenta_bs ?? s.baseExentaBs ?? 0),
    baseGeneralBs: isNe ? 0 : Number(s.base_general_bs ?? s.subtotal_bs ?? s.subtotalBs ?? 0),
    ivaGeneralBs: isNe ? 0 : Number(s.iva_general_bs ?? s.iva_bs ?? s.ivaBs ?? 0),
    baseReducidaBs: Number(s.base_reducida_bs ?? s.baseReducidaBs ?? 0),
    ivaReducidaBs: isNe ? 0 : Number(s.iva_reducida_bs ?? s.ivaReducidaBs ?? 0),
    baseAdicionalBs: Number(s.base_adicional_bs ?? s.baseAdicionalBs ?? 0),
    ivaAdicionalBs: isNe ? 0 : Number(s.iva_adicional_bs ?? s.ivaAdicionalBs ?? 0),
    ivaBs: isNe ? 0 : Number(s.iva_bs ?? s.ivaBs ?? s.monto_iva_bs ?? 0),
    igtfBs: isNe ? 0 : Number(s.igtf_bs ?? s.igtfBs ?? s.monto_igtf_bs ?? 0),
    totalBs: effectiveTotBs,
    retencionIvaBs: isNe ? 0 : Number(s.retencion_iva_bs ?? s.retencionIvaBs ?? 0),
    comprobanteRetencionIva: s.comprobante_retencion_iva || s.comprobanteRetencionIva || '',
    saldoUsd: isAnnulledSale
      ? 0
      : (isNe
          ? (isExplicitPaidContado ? 0 : (s.saldo_usd !== undefined && s.saldo_usd !== null ? Math.min(effectiveTotUsd, Number(s.saldo_usd)) : (isPending ? effectiveTotUsd : 0)))
          : Number(s.saldo_usd ?? s.saldoUsd ?? (isPending ? effectiveTotUsd : 0))),
    saldoBs: isAnnulledSale
      ? 0
      : (isNe
          ? (isExplicitPaidContado ? 0 : (s.saldo_bs !== undefined && s.saldo_bs !== null ? Math.min(effectiveTotBs, Number(s.saldo_bs)) : (isPending ? effectiveTotBs : 0)))
          : Number(s.saldo_bs ?? s.saldoBs ?? (isPending ? effectiveTotBs : 0))),
    diasCredito: Number(s.dias_credito ?? s.diasCredito ?? 0),
    fechaEmision: s.fecha_emision || s.fechaEmision || s.fecha,
    fechaVencimiento: s.fecha_vencimiento || s.fechaVencimiento || null,
    estado: isAnnulledSale ? 'ANULADA' : (s.estado || s.status || 'Procesada'),
    status: isAnnulledSale ? 'ANULADA' : (s.status || s.estado || 'Procesada'),
    anulada: isAnnulledSale,
    anulado: isAnnulledSale,
    motivoAnulacion: s.motivo_anulacion ?? s.motivoAnulacion ?? '',
    anuladaPor: s.anulada_por ?? s.anuladaPor ?? '',
    fechaAnulacion: s.fecha_anulacion ?? s.fechaAnulacion ?? null,
    metodoPago: s.metodo_pago ?? s.metodoPago,
    tipoTasa: normalizeRateType(s.tipo_tasa ?? s.tipoTasa, {
      tipoDoc: resolvedTipoDoc,
      monedaPago: s.moneda_pago ?? s.monedaPago,
      fallback: 'BCV'
    }),
    tasaPago: Number(s.tasa_pago ?? s.tasaPago ?? effectiveTasa ?? 0),
    monedaPago: s.moneda_pago ?? s.monedaPago ?? (String(s.tipo_tasa ?? s.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    vendedor: s.vendedor,
    cierreZId: s.cierre_z_id || s.cierreZId || null,
    cerrada: Boolean(s.cerrada),
    pedidoOrigenId: s.pedido_origen_id || s.pedidoOrigenId || null,
    pedidoOrigenDoc: s.pedido_origen_doc || s.pedidoOrigenDoc || null
  };
};

export const mapPurchaseToDb = (p) => ({
  id: p.id,
  numero_factura_prov: p.numeroFacturaProv || p.numero_factura_prov || p.nroFactura || p.nro_factura || '',
  numero_control: p.numeroControl || p.numero_control || p.nroControl || p.nro_control || '00-000000',
  tipo_doc: p.tipoDoc || p.tipo_doc || 'FACTURA',
  documento_afectado: p.documentoAfectado || p.documento_afectado || '',
  fecha: p.fecha || p.fechaCompra || p.fecha_compra || p.fechaEmision || p.fecha_emision,
  proveedor_id: p.proveedorId || p.proveedor_id,
  proveedor_nombre: p.proveedorNombre || p.proveedor_nombre,
  proveedor_rif: p.proveedorRif || p.proveedor_rif,
  proveedor_direccion: p.proveedorDireccion || p.proveedor_direccion || '',
  tasa_dolar: Number(p.tasaDolar || p.tasa_dolar || p.tasaBcv || p.tasa_bcv || 0),
  almacen: String(p.almacen || '01').includes('02') ? '02' : '01',
  almacen_nombre: p.almacenNombre || p.almacen_nombre || '',
  condicion_pago: p.condicionPago || p.condicion_pago || 'CREDITO',
  dias_credito: Number(p.diasCredito ?? p.dias_credito ?? 15),
  producto: p.producto || '',
  cantidad: Number(p.cantidad || 0),
  costo_unitario_usd: Number(p.costoUnitarioUsd ?? p.costo_unitario_usd ?? 0),
  flete_usd: Number(p.fleteUsd ?? p.flete_usd ?? 0),
  flete_bs: Number(p.fleteBs ?? p.flete_bs ?? 0),
  subtotal_usd: Number(p.subtotalUsd ?? p.subtotal_usd ?? p.baseImponibleUsd ?? p.base_imponible_usd ?? 0),
  base_exenta_usd: Number(p.baseExentaUsd ?? p.base_exenta_usd ?? 0),
  base_general_usd: Number(p.baseGeneralUsd ?? p.base_general_usd ?? 0),
  iva_general_usd: Number(p.ivaGeneralUsd ?? p.iva_general_usd ?? p.ivaUsd ?? p.iva_usd ?? 0),
  base_reducida_usd: Number(p.baseReducidaUsd ?? p.base_reducida_usd ?? 0),
  iva_reducida_usd: Number(p.ivaReducidaUsd ?? p.iva_reducida_usd ?? 0),
  total_usd: Number(p.totalUsd ?? p.total_usd ?? 0),
  subtotal_bs: Number(p.subtotalBs ?? p.subtotal_bs ?? p.baseImponibleBs ?? p.base_imponible_bs ?? 0),
  base_exenta_bs: Number(p.baseExentaBs ?? p.base_exenta_bs ?? 0),
  base_general_bs: Number(p.baseGeneralBs ?? p.base_general_bs ?? 0),
  iva_general_bs: Number(p.ivaGeneralBs ?? p.iva_general_bs ?? p.montoIvaBs ?? p.monto_iva_bs ?? 0),
  base_reducida_bs: Number(p.baseReducidaBs ?? p.base_reducida_bs ?? 0),
  iva_reducida_bs: Number(p.ivaReducidaBs ?? p.iva_reducida_bs ?? 0),
  total_bs: Number(p.totalBs ?? p.total_bs ?? 0),
  retencion_iva_usd: Number(p.retencionIvaUsd ?? p.retencion_iva_usd ?? 0),
  retencion_iva_bs: Number(p.retencionIvaBs ?? p.retencion_iva_bs ?? 0),
  retencion_islr_usd: Number(p.retencionIslrUsd ?? p.retencion_islr_usd ?? 0),
  retencion_islr_bs: Number(p.retencionIslrBs ?? p.retencion_islr_bs ?? 0),
  monto_neto_pagar_usd: Number(p.montoNetoPagarUsd ?? p.monto_neto_pagar_usd ?? 0),
  numero_comprobante_retencion_iva: p.numeroComprobanteRetencionIva || p.numero_comprobante_retencion_iva || '',
  numero_comprobante_retencion_islr: p.numeroComprobanteRetencionIslr || p.numero_comprobante_retencion_islr || '',
  codigo_concepto_islr: p.codigoConceptoIslr || p.codigo_concepto_islr || '055',
  receptor: p.receptor || '',
  recepcion_id: p.recepcionId || p.recepcion_id || '',
  stock_aplicado: Boolean(p.stockAplicado ?? p.stock_aplicado),
  items: Array.isArray(p.items) ? p.items : []
});

export const mapPurchaseFromDb = (p) => {
  if (!p) return null;
  const subtotalUsd = Number(p.subtotal_usd ?? p.subtotalUsd ?? p.base_imponible_usd ?? p.baseImponibleUsd ?? 0);
  const totalUsd = Number(p.total_usd ?? p.totalUsd ?? 0);
  const subtotalBs = Number(p.subtotal_bs ?? p.subtotalBs ?? p.base_imponible_bs ?? p.baseImponibleBs ?? 0);
  const totalBs = Number(p.total_bs ?? p.totalBs ?? 0);
  const ivaUsd = Number(p.iva_general_usd ?? p.iva_usd ?? p.ivaUsd ?? p.monto_iva_usd ?? p.montoIvaUsd ?? 0);
  const ivaBs = Number(p.iva_general_bs ?? p.monto_iva_bs ?? p.montoIvaBs ?? 0);
  const nroFactura = p.numero_factura_prov || p.numeroFacturaProv || p.nro_factura || p.nroFactura || p.numero_factura_proveedor || p.numeroFacturaProveedor || '';
  const nroControl = p.numero_control || p.numeroControl || p.nro_control || p.nroControl || '00-000000';
  const fecha = p.fecha || p.fecha_compra || p.fechaCompra || p.fecha_emision || p.fechaEmision || '';
  const tasaDolar = Number(p.tasa_dolar ?? p.tasaDolar ?? p.tasa_bcv ?? p.tasaBcv ?? 0);
  const retIvaUsd = Number(p.retencion_iva_usd ?? p.retencionIvaUsd ?? 0);
  const retIslrUsd = Number(p.retencion_islr_usd ?? p.retencionIslrUsd ?? 0);
  const items = Array.isArray(p.items) ? p.items : [];
  const almacen = String(p.almacen || items[0]?.almacen || '01').includes('02') ? '02' : '01';
  return {
    id: p.id,
    numeroFacturaProv: nroFactura,
    nroFactura,
    numeroControl: nroControl,
    nroControl,
    tipoDoc: p.tipo_doc || p.tipoDoc || 'FACTURA',
    documentoAfectado: p.documento_afectado || p.documentoAfectado || '',
    fecha,
    fechaCompra: fecha,
    fechaEmision: fecha,
    proveedorId: p.proveedor_id || p.proveedorId || '',
    proveedorNombre: p.proveedor_nombre || p.proveedorNombre || '',
    proveedorRif: p.proveedor_rif || p.proveedorRif || '',
    proveedorDireccion: p.proveedor_direccion || p.proveedorDireccion || '',
    tasaDolar,
    tasaBcv: tasaDolar,
    almacen,
    almacenNombre: p.almacen_nombre || p.almacenNombre || (almacen === '02' ? 'Almacén 02 (N.E.)' : 'Almacén 01 (Fiscal)'),
    condicionPago: p.condicion_pago || p.condicionPago || 'CREDITO',
    diasCredito: Number(p.dias_credito ?? p.diasCredito ?? 15),
    producto: p.producto || '',
    cantidad: Number(p.cantidad || 0),
    costoUnitarioUsd: Number(p.costo_unitario_usd ?? p.costoUnitarioUsd ?? 0),
    fleteUsd: Number(p.flete_usd ?? p.fleteUsd ?? 0),
    fleteBs: Number(p.flete_bs ?? p.fleteBs ?? 0),
    subtotalUsd,
    baseImponibleUsd: subtotalUsd,
    baseExentaUsd: Number(p.base_exenta_usd ?? p.baseExentaUsd ?? 0),
    baseGeneralUsd: Number(p.base_general_usd ?? p.baseGeneralUsd ?? 0),
    ivaGeneralUsd: ivaUsd,
    baseReducidaUsd: Number(p.base_reducida_usd ?? p.baseReducidaUsd ?? 0),
    ivaReducidaUsd: Number(p.iva_reducida_usd ?? p.ivaReducidaUsd ?? 0),
    ivaUsd,
    totalUsd,
    subtotalBs,
    baseImponibleBs: subtotalBs,
    baseExentaBs: Number(p.base_exenta_bs ?? p.baseExentaBs ?? 0),
    baseGeneralBs: Number(p.base_general_bs ?? p.baseGeneralBs ?? 0),
    ivaGeneralBs: ivaBs,
    baseReducidaBs: Number(p.base_reducida_bs ?? p.baseReducidaBs ?? 0),
    ivaReducidaBs: Number(p.iva_reducida_bs ?? p.ivaReducidaBs ?? 0),
    totalBs,
    retencionIvaUsd: retIvaUsd,
    retencionIvaBs: Number(p.retencion_iva_bs ?? p.retencionIvaBs ?? 0),
    retencionIslrUsd: retIslrUsd,
    retencionIslrBs: Number(p.retencion_islr_bs ?? p.retencionIslrBs ?? 0),
    montoNetoPagarUsd: Number(p.monto_neto_pagar_usd ?? p.montoNetoPagarUsd ?? Math.max(0, totalUsd - retIvaUsd - retIslrUsd)),
    numeroComprobanteRetencionIva: p.numero_comprobante_retencion_iva || p.numeroComprobanteRetencionIva || '',
    numeroComprobanteRetencionIslr: p.numero_comprobante_retencion_islr || p.numeroComprobanteRetencionIslr || '',
    codigoConceptoIslr: p.codigo_concepto_islr || p.codigoConceptoIslr || '055',
    receptor: p.receptor || '',
    recepcionId: p.recepcion_id || p.recepcionId || '',
    stockAplicado: Boolean(p.stock_aplicado ?? p.stockAplicado),
    items
  };
};

const mapCashMovementToDb = (m) => {
  const concepto = String(m.concepto || m.descripcion || '').trim();
  const metodo = m.metodo || m.metodoPago || m.metodo_pago || 'Efectivo USD';
  const cuentaId = m.cuentaId || m.cuenta_id || m.cajaId || m.caja_id || null;
  const cuentaNombre = m.cuentaNombre || m.cuenta_nombre || m.cajaOBanco || m.caja_o_banco || metodo;
  const cajaId = m.cajaId || m.caja_id || (String(cuentaId || '').toUpperCase().startsWith('CAJ') ? cuentaId : null);
  const tasa = Number(m.tasaPago ?? m.tasa_pago ?? m.tasa ?? m.tasaBcv ?? m.tasa_bcv ?? 0);
  const moneda = m.moneda || 'USD';
  const monedaPago = m.monedaPago || m.moneda_pago || (String(moneda).toUpperCase().includes('USD') || String(moneda).toUpperCase() === 'US$' ? 'USD' : 'BS');
  const tipoTasa = normalizeRateType(m.tipoTasa ?? m.tipo_tasa, {
    monedaPago,
    fallback: monedaPago === 'USD' ? 'USD' : 'BCV'
  });
  const effectiveTasaPago = tasa > 0 ? tasa : (isDirectCurrencyRateType(tipoTasa) ? 1 : 0);
  return {
    id: m.id,
    fecha: m.fecha || new Date().toISOString(),
    tipo: m.tipo || 'INGRESO',
    categoria: m.categoria || 'VENTAS',
    concepto,
    descripcion: m.descripcion || concepto,
    monto_usd: round2(m.montoUsd ?? m.monto_usd ?? 0),
    montoUsd: round2(m.montoUsd ?? m.monto_usd ?? 0),
    monto_bs: round2(m.montoBs ?? m.monto_bs ?? 0),
    montoBs: round2(m.montoBs ?? m.monto_bs ?? 0),
    metodo,
    metodo_pago: m.metodoPago || m.metodo_pago || metodo,
    metodoPago: m.metodoPago || m.metodo_pago || metodo,
    caja_id: cajaId,
    cajaId,
    cuenta_id: cuentaId,
    cuentaId,
    cuenta_nombre: cuentaNombre,
    cuentaNombre,
    caja_o_banco: m.cajaOBanco || m.caja_o_banco || cuentaNombre,
    cajaOBanco: m.cajaOBanco || m.caja_o_banco || cuentaNombre,
    tasa: effectiveTasaPago > 0 ? effectiveTasaPago : undefined,
    tasa_bcv: effectiveTasaPago > 0 ? effectiveTasaPago : undefined,
    tipo_tasa: tipoTasa,
    tipoTasa,
    tasa_pago: effectiveTasaPago > 0 ? effectiveTasaPago : undefined,
    tasaPago: effectiveTasaPago > 0 ? effectiveTasaPago : undefined,
    moneda_pago: monedaPago,
    monedaPago,
    referencia: m.referencia || m.id,
    cuenta_gasto: m.cuentaGasto || m.cuenta_gasto || null,
    cuentaGasto: m.cuentaGasto || m.cuenta_gasto || null,
    cuenta_gasto_desc: m.cuentaGastoDesc || m.cuenta_gasto_desc || null,
    cuentaGastoDesc: m.cuentaGastoDesc || m.cuenta_gasto_desc || null,
    referencia_tipo: m.referenciaTipo || m.referencia_tipo || null,
    referenciaTipo: m.referenciaTipo || m.referencia_tipo || null,
    referencia_id: m.referenciaId || m.referencia_id || m.partnerAccountId || m.partner_account_id || null,
    referenciaId: m.referenciaId || m.referencia_id || m.partnerAccountId || m.partner_account_id || null,
    partner_account_id: m.partnerAccountId || m.partner_account_id || null,
    partnerAccountId: m.partnerAccountId || m.partner_account_id || null,
    account_kind: m.accountKind || m.account_kind || (cajaId ? 'CAJA' : (cuentaId ? 'BANCO' : null)),
    accountKind: m.accountKind || m.account_kind || (cajaId ? 'CAJA' : (cuentaId ? 'BANCO' : null)),
    moneda,
    usuario: m.usuario || m.usuarioId || m.usuario_id || 'Sistema'
  };
};

const mapCashMovementFromDb = (m) => {
  if (!m) return null;
  const concepto = String(m.concepto || m.descripcion || '').trim();
  const metodo = m.metodo || m.metodo_pago || m.metodoPago || m.caja_o_banco || m.cajaOBanco || 'Efectivo USD';
  const cuentaId = m.cuentaId || m.cuenta_id || m.cajaId || m.caja_id || '';
  const cajaId = m.cajaId || m.caja_id || (String(cuentaId || '').toUpperCase().startsWith('CAJ') ? cuentaId : '');
  const cuentaNombre = m.cuentaNombre || m.cuenta_nombre || m.cajaOBanco || m.caja_o_banco || metodo;
  const montoUsd = round2(m.monto_usd ?? m.montoUsd ?? 0);
  const montoBs = round2(m.monto_bs ?? m.montoBs ?? 0);
  const tasa = Number(m.tasa_pago ?? m.tasaPago ?? m.tasa ?? m.tasaBcv ?? m.tasa_bcv ?? 0);
  const moneda = m.moneda || 'USD';
  const monedaPago = m.moneda_pago ?? m.monedaPago ?? (montoBs <= 0 && (String(moneda).toUpperCase().includes('USD') || String(moneda).toUpperCase() === 'US$') ? 'USD' : 'BS');
  const tipoTasa = normalizeRateType(m.tipo_tasa ?? m.tipoTasa, {
    monedaPago,
    fallback: montoBs <= 0 && monedaPago === 'USD' ? 'USD' : 'BCV'
  });
  const rawTipoUpper = String(m.tipo || '').toUpperCase().trim();
  const normalizedTipo = rawTipoUpper === 'EGRESO' ? 'EGRESO' : 'INGRESO';
  const cuentaGasto = m.cuentaGasto ?? m.cuenta_gasto ?? '';
  const cuentaGastoDesc = m.cuentaGastoDesc ?? m.cuenta_gasto_desc ?? '';
  const referenciaTipo = m.referenciaTipo ?? m.referencia_tipo ?? '';
  const referenciaId = m.referenciaId ?? m.referencia_id ?? '';
  const partnerAccountId = m.partnerAccountId ?? m.partner_account_id ?? (String(referenciaTipo).toUpperCase() === 'PASIVO_SOCIO' ? referenciaId : '');
  const accountKind = m.accountKind ?? m.account_kind ?? (cajaId ? 'CAJA' : (cuentaId ? 'BANCO' : ''));
  return {
    id: m.id,
    fecha: m.fecha,
    tipo: normalizedTipo,
    categoria: m.categoria || (normalizedTipo === 'EGRESO' ? 'GASTO_OPERATIVO' : 'VENTAS'),
    concepto,
    descripcion: concepto,
    montoUsd,
    monto_usd: montoUsd,
    montoBs,
    monto_bs: montoBs,
    metodo,
    metodoPago: metodo,
    metodo_pago: metodo,
    cajaId,
    caja_id: cajaId,
    cuentaId,
    cuenta_id: cuentaId,
    cuentaNombre,
    cuenta_nombre: cuentaNombre,
    cajaOBanco: cuentaNombre,
    caja_o_banco: cuentaNombre,
    tasa: tasa > 0 ? tasa : 0,
    tasaPago: tasa > 0 ? tasa : 0,
    tasa_pago: tasa > 0 ? tasa : 0,
    tipoTasa,
    tipo_tasa: tipoTasa,
    monedaPago,
    moneda_pago: monedaPago,
    referencia: m.referencia || m.id,
    cuentaGasto,
    cuenta_gasto: cuentaGasto,
    cuentaGastoDesc,
    cuenta_gasto_desc: cuentaGastoDesc,
    referenciaTipo,
    referencia_tipo: referenciaTipo,
    referenciaId,
    referencia_id: referenciaId,
    partnerAccountId,
    partner_account_id: partnerAccountId,
    accountKind,
    account_kind: accountKind,
    moneda,
    usuario: m.usuario || m.usuario_id || m.usuarioId || 'Sistema'
  };
};

const mapFiscalClosureToDb = (c) => ({
  id: c.id,
  tipo: c.tipo || 'Z',
  numero_z: c.numeroZ || c.numero_z || null,
  numero_cierre: Number(c.numeroCierre ?? c.numero_cierre ?? 0),
  fecha: c.fecha || c.fechaCierre || c.fecha_cierre || new Date().toISOString(),
  fecha_apertura: c.fechaApertura || c.fecha_apertura || c.fecha,
  fecha_cierre: c.fechaCierre || c.fecha_cierre || c.fecha,
  primera_factura: c.primeraFactura || c.primera_factura || '',
  ultima_factura: c.ultimaFactura || c.ultima_factura || '',
  primera_nc: c.primeraNc || c.primera_nc || '',
  ultima_nc: c.ultimaNc || c.ultima_nc || '',
  primera_nd: c.primeraNd || c.primera_nd || '',
  ultima_nd: c.ultimaNd || c.ultima_nd || '',
  cantidad_facturas: Number(c.cantidadFacturas ?? c.cantidad_facturas ?? c.facturasEmitidas ?? c.facturas_emitidas ?? 0),
  cantidad_nc: Number(c.cantidadNc ?? c.cantidad_nc ?? 0),
  cantidad_nd: Number(c.cantidadNd ?? c.cantidad_nd ?? 0),
  total_documentos: Number(c.totalDocumentos ?? c.total_documentos ?? 0),
  ventas_exentas_bs: Number(c.ventasExentasBs ?? c.ventas_exentas_bs ?? 0),
  base_general_bs: Number(c.baseGeneralBs ?? c.base_general_bs ?? 0),
  debito_general_bs: Number(c.debitoGeneralBs ?? c.debito_general_bs ?? 0),
  base_reducida_bs: Number(c.baseReducidaBs ?? c.base_reducida_bs ?? 0),
  debito_reducido_bs: Number(c.debitoReducidoBs ?? c.debito_reducido_bs ?? 0),
  base_adicional_bs: Number(c.baseAdicionalBs ?? c.base_adicional_bs ?? 0),
  debito_adicional_bs: Number(c.debitoAdicionalBs ?? c.debito_adicional_bs ?? 0),
  total_debito_fiscal_bs: Number(c.totalDebitoFiscalBs ?? c.total_debito_fiscal_bs ?? c.totalIvaBs ?? c.total_iva_bs ?? 0),
  base_igtf_bs: Number(c.baseIgtfBs ?? c.base_igtf_bs ?? 0),
  total_igtf_bs: Number(c.totalIgtfBs ?? c.total_igtf_bs ?? 0),
  total_ventas_bs: Number(c.totalVentasBs ?? c.total_ventas_bs ?? c.totalBs ?? c.total_bs ?? 0),
  total_ventas_usd: Number(c.totalVentasUsd ?? c.total_ventas_usd ?? c.totalUsd ?? c.total_usd ?? 0),
  tasa_bcv: Number(c.tasaBcv ?? c.tasa_bcv ?? 886.22),
  gran_total_historico_bs: Number(c.granTotalHistoricoBs ?? c.gran_total_historico_bs ?? 0),
  desglose_pagos: c.desglosePagos || c.desglose_pagos || {},
  usuario_id: c.usuarioId || c.usuario_id || null,
  usuario_nombre: c.usuarioNombre || c.usuario_nombre || c.cajero || 'Administrador Master',
  firma_hash_sha256: c.firmaHashSha256 || c.firma_hash_sha256 || c.hashSeguridad || c.hash_seguridad || ''
});

const mapFiscalClosureFromDb = (c) => ({
  id: c.id,
  tipo: c.tipo || 'Z',
  numeroZ: c.numero_z ?? c.numeroZ ?? String(c.numero_cierre ?? c.numeroCierre ?? 1).padStart(4, '0'),
  numeroCierre: Number(c.numero_cierre ?? c.numeroCierre ?? 1),
  fecha: c.fecha || c.fecha_cierre || c.fechaCierre || '',
  fechaApertura: c.fecha_apertura || c.fechaApertura || c.fecha || '',
  fechaCierre: c.fecha_cierre || c.fechaCierre || c.fecha || '',
  primeraFactura: c.primera_factura || c.primeraFactura || '',
  ultimaFactura: c.ultima_factura || c.ultimaFactura || '',
  primeraNc: c.primera_nc || c.primeraNc || '',
  ultimaNc: c.ultima_nc || c.ultimaNc || '',
  primeraNd: c.primera_nd || c.primeraNd || '',
  ultimaNd: c.ultima_nd || c.ultimaNd || '',
  cantidadFacturas: Number(c.cantidad_facturas ?? c.cantidadFacturas ?? c.facturas_emitidas ?? c.facturasEmitidas ?? 0),
  cantidadNc: Number(c.cantidad_nc ?? c.cantidadNc ?? 0),
  cantidadNd: Number(c.cantidad_nd ?? c.cantidadNd ?? 0),
  totalDocumentos: Number(c.total_documentos ?? c.totalDocumentos ?? 0),
  ventasExentasBs: Number(c.ventas_exentas_bs ?? c.ventasExentasBs ?? 0),
  baseGeneralBs: Number(c.base_general_bs ?? c.baseGeneralBs ?? 0),
  debitoGeneralBs: Number(c.debito_general_bs ?? c.debitoGeneralBs ?? 0),
  baseReducidaBs: Number(c.base_reducida_bs ?? c.baseReducidaBs ?? 0),
  debitoReducidoBs: Number(c.debito_reducido_bs ?? c.debitoReducidoBs ?? 0),
  baseAdicionalBs: Number(c.base_adicional_bs ?? c.baseAdicionalBs ?? 0),
  debitoAdicionalBs: Number(c.debito_adicional_bs ?? c.debitoAdicionalBs ?? 0),
  totalDebitoFiscalBs: Number(c.total_debito_fiscal_bs ?? c.totalDebitoFiscalBs ?? c.total_iva_bs ?? c.totalIvaBs ?? 0),
  baseIgtfBs: Number(c.base_igtf_bs ?? c.baseIgtfBs ?? 0),
  totalIgtfBs: Number(c.total_igtf_bs ?? c.totalIgtfBs ?? 0),
  totalVentasBs: Number(c.total_ventas_bs ?? c.totalVentasBs ?? c.total_bs ?? c.totalBs ?? 0),
  totalVentasUsd: Number(c.total_ventas_usd ?? c.totalVentasUsd ?? c.total_usd ?? c.totalUsd ?? 0),
  tasaBcv: Number(c.tasa_bcv ?? c.tasaBcv ?? 886.22),
  granTotalHistoricoBs: Number(c.gran_total_historico_bs ?? c.granTotalHistoricoBs ?? 0),
  desglosePagos: c.desglose_pagos || c.desglosePagos || {},
  usuarioId: c.usuario_id || c.usuarioId || null,
  usuarioNombre: c.usuario_nombre || c.usuarioNombre || c.cajero || 'Administrador Master',
  firmaHashSha256: c.firma_hash_sha256 || c.firmaHashSha256 || c.hash_seguridad || c.hashSeguridad || ''
});

export const mapOrderToDb = (o) => {
  const numeroPedido = o.numeroPedido || o.numero_pedido || o.numeroOrden || o.numero_orden || o.numeroDoc || o.numero_doc || o.id;
  const fechaEmision = o.fechaEmision || o.fecha_emision || o.fechaCreacion || new Date().toISOString();
  const fechaEntrega = o.fechaEntrega || o.fecha_entrega || o.fechaVencimiento || o.fecha_vencimiento || fechaEmision;
  const subtotalUsd = Number(o.subtotalUsd ?? o.subtotal_usd ?? o.totalBrutoUsd ?? o.total_bruto_usd ?? o.totalUsd ?? o.total_usd ?? 0);
  const ivaUsd = Number(o.ivaUsd ?? o.iva_usd ?? 0);
  const totalUsd = Number(o.totalUsd ?? o.total_usd ?? o.totalNetoUsd ?? o.total_neto_usd ?? subtotalUsd);
  const tasaCambio = Number(o.tasaCambio ?? o.tasa_cambio ?? o.tasaBcv ?? o.tasa_bcv ?? 886.22);
  const totalBs = Number(o.totalBs ?? o.total_bs ?? (totalUsd * tasaCambio));
  const estado = o.status || o.estado || 'Aprobado';
  const condicionPago = o.condicionPago || o.condicion_pago || o.formaPago || o.forma_pago || 'Contado';
  return {
    id: o.id,
    numero_pedido: numeroPedido,
    numeroPedido,
    numero_doc: numeroPedido,
    tipo_doc: o.tipoDoc || o.tipo_doc || 'PEDIDO',
    fecha_emision: fechaEmision,
    fechaEmision,
    fecha_entrega: fechaEntrega,
    fechaEntrega,
    fecha_vencimiento: fechaEntrega,
    cliente_id: o.clienteId || o.cliente_id || '',
    clienteId: o.clienteId || o.cliente_id || '',
    cliente_nombre: o.clienteNombre || o.cliente_nombre || '',
    clienteNombre: o.clienteNombre || o.cliente_nombre || '',
    cliente_rif: o.clienteRif || o.cliente_rif || '',
    clienteRif: o.clienteRif || o.cliente_rif || '',
    vendedor_id: o.vendedorId || o.vendedor_id || '',
    vendedorId: o.vendedorId || o.vendedor_id || '',
    vendedor_co_ven: o.vendedorCoVen || o.vendedor_co_ven || '',
    vendedorCoVen: o.vendedorCoVen || o.vendedor_co_ven || '',
    vendedor_nombre: o.vendedorNombre || o.vendedor_nombre || '',
    vendedorNombre: o.vendedorNombre || o.vendedor_nombre || '',
    modalidad_venta: o.modalidadVenta || o.modalidad_venta || (String(o.tipoDoc || o.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' ? 'OFICINA' : 'PREVENTA'),
    modalidadVenta: o.modalidadVenta || o.modalidad_venta || (String(o.tipoDoc || o.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' ? 'OFICINA' : 'PREVENTA'),
    almacen: o.almacen || o.almacenId || o.almacen_id || o.co_alma || '01',
    almacen_id: o.almacenId || o.almacen_id || o.almacen || '01',
    almacenId: o.almacenId || o.almacen_id || o.almacen || '01',
    zona_venta: o.zonaVenta || o.zona_venta || '',
    segmento: o.segmento || '',
    condicion_pago: condicionPago,
    condicionPago,
    forma_pago: condicionPago,
    dias_credito: Number(o.diasCredito ?? o.dias_credito ?? 0),
    diasCredito: Number(o.diasCredito ?? o.dias_credito ?? 0),
    moneda: o.moneda || 'USD',
    tasa_cambio: tasaCambio,
    tasaCambio,
    subtotal_usd: subtotalUsd,
    subtotalUsd,
    total_bruto_usd: subtotalUsd,
    descuento_global_pct: Number(o.descuentoGlobalPct ?? o.descuento_global_pct ?? 0),
    descuento_usd: Number(o.descuentoUsd ?? o.descuento_usd ?? 0),
    base_imponible_usd: Number(o.baseImponibleUsd ?? o.base_imponible_usd ?? subtotalUsd),
    aplica_iva: Boolean(o.aplicaIva ?? o.aplica_iva ?? false),
    iva_porcentaje: Number(o.ivaPorcentaje ?? o.iva_porcentaje ?? 16),
    iva_usd: ivaUsd,
    ivaUsd,
    total_usd: totalUsd,
    totalUsd,
    total_neto_usd: totalUsd,
    total_bs: totalBs,
    totalBs,
    total_litros: Number(o.totalLitros ?? o.total_litros ?? 0),
    totalLitros: Number(o.totalLitros ?? o.total_litros ?? 0),
    total_unidades: Number(o.totalUnidades ?? o.total_unidades ?? o.totalCajas ?? o.total_cajas ?? 0),
    totalUnidades: Number(o.totalUnidades ?? o.total_unidades ?? o.totalCajas ?? o.total_cajas ?? 0),
    total_cajas: Number(o.totalCajas ?? o.total_cajas ?? o.totalUnidades ?? o.total_unidades ?? 0),
    total_items: Number(o.totalItems ?? o.total_items ?? (o.items?.length || 0)),
    estado,
    status: estado,
    direccion_entrega: o.direccionEntrega || o.direccion_entrega || '',
    observaciones: o.observaciones || o.comentarios || '',
    comentarios: o.comentarios || o.observaciones || '',
    creado_por: o.creadoPor || o.creado_por || o.vendedorNombre || o.vendedor_nombre || 'Sistema',
    creadoPor: o.creadoPor || o.creado_por || o.vendedorNombre || o.vendedor_nombre || 'Sistema',
    aprobado_por: o.aprobadoPor ?? o.aprobado_por ?? null,
    aprobadoPor: o.aprobadoPor ?? o.aprobado_por ?? null,
    fecha_aprobacion: o.fechaAprobacion ?? o.fecha_aprobacion ?? null,
    fechaAprobacion: o.fechaAprobacion ?? o.fecha_aprobacion ?? null,
    motivo_rechazo: o.motivoRechazo ?? o.motivo_rechazo ?? null,
    motivoRechazo: o.motivoRechazo ?? o.motivo_rechazo ?? null,
    credit_override_approved: Boolean(o.creditOverrideApproved ?? o.credit_override_approved ?? false),
    creditOverrideApproved: Boolean(o.creditOverrideApproved ?? o.credit_override_approved ?? false),
    credit_override_authorizer: o.creditOverrideAuthorizer ?? o.credit_override_authorizer ?? null,
    creditOverrideAuthorizer: o.creditOverrideAuthorizer ?? o.credit_override_authorizer ?? null,
    credit_override_justification: o.creditOverrideJustification ?? o.credit_override_justification ?? null,
    creditOverrideJustification: o.creditOverrideJustification ?? o.credit_override_justification ?? null,
    factura_id: o.facturaId ?? o.factura_id ?? null,
    facturaId: o.facturaId ?? o.factura_id ?? null,
    profit_origen: o.profitOrigen || o.profit_origen || 'GRUMOTOR'
  };
};

export const mapOrderFromDb = (o) => {
  if (!o) return null;
  const rawItems = Array.isArray(o.order_items) && o.order_items.length > 0
    ? o.order_items
    : (Array.isArray(o.items) ? o.items : []);
  const mappedItems = rawItems.map((it, idx) => {
    const artId = it.articulo_id || it.articuloId || it.producto_id || it.productoId || it.codigo || '';
    const artDesc = it.articulo_descripcion || it.articuloDescripcion || it.descripcion || '';
    const unidad = resolveProductUnit(it, 'Caja');
    const cantidad = Number(it.cantidad || 0);
    const litrosUnit = Number(it.litros_unitarios ?? it.litrosUnitarios ?? 12);
    const litrosTot = Number(it.litros_totales ?? it.litrosTotales ?? (cantidad * litrosUnit));
    const precioUnit = Number(it.precio_unitario_usd ?? it.precioUnitarioUsd ?? 0);
    const totalItemUsd = Number(it.total_usd ?? it.totalUsd ?? (cantidad * precioUnit));
    const rengNum = Number(it.reng_num ?? it.rengNum ?? (idx + 1));
    return {
      id: it.id || `${o.id}-R${rengNum}`,
      orderId: it.order_id || it.orderId || o.id,
      rengNum,
      articuloId: artId,
      productoId: artId,
      codigo: artId,
      articuloDescripcion: artDesc,
      descripcion: artDesc,
      unidadVenta: unidad,
      cantidad,
      litrosUnitarios: litrosUnit,
      litrosTotales: litrosTot,
      precioUnitarioUsd: precioUnit,
      totalUsd: totalItemUsd,
      tipoAlicuota: it.tipo_alicuota || it.tipoAlicuota || 'GENERAL_16',
      aplicaIva: (it.aplica_iva ?? it.aplicaIva) !== false
    };
  });

  const numeroPedido = o.numero_pedido || o.numeroPedido || o.numeroOrden || o.numero_orden || o.numero_doc || o.numeroDoc || o.id;
  const fechaEmision = o.fecha_emision || o.fechaEmision || o.fechaCreacion || o.created_at || '';
  const fechaEntrega = o.fecha_entrega || o.fechaEntrega || o.fecha_vencimiento || o.fechaVencimiento || fechaEmision;
  const subtotalUsd = Number(o.subtotal_usd ?? o.subtotalUsd ?? o.total_bruto_usd ?? o.totalBrutoUsd ?? o.total_usd ?? o.totalUsd ?? 0);
  const ivaUsd = Number(o.iva_usd ?? o.ivaUsd ?? 0);
  const totalUsd = Number(o.total_usd ?? o.totalUsd ?? o.total_neto_usd ?? o.totalNetoUsd ?? subtotalUsd);
  const tasaCambio = Number(o.tasa_cambio ?? o.tasaCambio ?? o.tasaBcv ?? o.tasa_bcv ?? 886.22);
  const totalBs = Number(o.total_bs ?? o.totalBs ?? (totalUsd * tasaCambio));
  const totalLitros = Number(o.total_litros ?? o.totalLitros ?? mappedItems.reduce((s, i) => s + Number(i.litrosTotales || 0), 0));
  const totalUnidades = Number(o.total_unidades ?? o.totalUnidades ?? o.total_cajas ?? o.totalCajas ?? mappedItems.reduce((s, i) => s + Number(i.cantidad || 0), 0));
  const estado = o.status || o.estado || 'Aprobado';
  const condicionPago = o.condicion_pago || o.condicionPago || o.forma_pago || o.formaPago || 'Contado';
  const observaciones = o.observaciones || o.comentarios || '';

  return {
    id: o.id,
    numeroPedido,
    numeroOrden: numeroPedido,
    numeroDoc: numeroPedido,
    tipoDoc: o.tipo_doc || o.tipoDoc || 'PEDIDO',
    fechaEmision,
    fechaCreacion: fechaEmision,
    fechaEntrega,
    fechaVencimiento: fechaEntrega,
    clienteId: o.cliente_id || o.clienteId || '',
    clienteNombre: o.cliente_nombre || o.clienteNombre || '',
    clienteRif: o.cliente_rif || o.clienteRif || '',
    vendedorId: o.vendedor_id || o.vendedorId || '',
    vendedorCoVen: o.vendedor_co_ven || o.vendedorCoVen || o.co_ven || o.coVen || '',
    vendedorNombre: o.vendedor_nombre || o.vendedorNombre || '',
    modalidadVenta:
      o.modalidad_venta ||
      o.modalidadVenta ||
      ((o.tipo_doc || o.tipoDoc) === 'NOTA_ENTREGA' || (o.almacen || o.almacen_id || o.almacenId) === '02'
        ? 'OFICINA'
        : 'PREVENTA'),
    almacen: o.almacen || o.almacen_id || o.almacenId || o.co_alma || '01',
    almacenId: o.almacen_id || o.almacenId || o.almacen || '01',
    zonaVenta: o.zona_venta || o.zonaVenta || '',
    segmento: o.segmento || '',
    condicionPago,
    formaPago: condicionPago,
    diasCredito: Number(o.dias_credito ?? o.diasCredito ?? 0),
    moneda: o.moneda || 'USD',
    tasaCambio,
    tasaBcv: tasaCambio,
    subtotalUsd,
    totalBrutoUsd: subtotalUsd,
    descuentoGlobalPct: Number(o.descuento_global_pct ?? o.descuentoGlobalPct ?? 0),
    descuentoUsd: Number(o.descuento_usd ?? o.descuentoUsd ?? 0),
    baseImponibleUsd: Number(o.base_imponible_usd ?? o.baseImponibleUsd ?? subtotalUsd),
    aplicaIva: Boolean(o.aplica_iva ?? o.aplicaIva ?? false),
    ivaPorcentaje: Number(o.iva_porcentaje ?? o.ivaPorcentaje ?? 16),
    ivaUsd,
    totalUsd,
    totalNetoUsd: totalUsd,
    totalBs,
    totalLitros,
    totalUnidades,
    totalCajas: totalUnidades,
    totalItems: mappedItems.length,
    estado,
    status: estado,
    direccionEntrega: o.direccion_entrega || o.direccionEntrega || '',
    observaciones,
    comentarios: observaciones,
    creadoPor: o.creado_por || o.creadoPor || o.vendedor_nombre || o.vendedorNombre || 'Sistema',
    aprobadoPor: o.aprobado_por ?? o.aprobadoPor ?? null,
    fechaAprobacion: o.fecha_aprobacion ?? o.fechaAprobacion ?? null,
    motivoRechazo: o.motivo_rechazo ?? o.motivoRechazo ?? null,
    creditOverrideApproved: Boolean(o.credit_override_approved ?? o.creditOverrideApproved ?? false),
    creditOverrideAuthorizer: o.credit_override_authorizer ?? o.creditOverrideAuthorizer ?? null,
    creditOverrideJustification: o.credit_override_justification ?? o.creditOverrideJustification ?? null,
    facturaId: o.factura_id ?? o.facturaId ?? null,
    profitOrigen: o.profit_origen || o.profitOrigen || 'GRUMOTOR',
    createdAt: o.created_at || o.createdAt || fechaEmision,
    updatedAt: o.updated_at || o.updatedAt || fechaEmision,
    items: mappedItems
  };
};

// --- Mappings de Usuarios y Auditoría ---

export const mapUserToDb = (u) => {
  const normRol = normalizeRole(u.rol || u.role || 'VENTAS');
  const roleMeta = getRoleMeta(normRol);
  const nowIso = new Date().toISOString();
  const base = {
    id: u.id || `usr-${Date.now().toString(36)}`,
    username: (u.username || '').trim().toLowerCase(),
    password: u.password || '123456',
    nombre: (u.nombre || u.name || '').trim(),
    cargo: (u.cargo || roleMeta.defaultCargo || 'Operador').trim(),
    rol: normRol,
    departamento: u.departamento || getUserDepartment({ ...u, rol: normRol }) || null,
    cedula: u.cedula || '',
    email: u.email || '',
    phone: u.phone || u.telefono || '',
    telefono: u.telefono || u.phone || '',
    seller_id: u.seller_id || u.co_ven || u.coVen || null,
    co_ven: u.coVen || u.co_ven || u.seller_id || null,
    coVen: u.coVen || u.co_ven || u.seller_id || null,
    modulos: Array.isArray(u.modulos) && u.modulos.length > 0 ? u.modulos : (ROLE_PERMISSIONS[normRol] || []),
    avatar: u.avatar || roleMeta.avatar || '👤',
    foto: normalizeStorageUrl(u.foto) || null,
    color: u.color || roleMeta.color || '#0ea5e9',
    descripcion: u.descripcion || '',
    activo: u.activo !== undefined ? Boolean(u.activo) : (u.active !== undefined ? Boolean(u.active) : true),
    active: u.activo !== undefined ? Boolean(u.activo) : (u.active !== undefined ? Boolean(u.active) : true),
    ultimo_acceso: u.ultimoAcceso || u.ultimo_acceso || null,
    created_at: u.createdAt || u.created_at || nowIso,
    updated_at: u.updatedAt || u.updated_at || nowIso
  };
  return base;
};

export const mapUserFromDb = (u) => {
  if (!u) return null;
  const normRol = normalizeRole(u.rol || u.role || 'VENTAS');
  const roleMeta = getRoleMeta(normRol);
  const updatedIso = u.updated_at || u.updatedAt || null;
  const createdIso = u.created_at || u.createdAt || null;
  return {
    id: u.id,
    username: (u.username || '').trim().toLowerCase(),
    password: u.password || '123456',
    nombre: u.nombre || u.name || '',
    cargo: u.cargo || roleMeta.defaultCargo || '',
    rol: normRol,
    coVen: u.co_ven || u.coVen || u.seller_id || null,
    co_ven: u.co_ven || u.coVen || u.seller_id || null,
    seller_id: u.seller_id || u.co_ven || u.coVen || null,
    cedula: u.cedula || '',
    email: u.email || '',
    phone: u.phone || u.telefono || '',
    telefono: u.telefono || u.phone || '',
    departamento: u.departamento || getUserDepartment({ ...u, rol: normRol }) || null,
    modulos: Array.isArray(u.modulos) && u.modulos.length > 0 ? u.modulos : (ROLE_PERMISSIONS[normRol] || []),
    avatar: u.avatar || roleMeta.avatar || '👤',
    foto: normalizeStorageUrl(u.foto) || null,
    color: u.color || roleMeta.color || '#0ea5e9',
    descripcion: u.descripcion || '',
    activo: u.activo !== false && u.active !== false,
    active: u.activo !== false && u.active !== false,
    ultimoAcceso: u.ultimo_acceso || u.ultimoAcceso || null,
    ultimo_acceso: u.ultimo_acceso || u.ultimoAcceso || null,
    createdAt: createdIso,
    created_at: createdIso,
    updatedAt: updatedIso,
    updated_at: updatedIso
  };
};

export const mapUserLogToDb = (l) => ({
  id: l.id || `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
  usuario_id: l.usuarioId || l.usuario_id || null,
  usuario_nombre: l.usuarioNombre || l.usuario_nombre || 'Sistema',
  usuario_rol: l.usuarioRol || l.usuario_rol || 'ADMIN',
  accion: l.accion,
  modulo: l.modulo || 'USUARIOS',
  detalles: l.detalles || '',
  created_at: l.createdAt || l.created_at || new Date().toISOString()
});

export const mapUserLogFromDb = (l) => {
  if (!l) return null;
  return {
    id: l.id,
    usuarioId: l.usuario_id,
    usuarioNombre: l.usuario_nombre,
    usuarioRol: l.usuario_rol,
    accion: l.accion,
    modulo: l.modulo,
    detalles: l.detalles,
    createdAt: l.created_at
  };
};

// --- DB Seeding ---

export const seedDatabaseIfEmpty = async () => {
  if (!isSupabaseAvailable) return;

  console.log("[Supabase Sync] Iniciando verificación y sincronización de tablas iniciales...");

  // 1. Config
  try {
    const { data: configRows, error: configError } = await supabase.from('config').select('id').limit(1);
    if (!configError && (!configRows || configRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla config...");
      await supabase.from('config').insert(mapConfigToDb(REAL_CONFIG));
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando config:", err);
  }

  // 2. Clients
  try {
    const { data: clientRows, error: clientErr } = await supabase.from('clients').select('id').limit(1);
    if (!clientErr && (!clientRows || clientRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla clients...");
      const dbClients = REAL_CLIENTS.map(mapClientToDb);
      await supabase.from('clients').insert(dbClients);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando clients:", err);
  }

  // 3. Products
  try {
    const { data: prodRows, error: prodErr } = await supabase.from('products').select('id').limit(1);
    if (!prodErr && (!prodRows || prodRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla products...");
      const dbProducts = REAL_PRODUCTS.map(mapProductToDb);
      await supabase.from('products').insert(dbProducts);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando products:", err);
  }

  // 4. Suppliers
  try {
    const { data: supRows, error: supErr } = await supabase.from('suppliers').select('id').limit(1);
    if (!supErr && (!supRows || supRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla suppliers...");
      const dbSuppliers = INITIAL_SUPPLIERS.map(mapSupplierToDb);
      await supabase.from('suppliers').insert(dbSuppliers);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando suppliers:", err);
  }

  // 5. Sales
  try {
    const { data: saleRows, error: saleErr } = await supabase.from('sales').select('id').limit(1);
    if (!saleErr && (!saleRows || saleRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla sales...");
      const dbSales = INITIAL_SALES.map(mapSaleToDb);
      await supabase.from('sales').insert(dbSales);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando sales:", err);
  }

  // 6. Purchases
  try {
    const { data: purRows, error: purErr } = await supabase.from('purchases').select('id').limit(1);
    if (!purErr && (!purRows || purRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla purchases...");
      const dbPurchases = INITIAL_PURCHASES.map(mapPurchaseToDb);
      await supabase.from('purchases').insert(dbPurchases);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando purchases:", err);
  }

  // 7. Cash Movements
  try {
    const { data: cashRows, error: cashErr } = await supabase.from('cash_movements').select('id').limit(1);
    if (!cashErr && (!cashRows || cashRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla cash_movements...");
      const dbCashMovements = INITIAL_CASH_MOVEMENTS.map(mapCashMovementToDb);
      await supabase.from('cash_movements').insert(dbCashMovements);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando cash_movements:", err);
  }

  // 8. Fiscal Closures
  try {
    const { data: closureRows, error: closureErr } = await supabase.from('fiscal_closures').select('id').limit(1);
    if (!closureErr && (!closureRows || closureRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla fiscal_closures...");
      const dbClosures = INITIAL_FISCAL_CLOSURES.map(mapFiscalClosureToDb);
      await supabase.from('fiscal_closures').insert(dbClosures);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando fiscal_closures:", err);
  }

  // 9. Users
  try {
    const { data: userRows, error: userErr } = await supabase.from('users').select('id').limit(1);
    if (!userErr && (!userRows || userRows.length === 0)) {
      console.log("[Supabase Sync] Sembrando tabla users...");
      const dbUsers = DEFAULT_USERS.map(mapUserToDb);
      await supabase.from('users').insert(dbUsers);
    }
  } catch (err) {
    console.warn("[Supabase Sync] Error sembrando users:", err);
  }

  console.log("[Supabase Sync] Verificación de sembrado completada.");
};

// --- Core API Methods ---

function applyPendingQueueToEntities(entityName, list, { isLocalFallback = false } = {}) {
  if (!Array.isArray(list)) return list;
  try {
    const queue = getSyncQueue().filter(q => {
      if (!q) return false;
      if (q.entity === entityName) return true;
      if (entityName === 'product' && q.entity === 'stock_delta') return true;
      if (entityName === 'sale' && q.entity === 'sales') return true;
      if (entityName === 'order' && (q.entity === 'orders' || q.entity === 'order_status')) return true;
      return false;
    });
    if (queue.length === 0) return list;
    let result = [...list];
    for (const item of queue) {
      const data = item.data;
      if (!data) continue;
      if (item.entity === 'stock_delta' && entityName === 'product' && Array.isArray(data.lines)) {
        if (isLocalFallback && data.alreadyAppliedLocally) continue;
        for (const line of data.lines) {
          const code = String(line?.codigo || line?.co_art || line?.articuloId || '').trim();
          const d01 = Number(line?.delta01 || 0);
          const d02 = Number(line?.delta02 || 0);
          if (!code || (d01 === 0 && d02 === 0)) continue;
          const idx = result.findIndex(r => r && (String(r.codigo || '').trim() === code || String(r.id || '').trim() === code));
          if (idx >= 0) {
            const cur = getProductWarehouseStocks(result[idx]);
            const next01 = Math.max(0, Number((cur.stock01 + d01).toFixed(2)));
            const next02 = Math.max(0, Number((cur.stock02 + d02).toFixed(2)));
            result[idx] = {
              ...result[idx],
              stockAlmacen01: next01,
              stock_almacen_01: next01,
              stockAlmacen02: next02,
              stock_almacen_02: next02,
              stock: Number((next01 + next02).toFixed(2))
            };
          }
        }
        continue;
      }
      if (item.entity === 'order_status' && data.orderId && data.nuevoEstado) {
        const idx = result.findIndex(r => r && r.id === data.orderId);
        if (idx >= 0) {
          result[idx] = { ...result[idx], status: data.nuevoEstado };
        }
        continue;
      }
      const targetId = data.id || data.numeroDoc || data.codigo || data.rif;
      if (item.action === 'DELETE' && targetId) {
        result = result.filter(r =>
          r.id !== targetId &&
          r.numeroDoc !== targetId &&
          r.codigo !== targetId &&
          r.rif !== targetId
        );
      } else if (targetId) {
        const idx = result.findIndex(r =>
          (data.id && r.id === data.id) ||
          (data.numeroDoc && r.numeroDoc === data.numeroDoc) ||
          (data.codigo && r.codigo === data.codigo) ||
          (data.rif && r.rif === data.rif)
        );
        if (idx >= 0) {
          result[idx] = { ...result[idx], ...data };
        } else {
          result.unshift(data);
        }
      }
    }
    return result;
  } catch (_) {
    return list;
  }
}

// Config
let cachedConfigData = null;
let cachedConfigAt = 0;
const CONFIG_CACHE_TTL_MS = 10000;

export const getSupabaseConfig = async ({ force = false } = {}) => {
  if (!force && cachedConfigData && (Date.now() - cachedConfigAt) < CONFIG_CACHE_TTL_MS) {
    return cachedConfigData;
  }
  if (!isSupabaseAvailable) return getStorageConfig();
  try {
    const { data, error } = await withTimeout(
      supabase.from('config').select('*').eq('id', 1).single()
    );

    if (error) throw error;
    let mapped = mapConfigFromDb(data);
    try {
      const pendingConfig = getSyncQueue().filter(q => q && q.entity === 'config');
      if (pendingConfig.length > 0) {
        const lastCfg = pendingConfig[pendingConfig.length - 1]?.data;
        if (lastCfg) mapped = { ...mapped, ...lastCfg };
      }
      localStorage.setItem('signum_app_config', JSON.stringify(mapped));
      updateStorageConfig(mapped);
    } catch (_) {}
    cachedConfigData = mapped;
    cachedConfigAt = Date.now();
    return mapped;
  } catch (error) {
    markSupabaseOffline(error, 'getSupabaseConfig');
    return getStorageConfig();
  }
};

export const updateSupabaseConfig = async (newConfig) => {
  const current = getStorageConfig() || {};
  const merged = { ...current, ...newConfig };
  cachedConfigData = merged;
  cachedConfigAt = Date.now();
  
  try {
    localStorage.setItem('signum_app_config', JSON.stringify(merged));
    updateStorageConfig(merged);
  } catch (_) {}

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('config', 'UPDATE', merged);
    broadcastReconcileChange({ tableId: 'config', action: 'UPDATE', key: 1, item: merged });
    return merged;
  }

  try {
    let { data, error } = await withTimeout(
      supabase.from('config').update(mapConfigToDb(merged)).eq('id', 1).select().single()
    );

    if (error && (error.code === 'PGRST204' || error.code === '42703' || /column .* does not exist|schema cache/i.test(error.message || ''))) {
      const retryRes = await withTimeout(
        supabase.from('config').update(mapConfigToDb(merged, { coreOnly: true })).eq('id', 1).select().single()
      );
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) throw error;
    isSupabaseAvailable = true;
    const finalConfig = { ...merged, ...(mapConfigFromDb(data) || {}) };
    cachedConfigData = finalConfig;
    cachedConfigAt = Date.now();
    try {
      localStorage.setItem('signum_app_config', JSON.stringify(finalConfig));
      updateStorageConfig(finalConfig);
    } catch (_) {}
    broadcastReconcileChange({ tableId: 'config', action: 'UPDATE', key: 1, item: finalConfig });
    return finalConfig;
  } catch (err) {
    markSupabaseOffline(err, 'updateSupabaseConfig');
    enqueueSyncAction('config', 'UPDATE', merged);
    broadcastReconcileChange({ tableId: 'config', action: 'UPDATE', key: 1, item: merged });
    return merged;
  }
};

// Products
export const getSupabaseProducts = async () => {
  const sortByCodeAsc = (list) =>
    Array.isArray(list)
      ? [...list].sort((a, b) =>
          String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
        )
      : [];

  // 1. FUENTE MAESTRA DE DATOS: Supabase Cloud (DB_SIGNUM_MOTORVEN)
  // Solicita columnas livianas (sin imagen Base64) y reconstituye imagen local para evitar timeouts en túnel HTTPS
  if (isNetworkOnline()) {
    try {
      const { data, error } = await withTimeout(
        supabase.from('products').select(PRODUCT_LIGHT_COLUMNS).order('codigo', { ascending: true }),
        45000
      );

      if (!error && Array.isArray(data) && data.length > 0) {
        isSupabaseAvailable = true;
        const mapped = sortByCodeAsc(applyPendingQueueToEntities('product', data.map(mapProductFromDb)));
        try {
          localStorage.setItem('sm_products_v4_fiscal', JSON.stringify(mapped));
        } catch (_) {}
        return mapped;
      }
      if (error) markSupabaseOffline(error, 'getSupabaseProducts');
    } catch (err) {
      markSupabaseOffline(err, 'getSupabaseProducts');
    }
  }

  // 2. Caché local en caso de estar offline
  return sortByCodeAsc(applyPendingQueueToEntities('product', getStorageProducts(), { isLocalFallback: true }));
};

export const saveSupabaseProduct = async (product) => {
  // 1. Normalizar presentación, almacenes, precios y factor de litros antes de guardar
  const stocks = getProductWarehouseStocks(product);
  const existingLocal = getStorageProducts().find(
    (p) => p && (
      (product.id && String(p.id) === String(product.id)) ||
      (product.codigo && String(p.codigo) === String(product.codigo))
    )
  );
  const prevStocks = existingLocal ? getProductWarehouseStocks(existingLocal) : null;
  const stockUnchangedOnExisting = Boolean(
    existingLocal &&
    !product._explicitStockEdit &&
    prevStocks &&
    Number(stocks.stock01) === Number(prevStocks.stock01) &&
    Number(stocks.stock02) === Number(prevStocks.stock02)
  );
  const cleanUbicacion = typeof product.ubicacion === 'string'
    ? product.ubicacion.replace(/Almac\uFFFD+n/gi, 'Almacén').replace(/\uFFFD+/g, '')
    : product.ubicacion;

  const detal = Number(product.precioUsdDetal ?? product.precio_usd_detal ?? product.precio ?? product.precioUsd ?? product.precioVenta ?? 0) || 0;
  const mayorRaw = Number(product.precioUsdMayor ?? product.precio_usd_mayor ?? product.precioMayor ?? 0) || 0;
  const mayor = mayorRaw > 0 ? mayorRaw : detal;
  const costo = Number(product.costoUsd ?? product.costo_usd ?? product.costo ?? 0) || 0;
  const costo01 = Number(product.costoUsd01 ?? product.costo_usd_01 ?? costo) || 0;
  const costo02 = Number(product.costoUsd02 ?? product.costo_usd_02 ?? costo) || 0;
  const detal01 = Number(product.precioUsdDetal01 ?? product.precio_usd_detal_01 ?? detal) || 0;
  const detal02 = Number(product.precioUsdDetal02 ?? product.precio_usd_detal_02 ?? detal) || 0;
  const mayor01 = Number(product.precioUsdMayor01 ?? product.precio_usd_mayor_01 ?? (mayor > 0 ? mayor : detal01)) || 0;
  const mayor02 = Number(product.precioUsdMayor02 ?? product.precio_usd_mayor_02 ?? (mayor > 0 ? mayor : detal02)) || 0;
  const lpu = resolveProductLitersPerUnit(product);

  const normalized = {
    ...product,
    id: product.id || product.codigo || `OIL_${Date.now()}`,
    codigo: product.codigo || product.id || `OIL_${Date.now()}`,
    ubicacion: cleanUbicacion,
    costoUsd: costo,
    costo_usd: costo,
    costo: costo,
    costoUsd01: costo01,
    costo_usd_01: costo01,
    costoUsd02: costo02,
    costo_usd_02: costo02,
    precioUsdDetal: detal,
    precio_usd_detal: detal,
    precio: detal,
    precioUsd: detal,
    precioVenta: detal,
    precioUsdDetal01: detal01,
    precio_usd_detal_01: detal01,
    precioUsdDetal02: detal02,
    precio_usd_detal_02: detal02,
    precioUsdMayor: mayor,
    precio_usd_mayor: mayor,
    precioMayor: mayor,
    precioUsdMayor01: mayor01,
    precio_usd_mayor_01: mayor01,
    precioUsdMayor02: mayor02,
    precio_usd_mayor_02: mayor02,
    stockAlmacen01: stocks.stock01,
    stock_almacen_01: stocks.stock01,
    stockAlmacen02: stocks.stock02,
    stock_almacen_02: stocks.stock02,
    stock: stocks.total,
    unidad: resolveProductUnit(product, 'Caja'),
    litrosPorUnidad: lpu,
    litros_por_unidad: lpu,
    updated_at: new Date().toISOString()
  };
  const queuePayload = stockUnchangedOnExisting
    ? { ...normalized, _preserveServerStock: true }
    : normalized;

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    try { saveStorageProduct(normalized); } catch (_) {}
    enqueueSyncAction('product', 'UPDATE', queuePayload);
    broadcastReconcileChange({
      tableId: 'products',
      action: 'RECONCILE',
      key: normalized.codigo || normalized.id,
      item: normalized
    });
    return normalized;
  }

  try {
    const payload = mapProductToDb(normalized);
    let data = null;
    let error = null;
    if (stockUnchangedOnExisting) {
      // Editar precios/metadatos SIN sobrescribir stock del servidor para evitar pisar ventas concurrentes
      const metaPayload = { ...payload, _preserveServerStock: true };
      delete metaPayload.stock;
      delete metaPayload.stockAlmacen01;
      delete metaPayload.stock_almacen_01;
      delete metaPayload.stockAlmacen02;
      delete metaPayload.stock_almacen_02;
      const res = await withTimeout(
        supabase.from('products').update(metaPayload).eq('id', payload.id).select().single()
      );
      data = res.data;
      error = res.error;
    } else {
      const res = await withTimeout(
        supabase.from('products').upsert(payload).select().single()
      );
      data = res.data;
      error = res.error;
    }

    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = mapProductFromDb(data);
    try {
      saveStorageProduct(mapped);
    } catch (_) {}

    // Sincronizar stock independiente en profit_stock_by_warehouse en Supabase
    try {
      const pStocks = getProductWarehouseStocks(mapped);
      const stock01Payload = {
        id: `${mapped.id}_01`,
        co_art: mapped.id,
        codigo: mapped.codigo,
        oem: mapped.oem || '',
        descripcion: mapped.descripcion || mapped.nombre || '',
        marca: mapped.marca || 'OILSTONE',
        categoria: mapped.categoria || 'Lubricantes',
        viscosidad: mapped.viscosidad || '',
        unidad: mapped.unidad || 'Caja',
        litros_por_unidad: Number(mapped.litrosPorUnidad || mapped.litros_por_unidad || 0),
        costo_usd: Number(mapped.costoUsd01 ?? mapped.costo_usd_01 ?? mapped.costoUsd ?? mapped.costo_usd ?? 0),
        precio_usd_detal: Number(mapped.precioUsdDetal01 ?? mapped.precio_usd_detal_01 ?? mapped.precioUsdDetal ?? mapped.precio_usd_detal ?? 0),
        precio_usd_mayor: Number(mapped.precioUsdMayor01 ?? mapped.precio_usd_mayor_01 ?? mapped.precioUsdMayor ?? mapped.precio_usd_mayor ?? 0),
        co_alma: '01',
        des_alma: '01 Almacén Principal (Fiscal)',
        alma_des: 'ALMACÉN PRINCIPAL / MOSTRADOR',
        stock_act: Number(mapped.stockAlmacen01 ?? mapped.stock_almacen_01 ?? pStocks.stock01),
        stock_disp: Number(mapped.stockAlmacen01 ?? mapped.stock_almacen_01 ?? pStocks.stock01),
        stock_com: Number(mapped.comprometido ?? 0),
        stock_lle: 0,
        stock_des: 0,
        updated_at: new Date().toISOString()
      };
      const stock02Payload = {
        id: `${mapped.id}_02`,
        co_art: mapped.id,
        codigo: mapped.codigo,
        oem: mapped.oem || '',
        descripcion: mapped.descripcion || mapped.nombre || '',
        marca: mapped.marca || 'OILSTONE',
        categoria: mapped.categoria || 'Lubricantes',
        viscosidad: mapped.viscosidad || '',
        unidad: mapped.unidad || 'Caja',
        litros_por_unidad: Number(mapped.litrosPorUnidad || mapped.litros_por_unidad || 0),
        costo_usd: Number(mapped.costoUsd02 ?? mapped.costo_usd_02 ?? mapped.costoUsd ?? mapped.costo_usd ?? 0),
        precio_usd_detal: Number(mapped.precioUsdDetal02 ?? mapped.precio_usd_detal_02 ?? mapped.precioUsdDetal ?? mapped.precio_usd_detal ?? 0),
        precio_usd_mayor: Number(mapped.precioUsdMayor02 ?? mapped.precio_usd_mayor_02 ?? mapped.precioUsdMayor ?? mapped.precio_usd_mayor ?? 0),
        co_alma: '02',
        des_alma: '02 Almacén Central (Notas de Entrega)',
        alma_des: 'ALMACÉN CENTRAL / BÓVEDA',
        stock_act: Number(mapped.stockAlmacen02 ?? mapped.stock_almacen_02 ?? pStocks.stock02),
        stock_disp: Number(mapped.stockAlmacen02 ?? mapped.stock_almacen_02 ?? pStocks.stock02),
        stock_com: Number(mapped.comprometido ?? 0),
        stock_lle: 0,
        stock_des: 0,
        updated_at: new Date().toISOString()
      };
      await withTimeout(
        supabase.from('profit_stock_by_warehouse').upsert([stock01Payload, stock02Payload]),
        6000
      );
    } catch (e) {
      console.warn('[saveSupabaseProduct] Sync profit_stock_by_warehouse:', e.message);
    }

    // Difundir actualización en tiempo real a todas las pestañas y terminales
    broadcastReconcileChange({
      tableId: 'products',
      action: 'RECONCILE',
      key: mapped.codigo || mapped.id,
      item: mapped
    });

    return mapped;
  } catch (err) {
    console.warn('[saveSupabaseProduct] Supabase error:', err?.message || err);
    try { saveStorageProduct(normalized); } catch (_) {}
    markSupabaseOffline(err, 'saveSupabaseProduct');
    enqueueSyncAction('product', 'UPDATE', queuePayload);
    return normalized;
  }
};

export const deleteSupabaseProduct = async (id) => {
  const targetId = String(id).trim();
  const currentProds = getStorageProducts();
  const target = currentProds.find(p => String(p.id).trim() === targetId || String(p.codigo).trim() === targetId);
  const coArt = target?.codigo || targetId;

  deleteStorageProduct(targetId);

  const prodOr = Array.from(new Set([`id.eq.${targetId}`, coArt ? `codigo.eq.${coArt}` : null].filter(Boolean))).join(',');
  const whOr = Array.from(new Set([
    `co_art.eq.${targetId}`,
    coArt ? `codigo.eq.${coArt}` : null,
    `id.eq.${targetId}_01`,
    `id.eq.${targetId}_02`
  ].filter(Boolean))).join(',');

  try {
    const [prodDelRes] = await Promise.all([
      withTimeout(supabase.from('products').delete().or(prodOr), 6000),
      withTimeout(supabase.from('profit_stock_by_warehouse').delete().or(whOr), 6000).catch(() => ({}))
    ]);
    if (prodDelRes?.error) throw prodDelRes.error;

    broadcastReconcileChange({
      tableId: 'products',
      action: 'DELETE',
      key: targetId
    });

    isSupabaseAvailable = true;
    return true;
  } catch (err) {
    markSupabaseOffline(err, 'deleteSupabaseProduct');
    enqueueSyncAction('product', 'DELETE', { id: targetId, codigo: coArt });
    return true;
  }
};

// Clients
export const getSupabaseClients = async () => {
  // 1. FUENTE MAESTRA DE DATOS: Supabase Cloud (DB_SIGNUM_MOTORVEN)
  // Almacena cartera de clientes completa sincronizada
  if (isNetworkOnline()) {
    try {
      const { data, error } = await runSupabaseQueryWithRetry(
        () => supabase.from('clients').select('*').order('nombre', { ascending: true }),
        30000
      );

      if (!error && Array.isArray(data) && data.length > 0) {
        isSupabaseAvailable = true;
        const mapped = applyPendingQueueToEntities('client', data.map(mapClientFromDb));
        try {
          localStorage.setItem('sm_clients_v4_fiscal', JSON.stringify(mapped));
        } catch (_) {}
        return mapped;
      }
      if (error) markSupabaseOffline(error, 'getSupabaseClients');
    } catch (err) {
      markSupabaseOffline(err, 'getSupabaseClients');
    }
  }

  // 2. Caché local en caso de estar offline
  return markStaticFallback(applyPendingQueueToEntities('client', getStorageClients()));
};

export const saveSupabaseClient = async (client) => {
  saveStorageClient(client);
  const currentClients = getStorageClients();
  const clientToSave = currentClients.find(
    c => (client.id && c.id === client.id) || (client.codigo && c.codigo === client.codigo) || (client.rif && c.rif === client.rif)
  ) || client;
  const mergedClient = { ...clientToSave, ...client };

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('client', 'UPDATE', mergedClient);
    broadcastReconcileChange({
      tableId: 'clients',
      action: 'RECONCILE',
      key: mergedClient.id || mergedClient.codigo,
      item: mergedClient
    });
    return mergedClient;
  }

  try {
    const payload = mapClientToDb(mergedClient);
    const { data, error } = await withTimeout(
      supabase.from('clients').upsert(payload).select().single()
    );

    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = mapClientFromDb(data);
    saveStorageClient(mapped);
    broadcastReconcileChange({
      tableId: 'clients',
      action: 'RECONCILE',
      key: mapped.id || mapped.rif,
      item: mapped
    });
    return mapped;
  } catch (err) {
    saveStorageClient(mergedClient);
    markSupabaseOffline(err, 'saveSupabaseClient');
    enqueueSyncAction('client', 'UPDATE', mergedClient);
    broadcastReconcileChange({
      tableId: 'clients',
      action: 'RECONCILE',
      key: mergedClient.id || mergedClient.codigo,
      item: mergedClient
    });
    return mergedClient;
  }
};

export const deleteSupabaseClient = async (id) => {
  const targetId = String(id || '').trim();
  const currentClients = getStorageClients();
  const target = currentClients.find(
    c => c.id === targetId || c.codigo === targetId || c.rif === targetId
  );
  const coCli = target?.codigo || targetId;

  deleteStorageClient(targetId);
  if (coCli && coCli !== targetId) {
    deleteStorageClient(coCli);
  }



  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('client', 'DELETE', { id: targetId, codigo: coCli });
    broadcastReconcileChange({
      tableId: 'clients',
      action: 'DELETE',
      key: targetId
    });
    return true;
  }

  try {
    const { error } = await withTimeout(
      supabase.from('clients').delete().eq('id', targetId)
    );

    if (error) {
      const codeRes = coCli ? await supabase.from('clients').delete().eq('codigo', coCli) : { error };
      if (codeRes?.error) {
        // Si tiene facturas o documentos en cuentas por cobrar con FK, aplicar soft delete
        await supabase.from('clients').update({ inactivo: true, sin_credito: true }).eq('id', targetId);
      }
    }

    broadcastReconcileChange({
      tableId: 'clients',
      action: 'DELETE',
      key: targetId
    });
    isSupabaseAvailable = true;
    return true;
  } catch (err) {
    markSupabaseOffline(err, 'deleteSupabaseClient');
    enqueueSyncAction('client', 'DELETE', { id: targetId, codigo: coCli });
    broadcastReconcileChange({
      tableId: 'clients',
      action: 'DELETE',
      key: targetId
    });
    return true;
  }
};

// Batch Upsert Helpers para Reconciliación Ultrarrápida
export const saveSupabaseBatchProducts = async (productsList) => {
  if (!Array.isArray(productsList) || productsList.length === 0) return [];

  // 1. Guardar masivamente en almacenamiento local
  try {
    const existing = getStorageProducts();
    const map = new Map();
    existing.forEach(p => map.set(p.codigo || p.id, p));
    productsList.forEach(p => map.set(p.codigo || p.id, { ...(map.get(p.codigo || p.id) || {}), ...p }));
    const merged = Array.from(map.values());
    localStorage.setItem('sm_products_v4_fiscal', JSON.stringify(merged));
  } catch (e) {
    console.warn('[saveSupabaseBatchProducts] Error en local storage:', e);
  }

  // 2. Si la red está activa, upsert en Supabase por bloques
  if (isNetworkOnline()) {
    try {
      const dbPayloads = productsList.map(mapProductToDb);
      const chunkSize = 50;
      for (let i = 0; i < dbPayloads.length; i += chunkSize) {
        const chunk = dbPayloads.slice(i, i + chunkSize);
        await withTimeout(supabase.from('products').upsert(chunk));
      }
      isSupabaseAvailable = true;
    } catch (err) {
      markSupabaseOffline(err, 'saveSupabaseBatchProducts');
    }
  }

  return productsList;
};

export const saveSupabaseBatchClients = async (clientsList) => {
  if (!Array.isArray(clientsList) || clientsList.length === 0) return [];

  // 1. Guardar masivamente en almacenamiento local
  try {
    const existing = getStorageClients();
    const map = new Map();
    existing.forEach(c => map.set(c.rif || c.codigo || c.id, c));
    clientsList.forEach(c => map.set(c.rif || c.codigo || c.id, { ...(map.get(c.rif || c.codigo || c.id) || {}), ...c }));
    const merged = Array.from(map.values());
    localStorage.setItem('sm_clients_v4_fiscal', JSON.stringify(merged));
  } catch (e) {
    console.warn('[saveSupabaseBatchClients] Error en local storage:', e);
  }

  // 2. Si la red está activa, upsert en Supabase por bloques de 100
  if (isNetworkOnline()) {
    try {
      const dbPayloads = clientsList.map(mapClientToDb);
      const chunkSize = 100;
      for (let i = 0; i < dbPayloads.length; i += chunkSize) {
        const chunk = dbPayloads.slice(i, i + chunkSize);
        await withTimeout(supabase.from('clients').upsert(chunk));
      }
      isSupabaseAvailable = true;
    } catch (err) {
      markSupabaseOffline(err, 'saveSupabaseBatchClients');
    }
  }

  return clientsList;
};

export const saveSupabaseBatchTable = async (tableName, rowsList) => {
  if (!Array.isArray(rowsList) || rowsList.length === 0) return [];
  if (tableName === 'profit_warehouses') {
    return saveSupabaseBatchWarehouses(rowsList);
  }
  if (isNetworkOnline()) {
    try {
      const chunkSize = 100;
      for (let i = 0; i < rowsList.length; i += chunkSize) {
        const chunk = rowsList.slice(i, i + chunkSize);
        await withTimeout(supabase.from(tableName).upsert(chunk));
      }
      isSupabaseAvailable = true;
    } catch (err) {
      markSupabaseOffline(err, `saveSupabaseBatchTable:${tableName}`);
    }
  }
  return rowsList;
};

// Suppliers
export const getSupabaseSuppliers = async () => {
  if (!isSupabaseAvailable) return applyPendingQueueToEntities('supplier', getStorageSuppliers());
  try {
    const { data, error } = await withTimeout(
      supabase.from('suppliers').select('*').order('id', { ascending: true })
    );

    if (error || !data || data.length === 0) {
      if (error) markSupabaseOffline(error, 'getSupabaseSuppliers');
      return applyPendingQueueToEntities('supplier', getStorageSuppliers());
    }
    isSupabaseAvailable = true;
    const mapped = applyPendingQueueToEntities('supplier', data.map(mapSupplierFromDb));
    try {
      localStorage.setItem('sm_suppliers_v4_fiscal', JSON.stringify(mapped));
    } catch (_) {}
    return mapped;
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseSuppliers');
    return applyPendingQueueToEntities('supplier', getStorageSuppliers());
  }
};

export const saveSupabaseSupplier = async (supplier) => {
  saveStorageSupplier(supplier);
  const currentSuppliers = getStorageSuppliers();
  const supplierToSave = currentSuppliers.find(s => (supplier.id && s.id === supplier.id) || s.rif === supplier.rif) || supplier;

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('supplier', 'UPDATE', supplierToSave);
    return supplierToSave;
  }

  try {
    const payload = mapSupplierToDb(supplierToSave);
    const { data, error } = await withTimeout(
      supabase.from('suppliers').upsert(payload).select().single()
    );

    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = mapSupplierFromDb(data);
    saveStorageSupplier(mapped);
    return mapped;
  } catch (err) {
    markSupabaseOffline(err, 'saveSupabaseSupplier');
    enqueueSyncAction('supplier', 'UPDATE', supplierToSave);
    return supplierToSave;
  }
};

export const deleteSupabaseSupplier = async (id) => {
  if (!id) return false;

  deleteStorageSupplier(id);

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('supplier', 'DELETE', { id });
    return true;
  }

  try {
    const { error } = await withTimeout(
      supabase.from('suppliers').delete().eq('id', id)
    );

    if (error) throw error;
    isSupabaseAvailable = true;
    return true;
  } catch (err) {
    markSupabaseOffline(err, 'deleteSupabaseSupplier');
    enqueueSyncAction('supplier', 'DELETE', { id });
    return true;
  }
};

// Sales
const getStorageSalesWithoutDeleted = () => {
  const list = getStorageSales() || [];
  try {
    const delSet = new Set(sanitizeCxcDeletedDocsStorage());
    if (delSet.size === 0) return list;
    return list.filter(s => s && !isCxcEntryDeleted(s, delSet));
  } catch (_) {
    return list;
  }
};

export const getSupabaseSales = async () => {
  if (!isSupabaseAvailable) return markStaticFallback(applyPendingQueueToEntities('sale', getStorageSalesWithoutDeleted()));
  try {
    const { data, error } = await runSupabaseQueryWithRetry(
      () => supabase.from('sales').select('*').order('fecha', { ascending: false }),
      30000
    );

    if (error) {
      markSupabaseOffline(error, 'getSupabaseSales');
      return markStaticFallback(applyPendingQueueToEntities('sale', getStorageSalesWithoutDeleted()));
    }
    isSupabaseAvailable = true;
    const rawMapped = (data || []).map(mapSaleFromDb).filter(Boolean);
    const delSet = reconcileCxcTombstonesWithServerDocs(rawMapped);
    const mapped = rawMapped.filter(s => !isCxcEntryDeleted(s, delSet));
    const reconciled = dedupeCanonicalDocs(applyPendingQueueToEntities('sale', mapped));
    try {
      if (typeof localStorage !== 'undefined' && Array.isArray(data)) {
        localStorage.setItem('sm_sales_v4_fiscal', JSON.stringify(reconciled));
      }
    } catch (_) {}
    return reconciled;
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseSales');
    return markStaticFallback(applyPendingQueueToEntities('sale', getStorageSalesWithoutDeleted()));
  }
};

const SYNTHETIC_ITEM_ID_RE = /^(ITEM-|PED-|ROW-|LINE-)/i;

export const resolveStockItemProductKey = (item) => {
  if (!item || typeof item !== 'object') return '';
  const explicitCandidates = [
    item.articuloId,
    item.articulo_id,
    item.codigo,
    item.co_art,
    item.productoCodigo,
    item.productoId
  ];
  for (const cand of explicitCandidates) {
    const clean = String(cand ?? '').trim();
    if (clean && !SYNTHETIC_ITEM_ID_RE.test(clean)) return clean;
  }
  const fallbackId = String(item.id ?? '').trim();
  if (fallbackId && !SYNTHETIC_ITEM_ID_RE.test(fallbackId)) return fallbackId;
  return '';
};

const resolveOutgoingDocType = (doc) => {
  if (!doc || typeof doc !== 'object') return 'FACTURA';
  const rawTipo = String(doc.tipoDoc || doc.tipo_doc || '').toUpperCase().trim();
  const rawDocRef = String(doc.numeroDoc || doc.numero_doc || doc.factNum || doc.fact_num || doc.id || '').toUpperCase().trim();
  if (rawTipo === 'NOTA_ENTREGA' || rawDocRef.startsWith('NE-') || rawDocRef.startsWith('N.E-')) {
    return 'NOTA_ENTREGA';
  }
  return rawTipo || 'FACTURA';
};

export const buildSaleStockDeltaLines = (saleRecord, { reverse = false } = {}) => {
  if (!saleRecord || !Array.isArray(saleRecord.items) || saleRecord.items.length === 0) return [];
  const rawTipo = resolveOutgoingDocType(saleRecord);
  const isNotaEntrega = rawTipo === 'NOTA_ENTREGA';
  const isNotaCredito = rawTipo === 'NOTA_CREDITO';
  const isSaleOut = rawTipo === 'FACTURA' || isNotaEntrega || rawTipo === 'NOTA_DEBITO';
  if (!isSaleOut && !isNotaCredito) return [];

  const targetWh = isNotaCredito
    ? (/^(NE|N\.E)/i.test(String(saleRecord.documentoAfectado || saleRecord.documento_afectado || '').trim()) ? '02' : '01')
    : (isNotaEntrega ? '02' : '01');

  // Al emitir venta: FACT/NE/ND restan (-1), NC suma (+1). Al eliminar/revertir: se invierte el signo.
  const sign = (isNotaCredito ? 1 : -1) * (reverse ? -1 : 1);

  const qtyByKey = new Map();
  for (const item of saleRecord.items) {
    const prodKey = resolveStockItemProductKey(item);
    const qty = Math.max(0, Number(item.cantidad ?? item.qty ?? 0));
    if (!prodKey || qty <= 0) continue;
    qtyByKey.set(prodKey, (qtyByKey.get(prodKey) || 0) + qty);
  }
  if (qtyByKey.size === 0) return [];

  const lines = [];
  for (const [prodKey, qty] of qtyByKey.entries()) {
    const signed = Number((sign * qty).toFixed(4));
    lines.push({
      codigo: prodKey,
      delta01: targetWh === '01' ? signed : 0,
      delta02: targetWh === '02' ? signed : 0
    });
  }
  return lines;
};

export const buildDocTypeChangeWarehouseDeltaLines = (originalDoc, updatedDocData) => {
  if (!originalDoc || !updatedDocData) return [];
  const oldTipo = resolveOutgoingDocType(originalDoc);
  const newTipo = resolveOutgoingDocType(updatedDocData);
  const outgoingTypes = new Set(['FACTURA', 'NOTA_ENTREGA', 'NOTA_DEBITO']);
  if (!outgoingTypes.has(oldTipo) || !outgoingTypes.has(newTipo)) return [];

  const oldWh = oldTipo === 'NOTA_ENTREGA' ? '02' : '01';
  const newWh = newTipo === 'NOTA_ENTREGA' ? '02' : '01';
  if (oldWh === newWh) return [];

  const sourceItems = Array.isArray(originalDoc?.items)
    ? originalDoc.items
    : (Array.isArray(updatedDocData?.items) ? updatedDocData.items : []);
  if (sourceItems.length === 0) return [];

  const qtyByKey = new Map();
  for (const item of sourceItems) {
    const prodKey = resolveStockItemProductKey(item);
    const qty = Math.max(0, Number(item?.cantidad ?? item?.qty ?? 0));
    if (!prodKey || qty <= 0) continue;
    qtyByKey.set(prodKey, (qtyByKey.get(prodKey) || 0) + qty);
  }
  if (qtyByKey.size === 0) return [];

  const lines = [];
  for (const [prodKey, rawQty] of qtyByKey.entries()) {
    const qty = Number(rawQty.toFixed(4));
    lines.push({
      codigo: prodKey,
      delta01: oldWh === '01' ? qty : -qty,
      delta02: oldWh === '02' ? qty : -qty
    });
  }
  return lines;
};

/**
 * Calcula el ajuste neto de inventario por almacén (01/02) al editar una Factura o Nota de Entrega,
 * contemplando cambios de cantidades, renglones agregados/eliminados y cambios de tipoDoc (01 <-> 02).
 */
export const buildInvoiceEditStockDeltaLines = (originalDoc, updatedDocData) => {
  if (!originalDoc || !updatedDocData) return [];
  const oldTipo = resolveOutgoingDocType(originalDoc);
  const newTipo = resolveOutgoingDocType(updatedDocData);
  const outgoingTypes = new Set(['FACTURA', 'NOTA_ENTREGA', 'NOTA_DEBITO']);
  if (!outgoingTypes.has(oldTipo) || !outgoingTypes.has(newTipo)) return [];

  const oldWh = oldTipo === 'NOTA_ENTREGA' ? '02' : '01';
  const newWh = newTipo === 'NOTA_ENTREGA' ? '02' : '01';

  const aggregateBySku = (itemsList) => {
    const map = new Map();
    if (!Array.isArray(itemsList)) return map;
    for (const item of itemsList) {
      const prodKey = resolveStockItemProductKey(item);
      const qty = Math.max(0, Number(item?.cantidad ?? item?.qty ?? item?.total_art ?? 0));
      if (!prodKey || qty <= 0) continue;
      map.set(prodKey, (map.get(prodKey) || 0) + qty);
    }
    return map;
  };

  const oldMap = aggregateBySku(originalDoc?.items || originalDoc?.renglones);
  const newMap = aggregateBySku(updatedDocData?.items || updatedDocData?.renglones);
  const allKeys = new Set([...newMap.keys(), ...oldMap.keys()]);
  const lines = [];

  for (const prodKey of allKeys) {
    const oldQty = oldMap.get(prodKey) || 0;
    const newQty = newMap.get(prodKey) || 0;
    const delta01 = Number(((oldWh === '01' ? oldQty : 0) - (newWh === '01' ? newQty : 0)).toFixed(4));
    const delta02 = Number(((oldWh === '02' ? oldQty : 0) - (newWh === '02' ? newQty : 0)).toFixed(4));
    if (delta01 !== 0 || delta02 !== 0) {
      lines.push({ codigo: prodKey, delta01, delta02 });
    }
  }
  return lines;
};

/**
 * Clave idempotente estable para la reversión de inventario al eliminar un documento.
 * Combina tipo (FAC/NE), número limpio y fecha/hora de emisión para que:
 *  - reintentos del mismo borrado (directo o desde la cola offline) compartan la misma clave y
 *    nunca reingresen el stock dos veces;
 *  - un correlativo reutilizado en otra fecha no quede bloqueado por una clave antigua.
 */
export const buildSaleRevertIdempotencyKey = (doc, fallbackRef = '') => {
  const src = doc && typeof doc === 'object' ? doc : {};
  const rawRef = String(
    src.numeroDoc || src.numero_doc || src.factNum || src.fact_num || src.id || fallbackRef || ''
  ).trim();
  const isNe = resolveOutgoingDocType(src) === 'NOTA_ENTREGA' || /^(NE-|NDE-|N\.E-)/i.test(rawRef);
  const cleanNum = rawRef.replace(/^(FAC-|FACT-|NE-|NDE-|N\.E-|fac-|doc-|inv-)/i, '').trim();
  const rawDate = src.fechaEmision || src.fecha_emision || src.fecha || src.fec_emis || '';
  let ts = '';
  if (rawDate) {
    const parsed = Date.parse(rawDate);
    ts = Number.isFinite(parsed)
      ? new Date(parsed).toISOString().slice(0, 19).replace(/[^0-9]/g, '')
      : String(rawDate).replace(/[^0-9]/g, '').slice(0, 14);
  }
  return `sale_${isNe ? 'NE' : 'FAC'}_${cleanNum || 'SN'}${ts ? `_${ts}` : ''}_revert`;
};

export const buildSaleDeductIdempotencyKey = (doc, fallbackRef = '') => {
  const src = doc && typeof doc === 'object' ? doc : {};
  const rawRef = String(
    src.numeroDoc || src.numero_doc || src.factNum || src.fact_num || src.id || fallbackRef || ''
  ).trim();
  const isNe = resolveOutgoingDocType(src) === 'NOTA_ENTREGA' || /^(NE-|NDE-|N\.E-)/i.test(rawRef);
  const cleanNum = rawRef
    .replace(/^(FAC-|FACT-|NE-|NDE-|N\.E-|fac-|doc-|inv-)/i, '')
    .trim()
    .replace(/^0+(?=\d)/, '');
  const rawDate = src.fechaEmision || src.fecha_emision || src.fecha || src.fec_emis || '';
  let ts = '';
  if (rawDate) {
    const parsed = Date.parse(rawDate);
    ts = Number.isFinite(parsed)
      ? new Date(parsed).toISOString().slice(0, 19).replace(/[^0-9]/g, '')
      : String(rawDate).replace(/[^0-9]/g, '').slice(0, 14);
  }
  const orderTag = String(src.pedidoOrigenId || src.pedido_origen_id || '').trim();
  return `sale_${isNe ? 'NE' : 'FAC'}_${cleanNum || 'SN'}${ts ? `_${ts}` : ''}${orderTag ? `_${orderTag}` : ''}_deduct`;
};

const adjustSupabaseProductsStockForSale = async (saleRecord, { reverse = false, idempotencyKey = '', skipLocalStoragePatch = false } = {}) => {
  const lines = buildSaleStockDeltaLines(saleRecord, { reverse });
  if (lines.length === 0) return [];
  const docId = String(saleRecord?.id || saleRecord?.numeroDoc || saleRecord?.factNum || saleRecord?.fact_num || '').trim();
  const resolvedKey =
    idempotencyKey ||
    (reverse ? buildSaleRevertIdempotencyKey(saleRecord, docId) : buildSaleDeductIdempotencyKey(saleRecord, docId));
  return applyStockDeltaForWarehouseLines(lines, {
    validateStrict: false,
    idempotencyKey: resolvedKey,
    skipLocalStoragePatch
  });
};

export const CXC_DELETED_DOCS_KEY = 'signum_cxc_deleted_docs_v1';
const CXC_DELETED_META_KEY = 'signum_cxc_deleted_meta_v1';
const CXC_DELETED_SANITIZED_KEY = 'signum_cxc_deleted_docs_sanitized_v1';
const CXC_DELETED_SERVER_SYNC_V2_KEY = 'signum_cxc_deleted_server_sync_v2';
const CXC_DELETED_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CXC_IN_FLIGHT_DELETE_GRACE_MS = 35 * 1000;

const getPendingCxcDeleteKeysFromQueue = () => {
  const pendingSet = new Set();
  try {
    getSyncQueue()
      .filter(q => q && ['sale', 'sales', 'profit_invoice', 'profit_invoices'].includes(q.entity) && q.action === 'DELETE')
      .forEach(q => {
        getScopedCxcDeleteKeys(q.data).forEach(k => pendingSet.add(k));
      });
  } catch (_) {}
  return pendingSet;
};

const readCxcDeletedMeta = () => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(CXC_DELETED_META_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
};

const writeCxcDeletedMeta = (meta) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CXC_DELETED_META_KEY, JSON.stringify(meta || {}));
  } catch (_) {}
};

export const markCxcDocDeleted = (docOrRef) => {
  const keys = getScopedCxcDeleteKeys(docOrRef);
  if (keys.length === 0) return [];
  try {
    if (typeof localStorage !== 'undefined') {
      const delList = sanitizeCxcDeletedDocsStorage();
      const meta = readCxcDeletedMeta();
      const now = Date.now();
      const eraKey = typeof docOrRef === 'object' ? getEraScopedCanonicalDocKey(docOrRef) : '';
      const isLegacyEra = eraKey.endsWith(':LEGACY');
      const targetTipo = inferCxcDocType(docOrRef);
      keys.forEach(k => {
        if (!delList.includes(k)) delList.push(k);
        meta[k] = {
          deletedAt: now,
          era: eraKey ? (isLegacyEra ? 'LEGACY' : 'MODERN') : '',
          tipoDoc: targetTipo
        };
      });
      localStorage.setItem(CXC_DELETED_DOCS_KEY, JSON.stringify(delList));
      writeCxcDeletedMeta(meta);
    }
  } catch (_) {}
  return keys;
};

export const getScopedCxcDeleteKeys = (docOrRef) => {
  if (!docOrRef) return [];
  const rawId = typeof docOrRef === 'object' ? String(docOrRef.id || '').trim() : String(docOrRef || '').trim();
  const rawNum = typeof docOrRef === 'object'
    ? String(docOrRef.factNum ?? docOrRef.fact_num ?? docOrRef.factura ?? docOrRef.numeroDoc ?? docOrRef.id ?? '').trim()
    : String(docOrRef || '').trim();
  const cleanNum = rawNum.replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
  const isNe = inferCxcDocType(docOrRef) === 'NOTA_ENTREGA';
  const canon = typeof docOrRef === 'object'
    ? getEraScopedCanonicalDocKey(docOrRef, isNe ? 'NOTA_ENTREGA' : 'FACTURA')
    : getCanonicalDocKey(docOrRef, isNe ? 'NOTA_ENTREGA' : 'FACTURA');

  if (isNe) {
    const nePrefixed = cleanNum ? `NE-${cleanNum}` : '';
    const safeRawId = rawId && !/^\d+$/.test(rawId) ? rawId : '';
    const safeRawNum = /^(NE:|NE-|NDE-)/i.test(rawNum) ? rawNum : '';
    return Array.from(new Set([canon, safeRawId, safeRawNum, nePrefixed].filter(Boolean)));
  }

  return Array.from(
    new Set([
      canon,
      rawId,
      rawNum,
      cleanNum,
      cleanNum ? `FAC-${cleanNum}` : '',
      cleanNum ? `DOC-${cleanNum}` : '',
      cleanNum ? `INV-${cleanNum}` : ''
    ].filter(Boolean))
  );
};

export const sanitizeCxcDeletedDocsStorage = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const rawDel = localStorage.getItem(CXC_DELETED_DOCS_KEY);
    const parsed = rawDel ? JSON.parse(rawDel) : [];
    let list = Array.isArray(parsed) ? parsed.map(String) : [];

    if (!localStorage.getItem(CXC_DELETED_SANITIZED_KEY)) {
      // Limpieza única de entradas POS con ceros a la izquierda (p.ej. 000001 / NE-000001) que causaban colisión cruzada entre Facturas y Notas de Entrega
      list = list.filter(k => !/^(FAC-|FACT-|NE-|NDE-|DOC-|INV-)?0+\d+$/i.test(String(k || '').trim()));
      localStorage.setItem(CXC_DELETED_DOCS_KEY, JSON.stringify(list));
      localStorage.setItem(CXC_DELETED_SANITIZED_KEY, '1');
    }

    // Purgar tombstones con antigüedad > 7 días o huérfanos sin timestamp en navegador real
    const meta = readCxcDeletedMeta();
    const now = Date.now();
    const pendingDeleteKeys = getPendingCxcDeleteKeysFromQueue();
    let metaDirty = false;
    let listDirty = false;

    if (typeof window !== 'undefined' && !isTestEnv && !localStorage.getItem(CXC_DELETED_SERVER_SYNC_V2_KEY)) {
      list = list.filter(k => {
        const m = meta[k];
        const keep = pendingDeleteKeys.has(k) || Boolean(m && m.deletedAt && (now - m.deletedAt) <= CXC_IN_FLIGHT_DELETE_GRACE_MS);
        if (!keep && meta[k]) {
          delete meta[k];
          metaDirty = true;
        }
        return keep;
      });
      localStorage.setItem(CXC_DELETED_DOCS_KEY, JSON.stringify(list));
      localStorage.setItem(CXC_DELETED_SERVER_SYNC_V2_KEY, '1');
      if (metaDirty) writeCxcDeletedMeta(meta);
    }

    const filteredList = list.filter(k => {
      const m = meta[k];
      if (typeof window !== 'undefined' && !isTestEnv && (!m || !m.deletedAt) && !pendingDeleteKeys.has(k)) {
        if (meta[k]) {
          delete meta[k];
          metaDirty = true;
        }
        listDirty = true;
        return false;
      }
      if (m && m.deletedAt && (now - m.deletedAt) > CXC_DELETED_TOMBSTONE_TTL_MS && !pendingDeleteKeys.has(k)) {
        delete meta[k];
        metaDirty = true;
        listDirty = true;
        return false;
      }
      return true;
    });
    if (metaDirty || listDirty) {
      localStorage.setItem(CXC_DELETED_DOCS_KEY, JSON.stringify(filteredList));
      writeCxcDeletedMeta(meta);
    }
    return filteredList;
  } catch (_) {
    return [];
  }
};

/**
 * Reconcilia automáticamente la caché local de documentos eliminados (signum_cxc_deleted_docs_v1)
 * contra la respuesta viva del servidor central:
 * Si un documento sigue activo en el servidor y no tiene un DELETE pendiente en la cola offline
 * ni fue eliminado en los últimos 35 segundos (ventana de petición en vuelo), purga el tombstone
 * obsoleto de localStorage para que todos los navegadores vean exactamente lo mismo que el servidor.
 */
export const reconcileCxcTombstonesWithServerDocs = (remoteDocs = []) => {
  const delList = sanitizeCxcDeletedDocsStorage();
  const delSet = new Set(delList);
  if (delSet.size === 0 || !Array.isArray(remoteDocs) || remoteDocs.length === 0) {
    return delSet;
  }
  try {
    const meta = readCxcDeletedMeta();
    const now = Date.now();
    const pendingDeleteKeys = getPendingCxcDeleteKeysFromQueue();
    for (const doc of remoteDocs) {
      if (!doc) continue;
      const scopedKeys = getScopedCxcDeleteKeys(doc);
      const matched = scopedKeys.filter(k => delSet.has(k));
      if (matched.length === 0) continue;
      const isPendingOrInFlight = scopedKeys.some(
        k => pendingDeleteKeys.has(k) || Boolean(meta[k]?.deletedAt && (now - meta[k].deletedAt) <= CXC_IN_FLIGHT_DELETE_GRACE_MS)
      );
      if (!isPendingOrInFlight) {
        unmarkCxcDeletedDoc(doc);
        scopedKeys.forEach(k => delSet.delete(k));
      }
    }
  } catch (_) {}
  return delSet;
};

const PERMANENTLY_PURGED_DUPLICATE_DOCS = [
  { canonKey: 'FAC:12', datePrefix: '2026-11-12', clientRif: 'J503078081' }
];

export const isPermanentlyPurgedDuplicateDoc = (doc) => {
  if (!doc || typeof doc !== 'object') return false;
  const rawRef = String(doc.numeroDoc || doc.numero_doc || doc.factNum || doc.fact_num || doc.id || '').trim().toUpperCase();
  if (!rawRef) return false;
  const isNe = inferCxcDocType(doc) === 'NOTA_ENTREGA' || /^(NE-|NDE-|N\.E-)/i.test(rawRef);
  const cleanNum = rawRef.replace(/^(FAC-|FACT-|INV-|NE-|NDE-|N\.E-|NC-|ND-|DOC-)/i, '').replace(/^0+(?=\d)/, '');
  if (!cleanNum) return false;
  const canonKey = `${isNe ? 'NE' : 'FAC'}:${cleanNum}`;
  const rawDate = String(doc.fechaEmision || doc.fecha_emision || doc.fec_emis || doc.fecha || '').trim();
  const datePrefix = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : '';
  const clientRif = String(doc.clienteRif || doc.cliente_rif || doc.rif || doc.clienteId || doc.cliente_id || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();
  return PERMANENTLY_PURGED_DUPLICATE_DOCS.some(
    (p) =>
      p.canonKey === canonKey &&
      (!p.datePrefix || !datePrefix || p.datePrefix === datePrefix) &&
      (!p.clientRif || !clientRif || p.clientRif === clientRif) &&
      Boolean(datePrefix || clientRif)
  );
};

export const isCxcEntryDeleted = (docOrIds, delSet) => {
  if (docOrIds && typeof docOrIds === 'object' && isPermanentlyPurgedDuplicateDoc(docOrIds)) {
    return true;
  }
  if (!delSet || delSet.size === 0 || !docOrIds) return false;
  const scopedKeys = getScopedCxcDeleteKeys(docOrIds);
  const matched = scopedKeys.filter(k => delSet.has(k));
  if (matched.length === 0) return false;

  if (typeof docOrIds === 'object') {
    const meta = readCxcDeletedMeta();
    const docTs = Date.parse(
      docOrIds.created_at ||
      docOrIds.updated_at ||
      docOrIds.fechaSincronizacion ||
      docOrIds.fecha_sincronizacion ||
      docOrIds.fechaEmision ||
      docOrIds.fec_emis ||
      0
    ) || 0;
    const docEraKey = getEraScopedCanonicalDocKey(docOrIds);
    const docEra = docEraKey ? (docEraKey.endsWith(':LEGACY') ? 'LEGACY' : 'MODERN') : '';
    const docTipo = inferCxcDocType(docOrIds);

    const activeMatches = matched.filter(k => {
      const m = meta[k];
      if (!m) {
        // Sin metadatos, evitar que un número pelado heredado oculte una NOTA_ENTREGA
        if (docTipo === 'NOTA_ENTREGA' && !/^(NE:|NE-|NDE-)/i.test(String(k))) {
          return false;
        }
        return true;
      }
      if (m.tipoDoc && docTipo && m.tipoDoc !== docTipo) return false;
      if (m.era && docEra && m.era !== docEra) return false;
      if (docTs > 0 && m.deletedAt && docTs > m.deletedAt + 2000) return false;
      return true;
    });

    if (activeMatches.length === 0) {
      unmarkCxcDeletedDoc(docOrIds);
      return false;
    }
  }
  return true;
};

export const unmarkCxcDeletedDoc = (docOrRef) => {
  try {
    if (typeof localStorage === 'undefined') return;
    const keysToUnmark = new Set(getScopedCxcDeleteKeys(docOrRef));
    if (keysToUnmark.size === 0) return;
    const rawDel = localStorage.getItem(CXC_DELETED_DOCS_KEY);
    if (rawDel) {
      const parsed = JSON.parse(rawDel);
      if (Array.isArray(parsed)) {
        const next = parsed.filter(k => !keysToUnmark.has(String(k).trim()));
        if (next.length !== parsed.length) {
          localStorage.setItem(CXC_DELETED_DOCS_KEY, JSON.stringify(next));
        }
      }
    }
    const meta = readCxcDeletedMeta();
    let metaDirty = false;
    keysToUnmark.forEach(k => {
      if (meta[k]) {
        delete meta[k];
        metaDirty = true;
      }
    });
    if (metaDirty) writeCxcDeletedMeta(meta);
  } catch (_) {}
};

export const buildProfitInvoicePayloadFromSale = (sale, vendedorIdArg = '') => {
  if (!sale) return null;
  const tipoUpper = String(sale.tipoDoc || '').toUpperCase().trim();
  if (tipoUpper === 'NOTA_CREDITO' || tipoUpper === 'COTIZACION') return null;

  const isNeDoc = tipoUpper === 'NOTA_ENTREGA';
  const isCreditSale =
    isCreditPaymentCondition(sale.condicionPago, sale.metodoPago) ||
    Number(sale.diasCredito || 0) > 0 ||
    String(sale.estado || '').toUpperCase() === 'PENDIENTE';
  const estadoUpper = String(sale.estado || sale.status || '').toUpperCase().trim();
  const isSettledExplicit =
    estadoUpper === 'PAGADO' || estadoUpper === 'PAGADA' || estadoUpper === 'COBRADA';
  const generatesReceivable =
    !isSettledExplicit &&
    (isCreditSale || tipoUpper === 'FACTURA' || tipoUpper === 'NOTA_ENTREGA');
  const effectiveNetoUsd = isNeDoc
    ? Number(sale.subtotalUsd || sale.totalUsd || 0)
    : Number(sale.totalUsd || 0);
  const resolvedSaldoUsd = generatesReceivable
    ? Number(sale.saldoUsd !== undefined && Number(sale.saldoUsd) > 0 ? sale.saldoUsd : effectiveNetoUsd)
    : (isCreditSale ? Number(sale.saldoUsd !== undefined ? sale.saldoUsd : effectiveNetoUsd) : 0);
  const resolvedAbonosUsd = generatesReceivable || isCreditSale
    ? Math.max(0, Number((effectiveNetoUsd - resolvedSaldoUsd).toFixed(2)))
    : effectiveNetoUsd;

  const candidateArg = String(vendedorIdArg || '').trim();
  const candidateOnSale = String(
    sale.vendedorId || sale.vendedorCoVen || sale.coVen || sale.co_ven || ''
  ).trim();
  let resolvedVendedorId =
    (candidateArg && candidateArg.toUpperCase() !== 'OF' ? candidateArg : '') ||
    (candidateOnSale && candidateOnSale.toUpperCase() !== 'OF' ? candidateOnSale : '');

  if (!resolvedVendedorId) {
    const rawSellerName = String(sale.vendedor || sale.vendedorNombre || '').trim();
    if (rawSellerName) {
      const matchedSeller = (REAL_PROFIT_SELLERS || []).find((s) => matchesSeller(s, rawSellerName));
      if (matchedSeller?.coVen) {
        resolvedVendedorId = String(matchedSeller.coVen).trim();
      }
    }
  }
  resolvedVendedorId = resolvedVendedorId || candidateArg || candidateOnSale || 'OF';

  const totalLitros = resolveInvoiceLitros(sale);
  const totalCajas = resolveInvoiceCajas(sale);

  return {
    id: sale.id,
    factNum: sale.numeroDoc,
    tipoDoc: sale.tipoDoc,
    condicionPago: sale.condicionPago || (isCreditSale ? 'CREDITO' : 'CONTADO'),
    clienteId: sale.clienteId,
    clienteNombre: sale.clienteNombre,
    clienteRif: sale.clienteRif,
    vendedorId: resolvedVendedorId,
    vendedorNombre: sale.vendedor || sale.vendedorNombre || '',
    totBrutoUsd: Number(sale.subtotalUsd ?? sale.totalBrutoUsd ?? 0),
    ivaUsd: isNeDoc ? 0 : Number(sale.ivaUsd || 0),
    totNetoUsd: effectiveNetoUsd,
    saldoUsd: resolvedSaldoUsd,
    abonosUsd: resolvedAbonosUsd,
    diasCredito: sale.diasCredito || 0,
    fechaEmision: sale.fechaEmision || sale.fecha,
    fechaVencimiento: sale.fechaVencimiento || sale.fechaEmision || sale.fecha,
    fechaUltimoCobro: resolvedSaldoUsd <= 0.01 ? (sale.fechaUltimoCobro || sale.fechaEmision || sale.fecha) : undefined,
    tasa: sale.tasaDolar,
    tipoTasa: normalizeRateType(sale.tipoTasa ?? sale.tipo_tasa, {
      tipoDoc: sale.tipoDoc,
      monedaPago: sale.monedaPago ?? sale.moneda_pago,
      fallback: 'BCV'
    }),
    tasaPago: Number(sale.tasaPago ?? sale.tasa_pago ?? sale.tasaDolar ?? 0),
    monedaPago: sale.monedaPago ?? sale.moneda_pago ?? (String(sale.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    status: resolvedSaldoUsd <= 0.01 ? 'COBRADA' : 'PENDIENTE',
    formaPago: isCreditSale ? '03' : '01',
    totalLitros,
    totalCajas,
    items: sale.items
  };
};

const syncOfflineSaleInventoryAndCxc = (localSale, saleData = {}) => {
  if (!localSale) return;
  localSale._offlineQueued = true;
  const queuedSalePayload = { ...localSale, _createdOffline: true };
  unmarkCxcDeletedDoc(localSale);

  // Encolar primero la venta para que al reconectar se verifique/persista antes del delta de inventario
  enqueueSyncAction('sale', 'INSERT', queuedSalePayload);
  broadcastReconcileChange({
    tableId: 'sales',
    action: 'CREATE',
    key: localSale.numeroDoc || localSale.id,
    item: localSale
  });

  try {
    const deltaLines = buildSaleStockDeltaLines(localSale, { reverse: false });
    if (deltaLines.length > 0) {
      const deltaKey = buildSaleDeductIdempotencyKey(localSale);
      enqueueSyncAction('stock_delta', 'UPDATE', {
        id: deltaKey,
        idempotencyKey: deltaKey,
        lines: deltaLines,
        validateStrict: false,
        alreadyAppliedLocally: true
      });
    }
    const storageProds = getStorageProducts();
    (localSale.items || saleData.items || []).forEach(it => {
      const key = resolveStockItemProductKey(it);
      if (!key) return;
      const updatedProd = storageProds.find(
        p => String(p.id || '').trim() === key || String(p.codigo || '').trim() === key
      );
      if (updatedProd) {
        broadcastReconcileChange({
          tableId: 'products',
          action: 'RECONCILE',
          key: updatedProd.codigo || updatedProd.id,
          item: updatedProd
        });
      }
    });
  } catch (_) {}

  const invoicePayload = buildProfitInvoicePayloadFromSale(
    localSale,
    saleData.vendedorId || saleData.vendedorCoVen || localSale.vendedorId || ''
  );
  if (invoicePayload) {
    saveSupabaseProfitInvoice(invoicePayload, { skipSalesSync: true }).catch(() => {});
  }
};

export const reserveServerCorrelativo = async ({ tipoDoc = 'FACTURA', preferredNum = null, clientId = null } = {}) => {
  if (isTestEnv || !isNetworkOnline() || typeof fetch === 'undefined' || !currentBackendUrl) {
    return null;
  }
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tid = controller ? setTimeout(() => controller.abort(), 15000) : null;
    const base = String(currentBackendUrl).replace(/\/+$/, '');
    const res = await dynamicSupabaseFetch(`${base}/correlativos/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        tipoDoc,
        preferredNum,
        clientId: clientId || (typeof getRealtimeClientId === 'function' ? getRealtimeClientId() : 'web')
      }),
      signal: controller?.signal
    });
    if (tid) clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.correlativo) return data;
  } catch (_) {}
  return null;
};

export const processSupabaseSale = async (saleData) => {
  if (!isSupabaseAvailable) {
    const localSale = saveStorageSale(saleData);
    syncOfflineSaleInventoryAndCxc(localSale, saleData);
    return localSale;
  }
  let savedSale = null;
  let lastAttemptedSale = null;
  try {
    const isNotaEntrega =
      String(saleData.tipoDoc || '').toUpperCase() === 'NOTA_ENTREGA' ||
      String(saleData.numeroDoc || saleData.id || '').toUpperCase().startsWith('NE-') ||
      String(saleData.pedidoOrigenDoc || '').toUpperCase().startsWith('PED-NE') ||
      saleData.modalidadVenta === 'OFICINA' ||
      saleData.almacen === '02' ||
      saleData.co_alma === '02';
    const effectiveTipoDoc = isNotaEntrega ? 'NOTA_ENTREGA' : (saleData.tipoDoc || 'FACTURA');
    if (!saleData.skipStockAdjustment) {
      let stockCatalog = getStorageProducts();
      try {
        const fetchedProds = await getSupabaseProducts();
        if (Array.isArray(fetchedProds) && fetchedProds.length > 0) stockCatalog = fetchedProds;
      } catch (_) {}
      const stockCheck = validateWarehouseStockForDocument({
        ...saleData,
        tipoDoc: effectiveTipoDoc,
        items: saleData.items || [],
        products: stockCatalog
      });
      if (!stockCheck.isValid) {
        const err = new Error(stockCheck.message);
        err.isValidationError = true;
        err.code = 'INSUFFICIENT_WAREHOUSE_STOCK';
        throw err;
      }
    }
    const isCredit =
      isCreditPaymentCondition(saleData.condicionPago, saleData.metodoPago) ||
      Number(saleData.diasCredito || 0) > 0;
    // Todo lo emitido en Factura o Nota de Entrega (incluso de contado) genera CxC sin ingresar directo a Caja
    const sendToReceivables =
      isCredit ||
      effectiveTipoDoc === 'FACTURA' ||
      effectiveTipoDoc === 'NOTA_ENTREGA';
    const docPrefix = effectiveTipoDoc === 'NOTA_CREDITO' ? 'NC' : (effectiveTipoDoc === 'NOTA_DEBITO' ? 'ND' : (effectiveTipoDoc === 'NOTA_ENTREGA' ? 'NE' : 'FACT'));

    const [config, salesRes, invoicesRes] = await Promise.all([
      getSupabaseConfig(),
      withTimeout(supabase.from('sales').select('id,numero_doc,tipo_doc,fecha,fecha_emision,pedido_origen_id,pedido_origen_doc,estado,created_at,updated_at')),
      withTimeout(supabase.from('profit_invoices').select('id,fact_num,factNum,tipo_doc,tipoDoc,fechaEmision,fec_emis')).catch(() => ({ data: [] }))
    ]);
    if (salesRes?.error) throw salesRes.error;
    const dbSales = salesRes?.data || [];
    const delSet = new Set(sanitizeCxcDeletedDocsStorage());
    const activeDbSales = dbSales.filter(s => s && !isCxcEntryDeleted(s, delSet));
    const count = Array.isArray(dbSales) ? dbSales.length : 0;
    const originOrderId = String(saleData.pedidoOrigenId || saleData.orderId || saleData.pedido_origen_id || '').trim();
    const originOrderDoc = String(saleData.pedidoOrigenDoc || saleData.pedido_origen_doc || '').trim();
    const incomingIdUpper = String(saleData.id || '').trim().toUpperCase();
    const incomingNumUpper = String(saleData.numeroDoc || saleData.numero_doc || '').trim().toUpperCase();
    if (originOrderId || originOrderDoc) {
      const alreadyInvoicedSale = activeDbSales.find(
        s => {
          if (!s) return false;
          if (['ANULADA', 'ANULADO'].includes(String(s.estado || '').toUpperCase().trim())) return false;
          const sIdUpper = String(s.id || '').trim().toUpperCase();
          const sNumUpper = String(s.numero_doc || s.numeroDoc || '').trim().toUpperCase();
          if ((incomingIdUpper && sIdUpper === incomingIdUpper) ||
              (incomingNumUpper && sNumUpper === incomingNumUpper)) {
            return false;
          }
          const sOriginId = String(s.pedido_origen_id || s.pedidoOrigenId || '').trim();
          const sOriginDoc = String(s.pedido_origen_doc || s.pedidoOrigenDoc || '').trim();
          return (originOrderId && sOriginId === originOrderId) ||
                 (originOrderDoc && sOriginDoc === originOrderDoc) ||
                 (originOrderId && sOriginDoc === originOrderId) ||
                 (originOrderDoc && sOriginId === originOrderDoc);
        }
      );
      if (alreadyInvoicedSale) {
        const dupErr = new Error(
          `El pedido ${originOrderDoc || originOrderId} ya fue facturado previamente (#${alreadyInvoicedSale.numero_doc || alreadyInvoicedSale.id}).`
        );
        dupErr.isValidationError = true;
        dupErr.code = 'ORDER_ALREADY_INVOICED';
        throw dupErr;
      }

      // Validación cruzada contra la tabla de pedidos (orders)
      try {
        const queryFilter = [
          originOrderId ? `id.eq.${originOrderId}` : null,
          originOrderDoc ? `numero_doc.eq.${originOrderDoc}` : null,
          originOrderId ? `numero_doc.eq.${originOrderId}` : null
        ].filter(Boolean).join(',');
        if (queryFilter) {
          const { data: matchedOrders } = await withTimeout(
            supabase.from('orders').select('id,numero_doc,status,nro_factura,factura_id').or(queryFilter)
          );
          const alreadyBilledOrder = (matchedOrders || []).find(o => {
            if (!o || String(o.status || '').toUpperCase().trim() !== 'FACTURADO') return false;
            const ordNro = String(o.nro_factura || o.nroFactura || '').trim();
            const ordFacId = String(o.factura_id || o.facturaId || '').trim();
            if ((ordNro || ordFacId) && isCxcEntryDeleted({
              id: ordFacId || ordNro,
              numeroDoc: ordNro,
              factNum: ordNro,
              tipoDoc: effectiveTipoDoc
            }, delSet)) {
              return false;
            }
            return true;
          });
          if (alreadyBilledOrder) {
            const dupErr = new Error(
              `El pedido ${alreadyBilledOrder.numero_doc || alreadyBilledOrder.id} ya se encuentra en estado FACTURADO (#${alreadyBilledOrder.nro_factura || 'N/A'}).`
            );
            dupErr.isValidationError = true;
            dupErr.code = 'ORDER_ALREADY_INVOICED';
            throw dupErr;
          }
        }
      } catch (orderCheckErr) {
        if (orderCheckErr.code === 'ORDER_ALREADY_INVOICED') throw orderCheckErr;
      }
    }

    const mappedSales = dbSales.map(s => ({
      id: s.id,
      numeroDoc: s.numero_doc,
      tipoDoc: s.tipo_doc,
      fecha: s.fecha || s.fecha_emision,
      fechaEmision: s.fecha_emision || s.fecha
    }));
    const dbInvoices = invoicesRes?.data || [];

    let resolvedNumeroDoc = saleData.numeroDoc;

    const usedCanonKeys = new Set([
      ...mappedSales.map(s => getEraScopedCanonicalDocKey(s)).filter(Boolean),
      ...(dbInvoices.map(inv => getEraScopedCanonicalDocKey(inv)).filter(Boolean))
    ]);

    if (
      !resolvedNumeroDoc ||
      usedCanonKeys.has(getEraScopedCanonicalDocKey(resolvedNumeroDoc, effectiveTipoDoc))
    ) {
      if (effectiveTipoDoc === 'FACTURA') {
        resolvedNumeroDoc = getNextInvoiceCorrelativo(mappedSales, dbInvoices);
      } else {
        resolvedNumeroDoc = getNextNotaEntregaCorrelativo(mappedSales, dbInvoices, docPrefix);
      }
    } else if (isNotaEntrega && !String(resolvedNumeroDoc).toUpperCase().startsWith('NE-')) {
      resolvedNumeroDoc = `NE-${resolvedNumeroDoc}`;
    }

    // Reserva atómica en servidor para evitar colisión si dos cajas emiten al mismo tiempo
    const reservedInfo = await reserveServerCorrelativo({
      tipoDoc: effectiveTipoDoc,
      preferredNum: resolvedNumeroDoc
    });
    if (reservedInfo?.correlativo) {
      resolvedNumeroDoc = reservedInfo.correlativo;
    }

    const itemsConLitros = (saleData.items || []).map(item => ({
      ...item,
      litros: item.litros || (item.cantidad * (item.litrosPorUnidad || 0))
    }));

    const taxes = calculateFiscalTaxes({
      items: itemsConLitros,
      tipoDoc: effectiveTipoDoc,
      metodoPago: saleData.metodoPago || 'EFECTIVO_USD',
      condicionPago: saleData.condicionPago || 'CONTADO',
      tasaBcv: config.tasaDolar,
      porcentajeRetencionIva: saleData.porcentajeRetencionIva ?? 0,
      // La factura no se cobra al momento de emitirse (pasa a CxC), por lo que no aplica IGTF en emisión
      esSujetoPasivoEspecial: false,
      porcentajeIgtf: 0
    });

    const effectiveDiasCredito = saleData.diasCredito || (isCredit ? (resolveCreditDaysFromTerm(saleData.condicionPago) || 15) : 0);
    const effectiveFechaEmision = saleData.fechaEmision || saleData.fecha || new Date().toISOString();
    const effectiveFechaVencimiento = saleData.fechaVencimiento || (
      isCredit
        ? calculateExpirationDate(effectiveFechaEmision, effectiveDiasCredito).toISOString()
        : (sendToReceivables ? effectiveFechaEmision : null)
    );

    const buildSaleCandidate = (numDocStr, useExplicitControl = true) => {
      const candidateId =
        effectiveTipoDoc === 'FACTURA' || String(numDocStr).toUpperCase().startsWith(`${docPrefix}-`)
          ? numDocStr
          : `${docPrefix}-${numDocStr}`;
      const ctrlDigits = parseInt(String(numDocStr).replace(/[^0-9]/g, ''), 10);
      return {
        id: candidateId,
        numeroDoc: numDocStr,
        numeroControl:
          (useExplicitControl && saleData.numeroControl) ||
          (isNotaEntrega
            ? generateDeliveryNoteControlNumber(!isNaN(ctrlDigits) ? ctrlDigits : ((count || 0) + 1))
            : generateFiscalControlNumber(!isNaN(ctrlDigits) ? ctrlDigits : ((count || 0) + 1))),
        tipoDoc: effectiveTipoDoc,
        documentoAfectado: saleData.documentoAfectado || '',
        fecha: effectiveFechaEmision,
        fechaEmision: effectiveFechaEmision,
        fechaVencimiento: effectiveFechaVencimiento,
        diasCredito: effectiveDiasCredito,
        clienteId: saleData.clienteId || 'CLI-003',
        clienteNombre: saleData.clienteNombre || 'CLIENTE CONTADO / MOSTRADOR OILSTONE',
        clienteRif: saleData.clienteRif || 'V-18456789-6',
        clienteDireccion: saleData.clienteDireccion || saleData.direccion || '',
        tasaDolar: config.tasaDolar,
        condicionPago: saleData.condicionPago || (isCredit ? 'CREDITO' : 'CONTADO'),
        items: itemsConLitros,
        subtotalUsd: taxes.subtotalNetoUsd,
        baseExentaUsd: taxes.baseExentaUsd,
        baseGeneralUsd: taxes.baseGeneralUsd,
        ivaGeneralUsd: taxes.ivaGeneralUsd,
        baseReducidaUsd: taxes.baseReducidaUsd,
        ivaReducidaUsd: taxes.ivaReducidoUsd,
        baseAdicionalUsd: taxes.baseAdicionalUsd,
        ivaAdicionalUsd: taxes.ivaAdicionalUsd,
        ivaUsd: taxes.totalIvaUsd,
        igtfUsd: taxes.igtfUsd,
        totalUsd: taxes.totalFacturaUsd,
        subtotalBs: taxes.subtotalNetoBs,
        baseExentaBs: taxes.baseExentaBs,
        baseGeneralBs: taxes.baseGeneralBs,
        ivaGeneralBs: taxes.ivaGeneralBs,
        baseReducidaBs: taxes.baseReducidaBs,
        ivaReducidaBs: taxes.ivaReducidoBs,
        baseAdicionalBs: taxes.baseAdicionalBs,
        ivaAdicionalBs: taxes.ivaAdicionalBs,
        ivaBs: taxes.totalIvaBs,
        igtfBs: taxes.igtfBs,
        totalBs: taxes.totalFacturaBs,
        saldoUsd: sendToReceivables && effectiveTipoDoc !== 'NOTA_CREDITO'
          ? (isNotaEntrega ? taxes.subtotalNetoUsd : (Number(saleData.saldoUsd) > 0 ? Number(saleData.saldoUsd) : taxes.totalFacturaUsd))
          : 0,
        saldoBs: sendToReceivables && effectiveTipoDoc !== 'NOTA_CREDITO'
          ? (isNotaEntrega ? taxes.subtotalNetoBs : (Number(saleData.saldoBs) > 0 ? Number(saleData.saldoBs) : taxes.totalFacturaBs))
          : 0,
        retencionIvaBs: taxes.retencionIvaBs,
        comprobanteRetencionIva: saleData.comprobanteRetencionIva || '',
        estado: sendToReceivables ? 'PENDIENTE' : 'PAGADO',
        metodoPago: saleData.metodoPago || 'EFECTIVO_USD',
        tipoTasa: normalizeRateType(saleData.tipoTasa ?? saleData.tipo_tasa, {
          tipoDoc: effectiveTipoDoc,
          monedaPago: saleData.monedaPago ?? saleData.moneda_pago,
          fallback: 'BCV'
        }),
        tasaPago: Number(saleData.tasaPago ?? saleData.tasa_pago ?? config.tasaDolar ?? 1),
        monedaPago: saleData.monedaPago || saleData.moneda_pago || (String(saleData.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
        vendedor: saleData.vendedor || 'Usuario Sistema',
        pedidoOrigenId: originOrderId || null,
        pedidoOrigenDoc: saleData.pedidoOrigenDoc || null
      };
    };

    // Blindaje anti-doble facturación: verificar estado real de la orden en servidor antes de insertar o descontar stock
    if (originOrderId && isNetworkOnline()) {
      try {
        const { data: srvOrder, error: srvOrdErr } = await withTimeout(
          supabase
            .from('orders')
            .select('id,estado,status,nro_factura,factura_id')
            .eq('id', originOrderId)
            .maybeSingle(),
          4000
        );
        if (!srvOrdErr && srvOrder) {
          const srvOrdState = String(srvOrder.estado || srvOrder.status || '').toUpperCase().trim();
          if (srvOrdState === 'FACTURADO' || srvOrdState === 'ANULADO' || srvOrdState === 'ANULADA') {
            const existingRef = srvOrder.nro_factura || srvOrder.factura_id || '';
            const orderDupErr = new Error(
              srvOrdState === 'FACTURADO'
                ? `Este pedido ya fue facturado previamente${existingRef ? ` (${existingRef})` : ''}.`
                : 'Este pedido se encuentra ANULADO y no puede facturarse.'
            );
            orderDupErr.isValidationError = true;
            orderDupErr.code = 'ORDER_ALREADY_INVOICED';
            throw orderDupErr;
          }
        }
      } catch (ordCheckErr) {
        if (ordCheckErr?.isValidationError) throw ordCheckErr;
      }
    }

    // Insertar venta primero con reintento automático si otro equipo tomó el mismo correlativo (HTTP 409 / 23505),
    // antes de descontar inventario o registrar movimientos en caja/saldo cliente.
    let newSale = buildSaleCandidate(resolvedNumeroDoc, true);
    lastAttemptedSale = newSale;
    savedSale = null;
    let saleErr = null;
    const attemptedIds = new Set();
    const attemptedDocNums = new Set();
    for (let attempt = 0; attempt < 3; attempt++) {
      lastAttemptedSale = newSale;
      if (newSale?.id) attemptedIds.add(String(newSale.id).trim());
      if (newSale?.numeroDoc) attemptedDocNums.add(String(newSale.numeroDoc).trim());
      let insertRes = null;
      try {
        insertRes = await withTimeout(
          supabase
            .from('sales')
            .insert(mapSaleToDb(newSale))
            .select()
            .single()
        );
      } catch (insertThrowErr) {
        const lookupParts = [
          newSale?.id ? `id.eq.${newSale.id}` : null,
          originOrderId ? `pedido_origen_id.eq.${originOrderId}` : null
        ].filter(Boolean).join(',');
        if (lookupParts) {
          const { data: recoveredRows } = await withTimeout(
            supabase.from('sales').select('*').or(lookupParts),
            5000
          ).catch(() => ({ data: null }));
          const recovered = Array.isArray(recoveredRows)
            ? recoveredRows.find(r =>
                r &&
                !['ANULADA', 'ANULADO'].includes(String(r.estado || '').toUpperCase().trim()) &&
                (attemptedIds.has(String(r.id || '').trim()) || attemptedDocNums.has(String(r.numero_doc || r.numeroDoc || '').trim()))
              )
            : null;
          if (recovered) {
            savedSale = recovered;
            saleErr = null;
            break;
          }
        }
        throw insertThrowErr;
      }
      savedSale = insertRes?.data || null;
      saleErr = insertRes?.error || null;
      if (!saleErr) break;

      const isOrderDup = saleErr?.errorCode === 'ORDER_ALREADY_INVOICED' || String(saleErr?.message || '').includes('ya fue facturado previamente');
      if (isOrderDup) {
        const existingId = String(saleErr?.existingId || '').trim();
        const existingNumeroDoc = String(saleErr?.existingNumeroDoc || '').trim();
        if (attempt > 0 || (existingId && attemptedIds.has(existingId)) || (existingNumeroDoc && attemptedDocNums.has(existingNumeroDoc))) {
          const lookupParts = [
            existingId ? `id.eq.${existingId}` : null,
            originOrderId ? `pedido_origen_id.eq.${originOrderId}` : null
          ].filter(Boolean).join(',');
          if (lookupParts) {
            const { data: recoveredRows } = await withTimeout(
              supabase.from('sales').select('*').or(lookupParts),
              5000
            ).catch(() => ({ data: null }));
            const recovered = Array.isArray(recoveredRows)
              ? recoveredRows.find(r =>
                  r &&
                  !['ANULADA', 'ANULADO'].includes(String(r.estado || '').toUpperCase().trim()) &&
                  (attemptedIds.has(String(r.id || '').trim()) || attemptedDocNums.has(String(r.numero_doc || r.numeroDoc || '').trim()))
                )
              : null;
            if (recovered) {
              savedSale = recovered;
              saleErr = null;
              break;
            }
          }
        }
        const orderDupErr = new Error(saleErr.message || 'El pedido ya fue facturado previamente.');
        orderDupErr.isValidationError = true;
        orderDupErr.code = 'ORDER_ALREADY_INVOICED';
        throw orderDupErr;
      }

      const isCorrDup = saleErr?.code === '23505' || saleErr?.status === 409 || String(saleErr?.errorCode || '').includes('DUPLICATE');
      if (!isCorrDup || attempt === 2) break;

      const nextReserved = await reserveServerCorrelativo({
        tipoDoc: effectiveTipoDoc,
        preferredNum: null,
        clientId: `${getRealtimeClientId()}_r${attempt + 1}`
      });
      if (nextReserved?.correlativo) {
        resolvedNumeroDoc = nextReserved.correlativo;
      } else {
        const retrySalesRes = await withTimeout(supabase.from('sales').select('id,numero_doc,tipo_doc,fecha,fecha_emision')).catch(() => ({ data: activeDbSales }));
        const retryList = (retrySalesRes?.data || activeDbSales).map(s => ({
          id: s.id,
          numeroDoc: s.numero_doc,
          tipoDoc: s.tipo_doc,
          fecha: s.fecha || s.fecha_emision,
          fechaEmision: s.fecha_emision || s.fecha
        }));
        resolvedNumeroDoc = effectiveTipoDoc === 'FACTURA'
          ? getNextInvoiceCorrelativo(retryList, dbInvoices)
          : getNextNotaEntregaCorrelativo(retryList, dbInvoices, docPrefix);
      }
      newSale = buildSaleCandidate(resolvedNumeroDoc, false);
    }

    if (saleErr) throw saleErr;

    // Limpiar posible marca previa de borrado en CxC si se reutiliza un correlativo nuevo
    unmarkCxcDeletedDoc(newSale);

    // Ejecutar ajuste de inventario y movimiento de caja / saldo cliente tras confirmar la inserción en sales
    const saleDeductKey = buildSaleDeductIdempotencyKey(newSale);
    const stockPromise = saleData.skipStockAdjustment
      ? Promise.resolve([])
      : adjustSupabaseProductsStockForSale(newSale, {
          reverse: false,
          idempotencyKey: saleDeductKey
        }).catch(stockErr => {
          console.warn('[processSupabaseSale] Aviso ajustando inventario tras venta confirmada:', stockErr?.message || stockErr);
          try {
            const deltaLines = buildSaleStockDeltaLines(newSale, { reverse: false });
            if (deltaLines.length > 0) {
              enqueueSyncAction('stock_delta', 'UPDATE', {
                id: saleDeductKey,
                idempotencyKey: saleDeductKey,
                lines: deltaLines,
                validateStrict: false,
                alreadyAppliedLocally: false
              });
            }
          } catch (_) {}
        });

    const accountOrCashPromise = !sendToReceivables
      ? (newSale.tipoDoc === 'NOTA_CREDITO'
          ? addSupabaseCashMovement({
              tipo: 'EGRESO',
              categoria: 'VENTAS',
              referencia: newSale.id || newSale.numeroDoc,
              concepto: `Devolución / NC ${newSale.numeroDoc} a ${newSale.clienteNombre} (Afecta: ${newSale.documentoAfectado || 'N/A'})`,
              montoUsd: newSale.totalUsd,
              montoBs: newSale.totalBs,
              metodo: newSale.metodoPago,
              usuario: newSale.vendedor
            }).catch(cashErr => {
              console.warn('[processSupabaseSale] Aviso registrando movimiento de caja NC:', cashErr?.message || cashErr);
            })
          : Promise.resolve(null))
      : (async () => {
          const { data: clientData, error: clientErr } = await withTimeout(
            supabase
              .from('clients')
              .select('saldo_deudor_usd')
              .eq('id', newSale.clienteId)
              .single(),
            6000
          );

          if (!clientErr && clientData) {
            const currentDebit = Number(clientData.saldo_deudor_usd || 0);
            const receivableDelta = Number(newSale.saldoUsd ?? (isNotaEntrega ? newSale.subtotalUsd : newSale.totalUsd) ?? 0);
            const newDebit = newSale.tipoDoc === 'NOTA_CREDITO'
              ? Math.max(0, Number((currentDebit - newSale.totalUsd).toFixed(2)))
              : Number((currentDebit + receivableDelta).toFixed(2));
            await withTimeout(
              supabase
                .from('clients')
                .update({ saldo_deudor_usd: newDebit })
                .eq('id', newSale.clienteId),
              6000
            );
            try {
              const localCli = getStorageClients().find(c => c.id === newSale.clienteId);
              if (localCli) {
                saveStorageClient({ ...localCli, saldoDeudorUsd: newDebit });
              }
            } catch (_) {}
            broadcastReconcileChange({
              tableId: 'clients',
              action: 'RECONCILE',
              key: newSale.clienteId,
              item: { id: newSale.clienteId, saldoDeudorUsd: newDebit }
            });
          }
        })().catch(cliErr => {
          console.warn('[processSupabaseSale] Aviso actualizando saldo cliente tras venta confirmada:', cliErr?.message || cliErr);
        });

    await Promise.all([stockPromise, accountOrCashPromise]);
    isSupabaseAvailable = true;
    const mapped = mapSaleFromDb(savedSale);
    if (effectiveTipoDoc === 'FACTURA') {
      commitInvoiceCorrelativo(mapped.numeroDoc || resolvedNumeroDoc);
    } else if (effectiveTipoDoc === 'NOTA_ENTREGA') {
      commitNotaEntregaCorrelativo(mapped.numeroDoc || resolvedNumeroDoc);
    }
    // Sincronizar en almacenamiento local (el stock ya fue ajustado arriba desde Supabase)
    try {
      saveStorageSale(mapped, { skipStockAdjustment: true, skipDuplicateOrderCheck: true });
    } catch (cacheErr) {
      console.warn('[processSupabaseSale] Aviso sincronizando venta en caché local:', cacheErr?.message || cacheErr);
    }

    broadcastReconcileChange({
      tableId: 'sales',
      action: 'CREATE',
      key: mapped.numeroDoc || mapped.id,
      item: mapped
    });

    // Reflejo en tiempo real simultáneo en profit_invoices sin re-actualizar sales (acabamos de insertarlo)
    try {
      const invoicePayload = buildProfitInvoicePayloadFromSale(
        mapped,
        saleData.vendedorId || saleData.vendedorCoVen || mapped.vendedorId || ''
      );
      if (invoicePayload) {
        await saveSupabaseProfitInvoice(invoicePayload, { skipSalesSync: true });
      }
    } catch (invErr) {
      console.warn('[processSupabaseSale] Aviso sincronizando factura en profit_invoices:', invErr?.message);
    }

    return mapped;
  } catch (err) {
    if (savedSale) {
      return mapSaleFromDb(savedSale);
    }
    if (err?.isValidationError || err?.code === 'INSUFFICIENT_WAREHOUSE_STOCK') {
      throw err;
    }
    console.warn("Fallo o indisponibilidad en Supabase procesando venta, ejecutando fallback local:", err);
    markSupabaseOffline(err, 'processSupabaseSale');
    const offlineFallbackPayload = lastAttemptedSale
      ? {
          ...saleData,
          id: lastAttemptedSale.id || saleData.id,
          numeroDoc: lastAttemptedSale.numeroDoc || saleData.numeroDoc,
          numeroControl: lastAttemptedSale.numeroControl || saleData.numeroControl,
          tipoDoc: lastAttemptedSale.tipoDoc || saleData.tipoDoc
        }
      : saleData;
    const localSale = saveStorageSale(offlineFallbackPayload);
    syncOfflineSaleInventoryAndCxc(localSale, offlineFallbackPayload);
    return localSale;
  }
};

// Purchases
export const getSupabasePurchases = async () => {
  if (!isSupabaseAvailable) return filterDeletedPurchases(getStoragePurchases());
  try {
    const { data, error } = await withTimeout(
      supabase.from('purchases').select('*').order('fecha', { ascending: false })
    );

    if (error) {
      if (error) markSupabaseOffline(error, 'getSupabasePurchases');
      return filterDeletedPurchases(getStoragePurchases());
    }
    isSupabaseAvailable = true;
    const mapped = filterDeletedPurchases((data || []).map(mapPurchaseFromDb));
    try {
      localStorage.setItem('sm_purchases_v4_fiscal', JSON.stringify(mapped));
    } catch (_) {}
    return mapped;
  } catch (err) {
    markSupabaseOffline(err, 'getSupabasePurchases');
    return filterDeletedPurchases(getStoragePurchases());
  }
};

const LEGACY_PURCHASE_OPT_COLS = [
  'almacen', 'almacen_nombre', 'condicion_pago', 'dias_credito',
  'flete_usd', 'flete_bs', 'base_reducida_usd', 'iva_reducida_usd',
  'base_reducida_bs', 'iva_reducida_bs', 'monto_neto_pagar_usd',
  'recepcion_id', 'stock_aplicado'
];

async function upsertPurchaseRowWithSchemaFallback(payload) {
  let { data, error } = await withTimeout(
    supabase.from('purchases').upsert([payload], { onConflict: 'id' }).select().single(),
    5000
  );
  if (error && (String(error.code || '') === 'PGRST204' || /column .* does not exist|schema cache/i.test(String(error.message || '')))) {
    const legacyPayload = { ...payload };
    LEGACY_PURCHASE_OPT_COLS.forEach(col => { delete legacyPayload[col]; });
    const retry = await withTimeout(
      supabase.from('purchases').upsert([legacyPayload], { onConflict: 'id' }).select().single(),
      5000
    );
    data = retry.data;
    error = retry.error;
  }
  return { data, error };
}

export const saveSupabasePurchase = async (purchaseData) => {
  // 1. Guardar primero en almacenamiento local (incluye almacen, flete, base reducida, condicionPago, items y ID único)
  let localSaved = saveStoragePurchase(purchaseData);

  // 2. Aplicar delta atómico de stock por almacén (01 o 02) evitando doble entrada si viene vinculada a una Recepción (REC)
  const tipoDocNorm = String(localSaved.tipoDoc || 'FACTURA').toUpperCase();
  const isNc = tipoDocNorm === 'NOTA_CREDITO';
  const shouldApplyStock = !purchaseData?.skipStockApply && !purchaseData?.recepcionId && localSaved.stockAplicado !== true;

  if (shouldApplyStock) {
    const itemsList = Array.isArray(localSaved.items) && localSaved.items.length > 0 ? localSaved.items : [];
    const defaultAlm = String(localSaved.almacen || '01').includes('02') ? '02' : '01';
    const stockLines = [];

    itemsList.forEach((it) => {
      const qty = Number(it.cantidad || 0);
      const code = resolveStockItemProductKey(it);
      if (!code || !(qty > 0)) return;
      const lineAlm = String(it.almacen || defaultAlm).includes('02') ? '02' : '01';
      const signedQty = isNc ? -qty : qty;
      stockLines.push({
        codigo: code,
        delta01: lineAlm === '01' ? signedQty : 0,
        delta02: lineAlm === '02' ? signedQty : 0,
        costoUnitarioUsd: Number(it.costoUnitarioUsd ?? localSaved.costoUnitarioUsd ?? 0)
      });
    });

    if (stockLines.length > 0) {
      await applyStockDeltaForWarehouseLines(stockLines, {
        validateStrict: isNc,
        idempotencyKey: `purchase_${localSaved.id}_stock`
      });

      // Actualizar costo unitario del producto si aplica (compras regulares)
      if (!isNc) {
        const storageProds = getStorageProducts();
        const nowIso = new Date().toISOString();
        for (const sl of stockLines) {
          if (!(sl.costoUnitarioUsd > 0)) continue;
          const targetProd = storageProds.find(p => String(p.id) === sl.codigo || String(p.codigo) === sl.codigo);
          if (!targetProd) continue;
          const nextCost = Number(sl.costoUnitarioUsd.toFixed(2));
          saveStorageProduct({ ...targetProd, costoUsd: nextCost, costo_usd: nextCost, costo: nextCost });
          if (isNetworkOnline() && isSupabaseAvailable) {
            try {
              await withTimeout(
                supabase.from('products').update({ costo_usd: nextCost, costoUsd: nextCost, costo: nextCost, updated_at: nowIso }).eq('id', targetProd.id),
                4000
              );
            } catch (_) {}
          }
        }
      }

      const patched = updateStoragePurchase(localSaved.id, { stockAplicado: true });
      if (patched) localSaved = patched;
    }
  }

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('purchase', 'INSERT', localSaved);
    return localSaved;
  }

  try {
    const payload = mapPurchaseToDb(localSaved);
    const { data: saved, error: err } = await upsertPurchaseRowWithSchemaFallback(payload);

    if (err) throw err;
    isSupabaseAvailable = true;
    const mapped = mapPurchaseFromDb(saved);
    return {
      ...localSaved,
      ...mapped,
      id: mapped?.id || localSaved.id,
      almacen: mapped?.almacen || localSaved.almacen,
      almacenNombre: mapped?.almacenNombre || localSaved.almacenNombre,
      fleteUsd: mapped?.fleteUsd || localSaved.fleteUsd,
      montoNetoPagarUsd: mapped?.montoNetoPagarUsd || localSaved.montoNetoPagarUsd,
      stockAplicado: Boolean(mapped?.stockAplicado || localSaved.stockAplicado),
      items: (mapped?.items && mapped.items.length > 0) ? mapped.items : localSaved.items
    };
  } catch (err) {
    markSupabaseOffline(err, 'saveSupabasePurchase');
    enqueueSyncAction('purchase', 'INSERT', localSaved);
    return localSaved;
  }
};

export const PURCHASES_DELETED_KEY = 'sm_deleted_purchases_v1';

const getDeletedPurchaseIds = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PURCHASES_DELETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(id => String(id || '').trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
};

const markPurchaseDeleted = (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId || typeof localStorage === 'undefined') return;
  try {
    const list = getDeletedPurchaseIds();
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      localStorage.setItem(PURCHASES_DELETED_KEY, JSON.stringify(list));
    }
  } catch (_) {}
};

export const filterDeletedPurchases = (list = []) => {
  const delSet = new Set(getDeletedPurchaseIds());
  if (delSet.size === 0) return Array.isArray(list) ? list : [];
  return (Array.isArray(list) ? list : []).filter(p => p && !delSet.has(String(p.id || '').trim()));
};

export const updateSupabasePurchase = async (purchaseId, purchaseData = {}) => {
  const cleanId = String(purchaseId || purchaseData?.id || '').trim();
  if (!cleanId) throw new Error('ID de compra inválido para actualizar.');
  const nowIso = new Date().toISOString();
  const prevRecord = purchaseData?._prevRecord || getStoragePurchases().find(p => p && String(p.id || '').trim() === cleanId) || null;
  const { _prevRecord, ...cleanPatch } = purchaseData;
  const nextPayload = {
    ...(prevRecord || {}),
    ...cleanPatch,
    id: cleanId,
    updatedAt: nowIso
  };
  let updatedLocal = updateStoragePurchase(cleanId, nextPayload) || nextPayload;

  // Ajustar delta de stock por almacén si cambiaron cantidades/ítems
  if (prevRecord && Array.isArray(nextPayload.items)) {
    const oldDefAlm = String(prevRecord.almacen || '01').includes('02') ? '02' : '01';
    const newDefAlm = String(nextPayload.almacen || '01').includes('02') ? '02' : '01';
    const isOldNc = String(prevRecord.tipoDoc || 'FACTURA').toUpperCase() === 'NOTA_CREDITO';
    const isNewNc = String(nextPayload.tipoDoc || 'FACTURA').toUpperCase() === 'NOTA_CREDITO';
    const acc = new Map();
    const addMap = (items, defAlm, sign) => {
      for (const it of (Array.isArray(items) ? items : [])) {
        const code = resolveStockItemProductKey(it);
        const qty = Number(it?.cantidad || 0);
        if (!code || !(qty > 0)) continue;
        const alm = String(it?.almacen || defAlm).includes('02') ? '02' : '01';
        const prev = acc.get(code) || { codigo: code, delta01: 0, delta02: 0 };
        if (alm === '01') prev.delta01 += sign * qty;
        else prev.delta02 += sign * qty;
        acc.set(code, prev);
      }
    };
    addMap(prevRecord.items, oldDefAlm, isOldNc ? 1 : -1);
    addMap(nextPayload.items, newDefAlm, isNewNc ? -1 : 1);
    const deltaLines = Array.from(acc.values())
      .map(l => ({ codigo: l.codigo, delta01: Number(l.delta01.toFixed(4)), delta02: Number(l.delta02.toFixed(4)) }))
      .filter(l => l.delta01 !== 0 || l.delta02 !== 0);
    if (deltaLines.length > 0) {
      await applyStockDeltaForWarehouseLines(deltaLines, { validateStrict: false });
    }
  }

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('purchase', 'UPDATE', updatedLocal);
    return updatedLocal;
  }

  try {
    const dbPayload = mapPurchaseToDb(updatedLocal);
    const { data: saved, error: err } = await upsertPurchaseRowWithSchemaFallback(dbPayload);
    if (err) throw err;
    isSupabaseAvailable = true;
    const mapped = saved?.id ? mapPurchaseFromDb(saved) : null;
    return mapped ? { ...updatedLocal, ...mapped, id: mapped.id || updatedLocal.id, updatedAt: updatedLocal.updatedAt } : updatedLocal;
  } catch (err) {
    markSupabaseOffline(err, 'updateSupabasePurchase');
    enqueueSyncAction('purchase', 'UPDATE', updatedLocal);
    return updatedLocal;
  }
};

export const deleteSupabasePurchase = async (purchaseOrId) => {
  const cleanId = typeof purchaseOrId === 'object' ? String(purchaseOrId?.id || '').trim() : String(purchaseOrId || '').trim();
  if (!cleanId) return false;
  const target = (typeof purchaseOrId === 'object' && purchaseOrId)
    ? purchaseOrId
    : getStoragePurchases().find(p => p && String(p.id || '').trim() === cleanId);

  markPurchaseDeleted(cleanId);

  if (target && Array.isArray(target.items) && target.items.length > 0 && !target.skipStockAdjustment) {
    const defAlm = String(target.almacen || '01').includes('02') ? '02' : '01';
    const isNc = String(target.tipoDoc || 'FACTURA').toUpperCase() === 'NOTA_CREDITO';
    const revLines = [];
    for (const it of target.items) {
      const code = resolveStockItemProductKey(it);
      const qty = Number(it?.cantidad || 0);
      if (!code || !(qty > 0)) continue;
      const alm = String(it?.almacen || defAlm).includes('02') ? '02' : '01';
      const signed = isNc ? qty : -qty;
      revLines.push({ codigo: code, delta01: alm === '01' ? signed : 0, delta02: alm === '02' ? signed : 0 });
    }
    if (revLines.length > 0) {
      await applyStockDeltaForWarehouseLines(revLines, { validateStrict: false });
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const next = getStoragePurchases().filter(p => p && String(p.id || '').trim() !== cleanId);
      localStorage.setItem('sm_purchases_v4_fiscal', JSON.stringify(next));
    }
  } catch (_) {}

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('purchase', 'DELETE', { id: cleanId });
    return true;
  }

  try {
    const { error } = await withTimeout(supabase.from('purchases').delete().eq('id', cleanId), 5000);
    if (error) throw error;
    return true;
  } catch (err) {
    markSupabaseOffline(err, 'deleteSupabasePurchase');
    enqueueSyncAction('purchase', 'DELETE', { id: cleanId });
    return true;
  }
};

// Cash Movements
export const CASH_MOVEMENTS_DELETED_KEY = 'sm_deleted_cash_movements_v1';

const getDeletedCashMovementIds = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CASH_MOVEMENTS_DELETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((id) => String(id || '').trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
};

const markCashMovementDeleted = (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId || typeof localStorage === 'undefined') return;
  try {
    const list = getDeletedCashMovementIds();
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      localStorage.setItem(CASH_MOVEMENTS_DELETED_KEY, JSON.stringify(list));
    }
  } catch (_) {}
};

const unmarkCashMovementDeleted = (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId || typeof localStorage === 'undefined') return;
  try {
    const list = getDeletedCashMovementIds();
    const next = list.filter((x) => x !== cleanId);
    if (next.length !== list.length) {
      localStorage.setItem(CASH_MOVEMENTS_DELETED_KEY, JSON.stringify(next));
    }
  } catch (_) {}
};

const filterAndReconcileCashMovements = (rawList = [], hasRemoteResponse = false) => {
  const queue = getSyncQueue().filter((q) => q && q.entity === 'cash_movement');
  const pendingDeleteIds = new Set(
    queue
      .filter((q) => q.action === 'DELETE' && q.data?.id)
      .map((q) => String(q.data.id).trim())
  );

  let delIds = getDeletedCashMovementIds();
  if (hasRemoteResponse && delIds.length > 0 && Array.isArray(rawList)) {
    const remoteIdSet = new Set(
      rawList.map((m) => String(m?.id || '').trim()).filter(Boolean)
    );
    const pruned = delIds.filter((id) => remoteIdSet.has(id) || pendingDeleteIds.has(id));
    if (pruned.length !== delIds.length) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CASH_MOVEMENTS_DELETED_KEY, JSON.stringify(pruned));
        }
      } catch (_) {}
      delIds = pruned;
    }
  }

  const delSet = new Set([...delIds, ...pendingDeleteIds]);
  const applied = applyPendingQueueToEntities('cash_movement', Array.isArray(rawList) ? rawList : []);
  return dedupeCashMovements(applied).filter((m) => {
    const mId = String(m?.id || '').trim();
    return !mId || !delSet.has(mId);
  });
};

export const getSupabaseCashMovements = async () => {
  if (!isSupabaseAvailable) {
    return filterAndReconcileCashMovements(getStorageCashMovements(), false);
  }
  try {
    const { data, error } = await withTimeout(
      supabase.from('cash_movements').select('*').order('fecha', { ascending: false })
    );

    if (error) {
      markSupabaseOffline(error, 'getSupabaseCashMovements');
      return filterAndReconcileCashMovements(getStorageCashMovements(), false);
    }
    isSupabaseAvailable = true;
    const mapped = filterAndReconcileCashMovements((data || []).map(mapCashMovementFromDb), true);
    try {
      localStorage.setItem('sm_cash_movements_v4_fiscal', JSON.stringify(mapped));
    } catch (_) {}
    return mapped;
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseCashMovements');
    return filterAndReconcileCashMovements(getStorageCashMovements(), false);
  }
};

export const deleteCashMovementFromSupabaseDirect = async (movId) => {
  const cleanId = String(movId || '').trim();
  if (!cleanId) return true;
  const { error } = await withTimeout(
    supabase.from('cash_movements').delete().eq('id', cleanId),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const deleteSupabaseCashMovement = async (movOrId) => {
  const targetId = String(typeof movOrId === 'object' ? (movOrId?.id || '') : (movOrId || '')).trim();
  if (targetId) {
    markCashMovementDeleted(targetId);
  }
  const updatedLocal = filterAndReconcileCashMovements(deleteStorageCashMovement(movOrId), false);

  const emit = () => {
    if (!targetId) return;
    broadcastReconcileChange({
      tableId: 'cash_movements',
      action: 'DELETE',
      key: targetId,
      item: { id: targetId }
    });
  };

  if (!targetId) {
    return updatedLocal;
  }

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('cash_movement', 'DELETE', { id: targetId });
    emit();
    return updatedLocal;
  }

  try {
    await deleteCashMovementFromSupabaseDirect(targetId);
    emit();
    return updatedLocal;
  } catch (err) {
    console.warn('[Supabase] Encolando eliminación de movimiento de caja:', err?.message || err);
    markSupabaseOffline(err, 'deleteSupabaseCashMovement');
    enqueueSyncAction('cash_movement', 'DELETE', { id: targetId });
    emit();
    return updatedLocal;
  }
};

export const addSupabaseCashMovement = async (mov) => {
  if (!mov || typeof mov !== 'object' || Array.isArray(mov)) {
    throw new Error('Movimiento de caja inválido: se esperaba un objeto');
  }
  const concepto = String(mov.concepto || mov.descripcion || '').trim();
  const tipo = String(mov.tipo || 'INGRESO').trim().toUpperCase();
  const montoUsd = round2(mov.montoUsd ?? mov.monto_usd ?? 0);
  const montoBs = round2(mov.montoBs ?? mov.monto_bs ?? 0);
  if (!concepto) {
    throw new Error('El movimiento de caja requiere un concepto o descripción válida');
  }
  if (!['INGRESO', 'EGRESO'].includes(tipo)) {
    throw new Error(`Tipo de movimiento inválido: ${tipo}`);
  }
  if (montoUsd <= 0 && montoBs <= 0) {
    throw new Error('El monto del movimiento debe ser mayor a 0 en USD o Bolívares');
  }

  const uniqueId = mov?.id || `MOV-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  unmarkCashMovementDeleted(uniqueId);
  const cleanInput = {
    ...mov,
    id: uniqueId,
    fecha: mov.fecha || new Date().toISOString(),
    tipo,
    concepto,
    descripcion: mov.descripcion || concepto,
    montoUsd,
    monto_usd: montoUsd,
    montoBs,
    monto_bs: montoBs
  };
  const added = addStorageCashMovement(cleanInput);
  const localMov = (!added || Array.isArray(added)) ? cleanInput : added;

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('cash_movement', 'INSERT', localMov);
    broadcastReconcileChange({
      tableId: 'cash_movements',
      action: 'CREATE',
      key: localMov.id,
      item: localMov
    });
    return localMov;
  }

  try {
    const payload = mapCashMovementToDb(localMov);
    const { data, error } = await withTimeout(
      supabase.from('cash_movements').upsert([payload]).select().single()
    );

    if (error) throw error;
    isSupabaseAvailable = true;
    const mappedMov = mapCashMovementFromDb(data);
    broadcastReconcileChange({
      tableId: 'cash_movements',
      action: 'CREATE',
      key: mappedMov.id,
      item: mappedMov
    });
    return mappedMov;
  } catch (err) {
    markSupabaseOffline(err, 'addSupabaseCashMovement');
    enqueueSyncAction('cash_movement', 'INSERT', localMov);
    broadcastReconcileChange({
      tableId: 'cash_movements',
      action: 'CREATE',
      key: localMov.id,
      item: localMov
    });
    return localMov;
  }
};

export const updateSupabaseCashMovement = async (mov) => {
  if (!mov || typeof mov !== 'object' || Array.isArray(mov) || !mov.id) {
    throw new Error('Movimiento de caja inválido para actualizar.');
  }
  const concepto = String(mov.concepto || mov.descripcion || '').trim();
  const tipo = String(mov.tipo || 'INGRESO').trim().toUpperCase();
  const montoUsd = round2(mov.montoUsd ?? mov.monto_usd ?? 0);
  const montoBs = round2(mov.montoBs ?? mov.monto_bs ?? 0);
  if (!concepto) {
    throw new Error('El movimiento de caja requiere un concepto válido.');
  }
  if (!['INGRESO', 'EGRESO'].includes(tipo)) {
    throw new Error(`Tipo de movimiento inválido: ${tipo}`);
  }
  if (montoUsd <= 0 && montoBs <= 0) {
    throw new Error('El monto del movimiento debe ser mayor a 0 en USD o Bolívares.');
  }

  unmarkCashMovementDeleted(mov.id);
  const cleanInput = {
    ...mov,
    tipo,
    concepto,
    descripcion: mov.descripcion || concepto,
    montoUsd,
    monto_usd: montoUsd,
    montoBs,
    monto_bs: montoBs
  };

  const localUpdated = updateStorageCashMovement(cleanInput) || cleanInput;
  const emitUpdate = (record) => broadcastReconcileChange({
    tableId: 'cash_movements',
    action: 'UPDATE',
    key: record.id,
    item: record
  });

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('cash_movement', 'UPDATE', localUpdated);
    emitUpdate(localUpdated);
    return localUpdated;
  }

  try {
    const payload = mapCashMovementToDb(localUpdated);
    const { data, error } = await withTimeout(
      supabase.from('cash_movements').upsert([payload]).select().single(),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = mapCashMovementFromDb(data);
    emitUpdate(mapped);
    return mapped;
  } catch (err) {
    markSupabaseOffline(err, 'updateSupabaseCashMovement');
    enqueueSyncAction('cash_movement', 'UPDATE', localUpdated);
    emitUpdate(localUpdated);
    return localUpdated;
  }
};

// Orders & Preventa
export const getSupabaseOrders = async () => {
  if (!isSupabaseAvailable) return applyPendingQueueToEntities('order', getStorageOrders());
  try {
    const { data, error } = await withTimeout(
      supabase.from('orders').select('*, order_items(*)').order('fecha_emision', { ascending: false })
    );

    if (error) {
      markSupabaseOffline(error, 'getSupabaseOrders');
      return applyPendingQueueToEntities('order', getStorageOrders());
    }
    isSupabaseAvailable = true;
    const mapped = applyPendingQueueToEntities('order', (data || []).map(mapOrderFromDb));
    try {
      localStorage.setItem('sm_orders_v4_pipeline', JSON.stringify(mapped));
    } catch (_) {}
    return mapped;
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseOrders');
    return applyPendingQueueToEntities('order', getStorageOrders());
  }
};

export const saveSupabaseOrder = async (orderData, options = {}) => {
  const normalizedStatus = String(orderData?.status || orderData?.estado || '').trim().toUpperCase();
  const skipStatusCheck = ['FACTURADO', 'ANULADO', 'CADUCADO'].includes(normalizedStatus);

  if (!options?.skipStockValidation && !skipStatusCheck && Array.isArray(orderData?.items) && orderData.items.length > 0) {
    const freshProducts = isNetworkOnline()
      ? await getSupabaseProducts().catch(() => getStorageProducts())
      : getStorageProducts();

    if (Array.isArray(freshProducts) && freshProducts.length > 0) {
      const stockCheck = validateWarehouseStockForDocument({
        items: orderData.items,
        products: freshProducts,
        tipoDoc: orderData.tipoDoc || orderData.tipo_doc,
        almacen: orderData.almacen,
        almacenId: orderData.almacenId || orderData.almacen_id,
        co_alma: orderData.co_alma,
        modalidadVenta: orderData.modalidadVenta,
        numeroDoc: orderData.numeroDoc || orderData.numero_doc,
        id: orderData.id,
        pedidoOrigenDoc: orderData.pedidoOrigenDoc,
        documentoAfectado: orderData.documentoAfectado || orderData.documento_afectado
      });

      if (!stockCheck.isValid) {
        const validationErr = new Error(stockCheck.message);
        validationErr.isValidationError = true;
        validationErr.code = 'INSUFFICIENT_WAREHOUSE_STOCK';
        validationErr.validation = stockCheck;
        throw validationErr;
      }
    }
  }

  saveStorageOrder(orderData, options);



  if (!isNetworkOnline()) {
    const offlineOrder = { ...orderData, _createdOffline: true, _offlineQueued: true };
    enqueueSyncAction('orders', 'UPDATE', offlineOrder);
    broadcastReconcileChange({
      tableId: 'orders',
      action: 'CREATE',
      key: offlineOrder.id || offlineOrder.numeroPedido,
      item: offlineOrder
    });
    return offlineOrder;
  }
  try {
    const orderPayload = mapOrderToDb(orderData);
    const { data: ord, error: ordErr } = await withTimeout(
      supabase.from('orders').upsert(orderPayload).select().single()
    );
    if (ordErr) throw ordErr;

    if (orderData.items && orderData.items.length > 0) {
      const itemsPayload = orderData.items.map((it, idx) => ({
        id: `${ord.id}-${it.rengNum || idx + 1}`,
        order_id: ord.id,
        reng_num: it.rengNum || idx + 1,
        articulo_id: it.articuloId,
        articulo_descripcion: it.articuloDescripcion,
        unidad_venta: resolveProductUnit(it, 'Caja'),
        cantidad: Number(it.cantidad || 1),
        litros_unitarios: Number(it.litrosUnitarios || 1),
        litros_totales: Number(it.litrosTotales || (it.cantidad * (it.litrosUnitarios || 1))),
        precio_unitario_usd: Number(it.precioUnitarioUsd ?? it.precioUsd ?? it.precio_unitario_usd ?? 0),
        total_usd: Number(it.totalUsd ?? it.subtotalUsd ?? it.total_usd ?? ((Number(it.cantidad || 1)) * Number(it.precioUnitarioUsd ?? it.precioUsd ?? 0))),
        tipo_alicuota: it.tipoAlicuota || it.tipo_alicuota || 'GENERAL_16',
        aplica_iva: it.aplicaIva !== false
      }));
      await supabase.from('order_items').upsert(itemsPayload, { onConflict: 'id' });
    }

    isSupabaseAvailable = true;
    const mappedOrd = {
      ...orderData,
      ...(ord ? mapOrderFromDb(ord) : {}),
      items: orderData.items || []
    };
    broadcastReconcileChange({
      tableId: 'orders',
      action: orderData.status === 'FACTURADO' ? 'RECONCILE' : 'CREATE',
      key: mappedOrd.id || mappedOrd.numeroPedido,
      item: mappedOrd
    });
    return mappedOrd;
  } catch (err) {
    markSupabaseOffline(err, 'saveSupabaseOrder');
    const offlineOrder = { ...orderData, _createdOffline: true, _offlineQueued: true };
    enqueueSyncAction('orders', 'UPDATE', offlineOrder);
    broadcastReconcileChange({
      tableId: 'orders',
      action: 'CREATE',
      key: offlineOrder.id || offlineOrder.numeroPedido,
      item: offlineOrder
    });
    return offlineOrder;
  }
};

export const updateSupabaseOrderStatus = async (orderId, newStatus) => {
  updateStorageOrderStatus(orderId, newStatus);



  broadcastReconcileChange({
    tableId: 'orders',
    action: 'UPDATE',
    key: orderId,
    item: { id: orderId, status: newStatus }
  });

  if (!isNetworkOnline()) {
    enqueueSyncAction('order_status', 'UPDATE', { orderId, nuevoEstado: newStatus });
    return true;
  }
  try {
    const { error } = await withTimeout(
      supabase.from('orders').update({ status: newStatus, estado: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId)
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return true;
  } catch (err) {
    markSupabaseOffline(err, 'updateSupabaseOrderStatus');
    enqueueSyncAction('order_status', 'UPDATE', { orderId, nuevoEstado: newStatus });
    return false;
  }
};

/**
 * Rutina de expiración automática de órdenes de preventa con más de 72 horas (3 días) de vigencia.
 * Libera formalmente el stock físico comprometido en el inventario Available-To-Promise (ATP).
 */
export const checkAndExpireOverdueOrders = async (existingOrders = null) => {
  const HOURS_72_MS = 72 * 60 * 60 * 1000;
  const now = Date.now();
  const ordersList = Array.isArray(existingOrders) && existingOrders.length > 0 
    ? existingOrders 
    : await getSupabaseOrders();

  if (!Array.isArray(ordersList) || ordersList.length === 0) return [];

  const expiredOrders = [];

  for (const ord of ordersList) {
    if (!ord) continue;
    const tDoc = String(ord.tipoDoc || ord.tipo_doc || '').toUpperCase();
    if (tDoc === 'SOLICITUD_CLIENTE') continue;
    const st = String(ord.status || '').toUpperCase();
    if (st !== 'PENDIENTE' && st !== 'APROBADO' && st !== 'EN_PROCESO' && st !== 'RETENIDO_CREDITO') continue;

    const rawDate = ord.fechaEmision || ord.fecha || ord.created_at;
    if (!rawDate) continue;

    const ordTime = new Date(rawDate).getTime();
    if (!isNaN(ordTime) && (now - ordTime) > HOURS_72_MS) {
      expiredOrders.push(ord);
      try {
        await updateSupabaseOrderStatus(ord.id, 'EXPIRADO');
      } catch (err) {
        console.warn(`[checkAndExpireOverdueOrders] Error expirando orden ${ord.id}:`, err?.message);
      }
    }
  }

  for (const expiredOrd of expiredOrders) {
    broadcastReconcileChange({
      tableId: 'orders',
      action: 'RECONCILE',
      key: expiredOrd.id || expiredOrd.numeroPedido,
      item: { ...expiredOrd, status: 'EXPIRADO' }
    });
  }

  return expiredOrders;
};

export const deleteSupabaseOrder = async (orderId) => {
  if (!orderId) return false;
  deleteStorageOrder(orderId);

  broadcastReconcileChange({
    tableId: 'orders',
    action: 'DELETE',
    key: orderId
  });

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('orders', 'DELETE', { id: orderId });
    return true;
  }
  try {
    // Eliminar renglones asociados y orden en paralelo
    const [, ordersDelRes] = await Promise.all([
      withTimeout(
        supabase.from('order_items').delete().or(`order_id.eq.${orderId},order_doc.eq.${orderId}`)
      ).catch(() => ({ error: null })),
      withTimeout(
        supabase.from('orders').delete().or(`id.eq.${orderId},numero_doc.eq.${orderId}`)
      )
    ]);
    if (ordersDelRes?.error) throw ordersDelRes.error;
    isSupabaseAvailable = true;
    return true;
  } catch (err) {
    console.warn('[deleteSupabaseOrder] Error eliminando orden en Supabase:', err.message);
    markSupabaseOffline(err, 'deleteSupabaseOrder');
    enqueueSyncAction('orders', 'DELETE', { id: orderId });
    return true;
  }
};

export const deleteSupabaseSale = async (saleId) => {
  if (!saleId) return false;

  const rawId = typeof saleId === 'object' ? (saleId.id || '') : String(saleId || '');
  const rawNum = typeof saleId === 'object'
    ? (saleId.factNum || saleId.factura || saleId.numeroDoc || saleId.id || '')
    : String(saleId || '');
  const cleanNum = String(rawNum).replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
  const cleanId = String(rawId).trim();
  const rawTipoInput = typeof saleId === 'object'
    ? String(saleId.tipoDoc || saleId.tipo_doc || saleId.docType || '').toUpperCase().trim()
    : '';
  const isTargetNe =
    rawTipoInput === 'NOTA_ENTREGA' ||
    rawTipoInput === 'N/E' ||
    rawTipoInput === 'NE' ||
    /^(NE-|NDE-)/i.test(cleanId) ||
    /^(NE-|NDE-)/i.test(String(rawNum || ''));

  const candidateKeys = getScopedCxcDeleteKeys(saleId);
  const candidateSet = new Set(candidateKeys);

  // Capturar ventas locales antes de limpiar localStorage por si necesitamos sus renglones para reingresar stock
  const localSalesBeforeDelete = getStorageSales().filter(s => {
    if (!s) return false;
    const sId = String(s.id || '').trim();
    const sNum = String(s.numeroDoc || s.factura || s.factNum || '').trim();
    const sIsNe =
      String(s.tipoDoc || s.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' ||
      /^(NE-|NDE-)/i.test(sId) ||
      /^(NE-|NDE-)/i.test(sNum);
    if (sIsNe !== isTargetNe) return false;
    const sCleanNum = sNum.replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
    return candidateSet.has(sId) || candidateSet.has(sNum) || (!isTargetNe && candidateSet.has(sCleanNum));
  });

  try {
    markCxcDocDeleted(saleId);
    if (typeof localStorage !== 'undefined') {

      const rawCustom = localStorage.getItem('signum_cxc_custom_docs_v1');
      if (rawCustom) {
        const customMap = JSON.parse(rawCustom);
        if (customMap && typeof customMap === 'object') {
          candidateKeys.forEach(k => delete customMap[k]);
          Object.keys(customMap).forEach(k => {
            const item = customMap[k];
            if (item) {
              const iKeys = getScopedCxcDeleteKeys(item);
              if (iKeys.some(ik => candidateSet.has(ik))) {
                delete customMap[k];
              }
            }
          });
          localStorage.setItem('signum_cxc_custom_docs_v1', JSON.stringify(customMap));
        }
      }
    }
  } catch (_) {}

  const broadcastKey = isTargetNe ? (cleanId || `NE-${cleanNum}`) : (cleanNum || cleanId);
  const broadcastItem = {
    id: cleanId || broadcastKey,
    factNum: isTargetNe ? (rawNum || `NE-${cleanNum}`) : cleanNum,
    numeroDoc: isTargetNe ? (rawNum || `NE-${cleanNum}`) : cleanNum,
    tipoDoc: isTargetNe ? 'NOTA_ENTREGA' : 'FACTURA'
  };

  // Evita reingresar inventario dos veces si la reversión directa ya se aplicó antes de un fallo posterior
  let stockRevertAlreadyApplied = false;

  const finalizeLocalOfflineDelete = () => {
    candidateKeys.forEach(k => deleteStorageSale(k, { skipStockAdjustment: stockRevertAlreadyApplied }));
    try {
      const storageProds = getStorageProducts();
      const fallbackSources = stockRevertAlreadyApplied
        ? []
        : (localSalesBeforeDelete.length > 0
            ? localSalesBeforeDelete
            : (typeof saleId === 'object' && Array.isArray(saleId.items) ? [saleId] : []));
      fallbackSources.forEach(s => {
        const revertLines = buildSaleStockDeltaLines(s, { reverse: true });
        (s.items || []).forEach(it => {
          const itemKey = resolveStockItemProductKey(it);
          if (!itemKey) return;
          const prod = storageProds.find(
            p => String(p.id || '').trim() === itemKey || String(p.codigo || '').trim() === itemKey
          );
          if (prod) {
            broadcastReconcileChange({
              tableId: 'products',
              action: 'RECONCILE',
              key: prod.codigo || prod.id,
              item: prod
            });
          }
        });
        if (revertLines.length > 0) {
          const revKey = buildSaleRevertIdempotencyKey(s, cleanId || cleanNum);
          enqueueSyncAction('stock_delta', 'UPDATE', {
            id: revKey,
            idempotencyKey: revKey,
            lines: revertLines,
            validateStrict: false,
            alreadyAppliedLocally: true
          });
        }
      });
    } catch (_) {}

    broadcastReconcileChange({ tableId: 'sales', action: 'DELETE', key: broadcastKey, item: broadcastItem });
    broadcastReconcileChange({ tableId: 'invoices', action: 'DELETE', key: broadcastKey, item: broadcastItem });
    enqueueSyncAction('sales', 'DELETE', { id: cleanId || cleanNum, cleanNum, isTargetNe });
    enqueueSyncAction('profit_invoices', 'DELETE', { id: cleanId || cleanNum, cleanNum, isTargetNe });
  };

  if (!isNetworkOnline()) {
    finalizeLocalOfflineDelete();
    return true;
  }

  try {
    const orSalesParts = [];
    if (cleanId) orSalesParts.push(`id.eq.${cleanId}`);
    if (cleanNum) {
      if (isTargetNe) {
        const neCode = `NE-${cleanNum}`;
        orSalesParts.push(`id.eq.${neCode}`, `numero_doc.eq.${neCode}`);
      } else {
        orSalesParts.push(`numero_doc.eq.${cleanNum}`);
        if (cleanId !== cleanNum) orSalesParts.push(`id.eq.${cleanNum}`);
      }
    }
    const uniqueOrSalesParts = Array.from(new Set(orSalesParts));

    // 1. Obtener registros en `sales` y `profit_invoices` ANTES de borrarlos para reingresar sus artículos al almacén
    //    solo cuando el documento realmente exista (evita doble reversión si ya fue eliminado en servidor).
    const targetTipoDoc = isTargetNe ? 'NOTA_ENTREGA' : 'FACTURA';
    const isTargetLegacy = typeof saleId === 'object' ? isLegacyPreNovInvoice(saleId) : /^fac-[1-9]\d{0,3}$/i.test(cleanId);
    const orInvParts = [];
    if (cleanId) orInvParts.push(`id.eq.${cleanId}`);
    if (cleanNum) {
      if (isTargetNe) {
        const neCode = `NE-${cleanNum}`;
        orInvParts.push(`id.eq.${neCode}`, `fact_num.eq.${neCode}`);
      } else if (isTargetLegacy) {
        orInvParts.push(`fact_num.eq.${cleanNum}`, `id.eq.fac-${cleanNum}`, `id.eq.FAC-${cleanNum}`);
      } else {
        orInvParts.push(`id.eq.FAC-${cleanNum}`);
        if (cleanNum.length >= 6) {
          orInvParts.push(`id.eq.${cleanNum}`, `factNum.eq.${cleanNum}`);
        }
      }
    }
    const uniqueOrInvParts = Array.from(new Set(orInvParts));

    let foundSales = [];
    let remoteSalesCheckSucceeded = false;
    if (uniqueOrSalesParts.length > 0) {
      const { data: fetchedSales, error: salesFetchErr } = await withTimeout(
        supabase.from('sales').select('*').or(uniqueOrSalesParts.join(',')),
        6000
      ).catch(() => ({ data: null, error: true }));
      if (!salesFetchErr && Array.isArray(fetchedSales)) {
        remoteSalesCheckSucceeded = true;
        if (fetchedSales.length > 0) {
          foundSales = fetchedSales
            .map(mapSaleFromDb)
            .filter(s => s && inferCxcDocType(s) === targetTipoDoc);
        }
      }
    }

    let invMatches = null;
    if (uniqueOrInvParts.length > 0) {
      const { data: fetchedInvMatches } = await withTimeout(
        supabase.from('profit_invoices').select('id,tipo_doc,tipoDoc,fechaEmision,fec_emis,fact_num,factNum').or(uniqueOrInvParts.join(',')),
        5000
      ).catch(() => ({ data: null }));
      invMatches = fetchedInvMatches;
    }
    const sameEraInvIds = Array.isArray(invMatches)
      ? invMatches.filter(r => r && r.id && isLegacyPreNovInvoice(r) === isTargetLegacy).map(r => r.id)
      : [];

    const confirmedAlreadyDeletedOnServer =
      remoteSalesCheckSucceeded &&
      foundSales.length === 0 &&
      (uniqueOrInvParts.length === 0 || (Array.isArray(invMatches) && sameEraInvIds.length === 0)) &&
      localSalesBeforeDelete.length === 0;

    const salesToRevertRaw = foundSales.length > 0
      ? foundSales
      : (localSalesBeforeDelete.length > 0
          ? localSalesBeforeDelete
          : (!confirmedAlreadyDeletedOnServer &&
             typeof saleId === 'object' &&
             Array.isArray(saleId.items) &&
             saleId.items.length > 0 &&
             (saleId._source === 'POS' || /^0+\d+$/.test(cleanNum) || /^NE-0+\d+$/i.test(rawNum))
              ? [saleId]
              : []));

    const seenKeys = new Set();
    const salesToRevert = [];
    for (const s of salesToRevertRaw) {
      const k = String(s.id || s.numeroDoc || '').trim();
      if (k && seenKeys.has(k)) continue;
      if (k) seenKeys.add(k);
      salesToRevert.push(s);
    }

    // 2. Reingresar existencias al almacén correspondiente (Alm 01 o Alm 02) y revertir saldo deudor / caja
    for (const saleRecord of salesToRevert) {
      await adjustSupabaseProductsStockForSale(saleRecord, { reverse: true });
      stockRevertAlreadyApplied = true;

      try {
        const sIsCredit =
          isCreditPaymentCondition(saleRecord.condicionPago, saleRecord.metodoPago) ||
          Number(saleRecord.diasCredito || 0) > 0 ||
          String(saleRecord.estado || '').toUpperCase() === 'PENDIENTE';

        if (sIsCredit && saleRecord.clienteId) {
          const revertAmt = saleRecord.tipoDoc === 'NOTA_CREDITO'
            ? Number(saleRecord.totalUsd || 0)
            : Number(saleRecord.saldoUsd ?? saleRecord.totalUsd ?? 0);
          if (revertAmt > 0) {
            const { data: cData, error: cErr } = await withTimeout(
              supabase.from('clients').select('saldo_deudor_usd').eq('id', saleRecord.clienteId).single(),
              4000
            ).catch(() => ({ data: null, error: true }));
            if (!cErr && cData) {
              const curDebit = Number(cData.saldo_deudor_usd || 0);
              const nextDebit = saleRecord.tipoDoc === 'NOTA_CREDITO'
                ? curDebit + revertAmt
                : Math.max(0, Number((curDebit - revertAmt).toFixed(2)));
              await withTimeout(
                supabase.from('clients').update({ saldo_deudor_usd: nextDebit }).eq('id', saleRecord.clienteId),
                4000
              ).catch(() => {});
              const localCli = getStorageClients().find(c => c.id === saleRecord.clienteId);
              if (localCli) {
                saveStorageClient({ ...localCli, saldoDeudorUsd: nextDebit });
              }
              broadcastReconcileChange({
                tableId: 'clients',
                action: 'RECONCILE',
                key: saleRecord.clienteId,
                item: { id: saleRecord.clienteId, saldoDeudorUsd: nextDebit }
              });
            }
          }
        } else if (!sIsCredit) {
          const sRefId = String(saleRecord.id || '').trim();
          const sRefNum = String(saleRecord.numeroDoc || '').trim();
          const cashOrParts = [];
          if (sRefId) cashOrParts.push(`referencia.eq.${sRefId}`);
          if (sRefNum) {
            cashOrParts.push(`referencia.eq.${sRefNum}`, `concepto.ilike.%Cobro Venta ${sRefNum} %`);
          }
          if (cashOrParts.length > 0) {
            await withTimeout(
              supabase.from('cash_movements').delete().or(Array.from(new Set(cashOrParts)).join(',')),
              4000
            ).catch(() => {});
          }
          try {
            if (typeof localStorage !== 'undefined') {
              const rawMovs = localStorage.getItem('sm_cash_movements_v4_fiscal');
              if (rawMovs) {
                const parsedMovs = JSON.parse(rawMovs);
                if (Array.isArray(parsedMovs)) {
                  const nextMovs = parsedMovs.filter(m => {
                    const mRef = String(m?.referencia || '').trim();
                    const mConcept = String(m?.concepto || '');
                    if ((sRefId && mRef === sRefId) || (sRefNum && mRef === sRefNum)) return false;
                    if (sRefNum && (mConcept.includes(`Cobro Venta ${sRefNum} `) || mConcept.includes(`NC ${sRefNum} `))) return false;
                    return true;
                  });
                  if (nextMovs.length !== parsedMovs.length) {
                    localStorage.setItem('sm_cash_movements_v4_fiscal', JSON.stringify(nextMovs));
                  }
                }
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    // 3. Limpiar almacenamiento local sin duplicar ajuste de inventario
    candidateKeys.forEach(k => deleteStorageSale(k, { skipStockAdjustment: true }));

    // 3b. Revertir pedidos de origen que estaban en estado FACTURADO vinculados a esta factura/NE
    const originOrderKeys = new Set();
    const deletedSaleKeysUpper = new Set(
      [cleanId, rawNum, cleanNum].filter(Boolean).map(v => String(v).trim().toUpperCase())
    );
    salesToRevert.forEach(s => {
      if (!s) return;
      [s.pedidoOrigenId, s.pedido_origen_id, s.pedidoOrigenDoc, s.pedido_origen_doc].forEach(val => {
        const t = String(val || '').trim();
        if (t) originOrderKeys.add(t);
      });
      [s.id, s.numeroDoc, s.numero_doc, s.factNum].forEach(val => {
        const t = String(val || '').trim().toUpperCase();
        if (t) deletedSaleKeysUpper.add(t);
      });
    });
    if (typeof saleId === 'object' && saleId) {
      [saleId.pedidoOrigenId, saleId.pedido_origen_id, saleId.pedidoOrigenDoc, saleId.pedido_origen_doc].forEach(val => {
        const t = String(val || '').trim();
        if (t) originOrderKeys.add(t);
      });
    }

    const doesOrderMatchDeletedSale = (ord) => {
      if (!ord || String(ord.status || ord.estado || '').toUpperCase().trim() !== 'FACTURADO') {
        return false;
      }
      const ordId = String(ord.id || '').trim();
      const ordDoc = String(ord.numeroDoc || ord.numero_doc || ord.numeroPedido || ord.numero_pedido || '').trim();
      if ((ordId && originOrderKeys.has(ordId)) || (ordDoc && originOrderKeys.has(ordDoc))) {
        return true;
      }
      const ordFacId = String(ord.facturaId || ord.factura_id || '').trim().toUpperCase();
      const ordNroFac = String(ord.nroFactura || ord.nro_factura || '').trim().toUpperCase();
      if (ordFacId && deletedSaleKeysUpper.has(ordFacId)) return true;
      const ordIsNe = /^(NE-|NDE-)/i.test(ordNroFac) || String(ord.tipoDoc || ord.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA';
      if (ordNroFac && ordIsNe === isTargetNe) {
        const ordCleanNro = ordNroFac.replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
        if (deletedSaleKeysUpper.has(ordNroFac) || (ordCleanNro && deletedSaleKeysUpper.has(ordCleanNro))) {
          return true;
        }
      }
      return false;
    };

    const nowOrderIso = new Date().toISOString();
    try {
      getStorageOrders().filter(doesOrderMatchDeletedSale).forEach(ord => {
        const revertedOrder = {
          ...ord,
          status: 'APROBADO',
          estado: 'APROBADO',
          nroFactura: null,
          nro_factura: null,
          facturaId: null,
          factura_id: null,
          fechaFactura: null,
          fecha_factura: null,
          updatedAt: nowOrderIso
        };
        saveStorageOrder(revertedOrder, { skipStockValidation: true });
        broadcastReconcileChange({
          tableId: 'orders',
          action: 'RECONCILE',
          key: revertedOrder.id || revertedOrder.numeroPedido,
          item: revertedOrder
        });
      });
    } catch (_) {}

    try {
      const orOrderParts = [];
      originOrderKeys.forEach(k => {
        orOrderParts.push(`id.eq.${k}`, `numero_doc.eq.${k}`, `numero_pedido.eq.${k}`);
      });
      if (cleanId) orOrderParts.push(`factura_id.eq.${cleanId}`);
      if (cleanNum) {
        const nroFilterVal = isTargetNe ? `NE-${cleanNum}` : cleanNum;
        orOrderParts.push(`nro_factura.eq.${nroFilterVal}`);
      }
      if (orOrderParts.length > 0) {
        const { data: matchedOrders } = await withTimeout(
          supabase.from('orders').select('*').or(Array.from(new Set(orOrderParts)).join(',')),
          5000
        ).catch(() => ({ data: null }));
        const ordersToRevert = (matchedOrders || []).filter(doesOrderMatchDeletedSale);
        for (const ord of ordersToRevert) {
          const fullUpdate = {
            status: 'APROBADO',
            estado: 'APROBADO',
            nro_factura: null,
            nroFactura: null,
            factura_id: null,
            facturaId: null,
            fecha_factura: null,
            fechaFactura: null,
            updated_at: nowOrderIso
          };
          const { error: ordUpdateErr } = await withTimeout(
            supabase.from('orders').update(fullUpdate).eq('id', ord.id),
            5000
          ).catch(() => ({ error: null }));
          if (ordUpdateErr && (String(ordUpdateErr.code || '') === 'PGRST204' || /column .* does not exist/i.test(String(ordUpdateErr.message || '')))) {
            await withTimeout(
              supabase.from('orders').update({ status: 'APROBADO', estado: 'APROBADO', updated_at: nowOrderIso }).eq('id', ord.id),
              5000
            ).catch(() => {});
          }
          const revertedMapped = {
            ...mapOrderFromDb(ord),
            status: 'APROBADO',
            estado: 'APROBADO',
            nroFactura: null,
            facturaId: null,
            fechaFactura: null,
            updatedAt: nowOrderIso
          };
          saveStorageOrder(revertedMapped, { skipStockValidation: true });
          broadcastReconcileChange({
            tableId: 'orders',
            action: 'RECONCILE',
            key: revertedMapped.id || revertedMapped.numeroPedido,
            item: revertedMapped
          });
        }
      }
    } catch (_) {}

    // 4. Eliminar en Supabase (profit_invoices y sales en paralelo), respetando era/serie para no borrar histórico por error
    const deletePromises = [];
    if (uniqueOrInvParts.length > 0) {
      if (sameEraInvIds.length > 0) {
        deletePromises.push(
          withTimeout(
            supabase.from('profit_invoices').delete().in('id', sameEraInvIds),
            6000
          )
        );
      } else if (!invMatches) {
        deletePromises.push(
          withTimeout(
            supabase.from('profit_invoices').delete().or(uniqueOrInvParts.join(',')),
            6000
          )
        );
      }
    }
    if (uniqueOrSalesParts.length > 0) {
      deletePromises.push(
        withTimeout(
          supabase.from('sales').delete().or(uniqueOrSalesParts.join(',')),
          6000
        )
      );
    }
    if (deletePromises.length > 0) {
      const results = await Promise.all(deletePromises);
      for (const res of results) {
        if (res?.error) throw res.error;
      }
    }

    broadcastReconcileChange({ tableId: 'sales', action: 'DELETE', key: broadcastKey, item: broadcastItem });
    broadcastReconcileChange({ tableId: 'invoices', action: 'DELETE', key: broadcastKey, item: broadcastItem });

    isSupabaseAvailable = true;
    return true;
  } catch (err) {
    console.warn('[deleteSupabaseSale] Error eliminando venta en Supabase:', err.message);
    markSupabaseOffline(err, 'deleteSupabaseSale');
    finalizeLocalOfflineDelete();
    return true;
  }
};

// Anulación con doble seguridad de Factura / Nota de Entrega (conserva registro como ANULADA, devuelve stock, elimina CxC y anula orden vinculada)
export const annulSupabaseSale = async (saleDoc, { motivo = '', usuario = '' } = {}) => {
  if (!saleDoc || typeof saleDoc !== 'object') return { ok: false, alreadyAnnulled: false };

  const currentStatusUpper = String(saleDoc.status || saleDoc.estado || '').trim().toUpperCase();
  if (saleDoc.anulada === true || saleDoc.anulado === true || currentStatusUpper === 'ANULADA' || currentStatusUpper === 'ANULADO') {
    return { ok: true, alreadyAnnulled: true };
  }

  const rawId = String(saleDoc.id || '').trim();
  const rawNum = String(saleDoc.factNum || saleDoc.factura || saleDoc.numeroDoc || saleDoc.numero_doc || saleDoc.id || '').trim();
  const cleanNum = rawNum.replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
  const cleanId = rawId;
  const rawTipoInput = String(saleDoc.tipoDoc || saleDoc.tipo_doc || saleDoc.docType || '').toUpperCase().trim();
  const isTargetNe =
    rawTipoInput === 'NOTA_ENTREGA' ||
    rawTipoInput === 'N/E' ||
    rawTipoInput === 'NE' ||
    /^(NE-|NDE-)/i.test(cleanId) ||
    /^(NE-|NDE-)/i.test(rawNum);
  const targetTipoDoc = isTargetNe ? 'NOTA_ENTREGA' : 'FACTURA';
  const isTargetLegacy = isLegacyPreNovInvoice(saleDoc);
  const nowIso = new Date().toISOString();
  const reasonText = String(motivo || 'Anulada desde Flujo Comercial').trim();
  const actorText = String(usuario || 'Admin').trim();

  const candidateKeys = getScopedCxcDeleteKeys(saleDoc);
  const candidateSet = new Set(candidateKeys);
  const localMatches = getStorageSales().filter(s => {
    if (!s) return false;
    const sId = String(s.id || '').trim();
    const sNum = String(s.numeroDoc || s.factura || s.factNum || '').trim();
    const sIsNe =
      String(s.tipoDoc || s.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' ||
      /^(NE-|NDE-)/i.test(sId) ||
      /^(NE-|NDE-)/i.test(sNum);
    if (sIsNe !== isTargetNe) return false;
    const sCleanNum = sNum.replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
    return candidateSet.has(sId) || candidateSet.has(sNum) || (!isTargetNe && candidateSet.has(sCleanNum));
  });

  const applyLocalAnnulment = (skipStock = false) => {
    const baseSource = localMatches.length > 0 ? localMatches[0] : saleDoc;
    if (!skipStock && Array.isArray(baseSource.items) && baseSource.items.length > 0) {
      const revertLines = buildSaleStockDeltaLines(baseSource, { reverse: true });
      if (revertLines.length > 0) {
        patchProductsStockInStorage(baseSource, { reverse: true });
        const revKey = buildSaleRevertIdempotencyKey(baseSource, cleanId || cleanNum);
        if (!isNetworkOnline()) {
          enqueueSyncAction('stock_delta', 'UPDATE', {
            id: revKey,
            idempotencyKey: revKey,
            lines: revertLines,
            validateStrict: false,
            alreadyAppliedLocally: true
          });
        }
      }
    }

    const updatedLocal = {
      ...baseSource,
      anulada: true,
      anulado: true,
      status: 'ANULADA',
      estado: 'ANULADA',
      saldoUsd: 0,
      saldoBs: 0,
      abonosUsd: 0,
      abonosBs: 0,
      saldado: false,
      motivoAnulacion: reasonText,
      anuladaPor: actorText,
      fechaAnulacion: nowIso,
      updatedAt: nowIso
    };
    saveStorageSale(updatedLocal, { skipStockAdjustment: true });
    broadcastReconcileChange({
      tableId: 'sales',
      action: 'RECONCILE',
      key: updatedLocal.id || updatedLocal.numeroDoc || cleanNum,
      item: updatedLocal
    });
    broadcastReconcileChange({
      tableId: 'invoices',
      action: 'RECONCILE',
      key: updatedLocal.id || updatedLocal.numeroDoc || cleanNum,
      item: updatedLocal
    });
    return updatedLocal;
  };

  if (!isNetworkOnline()) {
    const localDoc = applyLocalAnnulment(false);
    return { ok: true, alreadyAnnulled: false, doc: localDoc };
  }

  try {
    const orSalesParts = [];
    if (cleanId) orSalesParts.push(`id.eq.${cleanId}`);
    if (cleanNum) {
      if (isTargetNe) {
        const neCode = `NE-${cleanNum}`;
        orSalesParts.push(`id.eq.${neCode}`, `numero_doc.eq.${neCode}`);
      } else {
        orSalesParts.push(`numero_doc.eq.${cleanNum}`);
        if (cleanId !== cleanNum) orSalesParts.push(`id.eq.${cleanNum}`);
      }
    }
    const uniqueOrSalesParts = Array.from(new Set(orSalesParts));

    const orInvParts = [];
    if (cleanId) orInvParts.push(`id.eq.${cleanId}`);
    if (cleanNum) {
      if (isTargetNe) {
        const neCode = `NE-${cleanNum}`;
        orInvParts.push(`id.eq.${neCode}`, `fact_num.eq.${neCode}`);
      } else if (isTargetLegacy) {
        orInvParts.push(`fact_num.eq.${cleanNum}`, `id.eq.fac-${cleanNum}`, `id.eq.FAC-${cleanNum}`);
      } else {
        orInvParts.push(`id.eq.FAC-${cleanNum}`);
        if (cleanNum.length >= 6) {
          orInvParts.push(`id.eq.${cleanNum}`, `factNum.eq.${cleanNum}`);
        }
      }
    }
    const uniqueOrInvParts = Array.from(new Set(orInvParts));

    let foundSales = [];
    if (uniqueOrSalesParts.length > 0) {
      const { data: fetchedSales } = await withTimeout(
        supabase.from('sales').select('*').or(uniqueOrSalesParts.join(',')),
        6000
      ).catch(() => ({ data: null }));
      if (Array.isArray(fetchedSales)) {
        foundSales = fetchedSales
          .map(mapSaleFromDb)
          .filter(s => s && inferCxcDocType(s) === targetTipoDoc);
      }
    }

    let invMatches = [];
    if (uniqueOrInvParts.length > 0) {
      const { data: fetchedInvMatches } = await withTimeout(
        supabase.from('profit_invoices').select('*').or(uniqueOrInvParts.join(',')),
        5000
      ).catch(() => ({ data: null }));
      if (Array.isArray(fetchedInvMatches)) {
        invMatches = fetchedInvMatches.filter(r => r && r.id && isLegacyPreNovInvoice(r) === isTargetLegacy);
      }
    }

    const isRecordAnnulled = (r) => Boolean(
      r && (r.anulada || r.anulado || ['ANULADA', 'ANULADO', 'VOID'].includes(String(r.status || r.estado || '').toUpperCase()))
    );
    const isRecordFullySanitized = (r) =>
      isRecordAnnulled(r) &&
      String(r.estado || r.status || '').toUpperCase() === 'ANULADA' &&
      Number(r.saldo_usd ?? r.saldoUsd ?? 0) <= 0.01;

    const alreadyAnnulledOnServer = foundSales.some(isRecordAnnulled) || invMatches.some(isRecordAnnulled);
    const allSanitizedOnServer =
      (foundSales.length === 0 || foundSales.every(isRecordFullySanitized)) &&
      (invMatches.length === 0 || invMatches.every(isRecordFullySanitized));

    if (alreadyAnnulledOnServer && allSanitizedOnServer) {
      const localDoc = applyLocalAnnulment(true);
      return { ok: true, alreadyAnnulled: true, doc: localDoc };
    }

    if (!alreadyAnnulledOnServer) {
      const revertTargets = foundSales.length > 0
        ? foundSales
        : (localMatches.length > 0 ? localMatches : [saleDoc]);

      let stockReverted = false;
      for (const rec of revertTargets) {
        if (!stockReverted && Array.isArray(rec.items) && rec.items.length > 0) {
          await adjustSupabaseProductsStockForSale(rec, { reverse: true });
          stockReverted = true;
        }

        const cliId = String(rec.clienteId || rec.cliente_id || saleDoc.clienteId || '').trim();
        const pendingSaldo = Number(rec.saldoUsd ?? rec.saldo_usd ?? saleDoc.saldoUsd ?? 0) || 0;
        const isCreditDoc =
          isCreditPaymentCondition(rec.condicionPago, rec.metodoPago) ||
          Number(rec.diasCredito || 0) > 0 ||
          pendingSaldo > 0;

        if (cliId && isCreditDoc && pendingSaldo > 0) {
          const { data: cData, error: cErr } = await withTimeout(
            supabase.from('clients').select('saldo_deudor_usd').eq('id', cliId).single(),
            4000
          ).catch(() => ({ data: null, error: true }));
          if (!cErr && cData) {
            const curDebit = Number(cData.saldo_deudor_usd || 0);
            const nextDebit = Math.max(0, Number((curDebit - pendingSaldo).toFixed(2)));
            await withTimeout(
              supabase.from('clients').update({ saldo_deudor_usd: nextDebit }).eq('id', cliId),
              4000
            ).catch(() => {});
            const localCli = getStorageClients().find(c => c.id === cliId);
            if (localCli) {
              saveStorageClient({ ...localCli, saldoDeudorUsd: nextDebit });
            }
            broadcastReconcileChange({
              tableId: 'clients',
              action: 'RECONCILE',
              key: cliId,
              item: { id: cliId, saldoDeudorUsd: nextDebit }
            });
          }
        }
      }
    }

    // Actualizar `sales` con estado ANULADA y saldo 0 (con fallback seguro si faltan columnas)
    if (foundSales.length > 0) {
      const saleIds = foundSales.map(s => s.id).filter(Boolean);
      if (saleIds.length > 0) {
        const salePatch = {
          anulada: true,
          anulado: true,
          status: 'ANULADA',
          estado: 'ANULADA',
          saldo_usd: 0,
          saldo_bs: 0,
          abonos_usd: 0,
          motivo_anulacion: reasonText,
          anulada_por: actorText,
          fecha_anulacion: nowIso
        };
        const { error: salePatchErr } = await withTimeout(
          supabase.from('sales').update(salePatch).in('id', saleIds),
          6000
        ).catch(e => ({ error: e }));
        if (salePatchErr) {
          const { error: fallbackSaleErr } = await withTimeout(
            supabase.from('sales').update({
              estado: 'ANULADA',
              saldo_usd: 0,
              saldo_bs: 0
            }).in('id', saleIds),
            6000
          ).catch(e => ({ error: e }));
          if (fallbackSaleErr) throw fallbackSaleErr;
        }
      }
    }

    // Actualizar `profit_invoices` con estado ANULADA y saldo 0
    if (invMatches.length > 0) {
      const invIds = invMatches.map(i => i.id).filter(Boolean);
      if (invIds.length > 0) {
        const invPatch = {
          anulada: true,
          anulado: true,
          status: 'ANULADA',
          estado: 'ANULADA',
          saldo_usd: 0,
          saldo_bs: 0,
          saldoUsd: 0,
          saldoBs: 0,
          abonos_usd: 0,
          abonosUsd: 0,
          saldado: false,
          motivo_anulacion: reasonText,
          anulada_por: actorText,
          fecha_anulacion: nowIso
        };
        const { error: invPatchErr } = await withTimeout(
          supabase.from('profit_invoices').update(invPatch).in('id', invIds),
          6000
        ).catch(e => ({ error: e }));
        if (invPatchErr) {
          const { error: fallbackInvErr } = await withTimeout(
            supabase.from('profit_invoices').update({
              anulada: true,
              status: 'ANULADA',
              estado: 'ANULADA',
              saldo_usd: 0,
              saldo_bs: 0,
              saldoUsd: 0,
              saldoBs: 0
            }).in('id', invIds),
            6000
          ).catch(e => ({ error: e }));
          if (fallbackInvErr) throw fallbackInvErr;
        }
      }
    }

    // Actualizar orden vinculada en Supabase (`orders`) a ANULADO para evitar que quede FACTURADO
    const ordOrParts = [];
    if (cleanId) ordOrParts.push(`factura_id.eq.${cleanId}`, `nro_factura.eq.${cleanId}`);
    if (rawNum && rawNum !== cleanId) ordOrParts.push(`factura_id.eq.${rawNum}`, `nro_factura.eq.${rawNum}`);
    if (cleanNum && cleanNum !== cleanId && cleanNum !== rawNum) {
      ordOrParts.push(`factura_id.eq.${cleanNum}`, `nro_factura.eq.${cleanNum}`);
    }
    const originOrdId = String(saleDoc.pedidoOrigenId || saleDoc.pedido_origen_id || '').trim();
    if (originOrdId) ordOrParts.push(`id.eq.${originOrdId}`);
    if (ordOrParts.length > 0) {
      await withTimeout(
        supabase
          .from('orders')
          .update({ estado: 'ANULADO', status: 'ANULADO', updated_at: nowIso })
          .or(Array.from(new Set(ordOrParts)).join(',')),
        5000
      ).catch(() => {});
    }

    const updatedLocal = applyLocalAnnulment(true);
    isSupabaseAvailable = true;
    return { ok: true, alreadyAnnulled: alreadyAnnulledOnServer, doc: updatedLocal };
  } catch (err) {
    console.warn('[annulSupabaseSale] Error anulando documento:', err?.message || err);
    markSupabaseOffline(err, 'annulSupabaseSale');
    const localDoc = applyLocalAnnulment(false);
    return { ok: true, alreadyAnnulled: false, doc: localDoc };
  }
};

export const processCustomerReturnForSale = async ({
  originalDoc,
  selectedItems = [],
  motivo = '',
  usuario = 'Admin',
  tasaDolar = 827.73
} = {}) => {
  if (!originalDoc || !Array.isArray(selectedItems) || selectedItems.length === 0) {
    throw new Error('Debe seleccionar al menos un renglón para procesar la devolución.');
  }
  const isNe = inferCxcDocType(originalDoc) === 'NOTA_ENTREGA';
  const targetWh = isNe ? '02' : '01';
  const factNum = String(originalDoc.factNum || originalDoc.numeroDoc || originalDoc.id || '').trim();
  const cleanFactNum = factNum.replace(/^(FAC-|FACT-|NE-|NDE-)/i, '').trim();
  const nowIso = new Date().toISOString();
  const tasa = Number(tasaDolar || originalDoc.tasaDolar || originalDoc.tasa || 827.73) || 827.73;

  const stockLines = [];
  let returnSubUsd = 0;
  let returnLitros = 0;
  const retItems = selectedItems.map((it) => {
    const qty = Math.max(0, Number(it.cantidad ?? it.qty ?? 0));
    const precio = Math.max(0, Number(it.precioUsd ?? it.precio ?? 0));
    const sub = Number((qty * precio).toFixed(2));
    const code = resolveStockItemProductKey(it);
    const lts = Number(it.litros || 0);
    returnSubUsd = Number((returnSubUsd + sub).toFixed(2));
    returnLitros = Number((returnLitros + lts).toFixed(2));
    if (code && qty > 0) {
      stockLines.push({
        codigo: code,
        delta01: targetWh === '01' ? qty : 0,
        delta02: targetWh === '02' ? qty : 0
      });
    }
    return { ...it, cantidad: qty, precioUsd: precio, subtotalUsd: sub, totalUsd: sub };
  }).filter(it => it.cantidad > 0);

  if (retItems.length === 0) {
    throw new Error('Las cantidades a devolver deben ser mayores a cero.');
  }

  const returnIvaUsd = isNe ? 0 : Number((returnSubUsd * 0.16).toFixed(2));
  const returnTotalUsd = Number((returnSubUsd + returnIvaUsd).toFixed(2));
  const returnTotalBs = Number((returnTotalUsd * tasa).toFixed(2));

  if (stockLines.length > 0) {
    await applyStockDeltaForWarehouseLines(stockLines, { validateStrict: false });
  }

  const retPayload = {
    id: `DEV-${Date.now()}`,
    factNum,
    documentoAfectado: factNum,
    tipoDoc: isNe ? 'NOTA_ENTREGA' : 'FACTURA',
    almacen: targetWh,
    fecha: nowIso,
    clienteId: originalDoc.clienteId || originalDoc.cliente_id || '',
    clienteNombre: originalDoc.clienteNombre || originalDoc.cliente_nombre || '',
    clienteRif: originalDoc.clienteRif || originalDoc.cliente_rif || '',
    motivo: String(motivo || 'Devolución de mercancía').trim(),
    usuario,
    tasa,
    totalUsd: returnTotalUsd,
    totalBs: returnTotalBs,
    totalLitros: returnLitros,
    items: retItems
  };

  const savedReturn = await saveSupabaseProfitCustomerReturn(retPayload).catch(() => retPayload);

  let savedCreditNote = null;
  if (!isNe) {
    try {
      savedCreditNote = await processSupabaseSale({
        tipoDoc: 'NOTA_CREDITO',
        documentoAfectado: cleanFactNum || factNum,
        clienteId: originalDoc.clienteId || originalDoc.cliente_id,
        clienteNombre: originalDoc.clienteNombre || originalDoc.cliente_nombre,
        clienteRif: originalDoc.clienteRif || originalDoc.cliente_rif,
        condicionPago: 'CONTADO',
        metodoPago: 'NOTA_CREDITO',
        items: retItems,
        vendedor: usuario,
        skipStockAdjustment: true
      });
    } catch (_) {}
  }

  const currentSaldoUsd = Number(originalDoc.saldoUsd ?? originalDoc.saldo_usd ?? 0) || 0;
  const creditedToDocUsd = Math.min(currentSaldoUsd, returnTotalUsd);
  const nextSaldoUsd = Math.max(0, Number((currentSaldoUsd - creditedToDocUsd).toFixed(2)));
  const nextSaldoBs = Number((nextSaldoUsd * tasa).toFixed(2));

  if (creditedToDocUsd > 0 && isNetworkOnline()) {
    await Promise.all([
      withTimeout(
        supabase.from('sales').update({ saldo_usd: nextSaldoUsd, saldo_bs: nextSaldoBs }).eq('id', originalDoc.id),
        5000
      ).catch(() => {}),
      withTimeout(
        supabase.from('profit_invoices').update({ saldo_usd: nextSaldoUsd, saldo_bs: nextSaldoBs, saldoUsd: nextSaldoUsd, saldoBs: nextSaldoBs }).eq('id', originalDoc.id),
        5000
      ).catch(() => {})
    ]);
  }

  return {
    savedReturn,
    savedCreditNote,
    creditedToDocUsd,
    nextSaldoUsd,
    nextSaldoBs,
    returnLitros,
    targetWh
  };
};

export const fetchBcvRateDetails = async () => {
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
    if (!res.ok) throw new Error("Failed to fetch from DolarAPI");
    const json = await res.json();
    if (json && json.promedio) {
      const rawRate = Number(json.promedio);
      // Tomar exactamente 2 decimales sin redondear hacia arriba (truncar)
      const rate = Math.trunc((rawRate + 0.000000001) * 100) / 100;
      return {
        rate,
        exactRate: rawRate,
        fechaActualizacion: json.fechaActualizacion || new Date().toISOString(),
        fuente: "Banco Central de Venezuela (BCV)"
      };
    }
    throw new Error("Invalid response format");
  } catch (err) {
    console.error("Error fetching BCV rate details: ", err);
    return null;
  }
};

export const fetchBcvRate = async () => {
  const details = await fetchBcvRateDetails();
  return details ? details.rate : null;
};

export const fetchEuroRateDetails = async () => {
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/euros/oficial");
    if (!res.ok) throw new Error("Failed to fetch Euro from DolarAPI");
    const json = await res.json();
    if (json && json.promedio) {
      const rawRate = Number(json.promedio);
      const rate = Math.trunc((rawRate + 0.000000001) * 100) / 100;
      return {
        rate,
        exactRate: rawRate,
        fechaActualizacion: json.fechaActualizacion || new Date().toISOString(),
        fuente: "Banco Central de Venezuela (BCV) - Euro Oficial"
      };
    }
    throw new Error("Invalid Euro response format");
  } catch (err) {
    console.warn("Error fetching Euro rate: ", err);
    return null;
  }
};

export const fetchUsdtRateDetails = async () => {
  // 1. Intentar directo desde el endpoint local proxy de Binance P2P en tiempo real
  try {
    const res = await fetch("/api/binance-usdt");
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && json.data.length > 0) {
        const prices = json.data
          .map(d => Number(d.adv?.price))
          .filter(p => !isNaN(p) && p > 0);
        if (prices.length > 0) {
          // Tomar mediana de las órdenes principales de Binance P2P
          const sorted = [...prices].sort((a, b) => a - b);
          const medianVal = sorted[Math.floor(sorted.length / 2)];
          const rate = Math.trunc((medianVal + 0.000000001) * 100) / 100;
          return {
            rate,
            exactRate: medianVal,
            fechaActualizacion: new Date().toISOString(),
            fuente: "Binance P2P Oficial en Vivo (USDT/VES)"
          };
        }
      }
    }
  } catch (err) {
    // Si falla el endpoint local, continuar con el espejo en vivo de Binance P2P
  }

  // 2. Intentar CriptoYa (Espejo en tiempo real de Binance P2P con CORS abierto)
  try {
    const res = await fetch("https://criptoya.com/api/usdt/ves");
    if (res.ok) {
      const json = await res.json();
      const p2pVal = json.binancep2p?.ask || json.binancep2p?.bid || json.okexp2p?.ask;
      if (p2pVal) {
        const rawRate = Number(p2pVal);
        const rate = Math.trunc((rawRate + 0.000000001) * 100) / 100;
        return {
          rate,
          exactRate: rawRate,
          fechaActualizacion: new Date().toISOString(),
          fuente: "Binance P2P en Vivo (USDT/VES)"
        };
      }
    }
  } catch (err) {
    console.warn("Error fetching USDT from CriptoYa, probando fallback: ", err);
  }

  // 3. Fallback a Dolar Paralelo/Cripto de DolarAPI
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares/paralelo");
    if (res.ok) {
      const json = await res.json();
      if (json && json.promedio) {
        const rawRate = Number(json.promedio);
        const rate = Math.trunc((rawRate + 0.000000001) * 100) / 100;
        return {
          rate,
          exactRate: rawRate,
          fechaActualizacion: json.fechaActualizacion || new Date().toISOString(),
          fuente: "Mercado Paralelo / USDT Referencial"
        };
      }
    }
  } catch (err) {
    console.warn("Error fetching USDT fallback: ", err);
  }

  return null;
};

// ==============================================================================
// GESTIÓN DE CIERRES FISCALES (REPORTE X Y REPORTE Z) - SENIAT
// ==============================================================================

export const getSupabaseFiscalClosures = async () => {
  try {
    const { data, error } = await supabase
      .from('fiscal_closures')
      .select('*')
      .order('fecha_cierre', { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn("Aviso cargando cierres de Supabase, usando fallback:", error);
      return getStorageFiscalClosures();
    }
    return data.map(mapFiscalClosureFromDb);
  } catch (err) {
    console.warn("Excepción cargando cierres fiscales, usando fallback local:", err);
    return getStorageFiscalClosures();
  }
};

export const saveSupabaseFiscalClosure = async (closureData, closedSaleIds = []) => {
  // 1. Sincronizar almacenamiento local de inmediato
  closeSalesInStorage(closureData.id, closedSaleIds);
  saveStorageFiscalClosure(closureData);

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('fiscal_closure', 'INSERT', closureData);
    return closureData;
  }

  try {
    const dbPayload = mapFiscalClosureToDb(closureData);
    const { data, error } = await withTimeout(
      supabase.from('fiscal_closures').insert([dbPayload]).select().single()
    );

    if (error) throw error;
    isSupabaseAvailable = true;

    // Actualizar ventas cerradas en Supabase
    if (closedSaleIds.length > 0) {
      await supabase
        .from('sales')
        .update({ cierre_z_id: closureData.id, cerrada: true })
        .in('id', closedSaleIds);
    }

    return mapFiscalClosureFromDb(data);
  } catch (err) {
    console.warn("Excepción guardando cierre fiscal en Supabase, encolando offline:", err);
    markSupabaseOffline(err, 'saveSupabaseFiscalClosure');
    enqueueSyncAction('fiscal_closure', 'INSERT', closureData);
    return closureData;
  }
};

// ==============================================================================
// GESTIÓN DE USUARIOS Y AUDITORÍA DE ACTIVIDAD EN SUPABASE
// ==============================================================================

/**
 * Obtiene el listado completo de usuarios desde Supabase con sincronización a caché local.
 */
const applyPendingUserSyncActions = (baseList) => {
  let deletedIds = [];
  try {
    const rawDel = localStorage.getItem('signum_deleted_user_ids');
    if (rawDel) deletedIds = JSON.parse(rawDel) || [];
  } catch (_) {}

  const validMap = new Map();
  for (const item of (Array.isArray(baseList) ? baseList : [])) {
    if (!item || typeof item.username !== 'string') continue;
    const uname = item.username.trim().toLowerCase();
    if (!uname || uname === 'sysadmin' || item.id === 'usr-sysadmin' || uname === 'autotest_1793130314101') continue;
    if (uname !== 'edson designer' && (deletedIds.includes(item.id) || deletedIds.includes(uname))) continue;
    const mapped = mapUserFromDb(item);
    if (mapped && mapped.username) {
      validMap.set(mapped.id || mapped.username, mapped);
    }
  }

  // Aplicar operaciones de usuario pendientes en la cola offline
  try {
    const queue = getSyncQueue();
    for (const q of queue) {
      if (q.entity !== 'user' || !q.data) continue;
      if (q.action === 'DELETE') {
        const delId = q.data.id;
        for (const [k, val] of validMap.entries()) {
          if (val.id === delId || val.username === String(delId || '').toLowerCase()) {
            validMap.delete(k);
          }
        }
      } else if (q.action === 'UPDATE' || q.action === 'INSERT') {
        const u = mapUserFromDb(q.data);
        if (u && u.username) {
          let matchedKey = null;
          for (const [k, val] of validMap.entries()) {
            if (val.id === u.id || val.username === u.username) {
              matchedKey = k;
              break;
            }
          }
          if (matchedKey) {
            validMap.set(matchedKey, { ...validMap.get(matchedKey), ...u });
          } else {
            validMap.set(u.id || u.username, u);
          }
        }
      }
    }
  } catch (_) {}

  let finalUsers = Array.from(validMap.values());
  const hasMaster = finalUsers.some(u => u.username === 'edson designer' || normalizeRole(u.rol) === 'ADMINISTRADOR MASTER');
  if (!hasMaster) {
    const masterDefault = DEFAULT_USERS.find(u => u.username?.toLowerCase() === 'edson designer' || u.id === 'usr-muq3bdll');
    if (masterDefault) {
      finalUsers = [mapUserFromDb(masterDefault), ...finalUsers];
    }
  }

  return sortUsersByHierarchy(finalUsers);
};

const stripAccents = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const autoProvisionedSellerKeys = new Set();

const isSalesDepartmentUser = (u) => {
  if (!u || typeof u !== 'object') return false;
  if (u.activo === false || u.active === false) return false;
  const uname = String(u.username || '').trim().toLowerCase();
  const uid = String(u.id || '').trim().toLowerCase();
  if (/^autotest_/i.test(uname) || /^usr-autotest-/i.test(uid)) return false;
  const dept = String(u.departamento || '').trim().toUpperCase();
  const normRol = normalizeRole(u.rol || u.role || '');
  return dept === 'VEN' || normRol === 'VENTAS';
};

const generateUniqueSellerCode = (nombre, usedCodesSet = new Set()) => {
  const words = stripAccents(nombre)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let base = '';
  if (words.length >= 2) {
    base = `${words[0][0]}${words[1][0]}`.toUpperCase();
  } else if (words.length === 1) {
    base = words[0].slice(0, 2).toUpperCase();
  }
  if (!base || base.length < 2) {
    base = (base || 'VN').padEnd(2, 'X').slice(0, 2);
  }
  if (!usedCodesSet.has(base)) return base;

  if (words.length >= 2 && words[1].length >= 2) {
    const three = `${words[0][0]}${words[1].slice(0, 2)}`.toUpperCase();
    if (!usedCodesSet.has(three)) return three;
  }
  for (let i = 2; i < 99; i++) {
    const candidate = `${base}${i}`;
    if (!usedCodesSet.has(candidate)) return candidate;
  }
  return `${base}${Date.now().toString(36).slice(-2).toUpperCase()}`;
};

const buildSellerFromSalesUser = (userObj, coVen) => {
  const nowIso = new Date().toISOString();
  const nombre = String(userObj?.nombre || userObj?.name || userObj?.username || coVen).trim();
  return {
    id: coVen,
    co_ven: coVen,
    coVen,
    ven_des: nombre,
    venDes: nombre,
    cedula: userObj?.cedula || '',
    telefonos: userObj?.phone || userObj?.telefono || '',
    direccion: '',
    tipo: 'A',
    comision_pct: 3.0,
    comisionPct: 3.0,
    meta_litros_mes: 3000,
    metaLitrosMes: 3000,
    activo: true,
    foto: userObj?.foto || '',
    avatar: userObj?.avatar || '',
    co_zon: '',
    coZon: '',
    zona: '',
    userId: userObj?.id || '',
    username: userObj?.username || '',
    created_at: nowIso,
    createdAt: nowIso,
    updated_at: nowIso,
    updatedAt: nowIso
  };
};

const ensureSalesUserInProfitSellers = async (userObj) => {
  if (!isSalesDepartmentUser(userObj)) return null;
  try {
    const sellers = getStorageSellers();
    const rawUserCoVen = String(userObj.co_ven || userObj.coVen || '').trim();
    const derivedFromId = String(userObj.id || '').toLowerCase().startsWith('usr-seller-')
      ? String(userObj.id).replace(/^usr-seller-/i, '').trim().toUpperCase()
      : '';
    const candidateCoVen = (rawUserCoVen || derivedFromId).toUpperCase();
    const userNameNorm = stripAccents(userObj.nombre);

    const usedCodes = new Set();
    sellers.forEach((s) => {
      const code = String(s?.coVen || s?.co_ven || s?.id || '').trim().replace(/^usr-seller-/i, '').toUpperCase();
      if (code && !code.startsWith('USR-')) usedCodes.add(code);
    });

    const existingSeller = sellers.find((s) => {
      const sCode = String(s?.coVen || s?.co_ven || s?.id || '').trim().replace(/^usr-seller-/i, '').toUpperCase();
      const sName = stripAccents(s?.venDes || s?.ven_des);
      if (candidateCoVen && !candidateCoVen.startsWith('USR-') && sCode === candidateCoVen) return true;
      if (userNameNorm && sName && sName === userNameNorm) return true;
      return false;
    });

    const resolvedCoVen = existingSeller
      ? String(existingSeller.coVen || existingSeller.co_ven || existingSeller.id).trim().replace(/^usr-seller-/i, '').toUpperCase()
      : (candidateCoVen && !candidateCoVen.startsWith('USR-')
          ? candidateCoVen
          : generateUniqueSellerCode(userObj.nombre || userObj.username, usedCodes));

    if (!existingSeller) {
      const newSeller = buildSellerFromSalesUser(userObj, resolvedCoVen);
      saveStorageSeller(newSeller);

      // Enlazar co_ven en users local si estaba vacío
      if (!rawUserCoVen && userObj.id) {
        try {
          const localUsers = getUsersList();
          const updatedUsers = localUsers.map((u) =>
            u && u.id === userObj.id
              ? { ...u, coVen: resolvedCoVen, co_ven: resolvedCoVen, seller_id: resolvedCoVen }
              : u
          );
          localStorage.setItem('signum_users_list', JSON.stringify(sortUsersByHierarchy(updatedUsers)));
        } catch (_) {}
      }

      if (isNetworkOnline() && !isStaticCloudHost && !autoProvisionedSellerKeys.has(resolvedCoVen)) {
        autoProvisionedSellerKeys.add(resolvedCoVen);
        withTimeout(
          supabase.from('profit_sellers').upsert([newSeller], { onConflict: 'co_ven' }),
          4000
        ).catch(() => {});
        if (!rawUserCoVen && userObj.id) {
          withTimeout(
            supabase.from('users').update({ co_ven: resolvedCoVen, coVen: resolvedCoVen, seller_id: resolvedCoVen }).eq('id', userObj.id),
            3000
          ).catch(() => {});
        }
      }

      broadcastReconcileChange({
        tableId: 'sellers',
        action: 'RECONCILE',
        key: resolvedCoVen,
        item: newSeller
      });
      return newSeller;
    }

    return existingSeller;
  } catch (_) {
    return null;
  }
};

// Sincroniza automáticamente la foto de un usuario con su registro de asesor comercial (profit_sellers) si existe
const syncSellerPhotoFromUser = async (userObj) => {
  if (!userObj || userObj.foto === undefined) return;
  try {
    const sellers = getStorageSellers();
    const rawUserCoVen = String(userObj.co_ven || userObj.coVen || '').trim();
    const derivedFromId = String(userObj.id || '').toLowerCase().startsWith('usr-seller-')
      ? String(userObj.id).replace(/^usr-seller-/i, '').trim().toUpperCase()
      : '';
    const candidateCoVen = (rawUserCoVen || derivedFromId).toUpperCase();
    const userNameNorm = stripAccents(userObj.nombre);

    const matchedSeller = sellers.find(s => {
      const sCode = String(s.coVen || s.co_ven || s.id || '').trim().replace(/^usr-seller-/i, '').toUpperCase();
      const sName = stripAccents(s.venDes || s.ven_des);
      if (candidateCoVen && !candidateCoVen.startsWith('USR-') && sCode === candidateCoVen) return true;
      if (userNameNorm && sName && sName === userNameNorm) return true;
      return false;
    });

    const targetCoVen = matchedSeller
      ? String(matchedSeller.coVen || matchedSeller.co_ven || candidateCoVen).replace(/^usr-seller-/i, '').trim().toUpperCase()
      : (!candidateCoVen.startsWith('USR-') ? candidateCoVen : '');

    if (!targetCoVen) return;

    const cleanPhoto = userObj.foto || '';
    const sellerName = matchedSeller?.venDes || matchedSeller?.ven_des || userObj.nombre || targetCoVen;
    const nowIso = new Date().toISOString();

    saveStorageSeller({
      coVen: targetCoVen,
      co_ven: targetCoVen,
      venDes: sellerName,
      ven_des: sellerName,
      foto: cleanPhoto
    });

    if (isNetworkOnline() && !isStaticCloudHost) {
      try {
        await withTimeout(
          supabase
            .from('profit_sellers')
            .update({ foto: userObj.foto || null, updated_at: nowIso })
            .eq('co_ven', targetCoVen),
          3000
        );
      } catch (_) {}
    }

    broadcastReconcileChange({
      tableId: 'sellers',
      action: 'RECONCILE',
      key: targetCoVen,
      item: {
        ...(matchedSeller || {}),
        coVen: targetCoVen,
        co_ven: targetCoVen,
        venDes: sellerName,
        ven_des: sellerName,
        foto: cleanPhoto,
        updatedAt: nowIso
      }
    });
  } catch (err) {
    console.warn('Error sincronizando foto de usuario con profit_sellers:', err);
  }
};

export const getSupabaseUsers = async () => {
  const getCachedUsers = () => {
    const list = getUsersList();
    const cleaned = applyPendingUserSyncActions(list);
    try {
      localStorage.setItem('signum_users_list', JSON.stringify(cleaned));
    } catch (_) {}
    return cleaned;
  };

  if (!isSupabaseAvailable) return getCachedUsers();

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true })
    );

    if (error || !data || data.length === 0) {
      if (error) markSupabaseOffline(error, 'getSupabaseUsers');
      return getCachedUsers();
    }

    const mappedUsers = applyPendingUserSyncActions(data.map(mapUserFromDb));
    try {
      localStorage.setItem('signum_users_list', JSON.stringify(mappedUsers));
    } catch (_) {}

    return mappedUsers;
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseUsers');
    return getCachedUsers();
  }
};

/**
 * Guarda o actualiza un usuario en Supabase y sincroniza la memoria local.
 */
export const saveSupabaseUser = async (userData, auditUser = null) => {
  if (!userData || typeof userData !== 'object') {
    throw new Error('Datos de usuario inválidos.');
  }

  // 1. Obtener lista actual para fusionar sin perder ningún campo existente
  let localUsers = [];
  try {
    localUsers = getUsersList();
  } catch (_) {
    localUsers = [...DEFAULT_USERS];
  }

  const incomingUsername = (userData.username || '').trim().toLowerCase().replace(/^@+/, '');
  const existingIdx = localUsers.findIndex(u =>
    (userData.id && u.id === userData.id) ||
    (incomingUsername && u.username && u.username.toLowerCase() === incomingUsername)
  );
  const existingUser = existingIdx >= 0 ? localUsers[existingIdx] : null;
  const defaultTemplate = DEFAULT_USERS.find(u =>
    (userData.id && u.id === userData.id) ||
    (incomingUsername && u.username && u.username.toLowerCase() === incomingUsername)
  ) || null;

  // Ignorar propiedades undefined para que actualizaciones parciales (ej. foto o clave) no borren campos
  const definedUserData = {};
  for (const [k, v] of Object.entries(userData)) {
    if (v !== undefined) definedUserData[k] = v;
  }

  const mergedSource = {
    ...(defaultTemplate || {}),
    ...(existingUser || {}),
    ...definedUserData
  };

  const finalUsername = (mergedSource.username || '').trim().toLowerCase().replace(/^@+/, '');
  if (!finalUsername) {
    throw new Error('El nombre de usuario es obligatorio.');
  }

  const finalPassword = (userData.password && String(userData.password).trim())
    ? String(userData.password).trim()
    : (existingUser?.password || defaultTemplate?.password || '123456');

  const targetRole = normalizeRole(mergedSource.rol || mergedSource.role || 'VENTAS');
  const roleMeta = getRoleMeta(targetRole);
  const roleChanged = existingUser && normalizeRole(existingUser.rol) !== targetRole;
  const nowIso = new Date().toISOString();

  const payloadWithPassword = {
    ...mergedSource,
    id: mergedSource.id || `usr-${Date.now().toString(36)}`,
    username: finalUsername,
    password: finalPassword,
    rol: targetRole,
    color: roleChanged ? roleMeta.color : (mergedSource.color || roleMeta.color || '#0ea5e9'),
    updatedAt: nowIso,
    updated_at: nowIso
  };

  const dbPayload = mapUserToDb(payloadWithPassword);
  const mappedUser = mapUserFromDb(dbPayload);

  // Si estaba marcado como eliminado anteriormente, quitarlo de la lista de eliminados
  try {
    const rawDel = localStorage.getItem('signum_deleted_user_ids');
    if (rawDel) {
      const delList = JSON.parse(rawDel) || [];
      const updatedDel = delList.filter(x => x !== mappedUser.id && x !== mappedUser.username);
      if (updatedDel.length !== delList.length) {
        localStorage.setItem('signum_deleted_user_ids', JSON.stringify(updatedDel));
      }
    }
  } catch (_) {}

  if (existingIdx >= 0) {
    localUsers[existingIdx] = { ...localUsers[existingIdx], ...mappedUser };
  } else {
    localUsers.push(mappedUser);
  }
  const sortedLocal = sortUsersByHierarchy(localUsers);
  try {
    localStorage.setItem('signum_users_list', JSON.stringify(sortedLocal));
  } catch (_) {}

  // Si el usuario editado es la sesión activa, actualizar de inmediato
  try {
    const rawActive = localStorage.getItem('signum_active_user');
    if (rawActive) {
      const activeObj = JSON.parse(rawActive);
      if (activeObj && (activeObj.id === mappedUser.id || activeObj.username?.toLowerCase() === mappedUser.username)) {
        localStorage.setItem('signum_active_user', JSON.stringify(mappedUser));
      }
    }
  } catch (_) {}

  // 2. Persistencia en Supabase (cuando el servidor está disponible)
  if (isNetworkOnline() && !isStaticCloudHost) {
    try {
      let { data, error } = await withTimeout(
        supabase
          .from('users')
          .upsert([dbPayload], { onConflict: 'id' })
          .select()
          .single()
      );

      if (error && error.message && error.message.includes('modulos')) {
        const { modulos, ...safePayload } = dbPayload;
        const retryResult = await withTimeout(
          supabase
            .from('users')
            .upsert([safePayload], { onConflict: 'id' })
            .select()
            .single()
        );
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        throw error;
      }

      if (data) {
        isSupabaseAvailable = true;
        const savedFromDb = mapUserFromDb({ ...dbPayload, ...data });
        const finalLocal = sortedLocal.map(u => (u.id === savedFromDb.id || u.username === savedFromDb.username) ? savedFromDb : u);
        try {
          localStorage.setItem('signum_users_list', JSON.stringify(sortUsersByHierarchy(finalLocal)));
        } catch (_) {}

        const accionTipo = existingIdx >= 0 ? 'EDITAR_USUARIO' : 'CREAR_USUARIO';
        logUserActivity({
          usuarioId: auditUser?.id || 'usr-sistema',
          usuarioNombre: auditUser?.nombre || 'Sistema',
          usuarioRol: auditUser?.rol || 'ADMIN',
          accion: accionTipo,
          modulo: 'USUARIOS',
          detalles: `${accionTipo === 'CREAR_USUARIO' ? 'Creación de nuevo usuario' : 'Actualización de datos para'} @${savedFromDb.username} (${savedFromDb.nombre}) con rol ${savedFromDb.rol}`
        }).catch(() => {});

        if (userData.foto !== undefined) {
          await syncSellerPhotoFromUser(savedFromDb);
        }
        if (isSalesDepartmentUser(savedFromDb)) {
          await ensureSalesUserInProfitSellers(savedFromDb);
        }

        broadcastReconcileChange({
          tableId: 'users',
          action: existingIdx >= 0 ? 'RECONCILE' : 'CREATE',
          key: savedFromDb.id || savedFromDb.username,
          item: savedFromDb
        });

        return savedFromDb;
      }
    } catch (err) {
      console.warn("No se pudo persistir usuario en Supabase inmediatamente, guardando en modo local/offline:", err?.message || err);
      markSupabaseOffline(err, 'saveSupabaseUser');
    }
  }

  // Fallback local/offline garantizado (no lanza error al usuario, mantiene los cambios en localStorage y encola)
  enqueueSyncAction('user', existingIdx >= 0 ? 'UPDATE' : 'INSERT', mappedUser);

  if (userData.foto !== undefined) {
    await syncSellerPhotoFromUser(mappedUser);
  }
  if (isSalesDepartmentUser(mappedUser)) {
    await ensureSalesUserInProfitSellers(mappedUser);
  }

  addStorageUserLog({
    usuarioId: auditUser?.id || 'usr-sistema',
    usuarioNombre: auditUser?.nombre || 'Sistema',
    usuarioRol: auditUser?.rol || 'ADMIN',
    accion: existingIdx >= 0 ? 'EDITAR_USUARIO' : 'CREAR_USUARIO',
    modulo: 'USUARIOS',
    detalles: `${existingIdx >= 0 ? 'Actualización de datos para' : 'Creación de nuevo usuario'} @${mappedUser.username} (${mappedUser.nombre}) con rol ${mappedUser.rol}`
  });

  broadcastReconcileChange({
    tableId: 'users',
    action: existingIdx >= 0 ? 'RECONCILE' : 'CREATE',
    key: mappedUser.id || mappedUser.username,
    item: mappedUser
  });

  return mappedUser;
};

/**
 * Elimina un usuario en Supabase y en la memoria local.
 */
export const deleteSupabaseUser = async (userId, auditUser = null) => {
  if (!userId) return false;
  let targetUser = null;

  // 1. Local
  try {
    const users = getUsersList();
    targetUser = users.find(u => u.id === userId || u.username?.toLowerCase() === String(userId).toLowerCase());
    if (targetUser) {
      const normRole = normalizeRole(targetUser.rol);
      if (normRole === 'ADMINISTRADOR MASTER' || targetUser.username?.toLowerCase() === 'edson designer') {
        throw new Error('Acción bloqueada: No se puede eliminar al Administrador Master (Propietario del Sistema).');
      }
    }
    const filtered = users.filter(u => u.id !== userId && u.username?.toLowerCase() !== String(userId).toLowerCase());
    localStorage.setItem('signum_users_list', JSON.stringify(sortUsersByHierarchy(filtered)));

    // Registrar ID y username como eliminados para no restaurarlos desde users.json
    const rawDel = localStorage.getItem('signum_deleted_user_ids');
    const delList = rawDel ? (JSON.parse(rawDel) || []) : [];
    if (!delList.includes(userId)) delList.push(userId);
    if (targetUser?.username && !delList.includes(targetUser.username.toLowerCase())) {
      delList.push(targetUser.username.toLowerCase());
    }
    localStorage.setItem('signum_deleted_user_ids', JSON.stringify(delList));
  } catch (err) {
    if (err?.message?.includes('Acción bloqueada')) throw err;
  }

  // 2. Supabase
  if (isNetworkOnline() && !isStaticCloudHost) {
    try {
      const { error } = await withTimeout(
        supabase.from('users').delete().eq('id', userId)
      );
      if (error) throw error;
      isSupabaseAvailable = true;
    } catch (err) {
      console.warn("No se pudo eliminar en Supabase inmediatamente, encolando offline:", err?.message || err);
      markSupabaseOffline(err, 'deleteSupabaseUser');
      enqueueSyncAction('user', 'DELETE', { id: userId });
    }
  } else {
    enqueueSyncAction('user', 'DELETE', { id: userId });
  }

  // Auditoría
  const userDesc = targetUser ? `@${targetUser.username} (${targetUser.nombre})` : `ID ${userId}`;
  logUserActivity({
    usuarioId: auditUser?.id || 'usr-sistema',
    usuarioNombre: auditUser?.nombre || 'Sistema',
    usuarioRol: auditUser?.rol || 'ADMIN',
    accion: 'ELIMINAR_USUARIO',
    modulo: 'USUARIOS',
    detalles: `Eliminación permanente del usuario ${userDesc}`
  }).catch(() => {});

  broadcastReconcileChange({
    tableId: 'users',
    action: 'DELETE',
    key: userId
  });

  return true;
};

/**
 * Actualiza la marca de último acceso de un usuario tras autenticarse con éxito.
 */
export const updateUserLastAccess = async (userId) => {
  const nowIso = new Date().toISOString();

  // Local
  try {
    const raw = localStorage.getItem('signum_users_list');
    if (raw) {
      const users = JSON.parse(raw);
      const updated = users.map(u => u.id === userId ? { ...u, ultimoAcceso: nowIso } : u);
      localStorage.setItem('signum_users_list', JSON.stringify(updated));
    }
  } catch (_) {}

  // Supabase
  if (isSupabaseAvailable) {
    try {
      await supabase
        .from('users')
        .update({ ultimo_acceso: nowIso })
        .eq('id', userId);
    } catch (e) {
      console.warn("No se pudo actualizar último acceso en Supabase:", e);
    }
  }
};

/**
 * Registra un evento de auditoría de actividad en Supabase y localmente.
 */
export const logUserActivity = async (logData) => {
  const dbPayload = mapUserLogToDb(logData);

  // Almacenar localmente siempre
  addStorageUserLog(dbPayload);

  if (!isSupabaseAvailable) return mapUserLogFromDb(dbPayload);

  try {
    const { data, error } = await withTimeout(
      supabase.from('user_activity_logs').insert([dbPayload]).select().single(),
      1500
    );
    if (error) {
      console.warn("No se pudo persistir log en Supabase:", error);
      return mapUserLogFromDb(dbPayload);
    }
    return mapUserLogFromDb(data);
  } catch (err) {
    console.warn("Excepción al registrar actividad en Supabase:", err);
    return mapUserLogFromDb(dbPayload);
  }
};

/**
 * Obtiene la bitácora de actividad de usuarios desde Supabase con fallback local.
 */
export const getSupabaseUserLogs = async (limit = 100) => {
  if (!isSupabaseAvailable) return getStorageUserLogs();

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('user_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
    );

    if (error || !data) {
      return getStorageUserLogs();
    }

    return data.map(mapUserLogFromDb);
  } catch (err) {
    return getStorageUserLogs();
  }
};

// ==============================================================================
// DIRECT PUSH HANDLERS FOR OFFLINE SYNC QUEUE
// ==============================================================================

export const pushConfigToSupabase = async (configData) => {
  const payload = mapConfigToDb(configData);
  const { data, error } = await withTimeout(
    supabase.from('config').upsert([payload]).select().single(),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapConfigFromDb(data);
};

export const pushProductToSupabase = async (productData) => {
  const payload = mapProductToDb(productData);
  if (productData?._preserveServerStock) {
    const metaPayload = { ...payload, _preserveServerStock: true };
    delete metaPayload.stock;
    delete metaPayload.stockAlmacen01;
    delete metaPayload.stock_almacen_01;
    delete metaPayload.stockAlmacen02;
    delete metaPayload.stock_almacen_02;
    const { data, error } = await withTimeout(
      supabase.from('products').update(metaPayload).eq('id', payload.id).select().single(),
      6000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return mapProductFromDb(data);
  }
  const { data, error } = await withTimeout(
    supabase.from('products').upsert([payload]).select().single(),
    6000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapProductFromDb(data);
};

export const deleteSupabaseProductDirect = async (productId) => {
  const { error } = await withTimeout(
    supabase.from('products').delete().eq('id', productId),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const pushClientToSupabase = async (clientData) => {
  const payload = mapClientToDb(clientData);
  const { data, error } = await withTimeout(
    supabase.from('clients').upsert([payload]).select().single(),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapClientFromDb(data);
};

export const deleteSupabaseClientDirect = async (clientId) => {
  const { error } = await withTimeout(
    supabase.from('clients').delete().eq('id', clientId),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const pushSupplierToSupabase = async (supplierData) => {
  const payload = mapSupplierToDb(supplierData);
  const { data, error } = await withTimeout(
    supabase.from('suppliers').upsert([payload]).select().single(),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapSupplierFromDb(data);
};

export const pushSaleToSupabase = async (saleData) => {
  if (isPermanentlyPurgedDuplicateDoc(saleData)) {
    return saleData;
  }
  let effectiveSaleData = { ...saleData };
  delete effectiveSaleData._createdOffline;

  if (saleData?._createdOffline && effectiveSaleData.id) {
    try {
      const { data: existing } = await withTimeout(
        supabase
          .from('sales')
          .select('id,numero_doc,tipo_doc,cliente_rif,total_usd')
          .eq('id', effectiveSaleData.id)
          .maybeSingle(),
        4000
      );
      const isDifferentSale =
        existing &&
        (String(existing.cliente_rif || '').trim() !== String(effectiveSaleData.clienteRif || effectiveSaleData.cliente_rif || '').trim() ||
          Math.abs(Number(existing.total_usd || 0) - Number(effectiveSaleData.totalUsd || effectiveSaleData.total_usd || 0)) > 0.01);

      if (existing && !isDifferentSale) {
        // La venta ya llegó intacta al servidor antes de la desconexión: no re-insertar ni sobrescribir
        isSupabaseAvailable = true;
        return mapSaleFromDb(existing);
      }

      if (isDifferentSale) {
        const [{ data: dbSales }, { data: dbInvoices }] = await Promise.all([
          supabase.from('sales').select('id,numero_doc,tipo_doc,fecha,fecha_emision'),
          supabase.from('profit_invoices').select('id,fact_num,factNum,tipo_doc,tipoDoc,fechaEmision,fec_emis')
        ]);
        const mappedSales = (dbSales || []).map(s => ({
          id: s.id,
          numeroDoc: s.numero_doc,
          tipoDoc: s.tipo_doc,
          fecha: s.fecha || s.fecha_emision,
          fechaEmision: s.fecha_emision || s.fecha
        }));
        const tipo = String(effectiveSaleData.tipoDoc || 'FACTURA').toUpperCase();
        const prefix = tipo === 'NOTA_CREDITO' ? 'NC' : (tipo === 'NOTA_DEBITO' ? 'ND' : (tipo === 'NOTA_ENTREGA' ? 'NE' : 'FACT'));
        const newNum = tipo === 'FACTURA'
          ? getNextInvoiceCorrelativo(mappedSales, dbInvoices || [])
          : getNextNotaEntregaCorrelativo(mappedSales, dbInvoices || [], prefix);
        const newId = (tipo === 'FACTURA' || String(newNum).toUpperCase().startsWith(`${prefix}-`))
          ? newNum
          : `${prefix}-${newNum}`;
        effectiveSaleData = {
          ...effectiveSaleData,
          id: newId,
          numeroDoc: newNum
        };
      }
    } catch (_) {}
  }

  const payload = mapSaleToDb(effectiveSaleData);
  const { data, error } = await withTimeout(
    supabase.from('sales').upsert([payload]).select().single(),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapSaleFromDb(data);
};

export const recordFiscalAdjustmentSaleInSupabase = async (saleObj) => {
  if (!saleObj) return null;
  const localSaved = saveStorageFiscalAdjustmentSale(saleObj);
  const recordToPersist = localSaved || saleObj;
  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('sale', 'INSERT', recordToPersist);
    return recordToPersist;
  }
  try {
    const mapped = await pushSaleToSupabase(recordToPersist);
    return mapped || recordToPersist;
  } catch (err) {
    markSupabaseOffline(err, 'recordFiscalAdjustmentSaleInSupabase');
    enqueueSyncAction('sale', 'INSERT', recordToPersist);
    return recordToPersist;
  }
};

export const pushPurchaseToSupabase = async (purchaseData) => {
  const payload = mapPurchaseToDb(purchaseData);
  const { data, error } = await upsertPurchaseRowWithSchemaFallback(payload);
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapPurchaseFromDb(data);
};

export const pushCashMovementToSupabase = async (movData) => {
  const payload = mapCashMovementToDb(movData);
  const { data, error } = await withTimeout(
    supabase.from('cash_movements').upsert([payload]).select().single(),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapCashMovementFromDb(data);
};

export const pushFiscalClosureToSupabase = async (closureData) => {
  const payload = mapFiscalClosureToDb(closureData);
  const { data, error } = await withTimeout(
    supabase.from('fiscal_closures').upsert([payload]).select().single(),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapFiscalClosureFromDb(data);
};

export const pushUserToSupabase = async (userData) => {
  const payload = mapUserToDb(userData);
  let { data, error } = await withTimeout(
    supabase.from('users').upsert([payload], { onConflict: 'id' }).select().single(),
    4000
  );
  if (error && error.message && error.message.includes('modulos')) {
    const { modulos, ...safePayload } = payload;
    const retry = await withTimeout(
      supabase.from('users').upsert([safePayload], { onConflict: 'id' }).select().single(),
      4000
    );
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapUserFromDb(data);
};

export const deleteSupabaseUserDirect = async (userId) => {
  const { error } = await withTimeout(
    supabase.from('users').delete().eq('id', userId),
    4000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const pushUserLogToSupabase = async (logData) => {
  const payload = mapUserLogToDb(logData);
  const { data, error } = await withTimeout(
    supabase.from('user_activity_logs').insert([payload]).select().single(),
    3000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return mapUserLogFromDb(data);
};

// ==========================================
//  SUPABASE - TESORERÍA, FACTURAS Y COBROS
// ==========================================

const CUSTOM_BANK_ACCOUNTS_STORAGE_KEY = 'signum_custom_bank_accounts_v1';
const DELETED_BANK_ACCOUNTS_STORAGE_KEY = 'signum_deleted_bank_accounts_v1';
const autoSyncedBankKeys = new Set();

const parseSafeIsoMs = (rawTs) => {
  if (!rawTs) return 0;
  const ms = Date.parse(rawTs);
  return Number.isFinite(ms) ? ms : 0;
};

const buildBankAccountFullRow = (r) => {
  if (!r) return null;
  const codCta = String(r.codCta || r.cod_cta || r.id?.replace(/^CTA-/i, '') || '01').trim();
  const id = String(r.id || `CTA-${codCta}`).trim();
  const numCta = String(r.numCta || r.num_cta || r.nroCta || r.nro_cta || '').trim();
  const bancoNombre = String(r.bancoNombre || r.banco_nombre || r.des_ban || r.desBan || '').trim();
  const cuentaANombreDe = String(
    r.cuentaANombreDe || r.cuenta_a_nombre_de || r.titular || 'GRUPO MOTORVEN, C.A.'
  ).trim() || 'GRUPO MOTORVEN, C.A.';

  // Si un upsert previo solo actualizó snake_case (fecha_actualizacion > fechaActualizacion),
  // respetar el saldo_bs nuevo (siempre que no sea el cero accidental sin saldoBs=0 del mismo segundo).
  const tsSnake = parseSafeIsoMs(r.fecha_actualizacion);
  const tsCamel = parseSafeIsoMs(r.fechaActualizacion);
  const snakeIsNewer = tsSnake > 0 && (tsCamel === 0 || tsSnake > tsCamel);

  const saldoBs = (
    snakeIsNewer &&
    r.saldo_bs !== undefined &&
    (Number(r.saldo_bs) !== 0 || Number(r.saldoBs ?? 0) === 0)
  )
    ? Number(r.saldo_bs)
    : Number(r.saldoBs ?? r.saldo_bs ?? 0);

  const saldoUsd = (
    snakeIsNewer &&
    r.saldo_usd !== undefined &&
    (Number(r.saldo_usd) !== 0 || Number(r.saldoUsd ?? 0) === 0)
  )
    ? Number(r.saldo_usd)
    : Number(r.saldoUsd ?? r.saldo_usd ?? 0);

  const fechaActualizacion = (snakeIsNewer ? r.fecha_actualizacion : (r.fechaActualizacion || r.fecha_actualizacion)) || new Date().toISOString();
  const opening = resolveOpeningBalanceMeta(r);

  return {
    id,
    codCta,
    cod_cta: codCta,
    co_ban: String(r.co_ban || r.coBan || codCta),
    coBan: String(r.coBan || r.co_ban || codCta),
    numCta,
    num_cta: numCta,
    nroCta: numCta,
    nro_cta: numCta,
    bancoNombre,
    banco_nombre: bancoNombre,
    desBan: bancoNombre,
    des_ban: bancoNombre,
    cuentaANombreDe,
    cuenta_a_nombre_de: cuentaANombreDe,
    titular: cuentaANombreDe,
    saldoBs,
    saldo_bs: saldoBs,
    saldoActual: saldoBs,
    saldo_actual: saldoBs,
    saldoConciliado: saldoBs,
    saldo_conciliado: saldoBs,
    saldoUsd,
    saldo_usd: saldoUsd,
    moneda: String(r.moneda || 'BS').trim().toUpperCase(),
    ...(opening.hasOpeningBalance
      ? {
          saldoInicialUsd: opening.saldoInicialUsd,
          saldo_inicial_usd: opening.saldoInicialUsd,
          saldoInicialBs: opening.saldoInicialBs,
          saldo_inicial_bs: opening.saldoInicialBs,
          fechaSaldoInicial: opening.fechaSaldoInicial,
          fecha_saldo_inicial: opening.fechaSaldoInicial,
          ...(opening.usuarioSaldoInicial
            ? { usuarioSaldoInicial: opening.usuarioSaldoInicial, usuario_saldo_inicial: opening.usuarioSaldoInicial }
            : {})
        }
      : {}),
    fechaActualizacion,
    fecha_actualizacion: fechaActualizacion
  };
};

const normalizeBankAccountRecord = (r) => buildBankAccountFullRow(r);

const mergeBankAccountsList = (remoteList = [], hasRemoteResponse = false) => {
  let customList = [];
  let deletedIds = new Set();
  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem(CUSTOM_BANK_ACCOUNTS_STORAGE_KEY);
      if (rawCustom) {
        const parsed = JSON.parse(rawCustom);
        if (Array.isArray(parsed)) customList = parsed;
      }
      const rawDel = localStorage.getItem(DELETED_BANK_ACCOUNTS_STORAGE_KEY);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (Array.isArray(parsedDel)) deletedIds = new Set(parsedDel.map(x => String(x).trim().toUpperCase()));
      }
    }
  } catch (_) {}

  const byCode = new Map();
  const remoteRawByCode = new Map();

  if (!hasRemoteResponse || !Array.isArray(remoteList) || remoteList.length === 0) {
    (REAL_PROFIT_BANK_ACCOUNTS || []).forEach(r => {
      const norm = normalizeBankAccountRecord(r);
      if (norm && !deletedIds.has(norm.id.toUpperCase()) && !deletedIds.has(norm.codCta.toUpperCase())) {
        byCode.set(norm.codCta.toUpperCase(), norm);
      }
    });
  }

  (remoteList || []).forEach(r => {
    const norm = normalizeBankAccountRecord(r);
    if (norm && !deletedIds.has(norm.id.toUpperCase()) && !deletedIds.has(norm.codCta.toUpperCase())) {
      const codeKey = norm.codCta.toUpperCase();
      remoteRawByCode.set(codeKey, r);
      const existing = byCode.get(codeKey);
      byCode.set(codeKey, {
        ...existing,
        ...norm,
        cuentaANombreDe: r.cuentaANombreDe || r.cuenta_a_nombre_de || r.titular || existing?.cuentaANombreDe || 'GRUPO MOTORVEN, C.A.',
        titular: r.cuentaANombreDe || r.cuenta_a_nombre_de || r.titular || existing?.titular || 'GRUPO MOTORVEN, C.A.'
      });
    }
  });

  const pendingBankQueueIds = new Set(
    getSyncQueue()
      .filter(q => q && (q.entity === 'profit_bank_account' || q.entity === 'bank_account') && q.action !== 'DELETE')
      .map(q => String(q.data?.codCta || q.data?.cod_cta || q.data?.id || '').replace(/^CTA-/i, '').toUpperCase())
  );

  const syncedToPrune = new Set();
  customList.forEach(r => {
    const norm = normalizeBankAccountRecord(r);
    if (!norm) return;
    const codeKey = norm.codCta.toUpperCase();
    if (deletedIds.has(norm.id.toUpperCase()) || deletedIds.has(codeKey)) return;

    const remoteNorm = byCode.get(codeKey);
    const remoteRaw = remoteRawByCode.get(codeKey);
    const custTs = parseSafeIsoMs(norm.fechaActualizacion);
    const remTs = parseSafeIsoMs(remoteNorm?.fechaActualizacion);
    const remoteMissingTitular =
      hasRemoteResponse &&
      remoteRaw &&
      !remoteRaw.cuentaANombreDe &&
      !remoteRaw.cuenta_a_nombre_de &&
      !remoteRaw.titular &&
      norm.cuentaANombreDe !== 'GRUPO MOTORVEN, C.A.';
    const remoteMissingCamel =
      hasRemoteResponse &&
      remoteRaw &&
      remoteRaw.fecha_actualizacion &&
      (!remoteRaw.fechaActualizacion || parseSafeIsoMs(remoteRaw.fecha_actualizacion) > parseSafeIsoMs(remoteRaw.fechaActualizacion));

    const hasPending = pendingBankQueueIds.has(codeKey);
    const shouldKeepLocal =
      !hasRemoteResponse ||
      !remoteNorm ||
      hasPending ||
      custTs > remTs ||
      (remoteMissingTitular && (custTs === 0 || custTs >= remTs - 10000));

    if (shouldKeepLocal) {
      byCode.set(codeKey, norm);
      // Si el servidor ya responde y el registro local quedó huérfano por fallo de subida previa o por campos faltantes, empujarlo automáticamente
      if (hasRemoteResponse && isNetworkOnline() && !autoSyncedBankKeys.has(codeKey) && (!remoteNorm || custTs > remTs || remoteMissingTitular || remoteMissingCamel)) {
        autoSyncedBankKeys.add(codeKey);
        pushProfitBankAccountToSupabase(norm).catch(() => {});
      }
    } else if (hasRemoteResponse && remoteNorm && remTs > custTs && !hasPending) {
      syncedToPrune.add(codeKey);
    }
  });

  if (syncedToPrune.size > 0 && typeof localStorage !== 'undefined') {
    try {
      const pruned = customList.filter(c => {
        const ck = String(c?.codCta || c?.cod_cta || c?.id?.replace(/^CTA-/i, '') || '').trim().toUpperCase();
        return !syncedToPrune.has(ck);
      });
      localStorage.setItem(CUSTOM_BANK_ACCOUNTS_STORAGE_KEY, JSON.stringify(pruned));
    } catch (_) {}
  }

  return Array.from(byCode.values()).sort((a, b) =>
    String(a.codCta || '').localeCompare(String(b.codCta || ''), undefined, { numeric: true })
  );
};

export const getSupabaseProfitBankAccounts = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_bank_accounts').select('*').order('cod_cta', { ascending: true }),
      10000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return mergeBankAccountsList(data || [], Array.isArray(data) && data.length > 0);
  } catch (err) {
    console.warn('[Supabase] Error cargando cuentas bancarias Profit:', err.message);
    return mergeBankAccountsList(REAL_PROFIT_BANK_ACCOUNTS, false);
  }
};

const CUSTOM_CASH_DESKS_STORAGE_KEY = 'signum_custom_cash_desks_v1';
const DELETED_CASH_DESKS_STORAGE_KEY = 'signum_deleted_cash_desks_v1';
const autoSyncedCashDeskIds = new Set();

const normalizeCashDeskRecord = (r) => {
  if (!r) return null;
  let coCaja = String(r.coCaja || r.co_caja || r.id || 'CAJA-01').trim().toUpperCase();
  if (/^CAJ-\d+$/i.test(coCaja)) {
    coCaja = coCaja.replace(/^CAJ-/i, 'CAJA-');
  }
  const id = String(r.id || coCaja.toLowerCase()).trim();
  const rawDesc = String(r.descripcion || r.des_caja || r.desCaja || '').trim();
  const descripcion = rawDesc || 'Caja Operativa';
  const moneda = r.moneda || 'USD';
  const responsable = r.responsable || 'Administración';
  const saldoUsd = round2(r.saldoUsd ?? r.saldo_usd ?? 0);
  const saldoBs = round2(r.saldoBs ?? r.saldo_bs ?? 0);
  const activa = r.activa !== false;
  const fechaActualizacion = r.fechaActualizacion || r.fecha_actualizacion || new Date().toISOString();
  const opening = resolveOpeningBalanceMeta(r);

  return {
    id,
    co_caja: coCaja,
    coCaja,
    descripcion,
    des_caja: descripcion,
    desCaja: descripcion,
    moneda,
    saldo_usd: saldoUsd,
    saldoUsd,
    saldo_bs: saldoBs,
    saldoBs,
    saldo_actual: saldoBs,
    saldoActual: saldoBs,
    responsable,
    activa,
    ...(opening.hasOpeningBalance
      ? {
          saldo_inicial_usd: opening.saldoInicialUsd,
          saldoInicialUsd: opening.saldoInicialUsd,
          saldo_inicial_bs: opening.saldoInicialBs,
          saldoInicialBs: opening.saldoInicialBs,
          fecha_saldo_inicial: opening.fechaSaldoInicial,
          fechaSaldoInicial: opening.fechaSaldoInicial,
          ...(opening.usuarioSaldoInicial
            ? { usuario_saldo_inicial: opening.usuarioSaldoInicial, usuarioSaldoInicial: opening.usuarioSaldoInicial }
            : {})
        }
      : {}),
    fecha_actualizacion: fechaActualizacion,
    fechaActualizacion
  };
};

const mergeCashDesksWithDefaultsAndLocal = (remoteList = [], hasRemoteResponse = false) => {
  const byId = new Map();
  let deletedIds = new Set();

  try {
    if (typeof localStorage !== 'undefined') {
      const rawDel = localStorage.getItem(DELETED_CASH_DESKS_STORAGE_KEY);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (Array.isArray(parsedDel)) deletedIds = new Set(parsedDel.map(String));
      }
    }
  } catch (_) {}

  // 1. Sembrar las 6 cajas oficiales base únicamente si el servidor está vacío o inaccesible
  if (!hasRemoteResponse || !Array.isArray(remoteList) || remoteList.length === 0) {
    (REAL_PROFIT_CASH_DESKS || []).forEach(base => {
      const norm = normalizeCashDeskRecord(base);
      if (norm && !deletedIds.has(norm.id) && !deletedIds.has(norm.coCaja)) {
        byId.set(norm.id, norm);
      }
    });
  }

  // 2. Superponer registros de Supabase
  (remoteList || []).forEach(rem => {
    const norm = normalizeCashDeskRecord(rem);
    if (norm && !deletedIds.has(norm.id) && !deletedIds.has(norm.coCaja)) {
      byId.set(norm.id, norm);
    }
  });

  // 3. Superponer cajas creadas o editadas localmente solo si son más recientes que Supabase o están en cola
  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem(CUSTOM_CASH_DESKS_STORAGE_KEY);
      if (rawCustom) {
        const parsedCustom = JSON.parse(rawCustom);
        if (Array.isArray(parsedCustom)) {
          const pendingDeskIds = new Set(
            getSyncQueue()
              .filter(q => q && (q.entity === 'profit_cash_desk' || q.entity === 'cash_desk') && q.action !== 'DELETE')
              .map(q => String(q.data?.id || q.data?.coCaja || '').toLowerCase())
          );
          const toPrune = new Set();
          parsedCustom.forEach(cust => {
            const norm = normalizeCashDeskRecord(cust);
            if (!norm || deletedIds.has(norm.id) || deletedIds.has(norm.coCaja)) return;
            const rem = byId.get(norm.id);
            const custTs = parseSafeIsoMs(norm.fechaActualizacion);
            const remTs = parseSafeIsoMs(rem?.fechaActualizacion);
            const isPending = pendingDeskIds.has(norm.id.toLowerCase()) || pendingDeskIds.has(norm.coCaja.toLowerCase());
            if (!hasRemoteResponse || !rem || isPending || custTs > remTs) {
              byId.set(norm.id, norm);
              if (hasRemoteResponse && isNetworkOnline() && !autoSyncedCashDeskIds.has(norm.id) && (!rem || custTs > remTs)) {
                autoSyncedCashDeskIds.add(norm.id);
                pushProfitCashDeskToSupabase(norm).catch(() => {});
              }
            } else if (hasRemoteResponse && rem && remTs > custTs && !isPending) {
              toPrune.add(norm.id);
            }
          });
          if (toPrune.size > 0) {
            const remaining = parsedCustom.filter(c => !toPrune.has(String(c?.id || c?.coCaja || '').toLowerCase()));
            localStorage.setItem(CUSTOM_CASH_DESKS_STORAGE_KEY, JSON.stringify(remaining));
          }
        }
      }
    }
  } catch (_) {}

  return Array.from(byId.values()).sort((a, b) =>
    String(a.coCaja || '').localeCompare(String(b.coCaja || ''), 'es', { numeric: true })
  );
};

export const getSupabaseProfitCashDesks = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_cash_desks').select('*').order('co_caja', { ascending: true }),
      10000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return mergeCashDesksWithDefaultsAndLocal(data || [], Array.isArray(data) && data.length > 0);
  } catch (err) {
    console.warn('[Supabase] Error cargando cajas registradoras Profit:', err.message);
    return mergeCashDesksWithDefaultsAndLocal(REAL_PROFIT_CASH_DESKS, false);
  }
};

export const pushProfitCashDeskToSupabase = async (cashDesk) => {
  const normalized = normalizeCashDeskRecord({
    ...cashDesk,
    id: cashDesk.id || String(cashDesk.coCaja || cashDesk.co_caja || 'caja-01').toLowerCase(),
    fechaActualizacion: cashDesk.fechaActualizacion || cashDesk.fecha_actualizacion || new Date().toISOString()
  });
  const { data, error } = await withTimeout(
    supabase.from('profit_cash_desks').upsert(normalized, { onConflict: 'id' }).select(),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return data;
};

export const deleteProfitCashDeskDirect = async (deskIdOrCode) => {
  const target = String(deskIdOrCode?.id || deskIdOrCode || '').trim();
  if (!target) return true;
  const upperTarget = target.toUpperCase();
  const { error } = await withTimeout(
    supabase.from('profit_cash_desks').delete().or(`id.eq.${target},id.eq.${target.toLowerCase()},co_caja.eq.${upperTarget},coCaja.eq.${upperTarget}`),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const updateSupabaseProfitCashDesk = async (cashDesk) => {
  const nowIso = new Date().toISOString();
  const targetId = cashDesk.id || String(cashDesk.coCaja || cashDesk.co_caja || 'caja-01').toLowerCase();
  const targetCode = String(cashDesk.coCaja || cashDesk.co_caja || targetId).trim().toUpperCase();
  let existingCached = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem(CUSTOM_CASH_DESKS_STORAGE_KEY);
      const customList = rawCustom ? JSON.parse(rawCustom) : [];
      if (Array.isArray(customList)) {
        existingCached = customList.find(
          item => String(item?.id || '').toLowerCase() === String(targetId).toLowerCase()
            || String(item?.coCaja || item?.co_caja || '').toUpperCase() === targetCode
        ) || null;
      }
    }
  } catch (_) {}

  const mergedWithOpening = mergeOpeningBalanceFields(cashDesk, existingCached, { nowIso });
  const normalized = normalizeCashDeskRecord({
    ...mergedWithOpening,
    id: targetId,
    fechaActualizacion: nowIso,
    fecha_actualizacion: nowIso
  });

  // Persistir inmediatamente en localStorage como respaldo instantáneo
  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem(CUSTOM_CASH_DESKS_STORAGE_KEY);
      const customList = rawCustom ? JSON.parse(rawCustom) : [];
      const filtered = Array.isArray(customList)
        ? customList.filter(item => item.id !== normalized.id && item.coCaja !== normalized.coCaja)
        : [];
      filtered.push(normalized);
      localStorage.setItem(CUSTOM_CASH_DESKS_STORAGE_KEY, JSON.stringify(filtered));

      const rawDel = localStorage.getItem(DELETED_CASH_DESKS_STORAGE_KEY);
      if (rawDel) {
        const delList = JSON.parse(rawDel);
        if (Array.isArray(delList)) {
          localStorage.setItem(
            DELETED_CASH_DESKS_STORAGE_KEY,
            JSON.stringify(delList.filter(k => k !== normalized.id && k !== normalized.coCaja))
          );
        }
      }
    }
  } catch (_) {}

  broadcastReconcileChange({
    tableId: 'cash_desks',
    action: 'RECONCILE',
    key: normalized.id,
    item: normalized
  });

  if (!isNetworkOnline()) {
    enqueueSyncAction('profit_cash_desk', 'UPDATE', normalized);
    return [normalized];
  }

  try {
    const data = await pushProfitCashDeskToSupabase(normalized);
    return data;
  } catch (err) {
    console.warn('[Supabase] Respaldo local encolado para caja registradora:', err.message);
    markSupabaseOffline(err, 'updateSupabaseProfitCashDesk');
    enqueueSyncAction('profit_cash_desk', 'UPDATE', normalized);
    return [normalized];
  }
};

export const deleteSupabaseProfitCashDesk = async (deskIdOrCode) => {
  const target = String(deskIdOrCode || '').trim();
  if (!target) return;

  try {
    if (typeof localStorage !== 'undefined') {
      const rawDel = localStorage.getItem(DELETED_CASH_DESKS_STORAGE_KEY);
      const delList = rawDel ? JSON.parse(rawDel) : [];
      const set = new Set(Array.isArray(delList) ? delList : []);
      set.add(target);
      set.add(target.toLowerCase());
      set.add(target.toUpperCase());
      localStorage.setItem(DELETED_CASH_DESKS_STORAGE_KEY, JSON.stringify(Array.from(set)));

      const rawCustom = localStorage.getItem(CUSTOM_CASH_DESKS_STORAGE_KEY);
      if (rawCustom) {
        const customList = JSON.parse(rawCustom);
        if (Array.isArray(customList)) {
          localStorage.setItem(
            CUSTOM_CASH_DESKS_STORAGE_KEY,
            JSON.stringify(customList.filter(c => c.id !== target && c.coCaja !== target))
          );
        }
      }
    }
  } catch (_) {}

  broadcastReconcileChange({
    tableId: 'cash_desks',
    action: 'DELETE',
    key: target
  });

  if (!isNetworkOnline()) {
    enqueueSyncAction('profit_cash_desk', 'DELETE', { id: target });
    return;
  }

  try {
    await deleteProfitCashDeskDirect(target);
  } catch (err) {
    console.warn('[Supabase] Baja local encolada para caja registradora:', err.message);
    markSupabaseOffline(err, 'deleteSupabaseProfitCashDesk');
    enqueueSyncAction('profit_cash_desk', 'DELETE', { id: target });
  }
};

const applyLocalCxcOverridesToInvoices = (rawList = [], hasRemoteResponse = false) => {
  try {
    const normalizedBase = (rawList || []).map(f => {
      if (!f) return f;
      const saldoUsdVal = f.saldoUsd !== undefined ? Number(f.saldoUsd) : (f.saldo_usd !== undefined ? Number(f.saldo_usd) : undefined);
      const abonosUsdVal = f.abonosUsd !== undefined ? Number(f.abonosUsd) : (f.abonos_usd !== undefined ? Number(f.abonos_usd) : undefined);
      const totNetoUsdVal = f.totNetoUsd ?? f.tot_neto_usd ?? f.totalNetoUsd;
      const totBrutoUsdVal = f.totBrutoUsd ?? f.tot_bruto_usd ?? f.totalBrutoUsd;
      const ivaUsdVal = f.ivaUsd ?? f.iva_usd;
      return {
        ...f,
        ...(saldoUsdVal !== undefined ? { saldoUsd: saldoUsdVal } : {}),
        ...(abonosUsdVal !== undefined ? { abonosUsd: abonosUsdVal } : {}),
        ...(totNetoUsdVal !== undefined ? { totNetoUsd: Number(totNetoUsdVal) } : {}),
        ...(totBrutoUsdVal !== undefined ? { totBrutoUsd: Number(totBrutoUsdVal) } : {}),
        ...(ivaUsdVal !== undefined ? { ivaUsd: Number(ivaUsdVal) } : {})
      };
    });

    if (typeof localStorage === 'undefined') return normalizedBase;
    const delSet = hasRemoteResponse
      ? reconcileCxcTombstonesWithServerDocs(normalizedBase)
      : new Set(sanitizeCxcDeletedDocsStorage());
    const rawCustom = localStorage.getItem('signum_cxc_custom_docs_v1');
    const customMap = rawCustom ? JSON.parse(rawCustom) : {};
    const customByCanon = new Map();
    if (customMap && typeof customMap === 'object') {
      Object.values(customMap).forEach(doc => {
        if (!doc) return;
        const cKey = getEraScopedCanonicalDocKey(doc);
        if (!cKey) return;
        const prevDoc = customByCanon.get(cKey);
        const prevTs = parseSafeIsoMs(prevDoc?.updated_at || prevDoc?.fechaSincronizacion || prevDoc?.fecha_sincronizacion);
        const curTs = parseSafeIsoMs(doc.updated_at || doc.fechaSincronizacion || doc.fecha_sincronizacion);
        if (!prevDoc || curTs >= prevTs) {
          customByCanon.set(cKey, doc);
        }
      });
    }

    const pendingInvIds = new Set();
    const pendingCanonKeys = new Set();
    getSyncQueue()
      .filter(q => q && (q.entity === 'profit_invoice' || q.entity === 'profit_invoices' || q.entity === 'sale' || q.entity === 'sales') && q.action !== 'DELETE')
      .forEach(q => {
        getScopedCxcDeleteKeys(q.data).forEach(k => pendingInvIds.add(k));
        const ck = getEraScopedCanonicalDocKey(q.data);
        if (ck) pendingCanonKeys.add(ck);
      });

    const matchedCustomKeys = new Set();
    const matchedCanonKeys = new Set();
    const keysToPrune = new Set();
    const result = [];
    const CXC_RECENT_LOCAL_GRACE_MS = 15 * 60 * 1000;
    const nowMs = Date.now();

    for (const inv of normalizedBase) {
      if (!inv) continue;
      if (isCxcEntryDeleted(inv, delSet)) {
        continue;
      }
      const idKey = String(inv.id || '').trim();
      const numKey = String(inv.factNum ?? inv.fact_num ?? inv.numeroDoc ?? '').trim();
      const invCanon = getEraScopedCanonicalDocKey(inv);
      const override = (idKey && customMap[idKey]) || (invCanon && customByCanon.get(invCanon)) || (numKey && customMap[numKey] && getEraScopedCanonicalDocKey(customMap[numKey]) === invCanon ? customMap[numKey] : null);
      if (override) {
        if (idKey) matchedCustomKeys.add(idKey);
        if (numKey) matchedCustomKeys.add(numKey);
        if (override.id) matchedCustomKeys.add(String(override.id));
        if (override.factNum) matchedCustomKeys.add(String(override.factNum));
        if (invCanon) matchedCanonKeys.add(invCanon);
        const ovCanon = getEraScopedCanonicalDocKey(override);
        if (ovCanon) matchedCanonKeys.add(ovCanon);

        const ovTs = parseSafeIsoMs(override.updated_at || override.fechaSincronizacion || override.fecha_sincronizacion);
        const remTs = parseSafeIsoMs(inv.updated_at || inv.fechaSincronizacion || inv.fecha_sincronizacion);
        const isPending =
          pendingInvIds.has(idKey) ||
          (numKey && pendingInvIds.has(numKey)) ||
          (invCanon && pendingCanonKeys.has(invCanon)) ||
          Boolean(override._pendingServerSync);
        const isRecentOverride = ovTs > 0 && (nowMs - ovTs) < CXC_RECENT_LOCAL_GRACE_MS;

        if (!hasRemoteResponse || isPending || (ovTs > remTs && isRecentOverride)) {
          result.push({ ...inv, ...override });
        } else {
          if (idKey && customMap[idKey]) keysToPrune.add(idKey);
          if (numKey && customMap[numKey]) keysToPrune.add(numKey);
          if (override.id && customMap[override.id]) keysToPrune.add(String(override.id));
          if (override.factNum && customMap[override.factNum]) keysToPrune.add(String(override.factNum));
          result.push(inv);
        }
      } else {
        result.push(inv);
      }
    }

    if (customMap && typeof customMap === 'object') {
      const addedCanon = new Set();
      Object.entries(customMap).forEach(([k, doc]) => {
        if (!doc) return;
        const dId = String(doc.id || k).trim();
        const dNum = String(doc.factNum ?? doc.fact_num ?? '').trim();
        const dCanon = getEraScopedCanonicalDocKey(doc);
        if (isCxcEntryDeleted(doc, delSet)) {
          keysToPrune.add(k);
          return;
        }
        const alreadyMatched =
          matchedCustomKeys.has(dId) ||
          (dNum && matchedCustomKeys.has(dNum)) ||
          (dCanon && matchedCanonKeys.has(dCanon));
        if (!alreadyMatched) {
          const dTs = parseSafeIsoMs(doc.updated_at || doc.fechaSincronizacion || doc.fecha_sincronizacion);
          const isRecentLocal = dTs > 0 && (nowMs - dTs) < CXC_RECENT_LOCAL_GRACE_MS;
          const isPending =
            pendingInvIds.has(dId) ||
            (dNum && pendingInvIds.has(dNum)) ||
            (dCanon && pendingCanonKeys.has(dCanon)) ||
            Boolean(doc._pendingServerSync) ||
            isRecentLocal;
          if (hasRemoteResponse && !isPending) {
            keysToPrune.add(k);
            if (dId && customMap[dId]) keysToPrune.add(dId);
            if (dNum && customMap[dNum]) keysToPrune.add(dNum);
            return;
          }
          const dedupToken = dCanon || dId || dNum;
          if (!addedCanon.has(dedupToken)) {
            addedCanon.add(dedupToken);
            result.unshift(doc);
          }
        }
      });
    }

    if (keysToPrune.size > 0) {
      try {
        keysToPrune.forEach(k => { delete customMap[k]; });
        localStorage.setItem('signum_cxc_custom_docs_v1', JSON.stringify(customMap));
      } catch (_) {}
    }

    return dedupeCanonicalDocs(result);
  } catch (_) {
    return rawList;
  }
};

export const pushOrderToSupabase = async (orderData) => {
  const orderPayload = mapOrderToDb(orderData);
  const { data: ord, error: ordErr } = await withTimeout(
    supabase.from('orders').upsert(orderPayload).select().single(),
    8000
  );
  if (ordErr) throw ordErr;
  if (orderData.items && orderData.items.length > 0) {
    const itemsPayload = orderData.items.map((it, idx) => ({
      id: `${ord.id}-${it.rengNum || idx + 1}`,
      order_id: ord.id,
      reng_num: it.rengNum || idx + 1,
      articulo_id: it.articuloId,
      articulo_descripcion: it.articuloDescripcion,
      unidad_venta: resolveProductUnit(it, 'Caja'),
      cantidad: Number(it.cantidad || 1),
      litros_unitarios: Number(it.litrosUnitarios || 1),
      litros_totales: Number(it.litrosTotales || (it.cantidad * (it.litrosUnitarios || 1))),
      precio_unitario_usd: Number(it.precioUnitarioUsd ?? it.precioUsd ?? it.precio_unitario_usd ?? 0),
      total_usd: Number(it.totalUsd ?? it.subtotalUsd ?? it.total_usd ?? ((Number(it.cantidad || 1)) * Number(it.precioUnitarioUsd ?? it.precioUsd ?? 0)))
    }));
    const { error: itemsErr } = await withTimeout(
      supabase.from('order_items').upsert(itemsPayload, { onConflict: 'id' }),
      8000
    );
    if (itemsErr) throw itemsErr;
  }
  isSupabaseAvailable = true;
  return ord;
};

export const updateOrderStatusDirect = async (orderId, newStatus) => {
  const { error } = await withTimeout(
    supabase.from('orders').update({ status: newStatus, estado: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const deleteSupabaseOrderDirect = async (orderId) => {
  const cleanId = String(orderId?.id || orderId || '').trim();
  if (!cleanId) return true;
  await withTimeout(
    supabase.from('order_items').delete().or(`order_id.eq.${cleanId},order_doc.eq.${cleanId}`),
    6000
  ).catch(() => {});
  const { error } = await withTimeout(
    supabase.from('orders').delete().or(`id.eq.${cleanId},numero_doc.eq.${cleanId}`),
    6000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const deleteSaleDirect = async (ref) => {
  const cleanId = String(ref?.id || ref || '').trim();
  const cleanNum = String(ref?.cleanNum || cleanId).replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
  const targetTipo = typeof ref === 'object' ? inferCxcDocType(ref) : (Boolean(ref?.isTargetNe) || /^(NE-|NDE-)/i.test(cleanId) ? 'NOTA_ENTREGA' : 'FACTURA');
  const isTargetNe = Boolean(ref?.isTargetNe) || targetTipo === 'NOTA_ENTREGA';
  const parts = [];
  if (cleanId) parts.push(`id.eq.${cleanId}`);
  if (cleanNum) {
    if (isTargetNe) {
      const neCode = `NE-${cleanNum}`;
      parts.push(`id.eq.${neCode}`, `numero_doc.eq.${neCode}`, `numero_doc.eq.${cleanNum}`);
    } else {
      parts.push(`numero_doc.eq.${cleanNum}`, `id.eq.${cleanNum}`);
    }
  }
  const uniqueParts = Array.from(new Set(parts));
  if (uniqueParts.length === 0) return true;
  const { data: saleMatches } = await withTimeout(
    supabase.from('sales').select('id,tipo_doc,tipoDoc,numero_doc,numeroDoc').or(uniqueParts.join(',')),
    5000
  ).catch(() => ({ data: null }));
  if (Array.isArray(saleMatches)) {
    const sameTypeIds = saleMatches
      .filter(r => r && r.id && inferCxcDocType(r) === targetTipo)
      .map(r => r.id);
    if (sameTypeIds.length === 0) {
      isSupabaseAvailable = true;
      return true;
    }
    const { error } = await withTimeout(
      supabase.from('sales').delete().in('id', sameTypeIds),
      8000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return true;
  }
  const { error } = await withTimeout(
    supabase.from('sales').delete().or(uniqueParts.join(',')),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const deleteProfitInvoiceDirect = async (ref) => {
  const cleanId = String(ref?.id || ref || '').trim();
  const cleanNum = String(ref?.cleanNum || cleanId).replace(/^(FAC-|FACT-|NE-|NDE-|fac-|doc-|inv-)/i, '').trim();
  const targetTipo = typeof ref === 'object' ? inferCxcDocType(ref) : (Boolean(ref?.isTargetNe) || /^(NE-|NDE-)/i.test(cleanId) ? 'NOTA_ENTREGA' : 'FACTURA');
  const isTargetNe = Boolean(ref?.isTargetNe) || targetTipo === 'NOTA_ENTREGA';
  const isTargetLegacy = typeof ref === 'object' ? isLegacyPreNovInvoice(ref) : /^fac-[1-9]\d{0,3}$/i.test(cleanId);
  const parts = [];
  if (cleanId) parts.push(`id.eq.${cleanId}`);
  if (cleanNum) {
    if (isTargetNe) {
      const neCode = `NE-${cleanNum}`;
      parts.push(`id.eq.${neCode}`, `fact_num.eq.${neCode}`, `fact_num.eq.${cleanNum}`);
    } else if (isTargetLegacy) {
      parts.push(`fact_num.eq.${cleanNum}`, `id.eq.FAC-${cleanNum}`, `id.eq.fac-${cleanNum}`);
    } else {
      parts.push(`id.eq.FAC-${cleanNum}`);
      if (cleanNum.length >= 6) {
        parts.push(`id.eq.${cleanNum}`, `factNum.eq.${cleanNum}`);
      }
    }
  }
  const uniqueParts = Array.from(new Set(parts));
  if (uniqueParts.length === 0) return true;
  const { data: invMatches } = await withTimeout(
    supabase.from('profit_invoices').select('id,tipo_doc,tipoDoc,fechaEmision,fec_emis,fact_num,factNum').or(uniqueParts.join(',')),
    5000
  ).catch(() => ({ data: null }));
  const sameEraAndTypeIds = Array.isArray(invMatches)
    ? invMatches
        .filter(r => r && r.id && inferCxcDocType(r) === targetTipo && isLegacyPreNovInvoice(r) === isTargetLegacy)
        .map(r => r.id)
    : [];
  if (Array.isArray(invMatches)) {
    if (sameEraAndTypeIds.length === 0) {
      isSupabaseAvailable = true;
      return true;
    }
    const { error } = await withTimeout(
      supabase.from('profit_invoices').delete().in('id', sameEraAndTypeIds),
      8000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return true;
  }
  const { error } = await withTimeout(
    supabase.from('profit_invoices').delete().or(uniqueParts.join(',')),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

const CXC_COLLECTIONS_DELETED_KEY = 'signum_deleted_cxc_collections_v1';

const getDeletedProfitCollectionIds = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CXC_COLLECTIONS_DELETED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((id) => String(id || '').trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
};

const markProfitCollectionDeleted = (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId || typeof localStorage === 'undefined') return;
  try {
    const list = getDeletedProfitCollectionIds();
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      localStorage.setItem(CXC_COLLECTIONS_DELETED_KEY, JSON.stringify(list));
    }
  } catch (_) {}
};

const unmarkProfitCollectionDeleted = (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId || typeof localStorage === 'undefined') return;
  try {
    const list = getDeletedProfitCollectionIds();
    const next = list.filter((x) => x !== cleanId);
    if (next.length !== list.length) {
      localStorage.setItem(CXC_COLLECTIONS_DELETED_KEY, JSON.stringify(next));
    }
  } catch (_) {}
};

const getEffectiveDeletedProfitCollectionSet = () => {
  const set = new Set(getDeletedProfitCollectionIds());
  try {
    getSyncQueue()
      .filter((q) => q && (q.entity === 'profit_collection' || q.entity === 'profit_collections') && q.action === 'DELETE' && q.data?.id)
      .forEach((q) => set.add(String(q.data.id).trim()));
  } catch (_) {}
  return set;
};

const normalizeFallbackColRecord = (c) => {
  const formas = c.formas_pago || c.formasPago || [];
  const firstForma = Array.isArray(formas) && formas.length > 0 ? formas[0] : null;
  return {
    ...c,
    cobNum: c.cob_num ?? c.cobNum,
    fecha: c.fec_cob ?? c.fecha,
    clienteId: c.cliente_id ?? c.clienteId,
    clienteNombre: c.cliente_nombre ?? c.clienteNombre,
    clienteRif: c.cliente_rif ?? c.clienteRif,
    vendedorId: c.vendedor_id ?? c.vendedorId ?? c.co_ven ?? '',
    vendedorNombre: c.vendedor_nombre ?? c.vendedorNombre ?? '',
    cobradorId: c.cobrador_id ?? c.cobradorId ?? c.vendedor_id ?? c.vendedorId ?? '',
    cobradorNombre: c.cobrador_nombre ?? c.cobradorNombre ?? c.vendedor_nombre ?? c.vendedorNombre ?? '',
    correlativo: String(c.correlativo || '').trim() || String(c.cob_num ?? c.cobNum ?? '').trim(),
    montoUsd: normalizeProfitCollectionUsd(c),
    montoBs: Number(c.monto_bs ?? c.montoBs ?? 0),
    tasa: Number(c.tasa || 1),
    tipoTasa: c.tipo_tasa ?? c.tipoTasa ?? firstForma?.tipoTasa ?? '',
    tasaPago: Number(c.tasa_pago ?? c.tasaPago ?? c.tasa ?? 1),
    monedaPago: c.moneda_pago ?? c.monedaPago ?? (Number(c.monto_bs ?? c.montoBs ?? 0) <= 0 && String(c.tipo_tasa ?? c.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    cuentaId: c.cuenta_id ?? c.cuentaId ?? firstForma?.cuentaId ?? '',
    cuentaNombre: c.cuenta_nombre ?? c.cuentaNombre ?? firstForma?.cuentaNombre ?? '',
    formaPago: c.forma_pago ?? c.formaPago ?? firstForma?.formaPago ?? '',
    referencia: c.referencia ?? firstForma?.referencia ?? '',
    descrip: c.descrip ?? '',
    anulado: Boolean(c.anulado),
    formasPago: formas,
    documentosAfectados: c.documentos_afectados || c.documentosAfectados || [],
    fechaSincronizacion: c.fecha_sincronizacion ?? c.fechaSincronizacion
  };
};

export const getSupabaseProfitCollections = async () => {
  const deletedSet = getEffectiveDeletedProfitCollectionSet();
  try {
    const { data, error } = await runSupabaseQueryWithRetry(
      () => supabase.from('profit_collections').select('*').order('fec_cob', { ascending: false }).limit(5000),
      45000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const normalizeColRecord = (c) => {
      const tasaRaw = Number(c.tasa_pago ?? c.tasaPago ?? c.tasa ?? 1);
      const montoBsVal = Number(c.monto_bs ?? c.montoBs ?? 0);
      const rawUsdVal = Number(c.monto_usd ?? c.montoUsd ?? 0);
      const normalizedUsd = normalizeProfitCollectionUsd({
        montoUsd: rawUsdVal,
        montoBs: montoBsVal,
        tasa: tasaRaw
      });
      const formas = c.formas_pago || c.formasPago || [];
      const firstForma = Array.isArray(formas) && formas.length > 0 ? formas[0] : null;
      return {
        id: c.id,
        cobNum: c.cob_num ?? c.cobNum,
        correlativo: String(c.correlativo || '').trim() || String(c.cob_num ?? c.cobNum ?? '').trim(),
        fecha: c.fec_cob ?? c.fecha,
        clienteId: c.cliente_id ?? c.clienteId,
        clienteNombre: c.cliente_nombre ?? c.clienteNombre,
        clienteRif: c.cliente_rif ?? c.clienteRif,
        vendedorId: c.vendedor_id ?? c.vendedorId ?? c.co_ven ?? '',
        vendedorNombre: c.vendedor_nombre ?? c.vendedorNombre ?? '',
        cobradorId: c.cobrador_id ?? c.cobradorId ?? c.vendedor_id ?? c.vendedorId ?? '',
        cobradorNombre: c.cobrador_nombre ?? c.cobradorNombre ?? c.vendedor_nombre ?? c.vendedorNombre ?? '',
        montoUsd: normalizedUsd,
        montoBs: montoBsVal,
        tasa: Number(c.tasa || 1),
        tipoTasa: c.tipo_tasa ?? c.tipoTasa ?? firstForma?.tipoTasa ?? '',
        tasaPago: Number(c.tasa_pago ?? c.tasaPago ?? c.tasa ?? 1),
        monedaPago: c.moneda_pago ?? c.monedaPago ?? (montoBsVal <= 0 && String(c.tipo_tasa ?? c.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
        cuentaId: c.cuenta_id ?? c.cuentaId ?? firstForma?.cuentaId ?? '',
        cuentaNombre: c.cuenta_nombre ?? c.cuentaNombre ?? firstForma?.cuentaNombre ?? '',
        formaPago: c.forma_pago ?? c.formaPago ?? firstForma?.formaPago ?? '',
        referencia: c.referencia ?? firstForma?.referencia ?? '',
        descrip: c.descrip ?? '',
        anulado: Boolean(c.anulado),
        formasPago: formas,
        documentosAfectados: c.documentos_afectados || c.documentosAfectados || [],
        fechaSincronizacion: c.fecha_sincronizacion ?? c.fechaSincronizacion
      };
    };
    const isVisibleCol = (c) => c && !c.anulado && !deletedSet.has(String(c.id || '').trim());
    const mapped = (data || []).map(normalizeColRecord).filter(isVisibleCol);
    try {
      if (typeof localStorage !== 'undefined') {
        const rawLocalCobs = localStorage.getItem('signum_cxc_collections_v1');
        const localCobs = rawLocalCobs ? JSON.parse(rawLocalCobs) : [];
        if (Array.isArray(localCobs) && localCobs.length > 0) {
          const pendingColIds = new Set(
            getSyncQueue()
              .filter(q => q && (q.entity === 'profit_collection' || q.entity === 'profit_collections') && q.action !== 'DELETE')
              .map(q => String(q.data?.id || '').trim())
              .filter(Boolean)
          );
          const localById = new Map();
          const remainingLocal = [];
          localCobs.forEach((lc) => {
            if (!lc || !lc.id) return;
            const lcId = String(lc.id).trim();
            if (deletedSet.has(lcId)) return;
            localById.set(lcId, lc);
          });
          const mergedMapped = mapped.map((m) => {
            const lc = localById.get(String(m.id));
            if (!lc) return m;
            const lcTs = Date.parse(lc._localEditedAt || lc.fechaSincronizacion || lc.fecha_sincronizacion || '') || 0;
            const mTs = Date.parse(m.fechaSincronizacion || '') || 0;
            const isPending = Boolean(lc._pendingServerSync) || pendingColIds.has(String(lc.id));
            localById.delete(String(m.id));
            if ((lc._localEditedAt && lcTs > mTs) || isPending) {
              remainingLocal.push(lc);
              return { ...m, ...lc };
            }
            // Confirmado en servidor y sin edición local más reciente: purgar del caché local
            return m;
          });
          const extras = [];
          localById.forEach((lc) => {
            const lcId = String(lc.id || '').trim();
            if (!lcId || deletedSet.has(lcId) || lc.anulado) return;
            const isPending = Boolean(lc._pendingServerSync) || (lcId && pendingColIds.has(lcId));
            if (isPending) {
              remainingLocal.push(lc);
              extras.push(normalizeFallbackColRecord(lc));
            }
          });
          localStorage.setItem('signum_cxc_collections_v1', JSON.stringify(remainingLocal));
          return [...extras, ...mergedMapped].filter(isVisibleCol);
        }
      }
    } catch (_) {}
    return mapped;
  } catch (err) {
    console.warn('[Supabase] Error cargando cobros Profit:', err.message);
    const isVisibleCol = (c) => c && !c.anulado && !deletedSet.has(String(c.id || '').trim());
    try {
      if (typeof localStorage !== 'undefined') {
        const rawLocalCobs = localStorage.getItem('signum_cxc_collections_v1');
        const localCobs = rawLocalCobs ? JSON.parse(rawLocalCobs) : [];
        if (Array.isArray(localCobs) && localCobs.length > 0) {
          const visibleLocal = localCobs.filter(isVisibleCol).map(normalizeFallbackColRecord);
          const localIds = new Set(visibleLocal.filter(x => x && x.id).map(x => String(x.id)));
          const rest = (REAL_PROFIT_COLLECTIONS || [])
            .filter(r => r && !localIds.has(String(r.id)) && isVisibleCol(r))
            .map(normalizeFallbackColRecord);
          return markStaticFallback([...visibleLocal, ...rest]);
        }
      }
    } catch (_) {}
    return markStaticFallback((REAL_PROFIT_COLLECTIONS || []).filter(isVisibleCol).map(normalizeFallbackColRecord));
  }
};

export const pushProfitCollectionToSupabase = async (normalized) => {
  const { error } = await withTimeout(
    supabase.from('profit_collections').upsert(normalized, { onConflict: 'id' }),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return normalized;
};

export const deleteProfitCollectionDirect = async (colOrId) => {
  const targetId = String(typeof colOrId === 'object' ? (colOrId?.id || '') : (colOrId || '')).trim();
  if (!targetId) return true;
  const { error } = await withTimeout(
    supabase.from('profit_collections').delete().eq('id', targetId),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const saveSupabaseProfitCollection = async (collectionData) => {
  const nowIso = new Date().toISOString();
  const cobNum = collectionData.cobNum || collectionData.cob_num || Math.floor(4000 + Math.random() * 90000);
  const id = collectionData.id || `cob-${cobNum}`;
  unmarkProfitCollectionDeleted(id);
  const amounts = normalizeCollectionWriteAmounts({
    montoUsd: collectionData.montoUsd ?? collectionData.monto_usd ?? 0,
    montoBs: collectionData.montoBs ?? collectionData.monto_bs ?? 0,
    tasa: collectionData.tasa || 1
  });
  const firstForma = Array.isArray(collectionData.formasPago) && collectionData.formasPago.length > 0
    ? collectionData.formasPago[0]
    : null;
  const resolvedFormaPago = collectionData.formaPago || collectionData.forma_pago || firstForma?.formaPago || '';
  const resolvedReferencia = collectionData.referencia ?? firstForma?.referencia ?? '';
  const normalized = {
    id,
    cobNum,
    cob_num: cobNum,
    correlativo: String(collectionData.correlativo || '').trim() || String(cobNum ?? '').trim(),
    fecha: collectionData.fecha || nowIso,
    fec_cob: collectionData.fecha || nowIso,
    clienteId: collectionData.clienteId || '',
    cliente_id: collectionData.clienteId || '',
    clienteNombre: collectionData.clienteNombre || 'Cliente General',
    cliente_nombre: collectionData.clienteNombre || 'Cliente General',
    clienteRif: collectionData.clienteRif || '',
    cliente_rif: collectionData.clienteRif || '',
    vendedorId: collectionData.vendedorId || 'OF',
    vendedor_id: collectionData.vendedorId || 'OF',
    vendedorNombre: collectionData.vendedorNombre || collectionData.vendedor_nombre || '',
    cobradorId: collectionData.cobradorId || collectionData.cobrador_id || collectionData.vendedorId || 'OF',
    cobradorNombre: collectionData.cobradorNombre || collectionData.cobrador_nombre || collectionData.vendedorNombre || '',
    montoUsd: amounts.montoUsd,
    monto_usd: amounts.montoUsd,
    montoBs: amounts.montoBs,
    monto_bs: amounts.montoBs,
    tasa: amounts.tasa,
    tipoTasa: collectionData.tipoTasa || collectionData.tipo_tasa || firstForma?.tipoTasa || 'BCV',
    tipo_tasa: collectionData.tipo_tasa || collectionData.tipoTasa || firstForma?.tipoTasa || 'BCV',
    tasaPago: Number(collectionData.tasaPago ?? collectionData.tasa_pago ?? amounts.tasa ?? 1),
    tasa_pago: Number(collectionData.tasaPago ?? collectionData.tasa_pago ?? amounts.tasa ?? 1),
    monedaPago: collectionData.monedaPago || collectionData.moneda_pago || (String(collectionData.tipoTasa || '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    moneda_pago: collectionData.monedaPago || collectionData.moneda_pago || (String(collectionData.tipoTasa || '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    cuentaId: collectionData.cuentaId || '',
    cuenta_id: collectionData.cuentaId || '',
    cuentaNombre: collectionData.cuentaNombre || '',
    cuenta_nombre: collectionData.cuentaNombre || '',
    formaPago: resolvedFormaPago,
    referencia: resolvedReferencia,
    descrip: collectionData.descrip || '',
    anulado: false,
    formasPago: collectionData.formasPago || [],
    formas_pago: collectionData.formasPago || [],
    documentosAfectados: collectionData.documentosAfectados || [],
    documentos_afectados: collectionData.documentosAfectados || [],
    fechaSincronizacion: nowIso,
    fecha_sincronizacion: nowIso
  };

  const writeCollectionLocal = (pendingFlag) => {
    try {
      if (typeof localStorage === 'undefined') return;
      const rawLocalCobs = localStorage.getItem('signum_cxc_collections_v1');
      const localCobs = rawLocalCobs ? JSON.parse(rawLocalCobs) : [];
      const filtered = Array.isArray(localCobs) ? localCobs.filter(c => String(c?.id) !== String(id)) : [];
      if (pendingFlag) {
        const localEntry = collectionData._localEditedAt
          ? { ...normalized, _localEditedAt: collectionData._localEditedAt, _pendingServerSync: true }
          : { ...normalized, _pendingServerSync: true };
        filtered.unshift(localEntry);
      }
      localStorage.setItem('signum_cxc_collections_v1', JSON.stringify(filtered));
    } catch (_) {}
  };
  writeCollectionLocal(true);

  broadcastReconcileChange({
    tableId: 'collections',
    action: 'RECONCILE',
    key: id,
    item: normalized
  });

  if (!isNetworkOnline()) {
    enqueueSyncAction('profit_collection', 'INSERT', normalized);
    return normalized;
  }

  try {
    await pushProfitCollectionToSupabase(normalized);
    writeCollectionLocal(false);
  } catch (err) {
    console.warn('[saveSupabaseProfitCollection] Encolado para reintento:', err.message);
    markSupabaseOffline(err, 'saveSupabaseProfitCollection');
    enqueueSyncAction('profit_collection', 'INSERT', normalized);
  }

  return normalized;
};

export const deleteSupabaseProfitCollection = async (colOrId) => {
  const targetId = String(typeof colOrId === 'object' ? (colOrId?.id || '') : (colOrId || '')).trim();
  if (!targetId) return false;

  markProfitCollectionDeleted(targetId);

  try {
    if (typeof localStorage !== 'undefined') {
      const rawLocalCobs = localStorage.getItem('signum_cxc_collections_v1');
      const localCobs = rawLocalCobs ? JSON.parse(rawLocalCobs) : [];
      if (Array.isArray(localCobs)) {
        const filtered = localCobs.filter((c) => String(c?.id || '').trim() !== targetId);
        localStorage.setItem('signum_cxc_collections_v1', JSON.stringify(filtered));
      }
    }
  } catch (_) {}

  const emit = () => {
    broadcastReconcileChange({
      tableId: 'collections',
      action: 'DELETE',
      key: targetId,
      item: { id: targetId }
    });
  };

  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('profit_collection', 'DELETE', { id: targetId });
    emit();
    return true;
  }

  try {
    await deleteProfitCollectionDirect(targetId);
    emit();
    return true;
  } catch (err) {
    console.warn('[deleteSupabaseProfitCollection] Encolado para reintento:', err?.message || err);
    markSupabaseOffline(err, 'deleteSupabaseProfitCollection');
    enqueueSyncAction('profit_collection', 'DELETE', { id: targetId });
    emit();
    return true;
  }
};

export const pushProfitBankAccountToSupabase = async (bankAcc) => {
  const fullRow = buildBankAccountFullRow(bankAcc);
  if (!fullRow) return null;
  const { error } = await withTimeout(
    supabase.from('profit_bank_accounts').upsert(fullRow, { onConflict: 'id' }),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return fullRow;
};

export const deleteProfitBankAccountDirect = async (ref) => {
  const target = String(ref?.id || ref || '').trim();
  if (!target) return true;
  const upperTarget = target.toUpperCase();
  const codeTarget = String(ref?.codeTarget || upperTarget.replace(/^CTA-/i, '')).trim();
  const { error } = await withTimeout(
    supabase
      .from('profit_bank_accounts')
      .delete()
      .or(`id.eq.${target},cod_cta.eq.${codeTarget},codCta.eq.${codeTarget},id.eq.CTA-${codeTarget}`),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return true;
};

export const updateSupabaseProfitBankAccount = async (bankAcc) => {
  if (!bankAcc) return null;
  const nowIso = new Date().toISOString();
  const targetCode = String(bankAcc.codCta || bankAcc.cod_cta || bankAcc.id?.replace(/^CTA-/i, '') || '').trim().toUpperCase();
  const targetId = String(bankAcc.id || (targetCode ? `CTA-${targetCode}` : '')).trim().toUpperCase();
  let existingCached = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem(CUSTOM_BANK_ACCOUNTS_STORAGE_KEY);
      const customList = rawCustom ? JSON.parse(rawCustom) : [];
      if (Array.isArray(customList)) {
        existingCached = customList.find(
          c => String(c?.id || '').toUpperCase() === targetId || String(c?.codCta || c?.cod_cta || '').toUpperCase() === targetCode
        ) || null;
      }
    }
  } catch (_) {}

  const mergedWithOpening = mergeOpeningBalanceFields(bankAcc, existingCached, { nowIso });
  const normalized = buildBankAccountFullRow({
    ...mergedWithOpening,
    fechaActualizacion: nowIso,
    fecha_actualizacion: nowIso
  });
  if (!normalized) return null;

  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem(CUSTOM_BANK_ACCOUNTS_STORAGE_KEY);
      const customList = rawCustom ? JSON.parse(rawCustom) : [];
      const arr = Array.isArray(customList) ? customList : [];
      const filtered = arr.filter(
        c => String(c.id || '').toUpperCase() !== normalized.id.toUpperCase() &&
             String(c.codCta || '').toUpperCase() !== normalized.codCta.toUpperCase()
      );
      filtered.push(normalized);
      localStorage.setItem(CUSTOM_BANK_ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));

      const rawDel = localStorage.getItem(DELETED_BANK_ACCOUNTS_STORAGE_KEY);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (Array.isArray(parsedDel)) {
          localStorage.setItem(
            DELETED_BANK_ACCOUNTS_STORAGE_KEY,
            JSON.stringify(
              parsedDel.filter(
                x => String(x).toUpperCase() !== normalized.id.toUpperCase() &&
                     String(x).toUpperCase() !== normalized.codCta.toUpperCase()
              )
            )
          );
        }
      }
    }
  } catch (_) {}

  broadcastReconcileChange({
    tableId: 'bank_accounts',
    action: 'RECONCILE',
    key: normalized.id,
    item: normalized
  });

  if (!isNetworkOnline()) {
    enqueueSyncAction('profit_bank_account', 'UPDATE', normalized);
    return normalized;
  }

  try {
    await pushProfitBankAccountToSupabase(normalized);
    return normalized;
  } catch (err) {
    console.warn('[updateSupabaseProfitBankAccount] Encolado para sincronizar:', err.message);
    markSupabaseOffline(err, 'updateSupabaseProfitBankAccount');
    enqueueSyncAction('profit_bank_account', 'UPDATE', normalized);
    return normalized;
  }
};

export const fetchTreasuryOpeningBalancesHistory = async () => {
  const baseUrl = String(currentBackendUrl || OFFICIAL_BACKEND_URL).trim().replace(/\/+$/, '');
  const url = `${baseUrl}/api/treasury/opening-balances-history`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const tid = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      },
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {})
    });
    if (tid) clearTimeout(tid);
    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${errTxt ? `: ${errTxt.slice(0, 120)}` : ''}`);
    }
    return await res.json();
  } catch (err) {
    if (tid) clearTimeout(tid);
    throw err;
  }
};

export const deleteSupabaseProfitBankAccount = async (bankIdOrCode) => {
  const target = String(bankIdOrCode || '').trim();
  if (!target) return false;
  const upperTarget = target.toUpperCase();
  const codeTarget = upperTarget.replace(/^CTA-/i, '');

  try {
    if (typeof localStorage !== 'undefined') {
      const rawDel = localStorage.getItem(DELETED_BANK_ACCOUNTS_STORAGE_KEY);
      const delList = rawDel ? JSON.parse(rawDel) : [];
      const set = new Set(Array.isArray(delList) ? delList.map(x => String(x).toUpperCase()) : []);
      set.add(upperTarget);
      set.add(codeTarget);
      set.add(`CTA-${codeTarget}`);
      localStorage.setItem(DELETED_BANK_ACCOUNTS_STORAGE_KEY, JSON.stringify(Array.from(set)));

      const rawCustom = localStorage.getItem(CUSTOM_BANK_ACCOUNTS_STORAGE_KEY);
      if (rawCustom) {
        const customList = JSON.parse(rawCustom);
        if (Array.isArray(customList)) {
          localStorage.setItem(
            CUSTOM_BANK_ACCOUNTS_STORAGE_KEY,
            JSON.stringify(
              customList.filter(
                c => String(c.id || '').toUpperCase() !== upperTarget &&
                     String(c.codCta || '').toUpperCase() !== codeTarget
              )
            )
          );
        }
      }
    }
  } catch (_) {}

  try {
    broadcastReconcileChange({
      tableId: 'bank_accounts',
      action: 'DELETE',
      key: upperTarget.startsWith('CTA-') ? upperTarget : `CTA-${codeTarget}`
    });
  } catch (_) {}

  if (!isNetworkOnline()) {
    enqueueSyncAction('profit_bank_account', 'DELETE', { id: target, codeTarget });
    return true;
  }

  try {
    await deleteProfitBankAccountDirect({ id: target, codeTarget });
  } catch (err) {
    console.warn('[Supabase] Baja local encolada para cuenta bancaria:', err.message);
    markSupabaseOffline(err, 'deleteSupabaseProfitBankAccount');
    enqueueSyncAction('profit_bank_account', 'DELETE', { id: target, codeTarget });
  }
  return true;
};

export const getSupabaseProfitInvoices = async () => {
  try {
    const { data, error } = await runSupabaseQueryWithRetry(
      () => supabase.from('profit_invoices').select('*').order('fec_emis', { ascending: false }).limit(5000),
      45000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = (data || []).map(f => {
      const rawId = String(f.id ?? '').trim();
      const rawFactNum = (f.factNum !== undefined && f.factNum !== null && String(f.factNum).trim() !== '')
        ? String(f.factNum).trim()
        : (f.fact_num !== undefined && f.fact_num !== null && String(f.fact_num).trim() !== ''
            ? String(f.fact_num).trim()
            : rawId);
      const isNePrefix =
        rawId.toUpperCase().startsWith('NE-') ||
        rawFactNum.toUpperCase().startsWith('NE-') ||
        rawFactNum.toUpperCase().startsWith('NDE-');
      const resolvedTipoDoc = isNePrefix
        ? 'NOTA_ENTREGA'
        : (f.tipo_doc ?? f.tipoDoc ?? 'FACTURA');
      const isAnnulledInv = Boolean(
        f.anulada ||
        f.anulado ||
        ['ANULADA', 'ANULADO', 'VOID'].includes(String(f.status || '').toUpperCase().trim()) ||
        ['ANULADA', 'ANULADO', 'VOID'].includes(String(f.estado || '').toUpperCase().trim())
      );
      return {
        id: f.id,
        factNum: rawFactNum,
        numeroControl: f.numero_control ?? f.numeroControl ?? '',
        tipoDoc: resolvedTipoDoc,
        seriesEra: f.series_era ?? f.seriesEra ?? '',
      fechaEmision: f.fec_emis ?? f.fechaEmision,
      fechaVencimiento: f.fec_venc ?? f.fechaVencimiento,
      diasCredito: f.dias_credito ?? f.diasCredito,
      diasVencidoCustom: f.dias_vencido_custom ?? f.diasVencidoCustom,
      clienteId: f.cliente_id ?? f.clienteId ?? f.co_cli,
      clienteNombre: f.cliente_nombre ?? f.clienteNombre ?? f.cli_des,
      clienteRif: f.cliente_rif ?? f.clienteRif ?? f.rif,
      clienteDireccion: f.cliente_direccion ?? f.clienteDireccion ?? f.dir_ent ?? '',
      clienteTelefono: f.cliente_telefono ?? f.clienteTelefono ?? '',
      vendedorId: f.vendedor_id ?? f.vendedorId ?? f.co_ven,
      vendedorNombre: f.vendedor_nombre ?? f.vendedorNombre ?? f.ven_des ?? '',
      condicionPago: f.condicion_pago ?? f.condicionPago ?? '',
      metodoPago: f.metodo_pago ?? f.metodoPago ?? '',
      totBrutoUsd: Number(f.tot_bruto_usd ?? f.totBrutoUsd ?? f.totalBrutoUsd ?? 0),
      totBrutoBs: Number(f.tot_bruto_bs ?? f.totBrutoBs ?? f.tot_bruto ?? f.totalBruto ?? 0),
      ivaUsd: Number(f.iva_usd ?? f.ivaUsd ?? 0),
      ivaBs: Number(f.iva_bs ?? f.ivaBs ?? f.iva ?? 0),
      totNetoUsd: Number(f.tot_neto_usd ?? f.totNetoUsd ?? f.totalNetoUsd ?? 0),
      totNetoBs: Number(f.tot_neto_bs ?? f.totNetoBs ?? f.tot_neto ?? f.totalNeto ?? 0),
      abonosUsd: f.abonos_usd !== undefined ? Number(f.abonos_usd) : (f.abonosUsd !== undefined ? Number(f.abonosUsd) : undefined),
      abonosBs: f.abonos_bs !== undefined ? Number(f.abonos_bs) : (f.abonosBs !== undefined ? Number(f.abonosBs) : undefined),
      saldoUsd: isAnnulledInv ? 0 : Number(f.saldo_usd ?? f.saldoUsd ?? 0),
      saldoBs: (() => {
        if (isAnnulledInv) return 0;
        const sUsd = Number(f.saldo_usd ?? f.saldoUsd ?? 0);
        const st = String(f.status || f.estado || '').toUpperCase().trim();
        if (f.anulada || f.anulado || sUsd <= 0.01 && (st === 'COBRADA' || st === 'COBRADO' || st === 'PAGADA' || st === 'PAGADO' || f.saldo_usd !== undefined)) {
          return Number(f.saldo_bs ?? 0);
        }
        return Number(f.saldo_bs ?? f.saldoBs ?? f.saldo ?? 0);
      })(),
      tasa: Number(f.tasa ?? f.tasa_dolar ?? f.tasaDolar ?? 0),
      tipoTasa: normalizeRateType(f.tipo_tasa ?? f.tipoTasa, {
        tipoDoc: resolvedTipoDoc,
        monedaPago: f.moneda_pago ?? f.monedaPago,
        fallback: 'BCV'
      }),
      tasaPago: Number(f.tasa_pago ?? f.tasaPago ?? f.tasa ?? f.tasa_dolar ?? f.tasaDolar ?? 0),
      monedaPago: f.moneda_pago ?? f.monedaPago ?? (String(f.tipo_tasa ?? f.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
      status: isAnnulledInv ? 'ANULADA' : (f.status ?? f.estado),
      estado: isAnnulledInv ? 'ANULADA' : (f.estado ?? f.status),
      anulada: isAnnulledInv,
      anulado: isAnnulledInv,
      motivoAnulacion: f.motivo_anulacion ?? f.motivoAnulacion ?? '',
      anuladaPor: f.anulada_por ?? f.anuladaPor ?? '',
      fechaAnulacion: f.fecha_anulacion ?? f.fechaAnulacion ?? null,
      formaPago: f.forma_pag ?? f.formaPago,
      totalLitros: Number(f.total_litros ?? f.totalLitros ?? 0),
      totalCajas: Number(f.total_cajas ?? f.totalCajas ?? 0),
      fechaUltimoCobro: f.fecha_ultimo_cobro ?? f.fechaUltimoCobro ?? f.fecha_cobro_total ?? f.fechaCobroTotal ?? null,
      items: f.items || [],
      observaciones: f.observaciones ?? f.descrip ?? '',
      historialCobros: f.historial_cobros ?? f.historialCobros ?? [],
      fechaSincronizacion: f.fecha_sincronizacion ?? f.fechaSincronizacion,
      updatedAt: f.updated_at ?? f.updatedAt ?? f.fecha_sincronizacion ?? f.fechaSincronizacion ?? null,
      createdAt: f.created_at ?? f.createdAt ?? null
      };
    });
    return applyLocalCxcOverridesToInvoices(mapped, Array.isArray(mapped) && mapped.length > 0);
  } catch (err) {
    console.warn('[Supabase] Error cargando facturas Profit:', err.message);
    return markStaticFallback(applyLocalCxcOverridesToInvoices(REAL_PROFIT_INVOICES, false));
  }
};

export const pushProfitInvoiceToSupabase = async (payload, { skipSalesSync = false, previousDoc = null } = {}) => {
  if (!payload) return null;
  const { _pendingServerSync, _createdOffline, ...cleanPayload } = payload;
  const id = cleanPayload.id;
  const rawNum = String(cleanPayload.factNum ?? cleanPayload.fact_num ?? cleanPayload.numeroDoc ?? cleanPayload.id ?? '').trim();

  const { error: invErr } = await withTimeout(
    supabase.from('profit_invoices').upsert(cleanPayload, { onConflict: 'id' }),
    8000
  );
  if (invErr) throw invErr;

  if (!skipSalesSync && rawNum) {
    const isCreditDoc = Number(cleanPayload.diasCredito || 0) > 0 || String(cleanPayload.condicionPago || '').toUpperCase().includes('CREDITO');
    const isAnnulledDoc = Boolean(
      cleanPayload.anulada ||
      cleanPayload.anulado ||
      ['ANULADA', 'ANULADO', 'VOID'].includes(String(cleanPayload.status || cleanPayload.estado || '').toUpperCase())
    );
    const resolvedCtrl = cleanPayload.numeroControl || formatDocumentControlNumber(rawNum, cleanPayload.tipoDoc);
    const resolvedEra = cleanPayload.seriesEra || cleanPayload.series_era || '';
    const salesUpdatePayload = {
      numero_doc: cleanPayload.numeroDoc || rawNum,
      numero_control: resolvedCtrl,
      tipo_doc: cleanPayload.tipoDoc,
      ...(resolvedEra ? { series_era: resolvedEra } : {}),
      cliente_id: cleanPayload.clienteId,
      cliente_nombre: cleanPayload.clienteNombre,
      cliente_rif: cleanPayload.clienteRif,
      tasa_dolar: cleanPayload.tasa,
      subtotal_usd: cleanPayload.totBrutoUsd,
      iva_usd: cleanPayload.ivaUsd,
      total_usd: cleanPayload.totNetoUsd,
      subtotal_bs: cleanPayload.totBrutoBs,
      iva_bs: cleanPayload.ivaBs,
      total_bs: cleanPayload.totNetoBs,
      saldo_usd: isAnnulledDoc ? 0 : cleanPayload.saldoUsd,
      saldo_bs: isAnnulledDoc ? 0 : cleanPayload.saldoBs,
      dias_credito: cleanPayload.diasCredito,
      condicion_pago: cleanPayload.condicionPago || (isCreditDoc ? 'CREDITO' : 'CONTADO'),
      metodo_pago: cleanPayload.metodoPago || (isCreditDoc ? 'CREDITO' : 'EFECTIVO_USD'),
      fecha: cleanPayload.fechaEmision,
      fecha_emision: cleanPayload.fechaEmision,
      fecha_vencimiento: cleanPayload.fechaVencimiento,
      vendedor: cleanPayload.vendedorNombre || cleanPayload.vendedor || '',
      estado: isAnnulledDoc ? 'ANULADA' : (cleanPayload.saldoUsd <= 0.01 ? 'COBRADA' : 'PENDIENTE')
    };
    if (Array.isArray(cleanPayload.items) && cleanPayload.items.length > 0) {
      salesUpdatePayload.items = cleanPayload.items;
    }
    const buildSalesOrCandidates = (docRef) => {
      if (!docRef) return [];
      const dId = docRef.id;
      const dNum = String(docRef.factNum ?? docRef.fact_num ?? docRef.numeroDoc ?? docRef.id ?? '').trim();
      const dIsNe =
        String(docRef.tipoDoc || docRef.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' ||
        dNum.toUpperCase().startsWith('NE-') ||
        String(dId || '').toUpperCase().startsWith('NE-');
      const cleanD = dNum.replace(/\D/g, '');
      const unpaddedD = cleanD ? String(Number(cleanD)) : '';
      const paddedD = cleanD ? cleanD.padStart(6, '0') : '';
      return dIsNe
        ? [
            dId && `id.eq.${dId}`,
            dNum && `id.eq.${dNum}`,
            dNum && `numero_doc.eq.${dNum}`,
            paddedD && `id.eq.NE-${paddedD}`,
            paddedD && `numero_doc.eq.NE-${paddedD}`,
            unpaddedD && `numero_doc.eq.NE-${unpaddedD}`
          ]
        : [
            dId && `id.eq.${dId}`,
            dNum && `id.eq.${dNum}`,
            dNum && `numero_doc.eq.${dNum}`,
            paddedD && `id.eq.${paddedD}`,
            paddedD && `numero_doc.eq.${paddedD}`,
            paddedD && `id.eq.FAC-${paddedD}`,
            ...(isLegacyPreNovInvoice(docRef) && unpaddedD ? [`id.eq.${unpaddedD}`, `numero_doc.eq.${unpaddedD}`, `id.eq.fac-${unpaddedD}`] : [])
          ];
    };
    const prevId = String(previousDoc?.id || '').trim();
    const targetId = String(cleanPayload.id || '').trim();
    const isIdChanged = Boolean(prevId && targetId && prevId.toUpperCase() !== targetId.toUpperCase());
    const hasExplicitSeriesEra = Boolean(resolvedEra);
    const docOrCandidates = (isIdChanged || hasExplicitSeriesEra)
      ? `id.eq.${targetId}`
      : Array.from(new Set([
          ...buildSalesOrCandidates(previousDoc),
          ...buildSalesOrCandidates({ id, factNum: rawNum, tipoDoc: cleanPayload.tipoDoc, fechaEmision: cleanPayload.fechaEmision })
        ].filter(Boolean))).join(',');
    const updateRes = await withTimeout(
      supabase.from('sales').update(salesUpdatePayload).or(docOrCandidates).select('id'),
      6000
    ).catch(() => null);

    if (!updateRes?.data || updateRes.data.length === 0) {
      const saleRow = mapSaleToDb({
        id: cleanPayload.id,
        numeroDoc: cleanPayload.numeroDoc || rawNum,
        numeroControl: resolvedCtrl,
        tipoDoc: cleanPayload.tipoDoc,
        ...(resolvedEra ? { seriesEra: resolvedEra } : {}),
        fecha: cleanPayload.fechaEmision,
        fechaEmision: cleanPayload.fechaEmision,
        fechaVencimiento: cleanPayload.fechaVencimiento,
        diasCredito: cleanPayload.diasCredito,
        clienteId: cleanPayload.clienteId,
        clienteNombre: cleanPayload.clienteNombre,
        clienteRif: cleanPayload.clienteRif,
        clienteDireccion: cleanPayload.clienteDireccion,
        clienteTelefono: cleanPayload.clienteTelefono,
        vendedor: cleanPayload.vendedorNombre || cleanPayload.vendedor || '',
        tasaDolar: cleanPayload.tasa,
        condicionPago: cleanPayload.condicionPago || (isCreditDoc ? 'CREDITO' : 'CONTADO'),
        subtotalUsd: cleanPayload.totBrutoUsd,
        baseExentaUsd: cleanPayload.isExento ? cleanPayload.totBrutoUsd : 0,
        baseGeneralUsd: cleanPayload.isExento ? 0 : cleanPayload.totBrutoUsd,
        ivaGeneralUsd: cleanPayload.ivaUsd,
        ivaUsd: cleanPayload.ivaUsd,
        totalUsd: cleanPayload.totNetoUsd,
        subtotalBs: cleanPayload.totBrutoBs,
        baseExentaBs: cleanPayload.isExento ? cleanPayload.totBrutoBs : 0,
        baseGeneralBs: cleanPayload.isExento ? 0 : cleanPayload.totBrutoBs,
        ivaGeneralBs: cleanPayload.ivaBs,
        ivaBs: cleanPayload.ivaBs,
        totalBs: cleanPayload.totNetoBs,
        saldoUsd: cleanPayload.saldoUsd,
        saldoBs: cleanPayload.saldoBs,
        estado: cleanPayload.saldoUsd <= 0.01 ? 'PAGADO' : 'PENDIENTE',
        metodoPago: cleanPayload.metodoPago || (isCreditDoc ? 'CREDITO' : 'TRANSFERENCIA_BS'),
        items: cleanPayload.items || []
      });
      const { error: saleUpsertErr } = await withTimeout(
        supabase.from('sales').upsert([saleRow], { onConflict: 'id' }),
        6000
      );
      if (saleUpsertErr) throw saleUpsertErr;
    }
  }

  unmarkCxcDeletedDoc(cleanPayload);

  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem('signum_cxc_custom_docs_v1');
      if (rawCustom) {
        const customMap = JSON.parse(rawCustom);
        if (customMap && typeof customMap === 'object') {
          let changed = false;
          if (id && customMap[id]) {
            customMap[id] = { ...customMap[id], _pendingServerSync: false };
            changed = true;
          }
          if (rawNum && customMap[rawNum]) {
            customMap[rawNum] = { ...customMap[rawNum], _pendingServerSync: false };
            changed = true;
          }
          if (changed) {
            localStorage.setItem('signum_cxc_custom_docs_v1', JSON.stringify(customMap));
          }
        }
      }
    }
  } catch (_) {}

  isSupabaseAvailable = true;
  return cleanPayload;
};

export const saveSupabaseProfitInvoice = async (docData, options = {}) => {
  if (!docData || isPermanentlyPurgedDuplicateDoc(docData)) return null;
  const nowIso = new Date().toISOString();
  const rawNumInput = String(docData.factNum ?? docData.fact_num ?? docData.numeroDoc ?? docData.id ?? '').trim();
  const isNotaEntrega =
    String(docData.tipoDoc || docData.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' ||
    rawNumInput.toUpperCase().startsWith('NE-') ||
    String(docData.id || '').toUpperCase().startsWith('NE-');
  const bareDigits = rawNumInput.replace(/^(FAC-|FACT-|INV-|NE-|doc-)/i, '').trim();
  const normalizedNum = /^\d+$/.test(bareDigits) && bareDigits.length < 6 ? bareDigits.padStart(6, '0') : bareDigits || rawNumInput;
  const rawNum = normalizedNum;
  const defaultCanonicalId = isNotaEntrega
    ? (rawNum.toUpperCase().startsWith('NE-') ? rawNum : `NE-${rawNum}`)
    : rawNum;
  const id = String(docData.id || defaultCanonicalId).trim();

  // En Notas de Entrega no se calcula IVA ni ningún impuesto (100% Sin IVA)
  const rawNeto = Number(docData.totNetoUsd ?? docData.tot_neto_usd ?? docData.totalUsd ?? docData.totBrutoUsd ?? docData.tot_bruto_usd ?? 0);
  const rawIva = Number(docData.ivaUsd ?? docData.iva_usd ?? 0);
  const rawBruto = Number(docData.totBrutoUsd ?? docData.tot_bruto_usd ?? docData.subtotalUsd ?? (isNotaEntrega ? (rawIva > 0 && rawNeto > rawIva ? rawNeto - rawIva : rawNeto) : rawNeto));
  const totBrutoUsd = isNotaEntrega
    ? Number((rawBruto > 0 && rawBruto < rawNeto ? rawBruto : (rawIva > 0 && rawNeto > rawIva ? rawNeto - rawIva : rawBruto)).toFixed(2))
    : Number(rawBruto.toFixed(2));
  const ivaUsd = isNotaEntrega ? 0 : Number(rawIva.toFixed(2));
  const totNetoUsd = isNotaEntrega
    ? totBrutoUsd
    : Number((docData.totNetoUsd ?? docData.tot_neto_usd ?? (totBrutoUsd + ivaUsd)).toFixed(2));
  const tasa = Number(docData.tasa ?? docData.tasaDolar ?? 827.73) || 827.73;
  const abonosUsd = docData.abonosUsd !== undefined
    ? Number(docData.abonosUsd)
    : Math.max(0, Number((totNetoUsd - Number(docData.saldoUsd ?? totNetoUsd)).toFixed(2)));
  const saldoUsd = Math.max(0, Number((docData.saldoUsd !== undefined ? Number(docData.saldoUsd) : (totNetoUsd - abonosUsd)).toFixed(2)));

  const resolvedFechaEmision = preserveDateWithTime(docData.fechaEmision || docData.fec_emis || nowIso, nowIso);
  const emDateOnly = parseInvoiceDateInfo(resolvedFechaEmision).isoDateOnly || nowIso.slice(0, 10);
  const rawVenc = docData.fechaVencimiento || docData.fec_venc;
  const vmDateOnly = typeof rawVenc === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVenc) ? rawVenc.slice(0, 10) : null;
  const rawDc = Number(docData.diasCredito ?? docData.dias_credito ?? 0);
  const hasExplicitContadoCond = String(docData.condicionPago || '').toUpperCase().trim() === 'CONTADO';
  const hasExplicitPaidZeroCredit =
    docData.diasCredito !== undefined &&
    rawDc === 0 &&
    !isCreditPaymentCondition(docData.condicionPago, docData.metodoPago) &&
    (!isNotaEntrega || Number(docData.saldoUsd ?? 0) <= 0.01 || docData.formaPago === '01');
  const isExplicitContado = hasExplicitContadoCond || hasExplicitPaidZeroCredit;

  const resolvedDiasCredito = (() => {
    if (isExplicitContado) return 0;
    if (vmDateOnly && emDateOnly) {
      const dE = new Date(`${emDateOnly}T12:00:00`);
      const dV = new Date(`${vmDateOnly}T12:00:00`);
      if (!isNaN(dE.getTime()) && !isNaN(dV.getTime())) {
        const diff = Math.round((dV.getTime() - dE.getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0) return diff;
      }
    }
    return rawDc > 0 ? rawDc : 15;
  })();

  const resolvedFechaVencimiento = (() => {
    if (isExplicitContado) return emDateOnly;
    if (vmDateOnly && vmDateOnly !== emDateOnly) return vmDateOnly;
    const dObj = new Date(`${emDateOnly}T12:00:00`);
    if (!isNaN(dObj.getTime())) {
      dObj.setDate(dObj.getDate() + resolvedDiasCredito);
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return vmDateOnly || emDateOnly;
  })();

  const {
    totalNetoUsd: _legacyTotNetoUsd,
    totalNeto: _legacyTotalNeto,
    totalFacturaUsd: _legacyTotalFacturaUsd,
    totalFacturaBs: _legacyTotalFacturaBs,
    saldo: _legacySaldo,
    saldoPendiente: _legacySaldoPendiente,
    saldoPendienteUsd: _legacySaldoPendienteUsd,
    saldoPendienteBs: _legacySaldoPendienteBs,
    restanteUsd: _legacyRestanteUsd,
    montoFacturaUsd: _legacyMontoFacturaUsd,
    montoPagadoUsd: _legacyMontoPagadoUsd,
    rawTotalNetoBs: _legacyRawTotalNetoBs,
    originalTotalNetoUsd: _legacyOriginalTotalNetoUsd,
    ...cleanDocFields
  } = docData;

  const payload = {
    ...cleanDocFields,
    id,
    factNum: rawNum,
    fact_num: isNaN(Number(rawNum)) ? rawNum : Number(rawNum),
    numeroDoc: isNotaEntrega ? (rawNum.toUpperCase().startsWith('NE-') ? rawNum : `NE-${rawNum}`) : rawNum,
    tipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
    tipo_doc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
    fechaEmision: resolvedFechaEmision,
    fec_emis: resolvedFechaEmision,
    fechaVencimiento: resolvedFechaVencimiento,
    fec_venc: resolvedFechaVencimiento,
    diasCredito: resolvedDiasCredito,
    dias_credito: resolvedDiasCredito,
    condicionPago: isExplicitContado ? 'CONTADO' : (docData.condicionPago || 'CREDITO'),
    diasVencidoCustom: docData.diasVencidoCustom ?? docData.dias_vencido_custom ?? null,
    dias_vencido_custom: docData.diasVencidoCustom ?? docData.dias_vencido_custom ?? null,
    clienteId: docData.clienteId || docData.cliente_id || docData.clienteRif || 'CLI-GEN',
    cliente_id: docData.clienteId || docData.cliente_id || docData.clienteRif || 'CLI-GEN',
    co_cli: docData.clienteId || docData.cliente_id || docData.clienteRif || 'CLI-GEN',
    clienteNombre: docData.clienteNombre || docData.cliente_nombre || 'Cliente General',
    cliente_nombre: docData.clienteNombre || docData.cliente_nombre || 'Cliente General',
    cli_des: docData.clienteNombre || docData.cliente_nombre || 'Cliente General',
    clienteRif: docData.clienteRif || docData.cliente_rif || 'V-00000000',
    cliente_rif: docData.clienteRif || docData.cliente_rif || 'V-00000000',
    rif: docData.clienteRif || docData.cliente_rif || 'V-00000000',
    clienteDireccion: docData.clienteDireccion || docData.cliente_direccion || docData.direccion || '',
    cliente_direccion: docData.clienteDireccion || docData.cliente_direccion || docData.direccion || '',
    clienteTelefono: docData.clienteTelefono || docData.cliente_telefono || docData.telefono || '',
    cliente_telefono: docData.clienteTelefono || docData.cliente_telefono || docData.telefono || '',
    numeroControl: docData.numeroControl || docData.numero_control || formatDocumentControlNumber(rawNum, isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA'),
    numero_control: docData.numeroControl || docData.numero_control || formatDocumentControlNumber(rawNum, isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA'),
    ...(docData.seriesEra || docData.series_era ? { seriesEra: docData.seriesEra || docData.series_era, series_era: docData.seriesEra || docData.series_era } : {}),
    isExento: Boolean(docData.isExento ?? docData.is_exento ?? isNotaEntrega),
    is_exento: Boolean(docData.isExento ?? docData.is_exento ?? isNotaEntrega),
    vendedorId: docData.vendedorId || docData.vendedor_id || 'OF',
    vendedor_id: docData.vendedorId || docData.vendedor_id || 'OF',
    co_ven: docData.vendedorId || docData.vendedor_id || 'OF',
    vendedorNombre: docData.vendedorNombre || docData.vendedor_nombre || '',
    vendedor_nombre: docData.vendedorNombre || docData.vendedor_nombre || '',
    totBrutoUsd,
    totalBrutoUsd: totBrutoUsd,
    tot_bruto_usd: totBrutoUsd,
    tot_bruto: Number((totBrutoUsd * tasa).toFixed(2)),
    totalBruto: Number((totBrutoUsd * tasa).toFixed(2)),
    totBrutoBs: Number((totBrutoUsd * tasa).toFixed(2)),
    tot_bruto_bs: Number((totBrutoUsd * tasa).toFixed(2)),
    ivaUsd,
    iva_usd: ivaUsd,
    ivaBs: Number((ivaUsd * tasa).toFixed(2)),
    iva_bs: Number((ivaUsd * tasa).toFixed(2)),
    totNetoUsd,
    totalNetoUsd: totNetoUsd,
    tot_neto_usd: totNetoUsd,
    tot_neto: Number((totNetoUsd * tasa).toFixed(2)),
    totalNeto: Number((totNetoUsd * tasa).toFixed(2)),
    totNetoBs: Number((totNetoUsd * tasa).toFixed(2)),
    tot_neto_bs: Number((totNetoUsd * tasa).toFixed(2)),
    abonosUsd,
    abonos_usd: abonosUsd,
    abonosBs: Number((abonosUsd * tasa).toFixed(2)),
    abonos_bs: Number((abonosUsd * tasa).toFixed(2)),
    saldoUsd,
    saldo_usd: saldoUsd,
    saldoBs: Number((saldoUsd * tasa).toFixed(2)),
    saldo_bs: Number((saldoUsd * tasa).toFixed(2)),
    tasa,
    tipoTasa: normalizeRateType(docData.tipoTasa ?? docData.tipo_tasa, {
      tipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
      monedaPago: docData.monedaPago ?? docData.moneda_pago,
      fallback: 'BCV'
    }),
    tipo_tasa: normalizeRateType(docData.tipo_tasa ?? docData.tipoTasa, {
      tipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
      monedaPago: docData.moneda_pago ?? docData.monedaPago,
      fallback: 'BCV'
    }),
    tasaPago: Number(docData.tasaPago ?? docData.tasa_pago ?? tasa ?? 0),
    tasa_pago: Number(docData.tasa_pago ?? docData.tasaPago ?? tasa ?? 0),
    monedaPago: docData.monedaPago ?? docData.moneda_pago ?? (String(docData.tipoTasa ?? docData.tipo_tasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    moneda_pago: docData.moneda_pago ?? docData.monedaPago ?? (String(docData.tipo_tasa ?? docData.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    status: saldoUsd <= 0.01 ? 'COBRADA' : 'PENDIENTE',
    anulada: false,
    fechaUltimoCobro: saldoUsd <= 0.01
      ? (docData.fechaUltimoCobro || docData.fecha_ultimo_cobro || nowIso.split('T')[0])
      : (docData.fechaUltimoCobro || docData.fecha_ultimo_cobro || null),
    fecha_ultimo_cobro: saldoUsd <= 0.01
      ? (docData.fecha_ultimo_cobro || docData.fechaUltimoCobro || nowIso.split('T')[0])
      : (docData.fecha_ultimo_cobro || docData.fechaUltimoCobro || null),
    totalLitros: resolveInvoiceLitros(docData),
    total_litros: resolveInvoiceLitros(docData),
    totalCajas: resolveInvoiceCajas(docData),
    total_cajas: resolveInvoiceCajas(docData),
    formaPago: docData.formaPago || docData.forma_pag || (Number(docData.diasCredito || 0) > 0 ? '03' : '01'),
    forma_pag: docData.formaPago || docData.forma_pag || (Number(docData.diasCredito || 0) > 0 ? '03' : '01'),
    observaciones: docData.observaciones || '',
    historialCobros: docData.historialCobros || docData.historial_cobros || [],
    historial_cobros: docData.historialCobros || docData.historial_cobros || [],
    fechaSincronizacion: nowIso,
    fecha_sincronizacion: nowIso,
    updated_at: nowIso
  };

  unmarkCxcDeletedDoc(payload);

  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem('signum_cxc_custom_docs_v1');
      const customMap = rawCustom ? JSON.parse(rawCustom) : {};
      const pendingPayload = { ...payload, _pendingServerSync: true };
      const canonCacheKey = getEraScopedCanonicalDocKey(payload);
      customMap[id] = pendingPayload;
      if (canonCacheKey) customMap[canonCacheKey] = pendingPayload;
      localStorage.setItem('signum_cxc_custom_docs_v1', JSON.stringify(customMap));
    }
  } catch (_) {}

  broadcastReconcileChange({
    tableId: 'invoices',
    action: 'RECONCILE',
    key: id,
    item: payload
  });

  if (rawNum) {
    broadcastReconcileChange({
      tableId: 'sales',
      action: 'RECONCILE',
      key: payload.id || rawNum,
      item: {
        id: payload.id,
        numeroDoc: payload.numeroDoc || rawNum,
        numeroControl: payload.numeroControl,
        tipoDoc: payload.tipoDoc,
        ...(payload.seriesEra ? { seriesEra: payload.seriesEra } : {}),
        clienteId: payload.clienteId,
        clienteNombre: payload.clienteNombre,
        clienteRif: payload.clienteRif,
        tasaDolar: payload.tasa,
        subtotalUsd: payload.totBrutoUsd,
        ivaUsd: payload.ivaUsd,
        totalUsd: payload.totNetoUsd,
        subtotalBs: payload.totBrutoBs,
        ivaBs: payload.ivaBs,
        totalBs: payload.totNetoBs,
        saldoUsd: payload.saldoUsd,
        saldoBs: payload.saldoBs,
        diasCredito: payload.diasCredito,
        fechaEmision: payload.fechaEmision,
        fechaVencimiento: payload.fechaVencimiento,
        vendedor: payload.vendedorNombre,
        estado: payload.saldoUsd <= 0.01 ? 'COBRADA' : 'PENDIENTE'
      }
    });
  }

  if (isNetworkOnline()) {
    try {
      await pushProfitInvoiceToSupabase(payload, options);
    } catch (err) {
      console.warn('[saveSupabaseProfitInvoice] Encolando para sincronización posterior:', err.message);
      markSupabaseOffline(err);
      enqueueSyncAction('profit_invoice', 'UPDATE', payload);
    }
  } else {
    enqueueSyncAction('profit_invoice', 'UPDATE', payload);
  }

  // Asegurar persistencia local en signum_sales_v1
  if (rawNum) {
    try {
      saveStorageSale({
        id: payload.id,
        numeroDoc: payload.numeroDoc || rawNum,
        numeroControl: payload.numeroControl || formatDocumentControlNumber(rawNum, payload.tipoDoc),
        tipoDoc: payload.tipoDoc,
        ...(payload.seriesEra ? { seriesEra: payload.seriesEra } : {}),
        fecha: payload.fechaEmision,
        fechaEmision: payload.fechaEmision,
        fechaVencimiento: payload.fechaVencimiento,
        diasCredito: payload.diasCredito,
        clienteId: payload.clienteId,
        clienteNombre: payload.clienteNombre,
        clienteRif: payload.clienteRif,
        clienteDireccion: payload.clienteDireccion,
        clienteTelefono: payload.clienteTelefono,
        vendedor: payload.vendedorNombre || payload.vendedor || '',
        tasaDolar: payload.tasa,
        subtotalUsd: payload.totBrutoUsd,
        ivaUsd: payload.ivaUsd,
        totalUsd: payload.totNetoUsd,
        subtotalBs: payload.totBrutoBs,
        ivaBs: payload.ivaBs,
        totalBs: payload.totNetoBs,
        saldoUsd: payload.saldoUsd,
        saldoBs: payload.saldoBs,
        abonosUsd: payload.abonosUsd,
        abonosBs: payload.abonosBs,
        condicionPago: payload.condicionPago || (Number(payload.diasCredito || 0) > 0 ? 'CREDITO' : 'CONTADO'),
        metodoPago: payload.metodoPago || (Number(payload.diasCredito || 0) > 0 ? 'CREDITO' : 'EFECTIVO_USD'),
        estado: payload.saldoUsd <= 0.01 ? 'PAGADO' : 'PENDIENTE',
        items: payload.items || []
      }, { skipStockAdjustment: true });
    } catch (_) {}
  }

  return payload;
};

/**
 * Actualiza los datos de una Factura o Nota de Entrega existente (correlativo, fecha/hora de emisión,
 * cliente, vendedor, montos, condición de pago, etc.) sin revertir inventario si cambia el correlativo.
 */
export const updateSupabaseInvoiceDocument = async (originalDoc, updatedDocData, options = {}) => {
  if (!updatedDocData) return null;
  const { skipInventoryAdjustment = false } = options || {};
  let effectiveOriginalDoc = originalDoc;
  if (isNetworkOnline() && originalDoc?.id) {
    try {
      const { data: srvInv } = await withTimeout(
        supabase.from('profit_invoices').select('id,tipo_doc,tipoDoc,items,updated_at').eq('id', String(originalDoc.id)).maybeSingle(),
        3500
      );
      if (srvInv && Array.isArray(srvInv.items) && srvInv.items.length > 0) {
        effectiveOriginalDoc = {
          ...originalDoc,
          tipoDoc: srvInv.tipo_doc || srvInv.tipoDoc || originalDoc.tipoDoc,
          items: srvInv.items,
          updatedAt: srvInv.updated_at || originalDoc.updatedAt
        };
      }
    } catch (_) {}
  }

  if (!skipInventoryAdjustment) {
    const oldTipo = resolveOutgoingDocType(effectiveOriginalDoc);
    const newTipo = resolveOutgoingDocType(updatedDocData);
    const editDeltaLines = buildInvoiceEditStockDeltaLines(effectiveOriginalDoc, updatedDocData);

    if (editDeltaLines.length > 0) {
      try {
        const editDocKey = String(effectiveOriginalDoc?.id || effectiveOriginalDoc?.factNum || updatedDocData?.id || '').trim();
        const revToken = String(
          effectiveOriginalDoc?.updatedAt ||
          effectiveOriginalDoc?.updated_at ||
          effectiveOriginalDoc?.fechaSincronizacion ||
          effectiveOriginalDoc?.fecha_sincronizacion ||
          Date.now()
        ).trim();
        const whSwapKey = editDocKey ? `edit_inv_${editDocKey}_${oldTipo}_to_${newTipo}_${revToken}` : '';
        await applyStockDeltaForWarehouseLines(editDeltaLines, {
          validateStrict: false,
          idempotencyKey: whSwapKey
        });
      } catch (whErr) {
        console.warn('[updateSupabaseInvoiceDocument] Aviso ajustando inventario al editar documento:', whErr?.message);
      }
    }
  }

  const saved = await saveSupabaseProfitInvoice(updatedDocData, { previousDoc: effectiveOriginalDoc });
  if (!saved) return null;

  const oldId = String(originalDoc?.id || '').trim();
  const oldNum = String(originalDoc?.factNum ?? originalDoc?.fact_num ?? originalDoc?.numeroDoc ?? '').trim();
  const oldEraKey = getEraScopedCanonicalDocKey(originalDoc);
  const newId = String(saved.id || '').trim();
  const newNum = String(saved.factNum || saved.numeroDoc || '').trim();
  const newEraKey = getEraScopedCanonicalDocKey(saved);
  const idChanged = Boolean(oldId && newId && oldId.toUpperCase() !== newId.toUpperCase());
  const numChanged = Boolean(oldNum && newNum && oldNum.toUpperCase() !== newNum.toUpperCase());
  const eraChanged = Boolean(oldEraKey && newEraKey && oldEraKey !== newEraKey);

  if (idChanged || numChanged || eraChanged) {
    // Limpiar entradas antiguas en localStorage sin revertir stock y sin colisión cruzada por tipo/era
    try {
      if (idChanged || eraChanged) deleteStorageSale(originalDoc, { skipStockAdjustment: true });
      if (typeof localStorage !== 'undefined') {
        const rawCustom = localStorage.getItem('signum_cxc_custom_docs_v1');
        if (rawCustom) {
          const customMap = JSON.parse(rawCustom);
          if (customMap && typeof customMap === 'object') {
            if (oldId && oldId !== newId) delete customMap[oldId];
            if (oldEraKey && oldEraKey !== newEraKey) delete customMap[oldEraKey];
            localStorage.setItem('signum_cxc_custom_docs_v1', JSON.stringify(customMap));
          }
        }
      }
    } catch (_) {}

    // Si cambió el ID en profit_invoices/sales, eliminar el registro viejo en ambas tablas (sin tocar stock)
    if (idChanged && isNetworkOnline() && oldId !== newId) {
      await Promise.all([
        withTimeout(
          supabase.from('profit_invoices').delete().eq('id', oldId),
          6000
        ).catch(() => {}),
        withTimeout(
          supabase.from('sales').delete().eq('id', oldId),
          6000
        ).catch(() => {})
      ]);
    }
  }

  unmarkCxcDeletedDoc(saved);
  return saved;
};

export const getSupabaseProfitSuppliers = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_suppliers').select('*').order('prov_des', { ascending: true }),
      10000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(s => ({
      id: s.id,
      coProv: s.co_prov,
      provDes: s.prov_des,
      rif: s.rif,
      direccion: s.direccion || '',
      telefonos: s.telefonos || '',
      email: s.email || '',
      saldoBs: Number(s.saldo_bs || 0),
      saldoUsd: Number(s.saldo_usd || 0),
      limiteCredito: Number(s.limite_credito || 0),
      diasCredito: Number(s.dias_credito || 0),
      inactivo: Boolean(s.inactivo)
    }));
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseProfitSuppliers');
    return REAL_PROFIT_SUPPLIERS;
  }
};

export const saveSupabaseProfitSupplier = async (supplierData) => {
  if (!supplierData) return null;
  const provDes = String(supplierData.provDes || supplierData.prov_des || supplierData.nombre || '').trim();
  const rawRif = String(supplierData.rif || supplierData.coProv || supplierData.co_prov || '').trim().toUpperCase();
  const cleanCode = rawRif.replace(/[^A-Z0-9]/g, '') || `SUP${Date.now()}`;
  const id = String(supplierData.id || cleanCode).trim();
  const nowIso = new Date().toISOString();

  const dbPayload = {
    id,
    coProv: cleanCode,
    co_prov: cleanCode,
    provDes,
    prov_des: provDes,
    rif: rawRif || cleanCode,
    direccion: String(supplierData.direccion || '').trim(),
    telefonos: String(supplierData.telefonos || supplierData.telefono || '').trim(),
    email: String(supplierData.email || '').trim(),
    diasCredito: Math.max(0, Number(supplierData.diasCredito ?? supplierData.dias_credito ?? 0)),
    dias_credito: Math.max(0, Number(supplierData.diasCredito ?? supplierData.dias_credito ?? 0)),
    limiteCredito: Math.max(0, Number(supplierData.limiteCredito ?? supplierData.limite_credito ?? 0)),
    limite_credito: Math.max(0, Number(supplierData.limiteCredito ?? supplierData.limite_credito ?? 0)),
    saldoUsd: Number(supplierData.saldoUsd ?? supplierData.saldo_usd ?? 0),
    saldo_usd: Number(supplierData.saldoUsd ?? supplierData.saldo_usd ?? 0),
    saldoBs: Number(supplierData.saldoBs ?? supplierData.saldo_bs ?? 0),
    saldo_bs: Number(supplierData.saldoBs ?? supplierData.saldo_bs ?? 0),
    inactivo: Boolean(supplierData.inactivo),
    updated_at: nowIso,
    updatedAt: nowIso
  };

  const mapped = {
    id: dbPayload.id,
    coProv: dbPayload.coProv,
    provDes: dbPayload.provDes,
    rif: dbPayload.rif,
    direccion: dbPayload.direccion,
    telefonos: dbPayload.telefonos,
    email: dbPayload.email,
    saldoBs: dbPayload.saldoBs,
    saldoUsd: dbPayload.saldoUsd,
    limiteCredito: dbPayload.limiteCredito,
    diasCredito: dbPayload.diasCredito,
    inactivo: dbPayload.inactivo
  };

  broadcastReconcileChange({
    tableId: 'suppliers',
    action: 'RECONCILE',
    key: id,
    item: mapped
  });

  if (isNetworkOnline()) {
    const { error } = await runSupabaseQueryWithRetry(
      () => supabase.from('profit_suppliers').upsert(dbPayload, { onConflict: 'id' }),
      15000,
      2
    );
    if (error) throw error;
    isSupabaseAvailable = true;
  }

  return mapped;
};

export const getSupabaseProfitPurchases = async () => {
  try {
    const { data, error } = await runSupabaseQueryWithRetry(
      () => supabase.from('profit_purchases').select('*').order('fec_emis', { ascending: false }).limit(5000),
      30000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = (data || []).map(p => ({
      id: p.id,
      factNum: p.fact_num ?? p.factNum,
      facturaProv: p.factura_prov ?? p.facturaProv,
      fechaEmision: p.fec_emis ?? p.fechaEmision,
      fechaVencimiento: p.fec_venc ?? p.fechaVencimiento,
      coProv: p.co_prov ?? p.coProv,
      provNombre: p.prov_nombre ?? p.provNombre,
      provRif: p.prov_rif ?? p.provRif,
      totBrutoUsd: Number(p.tot_bruto_usd ?? p.totBrutoUsd ?? 0),
      totBrutoBs: Number(p.tot_bruto_bs ?? p.totBrutoBs ?? 0),
      ivaUsd: Number(p.iva_usd ?? p.ivaUsd ?? 0),
      ivaBs: Number(p.iva_bs ?? p.ivaBs ?? 0),
      totNetoUsd: Number(p.tot_neto_usd ?? p.totNetoUsd ?? 0),
      totNetoBs: Number(p.tot_neto_bs ?? p.totNetoBs ?? 0),
      saldoUsd: Number(p.saldo_usd ?? p.saldoUsd ?? 0),
      saldoBs: Number(p.saldo_bs ?? p.saldoBs ?? 0),
      status: p.status,
      anulada: Boolean(p.anulada ?? p.anulado),
      formaPag: p.forma_pag ?? p.formaPag,
      items: p.items || [],
      fechaSincronizacion: p.fecha_sincronizacion ?? p.fechaSincronizacion
    }));
    const localPurchases = readLocalDocList('signum_profit_purchases_v1');
    return mergeRemoteAndLocalDocs(mapped, localPurchases, 'id');
  } catch (err) {
    console.warn('[Supabase] Error cargando compras Profit:', err.message);
    const localPurchases = readLocalDocList('signum_profit_purchases_v1');
    return markStaticFallback(mergeRemoteAndLocalDocs(REAL_PROFIT_PURCHASES || [], localPurchases, 'id'));
  }
};

export const saveSupabaseProfitPurchase = async (purchaseData) => {
  if (!purchaseData) return null;
  const nowIso = new Date().toISOString();
  const id = String(purchaseData.id || `COM-${Date.now().toString().slice(-6)}`).trim();
  const record = {
    ...purchaseData,
    id,
    updated_at: nowIso
  };
  return persistDocWithOfflineQueue({
    storageKey: 'signum_profit_purchases_v1',
    tableName: 'profit_purchases',
    syncEntity: 'profit_purchase',
    record,
    action: 'INSERT',
    broadcastTableId: 'purchases'
  });
};

export const deleteSupabaseProfitPurchase = async (purchaseId) => {
  const cleanId = String(purchaseId || '').trim();
  if (!cleanId) return false;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('signum_profit_purchases_v1');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          localStorage.setItem(
            'signum_profit_purchases_v1',
            JSON.stringify(list.filter(p => p && String(p.id || '').trim() !== cleanId))
          );
        }
      }
    }
  } catch (_) {}
  if (!isNetworkOnline() || !isSupabaseAvailable) {
    enqueueSyncAction('profit_purchase', 'DELETE', { id: cleanId });
    return true;
  }
  try {
    const { error } = await withTimeout(supabase.from('profit_purchases').delete().eq('id', cleanId), 5000);
    if (error) throw error;
    return true;
  } catch (err) {
    markSupabaseOffline(err, 'deleteSupabaseProfitPurchase');
    enqueueSyncAction('profit_purchase', 'DELETE', { id: cleanId });
    return true;
  }
};

export const CXP_DELETED_DOCS_KEY = 'signum_cxp_deleted_docs_v1';
export const CXP_CUSTOM_DOCS_KEY = 'signum_cxp_custom_docs_v1';
export const CXP_PAYMENTS_KEY = 'signum_cxp_payments_v1';

export const getScopedCxpDeleteKeys = (docOrRef) => {
  if (!docOrRef) return [];
  if (typeof docOrRef === 'string') return [docOrRef.trim()].filter(Boolean);
  const keys = new Set(buildCxpLookupKeys(docOrRef));
  const rawNum = normalizeDocNumber(docOrRef.nroDoc ?? docOrRef.nro_doc);
  const tipo = normalizeDocType(docOrRef.tipoDoc ?? docOrRef.tipo_doc);
  const normRif = normalizeProviderRif(docOrRef.provRif ?? docOrRef.prov_rif ?? docOrRef.coProv ?? docOrRef.co_prov);

  // Nunca usar nroDoc suelto ni `${tipo}-${nroDoc}` sin proveedor para evitar colisión entre proveedores
  if (rawNum && tipo && normRif) {
    keys.add(`DOC-CP-${tipo}-${rawNum}-${normRif}`);
    keys.add(`CXP-${tipo}-${rawNum}-${normRif}`);
  }
  return Array.from(keys);
};

export const sanitizeCxpDeletedDocsStorage = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const rawDel = localStorage.getItem(CXP_DELETED_DOCS_KEY);
    const parsed = rawDel ? JSON.parse(rawDel) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (_) {
    return [];
  }
};

export const isCxpEntryDeleted = (docOrIds, delSet) => {
  if (!delSet || delSet.size === 0 || !docOrIds) return false;
  const scopedKeys = getScopedCxpDeleteKeys(docOrIds);
  return scopedKeys.some(k => delSet.has(k));
};

export const applyLocalCxpOverridesToPayables = (rawList = [], hasRemoteResponse = false) => {
  try {
    const normalizedBase = (rawList || []).map(p => {
      if (!p) return p;
      const saldoUsdVal = p.saldoUsd ?? p.saldo_usd;
      const saldoBsVal = p.saldoBs ?? p.saldo_bs;
      const montoNetUsdVal = p.montoNetUsd ?? p.monto_net_usd;
      const abonosUsdVal = p.abonosUsd ?? p.abonos_usd;
      return {
        ...p,
        ...(saldoUsdVal !== undefined ? { saldoUsd: Number(saldoUsdVal), saldo_usd: Number(saldoUsdVal) } : {}),
        ...(saldoBsVal !== undefined ? { saldoBs: Number(saldoBsVal), saldo_bs: Number(saldoBsVal) } : {}),
        ...(montoNetUsdVal !== undefined ? { montoNetUsd: Number(montoNetUsdVal), monto_net_usd: Number(montoNetUsdVal) } : {}),
        ...(abonosUsdVal !== undefined ? { abonosUsd: Number(abonosUsdVal), abonos_usd: Number(abonosUsdVal) } : {})
      };
    });

    if (typeof localStorage === 'undefined') return normalizedBase;
    const rawDelList = sanitizeCxpDeletedDocsStorage();
    const delSet = new Set(rawDelList);
    const rawCustom = localStorage.getItem(CXP_CUSTOM_DOCS_KEY);
    const customMap = rawCustom ? JSON.parse(rawCustom) : {};

    const syncQueue = getSyncQueue();
    const pendingCxpIds = new Set(
      syncQueue
        .filter(q => q && q.entity === 'profit_accounts_payable' && q.action !== 'DELETE')
        .flatMap(q => buildCxpLookupKeys(q.data))
    );
    const pendingDeleteKeys = new Set(
      syncQueue
        .filter(q => q && q.entity === 'profit_accounts_payable' && q.action === 'DELETE')
        .flatMap(q => {
          const base = buildCxpLookupKeys(q.data);
          return Array.isArray(q.data?.keys) ? [...base, ...q.data.keys] : base;
        })
    );

    if (hasRemoteResponse && rawDelList.length > 0) {
      const remoteScopedKeys = new Set();
      normalizedBase.forEach(p => {
        getScopedCxpDeleteKeys(p).forEach(k => remoteScopedKeys.add(k));
      });
      const prunedDelList = rawDelList.filter(k => remoteScopedKeys.has(k) || pendingDeleteKeys.has(k));
      if (prunedDelList.length !== rawDelList.length) {
        try {
          localStorage.setItem(CXP_DELETED_DOCS_KEY, JSON.stringify(prunedDelList));
        } catch (_) {}
        delSet.clear();
        prunedDelList.forEach(k => delSet.add(k));
      }
    }

    const matchedCustomKeys = new Set();
    const keysToPrune = new Set();
    const result = [];

    for (const p of normalizedBase) {
      if (!p) continue;
      if (isCxpEntryDeleted(p, delSet)) {
        continue;
      }
      const idKey = String(p.id || '').trim();
      const compKey = buildCxpCompositeKey(p);
      const candOverride = (idKey && customMap[idKey]) || (compKey && customMap[compKey]);
      const override = candOverride && doesPayableMatchDocument(p, candOverride) ? candOverride : null;

      if (override) {
        if (idKey) matchedCustomKeys.add(idKey);
        if (compKey) matchedCustomKeys.add(compKey);
        buildCxpLookupKeys(override).forEach(k => matchedCustomKeys.add(k));

        const ovTs = parseSafeIsoMs(override.updated_at || override.fechaSincronizacion || override.fecha_sincronizacion);
        const remTs = parseSafeIsoMs(p.updated_at || p.fechaSincronizacion || p.fecha_sincronizacion);
        const isPending = Boolean(override._pendingServerSync)
          || (idKey && pendingCxpIds.has(idKey))
          || (compKey && pendingCxpIds.has(compKey));

        if (!hasRemoteResponse || isPending || ovTs > remTs) {
          result.push({ ...p, ...override });
        } else {
          const hasExtendedCxpMeta = Boolean(
            override.numeroControl ||
            override.isFiscal !== undefined ||
            override.documentoAfectado
          );
          if (!hasExtendedCxpMeta) {
            if (idKey && customMap[idKey]) keysToPrune.add(idKey);
            if (compKey && customMap[compKey]) keysToPrune.add(compKey);
          }
          result.push({
            ...p,
            ...(override.numeroControl && !p.numeroControl ? { numeroControl: override.numeroControl } : {}),
            ...(override.isFiscal !== undefined && p.isFiscal === undefined ? { isFiscal: override.isFiscal } : {}),
            ...(override.documentoAfectado && !p.documentoAfectado ? { documentoAfectado: override.documentoAfectado } : {}),
            ...(override.exentoIva !== undefined && p.exentoIva === undefined ? { exentoIva: override.exentoIva } : {}),
            ...(override.baseImponibleUsd !== undefined && p.baseImponibleUsd === undefined ? { baseImponibleUsd: override.baseImponibleUsd } : {}),
            ...(override.baseImponibleBs !== undefined && p.baseImponibleBs === undefined ? { baseImponibleBs: override.baseImponibleBs } : {}),
            ...(override.ivaUsd !== undefined && p.ivaUsd === undefined ? { ivaUsd: override.ivaUsd } : {}),
            ...(override.ivaBs !== undefined && p.ivaBs === undefined ? { ivaBs: override.ivaBs } : {})
          });
        }
      } else {
        result.push(p);
      }
    }

    if (keysToPrune.size > 0) {
      try {
        keysToPrune.forEach(k => { delete customMap[k]; });
        localStorage.setItem(CXP_CUSTOM_DOCS_KEY, JSON.stringify(customMap));
      } catch (_) {}
    }

    if (customMap && typeof customMap === 'object') {
      const addedKeys = new Set();
      Object.entries(customMap).forEach(([k, doc]) => {
        if (!doc || typeof doc !== 'object') return;
        const dId = String(doc.id || k).trim();
        const dComp = buildCxpCompositeKey(doc);
        if (isCxpEntryDeleted(doc, delSet)) return;
        const alreadyMatched = (dId && matchedCustomKeys.has(dId)) || (dComp && matchedCustomKeys.has(dComp));
        const alreadyAdded = (dId && addedKeys.has(dId)) || (dComp && addedKeys.has(dComp));
        if (!alreadyMatched && !alreadyAdded) {
          if (dId) addedKeys.add(dId);
          if (dComp) addedKeys.add(dComp);
          result.unshift(doc);
        }
      });
    }

    return result;
  } catch (_) {
    return rawList;
  }
};

export const getSupabaseProfitAccountsPayable = async () => {
  try {
    const { data, error } = await runSupabaseQueryWithRetry(
      () => supabase.from('profit_accounts_payable').select('*').order('fec_emis', { ascending: false }).limit(5000),
      30000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = (data || []).map(d => ({
      id: d.id,
      tipoDoc: d.tipo_doc ?? d.tipoDoc ?? 'FACT',
      nroDoc: d.nro_doc ?? d.nroDoc ?? '',
      numeroControl: d.numero_control ?? d.numeroControl ?? '',
      isFiscal: d.is_fiscal ?? d.isFiscal,
      documentoAfectado: d.documento_afectado ?? d.documentoAfectado ?? '',
      exentoIva: d.exento_iva ?? d.exentoIva,
      baseImponibleUsd: d.base_imponible_usd ?? d.baseImponibleUsd,
      baseImponibleBs: d.base_imponible_bs ?? d.baseImponibleBs,
      ivaUsd: d.iva_usd ?? d.ivaUsd,
      ivaBs: d.iva_bs ?? d.ivaBs,
      coProv: d.co_prov ?? d.coProv ?? '',
      provNombre: d.prov_nombre ?? d.provNombre ?? 'Proveedor',
      provRif: d.prov_rif ?? d.provRif ?? '',
      fechaEmision: d.fec_emis ?? d.fechaEmision,
      fechaVencimiento: d.fec_venc ?? d.fechaVencimiento,
      diasCredito: Number(d.dias_credito ?? d.diasCredito ?? 0),
      montoNetUsd: Number(d.monto_net_usd ?? d.montoNetUsd ?? 0),
      montoNetBs: Number(d.monto_net_bs ?? d.montoNetBs ?? 0),
      saldoUsd: Number(d.saldo_usd ?? d.saldoUsd ?? 0),
      saldoBs: Number(d.saldo_bs ?? d.saldoBs ?? 0),
      abonosUsd: (d.abonos_usd ?? d.abonosUsd) !== undefined
        ? Number(d.abonos_usd ?? d.abonosUsd)
        : Math.max(0, Number(d.monto_net_usd ?? d.montoNetUsd ?? 0) - Number(d.saldo_usd ?? d.saldoUsd ?? 0)),
      tasa: Number(d.tasa || 1),
      tipoTasa: normalizeRateType(d.tipo_tasa ?? d.tipoTasa, {
        tipoDoc: d.tipo_doc ?? d.tipoDoc,
        monedaPago: d.moneda_pago ?? d.monedaPago ?? d.moneda,
        fallback: isFiscalDocumentForRatePolicy(d.tipo_doc ?? d.tipoDoc) ? 'BCV' : 'KEYSTONE'
      }),
      tasaPago: Number(d.tasa_pago ?? d.tasaPago ?? d.tasa ?? 1),
      monedaPago: d.moneda_pago ?? d.monedaPago ?? (String(d.tipo_tasa ?? d.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
      moneda: d.moneda || 'BS',
      observaciones: d.observaciones ?? d.descrip ?? '',
      anulado: Boolean(d.anulado),
      historialPagos: d.historial_pagos || d.historialPagos || [],
      fechaSincronizacion: d.fecha_sincronizacion ?? d.fechaSincronizacion,
      updated_at: d.updated_at || d.fecha_sincronizacion || d.fechaSincronizacion,
      updatedAt: d.updated_at || d.fecha_sincronizacion || d.fechaSincronizacion
    }));
    return dedupePayablesList(applyLocalCxpOverridesToPayables(mapped, Array.isArray(data)));
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseProfitAccountsPayable');
    return markStaticFallback(dedupePayablesList(applyLocalCxpOverridesToPayables(REAL_PROFIT_ACCOUNTS_PAYABLE, false)));
  }
};

const PROFIT_CXP_DB_COLUMNS = [
  'id',
  'tipo_doc',
  'tipoDoc',
  'nro_doc',
  'nroDoc',
  'numero_control',
  'numeroControl',
  'is_fiscal',
  'isFiscal',
  'documento_afectado',
  'documentoAfectado',
  'exento_iva',
  'exentoIva',
  'base_imponible_usd',
  'baseImponibleUsd',
  'base_imponible_bs',
  'baseImponibleBs',
  'iva_usd',
  'ivaUsd',
  'iva_bs',
  'ivaBs',
  'co_prov',
  'coProv',
  'prov_nombre',
  'provNombre',
  'prov_rif',
  'provRif',
  'fec_emis',
  'fechaEmision',
  'fec_venc',
  'fechaVencimiento',
  'dias_credito',
  'diasCredito',
  'monto_net_usd',
  'montoNetUsd',
  'monto_net_bs',
  'montoNetBs',
  'saldo_usd',
  'saldoUsd',
  'saldo_bs',
  'saldoBs',
  'abonos_usd',
  'abonosUsd',
  'tasa',
  'tipo_tasa',
  'tipoTasa',
  'tasa_pago',
  'tasaPago',
  'moneda_pago',
  'monedaPago',
  'moneda',
  'observaciones',
  'anulado',
  'historial_pagos',
  'historialPagos',
  'fecha_sincronizacion',
  'fechaSincronizacion',
  'updated_at',
  'updatedAt'
];

export const pushProfitAccountsPayableToSupabase = async (payable) => {
  if (!payable) return null;
  const dbPayload = {};
  for (const col of PROFIT_CXP_DB_COLUMNS) {
    if (payable[col] !== undefined) {
      dbPayload[col] = payable[col];
    }
  }
  const { error } = await runSupabaseQueryWithRetry(
    () => supabase.from('profit_accounts_payable').upsert(dbPayload, { onConflict: 'id' }),
    15000,
    2
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return payable;
};

export const saveSupabaseProfitAccountsPayable = async (payableData) => {
  if (!payableData) return null;
  const nowIso = new Date().toISOString();
  const rawNum = String(payableData.nroDoc ?? payableData.nro_doc ?? payableData.id ?? '').trim();
  const tipoDoc = String(payableData.tipoDoc || payableData.tipo_doc || 'FACT').toUpperCase().trim();
  const provRif = String(payableData.provRif || payableData.prov_rif || payableData.coProv || payableData.co_prov || 'J-00000000').trim();
  const id = buildCxpStableId({ ...payableData, id: payableData.id, tipoDoc, nroDoc: rawNum, provRif });

  const montoNetUsd = round2(payableData.montoNetUsd ?? payableData.monto_net_usd ?? 0);
  const montoNetBs = round2(payableData.montoNetBs ?? payableData.monto_net_bs ?? 0);
  const saldoUsd = round2(payableData.saldoUsd ?? payableData.saldo_usd ?? montoNetUsd);
  const saldoBs = round2(payableData.saldoBs ?? payableData.saldo_bs ?? montoNetBs);
  const abonosUsd = round2(payableData.abonosUsd ?? payableData.abonos_usd ?? Math.max(0, montoNetUsd - saldoUsd));

  const normalized = {
    ...payableData,
    id,
    tipoDoc,
    tipo_doc: tipoDoc,
    nroDoc: rawNum,
    nro_doc: rawNum,
    coProv: provRif,
    co_prov: provRif,
    provNombre: payableData.provNombre || payableData.prov_nombre || 'Proveedor General',
    prov_nombre: payableData.provNombre || payableData.prov_nombre || 'Proveedor General',
    provRif,
    prov_rif: provRif,
    fechaEmision: payableData.fechaEmision || payableData.fec_emis || nowIso,
    fec_emis: payableData.fechaEmision || payableData.fec_emis || nowIso,
    fechaVencimiento: payableData.fechaVencimiento || payableData.fec_venc || nowIso,
    fec_venc: payableData.fechaVencimiento || payableData.fec_venc || nowIso,
    diasCredito: Number(payableData.diasCredito ?? payableData.dias_credito ?? 15),
    dias_credito: Number(payableData.diasCredito ?? payableData.dias_credito ?? 15),
    montoNetUsd,
    monto_net_usd: montoNetUsd,
    montoNetBs,
    monto_net_bs: montoNetBs,
    saldoUsd,
    saldo_usd: saldoUsd,
    saldoBs,
    saldo_bs: saldoBs,
    abonosUsd,
    abonos_usd: abonosUsd,
    tasa: Number(payableData.tasa || 1),
    tipoTasa: normalizeRateType(payableData.tipoTasa ?? payableData.tipo_tasa, {
      tipoDoc,
      monedaPago: payableData.monedaPago ?? payableData.moneda_pago ?? payableData.moneda,
      fallback: isFiscalDocumentForRatePolicy(tipoDoc) ? 'BCV' : 'KEYSTONE'
    }),
    tipo_tasa: normalizeRateType(payableData.tipo_tasa ?? payableData.tipoTasa, {
      tipoDoc,
      monedaPago: payableData.moneda_pago ?? payableData.monedaPago ?? payableData.moneda,
      fallback: isFiscalDocumentForRatePolicy(tipoDoc) ? 'BCV' : 'KEYSTONE'
    }),
    tasaPago: Number(payableData.tasaPago ?? payableData.tasa_pago ?? payableData.tasa ?? 1),
    tasa_pago: Number(payableData.tasa_pago ?? payableData.tasaPago ?? payableData.tasa ?? 1),
    monedaPago: payableData.monedaPago ?? payableData.moneda_pago ?? (String(payableData.tipoTasa ?? payableData.tipo_tasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    moneda_pago: payableData.moneda_pago ?? payableData.monedaPago ?? (String(payableData.tipo_tasa ?? payableData.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    moneda: payableData.moneda || 'US$',
    observaciones: payableData.observaciones ?? payableData.descrip ?? '',
    anulado: Boolean(payableData.anulado),
    historialPagos: payableData.historialPagos || payableData.historial_pagos || [],
    fechaSincronizacion: nowIso,
    fecha_sincronizacion: nowIso,
    updated_at: nowIso,
    updatedAt: nowIso
  };

  const compKey = buildCxpCompositeKey(normalized);
  const saveCxpLocalEntry = (pendingFlag) => {
    try {
      if (typeof localStorage === 'undefined') return;
      const rawCustom = localStorage.getItem(CXP_CUSTOM_DOCS_KEY);
      const customMap = rawCustom ? JSON.parse(rawCustom) : {};
      const cached = { ...normalized, _pendingServerSync: pendingFlag };
      customMap[id] = cached;
      if (compKey) customMap[compKey] = cached;
      localStorage.setItem(CXP_CUSTOM_DOCS_KEY, JSON.stringify(customMap));
    } catch (_) {}
  };
  saveCxpLocalEntry(true);

  broadcastReconcileChange({
    tableId: 'accounts_payable',
    action: 'RECONCILE',
    key: id,
    item: normalized
  });

  let pendingServerSync = true;
  if (isNetworkOnline()) {
    try {
      await pushProfitAccountsPayableToSupabase(normalized);
      saveCxpLocalEntry(false);
      pendingServerSync = false;
    } catch (err) {
      console.warn('[saveSupabaseProfitAccountsPayable] Encolando para sincronización posterior:', err.message);
      markSupabaseOffline(err, 'saveSupabaseProfitAccountsPayable');
      enqueueSyncAction('profit_accounts_payable', 'UPDATE', normalized);
    }
  } else {
    enqueueSyncAction('profit_accounts_payable', 'UPDATE', normalized);
  }

  return { ...normalized, _pendingServerSync: pendingServerSync };
};

export const deleteProfitAccountsPayableDirect = async (idOrKeys) => {
  const keyList = Array.isArray(idOrKeys)
    ? idOrKeys
    : (Array.isArray(idOrKeys?.keys) ? idOrKeys.keys : [idOrKeys?.id || idOrKeys].filter(Boolean));
  // Evitar enviar DELETE con nroDoc suelto o claves compuestas "|" por campo id
  const cleanIds = [...new Set(
    keyList
      .map(k => String(k || '').trim())
      .filter(k => k && !k.includes('|'))
  )];
  const targetDoc = (idOrKeys && typeof idOrKeys === 'object' && (idOrKeys.nroDoc || idOrKeys.nro_doc))
    ? idOrKeys
    : null;
  if (cleanIds.length === 0 && !targetDoc) return false;

  for (const k of cleanIds) {
    const { error } = await withTimeout(
      supabase.from('profit_accounts_payable').delete().eq('id', k),
      8000
    );
    if (error) throw error;
  }

  if (targetDoc) {
    const nro = normalizeDocNumber(targetDoc.nroDoc ?? targetDoc.nro_doc);
    const tipo = normalizeDocType(targetDoc.tipoDoc ?? targetDoc.tipo_doc);
    const prov = String(targetDoc.coProv ?? targetDoc.co_prov ?? targetDoc.provRif ?? targetDoc.prov_rif ?? '').trim();
    if (nro && prov) {
      const { error } = await withTimeout(
        supabase
          .from('profit_accounts_payable')
          .delete()
          .eq('nro_doc', nro)
          .eq('tipo_doc', tipo)
          .eq('co_prov', prov),
        8000
      );
      if (error) throw error;
    }
  }
  isSupabaseAvailable = true;
  return true;
};

export const deleteSupabaseProfitAccountsPayable = async (payableIdOrDoc) => {
  const keysToDelete = getScopedCxpDeleteKeys(payableIdOrDoc);
  if (keysToDelete.length === 0) return false;
  const primaryKey = keysToDelete[0];

  try {
    if (typeof localStorage !== 'undefined') {
      const delList = sanitizeCxpDeletedDocsStorage();
      keysToDelete.forEach(k => {
        if (!delList.includes(k)) delList.push(k);
      });
      localStorage.setItem(CXP_DELETED_DOCS_KEY, JSON.stringify(delList));

      const rawCustom = localStorage.getItem(CXP_CUSTOM_DOCS_KEY);
      if (rawCustom) {
        const customMap = JSON.parse(rawCustom);
        if (customMap && typeof customMap === 'object') {
          keysToDelete.forEach(k => delete customMap[k]);
          localStorage.setItem(CXP_CUSTOM_DOCS_KEY, JSON.stringify(customMap));
        }
      }
    }
  } catch (_) {}

  broadcastReconcileChange({
    tableId: 'accounts_payable',
    action: 'DELETE',
    key: primaryKey
  });

  let synced = false;
  let syncError = '';
  const deletePayload = {
    id: primaryKey,
    keys: keysToDelete,
    ...(payableIdOrDoc && typeof payableIdOrDoc === 'object'
      ? {
          nroDoc: payableIdOrDoc.nroDoc ?? payableIdOrDoc.nro_doc,
          tipoDoc: payableIdOrDoc.tipoDoc ?? payableIdOrDoc.tipo_doc,
          coProv: payableIdOrDoc.coProv ?? payableIdOrDoc.co_prov ?? payableIdOrDoc.provRif ?? payableIdOrDoc.prov_rif
        }
      : {})
  };

  if (isNetworkOnline()) {
    try {
      await deleteProfitAccountsPayableDirect(deletePayload);
      synced = true;
    } catch (err) {
      syncError = err?.message || 'Error de red o servidor';
      console.warn('[deleteSupabaseProfitAccountsPayable] Encolando borrado para sincronización posterior:', syncError);
      markSupabaseOffline(err, 'deleteSupabaseProfitAccountsPayable');
      enqueueSyncAction('profit_accounts_payable', 'DELETE', deletePayload);
    }
  } else {
    syncError = 'Sin conexión';
    enqueueSyncAction('profit_accounts_payable', 'DELETE', deletePayload);
  }
  return {
    deleted: true,
    synced,
    pendingSync: !synced,
    ...(syncError ? { error: syncError } : {})
  };
};

export const getSupabaseProfitSupplierPayments = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_supplier_payments').select('*').order('fec_pago', { ascending: false }).limit(5000),
      10000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = (data || []).map(p => ({
      id: p.id,
      pagoNum: p.pago_num ?? p.pagoNum,
      fechaPago: p.fec_pago ?? p.fechaPago,
      coProv: p.co_prov ?? p.coProv,
      provNombre: p.prov_nombre ?? p.provNombre,
      provRif: p.prov_rif ?? p.provRif,
      montoUsd: Number(p.monto_usd ?? p.montoUsd ?? 0),
      montoBs: Number(p.monto_bs ?? p.montoBs ?? 0),
      tasa: Number(p.tasa || 1),
      tipoTasa: normalizeRateType(p.tipo_tasa ?? p.tipoTasa, {
        monedaPago: p.moneda_pago ?? p.monedaPago ?? p.moneda,
        fallback: String(p.moneda || '').toUpperCase().includes('USD') || String(p.moneda || '').toUpperCase() === 'US$' ? 'USD' : 'BCV'
      }),
      tasaPago: Number(p.tasa_pago ?? p.tasaPago ?? p.tasa ?? 1),
      monedaPago: p.moneda_pago ?? p.monedaPago ?? (String(p.tipo_tasa ?? p.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
      moneda: p.moneda || 'BS',
      descrip: p.descrip || '',
      cuentaId: p.cuenta_id ?? p.cuentaId ?? '',
      cuentaNombre: p.cuenta_nombre ?? p.cuentaNombre ?? '',
      accountType: p.account_type ?? p.accountType ?? '',
      cajaId: p.caja_id ?? p.cajaId ?? null,
      cuentaBancariaId: p.cuenta_bancaria_id ?? p.cuentaBancariaId ?? null,
      partnerAccountId: p.partner_account_id ?? p.partnerAccountId ?? null,
      cuentaContable: p.cuenta_contable ?? p.cuentaContable ?? '',
      referencia: p.referencia || '',
      anulado: Boolean(p.anulado),
      documentosAfectados: p.documentos_afectados ?? p.documentosAfectados ?? [],
      fechaSincronizacion: p.fecha_sincronizacion ?? p.fechaSincronizacion,
      updated_at: p.updated_at || p.fecha_sincronizacion || p.fechaSincronizacion,
      updatedAt: p.updated_at || p.fecha_sincronizacion || p.fechaSincronizacion
    }));

    if (typeof localStorage !== 'undefined') {
      try {
        const rawLocalPays = localStorage.getItem(CXP_PAYMENTS_KEY);
        const localPays = rawLocalPays ? JSON.parse(rawLocalPays) : [];
        if (Array.isArray(localPays) && localPays.length > 0) {
          const remoteIds = new Set(mapped.map(m => String(m.id)));
          const pendingPayIds = new Set(
            getSyncQueue()
              .filter(q => q && q.entity === 'profit_supplier_payment' && q.action !== 'DELETE')
              .map(q => String(q.data?.id || '').trim())
          );
          const remainingPending = [];
          localPays.forEach(lp => {
            if (!lp) return;
            const lpId = String(lp.id || '').trim();
            const isPendingSync = Boolean(lp._pendingServerSync) || (lpId && pendingPayIds.has(lpId));
            // Purgar pagos ya sincronizados o eliminados en el servidor para evitar resurrección
            if (!remoteIds.has(lpId) && isPendingSync) {
              remainingPending.push(lp);
              mapped.unshift(lp);
            }
          });
          localStorage.setItem(CXP_PAYMENTS_KEY, JSON.stringify(remainingPending));
        }
      } catch (_) {}
    }

    return dedupeSupplierPaymentsList(mapped);
  } catch (err) {
    console.warn('[Supabase] Error cargando pagos de proveedores Profit:', err.message);
    let list = [...REAL_PROFIT_SUPPLIER_PAYMENTS];
    if (typeof localStorage !== 'undefined') {
      try {
        const rawLocalPays = localStorage.getItem(CXP_PAYMENTS_KEY);
        const localPays = rawLocalPays ? JSON.parse(rawLocalPays) : [];
        if (Array.isArray(localPays) && localPays.length > 0) {
          const existingIds = new Set(list.map(x => String(x?.id || '')));
          const extra = localPays.filter(lp => lp && !existingIds.has(String(lp.id || '')));
          list = [...extra, ...list];
        }
      } catch (_) {}
    }
    return dedupeSupplierPaymentsList(list);
  }
};

export const pushProfitSupplierPaymentToSupabase = async (payment) => {
  if (!payment) return null;
  const { error } = await withTimeout(
    supabase.from('profit_supplier_payments').upsert(payment, { onConflict: 'id' }),
    8000
  );
  if (error) throw error;
  isSupabaseAvailable = true;
  return payment;
};

export const saveSupabaseProfitSupplierPayment = async (paymentData) => {
  const nowIso = new Date().toISOString();
  const pagoNum = paymentData.pagoNum || paymentData.pago_num || `PAG-${Date.now().toString().slice(-6)}`;
  const id = paymentData.id || `pag-${pagoNum}`;
  const rawAccType = String(paymentData.accountType ?? paymentData.account_type ?? '').trim().toUpperCase();
  const inferredPartner = rawAccType === 'PASIVO_SOCIO'
    || String(paymentData.cuentaId || '').toUpperCase().startsWith('SOC-')
    || String(paymentData.cuentaContable || paymentData.cuenta_contable || '').startsWith('2.02.01');
  const resolvedAccType = rawAccType || (paymentData.cajaId || paymentData.caja_id ? 'CAJA' : (inferredPartner ? 'PASIVO_SOCIO' : 'BANCO'));
  const resolvedCajaId = paymentData.cajaId ?? paymentData.caja_id ?? (resolvedAccType === 'CAJA' ? (paymentData.cuentaId || null) : null);
  const resolvedBankId = paymentData.cuentaBancariaId ?? paymentData.cuenta_bancaria_id ?? (resolvedAccType === 'BANCO' ? (paymentData.cuentaId || null) : null);
  const resolvedPartnerAccId = paymentData.partnerAccountId ?? paymentData.partner_account_id ?? (resolvedAccType === 'PASIVO_SOCIO' ? (paymentData.cuentaId || null) : null);
  const resolvedCuentaContable = paymentData.cuentaContable ?? paymentData.cuenta_contable ?? (resolvedAccType === 'PASIVO_SOCIO' ? '2.02.01.001' : '');
  const normalized = {
    id,
    pagoNum,
    pago_num: pagoNum,
    fechaPago: paymentData.fechaPago || paymentData.fec_pago || nowIso,
    fec_pago: paymentData.fechaPago || paymentData.fec_pago || nowIso,
    coProv: paymentData.coProv || paymentData.co_prov || '',
    co_prov: paymentData.coProv || paymentData.co_prov || '',
    provNombre: paymentData.provNombre || paymentData.prov_nombre || 'Proveedor General',
    prov_nombre: paymentData.provNombre || paymentData.prov_nombre || 'Proveedor General',
    provRif: paymentData.provRif || paymentData.prov_rif || '',
    prov_rif: paymentData.provRif || paymentData.prov_rif || '',
    montoUsd: Number(paymentData.montoUsd || 0),
    monto_usd: Number(paymentData.montoUsd || 0),
    montoBs: Number(paymentData.montoBs || 0),
    monto_bs: Number(paymentData.montoBs || 0),
    tasa: Number(paymentData.tasa || 1),
    tipoTasa: normalizeRateType(paymentData.tipoTasa ?? paymentData.tipo_tasa, {
      monedaPago: paymentData.monedaPago ?? paymentData.moneda_pago ?? paymentData.moneda,
      fallback: 'BCV'
    }),
    tipo_tasa: normalizeRateType(paymentData.tipo_tasa ?? paymentData.tipoTasa, {
      monedaPago: paymentData.moneda_pago ?? paymentData.monedaPago ?? paymentData.moneda,
      fallback: 'BCV'
    }),
    tasaPago: Number(paymentData.tasaPago ?? paymentData.tasa_pago ?? paymentData.tasa ?? 1),
    tasa_pago: Number(paymentData.tasa_pago ?? paymentData.tasaPago ?? paymentData.tasa ?? 1),
    monedaPago: paymentData.monedaPago ?? paymentData.moneda_pago ?? (String(paymentData.tipoTasa ?? paymentData.tipo_tasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    moneda_pago: paymentData.moneda_pago ?? paymentData.monedaPago ?? (String(paymentData.tipo_tasa ?? paymentData.tipoTasa ?? '').toUpperCase() === 'USD' ? 'USD' : 'BS'),
    moneda: paymentData.moneda || 'US$',
    cuentaId: paymentData.cuentaId || paymentData.cuenta_id || '',
    cuenta_id: paymentData.cuentaId || paymentData.cuenta_id || '',
    cuentaNombre: paymentData.cuentaNombre || paymentData.cuenta_nombre || '',
    cuenta_nombre: paymentData.cuentaNombre || paymentData.cuenta_nombre || '',
    accountType: resolvedAccType,
    account_type: resolvedAccType,
    cajaId: resolvedCajaId,
    caja_id: resolvedCajaId,
    cuentaBancariaId: resolvedBankId,
    cuenta_bancaria_id: resolvedBankId,
    partnerAccountId: resolvedPartnerAccId,
    partner_account_id: resolvedPartnerAccId,
    cuentaContable: resolvedCuentaContable,
    cuenta_contable: resolvedCuentaContable,
    referencia: paymentData.referencia || '',
    descrip: paymentData.descrip || paymentData.observaciones || '',
    anulado: false,
    documentosAfectados: paymentData.documentosAfectados || [],
    documentos_afectados: paymentData.documentosAfectados || [],
    fechaSincronizacion: nowIso,
    fecha_sincronizacion: nowIso,
    updated_at: nowIso,
    updatedAt: nowIso
  };

  const writePaymentLocal = (pendingFlag) => {
    try {
      if (typeof localStorage === 'undefined') return;
      const rawLocalPays = localStorage.getItem(CXP_PAYMENTS_KEY);
      const localPays = rawLocalPays ? JSON.parse(rawLocalPays) : [];
      const filtered = Array.isArray(localPays) ? localPays.filter(p => String(p?.id) !== String(id)) : [];
      if (pendingFlag) {
        filtered.unshift({ ...normalized, _pendingServerSync: true });
      }
      localStorage.setItem(CXP_PAYMENTS_KEY, JSON.stringify(filtered));
    } catch (_) {}
  };
  writePaymentLocal(true);

  broadcastReconcileChange({
    tableId: 'supplier_payments',
    action: 'RECONCILE',
    key: id,
    item: normalized
  });

  if (isNetworkOnline()) {
    try {
      await pushProfitSupplierPaymentToSupabase(normalized);
      writePaymentLocal(false);
    } catch (err) {
      console.warn('[saveSupabaseProfitSupplierPayment] Encolando para sincronización posterior:', err.message);
      markSupabaseOffline(err, 'saveSupabaseProfitSupplierPayment');
      enqueueSyncAction('profit_supplier_payment', 'INSERT', normalized);
    }
  } else {
    enqueueSyncAction('profit_supplier_payment', 'INSERT', normalized);
  }

  return normalized;
};

export const getSupabaseProfitSellers = async () => {
  const localSellers = getStorageSellers();
  let currentUsers = [];
  try {
    currentUsers = getUsersList() || [];
  } catch (_) {
    currentUsers = [];
  }

  const enrichAndDedupeSellers = (rawList) => {
    const photoByCode = new Map();
    const photoByName = new Map();

    // Recopilar fotos desde usuarios registrados
    currentUsers.forEach(u => {
      if (!u || !u.foto) return;
      const uCode = String(u.co_ven || u.coVen || '').trim().replace(/^usr-seller-/i, '').toUpperCase();
      const uIdCode = String(u.id || '').toLowerCase().startsWith('usr-seller-')
        ? String(u.id).replace(/^usr-seller-/i, '').trim().toUpperCase()
        : '';
      const code = uCode || uIdCode;
      const uName = stripAccents(u.nombre);
      if (code && !code.startsWith('USR-')) photoByCode.set(code, u.foto);
      if (uName) photoByName.set(uName, u.foto);
    });

    // Recopilar fotos desde registros actuales (incluyendo filas USR-SELLER-* en rawList)
    (rawList || []).forEach(s => {
      if (!s) return;
      const sPhoto = s.foto || '';
      if (!sPhoto) return;
      const sCode = String(s.co_ven || s.coVen || s.id || '').trim().replace(/^usr-seller-/i, '').toUpperCase();
      const sName = stripAccents(s.ven_des || s.venDes || s.nombre);
      if (sCode) photoByCode.set(sCode, sPhoto);
      if (sName) photoByName.set(sName, sPhoto);
    });

    const mapped = (rawList || []).map(s => {
      const rawCoVen = String(s.co_ven || s.coVen || s.id || '').trim();
      const cleanCode = rawCoVen.replace(/^usr-seller-/i, '').trim().toUpperCase();
      const venDes = String(s.ven_des || s.venDes || s.nombre || '').trim();
      const fallback = (REAL_PROFIT_SELLERS || []).find(
        r =>
          (r.coVen && String(r.coVen).trim().toLowerCase() === cleanCode.toLowerCase()) ||
          (r.venDes && venDes && stripAccents(r.venDes) === stripAccents(venDes))
      );
      const coZon = String(s.co_zon || s.coZon || fallback?.coZon || fallback?.co_zon || '').trim();
      const zona = String(s.zona || fallback?.zona || '').trim();
      const resolvedName = venDes || fallback?.venDes || cleanCode;
      const resolvedPhoto =
        s.foto ||
        photoByCode.get(cleanCode) ||
        photoByName.get(stripAccents(resolvedName)) ||
        '';

      return {
        id: s.id || rawCoVen,
        coVen: rawCoVen,
        co_ven: rawCoVen,
        _cleanCode: cleanCode,
        venDes: resolvedName,
        ven_des: resolvedName,
        cedula: s.cedula || fallback?.cedula || '',
        telefonos: s.telefonos || fallback?.telefonos || '',
        direccion: s.direccion || fallback?.direccion || '',
        tipo: s.tipo || fallback?.tipo || 'A',
        comisionPct: Number(s.comision_pct ?? s.comisionPct ?? fallback?.comisionPct ?? 3.0),
        metaLitrosMes: Number(s.meta_litros_mes ?? s.metaLitrosMes ?? fallback?.metaLitrosMes ?? 3000),
        activo: s.activo !== undefined ? Boolean(s.activo) : true,
        foto: resolvedPhoto,
        avatar: s.avatar || fallback?.avatar || '',
        coZon,
        co_zon: coZon,
        zona,
        createdAt: s.created_at || s.createdAt,
        updatedAt: s.updated_at || s.updatedAt
      };
    }).filter(s => (s.coVen || s.venDes) && !String(s._cleanCode || '').startsWith('USR-'));

    // Deduplicar filas USR-SELLER-* cuando existe el código corto canónico (CB, CM, FS, etc.)
    const byCleanCode = new Map();
    for (const item of mapped) {
      const key = item._cleanCode || item.venDes.toUpperCase();
      const existing = byCleanCode.get(key);
      if (!existing) {
        byCleanCode.set(key, item);
      } else {
        const existingIsPrefixed = /^usr-seller-/i.test(existing.coVen);
        const itemIsPrefixed = /^usr-seller-/i.test(item.coVen);
        const mergedPhoto = item.foto || existing.foto || '';
        const mergedAvatar = item.avatar || existing.avatar || '';
        if (existingIsPrefixed && !itemIsPrefixed) {
          byCleanCode.set(key, { ...existing, ...item, foto: mergedPhoto, avatar: mergedAvatar });
        } else {
          byCleanCode.set(key, { ...item, ...existing, foto: mergedPhoto, avatar: mergedAvatar });
        }
      }
    }

    // Incorporar usuarios activos del departamento de Ventas (users con departamento VEN o rol VENTAS)
    // que aún no tengan ficha creada en profit_sellers (ej. Rosibel Briceño / @rosibelventas).
    const usedCodes = new Set(Array.from(byCleanCode.keys()).map((k) => String(k || '').toUpperCase()));
    const knownNames = new Set(
      Array.from(byCleanCode.values())
        .map((s) => stripAccents(s?.venDes || s?.ven_des))
        .filter(Boolean)
    );
    const knownUserNames = new Map();
    currentUsers.forEach((u) => {
      if (!u) return;
      const uCode = String(u.co_ven || u.coVen || '').trim().replace(/^usr-seller-/i, '').toUpperCase();
      if (uCode && !uCode.startsWith('USR-')) knownUserNames.set(uCode, u);
    });

    currentUsers.forEach((u) => {
      if (!isSalesDepartmentUser(u)) return;
      const rawUserCoVen = String(u.co_ven || u.coVen || '').trim();
      const derivedFromId = String(u.id || '').toLowerCase().startsWith('usr-seller-')
        ? String(u.id).replace(/^usr-seller-/i, '').trim().toUpperCase()
        : '';
      const candidateCode = (rawUserCoVen || derivedFromId).toUpperCase();
      const uNameNorm = stripAccents(u.nombre || u.name);

      if (candidateCode && !candidateCode.startsWith('USR-') && byCleanCode.has(candidateCode)) {
        return;
      }
      if (uNameNorm && knownNames.has(uNameNorm)) {
        return;
      }

      const assignedCode =
        candidateCode && !candidateCode.startsWith('USR-') && !usedCodes.has(candidateCode)
          ? candidateCode
          : generateUniqueSellerCode(u.nombre || u.username, usedCodes);

      usedCodes.add(assignedCode);
      if (uNameNorm) knownNames.add(uNameNorm);

      const synthesized = buildSellerFromSalesUser(u, assignedCode);
      byCleanCode.set(assignedCode, { ...synthesized, _cleanCode: assignedCode });

      if (isNetworkOnline() && !isStaticCloudHost && !autoProvisionedSellerKeys.has(assignedCode)) {
        autoProvisionedSellerKeys.add(assignedCode);
        withTimeout(
          supabase.from('profit_sellers').upsert([synthesized], { onConflict: 'co_ven' }),
          4000
        ).catch(() => {});
        if (!rawUserCoVen && u.id) {
          withTimeout(
            supabase.from('users').update({ co_ven: assignedCode, coVen: assignedCode, seller_id: assignedCode }).eq('id', u.id),
            3000
          ).catch(() => {});
        }
      }
    });

    return Array.from(byCleanCode.values()).map(({ _cleanCode, ...rest }) => rest);
  };

  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_sellers').select('*').order('ven_des', { ascending: true }),
      10000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = enrichAndDedupeSellers(data || []);

    if (mapped.length > 0) {
      saveStorageAllSellers(mapped);
      return mapped;
    }
    return localSellers.length > 0 ? enrichAndDedupeSellers(localSellers) : [];
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseProfitSellers');
    return localSellers.length > 0 ? enrichAndDedupeSellers(localSellers) : [];
  }
};

export const updateSupabaseSellerZone = async (coVen, { coZon, zona }) => {
  const cleanCoVen = String(coVen || '').trim().replace(/^usr-seller-/i, '').trim() || String(coVen || '').trim();
  const currentSellers = getStorageSellers();
  const existing = currentSellers.find(
    (s) => String(s?.coVen || s?.co_ven || s?.id || '').trim().replace(/^usr-seller-/i, '').toUpperCase() === cleanCoVen.toUpperCase()
  );

  // 1. Guardar de forma nativa en tiempo real en la aplicación
  saveStorageSeller({
    ...(existing || {}),
    id: existing?.id || cleanCoVen,
    coVen: cleanCoVen,
    co_ven: cleanCoVen,
    coZon: coZon || '',
    co_zon: coZon || '',
    zona: zona || ''
  });

  // 2. Si no hay conexión de red, encolar para sincronizar cuando se reactive
  if (!isNetworkOnline()) {
    enqueueSyncAction('seller_zone', 'UPDATE', { coVen: cleanCoVen, coZon, zona });
    return { co_ven: cleanCoVen, coVen: cleanCoVen, co_zon: coZon, coZon, zona };
  }

  try {
    const nowIso = new Date().toISOString();
    const payload = {
      co_zon: coZon || null,
      coZon: coZon || null,
      zona: zona || null,
      updated_at: nowIso
    };

    const { data, error } = await withTimeout(
      supabase.from('profit_sellers').update(payload).eq('co_ven', cleanCoVen).select().maybeSingle(),
      8000
    );
    if (!error && data) {
      isSupabaseAvailable = true;
      return data;
    }

    // Si el asesor aún no existía en profit_sellers remoto (ej. recién creado desde users), hacer upsert completo
    const upsertRow = {
      ...(existing || {}),
      id: existing?.id || cleanCoVen,
      co_ven: cleanCoVen,
      coVen: cleanCoVen,
      ven_des: existing?.venDes || existing?.ven_des || cleanCoVen,
      venDes: existing?.venDes || existing?.ven_des || cleanCoVen,
      co_zon: coZon || null,
      coZon: coZon || null,
      zona: zona || null,
      activo: existing?.activo !== false,
      updated_at: nowIso,
      updatedAt: nowIso
    };
    const { data: upserted, error: upsertErr } = await withTimeout(
      supabase.from('profit_sellers').upsert([upsertRow], { onConflict: 'co_ven' }).select().single(),
      8000
    );
    if (upsertErr) throw upsertErr;
    isSupabaseAvailable = true;
    return upserted;
  } catch (err) {
    markSupabaseOffline(err, 'updateSupabaseSellerZone');
    enqueueSyncAction('seller_zone', 'UPDATE', { coVen: cleanCoVen, coZon, zona });
    return { co_ven: cleanCoVen, coVen: cleanCoVen, co_zon: coZon, coZon, zona };
  }
};

export const updateSupabaseSellerPhoto = async (coVen, photoUrl) => {
  resetSupabaseOnlineStatus();
  const rawCoVen = String(coVen || '').trim();
  const cleanCoVen = rawCoVen.replace(/^usr-seller-/i, '').trim() || rawCoVen;
  const nowIso = new Date().toISOString();
  const normalizedPhoto = photoUrl || '';

  const currentSellers = getStorageSellers();
  const existingSeller = currentSellers.find(s => {
    const sCo = String(s.coVen || s.co_ven || s.id || '').trim().replace(/^usr-seller-/i, '').toLowerCase();
    return sCo === cleanCoVen.toLowerCase();
  });
  const sellerName = existingSeller?.venDes || existingSeller?.ven_des || '';

  saveStorageSeller({
    coVen: cleanCoVen,
    co_ven: cleanCoVen,
    ...(sellerName ? { venDes: sellerName, ven_des: sellerName } : {}),
    foto: normalizedPhoto
  });
  broadcastReconcileChange({
    tableId: 'sellers',
    action: 'RECONCILE',
    key: cleanCoVen,
    item: {
      ...(existingSeller || {}),
      coVen: cleanCoVen,
      co_ven: cleanCoVen,
      ...(sellerName ? { venDes: sellerName, ven_des: sellerName } : {}),
      foto: normalizedPhoto,
      updatedAt: nowIso
    }
  });

  // Sincronizar también con la tabla de usuarios (users) si el asesor tiene cuenta de usuario asociada
  try {
    const localUsers = getUsersList();
    const matchedIdx = localUsers.findIndex(u => {
      const uCo = String(u.co_ven || u.coVen || '').trim().replace(/^usr-seller-/i, '').toLowerCase();
      const uId = String(u.id || '').trim().toLowerCase();
      const uName = stripAccents(u.nombre);
      if (cleanCoVen && (uCo === cleanCoVen.toLowerCase() || uId === `usr-seller-${cleanCoVen.toLowerCase()}`)) return true;
      if (sellerName && uName && uName === stripAccents(sellerName)) return true;
      return false;
    });

    if (matchedIdx >= 0) {
      const updatedUser = {
        ...localUsers[matchedIdx],
        foto: photoUrl || null,
        updatedAt: nowIso,
        updated_at: nowIso
      };
      localUsers[matchedIdx] = updatedUser;
      const sortedUsers = sortUsersByHierarchy(localUsers);
      try {
        localStorage.setItem('signum_users_list', JSON.stringify(sortedUsers));
        const rawActive = localStorage.getItem('signum_active_user');
        if (rawActive) {
          const activeObj = JSON.parse(rawActive);
          if (activeObj && (activeObj.id === updatedUser.id || activeObj.username?.toLowerCase() === updatedUser.username?.toLowerCase())) {
            localStorage.setItem('signum_active_user', JSON.stringify(updatedUser));
          }
        }
      } catch (_) {}

      if (isNetworkOnline() && !isStaticCloudHost) {
        try {
          await withTimeout(
            supabase
              .from('users')
              .update({ foto: photoUrl || null, updated_at: nowIso })
              .eq('id', updatedUser.id),
            3000
          );
        } catch (_) {}
      }

      broadcastReconcileChange({
        tableId: 'users',
        action: 'RECONCILE',
        key: updatedUser.id || updatedUser.username,
        item: updatedUser
      });
    }
  } catch (err) {
    console.warn('Error sincronizando foto de asesor con usuario vinculado:', err);
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('profit_sellers')
        .update({ foto: photoUrl || null, updated_at: nowIso })
        .eq('co_ven', cleanCoVen)
        .select()
        .single(),
      4000
    );
    if (error) throw error;
    return data || { co_ven: cleanCoVen, coVen: cleanCoVen, foto: normalizedPhoto };
  } catch (err) {
    console.warn('Error updating seller photo in Supabase:', err);
    return { co_ven: cleanCoVen, coVen: cleanCoVen, foto: normalizedPhoto };
  }
};

export const updateSupabaseSellerTarget = async (coVen, { metaLitrosMes, comisionPct }) => {
  // 1. Guardar de forma nativa en tiempo real en la aplicación
  saveStorageSeller({ coVen, metaLitrosMes, comisionPct });

  if (!isNetworkOnline()) {
    enqueueSyncAction('seller_target', 'UPDATE', { coVen, metaLitrosMes, comisionPct });
    return { co_ven: coVen, meta_litros_mes: metaLitrosMes, comision_pct: comisionPct };
  }

  try {
    const payload = {};
    if (metaLitrosMes !== undefined) payload.meta_litros_mes = Number(metaLitrosMes);
    if (comisionPct !== undefined) payload.comision_pct = Number(comisionPct);
    payload.updated_at = new Date().toISOString();

    const { data, error } = await withTimeout(
      supabase.from('profit_sellers').update(payload).eq('co_ven', coVen).select().single(),
      8000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return data;
  } catch (err) {
    markSupabaseOffline(err, 'updateSupabaseSellerTarget');
    enqueueSyncAction('seller_target', 'UPDATE', { coVen, metaLitrosMes, comisionPct });
    return { co_ven: coVen, meta_litros_mes: metaLitrosMes, comision_pct: comisionPct };
  }
};

export const updateSupabaseGlobalSellersTarget = async (activeSellerCodes = [], totalLitrosMeta = 0) => {
  if (!activeSellerCodes || activeSellerCodes.length === 0) return false;
  const quotaPerSeller = parseFloat((Number(totalLitrosMeta) / activeSellerCodes.length).toFixed(2));
  const now = new Date().toISOString();

  // 1. Persistencia nativa local inmediata para todos los asesores
  activeSellerCodes.forEach(coVen => {
    saveStorageSeller({ coVen, metaLitrosMes: quotaPerSeller });
  });

  // 2. Si no hay conexión de red, encolar acción global offline
  if (!isNetworkOnline()) {
    enqueueSyncAction('seller_global_target', 'UPDATE', { activeSellerCodes, totalLitrosMeta, quotaPerSeller });
    return true;
  }

  try {
    const updates = activeSellerCodes.map(coVen =>
      supabase
        .from('profit_sellers')
        .update({ meta_litros_mes: quotaPerSeller, updated_at: now })
        .eq('co_ven', coVen)
    );

    await Promise.all(updates);
    isSupabaseAvailable = true;
    return true;
  } catch (err) {
    markSupabaseOffline(err, 'updateSupabaseGlobalSellersTarget');
    enqueueSyncAction('seller_global_target', 'UPDATE', { activeSellerCodes, totalLitrosMeta, quotaPerSeller });
    return true;
  }
};

const PROFIT_ZONES_STORAGE_KEY = 'signum_profit_zones_v1';
const DELETED_PROFIT_ZONES_KEY = 'signum_deleted_profit_zones_v1';

const normalizeProfitZoneRecord = (z) => {
  if (!z) return null;
  const coZon = String(z.co_zon || z.coZon || '').trim().toUpperCase();
  const zonDes = String(z.zon_des || z.zonDes || '').trim();
  if (!coZon) return null;
  const nowIso = new Date().toISOString();
  return {
    id: String(z.id || `ZON-${coZon}`).trim(),
    coZon,
    co_zon: coZon,
    zonDes,
    zon_des: zonDes,
    disCen: z.dis_cen ?? z.disCen ?? '',
    dis_cen: z.dis_cen ?? z.disCen ?? '',
    createdAt: z.created_at || z.createdAt || nowIso,
    created_at: z.created_at || z.createdAt || nowIso,
    updatedAt: z.updated_at || z.updatedAt || nowIso,
    updated_at: z.updated_at || z.updatedAt || nowIso
  };
};

const getDeletedProfitZoneSet = () => {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(DELETED_PROFIT_ZONES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((x) => String(x).trim().toUpperCase()).filter(Boolean) : []);
  } catch (_) {
    return new Set();
  }
};

const setDeletedProfitZoneSet = (setObj) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DELETED_PROFIT_ZONES_KEY, JSON.stringify(Array.from(setObj)));
  } catch (_) {}
};

const readLocalProfitZones = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PROFIT_ZONES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeProfitZoneRecord).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
};

const writeLocalProfitZones = (zonesList) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PROFIT_ZONES_STORAGE_KEY, JSON.stringify(zonesList || []));
  } catch (_) {}
};

const mergeAndSortProfitZones = (baseList = []) => {
  const deletedSet = getDeletedProfitZoneSet();
  const seen = new Map();
  (baseList || []).forEach((item) => {
    const norm = normalizeProfitZoneRecord(item);
    if (!norm) return;
    if (deletedSet.has(norm.coZon.toUpperCase()) || deletedSet.has(String(norm.id).toUpperCase())) return;
    seen.set(norm.coZon, norm);
  });
  return Array.from(seen.values()).sort((a, b) => a.coZon.localeCompare(b.coZon, undefined, { numeric: true }));
};

export const getSupabaseProfitZones = async () => {
  const localCached = readLocalProfitZones();
  const localPending = localCached.filter((z) => z && z._pendingServerSync);

  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_zones').select('*').order('co_zon', { ascending: true }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const remoteList = Array.isArray(data) ? data : [];
    const baseSource = remoteList.length > 0 ? remoteList : (localCached.length > 0 ? localCached : REAL_PROFIT_ZONES);
    const merged = mergeAndSortProfitZones([...baseSource, ...localPending]);
    writeLocalProfitZones(merged);
    return merged;
  } catch (err) {
    console.warn('[Supabase] Error cargando zonas Profit:', err.message);
    const fallbackSource = localCached.length > 0 ? localCached : REAL_PROFIT_ZONES;
    return mergeAndSortProfitZones(fallbackSource);
  }
};

export const saveSupabaseProfitZone = async (zoneData, existingZones = []) => {
  const coZon = String(zoneData?.coZon ?? zoneData?.co_zon ?? '').trim().toUpperCase();
  const zonDes = String(zoneData?.zonDes ?? zoneData?.zon_des ?? '').trim();
  if (!coZon) {
    throw new Error('El código de zona es obligatorio (ej. 08).');
  }
  if (!zonDes) {
    throw new Error('El nombre o descripción de la zona es obligatorio.');
  }

  const currentZones = mergeAndSortProfitZones([
    ...(Array.isArray(existingZones) && existingZones.length > 0 ? existingZones : []),
    ...readLocalProfitZones()
  ]);

  const incomingId = zoneData?.id ? String(zoneData.id).trim() : '';
  const isEditingExisting = Boolean(incomingId && currentZones.some((z) => String(z.id) === incomingId));

  // Validar duplicados de código o nombre en otras zonas distintas a la actual
  const duplicateCode = currentZones.find(
    (z) => z.coZon.toUpperCase() === coZon && (!isEditingExisting || String(z.id) !== incomingId)
  );
  if (duplicateCode) {
    throw new Error(`Ya existe una zona con el código "${coZon}" (${duplicateCode.zonDes}).`);
  }

  const targetNameNorm = stripAccents(zonDes);
  const duplicateName = currentZones.find(
    (z) => stripAccents(z.zonDes) === targetNameNorm && (!isEditingExisting || String(z.id) !== incomingId)
  );
  if (duplicateName) {
    throw new Error(`Ya existe otra zona con ese nombre: Zona ${duplicateName.coZon} (${duplicateName.zonDes}).`);
  }

  const existingById = isEditingExisting ? currentZones.find((z) => String(z.id) === incomingId) : null;
  const nowIso = new Date().toISOString();
  const resolvedId = existingById?.id || incomingId || `ZON-${coZon}`;

  const normalized = normalizeProfitZoneRecord({
    ...(existingById || {}),
    ...zoneData,
    id: resolvedId,
    coZon,
    co_zon: coZon,
    zonDes,
    zon_des: zonDes,
    createdAt: existingById?.createdAt || zoneData?.createdAt || nowIso,
    created_at: existingById?.created_at || zoneData?.created_at || nowIso,
    updatedAt: nowIso,
    updated_at: nowIso
  });

  // Limpiar tombstones si se recrea un código previamente eliminado
  const delSet = getDeletedProfitZoneSet();
  delSet.delete(coZon.toUpperCase());
  delSet.delete(resolvedId.toUpperCase());
  setDeletedProfitZoneSet(delSet);

  const nextLocal = mergeAndSortProfitZones([
    ...currentZones.filter((z) => String(z.id) !== resolvedId && z.coZon !== existingById?.coZon),
    { ...normalized, _pendingServerSync: true }
  ]);
  writeLocalProfitZones(nextLocal);

  if (!isNetworkOnline()) {
    enqueueSyncAction('profit_zone', isEditingExisting ? 'UPDATE' : 'INSERT', normalized);
    broadcastReconcileChange({ tableId: 'zones', action: 'RECONCILE', key: coZon, item: normalized });
    return normalized;
  }

  try {
    const dbPayload = {
      id: normalized.id,
      co_zon: normalized.coZon,
      coZon: normalized.coZon,
      zon_des: normalized.zonDes,
      zonDes: normalized.zonDes,
      dis_cen: normalized.disCen || '',
      disCen: normalized.disCen || '',
      created_at: normalized.createdAt,
      updated_at: nowIso
    };
    const { data, error } = await withTimeout(
      supabase.from('profit_zones').upsert([dbPayload], { onConflict: 'id' }).select().single(),
      6000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const savedNorm = normalizeProfitZoneRecord({ ...normalized, ...(data || {}) });
    const syncedLocal = mergeAndSortProfitZones([
      ...currentZones.filter((z) => String(z.id) !== resolvedId && z.coZon !== existingById?.coZon),
      savedNorm
    ]);
    writeLocalProfitZones(syncedLocal);
    broadcastReconcileChange({ tableId: 'zones', action: 'RECONCILE', key: savedNorm.coZon, item: savedNorm });
    return savedNorm;
  } catch (err) {
    console.warn('[saveSupabaseProfitZone] Guardado local/encolado:', err?.message || err);
    markSupabaseOffline(err, 'saveSupabaseProfitZone');
    enqueueSyncAction('profit_zone', isEditingExisting ? 'UPDATE' : 'INSERT', normalized);
    broadcastReconcileChange({ tableId: 'zones', action: 'RECONCILE', key: coZon, item: normalized });
    return normalized;
  }
};

export const deleteSupabaseProfitZone = async (zoneOrCoZon) => {
  const targetId = typeof zoneOrCoZon === 'object' ? String(zoneOrCoZon?.id || '').trim() : '';
  const targetCoZon = (typeof zoneOrCoZon === 'object'
    ? String(zoneOrCoZon?.coZon || zoneOrCoZon?.co_zon || '').trim()
    : String(zoneOrCoZon || '').trim()
  ).toUpperCase();
  if (!targetId && !targetCoZon) return false;

  const delSet = getDeletedProfitZoneSet();
  if (targetId) delSet.add(targetId.toUpperCase());
  if (targetCoZon) delSet.add(targetCoZon);
  setDeletedProfitZoneSet(delSet);

  const filteredLocal = readLocalProfitZones().filter((z) => {
    const zId = String(z?.id || '').trim().toUpperCase();
    const zCode = String(z?.coZon || z?.co_zon || '').trim().toUpperCase();
    return (!targetId || zId !== targetId.toUpperCase()) && (!targetCoZon || zCode !== targetCoZon);
  });
  writeLocalProfitZones(filteredLocal);

  if (!isNetworkOnline()) {
    enqueueSyncAction('profit_zone', 'DELETE', { id: targetId, coZon: targetCoZon });
    broadcastReconcileChange({ tableId: 'zones', action: 'DELETE', key: targetCoZon || targetId, item: { id: targetId, coZon: targetCoZon } });
    return true;
  }

  try {
    if (targetId) {
      await withTimeout(supabase.from('profit_zones').delete().eq('id', targetId), 6000);
    }
    if (targetCoZon) {
      await withTimeout(supabase.from('profit_zones').delete().eq('co_zon', targetCoZon), 6000);
    }
    isSupabaseAvailable = true;
    broadcastReconcileChange({ tableId: 'zones', action: 'DELETE', key: targetCoZon || targetId, item: { id: targetId, coZon: targetCoZon } });
    return true;
  } catch (err) {
    console.warn('[deleteSupabaseProfitZone] Encolado offline:', err?.message || err);
    markSupabaseOffline(err, 'deleteSupabaseProfitZone');
    enqueueSyncAction('profit_zone', 'DELETE', { id: targetId, coZon: targetCoZon });
    broadcastReconcileChange({ tableId: 'zones', action: 'DELETE', key: targetCoZon || targetId, item: { id: targetId, coZon: targetCoZon } });
    return true;
  }
};

export const getSupabaseProfitTransports = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_transports').select('*').order('co_tran', { ascending: true }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(t => ({
      id: t.id,
      coTran: t.co_tran,
      desTran: t.des_tran,
      respTra: t.resp_tra,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    }));
  } catch (err) {
    console.warn('[Supabase] Error cargando transportistas Profit:', err.message);
    return REAL_PROFIT_TRANSPORTS;
  }
};

export const getSupabaseProfitReturns = async () => {
  const local = readLocalDocList(RET_STORAGE_KEY);
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_customer_returns').select('*').order('fec_emis', { ascending: false }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = (data || []).map(r => ({
      id: r.id,
      factNum: r.fact_num || r.factNum,
      fecEmis: r.fec_emis || r.fecEmis,
      coCli: r.co_cli || r.coCli,
      cliDes: r.cli_des || r.cliDes,
      rif: r.rif,
      coVen: r.co_ven || r.coVen,
      venDes: r.ven_des || r.venDes,
      ncNum: r.nc_num || r.ncNum,
      status: r.status,
      anulada: Boolean(r.anulada),
      descrip: r.descrip,
      totBruto: Number(r.tot_bruto ?? r.totBruto) || 0,
      totNeto: Number(r.tot_neto ?? r.totNeto) || 0,
      iva: Number(r.iva) || 0,
      tasa: Number(r.tasa) || 1,
      moneda: r.moneda,
      coSucu: r.co_sucu || r.coSucu,
      coUsIn: r.co_us_in || r.coUsIn,
      renglones: Array.isArray(r.renglones) ? r.renglones : [],
      createdAt: r.created_at || r.createdAt,
      updatedAt: r.updated_at || r.updatedAt
    }));
    return mergeRemoteAndLocalDocs(mapped, local, 'id');
  } catch (err) {
    console.warn('[Supabase] Error cargando devoluciones Profit:', err.message);
    return mergeRemoteAndLocalDocs(REAL_PROFIT_CUSTOMER_RETURNS || [], local, 'id');
  }
};

export const getSupabaseProfitInventoryAdjustments = async () => {
  const local = readLocalDocList(ADJ_STORAGE_KEY);
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_inventory_adjustments').select('*').order('fecha', { ascending: false }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = (data || []).map(a => {
      const renglones = Array.isArray(a.renglones) ? a.renglones : [];
      return {
        id: a.id,
        ajueNum: a.ajue_num || a.ajueNum,
        fecha: a.fecha,
        almacen: a.almacen || renglones[0]?.co_alma || '01',
        motivo: a.motivo,
        anulada: Boolean(a.anulada),
        coSucu: a.co_sucu || a.coSucu,
        coUsIn: a.co_us_in || a.coUsIn,
        totalItems: Number(a.total_items ?? a.totalItems) || 0,
        renglones,
        createdAt: a.created_at || a.createdAt,
        updatedAt: a.updated_at || a.updatedAt
      };
    });
    return mergeRemoteAndLocalDocs(mapped, local, 'id');
  } catch (err) {
    console.warn('[Supabase] Error cargando ajustes de inventario Profit:', err.message);
    return mergeRemoteAndLocalDocs(REAL_PROFIT_INVENTORY_ADJUSTMENTS || [], local, 'id');
  }
};

export const getSupabaseProfitWarehouseTransfers = async () => {
  const local = readLocalDocList(TRAS_STORAGE_KEY);
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_warehouse_transfers').select('*').order('fecha', { ascending: false }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mapped = (data || []).map(t => ({
      id: t.id,
      trasNum: t.tras_num || t.trasNum,
      fecha: t.fecha,
      almOrig: t.alm_orig || t.almOrig,
      almDest: t.alm_dest || t.almDest,
      motivo: t.motivo,
      confirma: Boolean(t.confirma),
      anulada: Boolean(t.anulada),
      coSucu: t.co_sucu || t.coSucu,
      coUsIn: t.co_us_in || t.coUsIn,
      totalItems: Number(t.total_items ?? t.totalItems) || 0,
      renglones: Array.isArray(t.renglones) ? t.renglones : [],
      createdAt: t.created_at || t.createdAt,
      updatedAt: t.updated_at || t.updatedAt
    }));
    return mergeRemoteAndLocalDocs(mapped, local, 'id');
  } catch (err) {
    console.warn('[Supabase] Error cargando traslados de almacén Profit:', err.message);
    return mergeRemoteAndLocalDocs(REAL_PROFIT_WAREHOUSE_TRANSFERS || [], local, 'id');
  }
};

export const getSupabaseProfitIslrConcepts = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_islr_concepts').select('*').order('co_islr', { ascending: true }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(c => ({
      id: c.id,
      coIslr: c.co_islr,
      islrDes: c.islr_des,
      islrDes2: c.islr_des2,
      numeral: c.numeral,
      literal: c.literal,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
  } catch (err) {
    console.warn('[Supabase] Error cargando conceptos ISLR Profit:', err.message);
    return REAL_PROFIT_ISLR_CONCEPTS;
  }
};

export const getSupabaseProfitBeneficiaries = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_beneficiaries').select('*').order('ben_des', { ascending: true }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(b => ({
      id: b.id,
      codBen: b.cod_ben,
      benDes: b.ben_des,
      rif: b.rif,
      direc1: b.direc1,
      telefono: b.telefono,
      tipoPer: b.tipo_per,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    }));
  } catch (err) {
    console.warn('[Supabase] Error cargando beneficiarios Profit:', err.message);
    return REAL_PROFIT_BENEFICIARIES;
  }
};

export const getSupabaseProfitPaymentOrders = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_payment_orders').select('*').order('fecha', { ascending: false }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(o => ({
      id: o.id,
      ordNum: o.ord_num,
      fecha: o.fecha,
      codBen: o.cod_ben,
      benDes: o.ben_des,
      descrip: o.descrip,
      monto: Number(o.monto) || 0,
      montoRet: Number(o.monto_ret) || 0,
      formaPag: o.forma_pag,
      codCta: o.cod_cta,
      cheNum: o.che_num,
      anulada: Boolean(o.anulada),
      tasa: Number(o.tasa) || 1,
      moneda: o.moneda,
      coSucu: o.co_sucu,
      createdAt: o.created_at,
      updatedAt: o.updated_at
    }));
  } catch (err) {
    console.warn('[Supabase] Error cargando órdenes de pago Profit:', err.message);
    return REAL_PROFIT_PAYMENT_ORDERS;
  }
};

const mapIslrWithholdingFromDb = (w) => ({
  id: w.id,
  nroComprobante: w.nro_comprobante,
  periodoFiscal: w.periodo_fiscal,
  fechaEmision: w.fecha_emision || w.created_at,
  proveedorCod: w.proveedor_cod,
  proveedorNombre: w.proveedor_nombre,
  proveedorRif: w.proveedor_rif,
  proveedorDireccion: w.proveedor_direccion,
  nroFacturaAfectada: w.nro_factura_afectada,
  nroControl: w.nro_control,
  baseImponible: Number(w.base_imponible) || 0,
  porcentajeRetencion: Number(w.porcentaje_retencion) || 0,
  montoRetenido: Number(w.monto_retenido) || 0,
  montoTotalFactura: Number(w.monto_total_factura) || 0,
  codigoConceptoIslr: w.codigo_concepto_islr,
  conceptoDescripcion: w.concepto_descripcion,
  sustraendo: Number(w.sustraendo) || 0,
  moneda: w.moneda || 'BS',
  tasaCambio: Number(w.tasa_cambio) || 1,
  coSucu: w.co_sucu || '01',
  createdAt: w.created_at,
  updatedAt: w.updated_at
});

export const getSupabaseProfitIslrWithholdings = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_islr_withholdings').select('*'),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(mapIslrWithholdingFromDb).sort((a, b) => new Date(b.createdAt || b.fechaEmision || 0) - new Date(a.createdAt || a.fechaEmision || 0));
  } catch (err) {
    return [];
  }
};

export const mapWarehouseToDb = (w) => {
  const coAlm = (w.co_alm || w.co_alma || w.coAlm || w.coAlma || w.id?.replace(/^ALM-/, '') || '01').trim();
  const desAlm = (w.des_alm || w.des_alma || w.desAlm || w.desAlma || '').trim();
  const stockActual = Number(w.stock_actual ?? w.stockActual ?? (coAlm === '01' || coAlm === '02' ? 1723 : 0));
  return {
    id: w.id || `ALM-${coAlm}`,
    co_alma: coAlm,
    co_alm: coAlm,
    des_alma: desAlm,
    des_alm: desAlm,
    stock_actual: stockActual,
    campo1: w.campo1 || '',
    campo2: w.campo2 || '',
    fecha_actualizacion: w.fecha_actualizacion || w.fechaActualizacion || new Date().toISOString()
  };
};

export const mapWarehouseFromDb = (w) => {
  const coAlm = (w.co_alm || w.co_alma || w.coAlm || w.coAlma || w.id?.replace(/^ALM-/, '') || '01').trim();
  const desAlm = (w.des_alm || w.des_alma || w.desAlm || w.desAlma || '').trim();
  const stockActual = Number(w.stock_actual ?? w.stockActual ?? (coAlm === '01' || coAlm === '02' ? 1723 : 0));
  return {
    id: w.id || `ALM-${coAlm}`,
    coAlm,
    co_alm: coAlm,
    coAlma: coAlm,
    co_alma: coAlm,
    desAlm,
    des_alm: desAlm,
    desAlma: desAlm,
    des_alma: desAlm,
    stockActual,
    stock_actual: stockActual,
    campo1: w.campo1 || '',
    campo2: w.campo2 || '',
    fechaActualizacion: w.fecha_actualizacion || w.fechaActualizacion || new Date().toISOString()
  };
};

export const getSupabaseProfitWarehouses = async () => {
  const onlyTwoWarehouses = (list) =>
    (list || []).filter(w => {
      const code = String(w?.coAlm || w?.co_alm || w?.coAlma || w?.co_alma || w?.id || '').replace(/^ALM-/, '').trim();
      return code === '01' || code === '02';
    });
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_warehouses').select('*').order('id', { ascending: true }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return onlyTwoWarehouses((data || []).map(mapWarehouseFromDb));
  } catch (err) {
    console.warn('[Supabase] Error cargando almacenes Profit:', err.message);
    return onlyTwoWarehouses(REAL_PROFIT_WAREHOUSES);
  }
};

export const saveSupabaseWarehouse = async (warehouse) => {
  const dbRecord = mapWarehouseToDb(warehouse);
  if (isNetworkOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from('profit_warehouses').upsert(dbRecord, { onConflict: 'id' }),
        5000
      );
      if (error) throw error;
      isSupabaseAvailable = true;
    } catch (err) {
      markSupabaseOffline(err, 'saveSupabaseWarehouse');
    }
  }
  return mapWarehouseFromDb(dbRecord);
};

export const saveSupabaseBatchWarehouses = async (warehousesList) => {
  if (!Array.isArray(warehousesList) || warehousesList.length === 0) return [];
  const dbRecords = warehousesList.map(mapWarehouseToDb);
  if (isNetworkOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from('profit_warehouses').upsert(dbRecords, { onConflict: 'id' }),
        5000
      );
      if (error) throw error;
      isSupabaseAvailable = true;
    } catch (err) {
      markSupabaseOffline(err, 'saveSupabaseBatchWarehouses');
    }
  }
  return dbRecords.map(mapWarehouseFromDb);
};

export const getSupabaseProfitProductLines = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_product_lines').select('*'),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(l => {
      const coLin = l.co_lin || l.coLin || l.id?.replace(/^LIN-/, '') || '';
      const linDes = l.lin_des || l.linDes || l.descripcion || l.nombre || coLin;
      return {
        id: l.id || `LIN-${coLin}`,
        coLin,
        co_lin: coLin,
        linDes,
        lin_des: linDes,
        campo1: l.campo1 || '',
        fechaActualizacion: l.fecha_actualizacion || l.fechaActualizacion || new Date().toISOString()
      };
    });
  } catch (err) {
    console.warn('[Supabase] Error cargando líneas Profit:', err.message);
    return REAL_PROFIT_PRODUCT_LINES;
  }
};

export const getSupabaseProfitProductCategories = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_product_categories').select('*'),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(c => {
      const coCat = c.co_cat || c.coCat || c.id?.replace(/^CAT-/, '') || '';
      const catDes = c.cat_des || c.catDes || c.descripcion || coCat;
      return {
        id: c.id || `CAT-${coCat}`,
        coCat,
        co_cat: coCat,
        catDes,
        cat_des: catDes,
        fechaActualizacion: c.fecha_actualizacion || c.fechaActualizacion || new Date().toISOString()
      };
    });
  } catch (err) {
    console.warn('[Supabase] Error cargando categorías Profit:', err.message);
    return REAL_PROFIT_PRODUCT_CATEGORIES;
  }
};

export const getSupabaseProfitCurrencies = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_currencies').select('*').order('co_mone', { ascending: true }),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(m => ({
      id: m.id,
      coMone: m.co_mone,
      moneDes: m.mone_des,
      cambio: Number(m.cambio) || 1,
      fechaActualizacion: m.fecha_actualizacion
    }));
  } catch (err) {
    console.warn('[Supabase] Error cargando monedas Profit:', err.message);
    return REAL_PROFIT_CURRENCIES;
  }
};

export const saveSupabaseProfitIslrWithholding = async (withholding) => {
  try {
    const payload = {
      nro_comprobante: withholding.nroComprobante,
      periodo_fiscal: withholding.periodoFiscal,
      fecha_emision: withholding.fechaEmision,
      proveedor_cod: withholding.proveedorCod,
      proveedor_nombre: withholding.proveedorNombre,
      proveedor_rif: withholding.proveedorRif,
      proveedor_direccion: withholding.proveedorDireccion,
      nro_factura_afectada: withholding.nroFacturaAfectada,
      nro_control: withholding.nroControl,
      base_imponible: withholding.baseImponible,
      porcentaje_retencion: withholding.porcentajeRetencion,
      monto_retenido: withholding.montoRetenido,
      monto_total_factura: withholding.montoTotalFactura,
      codigo_concepto_islr: withholding.codigoConceptoIslr,
      concepto_descripcion: withholding.conceptoDescripcion,
      sustraendo: withholding.sustraendo || 0,
      moneda: withholding.moneda || 'BS',
      tasa_cambio: withholding.tasaCambio || 1,
      co_sucu: withholding.coSucu || '01',
      updated_at: new Date().toISOString()
    };
    if (withholding.id) payload.id = withholding.id;

    const { data, error } = await supabase
      .from('profit_islr_withholdings')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: data ? mapIslrWithholdingFromDb(data) : withholding };
  } catch (err) {
    console.error('[Supabase] Error guardando comprobante ISLR:', err);
    return { success: false, error: err.message };
  }
};

export const getSupabaseProfitAuditTrails = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profit_audit_trails').select('*').order('fecha', { ascending: false }).limit(500),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return (data || []).map(p => ({
      id: p.id,
      usuarioId: p.usuario_id,
      usuario: p.usuario,
      fecha: p.fecha,
      empresa: p.empresa,
      coSucu: p.co_sucu,
      tabla: p.tabla,
      numDoc: p.num_doc,
      codigo: p.codigo,
      tipoOp: p.tipo_op,
      maquina: p.maquina,
      campos: p.campos,
      rowguid: p.rowguid,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
  } catch (err) {
    console.warn('[Supabase] Error cargando pistas de auditoría Profit:', err.message);
    return [];
  }
};

// ==========================================================================
// MÓDULO CORPORATIVO: CENTRO DE NOTIFICACIONES & ALERTAS (SUPABASE & OFFLINE)
// ==========================================================================

export const getSupabaseNotifications = async () => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      4000
    );

    if (error) throw error;
    isSupabaseAvailable = true;

    if (Array.isArray(data) && data.length > 0) {
      data.forEach(n => saveStorageNotification(n));
      return data;
    }
  } catch (err) {
    markSupabaseOffline(err, 'getSupabaseNotifications');
  }

  return getStorageNotifications();
};

export const saveSupabaseNotification = async (notificationData) => {
  const notifId = notificationData.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const payload = {
    id: notifId,
    tipo: notificationData.tipo || 'sistema',
    severidad: notificationData.severidad || 'info', // 'critica' | 'advertencia' | 'info' | 'exito'
    modulo: notificationData.modulo || 'dashboard',
    titulo: notificationData.titulo || 'Notificación del Sistema',
    mensaje: notificationData.mensaje || '',
    leida: Boolean(notificationData.leida),
    destinatario_rol: notificationData.destinatario_rol || 'ALL',
    destinatario_usuario: notificationData.destinatario_usuario || 'ALL',
    origen: notificationData.origen || 'SISTEMA',
    metadata: notificationData.metadata || {},
    created_at: notificationData.created_at || new Date().toISOString()
  };

  saveStorageNotification(payload);

  try {
    const { data, error } = await withTimeout(
      supabase.from('notifications').upsert(payload).select().single(),
      4000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    return data;
  } catch (err) {
    markSupabaseOffline(err, 'saveSupabaseNotification');
    enqueueSyncAction('notification', 'INSERT', payload);
    return payload;
  }
};

export const markSupabaseNotificationRead = async (id) => {
  markStorageNotificationRead(id);
  const now = new Date().toISOString();

  try {
    const { error } = await withTimeout(
      supabase.from('notifications').update({ leida: true, leido: true, fecha_leida: now }).eq('id', id),
      3500
    );
    if (error) throw error;
    isSupabaseAvailable = true;
  } catch (err) {
    markSupabaseOffline(err, 'markSupabaseNotificationRead');
    enqueueSyncAction('notification', 'UPDATE', { id, leida: true, leido: true, fecha_leida: now });
  }
};

export const markAllSupabaseNotificationsRead = async () => {
  markAllStorageNotificationsRead();
  const now = new Date().toISOString();

  try {
    const { error } = await withTimeout(
      supabase.from('notifications').update({ leida: true, leido: true, fecha_leida: now }).eq('leida', false),
      3500
    );
    if (error) throw error;
    isSupabaseAvailable = true;
  } catch (err) {
    markSupabaseOffline(err, 'markAllSupabaseNotificationsRead');
    enqueueSyncAction('notification', 'MARK_ALL_READ', { fecha_leida: now });
  }
};

export const deleteSupabaseNotification = async (id) => {
  deleteStorageNotification(id);

  try {
    const { error } = await withTimeout(
      supabase.from('notifications').delete().eq('id', id),
      3500
    );
    if (error) throw error;
    isSupabaseAvailable = true;
  } catch (err) {
    markSupabaseOffline(err, 'deleteSupabaseNotification');
  }
};

export const seedInitialNotificationsIfEmpty = async (products = [], clients = [], config = {}) => {
  try {
    const existing = await getSupabaseNotifications();
    if (Array.isArray(existing) && existing.length > 0) {
      return existing;
    }

    const initialNotifs = [
      {
        id: 'notif_init_01',
        tipo: 'stock',
        severidad: 'critica',
        modulo: 'inventario',
        titulo: 'Alerta ROP: 21 SKUs en Nivel Crítico de Inventario',
        mensaje: 'La matriz de punto de reorden detectó 21 productos de lubricantes Oilstone por debajo del umbral mínimo de seguridad. Se requiere emitir orden de reposición a planta.',
        destinatario_rol: 'ALL',
        origen: 'MATRIZ ROP',
        metadata: { skusCriticos: 21, almacen: 'ALM-01 Planta Principal' }
      },
      {
        id: 'notif_init_02',
        tipo: 'cxc',
        severidad: 'advertencia',
        modulo: 'cxc',
        titulo: 'Cobranzas: Facturas Vencidas con Más de 30 Días de Mora',
        mensaje: 'El módulo de Cuentas por Cobrar detectó cuentas pendientes en semáforo rojo. Se activaron recordatorios automatizados de cobranza y estado de cuenta vía WhatsApp.',
        destinatario_rol: 'ADMINISTRACIÓN & FINANZAS',
        origen: 'MOTOR CXC',
        metadata: { agingDays: 30 }
      },
      {
        id: 'notif_init_03',
        tipo: 'fiscal',
        severidad: 'info',
        modulo: 'reportes',
        titulo: 'SENIAT: Libro Fiscal de Ventas e IVA Preparado',
        mensaje: 'Los comprobantes de retención IVA (75%) y la numeración consecutiva fiscal de facturas están cuadrados y listos para la exportación de archivos oficiales TXT y XML.',
        destinatario_rol: 'ALL',
        origen: 'MOTOR FISCAL',
        metadata: { providencia: 'SNAT/2011/00071' }
      },
      {
        id: 'notif_init_04',
        tipo: 'sistema',
        severidad: 'exito',
        modulo: 'dashboard',
        titulo: 'Sincronización Supabase en Tiempo Real Activa',
        mensaje: 'La base de datos Supabase opera con latencia óptima y persistencia en tiempo real de clientes y catálogo.',
        destinatario_rol: 'ALL',
        origen: 'SUPABASE',
        metadata: {}
      },
      {
        id: 'notif_init_05',
        tipo: 'sistema',
        severidad: 'info',
        modulo: 'configuracion',
        titulo: 'Tipo de Cambio Oficial BCV Actualizado',
        mensaje: `Tasa cambiaria oficial del Banco Central de Venezuela fijada en ${config?.tasaDolar || '827.73'} Bs./USD con Tasa Keystone operativa.`,
        destinatario_rol: 'ALL',
        origen: 'BCV SCRAPER',
        metadata: { tasa: config?.tasaDolar || 827.73 }
      }
    ];

    for (const item of initialNotifs) {
      await saveSupabaseNotification(item);
    }

    return await getSupabaseNotifications();
  } catch (err) {
    console.warn('[Supabase] Error en seed de notificaciones iniciales:', err);
    return getStorageNotifications();
  }
};

// ==============================================================================
// TABLAS AVANZADAS SUPABASE (GRUMOTOR) SINCRONIZADAS EN SUPABASE
// ==============================================================================

export const getSupabaseProfitBanks = async () => {
  try {
    const { data, error } = await supabase.from('profit_banks').select('*').order('co_ban', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando bancos:', err.message);
    return [];
  }
};

export const getSupabaseProfitPaymentConditions = async () => {
  try {
    const { data, error } = await supabase.from('profit_payment_conditions').select('*').order('dias_cred', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando condiciones de pago:', err.message);
    return [];
  }
};

export const getSupabaseProfitIncomeExpenseAccounts = async () => {
  try {
    const { data, error } = await supabase.from('profit_income_expense_accounts').select('*').order('co_ingr', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando cuentas de ingresos/gastos:', err.message);
    return [];
  }
};

export const getSupabaseProfitMeasurementUnits = async () => {
  try {
    const { data, error } = await supabase.from('profit_measurement_units').select('*').order('co_uni', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando unidades de medida:', err.message);
    return [];
  }
};

export const getSupabaseProfitProductSublines = async () => {
  try {
    const { data, error } = await supabase.from('profit_product_sublines').select('*');
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      return data.map(s => {
        const coSubl = s.co_subl || s.coSubl || s.id?.replace(/^SUB-/, '') || '';
        const sublDes = s.subl_des || s.sublDes || s.descripcion || s.nombre || coSubl;
        const coLin = s.co_lin || s.coLin || '';
        return {
          id: s.id || `SUB-${coSubl}`,
          coSubl,
          co_subl: coSubl,
          sublDes,
          subl_des: sublDes,
          coLin,
          co_lin: coLin,
          updatedAt: s.updated_at || s.updatedAt || new Date().toISOString()
        };
      });
    }
    return [
      { id: 'SUB-MIN-GAS', coSubl: 'MIN-GAS', co_subl: 'MIN-GAS', sublDes: 'Mineral Motor Gasolina', subl_des: 'Mineral Motor Gasolina', coLin: 'LUB-GAS', co_lin: 'LUB-GAS' },
      { id: 'SUB-SEM-GAS', coSubl: 'SEM-GAS', co_subl: 'SEM-GAS', sublDes: 'Semi-Sintético Alta Tecnología R500', subl_des: 'Semi-Sintético Alta Tecnología R500', coLin: 'LUB-GAS', co_lin: 'LUB-GAS' },
      { id: 'SUB-AK-GAS', coSubl: 'AK-GAS', co_subl: 'AK-GAS', sublDes: 'Alto Kilometraje / Recorridos Gasolina', subl_des: 'Alto Kilometraje / Recorridos Gasolina', coLin: 'LUB-GAS', co_lin: 'LUB-GAS' },
      { id: 'SUB-DIE-50', coSubl: 'DIE-50', co_subl: 'DIE-50', sublDes: 'Diésel Monogrado SAE 50 CF/CF-2', subl_des: 'Diésel Monogrado SAE 50 CF/CF-2', coLin: 'LUB-DIE', co_lin: 'LUB-DIE' },
      { id: 'SUB-DIE-15W', coSubl: 'DIE-15W', co_subl: 'DIE-15W', sublDes: 'Diésel Multigrado SAE 15W-40 CI-4', subl_des: 'Diésel Multigrado SAE 15W-40 CI-4', coLin: 'LUB-DIE', co_lin: 'LUB-DIE' },
      { id: 'SUB-HID-68', coSubl: 'HID-68', co_subl: 'HID-68', sublDes: 'Hidráulicos Anti-desgaste ISO VG 68', subl_des: 'Hidráulicos Anti-desgaste ISO VG 68', coLin: 'LUB-HID', co_lin: 'LUB-HID' },
      { id: 'SUB-TRA-AUT', coSubl: 'TRA-AUT', co_subl: 'TRA-AUT', sublDes: 'Transmisión Automática Dexron II / Mercon', subl_des: 'Transmisión Automática Dexron II / Mercon', coLin: 'LUB-TRA', co_lin: 'LUB-TRA' },
      { id: 'SUB-TRA-MAN', coSubl: 'TRA-MAN', co_subl: 'TRA-MAN', sublDes: 'Transmisión Manual y Diferenciales SAE 140 GL-4', subl_des: 'Transmisión Manual y Diferenciales SAE 140 GL-4', coLin: 'LUB-TRA', co_lin: 'LUB-TRA' },
      { id: 'SUB-MOT-2T', coSubl: 'MOT-2T', co_subl: 'MOT-2T', sublDes: 'Motos 2 Tiempos API TC JASO FB', subl_des: 'Motos 2 Tiempos API TC JASO FB', coLin: 'LUB-MOT', co_lin: 'LUB-MOT' },
      { id: 'SUB-MOT-4T', coSubl: 'MOT-4T', co_subl: 'MOT-4T', sublDes: 'Motos 4 Tiempos 20W-50 JASO MA2', subl_des: 'Motos 4 Tiempos 20W-50 JASO MA2', coLin: 'LUB-MOT', co_lin: 'LUB-MOT' },
      { id: 'SUB-MAR-FB', coSubl: 'MAR-FB', co_subl: 'MAR-FB', sublDes: 'Marino Fuera de Borda TC-W3', subl_des: 'Marino Fuera de Borda TC-W3', coLin: 'LUB-GAS', co_lin: 'LUB-GAS' },
      { id: 'SUB-GRA-CHA', coSubl: 'GRA-CHA', co_subl: 'GRA-CHA', sublDes: 'Grasas Automotrices y Chasis', subl_des: 'Grasas Automotrices y Chasis', coLin: 'GRA-AUT', co_lin: 'GRA-AUT' },
      { id: 'SUB-SER-FLE', coSubl: 'SER-FLE', co_subl: 'SER-FLE', sublDes: 'Servicios de Flete y Distribución', subl_des: 'Servicios de Flete y Distribución', coLin: 'SER-LOG', co_lin: 'SER-LOG' },
      { id: 'SUB-GAS-NOP', coSubl: 'GAS-NOP', co_subl: 'GAS-NOP', sublDes: 'Gastos Operacionales y Publicidad', subl_des: 'Gastos Operacionales y Publicidad', coLin: 'GAS-OPE', co_lin: 'GAS-OPE' }
    ];
  } catch (err) {
    console.warn('[Supabase] Error cargando sublíneas de productos:', err.message);
    return [];
  }
};

export const getSupabaseProfitTaxRates = async () => {
  try {
    const { data, error } = await supabase.from('profit_tax_rates').select('*').order('fecha', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando tasas impositivas:', err.message);
    return [];
  }
};

export const getSupabaseProfitStockByWarehouse = async (coArt = null) => {
  try {
    let query = supabase
      .from('profit_stock_by_warehouse')
      .select('id,co_art,co_alma,codigo,oem,descripcion,nombre,unidad,litros_por_unidad,stock_act,stock_com,stock_lle,stock_des,stock_disp,updated_at,des_alma,alma_des,costo_usd,precio_usd_detal,precio_usd_mayor');
    if (coArt) query = query.eq('co_art', coArt);
    const { data, error } = await withTimeout(query, 30000);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando stock por almacén:', err.message);
    return [];
  }
};

export const getSupabaseProfitGoodsReceiptNotes = async (limit = 100) => {
  try {
    const { data, error } = await supabase.from('profit_goods_receipt_notes').select('*').order('fec_emis', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando notas de recepción:', err.message);
    return [];
  }
};

export const getSupabaseProfitCashMovementsDetailed = async (limit = 500) => {
  try {
    const { data, error } = await supabase.from('profit_cash_movements_detailed').select('*').order('fecha', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando movimientos de caja detallados:', err.message);
    return [];
  }
};

export const getSupabaseProfitBankMovements = async (limit = 1000) => {
  try {
    const { data, error } = await supabase.from('profit_bank_movements').select('*').order('fecha', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando movimientos bancarios:', err.message);
    return [];
  }
};

export const getSupabaseProfitPaymentMethodsCollections = async (limit = 1000) => {
  try {
    const { data, error } = await supabase.from('profit_payment_methods_collections').select('*').limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando formas de pago en cobros:', err.message);
    return [];
  }
};

export const getSupabaseProfitPaymentMethodsSupplierPayments = async (limit = 500) => {
  try {
    const { data, error } = await supabase.from('profit_payment_methods_supplier_payments').select('*').limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando formas de pago a proveedores:', err.message);
    return [];
  }
};

export const getSupabaseProfitAuditTrailsEvents = async (limit = 500) => {
  try {
    const { data, error } = await supabase.from('profit_audit_trails_events').select('*').order('fecha', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[Supabase] Error cargando pistas de auditoría de Supabase:', err.message);
    return [];
  }
};

// =========================================================================
// DOCUMENTOS EMPRESARIALES EXTENDIDOS (REQ, OC, RECEPCIONES, OP, TRASLADOS, AJUSTES, DEVOLUCIONES)
// =========================================================================
function readLocalDocList(storageKey) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function upsertLocalDocList(storageKey, record, idField = 'id') {
  const list = readLocalDocList(storageKey);
  const key = String(record?.[idField] || record?.id || '').trim();
  const idx = key ? list.findIndex(r => String(r?.[idField] || r?.id || '').trim() === key) : -1;
  const next = idx >= 0 ? list.map((r, i) => (i === idx ? { ...r, ...record } : r)) : [record, ...list];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  } catch (_) {}
  return next;
}

function mergeRemoteAndLocalDocs(remoteList = [], localList = [], idField = 'id') {
  const map = new Map();
  [...localList, ...remoteList].forEach((item) => {
    if (!item) return;
    const key = String(item[idField] || item.id || '').trim();
    if (key) map.set(key, { ...(map.get(key) || {}), ...item });
  });
  return Array.from(map.values());
}

const CLIENT_APPLIED_DELTA_KEY = 'signum_applied_stock_deltas_v1';

function hasAppliedClientStockDeltaKey(key) {
  if (!key || typeof window === 'undefined' || isTestEnv) return false;
  try {
    const raw = window.localStorage?.getItem(CLIENT_APPLIED_DELTA_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) && list.includes(key);
  } catch (_) {
    return false;
  }
}

function markAppliedClientStockDeltaKey(key) {
  if (!key || typeof window === 'undefined' || isTestEnv) return;
  try {
    const raw = window.localStorage?.getItem(CLIENT_APPLIED_DELTA_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    if (!arr.includes(key)) {
      arr.push(key);
      if (arr.length > 400) arr.splice(0, arr.length - 400);
      window.localStorage?.setItem(CLIENT_APPLIED_DELTA_KEY, JSON.stringify(arr));
    }
  } catch (_) {}
}

const buildWarehouseStockDeltaPatches = (normalizedDeltaLines = [], sourceMap = new Map(), storageProds = [], { validateStrict = false } = {}) => {
  // Acumular deltas netos por SKU resuelto para evitar dobles lecturas o validaciones parciales
  const groupedDeltas = new Map();
  for (const line of normalizedDeltaLines) {
    const code = line.codigo;
    const delta01 = line.delta01;
    const delta02 = line.delta02;

    const existing = sourceMap.get(code) || storageProds.find(p => String(p.id) === code || String(p.codigo) === code);
    if (!existing) {
      if (validateStrict) {
        throw new Error(`Producto/SKU "${code}" no encontrado en el inventario.`);
      }
      continue;
    }

    const prodId = String(existing.id || code);
    const prev = groupedDeltas.get(prodId) || { existing, delta01: 0, delta02: 0 };
    prev.delta01 = Number((prev.delta01 + delta01).toFixed(4));
    prev.delta02 = Number((prev.delta02 + delta02).toFixed(4));
    groupedDeltas.set(prodId, prev);
  }

  const productPatches = [];
  const whRows = [];
  const nowIso = new Date().toISOString();

  // Validar existencia suficiente ANTES de mutar localStorage o BD
  for (const [prodId, entry] of groupedDeltas.entries()) {
    const { existing, delta01, delta02 } = entry;
    const stocks = getProductWarehouseStocks(existing);
    const prodCode = String(existing.codigo || prodId);
    const rawNext01 = Number((stocks.stock01 + delta01).toFixed(2));
    const rawNext02 = Number((stocks.stock02 + delta02).toFixed(2));

    if (validateStrict) {
      if (delta01 < 0 && rawNext01 < -0.0001) {
        throw new Error(
          `Stock insuficiente para ${prodCode} en Almacén 01 (Fiscal): disponible ${stocks.stock01}, solicitado ${Math.abs(delta01)}.`
        );
      }
      if (delta02 < 0 && rawNext02 < -0.0001) {
        throw new Error(
          `Stock insuficiente para ${prodCode} en Almacén 02 (N.E.): disponible ${stocks.stock02}, solicitado ${Math.abs(delta02)}.`
        );
      }
    }

    const next01 = Math.max(0, rawNext01);
    const next02 = Math.max(0, rawNext02);
    const nextTotal = Number((next01 + next02).toFixed(2));

    productPatches.push({
      id: prodId,
      codigo: prodCode,
      stock: nextTotal,
      stockAlmacen01: next01,
      stockAlmacen02: next02,
      stock_almacen_01: next01,
      stock_almacen_02: next02
    });

    if (delta01 !== 0) {
      whRows.push({ id: `${prodId}_01`, co_art: prodId, codigo: prodCode, co_alma: '01', stock_act: next01, stock_disp: next01, updated_at: nowIso });
    }
    if (delta02 !== 0) {
      whRows.push({ id: `${prodId}_02`, co_art: prodId, codigo: prodCode, co_alma: '02', stock_act: next02, stock_disp: next02, updated_at: nowIso });
    }
  }

  return { productPatches, whRows, nowIso };
};

export async function applyStockDeltaForWarehouseLines(lines = [], options = {}) {
  const {
    validateStrict = false,
    idempotencyKey = '',
    skipLocalStoragePatch = false,
    throwOnRemoteError = false,
    forceServerFetch = false
  } = options || {};
  if (!Array.isArray(lines) || lines.length === 0) return [];
  const normalizedDeltaLines = lines
    .map(l => ({
      codigo: String(l?.codigo || l?.co_art || l?.articuloId || l?.id || '').trim(),
      delta01: Number(l?.delta01 || 0),
      delta02: Number(l?.delta02 || 0)
    }))
    .filter(l => l.codigo && (l.delta01 !== 0 || l.delta02 !== 0));
  if (normalizedDeltaLines.length === 0) return [];
  const explicitKey = String(idempotencyKey || '').trim();
  if (explicitKey && hasAppliedClientStockDeltaKey(explicitKey)) {
    return [];
  }
  const touchedCodes = Array.from(new Set(normalizedDeltaLines.map(l => l.codigo)));
  const resolvedDeltaKey =
    explicitKey ||
    `delta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Vía atómica en servidor (/inventory/apply-delta): evita condiciones de carrera entre cajas/usuarios
  const canUseAtomicEndpoint =
    (forceServerFetch || (typeof window !== 'undefined' && !isTestEnv)) &&
    isNetworkOnline() &&
    isSupabaseAvailable &&
    typeof fetch !== 'undefined' &&
    Boolean(currentBackendUrl);

  if (canUseAtomicEndpoint) {
    let allowNonAtomicFallback = false;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tid = controller ? setTimeout(() => controller.abort(), 45000) : null;
      const base = String(currentBackendUrl).replace(/\/+$/, '');
      const res = await dynamicSupabaseFetch(`${base}/inventory/apply-delta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          lines: normalizedDeltaLines,
          validateStrict: Boolean(validateStrict),
          idempotencyKey: resolvedDeltaKey
        }),
        signal: controller?.signal
      });
      if (tid) clearTimeout(tid);

      if (res.status === 409) {
        const errBody = await res.json().catch(() => ({}));
        const err = new Error(errBody?.error || 'Stock insuficiente en almacén.');
        err.isValidationError = true;
        err.code = errBody?.code || 'INSUFFICIENT_WAREHOUSE_STOCK';
        throw err;
      }

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.ok && Array.isArray(data.updatedProducts)) {
          if (explicitKey) markAppliedClientStockDeltaKey(explicitKey);
          if (data.updatedProducts.length > 0) {
            patchProductsStockInStorage(data.updatedProducts);
            data.updatedProducts.forEach(p => {
              broadcastReconcileChange({
                tableId: 'products',
                action: 'RECONCILE',
                key: p.codigo || p.id,
                item: p
              });
            });
          }
          return data.updatedProducts;
        }
        throw new Error(data?.error || 'Respuesta inválida del servidor en apply-delta');
      } else if (res.status === 404 || res.status === 501) {
        allowNonAtomicFallback = true;
      } else {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `HTTP ${res.status} en apply-delta`);
      }
    } catch (atomicErr) {
      if (atomicErr?.isValidationError || atomicErr?.code === 'INSUFFICIENT_WAREHOUSE_STOCK') {
        throw atomicErr;
      }
      if (throwOnRemoteError) throw atomicErr;

      // Ante timeout, caída de red o 5xx tras intentar el endpoint atómico, no caer a PATCH directo
      // sobre products porque omitiría APPLIED_STOCK_DELTA_KEYS en servidor y podría duplicar descuentos.
      console.warn('[applyStockDeltaForWarehouseLines] Encolando stock_delta idempotente tras fallo en endpoint atómico:', atomicErr?.message || atomicErr);
      markSupabaseOffline(atomicErr, 'applyStockDeltaForWarehouseLines');
      const { productPatches: optimisticPatches } = buildWarehouseStockDeltaPatches(
        normalizedDeltaLines,
        new Map(),
        getStorageProducts(),
        { validateStrict: false }
      );
      if (optimisticPatches.length > 0 && !skipLocalStoragePatch) {
        patchProductsStockInStorage(optimisticPatches);
        optimisticPatches.forEach(p => {
          broadcastReconcileChange({
            tableId: 'products',
            action: 'RECONCILE',
            key: p.codigo || p.id,
            item: p
          });
        });
      }
      enqueueSyncAction('stock_delta', 'UPDATE', {
        id: resolvedDeltaKey,
        idempotencyKey: resolvedDeltaKey,
        lines: normalizedDeltaLines,
        validateStrict: Boolean(validateStrict),
        alreadyAppliedLocally: !skipLocalStoragePatch
      });
      return optimisticPatches;
    }

    if (!allowNonAtomicFallback) {
      return [];
    }
  }

  const storageProds = getStorageProducts();
  const remoteMap = new Map();
  if (isNetworkOnline() && isSupabaseAvailable) {
    try {
      const orParts = touchedCodes.flatMap(k => [`id.eq.${k}`, `codigo.eq.${k}`]);
      const { data, error: fetchErr } = await withTimeout(
        supabase
          .from('products')
          .select('id,codigo,descripcion,stock,stock_almacen_01,stock_almacen_02,stockAlmacen01,stockAlmacen02,comprometido')
          .or(orParts.join(',')),
        6000
      );
      if (fetchErr) {
        console.warn('[applyStockDeltaForWarehouseLines] Error consultando stock remoto:', fetchErr.message);
      } else {
        (data || []).forEach(p => {
          if (p.id) remoteMap.set(String(p.id), p);
          if (p.codigo) remoteMap.set(String(p.codigo), p);
        });
      }
    } catch (err) {
      console.warn('[applyStockDeltaForWarehouseLines] Timeout/error leyendo stock remoto:', err?.message || err);
    }
  }

  const { productPatches, whRows, nowIso } = buildWarehouseStockDeltaPatches(
    normalizedDeltaLines,
    remoteMap,
    storageProds,
    { validateStrict }
  );

  if (productPatches.length > 0) {
    if (!skipLocalStoragePatch) {
      patchProductsStockInStorage(productPatches);
    }
    productPatches.forEach(p => {
      broadcastReconcileChange({
        tableId: 'products',
        action: 'RECONCILE',
        key: p.codigo || p.id,
        item: p
      });
    });

    if (isNetworkOnline() && isSupabaseAvailable) {
      try {
        const prodResults = await Promise.all(
          productPatches.map(p =>
            withTimeout(
              supabase
                .from('products')
                .update({
                  stock: p.stock,
                  stockAlmacen01: p.stockAlmacen01,
                  stock_almacen_01: p.stockAlmacen01,
                  stockAlmacen02: p.stockAlmacen02,
                  stock_almacen_02: p.stockAlmacen02,
                  updated_at: nowIso
                })
                .eq('id', p.id),
              6000
            )
          )
        );
        const firstProdErr = prodResults.find(r => r?.error)?.error;
        if (firstProdErr) {
          throw firstProdErr;
        }
        if (explicitKey) markAppliedClientStockDeltaKey(explicitKey);

        // Sincronizar profit_stock_by_warehouse sin re-encolar stock_delta si products ya persistió
        if (whRows.length > 0) {
          withTimeout(
            supabase.from('profit_stock_by_warehouse').upsert(whRows, { onConflict: 'id' }),
            6000
          ).catch((whErr) => {
            console.warn('[applyStockDeltaForWarehouseLines] Aviso sincronizando profit_stock_by_warehouse:', whErr?.message || whErr);
          });
        }
      } catch (err) {
        if (throwOnRemoteError) throw err;
        console.warn('[applyStockDeltaForWarehouseLines] Error persistiendo stock en servidor, encolando delta atómico:', err?.message || err);
        markSupabaseOffline(err, 'applyStockDeltaForWarehouseLines');
        enqueueSyncAction('stock_delta', 'UPDATE', {
          id: resolvedDeltaKey,
          idempotencyKey: resolvedDeltaKey,
          lines: normalizedDeltaLines,
          validateStrict: Boolean(validateStrict),
          alreadyAppliedLocally: !skipLocalStoragePatch
        });
      }
    } else {
      if (throwOnRemoteError) {
        throw new Error('Sin conexión para aplicar delta de inventario.');
      }
      enqueueSyncAction('stock_delta', 'UPDATE', {
        id: resolvedDeltaKey,
        idempotencyKey: resolvedDeltaKey,
        lines: normalizedDeltaLines,
        validateStrict: Boolean(validateStrict),
        alreadyAppliedLocally: !skipLocalStoragePatch
      });
    }
  }
  return productPatches;
}

const REQ_STORAGE_KEY = 'signum_purchase_requisitions_v1';
const PO_STORAGE_KEY = 'signum_purchase_orders_v1';
const REC_STORAGE_KEY = 'signum_goods_receipt_notes_v1';
const OP_STORAGE_KEY = 'signum_payment_orders_v1';
const TRAS_STORAGE_KEY = 'signum_warehouse_transfers_v1';
const ADJ_STORAGE_KEY = 'signum_inventory_adjustments_v1';
const RET_STORAGE_KEY = 'signum_customer_returns_v1';

export const getSupabasePurchaseRequisitions = async () => {
  const local = readLocalDocList(REQ_STORAGE_KEY);
  try {
    const { data, error } = await withTimeout(
      supabase.from('purchase_requisitions').select('*').order('fecha', { ascending: false }),
      4000
    );
    if (error) throw error;
    return mergeRemoteAndLocalDocs(data || [], local, 'id');
  } catch (_) {
    return local;
  }
};

async function persistDocWithOfflineQueue({
  storageKey,
  tableName,
  syncEntity,
  record,
  action = 'INSERT',
  broadcastTableId,
  timeoutMs = 6000
}) {
  const pendingRecord = { ...record, _pendingServerSync: true };
  upsertLocalDocList(storageKey, pendingRecord, 'id');
  broadcastReconcileChange({
    tableId: broadcastTableId || tableName,
    action: 'RECONCILE',
    key: record.id,
    item: record
  });

  if (isNetworkOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from(tableName).upsert(record, { onConflict: 'id' }),
        timeoutMs
      );
      if (error) throw error;
      isSupabaseAvailable = true;
      upsertLocalDocList(storageKey, { ...record, _pendingServerSync: false }, 'id');
    } catch (err) {
      console.warn(`[${tableName}] Encolando para sincronización posterior:`, err?.message || err);
      markSupabaseOffline(err, `save_${tableName}`);
      enqueueSyncAction(syncEntity, action, record);
    }
  } else {
    enqueueSyncAction(syncEntity, action, record);
  }

  return record;
}

export const saveSupabasePurchaseRequisition = async (reqData) => {
  const nowIso = new Date().toISOString();
  const num = String(reqData.numeroDoc || `REQ-${Date.now().toString().slice(-6)}`).trim();
  const normalized = { ...reqData, id: reqData.id || num, numeroDoc: num, fecha: reqData.fecha || nowIso, updated_at: nowIso };
  return persistDocWithOfflineQueue({
    storageKey: REQ_STORAGE_KEY,
    tableName: 'purchase_requisitions',
    syncEntity: 'purchase_requisition',
    record: normalized,
    action: 'INSERT'
  });
};

export const getSupabasePurchaseOrders = async () => {
  const local = readLocalDocList(PO_STORAGE_KEY);
  try {
    const { data, error } = await withTimeout(
      supabase.from('purchase_orders').select('*').order('fecha', { ascending: false }),
      4000
    );
    if (error) throw error;
    return mergeRemoteAndLocalDocs(data || [], local, 'id');
  } catch (_) {
    return local;
  }
};

export const saveSupabasePurchaseOrder = async (orderData) => {
  const nowIso = new Date().toISOString();
  const num = String(orderData.numeroDoc || `OC-${Date.now().toString().slice(-6)}`).trim();
  const normalized = { ...orderData, id: orderData.id || num, numeroDoc: num, fecha: orderData.fecha || nowIso, updated_at: nowIso };
  return persistDocWithOfflineQueue({
    storageKey: PO_STORAGE_KEY,
    tableName: 'purchase_orders',
    syncEntity: 'purchase_order',
    record: normalized,
    action: 'INSERT'
  });
};

export const getSupabaseGoodsReceiptNotesMerged = async () => {
  const local = readLocalDocList(REC_STORAGE_KEY);
  const remote = await getSupabaseProfitGoodsReceiptNotes(100);
  return mergeRemoteAndLocalDocs(remote || [], local, 'id');
};

export const saveSupabaseGoodsReceiptNote = async (receiptData) => {
  const nowIso = new Date().toISOString();
  const num = String(receiptData.numeroDoc || receiptData.not_num || `REC-${Date.now().toString().slice(-6)}`).trim();
  const id = receiptData.id || num;

  // Anti-doble-entrada de stock: verificar si esta recepción o la factura/compra asociada ya sumaron stock
  const existingRecs = readLocalDocList(REC_STORAGE_KEY);
  const existingRec = existingRecs.find(r => r && (String(r.id) === String(id) || String(r.not_num || r.numeroDoc) === num));
  const localPurchases = getStoragePurchases();
  const linkedInvoice = String(receiptData.nro_fact || receiptData.nroFactura || '').trim().toUpperCase();
  const linkedPurchase = localPurchases.find(p =>
    (receiptData.compraId && String(p.id) === String(receiptData.compraId)) ||
    (linkedInvoice && String(p.numeroFacturaProv || p.nroFactura || '').trim().toUpperCase() === linkedInvoice && String(p.proveedorRif || '').toUpperCase() === String(receiptData.proveedorRif || receiptData.co_prov || '').trim().toUpperCase())
  );

  const alreadyAppliedStock = Boolean(
    receiptData.skipStockApply ||
    receiptData.stockAplicado === true ||
    receiptData.stock_aplicado === true ||
    existingRec?.stock_aplicado === true ||
    existingRec?.stockAplicado === true ||
    (linkedPurchase && linkedPurchase.stockAplicado === true && !receiptData.forceApplyStock)
  );

  const willApplyStock = !alreadyAppliedStock && receiptData.applyStock !== false && Array.isArray(receiptData.items) && receiptData.items.length > 0;
  if (willApplyStock) {
    const alm = String(receiptData.almacen || '01').includes('02') ? '02' : '01';
    const lines = receiptData.items
      .filter(it => Number(it.cantidadRecibida ?? it.cantidad ?? 0) > 0)
      .map(it => ({
        codigo: resolveStockItemProductKey(it),
        delta01: alm === '01' ? Number(it.cantidadRecibida ?? it.cantidad ?? 0) : 0,
        delta02: alm === '02' ? Number(it.cantidadRecibida ?? it.cantidad ?? 0) : 0
      }));
    if (lines.length > 0) {
      await applyStockDeltaForWarehouseLines(lines, {
        idempotencyKey: `receipt_${id}_stock`
      });
    }
    if (linkedPurchase?.id) {
      updateStoragePurchase(linkedPurchase.id, { recepcionId: id, stockAplicado: true });
    }
  }

  const stockWasApplied = Boolean(willApplyStock || existingRec?.stock_aplicado || receiptData.stockAplicado || linkedPurchase?.stockAplicado);
  const normalized = {
    ...receiptData,
    id,
    not_num: receiptData.not_num || num,
    numeroDoc: num,
    fec_emis: receiptData.fec_emis || receiptData.fecha || nowIso,
    co_prov: receiptData.co_prov || receiptData.proveedorRif || '',
    prov_des: receiptData.prov_des || receiptData.proveedorNombre || '',
    nro_fact: receiptData.nro_fact || receiptData.nroFactura || '',
    almacen: String(receiptData.almacen || '01').includes('02') ? '02' : '01',
    stock_aplicado: stockWasApplied,
    stockAplicado: stockWasApplied,
    items_count: (receiptData.items || []).length || Number(receiptData.items_count || 1),
    updated_at: nowIso
  };

  return persistDocWithOfflineQueue({
    storageKey: REC_STORAGE_KEY,
    tableName: 'profit_goods_receipt_notes',
    syncEntity: 'profit_goods_receipt_note',
    record: normalized,
    action: 'INSERT'
  });
};

export const getSupabaseProfitPaymentOrdersMerged = async () => {
  const local = readLocalDocList(OP_STORAGE_KEY);
  const remote = await getSupabaseProfitPaymentOrders();
  return mergeRemoteAndLocalDocs(remote || [], local, 'id');
};

export const saveSupabaseProfitPaymentOrder = async (opData) => {
  const nowIso = new Date().toISOString();
  const ordNum = String(opData.ordNum || opData.ord_num || `OP-${Date.now().toString().slice(-6)}`).trim();
  const id = String(opData.id || ordNum);
  const normalized = {
    id,
    ordNum,
    ord_num: ordNum,
    fecha: opData.fecha || nowIso,
    codBen: opData.codBen || opData.cod_ben || '',
    cod_ben: opData.codBen || opData.cod_ben || '',
    benDes: opData.benDes || opData.ben_des || opData.beneficiario || 'Beneficiario',
    ben_des: opData.benDes || opData.ben_des || opData.beneficiario || 'Beneficiario',
    descrip: opData.descrip || opData.motivo || 'Orden de pago emitida',
    monto: Number(opData.monto || 0),
    montoRet: Number(opData.montoRet || opData.monto_ret || 0),
    monto_ret: Number(opData.montoRet || opData.monto_ret || 0),
    formaPag: opData.formaPag || opData.forma_pag || 'TRANSFERENCIA',
    forma_pag: opData.formaPag || opData.forma_pag || 'TRANSFERENCIA',
    codCta: opData.codCta || opData.cod_cta || '',
    cod_cta: opData.codCta || opData.cod_cta || '',
    cheNum: opData.cheNum || opData.che_num || '',
    che_num: opData.cheNum || opData.che_num || '',
    anulada: Boolean(opData.anulada),
    tasa: Number(opData.tasa || 1),
    moneda: opData.moneda || 'BS',
    coSucu: opData.coSucu || '01',
    co_sucu: opData.coSucu || '01',
    updated_at: nowIso
  };
  return persistDocWithOfflineQueue({
    storageKey: OP_STORAGE_KEY,
    tableName: 'profit_payment_orders',
    syncEntity: 'profit_payment_order',
    record: normalized,
    action: 'INSERT',
    broadcastTableId: 'payment_orders'
  });
};

export const saveSupabaseProfitWarehouseTransfer = async (transferData) => {
  const nowIso = new Date().toISOString();
  const trasNum = String(transferData.trasNum || `TRAS-${Date.now().toString().slice(-6)}`).trim();
  const almOrig = String(transferData.almOrig || '01').includes('02') ? '02' : '01';
  const almDest = String(transferData.almDest || '02').includes('02') ? '02' : '01';
  if (almOrig === almDest) {
    throw new Error('El almacén origen y el almacén destino deben ser distintos.');
  }
  const renglones = Array.isArray(transferData.renglones) ? transferData.renglones : [];
  if (renglones.length === 0) {
    throw new Error('El traslado debe contener al menos un renglón.');
  }

  const lines = renglones.map(r => {
    const qty = Number(r.total_art ?? r.cantidad ?? 0);
    if (!(qty > 0)) {
      throw new Error(`Cantidad inválida (${qty}) para ${r.co_art || r.codigo || 'producto'} en traslado.`);
    }
    return {
      codigo: resolveStockItemProductKey(r),
      delta01: almOrig === '01' ? -qty : (almDest === '01' ? qty : 0),
      delta02: almOrig === '02' ? -qty : (almDest === '02' ? qty : 0)
    };
  });
  const totalItems = renglones.reduce((s, r) => s + Number(r.total_art ?? r.cantidad ?? 0), 0);
  const id = transferData.id || trasNum;
  await applyStockDeltaForWarehouseLines(lines, {
    validateStrict: true,
    idempotencyKey: `transfer_${id}_stock`
  });
  const dbPayload = {
    id,
    tras_num: trasNum,
    fecha: transferData.fecha || nowIso,
    alm_orig: almOrig,
    alm_dest: almDest,
    motivo: transferData.motivo || 'Traslado interno entre almacenes',
    confirma: true,
    anulada: false,
    co_sucu: '01',
    co_us_in: transferData.coUsIn || 'WEB',
    total_items: totalItems,
    renglones,
    updated_at: nowIso
  };
  const normalized = {
    ...dbPayload,
    trasNum,
    almOrig,
    almDest,
    coSucu: '01',
    coUsIn: dbPayload.co_us_in,
    totalItems,
    _pendingServerSync: true
  };

  upsertLocalDocList(TRAS_STORAGE_KEY, normalized, 'id');
  broadcastReconcileChange({ tableId: 'warehouse_transfers', action: 'CREATE', key: normalized.trasNum, item: normalized });
  if (isNetworkOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from('profit_warehouse_transfers').upsert(dbPayload, { onConflict: 'id' }),
        6000
      );
      if (error) throw error;
      isSupabaseAvailable = true;
      upsertLocalDocList(TRAS_STORAGE_KEY, { ...normalized, _pendingServerSync: false }, 'id');
      return { ...normalized, _pendingServerSync: false };
    } catch (err) {
      console.warn('[profit_warehouse_transfers] Encolando para sincronización posterior:', err?.message || err);
      markSupabaseOffline(err, 'save_profit_warehouse_transfers');
      enqueueSyncAction('profit_warehouse_transfer', 'INSERT', dbPayload);
    }
  } else {
    enqueueSyncAction('profit_warehouse_transfer', 'INSERT', dbPayload);
  }
  return normalized;
};

export const saveSupabaseProfitInventoryAdjustment = async (adjData) => {
  const nowIso = new Date().toISOString();
  const ajueNum = String(adjData.ajueNum || `AJU-${Date.now().toString().slice(-6)}`).trim();
  const alm = String(adjData.almacen || '01').includes('02') ? '02' : '01';
  const renglones = Array.isArray(adjData.renglones) ? adjData.renglones : [];
  if (renglones.length === 0) {
    throw new Error('El ajuste de inventario debe contener al menos un renglón.');
  }

  let hasExit = false;
  const normalizedRenglones = renglones.map(r => {
    const qty = Number(r.total_art ?? r.cantidad ?? 0);
    if (!(qty > 0)) {
      throw new Error(`Cantidad inválida (${qty}) para ${r.co_art || r.codigo || 'producto'} en ajuste.`);
    }
    const lineAlm = String(r.co_alma || alm).includes('02') ? '02' : '01';
    const tipoTrans = String(r.tipo_trans || 'S').toUpperCase() === 'E' ? 'E' : 'S';
    if (tipoTrans === 'S') hasExit = true;
    return {
      ...r,
      co_alma: lineAlm,
      tipo_trans: tipoTrans,
      total_art: qty
    };
  });

  const lines = normalizedRenglones.map(r => {
    const qty = Number(r.total_art || 0);
    const sign = r.tipo_trans === 'E' ? 1 : -1;
    return {
      codigo: resolveStockItemProductKey(r),
      delta01: r.co_alma === '01' ? sign * qty : 0,
      delta02: r.co_alma === '02' ? sign * qty : 0
    };
  });
  const totalItems = normalizedRenglones.reduce((s, r) => s + Number(r.total_art || 0), 0);
  const id = adjData.id || ajueNum;
  await applyStockDeltaForWarehouseLines(lines, {
    validateStrict: hasExit,
    idempotencyKey: `adjustment_${id}_stock`
  });
  const dbPayload = {
    id,
    ajue_num: ajueNum,
    fecha: adjData.fecha || nowIso,
    motivo: adjData.motivo || 'Ajuste / Merma de inventario',
    anulada: false,
    co_sucu: '01',
    co_us_in: adjData.coUsIn || 'WEB',
    total_items: totalItems,
    renglones: normalizedRenglones,
    updated_at: nowIso
  };
  const normalized = {
    ...dbPayload,
    ajueNum,
    almacen: alm,
    coSucu: '01',
    coUsIn: dbPayload.co_us_in,
    totalItems,
    _pendingServerSync: true
  };

  upsertLocalDocList(ADJ_STORAGE_KEY, normalized, 'id');
  broadcastReconcileChange({ tableId: 'inventory_adjustments', action: 'CREATE', key: normalized.ajueNum, item: normalized });
  if (isNetworkOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from('profit_inventory_adjustments').upsert(dbPayload, { onConflict: 'id' }),
        6000
      );
      if (error) throw error;
      isSupabaseAvailable = true;
      upsertLocalDocList(ADJ_STORAGE_KEY, { ...normalized, _pendingServerSync: false }, 'id');
      return { ...normalized, _pendingServerSync: false };
    } catch (err) {
      console.warn('[profit_inventory_adjustments] Encolando para sincronización posterior:', err?.message || err);
      markSupabaseOffline(err, 'save_profit_inventory_adjustments');
      enqueueSyncAction('profit_inventory_adjustment', 'INSERT', dbPayload);
    }
  } else {
    enqueueSyncAction('profit_inventory_adjustment', 'INSERT', dbPayload);
  }
  return normalized;
};

export const saveSupabaseProfitCustomerReturn = async (retData) => {
  const nowIso = new Date().toISOString();
  const ncNum = String(retData.ncNum || retData.numeroDoc || `NC-${Date.now().toString().slice(-6)}`).trim();
  const renglones = Array.isArray(retData.renglones) ? retData.renglones : [];
  const id = retData.id || ncNum;
  const dbPayload = {
    id,
    fact_num: retData.factNum || retData.documentoAfectado || '',
    fec_emis: retData.fecEmis || retData.fecha || nowIso,
    co_cli: retData.coCli || retData.clienteId || 'CLI-GEN',
    cli_des: retData.cliDes || retData.clienteNombre || 'Cliente',
    rif: retData.rif || retData.clienteRif || '',
    co_ven: retData.coVen || retData.vendedorId || '',
    ven_des: retData.venDes || retData.vendedorNombre || '',
    nc_num: ncNum,
    status: 'PROCESADA',
    anulada: false,
    descrip: retData.descrip || retData.motivo || 'Devolución de mercancía',
    tot_bruto: Number(retData.totBruto || 0),
    iva: Number(retData.iva || 0),
    tot_neto: Number(retData.totNeto || 0),
    tasa: Number(retData.tasa || 1),
    moneda: retData.moneda || 'USD',
    co_sucu: retData.coSucu || '01',
    co_us_in: retData.coUsIn || 'WEB',
    renglones,
    updated_at: nowIso
  };
  const normalized = {
    ...dbPayload,
    factNum: dbPayload.fact_num,
    fecEmis: dbPayload.fec_emis,
    coCli: dbPayload.co_cli,
    cliDes: dbPayload.cli_des,
    coVen: dbPayload.co_ven,
    venDes: dbPayload.ven_des,
    ncNum,
    totBruto: dbPayload.tot_bruto,
    totNeto: dbPayload.tot_neto,
    coSucu: dbPayload.co_sucu,
    coUsIn: dbPayload.co_us_in,
    _pendingServerSync: true
  };

  if (retData.reenterStock !== false && renglones.length > 0) {
    const alm = String(retData.almacen || '01').includes('02') ? '02' : '01';
    const lines = renglones.map(r => ({
      codigo: resolveStockItemProductKey(r),
      delta01: alm === '01' ? Number(r.total_art ?? r.cantidad ?? 0) : 0,
      delta02: alm === '02' ? Number(r.total_art ?? r.cantidad ?? 0) : 0
    }));
    await applyStockDeltaForWarehouseLines(lines, {
      idempotencyKey: `return_${id}_stock`
    });
  }

  upsertLocalDocList(RET_STORAGE_KEY, normalized, 'id');
  if (isNetworkOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from('profit_customer_returns').upsert(dbPayload, { onConflict: 'id' }),
        6000
      );
      if (error) throw error;
      isSupabaseAvailable = true;
      upsertLocalDocList(RET_STORAGE_KEY, { ...normalized, _pendingServerSync: false }, 'id');
      return { ...normalized, _pendingServerSync: false };
    } catch (err) {
      console.warn('[profit_customer_returns] Encolando para sincronización posterior:', err?.message || err);
      markSupabaseOffline(err, 'save_profit_customer_returns');
      enqueueSyncAction('profit_customer_return', 'INSERT', dbPayload);
    }
  } else {
    enqueueSyncAction('profit_customer_return', 'INSERT', dbPayload);
  }
  return normalized;
};

export const getSupabaseProfitReturnsMerged = async () => {
  const local = readLocalDocList(RET_STORAGE_KEY);
  const remote = await getSupabaseProfitReturns();
  return mergeRemoteAndLocalDocs(remote || [], local, 'id');
};

export const getSupabaseProfitInventoryAdjustmentsMerged = async () => {
  const local = readLocalDocList(ADJ_STORAGE_KEY);
  const remote = await getSupabaseProfitInventoryAdjustments();
  return mergeRemoteAndLocalDocs(remote || [], local, 'id');
};

export const getSupabaseProfitWarehouseTransfersMerged = async () => {
  const local = readLocalDocList(TRAS_STORAGE_KEY);
  const remote = await getSupabaseProfitWarehouseTransfers();
  return mergeRemoteAndLocalDocs(remote || [], local, 'id');
};

// =========================================================================
// LIQUIDACIONES DE COMISIONES, GASTOS, EMPLEADOS Y NÓMINA (SUPABASE + LOCAL)
// =========================================================================
export const mapCommissionSettlementToDb = (s) => ({
  id: s.id,
  co_ven: s.coVen || s.co_ven || '',
  ven_des: s.venDes || s.ven_des || '',
  cedula: s.cedula || '',
  periodo: s.periodo || '',
  periodo_id: s.periodoId || s.periodo_id || '',
  total_litros: round2(s.totalLitros ?? s.total_litros ?? 0),
  meta_litros: round2(s.metaLitros ?? s.meta_litros ?? 0),
  total_facturado_usd: round2(s.totalFacturadoUsd ?? s.total_facturado_usd ?? 0),
  base_pagada_sin_iva_usd: round2(s.basePagadaSinIvaUsd ?? s.base_pagada_sin_iva_usd ?? 0),
  documentos_pagados_count: Number(s.documentosPagadosCount ?? s.documentos_pagados_count ?? 0),
  documentos_pendientes_excluidos_count: Number(s.documentosPendientesExcluidosCount ?? s.documentos_pendientes_excluidos_count ?? 0),
  motorven_tiers: s.motorvenTiers ?? s.motorven_tiers ?? [],
  bono_adicional_usd: round2(s.bonoAdicionalUsd ?? s.bono_adicional_usd ?? 0),
  total_cobrado_usd: round2(s.totalCobradoUsd ?? s.total_cobrado_usd ?? 0),
  total_comision_usd: round2(s.totalComisionUsd ?? s.total_comision_usd ?? 0),
  total_comision_bs: round2(s.totalComisionBs ?? s.total_comision_bs ?? 0),
  tasa_bcv: Number(s.tasaBcv ?? s.tasa_bcv ?? 0),
  metodo_pago: s.metodoPago || s.metodo_pago || 'Efectivo',
  referencia_pago: s.referenciaPago || s.referencia_pago || 'S/R',
  fecha_pago: s.fechaPago || s.fecha_pago || '',
  notas: s.notas || '',
  seller: s.seller || {},
  estado: s.estado || 'PAGADA',
  cash_movement_id: s.cashMovementId || s.cash_movement_id || null
});

export const mapCommissionSettlementFromDb = (s) => {
  if (!s) return null;
  return {
    id: s.id,
    coVen: s.coVen ?? s.co_ven ?? '',
    venDes: s.venDes ?? s.ven_des ?? '',
    cedula: s.cedula || '',
    periodo: s.periodo || '',
    periodoId: s.periodoId ?? s.periodo_id ?? '',
    totalLitros: Number(s.totalLitros ?? s.total_litros ?? 0),
    metaLitros: Number(s.metaLitros ?? s.meta_litros ?? 0),
    totalFacturadoUsd: Number(s.totalFacturadoUsd ?? s.total_facturado_usd ?? 0),
    basePagadaSinIvaUsd: Number(s.basePagadaSinIvaUsd ?? s.base_pagada_sin_iva_usd ?? 0),
    documentosPagadosCount: Number(s.documentosPagadosCount ?? s.documentos_pagados_count ?? 0),
    documentosPendientesExcluidosCount: Number(s.documentosPendientesExcluidosCount ?? s.documentos_pendientes_excluidos_count ?? 0),
    motorvenTiers: s.motorvenTiers ?? s.motorven_tiers ?? [],
    bonoAdicionalUsd: Number(s.bonoAdicionalUsd ?? s.bono_adicional_usd ?? 0),
    totalCobradoUsd: Number(s.totalCobradoUsd ?? s.total_cobrado_usd ?? 0),
    totalComisionUsd: Number(s.totalComisionUsd ?? s.total_comision_usd ?? 0),
    totalComisionBs: Number(s.totalComisionBs ?? s.total_comision_bs ?? 0),
    tasaBcv: Number(s.tasaBcv ?? s.tasa_bcv ?? 0),
    metodoPago: s.metodoPago ?? s.metodo_pago ?? 'Efectivo',
    referenciaPago: s.referenciaPago ?? s.referencia_pago ?? 'S/R',
    fechaPago: s.fechaPago ?? s.fecha_pago ?? '',
    fechaRegistro: s.fechaRegistro ?? s.created_at ?? s.fecha_pago ?? '',
    notas: s.notas || '',
    seller: s.seller || {},
    estado: s.estado || 'PAGADA',
    cashMovementId: s.cashMovementId ?? s.cash_movement_id ?? null
  };
};

export const mapEmployeeToDb = (e) => ({
  id: e.id,
  cedula: String(e.cedula || '').trim(),
  nombre: String(e.nombre || '').trim(),
  cargo: String(e.cargo || '').trim(),
  departamento: e.departamento || 'OPERACIONES',
  fecha_ingreso: e.fechaIngreso || e.fecha_ingreso || null,
  salario_base_usd: round2(e.salarioBaseUsd ?? e.salario_base_usd ?? 0),
  bono_fijo_usd: round2(e.bonoFijoUsd ?? e.bono_fijo_usd ?? 0),
  frecuencia_pago: e.frecuenciaPago || e.frecuencia_pago || 'QUINCENAL',
  metodo_pago: e.metodoPago || e.metodo_pago || 'TRANSFERENCIA',
  cuenta_bancaria: e.cuentaBancaria || e.cuenta_bancaria || '',
  telefono: e.telefono || '',
  activo: e.activo !== false
});

export const mapEmployeeFromDb = (e) => {
  if (!e) return null;
  return {
    id: e.id,
    cedula: e.cedula || '',
    nombre: e.nombre || '',
    cargo: e.cargo || '',
    departamento: e.departamento || 'OPERACIONES',
    fechaIngreso: e.fechaIngreso ?? e.fecha_ingreso ?? '',
    salarioBaseUsd: round2(e.salarioBaseUsd ?? e.salario_base_usd ?? 0),
    bonoFijoUsd: round2(e.bonoFijoUsd ?? e.bono_fijo_usd ?? 0),
    frecuenciaPago: e.frecuenciaPago ?? e.frecuencia_pago ?? 'QUINCENAL',
    metodoPago: e.metodoPago ?? e.metodo_pago ?? 'TRANSFERENCIA',
    cuentaBancaria: e.cuentaBancaria ?? e.cuenta_bancaria ?? '',
    telefono: e.telefono || '',
    activo: e.activo !== false,
    createdAt: e.createdAt ?? e.created_at ?? '',
    updatedAt: e.updatedAt ?? e.updated_at ?? ''
  };
};

export const mapExpenseToDb = (x) => ({
  id: x.id,
  fecha: x.fecha || new Date().toISOString().split('T')[0],
  concepto: String(x.concepto || '').trim(),
  categoria: x.categoria || 'GASTO_OPERATIVO',
  cuenta_gasto: x.cuentaGasto || x.cuenta_gasto || null,
  cuenta_gasto_desc: x.cuentaGastoDesc || x.cuenta_gasto_desc || null,
  proveedor: x.proveedor || '',
  rif_proveedor: x.rifProveedor || x.rif_proveedor || '',
  documento_ref: x.documentoRef || x.documento_ref || '',
  monto_usd: round2(x.montoUsd ?? x.monto_usd ?? 0),
  monto_bs: round2(x.montoBs ?? x.monto_bs ?? 0),
  tasa_pago: Number(x.tasaPago ?? x.tasa_pago ?? 0),
  tipo_tasa: x.tipoTasa || x.tipo_tasa || 'BCV',
  metodo_pago: x.metodoPago || x.metodo_pago || 'TRANSFERENCIA',
  caja_banco_id: x.cajaBancoId || x.caja_banco_id || null,
  caja_banco_nombre: x.cajaBancoNombre || x.caja_banco_nombre || '',
  referencia: x.referencia || '',
  estado: x.estado || 'PAGADA',
  notas: x.notas || '',
  cash_movement_id: x.cashMovementId || x.cash_movement_id || null,
  created_by: x.createdBy || x.created_by || 'Sistema'
});

export const mapExpenseFromDb = (x) => {
  if (!x) return null;
  return {
    id: x.id,
    fecha: x.fecha || '',
    concepto: x.concepto || '',
    categoria: x.categoria || 'GASTO_OPERATIVO',
    cuentaGasto: x.cuentaGasto ?? x.cuenta_gasto ?? '',
    cuentaGastoDesc: x.cuentaGastoDesc ?? x.cuenta_gasto_desc ?? '',
    proveedor: x.proveedor || '',
    rifProveedor: x.rifProveedor ?? x.rif_proveedor ?? '',
    documentoRef: x.documentoRef ?? x.documento_ref ?? '',
    montoUsd: round2(x.montoUsd ?? x.monto_usd ?? 0),
    montoBs: round2(x.montoBs ?? x.monto_bs ?? 0),
    tasaPago: Number(x.tasaPago ?? x.tasa_pago ?? 0),
    tipoTasa: x.tipoTasa ?? x.tipo_tasa ?? 'BCV',
    metodoPago: x.metodoPago ?? x.metodo_pago ?? 'TRANSFERENCIA',
    cajaBancoId: x.cajaBancoId ?? x.caja_banco_id ?? '',
    cajaBancoNombre: x.cajaBancoNombre ?? x.caja_banco_nombre ?? '',
    referencia: x.referencia || '',
    estado: x.estado || 'PAGADA',
    notas: x.notas || '',
    cashMovementId: x.cashMovementId ?? x.cash_movement_id ?? null,
    createdBy: x.createdBy ?? x.created_by ?? 'Sistema',
    createdAt: x.createdAt ?? x.created_at ?? '',
    updatedAt: x.updatedAt ?? x.updated_at ?? ''
  };
};

export const mapPayrollToDb = (p) => ({
  id: p.id,
  periodo: p.periodo || '',
  periodo_inicio: p.periodoInicio || p.periodo_inicio || null,
  periodo_fin: p.periodoFin || p.periodo_fin || null,
  fecha_pago: p.fechaPago || p.fecha_pago || new Date().toISOString().split('T')[0],
  frecuencia: p.frecuencia || 'QUINCENAL',
  total_salarios_usd: round2(p.totalSalariosUsd ?? p.total_salarios_usd ?? 0),
  total_bonos_usd: round2(p.totalBonosUsd ?? p.total_bonos_usd ?? 0),
  total_deducciones_usd: round2(p.totalDeduccionesUsd ?? p.total_deducciones_usd ?? 0),
  total_neto_usd: round2(p.totalNetoUsd ?? p.total_neto_usd ?? 0),
  total_neto_bs: round2(p.totalNetoBs ?? p.total_neto_bs ?? 0),
  tasa_bcv: Number(p.tasaBcv ?? p.tasa_bcv ?? 0),
  tipo_tasa: p.tipoTasa || p.tipo_tasa || 'BCV',
  metodo_pago: p.metodoPago || p.metodo_pago || 'TRANSFERENCIA',
  cuenta_destino: p.cuentaDestino || p.cuenta_destino || '',
  caja_banco_id: p.cajaBancoId || p.caja_banco_id || null,
  referencia: p.referencia || '',
  estado: p.estado || 'PAGADA',
  notas: p.notas || '',
  detalles: Array.isArray(p.detalles) ? p.detalles : [],
  cash_movement_id: p.cashMovementId || p.cash_movement_id || null,
  created_by: p.createdBy || p.created_by || 'Sistema'
});

export const mapPayrollFromDb = (p) => {
  if (!p) return null;
  return {
    id: p.id,
    periodo: p.periodo || '',
    periodoInicio: p.periodoInicio ?? p.periodo_inicio ?? '',
    periodoFin: p.periodoFin ?? p.periodo_fin ?? '',
    fechaPago: p.fechaPago ?? p.fecha_pago ?? '',
    frecuencia: p.frecuencia || 'QUINCENAL',
    totalSalariosUsd: round2(p.totalSalariosUsd ?? p.total_salarios_usd ?? 0),
    totalBonosUsd: round2(p.totalBonosUsd ?? p.total_bonos_usd ?? 0),
    totalDeduccionesUsd: round2(p.totalDeduccionesUsd ?? p.total_deducciones_usd ?? 0),
    totalNetoUsd: round2(p.totalNetoUsd ?? p.total_neto_usd ?? 0),
    totalNetoBs: round2(p.totalNetoBs ?? p.total_neto_bs ?? 0),
    tasaBcv: Number(p.tasaBcv ?? p.tasa_bcv ?? 0),
    tipoTasa: p.tipoTasa ?? p.tipo_tasa ?? 'BCV',
    metodoPago: p.metodoPago ?? p.metodo_pago ?? 'TRANSFERENCIA',
    cuentaDestino: p.cuentaDestino ?? p.cuenta_destino ?? '',
    cajaBancoId: p.cajaBancoId ?? p.caja_banco_id ?? '',
    referencia: p.referencia || '',
    estado: p.estado || 'PAGADA',
    notas: p.notas || '',
    detalles: Array.isArray(p.detalles) ? p.detalles : [],
    cashMovementId: p.cashMovementId ?? p.cash_movement_id ?? null,
    createdBy: p.createdBy ?? p.created_by ?? 'Sistema',
    createdAt: p.createdAt ?? p.created_at ?? '',
    updatedAt: p.updatedAt ?? p.updated_at ?? ''
  };
};

/**
 * Helper genérico de lectura/escritura/eliminación sincronizada (Supabase + caché local + cola offline + realtime).
 */
const fetchSyncedCollection = async ({
  tableName,
  getLocalFn,
  localStorageKey,
  mapFromDbFn,
  sortValueFn
}) => {
  const localList = getLocalFn();
  if (!isNetworkOnline()) return localList;
  try {
    const { data, error } = await withTimeout(
      supabase.from(tableName).select('*').limit(2000),
      8000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    const mergedMap = new Map();
    (Array.isArray(data) ? data : []).forEach((raw) => {
      const mapped = mapFromDbFn(raw);
      if (mapped?.id) mergedMap.set(String(mapped.id), mapped);
    });
    localList.forEach((l) => {
      if (l?.id && !mergedMap.has(String(l.id))) {
        mergedMap.set(String(l.id), l);
      }
    });
    const merged = Array.from(mergedMap.values()).sort((a, b) =>
      String(sortValueFn(b) || '').localeCompare(String(sortValueFn(a) || ''))
    );
    try {
      if (typeof localStorage !== 'undefined' && localStorageKey) {
        localStorage.setItem(localStorageKey, JSON.stringify(merged));
      }
    } catch (_) {}
    return merged;
  } catch (err) {
    console.warn(`[Supabase] Error cargando ${tableName} (usando caché local):`, err?.message || err);
    return localList;
  }
};

const upsertSyncedCollectionItem = async ({
  tableName,
  tableId,
  syncEntity,
  saveLocalFn,
  mapToDbFn,
  record
}) => {
  const savedLocal = saveLocalFn(record);
  const dbPayload = mapToDbFn ? mapToDbFn(savedLocal) : savedLocal;
  const emit = () => broadcastReconcileChange({
    tableId,
    action: 'UPDATE',
    key: savedLocal.id,
    item: savedLocal
  });
  if (!isNetworkOnline()) {
    enqueueSyncAction(syncEntity, 'UPDATE', dbPayload);
    emit();
    return savedLocal;
  }
  try {
    const { error } = await withTimeout(
      supabase.from(tableName).upsert(dbPayload, { onConflict: 'id' }),
      8000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    emit();
    return savedLocal;
  } catch (err) {
    console.warn(`[Supabase] Encolando ${syncEntity}:`, err?.message || err);
    enqueueSyncAction(syncEntity, 'UPDATE', dbPayload);
    return savedLocal;
  }
};

const deleteSyncedCollectionItem = async ({
  tableName,
  tableId,
  syncEntity,
  deleteLocalFn,
  id
}) => {
  const updatedLocal = deleteLocalFn(id);
  const emit = () => broadcastReconcileChange({
    tableId,
    action: 'DELETE',
    key: id,
    item: { id }
  });
  if (!isNetworkOnline()) {
    enqueueSyncAction(syncEntity, 'DELETE', { id });
    emit();
    return updatedLocal;
  }
  try {
    const { error } = await withTimeout(
      supabase.from(tableName).delete().eq('id', id),
      8000
    );
    if (error) throw error;
    isSupabaseAvailable = true;
    emit();
    return updatedLocal;
  } catch (err) {
    console.warn(`[Supabase] Encolando eliminación ${syncEntity}:`, err?.message || err);
    enqueueSyncAction(syncEntity, 'DELETE', { id });
    return updatedLocal;
  }
};

export const getSupabaseCommissionSettlements = () => fetchSyncedCollection({
  tableName: 'commission_settlements',
  getLocalFn: getStorageCommissionSettlements,
  localStorageKey: 'sm_commission_settlements_v4',
  mapFromDbFn: mapCommissionSettlementFromDb,
  sortValueFn: (s) => s?.fechaRegistro || s?.fechaPago
});

export const saveSupabaseCommissionSettlement = (settlement) => upsertSyncedCollectionItem({
  tableName: 'commission_settlements',
  tableId: 'commission_settlements',
  syncEntity: 'commission_settlement',
  saveLocalFn: saveStorageCommissionSettlement,
  mapToDbFn: mapCommissionSettlementToDb,
  record: settlement
});

export const deleteSupabaseCommissionSettlement = (id) => deleteSyncedCollectionItem({
  tableName: 'commission_settlements',
  tableId: 'commission_settlements',
  syncEntity: 'commission_settlement',
  deleteLocalFn: deleteStorageCommissionSettlement,
  id
});

export const getSupabaseEmployees = () => fetchSyncedCollection({
  tableName: 'employees',
  getLocalFn: getStorageEmployees,
  localStorageKey: 'sm_employees_v4',
  mapFromDbFn: mapEmployeeFromDb,
  sortValueFn: (e) => e?.nombre || e?.createdAt
});

export const saveSupabaseEmployee = (employee) => upsertSyncedCollectionItem({
  tableName: 'employees',
  tableId: 'employees',
  syncEntity: 'employee',
  saveLocalFn: saveStorageEmployee,
  mapToDbFn: mapEmployeeToDb,
  record: employee
});

export const deleteSupabaseEmployee = (id) => deleteSyncedCollectionItem({
  tableName: 'employees',
  tableId: 'employees',
  syncEntity: 'employee',
  deleteLocalFn: deleteStorageEmployee,
  id
});

export const getSupabaseExpenses = () => fetchSyncedCollection({
  tableName: 'expenses',
  getLocalFn: getStorageExpenses,
  localStorageKey: 'sm_expenses_v4',
  mapFromDbFn: mapExpenseFromDb,
  sortValueFn: (x) => x?.fecha || x?.createdAt
});

export const saveSupabaseExpense = (expense) => upsertSyncedCollectionItem({
  tableName: 'expenses',
  tableId: 'expenses',
  syncEntity: 'expense',
  saveLocalFn: saveStorageExpense,
  mapToDbFn: mapExpenseToDb,
  record: expense
});

export const deleteSupabaseExpense = (id) => deleteSyncedCollectionItem({
  tableName: 'expenses',
  tableId: 'expenses',
  syncEntity: 'expense',
  deleteLocalFn: deleteStorageExpense,
  id
});

export const getSupabasePayroll = () => fetchSyncedCollection({
  tableName: 'payroll',
  getLocalFn: getStoragePayroll,
  localStorageKey: 'sm_payroll_v4',
  mapFromDbFn: mapPayrollFromDb,
  sortValueFn: (p) => p?.fechaPago || p?.createdAt
});

export const saveSupabasePayroll = (payrollRec) => upsertSyncedCollectionItem({
  tableName: 'payroll',
  tableId: 'payroll',
  syncEntity: 'payroll',
  saveLocalFn: saveStoragePayroll,
  mapToDbFn: mapPayrollToDb,
  record: payrollRec
});

export const deleteSupabasePayroll = (id) => deleteSyncedCollectionItem({
  tableName: 'payroll',
  tableId: 'payroll',
  syncEntity: 'payroll',
  deleteLocalFn: deleteStoragePayroll,
  id
});








