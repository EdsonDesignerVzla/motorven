import React from 'react';
import {
  X,
  Truck,
  Building2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  Clock,
  ShieldCheck,
  CreditCard,
  FileText,
  TrendingDown,
  Printer
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { doProvidersMatch } from '../utils/cxpUtils';
import { generatePurchasesPDF } from '../services/pdfReportService';

export default function ProfitSupplierDetailModal({
  supplier,
  onClose,
  purchases = [],
  accountsPayable = [],
  tasaBcv = 827.73
}) {
  if (!supplier) return null;

  const supplierPurchases = purchases.filter(p => doProvidersMatch(p, supplier));
  const supplierCxP = accountsPayable.filter(d => !d?.anulado && doProvidersMatch(d, supplier));

  const totalCxP = supplierCxP.reduce((acc, d) => acc + (d.saldoUsd || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '850px',
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
            background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.08) 0%, rgba(194, 65, 12, 0.05) 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--motorven-navy)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0, 43, 122, 0.3)'
              }}
            >
              <Truck size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {supplier.provDes}
                </h3>
                <span
                  className={`badge ${supplier.inactivo ? 'badge-danger' : 'badge-success'}`}
                  style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                >
                  {supplier.inactivo ? 'INACTIVO' : 'ACTIVO'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                RIF: {supplier.rif} | Código: {supplier.coProv}
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
          
          {/* Tarjetas de Resumen Financiero */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem'
            }}
          >
            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Saldo Deudor (CxP)
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: supplier.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)', marginTop: '4px' }}>
                {formatUsd(supplier.saldoUsd || totalCxP)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {formatBs(supplier.saldoBs)}
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Límite de Crédito
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)', marginTop: '4px' }}>
                {formatUsd(supplier.limiteCredito)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Plazo: <strong>{supplier.diasCredito || 0} Días</strong>
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Facturas Compra
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)', marginTop: '4px' }}>
                {supplierPurchases.length} Docs
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Registradas en Supabase
              </div>
            </div>
          </div>

          {/* Información de Contacto */}
          <div
            style={{
              background: 'var(--surface-input, rgba(0, 43, 122, 0.02))',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <MapPin size={16} color="var(--motorven-red)" />
              <span>{supplier.direccion || 'Dirección no registrada en Supabase'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <Phone size={16} color="var(--motorven-navy)" />
              <span>{supplier.telefonos || 'Teléfono no registrado'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <Mail size={16} color="var(--semaforo-verde)" />
              <span>{supplier.email || 'Correo no registrado'}</span>
            </div>
          </div>

          {/* Facturas de Compra Recientes */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} color="var(--motorven-navy)" />
              Historial de Facturas de Compra de este Proveedor
            </div>

            <div className="table-container" style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', overflow: 'hidden' }}>
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>NRO. FACTURA</th>
                    <th>FECHA EMISIÓN</th>
                    <th>VENCIMIENTO</th>
                    <th style={{ textAlign: 'right' }}>TOTAL ($ USD)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL (BS.)</th>
                    <th style={{ textAlign: 'right' }}>SALDO ($ USD)</th>
                    <th style={{ textAlign: 'center' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPurchases.length > 0 ? (
                    supplierPurchases.slice(0, 10).map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-code)' }}>
                          #{p.factNum} {p.facturaProv ? `(${p.facturaProv})` : ''}
                        </td>
                        <td>{p.fechaEmision ? new Date(p.fechaEmision).toLocaleDateString('es-VE') : '-'}</td>
                        <td>{p.fechaVencimiento ? new Date(p.fechaVencimiento).toLocaleDateString('es-VE') : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>{formatUsd(p.totNetoUsd)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>{formatBs(p.totNetoBs)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: p.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                          {formatUsd(p.saldoUsd)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${p.status === 'PAGADA' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No hay facturas de compra registradas para este proveedor en Supabase.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
            Cerrar Perfil
          </button>
          <button
            className="btn btn-print-report"
            onClick={() => {
              generatePurchasesPDF({
                purchases: supplierPurchases,
                suppliers: [supplier],
                config: { tasaDolar: tasaBcv },
                currentUser: null
              });
            }}
            style={{ fontSize: '0.82rem' }}
            title="Descargar historial de compras de este proveedor en PDF"
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>

      </div>
    </div>
  );
}
