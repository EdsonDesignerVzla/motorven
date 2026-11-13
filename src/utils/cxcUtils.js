import {
  getCanonicalDocKey,
  getEraScopedCanonicalDocKey,
  dedupeCanonicalDocs
} from '../services/fiscalService.js';
import { round2 } from '../services/formatService.js';

/**
 * Determina si una factura o nota de entrega está anulada bajo cualquier variante de campo.
 */
export function isCxcInvoiceCancelled(inv) {
  if (!inv || typeof inv !== 'object') return false;
  if (inv.anulada || inv.anulado) return true;
  const st = String(inv.status || inv.estado || '').toUpperCase().trim();
  return st === 'ANULADA' || st === 'ANULADO';
}

/**
 * Infiere el tipo de documento CxC ('NOTA_ENTREGA' o 'FACTURA') sin colisión cruzada.
 */
export function inferCxcDocType(raw) {
  if (!raw || typeof raw !== 'object') {
    const s = String(raw || '').toUpperCase().trim();
    return /^(NE-|NDE-|NE\s*\d)/.test(s) ? 'NOTA_ENTREGA' : 'FACTURA';
  }
  const explicit = String(raw.tipoDoc || raw.tipo_doc || raw.docType || '').toUpperCase().trim();
  if (explicit === 'NOTA_ENTREGA' || explicit === 'N/E' || explicit === 'NE' || explicit === 'NOTA DE ENTREGA') {
    return 'NOTA_ENTREGA';
  }
  if (explicit === 'FACTURA' || explicit === 'FACT' || explicit === 'FAC') {
    return 'FACTURA';
  }
  const idStr = String(raw.id || '').toUpperCase().trim();
  const factStr = String(raw.factNum || raw.fact_num || raw.factura || raw.numeroDoc || raw.numero_doc || '').toUpperCase().trim();
  const origStr = String(raw.pedidoOrigenDoc || raw.pedido_origen_doc || '').toUpperCase().trim();
  if (
    idStr.startsWith('NE-') ||
    idStr.startsWith('NDE-') ||
    factStr.startsWith('NE-') ||
    factStr.startsWith('NDE-') ||
    /^NE\d+/.test(factStr) ||
    origStr.startsWith('PED-NE')
  ) {
    return 'NOTA_ENTREGA';
  }
  return 'FACTURA';
}

/**
 * Genera una clave de override/búsqueda canónica que nunca mezcla FACTURA vs NOTA_ENTREGA.
 */
export function getCxcScopedDocKey(docOrNum, explicitTipoDoc = '') {
  const canon = getCanonicalDocKey(docOrNum, explicitTipoDoc);
  if (canon) return canon;
  if (typeof docOrNum === 'object' && docOrNum !== null) {
    return String(docOrNum.id || docOrNum.factNum || docOrNum.numeroDoc || '').trim();
  }
  return String(docOrNum || '').trim();
}

/**
 * Normaliza los montos USD/Bs de un cobro al guardar, garantizando que montoBs = montoUsd * tasa
 * cuando tasa > 1 y evitando guardar montoBs === montoUsd.
 */
export function normalizeCollectionWriteAmounts({ montoUsd = 0, montoBs = 0, tasa = 1 } = {}) {
  const rawUsd = Number(montoUsd || 0);
  const rawBs = Number(montoBs || 0);
  const safeTasa = Number(tasa || 1) > 0 ? Number(tasa) : 1;
  const cleanUsd = round2(Math.max(0, isNaN(rawUsd) ? 0 : rawUsd));

  if (safeTasa > 1 && cleanUsd > 0) {
    const looksInvalidBs =
      isNaN(rawBs) ||
      rawBs <= 0 ||
      Math.abs(rawBs - cleanUsd) < 0.01;
    const resolvedBs = looksInvalidBs ? round2(cleanUsd * safeTasa) : round2(rawBs);
    return { montoUsd: cleanUsd, montoBs: resolvedBs, tasa: safeTasa };
  }

  return {
    montoUsd: cleanUsd,
    montoBs: round2(Math.max(0, isNaN(rawBs) ? 0 : rawBs)),
    tasa: safeTasa
  };
}

const normalizeRefDigits = (v) =>
  String(v || '')
    .toUpperCase()
    .trim()
    .replace(/^(FAC-|FACT-|NE-|NDE-|NC-|ND-|INV-|DOC-)/i, '')
    .replace(/^0+(?=\d)/, '');

const normalizeClientIdent = (v) =>
  String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

/**
 * Determina si un cobro (profit_collections) aplicó sobre un documento CxC concreto,
 * respetando tipoDoc (FACTURA vs NOTA_ENTREGA) y correlativo.
 */
export function doesCollectionMatchInvoice(collection, invoice) {
  if (!collection || collection.anulado || !invoice) return false;
  const invTipo = inferCxcDocType(invoice);
  const invCanon = getCanonicalDocKey(invoice, invTipo);
  const invNumDigits = normalizeRefDigits(invoice.factNum || invoice.factura || invoice.numeroDoc || invoice.id);
  if (!invNumDigits) return false;

  const docsAfectados = Array.isArray(collection.documentosAfectados)
    ? collection.documentosAfectados
    : (Array.isArray(collection.documentos_afectados) ? collection.documentos_afectados : []);

  if (docsAfectados.length > 0) {
    return docsAfectados.some(da => {
      if (!da || typeof da !== 'object') return false;
      const rawDaTipo = String(da.tipoDoc || da.tipo_doc || '').toUpperCase().trim();
      if (rawDaTipo) {
        const daIsNe = rawDaTipo === 'NOTA_ENTREGA' || rawDaTipo === 'N/E' || rawDaTipo === 'NE';
        if (daIsNe !== (invTipo === 'NOTA_ENTREGA')) return false;
      }
      const daNum = String(da.numDoc || da.factNum || da.numeroDoc || da.num_doc || da.fact_num || '').trim();
      if (!daNum) return false;
      const daCanon = getCanonicalDocKey(daNum, rawDaTipo || invTipo);
      if (invCanon && daCanon) return daCanon === invCanon;
      return normalizeRefDigits(daNum) === invNumDigits;
    });
  }

  // Fallback si el cobro histórico no tiene documentosAfectados estructurados
  if (collection.factNum || collection.fact_num) {
    const colTipo = collection.tipoDoc || collection.tipo_doc || '';
    if (colTipo && inferCxcDocType({ tipoDoc: colTipo }) !== invTipo) return false;
    return getCanonicalDocKey(collection.factNum || collection.fact_num, colTipo || invTipo) === invCanon;
  }

  const invRif = normalizeClientIdent(invoice.rif || invoice.clienteRif);
  const colRif = normalizeClientIdent(collection.clienteRif || collection.cliente_rif);
  const invCliId = normalizeClientIdent(invoice.clienteId);
  const colCliId = normalizeClientIdent(collection.clienteId || collection.cliente_id);
  const clientMatches =
    (invRif && colRif && invRif === colRif) ||
    (invCliId && colCliId && invCliId === colCliId);
  if (!clientMatches) return false;

  const descrip = String(collection.descrip || '').toUpperCase();
  if (!descrip) return false;
  if (descrip.includes('NOTA DE ENTREGA') && invTipo !== 'NOTA_ENTREGA') return false;
  if (descrip.includes('FACTURA FISCAL') && invTipo === 'NOTA_ENTREGA') return false;
  const hashMatches = descrip.match(/#([A-Z0-9-]+)/g) || [];
  return hashMatches.some(tok => normalizeRefDigits(tok.slice(1)) === invNumDigits);
}

/**
 * Consolida la cartera activa por cobrar agrupada por cliente combinando
 * profitInvoices + sales a crédito no duplicadas + perfiles de clients.
 */
export function consolidateClientReceivables({
  clients = [],
  profitInvoices = [],
  sales = [],
  tasaBcv = 827.73,
  includePendingDocs = false
} = {}) {
  const safeRate = Number(tasaBcv) > 0 ? Number(tasaBcv) : 827.73;
  const map = new Map();
  const hoy = new Date();

  const findClientProfile = (rif, coCli, nombre) => {
    const cleanRif = String(rif || '').trim().toUpperCase();
    const cleanCo = String(coCli || '').trim();
    const cleanName = String(nombre || '').trim().toLowerCase();
    return (clients || []).find(c =>
      (cleanRif && String(c.rif || '').trim().toUpperCase() === cleanRif) ||
      (cleanCo && (String(c.id || '').trim() === cleanCo || String(c.codigo || '').trim() === cleanCo)) ||
      (cleanName && String(c.nombre || c.razonSocial || '').trim().toLowerCase() === cleanName)
    ) || {};
  };

  // 1. Clientes con saldoDeudorUsd local explícito (si existiera)
  (clients || []).forEach(c => {
    if (!c) return;
    const coCli = String(c.id || c.codigo || c.co_cli || '').trim();
    const rif = String(c.rif || '').trim().toUpperCase();
    const saldoLocal = Number(c.saldoDeudorUsd ?? c.saldo_deudor_usd ?? c.saldoUsd ?? c.saldo_usd ?? 0);
    if (saldoLocal > 0.01) {
      const key = rif || coCli;
      if (!key) return;
      map.set(key, {
        id: c.id || coCli || key,
        coCli,
        nombre: c.nombre || c.razonSocial || 'Cliente General',
        cliente: c.nombre || c.razonSocial || 'Cliente General',
        rif: c.rif || 'J-00000000-0',
        telefono: c.telefono || c.telefonos || c.phone || '',
        ciudad: c.ciudad || '',
        asesor: c.vendedorAsignado || 'OF',
        vendedorNombre: c.vendedorNombre || c.vendedor || '',
        diasCredito: Number(c.diasCredito || c.dias_credito || c.plazo || 15),
        saldoUsd: round2(saldoLocal),
        facturasCount: 0,
        maxDiasMora: 0,
        diasMora: 0,
        tramo: 'VIGENTE',
        fac: { count: 0, restante: 0 },
        ne: { count: 0, restante: 0 },
        totalMonto: round2(saldoLocal),
        totalAbonos: 0,
        totalRestante: round2(saldoLocal),
        ...(includePendingDocs ? { pendingDocs: [] } : {})
      });
    }
  });

  const seenDocKeys = new Set();

  const integrateDoc = (rawDoc, { monto, abonos, saldo, fechaEmisRaw, fechaVencRaw, tipoDoc, factNum }) => {
    if (saldo <= 0.01) return;
    const rif = String(rawDoc.clienteRif || rawDoc.cliente_rif || rawDoc.rif || '').trim().toUpperCase();
    const coCli = String(rawDoc.clienteId || rawDoc.cliente_id || rawDoc.coCli || rawDoc.co_cli || rawDoc.clienteCod || '').trim();
    const nombreDoc = String(rawDoc.clienteNombre || rawDoc.cliente_nombre || rawDoc.cli_des || rawDoc.cliente || '').trim();
    const key = rif || coCli || (nombreDoc ? `NAME:${nombreDoc.toUpperCase()}` : '');
    if (!key) return;

    const fEmis = fechaEmisRaw ? new Date(fechaEmisRaw) : hoy;
    const fVenc = fechaVencRaw ? new Date(fechaVencRaw) : fEmis;
    const validVenc = !isNaN(fVenc.getTime()) ? fVenc : hoy;
    const diasVencido = Math.max(0, Math.floor((hoy - validVenc) / (1000 * 60 * 60 * 24)));
    const tramoDoc = diasVencido > 30 ? 'OVER_30' : diasVencido > 15 ? '16_30' : diasVencido > 7 ? '8_15' : diasVencido > 0 ? '1_7' : 'VIGENTE';
    const isNe = tipoDoc === 'NOTA_ENTREGA';

    const docSummary = includePendingDocs
      ? {
          id: rawDoc.id || factNum,
          factNum,
          tipoDoc,
          fechaEmision: fechaEmisRaw || '',
          fechaVencimiento: fechaVencRaw || '',
          diasVencido,
          montoUsd: round2(monto),
          abonosUsd: round2(abonos),
          saldoUsd: round2(saldo)
        }
      : null;

    if (!map.has(key)) {
      const clientProfile = findClientProfile(rif, coCli, nombreDoc);
      const resolvedNombre = nombreDoc || clientProfile.nombre || clientProfile.razonSocial || 'Cliente General';
      map.set(key, {
        id: clientProfile.id || coCli || key,
        coCli: coCli || clientProfile.codigo || '',
        nombre: resolvedNombre,
        cliente: resolvedNombre,
        rif: rif || clientProfile.rif || 'J-00000000-0',
        telefono: clientProfile.telefono || clientProfile.telefonos || clientProfile.phone || rawDoc.clienteTelefono || '',
        ciudad: clientProfile.ciudad || '',
        asesor: rawDoc.vendedorId || rawDoc.co_ven || clientProfile.vendedorAsignado || 'OF',
        vendedorNombre: rawDoc.vendedorNombre || rawDoc.vendedor || clientProfile.vendedorNombre || '',
        diasCredito: Number(rawDoc.diasCredito ?? rawDoc.dias_credito ?? clientProfile.diasCredito ?? 15),
        saldoUsd: round2(saldo),
        facturasCount: 1,
        maxDiasMora: diasVencido,
        diasMora: diasVencido,
        tramo: tramoDoc,
        fac: isNe ? { count: 0, restante: 0 } : { count: 1, restante: round2(saldo) },
        ne: isNe ? { count: 1, restante: round2(saldo) } : { count: 0, restante: 0 },
        totalMonto: round2(monto),
        totalAbonos: round2(abonos),
        totalRestante: round2(saldo),
        ...(includePendingDocs ? { pendingDocs: [docSummary] } : {})
      });
    } else {
      const existing = map.get(key);
      // Preservar saldo local si existía (facturasCount === 0) sumando las facturas pendientes reales
      existing.saldoUsd = round2(existing.saldoUsd + saldo);
      existing.totalRestante = round2(existing.totalRestante + saldo);
      existing.totalMonto = round2(existing.totalMonto + monto);
      existing.totalAbonos = round2(existing.totalAbonos + abonos);
      existing.facturasCount += 1;
      if (isNe) {
        existing.ne = {
          count: Number(existing.ne?.count || 0) + 1,
          restante: round2(Number(existing.ne?.restante || 0) + saldo)
        };
      } else {
        existing.fac = {
          count: Number(existing.fac?.count || 0) + 1,
          restante: round2(Number(existing.fac?.restante || 0) + saldo)
        };
      }
      if (diasVencido > existing.maxDiasMora) {
        existing.maxDiasMora = diasVencido;
        existing.diasMora = diasVencido;
        existing.tramo = tramoDoc;
      }
      if (includePendingDocs && docSummary) {
        existing.pendingDocs = [...(existing.pendingDocs || []), docSummary];
      }
    }
  };

  // 2. Documentos de profit_invoices (deduplicados y sin anulados)
  dedupeCanonicalDocs(profitInvoices || []).forEach(inv => {
    if (!inv || isCxcInvoiceCancelled(inv)) return;
    const eraKey = getEraScopedCanonicalDocKey(inv) || getCanonicalDocKey(inv);
    if (eraKey) seenDocKeys.add(eraKey);
    const invTasa = Number(inv.tasa || inv.tasaDolar || safeRate) || safeRate;
    const rawSaldo = Number(inv.saldoUsd ?? inv.saldo_usd ?? 0);
    const saldo = rawSaldo > 0.01
      ? rawSaldo
      : (Number(inv.saldoBs ?? inv.saldo_bs ?? inv.saldo ?? 0) > 0 && invTasa > 0
          ? Number(inv.saldoBs ?? inv.saldo_bs ?? inv.saldo) / invTasa
          : 0);
    if (saldo <= 0.01) return;
    const monto = Number(inv.totNetoUsd ?? inv.tot_neto_usd ?? inv.totalNetoUsd ?? inv.totBrutoUsd ?? saldo) || saldo;
    const abonos = Number(inv.abonosUsd ?? inv.abonos_usd ?? Math.max(0, monto - saldo)) || 0;
    const tipoDoc = inferCxcDocType(inv);
    const factNum = String(inv.factNum || inv.fact_num || inv.numeroDoc || inv.id || '').trim();

    integrateDoc(inv, {
      monto,
      abonos,
      saldo,
      fechaEmisRaw: inv.fechaEmision || inv.fec_emis || inv.fecha,
      fechaVencRaw: inv.fechaVencimiento || inv.fec_venc,
      tipoDoc,
      factNum
    });
  });

  // 3. Ventas a crédito de POS (sales) sin duplicar con profit_invoices
  dedupeCanonicalDocs(sales || []).forEach(sale => {
    if (!sale || isCxcInvoiceCancelled(sale)) return;
    const rawTipo = String(sale.tipoDoc || sale.tipo_doc || '').toUpperCase().trim();
    if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION') return;
    const eraKey = getEraScopedCanonicalDocKey(sale) || getCanonicalDocKey(sale);
    if (eraKey && seenDocKeys.has(eraKey)) return;
    if (eraKey) seenDocKeys.add(eraKey);

    const statusUpper = String(sale.estado || sale.status || '').toUpperCase().trim();
    if (sale.pagado === true || statusUpper === 'PAGADO' || statusUpper === 'PAGADA' || statusUpper === 'COBRADA') return;

    const isCredit =
      sale.condicionPago === 'CREDITO' ||
      sale.aCredito ||
      Number(sale.diasCredito || 0) > 0;
    const explicitSaldo = Number(sale.saldoPendiente ?? sale.saldoUsd ?? sale.saldo_usd ?? 0);
    const hasPendingReceivable = statusUpper === 'PENDIENTE' || explicitSaldo > 0.01;
    if (!isCredit && !hasPendingReceivable) return;

    const saldo = Number(
      sale.saldoPendiente ??
      sale.saldoUsd ??
      sale.saldo_usd ??
      (sale.totalUsd && !sale.pagado ? sale.totalUsd : 0)
    );
    if (saldo <= 0.01) return;
    const monto = Number(sale.totalUsd ?? sale.totNetoUsd ?? saldo) || saldo;
    const abonos = Number(sale.abonosUsd ?? sale.montoPagadoUsd ?? Math.max(0, monto - saldo)) || 0;
    const tipoDoc = inferCxcDocType(sale);
    const factNum = String(sale.numeroDoc || sale.numero_doc || sale.factNum || sale.id || '').trim();

    integrateDoc(sale, {
      monto,
      abonos,
      saldo,
      fechaEmisRaw: sale.fechaEmision || sale.fecha,
      fechaVencRaw: sale.fechaVencimiento || sale.fechaVenc,
      tipoDoc,
      factNum
    });
  });

  return Array.from(map.values())
    .map(cli => {
      let rating = 'AA';
      if (cli.maxDiasMora > 30) rating = 'D';
      else if (cli.maxDiasMora > 15) rating = 'C';
      else if (cli.maxDiasMora > 7) rating = 'B';
      else if (cli.maxDiasMora > 0) rating = 'A';

      return {
        ...cli,
        maxDias: cli.maxDiasMora,
        isMora: cli.maxDiasMora > 0,
        rating,
        saldoBs: round2(cli.saldoUsd * safeRate)
      };
    })
    .filter(cli => cli.saldoUsd > 0.01)
    .sort((a, b) => b.saldoUsd - a.saldoUsd);
}

export const CXC_RATE_ORDER = ['BCV', 'EURO', 'KEYSTONE', 'PERSONALIZADA'];

export const CXC_RATE_BUCKETS = {
  BCV: {
    id: 'BCV',
    label: 'Tasa BCV',
    shortLabel: 'BCV',
    printTitle: 'RENGLÓN 1: COBROS A TASA BCV (INCLUYE DOCUMENTOS FISCALES)',
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.35)'
  },
  EURO: {
    id: 'EURO',
    label: 'Tasa Euro',
    shortLabel: 'EURO',
    printTitle: 'RENGLÓN 2: COBROS A TASA EURO',
    color: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.35)'
  },
  KEYSTONE: {
    id: 'KEYSTONE',
    label: 'Tasa Keystone',
    shortLabel: 'KEYSTONE',
    printTitle: 'RENGLÓN 3: COBROS A TASA KEYSTONE',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.35)'
  },
  PERSONALIZADA: {
    id: 'PERSONALIZADA',
    label: 'Tasa Personalizada',
    shortLabel: 'PERSONALIZADA',
    printTitle: 'RENGLÓN 4: COBROS A TASA PERSONALIZADA',
    color: '#c084fc',
    badgeBg: 'rgba(192, 132, 252, 0.14)',
    border: 'rgba(192, 132, 252, 0.35)'
  }
};

export function normalizeCxcRateType(rawType) {
  const up = String(rawType || '').toUpperCase().trim();
  if (!up) return null;
  if (up === 'BCV' || up === 'TASA_BCV' || up === 'TASA BCV') return 'BCV';
  if (up === 'EURO' || up === 'EUR' || up === 'TASA_EURO' || up === 'TASA EURO') return 'EURO';
  if (up === 'KEYSTONE' || up === 'KEY' || up === 'TASA_KEYSTONE' || up === 'TASA KEYSTONE') return 'KEYSTONE';
  if (
    up === 'PERSONALIZADA' ||
    up === 'PERSONALIZADO' ||
    up === 'EDITABLE' ||
    up === 'EDITABLE_MANUAL' ||
    up === 'CUSTOM' ||
    up === 'MANUAL' ||
    up === 'TASA_PERSONALIZADA'
  ) {
    return 'PERSONALIZADA';
  }
  return null;
}

/**
 * Determina si un movimiento/cobro corresponde a un documento fiscal (Factura / Nota de Débito).
 * Todo documento fiscal clasifica obligatoriamente en el renglón de Tasa BCV.
 */
export function isFiscalCollectionMovement(mov) {
  if (!mov || typeof mov !== 'object') return true;
  const obs = String(mov.observaciones || mov.descrip || '');
  const factNumUpper = String(mov.factNum || mov.fact_num || '').toUpperCase().trim();
  if (factNumUpper === 'GENERAL' && /NOTA\s+DE\s+ENTREGA|NOTA_ENTREGA|\bN\/E\b|\bNE-\d+/i.test(obs)) {
    return false;
  }
  return inferCxcDocType(mov) !== 'NOTA_ENTREGA';
}

/**
 * Clasifica un abono/movimiento CxC en uno de los 4 renglones de tasa:
 * 'BCV' | 'EURO' | 'KEYSTONE' | 'PERSONALIZADA'.
 * Regla obligatoria: Todo documento fiscal clasifica en 'BCV'.
 */
export function classifyCollectionRateType(mov, rates = {}) {
  if (isFiscalCollectionMovement(mov)) return 'BCV';

  const explicit = normalizeCxcRateType(
    mov?.tipoTasa ??
    mov?.tipo_tasa ??
    (Array.isArray(mov?.formasPago) ? mov.formasPago[0]?.tipoTasa : undefined)
  );
  if (explicit) return explicit;

  const obs = String(mov?.observaciones || mov?.descrip || '').toUpperCase();
  if (/\[KEYSTONE\]|\bTASA\s+KEYSTONE\b|\bKEYSTONE\b/.test(obs)) return 'KEYSTONE';
  if (/\[EURO\]|\bTASA\s+EURO\b|\bEURO\b/.test(obs)) return 'EURO';
  if (/\[PERSONALIZADA\]|\bTASA\s+PERSONALIZADA\b|\bPERSONALIZADA\b/.test(obs)) return 'PERSONALIZADA';
  if (/\[BCV\]|\bTASA\s+BCV\b/.test(obs)) return 'BCV';

  const tasaVal = Number(mov?.tasa || 0);
  if (!(tasaVal > 10)) return 'BCV';

  const bcv = Number(rates?.tasaBcv || rates?.bcv || 0);
  const euro = Number(rates?.tasaEuro || rates?.euro || 0);
  const keystone = Number(rates?.tasaKeystone || rates?.keystone || 0);
  const candidates = [
    { type: 'BCV', val: bcv },
    { type: 'EURO', val: euro },
    { type: 'KEYSTONE', val: keystone }
  ].filter(c => Number.isFinite(c.val) && c.val > 10);

  let bestType = null;
  let bestDiff = Infinity;
  candidates.forEach(c => {
    const diff = Math.abs(tasaVal - c.val);
    const tol = Math.max(0.5, c.val * 0.0025);
    if (diff <= tol && diff < bestDiff) {
      bestDiff = diff;
      bestType = c.type;
    }
  });

  return bestType || 'PERSONALIZADA';
}

/**
 * Agrupa una lista de movimientos CxC por los 4 renglones de tasa y calcula
 * subtotales por renglón + sumatoria total general en Divisas (USD) y Bolívares (Bs.).
 */
export function groupMovementsByRateType(movements = [], rates = {}) {
  const bucketMap = new Map();
  CXC_RATE_ORDER.forEach((rateKey) => {
    const meta = CXC_RATE_BUCKETS[rateKey];
    bucketMap.set(rateKey, {
      ...meta,
      items: [],
      count: 0,
      totalUsd: 0,
      totalBs: 0
    });
  });

  (movements || []).forEach((mov) => {
    if (!mov) return;
    const rateType = classifyCollectionRateType(mov, rates);
    const bucket = bucketMap.get(rateType) || bucketMap.get('BCV');
    const enriched = {
      ...mov,
      tipoTasa: rateType,
      tipoTasaLabel: bucket.label
    };
    bucket.items.push(enriched);
    bucket.count += 1;
    bucket.totalUsd = round2(bucket.totalUsd + Number(mov.montoUsd || 0));
    bucket.totalBs = round2(bucket.totalBs + Number(mov.montoBs || 0));
  });

  const groups = CXC_RATE_ORDER.map(k => bucketMap.get(k));
  const totalUsd = round2(groups.reduce((acc, g) => acc + g.totalUsd, 0));
  const totalBs = round2(groups.reduce((acc, g) => acc + g.totalBs, 0));
  const count = groups.reduce((acc, g) => acc + g.count, 0);

  return {
    groups,
    nonEmptyGroups: groups.filter(g => g.count > 0),
    byType: {
      BCV: bucketMap.get('BCV'),
      EURO: bucketMap.get('EURO'),
      KEYSTONE: bucketMap.get('KEYSTONE'),
      PERSONALIZADA: bucketMap.get('PERSONALIZADA')
    },
    totals: {
      count,
      totalUsd,
      totalBs
    }
  };
}
