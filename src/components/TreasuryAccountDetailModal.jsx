import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Wallet,
  Landmark,
  PlusCircle,
  Edit2,
  Trash2,
  List,
  Printer,
  FileText,
  Receipt,
  Layers,
  Lock,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Search
} from 'lucide-react';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import { generateExpenseVoucherPDF } from '../services/pdfReportService';
import {
  doesMovementBelongToAccount,
  classifyMovementDocOrigin,
  resolveOpeningBalanceMeta,
  formatTreasuryTimestampVe,
  isOpeningBalanceLockedForDesk,
  computeCashDeskFiscalBreakdown,
  computeAccountDebeHaberSummary,
  computeBankAccountValuation
} from '../utils/treasuryAccountUtils';

export default function TreasuryAccountDetailModal({
  isOpen,
  onClose,
  accountKind = 'CAJA', // 'CAJA' | 'BANCO'
  accountRecord = null,
  initialDocScope = 'ALL', // 'ALL' | 'FISCAL' | 'NOTA_ENTREGA'
  cashDesks = [],
  bankAccounts = [],
  cashMovements = [],
  movementsRunningBalanceMap = new Map(),
  fiscalSplitOverrides = {},
  config = {},
  currentUser = null,
  isMaster = false,
  onNewMovement,
  onEditAccount,
  onDeleteAccount,
  onOpenOpeningBalances,
  onJumpToMovements
}) {
  const [docScope, setDocScope] = useState(initialDocScope || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDocScope(initialDocScope || 'ALL');
      setSearchQuery('');
    }
  }, [isOpen, initialDocScope, accountRecord?.id, accountRecord?.coCaja, accountRecord?.codCta]);

  const isCaja = accountKind === 'CAJA';

  const accountTitle = useMemo(() => {
    if (!accountRecord) return '';
    if (isCaja) {
      return accountRecord.descripcion || accountRecord.desCaja || 'Caja Operativa';
    }
    return accountRecord.bancoNombre || accountRecord.banco_nombre || 'Cuenta Bancaria';
  }, [accountRecord, isCaja]);

  const accountCode = useMemo(() => {
    if (!accountRecord) return '';
    if (isCaja) {
      return String(accountRecord.coCaja || accountRecord.co_caja || accountRecord.id || 'CAJA').toUpperCase();
    }
    return `CTA-${String(accountRecord.codCta || accountRecord.cod_cta || accountRecord.id || '01').toUpperCase()}`;
  }, [accountRecord, isCaja]);

  const isBsAccount = useMemo(() => {
    if (!accountRecord) return false;
    return String(accountRecord.moneda || (isCaja ? 'USD' : 'BS')).toUpperCase() === 'BS';
  }, [accountRecord, isCaja]);

  const fmtPrimary = (usd, bs) => (isBsAccount ? formatBs(bs) : formatUsd(usd));
  const fmtSecondary = (usd, bs) => (isBsAccount ? formatUsd(usd) : formatBs(bs));

  const opening = useMemo(() => resolveOpeningBalanceMeta(accountRecord), [accountRecord]);

  const dhSummary = useMemo(() => {
    if (!accountRecord) return null;
    return computeAccountDebeHaberSummary(
      accountKind,
      accountRecord,
      cashMovements,
      cashDesks,
      bankAccounts,
      config
    );
  }, [accountKind, accountRecord, cashMovements, cashDesks, bankAccounts, config]);

  const fiscalBreakdown = useMemo(() => {
    if (!isCaja || !accountRecord) return null;
    return computeCashDeskFiscalBreakdown(
      accountRecord,
      cashMovements,
      cashDesks,
      bankAccounts,
      config,
      fiscalSplitOverrides
    );
  }, [isCaja, accountRecord, cashMovements, cashDesks, bankAccounts, config, fiscalSplitOverrides]);

  const bankValuation = useMemo(() => {
    if (isCaja || !accountRecord) return null;
    return computeBankAccountValuation(accountRecord, config);
  }, [isCaja, accountRecord, config]);

  // Todos los movimientos pertenecientes a esta cuenta
  const accountMovements = useMemo(() => {
    if (!accountRecord) return [];
    return (Array.isArray(cashMovements) ? cashMovements : [])
      .filter((m) => doesMovementBelongToAccount(m, accountKind, accountRecord, cashDesks, bankAccounts))
      .sort((a, b) => (new Date(b?.fecha || b?.createdAt || 0).getTime() || 0) - (new Date(a?.fecha || a?.createdAt || 0).getTime() || 0));
  }, [accountRecord, accountKind, cashMovements, cashDesks, bankAccounts]);

  const scopeCounts = useMemo(() => {
    let fiscal = 0;
    let notaEntrega = 0;
    accountMovements.forEach((m) => {
      if (classifyMovementDocOrigin(m) === 'FISCAL') fiscal += 1;
      else notaEntrega += 1;
    });
    return { all: accountMovements.length, fiscal, notaEntrega };
  }, [accountMovements]);

  // Movimientos filtrados por Factura Fiscal / Nota de Entrega / Consolidado y búsqueda
  const scopedMovements = useMemo(() => {
    let list = accountMovements;
    if (docScope === 'FISCAL') {
      list = list.filter((m) => classifyMovementDocOrigin(m) === 'FISCAL');
    } else if (docScope === 'NOTA_ENTREGA') {
      list = list.filter((m) => classifyMovementDocOrigin(m) !== 'FISCAL');
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        (m.concepto || '').toLowerCase().includes(q) ||
        (m.usuario || '').toLowerCase().includes(q) ||
        (m.metodoPago || m.metodo || '').toLowerCase().includes(q) ||
        (m.tipo || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [accountMovements, docScope, searchQuery]);

  const scopedTotals = useMemo(() => {
    let debeUsd = 0;
    let debeBs = 0;
    let debeCount = 0;
    let haberUsd = 0;
    let haberBs = 0;
    let haberCount = 0;
    scopedMovements.forEach((m) => {
      const isIng = String(m?.tipo || '').toUpperCase() === 'INGRESO';
      const usd = round2(Math.abs(Number(m?.montoUsd ?? m?.monto_usd ?? 0) || 0));
      const bs = round2(Math.abs(Number(m?.montoBs ?? m?.monto_bs ?? 0) || 0));
      if (isIng) {
        debeCount += 1;
        debeUsd = round2(debeUsd + usd);
        debeBs = round2(debeBs + bs);
      } else {
        haberCount += 1;
        haberUsd = round2(haberUsd + usd);
        haberBs = round2(haberBs + bs);
      }
    });
    return {
      debeUsd,
      debeBs,
      debeCount,
      haberUsd,
      haberBs,
      haberCount,
      netoUsd: round2(debeUsd - haberUsd),
      netoBs: round2(debeBs - haberBs)
    };
  }, [scopedMovements]);

  if (!isOpen || !accountRecord) return null;

  const isActiva = accountRecord.activa !== false;
  const lastUpdatedVe = formatTreasuryTimestampVe(accountRecord.fechaActualizacion || accountRecord.fecha_actualizacion);
  const titularNombre = accountRecord.cuentaANombreDe || accountRecord.cuenta_a_nombre_de || accountRecord.titular || 'GRUPO MOTORVEN, C.A.';
  const numCta = accountRecord.numCta || accountRecord.num_cta || 'N/A';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(2, 6, 23, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1240px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-glass)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden'
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '1.1rem 1.35rem',
          borderBottom: '1px solid var(--border-glass)',
          background: 'var(--bg-table-header)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '11px',
              background: isCaja ? 'rgba(2, 132, 199, 0.14)' : 'rgba(16, 185, 129, 0.14)',
              border: `1px solid ${isCaja ? 'rgba(2, 132, 199, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
              color: isCaja ? 'var(--brand-blue)' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isCaja ? <Wallet size={20} /> : <Landmark size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: 'var(--font-code)',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  padding: '0.18rem 0.55rem',
                  borderRadius: '6px',
                  background: 'rgba(2, 132, 199, 0.14)',
                  color: 'var(--brand-blue)'
                }}>
                  {accountCode}
                </span>
                <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {accountTitle}
                </h2>
                <span style={{
                  padding: '0.16rem 0.55rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: isActiva ? 'rgba(16, 185, 129, 0.14)' : 'rgba(148, 163, 184, 0.15)',
                  color: isActiva ? '#10b981' : 'var(--text-muted)'
                }}>
                  ● {isActiva ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                <span>Moneda: <strong style={{ color: 'var(--text-secondary)' }}>{accountRecord.moneda || (isCaja ? 'USD' : 'BS')}</strong></span>
                {isCaja ? (
                  <span>Responsable: <strong style={{ color: 'var(--text-secondary)' }}>{accountRecord.responsable || 'Administración'}</strong></span>
                ) : (
                  <>
                    <span>Titular: <strong style={{ color: 'var(--text-secondary)' }}>{titularNombre}</strong></span>
                    <span>N° Cuenta: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-code)' }}>{numCta}</strong></span>
                  </>
                )}
                {lastUpdatedVe && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> Act: {lastUpdatedVe}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{
              padding: '0.45rem',
              borderRadius: '8px',
              background: 'var(--bg-card-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)'
            }}
            title="Cerrar detalles"
          >
            <X size={18} />
          </button>
        </div>

        {/* CABECERA Y TARJETAS FIJAS (SIN SCROLL EXTERNO) */}
        <div style={{ padding: '0.95rem 1.25rem', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* SELECTOR: CONSOLIDADO vs FACTURA FISCAL vs NOTA DE ENTREGA + ACCIONES */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.65rem',
            flexWrap: 'wrap',
            padding: '0.6rem 0.85rem',
            borderRadius: '12px',
            background: 'var(--bg-card-glass)',
            border: '1px solid var(--border-glass)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.25rem', textTransform: 'uppercase' }}>
                Tipo de Documento:
              </span>
              {[
                { id: 'ALL', label: `Consolidado (${scopeCounts.all})`, icon: Layers, color: 'var(--brand-blue)' },
                { id: 'FISCAL', label: `Factura Fiscal (${scopeCounts.fiscal})`, icon: FileText, color: '#a855f7' },
                { id: 'NOTA_ENTREGA', label: `Nota de Entrega (${scopeCounts.notaEntrega})`, icon: Receipt, color: '#f59e0b' }
              ].map((opt) => {
                const Icon = opt.icon;
                const active = docScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDocScope(opt.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.42rem 0.75rem',
                      borderRadius: '8px',
                      border: active ? `1.5px solid ${opt.color}` : '1px solid var(--border-glass)',
                      background: active ? 'rgba(2, 132, 199, 0.1)' : 'var(--bg-surface)',
                      color: active ? opt.color : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Icon size={14} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* ACCIONES */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {onNewMovement && (
                <button
                  type="button"
                  onClick={() => onNewMovement(docScope === 'FISCAL' ? 'FISCAL' : 'NO_FISCAL')}
                  className="btn btn-primary"
                  style={{ padding: '0.42rem 0.78rem', fontSize: '0.78rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <PlusCircle size={14} /> Nuevo Movimiento
                </button>
              )}
              {onJumpToMovements && (
                <button
                  type="button"
                  onClick={() => onJumpToMovements(docScope === 'FISCAL' ? 'FISCAL' : (docScope === 'NOTA_ENTREGA' ? 'NO_FISCAL' : 'ALL'))}
                  className="btn"
                  style={{
                    padding: '0.42rem 0.75rem',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.14)',
                    color: '#0284c7',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontWeight: 600
                  }}
                >
                  <List size={14} /> Ver en ListView
                </button>
              )}
              {onEditAccount && (
                <button
                  type="button"
                  onClick={onEditAccount}
                  className="btn"
                  style={{
                    padding: '0.42rem 0.75rem',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    background: 'rgba(217, 119, 6, 0.14)',
                    color: '#d97706',
                    border: '1px solid rgba(217, 119, 6, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontWeight: 600
                  }}
                >
                  <Edit2 size={14} /> Editar
                </button>
              )}
              {isMaster && onDeleteAccount && (
                <button
                  type="button"
                  onClick={onDeleteAccount}
                  className="btn"
                  style={{
                    padding: '0.42rem 0.75rem',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.28)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontWeight: 600
                  }}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
          </div>

          {/* TARJETAS DE DETALLES FINANCIEROS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {/* 1. SALDO INICIAL */}
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              background: 'var(--bg-card-glass)',
              border: '1px solid var(--border-glass)'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-blue)', textTransform: 'uppercase' }}>
                Saldo Inicial (Apertura)
              </div>
              {opening.hasOpeningBalance ? (
                <>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-code)', marginTop: '0.2rem' }}>
                    {fmtPrimary(opening.saldoInicialUsd, opening.saldoInicialBs)}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                    {fmtSecondary(opening.saldoInicialUsd, opening.saldoInicialBs)}
                  </div>
                  {opening.fechaSaldoInicial && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {formatTreasuryTimestampVe(opening.fechaSaldoInicial)}
                      {opening.usuarioSaldoInicial ? ` · Por: ${opening.usuarioSaldoInicial}` : ''}
                    </div>
                  )}
                </>
              ) : isCaja && isOpeningBalanceLockedForDesk(accountRecord) ? (
                <div style={{ marginTop: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <Lock size={13} /> Bloqueado ($0.00)
                </div>
              ) : (
                <div style={{ marginTop: '0.35rem' }}>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sin fijar</div>
                  {onOpenOpeningBalances && (
                    <button
                      type="button"
                      onClick={onOpenOpeningBalances}
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        background: 'rgba(2, 132, 199, 0.12)',
                        color: 'var(--brand-blue)',
                        border: '1px solid rgba(2, 132, 199, 0.3)',
                        cursor: 'pointer'
                      }}
                    >
                      Definir Apertura
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 2. INGRESO (DEBE) */}
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                Ingreso / Debe ({scopedTotals.debeCount})
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-code)', marginTop: '0.2rem' }}>
                + {fmtPrimary(scopedTotals.debeUsd, scopedTotals.debeBs)}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {fmtSecondary(scopedTotals.debeUsd, scopedTotals.debeBs)}
              </div>
            </div>

            {/* 3. EGRESO (HABER) */}
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>
                Egreso / Haber ({scopedTotals.haberCount})
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-code)', marginTop: '0.2rem' }}>
                - {fmtPrimary(scopedTotals.haberUsd, scopedTotals.haberBs)}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {fmtSecondary(scopedTotals.haberUsd, scopedTotals.haberBs)}
              </div>
            </div>

            {/* 4. SALDO ACTUAL / FISCAL / NO FISCAL */}
            {isCaja && fiscalBreakdown ? (
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.28)'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-blue)', textTransform: 'uppercase' }}>
                  {docScope === 'FISCAL'
                    ? 'Saldo Factura Fiscal'
                    : docScope === 'NOTA_ENTREGA'
                      ? 'Saldo Nota de Entrega'
                      : 'Saldo Consolidado Total'}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-code)', marginTop: '0.2rem' }}>
                  {docScope === 'FISCAL'
                    ? fmtPrimary(fiscalBreakdown.fiscalUsd, fiscalBreakdown.fiscalBs)
                    : docScope === 'NOTA_ENTREGA'
                      ? fmtPrimary(fiscalBreakdown.noFiscalUsd, fiscalBreakdown.noFiscalBs)
                      : fmtPrimary(fiscalBreakdown.totalUsd, fiscalBreakdown.totalBs)}
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                  {docScope === 'FISCAL'
                    ? fmtSecondary(fiscalBreakdown.fiscalUsd, fiscalBreakdown.fiscalBs)
                    : docScope === 'NOTA_ENTREGA'
                      ? fmtSecondary(fiscalBreakdown.noFiscalUsd, fiscalBreakdown.noFiscalBs)
                      : fmtSecondary(fiscalBreakdown.totalUsd, fiscalBreakdown.totalBs)}
                </div>
                <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--border-glass)', fontSize: '0.69rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ color: '#a855f7', fontWeight: 700 }}>Fiscal: {fmtPrimary(fiscalBreakdown.fiscalUsd, fiscalBreakdown.fiscalBs)}</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>N/E: {fmtPrimary(fiscalBreakdown.noFiscalUsd, fiscalBreakdown.noFiscalBs)}</span>
                </div>
              </div>
            ) : bankValuation ? (
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.28)'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-blue)', textTransform: 'uppercase' }}>
                  Saldo Actual en Banco
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: bankValuation.bs < 0 ? '#ef4444' : '#10b981', fontFamily: 'var(--font-code)', marginTop: '0.2rem' }}>
                  {formatBs(bankValuation.bs)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                  {formatUsd(bankValuation.usd)}
                </div>
                {dhSummary && (
                  <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontFamily: 'var(--font-code)' }}>
                    Neto mov.: {dhSummary.netoBs >= 0 ? '+' : ''}{formatBs(dhSummary.netoBs)}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* BUSCADOR INTERNO DE MOVIMIENTOS DEL MODAL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Movimientos ({scopedMovements.length}) — {docScope === 'FISCAL' ? 'Factura Fiscal' : docScope === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Consolidado'}
            </h3>
            <div className="search-wrapper" style={{ flex: '0 1 280px', minWidth: '220px' }}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="input-modern search-input"
                placeholder="Filtrar concepto, usuario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.4rem 0.7rem 0.4rem 2.1rem', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          {/* TABLA DE MOVIMIENTOS DEL MODAL (SCROLL INTERNO CON CABECERA FIJA) */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'var(--bg-card-glass)' }}>
            {scopedMovements.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                No hay movimientos registrados para este filtro documental.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.81rem', tableLayout: 'auto' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-table-header)' }}>
                  <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Fecha</th>
                    <th style={{ padding: '0.65rem 0.6rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Tipo</th>
                    <th style={{ padding: '0.65rem 0.55rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Doc.</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Concepto</th>
                    <th style={{ padding: '0.65rem 0.7rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Usuario</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#10b981', textAlign: 'right', whiteSpace: 'nowrap' }}>Debe (+)</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#ef4444', textAlign: 'right', whiteSpace: 'nowrap' }}>Haber (-)</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: 'var(--brand-blue)', textAlign: 'right', whiteSpace: 'nowrap' }}>Saldo</th>
                    <th style={{ padding: '0.65rem 0.6rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', whiteSpace: 'nowrap' }}>Vale</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedMovements.map((m, idx) => {
                    const isIng = String(m?.tipo || '').toUpperCase() === 'INGRESO';
                    const isFiscalDoc = classifyMovementDocOrigin(m) === 'FISCAL';
                    const movUsd = Number(m.montoUsd ?? m.monto_usd ?? 0);
                    const movBs = Number(m.montoBs ?? m.monto_bs ?? 0);
                    const runBal = movementsRunningBalanceMap.get(m);
                    return (
                      <tr key={m.id || idx} style={{ borderBottom: '1px solid var(--border-glass)', background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)' }}>
                        <td style={{ padding: '0.58rem 0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                          {m.fecha ? new Date(m.fecha).toLocaleString() : 'N/A'}
                        </td>
                        <td style={{ padding: '0.58rem 0.6rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '0.16rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: isIng ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: isIng ? '#10b981' : '#ef4444'
                          }}>
                            {isIng ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                            {m.tipo}
                          </span>
                        </td>
                        <td style={{ padding: '0.58rem 0.55rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '12px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: isFiscalDoc ? 'rgba(168, 85, 247, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: isFiscalDoc ? '#a855f7' : '#f59e0b'
                          }}>
                            {isFiscalDoc ? 'Fiscal' : 'N/E'}
                          </span>
                        </td>
                        <td style={{ padding: '0.58rem 0.75rem', color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
                          {m.concepto}
                        </td>
                        <td style={{ padding: '0.58rem 0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {m.usuario || 'Sistema'}
                        </td>
                        <td style={{ padding: '0.58rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', whiteSpace: 'nowrap' }}>
                          {isIng ? (
                            <>
                              <div style={{ fontWeight: 700, color: '#10b981' }}>+ {formatUsd(movUsd)}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatBs(movBs)}</div>
                            </>
                          ) : <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>}
                        </td>
                        <td style={{ padding: '0.58rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', whiteSpace: 'nowrap' }}>
                          {!isIng ? (
                            <>
                              <div style={{ fontWeight: 700, color: '#ef4444' }}>- {formatUsd(movUsd)}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatBs(movBs)}</div>
                            </>
                          ) : <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>}
                        </td>
                        <td style={{ padding: '0.58rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-code)', whiteSpace: 'nowrap' }}>
                          {runBal ? (
                            <>
                              <div style={{ fontWeight: 800, color: 'var(--brand-blue)' }}>
                                {runBal.isBsAccount ? formatBs(runBal.saldoDespuesBs) : formatUsd(runBal.saldoDespuesUsd)}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {runBal.isBsAccount ? formatUsd(runBal.saldoDespuesUsd) : formatBs(runBal.saldoDespuesBs)}
                              </div>
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '0.58rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 6px', fontSize: '0.7rem' }}
                            onClick={() => generateExpenseVoucherPDF({ movement: m, config, currentUser })}
                            title="Generar Vale PDF"
                          >
                            <Printer size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
