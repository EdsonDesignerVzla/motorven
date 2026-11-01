import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), binanceP2pPlugin()],
  base: './',
  server: {
    port: 5180,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('supabaseRealData')) {
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

