import assert from 'node:assert/strict';
import {
  parseInvoiceDateInfo,
  formatInvoiceDateTimeDisplay,
  preserveDateWithTime,
  toLocalYmd,
  formatDateVe
} from '../services/creditPolicyService.js';
import {
  SYSTEM_START_DATE,
  SYSTEM_START_MONTH,
  createDefaultDatePeriodFilter,
  extractLocalYmd,
  normalizeDateRange,
  isDatePeriodFilterActive,
  isOnOrAfterDate,
  isOnOrAfterSystemStart,
  filterRecordsFromSystemStart,
  clampDateToSystemStart,
  matchesDatePeriodFilter,
  formatDatePeriodLabel
} from '../utils/dateRangeFilterUtils.js';
import { reconcileClientsWithRealCxc } from '../utils/cxcUtils.js';

console.log('--- INICIANDO PRUEBAS DE FECHA/HORA Y FILTROS DE FACTURAS ---');

// 1. Timestamp real completo no debe perder su hora ni día
{
  const realIso = '2026-11-10T18:45:22.000Z';
  const info = parseInvoiceDateInfo({ fechaEmision: realIso, fec_emis: realIso });
  assert.equal(info.hasTime, true, 'Debe conservar hasTime=true para ISO con hora real');
  assert.equal(info.fullIso, realIso, 'Debe conservar el timestamp exacto ISO');
  const display = formatInvoiceDateTimeDisplay({ fechaEmision: realIso });
  assert.ok(!display.includes('8:00 p.') && !display.includes('20:00'), `Hora real no debe mostrarse como 8:00 p. m.: ${display}`);
  console.log('  ✓ Timestamp ISO completo conservado sin alteración:', display);
}

// 2. Fecha truncada YYYY-MM-DD de noviembre con updated_at real debe reconstruir la hora real sin retroceder al día anterior
{
  const inv = {
    fec_emis: '2026-11-10',
    fechaEmision: '2026-11-10',
    updated_at: '2026-11-10T15:27:41.000Z'
  };
  const info = parseInvoiceDateInfo(inv);
  assert.equal(info.hasTime, true, 'Debe recuperar hasTime=true desde updated_at');
  assert.equal(info.isoDateOnly, '2026-11-10', 'No debe retroceder al 2026-11-09');
  const expectedRef = new Date('2026-11-10T15:27:41.000Z');
  assert.equal(info.date.getHours(), expectedRef.getHours(), 'Debe conservar la hora exacta de updated_at');
  assert.equal(info.date.getMinutes(), expectedRef.getMinutes(), 'Debe conservar los minutos exactos de updated_at');
  console.log('  ✓ Recuperación de hora real de creación para factura Nov 2026:', formatInvoiceDateTimeDisplay(inv));
}

// 3. Fecha medianoche UTC (T00:00:00.000Z) histórica de lote Profit (batch 2026-10-27T20:12) no debe mostrar 8:00 p. m. del día anterior
{
  const historicalInv = {
    fec_emis: '2026-09-15T00:00:00.000Z',
    updated_at: '2026-10-27T20:12:05.123Z'
  };
  const info = parseInvoiceDateInfo(historicalInv);
  assert.equal(info.hasTime, false, 'Importación histórica en lote no debe mostrar hora falsa');
  assert.equal(info.isoDateOnly, '2026-09-15', 'Debe mantener el día exacto 15/09/2026');
  const veDate = formatDateVe(historicalInv.fec_emis);
  assert.ok(veDate.includes('15'), `formatDateVe debe mostrar día 15, obtenido: ${veDate}`);
  const disp = formatInvoiceDateTimeDisplay(historicalInv);
  assert.ok(!disp.includes('8:00'), `No debe mostrar 8:00 p. m. falso: ${disp}`);
  console.log('  ✓ Registro histórico sin hora falsa 8:00 p. m. y fecha exacta:', disp, '|', veDate);
}

// 4. preserveDateWithTime mantiene fecha elegida + hora del momento/referencia
{
  const ref = '2026-11-12T16:10:33.000Z';
  const combinedIso = preserveDateWithTime('2026-11-12', ref);
  const parsed = new Date(combinedIso);
  const refDate = new Date(ref);
  assert.equal(toLocalYmd(parsed), '2026-11-12', 'Debe conservar fecha YYYY-MM-DD local');
  assert.equal(parsed.getHours(), refDate.getHours(), 'Debe conservar hora de referencia');
  assert.equal(parsed.getMinutes(), refDate.getMinutes(), 'Debe conservar minutos de referencia');
  const passthrough = preserveDateWithTime('2026-11-12T19:05:11.000Z', ref);
  assert.equal(passthrough, '2026-11-12T19:05:11.000Z', 'ISO completo existente se preserva intacto');
  console.log('  ✓ preserveDateWithTime verificado correctamente:', combinedIso);
}

// 5. Filtro uniforme por Fecha Exacta y Por Período (dateRangeFilterUtils)
{
  const def = createDefaultDatePeriodFilter('EXACT');
  assert.equal(def.mode, 'EXACT');
  assert.equal(isDatePeriodFilterActive(def), false);
  assert.equal(matchesDatePeriodFilter('2026-11-18', def), true);

  assert.equal(extractLocalYmd('2026-10-05T00:00:00.000Z'), '2026-10-05', 'Medianoche UTC no debe retroceder al día anterior');
  assert.equal(extractLocalYmd('18/11/2026'), '2026-11-18', 'Formato DD/MM/YYYY debe convertirse a YYYY-MM-DD');
  assert.equal(extractLocalYmd('2026-11-18T14:30:00.000Z'), toLocalYmd(new Date('2026-11-18T14:30:00.000Z')));
  assert.equal(extractLocalYmd(new Date(2026, 10, 18, 12, 0, 0)), '2026-11-18');

  assert.deepEqual(
    normalizeDateRange('2026-11-18', '2026-11-01'),
    { minDate: '2026-11-01', maxDate: '2026-11-18' },
    'Rango invertido debe ordenarse cronológicamente'
  );
  assert.deepEqual(
    normalizeDateRange('2026-11-05', ''),
    { minDate: '2026-11-05', maxDate: '' }
  );

  const exactFilter = { mode: 'EXACT', exactDate: '2026-11-18', fromDate: '', toDate: '' };
  assert.equal(isDatePeriodFilterActive(exactFilter), true);
  assert.equal(matchesDatePeriodFilter('2026-11-18T00:00:00.000Z', exactFilter), true);
  assert.equal(matchesDatePeriodFilter('2026-11-17', exactFilter), false);
  assert.equal(formatDatePeriodLabel(exactFilter), 'Fecha: 18/11/2026');

  const rangeFilter = { mode: 'RANGE', exactDate: '', fromDate: '2026-11-01', toDate: '2026-11-18' };
  assert.equal(isDatePeriodFilterActive(rangeFilter), true);
  assert.equal(matchesDatePeriodFilter('2026-11-01', rangeFilter), true, 'Límite inferior inclusivo');
  assert.equal(matchesDatePeriodFilter('2026-11-10', rangeFilter), true, 'Fecha dentro del período');
  assert.equal(matchesDatePeriodFilter('2026-11-18', rangeFilter), true, 'Límite superior inclusivo');
  assert.equal(matchesDatePeriodFilter('2026-10-31', rangeFilter), false, 'Fuera antes del rango');
  assert.equal(matchesDatePeriodFilter('2026-11-19', rangeFilter), false, 'Fuera después del rango');
  assert.equal(matchesDatePeriodFilter('', rangeFilter), false, 'Fecha vacía no coincide cuando hay filtro activo');
  assert.equal(formatDatePeriodLabel(rangeFilter), 'Período: 01/11/2026 al 18/11/2026');

  const reversedRange = { mode: 'RANGE', exactDate: '', fromDate: '2026-11-18', toDate: '2026-11-01' };
  assert.equal(matchesDatePeriodFilter('2026-11-10', reversedRange), true, 'Rango invertido también filtra correctamente');

  const openStartRange = { mode: 'RANGE', exactDate: '', fromDate: '2026-11-15', toDate: '' };
  assert.equal(matchesDatePeriodFilter('2026-11-14', openStartRange), false);
  assert.equal(matchesDatePeriodFilter('2026-11-18', openStartRange), true);
  assert.equal(formatDatePeriodLabel(openStartRange), 'Desde: 15/11/2026');

  const emptyRange = { mode: 'RANGE', exactDate: '', fromDate: '', toDate: '' };
  assert.equal(isDatePeriodFilterActive(emptyRange), false);
  assert.equal(matchesDatePeriodFilter('2026-01-01', emptyRange), true);

  assert.equal(isOnOrAfterDate('2026-11-09', '2026-11-10'), false, 'Fecha anterior al 10/11 queda excluida');
  assert.equal(isOnOrAfterDate('2026-11-10', '2026-11-10'), true, 'Fecha exacta 10/11 queda incluida');
  assert.equal(isOnOrAfterDate('2026-11-21T00:00:00Z', '2026-11-10'), true, 'Fecha posterior en UTC medianoche queda incluida');
  assert.equal(isOnOrAfterDate('28/9/2026', '2026-11-10'), false, 'Fecha dd/mm/yyyy de septiembre queda excluida');
  assert.equal(isOnOrAfterDate('', '2026-11-10'), false, 'Fecha vacía queda excluida cuando hay corte');

  console.log('  ✓ dateRangeFilterUtils (Fecha Exacta y Por Período) verificado al 100%');
}

// 6. Corte global del sistema a partir del 01/11/2026 (SYSTEM_START_DATE)
{
  assert.equal(SYSTEM_START_DATE, '2026-11-01');
  assert.equal(SYSTEM_START_MONTH, '2026-11');

  assert.equal(isOnOrAfterSystemStart('2026-10-31'), false, '31/10/2026 debe quedar excluido');
  assert.equal(isOnOrAfterSystemStart('31/10/2026'), false, '31/10/2026 DD/MM/YYYY debe quedar excluido');
  assert.equal(isOnOrAfterSystemStart('2026-10-31T23:59:59.000Z'), false, '31/10/2026 UTC debe quedar excluido');
  assert.equal(isOnOrAfterSystemStart('2026-11-01'), true, '01/11/2026 debe quedar incluido');
  assert.equal(isOnOrAfterSystemStart('2026-11-01T00:00:00.000Z'), true, '01/11/2026 medianoche UTC debe quedar incluido');
  assert.equal(isOnOrAfterSystemStart('01/11/2026'), true, '01/11/2026 DD/MM/YYYY debe quedar incluido');
  assert.equal(isOnOrAfterSystemStart(''), false, 'Sin fecha debe quedar excluido');

  assert.equal(clampDateToSystemStart('2026-09-15'), '2026-11-01');
  assert.equal(clampDateToSystemStart('2026-11-18'), '2026-11-18');
  assert.equal(clampDateToSystemStart(''), '2026-11-01');

  const mixedRecords = [
    { id: 'old-inv', fechaEmision: '2026-10-31' },
    { id: 'old-col', fec_cob: '2026-08-15T00:00:00.000Z' },
    { id: 'old-pay', fec_pago: '2026-10-20' },
    { id: 'old-islr', periodoFiscal: '202610' },
    { id: 'nov01-inv', fechaEmision: '2026-11-01T00:00:00.000Z' },
    { id: 'nov05-pay', fec_pago: '2026-11-05' },
    { id: 'nov10-pur', fechaCompra: '2026-11-10' },
    { id: 'nov-islr', periodoFiscal: '2026-11' }
  ];
  const filtered = filterRecordsFromSystemStart(mixedRecords);
  assert.deepEqual(
    filtered.map(r => r.id),
    ['nov01-inv', 'nov05-pay', 'nov10-pur', 'nov-islr'],
    'Solo registros >= 2026-11-01 deben permanecer visibles/calculables'
  );

  // Reconciliación forzada cuando todas las facturas eran previas a Nov 2026
  const reconciled = reconcileClientsWithRealCxc({
    clients: [{ id: 'CLI-1', nombre: 'Cliente Viejo', rif: 'J-11111111-1', saldoDeudorUsd: 500 }],
    profitInvoices: [],
    sales: [],
    tasaBcv: 900,
    forceReconcileEmpty: true
  });
  assert.equal(reconciled.clients[0].saldoDeudorUsd, 0, 'Saldo previo a Nov debe quedar en 0 al reconciliar corte');
  assert.equal(reconciled.clients[0]._saldoSyncedFromCxc, true);

  console.log('  ✓ Corte global desde 01/11/2026 y reconciliación CxC verificados al 100%');
}

console.log('--- TODAS LAS PRUEBAS DE FECHA/HORA DE FACTURAS PASARON AL 100% ---');
