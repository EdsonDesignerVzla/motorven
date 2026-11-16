import { getEraScopedCanonicalDocKey, dedupeCanonicalDocs } from './fiscalService.js';
import { isCxcInvoiceCancelled, isCxcInvoiceSettled, isCreditSaleRecord } from '../utils/cxcUtils.js';

/**
 * Extrae el mes ('01'..'12') desde fechas ISO o formato DD/MM/YYYY / DD-MM-YYYY.
 */
export function extractMonthNumber(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date && !isNaN(dateVal)) {
    return String(dateVal.getMonth() + 1).padStart(2, '0');
  }
  const str = String(dateVal).trim();
  if (!str) return '';
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return isoMatch[2].padStart(2, '0');
  }
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(str)) {
    const parts = str.split(/[/-]/);
    if (parts.length >= 2) {
      return parts[1].padStart(2, '0');
    }
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return String(d.getUTCMonth() + 1).padStart(2, '0');
    }
  } catch (_) {}
  return '';
}

/**
 * Normaliza cualquier fecha (ISO, DD/MM/YYYY o Date) a clave local 'YYYY-MM-DD'.
 */
export function toDateKey(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '';
    return `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}-${String(dateVal.getDate()).padStart(2, '0')}`;
  }
  const str = String(dateVal).trim();
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const lat = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (lat) return `${lat[3]}-${lat[2].padStart(2, '0')}-${lat[1].padStart(2, '0')}`;
  const d = new Date(str);
  return isNaN(d.getTime()) ? '' : toDateKey(d);
}

/**
 * Retorna ventas locales POS válidas (no anuladas) excluyendo las ya sincronizadas en `existingInvoices`.
 */
export function getUnduplicatedSales(sales = [], existingInvoices = []) {
  const seenKeys = new Set();
  if (Array.isArray(existingInvoices)) {
    dedupeCanonicalDocs(existingInvoices).forEach((inv) => {
      if (!inv || inv.anulada) return;
      const ck = getEraScopedCanonicalDocKey(inv);
      if (ck) seenKeys.add(ck);
    });
  }
  if (!Array.isArray(sales)) return [];
  return dedupeCanonicalDocs(sales).filter((s) => {
    if (!s || s.anulada) return false;
    const ck = getEraScopedCanonicalDocKey(s);
    if (ck && seenKeys.has(ck)) return false;
    return true;
  });
}

/**
 * Calcula litros y USD reales pendientes de facturar excluyendo solicitudes de creación de clientes.
 */
export function summarizePendingOrders(orders = []) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { basePendiente: 0, pendingOrdersUsd: 0 };
  }
  return orders
    .filter((o) => {
      if (!o) return false;
      const tDoc = String(o.tipoDoc || o.tipo_doc || '').trim().toUpperCase();
      if (tDoc === 'SOLICITUD_CLIENTE') return false;
      const st = String(o.estatus || o.status || o.estado || '').trim().toUpperCase();
      return st === 'PENDIENTE' || st === 'APROBADO';
    })
    .reduce(
      (acc, o) => ({
        basePendiente: acc.basePendiente + (Number(o.totalLitros ?? o.total_litros) || 0),
        pendingOrdersUsd: acc.pendingOrdersUsd + (Number(o.totalUsd ?? o.total_usd ?? o.totalNetoUsd ?? o.subtotalUsd ?? 0) || 0)
      }),
      { basePendiente: 0, pendingOrdersUsd: 0 }
    );
}

/**
 * Resume cartera CxC al día vs vencida usando clave canónica, fecha local VE y plazos de crédito completos.
 */
export function summarizeReceivablesAging({ profitInvoices = [], sales = [], tasaBcv = 1, todayKey = toDateKey(new Date()) } = {}) {
  const today = todayKey || toDateKey(new Date());
  let alDia = 0;
  let vencida = 0;
  const seenCxcKeys = new Set();

  if (Array.isArray(profitInvoices)) {
    dedupeCanonicalDocs(profitInvoices).forEach((f) => {
      if (!f || isCxcInvoiceCancelled(f)) return;
      const ck = getEraScopedCanonicalDocKey(f);
      if (ck) seenCxcKeys.add(ck);
      if (isCxcInvoiceSettled(f)) return;
      let saldo = Number(f.saldoUsd ?? f.saldo_usd ?? 0);
      if (saldo <= 0.01 && (f.saldoBs ?? f.saldo_bs) && tasaBcv > 0) {
        saldo = Number(f.saldoBs ?? f.saldo_bs) / tasaBcv;
      }
      if (saldo <= 0.01) return;
      const fVencRaw = f.fechaVencimiento || f.fecVenc || f.fec_venc || '';
      const fVenc = toDateKey(fVencRaw) || fVencRaw;
      if (!fVenc || fVenc >= today) {
        alDia += saldo;
      } else {
        vencida += saldo;
      }
    });
  }

  if (Array.isArray(sales)) {
    dedupeCanonicalDocs(sales).forEach((s) => {
      if (!s || isCxcInvoiceCancelled(s)) return;
      const rawTipo = String(s.tipoDoc || s.tipo_doc || '').toUpperCase().trim();
      if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION') return;
      const ck = getEraScopedCanonicalDocKey(s);
      if (ck && seenCxcKeys.has(ck)) return;
      if (isCxcInvoiceSettled(s)) return;
      const statusUpper = String(s.estado || s.status || '').toUpperCase().trim();
      const explicitSaldo = Number(s.saldoPendiente ?? s.saldoUsd ?? s.saldo_usd ?? 0);
      if (!isCreditSaleRecord(s) && statusUpper !== 'PENDIENTE' && explicitSaldo <= 0.01) return;
      const saldo = Number(s.saldoPendiente ?? s.saldoUsd ?? s.saldo_usd ?? (s.totalUsd && !s.pagado ? s.totalUsd : 0));
      if (saldo <= 0.01) return;
      const fVencRaw = s.fechaVencimiento || s.fechaVenc || '';
      const fVenc = toDateKey(fVencRaw) || fVencRaw;
      if (!fVenc || fVenc >= today) {
        alDia += saldo;
      } else {
        vencida += saldo;
      }
    });
  }

  const cxcDia = parseFloat(alDia.toFixed(2));
  const cxcVen = parseFloat(vencida.toFixed(2));
  const cxcTot = parseFloat((cxcDia + cxcVen).toFixed(2));
  return {
    cxcDia,
    cxcVen,
    cxcTot,
    cxcDiaPct: cxcTot > 0 ? parseFloat(((cxcDia / cxcTot) * 100).toFixed(2)) : 0,
    cxcVenPct: cxcTot > 0 ? parseFloat(((cxcVen / cxcTot) * 100).toFixed(2)) : 0
  };
}
