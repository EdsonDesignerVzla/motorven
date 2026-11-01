import sql from 'mssql';
import { config } from './config.js';

async function inspectProfitDashboard() {
  const pool = new sql.ConnectionPool({
    server: config.sql.server,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options
  });

  await pool.connect();
  console.log('=== ANALIZANDO DATOS FINANCIEROS Y OPERATIVOS EN GRUMOTOR ===\n');

  // 1. Facturas y Ventas
  try {
    const facRes = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT 
        COUNT(*) AS totalFacturas,
        ISNULL(SUM(tot_neto), 0) AS totalFacturadoUsd,
        ISNULL(SUM(tot_bruto), 0) AS totalBruto
      FROM factura WHERE anulada = 0;
    `);
    console.log('1. Facturas:', facRes.recordset[0]);
  } catch (e) {
    console.log('1. Facturas error:', e.message);
  }

  // 2. Pedidos Pendientes
  try {
    const pedRes = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT 
        COUNT(*) AS totalPedidos,
        ISNULL(SUM(tot_neto), 0) AS totalPedidosMonto
      FROM pedidos WHERE status = 0 AND anulado = 0;
    `);
    console.log('2. Pedidos Pendientes:', pedRes.recordset[0]);
  } catch (e) {
    console.log('2. Pedidos error:', e.message);
  }

  // 3. Cartera de Clientes y CxC (docum_cc o clientes)
  try {
    const cliSaldo = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT 
        ISNULL(SUM(saldo), 0) AS saldoTotalClientes,
        COUNT(CASE WHEN saldo > 0 THEN 1 END) AS clientesConDeuda
      FROM clientes WHERE inactivo = 0;
    `);
    console.log('3. Saldo Total Clientes:', cliSaldo.recordset[0]);
  } catch (e) {
    console.log('3. Clientes saldo error:', e.message);
  }

  // Documentos CxC (docum_cc)
  try {
    const cxcRes = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT 
        ISNULL(SUM(CASE WHEN fec_venc >= GETDATE() THEN saldo ELSE 0 END), 0) AS cxcAlDia,
        ISNULL(SUM(CASE WHEN fec_venc < GETDATE() THEN saldo ELSE 0 END), 0) AS cxcVencidas,
        ISNULL(SUM(saldo), 0) AS cxcTotal
      FROM docum_cc WHERE anulado = 0 AND saldo > 0;
    `);
    console.log('4. Detalle CxC (docum_cc):', cxcRes.recordset[0]);
  } catch (e) {
    console.log('4. Detalle CxC error:', e.message);
  }

  // 5. Cuentas Bancarias y Cajas (cuentas, cajas)
  try {
    const bankRes = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT 
        co_cta,
        des_cta,
        ISNULL(saldo_act, 0) AS saldo
      FROM cuentas WHERE inactivo = 0;
    `);
    console.log('5. Cuentas Bancarias:', bankRes.recordset);
  } catch (e) {
    console.log('5. Cuentas Bancarias error:', e.message);
  }

  // 6. Proveedores y Cuentas por Pagar (prov, docum_cp)
  try {
    const provRes = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT 
        ISNULL(SUM(saldo), 0) AS saldoProveedores,
        COUNT(*) AS totalProveedores
      FROM prov WHERE inactivo = 0;
    `);
    console.log('6. Proveedores (prov):', provRes.recordset[0]);
  } catch (e) {
    console.log('6. Proveedores error:', e.message);
  }

  // 7. Cobranzas del mes
  try {
    const cobRes = await pool.request().query(`
      USE [GRUMOTOR];
      SELECT 
        COUNT(*) AS totalCobros,
        ISNULL(SUM(mont_cob), 0) AS totalCobrado
      FROM cobros WHERE anulado = 0;
    `);
    console.log('7. Cobros:', cobRes.recordset[0]);
  } catch (e) {
    console.log('7. Cobros error:', e.message);
  }

  await pool.close();
}

inspectProfitDashboard().catch(console.error);
