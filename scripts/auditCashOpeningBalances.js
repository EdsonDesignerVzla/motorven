/**
 * Auditoría de Saldos Iniciales de Cajas y Bancos — SIGNUM MOTORVEN
 *
 * Uso:
 *   node scripts/auditCashOpeningBalances.js
 *     -> Escanea supabase/backups/ + supabase/local_database.json (o ./backups si se corre en SVR-MOTORVEN)
 *
 *   node scripts/auditCashOpeningBalances.js --dir="C:\ruta\al\servidor\backups"
 *     -> Escanea una carpeta específica de respaldos local_database_*.json
 *
 *   node scripts/auditCashOpeningBalances.js --remote
 *   node scripts/auditCashOpeningBalances.js --url=https://api.signummotorven.com
 *     -> Consulta directamente GET /api/treasury/opening-balances-history en el servidor de la empresa
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (prefix) => {
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
};

const isRemote = args.includes('--remote') || Boolean(getArg('--url='));
const remoteBase = (getArg('--url=') || 'https://api.signummotorven.com').replace(/\/+$/, '');
const customDir = getArg('--dir=');
const includeBanks = args.includes('--bancos') || args.includes('--all');

const formatVe = (iso) => {
  if (!iso) return 'N/A';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  return dt.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const fmtUsd = (n) => `$ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtBs = (n) => `Bs. ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function scanLocalBackups() {
  const candidates = [
    customDir ? path.resolve(customDir) : null,
    path.join(projectRoot, 'supabase', 'backups'),
    path.join(process.cwd(), 'backups')
  ].filter(Boolean);

  const backupDir = candidates.find((d) => fs.existsSync(d)) || candidates[0];
  const dbCandidates = [
    customDir ? path.join(path.dirname(path.resolve(customDir)), 'local_database.json') : null,
    path.join(projectRoot, 'supabase', 'local_database.json'),
    path.join(process.cwd(), 'local_database.json')
  ].filter(Boolean);
  const dbFile = dbCandidates.find((f) => fs.existsSync(f)) || null;

  const files = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir)
        .filter((f) => f.endsWith('.json') && /^local_database/i.test(f))
        .map((f) => {
          const fullPath = path.join(backupDir, f);
          const mtimeIso = fs.statSync(fullPath).mtime.toISOString();
          const m = f.match(/(\d{4}-\d{2}-\d{2})(?:_(\d{2}-\d{2}-\d{2}))?/);
          const sortKey = m ? `${m[1]}_${m[2] || '23-59-59'}` : mtimeIso;
          return { file: f, fullPath, sortKey, mtimeIso };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    : [];

  const cashMap = new Map();
  const bankMap = new Map();

  const ingest = (map, kind, row, sourceLabel, fallbackTs) => {
    if (!row || typeof row !== 'object') return;
    const code = kind === 'CAJA'
      ? String(row.co_caja || row.coCaja || row.id || '').trim().toUpperCase()
      : String(row.cod_cta || row.codCta || row.id || '').trim().toUpperCase();
    if (!code) return;
    const desc = kind === 'CAJA'
      ? String(row.descripcion || row.des_caja || row.desCaja || code).trim()
      : String(row.banco_nombre || row.bancoNombre || row.des_ban || code).trim();
    const saldoUsd = Number((Number(row.saldo_usd ?? row.saldoUsd ?? 0) || 0).toFixed(2));
    const saldoBs = Number((Number(row.saldo_bs ?? row.saldoBs ?? 0) || 0).toFixed(2));
    const fechaActualizacion = row.fecha_actualizacion || row.fechaActualizacion || fallbackTs || null;
    const saldoInicialUsd = row.saldo_inicial_usd ?? row.saldoInicialUsd ?? null;
    const saldoInicialBs = row.saldo_inicial_bs ?? row.saldoInicialBs ?? null;
    const fechaSaldoInicial = row.fecha_saldo_inicial || row.fechaSaldoInicial || null;
    const usuarioSaldoInicial = row.usuario_saldo_inicial || row.usuarioSaldoInicial || null;

    if (!map.has(code)) {
      map.set(code, {
        code,
        descripcion: desc,
        moneda: String(row.moneda || (kind === 'CAJA' ? 'USD' : 'BS')).toUpperCase(),
        timeline: []
      });
    }
    const entry = map.get(code);
    entry.descripcion = desc;
    const prev = entry.timeline[entry.timeline.length - 1];
    if (
      !prev
      || prev.saldoUsd !== saldoUsd
      || prev.saldoBs !== saldoBs
      || prev.fechaActualizacion !== fechaActualizacion
      || (prev.fechaSaldoInicial || null) !== (fechaSaldoInicial || null)
      || (prev.saldoInicialUsd ?? null) !== (saldoInicialUsd ?? null)
      || (prev.saldoInicialBs ?? null) !== (saldoInicialBs ?? null)
    ) {
      entry.timeline.push({
        source: sourceLabel,
        saldoUsd,
        saldoBs,
        fechaActualizacion,
        ...(fechaSaldoInicial || saldoInicialUsd !== null
          ? { saldoInicialUsd, saldoInicialBs, fechaSaldoInicial, usuarioSaldoInicial }
          : {})
      });
    }
  };

  for (const item of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(item.fullPath, 'utf8'));
      (parsed.profit_cash_desks || []).forEach((d) => ingest(cashMap, 'CAJA', d, item.file, item.mtimeIso));
      (parsed.profit_bank_accounts || []).forEach((b) => ingest(bankMap, 'BANCO', b, item.file, item.mtimeIso));
    } catch (_) {}
  }

  let liveDb = null;
  if (dbFile) {
    liveDb = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const liveMtime = fs.statSync(dbFile).mtime.toISOString();
    (liveDb.profit_cash_desks || []).forEach((d) => ingest(cashMap, 'CAJA', d, 'LIVE_CURRENT', liveMtime));
    (liveDb.profit_bank_accounts || []).forEach((b) => ingest(bankMap, 'BANCO', b, 'LIVE_CURRENT', liveMtime));
  }

  const finalize = (map, currentRows, kind) => {
    const byCode = new Map();
    (currentRows || []).forEach((r) => {
      const c = kind === 'CAJA'
        ? String(r.co_caja || r.coCaja || r.id || '').trim().toUpperCase()
        : String(r.cod_cta || r.codCta || r.id || '').trim().toUpperCase();
      if (c) byCode.set(c, r);
    });
    return Array.from(map.values()).map((item) => {
      const cur = byCode.get(item.code) || null;
      const detectedOpening = item.timeline.find(
        (t) => (t.saldoUsd !== 0 || t.saldoBs !== 0) && (!t.fechaActualizacion || String(t.fechaActualizacion) > '2026-11-10T21:00:00Z')
      ) || item.timeline.find((t) => t.saldoUsd !== 0 || t.saldoBs !== 0) || item.timeline[0] || null;

      const explicitOpening = cur && (cur.fecha_saldo_inicial || cur.fechaSaldoInicial || cur.saldo_inicial_usd !== undefined || cur.saldoInicialUsd !== undefined)
        ? {
            saldoInicialUsd: cur.saldo_inicial_usd ?? cur.saldoInicialUsd ?? 0,
            saldoInicialBs: cur.saldo_inicial_bs ?? cur.saldoInicialBs ?? 0,
            fechaSaldoInicial: cur.fecha_saldo_inicial || cur.fechaSaldoInicial || null,
            usuarioSaldoInicial: cur.usuario_saldo_inicial || cur.usuarioSaldoInicial || null
          }
        : null;

      return {
        ...item,
        activeInCurrent: Boolean(cur),
        current: cur
          ? {
              saldoUsd: Number((Number(cur.saldo_usd ?? cur.saldoUsd ?? 0) || 0).toFixed(2)),
              saldoBs: Number((Number(cur.saldo_bs ?? cur.saldoBs ?? 0) || 0).toFixed(2)),
              fechaActualizacion: cur.fecha_actualizacion || cur.fechaActualizacion || null
            }
          : null,
        explicitOpening,
        detectedOpening
      };
    }).sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
  };

  return {
    sourceMode: 'LOCAL_DISK',
    backupDir,
    dbFile: dbFile || 'N/A',
    backupsScanned: files.length,
    cashDesks: finalize(cashMap, liveDb?.profit_cash_desks || [], 'CAJA'),
    bankAccounts: finalize(bankMap, liveDb?.profit_bank_accounts || [], 'BANCO')
  };
}

function printReport(data) {
  console.log('\n====================================================================');
  console.log('  AUDITORÍA DE SALDOS INICIALES DE CAJAS — SIGNUM MOTORVEN');
  console.log('====================================================================');
  console.log(`Origen:             ${data.sourceMode || 'SERVIDOR REMOTO'}`);
  console.log(`Carpeta respaldos:  ${data.backupDir || 'N/A'}`);
  console.log(`Respaldos leídos:   ${data.backupsScanned ?? 0}`);
  console.log('--------------------------------------------------------------------');

  for (const desk of (data.cashDesks || [])) {
    console.log(`\n[${desk.code}] ${desk.descripcion} (${desk.moneda})${desk.activeInCurrent ? '' : ' [ELIMINADA]'}`);
    if (desk.explicitOpening) {
      console.log(`  ★ Saldo Inicial FIJADO:   ${fmtUsd(desk.explicitOpening.saldoInicialUsd)} | ${fmtBs(desk.explicitOpening.saldoInicialBs)}`);
      console.log(`    Fecha/Hora Apertura:    ${formatVe(desk.explicitOpening.fechaSaldoInicial)} | Usuario: ${desk.explicitOpening.usuarioSaldoInicial || 'N/A'}`);
    } else if (desk.detectedOpening) {
      console.log(`  • 1er Saldo Detectado:    ${fmtUsd(desk.detectedOpening.saldoUsd)} | ${fmtBs(desk.detectedOpening.saldoBs)}`);
      console.log(`    Fecha/Hora (VET):       ${formatVe(desk.detectedOpening.fechaActualizacion)} (Archivo: ${desk.detectedOpening.source})`);
    }
    if (desk.current) {
      console.log(`  • Saldo ACTUAL en BD:     ${fmtUsd(desk.current.saldoUsd)} | ${fmtBs(desk.current.saldoBs)}`);
      console.log(`    Última actualización:   ${formatVe(desk.current.fechaActualizacion)}`);
    }
    console.log('  • Línea de tiempo de cambios:');
    for (const snap of (desk.timeline || [])) {
      console.log(`      - ${formatVe(snap.fechaActualizacion)} | ${fmtUsd(snap.saldoUsd)} | ${fmtBs(snap.saldoBs)}  [${snap.source}]`);
    }
  }

  if (includeBanks && Array.isArray(data.bankAccounts)) {
    console.log('\n--------------------------------------------------------------------');
    console.log('  CUENTAS BANCARIAS');
    console.log('--------------------------------------------------------------------');
    for (const bank of data.bankAccounts) {
      console.log(`\n[CTA-${bank.code}] ${bank.descripcion} (${bank.moneda})`);
      if (bank.explicitOpening) {
        console.log(`  ★ Saldo Inicial FIJADO:   ${fmtBs(bank.explicitOpening.saldoInicialBs)} | ${fmtUsd(bank.explicitOpening.saldoInicialUsd)} (${formatVe(bank.explicitOpening.fechaSaldoInicial)})`);
      } else if (bank.detectedOpening) {
        console.log(`  • 1er Saldo Detectado:    ${fmtBs(bank.detectedOpening.saldoBs)} | ${fmtUsd(bank.detectedOpening.saldoUsd)} (${formatVe(bank.detectedOpening.fechaActualizacion)})`);
      }
      if (bank.current) {
        console.log(`  • Saldo ACTUAL en BD:     ${fmtBs(bank.current.saldoBs)} | ${fmtUsd(bank.current.saldoUsd)} (${formatVe(bank.current.fechaActualizacion)})`);
      }
    }
  }
  console.log('\n====================================================================\n');
}

async function main() {
  if (isRemote) {
    const url = `${remoteBase}/api/treasury/opening-balances-history`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        apikey: 'local-free-token',
        Authorization: 'Bearer local-free-token'
      }
    });
    if (!res.ok) {
      throw new Error(`El servidor respondió HTTP ${res.status} en ${url}. Asegúrate de reiniciar SVR-MOTORVEN para activar la nueva ruta.`);
    }
    const data = await res.json();
    printReport({ ...data, sourceMode: `REMOTO (${remoteBase})` });
    return;
  }

  const localReport = scanLocalBackups();
  printReport(localReport);
}

main().catch((err) => {
  console.error('[auditCashOpeningBalances] Error:', err.message);
  process.exit(1);
});
