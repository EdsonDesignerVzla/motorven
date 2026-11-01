import sql from 'mssql';
import { config } from './config.js';

async function inspectSpecial() {
  const pool = await sql.connect(config.sql);

  // 1. Pistas de auditoria
  const pistas = await pool.request().query('SELECT TOP 5 * FROM pistas ORDER BY fecha DESC');
  console.log('--- PISTAS DE AUDITORIA PROFIT ---');
  console.table(pistas.recordset);

  // 2. Devoluciones de clientes (Notas de credito)
  const devCli = await pool.request().query('SELECT TOP 5 * FROM dev_cli ORDER BY fec_emis DESC');
  console.log('--- DEVOLUCIONES CLIENTES (NOTAS CREDITO) ---');
  console.table(devCli.recordset);

  // 3. Ajustes de inventario
  const ajustes = await pool.request().query('SELECT TOP 5 * FROM ajuste ORDER BY fecha DESC');
  console.log('--- AJUSTES DE INVENTARIO ---');
  console.table(ajustes.recordset);

  // 4. Ordenes de pago tesoreria
  const ordPago = await pool.request().query('SELECT TOP 5 * FROM ord_pago ORDER BY fecha DESC');
  console.log('--- ORDENES DE PAGO TESORERIA ---');
  console.table(ordPago.recordset);

  // 5. Zonas y Transportistas
  const zonas = await pool.request().query('SELECT * FROM zona');
  console.log('--- ZONAS GEOGRAFICAS ---');
  console.table(zonas.recordset);

  const transpor = await pool.request().query('SELECT * FROM transpor');
  console.log('--- TRANSPORTISTAS ---');
  console.table(transpor.recordset);

  pool.close();
}

inspectSpecial().catch(console.error);
