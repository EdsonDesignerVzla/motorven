import { getEraScopedCanonicalDocKey, dedupeCanonicalDocs } from './fiscalService.js';
import { isCxcInvoiceCancelled, isCxcInvoiceSettled, isCreditSaleRecord } from '../utils/cxcUtils.js';
import { normalizeProfitCollectionUsd } from './commissionService.js';

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
      const rawId = String(s.id || '').toUpperCase().trim();
      if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION' || rawId.startsWith('NOTA_DEBITO-')) return;
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

const isForeignCollectionMethod = (label, codCaja = '', tipoTasa = '') => {
  const m = String(label || '').toUpperCase().trim();
  const caja = String(codCaja || '').toUpperCase().trim();
  const tt = String(tipoTasa || '').toUpperCase().trim();
  if (['USD', 'ZELLE', 'USDT', 'USDC'].includes(tt)) return true;
  return (
    m.includes('ZELLE') ||
    m.includes('EFECTIVO_USD') ||
    m.includes('DIVISA') ||
    m.includes('CASH') ||
    m.includes('USD') ||
    m.includes('USDT') ||
    m.includes('USDC') ||
    m === 'EFEC' ||
    caja.includes('USDT') ||
    caja.includes('USD')
  );
};

/**
 * Normaliza un registro individual de `profit_collections` devolviendo montos reales en USD, Bs
 * y su separación en divisas vs. bolívares sin distorsionar pagos directos en USD.
 */
export function normalizeCollectionRecordMetrics(col, tasaBcv = 1) {
  if (!col || typeof col !== 'object') {
    return { usd: 0, bsReal: 0, bsEquiv: 0, divisasUsd: 0, bsUsd: 0 };
  }
  const safeBcv = Number(tasaBcv) > 1 ? Number(tasaBcv) : 1;
  const rawUsd = Number(col.montoUsd ?? col.monto_usd ?? 0) || 0;
  const rawBs = Number(col.montoBs ?? col.monto_bs ?? 0) || 0;
  const cTasaPago = Number(col.tasaPago ?? col.tasa_pago ?? 0) || 0;
  const cTasaRaw = Number(col.tasa ?? 0) || 0;
  const effectiveTasa = cTasaPago > 10 ? cTasaPago : (cTasaRaw > 10 ? cTasaRaw : safeBcv);

  let usdVal = normalizeProfitCollectionUsd(col);
  if (usdVal <= 0 && rawBs > 0 && effectiveTasa > 1) {
    usdVal = Number((rawBs / effectiveTasa).toFixed(2));
  }
  if (usdVal <= 0 && rawUsd <= 0 && rawBs <= 0) {
    return { usd: 0, bsReal: 0, bsEquiv: 0, divisasUsd: 0, bsUsd: 0 };
  }

  let divisasUsd = 0;
  let bsUsd = 0;
  let bsReal = 0;

  const tipoTasaUp = String(col.tipoTasa ?? col.tipo_tasa ?? '').toUpperCase().trim();
  const monedaUp = String(col.monedaPago ?? col.moneda_pago ?? col.moneda ?? '').toUpperCase().trim();
  const formas = Array.isArray(col.formasPago) ? col.formasPago : [];

  if (formas.length > 0 && usdVal > 0) {
    const totalFpRaw = formas.reduce((acc, fp) => {
      const v = Number(fp?.montoUsd ?? fp?.monto_usd ?? fp?.monto ?? 0) || 0;
      return acc + v;
    }, 0);
    let anyBs = false;
    formas.forEach((fp) => {
      const fpLabel = fp?.tipo || fp?.formaPago || fp?.forma_pago || '';
      const fpTipoTasa = fp?.tipoTasa || fp?.tipo_tasa || tipoTasaUp;
      const fpUsdExplicit = Number(fp?.montoUsd ?? fp?.monto_usd ?? 0) || 0;
      const fpRaw = Number(fp?.montoUsd ?? fp?.monto_usd ?? fp?.monto ?? 0) || 0;
      const fpUsd = (fpUsdExplicit > 0 && !(effectiveTasa > 10 && rawBs > 0 && Math.abs(fpUsdExplicit - rawBs) < 0.05 && usdVal < fpUsdExplicit))
        ? fpUsdExplicit
        : (totalFpRaw > 0 ? (fpRaw / totalFpRaw) * usdVal : usdVal / formas.length);

      if (isForeignCollectionMethod(fpLabel, fp?.codCaja, fpTipoTasa) || (monedaUp === 'USD' && rawBs <= 0)) {
        divisasUsd += fpUsd;
      } else {
        bsUsd += fpUsd;
        anyBs = true;
      }
    });
    if (anyBs) {
      bsReal = rawBs > 0 ? rawBs : (bsUsd * effectiveTasa);
    }
  } else {
    const metodo = String(col.metodo || col.formaPago || col.forma_pago || col.tipo || '').toUpperCase().trim();
    const isDirectUsd =
      isForeignCollectionMethod(metodo, col.cuentaId || col.codCaja, tipoTasaUp) ||
      ((monedaUp === 'USD' || monedaUp === 'US$') && rawBs <= 0);
    if (isDirectUsd) {
      divisasUsd = usdVal;
    } else {
      bsUsd = usdVal;
      bsReal = rawBs > 0 ? rawBs : (usdVal * effectiveTasa);
    }
  }

  const bsEquiv = rawBs > 0 ? rawBs : (usdVal * effectiveTasa);
  return {
    usd: Number(usdVal.toFixed(2)),
    bsReal: Number(bsReal.toFixed(2)),
    bsEquiv: Number(bsEquiv.toFixed(2)),
    divisasUsd: Number(divisasUsd.toFixed(2)),
    bsUsd: Number(bsUsd.toFixed(2))
  };
}

/**
 * Resume cobranzas reales del día (con comparativo vs. ayer) y acumulado del mes seleccionado.
 */
export function summarizeCollectionsWindow({
  profitCollections = [],
  tasaBcv = 1,
  todayKey = toDateKey(new Date()),
  monthPrefix = ''
} = {}) {
  const safeToday = todayKey || toDateKey(new Date());
  const targetPrefix = monthPrefix || safeToday.substring(0, 7);

  const [ty, tm, td] = safeToday.split('-').map(Number);
  const ayerDate = new Date(ty, (tm || 1) - 1, (td || 1) - 1);
  const ayerKey = toDateKey(ayerDate);

  const seenIds = new Set();
  const normalized = [];

  (Array.isArray(profitCollections) ? profitCollections : []).forEach((c) => {
    if (!c || isCxcInvoiceCancelled(c)) return;
    const formaUp = String(c.formaPago || c.forma_pago || c.tipo || '').toUpperCase().trim();
    if (formaUp === 'NOTA_CREDITO') return;

    const idStr = c.id !== undefined && c.id !== null ? String(c.id).trim() : '';
    if (idStr) {
      if (seenIds.has(idStr)) return;
      seenIds.add(idStr);
    }

    const dateKey = toDateKey(c.fecha || c.fec_cob || c.fecCob || c.fechaEmision || c.fecEmis || c.createdAt || '');
    if (!dateKey) return;

    const m = normalizeCollectionRecordMetrics(c, tasaBcv);
    if (m.usd <= 0 && m.bsEquiv <= 0) return;

    const clienteKey = String(c.clienteId || c.cliente_id || c.clienteRif || c.cliente_rif || c.clienteNombre || c.cliente_nombre || '').trim().toUpperCase();
    normalized.push({ dateKey, clienteKey, ...m });
  });

  const aggregate = (items) => {
    let usd = 0;
    let bsReal = 0;
    let bsEquiv = 0;
    let divisasUsd = 0;
    let bsUsd = 0;
    const clientes = new Set();

    items.forEach((it) => {
      usd += it.usd;
      bsReal += it.bsReal;
      bsEquiv += it.bsEquiv;
      divisasUsd += it.divisasUsd;
      bsUsd += it.bsUsd;
      if (it.clienteKey) clientes.add(it.clienteKey);
    });

    return {
      usd: parseFloat(usd.toFixed(2)),
      bsReal: parseFloat(bsReal.toFixed(2)),
      bsEquiv: parseFloat(bsEquiv.toFixed(2)),
      divisasUsd: parseFloat(divisasUsd.toFixed(2)),
      bsUsd: parseFloat(bsUsd.toFixed(2)),
      recibos: items.length,
      clientes: clientes.size
    };
  };

  const hoyAgg = aggregate(normalized.filter((c) => c.dateKey === safeToday));
  const ayerAgg = aggregate(normalized.filter((c) => c.dateKey === ayerKey));
  const mesAgg = aggregate(normalized.filter((c) => c.dateKey.startsWith(targetPrefix) && c.dateKey <= safeToday));

  const [py, pm] = targetPrefix.split('-').map(Number);
  const diasDelMes = new Date(py || ty, pm || tm, 0).getDate();
  const currentPrefix = safeToday.substring(0, 7);
  let diasTranscurridos = 0;
  if (targetPrefix === currentPrefix) diasTranscurridos = Number(safeToday.substring(8, 10)) || 1;
  else if (targetPrefix < currentPrefix) diasTranscurridos = diasDelMes;

  const esMesEnCurso = targetPrefix === currentPrefix;
  const esFuturo = targetPrefix > currentPrefix;
  const promedioDiarioUsd = diasTranscurridos > 0 ? mesAgg.usd / diasTranscurridos : 0;

  return {
    hoy: {
      ...hoyAgg,
      ayerUsd: ayerAgg.usd,
      ayerRecibos: ayerAgg.recibos
    },
    mes: {
      ...mesAgg,
      diasDelMes,
      diasTranscurridos,
      esMesEnCurso,
      esFuturo,
      promedioDiarioUsd: parseFloat(promedioDiarioUsd.toFixed(2)),
      proyeccionUsd: esMesEnCurso ? parseFloat((promedioDiarioUsd * diasDelMes).toFixed(2)) : mesAgg.usd
    }
  };
}
