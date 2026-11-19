import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Info,
  Maximize2,
  RotateCcw,
  ReceiptText,
  Eye,
  Hash,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Save,
  Users,
  UserPlus
} from 'lucide-react';
import { formatUsd, formatBs, formatUnitVe, resolveProductUnit, resolveProductLitersPerUnit, getProductWarehouseStocks, validateWarehouseStockForDocument } from '../services/formatService';
import { getProductWholesalePrice, lineSubtotal } from '../services/pricingService';
import {
  resolveCreditDaysFromTerm,
  calculateExpirationDate,
  formatDateVe,
  isCreditPaymentCondition,
  decodeClientRequestMetadata,
  parseInvoiceDateInfo,
  formatInvoiceDateTimeDisplay,
  preserveDateWithTime,
  toLocalYmd,
  evaluateClientCreditPolicy,
  getAuthorizedApproverGroups,
  canUserGrantCreditOverride,
  getClientAgreedCreditInfo,
  isOrderReservationExpired
} from '../services/creditPolicyService';
import MotorvenLogo from './MotorvenLogo';
import OilstoneProductImage from './OilstoneProductImage';
import SalesInvoiceModal from './SalesInvoiceModal';
import { isMasterOrGerencia, isClientApproved, canApproveClients, canManageInvoices } from '../services/authService';
import {
  generateOrdersPDF,
  generateSellerOrderPDF,
  generateLetterInvoiceSeniatPDF,
  generateDeliveryNotePDF,
  generateSalesPOSPDF,
  resolveDeliveryNoteLineItems,
  pickPreferredLineItems
} from '../services/pdfReportService';
import { REAL_PROFIT_SELLERS, REAL_PROFIT_ZONES } from '../data/supabaseRealData';
import { calculateFiscalTaxes, getNextInvoiceCorrelativo, commitInvoiceCorrelativo, getNextNotaEntregaCorrelativo, commitNotaEntregaCorrelativo, setNotaEntregaCorrelativo, clearNotaEntregaCorrelativoForce, generateFiscalControlNumber, generateDeliveryNoteControlNumber, formatDocumentControlNumber, resolveControlNumberOnTipoDocChange, syncControlNumberOnCorrelativoEdit, resolveEditedInvoiceCollision, resetInvoiceCorrelativo, setInvoiceCorrelativo, SENIAT_CONTRIBUTOR_TYPES, resolveClientContributorType, computeContributorTypeCounts, getEraScopedCanonicalDocKey, isLegacyPreNovInvoice, recalculateEditableInvoiceAmounts } from '../services/fiscalService';
import { useNotification } from '../context/NotificationContext';
import CxcInvoiceCreationModal from './CxcInvoiceCreationModal';
import ClientsDirectoryModal from './ClientsDirectoryModal';
import { saveSupabaseProfitInvoice, saveSupabaseNotification, updateSupabaseInvoiceDocument, isCxcEntryDeleted, sanitizeCxcDeletedDocsStorage } from '../services/supabaseService';
import DatePeriodFilter from './DatePeriodFilter';
import { createDefaultDatePeriodFilter, isDatePeriodFilterActive, matchesDatePeriodFilter } from '../utils/dateRangeFilterUtils';

const normalizeSearchText = (val) =>
  String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

export { isOrderReservationExpired };

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
  onDeleteOrder,
  onDeleteSale,
  onSyncProfit,
  currentUser,
  initialTab = 'nuevo',
  initialOrder = null,
  onProceedToPOS,
  onSaveCxcDocument,
  onUpdateInvoiceDocument,
  onSaveClient,
  onDeleteClient,
  onApproveClient,
  onRejectClient
}) {
  const notify = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab || 'nuevo'); // 'nuevo' | 'pipeline' | 'facturar' | 'imprimir' | 'metricas' | 'solicitudes_clientes'
  const [clientReqFilter, setClientReqFilter] = useState('ALL'); // 'ALL' | 'PENDIENTE_APROBACION' | 'APROBADO' | 'RECHAZADO'
  const [clientReqOverrides, setClientReqOverrides] = useState({});
  const [rejectReasonByReqId, setRejectReasonByReqId] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(initialOrder || null);
  const [showClientsDirectoryModal, setShowClientsDirectoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceModalSale, setInvoiceModalSale] = useState(null);
  const [invoiceRenderLimit, setInvoiceRenderLimit] = useState(80);
  const [deliveryDocView, setDeliveryDocView] = useState('GUIA'); // 'GUIA' | 'FACTURA'

  // Modal para Cargar Facturas y Notas de Entrega Editables a Cobranzas (CxC)
  const [showCxcInvoiceModal, setShowCxcInvoiceModal] = useState(false);

  const handleSaveCxcInvoice = async (docPayload) => {
    if (onSaveCxcDocument) {
      return await onSaveCxcDocument(docPayload);
    }
    return await saveSupabaseProfitInvoice(docPayload);
  };

  // Estados para TAB 6: Listado de Facturas (List View)
  const [invoiceConditionFilter, setInvoiceConditionFilter] = useState('ALL'); // 'ALL' | 'CONTADO' | 'CREDITO'
  const [invoiceDocTypeFilter, setInvoiceDocTypeFilter] = useState('ALL'); // 'ALL' | 'FACTURA' | 'NOTA_ENTREGA'
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoicePeriodFilter, setInvoicePeriodFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'
  const [invoiceNumColFilter, setInvoiceNumColFilter] = useState('');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState(() => createDefaultDatePeriodFilter('EXACT'));
  const [invoiceClientColFilter, setInvoiceClientColFilter] = useState('');
  const [invoiceSellerColFilter, setInvoiceSellerColFilter] = useState('ALL');
  const [invoiceCondColFilter, setInvoiceCondColFilter] = useState('ALL');
  const [invoiceItemsColFilter, setInvoiceItemsColFilter] = useState('ALL'); // 'ALL' | 'MULTI' | 'WITH_LITERS'
  const [invoiceMinUsdFilter, setInvoiceMinUsdFilter] = useState('');
  const [invoiceMinBsFilter, setInvoiceMinBsFilter] = useState('');
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [invoiceSortField, setInvoiceSortField] = useState('fecha'); // 'factura' | 'fecha' | 'cliente' | 'rif' | 'vendedor' | 'condicion' | 'renglones' | 'totalUsd' | 'totalBs'
  const [invoiceSortDirection, setInvoiceSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleteConfirmKeyword, setDeleteConfirmKeyword] = useState('');
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);
  const [localDeletedInvoiceKeys, setLocalDeletedInvoiceKeys] = useState(() => new Map());
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isSavingEditedInvoice, setIsSavingEditedInvoice] = useState(false);
  const [editClientSearch, setEditClientSearch] = useState('');

  const handleResetInvoiceFilters = () => {
    setInvoiceConditionFilter('ALL');
    setInvoiceDocTypeFilter('ALL');
    setInvoiceSearchQuery('');
    setInvoicePeriodFilter('ALL');
    setInvoiceNumColFilter('');
    setInvoiceDateFilter(createDefaultDatePeriodFilter('EXACT'));
    setInvoiceClientColFilter('');
    setInvoiceSellerColFilter('ALL');
    setInvoiceCondColFilter('ALL');
    setInvoiceItemsColFilter('ALL');
    setInvoiceMinUsdFilter('');
    setInvoiceMinBsFilter('');
  };

  const handleInvoiceSort = (field) => {
    if (invoiceSortField === field) {
      setInvoiceSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setInvoiceSortField(field);
      setInvoiceSortDirection('desc');
    }
  };

  // Modal para Fijar Correlativo / N° Inicial (Factura Fiscal o Nota de Entrega) de forma manual
  const [showCorrelativoModal, setShowCorrelativoModal] = useState(false);
  const [correlativoModalType, setCorrelativoModalType] = useState('FACTURA'); // 'FACTURA' | 'NOTA_ENTREGA'
  const [customCorrelativoInput, setCustomCorrelativoInput] = useState('');
  const [correlativoRefreshKey, setCorrelativoRefreshKey] = useState(0);

  // Verificación de privilegios de edición y eliminación en el listado de facturas
  const isAdmin = useMemo(() => canManageInvoices(currentUser), [currentUser]);

  const userCanGrantCreditOverride = useMemo(
    () => canUserGrantCreditOverride(currentUser),
    [currentUser]
  );

  const userCanApproveClients = useMemo(
    () => canApproveClients(currentUser),
    [currentUser]
  );

  // Correlativo actual calculado para la próxima factura
  const currentNextCorrelativo = useMemo(() => {
    return getNextInvoiceCorrelativo(sales, profitInvoices);
  }, [sales, profitInvoices, correlativoRefreshKey]);

  // Correlativo actual calculado para la próxima Nota de Entrega
  const currentNextNeCorrelativo = useMemo(() => {
    return getNextNotaEntregaCorrelativo(sales, profitInvoices);
  }, [sales, profitInvoices, correlativoRefreshKey]);

  const handleOpenCorrelativoModal = (mode = 'FACTURA') => {
    const resolvedMode = mode === 'NOTA_ENTREGA' ? 'NOTA_ENTREGA' : 'FACTURA';
    setCorrelativoModalType(resolvedMode);
    setCustomCorrelativoInput(
      resolvedMode === 'NOTA_ENTREGA'
        ? currentNextNeCorrelativo.replace(/[^0-9]/g, '')
        : currentNextCorrelativo
    );
    setShowCorrelativoModal(true);
  };

  const handleResetAutoNeCorrelativo = () => {
    clearNotaEntregaCorrelativoForce();
    const freshNe = getNextNotaEntregaCorrelativo(sales, profitInvoices);
    setCustomCorrelativoInput(freshNe.replace(/[^0-9]/g, ''));
    setCorrelativoRefreshKey(k => k + 1);
    notify.success(`Correlativo de Nota de Entrega restaurado en automático (${freshNe})`);
  };

  const handleSaveCorrelativo = () => {
    const isNe = correlativoModalType === 'NOTA_ENTREGA';
    try {
      const cleanDigits = String(customCorrelativoInput || '').replace(/[^0-9]/g, '');
      const defaultNum = isNe ? 1 : 0;
      const num = cleanDigits === '' ? defaultNum : parseInt(cleanDigits, 10);
      const safeNum = Math.max(0, Math.min(999999, isNaN(num) ? defaultNum : num));
      const formatted = isNe
        ? setNotaEntregaCorrelativo(safeNum)
        : setInvoiceCorrelativo(safeNum);

      setCorrelativoRefreshKey(k => k + 1);
      setShowCorrelativoModal(false);

      if (isNe) {
        notify.success(`Próxima Nota de Entrega fijada en #${formatted}`);
        setFeedbackMsg({
          type: 'success',
          text: `✅ ¡Número de Nota de Entrega fijado exitosamente! La próxima Nota de Entrega a emitir será la ${formatted}.`
        });
      } else {
        notify.success(`Próximo número de factura fijado en #${formatted}`);
        setFeedbackMsg({
          type: 'success',
          text: `✅ ¡Número de factura fijado exitosamente! La próxima factura a emitir será la N° ${formatted}.`
        });
      }
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err) {
      const label = isNe ? 'Nota de Entrega' : 'número de factura';
      notify.error(`Error al fijar ${label}: ` + (err.message || 'Error desconocido'));
      setFeedbackMsg({
        type: 'error',
        text: `Error al fijar ${label}: ` + (err.message || 'Error desconocido')
      });
    }
  };

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  /**
   * Mapea los renglones de un pedido con su alícuota fiscal del inventario y calcula
   * los totales tributarios consistentes con processSupabaseSale.
   */
  const computeOrderBillingFiscal = (order, paymentMethod, tasa) => {
    const isOrdNE = isOrderNotaEntrega(order);
    const metodoResolved = paymentMethod === 'CREDITO'
      ? 'CREDITO'
      : (paymentMethod || order?.metodoPagoFactura || order?.metodoPago || 'EFECTIVO_USD');
    const isCredit =
      isCreditPaymentCondition(order?.condicionPago, metodoResolved) ||
      Number(order?.diasCredito || 0) > 0;
    const effectiveCondicion = paymentMethod === 'CREDITO' ? 'CREDITO' : (order?.condicionPago || 'CONTADO');
    const items = (order?.items || []).map((it, idx) => {
      const prod = (safeProducts || []).find(
        p => p && (p.id === it.articuloId || p.codigo === it.articuloId || p.codigo === it.codigo)
      );
      const cant = Number(it.cantidad || 1);
      const precio = Number(it.precioUnitarioUsd ?? it.precioUsd ?? 0);
      const subtotalUsd = Number(it.totalUsd ?? it.subtotalUsd ?? lineSubtotal(cant, precio));
      const aplicaIva = prod ? prod.aplicaIva !== false : it.aplicaIva !== false;
      const alicuota =
        it.tipoAlicuota && it.tipoAlicuota !== '16%'
          ? it.tipoAlicuota
          : (prod?.tipoAlicuota || (aplicaIva ? 'GENERAL_16' : 'EXENTO_0'));
      return {
        articuloId: it.articuloId || prod?.id || '',
        codigo: prod?.codigo || it.codigo || it.articuloId || `LUB-${idx + 1}`,
        descripcion: it.articuloDescripcion || it.descripcion || prod?.descripcion || 'Lubricante Automotriz Oilstone',
        cantidad: cant,
        precioUsd: precio,
        subtotalUsd,
        aplicaIva,
        tipoAlicuota: alicuota,
        litrosPorUnidad: Number(it.litrosUnitarios || (prod ? resolveProductLitersPerUnit(prod) : 0)),
        litros: it.litrosTotales || (cant * (it.litrosPorUnidad || 1))
      };
    });
    const taxes = calculateFiscalTaxes({
      items,
      tipoDoc: isOrdNE ? 'NOTA_ENTREGA' : 'FACTURA',
      metodoPago: isCredit && metodoResolved === 'CREDITO' ? 'CREDITO' : metodoResolved,
      condicionPago: isCredit ? 'CREDITO' : 'CONTADO',
      tasaBcv: Number(tasa) || tasaBcv,
      // La factura no se cobra al momento de emitirse (pasa a CxC), por lo que no aplica IGTF en emisión
      esSujetoPasivoEspecial: false,
      porcentajeIgtf: 0
    });
    return { isOrdNE, isCredit, effectiveCondicion, metodoResolved, items, taxes };
  };

  const buildSaleDocFromOrder = (order, cfg, tasa) => {
    if (!order) return null;
    const cfgTasa = Number(order.tasaDolar || cfg?.tasaDolar || tasa) || 827.73;
    const { isOrdNE: isOrdNe, isCredit, metodoResolved: metodoPagoResolved, items, taxes } =
      computeOrderBillingFiscal(order, order.metodoPagoFactura || order.metodoPago, cfgTasa);

    let baseUsd = 0;
    let ivaUsd = 0;
    let igtfUsd = 0;
    let totUsd = Number(order.totalNetoUsd || order.totalUsd || 0);
    if (isOrdNe) {
      baseUsd = totUsd;
    } else if (Number(order.ivaUsd || 0) > 0 && Number(order.totalBrutoUsd || 0) > 0) {
      baseUsd = Number(order.totalBrutoUsd);
      ivaUsd = Number(order.ivaUsd);
      igtfUsd = Number(order.igtfUsd || 0);
      totUsd = Number(order.totalNetoUsd || order.totalUsd || (baseUsd + ivaUsd + igtfUsd));
    } else {
      baseUsd = taxes.subtotalNetoUsd;
      ivaUsd = taxes.totalIvaUsd;
      igtfUsd = taxes.igtfUsd;
      totUsd = taxes.totalFacturaUsd;
    }
    const totBs = Number((totUsd * cfgTasa).toFixed(2));
    const baseBs = Number((baseUsd * cfgTasa).toFixed(2));
    const ivaBs = Number((ivaUsd * cfgTasa).toFixed(2));
    const igtfBs = Number((igtfUsd * cfgTasa).toFixed(2));

    const correlativo = String(order.nroFactura || order.numeroDoc || '000000').replace(/[^0-9]/g, '').slice(-6).padStart(6, '0') || '000000';
    const docNum = isOrdNe ? `NE-${correlativo}` : correlativo;

    return {
      id: docNum,
      numeroDoc: docNum,
      numeroControl: order.nroControl || generateFiscalControlNumber(parseInt(correlativo, 10) || 1),
      tipoDoc: isOrdNe ? 'NOTA_ENTREGA' : 'FACTURA',
      clienteId: order.clienteId || 'CLI-001',
      clienteNombre: order.clienteNombre || 'Cliente General',
      clienteRif: order.clienteRif || 'J-00000000',
      clienteDireccion: order.direccionEntrega || order.clienteDireccion || '',
      fechaEmision: order.fechaFactura || order.fecha || new Date().toISOString(),
      fechaVencimiento: order.fechaVencimiento || (isCredit ? calculateExpirationDate(order.fechaFactura || new Date(), resolveCreditDaysFromTerm(order.condicionPago, 15, order.diasCredito)) : new Date().toISOString()),
      condicionPago: order.condicionPago || (isCredit ? 'CREDITO' : 'CONTADO'),
      diasCredito: isCredit ? resolveCreditDaysFromTerm(order.condicionPago, 15, order.diasCredito) : 0,
      metodoPago: metodoPagoResolved,
      tasaDolar: cfgTasa,
      items,
      subtotalUsd: baseUsd,
      baseGeneralUsd: baseUsd,
      baseGeneralBs: baseBs,
      ivaUsd,
      ivaGeneralUsd: ivaUsd,
      ivaGeneralBs: ivaBs,
      igtfUsd,
      igtfBs,
      totalUsd: totUsd,
      totalBs: totBs,
      saldoUsd: Number(order.saldoUsd ?? totUsd),
      saldoBs: Number(order.saldoUsd !== undefined ? Number(order.saldoUsd) * cfgTasa : totBs),
      estado: Number(order.saldoUsd ?? totUsd) <= 0.01 ? 'PAGADO' : 'PENDIENTE',
      vendedor: order.vendedorId || 'Asesor Comercial'
    };
  };

  const handleOpenInvoiceModalForOrder = (order) => {
    if (!order) return;
    const existingSale = (sales || []).find(s =>
      s.numeroDoc === order.nroFactura ||
      s.id === order.nroFactura ||
      s.pedidoOrigenId === order.id ||
      s.pedidoOrigenDoc === order.numeroDoc ||
      s.orderId === order.id
    );
    const saleDoc = existingSale || buildSaleDocFromOrder(order, config, tasaBcv);
    setInvoiceModalSale(saleDoc);
    setShowInvoiceModal(true);
  };

  const rawSafeOrders = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const isClientRequestOrder = (o) => Boolean(o && String(o.tipoDoc || o.tipo_doc || '').toUpperCase() === 'SOLICITUD_CLIENTE');
  const safeOrders = useMemo(() => rawSafeOrders.filter((o) => o && !isClientRequestOrder(o)), [rawSafeOrders]);
  const rawClientRequestOrders = useMemo(() => rawSafeOrders.filter(isClientRequestOrder), [rawSafeOrders]);
  const clientRequests = useMemo(
    () =>
      rawClientRequestOrders
        .map((o) => ({ raw: o, ...decodeClientRequestMetadata(o) }))
        .sort((a, b) => String(b.fechaSolicitud || '').localeCompare(String(a.fechaSolicitud || ''))),
    [rawClientRequestOrders]
  );
  const pendingClientRequestsCount = useMemo(
    () => clientRequests.filter((r) => r.status === 'PENDIENTE_APROBACION').length,
    [clientRequests]
  );
  const filteredClientRequests = useMemo(() => {
    const term = normalizeSearchText(searchQuery);
    const rifTerm = term.replace(/[^a-z0-9]/g, '');
    return clientRequests.filter((r) => {
      if (clientReqFilter !== 'ALL' && r.status !== clientReqFilter) return false;
      if (!term) return true;
      return [r.nombre, r.rif, r.solicitudDoc, r.vendedorNombre, r.zonaNombre, r.telefono]
        .some((v) => {
          if (!v) return false;
          const norm = normalizeSearchText(v);
          return norm.includes(term) || (rifTerm && norm.replace(/[^a-z0-9]/g, '').includes(rifTerm));
        });
    });
  }, [clientRequests, clientReqFilter, searchQuery]);

  const handleApproveClientRequest = async (reqItem) => {
    if (!reqItem || !reqItem.raw) return;
    if (!userCanApproveClients) {
      notify.error('No posee permisos autorizados para aprobar solicitudes de nuevos clientes.');
      return;
    }
    const ov = clientReqOverrides[reqItem.id] || {};
    const finalCodigo = String(ov.codigo || `CLI-${Date.now().toString().slice(-6)}`).trim().toUpperCase();
    const finalLimite = Number(ov.limiteCreditoUsd ?? reqItem.limiteCreditoUsd ?? 0);
    const finalDias = Number(ov.diasCredito ?? reqItem.diasCredito ?? 0);
    const approverName = currentUser?.nombre || currentUser?.username || 'Flujo Comercial / Gerencia';
    const nowIso = new Date().toISOString();

    const newClientPayload = {
      id: finalCodigo,
      codigo: finalCodigo,
      nombre: reqItem.nombre,
      rif: String(reqItem.rif || '').trim().toUpperCase(),
      telefono: reqItem.telefono || '',
      email: reqItem.email || '',
      direccion: reqItem.direccion || 'Valencia, Edo. Carabobo',
      ciudad: reqItem.ciudad || '',
      estado: reqItem.estado || '',
      responsable: reqItem.responsable || '',
      tipoCliente: reqItem.tipoCliente || 'Mayorista',
      zonaVenta: reqItem.zonaVenta || '01',
      vendedorAsignado: reqItem.vendedorAsignado || 'OF',
      limiteCreditoUsd: finalLimite,
      diasCredito: finalDias,
      saldoDeudorUsd: 0,
      esContribuyente: reqItem.esContribuyente !== false,
      esContribuyenteEspecial: Boolean(reqItem.esContribuyenteEspecial),
      inactivo: false,
      sinCredito: finalDias <= 0 && finalLimite <= 0,
      fechaRegistro: nowIso.slice(0, 10),
      comentarios: `Aprobado desde Flujo Comercial (${reqItem.solicitudDoc}) por ${approverName}. ${reqItem.notasVendedor || ''}`.trim()
    };

    setIsSaving(true);
    try {
      if (onSaveClient) {
        await onSaveClient(newClientPayload);
      }
      if (onSaveOrder) {
        await onSaveOrder({
          ...reqItem.raw,
          status: 'APROBADO',
          estado: 'APROBADO',
          aprobadoPor: approverName,
          fechaAprobacion: nowIso,
          diasCredito: finalDias,
          totalUsd: finalLimite,
          totalNetoUsd: finalLimite
        });
      } else if (onUpdateOrderStatus) {
        await onUpdateOrderStatus(reqItem.id, 'APROBADO');
      }
      await saveSupabaseNotification({
        id: `notif_cli_ok_${reqItem.id}`,
        tipo: 'sistema',
        severidad: 'exito',
        modulo: 'pedidos',
        titulo: `Cliente Aprobado: ${reqItem.nombre} (${reqItem.rif})`,
        mensaje: `${approverName} aprobó la solicitud ${reqItem.solicitudDoc}. El cliente ya está activo en la cartera comercial (Cód: ${finalCodigo}).`,
        destinatario_rol: 'VENTAS',
        destinatario_usuario: reqItem.vendedorAsignado || 'ALL',
        origen: 'FLUJO_COMERCIAL'
      }).catch(() => {});
      notify.success(`Cliente "${reqItem.nombre}" aprobado e incorporado a la cartera comercial (Cód: ${finalCodigo}).`);
    } catch (err) {
      console.error('Error aprobando solicitud de cliente:', err);
      notify.error('Error al aprobar el nuevo cliente: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectClientRequest = async (reqItem) => {
    if (!reqItem || !reqItem.raw) return;
    if (!userCanApproveClients) {
      notify.error('No posee permisos autorizados para rechazar solicitudes de nuevos clientes.');
      return;
    }
    const reason = String(rejectReasonByReqId[reqItem.id] || '').trim() || 'Rechazado por revisión comercial / documentación incompleta.';
    const reviewerName = currentUser?.nombre || currentUser?.username || 'Flujo Comercial / Gerencia';
    const nowIso = new Date().toISOString();

    setIsSaving(true);
    try {
      if (onSaveOrder) {
        await onSaveOrder({
          ...reqItem.raw,
          status: 'RECHAZADO',
          estado: 'RECHAZADO',
          aprobadoPor: reviewerName,
          fechaAprobacion: nowIso,
          motivoRechazo: reason
        });
      } else if (onUpdateOrderStatus) {
        await onUpdateOrderStatus(reqItem.id, 'RECHAZADO');
      }
      await saveSupabaseNotification({
        id: `notif_cli_rej_${reqItem.id}`,
        tipo: 'sistema',
        severidad: 'advertencia',
        modulo: 'pedidos',
        titulo: `Solicitud de Cliente Rechazada: ${reqItem.nombre}`,
        mensaje: `${reviewerName} rechazó la solicitud ${reqItem.solicitudDoc}. Motivo: ${reason}`,
        destinatario_rol: 'VENTAS',
        destinatario_usuario: reqItem.vendedorAsignado || 'ALL',
        origen: 'FLUJO_COMERCIAL'
      }).catch(() => {});
      notify.warning(`Solicitud ${reqItem.solicitudDoc} marcada como RECHAZADA.`);
    } catch (err) {
      console.error('Error rechazando solicitud de cliente:', err);
      notify.error('Error al rechazar la solicitud.');
    } finally {
      setIsSaving(false);
    }
  };

  const safeClients = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  // Búsqueda tolerante de producto (id / código / co_art como string)
  const findProductById = (value) => {
    const key = String(value ?? '').trim();
    if (!key) return null;
    return safeProducts.find(
      p => p && (String(p.id ?? '').trim() === key || String(p.codigo ?? '').trim() === key || String(p.co_art ?? '').trim() === key)
    ) || null;
  };

  // Precio mayorista con cadena completa de respaldo (nunca devuelve 0 si existe algún precio)
  // Delegado al servicio central de precios para garantizar paridad con POS y Pipeline.
  const resolveProductWholesalePrice = (prod) => getProductWholesalePrice(prod);

  // ---- Filtro de tipos de lubricantes (Renglones) ----
  const getLubricantType = (p) =>
    String(p?.linea_descripcion || p?.lineaDescripcion || p?.categoria || 'OTROS').trim().toUpperCase();
  const getLubricantPresentation = (p) => {
    const m = String(p?.descripcion || p?.nombre || '').match(/\(([^)]+)\)\s*$/);
    const raw = m ? m[1] : (p?.unidad || '');
    const s = String(raw).trim().toUpperCase();
    if (s === 'LT' || s === 'LITRO' || s === 'LITROS') return 'LITRO';
    if (s === 'PL') return 'PAILA';
    return s || 'OTRO';
  };
  const [lubTypeFilter, setLubTypeFilter] = useState('ALL');
  const [lubPresentationFilter, setLubPresentationFilter] = useState('ALL');
  const [lubSearchText, setLubSearchText] = useState('');
  const lubTypeOptions = useMemo(() => {
    const counts = new Map();
    safeProducts.forEach(p => { if (p) counts.set(getLubricantType(p), (counts.get(getLubricantType(p)) || 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeProducts]);
  const lubPresentationOptions = useMemo(() => {
    const counts = new Map();
    safeProducts.forEach(p => {
      if (!p) return;
      if (lubTypeFilter !== 'ALL' && getLubricantType(p) !== lubTypeFilter) return;
      const k = getLubricantPresentation(p);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeProducts, lubTypeFilter]);
  const filteredLubricants = useMemo(() => {
    const term = lubSearchText.trim().toLowerCase();
    return safeProducts.filter(p => {
      if (!p) return false;
      if (lubTypeFilter !== 'ALL' && getLubricantType(p) !== lubTypeFilter) return false;
      if (lubPresentationFilter !== 'ALL' && getLubricantPresentation(p) !== lubPresentationFilter) return false;
      if (term) {
        const hay = `${p.codigo || ''} ${p.descripcion || ''} ${p.nombre || ''} ${p.viscosidad || ''} ${p.categoria || ''} ${p.linea_descripcion || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeProducts, lubTypeFilter, lubPresentationFilter, lubSearchText]);
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
  const approvedClients = useMemo(
    () => safeClients.filter(c => c && isClientApproved(c)),
    [safeClients]
  );
  const clientContributorCounts = useMemo(
    () => computeContributorTypeCounts(approvedClients),
    [approvedClients]
  );
  const selectedContributorTypeMeta = useMemo(
    () => SENIAT_CONTRIBUTOR_TYPES.find(t => t.code === clientTypeFilter) || null,
    [clientTypeFilter]
  );
  const filteredClients = useMemo(() => {
    const q = clientSearchText.trim().toLowerCase();
    return approvedClients.filter(c => {
      if (!c) return false;
      const contribCode = resolveClientContributorType(c);
      if (clientTypeFilter !== 'ALL' && contribCode !== clientTypeFilter) return false;
      if (!q) return true;
      return [c.codigo, c.id, c.nombre, c.razonSocial, c.rif].some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [approvedClients, clientSearchText, clientTypeFilter]);
  const [modalidadVenta, setModalidadVenta] = useState('PREVENTA'); // 'PREVENTA' | 'OFICINA'
  const [selectedSeller, setSelectedSeller] = useState(currentUser?.nombre || 'Vendedor Directo');
  const [selectedZone, setSelectedZone] = useState('01');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('CONTADO'); // 'CONTADO' | '7_DIAS' | '15_DIAS' | '21_DIAS' | '30_DIAS'
  const lastSyncedClientIdRef = useRef('');
  const hasManualPaymentTermRef = useRef(false);
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

  // Cálculo de Fecha de Emisión y Fecha de Vencimiento (= Fecha Emisión + Días de Crédito)
  const diasCreditoForm = useMemo(
    () => resolveCreditDaysFromTerm(paymentTerm, activeClientObj?.diasCredito ?? 15),
    [paymentTerm, activeClientObj]
  );
  const fechaEmisionForm = useMemo(() => new Date(), [paymentTerm, selectedClientId, orderRows.length]);
  const fechaVencimientoForm = useMemo(
    () => calculateExpirationDate(fechaEmisionForm, diasCreditoForm),
    [fechaEmisionForm, diasCreditoForm]
  );

  const formOrderSubtotalUsd = useMemo(() => {
    return (orderRows || []).reduce((acc, row) => {
      if (!row?.articuloId || !(Number(row.cantidad) > 0)) return acc;
      const prod = findProductById(row.articuloId);
      const price = Number(row.precioUsd) > 0 ? Number(row.precioUsd) : resolveProductWholesalePrice(prod);
      return acc + lineSubtotal(Number(row.cantidad) || 0, price);
    }, 0);
  }, [orderRows, safeProducts]);

  // Evaluación de Estatus de Crédito Comercial centralizada (prefiltrando docs del cliente en O(N) una vez)
  const activeClientCreditDocs = useMemo(() => {
    if (!activeClientObj) return { invoices: [], sales: [] };
    const cRif = String(activeClientObj.rif || '').trim().toUpperCase();
    const cId = String(activeClientObj.id || '').trim();
    const cCod = String(activeClientObj.codigo || '').trim();
    const cNom = String(activeClientObj.nombre || activeClientObj.razonSocial || '').trim().toLowerCase();
    const matchesClient = (d) => {
      if (!d) return false;
      const dRif = String(d.clienteRif || d.rif || d.cliente_rif || '').trim().toUpperCase();
      if (cRif && dRif && dRif === cRif) return true;
      const dId = String(d.clienteId || d.cliente_id || d.id || '').trim();
      if (cId && dId && dId === cId) return true;
      if (cCod && dId && dId === cCod) return true;
      const dNom = String(d.clienteNombre || d.cliente_nombre || d.nombre || '').trim().toLowerCase();
      return Boolean(cNom && dNom && dNom === cNom);
    };
    return {
      invoices: (profitInvoices || []).filter(matchesClient),
      sales: (sales || []).filter(matchesClient)
    };
  }, [activeClientObj, profitInvoices, sales]);

  const clientCreditEvaluation = useMemo(
    () =>
      evaluateClientCreditPolicy({
        client: activeClientObj,
        profitInvoices: activeClientCreditDocs.invoices,
        sales: activeClientCreditDocs.sales,
        tasaBcv,
        montoOrdenUsd: formOrderSubtotalUsd
      }),
    [activeClientObj, activeClientCreditDocs, tasaBcv, formOrderSubtotalUsd]
  );

  const [showCreditApprovalModal, setShowCreditApprovalModal] = useState(false);
  const [creditOverrideApproved, setCreditOverrideApproved] = useState(false);

  // Lista e índice jerárquico de personal autorizado para aprobar créditos desde Configuración
  const { authorizedApproverIds, approverGroups } = useMemo(
    () => getAuthorizedApproverGroups(config),
    [config]
  );

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
        ? (!clientCreditEvaluation.isAprobado
            ? `${clientCreditEvaluation.motivo} Además, el plazo a 30 Días siempre requiere aprobación obligatoria de Gerencia.`
            : 'Política Comercial Estricta: Todo crédito a 30 Días requiere obligatoriamente solicitar y obtener aprobación de Gerencia.')
        : clientCreditEvaluation.motivo);

  // Condición comercial acordada / actual del cliente en su ficha
  const clientAgreedInfo = useMemo(
    () => getClientAgreedCreditInfo(activeClientObj),
    [activeClientObj]
  );

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

  // Actualizar dirección, zona, vendedor asignado y plazo comercial automáticamente solo cuando cambia el cliente seleccionado
  // (evita que refrescos en tiempo real de syncedClients sobrescriban el plazo elegido por el usuario).
  useEffect(() => {
    if (!selectedClientId) {
      lastSyncedClientIdRef.current = '';
      hasManualPaymentTermRef.current = false;
      return;
    }
    if (!activeClientObj) return;
    if (lastSyncedClientIdRef.current === selectedClientId) return;

    const hadPreviousClient = Boolean(lastSyncedClientIdRef.current);
    lastSyncedClientIdRef.current = selectedClientId;

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

    if (hadPreviousClient || !hasManualPaymentTermRef.current) {
      setPaymentTerm(clientAgreedInfo.termKey);
      hasManualPaymentTermRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId, activeClientObj, clientAgreedInfo]);

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
        const litUnit = Number(row.litrosUnitarios || (prod ? resolveProductLitersPerUnit(prod) : 11.35));
        const price = Number(row.precioUsd) > 0 ? Number(row.precioUsd) : resolveProductWholesalePrice(prod);

        totalLitros += cant * litUnit;
        if ((row.unidad || '').toUpperCase().includes('CAJA')) {
          totalCajas += cant;
        }
        subtotalUsd += lineSubtotal(cant, price);
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

  const tab1WarehouseCheck = useMemo(() => {
    const selectedRows = orderRows.filter(r => r.articuloId);
    const activeWhCode = modalidadVenta === 'OFICINA' ? '02' : '01';
    if (selectedRows.length === 0) {
      return {
        isValid: true,
        zeroStockItems: [],
        invalidQtyItems: [],
        warehouseCode: activeWhCode,
        message: ''
      };
    }
    return validateWarehouseStockForDocument({
      items: selectedRows,
      products: safeProducts,
      tipoDoc: modalidadVenta === 'OFICINA' ? 'NOTA_ENTREGA' : 'FACTURA',
      almacen: activeWhCode,
      modalidadVenta
    });
  }, [orderRows, safeProducts, modalidadVenta]);

  // Manejo de renglones de pedido
  const handleAddRow = () => {
    setOrderRows(prev => [
      ...prev,
      { articuloId: '', cantidad: 1, precioUsd: 0, unidad: 'Caja', litrosUnitarios: 11.35 }
    ]);
  };

  const handleRemoveRow = (index) => {
    if (orderRows.length <= 1) return;
    setOrderRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index, field, value) => {
    if (field === 'articuloId' && value) {
      const prod = findProductById(value);
      if (prod) {
        const activeWhCode = modalidadVenta === 'OFICINA' ? '02' : '01';
        const pStocks = getProductWarehouseStocks(prod);
        const activeStock = activeWhCode === '02' ? pStocks.stock02 : pStocks.stock01;
        if (!(activeStock > 0)) {
          const msg = `No se puede cargar ${prod.codigo || prod.descripcion || value}: existencia en 0 en Almacén ${activeWhCode}.`;
          notify?.warning?.(msg);
          setFeedbackMsg({ type: 'error', text: msg });
          return;
        }
      }
    }

    setOrderRows(prev => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === 'articuloId') {
        const prod = findProductById(value);
        if (prod) {
          target.precioUsd = resolveProductWholesalePrice(prod);
          target.unidad = resolveProductUnit(prod, 'Caja');
          target.litrosUnitarios = resolveProductLitersPerUnit(prod);
        }
      }

      updated[index] = target;
      return updated;
    });
  };

  // Guardar / Emitir Nota de Pedido (Vendedor / Oficina)
  const handleSaveOrderForm = async (targetStatus = 'APROBADO', autoPrintPDF = false, sendToPOSDirectly = false) => {
    if (!selectedClientId && !clientSearchText) {
      setFeedbackMsg({ type: 'error', text: 'Debe seleccionar o indicar un cliente destinatario.' });
      return;
    }

    const validRows = orderRows.filter(r => r.articuloId && r.cantidad > 0);
    if (validRows.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Debe agregar al menos un lubricante con cantidad válida.' });
      return;
    }

    const orderWarehouseCheck = validateWarehouseStockForDocument({
      items: validRows,
      products: safeProducts,
      tipoDoc: modalidadVenta === 'OFICINA' ? 'NOTA_ENTREGA' : 'FACTURA',
      almacen: modalidadVenta === 'OFICINA' ? '02' : '01',
      modalidadVenta
    });
    if (!orderWarehouseCheck.isValid) {
      setFeedbackMsg({ type: 'error', text: orderWarehouseCheck.message });
      notify?.error?.(orderWarehouseCheck.message);
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
      const isNotaEntrega = modalidadVenta === 'OFICINA';
      const prefix = isNotaEntrega ? 'PED-NE' : 'PED-FF';
      const orderId = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const clientName = activeClientObj?.nombre || activeClientObj?.razonSocial || clientSearchText || 'Cliente General';
      const clientRif = activeClientObj?.rif || 'J-000000000';

      const itemsFormatted = validRows.map((row, idx) => {
        const prod = findProductById(row.articuloId);
        const cant = Number(row.cantidad) || 1;
        const litUnit = Number(row.litrosUnitarios || (prod ? resolveProductLitersPerUnit(prod) : 11.35));
        const price = Number(row.precioUsd) > 0 ? Number(row.precioUsd) : resolveProductWholesalePrice(prod);
        const aplicaIva = prod ? prod.aplicaIva !== false : true;
        const tipoAlicuota = prod?.tipoAlicuota || (aplicaIva ? 'GENERAL_16' : 'EXENTO_0');
        const subUsd = lineSubtotal(cant, price);

        return {
          id: `${orderId}-${idx + 1}`,
          orderId,
          rengNum: idx + 1,
          articuloId: row.articuloId,
          articuloDescripcion: prod?.descripcion || prod?.nombre || row.articuloId,
          unidadVenta: resolveProductUnit(row.unidad || prod?.unidad, 'Caja'),
          cantidad: cant,
          litrosUnitarios: litUnit,
          litrosTotales: cant * litUnit,
          precioUnitarioUsd: price,
          precioUsd: price,
          subtotalUsd: subUsd,
          totalUsd: subUsd,
          aplicaIva,
          tipoAlicuota
        };
      });

      const effectiveOverride = Boolean(creditOverrideApproved && userCanGrantCreditOverride);
      const effectiveIsCreditNegado = Boolean(
        paymentTerm !== 'CONTADO' && (!clientCreditEvaluation?.evaluado || (!effectiveOverride && (!clientCreditEvaluation.isAprobado || isTermRequiresMandatoryApproval)))
      );

      let finalStatus = targetStatus;
      if (effectiveIsCreditNegado && targetStatus === 'APROBADO') {
        finalStatus = 'RETENIDO_CREDITO';
      }

      const orderTaxes = calculateFiscalTaxes({
        items: itemsFormatted,
        tipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
        metodoPago: paymentTerm === 'CONTADO' ? 'EFECTIVO_USD' : 'CREDITO',
        condicionPago: paymentTerm === 'CONTADO' ? 'CONTADO' : 'CREDITO',
        tasaBcv,
        // No calcular IGTF en generación de pedido/factura (el cobro se gestiona en CxC)
        esSujetoPasivoEspecial: false,
        porcentajeIgtf: 0
      });

      const nowIso = new Date().toISOString();
      const expIso = calculateExpirationDate(nowIso, diasCreditoForm).toISOString();

      const orderPayload = {
        id: orderId,
        numeroDoc: orderId,
        correlativo: orderId,
        tipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
        tipo_doc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
        almacen: isNotaEntrega ? '02' : '01',
        almacenId: isNotaEntrega ? '02' : '01',
        almacen_id: isNotaEntrega ? '02' : '01',
        co_alma: isNotaEntrega ? '02' : '01',
        almacenNombre: isNotaEntrega ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)',
        modalidadVenta,
        fechaEmision: nowIso,
        diasCredito: diasCreditoForm,
        fechaVencimiento: expIso,
        clienteId: activeClientObj?.id || activeClientObj?.codigo || selectedClientId || 'CLI-001',
        clienteNombre: clientName,
        clienteRif: clientRif,
        vendedorId: selectedSeller,
        zonaVenta: selectedZone,
        condicionPago: paymentTerm,
        creditOverrideApproved: effectiveOverride,
        creditOverrideAuthorizer: effectiveOverride ? creditOverrideAuthorizer : null,
        creditOverrideJustification: effectiveOverride ? creditOverrideJustification : null,
        totalBrutoUsd: orderTaxes.subtotalNetoUsd,
        ivaUsd: isNotaEntrega ? 0 : orderTaxes.totalIvaUsd,
        totalNetoUsd: isNotaEntrega ? orderTaxes.subtotalNetoUsd : Number((orderTaxes.subtotalNetoUsd + orderTaxes.totalIvaUsd).toFixed(2)),
        totalLitros: newOrderCalculations.totalLitros,
        totalCajas: newOrderCalculations.totalCajas,
        totalItems: itemsFormatted.length,
        status: finalStatus,
        direccionEntrega: deliveryAddress,
        observaciones: orderNotes,
        comentarios: effectiveOverride
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
      } else if (finalStatus === 'PENDIENTE') {
        setFeedbackMsg({
          type: 'info',
          text: `📝 Borrador ${orderId} guardado en Pipeline (${isNotaEntrega ? 'Nota de Entrega' : 'Factura Fiscal'}). Aún no ha sido enviado a Caja.`
        });
      } else {
        setFeedbackMsg({
          type: 'success',
          text: `¡Nota de Pedido ${orderId} (${paymentTerm === 'CONTADO' ? 'CONTADO' : 'CRÉDITO APROBADO'}) emitida exitosamente! Enviada a Caja para facturación.`
        });
      }

      // Resetear formulario
      lastSyncedClientIdRef.current = '';
      hasManualPaymentTermRef.current = false;
      setSelectedClientId('');
      setClientSearchText('');
      setDeliveryAddress('');
      setPaymentTerm('CONTADO');
      setOrderNotes('');
      setOrderRows([{ articuloId: '', cantidad: 1, precioUsd: 0, unidad: 'Caja (12L)', litrosUnitarios: 11.35 }]);
      setSelectedOrder(orderPayload);

      if (sendToPOSDirectly && finalStatus === 'APROBADO' && onProceedToPOS) {
        onProceedToPOS(orderPayload);
        return;
      }

      setTimeout(() => {
        setFeedbackMsg(null);
        setActiveTab(isNotaEntrega ? 'pedidos_nota_entrega' : 'pipeline');
      }, 1500);

    } catch (err) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: 'Error emitiendo nota de pedido: ' + (err.message || 'Error desconocido') });
    } finally {
      setIsSaving(false);
    }
  };

  // Clasificación de Pedidos: Factura Fiscal (Almacén 01) vs Nota de Entrega (Almacén 02)
  const isOrderNotaEntrega = (ord) => {
    if (!ord) return false;
    const num = String(ord.numeroDoc || ord.id || ord.correlativo || '').toUpperCase().trim();
    if (num.startsWith('PED-NE') || num.startsWith('NE-') || num.startsWith('NOTA-')) return true;
    if (num.startsWith('PED-FF') || num.startsWith('FACT-') || num.startsWith('FF-')) return false;
    if (ord.tipoDoc === 'NOTA_ENTREGA' || ord.tipo_doc === 'NOTA_ENTREGA') return true;
    if (ord.tipoDoc === 'FACTURA' || ord.tipo_doc === 'FACTURA') return false;
    if (ord.almacen === '02' || ord.almacen_id === '02' || ord.co_alma === '02') return true;
    if (ord.almacen === '01' || ord.almacen_id === '01' || ord.co_alma === '01') return false;
    if (ord.modalidadVenta === 'OFICINA') return true;
    return false;
  };

  const isOrderFiscal = (ord) => !isOrderNotaEntrega(ord);

  // Función utilitaria para calcular KPIs de cualquier grupo de pedidos
  const computeOrderKpis = (orderList) => {
    let preventas = 0;
    let aprobados = 0;
    let enTransito = 0;
    let facturados = 0;
    let retenidos = 0;
    let anulados = 0;
    let validCount = 0;
    let totalLitros = 0;
    let totalUsd = 0;

    orderList.forEach(o => {
      if (!o) return;
      const st = String(o.status || 'PENDIENTE').toUpperCase();
      if (st === 'ANULADO' || st === 'ANULADA' || st === 'RECHAZADO') {
        anulados++;
        return;
      }
      validCount++;
      if (st === 'PENDIENTE') preventas++;
      else if (st === 'APROBADO') aprobados++;
      else if (st === 'EN_TRANSITO') enTransito++;
      else if (st === 'FACTURADO') facturados++;
      else if (st === 'RETENIDO_CREDITO') retenidos++;

      totalLitros += Number(o.totalLitros || 0);
      totalUsd += Number(o.totalNetoUsd || o.totalUsd || 0);
    });

    return {
      total: validCount,
      preventas,
      aprobados,
      enTransito,
      facturados,
      retenidos,
      anulados,
      totalLitros,
      totalUsd,
      activeCount: preventas + aprobados + enTransito + retenidos
    };
  };

  // Listas divididas
  const fiscalOrders = useMemo(() => safeOrders.filter(isOrderFiscal), [safeOrders]);
  const notaEntregaOrders = useMemo(() => safeOrders.filter(isOrderNotaEntrega), [safeOrders]);

  // KPIs por módulo
  const fiscalKpis = useMemo(() => computeOrderKpis(fiscalOrders), [fiscalOrders]);
  const notaEntregaKpis = useMemo(() => computeOrderKpis(notaEntregaOrders), [notaEntregaOrders]);
  const pipelineKpis = useMemo(() => computeOrderKpis(safeOrders), [safeOrders]);

  const fiscalOrdersCount = fiscalKpis.activeCount;
  const notaEntregaOrdersCount = notaEntregaKpis.activeCount;
  const activeOrdersCount = fiscalOrdersCount;

  // Filtrado de pedidos según búsqueda, estatus y zona
  const filterOrders = (ordersList) => {
    const rawTerm = normalizeSearchText(searchQuery);
    const strippedNumTerm = rawTerm.replace(/^#/, '').trim();
    const rifTerm = rawTerm.replace(/[^a-z0-9]/g, '');
    return ordersList.filter(ord => {
      if (!ord) return false;
      const matchSearch =
        !rawTerm ||
        [
          ord.id,
          ord.numeroDoc,
          ord.nroFactura,
          ord.clienteNombre,
          ord.cliente_nombre,
          ord.clienteRif,
          ord.cliente_rif,
          ord.vendedorId,
          ord.vendedorNombre,
          ord.zonaNombre,
          ord.condicionPago,
          ord.observaciones
        ].some((val) => {
          if (!val) return false;
          const norm = normalizeSearchText(val);
          return (
            norm.includes(rawTerm) ||
            (strippedNumTerm && norm.includes(strippedNumTerm)) ||
            (rifTerm && norm.replace(/[^a-z0-9]/g, '').includes(rifTerm))
          );
        });

      const matchStatus = statusFilter === 'ALL'
        ? (ord.status !== 'FACTURADO' && ord.status !== 'ANULADO')
        : ord.status === statusFilter;
      const matchZone =
        zoneFilter === 'ALL' ||
        ord.zonaVenta === zoneFilter ||
        String(ord.zonaVenta || '').startsWith(zoneFilter);

      return matchSearch && matchStatus && matchZone;
    });
  };

  const filteredFiscalOrders = useMemo(
    () => filterOrders(fiscalOrders),
    [fiscalOrders, searchQuery, statusFilter, zoneFilter]
  );
  const filteredNotaEntregaOrders = useMemo(
    () => filterOrders(notaEntregaOrders),
    [notaEntregaOrders, searchQuery, statusFilter, zoneFilter]
  );
  const filteredPipelineOrders = filteredFiscalOrders;

  // =========================================================================
  // TAB 6: LÓGICA DE DATOS PARA LISTADO DE FACTURAS (LIST VIEW)
  // =========================================================================

  // Helpers uniformes para resolver campos de facturas / notas de entrega (Profit, Supabase, POS)
  const resolveInvoiceTipoDoc = (inv) => {
    if (!inv) return 'FACTURA';
    const rawTipo = String(inv.tipoDoc || inv.tipo_doc || '').toUpperCase().trim();
    const rawId = String(inv.id || '').trim().toUpperCase();
    const rawNum = String(inv.numeroDoc || inv.factNum || inv.fact_num || inv.nroFactura || '').trim().toUpperCase();
    if (
      rawTipo === 'NOTA_ENTREGA' ||
      rawTipo === 'N/E' ||
      rawTipo === 'NE' ||
      /^(NE-|NDE-)/.test(rawId) ||
      /^(NE-|NDE-)/.test(rawNum)
    ) {
      return 'NOTA_ENTREGA';
    }
    return 'FACTURA';
  };

  const resolveInvoiceClientName = (inv) =>
    String(
      inv?.clienteNombre ||
      inv?.cliente_nombre ||
      inv?.cliente ||
      inv?.cliDes ||
      inv?.cli_des ||
      'Cliente General'
    ).trim() || 'Cliente General';

  const resolveInvoiceClientRif = (inv) =>
    String(
      inv?.clienteRif ||
      inv?.cliente_rif ||
      inv?.rif ||
      inv?.coCli ||
      inv?.co_cli ||
      'V-00000000-0'
    ).trim() || 'V-00000000-0';

  const resolveInvoiceSellerName = (inv) => {
    if (!inv) return 'Caja Mostrador';
    const namedCandidate = String(
      inv.vendedorNombre ||
      inv.vendedor_nombre ||
      inv.venDes ||
      inv.ven_des ||
      inv.cajera ||
      ''
    ).trim();
    const rawCandidate = String(inv.vendedor || inv.vendedorId || inv.co_ven || inv.coVen || '').trim();
    const lookupCode = rawCandidate || namedCandidate;
    if (lookupCode && Array.isArray(safeProfitSellers)) {
      const matched = safeProfitSellers.find((s) => {
        const co = String(s.coVen || s.id || '').trim().toLowerCase();
        const nm = String(s.venDes || '').trim().toLowerCase();
        const lc = lookupCode.toLowerCase();
        return (co && co === lc) || (nm && nm === lc);
      });
      if (matched?.venDes) return matched.venDes;
    }
    return namedCandidate || rawCandidate || 'Caja Mostrador';
  };

  const resolveInvoiceTotalUsd = (inv) =>
    Number(
      inv?.totalUsd ??
      inv?.total_usd ??
      inv?.totNetoUsd ??
      inv?.tot_neto_usd ??
      inv?.totalNetoUsd ??
      inv?.total ??
      0
    ) || 0;

  const resolveInvoiceTotalBs = (inv) => {
    const usd = resolveInvoiceTotalUsd(inv);
    const rawBs = Number(
      inv?.totalBs ??
      inv?.total_bs ??
      inv?.totNetoBs ??
      inv?.tot_neto_bs ??
      inv?.totalNeto ??
      inv?.tot_neto ??
      0
    );
    if (Number.isFinite(rawBs) && rawBs > 0) return rawBs;
    const docTasa = Number(inv?.tasaDolar || inv?.tasa || 0) || tasaBcv;
    return usd * docTasa;
  };

  const resolveInvoiceItemsAndLiters = (inv) => {
    const list = Array.isArray(inv?.items)
      ? inv.items
      : (Array.isArray(inv?.renglones) ? inv.renglones : []);
    const itemsCount = list.length || 1;
    let totalLitros = Number(inv?.totalLitros || 0);
    if (!(totalLitros > 0) && list.length > 0) {
      totalLitros = list.reduce(
        (sum, it) => sum + (Number(it?.litrosTotales ?? it?.volumenTotal ?? it?.litros ?? 0) || 0),
        0
      );
    }
    return { itemsCount, totalLitros: Number.isFinite(totalLitros) ? totalLitros : 0 };
  };

  // Consolidación de todas las facturas del sistema (ventas locales, Supabase y Profit Plus)
  const allInvoices = useMemo(() => {
    const canonicalInvoiceKey = (doc) => getEraScopedCanonicalDocKey(doc);
    let persistentDelSet = new Set();
    try {
      persistentDelSet = new Set(sanitizeCxcDeletedDocsStorage());
    } catch (_) {}

    const byKey = new Map();
    const upsertDoc = (doc, sourceOrder) => {
      if (!doc) return;
      if (persistentDelSet.size > 0 && isCxcEntryDeleted(doc, persistentDelSet)) return;
      const rawKey = String(doc.numeroDoc || doc.factNum || doc.fact_num || doc.id || '').trim();
      if (!rawKey) return;
      const cKey = canonicalInvoiceKey(doc);
      const deletedAt =
        localDeletedInvoiceKeys.get(cKey) ||
        localDeletedInvoiceKeys.get(rawKey) ||
        localDeletedInvoiceKeys.get(String(doc.id));
      if (deletedAt) {
        const docTs = Date.parse(doc.updated_at || doc.fechaSincronizacion || doc.created_at || doc.fechaEmision || doc.fec_emis || 0) || 0;
        if (!docTs || docTs <= deletedAt + 2000) return;
      }
      const existing = byKey.get(cKey);
      if (!existing) {
        byKey.set(cKey, doc);
        return;
      }
      const bestItems = pickPreferredLineItems(existing.items || existing.renglones, doc.items || doc.renglones);
      const merged = sourceOrder === 'PROFIT'
        ? { ...doc, ...existing, items: bestItems }
        : { ...existing, ...doc, items: bestItems };

      // Conservar la marca de tiempo real (con hora) si una de las dos fuentes la tiene
      const existingDateInfo = parseInvoiceDateInfo(existing);
      const docDateInfo = parseInvoiceDateInfo(doc);
      if (!parseInvoiceDateInfo(merged).hasTime) {
        if (docDateInfo.hasTime && docDateInfo.fullIso) {
          merged.fechaEmision = docDateInfo.fullIso;
        } else if (existingDateInfo.hasTime && existingDateInfo.fullIso) {
          merged.fechaEmision = existingDateInfo.fullIso;
        }
      }
      if (!merged.updatedAt && (existing.updatedAt || doc.updatedAt || existing.updated_at || doc.updated_at)) {
        merged.updatedAt = doc.updatedAt || doc.updated_at || existing.updatedAt || existing.updated_at;
      }
      if (!merged.vendedorNombre) {
        merged.vendedorNombre = doc.vendedorNombre || existing.vendedorNombre || doc.venDes || existing.venDes || '';
      }
      if (!merged.numeroControl) {
        merged.numeroControl = doc.numeroControl || existing.numeroControl || '';
      }

      byKey.set(cKey, merged);
    };

    // 1. Facturas de Profit Plus ERP (profitInvoices) y luego Ventas locales/Supabase (sales) fusionando renglones reales
    if (Array.isArray(profitInvoices)) {
      for (const p of profitInvoices) upsertDoc(p, 'PROFIT');
    }
    if (Array.isArray(sales)) {
      for (const s of sales) upsertDoc(s, 'POS');
    }

    const list = Array.from(byKey.values());

    // Ordenar de forma descendente por fecha real de emisión y número correlativo
    return list.sort((a, b) => {
      const numA = parseInt(String(a.numeroDoc || a.factNum || a.id || '0').replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(String(b.numeroDoc || b.factNum || b.id || '0').replace(/[^0-9]/g, ''), 10) || 0;
      if (numA !== numB) return numB - numA;
      const dateA = parseInvoiceDateInfo(a).date?.getTime() || 0;
      const dateB = parseInvoiceDateInfo(b).date?.getTime() || 0;
      return dateB - dateA;
    });
  }, [sales, profitInvoices, localDeletedInvoiceKeys]);

  // Factura con correlativo más alto registrada en el sistema (para sugerencia de continuación)
  const highestExistingInvoiceNum = useMemo(() => {
    let max = -1;
    (allInvoices || []).forEach(inv => {
      const rawTipo = String(inv.tipoDoc || inv.tipo_doc || '').toUpperCase().trim();
      const rawId = String(inv.id || '').trim();
      const raw = String(inv.numeroDoc || inv.factNum || inv.fact_num || inv.nroFactura || '');
      const isNe =
        rawTipo === 'NOTA_ENTREGA' ||
        rawTipo === 'N/E' ||
        rawTipo === 'NE' ||
        /^(NE-|NDE-)/i.test(rawId) ||
        /^(NE-|NDE-)/i.test(raw);
      if (isNe) return;
      const digits = raw.replace(/[^0-9]/g, '');
      if (digits) {
        const val = parseInt(digits, 10);
        if (!isNaN(val) && val >= 0 && val <= 999999 && val > max) {
          max = val;
        }
      }
    });
    return max;
  }, [allInvoices]);

  // Nota de Entrega con correlativo más alto registrada en el sistema (para sugerencia de continuación)
  const highestExistingNeNum = useMemo(() => {
    let max = -1;
    (allInvoices || []).forEach(inv => {
      const rawTipo = String(inv.tipoDoc || inv.tipo_doc || '').toUpperCase().trim();
      const rawId = String(inv.id || '').trim();
      const raw = String(inv.numeroDoc || inv.factNum || inv.fact_num || inv.nroFactura || '').trim();
      const isNe =
        rawTipo === 'NOTA_ENTREGA' ||
        rawTipo === 'N/E' ||
        rawTipo === 'NE' ||
        /^(NE-|NDE-)/i.test(rawId) ||
        /^(NE-|NDE-)/i.test(raw);
      if (!isNe) return;
      for (const candidate of [raw, rawId]) {
        const digits = candidate.replace(/[^0-9]/g, '');
        if (digits) {
          const val = parseInt(digits, 10);
          if (!isNaN(val) && val >= 0 && val < 900000 && val > max) {
            max = val;
          }
        }
      }
    });
    return max;
  }, [allInvoices]);

  // Formato correlativo oficial de 6 dígitos (000000, 000001, etc.)
  const formatInvoiceCorrelativo = (inv) => {
    if (!inv) return '000000';
    const raw = String(inv.numeroDoc || inv.factNum || inv.fact_num || inv.nroFactura || inv.id || '0');
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return raw;
    return digits.slice(-6).padStart(6, '0');
  };

  // Determinar si una factura fue emitida a Crédito o a Contado
  const checkIsCredit = (inv) => {
    if (!inv) return false;
    const cond = String(inv.condicionPago || inv.condicion_pago || '').toUpperCase();
    const metodo = String(inv.metodoPago || inv.metodo_pago || '').toUpperCase();
    const dias = Number(inv.diasCredito || inv.dias_credito || 0);
    if (cond.includes('CREDITO') || cond.includes('DIAS') || cond.includes('DÍAS') || dias > 0) return true;
    if (metodo === 'CREDITO') return true;
    if (Number(inv.saldoUsd || inv.saldo_usd || 0) > 0.01) return true;
    return false;
  };

  // Normaliza cualquier factura del listado (local, Supabase o Profit Plus) al formato
  // que esperan el modal de vista previa y el generador PDF SENIAT, garantizando que el
  // N° de factura, renglones, totales y condición coincidan con lo mostrado en la columna.
  const buildPrintableInvoice = (inv) => {
    if (!inv) return null;
    const correlativo = formatInvoiceCorrelativo(inv);
    const isCredit = checkIsCredit(inv);
    const tipoDocNorm = resolveInvoiceTipoDoc(inv);

    const totalUsd = resolveInvoiceTotalUsd(inv);
    const totalBsRaw = Number(inv.totalBs || inv.total_bs || inv.totNetoBs || inv.tot_neto_bs || inv.totalNeto || inv.tot_neto || 0);
    // Tasa propia del documento (Bs / USD); si no es deducible se usa la tasa configurada
    const docTasa = Number(inv.tasaDolar || inv.tasa) || (totalUsd > 0 && totalBsRaw > 0 ? totalBsRaw / totalUsd : 0) || tasaBcv;
    const totalBs = totalBsRaw || totalUsd * docTasa;

    const resolvedLines = resolveDeliveryNoteLineItems({ ...inv, tasaDolar: docTasa }, safeProducts, docTasa);
    const items = resolvedLines.map((it) => ({
      ...it,
      tipoAlicuota: it.tipoAlicuota || '16%',
      litros: it.volumenTotal ?? it.litrosTotales ?? it.litros ?? 0
    }));

    const ivaUsdRaw = Number(inv.ivaGeneralUsd ?? inv.ivaUsd ?? inv.iva_usd ?? NaN);
    const ivaUsd = Number.isFinite(ivaUsdRaw) ? ivaUsdRaw : (totalUsd - totalUsd / 1.16);
    const baseUsd = Number(inv.baseGeneralUsd ?? inv.subtotalUsd ?? inv.totBrutoUsd) || (totalUsd - ivaUsd);
    const ivaBsRaw = Number(inv.ivaGeneralBs ?? inv.ivaBs ?? inv.iva_bs ?? NaN);

    const emitInfo = parseInvoiceDateInfo(inv);
    const fechaEmision = emitInfo.fullIso || new Date().toISOString();
    const rawVenc = inv.fechaVencimiento || inv.fec_venc || null;
    const vencInfo = rawVenc ? parseInvoiceDateInfo(rawVenc, fechaEmision) : null;
    const fechaVencimiento = vencInfo?.fullIso || fechaEmision;
    let diasCredito = Number(inv.diasCredito || inv.dias_credito || 0);
    if (isCredit && !diasCredito && vencInfo?.date && emitInfo.date) {
      const diff = Math.round((vencInfo.date - emitInfo.date) / 86400000);
      if (diff > 0) diasCredito = diff;
    }
    if (isCredit && !diasCredito) diasCredito = 7;

    const rawCond = String(inv.condicionPago || inv.condicion_pago || '').toUpperCase();
    const condicionPago = isCredit
      ? ((rawCond.includes('CREDITO') || rawCond.includes('CRÉDITO')) ? (inv.condicionPago || inv.condicion_pago) : 'CREDITO')
      : (inv.condicionPago || inv.condicion_pago || 'CONTADO');

    const cliName = resolveInvoiceClientName(inv);
    const cliRif = resolveInvoiceClientRif(inv);

    return {
      ...inv,
      id: inv.id || correlativo,
      numeroDoc: correlativo,
      nroFactura: correlativo,
      numeroControl: inv.numeroControl || inv.nroControl || formatDocumentControlNumber(correlativo, tipoDocNorm),
      tipoDoc: tipoDocNorm,
      clienteNombre: cliName,
      clienteRif: cliRif,
      clienteDireccion: (() => {
        const directAddr = inv.clienteDireccion || inv.dir_ent || inv.direccionEntrega || '';
        if (directAddr) return directAddr;
        const matched = safeClients.find(c =>
          (inv.clienteId && c.id === inv.clienteId) ||
          (cliRif && c.rif === cliRif) ||
          (cliName && (c.nombre || c.name)?.toLowerCase() === cliName.toLowerCase())
        );
        return matched?.direccion || matched?.domicilioFiscal || matched?.direccion2 || '';
      })(),
      fechaEmision,
      fechaVencimiento,
      condicionPago,
      diasCredito: isCredit ? diasCredito : 0,
      metodoPago: inv.metodoPago || inv.metodo_pago || (isCredit ? 'CREDITO' : 'EFECTIVO USD'),
      tasaDolar: docTasa,
      items,
      baseGeneralUsd: baseUsd,
      baseGeneralBs: Number(inv.baseGeneralBs) || baseUsd * docTasa,
      ivaGeneralUsd: ivaUsd,
      ivaGeneralBs: Number.isFinite(ivaBsRaw) ? ivaBsRaw : ivaUsd * docTasa,
      totalUsd,
      totalBs,
      vendedor: resolveInvoiceSellerName(inv)
    };
  };

  // Lista única de vendedores / cajeros presentes para el selector de filtro
  const invoiceSellerOptions = useMemo(() => {
    const seen = new Set();
    for (const inv of allInvoices) {
      seen.add(resolveInvoiceSellerName(inv));
    }
    if (Array.isArray(safeProfitSellers)) {
      for (const s of safeProfitSellers) {
        if (s?.venDes) seen.add(String(s.venDes).trim());
      }
    }
    return Array.from(seen).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  }, [allInvoices, safeProfitSellers]);

  // Filtrado y Ordenamiento de facturas para la tabla list view
  const filteredInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYmd = toLocalYmd(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYmd = toLocalYmd(yesterday);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const numColRaw = normalizeSearchText(invoiceNumColFilter).replace(/^#/, '').trim();
    const numColDigits = numColRaw.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    const clientColRaw = normalizeSearchText(invoiceClientColFilter);
    const clientColRif = clientColRaw.replace(/[^a-z0-9]/g, '');
    const minUsdVal = invoiceMinUsdFilter !== '' && !Number.isNaN(Number(invoiceMinUsdFilter)) ? Number(invoiceMinUsdFilter) : null;
    const minBsVal = invoiceMinBsFilter !== '' && !Number.isNaN(Number(invoiceMinBsFilter)) ? Number(invoiceMinBsFilter) : null;

    const searchTokens = normalizeSearchText(invoiceSearchQuery)
      .split(/\s+/)
      .filter(Boolean);

    const filtered = allInvoices.filter(inv => {
      if (!inv) return false;

      // 1. Condición de pago (Pills superiores)
      const isCredit = checkIsCredit(inv);
      if (invoiceConditionFilter === 'CONTADO' && isCredit) return false;
      if (invoiceConditionFilter === 'CREDITO' && !isCredit) return false;

      // 2. Filtro por tipo de documento (Factura vs Nota de Entrega)
      const tipoDoc = resolveInvoiceTipoDoc(inv);
      if (invoiceDocTypeFilter !== 'ALL' && tipoDoc !== invoiceDocTypeFilter) return false;

      // 3. Filtro por período (usando fecha local sin desfase a medianoche UTC)
      const dateInfo = parseInvoiceDateInfo(inv);
      if (invoicePeriodFilter !== 'ALL' && invoicePeriodFilter !== 'RANGE') {
        if (!dateInfo.date) return false;
        if (invoicePeriodFilter === 'TODAY' && dateInfo.isoDateOnly !== todayYmd) return false;
        if (invoicePeriodFilter === 'YESTERDAY' && dateInfo.isoDateOnly !== yesterdayYmd) return false;
        if (invoicePeriodFilter === 'WEEK' && dateInfo.date < oneWeekAgo) return false;
        if (invoicePeriodFilter === 'MONTH' && dateInfo.date < oneMonthAgo) return false;
      }

      // Pre-resolver valores para buscador y filtros de columna
      const correlativo = formatInvoiceCorrelativo(inv);
      const rawNum = String(inv.numeroDoc || inv.factNum || inv.fact_num || inv.nroFactura || inv.id || '').trim();
      const nroControl = String(inv.numeroControl || inv.nroControl || '').trim();
      const cliName = resolveInvoiceClientName(inv);
      const cliRif = resolveInvoiceClientRif(inv);
      const sellerName = resolveInvoiceSellerName(inv);
      const rawSeller = String(inv.vendedor || inv.vendedorNombre || inv.venDes || inv.ven_des || inv.vendedorId || inv.co_ven || inv.cajera || '').trim();
      const totalUsd = resolveInvoiceTotalUsd(inv);
      const totalBs = resolveInvoiceTotalBs(inv);
      const { itemsCount, totalLitros } = resolveInvoiceItemsAndLiters(inv);
      const dias = Number(inv.diasCredito || inv.dias_credito || (isCredit ? 7 : 0));

      // 4. Buscador principal multi-término (sin acentos, tolera # en correlativo y guiones en RIF)
      if (searchTokens.length > 0) {
        const hayText = normalizeSearchText(
          [
            correlativo,
            correlativo.replace(/^0+(?=\d)/, ''),
            rawNum,
            nroControl,
            tipoDoc === 'NOTA_ENTREGA' ? 'nota entrega ne' : 'factura',
            cliName,
            cliRif,
            sellerName,
            rawSeller,
            isCredit ? `credito ${dias}d` : 'contado',
            inv.metodoPago || inv.metodo_pago || '',
            inv.observaciones || '',
            dateInfo.isoDateOnly,
            formatInvoiceDateTimeDisplay(inv)
          ].join(' ')
        );
        const hayAlnum = hayText.replace(/[^a-z0-9]/g, '');

        const allMatch = searchTokens.every((tk) => {
          const cleanTk = tk.replace(/^#/, '');
          const noZeroTk = cleanTk.replace(/^0+(?=\d)/, '');
          const alnumTk = cleanTk.replace(/[^a-z0-9]/g, '');
          return (
            hayText.includes(tk) ||
            (cleanTk && hayText.includes(cleanTk)) ||
            (noZeroTk && hayText.includes(noZeroTk)) ||
            (alnumTk && hayAlnum.includes(alnumTk))
          );
        });
        if (!allMatch) return false;
      }

      // 5. Filtros individuales por columna
      if (numColRaw) {
        const numHay = normalizeSearchText(`${correlativo} ${rawNum} ${nroControl}`);
        const numMatch = numHay.includes(numColRaw) || (numColDigits && numHay.includes(numColDigits));
        if (!numMatch) return false;
      }

      if (!matchesDatePeriodFilter(dateInfo.isoDateOnly || dateInfo.date, invoiceDateFilter)) {
        return false;
      }

      if (clientColRaw) {
        const cliHay = normalizeSearchText(`${cliName} ${cliRif}`);
        const cliAlnum = cliHay.replace(/[^a-z0-9]/g, '');
        const cliMatch = cliHay.includes(clientColRaw) || (clientColRif && cliAlnum.includes(clientColRif));
        if (!cliMatch) return false;
      }

      if (invoiceSellerColFilter !== 'ALL' && sellerName !== invoiceSellerColFilter) {
        return false;
      }

      if (invoiceCondColFilter !== 'ALL') {
        if (invoiceCondColFilter === 'CONTADO' && isCredit) return false;
        if (invoiceCondColFilter === 'CREDITO' && !isCredit) return false;
        if (invoiceCondColFilter.startsWith('DIAS_')) {
          const expectedDays = Number(invoiceCondColFilter.replace('DIAS_', ''));
          if (!isCredit || dias !== expectedDays) return false;
        }
      }

      if (invoiceItemsColFilter !== 'ALL') {
        if (invoiceItemsColFilter === 'WITH_LITERS' && !(totalLitros > 0)) return false;
        if (invoiceItemsColFilter === 'MULTI' && !(itemsCount > 1)) return false;
        if (invoiceItemsColFilter === 'SINGLE' && itemsCount !== 1) return false;
      }

      if (minUsdVal !== null && totalUsd < minUsdVal) return false;
      if (minBsVal !== null && totalBs < minBsVal) return false;

      return true;
    });

    const getSortValue = (inv) => {
      switch (invoiceSortField) {
        case 'factura':
          return parseInt(String(formatInvoiceCorrelativo(inv)).replace(/[^0-9]/g, ''), 10) || 0;
        case 'fecha':
          return parseInvoiceDateInfo(inv).date?.getTime() || 0;
        case 'cliente':
          return resolveInvoiceClientName(inv).toLowerCase();
        case 'rif':
          return resolveInvoiceClientRif(inv).toLowerCase();
        case 'vendedor':
          return resolveInvoiceSellerName(inv).toLowerCase();
        case 'condicion':
          return checkIsCredit(inv) ? (Number(inv.diasCredito || inv.dias_credito || 7)) : 0;
        case 'renglones': {
          const { itemsCount, totalLitros } = resolveInvoiceItemsAndLiters(inv);
          return itemsCount * 100000 + totalLitros;
        }
        case 'totalUsd':
          return resolveInvoiceTotalUsd(inv);
        case 'totalBs':
          return resolveInvoiceTotalBs(inv);
        default:
          return 0;
      }
    };

    return [...filtered].sort((a, b) => {
      const valA = getSortValue(a);
      const valB = getSortValue(b);
      let cmp = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        cmp = invoiceSortDirection === 'asc'
          ? valA.localeCompare(valB, 'es', { numeric: true })
          : valB.localeCompare(valA, 'es', { numeric: true });
      } else {
        if (valA < valB) cmp = invoiceSortDirection === 'asc' ? -1 : 1;
        else if (valA > valB) cmp = invoiceSortDirection === 'asc' ? 1 : -1;
      }
      if (cmp !== 0) return cmp;
      // Desempate por N° correlativo descendente
      const numA = parseInt(String(formatInvoiceCorrelativo(a)).replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(String(formatInvoiceCorrelativo(b)).replace(/[^0-9]/g, ''), 10) || 0;
      return invoiceSortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [
    allInvoices,
    invoiceConditionFilter,
    invoiceDocTypeFilter,
    invoicePeriodFilter,
    invoiceSearchQuery,
    invoiceNumColFilter,
    invoiceDateFilter,
    invoiceClientColFilter,
    invoiceSellerColFilter,
    invoiceCondColFilter,
    invoiceItemsColFilter,
    invoiceMinUsdFilter,
    invoiceMinBsFilter,
    invoiceSortField,
    invoiceSortDirection
  ]);

  // Métricas y KPIs consolidados de facturación (excluye documentos anulados)
  const invoiceKpis = useMemo(() => {
    let totalFacturas = 0;
    let contadoCount = 0;
    let creditoCount = 0;
    let contadoUsd = 0;
    let creditoUsd = 0;
    let totalNetoUsd = 0;

    for (const inv of allInvoices) {
      if (!inv) continue;
      const stUpper = String(inv.estado || inv.status || '').toUpperCase().trim();
      if (inv.anulada || inv.anulado || stUpper === 'ANULADA' || stUpper === 'ANULADO') continue;
      totalFacturas++;
      const isCredit = checkIsCredit(inv);
      const montoUsd = resolveInvoiceTotalUsd(inv);
      totalNetoUsd += montoUsd;
      if (isCredit) {
        creditoCount++;
        creditoUsd += montoUsd;
      } else {
        contadoCount++;
        contadoUsd += montoUsd;
      }
    }

    return {
      totalFacturas,
      contadoCount,
      creditoCount,
      contadoUsd,
      creditoUsd,
      totalNetoUsd
    };
  }, [allInvoices]);

  // Recalcula automáticamente Subtotal, IVA 16% (exento en N.E.), Total USD y Total Bs. al editar renglones
  const applyRecalculatedEditingInvoice = (prev, nextItems, nextTipoDoc = prev?.tipoDoc) => {
    if (!prev) return prev;
    const recalc = recalculateEditableInvoiceAmounts({
      items: nextItems,
      tipoDoc: nextTipoDoc,
      tasaDolar: prev.tasaDolar,
      fallbackTasa: tasaBcv
    });
    return {
      ...prev,
      tipoDoc: nextTipoDoc,
      ...recalc
    };
  };

  // Abrir modal de edición de datos de Factura o Nota de Entrega (solo roles administrativos)
  const handleOpenEditInvoice = (inv) => {
    if (!inv) return;
    if (!isAdmin) {
      notify.error('Solo usuarios administrativos (Gerencia / Master / Administración / TI) pueden editar facturas emitidas.');
      return;
    }
    const correlativo = formatInvoiceCorrelativo(inv);
    const tipoDocNorm = resolveInvoiceTipoDoc(inv);
    const isCredit = checkIsCredit(inv);
    const dateInfo = parseInvoiceDateInfo(inv);
    const emitDateObj = dateInfo.date || new Date();
    const fechaEmisionDate = dateInfo.isoDateOnly || toLocalYmd(emitDateObj);
    const hh = String(emitDateObj.getHours()).padStart(2, '0');
    const mm = String(emitDateObj.getMinutes()).padStart(2, '0');
    const ss = String(emitDateObj.getSeconds()).padStart(2, '0');
    const fechaEmisionTime = `${hh}:${mm}:${ss}`;

    const diasCredito = isCredit ? (Number(inv.diasCredito || inv.dias_credito) || 15) : 0;
    const rawVenc = inv.fechaVencimiento || inv.fec_venc || '';
    const vencInfo = rawVenc ? parseInvoiceDateInfo(rawVenc) : null;
    const fechaVencimientoDate = isCredit
      ? (vencInfo?.isoDateOnly || calculateExpirationDate(fechaEmisionDate, diasCredito))
      : fechaEmisionDate;

    const totalUsd = resolveInvoiceTotalUsd(inv);
    const totalBsRaw = resolveInvoiceTotalBs(inv);
    const docTasa = Number(inv.tasaDolar || inv.tasa) || (totalUsd > 0 && totalBsRaw > 0 ? Number((totalBsRaw / totalUsd).toFixed(4)) : tasaBcv);
    const ivaUsdRaw = Number(inv.ivaUsd ?? inv.iva_usd ?? inv.ivaGeneralUsd ?? 0);
    const subtotalUsdRaw = Number(inv.subtotalUsd ?? inv.totBrutoUsd ?? inv.tot_bruto_usd ?? inv.baseGeneralUsd ?? (totalUsd - ivaUsdRaw));
    const abonosUsdRaw = Number(inv.abonosUsd ?? inv.abonos_usd ?? (isCredit ? 0 : totalUsd));

    const resolvedLines = resolveDeliveryNoteLineItems({ ...inv, tasaDolar: docTasa }, safeProducts, docTasa);
    const editableItems = resolvedLines.map((it, i) => ({
      id: it.id || it.articuloId || `ITEM-${i + 1}`,
      articuloId: it.articuloId || it.codigo || '',
      codigo: it.codigo || it.articuloId || '',
      descripcion: it.descripcion || it.articuloDescripcion || 'Lubricante Motorven',
      cantidad: Number(it.cantidad || 1),
      precioUsd: Number(it.precioUsd ?? it.precioUnitarioUsd ?? 0),
      subtotalUsd: Number(it.subtotalUsd ?? it.totalUsd ?? 0),
      litros: Number(it.litros ?? it.volumenTotal ?? it.litrosTotales ?? 0)
    }));

    const initialControl = inv.numeroControl || inv.nroControl || formatDocumentControlNumber(correlativo, tipoDocNorm);

    setEditClientSearch('');
    setEditingInvoice({
      _originalDoc: inv,
      _savedFiscalControl: tipoDocNorm !== 'NOTA_ENTREGA' ? initialControl : '',
      id: inv.id || '',
      tipoDoc: tipoDocNorm,
      numeroDoc: correlativo,
      numeroControl: initialControl,
      fechaEmisionDate,
      fechaEmisionTime,
      condicionPago: isCredit ? 'CREDITO' : 'CONTADO',
      diasCredito: String(diasCredito),
      fechaVencimientoDate,
      metodoPago: inv.metodoPago || inv.metodo_pago || (isCredit ? 'CREDITO' : 'EFECTIVO_USD'),
      clienteId: inv.clienteId || inv.coCli || inv.co_cli || '',
      clienteNombre: resolveInvoiceClientName(inv),
      clienteRif: resolveInvoiceClientRif(inv),
      clienteDireccion: inv.clienteDireccion || inv.dir_ent || inv.direccionEntrega || '',
      clienteTelefono: inv.clienteTelefono || inv.telefono || '',
      vendedor: resolveInvoiceSellerName(inv),
      tasaDolar: docTasa.toFixed(2),
      subtotalUsd: Number.isFinite(subtotalUsdRaw) ? subtotalUsdRaw.toFixed(2) : totalUsd.toFixed(2),
      ivaUsd: Number.isFinite(ivaUsdRaw) ? ivaUsdRaw.toFixed(2) : '0.00',
      totalUsd: totalUsd.toFixed(2),
      totalBs: totalBsRaw.toFixed(2),
      abonosUsd: Number.isFinite(abonosUsdRaw) ? abonosUsdRaw.toFixed(2) : '0.00',
      observaciones: inv.observaciones || inv.comentario || '',
      items: editableItems
    });
  };

  // Guardar cambios editados de Factura o Nota de Entrega (sin afectar inventario)
  const handleSaveEditedInvoice = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!isAdmin) {
      notify.error('Solo Master Admin / Gerencia pueden guardar cambios sobre facturas emitidas.');
      return;
    }
    if (!editingInvoice || isSavingEditedInvoice) return;

    const cleanNumDigits = String(editingInvoice.numeroDoc || '').replace(/[^0-9]/g, '');
    const cleanNum = cleanNumDigits ? cleanNumDigits.slice(-6).padStart(6, '0') : String(editingInvoice.numeroDoc || '').trim();
    if (!cleanNum) {
      notify.error('Debe indicar un número de correlativo válido.');
      return;
    }

    const orig = editingInvoice._originalDoc || {};
    const origNum = formatInvoiceCorrelativo(orig);
    const origTipo = resolveInvoiceTipoDoc(orig);
    const targetTipo = editingInvoice.tipoDoc || 'FACTURA';

    // Construir fecha/hora exacta de emisión preservando hora local
    let emitIso = '';
    const dParts = String(editingInvoice.fechaEmisionDate || '').split('-').map(Number);
    const tParts = String(editingInvoice.fechaEmisionTime || '12:00:00').split(':').map(Number);
    if (dParts.length === 3 && dParts.every((n) => Number.isFinite(n))) {
      const [y, m, d] = dParts;
      const hh = Number.isFinite(tParts[0]) ? tParts[0] : 12;
      const mm = Number.isFinite(tParts[1]) ? tParts[1] : 0;
      const ss = Number.isFinite(tParts[2]) ? tParts[2] : 0;
      const localDt = new Date(y, m - 1, d, hh, mm, ss, 0);
      if (!Number.isNaN(localDt.getTime())) {
        emitIso = localDt.toISOString();
      }
    }
    if (!emitIso) {
      emitIso = preserveDateWithTime(editingInvoice.fechaEmisionDate || new Date());
    }

    // Validar que no exista otro documento diferente en la misma serie activa con el mismo correlativo y tipo
    const collision = resolveEditedInvoiceCollision({
      orig,
      allInvoices,
      cleanNum,
      targetTipo,
      emitIso
    });
    if (collision.blocked && (cleanNum !== origNum || targetTipo !== origTipo)) {
      const conflictClient = resolveInvoiceClientName(collision.conflictingDoc);
      const conflictDate = parseInvoiceDateInfo(collision.conflictingDoc).isoDateOnly || '';
      notify.error(
        `Ya existe ${targetTipo === 'NOTA_ENTREGA' ? 'una Nota de Entrega' : 'una Factura'} activa con el correlativo #${cleanNum} (${conflictClient}${conflictDate ? ` - ${conflictDate}` : ''}). Use otro correlativo libre para evitar sobrescribirla.`
      );
      return;
    }

    const isCredit = editingInvoice.condicionPago === 'CREDITO';
    const dias = isCredit ? Math.max(1, parseInt(editingInvoice.diasCredito || '15', 10) || 15) : 0;
    const vencDateStr = editingInvoice.fechaVencimientoDate || (isCredit ? calculateExpirationDate(editingInvoice.fechaEmisionDate, dias) : editingInvoice.fechaEmisionDate);
    const vencIso = preserveDateWithTime(vencDateStr, emitIso);

    const tasaVal = Math.max(0.01, Number(editingInvoice.tasaDolar) || tasaBcv);
    const subtotalUsdVal = Math.max(0, Number(editingInvoice.subtotalUsd) || 0);
    const ivaUsdVal = Math.max(0, Number(editingInvoice.ivaUsd) || 0);
    const totalUsdVal = Math.max(0, Number(editingInvoice.totalUsd) || (subtotalUsdVal + ivaUsdVal));
    const totalBsVal = Math.max(0, Number(editingInvoice.totalBs) || Number((totalUsdVal * tasaVal).toFixed(2)));
    const abonosUsdVal = isCredit ? Math.min(totalUsdVal, Math.max(0, Number(editingInvoice.abonosUsd) || 0)) : totalUsdVal;
    const saldoUsdVal = isCredit ? Math.max(0, Number((totalUsdVal - abonosUsdVal).toFixed(2))) : 0;
    const abonosBsVal = Number((abonosUsdVal * tasaVal).toFixed(2));
    const saldoBsVal = Number((saldoUsdVal * tasaVal).toFixed(2));

    const matchedSeller = (safeProfitSellers || []).find(
      (s) =>
        String(s.venDes || '').trim().toLowerCase() === String(editingInvoice.vendedor || '').trim().toLowerCase() ||
        String(s.coVen || '').trim().toLowerCase() === String(editingInvoice.vendedor || '').trim().toLowerCase()
    );

    const newId = collision.newId;
    const resolvedSeriesEra = collision.seriesEra || '';

    const cleanItems = (editingInvoice.items || []).map((it) => {
      const cant = Math.max(0, Number(it.cantidad) || 0);
      const precio = Math.max(0, Number(it.precioUsd) || 0);
      const sub = Number((cant * precio).toFixed(2));
      return {
        ...it,
        cantidad: cant,
        precioUsd: precio,
        subtotalUsd: sub,
        totalUsd: sub
      };
    });

    if (origTipo !== targetTipo && cleanItems.length > 0) {
      const targetWhCheck = validateWarehouseStockForDocument({
        items: cleanItems,
        products: safeProducts,
        tipoDoc: targetTipo,
        almacen: targetTipo === 'NOTA_ENTREGA' ? '02' : '01',
        modalidadVenta: targetTipo === 'NOTA_ENTREGA' ? 'OFICINA' : 'MOSTRADOR'
      });
      if (!targetWhCheck.isValid) {
        notify.error(`No se puede cambiar a ${targetTipo === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura Fiscal'}: ${targetWhCheck.message}`);
        return;
      }
    }

    const rawEditedControl = String(editingInvoice.numeroControl || '').trim();
    const resolvedNumeroControl = targetTipo === 'NOTA_ENTREGA'
      ? ((!rawEditedControl || (origTipo !== 'NOTA_ENTREGA' && /^00-\d+$/.test(rawEditedControl)))
          ? generateDeliveryNoteControlNumber(cleanNum)
          : rawEditedControl)
      : (rawEditedControl || generateFiscalControlNumber(parseInt(cleanNum, 10) || 1));

    const updatedPayload = {
      ...orig,
      id: newId,
      ...(resolvedSeriesEra ? { seriesEra: resolvedSeriesEra, series_era: resolvedSeriesEra } : { seriesEra: '', series_era: null }),
      factNum: cleanNum,
      fact_num: cleanNum,
      numeroDoc: cleanNum,
      nroFactura: cleanNum,
      numeroControl: resolvedNumeroControl,
      numero_control: resolvedNumeroControl,
      tipoDoc: targetTipo,
      almacen: targetTipo === 'NOTA_ENTREGA' ? '02' : (orig.almacen || '01'),
      fechaEmision: emitIso,
      fec_emis: emitIso,
      fechaVencimiento: vencIso,
      fec_venc: vencIso,
      diasCredito: dias,
      condicionPago: isCredit ? 'CREDITO' : 'CONTADO',
      metodoPago: editingInvoice.metodoPago || (isCredit ? 'CREDITO' : 'EFECTIVO_USD'),
      clienteId: editingInvoice.clienteId || orig.clienteId || `CLI-${cleanNum}`,
      clienteNombre: String(editingInvoice.clienteNombre || '').trim() || 'Cliente General',
      clienteRif: String(editingInvoice.clienteRif || '').trim() || 'V-00000000-0',
      clienteDireccion: String(editingInvoice.clienteDireccion || '').trim(),
      clienteTelefono: String(editingInvoice.clienteTelefono || '').trim(),
      vendedor: matchedSeller?.venDes || String(editingInvoice.vendedor || '').trim() || 'Caja Mostrador',
      vendedorNombre: matchedSeller?.venDes || String(editingInvoice.vendedor || '').trim() || 'Caja Mostrador',
      vendedorId: matchedSeller?.coVen || orig.vendedorId || '',
      tasa: tasaVal,
      tasaDolar: tasaVal,
      totBrutoUsd: subtotalUsdVal,
      subtotalUsd: subtotalUsdVal,
      ivaUsd: ivaUsdVal,
      totNetoUsd: totalUsdVal,
      totalUsd: totalUsdVal,
      totBrutoBs: Number((subtotalUsdVal * tasaVal).toFixed(2)),
      ivaBs: Number((ivaUsdVal * tasaVal).toFixed(2)),
      totNetoBs: totalBsVal,
      totalBs: totalBsVal,
      abonosUsd: abonosUsdVal,
      abonosBs: abonosBsVal,
      saldoUsd: saldoUsdVal,
      saldoBs: saldoBsVal,
      observaciones: String(editingInvoice.observaciones || '').trim(),
      items: cleanItems,
      anulada: false,
      saldado: saldoUsdVal <= 0.01
    };

    try {
      setIsSavingEditedInvoice(true);
      const saver = onUpdateInvoiceDocument || updateSupabaseInvoiceDocument;
      await saver(orig, updatedPayload);
      notify.success(
        `${targetTipo === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura'} #${cleanNum} actualizada correctamente`
      );
      setEditingInvoice(null);
    } catch (err) {
      console.error('Error actualizando documento:', err);
      notify.error('Error al actualizar el documento: ' + (err?.message || err));
    } finally {
      setIsSavingEditedInvoice(false);
    }
  };

  // Imprimir factura individual con correlativo secuencial
  const handlePrintIndividualInvoice = (inv) => {
    const correlativo = formatInvoiceCorrelativo(inv);
    const isNe = resolveInvoiceTipoDoc(inv) === 'NOTA_ENTREGA';
    const saleForPrint = {
      ...inv,
      numeroDoc: correlativo,
      nroFactura: correlativo,
      tipoDoc: isNe ? 'NOTA_ENTREGA' : (inv.tipoDoc || 'FACTURA'),
      ...buildPrintableInvoice(inv)
    };
    try {
      if (isNe) {
        generateDeliveryNotePDF({ sale: saleForPrint, config, currentUser, products: safeProducts, clients: safeClients, sellers: profitSellers, autoPrint: true });
        notify.success(`Nota de Entrega #${correlativo} enviada a impresión`);
      } else {
        generateLetterInvoiceSeniatPDF({ sale: saleForPrint, config, currentUser, clients: safeClients, sellers: profitSellers, autoPrint: true });
        notify.success(`Factura #${correlativo} enviada a impresión`);
      }
    } catch (err) {
      console.error('Error imprimiendo documento:', err);
      notify.error('Error al generar la impresión del documento');
    }
  };

  // Imprimir reporte general consolidado de facturas
  const handlePrintGeneralInvoicesReport = () => {
    try {
      generateSalesPOSPDF({
        sales: filteredInvoices,
        config,
        currentUser,
        tipoDoc: invoiceConditionFilter === 'ALL' ? 'FACTURAS_GENERAL' : (invoiceConditionFilter === 'CONTADO' ? 'FACTURAS_CONTADO' : 'FACTURAS_CREDITO')
      });
      notify.success('Reporte de Facturación generado con éxito');
    } catch (err) {
      console.error('Error imprimiendo reporte de facturas:', err);
      notify.error('Error al generar el reporte de facturación');
    }
  };

  // Eliminación con doble seguridad de factura para usuarios autorizados
  const handleDeleteInvoiceConfirm = async () => {
    if (!invoiceToDelete) return;
    if (!isAdmin) {
      notify.error('No posee permisos autorizados para eliminar facturas emitidas.');
      return;
    }
    const factNum = formatInvoiceCorrelativo(invoiceToDelete);
    const isValid = deleteConfirmKeyword.trim().toUpperCase() === 'ELIMINAR' || deleteConfirmKeyword.trim() === factNum;
    if (!isValid) return;

    try {
      setIsDeletingInvoice(true);
      const key = String(invoiceToDelete.id || invoiceToDelete.numeroDoc || invoiceToDelete.factNum);
      if (onDeleteSale) {
        await onDeleteSale(invoiceToDelete);
      }
      setLocalDeletedInvoiceKeys(prev => {
        const next = new Map(prev);
        const nowTs = Date.now();
        const cKey = getEraScopedCanonicalDocKey(invoiceToDelete);
        if (cKey) next.set(cKey, nowTs);
        next.set(key, nowTs);
        if (invoiceToDelete.id) next.set(String(invoiceToDelete.id), nowTs);
        if (invoiceToDelete.numeroDoc) next.set(String(invoiceToDelete.numeroDoc), nowTs);
        if (invoiceToDelete.factNum) next.set(String(invoiceToDelete.factNum), nowTs);
        return next;
      });
      notify.success(`Factura #${factNum} eliminada de la base de datos con éxito`);
      setInvoiceToDelete(null);
      setDeleteConfirmKeyword('');
    } catch (err) {
      console.error('Error eliminando factura:', err);
      notify.error('Error al eliminar la factura: ' + (err.message || err));
    } finally {
      setIsDeletingInvoice(false);
    }
  };

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
                <span>{fiscalOrdersCount} Fiscales (Alm 01) • {notaEntregaOrdersCount} Notas de Entrega (Alm 02)</span>
              </div>
            </div>
          </div>

          {/* Botones de Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowClientsDirectoryModal(true)}
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(0, 43, 122, 0.35))',
                border: '1.5px solid rgba(16, 185, 129, 0.55)',
                color: isDark ? '#34d399' : '#047857',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
              title="Abrir Cartera Maestra de Clientes (Crear, Modificar, Guardar, Aprobar y Eliminar con Doble Seguridad)"
            >
              <Users size={16} />
              <span>Cartera de Clientes</span>
              <span
                style={{
                  background: isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                  color: isDark ? '#a7f3d0' : '#065f46',
                  fontSize: '0.72rem',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontWeight: 800
                }}
              >
                {clients.length}
              </span>
            </button>
          </div>
        </div>

        {/* BARRA DE NAVEGACIÓN POR PESTAÑAS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '0.6rem 1.5rem',
            background: 'var(--surface-input)',
            borderBottom: '1px solid var(--border-glass)',
            flexShrink: 0
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
            <span>2. Pedidos Fiscales ({fiscalOrdersCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pedidos_nota_entrega')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'pedidos_nota_entrega' ? '1.5px solid var(--semaforo-verde)' : '1px solid transparent',
              background: activeTab === 'pedidos_nota_entrega' ? (isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5') : 'transparent',
              color: activeTab === 'pedidos_nota_entrega' ? (isDark ? 'var(--semaforo-verde)' : '#047857') : 'var(--text-muted)'
            }}
          >
            <Package size={15} color={activeTab === 'pedidos_nota_entrega' ? 'var(--semaforo-verde)' : 'var(--text-muted)'} />
            <span>3. Pedidos por nota de entrega ({notaEntregaOrdersCount})</span>
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
              border: activeTab === 'facturar' ? '1.5px solid var(--motorven-gold)' : '1px solid transparent',
              background: activeTab === 'facturar' ? (isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7') : 'transparent',
              color: activeTab === 'facturar' ? (isDark ? 'var(--motorven-gold)' : '#b45309') : 'var(--text-muted)'
            }}
          >
            <CreditCard size={15} color="var(--motorven-gold)" />
            <span>4. Facturación en Caja (Cajera)</span>
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
              border: activeTab === 'imprimir' ? '1.5px solid #38bdf8' : '1px solid transparent',
              background: activeTab === 'imprimir' ? (isDark ? 'rgba(56, 189, 248, 0.18)' : '#e0f2fe') : 'transparent',
              color: activeTab === 'imprimir' ? (isDark ? '#38bdf8' : '#0284c7') : 'var(--text-muted)'
            }}
          >
            <Printer size={15} />
            <span>5. Orden de Entrega {selectedOrder?.status === 'FACTURADO' ? '✅' : '🔒'}</span>
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
            <span>6. Métricas & Volumen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('facturas_list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'facturas_list' ? '1.5px solid #06b6d4' : '1px solid transparent',
              background: activeTab === 'facturas_list' ? (isDark ? 'rgba(6, 182, 212, 0.18)' : '#cffafe') : 'transparent',
              color: activeTab === 'facturas_list' ? (isDark ? '#22d3ee' : '#0891b2') : 'var(--text-muted)'
            }}
          >
            <ReceiptText size={15} color={activeTab === 'facturas_list' ? (isDark ? '#22d3ee' : '#0891b2') : 'var(--text-muted)'} />
            <span>7. Listado de Facturas ({allInvoices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('solicitudes_clientes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'solicitudes_clientes' ? '1.5px solid #10b981' : '1px solid transparent',
              background: activeTab === 'solicitudes_clientes' ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5') : 'transparent',
              color: activeTab === 'solicitudes_clientes' ? (isDark ? '#34d399' : '#047857') : 'var(--text-muted)'
            }}
          >
            <UserPlus size={15} color={activeTab === 'solicitudes_clientes' ? (isDark ? '#34d399' : '#047857') : 'var(--text-muted)'} />
            <span>8. Solicitudes de Clientes ({pendingClientRequestsCount})</span>
            {pendingClientRequestsCount > 0 && (
              <span style={{
                background: '#f59e0b',
                color: '#0f172a',
                borderRadius: '999px',
                padding: '1px 6px',
                fontSize: '0.68rem',
                fontWeight: 900
              }}>
                NUEVO
              </span>
            )}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowCxcInvoiceModal(true)}
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.80rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Cargar Factura o Nota de Entrega editable a Cobranzas (CxC) para cuadrar facturas de noviembre"
            >
              <Plus size={15} color="#ffffff" />
              <span>+ Cargar a Cobranzas (CxC)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCorrelativoModal('FACTURA')}
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '6px 13px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.80rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title={`Decidir manualmente a partir de cuál número de factura fiscal empezar (Próxima: #${currentNextCorrelativo})`}
            >
              <RotateCcw size={14} color="#ffffff" />
              <span>Fijar N° Factura ({currentNextCorrelativo})</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCorrelativoModal('NOTA_ENTREGA')}
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '6px 13px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.80rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(13, 148, 136, 0.35)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title={`Decidir manualmente a partir de cuál número de Nota de Entrega empezar (Próxima: ${currentNextNeCorrelativo})`}
            >
              <RotateCcw size={14} color="#ffffff" />
              <span>Fijar N° Nota Entrega ({currentNextNeCorrelativo.replace(/^NE-/i, '')})</span>
            </button>

            <button
              type="button"
              onClick={() => generateOrdersPDF({ orders, config, currentUser, selectedOrder })}
              className="btn btn-print-report btn-sm"
              title="Descargar Reporte General de Pedidos y Despachos en PDF"
            >
              <Printer size={15} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
          </div>
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
                      Cliente Destinatario * ({filteredClients.length} de {approvedClients.length} aprobados)
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
                        style={{ fontSize: '0.8rem', flex: '1.2 1 160px', minWidth: 0, boxSizing: 'border-box' }}
                        title="Filtrar por tipo de Contribuyente Ordinario SENIAT (J, V, E, G, P)"
                      >
                        <option value="ALL">Todos los tipos ({approvedClients.length})</option>
                        {SENIAT_CONTRIBUTOR_TYPES.map(t => (
                          <option key={t.code} value={t.code} title={t.description}>
                            {t.label} ({clientContributorCounts[t.code] || 0})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedContributorTypeMeta && (
                      <div
                        style={{
                          fontSize: '0.7rem',
                          lineHeight: 1.35,
                          color: 'var(--text-secondary)',
                          background: 'rgba(14, 165, 233, 0.08)',
                          border: '1px solid rgba(14, 165, 233, 0.25)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          marginBottom: '6px'
                        }}
                      >
                        <strong style={{ color: 'var(--neon-cyan)' }}>• {selectedContributorTypeMeta.label}:</strong>{' '}
                        {selectedContributorTypeMeta.description}
                      </div>
                    )}
                    <select
                      className="form-control"
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      style={{ fontSize: '0.82rem', width: '100%' }}
                    >
                      <option value="">-- Seleccionar Cliente Registrado ({filteredClients.length}) --</option>
                      {filteredClients.map(c => {
                        const cType = resolveClientContributorType(c);
                        return (
                          <option key={c.id || c.codigo} value={c.id || c.codigo}>
                            {c.codigo || c.id} • {c.nombre || c.razonSocial} ({c.rif}) · [{cType}]
                          </option>
                        );
                      })}
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
                      onChange={(e) => {
                        hasManualPaymentTermRef.current = true;
                        setPaymentTerm(e.target.value);
                        setCreditOverrideApproved(false);
                        setCreditOverrideJustification('');
                      }}
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

                    {/* Tarjeta de Fecha de Emisión y Fecha de Vencimiento (= Emisión + Días de Crédito) y Modalidad */}
                    <div style={{
                      marginTop: '6px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.55)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '0.72rem'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>📅 Emisión: </span>
                        <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
                          {formatDateVe(fechaEmisionForm)}
                        </strong>
                      </div>
                      <span style={{
                        padding: '1px 7px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.66rem',
                        background: diasCreditoForm > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                        color: diasCreditoForm > 0 ? '#fbbf24' : '#34d399',
                        border: `1px solid ${diasCreditoForm > 0 ? '#f59e0b' : '#10b981'}`
                      }}>
                        {diasCreditoForm > 0 ? `+${diasCreditoForm} Días Crédito` : '0 Días (Contado)'}
                      </span>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>⏳ Vencimiento: </span>
                        <strong style={{ color: diasCreditoForm > 0 ? 'var(--motorven-gold)' : 'var(--neon-cyan)', fontFamily: 'var(--font-code)' }}>
                          {formatDateVe(fechaVencimientoForm)}
                        </strong>
                      </div>
                      <div style={{ display: 'inline-flex', gap: '4px', marginLeft: 'auto' }}>
                        <button
                          type="button"
                          onClick={() => setModalidadVenta('PREVENTA')}
                          className="btn btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            border: modalidadVenta === 'PREVENTA' ? '1px solid var(--neon-cyan)' : '1px solid transparent',
                            background: modalidadVenta === 'PREVENTA' ? 'var(--motorven-red)' : 'rgba(255,255,255,0.05)',
                            color: modalidadVenta === 'PREVENTA' ? '#fff' : 'var(--text-muted)'
                          }}
                          title="Factura Fiscal (Almacén 01) - Genera código PED-FF"
                        >
                          📄 Factura Fiscal
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalidadVenta('OFICINA')}
                          className="btn btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            border: modalidadVenta === 'OFICINA' ? '1px solid var(--semaforo-verde)' : '1px solid transparent',
                            background: modalidadVenta === 'OFICINA' ? '#0284c7' : 'rgba(255,255,255,0.05)',
                            color: modalidadVenta === 'OFICINA' ? '#fff' : 'var(--text-muted)'
                          }}
                          title="Nota de Entrega (Almacén 02) - Genera código PED-NE"
                        >
                          📦 Nota de Entrega
                        </button>
                      </div>
                    </div>

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
                            onClick={() => {
                              hasManualPaymentTermRef.current = false;
                              setPaymentTerm(clientAgreedInfo.termKey);
                              setCreditOverrideApproved(false);
                              setCreditOverrideJustification('');
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
                            userCanGrantCreditOverride ? (
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
                            ) : (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fca5a5' }}>
                                Requiere Gerencia / Master Admin
                              </span>
                            )
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

                {/* Filtro de tipos de lubricantes */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ flex: '2 1 220px', minWidth: 0 }}>
                    <input
                      type="text"
                      className="form-control"
                      value={lubSearchText}
                      onChange={(e) => setLubSearchText(e.target.value)}
                      placeholder="Buscar lubricante por código, nombre o viscosidad (ej. 20W50)..."
                      style={{ fontSize: '0.78rem', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: '1.5 1 200px', minWidth: 0 }}>
                    <select
                      className="form-control"
                      value={lubTypeFilter}
                      onChange={(e) => { setLubTypeFilter(e.target.value); setLubPresentationFilter('ALL'); }}
                      style={{ fontSize: '0.78rem', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                      title="Tipo de lubricante"
                    >
                      <option value="ALL">Todos los tipos ({safeProducts.length})</option>
                      {lubTypeOptions.map(([type, count]) => (
                        <option key={type} value={type}>{type} ({count})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <select
                      className="form-control"
                      value={lubPresentationFilter}
                      onChange={(e) => setLubPresentationFilter(e.target.value)}
                      style={{ fontSize: '0.78rem', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                      title="Presentación"
                    >
                      <option value="ALL">Todas las presentaciones</option>
                      {lubPresentationOptions.map(([pres, count]) => (
                        <option key={pres} value={pres}>{pres} ({count})</option>
                      ))}
                    </select>
                  </div>
                  {(lubTypeFilter !== 'ALL' || lubPresentationFilter !== 'ALL' || lubSearchText) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setLubTypeFilter('ALL'); setLubPresentationFilter('ALL'); setLubSearchText(''); }}
                      style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                    >
                      Limpiar filtros
                    </button>
                  )}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {filteredLubricants.length} de {safeProducts.length} lubricantes
                  </span>
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
                    const rowLitros = (Number(row.cantidad) || 0) * (Number(row.litrosUnitarios) || (matchedProd ? resolveProductLitersPerUnit(matchedProd) : 11.35));
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
                            <option value="">-- Seleccionar Lubricante ({filteredLubricants.length}) --</option>
                            {(matchedProd && !filteredLubricants.includes(matchedProd)
                              ? [matchedProd, ...filteredLubricants]
                              : filteredLubricants
                            ).map(p => {
                              const pStocks = getProductWarehouseStocks(p);
                              const activeWhCode = modalidadVenta === 'OFICINA' ? '02' : '01';
                              const activeStock = activeWhCode === '02' ? pStocks.stock02 : pStocks.stock01;
                              return (
                                <option
                                  key={p.id || p.codigo}
                                  value={p.id || p.codigo}
                                  disabled={activeStock <= 0}
                                >
                                  {p.codigo} - {p.descripcion} ({formatUsd(resolveProductWholesalePrice(p))}) [Alm {activeWhCode}: {activeStock}{activeStock <= 0 ? ' · AGOTADO' : ''}]
                                </option>
                              );
                            })}
                          </select>
                          {matchedProd && (() => {
                            const mStocks = getProductWarehouseStocks(matchedProd);
                            const whCode = modalidadVenta === 'OFICINA' ? '02' : '01';
                            const whStock = whCode === '02' ? mStocks.stock02 : mStocks.stock01;
                            return whStock <= 0 ? (
                              <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 800, marginTop: '3px' }}>
                                ⚠️ SKU con stock en 0 en Almacén {whCode} — no se permitirá emitir
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <div style={{ flex: '1 1 110px', minWidth: 0 }}>
                          <input
                            type="text"
                            className="form-control"
                            value={resolveProductUnit(row.unidad, 'Caja')}
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
                            {formatUnitVe(rowLitros)} Lts
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
                      {formatUnitVe(newOrderCalculations.totalLitros)} Litros
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
                  {!tab1WarehouseCheck.isValid && (
                    <div style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.14)',
                      border: '1px solid rgba(239, 68, 68, 0.45)',
                      color: '#fca5a5',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0, color: '#ef4444' }} />
                      <span>{tab1WarehouseCheck.message}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={isSaving || !tab1WarehouseCheck.isValid}
                      onClick={() => handleSaveOrderForm('PENDIENTE')}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', opacity: !tab1WarehouseCheck.isValid ? 0.55 : 1, cursor: !tab1WarehouseCheck.isValid ? 'not-allowed' : 'pointer' }}
                      title={!tab1WarehouseCheck.isValid ? tab1WarehouseCheck.message : 'Guardar borrador de nota de pedido sin enviar todavía a caja'}
                    >
                      <Clock size={16} />
                      <span>Guardar Borrador</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving || !tab1WarehouseCheck.isValid}
                      onClick={() => handleSaveOrderForm('APROBADO', true)}
                      className="btn btn-print-report"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        background: !tab1WarehouseCheck.isValid ? '#475569' : 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)',
                        borderColor: !tab1WarehouseCheck.isValid ? '#64748b' : 'rgba(59, 130, 246, 0.4)',
                        color: '#fff',
                        boxShadow: !tab1WarehouseCheck.isValid ? 'none' : '0 4px 14px rgba(30, 64, 175, 0.35)',
                        opacity: !tab1WarehouseCheck.isValid ? 0.6 : 1,
                        cursor: !tab1WarehouseCheck.isValid ? 'not-allowed' : 'pointer'
                      }}
                      title={!tab1WarehouseCheck.isValid ? tab1WarehouseCheck.message : 'Emitir nota de pedido y descargar automáticamente el PDF oficial para el vendedor y cliente'}
                    >
                      <Printer size={16} color="#ffffff" />
                      <span>Emitir y Descargar PDF Pedido</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving || !tab1WarehouseCheck.isValid}
                      onClick={() => handleSaveOrderForm('APROBADO', false, !isCreditNegado)}
                      className="btn btn-primary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        background: !tab1WarehouseCheck.isValid
                          ? '#475569'
                          : isCreditNegado
                            ? 'linear-gradient(135deg, #d97706, #b45309)'
                            : 'linear-gradient(135deg, var(--motorven-red), #b91c1c)',
                        borderColor: !tab1WarehouseCheck.isValid ? '#64748b' : (isCreditNegado ? '#d97706' : 'var(--motorven-red)'),
                        color: '#fff',
                        boxShadow: !tab1WarehouseCheck.isValid
                          ? 'none'
                          : isCreditNegado
                            ? '0 4px 14px rgba(217, 119, 6, 0.4)'
                            : '0 4px 14px rgba(220, 38, 38, 0.35)',
                        opacity: !tab1WarehouseCheck.isValid ? 0.6 : 1,
                        cursor: !tab1WarehouseCheck.isValid ? 'not-allowed' : 'pointer'
                      }}
                      title={!tab1WarehouseCheck.isValid ? tab1WarehouseCheck.message : (isCreditNegado ? 'Solicitar aprobación de crédito a Gerencia' : 'Emitir nota de pedido y enviarla al POS de Caja (Modo No Modificar)')}
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

          {/* TAB 2: PEDIDOS FISCALES & TAB 3: PEDIDOS POR NOTA DE ENTREGA */}
          {(() => {
            const renderOrdersPipelineTab = ({
              ordersList,
              kpis,
              isNotaEntrega,
              title,
              badgeText,
              badgeBg,
              badgeBorder,
              badgeColor,
              emptyText
            }) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Banner Informativo del Almacén y Tipo de Pedido */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    background: isNotaEntrega ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 240, 255, 0.08)',
                    border: `1px solid ${isNotaEntrega ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 240, 255, 0.25)'}`,
                    borderRadius: '12px',
                    padding: '8px 14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <span
                      style={{
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: badgeBg,
                        border: `1px solid ${badgeBorder}`,
                        color: badgeColor,
                        fontSize: '0.74rem'
                      }}
                    >
                      {badgeText}
                    </span>
                    <span>
                      {isNotaEntrega
                        ? 'Pedidos asignados al Almacén 02 (Despacho por Nota de Entrega). Correlativo oficial: PED-NE-XXXXXX'
                        : 'Pedidos asignados al Almacén 01 (Facturación Fiscal SENIAT). Correlativo oficial: PED-FF-XXXXXX'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {kpis.activeCount} pedidos activos • {kpis.facturados} facturados
                  </div>
                </div>

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
                      placeholder={`Buscar en ${title} por cliente, RIF, número o vendedor...`}
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
                      <option value="ALL">Todos los Estados ({kpis.activeCount})</option>
                      <option value="PENDIENTE">1. Preventas ({kpis.preventas})</option>
                      <option value="APROBADO">2. Aprobados ({kpis.aprobados})</option>
                      <option value="EN_TRANSITO">3. En Tránsito ({kpis.enTransito})</option>
                      <option value="FACTURADO">4. Facturados ({kpis.facturados})</option>
                      <option value="RETENIDO_CREDITO">⛔ Retenidos por Crédito ({kpis.retenidos || 0})</option>
                      <option value="ANULADO">🚫 Anulados ({kpis.anulados || 0})</option>
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
                  {ordersList.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <Truck size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                      <div style={{ fontSize: '1rem', fontWeight: 700 }}>{emptyText}</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Crea un nuevo pedido desde la pestaña 1 con la modalidad correspondiente.</div>
                    </div>
                  ) : (
                    ordersList.map(ord => {
                      const st = STATUS_CONFIG[ord.status] || STATUS_CONFIG.PENDIENTE;
                      const StatusIcon = st.icon;

                      return (
                        <div
                          key={ord.id}
                          style={{
                            background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                            border: selectedOrder?.id === ord.id ? `2px solid ${badgeColor}` : '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
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
                              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{ord.numeroDoc || ord.id}</span>
                                <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', background: badgeBg, color: badgeColor, fontWeight: 700 }}>
                                  {isNotaEntrega ? 'ALM-02 NE' : 'ALM-01 FF'}
                                </span>
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
                                  title="Esta preventa no fue facturada antes de las 72 horas desde su emisión; su reserva de stock se liberó automáticamente al almacén."
                                >
                                  <Clock size={10} /> Caducada 72h
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
                              🛢️ {formatUnitVe(ord.totalLitros || 0)} Lts
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
                              userCanGrantCreditOverride ? (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const approverName = currentUser?.nombre || currentUser?.username || 'Gerencia';
                                    const approvedOrder = {
                                      ...ord,
                                      status: 'APROBADO',
                                      creditOverrideApproved: true,
                                      creditOverrideAuthorizer: ord.creditOverrideAuthorizer || approverName,
                                      creditOverrideJustification: ord.creditOverrideJustification || `Liberado desde Pipeline por ${approverName}`,
                                      fechaAprobacion: new Date().toISOString()
                                    };
                                    if (onSaveOrder) {
                                      const saved = await onSaveOrder(approvedOrder);
                                      setSelectedOrder(saved || approvedOrder);
                                    } else if (onUpdateOrderStatus) {
                                      await onUpdateOrderStatus(ord.id, 'APROBADO');
                                      setSelectedOrder(approvedOrder);
                                    }
                                    setFeedbackMsg({
                                      type: 'success',
                                      text: `✅ ¡Crédito de la orden ${ord.numeroDoc || ord.id} APROBADO por ${approverName}! Ahora ha sido enviada a Caja para facturación.`
                                    });
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
                                <div
                                  style={{
                                    flex: 1,
                                    fontSize: '0.7rem',
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    color: '#fca5a5',
                                    fontWeight: 700,
                                    textAlign: 'center'
                                  }}
                                  title="Solo Master Admin o Gerencia autorizada pueden liberar órdenes retenidas por crédito."
                                >
                                  🔒 Requiere Gerencia
                                </div>
                              )
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

                            {isNotaEntrega && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(ord);
                                  generateDeliveryNotePDF({
                                    order: ord,
                                    config,
                                    currentUser,
                                    products: safeProducts,
                                    clients: safeClients,
                                    client: safeClients.find(c => c.id === ord.clienteId || c.rif === ord.clienteRif),
                                    autoPrint: true
                                  });
                                }}
                                className="btn btn-print-report btn-sm"
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '4px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                                }}
                                title="Imprimir y descargar Nota de Entrega en PDF Tamaño Carta con QR y desbordamiento 1/2"
                              >
                                <Printer size={13} color="#ffffff" /> 📄 Nota Entrega (Carta)
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

                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const isFacturado = ord.status === 'FACTURADO';
                                const docLabel = ord.numeroDoc || ord.id;
                                const confirmMsg = isFacturado
                                  ? `¿Está seguro de eliminar la Orden de Entrega y Factura ${docLabel}?\n\nEsta acción borrará la orden, la factura generada y devolverá el stock de productos al inventario.`
                                  : `¿Está seguro de eliminar el pedido ${docLabel}?`;
                                if (!window.confirm(confirmMsg)) return;

                                try {
                                  setIsSaving(true);
                                  if (isFacturado) {
                                    const ordDocKey = ord.nroFactura
                                      ? getEraScopedCanonicalDocKey({
                                          numeroDoc: ord.nroFactura,
                                          tipoDoc: isOrderNotaEntrega(ord) ? 'NOTA_ENTREGA' : (ord.tipoDocumento || ord.tipoDoc || 'FACTURA'),
                                          fechaEmision: ord.fechaFacturacion || ord.fecha
                                        })
                                      : '';
                                    const linkedSale = (sales || []).find(s =>
                                      s.pedidoOrigenId === ord.id ||
                                      (ord.facturaId && s.id === ord.facturaId) ||
                                      (ord.nroFactura && s.numeroDoc === ord.nroFactura) ||
                                      (ordDocKey && getEraScopedCanonicalDocKey(s) === ordDocKey)
                                    );
                                    if (linkedSale && onDeleteSale) {
                                      await onDeleteSale(linkedSale);
                                    }
                                  }
                                  if (onDeleteOrder) {
                                    await onDeleteOrder(ord.id);
                                  }
                                  if (selectedOrder?.id === ord.id) {
                                    setSelectedOrder(null);
                                  }
                                  setFeedbackMsg({
                                    type: 'success',
                                    text: `✅ Orden ${docLabel} eliminada correctamente.`
                                  });
                                  setTimeout(() => setFeedbackMsg(null), 3000);
                                } catch (err) {
                                  setFeedbackMsg({
                                    type: 'error',
                                    text: 'Error al eliminar la orden: ' + (err.message || 'Error desconocido')
                                  });
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                              className="btn btn-sm"
                              style={{
                                fontSize: '0.72rem',
                                padding: '4px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid var(--motorven-red)',
                                color: '#ef4444',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              title="Eliminar este pedido / orden de entrega"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );

            if (activeTab === 'pipeline') {
              return renderOrdersPipelineTab({
                ordersList: filteredFiscalOrders,
                kpis: fiscalKpis,
                isNotaEntrega: false,
                title: 'Pedidos Fiscales',
                badgeText: 'PEDIDOS FISCALES (ALMACÉN 01)',
                badgeBg: isDark ? 'rgba(0, 240, 255, 0.15)' : '#e0f2fe',
                badgeBorder: 'var(--neon-cyan, #0284c7)',
                badgeColor: isDark ? 'var(--neon-cyan, #00f0ff)' : '#0284c7',
                emptyText: 'No se encontraron pedidos fiscales con los filtros aplicados.'
              });
            }

            if (activeTab === 'pedidos_nota_entrega') {
              return renderOrdersPipelineTab({
                ordersList: filteredNotaEntregaOrders,
                kpis: notaEntregaKpis,
                isNotaEntrega: true,
                title: 'Pedidos por Nota de Entrega',
                badgeText: 'NOTAS DE ENTREGA (ALMACÉN 02)',
                badgeBg: isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5',
                badgeBorder: 'var(--semaforo-verde, #10b981)',
                badgeColor: isDark ? 'var(--semaforo-verde, #10b981)' : '#047857',
                emptyText: 'No se encontraron pedidos por nota de entrega con los filtros aplicados.'
              });
            }

            return null;
          })()}

          {/* TAB 4: FACTURACIÓN EN CAJA (CAJERA) */}
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
                  <span>La cajera recibe la Nota de Pedido del vendedor, cobra y emite la <strong>Factura Fiscal (Alm 01)</strong> o <strong>Nota de Entrega (Alm 02)</strong>. Al emitir se generará la <strong>Orden de Entrega (Paso 3)</strong>.</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Cajera en turno: <strong>{currentUser?.nombre || 'Caja Principal'}</strong>
                </span>
              </div>

              {!selectedOrder ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', borderRadius: '14px' }}>
                  <ShoppingCart size={42} style={{ color: 'var(--semaforo-verde)', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Seleccione una Nota de Pedido para Facturar / Emitir</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Seleccione un pedido fiscal (PED-FF) o nota de entrega (PED-NE) para proceder al cobro y emisión oficial.
                  </div>

                  <div style={{ maxWidth: '520px', margin: '1rem auto 0' }}>
                    <select
                      className="form-control"
                      onChange={(e) => {
                        const match = safeOrders.find(o => o.id === e.target.value);
                        if (match) setSelectedOrder(match);
                      }}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">-- Seleccionar Nota de Pedido Aprobada para Caja --</option>
                      {(() => {
                        const readyForCaja = safeOrders.filter((o) =>
                          ['APROBADO', 'EN_TRANSITO'].includes(String(o.status || '').toUpperCase())
                        );
                        if (readyForCaja.length === 0) {
                          return (
                            <option value="" disabled>
                              (No hay pedidos APROBADOS o EN TRÁNSITO pendientes por facturar)
                            </option>
                          );
                        }
                        return readyForCaja.map((o) => {
                          const isNE = isOrderNotaEntrega(o);
                          const stUpper = String(o.status || '').toUpperCase();
                          return (
                            <option key={o.id} value={o.id}>
                              {isNE ? '[NE Alm 02]' : '[FF Alm 01]'} {o.numeroDoc || o.id} • {o.clienteNombre} ({formatUsd(o.totalNetoUsd)}) • {stUpper === 'EN_TRANSITO' ? '🚚 EN TRÁNSITO' : '✅ APROBADO (LISTO CAJA)'}
                            </option>
                          );
                        });
                      })()}
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }}>
                  
                  <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                          Nota de Pedido: {selectedOrder.numeroDoc || selectedOrder.id}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Cliente: <strong>{selectedOrder.clienteNombre}</strong> ({selectedOrder.clienteRif || 'S/R'}) • Vendedor: <strong>{selectedOrder.vendedorId || 'No asignado'}</strong> • Condición: <strong style={{ color: 'var(--motorven-gold)' }}>{formatCondicionPago(selectedOrder.condicionPago)}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--neon-cyan)', marginTop: '3px', fontFamily: 'var(--font-code)' }}>
                          📅 Fecha Emisión: <strong>{formatDateVe(selectedOrder.fechaEmision || selectedOrder.fecha || new Date())}</strong>
                          {' • '}
                          ⏳ Fecha Vencimiento: <strong style={{ color: 'var(--motorven-gold)' }}>
                            {formatDateVe(
                              selectedOrder.fechaVencimiento ||
                              calculateExpirationDate(
                                selectedOrder.fechaEmision || selectedOrder.fecha || new Date(),
                                resolveCreditDaysFromTerm(selectedOrder.condicionPago, 15, selectedOrder.diasCredito)
                              )
                            )}
                          </strong>
                          {' '}({resolveCreditDaysFromTerm(selectedOrder.condicionPago, 15, selectedOrder.diasCredito)} Días Crédito)
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {onProceedToPOS && selectedOrder.status !== 'RETENIDO_CREDITO' && !['FACTURADO', 'ANULADO', 'ANULADA', 'RECHAZADO', 'CANCELADO', 'CADUCADO'].includes(selectedOrder.status) && (
                          <button
                            type="button"
                            onClick={() => onProceedToPOS(selectedOrder)}
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.72rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #059669)' }}
                          >
                            🚀 Abrir en POS de Caja (Modo No Modificar)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(null)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem' }}
                        >
                          Cambiar Orden
                        </button>
                      </div>
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
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{resolveProductUnit(it, 'Caja')}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.cantidad}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--motorven-gold)' }}>
                                    {formatUnitVe(it.litrosTotales || (it.cantidad * 11.35))} L
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
                          {formatUnitVe(selectedOrder.totalLitros || 0)} Lts
                        </div>
                      </div>

                      {(() => {
                        const { isOrdNE: isOrdNEBox, taxes: boxTaxes } = computeOrderBillingFiscal(selectedOrder, billingPaymentMethod, tasaBcv);
                        const showBilledTotal = selectedOrder.status === 'FACTURADO' && Number(selectedOrder.totalNetoUsd || selectedOrder.totalUsd || 0) > 0;
                        const displayTotalUsd = showBilledTotal
                          ? Number(selectedOrder.totalNetoUsd || selectedOrder.totalUsd || 0)
                          : boxTaxes.totalFacturaUsd;
                        return (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {isOrdNEBox
                                ? 'TOTAL NETO EXENTO ($ USD)'
                                : (showBilledTotal ? 'TOTAL FACTURADO ($ USD)' : 'TOTAL A FACTURAR ($ USD)')}
                            </div>
                            {!isOrdNEBox && !showBilledTotal && (
                              <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                                Base {formatUsd(boxTaxes.subtotalNetoUsd)} + IVA {formatUsd(boxTaxes.totalIvaUsd)}
                                {boxTaxes.igtfUsd > 0 ? ` + IGTF ${formatUsd(boxTaxes.igtfUsd)}` : ''}
                              </div>
                            )}
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                              {formatUsd(displayTotalUsd)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {formatBs(displayTotalUsd * tasaBcv)}
                            </div>
                          </div>
                        );
                      })()}
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
                          {userCanGrantCreditOverride ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const approverName = currentUser?.nombre || currentUser?.username || 'Gerencia';
                                const approvedOrder = {
                                  ...selectedOrder,
                                  status: 'APROBADO',
                                  creditOverrideApproved: true,
                                  creditOverrideAuthorizer: selectedOrder.creditOverrideAuthorizer || approverName,
                                  creditOverrideJustification: selectedOrder.creditOverrideJustification || `Liberado en Caja por ${approverName}`,
                                  fechaAprobacion: new Date().toISOString()
                                };
                                if (onSaveOrder) {
                                  const saved = await onSaveOrder(approvedOrder);
                                  setSelectedOrder(saved || approvedOrder);
                                } else if (onUpdateOrderStatus) {
                                  await onUpdateOrderStatus(selectedOrder.id, 'APROBADO');
                                  setSelectedOrder(approvedOrder);
                                }
                                setFeedbackMsg({
                                  type: 'success',
                                  text: `✅ ¡Crédito de la orden ${selectedOrder.numeroDoc || selectedOrder.id} APROBADO por ${approverName}! Facturación en Caja habilitada.`
                                });
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
                          ) : (
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fca5a5', padding: '6px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                              🔒 Solo Master Admin o Gerencia autorizada pueden liberar este crédito retenido.
                            </div>
                          )}
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

                        {(() => {
                          const isOrdNE = isOrderNotaEntrega(selectedOrder);
                          const billingWarehouseCheck = validateWarehouseStockForDocument({
                            items: selectedOrder?.items || [],
                            products: safeProducts,
                            tipoDoc: isOrdNE ? 'NOTA_ENTREGA' : 'FACTURA',
                            almacen: isOrdNE ? '02' : '01',
                            modalidadVenta: selectedOrder?.modalidadVenta
                          });
                          return (
                            <>
                              {!billingWarehouseCheck.isValid && (
                                <div
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.14)',
                                    border: '1px solid rgba(239, 68, 68, 0.55)',
                                    color: '#fca5a5',
                                    padding: '9px 11px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '7px',
                                    lineHeight: 1.35
                                  }}
                                >
                                  <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: '1px' }} />
                                  <span>{billingWarehouseCheck.message}</span>
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={isSaving || !billingWarehouseCheck.isValid}
                                onClick={async () => {
                                  const isOrdNotaEntrega = isOrderNotaEntrega(selectedOrder);
                                  const currentCheck = validateWarehouseStockForDocument({
                                    items: selectedOrder?.items || [],
                                    products: safeProducts,
                                    tipoDoc: isOrdNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
                                    almacen: isOrdNotaEntrega ? '02' : '01',
                                    modalidadVenta: selectedOrder?.modalidadVenta
                                  });
                                  if (!currentCheck.isValid) {
                                    notify.error(currentCheck.message);
                                    setFeedbackMsg({ type: 'error', text: currentCheck.message });
                                    return;
                                  }
                                  if (String(selectedOrder.status || '').toUpperCase() === 'FACTURADO') {
                                    notify.warning(`El pedido #${selectedOrder.numeroDoc || selectedOrder.id} ya figura como FACTURADO${selectedOrder.nroFactura ? ` (Factura #${selectedOrder.nroFactura})` : ''}.`);
                                    return;
                                  }
                                  const existingLinkedSale = (sales || []).find(s =>
                                    s &&
                                    s.pedidoOrigenId &&
                                    s.pedidoOrigenId === selectedOrder.id &&
                                    !['ANULADA', 'ANULADO'].includes(String(s.estado || '').toUpperCase())
                                  );
                                  if (existingLinkedSale) {
                                    notify.warning(`Este pedido ya tiene emitida la factura #${existingLinkedSale.numeroDoc || existingLinkedSale.id}.`);
                                    return;
                                  }
                                  setIsSaving(true);
                                  try {
                                    const nextInvoiceNum = isOrdNotaEntrega
                                      ? getNextNotaEntregaCorrelativo(sales, profitInvoices)
                                      : getNextInvoiceCorrelativo(sales, profitInvoices);
                                    const {
                                      isCredit,
                                      effectiveCondicion: effectiveCondicionPago,
                                      items: billingItems,
                                      taxes: billingTaxes
                                    } = computeOrderBillingFiscal(selectedOrder, billingPaymentMethod, tasaBcv);
                                    const billingNowIso = new Date().toISOString();

                                    let saleResult = null;
                                    if (onProcessSale) {
                                      saleResult = await onProcessSale({
                                        preserveOriginOrderOnSale: true,
                                        markOriginOrderBilled: true,
                                        orderId: selectedOrder.id,
                                        pedidoOrigenId: selectedOrder.id,
                                        pedidoOrigenDoc: selectedOrder.numeroDoc || selectedOrder.id,
                                        tipoDoc: isOrdNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
                                        almacen: isOrdNotaEntrega ? '02' : '01',
                                        numeroDoc: nextInvoiceNum,
                                        fechaEmision: billingNowIso,
                                        clienteId: selectedOrder.clienteId,
                                        clienteNombre: selectedOrder.clienteNombre,
                                        clienteRif: selectedOrder.clienteRif,
                                        clienteDireccion: selectedOrder.direccionEntrega,
                                        vendedor: selectedOrder.vendedorNombre || selectedOrder.vendedorId,
                                        vendedorId: selectedOrder.vendedorId,
                                        vendedorNombre: selectedOrder.vendedorNombre || '',
                                        items: billingItems,
                                        subtotalUsd: billingTaxes.subtotalNetoUsd,
                                        ivaUsd: billingTaxes.totalIvaUsd,
                                        igtfUsd: billingTaxes.igtfUsd,
                                        totalUsd: billingTaxes.totalFacturaUsd,
                                        totalBs: billingTaxes.totalFacturaBs,
                                        saldoUsd: isOrdNotaEntrega ? billingTaxes.subtotalNetoUsd : billingTaxes.totalFacturaUsd,
                                        saldoBs: isOrdNotaEntrega ? billingTaxes.subtotalNetoBs : billingTaxes.totalFacturaBs,
                                        metodoPago: billingPaymentMethod === 'CREDITO' ? 'CREDITO' : billingPaymentMethod,
                                        condicionPago: effectiveCondicionPago,
                                        diasCredito: isCredit ? resolveCreditDaysFromTerm(effectiveCondicionPago, 15, selectedOrder.diasCredito) : 0
                                      });
                                    }

                                    const invoiceNum = saleResult?.numeroDoc || nextInvoiceNum;
                                    if (!isOrdNotaEntrega) {
                                      commitInvoiceCorrelativo(invoiceNum);
                                    } else {
                                      commitNotaEntregaCorrelativo(invoiceNum);
                                    }
                                    setCorrelativoRefreshKey(k => k + 1);

                                    const billedOrder = {
                                      ...selectedOrder,
                                      status: 'FACTURADO',
                                      nroFactura: invoiceNum,
                                      facturaId: saleResult?.id || undefined,
                                      fechaFactura: billingNowIso,
                                      cajera: currentUser?.nombre || 'Caja Principal',
                                      metodoPagoFactura: billingPaymentMethod,
                                      totalBrutoUsd: saleResult?.subtotalUsd ?? billingTaxes.subtotalNetoUsd,
                                      ivaUsd: saleResult?.ivaUsd ?? billingTaxes.totalIvaUsd,
                                      igtfUsd: saleResult?.igtfUsd ?? billingTaxes.igtfUsd,
                                      totalNetoUsd: saleResult?.totalUsd ?? billingTaxes.totalFacturaUsd,
                                      totalUsd: saleResult?.totalUsd ?? billingTaxes.totalFacturaUsd,
                                      saldoUsd: saleResult?.saldoUsd ?? (isCredit ? (saleResult?.totalUsd ?? billingTaxes.totalFacturaUsd) : 0)
                                    };

                              if (onSaveOrder) {
                                await onSaveOrder(billedOrder);
                              } else if (onUpdateOrderStatus) {
                                await onUpdateOrderStatus(selectedOrder.id, 'FACTURADO');
                              }

                              setSelectedOrder(billedOrder);

                              notify.success("FACTURA REALIZADA CON EXITO");
                              setFeedbackMsg({
                                type: 'success',
                                text: `FACTURA REALIZADA CON EXITO (Factura N° ${invoiceNum}) — Se generó la Orden de Entrega.`
                              });

                              setTimeout(() => {
                                setActiveTab('imprimir');
                                setFeedbackMsg(null);
                              }, 300);

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
                            marginTop: 'auto',
                            opacity: (isSaving || !billingWarehouseCheck.isValid) ? 0.55 : 1,
                            cursor: (isSaving || !billingWarehouseCheck.isValid) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isSaving ? 'Emitiendo Factura...' : '⚡ 2. Emitir Factura en Caja & Generar Orden de Entrega'}
                        </button>
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 5: ORDEN DE ENTREGA / GUÍA DE DESPACHO */}
          {activeTab === 'imprimir' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {!selectedOrder ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', borderRadius: '14px' }}>
                  <FileText size={42} style={{ color: 'var(--motorven-gold)', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Seleccione una Orden para Ver su Orden de Entrega</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Seleccione una orden de Pedidos Fiscales o Pedidos por Nota de Entrega para consultar o imprimir su documento oficial.
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab(selectedOrder && isOrderNotaEntrega(selectedOrder) ? 'pedidos_nota_entrega' : 'pipeline')}
                    className="btn btn-secondary"
                    style={{ marginTop: '1rem', fontSize: '0.82rem' }}
                  >
                    Ir al Listado de Pedidos
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
                      onClick={() => setActiveTab(selectedOrder && isOrderNotaEntrega(selectedOrder) ? 'pedidos_nota_entrega' : 'pipeline')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '10px 18px' }}
                    >
                      Volver a Pedidos
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
                      {isOrderNotaEntrega(selectedOrder) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const clientMatch = safeClients.find(c => c.id === selectedOrder.clienteId || c.rif === selectedOrder.clienteRif);
                            generateDeliveryNotePDF({
                              order: selectedOrder,
                              config,
                              currentUser,
                              products: safeProducts,
                              clients: safeClients,
                              client: clientMatch,
                              autoPrint: true
                            });
                            notify.success(`Nota de Entrega generada en tamaño Carta`);
                          }}
                          className="btn btn-print-report"
                          style={{
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
                          }}
                          title="Descargar e imprimir Nota de Entrega oficial tamaño Carta (Almacén 02) con desbordamiento y numeración de páginas"
                        >
                          <Printer size={16} color="#ffffff" /> 📦 Nota de Entrega (Carta)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenInvoiceModalForOrder(selectedOrder)}
                          className="btn btn-print-report"
                          style={{
                            background: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                            boxShadow: '0 4px 14px rgba(0, 43, 122, 0.4)'
                          }}
                          title="Generar e imprimir Factura Fiscal Oficial (Formato Carta SENIAT con correlativo de 6 dígitos)"
                        >
                          <Printer size={16} color="#ffffff" /> 📄 Factura Fiscal (Carta)
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => generateSellerOrderPDF({
                          order: selectedOrder,
                          config,
                          currentUser,
                          client: safeClients.find(c => c.id === selectedOrder.clienteId || c.rif === selectedOrder.clienteRif)
                        })}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Descargar Nota de Pedido / Cotización de Preventa en PDF para el Vendedor (guarda en su dispositivo)"
                      >
                        <FileText size={16} /> <span>Nota Pedido Vendedor</span>
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

                      <button
                        type="button"
                        onClick={async () => {
                          const docLabel = selectedOrder.nroFactura || selectedOrder.numeroDoc || selectedOrder.id;
                          const confirmMsg = `¿Desea anular y eliminar esta Orden de Entrega y su Factura fiscal (${docLabel})?\n\nEsta acción borrará la orden, la factura emitida y devolverá automáticamente las cantidades al inventario.`;
                          if (!window.confirm(confirmMsg)) return;

                          try {
                            setIsSaving(true);
                            const selDocKey = selectedOrder.nroFactura
                              ? getEraScopedCanonicalDocKey({
                                  numeroDoc: selectedOrder.nroFactura,
                                  tipoDoc: isOrderNotaEntrega(selectedOrder) ? 'NOTA_ENTREGA' : (selectedOrder.tipoDocumento || selectedOrder.tipoDoc || 'FACTURA'),
                                  fechaEmision: selectedOrder.fechaFacturacion || selectedOrder.fecha
                                })
                              : '';
                            const linkedSale = (sales || []).find(s =>
                              s.pedidoOrigenId === selectedOrder.id ||
                              (selectedOrder.facturaId && s.id === selectedOrder.facturaId) ||
                              (selectedOrder.nroFactura && s.numeroDoc === selectedOrder.nroFactura) ||
                              (selDocKey && getEraScopedCanonicalDocKey(s) === selDocKey)
                            );
                            if (linkedSale && onDeleteSale) {
                              await onDeleteSale(linkedSale);
                            }
                            if (onDeleteOrder) {
                              await onDeleteOrder(selectedOrder.id);
                            }
                            const wasNotaEntrega = isOrderNotaEntrega(selectedOrder);
                            setSelectedOrder(null);
                            setActiveTab(wasNotaEntrega ? 'pedidos_nota_entrega' : 'pipeline');
                            setFeedbackMsg({
                              type: 'success',
                              text: `✅ Orden de Entrega y Factura ${docLabel} eliminadas exitosamente. Stock restituido.`
                            });
                            setTimeout(() => setFeedbackMsg(null), 3500);
                          } catch (err) {
                            setFeedbackMsg({
                              type: 'error',
                              text: 'Error al eliminar la orden de entrega: ' + (err.message || 'Error desconocido')
                            });
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        className="btn btn-sm"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid var(--motorven-red)',
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Anular y eliminar esta Orden de Entrega y Factura emitida, restituyendo el inventario"
                      >
                        <Trash2 size={16} /> <span>Anular / Eliminar Orden</span>
                      </button>
                    </div>
                  </div>

                  {/* Selector de Vista de Documento de Entrega */}
                  <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.6rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${deliveryDocView === 'GUIA' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setDeliveryDocView('GUIA')}
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Truck size={14} /> 📦 Vista: Orden de Entrega / Despacho
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${deliveryDocView === 'FACTURA' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setDeliveryDocView('FACTURA')}
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <FileText size={14} /> {isOrderNotaEntrega(selectedOrder) ? '📄 Vista: Nota de Entrega Carta' : '📄 Vista: Factura Fiscal Carta (SENIAT)'}
                    </button>
                  </div>

                  {deliveryDocView === 'GUIA' ? (
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
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{resolveProductUnit(it, 'Caja')}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>{it.cantidad}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatUnitVe(it.litrosTotales || (it.cantidad * 11.35))} L</td>
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
                            TOTAL LITROS: <strong>{formatUnitVe(selectedOrder?.totalLitros || 0)} L</strong>
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
                  ) : (
                    /* VISTA FACTURA CARTA SENIAT / NOTA DE ENTREGA CARTA */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
                      <div className="no-print" style={{ width: '100%', maxWidth: '760px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 64, 175, 0.12)', border: '1px solid #3b82f6', borderRadius: '8px', padding: '8px 14px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>
                          {isOrderNotaEntrega(selectedOrder)
                            ? '📦 Formato Nota de Entrega Tamaño Carta (Estilo MOTORVEN con QR y desbordamiento 1/2)'
                            : '📄 Formato Factura Carta SENIAT (Márgenes: Sup 4.5cm, Inf 4.5cm, Lat 1.5cm • Correlativo 6 dígitos)'}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {isOrderNotaEntrega(selectedOrder) && (
                            <button
                              type="button"
                              onClick={() => {
                                const clientMatch = safeClients.find(c => c.id === selectedOrder.clienteId || c.rif === selectedOrder.clienteRif);
                                generateDeliveryNotePDF({
                                  order: selectedOrder,
                                  config,
                                  currentUser,
                                  products: safeProducts,
                                  clients: safeClients,
                                  client: clientMatch,
                                  autoPrint: true
                                });
                              }}
                              className="btn btn-print-report btn-sm"
                              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Printer size={13} color="#ffffff" /> Imprimir PDF Carta
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceModalForOrder(selectedOrder)}
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Maximize2 size={13} /> Abrir Ventana Completa
                          </button>
                        </div>
                      </div>

                      <div
                        className="carta-page"
                        style={{
                          width: '760px',
                          minHeight: '1000px',
                          background: '#ffffff',
                          color: '#0f172a',
                          padding: '4.5cm 1.5cm 4.5cm 1.5cm',
                          borderRadius: '6px',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                          fontSize: '0.78rem',
                          lineHeight: '1.4',
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative'
                        }}
                      >
                        {/* Guías visuales informativas */}
                        <div
                          className="no-print"
                          style={{
                            position: 'absolute',
                            top: '1.2cm',
                            left: '1.5cm',
                            right: '1.5cm',
                            borderBottom: '1px dashed #cbd5e1',
                            paddingBottom: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.66rem',
                            color: '#94a3b8',
                            userSelect: 'none'
                          }}
                        >
                          <span>Margen Superior: 4.5 cm (Espacio para Membrete Preimpreso)</span>
                          <span>Papel Carta SENIAT</span>
                        </div>

                        <div
                          className="no-print"
                          style={{
                            position: 'absolute',
                            bottom: '1.2cm',
                            left: '1.5cm',
                            right: '1.5cm',
                            borderTop: '1px dashed #cbd5e1',
                            paddingTop: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.66rem',
                            color: '#94a3b8',
                            userSelect: 'none'
                          }}
                        >
                          <span>Margen Inferior: 4.5 cm (Espacio para Pie Legal Preimpreso)</span>
                          <span>Márgenes Laterales: 1.5 cm</span>
                        </div>

                        <div>
                          {/* Correlativo de 6 Dígitos Consecutivos (Ej: 000000, 000001, 000002) */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '0.65rem' }}>
                            <div style={{ textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 14px', background: '#f8fafc' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                FACTURA N°
                              </div>
                              <div style={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'monospace', color: '#0f172a', letterSpacing: '2px' }}>
                                {String(selectedOrder.nroFactura || selectedOrder.numeroDoc || '000000').replace(/[^0-9]/g, '').slice(-6).padStart(6, '0') || '000000'}
                              </div>
                            </div>
                          </div>

                          {/* Metadatos del Adquirente */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '0.85rem', background: '#f8fafc', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.85rem' }}>
                            <div>
                              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Datos del Adquirente:</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>{selectedOrder.clienteNombre || 'Cliente General'}</div>
                              <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                                <strong>RIF / C.I.:</strong> <code>{selectedOrder.clienteRif || 'J-00000000'}</code>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                Domicilio Fiscal: {selectedOrder.direccionEntrega || 'Zona Industrial Valencia'}
                              </div>
                            </div>

                            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '0.85rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ color: '#64748b' }}>Fecha de Emisión:</span>
                                <strong>{selectedOrder.fechaFactura ? new Date(selectedOrder.fechaFactura).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE')}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ color: '#64748b' }}>Condición de Pago:</span>
                                <strong>{selectedOrder.condicionPago || 'CONTADO'}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ color: '#64748b' }}>Método de Pago:</span>
                                <span>{selectedOrder.metodoPagoFactura || 'EFECTIVO USD'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ color: '#64748b' }}>Tasa Oficial BCV:</span>
                                <strong style={{ color: '#d97706' }}>{formatBs(tasaBcv)} / USD</strong>
                              </div>
                            </div>
                          </div>

                          {/* Tabla de Renglones */}
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem', fontSize: '0.74rem' }}>
                            <thead>
                              <tr style={{ background: '#002b7a', color: '#ffffff', textAlign: 'left' }}>
                                <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center' }}>#</th>
                                <th style={{ padding: '6px 8px' }}>DESCRIPCIÓN DEL LUBRICANTE</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center', width: '50px' }}>CANT.</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right', width: '75px' }}>P. UNIT ($)</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center', width: '65px' }}>ALÍC.</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right', width: '85px' }}>SUBTOTAL ($)</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right', width: '105px' }}>TOTAL (BS.)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {resolveDeliveryNoteLineItems(selectedOrder, safeProducts, tasaBcv).map((it, idx) => {
                                const cant = Number(it.cantidad || 1);
                                const precio = Number(it.precioUsd ?? it.precioUnitarioUsd ?? 0);
                                const subUsd = Number(it.subtotalUsd ?? it.totalUsd ?? (cant * precio));
                                const subBs = subUsd * tasaBcv;
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                    <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                                    <td style={{ padding: '5px 8px' }}>
                                      <strong style={{ color: '#0f172a' }}>{it.descripcion}</strong>
                                      <div style={{ fontSize: '0.64rem', color: '#64748b' }}>{it.codigo}</div>
                                    </td>
                                    <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>{cant}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatUsd(precio)}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                      <span style={{ fontSize: '0.64rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>16%</span>
                                    </td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatUsd(subUsd)}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>{formatBs(subBs)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Totales y Firma */}
                        <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.25fr', gap: '0.85rem', alignItems: 'end', marginBottom: '0.45rem' }}>
                            <div>
                              <div style={{ border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.65rem 0.85rem', background: '#fafafa', textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px solid #94a3b8', width: '80%', margin: '0.85rem auto 4px auto' }} />
                                <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#0f172a' }}>Firma y Sello de Recepción</div>
                                <div style={{ fontSize: '0.64rem', color: '#64748b' }}>C.I. / RIF del Receptor • Fecha: ____/____/________</div>
                              </div>
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.75rem 0.85rem' }}>
                              {(() => {
                                const isNe = isOrderNotaEntrega(selectedOrder);
                                const totUsd = Number(selectedOrder.totalNetoUsd || selectedOrder.totalUsd || 0);
                                const baseUsd = isNe ? totUsd : (totUsd > 0 ? totUsd / 1.16 : 0);
                                const ivaUsd = isNe ? 0 : (totUsd - baseUsd);
                                return (
                                  <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.72rem', color: '#475569' }}>
                                      <span>{isNe ? 'Subtotal Neto (Sin IVA):' : 'Base Imponible General (16%):'}</span>
                                      <strong>{formatUsd(baseUsd)} ({formatBs(baseUsd * tasaBcv)})</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.72rem', color: '#475569' }}>
                                      <span>{isNe ? 'IVA (0% - Sin IVA):' : 'Débito Fiscal IVA (16%):'}</span>
                                      <strong>{formatUsd(ivaUsd)} ({formatBs(ivaUsd * tasaBcv)})</strong>
                                    </div>
                                    <div style={{ borderTop: '2px solid #002b7a', margin: '6px 0 5px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#64748b' }}>Total de la Factura:</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>
                                          {formatUsd(totUsd)}
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Total Oficial en Bolívares:</div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#d97706', fontFamily: 'monospace' }}>
                                          {formatBs(totUsd * tasaBcv)}
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Pie Oficial Carta con Leyenda Legal */}
                          {(() => {
                            const isOrderNe = selectedOrder.tipoDoc === 'NOTA_ENTREGA' || String(selectedOrder.factNum || selectedOrder.nroFactura || '').toUpperCase().startsWith('NE');
                            const isOrderFactOrNe = !selectedOrder.tipoDoc || selectedOrder.tipoDoc === 'FACTURA' || isOrderNe;
                            const totUsd = Number(selectedOrder.totalNetoUsd || selectedOrder.totalUsd || 0);
                            const totBs = Number(selectedOrder.totalBs || (totUsd * tasaBcv));
                            return (
                              <div style={{
                                borderTop: '1px solid #cbd5e1',
                                paddingTop: '0.4rem',
                                display: 'flex',
                                justifyContent: isOrderFactOrNe ? 'space-between' : 'flex-end',
                                alignItems: 'center',
                                gap: '0.75rem',
                                fontSize: '0.72rem',
                                color: '#64748b',
                                fontWeight: 700
                              }}>
                                {isOrderFactOrNe && (
                                  <div style={{
                                    fontSize: '0.64rem',
                                    color: '#475569',
                                    fontWeight: 500,
                                    textAlign: 'left',
                                    maxWidth: '75%',
                                    lineHeight: '1.25'
                                  }}>
                                    Monto en <strong>{formatBs(totBs)}</strong>, referencial a la fecha de emisión. Los pagos en Bs se deberán realizar según la tasa oficial BCV a la fecha de su cancelación.
                                  </div>
                                )}
                                <span style={{ background: '#f1f5f9', padding: '2px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                  PÁGINA 1 / 1
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          )}

          {/* TAB 6: MÉTRICAS & VOLUMEN */}
          {activeTab === 'metricas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Pedidos Registrados</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-heading)', marginTop: '4px' }}>{pipelineKpis.total}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--neon-cyan)', marginTop: '2px' }}>
                    {fiscalOrders.length} Fiscales (PED-FF) • {notaEntregaOrders.length} N. Entrega (PED-NE)
                  </div>
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

          {/* TAB 8: SOLICITUDES DE NUEVOS CLIENTES DESDE PREVENTA MÓVIL */}
          {activeTab === 'solicitudes_clientes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                border: '1px solid rgba(16, 185, 129, 0.35)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isDark ? '#34d399' : '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserPlus size={18} /> Solicitudes de Altas de Nuevos Clientes (Vendedores)
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Revise RIF, datos de contacto, zona y cupo de crédito sugerido. Al aprobar, el cliente se guarda automáticamente en el Maestro de Clientes.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'ALL', label: `Todas (${clientRequests.length})` },
                    { id: 'PENDIENTE_APROBACION', label: `Pendientes (${clientRequests.filter(r => r.status === 'PENDIENTE_APROBACION').length})` },
                    { id: 'APROBADO', label: `Aprobadas (${clientRequests.filter(r => r.status === 'APROBADO').length})` },
                    { id: 'RECHAZADO', label: `Rechazadas (${clientRequests.filter(r => r.status === 'RECHAZADO').length})` }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setClientReqFilter(f.id)}
                      className="btn btn-sm"
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '5px 10px',
                        borderRadius: '8px',
                        background: clientReqFilter === f.id ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
                        color: clientReqFilter === f.id ? (isDark ? '#34d399' : '#047857') : 'var(--text-muted)',
                        border: `1px solid ${clientReqFilter === f.id ? '#10b981' : 'var(--border-glass)'}`
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="🔍 Buscar solicitud por nombre, RIF, N° solicitud, vendedor o zona..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', fontSize: '0.84rem' }}
                />
              </div>

              {filteredClientRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
                  <UserPlus size={40} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>No hay solicitudes de clientes con este filtro</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Cuando los asesores envíen un nuevo cliente desde Preventa Móvil aparecerá aquí para su aprobación.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredClientRequests.map((req) => {
                    const isPending = req.status === 'PENDIENTE_APROBACION';
                    const isApproved = req.status === 'APROBADO';
                    const ov = clientReqOverrides[req.id] || {};
                    const editLimite = ov.limiteCreditoUsd ?? req.limiteCreditoUsd;
                    const editDias = ov.diasCredito ?? req.diasCredito;
                    const editCodigo = ov.codigo ?? `CLI-${String(req.id || '').slice(-6)}`;

                    return (
                      <div
                        key={req.id}
                        style={{
                          border: `1px solid ${isPending ? 'rgba(245, 158, 11, 0.5)' : isApproved ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.4)'}`,
                          borderRadius: '12px',
                          padding: '1rem',
                          background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                                {req.solicitudDoc}
                              </span>
                              <strong style={{ fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                                {req.nombre}
                              </strong>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '2px 10px',
                                borderRadius: '999px',
                                background: isPending ? 'rgba(245, 158, 11, 0.18)' : isApproved ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                                color: isPending ? '#fbbf24' : isApproved ? '#34d399' : '#f87171',
                                border: `1px solid ${isPending ? '#f59e0b' : isApproved ? '#10b981' : '#ef4444'}`
                              }}>
                                {isPending ? '⏳ PENDIENTE APROBACIÓN' : isApproved ? '✓ CLIENTE APROBADO' : '✕ RECHAZADO'}
                              </span>
                              {req.esContribuyenteEspecial && (
                                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Contribuyente Especial</span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                              <span>RIF: <strong style={{ color: 'var(--text-primary)' }}>{req.rif}</strong></span>
                              <span>Tel: <strong style={{ color: 'var(--text-primary)' }}>{req.telefono || '—'}</strong></span>
                              {req.email && <span>Email: {req.email}</span>}
                              {req.responsable && <span>Contacto: {req.responsable}</span>}
                              <span>Segmento: {req.tipoCliente}</span>
                              <span>Zona: <strong>{req.zonaNombre || req.zonaVenta}</strong></span>
                            </div>

                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                              <strong>Dirección:</strong> {req.direccion || 'No especificada'} {req.ciudad ? `(${req.ciudad})` : ''}
                            </div>

                            {req.notasVendedor && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                <strong>Notas vendedor:</strong> {req.notasVendedor}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: 'right', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            <div>Solicitado por: <strong style={{ color: 'var(--text-primary)' }}>{req.vendedorNombre || req.vendedorAsignado}</strong></div>
                            <div>Fecha: {formatDateVe(req.fechaSolicitud)}</div>
                            {req.aprobadoPor && <div>Resuelto por: <strong>{req.aprobadoPor}</strong></div>}
                            {req.motivoRechazo && <div style={{ color: '#f87171' }}>Motivo: {req.motivoRechazo}</div>}
                          </div>
                        </div>

                        {isPending && (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '8px',
                            paddingTop: '10px',
                            borderTop: '1px dashed var(--border-glass)',
                            alignItems: 'end'
                          }}>
                            <div>
                              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Código Asignado</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editCodigo}
                                onChange={(e) => setClientReqOverrides((prev) => ({ ...prev, [req.id]: { ...prev[req.id], codigo: e.target.value.toUpperCase() } }))}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Límite Crédito (USD)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control form-control-sm"
                                value={editLimite}
                                onChange={(e) => setClientReqOverrides((prev) => ({ ...prev, [req.id]: { ...prev[req.id], limiteCreditoUsd: e.target.value } }))}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Días de Crédito</label>
                              <select
                                className="form-control form-control-sm"
                                value={editDias}
                                onChange={(e) => setClientReqOverrides((prev) => ({ ...prev, [req.id]: { ...prev[req.id], diasCredito: Number(e.target.value) } }))}
                              >
                                <option value={0}>Contado (0d)</option>
                                <option value={7}>7 Días</option>
                                <option value={15}>15 Días</option>
                                <option value={21}>21 Días</option>
                                <option value={30}>30 Días</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Motivo (si rechaza)</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Opcional si aprueba..."
                                value={rejectReasonByReqId[req.id] || ''}
                                onChange={(e) => setRejectReasonByReqId((prev) => ({ ...prev, [req.id]: e.target.value }))}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {userCanApproveClients ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleRejectClientRequest(req)}
                                    className="btn btn-sm"
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.16)',
                                      color: '#f87171',
                                      border: '1px solid #ef4444',
                                      fontWeight: 800,
                                      padding: '6px 10px'
                                    }}
                                  >
                                    ✕ Rechazar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleApproveClientRequest(req)}
                                    className="btn btn-sm"
                                    style={{
                                      background: 'linear-gradient(135deg, #10b981, #059669)',
                                      color: '#fff',
                                      border: 'none',
                                      fontWeight: 800,
                                      padding: '6px 12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}
                                  >
                                    <Check size={14} /> Aprobar Cliente
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fca5a5', padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                  🔒 Solo Gerencia / Cobranzas / Caja pueden aprobar clientes
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: LISTADO DE FACTURAS (LIST VIEW) */}
          {activeTab === 'facturas_list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* KPIS DE FACTURACIÓN */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Facturas Emitidas</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-heading)', marginTop: '4px' }}>
                    {invoiceKpis.totalFacturas}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--neon-cyan)', marginTop: '2px', fontWeight: 600 }}>
                    Gran Total: {formatUsd(invoiceKpis.totalNetoUsd)}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Facturas a Contado</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '4px' }}>
                    {invoiceKpis.contadoCount}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {formatUsd(invoiceKpis.contadoUsd)} • {formatBs(invoiceKpis.contadoUsd * tasaBcv)}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Facturas a Crédito</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--brand-blue, #3b82f6)', marginTop: '4px' }}>
                    {invoiceKpis.creditoCount}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {formatUsd(invoiceKpis.creditoUsd)} • {formatBs(invoiceKpis.creditoUsd * tasaBcv)}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-input, rgba(255, 255, 255, 0.03))', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Tasa Oficial BCV</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--motorven-gold)', marginTop: '4px' }}>
                    {formatBs(tasaBcv)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Base de Liquidación Tributaria
                  </div>
                </div>
              </div>

              {/* BARRA DE FILTROS & ACCIONES */}
              {(() => {
                const hasActiveFilters = Boolean(
                  invoiceConditionFilter !== 'ALL' ||
                  invoiceDocTypeFilter !== 'ALL' ||
                  invoiceSearchQuery.trim() ||
                  invoicePeriodFilter !== 'ALL' ||
                  invoiceNumColFilter.trim() ||
                  isDatePeriodFilterActive(invoiceDateFilter) ||
                  invoiceClientColFilter.trim() ||
                  invoiceSellerColFilter !== 'ALL' ||
                  invoiceCondColFilter !== 'ALL' ||
                  invoiceItemsColFilter !== 'ALL' ||
                  invoiceMinUsdFilter !== '' ||
                  invoiceMinBsFilter !== ''
                );

                const renderSortArrow = (field) => {
                  if (invoiceSortField === field) {
                    return invoiceSortDirection === 'asc'
                      ? <ArrowUp size={12} color="var(--neon-cyan, #38bdf8)" />
                      : <ArrowDown size={12} color="var(--neon-cyan, #38bdf8)" />;
                  }
                  return <ArrowUpDown size={12} style={{ opacity: 0.55 }} />;
                };

                const filterInputStyle = {
                  width: '100%',
                  fontSize: '0.72rem',
                  padding: '4px 7px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-glass, rgba(255,255,255,0.14))',
                  background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
                  color: 'var(--text-primary)',
                  outline: 'none'
                };

                return (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))'
                      }}
                    >
                      {/* Botones de filtro: Todas, Contado, Crédito */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setInvoiceConditionFilter('ALL')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            background: invoiceConditionFilter === 'ALL' ? 'var(--brand-blue, #2563eb)' : 'transparent',
                            color: invoiceConditionFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)'
                          }}
                        >
                          Todas ({invoiceKpis.totalFacturas})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceConditionFilter('CONTADO')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            background: invoiceConditionFilter === 'CONTADO' ? 'var(--semaforo-verde, #10b981)' : 'transparent',
                            color: invoiceConditionFilter === 'CONTADO' ? '#ffffff' : 'var(--text-muted)'
                          }}
                        >
                          🟢 Contado ({invoiceKpis.contadoCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceConditionFilter('CREDITO')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            background: invoiceConditionFilter === 'CREDITO' ? '#8b5cf6' : 'transparent',
                            color: invoiceConditionFilter === 'CREDITO' ? '#ffffff' : 'var(--text-muted)'
                          }}
                        >
                          🔵 Crédito ({invoiceKpis.creditoCount})
                        </button>
                      </div>

                      {/* Filtro de Tipo de Documento */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
                        {[
                          { id: 'ALL', label: 'Todos' },
                          { id: 'FACTURA', label: 'Facturas' },
                          { id: 'NOTA_ENTREGA', label: 'Notas Entrega' }
                        ].map((dt) => (
                          <button
                            key={dt.id}
                            type="button"
                            onClick={() => setInvoiceDocTypeFilter(dt.id)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              background: invoiceDocTypeFilter === dt.id ? '#0284c7' : 'transparent',
                              color: invoiceDocTypeFilter === dt.id ? '#ffffff' : 'var(--text-muted)'
                            }}
                          >
                            {dt.label}
                          </button>
                        ))}
                      </div>

                      {/* Buscador de facturas */}
                      <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Buscar por N° factura (ej: 080583), cliente, RIF o vendedor..."
                          value={invoiceSearchQuery}
                          onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                          style={{ paddingLeft: '32px', paddingRight: invoiceSearchQuery ? '30px' : '12px', fontSize: '0.82rem', width: '100%' }}
                        />
                        {invoiceSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setInvoiceSearchQuery('')}
                            title="Limpiar búsqueda"
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Filtro por fecha */}
                      <div style={{ minWidth: '145px' }}>
                        <select
                          className="form-control"
                          value={invoicePeriodFilter}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInvoicePeriodFilter(val);
                            if (val === 'RANGE') {
                              setInvoiceDateFilter((prev) => ({ ...prev, mode: 'RANGE' }));
                              setShowColumnFilters(true);
                            }
                          }}
                          style={{ fontSize: '0.80rem' }}
                        >
                          <option value="ALL">Todos los Períodos</option>
                          <option value="TODAY">Hoy</option>
                          <option value="YESTERDAY">Ayer</option>
                          <option value="WEEK">Últimos 7 días</option>
                          <option value="MONTH">Últimos 30 días</option>
                          <option value="RANGE">Por Período (Desde / Hasta)</option>
                        </select>
                      </div>

                      {/* Botón Mostrar/Ocultar Filtros de Columna */}
                      <button
                        type="button"
                        onClick={() => setShowColumnFilters(prev => !prev)}
                        className="btn btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.76rem',
                          padding: '7px 11px',
                          borderRadius: '8px',
                          background: showColumnFilters ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255,255,255,0.06)',
                          color: showColumnFilters ? '#38bdf8' : 'var(--text-secondary)',
                          border: `1px solid ${showColumnFilters ? 'rgba(56, 189, 248, 0.4)' : 'var(--border-glass)'}`,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Mostrar u ocultar barra de filtros individuales por columna"
                      >
                        <Filter size={14} />
                        <span>Filtros</span>
                      </button>

                      {/* Botón Cargar a Cobranzas (CxC) */}
                      <button
                        type="button"
                        onClick={() => setShowCxcInvoiceModal(true)}
                        className="btn btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.80rem',
                          padding: '7px 14px',
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          color: '#ffffff',
                          fontWeight: 800,
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                          cursor: 'pointer'
                        }}
                        title="Cargar Factura o Nota de Entrega editable a Cobranzas (CxC)"
                      >
                        <Plus size={15} color="#ffffff" />
                        <span>+ Nueva Factura / N.E. (Cobranzas)</span>
                      </button>

                      {/* Botón de Imprimir Reporte General */}
                      <button
                        type="button"
                        onClick={handlePrintGeneralInvoicesReport}
                        className="btn btn-print-report"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.80rem',
                          padding: '7px 14px',
                          background: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)',
                          color: '#ffffff',
                          fontWeight: 700,
                          borderRadius: '8px'
                        }}
                        title="Descargar Reporte Oficial de Facturación en PDF"
                      >
                        <Printer size={15} color="#ffffff" />
                        <span>Imprimir Reporte General</span>
                      </button>
                    </div>

                    {hasActiveFilters && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '6px 12px',
                          marginTop: '8px',
                          borderRadius: '8px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          fontSize: '0.78rem'
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Mostrando <strong style={{ color: 'var(--neon-cyan, #38bdf8)' }}>{filteredInvoices.length}</strong> de <strong>{allInvoices.length}</strong> documentos registrados
                        </span>
                        <button
                          type="button"
                          onClick={handleResetInvoiceFilters}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(239, 68, 68, 0.14)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '6px',
                            padding: '3px 10px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <X size={12} />
                          <span>Limpiar Todos los Filtros</span>
                        </button>
                      </div>
                    )}

                    {/* PANEL DEDICADO DE FILTROS POR COLUMNA (FUERA DEL THEAD PARA EVITAR SUPERPOSICIONES) */}
                    {showColumnFilters && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          background: isDark ? 'rgba(12, 21, 46, 0.85)' : '#f8fafc',
                          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '10px',
                          alignItems: 'end'
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            N° / Control
                          </label>
                          <input
                            type="text"
                            value={invoiceNumColFilter}
                            onChange={(e) => setInvoiceNumColFilter(e.target.value)}
                            placeholder="Ej: 000002 o N.E."
                            style={{ ...filterInputStyle, padding: '6px 9px', fontSize: '0.76rem' }}
                          />
                        </div>

                        <div style={{ gridColumn: invoiceDateFilter.mode === 'RANGE' ? 'span 2' : 'auto' }}>
                          <DatePeriodFilter
                            value={invoiceDateFilter}
                            onChange={(next) => {
                              setInvoiceDateFilter(next);
                              if (next.mode === 'RANGE' && (next.fromDate || next.toDate)) {
                                setInvoicePeriodFilter('RANGE');
                              } else if (next.mode === 'EXACT' && invoicePeriodFilter === 'RANGE') {
                                setInvoicePeriodFilter('ALL');
                              }
                            }}
                            label="Fecha"
                            stacked
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Cliente / RIF
                          </label>
                          <input
                            type="text"
                            value={invoiceClientColFilter}
                            onChange={(e) => setInvoiceClientColFilter(e.target.value)}
                            placeholder="Nombre o RIF..."
                            style={{ ...filterInputStyle, padding: '6px 9px', fontSize: '0.76rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Asesor / Caja
                          </label>
                          <select
                            value={invoiceSellerColFilter}
                            onChange={(e) => setInvoiceSellerColFilter(e.target.value)}
                            style={{ ...filterInputStyle, padding: '6px 9px', fontSize: '0.76rem' }}
                          >
                            <option value="ALL">Todos los asesores</option>
                            {invoiceSellerOptions.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Condición
                          </label>
                          <select
                            value={invoiceCondColFilter}
                            onChange={(e) => setInvoiceCondColFilter(e.target.value)}
                            style={{ ...filterInputStyle, padding: '6px 9px', fontSize: '0.76rem' }}
                          >
                            <option value="ALL">Todas</option>
                            <option value="CONTADO">Contado</option>
                            <option value="CREDITO">Crédito (Todas)</option>
                            <option value="DIAS_7">Crédito 7D</option>
                            <option value="DIAS_15">Crédito 15D</option>
                            <option value="DIAS_21">Crédito 21D</option>
                            <option value="DIAS_30">Crédito 30D</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Renglones / Lts
                          </label>
                          <select
                            value={invoiceItemsColFilter}
                            onChange={(e) => setInvoiceItemsColFilter(e.target.value)}
                            style={{ ...filterInputStyle, padding: '6px 9px', fontSize: '0.76rem' }}
                          >
                            <option value="ALL">Todos</option>
                            <option value="WITH_LITERS">Con Litros (&gt;0 L)</option>
                            <option value="MULTI">Varios (&gt;1 art)</option>
                            <option value="SINGLE">1 Renglón</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Mínimo USD ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={invoiceMinUsdFilter}
                            onChange={(e) => setInvoiceMinUsdFilter(e.target.value)}
                            placeholder="Ej: 100"
                            style={{ ...filterInputStyle, padding: '6px 9px', fontSize: '0.76rem', textAlign: 'right' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Mínimo Bs.
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={invoiceMinBsFilter}
                            onChange={(e) => setInvoiceMinBsFilter(e.target.value)}
                            placeholder="Ej: 50000"
                            style={{ ...filterInputStyle, padding: '6px 9px', fontSize: '0.76rem', textAlign: 'right' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* TABLA LIST VIEW DE FACTURAS */}
                    <div
                      style={{
                        background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                        border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        marginTop: '10px'
                      }}
                    >
                      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '620px', position: 'relative' }}>
                        <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', fontSize: '0.82rem' }}>
                          <thead>
                            <tr>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: invoiceSortField === 'factura' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('factura')}
                                title="Ordenar por N° de Factura"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>N° FACTURA</span>
                                  {renderSortArrow('factura')}
                                </div>
                              </th>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: invoiceSortField === 'fecha' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('fecha')}
                                title="Ordenar por Fecha y Hora"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>FECHA & HORA</span>
                                  {renderSortArrow('fecha')}
                                </div>
                              </th>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: (invoiceSortField === 'cliente' || invoiceSortField === 'rif') ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('cliente')}
                                title="Ordenar por Cliente / Razón Social"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>CLIENTE / RAZÓN SOCIAL</span>
                                  {renderSortArrow('cliente')}
                                  <span
                                    onClick={(e) => { e.stopPropagation(); handleInvoiceSort('rif'); }}
                                    title="Ordenar por RIF"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      fontSize: '0.66rem',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: invoiceSortField === 'rif' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.06)',
                                      color: invoiceSortField === 'rif' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)'
                                    }}
                                  >
                                    RIF {renderSortArrow('rif')}
                                  </span>
                                </div>
                              </th>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: invoiceSortField === 'vendedor' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('vendedor')}
                                title="Ordenar por Asesor / Caja"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>ASESOR / CAJA</span>
                                  {renderSortArrow('vendedor')}
                                </div>
                              </th>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: invoiceSortField === 'condicion' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('condicion')}
                                title="Ordenar por Condición de Pago"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <span>CONDICIÓN</span>
                                  {renderSortArrow('condicion')}
                                </div>
                              </th>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: invoiceSortField === 'renglones' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('renglones')}
                                title="Ordenar por Renglones / Litros"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <span>RENGLONES / LTS</span>
                                  {renderSortArrow('renglones')}
                                </div>
                              </th>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: invoiceSortField === 'totalUsd' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('totalUsd')}
                                title="Ordenar por Total USD"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                  <span>TOTAL USD</span>
                                  {renderSortArrow('totalUsd')}
                                </div>
                              </th>
                              <th
                                style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: invoiceSortField === 'totalBs' ? 'var(--neon-cyan, #38bdf8)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                onClick={() => handleInvoiceSort('totalBs')}
                                title="Ordenar por Total Bs. (BCV)"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                  <span>TOTAL BS. (BCV)</span>
                                  {renderSortArrow('totalBs')}
                                </div>
                              </th>
                              <th style={{ position: 'sticky', top: 0, zIndex: 4, background: isDark ? '#0c152e' : '#f1f5f9', borderBottom: '1px solid var(--border-glass)', padding: '0.85rem 0.85rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textAlign: 'center', whiteSpace: 'nowrap' }}>ACCIONES</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInvoices.length === 0 ? (
                              <tr>
                                <td colSpan={9} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  <ReceiptText size={44} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                                  <div style={{ fontSize: '0.98rem', fontWeight: 700 }}>No se encontraron facturas con los criterios seleccionados.</div>
                                  <div style={{ fontSize: '0.80rem', marginTop: '4px' }}>
                                    {hasActiveFilters
                                      ? 'Prueba limpiando los filtros o ajustando tu búsqueda.'
                                      : 'Emite facturas desde el POS Mostrador o desde Facturación en Caja.'}
                                  </div>
                                  {hasActiveFilters && (
                                    <button
                                      type="button"
                                      onClick={handleResetInvoiceFilters}
                                      style={{
                                        marginTop: '12px',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(56, 189, 248, 0.4)',
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        color: '#38bdf8',
                                        fontSize: '0.80rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Restablecer Filtros
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ) : (
                              filteredInvoices.slice(0, invoiceRenderLimit).map((inv, idx) => {
                                const correlativo = formatInvoiceCorrelativo(inv);
                                const tipoDocNorm = resolveInvoiceTipoDoc(inv);
                                const isCredit = checkIsCredit(inv);
                                const totalUsdVal = resolveInvoiceTotalUsd(inv);
                                const totalBsVal = resolveInvoiceTotalBs(inv);
                                const { itemsCount, totalLitros } = resolveInvoiceItemsAndLiters(inv);
                                const dateFormatted = formatInvoiceDateTimeDisplay(inv);
                                const cliName = resolveInvoiceClientName(inv);
                                const cliRif = resolveInvoiceClientRif(inv);
                                const sellerName = resolveInvoiceSellerName(inv);

                                return (
                                  <tr
                                    key={inv.id || inv.numeroDoc || idx}
                                    style={{
                                      borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.05))',
                                      transition: 'background 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    {/* N° FACTURA */}
                                    <td style={{ padding: '0.85rem 0.85rem', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span
                                          style={{
                                            fontFamily: 'var(--font-code, monospace)',
                                            fontWeight: 800,
                                            fontSize: '0.88rem',
                                            color: 'var(--neon-cyan, #0284c7)',
                                            background: isDark ? 'rgba(0, 240, 255, 0.1)' : '#e0f2fe',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(0, 240, 255, 0.3)'
                                          }}
                                        >
                                          #{correlativo}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: '0.66rem',
                                            fontWeight: 700,
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            color: tipoDocNorm === 'NOTA_ENTREGA' ? '#f59e0b' : 'var(--text-muted)',
                                            background: tipoDocNorm === 'NOTA_ENTREGA' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                                            textTransform: 'uppercase'
                                          }}
                                        >
                                          {tipoDocNorm}
                                        </span>
                                      </div>
                                    </td>

                                    {/* FECHA & HORA */}
                                    <td style={{ padding: '0.85rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                      <div style={{ fontSize: '0.80rem' }}>{dateFormatted}</div>
                                    </td>

                                    {/* CLIENTE */}
                                    <td style={{ padding: '0.85rem 0.85rem' }}>
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                                        {cliName}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                        {cliRif}
                                      </div>
                                    </td>

                                    {/* VENDEDOR */}
                                    <td style={{ padding: '0.85rem 0.85rem', color: 'var(--text-secondary)' }}>
                                      <div style={{ fontSize: '0.80rem', fontWeight: 600 }}>{sellerName}</div>
                                    </td>

                                    {/* CONDICIÓN */}
                                    <td style={{ padding: '0.85rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                      {isCredit ? (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 9px',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            background: 'rgba(139, 92, 246, 0.15)',
                                            color: '#a78bfa',
                                            border: '1px solid rgba(139, 92, 246, 0.35)'
                                          }}
                                        >
                                          <Clock size={12} />
                                          CRÉDITO ({inv.diasCredito || 7}D)
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 9px',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            color: '#10b981',
                                            border: '1px solid rgba(16, 185, 129, 0.35)'
                                          }}
                                        >
                                          <CheckCircle2 size={12} />
                                          CONTADO
                                        </span>
                                      )}
                                    </td>

                                    {/* RENGLONES / LTS */}
                                    <td style={{ padding: '0.85rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                        {itemsCount} art{itemsCount > 1 ? 's' : ''}
                                        {totalLitros > 0 && ` • ${formatUnitVe(totalLitros)} L`}
                                      </span>
                                    </td>

                                    {/* TOTAL USD */}
                                    <td style={{ padding: '0.85rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <div style={{ fontWeight: 800, color: 'var(--semaforo-verde)', fontSize: '0.88rem' }}>
                                        {formatUsd(totalUsdVal)}
                                      </div>
                                    </td>

                                    {/* TOTAL BS */}
                                    <td style={{ padding: '0.85rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <div style={{ fontSize: '0.80rem', color: 'var(--motorven-gold)', fontWeight: 600 }}>
                                        {formatBs(totalBsVal)}
                                      </div>
                                    </td>

                                    {/* ACCIONES */}
                                    <td style={{ padding: '0.85rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        {/* Botón Imprimir Factura Oficial con Correlativo */}
                                        <button
                                          type="button"
                                          onClick={() => handlePrintIndividualInvoice(inv)}
                                          className="btn btn-sm"
                                          style={{
                                            background: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '5px 9px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontWeight: 700,
                                            fontSize: '0.74rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 6px rgba(30, 64, 175, 0.3)'
                                          }}
                                          title={`Imprimir ${tipoDocNorm === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura'} #${correlativo}`}
                                        >
                                          <Printer size={13} color="#ffffff" />
                                          <span>Imprimir</span>
                                        </button>

                                        {/* Botón Ver Documento / Modal */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setInvoiceModalSale(buildPrintableInvoice(inv));
                                            setShowInvoiceModal(true);
                                          }}
                                          className="btn btn-sm"
                                          style={{
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-glass)',
                                            borderRadius: '6px',
                                            padding: '5px 8px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontWeight: 700,
                                            fontSize: '0.74rem',
                                            cursor: 'pointer'
                                          }}
                                          title="Ver vista previa del documento / Ticket térmico 80mm o carta"
                                        >
                                          <Eye size={13} />
                                          <span>Ver</span>
                                        </button>

                                        {/* Botón Editar Datos de Factura / Nota de Entrega (Solo Administradores) */}
                                        {isAdmin && (
                                           <button
                                             type="button"
                                             onClick={() => handleOpenEditInvoice(inv)}
                                             className="btn btn-sm"
                                             style={{
                                               background: 'rgba(245, 158, 11, 0.14)',
                                               color: '#f59e0b',
                                               border: '1px solid rgba(245, 158, 11, 0.38)',
                                               borderRadius: '6px',
                                               padding: '5px 8px',
                                               display: 'inline-flex',
                                               alignItems: 'center',
                                               gap: '4px',
                                               fontWeight: 700,
                                               fontSize: '0.74rem',
                                               cursor: 'pointer'
                                             }}
                                             title={`Editar correlativo, fecha/hora, cliente, vendedor y montos de #${correlativo}`}
                                           >
                                             <Pencil size={13} />
                                             <span>Editar</span>
                                           </button>
                                         )}

                                        {/* Botón Eliminar con Doble Seguridad (Solo Administradores) */}
                                        {isAdmin && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setInvoiceToDelete(inv);
                                              setDeleteConfirmKeyword('');
                                            }}
                                            className="btn btn-sm"
                                            style={{
                                              background: 'rgba(239, 68, 68, 0.12)',
                                              color: '#ef4444',
                                              border: '1px solid rgba(239, 68, 68, 0.35)',
                                              borderRadius: '6px',
                                              padding: '5px 8px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              fontWeight: 700,
                                              fontSize: '0.74rem',
                                              cursor: 'pointer'
                                            }}
                                            title="Eliminar factura de la base de datos (Requiere doble factor de confirmación)"
                                          >
                                            <Trash2 size={13} />
                                            <span>Eliminar</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                      {filteredInvoices.length > invoiceRenderLimit && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '0.85rem', borderTop: '1px solid var(--border-glass)' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Mostrando {invoiceRenderLimit} de {filteredInvoices.length} documentos
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setInvoiceRenderLimit(prev => prev + 80)}
                            style={{ fontWeight: 700, fontSize: '0.78rem' }}
                          >
                            Cargar 80 más ({filteredInvoices.length - invoiceRenderLimit} restantes)
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setInvoiceRenderLimit(filteredInvoices.length)}
                            style={{ fontWeight: 700, fontSize: '0.76rem' }}
                          >
                            Ver todos
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* MODAL DE ELIMINACIÓN CON DOBLE SEGURIDAD PARA FACTURAS */}
              {invoiceToDelete && (
                <div
                  className="modal-overlay"
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100000,
                    padding: '1rem'
                  }}
                  onClick={() => !isDeletingInvoice && setInvoiceToDelete(null)}
                >
                  <div
                    className="modal-content"
                    style={{
                      maxWidth: '520px',
                      width: '100%',
                      background: 'var(--bg-card, #111827)',
                      borderRadius: '16px',
                      border: '1.5px solid rgba(239, 68, 68, 0.5)',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(239, 68, 68, 0.25)',
                      overflow: 'hidden'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Encabezado */}
                    <div style={{
                      padding: '1.25rem 1.5rem',
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.12) 100%)',
                      borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ef4444'
                        }}>
                          <ShieldAlert size={24} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ef4444' }}>
                            Eliminación de Factura
                          </h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Doble Factor de Seguridad • Exclusivo Administradores
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => !isDeletingInvoice && setInvoiceToDelete(null)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Cuerpo */}
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '10px',
                        padding: '1rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.5
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#ef4444', marginBottom: '0.35rem' }}>
                          <AlertTriangle size={16} /> ⚠️ ADVERTENCIA DE CONTROL FISCAL Y CONTABLE
                        </div>
                        Esta acción eliminará de forma definitiva la <strong>Factura #{formatInvoiceCorrelativo(invoiceToDelete)}</strong> de la base de datos Supabase y del registro fiscal.
                      </div>

                      <div style={{
                        background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        padding: '0.9rem 1.1rem',
                        fontSize: '0.84rem',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.75rem'
                      }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>N° Factura:</span>
                          <strong style={{ color: 'var(--neon-cyan)', fontSize: '0.98rem' }}>#{formatInvoiceCorrelativo(invoiceToDelete)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Cliente:</span>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>{invoiceToDelete.clienteNombre || invoiceToDelete.cliente || invoiceToDelete.cliDes}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Total Factura USD:</span>
                          <strong style={{ color: 'var(--semaforo-verde)' }}>{formatUsd(invoiceToDelete.totalUsd || invoiceToDelete.total_usd || invoiceToDelete.totNetoUsd || invoiceToDelete.total || 0)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Condición:</span>
                          <strong style={{ color: checkIsCredit(invoiceToDelete) ? '#a78bfa' : '#10b981' }}>{checkIsCredit(invoiceToDelete) ? 'CRÉDITO' : 'CONTADO'}</strong>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                          🔒 Escriba <span style={{ color: '#ef4444', fontWeight: 800 }}>ELIMINAR</span> o el número <span style={{ color: 'var(--neon-cyan)', fontWeight: 800 }}>{formatInvoiceCorrelativo(invoiceToDelete)}</span> para autorizar:
                        </label>
                        <input
                          type="text"
                          className="input-modern"
                          placeholder={`Escriba ELIMINAR o ${formatInvoiceCorrelativo(invoiceToDelete)}`}
                          value={deleteConfirmKeyword}
                          onChange={(e) => setDeleteConfirmKeyword(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.9rem',
                            borderRadius: '8px',
                            border: '1.5px solid rgba(239, 68, 68, 0.4)',
                            background: 'rgba(0, 0, 0, 0.25)',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.9rem'
                          }}
                        />
                      </div>
                    </div>

                    {/* Botones de acción del modal */}
                    <div style={{
                      padding: '1.1rem 1.5rem',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderTop: '1px solid var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '0.75rem'
                    }}>
                      <button
                        type="button"
                        onClick={() => setInvoiceToDelete(null)}
                        disabled={isDeletingInvoice}
                        className="btn btn-secondary"
                        style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteInvoiceConfirm}
                        disabled={
                          isDeletingInvoice ||
                          (deleteConfirmKeyword.trim().toUpperCase() !== 'ELIMINAR' &&
                           deleteConfirmKeyword.trim() !== formatInvoiceCorrelativo(invoiceToDelete))
                        }
                        className="btn"
                        style={{
                          background: (deleteConfirmKeyword.trim().toUpperCase() === 'ELIMINAR' ||
                                       deleteConfirmKeyword.trim() === formatInvoiceCorrelativo(invoiceToDelete))
                            ? '#ef4444'
                            : 'rgba(239, 68, 68, 0.25)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.55rem 1.3rem',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: (deleteConfirmKeyword.trim().toUpperCase() === 'ELIMINAR' ||
                                   deleteConfirmKeyword.trim() === formatInvoiceCorrelativo(invoiceToDelete))
                            ? 'pointer'
                            : 'not-allowed',
                          boxShadow: (deleteConfirmKeyword.trim().toUpperCase() === 'ELIMINAR' ||
                                      deleteConfirmKeyword.trim() === formatInvoiceCorrelativo(invoiceToDelete))
                            ? '0 4px 14px rgba(239, 68, 68, 0.4)'
                            : 'none'
                        }}
                      >
                        {isDeletingInvoice ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            <span>Eliminando...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={15} />
                            <span>Confirmar Eliminación</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL EDICIÓN DE FACTURA / NOTA DE ENTREGA */}
              {editingInvoice && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(5, 10, 24, 0.85)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '1rem'
                  }}
                  onClick={() => !isSavingEditedInvoice && setEditingInvoice(null)}
                >
                  <form
                    onSubmit={handleSaveEditedInvoice}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      maxWidth: '880px',
                      maxHeight: '92vh',
                      overflowY: 'auto',
                      background: isDark ? '#0c142b' : '#ffffff',
                      border: '1.5px solid rgba(245, 158, 11, 0.45)',
                      borderRadius: '16px',
                      padding: '1.35rem 1.5rem',
                      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}
                  >
                    {/* Header del Modal */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                          <Pencil size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Editar {editingInvoice.tipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura'} #{editingInvoice.numeroDoc}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Modifica correlativo, fecha/hora de emisión, cliente, condición de pago o montos (sin alterar inventario).
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingEditedInvoice}
                        onClick={() => setEditingInvoice(null)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* 1. Identificación y Fecha/Hora de Emisión */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '0.95rem' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                        1. Correlativo, Tipo de Documento y Fecha / Hora de Emisión
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tipo Documento</label>
                          <select
                            className="form-control"
                            value={editingInvoice.tipoDoc}
                            onChange={(e) => {
                              const nextTipo = e.target.value;
                              setEditingInvoice((prev) => {
                                if (!prev) return prev;
                                const recalcNext = applyRecalculatedEditingInvoice(prev, prev.items || [], nextTipo);
                                const ctrlPatch = resolveControlNumberOnTipoDocChange({
                                  prevTipoDoc: prev.tipoDoc,
                                  nextTipoDoc: nextTipo,
                                  numeroDoc: prev.numeroDoc,
                                  currentControl: prev.numeroControl,
                                  savedFiscalControl: prev._savedFiscalControl
                                });
                                return {
                                  ...recalcNext,
                                  numeroControl: ctrlPatch.numeroControl,
                                  _savedFiscalControl: ctrlPatch.savedFiscalControl
                                };
                              });
                            }}
                            style={{ fontSize: '0.82rem' }}
                          >
                            <option value="FACTURA">FACTURA FISCAL</option>
                            <option value="NOTA_ENTREGA">NOTA DE ENTREGA (N.E.)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>N° Correlativo</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              className="form-control"
                              value={editingInvoice.numeroDoc}
                              onChange={(e) => {
                                const nextNum = e.target.value;
                                setEditingInvoice((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    numeroDoc: nextNum,
                                    numeroControl: syncControlNumberOnCorrelativoEdit({
                                      tipoDoc: prev.tipoDoc,
                                      prevNumeroDoc: prev.numeroDoc,
                                      nextNumeroDoc: nextNum,
                                      currentControl: prev.numeroControl
                                    })
                                  };
                                });
                              }}
                              placeholder="080583"
                              required
                              style={{ fontFamily: 'var(--font-code)', fontWeight: 800, fontSize: '0.84rem' }}
                            />
                            <button
                              type="button"
                              title="Regenerar N° Control según este correlativo"
                              onClick={() => {
                                const digits = String(editingInvoice.numeroDoc || '').replace(/[^0-9]/g, '');
                                const padded = digits ? digits.slice(-6).padStart(6, '0') : editingInvoice.numeroDoc;
                                setEditingInvoice((prev) => ({
                                  ...prev,
                                  numeroDoc: padded,
                                  numeroControl: formatDocumentControlNumber(padded, prev.tipoDoc)
                                }));
                              }}
                              style={{ padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              6 dígitos
                            </button>
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>N° Control Fiscal</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editingInvoice.numeroControl}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, numeroControl: e.target.value }))}
                            placeholder={editingInvoice.tipoDoc === 'NOTA_ENTREGA' ? 'N.E-000614' : '00-080583'}
                            style={{ fontFamily: 'var(--font-code)', fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fecha de Emisión</label>
                          <input
                            type="date"
                            className="form-control"
                            value={editingInvoice.fechaEmisionDate}
                            onChange={(e) => {
                              const newDate = e.target.value;
                              setEditingInvoice(prev => ({
                                ...prev,
                                fechaEmisionDate: newDate,
                                fechaVencimientoDate: prev.condicionPago === 'CREDITO'
                                  ? calculateExpirationDate(newDate, parseInt(prev.diasCredito || '15', 10) || 15)
                                  : newDate
                              }));
                            }}
                            required
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hora Exacta Emisión</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="time"
                              step="1"
                              className="form-control"
                              value={editingInvoice.fechaEmisionTime}
                              onChange={(e) => setEditingInvoice(prev => ({ ...prev, fechaEmisionTime: e.target.value }))}
                              style={{ fontSize: '0.82rem' }}
                            />
                            <button
                              type="button"
                              title="Establecer fecha y hora actual"
                              onClick={() => {
                                const now = new Date();
                                const todayStr = toLocalYmd(now);
                                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                                setEditingInvoice(prev => ({
                                  ...prev,
                                  fechaEmisionDate: todayStr,
                                  fechaEmisionTime: timeStr,
                                  fechaVencimientoDate: prev.condicionPago === 'CREDITO'
                                    ? calculateExpirationDate(todayStr, parseInt(prev.diasCredito || '15', 10) || 15)
                                    : todayStr
                                }));
                              }}
                              style={{ padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'rgba(16,185,129,0.14)', color: '#10b981', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Ahora
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Cliente, Asesor y Condición de Pago */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '0.95rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                          2. Cliente, Asesor / Caja y Condición Comercial
                        </span>
                        <div style={{ position: 'relative', minWidth: '240px' }}>
                          <input
                            type="text"
                            className="form-control"
                            value={editClientSearch}
                            onChange={(e) => setEditClientSearch(e.target.value)}
                            placeholder="Buscar cliente registrado para reemplazar..."
                            style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                          />
                          {editClientSearch.trim().length >= 2 && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                maxHeight: '180px',
                                overflowY: 'auto',
                                background: isDark ? '#0f172a' : '#ffffff',
                                border: '1px solid var(--border-glass)',
                                borderRadius: '8px',
                                zIndex: 20,
                                marginTop: '4px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
                              }}
                            >
                              {safeClients
                                .filter((c) => {
                                  const q = normalizeSearchText(editClientSearch);
                                  return normalizeSearchText(`${c.nombre || c.name} ${c.rif || ''}`).includes(q);
                                })
                                .slice(0, 8)
                                .map((c) => (
                                  <button
                                    key={c.id || c.rif || c.nombre}
                                    type="button"
                                    onClick={() => {
                                      setEditingInvoice(prev => ({
                                        ...prev,
                                        clienteId: c.id || prev.clienteId,
                                        clienteNombre: c.nombre || c.name || prev.clienteNombre,
                                        clienteRif: c.rif || prev.clienteRif,
                                        clienteDireccion: c.direccion || c.domicilioFiscal || prev.clienteDireccion,
                                        clienteTelefono: c.telefono || prev.clienteTelefono
                                      }));
                                      setEditClientSearch('');
                                    }}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '7px 10px',
                                      background: 'transparent',
                                      border: 'none',
                                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.76rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <div style={{ fontWeight: 700 }}>{c.nombre || c.name}</div>
                                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>{c.rif}</div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Cliente / Razón Social</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editingInvoice.clienteNombre}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, clienteNombre: e.target.value }))}
                            required
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RIF / C.I.</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editingInvoice.clienteRif}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, clienteRif: e.target.value }))}
                            required
                            style={{ fontSize: '0.82rem', fontFamily: 'var(--font-code)' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Asesor / Caja</label>
                          <input
                            type="text"
                            list="edit-invoice-sellers-list"
                            className="form-control"
                            value={editingInvoice.vendedor}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, vendedor: e.target.value }))}
                            style={{ fontSize: '0.82rem' }}
                          />
                          <datalist id="edit-invoice-sellers-list">
                            <option value="Caja Mostrador" />
                            <option value="Oficina" />
                            {invoiceSellerOptions.map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Dirección Fiscal / Entrega</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editingInvoice.clienteDireccion}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, clienteDireccion: e.target.value }))}
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Teléfono</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editingInvoice.clienteTelefono}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, clienteTelefono: e.target.value }))}
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Condición de Pago</label>
                          <select
                            className="form-control"
                            value={editingInvoice.condicionPago}
                            onChange={(e) => {
                              const cond = e.target.value;
                              const isCred = cond === 'CREDITO';
                              const dias = isCred ? (parseInt(editingInvoice.diasCredito || '15', 10) || 15) : 0;
                              setEditingInvoice(prev => ({
                                ...prev,
                                condicionPago: cond,
                                diasCredito: String(dias),
                                metodoPago: isCred ? 'CREDITO' : (prev.metodoPago === 'CREDITO' ? 'EFECTIVO_USD' : prev.metodoPago),
                                fechaVencimientoDate: isCred
                                  ? calculateExpirationDate(prev.fechaEmisionDate, dias)
                                  : prev.fechaEmisionDate
                              }));
                            }}
                            style={{ fontSize: '0.82rem' }}
                          >
                            <option value="CONTADO">CONTADO</option>
                            <option value="CREDITO">CRÉDITO</option>
                          </select>
                        </div>

                        {editingInvoice.condicionPago === 'CREDITO' && (
                          <>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Días de Crédito</label>
                              <input
                                type="number"
                                min="1"
                                max="180"
                                className="form-control"
                                value={editingInvoice.diasCredito}
                                onChange={(e) => {
                                  const d = parseInt(e.target.value || '1', 10) || 1;
                                  setEditingInvoice(prev => ({
                                    ...prev,
                                    diasCredito: e.target.value,
                                    fechaVencimientoDate: calculateExpirationDate(prev.fechaEmisionDate, d)
                                  }));
                                }}
                                style={{ fontSize: '0.82rem' }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fecha Vencimiento</label>
                              <input
                                type="date"
                                className="form-control"
                                value={editingInvoice.fechaVencimientoDate}
                                onChange={(e) => setEditingInvoice(prev => ({ ...prev, fechaVencimientoDate: e.target.value }))}
                                style={{ fontSize: '0.82rem' }}
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Método de Pago</label>
                          <select
                            className="form-control"
                            value={editingInvoice.metodoPago}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, metodoPago: e.target.value }))}
                            style={{ fontSize: '0.82rem' }}
                          >
                            <option value="EFECTIVO_USD">EFECTIVO USD</option>
                            <option value="ZELLE">ZELLE</option>
                            <option value="PAGO_MOVIL">PAGO MÓVIL BS</option>
                            <option value="TRANSFERENCIA_BS">TRANSFERENCIA BS</option>
                            <option value="TRANSFERENCIA_USD">TRANSFERENCIA USD</option>
                            <option value="TARJETA">PUNTO DE VENTA</option>
                            <option value="MIXTO">PAGO MIXTO</option>
                            <option value="CREDITO">CRÉDITO</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* 3. Montos, Tasa BCV y Observaciones */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '0.95rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                          3. Totales, Tasa BCV y Observaciones
                        </span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInvoice(prev => applyRecalculatedEditingInvoice(prev, prev.items || [], prev.tipoDoc));
                            }}
                            style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Recalcular desde Renglones
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const sub = Number(editingInvoice.subtotalUsd) || 0;
                              const iva = Number((sub * 0.16).toFixed(2));
                              const tasa = Number(editingInvoice.tasaDolar) || tasaBcv;
                              const tot = sub + iva;
                              setEditingInvoice(prev => ({
                                ...prev,
                                ivaUsd: iva.toFixed(2),
                                totalUsd: tot.toFixed(2),
                                totalBs: (tot * tasa).toFixed(2)
                              }));
                            }}
                            style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'rgba(139,92,246,0.14)', color: '#a78bfa', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Aplicar IVA 16%
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tasa BCV</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-control"
                            value={editingInvoice.tasaDolar}
                            onChange={(e) => {
                              const t = e.target.value;
                              const numT = Number(t) || 0;
                              const totU = Number(editingInvoice.totalUsd) || 0;
                              setEditingInvoice(prev => ({
                                ...prev,
                                tasaDolar: t,
                                totalBs: numT > 0 ? (totU * numT).toFixed(2) : prev.totalBs
                              }));
                            }}
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Subtotal USD</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={editingInvoice.subtotalUsd}
                            onChange={(e) => {
                              const sub = e.target.value;
                              const tot = (Number(sub) || 0) + (Number(editingInvoice.ivaUsd) || 0);
                              const tasa = Number(editingInvoice.tasaDolar) || tasaBcv;
                              setEditingInvoice(prev => ({
                                ...prev,
                                subtotalUsd: sub,
                                totalUsd: tot.toFixed(2),
                                totalBs: (tot * tasa).toFixed(2)
                              }));
                            }}
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>IVA USD</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={editingInvoice.ivaUsd}
                            onChange={(e) => {
                              const iva = e.target.value;
                              const tot = (Number(editingInvoice.subtotalUsd) || 0) + (Number(iva) || 0);
                              const tasa = Number(editingInvoice.tasaDolar) || tasaBcv;
                              setEditingInvoice(prev => ({
                                ...prev,
                                ivaUsd: iva,
                                totalUsd: tot.toFixed(2),
                                totalBs: (tot * tasa).toFixed(2)
                              }));
                            }}
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--semaforo-verde)', display: 'block', marginBottom: '4px' }}>Total USD</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={editingInvoice.totalUsd}
                            onChange={(e) => {
                              const tot = e.target.value;
                              const tasa = Number(editingInvoice.tasaDolar) || tasaBcv;
                              setEditingInvoice(prev => ({
                                ...prev,
                                totalUsd: tot,
                                totalBs: ((Number(tot) || 0) * tasa).toFixed(2)
                              }));
                            }}
                            style={{ fontSize: '0.82rem', fontWeight: 800 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--motorven-gold)', display: 'block', marginBottom: '4px' }}>Total Bs.</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            value={editingInvoice.totalBs}
                            onChange={(e) => setEditingInvoice(prev => ({ ...prev, totalBs: e.target.value }))}
                            style={{ fontSize: '0.82rem', fontWeight: 700 }}
                          />
                        </div>

                        {editingInvoice.condicionPago === 'CREDITO' && (
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Abonos USD</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              value={editingInvoice.abonosUsd}
                              onChange={(e) => setEditingInvoice(prev => ({ ...prev, abonosUsd: e.target.value }))}
                              style={{ fontSize: '0.82rem' }}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Observaciones / Notas del Documento</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingInvoice.observaciones}
                          onChange={(e) => setEditingInvoice(prev => ({ ...prev, observaciones: e.target.value }))}
                          placeholder="Observación opcional..."
                          style={{ fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>

                    {/* 4. Renglones / Artículos */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '0.95rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                          4. Renglones ({(editingInvoice.items || []).length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingInvoice(prev =>
                              applyRecalculatedEditingInvoice(prev, [
                                ...(prev.items || []),
                                { id: `ITEM-${Date.now()}`, codigo: '', articuloId: '', descripcion: 'Artículo Lubricante', cantidad: 1, precioUsd: 0, subtotalUsd: 0, litros: 0 }
                              ])
                            );
                          }}
                          style={{ padding: '3px 9px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.14)', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          + Agregar Renglón
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '170px', overflowY: 'auto' }}>
                        {(editingInvoice.items || []).map((it, rIdx) => (
                          <div key={it.id || rIdx} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px 85px 85px 28px', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              value={it.codigo || it.articuloId || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditingInvoice(prev => ({
                                  ...prev,
                                  items: prev.items.map((row, i) => i === rIdx ? { ...row, codigo: v, articuloId: v } : row)
                                }));
                              }}
                              placeholder="Código"
                              style={{ fontSize: '0.74rem', padding: '4px 6px' }}
                            />
                            <input
                              type="text"
                              className="form-control"
                              value={it.descripcion || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditingInvoice(prev => ({
                                  ...prev,
                                  items: prev.items.map((row, i) => i === rIdx ? { ...row, descripcion: v } : row)
                                }));
                              }}
                              placeholder="Descripción"
                              style={{ fontSize: '0.74rem', padding: '4px 6px' }}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              value={it.cantidad}
                              onChange={(e) => {
                                const q = Number(e.target.value) || 0;
                                setEditingInvoice(prev =>
                                  applyRecalculatedEditingInvoice(
                                    prev,
                                    (prev.items || []).map((row, i) => i === rIdx ? { ...row, cantidad: q } : row)
                                  )
                                );
                              }}
                              placeholder="Cant"
                              style={{ fontSize: '0.74rem', padding: '4px 6px', textAlign: 'right' }}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              value={it.precioUsd}
                              onChange={(e) => {
                                const p = Number(e.target.value) || 0;
                                setEditingInvoice(prev =>
                                  applyRecalculatedEditingInvoice(
                                    prev,
                                    (prev.items || []).map((row, i) => i === rIdx ? { ...row, precioUsd: p } : row)
                                  )
                                );
                              }}
                              placeholder="Precio $"
                              style={{ fontSize: '0.74rem', padding: '4px 6px', textAlign: 'right' }}
                            />
                            <div style={{ fontSize: '0.76rem', fontWeight: 700, textAlign: 'right', color: 'var(--semaforo-verde)' }}>
                              {formatUsd((Number(it.cantidad) || 0) * (Number(it.precioUsd) || 0))}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingInvoice(prev =>
                                  applyRecalculatedEditingInvoice(
                                    prev,
                                    (prev.items || []).filter((_, i) => i !== rIdx)
                                  )
                                )
                              }
                              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              title="Quitar renglón"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)' }}>
                      <button
                        type="button"
                        disabled={isSavingEditedInvoice}
                        onClick={() => setEditingInvoice(null)}
                        className="btn btn-sm"
                        style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEditedInvoice}
                        className="btn btn-sm"
                        style={{
                          padding: '8px 20px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                        }}
                      >
                        <Save size={15} />
                        <span>{isSavingEditedInvoice ? 'Guardando cambios...' : 'Guardar Cambios'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
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
                          onClick={() => {
                            hasManualPaymentTermRef.current = true;
                            setPaymentTerm(opt.key);
                          }}
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
                    disabled={!userCanGrantCreditOverride || String(creditOverrideJustification || '').trim().length < 5}
                    onClick={() => {
                      if (!userCanGrantCreditOverride) {
                        notify.error('No tiene permisos para otorgar aprobaciones excepcionales de crédito.');
                        return;
                      }
                      if (String(creditOverrideJustification || '').trim().length < 5) {
                        notify.warning('Debe ingresar un motivo o justificación válida (mínimo 5 caracteres).');
                        return;
                      }
                      if (paymentTerm === 'CONTADO') {
                        hasManualPaymentTermRef.current = true;
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
                      background: (!userCanGrantCreditOverride || String(creditOverrideJustification || '').trim().length < 5)
                        ? 'rgba(100, 116, 139, 0.45)'
                        : 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      boxShadow: (!userCanGrantCreditOverride || String(creditOverrideJustification || '').trim().length < 5)
                        ? 'none'
                        : '0 4px 14px rgba(16, 185, 129, 0.4)',
                      cursor: (!userCanGrantCreditOverride || String(creditOverrideJustification || '').trim().length < 5)
                        ? 'not-allowed'
                        : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title={
                      !userCanGrantCreditOverride
                        ? 'Requiere permisos de Gerencia / Master Admin'
                        : (String(creditOverrideJustification || '').trim().length < 5 ? 'Escriba una justificación de al menos 5 caracteres para aprobar' : 'Aprobar y liberar crédito excepcionalmente')
                    }
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

        {/* MODAL PARA DECIDIR MANUALMENTE EL NÚMERO DE FACTURA FISCAL O NOTA DE ENTREGA INICIAL */}
        {showCorrelativoModal && (() => {
          const isNeModal = correlativoModalType === 'NOTA_ENTREGA';
          const accentMain = isNeModal ? '#0d9488' : '#4f46e5';
          const accentDark = isNeModal ? '#0f766e' : '#3730a3';
          const accentLight = isNeModal ? '#5eead4' : '#a5b4fc';
          const accentBorder = isNeModal ? 'rgba(20, 184, 166, 0.5)' : 'rgba(99, 102, 241, 0.5)';
          const accentBg = isNeModal ? 'rgba(20, 184, 166, 0.14)' : 'rgba(79, 70, 229, 0.15)';
          const rawDigits = String(customCorrelativoInput || '').replace(/[^0-9]/g, '');
          const numPreview = rawDigits === '' ? (isNeModal ? 1 : 0) : parseInt(rawDigits, 10);
          const safeNumPreview = Math.max(0, Math.min(999999, isNaN(numPreview) ? 0 : numPreview));
          const formattedPreview = String(safeNumPreview).padStart(6, '0');
          const highestRef = isNeModal ? highestExistingNeNum : highestExistingInvoiceNum;

          return (
            <div
              className="modal-overlay"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000,
                padding: '1rem'
              }}
              onClick={() => setShowCorrelativoModal(false)}
            >
              <div
                className="modal-content"
                style={{
                  maxWidth: '520px',
                  width: '100%',
                  background: 'var(--bg-card, #111827)',
                  borderRadius: '16px',
                  border: `1.5px solid ${accentBorder}`,
                  boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px ${accentBg}`,
                  overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Encabezado del modal */}
                <div style={{
                  padding: '1.2rem 1.5rem',
                  background: isNeModal
                    ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.25) 0%, rgba(20, 184, 166, 0.12) 100%)'
                    : 'linear-gradient(135deg, rgba(79, 70, 229, 0.25) 0%, rgba(99, 102, 241, 0.12) 100%)',
                  borderBottom: `1px solid ${accentBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: accentBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${accentBorder}`
                    }}>
                      <Hash size={20} color={accentLight} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                        {isNeModal ? 'Fijar N° de Nota de Entrega Inicial' : 'Fijar N° de Factura Fiscal Inicial'}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {isNeModal
                          ? 'Decida manualmente desde cuál correlativo comenzar las Notas de Entrega (Almacén 02)'
                          : 'Decida manualmente desde cuál correlativo comenzar la facturación'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCorrelativoModal(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Cuerpo del modal */}
                <div style={{ padding: '1.4rem 1.5rem' }}>
                  {/* Visualizador en tiempo real del próximo documento */}
                  <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${accentBg} 0%, rgba(0, 0, 0, 0.08) 100%)`,
                    border: `1.5px solid ${accentBorder}`,
                    textAlign: 'center',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{
                      fontSize: '0.74rem',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                      fontWeight: 700
                    }}>
                      {isNeModal ? 'Próxima Nota de Entrega a Emitir (Alm. 02)' : 'Próxima Factura Fiscal a Emitir (SENIAT)'}
                    </div>
                    <div style={{
                      fontSize: '2.35rem',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      letterSpacing: '4px',
                      color: accentLight,
                      textShadow: `0 0 20px ${accentBg}`
                    }}>
                      {isNeModal ? `#NE-${formattedPreview}` : `#${formattedPreview}`}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      {isNeModal ? 'Formato estándar NE-XXXXXX (6 dígitos consecutivos)' : 'Formato legal estándar de 6 dígitos consecutivos'}
                    </div>
                  </div>

                  {/* Input para ingresar el número */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {isNeModal
                        ? '🔢 Ingrese el número de Nota de Entrega a partir del cual desea empezar:'
                        : '🔢 Ingrese el número de factura a partir del cual desea empezar:'}
                    </label>
                    <input
                      type="text"
                      className="input-modern"
                      autoFocus
                      value={customCorrelativoInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                        setCustomCorrelativoInput(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCorrelativo();
                        }
                      }}
                      placeholder={isNeModal ? 'Ej: 002226, 002230, 000001...' : 'Ej: 000000, 000100, 002159...'}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${accentBorder}`,
                        background: 'rgba(0, 0, 0, 0.35)',
                        color: '#ffffff',
                        fontSize: '1.15rem',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        letterSpacing: '3px',
                        textAlign: 'center'
                      }}
                    />
                  </div>

                  {/* Botones de Atajos Rápidos */}
                  <div style={{ marginBottom: '1.2rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.45rem' }}>
                      Atajos sugeridos:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {!isNeModal && (
                        <button
                          type="button"
                          onClick={() => setCustomCorrelativoInput('000000')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#c7d2fe',
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          000000 (Reiniciar a cero)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCustomCorrelativoInput('000001')}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${accentBorder}`,
                          background: accentBg,
                          color: accentLight,
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                          fontWeight: 700
                        }}
                      >
                        {isNeModal ? 'NE-000001' : '000001'}
                      </button>
                      {highestRef >= 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomCorrelativoInput(String(highestRef + 1).padStart(6, '0'))}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#6ee7b7',
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                          title={`Continuar inmediatamente después del correlativo más alto registrado (${String(highestRef).padStart(6, '0')})`}
                        >
                          {isNeModal
                            ? `Continuar tras #NE-${String(highestRef).padStart(6, '0')} (→ #NE-${String(highestRef + 1).padStart(6, '0')})`
                            : `Continuar tras #${String(highestRef).padStart(6, '0')} (→ #${String(highestRef + 1).padStart(6, '0')})`}
                        </button>
                      )}
                      {isNeModal && (
                        <button
                          type="button"
                          onClick={handleResetAutoNeCorrelativo}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            background: 'rgba(56, 189, 248, 0.14)',
                            color: '#7dd3fc',
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                          title="Quitar número fijado manualmente y detectar el correlativo automático según la base de datos"
                        >
                          Automático (según BD)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nota informativa */}
                  <div style={{
                    padding: '0.8rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-glass)',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start'
                  }}>
                    <Info size={16} color="var(--neon-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      {isNeModal ? (
                        <>La próxima <strong>Nota de Entrega</strong> que emita la <strong>Cajera (Paso 3)</strong> o en <strong>Ventas POS (Almacén 02)</strong> tendrá este número. Los siguientes documentos continuarán de forma consecutiva (+1).</>
                      ) : (
                        <>La próxima factura que emita la <strong>Cajera (Paso 3)</strong> o en <strong>Ventas POS</strong> tendrá este número. Los siguientes documentos continuarán de forma consecutiva (+1).</>
                      )}
                    </span>
                  </div>
                </div>

                {/* Botones de acción del modal */}
                <div style={{
                  padding: '1.1rem 1.5rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderTop: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowCorrelativoModal(false)}
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCorrelativo}
                    className="btn"
                    style={{
                      background: `linear-gradient(135deg, ${accentMain} 0%, ${accentDark} 100%)`,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.55rem 1.3rem',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: `0 4px 14px ${accentBg}`
                    }}
                  >
                    <Check size={16} />
                    <span>{isNeModal ? 'Guardar y Fijar N/Entrega' : 'Guardar y Fijar Factura'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL OFICIAL FACTURA CARTA SENIAT (ADAPTADA) */}
        {showInvoiceModal && invoiceModalSale && (
          <SalesInvoiceModal
            sale={invoiceModalSale}
            config={config}
            currentUser={currentUser}
            products={safeProducts}
            clients={safeClients}
            onClose={() => setShowInvoiceModal(false)}
            onNewSale={() => {
              setShowInvoiceModal(false);
              setActiveTab('pipeline');
            }}
          />
        )}

        {/* MODAL DE CARGA Y CUADRE A COBRANZAS (CxC) (montaje perezoso cuando está abierto) */}
        {showCxcInvoiceModal && (
          <CxcInvoiceCreationModal
            isOpen={showCxcInvoiceModal}
            onClose={() => setShowCxcInvoiceModal(false)}
            onSaveDocument={handleSaveCxcInvoice}
            clients={clients}
            sellers={profitSellers}
            config={config}
            suggestedCorrelativo={currentNextCorrelativo}
            existingInvoices={allInvoices}
          />
        )}

        {/* MODAL: CARTERA MAESTRA DE CLIENTES (montaje perezoso cuando está abierto) */}
        {showClientsDirectoryModal && (
          <ClientsDirectoryModal
            isOpen={showClientsDirectoryModal}
            onClose={() => setShowClientsDirectoryModal(false)}
            clients={clients}
            profitInvoices={profitInvoices}
            sales={sales}
            tasaBcv={tasaBcv}
            currentUser={currentUser}
            profitSellers={profitSellers}
            profitZones={profitZones}
            onSaveClient={onSaveClient}
            onDeleteClient={onDeleteClient}
            onApproveClient={onApproveClient}
            onRejectClient={onRejectClient}
            onSelectClientForOrder={(client) => {
              setSelectedClientId(client.id || client.codigo);
              setActiveTab('nuevo');
              notify.success(`Cliente "${client.nombre}" seleccionado para Nota de Pedido.`);
            }}
          />
        )}

        </div>
    </section>
  );
}

