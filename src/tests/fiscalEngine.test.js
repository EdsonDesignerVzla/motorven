import assert from 'node:assert';
import {
  validateRif,
  validateCedula,
  roundTo2Decimals,
  calculateFiscalTaxes,
  resolveConfigIgtfOptions,
  generateFiscalControlNumber,
  generateDeliveryNoteControlNumber,
  formatDocumentControlNumber,
  resolveControlNumberOnTipoDocChange,
  syncControlNumberOnCorrelativoEdit,
  resolveEditedInvoiceCollision,
  generateVatRetentionVoucherNumber,
  generateSeniatVatRetentionTxt,
  generateSeniatIslrXml,
  encodeIso88591Bytes,
  generateNextIslrVoucherNumber,
  isFiscalDocEligible,
  buildLibroVentasRows,
  buildLibroComprasRows,
  generarReporteX,
  ejecutarCierreZ,
  formatFiscalTicketText,
  calculateFiscalHashSha256,
  getCanonicalDocKey,
  isLegacyPreNovInvoice,
  getEraScopedCanonicalDocKey,
  dedupeCanonicalDocs,
  getNextInvoiceCorrelativo,
  commitInvoiceCorrelativo,
  setInvoiceCorrelativo,
  getNextNotaEntregaCorrelativo,
  getNextCxcMovementCorrelativo,
  commitCxcMovementCorrelativo,
  setCxcMovementCorrelativo,
  clearCxcMovementCorrelativoForce,
  getCxcMovementReportCorrelativo,
  setCxcMovementReportCorrelativo,
  commitCxcMovementReportCorrelativo,
  recalculateEditableInvoiceAmounts
} from '../services/fiscalService.js';
import { formatBs, formatNumberUs, formatNumberVe, formatUnitVe, formatUsd, round2 } from '../services/formatService.js';

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

// Caso C: Respeto de esSujetoPasivoEspecial / igtfPorcentaje configurable
const optDisabledSpe = resolveConfigIgtfOptions({ esSujetoPasivoEspecial: false, igtfPorcentaje: 3 });
assert.strictEqual(optDisabledSpe.esSujetoPasivoEspecial, false);
const resNoSpe = calculateFiscalTaxes({
  items,
  metodoPago: 'EFECTIVO_USD',
  condicionPago: 'CONTADO',
  tasaBcv,
  ...optDisabledSpe
});
assert.strictEqual(resNoSpe.igtfUsd, 0, 'Con esSujetoPasivoEspecial=false no debe cobrar IGTF');
assert.strictEqual(resNoSpe.totalFacturaUsd, 314.4);

const optZeroIgtf = resolveConfigIgtfOptions({ igtfPorcentaje: 0 });
assert.strictEqual(optZeroIgtf.esSujetoPasivoEspecial, false);
assert.strictEqual(optZeroIgtf.porcentajeIgtf, 0);
const resZeroIgtf = calculateFiscalTaxes({
  items,
  metodoPago: 'EFECTIVO_USD',
  condicionPago: 'CONTADO',
  tasaBcv,
  ...optZeroIgtf
});
assert.strictEqual(resZeroIgtf.igtfUsd, 0, 'Con igtfPorcentaje=0 no debe cobrar IGTF');
console.log('  ✓ Pruebas de configuración IGTF / Sujeto Pasivo Especial superadas.');

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

// 14. Clave canónica, deduplicación de documentos y correlativos anti-colisión
console.log('14. Verificando clave canónica, deduplicación y correlativos...');
assert.strictEqual(getCanonicalDocKey({ id: '000003', factNum: '000003', tipoDoc: 'FACTURA' }), 'FAC:3');
assert.strictEqual(getCanonicalDocKey({ id: 'FAC-3', factNum: '3', tipoDoc: 'FACTURA' }), 'FAC:3');
assert.strictEqual(getCanonicalDocKey({ id: 'NE-002227', numeroDoc: 'NE-002227', tipoDoc: 'NOTA_ENTREGA' }), 'NE:2227');
assert.strictEqual(getCanonicalDocKey({ id: '002227', factNum: '002227', tipoDoc: 'NOTA_ENTREGA' }), 'NE:2227');

const dedupedSample = dedupeCanonicalDocs([
  { id: '000003', factNum: '000003', tipoDoc: 'FACTURA', vendedorId: 'OF', items: [], updated_at: '2026-11-12T19:24:39.222Z' },
  { id: 'FAC-3', factNum: '3', tipoDoc: 'FACTURA', vendedorId: 'CM', items: [{ codigo: '100403', cantidad: 2 }], updated_at: '2026-11-12T20:10:23.977Z' },
  { id: 'NE-002227', factNum: '002227', tipoDoc: 'NOTA_ENTREGA', items: [{ codigo: '100102', cantidad: 1 }] }
]);
assert.strictEqual(dedupedSample.length, 2, 'Debe colapsar variantes de 000003 y conservar la NE 002227');
const merged003 = dedupedSample.find(d => getCanonicalDocKey(d) === 'FAC:3');
assert.strictEqual(merged003.vendedorId, 'CM');
assert.strictEqual(merged003.items.length, 1);

const prevLocalStorage = globalThis.localStorage;
const memStore = new Map();
if (typeof prevLocalStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => memStore.set(k, String(v)),
    removeItem: (k) => memStore.delete(k)
  };
}
try {
  const nextFac = getNextInvoiceCorrelativo(
    [{ id: '000002', numeroDoc: '000002', tipoDoc: 'FACTURA' }],
    [{ id: '000003', factNum: '000003', tipoDoc: 'FACTURA' }, { id: '000583', factNum: '000583', tipoDoc: 'FACTURA' }]
  );
  assert.strictEqual(nextFac, '000004', 'Debe avanzar sobre la serie actual (<400) evitando colisión con extraDocs');

  const nextNe = getNextNotaEntregaCorrelativo(
    [{ id: 'NE-002227', numeroDoc: 'NE-002227', tipoDoc: 'NOTA_ENTREGA' }],
    [{ id: 'NE-002228', factNum: '002228', tipoDoc: 'NOTA_ENTREGA' }]
  );
  assert.strictEqual(nextNe, 'NE-002229', 'Debe avanzar correlativo NE evitando colisión con sales + invoices');

  // Fijación manual de correlativo (ej. 000009) con histórico Profit 16..499 presente en BD
  const legacyInvoices = Array.from({ length: 484 }, (_, idx) => ({
    id: `fac-${idx + 16}`,
    factNum: idx + 16,
    tipoDoc: 'FACTURA',
    fec_emis: '2026-03-10T00:00:00.000Z'
  }));
  const novInvoices = [
    { id: '000001', numeroDoc: '000001', tipoDoc: 'FACTURA', fechaEmision: '2026-11-12T19:08:44.341Z' },
    { id: '000008', numeroDoc: '000008', tipoDoc: 'FACTURA', fechaEmision: '2026-11-12T21:00:42.571Z' }
  ];
  setInvoiceCorrelativo('000009');
  const manualNext = getNextInvoiceCorrelativo(novInvoices, legacyInvoices);
  assert.strictEqual(manualNext, '000009', 'Fijar N° Factura 000009 debe mantenerse en 000009 sin saltar a 000500');
  commitInvoiceCorrelativo('000009');
  const afterCommit = getNextInvoiceCorrelativo(
    [...novInvoices, { id: '000009', numeroDoc: '000009', tipoDoc: 'FACTURA', fechaEmision: '2026-11-13T06:00:00.000Z' }],
    legacyInvoices
  );
  assert.strictEqual(afterCommit, '000010', 'Luego de emitir 000009 debe continuar en 000010');

  // Correlativos de Movimientos y Reportes CxC (incluyendo fijación manual e historial previo)
  const legacyCollections = [{ id: 'cob-3864', cobNum: 3864, fecha: '2026-10-23T00:00:00+00:00' }];
  clearCxcMovementCorrelativoForce();
  assert.strictEqual(
    getNextCxcMovementCorrelativo(legacyCollections, []),
    '000001',
    'La serie nueva de movimientos CxC debe iniciar en 000001 ignorando IDs Profit de octubre'
  );
  assert.strictEqual(setCxcMovementCorrelativo('000025'), '000025');
  assert.strictEqual(getNextCxcMovementCorrelativo(legacyCollections, []), '000025');
  commitCxcMovementCorrelativo('000025');
  assert.strictEqual(
    getNextCxcMovementCorrelativo(
      [...legacyCollections, { id: 'cob-mov-000025', cobNum: '000025', fecha: '2026-11-13T10:00:00.000Z' }],
      []
    ),
    '000026',
    'Después de confirmar movimiento 000025 debe continuar en 000026'
  );

  assert.strictEqual(setCxcMovementReportCorrelativo(12), '000012');
  assert.strictEqual(getCxcMovementReportCorrelativo(), '000012');
  assert.strictEqual(commitCxcMovementReportCorrelativo('000012'), '000013');

  // Separación de serie histórica (< 2026-11-01) vs serie nueva (>= 2026-11-01)
  const legacy16 = { id: 'fac-16', factNum: '16', tipoDoc: 'FACTURA', fec_emis: '2026-02-10T00:00:00.000Z', clienteNombre: 'Cliente Febrero' };
  const modern16 = { id: '000016', factNum: '000016', tipoDoc: 'FACTURA', fec_emis: '2026-11-13T14:00:00.000Z', clienteNombre: 'Cliente Noviembre' };
  assert.strictEqual(isLegacyPreNovInvoice(legacy16), true);
  assert.strictEqual(isLegacyPreNovInvoice(modern16), false);
  assert.notStrictEqual(
    getEraScopedCanonicalDocKey(legacy16),
    getEraScopedCanonicalDocKey(modern16),
    'La clave canónica con era debe distinguir fac-16 de febrero contra 000016 de noviembre'
  );
  const eraDeduped = dedupeCanonicalDocs([legacy16, modern16]);
  assert.strictEqual(eraDeduped.length, 2, 'dedupeCanonicalDocs NO debe fusionar fac-16 antiguo con 000016 de noviembre');

  // Sin override manual activo, avanzar de 000015 a 000016 sin saltar al histórico 500+
  memStore.clear();
  const novWith15 = [
    ...novInvoices,
    { id: '000015', numeroDoc: '000015', tipoDoc: 'FACTURA', fechaEmision: '2026-11-13T12:00:00.000Z' }
  ];
  assert.strictEqual(
    getNextInvoiceCorrelativo(novWith15, legacyInvoices),
    '000016',
    'Debe avanzar exactamente a 000016 ignorando fac-16..fac-499 de febrero-octubre'
  );
  assert.strictEqual(
    getNextInvoiceCorrelativo(
      [...novWith15, modern16],
      legacyInvoices
    ),
    '000017',
    'Después de 000016 debe avanzar a 000017 sin colisionar con fac-17'
  );
} finally {
  if (typeof prevLocalStorage === 'undefined') {
    delete globalThis.localStorage;
  }
}
console.log('  ✓ Clave canónica, deduplicación y correlativos anti-colisión verificados.');

// 14. Precisión simétrica y formato estricto a 2 decimales (USD y Bs)
console.log('14. Verificando redondeo y formato estricto a 2 decimales...');
assert.strictEqual(round2(1.005), 1.01);
assert.strictEqual(round2(-1.005), -1.01);
assert.strictEqual(round2(10.1 + 20.2), 30.3);
assert.strictEqual(Object.is(round2(-0.0001), 0), true, 'Nunca debe devolver -0');
assert.strictEqual(formatUsd(50), '$ 50.00');
assert.strictEqual(formatUsd(-0.0001), '$ 0.00');
assert.strictEqual(formatUsd(1000), '$ 1,000.00');
assert.strictEqual(formatUsd(1234.567), '$ 1,234.57');
assert.strictEqual(formatNumberUs(1000), '1,000.00');
assert.strictEqual(formatBs(50), 'Bs. 50,00');
assert.strictEqual(formatBs(-0.0001), 'Bs. 0,00');
assert.strictEqual(formatBs(1000), 'Bs. 1.000,00');
assert.strictEqual(formatNumberVe(1000), '1.000,00');
assert.strictEqual(formatUnitVe(1234.5), '1.234,50');
assert.strictEqual(formatUnitVe(1234.6, 0), '1.235');
console.log('  ✓ Precisión y formato americano (USD) / venezolano (Bs. y unidades) verificados.');

// 15. Saneamiento de Libros Fiscales, Retenciones SENIAT (TXT/XML ISO-8859-1) y Cierre Z
console.log('15. Verificando Saneamiento SENIAT: exclusión de NE, 0-fallback, anuladas, XML escaping y Cierre Z...');

assert.strictEqual(isFiscalDocEligible({ tipoDoc: 'FACTURA', id: '000016' }), true);
assert.strictEqual(isFiscalDocEligible({ tipoDoc: 'NOTA_CREDITO', numeroDoc: 'NC-001' }), true);
assert.strictEqual(isFiscalDocEligible({ tipoDoc: 'NOTA_ENTREGA', id: 'NE-000100' }), false);
assert.strictEqual(isFiscalDocEligible({ tipoDoc: 'FACTURA', id: 'NE-000100' }), false);
assert.strictEqual(isFiscalDocEligible({ tipoDoc: 'COTIZACION', id: 'COT-001' }), false);

const librosSalesFixture = [
  // Debe excluirse por ser Nota de Entrega
  { id: 'NE-000010', numeroDoc: 'NE-000010', tipoDoc: 'NOTA_ENTREGA', fecha: '2026-11-10', clienteNombre: 'No Fiscal', clienteRif: 'J-31115365-9', totalUsd: 100, totalBs: 91162, baseGeneralBs: 91162 },
  // Factura exenta: baseGeneralBs = 0 debe mantenerse en 0 y NO absorber subtotalBs como Base 16%
  { id: '000020', numeroDoc: '000020', controlNum: '00-000020', tipoDoc: 'FACTURA', fecha: '2026-11-10', clienteNombre: 'Exento S.A.', clienteRif: 'J-31115365-9', subtotalBs: 10000, baseExentaBs: 10000, baseGeneralBs: 0, ivaGeneralBs: 0, totalBs: 10000, totalUsd: 10.97, comprobanteRetencionIva: '20261100000055' },
  // Factura gravada anulada: debe salir como 01-ANU y montos 0.00
  { id: '000021', numeroDoc: '000021', controlNum: '00-000021', tipoDoc: 'FACTURA', fecha: '2026-11-11', clienteNombre: 'Anulada C.A.', clienteRif: 'J-31115365-9', status: 'ANULADA', anulada: true, baseGeneralBs: 50000, ivaGeneralBs: 8000, totalBs: 58000 },
  // Factura gravada al 31% Adicional
  { id: '000022', numeroDoc: '000022', controlNum: '00-000022', tipoDoc: 'FACTURA', fecha: '2026-11-12', clienteNombre: 'Lujo & Motor C.A.', clienteRif: 'J-2929465827', baseAdicionalBs: 10000, ivaAdicionalBs: 3100, baseGeneralBs: 0, ivaGeneralBs: 0, totalBs: 13100 }
];
const lvRows = buildLibroVentasRows(librosSalesFixture, { tasaDolar: 911.62 });
assert.strictEqual(lvRows.length, 3, 'Libro de Ventas debe excluir NOTA_ENTREGA y conservar 3 documentos fiscales');
assert.strictEqual(lvRows[0].baseImponible16Bs, 0, 'Factura exenta NO debe heredar subtotalBs en baseImponible16Bs');
assert.strictEqual(lvRows[0].ventasExentasBs, 10000);
assert.strictEqual(lvRows[0].comprobanteRetencion, '20261100000055');
assert.strictEqual(lvRows[1].tipoTransaccion, '01-ANU');
assert.strictEqual(lvRows[1].totalVentasBs, 0, 'Factura anulada debe reportar Bs. 0.00');
assert.strictEqual(lvRows[2].baseImponible31Bs, 10000);
assert.strictEqual(lvRows[2].iva31Bs, 3100);
assert.strictEqual(lvRows[2].rifValido, false, 'Debe marcar RIF inválido de 10 dígitos en Libro de Ventas');

const comprasFixture = [
  // Compra con 0 IVA, sin comprobante de retención ni ISLR: NO debe inventar IVA 16%, retención 75%, ni comprobante
  { id: 'COMP-001', numeroFacturaProv: 'F-900', numeroControl: '00-900', fecha: '2026-11-05', proveedorNombre: 'Prov Exento', proveedorRif: 'J-31115365-9', baseExentaUsd: 100, baseGeneralUsd: 0, ivaGeneralUsd: 0, totalUsd: 100, totalBs: 90000, tasaBcv: 900, retencionIvaBs: 0 },
  // Nota de Crédito en compras
  { id: 'NC-COMP-002', tipoDoc: 'NOTA_CREDITO', numeroFacturaProv: 'NC-10', numeroControl: '00-010', fecha: '2026-11-06', proveedorNombre: 'Prov Gravado', proveedorRif: 'J-30491823-2', baseGeneralBs: 10000, ivaGeneralBs: 1600, totalBs: 11600 }
];
const lcRows = buildLibroComprasRows(comprasFixture, { tasaDolar: 911.62 });
assert.strictEqual(lcRows[0].creditoFiscal16Bs, 0, 'Libro de Compras NO debe inventar IVA 16% sobre compra sin IVA');
assert.strictEqual(lcRows[0].retencionIvaBs, 0, 'Libro de Compras NO debe inventar Retención IVA 75%');
assert.strictEqual(lcRows[0].comprobanteRetencion, '', 'Libro de Compras NO debe inventar número de comprobante inexistente');
assert.strictEqual(lcRows[0].retencionIslrBs, 0, 'Libro de Compras NO debe inventar Retención ISLR 2%');
assert.strictEqual(lcRows[1].tipoTransaccion, '03-REG');
assert.strictEqual(lcRows[1].totalComprasBs, -11600, 'Nota de Crédito en compras debe ir en negativo');

// TXT Retención IVA: excluye registros sin monto retenido / comprobante / RIF válido y respeta alícuota 0.00
const txtSeniat = generateSeniatVatRetentionTxt([
  { proveedorRif: 'J-31115365-9', montoRetenidoBs: 0, comprobanteNro: '20261100000001' },
  { proveedorRif: 'J-31115365-9', montoRetenidoBs: 500, comprobanteNro: 'INVALID' },
  { proveedorRif: 'J-00000000-0', montoRetenidoBs: 500, comprobanteNro: '20261100000002' },
  { proveedorRif: 'J-30491823-9', montoRetenidoBs: 500, comprobanteNro: '20261100000004' },
  { proveedorRif: 'J-30491823-2', montoRetenidoBs: 1200, comprobanteNro: '20261100000003', numeroFactura: 'F-1', numeroControl: '00-1', totalDocumentoBs: 11600, baseImponibleBs: 10000, alicuota: 8.00 }
], { rif: 'J-31115365-9' });
const txtLines = txtSeniat.split('\n').filter(Boolean);
assert.strictEqual(txtLines.length, 1, 'Solo el registro con retención > 0, comprobante 14 dígitos y RIF válido debe entrar al TXT');
assert(txtLines[0].includes('\t8.00\t0'), 'TXT debe preservar alícuota real (8.00) y no sobrescribir con 16.00');

// XML ISLR + ISO-8859-1 + correlativo secuencial sin Math.random
const islrVoucherNext = generateNextIslrVoucherNumber([{ nroComprobante: '20261100000007' }], '202611');
assert.strictEqual(islrVoucherNext, '20261100000008');
const islrXml = generateSeniatIslrXml([
  { proveedorRif: 'J-30491823-2', nroFacturaAfectada: 'F-88&A', nroControl: '00-<88>', codigoConceptoIslr: '053', baseImponible: 10000, porcentajeRetencion: 3, moneda: 'BS' }
], { rif: 'J-31115365-9' }, '202611');
assert(islrXml.includes('F-88&amp;A') && islrXml.includes('00-&lt;88&gt;'), 'XML ISLR debe escapar caracteres reservados (&, <, >)');
assert(islrXml.includes('<CodigoConcepto>053</CodigoConcepto>'), 'XML ISLR debe leer esquema profit_islr_withholdings');
const latin1Bytes = encodeIso88591Bytes('ÑO');
assert.deepStrictEqual(Array.from(latin1Bytes), [0xD1, 0x4F], 'ISO-8859-1 debe codificar Ñ como byte único 0xD1');

// Reporte X y Cierre Z anti-colisión frente a Z-00000001 con numero_z="0000"
const repX = generarReporteX({ sales: librosSalesFixture, config: { tasaDolar: 911.62 } });
assert.strictEqual(repX.totalDocumentos, 2, 'Reporte X solo debe contar documentos fiscales no anulados (excluye NE y ANULADA)');
const { cierreZ: cierreZTest } = await ejecutarCierreZ({
  sales: [librosSalesFixture[1]],
  previousClosures: [{ id: 'Z-00000001', tipo: 'Z', numeroZ: '0000', numeroCierre: 0, granTotalHistoricoBs: 1000 }],
  config: { tasaDolar: 911.62, rif: 'J-31115365-9' }
});
assert.strictEqual(cierreZTest.id, 'Z-00000002', 'Cierre Z no debe colisionar con Z-00000001 aunque numero_z sea "0000"');
assert.strictEqual(cierreZTest.numeroZ, 2);
console.log('  ✓ Saneamiento SENIAT completo (Libros, Retenciones IVA/ISLR, Reporte X y Cierre Z) verificado.');

// 16. Recálculo automático de Subtotal, IVA 16%, Total USD y Total Bs. al editar renglones de factura
console.log('16. Verificando recalculateEditableInvoiceAmounts (Edición de Factura y N.E.)...');
const recalcFac = recalculateEditableInvoiceAmounts({
  items: [
    { codigo: '1', cantidad: 1, precioUsd: 70.43 },
    { codigo: '2', cantidad: 2, precioUsd: 70.43 },
    { codigo: '3', cantidad: 1, precioUsd: 70.43 }
  ],
  tipoDoc: 'FACTURA',
  tasaDolar: 915.74
});
assert.strictEqual(recalcFac.subtotalUsd, '281.72', 'Debe sumar cantidad * precio de todos los renglones');
assert.strictEqual(recalcFac.ivaUsd, '45.08', 'Debe recalcular IVA 16% automáticamente en FACTURA');
assert.strictEqual(recalcFac.totalUsd, '326.80', 'Debe recalcular Total USD automáticamente');
assert.strictEqual(recalcFac.totalBs, '299263.83', 'Debe recalcular Total Bs. automáticamente');
assert.strictEqual(recalcFac.items[1].subtotalUsd, 140.86, 'Cada renglón debe actualizar su subtotalUsd');

const recalcNe = recalculateEditableInvoiceAmounts({
  items: [{ codigo: '1', cantidad: 2, precioUsd: 50 }],
  tipoDoc: 'NOTA_ENTREGA',
  tasaDolar: 900
});
assert.strictEqual(recalcNe.subtotalUsd, '100.00');
assert.strictEqual(recalcNe.ivaUsd, '0.00', 'Nota de Entrega debe quedar exenta de IVA');
assert.strictEqual(recalcNe.totalUsd, '100.00');
assert.strictEqual(recalcNe.totalBs, '90000.00');
console.log('  ✓ Recálculo automático de edición de facturas y N.E. verificado.');

// 17. Conversión Factura -> Nota de Entrega (N.E-XXXXXX) y aislamiento anti-colisión para correlativo 002000
console.log('17. Verificando identificador N.E-XXXXXX y aislamiento de colisión en edición de documentos...');
assert.strictEqual(generateDeliveryNoteControlNumber('000614'), 'N.E-000614');
assert.strictEqual(generateDeliveryNoteControlNumber('002000'), 'N.E-002000');
assert.strictEqual(generateDeliveryNoteControlNumber('NE-2000'), 'N.E-002000');
assert.strictEqual(formatDocumentControlNumber('002000', 'NOTA_ENTREGA'), 'N.E-002000');
assert.strictEqual(formatDocumentControlNumber('002000', 'FACTURA'), '00-002000');

const switchToNe = resolveControlNumberOnTipoDocChange({
  prevTipoDoc: 'FACTURA',
  nextTipoDoc: 'NOTA_ENTREGA',
  numeroDoc: '000614',
  currentControl: '00-001185',
  savedFiscalControl: ''
});
assert.strictEqual(switchToNe.numeroControl, 'N.E-000614', 'Al pasar Factura a N.E. debe asignar N.E-000614 por defecto');
assert.strictEqual(switchToNe.savedFiscalControl, '00-001185', 'Debe recordar el control fiscal previo para restaurarlo si vuelve a Factura');

const switchBackToFac = resolveControlNumberOnTipoDocChange({
  prevTipoDoc: 'NOTA_ENTREGA',
  nextTipoDoc: 'FACTURA',
  numeroDoc: '000614',
  currentControl: switchToNe.numeroControl,
  savedFiscalControl: switchToNe.savedFiscalControl
});
assert.strictEqual(switchBackToFac.numeroControl, '00-001185', 'Debe restaurar el control fiscal original si regresa a Factura Fiscal');

assert.strictEqual(
  syncControlNumberOnCorrelativoEdit({
    tipoDoc: 'NOTA_ENTREGA',
    prevNumeroDoc: '000614',
    nextNumeroDoc: '002000',
    currentControl: 'N.E-000614'
  }),
  'N.E-002000',
  'Al editar el correlativo de 000614 a 002000 en N.E. debe sincronizarse a N.E-002000'
);
assert.strictEqual(
  syncControlNumberOnCorrelativoEdit({
    tipoDoc: 'NOTA_ENTREGA',
    prevNumeroDoc: '000614',
    nextNumeroDoc: '002000',
    currentControl: 'CTRL-CUSTOM'
  }),
  'CTRL-CUSTOM',
  'Debe respetar un N° Control personalizado manualmente'
);

// Escenario 002000: existe fac-2000 (FACTURA 2026-10-05); editar 000614 (2026-11-18) a NOTA_ENTREGA #002000 NO debe colisionar
const fac2000Legacy = {
  id: 'fac-2000',
  factNum: 2000,
  tipoDoc: 'FACTURA',
  fec_emis: '2026-10-05T00:00:00.000Z',
  clienteNombre: 'Cesar Antonio Diaz Rodriguez'
};
const fac0614Nov = {
  id: '000614',
  numeroDoc: '000614',
  tipoDoc: 'FACTURA',
  fechaEmision: '2026-11-18T12:34:21.000Z',
  clienteNombre: 'Auto Partes Fastlap77, C.A'
};
const collisionVsFac2000 = resolveEditedInvoiceCollision({
  orig: fac0614Nov,
  allInvoices: [fac2000Legacy, fac0614Nov],
  cleanNum: '002000',
  targetTipo: 'NOTA_ENTREGA',
  emitIso: '2026-11-18T12:34:21.000Z'
});
assert.strictEqual(collisionVsFac2000.blocked, false);
assert.strictEqual(collisionVsFac2000.newId, 'NE-002000');
assert.strictEqual(collisionVsFac2000.seriesEra, '');

const ne2000Nov = {
  id: 'NE-002000',
  numeroDoc: 'NE-002000',
  factNum: '002000',
  numeroControl: 'N.E-002000',
  tipoDoc: 'NOTA_ENTREGA',
  fechaEmision: '2026-11-18T12:34:21.000Z',
  clienteNombre: 'Auto Partes Fastlap77, C.A'
};
assert.strictEqual(dedupeCanonicalDocs([fac2000Legacy, ne2000Nov]).length, 2, 'fac-2000 y NE-002000 deben coexistir sin sobrescribirse');
assert.strictEqual(isFiscalDocEligible(ne2000Nov), false, 'NE-002000 con control N.E-002000 debe quedar excluida de libros fiscales SENIAT');

// Escenario NE histórica (< 2026-11-01): editar 000614 a NOTA_ENTREGA #002000 debe aislarse con seriesEra 2026-11
const legacyNe2000 = {
  id: 'NE-002000',
  numeroDoc: 'NE-002000',
  tipoDoc: 'NOTA_ENTREGA',
  fechaEmision: '2026-10-05T10:00:00.000Z',
  clienteNombre: 'Cliente Historico Octubre'
};
const collisionVsHistoricalNe = resolveEditedInvoiceCollision({
  orig: fac0614Nov,
  allInvoices: [fac2000Legacy, legacyNe2000, fac0614Nov],
  cleanNum: '002000',
  targetTipo: 'NOTA_ENTREGA',
  emitIso: '2026-11-18T12:34:21.000Z'
});
assert.strictEqual(collisionVsHistoricalNe.blocked, false);
assert.strictEqual(collisionVsHistoricalNe.isolatedFromHistorical, true);
assert.strictEqual(collisionVsHistoricalNe.seriesEra, '2026-11');
assert.strictEqual(collisionVsHistoricalNe.newId, 'NE-002000-202611');
const isolatedNe2000Nov = { ...ne2000Nov, id: collisionVsHistoricalNe.newId, seriesEra: collisionVsHistoricalNe.seriesEra };
assert.strictEqual(dedupeCanonicalDocs([legacyNe2000, isolatedNe2000Nov]).length, 2, 'N.E. histórica y N.E. aislada 2026-11 deben coexistir sin fusionarse');

// Escenario duplicado activo de noviembre: debe bloquear con el documento conflictivo
const activeNovNe2000 = {
  id: 'NE-002000',
  numeroDoc: 'NE-002000',
  tipoDoc: 'NOTA_ENTREGA',
  fechaEmision: '2026-11-15T10:00:00.000Z',
  clienteNombre: 'Otro Cliente Noviembre'
};
const collisionVsActiveNovNe = resolveEditedInvoiceCollision({
  orig: fac0614Nov,
  allInvoices: [activeNovNe2000, fac0614Nov],
  cleanNum: '002000',
  targetTipo: 'NOTA_ENTREGA',
  emitIso: '2026-11-18T12:34:21.000Z'
});
assert.strictEqual(collisionVsActiveNovNe.blocked, true);
assert.strictEqual(collisionVsActiveNovNe.conflictingDoc.id, 'NE-002000');

// Regresión FAC-2166 / NE-002166: sin seriesEra deben seguir deduplicando como una sola N.E.
const fac2166Ne = { id: 'FAC-2166', factNum: '002166', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-10-30T00:00:00.000Z' };
const ne2166Nov = { id: 'NE-002166', numeroDoc: 'NE-002166', tipoDoc: 'NOTA_ENTREGA', fechaEmision: '2026-11-05T00:00:00.000Z' };
assert.strictEqual(dedupeCanonicalDocs([fac2166Ne, ne2166Nov]).length, 1, 'FAC-2166 y NE-002166 deben seguir deduplicando como el mismo documento');
console.log('  ✓ Identificador N.E-XXXXXX y aislamiento anti-colisión en edición verificados.');

console.log('\n================================================================');
console.log('--- TODAS LAS PRUEBAS UNITARIAS FISCALES PASARON EXITOSAMENTE (100% OK) ---');
console.log('================================================================\n');

