import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Truck,
  ShoppingCart,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  FileText,
  DollarSign,
  Search,
  Filter,
  User,
  MapPin,
  Building2,
  Calendar,
  Send,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Lock,
  CreditCard,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import MotorvenLogo from './MotorvenLogo';
import OilstoneProductImage from './OilstoneProductImage';
import { isMasterOrGerencia } from '../services/authService';
import { CREDIT_APPROVERS_CATALOG } from './AppConfigModal';
import { generateOrdersPDF, generateSellerOrderPDF } from '../services/pdfReportService';
import { REAL_PROFIT_SELLERS, REAL_PROFIT_ZONES } from '../data/supabaseRealData';

const STATUS_CONFIG = {
  PENDIENTE: {
    label: '1. Nota de Pedido (Vendedor)',
    shortLabel: 'Nota Pedido',
    color: 'var(--motorven-gold, #f59e0b)',
    badgeClass: 'badge-warning',
    icon: Clock
  },
  APROBADO: {
    label: '2. En Caja (Por Facturar)',
    shortLabel: 'En Caja',
    color: 'var(--motorven-navy-light, #2563eb)',
    badgeClass: 'badge-primary',
    icon: ShoppingCart
  },
  FACTURADO: {
    label: '3. Facturado (O.E. Generada)',
    shortLabel: 'Facturado',
    color: 'var(--semaforo-verde, #10b981)',
    badgeClass: 'badge-success',
    icon: CheckCircle2
  },
  EN_TRANSITO: {
    label: '4. En Tránsito / Despacho',
    shortLabel: 'En Ruta',
    color: '#8b5cf6',
    badgeClass: 'badge-info',
    icon: Truck
  },
  RETENIDO_CREDITO: {
    label: 'Retenido por Crédito',
    shortLabel: 'Retenido',
    color: 'var(--motorven-red, #dc2626)',
    badgeClass: 'badge-danger',
    icon: AlertTriangle
  },
  ANULADO: {
    label: 'Anulado',
    shortLabel: 'Anulado',
    color: 'var(--text-muted, #64748b)',
    badgeClass: 'badge-neutral',
    icon: X
  }
};

const formatCondicionPago = (cond) => {
  if (!cond || cond === 'CONTADO') return 'Contado / Pago Inmediato';
  if (cond === '7_DIAS') return 'Crédito 7 Días';
  if (cond === '15_DIAS') return 'Crédito 15 Días';
  if (cond === '21_DIAS') return 'Crédito 21 Días';
  if (cond === '30_DIAS') return 'Crédito 30 Días';
  if (cond === 'CREDITO') return 'Crédito Comercial';
  return cond;
};

// Evalúa si una preventa no facturada ya superó el corte de las 5:00 PM
export function isOrderReservationExpired(order) {
  if (!order) return false;
  const st = (order.status || '').toUpperCase();
  if (st !== 'PENDIENTE' && st !== 'APROBADO' && st !== 'RETENIDO_CREDITO') return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayLocal = `${year}-${month}-${day}`;
  const todayIso = now.toISOString().slice(0, 10);

  let orderDate = '';
  if (order.fechaEmision) {
    orderDate = String(order.fechaEmision).slice(0, 10);
  } else if (order.fecha) {
    orderDate = String(order.fecha).slice(0, 10);
  } else if (order.created_at) {
    orderDate = String(order.created_at).slice(0, 10);
  }

  if (orderDate && orderDate !== todayLocal && orderDate !== todayIso) {
    return true;
  }
  return now.getHours() >= 17;
}

export default function OrdersSalesModal({
  isOpen,
  onClose,
  orders = [],
  clients = [],
  products = [],
  config = {},
  profitZones = [],
  profitTransports = [],
  profitSellers = [],
  profitInvoices = [],
  sales = [],
  onSaveOrder,
  onUpdateOrderStatus,
  onProcessSale,
  onSyncProfit,
  currentUser,
  initialTab = 'nuevo',
  initialOrder = null,
  onProceedToPOS
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'nuevo'); // 'nuevo' | 'pipeline' | 'facturar' | 'imprimir' | 'metricas'
  const [selectedOrder, setSelectedOrder] = useState(initialOrder || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  const safeOrders = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const safeClients = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const safeProfitZones = useMemo(() => {
    const rawZones = Array.isArray(profitZones) && profitZones.length > 0 ? profitZones : REAL_PROFIT_ZONES;
    const seen = new Map();
    (rawZones || []).forEach(z => {
      if (!z) return;
      const coZon = String(z.coZon || z.co_zon || '').trim();
      const fallbackZon = (REAL_PROFIT_ZONES || []).find(rz => String(rz.coZon || rz.co_zon || '').trim() === coZon);
      const zonDes = String(z.zonDes || z.zon_des || fallbackZon?.zonDes || fallbackZon?.zon_des || '').trim();
      if (!coZon || seen.has(coZon)) return;
      seen.set(coZon, {
        ...z,
        coZon,
        co_zon: coZon,
        zonDes,
        zon_des: zonDes
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.coZon.localeCompare(b.coZon));
  }, [profitZones]);
  const safeProfitTransports = useMemo(() => (Array.isArray(profitTransports) ? profitTransports : []), [profitTransports]);
  const safeProfitSellers = useMemo(() => {
    const rawSellers = Array.isArray(profitSellers) && profitSellers.length > 0 ? profitSellers : REAL_PROFIT_SELLERS;
    const byName = new Map();
    (rawSellers || []).forEach(s => {
      if (!s) return;
      const rawCode = String(s.coVen || s.co_ven || s.id || '').trim();
      const rawName = String(s.venDes || s.ven_des || s.nombre || '').trim();
      const fallback = (REAL_PROFIT_SELLERS || []).find(
        r =>
          (rawCode && String(r.coVen || r.id || '').trim().toLowerCase() === rawCode.toLowerCase()) ||
          (rawName && String(r.venDes || '').trim().toLowerCase() === rawName.toLowerCase())
      );
      const venDes = rawName || fallback?.venDes || rawCode;
      if (!venDes) return;
      const coVen = rawCode || fallback?.coVen || venDes;
      const coZon = String(s.coZon || s.co_zon || fallback?.coZon || fallback?.co_zon || '').trim();
      const zoneObj = safeProfitZones.find(z => z.coZon === coZon);
      const zona = String(s.zona || zoneObj?.zonDes || fallback?.zona || '').trim();
      const key = venDes.toLowerCase();
      const existing = byName.get(key);
      // Preferir el registro con código corto oficial (ej. FS, VV, YC, CB, CM) sobre USR-SELLER-*
      if (!existing || (coVen.length <= 4 && (existing.coVen?.length || 0) > 4)) {
        byName.set(key, {
          ...fallback,
          ...s,
          coVen,
          co_ven: coVen,
          venDes,
          ven_des: venDes,
          coZon,
          co_zon: coZon,
          zona
        });
      }
    });
    return Array.from(byName.values()).sort((a, b) => a.venDes.localeCompare(b.venDes));
  }, [profitSellers, safeProfitZones]);

  // Formulario Nuevo Pedido
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearchText, setClientSearchText] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('ALL');
  const clientTypes = useMemo(() => {
    const set = new Set();
    safeClients.forEach(c => { if (c && c.tipoCliente) set.add(String(c.tipoCliente).trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [safeClients]);
  const filteredClients = useMemo(() => {
    const q = clientSearchText.trim().toLowerCase();
    return safeClients.filter(c => {
      if (!c) return false;
      const selId = c.id || c.codigo;
      if (selId && selId === selectedClientId) return true;
      if (clientTypeFilter !== 'ALL' && String(c.tipoCliente || '').trim() !== clientTypeFilter) return false;
      if (!q) return true;
      return [c.codigo, c.id, c.nombre, c.razonSocial, c.rif].some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [safeClients, clientSearchText, clientTypeFilter, selectedClientId]);
  const [selectedSeller, setSelectedSeller] = useState(currentUser?.nombre || 'Vendedor Directo');
  const [selectedZone, setSelectedZone] = useState('01');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('CONTADO'); // 'CONTADO' | '7_DIAS' | '15_DIAS' | '21_DIAS' | '30_DIAS'
  const [orderNotes, setOrderNotes] = useState('');
  const [orderRows, setOrderRows] = useState([
    { articuloId: '', cantidad: 1, precioUsd: 0, unidad: 'Caja (12L)', litrosUnitarios: 11.35 }
  ]);

  // Formulario Facturación / Conversión
  const [billingPaymentMethod, setBillingPaymentMethod] = useState('EFECTIVO_USD');

  // Inicializar estado cuando cambia initialTab o initialOrder
  useEffect(() => {
    if (initialOrder) {
      setSelectedOrder(initialOrder);
      setActiveTab(initialTab || 'facturar');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialOrder, initialTab]);

  // Cliente seleccionado en el formulario
  const activeClientObj = useMemo(() => {
    if (!selectedClientId) return null;
    return safeClients.find(
      c => c && (c.id === selectedClientId || c.codigo === selectedClientId || c.rif === selectedClientId)
    );
  }, [selectedClientId, safeClients]);

  // Evaluación de Estatus de Crédito Comercial (APROBADO vs NEGADO)
  // Regla: No tener facturas o notas de entrega vencidas, ni más de 2 facturas pendientes, ni 2 notas de entrega pendientes, ni combinadas (1 factura + 1 nota de entrega)
  const clientCreditEvaluation = useMemo(() => {
    if (!activeClientObj) {
      return {
        evaluado: false,
        isAprobado: false,
        statusLabel: '',
        motivo: 'Seleccione un cliente registrado para evaluar su condición comercial.',
        tieneVencidas: false,
        masDeDosFacturas: false,
        dosOMasNotasEntrega: false,
        dosCombinadas: false,
        facturasPendientesCount: 0,
        notasEntregaPendientesCount: 0,
        vencidasCount: 0
      };
    }

    const cRif = (activeClientObj.rif || '').trim().toUpperCase();
    const cId = String(activeClientObj.id || '').trim();
    const cCod = String(activeClientObj.codigo || '').trim();
    const cNom = String(activeClientObj.nombre || activeClientObj.razonSocial || '').trim().toLowerCase();
    const diasCreditoCliente = Number(activeClientObj.diasCredito || 15);

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
            saldoUsd: Number(s.saldoUsd || (s.estado === 'PENDIENTE' || s.condicionPago === 'CREDITO' ? s.totalUsd : 0)),
            saldoBs: Number(s.saldoBs || (s.estado === 'PENDIENTE' || s.condicionPago === 'CREDITO' ? s.totalBs : 0)),
            status: s.estado || s.status,
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
        if (!isNaN(vDate.getTime())) {
          return (now.getTime() - vDate.getTime()) > (24 * 60 * 60 * 1000);
        }
      }
      if (doc.fechaEmision) {
        const eDate = new Date(doc.fechaEmision);
        if (!isNaN(eDate.getTime())) {
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

    const isNegado = tieneVencidas || masDeDosFacturas || dosOMasNotasEntrega || dosCombinadas;

    let motivo = '';
    if (tieneVencidas) {
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
      facturasPendientes,
      notasEntregaPendientes,
      facturasVencidas,
      notasEntregaVencidas,
      facturasPendientesCount: facturasPendientes.length,
      notasEntregaPendientesCount: notasEntregaPendientes.length,
      vencidasCount: facturasVencidas.length + notasEntregaVencidas.length
    };
  }, [activeClientObj, profitInvoices, sales, tasaBcv]);

  const [showCreditApprovalModal, setShowCreditApprovalModal] = useState(false);
  const [creditOverrideApproved, setCreditOverrideApproved] = useState(false);

  // Lista de personal autorizado para aprobar créditos configurados con [✓]
  const authorizedApproverIds = useMemo(() => {
    if (Array.isArray(config?.aprobadoresCredito) && config.aprobadoresCredito.length > 0) {
      return new Set(config.aprobadoresCredito);
    }
    return new Set([
      'Edson Designer (Administrador Master / Dirección)',
      'Ricardo Sánchez (Gerente General / Dirección)',
      'Luiggy Silva (Administración & Finanzas)',
      'José Martínez (Analista de Cobranzas y Crédito)'
    ]);
  }, [config?.aprobadoresCredito]);

  // Grupos filtrados para el selector de aprobación (solo los que tienen el check activo)
  const approverGroups = useMemo(() => {
    return CREDIT_APPROVERS_CATALOG.map(group => ({
      ...group,
      people: group.people.filter(p => authorizedApproverIds.has(p.id))
    })).filter(group => group.people.length > 0);
  }, [authorizedApproverIds]);

  const [creditOverrideAuthorizer, setCreditOverrideAuthorizer] = useState(
    config?.aprobadorCreditoDefecto || 'Ricardo Sánchez (Gerente General / Dirección)'
  );
  const [creditOverrideJustification, setCreditOverrideJustification] = useState('');

  // Sincronizar autorizador predeterminado desde la configuración o primer autorizado
  useEffect(() => {
    if (config?.aprobadorCreditoDefecto && authorizedApproverIds.has(config.aprobadorCreditoDefecto)) {
      if (!creditOverrideApproved) {
        setCreditOverrideAuthorizer(config.aprobadorCreditoDefecto);
      }
    } else {
      const firstAvailable = approverGroups[0]?.people[0]?.id;
      if (firstAvailable && !authorizedApproverIds.has(creditOverrideAuthorizer)) {
        setCreditOverrideAuthorizer(firstAvailable);
      }
    }
  }, [config?.aprobadorCreditoDefecto, authorizedApproverIds, approverGroups, creditOverrideApproved]);

  // Resetear la autorización excepcional si cambia de cliente
  useEffect(() => {
    setCreditOverrideApproved(false);
    setCreditOverrideJustification('');
  }, [selectedClientId]);

  // REGLA COMERCIAL MOTORVEN: Los créditos a 30 Días SIEMPRE deben solicitar aprobación de Gerencia
  const isTermRequiresMandatoryApproval = paymentTerm === '30_DIAS';

  // Estatus efectivo considerando si fue aprobado por excepción o si requiere aprobación obligatoria
  const effectiveIsAprobado = creditOverrideApproved || (
    Boolean(clientCreditEvaluation.isAprobado) && !isTermRequiresMandatoryApproval
  );

  const getStatusLabelForTerm = (termKey) => {
    if (termKey === 'CONTADO') return '';
    if (creditOverrideApproved && paymentTerm === termKey) return 'APROBADO (AUTORIZADO)';
    if (termKey === '30_DIAS') {
      return (creditOverrideApproved && paymentTerm === '30_DIAS')
        ? 'APROBADO (AUTORIZADO)'
        : 'NEGADO (REQUIERE APROBACIÓN)';
    }
    return clientCreditEvaluation.statusLabel || 'EVALUANDO';
  };

  const effectiveStatusLabel = creditOverrideApproved
    ? 'APROBADO (AUTORIZADO)'
    : (isTermRequiresMandatoryApproval
        ? 'NEGADO (REQUIERE APROBACIÓN)'
        : clientCreditEvaluation.statusLabel);

  const isCreditNegado = Boolean(
    paymentTerm !== 'CONTADO' && (!clientCreditEvaluation?.evaluado || !effectiveIsAprobado)
  );

  const effectiveMotivo = creditOverrideApproved
    ? `Autorización Excepcional Otorgada por: ${creditOverrideAuthorizer}. Justificación: ${creditOverrideJustification || 'Autorizado por Gerencia'}.`
    : (isTermRequiresMandatoryApproval
        ? (clientCreditEvaluation.tieneVencidas || clientCreditEvaluation.masDeDosFacturas || clientCreditEvaluation.dosOMasNotasEntrega || clientCreditEvaluation.dosCombinadas
            ? `${clientCreditEvaluation.motivo} Además, el plazo a 30 Días siempre requiere aprobación obligatoria de Gerencia.`
            : 'Política Comercial Estricta: Todo crédito a 30 Días requiere obligatoriamente solicitar y obtener aprobación de Gerencia.')
        : clientCreditEvaluation.motivo);

  // Condición comercial acordada / actual del cliente en su ficha
  const clientAgreedInfo = useMemo(() => {
    if (!activeClientObj) return { dias: 0, termKey: 'CONTADO', label: 'Sin cliente' };
    const dias = Number(activeClientObj.diasCredito || activeClientObj.dias_credito || 0);
    const condicion = String(activeClientObj.condicionPago || activeClientObj.condicion || '').toUpperCase();

    if (dias >= 30) return { dias: 30, termKey: '30_DIAS', label: 'Crédito 30 Días' };
    if (dias >= 21) return { dias: 21, termKey: '21_DIAS', label: 'Crédito 21 Días' };
    if (dias >= 15) return { dias: 15, termKey: '15_DIAS', label: 'Crédito 15 Días' };
    if (dias >= 7) return { dias: 7, termKey: '7_DIAS', label: 'Crédito 7 Días' };
    if (dias > 0) return { dias, termKey: '7_DIAS', label: `Crédito ${dias} Días` };
    if (condicion.includes('CREDITO') || condicion.includes('CRÉDITO')) {
      return { dias: 15, termKey: '15_DIAS', label: 'Crédito 15 Días' };
    }
    return { dias: 0, termKey: 'CONTADO', label: 'Contado' };
  }, [activeClientObj]);

  // Sincronización bidireccional Vendedor <-> Zona habitual (profit_sellers.co_zon <-> profit_zones.co_zon en BD)
  const [zoneMismatchAlert, setZoneMismatchAlert] = useState(null);
  const [outOfZoneConfirmed, setOutOfZoneConfirmed] = useState(false);

  const sellerValue = (s) => (s && (s.venDes || s.ven_des || s.nombre || s.coVen || s.co_ven)) || '';
  const sellerZoneCode = (s) => String((s && (s.coZon || s.co_zon)) || '').trim();

  const findSellerByValue = (value) => {
    if (!value) return undefined;
    const target = String(value).trim().toLowerCase();
    return safeProfitSellers.find(
      s =>
        sellerValue(s).toLowerCase() === target ||
        String(s.coVen || s.co_ven || '').trim().toLowerCase() === target ||
        String(s.id || '').trim().toLowerCase() === target
    );
  };

  const getZoneFullLabel = (code) => {
    const clean = String(code || '').trim();
    const z = safeProfitZones.find(zz => String(zz.coZon || zz.co_zon).trim() === clean);
    return z ? `${clean} - ${z.zonDes || z.zon_des}` : clean;
  };

  const getSellersForZone = (code) => {
    const clean = String(code || '').trim();
    return safeProfitSellers.filter(s => sellerZoneCode(s) === clean && s.activo !== false);
  };

  const activeSellerObj = useMemo(
    () => findSellerByValue(selectedSeller) || safeProfitSellers[0] || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSeller, safeProfitSellers]
  );

  const activeSellerHabitualZone = sellerZoneCode(activeSellerObj);
  const isSellerOutOfZone = Boolean(
    activeSellerHabitualZone &&
    selectedZone &&
    String(activeSellerHabitualZone).trim() !== String(selectedZone).trim()
  );

  const handleSellerChange = (value) => {
    setSelectedSeller(value);
    setOutOfZoneConfirmed(false);
    const seller = findSellerByValue(value);
    const zone = sellerZoneCode(seller);
    if (zone) {
      setSelectedZone(zone);
    }
  };

  const handleZoneChange = (newZone) => {
    const cleanNewZone = String(newZone || '').trim();
    const seller = findSellerByValue(selectedSeller) || activeSellerObj;
    const sellerZone = sellerZoneCode(seller);

    if (seller && sellerZone && sellerZone !== cleanNewZone) {
      const zoneSellers = getSellersForZone(cleanNewZone);
      setZoneMismatchAlert({
        sellerName: sellerValue(seller),
        sellerCode: seller.coVen || seller.co_ven || '',
        sellerZone,
        sellerZoneLabel: getZoneFullLabel(sellerZone),
        newZone: cleanNewZone,
        newZoneLabel: getZoneFullLabel(cleanNewZone),
        zoneSellers
      });
      return;
    }

    setSelectedZone(cleanNewZone);
    setOutOfZoneConfirmed(false);
    if (!sellerZone) {
      const match = getSellersForZone(cleanNewZone)[0];
      if (match) setSelectedSeller(sellerValue(match));
    }
  };

  // Al cargar vendedores, asegurar que selectedSeller coincida con un vendedor válido y su zona habitual
  useEffect(() => {
    if (safeProfitSellers.length === 0) return;
    let matched = findSellerByValue(selectedSeller);
    if (!matched && currentUser) {
      matched =
        findSellerByValue(currentUser.co_ven || currentUser.coVen) ||
        findSellerByValue(currentUser.nombre) ||
        findSellerByValue(currentUser.id);
    }
    if (!matched) {
      matched = safeProfitSellers.find(s => sellerZoneCode(s) === '01') || safeProfitSellers[0];
    }
    if (matched) {
      const canonicalVal = sellerValue(matched);
      if (canonicalVal && canonicalVal !== selectedSeller) {
        setSelectedSeller(canonicalVal);
      }
      const zone = sellerZoneCode(matched);
      if (zone && !outOfZoneConfirmed) {
        setSelectedZone(zone);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeProfitSellers]);

  // Actualizar dirección, zona, vendedor asignado y plazo comercial automáticamente al elegir cliente
  useEffect(() => {
    if (activeClientObj) {
      setDeliveryAddress(activeClientObj.direccion2 || activeClientObj.direccion || activeClientObj.dir || '');
      const clientZone = String(activeClientObj.zonaVenta || activeClientObj.coZon || activeClientObj.co_zon || '').trim();
      const clientSellerCode = String(activeClientObj.vendedorAsignado || activeClientObj.coVen || activeClientObj.co_ven || '').trim();
      const matchedClientSeller = findSellerByValue(clientSellerCode);

      if (matchedClientSeller) {
        setSelectedSeller(sellerValue(matchedClientSeller));
        const habitualZon = sellerZoneCode(matchedClientSeller);
        setSelectedZone(clientZone || habitualZon || '01');
        setOutOfZoneConfirmed(Boolean(clientZone && habitualZon && clientZone !== habitualZon));
      } else if (clientZone) {
        setSelectedZone(clientZone);
        const zoneAdvisor = getSellersForZone(clientZone)[0];
        if (zoneAdvisor) {
          setSelectedSeller(sellerValue(zoneAdvisor));
          setOutOfZoneConfirmed(false);
        }
      }
      setPaymentTerm(clientAgreedInfo.termKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientObj, clientAgreedInfo]);

  // Cálculo de totales del formulario nuevo pedido
  const newOrderCalculations = useMemo(() => {
    let totalLitros = 0;
    let totalCajas = 0;
    let subtotalUsd = 0;
    let validItemsCount = 0;

    orderRows.forEach(row => {
      if (row.articuloId && row.cantidad > 0) {
        validItemsCount++;
        const prod = safeProducts.find(p => p && (p.id === row.articuloId || p.codigo === row.articuloId));
        const cant = Number(row.cantidad) || 0;
        const litUnit = Number(row.litrosUnitarios || prod?.litros_por_unidad || prod?.litrosPorUnidad || 11.35);
        const price = Number(row.precioUsd || prod?.precio_usd_mayor || prod?.precio_usd_detal || 0);

        totalLitros += cant * litUnit;
        if ((row.unidad || '').toUpperCase().includes('CAJA')) {
          totalCajas += cant;
        }
        subtotalUsd += cant * price;
      }
    });

    const totalBs = subtotalUsd * tasaBcv;

    return {
      totalLitros,
      totalCajas,
      subtotalUsd,
      totalBs,
      validItemsCount
    };
  }, [orderRows, safeProducts, tasaBcv]);

  // Manejo de renglones de pedido
  const handleAddRow = () => {
    setOrderRows(prev => [
      ...prev,
      { articuloId: '', cantidad: 1, precioUsd: 0, unidad: 'Caja (12L)', litrosUnitarios: 11.35 }
    ]);
  };

  const handleRemoveRow = (index) => {
    if (orderRows.length <= 1) return;
    setOrderRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index, field, value) => {
    setOrderRows(prev => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === 'articuloId') {
        const prod = safeProducts.find(p => p && (p.id === value || p.codigo === value));
        if (prod) {
          target.precioUsd = Number(prod.precio_usd_mayor || prod.precio_usd_detal || prod.precioUsdMayor || 0);
          target.unidad = prod.unidad || 'Caja (12L)';
          target.litrosUnitarios = Number(prod.litros_por_unidad || prod.litrosPorUnidad || 11.35);
        }
      }

      updated[index] = target;
      return updated;
    });
  };

  // Guardar / Emitir Nota de Pedido (Vendedor)
  const handleSaveOrderForm = async (targetStatus = 'APROBADO', autoPrintPDF = false) => {
    if (!selectedClientId && !clientSearchText) {
      setFeedbackMsg({ type: 'error', text: 'Debe seleccionar o indicar un cliente destinatario.' });
      return;
    }

    const validRows = orderRows.filter(r => r.articuloId && r.cantidad > 0);
    if (validRows.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Debe agregar al menos un lubricante con cantidad válida.' });
      return;
    }

    const sellerZoneNow = sellerZoneCode(findSellerByValue(selectedSeller));
    if (sellerZoneNow && sellerZoneNow !== String(selectedZone).trim() && !outOfZoneConfirmed) {
      const seller = findSellerByValue(selectedSeller) || activeSellerObj;
      setZoneMismatchAlert({
        sellerName: seller ? sellerValue(seller) : selectedSeller,
        sellerCode: seller?.coVen || seller?.co_ven || '',
        sellerZone: sellerZoneNow,
        sellerZoneLabel: getZoneFullLabel(sellerZoneNow),
        newZone: String(selectedZone).trim(),
        newZoneLabel: getZoneFullLabel(selectedZone),
        zoneSellers: getSellersForZone(selectedZone)
      });
      return;
    }

    try {
      setIsSaving(true);
      const orderId = `OC-${Date.now().toString().slice(-6)}`;
      const clientName = activeClientObj?.nombre || activeClientObj?.razonSocial || clientSearchText || 'Cliente General';
      const clientRif = activeClientObj?.rif || 'J-000000000';

      const itemsFormatted = validRows.map((row, idx) => {
        const prod = safeProducts.find(p => p && (p.id === row.articuloId || p.codigo === row.articuloId));
        const cant = Number(row.cantidad) || 1;
        const litUnit = Number(row.litrosUnitarios || prod?.litros_por_unidad || prod?.litrosPorUnidad || 11.35);
        const price = Number(row.precioUsd || prod?.precio_usd_mayor || 0);

        return {
          id: `${orderId}-${idx + 1}`,
          orderId,
          rengNum: idx + 1,
          articuloId: row.articuloId,
          articuloDescripcion: prod?.descripcion || prod?.nombre || row.articuloId,
          unidadVenta: row.unidad || prod?.unidad || 'Caja (12L)',
          cantidad: cant,
          litrosUnitarios: litUnit,
          litrosTotales: cant * litUnit,
          precioUnitarioUsd: price,
          totalUsd: cant * price
        };
      });

      let finalStatus = targetStatus;
      if (isCreditNegado) {
        if (targetStatus === 'APROBADO') {
          finalStatus = 'RETENIDO_CREDITO';
        }
      }

      const orderPayload = {
        id: orderId,
        numeroDoc: orderId,
        tipoDoc: 'ORDEN_COMPRA',
        fechaEmision: new Date().toISOString(),
        clienteId: activeClientObj?.id || activeClientObj?.codigo || selectedClientId || 'CLI-001',
        clienteNombre: clientName,
        clienteRif: clientRif,
        vendedorId: selectedSeller,
        zonaVenta: selectedZone,
        condicionPago: paymentTerm,
        totalBrutoUsd: newOrderCalculations.subtotalUsd,
        ivaUsd: 0,
        totalNetoUsd: newOrderCalculations.subtotalUsd,
        totalLitros: newOrderCalculations.totalLitros,
        totalCajas: newOrderCalculations.totalCajas,
        totalItems: itemsFormatted.length,
        status: finalStatus,
        direccionEntrega: deliveryAddress,
        comentarios: creditOverrideApproved
          ? `${orderNotes ? orderNotes + '\n' : ''}[CRÉDITO AUTORIZADO EXCEPCIONALMENTE por ${creditOverrideAuthorizer}: ${creditOverrideJustification || 'Aprobación de Gerencia'}]`
          : orderNotes,
        profitOrigen: 'SIGNUM_POS',
        items: itemsFormatted
      };

      if (onSaveOrder) {
        await onSaveOrder(orderPayload);
      }

      if (autoPrintPDF) {
        generateSellerOrderPDF({
          order: orderPayload,
          config,
          currentUser,
          client: activeClientObj
        });
      }

      if (finalStatus === 'RETENIDO_CREDITO') {
        setFeedbackMsg({
          type: 'warning',
          text: `⚠️ ¡Solicitud enviada! Orden ${orderId} en estatus RETENIDO POR CRÉDITO. No se enviará a Caja hasta que esté aprobada. Motivo: ${effectiveMotivo}`
        });
      } else {
        setFeedbackMsg({
          type: 'success',
          text: `¡Nota de Pedido ${orderId} (${paymentTerm === 'CONTADO' ? 'CONTADO' : 'CRÉDITO APROBADO'}) emitida exitosamente! Enviada a Caja para facturación.`
        });
      }

      // Resetear formulario
      setSelectedClientId('');
      setClientSearchText('');
      setDeliveryAddress('');
      setOrderNotes('');
      setOrderRows([{ articuloId: '', cantidad: 1, precioUsd: 0, unidad: 'Caja (12L)', litrosUnitarios: 11.35 }]);
      setSelectedOrder(orderPayload);

      setTimeout(() => {
        setFeedbackMsg(null);
        setActiveTab('pipeline');
      }, 1500);

    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: 'Error emitiendo nota de pedido: ' + (err.message || 'Error desconocido') });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrado de pedidos en la pestaña Pipeline
  const filteredPipelineOrders = useMemo(() => {
    return safeOrders.filter(ord => {
      if (!ord) return false;
      const term = searchQuery.toLowerCase().trim();
      const matchSearch =
        !term ||
        String(ord.id || '').toLowerCase().includes(term) ||
        String(ord.numeroDoc || '').toLowerCase().includes(term) ||
        String(ord.clienteNombre || '').toLowerCase().includes(term) ||
        String(ord.clienteRif || '').toLowerCase().includes(term) ||
        String(ord.vendedorId || '').toLowerCase().includes(term);

      const matchStatus = statusFilter === 'ALL' || ord.status === statusFilter;
      const matchZone = zoneFilter === 'ALL' || ord.zonaVenta === zoneFilter;

      return matchSearch && matchStatus && matchZone;
    });
  }, [safeOrders, searchQuery, statusFilter, zoneFilter]);

  // KPIs del Pipeline
  const pipelineKpis = useMemo(() => {
    let preventas = 0;
    let aprobados = 0;
    let enTransito = 0;
    let facturados = 0;
    let retenidos = 0;
    let totalLitros = 0;
    let totalUsd = 0;

    safeOrders.forEach(o => {
      if (!o) return;
      const st = o.status || 'PENDIENTE';
      if (st === 'PENDIENTE') preventas++;
      else if (st === 'APROBADO') aprobados++;
      else if (st === 'EN_TRANSITO') enTransito++;
      else if (st === 'FACTURADO') facturados++;
      else if (st === 'RETENIDO_CREDITO') retenidos++;

      totalLitros += Number(o.totalLitros || 0);
      totalUsd += Number(o.totalNetoUsd || o.totalUsd || 0);
    });

    return {
      total: safeOrders.length,
      preventas,
      aprobados,
      enTransito,
      facturados,
      retenidos,
      totalLitros,
      totalUsd
    };
  }, [safeOrders]);

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <section
      className="commercial-flow-view card"
      style={{
        width: '100%',
        minWidth: 0,
        position: 'relative',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
        borderRadius: '16px',
        border: '1px solid var(--border-glass)',
        boxShadow: 'none',
        overflow: 'visible',
        padding: 0
      }}
    >
      {/* CABECERA PRINCIPAL IN-PAGE */}
      <div
        style={{
          padding: '1.15rem 1.5rem',
          background: isDark
            ? 'linear-gradient(135deg, rgba(0, 43, 122, 0.45) 0%, rgba(10, 16, 32, 0.95) 100%)'
            : 'linear-gradient(135deg, #eef4ff 0%, #f8fafc 100%)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderRadius: '16px 16px 0 0',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--motorven-red, #dc2626), #b91c1c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
              }}
            >
              <Truck size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.01em' }}>
                  Flujo Comercial: Venta ➔ Facturación ➔ Entrega
                </h2>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: isDark ? 'rgba(0, 240, 255, 0.15)' : '#e0f2fe',
                    border: '1px solid var(--neon-cyan, #0284c7)',
                    color: isDark ? 'var(--neon-cyan, #00f0ff)' : '#0284c7'
                  }}
                >
                  CICLO OPERATIVO 3 PASOS
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>1. Vendedor emite O.C. ➔ 2. Cajera emite Factura ➔ 3. Almacén despacha O.E.</span> • 
                <span>Tasa BCV: <strong style={{ color: 'var(--motorven-gold, #f59e0b)' }}>{formatBs(tasaBcv)}</strong></span> •
                <span>{pipelineKpis.total} Órdenes en Sistema</span>
              </div>
            </div>
          </div>

          {/* Botones de Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          </div>
        </div>

        {/* BARRA DE NAVEGACIÓN POR PESTAÑAS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.5rem',
            background: 'var(--surface-input)',
            borderBottom: '1px solid var(--border-glass)',
            flexShrink: 0,
            overflowX: 'auto'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('nuevo')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'nuevo' ? '1.5px solid var(--motorven-red)' : '1px solid transparent',
              background: activeTab === 'nuevo' ? (isDark ? 'rgba(220, 38, 38, 0.2)' : '#fee2e2') : 'transparent',
              color: activeTab === 'nuevo' ? (isDark ? '#fff' : '#b91c1c') : 'var(--text-muted)'
            }}
          >
            <FileText size={15} color="var(--motorven-red)" />
            <span>1. Nota de Pedido (Vendedor)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'pipeline' ? '1.5px solid var(--neon-cyan)' : '1px solid transparent',
              background: activeTab === 'pipeline' ? (isDark ? 'rgba(0, 240, 255, 0.15)' : '#e0f2fe') : 'transparent',
              color: activeTab === 'pipeline' ? (isDark ? 'var(--neon-cyan)' : '#0284c7') : 'var(--text-muted)'
            }}
          >
            <Layers size={15} />
            <span>2. Pipeline & Control ({safeOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('facturar')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'facturar' ? '1.5px solid var(--semaforo-verde)' : '1px solid transparent',
              background: activeTab === 'facturar' ? (isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5') : 'transparent',
              color: activeTab === 'facturar' ? (isDark ? 'var(--semaforo-verde)' : '#047857') : 'var(--text-muted)'
            }}
          >
            <CreditCard size={15} color="var(--semaforo-verde)" />
            <span>3. Facturación en Caja (Cajera)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('imprimir')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'imprimir' ? '1.5px solid var(--motorven-gold)' : '1px solid transparent',
              background: activeTab === 'imprimir' ? (isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7') : 'transparent',
              color: activeTab === 'imprimir' ? (isDark ? 'var(--motorven-gold)' : '#b45309') : 'var(--text-muted)'
            }}
          >
            <Printer size={15} />
            <span>4. Orden de Entrega {selectedOrder?.status === 'FACTURADO' ? '✅' : '🔒'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metricas')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'metricas' ? '1.5px solid #8b5cf6' : '1px solid transparent',
              background: activeTab === 'metricas' ? (isDark ? 'rgba(139, 92, 246, 0.18)' : '#ede9fe') : 'transparent',
              color: activeTab === 'metricas' ? (isDark ? '#c084fc' : '#6d28d9') : 'var(--text-muted)'
            }}
          >
            <TrendingUp size={15} />
            <span>5. Métricas & Volumen</span>
          </button>

          <button
            type="button"
            onClick={() => generateOrdersPDF({ orders, config, currentUser, selectedOrder })}
            className="btn btn-print-report btn-sm"
            style={{ marginLeft: 'auto' }}
            title="Descargar Reporte General de Pedidos y Despachos en PDF"
          >
            <Printer size={15} color="#ffffff" />
            <span>Imprimir Reporte</span>
          </button>
        </div>

        {/* Notificaciones / Mensajes de Feedback */}
        {feedbackMsg && (
          <div
            style={{
              padding: '8px 1.5rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(220, 38, 38, 0.2)',
              borderBottom: `1px solid ${feedbackMsg.type === 'success' ? 'var(--semaforo-verde)' : 'var(--motorven-red)'}`,
              color: feedbackMsg.type === 'success' ? 'var(--semaforo-verde)' : 'var(--motorven-red)'
            }}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* CUERPO IN-PAGE / CONTENIDO */}
        <div style={{ width: '100%', minWidth: 0, padding: '1.25rem 1.5rem' }}>

          {/* TAB 1: REGISTRAR NUEVO PEDIDO / PREVENTA */}
          {activeTab === 'nuevo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Sección Superior: Cliente y Logística */}
              <div
                style={{
                  background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                  borderRadius: '14px',
                  padding: '1rem 1.25rem'
                }}
              >
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--motorven-gold)' }}>PASO 1 (ROL VENDEDOR):</span>
                    <span>El asesor comercial registra y emite la <strong>Nota de Pedido / Preventa</strong>. La cajera la facturará en Caja (Paso 2) para liberar la Orden de Entrega.</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Asesor: <strong>{selectedSeller}</strong>
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} /> 1. Datos del Cliente & Logística de Entrega
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      Cliente Destinatario * ({filteredClients.length} de {safeClients.length})
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar por nombre, código o RIF..."
                        value={clientSearchText}
                        onChange={(e) => setClientSearchText(e.target.value)}
                        style={{ fontSize: '0.8rem', flex: '2 1 140px', minWidth: 0, boxSizing: 'border-box' }}
                      />
                      <select
                        className="form-control"
                        value={clientTypeFilter}
                        onChange={(e) => setClientTypeFilter(e.target.value)}
                        style={{ fontSize: '0.8rem', flex: '1 1 110px', minWidth: 0, boxSizing: 'border-box' }}
                        title="Filtrar por tipo de cliente"
                      >
                        <option value="ALL">Todos los tipos</option>
                        {clientTypes.map(t => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    </div>
                    <select
                      className="form-control"
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      style={{ fontSize: '0.82rem', width: '100%' }}
                    >
                      <option value="">-- Seleccionar Cliente Registrado --</option>
                      {filteredClients.map(c => (
                        <option key={c.id || c.codigo} value={c.id || c.codigo}>
                          {c.codigo || c.id} • {c.nombre || c.razonSocial} ({c.rif}){c.tipoCliente ? ' · ' + c.tipoCliente : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '6px', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Vendedor / Asesor Comercial
                      </label>
                      {activeSellerHabitualZone && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '1px 7px',
                            borderRadius: '4px',
                            background: isSellerOutOfZone ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.14)',
                            color: isSellerOutOfZone ? 'var(--motorven-gold, #f59e0b)' : 'var(--semaforo-verde, #10b981)',
                            border: `1px solid ${isSellerOutOfZone ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.35)'}`
                          }}
                          title="Zona habitual asignada a este asesor en la Base de Datos"
                        >
                          {isSellerOutOfZone ? `⚠️ Habitual: Zona ${activeSellerHabitualZone}` : `✓ Zona ${activeSellerHabitualZone}`}
                        </span>
                      )}
                    </div>
                    <select
                      className="form-control"
                      value={selectedSeller}
                      onChange={(e) => handleSellerChange(e.target.value)}
                      style={{ fontSize: '0.82rem', width: '100%' }}
                    >
                      {safeProfitSellers.length > 0 ? (
                        safeProfitSellers.map(s => (
                          <option key={s.coVen || s.id} value={sellerValue(s)}>
                            {s.venDes || s.nombre} ({s.coVen}){sellerZoneCode(s) ? ` · Zona ${sellerZoneCode(s)} (${s.zona || getZoneFullLabel(sellerZoneCode(s))})` : ''}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Vendedor Directo">Vendedor Directo (Planta)</option>
                          <option value="Ana Rivas">Ana Rivas (Asesor)</option>
                          <option value="Carlos Mendoza">Carlos Mendoza (Zona Norte)</option>
                          <option value="José Martínez">José Martínez (Cobranzas/Ventas)</option>
                        </>
                      )}
                    </select>
                    {activeSellerHabitualZone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.68rem', color: 'var(--text-muted)', gap: '6px', flexWrap: 'wrap' }}>
                        <span>
                          Zona habitual BD: <strong style={{ color: isSellerOutOfZone ? 'var(--motorven-gold)' : 'var(--semaforo-verde)' }}>{getZoneFullLabel(activeSellerHabitualZone)}</strong>
                        </span>
                        {isSellerOutOfZone && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedZone(activeSellerHabitualZone);
                              setOutOfZoneConfirmed(false);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--neon-cyan, #00f0ff)',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.68rem',
                              fontWeight: 700
                            }}
                          >
                            Volver a su zona ({activeSellerHabitualZone})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '6px', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Zona de Entrega / Despacho
                      </label>
                      {isSellerOutOfZone && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '1px 7px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.16)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.4)'
                          }}
                        >
                          ⚠️ Fuera de zona del vendedor
                        </span>
                      )}
                    </div>
                    <select
                      className="form-control"
                      value={selectedZone}
                      onChange={(e) => handleZoneChange(e.target.value)}
                      style={{
                        fontSize: '0.82rem',
                        width: '100%',
                        borderColor: isSellerOutOfZone ? 'rgba(245, 158, 11, 0.55)' : undefined
                      }}
                    >
                      {safeProfitZones.length > 0 ? (
                        safeProfitZones.map(z => {
                          const zCode = z.coZon || z.co_zon;
                          const zAdvisors = getSellersForZone(zCode);
                          const advisorNames = zAdvisors.map(a => `${a.venDes} (${a.coVen})`).join(', ');
                          return (
                            <option key={zCode} value={zCode}>
                              {zCode} - {z.zonDes || z.zon_des}{advisorNames ? ` · [${advisorNames}]` : ''}
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="01">01 - Valencia Norte (Prebo, Trigal, Guaparo)</option>
                          <option value="02">02 - Isabelica - Pque Valencia - Flor Amarillo</option>
                          <option value="03">03 - San Diego - Naguanagua</option>
                          <option value="04">04 - Zona Sur de Valencia</option>
                          <option value="05">05 - Eje Occidental (Tocuyito, Bejuma)</option>
                          <option value="06">06 - Eje Oriental (Guacara, Mariara)</option>
                        </>
                      )}
                    </select>
                    {(() => {
                      const zoneAdvisors = getSellersForZone(selectedZone);
                      if (zoneAdvisors.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.68rem', color: 'var(--text-muted)', gap: '6px', flexWrap: 'wrap' }}>
                          <span>
                            Asesor(es) Zona {selectedZone}:{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {zoneAdvisors.map(a => `${a.venDes} (${a.coVen})`).join(', ')}
                            </strong>
                          </span>
                          {isSellerOutOfZone && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSeller(sellerValue(zoneAdvisors[0]));
                                setOutOfZoneConfirmed(false);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--neon-cyan, #00f0ff)',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '0.68rem',
                                fontWeight: 700
                              }}
                              title="Sincronizar automáticamente el vendedor titular de esta zona"
                            >
                              Asignar {zoneAdvisors[0].venDes}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Condición Comercial
                        </label>
                        {activeClientObj && (
                          <span
                            style={{
                              fontSize: '0.67rem',
                              fontWeight: 800,
                              padding: '1px 7px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--motorven-gold, #f59e0b)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="Condición de crédito acordada en la ficha comercial del cliente"
                          >
                            <span>Acordado / Actual:</span>
                            <strong>{clientAgreedInfo.label}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <select
                      className="form-control"
                      value={paymentTerm}
                      onChange={(e) => setPaymentTerm(e.target.value)}
                      style={{ fontSize: '0.82rem', width: '100%' }}
                    >
                      <option value="CONTADO">
                        Contado / Pago Inmediato{clientAgreedInfo.termKey === 'CONTADO' ? ' ★ [Condición Acordada]' : ''}
                      </option>
                      <option value="7_DIAS">
                        Crédito 7 Días{clientAgreedInfo.termKey === '7_DIAS' ? ' ★ [Condición Acordada]' : ''}{getStatusLabelForTerm('7_DIAS') ? ` - [${getStatusLabelForTerm('7_DIAS')}]` : ''}
                      </option>
                      <option value="15_DIAS">
                        Crédito 15 Días{clientAgreedInfo.termKey === '15_DIAS' ? ' ★ [Condición Acordada]' : ''}{getStatusLabelForTerm('15_DIAS') ? ` - [${getStatusLabelForTerm('15_DIAS')}]` : ''}
                      </option>
                      <option value="21_DIAS">
                        Crédito 21 Días{clientAgreedInfo.termKey === '21_DIAS' ? ' ★ [Condición Acordada]' : ''}{getStatusLabelForTerm('21_DIAS') ? ` - [${getStatusLabelForTerm('21_DIAS')}]` : ''}
                      </option>
                      <option value="30_DIAS">
                        Crédito 30 Días{clientAgreedInfo.termKey === '30_DIAS' ? ' ★ [Condición Acordada]' : ''}{getStatusLabelForTerm('30_DIAS') ? ` - [${getStatusLabelForTerm('30_DIAS')}]` : ''}
                      </option>
                    </select>

                    {/* Fila informativa de condición acordada vs plazo seleccionado */}
                    {activeClientObj && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.69rem', color: 'var(--text-muted)' }}>
                        <div>
                          <span>Ficha Cliente: <strong style={{ color: 'var(--motorven-gold, #f59e0b)' }}>{clientAgreedInfo.label}</strong></span>
                          {paymentTerm !== clientAgreedInfo.termKey && (
                            <span style={{ color: 'var(--neon-cyan, #00f0ff)', marginLeft: '6px' }}>
                              ➔ Plazo O.C.: <strong>{paymentTerm === 'CONTADO' ? 'Contado' : paymentTerm.replace('_DIAS', ' Días')}</strong>
                            </span>
                          )}
                        </div>
                        {paymentTerm !== clientAgreedInfo.termKey && (
                          <button
                            type="button"
                            onClick={() => setPaymentTerm(clientAgreedInfo.termKey)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--neon-cyan, #00f0ff)',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.68rem',
                              fontWeight: 700
                            }}
                            title="Restablecer al plazo de crédito acordado en la ficha"
                          >
                            Volver a acordado
                          </button>
                        )}
                      </div>
                    )}

                    {activeClientObj && clientCreditEvaluation.evaluado && paymentTerm !== 'CONTADO' && (
                      <div
                        style={{
                          marginTop: '6px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          lineHeight: 1.35,
                          background: effectiveIsAprobado ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          border: `1px solid ${effectiveIsAprobado ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
                          color: effectiveIsAprobado ? '#10b981' : '#ef4444'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <div>
                            <strong>{effectiveIsAprobado ? '✓ Aprobado:' : '⚠️ Negado / Requiere Aprobación:'}</strong>{' '}
                            {effectiveMotivo}
                          </div>
                          {!effectiveIsAprobado && (
                            <button
                              type="button"
                              onClick={() => setShowCreditApprovalModal(true)}
                              className="btn btn-sm"
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 8px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid #ef4444',
                                color: '#ef4444',
                                fontWeight: 800,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Aprobar Crédito
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Dirección Exacta de Despacho (Para Chofer / Hoja de Ruta)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Galpón, local comercial, punto de referencia y persona de contacto..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    style={{ fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Renglones de Lubricantes */}
              <div
                style={{
                  background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                  borderRadius: '14px',
                  padding: '1rem 1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--motorven-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={15} /> 2. Renglones de Lubricantes ({orderRows.length})
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 10px' }}
                  >
                    <Plus size={14} /> Agregar Lubricante
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {orderRows.map((row, idx) => {
                    const matchedProd = safeProducts.find(
                      p =>
                        p &&
                        (String(p.id || '').trim() === String(row.articuloId || '').trim() ||
                          String(p.codigo || '').trim() === String(row.articuloId || '').trim() ||
                          String(p.co_art || '').trim() === String(row.articuloId || '').trim())
                    );
                    const rowLitros = (Number(row.cantidad) || 0) * (Number(row.litrosUnitarios) || 11.35);
                    const rowTotalUsd = (Number(row.cantidad) || 0) * (Number(row.precioUsd) || 0);

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          minWidth: 0,
                          alignItems: 'center',
                          padding: '8px 10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.06))',
                          borderRadius: '10px'
                        }}
                      >
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '8px',
                            background: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
                          }}
                          title={matchedProd?.descripcion || 'Imagen del Lubricante'}
                        >
                          <OilstoneProductImage
                            product={matchedProd}
                            productId={matchedProd?.id || row.articuloId}
                            imagen={matchedProd?.imagen}
                            codigo={matchedProd?.codigo || row.articuloId}
                            descripcion={matchedProd?.descripcion}
                            width="100%"
                            height="100%"
                          />
                        </div>

                        <div style={{ flex: '2.5 1 220px', minWidth: 0 }}>
                          <select
                            className="form-control"
                            value={row.articuloId}
                            onChange={(e) => handleRowChange(idx, 'articuloId', e.target.value)}
                            style={{ fontSize: '0.8rem', padding: '6px 8px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                          >
                            <option value="">-- Seleccionar Lubricante ({safeProducts.length}) --</option>
                            {safeProducts.map(p => (
                              <option key={p.id || p.codigo} value={p.id || p.codigo}>
                                {p.codigo} - {p.descripcion} ({formatUsd(p.precioUsdMayor || p.precio_usd_mayor || p.precioUsdDetal || p.precio_usd_detal || p.precio || 0)})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ flex: '1 1 110px', minWidth: 0 }}>
                          <input
                            type="text"
                            className="form-control"
                            value={row.unidad || 'Caja (12L)'}
                            onChange={(e) => handleRowChange(idx, 'unidad', e.target.value)}
                            placeholder="Presentación"
                            style={{ fontSize: '0.78rem', padding: '6px 8px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ flex: '1 1 80px', minWidth: 0 }}>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={row.cantidad}
                            onChange={(e) => handleRowChange(idx, 'cantidad', Math.max(1, Number(e.target.value)))}
                            placeholder="Cant."
                            style={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', padding: '6px 8px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ flex: '1 1 90px', minWidth: 0 }}>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control"
                            value={row.precioUsd}
                            onChange={(e) => handleRowChange(idx, 'precioUsd', Number(e.target.value))}
                            placeholder="Precio $"
                            style={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'right', padding: '6px 8px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ textAlign: 'right', flex: '1 1 90px', minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--semaforo-verde)' }}>
                            {formatUsd(rowTotalUsd)}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-tech)' }}>
                            {rowLitros.toFixed(1)} Lts
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            disabled={orderRows.length <= 1}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: orderRows.length <= 1 ? 'var(--text-muted)' : 'var(--motorven-red)',
                              cursor: orderRows.length <= 1 ? 'not-allowed' : 'pointer',
                              padding: '4px'
                            }}
                            title="Eliminar renglón"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totales y Botones de Guardar */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)',
                  border: '1.5px solid var(--border-glass, rgba(0, 240, 255, 0.3))',
                  borderRadius: '14px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Total Cajas
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {newOrderCalculations.totalCajas} Cajas
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Volumen Despacho
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--motorven-gold)' }}>
                      {newOrderCalculations.totalLitros.toFixed(1)} Litros
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Monto Total ($ USD)
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                      {formatUsd(newOrderCalculations.subtotalUsd)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatBs(newOrderCalculations.totalBs)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveOrderForm('PENDIENTE')}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                      title="Guardar borrador de nota de pedido sin enviar todavía a caja"
                    >
                      <Clock size={16} />
                      <span>Guardar Borrador</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveOrderForm('APROBADO', true)}
                      className="btn btn-print-report"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)',
                        borderColor: 'rgba(59, 130, 246, 0.4)',
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(30, 64, 175, 0.35)'
                      }}
                      title="Emitir nota de pedido y descargar automáticamente el PDF oficial para el vendedor y cliente"
                    >
                      <Printer size={16} color="#ffffff" />
                      <span>Emitir y Descargar PDF Pedido</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveOrderForm('APROBADO', false)}
                      className="btn btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        background: isCreditNegado
                          ? 'linear-gradient(135deg, #d97706, #b45309)'
                          : 'linear-gradient(135deg, var(--motorven-red), #b91c1c)',
                        borderColor: isCreditNegado ? '#d97706' : 'var(--motorven-red)',
                        color: '#fff',
                        boxShadow: isCreditNegado
                          ? '0 4px 14px rgba(217, 119, 6, 0.4)'
                          : '0 4px 14px rgba(220, 38, 38, 0.35)'
                      }}
                      title={isCreditNegado ? 'Solicitar aprobación de crédito a Gerencia' : 'Emitir nota de pedido para facturación en caja'}
                    >
                      {isCreditNegado ? <ShieldAlert size={16} /> : <Send size={16} />}
                      <span>{isCreditNegado ? 'SOLICITAR APROBACIÓN' : '🚀 Emitir a Caja'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isCreditNegado ? 'var(--motorven-gold, #f59e0b)' : 'var(--text-muted)' }}>
                    {isCreditNegado
                      ? (paymentTerm === '30_DIAS'
                          ? '⛔ CRÉDITO A 30 DÍAS: Requiere aprobación obligatoria de Gerencia antes de enviarse a Caja.'
                          : '⛔ CRÉDITO NEGADO: Esta orden NO se enviará a Caja hasta que sea aprobada por Gerencia o Cobranzas.')
                      : paymentTerm === 'CONTADO'
                        ? 'ℹ️ Pago de Contado: Se emitirá y enviará la Nota de Pedido directamente a Caja.'
                        : 'ℹ️ Crédito Aprobado: Cumple con políticas comerciales y se enviará a Caja.'}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PIPELINE & CONTROL */}
          {activeTab === 'pipeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Barra de Filtros */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))'
                }}
              >
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar por cliente, RIF, número de pedido o vendedor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '32px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div style={{ minWidth: '160px' }}>
                  <select
                    className="form-control"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="ALL">Todos los Estados ({safeOrders.length})</option>
                    <option value="PENDIENTE">1. Preventas ({pipelineKpis.preventas})</option>
                    <option value="APROBADO">2. Aprobados ({pipelineKpis.aprobados})</option>
                    <option value="EN_TRANSITO">3. En Tránsito ({pipelineKpis.enTransito})</option>
                    <option value="FACTURADO">4. Facturados ({pipelineKpis.facturados})</option>
                    <option value="RETENIDO_CREDITO">⛔ Retenidos por Crédito ({pipelineKpis.retenidos || 0})</option>
                  </select>
                </div>

                <div style={{ minWidth: '160px' }}>
                  <select
                    className="form-control"
                    value={zoneFilter}
                    onChange={(e) => setZoneFilter(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <option value="ALL">Todas las Zonas</option>
                    {safeProfitZones.map(z => (
                      <option key={z.coZon || z.co_zon} value={z.coZon || z.co_zon}>
                        {z.coZon || z.co_zon} - {z.zonDes || z.zon_des}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Listado de Tarjetas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
                {filteredPipelineOrders.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <Truck size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>No se encontraron pedidos con los filtros aplicados.</div>
                    <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Crea un nuevo pedido desde la pestaña 1.</div>
                  </div>
                ) : (
                  filteredPipelineOrders.map(ord => {
                    const st = STATUS_CONFIG[ord.status] || STATUS_CONFIG.PENDIENTE;
                    const StatusIcon = st.icon;

                    return (
                      <div
                        key={ord.id}
                        style={{
                          background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                          border: selectedOrder?.id === ord.id ? '2px solid var(--neon-cyan)' : '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                          borderRadius: '14px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedOrder(ord)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                              {ord.numeroDoc || ord.id}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {ord.fechaEmision ? new Date(ord.fechaEmision).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {isOrderReservationExpired(ord) && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid var(--motorven-red)',
                                  color: '#f87171',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title="Esta preventa no fue facturada antes de las 5:00 PM; su reserva de stock se liberó automáticamente al almacén."
                              >
                                <Clock size={10} /> Caducada 5 PM
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: `1px solid ${st.color}`,
                                color: st.color,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <StatusIcon size={12} />
                              {st.shortLabel}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ord.clienteNombre}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            RIF: {ord.clienteRif || 'S/R'} • Zona: {ord.zonaVenta || 'General'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.2)', padding: '6px 10px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--motorven-gold)', fontWeight: 700 }}>
                            🛢️ {Number(ord.totalLitros || 0).toFixed(1)} Lts
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                            {formatUsd(ord.totalNetoUsd || ord.totalUsd)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          {ord.status === 'FACTURADO' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(ord);
                                setActiveTab('imprimir');
                              }}
                              className="btn btn-sm"
                              style={{ flex: 1, fontSize: '0.72rem', padding: '4px 6px', background: 'rgba(16, 185, 129, 0.25)', border: '1px solid var(--semaforo-verde)', color: 'var(--semaforo-verde)', fontWeight: 800 }}
                            >
                              ✅ Facturado (Ver O.E.)
                            </button>
                          ) : ord.status === 'RETENIDO_CREDITO' ? (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (onUpdateOrderStatus) {
                                  await onUpdateOrderStatus(ord.id, 'APROBADO');
                                  setSelectedOrder({ ...ord, status: 'APROBADO' });
                                  setFeedbackMsg({
                                    type: 'success',
                                    text: `✅ ¡Crédito de la orden ${ord.numeroDoc || ord.id} APROBADO! Ahora ha sido enviada a Caja para facturación.`
                                  });
                                }
                              }}
                              className="btn btn-sm"
                              style={{
                                flex: 1,
                                fontSize: '0.72rem',
                                padding: '4px 6px',
                                background: 'rgba(217, 119, 6, 0.18)',
                                border: '1px solid #d97706',
                                color: '#f59e0b',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                              title="Crédito negado retenido. Haga clic para autorizar formalmente y enviar a Caja."
                            >
                              <ShieldCheck size={13} />
                              <span>✓ Aprobar y Enviar a Caja</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(ord);
                                if (onProceedToPOS) {
                                  onProceedToPOS(ord);
                                } else {
                                  setActiveTab('facturar');
                                }
                              }}
                              className="btn btn-sm"
                              style={{
                                flex: 1,
                                fontSize: '0.72rem',
                                padding: '4px 6px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid var(--semaforo-verde)',
                                color: 'var(--semaforo-verde)',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                              title="Cargar pedido directamente al terminal POS de facturación"
                            >
                              🚀 Facturar en POS
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(ord);
                              generateSellerOrderPDF({
                                order: ord,
                                config,
                                currentUser,
                                client: safeClients.find(c => c.id === ord.clienteId || c.rif === ord.clienteRif)
                              });
                            }}
                            className="btn btn-print-report btn-sm"
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)'
                            }}
                            title="Descargar Nota de Pedido / Cotización de Preventa en PDF para el Vendedor (guarda en su dispositivo)"
                          >
                            <Printer size={13} color="#ffffff" /> 📄 PDF Pedido
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* TAB 3: FACTURACIÓN EN CAJA (CAJERA) */}
          {activeTab === 'facturar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  <span style={{ fontWeight: 800, color: 'var(--semaforo-verde)' }}>PASO 2 (ROL CAJERA):</span>
                  <span>La cajera recibe la Nota de Pedido del vendedor, cobra y emite la <strong>Factura Fiscal</strong>. Al emitir la factura se generará la <strong>Orden de Entrega (Paso 3)</strong>.</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Cajera en turno: <strong>{currentUser?.nombre || 'Caja Principal'}</strong>
                </span>
              </div>

              {!selectedOrder ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', borderRadius: '14px' }}>
                  <ShoppingCart size={42} style={{ color: 'var(--semaforo-verde)', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Seleccione una Nota de Pedido para Facturar</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Seleccione una nota de pedido de la lista para proceder al cobro y emisión de la factura fiscal.
                  </div>

                  <div style={{ maxWidth: '500px', margin: '1rem auto 0' }}>
                    <select
                      className="form-control"
                      onChange={(e) => {
                        const match = safeOrders.find(o => o.id === e.target.value);
                        if (match) setSelectedOrder(match);
                      }}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">-- Seleccionar Nota de Pedido --</option>
                      {safeOrders.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.numeroDoc || o.id} • {o.clienteNombre} ({formatUsd(o.totalNetoUsd)}) {o.status === 'FACTURADO' ? '✅ FACTURADO' : (o.status === 'RETENIDO_CREDITO' ? '⛔ RETENIDO (Crédito Negado)' : '⏳ PENDIENTE')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }}>
                  
                  <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                          Nota de Pedido: {selectedOrder.numeroDoc || selectedOrder.id}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Cliente: <strong>{selectedOrder.clienteNombre}</strong> ({selectedOrder.clienteRif || 'S/R'}) • Vendedor: <strong>{selectedOrder.vendedorId || 'No asignado'}</strong> • Condición: <strong style={{ color: 'var(--motorven-gold)' }}>{formatCondicionPago(selectedOrder.condicionPago)}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem' }}
                      >
                        Cambiar Orden
                      </button>
                    </div>

                    <div className="table-container" style={{ border: '1px solid var(--border-glass)', borderRadius: '8px', marginBottom: '1rem' }}>
                      <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                        <thead>
                          <tr>
                            <th>LUBRICANTE</th>
                            <th style={{ textAlign: 'center' }}>CANT</th>
                            <th style={{ textAlign: 'right' }}>LITROS</th>
                            <th style={{ textAlign: 'right' }}>PRECIO $</th>
                            <th style={{ textAlign: 'right' }}>TOTAL $</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                                Renglón general: {formatUsd(selectedOrder.totalNetoUsd)}
                              </td>
                            </tr>
                          ) : (
                            selectedOrder.items.map((it, idx) => {
                              const itemProd = safeProducts.find(
                                p =>
                                  p &&
                                  (String(p.id || '').trim() === String(it.articuloId || '').trim() ||
                                    String(p.codigo || '').trim() === String(it.articuloId || '').trim() ||
                                    String(p.co_art || '').trim() === String(it.articuloId || '').trim())
                              );
                              return (
                                <tr key={it.id || idx}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div
                                        style={{
                                          width: '36px',
                                          height: '36px',
                                          borderRadius: '6px',
                                          background: '#ffffff',
                                          border: '1px solid rgba(255, 255, 255, 0.2)',
                                          padding: '2px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          overflow: 'hidden',
                                          flexShrink: 0
                                        }}
                                      >
                                        <OilstoneProductImage
                                          product={itemProd}
                                          productId={itemProd?.id || it.articuloId}
                                          imagen={itemProd?.imagen || it.imagen}
                                          codigo={itemProd?.codigo || it.articuloId}
                                          descripcion={it.articuloDescripcion || itemProd?.descripcion}
                                          width="100%"
                                          height="100%"
                                        />
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 700 }}>{it.articuloDescripcion || it.articuloId}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{it.unidadVenta || 'Caja (12L)'}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.cantidad}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--motorven-gold)' }}>
                                    {Number(it.litrosTotales || (it.cantidad * 11.35)).toFixed(1)} L
                                  </td>
                                  <td style={{ textAlign: 'right' }}>{formatUsd(it.precioUnitarioUsd)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--semaforo-verde)' }}>
                                    {formatUsd(it.totalUsd)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VOLUMEN TOTAL</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--motorven-gold)' }}>
                          {Number(selectedOrder.totalLitros || 0).toFixed(1)} Lts
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TOTAL NETO ($ USD)</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                          {formatUsd(selectedOrder.totalNetoUsd || selectedOrder.totalUsd)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {formatBs((Number(selectedOrder.totalNetoUsd) || 0) * tasaBcv)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.25), rgba(15, 23, 42, 0.95))', border: '1.5px solid var(--semaforo-verde)', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--semaforo-verde)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={18} /> Protocolo de Cobro & Liquidación en Caja
                    </div>

                    {selectedOrder.status === 'RETENIDO_CREDITO' ? (
                      <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1.5px solid var(--motorven-red)', borderRadius: '10px', padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--motorven-red)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <AlertTriangle size={18} /> Orden Bloqueada: Crédito Negado
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          Esta orden posee condición a crédito <strong>NEGADA</strong>. Por políticas comerciales, <strong>NO se enviará ni facturará en Caja</strong> hasta que sea aprobada por Gerencia o Cobranzas.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              if (onUpdateOrderStatus) {
                                await onUpdateOrderStatus(selectedOrder.id, 'APROBADO');
                                setSelectedOrder({ ...selectedOrder, status: 'APROBADO' });
                                setFeedbackMsg({
                                  type: 'success',
                                  text: `✅ ¡Crédito de la orden ${selectedOrder.numeroDoc || selectedOrder.id} APROBADO por Gerencia! Facturación en Caja habilitada.`
                                });
                              }
                            }}
                            className="btn btn-primary"
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              background: 'linear-gradient(135deg, #d97706, #b45309)',
                              border: 'none',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <ShieldCheck size={16} /> Aprobar Crédito y Habilitar Facturación
                          </button>
                        </div>
                      </div>
                    ) : selectedOrder.status === 'FACTURADO' ? (
                      <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--semaforo-verde)', borderRadius: '10px', padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--semaforo-verde)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <CheckCircle2 size={18} /> Esta Orden ya fue Facturada
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          Factura Fiscal N°: <strong style={{ color: 'var(--motorven-gold)' }}>{selectedOrder.nroFactura || 'FACT-ASIGNADA'}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Cajera: {selectedOrder.cajera || 'Caja Principal'} • Método: {selectedOrder.metodoPagoFactura || 'Efectivo / Transferencia'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            generateOrdersPDF({ orders: [selectedOrder], config, currentUser, selectedOrder });
                            setActiveTab('imprimir');
                          }}
                          className="btn btn-print-report"
                          style={{ marginTop: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Printer size={16} color="#ffffff" /> Imprimir Reporte
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                            Método de Pago Seleccionado
                          </label>
                          <select
                            className="form-control"
                            value={billingPaymentMethod}
                            onChange={(e) => setBillingPaymentMethod(e.target.value)}
                            style={{ fontSize: '0.82rem', width: '100%' }}
                          >
                            <option value="EFECTIVO_USD">Divisas en Efectivo ($ USD)</option>
                            <option value="TRANSFERENCIA_BS">Transferencia Bancaria Bs. (Tasa BCV)</option>
                            <option value="PAGO_MOVIL">Pago Móvil Interbancario (Bs.)</option>
                            <option value="ZELLE">Zelle / Transferencia Internacional ($ USD)</option>
                            <option value="CREDITO">Crédito Comercial (7 / 15 / 21 / 30 Días)</option>
                          </select>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-glass)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ℹ️ Al presionar el botón inferior, la <strong>Cajera</strong> emite la <strong>Factura de Venta</strong> y el sistema <strong>generará automáticamente la Orden de Entrega</strong> para despacho.
                        </div>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={async () => {
                            setIsSaving(true);
                            try {
                              const generatedInvoiceNum = `FACT-${Date.now().toString().slice(-6)}`;
                              let saleResult = null;
                              if (onProcessSale) {
                                saleResult = await onProcessSale({
                                  orderId: selectedOrder.id,
                                  numeroDoc: generatedInvoiceNum,
                                  cliente: {
                                    id: selectedOrder.clienteId,
                                    nombre: selectedOrder.clienteNombre,
                                    rif: selectedOrder.clienteRif,
                                    direccion: selectedOrder.direccionEntrega
                                  },
                                  items: (selectedOrder.items || []).map(it => ({
                                    codigo: it.articuloId,
                                    descripcion: it.articuloDescripcion,
                                    cantidad: it.cantidad,
                                    precioUsd: it.precioUnitarioUsd,
                                    subtotalUsd: it.totalUsd,
                                    litros: it.litrosTotales
                                  })),
                                  totalUsd: selectedOrder.totalNetoUsd,
                                  totalBs: (Number(selectedOrder.totalNetoUsd) || 0) * tasaBcv,
                                  metodoPago: billingPaymentMethod,
                                  condicionPago: selectedOrder.condicionPago || 'CONTADO'
                                });
                              }

                              const invoiceNum = saleResult?.numeroDoc || saleResult?.nroFactura || generatedInvoiceNum;

                              const billedOrder = {
                                ...selectedOrder,
                                status: 'FACTURADO',
                                nroFactura: invoiceNum,
                                fechaFactura: new Date().toISOString(),
                                cajera: currentUser?.nombre || 'Caja Principal',
                                metodoPagoFactura: billingPaymentMethod
                              };

                              if (onUpdateOrderStatus) {
                                await onUpdateOrderStatus(selectedOrder.id, 'FACTURADO');
                              }
                              if (onSaveOrder) {
                                await onSaveOrder(billedOrder);
                              }

                              setSelectedOrder(billedOrder);

                              setFeedbackMsg({
                                type: 'success',
                                text: `¡Factura ${invoiceNum} emitida exitosamente por Caja! Se ha generado la Orden de Entrega para Almacén.`
                              });

                              setTimeout(() => {
                                setActiveTab('imprimir');
                                setFeedbackMsg(null);
                              }, 1200);

                            } catch (err) {
                              console.error(err);
                              setFeedbackMsg({ type: 'error', text: 'Error procesando facturación en caja: ' + err.message });
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          className="btn"
                          style={{
                            padding: '12px',
                            fontSize: '0.95rem',
                            fontWeight: 900,
                            background: 'linear-gradient(135deg, var(--semaforo-verde), #059669)',
                            color: '#fff',
                            borderRadius: '10px',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                            marginTop: 'auto'
                          }}
                        >
                          {isSaving ? 'Emitiendo Factura...' : '⚡ 2. Emitir Factura en Caja & Generar Orden de Entrega'}
                        </button>
                      </>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 4: ORDEN DE ENTREGA / GUÍA DE DESPACHO */}
          {activeTab === 'imprimir' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {!selectedOrder ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', borderRadius: '14px' }}>
                  <FileText size={42} style={{ color: 'var(--motorven-gold)', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Seleccione una Orden para Ver su Orden de Entrega</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Seleccione una orden del pipeline para consultar o imprimir su documento de entrega oficial.
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pipeline')}
                    className="btn btn-secondary"
                    style={{ marginTop: '1rem', fontSize: '0.82rem' }}
                  >
                    Ir al Pipeline
                  </button>
                </div>
              ) : selectedOrder.status !== 'FACTURADO' ? (
                /* BLOQUEO OPERATIVO: LA ORDEN DE ENTREGA SOLO SE GENERA TRAS FACTURAR */
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '2px dashed var(--motorven-red, #dc2626)',
                    borderRadius: '16px',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.25rem'
                  }}
                >
                  <div
                    style={{
                      width: '70px',
                      height: '70px',
                      borderRadius: '50%',
                      background: 'rgba(220, 38, 38, 0.15)',
                      border: '2px solid rgba(220, 38, 38, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--motorven-red, #dc2626)'
                    }}
                  >
                    <Lock size={36} />
                  </div>

                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-heading)' }}>
                      Orden de Entrega No Generada (Requiere Facturación en Caja)
                    </h3>
                    <p style={{ margin: '0.65rem auto 0', fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '620px', lineHeight: '1.6' }}>
                      El asesor comercial emitió la Nota de Pedido <strong>{selectedOrder.numeroDoc || selectedOrder.id}</strong> para el cliente <strong>{selectedOrder.clienteNombre}</strong>.
                      Por estricto protocolo de despacho de <strong>SIGNUM MOTORVEN</strong>, la <strong>Orden de Entrega física se genera de forma automática ÚNICAMENTE una vez que la Cajera emite la Factura de Venta</strong> correspondiente.
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      borderRadius: '30px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid var(--motorven-gold)',
                      color: 'var(--motorven-gold)',
                      fontSize: '0.85rem',
                      fontWeight: 800
                    }}
                  >
                    <Clock size={16} />
                    <span>Estado Actual: Nota de Pedido Emitida • Pendiente por Facturar en Caja</span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('facturar')}
                      className="btn btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.9rem',
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, var(--semaforo-verde), #059669)',
                        borderColor: 'var(--semaforo-verde)',
                        padding: '10px 22px',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      <ShoppingCart size={18} />
                      <span>2. Facturar esta Orden en Caja (Cajera)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('pipeline')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '10px 18px' }}
                    >
                      Volver al Pipeline
                    </button>
                  </div>
                </div>
              ) : (
                /* ORDEN DE ENTREGA GENERADA TRAS FACTURAR */
                <>
                  <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: '20px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid var(--semaforo-verde)',
                          color: 'var(--semaforo-verde)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <CheckCircle2 size={15} /> 3. ORDEN DE ENTREGA GENERADA Y AUTORIZADA
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Factura Fiscal N°: <strong style={{ color: 'var(--text-primary)' }}>{selectedOrder.nroFactura || 'FACT-OFICIAL'}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => generateSellerOrderPDF({
                          order: selectedOrder,
                          config,
                          currentUser,
                          client: safeClients.find(c => c.id === selectedOrder.clienteId || c.rif === selectedOrder.clienteRif)
                        })}
                        className="btn btn-print-report"
                        style={{ background: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Descargar Nota de Pedido / Cotización de Preventa en PDF para el Vendedor (guarda en su dispositivo)"
                      >
                        <Printer size={16} color="#ffffff" /> 📄 Nota Pedido Vendedor (PDF)
                      </button>

                      <button
                        type="button"
                        onClick={() => generateOrdersPDF({ orders, config, currentUser, selectedOrder })}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Descargar Orden de Entrega y Despacho en PDF"
                      >
                        <Printer size={16} /> <span>Reporte General</span>
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      borderRadius: '12px',
                      padding: '2rem',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                      border: '1px solid #e2e8f0',
                      fontFamily: 'sans-serif'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #002b7a', paddingBottom: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <MotorvenLogo width={180} height="auto" />
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                          <strong>SIGNUM MOTORVEN, C.A.</strong> • RIF: J-30401927-4
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Distribuidora Oficial de Lubricantes Automotrices e Industriales OILSTONE ®
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>
                          ORDEN DE ENTREGA / GUÍA DE DESPACHO
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#002b7a', marginTop: '2px' }}>
                          N° OE-{(selectedOrder.nroFactura || selectedOrder.id || '').replace(/[^0-9]/g, '') || selectedOrder.id}
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                          Factura Fiscal N°: {selectedOrder.nroFactura || 'FACT-OFICIAL'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          Fecha Factura: {selectedOrder.fechaFactura ? new Date(selectedOrder.fechaFactura).toLocaleString('es-VE') : new Date().toLocaleDateString('es-VE')} • Tasa BCV: {formatBs(tasaBcv)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}>
                      <div>
                        <div><strong>CLIENTE:</strong> {selectedOrder?.clienteNombre || 'Cliente General'}</div>
                        <div><strong>RIF:</strong> {selectedOrder?.clienteRif || 'J-000000000'}</div>
                        <div><strong>DIRECCIÓN DE ENTREGA:</strong> {selectedOrder?.direccionEntrega || 'Zona Industrial Valencia'}</div>
                        <div><strong>ZONA LOGÍSTICA:</strong> {selectedOrder?.zonaVenta || '01 - Valencia'}</div>
                      </div>
                      <div>
                        <div><strong>NOTA DE PEDIDO ORIGEN:</strong> {selectedOrder?.numeroDoc || selectedOrder?.id}</div>
                        <div><strong>VENDEDOR (EMITIÓ PEDIDO):</strong> {selectedOrder?.vendedorId || 'Asesor Comercial'}</div>
                        <div><strong>CAJERA (FACTURÓ EN CAJA):</strong> {selectedOrder?.cajera || 'Caja Principal'}</div>
                        <div><strong>CONDICIÓN DE PAGO:</strong> {formatCondicionPago(selectedOrder?.condicionPago)}</div>
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '1.5rem' }}>
                      <thead>
                        <tr style={{ background: '#002b7a', color: '#fff' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>CÓDIGO</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>DESCRIPCIÓN DEL LUBRICANTE</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>PRESENTACIÓN</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>CANTIDAD</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>LITROS</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>PRECIO $</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>TOTAL $</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!selectedOrder?.items || selectedOrder.items.length === 0) ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>
                              Renglón General: Total {formatUsd(selectedOrder?.totalNetoUsd || 0)}
                            </td>
                          </tr>
                        ) : (
                          selectedOrder.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 700 }}>{it.articuloId}</td>
                              <td style={{ padding: '6px 8px' }}>{it.articuloDescripcion}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.unidadVenta || 'Caja (12L)'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>{it.cantidad}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(it.litrosTotales || (it.cantidad * 11.35)).toFixed(1)} L</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatUsd(it.precioUnitarioUsd)}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800 }}>{formatUsd(it.totalUsd)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1.5rem', flex: 1 }}>
                        <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '0.68rem', color: '#475569' }}>
                          <div><strong>Facturado por Cajera</strong></div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>{selectedOrder.cajera || 'Caja'}</div>
                        </div>
                        <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '0.68rem', color: '#475569' }}>
                          <div><strong>Despacho Almacén</strong></div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>Revisado Conforme</div>
                        </div>
                        <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '0.68rem', color: '#475569' }}>
                          <div><strong>Transporte / Chofer</strong></div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>Firma & C.I.</div>
                        </div>
                        <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '0.68rem', color: '#475569' }}>
                          <div><strong>Cliente Receptor</strong></div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>Firma, C.I. y Sello</div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '180px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                          TOTAL LITROS: <strong>{Number(selectedOrder?.totalLitros || 0).toFixed(1)} L</strong>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#002b7a' }}>
                          TOTAL: {formatUsd(selectedOrder?.totalNetoUsd || selectedOrder?.totalUsd || 0)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {formatBs((Number(selectedOrder?.totalNetoUsd) || 0) * tasaBcv)}
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}

            </div>
          )}

          {/* TAB 5: MÉTRICAS & VOLUMEN */}
          {activeTab === 'metricas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Pedidos Registrados</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-heading)', marginTop: '4px' }}>{pipelineKpis.total}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--neon-cyan)', marginTop: '2px' }}>Pipeline Activo 100%</div>
                </div>

                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Volumen Total en Litros</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--motorven-gold)', marginTop: '4px' }}>{pipelineKpis.totalLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Lubricantes Comprometidos</div>
                </div>

                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Monto Acumulado ($ USD)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '4px' }}>{formatUsd(pipelineKpis.totalUsd)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{formatBs(pipelineKpis.totalUsd * tasaBcv)}</div>
                </div>

                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Estatus de Conversión</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
                    {pipelineKpis.total > 0 ? Math.round((pipelineKpis.facturados / pipelineKpis.total) * 100) : 0}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{pipelineKpis.facturados} Facturados / {pipelineKpis.preventas} Preventas</div>
                </div>
              </div>
            </div>
          )}

        {/* ========================================================================= */}
        {/* MODAL EMERGENTE: AUDITORÍA Y APROBACIÓN DE CRÉDITO COMERCIAL */}
        {/* ========================================================================= */}
        {showCreditApprovalModal && activeClientObj && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(5, 10, 24, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '1rem'
            }}
            onClick={() => setShowCreditApprovalModal(false)}
          >
            <div
              style={{
                background: isDark ? '#0c142b' : '#ffffff',
                border: '1.5px solid var(--border-glass, rgba(0, 240, 255, 0.3))',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
                color: 'var(--text-main, #0f172a)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Encabezado */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.35) 0%, rgba(10, 16, 32, 0.85) 100%)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: effectiveIsAprobado ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      border: `1.5px solid ${effectiveIsAprobado ? '#10b981' : '#ef4444'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {effectiveIsAprobado ? <ShieldCheck size={22} color="#10b981" /> : <ShieldAlert size={22} color="#ef4444" />}
                  </div>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading, #fff)' }}>
                      Auditoría & Aprobación de Crédito
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                      Control de solvencia y autorización de excepciones comerciales
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreditApprovalModal(false)}
                  className="btn btn-icon"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Contenido */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Resumen Cliente */}
                <div
                  style={{
                    background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Cliente Destinatario</div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeClientObj.nombre || activeClientObj.razonSocial}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>{activeClientObj.rif}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Plazo Comercial</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--motorven-gold, #f59e0b)' }}>{clientAgreedInfo.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Condición acordada en ficha</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Límite Otorgado</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--neon-cyan, #00f0ff)' }}>{formatUsd(activeClientObj.limiteCreditoUsd || 0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Saldo Deudor</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ef4444' }}>{formatUsd(activeClientObj.saldoDeudorUsd || 0)}</div>
                  </div>
                </div>

                {/* Selector / Cambio de Plazo para esta Orden dentro del Modal */}
                <div
                  style={{
                    background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Plazo de Crédito a Otorgar / Autorizar:
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span>Condición en Ficha (Referencia):</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--motorven-gold, #f59e0b)',
                          border: '1px solid rgba(245, 158, 11, 0.35)'
                        }}
                      >
                        {clientAgreedInfo.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '2px' }}>
                      Plazo O.C.:
                    </span>
                    {[
                      { key: '7_DIAS', label: '7 Días' },
                      { key: '15_DIAS', label: '15 Días' },
                      { key: '21_DIAS', label: '21 Días' },
                      { key: '30_DIAS', label: '30 Días' }
                    ].map(opt => {
                      const isSelected = paymentTerm === opt.key;
                      const isAgreed = clientAgreedInfo.termKey === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setPaymentTerm(opt.key)}
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: isSelected ? 800 : 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            background: isSelected
                              ? 'linear-gradient(135deg, var(--motorven-red, #dc2626), #b91c1c)'
                              : 'rgba(255, 255, 255, 0.05)',
                            color: isSelected ? '#fff' : 'var(--text-muted)',
                            border: isSelected
                              ? '1px solid var(--motorven-red, #dc2626)'
                              : isAgreed
                              ? '1px dashed var(--motorven-gold, #f59e0b)'
                              : '1px solid var(--border-glass)',
                            boxShadow: isSelected ? '0 2px 8px rgba(220, 38, 38, 0.3)' : 'none'
                          }}
                          title={isAgreed ? 'Condición acordada en la ficha del cliente' : ''}
                        >
                          {opt.label}
                          {isAgreed && <span style={{ marginLeft: '3px', color: isSelected ? '#fff' : 'var(--motorven-gold)' }}>★</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tarjeta de Diagnóstico */}
                <div
                  style={{
                    background: effectiveIsAprobado ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1.5px solid ${effectiveIsAprobado ? '#10b981' : '#ef4444'}`,
                    borderRadius: '12px',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: effectiveIsAprobado ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {effectiveIsAprobado ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      DIAGNÓSTICO COMERCIAL: {effectiveStatusLabel}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Filtros: Facturas / N.E. / Vencimientos
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    {effectiveMotivo}
                  </div>

                  {/* Tarjetas métricas de la regla */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px', fontSize: '0.72rem' }}>
                    <div style={{ background: clientCreditEvaluation.facturasVencidas?.length > 0 ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.05)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: clientCreditEvaluation.facturasVencidas?.length > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                        {clientCreditEvaluation.facturasVencidas?.length || 0}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Facturas Vencidas</div>
                    </div>

                    <div style={{ background: clientCreditEvaluation.notasEntregaVencidas?.length > 0 ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.05)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: clientCreditEvaluation.notasEntregaVencidas?.length > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                        {clientCreditEvaluation.notasEntregaVencidas?.length || 0}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>N.E. Vencidas</div>
                    </div>

                    <div style={{ background: clientCreditEvaluation.facturasPendientesCount > 2 ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.05)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: clientCreditEvaluation.facturasPendientesCount > 2 ? '#ef4444' : 'var(--text-primary)' }}>
                        {clientCreditEvaluation.facturasPendientesCount || 0}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Facturas Abiertas (Máx 2)</div>
                    </div>

                    <div style={{ background: clientCreditEvaluation.notasEntregaPendientesCount >= 2 ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.05)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: clientCreditEvaluation.notasEntregaPendientesCount >= 2 ? '#ef4444' : 'var(--text-primary)' }}>
                        {clientCreditEvaluation.notasEntregaPendientesCount || 0}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>N.E. Abiertas (Máx 1)</div>
                    </div>
                  </div>
                </div>

                {/* Listado de Documentos del Cliente */}
                {((clientCreditEvaluation.facturasPendientes?.length || 0) + (clientCreditEvaluation.notasEntregaPendientes?.length || 0)) > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Detalle de Documentos Abiertos en Cartera ({((clientCreditEvaluation.facturasPendientes?.length || 0) + (clientCreditEvaluation.notasEntregaPendientes?.length || 0))})
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textAlign: 'left' }}>
                            <th style={{ padding: '6px 8px' }}>N° Documento</th>
                            <th style={{ padding: '6px 8px' }}>Tipo</th>
                            <th style={{ padding: '6px 8px' }}>Emisión</th>
                            <th style={{ padding: '6px 8px' }}>Vence</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Saldo USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...(clientCreditEvaluation.facturasPendientes || []), ...(clientCreditEvaluation.notasEntregaPendientes || [])].map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '5px 8px', fontWeight: 700 }}>{d.numeroDoc || d.id}</td>
                              <td style={{ padding: '5px 8px' }}>{d.tipoDoc}</td>
                              <td style={{ padding: '5px 8px' }}>{d.fechaEmision ? new Date(d.fechaEmision).toLocaleDateString('es-VE') : 'N/A'}</td>
                              <td style={{ padding: '5px 8px' }}>{d.fechaVencimiento ? new Date(d.fechaVencimiento).toLocaleDateString('es-VE') : 'N/A'}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{formatUsd(d.saldoUsd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Formulario de Aprobación */}
                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--motorven-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={15} /> Protocolo de Aprobación Excepcional
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>
                        Autorizado por (Personal Autorizado en Configuración):
                      </label>
                      <span style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', fontWeight: 700 }}>
                        ✓ {authorizedApproverIds.size} de 7 con permiso
                      </span>
                    </div>
                    <select
                      className="form-control"
                      value={creditOverrideAuthorizer}
                      onChange={(e) => setCreditOverrideAuthorizer(e.target.value)}
                      style={{ fontSize: '0.8rem', width: '100%' }}
                    >
                      {approverGroups.length > 0 ? (
                        approverGroups.map(group => (
                          <optgroup key={group.category} label={`${group.icon} ${group.category}`}>
                            {group.people.map(person => (
                              <option key={person.id} value={person.id}>
                                ✓ {person.name} — {person.role}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      ) : (
                        <option value={creditOverrideAuthorizer}>
                          {creditOverrideAuthorizer}
                        </option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Motivo / Justificación de la Aprobación:
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={creditOverrideJustification}
                      onChange={(e) => setCreditOverrideJustification(e.target.value)}
                      placeholder="Indique el motivo de la excepción (Ej: Abono bancario en tránsito, acuerdo de pago semanal firmado, cliente estratégico)..."
                      style={{ fontSize: '0.8rem', width: '100%', resize: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Pie con Botones */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderTop: '1px solid var(--border-glass)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  background: 'rgba(0, 0, 0, 0.15)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreditApprovalModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem' }}
                >
                  Cerrar
                </button>

                {creditOverrideApproved ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCreditOverrideApproved(false);
                      setCreditOverrideJustification('');
                      setShowCreditApprovalModal(false);
                      setFeedbackMsg({
                        type: 'warning',
                        text: 'Aprobación excepcional revocada. El cliente vuelve a su estatus comercial NEGADO.'
                      });
                    }}
                    className="btn btn-sm"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      color: '#ef4444'
                    }}
                  >
                    Revocar Autorización
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (paymentTerm === 'CONTADO') {
                        setPaymentTerm('7_DIAS');
                      }
                      setCreditOverrideApproved(true);
                      setShowCreditApprovalModal(false);
                      setFeedbackMsg({
                        type: 'success',
                        text: `✅ ¡Crédito APROBADO por ${creditOverrideAuthorizer || 'Gerencia'}! La orden ahora se enviará directamente a Caja.`
                      });
                    }}
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <ShieldCheck size={16} />
                    <span>APROBAR Y LIBERAR CRÉDITO</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL ALERTA DE VENDEDOR FUERA DE SU ZONA CORRESPONDIENTE */}
        {zoneMismatchAlert && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              backgroundColor: 'rgba(5, 10, 24, 0.84)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
            onClick={() => setZoneMismatchAlert(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '500px',
                background: 'var(--bg-card, #0f172a)',
                border: '1.5px solid rgba(245, 158, 11, 0.55)',
                borderRadius: '16px',
                boxShadow: '0 24px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(245, 158, 11, 0.18)',
                overflow: 'hidden',
                color: 'var(--text-primary)'
              }}
            >
              {/* Cabecera */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(15, 23, 42, 0.96) 100%)',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid #f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f59e0b',
                      flexShrink: 0
                    }}
                  >
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      Alerta de Zona Comercial
                    </h3>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Sincronización de Vendedores & Zonas (Base de Datos)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setZoneMismatchAlert(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Cuerpo */}
              <div style={{ padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: '#fbbf24',
                    lineHeight: 1.45
                  }}
                >
                  ⚠️ Se está seleccionando al vendedor fuera de su zona correspondiente, ¿desea continuar?
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Vendedor / Asesor actual:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {zoneMismatchAlert.sellerName} {zoneMismatchAlert.sellerCode ? `(${zoneMismatchAlert.sellerCode})` : ''}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Zona habitual del vendedor:</span>
                    <strong style={{ color: 'var(--semaforo-verde, #10b981)' }}>
                      {zoneMismatchAlert.sellerZoneLabel}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px dashed var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nueva zona seleccionada:</span>
                    <strong style={{ color: 'var(--motorven-gold, #f59e0b)' }}>
                      {zoneMismatchAlert.newZoneLabel}
                    </strong>
                  </div>
                  {zoneMismatchAlert.zoneSellers && zoneMismatchAlert.zoneSellers.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Asesor(es) habitual(es) de Zona {zoneMismatchAlert.newZone}:</span>
                      <strong style={{ color: 'var(--neon-cyan, #00f0ff)' }}>
                        {zoneMismatchAlert.zoneSellers.map(s => `${s.venDes} (${s.coVen})`).join(', ')}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Opción Viceversa: Cambiar al vendedor titular de la nueva zona */}
                {zoneMismatchAlert.zoneSellers && zoneMismatchAlert.zoneSellers.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(0, 240, 255, 0.06)',
                      border: '1px solid rgba(0, 240, 255, 0.25)',
                      borderRadius: '10px',
                      padding: '0.75rem 0.9rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--neon-cyan, #00f0ff)' }}>
                      🔄 ¿Prefiere sincronizar automáticamente el vendedor de la Zona {zoneMismatchAlert.newZone}?
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {zoneMismatchAlert.zoneSellers.map(s => (
                        <button
                          key={s.coVen || s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSeller(sellerValue(s));
                            setSelectedZone(zoneMismatchAlert.newZone);
                            setOutOfZoneConfirmed(false);
                            setZoneMismatchAlert(null);
                          }}
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '5px 10px',
                            background: 'rgba(0, 240, 255, 0.14)',
                            border: '1px solid var(--neon-cyan, #00f0ff)',
                            color: 'var(--neon-cyan, #00f0ff)',
                            cursor: 'pointer'
                          }}
                        >
                          Cambiar a {s.venDes} ({s.coVen}) · Zona {zoneMismatchAlert.newZone}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pie con Botones */}
              <div
                style={{
                  padding: '0.9rem 1.25rem',
                  borderTop: '1px solid var(--border-glass)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  flexWrap: 'wrap',
                  background: 'rgba(0, 0, 0, 0.2)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoneMismatchAlert(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                >
                  No, mantener Zona {zoneMismatchAlert.sellerZone}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZone(zoneMismatchAlert.newZone);
                    setOutOfZoneConfirmed(true);
                    setZoneMismatchAlert(null);
                  }}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    color: '#0f172a',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                  }}
                >
                  Sí, continuar fuera de su zona
                </button>
              </div>
            </div>
          </div>
        )}

        </div>
    </section>
  );
}

