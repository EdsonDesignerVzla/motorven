import assert from 'node:assert/strict';
import {
  isCxcInvoiceCancelled,
  isCxcInvoiceSettled,
  inferCxcDocType,
  getCxcScopedDocKey,
  normalizeCollectionWriteAmounts,
  consolidateClientReceivables,
  reconcileClientsWithRealCxc,
  doesCollectionMatchInvoice,
  classifyCollectionRateType,
  groupMovementsByRateType,
  summarizeDailyMovementsByCaja,
  getNextCreditDebitNoteCorrelativo,
  buildCxcCreditDebitNoteResult
} from '../utils/cxcUtils.js';
import { generateCreditDebitNotePDF } from '../services/pdfReportService.js';
import {
  normalizeRateType,
  isDirectCurrencyRateType,
  resolveDefaultRateValue
} from '../utils/rateClassificationUtils.js';
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

// 6. Clasificación por renglones de tasa (BCV, Euro, Keystone, Personalizada)
{
  const rates = { tasaBcv: 911.62, tasaEuro: 980.50, tasaKeystone: 935.00 };

  // Fiscal con Euro clasifica a BCV, pero respeta KEYSTONE y PERSONALIZADA explícitas
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'FACTURA', factNum: '000500', tasa: 980.50, tipoTasa: 'EURO' }, rates),
    'BCV',
    'Documento fiscal no admite Euro y cae a BCV'
  );
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'FACTURA', factNum: '000502', tasa: 935.00, tipoTasa: 'KEYSTONE' }, rates),
    'KEYSTONE',
    'Documento fiscal debe respetar Tasa Keystone explícita'
  );
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'FACTURA', factNum: '000503', tasa: 990.00, tipoTasa: 'PERSONALIZADA' }, rates),
    'PERSONALIZADA',
    'Documento fiscal debe respetar Tasa Personalizada explícita'
  );
  assert.equal(
    classifyCollectionRateType({ tipoDoc: 'FACT', factNum: '000501', tasa: 1050.00 }, rates),
    'BCV'
  );
  // Registro histórico en Caja USDT (Binance) con Bs > 0 a tasa Keystone conserva KEYSTONE
  assert.equal(
    classifyCollectionRateType({
      tipoDoc: 'NOTA_ENTREGA',
      factNum: '002812',
      tasa: 935.00,
      montoUsd: 30,
      montoBs: 28050,
      cuentaNombre: 'Caja USDT (Binance)'
    }, rates),
    'KEYSTONE'
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

// 7. Monedas Directas (Efectivo USD, Zelle, Binance USDT, Kontigo USDC) con tasa/Bs en 0 y resumen por Caja / Banco
{
  const rates = { tasaBcv: 911.62, tasaEuro: 1009.34, tasaKeystone: 1003.49 };
  const dailyMovs = [
    { id: 'd1', tipoDoc: 'FACTURA', factNum: '002600', tipoTasa: 'BCV', tasa: 911.62, montoUsd: 100, montoBs: 91162, cuentaNombre: 'BANCO PLAZA' },
    { id: 'd2', tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-20', tipoTasa: 'USD', tasa: 1, montoUsd: 50, montoBs: 50, cuentaNombre: 'Caja Efectivo $ (Valencia)' },
    { id: 'd3', tipoDoc: 'FACTURA', factNum: '002601', tipoTasa: 'ZELLE', tasa: 1, montoUsd: 120, montoBs: 0, cuentaNombre: 'ZELLE MOTORVEN' },
    { id: 'd4', tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-21', tipoTasa: 'USDT', tasa: 1, montoUsd: 80, montoBs: 0, cuentaNombre: 'Caja USDT (Binance)' },
    { id: 'd5', tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-22', tipoTasa: 'USDC', tasa: 1, montoUsd: 40, montoBs: 0, cuentaNombre: 'Caja Kontigo (USDC)' },
    { id: 'd6', tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-23', tipoTasa: 'KEYSTONE', tasa: 1003.49, montoUsd: 60, montoBs: 60209.40, cuentaNombre: 'BANCO PLAZA' },
    // Registros históricos sin tipoTasa explícito pero depositados en cajas en moneda directa:
    { id: 'd7', tipoDoc: 'FACTURA', factNum: '002651', tasa: 911.62, montoUsd: 50, montoBs: 45581, cuentaNombre: 'Caja Efectivo $ (Valencia)' },
    { id: 'd8', tipoDoc: 'NOTA_ENTREGA', factNum: '002074', tasa: 1009.34, montoUsd: 50, montoBs: 50467, cuentaNombre: 'Caja Efectivo Caracas $' },
    { id: 'd9', tipoDoc: 'NOTA_ENTREGA', factNum: '002075', tasa: 1003.49, montoUsd: 35, montoBs: 35122.15, cuentaNombre: 'Caja Zelle' },
    { id: 'd10', tipoDoc: 'NOTA_ENTREGA', factNum: '002076', tasa: 1003.49, montoUsd: 25, montoBs: 25087.25, cuentaNombre: 'Caja USDC (Kontigo App)' },
    // Caja Efectivo Bs (Valencia) SÍ conserva sus bolívares
    { id: 'd11', tipoDoc: 'NOTA_ENTREGA', factNum: '002077', tasa: 1003.49, montoUsd: 10, montoBs: 10034.90, cuentaNombre: 'Caja Efectivo Bs (Valencia)' }
  ];

  const grouped = groupMovementsByRateType(dailyMovs, rates);
  assert.equal(grouped.byType.USD.items.length, 3);
  assert.equal(grouped.byType.USD.totalUsd, 150);
  assert.equal(grouped.byType.USD.totalBs, 0);
  assert.equal(grouped.byType.USD.items[1].tasa, 0);
  assert.equal(grouped.byType.USD.items[1].montoBs, 0);
  assert.equal(grouped.byType.ZELLE.totalUsd, 155);
  assert.equal(grouped.byType.ZELLE.totalBs, 0);
  assert.equal(grouped.byType.USDT.totalBs, 0);
  assert.equal(grouped.byType.USDC.totalUsd, 65);
  assert.equal(grouped.byType.USDC.totalBs, 0);
  assert.equal(grouped.byType.KEYSTONE.totalUsd, 70);
  assert.equal(grouped.byType.KEYSTONE.totalBs, 70244.30);
  assert.equal(grouped.totals.count, 11);
  assert.equal(grouped.totals.totalUsd, 620);
  assert.equal(grouped.totals.totalBs, 161406.30);

  const byCaja = summarizeDailyMovementsByCaja(dailyMovs);
  const plaza = byCaja.rows.find(r => r.cuentaNombre === 'BANCO PLAZA');
  const valenciaUsd = byCaja.rows.find(r => r.cuentaNombre === 'Caja Efectivo $ (Valencia)');
  const caracasUsd = byCaja.rows.find(r => r.cuentaNombre === 'Caja Efectivo Caracas $');
  const kontigo = byCaja.rows.find(r => r.cuentaNombre === 'Caja USDC (Kontigo App)');
  const valenciaBs = byCaja.rows.find(r => r.cuentaNombre === 'Caja Efectivo Bs (Valencia)');
  assert.ok(plaza);
  assert.equal(plaza.count, 2);
  assert.equal(plaza.totalUsd, 160);
  assert.equal(plaza.totalBs, 151371.40);
  assert.equal(valenciaUsd.totalUsd, 100);
  assert.equal(valenciaUsd.totalBs, 0);
  assert.equal(caracasUsd.totalUsd, 50);
  assert.equal(caracasUsd.totalBs, 0);
  assert.equal(kontigo.totalUsd, 25);
  assert.equal(kontigo.totalBs, 0);
  assert.equal(valenciaBs.totalUsd, 10);
  assert.equal(valenciaBs.totalBs, 10034.90);
  assert.equal(byCaja.totals.count, 11);
  assert.equal(byCaja.totals.totalUsd, 620);
  assert.equal(byCaja.totals.totalBs, 161406.30);
  console.log('  ✓ 7. Monedas directas en 0 (Tasa/Bs) y resumen por Caja / Banco verificados.');
}

// 8. Reconciliación real de directorio de clientes contra CxC abierta (anti saldoDeudorUsd obsoleto y COBRADA con saldoBs)
{
  const staleClients = [
    { id: 'CLI-1', codigo: 'CLI-1', nombre: 'Repuestos Alpha', rif: 'J-30001111-1', saldoDeudorUsd: 0 },
    { id: 'CLI-2', codigo: 'CLI-2', nombre: 'Lubricantes Beta', rif: 'J-40002222-2', saldoDeudorUsd: 2860 },
    { id: 'CLI-3', codigo: 'CLI-3', nombre: 'Auto Centro Gamma', rif: 'V-19001122-3', saldoDeudorUsd: 10 }
  ];
  const invoices = [
    {
      id: 'F-100',
      factNum: '000100',
      tipoDoc: 'FACTURA',
      clienteId: 'CLI-1',
      clienteRif: 'J300011111', // sin guiones para validar normalización RIF
      fechaEmision: '2026-11-01',
      fechaVencimiento: '2026-11-10', // vencida respecto a 2026-11-15
      totNetoUsd: 271,
      saldoUsd: 271,
      status: 'PENDIENTE'
    },
    {
      id: 'F-101',
      factNum: '000101',
      tipoDoc: 'FACTURA',
      clienteId: 'CLI-2',
      clienteRif: 'J-40002222-2',
      fechaEmision: '2026-11-12',
      fechaVencimiento: '2026-11-27', // al día
      totNetoUsd: 243,
      saldoUsd: 243,
      status: 'PENDIENTE'
    },
    {
      id: 'F-102',
      factNum: '000102',
      tipoDoc: 'FACTURA',
      clienteId: 'CLI-3',
      clienteRif: 'V-19001122-3',
      fechaEmision: '2026-09-10',
      fechaVencimiento: '2026-09-25',
      totNetoUsd: 350,
      saldoUsd: 0,
      saldoBs: 319067, // residual viejo en BS aunque ya cobrada
      status: 'COBRADA'
    }
  ];
  const salesList = [
    // Duplicada de F-100
    { id: 'S-DUP', numeroDoc: '000100', tipoDoc: 'FACTURA', clienteRif: 'J-30001111-1', condicionPago: 'CREDITO', totalUsd: 271, saldoUsd: 271, fechaEmision: '2026-11-01', fechaVencimiento: '2026-11-10' },
    // NE abierta en POS con abono parcial previo
    { id: 'fac-133', numeroDoc: 'NE-000133', tipoDoc: 'NOTA_ENTREGA', clienteId: 'CLI-1', condicionPago: 'CREDITO', totalUsd: 771, saldoUsd: 65, fechaEmision: '2026-11-14', fechaVencimiento: '2026-11-29' }
  ];

  assert.equal(isCxcInvoiceSettled(invoices[2]), true);

  const res = reconcileClientsWithRealCxc({
    clients: staleClients,
    profitInvoices: invoices,
    sales: salesList,
    tasaBcv: 911.62,
    todayKey: '2026-11-15'
  });

  const c1 = res.clients.find(c => c.id === 'CLI-1');
  const c2 = res.clients.find(c => c.id === 'CLI-2');
  const c3 = res.clients.find(c => c.id === 'CLI-3');

  assert.equal(c1.saldoDeudorUsd, 336, 'CLI-1 debe mostrar 271 FAC + 65 NE sin duplicar ni leer 0 obsoleto');
  assert.equal(c1.saldoVencidoUsd, 271);
  assert.equal(c1.saldoAlDiaUsd, 65);
  assert.equal(c1.openDocsCount, 2);

  assert.equal(c2.saldoDeudorUsd, 243, 'CLI-2 debe corregir 2860 obsoleto a 243 real');
  assert.equal(c2.saldoVencidoUsd, 0);
  assert.equal(c2.saldoAlDiaUsd, 243);

  assert.equal(c3.saldoDeudorUsd, 0, 'CLI-3 debe quedar solvente en 0 (ni 10 obsoleto ni F-102 COBRADA con saldoBs)');
  assert.equal(res.totals.conDeudaCount, 2);
  assert.equal(res.totals.totalDeudaUsd, 579);
  assert.equal(res.totals.alDiaUsd, 308);
  assert.equal(res.totals.vencidaUsd, 271);
  assert.equal(res.totals.unmatchedDocsCount, 0);

  // Verificar que consolidateClientReceivables no duplica clientes ya marcados con _saldoSyncedFromCxc
  const consolidated = consolidateClientReceivables({
    clients: res.clients,
    profitInvoices: invoices,
    sales: salesList,
    tasaBcv: 911.62
  });
  const con1 = consolidated.find(r => r.id === 'CLI-1');
  assert.equal(con1.saldoUsd, 336, 'consolidateClientReceivables no debe sumar saldoDeudorUsd local cuando ya viene sincronizado');
  console.log('  ✓ 8. Reconciliación real de Clientes vs CxC (RIF sin guiones, anti COBRADA saldoBs y cero doble-conteo) verificada.');
}

// 9. Emisión de Notas de Crédito y Notas de Débito desde CxC (Factura Fiscal y Nota de Entrega Sin IVA)
{
  const nextNc = getNextCreditDebitNoteCorrelativo(
    'NOTA_CREDITO',
    [{ numeroDoc: 'NC-000004', tipoDoc: 'NOTA_CREDITO' }],
    [{ factNum: '002032', historialCobros: [{ correlativo: 'NC-000007', tipo: 'NOTA_CREDITO' }] }]
  );
  assert.equal(nextNc, 'NC-000008');

  const nextNd = getNextCreditDebitNoteCorrelativo('NOTA_DEBITO', [], [{ factNum: 'ND-000002' }]);
  assert.equal(nextNd, 'ND-000003');

  const fiscalInvoice = {
    id: '002050',
    factNum: '002050',
    tipoDoc: 'FACTURA',
    clienteId: 'CLI-1',
    cliente: 'Inversiones Prueba, C.A.',
    rif: 'J-12345678-9',
    vendedorId: 'VV',
    vendedorNombre: 'Victor Veloz',
    fechaEmisionIso: '2026-11-10',
    fechaVencimientoIso: '2026-11-25',
    diasCredito: 15,
    subtotalUsd: 200,
    ivaUsd: 32,
    montoFacturaUsd: 232,
    abonosUsd: 0,
    restanteUsd: 232,
    tasa: 910,
    historialCobros: []
  };

  // Debe rechazar NC que exceda el saldo pendiente
  assert.throws(
    () => buildCxcCreditDebitNoteResult({
      noteType: 'NOTA_CREDITO',
      affectedDoc: fiscalInvoice,
      noteNum: 'NC-000008',
      fechaEmision: '2026-11-16',
      subtotalUsd: 250,
      aplicaIva: true,
      tasa: 914
    }),
    /no puede superar/i
  );

  // NC de $100 base + 16% IVA ($116 total) rebaja el saldo restante a $116 y genera registro SENIAT
  const ncRes = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_CREDITO',
    affectedDoc: fiscalInvoice,
    noteNum: 'NC-000008',
    fechaEmision: '2026-11-16',
    subtotalUsd: 100,
    aplicaIva: true,
    tasa: 914,
    motivo: 'Descuento comercial post-venta'
  });
  assert.equal(ncRes.updatedAffectedDoc.abonosUsd, 116);
  assert.equal(ncRes.updatedAffectedDoc.saldoUsd, 116);
  assert.equal(ncRes.updatedAffectedDoc.historialCobros[0].formaPago, 'NOTA_CREDITO');
  assert.equal(ncRes.clientDebtDeltaUsd, -116);
  assert.equal(ncRes.fiscalSaleRecord?.tipoDoc, 'NOTA_CREDITO');
  assert.equal(ncRes.fiscalSaleRecord?.documentoAfectado, '002050');
  const pdfNc = generateCreditDebitNotePDF({ docData: ncRes.notePdfData, config: { tasaDolar: 914 } });
  assert.ok(pdfNc.getNumberOfPages() >= 1);

  // Nota de Débito sobre Nota de Entrega debe permanecer 100% Sin IVA y sin Libro de Ventas fiscal
  const neDoc = {
    id: 'NE-000900',
    factNum: 'NE-000900',
    tipoDoc: 'NOTA_ENTREGA',
    clienteId: 'CLI-2',
    cliente: 'Lubricantes Lara',
    rif: 'J-99999999-0',
    montoFacturaUsd: 500,
    abonosUsd: 0,
    restanteUsd: 500,
    tasa: 914
  };
  const ndNeRes = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_DEBITO',
    affectedDoc: neDoc,
    noteNum: 'ND-000003',
    fechaEmision: '2026-11-16',
    subtotalUsd: 40,
    aplicaIva: true,
    tasa: 914,
    motivo: 'Flete adicional'
  });
  assert.equal(ndNeRes.createdDebitDoc?.tipoDoc, 'NOTA_ENTREGA');
  assert.equal(ndNeRes.createdDebitDoc?.ivaUsd, 0);
  assert.equal(ndNeRes.createdDebitDoc?.saldoUsd, 40);
  assert.equal(ndNeRes.clientDebtDeltaUsd, 40);
  assert.equal(ndNeRes.fiscalSaleRecord, null);
  const pdfNd = generateCreditDebitNotePDF({ docData: ndNeRes.notePdfData, config: { tasaDolar: 914 } });
  assert.ok(pdfNd.getNumberOfPages() >= 1);

  console.log('  ✓ 9. Emisión de Notas de Crédito/Débito en CxC (rebaja/cargo, N/E Sin IVA, SENIAT y PDF) verificada.');
}

// 10. Aislamiento de serie histórica (pre-nov 2026 :LEGACY) vs nueva serie 2026-11+ (000018..000021) en CxC
{
  const legacyFac18 = {
    id: 'fac-18',
    factNum: 18,
    tipoDoc: 'FACTURA',
    fechaEmision: '2026-02-11',
    status: 'COBRADA',
    totNetoUsd: 61.99,
    saldoUsd: 0,
    clienteId: 'J400000180',
    clienteNombre: 'Cliente Histórico',
    clienteRif: 'J-400000180'
  };
  const newFac18 = {
    id: '000018',
    numeroDoc: '000018',
    tipoDoc: 'FACTURA',
    fecha: '2026-11-16T15:23:53.957Z',
    fechaEmision: '2026-11-16T15:23:53.957Z',
    estado: 'PENDIENTE',
    condicionPago: '15_DIAS',
    diasCredito: 15,
    totalUsd: 163.4,
    saldoUsd: 163.4,
    clienteId: 'J504938602',
    clienteNombre: 'Repuestos y Servicios melian, C.A',
    clienteRif: 'J-504938602'
  };
  const newNe2226 = {
    id: 'NE-002226',
    numeroDoc: 'NE-002226',
    tipoDoc: 'NOTA_ENTREGA',
    fecha: '2026-11-16T16:21:00.000Z',
    fechaEmision: '2026-11-16T16:21:00.000Z',
    estado: 'PENDIENTE',
    condicionPago: '15_DIAS',
    diasCredito: 15,
    totalUsd: 82,
    saldoUsd: 82,
    clienteId: 'V145489748',
    clienteNombre: 'Francisca Del Carmen Brito Aguilera',
    clienteRif: 'V-145489748'
  };

  assert.equal(getCxcScopedDocKey(legacyFac18, 'FACTURA'), 'FAC:18:LEGACY');
  assert.equal(getCxcScopedDocKey(newFac18, 'FACTURA'), 'FAC:18');
  assert.equal(getCxcScopedDocKey('FAC:18:LEGACY', 'FACTURA'), 'FAC:18:LEGACY');
  assert.notEqual(getCxcScopedDocKey(legacyFac18, 'FACTURA'), getCxcScopedDocKey(newFac18, 'FACTURA'));

  const legacyCol = {
    id: 'cob-2026-02',
    fecha: '2026-02-20',
    anulado: false,
    documentosAfectados: [{ tipoDoc: 'FACT', numDoc: '18', montoCobradoUsd: 61.99 }]
  };
  assert.equal(doesCollectionMatchInvoice(legacyCol, legacyFac18), true);
  assert.equal(doesCollectionMatchInvoice(legacyCol, newFac18), false);

  const consolidated = consolidateClientReceivables({
    clients: [],
    profitInvoices: [legacyFac18],
    sales: [newFac18, newNe2226],
    tasaBcv: 914.02,
    includePendingDocs: true
  });
  const melian = consolidated.find(c => c.rif === 'J-504938602');
  const francisca = consolidated.find(c => c.rif === 'V-145489748');
  assert.ok(melian && melian.saldoUsd === 163.4, '000018 de nov 2026 no debe ser ocultada por fac-18 COBRADA de feb 2026');
  assert.ok(francisca && francisca.saldoUsd === 82, 'NE-002226 pendiente debe reflejarse en CxC');

  console.log('  ✓ 10. Aislamiento serie histórica vs 2026-11+ (000018 y NE-002226) en CxC verificado.');
}

// 11. Tasa USDT en Bolívares (USDT_BS) en Nota de Entrega vs divisa directa Binance (USDT)
{
  assert.equal(normalizeRateType('USDT_BS', { tipoDoc: 'NOTA_ENTREGA' }), 'USDT_BS');
  assert.equal(normalizeRateType('USDT_BS', { tipoDoc: 'FACTURA' }), 'BCV');
  assert.equal(normalizeRateType('BCV_EDITABLE', { tipoDoc: 'FACTURA' }), 'BCV_EDITABLE');
  assert.equal(normalizeRateType('BCV_EDITABLE', { tipoDoc: 'NOTA_ENTREGA' }), 'BCV_EDITABLE');
  assert.equal(isDirectCurrencyRateType('BCV_EDITABLE'), false);
  assert.equal(resolveDefaultRateValue('BCV_EDITABLE', { tasaBcv: 914.02, customRate: 928.50 }), 928.5);
  assert.equal(
    classifyCollectionRateType(
      { tipoDoc: 'FACTURA', factNum: '000671', tipoTasa: 'BCV_EDITABLE', tasa: 928.50, montoUsd: 87, montoBs: 80779.5 },
      { tasaBcv: 914.02, tasaEuro: 1010.56, tasaKeystone: 1010.56 }
    ),
    'BCV_EDITABLE'
  );
  assert.equal(isDirectCurrencyRateType('USDT_BS'), false);
  assert.equal(isDirectCurrencyRateType('USDT'), true);
  assert.equal(
    resolveDefaultRateValue('USDT_BS', { tasaBcv: 914.02, tasaKeystone: 1010.56, tasaEuro: 1010.56, tasaUsdt: 1065.80 }),
    1065.8
  );
  assert.equal(
    classifyCollectionRateType(
      { tipoDoc: 'NOTA_ENTREGA', factNum: 'NE-000133', tipoTasa: 'USDT_BS', tasa: 1065.80, montoUsd: 65, montoBs: 69277 },
      { tasaBcv: 914.02, tasaEuro: 1010.56, tasaKeystone: 1010.56 }
    ),
    'USDT_BS'
  );
  console.log('  ✓ 11. Tasa USDT en Bolívares (USDT_BS) para Nota de Entrega verificada.');
}

console.log('--- TODAS LAS PRUEBAS CXC PASARON AL 100% ---');
