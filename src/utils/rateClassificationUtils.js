/**
 * Utilidades centralizadas de clasificación, validación y auditoría inmutable de tasas
 * para POS, CxC, CxP, Caja Chica/Bancos y Reportes PDF.
 *
 * Reglas de Negocio:
 * - Factura Fiscal (FACTURA / FACT): solo permite operar/cobrar/pagar en Tasa BCV ('BCV') o monedas directas ('USD', 'ZELLE', 'USDT', 'USDC').
 * - Nota de Entrega / Documentos sin IVA: habilita selector explícito ('BCV', 'KEYSTONE', 'EDITABLE', 'USD', 'ZELLE', 'USDT', 'USDC'; y 'EURO' cuando aplica en cobranza).
 */

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

export const DIRECT_CURRENCY_RATE_TYPES = ['USD', 'ZELLE', 'USDT', 'USDC'];
export const STANDARD_RATE_TYPES = ['BCV', 'KEYSTONE', 'EDITABLE', ...DIRECT_CURRENCY_RATE_TYPES];
export const EXTENDED_RATE_TYPES = ['BCV', 'EURO', 'KEYSTONE', 'EDITABLE', ...DIRECT_CURRENCY_RATE_TYPES];

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
  BCV_EDITABLE: {
    id: 'BCV_EDITABLE',
    label: 'Tasa BCV Editable',
    shortLabel: 'BCV EDIT.',
    badgeText: 'BCV EDIT.',
    color: '#059669',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.45)'
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
  USDT_BS: {
    id: 'USDT_BS',
    label: 'Tasa USDT',
    shortLabel: 'TASA USDT',
    badgeText: 'TASA USDT',
    color: '#14b8a6',
    bg: 'rgba(20, 184, 166, 0.14)',
    border: 'rgba(20, 184, 166, 0.38)'
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
    label: 'Divisa Efectivo USD',
    shortLabel: 'EFEC. USD',
    badgeText: 'EFEC. USD',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.14)',
    border: 'rgba(34, 197, 94, 0.38)'
  },
  ZELLE: {
    id: 'ZELLE',
    label: 'Divisa Zelle (USD)',
    shortLabel: 'ZELLE',
    badgeText: 'ZELLE',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.38)'
  },
  USDT: {
    id: 'USDT',
    label: 'Divisa Binance (USDT)',
    shortLabel: 'USDT',
    badgeText: 'USDT',
    color: '#14b8a6',
    bg: 'rgba(20, 184, 166, 0.14)',
    border: 'rgba(20, 184, 166, 0.38)'
  },
  USDC: {
    id: 'USDC',
    label: 'Divisas Kontigo (USDC)',
    shortLabel: 'USDC',
    badgeText: 'USDC',
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.14)',
    border: 'rgba(6, 182, 212, 0.38)'
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
    return [...STANDARD_RATE_TYPES];
  }
  return includeEuro ? [...EXTENDED_RATE_TYPES] : [...STANDARD_RATE_TYPES];
}

function matchDirectCurrencyAlias(up) {
  if (!up) return null;
  if (up === 'ZELLE' || up.includes('ZELLE')) return 'ZELLE';
  if (up === 'USDT' || up.includes('BINANCE') || up.includes('USDT')) return 'USDT';
  if (up === 'USDC' || up.includes('KONTIGO') || up.includes('USDC')) return 'USDC';
  if (
    up === 'USD' ||
    up === 'US$' ||
    up === 'DIVISA' ||
    up === 'EFECTIVO_USD' ||
    up.includes('EFECTIVO USD') ||
    up.includes('DIRECTA USD')
  ) {
    return 'USD';
  }
  return null;
}

export function normalizeRateType(rawType, { isFiscal = false, tipoDoc = '', monedaPago = '', fallback = 'BCV' } = {}) {
  const effectiveFiscal = isFiscal || (tipoDoc ? isFiscalDocumentForRatePolicy(tipoDoc) : false);
  const up = String(rawType || '').toUpperCase().trim();

  let resolved = null;
  if (up === 'BCV' || up === 'TASA_BCV' || up === 'TASA BCV' || up === 'OFICIAL') {
    resolved = 'BCV';
  } else if (up === 'BCV_EDITABLE' || up === 'TASA_BCV_EDITABLE' || up === 'TASA BCV EDITABLE' || up === 'BCV EDITABLE') {
    resolved = 'BCV_EDITABLE';
  } else if (up === 'KEYSTONE' || up === 'KEY' || up === 'TASA_KEYSTONE' || up === 'TASA KEYSTONE' || up === 'PARALELA') {
    resolved = 'KEYSTONE';
  } else if (up === 'USDT_BS' || up === 'TASA_USDT' || up === 'TASA USDT') {
    resolved = 'USDT_BS';
  } else if (up === 'EDITABLE' || up === 'PERSONALIZADA' || up === 'PERSONALIZADO' || up === 'MANUAL' || up === 'CUSTOM' || up === 'TASA_PERSONALIZADA') {
    resolved = 'EDITABLE';
  } else if (up === 'EURO' || up === 'EUR' || up === 'TASA_EURO' || up === 'TASA EURO') {
    resolved = 'EURO';
  } else {
    resolved = matchDirectCurrencyAlias(up);
  }

  if (!resolved) {
    const directFromMoneda = matchDirectCurrencyAlias(String(monedaPago || '').toUpperCase().trim());
    resolved = directFromMoneda || fallback || 'BCV';
  }

  if (effectiveFiscal && (resolved === 'EURO' || resolved === 'USDT_BS')) {
    return 'BCV';
  }
  return resolved;
}

/** Devuelve true cuando la clasificación corresponde a una moneda directa (sin tasa fija en Bs). */
export function isDirectCurrencyRateType(rawType, { monedaPago = '' } = {}) {
  const resolved = normalizeRateType(rawType, { monedaPago, fallback: '' });
  return DIRECT_CURRENCY_RATE_TYPES.includes(resolved);
}

/**
 * Detecta si la caja/cuenta receptora o método de pago corresponde a una moneda directa
 * (Caja Zelle, Caja USDC Kontigo, Caja Efectivo $ Valencia / Caracas, y opcionalmente Caja USDT Binance)
 * sin tasa de cambio fijada en Bolívares. Excluye cuentas/cajas en Bolívares (ej. Caja Efectivo Bs).
 */
export function inferDirectCurrencyFromAccountOrMethod(record, { includeBinanceFromAccount = false } = {}) {
  if (!record || typeof record !== 'object') return null;
  const fp0 = Array.isArray(record.formasPago) ? (record.formasPago[0] || {}) : {};
  const accountText = [
    record.cuentaNombre,
    record.cuenta_nombre,
    record.cajaOBanco,
    record.caja_o_banco,
    record.cuentaDestino,
    record.descripcion,
    record.nombre,
    record.label,
    record.cuentaId,
    record.cuenta_id,
    record.cajaId,
    record.caja_id,
    record.coCaja,
    record.co_caja,
    record.rawId,
    fp0.codCaja,
    fp0.codCta,
    fp0.banco
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  const methodText = String(record.formaPago || record.metodoPago || record.metodo || fp0.formaPago || fp0.tipo || '')
    .toUpperCase()
    .trim();

  const rawBs = Number(record.montoBs ?? record.monto_bs ?? 0);
  const monPago = String(record.monedaPago || record.moneda_pago || '').toUpperCase().trim();
  const isExplicitBsAccount =
    /\bBS\b|BOLIVAR|CAJA-?03|CTA-?\d|BANCO\s+(MERCANTIL|PLAZA|DE\s+VENEZUELA|BANCARIBE|ACTIVO|BANCAMIGA)/.test(accountText) ||
    String(record.moneda || '').toUpperCase().trim() === 'BS';

  if (/CAJA-?04|\bZELLE\b/.test(accountText)) return 'ZELLE';
  if (/CAJA-?06|\bUSDC\b|\bKONTIGO\b/.test(accountText)) return 'USDC';
  if (/CAJA-?05|\bUSDT\b|\bBINANCE\b/.test(accountText)) {
    if (includeBinanceFromAccount || monPago === 'USDT' || rawBs <= 0) {
      return 'USDT';
    }
    return null;
  }

  if (!isExplicitBsAccount) {
    if (
      /CAJA-?01|CAJA-?02/.test(accountText) ||
      (/\bEFECTIVO\b/.test(accountText) && /\$|\bUSD\b|\bDIVISA\b|\bVALENCIA\b|\bCARACAS\b/.test(accountText)) ||
      (/\bDEPOSITO\b/.test(accountText) && /\bEFECTIVO\b/.test(accountText) && /VALENCIA|CARACAS|\$|USD/.test(accountText))
    ) {
      return 'USD';
    }
    if (/ZELLE/.test(methodText)) return 'ZELLE';
    if (/USDT|BINANCE/.test(methodText) && (includeBinanceFromAccount || monPago === 'USDT' || rawBs <= 0)) return 'USDT';
    if (/USDC|KONTIGO/.test(methodText)) return 'USDC';
  }
  return null;
}

export function resolveRecordRateType(record, fallback = 'BCV') {
  if (!record || typeof record !== 'object') return fallback;
  const isFiscal = record.tipoDoc || record.tipo_doc || record.factNum || record.fact_num || record.nroDoc || record.nro_doc
    ? isFiscalDocumentForRatePolicy(record)
    : false;
  const rawType = record.tipoTasa ?? record.tipo_tasa ?? '';
  const rawMoneda = record.monedaPago ?? record.moneda_pago ?? record.moneda ?? '';
  const directMoneda = matchDirectCurrencyAlias(String(rawMoneda).toUpperCase().trim());
  if (!rawType && directMoneda && Number(record.montoBs ?? record.monto_bs ?? 0) === 0) {
    return directMoneda;
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

export function resolveDefaultRateValue(tipoTasa, { tasaBcv = 1, tasaKeystone = 0, tasaEuro = 0, tasaUsdt = 0, customRate = 0 } = {}) {
  const normalized = normalizeRateType(tipoTasa, { fallback: 'BCV' });
  const safeBcv = Number(tasaBcv) > 0 ? round2(tasaBcv) : 1;
  const safeKeystone = Number(tasaKeystone) > 0 ? round2(tasaKeystone) : safeBcv;
  const safeEuro = Number(tasaEuro) > 0 ? round2(tasaEuro) : safeBcv;
  const safeUsdt = Number(tasaUsdt) > 0 ? round2(tasaUsdt) : safeKeystone;
  if (normalized === 'BCV') return safeBcv;
  if (normalized === 'BCV_EDITABLE') return Number(customRate) > 0 ? round2(customRate) : safeBcv;
  if (normalized === 'KEYSTONE') return safeKeystone;
  if (normalized === 'EURO') return safeEuro;
  if (normalized === 'USDT_BS') return safeUsdt;
  if (normalized === 'EDITABLE') return Number(customRate) > 0 ? round2(customRate) : safeKeystone;
  if (DIRECT_CURRENCY_RATE_TYPES.includes(normalized)) return 1;
  return safeBcv;
}

export function resolveMonedaPago(tipoTasa, accountOrMoneda = '') {
  const normalized = normalizeRateType(tipoTasa, { fallback: 'BCV' });
  if (DIRECT_CURRENCY_RATE_TYPES.includes(normalized)) return 'USD';
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
  const allRateKeys = ['BCV', 'BCV_EDITABLE', 'EURO', 'KEYSTONE', 'USDT_BS', 'EDITABLE', ...DIRECT_CURRENCY_RATE_TYPES];
  allRateKeys.forEach((k) => {
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
    const bs = DIRECT_CURRENCY_RATE_TYPES.includes(key)
      ? (rawBs > 0 ? round2(rawBs) : 0)
      : (rawBs > 0 ? round2(rawBs) : round2(usd * (rate > 0 ? rate : 1)));

    bucket.count += 1;
    bucket.totalUsd = round2(bucket.totalUsd + usd);
    bucket.totalBs = round2(bucket.totalBs + bs);
    grandUsd = round2(grandUsd + usd);
    grandBs = round2(grandBs + bs);
  });

  const rows = allRateKeys
    .map((k) => buckets[k])
    .filter((b) => b.count > 0);

  return {
    byType: buckets,
    rows,
    totalUsd: grandUsd,
    totalBs: grandBs
  };
}
