import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  Menu,
  X,
  Sun,
  Moon,
  TrendingUp,
  LogOut,
  Shield,
  Check,
  RefreshCw,
  CheckCircle2,
  Clock,
  Landmark,
  AlertCircle,
  Euro,
  Cloud,
  CloudOff,
  Database,
  Server,
  Zap,
  MoreVertical,
  Sliders,
  BookOpen,
  HelpCircle,
  Settings,
  Truck,
  ShoppingCart,
  Users,
  ExternalLink,
  Camera,
  Trash2
} from 'lucide-react';
import { formatBs, formatUsd } from '../services/formatService';
import { canModifyRates, getRoleMeta, isMasterOrGerencia, isMasterAdmin, canAccessModule } from '../services/authService';
import { fetchBcvRateDetails, fetchEuroRateDetails, fetchUsdtRateDetails, getActiveBackendUrl, setCustomBackendUrl } from '../services/supabaseService';
import { subscribeSyncStatus, flushSyncQueue } from '../services/offlineSyncService';
import { uploadUserProfilePhoto, deleteUserProfilePhoto } from '../services/imageStorageService';
import { compressProfileImage } from '../services/imageCompression';
import AppConfigModal from './AppConfigModal';
import AppHelpCenterModal from './AppHelpCenterModal';
import { useNotification } from '../context/NotificationContext';

const ROLE_SHORT_NAMES = {
  'ADMINISTRADOR MASTER': 'MASTER',
  'TECNOLOGÍA & INFORMÁTICA': 'TI',
  'DIRECCIÓN & GERENCIA': 'GERENCIA',
  'ADMINISTRACIÓN & FINANZAS': 'FINANZAS',
  'VENTAS & MOSTRADOR': 'VENTAS',
  'ALMACÉN & LOGÍSTICA': 'ALMACÉN',
  'AUDITORÍA & CONTROL': 'AUDITORÍA'
};

export default function HeaderBar({
  config,
  onOpenTasaModal,
  onUpdateTasa,
  onUpdateTasaKeystone,
  onSaveConfig,
  onNavigate,
  globalSearch,
  setGlobalSearch,
  mobileMenuOpen,
  setMobileMenuOpen,
  sidebarCollapsed = false,
  onToggleSidebar,
  theme,
  onToggleTheme,
  currentUser,
  onUpdateCurrentUser,
  onLogout,
  onSyncProfit,
  onOpenOrdersSalesModal,
  productsCount = 31,
  clientsCount = 610,
  products = [],
  clients = [],
  sales = [],
  orders = [],
  suppliers = [],
  cashMovements = []
}) {
  const notify = useNotification();
  const currentBcvVal = config?.tasaDolar !== undefined && config?.tasaDolar !== null ? Number(config.tasaDolar) : 827.73;
  // Si la tasa previa era baja (<= 50) y la tasa BCV es alta (> 100), sugerir un valor coherente en Bolívares
  const defaultKeystoneBs = currentBcvVal > 100
    ? (config?.tasaKeystone && Number(config.tasaKeystone) > 100 ? Number(config.tasaKeystone) : Math.round(currentBcvVal * 1.03 * 100) / 100)
    : (config?.tasaKeystone ? Number(config.tasaKeystone) : 38.50);
  const tasaKeystoneVal = defaultKeystoneBs;

  // Helper para formatear dígitos en centavos a texto monetario en Bs. (ej: 92530 -> "925,30")
  const formatCentsToCurrency = (cents) => {
    const num = (parseInt(cents || '0', 10)) / 100;
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Estados para Modal Keystone en Bolívares (Entrada de derecha a izquierda con 2 decimales)
  const [showKeystoneModal, setShowKeystoneModal] = useState(false);
  const [rawKeystoneDigits, setRawKeystoneDigits] = useState(() => {
    return String(Math.round((tasaKeystoneVal || 850.00) * 100));
  });
  const [savingKeystone, setSavingKeystone] = useState(false);

  // Estados para Tasas Informativas Euro y USDT (Solo Visualización / No editables)
  const [tasaEuroVal, setTasaEuroVal] = useState(() => config?.tasaEuro || 963.21);
  const [tasaUsdtVal, setTasaUsdtVal] = useState(() => config?.tasaUsdt || 963.00);
  const [usdtSource, setUsdtSource] = useState('Binance P2P');

  // Estado de Conectividad y Sincronización Offline Supabase
  const [syncStatus, setSyncStatus] = useState({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0
  });
  const [showServerModal, setShowServerModal] = useState(false);
  const [customServerInput, setCustomServerInput] = useState(() => getActiveBackendUrl());

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    if (syncStatus.isSyncing) return;
    await flushSyncQueue();
  };

  useEffect(() => {
    let isMounted = true;
    const fetchExtraRates = async () => {
      try {
        const [euroData, usdtData] = await Promise.all([
          fetchEuroRateDetails(),
          fetchUsdtRateDetails()
        ]);
        if (isMounted) {
          if (euroData && euroData.rate) {
            setTasaEuroVal(euroData.rate);
          }
          if (usdtData && usdtData.rate) {
            setTasaUsdtVal(usdtData.rate);
            if (usdtData.fuente) {
              setUsdtSource(usdtData.fuente);
            }
          }
        }
      } catch (err) {
        console.warn('Error al sincronizar tasas informativas Euro/USDT con Binance:', err);
      }
    };

    fetchExtraRates();
    // Polling en tiempo real con Binance cada 30 segundos
    const interval = setInterval(fetchExtraRates, 30000);

    const handleWindowFocus = () => {
      fetchExtraRates();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  // Estados para Modal BCV en Tiempo Real (Inmutable / Solo Sincronización Oficial)
  const [showBcvModal, setShowBcvModal] = useState(false);
  const [syncingBcv, setSyncingBcv] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState(null);
  const [bcvDetails, setBcvDetails] = useState(null);

  const isAdmin = currentUser ? canModifyRates(currentUser.rol, currentUser) : true;

  // Estados para Menú de 3 Puntos (Configuración & Ayuda)
  const [dropdownMenuOpen, setDropdownMenuOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const dropdownMenuRef = React.useRef(null);

  // Estados para Modal de Foto de Perfil & Supabase Storage
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const headerFileInputRef = React.useRef(null);

  const handleHeaderPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    try {
      setUploadingPhoto(true);
      const compressed = await compressProfileImage(file, { maxSize: 240, quality: 0.82 });
      const res = await uploadUserProfilePhoto({
        userId: currentUser.id,
        username: currentUser.username,
        fileOrDataUrl: compressed.dataUrl,
        currentUser,
        onUpdateCurrentUser
      });
      if (!res.success) throw new Error(res.error);
      if (notify && typeof notify.success === 'function') {
        notify.success('¡Foto de perfil guardada exitosamente en Supabase Storage!');
      }
    } catch (err) {
      console.error('Error al subir foto:', err);
      if (notify && typeof notify.error === 'function') {
        notify.error(err.message || 'Error al guardar foto en Supabase.');
      }
    } finally {
      setUploadingPhoto(false);
      if (headerFileInputRef.current) headerFileInputRef.current.value = '';
    }
  };

  const handleHeaderPhotoDelete = async () => {
    if (!currentUser || !currentUser.foto) return;
    if (!window.confirm('¿Está seguro de eliminar su foto de perfil de Supabase?')) return;
    try {
      setUploadingPhoto(true);
      const res = await deleteUserProfilePhoto({
        userId: currentUser.id,
        username: currentUser.username,
        currentPhotoUrl: currentUser.foto,
        currentUser,
        onUpdateCurrentUser
      });
      if (!res.success) throw new Error(res.error);
      if (notify && typeof notify.success === 'function') {
        notify.success('Foto de perfil eliminada permanentemente de Supabase.');
      }
    } catch (err) {
      console.error('Error al eliminar foto:', err);
      if (notify && typeof notify.error === 'function') {
        notify.error(err.message || 'Error al eliminar foto de Supabase.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  useEffect(() => {
    if (!dropdownMenuOpen) return;
    const handleClickOutside = (event) => {
      if (dropdownMenuRef.current && !dropdownMenuRef.current.contains(event.target)) {
        setDropdownMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [dropdownMenuOpen]);

  useEffect(() => {
    if (tasaKeystoneVal) {
      setRawKeystoneDigits(String(Math.round(tasaKeystoneVal * 100)));
    }
  }, [tasaKeystoneVal]);

  const handleOpenBcv = () => {
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);
    setShowBcvModal(true);
  };

  const handleSyncBcvNow = async () => {
    try {
      setSyncingBcv(true);
      setSyncSuccessMsg(null);
      setSyncErrorMsg(null);
      const details = await fetchBcvRateDetails();
      if (details && details.rate) {
        setBcvDetails(details);
        if (onUpdateTasa) {
          await onUpdateTasa(details.rate);
        }
        setSyncSuccessMsg(`¡Sincronización exitosa! Tasa oficial BCV actualizada a ${formatBs(details.rate)}`);
        setTimeout(() => setSyncSuccessMsg(null), 5000);
      } else {
        setSyncErrorMsg('No se pudo obtener la tasa del BCV en este momento. Verifique la conexión a internet.');
      }
    } catch (err) {
      console.error('Error al sincronizar con BCV:', err);
      setSyncErrorMsg('Error al conectar con el servicio oficial del BCV.');
    } finally {
      setSyncingBcv(false);
    }
  };

  const handleOpenKeystone = () => {
    if (!isAdmin) {
      notify.warning('Acción restringida: Solo Gerencia y Administración pueden ajustar las tasas de cambio.');
      return;
    }
    setRawKeystoneDigits(String(Math.round((tasaKeystoneVal || 850.00) * 100)));
    setShowKeystoneModal(true);
  };

  // Manejo de pulsaciones de teclas para rellenar de derecha a izquierda con 2 decimales
  const handleKeystoneKeyDown = (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      setRawKeystoneDigits((prev) => {
        const str = String(prev || '0');
        if (str.length <= 1) return '0';
        return str.slice(0, -1);
      });
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      setRawKeystoneDigits((prev) => {
        const str = prev === '0' ? '' : String(prev || '');
        if (str.length >= 9) return prev; // Límite razonable (hasta 9.999.999,99)
        return str + e.key;
      });
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      setRawKeystoneDigits('0');
      return;
    }
  };

  const handleKeystoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    const clean = val.replace(/^0+/, '') || '0';
    if (clean.length <= 9) {
      setRawKeystoneDigits(clean);
    }
  };

  const handleKeystonePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    const cleaned = paste.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0) {
      setRawKeystoneDigits(String(Math.round(num * 100)));
    } else {
      const digits = paste.replace(/\D/g, '').replace(/^0+/, '') || '0';
      setRawKeystoneDigits(digits.slice(0, 9));
    }
  };

  const handleClearKeystone = () => {
    setRawKeystoneDigits('0');
  };

  const handleQuickAdjust = (adj) => {
    const currentNum = (parseInt(rawKeystoneDigits || '0', 10)) / 100;
    const nextNum = Math.max(0.01, currentNum + adj);
    setRawKeystoneDigits(String(Math.round(nextNum * 100)));
  };

  const currentKeystoneNum = (parseInt(rawKeystoneDigits || '0', 10)) / 100;

  const handleSaveKeystone = async (e) => {
    e.preventDefault();
    const val = currentKeystoneNum;
    if (!isNaN(val) && val > 0) {
      try {
        setSavingKeystone(true);
        if (onUpdateTasaKeystone) {
          await onUpdateTasaKeystone(val);
        }
        setShowKeystoneModal(false);
        notify.success(`Tasa Keystone guardada exitosamente: ${val.toFixed(2)} Bs./USD`);
      } catch (err) {
        console.error(err);
        notify.error('Error al guardar la tasa Keystone.');
      } finally {
        setSavingKeystone(false);
      }
    } else {
      notify.warning('Por favor ingrese una tasa válida y mayor a 0 en Bolívares.');
    }
  };


  // Función de Salida del Sistema — Cierra la sesión activa de forma segura y regresa a la pantalla de Login
  const handleSystemExit = async () => {
    setShowExitModal(false);
    setDropdownMenuOpen(false);
    try {
      if (onLogout) {
        await onLogout();
      }
    } catch (err) {
      console.warn('Error durante onLogout:', err);
    }
    try {
      localStorage.removeItem('signum_active_user');
      sessionStorage.clear();
    } catch (_) {}
    try {
      if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (_) {}
  };


  return (
    <>

      <header className="top-header">
        <div className="header-main-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => {
                if (window.innerWidth <= 1024) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else if (onToggleSidebar) {
                  onToggleSidebar();
                }
              }}
              aria-label="Menú de Navegación"
              title={sidebarCollapsed ? "Expandir menú lateral (Ctrl+B)" : "Contraer menú lateral (Ctrl+B)"}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* CONTENEDOR 1: TASAS Y CONTROL EN DOS COLUMNAS */}
          <div className="header-master-bar">

            {/* COLUMNA 1: ETIQUETAS EN GRIDVIEW FLUIDO */}
            <div className="header-labels-grid">
              {/* 1.1 Tasa Oficial BCV */}
              <button
                type="button"
                className="tasa-badge bcv"
                onClick={handleOpenBcv}
                title="Tasa Oficial Banco Central de Venezuela (Sincronizada en tiempo real) — Clic para detalles o sincronizar"
              >
                <span className="live-dot" title="Sincronizado en tiempo real con el BCV"></span>
                <DollarSign size={12} />
                <span className="tasa-badge-tag">BCV:</span>
                <span className="tasa-badge-val">{formatBs(config?.tasaDolar || 36.50)}</span>
              </button>

              {/* 1.2 Tasa Comercial KEYSTONE */}
              <button
                type="button"
                className="tasa-badge keystone"
                onClick={handleOpenKeystone}
                title={isAdmin ? "Tasa Comercial KEYSTONE (Bolívares) — Clic para ajustar tasa" : "Tasa Comercial KEYSTONE (Bolívares)"}
                style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              >
                <TrendingUp size={12} />
                <span className="tasa-badge-tag">KEY:</span>
                <span className="tasa-badge-val">{formatBs(tasaKeystoneVal)}</span>
              </button>

              {/* 1.3 Tasa Oficial Euro BCV */}
              <div
                className="tasa-badge euro read-only"
                title={`Tasa Oficial Euro BCV: ${formatBs(tasaEuroVal)} (Solo visualización no editable)`}
              >
                <Euro size={12} />
                <span className="tasa-badge-tag">EUR:</span>
                <span className="tasa-badge-val">{formatBs(tasaEuroVal)}</span>
              </div>

              {/* 1.4 Tasa USDT en vivo */}
              <div
                className="tasa-badge usdt read-only"
                title={`Tasa USDT en vivo sincronizada con ${usdtSource}: ${formatBs(tasaUsdtVal)} (Solo visualización no editable)`}
              >
                <span className="live-dot" title={`Sincronizado en tiempo real con ${usdtSource}`}></span>
                <span className="usdt-symbol-icon">₮</span>
                <span className="tasa-badge-tag">USDT:</span>
                <span className="tasa-badge-val">{formatBs(tasaUsdtVal)}</span>
              </div>

              {/* 1.5 Conectividad y Estado Sync Supabase */}
              <div
                className={`sync-connectivity-badge ${syncStatus.isOnline ? 'online' : 'offline'} ${syncStatus.pendingCount > 0 ? 'has-pending' : ''}`}
                onClick={() => {
                  setCustomServerInput(getActiveBackendUrl());
                  setShowServerModal(true);
                }}
                style={{ cursor: 'pointer' }}
                title="Conectividad con la base de datos y túnel HTTPS. Clic para ver detalles o configurar."
              >
                {syncStatus.isSyncing ? (
                  <>
                    <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Sync...</span>
                  </>
                ) : !syncStatus.isOnline ? (
                  <>
                    <CloudOff size={12} />
                    <span>Offline</span>
                    {syncStatus.pendingCount > 0 && (
                      <span className="sync-pending-tag">
                        {syncStatus.pendingCount}
                      </span>
                    )}
                  </>
                ) : syncStatus.pendingCount > 0 ? (
                  <>
                    <RefreshCw size={12} />
                    <span>{syncStatus.pendingCount} pendientes</span>
                  </>
                ) : (
                  <>
                    <Cloud size={12} />
                    <span className="sync-online-indicator">
                      <span className="sync-online-dot"></span>
                      <span className="sync-online-text">En Línea</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* COLUMNA 2: PERFIL, FECHA Y MENÚ DE TRES PUNTICOS EN UNA SOLA FILA */}
            <div className="header-user-controls-col">
              {/* 2.1 Chip de Usuario Activo */}
              {currentUser && (
                <div
                  className="user-profile-chip"
                  onClick={() => setShowProfileModal(true)}
                  style={{ cursor: 'pointer' }}
                  title={`Mi Perfil en Supabase: ${currentUser?.nombre || currentUser?.username} (${currentUser?.rol}) • Clic para ver, editar o eliminar foto`}
                >
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    {currentUser.foto ? (
                      <img
                        src={currentUser.foto}
                        alt={currentUser.nombre}
                        className="user-profile-avatar-img"
                      />
                    ) : (
                      <span className="user-profile-avatar-txt">{currentUser.avatar || '👤'}</span>
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        background: 'var(--motorven-navy, #002b7a)',
                        border: '1px solid #38bdf8',
                        borderRadius: '50%',
                        width: '12px',
                        height: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '7px'
                      }}
                      title="Gestionar foto en Supabase"
                    >
                      📷
                    </span>
                  </div>
                  <span className="user-profile-name">
                    {(currentUser?.nombre || currentUser?.username || 'Usuario').split(' ')[0]}
                  </span>
                  {(() => {
                    const rMeta = getRoleMeta(currentUser?.rol) || { label: currentUser?.rol || 'USUARIO', color: '#3b82f6' };
                    const shortRole = ROLE_SHORT_NAMES[currentUser?.rol] || (rMeta.label || 'USUARIO').split(' ')[0];
                    return (
                      <span
                        className="user-role-badge"
                        style={{
                          background: rMeta.gradient || rMeta.color || '#3b82f6',
                          color: '#fff'
                        }}
                        title={`Rol Oficial: ${rMeta.label || currentUser?.rol}`}
                      >
                        {shortRole}
                      </span>
                    );
                  })()}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExitModal(true);
                      }}
                      className="user-logout-btn"
                      title="Cerrar sesión / Salida del Sistema"
                    >
                      <LogOut size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* 2.2 Badge de Fecha */}
              <div className="date-badge" title={new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
                <Calendar size={13} color="var(--motorven-cyan)" />
                <span className="date-text">{new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}</span>
              </div>

              {/* 2.3 Botón de Tres Puntos Verticales y Menú de Opciones */}
              <div ref={dropdownMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`dock-options-btn ${dropdownMenuOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownMenuOpen(prev => !prev);
                  }}
                  title="Menú de Opciones: Configuración y Ayuda"
                  aria-label="Menú de Opciones: Configuración y Ayuda"
                  aria-expanded={dropdownMenuOpen}
                >
                  <MoreVertical size={16} />
                </button>

              {/* Menú Desplegable flotante */}
              {dropdownMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="header-dropdown-menu-floating"
                  style={{
                    position: 'fixed',
                    top: '64px',
                    right: '16px',
                    width: '345px',
                    maxWidth: 'calc(100vw - 24px)',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--bg-modal, #ffffff)',
                    border: '1px solid var(--border-glass-highlight, rgba(56, 189, 248, 0.35))',
                    borderRadius: '14px',
                    padding: '8px',
                    boxShadow: '0 20px 40px -5px rgba(0, 0, 0, 0.65), 0 0 25px rgba(0, 43, 122, 0.35)',
                    zIndex: 999999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    animation: 'fadeIn 0.15s ease-out',
                    overflow: 'hidden'
                  }}
                >
                  {/* Renglón 0: MI PERFIL & FOTO EN SUPABASE */}
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownMenuOpen(false);
                        setShowProfileModal(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 10px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease',
                        width: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-hover, rgba(0, 43, 122, 0.06))'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(0, 43, 122, 0.3))',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#38bdf8',
                          flexShrink: 0
                        }}
                      >
                        <Camera size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Mi Perfil & Foto Supabase
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Subir, cambiar o eliminar foto de perfil
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Renglón 1: CONFIGURACIÓN — Administrador Master / Configuración autorizada */}
                  {(currentUser ? canAccessModule(currentUser?.rol, 'configuracion', currentUser) : true) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownMenuOpen(false);
                        setShowConfigModal(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 10px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease',
                        width: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-hover, rgba(0, 43, 122, 0.06))'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.15), rgba(2, 132, 199, 0.2))',
                          border: '1px solid var(--border-glass)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--motorven-cyan)',
                          flexShrink: 0
                        }}
                      >
                        <Sliders size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.01em', color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                            CONFIGURACIÓN
                          </span>
                          <span
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: 'var(--motorven-navy-light)',
                              flexShrink: 0,
                              letterSpacing: '0.03em'
                            }}
                          >
                            SISTEMA
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Parámetros de toda la aplicación
                        </div>
                      </div>
                    </button>
                  )}

                  {(currentUser ? canAccessModule(currentUser?.rol, 'usuarios', currentUser) : true) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownMenuOpen(false);
                        if (onNavigate) onNavigate('usuarios');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 10px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease',
                        width: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-hover, rgba(0, 43, 122, 0.06))'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(230, 0, 18, 0.15), rgba(239, 68, 68, 0.2))',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--motorven-red)',
                          flexShrink: 0
                        }}
                      >
                        <Users size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.01em', color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                            GESTIÓN DE USUARIOS
                          </span>
                          <span
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(230, 0, 18, 0.15)',
                              color: 'var(--motorven-red)',
                              flexShrink: 0,
                              letterSpacing: '0.03em'
                            }}
                          >
                            ACCESOS
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Cuentas, permisos y auditoría
                        </div>
                      </div>
                    </button>
                  )}

                  {(currentUser?.rol === 'ADMINISTRADOR MASTER' || currentUser?.username?.toLowerCase() === 'edson designer' || currentUser?.rol === 'ADMINISTRADOR DEL SISTEMA' || currentUser?.rol === 'ADMIN') && (
                    <>

                      {/* Renglón: TABLAS SUPABASE */}
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownMenuOpen(false);
                          window.open('?view=supabase-tables', '_blank');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 10px',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s ease',
                          width: '100%',
                          boxSizing: 'border-box',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(2, 132, 199, 0.2))',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#38bdf8',
                            flexShrink: 0
                          }}
                        >
                          <ExternalLink size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.01em', color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                              TABLAS SUPABASE
                            </span>
                            <span
                              style={{
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                flexShrink: 0,
                                letterSpacing: '0.03em'
                              }}
                            >
                              NUEVA HOJA
                            </span>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Explorador de todas las 32 tablas en vivo
                          </div>
                        </div>
                      </button>

                      <div style={{ height: '1px', background: 'var(--border-glass)', margin: '2px 4px' }} />
                    </>
                  )}

                  {/* Renglón 2: AYUDA */}
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownMenuOpen(false);
                      setShowHelpModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                      width: '100%',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.2))',
                        border: '1px solid rgba(52, 211, 153, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#34d399',
                        flexShrink: 0
                      }}
                    >
                      <HelpCircle size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.01em', color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                          AYUDA
                        </span>
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            flexShrink: 0,
                            letterSpacing: '0.03em'
                          }}
                        >
                          MANUAL
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Centro de ayuda y manual interactivo
                      </div>
                    </div>
                  </button>

                  <div style={{ height: '1px', background: 'rgba(239,68,68,0.25)', margin: '4px 4px 2px' }} />

                  {/* Renglón: SALIDA DEL SISTEMA */}
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownMenuOpen(false);
                      setExitStep(1);
                      setShowExitModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: '10px',
                      border: '1px solid rgba(239,68,68,0.25)',
                      background: 'rgba(239,68,68,0.04)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                      width: '100%',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.04)'}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        flexShrink: 0,
                        fontSize: '1.1rem'
                      }}
                    >
                      ⏻
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                          SALIDA DEL SISTEMA
                        </span>
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(239,68,68,0.15)',
                            color: '#ef4444',
                            flexShrink: 0,
                            letterSpacing: '0.03em'
                          }}
                        >
                          SEGURO
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(239,68,68,0.7)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Cerrar sesión y limpiar caché del dispositivo
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENEDOR 2: DEBAJO DE LAS TASAS (DOCK INTEGRACIÓN SUPABASE) */}
      {isMasterAdmin(currentUser) && (
        <div className="header-profit-subrow">
          <div className="profit-subbar-dock">
            <button
              type="button"
              className="btn-server-explorer"
              onClick={() => window.open('?view=supabase-tables', '_blank')}
              title="Abrir explorador de tablas de Supabase en una hoja nueva del navegador"
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                color: '#38bdf8'
              }}
            >
              <ExternalLink size={12} />
              <span className="profit-status-wrapper">
                <span className="profit-status-dot" style={{ background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }}></span>
                <span>Tablas Supabase</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </header>

      {/* Modal para Ingresar Tasa Keystone en Bolívares */}
      {showKeystoneModal && (
        <div className="modal-overlay" onClick={() => setShowKeystoneModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px', padding: '1.75rem' }}
          >
            <div className="modal-header" style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={22} color="var(--motorven-cyan, #00f0ff)" />
                <span>Tasa Comercial Keystone (Bolívares)</span>
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowKeystoneModal(false)}
                title="Cerrar ventana"
              >
                ×
              </button>
            </div>

            {/* Resumen de Tasa Keystone en Bs. y Tasa BCV */}
            <div
              style={{
                background: 'rgba(0, 240, 255, 0.06)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '12px',
                padding: '0.9rem 1.15rem',
                marginBottom: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--motorven-cyan, #00f0ff)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Tasa Keystone Vigente
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
                    {formatBs(tasaKeystoneVal)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    1 USD = {formatBs(tasaKeystoneVal)}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Referencia Tasa BCV
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--motorven-gold, #f59e0b)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
                    {formatBs(config?.tasaDolar || 827.73)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    1 USD = {formatBs(config?.tasaDolar || 827.73)}
                  </div>
                </div>
              </div>

              {config?.tasaDolar && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-glass, rgba(148, 163, 184, 0.25))', fontSize: '0.74rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Diferencial con respecto al BCV:</span>
                  <span style={{ fontWeight: 700, color: tasaKeystoneVal >= config.tasaDolar ? 'var(--motorven-cyan, #00f0ff)' : '#ef4444' }}>
                    {tasaKeystoneVal >= config.tasaDolar ? '+' : ''}{formatBs(tasaKeystoneVal - config.tasaDolar)} ({((tasaKeystoneVal - config.tasaDolar) / config.tasaDolar * 100).toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveKeystone}>
              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Nueva Tasa Keystone (Bolívares)</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--motorven-cyan, #00f0ff)', fontWeight: 700 }}>
                    Moneda: Bolívares (Bs. / USD)
                  </span>
                </label>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      color: 'var(--motorven-cyan, #00f0ff)',
                      pointerEvents: 'none',
                      zIndex: 2
                    }}
                  >
                    Bs.
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control"
                    value={formatCentsToCurrency(rawKeystoneDigits)}
                    onKeyDown={handleKeystoneKeyDown}
                    onChange={handleKeystoneChange}
                    onPaste={handleKeystonePaste}
                    autoFocus
                    required
                    style={{
                      paddingLeft: '44px',
                      paddingRight: '50px',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-code)',
                      color: 'var(--text-main)',
                      textAlign: 'right',
                      letterSpacing: '0.5px'
                    }}
                  />
                  {rawKeystoneDigits !== '0' && (
                    <button
                      type="button"
                      onClick={handleClearKeystone}
                      title="Borrar a 0,00"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'var(--bg-secondary, rgba(0, 0, 0, 0.05))',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-muted)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      C
                    </button>
                  )}
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Relleno de derecha a izquierda con 2 decimales (incluyendo el cero).</span>
                  <span style={{ color: 'var(--motorven-cyan, #00f0ff)', fontWeight: 700 }}>{formatBs(currentKeystoneNum)}</span>
                </small>
              </div>

              {/* Botones de ajuste rápido en Bolívares */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                  Ajustes rápidos en Bolívares (Bs.):
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[-50, -20, -10, -5, 5, 10, 20, 50].map((adj) => (
                    <button
                      key={adj}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleQuickAdjust(adj)}
                      style={{
                        fontSize: '0.72rem',
                        padding: '3px 8px',
                        background: 'var(--bg-secondary, rgba(0,0,0,0.04))',
                        borderColor: 'var(--border-glass)'
                      }}
                    >
                      {adj > 0 ? `+ Bs. ${adj}` : `- Bs. ${Math.abs(adj)}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla de Conversión Rápida con la Tasa Keystone */}
              {currentKeystoneNum > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                    Equivalencias calculadas a Tasa Keystone ({formatBs(currentKeystoneNum)}):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[1, 5, 10, 20, 50, 100].map((usd) => {
                      const valBs = usd * currentKeystoneNum;
                      return (
                        <div
                          key={usd}
                          style={{
                            background: 'rgba(0, 240, 255, 0.03)',
                            border: '1px solid rgba(0, 240, 255, 0.15)',
                            borderRadius: '8px',
                            padding: '5px 8px',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>${usd} USD</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--motorven-cyan, #00f0ff)', fontWeight: 800, fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                            {formatBs(valBs)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowKeystoneModal(false)}
                  disabled={savingKeystone}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingKeystone}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <TrendingUp size={16} />
                  <span>{savingKeystone ? 'Guardando...' : 'Guardar Tasa Keystone (Bs.)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Sincronización en Tiempo Real con el BCV (Banco Central de Venezuela) */}
      {showBcvModal && (
        <div className="modal-overlay" onClick={() => setShowBcvModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '1.75rem' }}
          >
            <div className="modal-header" style={{ marginBottom: '1.2rem', paddingBottom: '0.75rem' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Landmark size={22} color="var(--motorven-gold, #f59e0b)" />
                <span>Tasa Oficial BCV (Banco Central de Venezuela)</span>
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowBcvModal(false)}
                title="Cerrar ventana"
              >
                ×
              </button>
            </div>

            {/* Banner de Sincronización en Tiempo Real */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--motorven-gold, #f59e0b)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                    Tasa Oficial BCV Vigente (Bolívares)
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px', fontFamily: 'var(--font-code)' }}>
                    {formatBs(config?.tasaDolar || 36.50)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                    1 USD = {formatBs(config?.tasaDolar || 36.50)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '20px',
                      padding: '3px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 700
                    }}
                  >
                    <span className="live-dot"></span>
                    <span>EN VIVO</span>
                  </div>

                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Banco Central de Venezuela
                  </span>
                </div>
              </div>

              {bcvDetails?.fechaActualizacion && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-glass, rgba(148, 163, 184, 0.25))', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={12} />
                  <span>Publicación oficial BCV: {new Date(bcvDetails.fechaActualizacion).toLocaleString('es-VE')}</span>
                </div>
              )}
            </div>

            {/* Mensajes de feedback */}
            {syncSuccessMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                  borderRadius: '10px',
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.78rem',
                  marginBottom: '1rem'
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{syncSuccessMsg}</span>
              </div>
            )}

            {syncErrorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  borderRadius: '10px',
                  padding: '0.7rem 0.9rem',
                  fontSize: '0.78rem',
                  marginBottom: '1rem'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{syncErrorMsg}</span>
              </div>
            )}

            {/* Botón de Sincronización Inmediata con BCV */}
            {isAdmin && (
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSyncBcvNow}
                  disabled={syncingBcv}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '0.75rem 1rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--motorven-gold, #f59e0b) 0%, #d97706 100%)',
                    border: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <RefreshCw size={16} className={syncingBcv ? 'spin' : ''} />
                  <span>{syncingBcv ? 'Sincronizando con el BCV...' : 'Sincronizar en Tiempo Real con el BCV Ahora'}</span>
                </button>
              </div>
            )}

            {/* Tabla de Equivalencias Rápidas en Bolívares */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Tabla de Conversión Rápida (Tasa BCV)
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px'
                }}
              >
                {[1, 5, 10, 20, 50, 100].map((usd) => {
                  const bsVal = usd * (config?.tasaDolar || 36.50);
                  return (
                    <div
                      key={usd}
                      style={{
                        background: 'var(--bg-secondary, rgba(0, 0, 0, 0.03))',
                        border: '1px solid var(--border-glass, rgba(148, 163, 184, 0.15))',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>${usd} USD</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--motorven-gold, #f59e0b)', fontWeight: 800, fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                        {formatBs(bsVal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Aviso de Tasa Oficial Inmutable y Automatizada */}
            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.85rem 1rem',
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
                lineHeight: 1.45
              }}
            >
              <Shield size={18} color="var(--motorven-gold, #f59e0b)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>
                  Tasa Oficial Inmutable y Automatizada en Tiempo Real
                </strong>
                Esta tasa no puede ser editada manualmente por ningún usuario. Al cambiar la tasa oficial en el Banco Central de Venezuela, el sistema la actualiza automáticamente en toda la aplicación en tiempo real (monitoreo continuo cada 60 segundos y al reactivar la ventana).
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowBcvModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal de Configuración General de Toda la Aplicación */}
      <AppConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={config}
        onSaveConfig={onSaveConfig}
        currentUser={currentUser}
      />

      {/* Modal del Centro de Ayuda y Manual Interactivo */}
      <AppHelpCenterModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onNavigate={onNavigate}
        currentUser={currentUser}
      />

      {/* Modal de Salida del Sistema — Doble Confirmación */}
      {showExitModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowExitModal(false); } }}
        >
          <div
            style={{
              background: 'var(--bg-modal, #0f172a)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '18px',
              padding: '2rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 40px rgba(239,68,68,0.15)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Ícono de advertencia */}
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)',
                  border: '2px solid rgba(239,68,68,0.5)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem',
                  boxShadow: '0 0 24px rgba(239,68,68,0.3)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}
              >
                ⚠️
              </div>
            </div>

            <h2 style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: '#ef4444', marginBottom: '0.5rem' }}>
              ¿Cerrar Sesión y Salir?
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Está a punto de cerrar la sesión activa de <strong style={{ color: 'var(--text-main)' }}>SIGNUM MOTORVEN</strong> para regresar a la pantalla de inicio.
            </p>

            {/* Ficha de Usuario Activo */}
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px',
                padding: '0.9rem',
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Usuario Activo
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {currentUser?.nombre || currentUser?.username || 'Usuario'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                @{currentUser?.username || 'usuario'} • {currentUser?.rol || 'Sin rol'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                  color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary, rgba(255,255,255,0.05))'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSystemExit}
                style={{
                  flex: 1.5, padding: '0.75rem', borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                  color: '#fff', fontSize: '0.85rem', fontWeight: 900,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ⏻ Cerrar Sesión y Salir
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL: ESTADO DE CONEXIÓN Y CONFIGURACIÓN DE TÚNEL / SERVIDOR LOCAL */}
      {/* ========================================================================= */}
      {showServerModal && (
        <div
          className="operator-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowServerModal(false);
          }}
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 9999999 }}
        >
          <div
            className="operator-modal-card"
            style={{
              maxWidth: '520px',
              width: '95%',
              background: 'var(--bg-modal, #111827)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Conexión de Base de Datos & Túnel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Estado actual */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              background: syncStatus.isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${syncStatus.isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {syncStatus.isOnline ? <Cloud size={20} color="#34d399" /> : <CloudOff size={20} color="#f87171" />}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: syncStatus.isOnline ? '#34d399' : '#f87171' }}>
                    {syncStatus.isOnline ? 'Servidor Conectado en Tiempo Real' : 'Modo Desconectado (Offline)'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {syncStatus.isOnline
                      ? 'Todas las operaciones se sincronizan al instante en la base de datos central.'
                      : `${syncStatus.pendingCount} operaciones guardadas en este dispositivo encoladas para sincronizar.`
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Explicación didáctica */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              fontSize: '0.78rem',
              lineHeight: 1.45,
              color: 'var(--text-secondary, #cbd5e1)',
              marginBottom: '1.25rem'
            }}>
              💡 <strong>¿Cómo funciona la sincronización multi-dispositivo?</strong>
              <div style={{ marginTop: '4px' }}>
                Tu base de datos con todas las tablas reside en tu <strong>Servidor Local (Laptop)</strong>. Para que tu teléfono, tablet u otros equipos puedan ver y reflejar los cambios en tiempo real desde GitHub Pages, se comunican con tu laptop mediante el <strong>Túnel Seguro Cloudflare HTTPS</strong>.
              </div>
            </div>

            {/* Campo URL del Túnel / Servidor */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                URL del Servidor / Túnel HTTPS en este dispositivo:
              </label>
              <input
                type="text"
                value={customServerInput}
                onChange={(e) => setCustomServerInput(e.target.value)}
                placeholder="https://api.signummotorven.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-main, #fff)',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tip: También puedes abrir en tu celular o tablet el enlace con <code>?server=URL_DEL_TUNEL</code> para sincronizarlo automáticamente.
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {syncStatus.pendingCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleManualSync();
                    notify.info('Procesando cola de sincronización...');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                  Sincronizar Pendientes ({syncStatus.pendingCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCustomBackendUrl('');
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Restaurar por Defecto
              </button>
              <button
                type="button"
                onClick={() => {
                  if (customServerInput && !customServerInput.startsWith('http')) {
                    notify.warning('La URL debe comenzar con http:// o https://');
                    return;
                  }
                  setCustomBackendUrl(customServerInput);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Guardar y Reconectar
              </button>
            </div>
          </div>
        </div>
      )}
      {showProfileModal && currentUser && (
        <div
          className="operator-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProfileModal(false);
          }}
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 9999999 }}
        >
          <div
            className="operator-modal-card"
            style={{
              maxWidth: '460px',
              width: '95%',
              background: 'var(--bg-modal, #111827)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Foto de Perfil & Supabase
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Avatar Central */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '0.75rem 0' }}>
              <div style={{ position: 'relative' }}>
                {currentUser.foto ? (
                  <img
                    src={currentUser.foto}
                    alt={currentUser.nombre}
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #38bdf8',
                      boxShadow: '0 8px 24px rgba(56, 189, 248, 0.35)'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '2px dashed rgba(56, 189, 248, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3rem'
                    }}
                  >
                    {currentUser.avatar || '👤'}
                  </div>
                )}
                {uploadingPhoto && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    Sincronizando...
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {currentUser.nombre || currentUser.username}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
                    @{currentUser.username}
                  </span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                    {currentUser.rol}
                  </span>
                </div>
              </div>

              {/* Mensaje de almacenamiento */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.78rem',
                color: '#bae6fd',
                textAlign: 'center',
                lineHeight: 1.4,
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {currentUser.foto ? (
                  <span>✅ Foto persistida permanentemente en <strong>Supabase Storage (signum-media/usuarios)</strong> y en la base de datos local de usuarios.</span>
                ) : (
                  <span>ℹ️ Este usuario no posee foto. Supabase permite subir fotos optimizadas de forma ilimitada.</span>
                )}
              </div>

              {/* Input oculto de foto */}
              <input
                type="file"
                accept="image/*"
                ref={headerFileInputRef}
                style={{ display: 'none' }}
                onChange={handleHeaderPhotoUpload}
              />

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => headerFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px'
                  }}
                >
                  <Camera size={15} />
                  {uploadingPhoto ? 'Procesando...' : (currentUser.foto ? 'Cambiar Foto' : 'Subir Foto')}
                </button>

                {currentUser.foto && (
                  <button
                    type="button"
                    onClick={handleHeaderPhotoDelete}
                    disabled={uploadingPhoto}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={15} />
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowProfileModal(false)}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

