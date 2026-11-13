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
import { formatBs, formatNumberUs, round2 } from '../services/formatService';
import { generateSalesPOSPDF, generateCreditDebitNotePDF } from '../services/pdfReportService';
import { Plus } from 'lucide-react';

export default function CustomerReturnsModal({
  isOpen,
  onClose,
  profitReturns = [],
  clients = [],
  products = [],
  sales = [],
  profitInvoices = [],
  config = {},
  currentUser = null,
  onSyncProfit,
  onSaveCustomerReturn
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [filterSeller, setFilterSeller] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'WITH_NC' | 'WITHOUT_NC'
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [savingReturn, setSavingReturn] = useState(false);
  const [retClientCode, setRetClientCode] = useState('');
  const [retFactNum, setRetFactNum] = useState('');
  const [retProductCode, setRetProductCode] = useState('');
  const [retQty, setRetQty] = useState(1);
  const [retReason, setRetReason] = useState('Devolución de mercancía / Garantía');
  const [retWarehouse, setRetWarehouse] = useState('01');
  const [retReenterStock, setRetReenterStock] = useState(true);

  const tasaDolar = Number(config?.tasaDolar || 1);

  const buildNcDocForReturn = (ret) => {
    const items = (ret?.renglones || []).map(it => ({
      codigo: it.co_art || it.codigo,
      descripcion: it.art_des || it.co_art || 'Artículo devuelto',
      unidad: it.uni_venta || 'Caja',
      cantidad: Number(it.total_art || it.cantidad || 1),
      precioUnitUsd: Number(it.prec_vta || 0),
      totalUsd: Number(it.reng_neto || (Number(it.total_art || 1) * Number(it.prec_vta || 0)))
    }));
    const totNeto = Number(ret?.totNeto || items.reduce((s, x) => s + x.totalUsd, 0) || 0);
    const subtotal = Number(ret?.totBruto || totNeto);
    const iva = Number(ret?.iva || 0);
    return {
      tipoDoc: 'NOTA_CREDITO',
      numeroDoc: ret?.ncNum ? `NC-${ret.ncNum}` : `NC-${String(ret?.factNum || '000000').replace(/^NC-/i, '')}`,
      documentoAfectado: ret?.factNum || ret?.renglones?.[0]?.fact_origen || 'S/N',
      fecha: ret?.fecEmis || new Date().toISOString(),
      clienteNombre: ret?.cliDes || ret?.coCli || 'Cliente',
      clienteRif: ret?.rif || ret?.coCli || 'N/A',
      tasaDolar: Number(ret?.tasa || tasaDolar || 1),
      subtotalUsd: subtotal,
      ivaUsd: iva,
      totalUsd: totNeto,
      observaciones: ret?.descrip || 'Devolución de mercancía',
      items
    };
  };

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
      totalMontoUsd: round2(totalMontoUsd),
      totalMontoBs: round2(totalMontoUsd * tasaDolar),
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onSaveCustomerReturn && (
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Registrar nueva devolución y generar Nota de Crédito"
              >
                <Plus size={14} /> {showCreateForm ? 'Cerrar Formulario' : 'Nueva Devolución / NC'}
              </button>
            )}

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

        {/* Formulario Rápido Nueva Devolución / Nota de Crédito */}
        {showCreateForm && onSaveCustomerReturn && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!retClientCode || !retProductCode || Number(retQty) <= 0) return;
              const cli = clients.find(c => String(c.id || c.coCli || c.rif) === retClientCode) || clients[0] || {};
              const prod = products.find(p => String(p.codigo || p.id) === retProductCode) || {};
              const unitUsd = Number(prod.precioUsd || prod.precVta1 || 0);
              const qty = Number(retQty || 1);
              const subUsd = Number((unitUsd * qty).toFixed(2));
              const ivaUsd = Number((subUsd * 0.16).toFixed(2));
              const totUsd = Number((subUsd + ivaUsd).toFixed(2));
              const ncCode = `NC-${Date.now().toString().slice(-6)}`;
              setSavingReturn(true);
              try {
                const saved = await onSaveCustomerReturn({
                  factNum: retFactNum.trim() || 'DIRECTA',
                  ncNum: ncCode,
                  coCli: cli.coCli || cli.id || 'CLI-GEN',
                  cliDes: cli.cliDes || cli.nombre || 'Cliente General',
                  rif: cli.rif || 'N/A',
                  descrip: retReason.trim() || 'Devolución de mercancía',
                  totBruto: subUsd,
                  iva: ivaUsd,
                  totNeto: totUsd,
                  tasa: tasaDolar,
                  moneda: 'USD',
                  almacen: retWarehouse,
                  reenterStock: retReenterStock,
                  renglones: [
                    {
                      co_art: prod.codigo || retProductCode,
                      art_des: prod.descripcion || retProductCode,
                      total_art: qty,
                      uni_venta: prod.unidad || 'Caja',
                      prec_vta: unitUsd,
                      reng_neto: subUsd,
                      fact_origen: retFactNum.trim() || ''
                    }
                  ]
                });
                setSelectedReturn(saved);
                setShowCreateForm(false);
                generateCreditDebitNotePDF({ docData: buildNcDocForReturn(saved), config, currentUser });
              } finally {
                setSavingReturn(false);
              }
            }}
            style={{
              padding: '1rem 1.5rem',
              background: 'var(--bg-card-glass)',
              borderBottom: '1px solid var(--border-glass)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0.65rem',
              alignItems: 'end'
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>Cliente</label>
              <select className="input-field" value={retClientCode} onChange={(e) => setRetClientCode(e.target.value)} required style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }}>
                <option value="">-- Seleccionar cliente --</option>
                {clients.slice(0, 250).map((c) => (
                  <option key={c.id || c.coCli} value={String(c.id || c.coCli || c.rif)}>
                    {c.nombre || c.cliDes} ({c.rif || c.coCli})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>Factura Afectada</label>
              <input
                type="text"
                className="input-field"
                value={retFactNum}
                onChange={(e) => setRetFactNum(e.target.value)}
                placeholder="Ej. FAC-000124"
                list="return-invoices-list"
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }}
              />
              <datalist id="return-invoices-list">
                {[...(sales || []), ...(profitInvoices || [])].slice(0, 60).map((s, idx) => (
                  <option key={s.id || idx} value={s.numeroDoc || s.factNum || ''} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>Producto Devuelto</label>
              <select className="input-field" value={retProductCode} onChange={(e) => setRetProductCode(e.target.value)} required style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }}>
                <option value="">-- Seleccionar SKU --</option>
                {products.map((p) => (
                  <option key={p.id || p.codigo} value={p.codigo || p.id}>
                    {p.codigo} - {p.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>Cantidad / Alm.</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" min="1" step="1" className="input-field" value={retQty} onChange={(e) => setRetQty(e.target.value)} required style={{ width: '75px', padding: '0.45rem', fontSize: '0.8rem' }} />
                <select className="input-field" value={retWarehouse} onChange={(e) => setRetWarehouse(e.target.value)} style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}>
                  <option value="01">Alm 01</option>
                  <option value="02">Alm 02</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>Motivo / Reingreso</label>
              <input type="text" className="input-field" value={retReason} onChange={(e) => setRetReason(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={retReenterStock} onChange={(e) => setRetReenterStock(e.target.checked)} />
                Reingresar al stock físico
              </label>
            </div>
            <div>
              <button type="submit" disabled={savingReturn} className="btn btn-primary btn-sm" style={{ width: '100%', fontWeight: 700, padding: '0.55rem' }}>
                {savingReturn ? 'Emitiendo...' : 'Registrar & Emitir NC PDF'}
              </button>
            </div>
          </form>
        )}

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
              ${formatNumberUs(stats.totalMontoUsd)}
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
              Tasa BCV: {formatBs(tasaDolar)}
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
                              ${formatNumberUs(montoUsd)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--motorven-gold)', fontWeight: 600 }}>
                              {formatBs(montoUsd * tasaDolar)}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateCreditDebitNotePDF({ docData: buildNcDocForReturn(ret), config, currentUser });
                                }}
                                className="btn btn-sm btn-secondary"
                                style={{ padding: '3px 7px', fontSize: '0.7rem', color: '#c084fc' }}
                                title="Generar e imprimir Nota de Crédito oficial tamaño Carta"
                              >
                                <Printer size={12} /> NC PDF
                              </button>
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
                            </div>
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
                            ${formatNumberUs(item.prec_vta || 0)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--font-tech)' }}>
                            ${formatNumberUs(item.reng_neto || 0)}
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
                  <strong style={{ color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)' }}>{formatBs(selectedReturn.tasa || 1)}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--neon-cyan)', fontFamily: 'var(--font-tech)' }}>
                    Total Neto: ${formatNumberUs(selectedReturn.totNeto || 0)}
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
