import sql from 'mssql';
import { config } from './config.js';

async function checkMoreTables() {
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

  console.log('Columnas de pedidos:', await getCols('pedidos'));
  console.log('\nColumnas de cuentas:', await getCols('cuentas'));
  console.log('\nColumnas de cajas:', await getCols('cajas'));
  console.log('\nColumnas de cobros:', await getCols('cobros'));
  console.log('\nColumnas de reng_fac:', await getCols('reng_fac'));

  // Consulta de ventas recientes / del mes o periodo activo
  const recentFac = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT TOP 5 
      f.fact_num, 
      f.fec_emis, 
      f.tot_neto, 
      f.co_cli, 
      f.cli_des,
      (SELECT SUM(r.total_art) FROM reng_fac r WHERE r.fact_num = f.fact_num) AS total_unidades
    FROM factura f 
    WHERE f.anulada = 0 
    ORDER BY f.fec_emis DESC;
  `);
  console.log('\nFacturas más recientes en Profit:', recentFac.recordset);

  // Cuentas bancarias datos
  const ctas = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT TOP 10 co_cta, des_cta, saldo, co_ban FROM cuentas WHERE inactivo = 0;
  `);
  console.log('\nCuentas Bancarias:', ctas.recordset);

  await pool.close();
}

checkMoreTables().catch(console.error);
