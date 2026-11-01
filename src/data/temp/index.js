/**
 * Archivo índice del directorio temporal de usuarios
 * Permite acceso offline garantizado a todos los usuarios del sistema SIGNUM MOTORVEN
 * incluso si Supabase está desconectada, caída o sin conexión a internet.
 */
import tempUsersData from './users.json' with { type: 'json' };

export const TEMPORARY_USERS = tempUsersData;
export default tempUsersData;
