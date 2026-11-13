import assert from 'node:assert/strict';
import {
  parseInvoiceDateInfo,
  formatInvoiceDateTimeDisplay,
  preserveDateWithTime,
  toLocalYmd,
  formatDateVe
} from '../services/creditPolicyService.js';

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

console.log('--- TODAS LAS PRUEBAS DE FECHA/HORA DE FACTURAS PASARON AL 100% ---');
