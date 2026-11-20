/**
 * AUTO-ACTUALIZADOR SEGURO DE server.js - SIGNUM MOTORVEN
 * Garantiza que en cada reinicio del servidor central (p. ej. tras un apagón)
 * siempre se ejecute la versión más reciente de server.js desde GitHub sin tocar
 * jamás la base de datos local (local_database.json).
 *
 * Seguridad:
 *  - Timeout corto (12s): si no hay internet al volver la luz, arranca de inmediato con la copia local.
 *  - Verifica tamaño mínimo, firmas esperadas y sintaxis real con `node --check` antes de reemplazar.
 *  - Guarda respaldo `server.js.prev` antes de sustituir.
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_RAW_URL =
  process.env.SIGNUM_SERVER_UPDATE_URL ||
  'https://raw.githubusercontent.com/EdsonDesignerVzla/motorvenarreglo/main/scripts/local-supabase/server.js';

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
  rawUrl = DEFAULT_RAW_URL,
  timeoutMs = 12000
} = {}) {
  const resolvedTarget = path.resolve(targetPath);
  if (!fs.existsSync(resolvedTarget)) {
    return { updated: false, reason: 'target_missing' };
  }

  try {
    const remoteCode = await downloadText(rawUrl, timeoutMs);
    if (
      !remoteCode ||
      remoteCode.length < 25000 ||
      !remoteCode.includes('applyServerAtomicStockDelta') ||
      !remoteCode.includes('initDatabase')
    ) {
      return { updated: false, reason: 'invalid_payload' };
    }

    const currentCode = fs.readFileSync(resolvedTarget, 'utf8');
    if (sha256(remoteCode) === sha256(currentCode)) {
      console.log('✅ [AutoUpdate] server.js ya está en su versión más reciente.');
      return { updated: false, reason: 'already_latest' };
    }

    const tmpPath = `${resolvedTarget}.next`;
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
  } catch (err) {
    console.log(`ℹ️ [AutoUpdate] Sin conexión para comprobar actualización (${err.message}); iniciando con versión local.`);
    return { updated: false, reason: 'network_error', error: err.message };
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirect) {
  const customTarget = process.argv[2] || path.join(__dirname, 'server.js');
  autoUpdateServerScript({ targetPath: customTarget }).then(() => process.exit(0));
}
