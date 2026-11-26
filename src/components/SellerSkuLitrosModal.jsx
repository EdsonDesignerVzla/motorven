import React, { useMemo, useState } from 'react';
import {
  X,
  Droplet,
  Package,
  Target,
  Search,
  Layers,
  AlertTriangle,
  Printer
} from 'lucide-react';
import SellerAvatar from './SellerAvatar';
import { formatUnitVe } from '../services/formatService';
import { buildSellerSkuLitrosSummary } from '../utils/sellerSkuLitrosUtils';
import { generateSellerSkuLitrosPDF } from '../services/pdfReportService';

export default function SellerSkuLitrosModal({
  seller,
  onClose,
  invoices = [],
  returns = [],
  products = [],
  periodLabel = '',
  config = {},
  currentUser = null,
  onPhotoUpdated
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPresentation, setSelectedPresentation] = useState('ALL');

  const summary = useMemo(
    () =>
      buildSellerSkuLitrosSummary({
        seller,
        invoices,
        returns,
        products,
        metaLitros: seller?.metaLitros || seller?.metaLitrosMes || 3000
      }),
    [seller, invoices, returns, products]
  );

  const filteredSkus = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return summary.skus.filter((row) => {
      if (selectedPresentation !== 'ALL' && row.presentacion !== selectedPresentation) {
        return false;
      }
      if (!q) return true;
      return (
        row.sku.toLowerCase().includes(q) ||
        row.descripcion.toLowerCase().includes(q) ||
        row.presentacion.toLowerCase().includes(q)
      );
    });
  }, [summary.skus, searchTerm, selectedPresentation]);

  const filteredTotals = useMemo(() => {
    const cantidad = filteredSkus.reduce((acc, r) => acc + r.cantidad, 0);
    const litros = filteredSkus.reduce((acc, r) => acc + r.litros, 0);
    const pctTotal = summary.litrosFacturados > 0 ? (litros / summary.litrosFacturados) * 100 : 0;
    const pctMeta = summary.metaLitros > 0 ? (litros / summary.metaLitros) * 100 : 0;
    return {
      cantidad: Number(cantidad.toFixed(2)),
      litros: Number(litros.toFixed(2)),
      pctTotal: Number(pctTotal.toFixed(1)),
      pctMeta: Number(pctMeta.toFixed(1))
    };
  }, [filteredSkus, summary.litrosFacturados, summary.metaLitros]);

  if (!seller) return null;

  const metaReached = summary.porcentajeMeta >= 100;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '940px',
          width: '96%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-glass, rgba(0, 43, 122, 0.15))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '1.15rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.08) 0%, rgba(202, 138, 4, 0.06) 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
            <SellerAvatar
              seller={seller}
              size={48}
              canEdit={false}
              onPhotoUpdated={onPhotoUpdated}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Ventas por SKU en Litros — {seller.venDes}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  Cód: {seller.coVen}
                </span>
                {periodLabel && (
                  <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                    {periodLabel}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Desglose por SKU, presentación comercial, cumplimiento de meta y consolidado en litros
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              flexShrink: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* CUERPO */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* KPIs PRINCIPALES */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '0.9rem'
            }}
          >
            {/* Consolidado en Litros */}
            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '0.95rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                <Droplet size={13} color="var(--motorven-navy-light)" />
                Consolidado en Litros
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)', marginTop: '4px' }}>
                {formatUnitVe(summary.litrosConsolidados)} L
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                ≈ {formatUnitVe(summary.litrosConsolidados / 11.35, 1)} Cajas Eq. ({summary.facturasCount} doc.)
              </div>
            </div>

            {/* Porcentaje de Meta Alcanzada */}
            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '0.95rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Target size={13} color={metaReached ? 'var(--semaforo-verde)' : 'var(--motorven-gold)'} />
                  Meta Alcanzada
                </span>
                <span style={{ fontFamily: 'var(--font-code)' }}>
                  Meta: {formatUnitVe(summary.metaLitros, 0)} L
                </span>
              </div>
              <div
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: metaReached ? 'var(--semaforo-verde)' : 'var(--motorven-gold)',
                  fontFamily: 'var(--font-tech)',
                  marginTop: '4px'
                }}
              >
                {summary.porcentajeMeta}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-glass)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, summary.porcentajeMeta)}%`,
                    height: '100%',
                    background: metaReached ? 'var(--semaforo-verde)' : 'var(--motorven-navy)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-code)' }}>
                {metaReached
                  ? `Excedente: +${formatUnitVe(summary.litrosExcedenteMeta)} L`
                  : `Faltan: ${formatUnitVe(summary.litrosRestantesMeta)} L para la meta`}
              </div>
            </div>

            {/* SKUs y Unidades */}
            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '0.95rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                <Package size={13} color="var(--motorven-red)" />
                SKUs & Presentaciones
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)', marginTop: '4px' }}>
                {summary.skus.length} SKUs
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                {formatUnitVe(summary.totalUnidades, 0)} unidades • {summary.presentaciones.length} presentaciones
              </div>
            </div>
          </div>

          {/* AVISO DE DEVOLUCIONES SI APLICA */}
          {summary.litrosDevueltos > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 0.9rem',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.76rem',
                color: 'var(--text-main)'
              }}
            >
              <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
              <span>
                Facturado bruto por SKUs: <strong>{formatUnitVe(summary.litrosFacturados)} L</strong> — Devoluciones del período: <strong style={{ color: 'var(--motorven-red)' }}>-{formatUnitVe(summary.litrosDevueltos)} L</strong> → Consolidado neto: <strong>{formatUnitVe(summary.litrosConsolidados)} L</strong>.
              </span>
            </div>
          )}

          {/* CONSOLIDADO POR PRESENTACIÓN */}
          {summary.presentaciones.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', marginBottom: '0.55rem' }}>
                <Layers size={14} color="var(--motorven-navy-light)" />
                Consolidado en Litros por Presentación
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {summary.presentaciones.map((p) => {
                  const isActive = selectedPresentation === p.presentacion;
                  return (
                    <button
                      key={p.presentacion}
                      type="button"
                      onClick={() =>
                        setSelectedPresentation((prev) => (prev === p.presentacion ? 'ALL' : p.presentacion))
                      }
                      style={{
                        textAlign: 'left',
                        cursor: 'pointer',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '10px',
                        background: isActive
                          ? 'rgba(0, 43, 122, 0.12)'
                          : 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                        border: isActive
                          ? '1.5px solid var(--motorven-navy)'
                          : '1px solid var(--border-glass)',
                        minWidth: '155px',
                        flex: '1 1 155px',
                        maxWidth: '230px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                          {p.presentacion}
                        </span>
                        <span className="badge badge-primary" style={{ fontSize: '0.66rem', padding: '1px 6px' }}>
                          {p.pctTotalLitros}%
                        </span>
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-navy-light)', marginTop: '3px' }}>
                        {formatUnitVe(p.litros)} L
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                        {formatUnitVe(p.cantidad, 0)} uds • {p.pctMeta}% meta
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* BARRA DE BÚSQUEDA Y FILTRO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Buscar SKU, producto o presentación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            {selectedPresentation !== 'ALL' && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedPresentation('ALL')}
                style={{ fontSize: '0.74rem', padding: '4px 10px' }}
              >
                Mostrar todas las presentaciones ({summary.skus.length})
              </button>
            )}
          </div>

          {/* TABLA DETALLADA DE SKUs */}
          <div
            style={{
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
          >
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.78rem', width: '100%', margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-card)' }}>
                  <tr>
                    <th style={{ width: '95px' }}>SKU</th>
                    <th>PRODUCTO / DESCRIPCIÓN</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>PRESENTACIÓN</th>
                    <th style={{ textAlign: 'right', width: '85px' }}>CANTIDAD</th>
                    <th style={{ textAlign: 'right', width: '120px' }}>LITROS</th>
                    <th style={{ textAlign: 'right', width: '85px' }}>% TOTAL</th>
                    <th style={{ textAlign: 'center', width: '140px' }}>% META ({formatUnitVe(summary.metaLitros, 0)} L)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkus.length > 0 ? (
                    filteredSkus.map((row) => (
                      <tr key={`${row.sku}-${row.presentacion}`}>
                        <td style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--motorven-navy-light)' }}>
                          {row.sku}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {row.descripcion}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                            {row.presentacion}
                          </span>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                            {formatUnitVe(row.litrosPorUnidad)} L/u
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                          {formatUnitVe(row.cantidad, row.cantidad % 1 === 0 ? 0 : 2)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontWeight: 800, color: 'var(--motorven-navy-light)' }}>
                          {formatUnitVe(row.litros)} L
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {row.pctTotalLitros}%
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontFamily: 'var(--font-code)', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 800, color: row.pctMeta >= 25 ? 'var(--semaforo-verde)' : 'var(--text-main)' }}>
                              {row.pctMeta}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '5px', background: 'var(--border-glass)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, row.pctMeta)}%`,
                                height: '100%',
                                background: row.pctMeta >= 25 ? 'var(--semaforo-verde)' : 'var(--motorven-navy)'
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No se encontraron ventas de SKUs para este asesor en el período seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredSkus.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--surface-input, rgba(0, 43, 122, 0.04))', fontWeight: 800 }}>
                      <td colSpan="3" style={{ textAlign: 'right', fontSize: '0.76rem', textTransform: 'uppercase', color: 'var(--text-main)' }}>
                        Consolidado ({filteredSkus.length} SKUs)
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                        {formatUnitVe(filteredTotals.cantidad, filteredTotals.cantidad % 1 === 0 ? 0 : 2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--motorven-navy-light)', fontSize: '0.88rem' }}>
                        {formatUnitVe(filteredTotals.litros)} L
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                        {filteredTotals.pctTotal}%
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-tech)', color: metaReached ? 'var(--semaforo-verde)' : 'var(--motorven-gold)' }}>
                        {selectedPresentation === 'ALL' && !searchTerm.trim()
                          ? `${summary.porcentajeMeta}% Meta`
                          : `${filteredTotals.pctMeta}% Meta`}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* PIE DEL MODAL */}
        <div
          style={{
            padding: '0.9rem 1.5rem',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--bg-card)'
          }}
        >
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
            Consolidado Neto: <strong style={{ color: 'var(--text-main)' }}>{formatUnitVe(summary.litrosConsolidados)} L</strong> / Meta: <strong style={{ color: 'var(--text-main)' }}>{formatUnitVe(summary.metaLitros, 0)} L</strong> ({summary.porcentajeMeta}%)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-print-report"
              onClick={() =>
                generateSellerSkuLitrosPDF({
                  seller,
                  summary,
                  periodLabel,
                  config,
                  currentUser
                })
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              title="Imprimir / descargar reporte de ventas por SKU en litros (PDF)"
            >
              <Printer size={15} color="#ffffff" /> Imprimir Reporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
