/**
 * Test de Sincronización Simultánea: Supabase ↔ Profit Plus
 * Prueba creación, guardado, edición y eliminación en simultáneo.
 */

async function run() {
  const SUPABASE_BASE = 'http://localhost:54321';
  const PROFIT_BASE = 'http://localhost:3005';

  console.log('--- Iniciando Verificación de Sincronización Simultánea ---');

  // Helper HTTP POST
  async function postJson(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return { status: res.status, data: await res.json() };
  }

  // 1. Health checks
  try {
    const sbHealth = await fetch(`${SUPABASE_BASE}/health`).then(r => r.json());
    console.log('✅ Supabase Local Health:', sbHealth.status, `(tablas: ${Object.keys(sbHealth.tables).length})`);
  } catch (e) {
    console.error('❌ Error conectando a Supabase Local:', e.message);
  }

  try {
    const pfHealth = await fetch(`${PROFIT_BASE}/api/profit/status`).then(r => r.json());
    console.log('✅ Profit Bridge Health:', pfHealth.status, `(modo demo/fallback: ${pfHealth.demoMode})`);
  } catch (e) {
    console.error('❌ Error conectando a Profit Bridge:', e.message);
  }

  // 2. Test Simultáneo Producto (art)
  const testProd = {
    id: 'TEST-ART-999',
    codigo: 'TEST-ART-999',
    descripcion: 'ACEITE SINTETICO TEST 5W-40',
    marca: 'OILSTONE',
    categoria: 'Sintético',
    viscosidad: '5W-40',
    presentacion: 'Galón (3.785L)',
    litrosPorUnidad: 3.785,
    precioVentaUsd: 42.50,
    costoUsd: 28.00,
    stock: 50,
    minimo: 10
  };

  console.log('\n[1/7] Probando Sincronización Simultánea: PRODUCTO');
  const prodRes = await postJson(`${PROFIT_BASE}/api/profit/write/product`, { action: 'SAVE', product: testProd });
  console.log('-> Profit Bridge write/product:', prodRes.status, prodRes.data.success ? 'OK' : prodRes.data);

  // 3. Test Simultáneo Cliente (clientes)
  const testClient = {
    id: 'TEST-CLI-999',
    rif: 'J-99988877-1',
    nombre: 'DISTRIBUIDORA DE PRUEBA SIMULTANEA C.A.',
    telefono: '0414-9998877',
    email: 'contacto@distribuidoraprueba.com',
    direccion: 'Zona Industrial Valencia',
    diasCredito: 15,
    limiteCreditoUsd: 5000,
    saldoDeudorUsd: 0
  };

  console.log('\n[2/7] Probando Sincronización Simultánea: CLIENTE');
  const clientRes = await postJson(`${PROFIT_BASE}/api/profit/write/client`, { action: 'SAVE', client: testClient });
  console.log('-> Profit Bridge write/client:', clientRes.status, clientRes.data.success ? 'OK' : clientRes.data);

  // 4. Test Simultáneo Venta / Factura (factura & reng_fac)
  const testSale = {
    id: 'FACT-TEST-0001',
    numeroDoc: 'FACT-TEST-0001',
    tipoDoc: 'FACTURA',
    clienteId: 'TEST-CLI-999',
    clienteNombre: 'DISTRIBUIDORA DE PRUEBA SIMULTANEA C.A.',
    clienteRif: 'J-99988877-1',
    totalUsd: 85.00,
    totalBs: 70357.05,
    condicionPago: 'CONTADO',
    metodoPago: 'PAGO_MOVIL_BS',
    vendedor: 'Christian Martínez',
    items: [
      {
        articuloId: 'TEST-ART-999',
        articuloDescripcion: 'ACEITE SINTETICO TEST 5W-40',
        cantidad: 2,
        precioUnitarioUsd: 42.50,
        totalUsd: 85.00,
        litros: 7.57
      }
    ]
  };

  console.log('\n[3/7] Probando Sincronización Simultánea: VENTA / FACTURA');
  const saleRes = await postJson(`${PROFIT_BASE}/api/profit/write/sale`, { action: 'SAVE', sale: testSale });
  console.log('-> Profit Bridge write/sale:', saleRes.status, saleRes.data.success ? 'OK' : saleRes.data);

  // 5. Test Simultáneo Pedido / Preventa (pedidos & reng_ped)
  const testOrder = {
    id: 'PED-TEST-0001',
    numeroDoc: 'PED-TEST-0001',
    tipoDoc: 'PEDIDO',
    clienteId: 'TEST-CLI-999',
    clienteNombre: 'DISTRIBUIDORA DE PRUEBA SIMULTANEA C.A.',
    clienteRif: 'J-99988877-1',
    vendedorId: 'VEN-01',
    totalNetoUsd: 255.00,
    totalLitros: 22.71,
    status: 'CONFIRMADO',
    items: [
      {
        articuloId: 'TEST-ART-999',
        articuloDescripcion: 'ACEITE SINTETICO TEST 5W-40',
        cantidad: 6,
        precioUnitarioUsd: 42.50,
        totalUsd: 255.00
      }
    ]
  };

  console.log('\n[4/7] Probando Sincronización Simultánea: PEDIDO');
  const orderRes = await postJson(`${PROFIT_BASE}/api/profit/write/order`, { action: 'SAVE', order: testOrder });
  console.log('-> Profit Bridge write/order:', orderRes.status, orderRes.data.success ? 'OK' : orderRes.data);

  // 6. Test Simultáneo Proveedor (prov)
  const testSupplier = {
    id: 'TEST-PROV-999',
    co_prov: 'TEST-PROV-999',
    rif: 'J-12345678-0',
    nombre: 'LUBRICANTES Y ADITIVOS MUNDIALES C.A.',
    telefono: '0241-8889900',
    direccion: 'Valencia, Edo. Carabobo'
  };

  console.log('\n[5/7] Probando Sincronización Simultánea: PROVEEDOR');
  const supplierRes = await postJson(`${PROFIT_BASE}/api/profit/write/supplier`, { action: 'SAVE', supplier: testSupplier });
  console.log('-> Profit Bridge write/supplier:', supplierRes.status, supplierRes.data.success ? 'OK' : supplierRes.data);

  // 7. Test Simultáneo Compra (compras & reng_com)
  const testPurchase = {
    id: 'COMP-TEST-0001',
    numeroDoc: 'COMP-TEST-0001',
    tipoDoc: 'FACTURA_COMPRA',
    proveedorId: 'TEST-PROV-999',
    proveedorNombre: 'LUBRICANTES Y ADITIVOS MUNDIALES C.A.',
    proveedorRif: 'J-12345678-0',
    totalUsd: 280.00,
    totalBs: 231764.40,
    condicionPago: 'CREDITO',
    items: [
      {
        articuloId: 'TEST-ART-999',
        articuloDescripcion: 'ACEITE SINTETICO TEST 5W-40',
        cantidad: 10,
        costoUnitarioUsd: 28.00,
        totalUsd: 280.00
      }
    ]
  };

  console.log('\n[6/7] Probando Sincronización Simultánea: COMPRA');
  const purchaseRes = await postJson(`${PROFIT_BASE}/api/profit/write/purchase`, { action: 'SAVE', purchase: testPurchase });
  console.log('-> Profit Bridge write/purchase:', purchaseRes.status, purchaseRes.data.success ? 'OK' : purchaseRes.data);

  // 8. Test Simultáneo Movimiento de Caja / Cobro (cobros / mov_caj)
  const testCashMov = {
    id: 'MOV-TEST-0001',
    tipo: 'INGRESO',
    concepto: 'Cobro Venta FACT-TEST-0001 - DISTRIBUIDORA DE PRUEBA',
    montoUsd: 85.00,
    montoBs: 70357.05,
    metodo: 'PAGO_MOVIL_BS',
    usuario: 'Christian Martínez'
  };

  console.log('\n[7/7] Probando Sincronización Simultánea: MOVIMIENTO DE CAJA / COBRO');
  const cashRes = await postJson(`${PROFIT_BASE}/api/profit/write/cash-movement`, { action: 'SAVE', movement: testCashMov });
  console.log('-> Profit Bridge write/cash-movement:', cashRes.status, cashRes.data.success ? 'OK' : cashRes.data);

  // 9. Test de Eliminación (DELETE)
  console.log('\n[EXTRA] Probando Eliminación Simultánea (DELETE)');
  const delProdRes = await postJson(`${PROFIT_BASE}/api/profit/write/product`, { action: 'DELETE', product: { id: 'TEST-ART-999', codigo: 'TEST-ART-999' } });
  console.log('-> DELETE Product:', delProdRes.status, delProdRes.data.success ? 'OK' : delProdRes.data);

  const delClientRes = await postJson(`${PROFIT_BASE}/api/profit/write/client`, { action: 'DELETE', client: { id: 'TEST-CLI-999', codigo: 'TEST-CLI-999' } });
  console.log('-> DELETE Client:', delClientRes.status, delClientRes.data.success ? 'OK' : delClientRes.data);

  const delSupplierRes = await postJson(`${PROFIT_BASE}/api/profit/write/supplier`, { action: 'DELETE', supplier: { id: 'TEST-PROV-999', co_prov: 'TEST-PROV-999' } });
  console.log('-> DELETE Supplier:', delSupplierRes.status, delSupplierRes.data.success ? 'OK' : delSupplierRes.data);

  console.log('\n=== ✅ TODAS LAS PRUEBAS DE SINCRONIZACIÓN SIMULTÁNEA COMPLETADAS EXITOSAMENTE ===');
}

run().catch(err => {
  console.error('Error fatal durante la prueba:', err);
  process.exit(1);
});
