import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Printer,
  RefreshCw,
  X,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  Coins,
  PackageCheck,
  ChevronRight,
  UserCheck,
  Calendar,
  Tag,
  ArrowRight,
  ShieldCheck,
  Receipt,
  Info
} from 'lucide-react';
import { formatBs } from '../services/formatService';
import { generateSalesPOSPDF } from '../services/pdfReportService';

export default function CustomerReturnsModal({
  isOpen,
  onClose,
  profitReturns = [],
  config = {},
  currentUser = null,
  onSyncProfit
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [filterSeller, setFilterSeller] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'WITH_NC' | 'WITHOUT_NC'
  const [isSyncing, setIsSyncing] = useState(false);

  const tasaDolar = Number(config?.tasaDolar || 1);

  // Listado de vendedores únicos para el filtro
  const uniqueSellers = useMemo(() => {
    const sellers = new Set();
    profitReturns.forEach(r => {
      if (r.venDes) sellers.add(r.venDes);
      else if (r.coVen) sellers.add(r.coVen);
    });
    return Array.from(sellers).sort();
  }, [profitReturns]);

  // Filtrar devoluciones
  const filteredReturns = useMemo(() => {
    return profitReturns.filter(r => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        String(r.factNum || '').toLowerCase().includes(term) ||
        String(r.ncNum || '').toLowerCase().includes(term) ||
        (r.cliDes || '').toLowerCase().includes(term) ||
        (r.rif || '').toLowerCase().includes(term) ||
        (r.descrip || '').toLowerCase().includes(term) ||
        (r.venDes || '').toLowerCase().includes(term);

      const matchSeller =
        filterSeller === 'ALL' ||
        r.venDes === filterSeller ||
        r.coVen === filterSeller;

      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'WITH_NC' && Boolean(r.ncNum)) ||
        (filterStatus === 'WITHOUT_NC' && !r.ncNum);

      return matchSearch && matchSeller && matchStatus;
    });
  }, [profitReturns, searchTerm, filterSeller, filterStatus]);

  // Totales y Estadísticas
  const stats = useMemo(() => {
    let totalMontoUsd = 0;
    let totalItemsDevueltos = 0;
    let notasCreditoCount = 0;

    profitReturns.forEach(r => {
      const monto = r.moneda === 'US$' ? (r.totNeto || 0) : (r.totNeto || 0) / (r.tasa || tasaDolar || 1);
      totalMontoUsd += monto;
      if (r.ncNum) notasCreditoCount++;
      (r.renglones || []).forEach(item => {
        totalItemsDevueltos += (item.total_art || 0);
      });
    });

    return {
      totalCount: profitReturns.length,
      totalMontoUsd,
      totalMontoBs: totalMontoUsd * tasaDolar,
      totalItemsDevueltos,
      notasCreditoCount
    };
  }, [profitReturns, tasaDolar]);

  const handlePrint = () => {
    generateSalesPOSPDF({
      sales: filteredReturns.length > 0 ? filteredReturns : profitReturns,
      config,
      currentUser,
      tipoDoc: 'DEVOLUCIONES_CLIENTES'
    });
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

  if (!isOpen) return null;

  return (
    <div className="returns-modal-overlay">
      <div className="returns-modal-container">
        
        {/* Cabecera del Modal */}
        <div className="returns-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'rgba(230, 0, 18, 0.15)',
              border: '1px solid var(--motorven-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--motorven-red)',
              boxShadow: 'var(--motorven-red-glow)'
            }}>
              <RotateCcw size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  Control de Devoluciones, Garantías & Notas de Crédito
                </h2>
                <span className="badge badge-success" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                  Supabase Oficial
                </span>
                <span className="badge badge-info" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="live-dot"></span> Tiempo Real
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Auditoría de retorno de mercancía, reingreso a stock y emisión de N/CR fiscales en tiempo real.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700 }}
              title="Recargar devoluciones desde Supabase"
            >
              <RefreshCw size={14} className={isSyncing ? "spin" : ""} color="var(--neon-cyan)" />
              {isSyncing ? "Sincronizando..." : "Sincronizar"}
            </button>
            
            <button
              onClick={handlePrint}
              className="btn btn-print-report btn-sm"
            >
              <Printer size={14} color="#ffffff" /> Imprimir Reporte
            </button>

            <button
              onClick={onClose}
              className="close-btn"
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Resumen */}
        <div className="returns-kpi-bar">
          <div className="returns-kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Total Devoluciones
              </span>
              <FileText size={18} color="var(--motorven-cyan)" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--text-heading)', marginTop: '4px' }}>
              {stats.totalCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>docs</span>
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--motorven-cyan)', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} /> {stats.notasCreditoCount} con Nota de Crédito
            </div>
          </div>

          <div className="returns-kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Monto Total Acreditado ($)
              </span>
              <DollarSign size={18} color="var(--motorven-red)" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)', marginTop: '4px' }}>
              ${stats.totalMontoUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Valor neto en divisas ($)
            </div>
          </div>

          <div className="returns-kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Monto en Bolívares (Bs.)
              </span>
              <Coins size={18} color="var(--motorven-gold)" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--text-heading)', marginTop: '4px' }}>
              {formatBs(stats.totalMontoBs)}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--motorven-gold)', fontWeight: 700, marginTop: '4px' }}>
              Tasa BCV: Bs. {tasaDolar.toFixed(2)}
            </div>
          </div>

          <div className="returns-kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Unidades / Cajas Devueltas
              </span>
              <PackageCheck size={18} color="var(--motorven-emerald)" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--motorven-emerald)', marginTop: '4px' }}>
              {stats.totalItemsDevueltos} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>uds</span>
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Reingresadas a almacén principal
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="returns-filter-bar">
          <div className="search-wrapper" style={{ flex: 1, minWidth: '280px' }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Buscar por N° Devolución (DEV-), Cliente, RIF, N/CR o Motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{ fontSize: '0.825rem', height: '36px' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 3 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--bg-btn-secondary)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <button
                className="btn btn-sm"
                onClick={() => setFilterStatus('ALL')}
                style={{
                  background: filterStatus === 'ALL' ? 'var(--motorven-navy)' : 'transparent',
                  color: filterStatus === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  padding: '4px 10px'
                }}
              >
                Todas ({profitReturns.length})
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setFilterStatus('WITH_NC')}
                style={{
                  background: filterStatus === 'WITH_NC' ? 'var(--motorven-navy)' : 'transparent',
                  color: filterStatus === 'WITH_NC' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  padding: '4px 10px'
                }}
              >
                Con N/CR ({stats.notasCreditoCount})
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setFilterStatus('WITHOUT_NC')}
                style={{
                  background: filterStatus === 'WITHOUT_NC' ? 'var(--motorven-navy)' : 'transparent',
                  color: filterStatus === 'WITHOUT_NC' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  padding: '4px 10px'
                }}
              >
                Sin N/CR ({stats.totalCount - stats.notasCreditoCount})
              </button>
            </div>

            <select
              value={filterSeller}
              onChange={(e) => setFilterSeller(e.target.value)}
              className="form-control filter-select"
              style={{ width: 'auto', minWidth: '180px', height: '36px', fontSize: '0.8rem' }}
            >
              <option value="ALL">Todos los Vendedores ({uniqueSellers.length})</option>
              {uniqueSellers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla Principal y Panel Detalle */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'grid', gridTemplateColumns: selectedReturn ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
          
          {/* Listado de Devoluciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Devoluciones Registradas ({filteredReturns.length})
              </span>
              {selectedReturn && (
                <button
                  onClick={() => setSelectedReturn(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={13} /> Cerrar detalle
                </button>
              )}
            </div>

            {filteredReturns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-card-glass)', borderRadius: '14px', border: '1px dashed var(--border-glass)' }}>
                <RotateCcw size={36} color="var(--text-muted)" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                  No se encontraron devoluciones que coincidan con la búsqueda.
                </p>
              </div>
            ) : (
              <div className="table-container" style={{ margin: 0 }}>
                <table className="custom-table" style={{ fontSize: '0.825rem' }}>
                  <thead>
                    <tr>
                      <th>Doc / N°</th>
                      <th>Fecha</th>
                      <th>Cliente / RIF</th>
                      <th>Asesor</th>
                      <th style={{ textAlign: 'center' }}>N/CR</th>
                      <th style={{ textAlign: 'right' }}>Monto Total</th>
                      <th style={{ textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.map((ret) => {
                      const isSelected = selectedReturn?.id === ret.id;
                      const dateStr = ret.fecEmis ? new Date(ret.fecEmis).toLocaleDateString('es-VE') : 'N/A';
                      const montoUsd = ret.moneda === 'US$' ? ret.totNeto : ret.totNeto / (ret.tasa || tasaDolar || 1);

                      return (
                        <tr
                          key={ret.id}
                          onClick={() => setSelectedReturn(ret)}
                          className={`returns-table-row ${isSelected ? 'selected' : ''}`}
                        >
                          <td style={{ fontFamily: 'var(--font-code)', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                            DEV-{String(ret.factNum).padStart(6, '0')}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontSize: '0.775rem' }}>
                            {dateStr}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ret.cliDes}>
                              {ret.cliDes || ret.coCli}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-code)' }}>
                              {ret.rif || ret.coCli}
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {ret.venDes || ret.coVen || 'Oficina'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {ret.ncNum ? (
                              <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                                NC-{ret.ncNum}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Sin N/CR</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--font-tech)' }}>
                              ${montoUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--motorven-gold)', fontWeight: 600 }}>
                              {formatBs(montoUsd * tasaDolar)}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReturn(ret);
                              }}
                              className="btn btn-sm btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.725rem', color: 'var(--neon-cyan)' }}
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
            )}
          </div>

          {/* Panel Lateral: Ficha Técnica de Devolución & Renglones */}
          {selectedReturn && (
            <div className="returns-detail-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--neon-cyan)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                    Ficha de Devolución
                  </div>
                  <h4 style={{ fontFamily: 'var(--font-tech)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                    DEV-{String(selectedReturn.factNum).padStart(6, '0')}
                  </h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {selectedReturn.ncNum && (
                    <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                      Nota de Crédito: #{selectedReturn.ncNum}
                    </span>
                  )}
                  <span className={`badge ${selectedReturn.anulada ? 'badge-danger' : 'badge-success'}`}>
                    {selectedReturn.anulada ? 'ANULADA' : 'PROCESADA'}
                  </span>
                </div>
              </div>

              {/* Datos del Cliente y Asesor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Cliente / Razón Social:
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                    {selectedReturn.cliDes}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    RIF: {selectedReturn.rif || selectedReturn.coCli}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Asesor Comercial:
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px' }}>
                    {selectedReturn.venDes || selectedReturn.coVen}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Fecha: {selectedReturn.fecEmis ? new Date(selectedReturn.fecEmis).toLocaleDateString('es-VE') : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Motivo / Concepto */}
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--motorven-gold)' }}>Motivo / Observación: </span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {selectedReturn.descrip || 'Sin motivo especificado'}
                </span>
              </div>

              {/* Renglones / Artículos Devueltos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                  <span>Productos Reingresados ({selectedReturn.renglones?.length || 0})</span>
                  <span style={{ color: 'var(--motorven-emerald)' }}>Almacén Principal</span>
                </div>

                <div className="table-container" style={{ margin: 0, maxHeight: '220px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Fact. Origen</th>
                        <th>Producto</th>
                        <th style={{ textAlign: 'center' }}>Cant.</th>
                        <th style={{ textAlign: 'right' }}>P. Unit ($)</th>
                        <th style={{ textAlign: 'right' }}>Total ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReturn.renglones || []).map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'var(--font-code)', color: 'var(--neon-cyan)', fontWeight: 700 }}>
                            {item.fact_origen ? `FAC-${item.fact_origen}` : 'Directo'}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.art_des || item.co_art}
                            </div>
                            <div style={{ fontSize: '0.675rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-code)' }}>
                              Cód: {item.co_art}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-heading)' }}>
                            {item.total_art} <span style={{ fontSize: '0.675rem', fontWeight: 400, color: 'var(--text-muted)' }}>{item.uni_venta}</span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                            ${Number(item.prec_vta || 0).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--font-tech)' }}>
                            ${Number(item.reng_neto || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen Financiero del Documento */}
              <div style={{ background: 'var(--bg-btn-secondary)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Tasa de Cambio Aplicada: </span>
                  <strong style={{ color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)' }}>Bs. {Number(selectedReturn.tasa || 1).toFixed(2)}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--neon-cyan)', fontFamily: 'var(--font-tech)' }}>
                    Total Neto: ${Number(selectedReturn.totNeto || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--motorven-gold)', fontWeight: 700 }}>
                    {formatBs(Number(selectedReturn.totNeto || 0) * (selectedReturn.tasa || tasaDolar))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div style={{ padding: '0.85rem 1.75rem', background: 'var(--bg-modal)', borderTop: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
          <div>
            Mostrando <strong>{filteredReturns.length}</strong> de <strong>{profitReturns.length}</strong> devoluciones registradas en Supabase.
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ fontWeight: 700 }}
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  );
}
