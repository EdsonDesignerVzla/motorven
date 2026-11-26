/**
 * Ajuste temporal en memoria para el Bloque 3 (Cobranzas) de Resumen Gerencial.
 * NO altera la base de datos ni los datos reales de Profit/Supabase.
 *
 * Para desactivar y volver 100% a los datos reales de forma global para todos los usuarios,
 * cambia TEMP_COLLECTIONS_ADJUSTMENT_ENABLED a `false` (o retira su uso en DashboardView y MobileDashboardView).
 */
import { normalizeRole } from '../services/authService.js';
import { toDateKey } from '../services/dashboardMetricsService.js';

export const TEMP_COLLECTIONS_ADJUSTMENT_ENABLED = true;

export const TEMP_COLLECTIONS_STORAGE_KEY = 'sm_temp_collections_20261120_reverted';
export const TEMP_COLLECTIONS_EVENT = 'sm:temp-collections-toggle';

export const TEMP_COLLECTIONS_ADJUSTMENT = {
  id: 'temp-cobranzas-2026-11-20',
  dateKey: '2026-11-20',
  monthPrefix: '2026-11',
  banksBs: {
    bancoPlaza: 173511.42,
    bancaribe: 564255.66,
    bancoVenezuela: 624447.59
  },
  bsReal: 1362214.67,
  bsUsd: 1349.57,
  divisasDetail: {
    efectivoDivisas: 363.0,
    zelle: 564.0
  },
  divisasUsd: 927.0,
  totalUsd: 2276.57
};

function round2(n) {
  return parseFloat((Number(n) || 0).toFixed(2));
}

function getPreviousDateKey(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return toDateKey(new Date(y, m - 1, d - 1));
}

/**
 * Solo el usuario MASTER (Edson Designer) puede ver y accionar el botón para revertir/restaurar
 * el ajuste temporal en su propia vista.
 */
export function canManageTempCollectionsAdjustment(currentUser) {
  if (!currentUser || typeof currentUser !== 'object') return false;
  return normalizeRole(currentUser.rol || currentUser.role) === 'ADMINISTRADOR MASTER';
}

export function readTempCollectionsLocalReverted() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(TEMP_COLLECTIONS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeTempCollectionsLocalReverted(reverted) {
  const nextVal = Boolean(reverted);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (nextVal) {
        window.localStorage.setItem(TEMP_COLLECTIONS_STORAGE_KEY, '1');
      } else {
        window.localStorage.removeItem(TEMP_COLLECTIONS_STORAGE_KEY);
      }
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(TEMP_COLLECTIONS_EVENT, { detail: { reverted: nextVal } }));
    }
  } catch {
    // Ignorar errores de almacenamiento en entornos restringidos
  }
  return nextVal;
}

export function subscribeTempCollectionsToggle(onChange) {
  if (typeof window === 'undefined' || typeof onChange !== 'function') {
    return () => {};
  }
  const handleCustom = (ev) => {
    const next = typeof ev?.detail?.reverted === 'boolean'
      ? ev.detail.reverted
      : readTempCollectionsLocalReverted();
    onChange(next);
  };
  const handleStorage = (ev) => {
    if (!ev || ev.key === TEMP_COLLECTIONS_STORAGE_KEY || ev.key === null) {
      onChange(readTempCollectionsLocalReverted());
    }
  };
  window.addEventListener(TEMP_COLLECTIONS_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(TEMP_COLLECTIONS_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Aplica en memoria el ajuste temporal de cobranzas del 2026-11-20 sobre el resultado de summarizeCollectionsWindow:
 * - Si todayKey === '2026-11-20': suma a Cobranza del Día (hoy).
 * - Si ayer === '2026-11-20' (ej. 2026-11-21): suma a Ayer (ayerUsd).
 * - Si monthPrefix === '2026-11' y todayKey >= '2026-11-20': suma a Cobranza Acumulada del Mes y recalcula promedio/proyección.
 */
export function applyTempCollectionsAdjustment({
  summary,
  todayKey = toDateKey(new Date()),
  monthPrefix = '',
  tasaBcv = 1,
  localReverted = false,
  enabled = TEMP_COLLECTIONS_ADJUSTMENT_ENABLED
} = {}) {
  if (!summary || !summary.hoy || !summary.mes) return summary;
  if (!enabled || localReverted) return summary;

  const safeToday = todayKey || toDateKey(new Date());
  const ayerKey = getPreviousDateKey(safeToday);
  const targetPrefix = monthPrefix || safeToday.substring(0, 7);
  const safeTasa = Number(tasaBcv) > 1 ? Number(tasaBcv) : 1;

  const adj = TEMP_COLLECTIONS_ADJUSTMENT;
  const adjBsEquiv = round2(adj.bsReal + (adj.divisasUsd * safeTasa));

  let nextHoy = summary.hoy;
  if (safeToday === adj.dateKey) {
    nextHoy = {
      ...summary.hoy,
      usd: round2((summary.hoy.usd || 0) + adj.totalUsd),
      bsReal: round2((summary.hoy.bsReal || 0) + adj.bsReal),
      bsEquiv: round2((summary.hoy.bsEquiv || 0) + adjBsEquiv),
      divisasUsd: round2((summary.hoy.divisasUsd || 0) + adj.divisasUsd),
      bsUsd: round2((summary.hoy.bsUsd || 0) + adj.bsUsd)
    };
  } else if (ayerKey === adj.dateKey) {
    nextHoy = {
      ...summary.hoy,
      ayerUsd: round2((summary.hoy.ayerUsd || 0) + adj.totalUsd)
    };
  }

  let nextMes = summary.mes;
  if (targetPrefix === adj.monthPrefix && safeToday >= adj.dateKey) {
    const newMesUsd = round2((summary.mes.usd || 0) + adj.totalUsd);
    const diasTranscurridos = Number(summary.mes.diasTranscurridos) || 0;
    const diasDelMes = Number(summary.mes.diasDelMes) || 0;
    const promedioDiarioUsd = diasTranscurridos > 0 ? round2(newMesUsd / diasTranscurridos) : 0;
    const proyeccionUsd = summary.mes.esMesEnCurso
      ? round2(promedioDiarioUsd * diasDelMes)
      : newMesUsd;

    nextMes = {
      ...summary.mes,
      usd: newMesUsd,
      bsReal: round2((summary.mes.bsReal || 0) + adj.bsReal),
      bsEquiv: round2((summary.mes.bsEquiv || 0) + adjBsEquiv),
      divisasUsd: round2((summary.mes.divisasUsd || 0) + adj.divisasUsd),
      bsUsd: round2((summary.mes.bsUsd || 0) + adj.bsUsd),
      promedioDiarioUsd,
      proyeccionUsd
    };
  }

  if (nextHoy === summary.hoy && nextMes === summary.mes) {
    return summary;
  }

  return {
    hoy: nextHoy,
    mes: nextMes
  };
}
