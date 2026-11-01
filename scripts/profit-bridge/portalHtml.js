/**
 * Generador del Portal Web Visual para la Raíz del Servidor Profit Plus 2K8 (Puerto 3005)
 * SIGNUM MOTORVEN ERP & BI
 */

export function renderServerPortalHtml(config, lastSyncTime, lastSyncStats, isSyncing) {
  const syncTimeFormatted = lastSyncTime ? new Date(lastSyncTime).toLocaleString('es-VE') : 'Pendiente';
  const articlesCount = lastSyncStats?.articlesSynced || 0;
  const clientsCount = lastSyncStats?.clientsSynced || 0;
  const ordersCount = lastSyncStats?.ordersSynced || 0;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SIGNUM MOTORVEN • Servidor Profit Plus 2K8 & SQL Server</title>
  <link rel="icon" type="image/png" href="https://img.icons8.com/color/48/oil-industry.png">
  <style>
    :root {
      --bg: #060913;
      --card-bg: rgba(12, 20, 39, 0.85);
      --card-border: rgba(56, 189, 248, 0.25);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --navy: #002b7a;
      --cyan: #38bdf8;
      --green: #10b981;
      --amber: #f59e0b;
      --red: #e60012;
      --font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      background-image: radial-gradient(circle at top, #0f1d3d 0%, #060913 80%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--card-border);
      background: rgba(10, 16, 32, 0.85);
      backdrop-filter: blur(10px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .brand-group {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .logo-badge {
      background: linear-gradient(135deg, #0284c7 0%, #002b7a 100%);
      color: white;
      font-weight: 900;
      font-size: 1.15rem;
      padding: 8px 14px;
      border-radius: 10px;
      letter-spacing: 1px;
      border: 1px solid #38bdf8;
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
    }
    .brand-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #fff;
    }
    .brand-sub {
      font-size: 0.75rem;
      color: var(--cyan);
      font-family: var(--font-mono);
    }
    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
    }
    .btn-primary:hover { filter: brightness(1.15); transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      color: var(--text-main);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
    .btn-green {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #fff;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    }
    .btn-green:hover { filter: brightness(1.15); }

    main {
      flex: 1;
      padding: 2rem;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1.25rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 0.75rem;
    }
    .card-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-pill {
      font-size: 0.7rem;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .pill-green { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); }
    .pill-amber { background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); }

    .kv-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.82rem;
    }
    .kv-item {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
      padding-bottom: 4px;
    }
    .kv-item span:first-child { color: var(--text-muted); }
    .kv-item span:last-child { font-weight: 700; font-family: var(--font-mono); }

    .tabs-bar {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 6px;
      flex-wrap: wrap;
    }
    .tab-btn {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn.active {
      background: rgba(2, 132, 199, 0.25);
      border-color: #38bdf8;
      color: #38bdf8;
    }

    .table-container {
      overflow-x: auto;
      max-height: 400px;
      border-radius: 10px;
      border: 1px solid var(--card-border);
      background: #030712;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      text-align: left;
    }
    th {
      position: sticky;
      top: 0;
      background: #0f172a;
      padding: 10px 14px;
      border-bottom: 1px solid var(--card-border);
      color: var(--cyan);
      font-family: var(--font-mono);
    }
    td {
      padding: 8px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    tr:hover td { background: rgba(56, 189, 248, 0.05); }

    .search-box {
      width: 100%;
      padding: 0.6rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: #fff;
      font-size: 0.85rem;
      outline: none;
      margin-bottom: 0.75rem;
    }
    .search-box:focus { border-color: var(--cyan); }

    pre {
      background: #030712;
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 1rem;
      color: #38bdf8;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      overflow-x: auto;
      max-height: 400px;
    }

    footer {
      padding: 1.5rem;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.78rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>

  <!-- CABECERA -->
  <header>
    <div class="brand-group">
      <div class="logo-badge">SIGNUM</div>
      <div>
        <div class="brand-title">RAÍZ DEL SERVIDOR PROFIT PLUS 2K8</div>
        <div class="brand-sub">SQL SERVER [GRUMOTOR] • MICRO-SERVICIO PUENTE PUERTO 3005</div>
      </div>
    </div>

    <div class="header-actions">
      <a href="http://localhost:5175/" target="_blank" class="btn btn-primary">
        🚀 Abrir Aplicación Web (localhost:5175)
      </a>
      <button onclick="triggerSyncNow()" id="btn-sync" class="btn btn-green">
        ⚡ Sincronizar Ahora
      </button>
    </div>
  </header>

  <main>
    <!-- GRID DE ESTADO DE LOS 3 SERVICIOS -->
    <div class="grid-3">
      <!-- Tarjeta 1: SQL Server Profit -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 SQL Server (Profit Plus)</div>
          <span id="badge-db" class="status-pill pill-amber">VERIFICANDO...</span>
        </div>
        <div class="kv-list">
          <div class="kv-item"><span>Host / Servidor:</span><span style="color:var(--cyan);">${config.sql.server}</span></div>
          <div class="kv-item"><span>Puerto TCP:</span><span>${config.sql.port}</span></div>
          <div class="kv-item"><span>Base de Datos:</span><span>${config.sql.database}</span></div>
          <div class="kv-item"><span>Usuario SQL:</span><span>${config.sql.user}</span></div>
          <div class="kv-item"><span>Red Enlace:</span><span>Radmin VPN</span></div>
        </div>
      </div>

      <!-- Tarjeta 2: Micro-API Local (Puerto 3005) -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🖥️ Micro-API Puente Local</div>
          <span class="status-pill pill-green">ONLINE (ACTIVO)</span>
        </div>
        <div class="kv-list">
          <div class="kv-item"><span>URL Raíz:</span><span>http://localhost:3005/</span></div>
          <div class="kv-item"><span>Puerto Local:</span><span>3005</span></div>
          <div class="kv-item"><span>Estado:</span><span style="color:var(--green);">ESCUCHANDO</span></div>
          <div class="kv-item"><span>Auto-Sync Profit:</span><span style="color:var(--cyan); font-weight:700;">⚡ Continuo (30s)</span></div>
          <div class="kv-item"><span>Última Sincronización:</span><span id="sync-time">${syncTimeFormatted}</span></div>
        </div>
      </div>

      <!-- Tarjeta 3: Supabase Local DB_SIGNUM_MOTORVEN -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚡ Base Local SIGNUM MOTORVEN</div>
          <span class="status-pill pill-green">LOCAL STANDALONE (ACTIVO)</span>
        </div>
        <div class="kv-list">
          <div class="kv-item"><span>Instancia Supabase:</span><span>Local Standalone (Puerto 54321)</span></div>
          <div class="kv-item"><span>Motor de Base de Datos:</span><span style="color:var(--green); font-weight:800;">⚡ 48 TABLAS LOCALES (0 Cuotas)</span></div>
          <div class="kv-item"><span>Permisos:</span><span style="color:var(--green);">LECTURA, ESCRITURA, BORRAR, EDITAR (100% CRUD)</span></div>
          <div class="kv-item"><span>Artículos:</span><span id="stat-articles" style="color:var(--cyan);">${articlesCount}</span></div>
          <div class="kv-item"><span>Clientes:</span><span id="stat-clients" style="color:var(--green);">${clientsCount}</span></div>
          <div class="kv-item"><span>Pedidos:</span><span id="stat-orders" style="color:var(--amber);">${ordersCount}</span></div>
        </div>
      </div>

      <!-- Tarjeta 4: Supabase Storage signum-media -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🗂️ Storage: signum-media</div>
          <span class="status-pill pill-green">ACTIVO (20MB)</span>
        </div>
        <div class="kv-list">
          <div class="kv-item"><span>Bucket Oficial:</span><span style="color:var(--cyan);">signum-media</span></div>
          <div class="kv-item"><span>Acceso:</span><span style="color:var(--green);">PÚBLICO • FULL CRUD</span></div>
          <div class="kv-item"><span>Carpetas (7):</span><span>usuarios, productos, clientes...</span></div>
          <div class="kv-item"><span>Límite Archivo:</span><span>20 MB / archivo</span></div>
          <div class="kv-item"><span>Formatos:</span><span>JPG, PNG, WEBP, PDF, SVG</span></div>
        </div>
      </div>
    </div>

    <!-- EXPLORADOR INTERACTIVO CON PESTAÑAS -->
    <div class="card" style="flex:1;">
      <div class="tabs-bar">
        <button class="tab-btn active" id="btn-tab-database" onclick="switchTab('database-tab', this)">🗄️ Base de Datos DB_SIGNUM_MOTORVEN (Supabase)</button>
        <button class="tab-btn" id="btn-tab-products" onclick="switchTab('products-tab', this)">🛢️ Artículos & Stock (/products)</button>
        <button class="tab-btn" id="btn-tab-clients" onclick="switchTab('clients-tab', this)">👥 Clientes & Cartera (/clients)</button>
        <button class="tab-btn" id="btn-tab-status" onclick="switchTab('json-status', this)">📡 Estado Servidor (/status)</button>
        <button class="tab-btn" id="btn-tab-raw" onclick="switchTab('json-raw', this)">💻 Consola JSON en Crudo</button>
      </div>

      <!-- TAB 1: ESTADO DEL SERVIDOR -->
      <div id="tab-json-status" class="tab-content" style="display:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <span style="font-size:0.85rem; color:var(--text-muted);">Diagnóstico en tiempo real devuelto por <code>/api/profit/status</code></span>
          <button onclick="loadStatusData()" class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem;">🔄 Refrescar</button>
        </div>
        <pre id="pre-status">Cargando diagnóstico del servidor...</pre>
      </div>

      <!-- TAB DATABASE: BASE DE DATOS DB_SIGNUM_MOTORVEN -->
      <div id="tab-database-tab" class="tab-content" style="display:block;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-size:0.95rem; font-weight:800; color:#fff;">Explorador de Tablas: DB_SIGNUM_MOTORVEN (Supabase Cloud)</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              Consulta directa en vivo de cualquier tabla en Supabase • Permisos: <span style="color:var(--green); font-weight:700;">LECTURA, ESCRITURA, BORRAR, EDITAR (100% CRUD)</span>
            </div>
          </div>
          <button onclick="loadDatabaseMeta()" class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem;">🔄 Refrescar Catálogo</button>
        </div>

        <!-- SELECTOR DE TABLAS EN VIVO DE SUPABASE -->
        <div style="background:rgba(255, 255, 255, 0.03); border:1px solid var(--card-border); border-radius:10px; padding:1rem; margin-bottom:1.25rem;">
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:0.75rem;">
            <label style="font-size:0.85rem; font-weight:700; color:#fff;">Seleccionar Tabla de Supabase:</label>
            <select id="select-live-table" onchange="loadLiveTableData()" style="background:#030712; color:#38bdf8; border:1px solid var(--card-border); padding:8px 14px; border-radius:8px; font-weight:700; font-size:0.82rem; outline:none; flex:1; min-width:280px;">
              <option value="products">🛢️ products (Lubricantes OILSTONE ® - 43 artículos)</option>
              <option value="clients">👥 clients (Cartera de Clientes - 619 clientes)</option>
              <option value="profit_invoices">🧾 profit_invoices (Facturas Emitidas Profit - 240 facturas)</option>
              <option value="profit_collections">💰 profit_collections (Cobros y Recibos - 268 cobros)</option>
              <option value="orders">🚚 orders (Pedidos Preventa - 18 pedidos)</option>
              <option value="profit_accounts_payable">📉 profit_accounts_payable (Cuentas por Pagar CxP - 164)</option>
              <option value="profit_supplier_payments">💳 profit_supplier_payments (Pagos a Proveedores - 161)</option>
              <option value="profit_purchases">📦 profit_purchases (Facturas de Compra - 63)</option>
              <option value="profit_bank_accounts">🏦 profit_bank_accounts (Cuentas Bancarias - 10)</option>
              <option value="profit_sellers">👔 profit_sellers (Vendedores y Asesores - 10)</option>
              <option value="profit_zones">🗺️ profit_zones (Zonas de Venta - 7)</option>
              <option value="profit_suppliers">🏢 profit_suppliers (Proveedores - 5)</option>
              <option value="profit_audit_trails">📋 profit_audit_trails (Auditoría Profit - 709)</option>
              <option value="profit_payment_orders">📑 profit_payment_orders (Órdenes de Pago - 1370)</option>
              <option value="users">👤 users (Usuarios del Sistema - 10)</option>
            </select>
            <button onclick="loadLiveTableData()" class="btn btn-primary" style="padding:6px 14px; font-size:0.8rem;">
              🔍 Consultar Tabla
            </button>
            <span id="live-table-badge" class="status-pill pill-green" style="display:none;"></span>
          </div>

          <!-- CONTENEDOR DE DATOS EN VIVO DE LA TABLA -->
          <div class="table-container" style="max-height:360px;">
            <table id="table-live-data">
              <thead id="thead-live-data">
                <tr><th>Cargando...</th></tr>
              </thead>
              <tbody id="tbody-live-data">
                <tr><td style="text-align:center; padding:1.5rem; color:var(--text-muted);">Seleccione una tabla para visualizar todos sus registros almacenados en Supabase.</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style="font-size:0.85rem; font-weight:800; color:var(--cyan); margin-bottom:0.5rem;">
          Catálogo Oficial de las 21 Tablas Sincronizadas:
        </div>
        <div class="table-container" style="max-height:280px;">
          <table>
            <thead>
              <tr>
                <th>Tabla Supabase</th>
                <th>Origen Profit Plus 2K8</th>
                <th>Descripción y Contenido</th>
                <th>Permisos Concedidos</th>
                <th style="text-align:right;">Estado Sincronización</th>
              </tr>
            </thead>
            <tbody id="tbody-database-tables">
              <tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--cyan);">Cargando catálogo oficial de tablas...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: ARTÍCULOS EN VIVO -->
      <div id="tab-products-tab" class="tab-content" style="display:none;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap;">
          <input type="text" id="search-products" class="search-box" style="margin-bottom:0; flex:1; min-width:250px;" placeholder="Buscar por código, descripción, viscosidad..." oninput="filterProducts()">
          <div style="display:flex; align-items:center; gap:8px;">
            <button onclick="loadProductsData()" class="btn btn-secondary" style="padding:6px 12px; font-size:0.78rem;">🔄 Consultar Artículos</button>
            <span id="products-badge" class="status-pill pill-green" style="display:none;"></span>
          </div>
        </div>
        <div class="table-container">
          <table id="table-products">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción Lubricante</th>
                <th>Categoría</th>
                <th>Viscosidad</th>
                <th style="text-align:right;">Stock</th>
                <th style="text-align:right;">Precio Detal</th>
                <th style="text-align:right;">Precio Mayor</th>
              </tr>
            </thead>
            <tbody id="tbody-products">
              <tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Cargando catálogo oficial de artículos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 3: CLIENTES EN VIVO -->
      <div id="tab-clients-tab" class="tab-content" style="display:none;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap;">
          <input type="text" id="search-clients" class="search-box" style="margin-bottom:0; flex:1; min-width:250px;" placeholder="Buscar por código, nombre, RIF..." oninput="filterClients()">
          <div style="display:flex; align-items:center; gap:8px;">
            <button onclick="loadClientsData()" class="btn btn-secondary" style="padding:6px 12px; font-size:0.78rem;">🔄 Consultar Clientes</button>
            <span id="clients-badge" class="status-pill pill-green" style="display:none;"></span>
          </div>
        </div>
        <div class="table-container">
          <table id="table-clients">
            <thead>
              <tr>
                <th>Código</th>
                <th>Razón Social / Cliente</th>
                <th>RIF</th>
                <th>Tipo</th>
                <th>Ciudad</th>
                <th style="text-align:right;">Límite Crédito</th>
                <th style="text-align:right;">Saldo Deudor</th>
              </tr>
            </thead>
            <tbody id="tbody-clients">
              <tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Haga clic en 'Consultar Clientes' para consultar la cartera de clientes de Profit Plus.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 4: CONSOLA RAW -->
      <div id="tab-json-raw" class="tab-content" style="display:none;">
        <div style="display:flex; gap:8px; margin-bottom:0.75rem;">
          <select id="select-endpoint" style="background:#030712; color:#fff; border:1px solid var(--card-border); padding:6px 12px; border-radius:6px; font-family:var(--font-mono); font-size:0.8rem;">
            <option value="/api/profit/status">GET /api/profit/status (Diagnóstico Servidor)</option>
            <option value="/api/profit/database">GET /api/profit/database (Metadatos DB_SIGNUM_MOTORVEN & Permisos)</option>
            <option value="/api/profit/tables">GET /api/profit/tables (Catálogo de 20 Tablas Sincronizadas)</option>
            <option value="/api/profit/products">GET /api/profit/products (Artículos Profit)</option>
            <option value="/api/profit/clients">GET /api/profit/clients (Clientes Profit)</option>
          </select>
          <button onclick="executeRawQuery()" class="btn btn-primary" style="padding:4px 12px; font-size:0.78rem;">Ejecutar GET</button>
          <button onclick="copyRawJson()" class="btn btn-secondary" style="padding:4px 12px; font-size:0.78rem;">📋 Copiar JSON</button>
        </div>
        <pre id="pre-raw">Seleccione un endpoint y pulse 'Ejecutar GET' para inspeccionar la respuesta JSON completa.</pre>
      </div>

    </div>
  </main>

  <footer>
    SIGNUM MOTORVEN, C.A. • RIF J-30401927-4 • Marca Oficial OILSTONE ® • Conector Oficial Profit Plus 2K8
  </footer>

  <script>
    let productsList = [];
    let clientsList = [];
    let tablesList = [];

    async function loadDatabaseMeta() {
      const tbody = document.getElementById('tbody-database-tables');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#38bdf8;">Consultando catálogo oficial de tablas y permisos...</td></tr>';
      try {
        const res = await fetch('/api/profit/tables');
        const json = await res.json();
        if (json.success && Array.isArray(json.tables)) {
          tablesList = json.tables;
          tbody.innerHTML = tablesList.map(t => \`
            <tr>
              <td style="font-family:var(--font-mono); color:var(--cyan); font-weight:700;">\${t.table}</td>
              <td style="font-family:var(--font-mono); color:var(--amber); font-weight:700;">\${t.profitTable}</td>
              <td>\${t.description}</td>
              <td>
                <span style="font-size:0.72rem; padding:2px 8px; border-radius:10px; background:rgba(16, 185, 129, 0.2); color:#10b981; border:1px solid rgba(16, 185, 129, 0.4); font-weight:700;">
                  TODOS: SELECT, INSERT, UPDATE, DELETE
                </span>
              </td>
              <td style="text-align:right;">
                <span style="font-size:0.72rem; color:var(--green); font-weight:700;">⚡ SINCRONIZADA</span>
              </td>
            </tr>
          \`).join('');
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#ef4444;">Error al cargar tablas: ' + err.message + '</td></tr>';
      }
    }

    async function loadStatusData() {
      try {
        const res = await fetch('/api/profit/status');
        const data = await res.json();
        document.getElementById('pre-status').textContent = JSON.stringify(data, null, 2);
        
        const badge = document.getElementById('badge-db');
        if (data.online) {
          badge.className = 'status-pill pill-green';
          badge.textContent = 'ONLINE (CONECTADO)';
        } else {
          badge.className = 'status-pill pill-amber';
          badge.textContent = 'RÉPLICA / OFFLINE';
        }

        if (data.lastSyncStats) {
          if (data.lastSyncStats.articlesSynced) document.getElementById('stat-articles').textContent = data.lastSyncStats.articlesSynced;
          if (data.lastSyncStats.clientsSynced) document.getElementById('stat-clients').textContent = data.lastSyncStats.clientsSynced;
          if (data.lastSyncStats.ordersSynced) document.getElementById('stat-orders').textContent = data.lastSyncStats.ordersSynced;
        }
        if (data.lastSyncTime) {
          document.getElementById('sync-time').textContent = new Date(data.lastSyncTime).toLocaleTimeString();
        }
      } catch (err) {
        document.getElementById('pre-status').textContent = 'Error al consultar estado: ' + err.message;
      }
    }

    async function loadProductsData() {
      const tbody = document.getElementById('tbody-products');
      const badge = document.getElementById('products-badge');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#38bdf8;">Consultando catálogo Profit / Supabase...</td></tr>';
      try {
        const res = await fetch('/api/profit/products');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          productsList = json.data;
          renderProducts(productsList);
          if (badge) {
            badge.style.display = 'inline-block';
            badge.className = 'status-pill ' + (json.origen === 'SUPABASE_CLOUD' ? 'pill-green' : 'pill-cyan');
            badge.textContent = json.origen === 'SUPABASE_CLOUD'
              ? '⚡ ' + json.data.length + ' ARTÍCULOS (SUPABASE)'
              : '⚡ ' + json.data.length + ' ARTÍCULOS (PROFIT EN VIVO)';
          }
        } else {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#f87171;">Servidor SQL no accesible. Error: ' + (json.error || 'Desconectado') + '</td></tr>';
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#f87171;">Error: ' + err.message + '</td></tr>';
      }
    }

    function renderProducts(list) {
      const tbody = document.getElementById('tbody-products');
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No se encontraron productos.</td></tr>';
        return;
      }
      tbody.innerHTML = list.slice(0, 100).map(p => \`
        <tr>
          <td style="font-family:var(--font-mono); color:var(--cyan); font-weight:700;">\${p.codigo || p.id}</td>
          <td style="font-weight:700;">\${p.descripcion}</td>
          <td>\${p.categoria || 'Lubricantes'}</td>
          <td>\${p.viscosidad || 'N/A'}</td>
          <td style="text-align:right; font-weight:800; color:\${p.stock > 5 ? '#10b981' : '#ef4444'};">\${p.stock}</td>
          <td style="text-align:right;">$\${Number(p.precioUsdDetal || 0).toFixed(2)}</td>
          <td style="text-align:right; color:#10b981; font-weight:700;">$\${Number(p.precioUsdMayor || 0).toFixed(2)}</td>
        </tr>
      \`).join('');
    }

    function filterProducts() {
      const q = document.getElementById('search-products').value.toLowerCase();
      const filtered = productsList.filter(p => 
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
        (p.viscosidad && p.viscosidad.toLowerCase().includes(q))
      );
      renderProducts(filtered);
    }

    async function loadClientsData() {
      const tbody = document.getElementById('tbody-clients');
      const badge = document.getElementById('clients-badge');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#38bdf8;">Consultando cartera de clientes...</td></tr>';
      try {
        const res = await fetch('/api/profit/clients');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          clientsList = json.data;
          renderClients(clientsList);
          if (badge) {
            badge.style.display = 'inline-block';
            badge.className = 'status-pill ' + (json.origen === 'SUPABASE_CLOUD' ? 'pill-green' : 'pill-cyan');
            badge.textContent = json.origen === 'SUPABASE_CLOUD'
              ? '⚡ ' + json.data.length + ' CLIENTES (SUPABASE)'
              : '⚡ ' + json.data.length + ' CLIENTES (PROFIT EN VIVO)';
          }
        } else {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#f87171;">Servidor SQL no accesible. Error: ' + (json.error || 'Desconectado') + '</td></tr>';
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#f87171;">Error: ' + err.message + '</td></tr>';
      }
    }

    function renderClients(list) {
      const tbody = document.getElementById('tbody-clients');
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No se encontraron clientes.</td></tr>';
        return;
      }
      tbody.innerHTML = list.slice(0, 100).map(c => \`
        <tr>
          <td style="font-family:var(--font-mono); color:var(--cyan); font-weight:700;">\${c.codigo || c.id}</td>
          <td style="font-weight:700;">\${c.nombre}</td>
          <td style="font-family:var(--font-mono);">\${c.rif}</td>
          <td>\${c.tipoCliente || 'Mayorista'}</td>
          <td>\${c.ciudad || 'N/A'}</td>
          <td style="text-align:right;">$\${Number(c.limiteCreditoUsd || 0).toFixed(2)}</td>
          <td style="text-align:right; font-weight:800; color:\${c.saldoDeudorUsd > 0 ? '#ef4444' : '#10b981'};">$\${Number(c.saldoDeudorUsd || 0).toFixed(2)}</td>
        </tr>
      \`).join('');
    }

    function filterClients() {
      const q = document.getElementById('search-clients').value.toLowerCase();
      const filtered = clientsList.filter(c => 
        (c.codigo && c.codigo.toLowerCase().includes(q)) ||
        (c.nombre && c.nombre.toLowerCase().includes(q)) ||
        (c.rif && c.rif.toLowerCase().includes(q))
      );
      renderClients(filtered);
    }

    async function executeRawQuery() {
      const endpoint = document.getElementById('select-endpoint').value;
      const pre = document.getElementById('pre-raw');
      pre.textContent = 'Consultando ' + endpoint + '...';
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        pre.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        pre.textContent = 'Error: ' + err.message;
      }
    }

    function copyRawJson() {
      const text = document.getElementById('pre-raw').textContent;
      navigator.clipboard.writeText(text);
      alert('¡JSON copiado al portapapeles!');
    }

    async function triggerSyncNow() {
      const btn = document.getElementById('btn-sync');
      btn.textContent = '⏳ Sincronizando...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/profit/sync', { method: 'POST' });
        const data = await res.json();
        alert(data.success ? '¡Sincronización completada con éxito!' : 'Aviso: ' + (data.error || 'Error'));
        loadStatusData();
      } catch (err) {
        alert('Error al ejecutar sincronización: ' + err.message);
      } finally {
        btn.textContent = '⚡ Sincronizar Ahora';
        btn.disabled = false;
      }
    }

    function switchTab(tabId, el) {
      document.querySelectorAll('.tab-content').forEach(e => e.style.display = 'none');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const target = document.getElementById('tab-' + tabId);
      if (target) target.style.display = 'block';
      const targetBtn = el || (window.event && window.event.target ? window.event.target : document.getElementById('btn-tab-' + tabId.replace('-tab', '')));
      if (targetBtn && targetBtn.classList) targetBtn.classList.add('active');
      if (tabId === 'database-tab' && tablesList.length === 0) {
        loadDatabaseMeta();
      }
    }

    async function loadLiveTableData() {
      const select = document.getElementById('select-live-table');
      if (!select) return;
      const tableName = select.value;
      const thead = document.getElementById('thead-live-data');
      const tbody = document.getElementById('tbody-live-data');
      const badge = document.getElementById('live-table-badge');
      
      thead.innerHTML = '<tr><th>Cargando columnas...</th></tr>';
      tbody.innerHTML = '<tr><td style="text-align:center; padding:1.5rem; color:#38bdf8;">Consultando registros de ' + tableName + ' en Supabase Cloud...</td></tr>';
      badge.style.display = 'none';

      try {
        const res = await fetch('/api/profit/table-data?name=' + tableName + '&limit=100');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const keys = Object.keys(json.data[0]);
          thead.innerHTML = '<tr>' + keys.map(k => '<th>' + k + '</th>').join('') + '</tr>';
          tbody.innerHTML = json.data.map(row => {
            return '<tr>' + keys.map(k => {
              const val = row[k];
              const displayVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val !== undefined && val !== null ? val : '');
              return '<td>' + (displayVal.length > 80 ? displayVal.substring(0, 80) + '...' : displayVal) + '</td>';
            }).join('') + '</tr>';
          }).join('');

          badge.style.display = 'inline-block';
          badge.className = 'status-pill pill-green';
          badge.textContent = '⚡ ' + json.data.length + ' de ' + (json.total || json.data.length) + ' FILAS EN SUPABASE';
        } else {
          thead.innerHTML = '<tr><th>Resultado</th></tr>';
          tbody.innerHTML = '<tr><td style="text-align:center; padding:1.5rem; color:var(--text-muted);">' + (json.error ? 'Error: ' + json.error : 'La tabla ' + tableName + ' no tiene registros.') + '</td></tr>';
          badge.style.display = 'inline-block';
          badge.className = 'status-pill pill-amber';
          badge.textContent = '0 REGISTROS';
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td style="text-align:center; padding:1.5rem; color:#ef4444;">Error al consultar: ' + err.message + '</td></tr>';
      }
    }

    // Cargar estado inicial y todas las tablas de Supabase en paralelo
    loadStatusData();
    loadDatabaseMeta();
    loadLiveTableData();
    loadProductsData();
    loadClientsData();
  </script>
</body>
</html>
`;
}
