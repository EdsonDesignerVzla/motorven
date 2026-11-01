import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Droplet,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Sliders,
  Users,
  ShoppingCart,
  Calendar,
  AlertCircle,
  Building2,
  Tag,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  PieChart,
  BarChart2,
  Award,
  CheckCircle2,
  FileSpreadsheet,
  Zap,
  Info
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import SkuProfitabilityModal from '../components/SkuProfitabilityModal';
import OperationalPandLModal from '../components/OperationalPandLModal';
import MotorvenLogo from '../components/MotorvenLogo';
import { generateProfitabilityPDF } from '../services/pdfReportService';

export default function ProfitabilityView({
  products = [],
  profitInvoices = [],
  profitPurchases = [],
  profitSellers = [],
  profitTransports = [],
  profitZones = [],
  profitReturns = [],
  profitInventoryAdjustments = [],
  profitIslrWithholdings = [],
  cashMovements = [],
  clients = [],
  config,
  onSyncProfit,
  currentUser
}) {
  const [activeSubTab, setActiveSubTab] = useState('sku'); // 'sku' | 'lines' | 'abc' | 'reports'
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('utilidad_desc'); // 'utilidad_desc' | 'margen_desc' | 'ventas_desc' | 'stock_desc'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPandLModal, setShowPandLModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeReportType, setActiveReportType] = useState('rentabilidad'); // 'rentabilidad' | 'inventario' | 'abc'

  const tasa = config?.tasaDolar || 827.73;

  const handleSync = async () => {
    if (onSyncProfit) {
      setSyncing(true);
      await onSyncProfit();
      setTimeout(() => setSyncing(false), 800);
    }
  };

  // Cálculo de ventas y CMV acumulado por SKU a partir de facturas reales de Profit
  const productAnalytics = useMemo(() => {
    // Mapa de acumuladores por código de producto
    const salesMap = {};

    profitInvoices.forEach((fac) => {
      if (fac.anulado) return;
      const items = Array.isArray(fac.items) ? fac.items : [];
      items.forEach((item) => {
        const itemCode = (item.articuloId || item.codigo || '').trim();
        if (!itemCode) return;
        if (!salesMap[itemCode]) {
          salesMap[itemCode] = {
            unidadesVendidas: 0,
            litrosVendidos: 0,
            facturadoBs: 0,
            facturadoUsd: 0,
            facturasCount: 0
          };
        }
        const cant = Number(item.cantidad || 0);
        const lts = Number(item.litrosTotales || (cant * (item.litrosUnitarios || 12)));
        const netoBs = Number(item.totalNeto || 0);
        const netoUsd = fac.tasa && fac.tasa > 0 ? netoBs / fac.tasa : (fac.totNetoUsd || 0);

        salesMap[itemCode].unidadesVendidas += cant;
        salesMap[itemCode].litrosVendidos += lts;
        salesMap[itemCode].facturadoBs += netoBs;
        salesMap[itemCode].facturadoUsd += netoUsd;
        salesMap[itemCode].facturasCount += 1;
      });
    });

    // Enriquecer el catálogo de productos con rentabilidad
    return products.map((p) => {
      const code = (p.codigo || p.id || '').trim();
      const sData = salesMap[code] || {
        unidadesVendidas: 0,
        litrosVendidos: 0,
        facturadoBs: 0,
        facturadoUsd: 0,
        facturasCount: 0
      };

      const costoUsd = Number(p.costoUsd || p.costo_usd || 0);
      const precioA = Number(p.precioA || p.precio_a || 0);
      const precioB = Number(p.precioB || p.precio_b || 0);
      const precioC = Number(p.precioC || p.precio_c || 0);
      const stock = Number(p.stock || 0);
      const litrosPorUnidad = Number(p.litrosPorUnidad || p.litros_por_unidad || 12);

      // Margen unitario Lista A
      const margenUnitarioUsd = precioA - costoUsd;
      const margenUnitarioPct = precioA > 0 ? (margenUnitarioUsd / precioA) * 100 : 0;

      // Costo de Mercancía Vendida (CMV / COGS)
      const cmvUsd = sData.unidadesVendidas * costoUsd;
      // Utilidad Bruta Real
      const utilidadBrutaUsd = sData.facturadoUsd - cmvUsd;
      const margenRealPct = sData.facturadoUsd > 0 ? (utilidadBrutaUsd / sData.facturadoUsd) * 100 : margenUnitarioPct;

      // Valorización de inventario actual
      const inventarioCostoUsd = stock * costoUsd;
      const inventarioVentaUsd = stock * precioA;
      const inventarioUtilidadPotencialUsd = inventarioVentaUsd - inventarioCostoUsd;

      return {
        ...p,
        costoUsd,
        precioA,
        precioB,
        precioC,
        stock,
        litrosPorUnidad,
        margenUnitarioUsd,
        margenUnitarioPct,
        unidadesVendidas: sData.unidadesVendidas,
        litrosVendidos: sData.litrosVendidos,
        facturadoUsd: sData.facturadoUsd,
        facturadoBs: sData.facturadoBs,
        cmvUsd,
        utilidadBrutaUsd,
        margenRealPct,
        inventarioCostoUsd,
        inventarioVentaUsd,
        inventarioUtilidadPotencialUsd
      };
    });
  }, [products, profitInvoices]);

  // Clasificación Pareto ABC acumulativa
  const abcAnalysis = useMemo(() => {
    // Ordenar productos por facturación descendente
    const sorted = [...productAnalytics].sort((a, b) => b.facturadoUsd - a.facturadoUsd);
    const totalFacturacionGlobal = sorted.reduce((acc, p) => acc + p.facturadoUsd, 0) || 1;
    const totalUtilidadGlobal = sorted.reduce((acc, p) => acc + (p.utilidadBrutaUsd > 0 ? p.utilidadBrutaUsd : 0), 0) || 1;

    let acumuladoVenta = 0;
    let acumuladoUtilidad = 0;

    const classified = sorted.map((p) => {
      acumuladoVenta += p.facturadoUsd;
      acumuladoUtilidad += (p.utilidadBrutaUsd > 0 ? p.utilidadBrutaUsd : 0);

      const pctAcumVenta = (acumuladoVenta / totalFacturacionGlobal) * 100;
      const pctAcumUtilidad = (acumuladoUtilidad / totalUtilidadGlobal) * 100;

      let clase = 'C';
      let claseBadge = 'bg-danger';
      if (pctAcumVenta <= 80 || pctAcumUtilidad <= 80) {
        clase = 'A';
        claseBadge = 'bg-success';
      } else if (pctAcumVenta <= 95 || pctAcumUtilidad <= 95) {
        clase = 'B';
        claseBadge = 'bg-warning';
      }

      // Rotación estimada (Días de cobertura de inventario)
      // Tasa diaria de venta
      const ventaDiaria = p.unidadesVendidas / 90; // promedio 90 días
      const diasCobertura = ventaDiaria > 0 ? Math.round(p.stock / ventaDiaria) : (p.stock > 0 ? 999 : 0);

      return {
        ...p,
        clase,
        pctAcumVenta,
        pctAcumUtilidad,
        diasCobertura
      };
    });

    const claseA = classified.filter(p => p.clase === 'A');
    const claseB = classified.filter(p => p.clase === 'B');
    const claseC = classified.filter(p => p.clase === 'C');

    return {
      all: classified,
      claseA,
      claseB,
      claseC,
      totalFacturacionGlobal,
      totalUtilidadGlobal
    };
  }, [productAnalytics]);

  // Análisis agrupado por Líneas / Categorías
  const linesAnalysis = useMemo(() => {
    const linesMap = {};

    productAnalytics.forEach((p) => {
      const cat = p.categoria || 'Otros Lubricantes';
      if (!linesMap[cat]) {
        linesMap[cat] = {
          categoria: cat,
          skusCount: 0,
          totalStock: 0,
          totalLitrosStock: 0,
          unidadesVendidas: 0,
          litrosVendidos: 0,
          facturadoUsd: 0,
          cmvUsd: 0,
          utilidadBrutaUsd: 0
        };
      }
      linesMap[cat].skusCount += 1;
      linesMap[cat].totalStock += p.stock;
      linesMap[cat].totalLitrosStock += (p.stock * p.litrosPorUnidad);
      linesMap[cat].unidadesVendidas += p.unidadesVendidas;
      linesMap[cat].litrosVendidos += p.litrosVendidos;
      linesMap[cat].facturadoUsd += p.facturadoUsd;
      linesMap[cat].cmvUsd += p.cmvUsd;
      linesMap[cat].utilidadBrutaUsd += p.utilidadBrutaUsd;
    });

    const totalVentasLineas = Object.values(linesMap).reduce((acc, l) => acc + l.facturadoUsd, 0) || 1;

    return Object.values(linesMap).map((line) => {
      const margenPonderado = line.facturadoUsd > 0 ? (line.utilidadBrutaUsd / line.facturadoUsd) * 100 : 0;
      const sharePct = (line.facturadoUsd / totalVentasLineas) * 100;
      return {
        ...line,
        margenPonderado,
        sharePct
      };
    }).sort((a, b) => b.facturadoUsd - a.facturadoUsd);
  }, [productAnalytics]);

  // Filtros de búsqueda y orden
  const filteredProducts = useMemo(() => {
    let list = [...abcAnalysis.all];

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(p =>
        (p.codigo || '').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.viscosidad || '').toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'ALL') {
      list = list.filter(p => (p.categoria || '').toUpperCase() === categoryFilter.toUpperCase());
    }

    list.sort((a, b) => {
      if (sortBy === 'utilidad_desc') return b.utilidadBrutaUsd - a.utilidadBrutaUsd;
      if (sortBy === 'margen_desc') return b.margenUnitarioPct - a.margenUnitarioPct;
      if (sortBy === 'ventas_desc') return b.facturadoUsd - a.facturadoUsd;
      if (sortBy === 'stock_desc') return b.stock - a.stock;
      return 0;
    });

    return list;
  }, [abcAnalysis.all, searchFilter, categoryFilter, sortBy]);

  // Totales Generales Portafolio
  const totalValorCosto = productAnalytics.reduce((acc, p) => acc + p.inventarioCostoUsd, 0);
  const totalValorVenta = productAnalytics.reduce((acc, p) => acc + p.inventarioVentaUsd, 0);
  const totalUtilidadPotencial = totalValorVenta - totalValorCosto;
  const margenPotencialGlobal = totalValorVenta > 0 ? (totalUtilidadPotencial / totalValorVenta) * 100 : 0;
  const totalFacturadoHistorico = productAnalytics.reduce((acc, p) => acc + p.facturadoUsd, 0);
  const totalUtilidadHistorica = productAnalytics.reduce((acc, p) => acc + p.utilidadBrutaUsd, 0);
  const totalLitrosHistoricos = productAnalytics.reduce((acc, p) => acc + p.litrosVendidos, 0);

  // Exportar a CSV
  const handleExportCsv = (type) => {
    let rows = [];
    let filename = 'reporte_rentabilidad_motorven.csv';

    if (type === 'rentabilidad') {
      filename = `reporte_rentabilidad_skus_${new Date().toISOString().slice(0, 10)}.csv`;
      rows.push(['Codigo', 'Descripcion', 'Categoria', 'Viscosidad', 'Stock Actual', 'Costo USD', 'Precio A USD', 'Margen Unit USD', 'Margen Unit %', 'Unidades Vendidas', 'Facturado USD', 'CMV USD', 'Utilidad Bruta USD', 'Margen Real %']);
      filteredProducts.forEach(p => {
        rows.push([
          `"${p.codigo}"`,
          `"${p.descripcion}"`,
          `"${p.categoria}"`,
          `"${p.viscosidad}"`,
          p.stock,
          p.costoUsd.toFixed(2),
          p.precioA.toFixed(2),
          p.margenUnitarioUsd.toFixed(2),
          p.margenUnitarioPct.toFixed(1) + '%',
          p.unidadesVendidas,
          p.facturadoUsd.toFixed(2),
          p.cmvUsd.toFixed(2),
          p.utilidadBrutaUsd.toFixed(2),
          p.margenRealPct.toFixed(1) + '%'
        ]);
      });
    } else if (type === 'inventario') {
      filename = `reporte_inventario_valorizado_${new Date().toISOString().slice(0, 10)}.csv`;
      rows.push(['Codigo', 'Descripcion', 'Categoria', 'Stock Unidades', 'Litros Totales', 'Costo Unit USD', 'Valor al Costo USD', 'Precio Venta USD', 'Valor a Venta USD', 'Utilidad Potencial USD', 'Margen %']);
      filteredProducts.forEach(p => {
        rows.push([
          `"${p.codigo}"`,
          `"${p.descripcion}"`,
          `"${p.categoria}"`,
          p.stock,
          (p.stock * p.litrosPorUnidad).toFixed(1),
          p.costoUsd.toFixed(2),
          p.inventarioCostoUsd.toFixed(2),
          p.precioA.toFixed(2),
          p.inventarioVentaUsd.toFixed(2),
          p.inventarioUtilidadPotencialUsd.toFixed(2),
          p.margenUnitarioPct.toFixed(1) + '%'
        ]);
      });
    } else if (type === 'abc') {
      filename = `reporte_clasificacion_abc_${new Date().toISOString().slice(0, 10)}.csv`;
      rows.push(['Clase ABC', 'Codigo', 'Descripcion', 'Categoria', 'Facturacion USD', '% Acum Venta', 'Utilidad USD', '% Acum Utilidad', 'Stock Actual', 'Dias Cobertura']);
      abcAnalysis.all.forEach(p => {
        rows.push([
          p.clase,
          `"${p.codigo}"`,
          `"${p.descripcion}"`,
          `"${p.categoria}"`,
          p.facturadoUsd.toFixed(2),
          p.pctAcumVenta.toFixed(1) + '%',
          p.utilidadBrutaUsd.toFixed(2),
          p.pctAcumUtilidad.toFixed(1) + '%',
          p.stock,
          p.diasCobertura
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    generateProfitabilityPDF({
      products: filteredProducts,
      sales: profitInvoices,
      purchases: profitPurchases,
      config,
      currentUser
    });
  };

  const categoriesList = ['ALL', 'Gasolina', 'Diésel', 'Transmisión', 'Industrial', 'Hidráulico', 'Grasas', 'Frenos'];

  return (
    <div className="view-container">
      {/* Top Banner Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Rentabilidad, Margen de Contribución & BI
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Análisis Financiero por SKU, Clasificación Pareto ABC y Reportes Ejecutivos
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowPandLModal(true)}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(0, 43, 122, 0.25))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontWeight: 700
            }}
          >
            <TrendingUp size={16} color="var(--semaforo-verde)" />
            <span>P&L Operativo en Tiempo Real</span>
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={syncing ? 'spinning' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Recargar'}</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="btn btn-print-report"
            style={{ marginLeft: 'auto' }}
            title="Descargar Reporte Oficial de Rentabilidad y Márgenes en PDF"
          >
            <Printer size={15} color="#ffffff" />
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      {/* Global Financial KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>INVENTARIO AL COSTO</span>
            <DollarSign size={15} color="#64748b" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {formatUsd(totalValorCosto)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatBs(totalValorCosto * tasa)}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>VALORIZACIÓN VENTA (A)</span>
            <Package size={15} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>
            {formatUsd(totalValorVenta)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatBs(totalValorVenta * tasa)}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>MARGEN GLOBAL POTENCIAL</span>
            <Percent size={15} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            {margenPotencialGlobal.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
            +{formatUsd(totalUtilidadPotencial)} en Stock
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>UTILIDAD HISTÓRICA REAL</span>
            <TrendingUp size={15} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.25rem' }}>
            {formatUsd(totalUtilidadHistorica)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Sobre {formatUsd(totalFacturadoHistorico)} facturados
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveSubTab('sku')}
          className={`btn ${activeSubTab === 'sku' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <Layers size={15} />
          <span>Matriz Rentabilidad SKU ({productAnalytics.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('lines')}
          className={`btn ${activeSubTab === 'lines' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <PieChart size={15} />
          <span>Líneas & Familias ({linesAnalysis.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('abc')}
          className={`btn ${activeSubTab === 'abc' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <Award size={15} />
          <span>Clasificación ABC (Pareto 80/20)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('reports')}
          className={`btn ${activeSubTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <FileSpreadsheet size={15} />
          <span>Reportes Ejecutivos & Exportación</span>
        </button>
      </div>

      {/* SUB-TAB 1: MATRIZ DE RENTABILIDAD POR SKU */}
      {activeSubTab === 'sku' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div className="search-wrapper" style={{ minWidth: '240px', flex: 1 }}>
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Buscar por código, descripción o viscosidad..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field filter-select"
                style={{ width: 'auto', minWidth: '190px', height: '38px', fontSize: '0.85rem' }}
              >
                {categoriesList.map(c => (
                  <option key={c} value={c}>{c === 'ALL' ? 'Todas las Categorías' : c}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input-field filter-select"
                style={{ width: 'auto', minWidth: '210px', height: '38px', fontSize: '0.85rem' }}
              >
                <option value="utilidad_desc">Mayor Utilidad Bruta ($)</option>
                <option value="margen_desc">Mayor Margen Unitario (%)</option>
                <option value="ventas_desc">Mayor Facturación ($)</option>
                <option value="stock_desc">Mayor Existencia Stock</option>
              </select>
            </div>

            <button
              onClick={() => handleExportCsv('rentabilidad')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>
          </div>

          {/* SKUs Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Código & Producto</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Stock</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Costo USD</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Precio (A)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Margen Unitario</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ventas</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Utilidad Real</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No se encontraron productos con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isHighMargin = p.margenUnitarioPct >= 25;
                      const isMedMargin = p.margenUnitarioPct >= 15 && p.margenUnitarioPct < 25;

                      return (
                        <tr
                          key={p.id || p.codigo}
                          style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.2s' }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                background: 'var(--bg-glass-accent)',
                                color: 'var(--accent-primary)',
                                border: '1px solid var(--border-glass)'
                              }}>
                                {p.codigo}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                background: p.clase === 'A' ? 'rgba(16, 185, 129, 0.2)' : p.clase === 'B' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                                color: p.clase === 'A' ? '#10b981' : p.clase === 'B' ? '#f59e0b' : '#94a3b8',
                                border: '1px solid var(--border-glass)'
                              }}>
                                ABC: {p.clase}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                              {p.descripcion}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {p.categoria} • {p.viscosidad}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: p.stock > 0 ? 'var(--text-primary)' : '#ef4444' }}>
                              {p.stock} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>cajas</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {(p.stock * p.litrosPorUnidad).toFixed(0)} L
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatUsd(p.costoUsd)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {formatBs(p.costoUsd * tasa)}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#3b82f6' }}>
                              {formatUsd(p.precioA)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {formatBs(p.precioA * tasa)}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{
                              fontWeight: 800,
                              color: isHighMargin ? '#10b981' : isMedMargin ? '#f59e0b' : '#ef4444'
                            }}>
                              {formatUsd(p.margenUnitarioUsd)}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: isHighMargin ? '#10b981' : isMedMargin ? '#f59e0b' : '#ef4444'
                            }}>
                              {p.margenUnitarioPct.toFixed(1)}%
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatUsd(p.facturadoUsd)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {p.unidadesVendidas} unid ({p.litrosVendidos.toFixed(0)} L)
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{
                              fontWeight: 800,
                              color: p.utilidadBrutaUsd >= 0 ? '#10b981' : '#ef4444'
                            }}>
                              {formatUsd(p.utilidadBrutaUsd)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              CMV: {formatUsd(p.cmvUsd)}
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                            >
                              <Zap size={13} color="#10b981" />
                              <span>Analizar 360°</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ANÁLISIS POR LÍNEAS & FAMILIAS */}
      {activeSubTab === 'lines' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {linesAnalysis.map((line, idx) => (
              <div key={idx} className="card" style={{ padding: '1.15rem', margin: 0, background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {line.categoria}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {line.skusCount} referencias • {line.totalStock} cajas en stock ({line.totalLitrosStock.toFixed(0)} L)
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}>
                    {line.sharePct.toFixed(1)}% Ventas
                  </span>
                </div>

                {/* Progress bar of share */}
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-glass-accent)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.85rem' }}>
                  <div style={{ width: `${Math.min(line.sharePct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)', borderRadius: '3px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', fontSize: '0.82rem' }}>
                  <div style={{ background: 'var(--bg-glass-accent)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>FACTURACIÓN</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{formatUsd(line.facturadoUsd)}</div>
                  </div>

                  <div style={{ background: 'var(--bg-glass-accent)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>MARGEN PONDERADO</div>
                    <div style={{ fontWeight: 800, color: line.margenPonderado >= 20 ? '#10b981' : '#f59e0b' }}>
                      {line.margenPonderado.toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-glass-accent)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>UTILIDAD TOTAL</div>
                    <div style={{ fontWeight: 800, color: '#10b981' }}>{formatUsd(line.utilidadBrutaUsd)}</div>
                  </div>

                  <div style={{ background: 'var(--bg-glass-accent)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>VOLUMEN COLOCADO</div>
                    <div style={{ fontWeight: 800, color: '#3b82f6' }}>{line.litrosVendidos.toFixed(0)} L</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CLASIFICACIÓN ABC (PARETO 80/20) */}
      {activeSubTab === 'abc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* ABC Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#10b981' }}>CLASE A (Core 80%)</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '6px' }}>
                  {abcAnalysis.claseA.length} SKUs
                </span>
              </div>
              <p style={{ margin: '0.35rem 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Generan el 80% de la facturación y rentabilidad de la empresa. Productos de alta rotación que nunca deben quedar sin stock.
              </p>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Ventas: {formatUsd(abcAnalysis.claseA.reduce((acc, p) => acc + p.facturadoUsd, 0))}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f59e0b' }}>CLASE B (Medio 15%)</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '6px' }}>
                  {abcAnalysis.claseB.length} SKUs
                </span>
              </div>
              <p style={{ margin: '0.35rem 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Aportan el siguiente 15% del volumen comercial. Demanda intermedia y margen constante.
              </p>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Ventas: {formatUsd(abcAnalysis.claseB.reduce((acc, p) => acc + p.facturadoUsd, 0))}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', borderLeft: '4px solid #94a3b8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#94a3b8' }}>CLASE C (Resto 5%)</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', borderRadius: '6px' }}>
                  {abcAnalysis.claseC.length} SKUs
                </span>
              </div>
              <p style={{ margin: '0.35rem 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Último 5% de ventas o artículos con stock inmovilizado. Requieren promociones o liquidación.
              </p>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Ventas: {formatUsd(abcAnalysis.claseC.reduce((acc, p) => acc + p.facturadoUsd, 0))}
              </div>
            </div>
          </div>

          {/* Pareto Ranking Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Matriz de Segmentación ABC & Rotación de Inventario
              </span>
              <button
                onClick={() => handleExportCsv('abc')}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
              >
                <Download size={13} />
                <span>Exportar Matriz ABC</span>
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Clase</th>
                    <th style={{ padding: '0.75rem' }}>Código & Descripción</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Facturación ($)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>% Acum. Ventas</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Utilidad ($)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Stock Actual</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Días Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {abcAnalysis.all.map((p) => (
                    <tr key={p.codigo} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: p.clase === 'A' ? 'rgba(16, 185, 129, 0.2)' : p.clase === 'B' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                          color: p.clase === 'A' ? '#10b981' : p.clase === 'B' ? '#f59e0b' : '#94a3b8'
                        }}>
                          {p.clase}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.descripcion}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.codigo} • {p.categoria}</div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatUsd(p.facturadoUsd)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                        {p.pctAcumVenta.toFixed(1)}%
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                        {formatUsd(p.utilidadBrutaUsd)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                        {p.stock} cajas
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: p.diasCobertura <= 30 ? 'rgba(239, 68, 68, 0.15)' : p.diasCobertura <= 90 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: p.diasCobertura <= 30 ? '#ef4444' : p.diasCobertura <= 90 ? '#10b981' : '#64748b'
                        }}>
                          {p.diasCobertura > 365 ? '>1 año' : `${p.diasCobertura} días`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: REPORTES EJECUTIVOS & EXPORTACIÓN */}
      {activeSubTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Report Selector Header */}
          <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveReportType('rentabilidad')}
                className={`btn ${activeReportType === 'rentabilidad' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                1. Rentabilidad Operativa
              </button>
              <button
                onClick={() => setActiveReportType('inventario')}
                className={`btn ${activeReportType === 'inventario' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                2. Inventario Valorizado
              </button>
              <button
                onClick={() => setActiveReportType('abc')}
                className={`btn ${activeReportType === 'abc' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                3. Clasificación ABC Pareto
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleExportCsv(activeReportType)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Download size={14} />
                <span>Exportar CSV / Excel</span>
              </button>
              <button
                onClick={handlePrintReport}
                className="btn btn-print-report btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Descargar Reporte Oficial de Rentabilidad en PDF"
              >
                <Printer size={14} color="#ffffff" />
                <span>Imprimir Reporte</span>
              </button>
            </div>
          </div>

          {/* Printable Official Report Preview */}
          <div className="card print-area" style={{ padding: '2rem', margin: 0, background: 'var(--bg-surface)' }}>
            {/* Report Official Letterhead */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-glass)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <MotorvenLogo width={180} height="auto" />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  DISTRIBUIDOR OFICIAL DE LUBRICANTES • RIF: J-50478166-0
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {activeReportType === 'rentabilidad' && 'INFORME GERENCIAL DE RENTABILIDAD & MARGEN DE CONTRIBUCIÓN'}
                  {activeReportType === 'inventario' && 'INFORME DE INVENTARIO VALORIZADO AL COSTO Y PRECIO DE VENTA'}
                  {activeReportType === 'abc' && 'ANÁLISIS ESTRATÉGICO DE ROTACIÓN & MATRIZ PARETO ABC (80/20)'}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Fecha de Emisión: {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tasa Oficial BCV: Bs. {tasa.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Report Content Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-primary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>CÓDIGO</th>
                    <th style={{ padding: '0.5rem' }}>DESCRIPCIÓN DE LUBRICANTE</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>STOCK</th>
                    {activeReportType === 'rentabilidad' && (
                      <>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>COSTO $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>PRECIO $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>MARGEN %</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>FACTURADO $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>UTILIDAD $</th>
                      </>
                    )}
                    {activeReportType === 'inventario' && (
                      <>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>COSTO UNIT $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>TOTAL COSTO $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>PRECIO LISTA $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>VALOR VENTA $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>UTILIDAD POTENCIAL $</th>
                      </>
                    )}
                    {activeReportType === 'abc' && (
                      <>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>CLASE</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>VENTAS $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>% ACUM</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>UTILIDAD $</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>COBERTURA</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '0.45rem', fontWeight: 700 }}>{p.codigo}</td>
                      <td style={{ padding: '0.45rem' }}>{p.descripcion}</td>
                      <td style={{ padding: '0.45rem', textAlign: 'center' }}>{p.stock}</td>
                      {activeReportType === 'rentabilidad' && (
                        <>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.costoUsd)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.precioA)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700, color: p.margenUnitarioPct >= 20 ? '#10b981' : '#f59e0b' }}>
                            {p.margenUnitarioPct.toFixed(1)}%
                          </td>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.facturadoUsd)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatUsd(p.utilidadBrutaUsd)}</td>
                        </>
                      )}
                      {activeReportType === 'inventario' && (
                        <>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.costoUsd)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.inventarioCostoUsd)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.precioA)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.inventarioVentaUsd)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatUsd(p.inventarioUtilidadPotencialUsd)}</td>
                        </>
                      )}
                      {activeReportType === 'abc' && (
                        <>
                          <td style={{ padding: '0.45rem', textAlign: 'center', fontWeight: 800 }}>{p.clase}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatUsd(p.facturadoUsd)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700 }}>{p.pctAcumVenta.toFixed(1)}%</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatUsd(p.utilidadBrutaUsd)}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'center' }}>{p.diasCobertura} d</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-glass)', fontWeight: 800, background: 'var(--bg-glass-accent)' }}>
                    <td colSpan={2} style={{ padding: '0.6rem' }}>TOTALES CONSOLIDADOS ({filteredProducts.length} Ítems)</td>
                    <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                      {filteredProducts.reduce((acc, p) => acc + p.stock, 0)}
                    </td>
                    {activeReportType === 'rentabilidad' && (
                      <>
                        <td colSpan={3} style={{ padding: '0.6rem', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right' }}>{formatUsd(filteredProducts.reduce((acc, p) => acc + p.facturadoUsd, 0))}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right', color: '#10b981' }}>{formatUsd(filteredProducts.reduce((acc, p) => acc + p.utilidadBrutaUsd, 0))}</td>
                      </>
                    )}
                    {activeReportType === 'inventario' && (
                      <>
                        <td style={{ padding: '0.6rem', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right' }}>{formatUsd(filteredProducts.reduce((acc, p) => acc + p.inventarioCostoUsd, 0))}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right' }}>-</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right' }}>{formatUsd(filteredProducts.reduce((acc, p) => acc + p.inventarioVentaUsd, 0))}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right', color: '#10b981' }}>{formatUsd(filteredProducts.reduce((acc, p) => acc + p.inventarioUtilidadPotencialUsd, 0))}</td>
                      </>
                    )}
                    {activeReportType === 'abc' && (
                      <>
                        <td style={{ padding: '0.6rem', textAlign: 'center' }}>-</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right' }}>{formatUsd(filteredProducts.reduce((acc, p) => acc + p.facturadoUsd, 0))}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right' }}>100.0%</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right', color: '#10b981' }}>{formatUsd(filteredProducts.reduce((acc, p) => acc + p.utilidadBrutaUsd, 0))}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'center' }}>-</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signatures */}
            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ width: '180px', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.35rem' }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Gerencia General</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SIGNUM MOTORVEN</div>
              </div>
              <div>
                <div style={{ width: '180px', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.35rem' }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Administración & Finanzas</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Control de Gestión</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sku Profitability Modal */}
      {selectedProduct && (
        <SkuProfitabilityModal
          product={selectedProduct}
          profitInvoices={profitInvoices}
          profitPurchases={profitPurchases}
          clients={clients}
          config={config}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Operational P&L & Net Profitability Modal */}
      <OperationalPandLModal
        isOpen={showPandLModal}
        onClose={() => setShowPandLModal(false)}
        products={products}
        profitInvoices={profitInvoices}
        profitPurchases={profitPurchases}
        profitSellers={profitSellers}
        profitTransports={profitTransports}
        profitZones={profitZones}
        profitReturns={profitReturns}
        profitInventoryAdjustments={profitInventoryAdjustments}
        profitIslrWithholdings={profitIslrWithholdings}
        cashMovements={cashMovements}
        config={config}
        currentUser={currentUser}
        tasaBcv={tasa}
      />
    </div>
  );
}
