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
import { saveCommissionSettlement } from '../services/storageService';
import { generateSellersPDF } from '../services/pdfReportService';
import SellerAvatar from './SellerAvatar';

export default function SellerCommissionModal({
  seller,
  onClose,
  invoices = [],
  collections = [],
  config = {},
  currentUser = null,
  tasaBcv = 827.73,
  initialMonth = 'ALL',
  onSettlementSaved
}) {
  const [selectedMes, setSelectedMes] = useState(initialMonth || 'ALL');
  const [comisionVentaPct, setComisionVentaPct] = useState(Number(seller?.comisionPct) || 3.0);
  const [comisionCobroPct, setComisionCobroPct] = useState(1.5);
  const [bonoPorLitroUsd, setBonoPorLitroUsd] = useState(0.02); // $0.02 por litro sobre meta
  const [metodoPago, setMetodoPago] = useState('TRANSFERENCIA');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().substring(0, 10));
  const [notas, setNotas] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [savedSettlementId, setSavedSettlementId] = useState(null);

  if (!seller) return null;

  const sellerCoVen = (seller?.coVen || seller?.co_ven || seller?.codigo || seller?.id || '').toString().trim();
  const sellerVenDes = (seller?.venDes || seller?.ven_des || seller?.nombre || '').toString().trim();

  const matchesSeller = (fieldVal) => {
    if (!fieldVal) return false;
    const str = fieldVal.toString().trim().toLowerCase();
    const targetCo = sellerCoVen.toLowerCase();
    const targetDes = sellerVenDes.toLowerCase();
    if (targetCo && (str === targetCo || str.startsWith(targetCo) || str.includes(targetCo))) return true;
    if (targetDes && (str.includes(targetDes) || targetDes.includes(str))) return true;
    return false;
  };

  // Filtrado por Asesor
  const sellerInvoicesAll = (invoices || []).filter(f => matchesSeller(f?.vendedorId || f?.co_ven || f?.vendedor));
  const sellerCollectionsAll = (collections || []).filter(c => matchesSeller(c?.vendedorId || c?.co_ven || c?.vendedor));

  // Filtrado por Mes/Período
  const sellerInvoices = sellerInvoicesAll.filter(f => {
    if (selectedMes === 'ALL') return true;
    const raw = f?.fechaEmision || f?.fec_emis || '';
    if (!raw) return true;
    const d = new Date(raw);
    const m = !isNaN(d.getTime()) ? String(d.getMonth() + 1).padStart(2, '0') : '';
    return m === selectedMes;
  });

  const sellerCollections = sellerCollectionsAll.filter(c => {
    if (selectedMes === 'ALL') return true;
    const raw = c?.fecha || c?.fec_cob || '';
    if (!raw) return true;
    const d = new Date(raw);
    const m = !isNaN(d.getTime()) ? String(d.getMonth() + 1).padStart(2, '0') : '';
    return m === selectedMes;
  });

  const totalLitros = round2(sellerInvoices.reduce((acc, f) => acc + (Number(f?.totalLitros) || 0), 0));
  const totalFacturadoUsd = round2(sellerInvoices.reduce((acc, f) => acc + (Number(f?.totNetoUsd) || 0), 0));
  const totalCobradoUsd = round2(sellerCollections.reduce((acc, c) => acc + (Number(c?.montoUsd) || 0), 0));

  const metaLitros = Number(seller?.metaLitrosMes) || 3000;
  const metaEfectiva = selectedMes === 'ALL' ? metaLitros * 10 : metaLitros;
  const litrosExcedentes = Math.max(0, round2(totalLitros - metaEfectiva));

  // Cálculos de Comisiones
  const comisionVentaMontoUsd = round2(totalFacturadoUsd * (comisionVentaPct / 100));
  const comisionCobroMontoUsd = round2(totalCobradoUsd * (comisionCobroPct / 100));
  const bonoVolumenMontoUsd = round2(litrosExcedentes * bonoPorLitroUsd);

  const totalComisionUsd = round2(comisionVentaMontoUsd + comisionCobroMontoUsd + bonoVolumenMontoUsd);
  const totalComisionBs = round2(totalComisionUsd * tasaBcv);

  const getMesLabel = (id) => {
    const map = {
      'ALL': 'Cierre Anual 2026 (Acumulado)',
      '01': 'Enero 2026', '02': 'Febrero 2026', '03': 'Marzo 2026',
      '04': 'Abril 2026', '05': 'Mayo 2026', '06': 'Junio 2026',
      '07': 'Julio 2026', '08': 'Agosto 2026', '09': 'Septiembre 2026',
      '10': 'Octubre 2026', '11': 'Noviembre 2026', '12': 'Diciembre 2026'
    };
    return map[id] || id;
  };

  const handleSaveSettlement = () => {
    const settlementData = {
      coVen: sellerCoVen,
      venDes: sellerVenDes,
      cedula: seller?.cedula || '',
      periodo: getMesLabel(selectedMes),
      periodoId: selectedMes,
      totalLitros,
      metaLitros: metaEfectiva,
      totalFacturadoUsd,
      comisionVentaPct,
      comisionVentaMontoUsd,
      totalCobradoUsd,
      comisionCobroPct,
      comisionCobroMontoUsd,
      litrosExcedentes,
      bonoPorLitroUsd,
      bonoVolumenMontoUsd,
      totalComisionUsd,
      totalComisionBs,
      tasaBcv,
      metodoPago,
      referenciaPago: referenciaPago || 'S/R',
      fechaPago,
      notas,
      estado: 'PAGADA'
    };

    const saved = saveCommissionSettlement(settlementData);
    setIsSaved(true);
    setSavedSettlementId(saved.id);
    if (onSettlementSaved) onSettlementSaved(saved);
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
                Liquidación de Comisiones: {seller.venDes}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cód: {sellerCoVen} | Período: <strong>{getMesLabel(selectedMes)}</strong>
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
                <option value="ALL">Cierre Anual 2026 (Acumulado)</option>
                <option value="01">Enero 2026</option>
                <option value="02">Febrero 2026</option>
                <option value="03">Marzo 2026</option>
                <option value="04">Abril 2026</option>
                <option value="05">Mayo 2026</option>
                <option value="06">Junio 2026</option>
                <option value="07">Julio 2026</option>
                <option value="08">Agosto 2026</option>
                <option value="09">Septiembre 2026</option>
                <option value="10">Octubre 2026</option>
                <option value="11">Noviembre 2026</option>
                <option value="12">Diciembre 2026</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                % Comisión Venta Directa
              </label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={comisionVentaPct}
                onChange={(e) => setComisionVentaPct(parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                % Comisión Cobranza
              </label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={comisionCobroPct}
                onChange={(e) => setComisionCobroPct(parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Bono por Litro Excedente ($/L)
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={bonoPorLitroUsd}
                onChange={(e) => setBonoPorLitroUsd(parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* CUADRO DESGLOSADO DE LIQUIDACIÓN */}
          <div className="table-container" style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="custom-table" style={{ fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>CONCEPTO DE COMISIÓN</th>
                  <th style={{ textAlign: 'right' }}>BASE DE CÁLCULO</th>
                  <th style={{ textAlign: 'center' }}>% / TARIFA</th>
                  <th style={{ textAlign: 'right' }}>MONTO ($ USD)</th>
                  <th style={{ textAlign: 'right' }}>MONTO (BS.)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Comisión por Ventas Facturadas</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sellerInvoices.length} facturas emitidas en el período</div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>{formatUsd(totalFacturadoUsd)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{comisionVentaPct}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                    {formatUsd(comisionVentaMontoUsd)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                    {formatBs(comisionVentaMontoUsd * tasaBcv)}
                  </td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Comisión por Cobranza Efectiva</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sellerCollections.length} recibos de cobro aplicados</div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>{formatUsd(totalCobradoUsd)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{comisionCobroPct}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                    {formatUsd(comisionCobroMontoUsd)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                    {formatBs(comisionCobroMontoUsd * tasaBcv)}
                  </td>
                </tr>

                <tr>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Bono por Cumplimiento de Litros</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {litrosExcedentes > 0 ? `${formatUnitVe(litrosExcedentes)} L sobre meta de ${formatUnitVe(metaEfectiva, 0)} L` : `Meta de ${formatUnitVe(metaEfectiva, 0)} L no superada`}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>{formatUnitVe(litrosExcedentes)} L</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{formatUsd(bonoPorLitroUsd)} / L</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                    {formatUsd(bonoVolumenMontoUsd)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                    {formatBs(bonoVolumenMontoUsd * tasaBcv)}
                  </td>
                </tr>
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
              disabled={isSaved}
              style={{
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isSaved ? 'var(--semaforo-verde)' : undefined
              }}
            >
              <Save size={15} /> {isSaved ? 'Liquidación Guardada' : 'Registrar y Liquidar Comisión'}
            </button>
            <button
              className="btn btn-print-report"
              onClick={() => generateSellersPDF({ sellers: [seller], config, currentUser })}
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
