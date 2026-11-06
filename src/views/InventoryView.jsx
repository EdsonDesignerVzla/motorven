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
import { formatUsd, formatBs, resolveProductUnit, resolveProductLitersPerUnit, PRODUCT_UNITS_LIST, getProductWarehouseStocks } from '../services/formatService';
import { getProductRetailPrice, getProductWholesalePrice } from '../services/pricingService';
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
  const [activeModalWarehouse, setActiveModalWarehouse] = useState('01');
  const [productToDelete, setProductToDelete] = useState(null);

  const normSelW = String(selectedWarehouse || '').replace(/^ALM-/, '').trim();
  const isSpecificWarehouse = normSelW === '01' || normSelW === '02';

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

  // KPIs Consolidados e Independientes por Almacén en Tiempo Real:
  // - Consolidado Total: Suma de Almacén 01 + Almacén 02
  // - Almacén 01: Principal / Mostrador (Facturas Fiscales SENIAT)
  // - Almacén 02: Central / Bóveda (Notas de Entrega / Despacho)
  const inventoryKpis = useMemo(() => {
    const tasa = Number(config?.tasaDolar || 827.73);

    // Métricas Consolidadas (Suma de ambos almacenes)
    let totalCajas = 0;
    let totalLitros = 0;
    let totalValorUsd = 0;
    let countCriticos = 0;
    let countReorden = 0;
    let countOptimos = 0;
    const breakdownByUnit = { Litros: 0, Caja: 0, Paila: 0, Tambor: 0, Totem: 0 };
    const breakdownLitersByUnit = { Litros: 0, Caja: 0, Paila: 0, Tambor: 0, Totem: 0 };

    // Métricas Almacén 01 (Principal / Facturas Fiscales SENIAT)
    let alm01TotalCajas = 0;
    let alm01TotalLitros = 0;
    let alm01TotalValorUsd = 0;
    let alm01ActiveSkus = 0;
    let alm01CountCriticos = 0;
    let alm01CountReorden = 0;
    let alm01CountOptimos = 0;
    const alm01BreakdownByUnit = { Litros: 0, Caja: 0, Paila: 0, Tambor: 0, Totem: 0 };
    const alm01BreakdownLitersByUnit = { Litros: 0, Caja: 0, Paila: 0, Tambor: 0, Totem: 0 };

    // Métricas Almacén 02 (Central / Bóveda / Notas de Entrega)
    let alm02TotalCajas = 0;
    let alm02TotalLitros = 0;
    let alm02TotalValorUsd = 0;
    let alm02ActiveSkus = 0;
    let alm02CountCriticos = 0;
    let alm02CountReorden = 0;
    let alm02CountOptimos = 0;
    const alm02BreakdownByUnit = { Litros: 0, Caja: 0, Paila: 0, Tambor: 0, Totem: 0 };
    const alm02BreakdownLitersByUnit = { Litros: 0, Caja: 0, Paila: 0, Tambor: 0, Totem: 0 };

    products.forEach(p => {
      const stocks = getProductWarehouseStocks(p);
      const s01 = stocks.stock01;
      const s02 = stocks.stock02;
      const sTotal = stocks.total;

      const unit = resolveProductUnit(p, 'Caja');
      const litersPerUnit = resolveProductLitersPerUnit(p);
      const min = Number(p.stockMinimo) || 5;
      const costo = Number(p.costoUsd ?? p.costo_usd ?? p.costo ?? 0) || 0;

      // 1. Acumuladores Consolidados (Suma Total)
      totalCajas += sTotal;
      const lTotal = sTotal * litersPerUnit;
      totalLitros += lTotal;
      totalValorUsd += sTotal * costo;

      if (sTotal <= min) countCriticos++;
      else if (sTotal <= min * 2) countReorden++;
      else countOptimos++;

      if (breakdownByUnit[unit] !== undefined) {
        breakdownByUnit[unit] += sTotal;
        breakdownLitersByUnit[unit] += lTotal;
      }

      // 2. Acumuladores Almacén 01 (Principal - Fiscal)
      if (s01 > 0) alm01ActiveSkus++;
      alm01TotalCajas += s01;
      const l01 = s01 * litersPerUnit;
      alm01TotalLitros += l01;
      alm01TotalValorUsd += s01 * costo;

      const min01 = Math.max(1, Math.round(min * 0.4));
      if (s01 <= min01) alm01CountCriticos++;
      else if (s01 <= min01 * 2) alm01CountReorden++;
      else alm01CountOptimos++;

      if (alm01BreakdownByUnit[unit] !== undefined) {
        alm01BreakdownByUnit[unit] += s01;
        alm01BreakdownLitersByUnit[unit] += l01;
      }

      // 3. Acumuladores Almacén 02 (Central - Notas de Entrega)
      if (s02 > 0) alm02ActiveSkus++;
      alm02TotalCajas += s02;
      const l02 = s02 * litersPerUnit;
      alm02TotalLitros += l02;
      alm02TotalValorUsd += s02 * costo;

      const min02 = Math.max(1, Math.round(min * 0.6));
      if (s02 <= min02) alm02CountCriticos++;
      else if (s02 <= min02 * 2) alm02CountReorden++;
      else alm02CountOptimos++;

      if (alm02BreakdownByUnit[unit] !== undefined) {
        alm02BreakdownByUnit[unit] += s02;
        alm02BreakdownLitersByUnit[unit] += l02;
      }
    });

    const totalValorBs = totalValorUsd * tasa;
    const alm01TotalValorBs = alm01TotalValorUsd * tasa;
    const alm02TotalValorBs = alm02TotalValorUsd * tasa;

    return {
      // Consolidado (Suma Total 01 + 02)
      totalSkus: products.length,
      totalCajas,
      totalLitros,
      totalValorUsd,
      totalValorBs,
      countCriticos,
      countReorden,
      countOptimos,
      breakdownByUnit,
      breakdownLitersByUnit,

      // Almacén 01: Principal (Facturas Fiscales)
      alm01TotalSkus: alm01ActiveSkus,
      alm01TotalCajas,
      alm01TotalLitros,
      alm01TotalValorUsd,
      alm01TotalValorBs,
      alm01CountCriticos,
      alm01CountReorden,
      alm01CountOptimos,
      alm01BreakdownByUnit,
      alm01BreakdownLitersByUnit,

      // Almacén 02: Central / Bóveda (Notas de Entrega)
      alm02TotalSkus: alm02ActiveSkus,
      alm02TotalCajas,
      alm02TotalLitros,
      alm02TotalValorUsd,
      alm02TotalValorBs,
      alm02CountCriticos,
      alm02CountReorden,
      alm02CountOptimos,
      alm02BreakdownByUnit,
      alm02BreakdownLitersByUnit
    };
  }, [products, config]);

  // Filtrado y Ordenamiento Creciente por Código de Productos
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
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

        const stocks = getProductWarehouseStocks(p);
        const normSelW = String(selectedWarehouse || '').replace(/^ALM-/, '').trim();
        const currentStock = normSelW === '01' ? stocks.stock01 : (normSelW === '02' ? stocks.stock02 : stocks.total);
        const effMin = normSelW === '01'
          ? Math.max(1, Math.round((Number(p.stockMinimo) || 5) * 0.4))
          : (normSelW === '02'
            ? Math.max(1, Math.round((Number(p.stockMinimo) || 5) * 0.6))
            : (Number(p.stockMinimo) || 5));

        const sem = getSemaforoStatus(currentStock, effMin);
        const matchesSemaforo = semaforoFilter === 'TODOS' || sem.level === semaforoFilter;

        const matchesWarehouse = selectedWarehouse === 'TODOS' ||
          normSelW === '01' ||
          normSelW === '02';

        return matchesSearch && matchesCat && matchesSemaforo && matchesWarehouse;
      })
      .sort((a, b) =>
        String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
      );
  }, [products, searchTerm, globalSearch, selectedCategory, semaforoFilter, selectedWarehouse]);

  // Lista de almacenes activos (solo 01 y 02; excluido el 03)
  const activeWarehouses = useMemo(() => {
    const rawList = warehouses.length > 0 ? warehouses : [
      { id: 'ALM-01', coAlm: '01', desAlm: 'ALMACÉN PRINCIPAL / MOSTRADOR' },
      { id: 'ALM-02', coAlm: '02', desAlm: 'ALMACÉN CENTRAL / BÓVEDA' }
    ];
    return rawList.filter((w) => {
      const code = String(w?.coAlm || w?.co_alm || w?.coAlma || w?.co_alma || w?.id || '').replace(/^ALM-/, '').trim();
      return code === '01' || code === '02';
    });
  }, [warehouses]);

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

  // Filtrado de productos para Toma Física (por Almacén y Búsqueda interna, ordenados crecientemente por código)
  const targetPhysicalProducts = useMemo(() => {
    return products
      .filter(p => {
        const searchLower = (physicalTakeSearch || '').toLowerCase();
        const matchesSearch = !searchLower ||
          (p.codigo || '').toLowerCase().includes(searchLower) ||
          (p.descripcion || '').toLowerCase().includes(searchLower) ||
          (p.ubicacion && p.ubicacion.toLowerCase().includes(searchLower));

        const normWh = String(physicalTakeWarehouse || '').replace(/^ALM-/, '').toLowerCase();
        const matchesWh = physicalTakeWarehouse === 'TODOS' ||
          normWh === '01' ||
          normWh === '02' ||
          (p.almacen && p.almacen.toLowerCase().includes(normWh)) ||
          (p.coAlm && String(p.coAlm).toLowerCase().includes(normWh)) ||
          (p.ubicacion && p.ubicacion.toLowerCase().includes(normWh));

        return matchesSearch && matchesWh;
      })
      .sort((a, b) =>
        String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
      );
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
      totalLitrosSistema += sysStock * resolveProductLitersPerUnit(p);

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
      const litros = ((Number(p.stock) || 0) * resolveProductLitersPerUnit(p)).toFixed(1);
      return [
        `"${p.codigo}"`,
        `"${p.oem || ''}"`,
        `"${(p.descripcion || '').replace(/"/g, '""')}"`,
        `"${p.categoria || ''}"`,
        `"${p.viscosidad || ''}"`,
        `"${p.marca || ''}"`,
        `"${p.ubicacion || ''}"`,
        p.stock,
        `"${resolveProductUnit(p, 'Caja')}"`,
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

  const handleOpenModal = (product = null, warehouseCode = null) => {
    if (!canManage) return;
    const targetWh = warehouseCode || (isSpecificWarehouse ? normSelW : '01');
    setActiveModalWarehouse(targetWh);

    if (product) {
      const stocks = getProductWarehouseStocks(product);
      setEditingProduct({
        ...product,
        activeWarehouse: targetWh,
        stockAlmacen01: stocks.stock01,
        stockAlmacen02: stocks.stock02,
        stock: stocks.total,
        unidad: resolveProductUnit(product, 'Caja'),
        litrosPorUnidad: resolveProductLitersPerUnit(product)
      });
    } else {
      setEditingProduct({
        codigo: '',
        oem: '',
        descripcion: '',
        marca: 'Motorven Lubricants',
        categoria: 'Gasolina',
        viscosidad: '20W-50 Mineral',
        ubicacion: targetWh === '02' ? '02: Almacén Central / Bóveda' : '01: Almacén Principal / Mostrador',
        unidad: 'Caja',
        litrosPorUnidad: 11.35,
        activeWarehouse: targetWh,
        stockAlmacen01: targetWh === '01' ? 10 : 0,
        stockAlmacen02: targetWh === '02' ? 10 : 0,
        stock: 10,
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

  const handleOpenSpecModal = (product, warehouseCode = null) => {
    const targetWh = warehouseCode || (isSpecificWarehouse ? normSelW : '01');
    setSelectedSpecProduct({
      ...product,
      _warehouseContext: targetWh
    });
  };

  const handleOpenDeleteModal = (product, warehouseCode = null) => {
    if (!canManage) return;
    const targetWh = warehouseCode || (isSpecificWarehouse ? normSelW : '01');
    const stocks = getProductWarehouseStocks(product);
    setProductToDelete({
      product,
      warehouseCode: targetWh,
      warehouseName: targetWh === '01' ? '01: ALMACÉN PRINCIPAL / MOSTRADOR' : '02: ALMACÉN CENTRAL / BÓVEDA',
      warehousePurpose: targetWh === '01' ? 'Facturas Fiscales SENIAT' : 'Notas de Entrega / Despacho',
      stockThisWh: targetWh === '01' ? stocks.stock01 : stocks.stock02,
      stockOtherWh: targetWh === '01' ? stocks.stock02 : stocks.stock01,
      otherWhName: targetWh === '01' ? '02: Almacén Central' : '01: Almacén Principal',
      totalStock: stocks.total
    });
  };

  const handleZeroOutWarehouseStock = async () => {
    if (!productToDelete) return;
    const { product, warehouseCode } = productToDelete;
    const stocks = getProductWarehouseStocks(product);
    const s01 = warehouseCode === '01' ? 0 : stocks.stock01;
    const s02 = warehouseCode === '02' ? 0 : stocks.stock02;
    const updatedProd = {
      ...product,
      stockAlmacen01: s01,
      stock_almacen_01: s01,
      stockAlmacen02: s02,
      stock_almacen_02: s02,
      stock: s01 + s02
    };
    try {
      await onSaveProduct(updatedProd);
      setProductToDelete(null);
    } catch (err) {
      console.error('Error al vaciar existencia de almacén:', err);
    }
  };

  const handleConfirmFullDelete = async () => {
    if (!productToDelete) return;
    const targetId = productToDelete.product.id || productToDelete.product.codigo;
    setProductToDelete(null);
    if (onDeleteProduct) {
      await onDeleteProduct(targetId);
    }
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
    setSavingStatus({ saving: true, message: 'Guardando en Supabase...' });
    try {
      const s01 = Math.max(0, Number(editingProduct.stockAlmacen01) || 0);
      const s02 = Math.max(0, Number(editingProduct.stockAlmacen02) || 0);
      const payloadToSave = {
        ...editingProduct,
        stockAlmacen01: s01,
        stock_almacen_01: s01,
        stockAlmacen02: s02,
        stock_almacen_02: s02,
        stock: s01 + s02
      };
      const saved = await onSaveProduct(payloadToSave);
      const targetLabel = activeModalWarehouse === '02' ? 'Almacén Central (02 - Notas de Entrega)' : 'Almacén Principal (01 - Facturas Fiscales)';
      if (saved && saved._comparison) {
        setSavingStatus({
          saving: false,
          success: true,
          message: `✅ Sincronizado para ${targetLabel}: Supabase y Almacén 100% coincidentes.`
        });
        setTimeout(() => {
          setShowModal(false);
          setSavingStatus(null);
        }, 1200);
      } else {
        setSavingStatus({
          saving: false,
          success: true,
          message: `✅ Lubricante guardado para ${targetLabel}.`
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
            title="Ver Kardex Físico, Mermas, Ajustes y Traslados sincronizados desde Supabase"
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
            <button
              className="btn btn-secondary"
              onClick={() => handleOpenModal(null, isSpecificWarehouse ? normSelW : '01')}
              style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title={isSpecificWarehouse ? `Cargar nuevo producto en Almacén ${normSelW}` : 'Cargar nuevo producto en inventario'}
            >
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
        {/* KPI 1: VOLUMEN TOTAL (CONSOLIDADO: SUMA DE LOS DOS ALMACENES) */}
        <div
          className="kpi-card-modern"
          onClick={() => setSelectedWarehouse('TODOS')}
          style={{
            background: 'var(--bg-card)',
            border: selectedWarehouse === 'TODOS' ? '1px solid var(--neon-cyan)' : '1px solid var(--border-glass)',
            borderRadius: '14px',
            padding: '1.15rem',
            minWidth: 0,
            cursor: 'pointer',
            boxShadow: selectedWarehouse === 'TODOS' ? '0 0 14px rgba(6, 182, 212, 0.18)' : 'none',
            transition: 'all 0.25s ease'
          }}
          title="Ver Consolidado de ambos almacenes (Suma Alm 01 + Alm 02)"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Volumen en Bodega
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Oilstone ®</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                Σ Alm 01 + 02
              </span>
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)' }}>
            {inventoryKpis.totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', lineHeight: 1.35 }}>
            <span>💧 <strong>{inventoryKpis.breakdownByUnit?.Litros || 0}</strong> Litros <span style={{ color: 'var(--motorven-navy-light)', fontWeight: 600 }}>({(inventoryKpis.breakdownLitersByUnit?.Litros || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 📦 <strong>{inventoryKpis.breakdownByUnit?.Caja || 0}</strong> Cajas <span style={{ color: 'var(--motorven-navy-light)', fontWeight: 600 }}>({(inventoryKpis.breakdownLitersByUnit?.Caja || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 🪣 <strong>{inventoryKpis.breakdownByUnit?.Paila || 0}</strong> Pailas <span style={{ color: 'var(--motorven-navy-light)', fontWeight: 600 }}>({(inventoryKpis.breakdownLitersByUnit?.Paila || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 🛢️ <strong>{inventoryKpis.breakdownByUnit?.Tambor || 0}</strong> Tambor <span style={{ color: 'var(--motorven-navy-light)', fontWeight: 600 }}>({(inventoryKpis.breakdownLitersByUnit?.Tambor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            {(inventoryKpis.breakdownByUnit?.Totem || 0) > 0 && (
              <span>• 🏗️ <strong>{inventoryKpis.breakdownByUnit.Totem}</strong> Totem <span style={{ color: 'var(--motorven-navy-light)', fontWeight: 600 }}>({(inventoryKpis.breakdownLitersByUnit?.Totem || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            )}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '4px', opacity: 0.9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>({inventoryKpis.totalSkus} SKUs totales)</span>
            <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>Total Consolidado</span>
          </div>
        </div>

        {/* KPI 2: ALMACÉN 01 - PRINCIPAL / MOSTRADOR (FACTURAS FISCALES SENIAT) */}
        <div
          className="kpi-card-modern"
          onClick={() => setSelectedWarehouse('01')}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.16) 0%, rgba(2, 132, 199, 0.10) 100%)',
            border: selectedWarehouse === '01' ? '1px solid #38bdf8' : '1px solid rgba(2, 132, 199, 0.35)',
            borderRadius: '14px',
            padding: '1.15rem',
            minWidth: 0,
            cursor: 'pointer',
            boxShadow: selectedWarehouse === '01' ? '0 0 16px rgba(56, 189, 248, 0.28)' : 'none',
            transition: 'all 0.25s ease'
          }}
          title="Clic para filtrar por 01: Almacén Principal (Facturación Fiscal)"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🏢 01: Alm. Principal
            </span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(2, 132, 199, 0.22)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.45)', padding: '2px 7px', borderRadius: '12px', fontWeight: 800 }}>
              🧾 Facturas Fiscales
            </span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-tech)' }}>
            {inventoryKpis.alm01TotalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', lineHeight: 1.35 }}>
            <span>💧 <strong>{inventoryKpis.alm01BreakdownByUnit?.Litros || 0}</strong> Lts <span style={{ color: '#38bdf8', fontWeight: 600 }}>({(inventoryKpis.alm01BreakdownLitersByUnit?.Litros || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 📦 <strong>{inventoryKpis.alm01BreakdownByUnit?.Caja || 0}</strong> Cajas <span style={{ color: '#38bdf8', fontWeight: 600 }}>({(inventoryKpis.alm01BreakdownLitersByUnit?.Caja || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 🪣 <strong>{inventoryKpis.alm01BreakdownByUnit?.Paila || 0}</strong> Pailas <span style={{ color: '#38bdf8', fontWeight: 600 }}>({(inventoryKpis.alm01BreakdownLitersByUnit?.Paila || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 🛢️ <strong>{inventoryKpis.alm01BreakdownByUnit?.Tambor || 0}</strong> Tambor <span style={{ color: '#38bdf8', fontWeight: 600 }}>({(inventoryKpis.alm01BreakdownLitersByUnit?.Tambor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>({inventoryKpis.alm01TotalSkus} SKUs en mostrador)</span>
            <span style={{ color: 'var(--motorven-gold)', fontWeight: 700 }}>{formatUsd(inventoryKpis.alm01TotalValorUsd)}</span>
          </div>
        </div>

        {/* KPI 3: ALMACÉN 02 - CENTRAL / BÓVEDA (NOTAS DE ENTREGA) */}
        <div
          className="kpi-card-modern"
          onClick={() => setSelectedWarehouse('02')}
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(0, 43, 122, 0.10) 100%)',
            border: selectedWarehouse === '02' ? '1px solid var(--motorven-emerald)' : '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '14px',
            padding: '1.15rem',
            minWidth: 0,
            cursor: 'pointer',
            boxShadow: selectedWarehouse === '02' ? '0 0 16px rgba(16, 185, 129, 0.28)' : 'none',
            transition: 'all 0.25s ease'
          }}
          title="Clic para filtrar por 02: Almacén Central / Bóveda (Notas de Entrega)"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--motorven-emerald)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🏛️ 02: Alm. Central
            </span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.22)', color: 'var(--motorven-emerald)', border: '1px solid rgba(16, 185, 129, 0.45)', padding: '2px 7px', borderRadius: '12px', fontWeight: 800 }}>
              🚚 Notas de Entrega
            </span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--motorven-emerald)', fontFamily: 'var(--font-tech)' }}>
            {inventoryKpis.alm02TotalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', lineHeight: 1.35 }}>
            <span>💧 <strong>{inventoryKpis.alm02BreakdownByUnit?.Litros || 0}</strong> Lts <span style={{ color: 'var(--motorven-emerald)', fontWeight: 600 }}>({(inventoryKpis.alm02BreakdownLitersByUnit?.Litros || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 📦 <strong>{inventoryKpis.alm02BreakdownByUnit?.Caja || 0}</strong> Cajas <span style={{ color: 'var(--motorven-emerald)', fontWeight: 600 }}>({(inventoryKpis.alm02BreakdownLitersByUnit?.Caja || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 🪣 <strong>{inventoryKpis.alm02BreakdownByUnit?.Paila || 0}</strong> Pailas <span style={{ color: 'var(--motorven-emerald)', fontWeight: 600 }}>({(inventoryKpis.alm02BreakdownLitersByUnit?.Paila || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
            <span>• 🛢️ <strong>{inventoryKpis.alm02BreakdownByUnit?.Tambor || 0}</strong> Tambor <span style={{ color: 'var(--motorven-emerald)', fontWeight: 600 }}>({(inventoryKpis.alm02BreakdownLitersByUnit?.Tambor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L)</span></span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>({inventoryKpis.alm02TotalSkus} SKUs en bóveda)</span>
            <span style={{ color: 'var(--motorven-gold)', fontWeight: 700 }}>{formatUsd(inventoryKpis.alm02TotalValorUsd)}</span>
          </div>
        </div>

        {/* KPI 4: VALORIZACIÓN */}
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
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>🏢 01: <strong style={{ color: '#38bdf8' }}>{formatUsd(inventoryKpis.alm01TotalValorUsd)}</strong></span>
              <span>🏛️ 02: <strong style={{ color: 'var(--motorven-emerald)' }}>{formatUsd(inventoryKpis.alm02TotalValorUsd)}</strong></span>
            </div>
          </div>
        )}

        {/* KPI 5: SALUD DEL SEMÁFORO */}
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
            {/* Filtro por Almacén Supabase */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Warehouse size={16} color="var(--neon-cyan)" />
              <select
                className="form-control filter-select"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                style={{ width: '235px', height: '38px', fontSize: '0.82rem' }}
              >
                <option value="TODOS">Todos los Almacenes (Σ Consolidado)</option>
                {activeWarehouses.map((w) => {
                  const code = String(w.coAlm || w.id).replace(/^ALM-/, '');
                  const tag = code === '01' ? ' (Facturas Fiscales)' : code === '02' ? ' (Notas de Entrega)' : '';
                  return (
                    <option key={w.id || w.coAlm} value={w.coAlm}>
                      {w.coAlm} - {w.desAlm}{tag}
                    </option>
                  );
                })}
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

        {/* Chips de Almacenes Independientes */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Almacenes:
          </span>
          <button
            type="button"
            onClick={() => setSelectedWarehouse('TODOS')}
            style={{
              fontSize: '0.72rem',
              padding: '3px 9px',
              borderRadius: '20px',
              border: selectedWarehouse === 'TODOS' ? '1px solid var(--neon-cyan)' : '1px solid var(--border-glass)',
              background: selectedWarehouse === 'TODOS' ? 'rgba(6, 182, 212, 0.18)' : 'var(--bg-card)',
              color: selectedWarehouse === 'TODOS' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600
            }}
          >
            Σ Todos (Consolidado: Alm 01 + Alm 02)
          </button>
          {activeWarehouses.map((w) => {
            const isSelected = selectedWarehouse === w.coAlm;
            const isAlm01 = String(w.coAlm).replace(/^ALM-/, '') === '01';
            const isAlm02 = String(w.coAlm).replace(/^ALM-/, '') === '02';
            const activeColor = isAlm01 ? '#38bdf8' : isAlm02 ? 'var(--motorven-emerald)' : 'var(--neon-cyan)';
            const activeBg = isAlm01 ? 'rgba(2, 132, 199, 0.2)' : isAlm02 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.15)';
            const subLabel = isAlm01 ? ' • 🧾 Facturas Fiscales' : isAlm02 ? ' • 🚚 Notas de Entrega' : '';

            return (
              <button
                key={w.coAlm}
                type="button"
                onClick={() => setSelectedWarehouse(isSelected ? 'TODOS' : w.coAlm)}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  border: isSelected ? `1px solid ${activeColor}` : '1px solid var(--border-glass)',
                  background: isSelected ? activeBg : 'var(--bg-card)',
                  color: isSelected ? activeColor : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: isSelected ? 700 : 500
                }}
              >
                <Warehouse size={12} /> {w.coAlm}: {w.desAlm}{subLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla de Productos con Semáforo */}
      <div className="card table-card-wrapper" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px', width: '100%', minWidth: 0, maxWidth: '100%' }}>
        <div className="table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="custom-table table-wide" style={{ fontSize: '0.8rem', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '88px' }}>Semáforo</th>
                <th style={{ textAlign: 'center', width: '48px' }}>Imagen</th>
                <th style={{ width: '86px' }}>Código / OEM</th>
                <th>Lubricante & Viscosidad</th>
                <th>Presentación & Ubicación</th>
                <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Stock & Litros</th>
                {canSeeCosts && <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Costo Unit. ($)</th>}
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Precio Detal ($ / Bs)</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Precio Mayor ($)</th>
                {canSeeCosts && <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Margen Detal</th>}
                <th style={{ textAlign: 'center', width: isSpecificWarehouse ? '94px' : '128px' }} className="col-acciones">Acciones</th>
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
                  const stocks = getProductWarehouseStocks(p);
                  const normSelW = String(selectedWarehouse || '').replace(/^ALM-/, '').trim();
                  const currentStock = normSelW === '01' ? stocks.stock01 : (normSelW === '02' ? stocks.stock02 : stocks.total);
                  const effMin = normSelW === '01'
                    ? Math.max(1, Math.round((Number(p.stockMinimo) || 5) * 0.4))
                    : (normSelW === '02'
                      ? Math.max(1, Math.round((Number(p.stockMinimo) || 5) * 0.6))
                      : (Number(p.stockMinimo) || 5));
                  const sem = getSemaforoStatus(currentStock, effMin);
                  const precioUsdDetal = getProductRetailPrice(p);
                  const precioUsdMayor = getProductWholesalePrice(p);
                  const precioBsDetal = precioUsdDetal * (Number(config?.tasaDolar) || 886.22);
                  const costoUsd = Number(p.costoUsd ?? p.costo_usd ?? p.costo ?? 0);
                  const totalLitrosStock = (currentStock * resolveProductLitersPerUnit(p)).toFixed(1);

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{p.marca}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{resolveProductUnit(p, 'Caja')}</span>
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Warehouse size={12} color="var(--neon-cyan)" />
                            {normSelW === '01' && (
                              <span style={{ color: '#38bdf8', fontWeight: 700 }}>01: Alm. Principal (Facturas Fiscales)</span>
                            )}
                            {normSelW === '02' && (
                              <span style={{ color: 'var(--motorven-emerald)', fontWeight: 700 }}>02: Alm. Central (Notas de Entrega)</span>
                            )}
                            {normSelW !== '01' && normSelW !== '02' && (
                              <span>Alm 01 (Fiscal) • Alm 02 (Notas Entrega)</span>
                            )}
                          </div>
                          {normSelW !== '01' && normSelW !== '02' && (
                            <div style={{ fontSize: '0.7rem', display: 'flex', gap: '8px', marginTop: '1px' }}>
                              <span>🏢 01: <strong style={{ color: '#38bdf8' }}>{stocks.stock01}</strong></span>
                              <span>•</span>
                              <span>🏛️ 02: <strong style={{ color: 'var(--motorven-emerald)' }}>{stocks.stock02}</strong></span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '1.05rem', color: sem.color, fontFamily: 'var(--font-tech)' }}>
                            {currentStock}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{resolveProductUnit(p, 'Caja')}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)', fontWeight: 600, fontFamily: 'var(--font-code)' }}>
                          ({totalLitrosStock} L {normSelW === '01' ? 'Fiscal' : normSelW === '02' ? 'Entrega' : 'Totales'})
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
                        {isSpecificWarehouse ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {canManage && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenModal(p, normSelW)}
                                title={`Editar en Almacén ${normSelW === '01' ? 'Principal (01 - Fiscal)' : 'Central (02 - Notas Entrega)'}`}
                                style={{
                                  padding: '3px 7px',
                                  borderColor: normSelW === '01' ? '#38bdf8' : 'var(--motorven-emerald)',
                                  background: normSelW === '01' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(16, 185, 129, 0.15)'
                                }}
                              >
                                <Edit2 size={13} color={normSelW === '01' ? '#38bdf8' : 'var(--motorven-emerald)'} />
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenSpecModal(p, normSelW)}
                              title={`Ficha Técnica (${normSelW === '01' ? '01: Alm. Principal' : '02: Alm. Central'})`}
                              style={{ color: 'var(--motorven-cyan, #00f0ff)', padding: '3px 7px' }}
                            >
                              <Info size={13} />
                            </button>
                            {canManage && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenDeleteModal(p, normSelW)}
                                title={`Eliminar / Ajustar en Almacén ${normSelW === '01' ? 'Principal' : 'Central'}`}
                                style={{ color: 'var(--motorven-red)', padding: '3px 7px' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px dashed var(--border-glass)',
                              display: 'inline-block',
                              whiteSpace: 'nowrap'
                            }}
                            title="Seleccione '01: Almacén Principal' o '02: Almacén Central' en el filtro para gestionar este lubricante"
                          >
                            🔒 Seleccione Almacén
                          </span>
                        )}
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
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="var(--motorven-gold)" />
                  {editingProduct.id ? 'Editar Lubricante' : 'Cargar Nuevo Lubricante'}
                </h2>
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeModalWarehouse === '01' ? (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(2, 132, 199, 0.22)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.5)', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                      🏢 01: ALMACÉN PRINCIPAL / MOSTRADOR • 🧾 Facturas Fiscales SENIAT
                    </span>
                  ) : activeModalWarehouse === '02' ? (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.22)', color: 'var(--motorven-emerald)', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                      🏛️ 02: ALMACÉN CENTRAL / BÓVEDA • 🚚 Notas de Entrega / Despacho
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(0, 240, 255, 0.15)', color: 'var(--neon-cyan)', border: '1px solid rgba(0, 240, 255, 0.35)', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                      Σ Todos los Almacenes (Consolidado)
                    </span>
                  )}
                </div>
              </div>
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
                  <select
                    className="form-control"
                    value={resolveProductUnit(editingProduct.unidad, 'Caja')}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      const defaultLitersMap = { Paila: 19, Tambor: 208, Totem: 1000, Litros: 1, 'N/A': 0, Caja: 11.35 };
                      const nextLiters = defaultLitersMap[newUnit] ?? editingProduct.litrosPorUnidad;
                      setEditingProduct({ ...editingProduct, unidad: newUnit, litrosPorUnidad: nextLiters });
                    }}
                  >
                    {PRODUCT_UNITS_LIST.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Litros por Unidad (Caja/Paila/Tambor)</label>
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
                {activeModalWarehouse === '02' ? (
                  <div className="form-group" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: '10px', border: '1px dashed var(--border-glass)', opacity: 0.9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', margin: 0 }}>
                        🏢 Stock 01: Alm. Principal (Facturas Fiscales)
                      </label>
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: '8px' }}>
                        🔒 Protegido
                      </span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-tech)', padding: '4px 0' }}>
                      {editingProduct.stockAlmacen01 ?? 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{resolveProductUnit(editingProduct.unidad, 'Caja')}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      Existencia fija de facturación fiscal (intacta).
                    </div>
                  </div>
                ) : (
                  <div className="form-group" style={{ background: 'rgba(2, 132, 199, 0.10)', padding: '12px 14px', borderRadius: '10px', border: activeModalWarehouse === '01' ? '2px solid #38bdf8' : '1px solid rgba(2, 132, 199, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.82rem', margin: 0 }}>
                        🏢 Stock 01: Alm. Principal (Facturas Fiscales)
                      </label>
                      {activeModalWarehouse === '01' && (
                        <span style={{ fontSize: '0.65rem', background: '#0284c7', color: '#fff', padding: '2px 7px', borderRadius: '8px', fontWeight: 700 }}>
                          ✏️ EDITANDO AHORA
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      style={{ fontSize: '1.05rem', fontWeight: 700, borderColor: '#38bdf8' }}
                      value={editingProduct.stockAlmacen01 ?? 0}
                      onChange={(e) => {
                        const val01 = Math.max(0, parseInt(e.target.value) || 0);
                        const val02 = Math.max(0, Number(editingProduct.stockAlmacen02) || 0);
                        setEditingProduct({
                          ...editingProduct,
                          stockAlmacen01: val01,
                          stock: val01 + val02
                        });
                      }}
                      required
                    />
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                      Existencia destinada exclusivamente a facturación fiscal SENIAT
                    </div>
                  </div>
                )}

                {activeModalWarehouse === '01' ? (
                  <div className="form-group" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: '10px', border: '1px dashed var(--border-glass)', opacity: 0.9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', margin: 0 }}>
                        🏛️ Stock 02: Alm. Central (Notas de Entrega)
                      </label>
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: '8px' }}>
                        🔒 Protegido
                      </span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-tech)', padding: '4px 0' }}>
                      {editingProduct.stockAlmacen02 ?? 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{resolveProductUnit(editingProduct.unidad, 'Caja')}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      Existencia fija de notas de entrega (intacta).
                    </div>
                  </div>
                ) : (
                  <div className="form-group" style={{ background: 'rgba(16, 185, 129, 0.10)', padding: '12px 14px', borderRadius: '10px', border: activeModalWarehouse === '02' ? '2px solid var(--motorven-emerald)' : '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ color: 'var(--motorven-emerald)', fontWeight: 800, fontSize: '0.82rem', margin: 0 }}>
                        🏛️ Stock 02: Alm. Central (Notas de Entrega)
                      </label>
                      {activeModalWarehouse === '02' && (
                        <span style={{ fontSize: '0.65rem', background: '#059669', color: '#fff', padding: '2px 7px', borderRadius: '8px', fontWeight: 700 }}>
                          ✏️ EDITANDO AHORA
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      style={{ fontSize: '1.05rem', fontWeight: 700, borderColor: 'var(--motorven-emerald)' }}
                      value={editingProduct.stockAlmacen02 ?? 0}
                      onChange={(e) => {
                        const val02 = Math.max(0, parseInt(e.target.value) || 0);
                        const val01 = Math.max(0, Number(editingProduct.stockAlmacen01) || 0);
                        setEditingProduct({
                          ...editingProduct,
                          stockAlmacen02: val02,
                          stock: val01 + val02
                        });
                      }}
                      required
                    />
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                      Existencia destinada a despacho comercial por notas de entrega
                    </div>
                  </div>
                )}
              </div>

              <div className="form-row" style={{ marginTop: '0.4rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ background: 'rgba(0, 43, 122, 0.1)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <label className="form-label" style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Σ Stock Total Consolidado (Alm 01 + Alm 02)
                  </label>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--neon-cyan)', fontFamily: 'var(--font-tech)' }}>
                    {editingProduct.stock ?? 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{resolveProductUnit(editingProduct.unidad, 'Caja')}</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Mínimo (Alerta Crítica)</label>
                  <input
                    type="number"
                    min="0"
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
                        ✅ Imagen en Base64 (Lista para Supabase; excluida de Supabase)
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

      {/* Modal de Eliminación / Vaciado de Almacén Específico */}
      {productToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '540px', padding: '1.5rem', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid rgba(230, 0, 18, 0.4)', boxShadow: '0 12px 36px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.85rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(230, 0, 18, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={22} color="var(--motorven-red)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                  Gestión de Inventario por Almacén
                </h3>
                <div style={{ fontSize: '0.75rem', color: productToDelete.warehouseCode === '01' ? '#38bdf8' : 'var(--motorven-emerald)', fontWeight: 700 }}>
                  {productToDelete.warehouseName} • {productToDelete.warehousePurpose}
                </div>
              </div>
              <button className="btn-close" onClick={() => setProductToDelete(null)}><X size={18} /></button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-glass)', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--neon-cyan)', fontSize: '0.92rem', marginBottom: '4px' }}>
                {productToDelete.product.codigo} — {productToDelete.product.descripcion || productToDelete.product.nombre}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.78rem', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-glass)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Existencia en {productToDelete.warehouseCode === '01' ? 'Almacén 01' : 'Almacén 02'}:</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: productToDelete.warehouseCode === '01' ? '#38bdf8' : 'var(--motorven-emerald)', fontFamily: 'var(--font-tech)' }}>
                    {productToDelete.stockThisWh} <span style={{ fontSize: '0.75rem' }}>{resolveProductUnit(productToDelete.product, 'Caja')}</span>
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Existencia en {productToDelete.otherWhName}:</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-tech)' }}>
                    {productToDelete.stockOtherWh} <span style={{ fontSize: '0.75rem' }}>{resolveProductUnit(productToDelete.product, 'Caja')} (intacto)</span>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Seleccione la operación que desea ejecutar para este producto en <strong>{productToDelete.warehouseName}</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleZeroOutWarehouseStock}
                style={{
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(245, 158, 11, 0.12)',
                  borderColor: 'rgba(245, 158, 11, 0.45)',
                  color: '#fbbf24',
                  fontWeight: 700,
                  fontSize: '0.84rem'
                }}
              >
                <span>📦 Vaciar solo este almacén (Poner en 0)</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>Mantiene {productToDelete.otherWhName} intacto</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleConfirmFullDelete}
                style={{
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(230, 0, 18, 0.15)',
                  borderColor: 'rgba(230, 0, 18, 0.5)',
                  color: '#f87171',
                  fontWeight: 700,
                  fontSize: '0.84rem'
                }}
              >
                <span>🗑️ Eliminar lubricante del catálogo general</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>Borrado permanente</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setProductToDelete(null)}
                style={{ marginTop: '4px', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
            </div>
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
                    title="Recargar inventario real desde Supabase / Base de Datos"
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
                  <option value="01">01: ALMACÉN PRINCIPAL / MOSTRADOR</option>
                  <option value="02">02: ALMACÉN CENTRAL / BÓVEDA</option>
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
                            {sysStock} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{resolveProductUnit(p, 'Caja')}</span>
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

                {/* Indicador y Métricas de Almacén Activo para la Ficha */}
                {(() => {
                  const specStocks = getProductWarehouseStocks(selectedSpecProduct);
                  const specWh = selectedSpecProduct._warehouseContext || (normSelW === '01' || normSelW === '02' ? normSelW : '01');
                  const specWhStock = specWh === '02' ? specStocks.stock02 : specStocks.stock01;
                  const specOtherStock = specWh === '02' ? specStocks.stock01 : specStocks.stock02;
                  const litersUnit = resolveProductLitersPerUnit(selectedSpecProduct);
                  const specWhLiters = (specWhStock * litersUnit).toFixed(1);
                  const specTotalLiters = (specStocks.total * litersUnit).toFixed(1);

                  return (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: specWh === '02' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                        border: `1px solid ${specWh === '02' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                        marginBottom: '8px'
                      }}>
                        <Warehouse size={14} color={specWh === '02' ? 'var(--motorven-emerald)' : '#38bdf8'} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: specWh === '02' ? 'var(--motorven-emerald)' : '#38bdf8' }}>
                          {specWh === '02' ? '🏛️ 02: ALMACÉN CENTRAL / BÓVEDA (Notas de Entrega)' : '🏢 01: ALMACÉN PRINCIPAL / MOSTRADOR (Facturas Fiscales)'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--motorven-gold, #f59e0b)', fontWeight: 700, marginBottom: '6px' }}>
                        Norma / Certificación: {selectedSpecProduct.normaApi || 'API SL / CI-4 / COVENIN 936'}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        <div>
                          Presentación: <strong style={{ color: 'var(--text-primary)' }}>{resolveProductUnit(selectedSpecProduct, 'Caja')}</strong>
                        </div>
                        <div>
                          Litros x Envase: <strong style={{ color: 'var(--text-primary)' }}>{litersUnit} L</strong>
                        </div>
                        <div style={{ background: specWh === '02' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(2, 132, 199, 0.08)', padding: '5px 8px', borderRadius: '6px', border: `1px solid ${specWh === '02' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(2, 132, 199, 0.25)'}` }}>
                          Stock en {specWh === '02' ? 'Alm 02 (Entrega)' : 'Alm 01 (Fiscal)'}: <strong style={{ color: specWh === '02' ? 'var(--motorven-emerald)' : '#38bdf8', fontSize: '0.9rem' }}>{specWhStock} unid.</strong> ({specWhLiters} L)
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                          Stock en {specWh === '02' ? 'Alm 01 (Fiscal)' : 'Alm 02 (Entrega)'}: <strong style={{ color: 'var(--text-primary)' }}>{specOtherStock} unid.</strong>
                        </div>
                        <div style={{ gridColumn: 'span 2', fontSize: '0.72rem', color: 'var(--neon-cyan)', background: 'rgba(0, 240, 255, 0.06)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                          Σ Consolidado Total (Alm 01 + Alm 02): <strong>{specStocks.total} unid.</strong> ({specTotalLiters} L)
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Precios Detal y Mayorista */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', background: 'var(--surface-input, rgba(255,255,255,0.03))', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Precio Detal</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--motorven-emerald, #10b981)', fontFamily: 'var(--font-tech)' }}>
                      {formatUsd(getProductRetailPrice(selectedSpecProduct))}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold, #f59e0b)' }}>
                      {formatBs(getProductRetailPrice(selectedSpecProduct) * (Number(config?.tasaDolar) || 886.22))}
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: '12px' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Precio Mayorista</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--motorven-cyan, #00f0ff)', fontFamily: 'var(--font-tech)' }}>
                      {formatUsd(getProductWholesalePrice(selectedSpecProduct))}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatBs(getProductWholesalePrice(selectedSpecProduct) * (Number(config?.tasaDolar) || 886.22))}
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
                      const targetWh = selectedSpecProduct?._warehouseContext || (normSelW === '01' || normSelW === '02' ? normSelW : '01');
                      setSelectedSpecProduct(null);
                      handleOpenModal(prodToEdit, targetWh);
                    }}
                    style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit2 size={14} /> Editar en este Almacén
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
