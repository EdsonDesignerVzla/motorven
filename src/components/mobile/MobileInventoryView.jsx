import React, { useMemo, useState } from 'react';
import {
  Boxes,
  Droplets,
  FileDown,
  Filter,
  Package,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Warehouse,
  X
} from 'lucide-react';
import OilstoneProductImage from '../OilstoneProductImage';
import { useNotification } from '../../context/NotificationContext';
import {
  formatBs,
  formatUnitVe,
  getProductWarehouseStocks,
  resolveProductLitersPerUnit,
  resolveProductUnit,
  round2
} from '../../services/formatService';
import { generateInventoryPDF } from '../../services/pdfReportService';
import { extractViscosityBadge, resolveDailyRate } from './mobileOrderHelpers';

const WAREHOUSE_FILTER_OPTIONS = [
  {
    id: 'TODOS',
    label: 'Consolidado',
    sublabel: 'Alm 01 + 02',
    headerSubtitle: 'Almacén 01 (SENIAT Fiscal) • Almacén 02 (Bóveda Despacho)',
    footerLabel: 'CONSOLIDADO TOTAL (01+02)',
    kpiUnitSub: 'Unid / Cajas',
    kpiVolSub: 'Litros netos',
    ctaLabel: 'DESCARGAR PDF CONSOLIDADO (01+02)',
    pdfWarehouseId: 'TODOS',
    pdfWarehouseName: 'Todos los Almacenes (Consolidado > 0: Alm 01 + Alm 02)'
  },
  {
    id: '01',
    label: 'Alm 01',
    sublabel: 'SENIAT Fiscal',
    headerSubtitle: '01: Almacén Principal Mostrador (Facturas Fiscales SENIAT)',
    footerLabel: 'STOCK ALMACÉN 01 (SENIAT)',
    kpiUnitSub: 'Unid en Alm 01',
    kpiVolSub: 'Litros Alm 01',
    ctaLabel: 'DESCARGAR PDF ALMACÉN 01 (FISCAL)',
    pdfWarehouseId: '01',
    pdfWarehouseName: '01: ALMACÉN PRINCIPAL / MOSTRADOR (Facturas Fiscales)'
  },
  {
    id: '02',
    label: 'Alm 02',
    sublabel: 'Bóveda N/E',
    headerSubtitle: '02: Almacén Central Bóveda (Notas de Entrega / Despacho)',
    footerLabel: 'STOCK ALMACÉN 02 (BÓVEDA)',
    kpiUnitSub: 'Unid en Alm 02',
    kpiVolSub: 'Litros Alm 02',
    ctaLabel: 'DESCARGAR PDF ALMACÉN 02 (BÓVEDA)',
    pdfWarehouseId: '02',
    pdfWarehouseName: '02: ALMACÉN CENTRAL / BÓVEDA (Notas de Entrega)'
  }
];

function resolveScopedWarehouseStock(item, warehouseFilter) {
  if (warehouseFilter === '01') {
    return {
      stock: item.stock01,
      liters: item.liters01,
      minThreshold: Math.max(1, Math.round(item.minStock * 0.4))
    };
  }
  if (warehouseFilter === '02') {
    return {
      stock: item.stock02,
      liters: item.liters02,
      minThreshold: Math.max(1, Math.round(item.minStock * 0.6))
    };
  }
  return {
    stock: item.stockTotal,
    liters: item.litersTotal,
    minThreshold: item.minStock
  };
}

function partitionWarehouseItems(records, warehouseId) {
  const activeItems = [];
  const hiddenZeroItems = [];
  (Array.isArray(records) ? records : []).forEach((item) => {
    const scoped = resolveScopedWarehouseStock(item, warehouseId);
    if (scoped.stock <= 0) {
      hiddenZeroItems.push(item.prod);
      return;
    }
    activeItems.push({
      ...item,
      scopedStock: scoped.stock,
      scopedLiters: scoped.liters,
      isLowStock: scoped.stock <= scoped.minThreshold
    });
  });
  return { activeItems, hiddenZeroItems };
}

function filterCatalogItems(items, presentationFilter, queryText) {
  const q = String(queryText || '').trim().toLowerCase();
  return items.filter((item) => {
    if (presentationFilter !== 'TODOS' && item.pres.key !== presentationFilter) {
      return false;
    }
    if (!q) return true;
    const hay = `${item.title} ${item.sku} ${item.subtitle} ${item.pres.badgeLabel}`.toLowerCase();
    return hay.includes(q);
  });
}

function buildPresentationMeta(unitName, litersPerUnit) {
  const unit = String(unitName || 'Caja').trim();
  const unitLower = unit.toLowerCase();
  const lpu = Number(litersPerUnit || 0);

  if (unitLower === 'caja') {
    return {
      key: 'CAJA',
      chipLabel: lpu === 12 ? 'Cajas 12x1L' : 'Cajas',
      badgeLabel: lpu === 12 ? 'CAJA 12x1L' : `CAJA ${lpu > 0 ? `${lpu}L` : ''}`.trim(),
      shortUnit: 'cjs',
      longUnit: 'Bultos equivalentes'
    };
  }
  if (unitLower === 'paila') {
    return {
      key: 'PAILA',
      chipLabel: lpu > 0 ? `Pailas ${lpu}L` : 'Pailas',
      badgeLabel: `PAILA ${lpu > 0 ? `${lpu}L` : '19L'}`,
      shortUnit: 'pails',
      longUnit: 'Baldes físicos'
    };
  }
  if (unitLower === 'tambor') {
    return {
      key: 'TAMBOR',
      chipLabel: lpu > 0 ? `Tambores ${lpu}L` : 'Tambores',
      badgeLabel: `TAMBOR ${lpu > 0 ? `${lpu}L` : '208L'}`,
      shortUnit: 'tamb',
      longUnit: 'Tambores físicos'
    };
  }
  if (unitLower === 'totem') {
    return {
      key: 'TOTEM',
      chipLabel: 'Totems',
      badgeLabel: `TOTEM ${lpu > 0 ? `${lpu}L` : ''}`.trim(),
      shortUnit: 'tot',
      longUnit: 'Totems físicos'
    };
  }
  return {
    key: unit.toUpperCase(),
    chipLabel: unit,
    badgeLabel: unit.toUpperCase(),
    shortUnit: unitLower.slice(0, 4),
    longUnit: 'Unidades físicas'
  };
}

export default function MobileInventoryView({
  products = [],
  config,
  currentUser,
  onSyncProfit
}) {
  const notify = useNotification();
  const dailyRate = resolveDailyRate(config);

  const [query, setQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('TODOS');
  const [presentationFilter, setPresentationFilter] = useState('TODOS');
  const [syncing, setSyncing] = useState(false);

  const activeWarehouseMeta = useMemo(
    () => WAREHOUSE_FILTER_OPTIONS.find((opt) => opt.id === warehouseFilter) || WAREHOUSE_FILTER_OPTIONS[0],
    [warehouseFilter]
  );

  const normalizedRecords = useMemo(() => {
    const records = [];
    (Array.isArray(products) ? products : []).forEach((prod) => {
      if (!prod) return;
      const stocks = getProductWarehouseStocks(prod);
      const stock01 = Math.max(0, Number(stocks.stock01 || 0));
      const stock02 = Math.max(0, Number(stocks.stock02 || 0));
      const stockTotal = round2(stock01 + stock02);
      const unitName = resolveProductUnit(prod, 'Caja');
      const litersPerUnit = resolveProductLitersPerUnit(prod);
      const pres = buildPresentationMeta(unitName, litersPerUnit);

      records.push({
        prod,
        pid: String(prod.id || prod.codigo || prod.nombre || ''),
        sku: String(prod.codigo || prod.id || '').trim(),
        title: String(prod.nombre || prod.descripcion || 'Lubricante OILSTONE').trim(),
        subtitle: [
          prod.categoria || prod.linea || 'Lubricantes OILSTONE',
          prod.viscosidad || extractViscosityBadge(prod)
        ]
          .filter(Boolean)
          .join(' • '),
        unitName,
        litersPerUnit,
        pres,
        stock01,
        stock02,
        stockTotal,
        liters01: round2(stock01 * litersPerUnit),
        liters02: round2(stock02 * litersPerUnit),
        litersTotal: round2(stockTotal * litersPerUnit),
        minStock: Number(prod.stockMinimo ?? prod.stock_minimo ?? 10) || 10
      });
    });
    return records;
  }, [products]);

  const warehouseCounts = useMemo(
    () => ({
      TODOS: normalizedRecords.filter((item) => item.stockTotal > 0).length,
      '01': normalizedRecords.filter((item) => item.stock01 > 0).length,
      '02': normalizedRecords.filter((item) => item.stock02 > 0).length
    }),
    [normalizedRecords]
  );

  // BR-INV-001: Exclusión estricta de SKUs con stock <= 0 en el alcance de almacén seleccionado
  const { activeItems, hiddenZeroItems } = useMemo(
    () => partitionWarehouseItems(normalizedRecords, warehouseFilter),
    [normalizedRecords, warehouseFilter]
  );

  const handleSelectWarehouse = (nextWarehouse) => {
    setWarehouseFilter(nextWarehouse);
    if (presentationFilter !== 'TODOS') {
      const hasPresentationInNext = normalizedRecords.some((item) => {
        if (item.pres.key !== presentationFilter) return false;
        return resolveScopedWarehouseStock(item, nextWarehouse).stock > 0;
      });
      if (!hasPresentationInNext) {
        setPresentationFilter('TODOS');
      }
    }
  };

  // Chips por presentación exclusiva (BR-INV-002) sobre el almacén activo
  const presentationChips = useMemo(() => {
    const groups = new Map();
    activeItems.forEach((item) => {
      const existing = groups.get(item.pres.key) || {
        id: item.pres.key,
        label: item.pres.chipLabel,
        count: 0
      };
      existing.count += 1;
      groups.set(item.pres.key, existing);
    });

    return [
      { id: 'TODOS', label: 'Todos', count: activeItems.length },
      ...Array.from(groups.values()).sort((a, b) => b.count - a.count)
    ];
  }, [activeItems]);

  const filteredItems = useMemo(
    () => filterCatalogItems(activeItems, presentationFilter, query),
    [activeItems, presentationFilter, query]
  );

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalLiters = 0;
    filteredItems.forEach((item) => {
      totalUnits += item.scopedStock;
      totalLiters += item.scopedLiters;
    });
    return {
      totalUnits: round2(totalUnits),
      totalLiters: round2(totalLiters),
      activeSkus: filteredItems.length,
      hiddenZeroCount: hiddenZeroItems.length
    };
  }, [filteredItems, hiddenZeroItems.length]);

  const handleSync = async () => {
    if (!onSyncProfit || syncing) return;
    setSyncing(true);
    try {
      await onSyncProfit({ silent: false });
    } catch {
      // Manejado globalmente
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadOfficialPdf = (requestedWarehouse = warehouseFilter) => {
    const targetWarehouse = typeof requestedWarehouse === 'string' ? requestedWarehouse : warehouseFilter;
    const targetMeta =
      WAREHOUSE_FILTER_OPTIONS.find((opt) => opt.id === targetWarehouse) || activeWarehouseMeta;

    if (targetMeta.id !== warehouseFilter) {
      handleSelectWarehouse(targetMeta.id);
    }

    const { activeItems: scopedActive } =
      targetMeta.id === warehouseFilter
        ? { activeItems }
        : partitionWarehouseItems(normalizedRecords, targetMeta.id);

    if (scopedActive.length === 0) {
      notify.warning(`No hay artículos con stock activo (> 0) en ${targetMeta.label} para exportar.`);
      return;
    }

    try {
      const effectivePresFilter =
        presentationFilter !== 'TODOS' && scopedActive.some((item) => item.pres.key === presentationFilter)
          ? presentationFilter
          : 'TODOS';
      const scopedFiltered = filterCatalogItems(scopedActive, effectivePresFilter, query);
      const exportProducts = (effectivePresFilter === 'TODOS' && !query.trim() ? scopedActive : scopedFiltered).map(
        (item) => item.prod
      );
      if (exportProducts.length === 0) {
        notify.warning(`No hay artículos en ${targetMeta.label} con el filtro actual para exportar a PDF.`);
        return;
      }
      generateInventoryPDF({
        products: exportProducts,
        config: { ...(config || {}), tasaDolar: dailyRate },
        currentUser,
        warehouseName: targetMeta.pdfWarehouseName,
        warehouseId: targetMeta.pdfWarehouseId
      });
      notify.success(
        `PDF ${targetMeta.label} (${targetMeta.sublabel}) descargado con ${exportProducts.length} SKU(s) activos.`
      );
    } catch (err) {
      console.error('Error exportando PDF de inventario:', err);
      notify.error('No se pudo generar el Reporte PDF Oficial de Inventario.');
    }
  };

  const zeroExamples = useMemo(
    () =>
      hiddenZeroItems
        .slice(0, 2)
        .map((p) => String(p.nombre || p.descripcion || p.codigo || '').trim())
        .filter(Boolean)
        .join(', '),
    [hiddenZeroItems]
  );

  const companyHeader = config?.nombreEmpresa || 'SIGNUM MOTORVEN C.A.';
  const companyBrand = config?.marcaOficial || 'OILSTONE ® por KEYSTONE, C.A.';
  const companyRif = config?.rif || 'J-31115365-9';
  const responsibleName = currentUser?.nombre || currentUser?.username || 'Coordinador Almacén';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '0.5rem' }}>
      {/* 1. Cabecera del Módulo + Regla BR-INV-001 + Indicador En Vivo */}
      <div className="mobile-card" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.96rem', fontWeight: 800, color: 'var(--mob-navy)', lineHeight: 1.2 }}>
              INVENTARIO & STOCK CONSOLIDADO
            </div>
            <div style={{ fontSize: '0.70rem', color: 'var(--mob-text-muted)', marginTop: '3px' }}>
              {activeWarehouseMeta.headerSubtitle}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <span className="mobile-pill-badge success" style={{ fontSize: '0.58rem' }}>
              <Radio size={10} /> EN VIVO
            </span>
            {onSyncProfit && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="mobile-icon-btn"
                title="Actualizar inventario desde Supabase / ERP"
                aria-label="Actualizar inventario"
                style={{ width: '28px', height: '28px' }}
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Selector de Almacén (Todos / Alm 01 SENIAT / Alm 02 Bóveda) */}
        <div
          className="mobile-segmented-tabs"
          style={{ marginTop: '10px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          role="tablist"
          aria-label="Filtrar inventario por almacén"
        >
          {WAREHOUSE_FILTER_OPTIONS.map((opt) => {
            const isActive = warehouseFilter === opt.id;
            const skuCount = warehouseCounts[opt.id] || 0;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectWarehouse(opt.id)}
                className={`mobile-segmented-tab ${isActive ? 'active' : ''}`}
                style={{
                  flexDirection: 'column',
                  gap: '2px',
                  padding: '7px 6px',
                  border: isActive ? '1px solid var(--mob-navy)' : '1px solid transparent'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem' }}>
                  <Warehouse size={12} color={isActive ? 'var(--mob-navy)' : 'currentColor'} />
                  <span>{opt.label}</span>
                  <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.64rem', opacity: 0.85 }}>
                    ({skuCount})
                  </span>
                </span>
                <span style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--mob-text-muted)' }}>
                  {opt.sublabel}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: '9px',
            padding: '8px 10px',
            borderRadius: '11px',
            background: 'var(--mob-surface-low)',
            border: '1px solid var(--mob-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--mob-text-secondary)' }}>
            <Filter size={13} color="var(--mob-navy)" />
            <span>
              {warehouseFilter === 'TODOS'
                ? 'Filtro Automático: Existencias > 0 Activas'
                : `Mostrando stock > 0 en ${activeWarehouseMeta.label}`}
            </span>
          </div>
          <span className="mobile-pill-badge danger" style={{ fontSize: '0.56rem' }}>
            STOCK EN 0 OCULTO
          </span>
        </div>
      </div>

      {/* 2. KPI Strip 3 Columnas: Total Bultos / Volumen Planta / SKUs Activos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
        <div className="mobile-telemetry-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mobile-telemetry-label">Total Bultos</span>
            <Package size={13} color="var(--mob-navy)" />
          </div>
          <div className="mobile-telemetry-value" style={{ fontSize: '0.94rem', color: 'var(--mob-text)' }}>
            {formatUnitVe(summary.totalUnits, 0)}
          </div>
          <div className="mobile-telemetry-sub">{activeWarehouseMeta.kpiUnitSub}</div>
        </div>

        <div className="mobile-telemetry-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mobile-telemetry-label">Volumen</span>
            <Droplets size={13} color="var(--mob-cyan)" />
          </div>
          <div className="mobile-telemetry-value" style={{ fontSize: '0.90rem', color: 'var(--mob-navy)' }}>
            {formatUnitVe(summary.totalLiters, 0)} L
          </div>
          <div className="mobile-telemetry-sub">{activeWarehouseMeta.kpiVolSub}</div>
        </div>

        <div className="mobile-telemetry-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mobile-telemetry-label">SKUs Activos</span>
            <Boxes size={13} color="var(--mob-red)" />
          </div>
          <div className="mobile-telemetry-value" style={{ fontSize: '0.90rem', color: 'var(--mob-red)' }}>
            {summary.activeSkus} SKU
          </div>
          <div className="mobile-telemetry-sub">
            {warehouseFilter === 'TODOS'
              ? `${summary.hiddenZeroCount} cero ocultos`
              : `${summary.hiddenZeroCount} sin Alm ${warehouseFilter}`}
          </div>
        </div>
      </div>

      {/* 3. Buscador, Chips de Presentación y CTA Oficial PDF */}
      <div className="mobile-search-bar">
        <Search size={15} color="var(--mob-text-muted)" />
        <input
          className="mobile-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar 15W-40, 20W-50, SKU, presentación..."
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{ border: 'none', background: 'transparent', color: 'var(--mob-text-muted)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="mobile-chips-row">
        {presentationChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`mobile-chip ${presentationFilter === chip.id ? 'active' : ''}`}
            onClick={() => setPresentationFilter(chip.id)}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => handleDownloadOfficialPdf(warehouseFilter)}
        className="mobile-quick-action-btn primary"
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: '12px',
          fontFamily: 'var(--font-tech)',
          fontSize: '0.78rem',
          letterSpacing: '0.03em'
        }}
      >
        <FileDown size={16} /> {activeWarehouseMeta.ctaLabel}
      </button>

      {/* 4. Tarjetas Tripartitas Read-Only (Alm 01 + Alm 02 + Consolidado) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredItems.map((item) => (
          <div key={item.pid} className="mobile-card" style={{ padding: '12px' }}>
            {/* Top Pills Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-code)',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: 'var(--mob-navy-soft)',
                    color: 'var(--mob-navy)',
                    border: '1px solid var(--mob-border)'
                  }}
                >
                  SKU: {item.sku}
                </span>
                <span className="mobile-pill-badge info" style={{ fontSize: '0.58rem' }}>
                  {item.pres.badgeLabel}
                </span>
              </div>

              <span className={`mobile-pill-badge ${item.isLowStock ? 'warning' : 'success'}`}>
                {item.isLowStock ? 'STOCK MÍNIMO' : 'DISPONIBLE'}
              </span>
            </div>

            {/* Product Header (Thumbnail + Title) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '9px' }}>
              <OilstoneProductImage
                product={item.prod}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  objectFit: 'contain',
                  background: 'var(--mob-surface-low)',
                  padding: '4px',
                  border: '1px solid var(--mob-border)',
                  flexShrink: 0
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--mob-text)', lineHeight: 1.25 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
                  {item.subtitle}
                </div>
              </div>
            </div>

            {/* Matriz 2 Almacenes (Alm 01 SENIAT + Alm 02 Bóveda) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              {[
                { id: '01', label: 'ALM 01 (SENIAT)', stock: item.stock01, liters: item.liters01 },
                { id: '02', label: 'ALM 02 (BÓVEDA)', stock: item.stock02, liters: item.liters02 }
              ].map((whBox) => {
                const isSelectedWh = warehouseFilter === whBox.id;
                const isDimmed = warehouseFilter !== 'TODOS' && !isSelectedWh;
                return (
                  <div
                    key={whBox.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: isSelectedWh ? 'var(--mob-navy-soft)' : 'var(--mob-surface-low)',
                      border: isSelectedWh ? '1.5px solid var(--mob-navy)' : '1px solid var(--mob-border)',
                      opacity: isDimmed ? 0.45 : 1,
                      transition: 'opacity 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-tech)',
                        fontSize: '0.56rem',
                        fontWeight: 800,
                        color: isSelectedWh ? 'var(--mob-navy)' : 'var(--mob-text-muted)'
                      }}
                    >
                      {whBox.label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.92rem', fontWeight: 800, color: 'var(--mob-text)', marginTop: '2px' }}>
                      {formatUnitVe(whBox.stock, 0)} {item.pres.shortUnit}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--mob-text-muted)' }}>
                      {formatUnitVe(whBox.liters, 0)} Litros
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Franja Consolidado Total / Almacén Activo */}
            <div
              style={{
                marginTop: '8px',
                padding: '9px 11px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #001f5c 0%, #001238 100%)',
                border: '1px solid rgba(56, 189, 248, 0.32)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.62rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
                  {activeWarehouseMeta.footerLabel}
                </div>
                <div style={{ fontSize: '0.64rem', color: '#cbd5e1', marginTop: '2px' }}>
                  {warehouseFilter === 'TODOS'
                    ? `${formatUnitVe(item.scopedStock, 0)} ${item.pres.longUnit}`
                    : `${formatUnitVe(item.scopedStock, 0)} ${item.pres.longUnit} • Planta: ${formatUnitVe(item.stockTotal, 0)}`}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
                  {formatUnitVe(item.scopedStock, 0)} {item.pres.shortUnit}
                </div>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8' }}>
                  {formatUnitVe(item.scopedLiters, 0)} LITROS
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="mobile-card" style={{ padding: '24px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--mob-text-muted)' }}>
            No hay artículos con existencia física activa (&gt; 0) en {activeWarehouseMeta.label} para ese criterio de búsqueda.
          </div>
        )}
      </div>

      {/* 5. Nota de Auditoría de Existencias en Cero (BR-INV-001) */}
      {summary.hiddenZeroCount > 0 && (
        <div
          className="mobile-card"
          style={{
            padding: '10px 12px',
            background: 'var(--mob-surface-low)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '0.68rem',
            color: 'var(--mob-text-muted)'
          }}
        >
          <ShieldAlert size={15} color="var(--mob-red)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            <strong style={{ color: 'var(--mob-text)' }}>Auditoría de Existencias:</strong>{' '}
            {summary.hiddenZeroCount} SKU(s) sin existencia en{' '}
            {warehouseFilter === 'TODOS' ? 'Alm 01 ni Alm 02' : activeWarehouseMeta.label}
            {zeroExamples ? ` (ej. ${zeroExamples})` : ''} fueron excluidos automáticamente para agilizar la verificación física.
          </span>
        </div>
      )}

      {/* 6. Generador PDF Oficial con Membrete Corporativo Real (BR-INV-003) */}
      <div className="mobile-card" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-text)' }}>
              GENERADOR PDF OFICIAL
            </div>
            <div style={{ fontSize: '0.66rem', color: 'var(--mob-text-muted)' }}>
              Formato Carta con sellos y existencias &gt; 0
            </div>
          </div>
          <span className="mobile-pill-badge success">PREPARADO</span>
        </div>

        <div
          style={{
            marginTop: '9px',
            padding: '9px 10px',
            borderRadius: '10px',
            background: 'var(--mob-surface-low)',
            border: '1px solid var(--mob-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '0.68rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: 'var(--mob-text-muted)' }}>MEMBRETE:</span>
            <span style={{ fontWeight: 800, color: 'var(--mob-text)', textAlign: 'right' }}>{companyHeader}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: 'var(--mob-text-muted)' }}>MARCA:</span>
            <span style={{ fontWeight: 700, color: 'var(--mob-text-secondary)', textAlign: 'right' }}>{companyBrand}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: 'var(--mob-text-muted)' }}>RIF FISCAL:</span>
            <span style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--mob-text)' }}>{companyRif}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: 'var(--mob-text-muted)' }}>TASA BCV DÍA:</span>
            <span style={{ fontFamily: 'var(--font-code)', fontWeight: 800, color: 'var(--mob-navy)' }}>{formatBs(dailyRate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: 'var(--mob-text-muted)' }}>ALCANCE ACTIVO:</span>
            <span style={{ fontWeight: 800, color: 'var(--mob-navy)', textAlign: 'right' }}>
              {activeWarehouseMeta.label} ({activeWarehouseMeta.sublabel}) • {summary.activeSkus} SKU(s)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: 'var(--mob-text-muted)' }}>RESPONSABLE:</span>
            <span style={{ fontWeight: 700, color: 'var(--mob-text-secondary)' }}>{responsibleName}</span>
          </div>
        </div>

        {/* Selector rápido de alcance para descarga directa en Consolidado, Alm 01 o Alm 02 */}
        <div
          style={{
            marginTop: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '6px'
          }}
        >
          {WAREHOUSE_FILTER_OPTIONS.map((opt) => {
            const isSelected = warehouseFilter === opt.id;
            return (
              <button
                key={`pdf-${opt.id}`}
                type="button"
                onClick={() => handleDownloadOfficialPdf(opt.id)}
                className={`mobile-chip ${isSelected ? 'active' : ''}`}
                style={{
                  justifyContent: 'center',
                  padding: '7px 6px',
                  borderRadius: '10px',
                  fontSize: '0.67rem'
                }}
                title={`Descargar PDF ${opt.label} (${opt.sublabel})`}
              >
                <FileDown size={12} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => handleDownloadOfficialPdf(warehouseFilter)}
          style={{
            marginTop: '9px',
            width: '100%',
            padding: '11px 14px',
            borderRadius: '11px',
            border: 'none',
            background: 'linear-gradient(135deg, #001f5c 0%, #001238 100%)',
            color: '#ffffff',
            fontFamily: 'var(--font-tech)',
            fontSize: '0.74rem',
            fontWeight: 800,
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            cursor: 'pointer'
          }}
        >
          <FileDown size={15} /> {activeWarehouseMeta.ctaLabel}
        </button>
      </div>
    </div>
  );
}
