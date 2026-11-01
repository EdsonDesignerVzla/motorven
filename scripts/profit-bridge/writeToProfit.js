/**
 * Módulo de Escritura Bidireccional hacia Profit Plus 2K8 (SQL Server)
 * SIGNUM MOTORVEN ↔ PROFIT PLUS 2K8
 * Permite Crear, Editar, Guardar y Eliminar registros en tiempo real en SQL Server.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PENDING_FILE = path.join(__dirname, 'pending-writes.json');

const KNOWN_SELLER_CODES = {
  'carlosb': 'CB',
  'carlosm': 'CM',
  'franklins': 'FS',
  'joser': 'JR',
  'keilab': 'KB',
  'manuels': 'MS',
  'orangelf': 'OF',
  'valmorep': 'VP',
  'ventasv': 'VV',
  'yheysonc': 'YC',
  'carlos becerra': 'CB',
  'carlos machado': 'CM',
  'franklin silva': 'FS',
  'jose rivas': 'JR',
  'keila barboza': 'KB',
  'manuel silva': 'MS',
  'orangel flores': 'OF',
  'valmore perez': 'VP',
  'ventas varias': 'VV',
  'yheyson calderon': 'YC',
  'yheyson calderón': 'YC'
};

function resolveSellerCode(sellerData) {
  let code = String(sellerData.coVen || sellerData.co_ven || '').trim().toUpperCase();
  if (code && code.length <= 6 && !code.startsWith('USR-')) return code;

  const rawId = String(sellerData.id || '').toLowerCase();
  if (rawId.startsWith('usr-seller-')) {
    return rawId.replace('usr-seller-', '').toUpperCase();
  }

  const rawUser = String(sellerData.username || '').toLowerCase().trim();
  if (KNOWN_SELLER_CODES[rawUser]) return KNOWN_SELLER_CODES[rawUser];

  const rawNombre = String(sellerData.nombre || sellerData.venDes || '').toLowerCase().trim();
  if (KNOWN_SELLER_CODES[rawNombre]) return KNOWN_SELLER_CODES[rawNombre];

  const avatar = String(sellerData.avatar || '').trim().toUpperCase();
  if (avatar.length === 2 && /^[A-Z]{2}$/.test(avatar)) return avatar;

  return null;
}

function loadPendingWrites() {
  try {
    if (fs.existsSync(PENDING_FILE)) {
      const data = fs.readFileSync(PENDING_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.warn('[WriteToProfit] Error leyendo pending-writes.json:', err.message);
  }
  return [];
}

function savePendingWrites(queue) {
  try {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(queue, null, 2), 'utf8');
  } catch (err) {
    console.warn('[WriteToProfit] Error guardando pending-writes.json:', err.message);
  }
}

export function queueWriteAction(entityType, action, payload) {
  const queue = loadPendingWrites();
  queue.push({
    id: `pw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    entityType,
    action,
    payload,
    timestamp: new Date().toISOString()
  });
  savePendingWrites(queue);
  console.log(`[WriteToProfit] 📥 Acción encolada para ejecución posterior en SQL Server: ${entityType} [${action}]`);
}

/**
 * 1. Escribir o Eliminar Vendedor / Asesor en tabla 'vendedor'
 */
export async function writeSellerToProfitSql(pool, targetDb, sellerData, action = 'SAVE') {
  const coVen = resolveSellerCode(sellerData);
  if (!coVen) {
    console.log(`[WriteToProfit] ℹ️ El usuario no posee código de vendedor. Omitiendo tabla Profit 'vendedor'.`);
    return { success: true, skipped: true };
  }

  const request = pool.request();
  request.input('co_ven', sql.Char(6), coVen.padEnd(6, ' ').substring(0, 6));

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      BEGIN TRY
        DELETE FROM vendedor WHERE RTRIM(LTRIM(co_ven)) = RTRIM(LTRIM(@co_ven));
      END TRY
      BEGIN CATCH
        UPDATE vendedor SET tipo = 'I' WHERE RTRIM(LTRIM(co_ven)) = RTRIM(LTRIM(@co_ven));
      END CATCH
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Vendedor ${coVen} eliminado / desactivado en Profit [vendedor].`);
    return { success: true, action: 'DELETE', co_ven: coVen };
  }

  const venDes = String(sellerData.venDes || sellerData.ven_des || sellerData.nombre || coVen).trim().substring(0, 60);
  const cedula = String(sellerData.cedula || '').trim().substring(0, 20);
  const direc1 = String(sellerData.direccion || sellerData.direc1 || '').trim().substring(0, 60);
  const telefonos = String(sellerData.telefonos || sellerData.telefono || '').trim().substring(0, 60);
  const tipo = String(sellerData.tipo || (sellerData.activo === false ? 'I' : 'A')).trim().substring(0, 1);
  const comision = Number(sellerData.comisionPct || sellerData.comision_pct || sellerData.comision || 3.0);

  request.input('ven_des', sql.VarChar(60), venDes);
  request.input('cedula', sql.VarChar(20), cedula);
  request.input('direc1', sql.VarChar(60), direc1);
  request.input('telefonos', sql.VarChar(60), telefonos);
  request.input('tipo', sql.Char(1), tipo);
  request.input('comision', sql.Decimal(5, 2), comision);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM vendedor WHERE RTRIM(LTRIM(co_ven)) = RTRIM(LTRIM(@co_ven)))
    BEGIN
      UPDATE vendedor
      SET ven_des = @ven_des,
          cedula = @cedula,
          direc1 = @direc1,
          telefonos = @telefonos,
          tipo = @tipo,
          comision = @comision,
          fec_ult_ve = GETDATE(),
          fe_us_mo = GETDATE()
      WHERE RTRIM(LTRIM(co_ven)) = RTRIM(LTRIM(@co_ven));
    END
    ELSE
    BEGIN
      INSERT INTO vendedor (
        co_ven, ven_des, tipo, cedula, direc1, telefonos, comision,
        fecha_reg, fec_ult_ve, fe_us_in, fe_us_mo
      )
      VALUES (
        @co_ven, @ven_des, @tipo, @cedula, @direc1, @telefonos, @comision,
        GETDATE(), GETDATE(), GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);
  console.log(`[WriteToProfit] 💾 Vendedor ${coVen} (${venDes}) guardado exitosamente en Profit [vendedor].`);
  return { success: true, action: 'SAVE', co_ven: coVen };
}

/**
 * 2. Escribir o Eliminar Artículo en tabla 'art'
 */
export async function writeProductToProfitSql(pool, targetDb, productData, action = 'SAVE') {
  const coArt = String(productData.codigo || productData.id || '').trim().toUpperCase();
  if (!coArt) throw new Error('Código de artículo (co_art) requerido.');

  const request = pool.request();
  request.input('co_art', sql.Char(30), coArt.padEnd(30, ' ').substring(0, 30));

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      BEGIN TRY
        DELETE FROM st_almac WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art));
        DELETE FROM art WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art));
      END TRY
      BEGIN CATCH
        UPDATE art SET anulado = 1, stock_act = 0, fe_us_mo = GETDATE() WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art));
      END CATCH
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Artículo ${coArt} eliminado/anulado en Profit [art].`);
    return { success: true, action: 'DELETE', co_art: coArt };
  }

  const artDes = String(productData.descripcion || productData.art_des || coArt).trim().substring(0, 120);
  const modelo = String(productData.normaApi || productData.norma_api || productData.modelo || '').trim().substring(0, 30);
  const ref = String(productData.oem || productData.ref || '').trim().substring(0, 30);
  
  // Normalizar unidad a catálogo válido de Profit (01: Litros, 05: Caja, 04: Paila, 03: Tambor, 02: Totem)
  let rawUni = String(productData.unidad || productData.uni_venta || '').toUpperCase();
  let uniVenta = '01';
  if (rawUni.includes('CAJA') || rawUni === '05') uniVenta = '05';
  else if (rawUni.includes('PAILA') || rawUni === '04') uniVenta = '04';
  else if (rawUni.includes('TAMBOR') || rawUni === '03') uniVenta = '03';
  else if (rawUni.includes('TOTEM') || rawUni === '02') uniVenta = '02';

  const stockAct = Number(productData.stock || productData.stock_act || 0);
  const stockMin = Number(productData.stockMinimo || productData.stock_min || 10);
  const precVta1 = Number(productData.precioUsdDetal || productData.prec_vta1 || 0);
  const precVta2 = Number(productData.precioUsdMayor || productData.prec_vta2 || precVta1);
  const ultCosUn = Number(productData.costoUsd || productData.ult_cos_un || (precVta2 * 0.7));

  const coLin = String(productData.co_lin || productData.coLin || productData.linea || '01').trim().substring(0, 6);
  const coSubl = String(productData.co_sub || productData.coSub || productData.co_subl || productData.coSubl || productData.familia || '01').trim().substring(0, 6);
  const coCat = String(productData.co_cat || productData.coCat || productData.categoria || '01').trim().substring(0, 6);
  const campo1 = String(productData.viscosidad || productData.campo1 || '').trim().substring(0, 60);
  const campo2 = String(productData.litrosPorUnidad || productData.litros_por_unidad || productData.campo2 || '').trim().substring(0, 60);
  const campo3 = String(productData.marca || productData.campo3 || 'Oilstone').trim().substring(0, 60);
  const campo4 = String(productData.ubicacion || productData.campo4 || 'Almacén Principal').trim().substring(0, 60);

  request.input('art_des', sql.VarChar(120), artDes);
  request.input('modelo', sql.VarChar(30), modelo);
  request.input('ref', sql.VarChar(30), ref);
  request.input('uni_venta', sql.Char(6), uniVenta.padEnd(6, ' '));
  request.input('stock_act', sql.Decimal(18, 5), stockAct);
  request.input('stock_min', sql.Decimal(18, 5), stockMin);
  request.input('prec_vta1', sql.Decimal(18, 5), precVta1);
  request.input('prec_vta2', sql.Decimal(18, 5), precVta2);
  request.input('ult_cos_un', sql.Decimal(18, 5), ultCosUn);
  request.input('co_lin', sql.Char(6), coLin.padEnd(6, ' '));
  request.input('co_subl', sql.Char(6), coSubl.padEnd(6, ' '));
  request.input('co_cat', sql.Char(6), coCat.padEnd(6, ' '));
  request.input('campo1', sql.VarChar(60), campo1);
  request.input('campo2', sql.VarChar(60), campo2);
  request.input('campo3', sql.VarChar(60), campo3);
  request.input('campo4', sql.VarChar(60), campo4);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM art WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art)))
    BEGIN
      UPDATE art
      SET art_des = @art_des,
          modelo = @modelo,
          ref = @ref,
          uni_venta = @uni_venta,
          stock_act = @stock_act,
          stock_min = @stock_min,
          prec_vta1 = @prec_vta1,
          prec_vta2 = @prec_vta2,
          ult_cos_un = @ult_cos_un,
          co_lin = @co_lin,
          co_subl = @co_subl,
          co_cat = @co_cat,
          campo1 = @campo1,
          campo2 = @campo2,
          campo3 = @campo3,
          campo4 = @campo4,
          anulado = 0,
          fe_us_mo = GETDATE()
      WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art));
    END
    ELSE
    BEGIN
      INSERT INTO art (
        co_art, art_des, modelo, ref, uni_venta, suni_venta, stock_act, stock_min,
        prec_vta1, prec_vta2, ult_cos_un, tipo, tipo_imp, co_lin, co_cat,
        co_subl, co_color, procedenci, co_prov, co_sucu, anulado,
        campo1, campo2, campo3, campo4,
        fecha_reg, fec_prec_v, fec_prec_2, fec_ult_co, fe_us_in, fe_us_mo
      )
      VALUES (
        @co_art, @art_des, @modelo, @ref, @uni_venta, '01', @stock_act, @stock_min,
        @prec_vta1, @prec_vta2, @ult_cos_un, 'V', '6', @co_lin, @co_cat,
        @co_subl, '01', '01', 'J311153659', '01', 0,
        @campo1, @campo2, @campo3, @campo4,
        GETDATE(), GETDATE(), GETDATE(), GETDATE(), GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);
  console.log(`[WriteToProfit] 💾 Artículo ${coArt} (${artDes}) guardado exitosamente en Profit [art] con campos enriquecidos de Supabase.`);
  return { success: true, action: 'SAVE', co_art: coArt };
}

/**
 * 3. Escribir o Eliminar Cliente en tabla 'clientes'
 */
export async function writeClientToProfitSql(pool, targetDb, clientData, action = 'SAVE') {
  const coCli = String(clientData.codigo || clientData.id || clientData.co_cli || '').trim().toUpperCase();
  if (!coCli) throw new Error('Código de cliente (co_cli) requerido.');

  const request = pool.request();
  request.input('co_cli', sql.Char(10), coCli.padEnd(10, ' ').substring(0, 10));

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      BEGIN TRY
        DELETE FROM clientes WHERE RTRIM(LTRIM(co_cli)) = RTRIM(LTRIM(@co_cli));
      END TRY
      BEGIN CATCH
        UPDATE clientes SET inactivo = 1, sincredito = 1, fe_us_mo = GETDATE() WHERE RTRIM(LTRIM(co_cli)) = RTRIM(LTRIM(@co_cli));
      END CATCH
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Cliente ${coCli} eliminado/desactivado en Profit [clientes].`);
    return { success: true, action: 'DELETE', co_cli: coCli };
  }

  const cliDes = String(clientData.nombre || clientData.cli_des || coCli).trim().substring(0, 60);
  const rif = String(clientData.rif || coCli).trim().toUpperCase().substring(0, 18);
  const direc1 = String(clientData.direccion || clientData.direc1 || 'Valencia, Carabobo').trim().substring(0, 60);
  const telefonos = String(clientData.telefono || clientData.telefonos || '').trim().substring(0, 60);
  const email = String(clientData.email || '').trim().substring(0, 60);
  const montCre = Number(clientData.limiteCreditoUsd || clientData.limiteCredito || clientData.mont_cre || 0);
  const plazPag = Number(clientData.diasCredito || clientData.dias_credito || clientData.plaz_pag || 0);
  
  // Normalizar Vendedor a catálogo Profit
  let coVen = String(clientData.vendedorAsignado || clientData.co_ven || 'OF').trim().toUpperCase();
  if (coVen.length > 6) coVen = 'OF';

  // Normalizar Zona a catálogo Profit (01..07)
  let coZon = String(clientData.zonaVenta || clientData.co_zon || '03').trim();
  if (!['01', '02', '03', '04', '05', '06', '07'].includes(coZon)) {
    if (coZon.toUpperCase().includes('SAN DIEGO') || coZon.toUpperCase().includes('NAGUANAGUA')) coZon = '03';
    else if (coZon.toUpperCase().includes('PUERTO CABELLO') || coZon.toUpperCase().includes('MORA')) coZon = '01';
    else if (coZon.toUpperCase().includes('ISABELICA') || coZon.toUpperCase().includes('GUIGUE')) coZon = '02';
    else if (coZon.toUpperCase().includes('SUR') || coZon.toUpperCase().includes('CAOBOS')) coZon = '04';
    else if (coZon.toUpperCase().includes('FLORIDA') || coZon.toUpperCase().includes('TOCUYITO')) coZon = '05';
    else if (coZon.toUpperCase().includes('GUAYOS') || coZon.toUpperCase().includes('GUACARA')) coZon = '06';
    else coZon = '03';
  }

  const inactivo = clientData.inactivo === true ? 1 : 0;

  request.input('cli_des', sql.VarChar(60), cliDes);
  request.input('rif', sql.VarChar(18), rif);
  request.input('tipo', sql.Char(6), '01    ');
  request.input('direc1', sql.VarChar(60), direc1);
  request.input('telefonos', sql.VarChar(60), telefonos);
  request.input('email', sql.VarChar(60), email);
  request.input('mont_cre', sql.Decimal(18, 5), montCre);
  request.input('plaz_pag', sql.Int, plazPag);
  request.input('co_ven', sql.Char(6), coVen.padEnd(6, ' '));
  request.input('co_zon', sql.Char(6), coZon.padEnd(6, ' '));
  request.input('co_seg', sql.Char(6), '01    ');
  request.input('inactivo', sql.Bit, inactivo);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM clientes WHERE RTRIM(LTRIM(co_cli)) = RTRIM(LTRIM(@co_cli)))
    BEGIN
      UPDATE clientes
      SET cli_des = @cli_des,
          rif = @rif,
          tipo = @tipo,
          direc1 = @direc1,
          telefonos = @telefonos,
          email = @email,
          mont_cre = @mont_cre,
          plaz_pag = @plaz_pag,
          co_ven = @co_ven,
          co_zon = @co_zon,
          co_seg = @co_seg,
          inactivo = @inactivo,
          fe_us_mo = GETDATE()
      WHERE RTRIM(LTRIM(co_cli)) = RTRIM(LTRIM(@co_cli));
    END
    ELSE
    BEGIN
      INSERT INTO clientes (
        co_cli, cli_des, rif, tipo, direc1, telefonos, email,
        mont_cre, plaz_pag, co_ven, co_zon, co_seg, co_ingr, inactivo,
        fecha_reg, fec_ult_ve, fe_us_in, fe_us_mo
      )
      VALUES (
        @co_cli, @cli_des, @rif, @tipo, @direc1, @telefonos, @email,
        @mont_cre, @plaz_pag, @co_ven, @co_zon, @co_seg, 'I01', @inactivo,
        GETDATE(), GETDATE(), GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);
  console.log(`[WriteToProfit] 💾 Cliente ${coCli} (${cliDes}) guardado exitosamente en Profit [clientes].`);
  return { success: true, action: 'SAVE', co_cli: coCli };
}

/**
 * 4. Escribir o Anular Factura de Venta / POS en tabla 'factura'
 */
export async function writeSaleToProfitSql(pool, targetDb, saleData, action = 'SAVE') {
  const rawId = String(saleData.fact_num || saleData.numeroDoc || saleData.numero_doc || saleData.id || '').trim();
  const digits = rawId.replace(/\D/g, '');
  let factNum = parseInt(digits, 10);

  if (!factNum || isNaN(factNum)) {
    const maxRes = await pool.request().query(`USE [${targetDb}]; SELECT ISNULL(MAX(fact_num), 2153) + 1 AS next_num FROM factura;`);
    factNum = Number(maxRes.recordset[0]?.next_num || 2154);
  }

  const request = pool.request();
  request.input('fact_num', sql.Int, factNum);

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      BEGIN TRY
        DELETE FROM reng_fac WHERE fact_num = @fact_num;
        DELETE FROM factura WHERE fact_num = @fact_num;
      END TRY
      BEGIN CATCH
        UPDATE factura SET anulada = 1, status = '1', fe_us_mo = GETDATE() WHERE fact_num = @fact_num;
        UPDATE reng_fac SET anulado = 1 WHERE fact_num = @fact_num;
      END CATCH
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Venta #${factNum} eliminada / anulada en Profit [factura].`);
    return { success: true, action: 'DELETE', fact_num: factNum };
  }

  const coCli = String(saleData.clienteId || saleData.cliente_id || saleData.co_cli || '01').trim().substring(0, 10);
  const coVen = String(saleData.vendedor || saleData.co_ven || 'VV').trim().substring(0, 6);
  const totBruto = Number(saleData.subtotalUsd || saleData.subtotal_usd || saleData.tot_bruto || 0);
  const totNeto = Number(saleData.totalUsd || saleData.total_usd || saleData.tot_neto || 0);
  const iva = Number(saleData.ivaUsd || saleData.iva_usd || saleData.iva || 0);
  const tasa = Number(saleData.tasaDolar || saleData.tasa_dolar || saleData.tasa || 1);
  const status = String(saleData.estado || saleData.status || '0').substring(0, 1);

  const formaPag = String(saleData.condicionPago || saleData.forma_pag || '').toUpperCase().includes('CRED') ? '03    ' : '01    ';
  request.input('co_cli', sql.Char(10), coCli.padEnd(10, ' ').substring(0, 10));
  request.input('co_ven', sql.Char(6), coVen.padEnd(6, ' ').substring(0, 6));
  request.input('forma_pag', sql.Char(6), formaPag);
  request.input('tot_bruto', sql.Decimal(18, 5), totBruto);
  request.input('tot_neto', sql.Decimal(18, 5), totNeto);
  request.input('iva', sql.Decimal(18, 5), iva);
  request.input('tasa', sql.Decimal(18, 5), tasa);
  request.input('status', sql.Char(1), status);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM factura WHERE fact_num = @fact_num)
    BEGIN
      UPDATE factura
      SET co_cli = @co_cli,
          co_ven = @co_ven,
          forma_pag = @forma_pag,
          tot_bruto = @tot_bruto,
          tot_neto = @tot_neto,
          iva = @iva,
          tasa = @tasa,
          status = @status,
          anulada = 0,
          fe_us_mo = GETDATE()
      WHERE fact_num = @fact_num;
    END
    ELSE
    BEGIN
      INSERT INTO factura (
        fact_num, contrib, fec_emis, fec_venc, co_cli, co_ven, co_tran, forma_pag,
        tot_bruto, tot_neto, iva, tasa, moneda, status, anulada, co_sucu, fe_us_in, fe_us_mo
      )
      VALUES (
        @fact_num, 1, GETDATE(), GETDATE(), @co_cli, @co_ven, '01    ', @forma_pag,
        @tot_bruto, @tot_neto, @iva, @tasa, 'US$   ', @status, 0, '01    ', GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);

  // Descontar inventario e insertar renglones si se proporcionaron items
  if (Array.isArray(saleData.items) && saleData.items.length > 0) {
    let rengNum = 1;
    for (const item of saleData.items) {
      const artCode = (item.articuloId || item.co_art || item.codigo || '').trim().toUpperCase();
      const qty = Number(item.cantidad || 0);
      const price = Number(item.precioUsd || item.precio || item.prec_vta || 0);
      const totalLine = Number(item.totalUsd || (qty * price) || 0);

      if (artCode && qty > 0) {
        try {
          const reqReng = pool.request();
          reqReng.input('fact_num', sql.Int, factNum);
          reqReng.input('reng_num', sql.Int, rengNum);
          reqReng.input('co_art', sql.Char(30), artCode.padEnd(30, ' ').substring(0, 30));
          reqReng.input('qty', sql.Decimal(18, 5), qty);
          reqReng.input('price', sql.Decimal(18, 5), price);
          reqReng.input('total_line', sql.Decimal(18, 5), totalLine);

          await reqReng.query(`
            USE [${targetDb}];
            IF NOT EXISTS (SELECT 1 FROM reng_fac WHERE fact_num = @fact_num AND reng_num = @reng_num)
               AND EXISTS (SELECT 1 FROM art WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art)))
            BEGIN
              INSERT INTO reng_fac (
                fact_num, reng_num, co_art, co_alma, total_art, prec_vta, reng_neto,
                uni_venta, tipo_imp, pendiente, fec_lote, rowguid
              )
              VALUES (
                @fact_num, @reng_num, @co_art, '01    ', @qty, @price, @total_line,
                '01    ', '1', @qty, GETDATE(), NEWID()
              );
            END

            UPDATE art
            SET stock_act = CASE WHEN (stock_act - @qty) >= 0 THEN (stock_act - @qty) ELSE 0 END,
                fe_us_mo = GETDATE()
            WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art));

            UPDATE st_almac
            SET stock_act = CASE WHEN (stock_act - @qty) >= 0 THEN (stock_act - @qty) ELSE 0 END
            WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art)) AND co_alma = '01    ';
          `);
          rengNum++;
        } catch (rengErr) {
          console.warn('[WriteSale] Error insertando renglón:', rengErr.message);
        }
      }
    }
  }

  console.log(`[WriteToProfit] 💾 Factura #${factNum} guardada exitosamente en Profit [factura & reng_fac].`);
  return { success: true, action: 'SAVE', fact_num: factNum };
}

/**
 * 5. Escribir o Anular Pedido / Cotización en tabla 'pedidos'
 */
export async function writeOrderToProfitSql(pool, targetDb, orderData, action = 'SAVE') {
  const rawId = String(orderData.fact_num || orderData.ped_num || orderData.numeroDoc || orderData.id || '').trim();
  const digits = rawId.replace(/\D/g, '');
  let factNum = parseInt(digits, 10);

  if (!factNum || isNaN(factNum)) {
    const maxRes = await pool.request().query(`USE [${targetDb}]; SELECT ISNULL(MAX(fact_num), 10) + 1 AS next_num FROM pedidos;`);
    factNum = Number(maxRes.recordset[0]?.next_num || 11);
  }

  const request = pool.request();
  request.input('fact_num', sql.Int, factNum);

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      UPDATE pedidos SET anulada = 1, status = '1', fe_us_mo = GETDATE() WHERE fact_num = @fact_num;
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Pedido #${factNum} marcado como anulado en Profit [pedidos].`);
    return { success: true, action: 'DELETE', fact_num: factNum };
  }

  const coCli = String(orderData.clienteId || orderData.cliente_id || orderData.co_cli || '01').trim().substring(0, 10);
  const coVen = String(orderData.vendedorId || orderData.vendedor || orderData.co_ven || 'VV').trim().substring(0, 6);
  const formaPag = String(orderData.condicionPago || orderData.forma_pag || '').toUpperCase().includes('CRED') ? '03    ' : '01    ';
  const totBruto = Number(orderData.totalBrutoUsd || orderData.total_bruto_usd || orderData.tot_bruto || 0);
  const totNeto = Number(orderData.totalNetoUsd || orderData.total_neto_usd || orderData.tot_neto || 0);
  const iva = Number(orderData.ivaUsd || orderData.iva_usd || orderData.iva || 0);
  const status = String(orderData.status || '0').substring(0, 1);

  request.input('co_cli', sql.Char(10), coCli.padEnd(10, ' ').substring(0, 10));
  request.input('co_ven', sql.Char(6), coVen.padEnd(6, ' ').substring(0, 6));
  request.input('forma_pag', sql.Char(6), formaPag);
  request.input('tot_bruto', sql.Decimal(18, 5), totBruto);
  request.input('tot_neto', sql.Decimal(18, 5), totNeto);
  request.input('iva', sql.Decimal(18, 5), iva);
  request.input('status', sql.Char(1), status);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM pedidos WHERE fact_num = @fact_num)
    BEGIN
      UPDATE pedidos
      SET co_cli = @co_cli,
          co_ven = @co_ven,
          forma_pag = @forma_pag,
          tot_bruto = @tot_bruto,
          tot_neto = @tot_neto,
          iva = @iva,
          status = @status,
          anulada = 0,
          fe_us_mo = GETDATE()
      WHERE fact_num = @fact_num;
    END
    ELSE
    BEGIN
      INSERT INTO pedidos (
        fact_num, contrib, fec_emis, fec_venc, co_cli, co_ven, co_tran, forma_pag,
        tot_bruto, tot_neto, iva, status, anulada, co_sucu, fe_us_in, fe_us_mo
      )
      VALUES (
        @fact_num, 1, GETDATE(), GETDATE(), @co_cli, @co_ven, '01    ', @forma_pag,
        @tot_bruto, @tot_neto, @iva, @status, 0, '01    ', GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);
  console.log(`[WriteToProfit] 💾 Pedido #${factNum} guardado exitosamente en Profit [pedidos].`);
  return { success: true, action: 'SAVE', fact_num: factNum };
}

/**
 * 6. Escribir o Anular Factura de Compra en tabla 'compras'
 */
export async function writePurchaseToProfitSql(pool, targetDb, purchaseData, action = 'SAVE') {
  const factNum = String(purchaseData.numeroFacturaProv || purchaseData.numero_factura_prov || purchaseData.fact_num || purchaseData.id || '').trim().toUpperCase();
  if (!factNum) throw new Error('Número de factura de compra requerido.');

  const request = pool.request();
  request.input('fact_num', sql.Char(20), factNum.substring(0, 20));

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      UPDATE compras SET anulada = 1, fe_us_mo = GETDATE() WHERE RTRIM(LTRIM(fact_num)) = RTRIM(LTRIM(@fact_num));
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Compra ${factNum} marcada como anulada en Profit [compras].`);
    return { success: true, action: 'DELETE', fact_num: factNum };
  }

  const coProv = String(purchaseData.proveedorId || purchaseData.proveedor_id || purchaseData.co_prov || '01').trim().substring(0, 10);
  const totBruto = Number(purchaseData.subtotalUsd || purchaseData.subtotal_usd || purchaseData.tot_bruto || 0);
  const totNeto = Number(purchaseData.totalUsd || purchaseData.total_usd || purchaseData.tot_neto || 0);
  const iva = Number(purchaseData.ivaGeneralUsd || purchaseData.iva_general_usd || purchaseData.iva || 0);
  const tasa = Number(purchaseData.tasaDolar || purchaseData.tasa_dolar || purchaseData.tasa || 1);

  request.input('co_prov', sql.Char(10), coProv);
  request.input('tot_bruto', sql.Decimal(18, 5), totBruto);
  request.input('tot_neto', sql.Decimal(18, 5), totNeto);
  request.input('iva', sql.Decimal(18, 5), iva);
  request.input('tasa', sql.Decimal(18, 5), tasa);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM compras WHERE RTRIM(LTRIM(fact_num)) = RTRIM(LTRIM(@fact_num)))
    BEGIN
      UPDATE compras
      SET co_prov = @co_prov,
          tot_bruto = @tot_bruto,
          tot_neto = @tot_neto,
          iva = @iva,
          tasa = @tasa,
          anulada = 0,
          fe_us_mo = GETDATE()
      WHERE RTRIM(LTRIM(fact_num)) = RTRIM(LTRIM(@fact_num));
    END
    ELSE
    BEGIN
      INSERT INTO compras (
        fact_num, fec_emis, fec_venc, co_prov, tot_bruto, tot_neto,
        iva, tasa, moneda, anulada, fe_us_in, fe_us_mo
      )
      VALUES (
        @fact_num, GETDATE(), GETDATE(), @co_prov, @tot_bruto, @tot_neto,
        @iva, @tasa, 'US$', 0, GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);

  // Incrementar stock si se especificó producto y cantidad
  const prodCode = (purchaseData.producto || purchaseData.co_art || '').trim().toUpperCase();
  const qty = Number(purchaseData.cantidad || 0);
  if (prodCode && qty > 0) {
    try {
      const reqStock = pool.request();
      reqStock.input('co_art', sql.Char(30), prodCode.substring(0, 30));
      reqStock.input('qty', sql.Decimal(18, 5), qty);
      await reqStock.query(`
        USE [${targetDb}];
        UPDATE art SET stock_act = stock_act + @qty, fe_us_mo = GETDATE()
        WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art));
      `);
    } catch (_) {}
  }

  console.log(`[WriteToProfit] 💾 Compra ${factNum} guardada exitosamente en Profit [compras].`);
  return { success: true, action: 'SAVE', fact_num: factNum };
}

/**
 * 7. Escribir o Eliminar Proveedor en tabla 'prov'
 */
export async function writeSupplierToProfitSql(pool, targetDb, supData, action = 'SAVE') {
  const coProv = String(supData.id || supData.codigo || supData.co_prov || '').trim().toUpperCase();
  if (!coProv) throw new Error('Código de proveedor requerido.');

  const request = pool.request();
  request.input('co_prov', sql.Char(10), coProv.substring(0, 10));

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      BEGIN TRY
        DELETE FROM prov WHERE RTRIM(LTRIM(co_prov)) = RTRIM(LTRIM(@co_prov));
      END TRY
      BEGIN CATCH
        UPDATE prov SET inactivo = 1, fe_us_mo = GETDATE() WHERE RTRIM(LTRIM(co_prov)) = RTRIM(LTRIM(@co_prov));
      END CATCH
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Proveedor ${coProv} eliminado/inactivado en Profit [prov].`);
    return { success: true, action: 'DELETE', co_prov: coProv };
  }

  const provDes = String(supData.nombre || supData.prov_des || coProv).trim().substring(0, 60);
  const rif = String(supData.rif || coProv).trim().toUpperCase().substring(0, 18);
  const direc1 = String(supData.direccion || supData.direc1 || '').trim().substring(0, 60);
  const telefonos = String(supData.telefono || supData.telefonos || '').trim().substring(0, 60);
  const inactivo = supData.activo === false ? 1 : 0;

  request.input('prov_des', sql.VarChar(60), provDes);
  request.input('rif', sql.VarChar(18), rif);
  request.input('direc1', sql.VarChar(60), direc1);
  request.input('telefonos', sql.VarChar(60), telefonos);
  request.input('inactivo', sql.Bit, inactivo);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM prov WHERE RTRIM(LTRIM(co_prov)) = RTRIM(LTRIM(@co_prov)))
    BEGIN
      UPDATE prov
      SET prov_des = @prov_des,
          rif = @rif,
          direc1 = @direc1,
          telefonos = @telefonos,
          inactivo = @inactivo,
          fe_us_mo = GETDATE()
      WHERE RTRIM(LTRIM(co_prov)) = RTRIM(LTRIM(@co_prov));
    END
    ELSE
    BEGIN
      INSERT INTO prov (
        co_prov, prov_des, rif, direc1, telefonos, inactivo,
        fecha_reg, fe_us_in, fe_us_mo
      )
      VALUES (
        @co_prov, @prov_des, @rif, @direc1, @telefonos, @inactivo,
        GETDATE(), GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);
  console.log(`[WriteToProfit] 💾 Proveedor ${coProv} guardado exitosamente en Profit [prov].`);
  return { success: true, action: 'SAVE', co_prov: coProv };
}

/**
 * 8. Escribir Movimiento de Caja / Cobro en tabla 'cobros'
 */
export async function writeCashMovementToProfitSql(pool, targetDb, movData, action = 'SAVE') {
  const cobNum = String(movData.id || movData.cob_num || `COB-${Date.now().toString(36)}`).trim().toUpperCase();
  const request = pool.request();
  request.input('cob_num', sql.Char(20), cobNum.substring(0, 20));

  if (action === 'DELETE') {
    const query = `
      USE [${targetDb}];
      SET DATEFORMAT dmy;
      UPDATE cobros SET anulado = 1, fe_us_mo = GETDATE() WHERE RTRIM(LTRIM(cob_num)) = RTRIM(LTRIM(@cob_num));
    `;
    await request.query(query);
    console.log(`[WriteToProfit] 🗑️ Movimiento / Cobro ${cobNum} marcado anulado en Profit [cobros].`);
    return { success: true, action: 'DELETE', cob_num: cobNum };
  }

  const descrip = String(movData.concepto || movData.descrip || 'Movimiento de Caja').trim().substring(0, 60);
  const montDoc = Number(movData.montoUsd || movData.monto_usd || movData.mont_doc || 0);
  const coVen = String(movData.usuario || movData.co_ven || 'VV').trim().substring(0, 6);

  request.input('descrip', sql.VarChar(60), descrip);
  request.input('mont_doc', sql.Decimal(18, 5), montDoc);
  request.input('co_ven', sql.Char(6), coVen);

  const query = `
    USE [${targetDb}];
    SET DATEFORMAT dmy;
    IF EXISTS (SELECT 1 FROM cobros WHERE RTRIM(LTRIM(cob_num)) = RTRIM(LTRIM(@cob_num)))
    BEGIN
      UPDATE cobros
      SET descrip = @descrip,
          mont_doc = @mont_doc,
          co_ven = @co_ven,
          anulado = 0,
          fe_us_mo = GETDATE()
      WHERE RTRIM(LTRIM(cob_num)) = RTRIM(LTRIM(@cob_num));
    END
    ELSE
    BEGIN
      INSERT INTO cobros (
        cob_num, fec_cob, co_cli, co_ven, descrip, mont_doc, moneda, anulado, fe_us_in, fe_us_mo
      )
      VALUES (
        @cob_num, GETDATE(), '01', @co_ven, @descrip, @mont_doc, 'US$', 0, GETDATE(), GETDATE()
      );
    END
  `;
  await request.query(query);
  console.log(`[WriteToProfit] 💾 Movimiento / Cobro ${cobNum} guardado en Profit [cobros].`);
  return { success: true, action: 'SAVE', cob_num: cobNum };
}

/**
 * 9. Drenar y ejecutar escrituras pendientes que quedaron encoladas durante desconexión
 */
export async function drainPendingWrites(pool, targetDb) {
  const queue = loadPendingWrites();
  if (queue.length === 0) return 0;

  console.log(`[WriteToProfit] 🔄 Procesando ${queue.length} escrituras pendientes acumuladas hacia SQL Server...`);
  const remaining = [];
  let processed = 0;

  for (const item of queue) {
    try {
      if (item.entityType === 'seller' || item.entityType === 'user') {
        await writeSellerToProfitSql(pool, targetDb, item.payload, item.action);
      } else if (item.entityType === 'product') {
        await writeProductToProfitSql(pool, targetDb, item.payload, item.action);
      } else if (item.entityType === 'client') {
        await writeClientToProfitSql(pool, targetDb, item.payload, item.action);
      } else if (item.entityType === 'sale') {
        await writeSaleToProfitSql(pool, targetDb, item.payload, item.action);
      } else if (item.entityType === 'order') {
        await writeOrderToProfitSql(pool, targetDb, item.payload, item.action);
      } else if (item.entityType === 'purchase') {
        await writePurchaseToProfitSql(pool, targetDb, item.payload, item.action);
      } else if (item.entityType === 'supplier') {
        await writeSupplierToProfitSql(pool, targetDb, item.payload, item.action);
      } else if (item.entityType === 'cash_movement') {
        await writeCashMovementToProfitSql(pool, targetDb, item.payload, item.action);
      }
      processed++;
    } catch (err) {
      console.warn(`[WriteToProfit] ⚠️ Fallo al procesar acción pendiente ${item.id} (${item.entityType}):`, err.message);
      remaining.push(item);
    }
  }

  savePendingWrites(remaining);
  console.log(`[WriteToProfit] ✅ ${processed} escrituras pendientes procesadas exitosamente (${remaining.length} restantes).`);
  return processed;
}

/**
 * 5. Comparativa y Reconciliación: Producto / Lubricante
 * Compara los campos nativos de Profit (art) con Supabase (products)
 * Verifica que los datos coincidan y confirma que la imagen permanezca segura en Supabase.
 */
export async function compareAndReconcileProduct(pool, targetDb, supabase, coArt) {
  const code = String(coArt || '').trim().toUpperCase();
  if (!code) return { inSync: false, error: 'Código de producto no especificado' };

  try {
    // 1. Obtener de SQL Server Profit Plus
    const req = pool.request();
    req.input('co_art', sql.Char(30), code.substring(0, 30));
    const sqlRes = await req.query(`
      USE [${targetDb}];
      SELECT RTRIM(LTRIM(co_art)) AS co_art,
             RTRIM(LTRIM(art_des)) AS art_des,
             RTRIM(LTRIM(modelo)) AS modelo,
             RTRIM(LTRIM(ref)) AS ref,
             RTRIM(LTRIM(uni_venta)) AS uni_venta,
             stock_act, stock_min, prec_vta1, prec_vta2, ult_cos_un, anulado
      FROM art
      WHERE RTRIM(LTRIM(co_art)) = RTRIM(LTRIM(@co_art));
    `);
    const profitItem = sqlRes.recordset[0] || null;

    // 2. Obtener de Supabase Cloud
    const { data: supaItem } = await supabase
      .from('products')
      .select('*')
      .or(`codigo.eq.${code},id.eq.${code}`)
      .maybeSingle();

    if (!profitItem && !supaItem) {
      return {
        entity: 'product',
        code,
        inSync: true,
        status: 'NON_EXISTENT_IN_BOTH',
        message: 'El producto no existe en ninguna plataforma (o fue eliminado)'
      };
    }

    if (!profitItem && supaItem) {
      return {
        entity: 'product',
        code,
        inSync: false,
        status: 'SUPABASE_ONLY',
        message: 'Existe en Supabase pero no en Profit Plus',
        supabaseData: {
          codigo: supaItem.codigo,
          descripcion: supaItem.descripcion,
          hasImage: Boolean(supaItem.imagen)
        }
      };
    }

    if (profitItem && !supaItem) {
      return {
        entity: 'product',
        code,
        inSync: false,
        status: 'PROFIT_ONLY',
        message: 'Existe en Profit Plus pero no en Supabase',
        profitData: profitItem
      };
    }

    // 3. Comparativa campo por campo
    const matched = [];
    const differences = [];

    const checks = [
      { field: 'codigo', profitVal: profitItem.co_art, supaVal: supaItem.codigo },
      { field: 'descripcion', profitVal: profitItem.art_des, supaVal: supaItem.descripcion },
      { field: 'stock', profitVal: Number(profitItem.stock_act), supaVal: Number(supaItem.stock) },
      { field: 'stock_minimo', profitVal: Number(profitItem.stock_min), supaVal: Number(supaItem.stock_minimo) },
      { field: 'precio_usd_detal', profitVal: Number(profitItem.prec_vta1), supaVal: Number(supaItem.precio_usd_detal) },
      { field: 'precio_usd_mayor', profitVal: Number(profitItem.prec_vta2), supaVal: Number(supaItem.precio_usd_mayor) },
      { field: 'costo_usd', profitVal: Number(profitItem.ult_cos_un), supaVal: Number(supaItem.costo_usd) }
    ];

    for (const c of checks) {
      let isSame = false;
      if (typeof c.profitVal === 'number' && typeof c.supaVal === 'number') {
        isSame = Math.abs(c.profitVal - c.supaVal) < 0.001;
      } else {
        isSame = String(c.profitVal || '').trim().toLowerCase() === String(c.supaVal || '').trim().toLowerCase();
      }

      if (isSame) {
        matched.push(c.field);
      } else {
        differences.push({
          field: c.field,
          profitValue: c.profitVal,
          supabaseValue: c.supaVal
        });
      }
    }

    // 4. Si hay discrepancias en campos comunes, reconciliar en Supabase preservando la imagen
    if (differences.length > 0) {
      console.log(`[Reconcile/Product] ⚖️ Discrepancias detectadas en ${code}: ${differences.map(d => d.field).join(', ')}. Reconciliando...`);
      await supabase.from('products').update({
        descripcion: profitItem.art_des,
        stock: Number(profitItem.stock_act),
        stock_minimo: Number(profitItem.stock_min),
        precio_usd_detal: Number(profitItem.prec_vta1),
        precio_usd_mayor: Number(profitItem.prec_vta2),
        costo_usd: Number(profitItem.ult_cos_un),
        updated_at: new Date().toISOString()
      }).eq('id', supaItem.id);
    }

    const hasBase64Image = supaItem.imagen?.startsWith('data:image');
    const hasUrlImage = Boolean(supaItem.imagen && !hasBase64Image);

    return {
      entity: 'product',
      code,
      inSync: true,
      reconciled: differences.length > 0,
      matchedFields: matched,
      differencesResolved: differences,
      imageInfo: {
        savedInSupabase: Boolean(supaItem.imagen),
        imageFormat: hasBase64Image ? 'Base64 (Optimizado)' : (hasUrlImage ? 'URL' : 'Ninguna'),
        excludedFromProfit: true,
        profitStorageSafe: true
      },
      profitData: {
        co_art: profitItem.co_art,
        art_des: profitItem.art_des,
        stock_act: Number(profitItem.stock_act),
        stock_min: Number(profitItem.stock_min),
        prec_vta1: Number(profitItem.prec_vta1),
        prec_vta2: Number(profitItem.prec_vta2),
        ult_cos_un: Number(profitItem.ult_cos_un),
        anulado: Boolean(profitItem.anulado)
      },
      supabaseData: {
        id: supaItem.id,
        codigo: supaItem.codigo,
        descripcion: supaItem.descripcion,
        stock: Number(supaItem.stock),
        stock_minimo: Number(supaItem.stock_minimo),
        precio_usd_detal: Number(supaItem.precio_usd_detal),
        precio_usd_mayor: Number(supaItem.precio_usd_mayor),
        costo_usd: Number(supaItem.costo_usd),
        hasImage: Boolean(supaItem.imagen)
      }
    };
  } catch (err) {
    console.warn(`[Compare/Product] Error comparando producto ${code}:`, err.message);
    return { entity: 'product', code, inSync: false, error: err.message };
  }
}

/**
 * 6. Comparativa y Reconciliación: Cliente
 */
export async function compareAndReconcileClient(pool, targetDb, supabase, coCli) {
  const code = String(coCli || '').trim().toUpperCase();
  if (!code) return { inSync: false, error: 'Código de cliente no especificado' };

  try {
    const req = pool.request();
    req.input('co_cli', sql.Char(30), code.substring(0, 30));
    const sqlRes = await req.query(`
      USE [${targetDb}];
      SELECT RTRIM(LTRIM(co_cli)) AS co_cli,
             RTRIM(LTRIM(cli_des)) AS cli_des,
             RTRIM(LTRIM(rif)) AS rif,
             RTRIM(LTRIM(tipo)) AS tipo,
             CAST(direc1 AS varchar(255)) AS direc1,
             RTRIM(LTRIM(telefonos)) AS telefonos,
             RTRIM(LTRIM(email)) AS email,
             mont_cre, plaz_pag,
             RTRIM(LTRIM(co_ven)) AS co_ven,
             inactivo
      FROM clientes
      WHERE RTRIM(LTRIM(co_cli)) = RTRIM(LTRIM(@co_cli));
    `);
    const profitItem = sqlRes.recordset[0] || null;

    const { data: supaItem } = await supabase
      .from('clients')
      .select('*')
      .or(`codigo.eq.${code},id.eq.${code}`)
      .maybeSingle();

    if (!profitItem && !supaItem) {
      return { entity: 'client', code, inSync: true, status: 'NON_EXISTENT_IN_BOTH' };
    }

    const matched = [];
    const differences = [];
    if (profitItem && supaItem) {
      const checks = [
        { field: 'nombre', profitVal: profitItem.cli_des, supaVal: supaItem.nombre || supaItem.cli_des },
        { field: 'rif', profitVal: profitItem.rif, supaVal: supaItem.rif },
        { field: 'limite_credito', profitVal: Number(profitItem.mont_cre || 0), supaVal: Number(supaItem.limite_credito_usd ?? supaItem.limite_credito ?? 0) },
        { field: 'dias_credito', profitVal: Number(profitItem.plaz_pag || 0), supaVal: Number(supaItem.dias_credito ?? 0) },
        { field: 'vendedor_asignado', profitVal: profitItem.co_ven, supaVal: supaItem.vendedor_asignado || supaItem.co_ven }
      ];
      for (const c of checks) {
        let isSame = false;
        if (typeof c.profitVal === 'number' && typeof c.supaVal === 'number') {
          isSame = Math.abs(c.profitVal - c.supaVal) < 0.001;
        } else {
          isSame = String(c.profitVal || '').trim().toLowerCase() === String(c.supaVal || '').trim().toLowerCase();
        }
        if (isSame) matched.push(c.field);
        else differences.push({ field: c.field, profitValue: c.profitVal, supabaseValue: c.supaVal });
      }
    }

    return {
      entity: 'client',
      code,
      inSync: differences.length === 0,
      matchedFields: matched,
      differencesResolved: differences,
      profitData: profitItem,
      supabaseData: supaItem
    };
  } catch (err) {
    return { entity: 'client', code, inSync: false, error: err.message };
  }
}

/**
 * 7. Comparativa y Reconciliación: Vendedor / Asesor
 */
export async function compareAndReconcileSeller(pool, targetDb, supabase, sellerData) {
  const coVen = resolveSellerCode(sellerData);
  if (!coVen) return { inSync: true, message: 'Usuario sin código de vendedor en Profit (exclusivo de Supabase)' };

  try {
    const req = pool.request();
    req.input('co_ven', sql.Char(6), coVen.padEnd(6, ' ').substring(0, 6));
    const sqlRes = await req.query(`
      USE [${targetDb}];
      SELECT RTRIM(LTRIM(co_ven)) AS co_ven,
             RTRIM(LTRIM(ven_des)) AS ven_des,
             RTRIM(LTRIM(cedula)) AS cedula,
             RTRIM(LTRIM(direc1)) AS direc1,
             RTRIM(LTRIM(telefonos)) AS telefonos,
             RTRIM(LTRIM(tipo)) AS tipo,
             comision
      FROM vendedor
      WHERE RTRIM(LTRIM(co_ven)) = RTRIM(LTRIM(@co_ven));
    `);
    const profitItem = sqlRes.recordset[0] || null;

    const { data: supaUser } = await supabase
      .from('users')
      .select('*')
      .or(`co_ven.eq.${coVen},id.eq.${sellerData.id || coVen}`)
      .maybeSingle();

    const { data: supaSeller } = await supabase
      .from('profit_sellers')
      .select('*')
      .eq('co_ven', coVen)
      .maybeSingle();

    const matched = [];
    const differences = [];
    if (profitItem && supaSeller) {
      const checks = [
        { field: 'ven_des', profitVal: profitItem.ven_des, supaVal: supaSeller.ven_des },
        { field: 'cedula', profitVal: profitItem.cedula, supaVal: supaSeller.cedula },
        { field: 'comision', profitVal: Number(profitItem.comision), supaVal: Number(supaSeller.comision_pct) }
      ];
      for (const c of checks) {
        let isSame = false;
        if (typeof c.profitVal === 'number' && typeof c.supaVal === 'number') {
          isSame = Math.abs(c.profitVal - c.supaVal) < 0.001;
        } else {
          isSame = String(c.profitVal || '').trim().toLowerCase() === String(c.supaVal || '').trim().toLowerCase();
        }
        if (isSame) matched.push(c.field);
        else differences.push({ field: c.field, profitValue: c.profitVal, supabaseValue: c.supaVal });
      }
    }

    const hasBase64Photo = supaSeller?.foto?.startsWith('data:image') || supaUser?.foto?.startsWith('data:image');

    return {
      entity: 'seller',
      co_ven: coVen,
      inSync: differences.length === 0,
      matchedFields: matched,
      differencesResolved: differences,
      photoInfo: {
        savedInSupabase: Boolean(supaSeller?.foto || supaUser?.foto),
        format: hasBase64Photo ? 'Base64 (Optimizado)' : 'URL / Avatar',
        excludedFromProfit: true,
        profitStorageSafe: true
      },
      profitData: profitItem,
      supabaseUser: supaUser,
      supabaseSeller: supaSeller
    };
  } catch (err) {
    return { entity: 'seller', co_ven: coVen, inSync: false, error: err.message };
  }
}

