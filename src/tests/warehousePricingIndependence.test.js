import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProductRetailPrice,
  getProductWholesalePrice,
  getProductCost,
  resolveUnitPrice,
  normalizeWarehouseCode,
  PRICE_CHANNEL
} from '../services/pricingService';
import { saveProduct, getProducts } from '../services/storageService';

describe('Warehouse Pricing Independence (Almacén 01 vs Almacén 02)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const sampleProduct = {
    id: 'PROD_TEST_01',
    codigo: 'OIL-20W50-TEST',
    descripcion: 'Aceite 20W-50 Test',
    costoUsd: 25.0,
    costoUsd01: 25.0,
    costoUsd02: 27.5,
    precioUsdDetal: 35.0,
    precioUsdDetal01: 35.0,
    precioUsdDetal02: 38.0,
    precioUsdMayor: 30.0,
    precioUsdMayor01: 30.0,
    precioUsdMayor02: 33.0,
    stockAlmacen01: 50,
    stockAlmacen02: 100
  };

  it('normalizes warehouse codes correctly', () => {
    expect(normalizeWarehouseCode('01')).toBe('01');
    expect(normalizeWarehouseCode('02')).toBe('02');
    expect(normalizeWarehouseCode('ALM-01')).toBe('01');
    expect(normalizeWarehouseCode('ALM-02')).toBe('02');
    expect(normalizeWarehouseCode('1')).toBe('01');
    expect(normalizeWarehouseCode('2')).toBe('02');
    expect(normalizeWarehouseCode('TODOS')).toBe(null);
    expect(normalizeWarehouseCode(null)).toBe(null);
  });

  it('returns warehouse-specific retail prices independently', () => {
    expect(getProductRetailPrice(sampleProduct, '01')).toBe(35.0);
    expect(getProductRetailPrice(sampleProduct, '02')).toBe(38.0);
    expect(getProductRetailPrice(sampleProduct, null)).toBe(35.0);
  });

  it('returns warehouse-specific wholesale prices independently', () => {
    expect(getProductWholesalePrice(sampleProduct, '01')).toBe(30.0);
    expect(getProductWholesalePrice(sampleProduct, '02')).toBe(33.0);
    expect(getProductWholesalePrice(sampleProduct, null)).toBe(30.0);
  });

  it('returns warehouse-specific cost prices independently', () => {
    expect(getProductCost(sampleProduct, '01')).toBe(25.0);
    expect(getProductCost(sampleProduct, '02')).toBe(27.5);
    expect(getProductCost(sampleProduct, null)).toBe(25.0);
  });

  it('falls back to global price if warehouse specific price is not set', () => {
    const legacyProduct = {
      id: 'PROD_LEGACY',
      codigo: 'OIL-LEGACY',
      precioUsdDetal: 40.0,
      precioUsdMayor: 35.0,
      costoUsd: 22.0
    };
    expect(getProductRetailPrice(legacyProduct, '01')).toBe(40.0);
    expect(getProductRetailPrice(legacyProduct, '02')).toBe(40.0);
    expect(getProductWholesalePrice(legacyProduct, '01')).toBe(35.0);
    expect(getProductWholesalePrice(legacyProduct, '02')).toBe(35.0);
    expect(getProductCost(legacyProduct, '01')).toBe(22.0);
    expect(getProductCost(legacyProduct, '02')).toBe(22.0);
  });

  it('resolves unit price taking client, channel, and warehouse into account', () => {
    const retailClient = { tipoCliente: 'Detal' };
    const wholesaleClient = { tipoCliente: 'Mayorista' };

    // Detal channel
    expect(resolveUnitPrice(sampleProduct, retailClient, PRICE_CHANNEL.MOSTRADOR, '01')).toBe(35.0);
    expect(resolveUnitPrice(sampleProduct, retailClient, PRICE_CHANNEL.MOSTRADOR, '02')).toBe(38.0);

    // Wholesale channel
    expect(resolveUnitPrice(sampleProduct, wholesaleClient, PRICE_CHANNEL.MOSTRADOR, '01')).toBe(30.0);
    expect(resolveUnitPrice(sampleProduct, wholesaleClient, PRICE_CHANNEL.MOSTRADOR, '02')).toBe(33.0);

    // Office/Preventa channel forces wholesale price
    expect(resolveUnitPrice(sampleProduct, retailClient, PRICE_CHANNEL.OFICINA, '01')).toBe(30.0);
    expect(resolveUnitPrice(sampleProduct, retailClient, PRICE_CHANNEL.OFICINA, '02')).toBe(33.0);
  });

  it('preserves independent prices when saving to storageService', () => {
    saveProduct(sampleProduct);
    const stored = getProducts().find(p => p.id === sampleProduct.id);

    expect(stored.precioUsdDetal01).toBe(35.0);
    expect(stored.precioUsdDetal02).toBe(38.0);
    expect(stored.precioUsdMayor01).toBe(30.0);
    expect(stored.precioUsdMayor02).toBe(33.0);
    expect(stored.costoUsd01).toBe(25.0);
    expect(stored.costoUsd02).toBe(27.5);

    // Update Alm 01 only: Alm 02 must remain untouched
    const updatedAlm01 = {
      ...stored,
      precioUsdDetal01: 37.0,
      precioUsdMayor01: 32.0,
      costoUsd01: 26.0
    };
    saveProduct(updatedAlm01);

    const reStored = getProducts().find(p => p.id === sampleProduct.id);
    expect(reStored.precioUsdDetal01).toBe(37.0);
    expect(reStored.precioUsdMayor01).toBe(32.0);
    expect(reStored.costoUsd01).toBe(26.0);

    // Alm 02 unchanged!
    expect(reStored.precioUsdDetal02).toBe(38.0);
    expect(reStored.precioUsdMayor02).toBe(33.0);
    expect(reStored.costoUsd02).toBe(27.5);
  });
});
