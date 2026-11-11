/**
 * SERVICIO PERMANENTE 24/7 - SERVIDOR EMPRESA SIGNUM MOTORVEN
 * Mantiene activo el servidor de base de datos central (puerto 54321) y el túnel
 * oficial fijo https://api.signummotorven.com con reconexión automática 24/7.
 */
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import https from 'https';
import http from 'http';
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

const PORT = Number(process.env.SUPABASE_LOCAL_PORT || 54321);
const OFFICIAL_BACKEND_URL = 'https://api.signummotorven.com';
const OFFICIAL_TUNNEL_TOKEN = 'eyJhIjoiMTg5ODZkNGMxYjI3YmZmZmI3ZWVhMGE1N2UwZTc4ZGEiLCJ0IjoiZTJkZWEyNDQtODNjYi00MzI1LTljYzAtZWUzNDc4NzE0YTc2IiwicyI6Ik1HTTNNamMzTm1RdFkyVmtNQzAwTWpOaUxUbGhNREl0WldRME5EWXpNalUyTURSaCJ9';

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

function startOfficialPersistentTunnel() {
  console.log(`🌐 [2/2] Conectando Túnel Oficial Permanente (${OFFICIAL_BACKEND_URL})...`);

  saveLocalBackendUrlFiles();

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
  killStaleTryCloudflareTunnels();
  await ensureLocalDatabase({ initial: true });
  startOfficialPersistentTunnel();
}

main().catch(err => {
  console.error('Error fatal iniciando servicios:', err);
});
