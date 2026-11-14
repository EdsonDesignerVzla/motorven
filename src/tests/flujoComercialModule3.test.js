import assert from 'node:assert/strict';
import {
  isOrderReservationExpired,
  evaluateClientCreditPolicy,
  getClientAgreedCreditInfo,
  canUserGrantCreditOverride,
  parseInvoiceDateInfo
} from '../services/creditPolicyService.js';
import {
  canApproveClients,
  isMasterOrGerencia
} from '../services/authService.js';

console.log('--- INICIANDO PRUEBAS DEL MÓDULO 3 (FLUJO COMERCIAL Y PEDIDOS) ---');

// 1. isOrderReservationExpired con formatos DD/MM/YYYY, YYYY-MM-DD e ISO (>72h vs <72h) e ignorando FACTURADO/ANULADO
const refNowMs = new Date(2026, 10, 15, 12, 0, 0).getTime(); // 15/11/2026 12:00 local

assert.equal(
  isOrderReservationExpired({ status: 'PENDIENTE', fechaEmision: '10/11/2026' }, refNowMs),
  true,
  'Pedido PENDIENTE DD/MM/YYYY con >72h debe marcarse como vencido'
);
assert.equal(
  isOrderReservationExpired({ status: 'APROBADO', fechaEmision: '14/11/2026' }, refNowMs),
  false,
  'Pedido APROBADO DD/MM/YYYY con <72h debe permanecer vigente'
);
assert.equal(
  isOrderReservationExpired({ status: 'RETENIDO_CREDITO', fecha: '2026-11-10' }, refNowMs),
  true,
  'Pedido RETENIDO_CREDITO YYYY-MM-DD con >72h debe marcarse como vencido'
);
assert.equal(
  isOrderReservationExpired({ status: 'PENDIENTE', created_at: '2026-11-14T18:00:00' }, refNowMs),
  false,
  'Pedido PENDIENTE ISO reciente (<72h) no debe marcarse como vencido'
);
assert.equal(
  isOrderReservationExpired({ status: 'FACTURADO', fechaEmision: '01/11/2026' }, refNowMs),
  false,
  'Pedido ya FACTURADO nunca debe expirar por reserva de 72h'
);
assert.equal(
  isOrderReservationExpired({ status: 'ANULADO', fechaEmision: '01/11/2026' }, refNowMs),
  false,
  'Pedido ANULADO nunca debe marcarse como vencido'
);
assert.ok(parseInvoiceDateInfo('10/11/2026')?.date instanceof Date);
console.log('  ✓ 1. isOrderReservationExpired valida DD/MM/YYYY, YYYY-MM-DD, ISO y respeta FACTURADO/ANULADO.');

// 2. evaluateClientCreditPolicy: DD/MM/YYYY en Profit, bloqueo sinCredito y límite de crédito
const clientClean = {
  id: 'CLI-301',
  coCli: 'CLI-301',
  rif: 'J-50111222-3',
  nombre: 'REPUESTOS CENTRO C.A.',
  limiteCreditoUsd: 1000,
  diasCredito: 15,
  creditoActivo: true
};

const refPolicyNow = new Date(2026, 10, 15, 12, 0, 0);

// Factura vencida en formato DD/MM/YYYY de Profit Plus -> debe negar crédito
const policyOverdueDmy = evaluateClientCreditPolicy({
  client: clientClean,
  profitInvoices: [
    {
      id: 'pr-1',
      factNum: 'FAC-9001',
      tipoDoc: 'FACTURA',
      coCli: 'CLI-301',
      rif: 'J-50111222-3',
      fechaEmision: '01/10/2026',
      fechaVencimiento: '05/11/2026',
      saldoUsd: 250
    }
  ],
  sales: [],
  tasaBcv: 50,
  montoOrdenUsd: 100,
  now: refPolicyNow
});
assert.equal(policyOverdueDmy.evaluado, true);
assert.equal(policyOverdueDmy.tieneVencidas, true);
assert.equal(policyOverdueDmy.isAprobado, false);

// Cliente bloqueado por ficha (sinCredito) -> debe negar crédito incluso sin facturas vencidas
const policySinCredito = evaluateClientCreditPolicy({
  client: { ...clientClean, sinCredito: true },
  profitInvoices: [],
  sales: [],
  tasaBcv: 50,
  montoOrdenUsd: 50,
  now: refPolicyNow
});
assert.equal(policySinCredito.bloqueadoPorFicha, true);
assert.equal(policySinCredito.isAprobado, false);

// Límite de crédito excedido (saldo $400 + orden $700 > límite $1000) -> debe negar crédito
const policyLimitExceeded = evaluateClientCreditPolicy({
  client: clientClean,
  profitInvoices: [
    {
      id: 'pr-2',
      factNum: 'FAC-9002',
      tipoDoc: 'FACTURA',
      coCli: 'CLI-301',
      rif: 'J-50111222-3',
      fechaEmision: '10/11/2026',
      fechaVencimiento: '30/12/2026',
      saldoUsd: 400
    }
  ],
  sales: [],
  tasaBcv: 50,
  montoOrdenUsd: 700,
  now: refPolicyNow
});
assert.equal(policyLimitExceeded.excedeLimiteCredito, true);
assert.equal(policyLimitExceeded.isAprobado, false);
assert.equal(policyLimitExceeded.creditoDisponibleUsd, 600);

// Dentro del límite y sin vencimientos -> aprobado
const policyWithinLimit = evaluateClientCreditPolicy({
  client: clientClean,
  profitInvoices: [
    {
      id: 'pr-2',
      factNum: 'FAC-9002',
      tipoDoc: 'FACTURA',
      coCli: 'CLI-301',
      rif: 'J-50111222-3',
      fechaEmision: '10/11/2026',
      fechaVencimiento: '30/12/2026',
      saldoUsd: 400
    }
  ],
  sales: [],
  tasaBcv: 50,
  montoOrdenUsd: 500,
  now: refPolicyNow
});
assert.equal(policyWithinLimit.excedeLimiteCredito, false);
assert.equal(policyWithinLimit.isAprobado, true);
console.log('  ✓ 2. evaluateClientCreditPolicy evalúa fechas DD/MM/YYYY, bloqueo por ficha y exceso de límite.');

// 3. getClientAgreedCreditInfo
assert.equal(getClientAgreedCreditInfo({ diasCredito: 30 }).termKey, '30_DIAS');
assert.equal(getClientAgreedCreditInfo({ diasCredito: 21 }).termKey, '21_DIAS');
assert.equal(getClientAgreedCreditInfo({ diasCredito: 15 }).termKey, '15_DIAS');
assert.equal(getClientAgreedCreditInfo({ diasCredito: 7 }).termKey, '7_DIAS');
assert.equal(getClientAgreedCreditInfo({ diasCredito: 0, condicionPago: 'CREDITO' }).termKey, '15_DIAS');
assert.equal(getClientAgreedCreditInfo({ diasCredito: 0, condicionPago: 'CONTADO' }).termKey, 'CONTADO');
console.log('  ✓ 3. getClientAgreedCreditInfo resuelve correctamente los plazos acordados.');

// 4. RBAC Módulo 3: canUserGrantCreditOverride, canApproveClients y isMasterOrGerencia
assert.equal(canUserGrantCreditOverride({ rol: 'GERENCIA', username: 'gerencia' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'ADMINISTRADOR MASTER', username: 'edson designer' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'COBRANZA', username: 'rosibelcxc' }), true);
assert.equal(canUserGrantCreditOverride({ rol: 'VENDEDOR', username: 'cbecerra' }), false);
assert.equal(canUserGrantCreditOverride({ rol: 'CHOFER', username: 'chofer1' }), false);
assert.equal(canUserGrantCreditOverride({ rol: 'CAJA', username: 'caja' }), false);

assert.equal(canApproveClients({ rol: 'CAJA', username: 'caja' }), true);
assert.equal(canApproveClients({ rol: 'COBRANZA', username: 'rosibelcxc' }), true);
assert.equal(canApproveClients({ rol: 'VENDEDOR', username: 'ventas', co_ven: 'YC' }), true);
assert.equal(canApproveClients({ rol: 'VENDEDOR', username: 'rosibelventas', co_ven: 'RV' }), false);
assert.equal(canApproveClients({ rol: 'CHOFER', username: 'chofer1' }), false);

assert.equal(isMasterOrGerencia({ rol: 'LOGISTICA', username: 'log1' }), false, 'Subcadena TI en LOGISTICA no debe elevar privilegios');
assert.equal(isMasterOrGerencia({ rol: 'ADMINISTRADOR MASTER', username: 'edson designer' }), true);
assert.equal(isMasterOrGerencia({ rol: 'TECNOLOGÍA & INFORMÁTICA', username: 'manuel' }), true);
console.log('  ✓ 4. RBAC de excepciones de crédito, aprobación de clientes y admin estricto verificados.');

console.log('✅ TODAS LAS PRUEBAS DEL MÓDULO 3 PASARON EXITOSAMENTE.');
