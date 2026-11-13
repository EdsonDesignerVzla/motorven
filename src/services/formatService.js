/**
 * Servicio de Formateo de Monedas y Redondeo para SIGNUM MOTORVEN
 * Formato USD: $ 1,000.00
 * Formato Bs.: Bs. 1.000,00
 */

export const formatUsd = (value) => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return '$ 0.00';
  }
  // Redondeo a 2 decimales
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded);
  
  return `$ ${formatted}`;
};

export const formatBs = (value) => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 'Bs. 0,00';
  }
  // Redondeo financiero estándar a 2 decimales (Normativa SENIAT / Contabilidad)
  const val = Number(value);
  const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
  
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded);
  
  return `Bs. ${formatted}`;
};

/**
 * Mapa oficial de Unidades de Medida / Presentaciones según tabla `profit_measurement_units`:
 * '01' -> 'Litros'
 * '02' -> 'Totem'
 * '03' -> 'Tambor'
 * '04' -> 'Paila'
 * '05' -> 'Caja'
 * '06' -> 'N/A'
 */
export const PRODUCT_UNIT_MAP = {
  '01': 'Litros',
  '1': 'Litros',
  '02': 'Totem',
  '2': 'Totem',
  '03': 'Tambor',
  '3': 'Tambor',
  '04': 'Paila',
  '4': 'Paila',
  '05': 'Caja',
  '5': 'Caja',
  '06': 'N/A',
  '6': 'N/A'
};

export const PRODUCT_UNITS_LIST = ['Caja', 'Paila', 'Tambor', 'Totem', 'Litros', 'N/A'];

export const resolveProductUnit = (unitOrProduct, fallback = 'Caja') => {
  if (!unitOrProduct) return fallback;
  if (typeof unitOrProduct === 'object') {
    const desc = String(unitOrProduct.descripcion || unitOrProduct.nombre || unitOrProduct.articuloDescripcion || '').toLowerCase();
    if (desc.includes('(paila)') || desc.includes('(pl)')) {
      return 'Paila';
    }
  }
  const raw = typeof unitOrProduct === 'object'
    ? String(
        unitOrProduct.unidad ||
        unitOrProduct.unidadVenta ||
        unitOrProduct.unidad_venta ||
        unitOrProduct.uni_venta ||
        unitOrProduct.des_uni ||
        unitOrProduct.co_uni ||
        ''
      ).trim()
    : String(unitOrProduct).trim();

  if (!raw) return fallback;
  if (PRODUCT_UNIT_MAP[raw]) return PRODUCT_UNIT_MAP[raw];

  const padded = raw.length === 1 && /^\d$/.test(raw) ? `0${raw}` : raw;
  if (PRODUCT_UNIT_MAP[padded]) return PRODUCT_UNIT_MAP[padded];

  // Normalizar variantes descriptivas a su des_uni oficial de profit_measurement_units
  const lower = raw.toLowerCase();
  if (lower === 'caja (12l)' || lower.startsWith('caja')) return 'Caja';
  if (lower === 'cuñete (19l)' || lower.startsWith('cuñete') || lower.startsWith('paila') || lower.startsWith('balde')) return 'Paila';
  if (lower.startsWith('tambor')) return 'Tambor';
  if (lower.startsWith('totem') || lower.startsWith('tótem')) return 'Totem';
  if (lower.startsWith('litro') || lower === 'granel') return 'Litros';

  return raw;
};

/**
 * Resuelve los litros por unidad reales de un producto según su código y presentación:
 * - Paila: 19 L
 * - Caja estándar: 11.35 L
 * - Tambor: 208 L
 * - Totem: 1000 L
 * - Litros (Granel): 1 L
 */
export const resolveProductLitersPerUnit = (product) => {
  if (!product || typeof product !== 'object') return 11.35;

  const unit = resolveProductUnit(product, 'Caja');
  const rawLiters = Number(product.litrosPorUnidad ?? product.litros_por_unidad ?? product.litrosUnitarios ?? 0);

  if (unit === 'Paila') return rawLiters > 1 ? rawLiters : 19;
  if (unit === 'Tambor') return rawLiters > 1 ? rawLiters : 208;
  if (unit === 'Totem') return rawLiters > 1 ? rawLiters : 1000;
  if (unit === 'Litros') return 1;
  if (unit === 'N/A') return 0;

  // Caja (11.35 L; ignora 19 L heredado por error en códigos de caja como 100403/100502)
  return (rawLiters > 1 && rawLiters !== 19) ? rawLiters : 11.35;
};

/**
 * Partición canónica de inventario por almacén para los SKUs de SIGNUM MOTORVEN:
 * Almacén 01: Principal / Mostrador (Facturas Fiscales SENIAT)
 * Almacén 02: Central / Bóveda (Notas de Entrega / Despacho)
 */
export const DEFAULT_WAREHOUSE_SPLITS = {
  '000003': [300, 460], // Granel Diesel SAE 50 (Total 760 L)
  '000804': [1, 1],     // Tambores Diesel CF 50 (Total 2 Tambores)
  '001201': [60, 92],   // 15W40 Semi (Total 152 Cajas)
  '001208': [80, 112],  // 15W40 Mineral (Total 192 Cajas)
  '001308': [45, 68],   // 20W50 Semi (Total 113 Cajas)
  '100102': [55, 86],   // 20W50 Mineral (Total 141 Cajas)
  '100202': [50, 85],   // 25W60 Mineral (Total 135 Cajas)
  '100403': [30, 48],   // Motos 4T (Total 78 Cajas)
  '100502': [34, 50],   // Dexron II (Total 84 Cajas)
  '101209': [2, 4],     // 15W40 Paila (Total 6 Pailas)
  '101309': [2, 3],     // 20W50 Paila (Total 5 Pailas)
  '101409': [7, 10],    // 25W60 Paila (Total 17 Pailas)
  '101713': [0, 1],     // Trans-Manual 140 Paila (Total 1 Paila)
  '101814': [15, 22]    // Fuera de Borda TC-W3 (Total 37 Cajas)
};

/**
 * Resuelve las existencias independientes por almacén de un producto:
 * - stock01: Almacén 01 (Principal / Mostrador -> Facturas Fiscales)
 * - stock02: Almacén 02 (Central / Bóveda -> Notas de Entrega)
 * - total: Consolidado (stock01 + stock02)
 */
export const getProductWarehouseStocks = (product) => {
  if (!product || typeof product !== 'object') {
    return { stock01: 0, stock02: 0, total: 0 };
  }

  const rawTotal = Number(product.stock ?? product.stockActual ?? product.existencia ?? 0) || 0;
  const camel01 = product.stockAlmacen01;
  const snake01 = product.stock_almacen_01 ?? product.stock_01 ?? product.stock01;
  const camel02 = product.stockAlmacen02;
  const snake02 = product.stock_almacen_02 ?? product.stock_02 ?? product.stock02;

  const hasCamel01 = camel01 !== undefined && camel01 !== null && !isNaN(Number(camel01));
  const hasSnake01 = snake01 !== undefined && snake01 !== null && !isNaN(Number(snake01));
  const hasCamel02 = camel02 !== undefined && camel02 !== null && !isNaN(Number(camel02));
  const hasSnake02 = snake02 !== undefined && snake02 !== null && !isNaN(Number(snake02));

  let raw01 = camel01 ?? snake01;
  let raw02 = camel02 ?? snake02;

  // Si snake_case y camelCase difieren y la suma en snake_case coincide exactamente con stock total, priorizar snake_case (actualizado por PATCH parcial)
  if (hasCamel01 && hasSnake01 && hasCamel02 && hasSnake02) {
    const cSum = Number(camel01) + Number(camel02);
    const sSum = Number(snake01) + Number(snake02);
    if (sSum === rawTotal && cSum !== rawTotal) {
      raw01 = snake01;
      raw02 = snake02;
    }
  } else if (hasCamel01 && hasSnake01 && Number(camel01) !== Number(snake01) && Number(snake01) + Number(raw02 || 0) === rawTotal) {
    raw01 = snake01;
  } else if (hasCamel02 && hasSnake02 && Number(camel02) !== Number(snake02) && Number(raw01 || 0) + Number(snake02) === rawTotal) {
    raw02 = snake02;
  }

  const has01 = raw01 !== undefined && raw01 !== null && !isNaN(Number(raw01));
  const has02 = raw02 !== undefined && raw02 !== null && !isNaN(Number(raw02));

  if (has01 && has02) {
    const s01 = Math.max(0, Number(raw01));
    const s02 = Math.max(0, Number(raw02));
    return { stock01: s01, stock02: s02, total: s01 + s02 };
  }

  if (has01 && !has02) {
    const s01 = Math.max(0, Number(raw01));
    const s02 = Math.max(0, rawTotal - s01);
    return { stock01: s01, stock02: s02, total: s01 + s02 };
  }

  if (!has01 && has02) {
    const s02 = Math.max(0, Number(raw02));
    const s01 = Math.max(0, rawTotal - s02);
    return { stock01: s01, stock02: s02, total: s01 + s02 };
  }

  const code = String(product.codigo || product.id || '').trim();
  if (DEFAULT_WAREHOUSE_SPLITS[code]) {
    const [def01, def02] = DEFAULT_WAREHOUSE_SPLITS[code];
    if (def01 + def02 === rawTotal) {
      return { stock01: def01, stock02: def02, total: rawTotal };
    }
  }

  const s01 = Math.round(rawTotal * 0.4);
  const s02 = Math.max(0, rawTotal - s01);
  return { stock01: s01, stock02: s02, total: rawTotal };
};

/**
 * Determina el almacén destino ('01' Factura Fiscal o '02' Nota de Entrega)
 * y si el documento requiere validar existencias > 0 antes de emitirse.
 */
export const resolveDocumentWarehouseTarget = (docOrParams = {}) => {
  const rawTipo = String(docOrParams.tipoDoc || docOrParams.tipo_doc || '').toUpperCase().trim();
  const numDoc = String(docOrParams.numeroDoc || docOrParams.numero_doc || docOrParams.id || '').toUpperCase().trim();
  const originDoc = String(docOrParams.pedidoOrigenDoc || '').toUpperCase().trim();
  const alm = String(docOrParams.almacen || docOrParams.almacenId || docOrParams.almacen_id || docOrParams.co_alma || '').trim();
  const mod = String(docOrParams.modalidadVenta || '').toUpperCase().trim();

  if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'NOTA_DEBITO' || rawTipo === 'COTIZACION') {
    const isNeAffected = rawTipo === 'NOTA_CREDITO' && String(docOrParams.documentoAfectado || docOrParams.documento_afectado || '').toUpperCase().startsWith('NE');
    return {
      requiresPositiveStock: false,
      effectiveTipoDoc: rawTipo,
      warehouseCode: isNeAffected ? '02' : '01',
      warehouseLabel: isNeAffected ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)'
    };
  }

  const isExplicitFactura = rawTipo === 'FACTURA' && alm !== '02' && !numDoc.startsWith('NE-') && !originDoc.startsWith('PED-NE');
  const isNotaEntrega =
    !isExplicitFactura && (
      rawTipo === 'NOTA_ENTREGA' ||
      alm === '02' ||
      numDoc.startsWith('NE-') ||
      originDoc.startsWith('PED-NE') ||
      mod === 'OFICINA'
    );

  return {
    requiresPositiveStock: true,
    effectiveTipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
    warehouseCode: isNotaEntrega ? '02' : '01',
    warehouseLabel: isNotaEntrega ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)'
  };
};

const findProductForWarehouseCheck = (item, products) => {
  if (!item || typeof item !== 'object') return null;
  const key = String(item.articuloId || item.id || item.codigo || item.co_art || item.product?.id || item.product?.codigo || '').trim();
  const codeKey = String(item.codigo || item.co_art || item.product?.codigo || '').trim();

  if (Array.isArray(products) && products.length > 0) {
    const exact = products.find((p) => {
      if (!p) return false;
      const pId = String(p.id || '').trim();
      const pCode = String(p.codigo || '').trim();
      const pCoArt = String(p.co_art || '').trim();
      return (
        (key && (pId === key || pCode === key || pCoArt === key)) ||
        (codeKey && (pCode === codeKey || pCoArt === codeKey || pId === codeKey))
      );
    });
    if (exact) return exact;

    const keyUpper = key.toUpperCase();
    const codeUpper = codeKey.toUpperCase();
    const ci = products.find((p) => {
      if (!p) return false;
      const pId = String(p.id || '').trim().toUpperCase();
      const pCode = String(p.codigo || '').trim().toUpperCase();
      const pCoArt = String(p.co_art || '').trim().toUpperCase();
      return (
        (keyUpper && (pId === keyUpper || pCode === keyUpper || pCoArt === keyUpper)) ||
        (codeUpper && (pCode === codeUpper || pCoArt === codeUpper || pId === codeUpper))
      );
    });
    return ci || null;
  }

  return item.product && typeof item.product === 'object' ? item.product : null;
};

/**
 * Valida que al emitir una Factura Fiscal (Alm 01) o Nota de Entrega (Alm 02),
 * todos los productos / SKU cargados tengan existencia > 0 en su almacén correspondiente
 * y cantidad solicitada > 0.
 */
export const validateWarehouseStockForDocument = ({
  items = [],
  products = [],
  tipoDoc,
  tipo_doc,
  almacen,
  almacenId,
  almacen_id,
  co_alma,
  modalidadVenta,
  numeroDoc,
  numero_doc,
  id,
  pedidoOrigenDoc,
  documentoAfectado,
  documento_afectado
} = {}) => {
  const target = resolveDocumentWarehouseTarget({
    tipoDoc,
    tipo_doc,
    almacen,
    almacenId,
    almacen_id,
    co_alma,
    modalidadVenta,
    numeroDoc,
    numero_doc,
    id,
    pedidoOrigenDoc,
    documentoAfectado,
    documento_afectado
  });

  if (!target.requiresPositiveStock) {
    return {
      isValid: true,
      ...target,
      zeroStockItems: [],
      invalidQtyItems: [],
      message: ''
    };
  }

  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return {
      isValid: false,
      ...target,
      zeroStockItems: [],
      invalidQtyItems: [],
      message: 'Debe cargar al menos un producto/SKU con existencia mayor a 0.'
    };
  }

  const zeroStockItems = [];
  const invalidQtyItems = [];

  for (const item of list) {
    if (!item) continue;
    const key = String(item.articuloId || item.id || item.codigo || item.co_art || item.product?.id || item.product?.codigo || '').trim();
    const codigo = String(item.codigo || item.co_art || item.product?.codigo || key || 'SIN-CODIGO').trim();
    const matchedProd = findProductForWarehouseCheck(item, products);
    const descripcion = String(
      matchedProd?.descripcion ||
      item.descripcion ||
      item.articuloDescripcion ||
      item.nombre ||
      item.product?.descripcion ||
      codigo
    ).trim();
    const requestedQty = Number(item.cantidad ?? item.qty ?? 0);

    const hasCatalogOrInlineProduct = Boolean(matchedProd) || (Array.isArray(products) && products.length > 0);
    const stockAvailable = matchedProd
      ? Number(target.warehouseCode === '02' ? getProductWarehouseStocks(matchedProd).stock02 : getProductWarehouseStocks(matchedProd).stock01) || 0
      : (hasCatalogOrInlineProduct ? 0 : null);

    if (stockAvailable !== null && !(stockAvailable > 0)) {
      zeroStockItems.push({
        articuloId: matchedProd?.id || key || codigo,
        codigo: matchedProd?.codigo || codigo,
        descripcion,
        stock: stockAvailable,
        requestedQty,
        warehouseCode: target.warehouseCode,
        warehouseLabel: target.warehouseLabel
      });
    }

    if (!(requestedQty > 0)) {
      invalidQtyItems.push({
        articuloId: matchedProd?.id || key || codigo,
        codigo: matchedProd?.codigo || codigo,
        descripcion,
        stock: stockAvailable ?? 0,
        requestedQty,
        warehouseCode: target.warehouseCode,
        warehouseLabel: target.warehouseLabel
      });
    }
  }

  const docLabel = target.effectiveTipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura Fiscal';
  let message = '';
  if (zeroStockItems.length > 0) {
    const skuList = zeroStockItems
      .map(i => `${i.codigo}${i.descripcion && i.descripcion !== i.codigo ? ` (${i.descripcion})` : ''}`)
      .join(', ');
    message = `No se permite emitir la ${docLabel}: hay ${zeroStockItems.length} producto(s)/SKU con stock en 0 en ${target.warehouseLabel}: ${skuList}.`;
  } else if (invalidQtyItems.length > 0) {
    const skuList = invalidQtyItems
      .map(i => `${i.codigo}${i.descripcion && i.descripcion !== i.codigo ? ` (${i.descripcion})` : ''}`)
      .join(', ');
    message = `No se permite emitir la ${docLabel}: hay ${invalidQtyItems.length} producto(s)/SKU con cantidad en 0: ${skuList}.`;
  }

  return {
    isValid: zeroStockItems.length === 0 && invalidQtyItems.length === 0,
    ...target,
    zeroStockItems,
    invalidQtyItems,
    message
  };
};




