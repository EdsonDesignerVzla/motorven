import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

let localSupabaseProc = null;
const COMPANY_SERVER_HOST = process.env.COMPANY_SERVER_HOST || '192.168.0.3';

function ensureLocalSupabaseRunning() {
  if (localSupabaseProc) return;
  // Verificar primero si el servidor central de la empresa (SVR-MOTORVEN 192.168.0.3) está activo
  const srvSocket = new net.Socket();
  srvSocket.setTimeout(800);
  srvSocket.once('connect', () => {
    srvSocket.destroy();
    // El servidor central de la empresa está en línea: NO levantar copia en la laptop
  });
  const checkFallbackLocal = () => {
    srvSocket.destroy();
    const socket = new net.Socket();
    socket.setTimeout(600);
    socket.once('connect', () => {
      socket.destroy();
    });
    socket.once('error', () => {
      socket.destroy();
      spawnLocalSupabase();
    });
    socket.once('timeout', () => {
      socket.destroy();
      spawnLocalSupabase();
    });
    socket.connect(54321, '127.0.0.1');
  };
  srvSocket.once('error', checkFallbackLocal);
  srvSocket.once('timeout', checkFallbackLocal);
  srvSocket.connect(54321, COMPANY_SERVER_HOST);
}

function spawnLocalSupabase() {
  if (localSupabaseProc) return;
  const scriptPath = path.resolve(process.cwd(), 'scripts/local-supabase/server.js');
  if (!fs.existsSync(scriptPath)) return;
  try {
    localSupabaseProc = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      stdio: 'ignore',
      detached: true,
      windowsHide: true
    });
    localSupabaseProc.unref();
    localSupabaseProc.on('exit', () => {
      localSupabaseProc = null;
    });
  } catch (_) {
    localSupabaseProc = null;
  }
}

const autoStartSupabasePlugin = () => ({
  name: 'auto-start-local-supabase',
  configureServer() {
    ensureLocalSupabaseRunning();
  },
  configurePreviewServer() {
    ensureLocalSupabaseRunning();
  }
});

// Middleware para consultar la API oficial de Binance P2P en tiempo real sin restricciones de CORS
const binanceP2pPlugin = () => ({
  name: 'binance-p2p-live',
  configureServer(server) {
    server.middlewares.use('/api/binance-usdt', async (req, res) => {
      try {
        const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            asset: 'USDT',
            fiat: 'VES',
            merchantCheck: false,
            page: 1,
            payTypes: [],
            publisherType: null,
            rows: 10,
            tradeType: 'BUY'
          })
        });
        const data = await response.json();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(data));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
});

// Proxy hacia el servidor central de la empresa SVR-MOTORVEN (https://api.signummotorven.com).
// Garantiza que la laptop de desarrollo y las computadoras de la oficina usen
// SIEMPRE la misma base de datos central alojada en el servidor de la empresa.
const SUPABASE_LOCAL_TARGET = process.env.SUPABASE_LOCAL_TARGET || 'https://api.signummotorven.com';
const supabaseProxy = {
  '/sb': {
    target: SUPABASE_LOCAL_TARGET,
    changeOrigin: true,
    ws: true,
    rewrite: (p) => p.replace(/^\/sb/, '') || '/'
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [autoStartSupabasePlugin(), react(), binanceP2pPlugin()],
  json: {
    stringify: true
  },
  base: './',
  server: {
    port: 5180,
    host: true,
    proxy: supabaseProxy,
    watch: {
      ignored: [
        '**/supabase/**',
        '**/dist/**',
        '**/docs/**',
        '**/src/data/supabaseRealData.js',
        '**/SERVIDOR_EMPRESA_26.229.220.202/**'
      ]
    }
  },
  preview: {
    host: true,
    proxy: supabaseProxy
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('supabaseRealData') || id.includes('/dump/') || id.includes('\\dump\\')) {
            return 'real-data-dump';
          }
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
