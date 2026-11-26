import React, { useState } from 'react';
import {
  X,
  Award,
  DollarSign,
  Percent,
  Calendar,
  CheckCircle2,
  Printer,
  ShieldCheck,
  TrendingUp,
  FileText,
  Save,
  CreditCard,
  Building
} from 'lucide-react';
import { formatUsd, formatBs, formatUnitVe, round2 } from '../services/formatService';
import { saveSupabaseCommissionSettlement } from '../services/supabaseService';
import { generateSellersPDF } from '../services/pdfReportService';
import SellerAvatar from './SellerAvatar';
import {
  matchesSeller,
  isDocAnulada,
  resolveInvoiceLitros,
  resolveInvoiceCajas,
  normalizeProfitCollectionUsd,
  calculateSellerCommissionSummary,
  countDistinctActiveMonths,
  MOTORVEN_TIER_ORDER,
  MOTORVEN_COMMISSION_TIERS
} from '../services/commissionService';

function extractPeriodMonth(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return iso[2].padStart(2, '0');
  const d = new Date(str);
  return !isNaN(d.getTime()) ? String(d.getUTCMonth() + 1).padStart(2, '0') : '';
}

export default function SellerCommissionModal({
  seller,
  onClose,
  invoices = [],
  collections = [],
  config = {},
  currentUser = null,
  tasaBcv = 827.73,
  initialMonth = 'ALL',
  onSettlementSaved,
  onAddCashMovement
}) {
  const [selectedMes, setSelectedMes] = useState(initialMonth || 'ALL');
  const [bonoAdicionalUsd, setBonoAdicionalUsd] = useState(0);
  const [metodoPago, setMetodoPago] = useState('TRANSFERENCIA');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().substring(0, 10));
  const [notas, setNotas] = useState('');
  const [registrarEgresoCaja, setRegistrarEgresoCaja] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedSettlementId, setSavedSettlementId] = useState(null);

  if (!seller) return null;

  const sellerCoVen = (seller?.coVen || seller?.co_ven || seller?.codigo || seller?.id || '').toString().trim();
  const sellerVenDes = (seller?.venDes || seller?.ven_des || seller?.nombre || '').toString().trim();

  const validInvoicesAll = (invoices || []).filter(f => !isDocAnulada(f));
  const validCollectionsAll = (collections || [])
    .filter(c => !c?.anulado)
    .map(c => ({ ...c, montoUsd: normalizeProfitCollectionUsd(c) }));

  // Filtrado estricto por Cobrador
  const sellerInvoicesAll = validInvoicesAll.filter(f => matchesSeller(seller, f));
  const sellerCollectionsAll = validCollectionsAll.filter(c => matchesSeller(seller, c));

  // Filtrado por Mes/Período
  const sellerInvoices = sellerInvoicesAll.filter(f => {
    if (selectedMes === 'ALL') return true;
    const raw = f?.fechaEmision || f?.fec_emis || f?.fecha || '';
    if (!raw) return true;
    return extractPeriodMonth(raw) === selectedMes;
  });

  const sellerCollections = sellerCollectionsAll.filter(c => {
    if (selectedMes === 'ALL') return true;
    const raw = c?.fecha || c?.fec_cob || '';
    if (!raw) return true;
    return extractPeriodMonth(raw) === selectedMes;
  });

  const totalLitros = round2(sellerInvoices.reduce((acc, f) => acc + resolveInvoiceLitros(f), 0));
  const totalCajas = round2(sellerInvoices.reduce((acc, f) => acc + resolveInvoiceCajas(f), 0));
  const totalFacturadoUsd = round2(sellerInvoices.reduce((acc, f) => acc + (Number(f?.totNetoUsd) || 0), 0));
  const totalCobradoUsd = round2(sellerCollections.reduce((acc, c) => acc + normalizeProfitCollectionUsd(c), 0));

  const activeMonths = countDistinctActiveMonths(validInvoicesAll, validCollectionsAll);
  const metaLitros = Number(seller?.metaLitrosMes) || 3000;
  const metaEfectiva = selectedMes === 'ALL' ? metaLitros * Math.max(1, activeMonths) : metaLitros;

  // Regla Oficial MOTORVEN: 0-7d (4%), 8-14d (3%), 15-21d (1%), >21d (0%), Base Sin IVA, Solo 100% Pagados
  const commissionSummary = calculateSellerCommissionSummary(seller, {
    invoices: sellerInvoices,
    collections: validCollectionsAll,
    tasaBcv
  });

  const basePagadaSinIvaUsd = round2(commissionSummary.basePagadaSinIvaUsd);
  const comisionDevengadaUsd = round2(commissionSummary.totalComisionUsd);
  const bonoExtra = round2(Number(bonoAdicionalUsd) || 0);
  const totalComisionUsd = round2(comisionDevengadaUsd + bonoExtra);
  const totalComisionBs = round2(totalComisionUsd * tasaBcv);

  const currentYear = new Date().getFullYear();
  const getMesLabel = (id) => {
    const map = {
      'ALL': currentYear <= 2026 ? `Acumulado ${currentYear} (Desde 01/11)` : `Cierre Anual ${currentYear} (Acumulado)`,
      '01': `Enero ${currentYear}`, '02': `Febrero ${currentYear}`, '03': `Marzo ${currentYear}`,
      '04': `Abril ${currentYear}`, '05': `Mayo ${currentYear}`, '06': `Junio ${currentYear}`,
      '07': `Julio ${currentYear}`, '08': `Agosto ${currentYear}`, '09': `Septiembre ${currentYear}`,
      '10': `Octubre ${currentYear}`, '11': `Noviembre ${currentYear}`, '12': `Diciembre ${currentYear}`
    };
    return map[id] || id;
  };

  const enrichedSellerForPdf = {
    ...seller,
    totalLitros,
    totalCajas,
    totalVentasUsd: totalFacturadoUsd,
    totalCobradoUsd,
    totalSaldoUsd: round2(sellerInvoices.reduce((acc, f) => acc + (Number(f?.saldoUsd) || 0), 0)),
    basePagadaSinIvaUsd,
    comisionEstimadaUsd: totalComisionUsd,
    comisionEstimadaBs: totalComisionBs,
    comisionTiers: commissionSummary.tiers,
    metaLitrosMes: metaEfectiva
  };

  const handleSaveSettlement = async () => {
    setSaving(true);
    try {
      const settlementData = {
        coVen: sellerCoVen,
        venDes: sellerVenDes,
        cedula: seller?.cedula || '',
        periodo: getMesLabel(selectedMes),
        periodoId: selectedMes,
        totalLitros,
        metaLitros: metaEfectiva,
        totalFacturadoUsd,
        basePagadaSinIvaUsd,
        documentosPagadosCount: commissionSummary.paidDocsCount,
        documentosPendientesExcluidosCount: commissionSummary.pendingDocsCount,
        motorvenTiers: commissionSummary.tiers,
        bonoAdicionalUsd: bonoExtra,
        totalCobradoUsd,
        totalComisionUsd,
        totalComisionBs,
        tasaBcv,
        metodoPago,
        referenciaPago: referenciaPago || 'S/R',
        fechaPago,
        notas,
        seller: enrichedSellerForPdf,
        estado: 'PAGADA'
      };

      const saved = await saveSupabaseCommissionSettlement(settlementData);
      if (registrarEgresoCaja && onAddCashMovement && totalComisionUsd > 0 && saved?.id) {
        await onAddCashMovement({
          fecha: new Date(`${fechaPago}T12:00:00`).toISOString(),
          tipo: 'EGRESO',
          categoria: 'COMISIONES',
          concepto: `[Comisión Cobrador] ${sellerVenDes} (${getMesLabel(selectedMes)})`,
          montoUsd: totalComisionUsd,
          montoBs: totalComisionBs,
          tasa: tasaBcv,
          tasaPago: tasaBcv,
          tipoTasa: 'BCV',
          metodo: metodoPago,
          referencia: saved.id,
          referenciaTipo: 'COMMISSION_SETTLEMENT',
          referenciaId: saved.id,
          usuario: currentUser?.username || currentUser?.nombre || 'Sistema'
        });
      }
      setIsSaved(true);
      setSavedSettlementId(saved?.id || settlementData.id);
      if (onSettlementSaved) onSettlementSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-glass, rgba(0, 43, 122, 0.15))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(0, 43, 122, 0.06) 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <SellerAvatar seller={seller} size={46} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Liquidación de Comisiones (Cobrador): {seller.venDes}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cód. Cobrador: {sellerCoVen} | Período: <strong>{getMesLabel(selectedMes)}</strong> | Regla MOTORVEN (Sin IVA)
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* CUERPO */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* BANNER DE CONFIRMACIÓN SI YA FUE GUARDADA */}
          {isSaved && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid var(--semaforo-verde)',
                borderRadius: '10px',
                padding: '0.85rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="var(--semaforo-verde)" />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--semaforo-verde)' }}>
                  ¡Liquidación registrada con éxito! Comprobante N° {savedSettlementId}
                </span>
              </div>
              <span className="badge badge-success">ESTADO: PAGADA</span>
            </div>
          )}

          {/* PARÁMETROS Y PERÍODO */}
          <div
            style={{
              background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '1rem'
            }}
          >
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Período a Liquidar
              </label>
              <select
                className="form-control"
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                style={{ fontSize: '0.85rem', fontWeight: 700 }}
              >
                <option value="ALL">
                  {currentYear <= 2026 ? `Acumulado ${currentYear} (Desde 01/11)` : `Cierre Anual ${currentYear} (Acumulado)`}
                </option>
                {currentYear > 2026 && (
                  <>
                    <option value="01">Enero {currentYear}</option>
                    <option value="02">Febrero {currentYear}</option>
                    <option value="03">Marzo {currentYear}</option>
                    <option value="04">Abril {currentYear}</option>
                    <option value="05">Mayo {currentYear}</option>
                    <option value="06">Junio {currentYear}</option>
                    <option value="07">Julio {currentYear}</option>
                    <option value="08">Agosto {currentYear}</option>
                    <option value="09">Septiembre {currentYear}</option>
                    <option value="10">Octubre {currentYear}</option>
                  </>
                )}
                <option value="11">Noviembre {currentYear}</option>
                <option value="12">Diciembre {currentYear}</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Documentos 100% Pagados (Base Sin IVA)
              </label>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)', paddingTop: '6px' }}>
                {commissionSummary.paidDocsCount} docs ({formatUsd(basePagadaSinIvaUsd)})
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Pendientes Excluidos (Sin Devengo)
              </label>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--motorven-gold)', fontFamily: 'var(--font-tech)', paddingTop: '6px' }}>
                {commissionSummary.pendingDocsCount} docs con saldo &gt; $0.01
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Bono Adicional Gerencia ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={bonoAdicionalUsd}
                onChange={(e) => setBonoAdicionalUsd(parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* CUADRO DESGLOSADO DE LIQUIDACIÓN MOTORVEN POR DÍAS VENCIDOS */}
          <div className="table-container" style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="custom-table" style={{ fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>TRAMO DÍAS VENCIDOS (MOTORVEN • SIN IVA)</th>
                  <th style={{ textAlign: 'right' }}>BASE PAGADA ($)</th>
                  <th style={{ textAlign: 'center' }}>% TARIFA</th>
                  <th style={{ textAlign: 'right' }}>COMISIÓN ($ USD)</th>
                  <th style={{ textAlign: 'right' }}>COMISIÓN (BS.)</th>
                </tr>
              </thead>
              <tbody>
                {MOTORVEN_TIER_ORDER.map((tierKey) => {
                  const meta = MOTORVEN_COMMISSION_TIERS[tierKey];
                  const t = commissionSummary.tiers?.[tierKey] || { docsCount: 0, baseSinIvaUsd: 0, comisionUsd: 0 };
                  const docsCnt = Number(t.docsCount ?? t.count ?? 0);
                  return (
                    <tr key={tierKey}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{meta.label}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {docsCnt} documento(s) totalmente pagado(s)
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>{formatUsd(t.baseSinIvaUsd)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>{meta.ratePct}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                        {formatUsd(t.comisionUsd)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                        {formatBs(t.comisionUsd * tasaBcv)}
                      </td>
                    </tr>
                  );
                })}
                {bonoExtra > 0 && (
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Bono Adicional de Gerencia</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ajuste especial aprobado</div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>{formatUsd(bonoExtra)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>Fijo</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                      {formatUsd(bonoExtra)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                      {formatBs(bonoExtra * tasaBcv)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* GRAN TOTAL A PAGAR */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(0, 43, 122, 0.05) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '14px',
              padding: '1.15rem 1.35rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Comisión Neta Liquidada
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Tasa BCV Oficial: <strong>{formatBs(tasaBcv)}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)' }}>
                {formatUsd(totalComisionUsd)}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)' }}>
                {formatBs(totalComisionBs)}
              </div>
            </div>
          </div>

          {/* DETALLES DE PAGO Y DESEMBOLSO */}
          <div
            style={{
              background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}
          >
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Método de Pago
              </label>
              <select
                className="form-control"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                <option value="EFECTIVO_USD">Efectivo ($ USD)</option>
                <option value="PAGO_MOVIL">Pago Móvil</option>
                <option value="CHEQUE">Cheque de Gerencia</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                N° de Referencia / Banco
              </label>
              <input
                type="text"
                placeholder="Ej. Banesco #948271"
                className="form-control"
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Fecha de Liquidación
              </label>
              <input
                type="date"
                className="form-control"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Observaciones / Notas
              </label>
              <input
                type="text"
                placeholder="Notas opcionales de gerencia..."
                className="form-control"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              {onAddCashMovement && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.55rem', fontSize: '0.78rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={registrarEgresoCaja}
                    onChange={(e) => setRegistrarEgresoCaja(e.target.checked)}
                  />
                  Registrar desembolso automático en Caja / Flujo de Efectivo (Egreso P&amp;L Comisiones)
                </label>
              )}
            </div>
          </div>

        </div>

        {/* PIE DEL MODAL */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--surface-input, rgba(0, 43, 122, 0.04))',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
            <button
              className="btn btn-secondary"
              onClick={onClose}
              style={{ fontSize: '0.82rem' }}
            >
              Cerrar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveSettlement}
              disabled={isSaved || saving}
              style={{
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isSaved ? 'var(--semaforo-verde)' : undefined
              }}
            >
              <Save size={15} /> {saving ? 'Guardando...' : (isSaved ? 'Liquidación Guardada' : 'Registrar y Liquidar Comisión')}
            </button>
            <button
              className="btn btn-print-report"
              onClick={() => generateSellersPDF({ sellers: [enrichedSellerForPdf], config, currentUser })}
              style={{ fontSize: '0.82rem' }}
            >
              <Printer size={15} color="#ffffff" /> Imprimir Reporte
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
