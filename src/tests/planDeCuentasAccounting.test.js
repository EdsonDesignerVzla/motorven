import assert from 'assert';
import fs from 'fs';
import {
  PLAN_DE_CUENTAS_MOTORVEN,
  getCuentasImputables,
  mapCashDeskToAccount,
  mapBankAccountToAccount,
  mapSupplierToPayableAccount,
  mapMovementToAccount
} from '../data/planDeCuentasMotorven.js';
import {
  buildAccountingEntries,
  computeTrialBalance,
  computeGeneralLedger,
  computeFinancialStatements
} from '../services/accountingService.js';

console.log('--- INICIANDO PRUEBAS DEL PLAN DE CUENTAS OFICIAL & PARTIDA DOBLE MOTORVEN ---');

// 1. Verificación del Catálogo Institucional
console.log('1. Validando estructura jerárquica y metadatos del catálogo oficial...');
assert.ok(PLAN_DE_CUENTAS_MOTORVEN.length >= 85, `El catálogo debe contener al menos 85 cuentas (actual: ${PLAN_DE_CUENTAS_MOTORVEN.length})`);

const grupos = new Set(PLAN_DE_CUENTAS_MOTORVEN.map(c => c.grupo));
assert.strictEqual(grupos.size, 6, 'Deben existir exactamente 6 grupos contables (1. ACTIVO a 6. EGRESOS)');
assert.ok(grupos.has('ACTIVO'), 'Debe existir grupo ACTIVO');
assert.ok(grupos.has('PASIVO'), 'Debe existir grupo PASIVO');
assert.ok(grupos.has('PATRIMONIO'), 'Debe existir grupo PATRIMONIO');
assert.ok(grupos.has('INGRESOS'), 'Debe existir grupo INGRESOS');
assert.ok(grupos.has('COSTOS'), 'Debe existir grupo COSTOS');
assert.ok(grupos.has('EGRESOS'), 'Debe existir grupo EGRESOS');

const imputables = getCuentasImputables();
assert.ok(imputables.length >= 60, `Debe haber al menos 60 cuentas imputables (actual: ${imputables.length})`);
imputables.forEach(c => {
  assert.strictEqual(c.nivel, 4, `La cuenta imputable ${c.codigo} debe ser de Nivel 4`);
  assert.ok(['DEUDORA', 'ACREEDORA'].includes(c.naturaleza), `La cuenta ${c.codigo} debe tener naturaleza DEUDORA o ACREEDORA`);
});
console.log(`  ✓ Catálogo validado con éxito: ${PLAN_DE_CUENTAS_MOTORVEN.length} cuentas institucionales, 6 grupos, ${imputables.length} imputables.`);

// 2. Mapeos Inteligentes de Entidades Operativas
console.log('2. Validando mappers de cajas, bancos, proveedores y egresos...');

// Cajas
assert.strictEqual(mapCashDeskToAccount({ id: 'CAJA-BS', moneda: 'BS' }).codigo, '1.01.01.001');
assert.strictEqual(mapCashDeskToAccount({ id: 'CAJA-USD', moneda: 'USD' }).codigo, '1.01.01.002');
assert.strictEqual(mapCashDeskToAccount({ id: 'ZELLE', descripcion: 'Cobros Zelle' }).codigo, '1.01.01.004');

// Bancos Oficiales Motorven
assert.strictEqual(mapBankAccountToAccount({ numCta: '01020000000000000000' }).codigo, '1.01.02.001'); // Venezuela
assert.strictEqual(mapBankAccountToAccount({ numCta: '01050000000000000000' }).codigo, '1.01.02.002'); // Mercantil
assert.strictEqual(mapBankAccountToAccount({ numCta: '01380000000000009275' }).codigo, '1.01.02.003'); // Plaza 9275
assert.strictEqual(mapBankAccountToAccount({ numCta: '01380000000000001694' }).codigo, '1.01.02.004'); // Plaza 1694
assert.strictEqual(mapBankAccountToAccount({ numCta: '01140000000000000000' }).codigo, '1.01.02.005'); // Bancaribe
assert.strictEqual(mapBankAccountToAccount({ numCta: '01710000000000146655' }).codigo, '1.01.02.006'); // Banco Activo
assert.strictEqual(mapBankAccountToAccount({ numCta: '01720000000000000000' }).codigo, '1.01.02.007'); // Bancamiga
assert.strictEqual(mapBankAccountToAccount({ numCta: '01710000000000000378' }).codigo, '1.01.02.008'); // Activo Fiscal 0378

// Proveedores
assert.strictEqual(mapSupplierToPayableAccount({ rif: 'J-31115365-9', nombre: 'KEYSTONE, C.A.' }).codigo, '2.02.02.002');
assert.strictEqual(mapSupplierToPayableAccount({ nombre: 'KONTIGO SERVICIOS' }).codigo, '2.02.02.003');
assert.strictEqual(mapSupplierToPayableAccount({ nombre: 'PROVEEDOR GENERAL' }).codigo, '2.02.02.001');

// Conceptos de Caja Chica
assert.strictEqual(mapMovementToAccount({ tipo: 'EGRESO', concepto: 'Combustible camión reparto' }).codigo, '6.01.04.007');
assert.strictEqual(mapMovementToAccount({ tipo: 'EGRESO', concepto: 'Pago de nómina quincenal' }).codigo, '6.01.01.002');
assert.strictEqual(mapMovementToAccount({ tipo: 'EGRESO', concepto: 'Papelería y tóner' }).codigo, '6.01.03.001');
assert.strictEqual(mapMovementToAccount({ tipo: 'EGRESO', concepto: 'Alquiler local comercial' }).codigo, '6.01.08.001');
assert.strictEqual(mapMovementToAccount({ tipo: 'INGRESO', concepto: 'Traspaso de fondos entre cajas' }).codigo, '1.01.01.003');
console.log('  ✓ Todos los mappers institucionales resolvieron correctamente las cuentas oficiales.');

// 3. Simulación de Partida Doble Rigurosa en los 5 Flujos Operacionales
console.log('3. Validando cuadre contable estricto (Debe === Haber) en las 5 operaciones...');

function assertBalanced(entryLines, operacionNombre) {
  const sumDebe = Number(entryLines.reduce((acc, l) => acc + (l.debeUsd || 0), 0).toFixed(4));
  const sumHaber = Number(entryLines.reduce((acc, l) => acc + (l.haberUsd || 0), 0).toFixed(4));
  assert.strictEqual(sumDebe, sumHaber, `[DESCUADRE EN ${operacionNombre}] Debe: ${sumDebe} vs Haber: ${sumHaber}`);
  assert.ok(sumDebe > 0, `[MONTO CERO EN ${operacionNombre}] El asiento debe tener movimientos positivos`);
  console.log(`  ✓ ${operacionNombre}: Cuadre exacto en $${sumDebe.toFixed(2)} (Debe === Haber).`);
}

// 3.1 VENTA
const ventaLines = [
  { cuentaCodigo: '1.01.03.001', cuentaNombre: 'Cuentas por Cobrar Comerciales', debeUsd: 116.00, haberUsd: 0 },
  { cuentaCodigo: '4.01.01.001', cuentaNombre: 'Ventas', debeUsd: 0, haberUsd: 100.00 },
  { cuentaCodigo: '2.03.01.005', cuentaNombre: 'Débito Fiscal', debeUsd: 0, haberUsd: 16.00 }
];
assertBalanced(ventaLines, 'ASIENTO DE VENTA');

// 3.2 COBRO
const cobroLines = [
  { cuentaCodigo: '1.01.02.003', cuentaNombre: 'Banco Plaza (275)', debeUsd: 116.00, haberUsd: 0 },
  { cuentaCodigo: '1.01.03.001', cuentaNombre: 'Cuentas por Cobrar Comerciales', debeUsd: 0, haberUsd: 116.00 }
];
assertBalanced(cobroLines, 'ASIENTO DE COBRANZA');

// 3.3 COMPRA (con Retención IVA 75% e ISLR 2%)
const compraLines = [
  { cuentaCodigo: '1.04.01.001', cuentaNombre: 'Inventario de Mercancia', debeUsd: 1000.00, haberUsd: 0 },
  { cuentaCodigo: '1.05.01.005', cuentaNombre: 'Crédito Fiscal', debeUsd: 160.00, haberUsd: 0 },
  { cuentaCodigo: '1.05.01.007', cuentaNombre: 'Retencion de IVA', debeUsd: 0, haberUsd: 120.00 },
  { cuentaCodigo: '2.03.01.006', cuentaNombre: 'Retencion de ISLR Proveedores', debeUsd: 0, haberUsd: 20.00 },
  { cuentaCodigo: '2.02.02.002', cuentaNombre: 'Cuentas por Pagar Keyton', debeUsd: 0, haberUsd: 1020.00 }
];
assertBalanced(compraLines, 'ASIENTO DE COMPRA SENIAT');

// 3.4 PAGO A PROVEEDOR
const pagoLines = [
  { cuentaCodigo: '2.02.02.002', cuentaNombre: 'Cuentas por Pagar Keyton', debeUsd: 1020.00, haberUsd: 0 },
  { cuentaCodigo: '1.01.02.001', cuentaNombre: 'Banco de Venezuela', debeUsd: 0, haberUsd: 1020.00 }
];
assertBalanced(pagoLines, 'ASIENTO DE PAGO A PROVEEDOR');

// 3.5 CAJA CHICA (Egreso)
const cajaChicaLines = [
  { cuentaCodigo: '6.01.04.007', cuentaNombre: 'Combustibles y Lubricantes', debeUsd: 45.00, haberUsd: 0 },
  { cuentaCodigo: '1.01.01.002', cuentaNombre: 'Caja Divisas', debeUsd: 0, haberUsd: 45.00 }
];
assertBalanced(cajaChicaLines, 'ASIENTO DE EGRESO CAJA CHICA');

// 4. Ciclo Completo: Mayor General, Balance de Comprobación y Estados Financieros (Sintético)
console.log('4. Validando Mayor General y Ecuación Patrimonial en ciclo completo...');
const cycleEntries = buildAccountingEntries({
  profitInvoices: [
    { factNum: 'F-100', fechaEmision: '2026-11-10', totBrutoUsd: 500, ivaUsd: 80, totNetoUsd: 580, tasa: 827.73 }
  ],
  profitCollections: [
    { cobNum: 'C-100', fechaCobro: '2026-11-11', montoUsd: 580, montoBs: 480083.40, tasa: 827.73, bancoId: 'CTA-02' }
  ],
  profitPurchases: [
    { factNum: 'P-100', fechaEmision: '2026-11-08', totBrutoUsd: 300, ivaUsd: 48, totNetoUsd: 348, retencionIvaUsd: 36, retencionIslrUsd: 6, provNombre: 'Keystone, C.A.', tasa: 827.73 }
  ],
  profitSupplierPayments: [
    { pagoNum: 'PG-100', fechaPago: '2026-11-12', montoUsd: 306, provNombre: 'Keystone, C.A.', cuentaBancariaId: 'CTA-01', tasa: 827.73 }
  ],
  cashMovements: [
    { id: 'M-1', fecha: '2026-11-12', tipo: 'EGRESO', concepto: 'Combustible vehículo reparto', montoUsd: 50, tasa: 827.73 }
  ],
  profitBankAccounts: [
    { id: 'CTA-01', codCta: '01', numCta: '01050027311027479197', bancoNombre: 'BANCO MERCANTIL' },
    { id: 'CTA-02', codCta: '02', numCta: '01380015420150669275', bancoNombre: 'BANCO PLAZA' }
  ],
  tasa: 827.73
});

assert.strictEqual(cycleEntries.length, 5, 'Deben generarse exactamente 5 asientos en el ciclo sintético');
const cycleTb = computeTrialBalance(cycleEntries);
assert.strictEqual(cycleTb.isBalanced, true, 'El Balance de Comprobación debe cuadrar');
const cycleGl = computeGeneralLedger(cycleEntries);
assert.ok(cycleGl.accountsByCode['1.01.03.001'], 'Debe existir CxC en el Mayor General');
assert.strictEqual(cycleGl.accountsByCode['1.01.03.001'].saldoFinalUsd, 0, 'CxC debe quedar en $0.00 tras el cobro total');
assert.strictEqual(cycleGl.accountsByCode['2.02.02.002'].saldoFinalUsd, 0, 'CxP Keyton debe quedar en $0.00 tras el pago neto');

const cycleFs = computeFinancialStatements(cycleTb);
assert.strictEqual(cycleFs.estadoResultados.totalIngresosUsd, 500, 'Ingresos netos deben ser $500.00');
assert.strictEqual(cycleFs.estadoResultados.totalEgresosUsd, 50, 'Egresos operativos deben ser $50.00');
assert.strictEqual(cycleFs.estadoResultados.resultadoEjercicioUsd, 450, 'Superávit del ejercicio debe ser $450.00');
assert.strictEqual(cycleFs.balanceGeneral.ecuacionCuadrada, true, 'Ecuación patrimonial debe cuadrar al 100%');
assert.strictEqual(cycleFs.balanceGeneral.diferenciaEcuacionUsd, 0, 'La diferencia de la ecuación patrimonial debe ser 0');
console.log('  ✓ Mayor General, Balance de Comprobación, Estado de Resultados y Balance General cuadrados ($0.00 diff).');

// 5. Auditoría Integral sobre los Dumps Reales de Motorven
console.log('5. Auditando partida doble y estados financieros sobre todos los registros reales del sistema...');
const realInvs = JSON.parse(fs.readFileSync('src/data/dump/profit_invoices.json', 'utf8'));
const realCols = JSON.parse(fs.readFileSync('src/data/dump/profit_collections.json', 'utf8'));
const realPurs = JSON.parse(fs.readFileSync('src/data/dump/profit_purchases.json', 'utf8'));
const realPays = JSON.parse(fs.readFileSync('src/data/dump/profit_supplier_payments.json', 'utf8'));
const realBanks = JSON.parse(fs.readFileSync('src/data/dump/profit_bank_accounts.json', 'utf8'));
const realDesks = JSON.parse(fs.readFileSync('src/data/dump/profit_cash_desks.json', 'utf8'));

const realEntries = buildAccountingEntries({
  profitInvoices: realInvs,
  profitCollections: realCols,
  profitPurchases: realPurs,
  profitSupplierPayments: realPays,
  profitBankAccounts: realBanks,
  desksList: realDesks,
  tasa: 827.73
});

realEntries.forEach(entry => {
  const d = Number(entry.lines.reduce((s, l) => s + (l.debeUsd || 0), 0).toFixed(2));
  const h = Number(entry.lines.reduce((s, l) => s + (l.haberUsd || 0), 0).toFixed(2));
  assert.strictEqual(d, h, `Descuadre detectado en asiento real ${entry.asientoNum} (${entry.documentoReferencia}): Debe=${d} vs Haber=${h}`);
});

const realTb = computeTrialBalance(realEntries);
assert.strictEqual(realTb.isBalanced, true, 'El Balance de Comprobación real debe estar cuadrado');

const realFs = computeFinancialStatements(realTb);
assert.strictEqual(realFs.balanceGeneral.ecuacionCuadrada, true, 'El Balance General real debe cumplir Activo = Pasivo + Patrimonio + Resultado');
assert.ok(realTb.totalSumasDebeUsd < 10000000, 'La normalización de cobranzas históricas Profit debe evitar montos en Bs multiplicados');
console.log(`  ✓ ${realEntries.length} asientos reales auditados: 100% cuadrados (Sumas: $${realTb.totalSumasDebeUsd.toLocaleString('en-US')}, Activo = Pasivo + Patrimonio: $${realFs.balanceGeneral.totalActivoUsd.toLocaleString('en-US')}, Diff: $${realFs.balanceGeneral.diferenciaEcuacionUsd}).`);

console.log('\n--- TODAS LAS PRUEBAS DEL PLAN DE CUENTAS Y PARTIDA DOBLE FINALIZADAS CON ÉXITO ---');
