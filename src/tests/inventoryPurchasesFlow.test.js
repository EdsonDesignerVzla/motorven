import assert from 'assert';
import { getProductWarehouseStocks } from '../services/formatService.js';
import { savePurchase, getProducts, saveProduct } from '../services/storageService.js';
import {
  mapPurchaseToDb,
  mapPurchaseFromDb,
  applyStockDeltaForWarehouseLines,
  saveSupabaseProfitWarehouseTransfer,
  saveSupabaseProfitInventoryAdjustment,
  saveSupabasePurchase,
  saveSupabaseGoodsReceiptNote
} from '../services/supabaseService.js';
import { buildConsolidatedKardex, isDocumentAnnulled } from '../utils/kardexUtils.js';

console.log('--- INICIANDO PRUEBAS DE INVENTARIO, ALMACENES 01/02, COMPRAS Y KARDEX ---');

// 1. Validar que getProductWarehouseStocks NO invente 40%/60% cuando faltan columnas
console.log('1. Verificando ausencia de split sintético 40%/60%...');
const prodWithoutSplit = { id: 'TEST-NOSPLIT', codigo: 'TEST-NOSPLIT', descripcion: 'Sin Almacén', stock: 100 };
const noSplitResult = getProductWarehouseStocks(prodWithoutSplit);
assert.strictEqual(noSplitResult.stock01, 0, 'stock01 debe ser 0 cuando no existen columnas de almacén');
assert.strictEqual(noSplitResult.stock02, 0, 'stock02 debe ser 0 cuando no existen columnas de almacén');
assert.strictEqual(noSplitResult.total, 100, 'total debe conservar el consolidado bruto');
assert.strictEqual(noSplitResult.missingWarehouseSplit, true, 'Debe marcar missingWarehouseSplit: true');

const prodWithSplit = {
  id: 'TEST-SKU-01',
  codigo: 'TEST-SKU-01',
  descripcion: 'Oilstone Prueba Inventario',
  stock: 25,
  stockAlmacen01: 10,
  stock_almacen_01: 10,
  stockAlmacen02: 15,
  stock_almacen_02: 15,
  costoUsd: 20
};
saveProduct(prodWithSplit);

// 2. Validar errores en traslados (mismo almacén, exceso de stock) sin fabricar existencia
console.log('2. Verificando validación estricta en traslados Alm 01 <-> Alm 02...');
await assert.rejects(
  async () => {
    await saveSupabaseProfitWarehouseTransfer({
      almOrig: '01',
      almDest: '01',
      renglones: [{ co_art: 'TEST-SKU-01', total_art: 2 }]
    });
  },
  /distintos/i,
  'Debe rechazar traslado cuando almOrig === almDest'
);

await assert.rejects(
  async () => {
    await saveSupabaseProfitWarehouseTransfer({
      almOrig: '01',
      almDest: '02',
      renglones: [{ co_art: 'TEST-SKU-01', total_art: 999 }]
    });
  },
  /Stock insuficiente/i,
  'Debe rechazar traslado si cantidad solicitada excede stock real de Almacén 01 sin clamar ni fabricar stock'
);

// Verificar que el stock NO fue alterado tras el rechazo
let storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
assert.strictEqual(getProductWarehouseStocks(storedProd).stock01, 10, 'Alm 01 intacto tras rechazo');
assert.strictEqual(getProductWarehouseStocks(storedProd).stock02, 15, 'Alm 02 intacto tras rechazo');

// Traslado válido de 4 unidades: Alm 01 (10 -> 6) hacia Alm 02 (15 -> 19)
const validTransfer = await saveSupabaseProfitWarehouseTransfer({
  almOrig: '01',
  almDest: '02',
  motivo: 'Traslado de prueba unitario',
  renglones: [{ co_art: 'TEST-SKU-01', art_des: 'Oilstone Prueba Inventario', total_art: 4 }]
});
assert.ok(validTransfer?.trasNum, 'Debe retornar el traslado procesado');
storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
assert.strictEqual(storedProd.stockAlmacen01, 6, 'camelCase stockAlmacen01 debe ser 6');
assert.strictEqual(storedProd.stock_almacen_01, 6, 'snake_case stock_almacen_01 debe ser 6');
assert.strictEqual(storedProd.stockAlmacen02, 19, 'camelCase stockAlmacen02 debe ser 19');
assert.strictEqual(storedProd.stock_almacen_02, 19, 'snake_case stock_almacen_02 debe ser 19');
assert.strictEqual(storedProd.stock, 25, 'Stock total consolidado debe mantenerse en 25');

// Ajuste de salida superior a existencia real en Alm 01 debe fallar sin clamar
await assert.rejects(
  async () => {
    await saveSupabaseProfitInventoryAdjustment({
      almacen: '01',
      motivo: 'Merma excedida',
      renglones: [{ co_art: 'TEST-SKU-01', tipo_trans: 'S', total_art: 50 }]
    });
  },
  /Stock insuficiente/i,
  'Debe rechazar ajuste de salida superior a existencia real en el almacén'
);

// Validar helper applyStockDeltaForWarehouseLines directamente
await assert.rejects(
  async () => {
    await applyStockDeltaForWarehouseLines([{ codigo: 'TEST-SKU-01', delta02: -100 }], { validateStrict: true });
  },
  /Stock insuficiente/i
);
console.log('  ✓ Validaciones de traslados, ajustes y sincronización snake_case/camelCase verificadas.');

// 3. Compras: IDs únicos, mapeo extendido y protección anti-doble-entrada de stock
console.log('3. Verificando ID único de compras, mapeo completo y control anti-doble-entrada...');
const pA = savePurchase({
  numeroFacturaProv: 'FAC-TEST-A',
  numeroControl: '00-001001',
  proveedorNombre: 'Keystone Prueba',
  proveedorRif: 'J-31115365-9',
  almacen: '02',
  fleteUsd: 12.5,
  baseReducidaUsd: 50,
  ivaReducidaUsd: 4,
  montoNetoPagarUsd: 54,
  condicionPago: 'CREDITO',
  diasCredito: 30,
  producto: 'Oilstone Prueba Inventario',
  productoCodigo: 'TEST-SKU-01',
  cantidad: 5,
  costoUnitarioUsd: 20,
  subtotalUsd: 100,
  totalUsd: 108
});
const pB = savePurchase({
  numeroFacturaProv: 'FAC-TEST-B',
  numeroControl: '00-001002',
  proveedorRif: 'J-31115365-9',
  almacen: '01',
  productoCodigo: 'TEST-SKU-01',
  cantidad: 2,
  subtotalUsd: 40,
  totalUsd: 46.4
});
assert.notStrictEqual(pA.id, pB.id, 'savePurchase debe generar IDs únicos sin colisión COMP-001');
assert.strictEqual(pA.almacen, '02');
assert.strictEqual(pA.fleteUsd, 12.5);
assert.strictEqual(pA.baseReducidaUsd, 50);
assert.strictEqual(pA.ivaReducidaUsd, 4);
assert.strictEqual(pA.condicionPago, 'CREDITO');
assert.strictEqual(pA.diasCredito, 30);
assert.ok(Array.isArray(pA.items) && pA.items.length === 1);

const dbMapped = mapPurchaseToDb(pA);
assert.strictEqual(dbMapped.almacen, '02');
assert.strictEqual(dbMapped.flete_usd, 12.5);
assert.strictEqual(dbMapped.base_reducida_usd, 50);
assert.strictEqual(dbMapped.iva_reducida_usd, 4);
const uiMapped = mapPurchaseFromDb(dbMapped);
assert.strictEqual(uiMapped.almacen, '02');
assert.strictEqual(uiMapped.fleteUsd, 12.5);
assert.strictEqual(uiMapped.baseReducidaUsd, 50);

// Flujo anti doble stock: Compra -> REC vinculada NO debe sumar dos veces
const savedPurchase = await saveSupabasePurchase({
  numeroFacturaProv: 'FAC-NODUP-777',
  numeroControl: '00-007777',
  proveedorRif: 'J-31115365-9',
  proveedorNombre: 'Keystone Prueba',
  almacen: '02',
  productoId: 'TEST-SKU-01',
  productoCodigo: 'TEST-SKU-01',
  producto: 'Oilstone Prueba Inventario',
  cantidad: 5,
  costoUnitarioUsd: 21,
  subtotalUsd: 105,
  totalUsd: 121.8,
  items: [{
    productoId: 'TEST-SKU-01',
    codigo: 'TEST-SKU-01',
    descripcion: 'Oilstone Prueba Inventario',
    cantidad: 5,
    costoUnitarioUsd: 21,
    subtotalUsd: 105,
    almacen: '02'
  }]
});
assert.strictEqual(savedPurchase.stockAplicado, true, 'La compra debe marcar stockAplicado: true');
storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
assert.strictEqual(storedProd.stockAlmacen02, 24, 'Alm 02 debe haber sumado 5 (19 -> 24)');

// Registrar Nota de Recepción con el mismo nroFactura/compraId NO debe volver a sumar +5
await saveSupabaseGoodsReceiptNote({
  compraId: savedPurchase.id,
  nroFactura: 'FAC-NODUP-777',
  proveedorRif: 'J-31115365-9',
  almacen: '02',
  applyStock: true,
  items: [{ codigo: 'TEST-SKU-01', cantidadRecibida: 5 }]
});
storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
assert.strictEqual(storedProd.stockAlmacen02, 24, 'Nota de Recepción vinculada a compra ya aplicada NO debe duplicar stock');

// Compra con recepcionId explícito NO vuelve a sumar stock
await saveSupabasePurchase({
  numeroFacturaProv: 'FAC-WITH-REC-888',
  numeroControl: '00-008888',
  recepcionId: 'REC-PREVIA-888',
  almacen: '01',
  productoCodigo: 'TEST-SKU-01',
  cantidad: 3,
  subtotalUsd: 60,
  totalUsd: 69.6
});
storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
assert.strictEqual(storedProd.stockAlmacen01, 6, 'Compra vinculada a recepción previa no debe volver a incrementar Alm 01');
console.log('  ✓ Compras, mapeo extendido y protección anti-doble-stock verificados.');

// 4. Kardex consolidado y exclusión de documentos anulados
console.log('4. Verificando Kardex consolidado real y filtrado de anulados...');
assert.strictEqual(isDocumentAnnulled({ anulada: true }), true);
assert.strictEqual(isDocumentAnnulled({ status: 'ANULADA' }), true);
assert.strictEqual(isDocumentAnnulled({ anulada: false, status: 'PROCESADA' }), false);

const kardex = buildConsolidatedKardex({
  products: [storedProd],
  profitPurchases: [
    { id: 'P1', factNum: 'F-01', provRif: 'J-1', anulada: false, items: [{ codigo: 'TEST-SKU-01', cantidad: 10 }] },
    { id: 'P2', factNum: 'F-02', provRif: 'J-1', anulada: true, items: [{ codigo: 'TEST-SKU-01', cantidad: 99 }] }
  ],
  profitInvoices: [
    { id: 'V1', factNum: '100', anulada: false, items: [{ codigo: 'TEST-SKU-01', cantidad: 3 }] },
    { id: 'V2', factNum: '101', anulada: true, items: [{ codigo: 'TEST-SKU-01', cantidad: 50 }] }
  ],
  profitReturns: [
    { id: 'R1', anulada: false, renglones: [{ co_art: 'TEST-SKU-01', total_art: 1 }] },
    { id: 'R2', anulada: true, renglones: [{ co_art: 'TEST-SKU-01', total_art: 20 }] }
  ],
  adjustments: [
    { id: 'A1', anulada: false, renglones: [{ co_art: 'TEST-SKU-01', tipo_trans: 'E', total_art: 2 }, { co_art: 'TEST-SKU-01', tipo_trans: 'S', total_art: 1 }] },
    { id: 'A2', anulada: true, renglones: [{ co_art: 'TEST-SKU-01', tipo_trans: 'S', total_art: 40 }] }
  ],
  transfers: [
    { id: 'T1', anulada: false, renglones: [{ co_art: 'TEST-SKU-01', total_art: 4 }] },
    { id: 'T2', anulada: true, renglones: [{ co_art: 'TEST-SKU-01', total_art: 30 }] }
  ]
});

assert.strictEqual(kardex.length, 1);
const row = kardex[0];
assert.strictEqual(row.entradasCompras, 10, 'Kardex debe excluir compra anulada');
assert.strictEqual(row.salidasVentas, 3, 'Kardex debe excluir factura de venta anulada');
assert.strictEqual(row.devolucionesClientes, 1, 'Kardex debe excluir devolución anulada');
assert.strictEqual(row.entradasAjuste, 2, 'Kardex debe sumar ajuste entrada vigente');
assert.strictEqual(row.salidasAjuste, 1, 'Kardex debe excluir ajuste salida anulado');
assert.strictEqual(row.traslados, 4, 'Kardex debe excluir traslado anulado (como 01-TRA-1 / 01-TRA-2)');
assert.strictEqual(row.stock01, 6, 'Kardex debe incluir stock01');
assert.strictEqual(row.stock02, 24, 'Kardex debe incluir stock02');

console.log('✅ TODAS LAS PRUEBAS DE INVENTARIO, ALMACENES Y COMPRAS FINALIZADAS CON ÉXITO.');
