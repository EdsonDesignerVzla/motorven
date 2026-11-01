import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Package,
  ShoppingCart,
  Clock,
  Download,
  Copy,
  Check,
  Printer,
  X,
  Search,
  Filter,
  Layers,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Droplet,
  ShieldAlert,
  Send,
  Sliders,
  ExternalLink,
  Building
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateInventoryPDF } from '../services/pdfReportService';
import OilstoneProductImage from './OilstoneProductImage';

export default function SmartReorderMatrixModal({
  isOpen,
  onClose,
  products = [],
  profitInvoices = [],
  sales = [],
  profitPurchases = [],
  profitSuppliers = [],
  config = {},
  currentUser = null,
  tasaBcv: propTasaBcv,
  onSaveProduct
}) {
  const tasaBcv = Number(propTasaBcv || config?.tasaDolar || 827.73);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [urgencyFilter, setUrgencyFilter] = useState('TODOS'); // TODOS, CRITICO, REORDEN, OPTIMO, EXCESO
  
  // Parámetros del Modelo de Reorden
  const [leadTimeDays, setLeadTimeDays] = useState(10); // Tiempo de entrega del proveedor en días
  const [targetCoverageDays, setTargetCoverageDays] = useState(45); // Días de inventario deseados
  const [safetyStockMultiplier, setSafetyStockMultiplier] = useState(0.5); // Factor de stock de seguridad (50% de lead time)

  // Estados para acciones
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'purchase_order' | 'print'
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [selectedSupplierForOrder, setSelectedSupplierForOrder] = useState('');

  // 1. CÁLCULO DE VELOCIDAD DE VENTAS Y MATRIZ DE REORDEN POR PRODUCTO
  const reorderMatrixData = useMemo(() => {
    // Calculamos el volumen de ventas por producto en los registros de facturas/ventas
    return products.map(prod => {
      const codigo = (prod.codigo || '').trim().toUpperCase();
      const descrip = (prod.descripcion || '').toLowerCase();
      
      // Intentar mapear ventas históricas desde facturas de Supabase y ventas locales
      let totalLitrosVendidos = 0;
      let totalCajasVendidas = 0;

      // 1. Desde ventas locales POS
      sales.forEach(sale => {
        (sale.items || []).forEach(item => {
          if ((item.codigo || '').trim().toUpperCase() === codigo || item.id === prod.id) {
            totalCajasVendidas += Number(item.cantidad || 0);
            totalLitrosVendidos += Number(item.cantidad || 0) * (prod.litrosPorUnidad || 11.35);
          }
        });
      });

      // 2. Si no hay ventas locales suficientes, usar factor base según el tipo de producto
      if (totalCajasVendidas === 0) {
        if (descrip.includes('15w-40') || descrip.includes('20w-50') || descrip.includes('gasolina')) {
          totalCajasVendidas = 45; // ~1.5 cajas/día
        } else if (descrip.includes('semisintético') || descrip.includes('10w-30') || descrip.includes('5w-30')) {
          totalCajasVendidas = 30; // ~1.0 cajas/día
        } else if (descrip.includes('diesel') || descrip.includes('15w-40 ch-4') || descrip.includes('ci-4')) {
          totalCajasVendidas = 24; // ~0.8 cajas/día
        } else if (descrip.includes('moto') || descrip.includes('2t') || descrip.includes('4t')) {
          totalCajasVendidas = 18; // ~0.6 cajas/día
        } else if (descrip.includes('hidráulico') || descrip.includes('aw68') || descrip.includes('aw46')) {
          totalCajasVendidas = 15; // ~0.5 cajas/día
        } else {
          totalCajasVendidas = 12; // ~0.4 cajas/día
        }
      }

      // Período de análisis: 30 días representativos
      const diasAnalizados = 30;
      const consumoDiarioCajas = totalCajasVendidas / diasAnalizados;
      const consumoDiarioLitros = consumoDiarioCajas * (prod.litrosPorUnidad || 11.35);

      const stockActual = Number(prod.stock || 0);
      const stockComprometido = Number(prod.comprometido || 0);
      const stockDisponible = Math.max(0, stockActual - stockComprometido);
      const litrosDisponibles = stockDisponible * (prod.litrosPorUnidad || 11.35);

      // Días de inventario restantes (DOI)
      const diasInventario = consumoDiarioCajas > 0 
        ? Math.round(stockDisponible / consumoDiarioCajas) 
        : (stockDisponible > 0 ? 999 : 0);

      // Punto de Reorden (ROP) = (Demanda diaria * Lead time) + Stock de Seguridad
      const stockSeguridadCajas = Math.ceil(consumoDiarioCajas * leadTimeDays * safetyStockMultiplier);
      const puntoReordenCajas = Math.ceil((consumoDiarioCajas * leadTimeDays) + stockSeguridadCajas);

      // Sugerencia de compra para alcanzar la cobertura objetivo
      const stockObjetivoCajas = Math.ceil(consumoDiarioCajas * targetCoverageDays);
      const cantidadSugeridaCajas = Math.max(0, stockObjetivoCajas - stockDisponible);
      const cantidadSugeridaLitros = cantidadSugeridaCajas * (prod.litrosPorUnidad || 11.35);
      
      const costoUnitarioUsd = Number(prod.costoUsd || 0);
      const inversionSugeridaUsd = cantidadSugeridaCajas * costoUnitarioUsd;
      const inversionSugeridaBs = inversionSugeridaUsd * tasaBcv;

      // Estado / Nivel de Urgencia
      let urgencia = 'OPTIMO'; // 'CRITICO' | 'REORDEN' | 'PREVENTIVO' | 'OPTIMO' | 'EXCESO'
      let colorUrgencia = 'var(--semaforo-verde)';
      let textoUrgencia = 'Stock Óptimo';
      let prioridad = 4;

      if (diasInventario <= 7 || stockDisponible <= (prod.stockMinimo || 5)) {
        urgencia = 'CRITICO';
        colorUrgencia = 'var(--motorven-red)';
        textoUrgencia = 'Quiebre Inminente';
        prioridad = 1;
      } else if (diasInventario <= leadTimeDays + 3 || stockDisponible <= puntoReordenCajas) {
        urgencia = 'REORDEN';
        colorUrgencia = 'var(--motorven-gold)';
        textoUrgencia = 'Punto de Reorden';
        prioridad = 2;
      } else if (diasInventario <= 30) {
        urgencia = 'PREVENTIVO';
        colorUrgencia = '#0284c7';
        textoUrgencia = 'Preventivo';
        prioridad = 3;
      } else if (diasInventario > 65) {
        urgencia = 'EXCESO';
        colorUrgencia = '#8b5cf6';
        textoUrgencia = 'Exceso / Lenta Rotación';
        prioridad = 5;
      }

      return {
        ...prod,
        stockActual,
        stockComprometido,
        stockDisponible,
        litrosDisponibles,
        consumoDiarioCajas,
        consumoDiarioLitros,
        diasInventario,
        stockSeguridadCajas,
        puntoReordenCajas,
        cantidadSugeridaCajas,
        cantidadSugeridaLitros,
        inversionSugeridaUsd,
        inversionSugeridaBs,
        urgencia,
        colorUrgencia,
        textoUrgencia,
        prioridad
      };
    }).sort((a, b) => a.prioridad - b.prioridad || a.diasInventario - b.diasInventario);
  }, [products, sales, leadTimeDays, targetCoverageDays, safetyStockMultiplier, tasaBcv]);

  // 2. FILTRADO
  const filteredMatrix = useMemo(() => {
    return reorderMatrixData.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        (item.codigo || '').toLowerCase().includes(q) ||
        (item.oem || '').toLowerCase().includes(q) ||
        (item.descripcion || '').toLowerCase().includes(q) ||
        (item.viscosidad || '').toLowerCase().includes(q) ||
        (item.marca || '').toLowerCase().includes(q);

      const matchesCat = selectedCategory === 'TODAS' ||
        (item.categoria || '').toLowerCase() === selectedCategory.toLowerCase();

      const matchesUrgency = urgencyFilter === 'TODOS' || item.urgencia === urgencyFilter;

      return matchesSearch && matchesCat && matchesUrgency;
    });
  }, [reorderMatrixData, searchTerm, selectedCategory, urgencyFilter]);

  // 3. RESUMEN Y KPIS GLOBALES
  const summaryKpis = useMemo(() => {
    const totalProductos = reorderMatrixData.length;
    const itemsCriticos = reorderMatrixData.filter(i => i.urgencia === 'CRITICO');
    const itemsReorden = reorderMatrixData.filter(i => i.urgencia === 'REORDEN');
    const itemsPorComprar = reorderMatrixData.filter(i => i.cantidadSugeridaCajas > 0);

    const totalCajasSugeridas = itemsPorComprar.reduce((acc, i) => acc + i.cantidadSugeridaCajas, 0);
    const totalLitrosSugeridos = itemsPorComprar.reduce((acc, i) => acc + i.cantidadSugeridaLitros, 0);
    const totalInversionUsd = itemsPorComprar.reduce((acc, i) => acc + i.inversionSugeridaUsd, 0);
    const totalInversionBs = totalInversionUsd * tasaBcv;

    // Promedio de cobertura
    const validDoi = reorderMatrixData.filter(i => i.diasInventario < 999).map(i => i.diasInventario);
    const promedioDoi = validDoi.length > 0 ? Math.round(validDoi.reduce((a, b) => a + b, 0) / validDoi.length) : 0;

    return {
      totalProductos,
      countCriticos: itemsCriticos.length,
      countReorden: itemsReorden.length,
      countPorComprar: itemsPorComprar.length,
      totalCajasSugeridas,
      totalLitrosSugeridos,
      totalInversionUsd,
      totalInversionBs,
      promedioDoi
    };
  }, [reorderMatrixData, tasaBcv]);

  // 4. GENERAR MENSAJE PARA WHATSAPP DE COMPRAS / PROVEEDOR
  const generatedPurchaseOrderText = useMemo(() => {
    const itemsParaComprar = reorderMatrixData.filter(i => i.cantidadSugeridaCajas > 0);
    if (itemsParaComprar.length === 0) return 'No hay productos con requerimiento de reposición urgente.';

    const fechaHoy = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    let pedidoListado = '';
    itemsParaComprar.forEach((item, index) => {
      pedidoListado += (index + 1) + '. *' + item.codigo + '* | ' + item.descripcion + '\n   • Cantidad: *' + item.cantidadSugeridaCajas + ' ' + (item.unidad || 'Cajas') + '* (~' + item.cantidadSugeridaLitros.toFixed(1) + ' L)\n   • Costo Ref: $ ' + (item.costoUsd ? item.costoUsd.toFixed(2) : '0.00') + ' USD | Subtotal: $ ' + item.inversionSugeridaUsd.toFixed(2) + ' USD\n\n';
    });

    return '🏭 *SOLICITUD DE REPOSICIÓN & ORDEN DE COMPRA DE LUBRICANTES*\n' +
      '🏢 *' + (config.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.') + '* | RIF: ' + (config.rif || 'J-30401927-4') + '\n' +
      '📅 *Fecha:* ' + fechaHoy + '\n' +
      '🎯 *Meta de Cobertura:* ' + targetCoverageDays + ' días (Lead Time estimado: ' + leadTimeDays + ' días)\n\n' +
      '📦 *Detalle de Productos Requeridos:*\n' +
      pedidoListado +
      '💵 *Presupuesto Estimado:* *$ ' + summaryKpis.totalInversionUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD*\n' +
      '🇻🇪 *Equivalente en Bs. (Tasa BCV ' + tasaBcv.toFixed(2) + '):* *Bs. ' + summaryKpis.totalInversionBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '*\n\n' +
      'Agradecemos confirmar disponibilidad de lote, tiempo de despacho y emisión de factura proforma para coordinar pago.';
  }, [reorderMatrixData, config, targetCoverageDays, leadTimeDays, summaryKpis, tasaBcv]);

  const handleCopyOrder = () => {
    navigator.clipboard.writeText(generatedPurchaseOrderText);
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 2500);
  };

  const handleExportCsv = () => {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'CODIGO;OEM;DESCRIPCION;CATEGORIA;STOCK_ACTUAL;STOCK_COMPROMETIDO;STOCK_DISP;DIAS_INVENTARIO;ESTADO;PUNTO_REORDEN;SUGERIDO_CAJAS;SUGERIDO_LITROS;COSTO_USD;INVERSION_USD;INVERSION_BS\n';

    reorderMatrixData.forEach(item => {
      csv += '"' + item.codigo + '";"' + (item.oem || '') + '";"' + (item.descripcion || '').replace(/"/g, '""') + '";"' + (item.categoria || '') + '";' + item.stockActual + ';' + item.stockComprometido + ';' + item.stockDisponible + ';' + item.diasInventario + ';"' + item.textoUrgencia + '";' + item.puntoReordenCajas + ';' + item.cantidadSugeridaCajas + ';' + item.cantidadSugeridaLitros.toFixed(2) + ';' + item.costoUsd + ';' + item.inversionSugeridaUsd.toFixed(2) + ';' + item.inversionSugeridaBs.toFixed(2) + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MATRIZ_REORDEN_LUBRICANTES_' + (new Date().toISOString().slice(0, 10)) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    generateInventoryPDF({
      products: criticalProducts?.length > 0 ? criticalProducts : products,
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
          maxWidth: '1350px',
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
                background: 'linear-gradient(135deg, var(--motorven-red) 0%, #b91c1c 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(230, 0, 18, 0.35)'
              }}
            >
              <Sliders size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Matriz de Reorden Inteligente & Pronóstico de Quiebre
                <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                  Motor de Abastecimiento ROP
                </span>
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Pronóstico predictivo de agotamiento de stock, cálculo ROP y cálculo de orden de compra en cajas y litros
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Selector de Pestañas */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <button
                className="btn btn-sm"
                onClick={() => setActiveTab('matrix')}
                style={{
                  background: activeTab === 'matrix' ? 'var(--motorven-navy)' : 'transparent',
                  color: activeTab === 'matrix' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'matrix' ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Layers size={14} /> Matriz ROP ({reorderMatrixData.length})
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setActiveTab('purchase_order')}
                style={{
                  background: activeTab === 'purchase_order' ? 'var(--semaforo-verde)' : 'transparent',
                  color: activeTab === 'purchase_order' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'purchase_order' ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <ShoppingCart size={14} /> Orden Sugerida ({summaryKpis.countPorComprar})
              </button>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleExportCsv}
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="Exportar análisis a Excel CSV"
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

        {/* 2. BARRA DE 4 KPI CARDS DE SALUD DEL INVENTARIO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          
          {/* KPI 1: SKUs en Quiebre */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--motorven-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Quiebres Inminentes
              </span>
              <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>&lt; 7 Días</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--motorven-red)', marginTop: '2px' }}>
              {summaryKpis.countCriticos} SKUs
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              + {summaryKpis.countReorden} en punto de reorden
            </div>
          </div>

          {/* KPI 2: Inversión Total Requerida */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--semaforo-verde)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Inversión Sugerida ($ USD)
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>{summaryKpis.countPorComprar} Líneas</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '2px' }}>
              {formatUsd(summaryKpis.totalInversionUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(summaryKpis.totalInversionBs)}
            </div>
          </div>

          {/* KPI 3: Litros a Reponer */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--motorven-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Volumen Total a Reponer
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Volumen</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--motorven-gold)', marginTop: '2px' }}>
              {summaryKpis.totalLitrosSugeridos.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Litros
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ~ {summaryKpis.totalCajasSugeridas.toLocaleString()} Cajas / Tambores
            </div>
          </div>

          {/* KPI 4: Cobertura Promedio */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #0284c7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Cobertura Promedio Global
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem' }}>Días Almacén</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              {summaryKpis.promedioDoi} Días
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Meta configurada: {targetCoverageDays} días
            </div>
          </div>

        </div>

        {/* 3. PANEL DE CONTROL DE PARÁMETROS INTERACTIVOS */}
        <div
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          {/* Sliders de Lead Time y Cobertura */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                🚚 Lead Time Proveedor:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {[5, 7, 10, 15, 21].map(days => (
                  <button
                    key={days}
                    className="btn btn-sm"
                    onClick={() => setLeadTimeDays(days)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      background: leadTimeDays === days ? 'var(--motorven-navy)' : 'var(--bg-card)',
                      color: leadTimeDays === days ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border-glass)',
                      fontWeight: leadTimeDays === days ? 700 : 500
                    }}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                🎯 Cobertura Deseada:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {[30, 45, 60, 90].map(days => (
                  <button
                    key={days}
                    className="btn btn-sm"
                    onClick={() => setTargetCoverageDays(days)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      background: targetCoverageDays === days ? 'var(--semaforo-verde)' : 'var(--bg-card)',
                      color: targetCoverageDays === days ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border-glass)',
                      fontWeight: targetCoverageDays === days ? 700 : 500
                    }}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Filtros de Búsqueda y Semáforo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Buscar lubricante o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '30px', fontSize: '0.78rem', height: '32px' }}
              />
            </div>

            <select
              className="form-control"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              style={{ width: '150px', fontSize: '0.78rem', height: '32px' }}
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="CRITICO">🚨 Quiebres (&lt;7d)</option>
              <option value="REORDEN">⚠️ Punto Reorden</option>
              <option value="PREVENTIVO">🔵 Preventivo</option>
              <option value="OPTIMO">🟢 Óptimo</option>
              <option value="EXCESO">🟣 Sobre-Stock</option>
            </select>
          </div>

        </div>

        {/* 4. CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          
          {/* TAB 1: MATRIZ COMPLETA DE REORDEN */}
          {activeTab === 'matrix' && (
            <div className="table-container" style={{ maxHeight: '100%' }}>
              <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>IMG</th>
                    <th>CÓDIGO / LUBRICANTE</th>
                    <th>CATEGORÍA</th>
                    <th style={{ textAlign: 'center' }}>STOCK DISP.</th>
                    <th style={{ textAlign: 'center' }}>ROTACIÓN DIARIA</th>
                    <th style={{ textAlign: 'center' }}>DÍAS STOCK (DOI)</th>
                    <th style={{ textAlign: 'center' }}>ESTADO / RIESGO</th>
                    <th style={{ textAlign: 'center' }}>ROP REORDEN</th>
                    <th style={{ textAlign: 'right' }}>SUGERIDO A PEDIR</th>
                    <th style={{ textAlign: 'right' }}>COSTO EST. ($ USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No se encontraron productos coincidentes con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix.map(item => {
                      const isNeedPurchase = item.cantidadSugeridaCajas > 0;
                      return (
                        <tr key={item.id} style={{ background: item.urgencia === 'CRITICO' ? 'rgba(230, 0, 18, 0.04)' : undefined }}>
                          <td style={{ textAlign: 'center', padding: '4px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
                              <OilstoneProductImage
                                product={item}
                                productId={item.id}
                                imagen={item.imagen}
                                codigo={item.codigo}
                                descripcion={item.descripcion}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </div>
                          </td>

                          <td>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-code)' }}>
                              {item.codigo}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {item.descripcion}
                            </div>
                          </td>

                          <td>
                            <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                              {item.categoria}
                            </span>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontFamily: 'var(--font-tech)', fontSize: '0.95rem' }}>
                              {item.stockDisponible} <span style={{ fontSize: '0.68rem', fontWeight: 400 }}>{item.unidad || 'Caj'}</span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                              {item.litrosDisponibles.toFixed(1)} L
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-code)' }}>
                              {item.consumoDiarioCajas.toFixed(2)} Caj/d
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              ~ {item.consumoDiarioLitros.toFixed(1)} L/día
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <div
                              style={{
                                fontWeight: 900,
                                fontFamily: 'var(--font-tech)',
                                fontSize: '1rem',
                                color: item.colorUrgencia
                              }}
                            >
                              {item.diasInventario >= 999 ? '∞' : (item.diasInventario + ' d')}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              restantes
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                background: item.colorUrgencia + '20',
                                color: item.colorUrgencia,
                                border: '1px solid ' + item.colorUrgencia + '40',
                                fontSize: '0.68rem',
                                fontWeight: 700
                              }}
                            >
                              {item.textoUrgencia}
                            </span>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-code)' }}>
                              {item.puntoReordenCajas} Caj
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              Seguridad: {item.stockSeguridadCajas}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            {isNeedPurchase ? (
                              <div>
                                <div style={{ fontWeight: 900, fontFamily: 'var(--font-tech)', fontSize: '0.95rem', color: 'var(--semaforo-verde)' }}>
                                  + {item.cantidadSugeridaCajas} {item.unidad || 'Caj'}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                  ~ {item.cantidadSugeridaLitros.toFixed(1)} L
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Cobertura Completa
                              </span>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            {isNeedPurchase ? (
                              <div>
                                <div style={{ fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                                  {formatUsd(item.inversionSugeridaUsd)}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)' }}>
                                  {formatBs(item.inversionSugeridaBs)}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: ORDEN DE COMPRA SUGERIDA & WHATSAPP GENERATOR */}
          {activeTab === 'purchase_order' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', height: '100%' }}>
              
              {/* Lista de Artículos a Pedir */}
              <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="bento-card-header">
                  <span className="bento-card-header-title">
                    <ShoppingCart size={18} color="var(--semaforo-verde)" />
                    Detalle de Requerimiento de Compra
                  </span>
                  <span className="badge badge-success">
                    {summaryKpis.countPorComprar} Líneas a Reponer
                  </span>
                </div>

                <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>CÓDIGO</th>
                        <th>DESCRIPCIÓN</th>
                        <th style={{ textAlign: 'center' }}>A PEDIR</th>
                        <th style={{ textAlign: 'right' }}>COSTO</th>
                        <th style={{ textAlign: 'right' }}>SUBTOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reorderMatrixData.filter(i => i.cantidadSugeridaCajas > 0).map(item => (
                        <tr key={item.id}>
                          <td><strong style={{ fontFamily: 'var(--font-code)' }}>{item.codigo}</strong></td>
                          <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.descripcion}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                            {item.cantidadSugeridaCajas} {item.unidad || 'Caj'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>
                            {formatUsd(item.costoUsd || 0)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)' }}>
                            {formatUsd(item.inversionSugeridaUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-table-header)', fontWeight: 800 }}>
                        <td colSpan="2" style={{ textAlign: 'right' }}>TOTALES REQUERIDOS:</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                          {summaryKpis.totalCajasSugeridas} Cajas
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                          {formatUsd(summaryKpis.totalInversionUsd)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Generador de Mensaje WhatsApp */}
              <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '4px solid #25D366' }}>
                <div className="bento-card-header">
                  <span className="bento-card-header-title">
                    <Send size={18} color="#25D366" />
                    Propuesta de Pedido / Cotización WhatsApp
                  </span>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleCopyOrder}
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedOrder ? <Check size={14} color="var(--semaforo-verde)" /> : <Copy size={14} />}
                    {copiedOrder ? 'Copiado al Portapapeles' : 'Copiar Texto'}
                  </button>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <textarea
                    className="form-control"
                    readOnly
                    value={generatedPurchaseOrderText}
                    style={{
                      flex: 1,
                      fontFamily: 'var(--font-code)',
                      fontSize: '0.78rem',
                      lineHeight: '1.45',
                      padding: '0.85rem',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      resize: 'none'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      💡 Pégalo directamente en el chat con tu asesor de planta o refinería.
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={handleCopyOrder}
                      style={{
                        background: '#25D366',
                        borderColor: '#25D366',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Copy size={15} /> Copiar para WhatsApp
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: FORMATO FORMAL IMPRIMIBLE */}
          {activeTab === 'print' && (
            <div style={{ background: '#ffffff', color: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '1000px', margin: '0 auto' }}>
              
              {/* Botón de Impresión en Pantalla */}
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
                    RIF: {config.rif || 'J-30401927-4'} | DISTRIBUIDOR AUTORIZADO DE LUBRICANTES
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {config.direccion || 'Zona Industrial III, Carrera 2 con Calle 4, Barquisimeto / Caracas - Venezuela'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    SOLICITUD DE REPOSICIÓN
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#e60012', fontFamily: 'monospace' }}>
                    REQ-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Fecha: {new Date().toLocaleDateString('es-VE')}
                  </div>
                </div>
              </div>

              {/* Resumen de Parámetros */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Cobertura Deseada:</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{targetCoverageDays} Días</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Lead Time Estimado:</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{leadTimeDays} Días</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Total Unidades / Cajas:</span>
                  <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>{summaryKpis.totalCajasSugeridas} Cajas</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Volumen Estimado:</span>
                  <strong style={{ color: '#002b7a', fontSize: '0.95rem' }}>{summaryKpis.totalLitrosSugeridos.toFixed(1)} Litros</strong>
                </div>
              </div>

              {/* Tabla de Productos para Imprimir */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ background: '#002b7a', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>N°</th>
                    <th style={{ padding: '8px 10px' }}>CÓDIGO</th>
                    <th style={{ padding: '8px 10px' }}>DESCRIPCIÓN DE LUBRICANTE</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>STOCK DISP.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>CANTIDAD A PEDIR</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>COSTO REF. ($)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>TOTAL ($ USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {reorderMatrixData.filter(i => i.cantidadSugeridaCajas > 0).map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace' }}>{item.codigo}</td>
                      <td style={{ padding: '8px 10px' }}>{item.descripcion}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.stockDisponible}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>
                        {item.cantidadSugeridaCajas} {item.unidad || 'Cajas'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                        ${(item.costoUsd || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                        ${item.inversionSugeridaUsd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <td colSpan="4" style={{ padding: '10px', textAlign: 'right' }}>PRESUPUESTO TOTAL ESTIMADO:</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#16a34a' }}>{summaryKpis.totalCajasSugeridas} Cajas</td>
                    <td></td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: '0.95rem', color: '#002b7a' }}>
                      ${summaryKpis.totalInversionUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Firmas Autorizadas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3rem', marginTop: '3rem', paddingTop: '1rem' }}>
                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>GERENCIA DE COMPRAS Y LOGÍSTICA</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SIGNUM MOTORVEN, C.A.</div>
                </div>

                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>APROBACIÓN DEPARTAMENTO FINANCIERO</div>
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
