import assert from 'node:assert';
import {
  ROLES,
  ROLE_DEFINITIONS,
  ROLE_HIERARCHY,
  normalizeRole,
  getRoleMeta,
  canAccessModule,
  canViewCosts,
  canManageProducts,
  canModifyRates,
  sortUsersByHierarchy,
  DEFAULT_USERS,
  ROLE_PERMISSIONS,
  DEFAULT_TABS_BY_ROLE,
  SYSTEM_MODULES
} from '../services/authService.js';

console.log('--- INICIANDO VERIFICACION DE ROLES: ADMINISTRADOR MASTER Y TI ---');

// 1. Constantes y Normalizacion
console.log('1. Verificando constantes y normalizacion...');
assert.strictEqual(ROLES.MASTER, 'ADMINISTRADOR MASTER');
assert.strictEqual(ROLES.ADMIN_SISTEMA, 'TECNOLOGÍA & INFORMÁTICA');
assert.strictEqual(ROLES.SYSADMIN, 'TECNOLOGÍA & INFORMÁTICA');
assert.strictEqual(normalizeRole('ADMINISTRADOR MASTER'), 'ADMINISTRADOR MASTER');
assert.strictEqual(normalizeRole('ADMIN_MASTER'), 'ADMINISTRADOR MASTER');
assert.strictEqual(normalizeRole('TECNOLOGÍA & INFORMÁTICA'), 'TECNOLOGÍA & INFORMÁTICA');
assert.strictEqual(normalizeRole('TI'), 'TECNOLOGÍA & INFORMÁTICA');
assert.strictEqual(normalizeRole('sysadmin'), 'TECNOLOGÍA & INFORMÁTICA');
console.log('  OK Normalizacion de roles superada.');

// 2. Metadatos de Rol y Jerarquia
console.log('2. Verificando jerarquia y metadatos...');
const masterMeta = getRoleMeta('ADMINISTRADOR MASTER');
assert.strictEqual(masterMeta.id, 'ADMINISTRADOR MASTER');
assert.strictEqual(masterMeta.hierarchy, 1);
assert.strictEqual(ROLE_HIERARCHY['ADMINISTRADOR MASTER'], 1);

const tiMeta = getRoleMeta('TECNOLOGÍA & INFORMÁTICA');
assert.strictEqual(tiMeta.id, 'TECNOLOGÍA & INFORMÁTICA');
assert.strictEqual(tiMeta.hierarchy, 2);
assert.strictEqual(ROLE_HIERARCHY['TECNOLOGÍA & INFORMÁTICA'], 2);

assert.ok(ROLE_HIERARCHY['ADMINISTRADOR MASTER'] < ROLE_HIERARCHY['TECNOLOGÍA & INFORMÁTICA'], 'Master debe estar en rango 1');
assert.ok(ROLE_HIERARCHY['TECNOLOGÍA & INFORMÁTICA'] < ROLE_HIERARCHY['GERENCIA'], 'TI debe estar por encima de Gerencia');
console.log('  OK Jerarquias numero 1 y 2 confirmadas.');

// 3. Control Total de Modulos para Administrador Master
console.log('3. Verificando acceso incondicional de Master a todos los modulos...');
SYSTEM_MODULES.forEach(mod => {
  const hasAccess = canAccessModule('ADMINISTRADOR MASTER', mod.id);
  assert.strictEqual(hasAccess, true, 'Master debe tener acceso total a ' + mod.id);
});
console.log('  OK Control total de Master en todos los modulos verificado.');

// 4. Permisos de Costos, Productos y Tasas Oficiales
console.log('4. Verificando privilegios operacionales y financieros...');
assert.strictEqual(canViewCosts('ADMINISTRADOR MASTER'), true, 'Master debe poder visualizar costos');
assert.strictEqual(canManageProducts('ADMINISTRADOR MASTER'), true, 'Master debe poder alterar productos');
assert.strictEqual(canModifyRates('ADMINISTRADOR MASTER'), true, 'Master debe poder alterar tasas oficiales');
console.log('  OK Privilegios financieros y de catalogo confirmados.');

// 5. Ordenamiento en Lista de Usuarios
console.log('5. Verificando orden institucional de usuarios...');
const mockList = [
  { nombre: 'Vendedor 1', rol: 'VENTAS' },
  { nombre: 'Almacen 1', rol: 'ALMACEN' },
  { nombre: 'TI Admin', rol: 'TECNOLOGÍA & INFORMÁTICA' },
  { nombre: 'Master Owner', rol: 'ADMINISTRADOR MASTER' },
  { nombre: 'Gerente General', rol: 'GERENCIA' },
  { nombre: 'Admin Finanzas', rol: 'ADMINISTRACIÓN' }
];
const sorted = sortUsersByHierarchy(mockList);
assert.strictEqual(sorted[0].rol, 'ADMINISTRADOR MASTER', 'Administrador Master debe encabezar el listado');
assert.strictEqual(sorted[1].rol, 'TECNOLOGÍA & INFORMÁTICA', 'TI debe ser el segundo nivel');
assert.strictEqual(sorted[2].rol, 'GERENCIA', 'Gerencia debe ser el tercer nivel');
console.log('  OK Ordenamiento por jerarquia superado.');

// 6. Configuracion de Usuario por Defecto
console.log('6. Verificando usuario por defecto...');
const defaultAdminMaster = DEFAULT_USERS.find(u => u.username === 'edson designer' || normalizeRole(u.rol) === 'ADMINISTRADOR MASTER');
assert.ok(defaultAdminMaster, 'Debe existir el usuario por defecto Administrador Master (edson designer)');
assert.strictEqual(defaultAdminMaster.rol, 'ADMINISTRADOR MASTER');
assert.strictEqual(DEFAULT_TABS_BY_ROLE['ADMINISTRADOR MASTER'], 'dashboard');
assert.strictEqual(ROLE_PERMISSIONS['ADMINISTRADOR MASTER'].length, SYSTEM_MODULES.length);
console.log('  OK Usuario por defecto Administrador Master configurado correctamente.');

console.log('\n================================================================');
console.log('--- ROLES ADMINISTRADOR MASTER Y TI COMPLETAMENTE FUNCIONALES (100% OK) ---');
console.log('================================================================\n');
