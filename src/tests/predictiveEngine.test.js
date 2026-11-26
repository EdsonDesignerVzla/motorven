/**
 * Suite de Pruebas: Motor de Inteligencia Predictiva (SIGNUM FORESIGHT)
 * Valida los 4 pilares: Demanda, Agotamiento de Stock, Márgenes y Flujo de Caja
 */

import assert from 'node:assert/strict';
import {
  parseFlexibleDate,
  calculateDemandVelocity,
  calculateStockoutProjections,
  analyzeMarginCompression,
  simulatePriceAdjustment,
  forecastCashflow,
  generateEarlyWarningRadar
} from '../services/predictiveEngineService.js';

console.log('--- INICIANDO BATERÍA DE PRUEBAS: MOTOR DE INTELIGENCIA PREDICTIVA ---');

// 1. Verificación de Parser de Fechas Flexible
{
  const d1 = parseFlexibleDate('2026-11-20');
  assert.equal(d1.getFullYear(), 2026);
  assert.equal(d1.getMonth(), 10); // Noviembre = 10 (base 0)

  const d2 = parseFlexibleDate('25/11/2026');
  assert.equal(d2.getFullYear(), 2026);
  assert.equal(d2.getDate(), 25);

  const d3 = parseFlexibleDate('15-12-2026');
  assert.equal(d3.getMonth(), 11); // Diciembre
  assert.equal(d3.getDate(), 15);

  console.log('  ✓ 1. Parser de fechas multi-formato superado.');
}

// 2. Pilar 1: Demanda & Velocidad de Ventas (Run-rate)
{
  const sampleProducts = [
    { id: 'P1', codigo: 'OIL-20W50', descripcion: 'Aceite 20W-50 Mineral', presentacion: 'Caja', litros: 12 },
    { id: 'P2', codigo: 'OIL-15W40', descripcion: 'Aceite 15W-40 Diesel', presentacion: 'Paila', litros: 19 }
  ];

  const sampleSales = [
    {
      id: 'FAC-1',
      fecha: '2026-11-10',
      items: [{ codigo: 'OIL-20W50', cantidad: 30, subtotalUsd: 900, almacen: '01' }]
    },
    {
      id: 'FAC-2',
      fecha: '2026-11-15',
      items: [{ codigo: 'OIL-20W50', cantidad: 30, subtotalUsd: 900, almacen: '02' }]
    }
  ];

  const sampleOrders = [
    {
      id: 'ORD-1',
      status: 'APROBADO',
      items: [{ codigo: 'OIL-20W50', cantidad: 10 }]
    }
  ];

  const velocityMap = calculateDemandVelocity(sampleProducts, sampleSales, sampleOrders, {
    lookbackDays: 30,
    baseDate: '2026-11-20'
  });

  const entry = velocityMap.get('OIL-20W50');
  assert.ok(entry, 'Debe existir entrada para OIL-20W50');
  assert.equal(entry.unidadesVendidas, 60, 'Debe haber vendido 60 unidades en el periodo');
  assert.equal(entry.ventasPorDia, 2, 'Run-rate diario debe ser 60 / 30 = 2 unidades/día');
  assert.equal(entry.unidadesPreventaComprometidas, 10, 'Debe tener 10 unidades comprometidas en preventa');

  console.log('  ✓ 2. Cálculo de velocidad de demanda y consumo diario (Run-Rate) superado.');
}

// 3. Pilar 2: Agotamiento de Inventario & Alertas de Quiebre (Stockout ETA)
{
  const products = [
    {
      id: 'P-CRIT',
      codigo: 'LUB-CRIT',
      descripcion: 'Lubricante Crítico',
      stockAlmacen01: 5,
      stockAlmacen02: 5,
      costoUsd: 20
    },
    {
      id: 'P-EXC',
      codigo: 'LUB-EXC',
      descripcion: 'Lubricante Exceso',
      stockAlmacen01: 500,
      stockAlmacen02: 500,
      costoUsd: 25
    }
  ];

  const sales = [
    {
      id: 'S-1',
      fecha: '2026-11-10',
      items: [
        { codigo: 'LUB-CRIT', cantidad: 30 }, // 1 unidad por día
        { codigo: 'LUB-EXC', cantidad: 6 }     // 0.2 unidades por día
      ]
    }
  ];

  const orders = [
    {
      id: 'O-1',
      status: 'APROBADO',
      items: [{ codigo: 'LUB-CRIT', cantidad: 4 }] // Deja 6 unidades ATP disponibles
    }
  ];

  const projections = calculateStockoutProjections(products, sales, orders, {
    leadTimeDays: 7,
    targetCoverageDays: 30,
    lookbackDays: 30,
    baseDate: '2026-11-20'
  });

  const crit = projections.find(p => p.codigo === 'LUB-CRIT');
  assert.ok(crit);
  assert.equal(crit.stockTotal, 10);
  assert.equal(crit.stockDisponibleAtp, 6); // 10 físico - 4 comprometido
  assert.equal(crit.consumoDiario, 1.0);
  assert.equal(crit.diasCobertura, 6);
  assert.equal(crit.urgencia, 'CRITICO', '6 días de cobertura con lead time de 7 días debe ser CRÍTICO');
  assert.equal(crit.fechaEstimadaQuiebre, '2026-11-26');
  assert.ok(crit.sugerenciaCompra > 0, 'Debe sugerir cantidad de reposición');

  const exc = projections.find(p => p.codigo === 'LUB-EXC');
  assert.ok(exc);
  assert.equal(exc.urgencia, 'EXCESO', '1000 unidades con rotación lenta debe marcar EXCESO');

  console.log('  ✓ 3. Días de cobertura, Stockout ETA y clasificación de urgencia superados.');
}

// 4. Pilar 3: Compresión de Márgenes & Simulador What-If
{
  const products = [
    {
      id: 'P-SQUEEZED',
      codigo: 'ACEITE-15W40',
      descripcion: 'Aceite 15W40 Mineral',
      costoUsd: 28.0,
      precioUsdDetal: 30.0, // Margen = (30 - 28)/30 = 6.6% (< 18%)
      precioUsdMayor: 29.0
    },
    {
      id: 'P-HEALTHY',
      codigo: 'ACEITE-SINT',
      descripcion: 'Aceite Sintético 5W30',
      costoUsd: 30.0,
      precioUsdDetal: 45.0, // Margen = 33.3%
      precioUsdMayor: 40.0
    }
  ];

  const marginAnalysis = analyzeMarginCompression(products, { minSafeMarginPct: 18.0 });
  const squeezed = marginAnalysis.find(p => p.codigo === 'ACEITE-15W40');
  assert.ok(squeezed);
  assert.equal(squeezed.tieneCompresion, true, 'Debe detectar margen comprimido');
  assert.equal(squeezed.estadoMargen, 'COMPRIMIDO');

  const healthy = marginAnalysis.find(p => p.codigo === 'ACEITE-SINT');
  assert.ok(healthy);
  assert.equal(healthy.tieneCompresion, false);
  assert.equal(healthy.estadoMargen, 'SALUDABLE');

  // Simulación What-If
  // Costo sube 10% (de $28 a $30.80). Para ganar 25% de margen:
  const sim = simulatePriceAdjustment({
    currentCost: 28.0,
    currentPrice: 35.0,
    costDeltaPct: 10,
    targetMarginPct: 25
  });

  assert.equal(sim.projectedCost, 30.80);
  // Precio para ganar 25%: 30.80 / (1 - 0.25) = 30.80 / 0.75 = 41.07
  assert.equal(sim.suggestedPriceToKeepMargin, 41.07);
  assert.ok(sim.priceAdjustmentUsd > 0);

  console.log('  ✓ 4. Detección de compresión de margen y simulador What-If superados.');
}

// 5. Pilar 4: Proyección de Flujo de Caja (Cashflow Horizon & Brechas de Liquidez)
{
  const bankAccounts = [{ saldoUsd: 5000, saldoBs: 0 }];
  const cashDesks = [{ saldoUsd: 1000, saldoBs: 0 }]; // Saldo inicial total = $6000

  // CxC: $2000 por cobrar en el día 5
  const cxcInvoices = [{ saldoUsd: 2000, fechaVencimiento: '2026-11-25' }];

  // CxP: $10000 por pagar en el día 10 (Creará déficit de caja si supera saldos + ingresos)
  const cxpAccounts = [{ saldoUsd: 10000, fechaVencimiento: '2026-11-30' }];

  const forecast = forecastCashflow({
    bankAccounts,
    cashDesks,
    cxcInvoices,
    cxpAccounts,
    expenses: [],
    payroll: [{ totalUsd: 800 }],
    salesRunRateDaily: 100,
    horizonDays: 15,
    baseDate: '2026-11-20'
  });

  assert.equal(forecast.saldoInicialUsd, 6000);
  assert.ok(forecast.proyeccionesDiarias.length === 15);
  assert.equal(forecast.tieneBrechaLiquidez, true, 'Debe detectar brecha de liquidez por pago grande de CxP');
  assert.ok(forecast.saldoMinimoUsd < 0, 'El saldo mínimo proyectado debe ser negativo');

  console.log('  ✓ 5. Proyección de flujo de caja y detección de brechas de liquidez superados.');
}

// 6. Radar de Alertas Tempranas
{
  const mockProjections = [
    {
      codigo: 'SKU-URG',
      descripcion: 'Aceite Urgente',
      urgencia: 'CRITICO',
      diasParaAgotarse: 2,
      fechaEstimadaQuiebre: '2026-11-22',
      stockDisponibleAtp: 2,
      diasCobertura: 2,
      sugerenciaCompra: 50,
      costoEstimadoReposicionUsd: 1200
    }
  ];

  const mockMargins = [
    {
      codigo: 'SKU-COMP',
      descripcion: 'Aceite Comprimido',
      tieneCompresion: true,
      tienePerdida: false,
      margenPrincipalPct: 12.5,
      costoGeneral: 25
    }
  ];

  const mockCashflow = {
    tieneBrechaLiquidez: true,
    saldoMinimoUsd: -1500,
    diaSaldoMinimo: 8,
    fechaSaldoMinimo: '2026-11-28'
  };

  const radar = generateEarlyWarningRadar({
    stockoutProjections: mockProjections,
    marginAnalysis: mockMargins,
    cashflowForecast: mockCashflow
  });

  assert.ok(radar.length >= 3);
  assert.equal(radar[0].severidad, 'CRITICA');
  const hasCashAlert = radar.some(a => a.categoria === 'FLUJO_CAJA');
  const hasStockAlert = radar.some(a => a.categoria === 'INVENTARIO');
  const hasMarginAlert = radar.some(a => a.categoria === 'COSTOS_MARGENES');

  assert.ok(hasCashAlert && hasStockAlert && hasMarginAlert, 'Debe incluir alertas de los 3 subsistemas');

  console.log('  ✓ 6. Radar unificado de alertas tempranas y priorización superados.');
}

console.log('================================================================');
console.log('✅ TODAS LAS PRUEBAS DEL MOTOR PREDICTIVO PASARON AL 100%');
console.log('================================================================');
