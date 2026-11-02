import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  RefreshCw,
  History,
  Shield,
  Search,
  Clock,
  Database,
  ChevronDown,
  Maximize2,
  Minimize2,
  Printer,
  Camera
} from 'lucide-react';
import {
  ROLES,
  ROLE_DEFINITIONS,
  ROLE_HIERARCHY,
  getRoleMeta,
  normalizeRole,
  ROLE_PERMISSIONS,
  SYSTEM_MODULES,
  getUsersList,
  sortUsersByHierarchy,
  syncUsersWithSupabase,
  DEPARTMENTS,
  getUserDepartment,
  getDepartmentMeta
} from '../services/authService';
import {
  getSupabaseUsers,
  saveSupabaseUser,
  deleteSupabaseUser,
  getSupabaseUserLogs, describeSupabaseError, resetSupabaseOnlineStatus,
} from '../services/supabaseService';
import { compressProfileImage } from '../services/imageCompression';
import {
  uploadImageToStorage,
  deleteImageFromStorage,
  uploadUserProfilePhoto,
  deleteUserProfilePhoto,
  STORAGE_FOLDERS
} from '../services/imageStorageService';
import { generateUsersPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

export default function UsersManagementView({ currentUser, usersList = [], onUsersUpdated, onUpdateCurrentUser, config }) {
  const notify = useNotification();
  const [users, setUsers] = useState(() => (usersList && usersList.length > 0 ? usersList : getUsersList()));
  const [activeSubTab, setActiveSubTab] = useState('usuarios'); // 'usuarios' | 'auditoria'
  const [showUserModal, setShowUserModal] = useState(false);
  const [isModalExpanded, setIsModalExpanded] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Estados de Auditoría
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState('TODAS');

  // Estados de Sincronización y Guardado
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Formulario Usuario
  const [formData, setFormData] = useState({
    id: null,
    nombre: '',
    username: '',
    cargo: '',
    rol: ROLES.VENTAS,
    departamento: 'VEN',
    modulos: ROLE_PERMISSIONS[ROLES.VENTAS] || ['ventas', 'inventario'],
    avatar: '👩‍💼',
    foto: null,
    password: '123456',
    descripcion: '',
    activo: true
  });

  // Dropdown de permisos de módulos
  const [showModulesDropdown, setShowModulesDropdown] = useState(false);
  const modulesDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modulesDropdownRef.current && !modulesDropdownRef.current.contains(e.target)) {
        setShowModulesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cierre accesible por teclado con tecla Escape (A11y)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showUserModal) {
        setShowUserModal(false);
      }
    };
    if (showUserModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUserModal]);

  const handleToggleModule = (moduleId) => {
    setFormData(prev => {
      const current = prev.modulos || [];
      const exists = current.includes(moduleId);
      const updated = exists ? current.filter(m => m !== moduleId) : [...current, moduleId];
      return { ...prev, modulos: updated };
    });
  };

  const handleSelectAllModules = () => {
    const allIds = SYSTEM_MODULES.map(m => m.id);
    const current = formData.modulos || [];
    const allSelected = allIds.every(id => current.includes(id));
    setFormData(prev => ({
      ...prev,
      modulos: allSelected ? [] : allIds
    }));
  };

  // Estado de compresión y carga de foto
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoSizeInfo, setPhotoSizeInfo] = useState(null);
  const fileInputRef = useRef(null);

  // Formulario Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassText, setShowPassText] = useState(false);
  const [showCurrentPassText, setShowCurrentPassText] = useState(true);
  const [showModalPass, setShowModalPass] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  // Mensajes de alerta
  const [alertInfo, setAlertInfo] = useState({ type: '', message: '' });

  // Sincronizar estado local si cambian los props externos
  useEffect(() => {
    if (usersList && usersList.length > 0) {
      setUsers(usersList);
    }
  }, [usersList]);

  // Cargar bitácora de auditoría al iniciar
  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const data = await getSupabaseUserLogs(200);
      setLogs(data || []);
    } catch (err) {
      console.warn("Error cargando logs de auditoría:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Al montar o cambiar la lista de usuarios, sincronizar foto de currentUser de inmediato si difiere
  useEffect(() => {
    if (currentUser && users && users.length > 0) {
      const match = users.find(
        u => u.id === currentUser.id || (u.username && currentUser.username && u.username.toLowerCase() === currentUser.username.toLowerCase())
      );
      if (match && match.foto && match.foto !== currentUser.foto) {
        if (onUpdateCurrentUser) onUpdateCurrentUser(match);
        try {
          localStorage.setItem('signum_active_user', JSON.stringify(match));
        } catch (_) {}
      }
    }
  }, [users, currentUser, onUpdateCurrentUser]);

  const showAlert = (type, message) => {
    setAlertInfo({ type, message });
    setTimeout(() => setAlertInfo({ type: '', message: '' }), 4500);
    if (notify && typeof notify[type] === 'function') {
      notify[type](message);
    }
  };

  const handleForceSync = async () => {
    try {
      setIsSyncing(true);
      const freshUsers = await syncUsersWithSupabase();
      setUsers(freshUsers);

      // Si el usuario actual está en la lista fresca, sincronizar su sesión y foto
      if (currentUser) {
        const selfMatch = freshUsers.find(
          u => u.id === currentUser.id || (u.username && currentUser.username && u.username.toLowerCase() === currentUser.username.toLowerCase())
        );
        if (selfMatch) {
          try {
            localStorage.setItem('signum_active_user', JSON.stringify(selfMatch));
          } catch (_) {}
          if (onUpdateCurrentUser) onUpdateCurrentUser(selfMatch);
        }
      }

      await loadLogs();
      showAlert('success', 'Base de datos sincronizada con Supabase Cloud exitosamente.');
      if (onUsersUpdated) onUsersUpdated(freshUsers);
    } catch (err) {
      console.warn("Error en sincronización forzada:", err);
      showAlert('error', 'Error al sincronizar con la nube de Supabase.');
    } finally {
      setIsSyncing(false);
    }
  };

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const result = await compressProfileImage(file, { maxSize: 240, quality: 0.82 });
      const base64Data = result.dataUrl;

      // Subida garantizada a Supabase Storage en la carpeta 'usuarios'
      const username = (formData.username || formData.nombre || 'user').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      let finalPhoto = base64Data;
      try {
        const storageRes = await uploadImageToStorage(base64Data, STORAGE_FOLDERS.USERS, `user_${username}`);
        if (storageRes.success && storageRes.publicUrl) {
          finalPhoto = storageRes.publicUrl;
        }
      } catch (storageErr) {
        console.warn('Almacenamiento en Supabase Storage:', storageErr);
      }

      setFormData(prev => ({
        ...prev,
        foto: finalPhoto
      }));
      setPhotoSizeInfo(`${result.sizeKb} KB (Supabase Storage)`);
      showAlert('success', `Foto subida a Supabase Storage con éxito (${result.sizeKb} KB) y lista para guardar.`);
    } catch (err) {
      console.error(err);
      showAlert('error', err.message || 'Error al procesar la foto.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    const previousPhoto = formData.foto;
    setFormData(prev => ({
      ...prev,
      foto: null
    }));
    setPhotoSizeInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Si la foto era un archivo en Supabase Storage, eliminarlo
    if (previousPhoto && typeof previousPhoto === 'string' && !previousPhoto.startsWith('data:')) {
      try {
        await deleteImageFromStorage(previousPhoto);
      } catch (_) {}
    }
    showAlert('info', 'Foto removida. Haga clic en "Guardar Cambios" para confirmar la eliminación en Supabase.');
  };

  const handleDirectDeletePhoto = async (user) => {
    if (!user.foto) return;
    if (!window.confirm(`¿Está seguro de eliminar permanentemente la foto de perfil de @${user.username} (${user.nombre}) en Supabase?`)) return;

    try {
      setIsSyncing(true);
      const res = await deleteUserProfilePhoto({
        userId: user.id,
        username: user.username,
        currentPhotoUrl: user.foto,
        currentUser,
        onUpdateCurrentUser
      });
      if (!res.success) throw new Error(res.error);

      const fresh = await getSupabaseUsers();
      setUsers(fresh);
      try { localStorage.setItem('signum_users_list', JSON.stringify(fresh)); } catch (_) {}
      if (onUsersUpdated) onUsersUpdated();
      showAlert('success', `Foto de perfil de @${user.username} eliminada permanentemente de Supabase.`);
      loadLogs();
    } catch (err) {
      showAlert('error', err.message || 'Error al eliminar foto de Supabase.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenCreateModal = () => {
    const defaultRol = ROLES.VENTAS;
    const meta = getRoleMeta(defaultRol);
    setFormData({
      id: null,
      nombre: '',
      username: '',
      cargo: meta.defaultCargo,
      rol: defaultRol,
      departamento: 'VEN',
      modulos: ROLE_PERMISSIONS[defaultRol] ? [...ROLE_PERMISSIONS[defaultRol]] : [...(meta.defaultModules || ['ventas', 'inventario'])],
      avatar: meta.avatar,
      foto: null,
      password: '123456',
      descripcion: '',
      activo: true
    });
    setPhotoSizeInfo(null);
    setShowModalPass(false);
    setShowModulesDropdown(false);
    setShowUserModal(true);
  };

  const handleOpenEditModal = (user) => {
    const normRol = normalizeRole(user.rol);
    const meta = getRoleMeta(normRol);
    const userModulos = Array.isArray(user.modulos) && user.modulos.length > 0
      ? [...user.modulos]
      : (ROLE_PERMISSIONS[normRol] ? [...ROLE_PERMISSIONS[normRol]] : [...(meta.defaultModules || ['ventas'])]);

    setFormData({
      id: user.id,
      nombre: user.nombre,
      username: user.username,
      cargo: user.cargo || meta.defaultCargo,
      rol: normRol,
      departamento: getUserDepartment(user),
      modulos: userModulos,
      avatar: user.avatar || meta.avatar,
      foto: user.foto || null,
      password: '', // En blanco para conservar la actual salvo que el admin ingrese una nueva
      currentPassword: user.password || '123456',
      descripcion: user.descripcion || '',
      activo: user.activo !== false
    });
    setShowPassText(false);
    setShowModalPass(false);
    setShowModulesDropdown(false);
    if (user.foto) {
      const base64Str = user.foto.split(',')[1] || '';
      const kb = ((base64Str.length * 3) / 4 / 1024).toFixed(1);
      setPhotoSizeInfo(`${kb} KB`);
    } else {
      setPhotoSizeInfo(null);
    }
    setShowUserModal(true);
  };

  const handleOpenPasswordModal = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassText(false);
    setShowCurrentPassText(true);
    setShowPasswordModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const isNew = !formData.id;

      // 1. Limpieza y validación de username
      const cleanUsername = (formData.username || '').trim().toLowerCase().replace(/^@+/, '');
      if (!cleanUsername) {
        throw new Error('El nombre de usuario es obligatorio.');
      }
      if (cleanUsername.length < 3) {
        throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
      }

      // 2. Validar que no exista otro usuario con el mismo username
      const duplicate = users.some(u => u.id !== formData.id && u.username.toLowerCase() === cleanUsername);
      if (duplicate) {
        throw new Error(`El nombre de usuario @${cleanUsername} ya existe en el sistema. Por favor elija otro.`);
      }

      // 3. Validar contraseña si es nuevo usuario
      const cleanPassword = (formData.password || '').trim();
      if (isNew && cleanPassword.length < 4) {
        throw new Error('La contraseña inicial debe tener al menos 4 caracteres.');
      }
      if (!isNew && cleanPassword && cleanPassword.length < 4) {
        throw new Error('La nueva contraseña debe tener al menos 4 caracteres.');
      }

      const payload = {
        ...formData,
        id: formData.id || `usr-${Date.now().toString(36)}`,
        nombre: (formData.nombre || '').trim(),
        username: cleanUsername,
        cargo: (formData.cargo || '').trim(),
        departamento: formData.departamento || 'VEN',
        password: cleanPassword ? cleanPassword : (formData.id ? undefined : '123456')
      };

      const saved = await saveSupabaseUser(payload, currentUser);

      // Si editó su propio usuario en sesión (por ID o username), actualizar sesión activa de inmediato
      const isSelf = currentUser && (
        currentUser.id === saved.id ||
        (currentUser.username && saved.username && currentUser.username.toLowerCase() === saved.username.toLowerCase())
      );
      if (isSelf) {
        try {
          localStorage.setItem('signum_active_user', JSON.stringify(saved));
        } catch (_) {}
        if (onUpdateCurrentUser) onUpdateCurrentUser(saved);
      }

      const fresh = await getSupabaseUsers();
      setUsers(fresh);
      try {
        localStorage.setItem('signum_users_list', JSON.stringify(fresh));
      } catch (_) {}
      if (onUsersUpdated) onUsersUpdated(saved);

      setShowUserModal(false);
      showAlert('success', isNew 
        ? `Nuevo usuario @${cleanUsername} registrado y guardado permanentemente en la nube.` 
        : `Usuario @${cleanUsername} editado y guardado con éxito en Supabase.`
      );
      loadLogs();
    } catch (err) {
      showAlert('error', describeSupabaseError(err, 'Error al guardar el usuario en la base de datos.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showAlert('error', 'Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 4) {
      showAlert('error', 'La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    try {
      setIsSaving(true);
      resetSupabaseOnlineStatus();
      const updatedUser = { ...selectedUser, password: newPassword.trim() };
      await saveSupabaseUser(updatedUser, currentUser);
      const fresh = await getSupabaseUsers();
      setUsers(fresh);
      if (onUsersUpdated) onUsersUpdated();

      setShowPasswordModal(false);
      showAlert('success', `Contraseña de @${selectedUser.username} actualizada correctamente en la nube.`);
      loadLogs();
    } catch (err) {
      showAlert('error', describeSupabaseError(err, 'Error al cambiar contraseña.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      notify.warning('No puedes eliminar tu propio usuario en sesión activa.');
      return;
    }

    const normRole = normalizeRole(user.rol);
    if (normRole === 'ADMINISTRADOR MASTER' || user.username?.toLowerCase() === 'edson designer') {
      notify.error("Acción bloqueada: No se puede eliminar al Administrador Master (Propietario del Sistema).");
      return;
    }

    if (normRole === 'GERENCIA') {
      const totalGerencia = users.filter(u => normalizeRole(u.rol) === 'GERENCIA').length;
      if (totalGerencia <= 1) {
        notify.error("Acción bloqueada: No se puede eliminar al único usuario con rol Gerencia del sistema.");
        return;
      }
    }

    const confirmed = await notify.confirm({
      title: '¿Eliminar Usuario del Sistema?',
      message: `¿Está seguro de eliminar permanentemente al usuario ${user.nombre} (@${user.username}) del sistema y de la base de datos? Esta acción es irreversible.`,
      confirmText: 'Sí, Eliminar Usuario',
      cancelText: 'Cancelar',
      isDestructive: true
    });
    if (!confirmed) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteSupabaseUser(user.id, currentUser);
      const fresh = await getSupabaseUsers();
      setUsers(fresh);
      if (onUsersUpdated) onUsersUpdated();
      showAlert('success', `Usuario @${user.username} eliminado de la base de datos.`);
      loadLogs();
    } catch (err) {
      showAlert('error', err.message || 'Error al eliminar usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  // Formateador de fechas para auditoría y último acceso
  const formatDateTime = (isoString) => {
    if (!isoString) return 'Sin registros';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Sin registros';
      return d.toLocaleString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Sin registros';
    }
  };

  // Filtrado de logs
  const filteredLogs = logs.filter(l => {
    const matchesSearch = !logSearchQuery || 
      (l.usuarioNombre && l.usuarioNombre.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
      (l.detalles && l.detalles.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
      (l.accion && l.accion.toLowerCase().includes(logSearchQuery.toLowerCase()));

    const matchesAction = selectedActionFilter === 'TODAS' || l.accion === selectedActionFilter;
    return matchesSearch && matchesAction;
  });

  const totalUsers = users.length;
  const gerenciaCount = users.filter(u => u.rol === ROLES.GERENCIA).length;
  const adminCount = users.filter(u => u.rol === ROLES.ADMIN).length;
  const vendedorCount = users.filter(u => u.rol === ROLES.VENDEDOR).length;
  const almacenCount = users.filter(u => u.rol === ROLES.ALMACEN).length;

  return (
    <div>
      {/* Encabezado del Módulo */}
      <div className="page-header-responsive" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} color="var(--neon-cyan)" /> Gestión de Usuarios & Registros del Sistema
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Administración permanente de cuentas de operadores, control de accesos y bitácora de auditoría en la nube.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Badge de Estado en la Nube */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#10b981'
            }}
          >
            <Database size={14} />
            <span>Supabase PostgreSQL: Conectado</span>
          </div>

          <button 
            className="btn btn-secondary" 
            onClick={handleForceSync}
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Sincronizar ahora con la base de datos en la nube"
          >
            <RefreshCw size={15} className={isSyncing ? 'rotating-icon' : ''} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>

          {activeSubTab === 'usuarios' && (
            <button className="btn btn-primary" onClick={handleOpenCreateModal}>
              <UserPlus size={18} /> Registrar Nuevo Usuario
            </button>
          )}

          <button
            className="btn btn-print-report"
            onClick={() => generateUsersPDF({ users, logs, activeSubTab, config, currentUser })}
            style={{ marginLeft: 'auto' }}
            title="Generar y descargar reporte oficial de operadores y auditoría en PDF"
          >
            <Printer size={15} color="#ffffff" />
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      {/* Alerta flotante */}
      {alertInfo.message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            background: alertInfo.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: alertInfo.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            color: alertInfo.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '0.88rem'
          }}
        >
          {alertInfo.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{alertInfo.message}</span>
        </div>
      )}

      {/* Conmutador de Pestañas: Cuentas vs Bitácora de Auditoría */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveSubTab('usuarios')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'usuarios' ? 'var(--motorven-navy, #002b7a)' : 'transparent',
            color: activeSubTab === 'usuarios' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Users size={16} />
          <span>Cuentas de Usuarios ({totalUsers})</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('auditoria');
            loadLogs();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'auditoria' ? 'var(--motorven-navy, #002b7a)' : 'transparent',
            color: activeSubTab === 'auditoria' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <History size={16} />
          <span>Bitácora de Auditoría & Actividad ({logs.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: CUENTAS DE USUARIOS */}
      {/* ========================================================================= */}
      {activeSubTab === 'usuarios' && (
        <>
          {/* KPIs de Personal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                👥
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Operadores</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalUsers}</div>
              </div>
            </div>

            {ROLE_DEFINITIONS.map((rDef) => {
              const count = users.filter(u => normalizeRole(u.rol) === rDef.id).length;
              return (
                <div key={rDef.id} className="card" style={{ padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: rDef.badgeBg, border: `1px solid ${rDef.badgeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                    {rDef.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: rDef.badgeColor, textTransform: 'uppercase', fontWeight: 700 }}>
                      {rDef.hierarchy}. {rDef.label}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: rDef.badgeColor }}>
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabla de Usuarios Registrados */}
          <div className="card">
            <div className="table-container">
              <table className="custom-table" style={{ width: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th>Operador</th>
                    <th>Usuario</th>
                    <th>Departamento</th>
                    <th>Rol Asignado</th>
                    <th>Cargo / Responsabilidad</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th>Último Acceso</th>
                    <th style={{ textAlign: 'center' }}>Contraseña</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortUsersByHierarchy(users).map((u) => {
                    const isCurrent = u.id === currentUser?.id;
                    const isPassVisible = !!visiblePasswords[u.id];
                    const deptId = getUserDepartment(u);
                    const deptMeta = getDepartmentMeta(deptId);
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {u.foto ? (
                              <img
                                src={u.foto}
                                alt={u.nombre}
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '2px solid rgba(255, 255, 255, 0.15)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                  flexShrink: 0
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.35rem',
                                  flexShrink: 0
                                }}
                              >
                                {u.avatar || '👤'}
                              </div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 700 }}>{u.nombre}</strong>
                                {isCurrent && (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      background: 'rgba(16, 185, 129, 0.2)',
                                      color: '#34d399',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontWeight: 700
                                    }}
                                  >
                                    Tú
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {u.descripcion || 'Sin notas adicionales'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: 'var(--neon-cyan, #38bdf8)', whiteSpace: 'nowrap' }}>
                              @{u.username}
                            </span>
                            {(u.co_ven || u.coVen) && (
                              <span style={{ fontSize: '0.66rem', background: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {u.co_ven || u.coVen}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              background: 'rgba(0, 43, 122, 0.18)',
                              color: 'var(--text-primary)',
                              border: '1px solid rgba(0, 43, 122, 0.35)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: 'var(--motorven-navy, #002b7a)',
                                color: '#fff'
                              }}
                            >
                              {deptMeta.codigo}
                            </span>
                            <span>{deptMeta.nombre}</span>
                          </span>
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          {(() => {
                            const meta = getRoleMeta(u.rol);
                            return (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: meta.badgeBg,
                                  color: meta.badgeColor,
                                  border: `1px solid ${meta.badgeBorder}`,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {meta.hierarchy}. {meta.label}
                              </span>
                            );
                          })()}
                        </td>

                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{u.cargo}</span>
                        </td>

                        {/* Estado */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {u.activo !== false ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                              Activo
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span>
                              Inactivo
                            </span>
                          )}
                        </td>

                        {/* Último Acceso Registrado */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <Clock size={13} />
                            <span>{formatDateTime(u.ultimoAcceso)}</span>
                          </div>
                        </td>

                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: '150px', padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-glass)' }}>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem', color: '#94a3b8', minWidth: '55px', letterSpacing: isPassVisible ? 'normal' : '2px' }}>
                              {isPassVisible ? u.password || '123456' : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(u.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '3px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: '4px'
                              }}
                              title={isPassVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
                              aria-label={isPassVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
                            >
                              {isPassVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </td>

                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: '150px', padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleOpenPasswordModal(u)}
                              title="Cambiar Contraseña"
                              aria-label="Cambiar Contraseña"
                            >
                              <KeyRound size={14} />
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleOpenEditModal(u)}
                              title="Editar Perfil"
                              aria-label="Editar Perfil"
                            >
                              <Edit2 size={14} />
                            </button>
                            {u.foto && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#f87171' }}
                                onClick={() => handleDirectDeletePhoto(u)}
                                title="Eliminar Foto de Perfil en Supabase"
                                aria-label="Eliminar Foto de Perfil"
                              >
                                <Camera size={14} />
                              </button>
                            )}
                            {!isCurrent && normalizeRole(u.rol) !== 'ADMINISTRADOR MASTER' && u.username?.toLowerCase() !== 'edson designer' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#f87171' }}
                                onClick={() => handleDeleteUser(u)}
                                title="Eliminar Usuario"
                                aria-label="Eliminar Usuario"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: BITÁCORA DE AUDITORÍA & ACTIVIDAD */}
      {/* ========================================================================= */}
      {activeSubTab === 'auditoria' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
              <div className="search-wrapper" style={{ width: '100%', maxWidth: '360px' }}>
                <Search size={16} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar en auditoría (usuario, acción, detalle)..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  style={{ fontSize: '0.85rem', height: '36px' }}
                />
              </div>

              <select
                className="form-control filter-select"
                style={{ minWidth: '190px', maxWidth: '220px', height: '36px', fontSize: '0.82rem' }}
                value={selectedActionFilter}
                onChange={(e) => setSelectedActionFilter(e.target.value)}
              >
                <option value="TODAS">Todas las Acciones</option>
                <option value="LOGIN">Inicios de Sesión (LOGIN)</option>
                <option value="LOGOUT">Cierres de Sesión (LOGOUT)</option>
                <option value="CREAR_USUARIO">Creación de Usuarios</option>
                <option value="EDITAR_USUARIO">Edición de Perfiles</option>
                <option value="CAMBIAR_PASSWORD">Cambio de Contraseña</option>
                <option value="ELIMINAR_USUARIO">Eliminación de Cuentas</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={loadLogs} disabled={logsLoading}>
                <RefreshCw size={14} className={logsLoading ? 'rotating-icon' : ''} />
                <span>{logsLoading ? 'Actualizando...' : 'Refrescar Bitácora'}</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Fecha & Hora</th>
                  <th>Operador / Usuario</th>
                  <th>Rol</th>
                  <th>Acción Registrada</th>
                  <th>Módulo</th>
                  <th>Detalles de la Operación</th>
                </tr>
              </thead>
              <tbody>
                {logsLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      <RefreshCw size={24} className="rotating-icon" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      Cargando registros de auditoría desde Supabase...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      <Shield size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4, display: 'block' }} />
                      No se encontraron registros de auditoría con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const actionBadge = (() => {
                      switch (log.accion) {
                        case 'LOGIN':
                          return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.4)' };
                        case 'LOGOUT':
                          return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.4)' };
                        case 'CREAR_USUARIO':
                          return { bg: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: 'rgba(14, 165, 233, 0.4)' };
                        case 'EDITAR_USUARIO':
                          return { bg: 'rgba(124, 58, 237, 0.15)', color: '#c084fc', border: 'rgba(124, 58, 237, 0.4)' };
                        case 'CAMBIAR_PASSWORD':
                          return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' };
                        case 'ELIMINAR_USUARIO':
                          return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.4)' };
                        default:
                          return { bg: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', border: 'rgba(255, 255, 255, 0.15)' };
                      }
                    })();

                    return (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatDateTime(log.createdAt || log.created_at)}
                        </td>
                        <td>
                          {(() => {
                            const logUser = users.find(u => u.id === log.usuarioId || (u.nombre && log.usuarioNombre && u.nombre.toLowerCase() === log.usuarioNombre.toLowerCase()));
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {logUser?.foto ? (
                                  <img
                                    src={logUser.foto}
                                    alt={log.usuarioNombre}
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '50%',
                                      objectFit: 'cover',
                                      border: '1.5px solid rgba(255, 255, 255, 0.2)',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                      flexShrink: 0
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '50%',
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.85rem',
                                      flexShrink: 0
                                    }}
                                  >
                                    {logUser?.avatar || '👤'}
                                  </div>
                                )}
                                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                  {log.usuarioNombre}
                                </strong>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {log.usuarioRol || 'OPERADOR'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: actionBadge.bg,
                              color: actionBadge.color,
                              border: `1px solid ${actionBadge.border}`
                            }}
                          >
                            {log.accion}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary)' }}>
                            {log.modulo || 'SISTEMA'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {log.detalles || 'Sin detalles'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR / EDITAR USUARIO ULTRA-FLEXIBLE & EXPANDIBLE */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR / EDITAR USUARIO ULTRA-FLEXIBLE & EXPANDIBLE */}
      {/* ========================================================================= */}
      {showUserModal && (
        <div
          className="operator-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUserModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-operator-title"
        >
          <div className={`operator-modal-card ${isModalExpanded ? 'expanded' : ''}`}>
            {/* CABECERA FIJA */}
            <div className="operator-modal-header">
              <h3 id="modal-operator-title">
                <Users size={20} color="#38bdf8" />
                {formData.id ? 'Editar Perfil de Operador' : 'Registrar Nuevo Operador'}
              </h3>
              <div className="operator-modal-controls">
                <button
                  type="button"
                  className="operator-btn-icon"
                  onClick={() => setIsModalExpanded(!isModalExpanded)}
                  title={isModalExpanded ? 'Restaurar tamaño normal' : 'Maximizar / Pantalla completa Flex'}
                  aria-label={isModalExpanded ? 'Restaurar tamaño' : 'Maximizar modal'}
                >
                  {isModalExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  className="operator-btn-icon"
                  onClick={() => setShowUserModal(false)}
                  title="Cerrar ventana (Esc)"
                  aria-label="Cerrar modal"
                >
                  ×
                </button>
              </div>
            </div>

            {/* FORMULARIO CON CUERPO SCROLL-SEGURO Y PIE FIJO */}
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="operator-modal-body">
                {/* FILA SUPERIOR: FOTO DE PERFIL + NOMBRE DE USUARIO (@) */}
                <div className="operator-avatar-row">
                  {/* Foto y botones de foto */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                      {formData.foto ? (
                        <img
                          src={formData.foto}
                          alt="Vista previa"
                          className="operator-avatar-img"
                          style={{
                            width: isModalExpanded ? '64px' : '56px',
                            height: isModalExpanded ? '64px' : '56px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #38bdf8',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            display: 'block',
                            transition: 'all 0.25s ease'
                          }}
                        />
                      ) : (
                        <div
                          className="operator-avatar-img"
                          style={{
                            width: isModalExpanded ? '64px' : '56px',
                            height: isModalExpanded ? '64px' : '56px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1.5px dashed rgba(56, 189, 248, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isModalExpanded ? '2rem' : '1.75rem',
                            transition: 'all 0.25s ease'
                          }}
                        >
                          {formData.avatar || '👤'}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handlePhotoUpload}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressing}
                        title="Subir foto de perfil"
                      >
                        <Upload size={12} /> {isCompressing ? '...' : 'Subir'}
                      </button>
                      {formData.foto && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '3px 6px', fontSize: '0.72rem', color: '#f87171' }}
                          onClick={handleRemovePhoto}
                          title="Eliminar foto de perfil en Supabase"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Al lado de la foto: Nombre de Usuario (@) */}
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Nombre de Usuario (@) *</span>
                        <span className="operator-chip-info">
                          {photoSizeInfo ? `FOTO: ${photoSizeInfo}` : 'ACCESO AL SISTEMA'}
                        </span>
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{
                          position: 'absolute',
                          left: '12px',
                          color: '#38bdf8',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          pointerEvents: 'none'
                        }}>@</span>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/^@/, '') })}
                          placeholder="usuario"
                          required
                          style={{ paddingLeft: '30px', fontSize: '0.9rem', fontWeight: 600, height: '36px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* PARES DE CAMPOS EN GRID ELÁSTICO */}
                <div className="operator-form-layout">
                  {/* PAR 1: NOMBRE COMPLETO Y CARGO INSTITUCIONAL */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      <span>Nombre Completo *</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej. Juan Pérez"
                      required
                      style={{ fontSize: '0.86rem', height: '36px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      <span>Cargo Institucional *</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      placeholder="Ej. Asesor de Ventas Senior"
                      required
                      style={{ fontSize: '0.86rem', height: '36px' }}
                    />
                  </div>

                  {/* PAR 2: DEPARTAMENTO ASIGNADO Y MÓDULOS PERMITIDOS */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      <span>Departamento Asignado *</span>
                      <span className="operator-chip-info" style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        LOGIN
                      </span>
                    </label>
                    <select
                      className="form-control"
                      value={formData.departamento || 'VEN'}
                      onChange={(e) => {
                        const newDept = e.target.value;
                        const deptRoleMap = {
                          TI: ROLES.TI,
                          DIR: ROLES.GERENCIA,
                          ADM: ROLES.ADMINISTRACION,
                          VEN: ROLES.VENTAS,
                          OPE: ROLES.ALMACEN
                        };
                        const mappedRole = deptRoleMap[newDept] || ROLES.VENTAS;
                        const meta = getRoleMeta(mappedRole);
                        const defaultMods = ROLE_PERMISSIONS[mappedRole] ? [...ROLE_PERMISSIONS[mappedRole]] : [...(meta.defaultModules || [])];

                        setFormData({
                          ...formData,
                          departamento: newDept,
                          rol: mappedRole,
                          avatar: formData.foto ? formData.avatar : meta.avatar,
                          modulos: formData.id ? (formData.modulos || defaultMods) : defaultMods
                        });
                      }}
                      style={{ fontSize: '0.85rem', fontWeight: 600, height: '36px' }}
                      required
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept.id} value={dept.id} title={`${dept.nombre} — ${dept.subtitulo}`}>
                          [{dept.codigo}] {dept.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dropdown de Módulos con Check */}
                  <div className="form-group" style={{ margin: 0, position: 'relative' }} ref={modulesDropdownRef}>
                    <label className="form-label">
                      <span>Módulos Permitidos *</span>
                      <span className="operator-chip-info">
                        {(formData.modulos || []).length} / {SYSTEM_MODULES.length}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowModulesDropdown(!showModulesDropdown)}
                      className="form-control"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        textAlign: 'left',
                        padding: '6px 12px',
                        height: '36px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: showModulesDropdown ? '1.5px solid #38bdf8' : '1px solid #1e293b'
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(formData.modulos || []).length === SYSTEM_MODULES.length
                          ? `⭐ Todos (${SYSTEM_MODULES.length})`
                          : (formData.modulos || []).length === 0
                          ? '⚠️ Ningún módulo'
                          : `${(formData.modulos || []).length} de ${SYSTEM_MODULES.length} módulos`}
                      </span>
                      <ChevronDown size={15} style={{ transform: showModulesDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0, color: '#94a3b8' }} />
                    </button>

                    {/* Menú Desplegable Flotante con Checkboxes */}
                    {showModulesDropdown && (
                      <div className="operator-modules-dropdown">
                        <div className="operator-modules-dropdown-header">
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Asignar Permisos ({formData.modulos?.length || 0}/{SYSTEM_MODULES.length})
                          </span>
                          <button
                            type="button"
                            onClick={handleSelectAllModules}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#38bdf8',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '2px 4px'
                            }}
                          >
                            {(formData.modulos || []).length === SYSTEM_MODULES.length ? 'Desmarcar todos' : 'Marcar todos'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          {SYSTEM_MODULES.map((mod) => {
                            const isChecked = (formData.modulos || []).includes(mod.id);
                            return (
                              <label
                                key={mod.id}
                                className={`operator-module-item ${isChecked ? 'selected' : ''}`}
                                onClick={(e) => {
                                  if (e.target.tagName !== 'INPUT') {
                                    e.preventDefault();
                                    handleToggleModule(mod.id);
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleModule(mod.id)}
                                />
                                <span className="operator-module-label" title={mod.label}>
                                  {mod.label}
                                </span>
                                {isChecked && (
                                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800, flexShrink: 0, marginLeft: 'auto' }}>
                                    ✓
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PAR 3: NUEVA CONTRASEÑA Y ESTADO DE LA CUENTA */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>{formData.id ? 'Nueva Contraseña' : 'Contraseña Inicial *'}</span>
                      <span className="operator-chip-info" style={{ fontSize: '0.7rem' }}>
                        {formData.id ? `ACTUAL: ${(formData.currentPassword || '123456').toUpperCase()}` : 'DEFECTO: 123456'}
                      </span>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                      <input
                        type={showModalPass ? 'text' : 'password'}
                        className="form-control"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={formData.id ? 'En blanco para no cambiar' : 'Mínimo 4 caracteres'}
                        required={!formData.id}
                        style={{ paddingRight: '44px', fontSize: '0.86rem', height: '36px', width: '100%' }}
                      />
                      <button
                        type="button"
                        className="btn-password-eye"
                        onClick={() => setShowModalPass(!showModalPass)}
                        title={showModalPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                        aria-label={showModalPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {showModalPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      <span>Estado de la Cuenta *</span>
                    </label>
                    <select
                      className="form-control"
                      value={formData.activo ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'true' })}
                      style={{ fontSize: '0.85rem', height: '36px' }}
                    >
                      <option value="true">🟢 Activo (Acceso Permitido)</option>
                      <option value="false">🔴 Inactivo (Acceso Suspendido)</option>
                    </select>
                  </div>

                  {/* PAR 4: NOTAS / RESPONSABILIDADES (ANCHO COMPLETO grid-column: 1 / -1) */}
                  <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
                    <label className="form-label">
                      <span>Notas / Responsabilidades</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows={isModalExpanded ? 3 : 2}
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Detalles sobre las funciones asignadas a este operador..."
                      style={{ fontSize: '0.84rem', lineHeight: 1.45, minHeight: isModalExpanded ? '75px' : '50px', resize: 'vertical' }}
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* PIE DE PÁGINA FIJO */}
              <div className="operator-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-cancel-operator"
                  onClick={() => setShowUserModal(false)}
                  disabled={isSaving}
                  style={{ padding: '0.55rem 1.35rem', fontSize: '0.86rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-save-operator"
                  disabled={isSaving}
                  style={{ minWidth: '150px', padding: '0.55rem 1.5rem', fontSize: '0.86rem' }}
                >
                  {isSaving ? 'Guardando en la Nube...' : (formData.id ? 'Guardar Cambios' : 'Registrar Operador')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CAMBIO DE CONTRASEÑA */}
      {/* ========================================================================= */}
      {showPasswordModal && selectedUser && (
        <div className="modal-overlay" style={{ padding: 'clamp(0.5rem, 2vh, 1rem)' }}>
          <div className="modal-card modal-auto-fit" style={{ maxWidth: '440px', width: 'min(440px, 94vw)' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-heading)' }}>
                <KeyRound size={20} color="var(--neon-cyan)" />
                Cambiar Contraseña
              </h3>
              <button className="btn-close" onClick={() => setShowPasswordModal(false)} type="button">×</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.85rem', background: 'var(--bg-pill)', borderRadius: '12px', border: '1px solid var(--border-glass)', marginBottom: '1.25rem' }}>
              {selectedUser.foto ? (
                <img
                  src={selectedUser.foto}
                  alt={selectedUser.nombre}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--neon-cyan)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    flexShrink: 0
                  }}
                />
              ) : (
                <div style={{ fontSize: '1.4rem' }}>{selectedUser.avatar || '👤'}</div>
              )}
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{selectedUser.nombre}</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{selectedUser.username} • {selectedUser.cargo}</div>
              </div>
            </div>

            <form onSubmit={handleChangePasswordSubmit}>
              {/* CONTRASEÑA ACTUAL */}
              <div className="form-group" style={{ marginBottom: '1.15rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>Contraseña Actual</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Clave registrada</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showCurrentPassText ? 'text' : 'password'}
                    className="form-control"
                    value={selectedUser.password || '123456'}
                    readOnly
                    style={{
                      paddingRight: '2.5rem',
                      background: 'var(--bg-pill, rgba(255, 255, 255, 0.05))',
                      fontFamily: showCurrentPassText ? 'var(--font-mono, monospace)' : 'inherit',
                      fontWeight: 700,
                      letterSpacing: showCurrentPassText ? 'normal' : '0.2em',
                      color: 'var(--text-heading)',
                      cursor: 'default',
                      border: '1px solid var(--border-glass)'
                    }}
                  />
                  <button
                    type="button"
                    className="btn-password-eye"
                    onClick={() => setShowCurrentPassText(!showCurrentPassText)}
                    title={showCurrentPassText ? 'Ocultar contraseña actual' : 'Ver contraseña actual'}
                    aria-label={showCurrentPassText ? 'Ocultar contraseña actual' : 'Ver contraseña actual'}
                  >
                    {showCurrentPassText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Nueva Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassText ? 'text' : 'password'}
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    required
                    autoFocus
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    className="btn-password-eye"
                    onClick={() => setShowPassText(!showPassText)}
                    title={showPassText ? 'Ocultar contraseña' : 'Ver contraseña'}
                    aria-label={showPassText ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Confirmar Nueva Contraseña</label>
                <input
                  type={showPassText ? 'text' : 'password'}
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)} disabled={isSaving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
