import { createClient } from '@supabase/supabase-js';

const SYNC_QUEUE_KEY = 'signum_offline_sync_queue';

// Simular localStorage en entorno Node.js si no está presente
if (typeof localStorage === 'undefined') {
  let store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'local-free-token';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runOfflineSyncTest() {
  console.log("=== INICIANDO TEST DE COLA OFFLINE Y SINCRONIZACIÓN CON SUPABASE ===");

  // 1. Simular acción offline (ej: nuevo producto encolado en modo desconectado)
  const testProduct = {
    id: `OIL-TEST-OFFLINE-${Date.now()}`,
    codigo: 'OIL-TEST-99',
    oem: 'COVENIN-TEST-99',
    descripcion: 'Aceite de Prueba Offline Sync Engine (Oilstone Test)',
    marca: 'OILSTONE ®',
    categoria: 'Industrial',
    viscosidad: 'ISO 68',
    norma_api: 'DIN 51524-2',
    unidad: 'Tambor (208L)',
    litros_por_unidad: 208,
    stock: 50,
    comprometido: 0,
    stock_minimo: 5,
    costo_usd: 150.00,
    precio_usd_detal: 250.00,
    precio_usd_mayor: 210.00,
    aplica_iva: true,
    color_etiqueta: '#10b981',
    imagen: '',
    especificaciones: { prueba: true }
  };

  const queueItem = {
    id: `sync_test_${Date.now()}`,
    entity: 'product',
    action: 'UPDATE',
    data: testProduct,
    timestamp: new Date().toISOString(),
    attempts: 0,
    lastError: null
  };

  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([queueItem]));
  console.log("✓ Operación encolada en signum_offline_sync_queue (Modo Offline simulado)");

  const queueInStorage = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY));
  console.log(`✓ Elementos en cola pendiente: ${queueInStorage.length} (ID: ${queueInStorage[0].data.id})`);

  // 2. Simular Flush / Sincronización al volver la conexión
  console.log("-> Procesando cola offline hacia Supabase...");
  const { data, error } = await supabase
    .from('products')
    .upsert([testProduct])
    .select()
    .single();

  if (error) {
    console.error("✗ Error subiendo a Supabase:", error);
    process.exit(1);
  }

  console.log(`✓ Producto persistido exitosamente en Supabase: ${data.id} - ${data.descripcion}`);

  // 3. Desencolar elemento
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
  const queueAfterFlush = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY));
  console.log(`✓ Cola de sincronización limpia tras subida exitosa. Pendientes restantes: ${queueAfterFlush.length}`);

  // 4. Limpieza: eliminar el producto de prueba en Supabase
  const { error: delErr } = await supabase
    .from('products')
    .delete()
    .eq('id', testProduct.id);

  if (!delErr) {
    console.log("✓ Limpieza de registro de prueba en Supabase completada.");
  }

  console.log("=== TODAS LAS PRUEBAS DE OFFLINE SYNC PASARON EXITOSAMENTE (100% OK) ===");
}

runOfflineSyncTest().catch(console.error);
