import assert from 'node:assert/strict';
import { buildSellerSkuLitrosSummary } from '../utils/sellerSkuLitrosUtils.js';

const seller = {
  id: 'usr-seller-KB',
  coVen: 'KB',
  venDes: 'Katherine Becerra',
  metaLitrosMes: 3000
};

const products = [
  { codigo: '001201', descripcion: '15W40 Semi-Sintético', unidad: 'Caja', litrosPorUnidad: 11.35 },
  { codigo: '101209', descripcion: '15W40 Semi-Sintético (Paila)', unidad: 'Paila', litrosPorUnidad: 19 },
  { codigo: '000003', descripcion: 'Granel Diesel SAE 50', unidad: 'Litros', litrosPorUnidad: 1 }
];

const invoices = [
  {
    coVen: 'KB',
    anulado: false,
    items: [
      { articuloId: '001201', descripcion: '15W40 Semi-Sintético', cantidad: 100 },
      { articuloId: '101209', descripcion: '15W40 Semi-Sintético (Paila)', cantidad: 50 },
      { articuloId: '101815', descripcion: 'Servicio de Flete', cantidad: 1 }
    ]
  },
  {
    coVen: 'KB',
    anulado: false,
    items: [
      { articuloId: '001201', descripcion: '15W40 Semi-Sintético', cantidad: 20 },
      { articuloId: '000003', descripcion: 'Granel Diesel SAE 50', cantidad: 200 }
    ]
  },
  {
    coVen: 'JR', // Otro vendedor, debe excluirse
    anulado: false,
    items: [{ articuloId: '001201', descripcion: '15W40 Semi-Sintético', cantidad: 50 }]
  },
  {
    coVen: 'KB',
    anulado: true, // Anulada, debe excluirse
    items: [{ articuloId: '001201', descripcion: '15W40 Semi-Sintético', cantidad: 99 }]
  }
];

const returns = [
  {
    coVen: 'KB',
    anulado: false,
    litrosTotales: 12
  }
];

const result = buildSellerSkuLitrosSummary({
  seller,
  invoices,
  returns,
  products,
  metaLitros: 3000
});

// 001201: 120 * 11.35 = 1362 L
// 101209: 50 * 19 = 950 L
// 000003: 200 * 1 = 200 L
// Facturado bruto = 2512 L; Devoluciones = 12 L; Consolidado neto = 2500 L
assert.equal(result.litrosFacturados, 2512);
assert.equal(result.litrosDevueltos, 12);
assert.equal(result.litrosConsolidados, 2500);
assert.equal(result.porcentajeMeta, 83.3);
assert.equal(result.litrosRestantesMeta, 500);
assert.equal(result.skus.length, 3);
assert.equal(result.presentaciones.length, 3);
assert.equal(result.skus[0].sku, '001201');
assert.equal(result.skus[0].presentacion, 'Caja');
assert.equal(result.skus[0].litros, 1362);
assert.equal(result.skus[1].sku, '101209');
assert.equal(result.skus[1].presentacion, 'Paila');
assert.equal(result.skus[1].litros, 950);

console.log('✓ buildSellerSkuLitrosSummary passed all assertions (2500 L netos, 83.3% meta, 3 SKUs, 3 presentaciones)');
