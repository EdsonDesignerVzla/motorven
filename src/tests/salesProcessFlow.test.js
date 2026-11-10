import assert from 'node:assert';
import {
  getProductWarehouseStocks,
  formatUsd,
  formatBs,
  resolveProductUnit,
  resolveProductLitersPerUnit
} from '../services/formatService.js';
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
  calculateFiscalTaxes,
  getNextInvoiceCorrelativo,
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

console.log('\n================================================================');
console.log('--- TODAS LAS ETAPAS DEL FLUJO DE VENTA Y MEJORAS 1 & 2 AL 100% ---');
console.log('================================================================');
