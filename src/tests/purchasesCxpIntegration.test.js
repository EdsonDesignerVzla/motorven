import assert from 'assert';
import {
  saveSupabaseProfitAccountsPayable,
  deleteSupabaseProfitAccountsPayable
} from '../services/supabaseService.js';

console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN COMPRAS -> CUENTAS POR PAGAR (CXP) ---');

// 1. Verificación de cálculo neto de CxP con Retención de IVA y Retención de ISLR
console.log('1. Verificando cálculo de monto neto a pagar en compras fiscales con retenciones SENIAT...');

const subtotalUsd = 1000.00;
const ivaUsd = 160.00; // 16%
const totalFacturaUsd = 1160.00;
const retIvaUsd = 120.00; // 75% del IVA
const retIslrUsd = 20.00; // 2% sobre base imponible
const netoPagarCalculadoUsd = Number((totalFacturaUsd - retIvaUsd - retIslrUsd).toFixed(2));

assert.strictEqual(netoPagarCalculadoUsd, 1020.00, 'El neto a pagar debe ser $1,020.00 tras retener IVA e ISLR');
console.log('  ✓ Cálculo de neto a pagar verificado: $1,020.00 ($1,160 total - $120 Ret. IVA - $20 Ret. ISLR).');

// 2. Verificando persistencia y normalización de documento CxP
console.log('2. Verificando guardado y normalización de Cuenta por Pagar (saveSupabaseProfitAccountsPayable)...');

const testPayable = {
  id: 'DOC-CP-FACT-TEST-9982-J311153659',
  tipoDoc: 'FACT',
  nroDoc: 'TEST-9982',
  coProv: 'J-31115365-9',
  provNombre: 'KEYSTONE, C.A.',
  provRif: 'J-31115365-9',
  fechaEmision: '2026-11-12',
  fechaVencimiento: '2026-12-12',
  diasCredito: 30,
  montoNetUsd: netoPagarCalculadoUsd,
  saldoUsd: netoPagarCalculadoUsd,
  abonosUsd: 0,
  tasa: 899.27,
  moneda: 'US$',
  observaciones: 'Compra FACTURA #TEST-9982 - Oilstone 15W40',
  historialPagos: []
};

const savedPayable = await saveSupabaseProfitAccountsPayable(testPayable);
assert.ok(savedPayable, 'El documento CxP debe haberse guardado');
assert.strictEqual(savedPayable.nroDoc, 'TEST-9982', 'El número de documento debe coincidir');
assert.strictEqual(savedPayable.montoNetUsd, 1020.00, 'El monto neto debe ser 1020.00');
assert.strictEqual(savedPayable.saldoUsd, 1020.00, 'El saldo pendiente inicial debe ser 1020.00');
assert.strictEqual(savedPayable.diasCredito, 30, 'Los días de crédito deben ser 30');
console.log('  ✓ Cuenta por Pagar guardada y validada en almacenamiento unificado.');

// 3. Verificando afectación de saldo por Nota de Crédito del proveedor
console.log('3. Verificando afectación de saldo por Nota de Crédito...');

const ncMontoUsd = 200.00;
const nuevoSaldoUsd = Number((savedPayable.saldoUsd - ncMontoUsd).toFixed(2));
const nuevoAbonosUsd = Number(((savedPayable.abonosUsd || 0) + ncMontoUsd).toFixed(2));

const updatedByNc = await saveSupabaseProfitAccountsPayable({
  ...savedPayable,
  saldoUsd: nuevoSaldoUsd,
  abonosUsd: nuevoAbonosUsd,
  observaciones: `${savedPayable.observaciones} | Afectada por NC #NC-001 (-$200.00)`
});

assert.strictEqual(updatedByNc.saldoUsd, 820.00, 'El saldo de la factura tras la NC debe reducirse a $820.00');
assert.strictEqual(updatedByNc.abonosUsd, 200.00, 'El monto acreditado/abonado debe ser $200.00');
console.log('  ✓ Saldo de factura ajustado correctamente por Nota de Crédito: Nuevo saldo $820.00.');

// 4. Verificando pago y liquidación de Cuenta por Pagar
console.log('4. Verificando liquidación de saldo a $0 (Estatus Solvente / Pagada)...');

const liquidacionUsd = 820.00;
const finalSaldoUsd = Number(Math.max(0, updatedByNc.saldoUsd - liquidacionUsd).toFixed(2));
const finalAbonosUsd = Number((updatedByNc.abonosUsd + liquidacionUsd).toFixed(2));

const fullyPaid = await saveSupabaseProfitAccountsPayable({
  ...updatedByNc,
  saldoUsd: finalSaldoUsd,
  abonosUsd: finalAbonosUsd,
  historialPagos: [{
    pagoNum: 'PAG-TEST-01',
    fechaPago: '2026-11-12',
    montoUsd: liquidacionUsd,
    formaPago: 'TRANS',
    referencia: 'REF-BNC-88219'
  }]
});

assert.strictEqual(fullyPaid.saldoUsd, 0.00, 'La factura debe quedar con saldo 0.00');
assert.strictEqual(fullyPaid.abonosUsd, 1020.00, 'El total acumulado de pagos y créditos debe ser $1,020.00');
assert.strictEqual(fullyPaid.historialPagos.length, 1, 'Debe registrarse el comprobante de pago');
console.log('  ✓ Factura liquidada al 100% (Saldo $0.00, Total pagado $1,020.00).');

// 4b. Verificando Factura Fiscal en Bolívares con IVA 16% y conversión equivalente USD <-> Bs
const tasaPrueba = 984.44;
const totalFacturaBs = 114195.04; // Bs. equiv. a $116.00 (Base $100 + IVA $16)
const baseBs = Number((totalFacturaBs / 1.16).toFixed(2));
const ivaBs = Number((totalFacturaBs - baseBs).toFixed(2));
const totalUsdEquiv = Number((totalFacturaBs / tasaPrueba).toFixed(2));
const ivaUsdEquiv = Number((ivaBs / tasaPrueba).toFixed(2));

assert.strictEqual(totalUsdEquiv, 116.00, 'La conversión de Bolívares a USD debe dar $116.00');
assert.strictEqual(ivaUsdEquiv, 16.00, 'El IVA equivalente en USD debe ser $16.00');

const savedFactBs = await saveSupabaseProfitAccountsPayable({
  id: 'DOC-CP-FACT-TEST-BS-9983-J311153659',
  tipoDoc: 'FACT',
  nroDoc: 'TEST-BS-9983',
  provNombre: 'KEYSTONE, C.A.',
  provRif: 'J-31115365-9',
  baseImponibleUsd: 100,
  baseImponibleBs: baseBs,
  ivaUsd: ivaUsdEquiv,
  ivaBs,
  montoNetUsd: totalUsdEquiv,
  montoNetBs: totalFacturaBs,
  saldoUsd: totalUsdEquiv,
  saldoBs: totalFacturaBs,
  tasa: tasaPrueba,
  moneda: 'BS'
});
assert.strictEqual(savedFactBs.ivaUsd, 16.00, 'Debe preservar el monto del IVA en Factura Fiscal');
assert.strictEqual(savedFactBs.moneda, 'BS', 'Debe preservar la moneda de ingreso en Bolívares');
await deleteSupabaseProfitAccountsPayable(savedFactBs).catch(() => {});

// 5. Limpieza del registro de prueba
console.log('5. Limpiando documento CxP de prueba...');
await deleteSupabaseProfitAccountsPayable(fullyPaid).catch(() => {});
console.log('  ✓ Limpieza completada.');

console.log('\n================================================================');
console.log('--- TODAS LAS PRUEBAS DE INTEGRACIÓN COMPRAS -> CXP PASARON AL 100% ---');
console.log('================================================================\n');
process.exit(0);
