import {
  INITIAL_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_FISCAL_CLOSURES,
  INITIAL_ORDERS,
  DEFAULT_PROFIT_SELLERS
} from '../data/mockData.js';
import {
  REAL_CONFIG,
  REAL_PRODUCTS,
  REAL_CLIENTS,
  REAL_ORDERS,
  REAL_PROFIT_SELLERS,
  REAL_PROFIT_INVOICES
} from '../data/supabaseRealData.js';
import {
  calculateFiscalTaxes,
  generateFiscalControlNumber,
  generateVatRetentionVoucherNumber,
  getNextInvoiceCorrelativo,
  commitInvoiceCorrelativo,
  getNextNotaEntregaCorrelativo,
  commitNotaEntregaCorrelativo
} from './fiscalService.js';
import { isCreditPaymentCondition, resolveCreditDaysFromTerm, calculateExpirationDate } from './creditPolicyService.js';
import { getProductWarehouseStocks } from './formatService.js';

if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map();
  globalThis.localStorage = {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, val) => { memoryStore.set(key, String(val)); },
    removeItem: (key) => { memoryStore.delete(key); },
    clear: () => { memoryStore.clear(); },
    get length() { return memoryStore.size; },
    key: (i) => Array.from(memoryStore.keys())[i] ?? null
  };
}

const KEYS = {
  CONFIG: 'sm_config_v4_fiscal',
  PRODUCTS: 'sm_products_v4_fiscal',
  CLIENTS: 'sm_clients_v4_fiscal',
  SUPPLIERS: 'sm_suppliers_v4_fiscal',
  SALES: 'sm_sales_v4_fiscal',
  PURCHASES: 'sm_purchases_v4_fiscal',
  CASH_MOVEMENTS: 'sm_cash_movements_v4_fiscal',
  FISCAL_CLOSURES: 'sm_fiscal_closures_v4',
  ORDERS: 'sm_orders_v4_pipeline',
  USERS: 'signum_users_list',
  USER_LOGS: 'signum_user_activity_logs',
  SELLERS: 'sm_sellers_v4_native',
  COMMISSION_SETTLEMENTS: 'sm_commission_settlements_v4',
  NOTIFICATIONS: 'sm_notifications_v4'
};

export const initStorage = () => {
  try {
    const rawCfg = localStorage.getItem(KEYS.CONFIG);
    if (!rawCfg || Number(JSON.parse(rawCfg).tasaDolar) < 500) {
      localStorage.setItem(KEYS.CONFIG, JSON.stringify(REAL_CONFIG));
    }
  } catch (_) {
    localStorage.setItem(KEYS.CONFIG, JSON.stringify(REAL_CONFIG));
  }

  try {
    const rawProds = localStorage.getItem(KEYS.PRODUCTS);
    const parsedProds = rawProds ? JSON.parse(rawProds) : [];
    const hasStaleOilProds = Array.isArray(parsedProds) && parsedProds.some(p => String(p?.id || p?.codigo || '').startsWith('OIL-'));
    const p000003 = Array.isArray(parsedProds) && parsedProds.find(p => String(p?.codigo || p?.id || '').trim() === '000003');
    const p001201 = Array.isArray(parsedProds) && parsedProds.find(p => String(p?.codigo || p?.id || '').trim() === '001201');
    const hasCorruptedDoubledDump =
      Number(p000003?.stock ?? p000003?.stockAlmacen02 ?? 0) === 730 &&
      Number(p001201?.stockAlmacen01 ?? 0) === 152 &&
      Number(p001201?.stockAlmacen02 ?? 0) === 152;
    if (!Array.isArray(parsedProds) || parsedProds.length === 0 || hasStaleOilProds || hasCorruptedDoubledDump) {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(REAL_PRODUCTS));
    }
  } catch (_) {
    try {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(REAL_PRODUCTS));
    } catch (_e) {}
  }

  try {
    const rawClis = localStorage.getItem(KEYS.CLIENTS);
    const parsedClis = rawClis ? JSON.parse(rawClis) : [];
    if (!parsedClis || parsedClis.length < 600) {
      localStorage.setItem(KEYS.CLIENTS, JSON.stringify(REAL_CLIENTS));
    }
  } catch (_) {
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(REAL_CLIENTS));
  }

  try {
    const rawSellers = localStorage.getItem(KEYS.SELLERS);
    const parsedSellers = rawSellers ? JSON.parse(rawSellers) : [];
    const hasOrphanedUsrSellers =
      Array.isArray(parsedSellers) &&
      parsedSellers.some(s => String(s?.coVen || s?.co_ven || s?.id || '').toUpperCase().startsWith('USR-'));
    const hasValidZones =
      Array.isArray(parsedSellers) &&
      parsedSellers.length >= 10 &&
      !hasOrphanedUsrSellers &&
      parsedSellers.every(s => Boolean((s.venDes || s.ven_des) && (s.coZon || s.co_zon)));
    if (!hasValidZones) {
      localStorage.setItem(KEYS.SELLERS, JSON.stringify(REAL_PROFIT_SELLERS));
    }
  } catch (_) {
    localStorage.setItem(KEYS.SELLERS, JSON.stringify(REAL_PROFIT_SELLERS));
  }

  try {
    const rawOrders = localStorage.getItem(KEYS.ORDERS);
    const parsedOrders = rawOrders ? JSON.parse(rawOrders) : [];
    const hasOrphanedOilOrderItems =
      Array.isArray(parsedOrders) &&
      parsedOrders.some(o =>
        !Array.isArray(o?.items) ||
        o.items.length === 0 ||
        o.items.some(it => String(it?.articuloId || it?.productoId || it?.codigo || '').startsWith('OIL-'))
      );
    if (!Array.isArray(parsedOrders) || parsedOrders.length < 1 || hasOrphanedOilOrderItems) {
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(REAL_ORDERS));
    }
  } catch (_) {
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(REAL_ORDERS));
  }

  if (!localStorage.getItem(KEYS.SUPPLIERS)) {
    localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(INITIAL_SUPPLIERS));
  }
  if (!localStorage.getItem(KEYS.SALES)) {
    localStorage.setItem(KEYS.SALES, JSON.stringify(INITIAL_SALES));
  }
  if (!localStorage.getItem(KEYS.PURCHASES)) {
    localStorage.setItem(KEYS.PURCHASES, JSON.stringify(INITIAL_PURCHASES));
  }
  if (!localStorage.getItem(KEYS.CASH_MOVEMENTS)) {
    localStorage.setItem(KEYS.CASH_MOVEMENTS, JSON.stringify(INITIAL_CASH_MOVEMENTS));
  }
  if (!localStorage.getItem(KEYS.FISCAL_CLOSURES)) {
    localStorage.setItem(KEYS.FISCAL_CLOSURES, JSON.stringify(INITIAL_FISCAL_CLOSURES));
  }
};

export const getConfig = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.CONFIG));
};

export const updateConfig = (newConfig) => {
  const current = getConfig();
  const updated = { ...current, ...newConfig };
  localStorage.setItem(KEYS.CONFIG, JSON.stringify(updated));
  return updated;
};

let memoryProductsCache = null;

const persistProductsToStorage = (products) => {
  memoryProductsCache = products;
  try {
    const serialized = JSON.stringify(products);
    localStorage.setItem(KEYS.PRODUCTS, serialized);
    localStorage.setItem('sm_products_v4_fiscal', serialized);
  } catch (_) {
    try {
      const compact = products.map(({ imagen, ...rest }) => rest);
      const serializedCompact = JSON.stringify(compact);
      localStorage.setItem(KEYS.PRODUCTS, serializedCompact);
      localStorage.setItem('sm_products_v4_fiscal', serializedCompact);
    } catch (_e) {}
  }
};

export const getProducts = () => {
  initStorage();
  try {
    const raw = localStorage.getItem(KEYS.PRODUCTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryProductsCache = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  return Array.isArray(memoryProductsCache) && memoryProductsCache.length > 0
    ? memoryProductsCache
    : [...REAL_PRODUCTS];
};

export const saveProduct = (product) => {
  const products = [...getProducts()];
  const stocks = getProductWarehouseStocks(product);
  const detal = Number(product.precioUsdDetal ?? product.precio_usd_detal ?? product.precio ?? product.precioUsd ?? product.precioVenta ?? 0);
  const mayorRaw = Number(product.precioUsdMayor ?? product.precio_usd_mayor ?? product.precioMayor ?? 0);
  const mayor = mayorRaw > 0 ? mayorRaw : detal;
  const costo = Number(product.costoUsd ?? product.costo_usd ?? product.costo ?? 0);

  const normalized = {
    ...product,
    costoUsd: costo,
    costo_usd: costo,
    costo: costo,
    precioUsdDetal: detal,
    precio_usd_detal: detal,
    precio: detal,
    precioUsd: detal,
    precioVenta: detal,
    precioUsdMayor: mayor,
    precio_usd_mayor: mayor,
    precioMayor: mayor,
    stockAlmacen01: stocks.stock01,
    stock_almacen_01: stocks.stock01,
    stockAlmacen02: stocks.stock02,
    stock_almacen_02: stocks.stock02,
    stock: stocks.total
  };
  const targetId = String(normalized.id || normalized.codigo || '').trim().toUpperCase();
  const existingIndex = products.findIndex(p =>
    (normalized.id && String(p.id).trim().toUpperCase() === targetId) ||
    (normalized.codigo && String(p.codigo).trim().toUpperCase() === targetId)
  );
  
  if (existingIndex >= 0) {
    products[existingIndex] = { ...products[existingIndex], ...normalized };
  } else {
    const newId = normalized.id || normalized.codigo || `OIL-${String(products.length + 1).padStart(3, '0')}`;
    products.push({ ...normalized, id: newId });
  }
  
  persistProductsToStorage(products);
  return products;
};

export const deleteProduct = (id) => {
  const target = String(id || '').trim().toUpperCase();
  const products = getProducts().filter(p =>
    String(p.id || '').trim().toUpperCase() !== target &&
    String(p.codigo || '').trim().toUpperCase() !== target
  );
  persistProductsToStorage(products);
  return products;
};

export const getClients = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.CLIENTS));
};

export const saveClient = (client) => {
  const clients = getClients();
  const existingIndex = clients.findIndex(c => c.id === client.id);
  if (existingIndex >= 0) {
    clients[existingIndex] = client;
  } else {
    client.id = `CLI-${String(clients.length + 1).padStart(3, '0')}`;
    clients.push(client);
  }
  localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
  return clients;
};

export const getSuppliers = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.SUPPLIERS));
};

export const saveSupplier = (supplier) => {
  const suppliers = getSuppliers();
  const existingIndex = suppliers.findIndex(s => s.id === supplier.id);
  if (existingIndex >= 0) {
    suppliers[existingIndex] = supplier;
  } else {
    supplier.id = `PROV-${String(suppliers.length + 1).padStart(3, '0')}`;
    suppliers.push(supplier);
  }
  localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(suppliers));
  return suppliers;
};

export const getSales = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.SALES));
};

const adjustLocalProductsStockForSale = (saleRecord, { reverse = false } = {}) => {
  if (!saleRecord || !Array.isArray(saleRecord.items) || saleRecord.items.length === 0) return [];
  const rawTipo = String(saleRecord.tipoDoc || saleRecord.tipo_doc || 'FACTURA').toUpperCase().trim();
  const isNotaEntrega =
    rawTipo === 'NOTA_ENTREGA' ||
    String(saleRecord.numeroDoc || saleRecord.factNum || saleRecord.id || '').toUpperCase().startsWith('NE-');
  const isNotaCredito = rawTipo === 'NOTA_CREDITO';
  const isSaleOut = rawTipo === 'FACTURA' || isNotaEntrega || rawTipo === 'NOTA_DEBITO';
  if (!isSaleOut && !isNotaCredito) return [];

  const targetWh = isNotaCredito
    ? (String(saleRecord.documentoAfectado || saleRecord.documento_afectado || '').toUpperCase().startsWith('NE') ? '02' : '01')
    : (isNotaEntrega ? '02' : '01');

  // Al emitir venta: FACT/NE/ND restan (-1), NC suma (+1). Al eliminar/revertir: se invierte el signo.
  const sign = (isNotaCredito ? 1 : -1) * (reverse ? -1 : 1);

  const products = getProducts();
  const touched = [];

  saleRecord.items.forEach(item => {
    const itemKey = String(item.articuloId || item.id || item.codigo || item.co_art || '').trim();
    const qty = Math.max(0, Number(item.cantidad ?? item.qty ?? 0));
    if (!itemKey || qty <= 0) return;

    const prodIndex = products.findIndex(
      p => String(p.id || '').trim() === itemKey || String(p.codigo || '').trim() === itemKey
    );
    if (prodIndex < 0) return;

    const currentStocks = getProductWarehouseStocks(products[prodIndex]);
    if (targetWh === '02') {
      currentStocks.stock02 = Math.max(0, currentStocks.stock02 + sign * qty);
    } else {
      currentStocks.stock01 = Math.max(0, currentStocks.stock01 + sign * qty);
    }
    products[prodIndex].stockAlmacen01 = currentStocks.stock01;
    products[prodIndex].stock_almacen_01 = currentStocks.stock01;
    products[prodIndex].stockAlmacen02 = currentStocks.stock02;
    products[prodIndex].stock_almacen_02 = currentStocks.stock02;
    products[prodIndex].stock = currentStocks.stock01 + currentStocks.stock02;
    touched.push(products[prodIndex]);
  });

  if (touched.length > 0) {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  }
  return touched;
};

export const saveSale = (saleData, options = {}) => {
  const { skipStockAdjustment = false } = options || {};
  const sales = getSales();
  const config = getConfig();

  const isNotaEntrega =
    String(saleData.tipoDoc || '').toUpperCase() === 'NOTA_ENTREGA' ||
    String(saleData.numeroDoc || saleData.id || '').toUpperCase().startsWith('NE-') ||
    String(saleData.pedidoOrigenDoc || '').toUpperCase().startsWith('PED-NE') ||
    saleData.modalidadVenta === 'OFICINA' ||
    saleData.almacen === '02' ||
    saleData.co_alma === '02';
  const effectiveTipoDoc = isNotaEntrega ? 'NOTA_ENTREGA' : (saleData.tipoDoc || 'FACTURA');
  const isCredit =
    isCreditPaymentCondition(saleData.condicionPago, saleData.metodoPago) ||
    Number(saleData.diasCredito || 0) > 0 ||
    isNotaEntrega;
  const docPrefix = effectiveTipoDoc === 'NOTA_CREDITO' ? 'NC' : (effectiveTipoDoc === 'NOTA_DEBITO' ? 'ND' : (effectiveTipoDoc === 'NOTA_ENTREGA' ? 'NE' : 'FACT'));
  let resolvedNumeroDoc = saleData.numeroDoc
    ? String(saleData.numeroDoc)
    : (effectiveTipoDoc === 'FACTURA'
        ? getNextInvoiceCorrelativo(sales)
        : getNextNotaEntregaCorrelativo(sales, REAL_PROFIT_INVOICES, docPrefix));
  if (isNotaEntrega && !String(resolvedNumeroDoc).toUpperCase().startsWith('NE-')) {
    resolvedNumeroDoc = `NE-${resolvedNumeroDoc}`;
  }

  if (effectiveTipoDoc === 'FACTURA') {
    commitInvoiceCorrelativo(resolvedNumeroDoc);
  } else if (effectiveTipoDoc === 'NOTA_ENTREGA') {
    commitNotaEntregaCorrelativo(resolvedNumeroDoc);
  }

  const itemsConLitros = (saleData.items || []).map(item => ({
    ...item,
    litros: item.litros || (item.cantidad * (item.litrosPorUnidad || 0))
  }));

  const taxes = calculateFiscalTaxes({
    items: itemsConLitros,
    tipoDoc: effectiveTipoDoc,
    metodoPago: saleData.metodoPago || 'EFECTIVO_USD',
    condicionPago: saleData.condicionPago || 'CONTADO',
    tasaBcv: config.tasaDolar,
    porcentajeRetencionIva: saleData.porcentajeRetencionIva || 75
  });

  const effectiveDiasCredito = saleData.diasCredito || (isCredit ? (resolveCreditDaysFromTerm(saleData.condicionPago) || 15) : 0);
  const effectiveFechaEmision = saleData.fechaEmision || saleData.fecha || new Date().toISOString();
  const effectiveFechaVencimiento = saleData.fechaVencimiento || (isCredit ? calculateExpirationDate(effectiveFechaEmision, effectiveDiasCredito).toISOString() : null);

  const resolvedId = (effectiveTipoDoc === 'FACTURA' || String(resolvedNumeroDoc).toUpperCase().startsWith(`${docPrefix}-`))
    ? resolvedNumeroDoc
    : `${docPrefix}-${resolvedNumeroDoc}`;

  const newSale = {
    id: resolvedId,
    numeroDoc: resolvedNumeroDoc,
    numeroControl: saleData.numeroControl || generateFiscalControlNumber(parseInt(resolvedNumeroDoc.replace(/[^0-9]/g, ''), 10) || (sales.length + 1)),
    tipoDoc: effectiveTipoDoc,
    documentoAfectado: saleData.documentoAfectado || '',
    fecha: effectiveFechaEmision,
    fechaEmision: effectiveFechaEmision,
    fechaVencimiento: effectiveFechaVencimiento,
    diasCredito: effectiveDiasCredito,
    clienteId: saleData.clienteId || 'CLI-003',
    clienteNombre: saleData.clienteNombre || 'CLIENTE CONTADO / MOSTRADOR OILSTONE',
    clienteRif: saleData.clienteRif || 'V-18456789-6',
    clienteDireccion: saleData.clienteDireccion || saleData.direccion || '',
    tasaDolar: config.tasaDolar,
    condicionPago: saleData.condicionPago || (isNotaEntrega ? 'CREDITO' : 'CONTADO'),
    items: itemsConLitros,
    subtotalUsd: taxes.subtotalNetoUsd,
    baseExentaUsd: taxes.baseExentaUsd,
    baseGeneralUsd: taxes.baseGeneralUsd,
    ivaGeneralUsd: taxes.ivaGeneralUsd,
    baseReducidaUsd: taxes.baseReducidaUsd,
    ivaReducidaUsd: taxes.ivaReducidoUsd,
    baseAdicionalUsd: taxes.baseAdicionalUsd,
    ivaAdicionalUsd: taxes.ivaAdicionalUsd,
    ivaUsd: taxes.totalIvaUsd,
    igtfUsd: taxes.igtfUsd,
    totalUsd: taxes.totalFacturaUsd,
    subtotalBs: taxes.subtotalNetoBs,
    baseExentaBs: taxes.baseExentaBs,
    baseGeneralBs: taxes.baseGeneralBs,
    ivaGeneralBs: taxes.ivaGeneralBs,
    baseReducidaBs: taxes.baseReducidaBs,
    ivaReducidaBs: taxes.ivaReducidoBs,
    baseAdicionalBs: taxes.baseAdicionalBs,
    ivaAdicionalBs: taxes.ivaAdicionalBs,
    ivaBs: taxes.totalIvaBs,
    igtfBs: taxes.igtfBs,
    totalBs: taxes.totalFacturaBs,
    saldoUsd: isCredit ? (isNotaEntrega ? taxes.subtotalNetoUsd : (Number(saleData.saldoUsd) > 0 ? Number(saleData.saldoUsd) : taxes.totalFacturaUsd)) : 0,
    saldoBs: isCredit ? (isNotaEntrega ? taxes.subtotalNetoBs : (Number(saleData.saldoBs) > 0 ? Number(saleData.saldoBs) : taxes.totalFacturaBs)) : 0,
    retencionIvaBs: taxes.retencionIvaBs,
    comprobanteRetencionIva: saleData.comprobanteRetencionIva || '',
    estado: isCredit ? 'PENDIENTE' : 'PAGADO',
    metodoPago: saleData.metodoPago || 'EFECTIVO_USD',
    vendedor: saleData.vendedor || 'Usuario Sistema',
    pedidoOrigenId: saleData.pedidoOrigenId || saleData.orderId || null,
    pedidoOrigenDoc: saleData.pedidoOrigenDoc || null,
    ...(!skipStockAdjustment ? { _createdOffline: true } : {})
  };

  // Ajuste de Stock Independiente por Almacén:
  // Almacén 01: Facturas Fiscales SENIAT y Notas de Débito
  // Almacén 02: Notas de Entrega / Despacho
  if (!skipStockAdjustment) {
    adjustLocalProductsStockForSale(newSale, { reverse: false });
  }

  // Movimientos de Caja y Cuentas por Cobrar
  if (!isCredit) {
    if (newSale.tipoDoc === 'NOTA_CREDITO') {
      addCashMovement({
        tipo: 'EGRESO',
        concepto: `Devolución / NC ${newSale.numeroDoc} a ${newSale.clienteNombre} (Afecta: ${newSale.documentoAfectado || 'N/A'})`,
        montoUsd: newSale.totalUsd,
        montoBs: newSale.totalBs,
        metodo: newSale.metodoPago,
        usuario: newSale.vendedor
      });
    } else {
      addCashMovement({
        tipo: 'INGRESO',
        concepto: `Cobro Venta ${newSale.numeroDoc} - ${newSale.clienteNombre}`,
        montoUsd: newSale.totalUsd,
        montoBs: newSale.totalBs,
        metodo: newSale.metodoPago,
        usuario: newSale.vendedor
      });
    }
  } else {
    const clients = getClients();
    const clientIndex = clients.findIndex(c => c.id === newSale.clienteId);
    if (clientIndex >= 0) {
      if (newSale.tipoDoc === 'NOTA_CREDITO') {
        clients[clientIndex].saldoDeudorUsd = Math.max(0, (clients[clientIndex].saldoDeudorUsd || 0) - newSale.totalUsd);
      } else {
        clients[clientIndex].saldoDeudorUsd = (clients[clientIndex].saldoDeudorUsd || 0) + newSale.totalUsd;
      }
      localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
    }
  }

  sales.unshift(newSale);
  localStorage.setItem(KEYS.SALES, JSON.stringify(sales));
  return newSale;
};

export const deleteStorageSale = (saleIdOrObj, options = {}) => {
  const { skipStockAdjustment = false } = options || {};
  if (!saleIdOrObj) return getSales();
  const rawId = typeof saleIdOrObj === 'object'
    ? (saleIdOrObj.id || saleIdOrObj.numeroDoc || saleIdOrObj.factNum || saleIdOrObj.factura)
    : saleIdOrObj;
  const rawNum = typeof saleIdOrObj === 'object'
    ? (saleIdOrObj.factNum || saleIdOrObj.factura || saleIdOrObj.numeroDoc || saleIdOrObj.id)
    : saleIdOrObj;

  const cleanStr = String(rawId || '').trim();
  const cleanNum = String(rawNum || '').replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
  const isInputNe = typeof saleIdOrObj === 'object'
    ? (String(saleIdOrObj.tipoDoc || saleIdOrObj.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' || /^(NE-|NDE-)/i.test(cleanStr) || /^(NE-|NDE-)/i.test(String(rawNum || '')))
    : /^(NE-|NDE-)/i.test(cleanStr);

  const isMatch = (s) => {
    if (!s) return false;
    const sId = String(s.id || '').trim();
    const sRawNum = String(s.numeroDoc || s.factura || s.factNum || '').trim();
    const sIsNe = String(s.tipoDoc || s.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' || /^(NE-|NDE-)/i.test(sId) || /^(NE-|NDE-)/i.test(sRawNum);
    if (sIsNe !== isInputNe) return false;
    const sNum = sRawNum.replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
    return (
      (cleanStr && (sId === cleanStr || sRawNum === cleanStr)) ||
      (cleanNum && (sNum === cleanNum || sRawNum === cleanNum || sId === cleanNum))
    );
  };

  const sales = getSales();
  const target = sales.find(isMatch);
  if (!skipStockAdjustment && target && Array.isArray(target.items)) {
    try {
      adjustLocalProductsStockForSale(target, { reverse: true });
    } catch (_) {}
  }
  const filtered = sales.filter(s => !isMatch(s));
  localStorage.setItem(KEYS.SALES, JSON.stringify(filtered));
  return filtered;
};

export const getPurchases = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.PURCHASES)) || [];
};

export const savePurchase = (purchaseData) => {
  const purchases = getPurchases();
  const config = getConfig();

  const numSecuencia = String(purchases.length + 1).padStart(3, '0');
  const dateObj = new Date();
  const voucherIva = generateVatRetentionVoucherNumber(dateObj, purchases.length + 1);
  const voucherIslr = voucherIva;

  const newPurchase = {
    id: `COMP-${numSecuencia}`,
    numeroFacturaProv: purchaseData.numeroFacturaProv,
    numeroControl: purchaseData.numeroControl || generateFiscalControlNumber(purchases.length + 5821),
    tipoDoc: purchaseData.tipoDoc || 'FACTURA',
    documentoAfectado: purchaseData.documentoAfectado || '',
    fecha: purchaseData.fecha || dateObj.toISOString(),
    proveedorId: purchaseData.proveedorId || 'PROV-001',
    proveedorNombre: purchaseData.proveedorNombre || 'Proveedor General',
    proveedorRif: purchaseData.proveedorRif || 'J-00000000-0',
    proveedorDireccion: purchaseData.proveedorDireccion || '',
    tasaDolar: config.tasaDolar,
    producto: purchaseData.producto,
    cantidad: Number(purchaseData.cantidad) || 0,
    costoUnitarioUsd: Number(purchaseData.costoUnitarioUsd) || 0,
    subtotalUsd: Number(purchaseData.subtotalUsd) || 0,
    baseExentaUsd: Number(purchaseData.baseExentaUsd) || 0,
    baseGeneralUsd: Number(purchaseData.baseGeneralUsd) || Number(purchaseData.subtotalUsd) || 0,
    ivaGeneralUsd: Number(purchaseData.ivaGeneralUsd) || 0,
    totalUsd: Number(purchaseData.totalUsd) || 0,
    subtotalBs: (Number(purchaseData.subtotalUsd) || 0) * config.tasaDolar,
    baseExentaBs: (Number(purchaseData.baseExentaUsd) || 0) * config.tasaDolar,
    baseGeneralBs: (Number(purchaseData.baseGeneralUsd) || Number(purchaseData.subtotalUsd) || 0) * config.tasaDolar,
    ivaGeneralBs: (Number(purchaseData.ivaGeneralUsd) || 0) * config.tasaDolar,
    totalBs: (Number(purchaseData.totalUsd) || 0) * config.tasaDolar,
    retencionIvaUsd: Number(purchaseData.retencionIvaUsd) || 0,
    retencionIvaBs: (Number(purchaseData.retencionIvaUsd) || 0) * config.tasaDolar,
    retencionIslrUsd: Number(purchaseData.retencionIslrUsd) || 0,
    retencionIslrBs: (Number(purchaseData.retencionIslrUsd) || 0) * config.tasaDolar,
    numeroComprobanteRetencionIva: purchaseData.numeroComprobanteRetencionIva || voucherIva,
    numeroComprobanteRetencionIslr: purchaseData.numeroComprobanteRetencionIslr || voucherIslr,
    codigoConceptoIslr: purchaseData.codigoConceptoIslr || '055',
    receptor: purchaseData.receptor || 'Pedro Gómez'
  };

  purchases.unshift(newPurchase);
  localStorage.setItem(KEYS.PURCHASES, JSON.stringify(purchases));
  return newPurchase;
};

export const getCashMovements = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.CASH_MOVEMENTS));
};

export const addCashMovement = (mov) => {
  const movements = getCashMovements();
  const newMov = {
    id: `MOV-${String(movements.length + 1).padStart(3, '0')}`,
    fecha: new Date().toISOString(),
    ...mov
  };
  movements.unshift(newMov);
  localStorage.setItem(KEYS.CASH_MOVEMENTS, JSON.stringify(movements));
  return movements;
};

export const getFiscalClosures = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.FISCAL_CLOSURES)) || [];
};

export const saveFiscalClosure = (closureData) => {
  const closures = getFiscalClosures();
  closures.unshift(closureData);
  localStorage.setItem(KEYS.FISCAL_CLOSURES, JSON.stringify(closures));
  return closureData;
};

export const closeSalesInStorage = (closureId, saleIds = []) => {
  const sales = getSales();
  const updatedSales = sales.map(s => {
    if (saleIds.includes(s.id)) {
      return { ...s, cierreZId: closureId, cerrada: true };
    }
    return s;
  });
  localStorage.setItem(KEYS.SALES, JSON.stringify(updatedSales));
  return updatedSales;
};

export const getUserLogs = () => {
  try {
    const raw = localStorage.getItem(KEYS.USER_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const addUserLog = (logData) => {
  const logs = getUserLogs();
  const newLog = {
    id: logData.id || `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    usuarioId: logData.usuarioId || logData.usuario_id || null,
    usuarioNombre: logData.usuarioNombre || logData.usuario_nombre || 'Sistema',
    usuarioRol: logData.usuarioRol || logData.usuario_rol || 'ADMIN',
    accion: logData.accion,
    modulo: logData.modulo || 'USUARIOS',
    detalles: logData.detalles || '',
    createdAt: logData.createdAt || logData.created_at || new Date().toISOString()
  };
  logs.unshift(newLog);
  // Mantener últimos 150 registros en almacenamiento local
  if (logs.length > 150) logs.length = 150;
  localStorage.setItem(KEYS.USER_LOGS, JSON.stringify(logs));
  return newLog;
};

// Orders / Preventa
export const getOrders = () => {
  initStorage();
  try {
    const raw = localStorage.getItem(KEYS.ORDERS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ORDERS;
  } catch (_) {
    return INITIAL_ORDERS;
  }
};

export const saveOrder = (order) => {
  const orders = getOrders();
  const existingIndex = orders.findIndex(o => o.id === order.id);
  if (existingIndex >= 0) {
    orders[existingIndex] = { ...orders[existingIndex], ...order, updatedAt: new Date().toISOString() };
  } else {
    orders.unshift({ ...order, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  return orders;
};

export const updateOrderStatus = (orderId, newStatus) => {
  const orders = getOrders();
  const index = orders.findIndex(o => o.id === orderId);
  if (index >= 0) {
    orders[index].status = newStatus;
    orders[index].updatedAt = new Date().toISOString();
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));
  }
  return orders;
};

export const deleteStorageOrder = (orderId) => {
  const orders = getOrders();
  const filtered = orders.filter(o => o.id !== orderId && o.numeroDoc !== orderId);
  localStorage.setItem(KEYS.ORDERS, JSON.stringify(filtered));
  return filtered;
};

export const getStorageSellers = () => {
  try {
    const raw = localStorage.getItem(KEYS.SELLERS);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PROFIT_SELLERS;
    return parsed.map(s => {
      const coVen = String(s?.coVen || s?.co_ven || s?.id || '').trim();
      const venDes = String(s?.venDes || s?.ven_des || s?.nombre || '').trim();
      const fallback = (DEFAULT_PROFIT_SELLERS || []).find(
        r =>
          (r.coVen && String(r.coVen).trim().toLowerCase() === coVen.toLowerCase()) ||
          (r.venDes && venDes && String(r.venDes).trim().toLowerCase() === venDes.toLowerCase())
      );
      const coZon = String(s?.coZon || s?.co_zon || fallback?.coZon || fallback?.co_zon || '').trim();
      const zona = String(s?.zona || fallback?.zona || '').trim();
      return {
        ...fallback,
        ...s,
        coVen: coVen || fallback?.coVen || '',
        co_ven: coVen || fallback?.coVen || '',
        venDes: venDes || fallback?.venDes || '',
        ven_des: venDes || fallback?.venDes || '',
        coZon,
        co_zon: coZon,
        zona
      };
    });
  } catch (_) {
    return DEFAULT_PROFIT_SELLERS;
  }
};

export const saveStorageSeller = (sellerData) => {
  const current = getStorageSellers();
  const coVen = (sellerData?.coVen || sellerData?.co_ven || sellerData?.id || '').toString().trim();
  const coVenLower = coVen.toLowerCase();
  const venDesLower = (sellerData?.venDes || sellerData?.ven_des || '').toString().trim().toLowerCase();
  const nowIso = new Date().toISOString();
  let matched = false;

  const updated = current.map(s => {
    const sCo = (s.coVen || s.co_ven || s.id || '').toString().trim().toLowerCase();
    const sName = (s.venDes || s.ven_des || '').toString().trim().toLowerCase();
    const isCodeMatch = coVenLower && (sCo === coVenLower || sCo === `usr-seller-${coVenLower}` || `usr-seller-${sCo}` === coVenLower);
    const isNameMatch = venDesLower && sName && sName === venDesLower;
    if (isCodeMatch || isNameMatch) {
      matched = true;
      return {
        ...s,
        ...sellerData,
        coVen: s.coVen || s.co_ven || coVen,
        co_ven: s.co_ven || s.coVen || coVen,
        updatedAt: nowIso
      };
    }
    return s;
  });

  if (!matched && coVen) {
    updated.push({
      ...sellerData,
      coVen,
      co_ven: coVen,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  localStorage.setItem(KEYS.SELLERS, JSON.stringify(updated));
  return updated;
};

export const saveStorageAllSellers = (sellersList) => {
  if (!Array.isArray(sellersList)) return [];
  localStorage.setItem(KEYS.SELLERS, JSON.stringify(sellersList));
  return sellersList;
};

export const getCommissionSettlements = () => {
  try {
    const raw = localStorage.getItem(KEYS.COMMISSION_SETTLEMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

export const saveCommissionSettlement = (settlement) => {
  const list = getCommissionSettlements();
  const existingIdx = list.findIndex(s => s.id === settlement.id);
  const enriched = {
    ...settlement,
    id: settlement.id || `LIQ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    fechaRegistro: settlement.fechaRegistro || new Date().toISOString()
  };

  if (existingIdx >= 0) {
    list[existingIdx] = enriched;
  } else {
    list.unshift(enriched);
  }
  localStorage.setItem(KEYS.COMMISSION_SETTLEMENTS, JSON.stringify(list));
  return enriched;
};

export const deleteCommissionSettlement = (id) => {
  const list = getCommissionSettlements().filter(s => s.id !== id);
  localStorage.setItem(KEYS.COMMISSION_SETTLEMENTS, JSON.stringify(list));
  return list;
};

export const getStorageNotifications = () => {
  try {
    const raw = localStorage.getItem(KEYS.NOTIFICATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

export const saveStorageNotification = (notif) => {
  const list = getStorageNotifications();
  const existingIdx = list.findIndex(n => n.id === notif.id);
  const enriched = {
    ...notif,
    id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    created_at: notif.created_at || new Date().toISOString(),
    leida: Boolean(notif.leida)
  };

  if (existingIdx >= 0) {
    list[existingIdx] = enriched;
  } else {
    list.unshift(enriched);
  }
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(list));
  return enriched;
};

export const markStorageNotificationRead = (id) => {
  const list = getStorageNotifications();
  const updated = list.map(n => n.id === id ? { ...n, leida: true, fecha_leida: new Date().toISOString() } : n);
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
  return updated;
};

export const markAllStorageNotificationsRead = () => {
  const list = getStorageNotifications();
  const now = new Date().toISOString();
  const updated = list.map(n => ({ ...n, leida: true, fecha_leida: now }));
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
  return updated;
};

export const deleteStorageNotification = (id) => {
  const list = getStorageNotifications().filter(n => n.id !== id);
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(list));
  return list;
};

export const resetToDefaults = () => {
  localStorage.clear();
  initStorage();
};

