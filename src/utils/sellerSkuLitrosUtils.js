import { resolveProductUnit, resolveProductLitersPerUnit, round2 } from '../services/formatService.js';
import { matchesSeller, isDocAnulada, resolveInvoiceLitros } from '../services/commissionService.js';

function isServiceOrFreightItem(sku, desc) {
  const lower = String(desc || '').toLowerCase();
  const cleanSku = String(sku || '').trim().toUpperCase();
  return (
    lower.includes('flete') ||
    lower.includes('servicio') ||
    cleanSku === '101815' ||
    cleanSku === 'GNP001'
  );
}

function isSyntheticItem(sku) {
  const cleanSku = String(sku || '').trim().toUpperCase();
  return cleanSku === 'LUB-MANUAL' || cleanSku === 'NE-DESP';
}

/**
 * Consolida las ventas por SKU en litros, presentación y porcentaje de meta alcanzada
 * para un asesor comercial en el conjunto de facturas y devoluciones filtrado.
 */
export function buildSellerSkuLitrosSummary({
  seller,
  invoices = [],
  returns = [],
  products = [],
  metaLitros = 3000
} = {}) {
  if (!seller) {
    return {
      skus: [],
      presentaciones: [],
      litrosFacturados: 0,
      litrosDevueltos: 0,
      litrosConsolidados: 0,
      totalUnidades: 0,
      metaLitros: Number(metaLitros) || 3000,
      porcentajeMeta: 0,
      litrosRestantesMeta: Number(metaLitros) || 3000,
      litrosExcedenteMeta: 0,
      facturasCount: 0
    };
  }

  const productsBySku = new Map();
  (products || []).forEach((p) => {
    const code = String(p?.codigo || p?.id || '').trim().toUpperCase();
    if (code) productsBySku.set(code, p);
  });

  const sellerInvoices = (invoices || []).filter(
    (inv) => inv && !isDocAnulada(inv) && matchesSeller(seller, inv)
  );
  const sellerReturns = (returns || []).filter(
    (ret) => ret && !isDocAnulada(ret) && matchesSeller(seller, ret)
  );

  const skuMap = new Map();

  const addSkuEntry = ({ sku, descripcion, presentacion, litrosPorUnidad, cantidad, litros, montoUsd }) => {
    const key = `${sku}||${presentacion}`;
    const existing = skuMap.get(key);
    if (existing) {
      existing.cantidad = round2(existing.cantidad + cantidad);
      existing.litros = round2(existing.litros + litros);
      existing.montoUsd = round2(existing.montoUsd + montoUsd);
      existing.facturasCount += 1;
    } else {
      skuMap.set(key, {
        sku,
        descripcion: descripcion || `SKU ${sku}`,
        presentacion,
        litrosPorUnidad: round2(litrosPorUnidad),
        cantidad: round2(cantidad),
        litros: round2(litros),
        montoUsd: round2(montoUsd),
        facturasCount: 1
      });
    }
  };

  for (const inv of sellerInvoices) {
    const items = Array.isArray(inv?.items) ? inv.items : [];
    const hasRealItems = items.some((it) => it && !isSyntheticItem(it.articuloId || it.codigo || it.id));

    if (items.length > 0 && hasRealItems) {
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const sku = String(it.articuloId || it.codigo || it.id || '').trim() || 'SIN-SKU';
        const descripcion = String(it.descripcion || it.nombre || '').trim();
        if (isServiceOrFreightItem(sku, descripcion)) continue;

        const prod = productsBySku.get(sku.toUpperCase());
        const presentacion = resolveProductUnit(
          { ...(prod || {}), ...it, descripcion },
          prod?.unidad || 'Caja'
        );

        const cantidad = Math.max(0, Number(it.cantidad ?? it.qty ?? 0) || 0);
        let litrosPorUnidad = 0;
        let litros = 0;

        if (isSyntheticItem(sku)) {
          litros = Number(it.litrosTotales ?? it.litros_totales ?? it.litros ?? 0) || 0;
          litrosPorUnidad = cantidad > 0 ? round2(litros / cantidad) : litros;
        } else {
          litrosPorUnidad = prod
            ? resolveProductLitersPerUnit({ ...prod, unidadVenta: presentacion, descripcion })
            : resolveProductLitersPerUnit({ ...it, unidadVenta: presentacion, descripcion });
          litros = cantidad > 0 && litrosPorUnidad > 0
            ? round2(cantidad * litrosPorUnidad)
            : round2(Number(it.litrosTotales ?? it.litros_totales ?? it.litros ?? 0) || 0);
        }

        if (litros <= 0 && cantidad <= 0) continue;

        const montoUsd = Number(
          it.totalUsd ?? it.subtotalUsd ?? it.netoUsd ?? ((Number(it.precioUsd ?? it.precio ?? 0) || 0) * cantidad)
        ) || 0;

        addSkuEntry({
          sku,
          descripcion: descripcion || prod?.descripcion || prod?.nombre || `SKU ${sku}`,
          presentacion,
          litrosPorUnidad,
          cantidad,
          litros,
          montoUsd
        });
      }
    } else {
      const invLitros = resolveInvoiceLitros(inv);
      if (invLitros > 0) {
        addSkuEntry({
          sku: 'SIN-DESGLOSE',
          descripcion: 'Ventas sin desglose de renglones',
          presentacion: 'Litros',
          litrosPorUnidad: 1,
          cantidad: invLitros,
          litros: invLitros,
          montoUsd: Number(inv?.totNetoUsd) || 0
        });
      }
    }
  }

  const litrosFacturados = round2(
    Array.from(skuMap.values()).reduce((acc, row) => acc + row.litros, 0)
  );
  const litrosDevueltos = round2(
    sellerReturns.reduce((acc, r) => acc + Math.abs(Number(r?.litrosTotales ?? r?.litros_totales ?? 0) || 0), 0)
  );
  const litrosConsolidados = Math.max(0, round2(litrosFacturados - litrosDevueltos));

  const safeMeta = Number(metaLitros) > 0 ? Number(metaLitros) : (Number(seller?.metaLitros) || Number(seller?.metaLitrosMes) || 3000);
  const porcentajeMeta = safeMeta > 0 ? Number(((litrosConsolidados / safeMeta) * 100).toFixed(1)) : 0;

  const skus = Array.from(skuMap.values())
    .map((row) => ({
      ...row,
      pctTotalLitros: litrosFacturados > 0 ? Number(((row.litros / litrosFacturados) * 100).toFixed(1)) : 0,
      pctMeta: safeMeta > 0 ? Number(((row.litros / safeMeta) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.litros - a.litros);

  const presMap = new Map();
  for (const row of skus) {
    const existing = presMap.get(row.presentacion);
    if (existing) {
      existing.cantidad = round2(existing.cantidad + row.cantidad);
      existing.litros = round2(existing.litros + row.litros);
      existing.skusCount += 1;
    } else {
      presMap.set(row.presentacion, {
        presentacion: row.presentacion,
        cantidad: round2(row.cantidad),
        litros: round2(row.litros),
        skusCount: 1
      });
    }
  }

  const presentaciones = Array.from(presMap.values())
    .map((p) => ({
      ...p,
      pctTotalLitros: litrosFacturados > 0 ? Number(((p.litros / litrosFacturados) * 100).toFixed(1)) : 0,
      pctMeta: safeMeta > 0 ? Number(((p.litros / safeMeta) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.litros - a.litros);

  const totalUnidades = round2(skus.reduce((acc, r) => acc + r.cantidad, 0));

  return {
    skus,
    presentaciones,
    litrosFacturados,
    litrosDevueltos,
    litrosConsolidados,
    totalUnidades,
    metaLitros: safeMeta,
    porcentajeMeta,
    litrosRestantesMeta: Math.max(0, round2(safeMeta - litrosConsolidados)),
    litrosExcedenteMeta: Math.max(0, round2(litrosConsolidados - safeMeta)),
    facturasCount: sellerInvoices.length
  };
}
