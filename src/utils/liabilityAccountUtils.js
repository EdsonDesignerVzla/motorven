import { round2 } from '../services/formatService.js';
import { PLAN_DE_CUENTAS_MOTORVEN } from '../data/planDeCuentasMotorven.js';
import { resolveExchangeRates, computePartnerPayableSummary } from './treasuryAccountUtils.js';

export const OTHER_LIABILITY_ACCOUNTS_STORAGE_KEY = 'signum_other_liability_accounts_v1';
export const PARTNER_LIABILITY_MOVEMENTS_STORAGE_KEY = 'signum_partner_liability_movements_v1';

export const PASIVO_SUBGROUP_LABELS = {
  PASIVO_SOCIOS: 'Cuentas por Pagar Accionistas / Socios',
  PROVEEDORES: 'Cuentas por Pagar Comerciales',
  FISCAL_PASIVO: 'Obligaciones Fiscales y Retenciones',
  LABORAL_PASIVO: 'Obligaciones Laborales',
  ANTICIPOS: 'Anticipos de Clientes',
  OTROS_PASIVOS: 'Otros Pasivos y Obligaciones'
};

export const DEFAULT_OTHER_LIABILITY_ACCOUNTS = [
  {
    id: 'pas-20201002',
    codigo: 'PAS-01',
    codigoContable: '2.02.01.002',
    nombre: 'Aporte Socio (Pasivo)',
    acreedor: 'Accionistas Motorven',
    subgrupo: 'PASIVO_SOCIOS',
    moneda: 'USD',
    saldoUsd: 0,
    saldoBs: 0,
    activa: true,
    observaciones: 'Aportes transitorios de socios pendientes de capitalización o devolución'
  }
];

export const normalizeOtherLiabilityAccount = (raw = {}, idx = 0) => {
  const cleanCode = String(raw.codigo || raw.code || `PAS-${String(idx + 1).padStart(2, '0')}`).trim().toUpperCase();
  const cleanId = String(raw.id || `pas-${cleanCode.toLowerCase()}`).trim();
  return {
    id: cleanId,
    codigo: cleanCode,
    codigoContable: String(raw.codigoContable || '2.06.01.001').trim(),
    nombre: String(raw.nombre || raw.descripcion || 'Cuenta de Pasivo').trim(),
    acreedor: String(raw.acreedor || raw.titular || 'Acreedor / Ente').trim(),
    subgrupo: String(raw.subgrupo || 'OTROS_PASIVOS').trim(),
    moneda: String(raw.moneda || 'USD').toUpperCase().trim() === 'BS' ? 'BS' : 'USD',
    saldoUsd: round2(Math.max(0, Number(raw.saldoUsd ?? raw.saldo_usd ?? 0) || 0)),
    saldoBs: round2(Math.max(0, Number(raw.saldoBs ?? raw.saldo_bs ?? 0) || 0)),
    activa: raw.activa !== false,
    observaciones: String(raw.observaciones || '').trim(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
};

export const loadOtherLiabilityAccounts = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem(OTHER_LIABILITY_ACCOUNTS_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((p, i) => normalizeOtherLiabilityAccount(p, i));
        }
      }
    }
  } catch (_) {}
  return DEFAULT_OTHER_LIABILITY_ACCOUNTS.map((p, i) => normalizeOtherLiabilityAccount(p, i));
};

export const saveOtherLiabilityAccountsList = (list = []) => {
  const normalized = (Array.isArray(list) ? list : []).map((p, i) => normalizeOtherLiabilityAccount(p, i));
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(OTHER_LIABILITY_ACCOUNTS_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (_) {}
  return normalized;
};

export const upsertOtherLiabilityAccountInList = (list = [], account) => {
  const base = Array.isArray(list) ? [...list] : [];
  if (!account || typeof account !== 'object') return saveOtherLiabilityAccountsList(base);
  const normalized = normalizeOtherLiabilityAccount(account, base.length);
  const idx = base.findIndex((p) => {
    if (!p) return false;
    return String(p.id || '').trim() === normalized.id
      || String(p.codigo || '').trim().toUpperCase() === normalized.codigo;
  });
  if (idx >= 0) {
    base[idx] = { ...base[idx], ...normalized, id: base[idx].id || normalized.id };
  } else {
    base.push(normalized);
  }
  return saveOtherLiabilityAccountsList(base);
};

export const removeOtherLiabilityAccountFromList = (list = [], idOrCode) => {
  const target = String(typeof idOrCode === 'object' ? (idOrCode?.id || idOrCode?.codigo || '') : (idOrCode || '')).trim().toUpperCase();
  if (!target) return saveOtherLiabilityAccountsList(list);
  const next = (Array.isArray(list) ? list : []).filter((p) => {
    if (!p) return false;
    const pId = String(p.id || '').trim().toUpperCase();
    const pCode = String(p.codigo || '').trim().toUpperCase();
    return pId !== target && pCode !== target;
  });
  return saveOtherLiabilityAccountsList(next);
};

export const loadPartnerLiabilityMovements = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem(PARTNER_LIABILITY_MOVEMENTS_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (_) {}
  return [];
};

export const savePartnerLiabilityMovements = (list = []) => {
  const clean = Array.isArray(list) ? list : [];
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(PARTNER_LIABILITY_MOVEMENTS_STORAGE_KEY, JSON.stringify(clean));
    }
  } catch (_) {}
  return clean;
};

export const recordPartnerLiabilityMovement = (list = [], movPayload = {}) => {
  const base = Array.isArray(list) ? [...list] : [];
  const tipo = String(movPayload.tipo || 'CARGO_PASIVO').toUpperCase() === 'ABONO_SOCIO' ? 'ABONO_SOCIO' : 'CARGO_PASIVO';
  const entry = {
    id: String(movPayload.id || `PASMOV-${Date.now().toString().slice(-7)}`),
    fecha: String(movPayload.fecha || new Date().toISOString().split('T')[0]),
    tipo,
    cuentaId: String(movPayload.cuentaId || '').trim(),
    cuentaCodigo: String(movPayload.cuentaCodigo || '').trim(),
    cuentaNombre: String(movPayload.cuentaNombre || 'Cuenta por Pagar Socio').trim(),
    montoUsd: round2(Math.max(0, Number(movPayload.montoUsd || 0))),
    montoBs: round2(Math.max(0, Number(movPayload.montoBs || 0))),
    concepto: String(movPayload.concepto || '').trim() || (tipo === 'ABONO_SOCIO' ? 'Abono / Reembolso a Socio' : 'Cargo / Compromiso Pasivo Socio'),
    referencia: String(movPayload.referencia || '').trim(),
    usuario: String(movPayload.usuario || 'ADMINISTRACION').trim(),
    origen: String(movPayload.origen || 'MANUAL_PASIVOS').trim() || 'MANUAL_PASIVOS',
    cashMovementId: String(movPayload.cashMovementId || '').trim(),
    treasuryAccountId: String(movPayload.treasuryAccountId || '').trim(),
    treasuryAccountLabel: String(movPayload.treasuryAccountLabel || '').trim(),
    createdAt: movPayload.createdAt || new Date().toISOString()
  };
  return savePartnerLiabilityMovements([entry, ...base]);
};

export const deletePartnerLiabilityMovementFromList = (list = [], movId) => {
  const target = String(movId || '').trim();
  const next = (Array.isArray(list) ? list : []).filter(m => m && String(m.id || '').trim() !== target);
  return savePartnerLiabilityMovements(next);
};

export const removePartnerLiabilityMovementByCashId = (cashMovementId) => {
  const targetCashId = String(cashMovementId || '').trim();
  if (!targetCashId) return loadPartnerLiabilityMovements();
  const current = loadPartnerLiabilityMovements();
  const next = current.filter(m => m && String(m.cashMovementId || '').trim() !== targetCashId);
  return savePartnerLiabilityMovements(next);
};

export const getOfficialPlanDeCuentasPasivos = () => {
  return (PLAN_DE_CUENTAS_MOTORVEN || []).filter(c => c && c.grupo === 'PASIVO');
};

export const buildUnifiedPartnerMovementsLedger = ({
  partnerAccounts = [],
  manualMovements = [],
  supplierPayments = []
} = {}) => {
  const partnerIdSet = new Set();
  const partnerCodeSet = new Set();
  (Array.isArray(partnerAccounts) ? partnerAccounts : []).forEach(p => {
    if (!p) return;
    if (p.id) partnerIdSet.add(String(p.id).trim().toUpperCase());
    if (p.codigo) partnerCodeSet.add(String(p.codigo).trim().toUpperCase());
  });

  const cxpEntries = (Array.isArray(supplierPayments) ? supplierPayments : [])
    .filter(pay => {
      if (!pay || pay.anulado) return false;
      const acctType = String(pay.accountType || pay.account_type || '').toUpperCase();
      if (acctType === 'PASIVO_SOCIO') return true;
      const cid = String(pay.cuentaId || pay.cuenta_id || '').trim().toUpperCase();
      return cid && (partnerIdSet.has(cid) || partnerCodeSet.has(cid));
    })
    .map(pay => ({
      id: pay.id || pay.pagoNum || `CXP-${Math.random().toString(36).slice(2, 8)}`,
      fecha: String(pay.fechaPago || pay.fecha || '').slice(0, 10),
      tipo: 'CARGO_PASIVO',
      cuentaId: String(pay.cuentaId || '').trim(),
      cuentaCodigo: '',
      cuentaNombre: String(pay.cuentaNombre || 'Cuenta por Pagar Socio'),
      proveedor: String(pay.provNombre || '').trim(),
      montoUsd: round2(Number(pay.montoUsd || 0)),
      montoBs: round2(Number(pay.montoBs || 0)),
      tasa: Number(pay.tasaPago || pay.tasa || 0),
      concepto: String(pay.descrip || `Pago CxP asumido (${pay.provNombre || 'Proveedor'})`),
      referencia: String(pay.referencia || pay.pagoNum || ''),
      usuario: 'CXP_PROVEEDORES',
      origen: 'CXP_PAGO_PROVEEDOR',
      createdAt: pay.fechaSincronizacion || pay.fechaPago || ''
    }));

  const manualEntries = (Array.isArray(manualMovements) ? manualMovements : []).map(m => ({
    ...m,
    fecha: String(m.fecha || '').slice(0, 10),
    montoUsd: round2(Number(m.montoUsd || 0)),
    montoBs: round2(Number(m.montoBs || 0)),
    origen: m.origen || 'MANUAL_PASIVOS'
  }));

  return [...manualEntries, ...cxpEntries].sort((a, b) => {
    const da = String(a.fecha || '');
    const db = String(b.fecha || '');
    if (da !== db) return db.localeCompare(da);
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
};

export const computePasivosDashboardMetrics = ({
  partnerAccounts = [],
  otherLiabilityAccounts = [],
  accountsPayable = [],
  supplierPayments = [],
  config = {}
} = {}) => {
  const { tasaBcv } = resolveExchangeRates(config);
  const sociosSummary = computePartnerPayableSummary(partnerAccounts, config);

  let otrosPasivosUsd = 0;
  let otrosPasivosBs = 0;
  let otrosPasivosActiveCount = 0;
  (Array.isArray(otherLiabilityAccounts) ? otherLiabilityAccounts : []).forEach(acc => {
    if (!acc) return;
    if (acc.activa !== false) otrosPasivosActiveCount += 1;
    const rawUsd = Number(acc.saldoUsd || 0);
    const rawBs = Number(acc.saldoBs || 0);
    const isBs = String(acc.moneda || '').toUpperCase() === 'BS';
    const usd = isBs && rawBs > 0 && tasaBcv > 0 ? round2(rawBs / tasaBcv) : round2(rawUsd);
    const bs = rawBs > 0 ? round2(rawBs) : round2(usd * tasaBcv);
    otrosPasivosUsd += usd;
    otrosPasivosBs += bs;
  });

  let proveedoresUsd = 0;
  let proveedoresBs = 0;
  let proveedoresDocsCount = 0;
  (Array.isArray(accountsPayable) ? accountsPayable : []).forEach(doc => {
    if (!doc || doc.anulado) return;
    const saldoUsd = Number(doc.saldoUsd ?? doc.saldo_usd ?? doc.montoUsd ?? 0);
    if (!(saldoUsd > 0.01)) return;
    proveedoresDocsCount += 1;
    proveedoresUsd += saldoUsd;
    const docRate = Number(doc.tasaPago || doc.tasa || tasaBcv) || tasaBcv;
    const rawBs = Number(doc.saldoBs ?? doc.saldo_bs ?? 0);
    proveedoresBs += rawBs > 0 ? rawBs : round2(saldoUsd * docRate);
  });

  const unifiedCxpPartnerPayments = buildUnifiedPartnerMovementsLedger({
    partnerAccounts,
    manualMovements: [],
    supplierPayments
  });
  const pagosAsumidosSociosUsd = round2(
    unifiedCxpPartnerPayments.reduce((sum, item) => sum + Number(item.montoUsd || 0), 0)
  );

  const totalPasivosMonitoreadosUsd = round2(sociosSummary.totalUsd + otrosPasivosUsd + proveedoresUsd);
  const totalPasivosMonitoreadosBs = round2(sociosSummary.totalBs + otrosPasivosBs + proveedoresBs);

  return {
    sociosUsd: sociosSummary.totalUsd,
    sociosBs: sociosSummary.totalBs,
    sociosActiveCount: sociosSummary.activeCount,
    sociosTotalCount: sociosSummary.totalCount,
    otrosPasivosUsd: round2(otrosPasivosUsd),
    otrosPasivosBs: round2(otrosPasivosBs),
    otrosPasivosActiveCount,
    proveedoresUsd: round2(proveedoresUsd),
    proveedoresBs: round2(proveedoresBs),
    proveedoresDocsCount,
    pagosAsumidosSociosUsd,
    pagosAsumidosSociosCount: unifiedCxpPartnerPayments.length,
    totalPasivosMonitoreadosUsd,
    totalPasivosMonitoreadosBs
  };
};
