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
  REAL_PROFIT_SELLERS
} from '../data/supabaseRealData.js';
import {
  calculateFiscalTaxes,
  generateFiscalControlNumber,
  generateVatRetentionVoucherNumber
} from './fiscalService.js';

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
    const hasValidPrices = Array.isArray(parsedProds) && parsedProds.length >= 40 && parsedProds.some(p => Number(p.precioUsdDetal || p.precio_usd_detal || p.precio || 0) > 0);
    if (!hasValidPrices) {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(REAL_PRODUCTS));
    }
  } catch (_) {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(REAL_PRODUCTS));
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
    const hasValidZones =
      Array.isArray(parsedSellers) &&
      parsedSellers.length >= 10 &&
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
    if (!parsedOrders || parsedOrders.length < 15) {
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

export const getProducts = () => {
  initStorage();
  return JSON.parse(localStorage.getItem(KEYS.PRODUCTS));
};

export const saveProduct = (product) => {
  const products = getProducts();
  const existingIndex = products.findIndex(p => p.id === product.id);
  
  if (existingIndex >= 0) {
    products[existingIndex] = product;
  } else {
    const newId = `OIL-${String(products.length + 1).padStart(3, '0')}`;
    products.push({ ...product, id: newId });
  }
  
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  return products;
};

export const deleteProduct = (id) => {
  const products = getProducts().filter(p => p.id !== id);
  localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
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

export const saveSale = (saleData) => {
  const sales = getSales();
  const products = getProducts();
  const config = getConfig();

  const numSecuencia = String(sales.length + 1043).padStart(6, '0');
  
  const itemsConLitros = (saleData.items || []).map(item => ({
    ...item,
    litros: item.litros || (item.cantidad * (item.litrosPorUnidad || 0))
  }));

  const taxes = calculateFiscalTaxes({
    items: itemsConLitros,
    metodoPago: saleData.metodoPago || 'EFECTIVO_USD',
    condicionPago: saleData.condicionPago || 'CONTADO',
    tasaBcv: config.tasaDolar,
    porcentajeRetencionIva: saleData.porcentajeRetencionIva || 75
  });

  const docPrefix = saleData.tipoDoc === 'NOTA_CREDITO' ? 'NC' : (saleData.tipoDoc === 'NOTA_DEBITO' ? 'ND' : (saleData.tipoDoc === 'NOTA_ENTREGA' ? 'NE' : 'FACT'));

  const newSale = {
    id: `${docPrefix}-${numSecuencia}`,
    numeroDoc: saleData.numeroDoc || `${docPrefix}-${numSecuencia}`,
    numeroControl: saleData.numeroControl || generateFiscalControlNumber(sales.length + 1043),
    tipoDoc: saleData.tipoDoc || 'FACTURA',
    documentoAfectado: saleData.documentoAfectado || '',
    fecha: saleData.fecha || new Date().toISOString(),
    clienteId: saleData.clienteId || 'CLI-003',
    clienteNombre: saleData.clienteNombre || 'CLIENTE CONTADO / MOSTRADOR OILSTONE',
    clienteRif: saleData.clienteRif || 'V-18456789-6',
    tasaDolar: config.tasaDolar,
    condicionPago: saleData.condicionPago || 'CONTADO',
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
    retencionIvaBs: taxes.retencionIvaBs,
    comprobanteRetencionIva: saleData.comprobanteRetencionIva || '',
    estado: saleData.condicionPago === 'CREDITO' ? 'PENDIENTE' : 'PAGADO',
    metodoPago: saleData.metodoPago || 'EFECTIVO_USD',
    vendedor: saleData.vendedor || 'Usuario Sistema'
  };

  // Ajuste de Stock
  if (newSale.tipoDoc === 'FACTURA' || newSale.tipoDoc === 'NOTA_ENTREGA' || newSale.tipoDoc === 'NOTA_DEBITO') {
    newSale.items.forEach(item => {
      const prodIndex = products.findIndex(p => p.id === item.articuloId);
      if (prodIndex >= 0) {
        products[prodIndex].stock = Math.max(0, products[prodIndex].stock - item.cantidad);
      }
    });
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  } else if (newSale.tipoDoc === 'NOTA_CREDITO') {
    // En Nota de Crédito se reingresa la mercancía devuelta al stock
    newSale.items.forEach(item => {
      const prodIndex = products.findIndex(p => p.id === item.articuloId);
      if (prodIndex >= 0) {
        products[prodIndex].stock += item.cantidad;
      }
    });
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
  }

  // Movimientos de Caja y Cuentas por Cobrar
  if (newSale.condicionPago !== 'CREDITO') {
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
  const idx = current.findIndex(s => (s.coVen || s.co_ven || s.id || '').toString().trim() === coVen);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...sellerData, updatedAt: new Date().toISOString() };
  } else {
    current.push({ ...sellerData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(KEYS.SELLERS, JSON.stringify(current));
  return current;
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

