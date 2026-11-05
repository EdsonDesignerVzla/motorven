/**
 * SERVICIO PERMANENTE 24/7 - SERVIDOR EMPRESA SIGNUM MOTORVEN
 * Mantiene activo el servidor de base de datos local (puerto 54321) y el túnel
 * Cloudflare con auto-publicación en GitHub Pages y reconexión automática 24/7.
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
  path.join(projectRoot, 'scripts/tunnel/cloudflared.exe'),
  path.join(projectRoot, 'SERVIDOR_EMPRESA_26.229.220.202/cloudflared.exe')
];

const PORT = Number(process.env.SUPABASE_LOCAL_PORT || 54321);
let activeTunnelUrl = null;
let currentCfProcess = null;
let consecutiveHealthFailures = 0;

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
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

async function ensureLocalDatabase() {
  const open = await isPortOpen(PORT);
  if (!open) {
    console.log(`⚡ [1/2] Iniciando Servidor de Base de Datos Local en puerto ${PORT}...`);
    const srv = spawn(process.execPath, [serverScriptPath], {
      cwd: path.dirname(serverScriptPath),
      stdio: 'ignore',
      detached: true,
      windowsHide: true
    });
    srv.unref();
    await new Promise(r => setTimeout(r, 2500));
    console.log('✅ Base de datos local inicializada.');
  } else {
    console.log(`✅ [1/2] Base de datos local activa en puerto ${PORT}.`);
  }
}

function resolveGithubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const cfgPaths = [
    path.join(__dirname, '.tunnel_config.json'),
    path.join(projectRoot, '.tunnel_config.json')
  ];
  for (const p of cfgPaths) {
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').trim();
        const raw = JSON.parse(text);
        if (raw?.githubToken) return String(raw.githubToken).trim();
        if (raw?.tokenB64) return Buffer.from(String(raw.tokenB64), 'base64').toString('utf8').trim();
      } catch (_) {}
    }
  }
  try {
    const out = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true
    });
    const m = out.match(/password=([^\r\n]+)/);
    if (m && m[1]) return m[1].trim();
  } catch (_) {}
  return null;
}

function githubApiRequest(method, apiPath, token, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = https.request({
      hostname: 'api.github.com',
      port: 443,
      path: apiPath,
      method,
      headers: {
        'User-Agent': 'Signum-Motorven-Server-Daemon',
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(bodyStr ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        } : {})
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (_) {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('GitHub API request timeout'));
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function publishBackendUrlToGithub(urlPayloadStr, tunnelUrl) {
  const token = resolveGithubToken();
  if (!token) {
    console.warn('⚠️  Sin token GitHub para auto-publicar backend_url.json.');
    return;
  }

  const contentB64 = Buffer.from(urlPayloadStr, 'utf8').toString('base64');
  const targets = [
    { repo: 'EdsonDesignerVzla/motorven', filePath: 'backend_url.json' },
    { repo: 'EdsonDesignerVzla/motorvenarreglo', filePath: 'public/backend_url.json' },
    { repo: 'EdsonDesignerVzla/motorvenarreglo', filePath: 'dist/backend_url.json' }
  ];

  for (const t of targets) {
    try {
      const apiPath = `/repos/${t.repo}/contents/${t.filePath}`;
      const existing = await githubApiRequest('GET', apiPath, token);
      const sha = existing?.data?.sha || undefined;
      const putRes = await githubApiRequest('PUT', apiPath, token, {
        message: `Auto-sync URL servidor empresa: ${tunnelUrl}`,
        content: contentB64,
        ...(sha ? { sha } : {})
      });
      if (putRes.status >= 200 && putRes.status < 300) {
        console.log(`☁️  [GitHub Auto-Sync] Actualizado ${t.repo}/${t.filePath} -> ${tunnelUrl}`);
      }
    } catch (err) {
      console.warn(`⚠️  Error auto-publicando en ${t.repo}/${t.filePath}:`, err.message);
    }
  }
}

function saveLocalBackendUrlFiles(url) {
  const payloadObj = {
    url,
    lanUrls: [
      `http://192.168.0.6:${PORT}`,
      `http://26.45.7.149:${PORT}`,
      `http://192.168.0.5:${PORT}`,
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

function startPersistentTunnel() {
  console.log(`🌐 [2/2] Iniciando túnel de alta velocidad con Cloudflare...`);

  const foundBin = cloudflaredCandidates.find(p => fs.existsSync(p)) || 'cloudflared';

  const cf = spawn(foundBin, ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  currentCfProcess = cf;

  let hasAnnounced = false;

  const onData = (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !hasAnnounced) {
      hasAnnounced = true;
      const url = match[0];
      activeTunnelUrl = url;
      consecutiveHealthFailures = 0;

      const urlPayload = saveLocalBackendUrlFiles(url);
      publishBackendUrlToGithub(urlPayload, url).catch(() => {});

      console.log('\n============================================================');
      console.log('🎉 ¡SERVIDOR DE LA EMPRESA CONECTADO EN TIEMPO REAL!');
      console.log(`🌐 URL Pública Cloudflare:  ${url}`);
      console.log(`📊 Base de Datos Local:    http://localhost:${PORT}`);
      console.log('⚡ Compresión GZIP:        Activa');
      console.log('☁️  Auto-Discovery GitHub:  Activo (sin escribir ?server=)');
      console.log('============================================================');
      console.log(`📲 Enlace directo para los 35 dispositivos:`);
      console.log(`   https://edsondesignervzla.github.io/motorven/`);
      console.log('============================================================\n');
    }
  };

  cf.stdout.on('data', onData);
  cf.stderr.on('data', onData);

  cf.on('close', (code) => {
    if (currentCfProcess === cf) currentCfProcess = null;
    activeTunnelUrl = null;
    console.warn(`⚠️  Túnel desconectado (código ${code}). Reconectando automáticamente en 3 segundos...`);
    setTimeout(startPersistentTunnel, 3000);
  });

  cf.on('error', (err) => {
    console.error(`❌ Error en el proceso del túnel: ${err.message}. Reintentando en 5 segundos...`);
    setTimeout(startPersistentTunnel, 5000);
  });
}

// Watchdog cada 20s: garantiza que server.js esté vivo en puerto 54321 y el túnel responda /health
setInterval(async () => {
  try {
    await ensureLocalDatabase();
    if (activeTunnelUrl && currentCfProcess) {
      const ok = await checkUrlHealth(activeTunnelUrl);
      if (!ok) {
        consecutiveHealthFailures += 1;
        console.warn(`⚠️  Health check del túnel falló (${consecutiveHealthFailures}/3): ${activeTunnelUrl}`);
        if (consecutiveHealthFailures >= 3) {
          consecutiveHealthFailures = 0;
          console.warn('🔄 Reiniciando túnel Cloudflare para obtener conexión limpia...');
          try {
            currentCfProcess.kill();
          } catch (_) {}
        }
      } else {
        consecutiveHealthFailures = 0;
      }
    }
  } catch (_) {}
}, 20000);

async function main() {
  console.log('============================================================');
  console.log('🚀 INICIANDO SERVICIOS 24/7 DE SIGNUM MOTORVEN EN SERVIDOR');
  console.log('============================================================\n');
  await ensureLocalDatabase();
  startPersistentTunnel();
}

main().catch(err => {
  console.error('Error fatal iniciando servicios:', err);
});
