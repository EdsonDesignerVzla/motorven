/**
 * SCRIPT DE DESPLIEGUE OFICIAL BLINDADO - SIGNUM MOTORVEN
 * Garantiza que en cada compilación y despliegue:
 * 1. CNAME ("signummotorven.com"), .nojekyll, 404.html y backend_url.json ("https://api.signummotorven.com")
 *    estén siempre intactos tanto en public/ como en dist/.
 * 2. Despliega automáticamente el contenido compilado de dist/ hacia el repositorio principal
 *    de producción https://github.com/EdsonDesignerVzla/motorven.git (rama main).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const OFFICIAL_DOMAIN = 'signummotorven.com';
const OFFICIAL_BACKEND_URL = 'https://api.signummotorven.com';
const PROD_REPO_URL = 'https://github.com/EdsonDesignerVzla/motorven.git';

const backendUrlPayload = JSON.stringify(
  {
    url: OFFICIAL_BACKEND_URL,
    lanUrls: [
      'http://192.168.0.6:54321',
      'http://26.45.7.149:54321',
      'http://192.168.0.5:54321',
      'http://26.229.220.202:54321'
    ],
    updatedAt: new Date().toISOString()
  },
  null,
  2
);

export function ensureProductionFiles() {
  const publicDir = path.join(projectRoot, 'public');
  const distDir = path.join(projectRoot, 'dist');

  // 1. Asegurar archivos en raíz y public/
  fs.writeFileSync(path.join(projectRoot, 'backend_url.json'), backendUrlPayload, 'utf8');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'CNAME'), `${OFFICIAL_DOMAIN}\n`, 'utf8');
    fs.writeFileSync(path.join(publicDir, 'backend_url.json'), backendUrlPayload, 'utf8');
    fs.writeFileSync(path.join(publicDir, '.nojekyll'), '', 'utf8');
  }

  // 2. Asegurar archivos en dist/
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'CNAME'), `${OFFICIAL_DOMAIN}\n`, 'utf8');
    fs.writeFileSync(path.join(distDir, 'backend_url.json'), backendUrlPayload, 'utf8');
    fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
    const indexHtml = path.join(distDir, 'index.html');
    const notFoundHtml = path.join(distDir, '404.html');
    if (fs.existsSync(indexHtml)) {
      fs.copyFileSync(indexHtml, notFoundHtml);
    }
  }
  console.log('✅ Archivos críticos verificados: CNAME (signummotorven.com), backend_url.json (https://api.signummotorven.com), .nojekyll y 404.html');
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

async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify-only');

  ensureProductionFiles();
  if (verifyOnly) return;

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
        'git commit -m "deploy(prod): sincronizacion en tiempo real blindada con signummotorven.com y api.signummotorven.com"',
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

main().catch((err) => {
  console.error('❌ Error en el despliegue:', err.message);
  process.exit(1);
});
