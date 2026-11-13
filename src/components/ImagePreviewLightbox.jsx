import React from 'react';
import { X } from 'lucide-react';

/**
 * Lightbox reutilizable para visualizar imágenes Base64 de documentos (RIF/Cédula) y locales comerciales.
 */
export default function ImagePreviewLightbox({ photo, onClose }) {
  if (!photo || !photo.src) return null;

  return (
    <div
      className="clients-modal-backdrop"
      style={{ zIndex: 12500, background: 'rgba(2, 6, 23, 0.85)' }}
      onClick={onClose}
    >
      <div
        className="clients-modal-container"
        style={{
          maxWidth: '720px',
          width: '94%',
          maxHeight: '90vh',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{photo.title || 'Vista Previa'}</strong>
            {photo.subtitle && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {photo.subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '5px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={16} /> Cerrar
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: '10px',
            overflow: 'hidden',
            padding: '8px'
          }}
        >
          <img
            src={photo.src}
            alt={photo.title || 'Documento'}
            style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '6px' }}
          />
        </div>
      </div>
    </div>
  );
}
