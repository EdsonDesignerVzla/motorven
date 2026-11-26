import { getEraScopedCanonicalDocKey, dedupeCanonicalDocs } from './fiscalService.js';
import { isCxcInvoiceCancelled, isCxcInvoiceSettled, isCreditSaleRecord, isCreditOrDebitNoteDoc } from '../utils/cxcUtils.js';
import { normalizeProfitCollectionUsd } from './commissionService.js';
import { resolveProductUnit, resolveProductLitersPerUnit, getProductWarehouseStocks } from './formatService.js';
import { getProductCost } from './pricingService.js';
import {
  dedupePayablesList,
  normalizeProviderRif,
  normalizeProviderName,
  normalizeDocType
} from '../utils/cxpUtils.js';

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
  let venFacturas = 0;
  let venNotas = 0;
  let docsVencidosFacturas = 0;
  let docsVencidosNotas = 0;
  const seenCxcKeys = new Set();

  const isNotaEntregaDoc = (doc) => {
    const tipo = String(doc?.tipoDoc || doc?.tipo_doc || '').toUpperCase().trim();
    const num = String(doc?.numeroFactura || doc?.numeroDoc || doc?.numero_doc || doc?.id || '').toUpperCase().trim();
    return tipo === 'NOTA_ENTREGA' || tipo === 'NE' || num.startsWith('NE-');
  };

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
        if (isNotaEntregaDoc(f)) {
          venNotas += saldo;
          docsVencidosNotas += 1;
        } else {
          venFacturas += saldo;
          docsVencidosFacturas += 1;
        }
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
        if (isNotaEntregaDoc(s)) {
          venNotas += saldo;
          docsVencidosNotas += 1;
        } else {
          venFacturas += saldo;
          docsVencidosFacturas += 1;
        }
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
    cxcVenFacturas: parseFloat(venFacturas.toFixed(2)),
    cxcVenNotas: parseFloat(venNotas.toFixed(2)),
    docsVencidosFacturas,
    docsVencidosNotas,
    docsVencidos: docsVencidosFacturas + docsVencidosNotas,
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
  monthPrefix = '',
  periodFrom = '',
  periodTo = ''
} = {}) {
  const safeToday = todayKey || toDateKey(new Date());
  const targetPrefix = monthPrefix || safeToday.substring(0, 7);
  const hasCustomRange = Boolean(periodFrom && periodTo);

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
  const mesAgg = aggregate(
    normalized.filter((c) =>
      hasCustomRange
        ? c.dateKey >= periodFrom && c.dateKey <= periodTo
        : c.dateKey.startsWith(targetPrefix) && c.dateKey <= safeToday
    )
  );

  const [py, pm] = targetPrefix.split('-').map(Number);
  const diasDelMes = new Date(py || ty, pm || tm, 0).getDate();
  const currentPrefix = safeToday.substring(0, 7);
  let diasTranscurridos = 0;
  if (hasCustomRange) {
    const [fy, fm, fd] = periodFrom.split('-').map(Number);
    const [ey, em, ed] = periodTo.split('-').map(Number);
    const d1 = new Date(fy, (fm || 1) - 1, fd || 1);
    const d2 = new Date(ey, (em || 1) - 1, ed || 1);
    diasTranscurridos = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
  } else if (targetPrefix === currentPrefix) {
    diasTranscurridos = Number(safeToday.substring(8, 10)) || 1;
  } else if (targetPrefix < currentPrefix) {
    diasTranscurridos = diasDelMes;
  }

  const esMesEnCurso = !hasCustomRange && targetPrefix === currentPrefix;
  const esFuturo = !hasCustomRange && targetPrefix > currentPrefix;
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

/**
 * Identifica si un documento CxP pertenece al proveedor Keystone, C.A. (RIF J-31115365-9
 * o variantes de razón social Keystone / Keistone / Keyton).
 */
export function isKeystonePayableRecord(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const rif = normalizeProviderRif(
    doc.provRif ?? doc.prov_rif ?? doc.rif ?? doc.coProv ?? doc.co_prov
  );
  if (rif === 'J311153659' || rif === '311153659' || rif.includes('311153659')) {
    return true;
  }
  const name = normalizeProviderName(
    doc.provNombre ?? doc.prov_nombre ?? doc.provDes ?? doc.prov_des ?? doc.proveedor ?? doc.nombre
  );
  return /KEYST|KEIST|KEYTON/.test(name);
}

/**
 * Resume la sumatoria actual de todas las Cuentas por Pagar (CxP) pendientes a Keystone, C.A.,
 * replicando la lógica de deduplicación, exclusión de anulados y cálculo de saldo de AccountsPayableModal.
 */
export function summarizeKeystonePayables({
  profitAccountsPayable = [],
  tasaKeystone = 1,
  todayKey = toDateKey(new Date()),
  periodFrom = '',
  periodTo = ''
} = {}) {
  const safeRate = Number(tasaKeystone) > 1 ? Number(tasaKeystone) : 1;
  const safeToday = todayKey || toDateKey(new Date());
  const hasRange = Boolean(periodFrom && periodTo);

  const uniqueDocs = dedupePayablesList(
    Array.isArray(profitAccountsPayable) ? profitAccountsPayable : []
  );

  let saldoTotalUsd = 0;
  let saldoVigenteUsd = 0;
  let saldoVencidoUsd = 0;
  let vencenEnPeriodoUsd = 0;
  let documentosPendientes = 0;
  let docsVigentes = 0;
  let docsVencidos = 0;
  let docsVencenEnPeriodo = 0;
  let documentosTotales = 0;
  const byTypeMap = new Map();

  const DOC_TYPE_LABELS = {
    FACT: 'Facturas',
    FACTURA: 'Facturas',
    NE: 'Notas Entrega',
    NOTA_ENTREGA: 'Notas Entrega',
    'N/DB': 'Notas Débito',
    ND: 'Notas Débito',
    'N/CR': 'Notas Crédito',
    NC: 'Notas Crédito',
    ADEL: 'Adelantos'
  };

  uniqueDocs.forEach((doc) => {
    if (!doc || typeof doc !== 'object') return;
    if (doc.anulado === true) return;
    const statusUp = String(doc.status || doc.estado || '').trim().toUpperCase();
    if (statusUp === 'ANULADO' || statusUp === 'ANULADA') return;
    if (!isKeystonePayableRecord(doc)) return;

    documentosTotales += 1;

    const montoNetBs = Number(doc.montoNetBs ?? doc.monto_net_bs ?? 0) || 0;
    const montoNetUsd = Number(
      doc.montoNetUsd ?? doc.monto_net_usd ?? (safeRate > 1 ? montoNetBs / safeRate : 0)
    ) || 0;
    const saldoBsRaw = Number(doc.saldoBs ?? doc.saldo_bs ?? 0) || 0;
    const explicitSaldoUsd = doc.saldoUsd ?? doc.saldo_usd;
    const hasExplicitSaldo = explicitSaldoUsd !== undefined && explicitSaldoUsd !== null && explicitSaldoUsd !== '';
    const rawSaldoUsd = hasExplicitSaldo
      ? Number(explicitSaldoUsd)
      : (saldoBsRaw > 0 && safeRate > 1 ? saldoBsRaw / safeRate : montoNetUsd);

    const saldoUsd = Math.max(0, parseFloat((Number.isFinite(rawSaldoUsd) ? rawSaldoUsd : 0).toFixed(2)));
    if (saldoUsd <= 0.01) return;

    documentosPendientes += 1;
    saldoTotalUsd += saldoUsd;

    const fecVencRaw = doc.fechaVencimiento || doc.fec_venc || doc.fecVenc || doc.fechaEmision || doc.fec_emis || '';
    const fecVencKey = toDateKey(fecVencRaw);
    const isVencido = Boolean(fecVencKey && fecVencKey < safeToday);

    if (isVencido) {
      saldoVencidoUsd += saldoUsd;
      docsVencidos += 1;
    } else {
      saldoVigenteUsd += saldoUsd;
      docsVigentes += 1;
    }

    if (hasRange && fecVencKey && fecVencKey >= periodFrom && fecVencKey <= periodTo) {
      vencenEnPeriodoUsd += saldoUsd;
      docsVencenEnPeriodo += 1;
    }

    const tipoDoc = normalizeDocType(doc.tipoDoc ?? doc.tipo_doc);
    const label = DOC_TYPE_LABELS[tipoDoc] || tipoDoc;
    const cur = byTypeMap.get(label) || { label, count: 0, usd: 0 };
    cur.count += 1;
    cur.usd = parseFloat((cur.usd + saldoUsd).toFixed(2));
    byTypeMap.set(label, cur);
  });

  const cleanTotalUsd = parseFloat(saldoTotalUsd.toFixed(2));
  const cleanVigenteUsd = parseFloat(saldoVigenteUsd.toFixed(2));
  const cleanVencidoUsd = parseFloat(saldoVencidoUsd.toFixed(2));
  const cleanTotalBs = parseFloat((cleanTotalUsd * safeRate).toFixed(2));
  const vencidoPct = cleanTotalUsd > 0
    ? parseFloat(((cleanVencidoUsd / cleanTotalUsd) * 100).toFixed(1))
    : 0;

  return {
    saldoTotalUsd: cleanTotalUsd,
    saldoTotalBs: cleanTotalBs,
    saldoVigenteUsd: cleanVigenteUsd,
    saldoVencidoUsd: cleanVencidoUsd,
    vencenEnPeriodoUsd: parseFloat(vencenEnPeriodoUsd.toFixed(2)),
    documentosPendientes,
    docsVigentes,
    docsVencidos,
    docsVencenEnPeriodo,
    documentosTotales,
    vencidoPct,
    desglosePorTipo: Array.from(byTypeMap.values())
  };
}

function isExcludedSaleDocType(doc) {
  const tipo = String(doc?.tipoDoc || doc?.tipo_doc || '').trim().toUpperCase();
  return (
    tipo === 'COTIZACION' ||
    tipo === 'SOLICITUD_CLIENTE' ||
    isCreditOrDebitNoteDoc(doc)
  );
}

function isSyntheticManualItem(item) {
  const sku = String(item?.articuloId || item?.codigo || item?.id || '').trim().toUpperCase();
  return sku === 'LUB-MANUAL' || sku === 'NE-DESP';
}

function resolveItemUnitLiters(item, prod) {
  if (prod) return resolveProductLitersPerUnit(prod);
  const sku = String(item?.articuloId || item?.codigo || item?.id || '').trim();
  const desc = String(item?.descripcion || item?.nombre || '').toLowerCase();
  const unit = String(item?.unidad || item?.unidadVenta || '').toLowerCase();
  if (sku === '000003' || desc.includes('granel') || unit === 'litros' || unit === 'litro') {
    return 1;
  }
  const explicitUnitL = Number(
    item?.litrosUnitarios ??
    item?.litros_unitarios ??
    item?.litrosPorUnidad ??
    item?.litros_por_unidad ??
    0
  );
  if (explicitUnitL > 0 && explicitUnitL !== 19) return explicitUnitL;
  return 11.35;
}

function resolveLineItemLitros(item, productsBySku) {
  if (!item || typeof item !== 'object') return 0;
  const desc = String(item.descripcion || item.nombre || '').toLowerCase();
  const sku = String(item.articuloId || item.codigo || item.id || '').trim();
  if (desc.includes('flete') || desc.includes('servicio') || sku === '101815' || sku === 'GNP001') {
    return 0;
  }
  if (isSyntheticManualItem(item)) {
    return Number(item.litrosTotales ?? item.litros_totales ?? item.litros ?? 0) || 0;
  }
  const prod = productsBySku?.get(sku);
  const cantidad = Math.max(0, Number(item.cantidad ?? item.qty ?? 0) || 0);
  const ltsUnit = resolveItemUnitLiters(item, prod);
  if (cantidad > 0 && ltsUnit > 0) {
    return Number((cantidad * ltsUnit).toFixed(2));
  }
  return Number(item.litrosTotales ?? item.litros_totales ?? item.litros ?? 0) || 0;
}

/**
 * Normaliza documentos de facturación combinando `profitInvoices` y `sales` POS sin doble conteo.
 */
export function normalizeDashboardSalesDocs({
  profitInvoices = [],
  sales = [],
  products = [],
  tasaBcv = 1
} = {}) {
  const safeRate = Number(tasaBcv) > 1 ? Number(tasaBcv) : 1;
  const productsBySku = new Map();
  (products || []).forEach((p) => {
    const sku = String(p?.codigo || p?.id || '').trim();
    if (sku) productsBySku.set(sku, p);
  });

  const isServiceItem = (desc) => {
    const d = (desc || '').toLowerCase();
    return d.includes('flete') || d.includes('servicio');
  };

  const getDocDedupKey = (docObj) => {
    if (!docObj || typeof docObj !== 'object') return '';
    return getEraScopedCanonicalDocKey(docObj);
  };

  const normalizeDocItems = (rawItems = [], tasaDoc = safeRate, headerLitros = 0) => {
    const mapped = (rawItems || []).map((it) => {
      const sku = String(it.articuloId || it.codigo || it.id || '').trim();
      const prod = productsBySku.get(sku);
      const desc = it.descripcion || it.nombre || prod?.descripcion || prod?.nombre || sku || 'Lubricante';
      const cantidad = Number(it.cantidad || 0);
      const litros = resolveLineItemLitros(it, productsBySku);
      const usdDirect = Number(it.totalUsd ?? it.subtotalUsd ?? 0);
      const usd = usdDirect > 0
        ? usdDirect
        : ((Number(it.totalNeto || 0) || 0) / (tasaDoc > 1 ? tasaDoc : 1)) || (Number(it.precioUsd || 0) * cantidad);
      return {
        sku,
        desc,
        cantidad,
        litros,
        usd,
        esServicio: isServiceItem(desc)
      };
    });
    if (mapped.length === 1 && isSyntheticManualItem(rawItems[0]) && mapped[0].litros === 0 && headerLitros > 0) {
      mapped[0].litros = headerLitros;
    }
    return mapped;
  };

  const salesById = new Map();
  const salesByKey = new Map();
  (sales || []).forEach((s) => {
    if (!s || isCxcInvoiceCancelled(s) || isExcludedSaleDocType(s)) return;
    if (s.id) salesById.set(String(s.id), s);
    const dk = getDocDedupKey(s);
    if (dk && !salesByKey.has(dk)) salesByKey.set(dk, s);
  });

  const seenIds = new Set();
  const seenDocKeys = new Set();
  const docs = [];

  (dedupeCanonicalDocs(profitInvoices) || []).forEach((inv) => {
    if (!inv || isCxcInvoiceCancelled(inv) || isExcludedSaleDocType(inv)) return;
    const dateKey = toDateKey(inv.fechaEmision || inv.fecEmis || inv.fec_emis || inv.fecha);
    if (!dateKey) return;

    const idStr = inv.id ? String(inv.id) : '';
    const dk = getDocDedupKey(inv);
    if ((idStr && seenIds.has(idStr)) || (dk && seenDocKeys.has(dk))) return;
    if (idStr) seenIds.add(idStr);
    if (dk) seenDocKeys.add(dk);

    const usd = Number(inv.totNetoUsd ?? inv.tot_neto_usd ?? inv.totalNetoUsd ?? 0) || 0;
    const bsRaw = Number(inv.totNetoBs ?? inv.tot_neto_bs ?? 0) || 0;
    const tasaDoc = Number(inv.tasa) > 1 ? Number(inv.tasa) : safeRate;
    const headerLitros = Number(inv.totalLitros ?? inv.total_litros ?? 0) || 0;

    const matchingSale = (idStr && salesById.get(idStr)) || (dk && salesByKey.get(dk));
    const rawItems = (Array.isArray(inv.items) && inv.items.length > 0)
      ? inv.items
      : (matchingSale?.items || []);
    const items = normalizeDocItems(rawItems, tasaDoc, headerLitros);
    const itemsLitros = Number(items.reduce((acc, it) => acc + it.litros, 0).toFixed(2));
    const hasRealItems = rawItems.some((it) => it && !isSyntheticManualItem(it));

    docs.push({
      dateKey,
      usd,
      bs: bsRaw > 0 ? bsRaw : usd * safeRate,
      litros: (hasRealItems && itemsLitros > 0) ? itemsLitros : (headerLitros > 0 ? headerLitros : itemsLitros),
      cliente: inv.clienteNombre || inv.cliente_nombre || inv.cli_des || inv.clienteId || '',
      items
    });
  });

  (sales || []).forEach((s) => {
    if (!s || isCxcInvoiceCancelled(s) || isExcludedSaleDocType(s)) return;

    const idStr = s.id ? String(s.id) : '';
    const dk = getDocDedupKey(s);
    if ((idStr && seenIds.has(idStr)) || (dk && seenDocKeys.has(dk))) return;
    if (idStr) seenIds.add(idStr);
    if (dk) seenDocKeys.add(dk);

    const dateKey = toDateKey(s.fecha || s.fechaEmision || s.fecha_emision);
    if (!dateKey) return;
    const usd = Number(s.totalUsd ?? s.total_usd ?? 0) || 0;
    const bsRaw = Number(s.totalBs ?? s.total_bs ?? 0) || 0;
    const tasaDoc = Number(s.tasaDolar ?? s.tasa_dolar ?? 0) > 1 ? Number(s.tasaDolar ?? s.tasa_dolar) : safeRate;
    const headerLitros = Number(s.totalLitros ?? s.total_litros ?? 0) || 0;
    const rawSaleItems = s.items || [];
    const items = normalizeDocItems(rawSaleItems, tasaDoc, headerLitros);
    const itemsLitros = Number(items.reduce((acc, it) => acc + it.litros, 0).toFixed(2));
    const hasRealSaleItems = rawSaleItems.some((it) => it && !isSyntheticManualItem(it));

    docs.push({
      dateKey,
      usd,
      bs: bsRaw > 0 ? bsRaw : usd * safeRate,
      litros: (hasRealSaleItems && itemsLitros > 0) ? itemsLitros : (headerLitros > 0 ? headerLitros : itemsLitros),
      cliente: s.clienteNombre || s.cliente_nombre || s.cliente || '',
      items
    });
  });

  return docs;
}

/**
 * Agrega totales de facturación (USD, Bs, litros, cajas, documentos, clientes, SKUs) de una lista normalizada.
 */
export function summarizeSalesDocsList(docs = []) {
  const skuSet = new Set();
  const clientes = new Set();
  let usd = 0;
  let bs = 0;
  let litros = 0;

  (docs || []).forEach((d) => {
    usd += d.usd;
    bs += d.bs;
    litros += d.litros;
    if (d.cliente) clientes.add(d.cliente);
    (d.items || []).forEach((it) => {
      if (!it.esServicio && it.sku) skuSet.add(it.sku);
    });
  });

  return {
    usd: parseFloat(usd.toFixed(2)),
    bs: parseFloat(bs.toFixed(2)),
    litros: parseFloat(litros.toFixed(2)),
    cajas: parseFloat((litros / 11.35).toFixed(1)),
    documentos: (docs || []).length,
    clientes: clientes.size,
    skus: skuSet.size
  };
}

/**
 * Calcula Ventas del Día (con comparativo ayer) y Acumulado Mensual con proyección y % de meta.
 */
export function summarizeSalesWindows({
  ventasDocsNormalizados = [],
  todayKey = toDateKey(new Date()),
  anioActivo = new Date().getFullYear(),
  ventasMesFilter = '01',
  metaMensualBase = 20000
} = {}) {
  const safeToday = todayKey || toDateKey(new Date());
  const hoy = summarizeSalesDocsList(ventasDocsNormalizados.filter((d) => d.dateKey === safeToday));
  const [ty, tm, td] = safeToday.split('-').map(Number);
  const ayerDate = new Date(ty, (tm || 1) - 1, (td || 1) - 1);
  const ayerKey = toDateKey(ayerDate);
  const ayer = ventasDocsNormalizados
    .filter((d) => d.dateKey === ayerKey)
    .reduce((acc, d) => ({ usd: acc.usd + d.usd, litros: acc.litros + d.litros }), { usd: 0, litros: 0 });

  const ventasDelDia = {
    ...hoy,
    ayerUsd: parseFloat(ayer.usd.toFixed(2)),
    ayerLitros: parseFloat(ayer.litros.toFixed(2))
  };

  const prefix = `${anioActivo}-${ventasMesFilter}`;
  const resumen = summarizeSalesDocsList(
    ventasDocsNormalizados.filter((d) => d.dateKey.startsWith(prefix) && d.dateKey <= safeToday)
  );
  const monthIdx = Number(ventasMesFilter);
  const diasDelMes = new Date(Number(anioActivo), monthIdx, 0).getDate();
  const currentPrefix = safeToday.substring(0, 7);
  let diasTranscurridos = 0;
  if (prefix === currentPrefix) diasTranscurridos = Number(safeToday.substring(8, 10));
  else if (prefix < currentPrefix) diasTranscurridos = diasDelMes;

  const esMesEnCurso = prefix === currentPrefix;
  const promedioDiarioUsd = diasTranscurridos > 0 ? resumen.usd / diasTranscurridos : 0;
  const promedioDiarioLitros = diasTranscurridos > 0 ? resumen.litros / diasTranscurridos : 0;
  const meta = Number(metaMensualBase) || 0;

  const ventasAcumuladoMes = {
    ...resumen,
    diasDelMes,
    diasTranscurridos,
    esMesEnCurso,
    esFuturo: prefix > currentPrefix,
    promedioDiarioUsd: parseFloat(promedioDiarioUsd.toFixed(2)),
    promedioDiarioLitros: parseFloat(promedioDiarioLitros.toFixed(1)),
    proyeccionLitros: esMesEnCurso ? parseFloat((promedioDiarioLitros * diasDelMes).toFixed(1)) : resumen.litros,
    proyeccionUsd: esMesEnCurso ? parseFloat((promedioDiarioUsd * diasDelMes).toFixed(2)) : resumen.usd,
    metaLitros: meta,
    pctMeta: meta > 0 ? parseFloat(((resumen.litros / meta) * 100).toFixed(1)) : 0
  };

  return { ventasDelDia, ventasAcumuladoMes };
}

/**
 * Resume inventario físico total en litros, valorización en USD y desglose por unidades de medida.
 */
export function summarizeInventoryStock(products = []) {
  let totalStockLts = 0;
  let valUsd = 0;
  const breakdown = { Caja: 0, Paila: 0, Tambor: 0, Totem: 0, Litros: 0 };

  (products || []).forEach((p) => {
    const cant = Number(p?.stock || p?.existencia || 0);
    const ltsUnidad = resolveProductLitersPerUnit(p);
    totalStockLts += cant * ltsUnidad;

    const unit = resolveProductUnit(p, 'Caja');
    if (breakdown[unit] !== undefined) {
      breakdown[unit] += cant;
    }

    const hasWhFields =
      p?.stockAlmacen01 !== undefined ||
      p?.stock_almacen_01 !== undefined ||
      p?.stockAlmacen02 !== undefined ||
      p?.stock_almacen_02 !== undefined;
    if (hasWhFields) {
      const stocks = getProductWarehouseStocks(p);
      valUsd += stocks.stock01 * getProductCost(p, '01') + stocks.stock02 * getProductCost(p, '02');
    } else {
      const costo = getProductCost(p) || Number(p?.costo_unitario ?? 0) || 0;
      valUsd += cant * costo;
    }
  });

  const items = [
    breakdown.Caja > 0 ? `${breakdown.Caja.toLocaleString('es-VE')} ${breakdown.Caja === 1 ? 'Caja' : 'Cajas'}` : null,
    breakdown.Paila > 0 ? `${breakdown.Paila.toLocaleString('es-VE')} ${breakdown.Paila === 1 ? 'Paila' : 'Pailas'}` : null,
    breakdown.Tambor > 0 ? `${breakdown.Tambor.toLocaleString('es-VE')} ${breakdown.Tambor === 1 ? 'Tambor' : 'Tambores'}` : null,
    breakdown.Totem > 0 ? `${breakdown.Totem.toLocaleString('es-VE')} ${breakdown.Totem === 1 ? 'Totem' : 'Totems'}` : null,
    breakdown.Litros > 0 ? `${breakdown.Litros.toLocaleString('es-VE')} L Granel` : null
  ].filter(Boolean);

  return {
    stockTotalLitros: parseFloat(totalStockLts.toFixed(2)),
    stockValorizadoUsd: parseFloat(valUsd.toFixed(2)),
    stockBreakdownItems: items,
    stockBreakdownLabel: items.join(' • ') || '0 Unidades'
  };
}
