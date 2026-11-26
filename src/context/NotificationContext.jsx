import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X, 
  HelpCircle,
  Volume2,
  ShieldAlert
} from 'lucide-react';
import { playNotificationSound, areSoundsEnabled } from '../services/soundService';

const NotificationContext = createContext(null);

export function NotificationProvider({ children, config }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [alertDialog, setAlertDialog] = useState(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const handleConfigChange = (e) => {
      if (e?.detail) configRef.current = e.detail;
    };
    window.addEventListener('signum_config_updated', handleConfigChange);
    return () => window.removeEventListener('signum_config_updated', handleConfigChange);
  }, []);

  // Remover toast por ID
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Agregar toast general
  const addToast = useCallback((type, message, options = {}) => {
    const id = options.id || `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duration = options.duration !== undefined ? options.duration : 4500;
    const title = options.title || (
      type === 'success' ? 'Éxito' :
      type === 'error' ? 'Error del Sistema' :
      type === 'warning' ? 'Advertencia' : 'Notificación'
    );

    // Reproducir efecto de sonido Motorven
    playNotificationSound(type, configRef.current);

    const newToast = {
      id,
      type,
      title,
      message,
      duration,
      createdAt: Date.now()
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 5)]); // Máximo 6 toasts visibles a la vez

    return id;
  }, []);

  // Diálogo modal de confirmación con promesa
  const showConfirm = useCallback(({
    title = '¿Confirmar Acción?',
    message = '¿Está seguro de que desea continuar?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = false,
    type = isDestructive ? 'error' : 'warning'
  }) => {
    return new Promise((resolve) => {
      // Sonido de confirmación
      playNotificationSound('confirm', configRef.current);

      setConfirmDialog({
        id: `confirm_${Date.now()}`,
        title,
        message,
        confirmText,
        cancelText,
        isDestructive,
        type,
        resolve: (result) => {
          setConfirmDialog(null);
          resolve(result);
        }
      });
    });
  }, []);

  // Diálogo modal de alerta modal formal con promesa
  const showAlertModal = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      const type = options.type || 'warning';
      const title = options.title || (
        type === 'error' ? 'Atención Requerida' :
        type === 'warning' ? 'Aviso Importante' : 'Notificación'
      );
      const confirmText = options.confirmText || 'Entendido';

      playNotificationSound(type, configRef.current);

      setAlertDialog({
        id: `alert_${Date.now()}`,
        title,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        confirmText,
        type,
        resolve: () => {
          setAlertDialog(null);
          resolve();
        }
      });
    });
  }, []);

  const notify = useMemo(() => ({
    success: (msg, opts) => addToast('success', msg, opts),
    error: (msg, opts) => addToast('error', msg, opts),
    warning: (msg, opts) => addToast('warning', msg, opts),
    info: (msg, opts) => addToast('info', msg, opts),
    dismiss: removeToast,
    confirm: showConfirm,
    alert: (msg, opts) => addToast('warning', msg, opts), // Por defecto toast rápido
    modalAlert: showAlertModal
  }), [addToast, removeToast, showConfirm, showAlertModal]);

  // Instalar puente global para llamadas fuera de React y reemplazar window.alert
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.$notify = notify;
      window.__SIGNUM_NOTIFY__ = notify;

      // Respaldar alert nativo
      if (!window._nativeAlert) {
        window._nativeAlert = window.alert;
      }

      // Interceptar alert() de JavaScript para que use nuestro diseño con sonido
      window.alert = (msg) => {
        const text = typeof msg === 'string' ? msg : (msg ? JSON.stringify(msg) : '');
        // Determinar si parece error, advertencia o éxito por texto
        const lower = text.toLowerCase();
        let detectedType = 'warning';
        if (lower.includes('error') || lower.includes('falló') || lower.includes('inválido') || lower.includes('denegad')) {
          detectedType = 'error';
        } else if (lower.includes('éxito') || lower.includes('exitos') || lower.includes('guardado') || lower.includes('correctamente')) {
          detectedType = 'success';
        }

        notify[detectedType](text, {
          title: detectedType === 'error' ? 'Alerta del Sistema' : detectedType === 'success' ? 'Éxito' : 'Aviso Motorven'
        });
      };
    }

    return () => {
      if (typeof window !== 'undefined' && window._nativeAlert) {
        window.alert = window._nativeAlert;
      }
    };
  }, [addToast, showConfirm, showAlertModal]);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      
      {/* Toast Stack Flotante */}
      <div 
        className="motorven-toast-container"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100% - 40px)',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* Modal de Confirmación Motorven */}
      {confirmDialog && (
        <ConfirmDialogModal 
          dialog={confirmDialog} 
          onClose={() => confirmDialog.resolve(false)}
          onConfirm={() => confirmDialog.resolve(true)}
        />
      )}

      {/* Modal de Alerta Formal Motorven */}
      {alertDialog && (
        <AlertDialogModal 
          dialog={alertDialog}
          onClose={() => alertDialog.resolve()}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Si se usa fuera del Provider, fallback a window.$notify si existe
    if (typeof window !== 'undefined' && window.$notify) {
      return window.$notify;
    }
    // Fallback pasivo seguro
    return {
      success: (msg) => console.log('SUCCESS:', msg),
      error: (msg) => console.error('ERROR:', msg),
      warning: (msg) => console.warn('WARNING:', msg),
      info: (msg) => console.info('INFO:', msg),
      dismiss: () => {},
      confirm: async () => window.confirm('¿Continuar?'),
      alert: (msg) => alert(msg),
      modalAlert: async (msg) => alert(msg)
    };
  }
  return context;
}

/**
 * Componente individual de Toast con estilo Motorven Glassmorphism y barra de progreso
 */
function ToastItem({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(toast.duration);

  useEffect(() => {
    if (toast.duration <= 0) return;

    const intervalTime = 25;
    const step = (intervalTime / toast.duration) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          const next = prev - step;
          if (next <= 0) {
            clearInterval(timer);
            setTimeout(() => onDismiss(), 0);
            return 0;
          }
          return next;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast.duration, isPaused, onDismiss]);

  const stylesByType = {
    success: {
      border: '1px solid rgba(16, 185, 129, 0.45)',
      glow: '0 8px 30px rgba(16, 185, 129, 0.22)',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeColor: '#10b981',
      barColor: '#10b981',
      icon: <CheckCircle2 size={22} className="text-emerald-400" />
    },
    error: {
      border: '1px solid rgba(230, 0, 18, 0.55)',
      glow: '0 8px 30px rgba(230, 0, 18, 0.25)',
      badgeBg: 'rgba(230, 0, 18, 0.18)',
      badgeColor: '#e60012',
      barColor: '#e60012',
      icon: <AlertCircle size={22} className="text-red-500" />
    },
    warning: {
      border: '1px solid rgba(245, 158, 11, 0.5)',
      glow: '0 8px 30px rgba(245, 158, 11, 0.22)',
      badgeBg: 'rgba(245, 158, 11, 0.16)',
      badgeColor: '#f59e0b',
      barColor: '#f59e0b',
      icon: <AlertTriangle size={22} className="text-amber-400" />
    },
    info: {
      border: '1px solid rgba(0, 242, 254, 0.45)',
      glow: '0 8px 30px rgba(0, 43, 122, 0.35)',
      badgeBg: 'rgba(0, 242, 254, 0.15)',
      badgeColor: '#00f2fe',
      barColor: '#00f2fe',
      icon: <Info size={22} className="text-cyan-400" />
    }
  };

  const style = stylesByType[toast.type] || stylesByType.info;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        pointerEvents: 'auto',
        position: 'relative',
        background: 'rgba(10, 16, 32, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '12px',
        border: style.border,
        boxShadow: style.glow,
        overflow: 'hidden',
        color: '#f1f5f9',
        animation: 'motorvenToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 16px', gap: '12px' }}>
        <div style={{ 
          background: style.badgeBg, 
          padding: '6px', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {style.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: '1px' }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: 700, 
            letterSpacing: '0.02em',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}>
            <span>{toast.title}</span>
            <span style={{ 
              fontSize: '0.65rem', 
              color: style.badgeColor, 
              background: style.badgeBg, 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>
              MOTORVEN
            </span>
          </div>
          <div style={{ 
            fontSize: '0.825rem', 
            color: '#cbd5e1', 
            lineHeight: 1.45,
            wordBreak: 'break-word'
          }}>
            {toast.message}
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease, background-color 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Cerrar notificación"
        >
          <X size={16} />
        </button>
      </div>

      {/* Barra de progreso de auto-cierre */}
      {toast.duration > 0 && (
        <div style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.08)',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: style.barColor,
            transition: 'width 0.05s linear'
          }} />
        </div>
      )}
    </div>
  );
}

/**
 * Modal de Confirmación interactivo Motorven
 */
function ConfirmDialogModal({ dialog, onClose, onConfirm }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onConfirm]);

  const isDestructive = dialog.isDestructive;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backgroundColor: 'rgba(3, 7, 18, 0.82)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(145deg, #0d172e 0%, #060a17 100%)',
          borderRadius: '16px',
          border: isDestructive ? '1px solid rgba(230, 0, 18, 0.45)' : '1px solid rgba(0, 43, 122, 0.5)',
          boxShadow: isDestructive ? '0 20px 50px rgba(230, 0, 18, 0.25)' : '0 20px 50px rgba(0, 43, 122, 0.35)',
          overflow: 'hidden',
          animation: 'motorvenModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Encabezado Corporativo Motorven */}
        <div style={{
          padding: '16px 20px',
          background: isDestructive 
            ? 'linear-gradient(90deg, rgba(230, 0, 18, 0.25), transparent)' 
            : 'linear-gradient(90deg, rgba(0, 43, 122, 0.4), transparent)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: isDestructive ? 'rgba(230, 0, 18, 0.2)' : 'rgba(0, 43, 122, 0.3)',
              color: isDestructive ? '#ef4444' : '#00f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isDestructive ? '1px solid rgba(230, 0, 18, 0.4)' : '1px solid rgba(0, 242, 254, 0.3)'
            }}>
              {isDestructive ? <ShieldAlert size={18} /> : <HelpCircle size={18} />}
            </div>
            <div>
              <div style={{ 
                fontSize: '0.72rem', 
                color: isDestructive ? '#f87171' : '#38bdf8', 
                fontWeight: 700, 
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                {isDestructive ? 'CONFIRMACIÓN CRÍTICA' : 'CONFIRMACIÓN REQUERIDA'}
              </div>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.05rem', 
                fontWeight: 700, 
                color: '#ffffff' 
              }}>
                {dialog.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Mensaje */}
        <div style={{ padding: '24px 20px', color: '#cbd5e1', fontSize: '0.925rem', lineHeight: 1.6 }}>
          {dialog.message}
        </div>

        {/* Acciones */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(4, 7, 15, 0.6)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
          >
            {dialog.cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: isDestructive 
                ? 'linear-gradient(135deg, #e60012 0%, #b3000e 100%)' 
                : 'linear-gradient(135deg, #002b7a 0%, #1e3a8a 100%)',
              color: '#ffffff',
              border: isDestructive ? '1px solid #ff4d4f' : '1px solid #38bdf8',
              cursor: 'pointer',
              boxShadow: isDestructive 
                ? '0 0 15px rgba(230, 0, 18, 0.45)' 
                : '0 0 15px rgba(0, 43, 122, 0.5)',
              transition: 'transform 0.15s ease, filter 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1.0)'}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de Alerta Formal Motorven
 */
function AlertDialogModal({ dialog, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backgroundColor: 'rgba(3, 7, 18, 0.82)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)'
    }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'linear-gradient(145deg, #0d172e 0%, #060a17 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(0, 43, 122, 0.5)',
          boxShadow: '0 20px 50px rgba(0, 43, 122, 0.35)',
          overflow: 'hidden',
          animation: 'motorvenModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(90deg, rgba(0, 43, 122, 0.4), transparent)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(0, 43, 122, 0.3)',
              color: '#00f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(0, 242, 254, 0.3)'
            }}>
              <AlertCircle size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
              {dialog.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px 20px', color: '#cbd5e1', fontSize: '0.925rem', lineHeight: 1.6 }}>
          {dialog.message}
        </div>

        <div style={{
          padding: '16px 20px',
          background: 'rgba(4, 7, 15, 0.6)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #002b7a 0%, #1e3a8a 100%)',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(0, 43, 122, 0.5)'
            }}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationContext;
