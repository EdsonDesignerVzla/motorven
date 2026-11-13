import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Users,
  Edit,
  Check,
  Navigation,
  Compass
} from 'lucide-react';
import { formatUsd, formatBs, formatUnitVe } from '../services/formatService';
import { generateSellersPDF } from '../services/pdfReportService';
import SellerAvatar from './SellerAvatar';
import {
  matchesSeller,
  isDocAnulada,
  resolveInvoiceLitros,
  resolveInvoiceCajas,
  normalizeProfitCollectionUsd,
  calculateSellerCommissionSummary
} from '../services/commissionService';

export default function SellerDetailModal({
  seller,
  onClose,
  invoices = [],
  clients = [],
  orders = [],
  collections = [],
  profitZones = [],
  tasaBcv = 827.73,
  onOpenCommissionModal,
  onPhotoUpdated,
  onUpdateSellerZone
}) {
  const sellerCoVen = (seller?.coVen || seller?.co_ven || seller?.codigo || seller?.id || '').toString().trim();
  const sellerVenDes = (seller?.venDes || seller?.ven_des || seller?.nombre || '').toString().trim();

  // Zone management state
  const initialCoZon = seller?.coZon || seller?.co_zon || '';
  const initialZona = seller?.zona || ((profitZones || []).find(z => (z.coZon || z.co_zon) === initialCoZon)?.zonDes || '');
  const [currentCoZon, setCurrentCoZon] = useState(initialCoZon);
  const [currentZona, setCurrentZona] = useState(initialZona);
  const [isEditingZone, setIsEditingZone] = useState(false);
  const [selectedZoneVal, setSelectedZoneVal] = useState(initialCoZon || (initialZona ? 'CUSTOM' : ''));
  const [customZoneText, setCustomZoneText] = useState(initialZona || '');
  const [savingZone, setSavingZone] = useState(false);
  const [zoneSaveSuccess, setZoneSaveSuccess] = useState(false);

  if (!seller) return null;

  const validInvoices = (invoices || []).filter(f => !isDocAnulada(f));
  const validCollections = (collections || [])
    .filter(c => !c?.anulado)
    .map(c => ({ ...c, montoUsd: normalizeProfitCollectionUsd(c) }));

  const sellerInvoices = validInvoices.filter(f => matchesSeller(seller, f));
  const sellerClients = (clients || []).filter(c => matchesSeller(seller, c?.vendedorAsignado || c?.co_ven || c?.vendedor || c));
  const sellerOrders = (orders || []).filter(o => matchesSeller(seller, o));
  const sellerCollections = validCollections.filter(c => matchesSeller(seller, c));

  // Metrics
  const totalLitros = sellerInvoices.reduce((acc, f) => acc + resolveInvoiceLitros(f), 0);
  const totalCajas = sellerInvoices.reduce((acc, f) => acc + resolveInvoiceCajas(f), 0);
  const totalVentasUsd = sellerInvoices.reduce((acc, f) => acc + (Number(f?.totNetoUsd) || 0), 0);
  const totalVentasBs = sellerInvoices.reduce((acc, f) => acc + (Number(f?.totNetoBs) || 0), 0);
  const totalSaldoPendienteUsd = sellerInvoices.reduce((acc, f) => acc + (Number(f?.saldoUsd) || 0), 0);
  const totalCobradoUsd = sellerCollections.reduce((acc, c) => acc + normalizeProfitCollectionUsd(c), 0);
  const commissionSummary = calculateSellerCommissionSummary(seller, {
    invoices: sellerInvoices,
    collections: validCollections,
    tasaBcv
  });

  const metaLitros = Number(seller?.metaLitrosMes) || 3000;
  const cumplimientoPct = metaLitros > 0 ? parseFloat(((totalLitros / metaLitros) * 100).toFixed(1)) : 0;

  const handleSaveZone = async () => {
    let newCoZon = currentCoZon;
    let newZona = currentZona;

    if (selectedZoneVal === 'CUSTOM') {
      newCoZon = 'CUSTOM';
      newZona = customZoneText.trim() || 'Zona Especial';
    } else if (selectedZoneVal) {
      newCoZon = selectedZoneVal;
      const matched = (profitZones || []).find(z => (z.coZon || z.co_zon) === selectedZoneVal);
      newZona = matched?.zonDes || matched?.zon_des || selectedZoneVal;
    }

    setSavingZone(true);
    try {
      if (onUpdateSellerZone) {
        await onUpdateSellerZone(sellerCoVen, { coZon: newCoZon, zona: newZona });
      }
      setCurrentCoZon(newCoZon);
      setCurrentZona(newZona);
      setZoneSaveSuccess(true);
      setIsEditingZone(false);
      setTimeout(() => setZoneSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Error saving zone:', err);
    } finally {
      setSavingZone(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '860px',
          width: '95%',
          maxHeight: '90vh',
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
            background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.08) 0%, rgba(202, 138, 4, 0.06) 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <SellerAvatar
              seller={seller}
              size={52}
              canEdit={true}
              onPhotoUpdated={onPhotoUpdated}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {seller.venDes}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  Cód: {seller.coVen}
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                  {formatUsd(commissionSummary.totalComisionUsd)} Comisión MOTORVEN
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cobrador Oficial - Fuerza de Ventas Grupo Motorven C.A.
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
          
          {/* Métricas KPI del Vendedor */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem'
            }}
          >
            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Volumen Despachado
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)', marginTop: '2px' }}>
                {formatUnitVe(totalLitros)} L
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                ≈ {formatUnitVe(totalCajas)} Cajas Eq.
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Meta Comercial ({formatUnitVe(metaLitros, 0)} L)
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: cumplimientoPct >= 100 ? 'var(--semaforo-verde)' : 'var(--motorven-gold)', fontFamily: 'var(--font-tech)', marginTop: '2px' }}>
                {cumplimientoPct}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-glass)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, cumplimientoPct)}%`,
                    height: '100%',
                    background: cumplimientoPct >= 100 ? 'var(--semaforo-verde)' : 'var(--motorven-navy)'
                  }}
                />
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Ventas Facturadas
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)', marginTop: '2px' }}>
                {formatUsd(totalVentasUsd)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)' }}>
                {formatBs(totalVentasBs)}
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-input, rgba(0, 43, 122, 0.03))',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Cobranza Efectiva
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)', marginTop: '2px' }}>
                {formatUsd(totalCobradoUsd)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Saldo CxC: <strong style={{ color: 'var(--motorven-red)' }}>{formatUsd(totalSaldoPendienteUsd)}</strong>
              </div>
            </div>
          </div>

          {/* Datos Personales y Contacto */}
          <div
            style={{
              background: 'var(--surface-input, rgba(0, 43, 122, 0.02))',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <User size={16} color="var(--motorven-navy)" />
              <span>Cédula: <strong>{seller.cedula || 'N/A'}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <Phone size={16} color="var(--semaforo-verde)" />
              <span>Teléfono: <strong>{seller.telefonos || 'N/A'}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <MapPin size={16} color="var(--motorven-red)" />
              <span>Dirección: <strong>{seller.direccion || 'Oficina Comercial'}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <Users size={16} color="var(--motorven-gold)" />
              <span>Clientes Asignados: <strong>{sellerClients.length}</strong></span>
            </div>
          </div>

          {/* Zona Comercial y Territorio Asignado */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.05) 0%, rgba(202, 138, 4, 0.04) 100%)',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Navigation size={18} color="var(--motorven-navy-light)" />
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Zona Comercial / Territorio de Ventas Asignado
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.8rem', padding: '3px 10px', fontWeight: 800 }}>
                      {currentCoZon ? `Zona ${currentCoZon}` : 'Territorio'}
                    </span>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {currentZona || 'Sin Zona Asignada'}
                    </strong>
                  </div>
                </div>
              </div>

              {!isEditingZone ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsEditingZone(true)}
                  style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px' }}
                >
                  <Edit size={13} /> Reasignar / Editar Zona
                </button>
              ) : null}
            </div>

            {/* Panel de Edición de Zona */}
            {isEditingZone && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '1rem',
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  border: '1px dashed var(--motorven-navy)'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Seleccione la nueva zona para el asesor {sellerVenDes}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  <select
                    className="form-control"
                    value={selectedZoneVal}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedZoneVal(val);
                      if (val !== 'CUSTOM') {
                        const matched = (profitZones || []).find(z => (z.coZon || z.co_zon) === val);
                        if (matched) setCustomZoneText(matched.zonDes || matched.zon_des || '');
                      }
                    }}
                    style={{ flex: 1, minWidth: '240px', fontSize: '0.82rem' }}
                  >
                    <option value="">-- Seleccionar Zona Corporativa --</option>
                    {(profitZones || []).map(z => {
                      const cZon = z.coZon || z.co_zon;
                      const dZon = z.zonDes || z.zon_des || `Zona ${cZon}`;
                      return (
                        <option key={cZon} value={cZon}>
                          Zona {cZon}: {dZon}
                        </option>
                      );
                    })}
                    <option value="CUSTOM">★ Zona Personalizada / Otro Territorio...</option>
                  </select>

                  {selectedZoneVal === 'CUSTOM' && (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nombre de la zona o territorio..."
                      value={customZoneText}
                      onChange={(e) => setCustomZoneText(e.target.value)}
                      style={{ flex: 1, minWidth: '220px', fontSize: '0.82rem' }}
                    />
                  )}

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveZone}
                      disabled={savingZone}
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px' }}
                    >
                      <Check size={14} /> {savingZone ? 'Guardando...' : 'Guardar Zona'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setIsEditingZone(false);
                        setSelectedZoneVal(currentCoZon || (currentZona ? 'CUSTOM' : ''));
                      }}
                      style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {zoneSaveSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--semaforo-verde)', fontWeight: 700 }}>
                <CheckCircle2 size={15} /> ¡Zona actualizada con éxito y sincronizada con Supabase!
              </div>
            )}
          </div>

          {/* Facturas Emitidas por el Vendedor */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} color="var(--motorven-navy)" />
              Facturas de Venta Recientes de este Asesor ({sellerInvoices.length})
            </div>

            <div className="table-container" style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', overflow: 'hidden' }}>
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>NRO. FACTURA</th>
                    <th>CLIENTE</th>
                    <th>FECHA EMISIÓN</th>
                    <th style={{ textAlign: 'right' }}>LITROS</th>
                    <th style={{ textAlign: 'right' }}>TOTAL ($ USD)</th>
                    <th style={{ textAlign: 'right' }}>SALDO ($ USD)</th>
                    <th style={{ textAlign: 'center' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerInvoices.length > 0 ? (
                    sellerInvoices.slice(0, 15).map((f, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-navy-light)' }}>
                          #{f.factNum}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{f.clienteNombre}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RIF: {f.clienteRif || f.clienteId}</div>
                        </td>
                        <td>{f.fechaEmision ? new Date(f.fechaEmision).toLocaleDateString('es-VE') : '-'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontWeight: 700 }}>
                          {resolveInvoiceLitros(f) > 0 ? `${formatUnitVe(resolveInvoiceLitros(f))} L` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>
                          {formatUsd(f.totNetoUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: f.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                          {formatUsd(f.saldoUsd)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${f.status === 'COBRADA' ? 'badge-success' : f.status === 'ANULADA' ? 'badge-danger' : 'badge-warning'}`}
                            style={{ fontSize: '0.65rem' }}
                          >
                            {f.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No hay facturas sincronizadas para este vendedor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
            justifyContent: 'flex-end',
            gap: '10px',
            alignItems: 'center'
          }}
        >
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
            Cerrar Perfil
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              onClose();
              if (onOpenCommissionModal) onOpenCommissionModal(seller);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <DollarSign size={15} /> Liquidar Comisiones
          </button>
          <button
            className="btn btn-print-report"
            onClick={() => {
              generateSellersPDF({
                sellers: [{
                  ...seller,
                  totalVentasUsd,
                  totalLitros,
                  totalCajas,
                  totalCobradoUsd,
                  totalSaldoUsd: totalSaldoPendienteUsd,
                  basePagadaSinIvaUsd: commissionSummary.basePagadaSinIvaUsd,
                  comisionEstimadaUsd: commissionSummary.totalComisionUsd,
                  comisionEstimadaBs: commissionSummary.totalComisionBs,
                  comisionTiers: commissionSummary.tiers,
                  metaLitrosMes: metaLitros
                }],
                config: { tasaDolar: tasaBcv },
                currentUser: null
              });
            }}
            style={{ fontSize: '0.82rem' }}
            title="Descargar reporte oficial del cobrador en PDF"
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>

      </div>
    </div>
  );
}
