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
  resolveCollectionAppliedAmountForInvoice,
  sumLinkedCollectionsUsdForInvoice,
  classifyCollectionRateType,
  groupMovementsByRateType,
  summarizeDailyMovementsByCaja,
  isCxcCreditOrDebitNoteMovement,
  filterMovementsForDailyCollectionReport,
  resolveCatalogAccountForMovement,
  healCorruptedBankToCajaAccount,
  getNextCreditDebitNoteCorrelativo,
  buildCxcCreditDebitNoteResult,
  getCreditDebitNoteKind,
  isCreditOrDebitNoteDoc
} from '../utils/cxcUtils.js';
import { generateCreditDebitNotePDF, outputCreditDebitNoteDocument } from '../services/pdfReportService.js';
import {
  normalizeRateType,
  isDirectCurrencyRateType,
  resolveDefaultRateValue
} from '../utils/rateClassificationUtils.js';
import {
  isStaticFallbackList,
  getScopedCxcDeleteKeys,
  markCxcDocDeleted,
  isCxcEntryDeleted,
  reconcileCxcTombstonesWithServerDocs,
  saveSupabaseProfitCollection,
  getSupabaseProfitCollections,
  getSupabaseProfitInvoices,
  deleteSupabaseProfitCollection
} from '../services/supabaseService.js';
import {
  getNextCxcMovementCorrelativo,
  getNextInvoiceCorrelativo,
  getNextNotaEntregaCorrelativo,
  isFiscalDocEligible
} from '../services/fiscalService.js';

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

  // NC de $100 base + 16% IVA ($116 total) con N° Control manual rebaja el saldo restante a $116 y genera registro SENIAT
  const ncRes = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_CREDITO',
    affectedDoc: fiscalInvoice,
    noteNum: 'NC-000008',
    numeroControl: '00-001450',
    fechaEmision: '2026-11-16',
    subtotalUsd: 100,
    aplicaIva: true,
    tasa: 914,
    motivo: 'Descuento comercial post-venta'
  });
  assert.equal(ncRes.updatedAffectedDoc.abonosUsd, 116);
  assert.equal(ncRes.updatedAffectedDoc.saldoUsd, 116);
  assert.equal(ncRes.updatedAffectedDoc.historialCobros[0].formaPago, 'NOTA_CREDITO');
  assert.equal(ncRes.updatedAffectedDoc.historialCobros[0].numeroControl, '00-001450');
  assert.equal(ncRes.updatedAffectedDoc.historialCobros[0].subtotalBs, 91400);
  assert.equal(ncRes.updatedAffectedDoc.historialCobros[0].montoBs, 106024);
  assert.equal(ncRes.clientDebtDeltaUsd, -116);
  assert.equal(ncRes.fiscalSaleRecord?.tipoDoc, 'NOTA_CREDITO');
  assert.equal(ncRes.fiscalSaleRecord?.numeroControl, '00-001450');
  assert.equal(ncRes.fiscalSaleRecord?.documentoAfectado, '002050');
  assert.equal(ncRes.notePdfData?.numeroControl, '00-001450');
  assert.equal(ncRes.notePdfData?.totalBs, 106024);
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
  assert.equal(ndNeRes.createdDebitDoc, null);
  assert.equal(ndNeRes.updatedAffectedDoc?.tipoDoc, 'NOTA_ENTREGA');
  assert.equal(ndNeRes.updatedAffectedDoc?.ivaUsd, 0);
  assert.equal(ndNeRes.updatedAffectedDoc?.totBrutoUsd, 540);
  assert.equal(ndNeRes.updatedAffectedDoc?.totNetoUsd, 540);
  assert.equal(ndNeRes.updatedAffectedDoc?.saldoUsd, 540);
  assert.equal(ndNeRes.updatedAffectedDoc?.historialCobros[0]?.formaPago, 'NOTA_DEBITO');
  assert.equal(ndNeRes.clientDebtDeltaUsd, 40);
  assert.equal(ndNeRes.fiscalSaleRecord, null);
  const pdfNd = generateCreditDebitNotePDF({ docData: ndNeRes.notePdfData, config: { tasaDolar: 914 } });
  assert.ok(pdfNd.getNumberOfPages() >= 1);

  // ND fiscal con N° Control manual debe sumar al saldo de la factura afectada, reflejar montos en USD y Bs. y conservar numeroControl
  const ndFiscalRes = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_DEBITO',
    affectedDoc: fiscalInvoice,
    noteNum: 'ND-000010',
    numeroControl: '00-009876',
    fechaEmision: '2026-11-17',
    subtotalUsd: 75,
    aplicaIva: true,
    tasa: 915.74,
    motivo: 'Diferencial cambiario'
  });
  assert.equal(ndFiscalRes.createdDebitDoc, null);
  assert.equal(ndFiscalRes.updatedAffectedDoc?.totBrutoUsd, 275);
  assert.equal(ndFiscalRes.updatedAffectedDoc?.totNetoUsd, 319);
  assert.equal(ndFiscalRes.updatedAffectedDoc?.saldoUsd, 319);
  assert.equal(ndFiscalRes.updatedAffectedDoc?.historialCobros[0]?.numeroControl, '00-009876');
  assert.equal(ndFiscalRes.updatedAffectedDoc?.historialCobros[0]?.montoBs, 79669.38);
  assert.equal(ndFiscalRes.fiscalSaleRecord?.numeroControl, '00-009876');
  assert.equal(ndFiscalRes.notePdfData?.numeroControl, '00-009876');
  assert.equal(ndFiscalRes.isFiscal, true);

  // Selector explícito: permitir emitir Nota No Fiscal sobre Factura (sin IVA y sin Libro SENIAT)
  // y permitir emitir Nota Fiscal sobre Nota de Entrega (con IVA y Libro SENIAT)
  const ncOverrideNoFiscal = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_CREDITO',
    affectedDoc: fiscalInvoice,
    noteNum: 'NC-000099',
    isFiscal: false,
    fechaEmision: '2026-11-17',
    subtotalUsd: 50,
    aplicaIva: true,
    tasa: 915.74,
    motivo: 'Ajuste interno no fiscal'
  });
  assert.equal(ncOverrideNoFiscal.isFiscal, false);
  assert.equal(ncOverrideNoFiscal.notePdfData?.isFiscal, false);
  assert.equal(ncOverrideNoFiscal.notePdfData?.ivaUsd, 0);
  assert.equal(ncOverrideNoFiscal.fiscalSaleRecord, null);

  const ndOverrideFiscalOnNe = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_DEBITO',
    affectedDoc: neDoc,
    noteNum: 'ND-000099',
    numeroControl: '00-001134',
    isFiscal: true,
    fechaEmision: '2026-11-17',
    subtotalUsd: 100,
    aplicaIva: true,
    tasa: 915.74,
    motivo: 'Recargo fiscalizado'
  });
  assert.equal(ndOverrideFiscalOnNe.isFiscal, true);
  assert.equal(ndOverrideFiscalOnNe.createdDebitDoc, null);
  assert.equal(ndOverrideFiscalOnNe.updatedAffectedDoc?.totNetoUsd, 616);
  assert.equal(ndOverrideFiscalOnNe.updatedAffectedDoc?.saldoUsd, 616);
  assert.equal(ndOverrideFiscalOnNe.notePdfData?.ivaUsd, 16);
  assert.equal(ndOverrideFiscalOnNe.fiscalSaleRecord?.numeroControl, '00-001134');

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

// 12. Edición de datos del cobro y eliminación con tombstone persistente en profit_collections
{
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('offline-test'); };
    const colId = `cob-test-edit-del-${Date.now()}`;
    const createdCol = await saveSupabaseProfitCollection({
      id: colId,
      cobNum: '004999',
      correlativo: '004999',
      fecha: '2026-11-17T14:00:00.000Z',
      clienteId: 'CLI-TEST',
      clienteNombre: 'Cliente Test Edit',
      vendedorId: 'V1',
      vendedorNombre: 'Vendedor Uno',
      cobradorId: 'V1',
      cobradorNombre: 'Vendedor Uno',
      montoUsd: 100,
      montoBs: 91574,
      tasa: 915.74,
      tipoTasa: 'BCV',
      monedaPago: 'BS',
      cuentaId: 'BANCO-BDV',
      cuentaNombre: 'Banco de Venezuela',
      formaPago: 'TRANSFERENCIA',
      referencia: 'REF-100',
      descrip: 'Abono inicial',
      documentosAfectados: [{ numDoc: '002093', tipoDoc: 'FACTURA', montoCobradoUsd: 100, montoCobrado: 91574 }],
      formasPago: [{ formaPago: 'TRANSFERENCIA', montoUsd: 100, montoBs: 91574, tasa: 915.74, tipoTasa: 'BCV', referencia: 'REF-100' }]
    });

    assert.equal(createdCol.correlativo, '004999');
    assert.equal(createdCol.formaPago, 'TRANSFERENCIA');
    assert.equal(createdCol.referencia, 'REF-100');

    const updatedCol = await saveSupabaseProfitCollection({
      ...createdCol,
      formaPago: 'ZELLE',
      tipoTasa: 'ZELLE',
      tasa: 1,
      tasaPago: 1,
      monedaPago: 'USD',
      montoUsd: 120,
      montoBs: 0,
      cuentaId: 'CAJA-ZELLE',
      cuentaNombre: 'Cuenta Zelle USD',
      referencia: 'ZELLE-8899',
      descrip: 'Datos corregidos',
      formasPago: [{ formaPago: 'ZELLE', moneda: 'USD', montoUsd: 120, montoBs: 0, tasa: 1, tipoTasa: 'ZELLE', referencia: 'ZELLE-8899' }],
      documentosAfectados: [{ numDoc: '002093', tipoDoc: 'FACTURA', montoCobradoUsd: 120, montoCobrado: 120 }],
      _localEditedAt: new Date().toISOString()
    });

    assert.equal(updatedCol.formaPago, 'ZELLE');
    assert.equal(updatedCol.montoUsd, 120);
    assert.equal(updatedCol.montoBs, 0);
    assert.equal(updatedCol.referencia, 'ZELLE-8899');
    assert.equal(updatedCol.cuentaNombre, 'Cuenta Zelle USD');

    await deleteSupabaseProfitCollection(colId);
    const rawDeleted = localStorage.getItem('signum_deleted_cxc_collections_v1');
    const parsedDeleted = rawDeleted ? JSON.parse(rawDeleted) : [];
    assert.ok(parsedDeleted.includes(colId), 'El cobro eliminado debe quedar marcado en tombstones locales');

    const collectionsAfterDelete = await getSupabaseProfitCollections();
    assert.equal(
      collectionsAfterDelete.some((c) => String(c.id) === colId),
      false,
      'Un cobro eliminado no debe reaparecer al consultar getSupabaseProfitCollections'
    );
    console.log('  ✓ 12. Edición de datos de cobro y eliminación con tombstone verificados.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 13. Auto-limpieza de tombstones viejos en localStorage cuando el servidor central devuelve el documento activo
{
  localStorage.clear();
  const staleNeDoc = { id: 'NE-002232', factNum: '002232', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-11-18T12:34:06.000Z' };
  const inFlightFacDoc = { id: '000041', factNum: '000041', tipoDoc: 'FACTURA', fechaEmision: '2026-11-18T12:45:44.583Z' };

  markCxcDocDeleted(staleNeDoc);
  markCxcDocDeleted(inFlightFacDoc);

  // Simular que el tombstone de NE-002232 quedó viejo (> 35s) en localStorage mientras que 000041 acaba de borrarse en vuelo
  const rawMeta = JSON.parse(localStorage.getItem('signum_cxc_deleted_meta_v1') || '{}');
  for (const k of getScopedCxcDeleteKeys(staleNeDoc)) {
    if (rawMeta[k]) rawMeta[k].deletedAt = Date.now() - 120000;
  }
  localStorage.setItem('signum_cxc_deleted_meta_v1', JSON.stringify(rawMeta));

  const reconciledSet = reconcileCxcTombstonesWithServerDocs([staleNeDoc, inFlightFacDoc]);
  assert.equal(isCxcEntryDeleted(staleNeDoc, reconciledSet), false, 'Tombstone viejo de documento que sigue en servidor debe limpiarse automáticamente');
  assert.equal(isCxcEntryDeleted(inFlightFacDoc, reconciledSet), true, 'Tombstone recién emitido (<35s en vuelo) debe mantenerse activo');
  console.log('  ✓ 13. Auto-limpieza de caché/tombstones frente al servidor central verificada.');
}

// 14. Regresión: profit_collections sin correlativo explícito ("" o ausente) deben resolver cobNum y no caer en #S/N
{
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('offline-test'); };
    localStorage.clear();

    const col = await saveSupabaseProfitCollection({
      id: 'cob-mov-004149-test',
      cobNum: '004149',
      correlativo: '',
      fecha: '2026-11-16',
      clienteId: 'V07238603',
      clienteNombre: 'Hernann Sanchez Ojeda',
      montoUsd: 400,
      montoBs: 403736,
      tasa: 1009.34
    });
    assert.equal(col.correlativo, '004149', 'saveSupabaseProfitCollection debe heredar cobNum si correlativo viene vacío');

    // Simular registro legacy en cache local con correlativo: "" y solo cob_num/cobNum
    localStorage.setItem('signum_cxc_collections_v1', JSON.stringify([
      {
        id: 'cob-mov-004151-legacy',
        cob_num: '004151',
        cobNum: '004151',
        correlativo: '',
        fec_cob: '2026-11-16',
        monto_usd: 779,
        monto_bs: 787226.24,
        tasa: 1010.56
      }
    ]));
    const loadedCols = await getSupabaseProfitCollections();
    const legacyCol = loadedCols.find((c) => c.id === 'cob-mov-004151-legacy');
    assert.ok(legacyCol, 'Debe cargar la cobranza legacy desde cache/fallback');
    assert.equal(legacyCol.correlativo, '004151', 'getSupabaseProfitCollections no debe devolver correlativo vacío si existe cobNum/cob_num');

    const nextMovCorr = getNextCxcMovementCorrelativo(
      [{ id: 'c1', correlativo: '', cobNum: '004151', fecha: '2026-11-16' }],
      [{ factNum: '002093', historialCobros: [{ correlativo: '', cobNum: '004152', fecha: '2026-11-16' }] }]
    );
    assert.equal(nextMovCorr, '004153', 'getNextCxcMovementCorrelativo debe detectar cobNum cuando correlativo es ""');
    console.log('  ✓ 14. Regresión de correlativo vacío -> cobNum (anti-duplicado #S/N) verificada.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 15. Regresión: NC/ND no deben generar facturas fantasma ni alterar correlativos ni duplicar deuda al saldarse
{
  localStorage.clear();
  const baseInvoice = {
    id: '002149',
    factNum: '002149',
    tipoDoc: 'FACTURA',
    clienteId: 'V257070898',
    cliente: 'Oscar Alberto Cabrera Rodriguez',
    rif: 'V-25707089-8',
    vendedorId: 'KB',
    vendedorNombre: 'Katherine Becerra',
    fechaEmision: '2026-11-18',
    montoFacturaUsd: 92,
    abonosUsd: 0,
    restanteUsd: 92,
    tasa: 917.77,
    historialCobros: []
  };

  const ncRes = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_CREDITO',
    affectedDoc: baseInvoice,
    noteNum: 'NC-000012',
    fechaEmision: '2026-11-19',
    subtotalUsd: 11.21,
    aplicaIva: false,
    tasa: 917.77,
    motivo: 'Descuento acordado'
  });

  // Fiscal NC/ND siempre aplica IVA 16% por defecto y conserva P. Unit === Base Imponible + Cobrador
  assert.equal(ncRes.notePdfData.subtotalUsd, 11.21);
  assert.equal(ncRes.notePdfData.ivaUsd, 1.79);
  assert.equal(ncRes.notePdfData.totalUsd, 13);
  assert.equal(ncRes.notePdfData.items[0].precioUsd, 11.21);
  assert.equal(ncRes.notePdfData.cobradorNombre, 'Katherine Becerra');
  assert.equal(ncRes.updatedAffectedDoc.historialCobros[0].cobradorNombre, 'Katherine Becerra');

  const formaLibreNc = outputCreditDebitNoteDocument({
    docData: ncRes.notePdfData,
    config: { tasaDolar: 917.77 },
    currentUser: { nombre: 'Edson Designer' },
    autoPrint: false
  });
  const flStream = (formaLibreNc.internal.pages[1] || []).join('\n');
  assert.ok(flStream.includes('Cobrador: Katherine Becerra'), 'El recibo NC/ND debe mostrar Cobrador asignado a la Factura');
  assert.ok(flStream.includes('Emisor / Resp.: Edson Designer'), 'El recibo NC/ND debe mostrar Emisor / Resp.');
  assert.ok(flStream.includes('11.21'), 'P. Unitario y Base Imponible deben coincidir en $11.21');

  // Incluso al reimprimir un registro fiscal previo sin IVA desglosado ($13 total), Forma Libre debe alinear P. Unitario ($11.21) + IVA (16%)
  const legacyReprintedFl = outputCreditDebitNoteDocument({
    docData: {
      tipoDoc: 'NOTA_CREDITO',
      isFiscal: true,
      numeroDoc: 'NC-000001',
      numeroControl: '00-000188',
      documentoAfectado: '2149',
      clienteNombre: 'Oscar Alberto Cabrera Rodriguez',
      clienteRif: 'V-25707089-8',
      cobradorNombre: 'Katherine Becerra',
      tasaDolar: 917.77,
      subtotalUsd: 13,
      ivaUsd: 0,
      totalUsd: 13
    },
    config: { tasaDolar: 917.77 },
    currentUser: { nombre: 'Edson Designer' },
    autoPrint: false
  });
  const legacyFlStream = (legacyReprintedFl.internal.pages[1] || []).join('\n');
  assert.ok(legacyFlStream.includes('11.21'), 'Reimpresión fiscal debe alinear P. Unitario a Base Imponible ($11.21)');
  assert.ok(legacyFlStream.includes('Cobrador: Katherine Becerra'), 'Reimpresión fiscal debe mostrar Cobrador de la factura');

  const ndRes = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_DEBITO',
    affectedDoc: baseInvoice,
    noteNum: 'ND-000015',
    fechaEmision: '2026-11-19',
    subtotalUsd: 25,
    aplicaIva: true,
    tasa: 917.77,
    motivo: 'Diferencial cambiario'
  });

  const ndNeRes = buildCxcCreditDebitNoteResult({
    noteType: 'NOTA_DEBITO',
    affectedDoc: { ...baseInvoice, factNum: 'NE-000010', tipoDoc: 'NOTA_ENTREGA', id: 'NE-000010' },
    noteNum: 'ND-000016',
    isFiscal: false,
    fechaEmision: '2026-11-19',
    subtotalUsd: 30,
    aplicaIva: false,
    tasa: 917.77
  });

  // Detección uniforme de NC/ND tanto en registro fiscal como en historialCobros del documento afectado
  assert.equal(getCreditDebitNoteKind(ncRes.fiscalSaleRecord), 'NOTA_CREDITO');
  assert.equal(getCreditDebitNoteKind(ndRes.updatedAffectedDoc?.historialCobros?.[0]), 'NOTA_DEBITO');
  assert.equal(getCreditDebitNoteKind(ndRes.fiscalSaleRecord), 'NOTA_DEBITO');
  assert.equal(getCreditDebitNoteKind(ndNeRes.updatedAffectedDoc?.historialCobros?.[0]), 'NOTA_DEBITO');
  assert.equal(isCreditOrDebitNoteDoc(ndRes.fiscalSaleRecord), true);
  assert.equal(isCreditOrDebitNoteDoc(baseInvoice), false);

  // Correlativos de Factura, NE y Movimientos CxC no deben contaminarse por NC/ND
  localStorage.setItem('sm_invoice_correlativo_zero_init', 'true');
  localStorage.setItem('sm_invoice_correlativo_seq', '1');
  localStorage.setItem('sm_invoice_correlativo_force', '1');
  const nextFac = getNextInvoiceCorrelativo(
    [ncRes.fiscalSaleRecord, ndRes.fiscalSaleRecord],
    [ndRes.createdDebitDoc, ndNeRes.createdDebitDoc]
  );
  assert.equal(nextFac, '000001', 'NC/ND no deben alterar el correlativo de Facturas');

  const nextNe = getNextNotaEntregaCorrelativo(
    [],
    [{ id: 'NE-000002', factNum: 'NE-000002', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-11-19' }, ndNeRes.createdDebitDoc],
    'NE'
  );
  assert.equal(nextNe, 'NE-000003', 'ND sobre NE (NE-ND-000016) no debe contaminar correlativo NE');

  const nextMov = getNextCxcMovementCorrelativo(
    [{ id: 'c1', correlativo: '000001', cobNum: '000001', fecha: '2026-11-19' }],
    [ncRes.updatedAffectedDoc]
  );
  assert.equal(nextMov, '000002', 'Nota de Crédito NC-000012 en historialCobros no debe consumir correlativos de cobros');

  // Elegibilidad Libro de Ventas SENIAT: admite registro fiscal NOTA_DEBITO y la factura fiscal afectada
  assert.equal(isFiscalDocEligible(ndRes.fiscalSaleRecord), true);
  assert.equal(isFiscalDocEligible(ncRes.fiscalSaleRecord), true);
  assert.equal(isFiscalDocEligible(ndRes.updatedAffectedDoc), true);

  // Cuando la factura afectada (con ND sumada) ya fue saldada en profit_invoices, su registro fiscal paralelo en sales NO debe resucitar deuda al cliente
  const settledNdDoc = {
    ...ndRes.updatedAffectedDoc,
    abonosUsd: ndRes.updatedAffectedDoc.totNetoUsd,
    saldoUsd: 0,
    status: 'COBRADA'
  };
  const reconciled = reconcileClientsWithRealCxc({
    clients: [{ id: 'V257070898', nombre: 'Oscar Alberto Cabrera Rodriguez', rif: 'V-25707089-8', saldoDeudorUsd: 999 }],
    profitInvoices: [settledNdDoc],
    sales: [ndRes.fiscalSaleRecord],
    tasaBcv: 917.77
  });
  assert.equal(reconciled.clients[0].saldoDeudorUsd, 0, 'Una ND saldada en CxC no debe reaparecer como deuda desde fiscalSaleRecord en sales');

  console.log('  ✓ 15. Regresión NC/ND (correlativos aislados, anti-factura fantasma, anti-deuda duplicada) verificada.');
}

// 16. Regresión: fallos de red/timeout deben marcar fallback estático para no sobrescribir estado vivo
{
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('timeout-simulado'); };
    localStorage.clear();

    assert.equal(isStaticFallbackList([]), false);
    const colsFallback = await getSupabaseProfitCollections();
    assert.equal(isStaticFallbackList(colsFallback), true, 'getSupabaseProfitCollections offline/timeout debe marcar __isStaticFallback');
    const invsFallback = await getSupabaseProfitInvoices();
    assert.equal(isStaticFallbackList(invsFallback), true, 'getSupabaseProfitInvoices offline/timeout debe marcar __isStaticFallback');
    console.log('  ✓ 16. Detección isStaticFallbackList (anti-sobrescritura por timeout) verificada.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 17. Reporte Diario Impreso de Abonos CxC: excluir Notas de Crédito / Débito de detalle, resumen de tasas y cajas sin sumar a totales
{
  const mixedMovs = [
    {
      id: 'nc-1',
      correlativo: 'NC-000343',
      factNum: '2156',
      tipoDoc: 'NOTA_CREDITO',
      formaPago: 'NOTA_CREDITO',
      accountType: 'NOTA_CREDITO',
      cuentaId: 'NC-FISCAL',
      cuentaNombre: 'N/CR #NC-000343',
      referencia: 'NC-000343',
      tipoTasa: 'BCV',
      tasa: 917.77,
      montoUsd: 36.01,
      montoBs: 33048.90
    },
    {
      id: 'nc-2',
      correlativo: '000001',
      factNum: '2149',
      tipoDoc: 'FACTURA',
      formaPago: 'NOTA_CREDITO',
      accountType: 'NOTA_CREDITO',
      cuentaId: 'NC-FISCAL',
      cuentaNombre: 'N/CR #NC-000001',
      referencia: 'NC-000001',
      tipoTasa: 'BCV',
      tasa: 917.77,
      montoUsd: 13.0,
      montoBs: 11931.01
    },
    {
      id: 'nd-1',
      correlativo: 'ND-000002',
      factNum: 'ND-000002',
      tipoDoc: 'NOTA_DEBITO',
      formaPago: 'NOTA_DEBITO',
      accountType: 'NOTA_DEBITO',
      cuentaId: 'ND-FISCAL',
      cuentaNombre: 'N/DB #ND-000002',
      referencia: 'ND-000002',
      tipoTasa: 'BCV',
      tasa: 917.77,
      montoUsd: 25.0,
      montoBs: 22944.25
    },
    {
      id: 'pay-1',
      correlativo: '004200',
      factNum: '002210',
      tipoDoc: 'NOTA_ENTREGA',
      formaPago: 'TRANSFERENCIA',
      accountType: 'BANCO',
      cuentaId: 'cta-vzla',
      cuentaNombre: 'BANCO DE VENEZUELA (01020235320000648080)',
      referencia: '881234',
      tipoTasa: 'BCV_EDITABLE',
      tasa: 918.0,
      montoUsd: 100.0,
      montoBs: 91800.0
    },
    {
      id: 'pay-2',
      correlativo: '004201',
      factNum: '002211',
      tipoDoc: 'NOTA_ENTREGA',
      formaPago: 'EFECTIVO',
      accountType: 'CAJA',
      cuentaId: 'caja-usd',
      cuentaNombre: 'Caja Efectivo $ (Valencia)',
      referencia: '',
      tipoTasa: 'USD',
      monedaPago: 'USD',
      isDirectCurrency: true,
      tasa: 0,
      montoUsd: 50.0,
      montoBs: 0
    }
  ];

  assert.equal(isCxcCreditOrDebitNoteMovement(mixedMovs[0]), true);
  assert.equal(isCxcCreditOrDebitNoteMovement(mixedMovs[1]), true);
  assert.equal(isCxcCreditOrDebitNoteMovement(mixedMovs[2]), true);
  assert.equal(isCxcCreditOrDebitNoteMovement(mixedMovs[3]), false);
  assert.equal(isCxcCreditOrDebitNoteMovement(mixedMovs[4]), false);

  const printable = filterMovementsForDailyCollectionReport(mixedMovs);
  assert.equal(printable.length, 2, 'Solo deben permanecer abonos reales, sin Notas de Crédito ni Débito');

  const rateBk = groupMovementsByRateType(printable, { tasaBcv: 917.77 });
  const cajaBk = summarizeDailyMovementsByCaja(printable);

  assert.equal(rateBk.nonEmptyGroups.some(g => g.id === 'BCV'), false, 'Sin cobros BCV reales, Tasa BCV no debe aparecer en nonEmptyGroups');
  assert.equal(rateBk.totals.count, 2);
  assert.equal(rateBk.totals.totalUsd, 150.0, 'Total USD de tasas no debe sumar NC ni ND');
  assert.equal(rateBk.totals.totalBs, 91800.0, 'Total Bs de tasas no debe sumar NC ni ND');

  assert.equal(cajaBk.rows.some(r => r.cuentaNombre.includes('N/CR') || r.cuentaNombre.includes('N/DB')), false, 'Resumen por Caja/Banco no debe mostrar N/CR ni N/DB');
  assert.equal(cajaBk.totals.count, 2);
  assert.equal(cajaBk.totals.totalUsd, 150.0, 'Total USD por cajas debe cuadrar exactamente sin NC ni ND');
  assert.equal(cajaBk.totals.totalBs, 91800.0, 'Total Bs por cajas debe cuadrar exactamente sin NC ni ND');

  // Día compuesto exclusivamente por NC/ND debe arrojar totales 0 y 0 renglones activos
  const onlyNotesPrintable = filterMovementsForDailyCollectionReport(mixedMovs.slice(0, 3));
  assert.equal(onlyNotesPrintable.length, 0);
  const emptyRateBk = groupMovementsByRateType(onlyNotesPrintable, { tasaBcv: 917.77 });
  const emptyCajaBk = summarizeDailyMovementsByCaja(onlyNotesPrintable);
  assert.equal(emptyRateBk.nonEmptyGroups.length, 0);
  assert.equal(emptyRateBk.totals.totalUsd, 0);
  assert.equal(emptyRateBk.totals.totalBs, 0);
  assert.equal(emptyCajaBk.rows.length, 0);
  assert.equal(emptyCajaBk.totals.totalUsd, 0);
  assert.equal(emptyCajaBk.totals.totalBs, 0);

  console.log('  ✓ 17. Reporte diario impreso CxC (exclusión NC/ND, sin renglones vacíos, cuadre exacto) verificado.');
}

// 18. Regresión anti-colisión BANCO:01/04 <-> caja-01/04 y cuadre exacto Divisa Directa <-> Caja
{
  const catalog = [
    { key: 'CAJA:caja-01', id: 'caja-01', rawId: 'caja-01', accountType: 'CAJA', nombre: 'Caja Efectivo $ (Valencia)', moneda: 'USD' },
    { key: 'CAJA:caja-04', id: 'caja-04', rawId: 'caja-04', accountType: 'CAJA', nombre: 'Caja Zelle', moneda: 'USD' },
    { key: 'CAJA:caja-05', id: 'caja-05', rawId: 'caja-05', accountType: 'CAJA', nombre: 'Caja USDT (Binance)', moneda: 'USDT' },
    { key: 'BANCO:01', id: 'CTA-01', rawId: '01', accountType: 'BANCO', nombre: 'BANCO MERCANTIL (01050027311027479197)', moneda: 'BS' },
    { key: 'BANCO:04', id: 'CTA-04', rawId: '04', accountType: 'BANCO', nombre: 'BANCO PLAZA (01380015460150651694)', moneda: 'BS' }
  ];

  // Un banco con cuentaId '01' o '04' jamás puede resolver a caja-01 o caja-04
  const resolvedMercantil = resolveCatalogAccountForMovement({
    cuentaKey: 'BANCO:01',
    cuentaId: '01',
    cuentaNombre: 'BANCO MERCANTIL (01050027311027479197)',
    accountType: 'BANCO'
  }, catalog);
  assert.equal(resolvedMercantil?.key, 'BANCO:01');

  const resolvedPlaza = resolveCatalogAccountForMovement({
    cuentaId: '04',
    cuentaNombre: 'BANCO PLAZA (01380015460150651694)',
    accountType: 'BANCO'
  }, catalog);
  assert.equal(resolvedPlaza?.key, 'BANCO:04');

  const resolvedCajaUsd = resolveCatalogAccountForMovement({
    cuentaId: 'caja-01',
    cuentaNombre: 'Caja Efectivo $ (Valencia)',
    accountType: 'CAJA'
  }, catalog);
  assert.equal(resolvedCajaUsd?.key, 'CAJA:caja-01');

  // Auto-reparación de registro histórico corrupto BANCO:01 -> caja-01 con Bs > 0
  const corruptedMercantil = {
    correlativo: '004145',
    cuentaKey: 'BANCO:01',
    cuentaId: 'caja-01',
    cuentaNombre: 'Caja Efectivo $ (Valencia)',
    accountType: 'CAJA',
    tipoTasa: 'PERSONALIZADA',
    monedaPago: 'BS',
    montoUsd: 123,
    montoBs: 112874.24
  };
  const healed = healCorruptedBankToCajaAccount(corruptedMercantil, catalog);
  assert.equal(healed.cuentaId, '01');
  assert.equal(healed.accountType, 'BANCO');
  assert.equal(healed.cuentaNombre, 'BANCO MERCANTIL (01050027311027479197)');

  // Registro con tipoTasa='USD' guardado en Caja USDT (Binance) debe alinear a 'USDT'
  const usdtMislabelled = {
    tipoDoc: 'NOTA_ENTREGA',
    factNum: '2022',
    tipoTasa: 'USD',
    monedaPago: 'USD',
    cuentaId: 'caja-05',
    cuentaNombre: 'Caja USDT (Binance)',
    montoUsd: 30,
    montoBs: 0
  };
  assert.equal(classifyCollectionRateType(usdtMislabelled, { tasaBcv: 917.77 }), 'USDT');

  // Cobro genuino en Caja Efectivo $ (Valencia) jamás puede quedar bajo tasa Bs ni con montoBs > 0
  const usdCajaWithWrongRate = {
    tipoDoc: 'NOTA_ENTREGA',
    factNum: '2125',
    tipoTasa: 'PERSONALIZADA',
    cuentaId: 'caja-01',
    cuentaNombre: 'Caja Efectivo $ (Valencia)',
    montoUsd: 50,
    montoBs: 45888.5
  };
  assert.equal(classifyCollectionRateType(usdCajaWithWrongRate, { tasaBcv: 917.77 }), 'USD');
  const rateCheck = groupMovementsByRateType([healed, usdtMislabelled, usdCajaWithWrongRate], { tasaBcv: 917.77 });
  const cajaCheck = summarizeDailyMovementsByCaja([healed, usdtMislabelled, usdCajaWithWrongRate]);
  assert.equal(rateCheck.byType.USD.totalUsd, 50);
  assert.equal(rateCheck.byType.USD.totalBs, 0);
  assert.equal(rateCheck.byType.USDT.totalUsd, 30);
  assert.equal(rateCheck.byType.PERSONALIZADA.totalUsd, 123);
  assert.equal(cajaCheck.rows.find(r => r.cuentaNombre === 'Caja Efectivo $ (Valencia)')?.totalUsd, 50);
  assert.equal(cajaCheck.rows.find(r => r.cuentaNombre === 'Caja Efectivo $ (Valencia)')?.totalBs, 0);
  assert.equal(cajaCheck.rows.find(r => r.cuentaNombre === 'Caja USDT (Binance)')?.totalUsd, 30);
  assert.equal(cajaCheck.rows.find(r => r.cuentaNombre === 'BANCO MERCANTIL (01050027311027479197)')?.totalUsd, 123);
  assert.equal(rateCheck.totals.totalUsd, cajaCheck.totals.totalUsd);
  assert.equal(rateCheck.totals.totalBs, cajaCheck.totals.totalBs);

  console.log('  ✓ 18. Anti-colisión BANCO<->CAJA, auto-reparación y cuadre exacto Divisa Directa <-> Caja verificados.');
}

// 19. Reconciliación de cobros vinculados (profit_collections + historialCobros) cuando abonosUsd del documento quedó desactualizado
{
  const neDoc = {
    id: 'NE-000501',
    factNum: 'NE-000501',
    tipoDoc: 'NOTA_ENTREGA',
    totNetoUsd: 560,
    abonosUsd: 300,
    saldoUsd: 260,
    historialCobros: [
      { id: 'hc-57', cobNum: '57', montoUsd: 300, tasa: 914.02 }
    ]
  };
  const cols = [
    {
      id: 'cob-98',
      cobNum: '98',
      fecha: '2026-11-24',
      montoUsd: 260,
      montoBs: 0,
      tasa: 1,
      documentosAfectados: [{ numDoc: 'NE-000501', tipoDoc: 'N/E', montoCobradoUsd: 260, montoCobrado: 0 }]
    },
    {
      id: 'cob-57',
      cobNum: '57',
      fecha: '2026-11-16',
      montoUsd: 300,
      montoBs: 274206,
      tasa: 914.02,
      documentosAfectados: [{ numDoc: 'NE-000501', tipoDoc: 'N/E', montoCobradoUsd: 300, montoCobrado: 274206 }]
    },
    {
      id: 'cob-multi',
      cobNum: '99',
      fecha: '2026-11-25',
      montoUsd: 500,
      tasa: 1,
      documentosAfectados: [
        { numDoc: 'NE-000500', tipoDoc: 'N/E', montoCobradoUsd: 400, montoCobrado: 0 },
        { numDoc: 'NE-000502', tipoDoc: 'N/E', montoCobradoUsd: 100, montoCobrado: 0 }
      ]
    }
  ];

  assert.equal(sumLinkedCollectionsUsdForInvoice(cols, neDoc, 914.02), 560);
  const multiMatch = resolveCollectionAppliedAmountForInvoice(cols[2], { factNum: 'NE-000502', tipoDoc: 'NOTA_ENTREGA' }, 914.02);
  assert.equal(multiMatch.usd, 100);
  console.log('  ✓ 19. Reconciliación de cobros vinculados (560 USD sin duplicar cobNum 57) y cobros multi-documento verificados.');
}

console.log('--- TODAS LAS PRUEBAS CXC PASARON AL 100% ---');
