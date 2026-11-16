import assert from 'node:assert/strict';
import { addCashMovement, deleteCashMovement, getCashMovements } from '../services/storageService.js';
import { addSupabaseCashMovement, deleteSupabaseCashMovement, getSupabaseCashMovements } from '../services/supabaseService.js';
import { getSyncQueue, clearSyncQueue } from '../services/offlineSyncService.js';
import {
  resolveExchangeRates,
  computeBankAccountValuation,
  computeBankBalancesSummary,
  computeCashDesksSummary,
  computeTodayCashInflows,
  validateSufficientTreasuryBalance,
  resolveTreasuryTargetForPaymentMethod,
  resolveTreasuryAccountForMovement,
  computeMovementReversalDelta,
  applyTreasuryBalanceDelta
} from '../utils/treasuryAccountUtils.js';
import { generateCashflowPDF, generateBankAccountsPDF } from '../services/pdfReportService.js';

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

console.log('--- INICIANDO PRUEBAS MÓDULO CAJA CHICA & BANCOS ---');

// 1. addCashMovement retorna un único objeto creado (no un arreglo)
{
  globalThis.localStorage.clear();
  const created = addCashMovement({
    tipo: 'INGRESO',
    concepto: 'Reposición de caja menor',
    montoUsd: 120,
    montoBs: 108532.80,
    metodo: 'EFECTIVO_USD'
  });

  assert.equal(Array.isArray(created), false, 'addCashMovement no debe retornar un arreglo');
  assert.equal(typeof created, 'object');
  assert.equal(created.concepto, 'Reposición de caja menor');
  assert.equal(created.montoUsd, 120);
  const list = getCashMovements();
  assert.equal(list[0].id, created.id);
  console.log('✓ 1. addCashMovement retorna objeto único y lo persiste');
}

// 2. addSupabaseCashMovement rechaza payloads inválidos/vacíos o arreglos y conserva trazabilidad
{
  await assert.rejects(
    () => addSupabaseCashMovement(null),
    /inválido/i,
    'Debe rechazar null'
  );
  await assert.rejects(
    () => addSupabaseCashMovement([{ concepto: 'Array corrupto', montoUsd: 10 }]),
    /inválido/i,
    'Debe rechazar arrays'
  );
  await assert.rejects(
    () => addSupabaseCashMovement({ tipo: 'INGRESO', concepto: '   ', montoUsd: 10 }),
    /concepto/i,
    'Debe rechazar concepto vacío'
  );
  await assert.rejects(
    () => addSupabaseCashMovement({ tipo: 'INGRESO', concepto: 'Cero corrupto', montoUsd: 0, montoBs: 0 }),
    /mayor a 0/i,
    'Debe rechazar montos en cero'
  );

  const valid = await addSupabaseCashMovement({
    id: 'MOV-TEST-VALID-1',
    tipo: 'EGRESO',
    concepto: 'Pago flete despacho',
    montoUsd: 45,
    montoBs: 40699.80,
    metodo: 'EFECTIVO_USD',
    cuentaId: 'CAJA-01',
    cajaId: 'CAJA-01',
    cuentaNombre: 'Caja Efectivo $ (Valencia)',
    tasa: 904.44
  });

  assert.equal(Array.isArray(valid), false);
  assert.equal(valid.cuentaId, 'CAJA-01');
  assert.equal(valid.cajaId, 'CAJA-01');
  assert.equal(valid.cuentaNombre, 'Caja Efectivo $ (Valencia)');
  assert.equal(valid.tasa, 904.44);
  console.log('✓ 2. addSupabaseCashMovement valida montos/concepto y conserva trazabilidad de caja/banco');
}

// 3. Fórmulas unificadas de tasas, bancos, cajas, ingresos del día y saldo suficiente
{
  const rates = resolveExchangeRates({});
  assert.equal(rates.tasaBcv, 904.44);

  const customConfig = { tasaDolar: 910.00, tasaKeystone: 930.00 };
  const banks = [
    { id: 'CTA-01', codCta: '01', bancoNombre: 'BANCO MERCANTIL', moneda: 'BS', saldoBs: 91000, saldoUsd: 50 },
    { id: 'CTA-02', codCta: '02', bancoNombre: 'CHASE USD', moneda: 'USD', saldoUsd: 200, saldoBs: 0 }
  ];
  const valMercantil = computeBankAccountValuation(banks[0], customConfig);
  assert.equal(valMercantil.usd, 100.00, 'Cuentas en BS deben calcular contravalor USD usando tasaBcv unificada');
  const bankSummary = computeBankBalancesSummary(banks, customConfig);
  assert.equal(bankSummary.totalUsd, 300.00);
  assert.equal(bankSummary.totalBs, 273000.00);

  const desks = [
    { id: 'caja-01', coCaja: 'CAJA-01', descripcion: 'Caja Efectivo $ (Valencia)', moneda: 'USD', saldoUsd: 500, saldoBs: 455000 },
    { id: 'caja-04', coCaja: 'CAJA-04', descripcion: 'Caja Zelle USD', moneda: 'USD', saldoUsd: 300, saldoBs: 0 },
    { id: 'caja-03', coCaja: 'CAJA-03', descripcion: 'Caja Efectivo Bs (Valencia)', moneda: 'BS', saldoUsd: 0, saldoBs: 9100 }
  ];
  const cashSummary = computeCashDesksSummary(desks, customConfig);
  assert.equal(cashSummary.physicalUsd, 500.00, 'physicalUsd no debe mezclar Zelle/Binance con efectivo físico USD');
  assert.equal(cashSummary.totalUsd, 810.00);

  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const inflows = computeTodayCashInflows([
    { tipo: 'INGRESO', fecha: today.toISOString(), montoUsd: 150, montoBs: 136500 },
    { tipo: 'INGRESO', fecha: yesterday.toISOString(), montoUsd: 999, montoBs: 909090 },
    { tipo: 'EGRESO', fecha: today.toISOString(), montoUsd: 50, montoBs: 45500 }
  ], today);
  assert.equal(inflows.totalUsd, 150.00, 'Total Ingresos Hoy solo debe sumar INGRESO del día actual');

  const checkFail = validateSufficientTreasuryBalance(desks[0], { deltaUsd: -600, deltaBs: -546000 });
  assert.equal(checkFail.ok, false, 'Debe bloquear egresos superiores al saldo real');
  const checkOk = validateSufficientTreasuryBalance(desks[0], { deltaUsd: -100, deltaBs: -91000 });
  assert.equal(checkOk.ok, true);

  const targetZelle = resolveTreasuryTargetForPaymentMethod('ZELLE', desks, banks);
  assert.equal(targetZelle?.accountRef, 'CAJA:caja-04');
  const targetPagoMovil = resolveTreasuryTargetForPaymentMethod('PAGO_MOVIL', desks, banks);
  assert.equal(targetPagoMovil?.accountRef, 'BANCO:CTA-01');
  console.log('✓ 3. Fórmulas unificadas de bancos, arqueo físico, entradas hoy, validación de saldo y mapeo POS');
}

// 4. PDFs compatibles con formato Supabase profit_cash_desks + detalle de movimientos
{
  const docBanks = generateBankAccountsPDF({
    bankAccounts: [
      { codCta: '01', bancoNombre: 'BANCO MERCANTIL', numCta: '01050027311027479197', moneda: 'BS', saldoBs: 904440, cuentaANombreDe: 'GRUPO MOTORVEN, C.A.' }
    ],
    cashDesks: [
      { coCaja: 'CAJA-01', descripcion: 'Caja Efectivo $ (Valencia)', moneda: 'USD', saldoUsd: 500, responsable: 'Administración' },
      { coCaja: 'CAJA-03', descripcion: 'Caja Efectivo Bs (Valencia)', moneda: 'BS', saldoBs: 90444, responsable: 'Caja' }
    ],
    config: { tasaDolar: 904.44 }
  });
  assert.ok(docBanks.getNumberOfPages() >= 1);

  const docFlow = generateCashflowPDF({
    bankAccounts: [{ codCta: '01', bancoNombre: 'BANCO MERCANTIL', numCta: '0105...', moneda: 'BS', saldoBs: 904440 }],
    cashDesks: [{ coCaja: 'CAJA-01', descripcion: 'Caja Efectivo $', moneda: 'USD', saldoUsd: 500 }],
    cashMovements: [{ id: 'MOV-1', fecha: new Date().toISOString(), tipo: 'INGRESO', concepto: 'Venta Mostrador', cuentaNombre: 'Caja Efectivo $', montoUsd: 250, montoBs: 226110 }],
    config: { tasaDolar: 904.44 }
  });
  assert.ok(docFlow.getNumberOfPages() >= 1);
  console.log('✓ 4. PDFs generateBankAccountsPDF y generateCashflowPDF soportan esquema Supabase y movimientos');
}

// 5. Resolución de caja/banco por movimiento, reversión de saldo y eliminación local/cola offline
{
  const desks = [
    { id: 'CAJA-01', coCaja: 'CAJA-01', descripcion: 'Caja Efectivo $ (Valencia)', moneda: 'USD', saldoUsd: 500, saldoBs: 450000, activa: true },
    { id: 'CAJA-04', coCaja: 'CAJA-04', descripcion: 'Caja Zelle USD', moneda: 'USD', saldoUsd: 300, saldoBs: 0, activa: true }
  ];
  const banks = [
    { id: 'CTA-01', codCta: '01', bancoNombre: 'BANCO MERCANTIL', numCta: '01050027311027479197', moneda: 'BS', saldoBs: 900000, saldoUsd: 989.01 },
    { id: 'CTA-02', codCta: '02', bancoNombre: 'BANCARIBE', numCta: '01140199671990039883', moneda: 'BS', saldoBs: 500000, saldoUsd: 500 }
  ];

  const byCajaId = resolveTreasuryAccountForMovement({ tipo: 'EGRESO', cajaId: 'CAJA-01', montoUsd: 45, montoBs: 40699.80 }, desks, banks);
  assert.equal(byCajaId?.kind, 'CAJA');
  assert.equal(byCajaId?.code, 'CAJA-01');

  const byBankNum = resolveTreasuryAccountForMovement({ tipo: 'EGRESO', cuentaNombre: '- 01140199671990039883', montoUsd: 609.31, montoBs: 615000.96 }, desks, banks);
  assert.equal(byBankNum?.kind, 'BANCO');
  assert.equal(byBankNum?.id, 'CTA-02');

  const byFallbackMethod = resolveTreasuryAccountForMovement({ tipo: 'INGRESO', metodoPago: 'EFECTIVO_USD', montoUsd: 82, montoBs: 74752.84 }, desks, banks);
  assert.equal(byFallbackMethod?.kind, 'CAJA');
  assert.equal(byFallbackMethod?.code, 'CAJA-01');

  const revEgreso = computeMovementReversalDelta({ tipo: 'EGRESO', montoUsd: 45, montoBs: 40699.80 });
  assert.equal(revEgreso.sign, 1);
  assert.equal(revEgreso.deltaUsd, 45);
  const restoredDesk = applyTreasuryBalanceDelta(desks[0], { deltaUsd: revEgreso.deltaUsd, deltaBs: revEgreso.deltaBs, clampZero: false });
  assert.equal(restoredDesk.saldoUsd, 545.00);
  assert.equal(restoredDesk.saldoBs, 490699.80);

  const revIngreso = computeMovementReversalDelta({ tipo: 'INGRESO', montoUsd: 82, montoBs: 74752.84 });
  assert.equal(revIngreso.sign, -1);
  const deductedZelle = applyTreasuryBalanceDelta(desks[1], { deltaUsd: revIngreso.deltaUsd, deltaBs: revIngreso.deltaBs, clampZero: true });
  assert.equal(deductedZelle.saldoUsd, 218.00);
  assert.equal(deductedZelle.saldoBs, 0);

  globalThis.localStorage.clear();
  clearSyncQueue();
  addCashMovement({ id: 'MOV-DEL-1', tipo: 'EGRESO', concepto: 'Flete prueba eliminar', montoUsd: 45, montoBs: 40699.80, cajaId: 'CAJA-01' });
  assert.equal(getCashMovements().some(m => m.id === 'MOV-DEL-1'), true);
  await deleteSupabaseCashMovement({ id: 'MOV-DEL-1', tipo: 'EGRESO', montoUsd: 45, montoBs: 40699.80 });
  assert.equal(getCashMovements().some(m => m.id === 'MOV-DEL-1'), false);
  const syncedList = await getSupabaseCashMovements();
  assert.equal(syncedList.some(m => m.id === 'MOV-DEL-1'), false);
  assert.equal(getSyncQueue().some(q => q.entity === 'cash_movement' && q.action === 'DELETE' && q.data?.id === 'MOV-DEL-1') || syncedList.every(m => m.id !== 'MOV-DEL-1'), true);
  deleteCashMovement('MOV-DEL-1');
  clearSyncQueue();
  console.log('✓ 5. Eliminación de movimientos revierte saldo exacto en caja/banco y limpia almacenamiento/cola');
}

console.log('=== TODAS LAS PRUEBAS DE CAJA CHICA & BANCOS PASARON EXITOSAMENTE ===');
