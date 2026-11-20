/**
 * SERVIDOR LOCAL SUPABASE STANDALONE - MOTORVEN SIGNUM
 * Puerto por defecto: 54321 (compatible con PostgREST y SDK Supabase)
 * 100% Gratuito - Sin Tokens - Sin Cuotas de Egress - Acceso Ilimitado
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

const PORT = process.env.SUPABASE_LOCAL_PORT || 54321;
const HOST = '0.0.0.0';
const DB_FILE = fs.existsSync(path.join(__dirname, 'local_database.json'))
  ? path.join(__dirname, 'local_database.json')
  : path.join(projectRoot, 'supabase', 'local_database.json');

// Prevenir caídas no deseadas de Node
process.on('uncaughtException', (err) => {
  console.warn('[Supabase Local] Uncaught Exception prevenido:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Supabase Local] Unhandled Rejection prevenido:', reason);
});

// Mantener activo el event loop indefinidamente
setInterval(() => {}, 60000);

const INVOICE_SERIES_RESET_DATE = '2026-11-01';

const isLegacyPreNovServerRow = (row) => {
  if (!row || typeof row !== 'object') return false;
  const rawId = String(row.id || '').trim();
  const rawDate = String(row.fechaEmision || row.fec_emis || row.fecha_emision || row.fecha || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    return rawDate.slice(0, 10) < INVOICE_SERIES_RESET_DATE;
  }
  const fallbackTs = String(row.updated_at || row.created_at || row.fecha_sincronizacion || row.fechaSincronizacion || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(fallbackTs)) {
    return fallbackTs.slice(0, 10) < INVOICE_SERIES_RESET_DATE;
  }
  return !row._customCreated && /^fac-[1-9]\d{0,3}$/.test(rawId);
};

const canonicalServerDocKey = (row, isProfitInvoice = false) => {
  if (!row || typeof row !== 'object') return '';
  const tipo = String(row.tipoDoc || row.tipo_doc || '').trim().toUpperCase();
  const candidates = [row.facturaNumero, row.factNum, row.fact_num, row.numero_doc, row.numeroDoc, row.id];
  let raw = '';
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '') {
      raw = String(c).trim().toUpperCase();
      break;
    }
  }
  if (!raw) return '';
  let prefix = 'FAC';
  if (tipo === 'NOTA_ENTREGA' || raw.startsWith('NE-') || raw.startsWith('N.E-') || /^NE\s*\d/.test(raw) || /^N\.E\s*\d/.test(raw)) prefix = 'NE';
  else if (tipo === 'NOTA_CREDITO' || raw.startsWith('NC-')) prefix = 'NC';
  else if (tipo === 'NOTA_DEBITO' || raw.startsWith('ND-')) prefix = 'ND';
  else if (!isProfitInvoice && tipo && tipo !== 'FACTURA') prefix = tipo;
  const cleaned = raw
    .replace(/^(FAC-|FACT-|FAC\s+|INV-|NE-|N\.E-|NE\s+|NC-|ND-|doc-)/i, '')
    .trim()
    .replace(/^0+(?=\d)/, '');
  if (!cleaned) return '';
  const explicitEra = String(row.seriesEra || row.series_era || '').trim().toUpperCase();
  if (explicitEra) {
    return `${prefix}:${cleaned}:${explicitEra}`;
  }
  const eraSuffix = prefix === 'FAC' && isLegacyPreNovServerRow(row) ? ':LEGACY' : '';
  return `${prefix}:${cleaned}${eraSuffix}`;
};

const pickBestServerDoc = (a, b) => {
  const aItems = Array.isArray(a.items) ? a.items.length : 0;
  const bItems = Array.isArray(b.items) ? b.items.length : 0;
  const aCustom = Boolean(a._customCreated);
  const bCustom = Boolean(b._customCreated);
  const aTs = Date.parse(a.updated_at || a.fecha_sincronizacion || a.fechaSincronizacion || a.created_at || 0) || 0;
  const bTs = Date.parse(b.updated_at || b.fecha_sincronizacion || b.fechaSincronizacion || b.created_at || 0) || 0;

  let winner = b;
  let loser = a;
  if (aTs !== bTs) {
    winner = aTs > bTs ? a : b;
    loser = winner === a ? b : a;
  } else if (aCustom !== bCustom) {
    winner = aCustom ? a : b;
    loser = winner === a ? b : a;
  } else if (aItems !== bItems) {
    winner = aItems > bItems ? a : b;
    loser = winner === a ? b : a;
  }

  const wItems = Array.isArray(winner.items) ? winner.items : [];
  const lItems = Array.isArray(loser.items) ? loser.items : [];
  const bestItems = wItems.length >= lItems.length ? wItems : lItems;

  const pickPadded = (valA, valB) => {
    const sA = valA !== undefined && valA !== null ? String(valA).trim() : '';
    const sB = valB !== undefined && valB !== null ? String(valB).trim() : '';
    if (!sA) return sB;
    if (!sB) return sA;
    if (/^\d+$/.test(sA.replace(/^NE-/i, '')) && /^\d+$/.test(sB.replace(/^NE-/i, ''))) {
      return sA.length >= sB.length ? sA : sB;
    }
    return sA;
  };

  return {
    ...loser,
    ...winner,
    factNum: pickPadded(winner.factNum, loser.factNum),
    numero_doc: pickPadded(winner.numero_doc, loser.numero_doc),
    items: bestItems
  };
};

let database = {};

async function initDatabase() {
  const candidates = [DB_FILE, `${DB_FILE}.bak`];
  let loadedFromDisk = false;
  for (const candidateFile of candidates) {
    if (fs.existsSync(candidateFile)) {
      try {
        console.log(`[Supabase Local] Cargando base de datos persistida desde: ${candidateFile}`);
        const raw = fs.readFileSync(candidateFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 5) {
          database = parsed;
          loadedFromDisk = true;
          if (candidateFile !== DB_FILE) {
            console.log(`[Supabase Local] Restaurando ${DB_FILE} desde respaldo íntegro ${candidateFile}...`);
            try { fs.writeFileSync(DB_FILE, raw, 'utf8'); } catch (_) {}
          } else if (!fs.existsSync(`${DB_FILE}.bak`)) {
            try { fs.writeFileSync(`${DB_FILE}.bak`, raw, 'utf8'); } catch (_) {}
          }
          break;
        }
      } catch (err) {
        console.warn(`[Supabase Local] Aviso al leer ${candidateFile}:`, err.message);
      }
    }
  }
  if (loadedFromDisk) {
    try {
      if (Array.isArray(database.profit_invoices)) {
        const seenInv = new Map();
        const dedupedInv = [];
        database.profit_invoices.forEach(f => {
          if (!f) return;
          const litros = Number(f.totalLitros ?? f.total_litros ?? 0);
          const cajas = Number(f.totalCajas ?? f.total_cajas ?? 0);
          f.total_litros = litros;
          f.totalLitros = litros;
          f.total_cajas = cajas;
          f.totalCajas = cajas;
          const fec = f.fec_emis || f.fechaEmision || f.fecha || '';
          if (!f.fec_emis) f.fec_emis = fec;
          if (!f.fechaEmision) f.fechaEmision = fec;
          const netoUsd = Number(f.tot_neto_usd ?? f.totNetoUsd ?? f.totalNetoUsd ?? 0);
          f.tot_neto_usd = netoUsd;
          f.totNetoUsd = netoUsd;
          const cliNom = f.cliente_nombre || f.clienteNombre || f.cli_des || '';
          f.cliente_nombre = cliNom;
          f.clienteNombre = cliNom;
          const venId = f.vendedor_id || f.vendedorId || f.co_ven || '';
          f.vendedor_id = venId;
          f.vendedorId = venId;

          const key = canonicalServerDocKey(f, true);
          if (key && seenInv.has(key)) {
            const idx = seenInv.get(key);
            dedupedInv[idx] = pickBestServerDoc(dedupedInv[idx], f);
          } else {
            if (key) seenInv.set(key, dedupedInv.length);
            dedupedInv.push(f);
          }
        });
        if (dedupedInv.length !== database.profit_invoices.length) {
          console.log(`[Supabase Local] Deduplicadas ${database.profit_invoices.length - dedupedInv.length} facturas en profit_invoices.`);
        }
        database.profit_invoices = dedupedInv;
      }
      if (Array.isArray(database.sales)) {
        const seenSales = new Map();
        const dedupedSales = [];
        database.sales.forEach(s => {
          if (!s) return;
          const key = canonicalServerDocKey(s, false);
          if (key && seenSales.has(key)) {
            const idx = seenSales.get(key);
            dedupedSales[idx] = pickBestServerDoc(dedupedSales[idx], s);
          } else {
            if (key) seenSales.set(key, dedupedSales.length);
            dedupedSales.push(s);
          }
        });
        if (dedupedSales.length !== database.sales.length) {
          console.log(`[Supabase Local] Deduplicadas ${database.sales.length - dedupedSales.length} ventas en sales.`);
        }
        database.sales = dedupedSales;
      }
      if (Array.isArray(database.profit_zones)) {
        const seenZones = new Map();
        database.profit_zones.forEach(z => {
          if (!z) return;
          const coZon = String(z.co_zon || z.coZon || '').trim();
          const zonDes = String(z.zon_des || z.zonDes || '').trim();
          if (!coZon) return;
          const normalized = {
            ...z,
            id: z.id || `ZON-${coZon}`,
            co_zon: coZon,
            coZon: coZon,
            zon_des: zonDes,
            zonDes: zonDes,
            dis_cen: z.dis_cen ?? z.disCen ?? '',
            disCen: z.disCen ?? z.dis_cen ?? ''
          };
          if (!seenZones.has(coZon)) {
            seenZones.set(coZon, normalized);
          }
        });
        database.profit_zones = Array.from(seenZones.values()).sort((a, b) => a.coZon.localeCompare(b.coZon));
      }
      if (Array.isArray(database.profit_sellers)) {
        const zoneMap = new Map(
          (database.profit_zones || []).map(z => [String(z.coZon || z.co_zon).trim(), z.zonDes || z.zon_des || ''])
        );
        database.profit_sellers.forEach(s => {
          if (!s) return;
          const coVen = String(s.co_ven || s.coVen || s.id || '').trim();
          const venDes = String(s.ven_des || s.venDes || s.nombre || '').trim();
          const coZon = String(s.co_zon || s.coZon || '').trim();
          const zona = String(s.zona || zoneMap.get(coZon) || '').trim();
          s.co_ven = coVen;
          s.coVen = coVen;
          s.ven_des = venDes;
          s.venDes = venDes;
          s.co_zon = coZon;
          s.coZon = coZon;
          s.zona = zona;
          s.comision_pct = Number(s.comision_pct ?? s.comisionPct ?? 3);
          s.comisionPct = s.comision_pct;
          s.meta_litros_mes = Number(s.meta_litros_mes ?? s.metaLitrosMes ?? 3000);
          s.metaLitrosMes = s.meta_litros_mes;
        });
      }
      // Normalizar códigos co_uni a descripciones des_uni según profit_measurement_units
      const unitMap = new Map([
        ['01', 'Litros'], ['1', 'Litros'],
        ['02', 'Totem'], ['2', 'Totem'],
        ['03', 'Tambor'], ['3', 'Tambor'],
        ['04', 'Paila'], ['4', 'Paila'],
        ['05', 'Caja'], ['5', 'Caja'],
        ['06', 'N/A'], ['6', 'N/A'],
        ['Caja (12L)', 'Caja'],
        ['Cuñete (19L)', 'Paila']
      ]);
      if (Array.isArray(database.profit_measurement_units)) {
        database.profit_measurement_units.forEach(u => {
          if (u && u.co_uni && u.des_uni) {
            unitMap.set(String(u.co_uni).trim(), String(u.des_uni).trim());
          }
        });
      }
      const normUnit = (val) => {
        if (!val) return val;
        const s = String(val).trim();
        return unitMap.get(s) || val;
      };
      if (Array.isArray(database.products)) {
        database.products.forEach(p => {
          if (!p) return;
          if (p.unidad) p.unidad = normUnit(p.unidad);
          const desc = String(p.descripcion || p.nombre || '').toLowerCase();
          if (desc.includes('(paila)') || desc.includes('(pl)')) {
            p.unidad = 'Paila';
          }
          const curL = Number(p.litrosPorUnidad ?? p.litros_por_unidad ?? 0);
          let realL = curL;
          if (p.unidad === 'Paila') {
            realL = 19;
          } else if (p.unidad === 'Tambor') {
            realL = curL > 1 ? curL : 208;
          } else if (p.unidad === 'Totem') {
            realL = curL > 1 ? curL : 1000;
          } else if (p.unidad === 'Litros') {
            realL = 1;
          } else if (p.unidad === 'Caja') {
            realL = (curL > 1 && curL !== 19) ? curL : 11.35;
          }
          p.litrosPorUnidad = realL;
          p.litros_por_unidad = realL;
          p.almacen = p.almacen || '01: ALMACÉN PRINCIPAL / MOSTRADOR | 02: ALMACÉN CENTRAL / BÓVEDA';
          p.co_alm = p.co_alm || p.coAlm || '01,02';
          p.coAlm = p.coAlm || p.co_alm || '01,02';
          p.almacenes = Array.isArray(p.almacenes) ? p.almacenes : ['01', '02'];
          p.ubicacion = p.ubicacion || '01: Almacén Principal • 02: Almacén Central';
        });
      }
      if (Array.isArray(database.profit_warehouses)) {
        database.profit_warehouses = database.profit_warehouses.filter(w => {
          const code = String(w?.coAlm || w?.co_alm || w?.coAlma || w?.co_alma || w?.id || '').replace(/^ALM-/, '').trim();
          return code === '01' || code === '02';
        });
      }
      if (Array.isArray(database.order_items)) {
        database.order_items.forEach(it => {
          if (!it) return;
          if (it.unidad_venta) it.unidad_venta = normUnit(it.unidad_venta);
          if (it.unidadVenta) it.unidadVenta = normUnit(it.unidadVenta);
        });
      }
      if (Array.isArray(database.users)) {
        database.users = database.users.filter(u =>
          u &&
          typeof u.username === 'string' &&
          u.username.trim().length > 0 &&
          u.username.trim().toLowerCase() !== 'autotest_1793130314101'
        );
      }
      if (Array.isArray(database._applied_stock_delta_keys)) {
        database._applied_stock_delta_keys.forEach((entry) => {
          if (entry && entry.key) {
            const rawKey = String(entry.key).trim();
            const normKey = normalizeServerStockDeltaKey(rawKey);
            APPLIED_STOCK_DELTA_KEYS.set(rawKey, entry.updatedProducts || []);
            if (normKey) {
              APPLIED_STOCK_DELTA_KEYS.set(normKey, entry.updatedProducts || []);
            }
          }
        });
      }
      // Purgar al arranque documentos fantasma/duplicados marcados en tombstones (sin alterar stock)
      if (Array.isArray(database.sales)) {
        const beforeSales = database.sales.length;
        database.sales = database.sales.filter((s) => !isRowBlockedByDeletedTombstone(s, false));
        if (database.sales.length !== beforeSales) {
          console.log(`[Supabase Local] Purgadas ${beforeSales - database.sales.length} venta(s) fantasma/duplicada(s) bloqueadas.`);
        }
      }
      if (Array.isArray(database.profit_invoices)) {
        const beforeInv = database.profit_invoices.length;
        database.profit_invoices = database.profit_invoices.filter((inv) => !isRowBlockedByDeletedTombstone(inv, true));
        if (database.profit_invoices.length !== beforeInv) {
          console.log(`[Supabase Local] Purgadas ${beforeInv - database.profit_invoices.length} factura(s) fantasma/duplicada(s) bloqueadas.`);
        }
      }
      console.log(`[Supabase Local] Base de datos cargada: ${Object.keys(database).length} tablas activas.`);
      return;
    } catch (err) {
      console.warn(`[Supabase Local] Error al leer ${DB_FILE}, cargando respaldo dinámico:`, err.message);
    }
  }

  console.log(`[Supabase Local] Inicializando tablas con datos vivos reales desde módulo de respaldo...`);
  try {
    const realData = await import('../../src/data/supabaseRealData.js');
    database = {
      SIGNUM_MOTORVEN: JSON.parse(JSON.stringify(realData.REAL_SIGNUM_MOTORVEN || {})),
      config: [JSON.parse(JSON.stringify(realData.REAL_CONFIG || {}))],
      products: JSON.parse(JSON.stringify(realData.REAL_PRODUCTS || [])),
      clients: JSON.parse(JSON.stringify(realData.REAL_CLIENTS || [])),
      profit_invoices: JSON.parse(JSON.stringify(realData.REAL_PROFIT_INVOICES || [])),
      profit_collections: JSON.parse(JSON.stringify(realData.REAL_PROFIT_COLLECTIONS || [])),
      profit_accounts_payable: JSON.parse(JSON.stringify(realData.REAL_PROFIT_ACCOUNTS_PAYABLE || [])),
      profit_supplier_payments: JSON.parse(JSON.stringify(realData.REAL_PROFIT_SUPPLIER_PAYMENTS || [])),
      profit_purchases: JSON.parse(JSON.stringify(realData.REAL_PROFIT_PURCHASES || [])),
      profit_suppliers: JSON.parse(JSON.stringify(realData.REAL_PROFIT_SUPPLIERS || [])),
      profit_sellers: JSON.parse(JSON.stringify(realData.REAL_PROFIT_SELLERS || [])),
      profit_bank_accounts: JSON.parse(JSON.stringify(realData.REAL_PROFIT_BANK_ACCOUNTS || [])),
      profit_cash_desks: JSON.parse(JSON.stringify(realData.REAL_PROFIT_CASH_DESKS || [])),
      profit_zones: JSON.parse(JSON.stringify(realData.REAL_PROFIT_ZONES || [])),
      profit_transports: JSON.parse(JSON.stringify(realData.REAL_PROFIT_TRANSPORTS || [])),
      profit_customer_returns: JSON.parse(JSON.stringify(realData.REAL_PROFIT_CUSTOMER_RETURNS || [])),
      profit_inventory_adjustments: JSON.parse(JSON.stringify(realData.REAL_PROFIT_INVENTORY_ADJUSTMENTS || [])),
      profit_warehouse_transfers: JSON.parse(JSON.stringify(realData.REAL_PROFIT_WAREHOUSE_TRANSFERS || [])),
      profit_islr_concepts: JSON.parse(JSON.stringify(realData.REAL_PROFIT_ISLR_CONCEPTS || [])),
      profit_beneficiaries: JSON.parse(JSON.stringify(realData.REAL_PROFIT_BENEFICIARIES || [])),
      profit_payment_orders: JSON.parse(JSON.stringify(realData.REAL_PROFIT_PAYMENT_ORDERS || [])),
      profit_warehouses: JSON.parse(JSON.stringify(realData.REAL_PROFIT_WAREHOUSES || [])),
      profit_product_lines: JSON.parse(JSON.stringify(realData.REAL_PROFIT_PRODUCT_LINES || [])),
      profit_product_categories: JSON.parse(JSON.stringify(realData.REAL_PROFIT_PRODUCT_CATEGORIES || [])),
      profit_currencies: JSON.parse(JSON.stringify(realData.REAL_PROFIT_CURRENCIES || [])),
      users: JSON.parse(JSON.stringify(realData.REAL_USERS || [])),
      orders: JSON.parse(JSON.stringify(realData.REAL_ORDERS || [])),
      sales: JSON.parse(JSON.stringify(realData.REAL_SALES || [])),
      purchases: JSON.parse(JSON.stringify(realData.REAL_PURCHASES || [])),
      suppliers: JSON.parse(JSON.stringify(realData.REAL_SUPPLIERS || [])),
      cash_movements: JSON.parse(JSON.stringify(realData.REAL_CASH_MOVEMENTS || [])),
      fiscal_closures: JSON.parse(JSON.stringify(realData.REAL_FISCAL_CLOSURES || [])),
      notifications: JSON.parse(JSON.stringify(realData.REAL_NOTIFICATIONS || [])),
      expenses: [],
      payroll: [],
      employees: [],
      commission_settlements: []
    };
    saveDatabase();
  } catch (err) {
    console.error('[Supabase Local] Error al importar datos de respaldo:', err);
    database = {};
  }
}

let saveTimeout = null;
let lastBackupDate = '';

function writeAtomicJson(targetPath, dataObj) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const payload = JSON.stringify(dataObj, null, 2);
  const tmpPath = `${targetPath}.${process.pid}.tmp`;
  try {
    const fd = fs.openSync(tmpPath, 'w');
    fs.writeFileSync(fd, payload, 'utf8');
    try { fs.fsyncSync(fd); } catch (_) {}
    fs.closeSync(fd);

    try {
      fs.renameSync(tmpPath, targetPath);
    } catch (_) {
      try {
        fs.copyFileSync(tmpPath, targetPath);
        try { fs.unlinkSync(tmpPath); } catch (__) {}
      } catch (errCopy) {
        fs.writeFileSync(targetPath, payload, 'utf8');
      }
    }

    if (targetPath === DB_FILE) {
      try {
        fs.writeFileSync(`${DB_FILE}.bak`, payload, 'utf8');
      } catch (_) {}
    }
  } catch (errWrite) {
    try {
      fs.writeFileSync(targetPath, payload, 'utf8');
    } catch (errFinal) {
      console.warn('[Supabase Local] Aviso no fatal en writeAtomicJson:', errFinal?.message || errFinal);
    }
  }
  return payload;
}

// ----------------------------------------------------------------------------
// PERSISTENCIA AGRUPADA Y ASÍNCRONA
// Antes cada POST/PATCH/DELETE serializaba con sangría (~22 MB) y escribía DB + .bak
// de forma SÍNCRONA (con fsync). Eso bloqueaba el event loop de Node 1-3 s por
// escritura: durante ese tiempo /health, /realtime/v1/changes y los heartbeats SSE
// no respondían, los equipos conectados por el túnel agotaban su timeout y quedaban
// en "Servidor Sin Respuesta" (desincronizados). Ahora las escrituras se agrupan
// (ventana corta de 300 ms, máx. 1.5 s) y se escriben de forma asíncrona y atómica.
// ----------------------------------------------------------------------------
const PERSIST_DEBOUNCE_MS = 300;
const PERSIST_MAX_WAIT_MS = 1500;
const BAK_MIN_INTERVAL_MS = 60000;
let persistTimer = null;
let persistInFlight = false;
let persistPending = false;
let firstDirtyAt = 0;
let lastBakWriteAt = 0;

async function writeAtomicPayloadAsync(targetPath, payload) {
  const dir = path.dirname(targetPath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = `${targetPath}.${process.pid}.async.tmp`;
  const fh = await fs.promises.open(tmpPath, 'w');
  try {
    await fh.writeFile(payload, 'utf8');
    try { await fh.sync(); } catch (_) {}
  } finally {
    await fh.close();
  }
  try {
    await fs.promises.rename(tmpPath, targetPath);
  } catch (_) {
    try {
      await fs.promises.copyFile(tmpPath, targetPath);
      try { await fs.promises.unlink(tmpPath); } catch (__) {}
    } catch (errCopy) {
      await fs.promises.writeFile(targetPath, payload, 'utf8');
    }
  }
}

function schedulePersist() {
  persistPending = true;
  const now = Date.now();
  if (!firstDirtyAt) firstDirtyAt = now;
  if (persistInFlight) return; // se reprograma al terminar la escritura en curso
  if (persistTimer) clearTimeout(persistTimer);
  const waited = now - firstDirtyAt;
  const delay = waited >= PERSIST_MAX_WAIT_MS ? 0 : Math.min(PERSIST_DEBOUNCE_MS, PERSIST_MAX_WAIT_MS - waited);
  persistTimer = setTimeout(runPersist, delay);
}

async function runPersist() {
  persistTimer = null;
  if (persistInFlight || !persistPending) return;
  persistInFlight = true;
  persistPending = false;
  firstDirtyAt = 0;
  try {
    // JSON compacto (sin sangría): ~35% menos bytes y mucho menos tiempo de CPU bloqueado
    const payload = JSON.stringify(database);
    await writeAtomicPayloadAsync(DB_FILE, payload);
    const now = Date.now();
    if (now - lastBakWriteAt >= BAK_MIN_INTERVAL_MS) {
      lastBakWriteAt = now;
      try { await fs.promises.writeFile(`${DB_FILE}.bak`, payload, 'utf8'); } catch (_) {}
    }
    scheduleSecondaryBackups(payload);
  } catch (e) {
    console.error('[Supabase Local] Error en guardado agrupado:', e?.message || e);
    persistPending = true;
  } finally {
    persistInFlight = false;
    if (persistPending) schedulePersist();
  }
}

function saveDatabase() {
  schedulePersist();
}

let lastSecondaryUsersJson = '';
let lastSecondarySellersJson = '';

function scheduleSecondaryBackups(serialized) {
  // Respaldos rotativos y archivos secundarios en segundo plano (sin bloqueo síncrono de event loop)
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (today !== lastBackupDate) {
          const backupDir = path.join(path.dirname(DB_FILE), 'backups');
          await fs.promises.mkdir(backupDir, { recursive: true });
          const backupFile = path.join(backupDir, `local_database_${today}.json`);
          await fs.promises.writeFile(backupFile, serialized || JSON.stringify(database), 'utf8');
          lastBackupDate = today;
        }
      } catch (_) {}

      if (Array.isArray(database.users)) {
        const cleanUsers = database.users.filter(u =>
          u &&
          typeof u.username === 'string' &&
          u.username.trim().length > 0 &&
          !u.username.trim().toLowerCase().startsWith('autotest_')
        );
        const tempUsersFile = path.join(projectRoot, 'src', 'data', 'temp', 'users.json');
        const usersPayload = JSON.stringify(cleanUsers, null, 2);
        if (usersPayload !== lastSecondaryUsersJson && fs.existsSync(path.dirname(tempUsersFile))) {
          await writeAtomicPayloadAsync(tempUsersFile, usersPayload);
          lastSecondaryUsersJson = usersPayload;
        }
      }
      if (Array.isArray(database.profit_sellers)) {
        const tempSellersFile = path.join(projectRoot, 'src', 'data', 'temp', 'profit_sellers.json');
        const sellersPayload = JSON.stringify(database.profit_sellers, null, 2);
        if (sellersPayload !== lastSecondarySellersJson && fs.existsSync(path.dirname(tempSellersFile))) {
          await writeAtomicPayloadAsync(tempSellersFile, sellersPayload);
          lastSecondarySellersJson = sellersPayload;
        }
      }
    } catch (e) {
      console.error('[Supabase Local] Error guardando respaldos secundarios:', e);
    }
  }, 2000);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    try {
      if (database && Object.keys(database).length > 5) {
        writeAtomicJson(DB_FILE, database);
      }
    } catch (_) {}
    process.exit(0);
  });
}

// ============================================================================
// MOTOR REALTIME MULTI-DISPOSITIVO Y MULTI-NAVEGADOR (SSE + DELTA POLLING)
// ============================================================================
let changeSeq = Date.now();
// Secuencia de arranque: si un cliente trae un "since" anterior a este valor, el servidor se
// reinició y el historial en memoria se perdió → el cliente debe recargar los datos completos.
const SERVER_BOOT_SEQ = changeSeq;
const recentChanges = [];
const MAX_RECENT_CHANGES = 500;
const sseClients = new Set();

function emitRealtimeChange({ table, tableId, eventType = 'UPDATE', action, key, item, clientId = null }) {
  changeSeq += 1;
  const resolvedTable = table || tableId || 'system';
  const entry = {
    seq: changeSeq,
    timestamp: new Date().toISOString(),
    table: resolvedTable,
    tableId: tableId || resolvedTable,
    eventType: eventType || action || 'UPDATE',
    action: action || eventType || 'RECONCILE',
    key: key ?? item?.id ?? item?.co_ven ?? item?.coVen ?? item?.codigo ?? null,
    item: item || null,
    clientId
  };

  recentChanges.push(entry);
  if (recentChanges.length > MAX_RECENT_CHANGES) {
    recentChanges.splice(0, recentChanges.length - MAX_RECENT_CHANGES);
  }

  const payloadStr = `data: ${JSON.stringify(entry)}\n\n`;
  for (const clientRes of sseClients) {
    if (clientRes.destroyed || clientRes.writableEnded) {
      sseClients.delete(clientRes);
      continue;
    }
    try {
      clientRes.write(payloadStr);
    } catch (_) {
      sseClients.delete(clientRes);
    }
  }
  return entry;
}

// Heartbeat cada 15s para mantener conexiones vivas en Safari iOS, Android, tablets y laptops
setInterval(() => {
  if (sseClients.size === 0) return;
  const ping = `: heartbeat ${changeSeq} ${Date.now()}\n\n`;
  for (const clientRes of sseClients) {
    if (clientRes.destroyed || clientRes.writableEnded) {
      sseClients.delete(clientRes);
      continue;
    }
    try {
      clientRes.write(ping);
    } catch (_) {
      sseClients.delete(clientRes);
    }
  }
}, 15000);

// ----------------------------------------------------------------------------
// RESERVA ATÓMICA DE CORRELATIVOS EN SERVIDOR (MULTI-CAJA / MULTI-NAVEGADOR)
// Evita que dos cajeras reciban o inserten el mismo correlativo al mismo tiempo
// ----------------------------------------------------------------------------
const CORRELATIVE_LOCK_TTL_MS = 90 * 1000;
const correlativeReservations = new Map(); // seriesType -> Map(num -> { clientId, expiresAt })

function resolveServerSeriesType(tipoDoc = '', numOrId = '') {
  const t = String(tipoDoc || '').toUpperCase().trim();
  const s = String(numOrId || '').toUpperCase().trim();
  if (t === 'NOTA_ENTREGA' || t === 'N/E' || t === 'NE' || /^(NE-|NDE-)/.test(s)) return 'NOTA_ENTREGA';
  if (t === 'NOTA_CREDITO' || /^(NC-)/.test(s)) return 'NOTA_CREDITO';
  if (t === 'NOTA_DEBITO' || /^(ND-)/.test(s)) return 'NOTA_DEBITO';
  return 'FACTURA';
}

function formatServerCorrelativo(seriesType, numVal) {
  const padded = String(Math.max(0, Number(numVal) || 0)).padStart(6, '0');
  if (seriesType === 'NOTA_ENTREGA') return `NE-${padded}`;
  if (seriesType === 'NOTA_CREDITO') return `NC-${padded}`;
  if (seriesType === 'NOTA_DEBITO') return `ND-${padded}`;
  return padded;
}

function getSeriesUsedNumbersAndFloor(seriesType) {
  const usedNums = new Set();
  let maxLowSeries = 0;
  let maxOverall = 0;

  const inspectRow = (row) => {
    if (!row || typeof row !== 'object') return;
    const rawNum = String(row.numero_doc ?? row.numeroDoc ?? row.factNum ?? row.fact_num ?? row.id ?? '').trim();
    const rowSeries = resolveServerSeriesType(row.tipo_doc || row.tipoDoc || '', rawNum || row.id);
    if (rowSeries !== seriesType) return;
    if (seriesType === 'FACTURA' && isLegacyPreNovServerRow(row)) return;

    const digits = rawNum.replace(/^(FAC-|FACT-|FAC\s+|INV-|NE-|NDE-|NC-|ND-|doc-)/i, '').replace(/[^0-9]/g, '');
    if (!digits) return;
    const val = parseInt(digits, 10);
    if (Number.isNaN(val) || val <= 0 || val >= 900000) return;
    usedNums.add(val);
    if (val > maxOverall) maxOverall = val;
    if (val < 400 && val > maxLowSeries) maxLowSeries = val;
  };

  if (Array.isArray(database.sales)) database.sales.forEach(inspectRow);
  if (Array.isArray(database.profit_invoices)) database.profit_invoices.forEach(inspectRow);

  const floorVal = seriesType === 'FACTURA' ? (maxLowSeries > 0 ? maxLowSeries : 0) : maxOverall;
  return { usedNums, floorVal };
}

function purgeExpiredCorrelativeLocks(seriesType) {
  const locks = correlativeReservations.get(seriesType);
  if (!locks) return;
  const now = Date.now();
  for (const [num, meta] of locks.entries()) {
    if (!meta || meta.expiresAt <= now) {
      locks.delete(num);
    }
  }
}

function reserveNextServerCorrelativo({ tipoDoc = 'FACTURA', preferredNum = null, clientId = 'default' } = {}) {
  const seriesType = resolveServerSeriesType(tipoDoc, preferredNum || '');
  purgeExpiredCorrelativeLocks(seriesType);
  if (!correlativeReservations.has(seriesType)) {
    correlativeReservations.set(seriesType, new Map());
  }
  const locks = correlativeReservations.get(seriesType);
  const { usedNums, floorVal } = getSeriesUsedNumbersAndFloor(seriesType);
  const now = Date.now();
  const safeClientId = String(clientId || 'default').trim() || 'default';

  const isAvailableForClient = (num) => {
    if (usedNums.has(num)) return false;
    const existingLock = locks.get(num);
    if (existingLock && existingLock.expiresAt > now && existingLock.clientId !== safeClientId) {
      return false;
    }
    return true;
  };

  let requestedVal = null;
  if (preferredNum !== null && preferredNum !== undefined && String(preferredNum).trim() !== '') {
    const cleanDigits = String(preferredNum).replace(/^(FAC-|FACT-|INV-|NE-|NDE-|NC-|ND-)/i, '').replace(/[^0-9]/g, '');
    if (cleanDigits) {
      const parsed = parseInt(cleanDigits, 10);
      if (!Number.isNaN(parsed) && parsed > 0 && parsed < 999999) {
        requestedVal = parsed;
      }
    }
  }

  let assignedVal = null;
  let reassigned = false;
  if (requestedVal !== null && isAvailableForClient(requestedVal)) {
    assignedVal = requestedVal;
  } else {
    reassigned = requestedVal !== null;
    let candidate = Math.max(1, floorVal + 1);
    while (!isAvailableForClient(candidate) && candidate < 999999) {
      candidate++;
    }
    assignedVal = candidate;
  }

  locks.set(assignedVal, { clientId: safeClientId, expiresAt: now + CORRELATIVE_LOCK_TTL_MS });
  return {
    correlativo: formatServerCorrelativo(seriesType, assignedVal),
    series: seriesType,
    reserved: true,
    reassigned
  };
}

function releaseServerCorrelativeReservation(row) {
  if (!row || typeof row !== 'object') return;
  const rawNum = String(row.numero_doc ?? row.numeroDoc ?? row.factNum ?? row.fact_num ?? row.id ?? '').trim();
  const seriesType = resolveServerSeriesType(row.tipo_doc || row.tipoDoc || '', rawNum);
  const digits = rawNum.replace(/^(FAC-|FACT-|INV-|NE-|NDE-|NC-|ND-)/i, '').replace(/[^0-9]/g, '');
  if (!digits) return;
  const val = parseInt(digits, 10);
  const locks = correlativeReservations.get(seriesType);
  if (locks && !Number.isNaN(val)) {
    locks.delete(val);
  }
}

const PERMANENT_PURGED_DOC_FINGERPRINTS = [
  // Factura duplicada 000012 (12/11/2026, Multirepuestos Vrm, C.A., duplicada exacta de 000595)
  { canonKey: 'FAC:12', datePrefix: '2026-11-12', clientRif: 'J503078081' }
];
const MAX_DELETED_DOC_FINGERPRINTS = 2000;

function extractServerDocFingerprint(row, isProfitInvoice = false) {
  if (!row || typeof row !== 'object') return null;
  const canonKey = canonicalServerDocKey(row, isProfitInvoice);
  if (!canonKey) return null;
  const rawDate = String(row.fecha_emision || row.fechaEmision || row.fec_emis || row.fecha || '').trim();
  const datePrefix = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : '';
  const clientRif = String(row.cliente_rif || row.clienteRif || row.rif || row.cliente_id || row.clienteId || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();
  return { canonKey, datePrefix, clientRif };
}

function isRowBlockedByDeletedTombstone(row, isProfitInvoice = false) {
  const fp = extractServerDocFingerprint(row, isProfitInvoice);
  if (!fp) return false;
  const allTombstones = [
    ...PERMANENT_PURGED_DOC_FINGERPRINTS,
    ...(Array.isArray(database._deleted_doc_fingerprints) ? database._deleted_doc_fingerprints : [])
  ];
  return allTombstones.some((t) => {
    if (!t || t.canonKey !== fp.canonKey) return false;
    if (t.datePrefix && fp.datePrefix && t.datePrefix !== fp.datePrefix) return false;
    if (t.clientRif && fp.clientRif && t.clientRif !== fp.clientRif) return false;
    // Exigir al menos coincidencia de fecha o cliente para no bloquear un correlativo reutilizado en otra fecha
    return Boolean((t.datePrefix && fp.datePrefix) || (t.clientRif && fp.clientRif));
  });
}

function recordDeletedDocTombstone(row, isProfitInvoice = false) {
  const fp = extractServerDocFingerprint(row, isProfitInvoice);
  if (!fp || (!fp.datePrefix && !fp.clientRif)) return;
  if (!Array.isArray(database._deleted_doc_fingerprints)) database._deleted_doc_fingerprints = [];
  const exists = database._deleted_doc_fingerprints.some(
    (t) => t && t.canonKey === fp.canonKey && t.datePrefix === fp.datePrefix && t.clientRif === fp.clientRif
  );
  if (!exists) {
    database._deleted_doc_fingerprints.push({ ...fp, deletedAt: new Date().toISOString() });
    if (database._deleted_doc_fingerprints.length > MAX_DELETED_DOC_FINGERPRINTS) {
      database._deleted_doc_fingerprints.splice(0, database._deleted_doc_fingerprints.length - MAX_DELETED_DOC_FINGERPRINTS);
    }
  }
}

const APPLIED_STOCK_DELTA_KEYS = new Map();
const MAX_APPLIED_DELTA_KEYS = 5000;
const MAX_STOCK_LEDGER_ENTRIES = 2000;

function normalizeServerStockDeltaKey(rawKey) {
  const clean = String(rawKey || '').trim();
  if (!clean) return '';
  // Normalizar claves de ventas/reversiones para que variantes como
  // sale_000616_deduct, sale_FAC-000616_deduct y sale_FAC_000616_deduct colapsen a la misma clave canónica
  const saleMatch = clean.match(/^sale_(?:(FAC|FACT|NE|NDE|N\.E|NC|ND)[-_])?([^_]+?)(?:_(\d{8,14}))?_(deduct|revert)$/i);
  if (saleMatch) {
    const rawPrefix = String(saleMatch[1] || '').toUpperCase();
    const rawDoc = String(saleMatch[2] || '').trim().toUpperCase();
    const tsPart = saleMatch[3] ? `_${saleMatch[3]}` : '';
    const op = saleMatch[4].toLowerCase();
    let docType = 'FAC';
    if (rawPrefix === 'NE' || rawPrefix === 'NDE' || rawPrefix === 'N.E' || /^(NE|NDE|N\.E)[-\s]/i.test(rawDoc)) {
      docType = 'NE';
    } else if (rawPrefix === 'NC' || /^NC[-\s]/i.test(rawDoc)) {
      docType = 'NC';
    } else if (rawPrefix === 'ND' || /^ND[-\s]/i.test(rawDoc)) {
      docType = 'ND';
    }
    const cleanNum = rawDoc
      .replace(/^(FAC-|FACT-|INV-|NE-|NDE-|N\.E-|NC-|ND-|DOC-)/i, '')
      .replace(/^0+(?=\d)/, '');
    if (cleanNum) {
      return `sale_${docType}:${cleanNum}${tsPart}_${op}`;
    }
  }
  return clean;
}

function sanitizeServerTextEncoding(text) {
  if (typeof text !== 'string' || !text.includes('\uFFFD')) return text;
  return text
    .replace(/Almac\uFFFD+n/gi, 'Almacén')
    .replace(/C\uFFFD+digo/gi, 'Código')
    .replace(/Descripci\uFFFD+n/gi, 'Descripción')
    .replace(/\uFFFD+/g, '');
}

function syncProductRowToWarehouseTable(savedProd, nowIso = new Date().toISOString()) {
  if (!savedProd || typeof savedProd !== 'object') return;
  if (!Array.isArray(database.profit_stock_by_warehouse)) database.profit_stock_by_warehouse = [];
  const prodId = String(savedProd.id || savedProd.codigo || '').trim();
  const prodCode = String(savedProd.codigo || savedProd.id || '').trim();
  if (!prodId) return;
  const stocks = resolveServerWarehouseStocks(savedProd);
  for (const [whCode, nextVal] of [['01', stocks.stock01], ['02', stocks.stock02]]) {
    const whId = `${prodId}_${whCode}`;
    const whIdx = database.profit_stock_by_warehouse.findIndex(
      (w) => w && (String(w.id || '') === whId || (String(w.co_art || w.codigo || '') === prodId && String(w.co_alma || '') === whCode))
    );
    if (whIdx >= 0) {
      database.profit_stock_by_warehouse[whIdx] = {
        ...database.profit_stock_by_warehouse[whIdx],
        stock_act: nextVal,
        stock_disp: nextVal,
        updated_at: nowIso
      };
    } else {
      database.profit_stock_by_warehouse.push({
        id: whId,
        co_art: prodId,
        codigo: prodCode,
        co_alma: whCode,
        stock_act: nextVal,
        stock_disp: nextVal,
        updated_at: nowIso
      });
    }
  }
}

function buildNormalizedItemsSignature(items = []) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const grouped = new Map();
  for (const it of items) {
    const code = String(it?.codigo || it?.co_art || it?.articulo_id || it?.articuloId || it?.id || '').trim().toUpperCase();
    const qty = Number(it?.cantidad ?? it?.qty ?? it?.total_art ?? 0);
    if (!code || !(qty > 0)) continue;
    grouped.set(code, Number(((grouped.get(code) || 0) + qty).toFixed(4)));
  }
  if (grouped.size === 0) return '';
  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}

function syncOrderStatusOnSaleInsert(savedSale) {
  if (!savedSale || typeof savedSale !== 'object' || !Array.isArray(database.orders)) return;
  const saleTipo = String(savedSale.tipo_doc || savedSale.tipoDoc || 'FACTURA').toUpperCase();
  if (saleTipo === 'NOTA_CREDITO' || saleTipo === 'NOTA_DEBITO') return;

  let targetOrderIdx = -1;
  const explicitOrderId = String(savedSale.pedido_origen_id || savedSale.pedidoOrigenId || '').trim();
  if (explicitOrderId) {
    targetOrderIdx = database.orders.findIndex(
      (o) => o && (String(o.id || '').trim() === explicitOrderId || String(o.numero_pedido || o.numeroPedido || '').trim() === explicitOrderId)
    );
  } else {
    // Auto-vincular solo si existe UN ÚNICO pedido APROBADO reciente (< 24h) del mismo cliente con exactamente los mismos ítems y cantidades
    const saleSig = buildNormalizedItemsSignature(savedSale.items);
    const saleCliId = String(savedSale.cliente_id || savedSale.clienteId || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const saleCliRif = String(savedSale.cliente_rif || savedSale.clienteRif || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const saleTs = Date.parse(savedSale.fecha_emision || savedSale.fechaEmision || savedSale.fecha || '') || Date.now();
    if (saleSig && (saleCliId || saleCliRif)) {
      const candidates = [];
      for (let idx = 0; idx < database.orders.length; idx++) {
        const o = database.orders[idx];
        if (!o || String(o.id || '').startsWith('SOL-') || String(o.id || '').startsWith('COT-')) continue;
        const st = String(o.estado || o.status || '').toUpperCase().trim();
        if (st !== 'APROBADO' && st !== 'PENDIENTE') continue;
        const oTs = Date.parse(o.fecha_emision || o.fechaEmision || o.fecha || '') || 0;
        if (oTs > 0 && Math.abs(saleTs - oTs) > 24 * 60 * 60 * 1000) continue;
        const oCliId = String(o.cliente_id || o.clienteId || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const oCliRif = String(o.cliente_rif || o.clienteRif || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const sameClient =
          (saleCliId && (saleCliId === oCliId || saleCliId === oCliRif)) ||
          (saleCliRif && (saleCliRif === oCliId || saleCliRif === oCliRif));
        if (!sameClient) continue;
        const oItems = Array.isArray(o.items) && o.items.length > 0 ? o.items : (Array.isArray(o.order_items) ? o.order_items : []);
        if (buildNormalizedItemsSignature(oItems) === saleSig) {
          candidates.push(idx);
        }
      }
      if (candidates.length === 1) {
        targetOrderIdx = candidates[0];
        const matchedOrder = database.orders[targetOrderIdx];
        savedSale.pedido_origen_id = matchedOrder.id;
        savedSale.pedido_origen_doc = matchedOrder.numero_pedido || matchedOrder.numeroPedido || matchedOrder.id;
      }
    }
  }

  if (targetOrderIdx >= 0) {
    const ord = database.orders[targetOrderIdx];
    const docNum = String(savedSale.numero_doc || savedSale.numeroDoc || savedSale.id || '').trim();
    const saleIdVal = String(savedSale.id || docNum).trim();
    const nowIso = new Date().toISOString();
    database.orders[targetOrderIdx] = {
      ...ord,
      estado: 'FACTURADO',
      status: 'FACTURADO',
      factura_id: saleIdVal,
      facturaId: saleIdVal,
      nro_factura: docNum,
      nroFactura: docNum,
      fecha_factura: savedSale.fecha_emision || savedSale.fecha || nowIso,
      updated_at: nowIso
    };
    emitRealtimeChange({
      table: 'orders',
      eventType: 'UPDATE',
      key: ord.id,
      item: database.orders[targetOrderIdx]
    });
  }
}

function resolveServerWarehouseStocks(p) {
  const rawTotal = Math.max(0, Number(p?.stock ?? 0) || 0);
  const camel01 = p?.stockAlmacen01;
  const snake01 = p?.stock_almacen_01;
  const camel02 = p?.stockAlmacen02;
  const snake02 = p?.stock_almacen_02;
  const hasC1 = camel01 !== undefined && camel01 !== null && !Number.isNaN(Number(camel01));
  const hasS1 = snake01 !== undefined && snake01 !== null && !Number.isNaN(Number(snake01));
  const hasC2 = camel02 !== undefined && camel02 !== null && !Number.isNaN(Number(camel02));
  const hasS2 = snake02 !== undefined && snake02 !== null && !Number.isNaN(Number(snake02));
  let raw01 = camel01 ?? snake01;
  let raw02 = camel02 ?? snake02;
  if (hasC1 && hasS1 && hasC2 && hasS2) {
    if (Number(snake01) + Number(snake02) === rawTotal && Number(camel01) + Number(camel02) !== rawTotal) {
      raw01 = snake01;
      raw02 = snake02;
    }
  }
  const s01 = Math.max(0, Number(raw01 ?? 0) || 0);
  const s02 = Math.max(0, Number(raw02 ?? 0) || 0);
  return { stock01: s01, stock02: s02, total: s01 + s02 };
}

function applyServerAtomicStockDelta({ lines = [], validateStrict = false, idempotencyKey = '' } = {}) {
  const rawKey = String(idempotencyKey || '').trim();
  const cleanKey = normalizeServerStockDeltaKey(rawKey);
  if (cleanKey && APPLIED_STOCK_DELTA_KEYS.has(cleanKey)) {
    return { ok: true, deduplicated: true, updatedProducts: APPLIED_STOCK_DELTA_KEYS.get(cleanKey) };
  }
  if (rawKey && rawKey !== cleanKey && APPLIED_STOCK_DELTA_KEYS.has(rawKey)) {
    return { ok: true, deduplicated: true, updatedProducts: APPLIED_STOCK_DELTA_KEYS.get(rawKey) };
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: true, updatedProducts: [] };
  }
  if (!Array.isArray(database.products)) database.products = [];
  if (!Array.isArray(database.profit_stock_by_warehouse)) database.profit_stock_by_warehouse = [];

  const grouped = new Map();
  for (const line of lines) {
    const code = String(line?.codigo || line?.co_art || line?.articuloId || line?.id || '').trim();
    const delta01 = Number(line?.delta01 || 0);
    const delta02 = Number(line?.delta02 || 0);
    if (!code || (delta01 === 0 && delta02 === 0)) continue;
    const prodIdx = database.products.findIndex(
      (p) => p && (String(p.id || '').trim() === code || String(p.codigo || '').trim() === code)
    );
    if (prodIdx < 0) {
      if (validateStrict) {
        const err = new Error(`Producto/SKU "${code}" no encontrado en el inventario.`);
        err.statusCode = 404;
        throw err;
      }
      continue;
    }
    const prev = grouped.get(prodIdx) || { prodIdx, delta01: 0, delta02: 0 };
    prev.delta01 = Number((prev.delta01 + delta01).toFixed(4));
    prev.delta02 = Number((prev.delta02 + delta02).toFixed(4));
    grouped.set(prodIdx, prev);
  }

  const staged = [];
  for (const { prodIdx, delta01, delta02 } of grouped.values()) {
    const prod = database.products[prodIdx];
    const stocks = resolveServerWarehouseStocks(prod);
    const prodCode = String(prod.codigo || prod.id || '').trim();
    const rawNext01 = Number((stocks.stock01 + delta01).toFixed(2));
    const rawNext02 = Number((stocks.stock02 + delta02).toFixed(2));

    if (validateStrict) {
      if (delta01 < 0 && rawNext01 < -0.0001) {
        const err = new Error(`Stock insuficiente para ${prodCode} en Almacén 01 (Fiscal): disponible ${stocks.stock01}, solicitado ${Math.abs(delta01)}.`);
        err.statusCode = 409;
        err.code = 'INSUFFICIENT_WAREHOUSE_STOCK';
        throw err;
      }
      if (delta02 < 0 && rawNext02 < -0.0001) {
        const err = new Error(`Stock insuficiente para ${prodCode} en Almacén 02 (N.E.): disponible ${stocks.stock02}, solicitado ${Math.abs(delta02)}.`);
        err.statusCode = 409;
        err.code = 'INSUFFICIENT_WAREHOUSE_STOCK';
        throw err;
      }
    }

    const next01 = Math.max(0, rawNext01);
    const next02 = Math.max(0, rawNext02);
    const nextTotal = Number((next01 + next02).toFixed(2));
    staged.push({
      prodIdx,
      prod,
      prodCode,
      prev01: stocks.stock01,
      prev02: stocks.stock02,
      next01,
      next02,
      nextTotal,
      delta01,
      delta02
    });
  }

  const nowIso = new Date().toISOString();
  const updatedProducts = [];
  const ledgerLines = [];

  for (const entry of staged) {
    const { prodIdx, prod, prodCode, prev01, prev02, next01, next02, nextTotal, delta01, delta02 } = entry;
    const patch = {
      stock: nextTotal,
      stockAlmacen01: next01,
      stock_almacen_01: next01,
      stockAlmacen02: next02,
      stock_almacen_02: next02,
      updated_at: nowIso
    };
    database.products[prodIdx] = { ...prod, ...patch };
    const savedProd = database.products[prodIdx];

    updatedProducts.push({
      id: savedProd.id,
      codigo: prodCode,
      ...patch
    });
    ledgerLines.push({
      codigo: prodCode,
      delta01,
      delta02,
      before: { a01: prev01, a02: prev02 },
      after: { a01: next01, a02: next02 }
    });

    emitRealtimeChange({
      table: 'products',
      eventType: 'UPDATE',
      key: savedProd.id || prodCode,
      item: savedProd
    });

    const syncWhRow = (whCode, nextVal) => {
      const whId = `${savedProd.id}_${whCode}`;
      const whIdx = database.profit_stock_by_warehouse.findIndex(
        (w) => w && (String(w.id || '') === whId || (String(w.co_art || w.codigo || '') === String(savedProd.id) && String(w.co_alma || '') === whCode))
      );
      if (whIdx >= 0) {
        database.profit_stock_by_warehouse[whIdx] = {
          ...database.profit_stock_by_warehouse[whIdx],
          stock_act: nextVal,
          stock_disp: nextVal,
          updated_at: nowIso
        };
      } else {
        database.profit_stock_by_warehouse.push({
          id: whId,
          co_art: savedProd.id,
          codigo: prodCode,
          co_alma: whCode,
          stock_act: nextVal,
          stock_disp: nextVal,
          updated_at: nowIso
        });
      }
    };

    if (delta01 !== 0) syncWhRow('01', next01);
    if (delta02 !== 0) syncWhRow('02', next02);
  }

  if (ledgerLines.length > 0) {
    if (!Array.isArray(database._stock_ledger)) database._stock_ledger = [];
    database._stock_ledger.push({
      ts: nowIso,
      key: cleanKey || rawKey || '',
      rawKey: rawKey || '',
      lines: ledgerLines
    });
    if (database._stock_ledger.length > MAX_STOCK_LEDGER_ENTRIES) {
      database._stock_ledger.splice(0, database._stock_ledger.length - MAX_STOCK_LEDGER_ENTRIES);
    }
  }

  if (cleanKey) {
    if (APPLIED_STOCK_DELTA_KEYS.size >= MAX_APPLIED_DELTA_KEYS) {
      const firstKey = APPLIED_STOCK_DELTA_KEYS.keys().next().value;
      if (firstKey) APPLIED_STOCK_DELTA_KEYS.delete(firstKey);
    }
    APPLIED_STOCK_DELTA_KEYS.set(cleanKey, updatedProducts);
    database._applied_stock_delta_keys = Array.from(APPLIED_STOCK_DELTA_KEYS.entries()).map(([key, prods]) => ({
      key,
      updatedProducts: prods
    }));
  }
  if (updatedProducts.length > 0 || cleanKey) {
    saveDatabase();
  }
  return { ok: true, updatedProducts };
}


// Helpers para evaluar filtros de PostgREST
function matchFilter(value, operator, target) {
  if (value === undefined || value === null) {
    if (operator === 'is' && target === 'null') return true;
    return false;
  }
  const strVal = String(value).toLowerCase();
  const strTarget = String(target).toLowerCase();

  switch (operator) {
    case 'eq':
      return String(value) === String(target);
    case 'neq':
      return String(value) !== String(target);
    case 'gt':
      return Number(value) > Number(target);
    case 'gte':
      return Number(value) >= Number(target);
    case 'lt':
      return Number(value) < Number(target);
    case 'lte':
      return Number(value) <= Number(target);
    case 'like':
    case 'ilike': {
      const escaped = strTarget.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*');
      return new RegExp(`^${escaped}$`, 'i').test(strVal);
    }
    case 'in': {
      // target formato: (a,b,c)
      const list = target.replace(/^\(|\)$/g, '').split(',').map(s => s.trim().toLowerCase());
      return list.includes(strVal);
    }
    case 'is':
      if (target === 'null') return value === null || value === undefined;
      if (target === 'not.null') return value !== null && value !== undefined;
      return String(value) === String(target);
    default:
      return true;
  }
}

function splitTopLevelCommas(str) {
  const result = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function matchOrFilter(row, orString, tableName = '') {
  if (!orString || typeof orString !== 'string') return false;
  const clean = orString.trim().replace(/^\(|\)$/g, '');
  const clauses = splitTopLevelCommas(clean);
  for (const clause of clauses) {
    const parts = clause.split('.');
    if (parts.length >= 2) {
      const col = parts[0].trim();
      const op = parts[1].trim();
      const target = parts.slice(2).join('.');
      if (matchFilter(row[col], op, target)) {
        return true;
      }
      if (tableName === 'products' && col === 'id') {
        if (matchFilter(row.codigo, op, target) || matchFilter(row.sku, op, target)) return true;
      }
      if ((tableName === 'sales' || tableName === 'orders') && (col === 'id' || col === 'numero_doc' || col === 'numeroDoc')) {
        if (matchFilter(row.id, op, target) || matchFilter(row.numero_doc, op, target) || matchFilter(row.numeroDoc, op, target)) return true;
      }
    }
  }
  return false;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_e) {
        const err = new Error('JSON inválido en el cuerpo de la petición');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseRawBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(req, res, statusCode, data, extraHeaders = {}) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const buf = Buffer.from(jsonStr);

  if (req && req.method === 'HEAD') {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': buf.length,
      ...extraHeaders
    });
    res.end();
    return;
  }

  const acceptEncoding = (req.headers && req.headers['accept-encoding']) || '';

  if (acceptEncoding.includes('gzip') && jsonStr.length > 1024) {
    try {
      const gzipped = zlib.gzipSync(buf);
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': gzipped.length,
        ...extraHeaders
      });
      res.end(gzipped);
      return;
    } catch (_) {
      // Fallback a texto plano si falla zlib
    }
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': buf.length,
    ...extraHeaders
  });
  res.end(buf);
}

function extractFileBufferFromMultipart(buffer, contentType) {
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return buffer;
  }
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return buffer;
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryBuf = Buffer.from('--' + boundary);

  let startIdx = buffer.indexOf(boundaryBuf);
  if (startIdx === -1) return buffer;

  const headerEndBuf = Buffer.from('\r\n\r\n');
  let bestPart = null;

  while (startIdx !== -1) {
    const headerEnd = buffer.indexOf(headerEndBuf, startIdx);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(startIdx, headerEnd).toString('utf8');
    const partStart = headerEnd + 4;
    const nextBoundary = buffer.indexOf(boundaryBuf, partStart);
    const rawEnd = nextBoundary === -1 ? buffer.length : nextBoundary;
    const partEnd = rawEnd >= 2 && buffer[rawEnd - 2] === 13 && buffer[rawEnd - 1] === 10
      ? rawEnd - 2
      : rawEnd;
    const partSlice = buffer.slice(partStart, partEnd);

    const isCacheControl = /name="cacheControl"/i.test(headerStr);
    const hasFileHeader = /filename=|Content-Type:/i.test(headerStr);
    if (!isCacheControl && (hasFileHeader || partSlice.length > 16)) {
      bestPart = partSlice;
      if (hasFileHeader) break;
    } else if (!bestPart) {
      bestPart = partSlice;
    }

    if (nextBoundary === -1) break;
    startIdx = nextBoundary;
  }

  return bestPart || buffer;
}


function renderLocalDashboardHtml() {
  const tableNames = Object.keys(database);
  const totalRows = tableNames.reduce((acc, t) => acc + (database[t]?.length || 0), 0);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Supabase Local Studio • SIGNUM MOTORVEN</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233ecf8e'><path d='M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.195.27a.396.396 0 0 0 .319.636H12v8.958a.396.396 0 0 0 .716.233l9.081-12.261.195-.27a.396.396 0 0 0-.63-.636z'/></svg>">
  <style>
    :root {
      --bg: #1c1c1c;
      --sidebar: #171717;
      --card: #232323;
      --border: #2e2e2e;
      --accent: #3ecf8e;
      --accent-hover: #34b27b;
      --text: #ededed;
      --text-muted: #8e8e8e;
      --font-code: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    /* Barra lateral */
    .sidebar {
      width: 280px;
      background: var(--sidebar);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .brand {
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
    }
    .brand svg { width: 28px; height: 28px; fill: var(--accent); }
    .brand-title { font-weight: 800; font-size: 1.05rem; letter-spacing: -0.02em; }
    .badge-free {
      background: rgba(62, 207, 142, 0.15);
      border: 1px solid rgba(62, 207, 142, 0.4);
      color: var(--accent);
      font-size: 0.65rem;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 12px;
      margin-left: auto;
    }
    .tables-header {
      padding: 1rem 1.25rem 0.5rem;
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
    .tables-list {
      flex: 1;
      overflow-y: auto;
      padding: 0 0.75rem 1rem;
    }
    .table-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.55rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.82rem;
      color: var(--text);
      transition: all 0.15s;
      margin-bottom: 2px;
      text-decoration: none;
    }
    .table-item:hover, .table-item.active {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }
    .table-item.active {
      background: rgba(62, 207, 142, 0.15);
      color: var(--accent);
      font-weight: 700;
    }
    .row-count {
      font-size: 0.7rem;
      background: #2a2a2a;
      color: var(--text-muted);
      padding: 2px 6px;
      border-radius: 10px;
      font-family: var(--font-code);
    }
    /* Contenedor Principal */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .top-bar {
      padding: 1rem 1.75rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #191919;
    }
    .top-title { font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .top-actions { display: flex; gap: 8px; align-items: center; }
    .btn {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-size: 0.78rem;
      cursor: pointer;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: 0.15s;
    }
    .btn:hover { background: #2f2f2f; color: #fff; }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #0d1e17;
      font-weight: 700;
    }
    .btn-primary:hover { background: var(--accent-hover); color: #0d1e17; }
    .banner-info {
      padding: 0.75rem 1.75rem;
      background: rgba(62, 207, 142, 0.06);
      border-bottom: 1px solid rgba(62, 207, 142, 0.2);
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .endpoint-code {
      font-family: var(--font-code);
      background: #111;
      border: 1px solid var(--border);
      padding: 3px 8px;
      border-radius: 4px;
      color: var(--accent);
    }
    .content-area {
      flex: 1;
      overflow: auto;
      padding: 1.5rem 1.75rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      background: var(--card);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    th {
      background: #1a1a1a;
      padding: 0.7rem 0.9rem;
      text-align: left;
      font-weight: 700;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      position: sticky;
      top: 0;
    }
    td {
      padding: 0.65rem 0.9rem;
      border-bottom: 1px solid var(--border);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-code);
    }
    tr:hover td { background: rgba(255, 255, 255, 0.03); }
    .search-input {
      background: #141414;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      width: 260px;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent); }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="brand">
      <svg viewBox="0 0 24 24"><path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.195.27a.396.396 0 0 0 .319.636H12v8.958a.396.396 0 0 0 .716.233l9.081-12.261.195-.27a.396.396 0 0 0-.63-.636z"/></svg>
      <div>
        <div class="brand-title">Supabase Local</div>
        <div style="font-size:0.68rem; color:var(--text-muted);">Servidor Standalone :${PORT}</div>
      </div>
      <span class="badge-free">GRATIS</span>
    </div>

    <div class="tables-header">
      <span>Tablas Disponibles (${tableNames.length})</span>
      <span style="font-family:var(--font-code);">${totalRows} filas</span>
    </div>

    <div class="tables-list" id="tablesList">
      ${tableNames.map(name => `
        <a class="table-item" href="?table=${name}" id="tab-${name}">
          <span>${name}</span>
          <span class="row-count">${database[name]?.length || 0}</span>
        </a>
      `).join('')}
    </div>
  </div>

  <div class="main">
    <div class="top-bar">
      <div class="top-title">
        <span style="color:var(--text-muted);">Tabla:</span>
        <span id="activeTableName" style="color:var(--accent);">SIGNUM_MOTORVEN</span>
        <span id="activeRowCount" class="row-count">0</span>
      </div>

      <div class="top-actions">
        <input type="text" id="searchInput" class="search-input" placeholder="Buscar en la tabla..." onkeyup="filterTable()">
        <a id="btnApiJson" class="btn" target="_blank" href="/rest/v1/SIGNUM_MOTORVEN">Ver JSON API</a>
        <button class="btn btn-primary" onclick="exportCsv()">Exportar CSV</button>
      </div>
    </div>

    <div class="banner-info">
      <div>
        <strong>Endpoint Local REST PostgREST:</strong> 
        <span class="endpoint-code" id="endpointCode">http://localhost:${PORT}/rest/v1/SIGNUM_MOTORVEN</span>
        <span style="color:var(--text-muted); margin-left:8px;">(Sin token ni cuotas de uso)</span>
      </div>
      <div>
        <span style="color:var(--accent); font-weight:700;">● ACTIVO</span>
      </div>
    </div>

    <div class="content-area" id="contentArea">
      <table id="dataTable">
        <thead id="tableHead"></thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  </div>

  <script>
    const database = ${JSON.stringify(database)};
    const urlParams = new URLSearchParams(window.location.search);
    const activeTable = urlParams.get('table') || 'SIGNUM_MOTORVEN';

    document.getElementById('activeTableName').textContent = activeTable;
    document.getElementById('endpointCode').textContent = 'http://localhost:${PORT}/rest/v1/' + activeTable;
    document.getElementById('btnApiJson').href = '/rest/v1/' + activeTable;

    const navItem = document.getElementById('tab-' + activeTable);
    if (navItem) navItem.classList.add('active');

    const rows = database[activeTable] || [];
    document.getElementById('activeRowCount').textContent = rows.length + ' registros';

    function renderTable(dataToRender) {
      const thead = document.getElementById('tableHead');
      const tbody = document.getElementById('tableBody');
      thead.innerHTML = '';
      tbody.innerHTML = '';

      if (!dataToRender || dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">No hay registros en esta tabla</td></tr>';
        return;
      }

      const columns = Object.keys(dataToRender[0]);
      const headerTr = document.createElement('tr');
      columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerTr.appendChild(th);
      });
      thead.appendChild(headerTr);

      // Mostrar primeros 100 registros para fluidez máxima
      const limit = Math.min(dataToRender.length, 100);
      for (let i = 0; i < limit; i++) {
        const r = dataToRender[i];
        const tr = document.createElement('tr');
        columns.forEach(col => {
          const td = document.createElement('td');
          const val = r[col];
          if (typeof val === 'object' && val !== null) {
            td.textContent = JSON.stringify(val);
          } else {
            td.textContent = val !== undefined && val !== null ? String(val) : '';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
    }

    renderTable(rows);

    function filterTable() {
      const q = document.getElementById('searchInput').value.toLowerCase();
      if (!q) {
        renderTable(rows);
        return;
      }
      const filtered = rows.filter(r => {
        return Object.values(r).some(v => String(v || '').toLowerCase().includes(q));
      });
      renderTable(filtered);
    }

    function exportCsv() {
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map(row => headers.map(h => JSON.stringify(row[h] !== undefined ? row[h] : '')).join(','))
      ].join('\\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeTable + '_local_supabase.csv';
      a.click();
    }
  </script>
</body>
</html>`;
}

// Evitar que desconexiones abruptas de clientes móviles/navegadores (ECONNRESET/EPIPE) detengan el servidor
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ERR_STREAM_WRITE_AFTER_END')) {
    return;
  }
  console.error('[Supabase Local] Excepción controlada:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Supabase Local] Promesa rechazada controlada:', reason?.message || reason);
});

const server = http.createServer(async (req, res) => {
  try {
    req.on('error', () => {
      sseClients.delete(res);
    });
    res.on('error', () => {
      sseClients.delete(res);
    });

    // CORS Headers universales
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = (req.headers && req.headers.host) ? String(req.headers.host).split(':')[0] : 'localhost';
    const url = new URL(req.url, `http://${hostHeader}`);
    const pathname = url.pathname;

  // 1. Dashboard Visual Web
  if (pathname === '/' || pathname === '/studio' || pathname === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderLocalDashboardHtml());
    return;
  }

  // 2. Health & Status + Backend URL discovery
  if (pathname === '/health' || pathname === '/api/status') {
    const tableNames = Object.keys(database);
    const totalRecords = tableNames.reduce((acc, t) => acc + (database[t]?.length || 0), 0);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      mode: 'SUPABASE_LOCAL_FREE',
      port: PORT,
      tables: tableNames.length,
      totalRecords,
      seq: changeSeq,
      connectedClients: sseClients.size,
      gzipEnabled: true,
      tokenRequired: false,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (pathname === '/backend_url.json' || pathname === '/motorven/backend_url.json') {
    const candidates = [
      path.join(__dirname, 'backend_url.json'),
      path.join(projectRoot, 'dist', 'backend_url.json'),
      path.join(projectRoot, 'public', 'backend_url.json')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          const content = fs.readFileSync(c, 'utf8');
          const parsed = JSON.parse(content);
          if (parsed && parsed.url && !parsed.url.includes('trycloudflare.com')) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(parsed, null, 2));
            return;
          }
        } catch (_) {}
      }
    }
    const defaultPayload = {
      url: 'https://api.signummotorven.com',
      lanUrls: [
        'http://192.168.0.3:54321',
        'http://26.45.7.149:54321',
        'http://26.229.220.202:54321'
      ],
      updatedAt: new Date().toISOString()
    };
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(defaultPayload, null, 2));
    return;
  }

  // 2.2. Admin Sync Endpoint (protegido para sincronización atómica entre servidores)
  if (req.method === 'POST' && pathname === '/admin/v1/sync-database') {
    const expectedAdminKey = process.env.SIGNUM_ADMIN_KEY || '';
    if (!expectedAdminKey) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin sync key not configured' }));
      return;
    }
    const adminKey = req.headers['x-signum-admin-key'] || '';
    if (adminKey !== expectedAdminKey) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }
    try {
      const incomingDb = await parseBody(req);
      if (incomingDb && typeof incomingDb === 'object' && Object.keys(incomingDb).length > 5) {
        database = incomingDb;
        writeAtomicJson(DB_FILE, database);
        emitRealtimeChange({ table: 'system', tableId: 'system', eventType: 'RECONCILE', action: 'RECONCILE' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, tables: Object.keys(database).length }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Payload de base de datos inválido' }));
      return;
    } catch (err) {
      res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
      return;
    }
  }

  // 2.5. Realtime API v1: /realtime/v1/events (SSE), /realtime/v1/changes (Delta Poll), /realtime/v1/broadcast
  if (pathname.startsWith('/realtime/v1/')) {
    if (req.method === 'GET' && pathname === '/realtime/v1/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
      });
      if (req.socket) {
        req.socket.setKeepAlive(true);
        req.socket.setNoDelay(true);
        req.socket.setTimeout(0);
      }
      // retry: reconexión rápida del EventSource; el comentario de relleno fuerza a proxies
      // (Cloudflare Tunnel, redes móviles) a entregar el stream de inmediato sin buffering.
      res.write(`retry: 3000\n: ${' '.repeat(2048)}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED', seq: changeSeq, bootSeq: SERVER_BOOT_SEQ, timestamp: new Date().toISOString() })}\n\n`);
      sseClients.add(res);
      const cleanup = () => {
        sseClients.delete(res);
      };
      req.on('close', cleanup);
      res.on('close', cleanup);
      return;
    }

    if (req.method === 'GET' && pathname === '/realtime/v1/changes') {
      const since = Number(url.searchParams.get('since') || 0);
      const changes = since > 0 ? recentChanges.filter(c => c.seq > since) : [];
      // Detectar huecos: el cliente estuvo desconectado más tiempo del que cubre el historial
      // en memoria, o el servidor se reinició. En ese caso debe recargar todo desde el servidor.
      const oldestSeq = recentChanges.length ? recentChanges[0].seq : changeSeq;
      const resync = since > 0 && (
        since < SERVER_BOOT_SEQ ||
        since > changeSeq ||
        (recentChanges.length > 0 && since < oldestSeq - 1)
      );
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });
      res.end(JSON.stringify({
        seq: changeSeq,
        bootSeq: SERVER_BOOT_SEQ,
        resync,
        timestamp: new Date().toISOString(),
        changes
      }));
      return;
    }

    if (req.method === 'POST' && pathname === '/realtime/v1/broadcast') {
      try {
        const body = await parseBody(req);
        const emitted = emitRealtimeChange({
          table: body.table || body.tableId || 'system',
          tableId: body.tableId || body.table || 'system',
          eventType: body.eventType || body.action || 'RECONCILE',
          action: body.action || body.eventType || 'RECONCILE',
          key: body.key || null,
          item: body.item || null,
          clientId: body.clientId || null
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, seq: emitted.seq }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }
  }

  // 2.6. Reserva atómica de correlativos en servidor (multi-caja)
  if (
    req.method === 'POST' &&
    (pathname === '/correlativos/reserve' || pathname === '/rest/v1/rpc/reserve_correlativo')
  ) {
    try {
      const body = await parseBody(req);
      const reservation = reserveNextServerCorrelativo({
        tipoDoc: body?.tipoDoc || body?.tipo_doc || 'FACTURA',
        preferredNum: body?.preferredNum ?? body?.preferred_num ?? null,
        clientId: body?.clientId || body?.client_id || req.headers['x-client-id'] || 'default'
      });
      sendJson(req, res, 200, reservation);
    } catch (err) {
      sendJson(req, res, 400, { error: err.message });
    }
    return;
  }

  // 2.7. Ajuste atómico de inventario por delta (evita condiciones de carrera y sobrescrituras de caché vieja)
  if (
    req.method === 'POST' &&
    (pathname === '/inventory/apply-delta' || pathname === '/rest/v1/rpc/apply_stock_delta')
  ) {
    try {
      const body = await parseBody(req);
      const result = applyServerAtomicStockDelta({
        lines: body?.lines || [],
        validateStrict: Boolean(body?.validateStrict),
        idempotencyKey: body?.idempotencyKey || body?.idempotency_key || ''
      });
      sendJson(req, res, 200, result);
    } catch (err) {
      const status = Number(err?.statusCode) || 400;
      sendJson(req, res, status, { error: err.message, code: err?.code || 'STOCK_DELTA_ERROR' });
    }
    return;
  }

  // 3. Supabase Storage API v1: /storage/v1/object/...
  if (pathname.startsWith('/storage/v1/')) {
    const STORAGE_ROOT = fs.existsSync(path.join(__dirname, 'storage'))
      ? path.resolve(__dirname, 'storage')
      : path.resolve(projectRoot, 'supabase', 'storage');
    if (!fs.existsSync(STORAGE_ROOT)) {
      try { fs.mkdirSync(STORAGE_ROOT, { recursive: true }); } catch (_) {}
    }

    const resolveSafeStorageFile = (bucket, subPath) => {
      const cleanBucket = String(bucket || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const resolved = path.resolve(STORAGE_ROOT, cleanBucket, String(subPath || ''));
      if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
        return null;
      }
      return resolved;
    };

    // A. GET /storage/v1/object/public/:bucket/* -> Servir archivo multimedia desde disco
    if (req.method === 'GET' && pathname.includes('/object/public/')) {
      const match = pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (match) {
        const bucket = decodeURIComponent(match[1]);
        const subPath = decodeURIComponent(match[2]).replace(/\?.*$/, '');
        const diskPath = resolveSafeStorageFile(bucket, subPath);
        if (!diskPath) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden path', statusCode: 403 }));
          return;
        }

        if (fs.existsSync(diskPath)) {
          const ext = path.extname(diskPath).toLowerCase();
          const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.json': 'application/json'
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(diskPath).pipe(res);
          return;
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Object not found', statusCode: 404 }));
          return;
        }
      }
    }

    // B. POST /storage/v1/object/list/:bucket -> Listar archivos reales del disco + seeds
    if (pathname.includes('/object/list/')) {
      const match = pathname.match(/\/object\/list\/([^/?#]+)/);
      const bucket = match ? decodeURIComponent(match[1]) : 'signum-media';
      const body = await parseBody(req);
      const prefix = (body?.prefix || '').replace(/^\/+|\/+$/g, '');
      
      const seedMap = {
        usuarios: [
          { name: 'edson_designer_master.png', id: '1', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 148520, mimetype: 'image/png' } },
          { name: 'christian_sistemas_ti.png', id: '2', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 132400, mimetype: 'image/png' } },
          { name: 'administrador_sistema.png', id: '3', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 118200, mimetype: 'image/png' } },
          { name: 'asesor_comercial_caracas.png', id: '4', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 104500, mimetype: 'image/png' } },
          { name: 'almacenista_principal.png', id: '5', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 98400, mimetype: 'image/png' } }
        ],
        productos: [
          { name: 'oilstone_mineral_20w50_galon.png', id: 'p1', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 215400, mimetype: 'image/png' } },
          { name: 'oilstone_semisintetico_15w40_paila.png', id: 'p2', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 342100, mimetype: 'image/png' } },
          { name: 'oilstone_sintetico_5w30_tambor.png', id: 'p3', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 524000, mimetype: 'image/png' } },
          { name: 'oilstone_valvulina_85w140_cuarto.png', id: 'p4', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 184500, mimetype: 'image/png' } }
        ],
        clientes: [
          { name: 'inversiones_la_gran_parada_local.png', id: 'c1', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 285000, mimetype: 'image/png' } },
          { name: 'repuestos_el_terminal_fachada.png', id: 'c2', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 310200, mimetype: 'image/png' } }
        ],
        comprobantes: [
          { name: 'transferencia_banesco_0134_fact_004512.png', id: 'r1', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 194000, mimetype: 'image/png' } },
          { name: 'pago_movil_mercantil_ref_774921.png', id: 'r2', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 165000, mimetype: 'image/png' } }
        ],
        config: [
          { name: 'logo_motorven_oficial_alta_res.png', id: 'b1', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 62400, mimetype: 'image/png' } },
          { name: 'logo_signum_erp_transparente.png', id: 'b2', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 63310, mimetype: 'image/png' } }
        ],
        proveedores: [
          { name: 'factura_keystone_internacional_f0098.png', id: 'pr1', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 345000, mimetype: 'image/png' } }
        ],
        devoluciones: [
          { name: 'evidencia_lote_tapa_precinto_danado.png', id: 'd1', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), metadata: { size: 260400, mimetype: 'image/png' } }
        ]
      };

      const seedFiles = seedMap[prefix] || [];

      // Escanear disco local
      const targetDir = resolveSafeStorageFile(bucket, prefix || '.');
      let diskFiles = [];
      if (targetDir && fs.existsSync(targetDir)) {
        try {
          const entries = fs.readdirSync(targetDir, { withFileTypes: true });
          diskFiles = entries
            .filter(e => e.isFile() && !e.name.startsWith('.'))
            .map(e => {
              const fullFilePath = path.join(targetDir, e.name);
              const stat = fs.statSync(fullFilePath);
              const ext = path.extname(e.name).toLowerCase();
              const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
              return {
                name: e.name,
                id: prefix ? `${prefix}/${e.name}` : e.name,
                updated_at: stat.mtime.toISOString(),
                created_at: stat.birthtime.toISOString(),
                metadata: {
                  size: stat.size,
                  mimetype: mime
                }
              };
            });
        } catch (_) {}
      }

      // Unir evitando duplicados por nombre
      const combined = [...diskFiles];
      for (const s of seedFiles) {
        if (!combined.some(f => f.name === s.name)) {
          combined.push(s);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(combined));
      return;
    }

    // C. POST /storage/v1/object/:bucket/* or PUT -> Subida y Guardado físico en disco
    if (req.method === 'POST' || req.method === 'PUT') {
      const match = pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
      if (match) {
        const bucket = decodeURIComponent(match[1]);
        const subPath = decodeURIComponent(match[2]).replace(/\?.*$/, '');
        const targetFile = resolveSafeStorageFile(bucket, subPath);
        if (!targetFile) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden path', statusCode: 403 }));
          return;
        }
        const targetDir = path.dirname(targetFile);

        if (!fs.existsSync(targetDir)) {
          try { fs.mkdirSync(targetDir, { recursive: true }); } catch (_) {}
        }

        const rawBuffer = await parseRawBuffer(req);
        const contentType = req.headers['content-type'] || '';
        const fileBuffer = extractFileBufferFromMultipart(rawBuffer, contentType);

        fs.writeFileSync(targetFile, fileBuffer);
        console.log(`[Supabase Storage Local] 💾 Archivo guardado: ${bucket}/${subPath} (${fileBuffer.length} bytes)`);

        const publicUrl = `http://localhost:${PORT}/storage/v1/object/public/${bucket}/${subPath}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          Key: `${bucket}/${subPath}`,
          Id: `${bucket}/${subPath}`,
          publicUrl
        }));
        return;
      }
    }

    // D. DELETE /storage/v1/object/:bucket o DELETE /storage/v1/object/:bucket/*
    if (req.method === 'DELETE') {
      const matchSub = pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
      if (matchSub) {
        const bucket = decodeURIComponent(matchSub[1]);
        const subPath = decodeURIComponent(matchSub[2]).replace(/\?.*$/, '');
        const targetFile = resolveSafeStorageFile(bucket, subPath);
        if (targetFile && fs.existsSync(targetFile)) {
          try { fs.unlinkSync(targetFile); } catch (_) {}
          console.log(`[Supabase Storage Local] 🗑️ Archivo eliminado: ${bucket}/${subPath}`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ name: subPath }]));
        return;
      }

      const matchBucket = pathname.match(/^\/storage\/v1\/object\/([^/?#]+)$/);
      if (matchBucket) {
        const bucket = decodeURIComponent(matchBucket[1]);
        const body = await parseBody(req);
        const prefixes = body?.prefixes || [];
        const deleted = [];

        for (const p of prefixes) {
          const targetFile = resolveSafeStorageFile(bucket, p);
          if (targetFile && fs.existsSync(targetFile)) {
            try {
              fs.unlinkSync(targetFile);
              console.log(`[Supabase Storage Local] 🗑️ Archivo eliminado: ${bucket}/${p}`);
            } catch (_) {}
          }
          deleted.push({ name: p });
        }

        sendJson(req, res, 200, deleted);
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // 4. PostgREST API v1: /rest/v1/:table
  if (pathname.startsWith('/rest/v1/')) {
    const parts = pathname.replace('/rest/v1/', '').split('/');
    const tableName = parts[0];

    if (!database[tableName]) {
      // Si la tabla no existe en la BD local, devolver array vacío o 404
      if (req.method === 'GET' || req.method === 'HEAD') {
        sendJson(req, res, 200, [], { 'Content-Range': '0-0/0' });
        return;
      }
      database[tableName] = [];
    }

    const tableData = database[tableName];

    // GET / HEAD /rest/v1/:table
    if (req.method === 'GET' || req.method === 'HEAD') {
      let filtered = [...tableData];

      // Enriquecer relaciones embebidas de orders con order_items
      if (tableName === 'orders' && Array.isArray(database.order_items)) {
        filtered = filtered.map(order => {
          const joined = database.order_items.filter(
            it => (it.order_id || it.orderId) === order.id
          );
          if (joined.length > 0) {
            return { ...order, order_items: joined, items: joined };
          }
          return {
            ...order,
            order_items: order.order_items || order.items || [],
            items: order.items || order.order_items || []
          };
        });
      }

      // Aplicar filtros de query params
      for (const [key, value] of url.searchParams.entries()) {
        if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset' || key === 'on_conflict') continue;
        
        if (key === 'or') {
          filtered = filtered.filter(row => matchOrFilter(row, value, tableName));
          continue;
        }

        // Formato operador: col=eq.val o col=ilike.*val*
        const dotIdx = value.indexOf('.');
        if (dotIdx > 0) {
          const operator = value.substring(0, dotIdx);
          const target = value.substring(dotIdx + 1);
          filtered = filtered.filter(row => {
            if (matchFilter(row[key], operator, target)) return true;
            if (tableName === 'products' && key === 'id') {
              return matchFilter(row.codigo, operator, target) || matchFilter(row.sku, operator, target);
            }
            if ((tableName === 'sales' || tableName === 'orders') && (key === 'id' || key === 'numero_doc' || key === 'numeroDoc')) {
              return matchFilter(row.id, operator, target) || matchFilter(row.numero_doc, operator, target) || matchFilter(row.numeroDoc, operator, target);
            }
            return false;
          });
        } else {
          filtered = filtered.filter(row => {
            if (String(row[key]) === String(value)) return true;
            if ((tableName === 'sales' || tableName === 'orders') && (key === 'id' || key === 'numero_doc' || key === 'numeroDoc')) {
              return String(row.id || '') === String(value) || String(row.numero_doc || '') === String(value) || String(row.numeroDoc || '') === String(value);
            }
            return false;
          });
        }
      }

      // Ordenamiento (?order=id.desc o ?order=col.asc)
      const orderParam = url.searchParams.get('order');
      if (orderParam) {
        const [orderCol, orderDir] = orderParam.split('.');
        const asc = orderDir !== 'desc';
        filtered.sort((a, b) => {
          const valA = a[orderCol];
          const valB = b[orderCol];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          if (typeof valA === 'number' && typeof valB === 'number') {
            return asc ? valA - valB : valB - valA;
          }
          const cmp = String(valA).trim().localeCompare(String(valB).trim(), undefined, { numeric: true, sensitivity: 'base' });
          return asc ? cmp : -cmp;
        });
      }

      const totalCount = filtered.length;

      // Paginación (?limit=50&offset=0)
      const limitParam = parseInt(url.searchParams.get('limit'));
      const offsetParam = parseInt(url.searchParams.get('offset')) || 0;

      if (!isNaN(limitParam)) {
        filtered = filtered.slice(offsetParam, offsetParam + limitParam);
      }

      // Proyección de columnas (?select=id,codigo,...) para omitir blobs base64 pesados cuando no se piden
      const selectParam = String(url.searchParams.get('select') || '').trim();
      if (selectParam && !selectParam.includes('*') && !selectParam.includes('(') && !selectParam.includes(':')) {
        const cols = selectParam.split(',').map(c => c.trim()).filter(Boolean);
        if (cols.length > 0) {
          filtered = filtered.map(row => {
            if (!row || typeof row !== 'object') return row;
            const projected = {};
            for (const col of cols) {
              if (Object.prototype.hasOwnProperty.call(row, col)) {
                projected[col] = row[col];
              }
            }
            return projected;
          });
        }
      }

      // Headers de rango
      const endRange = filtered.length > 0 ? offsetParam + filtered.length - 1 : 0;
      const rangeHeader = `${offsetParam}-${endRange}/${totalCount}`;
      res.setHeader('Content-Range', rangeHeader);

      // Single row check
      const acceptHeader = req.headers['accept'] || '';
      if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
        if (filtered.length === 0) {
          sendJson(req, res, 406, { message: 'JSON object requested, but no rows returned' });
          return;
        }
        sendJson(req, res, 200, filtered[0]);
        return;
      }

      sendJson(req, res, 200, filtered, { 'Content-Range': rangeHeader });
      return;
    }

    // POST /rest/v1/:table (Insertar / Upsert)
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const rowsToInsert = Array.isArray(body) ? body : [body];
        const preferHeader = String(req.headers['prefer'] || '').toLowerCase();
        const isUpsertMode =
          preferHeader.includes('resolution=merge-duplicates') ||
          preferHeader.includes('resolution=ignore-duplicates');

        const inserted = [];
        let shouldPersist = false;

        for (const item of rowsToInsert) {
          const newRow = { ...item };
          if (newRow.id === undefined) {
            newRow.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          }

          // Evitar contaminar user_activity_logs con ruido de autotests
          if (tableName === 'user_activity_logs') {
            const uname = String(newRow.username || '').toLowerCase();
            const uNombre = String(newRow.user_nombre || newRow.userNombre || '').toLowerCase();
            const det = String(newRow.detalles || '').toLowerCase();
            if (
              uname.startsWith('autotest_') ||
              uNombre.startsWith('autotest_') ||
              det.includes('autotest_') ||
              det.includes('usuario temporal de test') ||
              det.includes('prueba automatizada') ||
              det.includes('@undefined')
            ) {
              inserted.push(newRow);
              continue;
            }
          }

          if (tableName === 'users') {
            const existingById = tableData.find(r => r && r.id && String(r.id).trim().toLowerCase() === String(newRow.id).trim().toLowerCase());
            if (existingById && !String(newRow.username || '').trim()) {
              newRow.username = existingById.username;
            }
            if (!String(newRow.username || '').trim()) {
              continue;
            }
          }

          if (tableName === 'products') {
            const desc = String(newRow.descripcion || newRow.nombre || '').toLowerCase();
            let u = newRow.unidad || 'Caja';
            if (u === '04' || u.toLowerCase() === 'paila' || desc.includes('(paila)') || desc.includes('(pl)')) u = 'Paila';
            else if (u === '03' || u.toLowerCase() === 'tambor') u = 'Tambor';
            else if (u === '02' || u.toLowerCase() === 'totem') u = 'Totem';
            else if (u === '01' || u.toLowerCase() === 'litros') u = 'Litros';
            else if (u === '05' || u.toLowerCase() === 'caja') u = 'Caja';
            newRow.unidad = u;

            let realL = Number(newRow.litrosPorUnidad || newRow.litros_por_unidad || 0);
            if (u === 'Paila') {
              realL = 19;
            } else if (u === 'Tambor') {
              realL = 208;
            } else if (u === 'Totem') {
              realL = 1000;
            } else if (u === 'Litros') {
              realL = 1;
            } else if (u === 'Caja') {
              realL = (realL > 1 && realL !== 19) ? realL : 11.35;
            }
            newRow.litrosPorUnidad = realL;
            newRow.litros_por_unidad = realL;
            if (typeof newRow.ubicacion === 'string') {
              newRow.ubicacion = sanitizeServerTextEncoding(newRow.ubicacion);
            }
          }

          if (tableName === 'sales' || tableName === 'profit_invoices') {
            const isProfTable = tableName === 'profit_invoices';
            if (isRowBlockedByDeletedTombstone(newRow, isProfTable)) {
              // Evitar resurrección de documentos ya eliminados o duplicados desde cachés viejos de navegadores
              inserted.push(newRow);
              continue;
            }
          }

          if (tableName === 'sales' && !isUpsertMode) {
            const originOrderId = String(newRow.pedido_origen_id || newRow.pedidoOrigenId || '').trim();
            if (originOrderId) {
              const dupOrderSale = tableData.find(
                r =>
                  r &&
                  String(r.pedido_origen_id || r.pedidoOrigenId || '').trim() === originOrderId &&
                  !['ANULADA', 'ANULADO'].includes(String(r.estado || '').toUpperCase().trim())
              );
              if (dupOrderSale) {
                sendJson(req, res, 409, {
                  code: '23505',
                  errorCode: 'ORDER_ALREADY_INVOICED',
                  message: `El pedido ${originOrderId} ya fue facturado previamente (#${dupOrderSale.numero_doc || dupOrderSale.numeroDoc || dupOrderSale.id}).`,
                  existingId: dupOrderSale.id,
                  existingNumeroDoc: dupOrderSale.numero_doc || dupOrderSale.numeroDoc
                });
                return;
              }
            }
          }

          const existingIdx = tableData.findIndex(r => {
            if (tableName === 'profit_invoices' || tableName === 'sales') {
              const isProf = tableName === 'profit_invoices';
              const kNew = canonicalServerDocKey(newRow, isProf);
              const kOld = canonicalServerDocKey(r, isProf);
              if (kNew && kOld) return kNew === kOld;
            }
            if (newRow.id && r.id && String(r.id).trim().toUpperCase() === String(newRow.id).trim().toUpperCase()) return true;
            if (tableName === 'users' && newRow.username && r.username) {
              return String(r.username).trim().toLowerCase() === String(newRow.username).trim().toLowerCase();
            }
            if (tableName === 'products') {
              const codeNew = String(newRow.codigo || newRow.sku || newRow.id || '').trim().toUpperCase();
              const codeOld = String(r.codigo || r.sku || r.id || '').trim().toUpperCase();
              return codeNew && codeOld && codeNew === codeOld;
            }
            if (tableName === 'clients') {
              const rifNew = String(newRow.rif || '').trim().toUpperCase();
              const rifOld = String(r.rif || '').trim().toUpperCase();
              if (rifNew && rifOld && rifNew === rifOld) return true;
              const codeNew = String(newRow.codigo || '').trim().toUpperCase();
              const codeOld = String(r.codigo || '').trim().toUpperCase();
              return codeNew && codeOld && codeNew === codeOld;
            }
            if (tableName === 'profit_accounts_payable') {
              const cpNew = String(newRow.nroDoc || newRow.nro_doc || '').trim().toUpperCase();
              const cpOld = String(r.nroDoc || r.nro_doc || '').trim().toUpperCase();
              const tipoNew = String(newRow.tipoDoc || newRow.tipo_doc || '').trim().toUpperCase();
              const tipoOld = String(r.tipoDoc || r.tipo_doc || '').trim().toUpperCase();
              if (!cpNew || !cpOld || cpNew !== cpOld || (tipoNew && tipoOld && tipoNew !== tipoOld)) {
                return false;
              }
              const normProv = (v) => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
              const normName = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, ' ');
              const provCodeNew = normProv(newRow.coProv || newRow.co_prov || newRow.provRif || newRow.prov_rif);
              const provCodeOld = normProv(r.coProv || r.co_prov || r.provRif || r.prov_rif);
              if (provCodeNew && provCodeOld) return provCodeNew === provCodeOld;
              const nameNew = normName(newRow.provNombre || newRow.prov_nombre || newRow.provDes);
              const nameOld = normName(r.provNombre || r.prov_nombre || r.provDes);
              return Boolean(nameNew && nameOld && nameNew === nameOld);
            }
            if (tableName === 'profit_warehouses') {
              const getWKey = x => String(x.coAlm || x.co_alm || x.coAlma || x.co_alma || x.id || '').trim().toUpperCase().replace(/^ALM-/, '');
              const wNew = getWKey(newRow);
              const wOld = getWKey(r);
              return wNew && wOld && wNew === wOld;
            }
            if (tableName === 'profit_bank_accounts') {
              const bNew = String(newRow.codCta || newRow.cod_cta || newRow.id || '').trim().toUpperCase();
              const bOld = String(r.codCta || r.cod_cta || r.id || '').trim().toUpperCase();
              return bNew && bOld && bNew === bOld;
            }
            if (tableName === 'profit_cash_desks') {
              const cNew = String(newRow.coCaja || newRow.co_caja || newRow.id || '').trim().toUpperCase();
              const cOld = String(r.coCaja || r.co_caja || r.id || '').trim().toUpperCase();
              return cNew && cOld && cNew === cOld;
            }
            if (tableName === 'profit_currencies') {
              const mNew = String(newRow.coMone || newRow.co_mone || newRow.id || '').trim().toUpperCase();
              const mOld = String(r.coMone || r.co_mone || r.id || '').trim().toUpperCase();
              return mNew && mOld && mNew === mOld;
            }
            if (tableName === 'profit_transports') {
              const tNew = String(newRow.coTran || newRow.co_tran || newRow.id || '').replace(/^TRAN-/, '').trim().toUpperCase();
              const tOld = String(r.coTran || r.co_tran || r.id || '').replace(/^TRAN-/, '').trim().toUpperCase();
              return tNew && tOld && tNew === tOld;
            }
            if (tableName === 'profit_zones') {
              const zNew = String(newRow.coZon || newRow.co_zon || newRow.id || '').replace(/^ZON-/, '').trim().toUpperCase();
              const zOld = String(r.coZon || r.co_zon || r.id || '').replace(/^ZON-/, '').trim().toUpperCase();
              return zNew && zOld && zNew === zOld;
            }
            if (tableName === 'profit_sellers') {
              const sNew = String(newRow.coVen || newRow.co_ven || newRow.id || '').trim().replace(/^USR-SELLER-/i, '').toUpperCase();
              const sOld = String(r.coVen || r.co_ven || r.id || '').trim().replace(/^USR-SELLER-/i, '').toUpperCase();
              return sNew && sOld && sNew === sOld;
            }
            if (tableName === 'profit_suppliers' || tableName === 'suppliers') {
              const pNew = String(newRow.coProv || newRow.co_prov || newRow.rif || newRow.id || '').trim().toUpperCase();
              const pOld = String(r.coProv || r.co_prov || r.rif || r.id || '').trim().toUpperCase();
              return pNew && pOld && pNew === pOld;
            }
            if (tableName === 'profit_inventory_adjustments') {
              const aNew = String(newRow.ajueNum || newRow.ajue_num || newRow.id || '').trim().toUpperCase();
              const aOld = String(r.ajueNum || r.ajue_num || r.id || '').trim().toUpperCase();
              return aNew && aOld && aNew === aOld;
            }
            if (tableName === 'profit_warehouse_transfers') {
              const tNew = String(newRow.trasNum || newRow.tras_num || newRow.id || '').trim().toUpperCase();
              const tOld = String(r.trasNum || r.tras_num || r.id || '').trim().toUpperCase();
              return tNew && tOld && tNew === tOld;
            }
            if (tableName === 'profit_product_lines') {
              const lNew = String(newRow.coLin || newRow.co_lin || newRow.id || '').trim().toUpperCase();
              const lOld = String(r.coLin || r.co_lin || r.id || '').trim().toUpperCase();
              return lNew && lOld && lNew === lOld;
            }
            if (tableName === 'profit_product_sublines') {
              const sNew = String(newRow.coSubl || newRow.co_subl || newRow.co_sub || newRow.id || '').trim().toUpperCase();
              const sOld = String(r.coSubl || r.co_subl || r.co_sub || r.id || '').trim().toUpperCase();
              return sNew && sOld && sNew === sOld;
            }
            if (tableName === 'profit_product_categories') {
              const cNew = String(newRow.coCat || newRow.co_cat || newRow.id || '').trim().toUpperCase();
              const cOld = String(r.coCat || r.co_cat || r.id || '').trim().toUpperCase();
              return cNew && cOld && cNew === cOld;
            }
            if (tableName === 'config' && (newRow.id === 1 || r.id === 1)) return true;
            return false;
          });

          if (existingIdx >= 0 && !isUpsertMode && (tableName === 'sales' || tableName === 'profit_invoices')) {
            sendJson(req, res, 409, {
              code: '23505',
              errorCode: 'DUPLICATE_CORRELATIVE',
              message: `El correlativo o ID ya existe en ${tableName}.`,
              existingId: tableData[existingIdx].id,
              existingNumeroDoc: tableData[existingIdx].numero_doc || tableData[existingIdx].numeroDoc || tableData[existingIdx].factNum
            });
            return;
          }

          shouldPersist = true;
          let savedRow;
          if (existingIdx >= 0) {
            if (tableName === 'products' && newRow._preserveServerStock) {
              const sanitizedUpdate = { ...newRow };
              delete sanitizedUpdate._preserveServerStock;
              delete sanitizedUpdate.stock;
              delete sanitizedUpdate.stockAlmacen01;
              delete sanitizedUpdate.stock_almacen_01;
              delete sanitizedUpdate.stockAlmacen02;
              delete sanitizedUpdate.stock_almacen_02;
              tableData[existingIdx] = { ...tableData[existingIdx], ...sanitizedUpdate };
            } else {
              const cleanNew = { ...newRow };
              delete cleanNew._preserveServerStock;
              tableData[existingIdx] = { ...tableData[existingIdx], ...cleanNew };
            }
            savedRow = tableData[existingIdx];
          } else {
            const cleanNew = { ...newRow };
            delete cleanNew._preserveServerStock;
            tableData.push(cleanNew);
            savedRow = cleanNew;
          }
          if (tableName === 'products' && !newRow._preserveServerStock) {
            syncProductRowToWarehouseTable(savedRow, savedRow.updated_at || new Date().toISOString());
          }
          if (tableName === 'sales') {
            syncOrderStatusOnSaleInsert(savedRow);
          }
          if (tableName === 'sales' || tableName === 'profit_invoices') {
            releaseServerCorrelativeReservation(savedRow);
          }
          inserted.push(savedRow);

          emitRealtimeChange({
            table: tableName,
            eventType: existingIdx >= 0 ? 'UPDATE' : 'INSERT',
            key: savedRow.id || savedRow.co_ven || savedRow.coVen || savedRow.codigo,
            item: savedRow
          });
        }

        // Si se insertaron order_items, sincronizar también el pedido padre en database.orders
        if (tableName === 'order_items' && Array.isArray(database.orders) && inserted.length > 0) {
          const affectedOrderIds = new Set(inserted.map(it => it.order_id || it.orderId).filter(Boolean));
          for (const ordId of affectedOrderIds) {
            const ordIdx = database.orders.findIndex(o => o.id === ordId);
            if (ordIdx >= 0) {
              const allItems = database.order_items.filter(it => (it.order_id || it.orderId) === ordId);
              database.orders[ordIdx] = {
                ...database.orders[ordIdx],
                items: allItems,
                order_items: allItems
              };
              emitRealtimeChange({
                table: 'orders',
                eventType: 'UPDATE',
                key: ordId,
                item: database.orders[ordIdx]
              });
            }
          }
        }

        if (shouldPersist) {
          saveDatabase();
        }

        const acceptHeader = req.headers['accept'] || '';
        const isSingleRequested = acceptHeader.includes('application/vnd.pgrst.object+json');
        const responseData = isSingleRequested
          ? (inserted[0] ?? null)
          : (Array.isArray(body) ? inserted : (inserted[0] ?? null));

        sendJson(req, res, 201, responseData);
        return;
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // PATCH /rest/v1/:table (Actualizar)
    if (req.method === 'PATCH') {
      try {
        const body = await parseBody(req);
        const updated = [];

        // Encontrar filas que coincidan con query params
        for (let i = 0; i < tableData.length; i++) {
          const row = tableData[i];
          let matches = true;

          for (const [key, value] of url.searchParams.entries()) {
            if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;
            const dotIdx = value.indexOf('.');
            const rowVal =
              row[key] !== undefined
                ? row[key]
                : key === 'co_ven'
                  ? (row.coVen ?? row.id)
                  : key === 'coVen'
                    ? (row.co_ven ?? row.id)
                    : undefined;
            if (dotIdx > 0) {
              const operator = value.substring(0, dotIdx);
              const target = value.substring(dotIdx + 1);
              const directMatch = matchFilter(rowVal, operator, target);
              const ciMatch =
                operator === 'eq' &&
                rowVal !== undefined &&
                rowVal !== null &&
                String(rowVal).trim().toLowerCase() === String(target).trim().toLowerCase();
              if (!directMatch && !ciMatch) {
                matches = false;
                break;
              }
            } else if (String(rowVal ?? '').trim().toLowerCase() !== String(value ?? '').trim().toLowerCase()) {
              matches = false;
              break;
            }
          }

          if (matches) {
            let patchBody = body;
            if (tableName === 'products' && body && typeof body === 'object') {
              patchBody = { ...body };
              if (typeof patchBody.ubicacion === 'string') {
                patchBody.ubicacion = sanitizeServerTextEncoding(patchBody.ubicacion);
              }
              if (patchBody._preserveServerStock) {
                delete patchBody._preserveServerStock;
                delete patchBody.stock;
                delete patchBody.stockAlmacen01;
                delete patchBody.stock_almacen_01;
                delete patchBody.stockAlmacen02;
                delete patchBody.stock_almacen_02;
              }
            }
            tableData[i] = { ...row, ...patchBody };
            if (
              tableName === 'products' &&
              body &&
              !body._preserveServerStock &&
              (body.stock !== undefined || body.stockAlmacen01 !== undefined || body.stock_almacen_01 !== undefined || body.stockAlmacen02 !== undefined || body.stock_almacen_02 !== undefined)
            ) {
              syncProductRowToWarehouseTable(tableData[i], tableData[i].updated_at || new Date().toISOString());
            }
            updated.push(tableData[i]);
            emitRealtimeChange({
              table: tableName,
              eventType: 'UPDATE',
              key: tableData[i].id || tableData[i].co_ven || tableData[i].coVen || tableData[i].codigo,
              item: tableData[i]
            });
          }
        }

        if (updated.length > 0) {
          saveDatabase();
        }

        const acceptHeader = req.headers['accept'] || '';
        const isSingleRequested = acceptHeader.includes('application/vnd.pgrst.object+json');
        const responseData = isSingleRequested ? (updated[0] || {}) : updated;

        sendJson(req, res, 200, responseData);
        return;
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // DELETE /rest/v1/:table
    if (req.method === 'DELETE') {
      try {
        const remaining = [];
        const deleted = [];

        for (const row of tableData) {
          let matches = true;
          for (const [key, value] of url.searchParams.entries()) {
            if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;

            if (key === 'or') {
              if (!matchOrFilter(row, value, tableName)) {
                matches = false;
                break;
              }
              continue;
            }

            const dotIdx = value.indexOf('.');
            if (dotIdx > 0) {
              const operator = value.substring(0, dotIdx);
              const target = value.substring(dotIdx + 1);
              let doesMatch = matchFilter(row[key], operator, target);
              if (!doesMatch && tableName === 'products' && key === 'id') {
                doesMatch = matchFilter(row.codigo, operator, target) || matchFilter(row.sku, operator, target);
              }
              if (!doesMatch && tableName === 'clients' && (key === 'id' || key === 'codigo')) {
                doesMatch = matchFilter(row.id, operator, target) || matchFilter(row.codigo, operator, target) || matchFilter(row.co_cli, operator, target);
              }
              if (!doesMatch && (tableName === 'sales' || tableName === 'orders') && (key === 'id' || key === 'numero_doc' || key === 'numeroDoc')) {
                doesMatch = matchFilter(row.id, operator, target) || matchFilter(row.numero_doc, operator, target) || matchFilter(row.numeroDoc, operator, target);
              }
              if (!doesMatch) {
                matches = false;
                break;
              }
            } else {
              let doesMatch = String(row[key]) === String(value);
              if (!doesMatch && tableName === 'products' && key === 'id') {
                doesMatch = String(row.codigo) === String(value) || String(row.sku) === String(value);
              }
              if (!doesMatch && tableName === 'clients' && (key === 'id' || key === 'codigo')) {
                doesMatch = String(row.id || '') === String(value) || String(row.codigo || '') === String(value) || String(row.co_cli || '') === String(value);
              }
              if (!doesMatch && tableName === 'users' && key === 'id') {
                doesMatch = String(row.username || '').toLowerCase() === String(value).toLowerCase();
              }
              if (!doesMatch && (tableName === 'sales' || tableName === 'orders') && (key === 'id' || key === 'numero_doc' || key === 'numeroDoc')) {
                doesMatch = String(row.id || '') === String(value) || String(row.numero_doc || '') === String(value) || String(row.numeroDoc || '') === String(value);
              }
              if (!doesMatch) {
                matches = false;
                break;
              }
            }
          }

          if (matches) {
            deleted.push(row);
            if (tableName === 'sales' || tableName === 'profit_invoices') {
              recordDeletedDocTombstone(row, tableName === 'profit_invoices');
            }
            emitRealtimeChange({
              table: tableName,
              eventType: 'DELETE',
              key: row.id || row.co_ven || row.coVen || row.codigo,
              item: row
            });
          } else {
            remaining.push(row);
          }
        }

        database[tableName] = remaining;
        if (deleted.length > 0) {
          saveDatabase();
        }

        sendJson(req, res, 200, deleted);
        return;
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

    // Ruta no encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint no encontrado en Supabase Local' }));
  } catch (err) {
    console.error('[Supabase Local] Error no controlado en petición HTTP:', err);
    try {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error interno en el servidor local: ' + (err?.message || err) }));
      }
    } catch (_) {}
  }
});

// Mantener keep-alive más largo que el pool HTTP/1.1 de cloudflared (90s > 60s) para
// evitar la carrera de cierre de socket que provoca errores 502 (origin_bad_gateway) en Cloudflare.
server.keepAliveTimeout = 90000;
server.headersTimeout = 95000;
server.requestTimeout = 120000;

// Inicializar y arrancar servidor
await initDatabase();

// Manejo de errores de puerto ocupado: reintentar hasta 3 veces ante un reinicio transitorio
// y salir limpiamente si ya existe otra instancia activa dueña del puerto (evita bucles infinitos).
let addrInUseRetries = 0;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    addrInUseRetries += 1;
    if (addrInUseRetries > 3) {
      console.warn(`[Supabase Local] Puerto ${PORT} ya está atendido por otra instancia activa. Saliendo sin duplicar procesos.`);
      process.exit(0);
      return;
    }
    console.warn(`[Supabase Local] Puerto ${PORT} en uso temporal (${addrInUseRetries}/3). Reintentando...`);
    setTimeout(() => {
      try {
        server.close();
        server.listen(PORT, HOST);
      } catch (_) {}
    }, 1200);
  } else {
    console.error('[Supabase Local] Error:', err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`================================================================`);
  console.log(`🚀 SERVIDOR LOCAL SUPABASE EN LÍNEA (GRATUITO Y SIN TOKEN)`);
  console.log(`================================================================`);
  console.log(`📡 URL API REST PostgREST: http://localhost:${PORT}/rest/v1`);
  console.log(`🖥️  Supabase Studio Local: http://localhost:${PORT}/`);
  console.log(`📊 Base de datos: 32 tablas con datos vivos y persistencia en disco.`);
  console.log(`⚡ Sin límites de cuota, sin token requerido, 100% libre.`);
  console.log(`================================================================`);
});
