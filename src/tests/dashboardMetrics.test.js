import assert from 'node:assert/strict';
import {
  extractMonthNumber,
  toDateKey,
  getUnduplicatedSales,
  summarizePendingOrders,
  summarizeReceivablesAging,
  summarizeCollectionsWindow
} from '../services/dashboardMetricsService.js';
import { matchesSeller } from '../services/commissionService.js';
import { buildConsolidatedKardex } from '../utils/kardexUtils.js';

console.log('--- INICIANDO PRUEBAS DE MÉTRICAS DEL DASHBOARD EJECUTIVO ---');

// 1. Extracción de mes y normalización de fechas ISO + DD/MM/YYYY
assert.equal(extractMonthNumber('2026-05-14T10:30:00Z'), '05');
assert.equal(extractMonthNumber('14/05/2026'), '05');
assert.equal(extractMonthNumber('01/02/2026'), '02');
assert.equal(toDateKey('14/05/2026'), '2026-05-14');
assert.equal(toDateKey('2026-11-13T23:55:00Z'), '2026-11-13');
console.log('  ✓ 1. Normalización de fechas ISO y DD/MM/YYYY verificada.');

// 2. Deduplicación de ventas POS vs profitInvoices sin doble conteo ni colisión FAC/NE
const profitDocs = [
  { id: 'FAC-1001', numeroDoc: 'FAC-1001', tipoDoc: 'FACTURA', totalNetoUsd: 500, totalLitros: 100 },
  { id: 'FAC-ANUL', numeroDoc: 'FAC-9999', tipoDoc: 'FACTURA', anulada: true, totalNetoUsd: 900, totalLitros: 180 }
];
const posDocs = [
  { id: 'pos-1', numeroDoc: '1001', tipoDoc: 'FACTURA', totalUsd: 500, items: [{ litros: 100 }] }, // ya en profitInvoices
  { id: 'pos-2', numeroDoc: '1001', tipoDoc: 'NOTA_ENTREGA', totalUsd: 300, items: [{ litros: 60 }] }, // distinta naturaleza (NE)
  { id: 'pos-3', numeroDoc: '1002', tipoDoc: 'FACTURA', anulada: true, totalUsd: 200, items: [{ litros: 40 }] }, // anulada
  { id: 'pos-4', numeroDoc: '1003', tipoDoc: 'FACTURA', totalUsd: 250, items: [{ litros: 50 }] } // única en POS
];
const undupSales = getUnduplicatedSales(posDocs, profitDocs);
assert.equal(undupSales.length, 2);
assert.deepEqual(undupSales.map(s => s.id), ['pos-2', 'pos-4']);
console.log('  ✓ 2. Deduplicación POS <-> Profit Invoices (FAC/NE) sin doble conteo verificada.');

// 3. Exclusión de SOLICITUD_CLIENTE en pedidos pendientes y suma real en USD
const ordersSummary = summarizePendingOrders([
  { id: 'PED-FF-1', tipoDoc: 'FACTURA', status: 'APROBADO', totalLitros: 120, totalUsd: 800 },
  { id: 'PED-NE-2', tipoDoc: 'NOTA_ENTREGA', status: 'PENDIENTE', totalLitros: 60, totalNetoUsd: 350 },
  { id: 'PED-EST-3', tipoDoc: 'FACTURA', estatus: 'PENDIENTE', totalLitros: 20, totalUsd: 100 },
  { id: 'SOL-99', tipoDoc: 'SOLICITUD_CLIENTE', status: 'APROBADO', totalLitros: 0, totalUsd: 5000 },
  { id: 'PED-3', tipoDoc: 'FACTURA', status: 'RETENIDO_CREDITO', totalLitros: 40, totalUsd: 250 },
  { id: 'PED-4', tipoDoc: 'FACTURA', status: 'FACTURADO', totalLitros: 200, totalUsd: 1200 }
]);
assert.equal(ordersSummary.basePendiente, 200);
assert.equal(ordersSummary.pendingOrdersUsd, 1250);
console.log('  ✓ 3. Filtrado de SOLICITUD_CLIENTE y totales reales de preventa pendiente verificados.');

// 4. Cartera CxC al día vs vencida (incluye 15_DIAS, DD/MM/YYYY y dedup)
const aging = summarizeReceivablesAging({
  profitInvoices: [
    { id: 'F1', numeroDoc: 'FAC-10', tipoDoc: 'FACTURA', saldoUsd: 200, fechaVencimiento: '20/11/2026' },
    { id: 'F2', numeroDoc: 'FAC-11', tipoDoc: 'FACTURA', saldoUsd: 150, fechaVencimiento: '01/11/2026' },
    // Factura ya cobrada que conserva saldoBs residual viejo en DB (no debe sumarse a la cartera)
    { id: 'F3', numeroDoc: 'FAC-99', tipoDoc: 'FACTURA', status: 'COBRADA', saldoUsd: 0, saldoBs: 180000, fechaVencimiento: '01/09/2026' }
  ],
  sales: [
    { id: 'S1', numeroDoc: 'FAC-10', tipoDoc: 'FACTURA', condicionPago: '15_DIAS', saldoPendiente: 200, fechaVencimiento: '2026-11-20' }, // duplicada
    { id: 'S2', numeroDoc: 'FAC-12', tipoDoc: 'FACTURA', condicionPago: '15_DIAS', saldoPendiente: 100, fechaVencimiento: '2026-11-10' } // vencida
  ],
  tasaBcv: 500,
  todayKey: '2026-11-13'
});
assert.equal(aging.cxcDia, 200);
assert.equal(aging.cxcVen, 250);
assert.equal(aging.cxcTot, 450);
console.log('  ✓ 4. Resumen de cartera CxC (plazos N_DIAS, exclusión COBRADA con saldoBs residual y deduplicación) verificado.');

// 5. Anti-colisión de vendedores con códigos cortos (OF, CM)
const oficinaSeller = { coVen: 'OF', venDes: 'Oficina Principal' };
const carlosSeller = { coVen: 'CM', venDes: 'Carlos Mendez' };
assert.equal(matchesSeller(oficinaSeller, 'SOFIA GOMEZ'), false);
assert.equal(matchesSeller(oficinaSeller, 'OF - Oficina Principal'), true);
assert.equal(matchesSeller(carlosSeller, 'CARMEN MORALES'), false);
assert.equal(matchesSeller(carlosSeller, { vendedorId: 'CM', vendedor: 'Carlos Mendez' }), true);
console.log('  ✓ 5. Coincidencia exacta de vendedores anti-colisión verificada.');

// 6. Separación por serie/era (fac-18..21 de Feb-2026 NO colisionan ni omiten 000018..000021 de Nov-2026 en Dashboard, CxC ni Kardex)
const legacySeriesInvoices = [
  { id: 'fac-18', factNum: 18, tipoDoc: 'FACTURA', fechaEmision: '2026-02-11T00:00:00Z', status: 'COBRADA', saldoUsd: 0, totNetoUsd: 61.99, items: [{ codigo: '001208', cantidad: 1 }] },
  { id: 'fac-19', factNum: 19, tipoDoc: 'FACTURA', fechaEmision: '2026-02-12T00:00:00Z', status: 'COBRADA', saldoUsd: 0, totNetoUsd: 105.62, items: [{ codigo: '100102', cantidad: 1 }] }
];
const modernPosSales = [
  { id: '000018', numeroDoc: '000018', tipoDoc: 'FACTURA', fecha: '2026-11-16T15:23:00Z', estado: 'PENDIENTE', saldoUsd: 163.4, totalUsd: 163.4, items: [{ codigo: '001208', cantidad: 2 }] },
  { id: '000019', numeroDoc: '000019', tipoDoc: 'FACTURA', fecha: '2026-11-16T15:30:00Z', estado: 'PENDIENTE', saldoUsd: 163.4, totalUsd: 163.4, items: [{ codigo: '100102', cantidad: 2 }] },
  { id: 'NE-002226', numeroDoc: 'NE-002226', tipoDoc: 'NOTA_ENTREGA', fecha: '2026-11-16T16:21:00Z', estado: 'PENDIENTE', saldoUsd: 82, totalUsd: 82, items: [{ codigo: '001201', cantidad: 1 }] }
];
const eraUndup = getUnduplicatedSales(modernPosSales, legacySeriesInvoices);
assert.equal(eraUndup.length, 3);
const eraAging = summarizeReceivablesAging({
  profitInvoices: legacySeriesInvoices,
  sales: modernPosSales,
  tasaBcv: 914,
  todayKey: '2026-11-16'
});
assert.equal(eraAging.cxcTot, 408.8);
const eraKardex = buildConsolidatedKardex({
  products: [
    { id: '001208', codigo: '001208', descripcion: '15W40', stock: 100, stockAlmacen01: 100, stockAlmacen02: 0 },
    { id: '100102', codigo: '100102', descripcion: '20W50', stock: 100, stockAlmacen01: 100, stockAlmacen02: 0 },
    { id: '001201', codigo: '001201', descripcion: '15W40 Semi', stock: 100, stockAlmacen01: 80, stockAlmacen02: 20 }
  ],
  profitInvoices: legacySeriesInvoices,
  sales: modernPosSales
});
assert.equal(eraKardex.find(r => r.codigo === '001208')?.salidasVentas, 3);
assert.equal(eraKardex.find(r => r.codigo === '100102')?.salidasVentas, 3);
assert.equal(eraKardex.find(r => r.codigo === '001201')?.salidasVentas, 1);
console.log('  ✓ 6. Serie histórica fac-18..21 no suprime facturas modernas 000018..000021 en Dashboard, CxC ni Kardex.');

// 7. Cobranzas del día y acumulado mensual (USD directo, Bs normalizado, exclusión anulados/N/C y dedup)
const cobSummary = summarizeCollectionsWindow({
  tasaBcv: 900,
  todayKey: '2026-11-19',
  monthPrefix: '2026-11',
  profitCollections: [
    // Pago directo en Zelle hoy (montoBs = 0 con tasaPago = 917 -> NO debe dividirse por 917!)
    { id: 'c1', fecha: '2026-11-19', clienteId: 'CLI-1', montoUsd: 250, montoBs: 0, tasaPago: 917.77, tipoTasa: 'ZELLE', monedaPago: 'USD', formaPago: 'ZELLE' },
    // Duplicado exacto de c1 (debe ignorarse)
    { id: 'c1', fecha: '2026-11-19', clienteId: 'CLI-1', montoUsd: 250, montoBs: 0, tasaPago: 917.77, tipoTasa: 'ZELLE', monedaPago: 'USD', formaPago: 'ZELLE' },
    // Pago en Bs hoy con tasa 900
    { id: 'c2', fecha: '2026-11-19', clienteId: 'CLI-2', montoUsd: 100, montoBs: 90000, tasaPago: 900, tipoTasa: 'BCV', monedaPago: 'BS', formaPago: 'TRANS' },
    // Pago de ayer en efectivo USD
    { id: 'c3', fecha: '2026-11-18', clienteId: 'CLI-3', montoUsd: 400, montoBs: 0, tasa: 1, tipoTasa: 'USD', monedaPago: 'USD', formaPago: 'EFEC' },
    // Registro legacy Profit donde montoUsd vino igual a montoBs (90000 / 900 = $100)
    { id: 'c4', fecha: '2026-11-10', clienteId: 'CLI-1', montoUsd: 90000, montoBs: 90000, tasa: 900, formaPago: 'DEPO' },
    // Anulado (excluido)
    { id: 'c5', fecha: '2026-11-19', clienteId: 'CLI-4', montoUsd: 500, montoBs: 0, anulado: true },
    // Nota de crédito (excluida)
    { id: 'c6', fecha: '2026-11-19', clienteId: 'CLI-5', montoUsd: 120, montoBs: 0, formaPago: 'NOTA_CREDITO' },
    // Mes anterior (no entra en Nov 2026)
    { id: 'c7', fecha: '2026-10-25', clienteId: 'CLI-6', montoUsd: 800, montoBs: 0, tipoTasa: 'USD', monedaPago: 'USD' }
  ]
});
assert.equal(cobSummary.hoy.usd, 350);
assert.equal(cobSummary.hoy.divisasUsd, 250);
assert.equal(cobSummary.hoy.bsUsd, 100);
assert.equal(cobSummary.hoy.bsReal, 90000);
assert.equal(cobSummary.hoy.recibos, 2);
assert.equal(cobSummary.hoy.clientes, 2);
assert.equal(cobSummary.hoy.ayerUsd, 400);
assert.equal(cobSummary.mes.usd, 850);
assert.equal(cobSummary.mes.divisasUsd, 650);
assert.equal(cobSummary.mes.bsUsd, 200);
assert.equal(cobSummary.mes.recibos, 4);
assert.equal(cobSummary.mes.clientes, 3);
console.log('  ✓ 7. Resumen de Cobranzas del Día y Acumulado Mensual (divisas/Bs, dedup y exclusiones) verificado.');

console.log('\n🎉 Todas las pruebas de dashboardMetrics.test.js pasaron (7/7).');
