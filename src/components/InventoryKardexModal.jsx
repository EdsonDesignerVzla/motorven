import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Plus,
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowRight,
  FileText,
  Package,
  ArrowLeftRight,
  ClipboardList,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import {
  formatUsd,
  formatBs,
  formatUnitVe,
  getProductWarehouseStocks
} from '../services/formatService';
import { toDateKey } from '../services/dashboardMetricsService';
import { generateInventoryPDF, generateWarehouseTransferOrAdjustmentPDF } from '../services/pdfReportService';
import {
  buildConsolidatedKardex,
  isDocumentAnnulled,
  resolveKardexLineCosts,
  formatKardexDocCode
} from '../utils/kardexUtils';

function formatKardexDate(rawDate) {
  if (!rawDate) return 'N/A';
  const dk = toDateKey(rawDate);
  if (dk && /^\d{4}-\d{2}-\d{2}$/.test(dk)) {
    const [y, m, d] = dk.split('-');
    return `${d}/${m}/${y}`;
  }
  return 'N/A';
}

function getAdjustmentDirectionBadge(renglones = []) {
  const list = Array.isArray(renglones) ? renglones : [];
  const hasE = list.some(r => String(r?.tipo_trans || '').toUpperCase() === 'E');
  const hasS = list.some(r => String(r?.tipo_trans || '').toUpperCase() === 'S');
  if (hasE && hasS) {
    return { label: 'MIXTO (E/S)', badgeClass: 'badge-warning' };
  }
  if (hasE) {
    return { label: 'ENTRADA (+)', badgeClass: 'badge-success' };
  }
  return { label: 'SALIDA / MERMA', badgeClass: 'badge-danger' };
}

export default function InventoryKardexModal({
  isOpen,
  onClose,
  adjustments = [],
  transfers = [],
  products = [],
  purchases = [],
  profitPurchases = [],
  goodsReceiptNotes = [],
  sales = [],
  profitInvoices = [],
  profitReturns = [],
  config = {},
  currentUser = null,
  onSyncProfit,
  onSaveTransfer,
  onSaveAdjustment
}) {
  const [activeTab, setActiveTab] = useState('ADJUSTMENTS'); // 'ADJUSTMENTS' | 'TRANSFERS' | 'KARDEX_SUMMARY'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'E' | 'S'
  const [filterWarehouse, setFilterWarehouse] = useState('ALL'); // 'ALL' | '01' | '02'
  const [adjSort, setAdjSort] = useState({ field: 'fecha', direction: 'desc' });
  const [trSort, setTrSort] = useState({ field: 'fecha', direction: 'desc' });
  const [kardexSort, setKardexSort] = useState({ field: 'codigo', direction: 'asc' });
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [savingMov, setSavingMov] = useState(false);
  const [movError, setMovError] = useState('');
  const [movSku, setMovSku] = useState('');
  const [movSkuSearch, setMovSkuSearch] = useState('');
  const [movQty, setMovQty] = useState(1);
  const [movWarehouse, setMovWarehouse] = useState('01');
  const [movDestWarehouse, setMovDestWarehouse] = useState('02');
  const [movAdjType, setMovAdjType] = useState('S'); // 'E' | 'S'
  const [movReason, setMovReason] = useState('');

  const tasaDolar = Number(config?.tasaDolar || 827.73);

  const productsBySku = useMemo(() => {
    const map = new Map();
    (products || []).forEach(p => {
      const sku = String(p?.codigo || p?.id || '').trim();
      if (sku) map.set(sku, p);
    });
    return map;
  }, [products]);

  const activeAdjustments = useMemo(
    () => (adjustments || []).filter(a => a && !isDocumentAnnulled(a)),
    [adjustments]
  );
  const activeTransfers = useMemo(
    () => (transfers || []).filter(t => t && !isDocumentAnnulled(t)),
    [transfers]
  );
  const annulledCount = Math.max(
    0,
    ((adjustments || []).length - activeAdjustments.length) +
    ((transfers || []).length - activeTransfers.length)
  );

  // Filtrar y ordenar Ajustes (excluye anulados)
  const filteredAdjustments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = activeAdjustments.filter(a => {
      const codeStr = formatKardexDocCode(a.ajueNum, 'AJU').toLowerCase();
      const matchSearch =
        !term ||
        codeStr.includes(term) ||
        String(a.ajueNum || '').toLowerCase().includes(term) ||
        String(a.motivo || '').toLowerCase().includes(term) ||
        (a.renglones || []).some(r =>
          String(r.co_art || '').toLowerCase().includes(term) ||
          String(r.art_des || '').toLowerCase().includes(term)
        );

      let matchType = true;
      if (filterType !== 'ALL') {
        matchType = (a.renglones || []).some(r => String(r.tipo_trans || '').toUpperCase() === filterType);
      }

      let matchWh = true;
      if (filterWarehouse !== 'ALL') {
        const normAlm = String(a.almacen || '').includes('02') ? '02' : (String(a.almacen || '').includes('01') ? '01' : '');
        const linesMatch = (a.renglones || []).some(r => {
          const lineAlm = String(r.co_alma || normAlm || '').trim();
          return lineAlm.includes(filterWarehouse);
        });
        matchWh = linesMatch || normAlm === filterWarehouse;
      }

      return matchSearch && matchType && matchWh;
    });

    const getDocNum = (a) => parseInt(String(a?.ajueNum || '').replace(/[^0-9]/g, ''), 10) || 0;
    const getSortVal = (a) => {
      switch (adjSort.field) {
        case 'ajueNum':
          return getDocNum(a);
        case 'fecha':
          return toDateKey(a?.fecha) || '';
        case 'motivo':
          return String(a?.motivo || 'Ajuste de inventario').toLowerCase();
        case 'tipo':
          return getAdjustmentDirectionBadge(a?.renglones).label;
        case 'items':
          return a?.renglones?.length || 0;
        case 'uds':
          return Number(a?.totalItems) || (a?.renglones || []).reduce((s, r) => s + (Number(r.total_art) || 0), 0);
        default:
          return '';
      }
    };

    const dir = adjSort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getSortVal(a);
      const vb = getSortVal(b);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp * dir;
      return (getDocNum(a) - getDocNum(b)) * dir;
    });
  }, [activeAdjustments, searchTerm, filterType, filterWarehouse, adjSort]);

  // Filtrar y ordenar Traslados (excluye anulados)
  const filteredTransfers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = activeTransfers.filter(t => {
      const codeStr = formatKardexDocCode(t.trasNum, 'TRA').toLowerCase();
      const matchSearch =
        !term ||
        codeStr.includes(term) ||
        String(t.trasNum || '').toLowerCase().includes(term) ||
        String(t.motivo || '').toLowerCase().includes(term) ||
        String(t.almOrig || '').toLowerCase().includes(term) ||
        String(t.almDest || '').toLowerCase().includes(term) ||
        (t.renglones || []).some(r =>
          String(r.co_art || '').toLowerCase().includes(term) ||
          String(r.art_des || '').toLowerCase().includes(term)
        );
      if (!matchSearch) return false;
      if (filterWarehouse !== 'ALL') {
        return String(t.almOrig || '').includes(filterWarehouse) || String(t.almDest || '').includes(filterWarehouse);
      }
      return true;
    });

    const getTrNum = (t) => parseInt(String(t?.trasNum || '').replace(/[^0-9]/g, ''), 10) || 0;
    const getSortVal = (t) => {
      switch (trSort.field) {
        case 'trasNum':
          return getTrNum(t);
        case 'fecha':
          return toDateKey(t?.fecha) || '';
        case 'uds':
          return Number(t?.totalItems) || (t?.renglones || []).reduce((s, r) => s + (Number(r.total_art) || 0), 0);
        case 'estado':
          return t?.anulada ? 'ANULADO' : 'CONFIRMADO';
        default:
          return '';
      }
    };

    const dir = trSort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getSortVal(a);
      const vb = getSortVal(b);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp * dir;
      return (getTrNum(a) - getTrNum(b)) * dir;
    });
  }, [activeTransfers, searchTerm, filterWarehouse, trSort]);

  // Estadísticas Generales con resolución real USD/Bs (evita confundir Bs de Profit como USD)
  const stats = useMemo(() => {
    let totalEntradasUnits = 0;
    let totalSalidasUnits = 0;
    let totalValorEntradasUsd = 0;
    let totalValorSalidasUsd = 0;

    activeAdjustments.forEach(a => {
      (a.renglones || []).forEach(r => {
        const qty = Number(r.total_art) || 0;
        const { costUsd } = resolveKardexLineCosts({ line: r, productsBySku, tasaDolar });
        if (String(r.tipo_trans || '').toUpperCase() === 'E') {
          totalEntradasUnits += qty;
          totalValorEntradasUsd += qty * costUsd;
        } else if (String(r.tipo_trans || '').toUpperCase() === 'S') {
          totalSalidasUnits += qty;
          totalValorSalidasUsd += qty * costUsd;
        }
      });
    });

    let totalTrasladosUnits = 0;
    activeTransfers.forEach(t => {
      const linesSum = (t.renglones || []).reduce((s, r) => s + (Number(r.total_art || 0) || 0), 0);
      totalTrasladosUnits += (Number(t.totalItems) || linesSum);
    });

    return {
      totalAdjustments: activeAdjustments.length,
      totalTransfers: activeTransfers.length,
      totalEntradasUnits,
      totalSalidasUnits,
      totalValorEntradasUsd,
      totalValorSalidasUsd,
      totalTrasladosUnits
    };
  }, [activeAdjustments, activeTransfers, productsBySku, tasaDolar]);

  // Kardex consolidado real por SKU y almacén (excluyendo anulados)
  const kardexByProduct = useMemo(() => {
    return buildConsolidatedKardex({
      products,
      adjustments: activeAdjustments,
      transfers: activeTransfers,
      purchases,
      profitPurchases,
      goodsReceiptNotes,
      sales,
      profitInvoices,
      profitReturns,
      searchTerm
    });
  }, [
    products,
    activeAdjustments,
    activeTransfers,
    purchases,
    profitPurchases,
    goodsReceiptNotes,
    sales,
    profitInvoices,
    profitReturns,
    searchTerm
  ]);

  const sortedKardexByProduct = useMemo(() => {
    const dir = kardexSort.direction === 'asc' ? 1 : -1;
    const baseList = filterWarehouse === 'ALL'
      ? kardexByProduct
      : kardexByProduct.filter(p => (filterWarehouse === '02' ? (p.stock02 || 0) > 0 : (p.stock01 || 0) > 0));
    return [...baseList].sort((a, b) => {
      const f = kardexSort.field;
      const va = a?.[f] ?? '';
      const vb = b?.[f] ?? '';
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      return cmp * dir;
    });
  }, [kardexByProduct, filterWarehouse, kardexSort]);

  const isFormDeduction = activeTab === 'TRANSFERS' || movAdjType === 'S';

  // Productos filtrados según almacén seleccionado en el formulario y bloqueo de stock 0 en salidas/mermas/traslados
  const formProductOptions = useMemo(() => {
    const q = movSkuSearch.trim().toLowerCase();
    const mapped = (products || [])
      .map(p => {
        const ws = getProductWarehouseStocks(p);
        const originStock = movWarehouse === '02' ? ws.stock02 : ws.stock01;
        const otherStock = movWarehouse === '02' ? ws.stock01 : ws.stock02;
        const code = String(p?.codigo || p?.id || '').trim();
        const desc = String(p?.descripcion || p?.nombre || code).trim();
        return {
          product: p,
          code,
          desc,
          originStock,
          otherStock,
          blocked: isFormDeduction && originStock <= 0
        };
      })
      .filter(item => !q || item.code.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

    return {
      available: mapped.filter(m => m.originStock > 0),
      outOfStock: mapped.filter(m => m.originStock <= 0)
    };
  }, [products, movWarehouse, isFormDeduction, movSkuSearch]);

  const selectedFormProdInfo = useMemo(() => {
    if (!movSku) return null;
    const p = (products || []).find(item => String(item.codigo || item.id) === movSku);
    if (!p) return null;
    const ws = getProductWarehouseStocks(p);
    const originStock = movWarehouse === '02' ? ws.stock02 : ws.stock01;
    return { p, originStock };
  }, [products, movSku, movWarehouse]);

  const syncSkuSelectionForWarehouse = (nextWh, nextIsDeduction) => {
    setMovError('');
    if (!movSku || !nextIsDeduction) return;
    const p = (products || []).find(item => String(item.codigo || item.id) === movSku);
    if (!p) {
      setMovSku('');
      return;
    }
    const ws = getProductWarehouseStocks(p);
    const st = nextWh === '02' ? ws.stock02 : ws.stock01;
    if (st <= 0) setMovSku('');
  };

  const toggleSort = (setter, field) => {
    setter((prev) => (
      prev.field === field
        ? { field, direction: prev.direction === 'desc' ? 'asc' : 'desc' }
        : { field, direction: 'desc' }
    ));
  };

  const handleTriggerSync = async () => {
    if (!onSyncProfit) return;
    setIsSyncing(true);
    try {
      await onSyncProfit();
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrint = () => {
    generateInventoryPDF({
      products: products.length > 0 ? products : [],
      config,
      currentUser
    });
  };

  const handlePrintRecordPdf = (record, mode) => {
    generateWarehouseTransferOrAdjustmentPDF({
      record: { ...record, _products: products },
      mode,
      config,
      currentUser
    });
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    setMovError('');
    const qty = Number(movQty || 0);
    if (!movSku || !(qty > 0)) {
      setMovError('Seleccione un artículo válido e indique una cantidad mayor a 0.');
      return;
    }
    const prod = products.find(p => String(p.codigo || p.id) === movSku) || null;
    if (!prod) {
      setMovError('Producto no encontrado en el catálogo.');
      return;
    }
    const wStocks = getProductWarehouseStocks(prod);
    const originStock = movWarehouse === '02' ? wStocks.stock02 : wStocks.stock01;

    if (activeTab === 'TRANSFERS') {
      if (movWarehouse === movDestWarehouse) {
        setMovError('El almacén origen y el almacén destino deben ser distintos.');
        return;
      }
      if (qty > originStock + 0.0001) {
        setMovError(`Stock insuficiente en Almacén ${movWarehouse}: disponible ${originStock}, solicitado ${qty}.`);
        return;
      }
    } else if (activeTab === 'ADJUSTMENTS' && movAdjType === 'S') {
      if (qty > originStock + 0.0001) {
        setMovError(`No puede dar salida/merma de ${qty} u. en Almacén ${movWarehouse} (disponible: ${originStock}).`);
        return;
      }
    }

    const costUsd = Number(prod.costoUnitarioUsd || prod.costoUsd || prod.precioUsd || 0);
    setSavingMov(true);
    try {
      if (activeTab === 'TRANSFERS' && onSaveTransfer) {
        const saved = await onSaveTransfer({
          almOrig: movWarehouse,
          almDest: movDestWarehouse,
          motivo: movReason.trim() || `Traslado físico Alm ${movWarehouse} -> Alm ${movDestWarehouse}`,
          coUsIn: currentUser?.nombre || currentUser?.username || 'WEB',
          renglones: [{
            co_art: prod.codigo || movSku,
            art_des: prod.descripcion || movSku,
            total_art: qty,
            uni_venta: prod.unidad || 'Caja',
            cost_unit_om: costUsd,
            cost_unit: costUsd * tasaDolar
          }]
        });
        setSelectedTransfer(saved);
        setShowNewForm(false);
        setMovReason('');
        setMovQty(1);
        handlePrintRecordPdf(saved, 'TRANSFER');
      } else if (activeTab === 'ADJUSTMENTS' && onSaveAdjustment) {
        const saved = await onSaveAdjustment({
          almacen: movWarehouse,
          motivo: movReason.trim() || (movAdjType === 'E' ? 'Ajuste de entrada / Sobrante' : 'Ajuste de salida / Merma'),
          coUsIn: currentUser?.nombre || currentUser?.username || 'WEB',
          renglones: [{
            co_art: prod.codigo || movSku,
            art_des: prod.descripcion || movSku,
            co_alma: movWarehouse,
            tipo: movAdjType === 'E' ? 'E01' : 'S02',
            tipo_trans: movAdjType,
            total_art: qty,
            uni_venta: prod.unidad || 'Caja',
            cost_unit_om: costUsd,
            cost_unit: costUsd * tasaDolar
          }]
        });
        setSelectedAdjustment(saved);
        setShowNewForm(false);
        setMovReason('');
        setMovQty(1);
        handlePrintRecordPdf(saved, 'ADJUSTMENT');
      }
    } catch (err) {
      setMovError(err?.message || 'Error al procesar el movimiento de inventario.');
    } finally {
      setSavingMov(false);
    }
  };

  if (!isOpen) return null;

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'light';

  const thStyle = {
    padding: '0.7rem 0.85rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
    background: 'var(--bg-table-header)',
    borderBottom: '1px solid var(--border-glass)',
    whiteSpace: 'nowrap'
  };

  const tdStyle = {
    padding: '0.7rem 0.85rem',
    fontSize: '0.78rem',
    color: 'var(--text-main)',
    borderBottom: '1px solid var(--border-glass)',
    verticalAlign: 'middle'
  };

  const tabButtonStyle = (isActive) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '0.6rem 1rem',
    fontSize: '0.78rem',
    fontWeight: isActive ? 800 : 600,
    color: isActive ? '#ffffff' : 'var(--text-muted)',
    background: isActive
      ? 'linear-gradient(135deg, var(--motorven-navy, #002b7a), #0284c7)'
      : 'transparent',
    border: isActive ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap'
  });

  const renderSortableTh = (label, field, sortState, setter, align = 'left', title = '') => {
    const isActive = sortState.field === field;
    const justify = align === 'right' ? 'flex-end' : (align === 'center' ? 'center' : 'flex-start');
    return (
      <th
        onClick={() => toggleSort(setter, field)}
        title={title || `Ordenar por ${label}`}
        style={{
          ...thStyle,
          textAlign: align,
          cursor: 'pointer',
          userSelect: 'none',
          color: isActive ? '#38bdf8' : 'var(--text-muted)'
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: justify, gap: '5px' }}>
          <span>{label}</span>
          {isActive ? (
            sortState.direction === 'asc'
              ? <ArrowUp size={12} color="#38bdf8" />
              : <ArrowDown size={12} color="#38bdf8" />
          ) : (
            <ArrowUpDown size={12} style={{ opacity: 0.55 }} />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="kardex-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '96vw',
          maxWidth: '1320px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '1.15rem 1.4rem',
            background: isDark
              ? 'linear-gradient(135deg, rgba(0, 43, 122, 0.5) 0%, rgba(10, 16, 32, 0.96) 100%)'
              : 'linear-gradient(135deg, #eef4ff 0%, #f8fafc 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px', flex: 1 }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--motorven-navy, #002b7a), var(--motorven-gold, #f59e0b))',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0, 43, 122, 0.35)'
              }}
            >
              <ClipboardList size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0, color: 'var(--text-heading, var(--text-main))' }}>
                  Kardex Físico, Mermas & Ajustes de Inventario
                </h2>
                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                  Supabase Oficial
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Auditoría de movimientos físicos, mermas, traslados entre almacenes y conciliación de stock en tiempo real.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(onSaveTransfer || onSaveAdjustment) && activeTab !== 'KARDEX_SUMMARY' && (
              <button
                type="button"
                onClick={() => {
                  setMovError('');
                  setShowNewForm((v) => !v);
                }}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Crear nuevo traslado entre almacenes o ajuste de inventario"
              >
                <Plus size={14} />
                <span>{showNewForm ? 'Cerrar Formulario' : (activeTab === 'TRANSFERS' ? 'Nuevo Traslado' : 'Nuevo Ajuste / Merma')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Recargar ajustes y traslados desde Supabase"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-print-report btn-sm"
              style={{ fontSize: '0.78rem' }}
            >
              <Printer size={14} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center' }}
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Formulario Inline para Nuevo Ajuste o Nuevo Traslado */}
        {showNewForm && activeTab !== 'KARDEX_SUMMARY' && (
          <form
            onSubmit={handleSaveMovement}
            style={{
              padding: '0.95rem 1.4rem',
              background: isDark ? 'rgba(12, 22, 48, 0.95)' : '#eff6ff',
              borderBottom: '1px solid var(--border-glass)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
              flexShrink: 0
            }}
          >
            {movError && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  background: 'var(--semaforo-rojo-bg, rgba(239, 68, 68, 0.14))',
                  border: '1px solid var(--semaforo-rojo, #ef4444)',
                  color: '#fca5a5',
                  fontSize: '0.76rem',
                  fontWeight: 700
                }}
              >
                <AlertTriangle size={14} />
                <span>{movError}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {activeTab === 'TRANSFERS' ? 'Origen ➔ Destino' : 'Tipo y Almacén'}
              </label>
              {activeTab === 'TRANSFERS' ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={movWarehouse}
                    onChange={(e) => {
                      const nextWh = e.target.value;
                      setMovWarehouse(nextWh);
                      setMovDestWarehouse(nextWh === '01' ? '02' : '01');
                      syncSkuSelectionForWarehouse(nextWh, true);
                    }}
                    className="form-control"
                    style={{ width: '50%', fontSize: '0.78rem', padding: '0.48rem 0.5rem' }}
                  >
                    <option value="01">Alm 01</option>
                    <option value="02">Alm 02</option>
                  </select>
                  <select
                    value={movDestWarehouse}
                    onChange={(e) => setMovDestWarehouse(e.target.value)}
                    className="form-control"
                    style={{ width: '50%', fontSize: '0.78rem', padding: '0.48rem 0.5rem' }}
                  >
                    <option value="02">Alm 02</option>
                    <option value="01">Alm 01</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={movAdjType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setMovAdjType(nextType);
                      syncSkuSelectionForWarehouse(movWarehouse, nextType === 'S');
                    }}
                    className="form-control"
                    style={{ width: '55%', fontSize: '0.78rem', padding: '0.48rem 0.5rem' }}
                  >
                    <option value="S">Salida / Merma</option>
                    <option value="E">Entrada (+)</option>
                  </select>
                  <select
                    value={movWarehouse}
                    onChange={(e) => {
                      const nextWh = e.target.value;
                      setMovWarehouse(nextWh);
                      syncSkuSelectionForWarehouse(nextWh, movAdjType === 'S');
                    }}
                    className="form-control"
                    style={{ width: '45%', fontSize: '0.78rem', padding: '0.48rem 0.5rem' }}
                  >
                    <option value="01">Alm 01</option>
                    <option value="02">Alm 02</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ gridColumn: 'span 2', minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Producto / SKU · Alm {movWarehouse} ({formProductOptions.available.length} disp.)
                </label>
                <input
                  type="text"
                  value={movSkuSearch}
                  onChange={(e) => setMovSkuSearch(e.target.value)}
                  placeholder={`Buscar en Alm ${movWarehouse}...`}
                  className="form-control"
                  style={{ width: '165px', fontSize: '0.7rem', padding: '0.22rem 0.5rem' }}
                />
              </div>
              <select
                value={movSku}
                onChange={(e) => { setMovSku(e.target.value); setMovError(''); }}
                required
                className="form-control"
                style={{ width: '100%', fontSize: '0.78rem', padding: '0.48rem 0.65rem' }}
              >
                <option value="">
                  -- Seleccionar artículo con stock en Alm {movWarehouse} ({formProductOptions.available.length}) --
                </option>
                {formProductOptions.available.length > 0 && (
                  <optgroup label={`Disponibles en Almacén ${movWarehouse} (${formProductOptions.available.length})`}>
                    {formProductOptions.available.map(({ product: p, code, desc, originStock }) => (
                      <option key={p.id || code} value={code}>
                        {code} - {desc} · Alm {movWarehouse}: {formatUnitVe(originStock, 0)} disp.
                      </option>
                    ))}
                  </optgroup>
                )}
                {formProductOptions.outOfStock.length > 0 && (
                  <optgroup
                    label={
                      isFormDeduction
                        ? `Sin existencia en Alm ${movWarehouse} — Bloqueados (${formProductOptions.outOfStock.length})`
                        : `En 0 en Alm ${movWarehouse} (${formProductOptions.outOfStock.length})`
                    }
                  >
                    {formProductOptions.outOfStock.map(({ product: p, code, desc, blocked }) => (
                      <option
                        key={p.id || code}
                        value={code}
                        disabled={blocked}
                        style={blocked ? { color: '#64748b' } : undefined}
                      >
                        {blocked ? '🔒 ' : ''}{code} - {desc} · Alm {movWarehouse}: 0{blocked ? ' (Sin stock)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Cantidad y Motivo{selectedFormProdInfo ? ` · Máx: ${formatUnitVe(selectedFormProdInfo.originStock, 0)}` : ''}
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  min="1"
                  max={isFormDeduction && selectedFormProdInfo ? Math.max(1, selectedFormProdInfo.originStock) : undefined}
                  step="1"
                  value={movQty}
                  onChange={(e) => setMovQty(e.target.value)}
                  required
                  className="form-control"
                  style={{ width: '74px', fontSize: '0.78rem', padding: '0.48rem 0.55rem' }}
                />
                <input
                  type="text"
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  placeholder="Motivo del movimiento..."
                  className="form-control"
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.48rem 0.6rem' }}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={savingMov}
                className="btn btn-success btn-sm"
                style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.78rem', justifyContent: 'center' }}
              >
                {savingMov ? 'Procesando...' : 'Guardar & Generar PDF'}
              </button>
            </div>
          </form>
        )}

        {/* Tarjetas KPI Bento */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.85rem',
            padding: '1rem 1.4rem',
            background: isDark ? 'rgba(7, 13, 30, 0.85)' : '#f8fafc',
            borderBottom: '1px solid var(--border-glass)',
            flexShrink: 0
          }}
        >
          <div className="bento-card" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Ajustes de Entrada
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Entradas</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.45rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
              +{formatUnitVe(stats.totalEntradasUnits, 0)}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>uds</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
              Valor costo ref: {formatUsd(stats.totalValorEntradasUsd)}
            </div>
          </div>

          <div className="bento-card" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Salidas & Mermas
              </span>
              <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Salidas / Merma</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.45rem', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
              -{formatUnitVe(stats.totalSalidasUnits, 0)}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>uds</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
              Valor costo ref: {formatUsd(stats.totalValorSalidasUsd)}
            </div>
          </div>

          <div className="bento-card" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #38bdf8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Traslados entre Almacenes
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>Alm 01 ↔ 02</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.45rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
              {stats.totalTransfers}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>traslados</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
              {formatUnitVe(stats.totalTrasladosUnits, 0)} unidades movilizadas
            </div>
          </div>

          <div className="bento-card" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid var(--motorven-gold, #f59e0b)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Documentos Auditados
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Vigentes</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
              {stats.totalAdjustments + stats.totalTransfers}{' '}
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>docs</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Conciliado con Supabase{annulledCount > 0 ? ` · ${annulledCount} anulados excluidos` : ''}
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación + Barra de Búsqueda */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.75rem 1.4rem',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-glass)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('ADJUSTMENTS');
                setSelectedAdjustment(null);
                setSelectedTransfer(null);
                syncSkuSelectionForWarehouse(movWarehouse, movAdjType === 'S');
              }}
              style={tabButtonStyle(activeTab === 'ADJUSTMENTS')}
            >
              <FileText size={14} />
              <span>Ajustes & Mermas ({filteredAdjustments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('TRANSFERS');
                setSelectedTransfer(null);
                setSelectedAdjustment(null);
                syncSkuSelectionForWarehouse(movWarehouse, true);
              }}
              style={tabButtonStyle(activeTab === 'TRANSFERS')}
            >
              <ArrowLeftRight size={14} />
              <span>Traslados entre Almacenes ({filteredTransfers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('KARDEX_SUMMARY'); setShowNewForm(false); setSelectedAdjustment(null); setSelectedTransfer(null); }}
              style={tabButtonStyle(activeTab === 'KARDEX_SUMMARY')}
            >
              <Package size={14} />
              <span>Matriz Consolidada ({sortedKardexByProduct.length} SKUs)</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end', minWidth: '240px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '320px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                placeholder="Buscar por N° doc, SKU, lubricante o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.78rem', paddingTop: '0.45rem', paddingBottom: '0.45rem' }}
              />
            </div>

            <select
              value={filterWarehouse}
              onChange={(e) => {
                const nextWh = e.target.value;
                setFilterWarehouse(nextWh);
                if (nextWh === '01' || nextWh === '02') {
                  setMovWarehouse(nextWh);
                  setMovDestWarehouse(nextWh === '01' ? '02' : '01');
                  syncSkuSelectionForWarehouse(nextWh, activeTab === 'TRANSFERS' || movAdjType === 'S');
                }
              }}
              className="form-control"
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.65rem', width: 'auto', minWidth: '160px' }}
              title="Filtrar movimientos y stock por Almacén"
            >
              <option value="ALL">Todos los Almacenes</option>
              <option value="01">Almacén 01 (Principal)</option>
              <option value="02">Almacén 02 (Central)</option>
            </select>

            {activeTab === 'ADJUSTMENTS' && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="form-control"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.65rem', width: 'auto', minWidth: '170px' }}
              >
                <option value="ALL">Todos los Movimientos</option>
                <option value="E">Entradas (E01)</option>
                <option value="S">Salidas / Mermas (S02)</option>
              </select>
            )}
          </div>
        </div>

        {/* Contenido Scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.1rem 1.4rem' }}>

          {/* VISTA 1: AJUSTES DE INVENTARIO & MERMAS */}
          {activeTab === 'ADJUSTMENTS' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: selectedAdjustment ? 'minmax(0, 1.15fr) minmax(0, 0.95fr)' : '1fr',
                gap: '1rem',
                alignItems: 'start'
              }}
            >
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        {renderSortableTh('N° Ajuste', 'ajueNum', adjSort, setAdjSort, 'left', 'Ordenar por N° Ajuste')}
                        {renderSortableTh('Fecha', 'fecha', adjSort, setAdjSort, 'left', 'Ordenar por Fecha')}
                        {renderSortableTh('Motivo / Concepto', 'motivo', adjSort, setAdjSort, 'left', 'Ordenar por Motivo')}
                        {renderSortableTh('Tipo', 'tipo', adjSort, setAdjSort, 'center', 'Ordenar por Tipo')}
                        {renderSortableTh('Items', 'items', adjSort, setAdjSort, 'center', 'Ordenar por Renglones')}
                        {renderSortableTh('Uds', 'uds', adjSort, setAdjSort, 'center', 'Ordenar por Unidades')}
                        <th style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdjustments.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                            No se encontraron ajustes o mermas con los filtros aplicados.
                          </td>
                        </tr>
                      ) : filteredAdjustments.map((a) => {
                        const isSelected = selectedAdjustment?.id === a.id;
                        const dir = getAdjustmentDirectionBadge(a.renglones);
                        const docCode = formatKardexDocCode(a.ajueNum, 'AJU');
                        const docUnits = Number(a.totalItems) || (a.renglones || []).reduce((s, r) => s + (Number(r.total_art) || 0), 0);

                        return (
                          <tr
                            key={a.id}
                            onClick={() => setSelectedAdjustment(a)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(2, 132, 199, 0.14)' : 'transparent',
                              boxShadow: isSelected ? 'inset 3px 0 0 #38bdf8' : 'none',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                              {docCode}
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {formatKardexDate(a.fecha)}
                            </td>
                            <td style={tdStyle}>
                              <div
                                style={{ fontWeight: 600, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={a.motivo || 'Ajuste de inventario'}
                              >
                                {a.motivo || 'Ajuste de inventario'}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                Sucursal: {a.coSucu || '01'} · Usuario: {a.coUsIn || 'PROFIT'}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span className={`badge ${dir.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                                {dir.label}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>
                              {a.renglones?.length || 0}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>
                              {formatUnitVe(docUnits, 0)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintRecordPdf(a, 'ADJUSTMENT');
                                  }}
                                  className="btn btn-sm"
                                  style={{
                                    padding: '4px 9px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: 'rgba(16, 185, 129, 0.16)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.38)'
                                  }}
                                  title="Generar comprobante PDF"
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAdjustment(isSelected ? null : a);
                                  }}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 9px', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye size={12} />
                                  <span>{isSelected ? 'Ocultar' : 'Detalle'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel Detalle Ajuste */}
              {selectedAdjustment && (
                <div className="bento-card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Comprobante de Ajuste / Merma
                      </div>
                      <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-heading, var(--text-main))' }}>
                        {formatKardexDocCode(selectedAdjustment.ajueNum, 'AJU')}
                      </h4>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Fecha: {formatKardexDate(selectedAdjustment.fecha)} · Usuario: {selectedAdjustment.coUsIn || 'PROFIT'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge ${selectedAdjustment.anulada ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.68rem' }}>
                        {selectedAdjustment.anulada ? 'ANULADO' : 'PROCESADO'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedAdjustment(null)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 6px' }}
                        title="Cerrar panel de detalle"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', fontSize: '0.76rem' }}>
                    <strong style={{ color: 'var(--text-muted)' }}>Motivo: </strong>
                    <span style={{ color: 'var(--text-main)' }}>
                      {selectedAdjustment.motivo || 'Ajuste regular de existencias en planta'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Renglones Afectados ({selectedAdjustment.renglones?.length || 0})
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-glass)', background: 'var(--bg-card)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Artículo / SKU</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Mov.</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Cant.</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Costo Unit ($)</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Costo Unit (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedAdjustment.renglones || []).map((r, idx) => {
                          const { costUsd, costBs } = resolveKardexLineCosts({
                            line: r,
                            productsBySku,
                            tasaDolar
                          });
                          const isEnt = String(r.tipo_trans || '').toUpperCase() === 'E';
                          return (
                            <tr key={idx}>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 700, fontSize: '0.76rem' }}>{r.art_des || r.co_art}</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                  SKU: {r.co_art} · Alm: {r.co_alma || '01'}
                                </div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span className={`badge ${isEnt ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.64rem' }}>
                                  {r.tipo || (isEnt ? 'E01' : 'S02')}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {formatUnitVe(r.total_art || 0, 0)}{' '}
                                <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                  {r.uni_venta || 'Und'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {formatUsd(costUsd)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {formatBs(costBs)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: TRASLADOS FÍSICOS ENTRE ALMACENES */}
          {activeTab === 'TRANSFERS' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: selectedTransfer ? 'minmax(0, 1.15fr) minmax(0, 0.95fr)' : '1fr',
                gap: '1rem',
                alignItems: 'start'
              }}
            >
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        {renderSortableTh('N° Traslado', 'trasNum', trSort, setTrSort, 'left', 'Ordenar por N° Traslado')}
                        {renderSortableTh('Fecha', 'fecha', trSort, setTrSort, 'left', 'Ordenar por Fecha')}
                        <th style={thStyle}>Ruta Alm. Origen ➔ Destino</th>
                        {renderSortableTh('Unidades', 'uds', trSort, setTrSort, 'center', 'Ordenar por Unidades')}
                        {renderSortableTh('Estado', 'estado', trSort, setTrSort, 'center', 'Ordenar por Estado')}
                        <th style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                            No se encontraron traslados vigentes entre almacenes.
                          </td>
                        </tr>
                      ) : filteredTransfers.map((t) => {
                        const isSelected = selectedTransfer?.id === t.id;
                        const docCode = formatKardexDocCode(t.trasNum, 'TRA');
                        const docUnits = Number(t.totalItems) || (t.renglones || []).reduce((s, r) => s + (Number(r.total_art) || 0), 0);

                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTransfer(t)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(2, 132, 199, 0.14)' : 'transparent',
                              boxShadow: isSelected ? 'inset 3px 0 0 #38bdf8' : 'none',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                              {docCode}
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {formatKardexDate(t.fecha)}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                                  Alm {t.almOrig || '01'}
                                </span>
                                <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                                <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                                  Alm {t.almDest || '02'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                {t.motivo || 'Movimiento interno entre plantas'}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>
                              {formatUnitVe(docUnits, 0)}{' '}
                              <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>uds</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span className={`badge ${t.anulada ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                                {t.anulada ? 'ANULADO' : 'CONFIRMADO'}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintRecordPdf(t, 'TRANSFER');
                                  }}
                                  className="btn btn-sm"
                                  style={{
                                    padding: '4px 9px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: 'rgba(16, 185, 129, 0.16)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.38)'
                                  }}
                                  title="Imprimir nota de traslado PDF"
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTransfer(isSelected ? null : t);
                                  }}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 9px', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye size={12} />
                                  <span>{isSelected ? 'Ocultar' : 'Detalle'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel Detalle Traslado */}
              {selectedTransfer && (
                <div className="bento-card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Comprobante de Traslado
                      </div>
                      <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-heading, var(--text-main))' }}>
                        {formatKardexDocCode(selectedTransfer.trasNum, 'TRA')}
                      </h4>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Fecha: {formatKardexDate(selectedTransfer.fecha)} · Usuario: {selectedTransfer.coUsIn || 'PROFIT'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                        Alm {selectedTransfer.almOrig} ➔ Alm {selectedTransfer.almDest}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTransfer(null)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 6px' }}
                        title="Cerrar panel de detalle"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', fontSize: '0.76rem' }}>
                    <strong style={{ color: 'var(--text-muted)' }}>Observación: </strong>
                    <span style={{ color: 'var(--text-main)' }}>
                      {selectedTransfer.motivo || 'Movimiento interno entre almacenes'}
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-glass)', background: 'var(--bg-card)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Código / Lubricante</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Cant.</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Costo Unit ($)</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Costo Unit (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTransfer.renglones || []).map((r, idx) => {
                          const { costUsd, costBs } = resolveKardexLineCosts({
                            line: r,
                            productsBySku,
                            tasaDolar
                          });
                          return (
                            <tr key={idx}>
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 700, fontSize: '0.76rem' }}>{r.art_des || r.co_art}</div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                  SKU: {r.co_art}
                                </div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {formatUnitVe(r.total_art || 0, 0)}{' '}
                                <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                  {r.uni_venta || 'Und'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {formatUsd(costUsd)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {formatBs(costBs)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 3: MATRIZ CONSOLIDADA DE KARDEX POR SKU */}
          {activeTab === 'KARDEX_SUMMARY' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      {renderSortableTh('Código', 'codigo', kardexSort, setKardexSort, 'left')}
                      {renderSortableTh('Descripción de Lubricante', 'descripcion', kardexSort, setKardexSort, 'left')}
                      <th style={thStyle}>Viscosidad</th>
                      {renderSortableTh('Compras (+)', 'entradasCompras', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Ventas (-)', 'salidasVentas', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Devol. (+)', 'devolucionesClientes', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Aj. Ent (+)', 'entradasAjuste', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Aj. Sal (-)', 'salidasAjuste', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Traslados', 'traslados', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Alm 01', 'stock01', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Alm 02', 'stock02', kardexSort, setKardexSort, 'center')}
                      {renderSortableTh('Stock Total', 'stockActual', kardexSort, setKardexSort, 'right')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKardexByProduct.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ ...tdStyle, textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                          No se encontraron productos coincidentes en el Kardex consolidado.
                        </td>
                      </tr>
                    ) : sortedKardexByProduct.map((p) => (
                      <tr key={p.codigo}>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                          {p.codigo}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          {p.descripcion}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.64rem' }}>
                            {p.viscosidad}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: p.entradasCompras > 0 ? '#22d3ee' : 'var(--text-muted)' }}>
                          {p.entradasCompras > 0 ? `+${formatUnitVe(p.entradasCompras, 0)}` : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: p.salidasVentas > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                          {p.salidasVentas > 0 ? `-${formatUnitVe(p.salidasVentas, 0)}` : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: p.devolucionesClientes > 0 ? '#2dd4bf' : 'var(--text-muted)' }}>
                          {p.devolucionesClientes > 0 ? `+${formatUnitVe(p.devolucionesClientes, 0)}` : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: p.entradasAjuste > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {p.entradasAjuste > 0 ? `+${formatUnitVe(p.entradasAjuste, 0)}` : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: p.salidasAjuste > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                          {p.salidasAjuste > 0 ? `-${formatUnitVe(p.salidasAjuste, 0)}` : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: p.traslados > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                          {p.traslados > 0 ? formatUnitVe(p.traslados, 0) : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                          {formatUnitVe(p.stock01, 0)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                          {formatUnitVe(p.stock02, 0)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          {formatUnitVe(p.stockActual, 0)}{' '}
                          <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                            {p.unidad}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div
          style={{
            padding: '0.85rem 1.4rem',
            background: isDark ? 'rgba(7, 13, 30, 0.92)' : '#f1f5f9',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            flexShrink: 0
          }}
        >
          <div>
            Auditando <strong style={{ color: 'var(--text-main)' }}>{activeAdjustments.length}</strong> ajustes y{' '}
            <strong style={{ color: 'var(--text-main)' }}>{activeTransfers.length}</strong> traslados vigentes sincronizados con Supabase (anulados excluidos).
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ fontWeight: 700, padding: '0.45rem 1.1rem' }}
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
