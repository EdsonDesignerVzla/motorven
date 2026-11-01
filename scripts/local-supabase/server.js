/**
 * SERVIDOR LOCAL SUPABASE STANDALONE - MOTORVEN SIGNUM
 * Puerto por defecto: 54321 (compatible con PostgREST y SDK Supabase)
 * 100% Gratuito - Sin Tokens - Sin Cuotas de Egress - Acceso Ilimitado
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

const PORT = process.env.SUPABASE_LOCAL_PORT || 54321;
const HOST = '0.0.0.0';
const DB_FILE = path.join(projectRoot, 'supabase', 'local_database.json');

// Prevenir caídas no deseadas de Node
process.on('uncaughtException', (err) => {
  console.warn('[Supabase Local] Uncaught Exception prevenido:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Supabase Local] Unhandled Rejection prevenido:', reason);
});

// Mantener activo el event loop indefinidamente
setInterval(() => {}, 60000);

let database = {};

async function initDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      console.log(`[Supabase Local] Cargando base de datos persistida desde: ${DB_FILE}`);
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      database = JSON.parse(raw);
      if (Array.isArray(database.profit_invoices)) {
        database.profit_invoices.forEach(f => {
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
        });
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
      saveDatabase();
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
      notifications: JSON.parse(JSON.stringify(realData.REAL_NOTIFICATIONS || []))
    };
    saveDatabase();
  } catch (err) {
    console.error('[Supabase Local] Error al importar datos de respaldo:', err);
    database = {};
  }
}

let saveTimeout = null;
function saveDatabase() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), 'utf8');
    } catch (e) {
      console.error('[Supabase Local] Error guardando base de datos:', e);
    }
  }, 300);
}

// Conexion con Profit Plus eliminada: Supabase local es la unica fuente de verdad.
function forwardWriteToProfitBridge() {}

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
      const pattern = strTarget.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(strVal);
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
      } catch (e) {
        resolve({});
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
  const headerEnd = buffer.indexOf(headerEndBuf, startIdx);
  if (headerEnd === -1) return buffer;

  const fileStart = headerEnd + 4;
  const nextBoundary = buffer.indexOf(boundaryBuf, fileStart);
  if (nextBoundary === -1) return buffer.slice(fileStart);

  const fileEnd = nextBoundary >= 2 && buffer[nextBoundary - 2] === 13 && buffer[nextBoundary - 1] === 10
    ? nextBoundary - 2
    : nextBoundary;

  return buffer.slice(fileStart, fileEnd);
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

// Servidor HTTP
const server = http.createServer(async (req, res) => {
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

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Dashboard Visual Web
  if (pathname === '/' || pathname === '/studio' || pathname === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderLocalDashboardHtml());
    return;
  }

  // 2. Health & Status
  if (pathname === '/health' || pathname === '/api/status') {
    const tableNames = Object.keys(database);
    const totalRecords = tableNames.reduce((acc, t) => acc + (database[t]?.length || 0), 0);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      mode: 'SUPABASE_LOCAL_FREE',
      port: PORT,
      tables: tableNames.length,
      totalRecords,
      tokenRequired: false,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 3. Supabase Storage API v1: /storage/v1/object/...
  if (pathname.startsWith('/storage/v1/')) {
    const STORAGE_ROOT = path.join(projectRoot, 'supabase', 'storage');
    if (!fs.existsSync(STORAGE_ROOT)) {
      try { fs.mkdirSync(STORAGE_ROOT, { recursive: true }); } catch (_) {}
    }

    // A. GET /storage/v1/object/public/:bucket/* -> Servir archivo multimedia desde disco
    if (req.method === 'GET' && pathname.includes('/object/public/')) {
      const match = pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (match) {
        const bucket = decodeURIComponent(match[1]);
        const subPath = decodeURIComponent(match[2]).replace(/\?.*$/, '');
        const diskPath = path.join(STORAGE_ROOT, bucket, subPath);

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
      const targetDir = prefix ? path.join(STORAGE_ROOT, bucket, prefix) : path.join(STORAGE_ROOT, bucket);
      let diskFiles = [];
      if (fs.existsSync(targetDir)) {
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
        const targetFile = path.join(STORAGE_ROOT, bucket, subPath);
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
        const targetFile = path.join(STORAGE_ROOT, bucket, subPath);
        if (fs.existsSync(targetFile)) {
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
          const targetFile = path.join(STORAGE_ROOT, bucket, p);
          if (fs.existsSync(targetFile)) {
            try {
              fs.unlinkSync(targetFile);
              console.log(`[Supabase Storage Local] 🗑️ Archivo eliminado: ${bucket}/${p}`);
            } catch (_) {}
          }
          deleted.push({ name: p });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(deleted));
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
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' });
        res.end(JSON.stringify([]));
        return;
      }
      database[tableName] = [];
    }

    const tableData = database[tableName];

    // GET /rest/v1/:table
    if (req.method === 'GET') {
      let filtered = [...tableData];

      // Aplicar filtros de query params
      for (const [key, value] of url.searchParams.entries()) {
        if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;
        
        // Formato operador: col=eq.val o col=ilike.*val*
        const dotIdx = value.indexOf('.');
        if (dotIdx > 0) {
          const operator = value.substring(0, dotIdx);
          const target = value.substring(dotIdx + 1);
          filtered = filtered.filter(row => matchFilter(row[key], operator, target));
        } else {
          filtered = filtered.filter(row => String(row[key]) === String(value));
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
          return asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
      }

      const totalCount = filtered.length;

      // Paginación (?limit=50&offset=0)
      const limitParam = parseInt(url.searchParams.get('limit'));
      const offsetParam = parseInt(url.searchParams.get('offset')) || 0;

      if (!isNaN(limitParam)) {
        filtered = filtered.slice(offsetParam, offsetParam + limitParam);
      }

      // Headers de rango
      const endRange = filtered.length > 0 ? offsetParam + filtered.length - 1 : 0;
      res.setHeader('Content-Range', `${offsetParam}-${endRange}/${totalCount}`);

      // Single row check
      const acceptHeader = req.headers['accept'] || '';
      if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
        if (filtered.length === 0) {
          res.writeHead(406, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'JSON object requested, but no rows returned' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(filtered[0]));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(filtered));
      return;
    }

    // POST /rest/v1/:table (Insertar)
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const rowsToInsert = Array.isArray(body) ? body : [body];
        
        const inserted = [];
        for (const item of rowsToInsert) {
          const newRow = { ...item };
          if (newRow.id === undefined) {
            newRow.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          }
          
          const existingIdx = tableData.findIndex(r => {
            if (newRow.id && r.id && String(r.id).trim().toUpperCase() === String(newRow.id).trim().toUpperCase()) return true;
            if (tableName === 'users' && newRow.username && r.username) {
              return String(r.username).trim().toLowerCase() === String(newRow.username).trim().toLowerCase();
            }
            if (tableName === 'products') {
              const codeNew = String(newRow.codigo || newRow.id || '').trim().toUpperCase();
              const codeOld = String(r.codigo || r.id || '').trim().toUpperCase();
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
            if (tableName === 'profit_invoices') {
              const fNew = String(newRow.facturaNumero || newRow.fact_num || newRow.id || '').trim().toUpperCase();
              const fOld = String(r.facturaNumero || r.fact_num || r.id || '').trim().toUpperCase();
              return fNew && fOld && fNew === fOld;
            }
            if (tableName === 'profit_warehouses') {
              const getWKey = x => String(x.coAlm || x.co_alm || x.coAlma || x.co_alma || x.id || '').trim().toUpperCase().replace(/^ALM-/, '');
              const wNew = getWKey(newRow);
              const wOld = getWKey(r);
              return wNew && wOld && wNew === wOld;
            }
            if (tableName === 'profit_bank_accounts') {
              const bNew = String(newRow.codCta || newRow.cod_cta || newRow.id || '').trim().toUpperCase();
              const bOld = String(r.codCta || r.co_cta || r.id || '').trim().toUpperCase();
              return bNew && bOld && bNew === bOld;
            }
            if (tableName === 'profit_sellers') {
              const sNew = String(newRow.coVen || newRow.co_ven || newRow.id || '').trim().toUpperCase();
              const sOld = String(r.coVen || r.co_ven || r.id || '').trim().toUpperCase();
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
            if (tableName === 'config' && (newRow.id === 1 || r.id === 1)) return true;
            return false;
          });

          if (existingIdx >= 0) {
            tableData[existingIdx] = { ...tableData[existingIdx], ...newRow };
            inserted.push(tableData[existingIdx]);
          } else {
            tableData.push(newRow);
            inserted.push(newRow);
          }
        }

        saveDatabase();

        const acceptHeader = req.headers['accept'] || '';
        const isSingleRequested = acceptHeader.includes('application/vnd.pgrst.object+json');
        const responseData = isSingleRequested ? (inserted[0] || null) : (Array.isArray(body) ? inserted : inserted[0]);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
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
            if (dotIdx > 0) {
              const operator = value.substring(0, dotIdx);
              const target = value.substring(dotIdx + 1);
              if (!matchFilter(row[key], operator, target)) {
                matches = false;
                break;
              }
            } else if (String(row[key]) !== String(value)) {
              matches = false;
              break;
            }
          }

          if (matches) {
            tableData[i] = { ...row, ...body };
            updated.push(tableData[i]);
          }
        }

        saveDatabase();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(updated));
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
            const dotIdx = value.indexOf('.');
            if (dotIdx > 0) {
              const operator = value.substring(0, dotIdx);
              const target = value.substring(dotIdx + 1);
              if (!matchFilter(row[key], operator, target)) {
                matches = false;
                break;
              }
            } else if (String(row[key]) !== String(value)) {
              matches = false;
              break;
            }
          }

          if (matches) {
            deleted.push(row);
          } else {
            remaining.push(row);
          }
        }

        database[tableName] = remaining;
        saveDatabase();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(deleted));
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
});

// Inicializar y arrancar servidor
await initDatabase();

// Manejo de errores de puerto ocupado o reconexión
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Supabase Local] Puerto ${PORT} en uso temporal. Reintentando...`);
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
