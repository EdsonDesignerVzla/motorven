import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';

const projectRoot = path.resolve();
const envPath = path.join(projectRoot, '.env');
const cloudflaredPath = path.join(projectRoot, 'scripts/tunnel/cloudflared.exe');

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

async function ensureLocalSupabase() {
  const open = await isPortOpen(54321);
  if (!open) {
    console.log('⚡ Iniciando servidor de base de datos local en puerto 54321...');
    const srv = spawn(process.execPath, [path.join(projectRoot, 'scripts/local-supabase/server.js')], {
      cwd: projectRoot,
      stdio: 'ignore',
      detached: true,
      windowsHide: true
    });
    srv.unref();
    await new Promise(r => setTimeout(r, 1500));
  } else {
    console.log('✅ Base de datos local activa en puerto 54321.');
  }
}

async function startTunnel() {
  await ensureLocalSupabase();

  if (!fs.existsSync(cloudflaredPath)) {
    console.error('❌ No se encontró cloudflared.exe en scripts/tunnel/');
    process.exit(1);
  }

  console.log('🚀 Levantando túnel HTTPS seguro con Cloudflare...');
  const tunnel = spawn(cloudflaredPath, ['tunnel', '--url', 'http://127.0.0.1:54321'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let assignedUrl = null;

  const onData = (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !assignedUrl) {
      assignedUrl = match[0];
      console.log('\n============================================================');
      console.log(`🎉 ¡TÚNEL CONECTADO EXITOSAMENTE A TU EQUIPO!`);
      console.log(`🌐 URL Pública HTTPS: ${assignedUrl}`);
      console.log('============================================================\n');

      // Actualizar archivo .env con la URL pública del túnel
      const newEnv = `VITE_SUPABASE_URL=${assignedUrl}\nVITE_SUPABASE_ANON_KEY=local-free-token\n`;
      fs.writeFileSync(envPath, newEnv, 'utf8');
      console.log('📝 Archivo .env actualizado automáticamente con el túnel.');

      console.log('🔨 Compilando proyecto en carpeta "dist" listo para GitHub Pages...');
      const buildProc = spawn('npm.cmd', ['run', 'build'], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
      });

      buildProc.on('close', (code) => {
        if (code === 0) {
          console.log('\n============================================================');
          console.log('✅ PROYECTO COMPILADO CON ÉXITO EN CARPETA "dist"');
          console.log('👉 Sube el contenido de "dist" a GitHub.');
          console.log('📲 Cuando entres al link de GitHub o desde el celular,');
          console.log('   se conectará en tiempo real directo a la base de datos de tu PC.');
          console.log('⚠️  Mantén esta ventana abierta mientras uses la app web.');
          console.log('============================================================\n');
        } else {
          console.error('❌ Error durante la compilación.');
        }
      });
    }
  };

  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);

  tunnel.on('close', (code) => {
    console.log(`Túnel cerrado con código: ${code}`);
  });
}

startTunnel();
