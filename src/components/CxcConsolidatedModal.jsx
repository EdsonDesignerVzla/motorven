import React, { useMemo, useState } from 'react';
import { X, Layers, Receipt, FileText, Search, Users, ArrowUpDown, ChevronUp, ChevronDown, Eye, Printer } from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateConsolidatedCxcPDF } from '../services/pdfReportService';
import DatePeriodFilter from './DatePeriodFilter';
import { createDefaultDatePeriodFilter, matchesDatePeriodFilter } from '../utils/dateRangeFilterUtils';

/**
 * MODAL CONSOLIDADO CxC — Facturas Fiscales + Notas de Entrega
 * Muestra en una sola vista la cartera de ambos tipos de documento con sus montos sumados,
 * desglose por tipo, detalle por documento y resumen consolidado por cliente.
 */

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

const normalize = (str) =>
    String(str ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const formatDate = (d) => {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '—';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const TYPE_STYLES = {
    FACTURA: { label: 'FACTURA', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' },
    NOTA_ENTREGA: { label: 'NOTA ENT.', color: '#fbbf24', bg: 'rgba(217, 119, 6, 0.15)', border: 'rgba(217, 119, 6, 0.35)' }
};

const STATUS_STYLES = {
    VENCIDA: { label: 'Vencida', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    POR_VENCER: { label: 'Al Día', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    PAGADA: { label: 'Solvente', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' }
};

const emptyTotals = () => ({ count: 0, monto: 0, abonos: 0, restante: 0, vencido: 0, vencidas: 0 });

const accumulate = (acc, doc) => {
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

const finalize = (t) => ({
    ...t,
    monto: round2(t.monto),
    abonos: round2(t.abonos),
    restante: round2(t.restante),
    vencido: round2(t.vencido)
});

export function CxcConsolidatedModal({ isOpen, onClose, documents = [], tasaBcv = 1, onViewDetail, config = {}, currentUser = null }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | FACTURA | NOTA_ENTREGA
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | VENCIDA | POR_VENCER | PAGADA
    const [sellerFilter, setSellerFilter] = useState('ALL');
    const [datePeriodFilter, setDatePeriodFilter] = useState(() => createDefaultDatePeriodFilter('EXACT'));
    const [viewMode, setViewMode] = useState('DOCS'); // DOCS | CLIENTES
    const [sortField, setSortField] = useState('fechaEmisionIso');
    const [sortDirection, setSortDirection] = useState('desc');

    // Opciones de vendedor
    const sellerOptions = useMemo(() => {
        const map = new Map();
        documents.forEach(d => {
            if (!d.isCarteraActiva && d.estado !== 'PAGADA') return;
            const id = d.vendedorId || 'OF';
            if (!map.has(id)) map.set(id, d.vendedorDisplay || id);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
    }, [documents]);

    // Filtro base (búsqueda + vendedor + estado). El tipo se aplica después para que las tarjetas de desglose
    // siempre muestren ambos tipos y su suma.
    const baseFiltered = useMemo(() => {
        const tokens = normalize(searchTerm).split(/\s+/).filter(Boolean);
        return documents.filter(doc => {
            const matchesStatus = statusFilter === 'ALL' ? doc.isCarteraActiva : doc.estado === statusFilter;
            if (!matchesStatus) return false;
            if (sellerFilter !== 'ALL' && (doc.vendedorId || 'OF') !== sellerFilter) return false;
            if (!matchesDatePeriodFilter(doc.fechaEmisionIso || doc.fechaEmision, datePeriodFilter)) return false;
            if (tokens.length === 0) return true;
            const blob = normalize([
                doc.factura,
                String(doc.factura || '').replace(/^0+/, ''),
                doc.cliente,
                doc.rif,
                String(doc.rif || '').replace(/[-.\s]/g, ''),
                doc.vendedorDisplay,
                doc.fechaEmisionIso,
                doc.tipoDoc === 'NOTA_ENTREGA' ? 'nota entrega ne' : 'factura fiscal fac',
                Number(doc.montoFacturaUsd || 0).toFixed(2),
                Number(doc.restanteUsd || 0).toFixed(2)
            ].join(' '));
            return tokens.every(t => blob.includes(t));
        });
    }, [documents, searchTerm, statusFilter, sellerFilter, datePeriodFilter]);

    // Totales por tipo y consolidados
    const totals = useMemo(() => {
        const fac = emptyTotals();
        const ne = emptyTotals();
        baseFiltered.forEach(doc => {
            if (doc.tipoDoc === 'NOTA_ENTREGA') accumulate(ne, doc);
            else accumulate(fac, doc);
        });
        const all = {
            count: fac.count + ne.count,
            monto: fac.monto + ne.monto,
            abonos: fac.abonos + ne.abonos,
            restante: fac.restante + ne.restante,
            vencido: fac.vencido + ne.vencido,
            vencidas: fac.vencidas + ne.vencidas
        };
        return { fac: finalize(fac), ne: finalize(ne), all: finalize(all) };
    }, [baseFiltered]);

    const visibleDocs = useMemo(() => {
        const list = typeFilter === 'ALL' ? baseFiltered : baseFiltered.filter(d => d.tipoDoc === typeFilter);
        const dir = sortDirection === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const va = a[sortField];
            const vb = b[sortField];
            if (typeof va === 'number' || typeof vb === 'number') {
                const diff = Number(va || 0) - Number(vb || 0);
                if (diff !== 0) return diff * dir;
            } else {
                const cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'es', { numeric: true });
                if (cmp !== 0) return cmp * dir;
            }
            return String(a.factura).localeCompare(String(b.factura), 'es', { numeric: true }) * dir;
        });
    }, [baseFiltered, typeFilter, sortField, sortDirection]);

    const visibleTotals = useMemo(() => finalize(visibleDocs.reduce(accumulate, emptyTotals())), [visibleDocs]);

    // Resumen consolidado por cliente (Facturas + Notas sumadas)
    const clientRows = useMemo(() => {
        const map = new Map();
        visibleDocs.forEach(doc => {
            const key = doc.rif && doc.rif !== 'J-00000000-0' ? doc.rif : normalize(doc.cliente);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    cliente: doc.cliente,
                    rif: doc.rif,
                    fac: emptyTotals(),
                    ne: emptyTotals(),
                    maxDias: 0
                });
            }
            const row = map.get(key);
            accumulate(doc.tipoDoc === 'NOTA_ENTREGA' ? row.ne : row.fac, doc);
            row.maxDias = Math.max(row.maxDias, Number(doc.diasVencidos || 0));
        });
        return Array.from(map.values())
            .map(r => ({
                ...r,
                fac: finalize(r.fac),
                ne: finalize(r.ne),
                totalMonto: round2(r.fac.monto + r.ne.monto),
                totalAbonos: round2(r.fac.abonos + r.ne.abonos),
                totalRestante: round2(r.fac.restante + r.ne.restante)
            }))
            .sort((a, b) => b.totalRestante - a.totalRestante);
    }, [visibleDocs]);

    if (!isOpen) return null;

    const handleSort = (field) => {
        if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const handlePrintPdf = () => {
        const typeLabelMap = { ALL: 'Ambos (FAC + NE)', FACTURA: 'Solo Facturas Fiscales', NOTA_ENTREGA: 'Solo Notas de Entrega' };
        const statusLabelMap = { ALL: 'Cartera activa', VENCIDA: 'Vencidas', POR_VENCER: 'Al Día', PAGADA: 'Solventes' };
        const sellerLabel = sellerFilter === 'ALL'
            ? 'Todos los vendedores'
            : (sellerOptions.find(([id]) => id === sellerFilter)?.[1] || sellerFilter);

        generateConsolidatedCxcPDF({
            docs: visibleDocs,
            clientRows,
            totals,
            visibleTotals,
            tasaBcv,
            viewMode,
            filters: {
                typeLabel: typeLabelMap[typeFilter] || 'Ambos (FAC + NE)',
                statusLabel: statusLabelMap[statusFilter] || 'Cartera activa',
                sellerLabel,
                searchTerm
            },
            config,
            currentUser
        });
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.45 }} />;
        return sortDirection === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
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
    const thNum = { ...thStyle, textAlign: 'right' };
    const tdStyle = { padding: '0.58rem 0.75rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border-glass)', whiteSpace: 'nowrap' };
    const tdNum = { ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-code)' };
    const tfStyle = {
        ...tdNum,
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

    const SortableTh = ({ field, label, numeric }) => (
        <th style={{ ...(numeric ? thNum : thStyle), cursor: 'pointer' }} onClick={() => handleSort(field)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {label} <SortIcon field={field} />
            </span>
        </th>
    );

    const KpiCard = ({ title, icon, accent, data, highlight }) => (
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

    const pillBtn = (active, activeBg) => ({
        padding: '0.4rem 0.8rem',
        borderRadius: '8px',
        fontSize: '0.78rem',
        fontWeight: 700,
        border: 'none',
        cursor: 'pointer',
        background: active ? activeBg : 'transparent',
        color: active ? '#ffffff' : 'var(--text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        whiteSpace: 'nowrap'
    });
    const pillGroup = {
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
                {/* Encabezado */}
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
                            width: '40px', height: '40px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, rgba(2,132,199,0.3), rgba(217,119,6,0.3))',
                            border: '1px solid rgba(56,189,248,0.35)', color: '#ffffff'
                        }}>
                            <Layers size={22} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading, #ffffff)' }}>
                                CxC Consolidado — Facturas Fiscales + Notas de Entrega
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Cartera total sumada de ambos tipos de documento • Tasa BCV: <strong style={{ color: '#10b981', fontFamily: 'var(--font-code)' }}>{formatBs(tasaBcv)}</strong>
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

                <div style={{ padding: '1rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1, minHeight: 0 }}>
                    {/* Tarjetas: Facturas + Notas = Total */}
                    <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
                        <KpiCard title="Facturas Fiscales" icon={<Receipt size={16} />} accent="#38bdf8" data={totals.fac} />
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>+</div>
                        <KpiCard title="Notas de Entrega" icon={<FileText size={16} />} accent="#f59e0b" data={totals.ne} />
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>=</div>
                        <KpiCard title="Total Consolidado" icon={<Layers size={16} />} accent="#10b981" data={totals.all} highlight />
                    </div>

                    {/* Filtros */}
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

                        <div style={pillGroup}>
                            <button type="button" style={pillBtn(typeFilter === 'ALL', 'linear-gradient(135deg, #059669, #047857)')} onClick={() => setTypeFilter('ALL')}>
                                Ambos ({totals.all.count})
                            </button>
                            <button type="button" style={pillBtn(typeFilter === 'FACTURA', 'linear-gradient(135deg, #002b7a, #0284c7)')} onClick={() => setTypeFilter('FACTURA')}>
                                Facturas ({totals.fac.count})
                            </button>
                            <button type="button" style={pillBtn(typeFilter === 'NOTA_ENTREGA', 'linear-gradient(135deg, #d97706, #b45309)')} onClick={() => setTypeFilter('NOTA_ENTREGA')}>
                                Notas ({totals.ne.count})
                            </button>
                        </div>

                        <div style={pillGroup}>
                            {[['ALL', 'Cartera activa'], ['VENCIDA', 'Vencidas'], ['POR_VENCER', 'Al Día'], ['PAGADA', 'Solventes']].map(([key, label]) => (
                                <button key={key} type="button" style={pillBtn(statusFilter === key, 'rgba(56, 189, 248, 0.35)')} onClick={() => setStatusFilter(key)}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        <select
                            value={sellerFilter}
                            onChange={(e) => setSellerFilter(e.target.value)}
                            className="input-modern"
                            style={{ minWidth: '180px' }}
                        >
                            <option value="ALL">Todos los vendedores</option>
                            {sellerOptions.map(([id, label]) => (
                                <option key={id} value={id}>{label}</option>
                            ))}
                        </select>

                        <DatePeriodFilter value={datePeriodFilter} onChange={setDatePeriodFilter} compact />

                        <div style={pillGroup}>
                            <button type="button" style={pillBtn(viewMode === 'DOCS', 'rgba(56, 189, 248, 0.35)')} onClick={() => setViewMode('DOCS')}>
                                <FileText size={13} /> Por documento
                            </button>
                            <button type="button" style={pillBtn(viewMode === 'CLIENTES', 'rgba(56, 189, 248, 0.35)')} onClick={() => setViewMode('CLIENTES')}>
                                <Users size={13} /> Por cliente
                            </button>
                        </div>
                    </div>

                    {/* Tabla */}
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-glass)', borderRadius: '12px', backgroundColor: 'var(--bg-modal, #0c1427)', position: 'relative' }}>
                        {viewMode === 'DOCS' ? (
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1150px' }}>
                                <thead>
                                    <tr>
                                        <SortableTh field="tipoDoc" label="Tipo" />
                                        <SortableTh field="factura" label="N° Doc." />
                                        <SortableTh field="cliente" label="Cliente" />
                                        <th style={thStyle}>RIF</th>
                                        <SortableTh field="vendedorId" label="Vendedor" />
                                        <SortableTh field="fechaEmisionIso" label="Emisión" />
                                        <SortableTh field="fechaVencimientoIso" label="Vence" />
                                        <SortableTh field="diasVencidos" label="Días Venc." numeric />
                                        <SortableTh field="diasCredito" label="Días Créd." numeric />
                                        <SortableTh field="montoFacturaUsd" label="Monto" numeric />
                                        <SortableTh field="abonosUsd" label="Abonos" numeric />
                                        <SortableTh field="restanteUsd" label="Restante" numeric />
                                        <th style={thStyle}>Estado</th>
                                        <th style={thStyle}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleDocs.length === 0 && (
                                        <tr>
                                            <td colSpan={14} style={{ ...tdStyle, textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                                No hay documentos que coincidan con los filtros.
                                            </td>
                                        </tr>
                                    )}
                                    {visibleDocs.map(doc => {
                                        const ts = TYPE_STYLES[doc.tipoDoc] || TYPE_STYLES.FACTURA;
                                        const ss = STATUS_STYLES[doc.estado] || STATUS_STYLES.POR_VENCER;
                                        return (
                                            <tr key={`${doc.tipoDoc}-${doc.factNum}-${doc.id}`}>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', color: ts.color, background: ts.bg, border: `1px solid ${ts.border}` }}>
                                                        {ts.label}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', fontWeight: 700, color: ts.color }}>#{doc.factura}</td>
                                                <td style={{ ...tdStyle, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.cliente}>{doc.cliente}</td>
                                                <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>{doc.rif}</td>
                                                <td style={tdStyle} title={doc.vendedorDisplay}>{doc.vendedorId}</td>
                                                <td style={tdStyle}>{formatDate(doc.fechaEmision)}</td>
                                                <td style={tdStyle}>{formatDate(doc.fechaVencimiento)}</td>
                                                <td style={{ ...tdNum, color: doc.diasVencidos > 0 ? '#ef4444' : 'var(--text-muted)' }}>{doc.diasVencidos}</td>
                                                <td style={{ ...tdNum, color: 'var(--text-muted)' }}>{Number(doc.diasCredito ?? 0)}d</td>
                                                <td style={tdNum}>{formatUsd(doc.montoFacturaUsd)}</td>
                                                <td style={{ ...tdNum, color: '#10b981' }}>{formatUsd(doc.abonosUsd)}</td>
                                                <td style={{ ...tdNum, color: '#ef4444', fontWeight: 700 }}>{formatUsd(doc.restanteUsd)}</td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', color: ss.color, background: ss.bg }}>
                                                        {ss.label}
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
                                            <td colSpan={9} style={{ ...tfStyle, textAlign: 'left', fontFamily: 'inherit' }}>
                                                TOTAL ({visibleTotals.count} documentos)
                                            </td>
                                            <td style={tfStyle}>{formatUsd(visibleTotals.monto)}</td>
                                            <td style={{ ...tfStyle, color: '#10b981' }}>{formatUsd(visibleTotals.abonos)}</td>
                                            <td style={{ ...tfStyle, color: '#ef4444' }}>{formatUsd(visibleTotals.restante)}</td>
                                            <td colSpan={2} style={{ ...tfStyle, textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>
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
                                        <th style={thNum}>N° Fact.</th>
                                        <th style={thNum}>Saldo Facturas</th>
                                        <th style={thNum}>N° Notas</th>
                                        <th style={thNum}>Saldo Notas</th>
                                        <th style={thNum}>Monto Total</th>
                                        <th style={thNum}>Abonos</th>
                                        <th style={thNum}>Saldo Total (USD)</th>
                                        <th style={thNum}>Saldo Total (Bs.)</th>
                                        <th style={thNum}>Máx. Días Venc.</th>
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
                                    {clientRows.map(row => (
                                        <tr key={row.key}>
                                            <td style={{ ...tdStyle, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }} title={row.cliente}>{row.cliente}</td>
                                            <td style={{ ...tdStyle, fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>{row.rif}</td>
                                            <td style={{ ...tdNum, color: '#38bdf8' }}>{row.fac.count}</td>
                                            <td style={{ ...tdNum, color: '#38bdf8' }}>{formatUsd(row.fac.restante)}</td>
                                            <td style={{ ...tdNum, color: '#fbbf24' }}>{row.ne.count}</td>
                                            <td style={{ ...tdNum, color: '#fbbf24' }}>{formatUsd(row.ne.restante)}</td>
                                            <td style={tdNum}>{formatUsd(row.totalMonto)}</td>
                                            <td style={{ ...tdNum, color: '#10b981' }}>{formatUsd(row.totalAbonos)}</td>
                                            <td style={{ ...tdNum, color: '#ef4444', fontWeight: 800 }}>{formatUsd(row.totalRestante)}</td>
                                            <td style={{ ...tdNum, color: 'var(--text-muted)' }}>{formatBs(row.totalRestante * tasaBcv)}</td>
                                            <td style={{ ...tdNum, color: row.maxDias > 0 ? '#ef4444' : 'var(--text-muted)' }}>{row.maxDias}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {clientRows.length > 0 && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={2} style={{ ...tfStyle, textAlign: 'left', fontFamily: 'inherit' }}>
                                                TOTAL ({clientRows.length} clientes)
                                            </td>
                                            <td style={{ ...tfStyle, color: '#38bdf8' }}>{clientRows.reduce((s, r) => s + r.fac.count, 0)}</td>
                                            <td style={{ ...tfStyle, color: '#38bdf8' }}>{formatUsd(clientRows.reduce((s, r) => s + r.fac.restante, 0))}</td>
                                            <td style={{ ...tfStyle, color: '#fbbf24' }}>{clientRows.reduce((s, r) => s + r.ne.count, 0)}</td>
                                            <td style={{ ...tfStyle, color: '#fbbf24' }}>{formatUsd(clientRows.reduce((s, r) => s + r.ne.restante, 0))}</td>
                                            <td style={tfStyle}>{formatUsd(visibleTotals.monto)}</td>
                                            <td style={{ ...tfStyle, color: '#10b981' }}>{formatUsd(visibleTotals.abonos)}</td>
                                            <td style={{ ...tfStyle, color: '#ef4444' }}>{formatUsd(visibleTotals.restante)}</td>
                                            <td style={{ ...tfStyle, color: 'var(--text-muted)' }}>{formatBs(visibleTotals.restante * tasaBcv)}</td>
                                            <td style={tfStyle}></td>
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

export default CxcConsolidatedModal;
