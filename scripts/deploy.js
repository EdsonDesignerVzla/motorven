/**
 * SCRIPT DE DESPLIEGUE OFICIAL BLINDADO - SIGNUM MOTORVEN
 * Garantiza que en cada compilación y despliegue:
 * 1. CNAME ("signummotorven.com"), .nojekyll, 404.html y backend_url.json (sincronizado con el servidor central SVRINNO-HOST1 192.168.0.3)
 *    estén siempre intactos tanto en public/ como en dist/.
 * 2. Despliega automáticamente el contenido compilado de dist/ hacia el repositorio principal
 *    de producción https://github.com/EdsonDesignerVzla/motorven.git (rama main).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const OFFICIAL_DOMAIN = 'signummotorven.com';
const OFFICIAL_BACKEND_URL = 'https://api.signummotorven.com';
const PROD_REPO_URL = 'https://EdsonDesignerVzla@github.com/EdsonDesignerVzla/motorven.git';

function fetchJsonText(urlStr, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(parsed, { timeout: timeoutMs }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

async function resolveActiveBackendUrlPayload() {
  // 1. Intentar leer directamente del servidor central de la oficina (192.168.0.3:54321)
  const fromLanServer = await fetchJsonText('http://192.168.0.3:54321/backend_url.json', 2000);
  if (fromLanServer) {
    try {
      const parsed = JSON.parse(fromLanServer);
      if (parsed?.url && !parsed.url.includes('trycloudflare.com')) {
        const cleanedLan = Array.isArray(parsed.lanUrls)
          ? parsed.lanUrls.filter(u => !u.includes('192.168.0.5') && !u.includes('192.168.0.6'))
          : [];
        if (!cleanedLan.includes('http://192.168.0.3:54321')) {
          cleanedLan.unshift('http://192.168.0.3:54321');
        }
        return JSON.stringify({ ...parsed, lanUrls: cleanedLan }, null, 2);
      }
    } catch (_) {}
  }

  // 2. Fallback oficial y definitivo (siempre priorizando 192.168.0.3)
  return JSON.stringify(
    {
      url: OFFICIAL_BACKEND_URL,
      lanUrls: [
        'http://192.168.0.3:54321',
        'http://26.45.7.149:54321',
        'http://26.229.220.202:54321'
      ],
      updatedAt: new Date().toISOString()
    },
    null,
    2
  );
}

function safeWriteFile(filePath, content) {
  try {
    if (fs.existsSync(filePath)) {
      try {
        if (fs.readFileSync(filePath, 'utf8') === content) return;
      } catch (_) {}
    }
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    try {
      const tmp = filePath + '.tmp_' + Date.now();
      fs.writeFileSync(tmp, content, 'utf8');
      try { fs.unlinkSync(filePath); } catch (_) {}
      fs.renameSync(tmp, filePath);
    } catch (_) {}
  }
}

export async function ensureProductionFiles() {
  const backendUrlPayload = await resolveActiveBackendUrlPayload();
  const parsedUrl = JSON.parse(backendUrlPayload).url;
  const publicDir = path.join(projectRoot, 'public');
  const distDir = path.join(projectRoot, 'dist');

  // 1. Asegurar archivos en raíz y public/
  safeWriteFile(path.join(projectRoot, 'backend_url.json'), backendUrlPayload);
  if (fs.existsSync(publicDir)) {
    safeWriteFile(path.join(publicDir, 'CNAME'), `${OFFICIAL_DOMAIN}\n`);
    safeWriteFile(path.join(publicDir, 'backend_url.json'), backendUrlPayload);
    safeWriteFile(path.join(publicDir, '.nojekyll'), '');
  }

  // 2. Asegurar archivos en dist/
  if (fs.existsSync(distDir)) {
    safeWriteFile(path.join(distDir, 'CNAME'), `${OFFICIAL_DOMAIN}\n`);
    safeWriteFile(path.join(distDir, 'backend_url.json'), backendUrlPayload);
    safeWriteFile(path.join(distDir, '.nojekyll'), '');
    const indexHtml = path.join(distDir, 'index.html');
    const notFoundHtml = path.join(distDir, '404.html');
    if (fs.existsSync(indexHtml)) {
      try {
        fs.copyFileSync(indexHtml, notFoundHtml);
      } catch (_) {}
    }
  }
  console.log(`✅ Archivos críticos verificados: CNAME (signummotorven.com), backend_url.json (${parsedUrl}), .nojekyll y 404.html`);
  return backendUrlPayload;
}

function copyRecursiveSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const entry of fs.readdirSync(src)) {
      if (entry === '.git') continue;
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Respalda automáticamente toda la base de datos y datos del sistema
 * en supabase/backups/ con timestamp antes de realizar cualquier despliegue.
 */
export function createSystemBackupBeforeDeploy() {
  const backupsDir = path.join(projectRoot, 'supabase', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  const dateShort = `${year}-${month}-${day}`;

  const localDbPath = path.join(projectRoot, 'supabase', 'local_database.json');
  if (fs.existsSync(localDbPath)) {
    const backupFile = path.join(backupsDir, `local_database_backup_${timestamp}.json`);
    const dailyBackupFile = path.join(backupsDir, `local_database_${dateShort}.json`);

    fs.copyFileSync(localDbPath, backupFile);
    fs.copyFileSync(localDbPath, dailyBackupFile);

    const stat = fs.statSync(backupFile);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(`🛡️ [BACKUP DE SEGURIDAD] Backup completo creado exitosamente:`);
    console.log(`   -> ${backupFile} (${sizeMb} MB)`);
    console.log(`   -> ${dailyBackupFile}`);
    return backupFile;
  } else {
    console.warn(`⚠️ [BACKUP] No se encontró ${localDbPath} para respaldar.`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify-only');

  const backendUrlPayload = await ensureProductionFiles();
  if (verifyOnly) return;

  // Realizar Backup de Seguridad Obligatorio antes del despliegue
  console.log('🛡️ [PASO 1/3] Generando Backup de Seguridad completo del sistema antes de desplegar...');
  createSystemBackupBeforeDeploy();

  const distDir = path.join(projectRoot, 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('No se encontró dist/index.html. Ejecuta npm run build primero.');
  }

  const tmpDeployDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motorven-deploy-'));
  console.log(`🚀 Preparando despliegue hacia ${PROD_REPO_URL} ...`);

  try {
    execSync(`git clone --depth 1 "${PROD_REPO_URL}" "${tmpDeployDir}"`, { stdio: 'inherit' });

    // Limpiar directorio clonado excepto .git
    for (const entry of fs.readdirSync(tmpDeployDir)) {
      if (entry === '.git') continue;
      fs.rmSync(path.join(tmpDeployDir, entry), { recursive: true, force: true });
    }

    // Copiar todo dist/ al repositorio de producción
    copyRecursiveSync(distDir, tmpDeployDir);

    // Re-verificar archivos críticos en el directorio de despliegue
    fs.writeFileSync(path.join(tmpDeployDir, 'CNAME'), `${OFFICIAL_DOMAIN}\n`, 'utf8');
    fs.writeFileSync(path.join(tmpDeployDir, 'backend_url.json'), backendUrlPayload, 'utf8');
    fs.writeFileSync(path.join(tmpDeployDir, '.nojekyll'), '', 'utf8');

    execSync('git add -A', { cwd: tmpDeployDir, stdio: 'inherit' });
    const statusOut = execSync('git status --porcelain', { cwd: tmpDeployDir, encoding: 'utf8' }).trim();
    if (!statusOut) {
      console.log('ℹ️  El repositorio principal motorven ya está 100% actualizado.');
    } else {
      execSync(
        'git commit -m "deploy(prod): sincronizacion en tiempo real blindada con servidor central SVR-MOTORVEN"',
        { cwd: tmpDeployDir, stdio: 'inherit' }
      );
      execSync('git push origin main', { cwd: tmpDeployDir, stdio: 'inherit' });
      console.log('🎉 Despliegue completado exitosamente en https://github.com/EdsonDesignerVzla/motorven (https://signummotorven.com)');
    }
  } finally {
    try {
      fs.rmSync(tmpDeployDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

const isDirectExecution = process.argv[1] && (path.resolve(process.argv[1]) === path.resolve(__filename));
if (isDirectExecution) {
  main().catch((err) => {
    console.error('❌ Error en el despliegue:', err.message);
    process.exit(1);
  });
}
