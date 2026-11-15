// ==============================================================================
// 🧪 TEST: BLINDAJE CONTRA DOBLE FACTURACIÓN (IDEMPOTENCIA Y CANDADOS ANTI-DUPLICADOS)
// Verifica que ninguna preventa, orden o factura pueda ser procesada o emitida dos veces.
// ==============================================================================

import assert from 'node:assert';
import { saveSale, getSales, saveOrder, getOrders, saveProduct } from '../services/storageService.js';
import { mapPurchaseToDb } from '../services/supabaseService.js';

console.log('--- INICIANDO VERIFICACIÓN DE BLINDAJE CONTRA DOBLE FACTURACIÓN ---');

// 1. Crear producto con stock disponible para la prueba
const skuTest = {
  id: 'SKU-TEST-DOUBLE-BILL',
  codigo: 'LUB-DOUBLE-BILL-01',
  descripcion: 'Aceite Test Anti Doble Facturacion',
  stock: 100,
  stockAlmacen01: 50,
  stock_almacen_01: 50,
  stockAlmacen02: 50,
  stock_almacen_02: 50,
  precioUsdMayor: 20,
  precioUsdDetal: 25
};
saveProduct(skuTest);

// 2. Registrar una orden inicial en estado APROBADO (En Caja por Facturar)
const orderId = 'ORD-PREVENTA-999';
const orderDoc = 'PED-VEN-999';
const testOrder = {
  id: orderId,
  numeroDoc: orderDoc,
  tipoDoc: 'FACTURA',
  almacen: '01',
  status: 'APROBADO',
  fechaEmision: new Date().toISOString(),
  items: [
    {
      articuloId: skuTest.id,
      codigo: skuTest.codigo,
      articuloDescripcion: skuTest.descripcion,
      cantidad: 2,
      precioUnitarioUsd: 25
    }
  ]
};
saveOrder(testOrder);
console.log('✓ 1. Pedido inicial registrado en estado APROBADO.');

// 3. Facturar por primera vez la orden
const firstSale = {
  id: 'FACT-TEST-001',
  numeroDoc: '00009991',
  tipoDoc: 'FACTURA',
  almacen: '01',
  pedidoOrigenId: orderId,
  pedidoOrigenDoc: orderDoc,
  items: testOrder.items,
  condicionPago: 'CONTADO',
  metodoPago: 'EFECTIVO_USD'
};
const processedFirstSale = saveSale(firstSale);
assert.ok(processedFirstSale, 'La primera facturación debe procesarse exitosamente');
console.log('✓ 2. Primera facturación procesada con éxito (#00009991).');

// 4. Intentar facturar la MISMA orden por segunda vez usando pedidoOrigenId
let secondAttemptCaught = false;
try {
  const secondSaleAttempt = {
    id: 'FACT-TEST-002',
    numeroDoc: '00009992',
    tipoDoc: 'FACTURA',
    almacen: '01',
    pedidoOrigenId: orderId,
    pedidoOrigenDoc: orderDoc,
    items: testOrder.items,
    condicionPago: 'CONTADO',
    metodoPago: 'EFECTIVO_USD'
  };
  saveSale(secondSaleAttempt);
} catch (err) {
  secondAttemptCaught = true;
  assert.strictEqual(err.code, 'ORDER_ALREADY_INVOICED', 'El error debe ser ORDER_ALREADY_INVOICED');
  console.log(`✓ 3. Bloqueo exitoso al reintentar facturar: "${err.message}"`);
}
assert.strictEqual(secondAttemptCaught, true, 'Debe abortar y lanzar ORDER_ALREADY_INVOICED al intentar segunda facturación');

// 5. Intentar facturar cruzando por pedidoOrigenDoc
let docMatchCaught = false;
try {
  const docSaleAttempt = {
    id: 'FACT-TEST-003',
    numeroDoc: '00009993',
    tipoDoc: 'FACTURA',
    almacen: '01',
    pedidoOrigenDoc: orderDoc, // solo número de documento sin id
    items: testOrder.items,
    condicionPago: 'CONTADO',
    metodoPago: 'EFECTIVO_USD'
  };
  saveSale(docSaleAttempt);
} catch (err) {
  docMatchCaught = true;
  assert.strictEqual(err.code, 'ORDER_ALREADY_INVOICED', 'El error debe ser ORDER_ALREADY_INVOICED al cruzar por pedidoOrigenDoc');
  console.log(`✓ 4. Bloqueo exitoso al cruzar por número de documento: "${err.message}"`);
}
assert.strictEqual(docMatchCaught, true, 'Debe abortar al detectar pedidoOrigenDoc ya facturado');

// 6. Verificar que si la orden pasa a status FACTURADO en la tabla orders, también se bloquea
const orderId2 = 'ORD-PREVENTA-888';
const orderDoc2 = 'PED-VEN-888';
saveOrder({
  id: orderId2,
  numeroDoc: orderDoc2,
  tipoDoc: 'FACTURA',
  status: 'FACTURADO',
  nroFactura: '00008888',
  items: testOrder.items
});

let statusBilledCaught = false;
try {
  saveSale({
    id: 'FACT-TEST-004',
    numeroDoc: '00008889',
    tipoDoc: 'FACTURA',
    pedidoOrigenId: orderId2,
    pedidoOrigenDoc: orderDoc2,
    items: testOrder.items
  });
} catch (err) {
  statusBilledCaught = true;
  assert.strictEqual(err.code, 'ORDER_ALREADY_INVOICED');
  console.log(`✓ 5. Bloqueo exitoso al detectar status FACTURADO en orders: "${err.message}"`);
}
assert.strictEqual(statusBilledCaught, true, 'Debe abortar si el pedido ya está en status FACTURADO');

console.log('======================================================================');
console.log('✅ TODAS LAS PRUEBAS DE BLINDAJE ANTI-DOBLE FACTURACIÓN PASARON AL 100%');
console.log('======================================================================');
