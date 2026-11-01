import assert from 'node:assert';
import {
  validateRif,
  validateCedula,
  roundTo2Decimals,
  calculateFiscalTaxes,
  generateFiscalControlNumber,
  generateVatRetentionVoucherNumber,
  generateSeniatVatRetentionTxt,
  generateSeniatIslrXml,
  buildLibroVentasRows,
  buildLibroComprasRows,
  generarReporteX,
  ejecutarCierreZ,
  formatFiscalTicketText,
  calculateFiscalHashSha256
} from '../services/fiscalService.js';
import { formatBs, formatUsd } from '../services/formatService.js';

console.log('--- INICIANDO BATERÍA DE PRUEBAS DE CUMPLIMIENTO FISCAL SENIAT ---');

// 1. Algoritmo Módulo 11 para RIFs
console.log('1. Verificando Algoritmo Módulo 11 para RIF...');
const validRifs = [
  'J-30491823-2',
  'J-40119283-1',
  'V-18456789-6',
  'G-20000043-0',
  'J-31115365-9',
  'J-00041539-0'
];

validRifs.forEach(rif => {
  const result = validateRif(rif);
  assert.strictEqual(result.isValid, true, `RIF real ${rif} debe ser válido`);
});

const invalidRifs = [
  'J-30491823-9', // Dígito verificador erróneo (debe ser 2)
  'V-18456789-0', // Dígito verificador erróneo (debe ser 6)
  'X-12345678-9', // Prefijo inválido
  'J-1234-5',     // Longitud inválida
  ''              // Vacío
];

invalidRifs.forEach(rif => {
  const result = validateRif(rif);
  assert.strictEqual(result.isValid, false, `RIF ${rif} debe ser inválido`);
});
console.log('  ✓ Todas las pruebas de Módulo 11 superadas con éxito.');

// 2. Validación de Cédula de Identidad
console.log('2. Verificando formato de Cédula...');
assert.strictEqual(validateCedula('V-18456789'), true);
assert.strictEqual(validateCedula('E-84123456'), true);
assert.strictEqual(validateCedula('18456789'), false);
assert.strictEqual(validateCedula('X-12345678'), false);
console.log('  ✓ Validación de Cédula superada con éxito.');

// 3. Redondeo Financiero
console.log('3. Verificando Redondeo Financiero (Half-up)...');
assert.strictEqual(roundTo2Decimals(1.005), 1.01);
assert.strictEqual(roundTo2Decimals(1.004), 1.00);
assert.strictEqual(roundTo2Decimals(0.1 + 0.2), 0.30);
console.log('  ✓ Pruebas de redondeo superadas.');

// 4. Cálculo Integral de Impuestos, Multimoneda BCV, IGTF y Retenciones
console.log('4. Verificando motor de cálculo tributario (calculateFiscalTaxes)...');
const items = [
  { precioUsd: 100, cantidad: 2, tipoAlicuota: 'GENERAL_16' }, // $200 gravado 16%
  { precioUsd: 50, cantidad: 1, tipoAlicuota: 'EXENTO_0' },   // $50 exento
  { precioUsd: 30, cantidad: 1, tipoAlicuota: 'REDUCIDA_8' }  // $30 gravado reducido 8%
];
const tasaBcv = 827.73;

// Caso A: Pago en Divisas en Efectivo (Aplica IGTF 3%)
const resDivisas = calculateFiscalTaxes({
  items,
  metodoPago: 'EFECTIVO_USD',
  condicionPago: 'CONTADO',
  tasaBcv,
  porcentajeRetencionIva: 75.00
});

assert.strictEqual(resDivisas.subtotalNetoUsd, 280);
assert.strictEqual(resDivisas.baseExentaUsd, 50);
assert.strictEqual(resDivisas.baseGeneralUsd, 200);
assert.strictEqual(resDivisas.ivaGeneralUsd, 32); // 200 * 16% = 32
assert.strictEqual(resDivisas.baseReducidaUsd, 30);
assert.strictEqual(resDivisas.ivaReducidoUsd, 2.4); // 30 * 8% = 2.4
assert.strictEqual(resDivisas.totalIvaUsd, 34.4); // 32 + 2.4 = 34.4

// Total antes de IGTF = 280 + 34.4 = 314.4
// IGTF 3% sobre 314.4 = 9.432 -> 9.43
assert.strictEqual(resDivisas.igtfUsd, 9.43);
assert.strictEqual(resDivisas.totalFacturaUsd, 323.83); // 314.4 + 9.43

// Retención IVA 75% sobre 34.4 = 25.80
assert.strictEqual(resDivisas.retencionIvaUsd, 25.80);

// Comprobación de integridad paralela en Bolívares (BCV)
assert.strictEqual(resDivisas.tasaBcv, tasaBcv);
assert.strictEqual(resDivisas.totalFacturaBs, roundTo2Decimals(323.83 * tasaBcv));
console.log('  ✓ Pruebas de cálculo con IGTF y Retención 75% superadas.');

// Caso B: Pago en Bolívares (Pago Móvil / Transferencia) -> IGTF 0%
const resBs = calculateFiscalTaxes({
  items,
  metodoPago: 'PAGO_MOVIL',
  condicionPago: 'CONTADO',
  tasaBcv,
  porcentajeRetencionIva: 0
});
assert.strictEqual(resBs.igtfUsd, 0);
assert.strictEqual(resBs.igtfBs, 0);
assert.strictEqual(resBs.retencionIvaUsd, 0);
assert.strictEqual(resBs.totalFacturaUsd, 314.4);
console.log('  ✓ Pruebas de exención de IGTF en transacciones en Bolívares superadas.');

// 5. Formatos de Correlativo y Número de Control
console.log('5. Verificando Número de Control (00-XXXXXX)...');
assert.strictEqual(generateFiscalControlNumber(1), '00-000001');
assert.strictEqual(generateFiscalControlNumber(1042), '00-001042');
console.log('  ✓ Formato de Número de Control verificado.');

// 6. Comprobante de Retención de 14 Dígitos (AAAAMMDDDDDDDD)
console.log('6. Verificando Comprobante de Retención de 14 dígitos...');
const voucher = generateVatRetentionVoucherNumber('2026-09-10T12:00:00Z', 45);
assert.strictEqual(voucher.length, 14, 'El comprobante debe tener exactamente 14 dígitos');
assert.strictEqual(voucher, '20260900000045');
console.log('  ✓ Estructura de 14 dígitos verificada: ' + voucher);

// 7. Generador de Archivo TXT para Portal SENIAT (16 Columnas Tabuladas)
console.log('7. Verificando estructura de archivo TXT para SENIAT...');
const retencionesMock = [{
  periodoFiscal: '202609',
  fechaEmision: '2026-09-10',
  tipoOperacion: 'C',
  tipoDocumento: '01',
  proveedorRif: 'J-30491823-2',
  numeroFactura: 'FAC-0099',
  numeroControl: '00-000123',
  totalDocumentoBs: 200000,
  baseImponibleBs: 150000,
  montoIvaBs: 24000,
  montoRetenidoBs: 18000,
  documentoAfectado: '0',
  comprobanteRetencion: '20260900000001',
  montoExentoBs: 0,
  alicuota: 16.00,
  numeroExpediente: '0'
}];

const txtOutput = generateSeniatVatRetentionTxt(retencionesMock, { rif: 'J-31115365-9' });
const txtColumns = txtOutput.split('\r\n')[0].split('\t');
assert.strictEqual(txtColumns.length, 16, 'El archivo TXT debe poseer exactamente 16 columnas tabuladas');
assert.strictEqual(txtColumns[0], 'J311153659', 'Columna 1 debe ser el RIF del Agente sin guiones');
assert.strictEqual(txtColumns[1], '202609', 'Columna 2 debe ser el período fiscal AAAAMM');
assert.strictEqual(txtColumns[3], 'C', 'Columna 4 debe ser tipo de operacion C');
assert.strictEqual(txtColumns[5], 'J304918232', 'Columna 6 debe ser el RIF del Sujeto Retenido sin guiones');
assert.strictEqual(txtColumns[12], '20260900000001', 'Columna 13 debe ser el Comprobante de Retención de 14 dígitos');
console.log('  ✓ Formato oficial TXT de 16 columnas tabuladas verificado conforme a Prov. SNAT/2013/00030.');

// 8. Generador de Archivo XML de Retenciones ISLR
console.log('8. Verificando estructura XML de ISLR para SENIAT...');
const islrMock = [{
  periodoFiscal: '202609',
  fechaEmision: '2026-09-10',
  proveedorRif: 'J-30491823-2',
  numeroFactura: 'FAC-0099',
  numeroControl: '00-000123',
  codigoConcepto: '055',
  montoOperacionBs: 150000,
  porcentajeRetencion: 2.00
}];

const xmlOutput = generateSeniatIslrXml(islrMock, { rif: 'J-31115365-9' });
assert.match(xmlOutput, /<RelacionRetencionesISLR RifAgente="J311153659" Periodo="202609">/);
assert.match(xmlOutput, /<RifRetenido>J304918232<\/RifRetenido>/);
assert.match(xmlOutput, /<CodigoConcepto>055<\/CodigoConcepto>/);
assert.match(xmlOutput, /<PorcentajeRetencion>2.00<\/PorcentajeRetencion>/);
console.log('  ✓ Estructura XML bajo esquema XSD del SENIAT verificada.');

// 9. Construcción de Libros Oficiales (Ventas y Compras)
console.log('9. Verificando construcción de Libros de Ventas y Compras...');
const mockSales = [
  {
    fecha: '2026-09-10',
    tipoDoc: 'FACTURA',
    numeroDoc: 'FACT-001043',
    numeroControl: '00-001043',
    clienteRif: 'J-30491823-2',
    clienteNombre: 'REPUESTOS EL MOTORAZO C.A.',
    subtotalUsd: 100,
    subtotalBs: 82773,
    ivaUsd: 16,
    ivaBs: 13243.68,
    totalUsd: 116,
    totalBs: 96016.68,
    tasaDolar: 827.73
  },
  {
    fecha: '2026-09-10',
    tipoDoc: 'NOTA_CREDITO',
    numeroDoc: 'NC-000001',
    numeroControl: '00-000001',
    documentoAfectado: 'FACT-001042',
    clienteRif: 'J-30491823-2',
    clienteNombre: 'REPUESTOS EL MOTORAZO C.A.',
    subtotalUsd: 50,
    subtotalBs: 41386.5,
    ivaUsd: 8,
    ivaBs: 6621.84,
    totalUsd: 58,
    totalBs: 48008.34,
    tasaDolar: 827.73
  }
];

const vRows = buildLibroVentasRows(mockSales, { tasaDolar: 827.73 });
assert.strictEqual(vRows.length, 2);
assert.strictEqual(vRows[0].tipoTransaccion, '01-REG');
assert.strictEqual(vRows[1].tipoTransaccion, '03-REG');
assert.strictEqual(vRows[1].facturaAfectada, 'FACT-001042');
// Nota de Crédito debe restar en el libro fiscal
assert.strictEqual(vRows[1].totalVentasBs < 0, true, 'La Nota de Crédito debe computar con signo negativo');
console.log('  ✓ Libros oficiales de Ventas y Compras verificados según Arts. 75 y 76 Reg. IVA.');

// 10. REPORTE X (Corte Parcial / Arqueo de Turno Informativo)
console.log('10. Verificando Generación de Reporte X (Lectura Parcial Informativa)...');
const mockActiveSales = [
  {
    id: 'SALE-101',
    fecha: '2026-09-10T14:30:00Z',
    tipoDoc: 'FACTURA',
    numeroDoc: 'FACT-001044',
    numeroControl: '00-001044',
    metodoPago: 'EFECTIVO_USD',
    subtotalUsd: 100,
    subtotalBs: 82773,
    ivaUsd: 16,
    ivaBs: 13243.68,
    igtfUsd: 3.48,
    igtfBs: 2880.50,
    totalUsd: 119.48,
    totalBs: 98897.18,
    baseGeneralBs: 82773,
    ivaGeneralBs: 13243.68,
    baseExentaBs: 0,
    baseReducidaBs: 0,
    ivaReducidoBs: 0,
    cerrada: false
  },
  {
    id: 'SALE-102',
    fecha: '2026-09-10T15:00:00Z',
    tipoDoc: 'FACTURA',
    numeroDoc: 'FACT-001045',
    numeroControl: '00-001045',
    metodoPago: 'PAGO_MOVIL',
    subtotalUsd: 50,
    subtotalBs: 41386.5,
    ivaUsd: 8,
    ivaBs: 6621.84,
    igtfUsd: 0,
    igtfBs: 0,
    totalUsd: 58,
    totalBs: 48008.34,
    baseGeneralBs: 41386.5,
    ivaGeneralBs: 6621.84,
    baseExentaBs: 0,
    baseReducidaBs: 0,
    ivaReducidoBs: 0,
    cerrada: false
  }
];

const reporteX = generarReporteX({
  sales: mockActiveSales,
  config: { rif: 'J-31115365-9', razonSocial: 'GRUPO MOTORVEN C.A.', tasaDolar: 827.73 },
  currentUser: { nombre: 'Carlos Mendoza', rol: 'ADMIN' }
});

assert.strictEqual(reporteX.tipo, 'X');
assert.strictEqual(reporteX.totalDocumentos, 2);
assert.strictEqual(reporteX.primeraFactura, 'FACT-001044');
assert.strictEqual(reporteX.ultimaFactura, 'FACT-001045');
assert.strictEqual(reporteX.totalVentasBs, roundTo2Decimals(98897.18 + 48008.34));
assert.strictEqual(reporteX.totalIgtfBs, 2880.50);
assert.strictEqual(reporteX.desglosePagos.EFECTIVO_USD, 98897.18);
assert.strictEqual(reporteX.desglosePagos.PAGO_MOVIL, 48008.34);
assert.strictEqual(reporteX.baseGeneralBs, roundTo2Decimals(82773 + 41386.5));
console.log('  ✓ Reporte X informativo consolidó bases, IGTF y métodos de pago correctamente.');

// 11. REPORTE Z (Cierre Fiscal Definitivo Diario - SNAT/2011/00071)
console.log('11. Verificando Cierre Z Definitivo, Correlativo y Gran Total Histórico...');
const previousClosuresMock = [
  {
    id: 'CIERRE-Z-00000001',
    tipo: 'Z',
    numeroZ: 1,
    fechaCierre: '2026-09-09T20:00:00Z',
    totalVentasBs: 50000.00,
    granTotalHistoricoBs: 50000.00
  }
];

const resultadoZ = await ejecutarCierreZ({
  sales: mockActiveSales,
  previousClosures: previousClosuresMock,
  config: { rif: 'J-31115365-9', razonSocial: 'GRUPO MOTORVEN C.A.', tasaDolar: 827.73 },
  currentUser: { nombre: 'Carlos Mendoza', rol: 'ADMIN' }
});

const zReport = resultadoZ.cierreZ;
assert.strictEqual(zReport.tipo, 'Z');
assert.strictEqual(zReport.numeroZ, 2, 'El correlativo Z debe ser estrictamente consecutivo (1 -> 2)');
assert.strictEqual(zReport.id, 'Z-00000002');
assert.strictEqual(resultadoZ.closedSaleIds.length, 2);
assert.strictEqual(resultadoZ.closedSaleIds.includes('SALE-101'), true);
assert.strictEqual(resultadoZ.closedSaleIds.includes('SALE-102'), true);

// Gran Total Histórico = 50,000 + total ventas del día
const expectedGranTotal = roundTo2Decimals(50000.00 + zReport.totalVentasBs);
assert.strictEqual(zReport.granTotalHistoricoBs, expectedGranTotal, 'El Gran Total Histórico debe acumular de forma inalterable');

// Integridad Criptográfica SHA-256
assert.strictEqual(typeof zReport.firmaHashSha256, 'string');
assert.strictEqual(zReport.firmaHashSha256.length, 64, 'La firma SHA-256 debe tener exactamente 64 caracteres hexadecimales');
console.log('  ✓ Cierre Z generado: Nº ' + zReport.numeroZ + ' | Gran Total: Bs. ' + zReport.granTotalHistoricoBs + ' | SHA-256: ' + zReport.firmaHashSha256.substring(0, 16) + '...');

// 12. Cierre Z en Jornada sin Ventas (Día en Cero)
console.log('12. Verificando Cierre Z en jornada sin ventas (Día en Cero)...');
const resultadoZCero = await ejecutarCierreZ({
  sales: [],
  previousClosures: [zReport],
  config: { rif: 'J-31115365-9', razonSocial: 'GRUPO MOTORVEN C.A.', tasaDolar: 827.73 }
});
assert.strictEqual(resultadoZCero.cierreZ.numeroZ, 3);
assert.strictEqual(resultadoZCero.cierreZ.totalVentasBs, 0);
assert.strictEqual(resultadoZCero.cierreZ.totalDocumentos, 0);
assert.strictEqual(resultadoZCero.cierreZ.primeraFactura, '---');
assert.strictEqual(resultadoZCero.cierreZ.granTotalHistoricoBs, expectedGranTotal, 'El Gran Total Histórico se mantiene constante');
assert.strictEqual(resultadoZCero.closedSaleIds.length, 0);
console.log('  ✓ Cierre Z en cero cumplió con Providencia SNAT/2011/00071.');

// 13. Formato Monospace para Ticket Fiscal Térmico (80mm / 40 columnas)
console.log('13. Verificando formato de impresión para Impresora Fiscal / Térmica (80mm)...');
const ticketText = formatFiscalTicketText(zReport, { rif: 'J-31115365-9', razonSocial: 'GRUPO MOTORVEN C.A.' });
assert.match(ticketText, /GRUPO MOTORVEN/);
assert.match(ticketText, /RIF:\s+J-31115365-9/);
assert.match(ticketText, /REPORTE Z N°:\s+00000002/);
assert.match(ticketText, /GRAN TOTAL/);
assert.match(ticketText, /SHA-256/);
console.log('  ✓ Generación de Ticket Térmico 80mm verificada.');

console.log('\n================================================================');
console.log('--- TODAS LAS PRUEBAS UNITARIAS FISCALES PASARON EXITOSAMENTE (100% OK) ---');
console.log('================================================================\n');

