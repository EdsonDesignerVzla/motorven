/**
 * Script de Diagnóstico y Prueba de Conexión
 * Profit Plus 2K8 (Microsoft SQL Server) ↔ SIGNUM MOTORVEN
 */
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

console.log('===============================================================');
console.log('  DIAGNÓSTICO DE CONEXIÓN: PROFIT PLUS 2K8 ↔ SIGNUM MOTORVEN  ');
console.log('===============================================================\n');

async function testSupabase() {
  console.log('🔍 [1/3] Verificando conexión con Supabase...');
  try {
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);
    const { data, error } = await supabase.from('config').select('id, nombre_empresa').limit(1);
    if (error) {
      console.warn('⚠️ Advertencia Supabase:', error.message);
    } else {
      console.log('✅ Supabase conectado con éxito. Empresa:', data?.[0]?.nombre_empresa || 'Configuración OK');
    }
  } catch (err) {
    console.error('❌ Error conectando a Supabase:', err.message);
  }
}

async function inspectProfitDatabase(pool, dbName) {
  try {
    // 1. Verificar si tiene la tabla 'art' (es una base administrativa de Profit)
    const checkTable = await pool.request().query(`
      USE [${dbName}];
      SELECT OBJECT_ID('art', 'U') AS hasArt, OBJECT_ID('par_emp', 'U') AS hasParEmp;
    `);

    const hasArt = checkTable.recordset?.[0]?.hasArt;
    if (!hasArt) return null; // No es base de datos administrativa de Profit

    console.log(`\n📋 Inspeccionando base de datos [${dbName}]...`);

    // 2. Obtener datos de par_emp
    let empDes = 'Sin nombre';
    let rif = 'N/A';
    try {
      const empResult = await pool.request().query(`
        USE [${dbName}];
        SELECT TOP 1 * FROM par_emp;
      `);
      if (empResult.recordset?.length > 0) {
        const emp = empResult.recordset[0];
        empDes = emp.emp_des || emp.nom_emp || emp.des_emp || emp.co_emp || 'Empresa Activa';
        rif = emp.rif || 'N/A';
      }
    } catch (_) {}

    console.log(`   🏢 Empresa: ${empDes} (RIF: ${rif})`);

    // 3. Conteo de Artículos
    let totalArt = 0;
    try {
      const artResult = await pool.request().query(`
        USE [${dbName}];
        SELECT COUNT(*) AS totalArt FROM art;
      `);
      totalArt = artResult.recordset?.[0]?.totalArt || 0;
    } catch (_) {}
    console.log(`   📦 Total Artículos (art): ${totalArt}`);

    // 4. Conteo de Clientes
    let totalCli = 0;
    try {
      const cliResult = await pool.request().query(`
        USE [${dbName}];
        SELECT COUNT(*) AS totalCli FROM clientes;
      `);
      totalCli = cliResult.recordset?.[0]?.totalCli || 0;
    } catch (_) {}
    console.log(`   👥 Total Clientes (clientes): ${totalCli}`);

    // 5. Muestra de primeros 3 productos
    if (totalArt > 0) {
      try {
        const sampleArt = await pool.request().query(`
          USE [${dbName}];
          SELECT TOP 3 co_art, art_des, prec_vta1 FROM art;
        `);
        console.log('   🔍 Muestra de productos:');
        sampleArt.recordset.forEach(p => {
          console.log(`      - [${p.co_art?.trim()}] ${p.art_des?.trim()} (Precio 1: ${p.prec_vta1})`);
        });
      } catch (_) {}
    }

    return {
      dbName,
      empresa: empDes,
      rif: rif,
      totalArt,
      totalCli
    };
  } catch (err) {
    return null;
  }
}

async function run() {
  await testSupabase();

  console.log('\n🔍 [2/3] Conectando a SQL Server (Profit Plus 2K8)...');

  const sqlConfig = {
    server: config.sql.server,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options
  };

  const pool = new sql.ConnectionPool(sqlConfig);

  try {
    await pool.connect();
    console.log(`✅ Conexión exitosa a ${config.sql.server} con usuario [${config.sql.user}]!`);

    console.log('\n🔍 [3/3] Buscando y analizando todas las empresas en SQL Server...');

    const dbsResult = await pool.request().query(`
      SELECT name FROM sys.databases 
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name;
    `);

    const allDbs = dbsResult.recordset.map(r => r.name);
    const foundCompanies = [];

    for (const db of allDbs) {
      const info = await inspectProfitDatabase(pool, db);
      if (info) foundCompanies.push(info);
    }

    console.log('\n===============================================================');
    console.log('            RESUMEN DE EMPRESAS PROFIT ENCONTRADAS             ');
    console.log('===============================================================');
    foundCompanies.forEach(c => {
      console.log(` • BD: [${c.dbName.padEnd(12)}] | Empresa: "${c.empresa}" | RIF: ${c.rif} | Artículos: ${c.totalArt} | Clientes: ${c.totalCli}`);
    });
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Error durante el diagnóstico:', err.message);
  } finally {
    await pool.close();
  }
}

run().catch(console.error);
