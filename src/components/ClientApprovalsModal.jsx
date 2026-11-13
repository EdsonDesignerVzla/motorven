import React, { useState, useMemo } from 'react';
import {
  X,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  Phone,
  MapPin,
  Mail,
  User,
  ShieldCheck,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react';
import { canApproveClients, getClientApprovalStatus } from '../services/authService';
import { formatNumberUs } from '../services/formatService';
import { resolveClientContributorType } from '../services/fiscalService';
import { useNotification } from '../context/NotificationContext';
import ImagePreviewLightbox from './ImagePreviewLightbox';

export default function ClientApprovalsModal({
  isOpen,
  onClose,
  clients = [],
  currentUser,
  onApproveClient,
  onRejectClient,
  onOpenNewClient
}) {
  const notify = useNotification();
  const userCanApprove = canApproveClients(currentUser);
  const [activeTab, setActiveTab] = useState('PENDIENTE'); // 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [creditDrafts, setCreditDrafts] = useState({}); // { [clientId]: { limiteCreditoUsd, diasCredito } }
  const [rejectingClient, setRejectingClient] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Filtrar solicitudes relevantes según si es aprobador o vendedor
  const scopedClients = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    if (userCanApprove) {
      return list;
    }
    const uname = String(currentUser?.username || '').trim().toLowerCase();
    const uName = String(currentUser?.nombre || '').trim().toLowerCase();
    const coVen = String(currentUser?.co_ven || currentUser?.coVen || '').trim().toUpperCase();
    return list.filter(c => {
      const reqUname = String(c?.solicitadoPorUsername || c?.solicitado_por_username || '').trim().toLowerCase();
      const reqName = String(c?.solicitadoPor || c?.solicitado_por || '').trim().toLowerCase();
      const ven = String(c?.vendedorAsignado || c?.vendedor_asignado || '').trim().toUpperCase();
      const hasTracking = Boolean(c?.solicitadoPor || c?.solicitado_por || c?.fechaSolicitud || c?.fecha_solicitud);
      if (!hasTracking && getClientApprovalStatus(c) === 'APROBADO') return false;
      return (uname && reqUname === uname) || (uName && reqName === uName) || (coVen && ven === coVen);
    });
  }, [clients, userCanApprove, currentUser]);

  const counts = useMemo(() => {
    let pend = 0;
    let aprob = 0;
    let rech = 0;
    scopedClients.forEach(c => {
      const st = getClientApprovalStatus(c);
      if (st === 'PENDIENTE') pend++;
      else if (st === 'RECHAZADO') rech++;
      else if (c?.solicitadoPor || c?.fechaSolicitud || c?.aprobadoPor) aprob++;
    });
    return { pend, aprob, rech };
  }, [scopedClients]);

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return scopedClients
      .filter(c => {
        const st = getClientApprovalStatus(c);
        if (activeTab === 'PENDIENTE') return st === 'PENDIENTE';
        if (activeTab === 'RECHAZADO') return st === 'RECHAZADO';
        return st === 'APROBADO' && Boolean(c?.solicitadoPor || c?.fechaSolicitud || c?.aprobadoPor);
      })
      .filter(c => {
        if (!q) return true;
        return (
          String(c.nombre || '').toLowerCase().includes(q) ||
          String(c.rif || '').toLowerCase().includes(q) ||
          String(c.codigo || '').toLowerCase().includes(q) ||
          String(c.solicitadoPor || '').toLowerCase().includes(q) ||
          String(c.vendedorAsignado || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dA = new Date(a.fechaSolicitud || a.fechaAprobacion || 0).getTime();
        const dB = new Date(b.fechaSolicitud || b.fechaAprobacion || 0).getTime();
        return dB - dA;
      });
  }, [scopedClients, activeTab, searchTerm]);

  if (!isOpen) return null;

  const getDraft = (c) => {
    const key = c.id || c.codigo;
    return creditDrafts[key] || {
      limiteCreditoUsd: Number(c.limiteCreditoUsd || 0),
      diasCredito: Number(c.diasCredito || 0)
    };
  };

  const updateDraft = (c, field, value) => {
    const key = c.id || c.codigo;
    const prev = getDraft(c);
    setCreditDrafts(d => ({
      ...d,
      [key]: { ...prev, [field]: value }
    }));
  };

  const handleApprove = async (c) => {
    if (!onApproveClient) return;
    const key = c.id || c.codigo;
    const draft = getDraft(c);
    setProcessingId(key);
    try {
      await onApproveClient(c, {
        limiteCreditoUsd: Number(draft.limiteCreditoUsd || 0),
        diasCredito: Number(draft.diasCredito || 0)
      });
    } catch (err) {
      console.error(err);
      notify?.error?.('Error al aprobar el cliente');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectingClient || !onRejectClient) return;
    const key = rejectingClient.id || rejectingClient.codigo;
    setProcessingId(key);
    try {
      await onRejectClient(rejectingClient, rejectReason.trim() || 'Solicitud rechazada por Caja Principal');
      setRejectingClient(null);
      setRejectReason('');
    } catch (err) {
      console.error(err);
      notify?.error?.('Error al rechazar la solicitud');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="clients-modal-backdrop" style={{ zIndex: 1250 }} onClick={onClose}>
      <div
        className="clients-modal-container"
        style={{ maxWidth: '880px', width: '95%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="clients-modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #d97706, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <UserCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {userCanApprove ? 'Aprobación de Nuevos Clientes' : 'Mis Solicitudes de Clientes'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {userCanApprove
                  ? 'Revisa y aprueba las fichas enviadas por los vendedores para habilitarlas en pedidos y facturación.'
                  : 'Estado de los clientes que has enviado a Caja Principal (Vanessa) para su aprobación.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenNewClient && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onOpenNewClient();
                }}
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={14} /> {userCanApprove ? 'Nuevo Cliente (Directo)' : 'Nueva Solicitud'}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-icon">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs + Buscador */}
        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.02)'
          }}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'PENDIENTE', label: `Pendientes (${counts.pend})`, color: '#f59e0b' },
              { id: 'APROBADO', label: `Aprobados (${counts.aprob})`, color: '#10b981' },
              { id: 'RECHAZADO', label: `Rechazados (${counts.rech})`, color: '#ef4444' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="btn btn-sm"
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: '8px',
                  background: activeTab === tab.id ? tab.color : 'var(--bg-secondary)',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${activeTab === tab.id ? tab.color : 'var(--border-glass)'}`
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px', maxWidth: '320px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre, RIF o vendedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.8rem', width: '100%' }}
            />
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={44} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeTab === 'PENDIENTE'
                  ? 'No hay clientes pendientes por aprobar'
                  : activeTab === 'RECHAZADO'
                    ? 'No hay solicitudes rechazadas'
                    : 'Sin historial reciente de aprobaciones'}
              </div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                {userCanApprove
                  ? 'Cuando un vendedor envíe un nuevo cliente desde Preventa, aparecerá aquí.'
                  : 'Usa el botón "+ Nuevo Cliente" para enviar una solicitud a Caja Principal.'}
              </div>
            </div>
          ) : (
            filteredList.map(c => {
              const key = c.id || c.codigo;
              const status = getClientApprovalStatus(c);
              const draft = getDraft(c);
              const isBusy = processingId === key;

              return (
                <div
                  key={key}
                  style={{
                    borderRadius: '12px',
                    padding: '14px 16px',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${
                      status === 'PENDIENTE'
                        ? 'rgba(245, 158, 11, 0.4)'
                        : status === 'RECHAZADO'
                          ? 'rgba(239, 68, 68, 0.4)'
                          : 'rgba(16, 185, 129, 0.35)'
                    }`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.96rem', color: 'var(--text-primary)' }}>{c.nombre}</strong>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background:
                              status === 'PENDIENTE'
                                ? 'rgba(245, 158, 11, 0.16)'
                                : status === 'RECHAZADO'
                                  ? 'rgba(239, 68, 68, 0.16)'
                                  : 'rgba(16, 185, 129, 0.16)',
                            color:
                              status === 'PENDIENTE'
                                ? '#fbbf24'
                                : status === 'RECHAZADO'
                                  ? '#f87171'
                                  : '#34d399'
                          }}
                        >
                          {status === 'PENDIENTE' ? '⏳ PENDIENTE DE APROBACIÓN' : status === 'RECHAZADO' ? '❌ RECHAZADO' : '✅ APROBADO'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'var(--font-code)' }}>
                        RIF: <strong style={{ color: 'var(--text-primary)' }}>{c.rif}</strong> · Código: {c.codigo} · Tipo: {c.tipoCliente || 'Mayorista'} · Zona: {c.zonaVenta || '—'} · Vendedor: {c.vendedorAsignado || '—'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <div><User size={11} style={{ verticalAlign: 'middle' }} /> Solicitado por: <strong>{c.solicitadoPor || c.vendedorAsignado || 'Vendedor'}</strong></div>
                      <div><Clock size={11} style={{ verticalAlign: 'middle' }} /> {formatDateTime(c.fechaSolicitud)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {c.telefono && <span><Phone size={12} style={{ verticalAlign: 'middle' }} /> {c.telefono}</span>}
                    {c.email && <span><Mail size={12} style={{ verticalAlign: 'middle' }} /> {c.email}</span>}
                    {c.direccion && <span><MapPin size={12} style={{ verticalAlign: 'middle' }} /> {c.direccion} {c.ciudad ? `(${c.ciudad})` : ''}</span>}
                  </div>

                  {c.comentarios && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Nota: {c.comentarios}
                    </div>
                  )}

                  {/* Evidencia fotográfica (Cédula/RIF y Local Comercial) para validación al aprobar */}
                  {(() => {
                    const docImg = c.imagenDocumento || c.imagen_documento || '';
                    const localImg = c.imagenLocal || c.imagen_local || '';
                    if (!docImg && !localImg) {
                      return (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.75 }}>
                          <ImageIcon size={13} /> Sin imágenes adjuntas de RIF/Cédula o local comercial
                        </div>
                      );
                    }
                    const tipoC = resolveClientContributorType(c);
                    const docLabel = (tipoC === 'V' || tipoC === 'E') ? `Cédula / RIF (${tipoC})` : `Documento RIF (${tipoC})`;
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                        {[
                          { label: docLabel, src: docImg },
                          { label: 'Local Comercial', src: localImg }
                        ]
                          .filter(item => Boolean(item.src))
                          .map(item => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => setPreviewPhoto({ title: `${c.nombre} — ${item.label}`, subtitle: `RIF/Cédula: ${c.rif || 'S/N'}`, src: item.src })}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '5px 8px',
                                borderRadius: '8px',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                background: 'rgba(14, 165, 233, 0.08)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                              title="Clic para ampliar y verificar documento"
                            >
                              <img
                                src={item.src}
                                alt={item.label}
                                style={{ width: '54px', height: '42px', objectFit: 'cover', borderRadius: '6px' }}
                              />
                              <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--neon-cyan, #38bdf8)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <ZoomIn size={12} /> {item.label}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Clic para ampliar</div>
                              </div>
                            </button>
                          ))}
                      </div>
                    );
                  })()}

                  {status === 'RECHAZADO' && c.motivoRechazo && (
                    <div style={{ fontSize: '0.76rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
                      Motivo de rechazo: <strong>{c.motivoRechazo}</strong> {c.aprobadoPor ? `(por ${c.aprobadoPor})` : ''}
                    </div>
                  )}

                  {status === 'APROBADO' && c.aprobadoPor && (
                    <div style={{ fontSize: '0.74rem', color: '#34d399' }}>
                      Aprobado por <strong>{c.aprobadoPor}</strong> · {formatDateTime(c.fechaAprobacion)} · Límite: ${formatNumberUs(c.limiteCreditoUsd || 0)} ({Number(c.diasCredito || 0)} días)
                    </div>
                  )}

                  {/* Controles de aprobación para Vanessa / Rosibel / Yheyson / Manuel / Edson */}
                  {userCanApprove && status !== 'APROBADO' && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-glass)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            Límite Crédito (USD)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.limiteCreditoUsd}
                            onChange={e => updateDraft(c, 'limiteCreditoUsd', e.target.value)}
                            className="form-control"
                            style={{ width: '125px', fontSize: '0.8rem', padding: '4px 8px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            Días de Crédito
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="180"
                            value={draft.diasCredito}
                            onChange={e => updateDraft(c, 'diasCredito', e.target.value)}
                            className="form-control"
                            style={{ width: '100px', fontSize: '0.8rem', padding: '4px 8px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {status === 'PENDIENTE' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingClient(c);
                              setRejectReason('');
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <XCircle size={14} /> Rechazar
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(c)}
                          className="btn btn-primary btn-sm"
                          style={{
                            background: 'linear-gradient(135deg, #059669, #10b981)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <CheckCircle2 size={14} /> {isBusy ? 'Procesando...' : status === 'RECHAZADO' ? 'Re-aprobar Cliente' : 'Aprobar Cliente'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sub-modal de motivo de rechazo */}
        {rejectingClient && (
          <div className="clients-modal-backdrop" style={{ zIndex: 1350 }} onClick={() => setRejectingClient(null)}>
            <div
              className="clients-modal-container"
              style={{ maxWidth: '440px', width: '92%', padding: '20px' }}
              onClick={e => e.stopPropagation()}
            >
              <h4 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
                Rechazar Solicitud de Cliente
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                Cliente: <strong>{rejectingClient.nombre}</strong> ({rejectingClient.rif})
              </p>
              <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Indica el motivo del rechazo (ej: RIF inválido, dirección incompleta, cliente duplicado)..."
                  className="form-control"
                  style={{ width: '100%', fontSize: '0.84rem', padding: '8px 10px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setRejectingClient(null)} className="btn btn-secondary btn-sm">
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ background: 'var(--motorven-red)' }}>
                    Confirmar Rechazo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <ImagePreviewLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </div>
  );
}
