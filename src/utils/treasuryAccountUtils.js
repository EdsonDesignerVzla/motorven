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

export const resolveOpeningBalanceMeta = (record) => {
  if (!record || typeof record !== 'object') {
    return {
      hasOpeningBalance: false,
      saldoInicialUsd: null,
      saldoInicialBs: null,
      fechaSaldoInicial: null,
      usuarioSaldoInicial: null
    };
  }
  const rawUsd = record.saldoInicialUsd ?? record.saldo_inicial_usd;
  const rawBs = record.saldoInicialBs ?? record.saldo_inicial_bs;
  const rawFecha = record.fechaSaldoInicial || record.fecha_saldo_inicial || null;
  const rawUser = record.usuarioSaldoInicial || record.usuario_saldo_inicial || null;

  const hasUsd = rawUsd !== undefined && rawUsd !== null && rawUsd !== '' && Number.isFinite(Number(rawUsd));
  const hasBs = rawBs !== undefined && rawBs !== null && rawBs !== '' && Number.isFinite(Number(rawBs));
  const hasFecha = Boolean(rawFecha && String(rawFecha).trim());
  const hasOpeningBalance = hasFecha || hasUsd || hasBs;

  return {
    hasOpeningBalance,
    saldoInicialUsd: hasUsd ? round2(Number(rawUsd)) : (hasOpeningBalance ? 0 : null),
    saldoInicialBs: hasBs ? round2(Number(rawBs)) : (hasOpeningBalance ? 0 : null),
    fechaSaldoInicial: hasFecha ? String(rawFecha).trim() : null,
    usuarioSaldoInicial: rawUser && String(rawUser).trim() ? String(rawUser).trim() : null
  };
};

export const LOCKED_OPENING_BALANCE_DESK_CODES = new Set(['CAJA-04']);

/**
 * Indica si una caja tiene bloqueada la edición del Saldo Inicial de apertura
 * para evitar desfases con sus movimientos reales.
 */
export const isOpeningBalanceLockedForDesk = (deskOrCode) => {
  if (!deskOrCode) return false;
  const raw = typeof deskOrCode === 'object'
    ? (deskOrCode.coCaja || deskOrCode.co_caja || deskOrCode.id || '')
    : String(deskOrCode);
  const norm = String(raw || '').trim().toUpperCase();
  return LOCKED_OPENING_BALANCE_DESK_CODES.has(norm);
};

export const mergeOpeningBalanceFields = (
  incoming = {},
  existing = null,
  { nowIso = new Date().toISOString(), actorName = null, markAsOpening = false } = {}
) => {
  const incMeta = resolveOpeningBalanceMeta(incoming);
  const extMeta = resolveOpeningBalanceMeta(existing);

  if (markAsOpening) {
    const usdVal = incMeta.saldoInicialUsd !== null
      ? incMeta.saldoInicialUsd
      : round2(Number(incoming.saldoUsd ?? incoming.saldo_usd ?? 0) || 0);
    const bsVal = incMeta.saldoInicialBs !== null
      ? incMeta.saldoInicialBs
      : round2(Number(incoming.saldoBs ?? incoming.saldo_bs ?? 0) || 0);
    const fechaVal = incMeta.fechaSaldoInicial || nowIso;
    const userVal = incMeta.usuarioSaldoInicial || (actorName && String(actorName).trim()) || extMeta.usuarioSaldoInicial || 'Sistema';
    return {
      ...incoming,
      saldoInicialUsd: usdVal,
      saldo_inicial_usd: usdVal,
      saldoInicialBs: bsVal,
      saldo_inicial_bs: bsVal,
      fechaSaldoInicial: fechaVal,
      fecha_saldo_inicial: fechaVal,
      usuarioSaldoInicial: userVal,
      usuario_saldo_inicial: userVal
    };
  }

  if (incMeta.hasOpeningBalance) {
    const usdVal = incMeta.saldoInicialUsd ?? extMeta.saldoInicialUsd ?? 0;
    const bsVal = incMeta.saldoInicialBs ?? extMeta.saldoInicialBs ?? 0;
    const fechaVal = incMeta.fechaSaldoInicial || extMeta.fechaSaldoInicial || nowIso;
    const userVal = incMeta.usuarioSaldoInicial || extMeta.usuarioSaldoInicial || (actorName && String(actorName).trim()) || null;
    return {
      ...incoming,
      saldoInicialUsd: usdVal,
      saldo_inicial_usd: usdVal,
      saldoInicialBs: bsVal,
      saldo_inicial_bs: bsVal,
      fechaSaldoInicial: fechaVal,
      fecha_saldo_inicial: fechaVal,
      ...(userVal ? { usuarioSaldoInicial: userVal, usuario_saldo_inicial: userVal } : {})
    };
  }

  if (extMeta.hasOpeningBalance) {
    return {
      ...incoming,
      saldoInicialUsd: extMeta.saldoInicialUsd,
      saldo_inicial_usd: extMeta.saldoInicialUsd,
      saldoInicialBs: extMeta.saldoInicialBs,
      saldo_inicial_bs: extMeta.saldoInicialBs,
      fechaSaldoInicial: extMeta.fechaSaldoInicial,
      fecha_saldo_inicial: extMeta.fechaSaldoInicial,
      ...(extMeta.usuarioSaldoInicial
        ? { usuarioSaldoInicial: extMeta.usuarioSaldoInicial, usuario_saldo_inicial: extMeta.usuarioSaldoInicial }
        : {})
    };
  }

  return { ...incoming };
};

export const formatTreasuryTimestampVe = (isoValue) => {
  if (!isoValue) return '';
  const dt = isoValue instanceof Date ? isoValue : new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return String(isoValue);
  try {
    return dt.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (_) {
    return dt.toISOString().replace('T', ' ').slice(0, 16);
  }
};

/**
 * Convierte un ISO UTC a valor 'YYYY-MM-DDTHH:mm' en hora oficial de Venezuela (UTC-4)
 * para usar en <input type="datetime-local" />.
 */
export const isoToVetDatetimeLocal = (isoValue) => {
  if (!isoValue) return '';
  const dt = isoValue instanceof Date ? isoValue : new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return '';
  // Venezuela es UTC-4 fijo (sin horario de verano)
  const vetMs = dt.getTime() - (4 * 60 * 60 * 1000);
  const vetDate = new Date(vetMs);
  const y = vetDate.getUTCFullYear();
  const m = String(vetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vetDate.getUTCDate()).padStart(2, '0');
  const hh = String(vetDate.getUTCHours()).padStart(2, '0');
  const mm = String(vetDate.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

/**
 * Convierte un valor 'YYYY-MM-DDTHH:mm' en hora oficial de Venezuela (UTC-4) a ISO UTC.
 */
export const vetDatetimeLocalToIso = (localValue) => {
  const raw = String(localValue || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
    const parsed = new Date(`${withSeconds}-04:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
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

  const opening = resolveOpeningBalanceMeta(record);

  return {
    ...record,
    saldoUsd: nextUsd,
    saldo_usd: nextUsd,
    saldoBs: nextBs,
    saldo_bs: nextBs,
    saldoActual: nextBs,
    saldo_actual: nextBs,
    ...(opening.hasOpeningBalance
      ? {
          saldoInicialUsd: opening.saldoInicialUsd,
          saldo_inicial_usd: opening.saldoInicialUsd,
          saldoInicialBs: opening.saldoInicialBs,
          saldo_inicial_bs: opening.saldoInicialBs,
          fechaSaldoInicial: opening.fechaSaldoInicial,
          fecha_saldo_inicial: opening.fechaSaldoInicial,
          ...(opening.usuarioSaldoInicial
            ? { usuarioSaldoInicial: opening.usuarioSaldoInicial, usuario_saldo_inicial: opening.usuarioSaldoInicial }
            : {})
        }
      : {}),
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
  const rawEuro = Number(config?.tasaEuro ?? config?.tasa_euro ?? 0);
  const tasaEuro = Number.isFinite(rawEuro) && rawEuro > 1 ? rawEuro : tasaBcv;
  const rawUsdt = Number(config?.tasaUsdt ?? config?.tasa_usdt ?? 0);
  const tasaUsdt = Number.isFinite(rawUsdt) && rawUsdt > 1 ? rawUsdt : tasaKeystone;
  return { tasaBcv, tasaKeystone, tasaEuro, tasaUsdt };
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

/**
 * Resuelve la caja operativa o cuenta bancaria afectada por un movimiento de caja.
 */
export const resolveTreasuryAccountForMovement = (movement, cashDesks = [], bankAccounts = []) => {
  if (!movement || typeof movement !== 'object') return null;
  const desks = Array.isArray(cashDesks) ? cashDesks : [];
  const banks = Array.isArray(bankAccounts) ? bankAccounts : [];

  const toResult = (kind, record) => {
    if (!record) return null;
    if (kind === 'CAJA') {
      const code = record.coCaja || record.co_caja || record.id;
      return {
        kind: 'CAJA',
        accountRef: `CAJA:${record.id || code}`,
        id: record.id || code,
        code,
        record,
        label: record.descripcion || record.desCaja || code
      };
    }
    const code = record.codCta || record.cod_cta || record.id;
    return {
      kind: 'BANCO',
      accountRef: `BANCO:${record.id || code}`,
      id: record.id || code,
      code,
      record,
      label: record.bancoNombre || record.banco_nombre || record.numCta || code
    };
  };

  // 1. Identificador explícito de caja
  const explicitKind = String(movement.accountKind || movement.account_kind || '').trim().toUpperCase();
  const rawCajaId = String(movement.cajaId || movement.caja_id || '').trim();
  if (rawCajaId && explicitKind !== 'BANCO') {
    const desk = desks.find((d) => matchesCashDesk(d, rawCajaId));
    if (desk) return toResult('CAJA', desk);
  }

  // 2. Identificador explícito de cuenta (cuentaId / cuenta_id)
  const rawCuentaId = String(movement.cuentaId || movement.cuenta_id || '').trim();
  if (rawCuentaId) {
    const inferredKind = (explicitKind === 'BANCO' || explicitKind === 'CAJA')
      ? explicitKind
      : inferTreasuryAccountKind(rawCuentaId);
    if (inferredKind === 'BANCO') {
      const bank = banks.find((b) => matchesBankAccount(b, rawCuentaId));
      if (bank) return toResult('BANCO', bank);
    } else if (inferredKind === 'CAJA') {
      const desk = desks.find((d) => matchesCashDesk(d, rawCuentaId));
      if (desk) return toResult('CAJA', desk);
    }
    // Los códigos numéricos cortos ("01", "02", "03"...) sin cajaId corresponden a cod_cta bancarios
    const isPlainNumericBankCode = /^\d{1,3}$/.test(rawCuentaId) && !rawCajaId;
    if (isPlainNumericBankCode) {
      const anyBankFirst = banks.find((b) => matchesBankAccount(b, rawCuentaId));
      if (anyBankFirst) return toResult('BANCO', anyBankFirst);
    }
    const anyDesk = desks.find((d) => matchesCashDesk(d, rawCuentaId));
    if (anyDesk) return toResult('CAJA', anyDesk);
    const anyBank = banks.find((b) => matchesBankAccount(b, rawCuentaId));
    if (anyBank) return toResult('BANCO', anyBank);
  }

  // 3. Emparejamiento por nombre, número de cuenta bancaria o código en cuentaNombre / cajaOBanco
  const accountName = String(
    movement.cuentaNombre || movement.cuenta_nombre || movement.cajaOBanco || movement.caja_o_banco || ''
  ).trim();
  const normName = accountName.toUpperCase();
  if (normName) {
    const matchingDesk = desks.find((d) => {
      const desc = String(d?.descripcion || d?.desCaja || '').trim().toUpperCase();
      const code = String(d?.coCaja || d?.co_caja || '').trim().toUpperCase();
      return (desc && (normName === desc || normName.includes(desc) || desc.includes(normName)))
        || (code && (normName === code || normName.startsWith(`${code} `) || normName.includes(code)));
    });
    if (matchingDesk) return toResult('CAJA', matchingDesk);

    const matchingBank = banks.find((b) => {
      const bName = String(b?.bancoNombre || b?.banco_nombre || '').trim().toUpperCase();
      const numCta = String(b?.numCta || b?.num_cta || '').trim().toUpperCase();
      const codCta = String(b?.codCta || b?.cod_cta || '').trim().toUpperCase();
      return (numCta && numCta.length >= 6 && normName.includes(numCta))
        || (bName && (normName === bName || normName.includes(bName) || bName.includes(normName)))
        || (codCta && normName === codCta);
    });
    if (matchingBank) return toResult('BANCO', matchingBank);
  }

  // 4. Fallback por método de pago (EFECTIVO_USD, ZELLE, PAGO_MOVIL, etc.)
  const methodCandidate = movement.metodoPago || movement.metodo_pago || movement.metodo || accountName;
  const fallbackTarget = resolveTreasuryTargetForPaymentMethod(methodCandidate, desks, banks);
  if (fallbackTarget?.record) {
    return toResult(fallbackTarget.kind, fallbackTarget.record);
  }

  return null;
};

/**
 * Calcula los deltas inversos necesarios en USD y Bs para revertir un movimiento eliminado.
 * - Eliminar un INGRESO resta su monto del saldo (-monto).
 * - Eliminar un EGRESO devuelve su monto al saldo (+monto).
 */
export const computeMovementReversalDelta = (movement) => {
  const tipoUpper = String(movement?.tipo || '').trim().toUpperCase();
  const sign = tipoUpper === 'EGRESO' ? 1 : -1;
  const rawUsd = round2(Math.abs(Number(movement?.montoUsd ?? movement?.monto_usd ?? 0) || 0));
  const rawBs = round2(Math.abs(Number(movement?.montoBs ?? movement?.monto_bs ?? 0) || 0));
  return {
    sign,
    deltaUsd: round2(sign * rawUsd),
    deltaBs: round2(sign * rawBs)
  };
};

/**
 * Determina si un movimiento pertenece a una cuenta operativa específica ('CAJA' | 'BANCO')
 * o al conjunto completo de ese tipo cuando targetRecord es null.
 */
export const doesMovementBelongToAccount = (
  movement,
  targetKind = 'CAJA',
  targetRecord = null,
  cashDesks = [],
  bankAccounts = []
) => {
  const resolved = resolveTreasuryAccountForMovement(movement, cashDesks, bankAccounts);
  if (!resolved) return false;
  if (targetKind && resolved.kind !== String(targetKind).toUpperCase()) return false;
  if (!targetRecord) return true;
  if (resolved.kind === 'CAJA') {
    return matchesCashDesk(targetRecord, resolved.record);
  }
  return matchesBankAccount(targetRecord, resolved.record);
};

/**
 * Resume Entradas (INGRESO), Salidas (EGRESO) y Neto para una lista de movimientos de caja/banco.
 */
export const summarizeAccountMovements = (movements = []) => {
  const list = Array.isArray(movements) ? movements : [];
  let entradasCount = 0;
  let entradasUsd = 0;
  let entradasBs = 0;
  let salidasCount = 0;
  let salidasUsd = 0;
  let salidasBs = 0;

  list.forEach((m) => {
    if (!m) return;
    const isIngreso = String(m.tipo || '').trim().toUpperCase() === 'INGRESO';
    const usd = Number(m.montoUsd ?? m.monto_usd ?? 0) || 0;
    const bs = Number(m.montoBs ?? m.monto_bs ?? 0) || 0;
    if (isIngreso) {
      entradasCount += 1;
      entradasUsd += usd;
      entradasBs += bs;
    } else {
      salidasCount += 1;
      salidasUsd += usd;
      salidasBs += bs;
    }
  });

  return {
    totalCount: entradasCount + salidasCount,
    entradasCount,
    entradasUsd: round2(entradasUsd),
    entradasBs: round2(entradasBs),
    salidasCount,
    salidasUsd: round2(salidasUsd),
    salidasBs: round2(salidasBs),
    netoUsd: round2(entradasUsd - salidasUsd),
    netoBs: round2(entradasBs - salidasBs)
  };
};

/**
 * Filtra movimientos por Día, Semana (Lun-Dom), Mes (YYYY-MM) o Período personalizado (desde..hasta).
 */
export const filterMovementsByPeriod = (
  movements = [],
  { periodMode = 'ALL', refDate = '', refMonth = '', fromDate = '', toDate = '' } = {},
  referenceNow = new Date()
) => {
  const list = Array.isArray(movements) ? movements : [];
  const mode = String(periodMode || 'ALL').toUpperCase().trim();
  if (mode === 'ALL') return list;

  const todayKey = toLocalDateKey(referenceNow);
  const anchorKey = /^\d{4}-\d{2}-\d{2}$/.test(String(refDate || '').trim())
    ? String(refDate).trim()
    : todayKey;

  if (mode === 'DIA') {
    return list.filter((m) => toLocalDateKey(m?.fecha || m?.createdAt) === anchorKey);
  }

  if (mode === 'SEMANA') {
    const anchorDate = new Date(`${anchorKey}T12:00:00`);
    const dayOfWeek = anchorDate.getDay(); // 0=Dom..6=Sab
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(anchorDate);
    monday.setDate(anchorDate.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const minKey = toLocalDateKey(monday);
    const maxKey = toLocalDateKey(sunday);
    return list.filter((m) => {
      const k = toLocalDateKey(m?.fecha || m?.createdAt);
      return Boolean(k && k >= minKey && k <= maxKey);
    });
  }

  if (mode === 'MES') {
    const monthKey = /^\d{4}-\d{2}$/.test(String(refMonth || '').trim())
      ? String(refMonth).trim()
      : todayKey.slice(0, 7);
    return list.filter((m) => {
      const k = toLocalDateKey(m?.fecha || m?.createdAt);
      return Boolean(k && k.slice(0, 7) === monthKey);
    });
  }

  if (mode === 'PERIODO') {
    const startKey = /^\d{4}-\d{2}-\d{2}$/.test(String(fromDate || '').trim()) ? String(fromDate).trim() : '';
    const endKey = /^\d{4}-\d{2}-\d{2}$/.test(String(toDate || '').trim()) ? String(toDate).trim() : '';
    return list.filter((m) => {
      const k = toLocalDateKey(m?.fecha || m?.createdAt);
      if (!k) return false;
      if (startKey && k < startKey) return false;
      if (endKey && k > endKey) return false;
      return true;
    });
  }

  return list;
};

/**
 * Clasifica el tipo de documento origen asociado a un movimiento de Caja/Banco:
 * 'FISCAL' (Factura / NC / ND / [FISCAL]), 'NOTA_ENTREGA' (N/E / [NO FISCAL]) u 'OTRO' (gasto o movimiento manual).
 */
export const classifyMovementDocOrigin = (mov) => {
  if (!mov || typeof mov !== 'object') return 'OTRO';
  const explicit = String(
    mov.fiscalScope || mov.subcaja || mov.tipoDoc || mov.tipo_doc || mov.referenciaTipo || mov.referencia_tipo || mov.docType || ''
  ).toUpperCase().trim();
  if (explicit === 'NOTA_ENTREGA' || explicit === 'NE' || explicit === 'N/E' || explicit === 'NDE' || explicit === 'NO_FISCAL') {
    return 'NOTA_ENTREGA';
  }
  if (explicit === 'FACTURA' || explicit === 'FACT' || explicit === 'FAC' || explicit === 'FISCAL' || explicit === 'NOTA_CREDITO' || explicit === 'NOTA_DEBITO') {
    return 'FISCAL';
  }

  const refId = String(mov.referenciaId || mov.referencia_id || mov.origenDocId || mov.origen_doc_id || '').toUpperCase().trim();
  if (/^(NE-|NDE-)/.test(refId)) return 'NOTA_ENTREGA';
  if (/^(FAC-|FACT-|NC-|ND-)/.test(refId)) return 'FISCAL';

  const text = String(mov.concepto || mov.descripcion || '').toUpperCase();
  if (/\[NO[\s_-]*FISCAL\]|NOTA\s+DE\s+ENTREGA|NOTA_ENTREGA|\bN\/E\b|\bNE[-\s#]*\d+|\bCOBRO\s+VENTA\s+NE-/.test(text)) {
    return 'NOTA_ENTREGA';
  }
  if (/\[FISCAL\]|FACTURA\s+FISCAL|\bFACTURA\b|\bFAC[-\s#]*\d+|\bCOBRO\s+VENTA\s+(?!NE-)(?:FAC-)?\d{4,}|\bNC[-\s#]*\d+|\bND[-\s#]*\d+/.test(text)) {
    return 'FISCAL';
  }
  return 'OTRO';
};

/**
 * Filtra movimientos de Caja/Banco por origen documental ('ALL' | 'FISCAL' | 'NOTA_ENTREGA' | 'NO_FISCAL').
 */
export const filterMovementsByDocOrigin = (movements = [], docOrigin = 'ALL') => {
  const list = Array.isArray(movements) ? movements : [];
  const mode = String(docOrigin || 'ALL').toUpperCase().trim();
  if (mode === 'FISCAL' || mode === 'NOTA_ENTREGA') {
    return list.filter((m) => classifyMovementDocOrigin(m) === mode);
  }
  if (mode === 'NO_FISCAL') {
    return list.filter((m) => classifyMovementDocOrigin(m) !== 'FISCAL');
  }
  return list;
};

export const CAJA_FISCAL_SPLIT_STORAGE_KEY = 'signum_caja_fiscal_split_v1';

const normalizeDeskSplitKey = (deskOrKey) => {
  if (!deskOrKey) return '';
  const raw = typeof deskOrKey === 'object'
    ? (deskOrKey.coCaja || deskOrKey.co_caja || deskOrKey.id || '')
    : deskOrKey;
  return String(raw || '').trim().toUpperCase();
};

export const loadCajaFiscalSplitOverrides = () => {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return {};
    const raw = globalThis.localStorage.getItem(CAJA_FISCAL_SPLIT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
};

export const saveCajaFiscalSplitOverride = (deskOrKey, override) => {
  const key = normalizeDeskSplitKey(deskOrKey);
  if (!key) return loadCajaFiscalSplitOverrides();
  const current = loadCajaFiscalSplitOverrides();
  const next = { ...current, [key]: override };
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(CAJA_FISCAL_SPLIT_STORAGE_KEY, JSON.stringify(next));
    }
  } catch (_) {}
  return next;
};

/**
 * Calcula el desglose Fiscal y No Fiscal de una caja operativa garantizando exactamente:
 *   Saldo Total Consolidado = Fiscal + No Fiscal
 */
export const computeCashDeskFiscalBreakdown = (
  desk,
  cashMovements = [],
  allDesks = [],
  bankAccounts = [],
  config = {},
  splitOverrides = null
) => {
  if (!desk) {
    return {
      totalUsd: 0,
      totalBs: 0,
      fiscalUsd: 0,
      fiscalBs: 0,
      noFiscalUsd: 0,
      noFiscalBs: 0,
      fiscalMovNetUsd: 0,
      fiscalMovNetBs: 0,
      fiscalMovCount: 0,
      noFiscalMovCount: 0
    };
  }

  const { tasaBcv } = resolveExchangeRates(config);
  const moneda = String(desk?.moneda || 'USD').toUpperCase();
  const rawUsd = Number(desk?.saldoUsd ?? desk?.saldo_usd ?? 0) || 0;
  const rawBs = Number(desk?.saldoBs ?? desk?.saldo_bs ?? 0) || 0;
  const isBsDesk = moneda === 'BS';
  const totalUsd = isBsDesk
    ? (rawBs !== 0 && tasaBcv > 0 ? round2(rawBs / tasaBcv) : round2(rawUsd))
    : round2(rawUsd);
  const totalBs = rawBs !== 0 ? round2(rawBs) : round2(totalUsd * tasaBcv);

  const deskMovs = (Array.isArray(cashMovements) ? cashMovements : []).filter((m) =>
    doesMovementBelongToAccount(m, 'CAJA', desk, allDesks, bankAccounts)
  );

  let fiscalMovNetUsd = 0;
  let fiscalMovNetBs = 0;
  let fiscalMovCount = 0;
  let noFiscalMovCount = 0;

  deskMovs.forEach((m) => {
    const sign = String(m?.tipo || '').toUpperCase() === 'EGRESO' ? -1 : 1;
    const mUsd = round2(Math.abs(Number(m?.montoUsd ?? m?.monto_usd ?? 0) || 0));
    const mBs = round2(Math.abs(Number(m?.montoBs ?? m?.monto_bs ?? 0) || 0));
    const origin = classifyMovementDocOrigin(m);
    if (origin === 'FISCAL') {
      fiscalMovCount += 1;
      fiscalMovNetUsd = round2(fiscalMovNetUsd + sign * mUsd);
      fiscalMovNetBs = round2(fiscalMovNetBs + sign * (mBs > 0 ? mBs : (tasaBcv > 0 ? round2(mUsd * tasaBcv) : 0)));
    } else {
      noFiscalMovCount += 1;
    }
  });

  const ovMap = splitOverrides && typeof splitOverrides === 'object' ? splitOverrides : {};
  const splitKey = normalizeDeskSplitKey(desk);
  const altKey = normalizeDeskSplitKey(desk?.id);
  const ov = ovMap[splitKey] || ovMap[altKey] || null;

  const hasExplicitField = desk.saldoFiscalUsd !== undefined || desk.saldo_fiscal_usd !== undefined;
  let rawFiscalUsd;
  let rawFiscalBs;

  if (ov && typeof ov === 'object') {
    const deltaMovUsd = round2(fiscalMovNetUsd - Number(ov.movFiscalBaselineUsd || 0));
    const deltaMovBs = round2(fiscalMovNetBs - Number(ov.movFiscalBaselineBs || 0));
    rawFiscalUsd = round2(Number(ov.baseFiscalUsd || 0) + deltaMovUsd);
    rawFiscalBs = round2(Number(ov.baseFiscalBs || 0) + deltaMovBs);
  } else if (hasExplicitField) {
    rawFiscalUsd = Number(desk.saldoFiscalUsd ?? desk.saldo_fiscal_usd ?? 0) || 0;
    rawFiscalBs = Number(desk.saldoFiscalBs ?? desk.saldo_fiscal_bs ?? (tasaBcv > 0 ? round2(rawFiscalUsd * tasaBcv) : 0)) || 0;
  } else {
    rawFiscalUsd = fiscalMovNetUsd;
    rawFiscalBs = fiscalMovNetBs;
  }

  const clampZeroToTotal = (val, maxTotal) => {
    if (maxTotal <= 0) return 0;
    return round2(Math.max(0, Math.min(maxTotal, val)));
  };

  const fiscalUsd = clampZeroToTotal(rawFiscalUsd, totalUsd);
  const noFiscalUsd = round2(totalUsd - fiscalUsd);
  const fiscalBs = isBsDesk
    ? clampZeroToTotal(rawFiscalBs, totalBs)
    : (totalUsd > 0 ? round2(totalBs * (fiscalUsd / totalUsd)) : 0);
  const noFiscalBs = round2(totalBs - fiscalBs);

  return {
    totalUsd,
    totalBs,
    fiscalUsd,
    fiscalBs,
    noFiscalUsd,
    noFiscalBs,
    fiscalMovNetUsd,
    fiscalMovNetBs,
    fiscalMovCount,
    noFiscalMovCount
  };
};

/**
 * Resume todas las cajas registradoras con su desglose exacto Fiscal + No Fiscal = Total Consolidado.
 */
export const computeCashDesksFiscalTotals = (
  cashDesks = [],
  cashMovements = [],
  bankAccounts = [],
  config = {},
  splitOverrides = null
) => {
  const desks = Array.isArray(cashDesks) ? cashDesks : [];
  let totalUsd = 0;
  let totalBs = 0;
  let fiscalUsd = 0;
  let fiscalBs = 0;
  let noFiscalUsd = 0;
  let noFiscalBs = 0;
  const byDeskKey = new Map();

  desks.forEach((d, idx) => {
    const bd = computeCashDeskFiscalBreakdown(d, cashMovements, desks, bankAccounts, config, splitOverrides);
    totalUsd = round2(totalUsd + bd.totalUsd);
    totalBs = round2(totalBs + bd.totalBs);
    fiscalUsd = round2(fiscalUsd + bd.fiscalUsd);
    fiscalBs = round2(fiscalBs + bd.fiscalBs);
    noFiscalUsd = round2(noFiscalUsd + bd.noFiscalUsd);
    noFiscalBs = round2(noFiscalBs + bd.noFiscalBs);

    const codeKey = normalizeDeskSplitKey(d) || `DESK-${idx}`;
    const idKey = normalizeDeskSplitKey(d?.id);
    byDeskKey.set(codeKey, bd);
    if (idKey) byDeskKey.set(idKey, bd);
  });

  return {
    totalUsd,
    totalBs,
    fiscalUsd,
    fiscalBs,
    noFiscalUsd,
    noFiscalBs,
    byDeskKey
  };
};

/**
 * Calcula los ajustes netos de saldo en Caja/Banco al editar un movimiento existente.
 * Devuelve un arreglo de { account, deltaUsd, deltaBs, clampZero } para revertir lo anterior y aplicar lo nuevo.
 */
export const computeMovementEditAccountAdjustments = (oldMov, nextMov, cashDesks = [], bankAccounts = []) => {
  if (!oldMov || !nextMov) return [];

  const signedEffect = (m) => {
    const sign = String(m?.tipo || '').trim().toUpperCase() === 'EGRESO' ? -1 : 1;
    const usd = round2(Math.abs(Number(m?.montoUsd ?? m?.monto_usd ?? 0) || 0));
    const bs = round2(Math.abs(Number(m?.montoBs ?? m?.monto_bs ?? 0) || 0));
    return {
      usd: round2(sign * usd),
      bs: round2(sign * bs)
    };
  };

  const oldAcc = resolveTreasuryAccountForMovement(oldMov, cashDesks, bankAccounts);
  const newAcc = resolveTreasuryAccountForMovement(nextMov, cashDesks, bankAccounts);
  const oldEff = signedEffect(oldMov);
  const newEff = signedEffect(nextMov);

  const adjustments = [];
  if (oldAcc && newAcc && oldAcc.accountRef === newAcc.accountRef) {
    const deltaUsd = round2(newEff.usd - oldEff.usd);
    const deltaBs = round2(newEff.bs - oldEff.bs);
    if (Math.abs(deltaUsd) > 0 || Math.abs(deltaBs) > 0) {
      adjustments.push({
        account: oldAcc,
        deltaUsd,
        deltaBs,
        clampZero: deltaUsd < 0 || deltaBs < 0
      });
    }
    return adjustments;
  }

  if (oldAcc && (Math.abs(oldEff.usd) > 0 || Math.abs(oldEff.bs) > 0)) {
    adjustments.push({
      account: oldAcc,
      deltaUsd: round2(-oldEff.usd),
      deltaBs: round2(-oldEff.bs),
      clampZero: -oldEff.usd < 0 || -oldEff.bs < 0
    });
  }

  if (newAcc && (Math.abs(newEff.usd) > 0 || Math.abs(newEff.bs) > 0)) {
    adjustments.push({
      account: newAcc,
      deltaUsd: newEff.usd,
      deltaBs: newEff.bs,
      clampZero: newEff.usd < 0 || newEff.bs < 0
    });
  }

  return adjustments;
};

/**
 * Deduplica movimientos de caja por ID (o firma fecha|tipo|concepto|monto cuando falta ID)
 * preservando el primer registro válido y descartando entradas nulas o corruptas sin datos.
 */
export const dedupeCashMovements = (list = []) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const rawId = String(m.id || '').trim();
    const usd = round2(m.montoUsd ?? m.monto_usd ?? 0);
    const bs = round2(m.montoBs ?? m.monto_bs ?? 0);
    const concepto = String(m.concepto || m.descripcion || '').trim();
    if (!rawId && !concepto && usd === 0 && bs === 0) continue;
    const key = rawId
      ? `ID:${rawId}`
      : `SIG:${String(m.fecha || '').trim()}|${String(m.tipo || '').toUpperCase()}|${concepto.toLowerCase()}|${usd}|${bs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
};

/**
 * Inserta o actualiza un movimiento de caja en una lista sin duplicar por ID.
 */
export const upsertCashMovementInList = (list = [], item) => {
  const base = Array.isArray(list) ? [...list] : [];
  if (!item || typeof item !== 'object') return dedupeCashMovements(base);
  const itemId = String(item.id || '').trim();
  if (!itemId) return dedupeCashMovements([item, ...base]);
  const idx = base.findIndex((m) => m && String(m.id || '').trim() === itemId);
  if (idx >= 0) {
    base[idx] = { ...base[idx], ...item, id: base[idx].id || item.id };
    return dedupeCashMovements(base);
  }
  return dedupeCashMovements([item, ...base]);
};

/**
 * Elimina un movimiento de caja de una lista por ID (o por coincidencia exacta si carece de ID).
 */
export const removeCashMovementFromList = (list = [], idOrItem) => {
  if (!Array.isArray(list)) return [];
  const isObj = idOrItem && typeof idOrItem === 'object';
  const targetId = String(isObj ? (idOrItem.id || '') : (idOrItem || '')).trim();
  return list.filter((m) => {
    if (!m) return false;
    if (targetId && String(m.id || '').trim() === targetId) return false;
    if (!targetId && isObj) {
      const sameConcept = String(m.concepto || '').trim() === String(idOrItem.concepto || '').trim();
      const sameFecha = String(m.fecha || '').trim() === String(idOrItem.fecha || '').trim();
      const sameUsd = Number(m.montoUsd ?? m.monto_usd ?? 0) === Number(idOrItem.montoUsd ?? idOrItem.monto_usd ?? 0);
      if (sameConcept && sameFecha && sameUsd) return false;
    }
    return true;
  });
};

export const PARTNER_PAYABLE_ACCOUNTS_STORAGE_KEY = 'signum_partner_payable_accounts_v1';

export const DEFAULT_PARTNER_PAYABLE_ACCOUNTS = [
  {
    id: 'cta-socio-01',
    codigo: 'SOC-01',
    nombre: 'Cuenta por Pagar Socio',
    titular: 'Socio Principal',
    codigoContable: '2.02.01.001',
    moneda: 'USD',
    saldoUsd: 0,
    saldoBs: 0,
    activa: true,
    observaciones: 'Pasivo por pagos directos de compromisos asumidos por socio/accionista'
  }
];

export const normalizePartnerPayableAccount = (raw = {}, idx = 0) => {
  const cleanCode = String(raw.codigo || raw.code || `SOC-${String(idx + 1).padStart(2, '0')}`).trim().toUpperCase();
  const cleanId = String(raw.id || cleanCode.toLowerCase()).trim();
  const cleanNombre = String(raw.nombre || raw.descripcion || 'Cuenta por Pagar Socio').trim();
  return {
    id: cleanId,
    codigo: cleanCode,
    nombre: cleanNombre,
    titular: String(raw.titular || raw.socio || '').trim(),
    codigoContable: String(raw.codigoContable || '2.02.01.001').trim(),
    moneda: String(raw.moneda || 'USD').toUpperCase().trim() || 'USD',
    saldoUsd: round2(Math.max(0, Number(raw.saldoUsd ?? raw.saldo_usd ?? 0) || 0)),
    saldoBs: round2(Math.max(0, Number(raw.saldoBs ?? raw.saldo_bs ?? 0) || 0)),
    activa: raw.activa !== false,
    observaciones: String(raw.observaciones || '').trim(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
};

export const loadPartnerPayableAccounts = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem(PARTNER_PAYABLE_ACCOUNTS_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((p, i) => normalizePartnerPayableAccount(p, i));
        }
      }
    }
  } catch (_) {}
  return DEFAULT_PARTNER_PAYABLE_ACCOUNTS.map((p, i) => normalizePartnerPayableAccount(p, i));
};

export const savePartnerPayableAccountsList = (list = []) => {
  const normalized = (Array.isArray(list) ? list : []).map((p, i) => normalizePartnerPayableAccount(p, i));
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(PARTNER_PAYABLE_ACCOUNTS_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (_) {}
  return normalized;
};

export const upsertPartnerPayableAccountInList = (list = [], account) => {
  const base = Array.isArray(list) ? [...list] : [];
  if (!account || typeof account !== 'object') return savePartnerPayableAccountsList(base);
  const normalized = normalizePartnerPayableAccount(account, base.length);
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
  return savePartnerPayableAccountsList(base);
};

export const removePartnerPayableAccountFromList = (list = [], idOrCode) => {
  const target = String(typeof idOrCode === 'object' ? (idOrCode?.id || idOrCode?.codigo || '') : (idOrCode || '')).trim().toUpperCase();
  if (!target) return savePartnerPayableAccountsList(list);
  const next = (Array.isArray(list) ? list : []).filter((p) => {
    if (!p) return false;
    const pId = String(p.id || '').trim().toUpperCase();
    const pCode = String(p.codigo || '').trim().toUpperCase();
    return pId !== target && pCode !== target;
  });
  return savePartnerPayableAccountsList(next);
};

export const applyPartnerPayableBalanceDeltaInList = (list = [], { targetRef, deltaUsd = 0, deltaBs = 0 } = {}) => {
  const base = Array.isArray(list) ? [...list] : [];
  const rawTarget = typeof targetRef === 'object'
    ? (targetRef?.rawId || targetRef?.id || targetRef?.codigo || '')
    : (targetRef || '');
  const rawUpper = String(rawTarget).trim().toUpperCase();
  const strippedUpper = rawUpper.replace(/^SOCIO-/, '').trim();
  if (!rawUpper) return base;

  let matched = false;
  const next = base.map((p) => {
    if (!p) return p;
    const pId = String(p.id || '').trim().toUpperCase();
    const pCode = String(p.codigo || '').trim().toUpperCase();
    if (
      pId === rawUpper
      || pCode === rawUpper
      || (strippedUpper && (pId === strippedUpper || pCode === strippedUpper))
    ) {
      matched = true;
      return normalizePartnerPayableAccount({
        ...p,
        saldoUsd: round2(Math.max(0, (Number(p.saldoUsd || 0) || 0) + (Number(deltaUsd) || 0))),
        saldoBs: round2(Math.max(0, (Number(p.saldoBs || 0) || 0) + (Number(deltaBs) || 0))),
        updatedAt: new Date().toISOString()
      });
    }
    return p;
  });

  if (!matched) return base;
  return savePartnerPayableAccountsList(next);
};

export const computePartnerPayableSummary = (list = [], config = {}) => {
  const { tasaBcv } = resolveExchangeRates(config);
  const items = Array.isArray(list) ? list : [];
  let totalUsd = 0;
  let totalBs = 0;
  let activeCount = 0;
  items.forEach((p) => {
    if (!p) return;
    if (p.activa !== false) activeCount += 1;
    const rawUsd = Number(p.saldoUsd ?? 0) || 0;
    const rawBs = Number(p.saldoBs ?? 0) || 0;
    const isBs = String(p.moneda || '').toUpperCase() === 'BS';
    const usd = isBs && rawBs > 0 && tasaBcv > 0 ? round2(rawBs / tasaBcv) : round2(rawUsd);
    const bs = rawBs > 0 ? round2(rawBs) : round2(usd * tasaBcv);
    totalUsd += usd;
    totalBs += bs;
  });
  return {
    totalUsd: round2(totalUsd),
    totalBs: round2(totalBs),
    activeCount,
    totalCount: items.length
  };
};

/**
 * Construye la tabla estructurada de Saldos Iniciales y Evolución de todas las Cajas Activas:
 * - Saldo Inicial fijado (o null si no se ha fijado)
 * - Neto de movimientos registrados en cash_movements para cada caja
 * - Saldo Esperado (Saldo Inicial + Neto Movs.)
 * - Saldo Actual en BD
 * - Diferencia (Saldo Actual - Saldo Esperado) y Saldo Base Sugerido (Saldo Actual - Neto Movs.)
 */
export const buildCashDesksOpeningEvolutionRows = (
  cashDesks = [],
  cashMovements = [],
  bankAccounts = [],
  config = {}
) => {
  const desks = (Array.isArray(cashDesks) ? cashDesks : []).filter(Boolean);
  const movs = Array.isArray(cashMovements) ? cashMovements : [];
  const banks = Array.isArray(bankAccounts) ? bankAccounts : [];
  const { tasaBcv } = resolveExchangeRates(config);

  let totalOpeningUsd = 0;
  let totalOpeningBs = 0;
  let totalMovCount = 0;
  let totalMovEntradasUsd = 0;
  let totalMovSalidasUsd = 0;
  let totalMovNetoUsd = 0;
  let totalMovNetoBs = 0;
  let totalBaseSugeridaUsd = 0;
  let totalBaseSugeridaBs = 0;
  let totalExpectedUsd = 0;
  let totalExpectedBs = 0;
  let totalCurrentUsd = 0;
  let totalCurrentBs = 0;
  let totalDiffUsd = 0;
  let totalDiffBs = 0;

  const rows = desks.map((desk, idx) => {
    const code = String(desk.coCaja || desk.co_caja || desk.id || `CAJA-0${idx + 1}`).trim().toUpperCase();
    const id = String(desk.id || code.toLowerCase()).trim();
    const moneda = String(desk.moneda || 'USD').trim().toUpperCase();
    const isBsDesk = moneda === 'BS';
    const rawCurUsd = round2(Number(desk.saldoUsd ?? desk.saldo_usd ?? 0) || 0);
    const rawCurBs = round2(Number(desk.saldoBs ?? desk.saldo_bs ?? 0) || 0);
    const currentUsd = isBsDesk && rawCurBs !== 0 && tasaBcv > 0 ? round2(rawCurBs / tasaBcv) : rawCurUsd;
    const currentBs = rawCurBs;

    const deskMovs = movs.filter((m) => doesMovementBelongToAccount(m, 'CAJA', desk, desks, banks));
    const movSummary = summarizeAccountMovements(deskMovs);

    const opening = resolveOpeningBalanceMeta(desk);
    const openingUsd = opening.hasOpeningBalance ? round2(opening.saldoInicialUsd || 0) : 0;
    const openingBs = opening.hasOpeningBalance ? round2(opening.saldoInicialBs || 0) : 0;

    const impliedBaseUsd = round2(currentUsd - movSummary.netoUsd);
    const impliedBaseBs = round2(currentBs - movSummary.netoBs);

    const expectedUsd = round2(openingUsd + movSummary.netoUsd);
    const expectedBs = round2(openingBs + movSummary.netoBs);

    const diffUsd = round2(currentUsd - expectedUsd);
    const diffBs = round2(currentBs - expectedBs);

    totalOpeningUsd = round2(totalOpeningUsd + openingUsd);
    totalOpeningBs = round2(totalOpeningBs + openingBs);
    totalMovCount += movSummary.totalCount;
    totalMovEntradasUsd = round2(totalMovEntradasUsd + movSummary.entradasUsd);
    totalMovSalidasUsd = round2(totalMovSalidasUsd + movSummary.salidasUsd);
    totalMovNetoUsd = round2(totalMovNetoUsd + movSummary.netoUsd);
    totalMovNetoBs = round2(totalMovNetoBs + movSummary.netoBs);
    totalBaseSugeridaUsd = round2(totalBaseSugeridaUsd + impliedBaseUsd);
    totalBaseSugeridaBs = round2(totalBaseSugeridaBs + impliedBaseBs);
    totalExpectedUsd = round2(totalExpectedUsd + expectedUsd);
    totalExpectedBs = round2(totalExpectedBs + expectedBs);
    totalCurrentUsd = round2(totalCurrentUsd + currentUsd);
    totalCurrentBs = round2(totalCurrentBs + currentBs);
    totalDiffUsd = round2(totalDiffUsd + diffUsd);
    totalDiffBs = round2(totalDiffBs + diffBs);

    return {
      desk,
      id,
      code,
      descripcion: desk.descripcion || desk.desCaja || desk.des_caja || code,
      moneda,
      isBsDesk,
      responsable: desk.responsable || 'Administración',
      activa: desk.activa !== false,
      hasOpeningBalance: opening.hasOpeningBalance,
      openingUsd,
      openingBs,
      fechaSaldoInicial: opening.fechaSaldoInicial,
      usuarioSaldoInicial: opening.usuarioSaldoInicial,
      movCount: movSummary.totalCount,
      movEntradasUsd: movSummary.entradasUsd,
      movSalidasUsd: movSummary.salidasUsd,
      movNetoUsd: movSummary.netoUsd,
      movNetoBs: movSummary.netoBs,
      impliedBaseUsd,
      impliedBaseBs,
      expectedUsd,
      expectedBs,
      currentUsd,
      currentBs,
      fechaActualizacion: desk.fechaActualizacion || desk.fecha_actualizacion || null,
      diffUsd,
      diffBs,
      isBalanced: isBsDesk ? Math.abs(diffBs) < 0.01 : Math.abs(diffUsd) < 0.01
    };
  });

  return {
    rows,
    totals: {
      openingUsd: totalOpeningUsd,
      openingBs: totalOpeningBs,
      movCount: totalMovCount,
      movEntradasUsd: totalMovEntradasUsd,
      movSalidasUsd: totalMovSalidasUsd,
      movNetoUsd: totalMovNetoUsd,
      movNetoBs: totalMovNetoBs,
      impliedBaseUsd: totalBaseSugeridaUsd,
      impliedBaseBs: totalBaseSugeridaBs,
      expectedUsd: totalExpectedUsd,
      expectedBs: totalExpectedBs,
      currentUsd: totalCurrentUsd,
      currentBs: totalCurrentBs,
      diffUsd: totalDiffUsd,
      diffBs: totalDiffBs
    }
  };
};

/**
 * Calcula el resumen contable Debe (Entradas), Haber (Salidas) y su vínculo con el Saldo
 * para una Caja Registradora o Cuenta Bancaria específica, incluyendo desglose Fiscal / No Fiscal.
 */
export const computeAccountDebeHaberSummary = (
  accountKind = 'CAJA',
  accountRecord = null,
  cashMovements = [],
  cashDesks = [],
  bankAccounts = [],
  config = {}
) => {
  const kind = String(accountKind || 'CAJA').toUpperCase();
  const emptySub = {
    debeUsd: 0,
    debeBs: 0,
    debeCount: 0,
    haberUsd: 0,
    haberBs: 0,
    haberCount: 0,
    netoUsd: 0,
    netoBs: 0
  };
  if (!accountRecord) {
    return {
      ...emptySub,
      saldoInicialUsd: 0,
      saldoInicialBs: 0,
      hasOpeningBalance: false,
      saldoActualUsd: 0,
      saldoActualBs: 0,
      saldoCalculadoUsd: 0,
      saldoCalculadoBs: 0,
      fiscal: { ...emptySub },
      noFiscal: { ...emptySub }
    };
  }

  const { tasaBcv } = resolveExchangeRates(config);
  const opening = resolveOpeningBalanceMeta(accountRecord);
  const initUsd = round2(Number(opening.saldoInicialUsd || 0));
  const initBs = round2(Number(opening.saldoInicialBs || 0));

  let saldoActualUsd = 0;
  let saldoActualBs = 0;
  if (kind === 'BANCO') {
    const val = computeBankAccountValuation(accountRecord, config);
    saldoActualUsd = val.usd;
    saldoActualBs = val.bs;
  } else {
    const moneda = String(accountRecord.moneda || 'USD').toUpperCase();
    const rawUsd = Number(accountRecord.saldoUsd ?? accountRecord.saldo_usd ?? 0) || 0;
    const rawBs = Number(accountRecord.saldoBs ?? accountRecord.saldo_bs ?? 0) || 0;
    if (moneda === 'BS') {
      saldoActualBs = round2(rawBs);
      saldoActualUsd = rawBs !== 0 && tasaBcv > 0 ? round2(rawBs / tasaBcv) : round2(rawUsd);
    } else {
      saldoActualUsd = round2(rawUsd);
      saldoActualBs = rawBs !== 0 ? round2(rawBs) : round2(rawUsd * tasaBcv);
    }
  }

  const matchingMovs = (Array.isArray(cashMovements) ? cashMovements : []).filter((m) =>
    doesMovementBelongToAccount(m, kind, accountRecord, cashDesks, bankAccounts)
  );

  const acc = { ...emptySub };
  const fiscal = { ...emptySub };
  const noFiscal = { ...emptySub };

  matchingMovs.forEach((m) => {
    const isIngreso = String(m?.tipo || '').trim().toUpperCase() === 'INGRESO';
    const usd = round2(Math.abs(Number(m?.montoUsd ?? m?.monto_usd ?? 0) || 0));
    const bs = round2(Math.abs(Number(m?.montoBs ?? m?.monto_bs ?? 0) || 0));
    const bucket = classifyMovementDocOrigin(m) === 'FISCAL' ? fiscal : noFiscal;

    if (isIngreso) {
      acc.debeCount += 1;
      acc.debeUsd = round2(acc.debeUsd + usd);
      acc.debeBs = round2(acc.debeBs + bs);
      bucket.debeCount += 1;
      bucket.debeUsd = round2(bucket.debeUsd + usd);
      bucket.debeBs = round2(bucket.debeBs + bs);
    } else {
      acc.haberCount += 1;
      acc.haberUsd = round2(acc.haberUsd + usd);
      acc.haberBs = round2(acc.haberBs + bs);
      bucket.haberCount += 1;
      bucket.haberUsd = round2(bucket.haberUsd + usd);
      bucket.haberBs = round2(bucket.haberBs + bs);
    }
  });

  acc.netoUsd = round2(acc.debeUsd - acc.haberUsd);
  acc.netoBs = round2(acc.debeBs - acc.haberBs);
  fiscal.netoUsd = round2(fiscal.debeUsd - fiscal.haberUsd);
  fiscal.netoBs = round2(fiscal.debeBs - fiscal.haberBs);
  noFiscal.netoUsd = round2(noFiscal.debeUsd - noFiscal.haberUsd);
  noFiscal.netoBs = round2(noFiscal.debeBs - noFiscal.haberBs);

  return {
    ...acc,
    saldoInicialUsd: initUsd,
    saldoInicialBs: initBs,
    hasOpeningBalance: opening.hasOpeningBalance,
    saldoActualUsd,
    saldoActualBs,
    saldoCalculadoUsd: round2(initUsd + acc.netoUsd),
    saldoCalculadoBs: round2(initBs + acc.netoBs),
    fiscal,
    noFiscal
  };
};

/**
 * Calcula el saldo corrido (running balance) por cada movimiento vinculado al saldo actual
 * de su Caja o Cuenta Bancaria correspondiente, garantizando Saldo_anterior + Debe - Haber = Saldo_nuevo.
 */
export const computeMovementsRunningBalanceMap = (
  cashMovements = [],
  cashDesks = [],
  bankAccounts = [],
  config = {}
) => {
  const result = new Map();
  const list = Array.isArray(cashMovements) ? cashMovements : [];
  if (list.length === 0) return result;

  const { tasaBcv } = resolveExchangeRates(config);
  const grouped = new Map();

  list.forEach((m, idx) => {
    if (!m || typeof m !== 'object') return;
    const resolved = resolveTreasuryAccountForMovement(m, cashDesks, bankAccounts);
    if (!resolved || !resolved.record) return;
    const key = resolved.accountRef;
    if (!grouped.has(key)) {
      grouped.set(key, { resolved, items: [] });
    }
    grouped.get(key).items.push({ m, idx });
  });

  grouped.forEach(({ resolved, items }) => {
    const { kind, record } = resolved;
    const isBsAccount = String(record.moneda || (kind === 'BANCO' ? 'BS' : 'USD')).toUpperCase() === 'BS';
    let currentUsd = 0;
    let currentBs = 0;

    if (kind === 'BANCO') {
      const val = computeBankAccountValuation(record, config);
      currentUsd = val.usd;
      currentBs = val.bs;
    } else {
      const rawUsd = Number(record.saldoUsd ?? record.saldo_usd ?? 0) || 0;
      const rawBs = Number(record.saldoBs ?? record.saldo_bs ?? 0) || 0;
      if (isBsAccount) {
        currentBs = round2(rawBs);
        currentUsd = rawBs !== 0 && tasaBcv > 0 ? round2(rawBs / tasaBcv) : round2(rawUsd);
      } else {
        currentUsd = round2(rawUsd);
        currentBs = rawBs !== 0 ? round2(rawBs) : round2(rawUsd * tasaBcv);
      }
    }

    const accountCode = kind === 'BANCO'
      ? `CTA-${record.codCta || record.cod_cta || record.id || ''}`
      : String(record.coCaja || record.co_caja || record.id || '').toUpperCase();
    const accountName = kind === 'BANCO'
      ? (record.bancoNombre || record.banco_nombre || accountCode)
      : (record.descripcion || accountCode);

    // Orden cronológico descendente (más reciente primero) para anclar desde el saldo actual
    items.sort((a, b) => {
      const ta = new Date(a.m?.fecha || a.m?.createdAt || 0).getTime() || 0;
      const tb = new Date(b.m?.fecha || b.m?.createdAt || 0).getTime() || 0;
      if (tb !== ta) return tb - ta;
      return a.idx - b.idx;
    });

    let runningUsd = currentUsd;
    let runningBs = currentBs;

    items.forEach(({ m }) => {
      const isIngreso = String(m?.tipo || '').trim().toUpperCase() === 'INGRESO';
      const sign = isIngreso ? 1 : -1;
      const mUsd = round2(Math.abs(Number(m?.montoUsd ?? m?.monto_usd ?? 0) || 0));
      const mBs = round2(Math.abs(Number(m?.montoBs ?? m?.monto_bs ?? 0) || 0));
      const effBs = mBs > 0 ? mBs : (isBsAccount && tasaBcv > 0 ? round2(mUsd * tasaBcv) : 0);
      const effUsd = mUsd > 0 ? mUsd : (isBsAccount && tasaBcv > 0 ? round2(mBs / tasaBcv) : 0);

      const saldoDespuesUsd = round2(runningUsd);
      const saldoDespuesBs = round2(runningBs);
      const saldoAntesUsd = round2(runningUsd - sign * effUsd);
      const saldoAntesBs = round2(runningBs - sign * effBs);

      result.set(m, {
        kind,
        accountCode,
        accountName,
        isBsAccount,
        saldoDespuesUsd,
        saldoDespuesBs,
        saldoAntesUsd,
        saldoAntesBs
      });

      runningUsd = saldoAntesUsd;
      runningBs = saldoAntesBs;
    });
  });

  return result;
};
