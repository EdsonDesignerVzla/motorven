import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  Truck,
  Users,
  ShieldCheck,
  AlertTriangle,
  Package,
  Droplet,
  PieChart,
  BarChart2,
  Sliders,
  Download,
  Printer,
  X,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  RefreshCw
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateProfitabilityPDF } from '../services/pdfReportService';

export default function OperationalPandLModal({
  isOpen,
  onClose,
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
  config = {},
  currentUser = null,
  tasaBcv: propTasaBcv
}) {
  const tasaBcv = Number(propTasaBcv || config?.tasaDolar || 827.73);
  
  // Parámetros del Simulador What-If
  const [priceAdjustmentPct, setPriceAdjustmentPct] = useState(0); // -15% a +15%
  const [cogsAdjustmentPct, setCogsAdjustmentPct] = useState(0); // -15% a +15%
  const [freightPerLiterUsd, setFreightPerLiterUsd] = useState(0.08); // $0.08 USD por litro base
  const [avgCommissionPct, setAvgCommissionPct] = useState(3.0); // 3% comisión promedio vendedores
  const [activeTab, setActiveTab] = useState('waterfall'); // 'waterfall' | 'lines_pnl' | 'simulator' | 'print'

  // =========================================================================
  // 1. MOTOR FINANCIERO DE P&L Y CASCADA DE RESULTADOS
  // =========================================================================
  const financialData = useMemo(() => {
    // A. Ventas e Ingresos Brutos
    let baseFacturadoUsd = 0;
    let baseFacturadoBs = 0;
    let baseLitrosVendidos = 0;
    let baseCajasVendidas = 0;
    let baseCmvUsd = 0;

    // Mapeo por Líneas de Aceite
    const linesBreakdown = {
      'Gasolina': { nombre: 'Gasolina Mineral / Sintético', litros: 0, cajas: 0, ventaUsd: 0, cmvUsd: 0, skus: 0 },
      'Semisintético R500': { nombre: 'Semisintético R500', litros: 0, cajas: 0, ventaUsd: 0, cmvUsd: 0, skus: 0 },
      'Diesel 4T': { nombre: 'Diésel Pesado (CI-4 / CH-4)', litros: 0, cajas: 0, ventaUsd: 0, cmvUsd: 0, skus: 0 },
      'Motos 2T/4T': { nombre: 'Motos 2T / 4T Racing', litros: 0, cajas: 0, ventaUsd: 0, cmvUsd: 0, skus: 0 },
      'Transmisiones & ATF': { nombre: 'Transmisión & ATF', litros: 0, cajas: 0, ventaUsd: 0, cmvUsd: 0, skus: 0 },
      'Hidráulicos AW68': { nombre: 'Hidráulicos Industriales AW', litros: 0, cajas: 0, ventaUsd: 0, cmvUsd: 0, skus: 0 },
      'Fuera de Borda': { nombre: 'Fuera de Borda TC-W3', litros: 0, cajas: 0, ventaUsd: 0, cmvUsd: 0, skus: 0 }
    };

    // Indexar costos de productos
    const productCostMap = {};
    const productCategoryMap = {};
    products.forEach(p => {
      const code = (p.codigo || p.id || '').trim().toUpperCase();
      productCostMap[code] = Number(p.costoUsd || 28.0);
      productCategoryMap[code] = p.categoria || 'Gasolina';
    });

    // Procesar facturas de Profit Plus
    const activeInvoices = profitInvoices.filter(f => !f.anulado);

    activeInvoices.forEach(inv => {
      const vUsd = Number(inv.totNetoUsd || 0);
      const vBs = Number(inv.totNetoBs || (vUsd * tasaBcv));
      const lts = Number(inv.totalLitros || 0);
      const caj = Number(inv.totalCajas || 0);

      baseFacturadoUsd += vUsd;
      baseFacturadoBs += vBs;
      baseLitrosVendidos += lts;
      baseCajasVendidas += caj;

      // Estimación CMV por factura
      const items = Array.isArray(inv.items) ? inv.items : [];
      if (items.length > 0) {
        items.forEach(it => {
          const itCode = (it.articuloId || it.codigo || '').trim().toUpperCase();
          const cost = productCostMap[itCode] || 28.0;
          const qty = Number(it.cantidad || 0);
          const itLitros = Number(it.litrosTotales || (qty * 11.35));
          const itNetoUsd = Number(it.totalNetoUsd || (it.totalNeto ? it.totalNeto / tasaBcv : qty * cost * 1.35));
          const cat = productCategoryMap[itCode] || 'Gasolina';

          baseCmvUsd += qty * cost;

          const targetLine = linesBreakdown[cat] || linesBreakdown['Gasolina'];
          targetLine.litros += itLitros;
          targetLine.cajas += qty;
          targetLine.ventaUsd += itNetoUsd;
          targetLine.cmvUsd += (qty * cost);
          targetLine.skus += 1;
        });
      } else {
        baseCmvUsd += (vUsd * 0.68);
      }
    });

    // Si la base no tiene facturas vivas suficientes, alimentar con el catálogo
    if (baseFacturadoUsd === 0) {
      products.forEach(p => {
        const cat = p.categoria || 'Gasolina';
        const targetLine = linesBreakdown[cat] || linesBreakdown['Gasolina'];
        const estLitros = (p.stock || 20) * (p.litrosPorUnidad || 11.35) * 1.5;
        const estCajas = (p.stock || 20) * 1.5;
        const estVenta = estCajas * (p.precioUsdMayor || 40.0);
        const estCmv = estCajas * (p.costoUsd || 28.0);

        baseFacturadoUsd += estVenta;
        baseFacturadoBs += (estVenta * tasaBcv);
        baseLitrosVendidos += estLitros;
        baseCajasVendidas += estCajas;
        baseCmvUsd += estCmv;

        targetLine.litros += estLitros;
        targetLine.cajas += estCajas;
        targetLine.ventaUsd += estVenta;
        targetLine.cmvUsd += estCmv;
        targetLine.skus += 1;
      });
    }

    // B. Aplicar Ajustes de Sensibilidad (What-If Simulator)
    const factorPrecio = 1 + (priceAdjustmentPct / 100);
    const factorCmv = 1 + (cogsAdjustmentPct / 100);

    const facturadoAjustadoUsd = baseFacturadoUsd * factorPrecio;
    const facturadoAjustadoBs = facturadoAjustadoUsd * tasaBcv;
    const cmvAjustadoUsd = baseCmvUsd * factorCmv;

    // C. Utilidad Bruta
    const utilidadBrutaUsd = facturadoAjustadoUsd - cmvAjustadoUsd;
    const margenBrutoPct = facturadoAjustadoUsd > 0 ? (utilidadBrutaUsd / facturadoAjustadoUsd) * 100 : 0;

    // D. Gastos Variables Directos
    const costoFletesUsd = baseLitrosVendidos * freightPerLiterUsd;
    const costoComisionesUsd = facturadoAjustadoUsd * (avgCommissionPct / 100);
    const costoMermasUsd = profitInventoryAdjustments.reduce((acc, a) => acc + Math.abs(Number(a.costoTotalUsd || 0)), 0) || (baseCmvUsd * 0.008);
    const retencionesIslrUsd = profitIslrWithholdings.reduce((acc, r) => acc + Number(r.montoRetenidoUsd || 0), 0) || (facturadoAjustadoUsd * 0.015);

    const totalGastosVariablesUsd = costoFletesUsd + costoComisionesUsd + costoMermasUsd + retencionesIslrUsd;

    // E. Margen de Contribución Real
    const margenContribucionUsd = utilidadBrutaUsd - totalGastosVariablesUsd;
    const margenContribucionPct = facturadoAjustadoUsd > 0 ? (margenContribucionUsd / facturadoAjustadoUsd) * 100 : 0;

    // F. Gastos Operativos Fijos de Distribución (OPEX)
    const totalEgresosCajaUsd = cashMovements.filter(m => m.tipo === 'EGRESO').reduce((acc, m) => acc + Number(m.montoUsd || 0), 0);
    const opexFijoUsd = totalEgresosCajaUsd > 0 ? totalEgresosCajaUsd : (facturadoAjustadoUsd * 0.08);

    // G. Utilidad Operativa Neta (EBITDA Operativo)
    const utilidadOperativaUsd = margenContribucionUsd - opexFijoUsd;
    const margenOperativoPct = facturadoAjustadoUsd > 0 ? (utilidadOperativaUsd / facturadoAjustadoUsd) * 100 : 0;
    const utilidadPorLitroUsd = baseLitrosVendidos > 0 ? (utilidadOperativaUsd / baseLitrosVendidos) : 0;

    // H. Análisis de Líneas con Gastos Prorrateados
    const linesResult = Object.entries(linesBreakdown).map(([key, data]) => {
      const vUsd = data.ventaUsd * factorPrecio;
      const cUsd = data.cmvUsd * factorCmv;
      const uBruta = vUsd - cUsd;
      const mBrutoPct = vUsd > 0 ? (uBruta / vUsd) * 100 : 0;

      const shareLitros = baseLitrosVendidos > 0 ? data.litros / baseLitrosVendidos : 0;
      const shareVentas = facturadoAjustadoUsd > 0 ? vUsd / facturadoAjustadoUsd : 0;

      const fleteLinea = costoFletesUsd * shareLitros;
      const comisionLinea = costoComisionesUsd * shareVentas;
      const mermasLinea = costoMermasUsd * shareLitros;
      const islrLinea = retencionesIslrUsd * shareVentas;
      const opexLinea = opexFijoUsd * shareVentas;

      const totalDeduccionesLinea = fleteLinea + comisionLinea + mermasLinea + islrLinea + opexLinea;
      const utilidadNetaLinea = uBruta - totalDeduccionesLinea;
      const margenNetoPct = vUsd > 0 ? (utilidadNetaLinea / vUsd) * 100 : 0;
      const rendimientoLitro = data.litros > 0 ? (utilidadNetaLinea / data.litros) : 0;

      return {
        key,
        nombre: data.nombre,
        litros: data.litros,
        cajas: data.cajas,
        ventaUsd: vUsd,
        cmvUsd: cUsd,
        utilidadBrutaUsd: uBruta,
        margenBrutoPct,
        fleteLinea,
        comisionLinea,
        mermasLinea,
        islrLinea,
        opexLinea,
        totalDeduccionesLinea,
        utilidadNetaLinea,
        margenNetoPct,
        rendimientoLitro
      };
    }).sort((a, b) => b.utilidadNetaLinea - a.utilidadNetaLinea);

    return {
      baseFacturadoUsd,
      baseLitrosVendidos,
      baseCajasVendidas,
      facturadoAjustadoUsd,
      facturadoAjustadoBs,
      cmvAjustadoUsd,
      utilidadBrutaUsd,
      margenBrutoPct,
      costoFletesUsd,
      costoComisionesUsd,
      costoMermasUsd,
      retencionesIslrUsd,
      totalGastosVariablesUsd,
      margenContribucionUsd,
      margenContribucionPct,
      opexFijoUsd,
      utilidadOperativaUsd,
      margenOperativoPct,
      utilidadPorLitroUsd,
      linesResult
    };
  }, [products, profitInvoices, profitInventoryAdjustments, profitIslrWithholdings, cashMovements, tasaBcv, priceAdjustmentPct, cogsAdjustmentPct, freightPerLiterUsd, avgCommissionPct]);

  const handleExportCsv = () => {
    let csv = '\uFEFF';
    csv += 'CONCEPTO_ESTADO_DE_RESULTADOS;MONTO_USD;MONTO_BS;PORCENTAJE_VENTAS\n';

    csv += 'Ingresos Brutos por Ventas;' + financialData.facturadoAjustadoUsd.toFixed(2) + ';' + financialData.facturadoAjustadoBs.toFixed(2) + ';100.00%\n';
    csv += '(-) Costo de Mercancía Vendida (CMV);-' + financialData.cmvAjustadoUsd.toFixed(2) + ';-' + (financialData.cmvAjustadoUsd * tasaBcv).toFixed(2) + ';-' + ((financialData.cmvAjustadoUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2) + '%\n';
    csv += '(=) UTILIDAD BRUTA OPERATIVA;' + financialData.utilidadBrutaUsd.toFixed(2) + ';' + (financialData.utilidadBrutaUsd * tasaBcv).toFixed(2) + ';' + financialData.margenBrutoPct.toFixed(2) + '%\n';
    csv += '(-) Fletes y Logística de Distribución;-' + financialData.costoFletesUsd.toFixed(2) + ';-' + (financialData.costoFletesUsd * tasaBcv).toFixed(2) + ';-' + ((financialData.costoFletesUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2) + '%\n';
    csv += '(-) Comisiones Fuerza de Ventas;-' + financialData.costoComisionesUsd.toFixed(2) + ';-' + (financialData.costoComisionesUsd * tasaBcv).toFixed(2) + ';-' + ((financialData.costoComisionesUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2) + '%\n';
    csv += '(-) Mermas y Ajustes de Inventario;-' + financialData.costoMermasUsd.toFixed(2) + ';-' + (financialData.costoMermasUsd * tasaBcv).toFixed(2) + ';-' + ((financialData.costoMermasUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2) + '%\n';
    csv += '(-) Retenciones e Impacto Fiscal ISLR;-' + financialData.retencionesIslrUsd.toFixed(2) + ';-' + (financialData.retencionesIslrUsd * tasaBcv).toFixed(2) + ';-' + ((financialData.retencionesIslrUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2) + '%\n';
    csv += '(=) MARGEN DE CONTRIBUCIÓN REAL;' + financialData.margenContribucionUsd.toFixed(2) + ';' + (financialData.margenContribucionUsd * tasaBcv).toFixed(2) + ';' + financialData.margenContribucionPct.toFixed(2) + '%\n';
    csv += '(-) Gastos Fijos de Distribución (OPEX);-' + financialData.opexFijoUsd.toFixed(2) + ';-' + (financialData.opexFijoUsd * tasaBcv).toFixed(2) + ';-' + ((financialData.opexFijoUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2) + '%\n';
    csv += '(=) UTILIDAD OPERATIVA NETA (EBITDA);' + financialData.utilidadOperativaUsd.toFixed(2) + ';' + (financialData.utilidadOperativaUsd * tasaBcv).toFixed(2) + ';' + financialData.margenOperativoPct.toFixed(2) + '%\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ESTADO_RESULTADOS_PL_OPERATIVO_' + (new Date().toISOString().slice(0, 10)) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    generateProfitabilityPDF({
      products,
      sales: profitInvoices,
      purchases: profitPurchases,
      config,
      currentUser
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '96vw',
          maxWidth: '1380px',
          maxHeight: '94vh',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-glass)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* 1. CABECERA PRINCIPAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
              }}
            >
              <TrendingUp size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                P&L Operativo en Tiempo Real & Rentabilidad Neta
                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                  Auditoría Financiera por Línea
                </span>
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Cascada financiera deduciendo CMV, fletes, comisiones de asesores, ISLR SENIAT y mermas
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Selector de Pestañas */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <button
                className="btn btn-sm"
                onClick={() => setActiveTab('waterfall')}
                style={{
                  background: activeTab === 'waterfall' ? 'var(--motorven-navy)' : 'transparent',
                  color: activeTab === 'waterfall' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'waterfall' ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Layers size={14} /> Cascada P&L
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setActiveTab('lines_pnl')}
                style={{
                  background: activeTab === 'lines_pnl' ? '#7c3aed' : 'transparent',
                  color: activeTab === 'lines_pnl' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'lines_pnl' ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <PieChart size={14} /> Por Línea de Aceite ({financialData.linesResult.length})
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setActiveTab('simulator')}
                style={{
                  background: activeTab === 'simulator' ? '#d97706' : 'transparent',
                  color: activeTab === 'simulator' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'simulator' ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Sliders size={14} /> Simulador What-If
              </button>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleExportCsv}
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="Exportar P&L a Excel CSV"
            >
              <Download size={14} /> CSV
            </button>

            <button
              className="btn btn-print-report btn-sm"
              onClick={() => {
                setActiveTab('print');
                handlePrint();
              }}
              style={{ fontSize: '0.78rem' }}
            >
              <Printer size={14} color="#ffffff" /> Imprimir Reporte
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 2. BARRA SUPERIOR DE 4 BENTO / KPI STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          
          {/* KPI 1: Ingresos Brutos */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--motorven-navy-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Facturación Neta Bruta
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem' }}>100% Ventas</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              {formatUsd(financialData.facturadoAjustadoUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(financialData.facturadoAjustadoBs)}
            </div>
          </div>

          {/* KPI 2: Margen de Contribución */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #0284c7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Margen de Contribución
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>{financialData.margenContribucionPct.toFixed(1)}%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
              {formatUsd(financialData.margenContribucionUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Deduciendo fletes, comisiones e ISLR
            </div>
          </div>

          {/* KPI 3: Utilidad Operativa EBITDA */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--semaforo-verde)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Utilidad Neta Operativa (EBITDA)
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>{financialData.margenOperativoPct.toFixed(1)}% Margen</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '2px' }}>
              {formatUsd(financialData.utilidadOperativaUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(financialData.utilidadOperativaUsd * tasaBcv)}
            </div>
          </div>

          {/* KPI 4: Rendimiento por Litro */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--motorven-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Rendimiento Neto / Litro
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Unitario</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--motorven-gold)', marginTop: '2px' }}>
              $ {financialData.utilidadPorLitroUsd.toFixed(3)} / L
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Sobre {financialData.baseLitrosVendidos.toLocaleString('en-US', { maximumFractionDigits: 0 })} L despachados
            </div>
          </div>

        </div>

        {/* 3. CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          
          {/* TAB 1: CASCADA FINANCIERA (WATERFALL P&L) */}
          {activeTab === 'waterfall' && (
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>LÍNEA DEL ESTADO DE RESULTADOS (P&L)</th>
                    <th style={{ textAlign: 'center' }}>TIPO / IMPACTO</th>
                    <th style={{ textAlign: 'right' }}>MONTO ($ USD)</th>
                    <th style={{ textAlign: 'right' }}>EQUIVALENTE BS. (BCV)</th>
                    <th style={{ textAlign: 'right' }}>% DE LA VENTA</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. Ingresos */}
                  <tr style={{ background: 'rgba(37, 99, 235, 0.06)' }}>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowUpRight size={16} color="var(--motorven-navy-light)" />
                        (+) Ingresos Brutos por Ventas de Lubricantes
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '22px' }}>
                        Facturación total consolidada de aceites de motor, transmisiones e industriales
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-primary">Ingreso Base</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-tech)', fontSize: '0.95rem' }}>
                      {formatUsd(financialData.facturadoAjustadoUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                      {formatBs(financialData.facturadoAjustadoBs)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-code)' }}>100.00%</td>
                  </tr>

                  {/* 2. CMV */}
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--motorven-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowDownRight size={16} color="var(--motorven-red)" />
                        (-) Costo de Mercancía Vendida (CMV / COGS)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '22px' }}>
                        Costo de adquisición de lubricantes en refinería / planta envasadora
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-danger">Costo Directo</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)' }}>
                      - {formatUsd(financialData.cmvAjustadoUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {formatBs(financialData.cmvAjustadoUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-red)' }}>
                      - {((financialData.cmvAjustadoUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%
                    </td>
                  </tr>

                  {/* = UTILIDAD BRUTA */}
                  <tr style={{ background: 'var(--bg-table-header)', borderTop: '2px solid var(--border-glass)', borderBottom: '2px solid var(--border-glass)' }}>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                        (=) UTILIDAD BRUTA OPERATIVA
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-success">Margen Bruto</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-tech)', fontSize: '1rem', color: 'var(--semaforo-verde)' }}>
                      {formatUsd(financialData.utilidadBrutaUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                      {formatBs(financialData.utilidadBrutaUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-code)', color: 'var(--semaforo-verde)' }}>
                      {financialData.margenBrutoPct.toFixed(2)}%
                    </td>
                  </tr>

                  {/* 3. Deducciones Variables */}
                  <tr>
                    <td>
                      <div style={{ paddingLeft: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} color="#0284c7" />
                        (-) Fletes y Logística de Distribución ($ {freightPerLiterUsd.toFixed(2)}/L)
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Variable</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                      - {formatUsd(financialData.costoFletesUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {formatBs(financialData.costoFletesUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {((financialData.costoFletesUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div style={{ paddingLeft: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} color="#8b5cf6" />
                        (-) Comisiones Fuerza de Ventas ({avgCommissionPct}%)
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Variable</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                      - {formatUsd(financialData.costoComisionesUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {formatBs(financialData.costoComisionesUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {((financialData.costoComisionesUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div style={{ paddingLeft: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} color="#d97706" />
                        (-) Retenciones e Impacto Fiscal ISLR SENIAT
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Fiscal</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                      - {formatUsd(financialData.retencionesIslrUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {formatBs(financialData.retencionesIslrUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {((financialData.retencionesIslrUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div style={{ paddingLeft: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} color="var(--motorven-red)" />
                        (-) Pérdidas por Mermas y Ajustes de Almacén
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Merma</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                      - {formatUsd(financialData.costoMermasUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {formatBs(financialData.costoMermasUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {((financialData.costoMermasUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%
                    </td>
                  </tr>

                  {/* = MARGEN DE CONTRIBUCIÓN */}
                  <tr style={{ background: 'rgba(2, 132, 199, 0.08)', fontWeight: 800 }}>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.88rem' }}>
                        (=) MARGEN DE CONTRIBUCIÓN REAL
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-info">Contribución</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-tech)', fontSize: '0.98rem', color: '#0284c7' }}>
                      {formatUsd(financialData.margenContribucionUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                      {formatBs(financialData.margenContribucionUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#0284c7' }}>
                      {financialData.margenContribucionPct.toFixed(2)}%
                    </td>
                  </tr>

                  {/* 4. OPEX */}
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building size={14} />
                        (-) Gastos Fijos de Operación, Nómina & Almacén (OPEX)
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-secondary">Fijo</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                      - {formatUsd(financialData.opexFijoUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {formatBs(financialData.opexFijoUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                      - {((financialData.opexFijoUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%
                    </td>
                  </tr>

                  {/* = RESULTADO NETO FINAL */}
                  <tr style={{ background: 'rgba(16, 185, 129, 0.12)', borderTop: '2px solid var(--semaforo-verde)' }}>
                    <td>
                      <div style={{ fontWeight: 900, color: 'var(--semaforo-verde)', fontSize: '1rem', textTransform: 'uppercase' }}>
                        (=) UTILIDAD NETA OPERATIVA (EBITDA DISTRIBUCIÓN)
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>Rendimiento Neto</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-tech)', fontSize: '1.2rem', color: 'var(--semaforo-verde)' }}>
                      {formatUsd(financialData.utilidadOperativaUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-code)', fontSize: '1rem', color: 'var(--motorven-gold)' }}>
                      {formatBs(financialData.utilidadOperativaUsd * tasaBcv)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-code)', fontSize: '1.1rem', color: 'var(--semaforo-verde)' }}>
                      {financialData.margenOperativoPct.toFixed(2)}%
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: P&L DESGLOSADO POR LÍNEA DE ACEITE */}
          {activeTab === 'lines_pnl' && (
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>LÍNEA / FAMILIA DE LUBRICANTE</th>
                    <th style={{ textAlign: 'center' }}>VOLUMEN</th>
                    <th style={{ textAlign: 'right' }}>VENTAS ($ USD)</th>
                    <th style={{ textAlign: 'right' }}>CMV ($)</th>
                    <th style={{ textAlign: 'right' }}>UTILIDAD BRUTA</th>
                    <th style={{ textAlign: 'right' }}>DEDUCCIONES (FLETES/COM/ISLR)</th>
                    <th style={{ textAlign: 'right' }}>UTILIDAD NETA</th>
                    <th style={{ textAlign: 'right' }}>MARGEN NETO</th>
                    <th style={{ textAlign: 'right' }}>RENDIMIENTO / L</th>
                  </tr>
                </thead>
                <tbody>
                  {financialData.linesResult.map(line => (
                    <tr key={line.key}>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                          {line.nombre}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {line.cajas.toFixed(0)} Cajas registradas
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-tech)' }}>
                          {line.litros.toLocaleString('en-US', { maximumFractionDigits: 0 })} L
                        </div>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)' }}>
                        {formatUsd(line.ventaUsd)}
                      </td>

                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)' }}>
                        {formatUsd(line.cmvUsd)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                        {formatUsd(line.utilidadBrutaUsd)}
                      </td>

                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--text-muted)' }}>
                        - {formatUsd(line.totalDeduccionesLinea)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-tech)', fontSize: '0.95rem', color: line.utilidadNetaLinea >= 0 ? 'var(--semaforo-verde)' : 'var(--motorven-red)' }}>
                        {formatUsd(line.utilidadNetaLinea)}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <span
                          className={'badge ' + (line.margenNetoPct >= 15 ? 'badge-success' : line.margenNetoPct >= 8 ? 'badge-warning' : 'badge-danger')}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {line.margenNetoPct.toFixed(1)}%
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                        ${line.rendimientoLitro.toFixed(2)}/L
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-table-header)', fontWeight: 800 }}>
                    <td>TOTAL CONSOLIDADO:</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-tech)' }}>
                      {financialData.baseLitrosVendidos.toLocaleString('en-US', { maximumFractionDigits: 0 })} L
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>
                      {formatUsd(financialData.facturadoAjustadoUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)' }}>
                      {formatUsd(financialData.cmvAjustadoUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                      {formatUsd(financialData.utilidadBrutaUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>
                      - {formatUsd(financialData.totalGastosVariablesUsd + financialData.opexFijoUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontSize: '1rem', color: 'var(--semaforo-verde)' }}>
                      {formatUsd(financialData.utilidadOperativaUsd)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--semaforo-verde)' }}>
                      {financialData.margenOperativoPct.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--motorven-gold)' }}>
                      ${financialData.utilidadPorLitroUsd.toFixed(2)}/L
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* TAB 3: SIMULADOR DE SENSIBILIDAD WHAT-IF */}
          {activeTab === 'simulator' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.25rem' }}>
              
              {/* Controles de Sensibilidad */}
              <div className="bento-card" style={{ padding: '1.25rem' }}>
                <div className="bento-card-header">
                  <span className="bento-card-header-title">
                    <Sliders size={18} color="#d97706" />
                    Parámetros de Sensibilidad
                  </span>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setPriceAdjustmentPct(0);
                      setCogsAdjustmentPct(0);
                      setFreightPerLiterUsd(0.08);
                      setAvgCommissionPct(3.0);
                    }}
                    style={{ fontSize: '0.72rem' }}
                  >
                    Restablecer
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Slider 1: Variación de Precios */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Variación Precios de Venta:</span>
                      <strong style={{ color: priceAdjustmentPct >= 0 ? 'var(--semaforo-verde)' : 'var(--motorven-red)' }}>
                        {priceAdjustmentPct > 0 ? ('+' + priceAdjustmentPct + '%') : (priceAdjustmentPct + '%')}
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      step="1"
                      value={priceAdjustmentPct}
                      onChange={(e) => setPriceAdjustmentPct(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      <span>-15% (Descuento agresivo)</span>
                      <span>0% (Actual)</span>
                      <span>+15% (Aumento)</span>
                    </div>
                  </div>

                  {/* Slider 2: Variación de Costo CMV */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Variación Costo Refinería / Proveedor:</span>
                      <strong style={{ color: cogsAdjustmentPct <= 0 ? 'var(--semaforo-verde)' : 'var(--motorven-red)' }}>
                        {cogsAdjustmentPct > 0 ? ('+' + cogsAdjustmentPct + '%') : (cogsAdjustmentPct + '%')}
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="-15"
                      max="15"
                      step="1"
                      value={cogsAdjustmentPct}
                      onChange={(e) => setCogsAdjustmentPct(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      <span>-15% (Descuento planta)</span>
                      <span>0% (Actual)</span>
                      <span>+15% (Alza costos)</span>
                    </div>
                  </div>

                  {/* Slider 3: Costo de Flete por Litro */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Costo de Flete Logístico ($/L):</span>
                      <strong style={{ color: '#0284c7' }}>${freightPerLiterUsd.toFixed(2)} USD / L</strong>
                    </div>
                    <input
                      type="range"
                      min="0.02"
                      max="0.20"
                      step="0.01"
                      value={freightPerLiterUsd}
                      onChange={(e) => setFreightPerLiterUsd(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      <span>$0.02/L (Local)</span>
                      <span>$0.08/L (Nacional)</span>
                      <span>$0.20/L (Rutas Lejanas)</span>
                    </div>
                  </div>

                  {/* Slider 4: Comisión Vendedores */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Comisión Vendedores (% s/Ventas):</span>
                      <strong style={{ color: '#8b5cf6' }}>{avgCommissionPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="6.0"
                      step="0.5"
                      value={avgCommissionPct}
                      onChange={(e) => setAvgCommissionPct(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      <span>1.0%</span>
                      <span>3.0% (Estándar)</span>
                      <span>6.0% (Incentivo alto)</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Resultado Simulado */}
              <div className="bento-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="bento-card-header">
                  <span className="bento-card-header-title">
                    <TrendingUp size={18} color="var(--semaforo-verde)" />
                    Impacto en Utilidad Operativa Proyectada
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', margin: '1rem 0' }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ventas Proyectadas</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                      {formatUsd(financialData.facturadoAjustadoUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {priceAdjustmentPct > 0 ? ('+' + priceAdjustmentPct + '%') : (priceAdjustmentPct + '%')} vs base
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CMV Proyectado</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-red)', marginTop: '2px' }}>
                      {formatUsd(financialData.cmvAjustadoUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {cogsAdjustmentPct > 0 ? ('+' + cogsAdjustmentPct + '%') : (cogsAdjustmentPct + '%')} vs base
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Margen Contribución</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                      {formatUsd(financialData.margenContribucionUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>
                      {financialData.margenContribucionPct.toFixed(1)}% margen
                    </div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--semaforo-verde)', textTransform: 'uppercase', fontWeight: 700 }}>EBITDA Neto Final</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '2px' }}>
                      {formatUsd(financialData.utilidadOperativaUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--semaforo-verde)', fontWeight: 700 }}>
                      {financialData.margenOperativoPct.toFixed(1)}% margen neto
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  💡 <strong>Diagnóstico Automático:</strong> Por cada $1.00 adicional facturado bajo esta estructura, $ {((financialData.margenContribucionPct) / 100).toFixed(2)} USD van directamente a la utilidad de la empresa después de cubrir fletes y comisiones.
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: FORMATO FORMAL IMPRIMIBLE */}
          {activeTab === 'print' && (
            <div style={{ background: '#ffffff', color: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '1000px', margin: '0 auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }} className="no-print">
                <button
                  className="btn btn-print-report"
                  onClick={handlePrint}
                >
                  <Printer size={16} color="#ffffff" /> Imprimir Reporte
                </button>
              </div>

              {/* Membrete Oficial */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #002b7a', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#002b7a' }}>
                    {config.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.'}
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                    RIF: {config.rif || 'J-30401927-4'} | ESTADO DE GANANCIAS Y PÉRDIDAS OPERATIVAS (P&L)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {config.direccion || 'Zona Industrial III, Carrera 2 con Calle 4, Barquisimeto / Caracas - Venezuela'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    INFORME FINANCIERO EJECUTIVO
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#002b7a', fontFamily: 'monospace' }}>
                    PL-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Fecha: {new Date().toLocaleDateString('es-VE')} | Tasa BCV: Bs. {tasaBcv.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Tabla Formal P&L */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ background: '#002b7a', color: '#ffffff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>ESTRUCTURA DE INGRESOS Y GASTOS</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>MONTO ($ USD)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>EQUIVALENTE BS.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>% VENTAS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>(+) Ingresos Brutos Facturados</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>${financialData.facturadoAjustadoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>Bs. {financialData.facturadoAjustadoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>100.00%</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px', color: '#b91c1c' }}>(-) Costo de Mercancía Vendida (CMV)</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b91c1c' }}>-${financialData.cmvAjustadoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>-Bs. {(financialData.cmvAjustadoUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b91c1c' }}>-{((financialData.cmvAjustadoUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%</td>
                  </tr>

                  <tr style={{ borderBottom: '2px solid #002b7a', background: '#eef4ff' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 900, color: '#002b7a' }}>(=) UTILIDAD BRUTA OPERATIVA</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: '#002b7a' }}>${financialData.utilidadBrutaUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>Bs. {(financialData.utilidadBrutaUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: '#002b7a' }}>{financialData.margenBrutoPct.toFixed(2)}%</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px', paddingLeft: '20px' }}>(-) Fletes y Logística de Distribución</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-${financialData.costoFletesUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-Bs. {(financialData.costoFletesUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-{((financialData.costoFletesUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px', paddingLeft: '20px' }}>(-) Comisiones de Vendedores</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-${financialData.costoComisionesUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-Bs. {(financialData.costoComisionesUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-{((financialData.costoComisionesUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px', paddingLeft: '20px' }}>(-) Retenciones e Impacto Fiscal ISLR</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-${financialData.retencionesIslrUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-Bs. {(financialData.retencionesIslrUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-{((financialData.retencionesIslrUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%</td>
                  </tr>

                  <tr style={{ borderBottom: '2px solid #0284c7', background: '#f0f9ff' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 900, color: '#0369a1' }}>(=) MARGEN DE CONTRIBUCIÓN</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: '#0369a1' }}>${financialData.margenContribucionUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>Bs. {(financialData.margenContribucionUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: '#0369a1' }}>{financialData.margenContribucionPct.toFixed(2)}%</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px' }}>(-) Gastos Fijos de Operación (OPEX)</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-${financialData.opexFijoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-Bs. {(financialData.opexFijoUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>-{((financialData.opexFijoUsd / financialData.facturadoAjustadoUsd) * 100).toFixed(2)}%</td>
                  </tr>

                  <tr style={{ background: '#dcfce7', borderTop: '2px solid #16a34a' }}>
                    <td style={{ padding: '10px', fontWeight: 900, color: '#15803d', fontSize: '0.92rem' }}>(=) UTILIDAD OPERATIVA NETA (EBITDA)</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, color: '#15803d', fontSize: '1rem' }}>${financialData.utilidadOperativaUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>Bs. {(financialData.utilidadOperativaUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, color: '#15803d', fontSize: '0.95rem' }}>{financialData.margenOperativoPct.toFixed(2)}%</td>
                  </tr>
                </tbody>
              </table>

              {/* Firmas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3rem', marginTop: '3rem', paddingTop: '1rem' }}>
                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>DIRECCIÓN DE FINANZAS & BI</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SIGNUM MOTORVEN, C.A.</div>
                </div>

                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>PRESIDENCIA / JUNTA DIRECTIVA</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SIGNUM MOTORVEN, C.A.</div>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
