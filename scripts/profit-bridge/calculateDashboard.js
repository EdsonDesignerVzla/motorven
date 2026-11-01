import sql from 'mssql';
import { config } from './config.js';

async function calculateProfitDashboardMetrics() {
  const pool = new sql.ConnectionPool({
    server: config.sql.server,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options
  });

  await pool.connect();
  console.log('=== CALCULANDO MÉTRICAS EN VIVO DEL DASHBOARD PROFIT PLUS ===\n');

  // 1. Litros y Cajas Facturadas (Mes actual o último periodo)
  const facStats = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT 
      ISNULL(SUM(r.total_art * CASE 
        WHEN a.uni_venta LIKE '%TAMBOR%' OR a.uni_venta LIKE '%208%' THEN 208.0
        WHEN a.uni_venta LIKE '%CU%ETE%' OR a.uni_venta LIKE '%19L%' THEN 19.0
        WHEN a.uni_venta LIKE '%TOTE%' OR a.uni_venta LIKE '%1000%' THEN 1000.0
        WHEN a.uni_venta LIKE '%CAJA%' OR a.uni_venta LIKE '%12%' THEN 11.35
        ELSE 1.0 END), 0) AS total_litros_facturados,
      ISNULL(SUM(f.tot_neto), 0) AS total_monto_facturado
    FROM factura f
    JOIN reng_fac r ON f.fact_num = r.fact_num
    LEFT JOIN art a ON r.co_art = a.co_art
    WHERE f.anulada = 0;
  `);

  // 2. Pedidos Pendientes
  const pedStats = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT 
      ISNULL(SUM(r.total_art * CASE 
        WHEN a.uni_venta LIKE '%TAMBOR%' OR a.uni_venta LIKE '%208%' THEN 208.0
        WHEN a.uni_venta LIKE '%CU%ETE%' OR a.uni_venta LIKE '%19L%' THEN 19.0
        WHEN a.uni_venta LIKE '%TOTE%' OR a.uni_venta LIKE '%1000%' THEN 1000.0
        WHEN a.uni_venta LIKE '%CAJA%' OR a.uni_venta LIKE '%12%' THEN 11.35
        ELSE 1.0 END), 0) AS total_litros_pendientes,
      ISNULL(SUM(p.tot_neto), 0) AS total_monto_pendiente
    FROM pedidos p
    JOIN reng_ped r ON p.fact_num = r.fact_num
    LEFT JOIN art a ON r.co_art = a.co_art
    WHERE p.anulada = 0 AND p.status = '0';
  `);

  // 3. Cartera de Clientes CxC (docum_cc)
  const cxcStats = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT 
      ISNULL(SUM(CASE WHEN fec_venc >= GETDATE() THEN saldo ELSE 0 END), 0) AS cxc_al_dia,
      ISNULL(SUM(CASE WHEN fec_venc < GETDATE() THEN saldo ELSE 0 END), 0) AS cxc_vencida,
      ISNULL(SUM(saldo), 0) AS cxc_total
    FROM docum_cc 
    WHERE anulado = 0 AND saldo > 0;
  `);

  // 4. Cobranzas
  const cobStats = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT 
      ISNULL(SUM(monto), 0) AS cobranza_total
    FROM cobros 
    WHERE anulado = 0;
  `);

  // 5. Disponibilidad Bancaria y Cajas
  const ctasStats = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT 
      cod_cta,
      co_banco,
      num_cta,
      saldo_a AS saldo,
      moneda
    FROM cuentas 
    WHERE inactivo = 0;
  `);

  const cajasStats = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT 
      cod_caja,
      descrip,
      saldo_a AS saldo,
      moneda
    FROM cajas 
    WHERE inactivo = 0;
  `);

  // 6. Proveedores
  const provStats = await pool.request().query(`
    USE [GRUMOTOR];
    SELECT 
      ISNULL(SUM(saldo), 0) AS saldo_proveedores,
      ISNULL(SUM(monto_net), 0) AS total_compras
    FROM docum_cp 
    WHERE anulado = 0 AND saldo > 0;
  `);

  console.log('Facturación Litros:', facStats.recordset[0]);
  console.log('Pedidos Pendientes:', pedStats.recordset[0]);
  console.log('CxC Clientes:', cxcStats.recordset[0]);
  console.log('Cobranzas:', cobStats.recordset[0]);
  console.log('Bancos:', ctasStats.recordset);
  console.log('Cajas:', cajasStats.recordset);
  console.log('Proveedores CxP:', provStats.recordset[0]);

  await pool.close();
}

calculateProfitDashboardMetrics().catch(console.error);
