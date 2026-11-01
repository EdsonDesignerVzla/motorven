import sql from 'mssql';
import { config } from './config.js';

async function checkCols() {
  const pool = new sql.ConnectionPool({
    server: config.sql.server,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options
  });

  await pool.connect();

  const getCols = async (t) => {
    const res = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${t}';
    `);
    return res.recordset.map(r => r.COLUMN_NAME);
  };

  console.log('--- FACTURA ---');
  console.log(await getCols('factura'));

  console.log('\n--- PEDIDOS ---');
  console.log(await getCols('pedidos'));

  console.log('\n--- CUENTAS ---');
  console.log(await getCols('cuentas'));

  console.log('\n--- CAJAS ---');
  console.log(await getCols('cajas'));

  console.log('\n--- COBROS ---');
  console.log(await getCols('cobros'));

  await pool.close();
}

checkCols().catch(console.error);
