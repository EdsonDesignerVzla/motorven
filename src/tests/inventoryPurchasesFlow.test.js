import assert from 'assert';
import { getProductWarehouseStocks } from '../services/formatService.js';
import { savePurchase, getProducts, saveProduct } from '../services/storageService.js';
import {
  mapPurchaseToDb,
  mapPurchaseFromDb,
  applyStockDeltaForWarehouseLines,
  resolveStockItemProductKey,
  buildSaleStockDeltaLines,
  buildDocTypeChangeWarehouseDeltaLines,
  buildInvoiceEditStockDeltaLines,
  updateSupabaseInvoiceDocument,
  buildSaleDeductIdempotencyKey,
  buildSaleRevertIdempotencyKey,
  saveSupabaseProduct,
  deleteSupabaseSale,
  resetSupabaseOnlineStatus,
  saveSupabaseProfitWarehouseTransfer,
  saveSupabaseProfitInventoryAdjustment,
  saveSupabasePurchase,
  updateSupabasePurchase,
  saveSupabaseProfitPurchase,
  deleteSupabasePurchase,
  getSupabasePurchases,
  saveSupabaseGoodsReceiptNote,
  supabase
} from '../services/supabaseService.js';
import {
  getSyncQueue,
  clearSyncQueue,
  enqueueSyncAction,
  flushSyncQueue
} from '../services/offlineSyncService.js';
import {
  buildConsolidatedKardex,
  isDocumentAnnulled,
  resolveKardexLineCosts,
  formatKardexDocCode
} from '../utils/kardexUtils.js';

// Aislar llamadas remotas durante pruebas unitarias para no contaminar Supabase en producción
const origSupabaseFrom = supabase.from;
const mockQueryChain = () => {
  const res = Promise.resolve({ data: [], error: null });
  const chain = {
    select: () => chain,
    insert: () => chain,
    upsert: () => chain,
    update: () => chain,
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    or: () => chain,
    like: () => chain,
    ilike: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => res,
    maybeSingle: () => res,
    then: res.then.bind(res),
    catch: res.catch.bind(res)
  };
  return chain;
};
supabase.from = () => mockQueryChain();

try {

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

// 3b. Edición, Guardado y Eliminación de Historial de Cargas Locales SENIAT
console.log('3b. Verificando edición, guardado y eliminación de Historial de Cargas Locales SENIAT...');
const updatedPurchase = await updateSupabasePurchase(savedPurchase.id, {
  ...savedPurchase,
  numeroFacturaProv: 'FAC-EDITED-777',
  numeroControl: '00-007778',
  cantidad: 8,
  totalUsd: 194.88,
  items: [{
    productoId: 'TEST-SKU-01',
    codigo: 'TEST-SKU-01',
    descripcion: 'Oilstone Prueba Inventario',
    cantidad: 8,
    costoUnitarioUsd: 21,
    subtotalUsd: 168,
    almacen: '02'
  }]
});
assert.strictEqual(updatedPurchase.numeroFacturaProv, 'FAC-EDITED-777', 'Debe actualizar el número de factura de la compra SENIAT');
assert.strictEqual(updatedPurchase.numeroControl, '00-007778', 'Debe actualizar el número de control');
storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
assert.strictEqual(storedProd.stockAlmacen02, 27, 'Al editar cantidad de compra de 5 a 8 en Alm 02, el stock debe ajustarse +3 (24 -> 27)');

// Eliminar la compra SENIAT debe revertir las 8 unidades de Alm 02 (27 -> 19) y excluirla del listado
await deleteSupabasePurchase(updatedPurchase);
storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
assert.strictEqual(storedProd.stockAlmacen02, 19, 'Al eliminar la compra SENIAT de 8 unidades, el stock en Alm 02 debe revertirse (27 -> 19)');
const currentPurchasesAfterDelete = await getSupabasePurchases();
assert.strictEqual(
  currentPurchasesAfterDelete.some(p => p && p.id === savedPurchase.id),
  false,
  'La compra eliminada no debe aparecer en getSupabasePurchases'
);
// Restaurar las 5 unidades en Alm 02 para que las aserciones subsiguientes del Kardex mantengan stock02 === 24
await applyStockDeltaForWarehouseLines([{ codigo: 'TEST-SKU-01', delta01: 0, delta02: 5 }]);
storedProd = getProducts().find(p => p.codigo === 'TEST-SKU-01');
console.log('  ✓ Compras, edición/guardado/eliminación SENIAT, mapeo extendido y protección anti-doble-stock verificados.');

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

// 5. Normalización de costos en Bolívares vs USD en ajustes y códigos sin doble prefijo
const testProdMap = new Map([
  ['101510', { codigo: '101510', costoUsd: 139.62 }],
  ['100102', { codigo: '100102', costoUsd: 52.91 }]
]);
const profitBsLine = resolveKardexLineCosts({
  line: { co_art: '101510', cost_unit_om: 6535862.01, cost_unit: 6535862.01 },
  productsBySku: testProdMap,
  tasaDolar: 911.62
});
assert.strictEqual(profitBsLine.costUsd, 139.62, 'Si cost_unit_om === cost_unit (Bs.), debe resolver el costo real en USD');
assert.strictEqual(profitBsLine.costBs, 6535862.01);

const genuineUsdLine = resolveKardexLineCosts({
  line: { co_art: '100102', cost_unit_om: 76.52, cost_unit: 34548.64 },
  productsBySku: testProdMap,
  tasaDolar: 911.62
});
assert.strictEqual(genuineUsdLine.costUsd, 76.52, 'Si cost_unit_om != cost_unit, cost_unit_om ya está en USD');

assert.strictEqual(formatKardexDocCode(14, 'AJU'), 'AJU-000014');
assert.strictEqual(formatKardexDocCode('AJU-991122', 'AJU'), 'AJU-991122');
assert.strictEqual(formatKardexDocCode(4, 'TRA'), 'TRA-000004');
assert.strictEqual(formatKardexDocCode('TRAS-881100', 'TRA'), 'TRAS-881100');

// 6. Cola offline por delta atómico (stock_delta) en lugar de sobrescribir stock absoluto
clearSyncQueue();
enqueueSyncAction('stock_delta', 'UPDATE', {
  id: 'sale_FAC-TEST-DELTA_deduct',
  idempotencyKey: 'sale_FAC-TEST-DELTA_deduct',
  lines: [{ codigo: 'TEST-SKU-01', delta01: -2, delta02: 0 }],
  validateStrict: false,
  alreadyAppliedLocally: true
});
assert.strictEqual(getSyncQueue().some(q => q.entity === 'stock_delta'), true, 'Debe encolar acción stock_delta');
assert.strictEqual(getSyncQueue().some(q => q.entity === 'product'), false, 'No debe encolar product absoluto');

let replayedDeltaArgs = null;
const flushRes = await flushSyncQueue({
  applyStockDeltaForWarehouseLines: async (lines, opts) => {
    replayedDeltaArgs = { lines, opts };
    return [];
  }
});
assert.strictEqual(flushRes.success, true, 'flushSyncQueue debe sincronizar stock_delta sin fallos');
assert.strictEqual(replayedDeltaArgs?.lines?.[0]?.delta01, -2, 'Debe reproducir exactamente delta01 = -2');
assert.strictEqual(replayedDeltaArgs?.opts?.idempotencyKey, 'sale_FAC-TEST-DELTA_deduct');
assert.strictEqual(replayedDeltaArgs?.opts?.skipLocalStoragePatch, true, 'No debe doble-descontar en localStorage');
assert.strictEqual(getSyncQueue().length, 0, 'La cola debe quedar vacía tras sincronizar');

// 7. Blindaje de claves SKU, traslado atómico en cambio de tipoDoc y fallback anti-doble-descuento
console.log('7. Verificando resolución de SKU, cambio de tipoDoc y protección de apply-delta...');
assert.strictEqual(
  resolveStockItemProductKey({ id: 'ITEM-1794938679424', codigo: '100102', cantidad: 2 }),
  '100102',
  'Debe ignorar id sintético ITEM- y usar codigo 100102'
);
assert.strictEqual(
  resolveStockItemProductKey({ id: 'PED-NE-1', articulo_id: '001201', cantidad: 1 }),
  '001201',
  'Debe resolver articulo_id cuando id es PED-'
);
assert.strictEqual(
  resolveStockItemProductKey({ id: '001208', articuloId: '001201', codigo: '001201', cantidad: 1 }),
  '001201',
  'Debe priorizar articuloId/codigo antes que id ambiguo'
);
assert.strictEqual(
  resolveStockItemProductKey({ id: '001208', cantidad: 3 }),
  '001208',
  'Debe conservar id numérico legacy cuando no hay articuloId/codigo'
);

const factDeltaLines = buildSaleStockDeltaLines({
  id: '000614',
  tipoDoc: 'FACTURA',
  items: [
    { id: 'ITEM-1794938679424', codigo: '100102', cantidad: 2 },
    { id: '001208', cantidad: 3 }
  ]
});
assert.deepStrictEqual(factDeltaLines, [
  { codigo: '100102', delta01: -2, delta02: 0 },
  { codigo: '001208', delta01: -3, delta02: 0 }
]);

const nePrefixDeltaLines = buildSaleStockDeltaLines({
  id: 'doc-ne-1',
  numeroDoc: 'N.E-002250',
  items: [{ id: 'PED-NE-1', articulo_id: '001201', cantidad: 1 }]
});
assert.deepStrictEqual(nePrefixDeltaLines, [
  { codigo: '001201', delta01: 0, delta02: -1 }
]);

const facToNeSwap = buildDocTypeChangeWarehouseDeltaLines(
  {
    id: '000614',
    tipoDoc: 'FACTURA',
    items: [
      { id: 'ITEM-1', codigo: '100102', cantidad: 2 },
      { id: 'ITEM-2', articuloId: '001208', cantidad: 1 }
    ]
  },
  { id: 'NE-000614', tipoDoc: 'NOTA_ENTREGA', items: [{ codigo: '100102', cantidad: 2 }] }
);
assert.deepStrictEqual(facToNeSwap, [
  { codigo: '100102', delta01: 2, delta02: -2 },
  { codigo: '001208', delta01: 1, delta02: -1 }
]);
for (const sw of facToNeSwap) {
  assert.strictEqual(sw.delta01 + sw.delta02, 0, 'Cambio de tipoDoc debe ser suma cero entre almacenes');
}

const neToFacSwap = buildDocTypeChangeWarehouseDeltaLines(
  { id: 'NE-002200', tipoDoc: 'NOTA_ENTREGA', items: [{ codigo: '001308', cantidad: 3 }] },
  { id: '002200', tipoDoc: 'FACTURA', items: [{ codigo: '001308', cantidad: 3 }] }
);
assert.deepStrictEqual(neToFacSwap, [
  { codigo: '001308', delta01: -3, delta02: 3 }
]);

assert.deepStrictEqual(
  buildDocTypeChangeWarehouseDeltaLines(
    { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100102', cantidad: 1 }] },
    { id: '000614', tipoDoc: 'NOTA_DEBITO', items: [{ codigo: '100102', cantidad: 1 }] }
  ),
  [],
  'Mismo almacén 01->01 debe retornar []'
);
assert.deepStrictEqual(
  buildDocTypeChangeWarehouseDeltaLines(
    { id: '000614', tipoDoc: 'FACTURA', items: [] },
    { id: 'NE-000614', tipoDoc: 'NOTA_ENTREGA', items: [{ codigo: '100102', cantidad: 2 }] }
  ),
  [],
  'originalDoc.items vacío no debe fabricar stock fantasma al cambiar tipoDoc'
);

const origFetchForStockTest = globalThis.fetch;
const prevFromForStockTest = supabase.from;
let productUpdateCalls = 0;
supabase.from = (table) => {
  const baseChain = mockQueryChain();
  if (table !== 'products') return baseChain;
  return {
    ...baseChain,
    update: (...args) => {
      productUpdateCalls += 1;
      return baseChain.update(...args);
    }
  };
};
try {
  // Caso HTTP 500 en /inventory/apply-delta: NO debe caer a products.update(), SÍ debe encolar stock_delta
  clearSyncQueue();
  resetSupabaseOnlineStatus();
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: 'Simulated 500' })
  });
  await applyStockDeltaForWarehouseLines(
    [{ codigo: 'TEST-SKU-01', delta01: -1, delta02: 0 }],
    { forceServerFetch: true, idempotencyKey: 'test_500_no_double_deduct' }
  );
  assert.strictEqual(productUpdateCalls, 0, 'Ante HTTP 500 en apply-delta NO debe llamar products.update()');
  assert.strictEqual(
    getSyncQueue().some(q => q.entity === 'stock_delta' && q.data?.idempotencyKey === 'test_500_no_double_deduct'),
    true,
    'Ante HTTP 500 en apply-delta debe encolar stock_delta con el idempotencyKey exacto'
  );

  // Caso timeout/AbortError en /inventory/apply-delta: tampoco debe caer a products.update()
  clearSyncQueue();
  resetSupabaseOnlineStatus();
  globalThis.fetch = async () => {
    throw new Error('AbortError: network timeout');
  };
  await applyStockDeltaForWarehouseLines(
    [{ codigo: 'TEST-SKU-01', delta01: -1, delta02: 0 }],
    { forceServerFetch: true, idempotencyKey: 'test_timeout_no_double_deduct' }
  );
  assert.strictEqual(productUpdateCalls, 0, 'Ante timeout en apply-delta NO debe llamar products.update()');
  assert.strictEqual(
    getSyncQueue().some(q => q.entity === 'stock_delta' && q.data?.idempotencyKey === 'test_timeout_no_double_deduct'),
    true,
    'Ante timeout en apply-delta debe encolar stock_delta con el idempotencyKey exacto'
  );

  // Caso HTTP 404 en /inventory/apply-delta: SÍ debe caer al fallback PostgREST tradicional
  clearSyncQueue();
  resetSupabaseOnlineStatus();
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not Found' })
  });
  await applyStockDeltaForWarehouseLines(
    [{ codigo: 'TEST-SKU-01', delta01: -1, delta02: 0 }],
    { forceServerFetch: true, idempotencyKey: 'test_404_postgrest_fallback' }
  );
  assert.strictEqual(productUpdateCalls, 1, 'Ante HTTP 404 en apply-delta SÍ debe usar fallback PostgREST products.update()');
  clearSyncQueue();

  // 11. Protección contra doble/triple reversión de stock al eliminar una factura ya borrada o con fallo parcial en DELETE
  const revKeyA = buildSaleRevertIdempotencyKey({ id: '000041', factNum: '000041', tipoDoc: 'FACTURA', fechaEmision: '2026-11-18T12:45:44.583Z' });
  const revKeyB = buildSaleRevertIdempotencyKey({ id: 'FAC-000041', numeroDoc: '000041', tipo_doc: 'FACTURA', fec_emis: '2026-11-18T12:45:44.583Z' });
  assert.strictEqual(revKeyA, revKeyB, 'buildSaleRevertIdempotencyKey debe generar la misma clave para variantes de la misma factura');

  // 11a. Si la factura ya fue borrada en servidor (sales=[] y profit_invoices=[]) y en localStorage, NO debe volver a sumar stock
  productUpdateCalls = 0;
  clearSyncQueue();
  const stockBeforeGhostDelete = getProducts().find(p => p.codigo === 'TEST-SKU-01').stockAlmacen01;
  await deleteSupabaseSale({
    id: '009941',
    factNum: '009941',
    numeroDoc: '009941',
    tipoDoc: 'FACTURA',
    fechaEmision: '2026-11-18T12:45:44.583Z',
    items: [{ codigo: 'TEST-SKU-01', cantidad: 1 }]
  });
  const stockAfterGhostDelete = getProducts().find(p => p.codigo === 'TEST-SKU-01').stockAlmacen01;
  assert.strictEqual(productUpdateCalls, 0, 'Eliminar un documento que ya no existe en sales ni profit_invoices NO debe tocar products');
  assert.strictEqual(stockAfterGhostDelete, stockBeforeGhostDelete, 'Stock local Alm 01 no debe inflarse al re-eliminar documento ya borrado');

  // 11b. Si el Paso 2 (reversión de stock) tuvo éxito pero el Paso 4 (DELETE) falla, NO debe re-encolar stock_delta duplicado
  productUpdateCalls = 0;
  clearSyncQueue();
  const prevFromForPartialFail = supabase.from;
  supabase.from = (table) => {
    const baseChain = mockQueryChain();
    if (table === 'sales') {
      const selectRes = Promise.resolve({
        data: [{
          id: '009942',
          numero_doc: '009942',
          tipo_doc: 'FACTURA',
          fecha: '2026-11-18T13:00:00.000Z',
          items: [{ codigo: 'TEST-SKU-01', cantidad: 1 }]
        }],
        error: null
      });
      const delErrRes = Promise.resolve({ data: null, error: new Error('Simulated DELETE timeout') });
      return {
        ...baseChain,
        select: () => ({
          ...baseChain,
          or: () => selectRes
        }),
        delete: () => ({
          ...baseChain,
          or: () => delErrRes,
          in: () => delErrRes
        })
      };
    }
    if (table === 'products') {
      return {
        ...baseChain,
        update: (...args) => {
          productUpdateCalls += 1;
          return baseChain.update(...args);
        }
      };
    }
    return baseChain;
  };
  try {
    await deleteSupabaseSale({
      id: '009942',
      factNum: '009942',
      numeroDoc: '009942',
      tipoDoc: 'FACTURA',
      fechaEmision: '2026-11-18T13:00:00.000Z',
      items: [{ codigo: 'TEST-SKU-01', cantidad: 1 }]
    });
    assert.strictEqual(productUpdateCalls, 1, 'Paso 2 debe revertir stock exactamente 1 vez');
    assert.strictEqual(
      getSyncQueue().some(q => q.entity === 'stock_delta'),
      false,
      'Si el Paso 2 ya revirtió el stock y falló el DELETE en Paso 4, NO debe re-encolar stock_delta'
    );
    assert.strictEqual(
      getSyncQueue().some(q => q.entity === 'sales' && q.action === 'DELETE'),
      true,
      'Sí debe encolar el DELETE pendiente de sales'
    );
  } finally {
    supabase.from = prevFromForPartialFail;
    clearSyncQueue();
  }
  // 12. Clave canónica de descuento de venta, deduplicación en cola offline y blindaje de stock en ediciones de metadatos
  const dedKeyA = buildSaleDeductIdempotencyKey({ id: '000616', numeroDoc: '000616', tipoDoc: 'FACTURA' });
  const dedKeyB = buildSaleDeductIdempotencyKey({ id: 'FAC-000616', numeroDoc: '616', tipo_doc: 'FACTURA' });
  assert.strictEqual(dedKeyA, 'sale_FAC_616_deduct', 'buildSaleDeductIdempotencyKey debe normalizar facturas sin ceros iniciales');
  assert.strictEqual(dedKeyA, dedKeyB, 'Variantes del mismo correlativo de factura deben compartir idempotencyKey');

  const dedNeA = buildSaleDeductIdempotencyKey({ id: 'NE-002235', numeroDoc: 'NE-002235', tipoDoc: 'NOTA_ENTREGA' });
  const dedNeB = buildSaleDeductIdempotencyKey({ id: 'N.E-002235', numeroDoc: '2235', tipo_doc: 'NOTA_ENTREGA' });
  assert.strictEqual(dedNeA, 'sale_NE_2235_deduct', 'buildSaleDeductIdempotencyKey debe normalizar notas de entrega');
  assert.strictEqual(dedNeA, dedNeB, 'Variantes de NE deben compartir la misma clave idempotente');

  const dedDatedA = buildSaleDeductIdempotencyKey({ id: '000631', numeroDoc: '000631', tipoDoc: 'FACTURA', fechaEmision: '2026-11-24T12:38:35.000Z' });
  const dedDatedB = buildSaleDeductIdempotencyKey({ id: 'FAC-000631', numeroDoc: '631', tipo_doc: 'FACTURA', fec_emis: '2026-11-24T12:38:35.000Z' });
  const dedDatedC = buildSaleDeductIdempotencyKey({ id: '000631', numeroDoc: '000631', tipoDoc: 'FACTURA', fechaEmision: '2026-11-24T12:48:34.000Z' });
  assert.strictEqual(dedDatedA, dedDatedB, 'Variantes del mismo documento con la misma fecha deben compartir idempotencyKey');
  assert.notStrictEqual(dedDatedA, dedDatedC, 'Un correlativo reutilizado en otra fecha/hora no debe quedar bloqueado por una clave anterior');

  // 12b. Deduplicación de stock_delta en offlineSyncService por idempotencyKey aunque el campo id difiera
  clearSyncQueue();
  enqueueSyncAction('stock_delta', 'UPDATE', {
    id: 'local_1',
    idempotencyKey: 'sale_FAC_616_deduct',
    lines: [{ codigo: 'TEST-SKU-01', delta01: -1, delta02: 0 }]
  });
  enqueueSyncAction('stock_delta', 'UPDATE', {
    id: 'local_2',
    idempotencyKey: 'sale_FAC_616_deduct',
    lines: [{ codigo: 'TEST-SKU-01', delta01: -1, delta02: 0 }]
  });
  assert.strictEqual(
    getSyncQueue().filter(q => q.entity === 'stock_delta' && q.data?.idempotencyKey === 'sale_FAC_616_deduct').length,
    1,
    'La cola offline nunca debe acumular dos stock_delta con la misma idempotencyKey'
  );
  clearSyncQueue();

  // 12c. saveSupabaseProduct al editar precio/ubicación SIN cambiar stock debe preservar el stock del servidor y sanear Almacén
  let capturedMetaPatch = null;
  const prevFromForMetaEdit = supabase.from;
  supabase.from = (table) => {
    const baseChain = mockQueryChain();
    if (table === 'products') {
      return {
        ...baseChain,
        update: (patch) => {
          capturedMetaPatch = patch;
          return {
            ...baseChain,
            eq: () => ({
              ...baseChain,
              select: () => ({
                single: () => Promise.resolve({
                  data: { ...prodWithSplit, ...patch, stock: 99, stockAlmacen01: 49, stockAlmacen02: 50 },
                  error: null
                })
              })
            })
          };
        }
      };
    }
    return baseChain;
  };
  try {
    resetSupabaseOnlineStatus();
    const curLocal = getProducts().find(p => p.codigo === 'TEST-SKU-01');
    await saveSupabaseProduct({
      ...curLocal,
      precioUsdDetal: 88,
      ubicacion: '01: Almacén Principal • 02: Almac\uFFFD\uFFFDn Central'
    });
    assert.ok(capturedMetaPatch, 'Editar metadatos de un producto existente debe usar UPDATE parcial');
    assert.strictEqual(capturedMetaPatch._preserveServerStock, true, 'Debe marcar _preserveServerStock: true');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(capturedMetaPatch, 'stock'), false, 'No debe enviar stock al editar solo precio/ubicación');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(capturedMetaPatch, 'stockAlmacen01'), false, 'No debe sobrescribir stockAlmacen01');
    assert.strictEqual(capturedMetaPatch.ubicacion, '01: Almacén Principal • 02: Almacén Central', 'Debe sanear caracteres corruptos en ubicacion');
  } finally {
    supabase.from = prevFromForMetaEdit;
  }

  // Test: buildInvoiceEditStockDeltaLines - ajuste neto de inventario al editar cantidades/renglones de Factura o Nota de Entrega
  // 1) Aumentar cantidad en Factura: guardado 2, editado 4 (+2) => solo resta 2 del almacén 01
  assert.deepStrictEqual(
    buildInvoiceEditStockDeltaLines(
      { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100403', cantidad: 2 }] },
      { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100403', cantidad: 4 }] }
    ),
    [{ codigo: '100403', delta01: -2, delta02: 0 }],
    'Aumentar de 2 a 4 en Factura debe restar solo 2 del almacén 01'
  );

  // 2) Disminuir cantidad en Factura: guardado 2, editado 1 (-1) => suma 1 al almacén 01
  assert.deepStrictEqual(
    buildInvoiceEditStockDeltaLines(
      { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100403', cantidad: 2 }] },
      { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100403', cantidad: 1 }] }
    ),
    [{ codigo: '100403', delta01: 1, delta02: 0 }],
    'Disminuir de 2 a 1 en Factura debe sumar 1 al almacén 01'
  );

  // 3) Nota de Entrega: guardado 2, editado 5 (+3) y otro renglón quitado (3 -> 0) => almacén 02
  assert.deepStrictEqual(
    buildInvoiceEditStockDeltaLines(
      {
        id: 'NE-002250',
        tipoDoc: 'NOTA_ENTREGA',
        items: [
          { codigo: '100403', cantidad: 2 },
          { codigo: '001208', cantidad: 3 }
        ]
      },
      {
        id: 'NE-002250',
        tipoDoc: 'NOTA_ENTREGA',
        items: [
          { codigo: '100403', cantidad: 5 },
          { codigo: '001308', cantidad: 1 }
        ]
      }
    ),
    [
      { codigo: '100403', delta01: 0, delta02: -3 },
      { codigo: '001308', delta01: 0, delta02: -1 },
      { codigo: '001208', delta01: 0, delta02: 3 }
    ],
    'Editar renglones en Nota de Entrega debe restar aumentos/nuevos y sumar eliminados en almacén 02'
  );

  // 4) Cambio simultáneo de tipoDoc (FACTURA -> NOTA_ENTREGA) + cambio de cantidad (2 -> 4)
  assert.deepStrictEqual(
    buildInvoiceEditStockDeltaLines(
      { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100403', cantidad: 2 }] },
      { id: 'NE-000614', tipoDoc: 'NOTA_ENTREGA', items: [{ codigo: '100403', cantidad: 4 }] }
    ),
    [{ codigo: '100403', delta01: 2, delta02: -4 }],
    'Cambiar de FACTURA (2) a NOTA_ENTREGA (4) debe devolver 2 a alm01 y restar 4 de alm02'
  );

  // 5) Sin cambios en renglones ni almacén => []
  assert.deepStrictEqual(
    buildInvoiceEditStockDeltaLines(
      { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100403', cantidad: 2 }] },
      { id: '000614', tipoDoc: 'FACTURA', items: [{ codigo: '100403', cantidad: 2 }] }
    ),
    [],
    'Sin cambios en cantidades ni tipoDoc no debe generar delta de inventario'
  );

  // 6) updateSupabaseInvoiceDocument actualiza stock local al editar cantidad en modo offline/cola
  clearSyncQueue();
  const prevSku01 = getProducts().find(p => p.codigo === 'TEST-SKU-01');
  const prevAlmacen01 = Number(prevSku01?.stockAlmacen01 ?? prevSku01?.stock ?? 0);
  const origDocEdit = {
    id: '009901',
    factNum: '009901',
    numeroDoc: '009901',
    tipoDoc: 'FACTURA',
    items: [{ codigo: 'TEST-SKU-01', cantidad: 2, precioUsd: 10 }]
  };
  await updateSupabaseInvoiceDocument(origDocEdit, {
    ...origDocEdit,
    items: [{ codigo: 'TEST-SKU-01', cantidad: 4, precioUsd: 10 }]
  });
  const afterIncreaseSku = getProducts().find(p => p.codigo === 'TEST-SKU-01');
  assert.strictEqual(
    Number(afterIncreaseSku?.stockAlmacen01 ?? 0),
    prevAlmacen01 - 2,
    'updateSupabaseInvoiceDocument debe restar solo 2 cuando pasa de 2 a 4'
  );

  await updateSupabaseInvoiceDocument(
    { ...origDocEdit, items: [{ codigo: 'TEST-SKU-01', cantidad: 4, precioUsd: 10 }] },
    { ...origDocEdit, items: [{ codigo: 'TEST-SKU-01', cantidad: 3, precioUsd: 10 }] }
  );
  const afterDecreaseSku = getProducts().find(p => p.codigo === 'TEST-SKU-01');
  assert.strictEqual(
    Number(afterDecreaseSku?.stockAlmacen01 ?? 0),
    prevAlmacen01 - 1,
    'updateSupabaseInvoiceDocument debe sumar 1 cuando pasa de 4 a 3'
  );

  // 14. Regresión edición de precio unitario en Nota de Entrega multi-renglón (60.26 -> 60.29 => 35087.37)
  const neInit = await saveSupabasePurchase({
    id: 'COMP-TEST-17591',
    numeroFacturaProv: 'NOTA DE ENTREGA',
    numeroControl: '17591',
    tipoDoc: 'FACTURA',
    almacen: '02',
    tasaDolar: 918.76,
    condicionPago: 'CREDITO',
    diasCredito: 15,
    subtotalUsd: 35082.81,
    baseExentaUsd: 35082.81,
    totalUsd: 35082.81,
    montoNetoPagarUsd: 35082.81,
    items: [
      { productoId: '100403', codigo: '100403', descripcion: 'Lubricante Oilstone 4 tiempos API SL motos (LT)', cantidad: 152, costoUnitarioUsd: 60.26, fleteUsd: 0, subtotalUsd: 9159.52, tipoAlicuota: 'EXENTO_0', almacen: '02' },
      { productoId: '100403', codigo: '100403', descripcion: 'Lubricante Oilstone 4 tiempos API SL motos (LT)', cantidad: 108, costoUnitarioUsd: 60.29, fleteUsd: 0, subtotalUsd: 6511.32, tipoAlicuota: 'EXENTO_0', almacen: '02' },
      { productoId: 'TEST-SKU-01', codigo: 'TEST-SKU-01', descripcion: 'Resto renglones', cantidad: 310, costoUnitarioUsd: 62.619258, fleteUsd: 0, subtotalUsd: 19411.97, tipoAlicuota: 'EXENTO_0', almacen: '02' }
    ]
  });
  const updatedItemsNe = neInit.items.map((it, idx) =>
    idx === 0 ? { ...it, costoUnitarioUsd: 60.29, subtotalUsd: Number((152 * 60.29).toFixed(2)) } : it
  );
  const newNeTotal = Number(updatedItemsNe.reduce((s, it) => s + Number(it.subtotalUsd || 0), 0).toFixed(2));
  assert.strictEqual(newNeTotal, 35087.37, 'El total recalculado al cambiar 60.26 -> 60.29 en 152 uds debe ser 35087.37');

  const neUpdated = await updateSupabasePurchase(neInit.id, {
    ...neInit,
    subtotalUsd: newNeTotal,
    baseExentaUsd: newNeTotal,
    totalUsd: newNeTotal,
    montoNetoPagarUsd: newNeTotal,
    items: updatedItemsNe
  });
  assert.strictEqual(neUpdated.totalUsd, 35087.37, 'updateSupabasePurchase debe guardar totalUsd 35087.37');
  assert.strictEqual(neUpdated.montoNetoPagarUsd, 35087.37, 'updateSupabasePurchase debe guardar montoNetoPagarUsd 35087.37');
  assert.strictEqual(neUpdated.items[0].costoUnitarioUsd, 60.29, 'El primer renglón 100403 debe guardar costoUnitarioUsd 60.29');
  assert.ok(neUpdated.updatedAt, 'updateSupabasePurchase debe estampar updatedAt');

  const savedMirror = await saveSupabaseProfitPurchase({
    id: 'COM-TEST-17591',
    compraId: neInit.id,
    factNum: 'NOTA DE ENTREGA',
    nroControl: '17591',
    totBrutoUsd: newNeTotal,
    totNetoUsd: newNeTotal,
    saldoUsd: newNeTotal,
    items: updatedItemsNe
  });
  assert.strictEqual(savedMirror.totNetoUsd, 35087.37, 'saveSupabaseProfitPurchase debe persistir totNetoUsd 35087.37');
  const localProfitList = JSON.parse(globalThis.localStorage.getItem('signum_profit_purchases_v1') || '[]');
  const mirroredRow = localProfitList.find((r) => r && r.id === 'COM-TEST-17591');
  assert.strictEqual(mirroredRow?.totNetoUsd, 35087.37, 'El espejo local profit_purchases debe reflejar 35087.37');
  await deleteSupabasePurchase(neUpdated).catch(() => {});
} finally {
  clearSyncQueue();
  globalThis.fetch = origFetchForStockTest;
  supabase.from = prevFromForStockTest;
  resetSupabaseOnlineStatus();
}

console.log('✅ TODAS LAS PRUEBAS DE INVENTARIO, ALMACENES Y COMPRAS FINALIZADAS CON ÉXITO.');
} finally {
  clearSyncQueue();
  supabase.from = origSupabaseFrom;
}
