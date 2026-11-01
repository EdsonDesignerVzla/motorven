import React, { useState, useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import { formatBs } from '../services/formatService';
import { generateInventoryPDF } from '../services/pdfReportService';

export default function InventoryKardexModal({
  isOpen,
  onClose,
  adjustments = [],
  transfers = [],
  products = [],
  config = {},
  currentUser = null,
  onSyncProfit
}) {
  const [activeTab, setActiveTab] = useState('ADJUSTMENTS'); // 'ADJUSTMENTS', 'TRANSFERS', 'KARDEX_SUMMARY'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'E', 'S'
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const tasaDolar = Number(config?.tasaDolar || 1);

  // Filtrar Ajustes
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter(a => {
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
  }, [adjustments, searchTerm, filterType]);

  // Filtrar Traslados
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
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
  }, [transfers, searchTerm]);

  // Estadísticas Generales
  const stats = useMemo(() => {
    let totalEntradasUnits = 0;
    let totalSalidasUnits = 0;
    let totalValorEntradasUsd = 0;
    let totalValorSalidasUsd = 0;

    adjustments.forEach(a => {
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
    transfers.forEach(t => {
      totalTrasladosUnits += (t.totalItems || 0);
    });

    return {
      totalAdjustments: adjustments.length,
      totalTransfers: transfers.length,
      totalEntradasUnits,
      totalSalidasUnits,
      totalValorEntradasUsd,
      totalValorSalidasUsd,
      totalTrasladosUnits
    };
  }, [adjustments, transfers]);

  // Kardex consolidado por SKU
  const kardexByProduct = useMemo(() => {
    const map = {};
    products.forEach(p => {
      map[p.codigo] = {
        codigo: p.codigo,
        descripcion: p.descripcion,
        viscosidad: p.viscosidad,
        stockActual: p.stock || 0,
        unidad: p.unidad || 'Caja (12L)',
        entradasAjuste: 0,
        salidasAjuste: 0,
        traslados: 0
      };
    });

    adjustments.forEach(a => {
      (a.renglones || []).forEach(r => {
        const cArt = r.co_art;
        if (!map[cArt]) {
          map[cArt] = {
            codigo: cArt,
            descripcion: r.art_des || cArt,
            viscosidad: 'N/A',
            stockActual: 0,
            unidad: r.uni_venta || 'Unidad',
            entradasAjuste: 0,
            salidasAjuste: 0,
            traslados: 0
          };
        }
        if (r.tipo_trans === 'E') {
          map[cArt].entradasAjuste += (r.total_art || 0);
        } else {
          map[cArt].salidasAjuste += (r.total_art || 0);
        }
      });
    });

    transfers.forEach(t => {
      (t.renglones || []).forEach(r => {
        const cArt = r.co_art;
        if (map[cArt]) {
          map[cArt].traslados += (r.total_art || 0);
        }
      });
    });

    return Object.values(map).filter(p => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.codigo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
      );
    });
  }, [products, adjustments, transfers, searchTerm]);

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* Tarjetas KPI de Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 dark:bg-[#070d1e] border-b border-slate-200 dark:border-slate-800">
          <div className="bg-white dark:bg-[#0b1329] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ajustes de Entrada
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              +{stats.totalEntradasUnits} <span className="text-sm font-medium text-slate-400">uds</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Valor: ${stats.totalValorEntradasUsd.toFixed(2)}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0b1329] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Salidas & Mermas
            </div>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
              -{stats.totalSalidasUnits} <span className="text-sm font-medium text-slate-400">uds</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Valor: ${stats.totalValorSalidasUsd.toFixed(2)}
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAdjustment(a);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-[#002b7a]/10 text-[#002b7a] dark:bg-blue-500/20 dark:text-blue-300 hover:bg-[#002b7a] hover:text-white rounded transition-colors"
                              >
                                Ver Detalle
                              </button>
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
                                ${Number(r.cost_unit_om || 0).toFixed(2)}
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTransfer(t);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-[#002b7a]/10 text-[#002b7a] dark:bg-blue-500/20 dark:text-blue-300 hover:bg-[#002b7a] hover:text-white rounded transition-colors"
                              >
                                Ver Detalle
                              </button>
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
                              ${Number(r.cost_unit_om || 0).toFixed(2)}
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
            <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#070d1e]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3">Código</th>
                    <th className="p-3">Descripción de Lubricante</th>
                    <th className="p-3">Viscosidad</th>
                    <th className="p-3 text-center">Entradas Ajuste</th>
                    <th className="p-3 text-center">Salidas / Mermas</th>
                    <th className="p-3 text-center">Traslados</th>
                    <th className="p-3 text-right">Existencia Físico en Planta</th>
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
                      <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {p.entradasAjuste > 0 ? `+${p.entradasAjuste}` : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-red-600 dark:text-red-400">
                        {p.salidasAjuste > 0 ? `-${p.salidasAjuste}` : '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {p.traslados > 0 ? p.traslados : '-'}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                        {p.stockActual} <span className="text-[10px] font-normal text-slate-400">{p.unidad}</span>
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
            Auditando <strong>{adjustments.length}</strong> ajustes y <strong>{transfers.length}</strong> traslados sincronizados con Supabase.
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
