import { getProductWarehouseStocks, resolveProductUnit } from '../services/formatService.js';
import { getCanonicalDocKey } from '../services/fiscalService.js';

export function isDocumentAnnulled(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (doc.anulada === true || doc.anulado === true) return true;
  const status = String(doc.status || doc.estado || '').trim().toUpperCase();
  return status === 'ANULADA' || status === 'ANULADO' || status === 'VOID';
}

/**
 * Normaliza códigos correlativos de Ajuste / Traslado sin duplicar prefijos (AJU- / TRA- / TRAS-).
 */
export function formatKardexDocCode(rawNum, prefix = 'AJU') {
  const s = String(rawNum ?? '').trim();
  if (!s) return `${prefix}-000000`;
  const upper = s.toUpperCase();
  if (upper.startsWith('AJU-') || upper.startsWith('TRA-') || upper.startsWith('TRAS-')) {
    return upper;
  }
  if (/^\d+$/.test(s)) {
    return `${prefix}-${s.padStart(6, '0')}`;
  }
  return `${prefix}-${upper}`;
}

/**
 * Resuelve costo unitario real en USD y Bs. para renglones de ajustes y traslados,
 * corrigiendo registros de Profit donde `cost_unit_om` vino grabado en Bolívares (`cost_unit_om === cost_unit`).
 */
export function resolveKardexLineCosts({ line = {}, productsBySku = null, tasaDolar = 827.73 } = {}) {
  const safeRate = Number(tasaDolar) > 1 ? Number(tasaDolar) : 827.73;
  const sku = String(line?.co_art || line?.codigo || line?.articuloId || '').trim();
  const prod = productsBySku instanceof Map ? productsBySku.get(sku) : null;
  const catalogCostUsd = Number(prod?.costoUsd ?? prod?.costo ?? prod?.costo_unitario ?? 0) || 0;

  const rawOm = Number(line?.cost_unit_om ?? line?.costUnitOm ?? line?.costoUsd ?? 0) || 0;
  const rawBs = Number(line?.cost_unit ?? line?.costUnit ?? line?.costoBs ?? 0) || 0;
  const omEqualsBs = rawOm > 0 && rawBs > 0 && Math.abs(rawOm - rawBs) < 0.01;

  let costUsd = 0;
  if (rawOm > 0 && !omEqualsBs) {
    costUsd = rawOm;
  } else if (catalogCostUsd > 0) {
    costUsd = catalogCostUsd;
  } else if (rawBs > 0) {
    costUsd = rawBs / safeRate;
  }

  const costBs = rawBs > 0 ? rawBs : costUsd * safeRate;
  return { costUsd, costBs };
}

export function buildConsolidatedKardex({
  products = [],
  adjustments = [],
  transfers = [],
  purchases = [],
  profitPurchases = [],
  goodsReceiptNotes = [],
  sales = [],
  profitInvoices = [],
  profitReturns = [],
  searchTerm = ''
} = {}) {
  const map = {};
  const byProductIdOrCode = new Map();

  const ensureEntry = (rawCode, fallback = {}) => {
    const cleanCode = String(rawCode || '').trim();
    if (!cleanCode) return null;
    const mappedCode = byProductIdOrCode.get(cleanCode) || cleanCode;
    if (!map[mappedCode]) {
      map[mappedCode] = {
        codigo: mappedCode,
        descripcion: fallback.descripcion || mappedCode,
        viscosidad: fallback.viscosidad || 'N/A',
        stock01: 0,
        stock02: 0,
        stockActual: 0,
        unidad: resolveProductUnit(fallback, 'Caja'),
        entradasCompras: 0,
        salidasVentas: 0,
        devolucionesClientes: 0,
        entradasAjuste: 0,
        salidasAjuste: 0,
        traslados: 0
      };
    }
    return map[mappedCode];
  };

  (products || []).forEach((p) => {
    if (!p) return;
    const codigo = String(p.codigo || p.id || '').trim();
    if (!codigo) return;
    const stocks = getProductWarehouseStocks(p);
    map[codigo] = {
      codigo,
      descripcion: p.descripcion || p.nombre || codigo,
      viscosidad: p.viscosidad || 'N/A',
      stock01: stocks.stock01,
      stock02: stocks.stock02,
      stockActual: stocks.total,
      unidad: resolveProductUnit(p, 'Caja'),
      entradasCompras: 0,
      salidasVentas: 0,
      devolucionesClientes: 0,
      entradasAjuste: 0,
      salidasAjuste: 0,
      traslados: 0
    };
    if (p.id) byProductIdOrCode.set(String(p.id).trim(), codigo);
    byProductIdOrCode.set(codigo, codigo);
  });

  // 1. Compras (Profit + Signum local deduplicadas, excluyendo anuladas)
  const seenPurchaseKeys = new Set();
  const seenPurchaseInvoices = new Set();
  const registerPurchaseLine = (item, fallbackName = '') => {
    const qty = Number(item?.cantidad ?? item?.qty ?? 0);
    const code = item?.codigo || item?.co_art || item?.articuloId || item?.productoId;
    if (!(qty > 0) || !code) return;
    const entry = ensureEntry(code, { descripcion: item?.descripcion || item?.producto || fallbackName });
    if (entry) entry.entradasCompras += qty;
  };

  (profitPurchases || []).forEach((p) => {
    if (!p || isDocumentAnnulled(p)) return;
    const inv = String(p.facturaProv || p.factNum || p.id || '').trim().toUpperCase();
    const rif = String(p.provRif || p.coProv || '').trim().toUpperCase();
    const dedupeKey = `${inv}::${rif}`;
    seenPurchaseKeys.add(dedupeKey);
    if (inv) seenPurchaseInvoices.add(inv);
    if (Array.isArray(p.items)) {
      p.items.forEach((it) => registerPurchaseLine(it));
    }
  });

  (purchases || []).forEach((p) => {
    if (!p || isDocumentAnnulled(p)) return;
    const inv = String(p.numeroFacturaProv || p.nroFactura || p.id || '').trim().toUpperCase();
    const rif = String(p.proveedorRif || p.proveedorId || '').trim().toUpperCase();
    const dedupeKey = `${inv}::${rif}`;
    if (seenPurchaseKeys.has(dedupeKey)) return;
    seenPurchaseKeys.add(dedupeKey);
    if (inv) seenPurchaseInvoices.add(inv);
    if (Array.isArray(p.items) && p.items.length > 0) {
      p.items.forEach((it) => registerPurchaseLine(it));
    } else if (p.productoCodigo || p.productoId) {
      registerPurchaseLine({
        codigo: p.productoCodigo || p.productoId,
        cantidad: p.cantidad,
        descripcion: p.producto
      });
    }
  });

  // Recepciones de mercancía (solo si no están vinculadas a factura ya contada en compras)
  (goodsReceiptNotes || []).forEach((rec) => {
    if (!rec || isDocumentAnnulled(rec)) return;
    const inv = String(rec.nro_fact || rec.nroFactura || '').trim().toUpperCase();
    if (inv && seenPurchaseInvoices.has(inv)) return;
    (rec.items || []).forEach((it) => {
      const qty = Number(it.cantidadRecibida ?? it.cantidad ?? 0);
      const entry = ensureEntry(it.codigo || it.articuloId, { descripcion: it.descripcion, unidad: it.unidad });
      if (entry && qty > 0) entry.entradasCompras += qty;
    });
  });

  // 2. Ventas (Profit + POS local deduplicadas, excluyendo anuladas)
  const seenSaleKeys = new Set();
  const processSaleDoc = (doc) => {
    if (!doc || isDocumentAnnulled(doc)) return;
    const canon = getCanonicalDocKey(doc) || String(doc.id || doc.factNum || doc.numeroFactura || '').trim().toUpperCase();
    if (canon && seenSaleKeys.has(canon)) return;
    if (canon) seenSaleKeys.add(canon);

    const lines = Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : (Array.isArray(doc.renglones) ? doc.renglones : []);
    lines.forEach((it) => {
      const qty = Number(it.cantidad ?? it.total_art ?? it.qty ?? 0);
      const code = it.codigo || it.co_art || it.articuloId || it.product?.codigo || it.product?.id;
      if (!(qty > 0) || !code) return;
      const entry = ensureEntry(code, { descripcion: it.descripcion || it.art_des || it.product?.descripcion });
      if (entry) entry.salidasVentas += qty;
    });
  };
  (profitInvoices || []).forEach(processSaleDoc);
  (sales || []).forEach(processSaleDoc);

  // 3. Devoluciones de Clientes (excluyendo anuladas)
  (profitReturns || []).forEach((ret) => {
    if (!ret || isDocumentAnnulled(ret)) return;
    const lines = Array.isArray(ret.renglones) && ret.renglones.length > 0 ? ret.renglones : (Array.isArray(ret.items) ? ret.items : []);
    lines.forEach((r) => {
      const qty = Number(r.total_art ?? r.cantidad ?? 0);
      const code = r.co_art || r.codigo || r.articuloId;
      if (!(qty > 0) || !code) return;
      const entry = ensureEntry(code, { descripcion: r.art_des || r.descripcion });
      if (entry) entry.devolucionesClientes += qty;
    });
  });

  // 4. Ajustes de Inventario (excluyendo anulados)
  (adjustments || []).forEach((a) => {
    if (!a || isDocumentAnnulled(a)) return;
    (a.renglones || []).forEach((r) => {
      const qty = Number(r.total_art ?? r.cantidad ?? 0);
      const entry = ensureEntry(r.co_art || r.codigo || r.articuloId, { descripcion: r.art_des, unidad: r.uni_venta });
      if (!entry || !(qty > 0)) return;
      if (String(r.tipo_trans || 'S').toUpperCase() === 'E') {
        entry.entradasAjuste += qty;
      } else {
        entry.salidasAjuste += qty;
      }
    });
  });

  // 5. Traslados entre Almacenes (excluyendo anulados)
  (transfers || []).forEach((t) => {
    if (!t || isDocumentAnnulled(t)) return;
    (t.renglones || []).forEach((r) => {
      const qty = Number(r.total_art ?? r.cantidad ?? 0);
      const entry = ensureEntry(r.co_art || r.codigo || r.articuloId, { descripcion: r.art_des, unidad: r.uni_venta });
      if (entry && qty > 0) {
        entry.traslados += qty;
      }
    });
  });

  const term = String(searchTerm || '').trim().toLowerCase();
  return Object.values(map)
    .filter((p) => {
      if (!term) return true;
      return (
        String(p.codigo || '').toLowerCase().includes(term) ||
        String(p.descripcion || '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) =>
      String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
    );
}
