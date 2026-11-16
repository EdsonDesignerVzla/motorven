/**
 * Utilidades compartidas para Cuentas por Pagar (CxP), normalización de proveedores
 * y prevención de colisiones por nroDoc repetido entre distintos proveedores.
 */

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
