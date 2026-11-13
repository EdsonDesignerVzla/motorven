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

export function resolveInvoiceLitros(inv) {
  if (!inv || typeof inv !== 'object') return 0;
  const headerLitros = Number(inv.totalLitros ?? inv.total_litros ?? 0);
  if (headerLitros > 0) return round2(headerLitros);
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    const sum = inv.items.reduce((acc, it) => {
      if (!it) return acc;
      const lineLitros = Number(
        it.litrosTotales ??
          it.litros_totales ??
          it.litros ??
          (Number(it.litrosUnitarios ?? it.litros_unitarios ?? it.litrosPorUnidad ?? it.litros_por_unidad ?? 0) *
            Number(it.cantidad || 0))
      );
      return acc + (Number.isFinite(lineLitros) ? lineLitros : 0);
    }, 0);
    return round2(sum);
  }
  return 0;
}

export function resolveInvoiceCajas(inv) {
  if (!inv || typeof inv !== 'object') return 0;
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
  { invoices = [], collections = [], tasaBcv = 1, asOfDate = new Date() } = {}
) {
  const safeRate = Number(tasaBcv || 1) > 0 ? Number(tasaBcv) : 1;
  const collectionIndex = buildCollectionDateIndex(collections);

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
      bucket.baseSinIvaUsd = round2(bucket.baseSinIvaUsd + res.baseSinIvaUsd);
      bucket.comisionUsd = round2(bucket.comisionUsd + res.comisionUsd);
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
        baseSinIvaUsd: res.baseSinIvaUsd,
        comisionUsd: res.comisionUsd,
        comisionBs: res.comisionBs
      };
      bucket.docs.push(docDetail);
      paidDocs.push(docDetail);

      paidDocsCount += 1;
      basePagadaSinIvaUsd = round2(basePagadaSinIvaUsd + res.baseSinIvaUsd);
      totalComisionUsd = round2(totalComisionUsd + res.comisionUsd);
    } else {
      pendingDocsCount += 1;
      const dueDate = doc.fechaVencimiento || doc.fec_venc || doc.fechaEmision || doc.fec_emis;
      const overdueAsOfToday = calculateOverdueDays(dueDate, asOfDate);
      const { ratePct: projectedRatePct } = getMotorvenCommissionRateByOverdueDays(overdueAsOfToday);
      if (overdueAsOfToday === 0) {
        projectedAlDiaBaseUsd = round2(projectedAlDiaBaseUsd + res.baseSinIvaUsd);
      }
      pendingDocs.push({
        id: doc.id,
        factNum: doc.factNum || doc.numeroDoc || doc.nroDoc || doc.id,
        tipoDoc: res.tipoDoc,
        baseSinIvaUsd: res.baseSinIvaUsd,
        saldoUsd: round2(Number(doc.saldoUsd ?? doc.restanteUsd ?? 0)),
        diasVencidosActual: overdueAsOfToday,
        projectedRatePct
      });
    }
  });

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
