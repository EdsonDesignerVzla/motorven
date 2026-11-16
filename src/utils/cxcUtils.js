import {
  getCanonicalDocKey,
  getEraScopedCanonicalDocKey,
  dedupeCanonicalDocs
} from '../services/fiscalService.js';
import { round2 } from '../services/formatService.js';
import {
  DIRECT_CURRENCY_RATE_TYPES,
  RATE_TYPE_META,
  isDirectCurrencyRateType,
  inferDirectCurrencyFromAccountOrMethod,
  normalizeRateType
} from './rateClassificationUtils.js';

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
 * Determina si un documento CxC está anulado, cobrado o liquidado y no debe sumarse a la cartera abierta.
 */
export function isCxcInvoiceSettled(inv) {
  if (!inv || typeof inv !== 'object') return false;
  if (isCxcInvoiceCancelled(inv)) return true;
  if (inv.pagado === true) return true;
  const st = String(inv.status || inv.estado || '').toUpperCase().trim();
  return st === 'COBRADA' || st === 'COBRADO' || st === 'PAGADA' || st === 'PAGADO';
}

/**
 * Normaliza cualquier fecha (ISO, DD/MM/YYYY o Date) a clave local 'YYYY-MM-DD'.
 */
export function toCxcDateKey(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '';
    return `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}-${String(dateVal.getDate()).padStart(2, '0')}`;
  }
  const str = String(dateVal).trim();
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const lat = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (lat) return `${lat[3]}-${lat[2].padStart(2, '0')}-${lat[1].padStart(2, '0')}`;
  const d = new Date(str);
  return isNaN(d.getTime()) ? '' : toCxcDateKey(d);
}

/**
 * Determina si un registro de venta POS corresponde a una venta a crédito o pendiente por cobrar.
 */
export function isCreditSaleRecord(s) {
  if (!s) return false;
  if (s.aCredito) return true;
  const term = String(s.condicionPago || s.condicion_pago || '').trim().toUpperCase();
  if (term === 'CREDITO') return true;
  if (term && term !== 'CONTADO' && /^\d+/.test(term)) return true;
  return Number(s.diasCredito || 0) > 0;
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
export const normalizeClientRifKey = (val) => {
  const clean = String(val || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean || /^[VEJPG]?0+$/.test(clean)) return '';
  return clean;
};

export const normalizeClientCodeKey = (val) => String(val || '').trim().toUpperCase();

export const normalizeClientNameKey = (val) => String(val || '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Consolida el estado de cuenta CxC por cliente en tiempo real combinando
 * profitInvoices + sales a crédito no duplicadas + perfiles de clients.
 */
export function consolidateClientReceivables({
  clients = [],
  profitInvoices = [],
  sales = [],
  tasaBcv = 827.73,
  includePendingDocs = false,
  includeLocalClientDebt = true
} = {}) {
  const safeRate = Number(tasaBcv) > 0 ? Number(tasaBcv) : 827.73;
  const map = new Map();
  const hoy = new Date();

  const findClientProfile = (rif, coCli, nombre) => {
    const cleanRif = normalizeClientRifKey(rif);
    const cleanCo = normalizeClientCodeKey(coCli);
    const cleanName = normalizeClientNameKey(nombre);
    return (clients || []).find(c =>
      (cleanRif && normalizeClientRifKey(c.rif) === cleanRif) ||
      (cleanCo && (normalizeClientCodeKey(c.id) === cleanCo || normalizeClientCodeKey(c.codigo ?? c.co_cli) === cleanCo)) ||
      (cleanName && normalizeClientNameKey(c.nombre || c.razonSocial) === cleanName)
    ) || {};
  };

  const resolveGroupKey = (profile, rif, coCli, nombre) => {
    const normRif = normalizeClientRifKey(profile?.rif || rif);
    if (normRif) return normRif;
    const normCo = normalizeClientCodeKey(profile?.id || profile?.codigo || profile?.co_cli || coCli);
    if (normCo) return normCo;
    const normName = normalizeClientNameKey(profile?.nombre || profile?.razonSocial || nombre);
    return normName ? `NAME:${normName}` : '';
  };

  // 1. Clientes con saldoDeudorUsd local explícito (solo si aún no vienen sincronizados de CxC)
  if (includeLocalClientDebt) {
    (clients || []).forEach(c => {
      if (!c || c._saldoSyncedFromCxc) return;
      const coCli = String(c.id || c.codigo || c.co_cli || '').trim();
      const rif = String(c.rif || '').trim().toUpperCase();
      const saldoLocal = Number(c.saldoDeudorUsd ?? c.saldo_deudor_usd ?? c.saldoUsd ?? c.saldo_usd ?? 0);
      if (saldoLocal > 0.01) {
        const key = resolveGroupKey(c, rif, coCli, c.nombre || c.razonSocial);
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
  }

  const seenDocKeys = new Set();

  const integrateDoc = (rawDoc, { monto, abonos, saldo, fechaEmisRaw, fechaVencRaw, tipoDoc, factNum }) => {
    if (saldo <= 0.01) return;
    const rif = String(rawDoc.clienteRif || rawDoc.cliente_rif || rawDoc.rif || '').trim().toUpperCase();
    const coCli = String(rawDoc.clienteId || rawDoc.cliente_id || rawDoc.coCli || rawDoc.co_cli || rawDoc.clienteCod || '').trim();
    const nombreDoc = String(rawDoc.clienteNombre || rawDoc.cliente_nombre || rawDoc.cli_des || rawDoc.cliente || '').trim();
    const clientProfile = findClientProfile(rif, coCli, nombreDoc);
    const key = resolveGroupKey(clientProfile, rif, coCli, nombreDoc);
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
      const resolvedNombre = nombreDoc || clientProfile.nombre || clientProfile.razonSocial || 'Cliente General';
      map.set(key, {
        id: clientProfile.id || coCli || key,
        coCli: coCli || clientProfile.codigo || '',
        nombre: resolvedNombre,
        cliente: resolvedNombre,
        rif: clientProfile.rif || rif || 'J-00000000-0',
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

  // 2. Documentos de profit_invoices (deduplicados y sin anulados ni cobrados)
  dedupeCanonicalDocs(profitInvoices || []).forEach(inv => {
    if (!inv || isCxcInvoiceSettled(inv)) return;
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
    if (!sale || isCxcInvoiceSettled(sale)) return;
    const rawTipo = String(sale.tipoDoc || sale.tipo_doc || '').toUpperCase().trim();
    if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION') return;
    const eraKey = getEraScopedCanonicalDocKey(sale) || getCanonicalDocKey(sale);
    if (eraKey && seenDocKeys.has(eraKey)) return;
    if (eraKey) seenDocKeys.add(eraKey);

    const statusUpper = String(sale.estado || sale.status || '').toUpperCase().trim();

    const isCredit = isCreditSaleRecord(sale);
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

/**
 * Reconcilia el directorio completo de clientes contra la cartera CxC real
 * (profitInvoices + sales a crédito no duplicadas), eliminando saldos obsoletos en clients.
 */
export function reconcileClientsWithRealCxc({
  clients = [],
  profitInvoices = [],
  sales = [],
  tasaBcv = 1,
  todayKey
} = {}) {
  const list = Array.isArray(clients) ? clients : [];
  const today = todayKey || toCxcDateKey(new Date());
  const safeRate = Number(tasaBcv) > 0 ? Number(tasaBcv) : 0;
  const hasReceivableSources =
    (Array.isArray(profitInvoices) && profitInvoices.length > 0) ||
    (Array.isArray(sales) && sales.length > 0);

  if (!hasReceivableSources) {
    const fallbackClients = list.map((c) => {
      const saldoLocal = round2(Math.max(0, Number(c?.saldoDeudorUsd ?? c?.saldo_deudor_usd ?? 0)));
      return {
        ...c,
        _saldoSyncedFromCxc: false,
        saldoDeudorUsd: saldoLocal,
        saldo_deudor_usd: saldoLocal,
        saldoAlDiaUsd: saldoLocal,
        saldoVencidoUsd: 0,
        openDocsCount: 0,
        openFacturasCount: 0,
        openNotasEntregaCount: 0,
        maxDiasMora: 0,
        openDocs: []
      };
    });
    const conDeudaCount = fallbackClients.filter(c => c.saldoDeudorUsd > 0.01).length;
    const totalDeudaUsd = round2(fallbackClients.reduce((acc, c) => acc + c.saldoDeudorUsd, 0));
    return {
      clients: fallbackClients,
      unmatchedDocs: [],
      totals: {
        totalDeudaUsd,
        matchedDeudaUsd: totalDeudaUsd,
        unmatchedDeudaUsd: 0,
        unmatchedDocsCount: 0,
        conDeudaCount,
        alDiaUsd: totalDeudaUsd,
        vencidaUsd: 0,
        hasReceivableSources: false
      }
    };
  }

  const byId = new Map();
  const byCode = new Map();
  const byRif = new Map();
  const byName = new Map();
  const accList = list.map((c, idx) => {
    const idKey = normalizeClientCodeKey(c?.id);
    const codeKey = normalizeClientCodeKey(c?.codigo ?? c?.co_cli);
    const rifKey = normalizeClientRifKey(c?.rif);
    const nameKey = normalizeClientNameKey(c?.nombre ?? c?.razonSocial);
    if (idKey && !byId.has(idKey)) byId.set(idKey, idx);
    if (codeKey && !byCode.has(codeKey)) byCode.set(codeKey, idx);
    if (rifKey && !byRif.has(rifKey)) byRif.set(rifKey, idx);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, idx);
    return {
      saldoDeudorUsd: 0,
      saldoAlDiaUsd: 0,
      saldoVencidoUsd: 0,
      openDocsCount: 0,
      openFacturasCount: 0,
      openNotasEntregaCount: 0,
      maxDiasMora: 0,
      openDocs: [],
      lastDocDate: '',
      lastDocNum: '',
      lastDocAmount: 0
    };
  });

  const resolveClientIdx = (doc) => {
    const coCli = normalizeClientCodeKey(doc?.clienteId ?? doc?.cliente_id ?? doc?.coCli ?? doc?.co_cli ?? doc?.clienteCod);
    if (coCli) {
      if (byId.has(coCli)) return byId.get(coCli);
      if (byCode.has(coCli)) return byCode.get(coCli);
    }
    const rif = normalizeClientRifKey(doc?.clienteRif ?? doc?.cliente_rif ?? doc?.rif);
    if (rif && byRif.has(rif)) return byRif.get(rif);
    const nombre = normalizeClientNameKey(doc?.clienteNombre ?? doc?.cliente_nombre ?? doc?.cli_des ?? doc?.cliente);
    if (nombre && byName.has(nombre)) return byName.get(nombre);
    return -1;
  };

  const trackLastDoc = (idx, doc, factNum, montoUsd) => {
    if (idx < 0) return;
    const acc = accList[idx];
    const emDate = toCxcDateKey(doc?.fechaEmision || doc?.fec_emis || doc?.fecEmis || doc?.fecha || '');
    if (emDate && (!acc.lastDocDate || emDate >= acc.lastDocDate)) {
      acc.lastDocDate = emDate;
      acc.lastDocNum = factNum || acc.lastDocNum;
      acc.lastDocAmount = Number(montoUsd || 0) || acc.lastDocAmount;
    }
  };

  const seenDocKeys = new Set();
  const unmatchedDocs = [];
  let unmatchedDeudaUsd = 0;

  const pushOpenDoc = (idx, rawDoc, { factNum, tipoDoc, fechaEmision, fechaVencimiento, montoUsd, saldo }) => {
    const fVencKey = toCxcDateKey(fechaVencimiento) || String(fechaVencimiento || '').trim();
    const isOverdue = Boolean(fVencKey && today && fVencKey < today);
    let diasMora = 0;
    if (isOverdue && today) {
      const diff = Math.floor((new Date(`${today}T12:00:00`) - new Date(`${fVencKey}T12:00:00`)) / 86400000);
      diasMora = Math.max(1, Number.isFinite(diff) ? diff : 1);
    }
    const summary = {
      id: rawDoc?.id || factNum,
      factNum,
      tipoDoc,
      fechaEmision: toCxcDateKey(fechaEmision) || String(fechaEmision || ''),
      fechaVencimiento: fVencKey,
      saldoUsd: round2(saldo),
      montoUsd: round2(montoUsd),
      isOverdue,
      diasMora
    };
    if (idx >= 0) {
      const acc = accList[idx];
      acc.saldoDeudorUsd += saldo;
      if (isOverdue) acc.saldoVencidoUsd += saldo;
      else acc.saldoAlDiaUsd += saldo;
      acc.openDocsCount += 1;
      if (tipoDoc === 'NOTA_ENTREGA') acc.openNotasEntregaCount += 1;
      else acc.openFacturasCount += 1;
      if (diasMora > acc.maxDiasMora) acc.maxDiasMora = diasMora;
      acc.openDocs.push(summary);
    } else {
      unmatchedDeudaUsd += saldo;
      unmatchedDocs.push({
        ...summary,
        clienteId: rawDoc?.clienteId ?? rawDoc?.cliente_id ?? rawDoc?.co_cli ?? '',
        clienteRif: rawDoc?.clienteRif ?? rawDoc?.cliente_rif ?? rawDoc?.rif ?? '',
        clienteNombre: rawDoc?.clienteNombre ?? rawDoc?.cliente_nombre ?? rawDoc?.cli_des ?? ''
      });
    }
  };

  // 1. Documentos desde profitInvoices (fuente principal Profit / CxC)
  dedupeCanonicalDocs(profitInvoices || []).forEach((inv) => {
    if (!inv || isCxcInvoiceCancelled(inv)) return;
    const eraKey = getEraScopedCanonicalDocKey(inv) || getCanonicalDocKey(inv);
    if (eraKey) seenDocKeys.add(eraKey);
    const idx = resolveClientIdx(inv);
    const factNum = String(inv.factNum || inv.fact_num || inv.numeroDoc || inv.id || '').trim();
    const montoUsd = Number(inv.totNetoUsd ?? inv.tot_neto_usd ?? inv.totalNetoUsd ?? inv.totBrutoUsd ?? 0) || 0;
    trackLastDoc(idx, inv, factNum, montoUsd);

    if (isCxcInvoiceSettled(inv)) return;
    const rawSaldo = Number(inv.saldoUsd ?? inv.saldo_usd ?? 0);
    const rate = safeRate > 0 ? safeRate : (Number(inv.tasa || inv.tasaDolar || 0) || 0);
    const rawBs = Number(inv.saldoBs ?? inv.saldo_bs ?? inv.saldo ?? 0);
    const saldo = rawSaldo > 0.01 ? rawSaldo : (rawBs > 0 && rate > 0 ? rawBs / rate : 0);
    if (saldo <= 0.01) return;

    pushOpenDoc(idx, inv, {
      factNum,
      tipoDoc: inferCxcDocType(inv),
      fechaEmision: inv.fechaEmision || inv.fec_emis || inv.fecEmis || inv.fecha || '',
      fechaVencimiento: inv.fechaVencimiento || inv.fec_venc || inv.fecVenc || '',
      montoUsd: montoUsd || saldo,
      saldo
    });
  });

  // 2. Ventas POS a crédito o con saldo pendiente no duplicadas en profitInvoices
  dedupeCanonicalDocs(sales || []).forEach((sale) => {
    if (!sale || isCxcInvoiceCancelled(sale)) return;
    const rawTipo = String(sale.tipoDoc || sale.tipo_doc || '').toUpperCase().trim();
    if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION') return;
    const eraKey = getEraScopedCanonicalDocKey(sale) || getCanonicalDocKey(sale);
    if (eraKey && seenDocKeys.has(eraKey)) return;
    if (eraKey) seenDocKeys.add(eraKey);

    const idx = resolveClientIdx(sale);
    const factNum = String(sale.numeroDoc || sale.numero_doc || sale.factNum || sale.id || '').trim();
    const montoUsd = Number(sale.totalUsd ?? sale.totNetoUsd ?? 0) || 0;
    trackLastDoc(idx, sale, factNum, montoUsd);

    if (isCxcInvoiceSettled(sale)) return;
    const statusUpper = String(sale.estado || sale.status || '').toUpperCase().trim();
    const explicitSaldo = Number(sale.saldoPendiente ?? sale.saldoUsd ?? sale.saldo_usd ?? 0);
    if (!isCreditSaleRecord(sale) && statusUpper !== 'PENDIENTE' && explicitSaldo <= 0.01) return;

    const saldo = Number(
      sale.saldoPendiente ??
      sale.saldoUsd ??
      sale.saldo_usd ??
      (sale.totalUsd && !sale.pagado ? sale.totalUsd : 0)
    );
    if (saldo <= 0.01) return;

    pushOpenDoc(idx, sale, {
      factNum,
      tipoDoc: inferCxcDocType(sale),
      fechaEmision: sale.fechaEmision || sale.fecha || '',
      fechaVencimiento: sale.fechaVencimiento || sale.fechaVenc || '',
      montoUsd: montoUsd || saldo,
      saldo
    });
  });

  let matchedDeudaUsd = 0;
  let conDeudaCount = 0;
  let alDiaUsd = 0;
  let vencidaUsd = 0;

  const reconciledClients = list.map((c, idx) => {
    const acc = accList[idx];
    const saldoDeudorUsd = round2(acc.saldoDeudorUsd);
    const saldoAlDiaUsd = round2(acc.saldoAlDiaUsd);
    const saldoVencidoUsd = round2(acc.saldoVencidoUsd);
    if (saldoDeudorUsd > 0.01) {
      conDeudaCount += 1;
      matchedDeudaUsd += saldoDeudorUsd;
    }
    alDiaUsd += saldoAlDiaUsd;
    vencidaUsd += saldoVencidoUsd;

    const sortedOpenDocs = [...acc.openDocs].sort((a, b) => (b.diasMora - a.diasMora) || (b.saldoUsd - a.saldoUsd));

    return {
      ...c,
      _saldoSyncedFromCxc: true,
      _saldoDbRawUsd: round2(Number(c?.saldoDeudorUsd ?? c?.saldo_deudor_usd ?? 0)),
      saldoDeudorUsd,
      saldo_deudor_usd: saldoDeudorUsd,
      saldoAlDiaUsd,
      saldoVencidoUsd,
      openDocsCount: acc.openDocsCount,
      openFacturasCount: acc.openFacturasCount,
      openNotasEntregaCount: acc.openNotasEntregaCount,
      maxDiasMora: acc.maxDiasMora,
      openDocs: sortedOpenDocs,
      ultimaFactura: c?.ultimaFactura || acc.lastDocNum || '',
      fechaUltimaVenta: c?.fechaUltimaVenta || acc.lastDocDate || '',
      montoUltimaVenta: Number(c?.montoUltimaVenta || 0) > 0 ? Number(c.montoUltimaVenta) : round2(acc.lastDocAmount)
    };
  });

  return {
    clients: reconciledClients,
    unmatchedDocs,
    totals: {
      totalDeudaUsd: round2(matchedDeudaUsd + unmatchedDeudaUsd),
      matchedDeudaUsd: round2(matchedDeudaUsd),
      unmatchedDeudaUsd: round2(unmatchedDeudaUsd),
      unmatchedDocsCount: unmatchedDocs.length,
      conDeudaCount,
      alDiaUsd: round2(alDiaUsd),
      vencidaUsd: round2(vencidaUsd),
      hasReceivableSources: true
    }
  };
}

const makeDirectCxcBucket = (key, ordenIdx) => {
  const meta = RATE_TYPE_META[key] || RATE_TYPE_META.USD;
  return {
    id: key,
    label: meta.label,
    shortLabel: meta.shortLabel,
    printTitle: `RENGLÓN ${ordenIdx}: COBROS EN ${meta.label.toUpperCase()} (MONEDA DIRECTA)`,
    color: meta.color,
    badgeBg: meta.bg,
    border: meta.border,
    isDirectCurrency: true
  };
};

export const CXC_RATE_ORDER = ['BCV', 'EURO', 'KEYSTONE', 'PERSONALIZADA', ...DIRECT_CURRENCY_RATE_TYPES];

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
  },
  USD: makeDirectCxcBucket('USD', 5),
  ZELLE: makeDirectCxcBucket('ZELLE', 6),
  USDT: makeDirectCxcBucket('USDT', 7),
  USDC: makeDirectCxcBucket('USDC', 8)
};

export function normalizeCxcRateType(rawType) {
  const up = String(rawType || '').toUpperCase().trim();
  if (!up) return null;
  const resolved = normalizeRateType(up, { fallback: '' });
  if (resolved === 'EDITABLE') return 'PERSONALIZADA';
  if (resolved && CXC_RATE_BUCKETS[resolved]) return resolved;
  if (
    up === 'EDITABLE_MANUAL' ||
    up === 'TASA_PERSONALIZADA'
  ) {
    return 'PERSONALIZADA';
  }
  return null;
}

/**
 * Determina si un movimiento/cobro corresponde a un documento fiscal (Factura / Nota de Débito).
 * En documentos fiscales sin clasificación explícita distinta (Keystone, Personalizada o moneda directa),
 * por defecto clasifica en BCV y nunca admite Euro.
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
 * Clasifica un abono/movimiento CxC en uno de los renglones de tasa:
 * 'BCV' | 'EURO' | 'KEYSTONE' | 'PERSONALIZADA' | 'USD' | 'ZELLE' | 'USDT' | 'USDC'.
 * Regla obligatoria: Todo documento fiscal clasifica en 'BCV' o en su moneda directa si fue cobrado en divisa directa.
 */
export function classifyCollectionRateType(mov, rates = {}) {
  const explicit = normalizeCxcRateType(
    mov?.tipoTasa ??
    mov?.tipo_tasa ??
    (Array.isArray(mov?.formasPago) ? mov.formasPago[0]?.tipoTasa : undefined)
  );
  const obs = String(mov?.observaciones || mov?.descrip || '').toUpperCase();
  const explicitDirectFromObs =
    /\[ZELLE\]|\bDIVISA\s+ZELLE\b/.test(obs) ? 'ZELLE' :
    /\[USDT\]|\bDIVISA\s+BINANCE\b|\bBINANCE\s*\(USDT\)/.test(obs) ? 'USDT' :
    /\[USDC\]|\bDIVISAS?\s+KONTIGO\b|\bKONTIGO\s*\(USDC\)/.test(obs) ? 'USDC' :
    /\[USD\]|\bDIVISA\s+(EFECTIVO|DIRECTA)\s+USD\b/.test(obs) ? 'USD' :
    null;

  const monUp = String(mov?.monedaPago || mov?.moneda_pago || '').toUpperCase().trim();
  const rawBs = Number(mov?.montoBs ?? mov?.monto_bs ?? 0);

  if (explicit) {
    if (isFiscalCollectionMovement(mov) && explicit === 'EURO') return 'BCV';
    return explicit;
  }

  const directFromAccount = inferDirectCurrencyFromAccountOrMethod(mov);
  const directCandidate =
    directFromAccount ||
    explicitDirectFromObs ||
    (rawBs <= 0 && isDirectCurrencyRateType(monUp) ? normalizeCxcRateType(monUp) : null);

  if (directCandidate) return directCandidate;
  if (isFiscalCollectionMovement(mov)) return 'BCV';

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
    const isDirect = isDirectCurrencyRateType(rateType);
    const movBs = isDirect ? 0 : Number(mov.montoBs || 0);
    const enriched = {
      ...mov,
      tipoTasa: rateType,
      tipoTasaLabel: bucket.label,
      isDirectCurrency: isDirect,
      tasa: isDirect ? 0 : Number(mov.tasa || 0),
      montoBs: movBs
    };
    bucket.items.push(enriched);
    bucket.count += 1;
    bucket.totalUsd = round2(bucket.totalUsd + Number(mov.montoUsd || 0));
    bucket.totalBs = round2(bucket.totalBs + movBs);
  });

  const groups = CXC_RATE_ORDER.map(k => bucketMap.get(k));
  const totalUsd = round2(groups.reduce((acc, g) => acc + g.totalUsd, 0));
  const totalBs = round2(groups.reduce((acc, g) => acc + g.totalBs, 0));
  const count = groups.reduce((acc, g) => acc + g.count, 0);

  const byType = {};
  CXC_RATE_ORDER.forEach((k) => {
    byType[k] = bucketMap.get(k);
  });

  return {
    groups,
    nonEmptyGroups: groups.filter(g => g.count > 0),
    byType,
    totals: {
      count,
      totalUsd,
      totalBs
    }
  };
}

/**
 * Resume todos los movimientos CxC agrupados por Caja / Banco receptor.
 * Las monedas directas conservan 0 en totalBs para evitar conversiones ficticias.
 */
export function summarizeDailyMovementsByCaja(movements = []) {
  const map = new Map();

  (Array.isArray(movements) ? movements : []).forEach((mov) => {
    if (!mov) return;
    const rawNombre = String(mov.cuentaNombre || mov.cajaOBanco || '').trim() || 'Tesorería / Sin Caja';
    const key = rawNombre.toUpperCase();
    const explicitTipo = normalizeCxcRateType(mov.tipoTasa ?? mov.tipo_tasa);
    const isDirect = Boolean(
      mov.isDirectCurrency ||
      isDirectCurrencyRateType(mov.tipoTasa, { monedaPago: mov.monedaPago }) ||
      (!explicitTipo && inferDirectCurrencyFromAccountOrMethod(mov))
    );
    const usd = Number(mov.montoUsd || 0);
    const bs = isDirect ? 0 : Number(mov.montoBs || 0);

    if (!map.has(key)) {
      map.set(key, {
        key,
        cuentaNombre: rawNombre,
        accountType: mov.accountType || 'CAJA',
        count: 0,
        totalUsd: 0,
        totalBs: 0
      });
    }
    const row = map.get(key);
    row.count += 1;
    row.totalUsd = round2(row.totalUsd + usd);
    row.totalBs = round2(row.totalBs + bs);
  });

  const rows = Array.from(map.values()).sort((a, b) => {
    if (b.totalUsd !== a.totalUsd) return b.totalUsd - a.totalUsd;
    return a.cuentaNombre.localeCompare(b.cuentaNombre);
  });

  return {
    rows,
    totals: {
      count: rows.reduce((acc, r) => acc + r.count, 0),
      totalUsd: round2(rows.reduce((acc, r) => acc + r.totalUsd, 0)),
      totalBs: round2(rows.reduce((acc, r) => acc + r.totalBs, 0))
    }
  };
}

/**
 * Obtiene el siguiente correlativo NC-XXXXXX o ND-XXXXXX sin colisiones entre ventas y facturas CxC.
 */
export function getNextCreditDebitNoteCorrelativo(noteType = 'NOTA_CREDITO', sales = [], profitInvoices = []) {
  const isDebit = String(noteType || '').toUpperCase().includes('DEB') || String(noteType || '').toUpperCase() === 'ND' || String(noteType || '').toUpperCase() === 'N/DB';
  const prefix = isDebit ? 'ND' : 'NC';
  let maxNum = 0;

  const inspectCode = (rawVal) => {
    const clean = String(rawVal || '').toUpperCase().trim().replace(/^NE-/, '');
    const m = clean.match(new RegExp(`^${prefix}-?0*(\\d+)$`));
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  };

  (Array.isArray(sales) ? sales : []).forEach((s) => {
    if (!s) return;
    inspectCode(s.numeroDoc || s.numero_doc);
    inspectCode(s.id);
  });

  (Array.isArray(profitInvoices) ? profitInvoices : []).forEach((inv) => {
    if (!inv) return;
    inspectCode(inv.factNum || inv.fact_num || inv.numeroDoc);
    inspectCode(inv.id);
    if (Array.isArray(inv.historialCobros)) {
      inv.historialCobros.forEach((h) => {
        if (!h) return;
        inspectCode(h.correlativo || h.cobNum || h.referencia);
      });
    }
  });

  return `${prefix}-${String(maxNum + 1).padStart(6, '0')}`;
}

/**
 * Construye los objetos de persistencia, ajuste de saldo CxC, registro fiscal SENIAT y datos PDF
 * para emitir una Nota de Crédito (N/CR) o Nota de Débito (N/DB) directamente sobre un documento CxC.
 */
export function buildCxcCreditDebitNoteResult({
  noteType = 'NOTA_CREDITO',
  affectedDoc,
  noteNum,
  fechaEmision,
  subtotalUsd = 0,
  aplicaIva = true,
  tasa = 827.73,
  motivo = '',
  clienteDireccion = ''
}) {
  if (!affectedDoc || !affectedDoc.factNum) {
    throw new Error('Debe seleccionar un documento CxC afectado válido.');
  }
  const normalizedNoteType = String(noteType || '').toUpperCase().includes('DEB') ? 'NOTA_DEBITO' : 'NOTA_CREDITO';
  const isDebit = normalizedNoteType === 'NOTA_DEBITO';
  const prefix = isDebit ? 'ND' : 'NC';

  const rawNumInput = String(noteNum || '').trim().toUpperCase();
  const cleanNoteNum = rawNumInput
    ? (/^(NC|ND)-/i.test(rawNumInput) ? rawNumInput : `${prefix}-${rawNumInput.replace(/[^0-9A-Z]/gi, '').padStart(6, '0')}`)
    : `${prefix}-000001`;

  const affectedType = inferCxcDocType(affectedDoc);
  const isNotaEntregaAffected = affectedType === 'NOTA_ENTREGA';
  const effectiveAplicaIva = !isNotaEntregaAffected && Boolean(aplicaIva);

  const cleanSub = round2(Math.max(0, Number(subtotalUsd || 0)));
  const cleanIva = effectiveAplicaIva ? round2(cleanSub * 0.16) : 0;
  const cleanTotal = round2(cleanSub + cleanIva);
  if (!(cleanTotal > 0)) {
    throw new Error('El monto total de la nota debe ser mayor a $0.00.');
  }

  const cleanTasa = Number(tasa || affectedDoc.tasa || 0) > 1 ? Number(tasa || affectedDoc.tasa) : 827.73;
  const totalBs = round2(cleanTotal * cleanTasa);
  const cleanFecha = String(fechaEmision || new Date().toISOString().split('T')[0]).trim();
  const cleanMotivo = String(motivo || '').trim() || (
    isDebit
      ? `Cargo / Ajuste adicional sobre documento #${affectedDoc.factNum}`
      : `Rebaja / Descuento comercial aplicado a documento #${affectedDoc.factNum}`
  );

  const currentFacturaUsd = round2(Number(affectedDoc.montoFacturaUsd ?? affectedDoc.totNetoUsd ?? 0));
  const currentAbonosUsd = round2(Number(affectedDoc.abonosUsd ?? 0));
  const currentRestanteUsd = round2(Math.max(0, Number(affectedDoc.restanteUsd ?? affectedDoc.saldoUsd ?? (currentFacturaUsd - currentAbonosUsd))));

  if (!isDebit && cleanTotal > round2(currentRestanteUsd + 0.01)) {
    throw new Error(`La Nota de Crédito ($${cleanTotal.toFixed(2)}) no puede superar el saldo pendiente del documento ($${currentRestanteUsd.toFixed(2)}).`);
  }

  const digitsPart = cleanNoteNum.replace(/\D/g, '').slice(-6).padStart(6, '0');
  const numeroControl = isNotaEntregaAffected ? '' : `00-${digitsPart}`;
  const vendedorId = affectedDoc.vendedorId || 'OF';
  const vendedorNombre = affectedDoc.vendedorNombre || 'Oficina';
  const clienteNombre = affectedDoc.cliente || affectedDoc.clienteNombre || 'Cliente General';
  const clienteRif = affectedDoc.rif || affectedDoc.clienteRif || 'J-00000000-0';
  const clienteId = affectedDoc.clienteId || clienteRif || 'CLI-GEN';

  let updatedAffectedDoc = null;
  let createdDebitDoc = null;
  let clientDebtDeltaUsd = 0;

  if (!isDebit) {
    // Nota de Crédito: reduce el saldo por cobrar del documento afectado mediante registro en historialCobros
    const ncEntry = {
      id: `nc-${cleanNoteNum}-${Date.now().toString().slice(-4)}`,
      correlativo: cleanNoteNum,
      cobNum: cleanNoteNum,
      tipo: 'NOTA_CREDITO',
      tipoDoc: 'NOTA_CREDITO',
      factNum: String(affectedDoc.factNum),
      documentoAfectado: String(affectedDoc.factNum),
      fecha: cleanFecha,
      tasa: cleanTasa,
      tasaPago: cleanTasa,
      tipoTasa: 'BCV',
      monedaPago: 'BS',
      subtotalUsd: cleanSub,
      ivaUsd: cleanIva,
      montoUsd: cleanTotal,
      montoBs: totalBs,
      formaPago: 'NOTA_CREDITO',
      cuentaId: 'NC-FISCAL',
      cuentaNombre: `N/CR #${cleanNoteNum}`,
      accountType: 'NOTA_CREDITO',
      referencia: cleanNoteNum,
      observaciones: `Nota de Crédito #${cleanNoteNum} • ${cleanMotivo}`
    };

    const appliedAmount = round2(Math.min(currentRestanteUsd, cleanTotal));
    const newAbonosUsd = round2(Math.min(currentFacturaUsd, currentAbonosUsd + appliedAmount));
    const newRestanteUsd = round2(Math.max(0, currentFacturaUsd - newAbonosUsd));

    updatedAffectedDoc = {
      ...affectedDoc,
      factNum: String(affectedDoc.factNum),
      tipoDoc: affectedType,
      fechaEmision: affectedDoc.fechaEmisionIso || affectedDoc.fechaEmision || cleanFecha,
      fechaVencimiento: affectedDoc.fechaVencimientoIso || affectedDoc.fechaVencimiento || cleanFecha,
      clienteId,
      clienteNombre,
      clienteRif,
      vendedorId,
      vendedorNombre,
      diasCredito: Number(affectedDoc.diasCredito || 0),
      diasVencidoCustom: affectedDoc.diasVencidoCustom ?? null,
      totBrutoUsd: round2(affectedDoc.subtotalUsd ?? affectedDoc.totBrutoUsd ?? currentFacturaUsd),
      ivaUsd: isNotaEntregaAffected ? 0 : round2(affectedDoc.ivaUsd ?? 0),
      totNetoUsd: currentFacturaUsd,
      abonosUsd: newAbonosUsd,
      saldoUsd: newRestanteUsd,
      tasa: Number(affectedDoc.tasa || cleanTasa),
      historialCobros: [ncEntry, ...(Array.isArray(affectedDoc.historialCobros) ? affectedDoc.historialCobros : [])]
    };
    clientDebtDeltaUsd = -appliedAmount;
  } else {
    // Nota de Débito: genera un nuevo documento por cobrar vinculado al documento afectado
    const ndDocNum = isNotaEntregaAffected && !cleanNoteNum.startsWith('NE-')
      ? `NE-${cleanNoteNum}`
      : cleanNoteNum;
    createdDebitDoc = {
      id: ndDocNum,
      factNum: ndDocNum,
      tipoDoc: isNotaEntregaAffected ? 'NOTA_ENTREGA' : 'FACTURA',
      fiscalDocType: 'NOTA_DEBITO',
      documentoAfectado: String(affectedDoc.factNum),
      numeroControl,
      vendedorId,
      vendedorNombre,
      clienteId,
      clienteNombre,
      clienteRif,
      clienteDireccion,
      fechaEmision: cleanFecha,
      fechaVencimiento: affectedDoc.fechaVencimientoIso || affectedDoc.fechaVencimiento || cleanFecha,
      diasCredito: Number(affectedDoc.diasCredito || 0),
      condicionPago: 'CREDITO',
      isExento: !effectiveAplicaIva,
      totBrutoUsd: cleanSub,
      ivaUsd: cleanIva,
      totNetoUsd: cleanTotal,
      abonosUsd: 0,
      saldoUsd: cleanTotal,
      tasa: cleanTasa,
      observaciones: `Nota de Débito #${cleanNoteNum} (Afecta #${affectedDoc.factNum}) • ${cleanMotivo}`,
      historialCobros: [],
      _customCreated: true
    };
    clientDebtDeltaUsd = cleanTotal;
  }

  // Registro fiscal en Libro de Ventas SENIAT solo si el documento afectado es Fiscal (Factura)
  const fiscalSaleRecord = !isNotaEntregaAffected
    ? {
        id: `${normalizedNoteType}-${cleanNoteNum}-${Date.now().toString().slice(-4)}`,
        numeroDoc: cleanNoteNum,
        numeroControl,
        tipoDoc: normalizedNoteType,
        documentoAfectado: String(affectedDoc.factNum),
        fecha: cleanFecha,
        fechaEmision: cleanFecha,
        fechaVencimiento: affectedDoc.fechaVencimientoIso || cleanFecha,
        diasCredito: Number(affectedDoc.diasCredito || 0),
        condicionPago: 'CREDITO',
        metodoPago: isDebit ? 'CREDITO' : 'NOTA_CREDITO',
        clienteId,
        clienteNombre,
        clienteRif,
        clienteDireccion,
        vendedor: vendedorNombre,
        vendedorId,
        tasaDolar: cleanTasa,
        subtotalUsd: cleanSub,
        baseGeneralUsd: effectiveAplicaIva ? cleanSub : 0,
        ivaGeneralUsd: cleanIva,
        baseExentaUsd: effectiveAplicaIva ? 0 : cleanSub,
        ivaUsd: cleanIva,
        impuestoUsd: cleanIva,
        totalUsd: cleanTotal,
        subtotalBs: round2(cleanSub * cleanTasa),
        ivaBs: round2(cleanIva * cleanTasa),
        totalBs,
        saldoUsd: isDebit ? cleanTotal : 0,
        saldoBs: isDebit ? totalBs : 0,
        estado: isDebit ? 'PENDIENTE' : 'PAGADO',
        motivo: cleanMotivo,
        observaciones: cleanMotivo,
        items: [
          {
            codigo: String(affectedDoc.factNum),
            descripcion: cleanMotivo,
            cantidad: 1,
            precioUnitarioUsd: cleanSub,
            precioUsd: cleanSub,
            tipoAlicuota: effectiveAplicaIva ? '16%' : 'EXENTO',
            alicuotaIva: effectiveAplicaIva ? 0.16 : 0,
            exento: !effectiveAplicaIva,
            subtotalUsd: cleanSub
          }
        ],
        skipStockAdjustment: true
      }
    : null;

  const notePdfData = {
    tipoDoc: normalizedNoteType,
    numeroDoc: cleanNoteNum,
    numeroControl: numeroControl || 'N/A (Control Interno)',
    documentoAfectado: String(affectedDoc.factNum),
    fechaEmision: cleanFecha,
    fecha: cleanFecha,
    clienteNombre,
    clienteRif,
    clienteDireccion: clienteDireccion || 'Venezuela',
    tasaDolar: cleanTasa,
    tasa: cleanTasa,
    subtotalUsd: cleanSub,
    ivaUsd: cleanIva,
    totalUsd: cleanTotal,
    motivo: cleanMotivo,
    descrip: cleanMotivo,
    observaciones: cleanMotivo,
    condicionPago: isNotaEntregaAffected ? 'AJUSTE N/E (SIN IVA)' : 'AJUSTE FISCAL CxC',
    items: [
      {
        codigo: String(affectedDoc.factNum),
        descripcion: cleanMotivo,
        cantidad: 1,
        precioUsd: cleanSub,
        tipoAlicuota: effectiveAplicaIva ? '16%' : 'EXENTO',
        subtotalUsd: cleanSub
      }
    ]
  };

  return {
    noteType: normalizedNoteType,
    noteNum: cleanNoteNum,
    isNotaEntregaAffected,
    updatedAffectedDoc,
    createdDebitDoc,
    fiscalSaleRecord,
    clientDebtDeltaUsd,
    notePdfData
  };
}
