import React from 'react';
import {
  X,
  FileText,
  Truck,
  Calendar,
  DollarSign,
  Package,
  Droplet,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldCheck
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generatePurchasesPDF } from '../services/pdfReportService';

export default function ProfitPurchaseDetailModal({ purchase, onClose, config = {}, currentUser = null, tasaBcv = 827.73 }) {
  if (!purchase) return null;

  const fechaEmis = purchase.fechaEmision ? new Date(purchase.fechaEmision).toLocaleDateString('es-VE') : 'N/A';
  const fechaVenc = purchase.fechaVencimiento ? new Date(purchase.fechaVencimiento).toLocaleDateString('es-VE') : 'N/A';

  const isPagada = purchase.status === 'PAGADA';
  const isAnulada = purchase.status === 'ANULADA';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '820px',
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
            background: 'linear-gradient(135deg, rgba(194, 65, 12, 0.08) 0%, rgba(0, 43, 122, 0.06) 100%)',
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
                background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(194, 65, 12, 0.3)'
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Factura de Compra #{purchase.factNum}
                </h3>
                {purchase.facturaProv && purchase.facturaProv !== purchase.factNum && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                    (Nro Prov: {purchase.facturaProv})
                  </span>
                )}
                <span
                  className={`badge ${isPagada ? 'badge-success' : isAnulada ? 'badge-danger' : 'badge-warning'}`}
                  style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                >
                  {purchase.status}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Registro Oficial de Compras Supabase - Grupo Motorven C.A.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Proveedor
              </div>
              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.92rem', marginTop: '2px' }}>
                {purchase.provNombre}
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                RIF: {purchase.provRif || 'N/A'} (ID: {purchase.coProv})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Fechas del Documento
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
                Condición y Pago
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '2px' }}>
                Forma Pago: <strong>{purchase.formaPag || 'Crédito / Contado'}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Origen: <strong>Supabase</strong>
              </div>
            </div>
          </div>

          {/* Renglones de Insumos / Lubricantes */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={15} color="var(--motorven-navy)" />
              Renglones de Compra e Insumos ({purchase.items?.length || 0})
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
                    <th style={{ textAlign: 'right' }}>COSTO UNIT (BS.)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL (BS.)</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items && purchase.items.length > 0 ? (
                    purchase.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>{item.rengNum || idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.descripcion}</div>
                          <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>{item.articuloId}</div>
                        </td>
                        <td><span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{item.unidadVenta}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>{item.cantidad}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>{item.litrosTotales ? `${item.litrosTotales} L` : '-'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>{formatBs(item.precioUnitario)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>{formatBs(item.totalNeto)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        Compra sin renglones individuales desglosados en Supabase.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totales y Saldo CxP */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '0.5rem'
            }}
          >
            <div
              style={{
                width: '340px',
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
                <span style={{ color: 'var(--text-muted)' }}>Base Imponible:</span>
                <span style={{ fontFamily: 'var(--font-tech)' }}>{formatUsd(purchase.totBrutoUsd)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>IVA (16%):</span>
                <span style={{ fontFamily: 'var(--font-tech)' }}>{formatUsd(purchase.ivaUsd)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Total Factura ($ USD):</span>
                <strong style={{ fontFamily: 'var(--font-tech)', color: 'var(--text-main)', fontSize: '1rem' }}>{formatUsd(purchase.totNetoUsd)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Factura (Bs.):</span>
                <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>{formatBs(purchase.totNetoBs)}</strong>
              </div>
              <div style={{ borderTop: '1px solid var(--border-glass)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Saldo por Pagar:</span>
                <strong style={{ fontFamily: 'var(--font-tech)', color: purchase.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                  {formatUsd(purchase.saldoUsd)}
                </strong>
              </div>
            </div>
          </div>

        </div>

        {/* PIE DEL MODAL */}
        <div
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
            onClick={() => generatePurchasesPDF({
              purchases: [purchase],
              config: { ...config, tasaDolar: tasaBcv },
              currentUser
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
