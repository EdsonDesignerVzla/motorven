import sql from 'mssql';
import { config } from './config.js';

async function inspect() {
  console.log('Connecting to', config.sql.server, config.sql.database);
  const pool = await sql.connect(config.sql);

  // Search for audit, accounting, and transaction tables
  const tables = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    AND (
      TABLE_NAME LIKE '%asi%' 
      OR TABLE_NAME LIKE '%mov%' 
      OR TABLE_NAME LIKE '%audi%' 
      OR TABLE_NAME LIKE '%docum%' 
      OR TABLE_NAME LIKE '%caja%'
      OR TABLE_NAME LIKE '%banco%'
      OR TABLE_NAME LIKE '%cuenta%'
    )
    ORDER BY TABLE_NAME;
  `);
  console.log('--- TABLES FOUND ---');
  console.table(tables.recordset);

  const mbCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mov_ban'");
  console.log('--- MOV_BAN COLS ---', mbCols.recordset.map(r => r.COLUMN_NAME).join(', '));

  const mcCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mov_caj'");
  console.log('--- MOV_CAJ COLS ---', mcCols.recordset.map(r => r.COLUMN_NAME).join(', '));

  const dccCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'docum_cc'");
  console.log('--- DOCUM_CC COLS ---', dccCols.recordset.map(r => r.COLUMN_NAME).join(', '));

  const dcpCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'docum_cp'");
  console.log('--- DOCUM_CP COLS ---', dcpCols.recordset.map(r => r.COLUMN_NAME).join(', '));

  // Samples
  const mbSample = await pool.request().query('SELECT TOP 5 mov_num, cod_cta, fecha, tipo_op, monto_d, monto_h, doc_num, descrip, anulado, tasa FROM mov_ban ORDER BY fecha DESC');
  console.log('--- MOV_BAN SAMPLE ---');
  console.table(mbSample.recordset);

  const mcSample = await pool.request().query('SELECT TOP 5 mov_num, cod_caja, fecha, tipo_mov, monto_d, monto_h, doc_num, descrip, anulado, tasa FROM mov_caj ORDER BY fecha DESC');
  console.log('--- MOV_CAJ SAMPLE ---');
  console.table(mcSample.recordset);

  pool.close();
}

inspect().catch(console.error);
