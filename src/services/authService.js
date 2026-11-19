/**
 * Servicio de Autenticación y Control de Roles
 * SIGNUM MOTORVEN
 */

import {
  saveSupabaseUser,
  deleteSupabaseUser,
  updateUserLastAccess,
  logUserActivity,
  getSupabaseUsers
} from './supabaseService.js';
import { TEMPORARY_USERS } from '../data/temp/index.js';

export const ROLES = {
  MASTER: 'ADMINISTRADOR MASTER',
  ADMINISTRADOR_MASTER: 'ADMINISTRADOR MASTER',
  ADMIN_MASTER: 'ADMINISTRADOR MASTER',
  ADMIN_SISTEMA: 'TECNOLOGÍA & INFORMÁTICA',
  ADMINISTRADOR_SISTEMA: 'TECNOLOGÍA & INFORMÁTICA',
  SYSADMIN: 'TECNOLOGÍA & INFORMÁTICA',
  TI: 'TECNOLOGÍA & INFORMÁTICA',
  INFORMATICA: 'TECNOLOGÍA & INFORMÁTICA',
  GERENCIA: 'GERENCIA',
  ADMINISTRACION: 'ADMINISTRACIÓN',
  ADMINISTRACIÓN: 'ADMINISTRACIÓN',
  ADMIN: 'ADMINISTRACIÓN',
  VENTAS: 'VENTAS',
  VENDEDOR: 'VENTAS',
  ALMACEN: 'ALMACEN',
  ALMACÉN: 'ALMACEN',
  CAJA: 'CAJA',
  COBRANZA: 'COBRANZA',
  COMPRAS: 'COMPRAS'
};

/**
 * Catálogo Oficial de Roles en Orden Estricto de Jerarquía
 * 1. ADMINISTRADOR MASTER (Control Total Exclusivo de Edson Designer)
 * 2. TECNOLOGÍA & INFORMÁTICA (Soporte & Sistemas Operativos)
 * 3. GERENCIA (Gerencia General)
 * 4. ADMINISTRACIÓN & FINANZAS
 * 5. VENTAS
 * 6. ALMACEN
 * 7. CAJA
 * 8. COBRANZA
 * 9. COMPRAS
 */
export const ROLE_DEFINITIONS = [
  {
    id: 'ADMINISTRADOR MASTER',
    label: 'ADMINISTRADOR MASTER',
    titulo: 'Administrador Master (Propietario & Control Absoluto)',
    hierarchy: 1,
    color: '#e60012',
    badgeBg: 'rgba(230, 0, 18, 0.18)',
    badgeBorder: 'rgba(230, 0, 18, 0.55)',
    badgeColor: '#ff4d4d',
    gradient: 'linear-gradient(135deg, #e60012 0%, #99000c 100%)',
    avatar: '👑',
    defaultCargo: 'Administrador Master / Propietario',
    defaultModules: ['dashboard', 'preventa', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios'],
    defaultTab: 'dashboard'
  },
  {
    id: 'TECNOLOGÍA & INFORMÁTICA',
    label: 'TECNOLOGÍA & INFORMÁTICA',
    titulo: 'Soporte Técnico & Infraestructura TI',
    hierarchy: 2,
    color: '#002b7a',
    badgeBg: 'rgba(0, 43, 122, 0.25)',
    badgeBorder: 'rgba(0, 43, 122, 0.55)',
    badgeColor: '#93c5fd',
    gradient: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)',
    avatar: '💻',
    defaultCargo: 'Especialista / Pasante TI',
    defaultModules: ['dashboard', 'inventario', 'reportes', 'auditoria', 'usuarios', 'configuracion'],
    defaultTab: 'dashboard'
  },
  {
    id: 'GERENCIA',
    label: 'GERENCIA',
    titulo: 'Gerencia General & Dirección',
    hierarchy: 3,
    color: '#7c3aed',
    badgeBg: 'rgba(124, 58, 237, 0.15)',
    badgeBorder: 'rgba(124, 58, 237, 0.4)',
    badgeColor: '#c084fc',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    avatar: '👔',
    defaultCargo: 'Gerente General / Dirección',
    defaultModules: ['dashboard', 'preventa', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios'],
    defaultTab: 'dashboard'
  },
  {
    id: 'ADMINISTRACIÓN',
    label: 'ADMINISTRACIÓN',
    titulo: 'Administración & Finanzas',
    hierarchy: 4,
    color: '#002b7a',
    badgeBg: 'rgba(0, 43, 122, 0.25)',
    badgeBorder: 'rgba(0, 43, 122, 0.5)',
    badgeColor: '#60a5fa',
    gradient: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)',
    avatar: '👨‍💼',
    defaultCargo: 'Administración & Finanzas',
    defaultModules: ['dashboard', 'preventa', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios'],
    defaultTab: 'dashboard'
  },
  {
    id: 'VENTAS',
    label: 'VENTAS',
    titulo: 'Ventas & Facturación POS',
    hierarchy: 5,
    color: '#0ea5e9',
    badgeBg: 'rgba(14, 165, 233, 0.15)',
    badgeBorder: 'rgba(14, 165, 233, 0.4)',
    badgeColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    avatar: '👩‍💼',
    defaultCargo: 'Asesor Comercial / Facturación',
    defaultModules: ['preventa', 'pedidos', 'ventas', 'vendedores', 'inventario', 'cxc'],
    defaultTab: 'preventa'
  },
  {
    id: 'ALMACEN',
    label: 'ALMACEN',
    titulo: 'Almacén & Despacho',
    hierarchy: 6,
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.4)',
    badgeColor: '#fbbf24',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    avatar: '👷‍♂️',
    defaultCargo: 'Jefe de Almacén y Despacho',
    defaultModules: ['pedidos', 'inventario', 'compras'],
    defaultTab: 'inventario'
  },
  {
    id: 'CAJA',
    label: 'CAJA',
    titulo: 'Caja & Cobros Mostrador',
    hierarchy: 7,
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
    badgeColor: '#34d399',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    avatar: '💰',
    defaultCargo: 'Cajero(a) Principal / Custodio de Fondos',
    defaultModules: ['caja', 'cxc', 'ventas', 'pedidos'],
    defaultTab: 'caja'
  },
  {
    id: 'COBRANZA',
    label: 'COBRANZA',
    titulo: 'Gestión de Crédito & Cobranzas',
    hierarchy: 8,
    color: '#6366f1',
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    badgeBorder: 'rgba(99, 102, 241, 0.4)',
    badgeColor: '#818cf8',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    avatar: '📋',
    defaultCargo: 'Analista de Cobranzas y Crédito',
    defaultModules: ['cxc', 'caja', 'ventas', 'pedidos'],
    defaultTab: 'cxc'
  },
  {
    id: 'COMPRAS',
    label: 'COMPRAS',
    titulo: 'Procura & Proveedores',
    hierarchy: 9,
    color: '#ea580c',
    badgeBg: 'rgba(234, 88, 12, 0.15)',
    badgeBorder: 'rgba(234, 88, 12, 0.4)',
    badgeColor: '#fb923c',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    avatar: '🛒',
    defaultCargo: 'Especialista de Procura y Compras',
    defaultModules: ['compras', 'cxp', 'inventario'],
    defaultTab: 'compras'
  }
];

export const ROLE_HIERARCHY = {
  'ADMINISTRADOR MASTER': 1,
  'MASTER': 1,
  'TECNOLOGÍA & INFORMÁTICA': 2,
  'ADMINISTRADOR DEL SISTEMA': 2,
  'ADMIN_SISTEMA': 2,
  'SYSADMIN': 2,
  'SUPERADMIN': 2,
  'GERENCIA': 3,
  'ADMINISTRACIÓN': 4,
  'ADMINISTRACION': 4,
  'ADMIN': 4,
  'VENTAS': 5,
  'VENDEDOR': 5,
  'ALMACEN': 6,
  'ALMACÉN': 6,
  'CAJA': 7,
  'COBRANZA': 8,
  'COMPRAS': 9
};

export function normalizeRole(role) {
  if (!role) return 'VENTAS';
  const upper = String(role).trim().toUpperCase();
  if (
    upper === 'ADMINISTRADOR MASTER' ||
    upper === 'ADMIN_MASTER' ||
    upper === 'MASTER' ||
    upper.includes('MASTER')
  ) return 'ADMINISTRADOR MASTER';

  if (
    upper === 'TECNOLOGÍA & INFORMÁTICA' ||
    upper === 'TECNOLOGIA & INFORMATICA' ||
    upper === 'ADMINISTRADOR DEL SISTEMA' ||
    upper === 'ADMINISTRADOR DE SISTEMA' ||
    upper === 'ADMINISTRADOR SISTEMA' ||
    upper === 'ADMIN_SISTEMA' ||
    upper === 'ADMINISTRADOR_SISTEMA' ||
    upper === 'SYSADMIN' ||
    upper === 'SUPERADMIN' ||
    (upper.includes('ADMIN') && (upper.includes('SISTEMA') || upper.includes('SYS') || upper.includes('TI') || upper.includes('IT'))) ||
    upper.includes('INFORMATIC') ||
    upper === 'TI'
  ) return 'TECNOLOGÍA & INFORMÁTICA';
  if (upper.includes('GERENC') || upper.includes('DIRECT') || upper.includes('PRESIDENC')) return 'GERENCIA';
  if (upper === 'ADMIN' || upper === 'ADMINISTRACION' || upper === 'ADMINISTRACIÓN' || upper.includes('FINANZ')) return 'ADMINISTRACIÓN';
  if (upper.includes('VENTA') || upper.includes('VENDEDOR') || upper.includes('COMERCIAL')) return 'VENTAS';
  if (upper.includes('ALMACEN') || upper.includes('ALMACÉN') || upper.includes('DESPACHO')) return 'ALMACEN';
  if (upper.includes('CAJA') || upper.includes('CAJERO')) return 'CAJA';
  if (upper.includes('COBRANZA') || upper.includes('CREDITO') || upper.includes('CRÉDITO')) return 'COBRANZA';
  if (upper.includes('COMPRA') || upper.includes('PROCURA') || upper.includes('PROVEEDOR')) return 'COMPRAS';
  return upper;
}

export function getRoleMeta(role) {
  const norm = normalizeRole(role);
  return ROLE_DEFINITIONS.find(r => r.id === norm) || ROLE_DEFINITIONS[2];
}

/**
 * Catálogo Oficial de Departamentos Corporativos SIGNUM MOTORVEN
 * Uniforme con la paleta institucional (Navy #002b7a, Red #e60012)
 */
export const DEPARTMENTS = [
  {
    id: 'TI',
    codigo: 'TI',
    nombre: 'Tecnología & Informática',
    subtitulo: 'Sistemas & Administración Master',
    descripcion: 'Control tecnológico, bases de datos y seguridad digital.',
    icono: 'Laptop',
    orden: 1
  },
  {
    id: 'DIR',
    codigo: 'DIR',
    nombre: 'Dirección & Gerencia',
    subtitulo: 'Gerencia General & Estrategia',
    descripcion: 'Planificación corporativa, supervisión y toma de decisiones.',
    icono: 'Building2',
    orden: 2
  },
  {
    id: 'ADM',
    codigo: 'ADM',
    nombre: 'Administración & Finanzas',
    subtitulo: 'Finanzas, Tesorería & Cobranzas',
    descripcion: 'Arqueo de caja, cuentas por cobrar, pagos y reportes fiscales.',
    icono: 'Briefcase',
    orden: 3
  },
  {
    id: 'VEN',
    codigo: 'VEN',
    nombre: 'Comercial & Ventas',
    subtitulo: 'Fuerza de Ventas & Facturación POS',
    descripcion: 'Atención a clientes, preventa, pedidos y mostrador.',
    icono: 'TrendingUp',
    orden: 4
  },
  {
    id: 'OPE',
    codigo: 'OPE',
    nombre: 'Operaciones & Logística',
    subtitulo: 'Almacén, Despacho & Procura',
    descripcion: 'Control de inventario de lubricantes, kardex y compras.',
    icono: 'Package',
    orden: 5
  }
];

export function getUserDepartment(user) {
  if (user?.departamento) return user.departamento;
  const username = (user?.username || '').toLowerCase();
  const rol = normalizeRole(user?.rol);

  if (username === 'edson designer' || rol === 'ADMINISTRADOR MASTER' || rol === 'TECNOLOGÍA & INFORMÁTICA' || rol === 'ADMINISTRADOR DEL SISTEMA') return 'TI';
  if (username === 'gerencia' || rol === 'GERENCIA') return 'DIR';
  if (username === 'admin' || rol === 'ADMINISTRACIÓN' || rol === 'ADMIN' || rol === 'CAJA' || rol === 'COBRANZA' || username === 'caja' || username === 'cobranza') return 'ADM';
  if (rol === 'VENTAS' || username === 'ventas') return 'VEN';
  if (rol === 'ALMACEN' || rol === 'COMPRAS' || username === 'almacen' || username === 'compras') return 'OPE';

  return 'ADM';
}

export function getDepartmentMeta(deptId) {
  return DEPARTMENTS.find(d => d.id === deptId || d.codigo === deptId) || DEPARTMENTS[2];
}


export const DEFAULT_USERS = TEMPORARY_USERS && TEMPORARY_USERS.length > 0 ? TEMPORARY_USERS : [
  {
    id: 'usr-muq3bdll',
    username: 'edson designer',
    password: 'York@1604',
    nombre: 'Edson Designer',
    cargo: 'Administrador Master / Dirección',
    rol: 'ADMINISTRADOR MASTER',
    departamento: 'TI',
    modulos: ['dashboard', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios'],
    avatar: '👑',
    foto: null,
    color: '#e60012',
    descripcion: 'Control total del sistema (Administrador Master y Propietario).'
  }
];

/**
 * Ordena un listado de usuarios según la jerarquía institucional:
 * 1. GERENCIA
 * 2. ADMINISTRACIÓN
 * 3. VENTAS
 * 4. ALMACEN
 * 5. CAJA
 * 6. COBRANZA
 * 7. COMPRAS
 */
export function sortUsersByHierarchy(usersList) {
  if (!Array.isArray(usersList)) return [];
  return [...usersList].sort((a, b) => {
    const roleA = normalizeRole(a?.rol);
    const roleB = normalizeRole(b?.rol);
    const rankA = ROLE_HIERARCHY[roleA] || 99;
    const rankB = ROLE_HIERARCHY[roleB] || 99;
    if (rankA !== rankB) return rankA - rankB;
    return (a?.nombre || '').localeCompare(b?.nombre || '');
  });
}

export const USERS_DATA = DEFAULT_USERS;

const STORAGE_USERS_KEY = 'signum_users_list';
const STORAGE_ACTIVE_USER_KEY = 'signum_active_user';

export const SYSTEM_MODULES = [
  // I. SÍNTESIS EJECUTIVA (CONSOLIDADO GRUPOS 1 AL 6)
  { id: 'dashboard', label: 'Resumen General', badge: 'Estructural • Consolidado Grupos 1–6' },

  // II. CUENTAS REALES (BALANCE GENERAL / SITUACIÓN FINANCIERA)
  { id: 'caja', label: 'Caja Chica & Bancos', badge: 'Cuenta Real • 1.01 Activo Disponible' },
  { id: 'cxc', label: 'Cuentas por Cobrar (CxC)', badge: 'Cuenta Real • 1.01.03 Activo Exigible' },
  { id: 'inventario', label: 'Inventario de Lubricantes', badge: 'Cuenta Real • 1.04 Activo Realizable' },
  { id: 'compras', label: 'Compras & Proveedores', badge: 'Cuenta Real • 2.02 Pasivo / 1.04 Compra' },
  { id: 'cxp', label: 'Cuentas por Pagar (CxP)', badge: 'Cuenta Real • 2.02.02 Pasivo Comercial' },
  { id: 'pasivos', label: 'Cuentas de Pasivo', badge: 'Cuenta Real • 2.01–2.06 Pasivo General' },
  { id: 'auditoria', label: 'Auditoría & Contable', badge: 'Cuenta Real • 3. Patrimonio & Cierre' },

  // III. CUENTAS NOMINALES (ESTADO DE RESULTADOS / GANANCIAS Y PÉRDIDAS)
  { id: 'ventas', label: 'Ventas & POS Mostrador', badge: 'Cuenta Nominal • 4.01 Ingresos' },
  { id: 'rentabilidad', label: 'Rentabilidad & BI', badge: 'Cuenta Nominal • 5.01 Costos & Kardex' },
  { id: 'vendedores', label: 'Fuerza de Ventas', badge: 'Cuenta Nominal • 6.01 Egresos Comisiones' },

  // IV. MÓDULOS ESTRUCTURALES (PRE-ASIENTO, TRIBUTARIO SENIAT & GOBIERNO)
  { id: 'preventa', label: 'Preventa Móvil (Vendedor)', badge: 'Estructural • Pre-Asiento Comercial' },
  { id: 'pedidos', label: 'Flujo Comercial & Pedidos', badge: 'Estructural • Pre-Asiento & Despacho' },
  { id: 'reportes', label: 'Libros Fiscales SENIAT', badge: 'Estructural • Fiscal 1.05 vs 2.03' },
  { id: 'usuarios', label: 'Gestión de Usuarios', badge: 'Estructural • Control Interno RBAC' },
  { id: 'notificaciones', label: 'Notificaciones & Alertas', badge: 'Estructural • Supervisión Preventiva' },
  { id: 'configuracion', label: 'Configuración General', badge: 'Estructural • Parámetros & Tasas BCV' }
];

// Módulos permitidos por cada rol por defecto
export const ROLE_PERMISSIONS = {
  'ADMINISTRADOR MASTER': ['dashboard', 'preventa', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios', 'notificaciones', 'configuracion'],
  'TECNOLOGÍA & INFORMÁTICA': ['dashboard', 'inventario', 'reportes', 'auditoria', 'usuarios', 'notificaciones', 'configuracion'],
  'ADMINISTRADOR DEL SISTEMA': ['dashboard', 'inventario', 'reportes', 'auditoria', 'usuarios', 'notificaciones', 'configuracion'],
  'GERENCIA': ['dashboard', 'preventa', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios', 'notificaciones'],
  'ADMINISTRACIÓN': ['dashboard', 'preventa', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios', 'notificaciones'],
  'ADMIN': ['dashboard', 'preventa', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'pasivos', 'reportes', 'auditoria', 'usuarios', 'notificaciones'],
  'VENTAS': ['preventa', 'pedidos', 'ventas', 'vendedores', 'inventario', 'cxc', 'notificaciones'],
  'VENDEDOR': ['preventa', 'pedidos', 'ventas', 'vendedores', 'inventario', 'cxc', 'notificaciones'],
  'ALMACEN': ['pedidos', 'inventario', 'compras', 'notificaciones'],
  'ALMACÉN': ['pedidos', 'inventario', 'compras', 'notificaciones'],
  'CAJA': ['caja', 'cxc', 'ventas', 'pedidos', 'notificaciones'],
  'COBRANZA': ['cxc', 'caja', 'ventas', 'pedidos', 'notificaciones'],
  'COMPRAS': ['compras', 'cxp', 'inventario', 'notificaciones']
};

// Pestaña inicial preferida al iniciar sesión según rol
export const DEFAULT_TABS_BY_ROLE = {
  'ADMINISTRADOR MASTER': 'dashboard',
  'TECNOLOGÍA & INFORMÁTICA': 'dashboard',
  'ADMINISTRADOR DEL SISTEMA': 'dashboard',
  'GERENCIA': 'dashboard',
  'ADMINISTRACIÓN': 'dashboard',
  'ADMIN': 'dashboard',
  'VENTAS': 'preventa',
  'VENDEDOR': 'preventa',
  'ALMACEN': 'inventario',
  'ALMACÉN': 'inventario',
  'CAJA': 'caja',
  'COBRANZA': 'caja',
  'COMPRAS': 'compras'
};

/**
 * Obtiene el listado completo de usuarios desde localStorage (o los iniciales por defecto)
 */
export function getUsersList() {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }

    let deletedIds = [];
    try {
      const rawDel = localStorage.getItem('signum_deleted_user_ids');
      if (rawDel) deletedIds = JSON.parse(rawDel) || [];
    } catch (_) {}

    // Filtrar 'sysadmin', registros sin username, eliminados o restos de pruebas automatizadas
    const filteredParsed = parsed.filter(u => {
      if (!u || typeof u.username !== 'string') return false;
      const uname = u.username.trim().toLowerCase();
      if (!uname || uname === 'sysadmin' || u.id === 'usr-sysadmin' || uname === 'autotest_1793130314101') return false;
      if (uname !== 'edson designer' && (deletedIds.includes(u.id) || deletedIds.includes(uname))) return false;
      return true;
    });
    let hasMergedTemp = filteredParsed.length !== parsed.length;
    let currentList = filteredParsed;

    if (Array.isArray(TEMPORARY_USERS) && TEMPORARY_USERS.length > 0) {
      for (const tUser of TEMPORARY_USERS) {
        if (!tUser || !tUser.username) continue;
        const tUname = tUser.username.trim().toLowerCase();
        const isDeleted = tUname !== 'edson designer' && (deletedIds.includes(tUser.id) || deletedIds.includes(tUname));
        const found = currentList.find(u => (u.id && u.id === tUser.id) || (u.username && u.username.toLowerCase() === tUname));
        if (!found) {
          if (!isDeleted) {
            currentList.push({ ...tUser });
            hasMergedTemp = true;
          }
        } else {
          // Si la versión empaquetada (users.json) tiene fecha updated_at más reciente que la caché local, sincronizarla
          const tUpdated = tUser.updated_at || tUser.updatedAt;
          const fUpdated = found.updatedAt || found.updated_at;
          if (tUpdated && fUpdated && new Date(tUpdated).getTime() > new Date(fUpdated).getTime()) {
            const hasInvalidPhoto = typeof found.foto === 'string' && found.foto.includes('user_kenterbertf2_1793628');
            const keepPhoto = !hasInvalidPhoto && found.foto !== undefined ? found.foto : (tUser.foto || null);
            Object.assign(found, tUser, { foto: keepPhoto });
            hasMergedTemp = true;
          } else {
            // Reparar únicamente campos obligatorios vacíos sin sobrescribir ediciones locales
            if ((!found.nombre || found.nombre === '') && tUser.nombre) {
              found.nombre = tUser.nombre;
              hasMergedTemp = true;
            }
            if ((!found.rol || found.rol === '') && tUser.rol) {
              found.rol = tUser.rol;
              hasMergedTemp = true;
            }
            if ((!found.password || found.password === '') && tUser.password !== undefined) {
              found.password = tUser.password;
              hasMergedTemp = true;
            }
            if (typeof found.foto === 'string' && found.foto.includes('user_kenterbertf2_1793628')) {
              found.foto = null;
              hasMergedTemp = true;
            } else if (found.foto === undefined && tUser.foto && !String(tUser.foto).includes('user_kenterbertf2_1793628')) {
              found.foto = tUser.foto;
              hasMergedTemp = true;
            }
            if (tUser.cedula && !found.cedula) {
              found.cedula = tUser.cedula;
              hasMergedTemp = true;
            }
            if (tUser.email && !found.email) {
              found.email = tUser.email;
              hasMergedTemp = true;
            }
            if (tUser.phone && !found.phone) {
              found.phone = tUser.phone;
              found.telefono = tUser.phone;
              hasMergedTemp = true;
            }
            if (tUser.avatar && !found.avatar) {
              found.avatar = tUser.avatar;
              hasMergedTemp = true;
            }
            if (found.activo === undefined && tUser.activo !== undefined) {
              found.activo = tUser.activo;
              hasMergedTemp = true;
            }
          }
        }
      }
    }
    if (hasMergedTemp) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(currentList));
    }

    const normalizedList = currentList.map(u => {
      const norm = normalizeRole(u.rol);
      return {
        ...u,
        rol: norm,
        departamento: u.departamento || getUserDepartment(u),
        modulos: Array.isArray(u.modulos) && u.modulos.length > 0
          ? u.modulos
          : (ROLE_PERMISSIONS[norm] ? [...ROLE_PERMISSIONS[norm]] : ['ventas'])
      };
    });

    return sortUsersByHierarchy(normalizedList);
  } catch (err) {
    console.error("Error leyendo usuarios de localStorage:", err);
    return sortUsersByHierarchy(DEFAULT_USERS);
  }
}

/**
 * Crea o actualiza un usuario en la lista
 */
export function saveUser(userData) {
  const users = getUsersList();
  let updatedUsers;
  let savedUser;
  const nowIso = new Date().toISOString();

  const cleanUsername = (userData.username || '').trim().toLowerCase();
  if (!cleanUsername) {
    throw new Error('El nombre de usuario es obligatorio.');
  }

  const targetRole = normalizeRole(userData.rol || 'VENTAS');
  const roleMeta = getRoleMeta(targetRole);
  const roleColor = roleMeta.color;

  if (userData.id) {
    // Editar existente
    const duplicate = users.some(u => u.id !== userData.id && u.username.toLowerCase() === cleanUsername);
    if (duplicate) {
      throw new Error(`El usuario @${cleanUsername} ya existe. Elija otro nombre de usuario.`);
    }

    updatedUsers = users.map(u => {
      if (u.id === userData.id) {
        savedUser = {
          ...u,
          ...userData,
          username: cleanUsername,
          nombre: (userData.nombre || u.nombre).trim(),
          cargo: (userData.cargo || u.cargo || roleMeta.defaultCargo).trim(),
          rol: targetRole,
          departamento: userData.departamento || u.departamento || getUserDepartment({ ...u, ...userData, rol: targetRole }),
          avatar: userData.avatar || u.avatar || roleMeta.avatar,
          foto: userData.foto !== undefined ? userData.foto : (u.foto ?? null),
          color: roleColor,
          password: userData.password ? userData.password.trim() : (u.password || '123456'),
          modulos: Array.isArray(userData.modulos) ? userData.modulos : (u.modulos || ROLE_PERMISSIONS[targetRole] || []),
          updatedAt: nowIso,
          updated_at: nowIso
        };
        return savedUser;
      }
      return u;
    });
  } else {
    // Crear nuevo usuario
    const duplicate = users.some(u => u.username.toLowerCase() === cleanUsername);
    if (duplicate) {
      throw new Error(`El usuario @${cleanUsername} ya existe. Elija otro nombre de usuario.`);
    }

    const newId = `usr-${Date.now().toString(36)}`;
    savedUser = {
      id: newId,
      username: cleanUsername,
      password: (userData.password || '123456').trim(),
      nombre: (userData.nombre || '').trim(),
      cargo: (userData.cargo || roleMeta.defaultCargo || 'Operador').trim(),
      rol: targetRole,
      departamento: userData.departamento || getUserDepartment({ ...userData, rol: targetRole }),
      avatar: userData.avatar || roleMeta.avatar,
      foto: userData.foto ?? null,
      color: roleColor,
      descripcion: userData.descripcion || `Operador con rol ${targetRole}`,
      modulos: Array.isArray(userData.modulos) ? userData.modulos : (ROLE_PERMISSIONS[targetRole] || []),
      createdAt: nowIso,
      created_at: nowIso,
      updatedAt: nowIso,
      updated_at: nowIso
    };
    updatedUsers = [...users, savedUser];
  }

  const sorted = sortUsersByHierarchy(updatedUsers);
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(sorted));

  // Si el usuario editado es la sesión activa, actualizar de inmediato la sesión local
  const activeUser = getActiveUser();
  if (activeUser && (activeUser.id === savedUser.id || activeUser.username?.toLowerCase() === savedUser.username?.toLowerCase())) {
    localStorage.setItem(STORAGE_ACTIVE_USER_KEY, JSON.stringify(savedUser));
  }

  // Persistir en Supabase en segundo plano
  saveSupabaseUser(savedUser, activeUser).catch(err => {
    console.warn("No se pudo sincronizar usuario con Supabase de inmediato:", err);
  });

  return savedUser;
}

/**
 * Elimina un usuario por ID
 */
export function deleteUser(userId, auditUser = null) {
  const users = getUsersList();
  const userToDelete = users.find(u => u.id === userId);
  if (!userToDelete) return false;

  const normRoleToDelete = normalizeRole(userToDelete.rol);
  if (normRoleToDelete === 'ADMINISTRADOR MASTER' || userToDelete.username?.toLowerCase() === 'edson designer') {
    throw new Error("Acción bloqueada: No se puede eliminar al Administrador Master (Propietario del Sistema).");
  }

  if (normRoleToDelete === ROLES.GERENCIA) {
    const totalGerencia = users.filter(u => normalizeRole(u.rol) === ROLES.GERENCIA).length;
    if (totalGerencia <= 1) {
      throw new Error("Acción bloqueada: No se puede eliminar al único usuario con rol Gerencia del sistema.");
    }
  }

  const filtered = users.filter(u => u.id !== userId);
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(sortUsersByHierarchy(filtered)));

  // Sincronizar eliminación en Supabase
  deleteSupabaseUser(userId, auditUser || getActiveUser()).catch(err => {
    console.warn("No se pudo eliminar usuario en Supabase de inmediato:", err);
  });

  return true;
}

/**
 * Cambia la contraseña de un usuario
 */
export function changeUserPassword(userId, newPassword, auditUser = null) {
  const cleanPass = (newPassword || '').trim();
  if (cleanPass.length < 4) {
    throw new Error("La nueva contraseña debe tener al menos 4 caracteres.");
  }

  const users = getUsersList();
  const exists = users.find(u => u.id === userId);
  if (!exists) {
    throw new Error("Usuario no encontrado.");
  }

  let updatedUserObj = null;
  const updated = users.map(u => {
    if (u.id === userId) {
      updatedUserObj = { ...u, password: cleanPass };
      return updatedUserObj;
    }
    return u;
  });

  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updated));

  // Sincronizar con Supabase y registrar log de auditoría
  if (updatedUserObj) {
    saveSupabaseUser(updatedUserObj, auditUser || getActiveUser()).catch(() => {});
    logUserActivity({
      usuarioId: auditUser?.id || exists.id,
      usuarioNombre: auditUser?.nombre || exists.nombre,
      usuarioRol: auditUser?.rol || exists.rol,
      accion: 'CAMBIAR_PASSWORD',
      modulo: 'USUARIOS',
      detalles: `Cambio de contraseña para @${exists.username} (${exists.nombre})`
    }).catch(() => {});
  }

  return true;
}

/**
 * Sincroniza la lista de usuarios desde Supabase
 */
export async function syncUsersWithSupabase() {
  try {
    const remoteUsers = await getSupabaseUsers();
    if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
      // Filtrar usuario sysadmin si viniera de alguna caché antigua
      const cleanRemote = remoteUsers.filter(u => u.username?.toLowerCase() !== 'sysadmin' && u.id !== 'usr-sysadmin');
      const hasMasterAdmin = cleanRemote.some(u => normalizeRole(u.rol) === 'ADMINISTRADOR DEL SISTEMA' || u.username?.toLowerCase() === 'edson designer');
      let combined = cleanRemote;
      if (!hasMasterAdmin) {
        const masterDefault = DEFAULT_USERS.find(u => u.username?.toLowerCase() === 'edson designer' || u.id === 'usr-muq3bdll');
        if (masterDefault) {
          combined = [masterDefault, ...cleanRemote];
          saveSupabaseUser(masterDefault).catch(() => {});
        }
      }
      const sorted = sortUsersByHierarchy(combined);
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(sorted));
      return sorted;
    }
  } catch (err) {
    console.warn("No se pudo sincronizar usuarios con Supabase:", err);
  }
  return getUsersList();
}

/**
 * Valida credenciales e inicia sesión contra la lista dinámica
 */
export function authenticate(username, password) {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  const users = getUsersList();
  const user = users.find(u => 
    (u.username && u.username.toLowerCase() === cleanUser) ||
    (u.co_ven && u.co_ven.toLowerCase() === cleanUser) ||
    (u.coVen && u.coVen.toLowerCase() === cleanUser)
  );

  if (!user) {
    return { success: false, message: `Usuario "@${cleanUser}" no encontrado en el sistema.` };
  }

  if (user.activo === false || user.active === false) {
    return { success: false, message: 'Esta cuenta de usuario se encuentra suspendida o inactiva. Contacte al Administrador.' };
  }

  // Si la contraseña es explícitamente vacía (''), no requiere contraseña o se valida como cadena vacía
  const expectedPassword = user.password !== undefined ? user.password : '123456';
  if (expectedPassword && cleanPass !== expectedPassword) {
    return { success: false, message: 'Contraseña incorrecta. Verifique su clave de acceso.' };
  }

  const norm = normalizeRole(user.rol);
  const userToSave = {
    ...user,
    rol: norm,
    modulos: Array.isArray(user.modulos) && user.modulos.length > 0
      ? user.modulos
      : (ROLE_PERMISSIONS[norm] ? [...ROLE_PERMISSIONS[norm]] : ['ventas'])
  };

  try {
    localStorage.setItem(STORAGE_ACTIVE_USER_KEY, JSON.stringify(userToSave));
  } catch (err) {
    console.warn('No se pudo guardar la sesión en localStorage:', err);
  }

  // Registrar último acceso y auditoría en segundo plano
  updateUserLastAccess(userToSave.id).catch(() => {});
  logUserActivity({
    usuarioId: userToSave.id,
    usuarioNombre: userToSave.nombre,
    usuarioRol: userToSave.rol,
    accion: 'LOGIN',
    modulo: 'SEGURIDAD',
    detalles: `Inicio de sesión exitoso en el sistema con rol ${userToSave.rol}`
  }).catch(() => {});

  return { success: true, user: userToSave };
}

/**
 * Obtiene el usuario autenticado actualmente desde localStorage (o null)
 */
export function getActiveUser() {
  try {
    const data = localStorage.getItem(STORAGE_ACTIVE_USER_KEY);
    if (!data) return null;
    const user = JSON.parse(data);
    if (user) {
      const norm = normalizeRole(user.rol);
      user.rol = norm;
      if (!Array.isArray(user.modulos) || user.modulos.length === 0) {
        user.modulos = ROLE_PERMISSIONS[norm] ? [...ROLE_PERMISSIONS[norm]] : ['ventas'];
      }
    }
    return user;
  } catch (err) {
    console.error('Error leyendo usuario activo:', err);
    return null;
  }
}

/**
 * Cierra la sesión activa
 */
export function logout() {
  const activeUser = getActiveUser();
  if (activeUser) {
    logUserActivity({
      usuarioId: activeUser.id,
      usuarioNombre: activeUser.nombre,
      usuarioRol: activeUser.rol,
      accion: 'LOGOUT',
      modulo: 'SEGURIDAD',
      detalles: `Cierre de sesión de @${activeUser.username}`
    }).catch(() => {});
  }
  try {
    localStorage.removeItem(STORAGE_ACTIVE_USER_KEY);
  } catch (err) {
    console.warn('Error eliminando sesión:', err);
  }
}

/**
 * Verifica si un rol tiene acceso a un módulo específico
 * ADMINISTRADOR MASTER (Edson Designer) cuenta con acceso total absoluto e incondicional a todos los módulos.
 * GERENCIA cuenta con acceso ejecutivo.
 * Los demás roles se restringen a sus permisos configurados.
 */
export function canAccessModule(role, moduleId, user = null) {
  if (!moduleId) return false;

  const effectiveRole = role || user?.rol;
  const username = (user?.username || '').toLowerCase();

  // El Administrador Master (Edson Designer) tiene acceso total incondicional
  if (username === 'edson designer') return true;

  if (!effectiveRole && !user) return false;

  const normRole = normalizeRole(effectiveRole);

  // 1. Administrador Master tiene acceso total
  if (normRole === 'ADMINISTRADOR MASTER') {
    return true;
  }

  // 2. Gerencia tiene acceso total ejecutivo
  if (normRole === 'GERENCIA') {
    return true;
  }

  // 3. Si el usuario cuenta con una lista personalizada de módulos asignados en su perfil
  if (user && Array.isArray(user.modulos) && user.modulos.length > 0) {
    if (user.modulos.includes(moduleId)) return true;
    if (moduleId === 'preventa' && (user.modulos.includes('pedidos') || user.modulos.includes('ventas'))) {
      return (ROLE_PERMISSIONS[normRole] || []).includes('preventa');
    }
    return false;
  }

  // 4. Permisos predeterminados asignados al rol institucional
  const allowed = ROLE_PERMISSIONS[normRole] || [];
  return allowed.includes(moduleId);
}

/**
 * Indica si el rol puede ver los costos de adquisición y márgenes (ADMINISTRADOR MASTER, GERENCIA, ADMINISTRACIÓN, COMPRAS)
 */
export function canViewCosts(role) {
  const r = normalizeRole(role);
  return r === 'ADMINISTRADOR MASTER' || r === 'GERENCIA' || r === 'ADMINISTRACIÓN' || r === 'COMPRAS';
}

/**
 * Indica si el rol puede alterar o crear productos en inventario
 */
export function canManageProducts(role) {
  const r = normalizeRole(role);
  return r === 'ADMINISTRADOR MASTER' || r === 'GERENCIA' || r === 'ADMINISTRACIÓN' || r === 'ALMACEN' || r === 'COMPRAS';
}

/**
 * Indica si el rol puede cambiar las tasas de cambio oficiales (ADMINISTRADOR MASTER, GERENCIA, ADMINISTRACIÓN, TI o usuarios con acceso a configuración)
 */
export function canModifyRates(role, user = null) {
  const r = normalizeRole(role || user?.rol);
  if (user && canAccessModule(r, 'configuracion', user)) return true;
  return r === 'ADMINISTRADOR MASTER' || r === 'GERENCIA' || r === 'ADMINISTRACIÓN' || r === 'TECNOLOGÍA & INFORMÁTICA';
}

/**
 * Indica si el usuario/rol es Administrador Master o Gerencia
 */
export function isMasterOrGerencia(userOrRole) {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'object' ? userOrRole?.rol : userOrRole;
  const username = typeof userOrRole === 'object' ? userOrRole?.username : null;
  const r = normalizeRole(role);
  if (r === 'ADMINISTRADOR MASTER' || r === 'GERENCIA' || r === 'TECNOLOGÍA & INFORMÁTICA') return true;
  if (username && (username.toLowerCase() === 'edson designer' || username.toLowerCase() === 'gerencia' || username.toLowerCase() === 'sistemas' || username.toLowerCase() === 'manuel')) return true;
  return false;
}

/**
 * Indica si el usuario o rol es de forma estricta y exclusiva Administrador Master
 */
export function isMasterAdmin(userOrRole) {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'object' ? userOrRole?.rol : userOrRole;
  const username = typeof userOrRole === 'object' ? userOrRole?.username : null;
  const r = normalizeRole(role);
  if (r === 'ADMINISTRADOR MASTER') return true;
  if (username && username.toLowerCase() === 'edson designer') return true;
  return false;
}

/**
 * Indica si el usuario puede aprobar solicitudes de nuevos clientes o registrarlos directamente en oficina.
 * Autorizados:
 * - Caja Principal (Vanesa Sánchez, rol CAJA / username 'caja')
 * - Cobranzas (Rosibel Briceño, rol COBRANZA / username 'rosibelcxc' — excluye 'rosibelventas')
 * - Supervisor Comercial de Ventas (Yheyson Calderón, username 'ventas' / co_ven 'YC')
 * - Tecnología & Informática (Manuel Rosales, rol TI / username 'manuel')
 * - Administrador Master (Edson Designer), Gerencia y Administración
 */
export function canApproveClients(userOrRole) {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'object' ? userOrRole?.rol : userOrRole;
  const username = String(typeof userOrRole === 'object' ? (userOrRole?.username || '') : '').trim().toLowerCase();
  const nombre = String(typeof userOrRole === 'object' ? (userOrRole?.nombre || userOrRole?.name || '') : '').trim().toLowerCase();
  const coVen = String(typeof userOrRole === 'object' ? (userOrRole?.co_ven || userOrRole?.coVen || '') : '').trim().toUpperCase();
  const r = normalizeRole(role);

  if (
    r === 'ADMINISTRADOR MASTER' ||
    r === 'TECNOLOGÍA & INFORMÁTICA' ||
    r === 'GERENCIA' ||
    r === 'ADMINISTRACIÓN' ||
    r === 'CAJA' ||
    r === 'COBRANZA'
  ) {
    return true;
  }

  // Usuarios específicos autorizados (Edson, Manuel, Vanessa, Rosibel en cobranzas, Yheyson Calderón)
  if (
    username === 'edson designer' ||
    username === 'manuel' ||
    username === 'caja' ||
    username === 'rosibelcxc' ||
    username === 'ventas' ||
    coVen === 'YC' ||
    nombre.includes('yheyson')
  ) {
    return true;
  }

  return false;
}

/**
 * Normaliza el estado de aprobación de un cliente ('PENDIENTE' | 'APROBADO' | 'RECHAZADO').
 * Los clientes históricos sin campo explícito se consideran 'APROBADO'.
 */
export function getClientApprovalStatus(client) {
  if (!client) return 'APROBADO';
  const raw = String(client.estadoAprobacion || client.estado_aprobacion || '').trim().toUpperCase();
  if (raw === 'PENDIENTE' || raw === 'RECHAZADO' || raw === 'APROBADO') {
    return raw;
  }
  return 'APROBADO';
}

/**
 * Indica si el cliente ya fue aprobado y está habilitado para pedidos/facturación.
 */
export function isClientApproved(client) {
  if (!client) return false;
  return getClientApprovalStatus(client) === 'APROBADO';
}

/**
 * Indica si el usuario o rol puede editar y eliminar documentos en el listado de facturas.
 * Autorizados: Administrador Master, Gerencia, Administración, Tecnología & Informática (TI)
 * y Caja Principal (Vanesa Sánchez, id 'usr-caja' / username 'caja').
 */
export function canManageInvoices(userOrRole) {
  if (!userOrRole) return false;
  if (isMasterOrGerencia(userOrRole)) return true;

  const isObj = typeof userOrRole === 'object';
  const role = isObj ? (userOrRole.rol || userOrRole.role || '') : userOrRole;
  const r = normalizeRole(role);
  if (
    r === 'ADMINISTRADOR MASTER' ||
    r === 'GERENCIA' ||
    r === 'ADMINISTRACIÓN' ||
    r === 'TECNOLOGÍA & INFORMÁTICA'
  ) {
    return true;
  }

  if (!isObj) return false;
  const id = String(userOrRole.id || '').trim().toLowerCase();
  const username = String(userOrRole.username || userOrRole.usuario || '').trim().toLowerCase();
  const normNombre = String(userOrRole.nombre || userOrRole.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (
    id === 'usr-caja' ||
    username === 'edson designer' ||
    username === 'manuel' ||
    username === 'gerencia' ||
    username === 'admin' ||
    username === 'caja' ||
    normNombre === 'vanesa sanchez' ||
    normNombre === 'vanessa sanchez'
  ) {
    return true;
  }

  return false;
}



