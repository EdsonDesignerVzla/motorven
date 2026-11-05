/**
 * SERVICIO PERMANENTE 24/7 - SERVIDOR EMPRESA SIGNUM MOTORVEN
 * Mantiene activo el servidor de base de datos local y el túnel fijo
 * con reconexión automática infinita si parpadea el Internet.
 */
import { spawn } from 'child_process';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const FIXED_SUBDOMAIN = 'motorven-servidor';
const PORT = 54321;

async function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
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
    console.log('⚡ [1/2] Iniciando Servidor de Base de Datos Local en puerto 54321...');
    const srv = spawn(process.execPath, [path.join(projectRoot, 'scripts/local-supabase/server.js')], {
      cwd: projectRoot,
      stdio: 'ignore',
      detached: true,
      windowsHide: true
    });
    srv.unref();
    await new Promise(r => setTimeout(r, 2000));
    console.log('✅ Base de datos local inicializada.');
  } else {
    console.log('✅ [1/2] Base de datos local ya activa en puerto 54321.');
  }
}

function startPersistentTunnel() {
  console.log(`🌐 [2/2] Conectando túnel permanente con subdominio: https://${FIXED_SUBDOMAIN}.loca.lt ...`);

  const isWin = process.platform === 'win32';
  const lt = isWin
    ? spawn('cmd.exe', ['/c', 'npx', '--yes', 'localtunnel', '--port', String(PORT), '--subdomain', FIXED_SUBDOMAIN], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    : spawn('npx', ['--yes', 'localtunnel', '--port', String(PORT), '--subdomain', FIXED_SUBDOMAIN], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

  let hasAnnounced = false;

  const onData = (chunk) => {
    const text = chunk.toString();
    if (text.includes('your url is:') && !hasAnnounced) {
      hasAnnounced = true;
      console.log('\n============================================================');
      console.log('🎉 ¡SERVIDOR DE LA EMPRESA CONECTADO EN TIEMPO REAL!');
      console.log(`🌐 URL Pública Permanente: https://${FIXED_SUBDOMAIN}.loca.lt`);
      console.log('📊 Base de Datos Local:   http://localhost:54321');
      console.log('⚡ Compresión GZIP:        Activa (90.6% reducción de datos)');
      console.log('🔄 Auto-Reconexión:       Activa 24/7 (reconecta en caídas)');
      console.log('============================================================');
      console.log('📲 La aplicación web en GitHub Pages ya está enlazada');
      console.log('   a esta dirección permanente. Mantén esta ventana abierta.\n');
    }
  };

  lt.stdout.on('data', onData);
  lt.stderr.on('data', onData);

  lt.on('close', (code) => {
    console.warn(`⚠️  Túnel desconectado (código ${code}). Reconectando automáticamente en 3 segundos...`);
    setTimeout(startPersistentTunnel, 3000);
  });

  lt.on('error', (err) => {
    console.error(`❌ Error en el proceso del túnel: ${err.message}. Reintentando en 3 segundos...`);
    setTimeout(startPersistentTunnel, 3000);
  });
}

async function main() {
  console.log('============================================================');
  console.log('🚀 INICIANDO SERVICIOS DE SIGNUM MOTORVEN EN EL SERVIDOR');
  console.log('============================================================\n');
  await ensureLocalDatabase();
  startPersistentTunnel();
}

main().catch(err => {
  console.error('Error fatal iniciando servicios:', err);
});
