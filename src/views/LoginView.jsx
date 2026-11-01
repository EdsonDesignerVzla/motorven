import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Sun,
  Moon,
  KeyRound,
  Check,
  Laptop,
  Building2,
  Briefcase,
  TrendingUp,
  Package,
  ChevronRight,
  ArrowLeft,
  Users
} from 'lucide-react';
import MotorvenLogo from '../components/MotorvenLogo';
import {
  getUsersList,
  authenticate,
  getRoleMeta,
  DEPARTMENTS,
  getUserDepartment,
  getDepartmentMeta,
  syncUsersWithSupabase
} from '../services/authService';

const DEPT_ICONS = {
  TI: Laptop,
  DIR: Building2,
  ADM: Briefcase,
  VEN: TrendingUp,
  OPE: Package
};

export default function LoginView({ usersList = [], onLoginSuccess, theme, onToggleTheme }) {
  const [users, setUsers] = useState(() => (usersList && usersList.length > 0 ? usersList : getUsersList()));

  useEffect(() => {
    if (usersList && usersList.length > 0) {
      setUsers(usersList);
    } else {
      syncUsersWithSupabase().then((latest) => {
        if (latest && latest.length > 0) setUsers(latest);
      }).catch(() => {});
    }
  }, [usersList]);

  // Paso 1: Selección de departamento | Paso 2: Selección de usuario y clave
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDeptId, setSelectedDeptId] = useState('TI');
  const [selectedUsername, setSelectedUsername] = useState(() => users[0]?.username || 'admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);

  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark');

  // Filtrar colaboradores por departamento seleccionado
  const deptUsers = users.filter((u) => getUserDepartment(u) === selectedDeptId);

  const handleSelectDepartment = (deptId) => {
    setSelectedDeptId(deptId);
    const usersInDept = users.filter((u) => getUserDepartment(u) === deptId);
    if (usersInDept.length > 0) {
      setSelectedUsername(usersInDept[0].username);
    }
    setPassword('');
    setErrorMsg('');
    setCurrentStep(2);
  };

  const handleSelectUser = (usr) => {
    setSelectedUsername(usr.username);
    setPassword('');
    setErrorMsg('');
  };

  const handleBackToDepartments = () => {
    setCurrentStep(1);
    setPassword('');
    setErrorMsg('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    setTimeout(() => {
      const res = authenticate(selectedUsername, password);
      setIsSubmitting(false);

      if (res.success) {
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(res.user);
        } else {
          window.location.reload();
        }
      } else {
        setErrorMsg(res.message);
      }
    }, 250);
  };

  const selectedUserData = users.find(
    (u) => u.username.toLowerCase() === selectedUsername.toLowerCase()
  );

  const selectedDeptMeta = getDepartmentMeta(selectedDeptId);
  const DeptIcon = DEPT_ICONS[selectedDeptId] || Briefcase;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1.5rem',
        background: 'var(--bg-radial)',
        position: 'relative',
        color: 'var(--text-main)',
        transition: 'background 0.3s ease'
      }}
    >
      {/* Botón de alternancia de tema flotante */}
      {onToggleTheme && (
        <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10 }}>
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              borderRadius: '20px',
              boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,43,122,0.1)'
            }}
          >
            {isDark ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="#002b7a" />}
            <span style={{ fontWeight: 600 }}>{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
      )}

      {/* Contenedor Principal de Login */}
      <div
        style={{
          width: '100%',
          maxWidth: currentStep === 1 && !isManualMode ? '500px' : '480px',
          background: 'var(--surface-card)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-glass)',
          borderRadius: '16px',
          padding: '2rem 1.75rem',
          boxShadow: isDark
            ? '0 25px 50px rgba(0, 0, 0, 0.55), 0 0 30px rgba(0, 43, 122, 0.15)'
            : '0 20px 45px -10px rgba(0, 43, 122, 0.16), 0 4px 16px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'all 0.25s ease'
        }}
      >
        {/* Logo & Encabezado Corporativo */}
        <div style={{ marginBottom: '1.25rem', textAlign: 'center', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '0.85rem' }}>
            <MotorvenLogo width={180} height="auto" />
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.35rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
              margin: '0 0 0.4rem 0',
              color: isDark ? '#ffffff' : '#001a4d'
            }}
          >
            Sistema de Gestión Integral
          </h2>
          <p
            style={{
              fontSize: '0.86rem',
              fontWeight: 600,
              color: isDark ? '#cbd5e1' : '#334155',
              margin: 0
            }}
          >
            {isManualMode
              ? 'Ingrese su usuario y clave de acceso institucional'
              : currentStep === 1
                ? 'Paso 1: Seleccione su Departamento'
                : 'Paso 2: Seleccione su Usuario e Ingrese la Clave'}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* PASO 1: SELECCIÓN DE DEPARTAMENTO (DISEÑO UNIFORME CORPORATIVO) */}
        {/* ========================================================================= */}
        {currentStep === 1 && !isManualMode && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
            {DEPARTMENTS.map((dept) => {
              const IconComp = DEPT_ICONS[dept.id] || Briefcase;
              const countInDept = users.filter((u) => getUserDepartment(u) === dept.id).length;

              return (
                <div
                  key={dept.id}
                  onClick={() => handleSelectDepartment(dept.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.8rem 1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isDark ? 'rgba(15, 26, 54, 0.7)' : '#ffffff',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1.5px solid #cbd5e1',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isDark
                      ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                      : '0 2px 6px rgba(0, 43, 122, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isDark ? '#e60012' : '#002b7a';
                    e.currentTarget.style.background = isDark ? 'rgba(0, 43, 122, 0.4)' : '#eef4ff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.16)' : '#cbd5e1';
                    e.currentTarget.style.background = isDark ? 'rgba(15, 26, 54, 0.7)' : '#ffffff';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: isDark ? 'rgba(0, 43, 122, 0.5)' : '#002b7a',
                        border: isDark ? '1.5px solid rgba(147, 197, 253, 0.4)' : '1px solid #001f5c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDark ? '#93c5fd' : '#ffffff',
                        flexShrink: 0
                      }}
                    >
                      <IconComp size={22} strokeWidth={2.3} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.94rem',
                            color: isDark ? '#ffffff' : '#0f172a'
                          }}
                        >
                          {dept.nombre}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isDark ? 'rgba(0, 43, 122, 0.6)' : '#002b7a',
                            color: '#ffffff'
                          }}
                        >
                          {dept.codigo}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          color: isDark ? '#cbd5e1' : '#475569',
                          marginTop: '2px'
                        }}
                      >
                        {dept.subtitulo}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: isDark ? '#e2e8f0' : '#002b7a',
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
                        padding: '3px 9px',
                        borderRadius: '12px'
                      }}
                    >
                      {countInDept} {countInDept === 1 ? 'usuario' : 'usuarios'}
                    </span>
                    <ChevronRight size={18} color={isDark ? '#94a3b8' : '#002b7a'} strokeWidth={2.5} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASO 2: SELECCIÓN DE USUARIO EN EL DEPARTAMENTO + FORMULARIO DE CLAVE */}
        {/* ========================================================================= */}
        {currentStep === 2 && !isManualMode && (
          <div style={{ width: '100%' }}>
            {/* Cabecera del departamento seleccionado con botón volver */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                background: isDark ? 'rgba(0, 43, 122, 0.4)' : '#eef4ff',
                border: `1.5px solid ${isDark ? 'rgba(147, 197, 253, 0.3)' : '#cbd5e1'}`,
                marginBottom: '1rem'
              }}
            >
              <button
                type="button"
                onClick={handleBackToDepartments}
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                  color: isDark ? '#93c5fd' : '#002b7a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  padding: '5px 9px',
                  borderRadius: '7px',
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'
                }}
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
                <span>Departamentos</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DeptIcon size={17} color={isDark ? '#93c5fd' : '#002b7a'} strokeWidth={2.2} />
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a' }}>
                  {selectedDeptMeta?.nombre}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(0, 43, 122, 0.7)' : '#002b7a',
                    color: '#ffffff'
                  }}
                >
                  {selectedDeptMeta?.codigo}
                </span>
              </div>
            </div>

            {/* Listado de Colaboradores del Área */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: isDark ? '#cbd5e1' : '#334155',
                  marginBottom: '0.45rem'
                }}
              >
                Colaboradores de este Departamento:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {deptUsers.map((usr) => {
                  const isSelected = selectedUsername.toLowerCase() === usr.username.toLowerCase();

                  return (
                    <div
                      key={usr.id}
                      onClick={() => handleSelectUser(usr)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.9rem',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isSelected
                          ? (isDark ? 'rgba(0, 43, 122, 0.5)' : '#eef4ff')
                          : (isDark ? 'rgba(15, 26, 54, 0.7)' : '#ffffff'),
                        border: isSelected
                          ? (isDark ? '2px solid #e60012' : '2px solid #002b7a')
                          : (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1.5px solid #cbd5e1'),
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected
                          ? (isDark ? '0 0 15px rgba(230,0,18,0.25)' : '0 2px 8px rgba(0,43,122,0.14)')
                          : (isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.03)')
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                            border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}
                        >
                          {usr.foto ? (
                            <img
                              src={usr.foto}
                              alt={usr.nombre}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            usr.avatar
                          )}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              color: isSelected
                                ? (isDark ? '#ffffff' : '#002b7a')
                                : (isDark ? '#f1f5f9' : '#0f172a')
                            }}
                          >
                            {usr.nombre}
                          </div>
                          <div
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 500,
                              color: isDark ? '#cbd5e1' : '#475569'
                            }}
                          >
                            {usr.cargo}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: isDark ? '#e60012' : '#002b7a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}
                        >
                          <Check size={14} color="#fff" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alcance del Rol del Colaborador Seleccionado */}
            {selectedUserData && selectedUserData.descripcion && (
              <div
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '9px',
                  background: isDark ? 'rgba(0, 43, 122, 0.25)' : '#eef4ff',
                  border: `1.5px solid ${isDark ? 'rgba(147, 197, 253, 0.3)' : '#bfdbfe'}`,
                  marginBottom: '1.1rem',
                  fontSize: '0.78rem',
                  color: isDark ? '#e2e8f0' : '#1e3a8a',
                  lineHeight: 1.45
                }}
              >
                <strong style={{ color: isDark ? '#93c5fd' : '#002b7a', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', fontWeight: 800 }}>
                  <ShieldCheck size={15} strokeWidth={2.4} /> Alcance del Rol ({selectedUserData.rol}):
                </strong>
                {selectedUserData.descripcion}
              </div>
            )}

            {/* Formulario de Contraseña */}
            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              {errorMsg && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(230, 0, 18, 0.15)',
                    border: '1px solid rgba(230, 0, 18, 0.35)',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    marginBottom: '1rem'
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    className="form-label"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: 0,
                      color: isDark ? '#f1f5f9' : '#0f172a'
                    }}
                  >
                    <KeyRound size={15} color="#e60012" strokeWidth={2.4} /> Contraseña de Acceso
                  </label>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: selectedUserData?.password === '' ? (isDark ? '#34d399' : '#059669') : (isDark ? '#cbd5e1' : '#64748b')
                    }}
                  >
                    {selectedUserData?.password === '' ? 'Acceso libre sin clave' : '* Ingrese su clave'}
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={selectedUserData?.password === '' ? 'No requiere clave (presione Iniciar Sesión)' : 'Ingrese su clave institucional'}
                    required={selectedUserData?.password !== ''}
                    autoFocus
                    style={{
                      fontSize: '0.9rem',
                      paddingRight: '2.5rem',
                      background: isDark ? 'rgba(6, 9, 19, 0.8)' : '#ffffff',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1.5px solid #cbd5e1',
                      color: isDark ? '#ffffff' : '#0f172a'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: isDark ? '#94a3b8' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--motorven-red, #e60012)',
                  borderColor: 'var(--motorven-red, #e60012)',
                  boxShadow: '0 4px 15px rgba(230, 0, 18, 0.4)'
                }}
              >
                <LogIn size={18} />
                {isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODO MANUAL ALTERNATIVO (DIRECTO POR USUARIO & CLAVE) */}
        {/* ========================================================================= */}
        {isManualMode && (
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(230, 0, 18, 0.15)',
                  border: '1px solid rgba(230, 0, 18, 0.35)',
                  color: '#f87171',
                  fontSize: '0.8rem',
                  marginBottom: '1rem'
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label
                className="form-label"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isDark ? '#f1f5f9' : '#0f172a'
                }}
              >
                <User size={15} color="#e60012" strokeWidth={2.4} /> Identificador de Usuario
              </label>
              <input
                type="text"
                className="form-control"
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                placeholder="edson designer, admin, ventas..."
                required
                autoFocus
                style={{
                  fontSize: '0.9rem',
                  background: isDark ? 'rgba(6, 9, 19, 0.8)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1.5px solid #cbd5e1',
                  color: isDark ? '#ffffff' : '#0f172a'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label
                className="form-label"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isDark ? '#f1f5f9' : '#0f172a'
                }}
              >
                <KeyRound size={15} color="#e60012" strokeWidth={2.4} /> Contraseña de Acceso
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  required
                  style={{
                    fontSize: '0.9rem',
                    paddingRight: '2.5rem',
                    background: isDark ? 'rgba(6, 9, 19, 0.8)' : '#ffffff',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1.5px solid #cbd5e1',
                    color: isDark ? '#ffffff' : '#0f172a'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: isDark ? '#94a3b8' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--motorven-red, #e60012)',
                borderColor: 'var(--motorven-red, #e60012)',
                boxShadow: '0 4px 15px rgba(230, 0, 18, 0.4)'
              }}
            >
              <LogIn size={18} />
              {isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>
        )}

        {/* Alternar entre Modo Departamentos y Modo Manual */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setIsManualMode(!isManualMode);
              setErrorMsg('');
              if (!isManualMode) {
                setPassword('');
              } else {
                setCurrentStep(1);
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? '#93c5fd' : '#002b7a',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 8px'
            }}
          >
            {isManualMode
              ? '← Volver al selector por Departamentos'
              : '¿Prefiere ingresar usuario y clave directamente?'}
          </button>
        </div>

        {/* Pie de Firma Institucional */}
        <div
          style={{
            marginTop: '1.25rem',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: isDark ? '#94a3b8' : '#64748b',
            textAlign: 'center'
          }}
        >
          SIGNUM MOTORVEN • Sistema de Control Administrativo y Comercial v2.0
        </div>
      </div>
    </div>
  );
}
