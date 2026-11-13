export const CREDIT_APPROVERS_CATALOG = [
  {
    category: 'GERENCIA GENERAL & DIRECCIÓN',
    icon: '👔',
    people: [
      { id: 'Edson Designer (Administrador Master / Dirección)', name: 'Edson Designer', role: 'Administrador Master / Dirección' },
      { id: 'Ricardo Sánchez (Gerente General / Dirección)', name: 'Ricardo Sánchez', role: 'Gerente General / Dirección' }
    ]
  },
  {
    category: 'ADMINISTRACIÓN & FINANZAS',
    icon: '👨‍💼',
    people: [
      { id: 'Luiggy Silva (Administración & Finanzas)', name: 'Luiggy Silva', role: 'Administración & Finanzas' },
      { id: 'José Martínez (Analista de Cobranzas y Crédito)', name: 'José Martínez', role: 'Analista de Cobranzas y Crédito' }
    ]
  },
  {
    category: 'SUPERVISIÓN & VENTAS',
    icon: '👩‍💼',
    people: [
      { id: 'Yheyson Calderón (Supervisor / Ventas)', name: 'Yheyson Calderón', role: 'Supervisor de Ventas' },
      { id: 'Carlos Becerra (Vendedor Senior)', name: 'Carlos Becerra', role: 'Asesor Comercial Senior' },
      { id: 'Ana Rivas (Asesor de Ventas)', name: 'Ana Rivas', role: 'Asesor de Ventas' }
    ]
  }
];

export const ALL_APPROVER_IDS = CREDIT_APPROVERS_CATALOG.flatMap(g => g.people.map(p => p.id));
export const DEFAULT_APPROVER_IDS = [
  'Edson Designer (Administrador Master / Dirección)',
  'Ricardo Sánchez (Gerente General / Dirección)',
  'Luiggy Silva (Administración & Finanzas)',
  'José Martínez (Analista de Cobranzas y Crédito)'
];

/**
 * Resuelve la cantidad de días de crédito según la condición de pago y/o los días pactados.
 * Si es CONTADO devuelve 0.
 * Si es 7_DIAS, 15_DIAS, 21_DIAS, 30_DIAS devuelve 7, 15, 21, 30 respectivamente.
 * Si es CREDITO genérico, usa explicitDiasCredito o clientDiasCredito (por defecto 15).
 */
export function resolveCreditDaysFromTerm(condicionPago, clientDiasCredito = 15, explicitDiasCredito = null) {
  const term = String(condicionPago || 'CONTADO').trim().toUpperCase();
  if (term === 'CONTADO') return 0;

  if (explicitDiasCredito !== null && explicitDiasCredito !== undefined && explicitDiasCredito !== '') {
    const parsedExplicit = Number(explicitDiasCredito);
    if (!Number.isNaN(parsedExplicit) && parsedExplicit >= 0) {
      if (parsedExplicit > 0) return parsedExplicit;
    }
  }

  if (term === '7_DIAS' || term === 'CREDITO_7' || term === '7 DIAS') return 7;
  if (term === '15_DIAS' || term === 'CREDITO_15' || term === '15 DIAS') return 15;
  if (term === '21_DIAS' || term === 'CREDITO_21' || term === '21 DIAS') return 21;
  if (term === '30_DIAS' || term === 'CREDITO_30' || term === '30 DIAS') return 30;

  const matchNumber = term.match(/(\d+)/);
  if (matchNumber) {
    return Number(matchNumber[1]);
  }

  const fallback = Number(clientDiasCredito);
  return !Number.isNaN(fallback) && fallback > 0 ? fallback : 15;
}

/**
 * Devuelve el código estandarizado de plazo de crédito ('CONTADO' | '7_DIAS' | '15_DIAS' | '21_DIAS' | '30_DIAS')
 */
export function resolveTermCodeFromDays(diasCredito, condicionPago = '') {
  const cond = String(condicionPago || '').trim().toUpperCase();
  if (cond === 'CONTADO') return 'CONTADO';
  if (['7_DIAS', '15_DIAS', '21_DIAS', '30_DIAS'].includes(cond)) return cond;

  const dias = Number(diasCredito || 0);
  if (dias >= 30) return '30_DIAS';
  if (dias >= 21) return '21_DIAS';
  if (dias >= 15) return '15_DIAS';
  if (dias > 0) return '7_DIAS';
  if (cond.includes('CREDITO') || cond.includes('CRÉDITO')) return '15_DIAS';
  return 'CONTADO';
}

/**
 * Calcula la Fecha de Vencimiento = Fecha de Emisión + Cantidad de días de Crédito
 */
export function calculateExpirationDate(fechaEmisionInput, diasCreditoInput = 0) {
  const baseDate = fechaEmisionInput ? new Date(fechaEmisionInput) : new Date();
  const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const dias = Math.max(0, Number(diasCreditoInput) || 0);
  const expTime = safeBaseDate.getTime() + (dias * 24 * 60 * 60 * 1000);
  return new Date(expTime);
}

/**
 * Determina inequívocamente si una condición o método de pago representa una venta a crédito
 */
export function isCreditPaymentCondition(condicionPago, metodoPago = '') {
  if (metodoPago === 'CREDITO') return true;
  if (!condicionPago) return false;
  const term = String(condicionPago).trim().toUpperCase();
  if (term === 'CONTADO' || term === 'PAGO_INMEDIATO') return false;
  return resolveCreditDaysFromTerm(term) > 0 || term.includes('CREDITO') || term.includes('CRÉDITO') || term.includes('DIAS');
}

/**
 * Formatea una fecha en formato DD/MM/YYYY (Venezuela)
 */
export function formatDateVe(dateInput) {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Obtiene la condición comercial acordada en la ficha del cliente
 */
export function getClientAgreedCreditInfo(client) {
  if (!client) return { dias: 0, termKey: 'CONTADO', label: 'Sin cliente' };
  const dias = Number(client.diasCredito || client.dias_credito || 0);
  const condicion = String(client.condicionPago || client.condicion || '').toUpperCase();

  if (dias >= 30) return { dias: 30, termKey: '30_DIAS', label: 'Crédito 30 Días' };
  if (dias >= 21) return { dias: 21, termKey: '21_DIAS', label: 'Crédito 21 Días' };
  if (dias >= 15) return { dias: 15, termKey: '15_DIAS', label: 'Crédito 15 Días' };
  if (dias >= 7) return { dias: 7, termKey: '7_DIAS', label: 'Crédito 7 Días' };
  if (dias > 0) return { dias, termKey: '7_DIAS', label: `Crédito ${dias} Días` };
  if (condicion.includes('CREDITO') || condicion.includes('CRÉDITO')) {
    return { dias: 15, termKey: '15_DIAS', label: 'Crédito 15 Días' };
  }
  return { dias: 0, termKey: 'CONTADO', label: 'Contado' };
}

/**
 * Evalúa las normas de crédito comercial para un cliente:
 * 1. No tener facturas o notas de entrega vencidas.
 * 2. No tener más de 2 facturas pendientes (> 2).
 * 3. No tener 2 o más notas de entrega pendientes (>= 2).
 * 4. No tener documentos combinados pendientes (1 factura + 1 nota de entrega).
 * 5. No tener bloqueo explícito (sinCredito) ni exceder límite de crédito disponible (cuando limiteCreditoUsd > 0).
 */
export function evaluateClientCreditPolicy({
  client,
  profitInvoices = [],
  sales = [],
  tasaBcv = 1,
  montoOrdenUsd = 0
}) {
  if (!client) {
    return {
      evaluado: false,
      isAprobado: false,
      statusLabel: '',
      motivo: 'Seleccione un cliente registrado para evaluar su condición comercial.',
      tieneVencidas: false,
      masDeDosFacturas: false,
      dosOMasNotasEntrega: false,
      dosCombinadas: false,
      excedeLimiteCredito: false,
      bloqueadoPorFicha: false,
      facturasPendientes: [],
      notasEntregaPendientes: [],
      facturasVencidas: [],
      notasEntregaVencidas: [],
      facturasPendientesCount: 0,
      notasEntregaPendientesCount: 0,
      vencidasCount: 0,
      limiteCreditoUsd: 0,
      saldoDeudorUsd: 0,
      creditoDisponibleUsd: 0
    };
  }

  const cRif = String(client.rif || '').trim().toUpperCase();
  const cId = String(client.id || '').trim();
  const cCod = String(client.codigo || '').trim();
  const cNom = String(client.nombre || client.razonSocial || '').trim().toLowerCase();
  const diasCreditoCliente = Number(client.diasCredito || client.dias_credito || 15);

  const matchesClient = (d) => {
    if (!d) return false;
    const dRif = String(d.clienteRif || d.rif || d.cliente_rif || '').trim().toUpperCase();
    if (cRif && dRif && dRif === cRif) return true;
    const dId = String(d.clienteId || d.cliente_id || d.id || '').trim();
    if (cId && dId && dId === cId) return true;
    if (cCod && dId && dId === cCod) return true;
    const dNom = String(d.clienteNombre || d.cliente_nombre || d.nombre || '').trim().toLowerCase();
    if (cNom && dNom && dNom === cNom) return true;
    return false;
  };

  const allDocs = [];
  const seenIds = new Set();

  (profitInvoices || []).forEach(f => {
    if (matchesClient(f)) {
      const docKey = f.id || f.factNum || f.fact_num;
      if (docKey && !seenIds.has(docKey)) {
        seenIds.add(docKey);
        allDocs.push({
          id: docKey,
          numeroDoc: f.factNum || f.fact_num || f.id,
          tipoDoc: f.tipoDoc || f.tipo_doc || (String(f.factNum || '').toUpperCase().startsWith('NE') ? 'NOTA_ENTREGA' : 'FACTURA'),
          fechaEmision: f.fechaEmision || f.fecEmis || f.fec_emis,
          fechaVencimiento: f.fechaVencimiento || f.fecVenc || f.fec_venc,
          saldoUsd: Number(f.saldoUsd || f.saldo_usd || 0),
          saldoBs: Number(f.saldoBs || f.saldo_bs || 0),
          status: f.status,
          anulado: Boolean(f.anulada || f.anulado)
        });
      }
    }
  });

  (sales || []).forEach(s => {
    if (matchesClient(s)) {
      const docKey = s.id || s.numeroDoc;
      if (docKey && !seenIds.has(docKey)) {
        seenIds.add(docKey);
        allDocs.push({
          id: docKey,
          numeroDoc: s.numeroDoc || s.id,
          tipoDoc: s.tipoDoc || 'FACTURA',
          fechaEmision: s.fecha || s.fechaEmision,
          fechaVencimiento: s.fechaVencimiento,
          saldoUsd: Number(s.saldoUsd ?? (s.estado === 'PENDIENTE' || s.condicionPago === 'CREDITO' ? s.totalUsd : 0)),
          saldoBs: Number(s.saldoBs ?? (s.estado === 'PENDIENTE' || s.condicionPago === 'CREDITO' ? s.totalBs : 0)),
          status: s.estado || s.status,
          condicionPago: s.condicionPago,
          anulado: s.estado === 'ANULADA' || s.status === 'ANULADA'
        });
      }
    }
  });

  const isPending = (doc) => {
    if (doc.anulado || doc.status === 'ANULADA' || doc.status === 'ANULADO') return false;
    if (doc.status === 'PAGADA' || doc.status === 'PAGADO') return false;
    const totalPendiente = doc.saldoUsd + (doc.saldoBs ? doc.saldoBs / (tasaBcv || 1) : 0);
    return totalPendiente > 0.05 || doc.status === 'PENDIENTE' || doc.condicionPago === 'CREDITO';
  };

  const now = new Date();
  const isDocOverdue = (doc) => {
    if (!isPending(doc)) return false;
    if (doc.fechaVencimiento) {
      const vDate = new Date(doc.fechaVencimiento);
      if (!Number.isNaN(vDate.getTime())) {
        return (now.getTime() - vDate.getTime()) > (24 * 60 * 60 * 1000);
      }
    }
    if (doc.fechaEmision) {
      const eDate = new Date(doc.fechaEmision);
      if (!Number.isNaN(eDate.getTime())) {
        const limitDate = new Date(eDate.getTime() + (diasCreditoCliente * 24 * 60 * 60 * 1000));
        return (now.getTime() - limitDate.getTime()) > (24 * 60 * 60 * 1000);
      }
    }
    return false;
  };

  const facturasPendientes = [];
  const notasEntregaPendientes = [];
  const facturasVencidas = [];
  const notasEntregaVencidas = [];

  allDocs.forEach(d => {
    if (!isPending(d)) return;

    const t = String(d.tipoDoc || '').toUpperCase();
    const num = String(d.numeroDoc || '').toUpperCase();
    const esNE = t === 'NOTA_ENTREGA' || t.includes('ENTREGA') || num.startsWith('NE') || num.startsWith('OE');
    const esVencido = isDocOverdue(d);

    if (esNE) {
      notasEntregaPendientes.push(d);
      if (esVencido) notasEntregaVencidas.push(d);
    } else if (t === 'FACTURA' || num.startsWith('FACT') || num.startsWith('FAC') || (!t && !num.startsWith('NC') && !num.startsWith('ND'))) {
      facturasPendientes.push(d);
      if (esVencido) facturasVencidas.push(d);
    }
  });

  const tieneVencidas = facturasVencidas.length > 0 || notasEntregaVencidas.length > 0;
  const masDeDosFacturas = facturasPendientes.length > 2;
  const dosOMasNotasEntrega = notasEntregaPendientes.length >= 2;
  const dosCombinadas = facturasPendientes.length >= 1 && notasEntregaPendientes.length >= 1;

  const limiteCreditoUsd = Number(client.limiteCreditoUsd || client.limite_credito_usd || 0);
  const saldoDocsUsd = [...facturasPendientes, ...notasEntregaPendientes].reduce(
    (acc, d) => acc + (Number(d.saldoUsd) || (Number(d.saldoBs || 0) / (tasaBcv || 1))),
    0
  );
  const saldoDeudorUsd = Math.max(Number(client.saldoDeudorUsd || 0), saldoDocsUsd);
  const creditoDisponibleUsd = limiteCreditoUsd > 0 ? Math.max(0, limiteCreditoUsd - saldoDeudorUsd) : 0;
  const bloqueadoPorFicha = Boolean(client.sinCredito);
  const excedeLimiteCredito = Boolean(
    limiteCreditoUsd > 0 && Number(montoOrdenUsd || 0) > 0 && Number(montoOrdenUsd) > creditoDisponibleUsd
  );

  const isNegado =
    tieneVencidas ||
    masDeDosFacturas ||
    dosOMasNotasEntrega ||
    dosCombinadas ||
    bloqueadoPorFicha ||
    excedeLimiteCredito;

  let motivo = '';
  if (bloqueadoPorFicha) {
    motivo = 'Cliente posee restricción "Sin Crédito" activa en su ficha maestra.';
  } else if (tieneVencidas) {
    const motivosVenc = [];
    if (facturasVencidas.length > 0) motivosVenc.push(`${facturasVencidas.length} factura(s) vencida(s)`);
    if (notasEntregaVencidas.length > 0) motivosVenc.push(`${notasEntregaVencidas.length} nota(s) de entrega vencida(s)`);
    motivo = `Cliente posee ${motivosVenc.join(' y ')}.`;
  } else if (masDeDosFacturas) {
    motivo = `Cliente posee más de dos facturas pendientes (${facturasPendientes.length} facturas abiertas).`;
  } else if (dosOMasNotasEntrega) {
    motivo = `Cliente posee 2 o más notas de entrega pendientes (${notasEntregaPendientes.length} N.E. abiertas).`;
  } else if (dosCombinadas) {
    motivo = `Cliente posee documentos combinados pendientes (${facturasPendientes.length} factura y ${notasEntregaPendientes.length} nota de entrega).`;
  } else if (excedeLimiteCredito) {
    motivo = `El monto de la operación ($${Number(montoOrdenUsd).toFixed(2)}) supera el cupo de crédito disponible ($${creditoDisponibleUsd.toFixed(2)}).`;
  } else {
    motivo = 'Cliente solvente. Cumple con las políticas comerciales para despacho a crédito.';
  }

  return {
    evaluado: true,
    isAprobado: !isNegado,
    statusLabel: !isNegado ? 'APROBADO' : 'NEGADO',
    motivo,
    tieneVencidas,
    masDeDosFacturas,
    dosOMasNotasEntrega,
    dosCombinadas,
    bloqueadoPorFicha,
    excedeLimiteCredito,
    facturasPendientes,
    notasEntregaPendientes,
    facturasVencidas,
    notasEntregaVencidas,
    facturasPendientesCount: facturasPendientes.length,
    notasEntregaPendientesCount: notasEntregaPendientes.length,
    vencidasCount: facturasVencidas.length + notasEntregaVencidas.length,
    limiteCreditoUsd,
    saldoDeudorUsd,
    creditoDisponibleUsd
  };
}

/**
 * Obtiene los grupos e IDs de aprobadores de crédito autorizados en Configuración
 */
export function getAuthorizedApproverGroups(config) {
  const authorizedApproverIds =
    Array.isArray(config?.aprobadoresCredito) && config.aprobadoresCredito.length > 0
      ? new Set(config.aprobadoresCredito)
      : new Set([
          'Edson Designer (Administrador Master / Dirección)',
          'Ricardo Sánchez (Gerente General / Dirección)',
          'Luiggy Silva (Administración & Finanzas)',
          'José Martínez (Analista de Cobranzas y Crédito)'
        ]);

  const approverGroups = (CREDIT_APPROVERS_CATALOG || [])
    .map(group => ({
      ...group,
      people: group.people.filter(p => authorizedApproverIds.has(p.id))
    }))
    .filter(group => group.people.length > 0);

  const defaultAuthorizer =
    config?.aprobadorCreditoDefecto && authorizedApproverIds.has(config.aprobadorCreditoDefecto)
      ? config.aprobadorCreditoDefecto
      : approverGroups[0]?.people[0]?.id || 'Ricardo Sánchez (Gerente General / Dirección)';

  return {
    authorizedApproverIds,
    approverGroups,
    defaultAuthorizer
  };
}

/**
 * Determina si un cliente está asignado al vendedor / usuario actual.
 */
export function isClientAssignedToSeller(client, currentUser, profitSellers = []) {
  if (!client || !currentUser) return false;
  const assignedRaw = String(client.vendedorAsignado || client.vendedor_asignado || '').trim().toUpperCase();
  if (!assignedRaw) return false;

  const candidateCodes = new Set();
  [currentUser.co_ven, currentUser.coVen, currentUser.codigoVendedor, currentUser.username, currentUser.nombre]
    .filter(Boolean)
    .forEach((v) => candidateCodes.add(String(v).trim().toUpperCase()));

  const userFullName = String(currentUser.nombre || '').trim().toLowerCase();
  const userName = String(currentUser.username || '').trim().toLowerCase();
  (profitSellers || []).forEach((s) => {
    if (!s) return;
    const sName = String(s.venDes || s.ven_des || s.nombre || '').trim().toLowerCase();
    const sCode = String(s.coVen || s.co_ven || s.id || '').trim().toUpperCase();
    if (sCode && ((userFullName && sName.includes(userFullName)) || (userName && sName.includes(userName)) || candidateCodes.has(sCode))) {
      candidateCodes.add(sCode);
      if (sName) candidateCodes.add(sName.toUpperCase());
    }
  });

  if (candidateCodes.has(assignedRaw)) return true;
  for (const cand of candidateCodes) {
    if (cand.length >= 3 && (assignedRaw.includes(cand) || cand.includes(assignedRaw))) {
      return true;
    }
  }
  return false;
}

/**
 * Evalúa el estado completo de cartera de un cliente para la vista de Preventa y Notificaciones:
 * - Mora exacta en días
 * - Días restantes para el vencimiento más próximo (alerta cuando falten <= 3 días)
 * - Estado de solvencia / bloqueo / crédito vigente
 */
export function evaluateClientCreditPortfolioSummary({
  client,
  profitInvoices = [],
  sales = [],
  tasaBcv = 1,
  now = new Date()
}) {
  const evalPolicy = evaluateClientCreditPolicy({
    client,
    profitInvoices,
    sales,
    tasaBcv,
    montoOrdenUsd: 0
  });

  if (!client) {
    return {
      estadoPortfolio: 'SIN_DATOS',
      estadoLabel: 'Sin Cliente',
      badgeTone: 'neutral',
      diasRestantesMin: null,
      diasMoraMax: 0,
      proximaFechaVencimiento: null,
      docProximoVencer: null,
      alerta3Dias: false,
      enMora: false,
      documentosAbiertos: [],
      evalPolicy
    };
  }

  const diasCreditoCliente = Number(client.diasCredito || client.dias_credito || 15);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const openDocs = [...(evalPolicy.facturasPendientes || []), ...(evalPolicy.notasEntregaPendientes || [])];
  const documentosAbiertos = openDocs.map((doc) => {
    let expDate = null;
    if (doc.fechaVencimiento) {
      const parsed = new Date(doc.fechaVencimiento);
      if (!Number.isNaN(parsed.getTime())) expDate = parsed;
    }
    if (!expDate && doc.fechaEmision) {
      const em = new Date(doc.fechaEmision);
      if (!Number.isNaN(em.getTime())) {
        expDate = new Date(em.getTime() + Math.max(0, diasCreditoCliente) * DAY_MS);
      }
    }

    let diasRestantes = null;
    if (expDate) {
      const expDayStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate()).getTime();
      diasRestantes = Math.round((expDayStart - todayStart) / DAY_MS);
    }

    const montoPendienteUsd = Number(doc.saldoUsd || 0) || (Number(doc.saldoBs || 0) / (tasaBcv || 1));
    return {
      ...doc,
      expDateIso: expDate ? expDate.toISOString() : null,
      diasRestantes,
      diasMora: diasRestantes !== null && diasRestantes < 0 ? Math.abs(diasRestantes) : 0,
      montoPendienteUsd
    };
  });

  documentosAbiertos.sort((a, b) => {
    const da = a.diasRestantes === null ? Number.POSITIVE_INFINITY : a.diasRestantes;
    const db = b.diasRestantes === null ? Number.POSITIVE_INFINITY : b.diasRestantes;
    return da - db;
  });

  const docsConFecha = documentosAbiertos.filter((d) => d.diasRestantes !== null);
  const docMasUrgente = docsConFecha[0] || documentosAbiertos[0] || null;
  const diasRestantesMin = docMasUrgente && docMasUrgente.diasRestantes !== null ? docMasUrgente.diasRestantes : null;
  const diasMoraMax = diasRestantesMin !== null && diasRestantesMin < 0 ? Math.abs(diasRestantesMin) : 0;
  const enMora = diasMoraMax > 0 || evalPolicy.tieneVencidas;
  const alerta3Dias = !enMora && diasRestantesMin !== null && diasRestantesMin >= 0 && diasRestantesMin <= 3;

  let estadoPortfolio = 'SOLVENTE';
  let estadoLabel = 'Solvente (Sin Deuda)';
  let badgeTone = 'success';

  if (client.inactivo || evalPolicy.bloqueadoPorFicha) {
    estadoPortfolio = 'BLOQUEADO';
    estadoLabel = client.inactivo ? 'Cliente Inactivo' : 'Sin Crédito / Bloqueado';
    badgeTone = 'danger';
  } else if (enMora) {
    estadoPortfolio = 'EN_MORA';
    estadoLabel = diasMoraMax > 0 ? `En Mora (${diasMoraMax} día${diasMoraMax === 1 ? '' : 's'})` : 'En Mora (Vencido)';
    badgeTone = 'danger';
  } else if (alerta3Dias) {
    estadoPortfolio = 'POR_VENCER';
    estadoLabel = diasRestantesMin === 0 ? 'Vence HOY (0d)' : `Por Vencer (${diasRestantesMin} día${diasRestantesMin === 1 ? '' : 's'})`;
    badgeTone = 'warning';
  } else if (documentosAbiertos.length > 0 || evalPolicy.saldoDeudorUsd > 0.05) {
    estadoPortfolio = 'CREDITO_VIGENTE';
    estadoLabel = diasRestantesMin !== null ? `Al Día (${diasRestantesMin}d rest.)` : 'Solvente (Saldo Vigente)';
    badgeTone = 'info';
  }

  return {
    estadoPortfolio,
    estadoLabel,
    badgeTone,
    diasRestantesMin,
    diasMoraMax,
    proximaFechaVencimiento: docMasUrgente?.expDateIso || null,
    docProximoVencer: docMasUrgente?.numeroDoc || null,
    alerta3Dias,
    enMora,
    documentosAbiertos,
    evalPolicy
  };
}

const CLIENT_REQUEST_MARKER = '[SOLICITUD_CLIENTE_JSON]';

/**
 * Empaqueta la metadata extendida de una solicitud de nuevo cliente en comentarios/observaciones
 * para garantizar persistencia íntegra en Supabase Cloud, servidor local y localStorage.
 */
export function encodeClientRequestMetadata(clientReq = {}) {
  const cleanMeta = {
    telefono: clientReq.telefono || '',
    email: clientReq.email || '',
    ciudad: clientReq.ciudad || '',
    estado: clientReq.estado || '',
    responsable: clientReq.responsable || '',
    tipoCliente: clientReq.tipoCliente || 'Mayorista',
    esContribuyente: clientReq.esContribuyente !== false,
    esContribuyenteEspecial: Boolean(clientReq.esContribuyenteEspecial),
    zonaVenta: clientReq.zonaVenta || '01',
    zonaNombre: clientReq.zonaNombre || '',
    vendedorAsignado: clientReq.vendedorAsignado || 'OF',
    limiteCreditoUsd: Number(clientReq.limiteCreditoUsd || 0),
    diasCredito: Number(clientReq.diasCredito || 0),
    notasVendedor: clientReq.notasVendedor || clientReq.observaciones || ''
  };
  return `${CLIENT_REQUEST_MARKER}${JSON.stringify(cleanMeta)}`;
}

/**
 * Extrae el perfil completo de cliente desde un registro `SOLICITUD_CLIENTE` de la tabla orders.
 */
export function decodeClientRequestMetadata(orderRecord = {}) {
  const rawObs = String(orderRecord.observaciones || orderRecord.comentarios || '');
  let parsedMeta = {};
  const markerIdx = rawObs.indexOf(CLIENT_REQUEST_MARKER);
  if (markerIdx >= 0) {
    const jsonPart = rawObs.slice(markerIdx + CLIENT_REQUEST_MARKER.length).trim();
    try {
      parsedMeta = JSON.parse(jsonPart);
    } catch (_) {
      parsedMeta = {};
    }
  }
  return {
    id: orderRecord.id,
    solicitudDoc: orderRecord.numeroDoc || orderRecord.numeroPedido || orderRecord.id,
    fechaSolicitud: orderRecord.fechaEmision || orderRecord.createdAt || '',
    status: String(orderRecord.status || orderRecord.estado || 'PENDIENTE_APROBACION').toUpperCase(),
    nombre: orderRecord.clienteNombre || '',
    rif: orderRecord.clienteRif || '',
    direccion: orderRecord.direccionEntrega || '',
    telefono: parsedMeta.telefono || orderRecord.telefono || '',
    email: parsedMeta.email || orderRecord.email || '',
    ciudad: parsedMeta.ciudad || '',
    estado: parsedMeta.estado || '',
    responsable: parsedMeta.responsable || '',
    tipoCliente: parsedMeta.tipoCliente || orderRecord.segmento || 'Mayorista',
    esContribuyente: parsedMeta.esContribuyente !== undefined ? Boolean(parsedMeta.esContribuyente) : true,
    esContribuyenteEspecial: Boolean(parsedMeta.esContribuyenteEspecial),
    zonaVenta: parsedMeta.zonaVenta || orderRecord.zonaVenta || '01',
    zonaNombre: parsedMeta.zonaNombre || orderRecord.zonaVenta || '',
    vendedorAsignado: parsedMeta.vendedorAsignado || orderRecord.vendedorCoVen || orderRecord.vendedorId || 'OF',
    vendedorNombre: orderRecord.vendedorNombre || orderRecord.vendedorId || orderRecord.creadoPor || '',
    limiteCreditoUsd: Number(parsedMeta.limiteCreditoUsd ?? orderRecord.totalUsd ?? orderRecord.totalNetoUsd ?? 0),
    diasCredito: Number(parsedMeta.diasCredito ?? orderRecord.diasCredito ?? 0),
    notasVendedor: parsedMeta.notasVendedor || (markerIdx >= 0 ? rawObs.slice(0, markerIdx).trim() : rawObs),
    aprobadoPor: orderRecord.aprobadoPor || null,
    fechaAprobacion: orderRecord.fechaAprobacion || null,
    motivoRechazo: orderRecord.motivoRechazo || null
  };
}

