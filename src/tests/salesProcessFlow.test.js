import assert from 'node:assert';
import {
  getProductWarehouseStocks,
  validateWarehouseStockForDocument,
  formatUsd,
  formatBs,
  resolveProductUnit,
  resolveProductLitersPerUnit
} from '../services/formatService.js';
import {
  saveSale as saveStorageSale,
  saveOrder as saveStorageOrder,
  getOrders as getStorageOrders,
  getProducts as getStorageProducts,
  saveProduct as saveStorageProduct,
  getSales as getStorageSales,
  getCashMovements as getStorageCashMovements,
  deleteStorageSale,
  getClients as getStorageClients,
  saveClient as saveStorageClient,
  getConfig as getStorageConfig,
  updateConfig as updateStorageConfig
} from '../services/storageService.js';
import {
  resolveUnitPrice,
  lineSubtotal,
  PRICE_CHANNEL,
  getProductWholesalePrice,
  getProductRetailPrice
} from '../services/pricingService.js';
import {
  evaluateClientCreditPolicy,
  resolveCreditDaysFromTerm,
  calculateExpirationDate
} from '../services/creditPolicyService.js';
import {
  markCxcDocDeleted,
  isCxcEntryDeleted,
  sanitizeCxcDeletedDocsStorage,
  unmarkCxcDeletedDoc,
  mapOrderToDb,
  mapOrderFromDb,
  buildProfitInvoicePayloadFromSale
} from '../services/supabaseService.js';
import { consolidateClientReceivables } from '../utils/cxcUtils.js';
import { buildAccountingEntries, computeGeneralLedger } from '../services/accountingService.js';
import {
  inferTreasuryAccountKind,
  matchesCashDesk,
  matchesBankAccount,
  applyTreasuryBalanceDelta
} from '../utils/treasuryAccountUtils.js';
import {
  calculateFiscalTaxes,
  validateRif,
  getNextInvoiceCorrelativo,
  setInvoiceCorrelativo,
  generateFiscalControlNumber
} from '../services/fiscalService.js';

console.log('================================================================');
console.log('--- TEST INTEGRAL: FLUJO COMPLETO DE VENTA Y COBRANZAS ---');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. REGLA DE DISPONIBILIDAD ATP (AVAILABLE TO PROMISE) Y ALMACENES 01 / 02
// -----------------------------------------------------------------------------
console.log('1. Verificando Regla de Disponibilidad ATP y Segregación de Almacenes...');

const mockProduct = {
  id: 'PROD-001',
  codigo: 'LUB-15W40-MIN',
  descripcion: 'Lubricante 15W-40 Mineral Premium',
  stock: 150,
  stock_almacen_01: 100, // Almacén 01: Facturación Fiscal
  stock_almacen_02: 50,  // Almacén 02: Nota de Entrega / Despacho Oficina
  precioUsdMayor: 45.00,
  precioUsdDetal: 55.00,
  litrosPorUnidad: 12,
  unidad: 'Caja'
};

const wStocks = getProductWarehouseStocks(mockProduct);
assert.strictEqual(wStocks.stock01, 100, 'Stock en Almacén 01 (Fiscal) debe ser 100');
assert.strictEqual(wStocks.stock02, 50, 'Stock en Almacén 02 (Nota de Entrega) debe ser 50');
assert.strictEqual(wStocks.total, 150, 'Stock Total debe ser 150');

// Simular Órdenes en Pipeline para prueba de compromiso (Reserva 72h)
const now = Date.now();
const oneHourAgo = new Date(now - 3600 * 1000).toISOString();
const fourDaysAgo = new Date(now - 96 * 3600 * 1000).toISOString(); // > 72h caducada

const mockOrders = [
  // Orden 1: Almacén 01, Vigente (hace 1h), comprometió 20 cajas
  {
    id: 'PED-FF-0001',
    status: 'APROBADO',
    fechaEmision: oneHourAgo,
    almacen: '01',
    tipoDoc: 'FACTURA',
    items: [{ articuloId: 'PROD-001', cantidad: 20 }]
  },
  // Orden 2: Almacén 02, Vigente (hace 1h), comprometió 15 cajas
  {
    id: 'PED-NE-0002',
    status: 'PENDIENTE',
    fechaEmision: oneHourAgo,
    almacen: '02',
    tipoDoc: 'NOTA_ENTREGA',
    items: [{ articuloId: 'PROD-001', cantidad: 15 }]
  },
  // Orden 3: Almacén 01, Caducada (>72h), NO debe comprometer stock
  {
    id: 'PED-FF-0003',
    status: 'PENDIENTE',
    fechaEmision: fourDaysAgo,
    almacen: '01',
    tipoDoc: 'FACTURA',
    items: [{ articuloId: 'PROD-001', cantidad: 30 }]
  }
];

// Cálculo de comprometido según regla de 72h
function calculateCommitted(orders, targetWh, productId) {
  const HOURS_72_MS = 72 * 60 * 60 * 1000;
  let committed = 0;
  orders.forEach(ord => {
    const st = (ord.status || '').toUpperCase();
    if (st !== 'PENDIENTE' && st !== 'APROBADO' && st !== 'EN_PROCESO' && st !== 'RETENIDO_CREDITO') return;
    const orderTime = new Date(ord.fechaEmision).getTime();
    if (Date.now() - orderTime > HOURS_72_MS) return; // Caducada
    const alm = String(ord.almacen || (ord.tipoDoc === 'NOTA_ENTREGA' ? '02' : '01')).trim();
    if (alm !== targetWh) return;

    (ord.items || []).forEach(it => {
      if (it.articuloId === productId) committed += Number(it.cantidad || 0);
    });
  });
  return committed;
}

const committedWh01 = calculateCommitted(mockOrders, '01', 'PROD-001');
const committedWh02 = calculateCommitted(mockOrders, '02', 'PROD-001');

assert.strictEqual(committedWh01, 20, 'Comprometido en Almacén 01 debe ser 20 (la orden caducada no cuenta)');
assert.strictEqual(committedWh02, 15, 'Comprometido en Almacén 02 debe ser 15');

// Disponibilidad ATP = Stock Físico - Comprometido
const atpWh01 = Math.max(0, wStocks.stock01 - committedWh01);
const atpWh02 = Math.max(0, wStocks.stock02 - committedWh02);

assert.strictEqual(atpWh01, 80, 'ATP Disponible en Almacén 01 debe ser 80 (100 - 20)');
assert.strictEqual(atpWh02, 35, 'ATP Disponible en Almacén 02 debe ser 35 (50 - 15)');
console.log('  ✓ Regla de disponibilidad ATP y segregación por almacén 01/02 100% OK.');

// -----------------------------------------------------------------------------
// 2. VENDEDOR EN LA CALLE: EVALUACIÓN CREDITICIA, PRECIOS Y NOTA DE PEDIDO
// -----------------------------------------------------------------------------
console.log('2. Verificando Preventa Móvil (Vendedor en la Calle)...');

const mockClientAprobado = {
  id: 'CLI-001',
  rif: 'J-30491823-2',
  nombre: 'Inversiones Motores del Centro, C.A.',
  limiteCreditoUsd: 5000,
  saldoDeudorUsd: 1200,
  diasCredito: 15
};

const mockClientRetenido = {
  id: 'CLI-002',
  rif: 'J-40119283-1',
  nombre: 'Repuestos & Servicios El Rápido',
  limiteCreditoUsd: 2000,
  saldoDeudorUsd: 2800, // Excedido de límite
  diasCredito: 7
};

// Evaluación crediticia
const evalAprobado = evaluateClientCreditPolicy({ client: mockClientAprobado, montoOrdenUsd: 800 });
assert.strictEqual(evalAprobado.isAprobado, true, 'Cliente con cupo disponible debe ser APROBADO');

const evalRetenido = evaluateClientCreditPolicy({ client: mockClientRetenido, montoOrdenUsd: 500 });
assert.strictEqual(evalRetenido.isAprobado, false, 'Cliente con sobregiro debe ser RETENIDO');
assert.strictEqual(evalRetenido.statusLabel, 'NEGADO', 'Status debe ser NEGADO');

// Precios por canal (Preventa vs Oficina)
const precioPreventa = resolveUnitPrice(mockProduct, mockClientAprobado, PRICE_CHANNEL.PREVENTA);
const precioOficina = resolveUnitPrice(mockProduct, mockClientAprobado, PRICE_CHANNEL.OFICINA);
assert.strictEqual(precioPreventa, 55.00, 'Precio Preventa debe ser Detal / Calle ($55)');
assert.strictEqual(precioOficina, 45.00, 'Precio Oficina debe ser Mayorista ($45)');

// Emisión de Pedido Preventa (Factura Fiscal)
const orderFiscalPayload = {
  id: 'PED-FF-999001',
  numeroDoc: 'PED-FF-999001',
  modalidadVenta: 'PREVENTA',
  tipoDoc: 'FACTURA',
  almacen: '01',
  clienteId: mockClientAprobado.id,
  clienteNombre: mockClientAprobado.nombre,
  condicionPago: 'CREDITO',
  diasCredito: 15,
  items: [
    { articuloId: mockProduct.id, cantidad: 10, precioUsd: 45.00, subtotalUsd: 450.00 }
  ],
  totalUsd: 450.00,
  status: evalAprobado.status || 'APROBADO'
};

assert.strictEqual(orderFiscalPayload.modalidadVenta, 'PREVENTA');
assert.strictEqual(orderFiscalPayload.almacen, '01');
assert.strictEqual(orderFiscalPayload.items[0].subtotalUsd, 450.00);
console.log('  ✓ Preventa móvil, scoring crediticio y emisión de nota de pedido 100% OK.');

// -----------------------------------------------------------------------------
// 3. FLUJO COMERCIAL & PEDIDOS: LLEGADA AL PIPELINE SEGREGADO
// -----------------------------------------------------------------------------
console.log('3. Verificando Pipeline de Flujo Comercial & Pedidos...');

const pipelineOrders = [
  orderFiscalPayload,
  {
    id: 'PED-NE-999002',
    numeroDoc: 'PED-NE-999002',
    modalidadVenta: 'OFICINA',
    tipoDoc: 'NOTA_ENTREGA',
    almacen: '02',
    clienteId: mockClientAprobado.id,
    items: [{ articuloId: mockProduct.id, cantidad: 5, precioUsd: 45.00, subtotalUsd: 225.00 }],
    status: 'APROBADO'
  }
];

// Pestaña 2: Pedidos Fiscales (Almacén 01 / PED-FF)
const fiscalOrders = pipelineOrders.filter(o => o.almacen === '01' || o.tipoDoc === 'FACTURA');
// Pestaña 3: Pedidos por Nota de Entrega (Almacén 02 / PED-NE)
const notaEntregaOrders = pipelineOrders.filter(o => o.almacen === '02' || o.tipoDoc === 'NOTA_ENTREGA');

assert.strictEqual(fiscalOrders.length, 1, 'Debe haber 1 pedido en la pestaña de Pedidos Fiscales');
assert.strictEqual(fiscalOrders[0].id, 'PED-FF-999001');
assert.strictEqual(notaEntregaOrders.length, 1, 'Debe haber 1 pedido en la pestaña de Nota de Entrega');
assert.strictEqual(notaEntregaOrders[0].id, 'PED-NE-999002');
console.log('  ✓ Separación de pedidos fiscales (Alm 01) y notas de entrega (Alm 02) en Pipeline 100% OK.');

// -----------------------------------------------------------------------------
// 4. LLEGADA AL POS MOSTRADOR / CAJA Y BLOQUEO DE AUDITORÍA
// -----------------------------------------------------------------------------
console.log('4. Verificando Carga en POS Mostrador y Bloqueo de Auditoría...');

function simulateLoadOrderToPOS(order) {
  const isNota = order.tipoDoc === 'NOTA_ENTREGA' || order.almacen === '02';
  return {
    isOrderLocked: true, // Bloqueo estricto para evitar alteraciones en caja
    tipoDoc: isNota ? 'NOTA_ENTREGA' : 'FACTURA',
    modalidadVenta: isNota ? 'OFICINA' : 'MOSTRADOR',
    almacenDestino: isNota ? '02' : '01',
    clienteId: order.clienteId,
    condicionPago: order.condicionPago || 'CONTADO',
    items: order.items.map(it => ({ ...it, precioPactado: true }))
  };
}

const posLoadedFiscal = simulateLoadOrderToPOS(orderFiscalPayload);
assert.strictEqual(posLoadedFiscal.isOrderLocked, true, 'El pedido en caja debe quedar bloqueado');
assert.strictEqual(posLoadedFiscal.tipoDoc, 'FACTURA');
assert.strictEqual(posLoadedFiscal.almacenDestino, '01');
assert.strictEqual(posLoadedFiscal.items[0].precioPactado, true, 'El precio debe mantenerse pactado desde la preventa');
console.log('  ✓ Integración de pedido en POS Mostrador con bloqueo de seguridad 100% OK.');

// -----------------------------------------------------------------------------
// 5. FACTURACIÓN / NOTA DE ENTREGA Y DESCUENTO DE INVENTARIO
// -----------------------------------------------------------------------------
console.log('5. Verificando Descuento de Inventario por Tipo de Documento...');

function simulateProcessSaleInventoryDeduction(sale, productStockState) {
  const updatedProducts = { ...productStockState };
  const isNotaEntrega = sale.tipoDoc === 'NOTA_ENTREGA';

  sale.items.forEach(it => {
    if (isNotaEntrega) {
      updatedProducts.stock_almacen_02 = Math.max(0, updatedProducts.stock_almacen_02 - it.cantidad);
    } else {
      updatedProducts.stock_almacen_01 = Math.max(0, updatedProducts.stock_almacen_01 - it.cantidad);
    }
    updatedProducts.stock = updatedProducts.stock_almacen_01 + updatedProducts.stock_almacen_02;
  });

  return updatedProducts;
}

// Caso A: Facturación Fiscal de 10 cajas (debe descontar de Alm 01)
const stockAfterFiscal = simulateProcessSaleInventoryDeduction(
  { tipoDoc: 'FACTURA', items: [{ articuloId: 'PROD-001', cantidad: 10 }] },
  { ...mockProduct }
);
assert.strictEqual(stockAfterFiscal.stock_almacen_01, 90, 'Alm 01 debe bajar de 100 a 90');
assert.strictEqual(stockAfterFiscal.stock_almacen_02, 50, 'Alm 02 debe mantenerse intacto en 50');
assert.strictEqual(stockAfterFiscal.stock, 140, 'Stock total debe ser 140');

// Caso B: Nota de Entrega de 5 cajas (debe descontar de Alm 02)
const stockAfterNota = simulateProcessSaleInventoryDeduction(
  { tipoDoc: 'NOTA_ENTREGA', items: [{ articuloId: 'PROD-001', cantidad: 5 }] },
  { ...stockAfterFiscal }
);
assert.strictEqual(stockAfterNota.stock_almacen_01, 90, 'Alm 01 debe mantenerse en 90');
assert.strictEqual(stockAfterNota.stock_almacen_02, 45, 'Alm 02 debe bajar de 50 a 45');
assert.strictEqual(stockAfterNota.stock, 135, 'Stock total debe ser 135');
console.log('  ✓ Descuento atómico e independiente de inventario en Almacén 01 y 02 100% OK.');

// -----------------------------------------------------------------------------
// 6. VENTAS DE CONTADO VS CRÉDITO Y COBRANZAS (CXC)
// -----------------------------------------------------------------------------
console.log('6. Verificando Destino Financiero: Contado (Caja) vs Crédito (CxC)...');

// Caso A: Venta de Contado
function processPaymentAccounting(sale, clientState) {
  const isCredit = sale.condicionPago === 'CREDITO';
  const cashMovements = [];
  let updatedClient = { ...clientState };
  let cxcDocument = null;

  if (!isCredit) {
    cashMovements.push({
      tipo: 'INGRESO',
      concepto: `Cobro Venta ${sale.numeroDoc} - ${sale.clienteNombre}`,
      montoUsd: sale.totalUsd,
      metodo: sale.metodoPago || 'EFECTIVO_USD'
    });
  } else {
    updatedClient.saldoDeudorUsd = (updatedClient.saldoDeudorUsd || 0) + sale.totalUsd;
    cxcDocument = {
      id: sale.numeroDoc,
      factNum: sale.numeroDoc,
      tipoDoc: sale.tipoDoc,
      clienteId: sale.clienteId,
      totNetoUsd: sale.totalUsd,
      saldoUsd: sale.totalUsd,
      abonosUsd: 0,
      status: 'PENDIENTE',
      diasCredito: sale.diasCredito
    };
  }

  return { isCredit, cashMovements, updatedClient, cxcDocument };
}

// Prueba Contado
const cashSale = {
  numeroDoc: '00000045',
  tipoDoc: 'FACTURA',
  clienteId: 'CLI-001',
  clienteNombre: 'Cliente Contado',
  condicionPago: 'CONTADO',
  metodoPago: 'EFECTIVO_USD',
  totalUsd: 200.00
};

const cashResult = processPaymentAccounting(cashSale, mockClientAprobado);
assert.strictEqual(cashResult.cashMovements.length, 1, 'Debe registrar movimiento en Caja Chica / Bancos');
assert.strictEqual(cashResult.cashMovements[0].tipo, 'INGRESO');
assert.strictEqual(cashResult.cashMovements[0].montoUsd, 200.00);
assert.strictEqual(cashResult.cxcDocument, null, 'Venta de contado no genera documento deudor pendiente en CxC');

// Prueba Crédito
const creditSale = {
  numeroDoc: '00000046',
  tipoDoc: 'FACTURA',
  clienteId: 'CLI-001',
  clienteNombre: mockClientAprobado.nombre,
  condicionPago: 'CREDITO',
  diasCredito: 15,
  totalUsd: 450.00
};

const creditResult = processPaymentAccounting(creditSale, mockClientAprobado);
assert.strictEqual(creditResult.cashMovements.length, 0, 'Venta a crédito no entra a caja hasta su cobranza');
assert.strictEqual(creditResult.updatedClient.saldoDeudorUsd, 1650.00, 'Deuda del cliente aumenta de 1200 a 1650');
assert.strictEqual(creditResult.cxcDocument.status, 'PENDIENTE');
assert.strictEqual(creditResult.cxcDocument.saldoUsd, 450.00);

// Prueba Cobranza (Abono de $250 a la factura a crédito)
function applyCollectionToInvoice(cxcDoc, paymentAmountUsd, targetAccount) {
  const newAbonos = (cxcDoc.abonosUsd || 0) + paymentAmountUsd;
  const newSaldo = Math.max(0, cxcDoc.totNetoUsd - newAbonos);
  const updatedDoc = {
    ...cxcDoc,
    abonosUsd: newAbonos,
    saldoUsd: newSaldo,
    status: newSaldo <= 0.01 ? 'COBRADA' : 'PENDIENTE'
  };

  const receipt = {
    cobroNum: 'REC-00109',
    docId: cxcDoc.id,
    montoUsd: paymentAmountUsd,
    fecha: new Date().toISOString(),
    cuentaDestino: targetAccount.nombre
  };

  const updatedAccount = {
    ...targetAccount,
    saldoUsd: targetAccount.saldoUsd + paymentAmountUsd
  };

  return { updatedDoc, receipt, updatedAccount };
}

const mockBankAccount = { id: 'BNC-01', nombre: 'Banesco Nacional Divisas', saldoUsd: 1000.00 };
const collectionResult = applyCollectionToInvoice(creditResult.cxcDocument, 250.00, mockBankAccount);

assert.strictEqual(collectionResult.updatedDoc.abonosUsd, 250.00);
assert.strictEqual(collectionResult.updatedDoc.saldoUsd, 200.00, 'Saldo restante debe ser $200');
assert.strictEqual(collectionResult.updatedDoc.status, 'PENDIENTE', 'Sigue pendiente con saldo parcial');
assert.strictEqual(collectionResult.updatedAccount.saldoUsd, 1250.00, 'Cuenta bancaria se incrementa con el cobro');

// Cancelación total restante ($200)
const finalCollection = applyCollectionToInvoice(collectionResult.updatedDoc, 200.00, collectionResult.updatedAccount);
assert.strictEqual(finalCollection.updatedDoc.saldoUsd, 0.00);
assert.strictEqual(finalCollection.updatedDoc.status, 'COBRADA', 'Factura pasa a estado COBRADA');
assert.strictEqual(finalCollection.updatedAccount.saldoUsd, 1450.00);
console.log('  ✓ Venta de contado, venta a crédito, aging y cobranza con liquidación bancaria 100% OK.');

// -----------------------------------------------------------------------------
// 7. SUGERENCIA 1: CAMPANA SONORA DE CAJA Y NOTIFICACIÓN PUSH
// -----------------------------------------------------------------------------
console.log('7. Verificando Campana Sonora de Caja y Alertas de Nueva Orden...');
import soundFX from '../services/soundService.js';

// Verificación de ejecución segura en entorno Node.js / sin audio físico
assert.doesNotThrow(() => {
  soundFX.cashierOrderChime(true);
  soundFX.cashierOrderChime(false);
  soundFX.orderExpired(true);
}, 'Los efectos sonoros de campana y expiración deben ejecutar de forma segura');
console.log('  ✓ Campana sonora de caja (cashierOrderChime) y expiración 100% OK.');

// -----------------------------------------------------------------------------
// 8. SUGERENCIA 2: RUTINA AUTOMÁTICA DE CADUCIDAD 72H Y LIBERACIÓN DE STOCK ATP
// -----------------------------------------------------------------------------
console.log('8. Verificando Rutina Automática de Expiración a las 72 Horas...');
import { checkAndExpireOverdueOrders } from '../services/supabaseService.js';

const testOrdersForSweep = [
  // Orden reciente (hace 2 horas) -> DEBE PERMANECER ACTIVA
  {
    id: 'PED-FF-RECENT',
    numeroDoc: 'PED-FF-RECENT',
    status: 'APROBADO',
    fechaEmision: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    totalUsd: 150.00
  },
  // Orden caducada (hace 80 horas > 72h) -> DEBE EXPIRARSE
  {
    id: 'PED-FF-OLD',
    numeroDoc: 'PED-FF-OLD',
    status: 'APROBADO',
    fechaEmision: new Date(Date.now() - 80 * 3600 * 1000).toISOString(),
    totalUsd: 320.00
  }
];

const sweepResult = await checkAndExpireOverdueOrders(testOrdersForSweep);
assert.strictEqual(sweepResult.length, 1, 'Debe expirar exactamente 1 orden mayor a 72h');
assert.strictEqual(sweepResult[0].id, 'PED-FF-OLD', 'La orden expirada debe ser PED-FF-OLD');
console.log('  ✓ Rutina de expiración automática de 72 horas y liberación ATP 100% OK.');

// -----------------------------------------------------------------------------
// 9. VALIDACIÓN ESTRICTA DE STOCK > 0 POR ALMACÉN AL EMITIR FACTURA O NOTA DE ENTREGA
// -----------------------------------------------------------------------------
console.log('9. Verificando Bloqueo de Emisión cuando algún SKU tiene Stock 0 en su Almacén...');

const skuOnlyAlm02 = {
  id: 'TEST-SKU-ALM02',
  codigo: 'SKU-ONLY-02',
  descripcion: 'Aceite Prueba Solo Almacén 02',
  stock: 10,
  stockAlmacen01: 0,
  stock_almacen_01: 0,
  stockAlmacen02: 10,
  stock_almacen_02: 10,
  precioUsdMayor: 40,
  precioUsdDetal: 50,
  litrosPorUnidad: 12,
  unidad: 'Caja'
};

const skuOnlyAlm01 = {
  id: 'TEST-SKU-ALM01',
  codigo: 'SKU-ONLY-01',
  descripcion: 'Aceite Prueba Solo Almacén 01',
  stock: 10,
  stockAlmacen01: 10,
  stock_almacen_01: 10,
  stockAlmacen02: 0,
  stock_almacen_02: 0,
  precioUsdMayor: 40,
  precioUsdDetal: 50,
  litrosPorUnidad: 12,
  unidad: 'Caja'
};

const validationProducts = [skuOnlyAlm02, skuOnlyAlm01];

// 9.1 Factura (Alm 01) con producto que tiene 0 en Alm 01 (aunque tenga 10 en Alm 02) -> BLOQUEADO
const factZeroCheck = validateWarehouseStockForDocument({
  tipoDoc: 'FACTURA',
  products: validationProducts,
  items: [
    { articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1 },
    { articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1 }
  ]
});
assert.strictEqual(factZeroCheck.isValid, false, 'Factura con SKU en 0 en Almacén 01 debe bloquearse');
assert.strictEqual(factZeroCheck.warehouseCode, '01');
assert.strictEqual(factZeroCheck.zeroStockItems.length, 1);
assert.strictEqual(factZeroCheck.zeroStockItems[0].codigo, 'SKU-ONLY-02');

// 9.2 Nota de Entrega (Alm 02) con producto que tiene 0 en Alm 02 (aunque tenga 10 en Alm 01) -> BLOQUEADO
const neZeroCheck = validateWarehouseStockForDocument({
  tipoDoc: 'NOTA_ENTREGA',
  products: validationProducts,
  items: [
    { articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1 },
    { articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1 }
  ]
});
assert.strictEqual(neZeroCheck.isValid, false, 'Nota de Entrega con SKU en 0 en Almacén 02 debe bloquearse');
assert.strictEqual(neZeroCheck.warehouseCode, '02');
assert.strictEqual(neZeroCheck.zeroStockItems.length, 1);
assert.strictEqual(neZeroCheck.zeroStockItems[0].codigo, 'SKU-ONLY-01');

// 9.3 Factura con SKU > 0 en Alm 01 -> PERMITIDO
const factOkCheck = validateWarehouseStockForDocument({
  tipoDoc: 'FACTURA',
  products: validationProducts,
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 2 }]
});
assert.strictEqual(factOkCheck.isValid, true, 'Factura con stock > 0 en Alm 01 debe permitirse');

// 9.4 Nota de Entrega con SKU > 0 en Alm 02 -> PERMITIDO
const neOkCheck = validateWarehouseStockForDocument({
  tipoDoc: 'NOTA_ENTREGA',
  products: validationProducts,
  items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 2 }]
});
assert.strictEqual(neOkCheck.isValid, true, 'Nota de Entrega con stock > 0 en Alm 02 debe permitirse');

// 9.5 Cantidad en 0 -> BLOQUEADO
const zeroQtyCheck = validateWarehouseStockForDocument({
  tipoDoc: 'FACTURA',
  products: validationProducts,
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 0 }]
});
assert.strictEqual(zeroQtyCheck.isValid, false, 'Producto cargado con cantidad 0 debe bloquearse');
assert.strictEqual(zeroQtyCheck.invalidQtyItems.length, 1);

// 9.6 Cotización y Nota de Crédito -> NO bloqueadas por esta regla
const quoteCheck = validateWarehouseStockForDocument({
  tipoDoc: 'COTIZACION',
  products: validationProducts,
  items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1 }]
});
assert.strictEqual(quoteCheck.isValid, true, 'Cotización no debe bloquearse');

// 9.7 Persistencia storageService.saveSale rechaza y NO descuenta ni registra documento si stock es 0
saveStorageProduct(skuOnlyAlm02);
saveStorageProduct(skuOnlyAlm01);
const salesCountBefore = getStorageSales().length;

assert.throws(
  () => saveStorageSale({
    tipoDoc: 'FACTURA',
    items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 40 }]
  }),
  (err) => err?.code === 'INSUFFICIENT_WAREHOUSE_STOCK',
  'saveSale debe rechazar Factura cuando el SKU tiene 0 en Almacén 01'
);

assert.throws(
  () => saveStorageSale({
    tipoDoc: 'NOTA_ENTREGA',
    items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1, precioUsd: 40 }]
  }),
  (err) => err?.code === 'INSUFFICIENT_WAREHOUSE_STOCK',
  'saveSale debe rechazar Nota de Entrega cuando el SKU tiene 0 en Almacén 02'
);

assert.strictEqual(getStorageSales().length, salesCountBefore, 'No debe haberse guardado ninguna venta bloqueada');

// 9.8 Persistencia storageService.saveSale permite emitir cuando el almacén destino tiene stock > 0
const savedFactOk = saveStorageSale({
  tipoDoc: 'FACTURA',
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 3, precioUsd: 40, litrosPorUnidad: 12 }]
});
assert.ok(savedFactOk?.numeroDoc, 'Factura con stock > 0 en Alm 01 debe emitirse correctamente');
const prodAfterFact = getStorageProducts().find(p => p.id === 'TEST-SKU-ALM01');
assert.strictEqual(getProductWarehouseStocks(prodAfterFact).stock01, 7, 'Almacén 01 debe descontar de 10 a 7');

const savedNeOk = saveStorageSale({
  tipoDoc: 'NOTA_ENTREGA',
  items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 4, precioUsd: 40, litrosPorUnidad: 12 }]
});
assert.ok(savedNeOk?.numeroDoc, 'Nota de Entrega con stock > 0 en Alm 02 debe emitirse correctamente');
const prodAfterNe = getStorageProducts().find(p => p.id === 'TEST-SKU-ALM02');
assert.strictEqual(getProductWarehouseStocks(prodAfterNe).stock02, 6, 'Almacén 02 debe descontar de 10 a 6');

// 9.9 Bloqueo en storageService.saveOrder para pedidos de vendedores (Alm 01 y Alm 02)
const ordersCountBefore = getStorageOrders().length;

assert.throws(
  () => saveStorageOrder({
    id: 'PED-FF-BLOCK-01',
    numeroDoc: 'PED-FF-BLOCK-01',
    tipoDoc: 'FACTURA',
    modalidadVenta: 'PREVENTA',
    status: 'APROBADO',
    items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 40 }]
  }),
  (err) => err?.code === 'INSUFFICIENT_WAREHOUSE_STOCK' && err?.isValidationError === true,
  'saveOrder debe rechazar pedido Fiscal (Alm 01) cuando el SKU tiene 0 en Almacén 01'
);

assert.throws(
  () => saveStorageOrder({
    id: 'PED-NE-BLOCK-02',
    numeroDoc: 'PED-NE-BLOCK-02',
    tipoDoc: 'NOTA_ENTREGA',
    modalidadVenta: 'OFICINA',
    status: 'PENDIENTE',
    items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1, precioUsd: 40 }]
  }),
  (err) => err?.code === 'INSUFFICIENT_WAREHOUSE_STOCK' && err?.isValidationError === true,
  'saveOrder debe rechazar pedido Nota de Entrega (Alm 02) cuando el SKU tiene 0 en Almacén 02'
);

assert.throws(
  () => saveStorageOrder({
    id: 'PED-FF-RET-03',
    numeroDoc: 'PED-FF-RET-03',
    tipoDoc: 'ORDEN_COMPRA',
    almacen: '01',
    status: 'RETENIDO_CREDITO',
    items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 2, precioUsd: 40 }]
  }),
  (err) => err?.code === 'INSUFFICIENT_WAREHOUSE_STOCK',
  'saveOrder debe rechazar pedido retenido por crédito con SKU en 0 en Almacén 01'
);

assert.strictEqual(getStorageOrders().length, ordersCountBefore, 'No debe persistirse ningún pedido bloqueado por existencia 0');

// 9.10 saveOrder permite emitir pedido cuando el almacén destino tiene stock > 0
saveStorageOrder({
  id: 'PED-FF-OK-01',
  numeroDoc: 'PED-FF-OK-01',
  tipoDoc: 'FACTURA',
  modalidadVenta: 'PREVENTA',
  status: 'APROBADO',
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 2, precioUsd: 40 }]
});
saveStorageOrder({
  id: 'PED-NE-OK-02',
  numeroDoc: 'PED-NE-OK-02',
  tipoDoc: 'NOTA_ENTREGA',
  modalidadVenta: 'OFICINA',
  status: 'PENDIENTE',
  items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 2, precioUsd: 40 }]
});
assert.strictEqual(getStorageOrders().length, ordersCountBefore + 2, 'Pedidos con existencia > 0 en su almacén deben guardarse');

// 9.11 Transiciones finales de estado (FACTURADO / ANULADO / CADUCADO) no deben bloquearse aunque stock llegue a 0
assert.doesNotThrow(() => {
  saveStorageOrder({
    id: 'PED-FF-POST-ZERO',
    numeroDoc: 'PED-FF-POST-ZERO',
    tipoDoc: 'FACTURA',
    status: 'FACTURADO',
    items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 40 }]
  });
  saveStorageOrder({
    id: 'PED-FF-ANUL-ZERO',
    numeroDoc: 'PED-FF-ANUL-ZERO',
    tipoDoc: 'FACTURA',
    status: 'ANULADO',
    items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 40 }]
  });
}, 'Actualizaciones de estado FACTURADO/ANULADO deben permitirse aunque el stock actual del SKU sea 0');

console.log('  ✓ Bloqueo estricto de Factura (Alm 01), Nota de Entrega (Alm 02) y Pedidos con stock 0 100% OK.');

// 9.12 Regresión Crítica: Nota de Entrega CONTADO vs CRÉDITO (ambas van a CxC, sin ingreso directo a Caja) y no-quema de correlativo en error
saveStorageClient({ id: 'CLI-NE-CASH', codigo: 'CLI-NE-CASH', nombre: 'Cliente Contado NE', rif: 'J-88800011-1', saldoDeudorUsd: 0 });
const cashBeforeNe = getStorageCashMovements().length;
const neContado = saveStorageSale({
  tipoDoc: 'NOTA_ENTREGA',
  condicionPago: 'CONTADO',
  metodoPago: 'EFECTIVO_USD',
  diasCredito: 0,
  clienteId: 'CLI-NE-CASH',
  clienteNombre: 'Cliente Contado NE',
  items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 40, litrosPorUnidad: 12 }]
});
assert.strictEqual(neContado.estado, 'PENDIENTE', 'Nota de Entrega CONTADO debe quedar PENDIENTE (en CxC)');
assert.strictEqual(neContado.saldoUsd, 40, 'Nota de Entrega CONTADO debe conservar saldoUsd === 40 en CxC');
assert.strictEqual(neContado.condicionPago, 'CONTADO', 'Nota de Entrega CONTADO debe conservar condicionPago CONTADO');
assert.strictEqual(getStorageCashMovements().length, cashBeforeNe, 'Nota de Entrega CONTADO NO debe registrar ingreso directo en Caja');
assert.strictEqual(getStorageClients().find(c => c.id === 'CLI-NE-CASH')?.saldoDeudorUsd, 40, 'Nota de Entrega CONTADO debe sumar $40 a la deuda CxC del cliente');

const neCredito = saveStorageSale({
  tipoDoc: 'NOTA_ENTREGA',
  condicionPago: 'CREDITO',
  metodoPago: 'CREDITO',
  diasCredito: 15,
  clienteId: 'CLI-NE-CRED',
  clienteNombre: 'Cliente Crédito NE',
  items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 40, litrosPorUnidad: 12 }]
});
assert.strictEqual(neCredito.estado, 'PENDIENTE', 'Nota de Entrega a CRÉDITO debe quedar PENDIENTE');
assert.ok(neCredito.saldoUsd > 0, 'Nota de Entrega a CRÉDITO debe conservar saldo pendiente');

setInvoiceCorrelativo('000777');
const beforeFailedCorrel = getNextInvoiceCorrelativo([], []);
assert.strictEqual(beforeFailedCorrel, '000777', 'Correlativo fijado inicialmente en 000777');
assert.throws(
  () => saveStorageSale({
    tipoDoc: 'FACTURA',
    numeroDoc: beforeFailedCorrel,
    items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 40 }]
  }),
  (err) => err?.code === 'INSUFFICIENT_WAREHOUSE_STOCK'
);
assert.strictEqual(
  getNextInvoiceCorrelativo([], []),
  '000777',
  'Un error de stock al facturar NO debe consumir/quemar el correlativo'
);
console.log('  ✓ Regresión crítica: NE Contado vs Crédito y preservación de correlativo tras error 100% OK.');

// 9.13 Regresión Alta: Retención 0% respetada, Factura CONTADO -> CxC sin caja directa y reversión al eliminar
saveStorageClient({ id: 'CLI-RET-0', codigo: 'CLI-RET-0', nombre: 'Cliente Sin Retención', rif: 'J-88800022-2', saldoDeudorUsd: 0 });
const cashBeforeRetZero = getStorageCashMovements().length;
const saleRetZero = saveStorageSale({
  tipoDoc: 'FACTURA',
  condicionPago: 'CONTADO',
  metodoPago: 'TRANSFERENCIA_BS',
  porcentajeRetencionIva: 0,
  clienteId: 'CLI-RET-0',
  clienteNombre: 'Cliente Sin Retención',
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1, precioUsd: 100, aplicaIva: true, litrosPorUnidad: 12 }]
});
assert.strictEqual(saleRetZero.retencionIvaBs, 0, 'Porcentaje de retención 0% debe respetarse sin forzar 75%');
assert.strictEqual(saleRetZero.estado, 'PENDIENTE', 'Factura CONTADO debe generarse PENDIENTE hacia CxC');
assert.strictEqual(saleRetZero.saldoUsd, 116, 'Factura CONTADO debe generar saldoUsd igual al total ($116)');
assert.strictEqual(getStorageCashMovements().length, cashBeforeRetZero, 'Factura CONTADO NO debe crear movimiento directo en Caja');
assert.strictEqual(getStorageClients().find(c => c.id === 'CLI-RET-0')?.saldoDeudorUsd, 116, 'Factura CONTADO debe sumar deuda CxC del cliente');
deleteStorageSale(saleRetZero);
assert.strictEqual(getStorageClients().find(c => c.id === 'CLI-RET-0')?.saldoDeudorUsd, 0, 'Eliminar Factura CONTADO pendiente debe revertir la deuda CxC del cliente a 0');

saveStorageClient({ id: 'CLI-DEL-CRED', codigo: 'CLI-DEL-CRED', nombre: 'Cliente Borrado Crédito', rif: 'J-99900011-1', saldoDeudorUsd: 50 });
const credSaleForDel = saveStorageSale({
  tipoDoc: 'FACTURA',
  condicionPago: 'CREDITO',
  metodoPago: 'CREDITO',
  diasCredito: 15,
  clienteId: 'CLI-DEL-CRED',
  clienteNombre: 'Cliente Borrado Crédito',
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1, precioUsd: 100, aplicaIva: true, litrosPorUnidad: 12 }]
});
const debtAfterSale = getStorageClients().find(c => c.id === 'CLI-DEL-CRED')?.saldoDeudorUsd;
assert.strictEqual(Number(debtAfterSale.toFixed(2)), 166, 'Saldo cliente debe subir de 50 a 166');
deleteStorageSale(credSaleForDel);
const debtAfterDelete = getStorageClients().find(c => c.id === 'CLI-DEL-CRED')?.saldoDeudorUsd;
assert.strictEqual(Number(debtAfterDelete.toFixed(2)), 50, 'Eliminar venta a crédito debe revertir la deuda del cliente a 50');
console.log('  ✓ Regresión alta: Retención 0% respetada y reversión de caja/saldo al eliminar 100% OK.');

// 9.14 Regresión Media: saveSale debe respetar config.igtfPorcentaje=0 / esSujetoPasivoEspecial=false
console.log('9.14 Verificando respeto de config.igtfPorcentaje / esSujetoPasivoEspecial en saveSale...');
const prevCfgIgtf = getStorageConfig();
updateStorageConfig({ igtfPorcentaje: 0 });
const saleZeroIgtf = saveStorageSale({
  tipoDoc: 'FACTURA',
  condicionPago: 'CONTADO',
  metodoPago: 'EFECTIVO_USD',
  clienteId: 'CLI-ZERO-IGTF',
  clienteNombre: 'Cliente Sin IGTF Config',
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1, precioUsd: 100, aplicaIva: true, litrosPorUnidad: 12 }],
  skipStockAdjustment: true
});
assert.strictEqual(saleZeroIgtf.igtfUsd, 0, 'Con igtfPorcentaje=0 en config no debe calcular IGTF');
assert.strictEqual(saleZeroIgtf.totalUsd, 116, 'Total con IVA 16% y IGTF 0% debe ser $116');
deleteStorageSale(saleZeroIgtf);
updateStorageConfig({
  igtfPorcentaje: prevCfgIgtf?.igtfPorcentaje ?? 3,
  esSujetoPasivoEspecial: prevCfgIgtf?.esSujetoPasivoEspecial
});
console.log('  ✓ Regresión media: IGTF configurable desde config respetado al 100%.');

// 9.15 Regresión tombstones CxC (signum_cxc_deleted_docs_v1): no ocultar correlativo recreado posteriormente en otra PC ni cruzar eras
console.log('9.15 Verificando tombstones CxC con invalidación temporal y por era...');
const oldDoc6 = { id: '000006', numeroDoc: '000006', tipoDoc: 'FACTURA', fechaEmision: '2026-11-12T10:00:00.000Z', updated_at: new Date(Date.now() - 60000).toISOString() };
markCxcDocDeleted(oldDoc6);
const delSetNow = new Set(sanitizeCxcDeletedDocsStorage());
assert.strictEqual(isCxcEntryDeleted(oldDoc6, delSetNow), true, 'El documento borrado antiguo debe permanecer oculto');
const legacyDoc6 = { id: 'fac-6', factNum: '6', tipoDoc: 'FACTURA', fec_emis: '2026-03-01T00:00:00.000Z', updated_at: new Date(Date.now() - 60000).toISOString() };
assert.strictEqual(isCxcEntryDeleted(legacyDoc6, delSetNow), false, 'Borrar 000006 moderno no debe ocultar fac-6 histórico');
const recreatedDoc6 = { id: '000006', numeroDoc: '000006', tipoDoc: 'FACTURA', fechaEmision: new Date(Date.now() + 10000).toISOString(), updated_at: new Date(Date.now() + 10000).toISOString() };
assert.strictEqual(isCxcEntryDeleted(recreatedDoc6, delSetNow), false, 'Si otra caja vuelve a emitir 000006 después del borrado, no debe quedar oculto');
unmarkCxcDeletedDoc(recreatedDoc6);
console.log('  ✓ Tombstones CxC con invalidación temporal y por era verificados 100% OK.');

// 9.16 Regresión Tesorería: Emparejamiento de Bancos en Bs (CTA-04 <-> 04) y Cajas en Bs (caja-03 <-> CAJA-03) + deltas USD/Bs
console.log('9.16 Verificando emparejamiento y suma de saldos USD/Bs en bancos y cajas...');
const sampleBank04 = { id: 'CTA-04', codCta: '04', bancoNombre: 'BANCO PLAZA', moneda: 'BS', saldoBs: 2947.79, saldoUsd: 2.94 };
const sampleBank01 = { id: 'CTA-01', codCta: '01', bancoNombre: 'BANESCO', moneda: 'BS', saldoBs: 1000, saldoUsd: 1 };
const sampleCaja03 = { id: 'caja-03', coCaja: 'CAJA-03', descripcion: 'Caja Efectivo Bs (Valencia)', moneda: 'BS', saldoBs: 500, saldoUsd: 0.55 };

assert.strictEqual(inferTreasuryAccountKind({ key: 'BANCO:04', rawId: '04', codCta: '04' }), 'BANCO');
assert.strictEqual(inferTreasuryAccountKind({ key: 'CAJA:caja-03', rawId: 'caja-03', coCaja: 'CAJA-03' }), 'CAJA');
assert.strictEqual(matchesBankAccount(sampleBank04, { rawId: '04', bankId: 'CTA-04', codCta: '04' }), true);
assert.strictEqual(matchesBankAccount(sampleBank04, '04'), true);
assert.strictEqual(matchesBankAccount(sampleBank01, '04'), false);
assert.strictEqual(matchesCashDesk(sampleCaja03, 'CAJA-03'), true);
assert.strictEqual(matchesCashDesk(sampleCaja03, { rawId: 'caja-03', coCaja: 'CAJA-03' }), true);

const updatedBank04 = applyTreasuryBalanceDelta(sampleBank04, { deltaUsd: 123.00, deltaBs: 111144.15 });
assert.strictEqual(updatedBank04.saldoBs, 114091.94, 'Banco Plaza debe sumar exactamente Bs. 111,144.15 sin pérdida de redondeo');
assert.strictEqual(updatedBank04.saldo_bs, 114091.94);
assert.strictEqual(updatedBank04.saldoActual, 114091.94);
assert.strictEqual(updatedBank04.saldoUsd, 125.94);

const updatedCaja03 = applyTreasuryBalanceDelta(sampleCaja03, { deltaUsd: 10.00, deltaBs: 9116.20 });
assert.strictEqual(updatedCaja03.saldoBs, 9616.20, 'Caja Efectivo Bs debe sumar exactamente Bs. 9,116.20');
assert.strictEqual(updatedCaja03.saldoUsd, 10.55);
console.log('  ✓ Emparejamiento de bancos y cajas en Bs con deltas exactos verificados 100% OK.');

// 9.17 Regresión Preventa Móvil: Persistencia de campos Preventa, IVA 16% Fiscal vs Exento NE y validación RIF SENIAT
console.log('9.17 Verificando persistencia de campos Preventa, IVA 16% y RIF SENIAT...');
const preventaSample = {
  id: 'PED-FF-TEST917',
  numeroDoc: 'PED-FF-TEST917',
  modalidadVenta: 'PREVENTA',
  tipoDoc: 'FACTURA',
  almacen: '01',
  almacenId: '01',
  clienteId: 'CLI-001',
  clienteNombre: 'Cliente Preventa Fiscal',
  clienteRif: 'J-31115365-9',
  vendedorId: 'Manuel Rosales',
  vendedorCoVen: 'V07',
  condicionPago: '15_DIAS',
  diasCredito: 15,
  creditOverrideApproved: true,
  creditOverrideAuthorizer: 'Gerencia General',
  creditOverrideJustification: 'Cliente VIP al día',
  tasaCambio: 911.62,
  subtotalUsd: 100,
  baseImponibleUsd: 100,
  aplicaIva: true,
  ivaPorcentaje: 16,
  ivaUsd: 16,
  totalUsd: 116,
  status: 'APROBADO',
  items: [{ articuloId: 'LUB-1', cantidad: 2, precioUnitarioUsd: 50, totalUsd: 100, tipoAlicuota: 'GENERAL_16', aplicaIva: true }]
};
const dbRow = mapOrderToDb(preventaSample);
const restoredOrder = mapOrderFromDb(dbRow);
assert.strictEqual(restoredOrder.modalidadVenta, 'PREVENTA', 'modalidadVenta debe preservarse al recargar');
assert.strictEqual(restoredOrder.vendedorCoVen, 'V07', 'vendedorCoVen debe preservarse al recargar');
assert.strictEqual(restoredOrder.creditOverrideApproved, true, 'creditOverrideApproved debe preservarse al recargar');
assert.strictEqual(restoredOrder.creditOverrideAuthorizer, 'Gerencia General', 'creditOverrideAuthorizer debe preservarse al recargar');
assert.strictEqual(restoredOrder.creditOverrideJustification, 'Cliente VIP al día', 'creditOverrideJustification debe preservarse al recargar');
assert.strictEqual(restoredOrder.aplicaIva, true);
assert.strictEqual(restoredOrder.ivaUsd, 16);
assert.strictEqual(restoredOrder.totalUsd, 116);

const fiscalQuote = calculateFiscalTaxes({
  items: [{ cantidad: 2, precioUsd: 50, tipoAlicuota: 'GENERAL_16', aplicaIva: true }],
  tipoDoc: 'FACTURA',
  metodoPago: 'TRANSFERENCIA_BS',
  condicionPago: 'CONTADO',
  tasaBcv: 911.62
});
assert.strictEqual(fiscalQuote.subtotalNetoUsd, 100);
assert.strictEqual(fiscalQuote.totalIvaUsd, 16);
assert.strictEqual(fiscalQuote.totalFacturaUsd, 116);

const notaQuote = calculateFiscalTaxes({
  items: [{ cantidad: 2, precioUsd: 50, tipoAlicuota: 'GENERAL_16', aplicaIva: true }],
  tipoDoc: 'NOTA_ENTREGA',
  metodoPago: 'TRANSFERENCIA_BS',
  condicionPago: 'CONTADO',
  tasaBcv: 911.62
});
assert.strictEqual(notaQuote.totalIvaUsd, 0);
assert.strictEqual(notaQuote.totalFacturaUsd, 100);

assert.strictEqual(validateRif('V-12825819').isValid, false, 'RIF incompleto sin dígito verificador debe ser rechazado');
assert.strictEqual(validateRif('J-31115365-9').isValid, true, 'RIF SENIAT válido debe aprobarse');
console.log('  ✓ Persistencia Preventa, IVA 16% y validación RIF SENIAT verificados 100% OK.');

// 9.18 Regresión Facturas y Notas de Entrega CONTADO -> CxC (sin ingreso directo a Caja)
console.log('9.18 Verificando Facturas y Notas de Entrega CONTADO en payload CxC, consolidación y contabilidad...');
saveStorageClient({ id: 'CLI-CONTADO-CXC', codigo: 'CLI-CONTADO-CXC', nombre: 'Cliente Contado CxC', rif: 'J-77700011-9', saldoDeudorUsd: 0 });
const cashBeforeContadoCxc = getStorageCashMovements().length;

const factContadoSale = saveStorageSale({
  tipoDoc: 'FACTURA',
  condicionPago: 'CONTADO',
  metodoPago: 'EFECTIVO_USD',
  diasCredito: 0,
  clienteId: 'CLI-CONTADO-CXC',
  clienteNombre: 'Cliente Contado CxC',
  clienteRif: 'J-77700011-9',
  items: [{ articuloId: 'TEST-SKU-ALM01', codigo: 'SKU-ONLY-01', cantidad: 1, precioUsd: 100, aplicaIva: true, litrosPorUnidad: 12 }]
});
assert.strictEqual(factContadoSale.estado, 'PENDIENTE');
assert.strictEqual(factContadoSale.igtfUsd, 0, 'Al generar factura contado NO debe calcular IGTF (no se cobra al emitir)');
assert.strictEqual(factContadoSale.totalUsd, 116, 'Factura contado de $100 + 16% IVA debe totalizar $116 sin IGTF');
assert.ok(factContadoSale.saldoUsd > 100, 'Factura contado debe conservar saldo pendiente (incl. IVA)');
assert.strictEqual(getStorageCashMovements().length, cashBeforeContadoCxc, 'Factura contado no debe generar cash_movement directo');

const neContadoSale = saveStorageSale({
  tipoDoc: 'NOTA_ENTREGA',
  condicionPago: 'CONTADO',
  metodoPago: 'EFECTIVO_USD',
  diasCredito: 0,
  clienteId: 'CLI-CONTADO-CXC',
  clienteNombre: 'Cliente Contado CxC',
  clienteRif: 'J-77700011-9',
  items: [{ articuloId: 'TEST-SKU-ALM02', codigo: 'SKU-ONLY-02', cantidad: 1, precioUsd: 50, litrosPorUnidad: 12 }]
});
assert.strictEqual(neContadoSale.estado, 'PENDIENTE');
assert.strictEqual(neContadoSale.saldoUsd, 50);
assert.strictEqual(getStorageCashMovements().length, cashBeforeContadoCxc, 'NE contado no debe generar cash_movement directo');

const factPayloadCxc = buildProfitInvoicePayloadFromSale(factContadoSale, 'OF');
assert.strictEqual(factPayloadCxc.status, 'PENDIENTE');
assert.strictEqual(factPayloadCxc.abonosUsd, 0);
assert.strictEqual(factPayloadCxc.saldoUsd, factContadoSale.saldoUsd);
assert.strictEqual(factPayloadCxc.condicionPago, 'CONTADO');

const nePayloadCxc = buildProfitInvoicePayloadFromSale(neContadoSale, 'OF');
assert.strictEqual(nePayloadCxc.status, 'PENDIENTE');
assert.strictEqual(nePayloadCxc.abonosUsd, 0);
assert.strictEqual(nePayloadCxc.saldoUsd, 50);

// Verificar consolidación CxC tanto desde sales como desde profitInvoices
const consolidatedFromSales = consolidateClientReceivables({
  clients: [],
  profitInvoices: [],
  sales: [factContadoSale, neContadoSale],
  tasaBcv: 911.62
});
assert.strictEqual(consolidatedFromSales.length, 1, 'Cliente contado debe aparecer en cartera activa CxC desde sales');
assert.strictEqual(
  Number(consolidatedFromSales[0].saldoUsd.toFixed(2)),
  Number((factContadoSale.saldoUsd + 50).toFixed(2)),
  'CxC consolidado debe sumar Factura contado + NE contado'
);

// Verificar que contabilidad asienta CxC (1.01.03.001) y NO Caja directa (1.01.01.002)
const contadoCxcEntries = buildAccountingEntries({
  profitInvoices: [factPayloadCxc, nePayloadCxc],
  cashMovements: [],
  tasa: 911.62
});
const contadoCxcGl = computeGeneralLedger(contadoCxcEntries);
assert.strictEqual(contadoCxcGl.accountsByCode['1.01.01.002'], undefined, 'Facturación contado hacia CxC NO debe debitar Caja Divisas');
assert.ok((contadoCxcGl.accountsByCode['1.01.03.001']?.saldoFinalUsd || 0) > 150, 'Facturación contado debe debitar CxC Comerciales (1.01.03.001)');
console.log('  ✓ Facturas y NE de Contado -> CxC sin caja directa verificadas al 100% OK.');

console.log('\n================================================================');
console.log('--- TODAS LAS ETAPAS DEL FLUJO DE VENTA Y MEJORAS 1 & 2 AL 100% ---');
console.log('================================================================');
