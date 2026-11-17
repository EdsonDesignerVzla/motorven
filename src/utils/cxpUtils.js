/**
 * Utilidades compartidas para Cuentas por Pagar (CxP), normalización de proveedores
 * y prevención de colisiones por nroDoc repetido entre distintos proveedores.
 */
import { suggestCreditDebitControlNumber } from './cxcUtils.js';

export { suggestCreditDebitControlNumber };

const round2Cxp = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

export const normalizeProviderRif = (val) =>
  String(val || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const normalizeProviderName = (val) =>
  String(val || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

export const normalizeDocNumber = (val) =>
  String(val || '')
    .trim()
    .toUpperCase();

export const normalizeDocType = (val) =>
  String(val || 'FACT')
    .trim()
    .toUpperCase();

/**
 * Obtiene un identificador normalizado del proveedor (prioriza RIF/código, luego nombre).
 */
export const resolveCxpProviderKey = (entity = {}) => {
  if (!entity || typeof entity !== 'object') return '';
  const code = normalizeProviderRif(
    entity.provRif ?? entity.prov_rif ?? entity.rif ?? entity.coProv ?? entity.co_prov ?? entity.codigo
  );
  if (code) return code;
  return normalizeProviderName(
    entity.provNombre ?? entity.prov_nombre ?? entity.provDes ?? entity.prov_des ?? entity.nombre
  );
};

/**
 * Determina si dos registros (documento, pago, compra o proveedor) pertenecen al mismo proveedor,
 * normalizando RIF (sin guiones ni espacios), coProv y razón social.
 */
export const doProvidersMatch = (a = {}, b = {}) => {
  if (!a || !b) return false;
  const rifA = normalizeProviderRif(a.provRif ?? a.prov_rif ?? a.rif);
  const rifB = normalizeProviderRif(b.provRif ?? b.prov_rif ?? b.rif);
  const coA = normalizeProviderRif(a.coProv ?? a.co_prov ?? a.codigo);
  const coB = normalizeProviderRif(b.coProv ?? b.co_prov ?? b.codigo);

  if (rifA && rifB) return rifA === rifB;
  if (coA && coB) return coA === coB;
  if ((rifA && coB && rifA === coB) || (coA && rifB && coA === rifB)) return true;

  const nameA = normalizeProviderName(a.provNombre ?? a.prov_nombre ?? a.provDes ?? a.prov_des ?? a.nombre);
  const nameB = normalizeProviderName(b.provNombre ?? b.prov_nombre ?? b.provDes ?? b.prov_des ?? b.nombre);
  return Boolean(nameA && nameB && nameA === nameB);
};

/**
 * Construye una clave compuesta única `${tipoDoc}|${nroDoc}|${provKey}` para evitar colisiones
 * cuando distintos proveedores comparten el mismo número de documento (ej. "1", "2", "3").
 */
export const buildCxpCompositeKey = (doc = {}) => {
  if (!doc || typeof doc !== 'object') return '';
  const nro = normalizeDocNumber(doc.nroDoc ?? doc.nro_doc);
  if (!nro) return '';
  const tipo = normalizeDocType(doc.tipoDoc ?? doc.tipo_doc);
  const provKey = resolveCxpProviderKey(doc) || 'NOPROV';
  return `${tipo}|${nro}|${provKey}`;
};

/**
 * Construye la lista de claves compuestas/ID únicas (sin nroDoc suelto) para indexar
 * overrides locales y eliminaciones seguras de CxP.
 */
export const buildCxpLookupKeys = (docOrId) => {
  if (!docOrId) return [];
  const keys = new Set();
  if (typeof docOrId === 'object') {
    const rawId = String(docOrId.id || '').trim();
    if (rawId) keys.add(rawId);
    const comp = buildCxpCompositeKey(docOrId);
    if (comp) keys.add(comp);
  } else {
    const raw = String(docOrId).trim();
    if (raw) keys.add(raw);
  }
  return Array.from(keys);
};

/**
 * Genera un ID determinístico para un documento CxP nuevo cuando no tiene ID asignado.
 */
export const buildCxpStableId = (doc = {}) => {
  const existing = String(doc?.id || '').trim();
  if (existing) return existing;
  const tipo = normalizeDocType(doc?.tipoDoc ?? doc?.tipo_doc);
  const nro = normalizeDocNumber(doc?.nroDoc ?? doc?.nro_doc).replace(/[^A-Z0-9-]/g, '') || String(Date.now());
  const prov = resolveCxpProviderKey(doc) || 'GEN';
  return `CXP-${tipo}-${nro}-${prov}`;
};

/**
 * Comprueba si dos documentos CxP representan el mismo registro.
 * Coincide por ID exacto, o por nroDoc + tipoDoc + proveedor normalizado.
 */
export const doesPayableMatchDocument = (docA, docB) => {
  if (!docA || !docB) return false;
  const idA = String(docA.id || '').trim();
  const idB = String(docB.id || '').trim();
  if (idA && idB && idA === idB) return true;

  const nroA = normalizeDocNumber(docA.nroDoc ?? docA.nro_doc);
  const nroB = normalizeDocNumber(docB.nroDoc ?? docB.nro_doc);
  if (!nroA || !nroB || nroA !== nroB) return false;

  const tipoA = docA.tipoDoc || docA.tipo_doc ? normalizeDocType(docA.tipoDoc ?? docA.tipo_doc) : '';
  const tipoB = docB.tipoDoc || docB.tipo_doc ? normalizeDocType(docB.tipoDoc ?? docB.tipo_doc) : '';
  if (tipoA && tipoB && tipoA !== tipoB) return false;

  return doProvidersMatch(docA, docB);
};

const parseDocumentosAfectados = (rawDocs) => {
  if (Array.isArray(rawDocs)) return rawDocs;
  if (typeof rawDocs === 'string' && rawDocs.trim()) {
    try {
      const parsed = JSON.parse(rawDocs);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Determina si un pago a proveedor pertenece específicamente a un documento CxP dado.
 * Requiere coincidencia de proveedor Y referencia explícita al documento (documentosAfectados o texto),
 * evitando mezclar pagos de otras facturas del mismo proveedor.
 */
export const doesSupplierPaymentMatchPayable = (payment = {}, payable = {}) => {
  if (!payment || !payable) return false;
  if (!doProvidersMatch(payment, payable)) return false;

  const targetNro = normalizeDocNumber(payable.nroDoc ?? payable.nro_doc);
  const targetTipo = normalizeDocType(payable.tipoDoc ?? payable.tipo_doc);
  if (!targetNro) return false;

  const affectedDocs = parseDocumentosAfectados(payment.documentosAfectados ?? payment.documentos_afectados);
  const matchesAffected = affectedDocs.some((d) => {
    if (!d) return false;
    if (typeof d === 'string') return normalizeDocNumber(d) === targetNro;
    const dId = String(d.docId ?? d.id ?? '').trim();
    if (dId && payable.id && dId === String(payable.id).trim()) return true;
    const dNro = normalizeDocNumber(d.nroDoc ?? d.nro_doc ?? d.factNum);
    if (!dNro || dNro !== targetNro) return false;
    const dTipo = d.tipoDoc || d.tipo_doc ? normalizeDocType(d.tipoDoc ?? d.tipo_doc) : '';
    return !dTipo || dTipo === targetTipo;
  });

  if (matchesAffected) return true;

  const desc = String(payment.descrip || payment.observaciones || '').toUpperCase();
  if (!desc) return false;
  const escapedNro = targetNro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokenRegex = new RegExp(`(?:#|\\b)${escapedNro}\\b`, 'i');
  return tokenRegex.test(desc);
};

const resolveTimestampMs = (doc = {}) => {
  const raw = doc?._localSavedAt || doc?.updated_at || doc?.updatedAt || doc?.fechaSincronizacion || doc?.fecha_sincronizacion || '';
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Deduplica documentos de Cuentas por Pagar por ID exacto y por clave canónica (tipoDoc|nroDoc|proveedor),
 * conservando la versión más reciente sin colisionar entre distintos proveedores o tipos.
 */
export const dedupePayablesList = (list = []) => {
  if (!Array.isArray(list)) return [];
  const out = [];
  const byId = new Map();
  const byComp = new Map();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rawId = String(item.id || '').trim();
    const compKey = buildCxpCompositeKey(item);
    let existingIdx = -1;
    if (rawId && byId.has(rawId)) {
      existingIdx = byId.get(rawId);
    } else if (compKey && byComp.has(compKey)) {
      existingIdx = byComp.get(compKey);
    }

    if (existingIdx >= 0) {
      const prev = out[existingIdx];
      const prevTs = resolveTimestampMs(prev);
      const nextTs = resolveTimestampMs(item);
      out[existingIdx] = nextTs >= prevTs ? { ...prev, ...item } : { ...item, ...prev };
      const merged = out[existingIdx];
      if (merged.id) byId.set(String(merged.id).trim(), existingIdx);
      const mergedComp = buildCxpCompositeKey(merged);
      if (mergedComp) byComp.set(mergedComp, existingIdx);
    } else {
      const newIdx = out.length;
      out.push(item);
      if (rawId) byId.set(rawId, newIdx);
      if (compKey) byComp.set(compKey, newIdx);
    }
  }
  return out;
};

/**
 * Deduplica pagos a proveedores por ID (y pagoNum+proveedor si aplica), conservando el registro más reciente.
 */
export const dedupeSupplierPaymentsList = (list = []) => {
  if (!Array.isArray(list)) return [];
  const out = [];
  const byKey = new Map();

  for (const pay of list) {
    if (!pay || typeof pay !== 'object') continue;
    const rawId = String(pay.id || '').trim();
    const pagoNum = normalizeDocNumber(pay.pagoNum ?? pay.pago_num);
    const provKey = resolveCxpProviderKey(pay);
    const canonKey = pagoNum ? `${provKey || 'GEN'}|${pagoNum}` : '';

    let existingIdx = -1;
    if (rawId && byKey.has(`ID:${rawId}`)) existingIdx = byKey.get(`ID:${rawId}`);
    else if (canonKey && byKey.has(`NUM:${canonKey}`)) existingIdx = byKey.get(`NUM:${canonKey}`);

    if (existingIdx >= 0) {
      const prev = out[existingIdx];
      out[existingIdx] = resolveTimestampMs(pay) >= resolveTimestampMs(prev)
        ? { ...prev, ...pay }
        : { ...pay, ...prev };
    } else {
      const idx = out.length;
      out.push(pay);
      if (rawId) byKey.set(`ID:${rawId}`, idx);
      if (canonKey) byKey.set(`NUM:${canonKey}`, idx);
    }
  }
  return out;
};

/**
 * Calcula el próximo correlativo NC-XXXXXX o ND-XXXXXX para Cuentas por Pagar (CxP).
 */
export const getNextCxpCreditDebitNoteCorrelativo = (noteType = 'NOTA_CREDITO', payables = []) => {
  const isDebit =
    String(noteType || '').toUpperCase().includes('DEB') ||
    String(noteType || '').toUpperCase() === 'ND' ||
    String(noteType || '').toUpperCase() === 'N/DB';
  const prefix = isDebit ? 'ND' : 'NC';
  let maxNum = 0;

  const inspectCode = (rawVal) => {
    const clean = String(rawVal || '').toUpperCase().trim().replace(/^NE-/, '');
    const m = clean.match(new RegExp(`^${prefix}-?0*(\\d+)$`));
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  };

  (Array.isArray(payables) ? payables : []).forEach((p) => {
    if (!p) return;
    inspectCode(p.nroDoc ?? p.nro_doc);
    inspectCode(p.id);
    const hist = Array.isArray(p.historialPagos) ? p.historialPagos : (Array.isArray(p.historial_pagos) ? p.historial_pagos : []);
    hist.forEach((h) => {
      if (!h) return;
      inspectCode(h.correlativo);
      inspectCode(h.pagoNum);
      inspectCode(h.referencia);
    });
  });

  return `${prefix}-${String(maxNum + 1).padStart(6, '0')}`;
};

/**
 * Construye los objetos de persistencia, ajuste de saldo CxP y datos PDF/Forma Libre
 * para emitir una Nota de Crédito (N/CR) o Nota de Débito (N/DB) sobre un documento CxP.
 */
export function buildCxpCreditDebitNoteResult({
  noteType = 'NOTA_CREDITO',
  affectedDoc,
  noteNum,
  numeroControl = '',
  isFiscal = undefined,
  fechaEmision,
  subtotalUsd = 0,
  aplicaIva = true,
  tasa = 827.73,
  motivo = ''
}) {
  if (!affectedDoc || !(affectedDoc.nroDoc ?? affectedDoc.nro_doc)) {
    throw new Error('Debe seleccionar un documento CxP afectado válido.');
  }

  const normalizedNoteType =
    String(noteType || '').toUpperCase().includes('DEB') || String(noteType || '').toUpperCase() === 'N/DB'
      ? 'NOTA_DEBITO'
      : 'NOTA_CREDITO';
  const isDebit = normalizedNoteType === 'NOTA_DEBITO';
  const prefix = isDebit ? 'ND' : 'NC';

  const rawNumInput = String(noteNum || '').trim().toUpperCase();
  const cleanNoteNum = rawNumInput
    ? (/^(NC|ND)-/i.test(rawNumInput) ? rawNumInput : `${prefix}-${rawNumInput.replace(/[^0-9A-Z]/gi, '').padStart(6, '0')}`)
    : `${prefix}-000001`;

  const affectedTipo = normalizeDocType(affectedDoc.tipoDoc ?? affectedDoc.tipo_doc);
  const affectedIsFiscal = affectedDoc.isFiscal !== undefined
    ? Boolean(affectedDoc.isFiscal)
    : affectedTipo === 'FACT';
  const effectiveIsFiscal = isFiscal === undefined ? affectedIsFiscal : Boolean(isFiscal);
  const effectiveAplicaIva = effectiveIsFiscal && Boolean(aplicaIva);

  const cleanSub = round2Cxp(Math.max(0, Number(subtotalUsd || 0)));
  const cleanIva = effectiveAplicaIva ? round2Cxp(cleanSub * 0.16) : 0;
  const cleanTotal = round2Cxp(cleanSub + cleanIva);
  if (!(cleanTotal > 0)) {
    throw new Error('El monto total de la nota debe ser mayor a $0.00.');
  }

  const cleanTasa = Number(tasa || affectedDoc.tasa || 0) > 1 ? Number(tasa || affectedDoc.tasa) : 827.73;
  const subtotalBs = round2Cxp(cleanSub * cleanTasa);
  const ivaBs = round2Cxp(cleanIva * cleanTasa);
  const totalBs = round2Cxp(cleanTotal * cleanTasa);
  const cleanFecha = String(fechaEmision || new Date().toISOString().split('T')[0]).trim();
  const affectedNro = String(affectedDoc.nroDoc ?? affectedDoc.nro_doc).trim();
  const cleanMotivo = String(motivo || '').trim() || (
    isDebit
      ? `Cargo / Ajuste adicional sobre documento CxP #${affectedNro}`
      : `Rebaja / Descuento comercial aplicado a documento CxP #${affectedNro}`
  );

  const montoOrigUsd = round2Cxp(Number(affectedDoc.montoNetUsd ?? affectedDoc.monto_net_usd ?? 0));
  const abonosOrigUsd = round2Cxp(Number(affectedDoc.abonosUsd ?? affectedDoc.abonos_usd ?? 0));
  const saldoOrigUsd = round2Cxp(Math.max(0, Number(affectedDoc.saldoUsd ?? affectedDoc.saldo_usd ?? (montoOrigUsd - abonosOrigUsd))));

  if (!isDebit && cleanTotal > round2Cxp(saldoOrigUsd + 0.01)) {
    throw new Error(`La Nota de Crédito ($${cleanTotal.toFixed(2)}) no puede superar el saldo pendiente por pagar ($${saldoOrigUsd.toFixed(2)}).`);
  }

  const resolvedControl = effectiveIsFiscal
    ? (String(numeroControl || '').trim() || suggestCreditDebitControlNumber(cleanNoteNum, false))
    : String(numeroControl || '').trim();

  const provRif = String(affectedDoc.provRif ?? affectedDoc.prov_rif ?? affectedDoc.coProv ?? affectedDoc.co_prov ?? 'J-00000000-0').trim();
  const provNombre = String(affectedDoc.provNombre ?? affectedDoc.prov_nombre ?? 'Proveedor General').trim();
  const docTasa = Number(affectedDoc.tasa || cleanTasa);

  let updatedAffectedDoc = null;
  let createdDebitDoc = null;

  if (!isDebit) {
    const ncEntry = {
      id: `nc-cxp-${cleanNoteNum}-${Date.now().toString().slice(-4)}`,
      correlativo: cleanNoteNum,
      pagoNum: cleanNoteNum,
      numeroControl: resolvedControl,
      isFiscal: effectiveIsFiscal,
      tipo: 'NOTA_CREDITO',
      tipoDoc: 'N/CR',
      nroDoc: affectedNro,
      documentoAfectado: affectedNro,
      fecha: cleanFecha,
      tasa: cleanTasa,
      tasaPago: cleanTasa,
      tipoTasa: effectiveIsFiscal ? 'BCV' : (affectedDoc.tipoTasa || 'KEYSTONE'),
      monedaPago: 'BS',
      subtotalUsd: cleanSub,
      subtotalBs,
      ivaUsd: cleanIva,
      ivaBs,
      montoUsd: cleanTotal,
      montoBs: totalBs,
      formaPago: 'NOTA_CREDITO',
      cuentaId: 'NC-CXP',
      cuentaNombre: `N/CR CxP #${cleanNoteNum}`,
      accountType: 'NOTA_CREDITO',
      referencia: cleanNoteNum,
      observaciones: `Nota de Crédito CxP #${cleanNoteNum} • ${cleanMotivo}`
    };

    const appliedAmount = round2Cxp(Math.min(saldoOrigUsd, cleanTotal));
    const newAbonosUsd = round2Cxp(Math.min(montoOrigUsd, abonosOrigUsd + appliedAmount));
    const newSaldoUsd = round2Cxp(Math.max(0, montoOrigUsd - newAbonosUsd));
    const newSaldoBs = round2Cxp(newSaldoUsd * docTasa);
    const existingHist = Array.isArray(affectedDoc.historialPagos)
      ? affectedDoc.historialPagos
      : (Array.isArray(affectedDoc.historial_pagos) ? affectedDoc.historial_pagos : []);

    updatedAffectedDoc = {
      ...affectedDoc,
      id: buildCxpStableId(affectedDoc),
      tipoDoc: affectedTipo,
      nroDoc: affectedNro,
      coProv: provRif,
      provRif,
      provNombre,
      fechaEmision: affectedDoc.fechaEmisionIso || affectedDoc.fechaEmision || cleanFecha,
      fechaVencimiento: affectedDoc.fechaVencimientoIso || affectedDoc.fechaVencimiento || cleanFecha,
      montoNetUsd: montoOrigUsd,
      montoNetBs: round2Cxp(Number(affectedDoc.montoNetBs ?? affectedDoc.monto_net_bs ?? (montoOrigUsd * docTasa))),
      abonosUsd: newAbonosUsd,
      saldoUsd: newSaldoUsd,
      saldoBs: newSaldoBs,
      tasa: docTasa,
      historialPagos: [ncEntry, ...existingHist]
    };
  } else {
    const ndDocNum = !effectiveIsFiscal && !cleanNoteNum.startsWith('NE-')
      ? `NE-${cleanNoteNum}`
      : cleanNoteNum;
    createdDebitDoc = {
      id: buildCxpStableId({ tipoDoc: 'N/DB', nroDoc: ndDocNum, provRif, provNombre }),
      tipoDoc: 'N/DB',
      isFiscal: effectiveIsFiscal,
      documentoAfectado: affectedNro,
      numeroControl: resolvedControl,
      nroDoc: ndDocNum,
      coProv: provRif,
      provNombre,
      provRif,
      fechaEmision: cleanFecha,
      fechaVencimiento: affectedDoc.fechaVencimientoIso || affectedDoc.fechaVencimiento || cleanFecha,
      diasCredito: Number(affectedDoc.diasCredito || 0),
      baseImponibleUsd: cleanSub,
      baseImponibleBs: subtotalBs,
      ivaUsd: cleanIva,
      ivaBs,
      exentoIva: !effectiveAplicaIva,
      montoNetUsd: cleanTotal,
      montoNetBs: totalBs,
      abonosUsd: 0,
      saldoUsd: cleanTotal,
      saldoBs: totalBs,
      tasa: cleanTasa,
      tipoTasa: effectiveIsFiscal ? 'BCV' : (affectedDoc.tipoTasa || 'KEYSTONE'),
      moneda: 'US$',
      observaciones: `Nota de Débito CxP #${cleanNoteNum} (Afecta #${affectedNro}) • ${cleanMotivo}`,
      historialPagos: [],
      _customCreated: true
    };
  }

  const notePdfData = {
    isPayableNote: true,
    tipoDoc: normalizedNoteType,
    isFiscal: effectiveIsFiscal,
    isExento: !effectiveAplicaIva,
    numeroDoc: cleanNoteNum,
    numeroControl: effectiveIsFiscal ? (resolvedControl || '00-000000') : (resolvedControl || 'NO FISCAL'),
    documentoAfectado: affectedNro,
    fechaEmision: cleanFecha,
    fecha: cleanFecha,
    clienteNombre: provNombre,
    clienteRif: provRif,
    provNombre,
    provRif,
    clienteDireccion: 'Venezuela',
    tasaDolar: cleanTasa,
    tasa: cleanTasa,
    subtotalUsd: cleanSub,
    subtotalBs,
    baseGeneralUsd: effectiveAplicaIva ? cleanSub : 0,
    ivaGeneralUsd: cleanIva,
    baseExentaUsd: effectiveAplicaIva ? 0 : cleanSub,
    ivaUsd: cleanIva,
    ivaBs,
    totalUsd: cleanTotal,
    totalBs,
    motivo: cleanMotivo,
    descrip: cleanMotivo,
    observaciones: cleanMotivo,
    condicionPago: effectiveIsFiscal ? 'AJUSTE FISCAL CxP' : 'AJUSTE NO FISCAL CxP',
    items: [
      {
        codigo: affectedNro,
        descripcion: cleanMotivo,
        cantidad: 1,
        precioUsd: cleanSub,
        tipoAlicuota: effectiveAplicaIva ? '16%' : 'EXENTO',
        subtotalUsd: cleanSub
      }
    ]
  };

  return {
    noteType: normalizedNoteType,
    isFiscal: effectiveIsFiscal,
    noteNum: cleanNoteNum,
    updatedAffectedDoc,
    createdDebitDoc,
    notePdfData
  };
}
