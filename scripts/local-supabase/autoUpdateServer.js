/**
 * AUTO-ACTUALIZADOR SEGURO DE server.js - SIGNUM MOTORVEN
 * Garantiza que en cada reinicio del servidor central (p. ej. tras un apagón)
 * siempre se ejecute la versión más reciente de server.js desde GitHub sin tocar
 * jamás la base de datos local (local_database.json).
 *
 * Orden de fuentes (con fallback seguro):
 *  1. Repo Git local (`git fetch origin main` + `git show origin/main:scripts/local-supabase/server.js`) — soporta repos privados sin tocar local_database.json.
 *  2. Clone sparse temporal de solo `scripts/local-supabase/server.js` (para carpetas standalone sin `.git` usando credenciales Git de Windows).
 *  3. URL HTTPS configurable (`SIGNUM_SERVER_UPDATE_URL`) si se usa mirror/raw público.
 *
 * Seguridad:
 *  - Timeout corto (15s): si no hay internet al volver la luz, arranca de inmediato con la copia local.
 *  - Verifica tamaño mínimo, firmas esperadas y sintaxis real con `node --check` antes de reemplazar.
 *  - Guarda respaldo `server.js.prev` antes de sustituir.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SOURCE_REPO =
  process.env.SIGNUM_SOURCE_REPO_URL ||
  'https://github.com/EdsonDesignerVzla/motorvenarreglo.git';
const DEFAULT_RAW_URL = process.env.SIGNUM_SERVER_UPDATE_URL || '';
const NON_INTERACTIVE_GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'never'
};

function findGitRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function fetchViaLocalGitRepo(startDir, timeoutMs = 15000) {
  const gitRoot = findGitRoot(startDir);
  if (!gitRoot) return null;
  execFileSync('git', ['fetch', 'origin', 'main', '--depth=1'], {
    cwd: gitRoot,
    stdio: 'ignore',
    timeout: timeoutMs,
    env: NON_INTERACTIVE_GIT_ENV
  });
  return execFileSync('git', ['show', 'origin/main:scripts/local-supabase/server.js'], {
    cwd: gitRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 8000,
    env: NON_INTERACTIVE_GIT_ENV
  });
}

function fetchViaSparseGitClone(repoUrl = DEFAULT_SOURCE_REPO, timeoutMs = 20000) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signum-srv-upd-'));
  try {
    execFileSync(
      'git',
      ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--branch', 'main', repoUrl, tmpDir],
      { stdio: 'ignore', timeout: timeoutMs, env: NON_INTERACTIVE_GIT_ENV }
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

function downloadText(urlStr, timeoutMs = 12000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('Demasiadas redirecciones'));
    const req = https.get(
      urlStr,
      {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'SIGNUM-MOTORVEN-AutoUpdater/1.0',
          'Cache-Control': 'no-cache'
        }
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return downloadText(res.headers.location, timeoutMs, redirects + 1).then(resolve, reject);
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
    req.on('timeout', () => {
      req.destroy(new Error('Timeout descargando actualización'));
    });
    req.on('error', reject);
  });
}

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

export async function autoUpdateServerScript({
  targetPath = path.join(__dirname, 'server.js'),
  repoUrl = DEFAULT_SOURCE_REPO,
  rawUrl = DEFAULT_RAW_URL,
  timeoutMs = 15000
} = {}) {
  const resolvedTarget = path.resolve(targetPath);
  if (!fs.existsSync(resolvedTarget)) {
    return { updated: false, reason: 'target_missing' };
  }

  let remoteCode = null;
  let lastError = null;

  // 1. Intentar vía repo Git local (rápido, funciona con repos privados, no toca local_database.json)
  try {
    remoteCode = fetchViaLocalGitRepo(path.dirname(resolvedTarget), timeoutMs);
  } catch (err) {
    lastError = err;
  }

  // 2. Fallback para carpetas standalone sin .git: sparse clone temporal
  if (!remoteCode) {
    try {
      remoteCode = fetchViaSparseGitClone(repoUrl, timeoutMs + 5000);
    } catch (err) {
      lastError = err;
    }
  }

  // 3. Fallback HTTPS opcional si se configuró SIGNUM_SERVER_UPDATE_URL
  if (!remoteCode && rawUrl) {
    try {
      remoteCode = await downloadText(rawUrl, timeoutMs);
    } catch (err) {
      lastError = err;
    }
  }

  if (!remoteCode) {
    console.log(`ℹ️ [AutoUpdate] Sin conexión para comprobar actualización (${lastError?.message || 'offline'}); iniciando con versión local.`);
    return { updated: false, reason: 'network_error', error: lastError?.message };
  }

  if (
    remoteCode.length < 25000 ||
    !remoteCode.includes('applyServerAtomicStockDelta') ||
    !remoteCode.includes('initDatabase')
  ) {
    return { updated: false, reason: 'invalid_payload' };
  }

  const normalizeEol = (s) => String(s || '').replace(/\r\n/g, '\n');
  const currentCode = fs.readFileSync(resolvedTarget, 'utf8');
  if (sha256(normalizeEol(remoteCode)) === sha256(normalizeEol(currentCode))) {
    console.log('✅ [AutoUpdate] server.js ya está en su versión más reciente.');
    return { updated: false, reason: 'already_latest' };
  }

  const tmpPath = path.join(path.dirname(resolvedTarget), '.server_update_check.mjs');
  const prevPath = `${resolvedTarget}.prev`;
  fs.writeFileSync(tmpPath, remoteCode, 'utf8');

  try {
    execFileSync(process.execPath, ['--check', tmpPath], { stdio: 'ignore', timeout: 8000 });
  } catch (syntaxErr) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    console.warn('⚠️ [AutoUpdate] La descarga no pasó validación de sintaxis; se conserva versión local.');
    return { updated: false, reason: 'syntax_check_failed', error: syntaxErr.message };
  }

  try {
    fs.copyFileSync(resolvedTarget, prevPath);
  } catch (_) {}

  fs.renameSync(tmpPath, resolvedTarget);
  console.log('🚀 [AutoUpdate] server.js actualizado automáticamente desde GitHub (respaldo guardado en server.js.prev).');
  return { updated: true, reason: 'updated' };
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirect) {
  const customTarget = process.argv[2] || path.join(__dirname, 'server.js');
  autoUpdateServerScript({ targetPath: customTarget }).then(() => process.exit(0));
}
