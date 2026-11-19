/**
 * SERVICIO ESPECIALIZADO EN NORMATIVA FISCAL SENIAT PARA VENEZUELA
 * Sistema: SIGNUM MOTORVEN
 * 
 * Normativa de Referencia:
 * - Providencia Administrativa SNAT/2011/00071 (Facturación y Medios de Emisión)
 * - Providencia Administrativa SNAT/2013/00030 (Régimen de Retenciones de IVA)
 * - Ley de Impuesto al Valor Agregado (IVA) y su Reglamento (Arts. 75 al 78)
 * - Ley de Impuesto a las Grandes Transacciones Financieras (IGTF)
 * - Código Orgánico Tributario (COT)
 */

import { round2, formatUsd, formatBs, formatNumberUs } from './formatService.js';

// ==============================================================================
// 1. VALIDACIÓN FISCAL DE DOCUMENTOS DE IDENTIDAD TRIBUTARIA (RIF Y CÉDULA)
// ==============================================================================

/**
 * Valida un RIF venezolano mediante expresión regular y el algoritmo oficial Módulo 11 del SENIAT.
 * Tipos admitidos: V (Venezolano), E (Extranjero), J (Jurídico), G (Gubernamental), P (Pasaporte), C (Comunal).
 * 
 * Formato esperado: J-31115365-9, V-12345678-0, etc. (Acepta con o sin guiones).
 * @param {string} rawRif - RIF a validar.
 * @returns {{ isValid: boolean, error?: string, formatted?: string, clean?: string }}
 */
export const validateRif = (rawRif) => {
  if (!rawRif || typeof rawRif !== 'string') {
    return { isValid: false, error: 'El RIF es requerido y debe ser una cadena de texto.' };
  }

  // Limpieza de caracteres no alfanuméricos
  const clean = rawRif.trim().toUpperCase().replace(/[^VEJPGCE0-9]/g, '');

  // Formato: 1 letra inicial + 8 a 9 dígitos
  const rifRegex = /^[VEJPGCE][0-9]{8,9}$/;
  if (!rifRegex.test(clean)) {
    return {
      isValid: false,
      error: 'Formato de RIF inválido. Debe iniciar con V, E, J, G, P o C seguido de 8 o 9 dígitos numéricos.'
    };
  }

  const tipo = clean.charAt(0);
  const digitos = clean.substring(1);
  const digitoVerificadorProvisto = parseInt(digitos.slice(-1), 10);
  
  // Extraer el cuerpo numérico (los 8 dígitos centrales) completando a 8 si vinieron 7
  const cuerpo = digitos.slice(0, -1).padStart(8, '0');

  // Mapeo del tipo según constante SENIAT
  const factorTipo = {
    'V': 1,
    'E': 2,
    'J': 3,
    'P': 4,
    'G': 5,
    'C': 6
  };

  const prefijoDigito = factorTipo[tipo];
  if (!prefijoDigito) {
    return { isValid: false, error: 'Tipo de contribuyente no admitido.' };
  }

  // Factores ponderados del algoritmo Módulo 11 SENIAT
  // Factores: [4, 3, 2, 7, 6, 5, 4, 3, 2]
  const pesos = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digitosEvaluados = [prefijoDigito, ...cuerpo.split('').map(d => parseInt(d, 10))];

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    suma += digitosEvaluados[i] * pesos[i];
  }

  const residuo = suma % 11;
  let digitoEsperado = 0;
  if (residuo === 0 || residuo === 1) {
    digitoEsperado = 0;
  } else {
    digitoEsperado = 11 - residuo;
  }

  if (digitoEsperado !== digitoVerificadorProvisto) {
    return {
      isValid: false,
      error: `Dígito verificador incorrecto (Esperado: ${digitoEsperado}, Provisto: ${digitoVerificadorProvisto}). RIF no válido ante SENIAT.`
    };
  }

  const formatted = `${tipo}-${cuerpo}-${digitoEsperado}`;
  return {
    isValid: true,
    clean,
    formatted
  };
};

/**
 * Valida formato de Cédula de Identidad venezolana.
 * Formato: V-12345678 o E-12345678 (6 a 9 dígitos numéricos).
 * @param {string} cedula 
 * @returns {boolean}
 */
export const validateCedula = (cedula) => {
  if (!cedula || typeof cedula !== 'string') return false;
  const clean = cedula.trim().toUpperCase().replace(/\s/g, '');
  const regex = /^[VE]-[0-9]{6,9}$/;
  return regex.test(clean);
};

export const PERSON_PREFIXES = ['J', 'V', 'E', 'G', 'P'];
const CONTRIBUTOR_CODES = PERSON_PREFIXES;

/**
 * Clasificación oficial SENIAT de los 5 tipos de Contribuyentes / Clientes.
 */
export const SENIAT_CONTRIBUTOR_TYPES = [
  {
    code: 'J',
    label: 'J - Personas Jurídicas',
    shortLabel: 'Persona Jurídica',
    description: 'Empresas privadas, sociedades anónimas (S.A.), compañías anónimas (C.A.) y sociedades de responsabilidad limitada (S.R.L.) que comercializan bienes o servicios gravados.'
  },
  {
    code: 'V',
    label: 'V - Personas Naturales Venezolanas',
    shortLabel: 'Persona Natural Venezolana',
    description: 'Ciudadanos venezolanos que actúan como firmas personales, profesionales independientes o comerciantes que superan el límite de ingresos para ser formales.'
  },
  {
    code: 'E',
    label: 'E - Personas Naturales Extranjeras',
    shortLabel: 'Persona Natural Extranjera',
    description: 'Ciudadanos extranjeros residenciados en el país que realizan actividades económicas independientes sujetas a IVA.'
  },
  {
    code: 'G',
    label: 'G - Entes Gubernamentales',
    shortLabel: 'Ente Gubernamental',
    description: 'Instituciones del Estado, alcaldías o ministerios que, a pesar de ser públicos, realizan actividades comerciales o adquieren bienes/servicios gravados.'
  },
  {
    code: 'P',
    label: 'P - Personas Jurídicas Extranjeras',
    shortLabel: 'Persona Jurídica Extranjera',
    description: 'Empresas de origen extranjero que operan o tienen base legal/sucursales en Venezuela.'
  }
];

/**
 * Resuelve la clasificación SENIAT ('J' | 'V' | 'E' | 'G' | 'P') de un cliente.
 * Prioriza tipoPersona / tipoContribuyente explícito si coincide, luego prefijo del RIF/código, y por último heurística por nombre.
 */
export const resolveClientContributorType = (client) => {
  if (!client) return 'J';
  const explicit = String(client.tipoPersona || client.tipo_persona || client.tipoContribuyente || '').trim().toUpperCase();
  if (CONTRIBUTOR_CODES.includes(explicit)) return explicit;

  const rawRif = String(client.rif || client.codigo || client.id || '').trim().toUpperCase();
  const match = rawRif.match(/^([JVEGP])/);
  if (match) return match[1];

  const rawType = String(client.tipoCliente || '').trim().toUpperCase();
  if (CONTRIBUTOR_CODES.includes(rawType)) return rawType;

  const name = String(client.nombre || client.razonSocial || '').toUpperCase();
  if (/(ALCALD|MINISTERIO|GOBERNACI|INSTITUTO|FUNDACI|CONCEJO|ENTE )/.test(name)) return 'G';
  if (/(C\.A|S\.A|S\.R\.L|R\.L|INVERSIONES|DISTRIBUIDORA|CORPORACI|COMERCIALIZADORA|SERVICIOS|TRANSPORTE|LUBRICANTES|REPUESTOS|AUTO)/.test(name)) return 'J';
  return 'V';
};

export const detectPersonPrefix = resolveClientContributorType;

/**
 * Aplica o sincroniza el prefijo de clasificación SENIAT ('J'|'V'|'E'|'G'|'P') en un campo RIF / Cédula.
 */
export const applyContributorPrefixToRif = (rawValue, contributorCode) => {
  const code = CONTRIBUTOR_CODES.includes(String(contributorCode || '').toUpperCase())
    ? String(contributorCode).toUpperCase()
    : 'J';
  const trimmed = String(rawValue || '').trim().toUpperCase();
  if (!trimmed) return `${code}-`;
  const body = trimmed.replace(/^[JVEGPC][-\s]*/i, '').replace(/^\-+/, '');
  return body ? `${code}-${body}` : `${code}-`;
};

export const applyPersonPrefixToRif = applyContributorPrefixToRif;

/**
 * Calcula los totales por cada clasificación SENIAT sobre una lista de clientes.
 */
export const computeContributorTypeCounts = (clientsList = []) => {
  const counts = { J: 0, V: 0, E: 0, G: 0, P: 0 };
  (clientsList || []).forEach(c => {
    if (!c) return;
    const code = resolveClientContributorType(c);
    if (counts[code] !== undefined) counts[code] += 1;
  });
  return counts;
};

export const countPersonTypes = computeContributorTypeCounts;

/**
 * Valida un documento tributario o cédula según su prefijo y formato SENIAT.
 */
export const validateDocumentNumber = (rawValue, contributorCode) => {
  const normalized = String(rawValue || '').trim().toUpperCase();
  if (!normalized || /^[JVEGP]-?$/.test(normalized)) {
    return { isValid: false, kind: 'NONE', message: '' };
  }
  const rifRes = validateRif(normalized);
  if (rifRes.isValid) {
    return { isValid: true, kind: 'RIF', formatted: rifRes.formatted, message: '✓ RIF SENIAT válido' };
  }
  const effectiveCode = contributorCode || (normalized.match(/^([JVEGP])/)?.[1] || 'J');
  if ((effectiveCode === 'V' || effectiveCode === 'E') && validateCedula(normalized)) {
    return { isValid: true, kind: 'CEDULA', formatted: normalized, message: '✓ Cédula válida (formato V/E)' };
  }
  return {
    isValid: false,
    kind: 'INVALID',
    message: (effectiveCode === 'V' || effectiveCode === 'E')
      ? 'Ingrese Cédula (Ej: V-12345678) o RIF completo con dígito verificador (Ej: V-12345678-9)'
      : `Verifique formato RIF SENIAT (Ej: ${effectiveCode}-12345678-9)`
  };
};

export const validateRifOrCedula = validateDocumentNumber;

// ==============================================================================
// 2. MOTOR DE CÁLCULOS TRIBUTARIOS MULTIMONEDA (IVA MULTI-ALÍCUOTA, IGTF Y RETENCIONES)
// ==============================================================================

/**
 * Redondeo financiero estándar a 2 decimales (Half-Up).
 * Evita errores de coma flotante de IEEE 754.
 */
export const roundTo2Decimals = round2;

/**
 * Alícuotas impositivas oficiales según la Ley del IVA de Venezuela.
 */
export const ALICUOTAS_IVA = {
  EXENTO_0: { codigo: 'EXENTO_0', porcentaje: 0.00, descripcion: 'Exento / No Sujeto (0%)' },
  REDUCIDA_8: { codigo: 'REDUCIDA_8', porcentaje: 8.00, descripcion: 'Alícuota Reducida (8%)' },
  GENERAL_16: { codigo: 'GENERAL_16', porcentaje: 16.00, descripcion: 'Alícuota General (16%)' },
  ADICIONAL_31: { codigo: 'ADICIONAL_31', porcentaje: 31.00, descripcion: 'Alícuota General + Adicional Suntuaria (31%)' }
};

/**
 * Realiza el cálculo fiscal consolidado de una venta o compra con precisión centesimal y bimoneda.
 * 
 * @param {Array} items - Lista de artículos con { cantidad, precioUsd, tipoAlicuota, aplicaIva }
 * @param {string} metodoPago - 'EFECTIVO_USD', 'ZELLE', 'PAGO_MOVIL', 'TRANSFERENCIA_BS', etc.
 * @param {string} condicionPago - 'CONTADO' o 'CREDITO'
 * @param {number} tasaBcv - Cotización oficial del BCV (Bs. / USD)
 * @param {number} porcentajeRetencionIva - Porcentaje de retención del agente (0, 75 o 100)
 * @param {number} porcentajeRetencionIslr - Porcentaje de retención de ISLR (ej. 2)
 * @param {boolean} esSujetoPasivoEspecial - Si el emisor percibe IGTF como Sujeto Pasivo Especial
 * @param {number} porcentajeIgtf - Alícuota IGTF configurable (por defecto 3%)
 */
export const resolveConfigIgtfOptions = (config = {}) => {
  const parsedRate =
    config?.igtfPorcentaje !== undefined && config?.igtfPorcentaje !== null
      ? Number(config.igtfPorcentaje)
      : 3;
  const porcentajeIgtf = Number.isFinite(parsedRate) ? Math.max(0, parsedRate) : 3;
  const esSujetoPasivoEspecial = config?.esSujetoPasivoEspecial !== false && porcentajeIgtf > 0;
  return { esSujetoPasivoEspecial, porcentajeIgtf };
};

export const calculateFiscalTaxes = ({
  items = [],
  tipoDoc = 'FACTURA',
  metodoPago = 'EFECTIVO_USD',
  condicionPago = 'CONTADO',
  tasaBcv = 827.73,
  porcentajeRetencionIva = 75.00,
  porcentajeRetencionIslr = 2.00,
  esSujetoPasivoEspecial = true,
  porcentajeIgtf = 3.00
}) => {
  const tasa = Number(tasaBcv) > 0 ? Number(tasaBcv) : 827.73;
  const tipoUpper = String(tipoDoc || '').trim().toUpperCase();
  const isNotaEntrega = tipoUpper === 'NOTA_ENTREGA';
  const isCotizacion = tipoUpper === 'COTIZACION';

  let baseExentaUsd = 0;
  let baseGeneralUsd = 0;
  let baseReducidaUsd = 0;
  let baseAdicionalUsd = 0;

  // Procesar cada ítem según su alícuota tributaria
  items.forEach(item => {
    const cantidad = item.cantidad !== undefined ? Number(item.cantidad) : 1;
    const precio = item.precioUsd !== undefined ? Number(item.precioUsd) : (Number(item.subtotalUsd) || 0);
    const subtotalItem = (item.subtotalUsd !== undefined && item.cantidad === undefined)
      ? roundTo2Decimals(Number(item.subtotalUsd))
      : roundTo2Decimals(cantidad * precio);

    const alicuota = item.tipoAlicuota || (item.aplicaIva === false ? 'EXENTO_0' : 'GENERAL_16');

    switch (alicuota) {
      case 'EXENTO_0':
        baseExentaUsd += subtotalItem;
        break;
      case 'REDUCIDA_8':
        baseReducidaUsd += subtotalItem;
        break;
      case 'ADICIONAL_31':
        baseAdicionalUsd += subtotalItem;
        break;
      case 'GENERAL_16':
      default:
        baseGeneralUsd += subtotalItem;
        break;
    }
  });

  baseExentaUsd = roundTo2Decimals(baseExentaUsd);
  baseGeneralUsd = roundTo2Decimals(baseGeneralUsd);
  baseReducidaUsd = roundTo2Decimals(baseReducidaUsd);
  baseAdicionalUsd = roundTo2Decimals(baseAdicionalUsd);

  const subtotalGravableUsd = roundTo2Decimals(baseGeneralUsd + baseReducidaUsd + baseAdicionalUsd);
  const subtotalNetoUsd = roundTo2Decimals(baseExentaUsd + subtotalGravableUsd);

  // Débito Fiscal IVA discriminado (En Notas de Entrega NO aplica IVA: 0%)
  const ivaGeneralUsd = isNotaEntrega ? 0 : roundTo2Decimals(baseGeneralUsd * 0.16);
  const ivaReducidoUsd = isNotaEntrega ? 0 : roundTo2Decimals(baseReducidaUsd * 0.08);
  const ivaAdicionalUsd = isNotaEntrega ? 0 : roundTo2Decimals(baseAdicionalUsd * 0.31);
  const totalIvaUsd = isNotaEntrega ? 0 : roundTo2Decimals(ivaGeneralUsd + ivaReducidoUsd + ivaAdicionalUsd);

  // Percepción de IGTF (configurable, por defecto 3%)
  // Aplica sobre pagos en divisas o criptomonedas no soberanas (no aplica en Notas de Entrega ni Cotizaciones)
  const parsedIgtfRate = Number(porcentajeIgtf);
  const effectiveIgtfRate = Number.isFinite(parsedIgtfRate) ? Math.max(0, parsedIgtfRate) : 3;
  const esPagoEnDivisas = ['EFECTIVO_USD', 'ZELLE', 'USDT', 'DIVISAS'].includes(metodoPago);
  const aplicaIgtf = !isNotaEntrega && !isCotizacion && esSujetoPasivoEspecial && effectiveIgtfRate > 0 && esPagoEnDivisas && condicionPago === 'CONTADO';

  const baseIgtfUsd = aplicaIgtf ? roundTo2Decimals(subtotalNetoUsd + totalIvaUsd) : 0;
  const igtfUsd = aplicaIgtf ? roundTo2Decimals(baseIgtfUsd * (effectiveIgtfRate / 100)) : 0;

  const totalFacturaUsd = roundTo2Decimals(subtotalNetoUsd + totalIvaUsd + igtfUsd);

  // Retención de IVA (75% o 100% — no aplica en NE ni Cotizaciones)
  const retencionIvaUsd = (!isNotaEntrega && !isCotizacion && porcentajeRetencionIva > 0)
    ? roundTo2Decimals(totalIvaUsd * (porcentajeRetencionIva / 100))
    : 0;

  // Retención de ISLR (no aplica en NE ni Cotizaciones)
  const retencionIslrUsd = (!isNotaEntrega && !isCotizacion && porcentajeRetencionIslr > 0)
    ? roundTo2Decimals(subtotalGravableUsd * (porcentajeRetencionIslr / 100))
    : 0;

  // CONVERSIÓN OBLIGATORIA A MONEDA DE CURSO LEGAL (BOLÍVARES VES)
  const baseExentaBs = roundTo2Decimals(baseExentaUsd * tasa);
  const baseGeneralBs = roundTo2Decimals(baseGeneralUsd * tasa);
  const baseReducidaBs = roundTo2Decimals(baseReducidaUsd * tasa);
  const baseAdicionalBs = roundTo2Decimals(baseAdicionalUsd * tasa);
  const subtotalNetoBs = roundTo2Decimals(subtotalNetoUsd * tasa);

  const ivaGeneralBs = roundTo2Decimals(ivaGeneralUsd * tasa);
  const ivaReducidoBs = roundTo2Decimals(ivaReducidoUsd * tasa);
  const ivaAdicionalBs = roundTo2Decimals(ivaAdicionalUsd * tasa);
  const totalIvaBs = roundTo2Decimals(totalIvaUsd * tasa);

  const baseIgtfBs = roundTo2Decimals(baseIgtfUsd * tasa);
  const igtfBs = roundTo2Decimals(igtfUsd * tasa);
  const totalFacturaBs = roundTo2Decimals(totalFacturaUsd * tasa);

  const retencionIvaBs = roundTo2Decimals(retencionIvaUsd * tasa);
  const retencionIslrBs = roundTo2Decimals(retencionIslrUsd * tasa);

  return {
    tasaBcv: tasa,
    subtotalNetoUsd,
    baseExentaUsd,
    baseGeneralUsd,
    baseReducidaUsd,
    baseAdicionalUsd,
    ivaGeneralUsd,
    ivaReducidoUsd,
    ivaAdicionalUsd,
    totalIvaUsd,
    baseIgtfUsd,
    igtfUsd,
    totalFacturaUsd,
    retencionIvaUsd,
    retencionIslrUsd,
    // Contravalores en Bolívares
    subtotalNetoBs,
    baseExentaBs,
    baseGeneralBs,
    baseReducidaBs,
    baseAdicionalBs,
    ivaGeneralBs,
    ivaReducidoBs,
    ivaAdicionalBs,
    totalIvaBs,
    baseIgtfBs,
    igtfBs,
    totalFacturaBs,
    retencionIvaBs,
    retencionIslrBs,
    porcentajeRetencionIva,
    porcentajeRetencionIslr,
    aplicaIgtf
  };
};

// ==============================================================================
// 3. GENERADOR DE CORRELATIVOS Y NÚMEROS DE CONTROL FISCAL
// ==============================================================================

export const INVOICE_SERIES_RESET_DATE = '2026-11-01';

/**
 * Determina si una factura pertenece al lote histórico previo al reinicio de serie (antes del 01/11/2026).
 * Las Notas de Entrega, Crédito y Débito mantienen su serie continua y nunca se marcan como LEGACY.
 * @param {object} doc
 * @returns {boolean}
 */
export const isLegacyPreNovInvoice = (doc) => {
  if (!doc || typeof doc !== 'object') return false;
  const rawTipo = String(doc.tipoDoc || doc.tipo_doc || '').toUpperCase().trim();
  const rawId = String(doc.id || '').trim();
  const rawNum = String(doc.numeroDoc ?? doc.numero_doc ?? doc.factNum ?? doc.fact_num ?? '').trim();
  if (rawTipo === 'NOTA_ENTREGA' || /^(NE-|NDE-|NC-|ND-)/i.test(rawId) || /^(NE-|NDE-|NC-|ND-)/i.test(rawNum)) {
    return false;
  }
  const rawDateStr = String(doc.fechaEmision || doc.fec_emis || doc.fecha_emision || doc.fecha || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDateStr)) {
    return rawDateStr.slice(0, 10) < INVOICE_SERIES_RESET_DATE;
  }
  const fallbackTsStr = String(doc.updated_at || doc.created_at || doc.fecha_sincronizacion || doc.fechaSincronizacion || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(fallbackTsStr)) {
    return fallbackTsStr.slice(0, 10) < INVOICE_SERIES_RESET_DATE;
  }
  return !doc._customCreated && /^fac-[1-9]\d{0,3}$/.test(rawId);
};

/**
 * Normaliza cualquier documento o referencia fiscal a una clave canónica
 * independiente de prefijos (FAC-/NE-/NC-/ND-) y ceros a la izquierda.
 * Ejemplo: "000003", "FAC-000003" y 3 -> "FAC:3"; "NE-002227" -> "NE:2227".
 * @param {object|string|number} docOrNum
 * @param {string} [explicitTipoDoc]
 * @returns {string}
 */
export const getCanonicalDocKey = (docOrNum, explicitTipoDoc = '') => {
  if (docOrNum === null || docOrNum === undefined || docOrNum === '') return '';
  const isObj = typeof docOrNum === 'object';
  const rawTipo = String(
    explicitTipoDoc || (isObj ? (docOrNum.tipoDoc || docOrNum.tipo_doc || '') : '')
  ).toUpperCase().trim();
  const rawId = isObj ? String(docOrNum.id ?? '').trim().toUpperCase() : '';
  const rawNum = String(
    isObj
      ? (docOrNum.numeroDoc ?? docOrNum.numero_doc ?? docOrNum.factNum ?? docOrNum.fact_num ?? docOrNum.nroFactura ?? docOrNum.factura ?? docOrNum.originalFactNum ?? docOrNum.id ?? '')
      : docOrNum
  ).trim().toUpperCase();
  if (!rawNum && !rawId) return '';

  const isNe =
    rawTipo === 'NOTA_ENTREGA' ||
    rawTipo === 'N/E' ||
    rawTipo === 'NE' ||
    /^(NE-|N\.E-|NDE-)/.test(rawId) ||
    /^(NE-|N\.E-|NDE-)/.test(rawNum);
  const isNc = rawTipo === 'NOTA_CREDITO' || /^(NC-)/.test(rawId) || /^(NC-)/.test(rawNum);
  const isNd = rawTipo === 'NOTA_DEBITO' || /^(ND-)/.test(rawId) || /^(ND-)/.test(rawNum);
  const family = isNe ? 'NE' : isNc ? 'NC' : isNd ? 'ND' : 'FAC';

  const base = rawNum || rawId;
  const digits = base.replace(/^(FAC-|FACT-|NE-|N\.E-|NDE-|NC-|ND-|INV-|DOC-)/i, '').replace(/^0+(?=\d)/, '');
  return `${family}:${digits || base}`;
};

/**
 * Clave canónica consciente de serie/era: separa la serie histórica previa a noviembre 2026 (:LEGACY)
 * de la serie reiniciada a partir de 000000 para evitar sobrescrituras o colisiones cruzadas.
 * @param {object|string|number} docOrNum
 * @param {string} [explicitTipoDoc]
 * @returns {string}
 */
export const getEraScopedCanonicalDocKey = (docOrNum, explicitTipoDoc = '') => {
  const baseKey = getCanonicalDocKey(docOrNum, explicitTipoDoc);
  if (!baseKey) return '';
  if (typeof docOrNum === 'object' && docOrNum !== null) {
    const explicitEra = String(docOrNum.seriesEra || docOrNum.series_era || '').trim().toUpperCase();
    if (explicitEra) {
      return `${baseKey}:${explicitEra}`;
    }
    if (baseKey.startsWith('FAC:') && isLegacyPreNovInvoice(docOrNum)) {
      return `${baseKey}:LEGACY`;
    }
  }
  return baseKey;
};

const pickBestLineItems = (a, b) => {
  const arrA = Array.isArray(a) ? a : [];
  const arrB = Array.isArray(b) ? b : [];
  if (arrB.length === 0) return arrA;
  if (arrA.length === 0) return arrB;
  return arrB.length >= arrA.length ? arrB : arrA;
};

/**
 * Deduplica un arreglo de documentos (ventas o profit_invoices) por clave canónica de serie,
 * fusionando campos útiles (renglones no vacíos, número formateado y última actualización).
 * @param {Array} docs
 * @returns {Array}
 */
export const dedupeCanonicalDocs = (docs = []) => {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  const map = new Map();
  for (const doc of docs) {
    if (!doc) continue;
    const cKey = getEraScopedCanonicalDocKey(doc);
    if (!cKey) continue;
    const existing = map.get(cKey);
    if (!existing) {
      map.set(cKey, doc);
      continue;
    }
    const tsExisting = Date.parse(existing.updated_at || existing.fechaSincronizacion || existing.fecha_sincronizacion || 0) || 0;
    const tsIncoming = Date.parse(doc.updated_at || doc.fechaSincronizacion || doc.fecha_sincronizacion || 0) || 0;
    const newer = tsIncoming >= tsExisting ? doc : existing;
    const older = tsIncoming >= tsExisting ? existing : doc;
    const merged = {
      ...older,
      ...newer,
      items: pickBestLineItems(older.items || older.renglones, newer.items || newer.renglones)
    };
    const candA = String(existing.factNum || existing.numeroDoc || '').trim();
    const candB = String(doc.factNum || doc.numeroDoc || '').trim();
    const bestPadded = /^0+\d+$/.test(candA) ? candA : (/^0+\d+$/.test(candB) ? candB : '');
    if (bestPadded && !merged._customCreated) {
      if (merged.factNum !== undefined) merged.factNum = bestPadded;
      if (merged.numeroDoc !== undefined) merged.numeroDoc = bestPadded;
    }
    map.set(cKey, merged);
  }
  return Array.from(map.values());
};

/**
 * Genera un Número de Control Fiscal conforme a la Providencia SNAT/2011/00071.
 * Formato estándar: 00-XXXXXX (6 dígitos numéricos)
 * @param {number} sequenceNumber 
 * @returns {string}
 */
export const generateFiscalControlNumber = (sequenceNumber) => {
  const seq = parseInt(sequenceNumber, 10) || 1;
  return `00-${String(seq).padStart(6, '0')}`;
};

/**
 * Genera el identificador de control para Nota de Entrega con formato N.E-XXXXXX (6 dígitos).
 * @param {string|number} correlativo
 * @returns {string}
 */
export const generateDeliveryNoteControlNumber = (correlativo) => {
  const digits = String(correlativo ?? '').replace(/[^0-9]/g, '');
  const padded = digits ? digits.slice(-6).padStart(6, '0') : '000001';
  return `N.E-${padded}`;
};

/**
 * Formatea el N° Control por defecto según tipo de documento (00-XXXXXX para fiscales, N.E-XXXXXX para N.E.).
 * @param {string|number} correlativo
 * @param {string} [tipoDoc]
 * @returns {string}
 */
export const formatDocumentControlNumber = (correlativo, tipoDoc = 'FACTURA') => {
  const normTipo = String(tipoDoc || 'FACTURA').toUpperCase().trim();
  if (normTipo === 'NOTA_ENTREGA' || normTipo === 'N/E' || normTipo === 'NE') {
    return generateDeliveryNoteControlNumber(correlativo);
  }
  const digits = String(correlativo ?? '').replace(/[^0-9]/g, '');
  const seq = digits ? parseInt(digits.slice(-6), 10) : 1;
  return generateFiscalControlNumber(Number.isFinite(seq) && seq >= 0 ? seq : 1);
};

/**
 * Actualiza el campo N° Control Fiscal al alternar Tipo Documento entre Factura Fiscal y Nota de Entrega.
 */
export const resolveControlNumberOnTipoDocChange = ({
  prevTipoDoc = 'FACTURA',
  nextTipoDoc = 'FACTURA',
  numeroDoc = '',
  currentControl = '',
  savedFiscalControl = ''
} = {}) => {
  const nextIsNe = String(nextTipoDoc || '').trim().toUpperCase() === 'NOTA_ENTREGA';
  const prevIsNe = String(prevTipoDoc || '').trim().toUpperCase() === 'NOTA_ENTREGA';
  const trimmedCurrent = String(currentControl || '').trim();

  if (nextIsNe) {
    const nextSavedFiscal = (!prevIsNe && trimmedCurrent && !/^N\.E-/i.test(trimmedCurrent))
      ? trimmedCurrent
      : String(savedFiscalControl || '').trim();
    return {
      numeroControl: generateDeliveryNoteControlNumber(numeroDoc),
      savedFiscalControl: nextSavedFiscal
    };
  }

  const trimmedSaved = String(savedFiscalControl || '').trim();
  if (trimmedSaved && !/^N\.E-/i.test(trimmedSaved)) {
    return { numeroControl: trimmedSaved, savedFiscalControl: trimmedSaved };
  }
  if (!trimmedCurrent || /^N\.E-/i.test(trimmedCurrent)) {
    return { numeroControl: formatDocumentControlNumber(numeroDoc, 'FACTURA'), savedFiscalControl: '' };
  }
  return { numeroControl: trimmedCurrent, savedFiscalControl: trimmedCurrent };
};

/**
 * Sincroniza N.E-XXXXXX automáticamente cuando se edita el correlativo de una Nota de Entrega,
 * preservando un valor manual personalizado si el usuario escribió otro formato.
 */
export const syncControlNumberOnCorrelativoEdit = ({
  tipoDoc = 'FACTURA',
  prevNumeroDoc = '',
  nextNumeroDoc = '',
  currentControl = ''
} = {}) => {
  if (String(tipoDoc || '').trim().toUpperCase() !== 'NOTA_ENTREGA') {
    return currentControl;
  }
  const trimmed = String(currentControl || '').trim();
  const prevDefault = generateDeliveryNoteControlNumber(prevNumeroDoc);
  if (
    !trimmed ||
    trimmed.toUpperCase() === prevDefault.toUpperCase() ||
    /^N\.E-\d{1,6}$/i.test(trimmed) ||
    /^00-\d{6}$/.test(trimmed)
  ) {
    return generateDeliveryNoteControlNumber(nextNumeroDoc);
  }
  return currentControl;
};

/**
 * Evalúa colisiones al editar un documento (tipo/correlativo), aislando Facturas vs Notas de Entrega
 * y separando Notas de Entrega de la serie activa (>= 2026-11) frente a coincidencias históricas (< 2026-11).
 */
export const resolveEditedInvoiceCollision = ({
  orig = {},
  allInvoices = [],
  cleanNum = '',
  targetTipo = 'FACTURA',
  emitIso = ''
} = {}) => {
  const extractPad6 = (doc) => {
    const raw = String(doc?.numeroDoc || doc?.factNum || doc?.fact_num || doc?.nroFactura || doc?.id || '0').trim();
    const digits = raw.replace(/[^0-9]/g, '');
    return digits ? digits.slice(-6).padStart(6, '0') : raw;
  };
  const extractTipo = (doc) => {
    const rawTipo = String(doc?.tipoDoc || doc?.tipo_doc || '').toUpperCase().trim();
    const rawId = String(doc?.id || '').trim().toUpperCase();
    const rawNum = String(doc?.numeroDoc || doc?.factNum || doc?.fact_num || doc?.nroFactura || '').trim().toUpperCase();
    if (
      rawTipo === 'NOTA_ENTREGA' ||
      rawTipo === 'N/E' ||
      rawTipo === 'NE' ||
      /^(NE-|N\.E-|NDE-)/.test(rawId) ||
      /^(NE-|N\.E-|NDE-)/.test(rawNum)
    ) {
      return 'NOTA_ENTREGA';
    }
    return 'FACTURA';
  };
  const extractDateYmd = (doc) => {
    const primary = String(doc?.fechaEmision || doc?.fec_emis || doc?.fecha_emision || doc?.fecha || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(primary)) return primary.slice(0, 10);
    const fallback = String(doc?.updated_at || doc?.created_at || doc?.fecha_sincronizacion || doc?.fechaSincronizacion || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(fallback)) return fallback.slice(0, 10);
    return '';
  };

  const origEraKey = getEraScopedCanonicalDocKey(orig);
  const origPad6 = extractPad6(orig);
  const origTipo = extractTipo(orig);
  const targetDateYmd = /^\d{4}-\d{2}-\d{2}/.test(String(emitIso || '').trim())
    ? String(emitIso).trim().slice(0, 10)
    : extractDateYmd(orig);
  const targetIsHistorical = Boolean(targetDateYmd && targetDateYmd < INVOICE_SERIES_RESET_DATE);

  const sameTypeNumOthers = (Array.isArray(allInvoices) ? allInvoices : []).filter((other) => {
    if (!other || other === orig) return false;
    if (orig?.id && other.id && String(other.id) === String(orig.id)) return false;
    if (origEraKey && getEraScopedCanonicalDocKey(other) === origEraKey) return false;
    return extractPad6(other) === cleanNum && extractTipo(other) === targetTipo;
  });

  if (targetTipo === 'FACTURA') {
    const origIsLegacy = targetDateYmd ? targetIsHistorical : isLegacyPreNovInvoice(orig);
    const dup = sameTypeNumOthers.find((other) => isLegacyPreNovInvoice(other) === origIsLegacy);
    if (dup) {
      return {
        blocked: true,
        conflictingDoc: dup,
        isolatedFromHistorical: false,
        seriesEra: '',
        newId: cleanNum
      };
    }
    return {
      blocked: false,
      conflictingDoc: null,
      isolatedFromHistorical: false,
      seriesEra: '',
      newId: origIsLegacy && orig?.id ? String(orig.id) : cleanNum
    };
  }

  const isOtherHistorical = (other) => {
    const d = extractDateYmd(other);
    return Boolean(d && d < INVOICE_SERIES_RESET_DATE) || (!d && /^fac-[1-9]\d{0,3}$/i.test(String(other?.id || '').trim()));
  };
  const sameEraDup = sameTypeNumOthers.find((other) => isOtherHistorical(other) === targetIsHistorical);
  const historicalDup = sameTypeNumOthers.find((other) => isOtherHistorical(other));

  if (sameEraDup) {
    return {
      blocked: true,
      conflictingDoc: sameEraDup,
      isolatedFromHistorical: false,
      seriesEra: '',
      newId: `NE-${cleanNum}`
    };
  }

  if (!targetIsHistorical && historicalDup) {
    return {
      blocked: false,
      conflictingDoc: null,
      isolatedFromHistorical: true,
      conflictingHistoricalDoc: historicalDup,
      seriesEra: '2026-11',
      newId: `NE-${cleanNum}-202611`
    };
  }

  if (cleanNum === origPad6 && targetTipo === origTipo && (orig?.seriesEra || orig?.series_era)) {
    return {
      blocked: false,
      conflictingDoc: null,
      isolatedFromHistorical: true,
      seriesEra: String(orig.seriesEra || orig.series_era),
      newId: String(orig.id || `NE-${cleanNum}`)
    };
  }

  return {
    blocked: false,
    conflictingDoc: null,
    isolatedFromHistorical: false,
    seriesEra: '',
    newId: `NE-${cleanNum}`
  };
};

/**
 * Genera el nuevo correlativo fiscal de factura de 6 dígitos consecutivos.
 * Evita colisiones entre navegadores/PCs verificando siempre contra los documentos reales.
 * @param {Array} sales - Lista de ventas/facturas existentes
 * @param {Array} [extraDocs] - Documentos adicionales (ej. profit_invoices) a considerar
 * @returns {string} - Correlativo formateado a 6 dígitos
 */
export const getNextInvoiceCorrelativo = (sales = [], extraDocs = []) => {
  // Inicialización automática obligatoria de la nueva serie "000000" para Contado y Crédito
  try {
    const initFlag = localStorage.getItem('sm_invoice_correlativo_zero_init');
    if (!initFlag) {
      localStorage.setItem('sm_invoice_correlativo_zero_init', 'true');
      localStorage.setItem('sm_invoice_correlativo_force', '0');
      localStorage.setItem('sm_invoice_correlativo_seq', '0');
    }
  } catch (_) {}

  let highest = -1;
  const usedActiveFacturaNums = new Set();
  let maxLowSeries = -1;
  const list = [...(Array.isArray(sales) ? sales : []), ...(Array.isArray(extraDocs) ? extraDocs : [])];

  list.forEach(s => {
    if (!s) return;
    const rawTipo = String(s.tipoDoc || s.tipo_doc || '').toUpperCase().trim();
    const rawId = String(s.id || '').trim();
    const raw = String(s.numeroDoc || s.numero_doc || s.nroFactura || s.factNum || s.fact_num || '');
    if (rawTipo && rawTipo !== 'FACTURA') return;
    if (/^(NE-|NDE-|NC-|ND-)/i.test(rawId) || /^(NE-|NDE-|NC-|ND-)/i.test(raw)) return;
    if (!raw) return;
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly) {
      const val = parseInt(digitsOnly, 10);
      if (!isNaN(val) && val >= 0 && val <= 999999) {
        const rawDateStr = String(s.fechaEmision || s.fec_emis || s.fecha || s.created_at || '').trim();
        const isLegacyProfitBatch =
          (/^fac-[1-9]\d{0,3}$/i.test(rawId) && (!rawDateStr || rawDateStr.slice(0, 10) < INVOICE_SERIES_RESET_DATE)) ||
          (/^\d{4}-\d{2}-\d{2}/.test(rawDateStr) && rawDateStr.slice(0, 10) < INVOICE_SERIES_RESET_DATE);

        if (!isLegacyProfitBatch) {
          usedActiveFacturaNums.add(val);
          if (val < 400 && val > maxLowSeries) {
            maxLowSeries = val;
          }
          // Valid correlativo en la serie activa iniciada desde 000000 (aislando semillas demo >= 1000)
          if (val < 50000 && (val < 1000 || highest > 900) && val > highest) {
            highest = val;
          }
        }
      }
    }
  });

  // 1. Si el usuario reinició o fijó explícitamente el correlativo (evitando colisión con otra PC en la serie activa)
  try {
    const forcedSeq = localStorage.getItem('sm_invoice_correlativo_force');
    const isManualOverride = localStorage.getItem('sm_invoice_correlativo_manual') === 'true';
    if (forcedSeq !== null && forcedSeq !== '') {
      const forcedVal = parseInt(forcedSeq, 10);
      if (!isNaN(forcedVal) && forcedVal >= 0 && forcedVal <= 999999) {
        let candidate = forcedVal;
        if (!isManualOverride && maxLowSeries >= forcedVal) {
          candidate = maxLowSeries + 1;
        }
        // Evitar colisión contra la serie activa (>= nov-2026); el histórico Profit (< nov-2026) va en serie separada
        while (usedActiveFacturaNums.has(candidate) && candidate < 999999) {
          candidate++;
        }
        return String(candidate).padStart(6, '0');
      }
    }
  } catch (_) {}

  try {
    const storedSeq = localStorage.getItem('sm_invoice_correlativo_seq');
    if (storedSeq !== null && storedSeq !== '') {
      const storedVal = parseInt(storedSeq, 10);
      if (!isNaN(storedVal) && storedVal >= 0 && (storedVal < 1000 || highest > 900) && storedVal > highest) {
        highest = storedVal - 1;
      }
    }
  } catch (_) {}

  let nextVal = highest >= 0 ? highest + 1 : 0;
  while (usedActiveFacturaNums.has(nextVal) && nextVal < 999999) {
    nextVal++;
  }
  return String(nextVal).padStart(6, '0');
};

/**
 * Registra y actualiza el último correlativo de factura de 6 dígitos emitido.
 * @param {string|number} correlativo
 */
export const commitInvoiceCorrelativo = (correlativo) => {
  try {
    const val = parseInt(String(correlativo).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val) && val >= 0) {
      const nextSeq = String(val >= 999999 ? 0 : val + 1);
      localStorage.setItem('sm_invoice_correlativo_seq', nextSeq);
      localStorage.setItem('sm_invoice_correlativo_force', nextSeq);
    }
  } catch (_) {}
};

/**
 * Calcula el próximo correlativo de Nota de Entrega (NE-XXXXXX) o documento no-factura
 * revisando tanto sales como profit_invoices y almacenamiento local para evitar colisiones.
 */
export const getNextNotaEntregaCorrelativo = (sales = [], invoices = [], prefix = 'NE') => {
  const cleanPrefix = String(prefix || 'NE').toUpperCase().trim();
  let highest = 0;
  const usedNums = new Set();

  const inspectRecord = (rec) => {
    if (!rec) return;
    const rawTipo = String(rec.tipoDoc || rec.tipo_doc || '').toUpperCase().trim();
    const rawNum = String(rec.numeroDoc ?? rec.numero_doc ?? rec.factNum ?? rec.fact_num ?? rec.factura ?? rec.id ?? '').trim();
    const rawId = String(rec.id || '').trim();

    if (cleanPrefix === 'NE') {
      const isNe =
        rawTipo === 'NOTA_ENTREGA' ||
        rawTipo === 'N/E' ||
        rawTipo === 'NE' ||
        /^(NE-|NDE-)/i.test(rawNum) ||
        /^(NE-|NDE-)/i.test(rawId);
      if (!isNe) return;
    } else if (cleanPrefix === 'NC' && rawTipo !== 'NOTA_CREDITO' && !/^NC-/i.test(rawNum)) {
      return;
    } else if (cleanPrefix === 'ND' && rawTipo !== 'NOTA_DEBITO' && !/^ND-/i.test(rawNum)) {
      return;
    }

    for (const candidate of [rawNum, rawId]) {
      const digits = String(candidate || '').replace(/[^0-9]/g, '');
      if (digits) {
        const val = parseInt(digits, 10);
        if (!isNaN(val) && val > 0 && val < 900000) {
          usedNums.add(val);
          if (val > highest) highest = val;
        }
      }
    }
  };

  if (Array.isArray(sales)) sales.forEach(inspectRecord);
  if (Array.isArray(invoices)) invoices.forEach(inspectRecord);

  // 1. Si el usuario fijó manualmente el correlativo de Nota de Entrega (evitando colisión con otra PC)
  try {
    if (cleanPrefix === 'NE' && typeof localStorage !== 'undefined') {
      const forcedSeq = localStorage.getItem('sm_ne_correlativo_force');
      if (forcedSeq !== null && forcedSeq !== '') {
        const forcedVal = parseInt(forcedSeq, 10);
        if (!isNaN(forcedVal) && forcedVal >= 0 && forcedVal <= 999999) {
          let candidate = forcedVal;
          while (usedNums.has(candidate) && candidate < 999999) {
            candidate++;
          }
          return `NE-${String(candidate).padStart(6, '0')}`;
        }
      }
    }
  } catch (_) {}

  try {
    if (typeof localStorage !== 'undefined') {
      const rawCustom = localStorage.getItem('signum_cxc_custom_docs_v1');
      if (rawCustom) {
        const customMap = JSON.parse(rawCustom);
        if (customMap && typeof customMap === 'object') {
          Object.values(customMap).forEach(inspectRecord);
        }
      }
      if (cleanPrefix === 'NE') {
        const storedNeSeq = localStorage.getItem('sm_ne_correlativo_seq');
        if (storedNeSeq) {
          const seqVal = parseInt(storedNeSeq, 10);
          if (!isNaN(seqVal) && seqVal > 1 && seqVal - 1 > highest) {
            highest = seqVal - 1;
          }
        }
      }
    }
  } catch (_) {}

  let nextVal = highest + 1;
  while (usedNums.has(nextVal) && nextVal < 999999) {
    nextVal++;
  }
  return `${cleanPrefix}-${String(nextVal).padStart(6, '0')}`;
};

export const commitNotaEntregaCorrelativo = (correlativo) => {
  try {
    const val = parseInt(String(correlativo || '').replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val) && val >= 0 && typeof localStorage !== 'undefined') {
      const nextSeq = String(val >= 999999 ? 1 : val + 1);
      const prev = parseInt(localStorage.getItem('sm_ne_correlativo_seq') || '0', 10) || 0;
      if (val + 1 > prev) {
        localStorage.setItem('sm_ne_correlativo_seq', nextSeq);
      }
      if (localStorage.getItem('sm_ne_correlativo_force') !== null) {
        localStorage.setItem('sm_ne_correlativo_force', nextSeq);
      }
    }
  } catch (_) {}
};

/**
 * Establece o reinicia manualmente el próximo número de Nota de Entrega (NE-XXXXXX).
 * @param {number|string} startAt
 * @returns {string}
 */
export const setNotaEntregaCorrelativo = (startAt = 1) => {
  const num = typeof startAt === 'number'
    ? startAt
    : parseInt(String(startAt || '').replace(/[^0-9]/g, ''), 10);
  const safeNum = Math.max(0, Math.min(999999, isNaN(num) ? 1 : num));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sm_ne_correlativo_force', String(safeNum));
      localStorage.setItem('sm_ne_correlativo_seq', String(safeNum));
    }
  } catch (_) {}
  return `NE-${String(safeNum).padStart(6, '0')}`;
};

export const clearNotaEntregaCorrelativoForce = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sm_ne_correlativo_force');
      localStorage.removeItem('sm_ne_correlativo_seq');
    }
  } catch (_) {}
};

/**
 * Establece o reinicia el contador de facturas oficiales desde un valor numérico definido manualmente.
 * Permite al usuario decidir a partir de cuál número de factura desea empezar a facturar (0 para "000000", 50 para "000050", etc.).
 * @param {number|string} startAt - Número desde el cual inicializar
 * @returns {string} - Nuevo correlativo formateado a 6 dígitos ("000000")
 */
export const setInvoiceCorrelativo = (startAt = 0) => {
  const num = typeof startAt === 'number' ? startAt : (parseInt(String(startAt).replace(/[^0-9]/g, ''), 10) || 0);
  const safeNum = Math.max(0, Math.min(999999, isNaN(num) ? 0 : num));
  try {
    localStorage.setItem('sm_invoice_correlativo_zero_init', 'true');
    localStorage.setItem('sm_invoice_correlativo_force', String(safeNum));
    localStorage.setItem('sm_invoice_correlativo_seq', String(safeNum));
    localStorage.setItem('sm_invoice_correlativo_manual', 'true');
  } catch (_) {}
  return String(safeNum).padStart(6, '0');
};

/**
 * Alias de compatibilidad para inicializar correlativo
 */
export const resetInvoiceCorrelativo = setInvoiceCorrelativo;

// ==============================================================================
// CORRELATIVO DE MOVIMIENTOS Y REPORTE DE ABONOS EN CUENTAS POR COBRAR (CxC)
// ==============================================================================

const CXC_MOV_SERIES_CUTOFF_MS = new Date('2026-11-01T00:00:00Z').getTime();

const collectUsedCxcMovementNumbers = (collections = [], docs = []) => {
  const usedModernNums = new Set();
  const usedModernStrings = new Set();

  const registerMov = (rawCode, fechaStr) => {
    if (!rawCode && rawCode !== 0) return;
    const rawStr = String(rawCode).trim();
    if (!rawStr) return;
    const isModernFormat =
      /^(MOV-|COB-)/i.test(rawStr) ||
      (/^0\d{5,}$/.test(rawStr));
    const parsedTime = fechaStr ? Date.parse(fechaStr) : NaN;
    const isModernDate = !isNaN(parsedTime) && parsedTime >= CXC_MOV_SERIES_CUTOFF_MS;
    if (!isModernFormat && !isModernDate) return;

    const digitsMatch = rawStr.match(/\d+/);
    if (digitsMatch) {
      const n = parseInt(digitsMatch[0], 10);
      if (!isNaN(n) && n >= 0) {
        usedModernNums.add(n);
        usedModernStrings.add(String(n).padStart(6, '0'));
      }
    }
  };

  (collections || []).forEach((c) => {
    if (!c || c.anulado) return;
    registerMov(
      String(c.correlativo || '').trim() || c.cobNum || c.cob_num,
      c.fecha || c.fec_cob || c.fechaCobro || c.fechaSincronizacion
    );
  });

  (docs || []).forEach((d) => {
    const hist = Array.isArray(d?.historialCobros) ? d.historialCobros : [];
    hist.forEach((h) => {
      if (!h) return;
      registerMov(String(h.correlativo || '').trim() || h.cobNum || h.cob_num, h.fecha);
    });
  });

  return { usedModernNums, usedModernStrings };
};

/**
 * Calcula el próximo correlativo secuencial (6 dígitos) para movimientos/abonos CxC.
 * Respeta fijación manual o continúa automáticamente evitando colisiones.
 */
export const getNextCxcMovementCorrelativo = (collections = [], docs = []) => {
  const { usedModernNums, usedModernStrings } = collectUsedCxcMovementNumbers(collections, docs);
  let highestModern = 0;
  usedModernNums.forEach((n) => {
    if (n > highestModern) highestModern = n;
  });

  let nextVal = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const forced = localStorage.getItem('sm_cxc_mov_correlativo_force');
      const isManual = localStorage.getItem('sm_cxc_mov_correlativo_manual') === 'true';
      const stored = localStorage.getItem('sm_cxc_mov_correlativo_seq');

      if (forced !== null && forced !== '') {
        const fVal = parseInt(forced, 10);
        if (!isNaN(fVal) && fVal >= 1) {
          nextVal = isManual ? fVal : Math.max(fVal, highestModern + 1);
        }
      } else if (stored !== null && stored !== '') {
        const sVal = parseInt(stored, 10);
        if (!isNaN(sVal) && sVal >= 1) {
          nextVal = Math.max(sVal, highestModern + 1);
        }
      }
    }
  } catch (_) {}

  if (nextVal === null) {
    nextVal = highestModern + 1;
  }

  let candidate = Math.max(1, Math.min(999999, nextVal));
  let guard = 0;
  while (usedModernStrings.has(String(candidate).padStart(6, '0')) && guard < 500) {
    candidate = candidate >= 999999 ? 1 : candidate + 1;
    guard++;
  }

  return String(candidate).padStart(6, '0');
};

/**
 * Confirma y avanza el correlativo de movimientos CxC luego de guardar un abono.
 */
export const commitCxcMovementCorrelativo = (correlativo) => {
  try {
    const val = parseInt(String(correlativo || '').replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val) && val >= 1 && typeof localStorage !== 'undefined') {
      const nextSeq = String(val >= 999999 ? 1 : val + 1);
      localStorage.setItem('sm_cxc_mov_correlativo_seq', nextSeq);
      localStorage.setItem('sm_cxc_mov_correlativo_force', nextSeq);
    }
  } catch (_) {}
};

/**
 * Fija manualmente el próximo correlativo de movimientos CxC.
 */
export const setCxcMovementCorrelativo = (startAt = 1) => {
  const num = typeof startAt === 'number'
    ? startAt
    : parseInt(String(startAt || '').replace(/[^0-9]/g, ''), 10);
  const safeNum = Math.max(1, Math.min(999999, isNaN(num) ? 1 : num));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sm_cxc_mov_correlativo_force', String(safeNum));
      localStorage.setItem('sm_cxc_mov_correlativo_seq', String(safeNum));
      localStorage.setItem('sm_cxc_mov_correlativo_manual', 'true');
    }
  } catch (_) {}
  return String(safeNum).padStart(6, '0');
};

/**
 * Restaura la secuencia automática de correlativos de movimientos CxC.
 */
export const clearCxcMovementCorrelativoForce = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sm_cxc_mov_correlativo_force');
      localStorage.removeItem('sm_cxc_mov_correlativo_seq');
      localStorage.removeItem('sm_cxc_mov_correlativo_manual');
    }
  } catch (_) {}
};

/**
 * Obtiene el correlativo actual del Reporte Impreso de Movimientos CxC (6 dígitos).
 */
export const getCxcMovementReportCorrelativo = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('sm_cxc_mov_report_seq');
      if (stored !== null && stored !== '') {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val >= 1) {
          return String(Math.min(999999, val)).padStart(6, '0');
        }
      }
    }
  } catch (_) {}
  return '000001';
};

/**
 * Fija manualmente el correlativo del Reporte Impreso de Movimientos CxC.
 */
export const setCxcMovementReportCorrelativo = (startAt = 1) => {
  const num = typeof startAt === 'number'
    ? startAt
    : parseInt(String(startAt || '').replace(/[^0-9]/g, ''), 10);
  const safeNum = Math.max(1, Math.min(999999, isNaN(num) ? 1 : num));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sm_cxc_mov_report_seq', String(safeNum));
    }
  } catch (_) {}
  return String(safeNum).padStart(6, '0');
};

/**
 * Avanza al siguiente número de correlativo del Reporte Impreso de Movimientos CxC.
 */
export const commitCxcMovementReportCorrelativo = (currentVal) => {
  try {
    const val = parseInt(String(currentVal || '').replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val) && val >= 1 && typeof localStorage !== 'undefined') {
      const nextSeq = val >= 999999 ? 1 : val + 1;
      localStorage.setItem('sm_cxc_mov_report_seq', String(nextSeq));
      return String(nextSeq).padStart(6, '0');
    }
  } catch (_) {}
  return getCxcMovementReportCorrelativo();
};

/**
 * Genera el Número de Comprobante de Retención de IVA de 14 dígitos.
 * Formato oficial: AAAAMM + 8 dígitos consecutivos (Providencia SNAT/2013/00030 Art. 16).
 * Ejemplo: 20260900000142
 * @param {Date} date 
 * @param {number} sequenceNumber 
 * @returns {string}
 */
export const generateVatRetentionVoucherNumber = (date = new Date(), sequenceNumber = 1) => {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(sequenceNumber).padStart(8, '0');
  return `${yyyy}${mm}${seq}`;
};

// ==============================================================================
// 4. GENERADORES DE ARCHIVOS OFICIALES SENIAT (TXT Y XML)
// ==============================================================================

/**
 * Genera el archivo plano TXT para la carga masiva de Retenciones de IVA en el portal fiscal del SENIAT.
 * 
 * Estructura de 16 campos separados por tabulador ('\t') según manual técnico del SENIAT:
 * 1. RIF del Agente de Retención (10 caracteres, sin guiones)
 * 2. Período Fiscal (AAAAMM)
 * 3. Fecha del Documento (AAAA-MM-DD)
 * 4. Tipo de Operación ('C' para Compras)
 * 5. Tipo de Documento ('01': Factura, '02': Nota Débito, '03': Nota Crédito)
 * 6. RIF del Sujeto Retenido (10 caracteres, sin guiones)
 * 7. Número de Factura / Documento (hasta 20 caracteres)
 * 8. Número de Control Fiscal (hasta 20 caracteres)
 * 9. Monto Total del Documento con IVA (con 2 decimales, punto como separador)
 * 10. Base Imponible Gravada
 * 11. Monto del Impuesto IVA Retenido
 * 12. Número del Documento Afectado (si no aplica, colocar '0')
 * 13. Número del Comprobante de Retención (14 dígitos: AAAAMMDDDDDDDD)
 * 14. Monto Exento del Documento
 * 15. Alícuota de IVA (ej: 16.00)
 * 16. Número de Expediente ('0' por defecto)
 * 
 * @param {Array} retencionesList - Lista de registros de retención de IVA
 * @param {Object} config - Configuración de la empresa emisora
 * @returns {string} - Contenido en texto plano del archivo TXT
 */
const VALID_FISCAL_DOC_TYPES = new Set(['FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO']);

/**
 * Determina si un documento pertenece al universo fiscal SENIAT (excluye NOTA_ENTREGA, COTIZACION, etc.).
 */
export const isFiscalDocEligible = (doc) => {
  if (!doc) return false;
  const rawTipo = String(doc.tipoDoc || doc.tipo_doc || 'FACTURA').toUpperCase().trim();
  const rawNum = String(doc.numeroDoc ?? doc.numero_doc ?? doc.factNum ?? doc.fact_num ?? '').toUpperCase().trim();
  const rawId = String(doc.id || '').toUpperCase().trim();
  if (/^(NE-|N\.E-|NDE-|COT-|PED-|PRE-)/.test(rawNum) || /^(NE-|N\.E-|NDE-|COT-|PED-|PRE-)/.test(rawId)) {
    return false;
  }
  return VALID_FISCAL_DOC_TYPES.has(rawTipo);
};

/**
 * Escapa caracteres reservados XML para preservar la validez del esquema SENIAT.
 */
const escapeXml = (val = '') => String(val ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/**
 * Codifica una cadena a bytes reales ISO-8859-1 (Latin-1) para exportaciones XML SENIAT.
 */
export const encodeIso88591Bytes = (str = '') => {
  const s = String(str || '');
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes[i] = code <= 0xFF ? code : 0x3F; // '?' para caracteres fuera de Latin-1
  }
  return bytes;
};

/**
 * Genera el próximo correlativo secuencial oficial de 14 dígitos para comprobante de retención ISLR (AAAAMM + 8 dígitos).
 */
export const generateNextIslrVoucherNumber = (existingWithholdings = [], periodoFiscal = '') => {
  const now = new Date();
  const cleanPeriod = String(periodoFiscal || '').replace(/[^0-9]/g, '');
  const periodPrefix = cleanPeriod.length === 6
    ? cleanPeriod
    : `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  let maxSeq = 0;
  (existingWithholdings || []).forEach((w) => {
    const nro = String(w?.nroComprobante || w?.nro_comprobante || '').replace(/[^0-9]/g, '');
    if (nro.length >= 14 && nro.startsWith(periodPrefix)) {
      const seqPart = parseInt(nro.slice(6), 10);
      if (!isNaN(seqPart) && seqPart > maxSeq) maxSeq = seqPart;
    } else if (nro.length > 0 && nro.startsWith(periodPrefix)) {
      const seqPart = parseInt(nro.slice(periodPrefix.length), 10);
      if (!isNaN(seqPart) && seqPart > maxSeq) maxSeq = seqPart;
    }
  });
  return `${periodPrefix}${String(maxSeq + 1).padStart(8, '0')}`;
};

const normalizeSeniatCleanRif = (rawRif = '') => {
  const validation = validateRif(String(rawRif || ''));
  if (validation.isValid && validation.formatted) {
    return validation.formatted.replace(/-/g, '').toUpperCase();
  }
  return String(rawRif || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
};

export const generateSeniatVatRetentionTxt = (retencionesList = [], config = {}) => {
  const cleanAgentRif = normalizeSeniatCleanRif(config.rif || 'J-31115365-9');

  const lines = (retencionesList || []).reduce((acc, ret) => {
    const montoRetNum = Number(ret?.montoRetenidoBs ?? 0);
    const comprobanteNro = String(ret?.comprobanteNro || ret?.comprobanteRetencion || ret?.comprobanteRetencionIva || '').trim();
    const provRifCheck = validateRif(String(ret?.proveedorRif || ''));
    const cleanProvRif = provRifCheck.isValid
      ? provRifCheck.formatted.replace(/-/g, '').toUpperCase()
      : '';

    // Excluir registros sin retención real, sin comprobante de 14 dígitos o con RIF inválido/placeholder
    if (montoRetNum <= 0 || !/^\d{14}$/.test(comprobanteNro) || !cleanProvRif || cleanProvRif.length !== 10 || /^[VEJPG]0{9}$/.test(cleanProvRif)) {
      return acc;
    }

    const d = new Date(ret.fechaEmision || new Date());
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const periodo = ret.periodoFiscal || `${validDate.getFullYear()}${String(validDate.getMonth() + 1).padStart(2, '0')}`;
    const fechaDoc = `${validDate.getFullYear()}-${String(validDate.getMonth() + 1).padStart(2, '0')}-${String(validDate.getDate()).padStart(2, '0')}`;

    const tipoOperacion = ret.tipoOperacion || 'C';
    const tipoDoc = ret.tipoDocumento || '01'; // 01 Factura, 02 ND, 03 NC
    const numDoc = String(ret.numeroDocumento || ret.numeroFactura || '').trim().slice(0, 20);
    const numCtrl = String(ret.numeroControl || '').trim().slice(0, 20);

    const totalDoc = Number(ret.totalDocumentoBs ?? 0).toFixed(2);
    const baseImp = Number(ret.baseImponibleBs ?? 0).toFixed(2);
    const montoRet = montoRetNum.toFixed(2);

    const docAfectado = (ret.documentoAfectado && String(ret.documentoAfectado).trim() !== '') ? String(ret.documentoAfectado).trim() : '0';
    const montoExento = Number(ret.montoExentoBs ?? 0).toFixed(2);
    const rawAlicuota = Number(ret.alicuota ?? 16.00);
    const alicuota = (Number.isFinite(rawAlicuota) ? rawAlicuota : 16.00).toFixed(2);
    const numExpediente = (ret.numeroExpediente && String(ret.numeroExpediente).trim() !== '') ? String(ret.numeroExpediente).trim() : '0';

    acc.push([
      cleanAgentRif,
      periodo,
      fechaDoc,
      tipoOperacion,
      tipoDoc,
      cleanProvRif,
      numDoc,
      numCtrl,
      totalDoc,
      baseImp,
      montoRet,
      docAfectado,
      comprobanteNro,
      montoExento,
      alicuota,
      numExpediente
    ].join('\t'));
    return acc;
  }, []);

  return lines.join('\r\n');
};

/**
 * Genera el archivo XML estandarizado para la declaración masiva de Retenciones de ISLR ante el portal SENIAT.
 * Conforme con el esquema XSD de la Administración Tributaria.
 * 
 * @param {Array} retencionesIslrList 
 * @param {Object} config 
 * @returns {string} - Cadena XML con codificación ISO-8859-1
 */
export const generateSeniatIslrXml = (retencionesIslrList = [], config = {}) => {
  const cleanAgentRif = escapeXml(normalizeSeniatCleanRif(config.rif || 'J-31115365-9'));
  const firstPeriod = retencionesIslrList[0]?.periodoFiscal
    ? String(retencionesIslrList[0].periodoFiscal).replace(/[^0-9]/g, '')
    : '';
  const currentPeriod = escapeXml(firstPeriod || `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
  xml += `<RelacionRetencionesISLR RifAgente="${cleanAgentRif}" Periodo="${currentPeriod}">\n`;

  (retencionesIslrList || []).forEach(item => {
    if (!item) return;
    const cleanProvRif = escapeXml(normalizeSeniatCleanRif(item.proveedorRif || ''));
    const d = new Date(item.fechaEmision || item.fecha || new Date());
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const fechaOperacion = `${String(validDate.getDate()).padStart(2, '0')}/${String(validDate.getMonth() + 1).padStart(2, '0')}/${validDate.getFullYear()}`;
    const isUsd = String(item.moneda || 'BS').toUpperCase() === 'USD';
    const fx = Number(item.tasaCambio || item.tasaDolar || config?.tasaDolar || 1);
    const rawBaseOp = item.montoOperacionBs ?? (isUsd ? Number(item.baseImponible || 0) * fx : Number(item.baseImponible || 0));
    const montoOp = Number(rawBaseOp || 0).toFixed(2);
    const pctRet = Number(item.porcentajeRetencion ?? 0).toFixed(2);
    const nroFac = escapeXml(String(item.numeroFactura || item.nroFacturaAfectada || '').trim());
    const nroCtrl = escapeXml(String(item.numeroControl || item.nroControl || '').trim());
    const codConcepto = escapeXml(String(item.codigoConcepto || item.codigoConceptoIslr || '055').trim());

    xml += `  <DetalleRetencion>\n`;
    xml += `    <RifRetenido>${cleanProvRif}</RifRetenido>\n`;
    xml += `    <NumeroFactura>${nroFac}</NumeroFactura>\n`;
    xml += `    <NumeroControl>${nroCtrl}</NumeroControl>\n`;
    xml += `    <FechaOperacion>${fechaOperacion}</FechaOperacion>\n`;
    xml += `    <CodigoConcepto>${codConcepto}</CodigoConcepto>\n`;
    xml += `    <MontoOperacion>${montoOp}</MontoOperacion>\n`;
    xml += `    <PorcentajeRetencion>${pctRet}</PorcentajeRetencion>\n`;
    xml += `  </DetalleRetencion>\n`;
  });

  xml += `</RelacionRetencionesISLR>`;
  return xml;
};

// ==============================================================================
// 5. CONSTRUCTORES DE LIBROS FISCALES OFICIALES (VENTAS Y COMPRAS)
// ==============================================================================

/**
 * Prepara las filas oficiales del Libro de Ventas conforme al Art. 76 del Reglamento de la Ley del IVA.
 * Excluye Notas de Entrega y Cotizaciones; registra anuladas con montos en cero (XX-ANU).
 */
export const buildLibroVentasRows = (sales = [], config = {}) => {
  const safeConfig = config || {};
  const fiscalSales = (sales || []).filter(isFiscalDocEligible);

  return fiscalSales.map((sale, index) => {
    const fecha = new Date(sale.fecha || new Date()).toLocaleDateString('es-VE');
    const tasa = Number(sale.tasaDolar || safeConfig.tasaDolar || 827.73);
    const upperTipo = String(sale.tipoDoc || sale.tipo_doc || 'FACTURA').toUpperCase().trim();
    const anulada = String(sale.estado || '').toUpperCase().trim() === 'ANULADA' || Boolean(sale.anulada);

    // Tipos: FACTURA -> 01, NOTA_DEBITO -> 02, NOTA_CREDITO -> 03 (sufijo -ANU si anulada)
    const baseTipo = upperTipo === 'NOTA_CREDITO' ? '03' : (upperTipo === 'NOTA_DEBITO' ? '02' : '01');
    const tipoTransaccion = `${baseTipo}-${anulada ? 'ANU' : 'REG'}`;
    const signo = upperTipo === 'NOTA_CREDITO' ? -1 : 1;

    const rawTotalBs = sale.totalBs ?? (sale.totalUsd != null ? Number(sale.totalUsd) * tasa : 0);
    const rawExentaBs = sale.baseExentaBs ?? (sale.baseExentaUsd != null ? Number(sale.baseExentaUsd) * tasa : 0);
    const rawBase16Bs = sale.baseGeneralBs ?? (
      sale.baseGeneralUsd != null
        ? Number(sale.baseGeneralUsd) * tasa
        : (rawExentaBs > 0 ? 0 : (sale.subtotalBs ?? (Number(sale.subtotalUsd || 0) * tasa)))
    );
    const rawIva16Bs = sale.ivaGeneralBs ?? sale.ivaBs ?? (
      sale.ivaGeneralUsd != null
        ? Number(sale.ivaGeneralUsd) * tasa
        : (Number(sale.ivaUsd || 0) * tasa)
    );
    const rawBase8Bs = sale.baseReducidaBs ?? (sale.baseReducidaUsd != null ? Number(sale.baseReducidaUsd) * tasa : 0);
    const rawIva8Bs = sale.ivaReducidaBs ?? (sale.ivaReducidaUsd != null ? Number(sale.ivaReducidaUsd) * tasa : 0);
    const rawBase31Bs = sale.baseAdicionalBs ?? (sale.baseAdicionalUsd != null ? Number(sale.baseAdicionalUsd) * tasa : 0);
    const rawIva31Bs = sale.ivaAdicionalBs ?? (sale.ivaAdicionalUsd != null ? Number(sale.ivaAdicionalUsd) * tasa : 0);
    const rawIgtfBs = sale.igtfBs ?? (Number(sale.igtfUsd || 0) * tasa);
    const rawRetIvaBs = sale.retencionIvaBs ?? 0;

    const totalVentasBs = anulada ? 0 : roundTo2Decimals(Number(rawTotalBs || 0) * signo);
    const ventasExentasBs = anulada ? 0 : roundTo2Decimals(Number(rawExentaBs || 0) * signo);
    const baseImponible16Bs = anulada ? 0 : roundTo2Decimals(Number(rawBase16Bs || 0) * signo);
    const iva16Bs = anulada ? 0 : roundTo2Decimals(Number(rawIva16Bs || 0) * signo);
    const baseImponible8Bs = anulada ? 0 : roundTo2Decimals(Number(rawBase8Bs || 0) * signo);
    const iva8Bs = anulada ? 0 : roundTo2Decimals(Number(rawIva8Bs || 0) * signo);
    const baseImponible31Bs = anulada ? 0 : roundTo2Decimals(Number(rawBase31Bs || 0) * signo);
    const iva31Bs = anulada ? 0 : roundTo2Decimals(Number(rawIva31Bs || 0) * signo);
    const igtfBs = anulada ? 0 : roundTo2Decimals(Number(rawIgtfBs || 0) * signo);
    const retencionIvaBs = anulada ? 0 : roundTo2Decimals(Number(rawRetIvaBs || 0) * signo);

    const rifCliente = sale.clienteRif || 'V-00000000-0';
    const rifVal = validateRif(rifCliente);

    return {
      numOperacion: index + 1,
      fecha,
      rifCliente,
      rifValido: rifVal.isValid,
      nombreCliente: anulada ? `${sale.clienteNombre || 'CLIENTE CONTADO'} (ANULADA)` : (sale.clienteNombre || 'CLIENTE CONTADO'),
      anulada,
      sinDesgloseIva: !anulada && baseImponible16Bs > 0 && iva16Bs === 0,
      tipoTransaccion,
      numeroFactura: sale.numeroDoc || `FACT-${String(index + 1).padStart(6, '0')}`,
      numeroControl: sale.numeroControl || generateFiscalControlNumber(index + 1),
      facturaAfectada: sale.documentoAfectado || '',
      comprobanteRetencion: anulada ? '' : (sale.comprobanteRetencionIva || sale.comprobanteRetencionNro || sale.comprobanteRetencion || ''),
      totalVentasBs,
      ventasExentasBs,
      baseImponible16Bs,
      alicuota16: 16.00,
      iva16Bs,
      baseImponible8Bs,
      alicuota8: 8.00,
      iva8Bs,
      baseImponible31Bs,
      alicuota31: 31.00,
      iva31Bs,
      igtfBs,
      retencionIvaBs,
      tasaBcv: tasa
    };
  });
};

/**
 * Prepara las filas oficiales del Libro de Compras conforme al Art. 75 del Reglamento de la Ley del IVA.
 * Respeta montos exentos y retenciones en cero (no inventa 16%, 75% ni 2%); soporta NC/ND y anulaciones.
 */
export const buildLibroComprasRows = (purchases = [], config = {}) => {
  const safeConfig = config || {};
  return (purchases || []).map((pur, index) => {
    const rawFecha = pur.fecha || pur.fechaEmision || pur.fechaCompra || new Date().toISOString();
    const fecha = new Date(rawFecha).toLocaleDateString('es-VE');
    const rawTotBs = pur.totalBs ?? pur.totNetoBs;
    const rawTotUsd = pur.totalUsd ?? pur.totNetoUsd;
    const inferredRate = (Number(rawTotBs || 0) > 0 && Number(rawTotUsd || 0) > 0)
      ? roundTo2Decimals(Number(rawTotBs) / Number(rawTotUsd))
      : 0;
    const tasa = Number(pur.tasaDolar || pur.tasaBcv || inferredRate || safeConfig.tasaDolar || 827.73);

    const upperTipo = String(pur.tipoDoc || pur.tipo_doc || 'FACTURA').toUpperCase().trim();
    const anulada = String(pur.estado || pur.status || '').toUpperCase().trim() === 'ANULADA' || Boolean(pur.anulada || pur.anulado);
    const baseTipo = upperTipo === 'NOTA_CREDITO' ? '03' : (upperTipo === 'NOTA_DEBITO' ? '02' : '01');
    const tipoTransaccion = `${baseTipo}-${anulada ? 'ANU' : 'REG'}`;
    const signo = upperTipo === 'NOTA_CREDITO' ? -1 : 1;

    const totalBsVal = Number(rawTotBs ?? (Number(rawTotUsd || 0) * tasa));
    const ivaGeneralBsVal = Number(
      pur.ivaGeneralBs ?? pur.ivaBs ?? (
        pur.ivaGeneralUsd != null
          ? Number(pur.ivaGeneralUsd) * tasa
          : (pur.ivaUsd != null ? Number(pur.ivaUsd) * tasa : 0)
      )
    );
    const baseReducidaBsVal = Number(pur.baseReducidaBs ?? (pur.baseReducidaUsd != null ? Number(pur.baseReducidaUsd) * tasa : 0));
    const explicitBase16 = pur.baseGeneralBs ?? (pur.baseGeneralUsd != null ? Number(pur.baseGeneralUsd) * tasa : undefined);
    const base16Val = explicitBase16 !== undefined
      ? Number(explicitBase16)
      : (ivaGeneralBsVal > 0 ? Number(pur.subtotalBs ?? pur.totBrutoBs ?? (Number(pur.subtotalUsd ?? pur.totBrutoUsd ?? 0) * tasa)) : 0);

    const explicitExenta = pur.montoExentoBs ?? pur.baseExentaBs ?? pur.comprasExentasBs ?? (
      pur.baseExentaUsd != null ? Number(pur.baseExentaUsd) * tasa : undefined
    );
    const exentaVal = explicitExenta !== undefined
      ? Number(explicitExenta)
      : (ivaGeneralBsVal === 0 && base16Val === 0 && baseReducidaBsVal === 0 ? totalBsVal : 0);

    const retIvaVal = Number(pur.retencionIvaBs ?? (pur.retencionIvaUsd != null ? Number(pur.retencionIvaUsd) * tasa : 0));
    const retIslrVal = Number(pur.retencionIslrBs ?? (pur.retencionIslrUsd != null ? Number(pur.retencionIslrUsd) * tasa : 0));

    const totalComprasBs = anulada ? 0 : roundTo2Decimals(totalBsVal * signo);
    const comprasExentasBs = anulada ? 0 : roundTo2Decimals(exentaVal * signo);
    const baseImponible16Bs = anulada ? 0 : roundTo2Decimals(base16Val * signo);
    const creditoFiscal16Bs = anulada ? 0 : roundTo2Decimals(ivaGeneralBsVal * signo);
    const retencionIvaBs = anulada ? 0 : roundTo2Decimals(retIvaVal * signo);
    const retencionIslrBs = anulada ? 0 : roundTo2Decimals(retIslrVal * signo);

    const alicuotaEfectiva = baseImponible16Bs > 0 ? 16.00 : (baseReducidaBsVal > 0 ? 8.00 : 0.00);
    const compRet = pur.comprobanteRetencionIva || pur.numeroComprobanteRetencionIva || '';

    return {
      numOperacion: index + 1,
      fecha,
      rifProveedor: pur.proveedorRif || pur.provRif || 'J-00000000-0',
      nombreProveedor: anulada ? `${pur.proveedorNombre || pur.provNombre || pur.proveedor || 'PROVEEDOR'} (ANULADA)` : (pur.proveedorNombre || pur.provNombre || pur.proveedor || 'PROVEEDOR'),
      anulada,
      tipoTransaccion,
      numeroFactura: pur.numeroFactura || pur.numeroFacturaProv || pur.nroFactura || pur.facturaProv || `FAC-PROV-${String(index + 100).padStart(4, '0')}`,
      numeroControl: pur.numeroControl || pur.nroControl || '00-000000',
      documentoAfectado: pur.documentoAfectado || '',
      comprobanteRetencion: anulada ? '' : compRet,
      totalComprasBs,
      comprasExentasBs,
      baseImponible16Bs,
      alicuota16: alicuotaEfectiva,
      creditoFiscal16Bs,
      retencionIvaBs,
      retencionIslrBs,
      tasaBcv: tasa
    };
  });
};

// ==============================================================================
// 6. MÓDULO DE AUDITORÍA Y CIERRES FISCALES (REPORTE X Y REPORTE Z)
// Providencia Administrativa SENIAT SNAT/2011/00071
// ==============================================================================

/**
 * Genera la firma criptográfica SHA-256 para garantizar la inalterabilidad
 * del Reporte Z en la memoria fiscal digital.
 */
export const calculateFiscalHashSha256 = async (closurePayload) => {
  const dataString = [
    closurePayload.id,
    closurePayload.tipo,
    closurePayload.numeroZ || 0,
    closurePayload.fechaCierre,
    closurePayload.primeraFactura || 'NONE',
    closurePayload.ultimaFactura || 'NONE',
    Number(closurePayload.totalVentasBs || 0).toFixed(2),
    Number(closurePayload.totalDebitoFiscalBs || 0).toFixed(2),
    Number(closurePayload.totalIgtfBs || 0).toFixed(2),
    Number(closurePayload.granTotalHistoricoBs || 0).toFixed(2),
    closurePayload.rifEmisor || 'J-31115365-9'
  ].join('|');

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(dataString);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('Error con crypto.subtle, usando fallback:', e);
    }
  }

  // Fallback seguro en caso de entornos restringidos
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'SHAFALLBACK-' + Math.abs(hash).toString(16).padStart(16, '0') + '-' + Date.now().toString(16);
};

/**
 * Genera el Reporte X (Corte Parcial / Arqueo de Turno Informativo).
 * No altera contadores, no bloquea ventas ni incrementa el correlativo Z.
 */
export const generarReporteX = ({ sales = [], config = {}, currentUser = null }) => {
  const safeConfig = config || {};
  const tasaBcv = Number(safeConfig.tasaDolar) || 827.73;
  const fechaLectura = new Date().toISOString();

  // Filtrar documentos fiscales abiertos / no consolidados en un cierre Z previo (excluye N.E. y anuladas)
  const ventasPendientes = (sales || []).filter(s =>
    isFiscalDocEligible(s) &&
    !s.cierreZId &&
    !s.cierre_z_id &&
    !s.cerrada &&
    String(s.estado || '').toUpperCase() !== 'ANULADA' &&
    !s.anulada
  );

  let primeraFactura = null;
  let ultimaFactura = null;
  let primeraNc = null;
  let ultimaNc = null;
  let primeraNd = null;
  let ultimaNd = null;

  let cantFacturas = 0;
  let cantNc = 0;
  let cantNd = 0;

  let ventasExentasBs = 0;
  let baseGeneralBs = 0;
  let debitoGeneralBs = 0;
  let baseReducidaBs = 0;
  let debitoReducidoBs = 0;
  let baseAdicionalBs = 0;
  let debitoAdicionalBs = 0;

  let baseIgtfBs = 0;
  let totalIgtfBs = 0;

  let totalVentasBs = 0;
  let totalVentasUsd = 0;

  const desglosePagos = {
    EFECTIVO_USD: 0,
    PAGO_MOVIL: 0,
    TRANSFERENCIA_BS: 0,
    PUNTO_VENTA: 0,
    ZELLE: 0,
    USDT: 0,
    CREDITO: 0,
    OTROS: 0
  };

  // Orden cronológico
  const sortedSales = [...ventasPendientes].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  sortedSales.forEach(sale => {
    const isNc = sale.tipoDoc === 'NOTA_CREDITO';
    const isNd = sale.tipoDoc === 'NOTA_DEBITO';
    const signo = isNc ? -1 : 1;
    const saleRate = Number(sale.tasaDolar || tasaBcv);

    if (sale.tipoDoc === 'FACTURA' || !sale.tipoDoc) {
      cantFacturas++;
      if (!primeraFactura) primeraFactura = sale.numeroDoc;
      ultimaFactura = sale.numeroDoc;
    } else if (isNc) {
      cantNc++;
      if (!primeraNc) primeraNc = sale.numeroDoc;
      ultimaNc = sale.numeroDoc;
    } else if (isNd) {
      cantNd++;
      if (!primeraNd) primeraNd = sale.numeroDoc;
      ultimaNd = sale.numeroDoc;
    }

    const exentaRaw = Number(sale.baseExentaBs ?? (Number(sale.baseExentaUsd || 0) * saleRate));
    const base16Raw = Number(sale.baseGeneralBs ?? (
      sale.baseGeneralUsd != null
        ? Number(sale.baseGeneralUsd) * saleRate
        : (exentaRaw > 0 ? 0 : (sale.subtotalBs ?? (Number(sale.subtotalUsd || 0) * saleRate)))
    ));
    const iva16Raw = Number(sale.ivaGeneralBs ?? sale.ivaBs ?? (Number(sale.ivaUsd || 0) * saleRate));
    const exenta = exentaRaw * signo;
    const base16 = base16Raw * signo;
    const iva16 = iva16Raw * signo;
    const base8 = Number(sale.baseReducidaBs ?? 0) * signo;
    const iva8 = Number(sale.ivaReducidaBs ?? 0) * signo;
    const base31 = Number(sale.baseAdicionalBs ?? 0) * signo;
    const iva31 = Number(sale.ivaAdicionalBs ?? 0) * signo;

    ventasExentasBs += exenta;
    baseGeneralBs += base16;
    debitoGeneralBs += iva16;
    baseReducidaBs += base8;
    debitoReducidoBs += iva8;
    baseAdicionalBs += base31;
    debitoAdicionalBs += iva31;

    const bIgtf = Number(sale.baseIgtfBs || 0);
    const mIgtf = Number(sale.igtfBs || 0);
    baseIgtfBs += bIgtf;
    totalIgtfBs += mIgtf;

    const tBs = Number(sale.totalBs ?? (Number(sale.totalUsd || 0) * saleRate)) * signo;
    const tUsd = Number(sale.totalUsd || 0) * signo;
    totalVentasBs += tBs;
    totalVentasUsd += tUsd;

    // Desglose de pagos
    const metodo = (sale.metodoPago || 'OTROS').toUpperCase();
    if (desglosePagos[metodo] !== undefined) {
      desglosePagos[metodo] += roundTo2Decimals(tBs);
    } else {
      desglosePagos.OTROS += roundTo2Decimals(tBs);
    }
  });

  const totalDebitoFiscalBs = roundTo2Decimals(debitoGeneralBs + debitoReducidoBs + debitoAdicionalBs);
  const fechaApertura = sortedSales[0]?.fecha || fechaLectura;

  return {
    id: `X-${Date.now()}`,
    tipo: 'X',
    numeroZ: null,
    fechaApertura,
    fechaCierre: fechaLectura,
    primeraFactura: primeraFactura || '---',
    ultimaFactura: ultimaFactura || '---',
    primeraNc: primeraNc || '---',
    ultimaNc: ultimaNc || '---',
    primeraNd: primeraNd || '---',
    ultimaNd: ultimaNd || '---',
    cantidadFacturas: cantFacturas,
    cantidadNc: cantNc,
    cantidadNd: cantNd,
    totalDocumentos: cantFacturas + cantNc + cantNd,
    ventasExentasBs: roundTo2Decimals(ventasExentasBs),
    baseGeneralBs: roundTo2Decimals(baseGeneralBs),
    debitoGeneralBs: roundTo2Decimals(debitoGeneralBs),
    baseReducidaBs: roundTo2Decimals(baseReducidaBs),
    debitoReducidoBs: roundTo2Decimals(debitoReducidoBs),
    baseAdicionalBs: roundTo2Decimals(baseAdicionalBs),
    debitoAdicionalBs: roundTo2Decimals(debitoAdicionalBs),
    totalDebitoFiscalBs,
    baseIgtfBs: roundTo2Decimals(baseIgtfBs),
    totalIgtfBs: roundTo2Decimals(totalIgtfBs),
    totalVentasBs: roundTo2Decimals(totalVentasBs),
    totalVentasUsd: roundTo2Decimals(totalVentasUsd),
    tasaBcv,
    desglosePagos,
    usuarioId: currentUser?.id || 'USR-001',
    usuarioNombre: currentUser?.nombre || 'Administrador / Caja',
    ventasIds: sortedSales.map(s => s.id)
  };
};

/**
 * Ejecuta el Cierre Z Oficial Definitivo.
 * Correlativo estricto consecutivo Z, Gran Total Histórico perpetuo, firma SHA-256 y bloqueo de documentos.
 */
export const ejecutarCierreZ = async ({ sales = [], previousClosures = [], config = {}, currentUser = null }) => {
  const safeConfig = config || {};
  const tasaBcv = Number(safeConfig.tasaDolar) || 827.73;
  const fechaCierre = new Date().toISOString();

  // Calcular siguiente número correlativo Z sin saltos ni colisiones con cierres históricos (ej. Z-00000001 con numero_z="0000")
  const parseClosureSeq = (c) => {
    const numZ = Number(c?.numeroZ ?? c?.numero_z ?? 0) || 0;
    const numCierre = Number(c?.numeroCierre ?? c?.numero_cierre ?? 0) || 0;
    const idMatch = String(c?.id || '').match(/^Z-0*(\d+)$/i);
    const idNum = idMatch ? (parseInt(idMatch[1], 10) || 0) : 0;
    return Math.max(numZ, numCierre, idNum);
  };
  const zClosures = (previousClosures || []).filter(c => String(c?.tipo || '').toUpperCase() === 'Z');
  const ultimoNumeroZ = zClosures.reduce((max, c) => Math.max(max, parseClosureSeq(c)), 0);
  const nuevoNumeroZ = ultimoNumeroZ + 1;
  const cierreId = `Z-${String(nuevoNumeroZ).padStart(8, '0')}`;

  // Obtener último Gran Total Histórico
  const ultimoCierre = [...zClosures].sort((a, b) => parseClosureSeq(b) - parseClosureSeq(a))[0];
  const ultimoGranTotal = Number(ultimoCierre?.granTotalHistoricoBs ?? ultimoCierre?.gran_total_historico_bs ?? 0);

  // Generar consolidación con la lógica de base
  const reporteBase = generarReporteX({ sales, config: safeConfig, currentUser });

  const nuevoGranTotal = roundTo2Decimals(ultimoGranTotal + Math.max(0, reporteBase.totalVentasBs));

  const cierreZ = {
    ...reporteBase,
    id: cierreId,
    tipo: 'Z',
    numeroZ: nuevoNumeroZ,
    numeroCierre: nuevoNumeroZ,
    fechaCierre,
    granTotalHistoricoBs: nuevoGranTotal,
    rifEmisor: safeConfig.rif || 'J-31115365-9'
  };

  // Generar firma criptográfica SHA-256 inmutable
  cierreZ.firmaHashSha256 = await calculateFiscalHashSha256(cierreZ);

  return {
    cierreZ,
    closedSaleIds: reporteBase.ventasIds
  };
};

/**
 * Genera la representación en texto monoespaciado optimizada para tickets térmicos (80mm y 58mm).
 * Cumple con los requerimientos de la Providencia Administrativa SNAT/2011/00071.
 */
export const formatFiscalTicketText = (closure, config = {}) => {
  const safeConfig = config || {};
  const isZ = closure.tipo === 'Z';
  const width = 42; // Ancho estándar de caracteres para 80mm
  const sep = '='.repeat(width);
  const dash = '-'.repeat(width);
  const pad = (left, right) => {
    const lStr = String(left || '');
    const rStr = String(right || '');
    const space = Math.max(1, width - lStr.length - rStr.length);
    return lStr + ' '.repeat(space) + rStr;
  };
  const center = (text) => {
    const tStr = String(text || '');
    const space = Math.max(0, Math.floor((width - tStr.length) / 2));
    return ' '.repeat(space) + tStr;
  };

  const razonSocial = (safeConfig.nombreEmpresa || 'GRUPO MOTORVEN, C.A.').toUpperCase();
  const rif = (safeConfig.rif || 'J-31115365-9').toUpperCase();
  const direccion = safeConfig.direccion || 'AV. INTERCOMUNAL BARQUISIMETO, LARA';
  const fechaObj = new Date(closure.fechaCierre || new Date());
  const fechaStr = fechaObj.toLocaleDateString('es-VE');
  const horaStr = fechaObj.toLocaleTimeString('es-VE');

  const lines = [
    center(razonSocial),
    center(`RIF: ${rif}`),
    center(direccion),
    center('SENIAT - PROVIDENCIA SNAT/2011/00071'),
    sep,
    center(isZ ? '*** REPORTE Z - CIERRE FISCAL DIARIO ***' : '*** REPORTE X - CORTE DE TURNO ***'),
    isZ ? center(`REPORTE Z N°: ${String(closure.numeroZ).padStart(8, '0')}`) : center(`CORTE PARCIAL: ${closure.id}`),
    sep,
    pad('FECHA DE EMISIÓN:', fechaStr),
    pad('HORA DE EMISIÓN:', horaStr),
    pad('CAJERO / OPERADOR:', closure.usuarioNombre || 'ADMINISTRACIÓN'),
    pad('TASA OFICIAL BCV:', formatBs(closure.tasaBcv || 827.73)),
    dash,
    center('RANGO DE DOCUMENTOS EMITIDOS'),
    dash,
    pad('PRIMERA FACTURA:', closure.primeraFactura || '---'),
    pad('ÚLTIMA FACTURA:', closure.ultimaFactura || '---'),
    pad('TOTAL FACTURAS:', String(closure.cantidadFacturas || 0)),
    pad('NOTAS DE CRÉDITO:', String(closure.cantidadNc || 0)),
    pad('NOTAS DE DÉBITO:', String(closure.cantidadNd || 0)),
    pad('TOTAL DOCUMENTOS:', String(closure.totalDocumentos || 0)),
    dash,
    center('DESGLOSE DE BASES IMPONIBLES Y DÉBITOS'),
    dash,
    pad('VENTAS EXENTAS (E):', `Bs. ${Number(closure.ventasExentasBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('BASE IMPONIBLE (G 16%):', `Bs. ${Number(closure.baseGeneralBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('DÉBITO FISCAL (16%):', `Bs. ${Number(closure.debitoGeneralBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('BASE IMPONIBLE (R 8%):', `Bs. ${Number(closure.baseReducidaBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('DÉBITO FISCAL (8%):', `Bs. ${Number(closure.debitoReducidoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    dash,
    pad('TOTAL DÉBITO FISCAL:', `Bs. ${Number(closure.totalDebitoFiscalBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('PERCEPCIÓN IGTF (3%):', `Bs. ${Number(closure.totalIgtfBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    sep,
    pad('TOTAL FACTURADO (VES):', formatBs(closure.totalVentasBs || 0)),
    pad('REF. DÓLARES (USD):', formatUsd(closure.totalVentasUsd || 0)),
    sep,
    center('DESGLOSE POR MEDIOS DE PAGO'),
    dash,
    pad('EFECTIVO DIVISAS / USD:', `Bs. ${Number(closure.desglosePagos?.EFECTIVO_USD || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('PAGO MÓVIL:', `Bs. ${Number(closure.desglosePagos?.PAGO_MOVIL || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('TRANSFERENCIA BANCARIA:', `Bs. ${Number(closure.desglosePagos?.TRANSFERENCIA_BS || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('PUNTO DE VENTA:', `Bs. ${Number(closure.desglosePagos?.PUNTO_VENTA || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('ZELLE / OTROS:', `Bs. ${Number((closure.desglosePagos?.ZELLE || 0) + (closure.desglosePagos?.OTROS || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    sep
  ];

  if (isZ) {
    lines.push(
      center('MEMORIA FISCAL DIGITAL'),
      dash,
      pad('GRAN TOTAL HISTÓRICO:', `Bs. ${Number(closure.granTotalHistoricoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
      dash,
      center('FIRMA DIGITAL DE INTEGRIDAD (SHA-256):'),
      center((closure.firmaHashSha256 || '').substring(0, 32)),
      center((closure.firmaHashSha256 || '').substring(32)),
      sep
    );
  }

  lines.push(
    center('COMPROBANTE DE AUDITORÍA FISCAL'),
    center('NO VÁLIDO COMO FACTURA'),
    sep,
    '\n\n'
  );

  return lines.join('\n');
};

/**
 * Genera la representación en texto monoespaciado optimizada para tickets térmicos (80mm y 58mm) de facturas y notas fiscales.
 * Cumple con los requerimientos de la Providencia Administrativa SNAT/2011/00071.
 */
export const formatSaleInvoiceTicketText = (sale, config = {}) => {
  const safeConfig = config || {};
  const width = 42;
  const sep = '='.repeat(width);
  const dash = '-'.repeat(width);
  const pad = (left, right) => {
    const lStr = String(left || '');
    const rStr = String(right || '');
    const space = Math.max(1, width - lStr.length - rStr.length);
    return lStr + ' '.repeat(space) + rStr;
  };
  const center = (text) => {
    const tStr = String(text || '');
    const space = Math.max(0, Math.floor((width - tStr.length) / 2));
    return ' '.repeat(space) + tStr;
  };

  const razonSocial = (safeConfig.nombreEmpresa || 'GRUPO MOTORVEN, C.A.').toUpperCase();
  const marca = safeConfig.marcaOficial ? safeConfig.marcaOficial.toUpperCase() : 'OILSTONE ® POR KEYSTONE, C.A.';
  const rif = (safeConfig.rif || 'J-31115365-9').toUpperCase();
  const direccion = safeConfig.direccion || 'ZONA INDUSTRIAL III, BARQUISIMETO / CARACAS';
  const telefono = safeConfig.telefono || '+58 (251) 269.13.96';
  
  const rawFecha = sale.fechaEmision || sale.fecha || sale.created_at || sale.createdAt;
  let fechaObj = new Date();
  if (rawFecha instanceof Date && !Number.isNaN(rawFecha.getTime())) {
    fechaObj = rawFecha;
  } else if (typeof rawFecha === 'string' && rawFecha.trim()) {
    const rawStr = rawFecha.trim();
    const dmy = rawStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    const ymd = rawStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dmy) {
      fechaObj = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] || 12), Number(dmy[5] || 0), Number(dmy[6] || 0));
    } else if (ymd) {
      fechaObj = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
    } else {
      const parsed = new Date(rawStr);
      if (!Number.isNaN(parsed.getTime())) fechaObj = parsed;
    }
  }
  const fechaStr = fechaObj.toLocaleDateString('es-VE');
  const horaStr = fechaObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const tipoDocUpper = String(sale.tipoDoc || 'FACTURA').trim().toUpperCase();
  const isNotaEntrega = tipoDocUpper === 'NOTA_ENTREGA';
  const isCotizacion = tipoDocUpper === 'COTIZACION';
  const docTitle = tipoDocUpper === 'NOTA_CREDITO'
    ? 'NOTA DE CRÉDITO'
    : (tipoDocUpper === 'NOTA_DEBITO'
      ? 'NOTA DE DÉBITO'
      : (isNotaEntrega
        ? 'NOTA DE ENTREGA'
        : (isCotizacion ? 'COTIZACIÓN COMERCIAL' : 'FACTURA FISCAL')));

  const tasaDoc = Number(sale.tasaPago || sale.tasaDolar || safeConfig.tasaDolar || 827.73) || 827.73;
  const totalUsdVal = Number(sale.totalUsd || 0);
  const totalBsVal = Number(sale.totalBs || 0) > 0 ? Number(sale.totalBs) : round2(totalUsdVal * tasaDoc);

  const lines = [
    center(razonSocial),
    center(marca),
    center(`RIF: ${rif}`),
    center(direccion),
    center(`TEL: ${telefono}`)
  ];
  if (!isNotaEntrega && !isCotizacion) {
    lines.push(center('SENIAT - PROVIDENCIA SNAT/2011/00071'));
  }
  lines.push(
    sep,
    center(`*** ${docTitle} ***`),
    center(`N°: ${sale.numeroDoc || (isNotaEntrega ? 'NE-000000' : (isCotizacion ? 'COT-000000' : 'FACT-000000'))}`)
  );
  if (!isNotaEntrega && !isCotizacion) {
    lines.push(pad('N° DE CONTROL:', sale.numeroControl || 'POR ASIGNAR'));
  }
  lines.push(sep);

  if (sale.documentoAfectado) {
    lines.push(
      center(`AFECTA A DOCUMENTO: ${sale.documentoAfectado}`),
      dash
    );
  }

  lines.push(
    pad('FECHA DE EMISIÓN:', fechaStr),
    pad('HORA DE EMISIÓN:', horaStr),
    pad('VENDEDOR / CAJERO:', sale.vendedor || 'CAJA MOSTRADOR'),
    pad('CONDICIÓN:', `${sale.condicionPago || 'CONTADO'} (${sale.metodoPago || 'EFECTIVO USD'})`),
    pad(sale.tipoTasa && sale.tipoTasa !== 'BCV' ? `TASA (${sale.tipoTasa}):` : 'TASA OFICIAL BCV:', formatBs(tasaDoc)),
    dash,
    center('DATOS DEL ADQUIRENTE / RECEPTOR'),
    dash,
    pad('NOMBRE / RAZÓN:', (sale.clienteNombre || 'CLIENTE MOSTRADOR').substring(0, 24)),
    pad('C.I. / RIF:', sale.clienteRif || 'S/R'),
    dash,
    pad('CANT x DESCRIPCIÓN', 'TOTAL USD'),
    dash
  );

  (sale.items || []).forEach(item => {
    const taxTag = isNotaEntrega ? 'ENT' : (item.tipoAlicuota || 'G 16%');
    const desc = `${item.cantidad}x ${item.descripcion || item.codigo || 'LUBRICANTE'} [${taxTag}]`;
    const totUsd = formatUsd(item.subtotalUsd || (item.cantidad * item.precioUsd) || 0);
    if (desc.length > 30) {
      lines.push(desc.substring(0, 42));
      lines.push(pad(`   @ $${formatNumberUs(item.precioUsd || 0)}`, totUsd));
    } else {
      lines.push(pad(desc, totUsd));
    }
  });

  if (isNotaEntrega) {
    lines.push(
      dash,
      pad('SUBTOTAL ENTREGA (SIN IVA):', formatUsd(sale.subtotalUsd ?? totalUsdVal))
    );
  } else {
    lines.push(
      dash,
      center('LIQUIDACIÓN DE BASES E IMPUESTOS'),
      dash
    );

    if (Number(sale.baseExentaBs || 0) > 0 || Number(sale.baseExentaUsd || 0) > 0) {
      lines.push(pad('VENTAS EXENTAS (E):', formatBs(Number(sale.baseExentaBs || (Number(sale.baseExentaUsd || 0) * tasaDoc)))));
    }

    lines.push(
      pad('BASE IMPONIBLE (G 16%):', formatBs(Number(sale.baseGeneralBs || 0))),
      pad('DÉBITO FISCAL (16%):', formatBs(Number(sale.ivaGeneralBs || sale.ivaBs || 0)))
    );

    if (Number(sale.baseReducidaBs || 0) > 0) {
      lines.push(
        pad('BASE REDUCIDA (R 8%):', formatBs(Number(sale.baseReducidaBs || 0))),
        pad('DÉBITO REDUCIDO (8%):', formatBs(Number(sale.ivaReducidaBs || 0)))
      );
    }

    if (Number(sale.baseAdicionalBs || 0) > 0) {
      lines.push(
        pad('BASE ADICIONAL (A 31%):', formatBs(Number(sale.baseAdicionalBs || 0))),
        pad('DÉBITO ADICIONAL (31%):', formatBs(Number(sale.ivaAdicionalBs || 0)))
      );
    }

    if (Number(sale.igtfBs || 0) > 0 || Number(sale.igtfUsd || 0) > 0) {
      lines.push(
        pad('PERCEPCIÓN IGTF (3%):', formatBs(Number(sale.igtfBs || 0)))
      );
    }

    if (Number(sale.retencionIvaBs || 0) > 0) {
      lines.push(
        pad('RETENCIÓN IVA APLICADA:', `-${formatBs(Number(sale.retencionIvaBs || 0))}`)
      );
    }
  }

  lines.push(
    sep,
    pad(isNotaEntrega ? 'TOTAL ENTREGA (USD):' : 'TOTAL DOCUMENTO (USD):', formatUsd(totalUsdVal)),
    pad('EQUIVALENTE (VES):', formatBs(totalBsVal)),
    sep,
    center(isNotaEntrega ? 'DOCUMENTO DE DESPACHO INTERNO' : (isCotizacion ? 'PRESUPUESTO INFORMATIVO' : 'DOCUMENTO FISCAL VENEZUELA')),
    center('GRACIAS POR SU COMPRA'),
    center('GRUPO MOTORVEN - ACEITES & LUBRICANTES'),
    sep,
    '\n\n'
  );

  return lines.join('\n');
};

/**
 * Recalcula los subtotales por renglón y los totales de cabecera (Subtotal, IVA 16%, Total USD y Total Bs.)
 * para el modal de edición de Facturas y Notas de Entrega.
 */
export const recalculateEditableInvoiceAmounts = ({
  items = [],
  tipoDoc = 'FACTURA',
  tasaDolar = 0,
  fallbackTasa = 1
} = {}) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((row) => {
    const cantidad = Math.max(0, Number(row?.cantidad) || 0);
    const precioUsd = Math.max(0, Number(row?.precioUsd) || 0);
    const subtotalUsd = round2(cantidad * precioUsd);
    return {
      ...row,
      cantidad,
      precioUsd,
      subtotalUsd,
      totalUsd: subtotalUsd
    };
  });

  const subtotalUsdNum = round2(
    normalizedItems.reduce((acc, it) => acc + (Number(it.subtotalUsd) || 0), 0)
  );
  const isNotaEntrega = String(tipoDoc || '').trim().toUpperCase() === 'NOTA_ENTREGA';
  const ivaUsdNum = isNotaEntrega ? 0 : round2(subtotalUsdNum * 0.16);
  const totalUsdNum = round2(subtotalUsdNum + ivaUsdNum);
  const parsedTasa = Number(tasaDolar);
  const resolvedTasa = parsedTasa > 0 ? parsedTasa : (Number(fallbackTasa) > 0 ? Number(fallbackTasa) : 1);
  const totalBsNum = round2(totalUsdNum * resolvedTasa);

  return {
    items: normalizedItems,
    subtotalUsd: subtotalUsdNum.toFixed(2),
    ivaUsd: ivaUsdNum.toFixed(2),
    totalUsd: totalUsdNum.toFixed(2),
    totalBs: totalBsNum.toFixed(2)
  };
};

