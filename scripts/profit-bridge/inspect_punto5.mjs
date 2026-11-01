import sql from 'mssql';
import { config } from './config.js';

async function inspect() {
  console.log('Connecting to', config.sql.server, config.sql.database);
  const pool = await sql.connect(config.sql);
  
  // Check lin_art
  const lines = await pool.request().query('SELECT co_lin, lin_des FROM lin_art');
  console.log('--- LINEAS DE ARTICULOS ---');
  console.table(lines.recordset);

  const rengFacCols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'reng_fac'");
  console.log('--- RENG_FAC COLS ---');
  console.table(rengFacCols.recordset);

  const artCols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'art'");
  console.log('--- ART COLS ---');
  console.table(artCols.recordset);

  pool.close();
}

inspect().catch(console.error);
