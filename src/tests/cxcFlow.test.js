import assert from 'node:assert/strict';
import {
  isCxcInvoiceCancelled,
  inferCxcDocType,
  getCxcScopedDocKey,
  normalizeCollectionWriteAmounts,
  consolidateClientReceivables,
  doesCollectionMatchInvoice,
  classifyCollectionRateType,
  groupMovementsByRateType
} from '../utils/cxcUtils.js';
import {
  getScopedCxcDeleteKeys,
  markCxcDocDeleted,
  isCxcEntryDeleted,
  saveSupabaseProfitCollection,
  getSupabaseProfitCollections
} from '../services/supabaseService.js';

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createMemoryStorage();
}

console.log('--- INICIANDO PRUEBAS CXC, NO-COLISIÓN FAC/NE Y COBROS ---');

// 1. Consolidación de cartera CxC (MobileCxCView + CashflowView) con clientes en saldoDeudorUsd = 0
{
  const clients = [
    { id: 'CLI-1', nombre: 'Repuestos Alpha, C.A.', rif: 'J-30001111-1', saldoDeudorUsd: 0 },
    { id: 'CLI-2', nombre: 'Taller Beta', rif: 'J-40002222-2', saldoDeudorUsd: 50 }
  ];
  const profitInvoices = [
    {
      id: '000133',
      factNum: '000133',
      tipoDoc: 'FACTURA',
      clienteId: 'CLI-1',
      clienteNombre: 'Repuestos Alpha, C.A.',
      clienteRif: 'J-30001111-1',
      totNetoUsd: 200,
      saldoUsd: 120,
      anulada: false,
      fechaEmision: '2026-11-10',
      fechaVencimiento: '2026-11-25'
    },
    {
      id: 'NE-000133',
      factNum: 'NE-000133',
      tipoDoc: 'NOTA_ENTREGA',
      clienteId: 'CLI-1',
      clienteNombre: 'Repuestos Alpha, C.A.',
      clienteRif: 'J-30001111-1',
      totNetoUsd: 80,
      saldoUsd: 80,
      anulada: false,
      fechaEmision: '2026-11-01',
      fechaVencimiento: '2026-11-25'
    },
    {
      id: '000134',
      factNum: '000134',
      tipoDoc: 'FACTURA',
      clienteId: 'CLI-1',
      clienteNombre: 'Repuestos Alpha, C.A.',
      clienteRif: 'J-30001111-1',
      totNetoUsd: 500,
      saldoUsd: 500,
      anulado: true
    },
    {
      id: '000200',
      factNum: '000200',
      tipoDoc: 'FACTURA',
      clienteId: 'CLI-2',
      clienteNombre: 'Taller Beta',
      clienteRif: 'J-40002222-2',
      totNetoUsd: 100,
      saldoUsd: 100,
      anulada: false,
      fechaEmision: '2026-11-01',
      fechaVencimiento: '2026-11-25'
    }
  ];
  const sales = [
    // Duplicada con profitInvoices -> NO debe sumarse dos veces
    {
      id: '000133',
      numeroDoc: '000133',
      tipoDoc: 'FACTURA',
      condicionPago: 'CREDITO',
      clienteId: 'CLI-1',
      clienteRif: 'J-30001111-1',
      totalUsd: 200,
      saldoUsd: 120
    },
    // Venta a crédito solo en sales -> SÍ debe sumarse
    {
      id: '000310',
      numeroDoc: '000310',
      tipoDoc: 'FACTURA',
      condicionPago: 'CREDITO',
      clienteId: 'CLI-1',
      clienteNombre: 'Repuestos Alpha, C.A.',
      clienteRif: 'J-30001111-1',
      totalUsd: 40,
      saldoUsd: 40
    }
  ];

  const rows = consolidateClientReceivables({
    clients,
    profitInvoices,
    sales,
    tasaBcv: 900,
    includePendingDocs: true
  });

  const alpha = rows.find(r => r.rif === 'J-30001111-1');
  const beta = rows.find(r => r.rif === 'J-40002222-2');
  assert.ok(alpha, 'Debe consolidar cliente CLI-1 aunque saldoDeudorUsd en clients sea 0');
  assert.equal(alpha.saldoUsd, 240, '120 FAC + 80 NE + 40 sales no duplicada (excluye anulado: true de 500)');
  assert.equal(alpha.fac.count, 2);
  assert.equal(alpha.fac.restante, 160);
  assert.equal(alpha.ne.count, 1);
  assert.equal(alpha.ne.restante, 80);
  assert.equal(alpha.pendingDocs.length, 3);

  assert.ok(beta, 'Debe preservar cliente CLI-2');
  assert.equal(beta.saldoUsd, 150, 'No debe sobrescribir saldoDeudorUsd local de 50 al sumar factura de 100');
  assert.equal(isCxcInvoiceCancelled({ anulada: false, status: 'ANULADA' }), true);
  console.log('  ✓ 1. Consolidación Mobile/Cashflow, exclusión de anuladas y cero doble-conteo verificados.');
}

// 2. Normalización estricta de montoBs vs montoUsd * tasa al guardar cobros
{
  const fixedSame = normalizeCollectionWriteAmounts({ montoUsd: 100, montoBs: 100, tasa: 911.62 });
  assert.equal(fixedSame.montoUsd, 100);
  assert.equal(fixedSame.montoBs, 91162);

  const fixedZero = normalizeCollectionWriteAmounts({ montoUsd: 50, montoBs: 0, tasa: 911.62 });
  assert.equal(fixedZero.montoBs, 45581);

  const keptValid = normalizeCollectionWriteAmounts({ montoUsd: 50, montoBs: 45580, tasa: 911.62 });
  assert.equal(keptValid.montoBs, 45580);
  console.log('  ✓ 2. Normalización de montoBs = montoUsd * tasa (anti monto_bs === monto_usd) verificada.');
}

// 3. No-colisión FACTURA vs NOTA_ENTREGA con mismo correlativo (000133)
{
  localStorage.clear();
  const facDoc = { id: '000133', factNum: '000133', tipoDoc: 'FACTURA', fechaEmision: '2026-11-12' };
  const neDoc = { id: 'NE-000133', factNum: '000133', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-11-12' };

  assert.equal(inferCxcDocType(facDoc), 'FACTURA');
  assert.equal(inferCxcDocType(neDoc), 'NOTA_ENTREGA');
  assert.notEqual(getCxcScopedDocKey(facDoc), getCxcScopedDocKey(neDoc));

  const keysDeleted = markCxcDocDeleted(facDoc);
  const delSet = new Set(keysDeleted);
  assert.equal(isCxcEntryDeleted(facDoc, delSet), true, 'Factura eliminada debe quedar oculta');
  assert.equal(isCxcEntryDeleted(neDoc, delSet), false, 'Nota de Entrega hermana NO debe ocultarse al eliminar Factura');

  const neDelKeys = getScopedCxcDeleteKeys(neDoc);
  assert.ok(!neDelKeys.includes('000133'), 'Keys de NE no deben incluir número pelado sin prefijo NE');
  console.log('  ✓ 3. Aislamiento total entre FACTURA y NOTA_ENTREGA con mismo correlativo verificado.');
}

// 4. Vínculo de profit_collections al detalle de factura CxC
{
  const fac = { factNum: '000133', tipoDoc: 'FACTURA', rif: 'J-30001111-1', clienteId: 'CLI-1' };
  const ne = { factNum: 'NE-000133', tipoDoc: 'NOTA_ENTREGA', rif: 'J-30001111-1', clienteId: 'CLI-1' };

  const colForFac = {
    id: 'cob-1',
    cobNum: '004100',
    anulado: false,
    documentosAfectados: [{ tipoDoc: 'FACT', numDoc: '000133', montoCobradoUsd: 50 }]
  };
  const colForNe = {
    id: 'cob-2',
    cobNum: '004101',
    anulado: false,
    documentosAfectados: [{ tipoDoc: 'N/E', numDoc: '000133', montoCobradoUsd: 30 }]
  };
  const colCancelled = {
    id: 'cob-3',
    cobNum: '004102',
    anulado: true,
    documentosAfectados: [{ tipoDoc: 'FACT', numDoc: '000133', montoCobradoUsd: 20 }]
  };

  assert.equal(doesCollectionMatchInvoice(colForFac, fac), true);
  assert.equal(doesCollectionMatchInvoice(colForFac, ne), false);
  assert.equal(doesCollectionMatchInvoice(colForNe, ne), true);
  assert.equal(doesCollectionMatchInvoice(colForNe, fac), false);
  assert.equal(doesCollectionMatchInvoice(colCancelled, fac), false);
  console.log('  ✓ 4. Cruce exacto profit_collections <-> factura/NE sin colisiones verificado.');
}

// 5. Persistencia de cobros offline + poda de signum_cxc_collections_v1 cuando confirma servidor
{
  localStorage.clear();
  const originalFetch = globalThis.fetch;
  try {
    // Offline/falla red -> queda marcado como _pendingServerSync en localStorage
    globalThis.fetch = async () => { throw new Error('offline'); };
    const queued = await saveSupabaseProfitCollection({
      id: 'cob-test-900',
      cobNum: '009900',
      clienteId: 'CLI-1',
      clienteNombre: 'Cliente Test',
      montoUsd: 25,
      montoBs: 25, // corrupto intencional === montoUsd
      tasa: 900
    });
    assert.equal(queued.montoBs, 22500, 'saveSupabaseProfitCollection debe corregir montoBs === montoUsd');

    const storedBeforeSync = JSON.parse(localStorage.getItem('signum_cxc_collections_v1') || '[]');
    assert.equal(storedBeforeSync.length, 1);
    assert.equal(storedBeforeSync[0]._pendingServerSync, true);

    // Simular cola sincronizada y confirmado por servidor sin _pendingServerSync -> debe podarse de signum_cxc_collections_v1
    localStorage.removeItem('signum_offline_sync_queue');
    localStorage.setItem('signum_cxc_collections_v1', JSON.stringify([{ id: 'cob-test-900', cobNum: '009900' }]));
    const serverPayload = [{
      id: 'cob-test-900',
      cob_num: '009900',
      monto_usd: 25,
      monto_bs: 22500,
      tasa: 900,
      fecha_sincronizacion: new Date().toISOString()
    }];
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(serverPayload),
      json: async () => serverPayload
    });
    const fetched = await getSupabaseProfitCollections();
    assert.ok(fetched.some(c => c.id === 'cob-test-900'));
    const storedAfterSync = JSON.parse(localStorage.getItem('signum_cxc_collections_v1') || '[]');
    assert.equal(storedAfterSync.length, 0, 'Debe purgar cobros ya confirmados en servidor');
    console.log('  ✓ 5. Guardado, corrección montoBs y purga automática de signum_cxc_collections_v1 verificados.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 6. Clasificación por renglones de tasa (BCV, Euro, Keystone, Personalizada) y regla obligatoria Fiscal -> BCV
{
  const rates = { tasaBcv: 911.62, tasaEuro: 980.50, tasaKeystone: 935.00 };

  // Fiscal con tasa manual/Euro o explícita igual clasifica obligatorio a BCV
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'FACTURA', factNum: '000500', tasa: 980.50, tipoTasa: 'EURO' }, rates),
    'BCV',
    'Todo documento fiscal debe ir obligatorio al renglón BCV'
  );
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'FACT', factNum: '000501', tasa: 1050.00 }, rates),
    'BCV'
  );

  // Nota de Entrega respeta tipo explícito o infiere contra tasas de referencia / personalizada
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-001', tasa: 980.50 }, rates),
    'EURO'
  );
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-002', tasa: 935.00 }, rates),
    'KEYSTONE'
  );
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-003', tasa: 1025.00 }, rates),
    'PERSONALIZADA'
  );
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-004', tasa: 911.62, tipoTasa: 'PERSONALIZADA' }, rates),
    'PERSONALIZADA'
  );

  const movs = [
    { id: 'm1', tipoDoc: 'FACTURA', factNum: '000510', tasa: 911.62, montoUsd: 100, montoBs: 91162 },
    { id: 'm2', tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-10', tasa: 980.50, montoUsd: 50, montoBs: 49025 },
    { id: 'm3', tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-11', tasa: 935.00, montoUsd: 40, montoBs: 37400 },
    { id: 'm4', tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-12', tasa: 1010.00, montoUsd: 25, montoBs: 25250 }
  ];
  const grouped = groupMovementsByRateType(movs, rates);
  assert.equal(grouped.byType.BCV.totalUsd, 100);
  assert.equal(grouped.byType.BCV.totalBs, 91162);
  assert.equal(grouped.byType.EURO.totalUsd, 50);
  assert.equal(grouped.byType.EURO.totalBs, 49025);
  assert.equal(grouped.byType.KEYSTONE.totalUsd, 40);
  assert.equal(grouped.byType.KEYSTONE.totalBs, 37400);
  assert.equal(grouped.byType.PERSONALIZADA.totalUsd, 25);
  assert.equal(grouped.byType.PERSONALIZADA.totalBs, 25250);
  assert.equal(grouped.totals.count, 4);
  assert.equal(grouped.totals.totalUsd, 215);
  assert.equal(grouped.totals.totalBs, 202837);
  console.log('  ✓ 6. Clasificación por renglones BCV/Euro/Keystone/Personalizada, regla Fiscal->BCV y sumatorias totales verificadas.');
}

console.log('--- TODAS LAS PRUEBAS CXC PASARON AL 100% ---');
