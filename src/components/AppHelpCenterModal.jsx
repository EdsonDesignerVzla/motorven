import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  BookOpen,
  Search,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  TrendingUp,
  Wallet,
  FileCheck2,
  ShieldAlert,
  DollarSign,
  X,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Printer,
  Sparkles,
  Layers,
  Compass,
  FileText,
  Activity,
  CheckCircle2,
  Sliders,
  Bell,
  MapPin,
  Calendar,
  Database,
  Building2,
  Smartphone,
  Award,
  ShieldCheck,
  ShoppingBag,
  RefreshCw,
  CreditCard,
  FileSpreadsheet,
  Plus,
  Download,
  Scale
} from 'lucide-react';
import {
  SYSTEM_METADATA,
  MODULES_DOCUMENTATION,
  FREQUENTLY_ASKED_QUESTIONS,
  WORKFLOWS_STEP_BY_STEP,
  BEGINNER_FIRST_STEPS_GUIDE
} from '../data/appDocumentationData';
import { ROLE_PERMISSIONS, normalizeRole } from '../services/authService';
import { generateManualPDF } from '../services/pdfReportService';

// Módulos siempre visibles para todos los roles (barra superior global, centro de notificaciones, período fiscal y guía móvil)
const ALWAYS_VISIBLE_IDS = ['header_rates', 'notificaciones', 'config_fiscal', 'pos_movil'];

export default function AppHelpCenterModal({
  isOpen,
  onClose,
  onNavigate,
  currentUser,
  config = {}
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('primeros_pasos');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(null);

  // ── Calcular IDs de módulos accesibles para el usuario ──────────────────
  const allowedIds = useMemo(() => {
    if (!currentUser) return MODULES_DOCUMENTATION.map(m => m.id);
    const role = normalizeRole(currentUser.rol);
    const username = (currentUser.username || '').toLowerCase();
    // ADMINISTRADOR MASTER (Edson Designer) y Gerencia ven todo
    if (role === 'ADMINISTRADOR MASTER' || username === 'edson designer' || role === 'GERENCIA' || role === 'ADMINISTRADOR DEL SISTEMA') {
      return MODULES_DOCUMENTATION.map(m => m.id);
    }
    // Usar modulos personalizados del usuario, o caer en permisos por defecto del rol
    const perms = Array.isArray(currentUser.modulos) && currentUser.modulos.length > 0
      ? currentUser.modulos
      : (ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[currentUser.rol] || []);
    return [...new Set([...perms, ...ALWAYS_VISIBLE_IDS])];
  }, [currentUser]);

  // ── Catálogo de módulos filtrado por rol (base para todo lo demás) ───────
  const roleModules = useMemo(() => {
    return MODULES_DOCUMENTATION.filter(m => allowedIds.includes(m.id));
  }, [allowedIds]);

  // Estado del módulo seleccionado, se ajusta si el módulo ya no es accesible
  const [selectedModuleId, setSelectedModuleId] = useState(() => roleModules[0]?.id || 'dashboard');
  const safeModuleId = roleModules.some(m => m.id === selectedModuleId)
    ? selectedModuleId
    : (roleModules[0]?.id || 'dashboard');

  // ── Filtrado por búsqueda sobre módulos del rol ──────────────────────────
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return roleModules;
    const q = searchQuery.toLowerCase();
    return roleModules.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.components.some(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) ||
      m.buttons.some(b => b.name.toLowerCase().includes(q) || b.action.toLowerCase().includes(q)) ||
      m.modals.some(md => md.name.toLowerCase().includes(q) || md.purpose.toLowerCase().includes(q)) ||
      (m.bestPractices || []).some(bp => bp.toLowerCase().includes(q))
    );
  }, [searchQuery, roleModules]);

  // ── Filtrado de flujos paso a paso por búsqueda ──────────────────────────
  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return WORKFLOWS_STEP_BY_STEP;
    const q = searchQuery.toLowerCase();
    return WORKFLOWS_STEP_BY_STEP.filter(wf =>
      wf.title.toLowerCase().includes(q) ||
      wf.steps.some(step => step.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // ── Directorio de botones (solo módulos visibles al rol) ─────────────────
  const allButtons = useMemo(() => {
    const list = [];
    roleModules.forEach(m => {
      m.buttons.forEach(b => list.push({ ...b, moduleTitle: m.title, moduleId: m.id }));
    });
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.action.toLowerCase().includes(q) ||
      b.moduleTitle.toLowerCase().includes(q)
    );
  }, [searchQuery, roleModules]);

  // ── Directorio de modales (solo módulos visibles al rol) ─────────────────
  const allModals = useMemo(() => {
    const list = [];
    roleModules.forEach(m => {
      m.modals.forEach(md => list.push({ ...md, moduleTitle: m.title, moduleId: m.id }));
    });
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(md =>
      md.name.toLowerCase().includes(q) ||
      md.purpose.toLowerCase().includes(q) ||
      md.buttonTrigger.toLowerCase().includes(q) ||
      md.moduleTitle.toLowerCase().includes(q)
    );
  }, [searchQuery, roleModules]);

  // ── FAQs filtradas por relevancia al rol ────────────────────────────────
  const filteredFaqs = useMemo(() => {
    // Palabras clave de los módulos que tiene el usuario
    const roleKeywords = allowedIds.flatMap(id => {
      const mod = MODULES_DOCUMENTATION.find(m => m.id === id);
      return mod ? [mod.title.toLowerCase(), id.toLowerCase()] : [];
    });
    // Temas generales siempre relevantes
    const generalTopics = ['profit', 'internet', 'conexión', 'rol', 'usuario', 'contraseña', 'sistema', 'sincroniz'];
    const base = FREQUENTLY_ASKED_QUESTIONS.filter(f => {
      const text = (f.question + ' ' + f.answer).toLowerCase();
      return roleKeywords.some(kw => text.includes(kw)) || generalTopics.some(t => text.includes(t));
    });
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  }, [searchQuery, allowedIds]);

  // ── Módulo activo en el visor ─────────────────────────────────────────────
  const currentModule = useMemo(() => {
    return roleModules.find(m => m.id === safeModuleId) || roleModules[0];
  }, [safeModuleId, roleModules]);

  // ── Metadatos del rol para el banner de acceso ───────────────────────────
  const roleBanner = useMemo(() => {
    if (!currentUser) return null;
    const role = normalizeRole(currentUser.rol) || currentUser.rol || '';
    const isAdmin = role === 'ADMINISTRADOR MASTER' || (currentUser.username || '').toLowerCase() === 'edson designer' || role === 'ADMINISTRADOR DEL SISTEMA';
    const moduleCount = roleModules.filter(m => !ALWAYS_VISIBLE_IDS.includes(m.id)).length;
    return {
      role,
      displayName: currentUser.nombre || currentUser.username || 'Usuario',
      moduleCount,
      isAdmin
    };
  }, [currentUser, roleModules]);

  // ── Icon mapping helper ───────────────────────────────────────────────────
  const renderIcon = (iconName, size = 18, color = 'currentColor') => {
    const props = { size, color };
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard {...props} />;
      case 'Package': return <Package {...props} />;
      case 'ShoppingCart': return <ShoppingCart {...props} />;
      case 'Users': return <Users {...props} />;
      case 'Truck': return <Truck {...props} />;
      case 'TrendingUp': return <TrendingUp {...props} />;
      case 'Wallet': return <Wallet {...props} />;
      case 'FileCheck2': return <FileCheck2 {...props} />;
      case 'ShieldAlert': return <ShieldAlert {...props} />;
      case 'DollarSign': return <DollarSign {...props} />;
      case 'Sliders': return <Sliders {...props} />;
      case 'Bell': return <Bell {...props} />;
      case 'MapPin': return <MapPin {...props} />;
      case 'Calendar': return <Calendar {...props} />;
      case 'Database': return <Database {...props} />;
      case 'Building2': return <Building2 {...props} />;
      case 'Smartphone': return <Smartphone {...props} />;
      case 'Award': return <Award {...props} />;
      case 'ShieldCheck': return <ShieldCheck {...props} />;
      case 'ShoppingBag': return <ShoppingBag {...props} />;
      case 'RefreshCw': return <RefreshCw {...props} />;
      case 'CreditCard': return <CreditCard {...props} />;
      case 'FileSpreadsheet': return <FileSpreadsheet {...props} />;
      case 'Plus': return <Plus {...props} />;
      case 'Download': return <Download {...props} />;
      case 'Printer': return <Printer {...props} />;
      case 'CheckCircle2': return <CheckCircle2 {...props} />;
      case 'ExternalLink': return <ExternalLink {...props} />;
      case 'Layers': return <Layers {...props} />;
      case 'FileText': return <FileText {...props} />;
      case 'Compass': return <Compass {...props} />;
      case 'Sparkles': return <Sparkles {...props} />;
      case 'Scale': return <Scale {...props} />;
      default: return <BookOpen {...props} />;
    }
  };

  const handlePrintManual = () => {
    generateManualPDF({
      config,
      currentUser,
      activeModule: currentModule,
      modules: roleModules,
      workflows: filteredWorkflows
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-modal-overlay, rgba(3, 7, 18, 0.82))',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div
        className="help-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '96%',
          maxWidth: '1220px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-modal, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          borderRadius: '18px',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-industrial, 0 25px 50px -12px rgba(0, 0, 0, 0.5))',
          overflow: 'hidden',
          padding: 0,
          margin: 0,
          boxSizing: 'border-box'
        }}
      >
        {/* Cabecera Principal */}
        <div
          style={{
            padding: '1.2rem 1.8rem',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card-header, linear-gradient(90deg, #eef4ff, #f8fafc))',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--motorven-navy) 0%, var(--motorven-cyan) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0, 43, 122, 0.35)',
                color: '#ffffff'
              }}
            >
              <BookOpen size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-heading)' }}>
                  Centro de Ayuda & Manual de Usuario
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    background: 'var(--semaforo-verde-bg, rgba(16, 185, 129, 0.15))',
                    color: 'var(--semaforo-verde, #10b981)',
                    border: '1px solid var(--semaforo-verde)'
                  }}
                >
                  v{SYSTEM_METADATA.version}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                Guía interactiva detallada de todos los módulos, botones, modales, fórmulas y flujos del sistema.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handlePrintManual}
              className="btn btn-print-report btn-sm"
              title="Imprimir / Exportar Manual a PDF"
            >
              <Printer size={15} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cerrar ventana"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Banner de Acceso por Rol */}
        {roleBanner && (
          <div
            style={{
              padding: '0.55rem 1.8rem',
              borderBottom: '1px solid var(--border-glass)',
              background: roleBanner.isAdmin
                ? 'linear-gradient(90deg, rgba(139,92,246,0.12) 0%, rgba(0,43,122,0.08) 100%)'
                : 'linear-gradient(90deg, rgba(2,132,199,0.08) 0%, rgba(16,185,129,0.06) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: roleBanner.isAdmin
                    ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                    : 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-cyan))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  flexShrink: 0
                }}
              >
                {roleBanner.isAdmin ? '⚡' : '👤'}
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {roleBanner.displayName}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  — Viendo ayuda de tu rol:
                </span>
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: roleBanner.isAdmin ? 'rgba(139,92,246,0.18)' : 'rgba(2,132,199,0.14)',
                    color: roleBanner.isAdmin ? '#7c3aed' : 'var(--motorven-cyan)',
                    border: `1px solid ${roleBanner.isAdmin ? '#7c3aed' : 'var(--motorven-cyan)'}`,
                    letterSpacing: '0.03em'
                  }}
                >
                  {roleBanner.role}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
              {roleBanner.isAdmin
                ? '✅ Acceso total — todos los módulos visibles'
                : `📋 ${roleBanner.moduleCount} módulo${roleBanner.moduleCount !== 1 ? 's' : ''} disponible${roleBanner.moduleCount !== 1 ? 's' : ''} para tu rol`}
            </div>
          </div>
        )}

        {/* Barra de Búsqueda y Pestañas de Navegación */}
        <div
          className="help-modal-top-bar"
          style={{
            padding: '0.75rem 1.8rem',
            borderBottom: '1px solid var(--border-glass)',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexShrink: 0
          }}
        >
          {/* Input de Búsqueda en Vivo */}
          <div className="help-modal-search-box" style={{ position: 'relative', width: '280px', flexShrink: 0, maxWidth: '100%' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Buscar botón, modal, módulo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 32px 7px 34px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '0.825rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Selector de Pestañas Superiores */}
          <div className="help-modal-top-tabs" style={{ display: 'flex', gap: '5px', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0 }}>
            {[
              { id: 'primeros_pasos', label: '🚀 Empieza Aquí (Desde Cero)', icon: Sparkles },
              { id: 'modulos', label: 'Módulos & Tareas Paso a Paso', icon: Layers },
              { id: 'guias', label: 'Flujos Operativos (SOP)', icon: FileText, count: filteredWorkflows.length },
              { id: 'botones', label: 'Guía de Botones', icon: Activity, count: allButtons.length },
              { id: 'modales', label: 'Catálogo de Modales', icon: Compass, count: allModals.length },
              { id: 'faq', label: 'Preguntas Frecuentes', icon: HelpCircle, count: filteredFaqs.length }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isActive ? 'transparent' : 'transparent',
                    background: isActive ? 'linear-gradient(135deg, var(--motorven-navy) 0%, #0284c7 100%)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 3px 10px rgba(0, 43, 122, 0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-btn-secondary)',
                        color: isActive ? '#ffffff' : 'var(--text-muted)'
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="help-modal-body-layout" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* TAB 0: 🚀 PRIMEROS PASOS / GUÍA PARA PRINCIPIANTES */}
          {activeTab === 'primeros_pasos' && (
            <div style={{ flex: 1, minWidth: 0, padding: '1.5rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxSizing: 'border-box' }}>
              
              {/* Banner de Bienvenida */}
              <div
                style={{
                  padding: '1.5rem 1.8rem',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.15) 0%, rgba(2, 132, 199, 0.12) 100%)',
                  border: '1px solid rgba(2, 132, 199, 0.35)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <Sparkles size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0, color: 'var(--text-heading)' }}>
                      {BEGINNER_FIRST_STEPS_GUIDE?.welcome?.title || '¡Bienvenido a SIGNUM MOTORVEN! (Tu Primer Día)'}
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                    {BEGINNER_FIRST_STEPS_GUIDE?.welcome?.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('modulos')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, var(--motorven-navy) 0%, #0284c7 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 43, 122, 0.3)',
                    flexShrink: 0
                  }}
                >
                  <span>Explorar Módulos & Tareas</span>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* SECCIÓN 1: El Circuito Vital de la Empresa */}
              <div>
                <div style={{ marginBottom: '0.85rem' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--motorven-cyan)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} />
                    <span>{BEGINNER_FIRST_STEPS_GUIDE?.coreCircuit?.title}</span>
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    {BEGINNER_FIRST_STEPS_GUIDE?.coreCircuit?.description}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0.85rem' }}>
                  {BEGINNER_FIRST_STEPS_GUIDE?.coreCircuit?.steps.map((st) => (
                    <div
                      key={st.step}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        background: 'var(--bg-card-glass)',
                        border: '1px solid var(--border-glass)',
                        boxShadow: 'var(--shadow-card)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '999px', background: 'rgba(2, 132, 199, 0.15)', color: 'var(--motorven-cyan)', border: '1px solid var(--motorven-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                            {st.step}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'var(--bg-btn-secondary)', color: 'var(--text-muted)' }}>
                            {st.module}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '4px' }}>
                          {st.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          {st.whatHappens}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECCIÓN 2: Los 2 Almacenes Explicados Fácil */}
              <div>
                <div style={{ marginBottom: '0.85rem' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--motorven-navy-light)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={18} />
                    <span>{BEGINNER_FIRST_STEPS_GUIDE?.theTwoWarehouses?.title}</span>
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    {BEGINNER_FIRST_STEPS_GUIDE?.theTwoWarehouses?.description}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '1rem' }}>
                  {BEGINNER_FIRST_STEPS_GUIDE?.theTwoWarehouses?.warehouses.map((wh) => (
                    <div
                      key={wh.code}
                      style={{
                        padding: '1.2rem',
                        borderRadius: '14px',
                        background: wh.code === '01'
                          ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(37, 99, 235, 0.04) 100%)'
                          : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)',
                        border: `1.5px solid ${wh.code === '01' ? 'rgba(2, 132, 199, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                        boxShadow: 'var(--shadow-card)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: wh.code === '01' ? 'var(--motorven-cyan)' : 'var(--semaforo-verde)' }}>
                          {wh.name}
                        </div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: wh.code === '01' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: wh.code === '01' ? 'var(--motorven-cyan)' : 'var(--semaforo-verde)' }}>
                          Código {wh.code}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>
                        {wh.forWhat}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {wh.rules.map((r, rIdx) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECCIÓN 3: Manejo de Monedas ($ y Bs.) */}
              <div
                style={{
                  padding: '1.1rem 1.3rem',
                  borderRadius: '12px',
                  background: 'var(--bg-card-glass)',
                  border: '1px solid var(--border-glass)',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={17} />
                  <span>{BEGINNER_FIRST_STEPS_GUIDE?.currencyGuide?.title}</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.75rem' }}>
                  {BEGINNER_FIRST_STEPS_GUIDE?.currencyGuide?.points.map((pt, pIdx) => (
                    <div key={pIdx} style={{ padding: '0.75rem 0.9rem', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {pt}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECCIÓN 4: Las 7 Reglas de Oro */}
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--semaforo-verde)', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} />
                  <span>Las 7 Reglas de Oro de SIGNUM MOTORVEN</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.75rem' }}>
                  {BEGINNER_FIRST_STEPS_GUIDE?.goldenRules?.map((gr, gIdx) => (
                    <div
                      key={gIdx}
                      style={{
                        padding: '0.9rem 1.1rem',
                        borderRadius: '10px',
                        background: 'var(--bg-card-glass)',
                        border: '1px solid var(--border-glass)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                        {gr.rule}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {gr.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón Inferior de Llamada a la Acción */}
              <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('modulos')}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--motorven-navy) 0%, #0284c7 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 43, 122, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span>¿Listo para trabajar? Mira las tareas paso a paso de cada módulo</span>
                  <ChevronRight size={18} />
                </button>
              </div>

            </div>
          )}

          {/* TAB 1: MÓDULOS & COMPONENTES */}
          {activeTab === 'modulos' && (
            <div className="help-modal-modules-layout" style={{ display: 'flex', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              {/* Barra lateral de selección de módulo */}
              <div
                className="help-modal-modules-sidebar"
                style={{
                  width: '270px',
                  borderRight: '1px solid var(--border-glass)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  backgroundColor: 'var(--bg-tertiary)',
                  overflowY: 'auto',
                  flexShrink: 0,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                  Módulos del Sistema ({filteredModules.length})
                </div>

                {filteredModules.map((mod) => {
                  const isSelected = safeModuleId === mod.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setSelectedModuleId(mod.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 11px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--border-glass-highlight)' : 'transparent',
                        background: isSelected ? 'var(--bg-pill-active)' : 'transparent',
                        color: isSelected ? 'var(--text-heading)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: isSelected ? 'inset 3px 0 0 var(--motorven-cyan)' : 'none',
                        transition: 'all 0.15s ease',
                        width: '100%',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        gap: '8px',
                        flexShrink: 0,
                        minHeight: '44px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        {renderIcon(mod.icon, 17, isSelected ? 'var(--motorven-cyan)' : 'var(--text-muted)')}
                        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {mod.title.split('&')[0].trim()}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {mod.category}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} color={isSelected ? 'var(--motorven-cyan)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>

              {/* Panel de Detalle del Módulo Seleccionado */}
              <div className="help-modal-module-detail" style={{ flex: 1, minWidth: 0, padding: '1.5rem 1.8rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.4rem', boxSizing: 'border-box' }}>
                {/* Encabezado del Módulo */}
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'var(--bg-btn-secondary)',
                          border: '1px solid var(--border-glass)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--motorven-cyan)'
                        }}
                      >
                        {renderIcon(currentModule.icon, 22, 'var(--motorven-cyan)')}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                          {currentModule.title}
                        </h3>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'rgba(59,130,246,0.12)', color: 'var(--motorven-navy-light)' }}>
                            {currentModule.category}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: 'var(--semaforo-verde-bg)', color: 'var(--semaforo-verde)' }}>
                            Acceso: {currentModule.roleRequired}
                          </span>
                        </div>
                      </div>
                    </div>

                    {onNavigate && !['header_rates', 'config_fiscal', 'explorador_tablas'].includes(currentModule.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(currentModule.id);
                          onClose();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'var(--bg-btn-secondary)',
                          border: '1px solid var(--border-glass)',
                          color: 'var(--motorven-cyan)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <span>Ir al Módulo</span>
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '9px 0 0', lineHeight: 1.5 }}>
                    {currentModule.summary}
                  </p>
                </div>

                {/* 🎓 SECCIÓN PEDAGÓGICA: ¿Para qué sirve este módulo? (Desde Cero) */}
                {currentModule.beginnerIntro && (
                  <div
                    style={{
                      padding: '1.2rem 1.4rem',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(37, 99, 235, 0.04) 100%)',
                      border: '1px solid rgba(2, 132, 199, 0.35)',
                      boxShadow: 'var(--shadow-card)'
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--motorven-cyan)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={17} />
                      <span>🌱 Guía desde Cero: ¿Qué hace este módulo y para qué te sirve?</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.85rem' }}>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--motorven-cyan)', textTransform: 'uppercase', marginBottom: '3px' }}>
                          💡 ¿Qué es en palabras sencillas?
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                          {currentModule.beginnerIntro.whatIsIt}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--semaforo-verde)', textTransform: 'uppercase', marginBottom: '3px' }}>
                          🏢 ¿Por qué es vital para la empresa?
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                          {currentModule.beginnerIntro.whyItMatters}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--motorven-navy-light)', textTransform: 'uppercase', marginBottom: '3px' }}>
                          ⏰ ¿Cuándo debes entrar aquí?
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                          {currentModule.beginnerIntro.whenToUse}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '3px' }}>
                          ⚠️ ¿Qué pasa si no se usa o se usa mal?
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                          {currentModule.beginnerIntro.whatIfSkipped}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 📋 SECCIÓN PEDAGÓGICA: ¿Cómo realizar cada tarea aquí? (Paso a Paso) */}
                {currentModule.commonTasks && currentModule.commonTasks.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--semaforo-verde)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <CheckCircle2 size={16} />
                      <span>¿Cómo realizar cada tarea en este módulo? (Guía Paso a Paso)</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      {currentModule.commonTasks.map((t, tIdx) => (
                        <div
                          key={tIdx}
                          style={{
                            padding: '1rem 1.2rem',
                            borderRadius: '12px',
                            background: 'var(--bg-card-glass)',
                            border: '1px solid var(--border-glass)',
                            boxShadow: 'var(--shadow-card)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                              {t.title}
                            </div>
                            {t.objective && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--semaforo-verde)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                🎯 Objetivo: {t.objective}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', margin: '8px 0' }}>
                            {t.steps.map((st, sIdx) => (
                              <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '999px',
                                  background: 'var(--bg-btn-secondary)',
                                  color: 'var(--motorven-cyan)',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: '1px'
                                }}>
                                  {sIdx + 1}
                                </span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                  {st.replace(/^\d+\.\s*/, '')}
                                </span>
                              </div>
                            ))}
                          </div>
                          {t.proTip && (
                            <div style={{ marginTop: '8px', padding: '7px 11px', borderRadius: '7px', background: 'rgba(2, 132, 199, 0.08)', borderLeft: '3px solid var(--motorven-cyan)', fontSize: '0.73rem', color: 'var(--text-main)' }}>
                              <span style={{ fontWeight: 800, color: 'var(--motorven-cyan)' }}>💡 Consejo de Oro: </span>
                              {t.proTip}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 📖 SECCIÓN PEDAGÓGICA: Glosario Rápido del Módulo */}
                {currentModule.glossary && currentModule.glossary.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--motorven-navy-light)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={15} />
                      <span>Glosario Rápido: Términos que debes conocer aquí</span>
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '0.7rem' }}>
                      {currentModule.glossary.map((g, gIdx) => (
                        <div key={gIdx} style={{ padding: '0.8rem 0.95rem', borderRadius: '9px', background: 'var(--bg-card-glass)', border: '1px solid var(--border-glass)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--motorven-cyan)', marginBottom: '3px' }}>
                            {g.term}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {g.definition}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ⚠️ SECCIÓN PEDAGÓGICA: Errores Comunes y Cómo Evitarlos */}
                {currentModule.mistakesToAvoid && currentModule.mistakesToAvoid.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={15} />
                      <span>Errores Comunes de Principiantes y Cómo Evitarlos</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {currentModule.mistakesToAvoid.map((m, mIdx) => (
                        <div key={mIdx} style={{ padding: '0.9rem 1.1rem', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#f59e0b', marginBottom: '3px' }}>
                            ❌ Error típico: {m.mistake}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <strong>¿Por qué es malo?:</strong> {m.why}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--semaforo-verde)' }}>
                            <strong>✅ Solución correcta:</strong> {m.solution}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sección 1: Componentes y Paneles */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--motorven-cyan)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} />
                    <span>Componentes & Paneles Principales</span>
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.75rem' }}>
                    {currentModule.components.map((comp, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '10px',
                          background: 'var(--bg-card-glass)',
                          border: '1px solid var(--border-glass)',
                          boxShadow: 'var(--shadow-card)'
                        }}
                      >
                        <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                          {comp.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {comp.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sección 2: Guía de Botones */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--motorven-navy-light)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={15} />
                    <span>Botones & Acciones del Módulo</span>
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {currentModule.buttons.map((btn, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.7rem 0.95rem',
                          borderRadius: '8px',
                          background: 'var(--bg-card-glass)',
                          border: '1px solid var(--border-glass)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(2, 132, 199, 0.12)',
                              color: 'var(--motorven-cyan)',
                              border: '1px solid var(--border-glass)'
                            }}
                          >
                            {btn.name}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {btn.action}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingLeft: '8px' }}>
                          {btn.color}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sección 3: Modales Asociados */}
                {currentModule.modals && currentModule.modals.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#8b5cf6', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Compass size={15} />
                      <span>Modales & Ventanas Emergentes ({currentModule.modals.length})</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {currentModule.modals.map((md, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.95rem',
                            borderRadius: '10px',
                            background: 'var(--bg-card-glass)',
                            border: '1px solid rgba(139, 92, 246, 0.25)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6' }}>
                              {md.name}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                              {md.buttonTrigger}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 7px', lineHeight: 1.4 }}>
                            {md.purpose}
                          </p>
                          {md.keyFeatures && (
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                              {md.keyFeatures.map((feat, fIdx) => (
                                <li key={fIdx} style={{ marginBottom: '2px' }}>{feat}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sección 4: Buenas Prácticas */}
                {currentModule.bestPractices && (
                  <div
                    style={{
                      padding: '0.95rem 1.15rem',
                      borderRadius: '10px',
                      background: 'var(--semaforo-verde-bg)',
                      border: '1px solid var(--semaforo-verde)'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--semaforo-verde)', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={15} />
                      <span>Buenas Prácticas & Tips de Control Interno</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                      {currentModule.bestPractices.map((tip, tIdx) => (
                        <li key={tIdx} style={{ marginBottom: '3px' }}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIRECTORIO DE TODOS LOS BOTONES */}
          {activeTab === 'botones' && (
            <div style={{ flex: 1, padding: '1.5rem 1.8rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--motorven-cyan)' }}>
                  Directorio Consolidado de Botones & Acciones
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Consulte qué hace cada botón en cualquier pantalla de SIGNUM MOTORVEN.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.75rem' }}>
                {allButtons.map((btn, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      background: 'var(--bg-card-glass)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      boxShadow: 'var(--shadow-card)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.725rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(2, 132, 199, 0.12)',
                          color: 'var(--motorven-cyan)',
                          border: '1px solid var(--border-glass)',
                          flexShrink: 0
                        }}
                      >
                        {btn.name}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                        {btn.moduleTitle}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {btn.action}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CATÁLOGO DE MODALES */}
          {activeTab === 'modales' && (
            <div style={{ flex: 1, padding: '1.5rem 1.8rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', color: '#8b5cf6' }}>
                  Catálogo de Modales & Ventanas de Alto Rendimiento
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Explicación profunda de las herramientas emergentes integradas con Supabase.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {allModals.map((md, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1rem 1.15rem',
                      borderRadius: '12px',
                      background: 'var(--bg-card-glass)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px',
                      boxShadow: 'var(--shadow-card)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#8b5cf6' }}>
                        {md.name}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--motorven-cyan)', background: 'rgba(2, 132, 199, 0.12)', padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>
                        {md.moduleTitle} ➔ {md.buttonTrigger}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                      {md.purpose}
                    </p>

                    {md.keyFeatures && (
                      <div style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>
                          Funcionalidades Clave:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                          {md.keyFeatures.map((f, fIdx) => (
                            <li key={fIdx} style={{ marginBottom: '2px' }}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: GUÍAS PASO A PASO */}
          {activeTab === 'guias' && (
            <div style={{ flex: 1, padding: '1.5rem 1.8rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--semaforo-verde)' }}>
                  Manual de Procedimientos & Flujos Clave
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Secuencias operativas paso a paso para ejecutar las principales transacciones.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {filteredWorkflows.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No se encontraron flujos operativos que coincidan con "{searchQuery}".
                  </div>
                ) : filteredWorkflows.map((wf, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1.15rem',
                      borderRadius: '12px',
                      background: 'var(--bg-card-glass)',
                      border: '1px solid var(--border-glass)',
                      boxShadow: 'var(--shadow-card)'
                    }}
                  >
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--semaforo-verde)', margin: '0 0 9px' }}>
                      {wf.title}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {wf.steps.map((step, sIdx) => (
                        <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '999px',
                              background: 'var(--semaforo-verde-bg)',
                              color: 'var(--semaforo-verde)',
                              border: '1px solid var(--semaforo-verde)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              flexShrink: 0
                            }}
                          >
                            {sIdx + 1}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: PREGUNTAS FRECUENTES (FAQ) */}
          {activeTab === 'faq' && (
            <div style={{ flex: 1, padding: '1.5rem 1.8rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--semaforo-amarillo)' }}>
                  Preguntas Frecuentes & Soporte Técnico
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Respuestas rápidas a las consultas operativas más comunes.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filteredFaqs.map((faq, idx) => {
                  const isExpanded = expandedFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        borderRadius: '10px',
                        background: 'var(--bg-card-glass)',
                        border: '1px solid var(--border-glass)',
                        boxShadow: 'var(--shadow-card)',
                        overflow: 'hidden'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                        style={{
                          width: '100%',
                          padding: '0.9rem 1.15rem',
                          background: 'none',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: 'var(--text-main)',
                          fontSize: '0.825rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span>{faq.question}</span>
                        {isExpanded ? <ChevronDown size={17} color="var(--semaforo-amarillo)" /> : <ChevronRight size={17} color="var(--text-muted)" />}
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 1.15rem 0.9rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, borderTop: '1px solid var(--border-glass)', paddingTop: '0.65rem' }}>
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Pie del Modal */}
        <div
          style={{
            padding: '0.75rem 1.8rem',
            borderTop: '1px solid var(--border-glass)',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            flexShrink: 0
          }}
        >
          <div>
            <strong style={{ color: 'var(--text-main)' }}>{SYSTEM_METADATA.company}</strong> — RIF: {SYSTEM_METADATA.rif} | Sincronizado con {SYSTEM_METADATA.databaseSync}
          </div>
          <div>
            Última actualización: {SYSTEM_METADATA.lastUpdated}
          </div>
        </div>
      </div>
    </div>
  );
}
