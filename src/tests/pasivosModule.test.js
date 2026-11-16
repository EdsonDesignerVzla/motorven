import assert from 'node:assert/strict';
import {
  SYSTEM_MODULES,
  ROLE_PERMISSIONS,
  canAccessModule
} from '../services/authService.js';
import {
  loadPartnerPayableAccounts,
  upsertPartnerPayableAccountInList,
  applyPartnerPayableBalanceDeltaInList
} from '../utils/treasuryAccountUtils.js';
import {
  loadOtherLiabilityAccounts,
  upsertOtherLiabilityAccountInList,
  removeOtherLiabilityAccountFromList,
  loadPartnerLiabilityMovements,
  recordPartnerLiabilityMovement,
  deletePartnerLiabilityMovementFromList,
  getOfficialPlanDeCuentasPasivos,
  buildUnifiedPartnerMovementsLedger,
  computePasivosDashboardMetrics
} from '../utils/liabilityAccountUtils.js';

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

console.log('--- INICIANDO PRUEBAS MÓDULO CUENTAS DE PASIVO ---');

// 1. Permisos y catálogo de módulos
{
  assert.ok(SYSTEM_MODULES.some(m => m.id === 'pasivos'), 'SYSTEM_MODULES debe incluir pasivos');
  assert.ok(ROLE_PERMISSIONS['ADMINISTRADOR MASTER'].includes('pasivos'));
  assert.ok(ROLE_PERMISSIONS['ADMINISTRACIÓN'].includes('pasivos'));
  assert.equal(canAccessModule('ADMINISTRADOR MASTER', 'pasivos'), true);
  assert.equal(canAccessModule('GERENCIA', 'pasivos'), true);
  assert.equal(canAccessModule('ADMINISTRACIÓN', 'pasivos'), true);
  assert.equal(canAccessModule('VENTAS', 'pasivos'), false);
  console.log('✓ 1. Permisos RBAC del nuevo módulo Cuentas de Pasivo verificados');
}

// 2. Plan de Cuentas Grupo 2 (Pasivo) y CRUD de Pasivos Auxiliares
{
  globalThis.localStorage.clear();
  const planPasivos = getOfficialPlanDeCuentasPasivos();
  assert.equal(planPasivos.length, 27, 'Plan oficial debe contener 27 renglones de Pasivo');
  assert.ok(planPasivos.some(r => r.codigo === '2.02.01.001' && r.nombre.includes('Socio')));

  let others = loadOtherLiabilityAccounts();
  assert.equal(others.length, 1);
  others = upsertOtherLiabilityAccountInList(others, {
    id: 'pas-02',
    codigo: 'PAS-02',
    codigoContable: '2.01.01.001',
    nombre: 'Préstamo Bancario Corto Plazo',
    acreedor: 'Banco Mercantil',
    subgrupo: 'OTROS_PASIVOS',
    moneda: 'USD',
    saldoUsd: 500,
    saldoBs: 0
  });
  assert.equal(others.length, 2);
  others = removeOtherLiabilityAccountFromList(others, 'PAS-02');
  assert.equal(others.length, 1);
  console.log('✓ 2. Plan oficial Pasivo (27 cuentas) y CRUD de cuentas auxiliares verificado');
}

// 3. Flujo integrado Cuenta por Pagar Socio + Pagos CxP + Abono manual + Dashboard KPIs
{
  globalThis.localStorage.clear();
  let partners = loadPartnerPayableAccounts();
  partners = upsertPartnerPayableAccountInList(partners, {
    id: 'cta-socio-02',
    codigo: 'SOC-02',
    nombre: 'Cuenta por Pagar Socio — Carlos',
    titular: 'Carlos',
    moneda: 'USD',
    saldoUsd: 120,
    saldoBs: 0,
    activa: true
  });

  // Simular pago CxP a proveedor asumido por SOC-01 (+300 USD)
  partners = applyPartnerPayableBalanceDeltaInList(partners, {
    targetRef: 'SOCIO-cta-socio-01',
    deltaUsd: 300,
    deltaBs: 274206
  });

  const cxpPayments = [
    {
      id: 'PAG-9001',
      fechaPago: '2026-11-16',
      provNombre: 'KEYSTONE C.A.',
      montoUsd: 300,
      montoBs: 274206,
      tasaPago: 914.02,
      cuentaId: 'cta-socio-01',
      cuentaNombre: 'SOC-01 - Cuenta por Pagar Socio',
      accountType: 'PASIVO_SOCIO',
      referencia: 'SOC-REF-01',
      anulado: false
    }
  ];

  // Abono/reembolso manual al socio SOC-01 (-100 USD)
  let manualMovs = loadPartnerLiabilityMovements();
  manualMovs = recordPartnerLiabilityMovement(manualMovs, {
    id: 'PMOV-1',
    fecha: '2026-11-16',
    tipo: 'ABONO_SOCIO',
    cuentaId: 'cta-socio-01',
    cuentaCodigo: 'SOC-01',
    cuentaNombre: 'SOC-01 - Cuenta por Pagar Socio',
    montoUsd: 100,
    montoBs: 91402,
    concepto: 'Reembolso parcial a socio',
    referencia: 'TRF-551'
  });
  partners = applyPartnerPayableBalanceDeltaInList(partners, {
    targetRef: 'cta-socio-01',
    deltaUsd: -100,
    deltaBs: -91402
  });

  const ledger = buildUnifiedPartnerMovementsLedger({
    partnerAccounts: partners,
    manualMovements: manualMovs,
    supplierPayments: cxpPayments
  });
  assert.equal(ledger.length, 2);
  assert.ok(ledger.some(m => m.origen === 'CXP_PAGO_PROVEEDOR' && m.montoUsd === 300));
  assert.ok(ledger.some(m => m.origen === 'MANUAL_PASIVOS' && m.tipo === 'ABONO_SOCIO' && m.montoUsd === 100));

  const metrics = computePasivosDashboardMetrics({
    partnerAccounts: partners,
    otherLiabilityAccounts: [{ id: 'pas-1', moneda: 'USD', saldoUsd: 50, saldoBs: 0, activa: true }],
    accountsPayable: [{ id: 'doc-1', saldoUsd: 400, saldoBs: 365608, anulado: false }],
    supplierPayments: cxpPayments,
    config: { tasaDolar: 914.02 }
  });
  assert.equal(metrics.sociosUsd, 320); // 200 (SOC-01) + 120 (SOC-02)
  assert.equal(metrics.proveedoresUsd, 400);
  assert.equal(metrics.pagosAsumidosSociosUsd, 300);
  assert.equal(metrics.totalPasivosMonitoreadosUsd, 770); // 320 + 50 + 400

  manualMovs = deletePartnerLiabilityMovementFromList(manualMovs, 'PMOV-1');
  assert.equal(manualMovs.length, 0);
  console.log('✓ 3. Movimientos unificados CxP+Manual y KPIs del módulo Cuentas de Pasivo verificados');
}

console.log('=== TODAS LAS PRUEBAS DE CUENTAS DE PASIVO PASARON EXITOSAMENTE ===');
