import assert from 'node:assert/strict';
import {
  extractMonthNumber,
  toDateKey,
  getUnduplicatedSales,
  summarizePendingOrders,
  summarizeReceivablesAging
} from '../services/dashboardMetricsService.js';
import { matchesSeller } from '../services/commissionService.js';

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
  { id: 'SOL-99', tipoDoc: 'SOLICITUD_CLIENTE', status: 'APROBADO', totalLitros: 0, totalUsd: 5000 },
  { id: 'PED-3', tipoDoc: 'FACTURA', status: 'RETENIDO_CREDITO', totalLitros: 40, totalUsd: 250 },
  { id: 'PED-4', tipoDoc: 'FACTURA', status: 'FACTURADO', totalLitros: 200, totalUsd: 1200 }
]);
assert.equal(ordersSummary.basePendiente, 180);
assert.equal(ordersSummary.pendingOrdersUsd, 1150);
console.log('  ✓ 3. Filtrado de SOLICITUD_CLIENTE y totales reales de preventa pendiente verificados.');

// 4. Cartera CxC al día vs vencida (incluye 15_DIAS, DD/MM/YYYY y dedup)
const aging = summarizeReceivablesAging({
  profitInvoices: [
    { id: 'F1', numeroDoc: 'FAC-10', tipoDoc: 'FACTURA', saldoUsd: 200, fechaVencimiento: '20/11/2026' },
    { id: 'F2', numeroDoc: 'FAC-11', tipoDoc: 'FACTURA', saldoUsd: 150, fechaVencimiento: '01/11/2026' }
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
console.log('  ✓ 4. Resumen de cartera CxC (plazos N_DIAS, fechas DD/MM/YYYY y deduplicación) verificado.');

// 5. Anti-colisión de vendedores con códigos cortos (OF, CM)
const oficinaSeller = { coVen: 'OF', venDes: 'Oficina Principal' };
const carlosSeller = { coVen: 'CM', venDes: 'Carlos Mendez' };
assert.equal(matchesSeller(oficinaSeller, 'SOFIA GOMEZ'), false);
assert.equal(matchesSeller(oficinaSeller, 'OF - Oficina Principal'), true);
assert.equal(matchesSeller(carlosSeller, 'CARMEN MORALES'), false);
assert.equal(matchesSeller(carlosSeller, { vendedorId: 'CM', vendedor: 'Carlos Mendez' }), true);
console.log('  ✓ 5. Coincidencia exacta de vendedores anti-colisión verificada.');

console.log('\n🎉 Todas las pruebas de dashboardMetrics.test.js pasaron (5/5).');
