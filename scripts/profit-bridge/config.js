/**
 * Configuración para el conector Profit Plus 2K8 (SQL Server) ↔ Supabase / SIGNUM MOTORVEN
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const config = {
  sql: {
    server: process.env.PROFIT_SQL_SERVER || '26.229.220.202',
    remoteServerIp: process.env.PROFIT_REMOTE_IP || '26.229.220.202',
    port: parseInt(process.env.PROFIT_SQL_PORT || '1433', 10),
    user: process.env.PROFIT_SQL_USER || 'signum_bridge',
    password: process.env.PROFIT_SQL_PASSWORD || 'Signum2026*',
    database: process.env.PROFIT_SQL_DATABASE || 'GRUMOTOR',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      cryptoCredentialsDetails: {
        minVersion: 'TLSv1',
        rejectUnauthorized: false
      },
      connectTimeout: 15000,
      requestTimeout: 30000
    }
  },
  supabase: {
    url: process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || 'local-free-token'
  }
};

