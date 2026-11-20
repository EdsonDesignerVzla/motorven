/**
 * SERVICIO PERMANENTE 24/7 - SERVIDOR EMPRESA SIGNUM MOTORVEN
 * Mantiene activo el servidor de base de datos central (puerto 54321) y el túnel
 * oficial fijo https://api.signummotorven.com con reconexión automática 24/7.
 */
import { spawn, execSync, execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import net from 'net';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Soportar ejecución tanto en carpeta standalone (SERVIDOR_EMPRESA) como en repo
const isStandaloneDir = fs.existsSync(path.join(__dirname, 'server.js'));
const projectRoot = isStandaloneDir ? __dirname : path.resolve(__dirname, '../../');
const serverScriptPath = isStandaloneDir
  ? path.join(__dirname, 'server.js')
  : path.join(projectRoot, 'scripts/local-supabase/server.js');
const cloudflaredCandidates = [
  path.join(__dirname, 'cloudflared.exe'),
  path.join(projectRoot, 'SERVIDOR_EMPRESA_26.229.220.202/cloudflared.exe'),
  path.join(projectRoot, 'scripts/tunnel/cloudflared.exe'),
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe'
];

function loadLocalTunnelConfig() {
  const candidates = [
    path.join(__dirname, '.tunnel_config.json'),
    path.join(projectRoot, '.tunnel_config.json')
  ];
  for (const fp of candidates) {
    try {
      if (fs.existsSync(fp)) {
        const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_) {}
  }
  return {};
}

const tunnelConfig = loadLocalTunnelConfig();
const PORT = Number(process.env.SUPABASE_LOCAL_PORT || tunnelConfig.port || 54321);
const OFFICIAL_BACKEND_URL =
  process.env.OFFICIAL_BACKEND_URL ||
  tunnelConfig.officialUrl ||
  tunnelConfig.url ||
  'https://api.signummotorven.com';
const OFFICIAL_TUNNEL_TOKEN =
  process.env.CLOUDFLARE_TUNNEL_TOKEN ||
  tunnelConfig.CLOUDFLARE_TUNNEL_TOKEN ||
  tunnelConfig.cloudflareTunnelToken ||
  tunnelConfig.tunnelToken ||
  tunnelConfig.token ||
  '';
const SOURCE_REPO_URL =
  process.env.SIGNUM_SOURCE_REPO_URL ||
  tunnelConfig.sourceRepoUrl ||
  'https://github.com/EdsonDesignerVzla/motorvenarreglo.git';
const SERVER_AUTO_UPDATE_URL =
  process.env.SIGNUM_SERVER_UPDATE_URL ||
  tunnelConfig.serverUpdateUrl ||
  '';
const GITHUB_UPDATE_TOKEN =
  process.env.SIGNUM_GITHUB_TOKEN ||
  tunnelConfig.githubToken ||
  '';
const NON_INTERACTIVE_GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'never'
};

function downloadHttpsText(urlStr, timeoutMs = 12000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('Demasiadas redirecciones'));
    const headers = { 'User-Agent': 'SIGNUM-MOTORVEN-AutoUpdater/1.0', 'Cache-Control': 'no-cache' };
    if (GITHUB_UPDATE_TOKEN && /github/i.test(urlStr)) {
      headers.Authorization = `Bearer ${GITHUB_UPDATE_TOKEN}`;
    }
    const req = https.get(
      urlStr,
      {
        timeout: timeoutMs,
        headers
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return downloadHttpsText(res.headers.location, timeoutMs, redirects + 1).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Timeout descargando server.js')));
    req.on('error', reject);
  });
}

function fetchLatestServerCodeViaGit() {
  // 1. Si estamos dentro de un repo Git, usar git fetch + git show sin tocar local_database.json
  let dir = path.resolve(path.dirname(serverScriptPath));
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      execFileSync('git', ['fetch', 'origin', 'main', '--depth=1'], {
        cwd: dir,
        stdio: 'ignore',
        timeout: 15000,
        env: NON_INTERACTIVE_GIT_ENV
      });
      return execFileSync('git', ['show', 'origin/main:scripts/local-supabase/server.js'], {
        cwd: dir,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 8000,
        env: NON_INTERACTIVE_GIT_ENV
      });
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 2. Carpeta standalone sin .git: clone ligero solo metadatos y extraer server.js
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signum-srv-upd-'));
  try {
    execFileSync(
      'git',
      ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--branch', 'main', SOURCE_REPO_URL, tmpDir],
      { stdio: 'ignore', timeout: 20000, env: NON_INTERACTIVE_GIT_ENV }
    );
    return execFileSync('git', ['show', 'HEAD:scripts/local-supabase/server.js'], {
      cwd: tmpDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 8000,
      env: NON_INTERACTIVE_GIT_ENV
    });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function autoUpdateServerScriptBeforeBoot() {
  if (!fs.existsSync(serverScriptPath)) return { updated: false, reason: 'missing' };
  let remoteCode = null;
  let lastErr = null;
  try {
    remoteCode = fetchLatestServerCodeViaGit();
  } catch (err) {
    lastErr = err;
  }
  if (!remoteCode && SERVER_AUTO_UPDATE_URL) {
    try {
      remoteCode = await downloadHttpsText(SERVER_AUTO_UPDATE_URL, 12000);
    } catch (err) {
      lastErr = err;
    }
  }
  if (!remoteCode) {
    const isNoGit = /ENOENT/i.test(String(lastErr?.message || ''));
    if (isNoGit) {
      console.log('ℹ️  [AutoUpdate] Git no instalado en este equipo; usando server.js local (actualizado manualmente o vía githubToken).');
    } else {
      console.log(`ℹ️  [AutoUpdate] No se pudo verificar actualización al arrancar (${lastErr?.message || 'offline'}); iniciando con versión local.`);
    }
    return { updated: false, reason: isNoGit ? 'no_git' : 'network_error' };
  }
  if (
    remoteCode.length < 25000 ||
    !remoteCode.includes('applyServerAtomicStockDelta') ||
    !remoteCode.includes('initDatabase')
  ) {
    return { updated: false, reason: 'invalid_payload' };
  }
  const normalizeEol = (s) => String(s || '').replace(/\r\n/g, '\n');
  const currentCode = fs.readFileSync(serverScriptPath, 'utf8');
  const hash = (s) => crypto.createHash('sha256').update(normalizeEol(s), 'utf8').digest('hex');
  if (hash(remoteCode) === hash(currentCode)) {
    console.log('✅ [AutoUpdate] server.js ya está actualizado con la última versión de producción.');
    return { updated: false, reason: 'already_latest' };
  }
  const tmpPath = path.join(path.dirname(serverScriptPath), '.server_update_check.mjs');
  const prevPath = `${serverScriptPath}.prev`;
  fs.writeFileSync(tmpPath, remoteCode, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmpPath], { stdio: 'ignore', timeout: 8000 });
  } catch (_) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    console.warn('⚠️  [AutoUpdate] Descarga descartada por error de sintaxis; se mantiene server.js local.');
    return { updated: false, reason: 'syntax_failed' };
  }
  try { fs.copyFileSync(serverScriptPath, prevPath); } catch (_) {}
  fs.renameSync(tmpPath, serverScriptPath);
  console.log('🚀 [AutoUpdate] server.js actualizado automáticamente desde GitHub (respaldo en server.js.prev).');
  return { updated: true, reason: 'updated' };
}

let currentCfProcess = null;
let consecutiveHealthFailures = 0;
let localServerProcess = null;
let localPortClosedChecks = 0;
let tunnelRestartTimer = null;

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function spawnLocalDatabase() {
  console.log(`⚡ [1/2] Iniciando Base de Datos Central en puerto ${PORT}...`);
  const srv = spawn(process.execPath, [serverScriptPath], {
    cwd: path.dirname(serverScriptPath),
    stdio: 'inherit',
    detached: false
  });
  localServerProcess = srv;
  srv.on('error', (err) => {
    console.error('❌ Error iniciando server.js:', err.message);
  });
  srv.on('exit', (code) => {
    if (localServerProcess === srv) localServerProcess = null;
    console.warn(`⚠️  server.js finalizó (código ${code}). El watchdog lo reiniciará si el puerto queda libre.`);
  });
}

async function ensureLocalDatabase({ initial = false } = {}) {
  const open = await isPortOpen(PORT);
  if (open) {
    localPortClosedChecks = 0;
    if (initial) console.log(`✅ [1/2] Base de datos central activa en puerto ${PORT}.`);
    return;
  }
  // Nunca lanzar una segunda instancia mientras la nuestra sigue viva (p.ej. cargando 22 MB
  // desde disco): dos server.js con copias distintas en memoria provocan datos desincronizados.
  if (localServerProcess && localServerProcess.exitCode === null) return;
  localPortClosedChecks += 1;
  if (!initial && localPortClosedChecks < 2) return;
  localPortClosedChecks = 0;
  spawnLocalDatabase();
  await new Promise(r => setTimeout(r, 2500));
  console.log('✅ Base de datos central inicializada y cargada desde disco.');
}

function saveLocalBackendUrlFiles() {
  const payloadObj = {
    url: OFFICIAL_BACKEND_URL,
    lanUrls: [
      `http://192.168.0.3:${PORT}`,
      `http://26.45.7.149:${PORT}`,
      `http://26.229.220.202:${PORT}`
    ],
    updatedAt: new Date().toISOString()
  };
  const urlPayload = JSON.stringify(payloadObj, null, 2);
  const localTargets = [
    path.join(__dirname, 'backend_url.json'),
    path.join(projectRoot, 'backend_url.json'),
    path.join(projectRoot, 'dist/backend_url.json'),
    path.join(projectRoot, 'public/backend_url.json'),
    path.join(projectRoot, 'scripts/local-supabase/backend_url.json')
  ];
  for (const target of localTargets) {
    try {
      if (fs.existsSync(path.dirname(target))) {
        fs.writeFileSync(target, urlPayload, 'utf8');
      }
    } catch (_) {}
  }
  return urlPayload;
}

function checkUrlHealth(urlStr) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(`${urlStr.replace(/\/+$/, '')}/health`);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(parsed, { timeout: 8000 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch (_) {
      resolve(false);
    }
  });
}

function killStaleTryCloudflareTunnels() {
  try {
    // Detener cualquier instancia previa de cloudflared que pudiera estar corriendo con URLs temporales
    execSync('taskkill /F /IM cloudflared.exe /T', { stdio: 'ignore', windowsHide: true });
  } catch (_) {}
}

async function startOfficialPersistentTunnel() {
  saveLocalBackendUrlFiles();
  const alreadyOnline = await checkUrlHealth(OFFICIAL_BACKEND_URL);
  if (alreadyOnline) {
    console.log(`✅ [2/2] Túnel Oficial ya activo vía Servicio de Windows (${OFFICIAL_BACKEND_URL}).`);
    return;
  }
  if (!OFFICIAL_TUNNEL_TOKEN) {
    console.log(`ℹ️  [2/2] Sin CLOUDFLARE_TUNNEL_TOKEN en entorno/.tunnel_config.json; esperando servicio de Windows de Cloudflare para ${OFFICIAL_BACKEND_URL}.`);
    return;
  }
  killStaleTryCloudflareTunnels();
  console.log(`🌐 [2/2] Conectando Túnel Oficial Permanente (${OFFICIAL_BACKEND_URL})...`);

  const foundBin = cloudflaredCandidates.find(p => fs.existsSync(p)) || 'cloudflared';

  const cf = spawn(foundBin, ['tunnel', 'run', '--token', OFFICIAL_TUNNEL_TOKEN], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  currentCfProcess = cf;

  let hasAnnounced = false;

  const onData = (chunk) => {
    const text = chunk.toString();
    if ((text.includes('Registered tunnel connection') || text.includes('Connection') || text.includes('Updated to new configuration')) && !hasAnnounced) {
      hasAnnounced = true;
      consecutiveHealthFailures = 0;
      console.log('\n============================================================');
      console.log('🎉 ¡SERVIDOR CENTRAL CONECTADO EN TIEMPO REAL 24/7!');
      console.log(`🌐 Dominio Oficial Web:     https://signummotorven.com`);
      console.log(`🔒 Túnel Oficial API SSL:   ${OFFICIAL_BACKEND_URL}`);
      console.log(`📊 Base de Datos Central:   http://localhost:${PORT}`);
      console.log('💾 Persistencia en Disco:   Activa (a prueba de apagones)');
      console.log('============================================================\n');
    }
  };

  cf.stdout.on('data', onData);
  cf.stderr.on('data', onData);

  cf.on('close', (code) => {
    if (currentCfProcess === cf) currentCfProcess = null;
    console.warn(`⚠️  Túnel oficial desconectado (código ${code}). Reconectando en 3 segundos...`);
    scheduleTunnelRestart(3000);
  });

  cf.on('error', (err) => {
    if (currentCfProcess === cf) currentCfProcess = null;
    console.error(`❌ Error en cloudflared: ${err.message}. Reintentando en 5 segundos...`);
    scheduleTunnelRestart(5000);
  });
}

// Un solo reinicio programado a la vez: 'error' y 'close' pueden dispararse ambos para el
// mismo proceso y antes se lanzaban DOS conectores cloudflared en paralelo con el mismo token.
function scheduleTunnelRestart(delayMs) {
  if (tunnelRestartTimer) return;
  tunnelRestartTimer = setTimeout(() => {
    tunnelRestartTimer = null;
    if (currentCfProcess) return;
    startOfficialPersistentTunnel();
  }, delayMs);
}

// Watchdog cada 20s: garantiza que server.js esté vivo en puerto 54321 y el túnel oficial responda /health
let watchdogRunning = false;
setInterval(async () => {
  if (watchdogRunning) return;
  watchdogRunning = true;
  try {
    await ensureLocalDatabase();
    if (currentCfProcess) {
      const ok = await checkUrlHealth(OFFICIAL_BACKEND_URL);
      if (!ok) {
        // Si el origen local tampoco responde, el problema NO es el túnel: reiniciar cloudflared
        // sólo cortaría a todos los equipos conectados sin resolver nada.
        const localOk = await checkUrlHealth(`http://127.0.0.1:${PORT}`);
        if (!localOk) {
          console.warn('⚠️  El servidor local no respondió /health a tiempo; se conserva el túnel activo.');
          consecutiveHealthFailures = 0;
          return;
        }
        consecutiveHealthFailures += 1;
        console.warn(`⚠️  Verificando enlace del túnel (${consecutiveHealthFailures}/4): ${OFFICIAL_BACKEND_URL}`);
        if (consecutiveHealthFailures >= 4) {
          consecutiveHealthFailures = 0;
          console.warn('🔄 Reiniciando conector de Cloudflare para restablecer enlace limpio...');
          try {
            currentCfProcess.kill();
          } catch (_) {}
        }
      } else {
        consecutiveHealthFailures = 0;
      }
    }
  } catch (_) {
  } finally {
    watchdogRunning = false;
  }
}, 20000);

async function main() {
  console.log('============================================================');
  console.log('🚀 INICIANDO SERVIDOR CENTRAL 24/7 - SIGNUM MOTORVEN');
  console.log('============================================================\n');
  const bootUpdate = await autoUpdateServerScriptBeforeBoot();
  await ensureLocalDatabase({ initial: true });
  await startOfficialPersistentTunnel();

  // Si al volver la luz aún no había internet (router reiniciando), reintentar auto-actualización
  // a los 60s y aplicar reinicio limpio automático si llegó un server.js más reciente.
  if (bootUpdate.reason === 'network_error') {
    setTimeout(async () => {
      const lateUpdate = await autoUpdateServerScriptBeforeBoot();
      if (lateUpdate.updated && localServerProcess && localServerProcess.exitCode === null) {
        console.log('🔄 [AutoUpdate] Reiniciando server.js de forma limpia para activar la nueva versión...');
        try {
          localServerProcess.kill();
        } catch (_) {}
      }
    }, 60000);
  }
}

main().catch(err => {
  console.error('Error fatal iniciando servicios:', err);
});
