import assert from 'node:assert/strict';
import {
  extractMonthNumber,
  toDateKey,
  getUnduplicatedSales,
  summarizePendingOrders,
  summarizeReceivablesAging,
  summarizeCollectionsWindow,
  isKeystonePayableRecord,
  summarizeKeystonePayables,
  normalizeDashboardSalesDocs,
  summarizeSalesWindows,
  summarizeInventoryStock
} from '../services/dashboardMetricsService.js';
import { canAccessMobileDashboard } from '../components/mobile/mobileOrderHelpers.js';
import {
  applyTempCollectionsAdjustment,
  canManageTempCollectionsAdjustment,
  TEMP_COLLECTIONS_ADJUSTMENT
} from '../config/tempCollectionsAdjustment.js';
import { matchesSeller } from '../services/commissionService.js';
import { buildConsolidatedKardex } from '../utils/kardexUtils.js';
import { getProductCost, calculateWeightedAverageCostPatch } from '../services/pricingService.js';

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

// 4b. Paridad CxC: fec_venc === fec_emis usa 15 días estándar y descuenta cobros vinculados en profitCollections
const agingParity = summarizeReceivablesAging({
  profitInvoices: [
    { id: 'NE-002280', factNum: 'NE-002280', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-11-23', fechaVencimiento: '2026-11-23', totNetoUsd: 82, saldoUsd: 82 },
    { id: 'NE-002225', factNum: 'NE-002225', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-11-13', fechaVencimiento: '2026-11-20', totNetoUsd: 82, saldoUsd: 82 }
  ],
  profitCollections: [
    { id: 'cob-1', cobNum: '004175', fecha: '2026-11-13', montoUsd: 63, documentosAfectados: [{ numDoc: 'NE-002225', montoUsd: 63 }] }
  ],
  tasaBcv: 924.35,
  todayKey: '2026-11-26'
});
assert.equal(agingParity.cxcDia, 82);
assert.equal(agingParity.cxcVen, 19);
assert.equal(agingParity.docsVencidosNotas, 1);
console.log('  ✓ 4b. Paridad CxC (fec_venc === fec_emis -> 15 días y cruce de profitCollections) verificada.');

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

// 8. Sumatoria actual de Cuentas por Pagar Keystone (dedup, RIF/nombre, excluye otros proveedores/anulados/solventes)
assert.equal(isKeystonePayableRecord({ provRif: 'J-31115365-9', provNombre: 'Proveedor Principal' }), true);
assert.equal(isKeystonePayableRecord({ co_prov: 'J311153659', prov_nombre: 'KEYSTONE  C.A.' }), true);
assert.equal(isKeystonePayableRecord({ provNombre: 'Keistone Lubricantes' }), true);
assert.equal(isKeystonePayableRecord({ provRif: 'J506639866', provNombre: 'Rs Mercadato, C.A.' }), false);

const keystoneSummary = summarizeKeystonePayables({
  tasaKeystone: 1000,
  todayKey: '2026-11-20',
  profitAccountsPayable: [
    // Vigente (vence futuro)
    { id: 'K1', tipoDoc: 'FACT', nroDoc: '16989', provRif: 'J-31115365-9', provNombre: 'Keystone, C.A.', saldoUsd: 1500.5, fechaVencimiento: '2026-11-30' },
    // Duplicado exacto de K1 (no debe duplicar saldo)
    { id: 'K1', tipoDoc: 'FACT', nroDoc: '16989', provRif: 'J311153659', provNombre: 'KEYSTONE  C.A.', saldoUsd: 1500.5, fechaVencimiento: '2026-11-30' },
    // Vencida (vence antes de hoy)
    { id: 'K2', tipoDoc: 'NE', nroDoc: '17033', co_prov: 'J311153659', prov_nombre: 'KEYSTONE  C.A.', saldo_usd: 499.5, fec_venc: '2026-11-10' },
    // Sin saldoUsd explícito -> calcula desde saldoBs / tasaKeystone (500000 / 1000 = $500, vence hoy = vigente)
    { id: 'K3', tipoDoc: 'N/DB', nroDoc: 'ND-0001', provNombre: 'Keistone C.A.', saldoBs: 500000, fechaVencimiento: '2026-11-20' },
    // Solvente (saldo 0 -> no entra en pendientes)
    { id: 'K4', tipoDoc: 'FACT', nroDoc: '16000', provRif: 'J-311153659', provNombre: 'Keystone, C.A.', montoNetUsd: 9000, saldoUsd: 0, fechaVencimiento: '2026-10-01' },
    // Anulada (excluida)
    { id: 'K5', tipoDoc: 'FACT', nroDoc: '16001', provRif: 'J-311153659', provNombre: 'Keystone, C.A.', saldoUsd: 3000, anulado: true, fechaVencimiento: '2026-10-01' },
    // Otro proveedor (excluido)
    { id: 'O1', tipoDoc: 'FACT', nroDoc: '2001', provRif: 'J506639866', provNombre: 'Rs Mercadato, C.A.', saldoUsd: 850, fechaVencimiento: '2026-11-01' }
  ]
});
assert.equal(keystoneSummary.saldoTotalUsd, 2500);
assert.equal(keystoneSummary.saldoTotalBs, 2500000);
assert.equal(keystoneSummary.saldoVigenteUsd, 2000.5);
assert.equal(keystoneSummary.saldoVencidoUsd, 499.5);
assert.equal(keystoneSummary.documentosPendientes, 3);
assert.equal(keystoneSummary.docsVigentes, 2);
assert.equal(keystoneSummary.docsVencidos, 1);
assert.equal(keystoneSummary.vencidoPct, 20);
console.log('  ✓ 8. Sumatoria actual de Cuentas por Pagar Keystone (dedup, vigente/vencido, exclusiones) verificada.');

// 9. Resumen General Móvil y Escritorio (Facturación Día/Mes, Stock e Inventario, Acceso Móvil)
assert.equal(canAccessMobileDashboard({ id: 'u1', rol: 'GERENCIA' }), true);
assert.equal(canAccessMobileDashboard({ id: 'u2', rol: 'VENTAS' }), true);
assert.equal(canAccessMobileDashboard(null), false);

const rgProducts = [
  { id: '001201', codigo: '001201', descripcion: '15W40 CAJA', stock: 10, unidad: 'Caja', litrosPorUnidad: 11.35, costoUsd: 40 },
  { id: '001202', codigo: '001202', descripcion: '20W50 PAILA', stock: 5, unidad: 'Paila', litrosPorUnidad: 18.92, costoUsd: 70 }
];
const normDocs = normalizeDashboardSalesDocs({
  profitInvoices: [
    { id: 'F-101', numeroDoc: 'FAC-101', tipoDoc: 'FACTURA', fechaEmision: '2026-11-20', totNetoUsd: 200, items: [{ codigo: '001201', cantidad: 2 }] }
  ],
  sales: [
    { id: 'F-101', numeroDoc: 'FAC-101', tipoDoc: 'FACTURA', fecha: '2026-11-20', totalUsd: 200, items: [{ codigo: '001201', cantidad: 2 }] }, // duplicado
    { id: 'NE-201', numeroDoc: 'NE-201', tipoDoc: 'NOTA_ENTREGA', fecha: '2026-11-19', totalUsd: 150, items: [{ codigo: '001202', cantidad: 1 }] }
  ],
  products: rgProducts,
  tasaBcv: 900
});
assert.equal(normDocs.length, 2);

const salesWin = summarizeSalesWindows({
  ventasDocsNormalizados: normDocs,
  todayKey: '2026-11-20',
  anioActivo: 2026,
  ventasMesFilter: '11',
  metaMensualBase: 1000
});
assert.equal(salesWin.ventasDelDia.usd, 200);
assert.equal(salesWin.ventasDelDia.litros, 22.7);
assert.equal(salesWin.ventasDelDia.ayerUsd, 150);
assert.equal(salesWin.ventasAcumuladoMes.usd, 350);
assert.equal(salesWin.ventasAcumuladoMes.documentos, 2);

const invSum = summarizeInventoryStock(rgProducts);
assert.equal(invSum.stockTotalLitros, 208.1);
assert.equal(invSum.stockValorizadoUsd, 750);
assert.equal(invSum.stockBreakdownItems.length, 2);
console.log('  ✓ 9. Resumen General Móvil (Facturación Día/Mes, Inventario Valorizado y Permisos Móviles) verificado.');

// 10. Ajuste temporal de Cobranzas del 2026-11-20 en memoria (hoy -> ayer al día siguiente, mes Nov, y control exclusivo MASTER)
assert.equal(canManageTempCollectionsAdjustment({ rol: 'ADMINISTRADOR MASTER' }), true);
assert.equal(canManageTempCollectionsAdjustment({ rol: 'GERENCIA' }), false);
assert.equal(canManageTempCollectionsAdjustment({ rol: 'ADMINISTRACIÓN' }), false);
assert.equal(canManageTempCollectionsAdjustment({ rol: 'VENTAS' }), false);
assert.equal(canManageTempCollectionsAdjustment(null), false);

assert.equal(
  parseFloat(
    (
      TEMP_COLLECTIONS_ADJUSTMENT.banksBs.bancoPlaza +
      TEMP_COLLECTIONS_ADJUSTMENT.banksBs.bancaribe +
      TEMP_COLLECTIONS_ADJUSTMENT.banksBs.bancoVenezuela
    ).toFixed(2)
  ),
  1362214.67
);
assert.equal(TEMP_COLLECTIONS_ADJUSTMENT.bsUsd, 1349.57);
assert.equal(TEMP_COLLECTIONS_ADJUSTMENT.divisasUsd, 927);
assert.equal(TEMP_COLLECTIONS_ADJUSTMENT.totalUsd, 2276.57);

const nov20Base = summarizeCollectionsWindow({
  tasaBcv: 918.76,
  todayKey: '2026-11-20',
  monthPrefix: '2026-11',
  profitCollections: [
    { id: 'nov-1', fecha: '2026-11-10', clienteId: 'CLI-1', montoUsd: 1000, montoBs: 0, tipoTasa: 'USD', monedaPago: 'USD' }
  ]
});
const nov20Adjusted = applyTempCollectionsAdjustment({
  summary: nov20Base,
  todayKey: '2026-11-20',
  monthPrefix: '2026-11',
  tasaBcv: 918.76,
  enabled: true,
  localReverted: false
});
assert.equal(nov20Adjusted.hoy.usd, 2276.57);
assert.equal(nov20Adjusted.hoy.divisasUsd, 927);
assert.equal(nov20Adjusted.hoy.bsUsd, 1349.57);
assert.equal(nov20Adjusted.hoy.bsReal, 1362214.67);
assert.equal(nov20Adjusted.hoy.ayerUsd, 0);
assert.equal(nov20Adjusted.mes.usd, 3276.57);
assert.equal(nov20Adjusted.mes.divisasUsd, 1927);
assert.equal(nov20Adjusted.mes.bsUsd, 1349.57);
assert.equal(nov20Adjusted.mes.bsReal, 1362214.67);

// Al día siguiente (2026-11-21), pasa a Ayer y sigue sumado en Noviembre 2026
const nov21Base = summarizeCollectionsWindow({
  tasaBcv: 918.76,
  todayKey: '2026-11-21',
  monthPrefix: '2026-11',
  profitCollections: [
    { id: 'nov-1', fecha: '2026-11-10', clienteId: 'CLI-1', montoUsd: 1000, montoBs: 0, tipoTasa: 'USD', monedaPago: 'USD' }
  ]
});
const nov21Adjusted = applyTempCollectionsAdjustment({
  summary: nov21Base,
  todayKey: '2026-11-21',
  monthPrefix: '2026-11',
  tasaBcv: 918.76,
  enabled: true,
  localReverted: false
});
assert.equal(nov21Adjusted.hoy.usd, 0);
assert.equal(nov21Adjusted.hoy.ayerUsd, 2276.57);
assert.equal(nov21Adjusted.mes.usd, 3276.57);

// Otro mes no se altera, y al revertir (localReverted o enabled=false) vuelve exacto al real
const octAdjusted = applyTempCollectionsAdjustment({
  summary: nov21Base,
  todayKey: '2026-11-21',
  monthPrefix: '2026-10',
  tasaBcv: 918.76,
  enabled: true
});
assert.equal(octAdjusted.mes.usd, 1000);

const revertedSummary = applyTempCollectionsAdjustment({
  summary: nov20Base,
  todayKey: '2026-11-20',
  monthPrefix: '2026-11',
  tasaBcv: 918.76,
  enabled: true,
  localReverted: true
});
assert.deepEqual(revertedSummary, nov20Base);
console.log('  ✓ 10. Ajuste temporal de Cobranzas 2026-11-20 (hoy -> ayer, acumulado mensual, reversión y control MASTER) verificado.');

// 11. Costo Promedio Ponderado Independiente por Almacén (Opción 1: conserva costo previo y suma compra nueva)
const prod0804Before = {
  id: '000804',
  codigo: '000804',
  stockAlmacen01: 0,
  stockAlmacen02: 1,
  stock: 1,
  costoUsd: 837.22
};
const patch0804 = calculateWeightedAverageCostPatch(prod0804Before, {
  prev01: 0,
  prev02: 1,
  next01: 0,
  next02: 2,
  costDeltaVal02: 879.08,
  costDeltaQty02: 1,
  lastCost02: 879.08
});
assert.equal(patch0804.costoUsd01, 837.22);
assert.equal(patch0804.costoUsd02, 858.15);
assert.equal(patch0804.costoUsd, 858.15);

const prod1312Before = {
  id: '001312',
  codigo: '001312',
  stockAlmacen01: 0,
  stockAlmacen02: 0,
  stock: 0,
  costoUsd: 738.3
};
const patch1312 = calculateWeightedAverageCostPatch(prod1312Before, {
  prev01: 0,
  prev02: 0,
  next01: 0,
  next02: 1,
  costDeltaVal02: 891.5,
  costDeltaQty02: 1,
  lastCost02: 891.5
});
assert.equal(patch1312.costoUsd01, 738.3);
assert.equal(patch1312.costoUsd02, 891.5);
assert.equal(patch1312.costoUsd, 891.5);

const prod0804After = { ...prod0804Before, stockAlmacen02: 2, stock: 2, ...patch0804 };
const prod1312After = { ...prod1312Before, stockAlmacen02: 1, stock: 1, ...patch1312 };
assert.equal(getProductCost(prod0804After, '01'), 837.22);
assert.equal(getProductCost(prod0804After, '02'), 858.15);
assert.equal(Number((2 * getProductCost(prod0804After, '02') + 1 * getProductCost(prod1312After, '02')).toFixed(2)), 2607.8);
console.log('  ✓ 11. Costo Promedio Ponderado Independiente por Almacén (Opción 1) verificado.');

console.log('\n🎉 Todas las pruebas de dashboardMetrics.test.js pasaron (11/11).');
