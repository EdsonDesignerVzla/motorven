/**
 * pricingService.js
 * ---------------------------------------------------------------------------
 * Fuente ÚNICA de verdad para resolver precios de lubricantes en todo SIGNUM:
 *   - POS Mostrador (SalesPOSView)
 *   - POS Vendedores / Preventa (SellerOrderPOSView)
 *   - Pipeline de Pedidos (OrdersPipelineView)
 *   - Modal de Pedidos y Ventas (OrdersSalesModal)
 *
 * Reglas:
 *   1. Un precio solo es válido si es un número finito > 0. Un 0 / null / NaN
 *      en un campo NO bloquea el respaldo hacia el siguiente campo
 *      (evita vender a $0 cuando precio_usd_mayor = 0 pero existe detal).
 *   2. Canal PREVENTA / PIPELINE (vendedores) => precio Mayorista.
 *   3. Canal MOSTRADOR => precio Mayorista si el cliente es Mayorista,
 *      de lo contrario precio Detal.
 * ---------------------------------------------------------------------------
 */

const firstPositive = (...values) => {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

/** Precio Detal (USD) con respaldo completo. */
export const getProductRetailPrice = (p) => {
  if (!p) return 0;
  return firstPositive(
    p.precioUsdDetal, p.precio_usd_detal, p.precioUsd, p.precioVenta, p.precio,
    p.precioUsdMayor, p.precio_usd_mayor, p.precioMayor
  );
};

/** Precio Mayorista (USD) con respaldo completo. */
export const getProductWholesalePrice = (p) => {
  if (!p) return 0;
  return firstPositive(
    p.precioUsdMayor, p.precio_usd_mayor, p.precioMayor,
    p.precioUsdDetal, p.precio_usd_detal, p.precioUsd, p.precioVenta, p.precio
  );
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
  const tipo = normalize(client.tipoCliente || client.tipo_cliente);
  return tipo === 'MAYORISTA';
};

export const PRICE_CHANNEL = {
  MOSTRADOR: 'MOSTRADOR',
  PREVENTA: 'PREVENTA'
};

/**
 * Precio unitario oficial (USD) de un producto según canal y cliente.
 * @param {object} product
 * @param {object|null} client
 * @param {'MOSTRADOR'|'PREVENTA'} channel
 */
export const resolveUnitPrice = (product, client = null, channel = PRICE_CHANNEL.MOSTRADOR) => {
  if (!product) return 0;
  if (channel === PRICE_CHANNEL.PREVENTA) return getProductWholesalePrice(product);
  return isWholesaleClient(client) ? getProductWholesalePrice(product) : getProductRetailPrice(product);
};

/** Redondeo monetario a 2 decimales (evita errores de coma flotante). */
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Subtotal de renglón redondeado. */
export const lineSubtotal = (qty, unitPrice) => roundMoney((Number(qty) || 0) * (Number(unitPrice) || 0));
