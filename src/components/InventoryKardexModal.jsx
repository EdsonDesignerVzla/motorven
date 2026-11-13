import React, { useState, useMemo } from 'react';
import { X, Printer, Plus, AlertTriangle } from 'lucide-react';
import { formatBs, formatNumberUs, formatUnitVe, getProductWarehouseStocks, resolveProductUnit } from '../services/formatService';
import { generateInventoryPDF, generateWarehouseTransferOrAdjustmentPDF } from '../services/pdfReportService';
import { buildConsolidatedKardex, isDocumentAnnulled } from '../utils/kardexUtils';

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
  const [activeTab, setActiveTab] = useState('ADJUSTMENTS'); // 'ADJUSTMENTS', 'TRANSFERS', 'KARDEX_SUMMARY'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'E', 'S'
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [savingMov, setSavingMov] = useState(false);
  const [movError, setMovError] = useState('');
  const [movSku, setMovSku] = useState('');
  const [movQty, setMovQty] = useState(1);
  const [movWarehouse, setMovWarehouse] = useState('01');
  const [movDestWarehouse, setMovDestWarehouse] = useState('02');
  const [movAdjType, setMovAdjType] = useState('S'); // 'E' entrada, 'S' salida/merma
  const [movReason, setMovReason] = useState('');

  const tasaDolar = Number(config?.tasaDolar || 1);

  const activeAdjustments = useMemo(() => (adjustments || []).filter(a => a && !isDocumentAnnulled(a)), [adjustments]);
  const activeTransfers = useMemo(() => (transfers || []).filter(t => t && !isDocumentAnnulled(t)), [transfers]);

  // Filtrar Ajustes (excluye anulados)
  const filteredAdjustments = useMemo(() => {
    return activeAdjustments.filter(a => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        String(a.ajueNum || '').toLowerCase().includes(term) ||
        (a.motivo || '').toLowerCase().includes(term) ||
        (a.renglones || []).some(r =>
          (r.co_art || '').toLowerCase().includes(term) ||
          (r.art_des || '').toLowerCase().includes(term)
        );

      let matchType = true;
      if (filterType !== 'ALL') {
        matchType = (a.renglones || []).some(r => r.tipo_trans === filterType);
      }

      return matchSearch && matchType;
    });
  }, [activeAdjustments, searchTerm, filterType]);

  // Filtrar Traslados (excluye anulados)
  const filteredTransfers = useMemo(() => {
    return activeTransfers.filter(t => {
      const term = searchTerm.toLowerCase();
      return (
        String(t.trasNum || '').toLowerCase().includes(term) ||
        (t.motivo || '').toLowerCase().includes(term) ||
        (t.almOrig || '').toLowerCase().includes(term) ||
        (t.almDest || '').toLowerCase().includes(term) ||
        (t.renglones || []).some(r =>
          (r.co_art || '').toLowerCase().includes(term) ||
          (r.art_des || '').toLowerCase().includes(term)
        )
      );
    });
  }, [activeTransfers, searchTerm]);

  // Estadísticas Generales (excluye anulados)
  const stats = useMemo(() => {
    let totalEntradasUnits = 0;
    let totalSalidasUnits = 0;
    let totalValorEntradasUsd = 0;
    let totalValorSalidasUsd = 0;

    activeAdjustments.forEach(a => {
      (a.renglones || []).forEach(r => {
        const qty = Number(r.total_art) || 0;
        const costUsd = Number(r.cost_unit_om) || 0;
        if (r.tipo_trans === 'E') {
          totalEntradasUnits += qty;
          totalValorEntradasUsd += qty * costUsd;
        } else if (r.tipo_trans === 'S') {
          totalSalidasUnits += qty;
          totalValorSalidasUsd += qty * costUsd;
        }
      });
    });

    let totalTrasladosUnits = 0;
    activeTransfers.forEach(t => {
      totalTrasladosUnits += (t.totalItems || 0);
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
  }, [activeAdjustments, activeTransfers]);

  // Kardex consolidado real por SKU y almacén (Compras + Recepciones + Ventas + Devoluciones + Ajustes + Traslados, sin anulados)
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
  }, [products, activeAdjustments, activeTransfers, purchases, profitPurchases, goodsReceiptNotes, sales, profitInvoices, profitReturns, searchTerm]);

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

  if (!isOpen) return null;

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div className="modal-overlay print:p-0 print:bg-white" onClick={onClose}>
      <div className="kardex-modal-container print:max-h-none print:border-none print:shadow-none" onClick={(e) => e.stopPropagation()}>
        
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: isDark
              ? 'linear-gradient(135deg, rgba(0, 43, 122, 0.45) 0%, rgba(10, 16, 32, 0.95) 100%)'
              : 'linear-gradient(135deg, #eef4ff 0%, #f8fafc 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          className="print:hidden"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-gold))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem'
            }}>
              📊
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  Kardex Físico, Mermas & Ajustes de Inventario
                </h2>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                  Supabase Oficial
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Auditoría de movimientos físicos, mermas, traslados entre plantas y conciliación de stock en tiempo real.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(onSaveTransfer || onSaveAdjustment) && activeTab !== 'KARDEX_SUMMARY' && (
              <button
                onClick={() => setShowNewForm((v) => !v)}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.78rem', fontWeight: 700 }}
                title="Crear nuevo traslado entre almacenes o ajuste de inventario"
              >
                <Plus size={14} />
                <span>{showNewForm ? 'Cerrar Formulario' : (activeTab === 'TRANSFERS' ? 'Nuevo Traslado' : 'Nuevo Ajuste / Merma')}</span>
              </button>
            )}
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem' }}
              title="Recargar ajustes desde Supabase"
            >
              <span className={isSyncing ? "animate-spin" : ""}>🔄</span>
              {isSyncing ? "Sincronizando..." : "Sincronizar"}
            </button>
            <button
              onClick={handlePrint}
              className="btn btn-print-report btn-sm"
              style={{ fontSize: '0.78rem' }}
            >
              <Printer size={14} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-icon"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: '8px', padding: '6px' }}
              title="Cerrar modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Formulario inline para Nuevo Traslado o Nuevo Ajuste */}
        {showNewForm && activeTab !== 'KARDEX_SUMMARY' && (
          <form
            onSubmit={async (e) => {
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
                  generateWarehouseTransferOrAdjustmentPDF({ record: saved, mode: 'TRANSFER', config, currentUser });
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
                  generateWarehouseTransferOrAdjustmentPDF({ record: saved, mode: 'ADJUSTMENT', config, currentUser });
                }
              } catch (err) {
                setMovError(err?.message || 'Error al procesar el movimiento de inventario.');
              } finally {
                setSavingMov(false);
              }
            }}
            className="p-4 bg-blue-50/60 dark:bg-[#0c1630] border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-3 items-end print:hidden"
          >
            {movError && (
              <div className="md:col-span-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-600 dark:text-red-300 text-xs font-bold">
                <AlertTriangle size={14} />
                <span>{movError}</span>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Producto / SKU</label>
              <select
                value={movSku}
                onChange={(e) => { setMovSku(e.target.value); setMovError(''); }}
                required
                className="w-full px-2.5 py-2 bg-white dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="">-- Seleccionar artículo --</option>
                {products.map((p) => {
                  const ws = getProductWarehouseStocks(p);
                  return (
                    <option key={p.id || p.codigo} value={p.codigo || p.id}>
                      {p.codigo} - {p.descripcion} (Alm01: {ws.stock01} | Alm02: {ws.stock02})
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {activeTab === 'TRANSFERS' ? 'Origen ➔ Destino' : 'Tipo y Almacén'}
              </label>
              {activeTab === 'TRANSFERS' ? (
                <div className="flex gap-1.5">
                  <select value={movWarehouse} onChange={(e) => { setMovWarehouse(e.target.value); setMovDestWarehouse(e.target.value === '01' ? '02' : '01'); }} className="w-1/2 px-2 py-2 bg-white dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                    <option value="01">Alm 01</option>
                    <option value="02">Alm 02</option>
                  </select>
                  <select value={movDestWarehouse} onChange={(e) => setMovDestWarehouse(e.target.value)} className="w-1/2 px-2 py-2 bg-white dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                    <option value="02">Alm 02</option>
                    <option value="01">Alm 01</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <select value={movAdjType} onChange={(e) => setMovAdjType(e.target.value)} className="w-1/2 px-2 py-2 bg-white dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                    <option value="S">Salida / Merma</option>
                    <option value="E">Entrada (+)</option>
                  </select>
                  <select value={movWarehouse} onChange={(e) => setMovWarehouse(e.target.value)} className="w-1/2 px-2 py-2 bg-white dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                    <option value="01">Alm 01</option>
                    <option value="02">Alm 02</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Cant. / Motivo</label>
              <div className="flex gap-1.5">
                <input type="number" min="1" step="1" value={movQty} onChange={(e) => setMovQty(e.target.value)} required className="w-20 px-2 py-2 bg-white dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs" />
                <input type="text" value={movReason} onChange={(e) => setMovReason(e.target.value)} placeholder="Motivo" className="flex-1 px-2 py-2 bg-white dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs" />
              </div>
            </div>
            <div>
              <button type="submit" disabled={savingMov} className="w-full py-2 px-3 bg-[#002b7a] hover:bg-blue-800 text-white rounded-lg text-xs font-bold">
                {savingMov ? 'Procesando...' : 'Guardar & PDF'}
              </button>
            </div>
          </form>
        )}

        {/* Tarjetas KPI de Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 dark:bg-[#070d1e] border-b border-slate-200 dark:border-slate-800">
          <div className="bg-white dark:bg-[#0b1329] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ajustes de Entrada
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              +{formatUnitVe(stats.totalEntradasUnits, 0)} <span className="text-sm font-medium text-slate-400">uds</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Valor: ${formatNumberUs(stats.totalValorEntradasUsd)}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0b1329] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Salidas & Mermas
            </div>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
              -{formatUnitVe(stats.totalSalidasUnits, 0)} <span className="text-sm font-medium text-slate-400">uds</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Valor: ${formatNumberUs(stats.totalValorSalidasUsd)}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0b1329] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Traslados entre Almacenes
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {stats.totalTransfers} <span className="text-sm font-medium text-slate-400">traslados</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {stats.totalTrasladosUnits} unidades movilizadas
            </div>
          </div>

          <div className="bg-white dark:bg-[#0b1329] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Documentos Auditados
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {stats.totalAdjustments + stats.totalTransfers} <span className="text-sm font-medium text-slate-400">docs</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              100% conciliado con Supabase
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Modal */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#070d1e] px-5 pt-3 gap-2">
          <button
            onClick={() => { setActiveTab('ADJUSTMENTS'); setSelectedAdjustment(null); }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all ${
              activeTab === 'ADJUSTMENTS'
                ? 'bg-white dark:bg-[#0b1329] text-[#002b7a] dark:text-blue-400 border-t-2 border-t-[#002b7a] dark:border-t-blue-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📋 Ajustes de Inventario & Mermas ({adjustments.length})
          </button>
          <button
            onClick={() => { setActiveTab('TRANSFERS'); setSelectedTransfer(null); }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all ${
              activeTab === 'TRANSFERS'
                ? 'bg-white dark:bg-[#0b1329] text-[#002b7a] dark:text-blue-400 border-t-2 border-t-[#002b7a] dark:border-t-blue-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🔄 Traslados Físicos entre Almacenes ({transfers.length})
          </button>
          <button
            onClick={() => setActiveTab('KARDEX_SUMMARY')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all ${
              activeTab === 'KARDEX_SUMMARY'
                ? 'bg-white dark:bg-[#0b1329] text-[#002b7a] dark:text-blue-400 border-t-2 border-t-[#002b7a] dark:border-t-blue-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📦 Matriz Consolidada de Kardex ({products.length} SKUs)
          </button>
        </div>

        {/* Barra de Filtro y Búsqueda */}
        <div className="p-4 bg-white dark:bg-[#0b1329] border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between print:hidden">
          <div className="relative flex-1 min-w-[260px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar por N° Documento, Código, Descripción de Lubricante o Almacén..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002b7a]"
            />
          </div>

          {activeTab === 'ADJUSTMENTS' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tipo Movimiento:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-[#070d1e] border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002b7a]"
              >
                <option value="ALL">Todos los Movimientos</option>
                <option value="E">🟢 Entradas (E01)</option>
                <option value="S">🔴 Salidas / Mermas (S02)</option>
              </select>
            </div>
          )}
        </div>

        {/* Contenido según Pestaña Activa */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* VISTA 1: AJUSTES DE INVENTARIO */}
          {activeTab === 'ADJUSTMENTS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className={`space-y-3 ${selectedAdjustment ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
                <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#070d1e]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3">N° Ajuste</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Motivo / Concepto</th>
                        <th className="p-3 text-center">Tipo</th>
                        <th className="p-3 text-center">Renglones</th>
                        <th className="p-3 text-center">Total Uds</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAdjustments.map((a) => {
                        const isSelected = selectedAdjustment?.id === a.id;
                        const dateStr = a.fecha ? new Date(a.fecha).toLocaleDateString('es-VE') : 'N/A';
                        const firstType = a.renglones?.[0]?.tipo_trans || 'E';
                        const isEntrada = firstType === 'E';

                        return (
                          <tr
                            key={a.id}
                            onClick={() => setSelectedAdjustment(a)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-[#002b7a] dark:border-l-blue-500'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="p-3 font-mono font-bold text-[#002b7a] dark:text-blue-400">
                              AJU-{String(a.ajueNum).padStart(6, '0')}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">
                              {dateStr}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 max-w-[240px] truncate" title={a.motivo}>
                                {a.motivo || 'Ajuste de inventario'}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Sucursal: {a.coSucu} | Usuario: {a.coUsIn}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isEntrada
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                              }`}>
                                {isEntrada ? '🟢 ENTRADA' : '🔴 SALIDA/MERMA'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                              {a.renglones?.length || 0}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100">
                              {a.totalItems}
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateWarehouseTransferOrAdjustmentPDF({ record: a, mode: 'ADJUSTMENT', config, currentUser });
                                  }}
                                  className="px-2 py-1 text-[11px] font-semibold bg-emerald-600/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white rounded transition-colors"
                                  title="Imprimir comprobante de ajuste PDF"
                                >
                                  PDF
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAdjustment(a);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#002b7a]/10 text-[#002b7a] dark:bg-blue-500/20 dark:text-blue-300 hover:bg-[#002b7a] hover:text-white rounded transition-colors"
                                >
                                  Ver Detalle
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

              {/* Panel Lateral de Detalle del Ajuste */}
              {selectedAdjustment && (
                <div className="lg:col-span-6 bg-slate-50 dark:bg-[#070d1e] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div>
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Comprobante de Ajuste
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        AJU-{String(selectedAdjustment.ajueNum).padStart(6, '0')}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      {selectedAdjustment.anulada ? 'ANULADO' : 'PROCESADO'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#0b1329] p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Motivo: </span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {selectedAdjustment.motivo || 'Ajuste regular de existencias en planta'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Renglones Afectados ({selectedAdjustment.renglones?.length || 0})
                    </div>

                    <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0b1329]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                            <th className="p-2.5">Código / Artículo</th>
                            <th className="p-2.5 text-center">Tipo</th>
                            <th className="p-2.5 text-center">Cant.</th>
                            <th className="p-2.5 text-right">Costo Unit ($)</th>
                            <th className="p-2.5 text-right">Costo Unit (Bs.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {(selectedAdjustment.renglones || []).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {r.art_des || r.co_art}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Cód: {r.co_art} | Alm: {r.co_alma}
                                </div>
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  r.tipo_trans === 'E'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                }`}>
                                  {r.tipo} ({r.tipo_trans === 'E' ? 'Entrada' : 'Salida'})
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-900 dark:text-slate-100">
                                {r.total_art} <span className="text-[10px] font-normal text-slate-400">{r.uni_venta}</span>
                              </td>
                              <td className="p-2.5 text-right text-slate-700 dark:text-slate-300">
                                ${formatNumberUs(r.cost_unit_om || 0)}
                              </td>
                              <td className="p-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                                {formatBs(Number(r.cost_unit || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* VISTA 2: TRASLADOS ENTRE ALMACENES */}
          {activeTab === 'TRANSFERS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className={`space-y-3 ${selectedTransfer ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
                <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#070d1e]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3">N° Traslado</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Alm. Origen ➔ Alm. Destino</th>
                        <th className="p-3 text-center">Unidades</th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTransfers.map((t) => {
                        const isSelected = selectedTransfer?.id === t.id;
                        const dateStr = t.fecha ? new Date(t.fecha).toLocaleDateString('es-VE') : 'N/A';

                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTransfer(t)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-[#002b7a] dark:border-l-blue-500'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="p-3 font-mono font-bold text-[#002b7a] dark:text-blue-400">
                              TRA-{String(t.trasNum).padStart(6, '0')}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">
                              {dateStr}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">
                                  Alm {t.almOrig}
                                </span>
                                <span>➔</span>
                                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[11px]">
                                  Alm {t.almDest}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {t.motivo || 'Movimiento interno entre plantas'}
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100">
                              {t.totalItems} <span className="text-[10px] font-normal text-slate-400">uds</span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                t.anulada
                                  ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                              }`}>
                                {t.anulada ? 'ANULADO' : 'CONFIRMADO'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateWarehouseTransferOrAdjustmentPDF({ record: t, mode: 'TRANSFER', config, currentUser });
                                  }}
                                  className="px-2 py-1 text-[11px] font-semibold bg-emerald-600/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white rounded transition-colors"
                                  title="Imprimir nota de traslado PDF"
                                >
                                  PDF
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTransfer(t);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#002b7a]/10 text-[#002b7a] dark:bg-blue-500/20 dark:text-blue-300 hover:bg-[#002b7a] hover:text-white rounded transition-colors"
                                >
                                  Ver Detalle
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

              {/* Panel Lateral de Detalle del Traslado */}
              {selectedTransfer && (
                <div className="lg:col-span-6 bg-slate-50 dark:bg-[#070d1e] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div>
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Comprobante de Traslado
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        TRA-{String(selectedTransfer.trasNum).padStart(6, '0')}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                      Ruta: Alm {selectedTransfer.almOrig} ➔ Alm {selectedTransfer.almDest}
                    </span>
                  </div>

                  <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0b1329]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-2.5">Código / Lubricante</th>
                          <th className="p-2.5 text-center">Cant.</th>
                          <th className="p-2.5 text-right">Costo Promedio ($)</th>
                          <th className="p-2.5 text-right">Costo Promedio (Bs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(selectedTransfer.renglones || []).map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {r.art_des || r.co_art}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Cód: {r.co_art}
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-900 dark:text-slate-100">
                              {r.total_art} <span className="text-[10px] font-normal text-slate-400">{r.uni_venta}</span>
                            </td>
                            <td className="p-2.5 text-right text-slate-700 dark:text-slate-300">
                              ${formatNumberUs(r.cost_unit_om || 0)}
                            </td>
                            <td className="p-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                              {formatBs(Number(r.cost_unit || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* VISTA 3: MATRIZ KARDEX POR SKU */}
          {activeTab === 'KARDEX_SUMMARY' && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#070d1e]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3">Código</th>
                    <th className="p-3">Descripción de Lubricante</th>
                    <th className="p-3">Viscosidad</th>
                    <th className="p-3 text-center">Compras (+)</th>
                    <th className="p-3 text-center">Ventas (-)</th>
                    <th className="p-3 text-center">Devol. (+)</th>
                    <th className="p-3 text-center">Aj. Ent (+)</th>
                    <th className="p-3 text-center">Aj. Sal (-)</th>
                    <th className="p-3 text-center">Traslados</th>
                    <th className="p-3 text-center">Alm 01</th>
                    <th className="p-3 text-center">Alm 02</th>
                    <th className="p-3 text-right">Stock Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {kardexByProduct.map((p) => (
                    <tr key={p.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-[#002b7a] dark:text-blue-400">
                        {p.codigo}
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                        {p.descripcion}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.viscosidad}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-cyan-600 dark:text-cyan-400">
                        {p.entradasCompras > 0 ? `+${formatUnitVe(p.entradasCompras, 0)}` : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">
                        {p.salidasVentas > 0 ? `-${formatUnitVe(p.salidasVentas, 0)}` : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-teal-600 dark:text-teal-400">
                        {p.devolucionesClientes > 0 ? `+${formatUnitVe(p.devolucionesClientes, 0)}` : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {p.entradasAjuste > 0 ? `+${formatUnitVe(p.entradasAjuste, 0)}` : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-red-600 dark:text-red-400">
                        {p.salidasAjuste > 0 ? `-${formatUnitVe(p.salidasAjuste, 0)}` : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {p.traslados > 0 ? formatUnitVe(p.traslados, 0) : '-'}
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {formatUnitVe(p.stock01, 0)}
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {formatUnitVe(p.stock02, 0)}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                        {formatUnitVe(p.stockActual, 0)} <span className="text-[10px] font-normal text-slate-400">{p.unidad}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Pie del Modal */}
        <div className="p-4 bg-slate-100 dark:bg-[#070d1e] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 print:hidden">
          <div>
            Auditando <strong>{activeAdjustments.length}</strong> ajustes y <strong>{activeTransfers.length}</strong> traslados vigentes sincronizados con Supabase (anulados excluidos).
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  );
}
