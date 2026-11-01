import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Warehouse,
  Droplet,
  ShieldAlert,
  Camera,
  Upload,
  Sliders,
  FileSpreadsheet,
  Printer,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  BarChart2,
  Layers,
  X,
  RefreshCw,
  Info,
  FileText,
  ClipboardList,
  Check,
  RotateCcw,
  Download
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import OilstoneProductImage from '../components/OilstoneProductImage';
import { canManageProducts, canViewCosts } from '../services/authService';
import InventoryKardexModal from '../components/InventoryKardexModal';
import SmartReorderMatrixModal from '../components/SmartReorderMatrixModal';
import { uploadImageToStorage, STORAGE_FOLDERS } from '../services/imageStorageService';
import { compressImageToBase64 } from '../services/imageCompression';
import { generateInventoryPDF } from '../services/pdfReportService';

export default function InventoryView({
  products = [],
  config = {},
  inventoryAdjustments = [],
  warehouseTransfers = [],
  profitInvoices = [],
  sales = [],
  profitPurchases = [],
  profitSuppliers = [],
  onSyncProfit,
  onSaveProduct,
  onDeleteProduct,
  globalSearch,
  currentUser,
  warehouses = [],
  productLines = [],
  productCategories = []
}) {
  const canManage = currentUser ? canManageProducts(currentUser.rol) : true;
  const canSeeCosts = currentUser ? canViewCosts(currentUser.rol) : true;
  const totalCols = (canSeeCosts ? 2 : 0) + 9;
  const [searchTerm, setSearchTerm] = useState(globalSearch || '');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [selectedWarehouse, setSelectedWarehouse] = useState('TODOS');
  const [semaforoFilter, setSemaforoFilter] = useState('TODOS'); // 'TODOS' | 'rojo' | 'amarillo' | 'verde'
  const [showModal, setShowModal] = useState(false);
  const [showKardexModal, setShowKardexModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showPhysicalTakeModal, setShowPhysicalTakeModal] = useState(false);
  const [physicalCounts, setPhysicalCounts] = useState({});
  const [isSyncingPhysical, setIsSyncingPhysical] = useState(false);
  const [physicalTakeWarehouse, setPhysicalTakeWarehouse] = useState('TODOS');
  const [auditorName, setAuditorName] = useState(currentUser?.nombre || currentUser?.username || 'Auditor de Almacén');
  const [physicalTakeSearch, setPhysicalTakeSearch] = useState('');
  const [physicalTakeLastSync, setPhysicalTakeLastSync] = useState(new Date().toLocaleTimeString('es-VE'));
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedSpecProduct, setSelectedSpecProduct] = useState(null);

  const categories = [
    'TODAS',
    'Gasolina',
    'Semisintético R500',
    'Diesel 4T',
    'Motos 2T/4T',
    'Fuera de Borda',
    'Transmisiones & ATF',
    'Hidráulicos AW68'
  ];

  // Función Auxiliar: Lógica del Semáforo para Inventario
  const getSemaforoStatus = (stock, min) => {
    if (stock <= min) {
      return { level: 'rojo', text: 'Stock Crítico', color: 'var(--semaforo-rojo)' };
    } else if (stock <= min * 2) {
      return { level: 'amarillo', text: 'Reorden ROP', color: 'var(--semaforo-amarillo)' };
    } else {
      return { level: 'verde', text: 'Óptimo', color: 'var(--semaforo-verde)' };
    }
  };

  // KPIs Consolidados de Inventario en Tiempo Real
  const inventoryKpis = useMemo(() => {
    const totalSkus = products.length;
    const totalCajas = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    const totalLitros = products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.litrosPorUnidad) || 1)), 0);
    const totalValorUsd = products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.costoUsd) || 0)), 0);
    const tasa = Number(config?.tasaDolar || 827.73);
    const totalValorBs = totalValorUsd * tasa;

    let countCriticos = 0;
    let countReorden = 0;
    let countOptimos = 0;

    products.forEach(p => {
      const s = Number(p.stock) || 0;
      const min = Number(p.stockMinimo) || 5;
      if (s <= min) countCriticos++;
      else if (s <= min * 2) countReorden++;
      else countOptimos++;
    });

    return {
      totalSkus,
      totalCajas,
      totalLitros,
      totalValorUsd,
      totalValorBs,
      countCriticos,
      countReorden,
      countOptimos
    };
  }, [products, config]);

  // Filtrado de Productos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const searchLower = (searchTerm || globalSearch || '').toLowerCase();
      const matchesSearch =
        (p.codigo || '').toLowerCase().includes(searchLower) ||
        (p.oem || '').toLowerCase().includes(searchLower) ||
        (p.descripcion || '').toLowerCase().includes(searchLower) ||
        (p.marca || '').toLowerCase().includes(searchLower) ||
        (p.viscosidad && p.viscosidad.toLowerCase().includes(searchLower));

      const matchesCat = selectedCategory === 'TODAS' ||
        p.categoria === selectedCategory ||
        (p.categoria && p.categoria.toLowerCase().includes(selectedCategory.toLowerCase())) ||
        (selectedCategory.toLowerCase().includes(p.categoria?.toLowerCase() || '___'));

      const sem = getSemaforoStatus(Number(p.stock) || 0, Number(p.stockMinimo) || 5);
      const matchesSemaforo = semaforoFilter === 'TODOS' || sem.level === semaforoFilter;

      const normSelW = String(selectedWarehouse || '').replace(/^ALM-/, '').toLowerCase();
      const matchesWarehouse = selectedWarehouse === 'TODOS' ||
        normSelW === '01' ||
        (p.almacen && p.almacen.toLowerCase().includes(normSelW)) ||
        (p.coAlm && String(p.coAlm).toLowerCase().includes(normSelW)) ||
        (p.ubicacion && p.ubicacion.toLowerCase().includes(normSelW));

      return matchesSearch && matchesCat && matchesSemaforo && matchesWarehouse;
    });
  }, [products, searchTerm, globalSearch, selectedCategory, semaforoFilter, selectedWarehouse]);

  // Sincronizar en tiempo real para Toma Física
  const handleSyncPhysicalStock = async () => {
    if (!onSyncProfit) return;
    setIsSyncingPhysical(true);
    try {
      await onSyncProfit();
      setPhysicalTakeLastSync(new Date().toLocaleTimeString('es-VE'));
    } catch (err) {
      console.error('Error al sincronizar stock en tiempo real:', err);
    } finally {
      setIsSyncingPhysical(false);
    }
  };

  // Filtrado de productos para Toma Física (por Almacén y Búsqueda interna)
  const targetPhysicalProducts = useMemo(() => {
    return products.filter(p => {
      const searchLower = (physicalTakeSearch || '').toLowerCase();
      const matchesSearch = !searchLower ||
        (p.codigo || '').toLowerCase().includes(searchLower) ||
        (p.descripcion || '').toLowerCase().includes(searchLower) ||
        (p.ubicacion && p.ubicacion.toLowerCase().includes(searchLower));

      const matchesWh = physicalTakeWarehouse === 'TODOS' ||
        (p.almacen && p.almacen.toLowerCase().includes(physicalTakeWarehouse.toLowerCase())) ||
        (p.coAlm && p.coAlm === physicalTakeWarehouse) ||
        (p.ubicacion && p.ubicacion.toLowerCase().includes(physicalTakeWarehouse.toLowerCase()));

      return matchesSearch && matchesWh;
    });
  }, [products, physicalTakeSearch, physicalTakeWarehouse]);

  // Métricas y balance de la Toma Física en vivo
  const physicalTakeMetrics = useMemo(() => {
    let countAuditados = 0;
    let countCuadrados = 0;
    let countDescuadres = 0;
    let totalCajasContadas = 0;
    let totalCajasSistema = 0;
    let totalLitrosSistema = 0;

    targetPhysicalProducts.forEach(p => {
      const sysStock = Number(p.stock) || 0;
      totalCajasSistema += sysStock;
      totalLitrosSistema += sysStock * (Number(p.litrosPorUnidad) || 12);

      const key = p.codigo || p.id;
      const count = physicalCounts[key];
      if (count !== undefined && count !== '') {
        countAuditados++;
        const numCount = Number(count);
        totalCajasContadas += numCount;
        const diff = numCount - sysStock;
        if (diff === 0) countCuadrados++;
        else countDescuadres++;
      }
    });

    return {
      totalSkus: targetPhysicalProducts.length,
      countAuditados,
      countCuadrados,
      countDescuadres,
      totalCajasContadas,
      totalCajasSistema,
      totalLitrosSistema
    };
  }, [targetPhysicalProducts, physicalCounts]);

  const handleAutoFillCounts = () => {
    const counts = {};
    targetPhysicalProducts.forEach(p => {
      counts[p.codigo || p.id] = Number(p.stock) || 0;
    });
    setPhysicalCounts(counts);
  };

  const handleClearCounts = () => {
    setPhysicalCounts({});
  };

  const handleExportPhysicalTakeCsv = () => {
    const filename = `toma_fisica_inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = ['Codigo', 'Descripcion', 'Ubicacion', 'Stock_Sistema_Cajas', 'Conteo_Fisico_Cajas', 'Diferencia_Cajas', 'Estado_Cuadre'];
    const rows = targetPhysicalProducts.map(p => {
      const key = p.codigo || p.id;
      const sysStock = Number(p.stock) || 0;
      const count = physicalCounts[key] !== undefined && physicalCounts[key] !== '' ? Number(physicalCounts[key]) : '';
      const diff = count !== '' ? count - sysStock : '';
      const status = count === '' ? 'PENDIENTE' : diff === 0 ? 'CUADRADO' : diff < 0 ? `FALTANTE_${diff}` : `SOBRANTE_+${diff}`;
      return [
        `"${p.codigo || ''}"`,
        `"${(p.descripcion || '').replace(/"/g, '""')}"`,
        `"${p.ubicacion || 'Palet A-01'}"`,
        sysStock,
        count !== '' ? count : 'NO_CONTADO',
        diff !== '' ? diff : 0,
        status
      ].join(';');
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exportar Catálogo a CSV / Excel
  const handleExportCsv = () => {
    const filename = `inventario_lubricantes_signum_motorven_${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = [
      'Codigo',
      'OEM',
      'Descripcion',
      'Categoria',
      'Viscosidad',
      'Marca',
      'Ubicacion',
      'Stock_Cajas',
      'Unidad',
      'Litros_Totales',
      'Stock_Minimo',
      'Estado_Semaforo',
      'Costo_USD',
      'Precio_Detal_USD',
      'Precio_Mayor_USD'
    ];

    const rows = filteredProducts.map(p => {
      const sem = getSemaforoStatus(Number(p.stock) || 0, Number(p.stockMinimo) || 5);
      const litros = ((Number(p.stock) || 0) * (Number(p.litrosPorUnidad) || 1)).toFixed(1);
      return [
        `"${p.codigo}"`,
        `"${p.oem || ''}"`,
        `"${(p.descripcion || '').replace(/"/g, '""')}"`,
        `"${p.categoria || ''}"`,
        `"${p.viscosidad || ''}"`,
        `"${p.marca || ''}"`,
        `"${p.ubicacion || ''}"`,
        p.stock,
        `"${p.unidad || 'Caja'}"`,
        litros,
        p.stockMinimo || 5,
        `"${sem.text}"`,
        (p.costoUsd || 0).toFixed(2),
        (p.precioUsdDetal || 0).toFixed(2),
        (p.precioUsdMayor || 0).toFixed(2)
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenModal = (product = null) => {
    if (!canManage) return;
    if (product) {
      setEditingProduct(product);
    } else {
      setEditingProduct({
        codigo: '',
        oem: '',
        descripcion: '',
        marca: 'Motorven Lubricants',
        categoria: 'Gasolina',
        viscosidad: '20W-50 Mineral',
        ubicacion: 'Pasillo A - Palet 01',
        unidad: 'Caja (12L)',
        litrosPorUnidad: 11.35,
        stock: 20,
        comprometido: 0,
        stockMinimo: 5,
        costoUsd: 28.0,
        precioUsdDetal: 48.0,
        precioUsdMayor: 40.0,
        aplicaIva: true,
        imagen: ''
      });
    }
    setShowModal(true);
  };

  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingStatus, setSavingStatus] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadingImage(true);
      try {
        // 1. Convertir y optimizar la imagen de producto directamente a formato Base64
        const compressed = await compressImageToBase64(file, {
          maxWidth: 900,
          maxHeight: 900,
          quality: 0.85
        });
        const base64Data = compressed.dataUrl;

        // 2. Establecer la imagen directamente como Base64 para guardarla en Supabase
        setEditingProduct(prev => ({
          ...prev,
          imagen: base64Data
        }));

        // 3. Respaldo opcional en Supabase Storage en segundo plano (sin bloquear modal)
        const prodCode = editingProduct.codigo || editingProduct.id || 'prod';
        uploadImageToStorage(base64Data, STORAGE_FOLDERS.PRODUCTS, `prod_${prodCode}`).catch(storageErr => {
          console.warn('Respaldo en Storage opcional:', storageErr);
        });
      } catch (err) {
        console.warn('Error convirtiendo imagen de producto a Base64:', err);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSavingStatus({ saving: true, message: 'Guardando en Supabase y Profit Plus (art)...' });
    try {
      const saved = await onSaveProduct(editingProduct);
      if (saved && saved._comparison) {
        setSavingStatus({
          saving: false,
          success: true,
          message: '✅ Sincronizado y Comparado: Profit Plus [art] y Supabase 100% coincidentes.'
        });
        setTimeout(() => {
          setShowModal(false);
          setSavingStatus(null);
        }, 1200);
      } else {
        setSavingStatus({
          saving: false,
          success: true,
          message: '✅ Lubricante guardado exitosamente.'
        });
        setTimeout(() => {
          setShowModal(false);
          setSavingStatus(null);
        }, 800);
      }
    } catch (err) {
      setSavingStatus({
        saving: false,
        success: false,
        message: 'Error al persistir el lubricante. Verifique la conexión.'
      });
    }
  };

  return (
    <div>
      {/* Encabezado del Módulo */}
      <div className="page-header-responsive" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Droplet size={28} color="var(--neon-cyan)" /> Catálogo de Lubricantes & Matriz de Inventario
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Control con semáforo inteligente ROP (🟢 Óptimo | 🟡 Reorden | 🔴 Crítico) • Oilstone ® / Grupo Motorven
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* BOTÓN MATRIZ DE REORDEN */}
          <button
            className="btn btn-secondary"
            onClick={() => setShowReorderModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, rgba(230, 0, 18, 0.15), rgba(0, 43, 122, 0.25))',
              border: '1px solid rgba(230, 0, 18, 0.4)',
              color: '#f87171',
              fontWeight: 700
            }}
            title="Matriz predictiva de reorden ROP y pronóstico de quiebre de inventario para pedidos a planta"
          >
            <Sliders size={16} color="var(--motorven-red)" /> Matriz Reorden & Quiebres
          </button>

          {/* BOTÓN KARDEX */}
          <button
            className="btn btn-secondary"
            onClick={() => setShowKardexModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(0, 43, 122, 0.25))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              fontWeight: 700
            }}
            title="Ver Kardex Físico, Mermas, Ajustes y Traslados sincronizados desde Profit Plus"
          >
            <BarChart2 size={16} /> Kardex & Mermas ({inventoryAdjustments.length + warehouseTransfers.length})
          </button>

          {/* BOTÓN EXPORTAR CSV */}
          <button
            className="btn btn-secondary"
            onClick={handleExportCsv}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
            title="Exportar inventario detallado en tiempo real a CSV / Excel"
          >
            <FileSpreadsheet size={15} color="#0284c7" /> Exportar CSV de inventario detallado en tiempo real
          </button>

          {/* BOTÓN HOJA DE TOMA FÍSICA */}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowPhysicalTakeModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
            title="Abrir hoja de toma física y conteo de inventario"
          >
            <ClipboardList size={15} color="#38bdf8" /> Hoja de Toma Física
          </button>

          {canManage ? (
            <button className="btn btn-secondary" onClick={() => handleOpenModal()} style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Cargar Nuevo Lubricante
            </button>
          ) : (
            <div style={{ fontSize: '0.8rem', background: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.25)', fontWeight: 600 }}>
              👁️ Catálogo Comercial
            </div>
          )}

          {/* BOTÓN IMPRIMIR REPORTE (ALINEADO A LA DERECHA, ROJO MOTORVEN) */}
          <button
            className="btn btn-print-report"
            onClick={() => generateInventoryPDF({ products: filteredProducts, config, currentUser, kpis: inventoryKpis })}
            style={{ marginLeft: 'auto' }}
            title="Descargar Reporte Oficial de Inventario y Valorización en PDF"
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS DE INVENTARIO */}
      <div className="inventory-kpi-grid">
        {/* KPI 1: VOLUMEN TOTAL */}
        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Volumen en Bodega
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Oilstone ®</span>
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = './Ficha_Tecnica_KPI_Volumen_en_Bodega.pdf';
                  link.download = 'Ficha_Tecnica_KPI_Volumen_en_Bodega.pdf';
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '2px 7px',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(2, 132, 199, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8'
                }}
                title="Descargar Ficha Técnica Oficial y Auditoría en PDF del KPI Volumen en Bodega"
              >
                <Download size={11} /> PDF
              </button>
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)' }}>
            {inventoryKpis.totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 1 })} L
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
            ≈ {inventoryKpis.totalCajas} Cajas ({inventoryKpis.totalSkus} SKUs activos)
          </div>
        </div>

        {/* KPI 2: VALORIZACIÓN */}
        {canSeeCosts && (
          <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Valorización de Inventario
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Costo Almacén</span>
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
              {formatUsd(inventoryKpis.totalValorUsd)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
              {formatBs(inventoryKpis.totalValorBs)}
            </div>
          </div>
        )}

        {/* KPI 3: SALUD DEL SEMÁFORO */}
        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Salud del Stock (Semáforo)
            </span>
            <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Rotación ROP</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSemaforoFilter(semaforoFilter === 'rojo' ? 'TODOS' : 'rojo')}
              style={{
                background: semaforoFilter === 'rojo' ? 'var(--motorven-red)' : 'rgba(230, 0, 18, 0.12)',
                color: semaforoFilter === 'rojo' ? '#fff' : 'var(--motorven-red)',
                border: '1px solid rgba(230, 0, 18, 0.3)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title="Filtrar lubricantes en Stock Crítico"
            >
              🔴 {inventoryKpis.countCriticos} Críticos
            </button>
            <button
              onClick={() => setSemaforoFilter(semaforoFilter === 'amarillo' ? 'TODOS' : 'amarillo')}
              style={{
                background: semaforoFilter === 'amarillo' ? '#ca8a04' : 'rgba(245, 158, 11, 0.12)',
                color: semaforoFilter === 'amarillo' ? '#fff' : 'var(--motorven-gold)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title="Filtrar lubricantes en Punto de Reorden"
            >
              🟡 {inventoryKpis.countReorden} Reorden
            </button>
            <button
              onClick={() => setSemaforoFilter(semaforoFilter === 'verde' ? 'TODOS' : 'verde')}
              style={{
                background: semaforoFilter === 'verde' ? 'var(--semaforo-verde)' : 'rgba(16, 185, 129, 0.12)',
                color: semaforoFilter === 'verde' ? '#fff' : 'var(--semaforo-verde)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title="Filtrar lubricantes en Nivel Óptimo"
            >
              🟢 {inventoryKpis.countOptimos} Óptimos
            </button>
          </div>
        </div>

        {/* KPI 4: ACCESO RÁPIDO PEDIDOS A PLANTA */}
        <div
          className="kpi-card-modern"
          onClick={() => setShowReorderModal(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.15) 0%, rgba(2, 132, 199, 0.12) 100%)',
            border: '1px solid rgba(2, 132, 199, 0.35)',
            borderRadius: '14px',
            padding: '1.15rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--motorven-navy-light)', textTransform: 'uppercase' }}>
              Pedidos a Planta
            </span>
            <Sliders size={16} color="var(--motorven-navy-light)" />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              Matriz ROP Activa
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {inventoryKpis.countCriticos + inventoryKpis.countReorden > 0
                ? `🚨 ${inventoryKpis.countCriticos + inventoryKpis.countReorden} SKUs requieren reposición`
                : '✅ Cobertura adecuada'}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros & Barra de Búsqueda */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-glass)', width: '100%', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-wrapper" style={{ flex: 1, minWidth: 'min(100%, 280px)', maxWidth: '480px' }}>
            <Search size={16} />
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '0.84rem', height: '38px' }}
              placeholder="Buscar por Código, Viscosidad (20W-50, 10W-30), Marca o Descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Filtro por Almacén Profit Plus */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Warehouse size={16} color="var(--neon-cyan)" />
              <select
                className="form-control filter-select"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                style={{ width: '210px', height: '38px', fontSize: '0.82rem' }}
              >
                <option value="TODOS">Todos los Almacenes ({warehouses.length || 3})</option>
                {(warehouses.length > 0 ? warehouses : [
                  { coAlm: 'ALM-01', desAlm: 'Almacén Principal Mostrador' },
                  { coAlm: 'ALM-02', desAlm: 'Almacén Bóveda de Lubricantes' },
                  { coAlm: 'ALM-03', desAlm: 'Almacén en Tránsito / Ruta' }
                ]).map((w) => (
                  <option key={w.id || w.coAlm} value={w.coAlm}>
                    {w.coAlm} - {w.desAlm}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="var(--motorven-gold)" />
              <select
                className="form-control filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: '220px', height: '38px', fontSize: '0.82rem' }}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {semaforoFilter !== 'TODOS' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSemaforoFilter('TODOS')}
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> Quitar Filtro Semáforo ({semaforoFilter})
              </button>
            )}
          </div>
        </div>

        {/* Chips de Almacenes y Líneas Profit Plus */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Almacenes Profit:
          </span>
          {(warehouses.length > 0 ? warehouses : [
            { coAlm: 'ALM-01', desAlm: 'Principal Mostrador' },
            { coAlm: 'ALM-02', desAlm: 'Bóveda Lubricantes' },
            { coAlm: 'ALM-03', desAlm: 'Tránsito / Ruta' }
          ]).map((w) => {
            const isSelected = selectedWarehouse === w.coAlm;
            return (
              <button
                key={w.coAlm}
                type="button"
                onClick={() => setSelectedWarehouse(isSelected ? 'TODOS' : w.coAlm)}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 9px',
                  borderRadius: '20px',
                  border: isSelected ? '1px solid var(--neon-cyan)' : '1px solid var(--border-glass)',
                  background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-card)',
                  color: isSelected ? 'var(--neon-cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600
                }}
              >
                <Warehouse size={12} /> {w.coAlm}: {w.desAlm}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla de Productos con Semáforo */}
      <div className="card table-card-wrapper" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px', width: '100%', minWidth: 0, maxWidth: '100%' }}>
        <div className="table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="custom-table table-wide" style={{ fontSize: '0.82rem', width: '100%', minWidth: '1120px' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Semáforo</th>
                <th style={{ textAlign: 'center', width: '56px' }}>Imagen</th>
                <th>Código / OEM</th>
                <th>Lubricante & Viscosidad</th>
                <th>Presentación & Ubicación</th>
                <th style={{ textAlign: 'center' }}>Stock & Litros</th>
                {canSeeCosts && <th style={{ textAlign: 'right' }}>Costo Unit. ($)</th>}
                <th style={{ textAlign: 'right' }}>Precio Detal ($ / Bs)</th>
                <th style={{ textAlign: 'right' }}>Precio Mayor ($)</th>
                {canSeeCosts && <th style={{ textAlign: 'center' }}>Margen Detal</th>}
                <th style={{ textAlign: 'center' }} className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No se encontraron lubricantes con los criterios especificados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const sem = getSemaforoStatus(Number(p.stock) || 0, Number(p.stockMinimo) || 5);
                  const precioUsdDetal = Number(p.precioUsdDetal ?? p.precio_usd_detal ?? p.precio ?? p.precioVenta ?? 0);
                  const precioUsdMayor = Number(p.precioUsdMayor ?? p.precio_usd_mayor ?? p.precioMayor ?? precioUsdDetal);
                  const precioBsDetal = precioUsdDetal * (Number(config?.tasaDolar) || 886.22);
                  const costoUsd = Number(p.costoUsd ?? p.costo_usd ?? p.costo ?? 0);
                  const totalLitrosStock = ((Number(p.stock) || 0) * (Number(p.litrosPorUnidad) || 1)).toFixed(1);

                  return (
                    <tr key={p.id || p.codigo}>
                      {/* Indicador de Semáforo */}
                      <td>
                        <span className={`semaforo-indicator ${sem.level}`}>
                          <span className="semaforo-dot"></span>
                          {sem.text}
                        </span>
                      </td>

                      {/* Imagen del Producto */}
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', width: '56px' }}>
                        <div
                          onClick={() => setSelectedSpecProduct(p)}
                          title="Clic para ver Ficha Técnica y Envase"
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: 'var(--surface-input)',
                            border: '1px solid var(--border-glass)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                            cursor: 'pointer'
                          }}
                        >
                          <OilstoneProductImage product={p} productId={p.id} imagen={p.imagen} width="100%" height="100%" />
                        </div>
                      </td>

                      <td>
                        <strong style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)', fontSize: '0.85rem' }}>{p.codigo}</strong>
                        <div style={{ fontSize: '0.725rem', color: 'var(--motorven-gold)' }}>OEM: {p.oem || 'N/A'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{p.descripcion}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Droplet size={12} /> Viscosidad: <strong>{p.viscosidad || 'N/A'}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{p.marca}</span>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Warehouse size={12} /> {p.ubicacion || 'Almacén Principal'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '1rem', color: sem.color, fontFamily: 'var(--font-tech)' }}>
                            {p.stock}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.unidad || 'Caj'}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)', fontWeight: 600, fontFamily: 'var(--font-code)' }}>
                          ({totalLitrosStock} L Totales)
                        </div>
                      </td>

                      {/* Costo Unitario (Solo Administrador / Gerencia) */}
                      {canSeeCosts && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-tech)' }}>
                            {formatUsd(costoUsd)}
                          </div>
                        </td>
                      )}

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--motorven-emerald)', fontFamily: 'var(--font-tech)' }}>
                          {formatUsd(precioUsdDetal)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                          {formatBs(precioBsDetal)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-tech)' }}>{formatUsd(precioUsdMayor)}</strong>
                      </td>

                      {/* Margen Detal */}
                      {canSeeCosts && (
                        <td style={{ textAlign: 'center' }}>
                          {p.costoUsd > 0 ? (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: p.precioUsdDetal > p.costoUsd ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: p.precioUsdDetal > p.costoUsd ? '#34d399' : '#f87171'
                              }}
                            >
                              +{(((p.precioUsdDetal - p.costoUsd) / p.costoUsd) * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>-</span>
                          )}
                        </td>
                      )}

                      <td style={{ textAlign: 'center' }} className="col-acciones">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {canManage && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(p)} title="Editar Lubricante" style={{ padding: '3px 7px' }}>
                              <Edit2 size={13} />
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedSpecProduct(p)}
                            title="Ficha Técnica & Calidad ASTM"
                            style={{ color: 'var(--motorven-cyan, #00f0ff)', padding: '3px 7px' }}
                          >
                            <Info size={13} />
                          </button>
                          {canManage && (
                            <button className="btn btn-secondary btn-sm" onClick={() => onDeleteProduct(p.id)} title="Eliminar" style={{ color: 'var(--motorven-red)', padding: '3px 7px' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Creación / Edición de Producto */}
      {showModal && editingProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} color="var(--motorven-gold)" />
                {editingProduct.id ? 'Editar Lubricante' : 'Cargar Nuevo Lubricante'}
              </h2>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Código Interno</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingProduct.codigo}
                    onChange={(e) => setEditingProduct({ ...editingProduct, codigo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Código OEM / Referencia</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingProduct.oem}
                    onChange={(e) => setEditingProduct({ ...editingProduct, oem: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción Oficial del Producto</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingProduct.descripcion}
                  onChange={(e) => setEditingProduct({ ...editingProduct, descripcion: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Marca</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingProduct.marca}
                    onChange={(e) => setEditingProduct({ ...editingProduct, marca: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    className="form-control"
                    value={editingProduct.categoria}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoria: e.target.value })}
                  >
                    {categories.filter(c => c !== 'TODAS').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Viscosidad</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej. 15W-40, 20W-50"
                    value={editingProduct.viscosidad}
                    onChange={(e) => setEditingProduct({ ...editingProduct, viscosidad: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ubicación en Almacén</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingProduct.ubicacion}
                    onChange={(e) => setEditingProduct({ ...editingProduct, ubicacion: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Presentación / Unidad</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingProduct.unidad}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unidad: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Litros por Unidad (Caja/Tambor)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={editingProduct.litrosPorUnidad}
                    onChange={(e) => setEditingProduct({ ...editingProduct, litrosPorUnidad: parseFloat(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Stock Actual (Cajas/Unidades)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Mínimo (Alerta Crítica)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editingProduct.stockMinimo}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stockMinimo: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              {/* Imagen del Producto */}
              <div className="form-group" style={{ background: 'rgba(0, 43, 122, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)', marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={16} /> Fotografía / Envase del Lubricante
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                  {editingProduct.imagen ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={editingProduct.imagen}
                        alt="Preview"
                        style={{
                          maxWidth: '120px',
                          maxHeight: '120px',
                          borderRadius: '10px',
                          objectFit: 'contain',
                          border: '1px solid var(--border-glass)',
                          boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingProduct({ ...editingProduct, imagen: '' })}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: 'var(--accent-rose)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                      Sin imagen externa cargada. Se mostrará el envase oficial vectorizado Oilstone ®.
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => document.getElementById('product-image-file').click()}
                      disabled={uploadingImage}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Camera size={14} /> {uploadingImage ? 'Procesando...' : 'Cargar Imagen'}
                    </button>
                    {uploadingImage && (
                      <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 600 }}>
                        ☁️ Convirtiendo a Base64 para Supabase...
                      </span>
                    )}
                    {!uploadingImage && editingProduct.imagen && (
                      <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600 }}>
                        ✅ Imagen en Base64 (Lista para Supabase; excluida de Profit)
                      </span>
                    )}
                  </div>

                  <input
                    type="file"
                    id="product-image-file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className="form-row" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem' }}>
                <div className="form-group">
                  <label className="form-label">Costo ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={editingProduct.costoUsd}
                    onChange={(e) => setEditingProduct({ ...editingProduct, costoUsd: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio Detal ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={editingProduct.precioUsdDetal}
                    onChange={(e) => setEditingProduct({ ...editingProduct, precioUsdDetal: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio Mayor ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={editingProduct.precioUsdMayor}
                    onChange={(e) => setEditingProduct({ ...editingProduct, precioUsdMayor: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              {savingStatus && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                  background: savingStatus.success ? 'rgba(16, 185, 129, 0.15)' : (savingStatus.saving ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                  border: `1px solid ${savingStatus.success ? 'rgba(16, 185, 129, 0.4)' : (savingStatus.saving ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.4)')}`,
                  color: savingStatus.success ? '#10b981' : (savingStatus.saving ? '#38bdf8' : '#f87171'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {savingStatus.saving && <div className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px' }} />}
                  <span>{savingStatus.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={savingStatus?.saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingStatus?.saving}>
                  {savingStatus?.saving ? 'Sincronizando & Comparando...' : 'Guardar Lubricante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Hoja de Toma Física de Inventario en Tiempo Real */}
      {showPhysicalTakeModal && (
        <div className="modal-overlay" onClick={() => setShowPhysicalTakeModal(false)}>
          <div
            className="physical-take-sheet-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. ENCABEZADO FORMAL CON LOGO Y SINCRONIZACIÓN EN VIVO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #002b7a', paddingBottom: '1rem', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={26} color="#002b7a" />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#002b7a', letterSpacing: '-0.02em' }}>
                      {config?.nombreEmpresa || 'DISTRIBUIDORA SIGNUM MOTORVEN C.A.'}
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>
                      RIF: {config?.rif || 'J-40892341-0'} • AUDITORÍA DE INVENTARIO FÍSICO, ALMACÉN & CONCILIACIÓN
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', padding: '4px 10px', background: '#dbeafe', color: '#1e40af', fontWeight: 800, borderRadius: '6px', fontSize: '0.78rem' }}>
                    HOJA DE CONTEO FÍSICO EN VIVO
                  </span>
                  <button
                    onClick={handleSyncPhysicalStock}
                    disabled={isSyncingPhysical}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderColor: '#94a3b8', color: '#0f172a', background: '#f8fafc' }}
                    title="Recargar inventario real desde Profit Plus / Base de Datos"
                  >
                    <RefreshCw size={13} className={isSyncingPhysical ? 'animate-spin' : ''} color="#0284c7" />
                    <span>{isSyncingPhysical ? 'Sincronizando...' : 'Sincronizar Stock'}</span>
                  </button>
                  <button
                    onClick={() => setShowPhysicalTakeModal(false)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px 6px', fontSize: '1.2rem', fontWeight: 700 }}
                    title="Cerrar ventana"
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b' }}>
                  Fecha: {new Date().toLocaleDateString('es-VE')} • Última Sinc: {physicalTakeLastSync}
                </div>
              </div>
            </div>

            {/* 2. DATOS DE LA AUDITORÍA, ALMACÉN Y RESPONSABLE */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase' }}>
                  Almacén / Depósito a Auditar:
                </label>
                <select
                  value={physicalTakeWarehouse}
                  onChange={(e) => setPhysicalTakeWarehouse(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  <option value="TODOS">Todos los Almacenes (Consolidado General)</option>
                  <option value="Almacén Principal">Almacén Principal / Depósito Barquisimeto</option>
                  <option value="01">Depósito Central (Código 01)</option>
                  <option value="02">Depósito Secundario / Tránsito (Código 02)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase' }}>
                  Auditor / Responsable del Conteo:
                </label>
                <input
                  type="text"
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  placeholder="Nombre y Apellido del Auditor"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontWeight: 700, fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '3px', textTransform: 'uppercase' }}>
                  Filtrar Producto / Ubicación:
                </label>
                <input
                  type="text"
                  value={physicalTakeSearch}
                  onChange={(e) => setPhysicalTakeSearch(e.target.value)}
                  placeholder="Buscar por código, descripción o palet..."
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* 3. RESUMEN DE PROGRESO DE LA AUDITORÍA EN TIEMPO REAL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total SKUs</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#002b7a' }}>{physicalTakeMetrics.totalSkus}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Ítems en catálogo</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Stock en Sistema</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>{physicalTakeMetrics.totalCajasSistema.toLocaleString()} Caj</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>≈ {physicalTakeMetrics.totalLitrosSistema.toLocaleString()} Lts</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cajas Contadas</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0284c7' }}>{physicalTakeMetrics.totalCajasContadas.toLocaleString()} Caj</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{physicalTakeMetrics.countAuditados} de {physicalTakeMetrics.totalSkus} contados</div>
              </div>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase' }}>SKUs Cuadrados</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669' }}>{physicalTakeMetrics.countCuadrados}</div>
                <div style={{ fontSize: '0.72rem', color: '#047857' }}>Diferencia = 0</div>
              </div>

              <div style={{ background: physicalTakeMetrics.countDescuadres > 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${physicalTakeMetrics.countDescuadres > 0 ? '#fecaca' : '#e2e8f0'}`, borderRadius: '10px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: physicalTakeMetrics.countDescuadres > 0 ? '#b91c1c' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Discrepancias</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: physicalTakeMetrics.countDescuadres > 0 ? '#dc2626' : '#64748b' }}>{physicalTakeMetrics.countDescuadres}</div>
                <div style={{ fontSize: '0.72rem', color: physicalTakeMetrics.countDescuadres > 0 ? '#b91c1c' : '#64748b' }}>Mermas / Sobrantes</div>
              </div>
            </div>

            {/* 4. BARRA DE ACCIONES RÁPIDAS DE CONTEO */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAutoFillCounts}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  title="Copiar las existencias del sistema en el conteo para auditoría rápida por excepción"
                >
                  <Check size={13} color="#059669" /> Rellenar Todo con Stock Sistema
                </button>
                <button
                  type="button"
                  onClick={handleClearCounts}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  title="Limpiar todos los conteos ingresados"
                >
                  <RotateCcw size={13} /> Limpiar Conteos
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportPhysicalTakeCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  title="Descargar datos de la toma física y diferencias en CSV / Excel"
                >
                  <Download size={13} color="#0284c7" /> Exportar CSV
                </button>
              </div>
            </div>

            {/* 5. TABLA DE CONTEO FÍSICO INTERACTIVO */}
            <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '10px', marginBottom: '1.5rem', maxHeight: '42vh' }}>
              <table className="physical-take-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>CÓDIGO</th>
                    <th>DESCRIPCIÓN LUBRICANTE</th>
                    <th style={{ width: '130px' }}>UBICACIÓN</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>STOCK SISTEMA</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>CONTEO FÍSICO</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>DIFERENCIA</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {targetPhysicalProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No se encontraron lubricantes que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    targetPhysicalProducts.map((p, idx) => {
                      const key = p.codigo || p.id;
                      const sysStock = Number(p.stock) || 0;
                      const rawCount = physicalCounts[key];
                      const hasCount = rawCount !== undefined && rawCount !== '';
                      const countNum = hasCount ? Number(rawCount) : null;
                      const diff = hasCount ? countNum - sysStock : null;

                      return (
                        <tr key={key || idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#002b7a' }}>
                            {p.codigo}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.descripcion}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {p.marca || 'Oilstone ®'} • {p.viscosidad || 'Lubricante'} • {p.categoria || 'Motor'}
                            </div>
                          </td>
                          <td style={{ color: '#475569', fontSize: '0.75rem' }}>
                            {p.ubicacion || 'Palet A-01'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                            {sysStock} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{p.unidad || 'Caj'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={rawCount ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPhysicalCounts(prev => ({
                                    ...prev,
                                    [key]: val === '' ? '' : Math.max(0, Number(val))
                                  }));
                                }}
                                placeholder="0"
                                className="physical-take-input"
                              />
                              <button
                                type="button"
                                onClick={() => setPhysicalCounts(prev => ({ ...prev, [key]: sysStock }))}
                                title="Copiar stock sistema"
                                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px 5px', cursor: 'pointer', fontSize: '0.65rem', color: '#0284c7', fontWeight: 700 }}
                              >
                                =
                              </button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
                            {hasCount ? (
                              diff === 0 ? (
                                <span style={{ color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                                  ✓ 0 Caj
                                </span>
                              ) : diff < 0 ? (
                                <span style={{ color: '#dc2626', background: '#fef2f2', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                                  {diff} Caj (Faltante)
                                </span>
                              ) : (
                                <span style={{ color: '#d97706', background: '#fffbeb', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                                  +{diff} Caj (Sobrante)
                                </span>
                              )
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>
                                [ Sin Conteo ]
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {hasCount ? (
                              diff === 0 ? (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669' }}>CUADRADO</span>
                              ) : (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: diff < 0 ? '#dc2626' : '#d97706' }}>
                                  {diff < 0 ? 'FALTANTE' : 'SOBRANTE'}
                                </span>
                              )
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>POR AUDITAR</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 6. FIRMAS LEGALES DE AUDITORÍA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.75rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1.5px solid #0f172a', height: '28px', marginBottom: '4px' }}></div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{auditorName || 'Auditor de Almacén'}</div>
                <div style={{ color: '#64748b' }}>Firma y Sello de Auditoría Física</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1.5px solid #0f172a', height: '28px', marginBottom: '4px' }}></div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>Jefe de Almacén / Gerencia de Operaciones</div>
                <div style={{ color: '#64748b' }}>Conforme y Validación de Ajustes</div>
              </div>
            </div>

            {/* 7. BOTONES DE ACCIÓN (CERRAR & IMPRIMIR REPORTE ROJO MOTORVEN) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPhysicalTakeModal(false)}
                style={{ padding: '6px 16px', fontSize: '0.85rem' }}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-print-report"
                onClick={() => generateInventoryPDF({
                  products: targetPhysicalProducts,
                  config,
                  currentUser,
                  kpis: inventoryKpis,
                  isPhysicalTake: true,
                  physicalCounts,
                  warehouseName: physicalTakeWarehouse === 'TODOS' ? 'Todos los Almacenes' : physicalTakeWarehouse,
                  auditorName
                })}
                title="Generar y descargar el Reporte Oficial de Toma Física en PDF"
              >
                <Printer size={15} color="#ffffff" /> Imprimir Reporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Kardex Físico, Mermas & Ajustes de Inventario */}
      <InventoryKardexModal
        isOpen={showKardexModal}
        onClose={() => setShowKardexModal(false)}
        adjustments={inventoryAdjustments}
        transfers={warehouseTransfers}
        products={products}
        config={config}
        currentUser={currentUser}
        onSyncProfit={onSyncProfit}
      />

      {/* Modal de Matriz de Reorden Inteligente & Pronóstico de Quiebre */}
      <SmartReorderMatrixModal
        isOpen={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        products={products}
        profitInvoices={profitInvoices}
        sales={sales}
        profitPurchases={profitPurchases}
        profitSuppliers={profitSuppliers}
        config={config}
        currentUser={currentUser}
        tasaBcv={config?.tasaDolar || 827.73}
        onSaveProduct={onSaveProduct}
      />
      {/* Modal Ficha Técnica ASTM del Lubricante & Envase Oficial */}
      {selectedSpecProduct && (
        <div className="modal-overlay" onClick={() => setSelectedSpecProduct(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '680px',
              width: '95%',
              maxHeight: '92vh',
              overflowY: 'auto',
              borderRadius: '16px'
            }}
          >
            {/* Cabecera del Modal */}
            <div className="modal-header" style={{ paddingBottom: '0.85rem' }}>
              <h3 className="modal-title" style={{ color: 'var(--neon-cyan, #00f0ff)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                <Info size={20} />
                <span>Ficha Técnica & Envase Oficial — OILSTONE ®</span>
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedSpecProduct(null)}
                title="Cerrar Ficha Técnica"
              >
                ×
              </button>
            </div>

            {/* SECCIÓN PRINCIPAL: IMAGEN OFICIAL + METADATOS COMERCIALES */}
            <div
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'center',
                background: 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                border: '1px solid var(--border-glass)',
                borderRadius: '14px',
                padding: '1.15rem',
                marginBottom: '1rem',
                flexWrap: 'wrap'
              }}
            >
              {/* Imagen del Producto en Envase Oficial */}
              <div
                style={{
                  width: '170px',
                  height: '190px',
                  minWidth: '150px',
                  margin: '0 auto',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                }}
              >
                <OilstoneProductImage
                  product={selectedSpecProduct}
                  productId={selectedSpecProduct.id}
                  imagen={selectedSpecProduct.imagen}
                  width="100%"
                  height="100%"
                />
                <span
                  className="badge badge-info"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  {selectedSpecProduct.viscosidad || 'SAE'}
                </span>
              </div>

              {/* Datos Comerciales y Calidad */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(0, 242, 254, 0.12)',
                      color: 'var(--neon-cyan, #00f0ff)',
                      border: '1px solid rgba(0, 242, 254, 0.3)',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-code)',
                      fontWeight: 800
                    }}
                  >
                    CÓDIGO: {selectedSpecProduct.codigo || selectedSpecProduct.id}
                  </span>
                  {selectedSpecProduct.oem && (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: 'var(--motorven-gold, #f59e0b)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '0.72rem'
                      }}
                    >
                      OEM: {selectedSpecProduct.oem}
                    </span>
                  )}
                  <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                    {selectedSpecProduct.categoria || 'Lubricante'}
                  </span>
                </div>

                <h4 style={{ color: 'var(--text-heading)', fontSize: '1.15rem', fontWeight: 800, margin: '2px 0 6px 0', lineHeight: 1.3 }}>
                  {selectedSpecProduct.descripcion}
                </h4>

                <div style={{ fontSize: '0.82rem', color: 'var(--motorven-gold, #f59e0b)', fontWeight: 700, marginBottom: '6px' }}>
                  Norma / Certificación: {selectedSpecProduct.normaApi || 'API SL / CI-4 / COVENIN 936'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  <div>
                    Presentación: <strong style={{ color: 'var(--text-primary)' }}>{selectedSpecProduct.unidad || 'Unidad'}</strong>
                  </div>
                  <div>
                    Litros x Envase: <strong style={{ color: 'var(--text-primary)' }}>{selectedSpecProduct.litrosPorUnidad || 1} L</strong>
                  </div>
                  <div>
                    Stock en Bodega: <strong style={{ color: 'var(--semaforo-verde, #10b981)' }}>{selectedSpecProduct.stock || 0} unid.</strong>
                  </div>
                  <div>
                    Litros Totales: <strong style={{ color: 'var(--neon-cyan, #00f0ff)' }}>{((Number(selectedSpecProduct.stock) || 0) * (Number(selectedSpecProduct.litrosPorUnidad) || 1)).toFixed(1)} L</strong>
                  </div>
                </div>

                {/* Precios Detal y Mayorista */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', background: 'var(--surface-input, rgba(255,255,255,0.03))', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Precio Detal</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--motorven-emerald, #10b981)', fontFamily: 'var(--font-tech)' }}>
                      ${Number(selectedSpecProduct.precioUsdDetal || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold, #f59e0b)' }}>
                      {formatBs((Number(selectedSpecProduct.precioUsdDetal) || 0) * (Number(config?.tasaDolar) || 827.73))}
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: '12px' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Precio Mayorista</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--motorven-cyan, #00f0ff)', fontFamily: 'var(--font-tech)' }}>
                      ${Number(selectedSpecProduct.precioUsdMayor || selectedSpecProduct.precioUsdDetal || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatBs((Number(selectedSpecProduct.precioUsdMayor || selectedSpecProduct.precioUsdDetal) || 0) * (Number(config?.tasaDolar) || 827.73))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TABLA DE PARÁMETROS FÍSICO-QUÍMICOS ASTM (LABORATORIO) */}
            <div
              style={{
                background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                padding: '1.1rem',
                borderRadius: '14px',
                border: '1px solid var(--border-glass)',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--neon-cyan, #00f0ff)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} /> Parámetros de Calidad & Ensayo ASTM:
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                  Norma ASTM D-445 / D-92 / D-97
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-input, rgba(255,255,255,0.02))', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Viscosidad @ 40 °C:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedSpecProduct.especificaciones?.viscosidad40C || (selectedSpecProduct.viscosidad?.includes('50') ? '143.9 mm²/s' : '108.5 mm²/s')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-input, rgba(255,255,255,0.02))', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Viscosidad @ 100 °C:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedSpecProduct.especificaciones?.viscosidad100C || (selectedSpecProduct.viscosidad?.includes('50') ? '14.55 mm²/s' : '14.8 mm²/s')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-input, rgba(255,255,255,0.02))', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Punto de Inflamación:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedSpecProduct.especificaciones?.puntoInflamacion || '218 °C (C. Abierto)'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-input, rgba(255,255,255,0.02))', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Punto de Fluidez:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedSpecProduct.especificaciones?.puntoFluidez || '-21 °C'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-input, rgba(255,255,255,0.02))', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Densidad Relativa @ 15°C:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedSpecProduct.especificaciones?.densidad || '0.875 g/cm³'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-input, rgba(255,255,255,0.02))', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Índice de Viscosidad (VI):</span>
                  <strong style={{ color: 'var(--motorven-gold, #f59e0b)' }}>
                    {selectedSpecProduct.especificaciones?.indiceViscosidad || '138 Mín.'}
                  </strong>
                </div>
              </div>
            </div>

            {/* APLICACIONES & RECOMENDACIONES TÉCNICAS */}
            <div
              style={{
                padding: '0.9rem 1.1rem',
                borderRadius: '12px',
                background: 'rgba(0, 43, 122, 0.08)',
                border: '1px solid rgba(0, 43, 122, 0.25)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                marginBottom: '1.25rem'
              }}
            >
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '3px' }}>
                Recomendaciones de Servicio y Protección de Maquinaria:
              </strong>
              Formulado con bases parafínicas altamente refinadas y paquete de aditivos antidesgaste de última generación. Proporciona máxima protección contra herrumbre, oxidación y formación de lodos en condiciones extremas de trabajo y altas temperaturas de operación.
            </div>

            {/* BOTONERA INFERIOR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const prodToEdit = selectedSpecProduct;
                      setSelectedSpecProduct(null);
                      handleOpenModal(prodToEdit);
                    }}
                    style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit2 size={14} /> Editar Parámetros
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedSpecProduct(null)}
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1.25rem' }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn btn-print-report"
                  onClick={() => generateInventoryPDF({ products: [selectedSpecProduct], config, currentUser })}
                >
                  <Printer size={14} color="#ffffff" /> Imprimir Reporte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
