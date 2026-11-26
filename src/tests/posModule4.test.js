import assert from 'node:assert';
import {
  resolveDocumentWarehouseTarget,
  validateWarehouseStockForDocument
} from '../services/formatService.js';
import {
  calculateFiscalTaxes,
  formatSaleInvoiceTicketText
} from '../services/fiscalService.js';
import {
  canUserGrantCreditOverride,
  parseInvoiceDateInfo
} from '../services/creditPolicyService.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

console.log('🧪 Ejecutando suite posModule4.test.js (Módulo 4: POS Mostrador y Facturación)...');

const sampleProducts = [
  {
    id: 'PRD-M4-01',
    codigo: 'OIL-20W50',
    descripcion: 'SAE 20W-50 MINERAL SL (CAJA 12 LTS)',
    stockAlmacen01: 4,
    stockAlmacen02: 12,
    precioUsd: 60,
    litrosPorUnidad: 12
  }
];

test('4.1 validateWarehouseStockForDocument bloquea cantidad mayor al stock disponible en Alm 01 y Alm 02', () => {
  const failAlm01 = validateWarehouseStockForDocument({
    items: [{ articuloId: 'PRD-M4-01', codigo: 'OIL-20W50', descripcion: 'SAE 20W-50', cantidad: 6 }],
    products: sampleProducts,
    tipoDoc: 'FACTURA',
    modalidadVenta: 'MOSTRADOR'
  });
  assert.strictEqual(failAlm01.isValid, false);
  assert.strictEqual(failAlm01.insufficientStockItems.length, 1);
  assert.ok(failAlm01.message.includes('Stock insuficiente'));
  assert.ok(failAlm01.message.includes('01'));

  const okAlm02 = validateWarehouseStockForDocument({
    items: [{ articuloId: 'PRD-M4-01', codigo: 'OIL-20W50', descripcion: 'SAE 20W-50', cantidad: 6 }],
    products: sampleProducts,
    tipoDoc: 'NOTA_ENTREGA',
    modalidadVenta: 'OFICINA'
  });
  assert.strictEqual(okAlm02.isValid, true);

  const failAlm02 = validateWarehouseStockForDocument({
    items: [{ articuloId: 'PRD-M4-01', codigo: 'OIL-20W50', descripcion: 'SAE 20W-50', cantidad: 15 }],
    products: sampleProducts,
    tipoDoc: 'NOTA_ENTREGA',
    modalidadVenta: 'OFICINA'
  });
  assert.strictEqual(failAlm02.isValid, false);
  assert.strictEqual(failAlm02.insufficientStockItems.length, 1);
  assert.ok(failAlm02.message.includes('02'));
});

test('4.2 resolveDocumentWarehouseTarget enruta FACTURA/NC/ND/COTIZACION a Alm 01 y NOTA_ENTREGA a Alm 02 sin fugas', () => {
  const cot = resolveDocumentWarehouseTarget({ tipoDoc: 'COTIZACION', modalidadVenta: 'MOSTRADOR' });
  assert.strictEqual(cot.warehouseCode, '01');
  assert.strictEqual(cot.effectiveTipoDoc, 'COTIZACION');

  const nc = resolveDocumentWarehouseTarget({ tipoDoc: 'NOTA_CREDITO', modalidadVenta: 'MOSTRADOR' });
  assert.strictEqual(nc.warehouseCode, '01');
  assert.strictEqual(nc.effectiveTipoDoc, 'NOTA_CREDITO');

  const nd = resolveDocumentWarehouseTarget({ tipoDoc: 'NOTA_DEBITO', modalidadVenta: 'MOSTRADOR' });
  assert.strictEqual(nd.warehouseCode, '01');
  assert.strictEqual(nd.effectiveTipoDoc, 'NOTA_DEBITO');

  const ne = resolveDocumentWarehouseTarget({ tipoDoc: 'NOTA_ENTREGA', modalidadVenta: 'OFICINA' });
  assert.strictEqual(ne.warehouseCode, '02');
  assert.strictEqual(ne.effectiveTipoDoc, 'NOTA_ENTREGA');
});

test('4.3 calculateFiscalTaxes exime IGTF y retenciones en COTIZACION y mantiene 0% IVA/IGTF/Ret en NOTA_ENTREGA', () => {
  const items = [{ precioUsd: 100, cantidad: 1, tipoAlicuota: 'GENERAL' }];

  const cotTaxes = calculateFiscalTaxes({
    items,
    tipoDoc: 'COTIZACION',
    metodoPago: 'EFECTIVO_USD',
    condicionPago: 'CONTADO',
    tasaBcv: 400,
    porcentajeRetencionIva: 75,
    porcentajeRetencionIslr: 2
  });
  assert.strictEqual(cotTaxes.igtfUsd, 0);
  assert.strictEqual(cotTaxes.retencionIvaUsd, 0);
  assert.strictEqual(cotTaxes.retencionIslrUsd, 0);

  const neTaxes = calculateFiscalTaxes({
    items,
    tipoDoc: 'NOTA_ENTREGA',
    metodoPago: 'EFECTIVO_USD',
    condicionPago: 'CONTADO',
    tasaBcv: 400,
    porcentajeRetencionIva: 75,
    porcentajeRetencionIslr: 2
  });
  assert.strictEqual(neTaxes.totalIvaUsd, 0);
  assert.strictEqual(neTaxes.igtfUsd, 0);
  assert.strictEqual(neTaxes.retencionIvaUsd, 0);
  assert.strictEqual(neTaxes.retencionIslrUsd, 0);
  assert.strictEqual(neTaxes.totalFacturaUsd, 100);

  const factTaxes = calculateFiscalTaxes({
    items,
    tipoDoc: 'FACTURA',
    metodoPago: 'EFECTIVO_USD',
    condicionPago: 'CONTADO',
    tasaBcv: 400,
    porcentajeRetencionIva: 75,
    porcentajeRetencionIslr: 0
  });
  assert.strictEqual(factTaxes.totalIvaUsd, 16);
  assert.strictEqual(factTaxes.igtfUsd, 3.48);
  assert.strictEqual(factTaxes.retencionIvaUsd, 12);
});

test('4.4 formatSaleInvoiceTicketText parsea fechas DD/MM/YYYY y YYYY-MM-DD sin desfase, suprime control 00-001043 en NE/COT y calcula fallback totalBs', () => {
  const expectedDate = new Date(2026, 10, 13, 12, 0, 0).toLocaleDateString('es-VE');
  const neTicket = formatSaleInvoiceTicketText({
    tipoDoc: 'NOTA_ENTREGA',
    numeroDoc: 'NE-000120',
    fechaEmision: '13/11/2026',
    tasaDolar: 400,
    clienteNombre: 'TALLER CENTRAL C.A.',
    clienteRif: 'J-40123456-7',
    items: [{ codigo: 'OIL-1', descripcion: 'SAE 15W-40', cantidad: 2, precioUsd: 50, subtotalUsd: 100 }],
    subtotalUsd: 100,
    totalUsd: 100
  });
  assert.ok(neTicket.includes('FECHA DE EMISIÓN:'));
  assert.ok(neTicket.includes(expectedDate));
  assert.ok(!neTicket.includes('00-001043'));
  assert.ok(!neTicket.includes('N° DE CONTROL'));
  assert.ok(!neTicket.includes('SENIAT'));
  assert.ok(!neTicket.includes('DÉBITO FISCAL'));
  assert.ok(neTicket.includes('40.000,00'));

  const cotTicket = formatSaleInvoiceTicketText({
    tipoDoc: 'COTIZACION',
    numeroDoc: 'COT-000045',
    fechaEmision: '2026-11-13',
    tasaDolar: 400,
    clienteNombre: 'TRANSPORTES LARA',
    clienteRif: 'J-30999888-1',
    items: [{ codigo: 'OIL-2', descripcion: 'HIDRAULICO 68', cantidad: 1, precioUsd: 80, subtotalUsd: 80 }],
    subtotalUsd: 80,
    totalUsd: 80
  });
  assert.ok(cotTicket.includes('FECHA DE EMISIÓN:'));
  assert.ok(cotTicket.includes(expectedDate));
  assert.ok(!cotTicket.includes('00-001043'));

  const parsedLocal = parseInvoiceDateInfo('2026-11-13');
  assert.strictEqual(parsedLocal.date.getDate(), 13);
  assert.strictEqual(parsedLocal.date.getMonth(), 10);
});

test('4.5 canUserGrantCreditOverride habilita aprobacion de credito segun acceso a Flujo Comercial y Pedidos', () => {
  assert.strictEqual(canUserGrantCreditOverride({ rol: 'Gerencia' }), true);
  assert.strictEqual(canUserGrantCreditOverride({ rol: 'ADMINISTRADOR MASTER' }), true);
  assert.strictEqual(canUserGrantCreditOverride({ rol: 'Crédito y Cobranzas' }), true);
  assert.strictEqual(canUserGrantCreditOverride({ rol: 'Cajero', username: 'caja1' }), true);
  assert.strictEqual(canUserGrantCreditOverride({ rol: 'Vendedor', username: 'vendedor1' }), true);
  assert.strictEqual(canUserGrantCreditOverride({ rol: 'Cajero', username: 'caja1', modulos: ['caja', 'ventas'] }), false);
  assert.strictEqual(canUserGrantCreditOverride({ rol: 'COMPRAS', username: 'compras1' }), false);
});

console.log(`✅ posModule4.test.js: ${passed}/5 pruebas aprobadas`);
