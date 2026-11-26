import assert from 'node:assert/strict';
import {
  parseInvoiceDateInfo,
  evaluateClientCreditPolicy,
  evaluateClientCreditPortfolioSummary,
  canUserGrantCreditOverride
} from '../services/creditPolicyService.js';

console.log('--- INICIANDO PRUEBAS DEL MÓDULO 2 (PREVENTA MÓVIL) ---');

// 1. parseInvoiceDateInfo con formatos DD/MM/YYYY, DD-MM-YYYY e ISO
const dSlash = parseInvoiceDateInfo('05/03/2026');
assert.ok(dSlash?.date instanceof Date && !Number.isNaN(dSlash.date.getTime()));
assert.equal(dSlash.isoDateOnly, '2026-03-05');

const dDash = parseInvoiceDateInfo('18-11-2026');
assert.ok(dDash?.date instanceof Date && !Number.isNaN(dDash.date.getTime()));
assert.equal(dDash.isoDateOnly, '2026-11-18');

const dIso = parseInvoiceDateInfo('2026-06-15T14:25:00Z');
assert.ok(dIso?.date instanceof Date && !Number.isNaN(dIso.date.getTime()));
assert.equal(dIso.isoDateOnly, '2026-06-15');
console.log('  ✓ 1. parseInvoiceDateInfo soporta DD/MM/YYYY, DD-MM-YYYY e ISO.');

// 2. Deduplicación POS <-> Profit Plus, ignorar SOLICITUD_CLIENTE/COTIZACION y saldo $0 liquidado
const clientFixture = {
  id: 'CLI-101',
  coCli: 'CLI-101',
  rif: 'J-40123456-7',
  nombre: 'DISTRIBUIDORA MOTOR TEST C.A.',
  limiteCreditoUsd: 2000,
  diasCredito: 15,
  creditoActivo: true
};

const profitInvoices = [
  {
    id: 'profit-fac-1042',
    factNum: 'FAC-1042',
    tipoDoc: 'FACTURA',
    coCli: 'CLI-101',
    rif: 'J-40123456-7',
    fechaEmision: '01/11/2026',
    fechaVencimiento: '30/12/2099',
    saldoUsd: 400
  }
];

const sales = [
  {
    // Duplicada de Profit (mismo numeroDoc canónico y tipo FACTURA)
    id: 'pos-sale-1042',
    numeroDoc: '1042',
    tipoDoc: 'FACTURA',
    clienteId: 'CLI-101',
    clienteRif: 'J-40123456-7',
    fecha: '2026-11-01',
    fechaVencimiento: '2099-12-30',
    condicionPago: 'CREDITO',
    totalUsd: 400,
    saldoUsd: 400,
    estado: 'PENDIENTE'
  },
  {
    // Venta a crédito ya cobrada / saldo explícito $0 (NO debe sumar deuda ni pendientes)
    id: 'pos-sale-paid',
    numeroDoc: '1043',
    tipoDoc: 'FACTURA',
    clienteId: 'CLI-101',
    clienteRif: 'J-40123456-7',
    fecha: '2026-11-02',
    condicionPago: 'CREDITO',
    totalUsd: 350,
    saldoUsd: 0,
    estado: 'COBRADA'
  },
  {
    // Solicitud de cliente y cotización NO deben evaluarse como facturas en mora/saldo
    id: 'sol-cli-1',
    numeroDoc: 'SOL-01',
    tipoDoc: 'SOLICITUD_CLIENTE',
    clienteId: 'CLI-101',
    clienteRif: 'J-40123456-7',
    totalUsd: 9000,
    estado: 'PENDIENTE_APROBACION'
  },
  {
    id: 'cot-1',
    numeroDoc: 'COT-01',
    tipoDoc: 'COTIZACION',
    clienteId: 'CLI-101',
    clienteRif: 'J-40123456-7',
    totalUsd: 1500,
    condicionPago: 'CREDITO'
  }
];

const evalDedup = evaluateClientCreditPolicy({
  client: clientFixture,
  profitInvoices,
  sales,
  tasaBcv: 50,
  montoOrdenUsd: 300
});

assert.equal(evalDedup.facturasPendientesCount, 1);
assert.equal(evalDedup.saldoDeudorUsd, 400);
assert.equal(evalDedup.tieneVencidas, false);
assert.equal(evalDedup.isAprobado, true);
console.log('  ✓ 2. evaluateClientCreditPolicy deduplica Profit/POS y excluye saldos $0, COBRADA y SOLICITUD_CLIENTE.');

// 3. Factura vencida con fecha DD/MM/YYYY en Profit detecta mora y bloquea aprobación automática
const overdueEval = evaluateClientCreditPolicy({
  client: clientFixture,
  profitInvoices: [
    {
      id: 'profit-fac-venc',
      factNum: 'FAC-0880',
      tipoDoc: 'FACTURA',
      coCli: 'CLI-101',
      rif: 'J-40123456-7',
      fechaEmision: '01/01/2025',
      fechaVencimiento: '15/01/2025',
      saldoUsd: 250
    }
  ],
  sales: [],
  tasaBcv: 50,
  montoOrdenUsd: 100
});
assert.equal(overdueEval.tieneVencidas, true);
assert.equal(overdueEval.vencidasCount, 1);
assert.equal(overdueEval.isAprobado, false);
console.log('  ✓ 3. Facturas vencidas en formato DD/MM/YYYY se detectan correctamente.');

// 4. evaluateClientCreditPortfolioSummary calcula alerta3Dias y diasMoraMax con fechas DD/MM/YYYY
const refNow = new Date(2026, 10, 10, 12, 0, 0); // 10/11/2026
const summaryAlert = evaluateClientCreditPortfolioSummary({
  client: clientFixture,
  profitInvoices: [
    {
      id: 'fac-soon',
      factNum: 'FAC-2001',
      tipoDoc: 'FACTURA',
      coCli: 'CLI-101',
      rif: 'J-40123456-7',
      fechaEmision: '28/10/2026',
      fechaVencimiento: '12/11/2026', // +2 días
      saldoUsd: 180
    }
  ],
  sales: [],
  tasaBcv: 50,
  now: refNow
});
assert.equal(summaryAlert.alerta3Dias, true);
assert.equal(summaryAlert.diasRestantesMin, 2);
assert.equal(summaryAlert.enMora, false);

const summaryOverdue = evaluateClientCreditPortfolioSummary({
  client: clientFixture,
  profitInvoices: [
    {
      id: 'fac-late',
      factNum: 'FAC-2002',
      tipoDoc: 'FACTURA',
      coCli: 'CLI-101',
      rif: 'J-40123456-7',
      fechaEmision: '20/10/2026',
      fechaVencimiento: '05/11/2026', // -5 días
      saldoUsd: 220
    }
  ],
  sales: [],
  tasaBcv: 50,
  now: refNow
});
assert.equal(summaryOverdue.enMora, true);
assert.equal(summaryOverdue.diasMoraMax, 5);
console.log('  ✓ 4. evaluateClientCreditPortfolioSummary calcula diasMoraMax y alerta3Dias con fechas DD/MM/YYYY.');

// 5. Control RBAC para aprobación de crédito según acceso a Flujo Comercial & Pedidos (canUserGrantCreditOverride)
assert.equal(canUserGrantCreditOverride({ rol: 'ADMINISTRADOR MASTER' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'GERENCIA' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'COBRANZA' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'ADMINISTRACION' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'VENDEDOR' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'CAJA' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'VENDEDOR', modulos: ['preventa', 'ventas'] }), false);
assert.equal(canUserGrantCreditOverride({ rol: 'TECNOLOGIA' }), false);
assert.equal(canUserGrantCreditOverride({ rol: 'TECNOLOGIA', modulos: ['pedidos', 'configuracion'] }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'COMPRAS' }), false);
assert.equal(canUserGrantCreditOverride(null), false);
console.log('  ✓ 5. canUserGrantCreditOverride habilita aprobación de crédito a usuarios con acceso a Flujo Comercial & Pedidos.');

console.log('--- PRUEBAS DEL MÓDULO 2 EXITOSAS ---');
