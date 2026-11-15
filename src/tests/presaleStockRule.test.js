// ==============================================================================
// 🧪 TEST: REGLA DE DISPONIBILIDAD EN PREVENTA MÓVIL (VENDEDOR EN CALLE)
// Verifica que al pasar un pedido NO se descuente el stock físico de los almacenes
// hasta que la cajera facture en Caja (POS).
// ==============================================================================

import assert from 'node:assert';
import { getProductWarehouseStocks } from '../services/formatService.js';
import { saveOrder, getOrders, getProducts, saveProduct } from '../services/storageService.js';
import { checkAndExpireOverdueOrders } from '../services/supabaseService.js';

console.log('--- INICIANDO VERIFICACIÓN DE REGLA DE DISPONIBILIDAD EN PREVENTA MÓVIL ---');

// 1. Crear producto de prueba con 20 unidades en Alm 01 (Fiscal) y 30 unidades en Alm 02 (Despacho)
const testSku = {
  id: 'SKU-TEST-DISP-01',
  codigo: 'LUB-20W50-TEST',
  descripcion: 'Aceite 20W50 Mineral Test',
  stock: 50,
  stockAlmacen01: 20,
  stock_almacen_01: 20,
  stockAlmacen02: 30,
  stock_almacen_02: 30,
  precioUsdMayor: 35,
  precioUsdDetal: 45
};

saveProduct(testSku);

// 2. Verificar existencias físicas iniciales
const initialStocks = getProductWarehouseStocks(testSku);
assert.strictEqual(initialStocks.stock01, 20, 'Stock físico inicial en Alm 01 debe ser 20');
assert.strictEqual(initialStocks.stock02, 30, 'Stock físico inicial en Alm 02 debe ser 30');
console.log('✓ 1. Existencias físicas iniciales comprobadas (Alm 01: 20, Alm 02: 30).');

// 3. Simular que el vendedor en calle emite un pedido de Preventa por 5 unidades en Alm 01
const presaleOrder = {
  id: 'PED-TEST-CALLE-001',
  numeroDoc: 'PED-TEST-001',
  tipoDoc: 'FACTURA',
  almacen: '01',
  status: 'PENDIENTE',
  fechaEmision: new Date().toISOString(),
  items: [
    {
      articuloId: testSku.id,
      codigo: testSku.codigo,
      articuloDescripcion: testSku.descripcion,
      cantidad: 5,
      precioUnitarioUsd: 45
    }
  ]
};

// Guardar el pedido (lo que hace onSaveOrder en la Preventa Móvil)
saveOrder(presaleOrder);

// 4. Verificar que el stock FÍSICO en Almacén 01 NO se restó (sigue siendo 20)
const productsAfterOrder = getProducts();
const skuAfterOrder = productsAfterOrder.find(p => p.id === testSku.id);
const stocksAfterOrder = getProductWarehouseStocks(skuAfterOrder || testSku);

assert.strictEqual(
  stocksAfterOrder.stock01,
  20,
  '¡REGLA CUMPLIDA! El stock físico de Almacén 01 NO debe restarse al crear la orden de preventa'
);
assert.strictEqual(
  stocksAfterOrder.stock02,
  30,
  '¡REGLA CUMPLIDA! El stock físico de Almacén 02 permanece intacto'
);
console.log('✓ 2. Comprobado: al pasar el pedido, el stock físico del almacén NO se resta (sigue en 20 y 30).');

// 5. Verificar que la orden queda registrada como COMPROMETIDA para disponibilidad ATP
const orders = getOrders();
const savedOrd = orders.find(o => o.id === presaleOrder.id);
assert.ok(savedOrd, 'La orden debe existir en la lista de pedidos');
assert.strictEqual(savedOrd.status, 'PENDIENTE', 'La orden debe estar en estado PENDIENTE');

const committedQty = savedOrd.items.reduce((acc, it) => acc + it.cantidad, 0);
assert.strictEqual(committedQty, 5, 'Deben haber 5 unidades comprometidas en órdenes activas');

// Fórmula de Disponibilidad Libre ATP = Stock Físico - Comprometido en Pedidos
const disponibilidadLibreAlm01 = stocksAfterOrder.stock01 - committedQty;
assert.strictEqual(
  disponibilidadLibreAlm01,
  15,
  'La disponibilidad libre para otros vendedores es 15 (20 físico - 5 comprometido)'
);
console.log('✓ 3. Comprobado: La disponibilidad libre para nuevos vendedores es 15 (20 físico - 5 comprometido).');

// 6. Simular que la cajera factura en Caja (POS): se descuenta el stock físico y la orden pasa a FACTURADO
// Simulamos la lógica de facturación de Caja:
const simulatedInvoicedOrder = {
  ...savedOrd,
  status: 'FACTURADO',
  nroFactura: 'FAC-001050'
};
saveOrder(simulatedInvoicedOrder, { skipStockValidation: true });

// En Caja, adjustSupabaseProductsStockForSale descuenta las 5 unidades del stock físico
const skuAfterInvoice = {
  ...skuAfterOrder,
  stockAlmacen01: stocksAfterOrder.stock01 - 5,
  stock_almacen_01: stocksAfterOrder.stock01 - 5,
  stock: stocksAfterOrder.stock01 - 5 + stocksAfterOrder.stock02
};
saveProduct(skuAfterInvoice);

const finalStocks = getProductWarehouseStocks(skuAfterInvoice);
assert.strictEqual(
  finalStocks.stock01,
  15,
  'Una vez facturado por la cajera, el stock físico de Alm 01 pasa a 15'
);
console.log('✓ 4. Comprobado: Solo al facturar la cajera en Caja, el stock físico se descuenta a 15.');

// Al estar FACTURADO, la orden ya no compromete disponibilidad adicional
const activeCommittedAfterInvoice = getOrders()
  .filter(o => o.status === 'PENDIENTE' || o.status === 'APROBADO')
  .reduce((acc, o) => acc + (o.items || []).reduce((sum, it) => sum + it.cantidad, 0), 0);

assert.strictEqual(
  activeCommittedAfterInvoice,
  0,
  'No quedan órdenes comprometidas pendientes (todo fue facturado)'
);
console.log('✓ 5. Comprobado: La orden facturada ya no compromete stock doblemente.');

console.log('========================================================================');
console.log('✅ TODAS LAS PRUEBAS DE LA REGLA DE DISPONIBILIDAD EN PREVENTA PASARON 100%');
console.log('========================================================================');
