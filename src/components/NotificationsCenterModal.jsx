import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  BellRing,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  Printer,
  X,
  Search,
  Filter,
  CheckCheck,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Package,
  DollarSign,
  FileText,
  Server,
  Layers,
  Clock
} from 'lucide-react';
import {
  getSupabaseNotifications,
  markSupabaseNotificationRead,
  markAllSupabaseNotificationsRead,
  deleteSupabaseNotification,
  seedInitialNotificationsIfEmpty
} from '../services/supabaseService';
import { generateNotificationsPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

export default function NotificationsCenterModal({
  isOpen,
  onClose,
  config = {},
  currentUser = null,
  products = [],
  clients = [],
  onNavigate = null
}) {
  const notify = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL'); // 'ALL' | 'inventario' | 'cxc' | 'reportes' | 'sistema'
  const [severityFilter, setSeverityFilter] = useState('ALL'); // 'ALL' | 'critica' | 'advertencia' | 'info' | 'exito'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'unread' | 'read'

  // Cargar notificaciones al abrir el modal
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      let data = await getSupabaseNotifications();
      if (!data || data.length === 0) {
        data = await seedInitialNotificationsIfEmpty(products, clients, config);
      }
      setNotifications(data || []);
    } catch (err) {
      console.warn('[NotificationsCenter] Error cargando notificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Marcar una como leída
  const handleToggleRead = async (id, currentStatus) => {
    try {
      if (!currentStatus) {
        await markSupabaseNotificationRead(id);
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, leida: true, fecha_leida: new Date().toISOString() } : n))
        );
        notify.success('Notificación marcada como leída');
      }
    } catch (err) {
      console.error(err);
      notify.error('Error al actualizar notificación');
    }
  };

  // Marcar todas como leídas
  const handleMarkAllRead = async () => {
    try {
      await markAllSupabaseNotificationsRead();
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => ({ ...n, leida: true, fecha_leida: now })));
      notify.success('Todas las notificaciones fueron marcadas como leídas');
    } catch (err) {
      console.error(err);
      notify.error('Error al marcar notificaciones como leídas');
    }
  };

  // Eliminar una notificación
  const handleDelete = async (id, titulo) => {
    const confirmed = await notify.confirm({
      title: '¿Eliminar Notificación?',
      message: `¿Está seguro de eliminar la alerta "${titulo}" de la base de datos?`,
      confirmText: 'Sí, Eliminar',
      cancelText: 'Cancelar',
      isDestructive: true
    });

    if (!confirmed) return;

    try {
      await deleteSupabaseNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      notify.success('Notificación eliminada de la base de datos');
    } catch (err) {
      console.error(err);
      notify.error('Error al eliminar la notificación');
    }
  };

  // Métricas de KPIs
  const stats = useMemo(() => {
    const total = notifications.length;
    const criticas = notifications.filter(n => n.severidad === 'critica').length;
    const advertencias = notifications.filter(n => n.severidad === 'advertencia').length;
    const informativas = notifications.filter(n => n.severidad === 'info' || n.severidad === 'exito').length;
    const noLeidas = notifications.filter(n => !n.leida).length;
    return { total, criticas, advertencias, informativas, noLeidas };
  }, [notifications]);

  // Filtrado de Notificaciones
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Búsqueda por texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (n.titulo || '').toLowerCase().includes(query);
        const matchesMsg = (n.mensaje || '').toLowerCase().includes(query);
        const matchesOrigin = (n.origen || '').toLowerCase().includes(query);
        const matchesModule = (n.modulo || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesMsg && !matchesOrigin && !matchesModule) return false;
      }

      // Filtro de Categoría / Módulo
      if (activeCategory !== 'ALL') {
        if (activeCategory === 'sistema' && (n.modulo === 'dashboard' || n.modulo === 'configuracion' || n.modulo === 'usuarios' || n.modulo === 'sistema')) {
          // Coincide con sistema
        } else if (n.modulo !== activeCategory) {
          return false;
        }
      }

      // Filtro de Severidad
      if (severityFilter !== 'ALL' && n.severidad !== severityFilter) {
        return false;
      }

      // Filtro de Estado de Lectura
      if (statusFilter === 'unread' && n.leida) return false;
      if (statusFilter === 'read' && !n.leida) return false;

      return true;
    });
  }, [notifications, searchQuery, activeCategory, severityFilter, statusFilter]);

  // Impresión de Reporte Oficial PDF
  const handlePrint = () => {
    try {
      generateNotificationsPDF({
        notifications: filteredNotifications,
        filter: activeCategory,
        config,
        currentUser
      });
      notify.success('Reporte del Centro de Notificaciones generado exitosamente');
    } catch (err) {
      console.error('[NotificationsCenterModal] Error al imprimir:', err);
      notify.error('Error al generar el reporte PDF: ' + (err?.message || err));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="modal-content notif-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          animation: 'motorvenModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* CABECERA PRINCIPAL CON ESTILO OFICIAL MOTORVEN */}
        <div
          className="notif-modal-header"
          style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(230, 0, 18, 0.2) 0%, rgba(0, 43, 122, 0.35) 100%)',
                border: '1px solid rgba(230, 0, 18, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e60012',
                boxShadow: '0 0 15px rgba(230, 0, 18, 0.25)'
              }}
            >
              <BellRing size={22} className={stats.noLeidas > 0 ? 'animate-bounce' : ''} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="notif-modal-subtitle"
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase'
                  }}
                >
                  MÓDULO DE SEGURIDAD & SUPERVISIÓN
                </span>
                {stats.noLeidas > 0 && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      background: 'var(--semaforo-rojo)',
                      color: '#ffffff',
                      padding: '1px 7px',
                      borderRadius: '10px'
                    }}
                  >
                    {stats.noLeidas} PENDIENTES
                  </span>
                )}
              </div>
              <h2
                className="notif-modal-title"
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '-0.01em'
                }}
              >
                Centro de Notificaciones & Alertas
              </h2>
            </div>
          </div>

          {/* ACCIONES DERECHA: BOTÓN IMPRIMIR REPORTE ROJO + BOTÓN CERRAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
            <button
              type="button"
              className="btn btn-print-report"
              onClick={handlePrint}
              title="Descargar Reporte Oficial de Alertas en PDF"
            >
              <Printer size={16} color="#ffffff" /> Imprimir Reporte
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted, #94a3b8)',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease, color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(230, 0, 18, 0.2)';
                e.currentTarget.style.color = '#ff4d4f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
              }}
              title="Cerrar modal (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BARRA DE TARJETAS KPI RESUMEN */}
        <div
          className="notif-kpi-bar"
          style={{
            padding: '14px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}
        >
          {/* Card 1: Total */}
          <div
            className="notif-kpi-card notif-kpi-total"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(10, 19, 38, 0.8)',
              border: '1px solid rgba(0, 43, 122, 0.45)'
            }}
          >
            <div className="notif-kpi-lbl" style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>TOTAL ALERTAS</div>
            <div className="notif-kpi-val" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-heading, #ffffff)' }}>{stats.total}</div>
          </div>

          {/* Card 2: Críticas */}
          <div
            className="notif-kpi-card"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--semaforo-rojo-bg, rgba(230, 0, 18, 0.08))',
              border: '1px solid var(--semaforo-rojo)'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--semaforo-rojo)', fontWeight: 700 }}>CRÍTICAS (ROJO)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--semaforo-rojo)' }}>{stats.criticas}</div>
          </div>

          {/* Card 3: Advertencias */}
          <div
            className="notif-kpi-card"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--semaforo-amarillo-bg, rgba(245, 158, 11, 0.08))',
              border: '1px solid var(--semaforo-amarillo)'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--semaforo-amarillo)', fontWeight: 700 }}>ADVERTENCIAS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--semaforo-amarillo)' }}>{stats.advertencias}</div>
          </div>

          {/* Card 4: Informativas / Éxito */}
          <div
            className="notif-kpi-card"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(14, 165, 233, 0.12)',
              border: '1px solid var(--neon-cyan, #38bdf8)'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--neon-cyan, #0284c7)', fontWeight: 700 }}>INFORMATIVAS / OK</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neon-cyan, #0284c7)' }}>{stats.informativas}</div>
          </div>

          {/* Card 5: Sin Leer */}
          <div
            className="notif-kpi-card"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: stats.noLeidas > 0 ? 'var(--semaforo-rojo-bg)' : 'var(--semaforo-verde-bg)',
              border: stats.noLeidas > 0 ? '1px solid var(--semaforo-rojo)' : '1px solid var(--semaforo-verde)'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: stats.noLeidas > 0 ? 'var(--semaforo-rojo)' : 'var(--semaforo-verde)', fontWeight: 700 }}>
              PENDIENTES
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stats.noLeidas > 0 ? 'var(--semaforo-rojo)' : 'var(--semaforo-verde)' }}>
              {stats.noLeidas}
            </div>
          </div>
        </div>

        {/* BARRA DE HERRAMIENTAS Y FILTROS */}
        <div
          className="notif-filter-bar"
          style={{
            padding: '12px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          {/* Pestañas de Categoría */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'Todas', icon: Layers },
              { id: 'inventario', label: 'Inventario & ROP', icon: Package },
              { id: 'cxc', label: 'Cobranzas & CxC', icon: DollarSign },
              { id: 'reportes', label: 'Fiscal & SENIAT', icon: FileText },
              { id: 'sistema', label: 'Sistema', icon: Server }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`notif-tab-btn ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Acciones Rápidas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={stats.noLeidas === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: stats.noLeidas > 0 ? 'var(--semaforo-verde-bg, rgba(16, 185, 129, 0.15))' : 'rgba(255, 255, 255, 0.04)',
                color: stats.noLeidas > 0 ? 'var(--semaforo-verde, #10b981)' : 'var(--text-muted, #64748b)',
                border: stats.noLeidas > 0 ? '1px solid var(--semaforo-verde, #10b981)' : '1px solid var(--border-glass)',
                cursor: stats.noLeidas > 0 ? 'pointer' : 'not-allowed'
              }}
              title="Marcar todas las alertas como leídas"
            >
              <CheckCheck size={14} />
              Marcar Todo Leído
            </button>

            <button
              type="button"
              onClick={fetchNotifications}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: 'var(--bg-btn-secondary, rgba(255, 255, 255, 0.05))',
                color: 'var(--text-primary, #cbd5e1)',
                border: '1px solid var(--border-glass)',
                cursor: 'pointer'
              }}
              title="Refrescar datos desde la base de datos"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* FILTROS SECUNDARIOS Y BARRA DE BÚSQUEDA */}
        <div
          className="notif-subfilter-bar"
          style={{
            padding: '10px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          {/* Input de Búsqueda */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }}
            />
            <input
              type="text"
              className="notif-search-input"
              placeholder="Buscar por título, contenido, origen o módulo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Filtro de Severidad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Severidad:</span>
            <select
              className="notif-select-filter"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Todas las severidades</option>
              <option value="critica">Críticas (Rojo)</option>
              <option value="advertencia">Advertencias (Amarillo)</option>
              <option value="info">Informativas (Azul)</option>
              <option value="exito">Éxito / Normal (Verde)</option>
            </select>
          </div>

          {/* Filtro de Estado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Estado:</span>
            <select
              className="notif-select-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Todas</option>
              <option value="unread">Solo Pendientes</option>
              <option value="read">Solo Leídas</option>
            </select>
          </div>
        </div>

        {/* LISTADO DE NOTIFICACIONES */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {loading && notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
              <div>Consultando notificaciones en la base de datos...</div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '50px 20px',
                color: '#94a3b8',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 255, 255, 0.08)'
              }}
            >
              <CheckCircle2 size={36} color="var(--semaforo-verde)" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>
                No hay notificaciones ni alertas pendientes
              </div>
              <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '4px' }}>
                Todos los módulos operan de forma óptima sin anomalías registradas.
              </div>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUnread = !notif.leida;
              const severityStyles = {
                critica: {
                  border: isUnread ? '1px solid rgba(230, 0, 18, 0.55)' : '1px solid rgba(230, 0, 18, 0.25)',
                  glow: isUnread ? '0 0 16px rgba(230, 0, 18, 0.2)' : 'none',
                  bg: isUnread ? 'rgba(230, 0, 18, 0.07)' : 'rgba(10, 16, 32, 0.5)',
                  badgeBg: 'rgba(230, 0, 18, 0.2)',
                  badgeColor: '#ef4444',
                  icon: <AlertOctagon size={20} className="text-red-500" />
                },
                advertencia: {
                  border: isUnread ? '1px solid rgba(245, 158, 11, 0.55)' : '1px solid rgba(245, 158, 11, 0.25)',
                  glow: isUnread ? '0 0 16px rgba(245, 158, 11, 0.2)' : 'none',
                  bg: isUnread ? 'rgba(245, 158, 11, 0.06)' : 'rgba(10, 16, 32, 0.5)',
                  badgeBg: 'rgba(245, 158, 11, 0.2)',
                  badgeColor: '#f59e0b',
                  icon: <AlertTriangle size={20} className="text-amber-400" />
                },
                info: {
                  border: isUnread ? '1px solid rgba(14, 165, 233, 0.5)' : '1px solid rgba(14, 165, 233, 0.2)',
                  glow: isUnread ? '0 0 16px rgba(14, 165, 233, 0.15)' : 'none',
                  bg: isUnread ? 'rgba(14, 165, 233, 0.05)' : 'rgba(10, 16, 32, 0.5)',
                  badgeBg: 'rgba(14, 165, 233, 0.2)',
                  badgeColor: '#38bdf8',
                  icon: <Info size={20} className="text-cyan-400" />
                },
                exito: {
                  border: isUnread ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(16, 185, 129, 0.2)',
                  glow: isUnread ? '0 0 16px rgba(16, 185, 129, 0.15)' : 'none',
                  bg: isUnread ? 'rgba(16, 185, 129, 0.05)' : 'rgba(10, 16, 32, 0.5)',
                  badgeBg: 'rgba(16, 185, 129, 0.2)',
                  badgeColor: '#10b981',
                  icon: <CheckCircle2 size={20} className="text-emerald-400" />
                }
              };

              const style = severityStyles[notif.severidad] || severityStyles.info;
              const dateText = notif.created_at ? new Date(notif.created_at).toLocaleString('es-VE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'Reciente';

              return (
                <div
                  key={notif.id}
                  className={`notif-card ${isUnread ? 'is-unread' : 'is-read'} severity-${notif.severidad || 'info'}`}
                  style={{
                    position: 'relative',
                    background: style.bg,
                    borderRadius: '12px',
                    border: style.border,
                    boxShadow: style.glow,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Icono de Severidad */}
                  <div
                    style={{
                      padding: '8px',
                      borderRadius: '10px',
                      background: style.badgeBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {style.icon}
                  </div>

                  {/* Detalle Central */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 800,
                          color: style.badgeColor,
                          background: style.badgeBg,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}
                      >
                        {notif.severidad || 'INFO'}
                      </span>

                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: 'var(--neon-cyan, #0284c7)',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}
                      >
                        MÓDULO: {notif.modulo || 'SISTEMA'}
                      </span>

                      {notif.origen && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'var(--text-secondary, #94a3b8)',
                            background: 'var(--bg-btn-secondary, rgba(255, 255, 255, 0.05))',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          ORIGEN: {notif.origen}
                        </span>
                      )}

                      <span
                        className="notif-card-time"
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted, #64748b)',
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Clock size={12} />
                        {dateText}
                      </span>
                    </div>

                    <h4
                      className="notif-card-title"
                      style={{
                        margin: '2px 0 6px 0',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: isUnread ? 'var(--text-heading, #ffffff)' : 'var(--text-secondary, #cbd5e1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {notif.titulo}
                      {isUnread && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--semaforo-rojo)',
                            display: 'inline-block'
                          }}
                          title="No leída"
                        />
                      )}
                    </h4>

                    <p
                      className="notif-card-desc"
                      style={{
                        margin: 0,
                        fontSize: '0.84rem',
                        color: isUnread ? 'var(--text-primary, #e2e8f0)' : 'var(--text-muted, #94a3b8)',
                        lineHeight: 1.5
                      }}
                    >
                      {notif.mensaje}
                    </p>
                  </div>

                  {/* Acciones por Ítem */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => handleToggleRead(notif.id, notif.leida)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Marcar como leída"
                      >
                        <CheckCheck size={14} /> Leída
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(notif.id, notif.titulo)}
                      style={{
                        padding: '6px',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                      title="Eliminar alerta"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PIE DE PÁGINA DEL MODAL */}
        <div
          style={{
            padding: '12px 24px',
            background: 'rgba(6, 11, 24, 0.85)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#94a3b8'
          }}
        >
          <div>
            Mostrando <strong>{filteredNotifications.length}</strong> de <strong>{notifications.length}</strong> eventos registrados en la base de datos de Grupo Motorven.
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer'
            }}
          >
            Cerrar Centro de Notificaciones
          </button>
        </div>
      </div>
    </div>
  );
}
