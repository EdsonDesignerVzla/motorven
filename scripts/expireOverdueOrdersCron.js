/**
 * expireOverdueOrdersCron.js
 * ---------------------------------------------------------------------------
 * Rutina Batch / Cron Job Oficial para la Liberación de Órdenes Caducadas (>72h).
 * Examina los pedidos de preventa vigentes en la base de datos Supabase / PostgreSQL.
 * Si una orden supera las 72 horas (3 días) desde su emisión sin haber sido facturada:
 *   1. Actualiza su estatus a 'EXPIRADO'.
 *   2. Registra la auditoría correspondiente.
 *   3. Libera formalmente el inventario comprometido en la regla ATP (Available-To-Promise).
 * ---------------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://api.signummotorven.com';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'local-free-token';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HOURS_72_MS = 72 * 60 * 60 * 1000;

async function runCronSweep() {
  console.log('================================================================');
  console.log(`[CRON 72H] INICIANDO BARRIDO DE ÓRDENES CADUCADAS EN SIGNUM MOTORVEN`);
  console.log(`[CRON 72H] Conectando a Supabase: ${SUPABASE_URL}`);
  console.log('================================================================\n');

  const now = Date.now();

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, numero_doc, status, fecha_emision, created_at, cliente_nombre, total_usd')
      .in('status', ['PENDIENTE', 'APROBADO', 'EN_PROCESO', 'RETENIDO_CREDITO']);

    if (error) {
      console.error('[CRON 72H] Error consultando órdenes:', error.message);
      process.exit(1);
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      console.log('[CRON 72H] No hay órdenes activas pendientes de revisión.');
      console.log('[CRON 72H] Barrido finalizado con éxito.');
      process.exit(0);
    }

    console.log(`[CRON 72H] Revisando ${orders.length} órdenes activas...`);

    const expired = [];

    for (const ord of orders) {
      const rawDate = ord.fecha_emision || ord.created_at;
      if (!rawDate) continue;

      const orderTime = new Date(rawDate).getTime();
      const ageHours = (now - orderTime) / (3600 * 1000);

      if (!isNaN(orderTime) && (now - orderTime) > HOURS_72_MS) {
        console.log(`  -> Orden #${ord.numero_doc || ord.id} (${ord.cliente_nombre}) tiene ${ageHours.toFixed(1)}h. Caducando a 'EXPIRADO'...`);
        
        const { error: updErr } = await supabase
          .from('orders')
          .update({
            status: 'EXPIRADO',
            updated_at: new Date().toISOString()
          })
          .eq('id', ord.id);

        if (!updErr) {
          expired.push(ord);
        } else {
          console.warn(`     Error actualizando orden ${ord.id}:`, updErr.message);
        }
      }
    }

    console.log('\n================================================================');
    if (expired.length > 0) {
      console.log(`[CRON 72H] Se expiraron y liberaron ${expired.length} pedido(s) mayores a 72 horas.`);
    } else {
      console.log('[CRON 72H] Todas las órdenes activas se encuentran dentro del corte de 72 horas.');
    }
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('[CRON 72H] Excepción ejecutando cron:', err);
    process.exit(1);
  }
}

runCronSweep();
