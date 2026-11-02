import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { compressProfileImage } from '../services/imageCompression';
import { uploadImageToStorage, STORAGE_FOLDERS } from '../services/imageStorageService';
import { updateSupabaseSellerPhoto } from '../services/supabaseService';
import { useNotification } from '../context/NotificationContext';

// Paleta de gradientes ejecutivos para iniciales
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #002b7a 0%, #0284c7 100%)', // Motorven Navy / Sky
  'linear-gradient(135deg, #065f46 0%, #10b981 100%)', // Emerald
  'linear-gradient(135deg, #3730a3 0%, #6366f1 100%)', // Indigo
  'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)', // Amber / Gold
  'linear-gradient(135deg, #831843 0%, #ec4899 100%)', // Rose
  'linear-gradient(135deg, #115e59 0%, #14b8a6 100%)', // Teal
  'linear-gradient(135deg, #1e293b 0%, #475569 100%)', // Slate Executive
  'linear-gradient(135deg, #581c87 0%, #a855f7 100%)'  // Purple Royal
];

/**
 * Obtener iniciales legibles del asesor
 */
export function getSellerInitials(venDes, coVen) {
  if (venDes && typeof venDes === 'string') {
    const parts = venDes.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
  }
  if (coVen && typeof coVen === 'string') {
    return coVen.trim().substring(0, 2).toUpperCase();
  }
  return 'AV';
}

/**
 * Elegir un gradiente determinista según el código o nombre
 */
export function getSellerGradient(seed) {
  const str = String(seed || 'asesor');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

/**
 * Componente SellerAvatar
 * Muestra la foto de perfil oficial del asesor, con fallback a iniciales con gradiente elegante.
 * Permite cambiar o subir la foto directamente a Supabase Storage cuando canEdit = true.
 */
export default function SellerAvatar({
  seller,
  size = 40,
  canEdit = false,
  onPhotoUpdated = null,
  showBadge = false,
  style = {},
  className = ''
}) {
  const notify = useNotification();
  const [imageError, setImageError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const coVen = (seller?.coVen || seller?.co_ven || seller?.id || '').toString().trim();
  const venDes = seller?.venDes || seller?.ven_des || seller?.name || seller?.nombre || coVen;
  const photoUrl = seller?.foto || seller?.avatar || null;

  // Si la URL de foto cambia, reseteamos el estado de error
  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  const initials = getSellerInitials(venDes, coVen);
  const gradient = getSellerGradient(coVen || venDes);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !coVen) return;

    try {
      setIsUploading(true);
      // 1. Convertir y optimizar la imagen a formato Base64 (DataURL)
      const compressed = await compressProfileImage(file, {
        maxSize: 300,
        quality: 0.82
      });
      const base64Photo = compressed.dataUrl;

      // 2. Respaldar también en Supabase Storage en la carpeta 'usuarios/'
      const fileName = `asesor_${coVen.toLowerCase()}`;
      try {
        await uploadImageToStorage(base64Photo, STORAGE_FOLDERS.USERS, fileName);
      } catch (storageErr) {
        console.warn('[SellerAvatar] Respaldo en Storage:', storageErr);
      }

      // 3. Persistir directamente en formato Base64 en Supabase
      await updateSupabaseSellerPhoto(coVen, base64Photo);

      // 4. Notificar al componente padre con la foto en Base64
      if (onPhotoUpdated) {
        onPhotoUpdated(base64Photo, coVen);
      }
      setImageError(false);
      notify.success(`Foto de perfil actualizada para ${venDes}`);
    } catch (err) {
      console.error('[SellerAvatar] Error subiendo foto de asesor:', err);
      notify.error('Error al subir la foto del asesor: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const hasPhoto = Boolean(photoUrl && typeof photoUrl === 'string' && (photoUrl.startsWith('http') || photoUrl.startsWith('data:image')));
  const fontSize = Math.max(11, Math.round(size * 0.38));
  const cameraBtnSize = Math.max(22, Math.round(size * 0.35));

  return (
    <div
      className={`seller-avatar-container ${className}`}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        flexShrink: 0,
        ...style
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
          border: '2px solid rgba(255, 255, 255, 0.85)',
          position: 'relative'
        }}
      >
        {hasPhoto && !imageError ? (
          <img
            src={photoUrl}
            alt={venDes}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
          />
        ) : (
          <span
            style={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: `${fontSize}px`,
              fontFamily: 'var(--font-tech, "Inter", sans-serif)',
              letterSpacing: '0.5px',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              userSelect: 'none'
            }}
          >
            {initials}
          </span>
        )}

        {/* Indicador de carga si está subiendo */}
        {isUploading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              borderRadius: '50%'
            }}
          >
            <Loader2 size={Math.max(14, Math.round(size * 0.4))} className="animate-spin" />
          </div>
        )}
      </div>

      {/* Botón flotante para cambiar foto */}
      {canEdit && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onClick={(e) => e.stopPropagation()}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isUploading}
            title="Cambiar foto de perfil del asesor"
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: `${cameraBtnSize}px`,
              height: `${cameraBtnSize}px`,
              borderRadius: '50%',
              background: 'var(--motorven-navy, #002b7a)',
              color: '#ffffff',
              border: '2px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
              padding: 0,
              transition: 'transform 0.15s ease, background 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.background = '#0284c7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'var(--motorven-navy, #002b7a)';
            }}
          >
            <Camera size={Math.max(10, Math.round(cameraBtnSize * 0.55))} />
          </button>
        </>
      )}

      {/* Badge opcional de código de asesor */}
      {showBadge && coVen && (
        <span
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 43, 122, 0.95)',
            color: '#ffffff',
            fontSize: '9px',
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          {coVen}
        </span>
      )}
    </div>
  );
}
