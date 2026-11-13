import React from 'react';
import {
  X,
  FileText,
  User,
  Calendar,
  DollarSign,
  Package,
  Droplet,
  CheckCircle2,
  AlertTriangle,
  Printer
} from 'lucide-react';
import { formatUsd, formatBs, formatUnitVe } from '../services/formatService';
import { generateSalesPOSPDF, resolveDeliveryNoteLineItems } from '../services/pdfReportService';

export default function ProfitInvoiceModal({ invoice, onClose, config = {}, currentUser = null, tasaBcv = 827.73 }) {
  if (!invoice) return null;

  const resolvedItems = resolveDeliveryNoteLineItems(invoice, null, tasaBcv);
  const fechaEmis = invoice.fechaEmision ? new Date(invoice.fechaEmision).toLocaleDateString('es-VE') : 'N/A';
  const fechaVenc = invoice.fechaVencimiento ? new Date(invoice.fechaVencimiento).toLocaleDateString('es-VE') : 'N/A';

  const isCobrada = invoice.status === 'COBRADA';
  const isAnulada = invoice.status === 'ANULADA';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '95%',
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
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.08) 0%, rgba(230, 0, 18, 0.05) 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'var(--motorven-navy)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0, 43, 122, 0.3)'
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Factura de Venta #{invoice.factNum}
                </h3>
                <span
                  className={`badge ${isCobrada ? 'badge-success' : isAnulada ? 'badge-danger' : 'badge-warning'}`}
                  style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                >
                  {invoice.status}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Documento Fiscal Oficial Supabase - Grupo Motorven C.A.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="no-print"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* CUERPO */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Fila Informativa */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Cliente
              </div>
              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.92rem', marginTop: '2px' }}>
                {invoice.clienteNombre}
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                RIF: {invoice.clienteRif || 'N/A'} (ID: {invoice.clienteId})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Fechas Fiscales
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '2px' }}>
                Emisión: <strong>{fechaEmis}</strong>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Vencimiento: <strong>{fechaVenc}</strong>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Volumen Despachado
              </div>
              <div style={{ fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)', fontSize: '1.15rem', marginTop: '2px' }}>
                {formatUnitVe(invoice.totalLitros || 0)} Litros
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                ≈ {formatUnitVe(invoice.totalCajas || 0)} Cajas Eq.
              </div>
            </div>
          </div>

          {/* Renglones de Lubricantes */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={15} color="var(--motorven-red)" />
              Renglones de Lubricantes Oilstone ® ({invoice.items?.length || 0})
            </div>

            <div className="table-container" style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', overflow: 'hidden' }}>
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>CÓDIGO / ARTÍCULO</th>
                    <th>UNIDAD</th>
                    <th style={{ textAlign: 'center' }}>CANTIDAD</th>
                    <th style={{ textAlign: 'right' }}>LITROS</th>
                    <th style={{ textAlign: 'right' }}>PRECIO (BS.)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL (BS.)</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedItems && resolvedItems.length > 0 ? (
                    resolvedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>{item.rengNum || idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.descripcion}</div>
                          <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>{item.codigo}</div>
                        </td>
                        <td><span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{item.presentacion}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>{item.cantidad}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>{formatUnitVe(item.volumenTotal)} L</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>{formatUsd(item.precioUsd)} ({formatBs(item.precioUsd * tasaBcv)})</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>{formatUsd(item.subtotalUsd)} ({formatBs(item.subtotalBs)})</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        Factura sin renglones detallados registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totales y Saldo */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '0.5rem'
            }}
          >
            <div
              style={{
                width: '320px',
                background: 'var(--surface-input, rgba(0, 43, 122, 0.04))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Neto ($ USD):</span>
                <strong style={{ fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>{formatUsd(invoice.totNetoUsd)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Neto (Bs.):</span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>{formatBs(invoice.totNetoBs)}</strong>
              </div>
              <div style={{ borderTop: '1px solid var(--border-glass)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Saldo Pendiente:</span>
                <strong style={{ fontFamily: 'var(--font-tech)', color: invoice.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                  {formatUsd(invoice.saldoUsd)}
                </strong>
              </div>
            </div>
          </div>

        </div>

        {/* PIE DEL MODAL */}
        <div
          className="no-print"
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--surface-input, rgba(0, 43, 122, 0.04))',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            alignItems: 'center'
          }}
        >
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
            Cerrar
          </button>
          <button
            className="btn btn-print-report"
            onClick={() => generateSalesPOSPDF({
              sales: [invoice],
              config: { ...config, tasaDolar: tasaBcv },
              currentUser,
              tipoDoc: 'FACTURA_PROFIT',
              autoPrint: true
            })}
            style={{ fontSize: '0.82rem' }}
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>

      </div>
    </div>
  );
}
