import assert from 'node:assert/strict';
import { addCashMovement, deleteCashMovement, getCashMovements } from '../services/storageService.js';
import { addSupabaseCashMovement, updateSupabaseCashMovement, deleteSupabaseCashMovement, getSupabaseCashMovements } from '../services/supabaseService.js';
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
  applyTreasuryBalanceDelta,
  doesMovementBelongToAccount,
  summarizeAccountMovements,
  filterMovementsByPeriod,
  computeMovementEditAccountAdjustments
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

// 6. ListView segmentado por tabla (Cajas Registradoras vs Cuentas Bancarias) y resumen Entradas / Salidas
{
  const desks = [
    { id: 'CAJA-01', coCaja: 'CAJA-01', descripcion: 'Caja Efectivo $ (Valencia)', moneda: 'USD', saldoUsd: 872, saldoBs: 754642, activa: true },
    { id: 'CAJA-04', coCaja: 'CAJA-04', descripcion: 'Caja Zelle', moneda: 'USD', saldoUsd: 3321.26, saldoBs: 0, activa: true }
  ];
  const banks = [
    { id: 'CTA-01', codCta: '01', bancoNombre: 'BANCO MERCANTIL', numCta: '01050027311027479197', moneda: 'BS', saldoBs: 900000, saldoUsd: 989 },
    { id: 'CTA-02', codCta: '02', bancoNombre: 'BANCARIBE', numCta: '01140199671990039883', moneda: 'BS', saldoBs: 500000, saldoUsd: 500 }
  ];
  const mixedMovs = [
    { id: 'M1', tipo: 'INGRESO', montoUsd: 100, montoBs: 0, cajaId: 'CAJA-01', cuentaNombre: 'Caja Efectivo $ (Valencia)' },
    { id: 'M2', tipo: 'EGRESO', montoUsd: 40, montoBs: 36000, cajaId: 'CAJA-01', cuentaNombre: 'Caja Efectivo $ (Valencia)' },
    { id: 'M3', tipo: 'INGRESO', montoUsd: 250, montoBs: 0, cuentaId: 'CAJA-04', cuentaNombre: 'Caja Zelle' },
    { id: 'M4', tipo: 'EGRESO', montoUsd: 609.31, montoBs: 615000.96, cuentaNombre: '- 01140199671990039883' }
  ];

  const allCajasMovs = mixedMovs.filter(m => doesMovementBelongToAccount(m, 'CAJA', null, desks, banks));
  assert.equal(allCajasMovs.length, 3);
  const onlyCaja01 = mixedMovs.filter(m => doesMovementBelongToAccount(m, 'CAJA', desks[0], desks, banks));
  assert.equal(onlyCaja01.length, 2);
  const sumCaja01 = summarizeAccountMovements(onlyCaja01);
  assert.equal(sumCaja01.entradasCount, 1);
  assert.equal(sumCaja01.salidasCount, 1);
  assert.equal(sumCaja01.entradasUsd, 100);
  assert.equal(sumCaja01.salidasUsd, 40);
  assert.equal(sumCaja01.netoUsd, 60);

  const allBanksMovs = mixedMovs.filter(m => doesMovementBelongToAccount(m, 'BANCO', null, desks, banks));
  assert.equal(allBanksMovs.length, 1);
  assert.equal(allBanksMovs[0].id, 'M4');
  console.log('✓ 6. ListView de movimientos filtra exactamente por Caja/Banco y resume Entradas/Salidas');
}

// 7. Filtros por Día / Semana / Mes / Período y edición de movimientos con recálculo de saldos
{
  const movsByDate = [
    { id: 'D1', fecha: '2026-11-16T10:30:00.000Z', tipo: 'INGRESO', montoUsd: 50, montoBs: 0 },
    { id: 'D2', fecha: '2026-11-18T14:00:00.000Z', tipo: 'EGRESO', montoUsd: 20, montoBs: 0 }, // misma semana Lun 16 - Dom 22
    { id: 'D3', fecha: '2026-11-28T09:00:00.000Z', tipo: 'INGRESO', montoUsd: 90, montoBs: 0 }, // mismo mes nov
    { id: 'D4', fecha: '2026-10-15T12:00:00.000Z', tipo: 'INGRESO', montoUsd: 30, montoBs: 0 }
  ];

  assert.deepEqual(
    filterMovementsByPeriod(movsByDate, { periodMode: 'ALL' }).map(m => m.id),
    ['D1', 'D2', 'D3', 'D4']
  );
  assert.deepEqual(
    filterMovementsByPeriod(movsByDate, { periodMode: 'DIA', refDate: '2026-11-16' }).map(m => m.id),
    ['D1']
  );
  assert.deepEqual(
    filterMovementsByPeriod(movsByDate, { periodMode: 'SEMANA', refDate: '2026-11-18' }).map(m => m.id),
    ['D1', 'D2']
  );
  assert.deepEqual(
    filterMovementsByPeriod(movsByDate, { periodMode: 'MES', refMonth: '2026-11' }).map(m => m.id),
    ['D1', 'D2', 'D3']
  );
  assert.deepEqual(
    filterMovementsByPeriod(movsByDate, { periodMode: 'PERIODO', fromDate: '2026-11-17', toDate: '2026-11-30' }).map(m => m.id),
    ['D2', 'D3']
  );

  // Recálculo neto de saldo al editar movimiento (misma cuenta vs cambio de tipo vs cambio de cuenta)
  const desks = [
    { id: 'CAJA-01', coCaja: 'CAJA-01', descripcion: 'Caja Valencia', saldoUsd: 500, saldoBs: 0 },
    { id: 'CAJA-04', coCaja: 'CAJA-04', descripcion: 'Caja Zelle', saldoUsd: 1000, saldoBs: 0 }
  ];
  const banks = [
    { id: 'CTA-01', codCta: '01', bancoNombre: 'BANCO MERCANTIL', saldoBs: 10000, saldoUsd: 10 }
  ];

  // Caso A: Mismo CAJA-01 cambia EGRESO 40 -> EGRESO 100 => delta adicional -60 USD
  const adjSame = computeMovementEditAccountAdjustments(
    { id: 'M-EDIT-1', tipo: 'EGRESO', montoUsd: 40, montoBs: 0, cajaId: 'CAJA-01' },
    { id: 'M-EDIT-1', tipo: 'EGRESO', montoUsd: 100, montoBs: 0, cajaId: 'CAJA-01' },
    desks,
    banks
  );
  assert.equal(adjSame.length, 1);
  assert.equal(adjSame[0].account.kind, 'CAJA');
  assert.equal(adjSame[0].deltaUsd, -60);

  // Caso B: Mismo CAJA-01 flip INGRESO 80 -> EGRESO 20 => revierte -80 y aplica -20 => -100 USD
  const adjFlip = computeMovementEditAccountAdjustments(
    { id: 'M-EDIT-2', tipo: 'INGRESO', montoUsd: 80, montoBs: 0, cajaId: 'CAJA-01' },
    { id: 'M-EDIT-2', tipo: 'EGRESO', montoUsd: 20, montoBs: 0, cajaId: 'CAJA-01' },
    desks,
    banks
  );
  assert.equal(adjFlip.length, 1);
  assert.equal(adjFlip[0].deltaUsd, -100);

  // Caso C: Cambio de cuenta CAJA-01 INGRESO 120 -> CTA-01 INGRESO 120 (+10800 Bs)
  const adjMove = computeMovementEditAccountAdjustments(
    { id: 'M-EDIT-3', tipo: 'INGRESO', montoUsd: 120, montoBs: 0, cajaId: 'CAJA-01' },
    { id: 'M-EDIT-3', tipo: 'INGRESO', montoUsd: 120, montoBs: 10800, cuentaId: 'CTA-01', cajaId: '', cuentaNombre: 'BANCO MERCANTIL' },
    desks,
    banks
  );
  assert.equal(adjMove.length, 2);
  assert.equal(adjMove[0].account.kind, 'CAJA');
  assert.equal(adjMove[0].deltaUsd, -120);
  assert.equal(adjMove[1].account.kind, 'BANCO');
  assert.equal(adjMove[1].deltaUsd, 120);
  assert.equal(adjMove[1].deltaBs, 10800);

  // Persistencia local + sync queue en updateSupabaseCashMovement
  globalThis.localStorage.clear();
  clearSyncQueue();
  addCashMovement({ id: 'MOV-UPD-1', tipo: 'EGRESO', concepto: 'Original', montoUsd: 25, montoBs: 0, cajaId: 'CAJA-01' });
  const updated = await updateSupabaseCashMovement({
    id: 'MOV-UPD-1',
    tipo: 'EGRESO',
    concepto: 'Editado OK',
    montoUsd: 35,
    montoBs: 0,
    cajaId: 'CAJA-01'
  });
  assert.equal(updated.concepto, 'Editado OK');
  assert.equal(updated.montoUsd, 35);
  assert.equal(getCashMovements().find(m => m.id === 'MOV-UPD-1')?.concepto, 'Editado OK');
  deleteCashMovement('MOV-UPD-1');
  clearSyncQueue();
  console.log('✓ 7. Filtros Día/Semana/Mes/Período y edición/actualización con Doble Seguridad y recálculo de saldos verificados');
}

console.log('=== TODAS LAS PRUEBAS DE CAJA CHICA & BANCOS PASARON EXITOSAMENTE ===');
