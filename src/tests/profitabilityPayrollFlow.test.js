import assert from 'node:assert/strict';
import {
  resolveProductListPrice,
  computeInvoiceItemProratedUsd,
  resolveAdjustmentRealCostUsd,
  deduplicatePosSalesAgainstProfitInvoices,
  aggregateSkuAnalytics,
  computeOperationalPandL,
  buildExpenseAccountOptions,
  PRICE_LIST_TIERS
} from '../utils/profitabilityUtils.js';
import {
  saveStorageExpense,
  getStorageExpenses,
  deleteStorageExpense,
  saveStorageEmployee,
  getStorageEmployees,
  deleteStorageEmployee,
  saveStoragePayroll,
  getStoragePayroll,
  deleteStoragePayroll
} from '../services/storageService.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✅ [Rentabilidad/Gastos/Nómina] ${name}`);
};

test('resolveProductListPrice resuelve precios Mayor y Detal reales cuando precioA es 0', () => {
  const realDbProd = {
    id: '000001',
    codigo: '000001',
    precioA: 0,
    precio_a: 0,
    precioUsdMayor: 45.5,
    precioUsdDetal: 54.0,
    costoUsd: 30
  };
  assert.equal(resolveProductListPrice(realDbProd, PRICE_LIST_TIERS.MAYOR), 45.5);
  assert.equal(resolveProductListPrice(realDbProd, PRICE_LIST_TIERS.DETAL), 54.0);
  assert.equal(resolveProductListPrice({ precioA: 33 }, PRICE_LIST_TIERS.MAYOR), 33);
});

test('computeInvoiceItemProratedUsd prorratea facturas con tasa <= 0 sin asignar 100% por ítem', () => {
  const invoice = { id: 'FAC-1', tasa: 0, totNetoUsd: 300 };
  const items = [
    { codigo: 'SKU-1', cantidad: 2, totalNeto: 20000 },
    { codigo: 'SKU-2', cantidad: 1, totalNeto: 10000 }
  ];
  assert.equal(computeInvoiceItemProratedUsd(items[0], items, invoice), 200);
  assert.equal(computeInvoiceItemProratedUsd(items[1], items, invoice), 100);
});

test('aggregateSkuAnalytics excluye anuladas, deduplica POS vs Profit y resta devoluciones', () => {
  const products = [
    { id: '000001', codigo: '000001', descripcion: 'Aceite Diésel 15W40', categoria: 'Diésel', stock: 10, costoUsd: 20, precioUsdMayor: 35, precioUsdDetal: 40, litrosPorUnidad: 12 },
    { id: '000002', codigo: '000002', descripcion: 'Hidráulico AW68', categoria: 'Hidráulico', stock: 5, costoUsd: 15, precioUsdMayor: 25, precioUsdDetal: 30, litrosPorUnidad: 19 }
  ];
  const profitInvoices = [
    {
      id: 'fac-100',
      docNum: '000100',
      anulada: false,
      tasa: 0,
      totNetoUsd: 350,
      items: [{ codigo: '000001', cantidad: 10, totalNeto: 10000 }]
    },
    {
      id: 'fac-101',
      docNum: '000101',
      anulada: true, // Debe excluirse (anulada en camelCase snake parity)
      tasa: 500,
      totNetoUsd: 500,
      items: [{ codigo: '000002', cantidad: 20, totalNeto: 250000 }]
    }
  ];
  const sales = [
    {
      id: 'fac-100', // Ya sincronizada en profit_invoices -> no duplicar
      numeroFactura: '000100',
      tipoDocumento: 'FACTURA',
      items: [{ codigo: '000001', cantidad: 10, totalNetoUsd: 350 }]
    },
    {
      id: 'fac-133', // Única en POS -> sí incluir
      numeroFactura: '000133',
      tipoDocumento: 'FACTURA',
      items: [{ codigo: '000002', cantidad: 4, totalNetoUsd: 100 }]
    }
  ];
  const profitReturns = [
    {
      id: 'DEV-1',
      anulado: false,
      tasa: 500,
      items: [{ co_art: '000001', total_art: 2, totalNetoUsd: 70 }]
    }
  ];

  const deduped = deduplicatePosSalesAgainstProfitInvoices(profitInvoices, sales);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, 'fac-133');

  const skus = aggregateSkuAnalytics({ products, profitInvoices, sales, profitReturns, priceTier: PRICE_LIST_TIERS.MAYOR });
  const sku1 = skus.find((s) => s.id === '000001');
  const sku2 = skus.find((s) => s.id === '000002');

  assert.equal(sku1.precioLista, 35);
  assert.equal(sku1.valorVentaTotal, 350);
  assert.equal(sku1.vendidasHistoricas, 8); // 10 - 2 devueltas
  assert.equal(sku1.facturadoHistoricoUsd, 280); // 350 - 70
  assert.equal(sku1.cmvHistoricoUsd, 160); // 8 * 20

  assert.equal(sku2.vendidasHistoricas, 4); // Solo POS fac-133; anulada fac-101 excluida
  assert.equal(sku2.facturadoHistoricoUsd, 100);
});

test('resolveAdjustmentRealCostUsd lee renglones tipo_trans S sin porcentaje inventado', () => {
  const adj = {
    id: 'AJU-01',
    anulado: false,
    tasa: 400,
    totalCostoUsd: 0,
    renglones: [
      { co_art: '000001', tipo_trans: 'S', total_art: 50, cost_unit_om: 3.1, cost_unit: 1240 },
      { co_art: '000002', tipo_trans: 'E', total_art: 20, cost_unit_om: 10, cost_unit: 4000 }
    ]
  };
  assert.equal(resolveAdjustmentRealCostUsd(adj, 400), 155);
  assert.equal(resolveAdjustmentRealCostUsd({ ...adj, anulado: true }, 400), 0);
});

test('computeOperationalPandL cero cifras inventadas en modo real y evita doble conteo Caja/Gastos/Nómina', () => {
  const emptyPnl = computeOperationalPandL({
    products: [{ id: 'P1', categoria: 'Transmisión', stock: 100, costoUsd: 20, precioUsdMayor: 35 }],
    profitInvoices: [],
    sales: [],
    isSimulation: false
  });
  assert.equal(emptyPnl.facturadoAjustadoUsd, 0);
  assert.equal(emptyPnl.opexFijoUsd, 0);
  assert.equal(emptyPnl.retencionesIslrUsd, 0);
  assert.equal(emptyPnl.costoMermasUsd, 0);
  assert.equal(emptyPnl.costoFletesUsd, 0);
  assert.equal(Number.isNaN(emptyPnl.ebitdaPct), false);

  const realPnl = computeOperationalPandL({
    products: [
      { id: 'A1', codigo: 'A1', categoria: 'Diésel', stock: 10, costoUsd: 20, precioUsdMayor: 40, litrosPorUnidad: 12 },
      { id: 'A2', codigo: 'A2', categoria: 'Hidráulico', stock: 5, costoUsd: 30, precioUsdMayor: 50, litrosPorUnidad: 19 }
    ],
    profitInvoices: [
      {
        id: 'FAC-10',
        anulada: false,
        tasa: 0,
        totNetoUsd: 450,
        items: [
          { codigo: 'A1', cantidad: 5, totalNeto: 20000 },
          { codigo: 'A2', cantidad: 5, totalNeto: 25000 }
        ]
      }
    ],
    profitReturns: [],
    profitInventoryAdjustments: [
      { id: 'AJ-1', renglones: [{ tipo_trans: 'S', total_art: 10, cost_unit_om: 2 }] }
    ],
    commissionSettlements: [{ id: 'LIQ-1', totalComisionUsd: 25, estado: 'PAGADA' }],
    expenses: [
      { id: 'GAS-1', categoria: 'FLETES', montoUsd: 15, estado: 'PAGADA' },
      { id: 'GAS-2', categoria: 'ALQUILER', montoUsd: 40, estado: 'PAGADA' }
    ],
    payroll: [{ id: 'NOM-1', totalNetoUsd: 60, estado: 'PAGADA' }],
    cashMovements: [
      // Vinculado a GAS-1 -> NO debe duplicarse
      { id: 'MOV-1', tipo: 'EGRESO', categoria: 'FLETES', montoUsd: 15, referenciaId: 'GAS-1', referencia: 'GAS-1' },
      // Egreso directo sin gasto maestro -> SÍ debe sumarse a OPEX
      { id: 'MOV-2', tipo: 'EGRESO', categoria: 'SERVICIOS', montoUsd: 10 }
    ],
    isSimulation: false
  });

  assert.equal(realPnl.facturadoAjustadoUsd, 450);
  assert.equal(realPnl.cmvAjustadoUsd, 250); // 5*20 + 5*30
  assert.equal(realPnl.utilidadBrutaUsd, 200);
  assert.equal(realPnl.costoFletesUsd, 15);
  assert.equal(realPnl.comisionesVendedoresUsd, 25);
  assert.equal(realPnl.costoMermasUsd, 20);
  assert.equal(realPnl.costoNominaUsd, 60);
  assert.equal(realPnl.opexFijoUsd, 50); // GAS-2 ($40) + MOV-2 ($10), MOV-1 deduplicado!
  assert.equal(realPnl.ebitdaOperativoUsd, 30); // 200 - (15 + 25 + 20) - (60 + 50)
  assert.deepEqual(realPnl.linesBreakdown.map((l) => l.name), ['Hidráulico', 'Diésel']);

  // Modo Simulador sí aplica sliders What-If sin mutar modo real
  const simPnl = computeOperationalPandL({
    products: [{ id: 'A1', codigo: 'A1', categoria: 'Diésel', stock: 10, costoUsd: 20, precioUsdMayor: 40, litrosPorUnidad: 10 }],
    profitInvoices: [{ id: 'F1', items: [{ codigo: 'A1', cantidad: 10, totalNetoUsd: 400 }] }],
    isSimulation: true,
    simulationParams: { simPricePct: 110, freightPerLiterUsd: 0.1, avgCommissionPct: 5 }
  });
  assert.equal(simPnl.facturadoAjustadoUsd, 440);
  assert.equal(simPnl.costoFletesUsd, 10); // 100 litros * 0.1
  assert.equal(simPnl.comisionesVendedoresUsd, 22); // 5% de 440
});

test('buildExpenseAccountOptions combina categorías estándar con cuentas Profit reales', () => {
  const { standardCategories, profitAccounts } = buildExpenseAccountOptions([
    { co_ingr: '001', descrip: 'FLETES Y ACARREOS', cta_contab: '5.1.01' },
    { co_ingr: '002', descrip: 'SUELDOS Y SALARIOS', cta_contab: '5.2.01' }
  ]);
  assert.ok(standardCategories.some((c) => c.id === 'NOMINA'));
  assert.equal(profitAccounts.length, 2);
  assert.equal(profitAccounts[0].pnlBucket, 'FLETES');
  assert.equal(profitAccounts[1].pnlBucket, 'NOMINA');
});

test('CRUD localStorage para expenses, employees y payroll mantiene integridad', () => {
  localStorage.clear();
  const exp = saveStorageExpense({ fecha: '2026-11-13', concepto: 'Flete Local', categoria: 'FLETES', montoUsd: 35 });
  assert.equal(getStorageExpenses().length, 1);
  deleteStorageExpense(exp.id);
  assert.equal(getStorageExpenses().length, 0);

  const emp = saveStorageEmployee({ cedula: 'V-20111222', nombre: 'Carlos Pérez', cargo: 'Chofer', salarioBaseUsd: 400 });
  assert.equal(getStorageEmployees().length, 1);
  deleteStorageEmployee(emp.id);
  assert.equal(getStorageEmployees().length, 0);

  const pay = saveStoragePayroll({ periodo: 'Nov 2026 Q1', fechaPago: '2026-11-15', totalNetoUsd: 400 });
  assert.equal(getStoragePayroll().length, 1);
  deleteStoragePayroll(pay.id);
  assert.equal(getStoragePayroll().length, 0);
});

console.log(`\n🎉 Todas las pruebas de Rentabilidad/Gastos/Nómina pasaron (${passed}/${passed}).`);
