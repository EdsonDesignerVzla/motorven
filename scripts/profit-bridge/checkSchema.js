import sql from 'mssql';
import { config } from './config.js';

async function checkSchema() {
  const pool = new sql.ConnectionPool({
    server: config.sql.server,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options
  });

  await pool.connect();
  console.log('Tablas en GRUMOTOR relacionadas con stock/articulos:');
  const res = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME LIKE '%art%' OR TABLE_NAME LIKE '%stock%' OR TABLE_NAME LIKE '%alm%' OR TABLE_NAME LIKE '%cli%'
    ORDER BY TABLE_NAME;
  `);
  console.log(res.recordset.map(r => r.TABLE_NAME));

  console.log('\nColumnas de la tabla [art]:');
  const cols = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'art';
  `);
  console.log(cols.recordset.map(c => c.COLUMN_NAME).join(', '));

  console.log('\nColumnas de la tabla [clientes]:');
  const cliCols = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'clientes';
  `);
  console.log(cliCols.recordset.map(c => c.COLUMN_NAME).join(', '));

  await pool.close();
}

checkSchema().catch(console.error);
