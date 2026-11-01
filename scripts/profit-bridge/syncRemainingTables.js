/**
 * Sincronizador Oficial de Tablas Avanzadas de Profit Plus 2K8 (GRUMOTOR) ➔ Supabase
 * SIGNUM MOTORVEN
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { getSqlPool } from './databasesExplorer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.join(__dirname, '../../supabase/local_database.json');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

async function safeUpsert(tableName, records, chunkSize = 100) {
  if (!records || records.length === 0) return;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    try {
      const { error } = await supabase.from(tableName).upsert(chunk);
      if (error && !error.message?.includes('exceed_egress_quota')) {
        console.warn(`   ⚠️ Supabase [${tableName}]:`, error.message);
      }
    } catch (_) {}
  }
}

export async function syncAllRemainingTables(targetDb = 'GRUMOTOR', liveRate = 827.73) {
  console.log(`\n===============================================================`);
  console.log(`  SINCRONIZANDO TABLAS AVANZADAS DESDE PROFIT PLUS: [${targetDb}]  `);
  console.log(`===============================================================\n`);

  const pool = await getSqlPool();
  const summary = {};

  // Cargar base de datos local actual para persistencia
  let localDbData = {};
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      localDbData = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    }
  } catch (_) {}

  // 1. Bancos Oficiales (bancos)
  try {
    console.log(`🏦 [1/13] Extrayendo Catálogo de Bancos (bancos)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT co_ban, des_ban, telefonos FROM bancos;
    `);
    const rows = (q.recordset || []).map(b => ({
      id: (b.co_ban || '').trim(),
      co_ban: (b.co_ban || '').trim(),
      des_ban: (b.des_ban || '').trim(),
      telefonos: (b.telefonos || '').trim(),
      respons: '',
      updated_at: new Date().toISOString()
    }));
    summary.profit_banks = rows.length;
    localDbData.profit_banks = rows;
    await safeUpsert('profit_banks', rows);
    console.log(`   ✓ ${rows.length} bancos guardados.`);
  } catch (e) {
    console.warn('   ⚠️ Error en bancos:', e.message);
  }

  // 2. Condiciones de Pago (condicio)
  try {
    console.log(`📋 [2/13] Extrayendo Condiciones de Pago (condicio)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT co_cond, cond_des, dias_cred FROM condicio;
    `);
    const rows = (q.recordset || []).map(c => ({
      id: (c.co_cond || '').trim(),
      co_cond: (c.co_cond || '').trim(),
      cond_des: (c.cond_des || '').trim(),
      dias_cred: Number(c.dias_cred || 0),
      updated_at: new Date().toISOString()
    }));
    summary.profit_payment_conditions = rows.length;
    localDbData.profit_payment_conditions = rows;
    await safeUpsert('profit_payment_conditions', rows);
    console.log(`   ✓ ${rows.length} condiciones de crédito guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en condicio:', e.message);
  }

  // 3. Cuentas de Ingreso / Gasto (cta_ingr)
  try {
    console.log(`🏷️ [3/13] Extrayendo Cuentas de Ingreso y Gasto (cta_ingr)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT co_ingr, descrip, cta_contab FROM cta_ingr;
    `);
    const rows = (q.recordset || []).map(ci => ({
      id: (ci.co_ingr || '').trim(),
      co_ingr: (ci.co_ingr || '').trim(),
      descrip: (ci.descrip || '').trim(),
      cta_contab: (ci.cta_contab || '').trim(),
      updated_at: new Date().toISOString()
    }));
    summary.profit_income_expense_accounts = rows.length;
    localDbData.profit_income_expense_accounts = rows;
    await safeUpsert('profit_income_expense_accounts', rows);
    console.log(`   ✓ ${rows.length} cuentas de ingresos/gastos guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en cta_ingr:', e.message);
  }

  // 4. Unidades de Medida (unidades)
  try {
    console.log(`📏 [4/13] Extrayendo Unidades de Medida (unidades)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT co_uni, des_uni FROM unidades;
    `);
    const rows = (q.recordset || []).map(u => ({
      id: (u.co_uni || '').trim(),
      co_uni: (u.co_uni || '').trim(),
      des_uni: (u.des_uni || '').trim(),
      updated_at: new Date().toISOString()
    }));
    summary.profit_measurement_units = rows.length;
    localDbData.profit_measurement_units = rows;
    await safeUpsert('profit_measurement_units', rows);
    console.log(`   ✓ ${rows.length} unidades de medida guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en unidades:', e.message);
  }

  // 5. Sublíneas de Producto (sub_lin)
  try {
    console.log(`📦 [5/13] Extrayendo Sublíneas de Producto (sub_lin)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT co_subl, subl_des, co_lin FROM sub_lin;
    `);
    const rows = (q.recordset || []).map(sl => ({
      id: (sl.co_subl || '').trim(),
      co_subl: (sl.co_subl || '').trim(),
      subl_des: (sl.subl_des || '').trim(),
      co_lin: (sl.co_lin || '').trim(),
      updated_at: new Date().toISOString()
    }));
    summary.profit_product_sublines = rows.length;
    localDbData.profit_product_sublines = rows;
    await safeUpsert('profit_product_sublines', rows);
    console.log(`   ✓ ${rows.length} sublíneas guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en sub_lin:', e.message);
  }

  // 6. Tasas de Impuesto e Histórico Tributario (tasas / uni_trib)
  try {
    console.log(`💰 [6/13] Extrayendo Tasas de Impuesto (tasas & uni_trib)...`);
    const qTasas = await pool.request().query(`USE [${targetDb}]; SELECT co_mone, fecha, tasa_v, tasa_c FROM tasas;`);
    const qUniTrib = await pool.request().query(`USE [${targetDb}]; SELECT uni_fec, valor FROM uni_trib;`);
    
    const rows = [];
    (qTasas.recordset || []).forEach((t, i) => {
      rows.push({
        id: `tasa-${i}-${(t.co_mone || '').trim()}`,
        tipo: (t.co_mone || 'IVA').trim(),
        tasa: Number(t.tasa_v || t.tasa_c || 16.0),
        fecha: t.fecha ? new Date(t.fecha).toISOString() : null,
        descrip: `Tasa Cambiaria / Fiscal ${t.co_mone}`,
        updated_at: new Date().toISOString()
      });
    });
    (qUniTrib.recordset || []).forEach((u, i) => {
      rows.push({
        id: `ut-${i}`,
        tipo: 'UT',
        tasa: Number(u.valor || 0),
        fecha: u.uni_fec ? new Date(u.uni_fec).toISOString() : null,
        descrip: 'Unidad Tributaria SENIAT',
        updated_at: new Date().toISOString()
      });
    });

    summary.profit_tax_rates = rows.length;
    localDbData.profit_tax_rates = rows;
    await safeUpsert('profit_tax_rates', rows);
    console.log(`   ✓ ${rows.length} tasas de impuesto y UT guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en tasas/uni_trib:', e.message);
  }

  // 7. Stock Desglosado por Almacén (st_almac)
  try {
    console.log(`🏭 [7/13] Extrayendo Stock por Almacén Físico (st_almac)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT 
        s.co_art,
        s.co_alma,
        s.stock_act,
        s.stock_com,
        s.stock_lle,
        s.stock_des
      FROM st_almac s
      ORDER BY s.co_art;
    `);
    const rows = (q.recordset || []).map(r => ({
      id: `${(r.co_art || '').trim()}_${(r.co_alma || '').trim()}`,
      co_art: (r.co_art || '').trim(),
      co_alma: (r.co_alma || '').trim(),
      alma_des: (r.co_alma || '').trim() === '01' ? 'Almacén Principal' : `Almacén ${r.co_alma}`,
      stock_act: Number(r.stock_act || 0),
      stock_com: Number(r.stock_com || 0),
      stock_lle: Number(r.stock_lle || 0),
      stock_des: Number(r.stock_des || 0),
      updated_at: new Date().toISOString()
    }));
    summary.profit_stock_by_warehouse = rows.length;
    localDbData.profit_stock_by_warehouse = rows;
    await safeUpsert('profit_stock_by_warehouse', rows);
    console.log(`   ✓ ${rows.length} registros de stock por almacén guardados.`);
  } catch (e) {
    console.warn('   ⚠️ Error en st_almac:', e.message);
  }

  // 8. Notas de Recepción de Mercancía (not_rec)
  try {
    console.log(`📥 [8/13] Extrayendo Notas de Recepción (not_rec)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT 
        fact_num as not_num,
        fec_emis,
        co_cli,
        nombre,
        rif,
        tot_bruto,
        tot_neto
      FROM not_rec
      ORDER BY fec_emis DESC;
    `);
    const rows = (q.recordset || []).map(r => ({
      id: `not-${r.not_num}`,
      not_num: Number(r.not_num),
      fec_emis: r.fec_emis ? new Date(r.fec_emis).toISOString() : null,
      co_prov: (r.co_cli || '').trim(),
      prov_des: (r.nombre || '').trim(),
      nro_fact: (r.rif || '').trim(),
      tot_bruto: Number(r.tot_bruto || 0),
      tot_neto: Number(r.tot_neto || 0),
      items_count: 1,
      updated_at: new Date().toISOString()
    }));
    summary.profit_goods_receipt_notes = rows.length;
    localDbData.profit_goods_receipt_notes = rows;
    await safeUpsert('profit_goods_receipt_notes', rows);
    console.log(`   ✓ ${rows.length} notas de recepción guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en not_rec:', e.message);
  }

  // 9. Movimientos Detallados de Caja Chica y Efectivo (mov_caj)
  try {
    console.log(`💵 [9/13] Extrayendo Movimientos de Caja Chica (mov_caj: 1,024 registros)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT TOP 2000
        mov_num,
        codigo as cod_caja,
        forma_pag,
        fecha,
        descrip,
        monto_d,
        monto_h,
        tipo_op,
        co_us_in
      FROM mov_caj
      ORDER BY fecha DESC, mov_num DESC;
    `);
    const rows = (q.recordset || []).map(r => {
      const montoBs = Number(r.monto_d > 0 ? r.monto_d : r.monto_h);
      return {
        id: `caj-${r.mov_num}`,
        mov_num: Number(r.mov_num),
        cod_caja: (r.cod_caja || '').trim(),
        forma_pag: (r.forma_pag || '').trim(),
        fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
        descrip: (r.descrip || '').trim(),
        monto_d: Number(r.monto_d || 0),
        monto_h: Number(r.monto_h || 0),
        monto_usd: liveRate > 0 ? Number((montoBs / liveRate).toFixed(2)) : 0,
        tipo_mov: (r.tipo_op || '').trim(),
        co_us_in: (r.co_us_in || '').trim(),
        updated_at: new Date().toISOString()
      };
    });
    summary.profit_cash_movements_detailed = rows.length;
    localDbData.profit_cash_movements_detailed = rows;
    await safeUpsert('profit_cash_movements_detailed', rows, 100);
    console.log(`   ✓ ${rows.length} movimientos de caja chica guardados.`);
  } catch (e) {
    console.warn('   ⚠️ Error en mov_caj:', e.message);
  }

  // 10. Movimientos Bancarios Oficiales (mov_ban)
  try {
    console.log(`🏛️ [10/13] Extrayendo Movimientos Bancarios (mov_ban: 4,834 registros)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT TOP 5000
        mov_num,
        codigo as cod_cta,
        forma_pag,
        fecha,
        descrip,
        monto_d,
        monto_h,
        tipo_op,
        doc_num,
        co_us_in
      FROM mov_ban
      ORDER BY fecha DESC, mov_num DESC;
    `);
    const rows = (q.recordset || []).map(r => {
      const montoBs = Number(r.monto_d > 0 ? r.monto_d : r.monto_h);
      return {
        id: `ban-${r.mov_num}`,
        mov_num: Number(r.mov_num),
        cod_cta: (r.cod_cta || '').trim(),
        forma_pag: (r.forma_pag || '').trim(),
        fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
        descrip: (r.descrip || '').trim(),
        monto_d: Number(r.monto_d || 0),
        monto_h: Number(r.monto_h || 0),
        monto_usd: liveRate > 0 ? Number((montoBs / liveRate).toFixed(2)) : 0,
        tipo_op: (r.tipo_op || '').trim(),
        conciliado: false,
        doc_num: (r.doc_num || '').trim(),
        co_us_in: (r.co_us_in || '').trim(),
        updated_at: new Date().toISOString()
      };
    });
    summary.profit_bank_movements = rows.length;
    localDbData.profit_bank_movements = rows;
    await safeUpsert('profit_bank_movements', rows, 100);
    console.log(`   ✓ ${rows.length} movimientos bancarios guardados.`);
  } catch (e) {
    console.warn('   ⚠️ Error en mov_ban:', e.message);
  }

  // 11. Desglose de Formas de Pago en Cobranzas (reng_tip)
  try {
    console.log(`💳 [11/13] Extrayendo Formas de Pago en Cobros (reng_tip: 4,041 registros)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT TOP 5000
        cob_num,
        reng_num,
        tip_cob as forma_pag,
        cod_caja,
        mont_doc,
        num_doc,
        banco,
        fec_cheq
      FROM reng_tip
      ORDER BY cob_num DESC;
    `);
    const rows = (q.recordset || []).map(r => ({
      id: `rtip-${r.cob_num}-${r.reng_num}`,
      cob_num: Number(r.cob_num),
      reng_num: Number(r.reng_num),
      forma_pag: (r.forma_pag || '').trim(),
      cod_cta: '',
      cod_caja: (r.cod_caja || '').trim(),
      monto: Number(r.mont_doc || 0),
      monto_usd: liveRate > 0 ? Number((Number(r.mont_doc || 0) / liveRate).toFixed(2)) : 0,
      num_doc: (r.num_doc || '').trim(),
      banco: (r.banco || '').trim(),
      fec_cheq: r.fec_cheq ? new Date(r.fec_cheq).toISOString() : null,
      updated_at: new Date().toISOString()
    }));
    summary.profit_payment_methods_collections = rows.length;
    localDbData.profit_payment_methods_collections = rows;
    await safeUpsert('profit_payment_methods_collections', rows, 100);
    console.log(`   ✓ ${rows.length} formas de pago de clientes guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en reng_tip:', e.message);
  }

  // 12. Desglose de Medios de Pago a Proveedores (reng_tcp)
  try {
    console.log(`🧾 [12/13] Extrayendo Formas de Pago a Proveedores (reng_tcp: 217 registros)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT 
        cob_num as pag_num,
        reng_num,
        tip_cob as forma_pag,
        mont_doc,
        num_doc,
        banco,
        cod_caja,
        fec_cheq
      FROM reng_tcp
      ORDER BY cob_num DESC;
    `);
    const rows = (q.recordset || []).map(r => ({
      id: `rtcp-${r.pag_num}-${r.reng_num}`,
      pag_num: Number(r.pag_num),
      reng_num: Number(r.reng_num),
      forma_pag: (r.forma_pag || '').trim(),
      cod_cta: '',
      monto: Number(r.mont_doc || 0),
      monto_usd: liveRate > 0 ? Number((Number(r.mont_doc || 0) / liveRate).toFixed(2)) : 0,
      num_doc: (r.num_doc || '').trim(),
      banco: (r.banco || '').trim(),
      updated_at: new Date().toISOString()
    }));
    summary.profit_payment_methods_supplier_payments = rows.length;
    localDbData.profit_payment_methods_supplier_payments = rows;
    await safeUpsert('profit_payment_methods_supplier_payments', rows, 100);
    console.log(`   ✓ ${rows.length} formas de pago a proveedores guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en reng_tcp:', e.message);
  }

  // 13. Pistas de Auditoría Forense de Profit Plus (pistas: últimos 1.500 eventos)
  try {
    console.log(`🛡️ [13/13] Extrayendo Pistas de Auditoría de Profit Plus (pistas: 1,500 eventos recientes)...`);
    const q = await pool.request().query(`
      USE [${targetDb}];
      SELECT TOP 1500
        fecha,
        usuario,
        tabla,
        num_doc,
        codigo,
        tipo_op,
        maquina,
        campos
      FROM pistas
      ORDER BY fecha DESC;
    `);
    let idx = 0;
    const rows = (q.recordset || []).map(r => ({
      id: `pista-${r.fecha ? new Date(r.fecha).getTime() : '0'}-${String(r.tabla || '').trim()}-${String(r.num_doc || r.codigo || ++idx).trim()}`,
      fecha: r.fecha ? new Date(r.fecha).toISOString() : null,
      usuario: String(r.usuario || '').trim(),
      modulo: String(r.tabla || '').trim(),
      tipo_op: String(r.tipo_op || '').trim(),
      tabla: String(r.tabla || '').trim(),
      num_doc: String(r.num_doc || r.codigo || '').trim(),
      descripcion: String(r.campos || '').trim(),
      equipo: String(r.maquina || '').trim(),
      updated_at: new Date().toISOString()
    }));
    summary.profit_audit_trails_events = rows.length;
    localDbData.profit_audit_trails_events = rows;
    await safeUpsert('profit_audit_trails_events', rows, 100);
    console.log(`   ✓ ${rows.length} pistas de auditoría guardadas.`);
  } catch (e) {
    console.warn('   ⚠️ Error en pistas:', e.message);
  }

  // Guardar persistencia atómica en supabase/local_database.json
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDbData, null, 2), 'utf-8');
    console.log(`\n💾 Persistencia completada en: ${LOCAL_DB_PATH}`);
  } catch (err) {
    console.warn('   ⚠️ No se pudo escribir en local_database.json:', err.message);
  }

  console.log('\n===============================================================');
  console.log('       ¡TODAS LAS TABLAS RESTANTES FUERON SINCRONIZADAS!       ');
  console.log('===============================================================\n');

  return summary;
}

if (process.argv[1] && process.argv[1].includes('syncRemainingTables.js')) {
  syncAllRemainingTables().then(res => {
    console.log('RESUMEN FINAL:', JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
