/**
 * Utilidades puras para emparejar cuentas bancarias / cajas operativas
 * y aplicar variaciones bimonetarias (USD y Bs) sin discrepancias entre id y código.
 */

const round2 = (n) => Number((Number(n || 0)).toFixed(2));

const stripPrefix = (raw, prefixRegex) =>
  String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(prefixRegex, '');

const collectTargetTokens = (targetRef, kindPrefixRegex, stripRegex) => {
  const tokens = new Set();
  const pushVal = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return;
    const upper = s.toUpperCase().replace(kindPrefixRegex, '');
    if (upper) {
      tokens.add(upper);
      const stripped = stripPrefix(upper, stripRegex);
      if (stripped) tokens.add(stripped);
    }
  };

  if (targetRef && typeof targetRef === 'object') {
    pushVal(targetRef.bankId);
    pushVal(targetRef.rawId);
    pushVal(targetRef.id);
    pushVal(targetRef.codCta);
    pushVal(targetRef.cod_cta);
    pushVal(targetRef.coCaja);
    pushVal(targetRef.co_caja);
    pushVal(targetRef.key);
  } else {
    pushVal(targetRef);
  }
  return tokens;
};

export const inferTreasuryAccountKind = (accountRef) => {
  if (!accountRef) return '';
  if (typeof accountRef === 'string') {
    const upper = accountRef.trim().toUpperCase();
    if (upper.startsWith('CAJA:') || upper.startsWith('CAJA-')) return 'CAJA';
    if (upper.startsWith('BANCO:') || upper.startsWith('CTA-')) return 'BANCO';
    return '';
  }
  const explicit = String(accountRef.kind || accountRef.accountType || '').trim().toUpperCase();
  if (explicit === 'CAJA' || explicit === 'BANCO') return explicit;
  const key = String(accountRef.key || accountRef.id || accountRef.rawId || '').trim().toUpperCase();
  if (key.startsWith('CAJA:') || key.startsWith('CAJA-')) return 'CAJA';
  if (key.startsWith('BANCO:') || key.startsWith('CTA-') || accountRef.codCta || accountRef.cod_cta) return 'BANCO';
  if (accountRef.coCaja || accountRef.co_caja) return 'CAJA';
  return '';
};

export const matchesCashDesk = (desk, targetRef) => {
  if (!desk || !targetRef) return false;
  const targetTokens = collectTargetTokens(targetRef, /^CAJA:/i, /^CAJ(?:A)?-/i);
  if (targetTokens.size === 0) return false;

  const deskCandidates = [
    desk.id,
    desk.coCaja,
    desk.co_caja
  ]
    .map((v) => String(v ?? '').trim().toUpperCase())
    .filter(Boolean);

  return deskCandidates.some((cand) => {
    if (targetTokens.has(cand)) return true;
    const stripped = stripPrefix(cand, /^CAJ(?:A)?-/i);
    return Boolean(stripped && targetTokens.has(stripped));
  });
};

export const matchesBankAccount = (bank, targetRef) => {
  if (!bank || !targetRef) return false;
  const targetTokens = collectTargetTokens(targetRef, /^BANCO:/i, /^CTA-/i);
  if (targetTokens.size === 0) return false;

  const bankCandidates = [
    bank.id,
    bank.codCta,
    bank.cod_cta,
    bank.coBan,
    bank.co_ban
  ]
    .map((v) => String(v ?? '').trim().toUpperCase())
    .filter(Boolean);

  return bankCandidates.some((cand) => {
    if (targetTokens.has(cand)) return true;
    const stripped = stripPrefix(cand, /^CTA-/i);
    return Boolean(stripped && targetTokens.has(stripped));
  });
};

export const applyTreasuryBalanceDelta = (
  record,
  { deltaUsd = 0, deltaBs = 0, clampZero = false, nowIso = new Date().toISOString() } = {}
) => {
  if (!record) return null;
  const curUsd = Number(record.saldoUsd ?? record.saldo_usd ?? 0) || 0;
  const curBs = Number(record.saldoBs ?? record.saldo_bs ?? 0) || 0;

  let nextUsd = round2(curUsd + (Number(deltaUsd) || 0));
  let nextBs = round2(curBs + (Number(deltaBs) || 0));
  if (clampZero) {
    nextUsd = Math.max(0, nextUsd);
    nextBs = Math.max(0, nextBs);
  }

  return {
    ...record,
    saldoUsd: nextUsd,
    saldo_usd: nextUsd,
    saldoBs: nextBs,
    saldo_bs: nextBs,
    saldoActual: nextBs,
    saldo_actual: nextBs,
    fechaActualizacion: nowIso,
    fecha_actualizacion: nowIso
  };
};

export const DEFAULT_BCV_RATE = 904.44;
export const DEFAULT_KEYSTONE_RATE = 909.90;

export const resolveExchangeRates = (config = {}) => {
  const rawBcv = Number(config?.tasaDolar ?? config?.tasa_dolar ?? 0);
  const tasaBcv = Number.isFinite(rawBcv) && rawBcv > 1 ? rawBcv : DEFAULT_BCV_RATE;
  const rawKey = Number(config?.tasaKeystone ?? config?.tasa_keystone ?? 0);
  const tasaKeystone = Number.isFinite(rawKey) && rawKey > 1 ? rawKey : (config?.tasaKeystone === undefined && config?.tasa_keystone === undefined ? Math.max(tasaBcv, DEFAULT_KEYSTONE_RATE) : tasaBcv);
  return { tasaBcv, tasaKeystone };
};

export const computeBankAccountValuation = (bank = {}, config = {}) => {
  const { tasaBcv } = resolveExchangeRates(config);
  const moneda = String(bank?.moneda || 'BS').toUpperCase();
  const saldoBs = Number(bank?.saldoBs ?? bank?.saldo_bs ?? bank?.saldoActual ?? bank?.saldo_actual ?? 0) || 0;
  const rawUsd = Number(bank?.saldoUsd ?? bank?.saldo_usd ?? 0) || 0;
  const isForeignCurrency = ['USD', 'EUR', 'USDT', 'USDC'].includes(moneda);

  let usd = rawUsd;
  let bs = saldoBs;

  if (isForeignCurrency || (rawUsd !== 0 && saldoBs === 0)) {
    usd = round2(rawUsd);
    bs = saldoBs !== 0 ? round2(saldoBs) : round2(usd * tasaBcv);
  } else {
    bs = round2(saldoBs);
    usd = saldoBs !== 0 && tasaBcv > 0 ? round2(saldoBs / tasaBcv) : round2(rawUsd);
  }

  return { usd, bs, moneda };
};

export const computeBankBalancesSummary = (bankAccounts = [], config = {}) => {
  const list = Array.isArray(bankAccounts) ? bankAccounts : [];
  let totalBs = 0;
  let totalUsd = 0;
  const items = list.map((b) => {
    const val = computeBankAccountValuation(b, config);
    totalBs += val.bs;
    totalUsd += val.usd;
    return { ...b, resolvedUsd: val.usd, resolvedBs: val.bs };
  });
  return {
    totalBs: round2(totalBs),
    totalUsd: round2(totalUsd),
    items
  };
};

export const computeCashDesksSummary = (cashDesks = [], config = {}) => {
  const { tasaBcv } = resolveExchangeRates(config);
  const list = Array.isArray(cashDesks) ? cashDesks : [];
  let totalUsd = 0;
  let totalBs = 0;
  let physicalUsd = 0;
  let physicalBs = 0;

  const items = list.map((d) => {
    const moneda = String(d?.moneda || 'USD').toUpperCase();
    const rawUsd = Number(d?.saldoUsd ?? d?.saldo_usd ?? 0) || 0;
    const rawBs = Number(d?.saldoBs ?? d?.saldo_bs ?? 0) || 0;
    const isBsDesk = moneda === 'BS';
    const usd = isBsDesk
      ? (rawBs !== 0 && tasaBcv > 0 ? round2(rawBs / tasaBcv) : round2(rawUsd))
      : round2(rawUsd);
    const bs = rawBs !== 0 ? round2(rawBs) : round2(usd * tasaBcv);

    totalUsd += usd;
    totalBs += bs;

    const descUpper = String(d?.descripcion || d?.desCaja || d?.des_caja || '').toUpperCase();
    const isDigital = descUpper.includes('ZELLE') || descUpper.includes('USDT') || descUpper.includes('USDC') || descUpper.includes('BINANCE') || descUpper.includes('KONTIGO') || ['USDT', 'USDC'].includes(moneda);
    if (isBsDesk) {
      physicalBs += bs;
    } else if (!isDigital && moneda === 'USD') {
      physicalUsd += usd;
    }

    return { ...d, resolvedUsd: usd, resolvedBs: bs, isDigital, isBsDesk };
  });

  return {
    totalUsd: round2(totalUsd),
    totalBs: round2(totalBs),
    physicalUsd: round2(physicalUsd),
    physicalBs: round2(physicalBs),
    items
  };
};

export const toLocalDateKey = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isMovementToday = (mov, referenceDate = new Date()) => {
  const movKey = toLocalDateKey(mov?.fecha || mov?.createdAt || mov?.created_at);
  const refKey = toLocalDateKey(referenceDate);
  return Boolean(movKey && refKey && movKey === refKey);
};

export const computeTodayCashInflows = (cashMovements = [], referenceDate = new Date()) => {
  const list = Array.isArray(cashMovements) ? cashMovements : [];
  let totalUsd = 0;
  let totalBs = 0;
  list.forEach((m) => {
    if (!m || String(m.tipo || '').toUpperCase() !== 'INGRESO') return;
    if (!isMovementToday(m, referenceDate)) return;
    totalUsd += Number(m.montoUsd ?? m.monto_usd ?? 0) || 0;
    totalBs += Number(m.montoBs ?? m.monto_bs ?? 0) || 0;
  });
  return { totalUsd: round2(totalUsd), totalBs: round2(totalBs) };
};

export const validateSufficientTreasuryBalance = (record, { deltaUsd = 0, deltaBs = 0, label = 'la cuenta seleccionada' } = {}) => {
  if (!record) return { ok: false, message: `No se encontró ${label} para verificar saldo.` };
  const curUsd = Number(record.saldoUsd ?? record.saldo_usd ?? 0) || 0;
  const curBs = Number(record.saldoBs ?? record.saldo_bs ?? 0) || 0;
  const moneda = String(record.moneda || '').toUpperCase();

  if (deltaBs < 0 && moneda === 'BS') {
    const nextBs = round2(curBs + deltaBs);
    if (nextBs < -0.01) {
      return {
        ok: false,
        message: `Saldo insuficiente en ${record.descripcion || record.bancoNombre || label}: disponible Bs. ${curBs.toFixed(2)}, requerido Bs. ${Math.abs(deltaBs).toFixed(2)}.`
      };
    }
  }

  if (deltaUsd < 0 && moneda !== 'BS') {
    const nextUsd = round2(curUsd + deltaUsd);
    if (nextUsd < -0.01) {
      return {
        ok: false,
        message: `Saldo insuficiente en ${record.descripcion || record.bancoNombre || label}: disponible $ ${curUsd.toFixed(2)}, requerido $ ${Math.abs(deltaUsd).toFixed(2)}.`
      };
    }
  }

  if (deltaBs < 0 && curBs > 0 && curUsd === 0 && round2(curBs + deltaBs) < -0.01) {
    return {
      ok: false,
      message: `Saldo insuficiente en Bs en ${record.descripcion || record.bancoNombre || label}: disponible Bs. ${curBs.toFixed(2)}.`
    };
  }

  return { ok: true };
};

export const resolveTreasuryTargetForPaymentMethod = (metodoPago = '', cashDesks = [], bankAccounts = []) => {
  const method = String(metodoPago || '').trim().toUpperCase();
  const desks = Array.isArray(cashDesks) ? cashDesks : [];
  const banks = Array.isArray(bankAccounts) ? bankAccounts : [];

  if (!method || method === 'CREDITO') return null;

  const findDesk = (pred) => desks.find((d) => d?.activa !== false && pred(String(d.descripcion || d.desCaja || '').toUpperCase(), String(d.moneda || '').toUpperCase()));

  if (method.includes('EFECTIVO_BS') || method === 'CASH_BS') {
    const desk = findDesk((desc, mon) => mon === 'BS' || desc.includes('BS'));
    if (desk) return { kind: 'CAJA', accountRef: `CAJA:${desk.id || desk.coCaja}`, record: desk, label: desk.descripcion };
  }
  if (method.includes('ZELLE')) {
    const desk = findDesk((desc) => desc.includes('ZELLE'));
    if (desk) return { kind: 'CAJA', accountRef: `CAJA:${desk.id || desk.coCaja}`, record: desk, label: desk.descripcion };
  }
  if (method.includes('USDT') || method.includes('BINANCE')) {
    const desk = findDesk((desc, mon) => desc.includes('USDT') || desc.includes('BINANCE') || mon === 'USDT');
    if (desk) return { kind: 'CAJA', accountRef: `CAJA:${desk.id || desk.coCaja}`, record: desk, label: desk.descripcion };
  }
  if (method.includes('USDC') || method.includes('KONTIGO')) {
    const desk = findDesk((desc, mon) => desc.includes('USDC') || desc.includes('KONTIGO') || mon === 'USDC');
    if (desk) return { kind: 'CAJA', accountRef: `CAJA:${desk.id || desk.coCaja}`, record: desk, label: desk.descripcion };
  }
  if (method.includes('EFECTIVO') || method === 'DIVISAS' || method === 'USD') {
    const desk = findDesk((desc, mon) => mon === 'USD' && !desc.includes('ZELLE') && !desc.includes('USDT') && !desc.includes('USDC'))
      || findDesk((_, mon) => mon === 'USD');
    if (desk) return { kind: 'CAJA', accountRef: `CAJA:${desk.id || desk.coCaja}`, record: desk, label: desk.descripcion };
  }
  if (method.includes('PAGO_MOVIL') || method.includes('TRANSFERENCIA') || method.includes('PUNTO') || method.includes('DEBITO') || method.includes('TARJETA')) {
    const bsBank = banks.find((b) => String(b?.moneda || 'BS').toUpperCase() === 'BS') || banks[0];
    if (bsBank) {
      const code = bsBank.id || bsBank.codCta || bsBank.cod_cta;
      return { kind: 'BANCO', accountRef: `BANCO:${code}`, record: bsBank, label: bsBank.bancoNombre || bsBank.banco_nombre || code };
    }
  }

  return null;
};
