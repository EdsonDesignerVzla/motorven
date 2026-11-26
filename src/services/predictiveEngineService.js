/**
 * predictiveEngineService.js
 * ---------------------------------------------------------------------------
 * Motor de Inteligencia Predictiva & Proyecciones para SIGNUM MOTORVEN
 * Provee cálculos matemáticos, estadísticos y de proyección para:
 *   1. Velocidad de Demanda & Run-Rate (Cajas, Pailas, Tambores, Litros)
 *   2. Agotamiento de Inventario & Alertas de Quiebre de Stock (Stockout ETA por Almacén 01 / 02)
 *   3. Compresión de Márgenes & Tendencia de Costos de Reposición (Simulador What-If)
 *   4. Proyección de Flujo de Caja & Detección de Brechas de Liquidez (7, 15, 30, 60 días)
 *   5. Radar de Alertas Tempranas (Semáforo Crítico / Precaución / Oportunidad)
 * ---------------------------------------------------------------------------
 */

import { getProductWarehouseStocks, resolveProductLitersPerUnit, resolveProductUnit } from './formatService.js';
import { getProductCost, getProductRetailPrice, getProductWholesalePrice } from './pricingService.js';

/**
 * Parsea fechas flexibles en formatos YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY o ISO.
 */
export function parseFlexibleDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

  const str = String(raw).trim();
  if (!str) return null;

  // Formato ISO directo
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const parts = str.split(/[/ -]/);
  if (parts.length >= 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Normaliza un código de almacén a '01' o '02'.
 */
export function normalizeWarehouse(wh) {
  if (!wh) return '01';
  const s = String(wh).trim().toUpperCase();
  if (s === '02' || s.includes('02') || s.includes('ENTREGA') || s.includes('BOVEDA') || s.includes('CENTRAL')) {
    return '02';
  }
  return '01';
}

/**
 * Calcula la diferencia en días entre dos fechas (target - base).
 */
export function getDaysDifference(targetDate, baseDate = new Date()) {
  const t = parseFlexibleDate(targetDate);
  const b = parseFlexibleDate(baseDate);
  if (!t || !b) return 0;
  const diffMs = t.getTime() - b.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * ---------------------------------------------------------------------------
 * 1. PILAR DE DEMANDA & VELOCIDAD DE VENTAS
 * ---------------------------------------------------------------------------
 */

/**
 * Calcula el ritmo de consumo histórico y diario por producto.
 * @param {Array} products Lista de productos
 * @param {Array} sales Lista de ventas/facturas cerradas
 * @param {Array} orders Lista de pedidos (para considerar demanda reciente)
 * @param {Object} options Opciones de configuración (lookbackDays = 30, baseDate)
 */
export function calculateDemandVelocity(products = [], sales = [], orders = [], options = {}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const lookbackDays = Math.max(1, Number(options.lookbackDays) || 30);
  const baseDate = parseFlexibleDate(options.baseDate) || new Date();
  const cutoffTime = baseDate.getTime() - (lookbackDays * 24 * 60 * 60 * 1000);

  const productVelocityMap = new Map();

  // Inicializar mapa de productos
  safeProducts.forEach(p => {
    const code = String(p.codigo || p.id || '').trim().toUpperCase();
    if (!code) return;
    productVelocityMap.set(code, {
      id: p.id,
      codigo: code,
      descripcion: p.descripcion || p.nombre || code,
      unidad: resolveProductUnit(p, 'Caja'),
      litrosPorUnidad: resolveProductLitersPerUnit(p),
      unidadesVendidas: 0,
      litrosVendidos: 0,
      totalUsd: 0,
      unidadesAlm01: 0,
      unidadesAlm02: 0,
      unidadesPreventaComprometidas: 0,
      ventasPorDia: 0,
      litrosPorDia: 0
    });
  });

  // Procesar ventas históricas en la ventana de tiempo
  const processSaleItem = (item, saleDate, saleAlm) => {
    const code = String(item.codigo || item.co_art || item.articuloId || item.productoId || '').trim().toUpperCase();
    if (!code) return;
    let entry = productVelocityMap.get(code);
    if (!entry) {
      entry = {
        id: code,
        codigo: code,
        descripcion: item.descripcion || item.art_des || code,
        unidad: 'Caja',
        litrosPorUnidad: 1,
        unidadesVendidas: 0,
        litrosVendidos: 0,
        totalUsd: 0,
        unidadesAlm01: 0,
        unidadesAlm02: 0,
        unidadesPreventaComprometidas: 0,
        ventasPorDia: 0,
        litrosPorDia: 0
      };
      productVelocityMap.set(code, entry);
    }

    const qty = Number(item.cantidad || item.cant || 0);
    const lts = Number(item.litrosTotales || (qty * entry.litrosPorUnidad) || 0);
    const subtotal = Number(item.subtotalUsd || item.totalNeto || (qty * (item.precioUnitario || 0)) || 0);
    const alm = normalizeWarehouse(item.almacen || saleAlm);

    entry.unidadesVendidas += qty;
    entry.litrosVendidos += lts;
    entry.totalUsd += subtotal;
    if (alm === '01') entry.unidadesAlm01 += qty;
    else entry.unidadesAlm02 += qty;
  };

  (sales || []).forEach(sale => {
    const sDate = parseFlexibleDate(sale.fecha || sale.fec_emis || sale.fechaVenta);
    if (!sDate || sDate.getTime() < cutoffTime) return;
    const saleAlm = sale.almacen || '01';

    if (Array.isArray(sale.items) && sale.items.length > 0) {
      sale.items.forEach(it => processSaleItem(it, sDate, saleAlm));
    } else if (Array.isArray(sale.renglones) && sale.renglones.length > 0) {
      sale.renglones.forEach(it => processSaleItem(it, sDate, saleAlm));
    } else if (sale.productoCodigo || sale.codigo) {
      processSaleItem(sale, sDate, saleAlm);
    }
  });

  // Procesar pedidos en preventa aprobados que comprometen disponibilidad
  (orders || []).forEach(order => {
    const status = String(order.status || order.estado || '').toUpperCase();
    if (status !== 'APROBADO' && status !== 'PENDIENTE') return;
    const oAlm = order.almacen || '01';

    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach(it => {
      const code = String(it.codigo || it.productoId || '').trim().toUpperCase();
      const entry = productVelocityMap.get(code);
      if (entry) {
        entry.unidadesPreventaComprometidas += Number(it.cantidad || 0);
      }
    });
  });

  // Calcular métricas diarias (Run-Rate)
  productVelocityMap.forEach(entry => {
    entry.ventasPorDia = Number((entry.unidadesVendidas / lookbackDays).toFixed(4));
    entry.litrosPorDia = Number((entry.litrosVendidos / lookbackDays).toFixed(4));
    entry.promedioDiarioUsd = Number((entry.totalUsd / lookbackDays).toFixed(2));
  });

  return productVelocityMap;
}

/**
 * ---------------------------------------------------------------------------
 * 2. PILAR DE INVENTARIO: DÍAS DE COBERTURA & ESTIMACIÓN DE QUIEBRE (STOCKOUT)
 * ---------------------------------------------------------------------------
 */

/**
 * Evalúa el riesgo de quiebre de stock por almacén (01 y 02).
 */
export function calculateStockoutProjections(products = [], sales = [], orders = [], options = {}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const leadTimeDays = Math.max(1, Number(options.leadTimeDays) || 7); // Días que tarda el proveedor en entregar
  const targetCoverageDays = Math.max(leadTimeDays, Number(options.targetCoverageDays) || 30); // Meta de stock
  const baseDate = parseFlexibleDate(options.baseDate) || new Date();

  const velocityMap = calculateDemandVelocity(safeProducts, sales, orders, options);
  const projections = [];

  safeProducts.forEach(p => {
    const code = String(p.codigo || p.id || '').trim().toUpperCase();
    if (!code) return;
    const velocity = velocityMap.get(code) || {
      ventasPorDia: 0,
      litrosPorDia: 0,
      unidadesPreventaComprometidas: 0,
      unidadesVendidas: 0
    };

    const stocks = getProductWarehouseStocks(p);
    const stock01 = Number(stocks.stock01 ?? stocks.stockAlmacen01 ?? 0);
    const stock02 = Number(stocks.stock02 ?? stocks.stockAlmacen02 ?? 0);
    const stockTotal = Number(stocks.total ?? stocks.stockTotal ?? (stock01 + stock02));

    // Stock ATP disponible (restando pedidos en preventa comprometidos)
    const committed = velocity.unidadesPreventaComprometidas || 0;
    const atpTotal = Math.max(0, stockTotal - committed);

    const vDaily = velocity.ventasPorDia;

    // Días de cobertura (si no hay ventas pero hay stock, cobertura infinita/999)
    const coverageDaysTotal = vDaily > 0 ? Number((atpTotal / vDaily).toFixed(1)) : (atpTotal > 0 ? 999 : 0);
    const coverageDays01 = vDaily > 0 ? Number((stock01 / (vDaily * 0.5 || 0.0001)).toFixed(1)) : (stock01 > 0 ? 999 : 0);
    const coverageDays02 = vDaily > 0 ? Number((stock02 / (vDaily * 0.5 || 0.0001)).toFixed(1)) : (stock02 > 0 ? 999 : 0);

    // Fecha estimada de quiebre (Stockout Date)
    let stockoutDate = null;
    let daysToStockout = null;

    if (vDaily > 0 && atpTotal >= 0) {
      daysToStockout = Math.floor(atpTotal / vDaily);
      const estDate = new Date(baseDate.getTime() + (daysToStockout * 24 * 60 * 60 * 1000));
      stockoutDate = estDate.toISOString().split('T')[0];
    }

    // Clasificación de urgencia
    let urgency = 'OPTIMO'; // OPTIMO, CRITICO, REORDEN, EXCESO, ESTANCADO, AGOTADO
    if (atpTotal <= 0) {
      urgency = 'AGOTADO';
    } else if (daysToStockout !== null && daysToStockout <= leadTimeDays) {
      urgency = 'CRITICO'; // Se agota antes o durante el tiempo de entrega del proveedor
    } else if (daysToStockout !== null && daysToStockout <= targetCoverageDays) {
      urgency = 'REORDEN'; // Entra en ventana de pedido sugerido
    } else if (coverageDaysTotal > 90 && vDaily > 0) {
      urgency = 'EXCESO'; // Más de 3 meses de stock
    } else if (vDaily === 0 && stockTotal > 0) {
      urgency = 'ESTANCADO'; // Mercancía parada sin rotación en el periodo
    }

    // Cantidad sugerida a reordenar (EOQ / Min-Max Dinámico)
    let suggestedReorderQty = 0;
    if (vDaily > 0) {
      const targetStockLevel = Math.ceil(vDaily * (leadTimeDays + targetCoverageDays));
      suggestedReorderQty = Math.max(0, targetStockLevel - atpTotal);
    }

    const unitCost = getProductCost(p);
    const estReorderCostUsd = Number((suggestedReorderQty * unitCost).toFixed(2));

    projections.push({
      id: p.id,
      codigo: code,
      descripcion: p.descripcion || p.nombre || code,
      categoria: p.categoria || 'Lubricantes',
      viscosidad: p.viscosidad || 'N/A',
      unidad: resolveProductUnit(p, 'Caja'),
      litrosPorUnidad: resolveProductLitersPerUnit(p),
      stock01,
      stock02,
      stockTotal,
      comprometidoPreventa: committed,
      stockDisponibleAtp: atpTotal,
      ventasPeriodo: velocity.unidadesVendidas,
      consumoDiario: vDaily,
      diasCobertura: coverageDaysTotal,
      diasCobertura01: coverageDays01,
      diasCobertura02: coverageDays02,
      diasParaAgotarse: daysToStockout,
      fechaEstimadaQuiebre: stockoutDate,
      urgencia: urgency,
      sugerenciaCompra: suggestedReorderQty,
      costoUnitarioUsd: unitCost,
      costoEstimadoReposicionUsd: estReorderCostUsd
    });
  });

  return projections;
}

/**
 * ---------------------------------------------------------------------------
 * 3. PILAR DE COSTOS & COMPRESIÓN DE MÁRGENES (MARGIN SQUEEZE)
 * ---------------------------------------------------------------------------
 */

/**
 * Analiza la compresión de margen producto por producto y por almacén.
 * Identifica productos cuyo margen ha caído por debajo del umbral mínimo de seguridad.
 */
export function analyzeMarginCompression(products = [], options = {}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const minSafeMarginPct = Number(options.minSafeMarginPct) || 18.0; // Margen de seguridad mínimo (18%)
  const analysis = [];

  safeProducts.forEach(p => {
    const code = String(p.codigo || p.id || '').trim().toUpperCase();
    if (!code) return;

    // Costo general y costos específicos por almacén
    const costGeneral = getProductCost(p);
    const cost01 = getProductCost(p, '01');
    const cost02 = getProductCost(p, '02');

    // Precios de venta general y por almacén
    const retail01 = getProductRetailPrice(p, '01');
    const retail02 = getProductRetailPrice(p, '02');
    const whole01 = getProductWholesalePrice(p, '01');
    const whole02 = getProductWholesalePrice(p, '02');

    const calcMargin = (price, cost) => {
      if (!(price > 0)) return { marginUsd: 0, marginPct: 0, isSqueezed: false, isNegative: cost > 0 };
      const diff = price - cost;
      const pct = (diff / price) * 100;
      return {
        marginUsd: Number(diff.toFixed(2)),
        marginPct: Number(pct.toFixed(2)),
        isSqueezed: pct < minSafeMarginPct,
        isNegative: diff < 0
      };
    };

    const marginDetal01 = calcMargin(retail01, cost01);
    const marginDetal02 = calcMargin(retail02, cost02);
    const marginMayor01 = calcMargin(whole01, cost01);
    const marginMayor02 = calcMargin(whole02, cost02);

    // Margen global representativo (usando detal 01)
    const primaryMargin = marginDetal01.marginPct > 0 ? marginDetal01 : marginDetal02;
    const anySqueezed = marginDetal01.isSqueezed || marginDetal02.isSqueezed || marginMayor01.isSqueezed || marginMayor02.isSqueezed;
    const anyNegative = marginDetal01.isNegative || marginDetal02.isNegative || marginMayor01.isNegative || marginMayor02.isNegative;

    analysis.push({
      id: p.id,
      codigo: code,
      descripcion: p.descripcion || p.nombre || code,
      costoGeneral: costGeneral,
      costo01: cost01,
      costo02: cost02,
      precioDetal01: retail01,
      precioDetal02: retail02,
      precioMayor01: whole01,
      precioMayor02: whole02,
      marginDetal01,
      marginDetal02,
      marginMayor01,
      marginMayor02,
      margenPrincipalPct: primaryMargin.marginPct,
      margenPrincipalUsd: primaryMargin.marginUsd,
      tieneCompresion: anySqueezed,
      tienePerdida: anyNegative,
      estadoMargen: anyNegative ? 'PERDIDA' : (anySqueezed ? 'COMPRIMIDO' : 'SALUDABLE')
    });
  });

  return analysis;
}

/**
 * Simulador Interactivo "What-If" para calcular el impacto de variación de costos
 * y precio sugerido para preservar el margen objetivo.
 */
export function simulatePriceAdjustment({ currentCost = 0, currentPrice = 0, costDeltaPct = 0, targetMarginPct = 25 }) {
  const cCost = Math.max(0, Number(currentCost) || 0);
  const cPrice = Math.max(0, Number(currentPrice) || 0);
  const delta = Number(costDeltaPct) || 0;
  const targetPct = Math.min(95, Math.max(1, Number(targetMarginPct) || 25));

  const projectedCost = Number((cCost * (1 + delta / 100)).toFixed(2));
  const projectedMarginWithCurrentPriceUsd = Number((cPrice - projectedCost).toFixed(2));
  const projectedMarginWithCurrentPricePct = cPrice > 0 ? Number(((cPrice - projectedCost) / cPrice * 100).toFixed(2)) : 0;

  // Precio sugerido para mantener el targetMarginPct:
  // Precio = Costo / (1 - (targetMargin / 100))
  const suggestedPriceToKeepMargin = Number((projectedCost / (1 - (targetPct / 100))).toFixed(2));
  const priceAdjustmentUsd = Number((suggestedPriceToKeepMargin - cPrice).toFixed(2));
  const priceAdjustmentPct = cPrice > 0 ? Number(((priceAdjustmentUsd / cPrice) * 100).toFixed(2)) : 0;

  return {
    currentCost: cCost,
    projectedCost,
    currentPrice: cPrice,
    projectedMarginWithCurrentPriceUsd,
    projectedMarginWithCurrentPricePct,
    targetMarginPct: targetPct,
    suggestedPriceToKeepMargin,
    priceAdjustmentUsd,
    priceAdjustmentPct,
    marginLossPct: Number((((cPrice - cCost) / (cPrice || 1) * 100) - projectedMarginWithCurrentPricePct).toFixed(2))
  };
}

/**
 * ---------------------------------------------------------------------------
 * 4. PILAR DE FLUJO DE CAJA PREDICTIVO (CASHFLOW HORIZON 7, 15, 30, 60 DÍAS)
 * ---------------------------------------------------------------------------
 */

/**
 * Proyecta el balance de liquidez en el tiempo cruzando:
 *   - Saldo disponible inicial (Bancos + Cajas)
 *   - Cobranzas estimadas (Facturas por cobrar en CxC con fecha de vencimiento y factor de recuperabilidad)
 *   - Compromisos de Pago (Facturas en CxP por vencer, Pasivos a socios)
 *   - Egresos fijos y nómina quincenal recurrente
 */
export function forecastCashflow({
  bankAccounts = [],
  cashDesks = [],
  cxcInvoices = [],
  cxpAccounts = [],
  expenses = [],
  payroll = [],
  salesRunRateDaily = 0,
  horizonDays = 30,
  tasaBcv = 827.73,
  collectionProbability = 0.85,
  baseDate = new Date()
} = {}) {
  const horizon = Math.max(7, Math.min(90, Number(horizonDays) || 30));
  const now = parseFlexibleDate(baseDate) || new Date();
  const safeRate = Number(tasaBcv) > 1 ? Number(tasaBcv) : 827.73;

  // 1. Saldo actual disponible en Tesorería (valorizado a USD)
  let initialBalanceUsd = 0;
  (cashDesks || []).forEach(c => {
    const sUsd = Number(c.saldoUsd || c.saldo_usd || 0);
    const sBs = Number(c.saldoBs || c.saldo_bs || 0);
    initialBalanceUsd += sUsd + (sBs > 0 ? sBs / safeRate : 0);
  });
  (bankAccounts || []).forEach(b => {
    const sUsd = Number(b.saldoUsd || b.saldo_usd || 0);
    const sBs = Number(b.saldoBs || b.saldo_bs || 0);
    initialBalanceUsd += sUsd + (sBs > 0 ? sBs / safeRate : 0);
  });
  initialBalanceUsd = Number(initialBalanceUsd.toFixed(2));

  // 2. Preparar buckets diarios
  const dailyProjections = [];
  let runningBalance = initialBalanceUsd;
  let minProjectedBalance = initialBalanceUsd;
  let minBalanceDay = 0;
  let hasLiquidityGap = false;
  let totalProjectedInflows = 0;
  let totalProjectedOutflows = 0;

  // Indexar CxC por fecha de vencimiento
  const cxcByDay = new Map();
  (cxcInvoices || []).forEach(inv => {
    const saldo = Number(inv.saldoUsd ?? inv.saldo ?? inv.totalUsd ?? 0);
    if (!(saldo > 0)) return;
    const vDate = parseFlexibleDate(inv.fechaVencimiento || inv.fec_venc || inv.fecha);
    const daysDiff = vDate ? getDaysDifference(vDate, now) : 0;
    // Si ya está vencido, se asigna a los primeros 3 días con probabilidad escalonada
    const targetDay = daysDiff < 0 ? Math.min(2, Math.abs(daysDiff % 3)) : Math.min(horizon - 1, daysDiff);
    const current = cxcByDay.get(targetDay) || 0;
    cxcByDay.set(targetDay, current + (saldo * collectionProbability));
  });

  // Indexar CxP por fecha de vencimiento
  const cxpByDay = new Map();
  (cxpAccounts || []).forEach(cxp => {
    const saldo = Number(cxp.saldoUsd ?? cxp.saldo ?? cxp.totalUsd ?? 0);
    if (!(saldo > 0)) return;
    const vDate = parseFlexibleDate(cxp.fechaVencimiento || cxp.fec_venc || cxp.fecha);
    const daysDiff = vDate ? getDaysDifference(vDate, now) : 0;
    // CxP vencida se proyecta pagar en los primeros 7 días
    const targetDay = daysDiff < 0 ? Math.min(6, Math.abs(daysDiff % 7)) : Math.min(horizon - 1, daysDiff);
    const current = cxpByDay.get(targetDay) || 0;
    cxpByDay.set(targetDay, current + saldo);
  });

  // Estimar nómina mensual recurrente
  let monthlyPayrollTotalUsd = 0;
  (payroll || []).forEach(p => {
    monthlyPayrollTotalUsd += Number(p.totalPagarUsd || p.totalUsd || p.montoUsd || 0);
  });
  if (monthlyPayrollTotalUsd === 0) {
    // Estimado de respaldo si no hay nómina cargada
    monthlyPayrollTotalUsd = 1200;
  }
  const quincenaPayroll = Number((monthlyPayrollTotalUsd / 2).toFixed(2));

  // Generar proyección día por día
  for (let i = 0; i < horizon; i++) {
    const currentDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
    const dayOfMonth = currentDate.getDate();
    const dateStr = currentDate.toISOString().split('T')[0];

    // Ingresos previstos del día:
    // CxC por vencer + ventas de contado estimadas del día (run-rate * 40% contado)
    const cxcInflow = Number((cxcByDay.get(i) || 0).toFixed(2));
    const cashSalesInflow = Number((salesRunRateDaily * 0.4).toFixed(2));
    const dayInflows = Number((cxcInflow + cashSalesInflow).toFixed(2));

    // Egresos previstos del día:
    // CxP a proveedores por vencer + nómina quincenal (días 15 y 30) + fijos diarios
    let dayOutflows = Number((cxpByDay.get(i) || 0).toFixed(2));

    // Si coincide con quincena (15 o 30/31)
    if (dayOfMonth === 15 || dayOfMonth === 30 || (dayOfMonth === 28 && currentDate.getMonth() === 1)) {
      dayOutflows += quincenaPayroll;
    }

    // Estimado de gastos operativos diarios
    const estimatedDailyExpenses = 15.0;
    dayOutflows += estimatedDailyExpenses;
    dayOutflows = Number(dayOutflows.toFixed(2));

    const netDaily = Number((dayInflows - dayOutflows).toFixed(2));
    runningBalance = Number((runningBalance + netDaily).toFixed(2));

    totalProjectedInflows += dayInflows;
    totalProjectedOutflows += dayOutflows;

    if (runningBalance < minProjectedBalance) {
      minProjectedBalance = runningBalance;
      minBalanceDay = i;
    }

    if (runningBalance < 0) {
      hasLiquidityGap = true;
    }

    dailyProjections.push({
      dayIndex: i,
      fecha: dateStr,
      diaMes: dayOfMonth,
      ingresosPrevistos: dayInflows,
      egresosComprometidos: dayOutflows,
      flujoNetoDia: netDaily,
      saldoProyectadoUsd: runningBalance,
      saldoProyectadoBs: Number((runningBalance * safeRate).toFixed(2)),
      enRiesgo: runningBalance < 0
    });
  }

  return {
    saldoInicialUsd: initialBalanceUsd,
    saldoFinalProyectadoUsd: runningBalance,
    totalIngresosPrevistosUsd: Number(totalProjectedInflows.toFixed(2)),
    totalEgresosComprometidosUsd: Number(totalProjectedOutflows.toFixed(2)),
    flujoNetoPeriodoUsd: Number((totalProjectedInflows - totalProjectedOutflows).toFixed(2)),
    saldoMinimoUsd: minProjectedBalance,
    diaSaldoMinimo: minBalanceDay,
    fechaSaldoMinimo: dailyProjections[minBalanceDay]?.fecha || null,
    tieneBrechaLiquidez: hasLiquidityGap,
    proyeccionesDiarias: dailyProjections
  };
}

/**
 * ---------------------------------------------------------------------------
 * 5. RADAR DE ALERTAS TEMPRANAS (CENTRO DE CONTROL EJECUTIVO)
 * ---------------------------------------------------------------------------
 */

/**
 * Consolida todas las alertas tempranas de los 4 pilares en una lista priorizada.
 */
export function generateEarlyWarningRadar({
  stockoutProjections = [],
  marginAnalysis = [],
  cashflowForecast = {}
} = {}) {
  const alerts = [];

  // 1. Alertas de Inventario
  stockoutProjections.forEach(item => {
    if (item.urgencia === 'AGOTADO') {
      alerts.push({
        id: `STK_OUT_${item.codigo}`,
        categoria: 'INVENTARIO',
        severidad: 'CRITICA',
        titulo: `Stock Agotado: ${item.codigo}`,
        descripcion: `${item.descripcion} tiene 0 unidades disponibles. Se recomienda compra urgente de ${item.sugerenciaCompra} unidades.`,
        meta: { codigo: item.codigo, sugerenciaCompra: item.sugerenciaCompra, costoEstimado: item.costoEstimadoReposicionUsd }
      });
    } else if (item.urgencia === 'CRITICO') {
      alerts.push({
        id: `STK_CRIT_${item.codigo}`,
        categoria: 'INVENTARIO',
        severidad: 'CRITICA',
        titulo: `Quiebre Inminente en ${item.diasParaAgotarse} días: ${item.codigo}`,
        descripcion: `Quedan solo ${item.stockDisponibleAtp} unidades disponibles (${item.diasCobertura} días de cobertura). Se agotará el ${item.fechaEstimadaQuiebre}.`,
        meta: { codigo: item.codigo, diasParaAgotarse: item.diasParaAgotarse, fecha: item.fechaEstimadaQuiebre }
      });
    } else if (item.urgencia === 'REORDEN') {
      alerts.push({
        id: `STK_REORD_${item.codigo}`,
        categoria: 'INVENTARIO',
        severidad: 'ADVERTENCIA',
        titulo: `Punto de Reorden: ${item.codigo}`,
        descripcion: `Cobertura restante de ${item.diasCobertura} días. Recomendable generar orden por ${item.sugerenciaCompra} unidades.`,
        meta: { codigo: item.codigo, sugerenciaCompra: item.sugerenciaCompra }
      });
    } else if (item.urgencia === 'EXCESO') {
      alerts.push({
        id: `STK_EXC_${item.codigo}`,
        categoria: 'INVENTARIO',
        severidad: 'OPORTUNIDAD',
        titulo: `Sobre-Stock (${item.diasCobertura} días): ${item.codigo}`,
        descripcion: `Capital inmovilizado en ${item.descripcion}. Sugerencia: activar promoción en preventa móvil o descuento por volumen.`,
        meta: { codigo: item.codigo, diasCobertura: item.diasCobertura }
      });
    }
  });

  // 2. Alertas de Márgenes
  marginAnalysis.forEach(item => {
    if (item.tienePerdida) {
      alerts.push({
        id: `MARG_LOSS_${item.codigo}`,
        categoria: 'COSTOS_MARGENES',
        severidad: 'CRITICA',
        titulo: `Venta a Pérdida detectada: ${item.codigo}`,
        descripcion: `El costo ($${item.costoGeneral}) supera el precio de venta en al menos una tarifa. Revisar inmediatamente.`,
        meta: { codigo: item.codigo, costo: item.costoGeneral }
      });
    } else if (item.tieneCompresion) {
      alerts.push({
        id: `MARG_COMP_${item.codigo}`,
        categoria: 'COSTOS_MARGENES',
        severidad: 'ADVERTENCIA',
        titulo: `Margen Comprimido (${item.margenPrincipalPct}%): ${item.codigo}`,
        descripcion: `El margen de ${item.descripcion} está por debajo del umbral mínimo de seguridad. Evaluar ajuste de lista Detal/Mayor.`,
        meta: { codigo: item.codigo, margenPct: item.margenPrincipalPct }
      });
    }
  });

  // 3. Alertas de Flujo de Caja
  if (cashflowForecast?.tieneBrechaLiquidez) {
    alerts.push({
      id: 'CASH_GAP_CRITICAL',
      categoria: 'FLUJO_CAJA',
      severidad: 'CRITICA',
      titulo: 'Brecha de Liquidez Proyectada (Déficit de Caja)',
      descripcion: `Se proyecta saldo negativo (mínimo $${cashflowForecast.saldoMinimoUsd}) alrededor del día ${cashflowForecast.diaSaldoMinimo} (${cashflowForecast.fechaSaldoMinimo}). Acelerar cobranzas de cartera vencida.`,
      meta: { saldoMinimoUsd: cashflowForecast.saldoMinimoUsd, fecha: cashflowForecast.fechaSaldoMinimo }
    });
  } else if (cashflowForecast?.flujoNetoPeriodoUsd < 0) {
    alerts.push({
      id: 'CASH_DEFICIT_WARNING',
      categoria: 'FLUJO_CAJA',
      severidad: 'ADVERTENCIA',
      titulo: 'Drenaje de Tesorería Proyectado',
      descripcion: `Los egresos superarán a los ingresos en $${Math.abs(cashflowForecast.flujoNetoPeriodoUsd)} durante el horizonte analizado.`,
      meta: { deficitUsd: Math.abs(cashflowForecast.flujoNetoPeriodoUsd) }
    });
  }

  // Ordenar por severidad: CRITICA primero, luego ADVERTENCIA, luego OPORTUNIDAD
  const severityScore = { CRITICA: 1, ADVERTENCIA: 2, OPORTUNIDAD: 3 };
  alerts.sort((a, b) => (severityScore[a.severidad] || 9) - (severityScore[b.severidad] || 9));

  return alerts;
}
