/**
 * Utilidades centralizadas de clasificación, validación y auditoría inmutable de tasas
 * para POS, CxC, CxP, Caja Chica/Bancos y Reportes PDF.
 *
 * Reglas de Negocio:
 * - Factura Fiscal (FACTURA / FACT): solo permite operar/cobrar/pagar en Tasa BCV ('BCV') o Divisa Directa ('USD').
 * - Nota de Entrega / Documentos sin IVA: habilita selector explícito ('BCV', 'KEYSTONE', 'EDITABLE', 'USD'; y 'EURO' cuando aplica en cobranza).
 */

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

export const STANDARD_RATE_TYPES = ['BCV', 'KEYSTONE', 'EDITABLE', 'USD'];
export const EXTENDED_RATE_TYPES = ['BCV', 'EURO', 'KEYSTONE', 'EDITABLE', 'USD'];

export const RATE_TYPE_META = {
  BCV: {
    id: 'BCV',
    label: 'Tasa BCV',
    shortLabel: 'BCV',
    badgeText: 'BCV',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.35)'
  },
  EURO: {
    id: 'EURO',
    label: 'Tasa Euro',
    shortLabel: 'EURO',
    badgeText: 'EURO',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.35)'
  },
  KEYSTONE: {
    id: 'KEYSTONE',
    label: 'Tasa Keystone',
    shortLabel: 'KEYSTONE',
    badgeText: 'KEYSTONE',
    color: '#818cf8',
    bg: 'rgba(129, 140, 248, 0.15)',
    border: 'rgba(129, 140, 248, 0.40)'
  },
  EDITABLE: {
    id: 'EDITABLE',
    label: 'Tasa Editable / Pers.',
    shortLabel: 'EDITABLE',
    badgeText: 'EDITABLE',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.38)'
  },
  USD: {
    id: 'USD',
    label: 'Divisa Directa USD',
    shortLabel: 'USD',
    badgeText: 'USD',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.14)',
    border: 'rgba(34, 197, 94, 0.38)'
  }
};

export function isFiscalDocumentForRatePolicy(docOrType) {
  if (!docOrType) return false;
  if (typeof docOrType === 'string') {
    const up = docOrType.toUpperCase().trim();
    if (up === 'NE' || up === 'NOTA_ENTREGA' || up === 'ADEL' || up === 'OC' || up === 'COTIZACION' || up === 'PEDIDO') {
      return false;
    }
    return up === 'FACT' || up === 'FACTURA' || up === 'N/DB' || up === 'ND' || up === 'NOTA_DEBITO' || up === 'N/CR' || up === 'NC' || up === 'NOTA_CREDITO';
  }
  const rawTipo = String(docOrType.tipoDoc ?? docOrType.tipo_doc ?? '').toUpperCase().trim();
  const rawNum = String(docOrType.factNum ?? docOrType.fact_num ?? docOrType.nroDoc ?? docOrType.nro_doc ?? docOrType.numeroDoc ?? docOrType.id ?? '').toUpperCase().trim();
  if (rawNum.startsWith('NE-') || rawNum.startsWith('NDE-') || rawTipo === 'NE' || rawTipo === 'NOTA_ENTREGA') {
    return false;
  }
  if (rawTipo === 'ADEL' || rawTipo === 'OC' || rawTipo === 'PEDIDO' || rawTipo === 'COTIZACION') {
    return false;
  }
  if (rawTipo === 'FACT' || rawTipo === 'FACTURA' || rawTipo === 'N/DB' || rawTipo === 'ND' || rawTipo === 'NOTA_DEBITO' || rawTipo === 'N/CR' || rawTipo === 'NC' || rawTipo === 'NOTA_CREDITO') {
    return true;
  }
  return Boolean(docOrType.ivaUsd > 0 || docOrType.iva_usd > 0 || docOrType.aplicaIva === true);
}

export function getAllowedRateTypesForDoc(docOrType, { includeEuro = false } = {}) {
  if (isFiscalDocumentForRatePolicy(docOrType)) {
    return ['BCV', 'USD'];
  }
  return includeEuro ? ['BCV', 'EURO', 'KEYSTONE', 'EDITABLE', 'USD'] : ['BCV', 'KEYSTONE', 'EDITABLE', 'USD'];
}

export function normalizeRateType(rawType, { isFiscal = false, tipoDoc = '', monedaPago = '', fallback = 'BCV' } = {}) {
  const effectiveFiscal = isFiscal || (tipoDoc ? isFiscalDocumentForRatePolicy(tipoDoc) : false);
  const up = String(rawType || '').toUpperCase().trim();

  let resolved = null;
  if (up === 'BCV' || up === 'TASA_BCV' || up === 'TASA BCV' || up === 'OFICIAL') {
    resolved = 'BCV';
  } else if (up === 'KEYSTONE' || up === 'KEY' || up === 'TASA_KEYSTONE' || up === 'TASA KEYSTONE' || up === 'PARALELA') {
    resolved = 'KEYSTONE';
  } else if (up === 'EDITABLE' || up === 'PERSONALIZADA' || up === 'PERSONALIZADO' || up === 'MANUAL' || up === 'CUSTOM' || up === 'TASA_PERSONALIZADA') {
    resolved = 'EDITABLE';
  } else if (up === 'USD' || up === 'US$' || up === 'DIVISA' || up === 'EFECTIVO_USD' || up === 'ZELLE') {
    resolved = 'USD';
  } else if (up === 'EURO' || up === 'EUR' || up === 'TASA_EURO' || up === 'TASA EURO') {
    resolved = 'EURO';
  }

  if (!resolved) {
    const monUp = String(monedaPago || '').toUpperCase().trim();
    if (monUp === 'USD' || monUp === 'US$' || monUp === 'USDT' || monUp === 'USDC') {
      resolved = 'USD';
    } else {
      resolved = fallback || 'BCV';
    }
  }

  if (effectiveFiscal && resolved !== 'USD') {
    return 'BCV';
  }
  return resolved;
}

export function resolveRecordRateType(record, fallback = 'BCV') {
  if (!record || typeof record !== 'object') return fallback;
  const isFiscal = record.tipoDoc || record.tipo_doc || record.factNum || record.fact_num || record.nroDoc || record.nro_doc
    ? isFiscalDocumentForRatePolicy(record)
    : false;
  const rawType = record.tipoTasa ?? record.tipo_tasa ?? '';
  const rawMoneda = record.monedaPago ?? record.moneda_pago ?? record.moneda ?? '';
  if (!rawType && (String(rawMoneda).toUpperCase().includes('USD') || String(rawMoneda).toUpperCase() === 'US$') && Number(record.montoBs ?? record.monto_bs ?? 0) === 0) {
    return 'USD';
  }
  return normalizeRateType(rawType, {
    isFiscal,
    monedaPago: rawMoneda,
    fallback
  });
}

export function resolveRateMeta(rawType, fallback = 'BCV') {
  const key = normalizeRateType(rawType, { fallback });
  return RATE_TYPE_META[key] || RATE_TYPE_META.BCV;
}

export function resolveDefaultRateValue(tipoTasa, { tasaBcv = 1, tasaKeystone = 0, tasaEuro = 0, customRate = 0 } = {}) {
  const normalized = normalizeRateType(tipoTasa, { fallback: 'BCV' });
  const safeBcv = Number(tasaBcv) > 0 ? round2(tasaBcv) : 1;
  const safeKeystone = Number(tasaKeystone) > 0 ? round2(tasaKeystone) : safeBcv;
  const safeEuro = Number(tasaEuro) > 0 ? round2(tasaEuro) : safeBcv;
  if (normalized === 'BCV') return safeBcv;
  if (normalized === 'KEYSTONE') return safeKeystone;
  if (normalized === 'EURO') return safeEuro;
  if (normalized === 'EDITABLE') return Number(customRate) > 0 ? round2(customRate) : safeKeystone;
  if (normalized === 'USD') return 1;
  return safeBcv;
}

export function resolveMonedaPago(tipoTasa, accountOrMoneda = '') {
  const normalized = normalizeRateType(tipoTasa, { fallback: 'BCV' });
  if (normalized === 'USD') return 'USD';
  const monUp = String(accountOrMoneda?.moneda ?? accountOrMoneda ?? '').toUpperCase().trim();
  if (monUp === 'BS' || monUp === 'VES' || monUp === 'BOLIVARES') return 'BS';
  return 'BS';
}

export function resolveEffectiveRateNumber(record, fallbackTasa = 0) {
  if (!record || typeof record !== 'object') return Number(fallbackTasa || 0);
  const explicit = Number(
    record.tasaPago ??
    record.tasa_pago ??
    record.tasaCambio ??
    record.tasa_cambio ??
    record.tasaDolar ??
    record.tasa_dolar ??
    record.tasa ??
    0
  );
  if (explicit > 0) return round2(explicit);
  return round2(fallbackTasa || 0);
}

export function summarizeByRateClassification(records = [], fallbackTasa = 1) {
  const buckets = {};
  EXTENDED_RATE_TYPES.forEach((k) => {
    buckets[k] = {
      tipoTasa: k,
      label: RATE_TYPE_META[k].label,
      count: 0,
      totalUsd: 0,
      totalBs: 0
    };
  });

  let grandUsd = 0;
  let grandBs = 0;

  (Array.isArray(records) ? records : []).forEach((rec) => {
    if (!rec) return;
    const key = resolveRecordRateType(rec, 'BCV');
    const bucket = buckets[key] || buckets.BCV;
    const usd = round2(Number(rec.montoUsd ?? rec.monto_usd ?? rec.saldoUsd ?? rec.saldo_usd ?? rec.totNetoUsd ?? rec.totalUsd ?? 0));
    const rate = resolveEffectiveRateNumber(rec, fallbackTasa);
    const rawBs = Number(rec.montoBs ?? rec.monto_bs ?? rec.saldoBs ?? rec.saldo_bs ?? 0);
    const bs = key === 'USD'
      ? (rawBs > 0 ? round2(rawBs) : 0)
      : (rawBs > 0 ? round2(rawBs) : round2(usd * (rate > 0 ? rate : 1)));

    bucket.count += 1;
    bucket.totalUsd = round2(bucket.totalUsd + usd);
    bucket.totalBs = round2(bucket.totalBs + bs);
    grandUsd = round2(grandUsd + usd);
    grandBs = round2(grandBs + bs);
  });

  const rows = EXTENDED_RATE_TYPES
    .map((k) => buckets[k])
    .filter((b) => b.count > 0);

  return {
    byType: buckets,
    rows,
    totalUsd: grandUsd,
    totalBs: grandBs
  };
}
