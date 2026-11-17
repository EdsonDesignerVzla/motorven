import { getProductRetailPrice, getProductWholesalePrice } from '../services/pricingService.js';
import { getCanonicalDocKey } from '../services/fiscalService.js';
import { round2 } from '../services/formatService.js';

export const PRICE_LIST_TIERS = {
  MAYOR: 'MAYOR',
  DETAL: 'DETAL'
};

export const EXPENSE_STANDARD_CATEGORIES = [
  { id: 'GASTO_OPERATIVO', label: 'Gasto Operativo General', pnlBucket: 'OPEX' },
  { id: 'NOMINA', label: 'Nómina, Salarios & Beneficios', pnlBucket: 'NOMINA' },
  { id: 'COMISIONES', label: 'Comisiones Fuerza de Ventas', pnlBucket: 'COMISIONES' },
  { id: 'FLETES', label: 'Fletes, Logística & Transporte', pnlBucket: 'FLETES' },
  { id: 'ALQUILER', label: 'Alquiler, Depósito & Condominio', pnlBucket: 'OPEX' },
  { id: 'SERVICIOS', label: 'Servicios Públicos, Internet & Sistemas', pnlBucket: 'OPEX' },
  { id: 'IMPUESTOS', label: 'Impuestos, Tributos & Retenciones', pnlBucket: 'IMPUESTOS' },
  { id: 'MANTENIMIENTO', label: 'Mantenimiento de Flota & Equipos', pnlBucket: 'OPEX' },
  { id: 'OTROS_GASTOS', label: 'Otros Gastos Administrativos', pnlBucket: 'OPEX' },
  { id: 'ABONO_PASIVO_SOCIO', label: '2.02.01.001 - Abono / Reembolso Cuenta por Pagar Socio', pnlBucket: 'PASIVO_SOCIO' }
];

const STANDARD_CATEGORY_IDS = new Set(EXPENSE_STANDARD_CATEGORIES.map((c) => c.id));

/**
 * Normaliza texto para comparaciones tolerantes a tildes y mayúsculas.
 */
const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

/**
 * Porcentaje seguro evitando división entre cero o NaN.
 */
export const safePct = (numerator, denominator) => {
  const num = Number(numerator || 0);
  const den = Number(denominator || 0);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return (num / den) * 100;
};

/**
 * Resuelve el precio de lista efectivo de un producto sin depender de campo heredado precioA.
 * Por defecto usa Mayorista (29/29 SKUs en BD) o Detal según el selector de lista.
 */
export const resolveProductListPrice = (product, tier = PRICE_LIST_TIERS.MAYOR) => {
  if (!product || typeof product !== 'object') return 0;
  const wholesale = Number(getProductWholesalePrice(product) || 0);
  const retail = Number(getProductRetailPrice(product) || 0);
  const legacyA = Number(product.precioA ?? product.precio_a ?? 0);
  const fallbackUsd = Number(product.precioUsd ?? product.precio_usd ?? product.precio ?? 0);

  if (tier === PRICE_LIST_TIERS.DETAL) {
    return round2(retail || wholesale || legacyA || fallbackUsd || 0);
  }
  return round2(wholesale || retail || legacyA || fallbackUsd || 0);
};

/**
 * Clasifica una categoría o descripción de cuenta Profit en un renglón del P&L.
 */
export const classifyExpenseBucket = (categoria = '', cuentaDesc = '') => {
  const catNorm = normalizeText(categoria);
  const matchedStd = EXPENSE_STANDARD_CATEGORIES.find((c) => c.id === catNorm);
  if (matchedStd) return matchedStd.pnlBucket;

  const combined = `${catNorm} ${normalizeText(cuentaDesc)}`;
  if (/NOMINA|SALARIO|SUELDO|BONO|CESTATICKET|IVSS|FAOV|VACACION|LIQUIDACION|PERSONAL/.test(combined)) {
    return 'NOMINA';
  }
  if (/COMISION/.test(combined)) return 'COMISIONES';
  if (/FLETE|TRANSPORTE|LOGISTICA|ACARREO|DESPACHO|ENVIO/.test(combined)) return 'FLETES';
  if (/ISLR|IVA|IGTF|IMPUESTO|TRIBUTO|ALCALDIA|PATENTE|MUNICIPAL|SENIAT/.test(combined)) return 'IMPUESTOS';
  return 'OPEX';
};

/**
 * Combina las categorías estándar con las cuentas reales de `profit_income_expense_accounts`.
 */
export const buildExpenseAccountOptions = (profitIncomeExpenseAccounts = []) => {
  const accounts = Array.isArray(profitIncomeExpenseAccounts) ? profitIncomeExpenseAccounts : [];
  const mappedProfit = accounts
    .map((acc) => {
      const code = String(acc.coIngr ?? acc.co_ingr ?? acc.id ?? '').trim();
      const descrip = String(acc.descrip ?? acc.descripcion ?? acc.name ?? '').trim();
      const ctaContab = String(acc.ctaContab ?? acc.cta_contab ?? '').trim();
      if (!code && !descrip) return null;
      return {
        id: code ? `PROFIT_${code}` : descrip,
        code,
        descrip: descrip || code,
        ctaContab,
        label: code ? `[${code}] ${descrip || code}` : descrip,
        pnlBucket: classifyExpenseBucket('', descrip),
        isProfitAccount: true
      };
    })
    .filter(Boolean);

  return {
    standardCategories: EXPENSE_STANDARD_CATEGORIES,
    profitAccounts: mappedProfit
  };
};

/**
 * Calcula el USD neto de un renglón de factura sin asignar 100% de la factura a cada línea cuando tasa <= 0.
 */
export const computeInvoiceItemProratedUsd = (item, allItems = [], invoice = {}) => {
  const directUsd = Number(item?.totalNetoUsd ?? item?.total_neto_usd ?? item?.subtotalUsd ?? 0);
  if (directUsd > 0) return directUsd;

  const tasa = Number(invoice?.tasa || 0);
  const itemBs = Number(item?.totalNeto ?? item?.total_neto ?? item?.subtotalBs ?? 0);
  if (tasa > 0 && itemBs > 0) {
    return itemBs / tasa;
  }

  const invTotalUsd = Number(invoice?.totNetoUsd ?? invoice?.tot_neto_usd ?? invoice?.totalUsd ?? 0);
  if (invTotalUsd <= 0) return 0;

  const itemsList = Array.isArray(allItems) && allItems.length > 0 ? allItems : [item];
  if (itemsList.length === 1) return invTotalUsd;

  const sumItemBs = itemsList.reduce(
    (acc, it) => acc + Math.max(0, Number(it?.totalNeto ?? it?.total_neto ?? 0)),
    0
  );
  if (sumItemBs > 0 && itemBs > 0) {
    return invTotalUsd * (itemBs / sumItemBs);
  }

  const qty = Math.max(0, Number(item?.cantidad ?? item?.totalArt ?? item?.total_art ?? 0));
  const sumQty = itemsList.reduce(
    (acc, it) => acc + Math.max(0, Number(it?.cantidad ?? it?.totalArt ?? it?.total_art ?? 0)),
    0
  );
  if (sumQty > 0 && qty > 0) {
    return invTotalUsd * (qty / sumQty);
  }

  return invTotalUsd / itemsList.length;
};

/**
 * Normaliza los renglones de un ajuste o devolución (soporta array JSON o string JSON).
 */
export const parseDocumentItems = (rawItems) => {
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === 'string' && rawItems.trim()) {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};

/**
 * Calcula el costo real en USD de un ajuste de inventario de salida (mermas/averías/consumo)
 * leyendo sus renglones (`tipo_trans: 'S'` y `cost_unit_om` / `cost_unit`). Cero porcentajes inventados.
 */
export const resolveAdjustmentRealCostUsd = (adj, fallbackTasa = 0) => {
  if (!adj || adj.anulado || adj.anulada) return 0;
  const tasa = Number(adj.tasa || fallbackTasa || 0);
  const renglones = parseDocumentItems(adj.renglones ?? adj.items);
  const adjTypeNorm = normalizeText(adj.tipo || '');

  let sumOutboundRenglones = 0;
  renglones.forEach((r) => {
    const tipoTrans = normalizeText(r?.tipo_trans ?? r?.tipoTrans ?? r?.tipo ?? '');
    const rawQty = Number(r?.total_art ?? r?.cantidad ?? r?.qty ?? 0);
    const isOutbound =
      tipoTrans.startsWith('S') ||
      rawQty < 0 ||
      (!tipoTrans && adjTypeNorm.includes('SALIDA'));
    if (!isOutbound) return;

    const qty = Math.abs(rawQty);
    if (qty <= 0) return;

    const explicitTotalUsd = Number(r?.totalNetoUsd ?? r?.costoTotalUsd ?? 0);
    if (explicitTotalUsd > 0) {
      sumOutboundRenglones += explicitTotalUsd;
      return;
    }

    const unitUsd = Number(r?.cost_unit_om ?? r?.costUnitOm ?? r?.costoUsd ?? r?.costoUnitarioUsd ?? 0);
    if (unitUsd > 0) {
      sumOutboundRenglones += qty * unitUsd;
      return;
    }

    const unitBs = Number(r?.cost_unit ?? r?.costUnit ?? r?.costoBs ?? 0);
    if (unitBs > 0 && tasa > 0) {
      sumOutboundRenglones += qty * (unitBs / tasa);
    }
  });

  if (sumOutboundRenglones > 0) return round2(sumOutboundRenglones);

  // Solo si no hay renglones valorizados y el encabezado ya trae un costo explícito positivo de salida
  const headerTotal = Number(adj.costoTotalUsd ?? adj.costo_total_usd ?? adj.totalCostoUsd ?? 0);
  if (headerTotal > 0 && (adjTypeNorm.includes('SALIDA') || renglones.length === 0)) {
    return round2(headerTotal);
  }
  return 0;
};

/**
 * Extrae las claves canónicas de un documento para evitar doble conteo entre tablas sincronizadas.
 */
const extractDocMatchKeys = (doc) => {
  const keys = new Set();
  if (!doc) return keys;
  const rawCandidates = [
    doc.id,
    doc.docNum,
    doc.doc_num,
    doc.numeroFactura,
    doc.numeroNotaEntrega,
    doc.numeroControl
  ];
  rawCandidates.forEach((cand) => {
    const str = String(cand || '').trim();
    if (!str) return;
    keys.add(str.toUpperCase());
    const canonical = getCanonicalDocKey(str);
    if (canonical) keys.add(canonical);
  });
  return keys;
};

/**
 * Filtra ventas locales POS que ya existen en `profit_invoices` para evitar contabilizarlas dos veces.
 */
export const deduplicatePosSalesAgainstProfitInvoices = (profitInvoices = [], sales = []) => {
  const seenKeys = new Set();
  (Array.isArray(profitInvoices) ? profitInvoices : []).forEach((inv) => {
    extractDocMatchKeys(inv).forEach((k) => seenKeys.add(k));
  });

  return (Array.isArray(sales) ? sales : []).filter((sale) => {
    if (!sale || sale.anulada || sale.anulado || sale.estado === 'ANULADA') return false;
    if (normalizeText(sale.tipoDocumento) === 'COTIZACION') return false;
    const saleKeys = extractDocMatchKeys(sale);
    for (const k of saleKeys) {
      if (seenKeys.has(k)) return false;
    }
    return true;
  });
};

/**
 * Normaliza una línea de factura Profit o POS a unidades vendidas y USD neto real.
 */
const normalizeSaleLine = (item, allItems, doc, productLookup) => {
  const coArt = String(item?.coArt ?? item?.co_art ?? item?.productId ?? item?.codigo ?? '').trim();
  const prod = productLookup.get(coArt);
  const qty = Math.max(0, Number(item?.cantidad ?? item?.totalArt ?? item?.total_art ?? 0));
  const netoUsd = computeInvoiceItemProratedUsd(item, allItems, doc);
  const unitCostUsd = Number(
    item?.costUnitOm ?? item?.cost_unit_om ?? item?.costoUnitario ?? item?.costoUsd ?? prod?.costoUsd ?? 0
  );
  return {
    coArt,
    qty,
    netoUsd,
    costUsd: qty * unitCostUsd,
    prod
  };
};

/**
 * Calcula los totales devueltos por SKU y globalmente a partir de `profit_customer_returns`.
 */
const computeReturnsSummary = (profitReturns = [], productLookup) => {
  const returnsBySku = new Map();
  let totalDevolucionesUsd = 0;
  let totalDevolucionesCmvUsd = 0;

  (Array.isArray(profitReturns) ? profitReturns : []).forEach((ret) => {
    if (!ret || ret.anulado || ret.anulada) return;
    const tasa = Number(ret.tasa || 0);
    const items = parseDocumentItems(ret.items ?? ret.renglones);
    if (items.length === 0) {
      const retUsd = Number(ret.totNetoUsd ?? ret.totalNetoUsd ?? 0);
      totalDevolucionesUsd += retUsd > 0 ? retUsd : (tasa > 0 ? Number(ret.totNeto || 0) / tasa : 0);
      return;
    }

    items.forEach((it) => {
      const coArt = String(it?.coArt ?? it?.co_art ?? it?.productId ?? it?.codigo ?? '').trim();
      const prod = productLookup.get(coArt);
      const qty = Math.max(0, Number(it?.cantidad ?? it?.totalArt ?? it?.total_art ?? 0));
      const itemNetoUsd = computeInvoiceItemProratedUsd(it, items, ret);
      const unitCost = Number(it?.costUnitOm ?? it?.cost_unit_om ?? prod?.costoUsd ?? 0);
      const cmvUsd = qty * unitCost;

      totalDevolucionesUsd += itemNetoUsd;
      totalDevolucionesCmvUsd += cmvUsd;

      if (coArt) {
        const cur = returnsBySku.get(coArt) || { qty: 0, usd: 0 };
        cur.qty += qty;
        cur.usd += itemNetoUsd;
        returnsBySku.set(coArt, cur);
      }
    });
  });

  return { returnsBySku, totalDevolucionesUsd, totalDevolucionesCmvUsd };
};

/**
 * Agrega métricas de rentabilidad por SKU combinando catálogo, facturas Profit, ventas POS únicas y devoluciones.
 */
export const aggregateSkuAnalytics = ({
  products = [],
  profitInvoices = [],
  sales = [],
  profitReturns = [],
  priceTier = PRICE_LIST_TIERS.MAYOR
}) => {
  const productList = Array.isArray(products) ? products : [];
  const productLookup = new Map();
  productList.forEach((p) => {
    const idKey = String(p.id || '').trim();
    const codKey = String(p.codigo || '').trim();
    if (idKey) productLookup.set(idKey, p);
    if (codKey) productLookup.set(codKey, p);
  });

  const histBySku = new Map();
  const accumulateDoc = (doc) => {
    const items = parseDocumentItems(doc.items ?? doc.renglones);
    items.forEach((item) => {
      const { coArt, qty, netoUsd } = normalizeSaleLine(item, items, doc, productLookup);
      if (!coArt) return;
      const cur = histBySku.get(coArt) || { cantVendida: 0, totalFacturadoUsd: 0 };
      cur.cantVendida += qty;
      cur.totalFacturadoUsd += netoUsd;
      histBySku.set(coArt, cur);
    });
  };

  (Array.isArray(profitInvoices) ? profitInvoices : []).forEach((fac) => {
    if (!fac || fac.anulado || fac.anulada) return;
    accumulateDoc(fac);
  });

  deduplicatePosSalesAgainstProfitInvoices(profitInvoices, sales).forEach((sale) => {
    accumulateDoc(sale);
  });

  const { returnsBySku } = computeReturnsSummary(profitReturns, productLookup);

  return productList.map((p) => {
    const stock = Number(p.stock || 0);
    const costo = Number(p.costoUsd ?? p.costo_usd ?? 0);
    const precioMayor = resolveProductListPrice(p, PRICE_LIST_TIERS.MAYOR);
    const precioDetal = resolveProductListPrice(p, PRICE_LIST_TIERS.DETAL);
    const precioLista = priceTier === PRICE_LIST_TIERS.DETAL ? precioDetal : precioMayor;
    const litrosUnidad = Number(p.litrosPorUnidad ?? p.litros_por_unidad ?? 1);

    const valorCostoTotal = stock * costo;
    const valorVentaTotal = stock * precioLista;
    const utilidadPotencialUsd = valorVentaTotal - valorCostoTotal;

    const utilidadUnitUsd = precioLista - costo;
    const margenListaPct = safePct(utilidadUnitUsd, precioLista);
    const markupPct = costo > 0 ? (utilidadUnitUsd / costo) * 100 : 0;

    const hist = histBySku.get(p.id) || histBySku.get(p.codigo) || { cantVendida: 0, totalFacturadoUsd: 0 };
    const ret = returnsBySku.get(p.id) || returnsBySku.get(p.codigo) || { qty: 0, usd: 0 };
    const netQty = Math.max(0, hist.cantVendida - ret.qty);
    const netFacturadoUsd = Math.max(0, hist.totalFacturadoUsd - ret.usd);
    const cmvHistoricoUsd = netQty * costo;
    const utilidadHistoricaUsd = netFacturadoUsd - cmvHistoricoUsd;
    const margenHistoricoPct = safePct(utilidadHistoricaUsd, netFacturadoUsd);

    return {
      ...p,
      stock,
      costo,
      precioA: precioLista,
      precioLista,
      precioMayor,
      precioDetal,
      litrosUnidad,
      valorCostoTotal,
      valorVentaTotal,
      utilidadPotencialUsd,
      utilidadUnitUsd,
      margenListaPct,
      markupPct,
      vendidasHistoricas: netQty,
      devueltasHistoricas: ret.qty,
      litrosVendidosHistoricos: netQty * litrosUnidad,
      facturadoHistoricoUsd: netFacturadoUsd,
      cmvHistoricoUsd,
      utilidadHistoricaUsd,
      margenHistoricoPct,
      rotacionEst: stock > 0 ? (netQty / stock) : 0
    };
  });
};

/**
 * Construye el conjunto de claves de referencia ya contabilizadas en gastos, nómina o liquidaciones
 * para impedir doble conteo al revisar movimientos directos en `cash_movements`.
 */
const collectLinkedReferenceIds = (expenses = [], payroll = [], commissionSettlements = []) => {
  const refs = new Set();
  const addIds = (arr, prefixList) => {
    (Array.isArray(arr) ? arr : []).forEach((rec) => {
      if (!rec) return;
      if (rec.id) refs.add(String(rec.id).trim());
      if (rec.cashMovementId) refs.add(String(rec.cashMovementId).trim());
      if (rec.referencia) refs.add(String(rec.referencia).trim());
      prefixList.forEach((pf) => {
        if (rec.id) refs.add(`${pf}${rec.id}`);
      });
    });
  };
  addIds(expenses, ['EXP_', 'GASTO_']);
  addIds(payroll, ['PAY_', 'NOM_']);
  addIds(commissionSettlements, ['COM_', 'LIQ_']);
  return refs;
};

/**
 * Motor financiero real del Estado de Resultados (P&L Operativo) y Simulador What-If.
 * En modo real (`isSimulation === false`), reporta exclusivamente cifras reales sin inventar %, fletes ni ventas.
 */
export const computeOperationalPandL = ({
  products = [],
  profitInvoices = [],
  sales = [],
  profitReturns = [],
  profitInventoryAdjustments = [],
  profitIslrWithholdings = [],
  cashMovements = [],
  commissionSettlements = [],
  expenses = [],
  payroll = [],
  config = {},
  isSimulation = false,
  simulationParams = {}
}) => {
  const tasaBcv = Number(config?.tasaDolar || 0);
  const productList = Array.isArray(products) ? products : [];
  const productLookup = new Map();
  productList.forEach((p) => {
    const idKey = String(p.id || '').trim();
    const codKey = String(p.codigo || '').trim();
    if (idKey) productLookup.set(idKey, p);
    if (codKey) productLookup.set(codKey, p);
  });

  // Inicializar dinámicamente las líneas reales existentes en productos (Diésel, Gasolina, Hidráulico, etc.)
  const linesMap = new Map();
  const ensureLine = (rawCat) => {
    const name = String(rawCat || '').trim() || 'Otros Lubricantes';
    if (!linesMap.has(name)) {
      linesMap.set(name, { name, rev: 0, cmv: 0, liters: 0, units: 0 });
    }
    return linesMap.get(name);
  };
  productList.forEach((p) => {
    if (p?.categoria) ensureLine(p.categoria);
  });

  let baseFacturadoBrutoUsd = 0;
  let baseCmvBrutoUsd = 0;
  let baseLiters = 0;
  let activeDocsCount = 0;

  const processSaleDoc = (doc) => {
    activeDocsCount += 1;
    const items = parseDocumentItems(doc.items ?? doc.renglones);
    if (items.length === 0) {
      const docNetoUsd = Number(
        doc.totNetoUsd ?? doc.tot_neto_usd ?? doc.subtotalUsd ?? (Number(doc.tasa || 0) > 0 ? Number(doc.totNeto || 0) / Number(doc.tasa) : 0)
      );
      baseFacturadoBrutoUsd += docNetoUsd;
      return;
    }

    items.forEach((it) => {
      const { qty, netoUsd, costUsd, prod } = normalizeSaleLine(it, items, doc, productLookup);
      const litersUnit = Number(prod?.litrosPorUnidad ?? prod?.litros_por_unidad ?? 1);
      const itemLiters = qty * litersUnit;

      baseFacturadoBrutoUsd += netoUsd;
      baseCmvBrutoUsd += costUsd;
      baseLiters += itemLiters;

      const lineBucket = ensureLine(prod?.categoria || it?.categoria);
      lineBucket.rev += netoUsd;
      lineBucket.cmv += costUsd;
      lineBucket.liters += itemLiters;
      lineBucket.units += qty;
    });
  };

  (Array.isArray(profitInvoices) ? profitInvoices : []).forEach((f) => {
    if (!f || f.anulado || f.anulada) return;
    processSaleDoc(f);
  });

  deduplicatePosSalesAgainstProfitInvoices(profitInvoices, sales).forEach((s) => {
    processSaleDoc(s);
  });

  // Devoluciones reales de clientes
  const { totalDevolucionesUsd, totalDevolucionesCmvUsd } = computeReturnsSummary(profitReturns, productLookup);

  const realFacturadoNetoUsd = Math.max(0, baseFacturadoBrutoUsd - totalDevolucionesUsd);
  const realCmvNetoUsd = Math.max(0, baseCmvBrutoUsd - totalDevolucionesCmvUsd);

  // Escaladores únicamente cuando el usuario está activamente en el Simulador What-If
  const simVolPct = isSimulation ? Number(simulationParams.simVolPct ?? 100) : 100;
  const simPricePct = isSimulation ? Number(simulationParams.simPricePct ?? 100) : 100;
  const volFactor = simVolPct / 100;
  const priceFactor = simPricePct / 100;

  const facturadoAjustadoUsd = realFacturadoNetoUsd * volFactor * priceFactor;
  const cmvAjustadoUsd = realCmvNetoUsd * volFactor;
  const litersSold = baseLiters * volFactor;
  const utilidadBrutaUsd = facturadoAjustadoUsd - cmvAjustadoUsd;

  // Mermas y Ajustes reales de salida (cero % inventado)
  const activeAdjs = (Array.isArray(profitInventoryAdjustments) ? profitInventoryAdjustments : []).filter(
    (a) => a && !a.anulado && !a.anulada
  );
  const realMermasUsd = activeAdjs.reduce((acc, a) => acc + resolveAdjustmentRealCostUsd(a, tasaBcv), 0);

  // Liquidaciones reales de comisiones (excluyendo anuladas)
  const activeSettlements = (Array.isArray(commissionSettlements) ? commissionSettlements : []).filter(
    (s) => s && normalizeText(s.estado) !== 'ANULADA'
  );
  const settlementsComisionUsd = activeSettlements.reduce(
    (acc, s) => acc + Number(s.totalComisionUsd ?? s.total_comision_usd ?? 0),
    0
  );

  // Nómina real registrada (excluyendo anuladas)
  const activePayrolls = (Array.isArray(payroll) ? payroll : []).filter(
    (p) => p && normalizeText(p.estado) !== 'ANULADA'
  );
  const payrollRecordsUsd = activePayrolls.reduce(
    (acc, p) => acc + Number(p.totalNetoUsd ?? p.total_neto_usd ?? p.totalUsd ?? 0),
    0
  );

  // Gastos operativos registrados (categorizados por cuenta Profit o estándar)
  const activeExpenses = (Array.isArray(expenses) ? expenses : []).filter(
    (e) => e && normalizeText(e.estado) !== 'ANULADA'
  );
  let expFletesUsd = 0;
  let expComisionesUsd = 0;
  let expNominaUsd = 0;
  let expImpuestosUsd = 0;
  let expOpexUsd = 0;

  activeExpenses.forEach((exp) => {
    const amount = Number(exp.montoUsd ?? exp.monto_usd ?? 0);
    if (amount <= 0) return;
    const bucket = classifyExpenseBucket(exp.categoria, `${exp.cuentaGastoDesc || ''} ${exp.concepto || ''}`);
    if (bucket === 'FLETES') expFletesUsd += amount;
    else if (bucket === 'COMISIONES') expComisionesUsd += amount;
    else if (bucket === 'NOMINA') expNominaUsd += amount;
    else if (bucket === 'IMPUESTOS') expImpuestosUsd += amount;
    else expOpexUsd += amount;
  });

  // Egresos reales en cash_movements NO vinculados a un registro ya sumado en expenses/payroll/settlements
  const linkedRefs = collectLinkedReferenceIds(activeExpenses, activePayrolls, activeSettlements);
  let cashFletesUsd = 0;
  let cashComisionesUsd = 0;
  let cashNominaUsd = 0;
  let cashImpuestosUsd = 0;
  let cashOpexUsd = 0;

  (Array.isArray(cashMovements) ? cashMovements : []).forEach((m) => {
    if (!m || m.anulado || m.anulada) return;
    const tipo = normalizeText(m.tipo);
    if (tipo !== 'EGRESO') return;
    const refId = String(m.referenciaId ?? m.referencia ?? m.id ?? '').trim();
    if (refId && linkedRefs.has(refId)) return;
    const movId = String(m.id || '').trim();
    if (movId && linkedRefs.has(movId)) return;

    const amount = Number(m.montoUsd ?? m.monto_usd ?? 0);
    if (amount <= 0) return;

    const cat = normalizeText(m.categoria);
    const cuentaDesc = `${m.cuentaGastoDesc || m.cuenta_gasto || ''} ${m.concepto || ''}`;
    const bucket = classifyExpenseBucket(cat, cuentaDesc);
    // Movimientos puramente patrimoniales / pasivos o transferencias entre cuentas no son OPEX del Estado de Resultados
    if (
      cat === 'ABONO_PASIVO_SOCIO' ||
      bucket === 'PASIVO_SOCIO' ||
      cat === 'PAGO_PROVEEDOR' ||
      cat === 'TRANSFERENCIA_INTERNA' ||
      String(m.cuentaGasto || m.cuenta_gasto || '').trim().startsWith('2.02.')
    ) {
      return;
    }
    const isOperationalCashOut =
      STANDARD_CATEGORY_IDS.has(cat) ||
      Boolean(m.cuentaGasto || m.cuenta_gasto) ||
      ['NOMINA', 'COMISIONES', 'FLETES', 'IMPUESTOS'].includes(bucket) ||
      cat === 'EGRESO';

    if (!isOperationalCashOut && cat === 'COMPRA') return; // Compras de inventario van a CMV/inventario, no OPEX

    if (bucket === 'FLETES') cashFletesUsd += amount;
    else if (bucket === 'COMISIONES') cashComisionesUsd += amount;
    else if (bucket === 'NOMINA') cashNominaUsd += amount;
    else if (bucket === 'IMPUESTOS') cashImpuestosUsd += amount;
    else cashOpexUsd += amount;
  });

  // Retenciones / Tributos ISLR reales
  const islrFromWithholdings = (Array.isArray(profitIslrWithholdings) ? profitIslrWithholdings : [])
    .filter((w) => w && !w.anulado && !w.anulada)
    .reduce((acc, w) => {
      const explicitUsd = Number(w.montoRetenidoUsd ?? w.monto_retenido_usd ?? 0);
      if (explicitUsd > 0) return acc + explicitUsd;
      const bs = Number(w.montoRetenido ?? w.monto_retenido ?? 0);
      const t = Number(w.tasa || tasaBcv || 0);
      return acc + (t > 0 ? bs / t : 0);
    }, 0);

  const realFletesUsd = round2(expFletesUsd + cashFletesUsd);
  const realComisionesUsd = round2(settlementsComisionUsd + expComisionesUsd + cashComisionesUsd);
  const realNominaUsd = round2(payrollRecordsUsd + expNominaUsd + cashNominaUsd);
  const realIslrTributosUsd = round2(islrFromWithholdings + expImpuestosUsd + cashImpuestosUsd);
  const realOpexFijoUsd = round2(expOpexUsd + cashOpexUsd);

  const costoFletesUsd = isSimulation
    ? round2(litersSold * Number(simulationParams.freightPerLiterUsd ?? 0))
    : realFletesUsd;
  const comisionesVendedoresUsd = isSimulation
    ? round2(facturadoAjustadoUsd * (Number(simulationParams.avgCommissionPct ?? 0) / 100))
    : realComisionesUsd;
  const costoNominaUsd = isSimulation
    ? round2(Number(simulationParams.payrollUsd ?? realNominaUsd))
    : realNominaUsd;
  const costoMermasUsd = round2(realMermasUsd);
  const retencionesIslrUsd = round2(realIslrTributosUsd);
  const opexFijoUsd = isSimulation
    ? round2(Number(simulationParams.opexUsd ?? realOpexFijoUsd))
    : realOpexFijoUsd;

  const totalGastosVariablesUsd = round2(costoFletesUsd + comisionesVendedoresUsd + costoMermasUsd + retencionesIslrUsd);
  const margenContribucionUsd = round2(utilidadBrutaUsd - totalGastosVariablesUsd);
  const totalGastosFijosUsd = round2(costoNominaUsd + opexFijoUsd);
  const ebitdaOperativoUsd = round2(margenContribucionUsd - totalGastosFijosUsd);

  const margenContribPct = safePct(margenContribucionUsd, facturadoAjustadoUsd);
  const opexCoberturaRatio = facturadoAjustadoUsd > 0 ? margenContribucionUsd / facturadoAjustadoUsd : 0;
  const puntoEquilibrioUsd = opexCoberturaRatio > 0 ? totalGastosFijosUsd / opexCoberturaRatio : 0;
  const utilidadPorLitroUsd = litersSold > 0 ? ebitdaOperativoUsd / litersSold : 0;

  const linesArray = Array.from(linesMap.values())
    .map((ln) => {
      const adjRev = ln.rev * volFactor * priceFactor;
      const adjCmv = ln.cmv * volFactor;
      const marginUsd = adjRev - adjCmv;
      return {
        name: ln.name,
        rev: round2(adjRev),
        cmv: round2(adjCmv),
        liters: round2(ln.liters * volFactor),
        units: Math.round(ln.units * volFactor),
        marginUsd: round2(marginUsd),
        marginPct: safePct(marginUsd, adjRev)
      };
    })
    .filter((ln) => ln.rev > 0 || ln.cmv > 0 || ln.units > 0)
    .sort((a, b) => b.rev - a.rev);

  const linesTotalRev = linesArray.reduce((acc, l) => acc + l.rev, 0);
  const linesWithShare = linesArray.map((ln) => ({
    ...ln,
    sharePct: safePct(ln.rev, linesTotalRev)
  }));

  return {
    isSimulation,
    hasSalesData: facturadoAjustadoUsd > 0 || activeDocsCount > 0,
    activeDocsCount,
    facturadoBrutoUsd: round2(baseFacturadoBrutoUsd * volFactor * priceFactor),
    devolucionesUsd: round2(totalDevolucionesUsd),
    facturadoAjustadoUsd: round2(facturadoAjustadoUsd),
    cmvAjustadoUsd: round2(cmvAjustadoUsd),
    utilidadBrutaUsd: round2(utilidadBrutaUsd),
    margenBrutoPct: safePct(utilidadBrutaUsd, facturadoAjustadoUsd),
    litersSold: round2(litersSold),
    costoFletesUsd,
    comisionesVendedoresUsd,
    costoNominaUsd,
    costoMermasUsd,
    retencionesIslrUsd,
    totalGastosVariablesUsd,
    margenContribucionUsd,
    margenContribPct,
    opexFijoUsd,
    totalGastosFijosUsd,
    ebitdaOperativoUsd,
    ebitdaPct: safePct(ebitdaOperativoUsd, facturadoAjustadoUsd),
    puntoEquilibrioUsd: round2(puntoEquilibrioUsd),
    utilidadPorLitroUsd: round2(utilidadPorLitroUsd),
    linesBreakdown: linesWithShare,
    dataSources: {
      expensesCount: activeExpenses.length,
      payrollCount: activePayrolls.length,
      settlementsCount: activeSettlements.length,
      returnsCount: (Array.isArray(profitReturns) ? profitReturns : []).filter((r) => r && !r.anulado && !r.anulada).length,
      adjustmentsCount: activeAdjs.length
    }
  };
};
