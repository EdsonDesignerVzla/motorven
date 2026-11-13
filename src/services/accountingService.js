import {
  PLAN_DE_CUENTAS_MAP,
  mapCashDeskToAccount,
  mapBankAccountToAccount,
  mapSupplierToPayableAccount,
  mapMovementToAccount
} from '../data/planDeCuentasMotorven.js';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function resolveAccountMeta(codigo, planMap = PLAN_DE_CUENTAS_MAP) {
  const found = planMap[codigo];
  if (found) return found;

  const prefix = String(codigo || '').split('.')[0];
  const groupByPrefix = {
    '1': { grupo: 'ACTIVO', naturaleza: 'DEUDORA' },
    '2': { grupo: 'PASIVO', naturaleza: 'ACREEDORA' },
    '3': { grupo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
    '4': { grupo: 'INGRESOS', naturaleza: 'ACREEDORA' },
    '5': { grupo: 'COSTOS', naturaleza: 'DEUDORA' },
    '6': { grupo: 'EGRESOS', naturaleza: 'DEUDORA' }
  };
  return groupByPrefix[prefix] || { grupo: 'ACTIVO', naturaleza: 'DEUDORA' };
}

/**
 * Construye los asientos contables del Libro Diario en partida doble estricta
 * utilizando el Plan de Cuentas Oficial de Pro Motorven C.A.
 */
export function buildAccountingEntries({
  profitInvoices = [],
  profitCollections = [],
  profitPurchases = [],
  profitSupplierPayments = [],
  cashMovements = [],
  profitBankAccounts = [],
  desksList = [],
  tasa = 827.73
}) {
  const entries = [];
  let asientoSeq = 1001;

  // 1. Asientos de Facturas de Venta (Profit Invoices)
  profitInvoices.forEach((fac) => {
    if (fac.anulado || fac.anulada) return;
    const fNum = fac.factNum || fac.id;
    const fFecha = fac.fechaEmision || fac.fec_emis;
    const fTasa = Number(fac.tasa || tasa || 827.73);
    const totNetoUsd = round2(fac.totNetoUsd ?? fac.tot_neto_usd ?? (fac.totNetoBs ? fac.totNetoBs / fTasa : 0));
    if (totNetoUsd <= 0) return;

    // Resolver base e IVA evitando usar campos legacy desfasados cuando exista la versión normalizada
    const hasConsistentSnake =
      fac.iva_usd !== undefined &&
      fac.tot_bruto_usd !== undefined &&
      Math.abs((Number(fac.tot_bruto_usd) + Number(fac.iva_usd)) - totNetoUsd) < 0.05;

    let ivaUsd = hasConsistentSnake
      ? round2(fac.iva_usd)
      : round2(fac.ivaUsd ?? (fac.ivaBs ? fac.ivaBs / fTasa : 0));

    let totBrutoUsd = hasConsistentSnake
      ? round2(fac.tot_bruto_usd)
      : round2(fac.totBrutoUsd ?? (fac.totBrutoBs ? fac.totBrutoBs / fTasa : (totNetoUsd - ivaUsd)));

    let descuentoUsd = 0;
    const diff = round2(totNetoUsd - (totBrutoUsd + ivaUsd));
    if (Math.abs(diff) > 0) {
      if (Math.abs(diff) <= 0.05) {
        totBrutoUsd = round2(totNetoUsd - ivaUsd);
      } else if (diff < -0.05) {
        // Descuento aplicado sobre la base + IVA
        descuentoUsd = round2(Math.abs(diff));
      } else {
        // Recargo / ajuste positivo -> incrementar base ventas para cuadrar partida doble
        totBrutoUsd = round2(totNetoUsd - ivaUsd);
      }
    }

    const totNetoBs = round2(totNetoUsd * fTasa);
    const totBrutoBs = round2(totBrutoUsd * fTasa);
    const ivaBs = round2(ivaUsd * fTasa);
    const descuentoBs = round2(descuentoUsd * fTasa);

    const lines = [
      {
        cuentaCodigo: '1.01.03.001',
        cuentaNombre: 'Cuentas por Cobrar Comerciales',
        debeUsd: totNetoUsd,
        haberUsd: 0,
        debeBs: totNetoBs,
        haberBs: 0
      }
    ];

    if (descuentoUsd > 0) {
      lines.push({
        cuentaCodigo: '4.01.02.001',
        cuentaNombre: 'Descuento en Ventas',
        debeUsd: descuentoUsd,
        haberUsd: 0,
        debeBs: descuentoBs,
        haberBs: 0
      });
    }

    lines.push({
      cuentaCodigo: '4.01.01.001',
      cuentaNombre: 'Ventas',
      debeUsd: 0,
      haberUsd: totBrutoUsd,
      debeBs: 0,
      haberBs: totBrutoBs
    });

    if (ivaUsd > 0) {
      lines.push({
        cuentaCodigo: '2.03.01.005',
        cuentaNombre: 'Débito Fiscal',
        debeUsd: 0,
        haberUsd: ivaUsd,
        debeBs: 0,
        haberBs: ivaBs
      });
    }

    entries.push({
      id: `asi-fac-${fNum}`,
      asientoNum: `ASI-${asientoSeq++}`,
      fecha: fFecha,
      tipoOperacion: 'VENTA',
      origenDoc: `Factura Venta #${fNum}`,
      documentoReferencia: `FAC-${fNum}`,
      usuario: fac.coVen || fac.co_us_in || 'FACTURACIÓN',
      tasa: fTasa,
      concepto: `Facturación de venta a cliente: ${fac.clienteNombre || fac.cli_des || 'Cliente General'}`,
      montoTotalUsd: totNetoUsd,
      lines
    });
  });

  // 2. Asientos de Cobranzas y Recaudación (Profit Collections)
  profitCollections.forEach((cob) => {
    if (cob.anulado || cob.anulada) return;
    const cNum = cob.cobNum || cob.id;
    const cFecha = cob.fechaCobro || cob.fec_cob || cob.fecha;
    const cTasa = Number(cob.tasa || tasa || 827.73);
    const rawUsd = Number(cob.montoUsd ?? cob.monto_usd ?? 0);
    const rawBs = Number(cob.montoBs ?? cob.monto_bs ?? 0);
    const rawOrig = Number(cob.monto ?? 0);

    let montoUsd = 0;
    let montoBs = 0;

    if (rawBs > 0 && cTasa > 10 && Math.abs((rawUsd * cTasa) - rawBs) <= Math.max(2, rawBs * 0.05)) {
      montoUsd = round2(rawUsd);
      montoBs = round2(rawBs);
    } else if (cTasa > 10 && ((rawBs > 0 && Math.abs(rawUsd - rawBs) < 1) || (!rawBs && rawOrig > 0 && Math.abs(rawUsd - rawOrig) < 1))) {
      // Dump histórico de Profit: `monto` en Bs fue copiado en `montoUsd`
      montoUsd = round2(rawUsd / cTasa);
      montoBs = round2(rawUsd);
    } else {
      montoUsd = round2(rawUsd || (rawBs && cTasa > 1 ? rawBs / cTasa : 0));
      montoBs = round2(rawBs || (montoUsd * cTasa));
    }

    if (montoUsd <= 0) return;

    let ctaRecaudacion = { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
    const ctaBancariaId = cob.cuentaBancariaId || cob.bancoId || cob.codCta;
    const cajaId = cob.cajaId || cob.cashDeskId;
    const primaryFp = Array.isArray(cob.formasPago) && cob.formasPago.length > 0 ? cob.formasPago[0] : null;
    const fpTipo = String(primaryFp?.formaPago || primaryFp?.tipo || cob.formaPago || cob.metodo || '').toUpperCase();
    const fpCajaCod = String(primaryFp?.codCaja || '').trim();

    if (ctaBancariaId) {
      const foundBank = profitBankAccounts.find(b => b.id === ctaBancariaId || b.codCta === ctaBancariaId);
      ctaRecaudacion = mapBankAccountToAccount(foundBank || { id: ctaBancariaId });
    } else if (cajaId) {
      const foundDesk = desksList.find(d => d.id === cajaId || d.coCaja === cajaId);
      ctaRecaudacion = mapCashDeskToAccount(foundDesk || { id: cajaId });
    } else if (primaryFp && (fpTipo.includes('DEPO') || fpTipo.includes('TRAN') || fpTipo.includes('TPAG') || fpTipo.includes('CHEQ'))) {
      const foundBank = profitBankAccounts.find(
        b => b.codCta === fpCajaCod || b.id === `CTA-${fpCajaCod}` || b.id === primaryFp.banco
      );
      ctaRecaudacion = mapBankAccountToAccount(foundBank || { id: `CTA-${fpCajaCod}` });
    } else if (fpCajaCod) {
      const foundDesk = desksList.find(
        d => d.id === fpCajaCod || d.id === `caja-${fpCajaCod}` || d.coCaja === `CAJA-${fpCajaCod}`
      );
      ctaRecaudacion = mapCashDeskToAccount(foundDesk || { id: fpCajaCod });
    } else if (fpTipo.includes('ZELLE') || fpTipo === '04') {
      ctaRecaudacion = { codigo: '1.01.01.004', nombre: 'Zelle' };
    } else if (cob.moneda === 'BS' || fpTipo.includes('BS')) {
      ctaRecaudacion = { codigo: '1.01.01.001', nombre: 'Caja Moneda Nacional' };
    }

    entries.push({
      id: `asi-cob-${cNum}`,
      asientoNum: `ASI-${asientoSeq++}`,
      fecha: cFecha,
      tipoOperacion: 'COBRO',
      origenDoc: `Recibo de Cobro #${cNum}`,
      documentoReferencia: `COB-${cNum}`,
      usuario: cob.coVen || cob.co_us_in || 'COBRANZAS',
      tasa: cTasa,
      concepto: `Recaudación de cobranza cliente: ${cob.clienteNombre || 'Cliente General'}`,
      montoTotalUsd: montoUsd,
      lines: [
        {
          cuentaCodigo: ctaRecaudacion.codigo,
          cuentaNombre: ctaRecaudacion.nombre,
          debeUsd: montoUsd,
          haberUsd: 0,
          debeBs: montoBs,
          haberBs: 0
        },
        {
          cuentaCodigo: '1.01.03.001',
          cuentaNombre: 'Cuentas por Cobrar Comerciales',
          debeUsd: 0,
          haberUsd: montoUsd,
          debeBs: 0,
          haberBs: montoBs
        }
      ]
    });
  });

  // 3. Asientos de Facturas de Compra de Lubricantes (Profit Purchases)
  profitPurchases.forEach((pur) => {
    if (pur.anulado || pur.anulada) return;
    const pNum = pur.factNum || pur.id;
    const pFecha = pur.fechaEmision || pur.fec_emis;
    const pTasa = Number(pur.tasa || tasa || 827.73);
    const totNetoUsd = round2(pur.totNetoUsd || 0);
    if (totNetoUsd <= 0) return;

    let ivaUsd = round2(pur.ivaUsd ?? (totNetoUsd - Number(pur.totBrutoUsd || (totNetoUsd / 1.16))));
    let totBrutoUsd = round2(pur.totBrutoUsd ?? (totNetoUsd - ivaUsd));
    let costosAdicionalesUsd = 0;

    const diffCompra = round2(totNetoUsd - (totBrutoUsd + ivaUsd));
    if (Math.abs(diffCompra) > 0) {
      if (Math.abs(diffCompra) <= 0.05) {
        totBrutoUsd = round2(totNetoUsd - ivaUsd);
      } else if (diffCompra > 0.05) {
        costosAdicionalesUsd = diffCompra;
      } else {
        totBrutoUsd = Math.max(0, round2(totNetoUsd - ivaUsd));
      }
    }

    const retIvaUsd = round2(pur.retencionIvaUsd || pur.retIvaUsd || 0);
    const retIslrUsd = round2(pur.retencionIslrUsd || pur.retIslrUsd || 0);
    const netoPagarUsd = round2(Math.max(0, totNetoUsd - retIvaUsd - retIslrUsd));

    const totBrutoBs = round2(totBrutoUsd * pTasa);
    const ivaBs = round2(ivaUsd * pTasa);
    const costosAdicionalesBs = round2(costosAdicionalesUsd * pTasa);
    const retIvaBs = round2(retIvaUsd * pTasa);
    const retIslrBs = round2(retIslrUsd * pTasa);
    const netoPagarBs = round2(netoPagarUsd * pTasa);

    const ctaProveedor = mapSupplierToPayableAccount(pur);

    const lines = [
      {
        cuentaCodigo: '1.04.01.001',
        cuentaNombre: 'Inventario de Mercancia',
        debeUsd: totBrutoUsd,
        haberUsd: 0,
        debeBs: totBrutoBs,
        haberBs: 0
      }
    ];

    if (ivaUsd > 0) {
      lines.push({
        cuentaCodigo: '1.05.01.005',
        cuentaNombre: 'Crédito Fiscal',
        debeUsd: ivaUsd,
        haberUsd: 0,
        debeBs: ivaBs,
        haberBs: 0
      });
    }

    if (costosAdicionalesUsd > 0) {
      lines.push({
        cuentaCodigo: '5.01.01.002',
        cuentaNombre: 'Costos por Servicios',
        debeUsd: costosAdicionalesUsd,
        haberUsd: 0,
        debeBs: costosAdicionalesBs,
        haberBs: 0
      });
    }

    if (retIvaUsd > 0) {
      lines.push({
        cuentaCodigo: '1.05.01.007',
        cuentaNombre: 'Retencion de IVA',
        debeUsd: 0,
        haberUsd: retIvaUsd,
        debeBs: 0,
        haberBs: retIvaBs
      });
    }

    if (retIslrUsd > 0) {
      lines.push({
        cuentaCodigo: '2.03.01.006',
        cuentaNombre: 'Retencion de ISLR Proveedores',
        debeUsd: 0,
        haberUsd: retIslrUsd,
        debeBs: 0,
        haberBs: retIslrBs
      });
    }

    lines.push({
      cuentaCodigo: ctaProveedor.codigo,
      cuentaNombre: ctaProveedor.nombre,
      debeUsd: 0,
      haberUsd: netoPagarUsd,
      debeBs: 0,
      haberBs: netoPagarBs
    });

    entries.push({
      id: `asi-pur-${pNum}`,
      asientoNum: `ASI-${asientoSeq++}`,
      fecha: pFecha,
      tipoOperacion: 'COMPRA',
      origenDoc: `Factura Compra #${pNum}`,
      documentoReferencia: `COM-${pNum}`,
      usuario: pur.co_us_in || 'PROCURA',
      tasa: pTasa,
      concepto: `Recepción de compra proveedor: ${pur.provNombre || 'Distribuidor Keystone'}`,
      montoTotalUsd: totNetoUsd,
      lines
    });
  });

  // 4. Asientos de Pagos a Proveedores (Profit Supplier Payments)
  profitSupplierPayments.forEach((pay) => {
    if (pay.anulado || pay.anulada) return;
    const payNum = pay.pagoNum || pay.id;
    const payFecha = pay.fechaPago || pay.fec_pago;
    const payTasa = Number(pay.tasa || tasa || 827.73);
    const montoUsd = round2(pay.montoUsd || 0);
    if (montoUsd <= 0) return;
    const montoBs = round2(montoUsd * payTasa);

    const ctaProveedor = mapSupplierToPayableAccount(pay);

    let ctaPago = { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
    const ctaBancariaId = pay.cuentaBancariaId || pay.bancoId || pay.cuentaId;
    const cajaId = pay.cajaId;

    if (ctaBancariaId) {
      const foundBank = profitBankAccounts.find(b => b.id === ctaBancariaId || b.codCta === ctaBancariaId);
      ctaPago = mapBankAccountToAccount(foundBank || { id: ctaBancariaId });
    } else if (cajaId) {
      const foundDesk = desksList.find(d => d.id === cajaId);
      ctaPago = mapCashDeskToAccount(foundDesk || { id: cajaId });
    }

    entries.push({
      id: `asi-pay-${payNum}`,
      asientoNum: `ASI-${asientoSeq++}`,
      fecha: payFecha,
      tipoOperacion: 'PAGO_PROVEEDOR',
      origenDoc: `Comprobante de Pago #${payNum}`,
      documentoReferencia: `PAG-${payNum}`,
      usuario: pay.co_us_in || 'TESORERÍA',
      tasa: payTasa,
      concepto: `Pago / Abono a proveedor: ${pay.provNombre || 'Proveedor'}`,
      montoTotalUsd: montoUsd,
      lines: [
        {
          cuentaCodigo: ctaProveedor.codigo,
          cuentaNombre: ctaProveedor.nombre,
          debeUsd: montoUsd,
          haberUsd: 0,
          debeBs: montoBs,
          haberBs: 0
        },
        {
          cuentaCodigo: ctaPago.codigo,
          cuentaNombre: ctaPago.nombre,
          debeUsd: 0,
          haberUsd: montoUsd,
          debeBs: 0,
          haberBs: montoBs
        }
      ]
    });
  });

  // 5. Asientos de Movimientos de Caja Chica (Cash Movements)
  cashMovements.forEach((mov, idx) => {
    const montoUsd = round2(mov.montoUsd || 0);
    if (montoUsd <= 0) return;
    const movTasa = Number(mov.tasa || tasa || 827.73);
    const montoBs = round2(mov.montoBs || (montoUsd * movTasa));
    const isEgreso = (mov.tipo || 'EGRESO').toUpperCase() === 'EGRESO';
    const mId = mov.id || `mov-${idx + 1}`;
    const mFecha = mov.fecha || mov.createdAt || new Date().toISOString();

    let ctaCaja = { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
    if (mov.metodo === 'BS' || mov.moneda === 'BS') {
      ctaCaja = { codigo: '1.01.01.001', nombre: 'Caja Moneda Nacional' };
    } else if (mov.metodo === 'ZELLE') {
      ctaCaja = { codigo: '1.01.01.004', nombre: 'Zelle' };
    }

    const ctaRubro = mapMovementToAccount(mov);

    const lines = isEgreso
      ? [
          {
            cuentaCodigo: ctaRubro.codigo,
            cuentaNombre: ctaRubro.nombre,
            debeUsd: montoUsd,
            haberUsd: 0,
            debeBs: montoBs,
            haberBs: 0
          },
          {
            cuentaCodigo: ctaCaja.codigo,
            cuentaNombre: ctaCaja.nombre,
            debeUsd: 0,
            haberUsd: montoUsd,
            debeBs: 0,
            haberBs: montoBs
          }
        ]
      : [
          {
            cuentaCodigo: ctaCaja.codigo,
            cuentaNombre: ctaCaja.nombre,
            debeUsd: montoUsd,
            haberUsd: 0,
            debeBs: montoBs,
            haberBs: 0
          },
          {
            cuentaCodigo: ctaRubro.codigo,
            cuentaNombre: ctaRubro.nombre,
            debeUsd: 0,
            haberUsd: montoUsd,
            debeBs: 0,
            haberBs: montoBs
          }
        ];

    entries.push({
      id: `asi-mov-${mId}`,
      asientoNum: `ASI-${asientoSeq++}`,
      fecha: mFecha,
      tipoOperacion: 'CAJA_CHICA',
      origenDoc: `Movimiento Caja #${mId}`,
      documentoReferencia: `CAJA-${mId}`,
      usuario: mov.usuario || 'ADMINISTRACIÓN',
      tasa: movTasa,
      concepto: `${isEgreso ? 'Egreso Operativo' : 'Ingreso Operativo'}: ${mov.concepto || 'Movimiento de Caja Chica'}`,
      montoTotalUsd: montoUsd,
      lines
    });
  });

  return entries.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
}

/**
 * Calcula el Balance de Comprobación de Sumas y Saldos por Cuenta Contable
 */
export function computeTrialBalance(accountingEntries = [], planMap = PLAN_DE_CUENTAS_MAP) {
  const accountsMap = {};

  accountingEntries.forEach((entry) => {
    (entry.lines || []).forEach((line) => {
      const code = line.cuentaCodigo;
      if (!accountsMap[code]) {
        const meta = resolveAccountMeta(code, planMap);
        accountsMap[code] = {
          codigo: code,
          nombre: line.cuentaNombre || meta.nombre || code,
          grupo: meta.grupo,
          naturaleza: meta.naturaleza,
          subgrupo: meta.subgrupo || '',
          totalDebeUsd: 0,
          totalHaberUsd: 0,
          totalDebeBs: 0,
          totalHaberBs: 0
        };
      }
      accountsMap[code].totalDebeUsd += Number(line.debeUsd || 0);
      accountsMap[code].totalHaberUsd += Number(line.haberUsd || 0);
      accountsMap[code].totalDebeBs += Number(line.debeBs || 0);
      accountsMap[code].totalHaberBs += Number(line.haberBs || 0);
    });
  });

  const accounts = Object.values(accountsMap).map((acc) => {
    const totalDebeUsd = round2(acc.totalDebeUsd);
    const totalHaberUsd = round2(acc.totalHaberUsd);
    const totalDebeBs = round2(acc.totalDebeBs);
    const totalHaberBs = round2(acc.totalHaberBs);

    const saldoNetoUsd = round2(totalDebeUsd - totalHaberUsd);
    const saldoDeudorUsd = saldoNetoUsd > 0 ? saldoNetoUsd : 0;
    const saldoAcreedorUsd = saldoNetoUsd < 0 ? Math.abs(saldoNetoUsd) : 0;

    const saldoNetoBs = round2(totalDebeBs - totalHaberBs);
    const saldoDeudorBs = saldoNetoBs > 0 ? saldoNetoBs : 0;
    const saldoAcreedorBs = saldoNetoBs < 0 ? Math.abs(saldoNetoBs) : 0;

    return {
      ...acc,
      totalDebeUsd,
      totalHaberUsd,
      totalDebeBs,
      totalHaberBs,
      saldoDeudorUsd,
      saldoAcreedorUsd,
      saldoDeudorBs,
      saldoAcreedorBs
    };
  }).sort((a, b) => a.codigo.localeCompare(b.codigo));

  const totalSumasDebeUsd = round2(accounts.reduce((s, a) => s + a.totalDebeUsd, 0));
  const totalSumasHaberUsd = round2(accounts.reduce((s, a) => s + a.totalHaberUsd, 0));
  const totalSaldosDeudorUsd = round2(accounts.reduce((s, a) => s + a.saldoDeudorUsd, 0));
  const totalSaldosAcreedorUsd = round2(accounts.reduce((s, a) => s + a.saldoAcreedorUsd, 0));
  const totalSumasDebeBs = round2(accounts.reduce((s, a) => s + a.totalDebeBs, 0));
  const totalSumasHaberBs = round2(accounts.reduce((s, a) => s + a.totalHaberBs, 0));

  const isBalanced =
    Math.abs(totalSumasDebeUsd - totalSumasHaberUsd) < 0.05 &&
    Math.abs(totalSaldosDeudorUsd - totalSaldosAcreedorUsd) < 0.05;

  return {
    accounts,
    totalSumasDebeUsd,
    totalSumasHaberUsd,
    totalSaldosDeudorUsd,
    totalSaldosAcreedorUsd,
    totalSumasDebeBs,
    totalSumasHaberBs,
    isBalanced
  };
}

/**
 * Construye el Libro Mayor General cronológico con saldo acumulado por cuenta
 */
export function computeGeneralLedger(accountingEntries = [], planMap = PLAN_DE_CUENTAS_MAP) {
  const chronological = [...accountingEntries].sort(
    (a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0)
  );

  const ledgerMap = {};

  chronological.forEach((entry) => {
    (entry.lines || []).forEach((line) => {
      const code = line.cuentaCodigo;
      if (!ledgerMap[code]) {
        const meta = resolveAccountMeta(code, planMap);
        ledgerMap[code] = {
          codigo: code,
          nombre: line.cuentaNombre || meta.nombre || code,
          grupo: meta.grupo,
          naturaleza: meta.naturaleza,
          subgrupo: meta.subgrupo || '',
          totalDebeUsd: 0,
          totalHaberUsd: 0,
          saldoFinalUsd: 0,
          totalDebeBs: 0,
          totalHaberBs: 0,
          saldoFinalBs: 0,
          movements: []
        };
      }

      const acc = ledgerMap[code];
      const debeUsd = Number(line.debeUsd || 0);
      const haberUsd = Number(line.haberUsd || 0);
      const debeBs = Number(line.debeBs || 0);
      const haberBs = Number(line.haberBs || 0);

      acc.totalDebeUsd = round2(acc.totalDebeUsd + debeUsd);
      acc.totalHaberUsd = round2(acc.totalHaberUsd + haberUsd);
      acc.totalDebeBs = round2(acc.totalDebeBs + debeBs);
      acc.totalHaberBs = round2(acc.totalHaberBs + haberBs);

      const deltaUsd = acc.naturaleza === 'DEUDORA' ? (debeUsd - haberUsd) : (haberUsd - debeUsd);
      const deltaBs = acc.naturaleza === 'DEUDORA' ? (debeBs - haberBs) : (haberBs - debeBs);

      acc.saldoFinalUsd = round2(acc.saldoFinalUsd + deltaUsd);
      acc.saldoFinalBs = round2(acc.saldoFinalBs + deltaBs);

      acc.movements.push({
        fecha: entry.fecha,
        asientoNum: entry.asientoNum,
        tipoOperacion: entry.tipoOperacion,
        documentoReferencia: entry.documentoReferencia,
        concepto: entry.concepto,
        debeUsd: round2(debeUsd),
        haberUsd: round2(haberUsd),
        debeBs: round2(debeBs),
        haberBs: round2(haberBs),
        saldoAcumuladoUsd: acc.saldoFinalUsd,
        saldoAcumuladoBs: acc.saldoFinalBs
      });
    });
  });

  const accounts = Object.values(ledgerMap).sort((a, b) => a.codigo.localeCompare(b.codigo));
  return {
    accounts,
    accountsByCode: ledgerMap
  };
}

/**
 * Genera el Estado de Resultados y el Balance General (BA VEN-NIF 2)
 * garantizando matemáticamente la Ecuación Patrimonial:
 * Activo = Pasivo + Patrimonio Base + Resultado del Ejercicio
 */
export function computeFinancialStatements(trialBalance, planMap = PLAN_DE_CUENTAS_MAP) {
  const accounts = trialBalance?.accounts || [];

  const ingresos = [];
  const costos = [];
  const egresos = [];
  const activo = [];
  const pasivo = [];
  const patrimonio = [];

  accounts.forEach((acc) => {
    const meta = resolveAccountMeta(acc.codigo, planMap);
    const grupo = acc.grupo || meta.grupo;
    const debeHaberUsd = round2(acc.totalDebeUsd - acc.totalHaberUsd);
    const haberDebeUsd = round2(acc.totalHaberUsd - acc.totalDebeUsd);
    const debeHaberBs = round2(acc.totalDebeBs - acc.totalHaberBs);
    const haberDebeBs = round2(acc.totalHaberBs - acc.totalDebeBs);

    if (grupo === 'INGRESOS') {
      // Contra-cuentas de ingresos (ej. 4.01.02 Descuentos en Ventas) restan naturalmente con haber - debe negativo
      ingresos.push({ ...acc, saldoUsd: haberDebeUsd, saldoBs: haberDebeBs });
    } else if (grupo === 'COSTOS') {
      costos.push({ ...acc, saldoUsd: debeHaberUsd, saldoBs: debeHaberBs });
    } else if (grupo === 'EGRESOS') {
      egresos.push({ ...acc, saldoUsd: debeHaberUsd, saldoBs: debeHaberBs });
    } else if (grupo === 'ACTIVO') {
      activo.push({ ...acc, saldoUsd: debeHaberUsd, saldoBs: debeHaberBs });
    } else if (grupo === 'PASIVO') {
      pasivo.push({ ...acc, saldoUsd: haberDebeUsd, saldoBs: haberDebeBs });
    } else if (grupo === 'PATRIMONIO') {
      patrimonio.push({ ...acc, saldoUsd: haberDebeUsd, saldoBs: haberDebeBs });
    }
  });

  // Estado de Resultados (P&L)
  const totalIngresosUsd = round2(ingresos.reduce((s, a) => s + a.saldoUsd, 0));
  const totalIngresosBs = round2(ingresos.reduce((s, a) => s + a.saldoBs, 0));

  const totalCostosUsd = round2(costos.reduce((s, a) => s + a.saldoUsd, 0));
  const totalCostosBs = round2(costos.reduce((s, a) => s + a.saldoBs, 0));

  const utilidadBrutaUsd = round2(totalIngresosUsd - totalCostosUsd);
  const utilidadBrutaBs = round2(totalIngresosBs - totalCostosBs);

  const totalEgresosUsd = round2(egresos.reduce((s, a) => s + a.saldoUsd, 0));
  const totalEgresosBs = round2(egresos.reduce((s, a) => s + a.saldoBs, 0));

  const resultadoEjercicioUsd = round2(utilidadBrutaUsd - totalEgresosUsd);
  const resultadoEjercicioBs = round2(utilidadBrutaBs - totalEgresosBs);

  // Balance General (Estado de Situación Financiera)
  const totalActivoUsd = round2(activo.reduce((s, a) => s + a.saldoUsd, 0));
  const totalActivoBs = round2(activo.reduce((s, a) => s + a.saldoBs, 0));

  const totalPasivoUsd = round2(pasivo.reduce((s, a) => s + a.saldoUsd, 0));
  const totalPasivoBs = round2(pasivo.reduce((s, a) => s + a.saldoBs, 0));

  const patrimonioBaseUsd = round2(patrimonio.reduce((s, a) => s + a.saldoUsd, 0));
  const patrimonioBaseBs = round2(patrimonio.reduce((s, a) => s + a.saldoBs, 0));

  const totalPatrimonioUsd = round2(patrimonioBaseUsd + resultadoEjercicioUsd);
  const totalPatrimonioBs = round2(patrimonioBaseBs + resultadoEjercicioBs);

  const totalPasivoYPatrimonioUsd = round2(totalPasivoUsd + totalPatrimonioUsd);
  const totalPasivoYPatrimonioBs = round2(totalPasivoBs + totalPatrimonioBs);

  const diferenciaEcuacionUsd = round2(totalActivoUsd - totalPasivoYPatrimonioUsd);
  const ecuacionCuadrada = Math.abs(diferenciaEcuacionUsd) < 0.05;

  return {
    estadoResultados: {
      ingresos,
      costos,
      egresos,
      totalIngresosUsd,
      totalIngresosBs,
      totalCostosUsd,
      totalCostosBs,
      utilidadBrutaUsd,
      utilidadBrutaBs,
      totalEgresosUsd,
      totalEgresosBs,
      resultadoEjercicioUsd,
      resultadoEjercicioBs,
      cuentaResultadoCodigo: resultadoEjercicioUsd >= 0 ? '3.02.01.001' : '3.02.02.001',
      cuentaResultadoNombre: resultadoEjercicioUsd >= 0 ? 'Superavit del Ejercicio' : 'Déficit del Ejercicio'
    },
    balanceGeneral: {
      activo,
      pasivo,
      patrimonio,
      totalActivoUsd,
      totalActivoBs,
      totalPasivoUsd,
      totalPasivoBs,
      patrimonioBaseUsd,
      patrimonioBaseBs,
      resultadoEjercicioUsd,
      resultadoEjercicioBs,
      totalPatrimonioUsd,
      totalPatrimonioBs,
      totalPasivoYPatrimonioUsd,
      totalPasivoYPatrimonioBs,
      diferenciaEcuacionUsd,
      ecuacionCuadrada
    }
  };
}
