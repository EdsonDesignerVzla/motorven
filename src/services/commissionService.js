/**
 * =========================================================================
 * MOTOR OFICIAL DE COMISIONES POR COBRANZA Y DÍAS VENCIDOS — SIGNUM MOTORVEN
 * =========================================================================
 * Reglas Corporativas Oficiales:
 * - Aplica sobre Facturas Fiscales (FACTURA) y Notas de Entrega (NOTA_ENTREGA) no anuladas.
 * - La comisión se devenga ÚNICAMENTE cuando el documento está TOTALMENTE PAGADO
 *   (saldoUsd <= 0.01 o estado COBRADA / PAGADO / PAGADA).
 * - Base de cálculo estrictamente SIN IVA (ni IGTF).
 * - Escala oficial por días vencidos al completarse el pago total:
 *     * 0 a 7 días vencidos:   4%
 *     * 8 a 14 días vencidos:  3%
 *     * 15 a 21 días vencidos: 1%
 *     * > 21 días vencidos:    0%
 */

import { round2 } from './formatService.js';

export const MOTORVEN_COMMISSION_TIERS = {
  TIER_0_7: {
    id: 'TIER_0_7',
    label: '0 a 7 días vencidos',
    shortLabel: '0–7d',
    minDays: 0,
    maxDays: 7,
    ratePct: 4
  },
  TIER_8_14: {
    id: 'TIER_8_14',
    label: '8 a 14 días vencidos',
    shortLabel: '8–14d',
    minDays: 8,
    maxDays: 14,
    ratePct: 3
  },
  TIER_15_21: {
    id: 'TIER_15_21',
    label: '15 a 21 días vencidos',
    shortLabel: '15–21d',
    minDays: 15,
    maxDays: 21,
    ratePct: 1
  },
  TIER_GT_21: {
    id: 'TIER_GT_21',
    label: 'Mayor a 21 días vencidos',
    shortLabel: '>21d',
    minDays: 22,
    maxDays: Infinity,
    ratePct: 0
  }
};

export const MOTORVEN_TIER_ORDER = ['TIER_0_7', 'TIER_8_14', 'TIER_15_21', 'TIER_GT_21'];

const normalizeTextToken = (val) =>
  String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const normalizeSellerCode = (val) =>
  normalizeTextToken(val)
    .replace(/^usr-seller-/i, '')
    .replace(/^usr-/i, '');

const extractPrefixCode = (rawVal) => {
  const s = normalizeTextToken(rawVal);
  if (!s) return '';
  // Formato "CM - Carlos Mendez" o "04: Juan Perez" o "CM|Nombre"
  const delimMatch = s.match(/^([a-z0-9_-]{1,10})\s*(?:[-:|])\s+.+$/i);
  if (delimMatch) return normalizeSellerCode(delimMatch[1]);
  // Si todo el valor es un código corto sin espacios
  if (!/\s/.test(s) && s.length <= 12) return normalizeSellerCode(s);
  return '';
};

const canonicalDocLookupKey = (rawDocNum, rawTipoDoc = '') => {
  const s = String(rawDocNum || '').trim().toUpperCase();
  if (!s) return '';
  const tipoUp = String(rawTipoDoc || '').trim().toUpperCase();
  const isNe =
    tipoUp === 'NOTA_ENTREGA' ||
    tipoUp === 'NE' ||
    tipoUp === 'N/E' ||
    /^NE-|^NDE-/.test(s);
  const digits = s.replace(/^(FAC-|FACT-|NE-|NDE-)/i, '').replace(/\D/g, '');
  const cleanCore = digits ? String(parseInt(digits, 10) || 0) : s;
  return `${isNe ? 'NE' : 'FAC'}:${cleanCore}`;
};

/**
 * Normaliza `montoUsd` de registros en `profit_collections` cuando el campo fue guardado
 * erróneamente igual a `montoBs` pese a existir `tasa > 10`.
 */
export function normalizeProfitCollectionUsd(col) {
  if (!col || typeof col !== 'object') return 0;
  const rawUsd = Number(col.montoUsd ?? col.monto_usd ?? 0);
  const rawBs = Number(col.montoBs ?? col.monto_bs ?? 0);
  const tasa = Number(col.tasaPago ?? col.tasa_pago ?? col.tasa ?? 0);
  if (tasa > 10 && rawBs > 0 && (rawUsd === 0 || Math.abs(rawUsd - rawBs) < 0.05)) {
    return round2(rawBs / tasa);
  }
  return round2(rawUsd);
}

/**
 * Comparación estricta anti-colisión para códigos cortos de 2-3 letras (OF, CM, MS, etc.)
 * y nombres completos normalizados entre un vendedor/cobrador y un registro o campo.
 */
export function matchesSeller(seller, fieldOrDoc) {
  if (!seller || fieldOrDoc === null || fieldOrDoc === undefined || fieldOrDoc === '') return false;

  const targetCode = normalizeSellerCode(
    typeof seller === 'string'
      ? seller
      : (seller.coVen ?? seller.co_ven ?? seller.codigo ?? seller.vendedorCoVen ?? seller.id ?? '')
  );
  const targetName = normalizeTextToken(
    typeof seller === 'string'
      ? ''
      : (seller.venDes ?? seller.ven_des ?? seller.nombre ?? '')
  );

  const codeCandidates = [];
  const nameCandidates = [];

  const collectValue = (val, isCodeField = false) => {
    if (!val && val !== 0) return;
    const rawNorm = normalizeTextToken(val);
    if (!rawNorm) return;
    if (isCodeField) {
      codeCandidates.push(normalizeSellerCode(rawNorm));
    }
    const prefixed = extractPrefixCode(val);
    if (prefixed) {
      codeCandidates.push(prefixed);
    }
    // Si tiene texto descriptivo, extraer nombre después del separador o valor completo
    const afterSep = rawNorm.replace(/^[a-z0-9_-]{1,10}\s*(?:[-:|])\s+/, '').trim();
    if (afterSep && /\s/.test(afterSep)) {
      nameCandidates.push(afterSep);
    } else if (rawNorm.length > 3 && !/^[a-z0-9_-]+$/.test(rawNorm)) {
      nameCandidates.push(rawNorm);
    } else if (!isCodeField && rawNorm.length >= 5) {
      nameCandidates.push(rawNorm);
    }
  };

  if (typeof fieldOrDoc === 'object' && !Array.isArray(fieldOrDoc)) {
    collectValue(fieldOrDoc.vendedorCoVen, true);
    collectValue(fieldOrDoc.codigoVendedor, true);
    collectValue(fieldOrDoc.co_ven, true);
    collectValue(fieldOrDoc.coVen, true);
    collectValue(fieldOrDoc.vendedorId, true);
    collectValue(fieldOrDoc.vendedorAsignado, true);
    collectValue(fieldOrDoc.vendedorNombre, false);
    collectValue(fieldOrDoc.venDes, false);
    collectValue(fieldOrDoc.ven_des, false);
    collectValue(fieldOrDoc.vendedor, false);
  } else {
    collectValue(fieldOrDoc, extractPrefixCode(fieldOrDoc).length > 0 && !/\s/.test(String(fieldOrDoc).trim()));
  }

  // 1. Coincidencia exacta por código (sin .includes sobre códigos cortos)
  if (targetCode) {
    for (const c of codeCandidates) {
      if (c && c === targetCode) return true;
    }
  }

  // 2. Coincidencia por nombre completo normalizado (evitar falsos positivos si hay código distinto explícito)
  if (targetName) {
    const hasExplicitDifferentCode =
      Boolean(targetCode) &&
      codeCandidates.some((c) => c && c.length <= 6 && c !== targetCode);
    if (!hasExplicitDifferentCode) {
      for (const n of nameCandidates) {
        if (!n) continue;
        if (n === targetName) return true;
        if (targetName.length >= 6 && n.length >= 6 && (n.includes(targetName) || targetName.includes(n))) {
          return true;
        }
      }
    }
  }

  return false;
}

export function isDocAnulada(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (doc.anulada || doc.anulado) return true;
  const st = String(doc.status ?? doc.estado ?? '').toUpperCase().trim();
  return st === 'ANULADA' || st === 'ANULADO';
}

export function isNotaEntregaDoc(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const tipo = String(doc.tipoDoc ?? doc.tipo_doc ?? '').toUpperCase().trim();
  const num = String(doc.factNum ?? doc.fact_num ?? doc.numeroDoc ?? doc.nroDoc ?? doc.id ?? '').toUpperCase().trim();
  return tipo === 'NOTA_ENTREGA' || tipo === 'NE' || tipo === 'N/E' || /^NE-|^NDE-/.test(num);
}

export function isDocEligibleForCommission(doc) {
  if (!doc || isDocAnulada(doc)) return false;
  const tipo = String(doc.tipoDoc ?? doc.tipo_doc ?? 'FACTURA').toUpperCase().trim();
  if (
    tipo === 'NOTA_CREDITO' ||
    tipo === 'N/CR' ||
    tipo === 'NC' ||
    tipo === 'COTIZACION' ||
    tipo === 'SOLICITUD_CLIENTE'
  ) {
    return false;
  }
  return true;
}

export function isDocFullyPaid(doc) {
  if (!isDocEligibleForCommission(doc)) return false;
  const rawSaldo = doc.saldoUsd ?? doc.saldo_usd ?? doc.restanteUsd;
  if (rawSaldo !== undefined && rawSaldo !== null && rawSaldo !== '') {
    return Number(rawSaldo) <= 0.01;
  }
  const st = String(doc.status ?? doc.estado ?? '').toUpperCase().trim();
  return st === 'COBRADA' || st === 'PAGADO' || st === 'PAGADA';
}

function isSyntheticCommissionItem(it) {
  const sku = String(it?.articuloId || it?.codigo || it?.id || '').trim().toUpperCase();
  return sku === 'LUB-MANUAL' || sku === 'NE-DESP';
}

function resolveCommissionItemLitros(it) {
  if (!it || typeof it !== 'object') return 0;
  const desc = String(it.descripcion || it.nombre || '').toLowerCase();
  const sku = String(it.articuloId || it.codigo || it.id || '').trim();
  if (desc.includes('flete') || desc.includes('servicio') || sku === '101815' || sku === 'GNP001') {
    return 0;
  }
  if (isSyntheticCommissionItem(it)) {
    return Number(it.litrosTotales ?? it.litros_totales ?? it.litros ?? 0) || 0;
  }
  const qty = Math.max(0, Number(it.cantidad ?? it.qty ?? 0) || 0);
  const unit = String(it.unidad || it.unidadVenta || '').toLowerCase();
  const isGranel = sku === '000003' || desc.includes('granel') || unit === 'litros' || unit === 'litro';
  if (isGranel) return round2(qty);
  const explicitUnitL = Number(it.litrosUnitarios ?? it.litros_unitarios ?? it.litrosPorUnidad ?? it.litros_por_unidad ?? 0);
  const unitL = (explicitUnitL > 0 && explicitUnitL !== 19)
    ? explicitUnitL
    : (desc.includes('paila') || unit === 'paila' ? 19 : (desc.includes('tambor') || unit === 'tambor' ? 208 : 11.35));
  if (qty > 0 && unitL > 0) return round2(qty * unitL);
  return round2(Number(it.litrosTotales ?? it.litros_totales ?? it.litros ?? 0) || 0);
}

export function resolveInvoiceLitros(inv) {
  if (!inv || typeof inv !== 'object') return 0;
  const headerLitros = Number(inv.totalLitros ?? inv.total_litros ?? 0);
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    const hasRealItems = inv.items.some(it => it && !isSyntheticCommissionItem(it));
    const sum = inv.items.reduce((acc, it) => acc + resolveCommissionItemLitros(it), 0);
    if (hasRealItems && sum > 0) return round2(sum);
    if (headerLitros > 0) return round2(headerLitros);
    return round2(sum);
  }
  if (headerLitros > 0) return round2(headerLitros);
  return 0;
}

export function resolveInvoiceCajas(inv) {
  if (!inv || typeof inv !== 'object') return 0;
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    const hasRealItems = inv.items.some(it => it && !isSyntheticCommissionItem(it));
    if (hasRealItems) {
      const litros = resolveInvoiceLitros(inv);
      if (litros > 0) return round2(litros / 11.35);
    }
  }
  const headerCajas = Number(inv.totalCajas ?? inv.total_cajas ?? inv.totalUnidades ?? inv.total_unidades ?? 0);
  if (headerCajas > 0) return round2(headerCajas);
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    const sum = inv.items.reduce((acc, it) => acc + (Number(it?.cantidad || 0) || 0), 0);
    return round2(sum);
  }
  return 0;
}

/**
 * Retorna la base imponible en USD estrictamente SIN IVA (ni IGTF) para cálculo de comisión.
 */
export function resolveBaseSinIvaUsd(doc) {
  if (!doc || typeof doc !== 'object') return 0;
  const bruto = Number(
    doc.totBrutoUsd ?? doc.tot_bruto_usd ?? doc.totalBrutoUsd ?? doc.subtotalUsd ?? doc.subtotal_usd ?? 0
  );
  const neto = Number(
    doc.totNetoUsd ?? doc.tot_neto_usd ?? doc.totalNetoUsd ?? doc.totalUsd ?? doc.montoFacturaUsd ?? 0
  );
  const iva = Number(doc.ivaUsd ?? doc.iva_usd ?? 0);
  const igtf = Number(doc.igtfUsd ?? doc.igtf_usd ?? 0);

  if (isNotaEntregaDoc(doc)) {
    if (bruto > 0) return round2(bruto);
    return round2(Math.max(0, neto - igtf));
  }

  if (bruto > 0) return round2(bruto);
  if (neto > 0 && iva > 0) {
    return round2(Math.max(0, neto - iva - igtf));
  }
  if (neto > 0) {
    // Factura importada sin desglose de base/IVA: descontar alícuota general 16%
    return round2(Math.max(0, neto - igtf) / 1.16);
  }
  return 0;
}

/**
 * Extrae el inicio del día calendario (UTC midnight) respetando la zona horaria Venezuela
 * para fechas con hora y evitando desfases en fechas ISO YYYY-MM-DD o DD/MM/YYYY.
 */
export function startOfDayUtcMs(dateInput) {
  if (!dateInput) return NaN;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return NaN;
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateInput);
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  const str = String(dateInput).trim();
  if (!str) return NaN;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{4}-\d{2}-\d{2}[T\s]00:00:00/.test(str)) {
      const [y, m, d] = str.slice(0, 10).split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    }
  }
  const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return Date.UTC(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
  }
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return NaN;
  const veKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(parsed);
  const [y, m, d] = veKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Construye un índice rápido docKey -> fecha máxima de cobro (string) a partir de `profit_collections`.
 */
export function buildCollectionDateIndex(collections = []) {
  const index = new Map();
  (Array.isArray(collections) ? collections : []).forEach((col) => {
    if (!col || col.anulado) return;
    const colDate = col.fecha || col.fec_cob || '';
    const colMs = startOfDayUtcMs(colDate);
    if (!colDate || isNaN(colMs)) return;

    const affected = Array.isArray(col.documentosAfectados)
      ? col.documentosAfectados
      : (Array.isArray(col.documentos_afectados) ? col.documentos_afectados : []);

    const recordCandidateKey = (rawNum, rawTipo = '') => {
      if (!rawNum) return;
      const canon = canonicalDocLookupKey(rawNum, rawTipo);
      const rawKey = `RAW:${String(rawNum).trim().toUpperCase()}`;
      [canon, rawKey].filter(Boolean).forEach((k) => {
        const prev = index.get(k);
        if (!prev || colMs > prev.ms) {
          index.set(k, { date: colDate, ms: colMs });
        }
      });
    };

    affected.forEach((aff) => {
      if (!aff) return;
      recordCandidateKey(aff.factNum || aff.numDoc || aff.nro_doc || aff.nroDoc || aff.numeroDoc, aff.tipoDoc || aff.tipo_doc);
    });

    if (affected.length === 0 && (col.factNum || col.fact_num || col.nroDoc)) {
      recordCandidateKey(col.factNum || col.fact_num || col.nroDoc, col.tipoDoc || col.tipo_doc);
    }
  });
  return index;
}

export function resolveDocFullPaymentDate(doc, collectionIndex = null) {
  if (!doc || typeof doc !== 'object') return null;
  const direct =
    doc.fechaCobroTotal ||
    doc.fecha_cobro_total ||
    doc.fechaUltimoCobro ||
    doc.fecha_ultimo_cobro;
  if (direct) return direct;

  const docNum = doc.factNum ?? doc.fact_num ?? doc.numeroDoc ?? doc.nroDoc ?? doc.id;
  const docTipo = doc.tipoDoc ?? doc.tipo_doc ?? '';

  if (collectionIndex instanceof Map && docNum) {
    const canon = canonicalDocLookupKey(docNum, docTipo);
    const rawKey = `RAW:${String(docNum).trim().toUpperCase()}`;
    const hit = collectionIndex.get(canon) || collectionIndex.get(rawKey);
    if (hit?.date) return hit.date;
  }

  const historial = Array.isArray(doc.historialCobros) ? doc.historialCobros : (Array.isArray(doc.historial_cobros) ? doc.historial_cobros : []);
  if (historial.length > 0) {
    let best = null;
    let bestMs = -Infinity;
    historial.forEach((h) => {
      const d = h?.fecha || h?.fec_cob || '';
      const ms = startOfDayUtcMs(d);
      if (d && !isNaN(ms) && ms > bestMs) {
        bestMs = ms;
        best = d;
      }
    });
    if (best) return best;
  }

  // Si fue venta de CONTADO sin cobro separado registrado, la fecha de emisión es la fecha de pago (0 días vencidos)
  const diasCred = Number(doc.diasCredito ?? doc.dias_credito ?? 0);
  const condUp = String(doc.condicionPago ?? doc.condicion_pago ?? '').toUpperCase().trim();
  if (condUp === 'CONTADO' || diasCred <= 0) {
    return doc.fechaEmision || doc.fec_emis || doc.fecha || null;
  }

  return doc.fechaEmision || doc.fec_emis || doc.fecha || doc.fechaVencimiento || doc.fec_venc || null;
}

export function calculateOverdueDays(fechaVencimiento, fechaPagoTotal) {
  const dueMs = startOfDayUtcMs(fechaVencimiento);
  const payMs = startOfDayUtcMs(fechaPagoTotal);
  if (isNaN(dueMs) || isNaN(payMs)) return 0;
  return Math.max(0, Math.floor((payMs - dueMs) / 86400000));
}

export function getMotorvenCommissionRateByOverdueDays(diasVencidos) {
  const days = Math.max(0, Number(diasVencidos || 0));
  if (days <= 7) return { tier: MOTORVEN_COMMISSION_TIERS.TIER_0_7, ratePct: 4 };
  if (days <= 14) return { tier: MOTORVEN_COMMISSION_TIERS.TIER_8_14, ratePct: 3 };
  if (days <= 21) return { tier: MOTORVEN_COMMISSION_TIERS.TIER_15_21, ratePct: 1 };
  return { tier: MOTORVEN_COMMISSION_TIERS.TIER_GT_21, ratePct: 0 };
}

/**
 * Calcula la comisión oficial MOTORVEN de un documento individual.
 */
export function calculateDocumentCommission(doc, { collections = [], collectionIndex = null, tasaBcv = 1 } = {}) {
  const eligible = isDocEligibleForCommission(doc);
  const fullyPaid = eligible && isDocFullyPaid(doc);
  const baseSinIvaUsd = eligible ? resolveBaseSinIvaUsd(doc) : 0;
  const isNe = isNotaEntregaDoc(doc);
  const fechaEmision = doc?.fechaEmision || doc?.fec_emis || doc?.fecha || null;
  const fechaVencimiento = doc?.fechaVencimiento || doc?.fec_venc || fechaEmision;
  const resolvedIndex = collectionIndex || (Array.isArray(collections) && collections.length > 0 ? buildCollectionDateIndex(collections) : null);

  if (!fullyPaid) {
    return {
      eligible,
      fullyPaid: false,
      isNotaEntrega: isNe,
      tipoDoc: isNe ? 'NOTA_ENTREGA' : 'FACTURA',
      baseSinIvaUsd,
      fechaEmision,
      fechaVencimiento,
      fechaPagoTotal: null,
      diasVencidos: null,
      tier: null,
      ratePct: 0,
      comisionUsd: 0,
      comisionBs: 0
    };
  }

  const fechaPagoTotal = resolveDocFullPaymentDate(doc, resolvedIndex);
  const diasVencidos = calculateOverdueDays(fechaVencimiento, fechaPagoTotal);
  const { tier, ratePct } = getMotorvenCommissionRateByOverdueDays(diasVencidos);
  const comisionUsd = round2(baseSinIvaUsd * (ratePct / 100));
  const safeRate = Number(tasaBcv || 1) > 0 ? Number(tasaBcv) : 1;

  return {
    eligible: true,
    fullyPaid: true,
    isNotaEntrega: isNe,
    tipoDoc: isNe ? 'NOTA_ENTREGA' : 'FACTURA',
    baseSinIvaUsd,
    fechaEmision,
    fechaVencimiento,
    fechaPagoTotal,
    diasVencidos,
    tier,
    ratePct,
    comisionUsd,
    comisionBs: round2(comisionUsd * safeRate)
  };
}

/**
 * Consolida el cuadro completo de comisiones MOTORVEN para un Cobrador/Vendedor:
 * - Comisiones devengadas reales sobre documentos 100% pagados desglosadas en los 4 tramos oficiales.
 * - Proyección al día (0 días vencidos = 4% base sin IVA) sobre documentos vigentes aún sin vencer.
 */
export function calculateSellerCommissionSummary(
  seller,
  { invoices = [], collections = [], returns = [], tasaBcv = 1, asOfDate = new Date() } = {}
) {
  const safeRate = Number(tasaBcv || 1) > 0 ? Number(tasaBcv) : 1;
  const collectionIndex = buildCollectionDateIndex(collections);

  // Indexar devoluciones vigentes por número de factura / NE afectada para descontar base sin IVA
  const returnedBaseByDocKey = new Map();
  let unmatchedReturnedBaseUsd = 0;
  (Array.isArray(returns) ? returns : []).forEach((ret) => {
    if (!ret || isDocAnulada(ret)) return;
    if (seller && !matchesSeller(seller, ret)) return;
    const baseRet = round2(Number(ret.totBruto ?? ret.tot_bruto ?? ret.totNeto ?? ret.tot_neto ?? 0));
    if (!(baseRet > 0)) return;
    const refKey = String(ret.factNum || ret.fact_num || ret.documentoAfectado || '').trim().toUpperCase().replace(/^(FAC-|FACT-|NE-|NDE-)/i, '').replace(/^0+(?=\d)/, '');
    if (refKey) {
      returnedBaseByDocKey.set(refKey, round2((returnedBaseByDocKey.get(refKey) || 0) + baseRet));
    } else {
      unmatchedReturnedBaseUsd = round2(unmatchedReturnedBaseUsd + baseRet);
    }
  });

  const tiers = {};
  MOTORVEN_TIER_ORDER.forEach((tierId) => {
    const meta = MOTORVEN_COMMISSION_TIERS[tierId];
    tiers[tierId] = {
      ...meta,
      docsCount: 0,
      facturasCount: 0,
      notasEntregaCount: 0,
      baseSinIvaUsd: 0,
      comisionUsd: 0,
      comisionBs: 0,
      docs: []
    };
  });

  const sellerDocs = (Array.isArray(invoices) ? invoices : []).filter(
    (inv) => isDocEligibleForCommission(inv) && (!seller || matchesSeller(seller, inv))
  );

  let basePagadaSinIvaUsd = 0;
  let totalComisionUsd = 0;
  let paidDocsCount = 0;
  let paidFacturasCount = 0;
  let paidNotasCount = 0;
  let pendingDocsCount = 0;
  let projectedAlDiaBaseUsd = 0;
  const paidDocs = [];
  const pendingDocs = [];

  sellerDocs.forEach((doc) => {
    const res = calculateDocumentCommission(doc, { collectionIndex, tasaBcv: safeRate });
    if (!res.eligible) return;

    const docCleanKey = String(doc.factNum || doc.numeroDoc || doc.nroDoc || doc.id || '')
      .trim()
      .toUpperCase()
      .replace(/^(FAC-|FACT-|NE-|NDE-)/i, '')
      .replace(/^0+(?=\d)/, '');
    const returnedForDoc = docCleanKey ? (returnedBaseByDocKey.get(docCleanKey) || 0) : 0;
    const effectiveBaseSinIvaUsd = Math.max(0, round2(res.baseSinIvaUsd - returnedForDoc));
    const effectiveComisionUsd = res.tier ? round2(effectiveBaseSinIvaUsd * (res.ratePct / 100)) : 0;
    const effectiveComisionBs = round2(effectiveComisionUsd * safeRate);

    if (res.fullyPaid && res.tier) {
      const bucket = tiers[res.tier.id];
      bucket.docsCount += 1;
      if (res.isNotaEntrega) {
        bucket.notasEntregaCount += 1;
        paidNotasCount += 1;
      } else {
        bucket.facturasCount += 1;
        paidFacturasCount += 1;
      }
      bucket.baseSinIvaUsd = round2(bucket.baseSinIvaUsd + effectiveBaseSinIvaUsd);
      bucket.comisionUsd = round2(bucket.comisionUsd + effectiveComisionUsd);
      bucket.comisionBs = round2(bucket.comisionUsd * safeRate);

      const docDetail = {
        id: doc.id,
        factNum: doc.factNum || doc.numeroDoc || doc.nroDoc || doc.id,
        tipoDoc: res.tipoDoc,
        clienteNombre: doc.clienteNombre || doc.cliente || 'Cliente Comercial',
        fechaEmision: res.fechaEmision,
        fechaVencimiento: res.fechaVencimiento,
        fechaPagoTotal: res.fechaPagoTotal,
        diasVencidos: res.diasVencidos,
        tierId: res.tier.id,
        tierLabel: res.tier.label,
        ratePct: res.ratePct,
        baseSinIvaUsd: effectiveBaseSinIvaUsd,
        comisionUsd: effectiveComisionUsd,
        comisionBs: effectiveComisionBs
      };
      bucket.docs.push(docDetail);
      paidDocs.push(docDetail);

      paidDocsCount += 1;
      basePagadaSinIvaUsd = round2(basePagadaSinIvaUsd + effectiveBaseSinIvaUsd);
      totalComisionUsd = round2(totalComisionUsd + effectiveComisionUsd);
    } else {
      pendingDocsCount += 1;
      const dueDate = doc.fechaVencimiento || doc.fec_venc || doc.fechaEmision || doc.fec_emis;
      const overdueAsOfToday = calculateOverdueDays(dueDate, asOfDate);
      const { ratePct: projectedRatePct } = getMotorvenCommissionRateByOverdueDays(overdueAsOfToday);
      if (overdueAsOfToday === 0) {
        projectedAlDiaBaseUsd = round2(projectedAlDiaBaseUsd + effectiveBaseSinIvaUsd);
      }
      pendingDocs.push({
        id: doc.id,
        factNum: doc.factNum || doc.numeroDoc || doc.nroDoc || doc.id,
        tipoDoc: res.tipoDoc,
        baseSinIvaUsd: effectiveBaseSinIvaUsd,
        saldoUsd: round2(Number(doc.saldoUsd ?? doc.restanteUsd ?? 0)),
        diasVencidosActual: overdueAsOfToday,
        projectedRatePct
      });
    }
  });

  if (unmatchedReturnedBaseUsd > 0) {
    basePagadaSinIvaUsd = Math.max(0, round2(basePagadaSinIvaUsd - unmatchedReturnedBaseUsd));
    totalComisionUsd = Math.max(0, round2(totalComisionUsd - unmatchedReturnedBaseUsd * 0.04));
  }

  const projectedAlDiaComisionUsd = round2(projectedAlDiaBaseUsd * 0.04);

  return {
    basePagadaSinIvaUsd,
    totalComisionUsd,
    totalComisionBs: round2(totalComisionUsd * safeRate),
    paidDocsCount,
    paidFacturasCount,
    paidNotasCount,
    pendingDocsCount,
    projectedAlDiaBaseUsd,
    projectedAlDiaComisionUsd,
    projectedAlDiaComisionBs: round2(projectedAlDiaComisionUsd * safeRate),
    tiers,
    tierList: MOTORVEN_TIER_ORDER.map((id) => tiers[id]),
    paidDocs,
    pendingDocs
  };
}

/**
 * Comisión estimada en tiempo real del pedido/carrito actual (4% al día 0–7 días, base sin IVA).
 */
export function calculateProjectedOrderCommission({ subtotalUsd = 0, tasaBcv = 1 } = {}) {
  const baseSinIvaUsd = round2(Math.max(0, Number(subtotalUsd || 0)));
  const safeRate = Number(tasaBcv || 1) > 0 ? Number(tasaBcv) : 1;
  const comisionUsd = round2(baseSinIvaUsd * 0.04);
  return {
    baseSinIvaUsd,
    ratePct: 4,
    comisionUsd,
    comisionBs: round2(comisionUsd * safeRate)
  };
}

/**
 * Cuenta los meses distintos (YYYY-MM) con movimientos reales para calcular la meta en filtro 'ALL'.
 */
export function countDistinctActiveMonths(invoices = [], collections = []) {
  const months = new Set();
  const addDate = (raw) => {
    if (!raw) return;
    const ms = startOfDayUtcMs(raw);
    if (isNaN(ms)) return;
    const d = new Date(ms);
    months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  (Array.isArray(invoices) ? invoices : []).forEach((inv) => {
    if (isDocAnulada(inv)) return;
    addDate(inv?.fechaEmision || inv?.fec_emis || inv?.fecha);
  });
  (Array.isArray(collections) ? collections : []).forEach((col) => {
    if (!col || col.anulado) return;
    addDate(col?.fecha || col?.fec_cob);
  });
  return Math.max(1, months.size);
}

const SALES_DEPARTMENT_VALUES = new Set([
  'VEN',
  'VENTAS',
  'COMERCIAL & VENTAS',
  'COMERCIAL Y VENTAS',
  'FUERZA DE VENTAS'
]);

/**
 * Determina estrictamente si un usuario pertenece al departamento de Ventas (VEN).
 * Respeta el campo `departamento` configurado en Gestión de Usuarios: usuarios de
 * Cobranza/Administración (`ADM`), Gerencia (`DIR`), Operaciones (`OPE`) o TI (`TI`)
 * quedan excluidos de Fuerza de Ventas aunque compartan nombre con un asesor.
 */
export function isSalesDepartmentUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.activo === false || user.active === false) return false;

  const uname = String(user.username || '').trim().toLowerCase();
  const uid = String(user.id || '').trim().toLowerCase();
  if (/^autotest_/i.test(uname) || /^usr-autotest-/i.test(uid)) return false;

  const rawDept = normalizeTextToken(user.departamento).toUpperCase();
  if (rawDept) {
    return SALES_DEPARTMENT_VALUES.has(rawDept);
  }

  // Fallback únicamente cuando el registro no tiene campo `departamento` configurado
  const rawRol = normalizeTextToken(user.rol || user.role).toUpperCase();
  return rawRol === 'VENTAS' || rawRol === 'VENDEDOR';
}

/**
 * Construye la lista oficial de asesores visibles en el módulo Fuerza de Ventas,
 * tomando EXCLUSIVAMENTE los usuarios activos configurados en el departamento de Ventas
 * y enriqueciéndolos con su metadata comercial de `profit_sellers` (zona, meta, % comisión, etc.)
 * sin contaminar fotos ni incluir registros ajenos (p.ej. usuarios de Cobranza o vendedores legacy).
 */
export function buildSalesDepartmentSellers(usersList = [], profitSellers = []) {
  const safeUsers = Array.isArray(usersList) ? usersList.filter(Boolean) : [];
  const safeProfit = Array.isArray(profitSellers) ? profitSellers.filter(Boolean) : [];

  const cleanCodeToken = (raw) =>
    String(raw || '')
      .trim()
      .replace(/^usr-seller-/i, '')
      .trim()
      .toUpperCase();

  // Indexar metadata comercial de profit_sellers deduplicada por código limpio y nombre normalizado
  const profitByCode = new Map();
  const profitByName = new Map();
  const allProfitCodes = new Set();

  safeProfit.forEach((s) => {
    const rawCode = String(s.coVen || s.co_ven || s.id || '').trim();
    const cleanCode = cleanCodeToken(rawCode);
    const name = String(s.venDes || s.ven_des || s.nombre || '').trim();
    if ((!name && !cleanCode) || cleanCode.startsWith('USR-')) return;

    const nameKey = normalizeTextToken(name);
    const codeKey = cleanCode || nameKey.toUpperCase();
    const existing = profitByCode.get(codeKey);
    const rawIsPrefixed = /^usr-seller-/i.test(rawCode);
    const existingIsPrefixed = existing ? /^usr-seller-/i.test(String(existing.coVen || existing.co_ven || '')) : false;

    const preservedFoto = s.foto || existing?.foto || '';
    const preservedAvatar = s.avatar || existing?.avatar || '';

    if (!existing || (existingIsPrefixed && !rawIsPrefixed)) {
      const merged = {
        ...(existing || {}),
        ...s,
        id: s.id && !/^usr-seller-/i.test(String(s.id)) ? s.id : (cleanCode || s.id),
        coVen: cleanCode || existing?.coVen || '',
        co_ven: cleanCode || existing?.co_ven || '',
        venDes: name || existing?.venDes || cleanCode,
        ven_des: name || existing?.ven_des || cleanCode,
        foto: preservedFoto,
        avatar: preservedAvatar,
        coZon: s.coZon || s.co_zon || existing?.coZon || '',
        co_zon: s.coZon || s.co_zon || existing?.co_zon || '',
        zona: s.zona || existing?.zona || '',
        metaLitrosMes: Number(s.metaLitrosMes ?? s.meta_litros_mes ?? existing?.metaLitrosMes ?? 3000),
        comisionPct: Number(s.comisionPct ?? s.comision_pct ?? existing?.comisionPct ?? 3.0)
      };
      profitByCode.set(codeKey, merged);
      if (cleanCode) allProfitCodes.add(cleanCode);
      if (nameKey && !profitByName.has(nameKey)) {
        profitByName.set(nameKey, merged);
      } else if (nameKey && existingIsPrefixed && !rawIsPrefixed) {
        profitByName.set(nameKey, merged);
      }
    } else if (preservedFoto && !existing.foto) {
      const updated = { ...existing, foto: preservedFoto, avatar: preservedAvatar || existing.avatar };
      profitByCode.set(codeKey, updated);
      if (nameKey && profitByName.get(nameKey)?.coVen === existing.coVen) {
        profitByName.set(nameKey, updated);
      }
    }
  });

  // Fallback defensivo únicamente si no existe listado de usuarios cargado
  if (safeUsers.length === 0) {
    return Array.from(profitByCode.values());
  }

  // Recopilar fotos y nombres de usuarios fuera del departamento Ventas para evitar contaminación cruzada
  const nonSalesPhotos = new Set();
  const nonSalesNames = new Set();
  const salesUsers = [];

  safeUsers.forEach((u) => {
    if (isSalesDepartmentUser(u)) {
      salesUsers.push(u);
    } else {
      const uPhoto = u.foto || u.photo_url || u.photoUrl || '';
      if (uPhoto) nonSalesPhotos.add(uPhoto);
      const uNameKey = normalizeTextToken(u.nombre || u.name);
      if (uNameKey) nonSalesNames.add(uNameKey);
    }
  });

  // Reservar primero todos los códigos explícitos de los usuarios de Ventas
  const reservedExplicitCodes = new Set();
  const getExplicitUserCode = (u) => {
    const rawUserCoVen = cleanCodeToken(u.co_ven || u.coVen || u.seller_id || u.sellerId || '');
    if (rawUserCoVen && !rawUserCoVen.startsWith('USR-')) return rawUserCoVen;
    const uid = String(u.id || '').trim();
    if (/^usr-seller-/i.test(uid)) {
      const derived = cleanCodeToken(uid);
      if (derived && !derived.startsWith('USR-')) return derived;
    }
    return '';
  };

  salesUsers.forEach((u) => {
    const c = getExplicitUserCode(u);
    if (c) reservedExplicitCodes.add(c);
  });

  const usedCodes = new Set([...allProfitCodes, ...reservedExplicitCodes]);
  const claimedProfitCodes = new Set();

  const genInitialsCode = (nombre) => {
    const words = normalizeTextToken(nombre).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    let base = words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (words[0] || 'VN').slice(0, 2).toUpperCase();
    if (!base || base.length < 2) base = (base || 'VN').padEnd(2, 'X').slice(0, 2);
    if (!usedCodes.has(base)) return base;
    if (words.length >= 2 && words[1].length >= 2) {
      const three = `${words[0][0]}${words[1].slice(0, 2)}`.toUpperCase();
      if (!usedCodes.has(three)) return three;
    }
    if (words.length >= 3) {
      const initials3 = `${words[0][0]}${words[1][0]}${words[2][0]}`.toUpperCase();
      if (!usedCodes.has(initials3)) return initials3;
    }
    for (let i = 2; i < 99; i++) {
      const c = `${base}${i}`;
      if (!usedCodes.has(c)) return c;
    }
    return `${base}${Date.now().toString(36).slice(-2).toUpperCase()}`;
  };

  const result = [];
  const seenUserKeys = new Set();

  salesUsers.forEach((u) => {
    const uName = String(u.nombre || u.name || u.username || '').trim();
    const uNameKey = normalizeTextToken(uName);
    const uname = String(u.username || '').trim();
    const uid = String(u.id || '').trim();
    const dedupeKey = uid || uname.toLowerCase() || uNameKey;
    if (dedupeKey && seenUserKeys.has(dedupeKey)) return;
    if (dedupeKey) seenUserKeys.add(dedupeKey);

    const explicitCode = getExplicitUserCode(u);

    // 1. Buscar metadata en profit_sellers por código explícito primero
    let matchedProfit = explicitCode && profitByCode.has(explicitCode)
      ? profitByCode.get(explicitCode)
      : null;

    // 2. Si el usuario no tiene código explícito, buscar por nombre exacto no reclamado
    if (!matchedProfit && !explicitCode && uNameKey && profitByName.has(uNameKey)) {
      const byNameCandidate = profitByName.get(uNameKey);
      const candCode = cleanCodeToken(byNameCandidate?.coVen || byNameCandidate?.co_ven || byNameCandidate?.id);
      if (
        candCode &&
        !claimedProfitCodes.has(candCode) &&
        !reservedExplicitCodes.has(candCode)
      ) {
        matchedProfit = byNameCandidate;
      }
    }

    const matchedCode = matchedProfit
      ? cleanCodeToken(matchedProfit.coVen || matchedProfit.co_ven || matchedProfit.id)
      : '';

    const assignedCode = explicitCode || matchedCode || genInitialsCode(uName || uname);
    usedCodes.add(assignedCode);
    if (matchedCode) claimedProfitCodes.add(matchedCode);

    const userPhoto = u.foto || u.photo_url || u.photoUrl || '';
    const profitPhoto = matchedProfit?.foto || '';
    // Nunca heredar una foto de profit_sellers que pertenezca a un usuario de otro departamento (ej. Cobranza)
    const safeProfitPhoto = profitPhoto && !nonSalesPhotos.has(profitPhoto)
      ? (nonSalesNames.has(normalizeTextToken(matchedProfit?.venDes)) && !explicitCode ? '' : profitPhoto)
      : '';

    const resolvedCoZon = matchedProfit?.coZon || matchedProfit?.co_zon || '';
    const resolvedZona = matchedProfit?.zona || '';

    result.push({
      ...(matchedProfit || {}),
      id: assignedCode,
      coVen: assignedCode,
      co_ven: assignedCode,
      venDes: uName || matchedProfit?.venDes || assignedCode,
      ven_des: uName || matchedProfit?.ven_des || assignedCode,
      cedula: u.cedula || matchedProfit?.cedula || '',
      telefonos: u.telefono || u.phone || matchedProfit?.telefonos || '',
      direccion: matchedProfit?.direccion || '',
      tipo: matchedProfit?.tipo || 'A',
      comisionPct: Number(matchedProfit?.comisionPct ?? matchedProfit?.comision_pct ?? 3.0),
      metaLitrosMes: Number(matchedProfit?.metaLitrosMes ?? matchedProfit?.meta_litros_mes ?? 3000),
      activo: true,
      foto: userPhoto || safeProfitPhoto || '',
      avatar: u.avatar || matchedProfit?.avatar || '',
      coZon: resolvedCoZon,
      co_zon: resolvedCoZon,
      zona: resolvedZona,
      userId: uid,
      username: uname,
      departamento: 'VEN',
      rol: u.rol || u.role || 'VENTAS'
    });
  });

  return result;
}
