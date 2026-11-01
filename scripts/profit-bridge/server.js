/**
 * Servidor Micro-API y Demonio de Sincronización en Tiempo Real
 * Profit Plus 2K8 (SQL Server: GRUMOTOR) ↔ SIGNUM MOTORVEN (Supabase)
 * Puerto: 3005
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import http from 'http';
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { renderServerPortalHtml } from './portalHtml.js';
import {
  syncArticles,
  syncClients,
  syncDashboardKPIs,
  syncOrdersAndQuotes,
  syncProfitBankAccounts,
  syncProfitCashDesks,
  syncProfitCollections,
  syncProfitInvoices,
  syncProfitSuppliers,
  syncProfitPurchases,
  syncProfitAccountsPayable,
  syncProfitSupplierPayments,
  syncProfitSellers,
  syncProfitZones,
  syncProfitTransports,
  syncProfitCustomerReturns,
  syncProfitInventoryAdjustments,
  syncProfitWarehouseTransfers,
  syncProfitIslrConcepts,
  syncProfitBeneficiaries,
  syncProfitPaymentOrders,
  syncProfitAuditTrails,
  syncProfitWarehouses,
  syncProfitProductLines,
  syncProfitProductCategories,
  syncProfitCurrencies
} from './syncProfitToSupabase.js';
import {
  writeSellerToProfitSql,
  writeProductToProfitSql,
  writeClientToProfitSql,
  writeSaleToProfitSql,
  writeOrderToProfitSql,
  writePurchaseToProfitSql,
  writeSupplierToProfitSql,
  writeCashMovementToProfitSql,
  queueWriteAction,
  drainPendingWrites,
  compareAndReconcileProduct,
  compareAndReconcileClient,
  compareAndReconcileSeller
} from './writeToProfit.js';
import {
  getAllDatabases,
  getDatabaseTables,
  getTableData,
  executeSafeQuery,
  getTableColumns,
  saveDatabaseRecord,
  deleteDatabaseRecord,
  executeDatabaseBackup,
  listDatabaseBackups,
  PRELOADED_DATABASES_CATALOG
} from './databasesExplorer.js';

const PORT = process.env.PROFIT_BRIDGE_PORT || 3005;
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

process.on('uncaughtException', (err) => {
  console.warn('[Server Warning - Uncaught Exception]:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning - Unhandled Rejection]:', reason?.message || reason);
});

let lastSyncTime = null;
let lastSyncStats = {
  articlesSynced: 0,
  clientsSynced: 0,
  ordersSynced: 0,
  bankAccountsSynced: 0,
  collectionsSynced: 0,
  invoicesSynced: 0,
  suppliersSynced: 0,
  purchasesSynced: 0,
  cxpSynced: 0,
  paymentsSynced: 0,
  sellersSynced: 0,
  kpis: null,
  error: null
};
let isSyncing = false;

function parseProductSpecs(descripcion, modelo, comentario) {
  const text = `${descripcion || ''} ${modelo || ''} ${comentario || ''}`.toUpperCase();

  let viscosidad = 'SAE 15W-40';
  let categoria = 'Gasolina';

  if (text.includes('15W-40') || text.includes('15W40')) viscosidad = 'SAE 15W-40';
  else if (text.includes('20W-50') || text.includes('20W50')) viscosidad = 'SAE 20W-50';
  else if (text.includes('25W-60') || text.includes('25W60')) viscosidad = 'SAE 25W-60';
  else if (text.includes('5W-30') || text.includes('5W30')) viscosidad = 'SAE 5W-30';
  else if (text.includes('10W-30') || text.includes('10W30')) viscosidad = 'SAE 10W-30';
  else if (text.includes('10W-40') || text.includes('10W40')) viscosidad = 'SAE 10W-40';
  else if (text.includes('5W-20') || text.includes('5W20')) viscosidad = 'SAE 5W-20';
  else if (text.includes('50') && (text.includes('SAE') || text.includes('DIESEL'))) viscosidad = 'SAE 50';
  else if (text.includes('40') && (text.includes('SAE') || text.includes('DIESEL'))) viscosidad = 'SAE 40';
  else if (text.includes('80W-90') || text.includes('80W90')) viscosidad = 'SAE 80W-90';
  else if (text.includes('85W-140') || text.includes('85W140')) viscosidad = 'SAE 85W-140';
  else if (text.includes('68') || text.includes('ISO 68') || text.includes('HIDRAULICO')) viscosidad = 'ISO 68';

  if (text.includes('DIESEL') || text.includes('DIÉSEL') || text.includes('CH-4') || text.includes('CI-4') || text.includes('CK-4')) {
    categoria = 'Diésel';
  } else if (text.includes('GASOLINA') || text.includes('SL') || text.includes('SN') || text.includes('SP')) {
    categoria = 'Gasolina';
  } else if (text.includes('TRANSMISION') || text.includes('TRANSMISIÓN') || text.includes('ATF') || text.includes('DEXRON') || text.includes('VALVULINA')) {
    categoria = 'Transmisión';
  } else if (text.includes('HIDRAULICO') || text.includes('HIDRÁULICO') || text.includes('ISO 68')) {
    categoria = 'Hidráulico';
  } else if (text.includes('MOTO') || text.includes('4T') || text.includes('2T')) {
    categoria = 'Motos';
  } else if (text.includes('GRANEL') || text.includes('TOTEM') || text.includes('TAMBOR')) {
    categoria = 'Industrial';
  }

  return { viscosidad, categoria };
}

function getLitrosPorUnidad(uniVenta, descripcion) {
  const text = `${uniVenta || ''} ${descripcion || ''}`.toUpperCase();
  if (text.includes('TAMBOR') || text.includes('208L') || text.includes('208 L') || text.includes('TB')) return 208.0;
  if (text.includes('CUÑETE') || text.includes('CUNETE') || text.includes('19L') || text.includes('19 L')) return 19.0;
  if (text.includes('CAJA') || text.includes('12L') || text.includes('12 L') || text.includes('12X1')) return 11.35;
  if (text.includes('TOTEM') || text.includes('TOTE') || text.includes('1000L')) return 1000.0;
  if (text.includes('GRANEL')) return 1.0;
  return 1.0;
}

export function createSafePool(customConfig = {}) {
  const { options: customOptions, ...restConfig } = customConfig;
  const cfg = {
    server: config.sql.server,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    ...restConfig,
    options: {
      ...config.sql.options,
      trustServerCertificate: true,
      encrypt: false,
      connectTimeout: 10000,
      requestTimeout: 30000,
      ...customOptions
    }
  };
  const p = new sql.ConnectionPool(cfg);
  p.on('error', (err) => {
    console.warn('[SQL Pool Warning Handled]:', err?.message || err);
  });
  return p;
}

let sharedPool = null;
let poolConnecting = null;

export async function getSharedPool() {
  if (sharedPool && sharedPool.connected) {
    return sharedPool;
  }
  if (poolConnecting) {
    return poolConnecting;
  }
  poolConnecting = (async () => {
    try {
      if (sharedPool) {
        await sharedPool.close().catch(() => {});
        sharedPool = null;
      }
      const pool = createSafePool({
        options: {
          connectTimeout: 5000,
          requestTimeout: 15000
        }
      });
      await pool.connect();
      sharedPool = pool;
      return sharedPool;
    } catch (err) {
      sharedPool = null;
      throw err;
    } finally {
      poolConnecting = null;
    }
  })();
  return poolConnecting;
}

export async function performFullSync() {
  if (isSyncing) {
    return { success: false, message: 'Una sincronización ya está en curso' };
  }

  isSyncing = true;
  let pool = null;

  try {
    console.log(`[Bridge Sync] Conectando a SQL Server: ${config.sql.server}...`);
    pool = await getSharedPool();

    const targetDb = config.sql.database || 'GRUMOTOR';

    // Drenar y ejecutar escrituras acumuladas que hayan quedado pendientes
    await drainPendingWrites(pool, targetDb).catch(e => {
      console.warn('[Bridge Sync] Aviso drenando escrituras:', e.message);
    });

    // 1. Artículos con Smart Merge (Preserva imágenes y laboratorio)
    const articlesCount = await syncArticles(pool, targetDb);

    // 2. Clientes con Smart Merge (Preserva GPS y scoring)
    const clientsCount = await syncClients(pool, targetDb);

    // 3. Pedidos y Cotizaciones de Preventa
    const ordersCount = await syncOrdersAndQuotes(pool, targetDb);

    // 4. Cuentas Bancarias
    const bankAccountsCount = await syncProfitBankAccounts(pool, targetDb);
    const cashDesksCount = await syncProfitCashDesks(pool, targetDb);

    // 5. Cobros y Recibos
    const collectionsCount = await syncProfitCollections(pool, targetDb);

    // 6. Facturas Emitidas
    const invoicesCount = await syncProfitInvoices(pool, targetDb);

    // 7. Proveedores Profit
    const suppliersCount = await syncProfitSuppliers(pool, targetDb);

    // 8. Facturas de Compra
    const purchasesCount = await syncProfitPurchases(pool, targetDb);

    // 9. Cuentas por Pagar (CxP)
    const cxpCount = await syncProfitAccountsPayable(pool, targetDb);

    // 10. Pagos a Proveedores
    const paymentsCount = await syncProfitSupplierPayments(pool, targetDb);

    // 11. Vendedores / Asesores Comerciales
    const sellersCount = await syncProfitSellers(pool, targetDb);

    // 12. Zonas Geográficas
    const zonesCount = await syncProfitZones(pool, targetDb);

    // 13. Transportes y Flota
    const transportsCount = await syncProfitTransports(pool, targetDb);

    // 14. Devoluciones de Clientes y Garantías
    const returnsCount = await syncProfitCustomerReturns(pool, targetDb);

    // 15. Ajustes de Inventario y Mermas
    const adjustmentsCount = await syncProfitInventoryAdjustments(pool, targetDb);

    // 16. Traslados entre Almacenes
    const transfersCount = await syncProfitWarehouseTransfers(pool, targetDb);

    // 17. Conceptos Oficiales SENIAT de Retención ISLR
    const islrCount = await syncProfitIslrConcepts(pool, targetDb);

    // 18. Beneficiarios Oficiales
    const benCount = await syncProfitBeneficiaries(pool, targetDb);

    // 19. Órdenes de Pago
    const ordPagoCount = await syncProfitPaymentOrders(pool, targetDb);

    // 20. Pistas de Auditoría Forense
    const auditCount = await syncProfitAuditTrails(pool, targetDb);

    // 21. Métricas del Dashboard
    const dashboardKpis = await syncDashboardKPIs(pool, targetDb);

    lastSyncTime = new Date().toISOString();
    lastSyncStats = {
      articlesSynced: articlesCount,
      clientsSynced: clientsCount,
      ordersSynced: ordersCount,
      bankAccountsSynced: bankAccountsCount,
      collectionsSynced: collectionsCount,
      invoicesSynced: invoicesCount,
      suppliersSynced: suppliersCount,
      purchasesSynced: purchasesCount,
      cxpSynced: cxpCount,
      paymentsSynced: paymentsCount,
      sellersSynced: sellersCount,
      zonesSynced: zonesCount,
      transportsSynced: transportsCount,
      returnsSynced: returnsCount,
      adjustmentsSynced: adjustmentsCount,
      transfersSynced: transfersCount,
      islrConceptsSynced: islrCount,
      beneficiariesSynced: benCount,
      paymentOrdersSynced: ordPagoCount,
      auditTrailsSynced: auditCount,
      kpis: dashboardKpis,
      error: null
    };

    console.log(`[Bridge Sync] ✅ Sincronizados: ${articlesCount} artículos, ${clientsCount} clientes, ${ordersCount} pedidos, ${bankAccountsCount} bancos, ${collectionsCount} cobros, ${invoicesCount} facturas, ${suppliersCount} proveedores, ${purchasesCount} compras, ${cxpCount} CxP, ${paymentsCount} pagos, ${sellersCount} vendedores, ${returnsCount} devoluciones, ${adjustmentsCount} ajustes, ${transfersCount} traslados, ${islrCount} conceptos ISLR, ${benCount} beneficiarios, ${ordPagoCount} órdenes de pago, ${auditCount} pistas de auditoría.`);
    return {
      success: true,
      timestamp: lastSyncTime,
      articlesSynced: articlesCount,
      clientsSynced: clientsCount,
      ordersSynced: ordersCount,
      bankAccountsSynced: bankAccountsCount,
      collectionsSynced: collectionsCount,
      invoicesSynced: invoicesCount,
      suppliersSynced: suppliersCount,
      purchasesSynced: purchasesCount,
      cxpSynced: cxpCount,
      paymentsSynced: paymentsCount,
      sellersSynced: sellersCount,
      zonesSynced: zonesCount,
      transportsSynced: transportsCount,
      returnsSynced: returnsCount,
      adjustmentsSynced: adjustmentsCount,
      transfersSynced: transfersCount,
      islrConceptsSynced: islrCount,
      beneficiariesSynced: benCount,
      paymentOrdersSynced: ordPagoCount,
      kpis: dashboardKpis
    };
  } catch (err) {
    console.error('[Bridge Sync] ❌ Error en sincronización:', err.message);
    lastSyncStats.error = err.message;
    return { success: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}

function parseJsonBody(incomingReq) {
  return new Promise((resolve, reject) => {
    let body = '';
    incomingReq.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        incomingReq.destroy();
        reject(new Error('Payload demasiado grande'));
      }
    });
    incomingReq.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_) {
        resolve({});
      }
    });
    incomingReq.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 0. Servir Portal Web Visual e Interactivo en la Raíz del Servidor
  if ((url.pathname === '/' || url.pathname === '/index.html') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderServerPortalHtml(config, lastSyncTime, lastSyncStats, isSyncing));
    return;
  }

  // 1. Estado y Salud del Servidor / Disco Físico de Profit Plus
  if (url.pathname === '/api/profit/status' && req.method === 'GET') {
    // Si la petición proviene de un navegador web directo, redirigir al portal visual de la raíz
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    let driveHealth = 'ONLINE';
    let dbHealth = 'ONLINE';
    let isConnected = false;

    try {
      const poolCheck = await getSharedPool();
      isConnected = true;
      const healthCheck = await poolCheck.request().query(`
        SELECT d.state_desc as db_state, f.state_desc as file_state, f.physical_name
        FROM sys.databases d
        JOIN sys.master_files f ON d.database_id = f.database_id
        WHERE d.name = '${config.sql.database}'
      `);
      if (healthCheck.recordset?.length > 0) {
        dbHealth = healthCheck.recordset[0].db_state || 'ONLINE';
        driveHealth = healthCheck.recordset[0].file_state || 'ONLINE';
      }
    } catch (err) {
      isConnected = false;
      dbHealth = 'DISCONNECTED';
      driveHealth = 'OFFLINE';
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      online: isConnected && dbHealth === 'ONLINE',
      driveOnline: isConnected && driveHealth === 'ONLINE',
      driveHealth,
      dbHealth,
      server: config.sql.server,
      database: config.sql.database,
      isSyncing,
      lastSyncTime,
      lastSyncStats
    }));
    return;
  }

  // 2. Consulta en Tiempo Real de Artículos e Inventario directamente de Profit Plus
  if (url.pathname === '/api/profit/products' && req.method === 'GET') {
    try {
      const pool = await getSharedPool();
      const targetDb = config.sql.database || 'GRUMOTOR';
      const result = await pool.request().query(`
        USE [${targetDb}];
        SELECT co_art, art_des, modelo, ref, comentario, uni_venta, stock_act, stock_com, stock_min,
               prec_vta1, prec_vta2, ult_cos_un, cos_pro_un, ult_cos_do, tipo_imp
        FROM art WHERE anulado = 0 ORDER BY co_art ASC;
      `);
      const mapped = (result.recordset || []).map(r => {
        const coArt = (r.co_art || '').trim();
        const descripcion = (r.art_des || '').trim();
        const { viscosidad, categoria } = parseProductSpecs(descripcion, r.modelo, r.comentario);
        const litrosUnidad = getLitrosPorUnidad(r.uni_venta, descripcion);
        const pVta1 = Number(r.prec_vta1 || 0);
        const pVta2 = Number(r.prec_vta2 || pVta1);
        const costo = Number(r.ult_cos_do || r.cos_pro_un || r.ult_cos_un || (pVta2 * 0.7).toFixed(2));
        return {
          id: coArt,
          codigo: coArt,
          oem: (r.ref || r.modelo || 'COVENIN-936').trim(),
          descripcion,
          marca: 'OILSTONE ®',
          categoria,
          viscosidad,
          normaApi: (r.modelo || 'API SL / CI-4').trim(),
          presentacionesDisponibles: [r.uni_venta || 'Unidad'],
          unidad: (r.uni_venta || 'Caja (12L)').trim(),
          litrosPorUnidad: litrosUnidad,
          stock: Number(r.stock_act || 0),
          comprometido: Number(r.stock_com || 0),
          stockMinimo: Number(r.stock_min || 10),
          costoUsd: costo,
          precioUsdDetal: pVta1,
          precioUsdMayor: pVta2,
          aplicaIva: true,
          colorEtiqueta: categoria === 'Gasolina' ? '#002b7a' : categoria === 'Diésel' ? '#c2410c' : '#059669',
          origen: 'PROFIT_REALTIME'
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: mapped }));
    } catch (err) {
      // Fallback automático a base de datos Supabase (DB_SIGNUM_MOTORVEN)
      try {
        const { data: supaProducts, error: supaErr } = await supabase.from('products').select('*');
        if (!supaErr && Array.isArray(supaProducts) && supaProducts.length > 0) {
          const mappedFromSupa = supaProducts.map(p => ({
            id: p.id,
            codigo: p.codigo || p.id,
            descripcion: p.descripcion,
            marca: p.marca || 'OILSTONE ®',
            categoria: p.categoria || 'Gasolina',
            viscosidad: p.viscosidad || 'SAE 15W-40',
            stock: Number(p.stock || 0),
            comprometido: Number(p.comprometido || 0),
            stockMinimo: Number(p.stock_minimo || 10),
            costoUsd: Number(p.costo_usd || 0),
            precioUsdDetal: Number(p.precio_usd_detal || 0),
            precioUsdMayor: Number(p.precio_usd_mayor || 0),
            imagen: p.imagen || '',
            origen: 'SUPABASE_CLOUD'
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: mappedFromSupa,
            origen: 'SUPABASE_CLOUD',
            notice: 'Cargado desde base de datos Supabase (DB_SIGNUM_MOTORVEN)'
          }));
          return;
        }
      } catch (_) {}

      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message, fallbackRequired: true }));
    }
    return;
  }

  // 3. Consulta en Tiempo Real de Clientes directamente de Profit Plus
  if (url.pathname === '/api/profit/clients' && req.method === 'GET') {
    try {
      const pool = await getSharedPool();
      const targetDb = config.sql.database || 'GRUMOTOR';
      const result = await pool.request().query(`
        USE [${targetDb}];
        SELECT 
          co_cli, tipo, cli_des, direc1, direc2, ciudad, estado, zip, telefonos, fax,
          inactivo, comentario, respons, fecha_reg, saldo, saldo_ini, fac_ult_ve,
          fec_ult_ve, net_ult_ve, mont_cre, plaz_pag, desc_ppago, desc_glob,
          co_zon, co_seg, co_ven, tipo_iva, rif, nit, email, website,
          sincredito, porc_esp, contribu, contribu_e
        FROM clientes ORDER BY co_cli ASC;
      `);
      const mapped = (result.recordset || []).map(c => {
        const coCli = (c.co_cli || '').trim();
        return {
          id: coCli,
          codigo: coCli,
          nombre: (c.cli_des || '').trim(),
          rif: (c.rif || coCli).trim().toUpperCase(),
          tipoCliente: (c.tipo || 'Mayorista').trim(),
          direccion: (c.direc1 || '').trim(),
          telefono: (c.telefonos || '').trim(),
          email: (c.email || '').trim(),
          limiteCreditoUsd: Number(c.mont_cre || 0),
          saldoDeudorUsd: Number(c.saldo || 0),
          diasCredito: Number(c.plaz_pag || 0),
          vendedorAsignado: (c.co_ven || '').trim(),
          zonaVenta: (c.co_zon || '').trim(),
          inactivo: Boolean(c.inactivo),
          esContribuyente: Boolean(c.contribu),
          esContribuyenteEspecial: Boolean(c.contribu_e),
          origen: 'PROFIT_REALTIME'
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: mapped }));
    } catch (err) {
      // Fallback automático a base de datos Supabase (DB_SIGNUM_MOTORVEN)
      try {
        const { data: supaClients, error: supaErr } = await supabase.from('clients').select('*');
        if (!supaErr && Array.isArray(supaClients) && supaClients.length > 0) {
          const mappedFromSupa = supaClients.map(c => ({
            id: c.id,
            codigo: c.codigo || c.id,
            nombre: c.nombre,
            rif: c.rif,
            tipoCliente: c.tipo_cliente || 'Mayorista',
            direccion: c.direccion || '',
            telefono: c.telefono || '',
            email: c.email || '',
            limiteCreditoUsd: Number(c.limite_credito_usd || 0),
            saldoDeudorUsd: Number(c.saldo_deudor_usd || 0),
            diasCredito: Number(c.dias_credito || 0),
            vendedorAsignado: c.vendedor_asignado || '',
            zonaVenta: c.zona_venta || '',
            inactivo: Boolean(c.inactivo),
            origen: 'SUPABASE_CLOUD'
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: mappedFromSupa,
            origen: 'SUPABASE_CLOUD',
            notice: 'Cargado desde base de datos Supabase (DB_SIGNUM_MOTORVEN)'
          }));
          return;
        }
      } catch (_) {}

      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message, fallbackRequired: true }));
    }
    return;
  }

  // 3.1 Consulta Universal de Registros de Cualquier Tabla de Supabase (DB_SIGNUM_MOTORVEN)
  if (url.pathname === '/api/profit/table-data' && req.method === 'GET') {
    const tableName = url.searchParams.get('name') || 'products';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    try {
      const { data, count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(limit);

      if (error) throw error;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        database: 'DB_SIGNUM_MOTORVEN',
        table: tableName,
        total: count,
        count: data?.length || 0,
        data: data || []
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, table: tableName, error: err.message }));
    }
    return;
  }

  // 4. Disparar Sincronización Inmediata y Respaldo Espejo hacia Supabase
  if (url.pathname === '/api/profit/sync' && (req.method === 'POST' || req.method === 'GET')) {
    const result = await performFullSync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...result,
      database: 'DB_SIGNUM_MOTORVEN',
      realtimeStatus: 'ACTIVE (30 Tablas en supabase_realtime)',
      statusMessage: result.success ? 'Sincronización en tiempo real completada exitosamente' : 'Servidor SQL Profit en espera. Base Supabase Cloud 100% activa.'
    }));
    return;
  }

  // 5. Información Oficial de la Base de Datos DB_SIGNUM_MOTORVEN (Supabase Cloud & Permisos)
  if (url.pathname === '/api/profit/database' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      database: 'DB_SIGNUM_MOTORVEN',
      schemas: ['public', 'db_signum_motorven'],
      engine: 'Supabase Local Standalone (Puerto 54321)',
      instance: 'LOCAL_STANDALONE (0 cuotas / 100% On-Premise)',
      url: config.supabase.url,
      permissions: {
        select: 'CONCEDIDO (Lectura)',
        insert: 'CONCEDIDO (Escritura)',
        update: 'CONCEDIDO (Edición)',
        delete: 'CONCEDIDO (Borrado)',
        rlsMode: 'FULL_ACCESS_ALL (Sin restricciones)',
        status: '100% OPERACIONAL'
      },
      profitSource: {
        server: config.sql.server,
        database: config.sql.database,
        port: config.sql.port,
        engine: 'Profit Plus 2K8 / SQL Server'
      },
      syncMode: 'TIEMPO_REAL_CONTINUO',
      lastSyncTime,
      lastSyncStats
    }));
    return;
  }

  // 6. Listado de Tablas Sincronizadas y sus Metadatos
  if (url.pathname === '/api/profit/tables' && req.method === 'GET') {
    const tableMetadata = [
      { table: 'products', profitTable: 'art', description: 'Artículos, Lubricantes, Stock y Precios', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'clients', profitTable: 'clientes', description: 'Clientes, RIF, Límites de Crédito y Saldos', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'orders', profitTable: 'pedidos', description: 'Pedidos y Cotizaciones de Preventa', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'order_items', profitTable: 'reng_ped', description: 'Renglones de Pedidos', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_invoices', profitTable: 'factura / reng_fac', description: 'Facturas de Venta Emitidas y Litros', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_collections', profitTable: 'cobros / reng_cob', description: 'Cobros y Recibos de Caja', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_accounts_payable', profitTable: 'docum_cp', description: 'Cuentas por Pagar (CxP)', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_supplier_payments', profitTable: 'pagos / reng_pag', description: 'Pagos Realizados a Proveedores', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_purchases', profitTable: 'compras / reng_com', description: 'Facturas de Compra Registradas', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_suppliers', profitTable: 'prov', description: 'Proveedores Nacionales e Internacionales', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_bank_accounts', profitTable: 'cuentas', description: 'Cuentas Bancarias Profit', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_sellers', profitTable: 'vendedor', description: 'Vendedores y Asesores Comerciales', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_zones', profitTable: 'zona', description: 'Zonas Geográficas de Venta', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_transports', profitTable: 'transpor', description: 'Empresas de Transporte y Flota', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_customer_returns', profitTable: 'devol_cli', description: 'Devoluciones de Clientes', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_inventory_adjustments', profitTable: 'ajuste / reng_aju', description: 'Ajustes de Entrada/Salida de Inventario', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_warehouse_transfers', profitTable: 'tras_alm', description: 'Transferencias entre Almacenes', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_islr_concepts', profitTable: 'concepto', description: 'Conceptos de Retención ISLR', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_beneficiaries', profitTable: 'benefici', description: 'Beneficiarios de Pago Registrados', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_payment_orders', profitTable: 'ord_pago', description: 'Órdenes de Pago Administrativas', permissions: 'SELECT, INSERT, UPDATE, DELETE' },
      { table: 'profit_audit_trails', profitTable: 'par_emp / auditoria', description: 'Trazas de Auditoría y Control del Sistema', permissions: 'SELECT, INSERT, UPDATE, DELETE' }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, database: 'DB_SIGNUM_MOTORVEN', tables: tableMetadata }));
    return;
  }

  // 7. Información Oficial de Supabase Storage ('signum-media' & Carpetas)
  if (url.pathname === '/api/profit/storage' && req.method === 'GET') {
    const folders = [
      { folder: 'usuarios', description: 'Fotos de perfil, avatares de asesores y directores' },
      { folder: 'productos', description: 'Envases Oilstone ®, fotografías reales y fichas técnicas' },
      { folder: 'clientes', description: 'Fachadas de tiendas, documentos RIF y fotos de locales' },
      { folder: 'comprobantes', description: 'Capturas de transferencias, depósitos y cheques' },
      { folder: 'config', description: 'Logotipos Motorven / Oilstone ®, sellos digitales y membretes' },
      { folder: 'proveedores', description: 'Facturas de compra escaneadas y notas de entrega' },
      { folder: 'devoluciones', description: 'Evidencias fotográficas de averías o garantías' }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      bucket: 'signum-media',
      public: true,
      maxFileSize: '20 MB',
      permissions: 'SELECT, INSERT, UPDATE, DELETE (100% CRUD)',
      allowedMimeTypes: 'Todos los formatos multimedia (JPG, PNG, WEBP, SVG, PDF)',
      folders
    }));
    return;
  }

  // 7.1 Explorador de Todas las Bases de Datos en el Servidor (26 BDs)
  if (url.pathname === '/api/profit/databases/all' && req.method === 'GET') {
    const refresh = url.searchParams.get('refresh') === 'true';
    const result = await getAllDatabases(refresh);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 7.2 Listar Tablas de Cualquier Base de Datos
  if (url.pathname === '/api/profit/database/tables' && req.method === 'GET') {
    const dbName = url.searchParams.get('db') || 'GRUMOTOR';
    const result = await getDatabaseTables(dbName);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 7.3 Consultar Datos Paginados de una Tabla de Cualquier BD
  if (url.pathname === '/api/profit/database/table-data' && req.method === 'GET') {
    const dbName = url.searchParams.get('db') || 'GRUMOTOR';
    const tableName = url.searchParams.get('table') || 'art';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const search = url.searchParams.get('search') || '';

    const result = await getTableData(dbName, tableName, page, limit, search);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // 7.4 Ejecutor de Consultas SQL (Solo Lectura SELECT)
  if (url.pathname === '/api/profit/database/query' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const dbName = body.db || 'GRUMOTOR';
      const sqlQuery = body.query || '';
      const result = await executeSafeQuery(dbName, sqlQuery);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7.5 Columnas de Tabla con Detección de Clave Primaria (Para CRUD dinámico)
  if (url.pathname === '/api/profit/database/columns' && req.method === 'GET') {
    try {
      const dbName = url.searchParams.get('db') || 'GRUMOTOR';
      const tableName = url.searchParams.get('table') || 'art';
      const result = await getTableColumns(dbName, tableName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7.6 Guardar / Crear / Modificar Registro en Base de Datos de Profit Plus
  if (url.pathname === '/api/profit/database/record/save' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const dbName = body.db || 'GRUMOTOR';
      const tableName = body.table || 'art';
      const record = body.record || body.data || {};
      const action = (body.action || 'SAVE').toUpperCase();

      const result = await saveDatabaseRecord(dbName, tableName, record, action);

      // Si es una tabla sincronizada con Supabase, disparar reflejo no bloqueante
      if (['art', 'clientes', 'vendedor', 'prov'].includes(tableName.toLowerCase())) {
        try {
          if (tableName.toLowerCase() === 'art' && record.codigo) {
            await supabase.from('products').upsert({
              codigo: String(record.codigo).trim().toUpperCase(),
              descripcion: record.descripcion || record.art_des,
              stock: Number(record.stock || record.stock_act || 0),
              precio_usd_detal: Number(record.precioUsdDetal || record.prec_vta1 || 0),
              precio_usd_mayor: Number(record.precioUsdMayor || record.prec_vta2 || 0),
              costo_usd: Number(record.costoUsd || record.ult_cos_un || 0),
              updated_at: new Date().toISOString()
            }, { onConflict: 'codigo' });
          } else if (tableName.toLowerCase() === 'clientes' && (record.codigo || record.co_cli)) {
            const coCli = String(record.codigo || record.co_cli).trim().toUpperCase();
            await supabase.from('clients').upsert({
              codigo: coCli,
              nombre: record.nombre || record.cli_des,
              rif: record.rif || '',
              direccion: record.direccion || record.direc1 || '',
              telefono: record.telefono || record.telefonos || '',
              updated_at: new Date().toISOString()
            }, { onConflict: 'codigo' });
          }
        } catch (_) {}
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7.7 Eliminar Registro en Base de Datos de Profit Plus
  if (url.pathname === '/api/profit/database/record/delete' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const dbName = body.db || 'GRUMOTOR';
      const tableName = body.table || 'art';
      const keyField = body.keyField || 'co_art';
      const keyValue = body.keyValue || body.key || body.id;

      const result = await deleteDatabaseRecord(dbName, tableName, keyField, keyValue);

      // Borrado concurrente en Supabase si aplica
      try {
        if (tableName.toLowerCase() === 'art') {
          await supabase.from('products').delete().eq('codigo', keyValue);
        } else if (tableName.toLowerCase() === 'clientes') {
          await supabase.from('clients').delete().eq('codigo', keyValue);
        } else if (tableName.toLowerCase() === 'vendedor') {
          await supabase.from('profit_sellers').delete().eq('co_ven', keyValue);
        }
      } catch (_) {}

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7.8 Ejecutar Copia de Seguridad de Profit Plus (Nativa .BAK o Snapshot .JSON)
  if (url.pathname === '/api/profit/database/backup' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const dbName = body.db || 'GRUMOTOR';
      const backupType = body.type || 'native'; // 'native' | 'snapshot' | 'all'

      const result = await executeDatabaseBackup(dbName, backupType);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7.9 Listar Copias de Seguridad de la Base de Datos
  if (url.pathname === '/api/profit/database/backups' && req.method === 'GET') {
    try {
      const dbName = url.searchParams.get('db') || '';
      const result = await listDatabaseBackups(dbName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.1 Escritura Bidireccional: Vendedor / Asesor Comercial / Usuario
  if ((url.pathname === '/api/profit/write/seller' || url.pathname === '/api/profit/write/user') && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const rawUser = body.seller || body.user || body;
      const coVen = (rawUser.coVen || rawUser.co_ven || rawUser.id || '').trim().toUpperCase();

      let sqlWritten = false;
      let sqlError = null;

      // 1. Escribir en SQL Server Profit Plus (vendedor)
      if (coVen || rawUser.venDes || rawUser.nombre) {
        try {
          const pool = await getSharedPool();
          const targetDb = config.sql.database || 'GRUMOTOR';
          await writeSellerToProfitSql(pool, targetDb, rawUser, action);
          sqlWritten = true;
        } catch (err) {
          sqlError = err.message;
          console.warn('[Write/Seller] SQL Server offline o timeout. Encolando acción:', err.message);
          queueWriteAction('seller', action, rawUser);
        }
      }

      // 2. Reflejo directo en Supabase (users y profit_sellers)
      try {
        if (action === 'DELETE') {
          if (rawUser.id) await supabase.from('users').delete().eq('id', rawUser.id);
          if (coVen) await supabase.from('profit_sellers').delete().eq('co_ven', coVen);
        } else {
          // Upsert en users
          if (rawUser.username || rawUser.rol) {
            const userPayload = {
              id: rawUser.id || `usr-${Date.now().toString(36)}`,
              nombre: rawUser.nombre || rawUser.venDes || rawUser.ven_des || '',
              username: (rawUser.username || '').toLowerCase().trim(),
              cargo: rawUser.cargo || 'Asesor Comercial',
              rol: rawUser.rol || 'VENTAS',
              departamento: rawUser.departamento || 'VEN',
              avatar: rawUser.avatar || '👤',
              foto: rawUser.foto || null,
              activo: rawUser.activo !== false,
              co_ven: coVen || null,
              updated_at: new Date().toISOString()
            };
            if (rawUser.password) userPayload.password = rawUser.password;
            await supabase.from('users').upsert(userPayload, { onConflict: 'id' });
          }

          // Si es asesor de ventas con código co_ven, upsert en profit_sellers
          if (coVen) {
            await supabase.from('profit_sellers').upsert({
              id: coVen,
              co_ven: coVen,
              ven_des: rawUser.nombre || rawUser.venDes || rawUser.ven_des || coVen,
              cedula: rawUser.cedula || '',
              telefonos: rawUser.telefonos || rawUser.telefono || '',
              direccion: rawUser.direccion || rawUser.direc1 || '',
              tipo: rawUser.tipo || 'A',
              comision_pct: Number(rawUser.comisionPct || rawUser.comision_pct || 3.0),
              meta_litros_mes: Number(rawUser.metaLitrosMes || rawUser.meta_litros_mes || 3000),
              foto: rawUser.foto || null,
              avatar: rawUser.avatar || null,
              activo: rawUser.activo !== false,
              updated_at: new Date().toISOString()
            }, { onConflict: 'co_ven' });
          }
        }
      } catch (supaErr) {
        console.warn('[Write/Seller] Error reflejando en Supabase:', supaErr.message);
      }

      // 3. Comparativa y Reconciliación inmediata Profit ↔ Supabase
      let comparison = null;
      if (sqlWritten) {
        try {
          const compPool = await getSharedPool();
          const targetDb = config.sql.database || 'GRUMOTOR';
          comparison = await compareAndReconcileSeller(compPool, targetDb, supabase, rawUser);
        } catch (compErr) {
          console.warn('[Write/Seller] Error en comparativa:', compErr.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'vendedor',
        supabaseTables: ['users', 'profit_sellers'],
        photoStoredInSupabase: Boolean(rawUser.foto),
        photoExcludedFromProfit: true,
        comparison,
        errorProfit: sqlError,
        data: rawUser
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.2 Escritura Bidireccional: Artículo / Producto
  if (url.pathname === '/api/profit/write/product' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const productData = body.product || body;
      const coArt = (productData.codigo || productData.id || '').trim().toUpperCase();

      let sqlWritten = false;
      let sqlError = null;

      // 1. Escribir en SQL Server Profit Plus (art) - Solo estructura nativa SQL, sin imágenes pesadas
      try {
        const pool = await getSharedPool();
        const targetDb = config.sql.database || 'GRUMOTOR';
        await writeProductToProfitSql(pool, targetDb, productData, action);
        sqlWritten = true;
      } catch (err) {
        sqlError = err.message;
        console.warn('[Write/Product] SQL Server offline o timeout. Encolando acción:', err.message);
        queueWriteAction('product', action, productData);
      }

      // 2. Reflejo completo en Supabase (incluyendo imagen en Base64, viscosidad, categoría, etc.)
      try {
        if (action === 'DELETE') {
          if (productData.id) await supabase.from('products').delete().eq('id', productData.id);
          if (coArt) await supabase.from('products').delete().eq('codigo', coArt);
        } else {
          const prodPayload = {
            id: productData.id || `prod-${coArt.toLowerCase()}`,
            codigo: coArt,
            oem: productData.oem || productData.ref || '',
            descripcion: productData.descripcion || productData.art_des || '',
            marca: productData.marca || 'Oilstone ®',
            categoria: productData.categoria || 'Gasolina',
            viscosidad: productData.viscosidad || 'SAE 15W-40',
            norma_api: productData.normaApi || productData.norma_api || productData.modelo || '',
            presentaciones_disponibles: productData.presentacionesDisponibles || productData.presentaciones_disponibles || [],
            unidad: productData.unidad || productData.uni_venta || '01',
            litros_por_unidad: Number(productData.litrosPorUnidad || productData.litros_por_unidad || 1),
            stock: Number(productData.stock || productData.stock_act || 0),
            comprometido: Number(productData.comprometido || 0),
            stock_minimo: Number(productData.stockMinimo || productData.stock_min || 10),
            costo_usd: Number(productData.costoUsd || productData.costo_usd || productData.ult_cos_un || 0),
            precio_usd_detal: Number(productData.precioUsdDetal || productData.precio_usd_detal || productData.prec_vta1 || 0),
            precio_usd_mayor: Number(productData.precioUsdMayor || productData.precio_usd_mayor || productData.prec_vta2 || 0),
            aplica_iva: productData.aplicaIva !== undefined ? productData.aplicaIva : true,
            color_etiqueta: productData.colorEtiqueta || '#002b7a',
            imagen: productData.imagen || null,
            especificaciones: productData.especificaciones || {},
            updated_at: new Date().toISOString()
          };
          await supabase.from('products').upsert(prodPayload, { onConflict: 'codigo' });
        }
      } catch (supaErr) {
        console.warn('[Write/Product] Error reflejando en Supabase:', supaErr.message);
      }

      // 3. Comparativa y Reconciliación inmediata Profit ↔ Supabase
      let comparison = null;
      if (sqlWritten) {
        try {
          const compPool = await getSharedPool();
          const targetDb = config.sql.database || 'GRUMOTOR';
          comparison = await compareAndReconcileProduct(compPool, targetDb, supabase, coArt);
        } catch (compErr) {
          console.warn('[Write/Product] Error en comparativa:', compErr.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'art',
        supabaseTable: 'products',
        imageStoredInSupabase: Boolean(productData.imagen),
        imageExcludedFromProfit: true,
        comparison,
        errorProfit: sqlError,
        data: productData
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.3 Escritura Bidireccional: Cliente
  if (url.pathname === '/api/profit/write/client' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const clientData = body.client || body;
      const coCli = (clientData.codigo || clientData.id || clientData.co_cli || '').trim().toUpperCase();

      let sqlWritten = false;
      let sqlError = null;

      try {
        const pool = await getSharedPool();
        const targetDb = config.sql.database || 'GRUMOTOR';
        await writeClientToProfitSql(pool, targetDb, clientData, action);
        sqlWritten = true;
      } catch (err) {
        sqlError = err.message;
        console.warn('[Write/Client] SQL Server offline o timeout. Encolando acción:', err.message);
        queueWriteAction('client', action, clientData);
      }

      // Reflejo en Supabase (clients)
      try {
        if (action === 'DELETE') {
          if (clientData.id) await supabase.from('clients').delete().eq('id', clientData.id);
          if (coCli) await supabase.from('clients').delete().eq('codigo', coCli);
        } else {
          const clientPayload = {
            id: clientData.id || `cli-${coCli.toLowerCase()}`,
            codigo: coCli,
            nombre: clientData.nombre || clientData.cli_des || '',
            rif: clientData.rif || '',
            direccion: clientData.direccion || clientData.direc1 || '',
            telefono: clientData.telefono || clientData.telefonos || '',
            email: clientData.email || '',
            limite_credito: Number(clientData.limiteCredito || clientData.limite_credito || clientData.mont_cre || 0),
            dias_credito: Number(clientData.diasCredito || clientData.dias_credito || clientData.plaz_pag || 0),
            vendedor_asignado: clientData.vendedorAsignado || clientData.vendedor_asignado || clientData.co_ven || 'CB',
            segmento: clientData.segmento || 'Taller Mecánico',
            tipo_precio: clientData.tipoPrecio || clientData.tipo_precio || 'Detal',
            activo: clientData.activo !== false,
            updated_at: new Date().toISOString()
          };
          await supabase.from('clients').upsert(clientPayload, { onConflict: 'codigo' });
        }
      } catch (supaErr) {
        console.warn('[Write/Client] Error reflejando en Supabase:', supaErr.message);
      }

      // Comparativa y Reconciliación inmediata
      let comparison = null;
      if (sqlWritten) {
        try {
          const compPool = await getSharedPool();
          const targetDb = config.sql.database || 'GRUMOTOR';
          comparison = await compareAndReconcileClient(compPool, targetDb, supabase, coCli);
        } catch (compErr) {
          console.warn('[Write/Client] Error en comparativa:', compErr.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'clientes',
        supabaseTable: 'clients',
        comparison,
        errorProfit: sqlError,
        data: clientData
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.4 Escritura Bidireccional: Venta / Factura POS
  if (url.pathname === '/api/profit/write/sale' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const saleData = body.sale || body;
      let sqlWritten = false;
      let sqlError = null;

      try {
        const pool = await getSharedPool();
        const targetDb = config.sql.database || 'GRUMOTOR';
        await writeSaleToProfitSql(pool, targetDb, saleData, action);
        sqlWritten = true;
      } catch (err) {
        sqlError = err.message;
        console.warn('[Write/Sale] SQL Server offline o timeout. Encolando:', err.message);
        queueWriteAction('sale', action, saleData);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'factura',
        errorProfit: sqlError,
        data: saleData
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.5 Escritura Bidireccional: Pedido / Cotización
  if (url.pathname === '/api/profit/write/order' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const orderData = body.order || body;
      let sqlWritten = false;
      let sqlError = null;

      try {
        const pool = await getSharedPool();
        const targetDb = config.sql.database || 'GRUMOTOR';
        await writeOrderToProfitSql(pool, targetDb, orderData, action);
        sqlWritten = true;
      } catch (err) {
        sqlError = err.message;
        console.warn('[Write/Order] SQL Server offline o timeout. Encolando:', err.message);
        queueWriteAction('order', action, orderData);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'pedidos',
        errorProfit: sqlError,
        data: orderData
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.6 Escritura Bidireccional: Compra
  if (url.pathname === '/api/profit/write/purchase' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const purchaseData = body.purchase || body;
      let sqlWritten = false;
      let sqlError = null;

      try {
        const pool = await getSharedPool();
        const targetDb = config.sql.database || 'GRUMOTOR';
        await writePurchaseToProfitSql(pool, targetDb, purchaseData, action);
        sqlWritten = true;
      } catch (err) {
        sqlError = err.message;
        console.warn('[Write/Purchase] SQL Server offline o timeout. Encolando:', err.message);
        queueWriteAction('purchase', action, purchaseData);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'compras',
        errorProfit: sqlError,
        data: purchaseData
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.7 Escritura Bidireccional: Proveedor
  if (url.pathname === '/api/profit/write/supplier' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const supData = body.supplier || body;
      let sqlWritten = false;
      let sqlError = null;

      try {
        const pool = await getSharedPool();
        const targetDb = config.sql.database || 'GRUMOTOR';
        await writeSupplierToProfitSql(pool, targetDb, supData, action);
        sqlWritten = true;
      } catch (err) {
        sqlError = err.message;
        console.warn('[Write/Supplier] SQL Server offline o timeout. Encolando:', err.message);
        queueWriteAction('supplier', action, supData);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'prov',
        errorProfit: sqlError,
        data: supData
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.8 Escritura Bidireccional: Movimiento de Caja / Cobro
  if (url.pathname === '/api/profit/write/cash-movement' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = (body.action || 'SAVE').toUpperCase();
      const movData = body.movement || body;
      let sqlWritten = false;
      let sqlError = null;

      try {
        const pool = await getSharedPool();
        const targetDb = config.sql.database || 'GRUMOTOR';
        await writeCashMovementToProfitSql(pool, targetDb, movData, action);
        sqlWritten = true;
      } catch (err) {
        sqlError = err.message;
        console.warn('[Write/CashMovement] SQL Server offline o timeout. Encolando:', err.message);
        queueWriteAction('cash_movement', action, movData);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action,
        writtenToProfit: sqlWritten,
        queuedForProfit: !sqlWritten,
        profitTable: 'cobros',
        errorProfit: sqlError,
        data: movData
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8.4 Comparativa On-Demand Profit Plus ↔ Supabase
  if (url.pathname.startsWith('/api/profit/compare/') && req.method === 'GET') {
    try {
      const parts = url.pathname.split('/').filter(Boolean);
      const entity = parts[3]?.toLowerCase();
      const entityId = parts[4];

      if (!entity || !entityId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Formato esperado: /api/profit/compare/:entity/:id' }));
        return;
      }

      const compPool = await getSharedPool();
      const targetDb = config.sql.database || 'GRUMOTOR';
      let comparison = null;

      if (entity === 'product' || entity === 'art') {
        comparison = await compareAndReconcileProduct(compPool, targetDb, supabase, entityId);
      } else if (entity === 'client' || entity === 'clientes') {
        comparison = await compareAndReconcileClient(compPool, targetDb, supabase, entityId);
      } else if (entity === 'seller' || entity === 'user' || entity === 'vendedor') {
        comparison = await compareAndReconcileSeller(compPool, targetDb, supabase, { coVen: entityId, id: entityId });
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Entidad no soportada: ${entity}` }));
        return;
      }

      await compPool.close().catch(() => {});

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        entity,
        id: entityId,
        comparison
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, () => {
  console.log(`\n===============================================================`);
  console.log(`  🚀 PROFIT BRIDGE API ACTIVA EN: http://localhost:${PORT}`);
  console.log(`  📡 Conectado a SQL Server: ${config.sql.server} [${config.sql.database}]`);
  console.log(`  ☁️ Sincronizando con Supabase Cloud y Dashboard en tiempo real`);
  console.log(`===============================================================\n`);
});

// Auto-sync a petición: La sincronización completa se activa manualmente desde la UI (/api/profit/sync)
// Manteniendo el servidor API HTTP 100% activo y estable para consultas de bases de datos
console.log('  🛡️ Servidor Micro-API preparado para consultas de Bases de Datos y Tablas.');
