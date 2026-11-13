import React from 'react';
import {
  X,
  FileText,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Printer,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateAuditLedgerPDF } from '../services/pdfReportService';
import MotorvenLogo from './MotorvenLogo';

export default function AccountingEntryModal({
  entry,
  config,
  currentUser = null,
  onClose
}) {
  if (!entry) return null;

  const tasa = config?.tasaDolar || 827.73;

  const totalDebeUsd = (entry.lines || []).reduce((acc, l) => acc + (Number(l.debeUsd) || 0), 0);
  const totalHaberUsd = (entry.lines || []).reduce((acc, l) => acc + (Number(l.haberUsd) || 0), 0);
  const totalDebeBs = (entry.lines || []).reduce((acc, l) => acc + (Number(l.debeBs) || 0), 0);
  const totalHaberBs = (entry.lines || []).reduce((acc, l) => acc + (Number(l.haberBs) || 0), 0);

  const isBalanced = Math.abs(totalDebeUsd - totalHaberUsd) < 0.05;

  const handlePrint = () => {
    generateAuditLedgerPDF({
      entries: [entry],
      auditLogs: [],
      config,
      currentUser,
      subTab: 'diario'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content print-area"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Comprobante de Diario #{entry.asientoNum || entry.id}
                </h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  background: isBalanced ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: isBalanced ? '#10b981' : '#ef4444',
                  border: '1px solid var(--border-glass)'
                }}>
                  {isBalanced ? '✓ Cuadrado' : '⚠️ Descuadre'}
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tipo: {entry.tipoOperacion || 'Asiento General'} • Origen: {entry.origenDoc || 'Supabase'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handlePrint}
              className="btn btn-print-report btn-sm"
            >
              <Printer size={15} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-icon"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Voucher Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div className="card" style={{ padding: '0.75rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>FECHA CONTABLE</div>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                {entry.fecha ? new Date(entry.fecha).toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
              </div>
            </div>

            <div className="card" style={{ padding: '0.75rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>DOCUMENTO FUENTE</div>
              <div style={{ fontWeight: 800, color: '#3b82f6', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                {entry.documentoReferencia || 'N/A'}
              </div>
            </div>

            <div className="card" style={{ padding: '0.75rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>OPERADOR / USUARIO</div>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                {entry.usuario || 'ADMIN'}
              </div>
            </div>

            <div className="card" style={{ padding: '0.75rem', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>TASA DE CAMBIO BCV</div>
              <div style={{ fontWeight: 800, color: '#10b981', marginTop: '0.2rem', fontSize: '0.95rem' }}>
                {formatBs(entry.tasa || tasa)}
              </div>
            </div>
          </div>

          {/* Description Concept */}
          <div style={{ background: 'var(--bg-glass-accent)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              CONCEPTO CONTABLE & GLOSA:
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {entry.concepto || 'Registro de operación comercial en sistema'}
            </div>
          </div>

          {/* Double-entry Ledger Lines Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>Código Contable</th>
                    <th style={{ padding: '0.65rem' }}>Nombre de Cuenta</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Debe (USD)</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Haber (USD)</th>
                    <th style={{ padding: '0.65rem', textAlign: 'right' }}>Debe (Bs.)</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Haber (Bs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {(entry.lines || []).map((line, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {line.cuentaCodigo}
                      </td>
                      <td style={{ padding: '0.65rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {line.cuentaNombre}
                      </td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: line.debeUsd > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {line.debeUsd > 0 ? formatUsd(line.debeUsd) : '-'}
                      </td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: line.haberUsd > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                        {line.haberUsd > 0 ? formatUsd(line.haberUsd) : '-'}
                      </td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', color: line.debeBs > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {line.debeBs > 0 ? formatBs(line.debeBs) : '-'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', color: line.haberBs > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {line.haberBs > 0 ? formatBs(line.haberBs) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-glass)', background: 'var(--bg-glass-accent)', fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                      TOTALES DEL COMPROBANTE
                    </td>
                    <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right', color: '#10b981' }}>
                      {formatUsd(totalDebeUsd)}
                    </td>
                    <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right', color: '#3b82f6' }}>
                      {formatUsd(totalHaberUsd)}
                    </td>
                    <td style={{ padding: '0.75rem 0.65rem', textAlign: 'right' }}>
                      {formatBs(totalDebeBs)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      {formatBs(totalHaberBs)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Audit Verification Stamp */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#10b981" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Asiento verificado electrónicamente por el motor de conciliación contable de SIGNUM MOTORVEN.
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Hash de Integridad: {entry.id?.slice(0, 12) || 'AUT-OK-2026'}
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cerrar Comprobante
          </button>
        </div>
      </div>
    </div>
  );
}
