import assert from 'node:assert/strict';

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
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({
      href: '',
      download: '',
      style: {},
      click: () => {},
      setAttribute: () => {}
    }),
    body: { appendChild: () => {}, removeChild: () => {} }
  };
}
if (typeof globalThis.URL === 'undefined') {
  globalThis.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
  };
}

import {
  getAllowedRateTypesForDoc,
  isFiscalDocumentForRatePolicy,
  normalizeRateType,
  resolveDefaultRateValue,
  resolveEffectiveRateNumber,
  resolveRecordRateType,
  summarizeByRateClassification
} from '../utils/rateClassificationUtils.js';
import { normalizeCxcRateType } from '../utils/cxcUtils.js';
import { saveSale, addCashMovement, getSales, getCashMovements } from '../services/storageService.js';
import { buildProfitInvoicePayloadFromSale } from '../services/supabaseService.js';
import {
  generateAccountsReceivablePDF,
  generateAccountsPayablePDF,
  generateCollectionReceiptPDF,
  generateThirdPartyStatementPDF
} from '../services/pdfReportService.js';

console.log('--- INICIANDO PRUEBAS DE CLASIFICACIÓN E INMUTABILIDAD DE TASAS ---');

// 1. Reglas estrictas por tipo de documento (Fiscal vs Nota de Entrega)
{
  assert.equal(isFiscalDocumentForRatePolicy('FACTURA'), true);
  assert.equal(isFiscalDocumentForRatePolicy('FACT'), true);
  assert.equal(isFiscalDocumentForRatePolicy('NOTA_ENTREGA'), false);
  assert.equal(isFiscalDocumentForRatePolicy('NE'), false);

  assert.deepEqual(getAllowedRateTypesForDoc('FACTURA'), ['BCV', 'USD']);
  assert.deepEqual(getAllowedRateTypesForDoc('FACT'), ['BCV', 'USD']);
  assert.deepEqual(getAllowedRateTypesForDoc('NOTA_ENTREGA'), ['BCV', 'KEYSTONE', 'EDITABLE', 'USD']);
  assert.deepEqual(
    getAllowedRateTypesForDoc('NOTA_ENTREGA', { includeEuro: true }),
    ['BCV', 'EURO', 'KEYSTONE', 'EDITABLE', 'USD']
  );

  // Coerción obligatoria: documento fiscal jamás permite tasas paralelas/manuales
  assert.equal(normalizeRateType('KEYSTONE', { tipoDoc: 'FACTURA' }), 'BCV');
  assert.equal(normalizeRateType('EDITABLE', { tipoDoc: 'FACT' }), 'BCV');
  assert.equal(normalizeRateType('USD', { tipoDoc: 'FACTURA' }), 'USD');
  assert.equal(normalizeRateType('EDITABLE', { tipoDoc: 'NOTA_ENTREGA' }), 'EDITABLE');
  assert.equal(normalizeCxcRateType('EDITABLE'), 'PERSONALIZADA');

  assert.equal(resolveDefaultRateValue('BCV', { tasaBcv: 900, tasaKeystone: 930 }), 900);
  assert.equal(resolveDefaultRateValue('KEYSTONE', { tasaBcv: 900, tasaKeystone: 930 }), 930);
  assert.equal(resolveDefaultRateValue('EDITABLE', { tasaBcv: 900, customRate: 955.5 }), 955.5);
  assert.equal(resolveDefaultRateValue('USD', { tasaBcv: 900 }), 1);

  console.log('  ✓ 1. Políticas por tipo de documento (Fiscal=BCV|USD, NE=Selector Completo) verificadas.');
}

// 2. Persistencia e inmutabilidad en Ventas (POS), CxC y Movimientos de Caja
{
  globalThis.localStorage.clear();
  const neSale = saveSale({
    tipoDoc: 'NOTA_ENTREGA',
    condicionPago: 'CONTADO',
    metodoPago: 'TRANSFERENCIA_BS',
    tipoTasa: 'KEYSTONE',
    tasaPago: 945.25,
    monedaPago: 'BS',
    clienteId: 'CLI-TEST',
    clienteNombre: 'Lubricantes Prueba C.A.',
    items: [
      { articuloId: 'ART-1', codigo: 'A1', descripcion: 'Aceite 20W50', cantidad: 1, precioUsd: 100, subtotalUsd: 100, litrosPorUnidad: 12, litros: 12 }
    ]
  }, { skipStockAdjustment: true });

  assert.equal(neSale.tipoTasa, 'KEYSTONE');
  assert.equal(neSale.tasaPago, 945.25);
  assert.equal(neSale.monedaPago, 'BS');

  const persistedSales = getSales();
  const reloadedSale = persistedSales.find((s) => s.id === neSale.id);
  assert.ok(reloadedSale, 'La venta debe recuperarse de almacenamiento local');
  assert.equal(reloadedSale.tipoTasa, 'KEYSTONE');
  assert.equal(reloadedSale.tasaPago, 945.25);
  assert.equal(reloadedSale.monedaPago, 'BS');

  const invPayload = buildProfitInvoicePayloadFromSale(reloadedSale, 'OF');
  assert.equal(invPayload.tipoTasa, 'KEYSTONE');
  assert.equal(invPayload.tasaPago, 945.25);
  assert.equal(invPayload.monedaPago, 'BS');

  // Venta fiscal forzada a BCV aunque intenten KEYSTONE
  const fiscalPayload = buildProfitInvoicePayloadFromSale({
    ...reloadedSale,
    id: 'FACT-999',
    numeroDoc: '000999',
    tipoDoc: 'FACTURA',
    tipoTasa: 'KEYSTONE'
  }, 'OF');
  assert.equal(fiscalPayload.tipoTasa, 'BCV');

  const mov = addCashMovement({
    tipo: 'INGRESO',
    categoria: 'COBRO_CXC',
    concepto: 'Cobro NE con tasa editable',
    montoUsd: 50,
    montoBs: 48000,
    tasa: 960,
    tasaPago: 960,
    tipoTasa: 'EDITABLE',
    monedaPago: 'BS',
    moneda: 'BS'
  });
  const storedMovs = getCashMovements();
  const reloadedMov = storedMovs.find((m) => m.id === mov.id);
  assert.ok(reloadedMov);
  assert.equal(reloadedMov.tipoTasa, 'EDITABLE');
  assert.equal(reloadedMov.tasaPago, 960);
  assert.equal(reloadedMov.monedaPago, 'BS');
  assert.equal(reloadedMov.montoBs, 48000);

  console.log('  ✓ 2. Persistencia e inmutabilidad en POS, profit_invoices y cash_movements verificada.');
}

// 3. Resumen histórico sin recalcular contra la tasa del día actual
{
  const records = [
    { tipoDoc: 'FACT', tipoTasa: 'BCV', tasaPago: 850, montoUsd: 100, montoBs: 85000 },
    { tipoDoc: 'NE', tipoTasa: 'KEYSTONE', tasaPago: 910, montoUsd: 200, montoBs: 182000 },
    { tipoDoc: 'NE', tipoTasa: 'EDITABLE', tasaPago: 950, montoUsd: 100, montoBs: 95000 },
    { tipoDoc: 'FACT', tipoTasa: 'USD', tasaPago: 1, montoUsd: 50, montoBs: 0 }
  ];

  // Aunque hoy la tasa sea 1200, el resumen conserva montoBs histórico exacto
  const summary = summarizeByRateClassification(records, 1200);
  assert.equal(summary.totalUsd, 450);
  assert.equal(summary.totalBs, 362000);
  assert.equal(summary.byType.BCV.totalUsd, 100);
  assert.equal(summary.byType.KEYSTONE.totalBs, 182000);
  assert.equal(summary.byType.EDITABLE.totalBs, 95000);
  assert.equal(summary.byType.USD.totalUsd, 50);
  assert.equal(summary.byType.USD.totalBs, 0);
  assert.equal(resolveRecordRateType(records[2]), 'EDITABLE');
  assert.equal(resolveEffectiveRateNumber(records[1], 1200), 910);

  console.log('  ✓ 3. Conservación histórica de montos Bs y desglose por clasificación verificado.');
}

// 4. Generadores PDF (CxC, CxP, Recibo de Cobro, Estado de Cuenta) con columnas tipoTasa / tasaPago
{
  const cfg = { tasaDolar: 911.62, tasaKeystone: 940.00 };
  const sampleUser = { nombre: 'Tester' };

  const cxcDoc = generateAccountsReceivablePDF({
    receivables: [
      { vendedorId: 'OF', factura: '002500', tipoDoc: 'FACTURA', rif: 'J-12345678-9', cliente: 'Cliente BCV', fechaEmisionIso: '2026-11-10', fechaVencimientoIso: '2026-11-25', diasVencidos: 0, diasCredito: 15, montoFacturaUsd: 116, abonosUsd: 0, restanteUsd: 116, tipoTasa: 'BCV', tasaPago: 911.62 },
      { vendedorId: '04', factura: 'NE-0099', tipoDoc: 'NOTA_ENTREGA', rif: 'J-98765432-1', cliente: 'Cliente Keystone', fechaEmisionIso: '2026-11-10', fechaVencimientoIso: '2026-11-25', diasVencidos: 0, diasCredito: 15, montoFacturaUsd: 200, abonosUsd: 50, restanteUsd: 150, tipoTasa: 'KEYSTONE', tasaPago: 940 }
    ],
    config: cfg,
    currentUser: sampleUser
  }, null, cfg, 'FACTURA');
  assert.ok(cxcDoc.getNumberOfPages() >= 1);

  const cxpDoc = generateAccountsPayablePDF({
    payables: [
      { id: 'cxp-1', tipoDoc: 'FACT', nroDoc: 'F-100', provNombre: 'Proveedor Fiscal', provRif: 'J-11111111-1', fecEmis: '10/11/2026', fecVenc: '25/11/2026', montoNetUsd: 500, abonosUsd: 100, saldoUsd: 400, tipoTasa: 'BCV', tasaPago: 911.62 },
      { id: 'cxp-2', tipoDoc: 'NE', nroDoc: 'NE-200', provNombre: 'Proveedor Libre', provRif: 'J-22222222-2', fecEmis: '10/11/2026', fecVenc: '25/11/2026', montoNetUsd: 300, abonosUsd: 300, saldoUsd: 0, tipoTasa: 'EDITABLE', tasaPago: 950 }
    ],
    config: cfg,
    currentUser: sampleUser
  });
  assert.ok(cxpDoc.getNumberOfPages() >= 1);

  const recDoc = generateCollectionReceiptPDF({
    receipt: {
      cobNum: '004200',
      clienteNombre: 'Cliente Recibo Test',
      clienteRif: 'J-33333333-3',
      fecha: '2026-11-13',
      montoUsd: 150,
      montoBs: 141000,
      tasa: 940,
      tasaPago: 940,
      tipoTasa: 'KEYSTONE',
      cuentaNombre: 'Banco Plaza Bs.',
      referencia: 'REF-7788'
    },
    config: cfg,
    currentUser: sampleUser
  });
  assert.ok(recDoc.getNumberOfPages() >= 1);
  const recPageStream = Array.isArray(recDoc.internal?.pages?.[1]) ? recDoc.internal.pages[1].join('\n') : '';
  assert.ok(recPageStream.includes('940,00'), 'El recibo debe mostrar la tasa real del cobro (940,00)');
  assert.ok(recPageStream.includes('Tasa Keystone'), 'El recibo debe etiquetar Tasa Keystone');

  // Escenario histórico (ej. #004090 sobre NOTA_ENTREGA #002074) sin tipoTasa ni tasa explícita guardada,
  // pero realizado en Bolívares (50.467,00 / $50 = 1.009,34), distinto al BCV actual (911,62):
  const legacyNeReceiptDoc = generateCollectionReceiptPDF({
    receipt: {
      cobNum: '004090',
      clienteNombre: 'Orlando Rafael Zaima Martinez',
      clienteRif: 'V-18661617',
      fecha: '2026-11-10',
      montoUsd: 50,
      montoBs: 50467,
      tasa: 0,
      cuentaNombre: 'Caja Efectivo $ (Valencia)'
    },
    allocations: [{ factNum: '002074', tipoDoc: 'NOTA_ENTREGA', abonoUsd: 50, saldoAnteriorUsd: 50, saldoRestanteUsd: 0 }],
    config: { ...cfg, tasaEuro: 1039.34, tasaKeystone: 1003.49 },
    currentUser: sampleUser
  });
  assert.ok(legacyNeReceiptDoc.getNumberOfPages() >= 1);
  const legacyPageStream = Array.isArray(legacyNeReceiptDoc.internal?.pages?.[1]) ? legacyNeReceiptDoc.internal.pages[1].join('\n') : '';
  assert.ok(legacyPageStream.includes('1.009,34'), 'El recibo histórico debe reconstruir y mostrar su tasa exacta (1.009,34) y no la BCV del día');
  assert.ok(!legacyPageStream.includes('Tasa BCV:'), 'Un cobro de Nota de Entrega a tasa histórica distinta a BCV no debe rotularse Tasa BCV');

  // Escenario Fiscal (FACTURA): conserva siempre Tasa BCV y su tasa exacta ejecutada
  const fiscalReceiptDoc = generateCollectionReceiptPDF({
    receipt: {
      cobNum: '004201',
      factNum: '002500',
      tipoDoc: 'FACTURA',
      clienteNombre: 'Cliente Fiscal C.A.',
      fecha: '2026-11-10',
      montoUsd: 100,
      montoBs: 91162,
      tasa: 911.62,
      cuentaNombre: 'Banco Mercantil'
    },
    allocations: [{ factNum: '002500', tipoDoc: 'FACTURA', abonoUsd: 100, saldoAnteriorUsd: 100, saldoRestanteUsd: 0 }],
    config: cfg,
    currentUser: sampleUser
  });
  const fiscalPageStream = Array.isArray(fiscalReceiptDoc.internal?.pages?.[1]) ? fiscalReceiptDoc.internal.pages[1].join('\n') : '';
  assert.ok(fiscalPageStream.includes('Tasa BCV: Bs. 911,62'), 'Cobro fiscal debe mostrar Tasa BCV y el valor exacto');

  const stDoc = generateThirdPartyStatementPDF({
    entity: { nombre: 'Tercero Prueba C.A.', rif: 'J-44444444-4' },
    entityType: 'CLIENT',
    documents: [
      { factNum: '001122', tipoDoc: 'FACTURA', fechaEmision: '2026-11-01', fechaVencimiento: '2026-11-16', totNetoUsd: 300, abonosUsd: 100, saldoUsd: 200, tipoTasa: 'BCV', tasaPago: 911.62 },
      { factNum: 'NE-55', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-11-05', fechaVencimiento: '2026-11-20', totNetoUsd: 120, abonosUsd: 120, saldoUsd: 0, tipoTasa: 'USD', tasaPago: 1 }
    ],
    config: cfg,
    currentUser: sampleUser
  });
  assert.ok(stDoc.getNumberOfPages() >= 1);

  console.log('  ✓ 4. Generadores PDF (CxC, CxP, Recibo de Cobro, Estado de Cuenta) verificados.');
}

console.log('--- TODAS LAS PRUEBAS DE CLASIFICACIÓN DE TASAS PASARON AL 100% ---');
