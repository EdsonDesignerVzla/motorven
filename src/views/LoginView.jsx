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
    <div className="login-page-wrapper">
      {/* Barra superior para el botón de alternancia de tema (sin solapar la tarjeta ni el logo) */}
      {onToggleTheme && (
        <div
          className="login-theme-bar"
          style={{
            maxWidth: currentStep === 1 && !isManualMode ? '500px' : '480px'
          }}
        >
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn btn-secondary login-theme-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.42rem 0.9rem',
              fontSize: '0.8rem',
              minHeight: '36px',
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
        className="login-card"
        style={{
          maxWidth: currentStep === 1 && !isManualMode ? '500px' : '480px',
          boxShadow: isDark
            ? '0 25px 50px rgba(0, 0, 0, 0.55), 0 0 30px rgba(0, 43, 122, 0.15)'
            : '0 20px 45px -10px rgba(0, 43, 122, 0.16), 0 4px 16px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Logo & Encabezado Corporativo */}
        <div className="login-header-block">
          <div className="login-logo-box">
            <MotorvenLogo width={180} height="auto" className="login-logo-img" />
          </div>
          <h2
            className="login-main-title"
            style={{
              color: isDark ? '#ffffff' : '#001a4d'
            }}
          >
            Sistema de Gestión Integral
          </h2>
          <p
            className="login-main-subtitle"
            style={{
              color: isDark ? '#cbd5e1' : '#334155'
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
          <div className="login-dept-list">
            {DEPARTMENTS.map((dept) => {
              const IconComp = DEPT_ICONS[dept.id] || Briefcase;
              const countInDept = users.filter((u) => getUserDepartment(u) === dept.id).length;

              return (
                <div
                  key={dept.id}
                  className="login-dept-card"
                  onClick={() => handleSelectDepartment(dept.id)}
                  style={{
                    background: isDark ? 'rgba(15, 26, 54, 0.7)' : '#ffffff',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1.5px solid #cbd5e1',
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
                  <div className="login-dept-left">
                    <div
                      className="login-dept-icon"
                      style={{
                        background: isDark ? 'rgba(0, 43, 122, 0.5)' : '#002b7a',
                        border: isDark ? '1.5px solid rgba(147, 197, 253, 0.4)' : '1px solid #001f5c',
                        color: isDark ? '#93c5fd' : '#ffffff'
                      }}
                    >
                      <IconComp size={20} strokeWidth={2.3} />
                    </div>
                    <div className="login-dept-info">
                      <div
                        className="login-dept-name"
                        style={{
                          color: isDark ? '#ffffff' : '#0f172a'
                        }}
                      >
                        {dept.nombre}
                      </div>
                      <div
                        className="login-dept-subtitle"
                        style={{
                          color: isDark ? '#cbd5e1' : '#475569'
                        }}
                      >
                        {dept.subtitulo}
                      </div>
                    </div>
                  </div>

                  <div className="login-dept-right">
                    <div className="login-dept-badges-col">
                      <span
                        className="login-dept-code"
                        style={{
                          background: isDark ? 'rgba(0, 43, 122, 0.75)' : '#002b7a',
                          border: isDark ? '1px solid rgba(147, 197, 253, 0.35)' : 'none',
                          color: '#ffffff'
                        }}
                      >
                        {dept.codigo}
                      </span>
                      <span
                        className="login-dept-users-badge"
                        style={{
                          color: isDark ? '#e2e8f0' : '#002b7a',
                          background: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'
                        }}
                      >
                        {countInDept} {countInDept === 1 ? 'usuario' : 'usuarios'}
                      </span>
                    </div>
                    <ChevronRight
                      size={18}
                      color={isDark ? '#94a3b8' : '#002b7a'}
                      strokeWidth={2.5}
                      style={{ flexShrink: 0 }}
                    />
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
          <div style={{ width: '100%', minWidth: 0 }}>
            {/* Cabecera del departamento seleccionado con botón volver */}
            <div
              className="login-step2-header"
              style={{
                background: isDark ? 'rgba(0, 43, 122, 0.4)' : '#eef4ff',
                border: `1.5px solid ${isDark ? 'rgba(147, 197, 253, 0.3)' : '#cbd5e1'}`
              }}
            >
              <button
                type="button"
                onClick={handleBackToDepartments}
                className="login-back-btn"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                  color: isDark ? '#93c5fd' : '#002b7a',
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'
                }}
              >
                <ArrowLeft size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                <span>Departamentos</span>
              </button>

              <div className="login-step2-dept-badge">
                <DeptIcon size={16} color={isDark ? '#93c5fd' : '#002b7a'} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                <span
                  className="login-step2-dept-name"
                  style={{ color: isDark ? '#ffffff' : '#0f172a' }}
                >
                  {selectedDeptMeta?.nombre}
                </span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(0, 43, 122, 0.7)' : '#002b7a',
                    color: '#ffffff',
                    flexShrink: 0
                  }}
                >
                  {selectedDeptMeta?.codigo}
                </span>
              </div>
            </div>

            {/* Listado de Colaboradores del Área */}
            <div style={{ marginBottom: '1rem', width: '100%', minWidth: 0 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: isDark ? '#cbd5e1' : '#334155',
                  marginBottom: '0.45rem'
                }}
              >
                Colaboradores de este Departamento:
              </label>

              <div className="login-users-list">
                {deptUsers.map((usr) => {
                  const isSelected = selectedUsername.toLowerCase() === usr.username.toLowerCase();

                  return (
                    <div
                      key={usr.id}
                      className="login-user-card"
                      onClick={() => handleSelectUser(usr)}
                      style={{
                        background: isSelected
                          ? (isDark ? 'rgba(0, 43, 122, 0.5)' : '#eef4ff')
                          : (isDark ? 'rgba(15, 26, 54, 0.7)' : '#ffffff'),
                        border: isSelected
                          ? (isDark ? '2px solid #e60012' : '2px solid #002b7a')
                          : (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1.5px solid #cbd5e1'),
                        boxShadow: isSelected
                          ? (isDark ? '0 0 15px rgba(230,0,18,0.25)' : '0 2px 8px rgba(0,43,122,0.14)')
                          : (isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.03)')
                      }}
                    >
                      <div className="login-user-left">
                        <div
                          className="login-user-avatar"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                            border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #cbd5e1'
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
                        <div style={{ minWidth: 0, flex: '1 1 0%' }}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              lineHeight: 1.25,
                              wordBreak: 'break-word',
                              color: isSelected
                                ? (isDark ? '#ffffff' : '#002b7a')
                                : (isDark ? '#f1f5f9' : '#0f172a')
                            }}
                          >
                            {usr.nombre}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              lineHeight: 1.25,
                              marginTop: '2px',
                              wordBreak: 'break-word',
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
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                            flexShrink: 0
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
                  padding: '0.65rem 0.85rem',
                  borderRadius: '9px',
                  background: isDark ? 'rgba(0, 43, 122, 0.25)' : '#eef4ff',
                  border: `1.5px solid ${isDark ? 'rgba(147, 197, 253, 0.3)' : '#bfdbfe'}`,
                  marginBottom: '1rem',
                  fontSize: '0.76rem',
                  color: isDark ? '#e2e8f0' : '#1e3a8a',
                  lineHeight: 1.45,
                  boxSizing: 'border-box'
                }}
              >
                <strong style={{ color: isDark ? '#93c5fd' : '#002b7a', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', fontWeight: 800, flexWrap: 'wrap' }}>
                  <ShieldCheck size={15} strokeWidth={2.4} style={{ flexShrink: 0 }} /> Alcance del Rol ({selectedUserData.rol}):
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
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px', marginBottom: '6px' }}>
                  <label
                    className="form-label"
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: 0,
                      color: isDark ? '#f1f5f9' : '#0f172a'
                    }}
                  >
                    <KeyRound size={15} color="#e60012" strokeWidth={2.4} style={{ flexShrink: 0 }} /> Contraseña de Acceso
                  </label>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: selectedUserData?.password === '' ? (isDark ? '#34d399' : '#059669') : (isDark ? '#cbd5e1' : '#64748b')
                    }}
                  >
                    {selectedUserData?.password === '' ? 'Acceso libre sin clave' : '* Ingrese su clave'}
                  </span>
                </div>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={selectedUserData?.password === '' ? 'No requiere clave (presione Iniciar Sesión)' : 'Ingrese su clave institucional'}
                    required={selectedUserData?.password !== ''}
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '0.9rem',
                      padding: '0.7rem 2.6rem 0.7rem 0.9rem',
                      borderRadius: '10px',
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
                className="form-control login-input"
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                placeholder="edson designer, admin, ventas..."
                required
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '0.9rem',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '10px',
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
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.9rem',
                    padding: '0.7rem 2.6rem 0.7rem 0.9rem',
                    borderRadius: '10px',
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
