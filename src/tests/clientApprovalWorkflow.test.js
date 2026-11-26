import assert from 'node:assert';
import {
  canApproveClients,
  getClientApprovalStatus,
  isClientApproved
} from '../services/authService.js';
import {
  SENIAT_CONTRIBUTOR_TYPES,
  resolveClientContributorType,
  applyContributorPrefixToRif,
  computeContributorTypeCounts,
  validateDocumentNumber
} from '../services/fiscalService.js';
import { getClients, saveClient, deleteClient } from '../services/storageService.js';

console.log('--- INICIANDO PRUEBA DE FLUJO DE REGISTRO Y APROBACION DE CLIENTES ---');

// 1. Verificar usuarios con acceso a Flujo Comercial ('pedidos') autorizados para aprobar clientes
console.log('1. Verificando aprobadores autorizados...');
const authorizedApprovers = [
  { username: 'caja', rol: 'CAJA', nombre: 'Vanesa Sánchez' },
  { username: 'rosibelcxc', rol: 'COBRANZA', nombre: 'Rosibel Briceño' },
  { username: 'ventas', rol: 'VENTAS', nombre: 'Yheyson Calderón', co_ven: 'YC', modulos: ['preventa', 'pedidos'] },
  { username: 'yheisom', rol: 'VENTAS', nombre: 'Yheisom Calderon', modulos: ['preventa', 'pedidos'] },
  { username: 'luiggys', rol: 'OPERACIONES', nombre: 'Luiggy Silva', modulos: ['pedidos', 'dashboard'] },
  { username: 'edson designer', rol: 'ADMINISTRADOR MASTER', nombre: 'Edson' },
  { username: 'gerencia', rol: 'GERENCIA', nombre: 'Gerencia General' },
  { username: 'admin', rol: 'ADMINISTRACIÓN', nombre: 'Administración' }
];

authorizedApprovers.forEach((u) => {
  assert.strictEqual(
    canApproveClients(u),
    true,
    `El usuario ${u.username} (${u.rol}) debe poder aprobar clientes y registrar en oficina`
  );
});

// 2. Verificar usuarios sin acceso a Flujo Comercial ('pedidos') no pueden aprobar clientes
console.log('2. Verificando restricciones para vendedores y otros roles sin Flujo Comercial...');
const nonApprovers = [
  { username: 'rosibelventas', rol: 'VENTAS', nombre: 'Rosibel Ventas', co_ven: '01', modulos: ['preventa', 'ventas', 'cxc'] },
  { username: 'victorv', rol: 'VENTAS', nombre: 'Victor V', co_ven: '02', modulos: ['preventa', 'ventas'] },
  { username: 'carlosm', rol: 'VENTAS', nombre: 'Carlos M', co_ven: '03', modulos: ['preventa'] },
  { username: 'juanr', rol: 'VENTAS', nombre: 'Juan R', co_ven: '04', modulos: ['preventa'] },
  { username: 'katherineb', rol: 'VENTAS', nombre: 'Katherine B', co_ven: '05', modulos: ['preventa'] },
  { username: 'oficina', rol: 'VENTAS', nombre: 'Oficina Ventas', co_ven: 'OF', modulos: ['preventa', 'ventas'] },
  { username: 'rayalm', rol: 'ALMACEN', nombre: 'Ray Almacen', modulos: ['inventario', 'compras'] },
  { username: 'manuel', rol: 'TECNOLOGÍA & INFORMÁTICA', nombre: 'Manuel Rosales', modulos: ['dashboard', 'configuracion'] },
  null
];

nonApprovers.forEach((u) => {
  assert.strictEqual(
    canApproveClients(u),
    false,
    `El usuario ${u?.username || 'null'} NO debe poder aprobar clientes`
  );
});

// 3. Estados de aprobación de clientes (PENDIENTE, APROBADO, RECHAZADO, histórico)
console.log('3. Verificando estados de aprobación...');
assert.strictEqual(getClientApprovalStatus({ id: 'CLI-OLD', nombre: 'Cliente Histórico' }), 'APROBADO');
assert.strictEqual(isClientApproved({ id: 'CLI-OLD', nombre: 'Cliente Histórico' }), true);

assert.strictEqual(
  getClientApprovalStatus({ id: 'SOL-1', estadoAprobacion: 'PENDIENTE', inactivo: true }),
  'PENDIENTE'
);
assert.strictEqual(
  isClientApproved({ id: 'SOL-1', estadoAprobacion: 'PENDIENTE', inactivo: true }),
  false
);

assert.strictEqual(
  getClientApprovalStatus({ id: 'SOL-2', estado_aprobacion: 'RECHAZADO', inactivo: true }),
  'RECHAZADO'
);
assert.strictEqual(
  isClientApproved({ id: 'SOL-2', estado_aprobacion: 'RECHAZADO', inactivo: true }),
  false
);

assert.strictEqual(
  getClientApprovalStatus({ id: 'SOL-3', estadoAprobacion: 'APROBADO', inactivo: false }),
  'APROBADO'
);
assert.strictEqual(
  isClientApproved({ id: 'SOL-3', estadoAprobacion: 'APROBADO', inactivo: false }),
  true
);

// 4. Persistencia local en storageService preservando ID personalizado y actualizando al aprobar
console.log('4. Verificando saveClient en storageService...');
const customId = 'CLI-TEST-APPR-001';
const sampleDocImg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
const sampleLocalImg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';
saveClient({
  id: customId,
  codigo: customId,
  nombre: 'AUTO REPUESTOS PRUEBA C.A.',
  tipoPersona: 'J',
  rif: 'J-50123456-7',
  imagenDocumento: sampleDocImg,
  imagenLocal: sampleLocalImg,
  estadoAprobacion: 'PENDIENTE',
  solicitadoPor: 'Victor V',
  solicitadoPorUsername: 'victorv',
  inactivo: true
});

let stored = getClients().filter(c => c.id === customId);
assert.strictEqual(stored.length, 1, 'Debe guardar 1 registro con su ID personalizado');
assert.strictEqual(getClientApprovalStatus(stored[0]), 'PENDIENTE');
assert.strictEqual(isClientApproved(stored[0]), false);
assert.strictEqual(stored[0].imagenDocumento, sampleDocImg);
assert.strictEqual(stored[0].imagenLocal, sampleLocalImg);

saveClient({
  id: customId,
  codigo: customId,
  estadoAprobacion: 'APROBADO',
  aprobadoPor: 'Vanesa Sánchez',
  aprobadoPorUsername: 'caja',
  inactivo: false
});

stored = getClients().filter(c => c.id === customId);
assert.strictEqual(stored.length, 1, 'La aprobación debe actualizar el mismo cliente sin duplicarlo');
assert.strictEqual(getClientApprovalStatus(stored[0]), 'APROBADO');
assert.strictEqual(isClientApproved(stored[0]), true);
assert.strictEqual(stored[0].aprobadoPorUsername, 'caja');
assert.strictEqual(stored[0].imagenDocumento, sampleDocImg);
assert.strictEqual(stored[0].imagenLocal, sampleLocalImg);

// 5. Clasificación SENIAT de clientes nuevos (J, V, E, G, P) y prefijo en RIF / Cédula
console.log('5. Verificando clasificación SENIAT de contribuyentes (J, V, E, G, P)...');
assert.strictEqual(SENIAT_CONTRIBUTOR_TYPES.length, 5);
assert.strictEqual(applyContributorPrefixToRif('12345678', 'V'), 'V-12345678');
assert.strictEqual(applyContributorPrefixToRif('J-12345678-9', 'G'), 'G-12345678-9');
assert.strictEqual(applyContributorPrefixToRif('31115365-9', 'P'), 'P-31115365-9');

assert.strictEqual(resolveClientContributorType({ tipoPersona: 'V', rif: 'V-19876543' }), 'V');
assert.strictEqual(resolveClientContributorType({ tipoPersona: 'E', rif: 'E-81234567' }), 'E');
assert.strictEqual(resolveClientContributorType({ tipoPersona: 'G', rif: 'G-20000123-4' }), 'G');
assert.strictEqual(resolveClientContributorType({ tipoPersona: 'P', rif: 'P-90123456-7' }), 'P');
assert.strictEqual(resolveClientContributorType({ rif: 'J-31115365-9' }), 'J');

const counts = computeContributorTypeCounts([
  { id: '1', tipoPersona: 'J', rif: 'J-31115365-9' },
  { id: '2', tipoPersona: 'V', rif: 'V-19876543' },
  { id: '3', tipoPersona: 'E', rif: 'E-81234567' },
  { id: '4', tipoPersona: 'G', rif: 'G-20000123-4' },
  { id: '5', tipoPersona: 'P', rif: 'P-90123456-7' }
]);
assert.deepStrictEqual(counts, { J: 1, V: 1, E: 1, G: 1, P: 1 });

assert.strictEqual(validateDocumentNumber('V-19876543', 'V').isValid, true);
assert.strictEqual(validateDocumentNumber('E-81234567', 'E').isValid, true);
assert.strictEqual(validateDocumentNumber('J-31115365-9', 'J').isValid, true);

// 6. Modificación, activación/inactivación y eliminación limpia de clientes
console.log('6. Verificando modificación y eliminación en cartera de clientes...');
saveClient({
  id: customId,
  codigo: customId,
  nombre: 'Lubricantes Test Aprobado C.A. (Editado)',
  limiteCreditoUsd: 2500,
  diasCredito: 15,
  inactivo: true
});
stored = getClients().filter(c => c.id === customId);
assert.strictEqual(stored[0].nombre, 'Lubricantes Test Aprobado C.A. (Editado)');
assert.strictEqual(stored[0].limiteCreditoUsd, 2500);
assert.strictEqual(stored[0].inactivo, true);

deleteClient(customId);
stored = getClients().filter(c => c.id === customId || c.codigo === customId);
assert.strictEqual(stored.length, 0, 'deleteClient debe eliminar el cliente de almacenamiento local');

console.log('OK: TODAS LAS VERIFICACIONES DEL FLUJO DE APROBACIÓN Y CLASIFICACIÓN DE CLIENTES PASARON.');
