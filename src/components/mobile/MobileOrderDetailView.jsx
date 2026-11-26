import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Droplets,
  FileText,
  MapPin,
  MessageCircle,
  Package,
  Receipt,
  Scale,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { formatBs, formatUnitVe, formatUsd } from '../../services/formatService';
import {
  canUserGrantCreditOverride,
  evaluateClientCreditPortfolioSummary,
  formatDateVe
} from '../../services/creditPolicyService';
import {
  canApproveClients,
  canManageInvoices,
  isMasterOrGerencia
} from '../../services/authService';
import { generateSellerOrderPDF } from '../../services/pdfReportService';
import { useNotification } from '../../context/NotificationContext';
import {
  computeOrderMetrics,
  findClientForOrder,
  getOrderNumber,
  normalizeOrderStatus,
  resolveDailyRate,
  resolveOrderExpirationStatus
} from './mobileOrderHelpers';

export default function MobileOrderDetailView({
  order,
  clients = [],
  profitInvoices = [],
  sales = [],
  config,
  currentUser,
  onBack,
  onUpdateOrderStatus,
  onProceedToPOS,
  onDeleteOrder
}) {
  const notify = useNotification();
  const [busyAction, setBusyAction] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dailyRate = resolveDailyRate(config);

  const client = useMemo(
    () => findClientForOrder(order, clients),
    [order, clients]
  );

  const metrics = useMemo(
    () => computeOrderMetrics(order, dailyRate),
    [order, dailyRate]
  );

  const statusInfo = useMemo(() => normalizeOrderStatus(order), [order]);
  const expirationInfo = useMemo(
    () => resolveOrderExpirationStatus(order, { profitInvoices, sales }),
    [order, profitInvoices, sales]
  );
  const orderNumber = useMemo(() => getOrderNumber(order), [order]);

  const portfolio = useMemo(() => {
    if (!client) return null;
    try {
      return evaluateClientCreditPortfolioSummary({
        client,
        profitInvoices,
        sales,
        tasaBcv: metrics.tasa,
        montoOrdenUsd: metrics.totalUsd
      });
    } catch {
      return null;
    }
  }, [client, profitInvoices, sales, metrics.tasa, metrics.totalUsd]);

  if (!order) return null;

  const clientName = order.clienteNombre || order.cliente || client?.nombre || 'Cliente General';
  const clientRif = order.clienteRif || client?.rif || 'J-00000000-0';
  const clientAddress = order.direccionEntrega || client?.direccion || 'Venezuela';
  const sellerName = order.vendedorNombre || order.vendedor || order.creadoPor || 'Asesor Comercial';
  const rawDate = order.fechaEmision || order.fechaCreacion || order.created_at;
  const rawDueDate = order.fechaVencimiento || order.fechaEntrega;

  const creditLimitUsd = Number(portfolio?.evalPolicy?.limiteCreditoUsd ?? client?.limiteCredito ?? 0);
  const currentDebtUsd = Number(portfolio?.evalPolicy?.saldoDeudorUsd ?? client?.saldoDeudorUsd ?? 0);
  const projectedExposureUsd = currentDebtUsd + (statusInfo.isBilled || statusInfo.isCancelled ? 0 : metrics.totalUsd);
  const usagePct = creditLimitUsd > 0 ? Math.min(100, Math.round((projectedExposureUsd / creditLimitUsd) * 100)) : 0;
  const usageColor = usagePct >= 95 ? 'var(--mob-red)' : usagePct >= 75 ? 'var(--mob-amber)' : 'var(--mob-green)';

  const canApprove =
    Boolean(onUpdateOrderStatus) &&
    (statusInfo.isRetained
      ? canUserGrantCreditOverride(currentUser, { mobile: true })
      : (canApproveClients(currentUser) || canUserGrantCreditOverride(currentUser, { mobile: true }) || canManageInvoices(currentUser))) &&
    (statusInfo.isRetained || statusInfo.code === 'PENDIENTE' || statusInfo.code === 'PENDIENTE_APROBACION');

  const canBill =
    Boolean(onProceedToPOS) &&
    canManageInvoices(currentUser) &&
    !statusInfo.isBilled &&
    !statusInfo.isCancelled;

  const canDelete =
    Boolean(onDeleteOrder) &&
    !statusInfo.isBilled &&
    (isMasterOrGerencia(currentUser) || !statusInfo.isApproved);

  const handleDownloadPdf = () => {
    try {
      generateSellerOrderPDF({
        order: {
          ...order,
          tasaCambio: metrics.tasa,
          tasaBcv: metrics.tasa,
          totalBs: metrics.totalBs
        },
        config,
        currentUser,
        client
      });
    } catch (err) {
      console.error('Error generando PDF del pedido:', err);
      notify.error('No se pudo generar el PDF de la preventa.');
    }
  };

  const handleShareWhatsapp = () => {
    const cleanPhone = String(client?.telefono || client?.telefonos || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `58${cleanPhone.slice(1)}` : cleanPhone;
    const msg = [
      `*SIGNUM MOTORVEN • ${metrics.isNe ? 'PREVENTA N/E' : 'PEDIDO FISCAL'} ${orderNumber}*`,
      `Cliente: ${clientName} (${clientRif})`,
      `Condición: ${metrics.plazoLabel} • ${metrics.warehouseLabel}`,
      `Bultos: ${metrics.totalUnits} • Litros: ${formatUnitVe(metrics.totalLitros)} L`,
      `Total Neto: *${formatUsd(metrics.totalUsd)}* (${formatBs(metrics.totalBs)})`,
      `Estado: ${statusInfo.label}`
    ].join('\n');
    const url = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleApprove = async () => {
    if (!onUpdateOrderStatus || busyAction) return;
    setBusyAction('approve');
    try {
      await onUpdateOrderStatus(order.id, 'APROBADO');
    } catch {
      // Notificado desde App.jsx
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteOrder || busyAction) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusyAction('delete');
    try {
      await onDeleteOrder(order.id);
      onBack?.();
    } catch {
      setConfirmDelete(false);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', paddingBottom: '0.5rem' }}>
      {/* Barra superior de retorno + acciones rápidas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button
          type="button"
          onClick={onBack}
          className="mobile-chip"
          style={{ padding: '7px 12px', fontSize: '0.76rem', color: 'var(--mob-navy)' }}
        >
          <ArrowLeft size={14} /> Volver a Pedidos
        </button>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="mobile-chip"
            style={{ padding: '6px 10px', background: 'var(--mob-navy-soft)', color: 'var(--mob-navy)' }}
          >
            <FileText size={13} /> PDF
          </button>
          <button
            type="button"
            onClick={handleShareWhatsapp}
            className="mobile-chip"
            style={{ padding: '6px 10px', background: 'var(--mob-green-soft)', color: 'var(--mob-green)' }}
          >
            <MessageCircle size={13} /> WhatsApp
          </button>
        </div>
      </div>

      {/* Cabecera del Pedido / Cliente */}
      <div className="mobile-card" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'var(--font-tech)',
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  color: 'var(--mob-navy)'
                }}
              >
                {orderNumber}
              </span>
              <span className={`mobile-pill-badge ${metrics.isNe ? 'warning' : 'info'}`}>
                {metrics.isNe ? 'NE • Alm 02' : 'FAC • Alm 01'}
              </span>
            </div>
            <div style={{ fontSize: '0.90rem', fontWeight: 800, color: 'var(--mob-text)', marginTop: '4px' }}>
              {clientName}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
              {clientRif} • Asesor: {sellerName}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {(expirationInfo.state === 'VENCIDO' || expirationInfo.state === 'POR_VENCER') && (
              <span className={`mobile-pill-badge ${expirationInfo.tone}`}>{expirationInfo.label}</span>
            )}
            <span className={`mobile-pill-badge ${statusInfo.tone}`}>{statusInfo.label}</span>
          </div>
        </div>

        <div
          style={{
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid var(--mob-border)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            fontSize: '0.72rem',
            color: 'var(--mob-text-muted)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} color="var(--mob-cyan)" />
            <span>Emisión: {rawDate ? formatDateVe(rawDate) : 'Hoy'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
            <span>Vigencia 72h • {rawDueDate ? formatDateVe(rawDueDate) : metrics.plazoLabel}</span>
          </div>
        </div>
      </div>

      {/* Auditoría Crediticia y Cupo del Cliente */}
      {client && (
        <div className="mobile-card" style={{ padding: '11px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span className="mobile-telemetry-label">Exposición & Cupo Crediticio</span>
            {portfolio && (
              <span className={`mobile-pill-badge ${portfolio.badgeTone === 'neutral' ? 'info' : (portfolio.badgeTone || 'info')}`}>
                {portfolio.estadoLabel}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '6px',
              marginTop: '8px'
            }}
          >
            <div style={{ background: 'var(--mob-surface-low)', borderRadius: '10px', padding: '7px 8px' }}>
              <div style={{ fontSize: '0.60rem', color: 'var(--mob-text-muted)', fontWeight: 700 }}>LÍMITE</div>
              <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800 }}>
                {formatUsd(creditLimitUsd)}
              </div>
            </div>
            <div style={{ background: 'var(--mob-surface-low)', borderRadius: '10px', padding: '7px 8px' }}>
              <div style={{ fontSize: '0.60rem', color: 'var(--mob-text-muted)', fontWeight: 700 }}>SALDO CXC</div>
              <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: currentDebtUsd > 0 ? 'var(--mob-amber)' : 'var(--mob-text)' }}>
                {formatUsd(currentDebtUsd)}
              </div>
            </div>
            <div style={{ background: 'var(--mob-surface-low)', borderRadius: '10px', padding: '7px 8px' }}>
              <div style={{ fontSize: '0.60rem', color: 'var(--mob-text-muted)', fontWeight: 700 }}>DISPONIBLE</div>
              <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-green)' }}>
                {formatUsd(portfolio?.evalPolicy?.creditoDisponibleUsd ?? Math.max(0, creditLimitUsd - currentDebtUsd))}
              </div>
            </div>
          </div>

          {creditLimitUsd > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--mob-text-muted)', marginBottom: '3px' }}>
                <span>Uso proyectado con este pedido</span>
                <span style={{ fontFamily: 'var(--font-code)', fontWeight: 800, color: usageColor }}>{usagePct}%</span>
              </div>
              <div style={{ height: '6px', borderRadius: '9999px', background: 'var(--mob-surface-high)', overflow: 'hidden' }}>
                <div style={{ width: `${usagePct}%`, height: '100%', background: usageColor, transition: 'width 0.25s ease' }} />
              </div>
            </div>
          )}

          {order.creditOverrideApproved && (
            <div
              style={{
                marginTop: '8px',
                padding: '6px 9px',
                borderRadius: '9px',
                background: 'var(--mob-amber-soft)',
                color: 'var(--mob-amber)',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ShieldAlert size={14} />
              <span>
                Excepción autorizada por {order.creditOverrideAuthorizer || 'Gerencia'}
                {order.creditOverrideJustification ? `: ${order.creditOverrideJustification}` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Métricas Logísticas: Bultos, Litraje y Peso */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
        <div className="mobile-telemetry-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Package size={15} color="var(--mob-navy)" />
          <div className="mobile-telemetry-value" style={{ fontSize: '0.92rem' }}>{metrics.totalUnits}</div>
          <div className="mobile-telemetry-label">Unid / Bultos</div>
        </div>
        <div className="mobile-telemetry-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Droplets size={15} color="var(--mob-cyan)" />
          <div className="mobile-telemetry-value" style={{ fontSize: '0.92rem' }}>{formatUnitVe(metrics.totalLitros)} L</div>
          <div className="mobile-telemetry-label">Litraje Total</div>
        </div>
        <div className="mobile-telemetry-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Scale size={15} color="var(--mob-green)" />
          <div className="mobile-telemetry-value" style={{ fontSize: '0.92rem' }}>{formatUnitVe(metrics.estimatedWeightKg)} kg</div>
          <div className="mobile-telemetry-label">Peso Est.</div>
        </div>
      </div>

      {/* Renglones de Productos */}
      <div className="mobile-card" style={{ padding: '11px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span className="mobile-telemetry-label">Detalle de Renglones ({metrics.items.length})</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', fontWeight: 700 }}>
            {metrics.warehouseLabel}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {metrics.items.map((it) => (
            <div
              key={it.id}
              style={{
                padding: '9px 10px',
                borderRadius: '11px',
                background: 'var(--mob-surface-low)',
                border: '1px solid var(--mob-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-text)', lineHeight: 1.25 }}>
                  {it.rengNum}. {it.descripcion}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', marginTop: '3px' }}>
                  {it.sku ? `SKU ${it.sku} • ` : ''}
                  {it.cantidad} {it.unidad} × {formatUsd(it.precioUnitarioUsd)} • {formatUnitVe(it.litrosTotales)} L
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.82rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                  {formatUsd(it.subtotalUsd)}
                </div>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.66rem', color: 'var(--mob-text-muted)' }}>
                  {formatBs(it.subtotalBs)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logística y Observaciones */}
      <div className="mobile-card" style={{ padding: '11px 12px', fontSize: '0.74rem' }}>
        <div className="mobile-telemetry-label" style={{ marginBottom: '6px' }}>Logística & Condiciones</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: 'var(--mob-text-secondary)' }}>
          <MapPin size={14} color="var(--mob-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{clientAddress}</span>
        </div>
        {order.observaciones && (
          <div
            style={{
              marginTop: '7px',
              padding: '7px 9px',
              borderRadius: '9px',
              background: 'var(--mob-surface-low)',
              color: 'var(--mob-text-muted)',
              fontSize: '0.72rem'
            }}
          >
            {order.observaciones}
          </div>
        )}
      </div>

      {/* Resumen Financiero Bimonetario + Botones Operativos */}
      <div className="mobile-sticky-footer-bar">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--mob-text-muted)' }}>
          <span>Base / Subtotal</span>
          <span style={{ fontFamily: 'var(--font-code)', fontWeight: 700 }}>
            {formatUsd(metrics.subtotalUsd)} ({formatBs(metrics.subtotalBs)})
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
          <span>{metrics.isNe ? 'IVA (Nota de Entrega Exenta)' : 'IVA Fiscal (16%)'}</span>
          <span style={{ fontFamily: 'var(--font-code)', fontWeight: 700 }}>
            {formatUsd(metrics.ivaUsd)} ({formatBs(metrics.ivaBs)})
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid var(--mob-border)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--mob-text-muted)' }}>
              TOTAL OPERATIVO (BCV DÍA {formatBs(metrics.tasa)})
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.08rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
              {formatUsd(metrics.totalUsd)}
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.84rem', fontWeight: 800, color: 'var(--mob-text-secondary)' }}>
            {formatBs(metrics.totalBs)}
          </div>
        </div>

        {(canApprove || canBill || canDelete) && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {canApprove && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleApprove}
                className="mobile-quick-action-btn success"
                style={{ flex: 1, minWidth: '130px' }}
              >
                <CheckCircle2 size={15} />
                {busyAction === 'approve' ? 'Aprobando...' : 'Aprobar Pedido'}
              </button>
            )}

            {canBill && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => onProceedToPOS(order)}
                className="mobile-quick-action-btn primary"
                style={{ flex: 1, minWidth: '150px' }}
              >
                <Receipt size={15} /> Facturar / Pasar a Caja
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleDelete}
                className="mobile-chip"
                style={{
                  padding: '9px 12px',
                  borderRadius: '12px',
                  background: confirmDelete ? 'var(--mob-red)' : 'var(--mob-red-soft)',
                  color: confirmDelete ? '#ffffff' : 'var(--mob-red)',
                  borderColor: 'var(--mob-red)'
                }}
              >
                {confirmDelete ? <Check size={14} /> : <Trash2 size={14} />}
                {busyAction === 'delete' ? 'Anulando...' : confirmDelete ? 'Confirmar' : 'Anular'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
