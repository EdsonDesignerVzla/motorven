import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Save,
  History,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Clock,
  Wand2
} from 'lucide-react';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import { fetchTreasuryOpeningBalancesHistory } from '../services/supabaseService';
import {
  buildCashDesksOpeningEvolutionRows,
  mergeOpeningBalanceFields,
  formatTreasuryTimestampVe,
  isoToVetDatetimeLocal,
  vetDatetimeLocalToIso,
  resolveExchangeRates,
  isOpeningBalanceLockedForDesk
} from '../utils/treasuryAccountUtils';
import { useNotification } from '../context/NotificationContext';

export default function OpeningBalancesEvolutionModal({
  isOpen,
  onClose,
  cashDesks = [],
  cashMovements = [],
  bankAccounts = [],
  config = {},
  currentUser,
  onUpdateCashDesk
}) {
  const notify = useNotification();
  const { tasaBcv } = useMemo(() => resolveExchangeRates(config), [config]);
  const activeActorName = String(currentUser?.nombre || currentUser?.username || 'Administración').trim() || 'Administración';

  // Borradores editables indexados por id/código de caja
  const [drafts, setDrafts] = useState({});
  const [syncCurrentToExpected, setSyncCurrentToExpected] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  // Panel de respaldos históricos del servidor SVR-MOTORVEN
  const [showBackupsSection, setShowBackupsSection] = useState(false);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState('');
  const [backupsData, setBackupsData] = useState(null);

  const evolution = useMemo(
    () => buildCashDesksOpeningEvolutionRows(cashDesks, cashMovements, bankAccounts, config),
    [cashDesks, cashMovements, bankAccounts, config]
  );

  // Inicializar borradores cuando se abre el modal o cambian las cajas
  useEffect(() => {
    if (!isOpen) return;
    setDrafts((prev) => {
      const next = {};
      evolution.rows.forEach((row) => {
        const key = row.id || row.code;
        if (prev[key] && prev[key].dirty) {
          next[key] = prev[key];
        } else {
          const defaultDateIso = row.fechaSaldoInicial || row.fechaActualizacion || new Date().toISOString();
          next[key] = {
            usd: row.hasOpeningBalance ? String(row.openingUsd) : String(row.openingUsd),
            bs: row.hasOpeningBalance ? String(row.openingBs) : String(row.openingBs),
            fechaVet: isoToVetDatetimeLocal(defaultDateIso),
            dirty: false
          };
        }
      });
      return next;
    });
  }, [isOpen, evolution.rows]);

  // Calcular vista en tiempo real usando los borradores editables
  const liveRows = useMemo(() => {
    return evolution.rows.map((row) => {
      const key = row.id || row.code;
      const draft = drafts[key] || {
        usd: String(row.openingUsd),
        bs: String(row.openingBs),
        fechaVet: isoToVetDatetimeLocal(row.fechaSaldoInicial || row.fechaActualizacion || new Date().toISOString()),
        dirty: false
      };
      const draftUsd = round2(parseFloat(draft.usd) || 0);
      const draftBs = round2(parseFloat(draft.bs) || 0);
      const expectedUsd = round2(draftUsd + row.movNetoUsd);
      const expectedBs = round2(draftBs + row.movNetoBs);
      const diffUsd = round2(row.currentUsd - expectedUsd);
      const diffBs = round2(row.currentBs - expectedBs);
      const isBalanced = row.isBsDesk ? Math.abs(diffBs) < 0.01 : Math.abs(diffUsd) < 0.01;

      return {
        ...row,
        key,
        draft,
        draftUsd,
        draftBs,
        liveExpectedUsd: expectedUsd,
        liveExpectedBs: expectedBs,
        liveDiffUsd: diffUsd,
        liveDiffBs: diffBs,
        liveIsBalanced: isBalanced
      };
    });
  }, [evolution.rows, drafts]);

  const liveTotals = useMemo(() => {
    let initUsd = 0;
    let initBs = 0;
    let expectedUsd = 0;
    let expectedBs = 0;
    let diffUsd = 0;
    let diffBs = 0;
    let dirtyCount = 0;

    liveRows.forEach((r) => {
      initUsd = round2(initUsd + r.draftUsd);
      initBs = round2(initBs + r.draftBs);
      expectedUsd = round2(expectedUsd + r.liveExpectedUsd);
      expectedBs = round2(expectedBs + r.liveExpectedBs);
      diffUsd = round2(diffUsd + r.liveDiffUsd);
      diffBs = round2(diffBs + r.liveDiffBs);
      if (r.draft.dirty) dirtyCount += 1;
    });

    return {
      initUsd,
      initBs,
      movCount: evolution.totals.movCount,
      movNetoUsd: evolution.totals.movNetoUsd,
      movNetoBs: evolution.totals.movNetoBs,
      expectedUsd,
      expectedBs,
      currentUsd: evolution.totals.currentUsd,
      currentBs: evolution.totals.currentBs,
      diffUsd,
      diffBs,
      dirtyCount,
      allBalanced: Math.abs(diffUsd) < 0.01
    };
  }, [liveRows, evolution.totals]);

  if (!isOpen) return null;

  const updateRowDraft = (rowKey, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || { usd: '0', bs: '0', fechaVet: isoToVetDatetimeLocal(new Date().toISOString()) }),
        ...patch,
        dirty: true
      }
    }));
  };

  const handleApplyImpliedBaseToRow = (row) => {
    updateRowDraft(row.key, {
      usd: String(round2(row.impliedBaseUsd)),
      bs: String(round2(row.impliedBaseBs))
    });
  };

  const handleAutoFillAllUnset = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      liveRows.forEach((row) => {
        if (isOpeningBalanceLockedForDesk(row.desk || row.code)) return;
        next[row.key] = {
          ...(next[row.key] || {}),
          usd: String(round2(row.impliedBaseUsd)),
          bs: String(round2(row.impliedBaseBs)),
          fechaVet: next[row.key]?.fechaVet || isoToVetDatetimeLocal(row.fechaSaldoInicial || row.fechaActualizacion || new Date().toISOString()),
          dirty: true
        };
      });
      return next;
    });
    notify.info('Se precargó el Saldo Base (Actual − Movimientos) en los borradores. Revisa los montos y pulsa Guardar.');
  };

  const buildPayloadForRow = (row) => {
    const nowIso = new Date().toISOString();
    const resolvedFechaIso = vetDatetimeLocalToIso(row.draft.fechaVet) || row.fechaSaldoInicial || nowIso;
    const nextCurrentUsd = syncCurrentToExpected ? row.liveExpectedUsd : row.currentUsd;
    const nextCurrentBs = syncCurrentToExpected ? row.liveExpectedBs : row.currentBs;

    const basePayload = {
      ...row.desk,
      saldoUsd: nextCurrentUsd,
      saldo_usd: nextCurrentUsd,
      saldoBs: nextCurrentBs,
      saldo_bs: nextCurrentBs,
      saldoActual: nextCurrentBs,
      saldo_actual: nextCurrentBs,
      saldoInicialUsd: row.draftUsd,
      saldo_inicial_usd: row.draftUsd,
      saldoInicialBs: row.draftBs,
      saldo_inicial_bs: row.draftBs,
      fechaSaldoInicial: resolvedFechaIso,
      fecha_saldo_inicial: resolvedFechaIso,
      usuarioSaldoInicial: activeActorName,
      usuario_saldo_inicial: activeActorName
    };

    return mergeOpeningBalanceFields(basePayload, row.desk, {
      nowIso: resolvedFechaIso,
      actorName: activeActorName,
      markAsOpening: true
    });
  };

  const handleSaveRow = async (row) => {
    if (!onUpdateCashDesk) return;
    if (isOpeningBalanceLockedForDesk(row.desk || row.code)) {
      notify.warning(`La edición del saldo inicial está bloqueada para ${row.code}.`);
      return;
    }
    try {
      setSavingRowId(row.key);
      const payload = buildPayloadForRow(row);
      await onUpdateCashDesk(payload);
      setDrafts((prev) => ({
        ...prev,
        [row.key]: {
          ...prev[row.key],
          dirty: false
        }
      }));
      notify.success(
        syncCurrentToExpected
          ? `${row.code}: Saldo Inicial (${formatUsd(row.draftUsd)}) fijado y Saldo Actual cuadrado a ${formatUsd(row.liveExpectedUsd)}.`
          : `${row.code}: Saldo Inicial fijado en ${formatUsd(row.draftUsd)} / ${formatBs(row.draftBs)}.`
      );
    } catch (err) {
      notify.error(`Error guardando ${row.code}: ${err?.message || 'Error desconocido'}`);
    } finally {
      setSavingRowId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!onUpdateCashDesk) return;
    const targetRows = liveRows.filter(
      (r) => !isOpeningBalanceLockedForDesk(r.desk || r.code) && (r.draft.dirty || !r.hasOpeningBalance)
    );
    if (targetRows.length === 0) {
      notify.info('No hay cambios pendientes por guardar.');
      return;
    }
    try {
      setSavingAll(true);
      for (const row of targetRows) {
        const payload = buildPayloadForRow(row);
        await onUpdateCashDesk(payload);
      }
      setDrafts((prev) => {
        const next = { ...prev };
        targetRows.forEach((r) => {
          if (next[r.key]) next[r.key] = { ...next[r.key], dirty: false };
        });
        return next;
      });
      notify.success(
        syncCurrentToExpected
          ? `Se fijaron ${targetRows.length} cajas y sus Saldos Actuales quedaron cuadrados con (Inicial + Movimientos).`
          : `Se guardaron los Saldos Iniciales de ${targetRows.length} cajas exitosamente.`
      );
    } catch (err) {
      notify.error(`Error al guardar los saldos iniciales: ${err?.message || 'Error desconocido'}`);
    } finally {
      setSavingAll(false);
    }
  };

  const handleLoadServerBackups = async () => {
    setBackupsLoading(true);
    setBackupsError('');
    try {
      const data = await fetchTreasuryOpeningBalancesHistory();
      setBackupsData(data);
    } catch (err) {
      setBackupsError(err?.message || 'No se pudo consultar el historial de respaldos del servidor.');
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleLoadBackupSnapshotIntoDraft = (code, snap) => {
    const row = liveRows.find((r) => r.code === String(code || '').toUpperCase());
    if (!row) return;
    updateRowDraft(row.key, {
      usd: String(round2(snap.saldoUsd)),
      bs: String(round2(snap.saldoBs)),
      fechaVet: isoToVetDatetimeLocal(snap.fechaActualizacion || new Date().toISOString())
    });
    notify.info(`Respaldo cargado en el borrador de ${row.code}. Pulsa Guardar en la fila o "Guardar Todos".`);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10020,
        background: 'rgba(6, 9, 19, 0.76)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1320px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '18px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.42)',
          overflow: 'hidden'
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid var(--border-glass)',
            background: 'var(--bg-table-header)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-tech)',
                fontSize: '1.02rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem'
              }}
            >
              <Scale size={19} color="var(--brand-blue)" />
              <span>TABLA ESTRUCTURADA DE SALDOS INICIALES Y EVOLUCIÓN — CAJAS ACTIVAS</span>
            </h3>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Hora oficial Venezuela (VET UTC-4) · Edita y fija el Saldo Inicial de cada caja para cuadrar tus números contra los movimientos registrados y el saldo actual.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.65rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            title="Cerrar ventana"
          >
            <X size={17} />
            <span style={{ fontSize: '0.8rem' }}>Cerrar</span>
          </button>
        </div>

        {/* CUERPO CON SCROLL */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* TARJETAS KPI DE CUADRE */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.15rem' }}>
            <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'var(--bg-card-glass)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Saldo Inicial (Borrador)
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--brand-blue)', marginTop: '0.2rem' }}>
                {formatUsd(liveTotals.initUsd)}
              </div>
              <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                {formatBs(liveTotals.initBs)}
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'var(--bg-card-glass)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Neto Movimientos ({liveTotals.movCount} movs.)
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#059669', marginTop: '0.2rem' }}>
                {liveTotals.movNetoUsd >= 0 ? '+' : ''}{formatUsd(liveTotals.movNetoUsd)}
              </div>
              <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                {formatBs(liveTotals.movNetoBs)}
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'var(--bg-card-glass)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Saldo Esperado (Inicial + Movs.)
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {formatUsd(liveTotals.expectedUsd)}
              </div>
              <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                {formatBs(liveTotals.expectedBs)}
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: liveTotals.allBalanced ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${liveTotals.allBalanced ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Saldo Actual BD vs. Diferencia</span>
                {liveTotals.allBalanced ? <CheckCircle2 size={14} color="#10b981" /> : <AlertTriangle size={14} color="#d97706" />}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#10b981', marginTop: '0.2rem' }}>
                {formatUsd(liveTotals.currentUsd)}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-code)',
                  fontWeight: 700,
                  color: liveTotals.allBalanced ? '#059669' : '#d97706'
                }}
              >
                {liveTotals.allBalanced
                  ? '✓ Cuadre Exacto ($0.00)'
                  : `Dif: ${liveTotals.diffUsd > 0 ? '+' : ''}${formatUsd(liveTotals.diffUsd)}`}
              </div>
            </div>
          </div>

          {/* BARRA DE CONTROLES DE CUADRE */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'var(--bg-card-glass)',
              border: '1px solid var(--border-glass)',
              marginBottom: '1rem'
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={syncCurrentToExpected}
                onChange={(e) => setSyncCurrentToExpected(e.target.checked)}
              />
              <span>
                Al guardar, <strong>recalcular también el Saldo Actual = Saldo Inicial + Movimientos</strong>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.35rem' }}>
                  (desmarcado = solo fija el Saldo Inicial sin tocar el Saldo Actual)
                </span>
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleAutoFillAllUnset}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
                title="Calcula y precarga (Saldo Actual − Movimientos) como borrador en todas las cajas"
              >
                <Wand2 size={14} />
                <span>Auto-cuadrar con Base (Actual − Movs.)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextOpen = !showBackupsSection;
                  setShowBackupsSection(nextOpen);
                  if (nextOpen && !backupsData && !backupsLoading) {
                    handleLoadServerBackups();
                  }
                }}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
              >
                <History size={14} />
                <span>{showBackupsSection ? 'Ocultar Respaldos' : 'Ver Respaldos del Servidor'}</span>
              </button>

              <button
                type="button"
                disabled={savingAll}
                onClick={handleSaveAll}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.48rem 1rem',
                  fontSize: '0.8rem',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  border: 'none',
                  color: '#fff'
                }}
              >
                <Save size={15} />
                <span>
                  {savingAll
                    ? 'Guardando...'
                    : `Guardar Todos${liveTotals.dirtyCount > 0 ? ` (${liveTotals.dirtyCount})` : ''}`}
                </span>
              </button>
            </div>
          </div>

          {/* TABLA ESTRUCTURADA EDITABLE */}
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'var(--bg-card-glass)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Caja</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--brand-blue)', textAlign: 'right' }}>Saldo Inicial USD ($)</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--brand-blue)', textAlign: 'right' }}>Saldo Inicial Bs.</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--brand-blue)' }}>Fecha y Hora Apertura (VET)</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Neto Movs. (`cash_movements`)</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Esperado (Inicial + Movs.)</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: '#10b981', textAlign: 'right' }}>Saldo Actual BD</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Diferencia / Cuadre</th>
                  <th style={{ padding: '0.75rem 0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row, idx) => {
                  const isRowSaving = savingRowId === row.key;
                  const isLocked = isOpeningBalanceLockedForDesk(row.desk || row.code);
                  return (
                    <tr
                      key={row.key}
                      style={{
                        borderBottom: '1px solid var(--border-glass)',
                        background: row.draft.dirty
                          ? 'rgba(2, 132, 199, 0.06)'
                          : (idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)')
                      }}
                    >
                      <td style={{ padding: '0.7rem', minWidth: '170px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontFamily: 'var(--font-code)', fontWeight: 800, color: 'var(--brand-blue)' }}>{row.code}</span>
                          <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '5px', background: 'rgba(2, 132, 199, 0.14)', color: 'var(--brand-blue)', fontWeight: 700 }}>
                            {row.moneda}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem' }}>{row.descripcion}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {row.hasOpeningBalance
                            ? `Fijado por: ${row.usuarioSaldoInicial || 'Sistema'}`
                            : 'Sin saldo inicial fijado'}
                        </div>
                      </td>

                      {/* SALDO INICIAL USD */}
                      <td style={{ padding: '0.7rem', textAlign: 'right', minWidth: '125px' }}>
                        <input
                          type="number"
                          step="0.01"
                          disabled={isLocked}
                          className="input-modern"
                          value={row.draft.usd}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = parseFloat(raw);
                            const autoBs = (!Number.isNaN(num) && tasaBcv > 0 && row.isBsDesk)
                              ? String(round2(num * tasaBcv))
                              : row.draft.bs;
                            updateRowDraft(row.key, { usd: raw, bs: autoBs });
                          }}
                          style={{
                            width: '112px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-code)',
                            fontWeight: 700,
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.82rem'
                          }}
                          aria-label={`Saldo inicial USD de ${row.code}`}
                        />
                      </td>

                      {/* SALDO INICIAL BS */}
                      <td style={{ padding: '0.7rem', textAlign: 'right', minWidth: '140px' }}>
                        <input
                          type="number"
                          step="0.01"
                          disabled={isLocked}
                          className="input-modern"
                          value={row.draft.bs}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const num = parseFloat(raw);
                            const autoUsd = (!Number.isNaN(num) && tasaBcv > 0 && row.isBsDesk)
                              ? String(round2(num / tasaBcv))
                              : row.draft.usd;
                            updateRowDraft(row.key, { bs: raw, usd: autoUsd });
                          }}
                          style={{
                            width: '130px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-code)',
                            fontWeight: 700,
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.82rem'
                          }}
                          aria-label={`Saldo inicial Bs de ${row.code}`}
                        />
                      </td>

                      {/* FECHA Y HORA APERTURA VET */}
                      <td style={{ padding: '0.7rem', minWidth: '190px' }}>
                        <input
                          type="datetime-local"
                          disabled={isLocked}
                          className="input-modern"
                          value={row.draft.fechaVet}
                          onChange={(e) => updateRowDraft(row.key, { fechaVet: e.target.value })}
                          style={{
                            width: '100%',
                            fontFamily: 'var(--font-code)',
                            fontSize: '0.75rem',
                            padding: '0.32rem 0.45rem'
                          }}
                          aria-label={`Fecha apertura VET de ${row.code}`}
                        />
                        {row.fechaSaldoInicial && (
                          <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={11} />
                            <span>Guardada: {formatTreasuryTimestampVe(row.fechaSaldoInicial)}</span>
                          </div>
                        )}
                      </td>

                      {/* NETO MOVIMIENTOS */}
                      <td style={{ padding: '0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                        <div style={{ fontWeight: 700, color: row.movNetoUsd >= 0 ? '#059669' : '#dc2626' }}>
                          {row.movNetoUsd >= 0 ? '+' : ''}{formatUsd(row.movNetoUsd)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {formatBs(row.movNetoBs)}
                        </div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontFamily: 'var(--font-main)' }}>
                          {row.movCount} mov(s).
                        </div>
                      </td>

                      {/* ESPERADO */}
                      <td style={{ padding: '0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatUsd(row.liveExpectedUsd)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {formatBs(row.liveExpectedBs)}
                        </div>
                      </td>

                      {/* ACTUAL EN BD */}
                      <td style={{ padding: '0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                        <div style={{ fontWeight: 800, color: '#10b981' }}>
                          {formatUsd(row.currentUsd)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {formatBs(row.currentBs)}
                        </div>
                        {row.fechaActualizacion && (
                          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-main)' }}>
                            {formatTreasuryTimestampVe(row.fechaActualizacion)}
                          </div>
                        )}
                      </td>

                      {/* DIFERENCIA / CUADRE */}
                      <td style={{ padding: '0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)', minWidth: '140px' }}>
                        {row.liveIsBalanced ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '20px',
                              background: 'rgba(16, 185, 129, 0.14)',
                              color: '#059669',
                              fontWeight: 700,
                              fontSize: '0.72rem'
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>Cuadrado</span>
                          </span>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 800, color: '#d97706' }}>
                              {row.liveDiffUsd > 0 ? '+' : ''}{formatUsd(row.liveDiffUsd)}
                            </div>
                            {!isLocked && (
                            <button
                              type="button"
                              onClick={() => handleApplyImpliedBaseToRow(row)}
                              style={{
                                marginTop: '0.25rem',
                                padding: '0.16rem 0.45rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                background: 'rgba(2, 132, 199, 0.14)',
                                color: 'var(--brand-blue)',
                                border: '1px solid rgba(2, 132, 199, 0.3)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-main)'
                              }}
                              title={`Colocar Base sugerida (${formatUsd(row.impliedBaseUsd)} / ${formatBs(row.impliedBaseBs)}) en el borrador`}
                            >
                              Usar base ({formatUsd(row.impliedBaseUsd)})
                            </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* ACCIÓN GUARDAR */}
                      <td style={{ padding: '0.7rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isLocked ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              borderRadius: '7px',
                              background: 'rgba(148, 163, 184, 0.16)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-glass)'
                            }}
                            title="Edición de saldo inicial bloqueada para evitar desfases"
                          >
                            Bloqueado
                          </span>
                        ) : (
                        <button
                          type="button"
                          disabled={isRowSaving || savingAll}
                          onClick={() => handleSaveRow(row)}
                          className="btn"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '7px',
                            background: row.draft.dirty
                              ? 'linear-gradient(135deg, #059669, #10b981)'
                              : 'rgba(16, 185, 129, 0.14)',
                            color: row.draft.dirty ? '#ffffff' : '#059669',
                            border: '1px solid rgba(16, 185, 129, 0.35)'
                          }}
                          title="Guardar y fijar el Saldo Inicial de esta caja"
                        >
                          <Save size={13} />
                          <span>{isRowSaving ? '...' : 'Fijar'}</span>
                        </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-table-header)', borderTop: '2px solid var(--border-glass)', fontWeight: 800 }}>
                  <td style={{ padding: '0.8rem 0.7rem', color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '0.76rem' }}>
                    TOTAL ({liveRows.length} Cajas Activas)
                  </td>
                  <td style={{ padding: '0.8rem 0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--brand-blue)' }}>
                    {formatUsd(liveTotals.initUsd)}
                  </td>
                  <td style={{ padding: '0.8rem 0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--brand-blue)' }}>
                    {formatBs(liveTotals.initBs)}
                  </td>
                  <td style={{ padding: '0.8rem 0.7rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    VET (UTC-4)
                  </td>
                  <td style={{ padding: '0.8rem 0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#059669' }}>
                    <div>{liveTotals.movNetoUsd >= 0 ? '+' : ''}{formatUsd(liveTotals.movNetoUsd)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatBs(liveTotals.movNetoBs)}</div>
                  </td>
                  <td style={{ padding: '0.8rem 0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}>
                    <div>{formatUsd(liveTotals.expectedUsd)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatBs(liveTotals.expectedBs)}</div>
                  </td>
                  <td style={{ padding: '0.8rem 0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: '#10b981' }}>
                    <div>{formatUsd(liveTotals.currentUsd)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatBs(liveTotals.currentBs)}</div>
                  </td>
                  <td style={{ padding: '0.8rem 0.7rem', textAlign: 'right', fontFamily: 'var(--font-code)', color: liveTotals.allBalanced ? '#059669' : '#d97706' }}>
                    {liveTotals.allBalanced ? '✓ $0.00' : `${liveTotals.diffUsd > 0 ? '+' : ''}${formatUsd(liveTotals.diffUsd)}`}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* SECCIÓN OPCIONAL DE RESPALDOS DEL SERVIDOR */}
          {showBackupsSection && (
            <div
              style={{
                marginTop: '1.2rem',
                padding: '1rem',
                borderRadius: '12px',
                background: 'var(--bg-card-glass)',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <History size={15} color="var(--brand-blue)" />
                    <span>Respaldos Históricos del Servidor (SVR-MOTORVEN)</span>
                  </strong>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Carga cualquier foto diaria del servidor en el borrador de la tabla superior para fijarla como Saldo Inicial oficial.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={backupsLoading}
                  onClick={handleLoadServerBackups}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.75rem', fontSize: '0.76rem' }}
                >
                  <RefreshCw size={13} className={backupsLoading ? 'animate-spin' : ''} />
                  <span>{backupsLoading ? 'Consultando...' : 'Actualizar Respaldos'}</span>
                </button>
              </div>

              {backupsError && (
                <div
                  style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem'
                  }}
                >
                  <strong>Aviso:</strong> {backupsError}. Reinicia el servidor <code>SVR-MOTORVEN</code> tras desplegar para consultar sus respaldos en vivo desde aquí.
                </div>
              )}

              {backupsData && (
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                    Respaldos escaneados: <strong>{backupsData.backupsScanned ?? 0}</strong> · Carpeta: <code>{backupsData.backupDir || 'backups/'}</code>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '0.7rem' }}>
                    {(backupsData.cashDesks || []).filter((c) => c.activeInCurrent).map((item) => (
                      <div
                        key={item.code}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '9px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-glass)'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                          <span style={{ fontFamily: 'var(--font-code)', color: 'var(--brand-blue)', marginRight: '0.35rem' }}>{item.code}</span>
                          {item.descripcion}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '130px', overflowY: 'auto' }}>
                          {(item.timeline || []).map((snap, idx) => (
                            <div
                              key={`${item.code}-${idx}`}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.3rem 0.45rem',
                                borderRadius: '6px',
                                background: 'var(--bg-card-glass)',
                                border: '1px solid var(--border-glass)',
                                fontSize: '0.72rem'
                              }}
                            >
                              <div>
                                <div style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {formatUsd(snap.saldoUsd)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({formatBs(snap.saldoBs)})</span>
                                </div>
                                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                  {formatTreasuryTimestampVe(snap.fechaActualizacion)} · {snap.source}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleLoadBackupSnapshotIntoDraft(item.code, snap)}
                                className="btn btn-secondary"
                                style={{ padding: '0.18rem 0.45rem', fontSize: '0.68rem', whiteSpace: 'nowrap' }}
                              >
                                Cargar en fila
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
