/**
 * Suite de Pruebas: Regla Oficial de Comisiones MOTORVEN, Normalización de Cobranzas,
 * Atribución Anti-Colisión de Cobradores y Etiquetas PDF ("Cobrador").
 */
import assert from 'node:assert/strict';

if (typeof global.document === 'undefined') {
  global.document = {
    createElement: () => ({
      href: '',
      download: '',
      style: {},
      click: () => {},
      setAttribute: () => {}
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    }
  };
}
if (typeof global.URL === 'undefined') {
  global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
  };
}

import fs from 'fs';
import {
  saveSupabaseProfitZone,
  getSupabaseProfitZones,
  deleteSupabaseProfitZone,
  getSupabaseProfitSellers,
  updateSupabaseSellerZone
} from '../services/supabaseService.js';
import {
  normalizeProfitCollectionUsd,
  matchesSeller,
  resolveBaseSinIvaUsd,
  calculateOverdueDays,
  getMotorvenCommissionRateByOverdueDays,
  calculateDocumentCommission,
  calculateSellerCommissionSummary,
  calculateProjectedOrderCommission,
  countDistinctActiveMonths,
  isSalesDepartmentUser,
  buildSalesDepartmentSellers
} from '../services/commissionService.js';
import {
  generateSellersPDF,
  generateAccountsReceivablePDF,
  generateConsolidatedCxcPDF
} from '../services/pdfReportService.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  ✘ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function collectPdfRawText(doc) {
  const pages = doc?.internal?.pages || {};
  return Object.values(pages)
    .flat()
    .map((line) => String(line || ''))
    .join('\n');
}

console.log('\n=== PRUEBAS: COMISIONES MOTORVEN, COBRANZAS Y ETIQUETAS COBRADOR ===');

test('1. Escala oficial por días vencidos (0-7d: 4%, 8-14d: 3%, 15-21d: 1%, >21d: 0%)', () => {
  assert.equal(getMotorvenCommissionRateByOverdueDays(0).ratePct, 4);
  assert.equal(getMotorvenCommissionRateByOverdueDays(7).ratePct, 4);
  assert.equal(getMotorvenCommissionRateByOverdueDays(8).ratePct, 3);
  assert.equal(getMotorvenCommissionRateByOverdueDays(14).ratePct, 3);
  assert.equal(getMotorvenCommissionRateByOverdueDays(15).ratePct, 1);
  assert.equal(getMotorvenCommissionRateByOverdueDays(21).ratePct, 1);
  assert.equal(getMotorvenCommissionRateByOverdueDays(22).ratePct, 0);
  assert.equal(getMotorvenCommissionRateByOverdueDays(60).ratePct, 0);
});

test('2. Cálculo de días vencidos y comisión sobre FACTURA pagada 100% sin IVA', () => {
  // Base 100 USD + 16 IVA = 116 USD neto; pagado con 7 días vencidos => 4% de $100 = $4.00 (no $4.64!)
  const fac7d = {
    id: 'inv-fac-7d',
    factNum: '001001',
    tipoDoc: 'FACTURA',
    vendedorId: 'CM',
    fechaEmision: '2026-10-01',
    fechaVencimiento: '2026-10-10',
    fechaUltimoCobro: '2026-10-17',
    totBrutoUsd: 100,
    ivaUsd: 16,
    totNetoUsd: 116,
    saldoUsd: 0,
    status: 'COBRADA'
  };
  const r7 = calculateDocumentCommission(fac7d, { tasaBcv: 500 });
  assert.equal(r7.eligible, true);
  assert.equal(r7.fullyPaid, true);
  assert.equal(r7.diasVencidos, 7);
  assert.equal(r7.ratePct, 4);
  assert.equal(r7.baseSinIvaUsd, 100);
  assert.equal(r7.comisionUsd, 4);
  assert.equal(r7.comisionBs, 2000);

  // Fallback sin totBrutoUsd: neto 116 con IVA 16 => base 100 USD; 8 días vencidos => 3%
  const fac8d = {
    id: 'inv-fac-8d',
    factNum: '001002',
    tipoDoc: 'FACTURA',
    vendedorId: 'CM',
    fechaEmision: '2026-10-01',
    fechaVencimiento: '2026-10-10',
    totNetoUsd: 116,
    ivaUsd: 16,
    saldoUsd: 0,
    status: 'COBRADA'
  };
  const r8 = calculateDocumentCommission(fac8d, {
    collections: [{ factNum: '001002', tipoDoc: 'FACTURA', fecha: '2026-10-18', montoUsd: 116 }],
    tasaBcv: 500
  });
  assert.equal(r8.diasVencidos, 8);
  assert.equal(r8.ratePct, 3);
  assert.equal(r8.baseSinIvaUsd, 100);
  assert.equal(r8.comisionUsd, 3);
});

test('3. NOTA_ENTREGA sin IVA elegible (15d=1%, 22d=0%) y documentos con saldo > $0.01 no devengan comisión', () => {
  const ne15 = {
    id: 'inv-ne-15d',
    factNum: 'NE-00501',
    tipoDoc: 'NOTA_ENTREGA',
    vendedorId: 'CM',
    fechaEmision: '2026-10-01',
    fechaVencimiento: '2026-10-10',
    fechaUltimoCobro: '2026-10-25',
    totNetoUsd: 200,
    saldoUsd: 0,
    status: 'COBRADA'
  };
  const r15 = calculateDocumentCommission(ne15);
  assert.equal(r15.diasVencidos, 15);
  assert.equal(r15.ratePct, 1);
  assert.equal(r15.baseSinIvaUsd, 200);
  assert.equal(r15.comisionUsd, 2);

  const ne22 = { ...ne15, id: 'inv-ne-22d', factNum: 'NE-00502', fechaUltimoCobro: '2026-11-01' };
  const r22 = calculateDocumentCommission(ne22);
  assert.equal(r22.diasVencidos, 22);
  assert.equal(r22.ratePct, 0);
  assert.equal(r22.comisionUsd, 0);

  const unpaid = { ...ne15, id: 'inv-ne-unpaid', saldoUsd: 25, status: 'PENDIENTE' };
  const rUnpaid = calculateDocumentCommission(unpaid);
  assert.equal(rUnpaid.fullyPaid, false);
  assert.equal(rUnpaid.comisionUsd, 0);

  const annulled = { ...ne15, id: 'inv-ne-anul', anulada: true };
  const rAnul = calculateDocumentCommission(annulled);
  assert.equal(rAnul.eligible, false);
  assert.equal(rAnul.comisionUsd, 0);
});

test('4. Consolidador por Cobrador (calculateSellerCommissionSummary) y proyección carrito 4% sin IVA', () => {
  const seller = { coVen: 'CM', venDes: 'Carlos Mendez' };
  const docs = [
    { id: '1', factNum: '101', tipoDoc: 'FACTURA', vendedorId: 'CM', fechaVencimiento: '2026-10-10', fechaUltimoCobro: '2026-10-10', totBrutoUsd: 100, ivaUsd: 16, totNetoUsd: 116, saldoUsd: 0 },
    { id: '2', factNum: '102', tipoDoc: 'NOTA_ENTREGA', vendedorId: 'CM', fechaVencimiento: '2026-10-10', fechaUltimoCobro: '2026-10-20', totNetoUsd: 200, saldoUsd: 0 },
    { id: '3', factNum: '103', tipoDoc: 'FACTURA', vendedorId: 'CM', fechaVencimiento: '2026-10-28', totBrutoUsd: 500, ivaUsd: 80, totNetoUsd: 580, saldoUsd: 580 },
    { id: '4', factNum: '104', tipoDoc: 'FACTURA', vendedorId: 'OF', fechaVencimiento: '2026-10-10', fechaUltimoCobro: '2026-10-10', totBrutoUsd: 1000, totNetoUsd: 1160, saldoUsd: 0 }
  ];
  const summary = calculateSellerCommissionSummary(seller, {
    invoices: docs,
    collections: [],
    tasaBcv: 500,
    asOfDate: '2026-10-25'
  });

  // Doc 1: 100 * 4% = $4.00; Doc 2: 200 * 3% (10d) = $6.00; Doc 3 unpaid ($0 earned, projected al día 500 * 4% = $20); Doc 4 belongs to OF
  assert.equal(summary.paidDocsCount, 2);
  assert.equal(summary.pendingDocsCount, 1);
  assert.equal(summary.basePagadaSinIvaUsd, 300);
  assert.equal(summary.totalComisionUsd, 10);
  assert.equal(summary.totalComisionBs, 5000);
  assert.equal(summary.tiers.TIER_0_7.docsCount, 1);
  assert.equal(summary.tiers.TIER_8_14.docsCount, 1);
  assert.equal(summary.projectedAlDiaBaseUsd, 500);
  assert.equal(summary.projectedAlDiaComisionUsd, 20);

  const proj = calculateProjectedOrderCommission({ subtotalUsd: 250, tasaBcv: 500 });
  assert.equal(proj.comisionUsd, 10);
  assert.equal(proj.comisionBs, 5000);
});

test('5. Normalización de Bolívares guardados erróneamente en montoUsd cuando tasa > 10', () => {
  const corruptedCol = {
    montoUsd: 268134.41,
    montoBs: 268134.41,
    tasa: 993.09
  };
  assert.equal(normalizeProfitCollectionUsd(corruptedCol), 270);

  const zeroUsdCol = {
    montoUsd: 0,
    montoBs: 99309,
    tasa: 993.09
  };
  assert.equal(normalizeProfitCollectionUsd(zeroUsdCol), 100);

  const validCol = {
    montoUsd: 270,
    montoBs: 268134.41,
    tasa: 993.09
  };
  assert.equal(normalizeProfitCollectionUsd(validCol), 270);
});

test('6. Atribución exacta anti-colisión matchesSeller para códigos cortos (OF, CM, MS)', () => {
  const ofSeller = { coVen: 'OF', venDes: 'Oficina Central' };
  const smSeller = { coVen: 'SM', venDes: 'Sofia Mendoza' };
  const cmSeller = { coVen: 'CM', venDes: 'Carlos Mendez' };

  assert.equal(matchesSeller(ofSeller, { vendedorId: 'OF' }), true);
  assert.equal(matchesSeller(ofSeller, { vendedorId: 'OF - Oficina Central' }), true);
  assert.equal(matchesSeller(ofSeller, { vendedor: 'Sofia Mendoza' }), false);
  assert.equal(matchesSeller(ofSeller, { vendedorId: 'SOFIA' }), false);

  assert.equal(matchesSeller(cmSeller, { vendedorId: 'CM' }), true);
  assert.equal(matchesSeller(cmSeller, { vendedorId: 'COMISION' }), false);
  assert.equal(matchesSeller(smSeller, { vendedor: 'Sofia Mendoza' }), true);
  assert.equal(matchesSeller(smSeller, { vendedor: 'Oficina Central' }), false);
});

test('7. Conteo dinámico de meses activos (countDistinctActiveMonths) y fallback resolveBaseSinIvaUsd', () => {
  assert.equal(
    countDistinctActiveMonths(
      [{ fechaEmision: '2026-09-05' }, { fechaEmision: '2026-10-12' }, { fechaEmision: '2026-10-19', anulada: true }],
      [{ fecha: '2026-11-02' }]
    ),
    3
  );
  assert.equal(calculateOverdueDays('2026-10-10', '2026-10-17'), 7);
  // Factura sin totBrutoUsd ni ivaUsd explícito: extrae 16% IVA automáticamente
  assert.equal(resolveBaseSinIvaUsd({ tipoDoc: 'FACTURA', totNetoUsd: 116 }), 100);
});

test('8. PDFs de Cobradores y CxC reemplazan Vendedor/Asesor por Cobrador y ejecutan sin errores', () => {
  const sellerDoc = generateSellersPDF({
    sellers: [{
      coVen: 'CM',
      venDes: 'Carlos Mendez',
      zona: 'Centro',
      totalLitros: 1200,
      totalVentasUsd: 4500,
      basePagadaSinIvaUsd: 3000,
      metaLitrosMes: 3000,
      cumplimientoPct: 40,
      comisionEstimadaUsd: 110
    }],
    config: { tasaDolar: 911.62 }
  });
  assert.ok(sellerDoc && sellerDoc.internal.getNumberOfPages() >= 1);
  const sellerRaw = collectPdfRawText(sellerDoc);
  assert.ok(sellerRaw.includes('COBRADOR'), 'generateSellersPDF debe contener COBRADOR');

  const cxcDoc = generateAccountsReceivablePDF({
    receivables: [{
      vendedorId: 'CM',
      factura: '001234',
      rif: 'J-12345678-9',
      clienteNombre: 'Lubricantes Test C.A.',
      fechaEmision: '2026-10-01',
      fechaVencimiento: '2026-10-16',
      montoFacturaUsd: 116,
      abonosUsd: 0,
      saldoUsd: 116
    }],
    config: { tasaDolar: 911.62 }
  });
  assert.ok(cxcDoc && cxcDoc.internal.getNumberOfPages() >= 1);
  const cxcRaw = collectPdfRawText(cxcDoc);
  assert.ok(cxcRaw.includes('COBRADOR'), 'generateAccountsReceivablePDF debe usar COBRADOR');

  const consolidatedDoc = generateConsolidatedCxcPDF({
    docs: [{
      tipoDoc: 'FACTURA',
      factNum: '001234',
      clienteNombre: 'Lubricantes Test C.A.',
      clienteRif: 'J-12345678-9',
      vendedorId: 'CM',
      fechaEmision: '2026-10-01',
      fechaVencimiento: '2026-10-16',
      diasVencidos: 5,
      montoFacturaUsd: 116,
      abonosUsd: 0,
      restanteUsd: 116,
      estado: 'VENCIDA'
    }],
    mode: 'docs',
    filters: { typeLabel: 'Facturas', statusLabel: 'Activa', sellerLabel: 'Todos los cobradores' },
    config: { tasaDolar: 911.62 }
  });
  assert.ok(consolidatedDoc && consolidatedDoc.internal.getNumberOfPages() >= 1);
  const consolidatedRaw = collectPdfRawText(consolidatedDoc);
  assert.ok(consolidatedRaw.includes('COBR.'), 'generateConsolidatedCxcPDF debe usar COBR.');

  // Limpiar PDFs generados en raíz por la prueba si existen
  const cwd = process.cwd();
  fs.readdirSync(cwd).forEach((f) => {
    if (
      (f.startsWith('Reporte_Fuerza_Ventas_SIGNUM_') ||
        f.startsWith('Cuentas_por_Cobrar_SIGNUM_') ||
        f.startsWith('Reporte_Consolidado_CxC_') ||
        f.startsWith('Reporte_CxC_Consolidado_Documentos_') ||
        f.startsWith('Reporte_Documentos_CxC_')) &&
      f.endsWith('.pdf')
    ) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  });
});

// 9. CRUD de Zonas Exclusivas de Venta y Sincronización de Usuarios de Ventas
{
  const memStore = new Map();
  const prevStorage = globalThis.localStorage;
  const prevFetch = globalThis.fetch;
  globalThis.localStorage = {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => { memStore.set(k, String(v)); },
    removeItem: (k) => { memStore.delete(k); },
    clear: () => { memStore.clear(); }
  };
  globalThis.fetch = async () => { throw new Error('offline-test'); };

  try {
    const created = await saveSupabaseProfitZone({ coZon: '08', zonDes: 'Aragua Centro - Maracay' }, []);
    assert.equal(created.coZon, '08');
    assert.equal(created.zonDes, 'Aragua Centro - Maracay');

    const edited = await saveSupabaseProfitZone({ id: created.id, coZon: '08', zonDes: 'Aragua - Maracay y Cagua' }, [created]);
    assert.equal(edited.zonDes, 'Aragua - Maracay y Cagua');

    await assert.rejects(
      () => saveSupabaseProfitZone({ coZon: '08', zonDes: 'Otro Territorio' }, [edited]),
      /Ya existe una zona con el código/
    );
    await assert.rejects(
      () => saveSupabaseProfitZone({ coZon: '09', zonDes: 'Aragua - Maracay y Cagua' }, [edited]),
      /Ya existe otra zona con ese nombre/
    );

    const zonesAfterSave = await getSupabaseProfitZones();
    assert.ok(zonesAfterSave.some((z) => z.coZon === '08' && z.zonDes === 'Aragua - Maracay y Cagua'));

    await deleteSupabaseProfitZone(edited);
    const zonesAfterDelete = await getSupabaseProfitZones();
    assert.equal(zonesAfterDelete.some((z) => z.coZon === '08'), false);

    // Verificar que un usuario de Ventas sin co_ven aparece automáticamente en getSupabaseProfitSellers sin zona asignada
    globalThis.localStorage.setItem('signum_users_list', JSON.stringify([
      {
        id: 'usr-mwaup5bz',
        username: 'rosibelventas',
        nombre: 'Rosibel Briceño',
        rol: 'VENTAS',
        departamento: 'VEN',
        activo: true,
        co_ven: null
      }
    ]));
    const sellers = await getSupabaseProfitSellers();
    const rosibel = sellers.find((s) => s.venDes === 'Rosibel Briceño');
    assert.ok(rosibel, 'Usuario activo de Ventas sin co_ven debe aparecer automáticamente en Fuerza de Ventas');
    assert.equal(rosibel.coZon, '');
    assert.equal(rosibel.zona, '');

    passed += 1;
    console.log('  ✔ 9. CRUD de Zonas Exclusivas (crear, editar, anti-duplicado, eliminar) y sincronización de usuario Ventas');
  } finally {
    globalThis.localStorage = prevStorage;
    globalThis.fetch = prevFetch;
  }
}

test('10. Fuerza de Ventas muestra EXCLUSIVAMENTE usuarios del departamento Ventas (excluye Cobranza/legacy y refleja Rosibel de Ventas)', () => {
  assert.equal(
    isSalesDepartmentUser({ id: 'usr-mvgse4to', username: 'rosibelcxc', nombre: 'Rosibel Briceño', rol: 'COBRANZA', departamento: 'ADM', activo: true }),
    false
  );
  assert.equal(
    isSalesDepartmentUser({ id: 'usr-wrong-dept', username: 'testadm', nombre: 'Usuario Admin', rol: 'VENTAS', departamento: 'ADM', activo: true }),
    false
  );
  assert.equal(
    isSalesDepartmentUser({ id: 'usr-inactive', username: 'inactivo', nombre: 'Vendedor Inactivo', rol: 'VENTAS', departamento: 'VEN', activo: false }),
    false
  );
  assert.equal(
    isSalesDepartmentUser({ id: 'usr-mwnr2mt6', username: 'rosibelventas', nombre: 'Rosibel Briceño ventas', rol: 'VENTAS', departamento: 'VEN', activo: true }),
    true
  );
  assert.equal(
    isSalesDepartmentUser({ id: 'usr-ventas-txt', username: 'vendedor2', nombre: 'Nuevo Asesor', rol: 'VENTAS', departamento: 'Ventas', activo: true }),
    true
  );

  const sampleUsers = [
    { id: 'usr-admin', username: 'admin', nombre: 'Luiggy Silva', rol: 'ADMINISTRACIÓN', departamento: 'ADM', co_ven: null, activo: true },
    { id: 'usr-mvgse4to', username: 'rosibelcxc', nombre: 'Rosibel Briceño', rol: 'COBRANZA', departamento: 'ADM', co_ven: null, activo: true, foto: 'data:image/jpeg;base64,FOTO_COBRANZA' },
    { id: 'usr-mu5vswve', username: 'ventas', nombre: 'Yheyson Calderón', rol: 'VENTAS', departamento: 'VEN', co_ven: 'YC', activo: true },
    { id: 'usr-mwnr2mt6', username: 'rosibelventas', nombre: 'Rosibel Briceño ventas', rol: 'VENTAS', departamento: 'VEN', co_ven: 'RBR', activo: true },
    { id: 'usr-inactivo', username: 'exvendedor', nombre: 'Ex Vendedor', rol: 'VENTAS', departamento: 'VEN', co_ven: 'EV', activo: false }
  ];

  const sampleProfitSellers = [
    { id: 'YC', co_ven: 'YC', ven_des: 'Yheyson Calderon', co_zon: '01', zona: 'Puerto Cabello', meta_litros_mes: 4500, comision_pct: 4 },
    { id: 'CB', co_ven: 'CB', ven_des: 'Carlos Becerra', co_zon: '' },
    { id: 'FS', co_ven: 'FS', ven_des: 'Freddy Sepulveda', co_zon: '' },
    { id: 'RB', co_ven: 'RB', ven_des: 'Rosibel Briceño', foto: 'data:image/jpeg;base64,FOTO_COBRANZA' },
    { id: 'RBR', co_ven: 'RBR', ven_des: 'Rosibel Briceño ventas', co_zon: '08', zona: 'Valencia Sur' }
  ];

  const result = buildSalesDepartmentSellers(sampleUsers, sampleProfitSellers);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((s) => s.coVen), ['YC', 'RBR']);
  assert.equal(result.some((s) => s.coVen === 'RB' || s.coVen === 'CB' || s.coVen === 'FS'), false);

  const yc = result.find((s) => s.coVen === 'YC');
  assert.equal(yc.venDes, 'Yheyson Calderón');
  assert.equal(yc.coZon, '01');
  assert.equal(yc.metaLitrosMes, 4500);

  const rbr = result.find((s) => s.coVen === 'RBR');
  assert.equal(rbr.venDes, 'Rosibel Briceño ventas');
  assert.equal(rbr.username, 'rosibelventas');
  assert.equal(rbr.coZon, '08');

  // Caso homónimo: Rosibel de Ventas sin co_ven y mismo nombre que Rosibel de Cobranza
  const sameNameResult = buildSalesDepartmentSellers(
    [
      { id: 'usr-mvgse4to', username: 'rosibelcxc', nombre: 'Rosibel Briceño', rol: 'COBRANZA', departamento: 'ADM', co_ven: null, activo: true, foto: 'data:image/jpeg;base64,FOTO_COBRANZA' },
      { id: 'usr-mwnr2mt6', username: 'rosibelventas', nombre: 'Rosibel Briceño', rol: 'VENTAS', departamento: 'VEN', co_ven: null, activo: true, foto: '' }
    ],
    [{ id: 'RB', co_ven: 'RB', ven_des: 'Rosibel Briceño', foto: 'data:image/jpeg;base64,FOTO_COBRANZA' }]
  );
  assert.equal(sameNameResult.length, 1);
  assert.equal(sameNameResult[0].username, 'rosibelventas');
  assert.equal(sameNameResult[0].departamento, 'VEN');
  assert.equal(sameNameResult[0].foto, '');
});

// 11. Liberación persistente de zona de vendedor (no restaura zona legacy de REAL_PROFIT_SELLERS) y reasignación inmediata
{
  const memStore = new Map();
  const prevStorage = globalThis.localStorage;
  const prevFetch = globalThis.fetch;
  globalThis.localStorage = {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => { memStore.set(k, String(v)); },
    removeItem: (k) => { memStore.delete(k); },
    clear: () => { memStore.clear(); }
  };
  globalThis.fetch = async () => { throw new Error('offline-test'); };

  try {
    // Sembrar YC con Zona 01 (igual que REAL_PROFIT_SELLERS) y RBR sin zona
    globalThis.localStorage.setItem('sm_sellers_v4_native', JSON.stringify([
      { id: 'YC', coVen: 'YC', co_ven: 'YC', venDes: 'Yheyson Calderón', coZon: '01', co_zon: '01', zona: 'Mun. Pto. Cabello - Juan José Mora' },
      { id: 'RBR', coVen: 'RBR', co_ven: 'RBR', venDes: 'Rosibel Briceño ventas', coZon: '', co_zon: '', zona: '' }
    ]));

    // 1. Liberar la zona de YC
    const released = await updateSupabaseSellerZone('YC', { coZon: '', zona: '' });
    assert.equal(released.coZon, '');
    assert.equal(released.zona, '');

    // 2. Verificar que getSupabaseProfitSellers NO resucita la Zona 01 desde REAL_PROFIT_SELLERS
    const sellersAfterRelease = await getSupabaseProfitSellers();
    const ycAfterRelease = sellersAfterRelease.find((s) => s.coVen === 'YC');
    assert.ok(ycAfterRelease, 'YC debe existir en profit_sellers');
    assert.equal(ycAfterRelease.coZon, '', 'Al liberar zona de YC no debe restaurarse 01 desde fallback');
    assert.equal(ycAfterRelease.zona, '', 'La descripción de zona de YC debe quedar vacía tras liberar');

    // 3. Reasignar la Zona 01 liberada a RBR y validar persistencia
    const reassigned = await updateSupabaseSellerZone('RBR', { coZon: '01', zona: 'Mun. Pto. Cabello - Juan José Mora' });
    assert.equal(reassigned.coZon, '01');
    const sellersAfterReassign = await getSupabaseProfitSellers();
    const rbrAfterReassign = sellersAfterReassign.find((s) => s.coVen === 'RBR');
    assert.equal(rbrAfterReassign?.coZon, '01');
    assert.equal(rbrAfterReassign?.zona, 'Mun. Pto. Cabello - Juan José Mora');

    passed += 1;
    console.log('  ✔ 11. Liberación persistente de zona de vendedor sin regresión de fallback y reasignación inmediata');
  } finally {
    globalThis.localStorage = prevStorage;
    globalThis.fetch = prevFetch;
  }
}

console.log(`\nResultado commissionFlow.test.js: ${passed} pruebas aprobadas.`);
if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
