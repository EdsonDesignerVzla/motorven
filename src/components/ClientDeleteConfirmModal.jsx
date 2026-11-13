import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, AlertTriangle, Lock, Trash2 } from 'lucide-react';

/**
 * Modal de confirmación de eliminación de cliente con Doble Seguridad:
 * Paso 1: Casilla de verificación explícita.
 * Paso 2: Palabra clave escrita ("ELIMINAR", código o RIF del cliente).
 */
export default function ClientDeleteConfirmModal({
  client,
  isDeleting = false,
  onClose,
  onConfirmDelete
}) {
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');

  useEffect(() => {
    setConfirmChecked(false);
    setConfirmKeyword('');
  }, [client]);

  if (!client) return null;

  const clientCode = String(client.codigo || client.id || '').trim();
  const clientRif = String(client.rif || '').trim();
  const kwUpper = confirmKeyword.trim().toUpperCase();
  const keywordMatches =
    Boolean(kwUpper) &&
    (kwUpper === 'ELIMINAR' ||
      (clientCode && kwUpper === clientCode.toUpperCase()) ||
      (clientRif && kwUpper === clientRif.toUpperCase()));
  const canDelete = !isDeleting && confirmChecked && keywordMatches;

  return (
    <div
      className="clients-modal-backdrop"
      style={{ zIndex: 11300 }}
      onClick={() => !isDeleting && onClose()}
    >
      <div
        className="clients-modal-container"
        style={{
          background: 'var(--bg-modal)',
          color: 'var(--text-primary)',
          border: '1.5px solid var(--semaforo-rojo)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          height: 'auto',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-industrial)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #991b1b, #dc2626)',
            borderBottom: '1px solid rgba(220, 38, 38, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="#ffffff" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                Eliminar Cliente — Doble Seguridad
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                Verificación obligatoria en 2 pasos antes de borrar del sistema
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-modal)' }}>
          <div
            style={{
              background: 'var(--semaforo-rojo-bg)',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              lineHeight: 1.45
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--semaforo-rojo)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={15} /> ACCIÓN CRÍTICA EN CARTERA COMERCIAL
            </div>
            Esta acción eliminará al cliente de la cartera activa del sistema y lo reflejará en la base de datos.
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glass)',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontSize: '0.78rem'
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Razón Social / Nombre:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{client.nombre}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Código:</span>
              <strong style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)' }}>{clientCode}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>RIF / Cédula:</span>
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>{clientRif || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Vendedor:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{client.vendedorAsignado || 'OF'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Saldo Deudor USD:</span>
              <strong style={{ color: Number(client.saldoDeudorUsd || 0) > 0 ? 'var(--semaforo-rojo)' : 'var(--semaforo-verde)' }}>
                $ {Number(client.saldoDeudorUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {/* PASO 1 DE SEGURIDAD */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: confirmChecked ? 'var(--semaforo-rojo-bg)' : 'var(--bg-secondary)',
              border: `1px solid ${confirmChecked ? 'var(--semaforo-rojo)' : 'var(--border-glass)'}`,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.78rem',
              lineHeight: 1.4
            }}
          >
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              disabled={isDeleting}
              style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#dc2626' }}
            />
            <span>
              <strong>Paso 1 (Confirmación explícita):</strong> Confirmo que he verificado la ficha y deseo eliminar permanentemente este cliente del sistema.
            </span>
          </label>

          {/* PASO 2 DE SEGURIDAD */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              <Lock size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Paso 2 (Validación escrita): Escriba <span style={{ color: 'var(--semaforo-rojo)' }}>ELIMINAR</span> o el código{' '}
              <span style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)' }}>{clientCode}</span>:
            </label>
            <input
              type="text"
              value={confirmKeyword}
              onChange={(e) => setConfirmKeyword(e.target.value)}
              disabled={isDeleting}
              placeholder={`Escriba ELIMINAR o ${clientCode}`}
              autoFocus
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${keywordMatches ? 'var(--semaforo-rojo)' : 'var(--border-glass)'}`,
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-code)',
                fontWeight: 700,
                fontSize: '0.88rem'
              }}
            />
          </div>
        </div>

        <div
          style={{
            padding: '14px 20px',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => canDelete && onConfirmDelete()}
            disabled={!canDelete}
            className="btn"
            style={{
              background: canDelete ? '#dc2626' : 'var(--semaforo-rojo)',
              opacity: canDelete ? 1 : 0.45,
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: canDelete ? 'pointer' : 'not-allowed'
            }}
          >
            <Trash2 size={15} />
            <span>{isDeleting ? 'Eliminando...' : 'Eliminar Definitivamente'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
