import React from 'react';
import {
  X,
  Printer,
  Receipt,
  User,
  Building2,
  Calendar,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowRight
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateCollectionReceiptPDF } from '../services/pdfReportService';

export default function ProfitReceiptModal({ receipt, onClose, config = {}, currentUser = null, tasaBcv = 827.73 }) {
  if (!receipt) return null;

  const handlePrint = () => {
    generateCollectionReceiptPDF({
      receipt,
      allocations: receipt.documentosAfectados || [],
      config: { ...config, tasaDolar: tasaBcv },
      currentUser
    });
  };

  const rawFecha = receipt.fecha || '';
  const rawFechaStr = typeof rawFecha === 'string' ? rawFecha.trim() : '';
  const isPureOrMidnightUtc =
    /^\d{4}-\d{2}-\d{2}$/.test(rawFechaStr) ||
    /^\d{4}-\d{2}-\d{2}[T\s]00:00:00(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(rawFechaStr);
  let fechaFormatted;
  if (isPureOrMidnightUtc) {
    const [y, m, d] = rawFechaStr.slice(0, 10).split('-');
    fechaFormatted = `${d}/${m}/${y}`;
  } else {
    const fechaObj = new Date(rawFecha || new Date());
    fechaFormatted = isNaN(fechaObj.getTime())
      ? String(rawFecha || '')
      : fechaObj.toLocaleDateString('es-VE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
  }

  const getFormaBadge = (forma) => {
    const tipo = forma.tipo || '';
    if (tipo === 'ZELLE') {
      return { label: 'ZELLE', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' };
    }
    if (tipo === 'EFECTIVO_USD') {
      return { label: 'EFECTIVO $', color: 'var(--semaforo-verde)', bg: 'var(--semaforo-verde-bg)' };
    }
    if (tipo === 'EFECTIVO_BS') {
      return { label: 'EFECTIVO BS', color: 'var(--motorven-gold)', bg: 'var(--semaforo-amarillo-bg)' };
    }
    return { label: 'TRANSFERENCIA BS', color: 'var(--motorven-navy-light)', bg: 'rgba(37, 99, 235, 0.15)' };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
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
        {/* CABECERA MODAL */}
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
              <Receipt size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Recibo de Cobro #{receipt.cobNum}
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  Supabase
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auditoría y Conciliación Oficial de Cobranzas Grupo Motorven
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

        {/* CUERPO DEL RECIBO */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Tarjeta de Identificación */}
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
                {receipt.clienteNombre}
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                RIF: {receipt.clienteRif || 'N/A'} (ID: {receipt.clienteId})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Fecha de Cobro
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '2px' }}>
                {fechaFormatted}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Asesor: <strong>{receipt.vendedorId || 'VV'}</strong>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Cobrado
              </div>
              <div style={{ fontWeight: 900, color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)', fontSize: '1.25rem', marginTop: '2px' }}>
                {formatUsd(receipt.montoUsd)}
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)', fontWeight: 700 }}>
                {formatBs(receipt.montoBs)}
              </div>
            </div>
          </div>

          {/* Formas de Pago / Medios de Recepción */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={15} color="var(--motorven-navy-light)" />
              Medios de Pago Aplicados ({receipt.formasPago?.length || 0})
            </div>

            {receipt.formasPago && receipt.formasPago.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {receipt.formasPago.map((fp, idx) => {
                  const badge = getFormaBadge(fp);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: 'var(--surface-input, rgba(255,255,255,0.04))',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: badge.bg,
                            color: badge.color,
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            fontFamily: 'var(--font-code)'
                          }}
                        >
                          {badge.label}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {fp.cajaOcuenta || 'Caja Principal'}
                          </div>
                          {fp.numDoc && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                              Ref / Depósito: {fp.numDoc}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                          {formatUsd(fp.montoUsd)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                          {formatBs(fp.montoBs)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '1rem', background: 'var(--surface-input)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Cobro registrado con método directo en cuenta bancaria.
              </div>
            )}
          </div>

          {/* Documentos / Facturas Afectadas */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="var(--motorven-red)" />
              Facturas Canceladas / Amortizadas ({receipt.documentosAfectados?.length || 0})
            </div>

            {receipt.documentosAfectados && receipt.documentosAfectados.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {receipt.documentosAfectados.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 1rem',
                      background: 'var(--surface-input, rgba(255,255,255,0.04))',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                        {doc.tipoDoc || 'FACT'}
                      </span>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-code)', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        N° {doc.numDoc}
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)', fontSize: '0.9rem' }}>
                      {formatBs(doc.montoCobrado)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1rem', background: 'var(--surface-input)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Abono a cuenta general del cliente.
              </div>
            )}
          </div>

          {/* Comentarios */}
          {receipt.descrip && (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-glass)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <strong>Nota / Observación:</strong> {receipt.descrip}
            </div>
          )}

        </div>

        {/* PIE DEL MODAL CON ACCIONES */}
        <div
          className="no-print"
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--surface-input, rgba(0, 43, 122, 0.04))',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Tasa de cambio aplicada: <strong>Bs. {receipt.tasa?.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
              Cerrar
            </button>
            <button className="btn btn-print-report" onClick={handlePrint} style={{ fontSize: '0.82rem' }}>
              <Printer size={15} color="#ffffff" /> Imprimir Reporte
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
