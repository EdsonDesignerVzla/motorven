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

// ==============================================================================
// 2. MOTOR DE CÁLCULOS TRIBUTARIOS MULTIMONEDA (IVA MULTI-ALÍCUOTA, IGTF Y RETENCIONES)
// ==============================================================================

/**
 * Redondeo financiero estándar a 2 decimales (Half-Up).
 * Evita errores de coma flotante de IEEE 754.
 */
export const roundTo2Decimals = (num) => {
  if (isNaN(num) || num === null || num === undefined) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

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
 */
export const calculateFiscalTaxes = ({
  items = [],
  tipoDoc = 'FACTURA',
  metodoPago = 'EFECTIVO_USD',
  condicionPago = 'CONTADO',
  tasaBcv = 827.73,
  porcentajeRetencionIva = 75.00,
  porcentajeRetencionIslr = 2.00,
  esSujetoPasivoEspecial = true
}) => {
  const tasa = Number(tasaBcv) > 0 ? Number(tasaBcv) : 827.73;
  const isNotaEntrega = String(tipoDoc || '').trim().toUpperCase() === 'NOTA_ENTREGA';

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

  // Percepción de IGTF (3%)
  // Aplica sobre pagos en divisas o criptomonedas no soberanas (no aplica en Notas de Entrega)
  const esPagoEnDivisas = ['EFECTIVO_USD', 'ZELLE', 'USDT', 'DIVISAS'].includes(metodoPago);
  const aplicaIgtf = !isNotaEntrega && esSujetoPasivoEspecial && esPagoEnDivisas && condicionPago === 'CONTADO';

  const baseIgtfUsd = aplicaIgtf ? roundTo2Decimals(subtotalNetoUsd + totalIvaUsd) : 0;
  const igtfUsd = aplicaIgtf ? roundTo2Decimals(baseIgtfUsd * 0.03) : 0;

  const totalFacturaUsd = roundTo2Decimals(subtotalNetoUsd + totalIvaUsd + igtfUsd);

  // Retención de IVA (75% o 100%)
  const retencionIvaUsd = (!isNotaEntrega && porcentajeRetencionIva > 0)
    ? roundTo2Decimals(totalIvaUsd * (porcentajeRetencionIva / 100))
    : 0;

  // Retención de ISLR (generalmente 2% sobre la base imponible de bienes muebles)
  const retencionIslrUsd = (!isNotaEntrega && porcentajeRetencionIslr > 0)
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
 * Genera el nuevo correlativo fiscal de factura de 6 dígitos consecutivos.
 * Ejemplos: "000000", "000001", "000002" y así sucesivamente.
 * @param {Array} sales - Lista de ventas/facturas existentes
 * @returns {string} - Correlativo formateado a 6 dígitos
 */
export const getNextInvoiceCorrelativo = (sales = []) => {
  // Inicialización automática obligatoria de la nueva serie "000000" para Contado y Crédito
  try {
    const initFlag = localStorage.getItem('sm_invoice_correlativo_zero_init');
    if (!initFlag) {
      localStorage.setItem('sm_invoice_correlativo_zero_init', 'true');
      localStorage.setItem('sm_invoice_correlativo_force', '0');
      localStorage.setItem('sm_invoice_correlativo_seq', '0');
    }
  } catch (_) {}

  // 1. Si el usuario reinició o fijó explícitamente el correlativo (ej: 0 para "000000")
  try {
    const forcedSeq = localStorage.getItem('sm_invoice_correlativo_force');
    if (forcedSeq !== null && forcedSeq !== '') {
      const forcedVal = parseInt(forcedSeq, 10);
      if (!isNaN(forcedVal) && forcedVal >= 0 && forcedVal <= 999999) {
        return String(forcedVal).padStart(6, '0');
      }
    }
  } catch (_) {}

  let highest = -1;
  const list = Array.isArray(sales) ? sales : [];

  list.forEach(s => {
    if (s.tipoDoc && s.tipoDoc !== 'FACTURA') return;
    const raw = String(s.numeroDoc || s.nroFactura || s.factNum || '');
    if (!raw) return;
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly) {
      const val = parseInt(digitsOnly, 10);
      // Valid correlativo en la serie activa iniciada desde 000000 (aislando semillas demo >= 1000)
      if (!isNaN(val) && val >= 0 && val < 50000 && (val < 1000 || highest > 900) && val > highest) {
        highest = val;
      }
    }
  });

  try {
    const storedSeq = localStorage.getItem('sm_invoice_correlativo_seq');
    if (storedSeq !== null && storedSeq !== '') {
      const storedVal = parseInt(storedSeq, 10);
      if (!isNaN(storedVal) && storedVal >= 0 && (storedVal < 1000 || highest > 900) && storedVal > highest) {
        highest = storedVal - 1;
      }
    }
  } catch (_) {}

  const nextVal = highest >= 0 ? highest + 1 : 0;
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
  let highest = 0;
  const cleanPrefix = String(prefix || 'NE').toUpperCase().trim();

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
        if (!isNaN(val) && val > 0 && val < 900000 && val > highest) {
          highest = val;
        }
      }
    }
  };

  if (Array.isArray(sales)) sales.forEach(inspectRecord);
  if (Array.isArray(invoices)) invoices.forEach(inspectRecord);

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

  const nextVal = highest + 1;
  return `${cleanPrefix}-${String(nextVal).padStart(6, '0')}`;
};

export const commitNotaEntregaCorrelativo = (correlativo) => {
  try {
    const val = parseInt(String(correlativo || '').replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val) && val > 0 && typeof localStorage !== 'undefined') {
      const prev = parseInt(localStorage.getItem('sm_ne_correlativo_seq') || '0', 10) || 0;
      if (val + 1 > prev) {
        localStorage.setItem('sm_ne_correlativo_seq', String(val + 1));
      }
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
    localStorage.setItem('sm_invoice_correlativo_force', String(safeNum));
    localStorage.setItem('sm_invoice_correlativo_seq', String(safeNum));
  } catch (_) {}
  return String(safeNum).padStart(6, '0');
};

/**
 * Alias de compatibilidad para inicializar correlativo
 */
export const resetInvoiceCorrelativo = setInvoiceCorrelativo;

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
export const generateSeniatVatRetentionTxt = (retencionesList = [], config = {}) => {
  const cleanAgentRif = (config.rif || 'J-31115365-9').replace(/[^A-Z0-9]/gi, '').toUpperCase();

  const lines = retencionesList.map(ret => {
    const periodo = ret.periodoFiscal || `${new Date(ret.fechaEmision).getFullYear()}${String(new Date(ret.fechaEmision).getMonth() + 1).padStart(2, '0')}`;
    
    // Formato de fecha AAAA-MM-DD
    const d = new Date(ret.fechaEmision || new Date());
    const fechaDoc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const tipoOperacion = ret.tipoOperacion || 'C';
    const tipoDoc = ret.tipoDocumento || '01'; // 01 Factura, 02 ND, 03 NC
    const cleanProvRif = (ret.proveedorRif || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    const numDoc = (ret.numeroDocumento || ret.numeroFactura || '').trim();
    const numCtrl = (ret.numeroControl || '').trim();
    
    const totalDoc = Number(ret.totalDocumentoBs || 0).toFixed(2);
    const baseImp = Number(ret.baseImponibleBs || 0).toFixed(2);
    const montoRet = Number(ret.montoRetenidoBs || 0).toFixed(2);
    
    const docAfectado = (ret.documentoAfectado && ret.documentoAfectado !== '') ? ret.documentoAfectado.trim() : '0';
    const comprobanteNro = (ret.comprobanteNro || ret.comprobanteRetencion || ret.comprobanteRetencionIva || '').trim();
    const montoExento = Number(ret.montoExentoBs || 0).toFixed(2);
    const alicuota = Number(ret.alicuota || 16.00).toFixed(2);
    const numExpediente = (ret.numeroExpediente && ret.numeroExpediente !== '') ? ret.numeroExpediente.trim() : '0';

    return [
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
    ].join('\t');
  });

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
  const cleanAgentRif = (config.rif || 'J-31115365-9').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const currentPeriod = retencionesIslrList[0]?.periodoFiscal || `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  let xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
  xml += `<RelacionRetencionesISLR RifAgente="${cleanAgentRif}" Periodo="${currentPeriod}">\n`;

  retencionesIslrList.forEach(item => {
    const cleanProvRif = (item.proveedorRif || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const d = new Date(item.fechaEmision || new Date());
    const fechaOperacion = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const montoOp = Number(item.montoOperacionBs || 0).toFixed(2);
    const pctRet = Number(item.porcentajeRetencion || 2.00).toFixed(2);

    xml += `  <DetalleRetencion>\n`;
    xml += `    <RifRetenido>${cleanProvRif}</RifRetenido>\n`;
    xml += `    <NumeroFactura>${item.numeroFactura || ''}</NumeroFactura>\n`;
    xml += `    <NumeroControl>${item.numeroControl || ''}</NumeroControl>\n`;
    xml += `    <FechaOperacion>${fechaOperacion}</FechaOperacion>\n`;
    xml += `    <CodigoConcepto>${item.codigoConcepto || '055'}</CodigoConcepto>\n`;
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
 */
export const buildLibroVentasRows = (sales = [], config = {}) => {
  const safeConfig = config || {};
  return sales.map((sale, index) => {
    const fecha = new Date(sale.fecha || new Date()).toLocaleDateString('es-VE');
    const tasa = Number(sale.tasaDolar || safeConfig.tasaDolar || 827.73);

    // Tipos: FACTURA -> 01, NOTA_DEBITO -> 02, NOTA_CREDITO -> 03
    let tipoTransaccion = '01-REG';
    if (sale.tipoDoc === 'NOTA_CREDITO') tipoTransaccion = '03-REG';
    if (sale.tipoDoc === 'NOTA_DEBITO') tipoTransaccion = '02-REG';

    const esCredito = sale.tipoDoc === 'NOTA_CREDITO';
    const signo = esCredito ? -1 : 1;

    const totalVentasBs = roundTo2Decimals((sale.totalBs || (sale.totalUsd * tasa)) * signo);
    const ventasExentasBs = roundTo2Decimals((sale.baseExentaBs || 0) * signo);
    const baseImponible16Bs = roundTo2Decimals((sale.baseGeneralBs || (sale.subtotalBs || (sale.subtotalUsd * tasa))) * signo);
    const iva16Bs = roundTo2Decimals((sale.ivaGeneralBs || (sale.ivaBs || (sale.ivaUsd * tasa))) * signo);
    
    const baseImponible8Bs = roundTo2Decimals((sale.baseReducidaBs || 0) * signo);
    const iva8Bs = roundTo2Decimals((sale.ivaReducidaBs || 0) * signo);

    const igtfBs = roundTo2Decimals((sale.igtfBs || (sale.igtfUsd * tasa || 0)) * signo);
    const retencionIvaBs = roundTo2Decimals((sale.retencionIvaBs || 0) * signo);

    return {
      numOperacion: index + 1,
      fecha,
      rifCliente: sale.clienteRif || 'V-00000000-0',
      nombreCliente: sale.clienteNombre || 'CLIENTE CONTADO',
      tipoTransaccion,
      numeroFactura: sale.numeroDoc || `FACT-${String(index + 1).padStart(6, '0')}`,
      numeroControl: sale.numeroControl || generateFiscalControlNumber(index + 1),
      facturaAfectada: sale.documentoAfectado || '',
      comprobanteRetencion: sale.comprobanteRetencionNro || '',
      totalVentasBs,
      ventasExentasBs,
      baseImponible16Bs,
      alicuota16: 16.00,
      iva16Bs,
      baseImponible8Bs,
      alicuota8: 8.00,
      iva8Bs,
      igtfBs,
      retencionIvaBs,
      tasaBcv: tasa
    };
  });
};

/**
 * Prepara las filas oficiales del Libro de Compras conforme al Art. 75 del Reglamento de la Ley del IVA.
 */
export const buildLibroComprasRows = (purchases = [], config = {}) => {
  const safeConfig = config || {};
  return purchases.map((pur, index) => {
    const fecha = new Date(pur.fecha || new Date()).toLocaleDateString('es-VE');
    const tasa = Number(pur.tasaDolar || safeConfig.tasaDolar || 827.73);

    const totalComprasBs = roundTo2Decimals(pur.totalBs || (pur.totalUsd * tasa));
    const comprasExentasBs = roundTo2Decimals(pur.montoExentoBs || 0);
    const baseImponible16Bs = roundTo2Decimals(pur.baseGeneralBs || (pur.subtotalBs || (pur.subtotalUsd * tasa)));
    const creditoFiscal16Bs = roundTo2Decimals(pur.ivaGeneralBs || (baseImponible16Bs * 0.16));
    const retencionIvaBs = roundTo2Decimals(pur.retencionIvaBs || (creditoFiscal16Bs * 0.75));

    return {
      numOperacion: index + 1,
      fecha,
      rifProveedor: pur.proveedorRif || 'J-00000000-0',
      nombreProveedor: pur.proveedorNombre || pur.proveedor || 'PROVEEDOR KEISTONE',
      tipoTransaccion: '01-REG',
      numeroFactura: pur.numeroFactura || pur.facturaProv || `FAC-PROV-${String(index + 100).padStart(4, '0')}`,
      numeroControl: pur.numeroControl || generateFiscalControlNumber(index + 500),
      documentoAfectado: pur.documentoAfectado || '',
      comprobanteRetencion: pur.comprobanteRetencionIva || generateVatRetentionVoucherNumber(pur.fecha, index + 1),
      totalComprasBs,
      comprasExentasBs,
      baseImponible16Bs,
      alicuota16: 16.00,
      creditoFiscal16Bs,
      retencionIvaBs,
      retencionIslrBs: roundTo2Decimals(pur.retencionIslrBs || (baseImponible16Bs * 0.02)),
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

  // Filtrar ventas abiertas / no consolidadas en un cierre Z previo
  const ventasPendientes = sales.filter(s => !s.cierreZId && s.estado !== 'ANULADA');

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

    const exenta = Number(sale.baseExentaBs || 0) * signo;
    const base16 = Number(sale.baseGeneralBs || (sale.subtotalBs || (sale.subtotalUsd * tasaBcv))) * signo;
    const iva16 = Number(sale.ivaGeneralBs || (sale.ivaBs || (sale.ivaUsd * tasaBcv))) * signo;
    const base8 = Number(sale.baseReducidaBs || 0) * signo;
    const iva8 = Number(sale.ivaReducidaBs || 0) * signo;
    const base31 = Number(sale.baseAdicionalBs || 0) * signo;
    const iva31 = Number(sale.ivaAdicionalBs || 0) * signo;

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

    const tBs = Number(sale.totalBs || (sale.totalUsd * tasaBcv)) * signo;
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

  // Calcular siguiente número correlativo Z sin saltos
  const zClosures = previousClosures.filter(c => c.tipo === 'Z');
  const ultimoNumeroZ = zClosures.reduce((max, c) => Math.max(max, Number(c.numeroZ || 0)), 0);
  const nuevoNumeroZ = ultimoNumeroZ + 1;
  const cierreId = `Z-${String(nuevoNumeroZ).padStart(8, '0')}`;

  // Obtener último Gran Total Histórico
  const ultimoCierre = [...zClosures].sort((a, b) => (Number(b.numeroZ || 0) - Number(a.numeroZ || 0)))[0];
  const ultimoGranTotal = Number(ultimoCierre?.granTotalHistoricoBs || 0);

  // Generar consolidación con la lógica de base
  const reporteBase = generarReporteX({ sales, config: safeConfig, currentUser });

  const nuevoGranTotal = roundTo2Decimals(ultimoGranTotal + Math.max(0, reporteBase.totalVentasBs));

  const cierreZ = {
    ...reporteBase,
    id: cierreId,
    tipo: 'Z',
    numeroZ: nuevoNumeroZ,
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
    pad('TASA OFICIAL BCV:', `Bs. ${Number(closure.tasaBcv || 827.73).toFixed(2)}`),
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
    pad('TOTAL FACTURADO (VES):', `Bs. ${Number(closure.totalVentasBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('REF. DÓLARES (USD):', `$ ${Number(closure.totalVentasUsd || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
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
  
  const fechaObj = new Date(sale.fecha || new Date());
  const fechaStr = fechaObj.toLocaleDateString('es-VE');
  const horaStr = fechaObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const docTitle = sale.tipoDoc === 'NOTA_CREDITO'
    ? 'NOTA DE CRÉDITO'
    : (sale.tipoDoc === 'NOTA_DEBITO'
      ? 'NOTA DE DÉBITO'
      : (sale.tipoDoc === 'NOTA_ENTREGA' ? 'NOTA DE ENTREGA' : 'FACTURA FISCAL'));

  const lines = [
    center(razonSocial),
    center(marca),
    center(`RIF: ${rif}`),
    center(direccion),
    center(`TEL: ${telefono}`),
    center('SENIAT - PROVIDENCIA SNAT/2011/00071'),
    sep,
    center(`*** ${docTitle} ***`),
    center(`N°: ${sale.numeroDoc || 'FACT-000000'}`),
    pad('N° DE CONTROL:', sale.numeroControl || '00-001043'),
    sep
  ];

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
    pad('TASA OFICIAL BCV:', `Bs. ${Number(sale.tasaDolar || safeConfig.tasaDolar || 827.73).toFixed(2)}`),
    dash,
    center('DATOS DEL ADQUIRENTE / RECEPTOR'),
    dash,
    pad('NOMBRE / RAZÓN:', (sale.clienteNombre || 'CLIENTE MOSTRADOR').substring(0, 24)),
    pad('C.I. / RIF:', sale.clienteRif || 'V-18456789-6'),
    dash,
    pad('CANT x DESCRIPCIÓN', 'TOTAL USD'),
    dash
  );

  (sale.items || []).forEach(item => {
    const desc = `${item.cantidad}x ${item.descripcion || item.codigo || 'LUBRICANTE'} [${item.tipoAlicuota || 'G 16%'}]`;
    const totUsd = `$ ${Number(item.subtotalUsd || (item.cantidad * item.precioUsd) || 0).toFixed(2)}`;
    if (desc.length > 30) {
      lines.push(desc.substring(0, 42));
      lines.push(pad(`   @ $${Number(item.precioUsd || 0).toFixed(2)}`, totUsd));
    } else {
      lines.push(pad(desc, totUsd));
    }
  });

  lines.push(
    dash,
    center('LIQUIDACIÓN DE BASES E IMPUESTOS'),
    dash
  );

  if (Number(sale.baseExentaBs || 0) > 0 || Number(sale.baseExentaUsd || 0) > 0) {
    lines.push(pad('VENTAS EXENTAS (E):', `Bs. ${Number(sale.baseExentaBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`));
  }

  lines.push(
    pad('BASE IMPONIBLE (G 16%):', `Bs. ${Number(sale.baseGeneralBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('DÉBITO FISCAL (16%):', `Bs. ${Number(sale.ivaGeneralBs || sale.ivaBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`)
  );

  if (Number(sale.baseReducidaBs || 0) > 0) {
    lines.push(
      pad('BASE REDUCIDA (R 8%):', `Bs. ${Number(sale.baseReducidaBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
      pad('DÉBITO REDUCIDO (8%):', `Bs. ${Number(sale.ivaReducidaBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`)
    );
  }

  if (Number(sale.igtfBs || 0) > 0 || Number(sale.igtfUsd || 0) > 0) {
    lines.push(
      pad('PERCEPCIÓN IGTF (3%):', `Bs. ${Number(sale.igtfBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`)
    );
  }

  if (Number(sale.retencionIvaBs || 0) > 0) {
    lines.push(
      pad('RETENCIÓN IVA APLICADA:', `-Bs. ${Number(sale.retencionIvaBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`)
    );
  }

  lines.push(
    sep,
    pad('TOTAL FACTURA (USD):', `$ ${Number(sale.totalUsd || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    pad('TOTAL A PAGAR (VES):', `Bs. ${Number(sale.totalBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`),
    sep,
    center('DOCUMENTO FISCAL VENEZUELA'),
    center('GRACIAS POR SU COMPRA'),
    center('GRUPO MOTORVEN - ACEITES & LUBRICANTES'),
    sep,
    '\n\n'
  );

  return lines.join('\n');
};
