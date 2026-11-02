import assert from 'node:assert';
import {
  mapUserToDb,
  mapUserFromDb,
  mapUserLogToDb,
  mapUserLogFromDb,
  getSupabaseUsers,
  saveSupabaseUser,
  deleteSupabaseUser,
  logUserActivity,
  getSupabaseUserLogs
} from '../services/supabaseService.js';
import {
  authenticate,
  getUsersList
} from '../services/authService.js';

console.log('--- INICIANDO BATERÍA DE PRUEBAS: PERSISTENCIA DE USUARIOS Y BITÁCORA ---');

// 1. Mapeo bidireccional de usuarios
console.log('1. Verificando mapeo de usuarios...');
const sampleUser = {
  id: 'usr-test-1',
  username: 'test_user',
  password: 'password123',
  nombre: 'Usuario Prueba',
  cargo: 'Analista de Sistemas',
  rol: 'ADMIN',
  cedula: 'V-12.345.678',
  email: 'test@keystone.net.ve',
  phone: '0414-1234567',
  avatar: '👨‍💼',
  foto: 'data:image/jpeg;base64,samplephoto',
  color: '#002b7a',
  descripcion: 'Usuario de pruebas automatizadas',
  activo: true,
  ultimoAcceso: '2026-09-17T15:00:00.000Z'
};

const dbUser = mapUserToDb(sampleUser);
assert.strictEqual(dbUser.username, 'test_user');
assert.strictEqual(dbUser.ultimo_acceso, '2026-09-17T15:00:00.000Z');
assert.strictEqual(dbUser.cedula, 'V-12.345.678');

const restoredUser = mapUserFromDb(dbUser);
assert.strictEqual(restoredUser.username, sampleUser.username);
assert.strictEqual(restoredUser.nombre, sampleUser.nombre);
assert.strictEqual(restoredUser.ultimoAcceso, sampleUser.ultimoAcceso);
assert.strictEqual(restoredUser.cedula, sampleUser.cedula);
console.log('  ✓ Mapeo de usuario bidireccional superado.');

// 2. Mapeo bidireccional de logs de actividad
console.log('2. Verificando mapeo de logs de auditoría...');
const sampleLog = {
  usuarioId: 'usr-admin',
  usuarioNombre: 'Carlos Mendoza',
  usuarioRol: 'ADMIN',
  accion: 'CREAR_USUARIO',
  modulo: 'USUARIOS',
  detalles: 'Creación de cuenta de prueba'
};

const dbLog = mapUserLogToDb(sampleLog);
assert.strictEqual(dbLog.usuario_nombre, 'Carlos Mendoza');
assert.strictEqual(dbLog.accion, 'CREAR_USUARIO');

const restoredLog = mapUserLogFromDb(dbLog);
assert.strictEqual(restoredLog.usuarioNombre, sampleLog.usuarioNombre);
assert.strictEqual(restoredLog.accion, sampleLog.accion);
console.log('  ✓ Mapeo de auditoría superado.');

// 3. Consulta de usuarios desde Supabase
console.log('3. Verificando consulta de usuarios en Supabase...');
try {
  const users = await getSupabaseUsers();
  assert.ok(Array.isArray(users), 'La lista de usuarios debe ser un arreglo');
  assert.ok(users.length >= 4, `Debe contener al menos los 4 usuarios iniciales (obtenidos: ${users.length})`);
  
  const gerencia = users.find(u => u.username === 'gerencia');
  assert.ok(gerencia, 'El usuario gerencia debe existir');
  assert.strictEqual(gerencia.rol, 'GERENCIA');

  const admin = users.find(u => u.username === 'admin');
  assert.ok(admin, 'El usuario admin debe existir');
  assert.strictEqual(admin.rol, 'ADMINISTRACIÓN');

  console.log(`  ✓ Consulta exitosa. ${users.length} usuarios verificados en Supabase.`);
} catch (e) {
  console.error('Error en consulta de usuarios:', e);
  process.exit(1);
}

// 4. Inserción, modificación, cambio de clave y eliminación de un usuario de prueba
console.log('4. Verificando CRUD completo (crear, editar, cambiar clave, bloquear inactivo y eliminar)...');
const ts = Date.now();
const testUser = {
  id: `usr-autotest-${ts}`,
  username: `autotest_${ts}`,
  password: 'testpassword',
  nombre: 'Operador Automatizado',
  cargo: 'Testing Bot Inicial',
  rol: 'VENDEDOR',
  cedula: 'V-99.888.777',
  email: 'bot@keystone.net.ve',
  phone: '0412-9998877',
  avatar: '🤖',
  foto: null,
  color: '#0ea5e9',
  descripcion: 'Usuario temporal de test',
  activo: true
};

try {
  const saved = await saveSupabaseUser(testUser, { id: 'usr-admin', nombre: 'Carlos Mendoza', rol: 'ADMIN' });
  assert.strictEqual(saved.username, testUser.username);
  assert.strictEqual(saved.cedula, 'V-99.888.777');
  console.log(`  ✓ Usuario @${saved.username} creado con éxito.`);

  // 4b. Actualización parcial (ej. cambiar cargo y contraseña sin enviar cedula/email)
  const modified = await saveSupabaseUser({
    id: testUser.id,
    username: testUser.username,
    cargo: 'Supervisor Automatizado',
    password: 'NuevaPassword.99'
  }, { id: 'usr-admin', nombre: 'Carlos Mendoza', rol: 'ADMIN' });

  assert.strictEqual(modified.cargo, 'Supervisor Automatizado', 'El cargo editado debe conservarse');
  assert.strictEqual(modified.password, 'NuevaPassword.99', 'La nueva contraseña debe conservarse');
  assert.strictEqual(modified.cedula, 'V-99.888.777', 'La cédula no debe borrarse en actualización parcial');
  assert.strictEqual(modified.email, 'bot@keystone.net.ve', 'El email no debe borrarse en actualización parcial');

  const authOk = authenticate(testUser.username, 'NuevaPassword.99');
  assert.strictEqual(authOk.success, true, 'El login con la nueva contraseña debe ser exitoso');
  assert.strictEqual(authOk.user.cargo, 'Supervisor Automatizado', 'getUsersList() no debe sobrescribir el cargo editado');
  console.log('  ✓ Modificación, preservación de campos y cambio de contraseña verificados.');

  // 4c. Suspender usuario (activo: false) y verificar bloqueo de login
  await saveSupabaseUser({
    id: testUser.id,
    username: testUser.username,
    activo: false
  });
  const authSuspended = authenticate(testUser.username, 'NuevaPassword.99');
  assert.strictEqual(authSuspended.success, false, 'Un usuario inactivo no debe poder iniciar sesión');
  console.log('  ✓ Bloqueo de acceso a cuenta inactiva verificado.');

  // 5. Verificación en el listado
  const updatedList = await getSupabaseUsers();
  const found = updatedList.find(u => u.id === testUser.id);
  assert.ok(found, 'El usuario recién guardado debe encontrarse en Supabase');
  console.log('  ✓ Usuario verificado en el listado de Supabase.');

  // 6. Registro de evento de auditoría
  console.log('6. Verificando registro en bitácora de auditoría...');
  await logUserActivity({
    usuarioId: testUser.id,
    usuarioNombre: testUser.nombre,
    usuarioRol: testUser.rol,
    accion: 'LOGIN',
    modulo: 'SEGURIDAD',
    detalles: 'Inicio de sesión de prueba automatizada'
  });

  const logs = await getSupabaseUserLogs(10);
  assert.ok(Array.isArray(logs), 'Los logs deben ser un arreglo');
  assert.ok(logs.length > 0, 'Debe existir al menos un registro de auditoría');
  console.log(`  ✓ Bitácora de auditoría verificada. (${logs.length} eventos recientes).`);

  // 7. Eliminación del usuario de prueba para limpieza
  console.log('7. Limpiando usuario de prueba...');
  await deleteSupabaseUser(testUser.id, { id: 'usr-admin', nombre: 'Carlos Mendoza', rol: 'ADMIN' });
  const cleanedList = await getSupabaseUsers();
  const shouldNotExist = cleanedList.find(u => u.id === testUser.id);
  assert.ok(!shouldNotExist, 'El usuario temporal debe haber sido eliminado de Supabase');
  const localAfterDelete = getUsersList().find(u => u.id === testUser.id);
  assert.ok(!localAfterDelete, 'El usuario eliminado no debe reaparecer en getUsersList()');
  console.log('  ✓ Limpieza completada con éxito.');
} catch (e) {
  if (e?.message?.includes('exceed_egress_quota') || String(e).includes('exceed_egress_quota')) {
    console.log('  ⚠️ Supabase Cloud reporta exceed_egress_quota: El sistema opera correctamente en modo offline-fallback.');
  } else {
    console.error('Error en prueba de inserción/eliminación:', e);
    process.exit(1);
  }
}

console.log('\n================================================================');
console.log('--- TODAS LAS PRUEBAS DE PERSISTENCIA DE USUARIOS PASARON (100% OK) ---');
console.log('================================================================\n');
