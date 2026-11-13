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

export const resolveDocumentWarehouseRule = (doc = {}) => {
  const tipoDoc = String(doc.tipoDoc || doc.tipo_doc || '').toUpperCase().trim();
  const numeroDoc = String(doc.numeroDoc || doc.numero_doc || doc.id || '').toUpperCase().trim();
  const pedidoOrigenDoc = String(doc.pedidoOrigenDoc || '').toUpperCase().trim();
  const almacen = String(doc.almacen || doc.almacenId || doc.almacen_id || doc.co_alma || '').trim();
  const modalidadVenta = String(doc.modalidadVenta || '').toUpperCase().trim();

  if (tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO' || tipoDoc === 'COTIZACION') {
    const isNeAffected = tipoDoc === 'NOTA_CREDITO' && String(doc.documentoAfectado || doc.documento_afectado || '').toUpperCase().startsWith('NE');
    return {
      requiresPositiveStock: false,
      effectiveTipoDoc: tipoDoc,
      warehouseCode: isNeAffected ? '02' : '01',
      warehouseLabel: isNeAffected ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)',
    };
  }

  const isNotaEntrega =
    !(tipoDoc === 'FACTURA' && almacen !== '02' && !numeroDoc.startsWith('NE-') && !pedidoOrigenDoc.startsWith('PED-NE')) &&
    (tipoDoc === 'NOTA_ENTREGA' || almacen === '02' || numeroDoc.startsWith('NE-') || pedidoOrigenDoc.startsWith('PED-NE') || modalidadVenta === 'OFICINA');

  return {
    requiresPositiveStock: true,
    effectiveTipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
    warehouseCode: isNotaEntrega ? '02' : '01',
    warehouseLabel: isNotaEntrega ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)',
  };
};

export const findProductMatchForLineItem = (item, products) => {
  if (!item || typeof item !== 'object') return null;
  const itemKey = String(item.articuloId || item.id || item.codigo || item.co_art || item.product?.id || item.product?.codigo || '').trim();
  const itemCode = String(item.codigo || item.co_art || item.product?.codigo || '').trim();

  if (Array.isArray(products) && products.length > 0) {
    const exact = products.find((p) => {
      if (!p) return false;
      const pId = String(p.id || '').trim();
      const pCode = String(p.codigo || '').trim();
      const pArt = String(p.co_art || '').trim();
      return (itemKey && (pId === itemKey || pCode === itemKey || pArt === itemKey)) || (itemCode && (pCode === itemCode || pArt === itemCode || pId === itemCode));
    });
    if (exact) return exact;

    const keyUpper = itemKey.toUpperCase();
    const codeUpper = itemCode.toUpperCase();
    return products.find((p) => {
      if (!p) return false;
      const pId = String(p.id || '').trim().toUpperCase();
      const pCode = String(p.codigo || '').trim().toUpperCase();
      const pArt = String(p.co_art || '').trim().toUpperCase();
      return (keyUpper && (pId === keyUpper || pCode === keyUpper || pArt === keyUpper)) || (codeUpper && (pCode === codeUpper || pArt === codeUpper || pId === codeUpper));
    }) || null;
  }

  return item.product && typeof item.product === 'object' ? item.product : null;
};

export const validateDocumentPositiveStock = ({
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
  documento_afectado,
} = {}) => {
  const rule = resolveDocumentWarehouseRule({
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
    documento_afectado,
  });

  if (!rule.requiresPositiveStock) {
    return { isValid: true, ...rule, zeroStockItems: [], invalidQtyItems: [], message: '' };
  }

  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return {
      isValid: false,
      ...rule,
      zeroStockItems: [],
      invalidQtyItems: [],
      message: 'Debe cargar al menos un producto/SKU con existencia mayor a 0.',
    };
  }

  const zeroStockItems = [];
  const invalidQtyItems = [];

  for (const item of list) {
    if (!item) continue;
    const rawKey = String(item.articuloId || item.id || item.codigo || item.co_art || item.product?.id || item.product?.codigo || '').trim();
    const rawCode = String(item.codigo || item.co_art || item.product?.codigo || rawKey || 'SIN-CODIGO').trim();
    const matched = findProductMatchForLineItem(item, products);
    const desc = String(matched?.descripcion || item.descripcion || item.articuloDescripcion || item.nombre || item.product?.descripcion || rawCode).trim();
    const qty = Number(item.cantidad ?? item.qty ?? 0);
    const hasCatalog = Boolean(matched) || (Array.isArray(products) && products.length > 0);
    const stock = matched
      ? Number(rule.warehouseCode === '02' ? getProductWarehouseStocks(matched).stock02 : getProductWarehouseStocks(matched).stock01) || 0
      : (hasCatalog ? 0 : null);

    if (stock !== null && !(stock > 0)) {
      zeroStockItems.push({
        articuloId: matched?.id || rawKey || rawCode,
        codigo: matched?.codigo || rawCode,
        descripcion: desc,
        stock,
        requestedQty: qty,
        warehouseCode: rule.warehouseCode,
        warehouseLabel: rule.warehouseLabel,
      });
    }
    if (!(qty > 0)) {
      invalidQtyItems.push({
        articuloId: matched?.id || rawKey || rawCode,
        codigo: matched?.codigo || rawCode,
        descripcion: desc,
        stock: stock ?? 0,
        requestedQty: qty,
        warehouseCode: rule.warehouseCode,
        warehouseLabel: rule.warehouseLabel,
      });
    }
  }

  const docLabel = rule.effectiveTipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura Fiscal';
  let message = '';
  if (zeroStockItems.length > 0) {
    const names = zeroStockItems
      .map((i) => `${i.codigo}${i.descripcion && i.descripcion !== i.codigo ? ` (${i.descripcion})` : ''}`)
      .join(', ');
    message = `No se permite emitir la ${docLabel}: hay ${zeroStockItems.length} producto(s)/SKU con stock en 0 en ${rule.warehouseLabel}: ${names}.`;
  } else if (invalidQtyItems.length > 0) {
    const names = invalidQtyItems
      .map((i) => `${i.codigo}${i.descripcion && i.descripcion !== i.codigo ? ` (${i.descripcion})` : ''}`)
      .join(', ');
    message = `No se permite emitir la ${docLabel}: hay ${invalidQtyItems.length} producto(s)/SKU con cantidad en 0: ${names}.`;
  }

  return {
    isValid: zeroStockItems.length === 0 && invalidQtyItems.length === 0,
    ...rule,
    zeroStockItems,
    invalidQtyItems,
    message,
  };
};



