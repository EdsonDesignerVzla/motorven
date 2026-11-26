import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ClipboardList,
  Droplets,
  FilePlus2,
  FileText,
  Monitor,
  Package,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  UserCheck,
  X
} from 'lucide-react';
import OilstoneProductImage from '../OilstoneProductImage';
import { useNotification } from '../../context/NotificationContext';
import {
  canManageInvoices,
  isClientApproved
} from '../../services/authService';
import {
  calculateExpirationDate,
  canUserGrantCreditOverride,
  evaluateClientCreditPolicy,
  evaluateClientCreditPortfolioSummary,
  formatDateVe,
  getAuthorizedApproverGroups,
  resolveCreditDaysFromTerm
} from '../../services/creditPolicyService';
import { calculateFiscalTaxes } from '../../services/fiscalService';
import {
  formatBs,
  formatUnitVe,
  formatUsd,
  getProductWarehouseStocks,
  resolveProductLitersPerUnit,
  resolveProductUnit,
  round2
} from '../../services/formatService';
import { generateSellerOrderPDF } from '../../services/pdfReportService';
import { lineSubtotal, PRICE_CHANNEL, resolveUnitPrice } from '../../services/pricingService';
import MobileOrderDetailView from './MobileOrderDetailView';
import {
  buildCommittedStockMap,
  computeOrderMetrics,
  extractViscosityBadge,
  generateMobileOrderNumber,
  getOrderNumber,
  isCommercialPresaleOrder,
  isSellerProfile,
  normalizeOrderStatus,
  resolveDailyRate,
  resolveOrderExpirationStatus,
  resolveVisibleClients
} from './mobileOrderHelpers';

const PAYMENT_TERMS = [
  { id: 'CONTADO', label: 'Contado' },
  { id: '7_DIAS', label: '7 días' },
  { id: '15_DIAS', label: '15 días' },
  { id: '21_DIAS', label: '21 días' },
  { id: '30_DIAS', label: '30 días' }
];

const ORDER_FILTERS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'ACTIVOS', label: 'Activos / Caja' },
  { id: 'POR_VENCER', label: 'Por Vencer' },
  { id: 'VENCIDOS', label: 'Vencidos' },
  { id: 'RETENIDOS', label: 'Retenidos' },
  { id: 'FACTURADOS', label: 'Facturados' }
];

const CLIENT_FILTERS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'POR_VENCER', label: 'Por Vencer' },
  { id: 'VENCIDOS', label: 'Vencidos / Mora' },
  { id: 'SOLVENTES', label: 'Solventes' }
];

export default function MobileOrdersView({
  orders = [],
  products = [],
  clients = [],
  profitInvoices = [],
  sales = [],
  profitSellers = [],
  config,
  currentUser,
  onSaveOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onProceedToPOS,
  onSwitchToDesktop,
  initialSubTab = 'mis_pedidos',
  initialProduct = null,
  initialClient = null,
  initialContextKey = 0,
  selectedOrder = null,
  onConsumeInitialContext,
  onClearSelectedOrder
}) {
  const notify = useNotification();
  const safeRate = resolveDailyRate(config);

  const [subTab, setSubTab] = useState(initialSubTab === 'crear' ? 'crear' : 'mis_pedidos');
  const [detailOrder, setDetailOrder] = useState(selectedOrder || null);

  // Estado del creador de Preventa Móvil
  const [docType, setDocType] = useState('NOTA_ENTREGA'); // 'NOTA_ENTREGA' (Alm 02 Exento) | 'FACTURA' (Alm 01 +16% IVA)
  const [priceChannel, setPriceChannel] = useState(PRICE_CHANNEL.PREVENTA); // 'PREVENTA' (Detal) | 'OFICINA' (Mayor)
  const [paymentTerm, setPaymentTerm] = useState('CONTADO');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('TODOS');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [viscosityFilter, setViscosityFilter] = useState('TODAS');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [cartQtyByProduct, setCartQtyByProduct] = useState({});
  const [observaciones, setObservaciones] = useState('');
  const [grantOverride, setGrantOverride] = useState(false);
  const [overrideAuthorizer, setOverrideAuthorizer] = useState('');
  const [overrideJustification, setOverrideJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estado de la bandeja Mis Pedidos
  const [ordersQuery, setOrdersQuery] = useState('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('TODOS');
  const [busyApproveId, setBusyApproveId] = useState(null);

  const approverInfo = useMemo(() => getAuthorizedApproverGroups(config), [config]);
  const userCanOverrideCredit = useMemo(() => canUserGrantCreditOverride(currentUser, { mobile: true }), [currentUser]);
  const sellerOnly = useMemo(() => isSellerProfile(currentUser), [currentUser]);

  // Sincronización con contextos externos (Inicio -> +Crear Pedido / Detalle, Stock -> +Pedir, CxC -> +Preventa)
  useEffect(() => {
    if (selectedOrder) {
      setDetailOrder(selectedOrder);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (initialSubTab === 'crear' || initialProduct || initialClient) {
      setSubTab('crear');
      setDetailOrder(null);
    } else if (initialContextKey > 0 && initialSubTab === 'mis_pedidos') {
      setSubTab('mis_pedidos');
    }

    if (initialClient) {
      const cid = String(initialClient.id || initialClient.codigo || initialClient.co_cli || '');
      if (cid) setSelectedClientId(cid);
    }

    if (initialProduct) {
      const pid = String(initialProduct.id || initialProduct.codigo || '');
      if (pid) {
        const stocks = getProductWarehouseStocks(initialProduct);
        if (stocks.stock02 <= 0 && stocks.stock01 > 0) {
          setDocType('FACTURA');
        }
        setCartQtyByProduct((prev) => ({
          ...prev,
          [pid]: Math.max(1, Number(prev[pid] || 0))
        }));
      }
    }

    if (initialProduct || initialClient) {
      onConsumeInitialContext?.();
    }
  }, [initialContextKey, initialSubTab, initialProduct, initialClient, onConsumeInitialContext]);

  useEffect(() => {
    if (!overrideAuthorizer && approverInfo.defaultAuthorizer) {
      setOverrideAuthorizer(approverInfo.defaultAuthorizer);
    }
  }, [overrideAuthorizer, approverInfo.defaultAuthorizer]);

  const targetWarehouse = docType === 'NOTA_ENTREGA' ? '02' : '01';
  const previewOrderNumber = useMemo(
    () => generateMobileOrderNumber(orders, docType === 'NOTA_ENTREGA'),
    [orders, docType]
  );
  const committedStock = useMemo(() => buildCommittedStockMap(orders), [orders]);

  const visibleClients = useMemo(
    () => resolveVisibleClients(clients, currentUser, profitSellers),
    [clients, currentUser, profitSellers]
  );

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return (
      visibleClients.find(
        (c) =>
          String(c.id || '') === String(selectedClientId) ||
          String(c.codigo || c.co_cli || '') === String(selectedClientId)
      ) ||
      (clients || []).find((c) => String(c.id || '') === String(selectedClientId)) ||
      null
    );
  }, [selectedClientId, visibleClients, clients]);

  const clientEntriesWithStatus = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    const shouldEvalPortfolio = showClientPicker || clientStatusFilter !== 'TODOS';

    const list = visibleClients
      .map((c) => {
        const portfolio = shouldEvalPortfolio
          ? evaluateClientCreditPortfolioSummary({
              client: c,
              profitInvoices,
              sales,
              tasaBcv: safeRate
            })
          : null;
        const estado = portfolio?.estadoPortfolio || 'SOLVENTE';
        return { client: c, portfolio, estado };
      })
      .filter(({ client: c, estado }) => {
        if (clientStatusFilter === 'POR_VENCER' && estado !== 'POR_VENCER') return false;
        if (clientStatusFilter === 'VENCIDOS' && estado !== 'EN_MORA') return false;
        if (clientStatusFilter === 'SOLVENTES' && estado !== 'SOLVENTE' && estado !== 'CREDITO_VIGENTE') return false;

        if (!q) return true;
        const name = String(c.nombre || c.razonSocial || '').toLowerCase();
        const rif = String(c.rif || '').toLowerCase();
        const city = String(c.ciudad || '').toLowerCase();
        return name.includes(q) || rif.includes(q) || city.includes(q);
      });

    return list.slice(0, 40);
  }, [visibleClients, clientQuery, clientStatusFilter, showClientPicker, profitInvoices, sales, safeRate]);

  const catalogProducts = useMemo(() => {
    return (Array.isArray(products) ? products : [])
      .map((prod) => {
        const pid = String(prod.id || prod.codigo || '');
        const stocks = getProductWarehouseStocks(prod);
        const physicalWh = targetWarehouse === '02' ? stocks.stock02 : stocks.stock01;
        const reservedWh = committedStock.getCommitted(prod, targetWarehouse);
        const atpAvailable = Math.max(0, physicalWh - reservedWh);
        const unitPrice = resolveUnitPrice(prod, selectedClient, priceChannel, targetWarehouse);
        return {
          prod,
          pid,
          physicalWh,
          reservedWh,
          atpAvailable,
          unitPrice,
          viscosity: extractViscosityBadge(prod),
          unitName: resolveProductUnit(prod, 'Caja'),
          litersPerUnit: resolveProductLitersPerUnit(prod)
        };
      })
      .filter((entry) => entry.pid && (entry.physicalWh > 0 || (cartQtyByProduct[entry.pid] || 0) > 0));
  }, [products, targetWarehouse, committedStock, selectedClient, priceChannel, cartQtyByProduct]);

  const viscosityChips = useMemo(() => {
    const counts = new Map();
    catalogProducts.forEach((entry) => {
      if (entry.viscosity !== 'OILSTONE') {
        counts.set(entry.viscosity, (counts.get(entry.viscosity) || 0) + 1);
      }
    });
    return [
      'TODAS',
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([v]) => v)
    ];
  }, [catalogProducts]);

  const filteredCatalog = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return catalogProducts.filter((entry) => {
      const inCart = (cartQtyByProduct[entry.pid] || 0) > 0;
      if (showOnlyAvailable && entry.atpAvailable <= 0 && !inCart) {
        return false;
      }
      if (viscosityFilter !== 'TODAS' && entry.viscosity !== viscosityFilter && !inCart) {
        return false;
      }
      if (!q) return true;
      const text = `${entry.prod.nombre || ''} ${entry.prod.descripcion || ''} ${entry.prod.codigo || ''} ${entry.viscosity}`.toLowerCase();
      return text.includes(q);
    });
  }, [catalogProducts, showOnlyAvailable, viscosityFilter, productQuery, cartQtyByProduct]);

  const cartEntries = useMemo(() => {
    return catalogProducts
      .filter((entry) => (cartQtyByProduct[entry.pid] || 0) > 0)
      .map((entry, idx) => {
        const qty = Number(cartQtyByProduct[entry.pid] || 0);
        const sub = lineSubtotal(qty, entry.unitPrice);
        const litrosTot = round2(qty * entry.litersPerUnit);
        const aplicaIva = docType !== 'NOTA_ENTREGA' && entry.prod.aplicaIva !== false;
        return {
          ...entry,
          rengNum: idx + 1,
          cantidad: qty,
          subtotalUsd: sub,
          litrosTotales: litrosTot,
          aplicaIva
        };
      });
  }, [catalogProducts, cartQtyByProduct, docType]);

  const taxSummary = useMemo(() => {
    const fiscalItems = cartEntries.map((item) => ({
      cantidad: item.cantidad,
      precioUsd: item.unitPrice,
      subtotalUsd: item.subtotalUsd,
      tipoAlicuota: item.aplicaIva ? 'GENERAL_16' : 'EXENTO_0',
      aplicaIva: item.aplicaIva
    }));
    return calculateFiscalTaxes({
      items: fiscalItems,
      tipoDoc: docType,
      metodoPago: paymentTerm === 'CONTADO' ? 'TRANSFERENCIA_BS' : 'CREDITO',
      condicionPago: paymentTerm,
      tasaBcv: safeRate,
      esSujetoPasivoEspecial: false
    });
  }, [cartEntries, docType, paymentTerm, safeRate]);

  const totalUnitsInCart = useMemo(
    () => cartEntries.reduce((acc, it) => acc + it.cantidad, 0),
    [cartEntries]
  );
  const totalLitrosInCart = useMemo(
    () => round2(cartEntries.reduce((acc, it) => acc + it.litrosTotales, 0)),
    [cartEntries]
  );

  const clientPortfolio = useMemo(() => {
    if (!selectedClient) return null;
    return evaluateClientCreditPortfolioSummary({
      client: selectedClient,
      profitInvoices,
      sales,
      tasaBcv: safeRate
    });
  }, [selectedClient, profitInvoices, sales, safeRate]);

  const creditEvaluation = useMemo(() => {
    if (!selectedClient) return null;
    return evaluateClientCreditPolicy({
      client: selectedClient,
      profitInvoices,
      sales,
      tasaBcv: safeRate,
      montoOrdenUsd: taxSummary.totalFacturaUsd
    });
  }, [selectedClient, profitInvoices, sales, safeRate, taxSummary.totalFacturaUsd]);

  const isCreditOperation = paymentTerm !== 'CONTADO';
  const clientApprovedForSales = !selectedClient || isClientApproved(selectedClient);
  const creditBlocked = Boolean(isCreditOperation && creditEvaluation && !creditEvaluation.isAprobado);

  const handleSwitchDocType = (nextDocType) => {
    if (nextDocType === docType) return;
    const nextWh = nextDocType === 'NOTA_ENTREGA' ? '02' : '01';
    const nextCart = {};
    let adjustedCount = 0;

    Object.entries(cartQtyByProduct).forEach(([pid, rawQty]) => {
      const qty = Number(rawQty || 0);
      if (qty <= 0) return;
      const prod = (products || []).find((p) => String(p.id || p.codigo || '') === String(pid));
      if (!prod) return;
      const stocks = getProductWarehouseStocks(prod);
      const physical = nextWh === '02' ? stocks.stock02 : stocks.stock01;
      const reserved = committedStock.getCommitted(prod, nextWh);
      const maxAtp = Math.max(0, physical - reserved);
      if (maxAtp <= 0) {
        adjustedCount += 1;
        return;
      }
      if (qty > maxAtp) {
        nextCart[pid] = maxAtp;
        adjustedCount += 1;
      } else {
        nextCart[pid] = qty;
      }
    });

    setDocType(nextDocType);
    if (adjustedCount > 0) {
      setCartQtyByProduct(nextCart);
      notify.warning(`Se ajustaron ${adjustedCount} producto(s) según disponibilidad ATP en Alm. ${nextWh}.`);
    }
  };

  const handleAdjustProductQty = (entry, delta) => {
    setCartQtyByProduct((prev) => {
      const current = Number(prev[entry.pid] || 0);
      const next = Math.max(0, current + delta);
      if (delta > 0 && next > entry.atpAvailable) {
        notify.warning(`Máximo ATP 72h en Alm. ${targetWarehouse}: ${entry.atpAvailable} ${entry.unitName}`);
        return { ...prev, [entry.pid]: Math.max(current, entry.atpAvailable) };
      }
      if (next === 0) {
        const clone = { ...prev };
        delete clone[entry.pid];
        return clone;
      }
      return { ...prev, [entry.pid]: next };
    });
  };

  const handleSubmitPreventa = async (saveAsDraft = false) => {
    if (!onSaveOrder || submitting) return;
    if (!selectedClient) {
      notify.warning('Selecciona un cliente antes de enviar la preventa.');
      setShowClientPicker(true);
      return;
    }
    if (!clientApprovedForSales) {
      notify.error('Este cliente aún está pendiente de aprobación por Administración / Gerencia.');
      return;
    }
    if (cartEntries.length === 0) {
      notify.warning('Agrega al menos un lubricante al carrito de preventa.');
      return;
    }

    const stockExceedEntry = cartEntries.find((e) => e.cantidad > e.atpAvailable || e.atpAvailable <= 0);
    if (stockExceedEntry) {
      notify.error(`Stock ATP insuficiente en Alm. ${targetWarehouse} para ${stockExceedEntry.prod.nombre || stockExceedEntry.prod.codigo}.`);
      return;
    }
    const zeroPriceEntry = cartEntries.find((e) => Number(e.unitPrice || 0) <= 0);
    if (zeroPriceEntry) {
      notify.error(`Producto sin precio válido configurado: ${zeroPriceEntry.prod.nombre || zeroPriceEntry.prod.codigo}.`);
      return;
    }

    if (creditBlocked && grantOverride && userCanOverrideCredit && !overrideJustification.trim()) {
      notify.warning('Indica la justificación para la excepción gerencial de crédito.');
      return;
    }

    const nowIso = new Date().toISOString();
    const isNe = docType === 'NOTA_ENTREGA';
    const orderNum = generateMobileOrderNumber(orders, isNe);
    const creditDays = resolveCreditDaysFromTerm(paymentTerm, selectedClient?.diasCredito || 15);
    const dueDate = calculateExpirationDate(nowIso, creditDays || 3); // Vigencia ATP 72h si contado

    let status = 'APROBADO';
    if (saveAsDraft) {
      status = 'PENDIENTE';
    } else if (creditBlocked && !(grantOverride && userCanOverrideCredit)) {
      status = 'RETENIDO_CREDITO';
    }

    const sellerName = currentUser?.nombre || currentUser?.username || 'Vendedor Móvil';
    const sellerCode = currentUser?.co_ven || currentUser?.coVen || currentUser?.codigo || '';

    const orderItems = cartEntries.map((entry) => ({
      rengNum: entry.rengNum,
      articuloId: entry.prod.id || entry.prod.codigo || entry.pid,
      productoId: entry.pid,
      codigo: entry.prod.codigo || entry.pid,
      articuloDescripcion: entry.prod.nombre || entry.prod.descripcion || 'Lubricante OILSTONE',
      unidadVenta: entry.unitName,
      cantidad: entry.cantidad,
      litrosUnitarios: entry.litersPerUnit,
      litrosTotales: entry.litrosTotales,
      precioUnitarioUsd: entry.unitPrice,
      totalUsd: entry.subtotalUsd,
      tipoAlicuota: entry.aplicaIva ? 'GENERAL_16' : 'EXENTO_0',
      aplicaIva: entry.aplicaIva
    }));

    const payload = {
      id: `${orderNum}-${Date.now().toString().slice(-4)}`,
      numeroPedido: orderNum,
      numeroDoc: orderNum,
      tipoDoc: docType,
      fechaEmision: nowIso,
      fechaEntrega: dueDate ? dueDate.toISOString() : nowIso,
      fechaVencimiento: dueDate ? dueDate.toISOString() : nowIso,
      clienteId: selectedClient.id || selectedClient.codigo || selectedClient.co_cli || '',
      clienteNombre: selectedClient.nombre || selectedClient.razonSocial || 'Cliente',
      clienteRif: selectedClient.rif || '',
      vendedorId: currentUser?.id || sellerCode || sellerName,
      vendedorCoVen: sellerCode,
      vendedorNombre: sellerName,
      modalidadVenta: priceChannel === PRICE_CHANNEL.OFICINA || isNe ? (isNe ? 'OFICINA' : 'PREVENTA') : 'PREVENTA',
      almacen: targetWarehouse,
      almacenId: targetWarehouse,
      co_alma: targetWarehouse,
      zonaVenta: selectedClient.zona || selectedClient.zonaVenta || '01',
      segmento: selectedClient.tipoCliente || 'Comercial',
      condicionPago: paymentTerm,
      diasCredito: creditDays,
      moneda: 'USD',
      tasaCambio: safeRate,
      tasaBcv: safeRate,
      subtotalUsd: taxSummary.subtotalNetoUsd,
      baseImponibleUsd: taxSummary.baseGeneralUsd,
      aplicaIva: !isNe && taxSummary.totalIvaUsd > 0,
      ivaPorcentaje: isNe ? 0 : 16,
      ivaUsd: taxSummary.totalIvaUsd,
      totalUsd: taxSummary.totalFacturaUsd,
      totalBs: taxSummary.totalFacturaBs,
      totalLitros: totalLitrosInCart,
      totalUnidades: totalUnitsInCart,
      totalCajas: totalUnitsInCart,
      totalItems: orderItems.length,
      status,
      estado: status,
      direccionEntrega: selectedClient.direccion || '',
      observaciones: observaciones.trim() || `Preventa Móvil (${isNe ? 'Reserva NE Alm 02' : 'Pedido Fiscal Alm 01'})`,
      creadoPor: sellerName,
      creditOverrideApproved: Boolean(creditBlocked && grantOverride && userCanOverrideCredit),
      creditOverrideAuthorizer: creditBlocked && grantOverride && userCanOverrideCredit ? overrideAuthorizer : null,
      creditOverrideJustification: creditBlocked && grantOverride && userCanOverrideCredit ? overrideJustification.trim() : null,
      items: orderItems
    };

    setSubmitting(true);
    try {
      const saved = await onSaveOrder(payload);
      setCartQtyByProduct({});
      setObservaciones('');
      setGrantOverride(false);
      setOverrideJustification('');
      setSubTab('mis_pedidos');
      if (saved) setDetailOrder(saved);
    } catch {
      // Manejado por notify.error en App.jsx
    } finally {
      setSubmitting(false);
    }
  };

  // Bandeja Mis Pedidos filtrada y métricas (excluye SOLICITUD_CLIENTE)
  const scopedOrders = useMemo(() => {
    const list = (Array.isArray(orders) ? orders : []).filter(isCommercialPresaleOrder);
    const sorted = [...list].sort((a, b) => {
      const da = new Date(a.fechaEmision || a.created_at || 0).getTime() || 0;
      const db = new Date(b.fechaEmision || b.created_at || 0).getTime() || 0;
      return db - da;
    });

    if (!sellerOnly) return sorted;
    const uName = String(currentUser?.nombre || '').trim().toLowerCase();
    const uCode = String(currentUser?.co_ven || currentUser?.coVen || '').trim().toLowerCase();
    const filtered = sorted.filter((o) => {
      const vName = String(o.vendedorNombre || o.creadoPor || '').toLowerCase();
      const vCode = String(o.vendedorCoVen || o.vendedorId || '').toLowerCase();
      return (uName && vName.includes(uName)) || (uCode && vCode === uCode);
    });
    return filtered.length > 0 ? filtered : sorted;
  }, [orders, sellerOnly, currentUser]);

  const scopedOrdersWithExp = useMemo(() => {
    return scopedOrders.map((ord) => ({
      ord,
      st: normalizeOrderStatus(ord),
      exp: resolveOrderExpirationStatus(ord, { profitInvoices, sales })
    }));
  }, [scopedOrders, profitInvoices, sales]);

  const ordersStats = useMemo(() => {
    let activosCount = 0;
    let activosUsd = 0;
    let activosLitros = 0;
    let porVencerCount = 0;
    let vencidosCount = 0;

    scopedOrdersWithExp.forEach(({ ord, st, exp }) => {
      if (exp.state === 'POR_VENCER') porVencerCount += 1;
      if (exp.state === 'VENCIDO') vencidosCount += 1;

      if (!st.isBilled && !st.isCancelled) {
        activosCount += 1;
        const m = computeOrderMetrics(ord, safeRate);
        activosUsd += m.totalUsd;
        activosLitros += m.totalLitros;
      }
    });

    return {
      activosCount,
      activosUsd: round2(activosUsd),
      activosBs: round2(activosUsd * safeRate),
      activosLitros: round2(activosLitros),
      porVencerCount,
      vencidosCount
    };
  }, [scopedOrdersWithExp, safeRate]);

  const filteredOrdersList = useMemo(() => {
    const q = ordersQuery.trim().toLowerCase();
    return scopedOrdersWithExp.filter(({ ord, st, exp }) => {
      if (ordersStatusFilter === 'ACTIVOS' && (st.isBilled || st.isCancelled)) return false;
      if (ordersStatusFilter === 'POR_VENCER' && exp.state !== 'POR_VENCER') return false;
      if (ordersStatusFilter === 'VENCIDOS' && exp.state !== 'VENCIDO') return false;
      if (ordersStatusFilter === 'RETENIDOS' && !st.isRetained) return false;
      if (ordersStatusFilter === 'FACTURADOS' && !st.isBilled) return false;

      if (!q) return true;
      const num = getOrderNumber(ord).toLowerCase();
      const cli = String(ord.clienteNombre || ord.cliente || '').toLowerCase();
      const rif = String(ord.clienteRif || '').toLowerCase();
      const ven = String(ord.vendedorNombre || '').toLowerCase();
      return num.includes(q) || cli.includes(q) || rif.includes(q) || ven.includes(q);
    });
  }, [scopedOrdersWithExp, ordersStatusFilter, ordersQuery]);

  if (detailOrder) {
    return (
      <MobileOrderDetailView
        order={detailOrder}
        clients={clients}
        profitInvoices={profitInvoices}
        sales={sales}
        config={config}
        currentUser={currentUser}
        onBack={() => {
          setDetailOrder(null);
          onClearSelectedOrder?.();
        }}
        onUpdateOrderStatus={onUpdateOrderStatus}
        onProceedToPOS={onProceedToPOS}
        onDeleteOrder={onDeleteOrder}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      {/* Tabs Segmentados Stitch: Generar Preventa / Mis Pedidos */}
      <div className="mobile-segmented-tabs">
        <button
          type="button"
          className={`mobile-segmented-tab ${subTab === 'crear' ? 'active' : ''}`}
          onClick={() => setSubTab('crear')}
        >
          <FilePlus2 size={15} />
          <span>Generar Preventa</span>
          {totalUnitsInCart > 0 && (
            <span className="mobile-pill-badge danger">{totalUnitsInCart}</span>
          )}
        </button>
        <button
          type="button"
          className={`mobile-segmented-tab ${subTab === 'mis_pedidos' ? 'active' : ''}`}
          onClick={() => setSubTab('mis_pedidos')}
        >
          <ClipboardList size={15} />
          <span>Mis Pedidos</span>
          <span className="mobile-pill-badge info">{ordersStats.activosCount}</span>
        </button>
      </div>

      {/* =====================================================================
          SUB-VISTA 1: PREVENTA MÓVIL (BR-PRE-001 + BR-FIS-002 + ATP 72H)
         ===================================================================== */}
      {subTab === 'crear' && (
        <>
          {/* Hero Banner Stitch: MODO PREVENTA ACTIVO */}
          <div className="mob-pos-hero-banner">
            <div className="mob-pos-hero-icon">
              <ShieldCheck size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mob-pos-hero-title">
                <span>MODO PREVENTA ACTIVO</span>
                <span className="mob-pos-live-dot" />
              </div>
              <div className="mob-pos-hero-sub">
                Reserva virtual ATP 72h • Sin egreso físico hasta facturar
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '0.64rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.14)',
                color: '#ffffff',
                flexShrink: 0
              }}
            >
              Alm {targetWarehouse}
            </span>
          </div>

          {/* 1. TIPO DE COMPROBANTE + CANAL + PLAZO */}
          <div className="mobile-card" style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span className="mobile-telemetry-label">TIPO DE COMPROBANTE</span>
              <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.68rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                PROFIT: {previewOrderNumber}
              </span>
            </div>

            <div className="mob-pos-doc-grid">
              <button
                type="button"
                className={`mob-pos-doc-card ${docType === 'NOTA_ENTREGA' ? 'active' : ''}`}
                onClick={() => handleSwitchDocType('NOTA_ENTREGA')}
              >
                <div className="mob-pos-doc-top">
                  <span className="mob-pos-doc-title">Nota de Entrega (N/E)</span>
                  <span className="mob-pos-doc-radio">
                    {docType === 'NOTA_ENTREGA' && <span className="mob-pos-doc-radio-dot" />}
                  </span>
                </div>
                <div className="mob-pos-doc-meta">
                  <span className="mob-pos-doc-wh-pill">Alm 02 / Directo</span>
                  <span className="mob-pos-doc-tax-label">Exento</span>
                </div>
              </button>

              <button
                type="button"
                className={`mob-pos-doc-card ${docType === 'FACTURA' ? 'active' : ''}`}
                onClick={() => handleSwitchDocType('FACTURA')}
              >
                <div className="mob-pos-doc-top">
                  <span className="mob-pos-doc-title">Fiscal (SENIAT)</span>
                  <span className="mob-pos-doc-radio">
                    {docType === 'FACTURA' && <span className="mob-pos-doc-radio-dot" />}
                  </span>
                </div>
                <div className="mob-pos-doc-meta">
                  <span className="mob-pos-doc-wh-pill">Alm 01</span>
                  <span className="mob-pos-doc-tax-label">+16% IVA</span>
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  type="button"
                  className={`mobile-chip ${priceChannel === PRICE_CHANNEL.PREVENTA ? 'active' : ''}`}
                  onClick={() => setPriceChannel(PRICE_CHANNEL.PREVENTA)}
                >
                  Lista Detal (Calle)
                </button>
                <button
                  type="button"
                  className={`mobile-chip ${priceChannel === PRICE_CHANNEL.OFICINA ? 'active' : ''}`}
                  onClick={() => setPriceChannel(PRICE_CHANNEL.OFICINA)}
                >
                  Lista Mayor (Oficina)
                </button>
              </div>
            </div>

            <div className="mobile-chips-row">
              {PAYMENT_TERMS.map((term) => (
                <button
                  key={term.id}
                  type="button"
                  className={`mobile-chip ${paymentTerm === term.id ? 'active' : ''}`}
                  onClick={() => setPaymentTerm(term.id)}
                >
                  {term.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. CLIENTE COMERCIAL & CRÉDITO / DEUDA */}
          <div className="mobile-card" style={{ padding: '11px 12px' }}>
            {selectedClient ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.90rem', fontWeight: 800, color: 'var(--mob-text)' }}>
                        {selectedClient.nombre || selectedClient.razonSocial}
                      </span>
                      {clientPortfolio && (
                        <span className={`mobile-pill-badge ${clientPortfolio.badgeTone === 'neutral' ? 'info' : clientPortfolio.badgeTone}`}>
                          {clientPortfolio.estadoLabel}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
                      RIF: {selectedClient.rif || 'Sin RIF'} • {selectedClient.ciudad || selectedClient.zona || 'Ruta Activa'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setShowClientPicker((v) => !v)}
                      className="mobile-chip active"
                      style={{ padding: '5px 9px', fontSize: '0.66rem' }}
                      title="Cambiar cliente"
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                  </div>
                </div>

                <div className="mob-pos-client-metrics">
                  <div className="mob-pos-client-metric-box">
                    <div className="mobile-telemetry-label" style={{ fontSize: '0.58rem' }}>CRÉDITO DISPONIBLE</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.02rem', fontWeight: 800, color: 'var(--mob-text)', marginTop: '2px' }}>
                      {formatUsd(creditEvaluation?.creditoDisponibleUsd ?? 0)}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
                      Plazo: {selectedClient.diasCredito || 15} Días • Lím {formatUsd(creditEvaluation?.limiteCreditoUsd ?? selectedClient.limiteCredito ?? 0)}
                    </div>
                  </div>
                  <div className="mob-pos-client-metric-box">
                    <div className="mobile-telemetry-label" style={{ fontSize: '0.58rem' }}>DEUDA ACTUAL</div>
                    <div
                      style={{
                        fontFamily: 'var(--font-tech)',
                        fontSize: '1.02rem',
                        fontWeight: 800,
                        color: (creditEvaluation?.saldoDeudorUsd || 0) > 0 ? 'var(--mob-amber)' : 'var(--mob-green)',
                        marginTop: '2px'
                      }}
                    >
                      {formatUsd(creditEvaluation?.saldoDeudorUsd ?? selectedClient.saldoDeudorUsd ?? 0)}
                    </div>
                    <div
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        color: (creditEvaluation?.vencidasCount || 0) > 0 ? 'var(--mob-red)' : 'var(--mob-green)',
                        marginTop: '2px'
                      }}
                    >
                      {(creditEvaluation?.vencidasCount || 0) > 0
                        ? `${creditEvaluation.vencidasCount} Factura(s) en mora`
                        : '✓ 0 Facturas en mora'}
                    </div>
                  </div>
                </div>

                {!clientApprovedForSales && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '7px 9px',
                      borderRadius: '9px',
                      background: 'var(--mob-red-soft)',
                      color: 'var(--mob-red)',
                      fontSize: '0.70rem',
                      fontWeight: 700
                    }}
                  >
                    Cliente en revisión administrativa. Debe aprobarse antes de procesar pedidos.
                  </div>
                )}

                {creditBlocked && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: 'var(--mob-amber-soft)',
                      border: '1px solid var(--mob-amber)',
                      fontSize: '0.70rem',
                      color: 'var(--mob-text)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontWeight: 700, color: 'var(--mob-amber)' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span>{creditEvaluation.motivo}</span>
                    </div>

                    {userCanOverrideCredit ? (
                      <div style={{ marginTop: '7px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={grantOverride}
                            onChange={(e) => setGrantOverride(e.target.checked)}
                          />
                          Autorizar excepción gerencial y enviar directo a Caja
                        </label>
                        {grantOverride && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <select
                              value={overrideAuthorizer}
                              onChange={(e) => setOverrideAuthorizer(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--mob-border)',
                                background: 'var(--mob-surface)',
                                color: 'var(--mob-text)',
                                fontSize: '0.70rem'
                              }}
                            >
                              {approverInfo.approverGroups.map((g) => (
                                <optgroup key={g.category} label={g.category}>
                                  {g.people.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <input
                              value={overrideJustification}
                              onChange={(e) => setOverrideJustification(e.target.value)}
                              placeholder="Motivo de autorización excepcional..."
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--mob-border)',
                                background: 'var(--mob-surface)',
                                color: 'var(--mob-text)',
                                fontSize: '0.70rem'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px', fontSize: '0.66rem', color: 'var(--mob-text-muted)' }}>
                        Si envías el pedido a crédito se guardará como <strong>RETENIDO POR CRÉDITO</strong> para validación de Gerencia.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span className="mobile-telemetry-label">CLIENTE COMERCIAL</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {onSwitchToDesktop && (
                      <button
                        type="button"
                        onClick={onSwitchToDesktop}
                        className="mobile-chip"
                        style={{ padding: '3px 8px', fontSize: '0.62rem' }}
                        title="Solicitar o crear cliente nuevo desde vista escritorio"
                      >
                        <Monitor size={11} /> Nuevo en PC
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowClientPicker((v) => !v)}
                      className="mobile-chip active"
                      style={{ padding: '4px 10px', fontSize: '0.68rem' }}
                    >
                      Elegir Cliente
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '7px', fontSize: '0.74rem', color: 'var(--mob-text-muted)' }}>
                  Toca <strong>Elegir Cliente</strong> para vincular RIF, cupo de crédito y ruta asignada.
                </div>
              </div>
            )}

            {showClientPicker && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--mob-border)' }}>
                <div className="mobile-search-bar" style={{ height: '38px' }}>
                  <Search size={14} color="var(--mob-text-muted)" />
                  <input
                    className="mobile-search-input"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    placeholder="Buscar razón social, RIF o ciudad..."
                  />
                  {clientQuery && (
                    <button
                      type="button"
                      onClick={() => setClientQuery('')}
                      style={{ border: 'none', background: 'transparent', color: 'var(--mob-text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="mobile-chips-row" style={{ marginTop: '7px' }}>
                  {CLIENT_FILTERS.map((cf) => (
                    <button
                      key={cf.id}
                      type="button"
                      className={`mobile-chip ${clientStatusFilter === cf.id ? 'active' : ''}`}
                      style={{ padding: '4px 9px', fontSize: '0.64rem' }}
                      onClick={() => setClientStatusFilter(cf.id)}
                    >
                      {cf.label}
                    </button>
                  ))}
                </div>

                <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {clientEntriesWithStatus.map(({ client: c, portfolio }) => {
                    const cid = String(c.id || c.codigo || c.co_cli || '');
                    const isSelected = String(selectedClientId) === cid;
                    const debt = Number(portfolio?.evalPolicy?.saldoDeudorUsd ?? c.saldoDeudorUsd ?? 0);
                    const badgeTone = portfolio?.badgeTone === 'neutral' ? 'info' : (portfolio?.badgeTone || 'success');
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => {
                          setSelectedClientId(cid);
                          setShowClientPicker(false);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          border: `1px solid ${isSelected ? 'var(--mob-navy)' : 'var(--mob-border)'}`,
                          background: isSelected ? 'var(--mob-navy-soft)' : 'var(--mob-surface-low)',
                          color: 'var(--mob-text)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.76rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.nombre || c.razonSocial}
                          </div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--mob-text-muted)' }}>
                            {c.rif || 'N/A'} {c.ciudad ? `• ${c.ciudad}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {portfolio && portfolio.estadoPortfolio !== 'SOLVENTE' ? (
                            <span className={`mobile-pill-badge ${badgeTone}`} style={{ fontSize: '0.58rem' }}>
                              {portfolio.estadoLabel}
                            </span>
                          ) : (
                            <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.68rem', fontWeight: 800, color: debt > 0 ? 'var(--mob-amber)' : 'var(--mob-green)' }}>
                              {debt > 0 ? `Deuda ${formatUsd(debt)}` : 'Solvente'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {clientEntriesWithStatus.length === 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--mob-text-muted)', textAlign: 'center', padding: '12px' }}>
                      No se encontraron clientes con ese criterio.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. CATÁLOGO OILSTONE LUBRICANTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span className="mobile-telemetry-label">CATÁLOGO OILSTONE LUBRICANTS</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: cartEntries.length > 0 ? 'var(--mob-navy)' : 'var(--mob-text-muted)' }}>
                {cartEntries.length} Seleccionados
              </span>
            </div>

            <div className="mobile-search-bar">
              <Search size={15} color="var(--mob-text-muted)" />
              <input
                className="mobile-search-input"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Buscar viscosidad (15W-40, 20W-50, etc.)..."
              />
              {productQuery && (
                <button
                  type="button"
                  onClick={() => setProductQuery('')}
                  style={{ border: 'none', background: 'transparent', color: 'var(--mob-text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="mobile-chips-row">
              <button
                type="button"
                className={`mobile-chip ${showOnlyAvailable ? 'active' : ''}`}
                onClick={() => setShowOnlyAvailable((v) => !v)}
              >
                Solo ATP &gt; 0
              </button>
              {viscosityChips.map((visc) => (
                <button
                  key={visc}
                  type="button"
                  className={`mobile-chip ${viscosityFilter === visc ? 'active' : ''}`}
                  onClick={() => setViscosityFilter(visc)}
                >
                  {visc === 'TODAS' ? 'Todas' : visc}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredCatalog.slice(0, 60).map((entry) => {
                const qty = Number(cartQtyByProduct[entry.pid] || 0);
                const lineUsd = qty > 0 ? lineSubtotal(qty, entry.unitPrice) : entry.unitPrice;
                const lineBs = round2(lineUsd * safeRate);
                const stockTone = entry.atpAvailable > 5 ? 'success' : entry.atpAvailable > 0 ? 'warning' : 'danger';
                const stockLabel = entry.atpAvailable > 5 ? 'Disponible' : entry.atpAvailable > 0 ? 'Bajo Stock' : 'Agotado';

                return (
                  <div
                    key={entry.pid}
                    className={`mob-pos-product-card ${qty > 0 ? 'in-cart' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <OilstoneProductImage
                        product={entry.prod}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '10px',
                          objectFit: 'contain',
                          background: 'var(--mob-surface-low)',
                          border: '1px solid var(--mob-border)',
                          padding: '4px',
                          flexShrink: 0
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.80rem', fontWeight: 800, color: 'var(--mob-text)', lineHeight: 1.22 }}>
                          {entry.prod.nombre || entry.prod.descripcion}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--mob-text-muted)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
                          Cód: {entry.prod.codigo || entry.pid} • {entry.viscosity}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-code)',
                              fontSize: '0.60rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              background: 'var(--mob-surface-low)',
                              border: '1px solid var(--mob-border)',
                              color: 'var(--mob-text-secondary)'
                            }}
                          >
                            Stock Alm {targetWarehouse}: {entry.atpAvailable} {entry.unitName}
                          </span>
                          <span className={`mobile-pill-badge ${stockTone}`} style={{ fontSize: '0.58rem', padding: '1px 6px' }}>
                            {stockLabel}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.86rem', fontWeight: 800, color: 'var(--mob-text)' }}>
                          {formatUsd(entry.unitPrice)}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--mob-text-muted)' }}>
                          / {entry.unitName.toLowerCase()}
                        </div>
                      </div>
                    </div>

                    <div className="mob-pos-product-bottom">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div className="mobile-stepper">
                          <button
                            type="button"
                            className="mobile-stepper-btn"
                            disabled={qty <= 0}
                            onClick={() => handleAdjustProductQty(entry, -1)}
                            aria-label="Disminuir cantidad"
                          >
                            −
                          </button>
                          <span className="mobile-stepper-val">{qty}</span>
                          <button
                            type="button"
                            className="mobile-stepper-btn plus"
                            onClick={() => handleAdjustProductQty(entry, 1)}
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </button>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', fontWeight: 600 }}>
                          {entry.unitName.toLowerCase()}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.84rem', fontWeight: 800, color: qty > 0 ? 'var(--mob-navy)' : 'var(--mob-text-secondary)' }}>
                          {formatUsd(lineUsd)}
                        </div>
                        <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.64rem', color: 'var(--mob-text-muted)' }}>
                          {formatBs(lineBs)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCatalog.length === 0 && (
                <div className="mobile-card" style={{ padding: '20px', textAlign: 'center', fontSize: '0.76rem', color: 'var(--mob-text-muted)' }}>
                  No hay productos con existencia física disponible en Almacén {targetWarehouse} para esa búsqueda.
                </div>
              )}
            </div>
          </div>

          {/* 4. OBSERVACIONES / RUTA DE DESPACHO */}
          <div className="mobile-card" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="mobile-telemetry-label">OBSERVACIONES / RUTA DE DESPACHO</span>
              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-code)', color: 'var(--mob-text-muted)' }}>
                {observaciones.length}/120
              </span>
            </div>
            <textarea
              rows={2}
              maxLength={120}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Entregar en almacén posterior, recibir con factura original..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid var(--mob-border)',
                borderRadius: '10px',
                padding: '8px 10px',
                background: 'var(--mob-surface-low)',
                color: 'var(--mob-text)',
                fontSize: '0.74rem',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* 5. RESUMEN & CTA ENVIAR PREVENTA (STITCH SUMMARY CARD) */}
          <div className="mob-pos-summary-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div>
                <div className="mobile-telemetry-label" style={{ fontSize: '0.58rem' }}>VOLUMEN OPERATIVO</div>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--mob-text)', marginTop: '2px' }}>
                  {formatUnitVe(totalLitrosInCart)} Litros <span style={{ fontWeight: 600, color: 'var(--mob-text-muted)' }}>({totalUnitsInCart} bultos)</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mobile-telemetry-label" style={{ fontSize: '0.58rem' }}>TASA BCV VIGENTE</div>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.80rem', fontWeight: 800, color: 'var(--mob-text)', marginTop: '2px' }}>
                  {formatBs(safeRate).replace(/^Bs\.\s*/, '')} Bs./$
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--mob-border)' }}>
              <div>
                <div className="mobile-telemetry-label" style={{ fontSize: '0.58rem' }}>
                  TOTAL PREVENTA ESTIMADO {docType === 'FACTURA' ? `(+IVA ${formatUsd(taxSummary.totalIvaUsd)})` : '(EXENTO)'}
                </div>
                <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--mob-navy)', lineHeight: 1.1, marginTop: '2px' }}>
                  {formatUsd(taxSummary.totalFacturaUsd)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mobile-telemetry-label" style={{ fontSize: '0.58rem' }}>EN BOLÍVARES</div>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.84rem', fontWeight: 800, color: 'var(--mob-text-secondary)', marginTop: '2px' }}>
                  {formatBs(taxSummary.totalFacturaBs)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                disabled={submitting || cartEntries.length === 0}
                onClick={() => handleSubmitPreventa(true)}
                className="mobile-chip"
                style={{ minHeight: '44px', padding: '0 12px', borderRadius: '12px', fontWeight: 700 }}
                title="Guardar borrador pendiente"
              >
                Borrador
              </button>
              <button
                type="button"
                disabled={submitting || cartEntries.length === 0 || !clientApprovedForSales}
                onClick={() => handleSubmitPreventa(false)}
                className="mob-pos-send-btn"
              >
                <Send size={15} />
                {submitting ? 'ENVIANDO...' : 'ENVIAR PREVENTA'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          SUB-VISTA 2: MIS PEDIDOS (PIPELINE COMERCIAL MÓVIL)
         ===================================================================== */}
      {subTab === 'mis_pedidos' && (
        <>
          {/* KPI Strip 3 cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
            <div className="mobile-telemetry-card">
              <div className="mobile-telemetry-label">Activos</div>
              <div className="mobile-telemetry-value" style={{ color: 'var(--mob-navy)' }}>{ordersStats.activosCount}</div>
              <div className="mobile-telemetry-sub">En cola 72h</div>
            </div>
            <div className="mobile-telemetry-card">
              <div className="mobile-telemetry-label">Monto Activo</div>
              <div className="mobile-telemetry-value" style={{ fontSize: '0.86rem', color: 'var(--mob-green)' }}>
                {formatUsd(ordersStats.activosUsd)}
              </div>
              <div className="mobile-telemetry-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatBs(ordersStats.activosBs)}
              </div>
            </div>
            <div className="mobile-telemetry-card">
              <div className="mobile-telemetry-label">Litraje ATP</div>
              <div className="mobile-telemetry-value" style={{ fontSize: '0.86rem', color: 'var(--mob-cyan)' }}>
                {formatUnitVe(ordersStats.activosLitros, 0)} L
              </div>
              <div className="mobile-telemetry-sub">Reservado</div>
            </div>
          </div>

          {/* Buscador + CTA Rápido Nueva Preventa */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="mobile-search-bar" style={{ flex: 1 }}>
              <Search size={15} color="var(--mob-text-muted)" />
              <input
                className="mobile-search-input"
                value={ordersQuery}
                onChange={(e) => setOrdersQuery(e.target.value)}
                placeholder="Buscar pedido, cliente o RIF..."
              />
              {ordersQuery && (
                <button
                  type="button"
                  onClick={() => setOrdersQuery('')}
                  style={{ border: 'none', background: 'transparent', color: 'var(--mob-text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSubTab('crear')}
              className="mobile-quick-action-btn primary"
              style={{ padding: '0 12px', height: '42px', borderRadius: '12px' }}
            >
              <Plus size={15} /> Nuevo
            </button>
          </div>

          <div className="mobile-chips-row" style={{ flexWrap: 'wrap', overflowX: 'visible' }}>
            {ORDER_FILTERS.map((f) => {
              const count =
                f.id === 'POR_VENCER'
                  ? ordersStats.porVencerCount
                  : f.id === 'VENCIDOS'
                    ? ordersStats.vencidosCount
                    : null;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`mobile-chip ${ordersStatusFilter === f.id ? 'active' : ''}`}
                  onClick={() => setOrdersStatusFilter(f.id)}
                >
                  <span>{f.label}</span>
                  {count !== null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-code)',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        opacity: ordersStatusFilter === f.id ? 0.95 : 0.85,
                        color:
                          ordersStatusFilter === f.id
                            ? '#ffffff'
                            : f.id === 'VENCIDOS'
                              ? 'var(--mob-red)'
                              : 'var(--mob-amber)'
                      }}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Lista de tarjetas de pedidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {filteredOrdersList.slice(0, 60).map(({ ord, st, exp }) => {
              const ordNum = getOrderNumber(ord);
              const m = computeOrderMetrics(ord, safeRate);
              const rawDate = ord.fechaEmision || ord.fechaCreacion || ord.created_at;
              const matchedCli = clients.find(
                (c) => String(c.id || '') === String(ord.clienteId || '') || String(c.rif || '') === String(ord.clienteRif || '')
              );

              return (
                <div key={ord.id || ordNum} className="mobile-card" style={{ padding: '11px 12px' }}>
                  <div
                    onClick={() => setDetailOrder(ord)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-tech)', fontSize: '0.84rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                          {ordNum}
                        </span>
                        <span className={`mobile-pill-badge ${m.isNe ? 'warning' : 'info'}`} style={{ fontSize: '0.56rem' }}>
                          {m.isNe ? 'NE 02' : 'FAC 01'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {(exp.state === 'VENCIDO' || exp.state === 'POR_VENCER') && (
                          <span className={`mobile-pill-badge ${exp.tone}`}>{exp.label}</span>
                        )}
                        <span className={`mobile-pill-badge ${st.tone}`}>{st.label}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--mob-text)', marginTop: '4px' }}>
                      {ord.clienteNombre || ord.cliente || matchedCli?.nombre || 'Cliente General'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
                      {rawDate ? formatDateVe(rawDate) : 'Hoy'} • {m.plazoLabel} • {ord.vendedorNombre || ord.creadoPor || 'Asesor'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--mob-border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.68rem', color: 'var(--mob-text-muted)', fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Package size={12} /> {m.totalUnits} u.
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Droplets size={12} /> {formatUnitVe(m.totalLitros, 1)} L
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.88rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                          {formatUsd(m.totalUsd)}
                        </div>
                        <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.64rem', color: 'var(--mob-text-muted)' }}>
                          {formatBs(m.totalBs)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones directas en tarjeta */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setDetailOrder(ord)}
                      className="mobile-chip"
                      style={{ flex: 1, justifyContent: 'center', background: 'var(--mob-surface-low)' }}
                    >
                      <ShoppingCart size={12} /> Ver Detalle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          generateSellerOrderPDF({
                            order: {
                              ...ord,
                              tasaCambio: safeRate,
                              tasaBcv: safeRate,
                              totalBs: m.totalBs
                            },
                            config,
                            currentUser,
                            client: matchedCli || null
                          });
                        } catch (err) {
                          console.error('Error generando PDF del pedido:', err);
                          notify.error('No se pudo generar el PDF de este pedido.');
                        }
                      }}
                      className="mobile-chip"
                      style={{ background: 'var(--mob-navy-soft)', color: 'var(--mob-navy)' }}
                    >
                      <FileText size={12} /> PDF
                    </button>
                    {onProceedToPOS && canManageInvoices(currentUser) && !st.isBilled && !st.isCancelled && (
                      <button
                        type="button"
                        onClick={() => onProceedToPOS(ord)}
                        className="mobile-chip"
                        style={{ background: 'var(--mob-red-soft)', color: 'var(--mob-red)' }}
                      >
                        <CheckCircle2 size={12} /> Caja
                      </button>
                    )}
                    {onUpdateOrderStatus && canManageInvoices(currentUser) && st.isRetained && (
                      <button
                        type="button"
                        disabled={busyApproveId === ord.id}
                        onClick={async () => {
                          if (busyApproveId) return;
                          setBusyApproveId(ord.id);
                          try {
                            await onUpdateOrderStatus(ord.id, 'APROBADO');
                          } catch {
                            // Notificado desde App.jsx
                          } finally {
                            setBusyApproveId(null);
                          }
                        }}
                        className="mobile-chip"
                        style={{ background: 'var(--mob-green-soft)', color: 'var(--mob-green)' }}
                      >
                        <UserCheck size={12} /> {busyApproveId === ord.id ? '...' : 'Aprobar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredOrdersList.length === 0 && (
              <div className="mobile-card" style={{ padding: '24px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--mob-text-muted)' }}>
                No hay pedidos registrados en este filtro.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
