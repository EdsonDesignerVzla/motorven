/**
 * Sincronizador Oficial de Datos Anuales de Profit Plus 2K8 (GRUMOTOR)
 * Extrae todas las facturas y cobros del año fiscal completo (01/01 a 31/12)
 * Persiste en Supabase Local y actualiza el historial del ejercicio fiscal.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { getSqlPool } from './databasesExplorer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.join(__dirname, '../../supabase/local_database.json');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

function getLitrosPorUnidad(uniVenta = '', desc = '') {
  const u = (uniVenta || '').toUpperCase();
  const d = (desc || '').toUpperCase();

  if (u.includes('TAMBOR') || d.includes('TAMBOR') || d.includes('208L') || d.includes('55 GAL')) return 208.2;
  if (u.includes('PAILA') || d.includes('PAILA') || d.includes('19L') || d.includes('5 GAL')) return 18.92;
  if (u.includes('GALON') || u.includes('GALÓN') || d.includes('GALON') || d.includes('GALÓN') || d.includes('3.785L')) return 3.785;
  if (u.includes('CUARTO') || d.includes('CUARTO') || d.includes('0.946L') || d.includes('LITRO')) return 0.946;
  if (u.includes('CAJA (12X1)') || u.includes('CAJA (12') || d.includes('CAJA (12') || u.includes('CAJA')) return 11.35;
  if (u.includes('CAJA (4X1)') || u.includes('CAJA (4') || d.includes('CAJA (4')) return 15.14;
  if (u.includes('LITRO') || u.includes('LTS') || u.includes('LT')) return 1.0;

  return 11.35; // Default caja estándar 12x1L (11.35 Litros)
}

async function safeUpsertLocal(tableName, records, chunkSize = 100) {
  if (!records || records.length === 0) return;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    try {
      await supabase.from(tableName).upsert(chunk);
    } catch (_) {}
  }
}

export async function syncAnnualData(
  targetDb = 'GRUMOTOR', 
  fechaInicio = '2026-01-01', 
  fechaFin = '2026-12-31 23:59:59', 
  liveRate = 827.73
) {
  console.log(`\n===============================================================`);
  console.log(`  EXTRACCIÓN ANUAL PROFIT PLUS: [${targetDb}]`);
  console.log(`  Período Fiscal: ${fechaInicio.substring(0,10)} al ${fechaFin.substring(0,10)}`);
  console.log(`  Tasa de Conversión: ${liveRate} Bs./USD`);
  console.log(`===============================================================\n`);

  const pool = await getSqlPool();

  let localDbData = {};
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      localDbData = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    }
  } catch (_) {}

  // 1. FACTURAS DE TODO EL AÑO (factura + reng_fac)
  console.log(`📑 [1/2] Extrayendo facturas de venta del año completo...`);
  const qFac = await pool.request().query(`
    USE [${targetDb}];
    SELECT 
      f.fact_num, f.fec_emis, f.fec_venc, f.co_cli, ISNULL(c.cli_des, f.nombre) AS cli_des, 
      ISNULL(c.rif, f.rif) AS rif, f.co_ven, f.tot_bruto, f.tot_neto, f.iva, f.saldo, 
      f.status, f.anulada, f.forma_pag, f.dir_ent, f.comentario
    FROM factura f
    LEFT JOIN clientes c ON f.co_cli = c.co_cli
    WHERE f.fec_emis >= '${fechaInicio}' AND f.fec_emis <= '${fechaFin}'
    ORDER BY f.fec_emis ASC, f.fact_num ASC;
  `);

  const facRows = qFac.recordset || [];
  console.log(`   ✓ ${facRows.length} facturas encontradas en el año fiscal.`);

  // Renglones de factura para cálculo exacto de litros y cajas
  console.log(`📦 Extrayendo renglones de productos para cálculo de litros...`);
  const qReng = await pool.request().query(`
    USE [${targetDb}];
    SELECT 
      r.fact_num, r.reng_num, r.co_art, r.des_art, r.total_art, r.uni_venta, 
      r.prec_vta, r.reng_neto, a.uni_venta AS art_uni
    FROM reng_fac r
    LEFT JOIN art a ON r.co_art = a.co_art
    WHERE r.fact_num IN (
      SELECT f.fact_num FROM factura f 
      WHERE f.fec_emis >= '${fechaInicio}' AND f.fec_emis <= '${fechaFin}'
    );
  `);

  const rengRows = qReng.recordset || [];
  console.log(`   ✓ ${rengRows.length} renglones de artículos procesados.`);

  // Agrupar renglones por fact_num para indexación O(1)
  const rengMap = new Map();
  rengRows.forEach(r => {
    if (!rengMap.has(r.fact_num)) rengMap.set(r.fact_num, []);
    rengMap.get(r.fact_num).push(r);
  });

  let totalLitrosFacturados = 0;
  let totalVentasNetasUsd = 0;
  let totalVentasBrutasUsd = 0;

  const invoicesToSave = facRows.map(f => {
    const factNum = f.fact_num;
    const renglones = rengMap.get(factNum) || [];

    let litrosFactura = 0;
    let cajasFactura = 0;

    const items = renglones.map(r => {
      const uniVenta = (r.uni_venta || r.art_uni || 'Caja (12L)').trim();
      const desc = (r.des_art || '').trim();
      const litrosUnit = getLitrosPorUnidad(uniVenta, desc);
      const cant = Number(r.total_art || 1);
      const litrosReng = cant * litrosUnit;
      litrosFactura += litrosReng;

      if (uniVenta.toUpperCase().includes('CAJA') || uniVenta.toUpperCase().includes('12L')) {
        cajasFactura += cant;
      } else {
        cajasFactura += (litrosReng / 11.35);
      }

      return {
        rengNum: r.reng_num,
        articuloId: (r.co_art || '').trim(),
        descripcion: desc,
        unidadVenta: uniVenta,
        cantidad: cant,
        litrosUnitarios: litrosUnit,
        litrosTotales: parseFloat(litrosReng.toFixed(2)),
        precioUnitario: Number(r.prec_vta || 0),
        totalNeto: Number(r.reng_neto || 0)
      };
    });

    if (!f.anulada) {
      totalLitrosFacturados += litrosFactura;
    }

    const totNetoBs = Number(f.tot_neto || 0);
    const totBrutoBs = Number(f.tot_bruto || 0);
    const ivaBs = Number(f.iva || 0);
    const saldoBs = Number(f.saldo || 0);

    const totNetoUsd = liveRate > 0 ? parseFloat((totNetoBs / liveRate).toFixed(2)) : 0;
    const totBrutoUsd = liveRate > 0 ? parseFloat((totBrutoBs / liveRate).toFixed(2)) : 0;
    const ivaUsd = liveRate > 0 ? parseFloat((ivaBs / liveRate).toFixed(2)) : 0;
    const saldoUsd = liveRate > 0 ? parseFloat((saldoBs / liveRate).toFixed(2)) : 0;

    if (!f.anulada) {
      totalVentasNetasUsd += totNetoUsd;
      totalVentasBrutasUsd += totBrutoUsd;
    }

    let invoiceStatus = 'COBRADA';
    if (f.anulada) {
      invoiceStatus = 'ANULADA';
    } else if (saldoBs > 1.0) {
      const fecVenc = f.fec_venc ? new Date(f.fec_venc) : new Date();
      invoiceStatus = fecVenc < new Date() ? 'VENCIDA' : 'PENDIENTE';
    }

    return {
      id: `fac-${factNum}`,
      fact_num: factNum,
      factNum,
      fec_emis: f.fec_emis ? new Date(f.fec_emis).toISOString() : null,
      fechaEmision: f.fec_emis ? new Date(f.fec_emis).toISOString() : null,
      fec_venc: f.fec_venc ? new Date(f.fec_venc).toISOString() : null,
      fechaVencimiento: f.fec_venc ? new Date(f.fec_venc).toISOString() : null,
      co_cli: (f.co_cli || '').trim(),
      clienteId: (f.co_cli || '').trim(),
      cli_des: (f.cli_des || '').trim(),
      clienteNombre: (f.cli_des || '').trim(),
      rif: (f.rif || '').trim(),
      co_ven: (f.co_ven || '').trim(),
      vendedorId: (f.co_ven || '').trim(),
      tot_bruto: totBrutoBs,
      totalBruto: totBrutoBs,
      tot_neto: totNetoBs,
      totalNeto: totNetoBs,
      iva: ivaBs,
      saldo: saldoBs,
      tot_neto_usd: totNetoUsd,
      totalNetoUsd: totNetoUsd,
      tot_bruto_usd: totBrutoUsd,
      totalBrutoUsd: totBrutoUsd,
      iva_usd: ivaUsd,
      saldo_usd: saldoUsd,
      totalLitros: parseFloat(litrosFactura.toFixed(2)),
      totalCajas: parseFloat(cajasFactura.toFixed(2)),
      status: invoiceStatus,
      anulada: Boolean(f.anulada),
      forma_pag: (f.forma_pag || '').trim(),
      dir_ent: (f.dir_ent || '').trim(),
      items,
      updated_at: new Date().toISOString()
    };
  });

  localDbData.profit_invoices = invoicesToSave;
  await safeUpsertLocal('profit_invoices', invoicesToSave, 100);
  console.log(`   💾 ${invoicesToSave.length} facturas anuales guardadas en base de datos.`);

  // 2. COBROS DE TODO EL AÑO (cobros + reng_tip)
  console.log(`\n💰 [2/2] Extrayendo cobros y recaudación del año completo...`);
  const qCob = await pool.request().query(`
    USE [${targetDb}];
    SELECT 
      cb.cob_num, cb.fec_cob, cb.co_cli, ISNULL(c.cli_des, '') AS cli_des, 
      ISNULL(c.rif, '') AS rif, cb.co_ven, cb.monto, cb.tasa, cb.moneda, 
      cb.descrip, cb.anulado
    FROM cobros cb
    LEFT JOIN clientes c ON cb.co_cli = c.co_cli
    WHERE cb.fec_cob >= '${fechaInicio}' AND cb.fec_cob <= '${fechaFin}'
    ORDER BY cb.fec_cob ASC, cb.cob_num ASC;
  `);

  const cobRows = qCob.recordset || [];
  console.log(`   ✓ ${cobRows.length} cobros encontrados en el año fiscal.`);

  // Medios de pago en cobros
  const qTip = await pool.request().query(`
    USE [${targetDb}];
    SELECT 
      r.cob_num, r.reng_num, r.tip_cob, r.mont_doc, r.num_doc, r.banco, 
      r.cod_caja, r.fec_cheq
    FROM reng_tip r
    WHERE r.cob_num IN (
      SELECT cb.cob_num FROM cobros cb 
      WHERE cb.fec_cob >= '${fechaInicio}' AND cb.fec_cob <= '${fechaFin}'
    );
  `);

  const tipRows = qTip.recordset || [];
  const tipMap = new Map();
  tipRows.forEach(t => {
    if (!tipMap.has(t.cob_num)) tipMap.set(t.cob_num, []);
    tipMap.get(t.cob_num).push(t);
  });

  let totalCobradoBs = 0;
  let totalCobradoUsd = 0;

  const collectionsToSave = cobRows.map(cb => {
    const cobNum = cb.cob_num;
    const renglones = tipMap.get(cobNum) || [];

    const formasPago = renglones.map(r => ({
      formaPago: (r.tip_cob || 'TRANS').trim().toUpperCase(),
      monto: Number(r.mont_doc || 0),
      referencia: (r.num_doc || '').trim(),
      banco: (r.banco || '').trim(),
      codCaja: (r.cod_caja || '').trim()
    }));

    const montoBs = Number(cb.monto || 0);
    const tasaCobro = Number(cb.tasa || liveRate) || liveRate;
    const esDolar = (cb.moneda || '').toUpperCase().includes('US') || (cb.moneda || '').toUpperCase().includes('DOL');
    const montoUsd = esDolar ? montoBs : parseFloat((montoBs / tasaCobro).toFixed(2));

    if (!cb.anulado) {
      totalCobradoBs += montoBs;
      totalCobradoUsd += montoUsd;
    }

    return {
      id: `cob-${cobNum}`,
      cob_num: cobNum,
      cobNum,
      fec_cob: cb.fec_cob ? new Date(cb.fec_cob).toISOString() : null,
      fechaCobro: cb.fec_cob ? new Date(cb.fec_cob).toISOString() : null,
      co_cli: (cb.co_cli || '').trim(),
      clienteId: (cb.co_cli || '').trim(),
      cli_des: (cb.cli_des || '').trim(),
      clienteNombre: (cb.cli_des || '').trim(),
      rif: (cb.rif || '').trim(),
      co_ven: (cb.co_ven || '').trim(),
      vendedorId: (cb.co_ven || '').trim(),
      monto: montoBs,
      monto_usd: montoUsd,
      montoUsd,
      tasa: tasaCobro,
      moneda: (cb.moneda || 'Bs.').trim(),
      descrip: (cb.descrip || '').trim(),
      descripcion: (cb.descrip || '').trim(),
      anulado: Boolean(cb.anulado),
      formas_pago: formasPago,
      formasPago,
      updated_at: new Date().toISOString()
    };
  });

  localDbData.profit_collections = collectionsToSave;
  await safeUpsertLocal('profit_collections', collectionsToSave, 100);
  console.log(`   💾 ${collectionsToSave.length} cobros anuales guardados en base de datos.`);

  // 3. ACTUALIZAR HISTORIAL DEL EJERCICIO FISCAL EN CONFIG
  const anio = parseInt(fechaInicio.substring(0, 4), 10);
  const snapshotEjercicio = {
    ejercicio: anio,
    fechaInicio: fechaInicio.substring(0, 10),
    fechaFin: fechaFin.substring(0, 10),
    estado: 'EN_CURSO',
    litrosFacturados: parseFloat(totalLitrosFacturados.toFixed(2)),
    cajasFacturadas: parseFloat((totalLitrosFacturados / 11.35).toFixed(2)),
    totalVentasUsd: parseFloat(totalVentasNetasUsd.toFixed(2)),
    totalCobranzasUsd: parseFloat(totalCobradoUsd.toFixed(2)),
    facturasEmitidas: invoicesToSave.length,
    cobrosRealizados: collectionsToSave.length,
    fechaActualizacion: new Date().toISOString()
  };

  if (!localDbData.config || !Array.isArray(localDbData.config) || localDbData.config.length === 0) {
    localDbData.config = [{}];
  }

  const currentCfg = localDbData.config[0] || {};
  let historial = Array.isArray(currentCfg.historialEjercicios) ? [...currentCfg.historialEjercicios] : [];

  // Actualizar o insertar el año en el historial
  const idxHistorial = historial.findIndex(h => h.ejercicio === anio);
  if (idxHistorial >= 0) {
    historial[idxHistorial] = { ...historial[idxHistorial], ...snapshotEjercicio };
  } else {
    historial.push(snapshotEjercicio);
  }

  // Ordenar historial por ejercicio descendente
  historial.sort((a, b) => b.ejercicio - a.ejercicio);

  currentCfg.ejercicioFiscalActivo = anio;
  currentCfg.periodoFiscalInicio = fechaInicio.substring(0, 10);
  currentCfg.periodoFiscalFin = fechaFin.substring(0, 10);
  currentCfg.historialEjercicios = historial;
  localDbData.config[0] = currentCfg;

  // Persistir en disco
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDbData, null, 2), 'utf-8');
  console.log(`\n💾 Base de datos local persistida exitosamente en: ${LOCAL_DB_PATH}`);

  const summary = {
    ejercicio: anio,
    fechaInicio: fechaInicio.substring(0, 10),
    fechaFin: fechaFin.substring(0, 10),
    facturasSincronizadas: invoicesToSave.length,
    cobrosSincronizados: collectionsToSave.length,
    totalLitrosFacturados: parseFloat(totalLitrosFacturados.toFixed(2)),
    totalVentasNetasUsd: parseFloat(totalVentasNetasUsd.toFixed(2)),
    totalCobranzasUsd: parseFloat(totalCobradoUsd.toFixed(2))
  };

  console.log('\n===============================================================');
  console.log('       ¡SINCRONIZACIÓN ANUAL EXITOSA (ENERO - DICIEMBRE)!      ');
  console.log('===============================================================\n');
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}

if (process.argv[1] && process.argv[1].includes('syncAnnualData.js')) {
  syncAnnualData().then(res => {
    process.exit(0);
  }).catch(err => {
    console.error('Error en sincronización anual:', err);
    process.exit(1);
  });
}
