import React, { useState, useMemo } from 'react';
import {
  X, Search, ArrowUpDown, ChevronDown, ChevronUp,
  Printer, Eye, Receipt, FileText, BookOpen, Users
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateConsolidatedCxcPDF } from '../services/pdfReportService';

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

const normalizeSearch = (val) =>
  String(val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const formatDateShort = (raw) => {
  if (!raw) return '—';
  const dt = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(dt.getTime())) return String(raw).slice(0, 10);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const DOC_TYPE_BADGES = {
  FACTURA: { label: 'FACTURA', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' },
  NOTA_ENTREGA: { label: 'NOTA ENT.', color: '#fbbf24', bg: 'rgba(217, 119, 6, 0.15)', border: 'rgba(217, 119, 6, 0.35)' }
};

const STATUS_BADGES = {
  VENCIDA: { label: 'Vencida', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  POR_VENCER: { label: 'Al Día', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  PAGADA: { label: 'Solvente', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' }
};

const createEmptyAccumulator = () => ({ count: 0, monto: 0, abonos: 0, restante: 0, vencido: 0, vencidas: 0 });

const addDocToAccumulator = (acc, doc) => {
  acc.count += 1;
  acc.monto += Number(doc.montoFacturaUsd || 0);
  acc.abonos += Number(doc.abonosUsd || 0);
  acc.restante += Number(doc.restanteUsd || 0);
  if (doc.estado === 'VENCIDA') {
    acc.vencido += Number(doc.restanteUsd || 0);
    acc.vencidas += 1;
  }
  return acc;
};

const roundAccumulator = (acc) => ({
  ...acc,
  monto: round2(acc.monto),
  abonos: round2(acc.abonos),
  restante: round2(acc.restante),
  vencido: round2(acc.vencido)
});

export default function ConsolidatedCxcModal({
  isOpen,
  onClose,
  documents = [],
  tasaBcv = 1,
  onViewDetail,
  config = {},
  currentUser = null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('DOCS');
  const [sortField, setSortField] = useState('fechaEmisionIso');
  const [sortDirection, setSortDirection] = useState('desc');

  const sellerOptions = useMemo(() => {
    const map = new Map();
    documents.forEach((d) => {
      if (!d.isCarteraActiva && d.estado !== 'PAGADA') return;
      const sid = d.vendedorId || 'OF';
      if (!map.has(sid)) {
        map.set(sid, d.vendedorDisplay || d.vendedorNombre || sid);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [documents]);

  const filteredBaseDocs = useMemo(() => {
    const tokens = normalizeSearch(searchTerm).split(/\s+/).filter(Boolean);
    return documents.filter((d) => {
      const statusOk = statusFilter === 'ALL' ? d.isCarteraActiva : d.estado === statusFilter;
      if (!statusOk) return false;
      if (sellerFilter !== 'ALL' && (d.vendedorId || 'OF') !== sellerFilter) return false;
      if (tokens.length === 0) return true;
      const haystack = normalizeSearch([
        d.factura,
        String(d.factura || '').replace(/^0+/, ''),
        d.cliente,
        d.rif,
        String(d.rif || '').replace(/[-.\s]/g, ''),
        d.vendedorDisplay || d.vendedorNombre,
        d.fechaEmisionIso,
        d.tipoDoc === 'NOTA_ENTREGA' ? 'nota entrega ne' : 'factura fiscal fac',
        Number(d.montoFacturaUsd || 0).toFixed(2),
        Number(d.restanteUsd || 0).toFixed(2)
      ].join(' '));
      return tokens.every((t) => haystack.includes(t));
    });
  }, [documents, searchTerm, statusFilter, sellerFilter]);

  const summaryTotals = useMemo(() => {
    const fac = createEmptyAccumulator();
    const ne = createEmptyAccumulator();
    filteredBaseDocs.forEach((d) => {
      addDocToAccumulator(d.tipoDoc === 'NOTA_ENTREGA' ? ne : fac, d);
    });
    const all = {
      count: fac.count + ne.count,
      monto: fac.monto + ne.monto,
      abonos: fac.abonos + ne.abonos,
      restante: fac.restante + ne.restante,
      vencido: fac.vencido + ne.vencido,
      vencidas: fac.vencidas + ne.vencidas
    };
    return {
      fac: roundAccumulator(fac),
      ne: roundAccumulator(ne),
      all: roundAccumulator(all)
    };
  }, [filteredBaseDocs]);

  const visibleDocs = useMemo(() => {
    const list = typeFilter === 'ALL'
      ? filteredBaseDocs
      : filteredBaseDocs.filter((d) => d.tipoDoc === typeFilter);
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'number' || typeof bv === 'number') {
        const diff = Number(av || 0) - Number(bv || 0);
        if (diff !== 0) return diff * dir;
      } else {
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'es', { numeric: true });
        if (cmp !== 0) return cmp * dir;
      }
      return String(a.factura).localeCompare(String(b.factura), 'es', { numeric: true }) * dir;
    });
  }, [filteredBaseDocs, typeFilter, sortField, sortDirection]);

  const visibleTotals = useMemo(
    () => roundAccumulator(visibleDocs.reduce(addDocToAccumulator, createEmptyAccumulator())),
    [visibleDocs]
  );

  const clientRows = useMemo(() => {
    const map = new Map();
    visibleDocs.forEach((d) => {
      const key = d.rif && d.rif !== 'J-00000000-0' ? d.rif : normalizeSearch(d.cliente);
      if (!map.has(key)) {
        map.set(key, {
          key,
          cliente: d.cliente,
          rif: d.rif,
          fac: createEmptyAccumulator(),
          ne: createEmptyAccumulator(),
          maxDias: 0
        });
      }
      const entry = map.get(key);
      addDocToAccumulator(d.tipoDoc === 'NOTA_ENTREGA' ? entry.ne : entry.fac, d);
      entry.maxDias = Math.max(entry.maxDias, Number(d.diasVencidos || 0));
    });

    return Array.from(map.values())
      .map((c) => {
        const fac = roundAccumulator(c.fac);
        const ne = roundAccumulator(c.ne);
        return {
          ...c,
          fac,
          ne,
          totalMonto: round2(fac.monto + ne.monto),
          totalAbonos: round2(fac.abonos + ne.abonos),
          totalRestante: round2(fac.restante + ne.restante)
        };
      })
      .sort((a, b) => b.totalRestante - a.totalRestante);
  }, [visibleDocs]);

  if (!isOpen) return null;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handlePrintPdf = () => {
    const typeLabels = { ALL: 'Ambos (FAC + NE)', FACTURA: 'Solo Facturas Fiscales', NOTA_ENTREGA: 'Solo Notas de Entrega' };
    const statusLabels = { ALL: 'Cartera activa', VENCIDA: 'Vencidas', POR_VENCER: 'Al Día', PAGADA: 'Solventes' };
    const sellerLabel = sellerFilter === 'ALL'
      ? 'Todos los vendedores'
      : sellerOptions.find(([k]) => k === sellerFilter)?.[1] || sellerFilter;

    generateConsolidatedCxcPDF({
      docs: visibleDocs,
      clientRows,
      totals: summaryTotals,
      visibleTotals,
      tasaBcv,
      viewMode,
      filters: {
        typeLabel: typeLabels[typeFilter] || 'Ambos (FAC + NE)',
        statusLabel: statusLabels[statusFilter] || 'Cartera activa',
        sellerLabel,
        searchTerm
      },
      config,
      currentUser
    });
  };

  const SortIndicator = ({ field }) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
    }
    return <ArrowUpDown size={12} style={{ opacity: 0.45 }} />;
  };

  const thStyle = {
    padding: '0.7rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-header, #070c18)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    whiteSpace: 'nowrap',
    borderBottom: '2px solid var(--border-glass)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.22)'
  };
  const thNumericStyle = { ...thStyle, textAlign: 'right' };
  const tdStyle = {
    padding: '0.58rem 0.75rem',
    fontSize: '0.8rem',
    borderBottom: '1px solid var(--border-glass)',
    whiteSpace: 'nowrap'
  };
  const tdNumericStyle = { ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-code)' };
  const tfootNumericStyle = {
    ...tdNumericStyle,
    padding: '0.7rem 0.75rem',
    fontWeight: 800,
    backgroundColor: 'var(--bg-header, #070c18)',
    position: 'sticky',
    bottom: 0,
    zIndex: 20,
    borderTop: '2px solid var(--border-glass)',
    borderBottom: 'none',
    boxShadow: '0 -2px 6px rgba(0, 0, 0, 0.22)'
  };

  const SortableHeader = ({ field, label, numeric }) => (
    <th style={{ ...(numeric ? thNumericStyle : thStyle), cursor: 'pointer' }} onClick={() => handleSort(field)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label} <SortIndicator field={field} />
      </span>
    </th>
  );

  const KpiBlock = ({ title, icon, accent, data, highlight }) => (
    <div style={{
      flex: '1 1 260px',
      padding: '1rem 1.1rem',
      borderRadius: '12px',
      border: `1px solid ${highlight ? accent : 'var(--border-glass)'}`,
      borderLeft: `4px solid ${accent}`,
      background: highlight ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-surface, rgba(255,255,255,0.03))',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.45rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: accent, letterSpacing: '0.04em' }}>
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: accent }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{data.count} docs</span>
          {icon}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: '0.25rem', columnGap: '0.75rem', fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Monto total</span>
        <span style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700 }}>{formatUsd(data.monto)}</span>
        <span style={{ color: 'var(--text-muted)' }}>Abonos</span>
        <span style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: '#10b981' }}>{formatUsd(data.abonos)}</span>
        <span style={{ color: 'var(--text-muted)' }}>Saldo restante</span>
        <span style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: '#ef4444', fontWeight: 800, fontSize: highlight ? '1.05rem' : '0.9rem' }}>
          {formatUsd(data.restante)}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>Saldo en Bs.</span>
        <span style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>{formatBs(data.restante * tasaBcv)}</span>
        <span style={{ color: 'var(--text-muted)' }}>Vencido</span>
        <span style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: '#f87171' }}>
          {formatUsd(data.vencido)} <span style={{ fontSize: '0.7rem' }}>({data.vencidas})</span>
        </span>
      </div>
    </div>
  );

  const pillBtnStyle = (active, bgActive) => ({
    padding: '0.4rem 0.8rem',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    background: active ? bgActive : 'transparent',
    color: active ? '#ffffff' : 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    whiteSpace: 'nowrap'
  });

  const pillGroupStyle = {
    display: 'inline-flex',
    gap: '3px',
    padding: '3px',
    borderRadius: '10px',
    border: '1px solid var(--border-glass)',
    background: 'var(--bg-pill, rgba(255,255,255,0.06))'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-modal-overlay, rgba(3, 7, 18, 0.85))',
        backdropFilter: 'blur(8px)',
        zIndex: 9990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        background: 'var(--bg-modal, #0c1427)',
        color: 'var(--text-main, #e2e8f0)',
        border: '1px solid var(--border-glass)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1400px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-industrial)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.4rem',
          borderBottom: '1px solid var(--border-glass)',
          background: 'var(--bg-card-header)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(2,132,199,0.3), rgba(217,119,6,0.3))',
              border: '1px solid rgba(56,189,248,0.35)',
              color: '#ffffff'
            }}>
              <BookOpen size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading, #ffffff)' }}>
                CxC Consolidado — Facturas Fiscales + Notas de Entrega
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Cartera total sumada de ambos tipos de documento • Tasa BCV:{' '}
                <strong style={{ color: '#10b981', fontFamily: 'var(--font-code)' }}>{formatBs(tasaBcv)}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="btn btn-print-report"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.52rem 0.95rem', fontSize: '0.82rem' }}
              title="Exportar Reporte Oficial PDF"
            >
              <Printer size={16} color="#ffffff" />
              <span>Imprimir PDF</span>
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1, minHeight: 0 }}>
          {/* Summary equation */}
          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <KpiBlock title="Facturas Fiscales" icon={<Receipt size={16} />} accent="#38bdf8" data={summaryTotals.fac} />
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>+</div>
            <KpiBlock title="Notas de Entrega" icon={<FileText size={16} />} accent="#f59e0b" data={summaryTotals.ne} />
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>=</div>
            <KpiBlock title="Total Consolidado" icon={<BookOpen size={16} />} accent="#10b981" data={summaryTotals.all} highlight />
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por N°, cliente, RIF, vendedor, fecha o monto..."
                className="input-modern"
                style={{ width: '100%', paddingLeft: '32px' }}
              />
            </div>

            <div style={pillGroupStyle}>
              <button type="button" style={pillBtnStyle(typeFilter === 'ALL', 'linear-gradient(135deg, #059669, #047857)')} onClick={() => setTypeFilter('ALL')}>
                Ambos ({summaryTotals.all.count})
              </button>
              <button type="button" style={pillBtnStyle(typeFilter === 'FACTURA', 'linear-gradient(135deg, #002b7a, #0284c7)')} onClick={() => setTypeFilter('FACTURA')}>
                Facturas ({summaryTotals.fac.count})
              </button>
              <button type="button" style={pillBtnStyle(typeFilter === 'NOTA_ENTREGA', 'linear-gradient(135deg, #d97706, #b45309)')} onClick={() => setTypeFilter('NOTA_ENTREGA')}>
                Notas ({summaryTotals.ne.count})
              </button>
            </div>

            <div style={pillGroupStyle}>
              {[
                ['ALL', 'Cartera activa'],
                ['VENCIDA', 'Vencidas'],
                ['POR_VENCER', 'Al Día'],
                ['PAGADA', 'Solventes']
              ].map(([val, label]) => (
                <button key={val} type="button" style={pillBtnStyle(statusFilter === val, 'rgba(56, 189, 248, 0.35)')} onClick={() => setStatusFilter(val)}>
                  {label}
                </button>
              ))}
            </div>

            <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="input-modern" style={{ minWidth: '180px' }}>
              <option value="ALL">Todos los vendedores</option>
              {sellerOptions.map(([sid, sname]) => (
                <option key={sid} value={sid}>{sname}</option>
              ))}
            </select>

            <div style={pillGroupStyle}>
              <button type="button" style={pillBtnStyle(viewMode === 'DOCS', 'rgba(56, 189, 248, 0.35)')} onClick={() => setViewMode('DOCS')}>
                <FileText size={13} /> Por documento
              </button>
              <button type="button" style={pillBtnStyle(viewMode === 'CLIENTES', 'rgba(56, 189, 248, 0.35)')} onClick={() => setViewMode('CLIENTES')}>
                <Users size={13} /> Por cliente
              </button>
            </div>
          </div>

          {/* Scrollable Table */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-modal, #0c1427)',
            position: 'relative'
          }}>
            {viewMode === 'DOCS' ? (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1150px' }}>
                <thead>
                  <tr>
                    <SortableHeader field="tipoDoc" label="Tipo" />
                    <SortableHeader field="factura" label="N° Doc." />
                    <SortableHeader field="cliente" label="Cliente" />
                    <th style={thStyle}>RIF</th>
                    <SortableHeader field="vendedorId" label="Vendedor" />
                    <SortableHeader field="fechaEmisionIso" label="Emisión" />
                    <SortableHeader field="fechaVencimientoIso" label="Vence" />
                    <SortableHeader field="diasVencidos" label="Días Venc." numeric />
                    <SortableHeader field="montoFacturaUsd" label="Monto" numeric />
                    <SortableHeader field="abonosUsd" label="Abonos" numeric />
                    <SortableHeader field="restanteUsd" label="Restante" numeric />
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle} />
                  </tr>
                </thead>
                <tbody>
                  {visibleDocs.length === 0 && (
                    <tr>
                      <td colSpan={13} style={{ ...tdStyle, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No hay documentos que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                  {visibleDocs.map((doc) => {
                    const badge = DOC_TYPE_BADGES[doc.tipoDoc] || DOC_TYPE_BADGES.FACTURA;
                    const statusBadge = STATUS_BADGES[doc.estado] || STATUS_BADGES.POR_VENCER;
                    return (
                      <tr key={`${doc.tipoDoc}-${doc.factNum}-${doc.id}`}>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', fontWeight: 700, color: badge.color }}>
                          #{doc.factura}
                        </td>
                        <td style={{ ...tdStyle, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.cliente}>
                          {doc.cliente}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>{doc.rif}</td>
                        <td style={tdStyle} title={doc.vendedorDisplay || doc.vendedorNombre}>{doc.vendedorId}</td>
                        <td style={tdStyle}>{formatDateShort(doc.fechaEmision)}</td>
                        <td style={tdStyle}>{formatDateShort(doc.fechaVencimiento)}</td>
                        <td style={{ ...tdNumericStyle, color: doc.diasVencidos > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                          {doc.diasVencidos}
                        </td>
                        <td style={tdNumericStyle}>{formatUsd(doc.montoFacturaUsd)}</td>
                        <td style={{ ...tdNumericStyle, color: '#10b981' }}>{formatUsd(doc.abonosUsd)}</td>
                        <td style={{ ...tdNumericStyle, color: '#ef4444', fontWeight: 700 }}>{formatUsd(doc.restanteUsd)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', color: statusBadge.color, background: statusBadge.bg }}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {onViewDetail && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.45rem' }}
                              title="Ver detalle"
                              onClick={() => onViewDetail(doc)}
                            >
                              <Eye size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {visibleDocs.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={8} style={{ ...tfootNumericStyle, textAlign: 'left', fontFamily: 'inherit' }}>
                        TOTAL ({visibleTotals.count} documentos)
                      </td>
                      <td style={tfootNumericStyle}>{formatUsd(visibleTotals.monto)}</td>
                      <td style={{ ...tfootNumericStyle, color: '#10b981' }}>{formatUsd(visibleTotals.abonos)}</td>
                      <td style={{ ...tfootNumericStyle, color: '#ef4444' }}>{formatUsd(visibleTotals.restante)}</td>
                      <td colSpan={2} style={{ ...tfootNumericStyle, textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {formatBs(visibleTotals.restante * tasaBcv)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1100px' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Cliente</th>
                    <th style={thStyle}>RIF</th>
                    <th style={thNumericStyle}>N° Fact.</th>
                    <th style={thNumericStyle}>Saldo Facturas</th>
                    <th style={thNumericStyle}>N° Notas</th>
                    <th style={thNumericStyle}>Saldo Notas</th>
                    <th style={thNumericStyle}>Monto Total</th>
                    <th style={thNumericStyle}>Abonos</th>
                    <th style={thNumericStyle}>Saldo Total (USD)</th>
                    <th style={thNumericStyle}>Saldo Total (Bs.)</th>
                    <th style={thNumericStyle}>Máx. Días Venc.</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRows.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ ...tdStyle, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No hay clientes que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                  {clientRows.map((c) => (
                    <tr key={c.key}>
                      <td style={{ ...tdStyle, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }} title={c.cliente}>
                        {c.cliente}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>{c.rif}</td>
                      <td style={{ ...tdNumericStyle, color: '#38bdf8' }}>{c.fac.count}</td>
                      <td style={{ ...tdNumericStyle, color: '#38bdf8' }}>{formatUsd(c.fac.restante)}</td>
                      <td style={{ ...tdNumericStyle, color: '#fbbf24' }}>{c.ne.count}</td>
                      <td style={{ ...tdNumericStyle, color: '#fbbf24' }}>{formatUsd(c.ne.restante)}</td>
                      <td style={tdNumericStyle}>{formatUsd(c.totalMonto)}</td>
                      <td style={{ ...tdNumericStyle, color: '#10b981' }}>{formatUsd(c.totalAbonos)}</td>
                      <td style={{ ...tdNumericStyle, color: '#ef4444', fontWeight: 800 }}>{formatUsd(c.totalRestante)}</td>
                      <td style={{ ...tdNumericStyle, color: 'var(--text-muted)' }}>{formatBs(c.totalRestante * tasaBcv)}</td>
                      <td style={{ ...tdNumericStyle, color: c.maxDias > 0 ? '#ef4444' : 'var(--text-muted)' }}>{c.maxDias}</td>
                    </tr>
                  ))}
                </tbody>
                {clientRows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={2} style={{ ...tfootNumericStyle, textAlign: 'left', fontFamily: 'inherit' }}>
                        TOTAL ({clientRows.length} clientes)
                      </td>
                      <td style={{ ...tfootNumericStyle, color: '#38bdf8' }}>{clientRows.reduce((s, c) => s + c.fac.count, 0)}</td>
                      <td style={{ ...tfootNumericStyle, color: '#38bdf8' }}>{formatUsd(clientRows.reduce((s, c) => s + c.fac.restante, 0))}</td>
                      <td style={{ ...tfootNumericStyle, color: '#fbbf24' }}>{clientRows.reduce((s, c) => s + c.ne.count, 0)}</td>
                      <td style={{ ...tfootNumericStyle, color: '#fbbf24' }}>{formatUsd(clientRows.reduce((s, c) => s + c.ne.restante, 0))}</td>
                      <td style={tfootNumericStyle}>{formatUsd(visibleTotals.monto)}</td>
                      <td style={{ ...tfootNumericStyle, color: '#10b981' }}>{formatUsd(visibleTotals.abonos)}</td>
                      <td style={{ ...tfootNumericStyle, color: '#ef4444' }}>{formatUsd(visibleTotals.restante)}</td>
                      <td style={{ ...tfootNumericStyle, color: 'var(--text-muted)' }}>{formatBs(visibleTotals.restante * tasaBcv)}</td>
                      <td style={tfootNumericStyle} />
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
