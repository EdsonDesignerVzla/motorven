import sql from 'mssql';
import { config } from './config.js';

async function inspectCotizAndFac() {
  const pool = new sql.ConnectionPool({
    server: config.sql.server,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options
  });

  await pool.connect();

  console.log('--- COTIZACIONES EN GRUMOTOR (cotiz_c) ---');
  const cot = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT c.fact_num, c.fec_emis, c.fec_venc, c.co_cli, c.nombre, c.rif, c.co_ven, c.tot_bruto, c.tot_neto, c.iva, c.status, c.comentario
    FROM cotiz_c c
    ORDER BY c.fec_emis DESC;
  `);
  console.log(cot.recordset);

  console.log('\n--- RENGLONES DE COTIZACIONES (reng_cac) ---');
  const rengCot = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT r.fact_num, r.reng_num, r.co_art, r.des_art, r.total_art, r.uni_venta, r.prec_vta, r.reng_neto
    FROM reng_cac r
    ORDER BY r.fact_num DESC;
  `);
  console.log(rengCot.recordset);

  console.log('\n--- ÚLTIMAS 5 FACTURAS EN GRUMOTOR ---');
  const fac = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT TOP 5 f.fact_num, f.fec_emis, f.co_cli, f.cli_des, f.co_ven, f.tot_neto, f.anulada, f.status
    FROM factura f
    ORDER BY f.fec_emis DESC;
  `);
  console.log(fac.recordset);

  await pool.close();
}

inspectCotizAndFac().catch(console.error);
