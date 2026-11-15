/**
 * pricingService.js
 * ---------------------------------------------------------------------------
 * Fuente ÚNICA de verdad para resolver precios de lubricantes en todo SIGNUM:
 *   - POS Mostrador (SalesPOSView)
 *   - POS Vendedores / Preventa Móvil (SellerOrderPOSView)
 *   - Pipeline de Pedidos (OrdersPipelineView)
 *   - Modal de Pedidos y Ventas (OrdersSalesModal)
 *
 * Reglas:
 *   1. Un precio solo es válido si es un número finito > 0. Un 0 / null / NaN
 *      en un campo NO bloquea el respaldo hacia el siguiente campo
 *      (evita vender a $0 cuando precio_usd_mayor = 0 pero existe detal).
 *   2. Canal PREVENTA (Preventa Móvil / Venta de Calle):
 *      Refleja precios de minoristas o venta de calle (Detal) para todos los productos.
 *   3. Canal OFICINA (Venta por Oficina):
 *      Refleja precios de venta mayorista / oficina (Mayor).
 *   4. Canal MOSTRADOR:
 *      Refleja precios al Detal / Minorista por defecto, o Mayorista si el cliente es Mayorista.
 * ---------------------------------------------------------------------------
 */

const firstPositive = (...values) => {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

/** Normaliza el código de almacén a '01' o '02' */
export const normalizeWarehouseCode = (wh) => {
  if (!wh) return null;
  const s = String(wh).replace(/^ALM-?/i, '').trim();
  if (s === '01' || s === '1' || s.endsWith('01') || s.toLowerCase().includes('principal') || s.toLowerCase().includes('fiscal')) return '01';
  if (s === '02' || s === '2' || s.endsWith('02') || s.toLowerCase().includes('central') || s.toLowerCase().includes('entrega')) return '02';
  return null;
};

/** Precio Detal / Minorista / Venta de Calle (USD) con soporte opcional por almacén. */
export const getProductRetailPrice = (p, warehouse = null) => {
  if (!p) return 0;
  const wh = normalizeWarehouseCode(warehouse);
  if (wh === '01') {
    const p01 = firstPositive(p.precioUsdDetal01, p.precio_usd_detal_01, p.precioDetal01, p.precio01);
    if (p01 > 0) return p01;
  } else if (wh === '02') {
    const p02 = firstPositive(p.precioUsdDetal02, p.precio_usd_detal_02, p.precioDetal02, p.precio02);
    if (p02 > 0) return p02;
  }
  return firstPositive(
    p.precioUsdDetal, p.precio_usd_detal, p.precioUsd, p.precioVenta, p.precio,
    p.precioUsdMayor, p.precio_usd_mayor, p.precioMayor
  );
};

/** Precio Mayorista / Venta por Oficina (USD) con soporte opcional por almacén. */
export const getProductWholesalePrice = (p, warehouse = null) => {
  if (!p) return 0;
  const wh = normalizeWarehouseCode(warehouse);
  if (wh === '01') {
    const p01 = firstPositive(p.precioUsdMayor01, p.precio_usd_mayor_01, p.precioMayor01);
    if (p01 > 0) return p01;
  } else if (wh === '02') {
    const p02 = firstPositive(p.precioUsdMayor02, p.precio_usd_mayor_02, p.precioMayor02);
    if (p02 > 0) return p02;
  }
  return firstPositive(
    p.precioUsdMayor, p.precio_usd_mayor, p.precioMayor,
    p.precioUsdDetal, p.precio_usd_detal, p.precioUsd, p.precioVenta, p.precio
  );
};

/** Costo Unitario (USD) con soporte opcional por almacén. */
export const getProductCost = (p, warehouse = null) => {
  if (!p) return 0;
  const wh = normalizeWarehouseCode(warehouse);
  if (wh === '01') {
    const c01 = firstPositive(p.costoUsd01, p.costo_usd_01, p.costo01);
    if (c01 > 0) return c01;
  } else if (wh === '02') {
    const c02 = firstPositive(p.costoUsd02, p.costo_usd_02, p.costo02);
    if (c02 > 0) return c02;
  }
  return firstPositive(p.costoUsd, p.costo_usd, p.costoUnitarioUsd, p.costo);
};

const normalize = (txt) =>
  String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

/** ¿El cliente compra a precio Mayorista? (tolerante a mayúsculas/acentos). */
export const isWholesaleClient = (client) => {
  if (!client) return false;
  const tipoPrecio = normalize(client.tipoPrecio || client.tipo_precio);
  if (tipoPrecio.includes('MAYOR')) return true;
  if (tipoPrecio.includes('DETAL') || tipoPrecio.includes('MINORISTA')) return false;
  const tipo = normalize(client.tipoCliente || client.tipo_cliente);
  return tipo === 'MAYORISTA' || tipo.includes('MAYOR');
};

export const PRICE_CHANNEL = {
  MOSTRADOR: 'MOSTRADOR',
  PREVENTA: 'PREVENTA', // Preventa Móvil / Venta de Calle (Minoristas)
  OFICINA: 'OFICINA'    // Venta por Oficina (Mayoristas)
};

/**
 * Precio unitario oficial (USD) de un producto según canal, cliente y almacén.
 * @param {object} product
 * @param {object|null} client
 * @param {'MOSTRADOR'|'PREVENTA'|'OFICINA'} channel
 * @param {'01'|'02'|null} warehouse
 */
export const resolveUnitPrice = (product, client = null, channel = PRICE_CHANNEL.MOSTRADOR, warehouse = null) => {
  if (!product) return 0;
  if (channel === PRICE_CHANNEL.OFICINA) return getProductWholesalePrice(product, warehouse);
  if (channel === PRICE_CHANNEL.PREVENTA) {
    // Preventa Móvil / Venta de Calle: refleja los precios de minoristas o venta de calle para todos los productos
    return getProductRetailPrice(product, warehouse);
  }
  return isWholesaleClient(client) ? getProductWholesalePrice(product, warehouse) : getProductRetailPrice(product, warehouse);
};

/** Redondeo monetario a 2 decimales (evita errores de coma flotante). */
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Subtotal de renglón redondeado. */
export const lineSubtotal = (qty, unitPrice) => roundMoney((Number(qty) || 0) * (Number(unitPrice) || 0));
