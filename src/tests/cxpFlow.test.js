import assert from 'node:assert/strict';
import {
  normalizeProviderRif,
  normalizeProviderName,
  doProvidersMatch,
  buildCxpCompositeKey,
  dedupePayablesList,
  dedupeSupplierPaymentsList,
  doesPayableMatchDocument,
  doesSupplierPaymentMatchPayable
} from '../utils/cxpUtils.js';
import {
  CXP_CUSTOM_DOCS_KEY,
  CXP_DELETED_DOCS_KEY,
  CXP_PAYMENTS_KEY,
  getScopedCxpDeleteKeys,
  applyLocalCxpOverridesToPayables,
  deleteProfitAccountsPayableDirect,
  getSupabaseProfitAccountsPayable,
  getSupabaseProfitSupplierPayments,
  saveSupabaseProfitSupplierPayment,
  supabase
} from '../services/supabaseService.js';
import {
  enqueueSyncAction,
  flushSyncQueue,
  clearSyncQueue
} from '../services/offlineSyncService.js';

const resetState = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  clearSyncQueue();
};

console.log('--- INICIANDO PRUEBAS CXP, SINCRONIZACIÓN Y NO-COLISIÓN ---');

// 1. Colisión por nroDoc compartido ("1") entre distintos proveedores
resetState();
{
  const docProvA = {
    id: 'CXP-FACT-1-J301112223',
    tipoDoc: 'FACT',
    nroDoc: '1',
    coProv: 'J-30111222-3',
    provRif: 'J-30111222-3',
    provNombre: 'Lubricantes A C.A.',
    saldoUsd: 500
  };
  const docProvB = {
    id: 'CXP-FACT-1-J409998881',
    tipoDoc: 'FACT',
    nroDoc: '1',
    coProv: 'J-40999888-1',
    provRif: 'J-40999888-1',
    provNombre: 'Importadora B S.A.',
    saldoUsd: 800
  };

  assert.strictEqual(buildCxpCompositeKey(docProvA), 'FACT|1|J301112223');
  assert.strictEqual(buildCxpCompositeKey(docProvB), 'FACT|1|J409998881');
  assert.strictEqual(doesPayableMatchDocument(docProvA, docProvB), false);

  const delKeysA = getScopedCxpDeleteKeys(docProvA);
  assert.ok(!delKeysA.includes('1'), 'No debe generar clave de eliminación con nroDoc suelto "1"');
  assert.ok(!delKeysA.includes('FACT-1'), 'No debe generar clave de eliminación sin proveedor');

  localStorage.setItem(CXP_DELETED_DOCS_KEY, JSON.stringify(delKeysA));
  const filtered = applyLocalCxpOverridesToPayables([docProvA, docProvB], false);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].provNombre, 'Importadora B S.A.');
  console.log('  ✓ 1. No-colisión por nroDoc ("1") entre proveedores distintos verificada.');
}

// 2. DELETE en servidor no envía clave compuesta "|" ni nro_doc suelto
resetState();
{
  const eqCalls = [];
  const origFrom = supabase.from;
  supabase.from = () => ({
    delete: () => ({
      eq: (col, val) => {
        eqCalls.push([col, val]);
        return Promise.resolve({ error: null });
      }
    })
  });

  try {
    await deleteProfitAccountsPayableDirect({
      id: 'CXP-FACT-1-J301112223',
      keys: ['CXP-FACT-1-J301112223', 'FACT|1|J301112223']
    });
    assert.deepStrictEqual(eqCalls, [['id', 'CXP-FACT-1-J301112223']]);
    console.log('  ✓ 2. DELETE remoto bloquea claves compuestas "|" y envía solo ID real.');
  } finally {
    supabase.from = origFrom;
  }
}

// 3. Normalización RIF/Proveedor y vinculación exacta de pagos por factura
resetState();
{
  assert.strictEqual(normalizeProviderRif(' j-30111222 3 '), 'J301112223');
  assert.strictEqual(normalizeProviderName('  LUBRICANTES   MOTORVEN   C.A. '), 'LUBRICANTES MOTORVEN C.A.');

  const doc1 = { id: 'D1', tipoDoc: 'FACT', nroDoc: '100', provRif: 'J-30111222-3', provNombre: 'Proveedor Uno' };
  const doc2 = { id: 'D2', tipoDoc: 'FACT', nroDoc: '200', provRif: 'J301112223', provNombre: 'PROVEEDOR   UNO' };
  assert.strictEqual(doProvidersMatch(doc1, doc2), true);

  const pagoFactura100 = {
    id: 'PAG-1',
    provRif: 'J301112223',
    provNombre: 'Proveedor Uno',
    descrip: 'Pago FACT #100 - Proveedor Uno',
    documentosAfectados: [{ docId: 'D1', nroDoc: '100', tipoDoc: 'FACT', abonoUsd: 150 }]
  };

  assert.strictEqual(doesSupplierPaymentMatchPayable(pagoFactura100, doc1), true);
  assert.strictEqual(doesSupplierPaymentMatchPayable(pagoFactura100, doc2), false);
  console.log('  ✓ 3. Normalización de RIF/Nombre y cruce pago<->documento sin mezcla verificados.');
}

// 4. Mapeo completo en Supabase (diasCredito, observaciones, documentosAfectados) + purga de huérfanos
resetState();
{
  const origFrom = supabase.from;
  localStorage.setItem(CXP_DELETED_DOCS_KEY, JSON.stringify(['CXP-FACT-99-J301112223']));
  localStorage.setItem(CXP_PAYMENTS_KEY, JSON.stringify([
    { id: 'PAG-OLD-DELETED', pagoNum: 'PAG-OLD-DELETED', montoUsd: 10 },
    { id: 'PAG-PENDING', pagoNum: 'PAG-PENDING', montoUsd: 25, _pendingServerSync: true }
  ]));

  supabase.from = (table) => {
    if (table === 'profit_accounts_payable') {
      return {
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                {
                  id: 'CXP-FACT-10-J301112223',
                  tipo_doc: 'FACT',
                  nro_doc: '10',
                  co_prov: 'J-30111222-3',
                  prov_nombre: 'Prov Test',
                  prov_rif: 'J-30111222-3',
                  fec_emis: '2026-11-10',
                  fec_venc: '2026-11-25',
                  dias_credito: 15,
                  monto_net_usd: 100,
                  monto_net_bs: 90000,
                  saldo_usd: 100,
                  saldo_bs: 90000,
                  observaciones: 'Nota de compra',
                  updated_at: '2026-11-10T10:00:00.000Z'
                }
              ],
              error: null
            })
          })
        })
      };
    }
    if (table === 'profit_supplier_payments') {
      return {
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                {
                  id: 'PAG-SERVER-1',
                  pago_num: 'PAG-SERVER-1',
                  fec_pago: '2026-11-11',
                  co_prov: 'J-30111222-3',
                  prov_nombre: 'Prov Test',
                  prov_rif: 'J-30111222-3',
                  monto_usd: 50,
                  monto_bs: 45000,
                  documentos_afectados: [{ nroDoc: '10', tipoDoc: 'FACT', abonoUsd: 50 }]
                }
              ],
              error: null
            })
          })
        })
      };
    }
    return origFrom(table);
  };

  try {
    const payables = await getSupabaseProfitAccountsPayable();
    assert.strictEqual(payables.length, 1);
    assert.strictEqual(payables[0].diasCredito, 15);
    assert.strictEqual(payables[0].observaciones, 'Nota de compra');

    const prunedDel = JSON.parse(localStorage.getItem(CXP_DELETED_DOCS_KEY) || '[]');
    assert.deepStrictEqual(prunedDel, []);

    const payments = await getSupabaseProfitSupplierPayments();
    const paymentIds = payments.map(p => p.id);
    assert.ok(paymentIds.includes('PAG-SERVER-1'));
    assert.ok(paymentIds.includes('PAG-PENDING'));
    assert.ok(!paymentIds.includes('PAG-OLD-DELETED'));
    console.log('  ✓ 4. Mapeo completo y purga automática de tombstones/pagos huérfanos verificados.');
  } finally {
    supabase.from = origFrom;
  }
}

// 5. Recuperación y flush offline de CxP, Órdenes de Pago, Requisiciones, OC, Recepciones y Compras
resetState();
{
  const called = [];
  localStorage.setItem(CXP_CUSTOM_DOCS_KEY, JSON.stringify({
    'CXP-FACT-77-J123': { id: 'CXP-FACT-77-J123', nroDoc: '77', _pendingServerSync: true }
  }));
  await saveSupabaseProfitSupplierPayment({
    id: 'PAG-OFFLINE-77',
    pagoNum: 'PAG-OFFLINE-77',
    provNombre: 'Prov Offline',
    montoUsd: 40
  }).catch(() => {});

  enqueueSyncAction('profit_payment_order', 'INSERT', { id: 'OP-100', monto: 200 });
  enqueueSyncAction('purchase_requisition', 'INSERT', { id: 'REQ-100' });
  enqueueSyncAction('purchase_order', 'INSERT', { id: 'OC-100' });
  enqueueSyncAction('profit_goods_receipt_note', 'INSERT', { id: 'REC-100' });
  enqueueSyncAction('profit_purchase', 'INSERT', { id: 'COM-100' });

  const mockHandlers = {
    pushProfitAccountsPayableToSupabase: async (d) => { called.push(['cxp', d.id]); },
    pushProfitSupplierPaymentToSupabase: async (d) => { called.push(['pay', d.id]); },
    pushProfitPaymentOrderToSupabase: async (d) => { called.push(['op', d.id]); },
    pushPurchaseRequisitionToSupabase: async (d) => { called.push(['req', d.id]); },
    pushPurchaseOrderToSupabase: async (d) => { called.push(['oc', d.id]); },
    pushGoodsReceiptNoteToSupabase: async (d) => { called.push(['rec', d.id]); },
    pushProfitPurchaseToSupabase: async (d) => { called.push(['com', d.id]); }
  };

  const res = await flushSyncQueue(mockHandlers);
  assert.strictEqual(res.success, true);
  for (const expected of [
    ['cxp', 'CXP-FACT-77-J123'],
    ['op', 'OP-100'],
    ['req', 'REQ-100'],
    ['oc', 'OC-100'],
    ['rec', 'REC-100'],
    ['com', 'COM-100']
  ]) {
    assert.ok(
      called.some(([k, id]) => k === expected[0] && id === expected[1]),
      `Debe haber flusheado ${expected.join(':')}`
    );
  }
  console.log('  ✓ 5. Recuperación y flush offline de entidades CxP y procura verificados.');
}

// 6. Deduplicación CxP sin colisionar entre distintos tipos/proveedores con mismo número
resetState();
{
  const dupPayables = [
    { id: 'DOC-CP-FACT-12-J311153659', tipoDoc: 'FACT', nroDoc: '12', coProv: 'J311153659', saldoUsd: 100, updated_at: '2026-11-10T10:00:00Z' },
    { id: 'DOC-CP-FACT-12-J311153659', tipoDoc: 'FACT', nroDoc: '12', coProv: 'J311153659', saldoUsd: 40, updated_at: '2026-11-12T10:00:00Z' },
    { id: 'DOC-CP-N/DB-12-J311153659', tipoDoc: 'N/DB', nroDoc: '12', coProv: 'J311153659', saldoUsd: 56.66 },
    { id: 'DOC-CP-FACT-12-J999999999', tipoDoc: 'FACT', nroDoc: '12', coProv: 'J999999999', saldoUsd: 220 }
  ];
  const dedupedCxp = dedupePayablesList(dupPayables);
  assert.strictEqual(dedupedCxp.length, 3);
  assert.strictEqual(dedupedCxp[0].saldoUsd, 40);

  const dupPayments = [
    { id: 'PAG-100', pagoNum: '100', coProv: 'J311153659', montoUsd: 50, updated_at: '2026-11-10T10:00:00Z' },
    { id: 'PAG-100', pagoNum: '100', coProv: 'J311153659', montoUsd: 50, updated_at: '2026-11-11T10:00:00Z' },
    { id: 'PAG-101', pagoNum: '101', coProv: 'J311153659', montoUsd: 75 }
  ];
  const dedupedPays = dedupeSupplierPaymentsList(dupPayments);
  assert.strictEqual(dedupedPays.length, 2);
  console.log('  ✓ 6. Deduplicación CxP y pagos a proveedores sin colisión verificada.');
}

console.log('--- TODAS LAS PRUEBAS CXP Y SINCRONIZACIÓN PASARON AL 100% ---');
