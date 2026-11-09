import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  DollarSign,
  UserCheck,
  CheckCircle,
  Printer,
  FileText,
  CreditCard,
  Building,
  Zap,
  Droplet,
  Info,
  Filter,
  Truck,
  Package,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Clock,
  X,
  Inbox,
  Search,
  Lock,
  Calendar,
  Building2,
  User,
  Warehouse
} from 'lucide-react';
import { formatUsd, formatBs, resolveProductUnit, resolveProductLitersPerUnit, getProductWarehouseStocks } from '../services/formatService';
import { calculateFiscalTaxes, validateRif, validateCedula, getNextInvoiceCorrelativo, commitInvoiceCorrelativo, generateFiscalControlNumber } from '../services/fiscalService';
import { resolveUnitPrice, getProductWholesalePrice, isWholesaleClient, lineSubtotal, PRICE_CHANNEL } from '../services/pricingService';
import {
  resolveCreditDaysFromTerm,
  resolveTermCodeFromDays,
  calculateExpirationDate,
  formatDateVe,
  getClientAgreedCreditInfo,
  evaluateClientCreditPolicy,
  getAuthorizedApproverGroups
} from '../services/creditPolicyService';
import OilstoneProductImage from '../components/OilstoneProductImage';
import SalesInvoiceModal from '../components/SalesInvoiceModal';
import CustomerReturnsModal from '../components/CustomerReturnsModal';
import CreditScoreEngineModal from '../components/CreditScoreEngineModal';
import { generateSalesPOSPDF, generateSellerOrderPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

export default function SalesPOSView({
  products = [],
  clients = [],
  orders = [],
  sales = [],
  profitSellers = [],
  config = {},
  profitReturns = [],
  profitInvoices = [],
  profitCollections = [],
  onSyncProfit,
  onProcessSale,
  onOpenOrdersSalesModal,
  currentUser,
  pendingOrderToBill = null,
  onClearPendingOrder
}) {
  const notify = useNotification();
  const safeConfig = config || {};
  const [tipoDoc, setTipoDoc] = useState('FACTURA');
  const [showCreditScoreModal, setShowCreditScoreModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(() => (clients && clients.length > 0 ? (clients[2] || clients[0]) : null));

  useEffect(() => {
    if (!selectedClient && clients && clients.length > 0) {
      setSelectedClient(clients[2] || clients[0]);
    }
  }, [clients, selectedClient]);

  const [cartItems, setCartItems] = useState([]);
  const [condicionPago, setCondicionPago] = useState('CONTADO');
  const [creditTerm, setCreditTerm] = useState('15_DIAS');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO_USD');
  const [modalidadVenta, setModalidadVenta] = useState('MOSTRADOR'); // 'MOSTRADOR' | 'OFICINA'
  const [officeSeller, setOfficeSeller] = useState(
    currentUser?.nombre || 'Oficina Principal Motorven'
  );
  const [documentoAfectado, setDocumentoAfectado] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [lastSaleDoc, setLastSaleDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [selectedSpecProduct, setSelectedSpecProduct] = useState(null);

  // Estados de la Bandeja de Pedidos de Preventa (Vendedores en Calle)
  const [showOrdersDrawer, setShowOrdersDrawer] = useState(false);
  const [ordersDrawerSearch, setOrdersDrawerSearch] = useState('');
  const [activeOrderInPOS, setActiveOrderInPOS] = useState(null);

  // Restricción de NO MODIFICAR cuando un pedido es enviado a caja desde Nota de Pedido o Flujo Comercial
  const isOrderLocked = Boolean(activeOrderInPOS);

  // Estados de Evaluación y Aprobación Excepcional de Crédito en POS Mostrador / Oficina
  const [showCreditApprovalModal, setShowCreditApprovalModal] = useState(false);
  const [creditOverrideApproved, setCreditOverrideApproved] = useState(false);
  const { authorizedApproverIds, approverGroups, defaultAuthorizer } = useMemo(
    () => getAuthorizedApproverGroups(safeConfig),
    [safeConfig]
  );
  const [creditOverrideAuthorizer, setCreditOverrideAuthorizer] = useState(defaultAuthorizer);
  const [creditOverrideJustification, setCreditOverrideJustification] = useState('');

  useEffect(() => {
    if (!creditOverrideApproved && defaultAuthorizer) {
      setCreditOverrideAuthorizer(defaultAuthorizer);
    }
  }, [defaultAuthorizer, creditOverrideApproved]);

  const clientAgreedInfo = useMemo(
    () => getClientAgreedCreditInfo(selectedClient),
    [selectedClient]
  );

  // Sincronizar plazo de crédito del cliente cuando se selecciona otro cliente en modo libre
  useEffect(() => {
    if (isOrderLocked) return;
    setCreditOverrideApproved(false);
    setCreditOverrideJustification('');
    if (clientAgreedInfo.termKey && clientAgreedInfo.termKey !== 'CONTADO') {
      setCreditTerm(clientAgreedInfo.termKey);
    } else {
      setCreditTerm('15_DIAS');
    }
  }, [selectedClient?.id, isOrderLocked]);

  // Buscador de clientes por palabras clave (nombre, RIF, tipo de cliente, domicilio)
  const [clientSearch, setClientSearch] = useState('');
  const normalizeText = (txt) =>
    String(txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  // Lista de clientes ordenada alfabéticamente y filtrada por palabras clave
  const filteredSortedClients = useMemo(() => {
    const sorted = [...(clients || [])].sort((a, b) =>
      String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
    );
    const keywords = normalizeText(clientSearch).split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return sorted;
    return sorted.filter(c => {
      const haystack = normalizeText(
        [c.nombre, c.rif, c.tipoCliente, c.domicilioFiscal, c.ciudad, c.estado, c.telefono, c.email].join(' ')
      );
      return keywords.every(k => haystack.includes(k));
    });
  }, [clients, clientSearch]);

  // Lista de pedidos de preventa vigentes por facturar
  const pendingSellerOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(
      (o) => o && (o.status === 'PENDIENTE' || o.status === 'APROBADO' || o.status === 'EMITIDO')
    );
  }, [orders]);

  // Cargar una Nota de Pedido directamente al carrito del POS (con restricción de NO MODIFICAR)
  const handleLoadOrderToCart = (orderToLoad) => {
    if (!orderToLoad) return;
    // 1. Vincular cliente
    const matchedClient = clients.find(
      (c) =>
        c.rif === orderToLoad.clienteRif ||
        c.id === orderToLoad.clienteId ||
        c.nombre?.toLowerCase() === orderToLoad.clienteNombre?.toLowerCase() ||
        c.razonSocial?.toLowerCase() === orderToLoad.clienteNombre?.toLowerCase()
    );
    const resolvedDays = resolveCreditDaysFromTerm(
      orderToLoad.condicionPago,
      matchedClient?.diasCredito ?? 15,
      orderToLoad.diasCredito
    );

    if (matchedClient) {
      setSelectedClient(matchedClient);
    } else {
      setSelectedClient({
        id: orderToLoad.clienteId || 'CLI-TEMP',
        nombre: orderToLoad.clienteNombre || 'Cliente',
        razonSocial: orderToLoad.clienteNombre || 'Cliente',
        rif: orderToLoad.clienteRif || 'J-000000000',
        tipoCliente: 'Mayorista',
        domicilioFiscal: orderToLoad.direccionEntrega || 'Venezuela',
        direccion: orderToLoad.direccionEntrega || 'Venezuela',
        diasCredito: resolvedDays || 15,
        limiteCreditoUsd: 5000,
        saldoPendienteUsd: 0
      });
    }

    // 1.1 Sincronizar Tipo de Documento y Almacén según la orden (Factura Fiscal -> Alm 01, Nota de Entrega -> Alm 02)
    const isOrderNotaEntrega =
      orderToLoad.tipoDoc === 'NOTA_ENTREGA' ||
      orderToLoad.tipo_doc === 'NOTA_ENTREGA' ||
      orderToLoad.modalidadVenta === 'OFICINA' ||
      orderToLoad.almacen === '02' ||
      orderToLoad.co_alma === '02' ||
      String(orderToLoad.numeroDoc || orderToLoad.id || '').toUpperCase().startsWith('PED-NE');

    if (isOrderNotaEntrega) {
      setTipoDoc('NOTA_ENTREGA');
      setModalidadVenta('OFICINA');
    } else {
      setTipoDoc('FACTURA');
      setModalidadVenta('MOSTRADOR');
    }

    // 2. Establecer condición de pago y plazo exacto que viene de la Nota de Pedido
    const isOrderCash = !orderToLoad.condicionPago || String(orderToLoad.condicionPago).toUpperCase() === 'CONTADO';
    setCondicionPago(isOrderCash ? 'CONTADO' : 'CREDITO');
    if (!isOrderCash) {
      setCreditTerm(resolveTermCodeFromDays(resolvedDays, orderToLoad.condicionPago));
    }

    // 3. Sincronizar estado de aprobación crediticia si el pedido viene aprobado
    if (orderToLoad.creditOverrideApproved || orderToLoad.status === 'APROBADO') {
      setCreditOverrideApproved(Boolean(orderToLoad.creditOverrideApproved || !isOrderCash));
      if (orderToLoad.creditOverrideAuthorizer) {
        setCreditOverrideAuthorizer(orderToLoad.creditOverrideAuthorizer);
      }
      if (orderToLoad.creditOverrideJustification) {
        setCreditOverrideJustification(orderToLoad.creditOverrideJustification);
      }
    } else {
      setCreditOverrideApproved(false);
    }

    // 4. Cargar renglones al carrito
    if (Array.isArray(orderToLoad.items) && orderToLoad.items.length > 0) {
      const loadedCart = orderToLoad.items.map((it) => {
        const matchedProd = products.find((p) => p.id === it.articuloId || p.codigo === it.articuloId);
        const precio = Number(it.precioUnitarioUsd) > 0
          ? Number(it.precioUnitarioUsd)
          : (Number(it.precioUsd) > 0 ? Number(it.precioUsd) : getProductWholesalePrice(matchedProd));
        const cantidad = Number(it.cantidad || 1);
        const litrosUnit = Number(it.litrosUnitarios) > 0 ? Number(it.litrosUnitarios) : (matchedProd ? resolveProductLitersPerUnit(matchedProd) : 0);

        return {
          articuloId: matchedProd?.id || it.articuloId,
          codigo: matchedProd?.codigo || it.articuloId,
          oem: matchedProd?.oem || 'OILSTONE',
          descripcion: it.articuloDescripcion || matchedProd?.descripcion || 'Lubricante Automotriz',
          viscosidad: matchedProd?.viscosidad || 'N/A',
          unidad: resolveProductUnit(it.unidadVenta || matchedProd?.unidad, 'Caja'),
          litrosPorUnidad: litrosUnit,
          litros: cantidad * litrosUnit,
          cantidad: cantidad,
          precioUsd: precio,
          subtotalUsd: lineSubtotal(cantidad, precio),
          // Precio pactado en la Nota de Pedido: no se recalcula al cambiar cliente/catálogo
          precioPactado: true,
          tipoAlicuota: matchedProd?.tipoAlicuota || 'GENERAL_16',
          aplicaIva: matchedProd?.aplicaIva !== false
        };
      });
      setCartItems(loadedCart);
    }

    setActiveOrderInPOS({
      ...orderToLoad,
      diasCredito: resolvedDays,
      fechaEmision: orderToLoad.fechaEmision || orderToLoad.fecha || new Date().toISOString(),
      fechaVencimiento:
        orderToLoad.fechaVencimiento ||
        calculateExpirationDate(orderToLoad.fechaEmision || orderToLoad.fecha || new Date(), resolvedDays).toISOString()
    });
    setShowOrdersDrawer(false);
    notify.success(`Nota de Pedido ${orderToLoad.numeroDoc || orderToLoad.id} cargada en Caja (Modo Solo Lectura: NO MODIFICABLE).`);
  };

  // Si se pasa un pedido desde el exterior (ej. Nota de Pedido o Flujo Comercial & Pedidos), cargarlo automáticamente
  useEffect(() => {
    if (pendingOrderToBill) {
      handleLoadOrderToCart(pendingOrderToBill);
      if (onClearPendingOrder) {
        onClearPendingOrder();
      }
    }
  }, [pendingOrderToBill]);

  const categories = [
    'TODOS',
    'Gasolina',
    'Semisintético R500',
    'Diesel 4T',
    'Motos 2T/4T',
    'Fuera de Borda',
    'Transmisiones & ATF',
    'Hidráulicos AW68'
  ];

  const getReadableUnit = (product) => {
    if (!product) return 'Caja';
    return resolveProductUnit(product, 'Caja');
  };

  // -------------------------------------------------------------------------
  // CÁLCULO DE DISPONIBILIDAD ATP (Available-To-Promise)
  // Fórmula: Disponibilidad = Stock Físico Almacén - Comprometido Vigente - En Carrito
  // Política: Las órdenes de compra montadas por vendedores comprometen stock
  // temporalmente y caducan a las 72 horas de su emisión.
  // El stock real de almacén no se debita hasta que se emite la factura formal.
  // -------------------------------------------------------------------------
  const committedStockMap = useMemo(() => {
    const map = {};
    const now = Date.now();
    const HOURS_72_MS = 72 * 60 * 60 * 1000;

    if (!Array.isArray(orders)) return map;

    orders.forEach((order) => {
      if (!order) return;
      const st = (order.status || '').toUpperCase();
      // Órdenes activas en pipeline que comprometen stock (no facturadas ni anuladas)
      if (st !== 'PENDIENTE' && st !== 'APROBADO' && st !== 'EN_PROCESO' && st !== 'RETENIDO_CREDITO') return;

      // Verificar tiempo de emisión (caduca a las 72 horas)
      const rawDate = order.fechaEmision || order.fecha || order.created_at;
      if (rawDate) {
        const orderTime = new Date(rawDate).getTime();
        if (!isNaN(orderTime) && (now - orderTime) > HOURS_72_MS) {
          return;
        }
      }

      const items = order.items || order.renglones || [];
      if (Array.isArray(items)) {
        items.forEach((it) => {
          const key = it.articuloId || it.id || it.co_art || it.codigo;
          const qty = Number(it.cantidad || it.qty || 0);
          if (key && qty > 0) {
            map[key] = (map[key] || 0) + qty;
          }
        });
      }
    });

    return map;
  }, [orders]);

  // Helper para consultar el stock comprometido vigente de un producto
  const getProductCommittedQty = (product) => {
    if (!product) return 0;
    const byId = committedStockMap[product.id] || 0;
    const byCoArt = product.co_art ? (committedStockMap[product.co_art] || 0) : 0;
    const byCodigo = product.codigo ? (committedStockMap[product.codigo] || 0) : 0;
    if (product.co_art && product.co_art === product.id) return byId;
    return byId + byCoArt + byCodigo;
  };

  const addToCart = (product) => {
    if (isOrderLocked) {
      notify.warning(
        `🔒 RESTRICCIÓN DE CAJA: La Nota de Pedido ${activeOrderInPOS?.numeroDoc || ''} está bloqueada (NO MODIFICAR). No se permite agregar artículos.`
      );
      return;
    }
    const wStocks = getProductWarehouseStocks(product);
    const rawStock = Number(tipoDoc === 'NOTA_ENTREGA' ? wStocks.stock02 : wStocks.stock01);
    const committedQty = getProductCommittedQty(product);
    const maxAvailable = Math.max(0, rawStock - committedQty);
    const existingIndex = cartItems.findIndex(item => item.articuloId === product.id);

    if (existingIndex >= 0) {
      const current = cartItems[existingIndex];
      if (current.cantidad < maxAvailable) {
        const newQty = current.cantidad + 1;
        const unitLts = Number(current.litrosPorUnidad) > 0 ? Number(current.litrosPorUnidad) : resolveProductLitersPerUnit(product);
        setCartItems(cartItems.map((item, idx) => idx === existingIndex
          ? { ...item, cantidad: newQty, subtotalUsd: lineSubtotal(newQty, item.precioUsd), litros: newQty * unitLts }
          : item
        ));
      } else {
        const whLabel = tipoDoc === 'NOTA_ENTREGA' ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturas Fiscales)';
        if (committedQty > 0) {
          notify.warning(`Disponibilidad libre alcanzada en ${whLabel} (${maxAvailable} un. disponibles. Físico: ${rawStock}, Comprometido en O.C.: ${committedQty} con reserva 72h)`);
        } else {
          notify.warning(`Stock máximo alcanzado en ${whLabel} (${rawStock} unidades disponibles para este producto)`);
        }
      }
    } else {
      if (maxAvailable <= 0) {
        const whLabel = tipoDoc === 'NOTA_ENTREGA' ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturas Fiscales)';
        if (committedQty > 0) {
          notify.warning(`Este lubricante tiene existencia física (${rawStock} un. en ${whLabel}) pero está totalmente comprometido en órdenes de preventa activas (reserva 72 horas).`);
        } else {
          notify.warning(`Este lubricante no tiene existencia disponible en ${whLabel} actualmente.`);
        }
        return;
      }
      const channel = modalidadVenta === 'OFICINA' ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.MOSTRADOR;
      const precioUsd = resolveUnitPrice(product, selectedClient, channel);
      if (!(precioUsd > 0)) {
        notify.warning(`El producto ${product.codigo || ''} no tiene precio de venta configurado en Inventario.`);
        return;
      }
      const unitLts = resolveProductLitersPerUnit(product);
      setCartItems([
        ...cartItems,
        {
          articuloId: product.id,
          codigo: product.codigo,
          oem: product.oem,
          descripcion: product.descripcion,
          viscosidad: product.viscosidad,
          unidad: resolveProductUnit(product, 'Caja'),
          litrosPorUnidad: unitLts,
          litros: unitLts,
          cantidad: 1,
          precioUsd: precioUsd,
          subtotalUsd: lineSubtotal(1, precioUsd),
          precioPactado: false,
          tipoAlicuota: product.tipoAlicuota || (product.aplicaIva === false ? 'EXENTO_0' : 'GENERAL_16'),
          aplicaIva: product.aplicaIva !== false
        }
      ]);
    }
  };

  // Sincronización automática de precios del carrito:
  // si cambia el cliente (Mayorista ↔ Detal) o se actualiza el precio en Inventario,
  // los renglones del carrito se recalculan con el precio oficial vigente.
  // Los renglones cargados desde una Nota de Pedido conservan su precio pactado.
  useEffect(() => {
    setCartItems(prev => {
      let changed = false;
      const channel = modalidadVenta === 'OFICINA' ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.MOSTRADOR;
      const next = prev.map(item => {
        if (item.precioPactado) return item;
        const prod = products.find(p => p.id === item.articuloId);
        if (!prod) return item;
        const precio = resolveUnitPrice(prod, selectedClient, channel);
        if (!(precio > 0) || precio === item.precioUsd) return item;
        changed = true;
        return { ...item, precioUsd: precio, subtotalUsd: lineSubtotal(item.cantidad, precio) };
      });
      return changed ? next : prev;
    });
  }, [products, selectedClient, modalidadVenta]);

  const updateQuantity = (articuloId, newQty) => {
    if (isOrderLocked) {
      notify.warning('🔒 RESTRICCIÓN DE CAJA: No se permite modificar las cantidades de una Nota de Pedido enviada a caja.');
      return;
    }
    if (newQty <= 0) {
      setCartItems(cartItems.filter(item => item.articuloId !== articuloId));
      return;
    }
    const product = products.find(p => p.id === articuloId);
    const wStocks = product ? getProductWarehouseStocks(product) : { stock01: 0, stock02: 0, total: 0 };
    const rawStock = Number(tipoDoc === 'NOTA_ENTREGA' ? wStocks.stock02 : wStocks.stock01);
    const committedQty = getProductCommittedQty(product);
    const maxAvailable = Math.max(0, rawStock - committedQty);

    if (product && newQty > maxAvailable) {
      const whLabel = tipoDoc === 'NOTA_ENTREGA' ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturas Fiscales)';
      notify.warning(`Supera la disponibilidad para venta libre en ${whLabel} (${maxAvailable} un. Físico: ${rawStock}, Comprometido en O.C.: ${committedQty} con reserva 72h)`);
      return;
    }
    setCartItems(cartItems.map(item => {
      if (item.articuloId === articuloId) {
        const unitLts = Number(item.litrosPorUnidad) > 0
          ? Number(item.litrosPorUnidad)
          : (product ? resolveProductLitersPerUnit(product) : 11.35);
        return {
          ...item,
          cantidad: newQty,
          subtotalUsd: lineSubtotal(newQty, item.precioUsd),
          litros: newQty * unitLts
        };
      }
      return item;
    }));
  };

  const removeItem = (articuloId) => {
    if (isOrderLocked) {
      notify.warning('🔒 RESTRICCIÓN DE CAJA: No se permite eliminar renglones de una Nota de Pedido enviada a caja.');
      return;
    }
    setCartItems(cartItems.filter(item => item.articuloId !== articuloId));
  };

  const totalLitrosCarrito = cartItems.reduce((acc, item) => acc + (item.litros || 0), 0);

  const tasaBcv = Number(safeConfig.tasaDolar) || 827.73;

  // Motor Fiscal SENIAT (En Notas de Entrega NO aplica IVA: 0%)
  const fiscalTaxes = calculateFiscalTaxes({
    items: cartItems,
    tipoDoc,
    metodoPago,
    condicionPago,
    tasaBcv,
    porcentajeRetencionIva: selectedClient?.porcentajeRetencionIva || (selectedClient?.agenteRetencionIva ? 75 : 0)
  });

  const subtotalUsd = fiscalTaxes.subtotalNetoUsd;
  const ivaUsd = fiscalTaxes.totalIvaUsd;
  const igtfUsd = fiscalTaxes.igtfUsd;
  const totalUsd = fiscalTaxes.totalFacturaUsd;
  const totalBs = fiscalTaxes.totalFacturaBs;
  const subtotalBs = fiscalTaxes.subtotalNetoBs;
  const ivaBs = fiscalTaxes.totalIvaBs;
  const igtfBs = fiscalTaxes.igtfBs;

  // -------------------------------------------------------------------------
  // CÁLCULO DE FECHA DE EMISIÓN Y FECHA DE VENCIMIENTO
  // Regla solicitada: Fecha de Vencimiento = Fecha de Emisión + Cantidad de días de Crédito
  // -------------------------------------------------------------------------
  const diasCreditoActual = useMemo(() => {
    if (condicionPago === 'CONTADO') return 0;
    if (activeOrderInPOS) {
      return resolveCreditDaysFromTerm(
        activeOrderInPOS.condicionPago,
        selectedClient?.diasCredito ?? 15,
        activeOrderInPOS.diasCredito
      );
    }
    return resolveCreditDaysFromTerm(creditTerm, selectedClient?.diasCredito ?? 15);
  }, [condicionPago, activeOrderInPOS, creditTerm, selectedClient]);

  const fechaEmisionActual = useMemo(() => {
    if (activeOrderInPOS?.fechaEmision || activeOrderInPOS?.fecha) {
      const parsed = new Date(activeOrderInPOS.fechaEmision || activeOrderInPOS.fecha);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [activeOrderInPOS]);

  const fechaVencimientoActual = useMemo(
    () => calculateExpirationDate(fechaEmisionActual, diasCreditoActual),
    [fechaEmisionActual, diasCreditoActual]
  );

  // -------------------------------------------------------------------------
  // EVALUACIÓN DE NORMAS DE CRÉDITO COMERCIAL EN POS MOSTRADOR Y OFICINA
  // -------------------------------------------------------------------------
  const clientCreditEvaluation = useMemo(
    () =>
      evaluateClientCreditPolicy({
        client: selectedClient,
        profitInvoices,
        sales,
        tasaBcv,
        montoOrdenUsd: totalUsd
      }),
    [selectedClient, profitInvoices, sales, tasaBcv, totalUsd]
  );

  const isTermRequiresMandatoryApproval = condicionPago === 'CREDITO' && creditTerm === '30_DIAS';

  const effectiveIsAprobado =
    creditOverrideApproved ||
    Boolean(activeOrderInPOS && activeOrderInPOS.status === 'APROBADO') ||
    (Boolean(clientCreditEvaluation.isAprobado) && !isTermRequiresMandatoryApproval);

  const effectiveStatusLabel = creditOverrideApproved
    ? 'APROBADO (AUTORIZADO)'
    : activeOrderInPOS && activeOrderInPOS.status === 'APROBADO'
    ? 'APROBADO (PEDIDO VALIDADO)'
    : isTermRequiresMandatoryApproval
    ? 'NEGADO (REQUIERE APROBACIÓN 30D)'
    : clientCreditEvaluation.statusLabel;

  const isCreditNegado = Boolean(
    condicionPago === 'CREDITO' && (!clientCreditEvaluation?.evaluado || !effectiveIsAprobado)
  );

  const effectiveMotivo = creditOverrideApproved
    ? `Autorización Excepcional Otorgada por: ${creditOverrideAuthorizer}. Justificación: ${creditOverrideJustification || 'Autorizado por Gerencia'}.`
    : activeOrderInPOS && activeOrderInPOS.status === 'APROBADO'
    ? `Crédito validado en origen para la Nota de Pedido ${activeOrderInPOS.numeroDoc || activeOrderInPOS.id}.${activeOrderInPOS.creditOverrideAuthorizer ? ` Autorizado por: ${activeOrderInPOS.creditOverrideAuthorizer}.` : ''}`
    : isTermRequiresMandatoryApproval
    ? !clientCreditEvaluation.isAprobado
      ? `${clientCreditEvaluation.motivo} Además, el plazo a 30 Días siempre requiere aprobación obligatoria de Gerencia.`
      : 'Política Comercial Estricta: Todo crédito a 30 Días requiere obligatoriamente solicitar y obtener aprobación de Gerencia.'
    : clientCreditEvaluation.motivo;

  const handleFinalizeSale = async () => {
    if (cartItems.length === 0) {
      notify.warning('El carrito de facturación está vacío. Agregue lubricantes para continuar.');
      return;
    }

    if ((tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') && !documentoAfectado.trim()) {
      notify.warning('Según la Providencia SENIAT SNAT/2011/00071, para emitir una Nota de Crédito o Débito es obligatorio ingresar el Número de Factura Afectada.');
      return;
    }

    if (condicionPago === 'CREDITO' && isCreditNegado) {
      notify.error(
        `Operación a Crédito Retenida por Normas de Crédito: ${effectiveMotivo} Solicite aprobación excepcional para facturar.`
      );
      setShowCreditApprovalModal(true);
      return;
    }

    const resolvedVendedor = activeOrderInPOS
      ? (activeOrderInPOS.vendedorId || currentUser?.nombre || 'Ricardo Sánchez')
      : modalidadVenta === 'OFICINA'
      ? (officeSeller || currentUser?.nombre || 'Oficina Principal Motorven')
      : (currentUser?.nombre || 'Ricardo Sánchez');

    const resolvedNextCorrelativo = (tipoDoc === 'FACTURA' || !tipoDoc)
      ? getNextInvoiceCorrelativo(sales)
      : undefined;
    if (resolvedNextCorrelativo) {
      commitInvoiceCorrelativo(resolvedNextCorrelativo);
    }

    const salePayload = {
      tipoDoc,
      numeroDoc: resolvedNextCorrelativo,
      numeroControl: resolvedNextCorrelativo ? generateFiscalControlNumber(parseInt(resolvedNextCorrelativo, 10) + 1) : undefined,
      documentoAfectado: (tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') ? documentoAfectado.trim() : '',
      pedidoOrigenId: activeOrderInPOS?.id || null,
      pedidoOrigenDoc: activeOrderInPOS?.numeroDoc || activeOrderInPOS?.id || null,
      modalidadVenta: activeOrderInPOS?.modalidadVenta || modalidadVenta,
      clienteId: selectedClient?.id || 'CLI-003',
      clienteNombre: selectedClient?.nombre || selectedClient?.razonSocial || 'CLIENTE CONTADO / MOSTRADOR OILSTONE',
      clienteRif: selectedClient?.rif || 'V-18456789-6',
      condicionPago: condicionPago === 'CREDITO' ? creditTerm : 'CONTADO',
      diasCredito: diasCreditoActual,
      fechaEmision: fechaEmisionActual.toISOString(),
      fechaVencimiento: fechaVencimientoActual.toISOString(),
      metodoPago: condicionPago === 'CREDITO' ? 'CREDITO' : metodoPago,
      creditOverrideApproved,
      creditOverrideAuthorizer: creditOverrideApproved ? creditOverrideAuthorizer : (activeOrderInPOS?.creditOverrideAuthorizer || null),
      creditOverrideJustification: creditOverrideApproved ? creditOverrideJustification : (activeOrderInPOS?.creditOverrideJustification || null),
      items: cartItems,
      subtotalUsd,
      baseExentaUsd: fiscalTaxes.baseExentaUsd,
      baseGeneralUsd: fiscalTaxes.baseGeneralUsd,
      ivaGeneralUsd: fiscalTaxes.ivaGeneralUsd,
      baseReducidaUsd: fiscalTaxes.baseReducidaUsd,
      ivaReducidaUsd: fiscalTaxes.ivaReducidoUsd,
      baseAdicionalUsd: fiscalTaxes.baseAdicionalUsd,
      ivaAdicionalUsd: fiscalTaxes.ivaAdicionalUsd,
      ivaUsd,
      igtfUsd,
      totalUsd,
      subtotalBs,
      baseExentaBs: fiscalTaxes.baseExentaBs,
      baseGeneralBs: fiscalTaxes.baseGeneralBs,
      ivaGeneralBs: fiscalTaxes.ivaGeneralBs,
      baseReducidaBs: fiscalTaxes.baseReducidaBs,
      ivaReducidaBs: fiscalTaxes.ivaReducidoBs,
      baseAdicionalBs: fiscalTaxes.baseAdicionalBs,
      ivaAdicionalBs: fiscalTaxes.ivaAdicionalBs,
      ivaBs,
      igtfBs,
      totalBs,
      retencionIvaBs: fiscalTaxes.retencionIvaBs,
      vendedor: resolvedVendedor
    };

    try {
      const createdSale = await onProcessSale(salePayload);
      if (createdSale) {
        notify.success("FACTURA REALIZADA CON EXITO");
        setLastSaleDoc({
          ...createdSale,
          numeroDoc: createdSale.numeroDoc || resolvedNextCorrelativo,
          pedidoOrigenDoc: activeOrderInPOS?.numeroDoc || activeOrderInPOS?.id || null,
          modalidadVenta: salePayload.modalidadVenta,
          diasCredito: diasCreditoActual,
          fechaEmision: salePayload.fechaEmision,
          fechaVencimiento: salePayload.fechaVencimiento,
          totalLitros: totalLitrosCarrito,
          transportista: activeOrderInPOS?.transporteId || activeOrderInPOS?.chofer || 'Transporte Motorven',
          zonaDespacho: activeOrderInPOS?.zonaVenta || '01 - Valencia'
        });
        setActiveOrderInPOS(null);
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error("Error al procesar la venta:", err);
      notify.error("Error al emitir la factura en el sistema: " + (err.message || err));
    }
  };

  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      p.codigo.toLowerCase().includes(query) ||
      p.oem.toLowerCase().includes(query) ||
      p.descripcion.toLowerCase().includes(query) ||
      (p.viscosidad && p.viscosidad.toLowerCase().includes(query));

    const matchesCat = selectedCategory === 'TODOS' || p.categoria === selectedCategory;
    return matchesQuery && matchesCat;
  });

  const availableCount = filteredProducts.filter(p => {
    const wStocks = getProductWarehouseStocks(p);
    const rawStock = tipoDoc === 'NOTA_ENTREGA' ? wStocks.stock02 : wStocks.stock01;
    const committed = getProductCommittedQty(p);
    return (rawStock - committed) > 0;
  }).length;
  const outOfStockCount = filteredProducts.length - availableCount;

  // Filtrado de la bandeja de órdenes de preventa para la cajera
  const filteredDrawerOrders = useMemo(() => {
    if (!ordersDrawerSearch.trim()) return pendingSellerOrders;
    const q = ordersDrawerSearch.toLowerCase().trim();
    return pendingSellerOrders.filter(
      (o) =>
        (o.numeroDoc && o.numeroDoc.toLowerCase().includes(q)) ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.clienteNombre && o.clienteNombre.toLowerCase().includes(q)) ||
        (o.clienteRif && o.clienteRif.toLowerCase().includes(q)) ||
        (o.vendedorId && o.vendedorId.toLowerCase().includes(q))
    );
  }, [pendingSellerOrders, ordersDrawerSearch]);

  return (
    <div>
      {/* Selector de Tipo de Documento */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplet size={28} color="var(--neon-cyan)" /> Terminal Punto de Venta OILSTONE ®
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '3px' }}>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              Venta visual de lubricantes con imágenes de catálogo en fondo blanco y fichas técnicas
            </p>
            {currentUser && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
                fontSize: '0.78rem'
              }}>
                {currentUser.foto ? (
                  <img
                    src={currentUser.foto}
                    alt={currentUser.nombre}
                    style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--neon-cyan)' }}
                  />
                ) : (
                  <span style={{ fontSize: '1rem' }}>{currentUser.avatar || '👨‍💼'}</span>
                )}
                <span style={{ color: 'var(--text-muted)' }}>Cajero:</span>
                <strong style={{ color: 'var(--neon-cyan, #38bdf8)' }}>{currentUser.nombre}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowOrdersDrawer(true)}
              className="btn btn-sm"
              style={{
                background: pendingSellerOrders.length > 0
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(220, 38, 38, 0.35))'
                  : 'rgba(255, 255, 255, 0.05)',
                border: pendingSellerOrders.length > 0 ? '1.5px solid var(--motorven-gold)' : '1px solid var(--border-glass)',
                color: pendingSellerOrders.length > 0 ? '#fbbf24' : 'var(--text-muted)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 14px',
                borderRadius: '10px',
                boxShadow: pendingSellerOrders.length > 0 ? '0 0 12px rgba(245, 158, 11, 0.25)' : 'none'
              }}
              title="Abrir la bandeja de pedidos levantados por vendedores en calle pendientes por facturar en caja"
            >
              <FileText size={15} color={pendingSellerOrders.length > 0 ? '#fbbf24' : 'var(--text-muted)'} />
              <span>📥 Pedidos de Vendedores</span>
              <span style={{
                background: pendingSellerOrders.length > 0 ? 'var(--motorven-red)' : 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                fontSize: '0.72rem',
                padding: '1px 7px',
                borderRadius: '12px',
                fontWeight: 900
              }}>
                {pendingSellerOrders.length}
              </span>
            </button>

            {onOpenOrdersSalesModal && (
              <button
                type="button"
                onClick={() => onOpenOrdersSalesModal('pipeline')}
                className="btn btn-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2), rgba(0, 43, 122, 0.35))',
                  border: '1px solid var(--motorven-red)',
                  color: '#ff8080',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '10px'
                }}
                title="Cargar y facturar pedidos desde el Pipeline de Preventas"
              >
                <Truck size={15} color="var(--motorven-red)" /> Cargar Pedido / Preventa
              </button>
            )}

            <button
              onClick={() => setShowCreditScoreModal(true)}
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(0, 43, 122, 0.35))',
                border: '1px solid rgba(2, 132, 199, 0.5)',
                color: '#38bdf8',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '10px'
              }}
              title="Evaluar Score Crediticio y Validar Cupo Pre-Despacho"
            >
              <ShieldCheck size={15} color="#38bdf8" /> Score Crédito & Riesgo
            </button>

            <button
              onClick={() => setShowReturnsModal(true)}
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(0, 43, 122, 0.25))',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '10px'
              }}
              title="Ver Devoluciones, Garantías y Notas de Crédito de Clientes sincronizadas desde Supabase"
            >
              ↩️ Devoluciones {profitReturns.length > 0 && `(${profitReturns.length})`}
            </button>

            <div style={{ display: 'flex', background: 'var(--bg-industrial)', padding: '4px', borderRadius: '14px', border: '1px solid var(--border-glass)', flexWrap: 'wrap', gap: '2px', alignItems: 'center' }}>
              {['FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'NOTA_ENTREGA', 'COTIZACION'].map((tipo) => (
                <button
                  key={tipo}
                  className="btn btn-sm"
                  onClick={() => {
                    setTipoDoc(tipo);
                    if (!isOrderLocked) {
                      if (tipo === 'NOTA_ENTREGA') setModalidadVenta('OFICINA');
                      else if (tipo === 'FACTURA') setModalidadVenta('MOSTRADOR');
                    }
                  }}
                  style={{
                    background: tipoDoc === tipo ? 'var(--motorven-red)' : 'transparent',
                    color: tipoDoc === tipo ? '#fff' : '#94a3b8',
                    fontWeight: tipoDoc === tipo ? 800 : 500
                  }}
                >
                  {tipo.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Indicador de Almacén Activo según Tipo de Documento */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '12px',
                background: tipoDoc === 'NOTA_ENTREGA' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                border: tipoDoc === 'NOTA_ENTREGA' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(56, 189, 248, 0.35)',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: tipoDoc === 'NOTA_ENTREGA' ? 'var(--motorven-emerald)' : '#38bdf8'
              }}
              title={tipoDoc === 'NOTA_ENTREGA' ? 'Las Notas de Entrega se descuentan del Almacén 02 (Bóveda / Central)' : 'Las Facturas Fiscales se descuentan del Almacén 01 (Principal / Mostrador)'}
            >
              <Warehouse size={13} />
              {tipoDoc === 'NOTA_ENTREGA'
                ? '02: Almacén Central (Notas de Entrega)'
                : '01: Almacén Principal (Facturación Fiscal)'}
            </div>

            {/* BOTÓN IMPRIMIR REPORTE */}
            <button
              type="button"
              onClick={() => generateSalesPOSPDF({ sales: profitInvoices && profitInvoices.length > 0 ? profitInvoices : [], config, currentUser, tipoDoc })}
              className="btn btn-print-report"
              style={{ marginLeft: 'auto' }}
              title="Descargar Reporte Oficial de Ventas y Facturación en PDF"
            >
              <Printer size={15} color="#ffffff" /> Imprimir Reporte
            </button>
          </div>

          {(tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid var(--motorven-red)', padding: '6px 12px', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--motorven-red)' }}>
                Factura Afectada (SENIAT):
              </span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Ej: FACT-001042"
                value={documentoAfectado}
                onChange={(e) => setDocumentoAfectado(e.target.value.toUpperCase())}
                style={{ width: '140px', padding: '2px 8px', fontSize: '0.8rem', borderColor: 'var(--motorven-red)' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Barra de Filtros de Categorías por Tipo de Lubricante */}
      <div className="horizontal-scroll-pills">
        {categories.map((cat) => (
          <button
            key={cat}
            className="btn btn-sm"
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? 'linear-gradient(135deg, var(--motorven-navy), #00205b)' : 'rgba(255,255,255,0.04)',
              color: selectedCategory === cat ? '#fff' : '#94a3b8',
              border: selectedCategory === cat ? '1px solid var(--neon-cyan)' : '1px solid var(--border-glass)',
              whiteSpace: 'nowrap'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* GRID PRINCIPAL POS: Catálogo Visual (Izquierda) + Terminal Cobro (Derecha) */}
      <div className="pos-grid-layout">
        
        {/* LADO IZQUIERDO: Catálogo Visual de Tarjetas OILSTONE con Imagen Oficial */}
        <div className="pos-catalog-col">
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Buscar por Viscosidad (15W-40, 20W-50), R500, Dexron, Moto o Código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* KPI Rápido de Disponibilidad de Catálogo */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span
                className="badge"
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '8px'
                }}
                title="Cantidad de productos con stock inmediato disponible"
              >
                <Package size={14} /> {availableCount} Disponibles
              </span>
              {outOfStockCount > 0 && (
                <span
                  className="badge"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    borderRadius: '8px'
                  }}
                  title="Cantidad de productos agotados o sin existencia"
                >
                  <AlertTriangle size={14} /> {outOfStockCount} Agotados
                </span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(205px, 1fr))', gap: '0.85rem' }}>
              {filteredProducts.map((p) => {
                const wStocks = getProductWarehouseStocks(p);
                const rawStock = Number(tipoDoc === 'NOTA_ENTREGA' ? wStocks.stock02 : wStocks.stock01);
                const committedQty = getProductCommittedQty(p);
                const stockMin = Number(p.stockMinimo ?? p.stock_minimo ?? 10);
                const cartItem = cartItems.find(item => item.articuloId === p.id);
                const inCartQty = cartItem?.cantidad || 0;
                const maxAvailable = Math.max(0, rawStock - committedQty);
                const disponibleReal = Math.max(0, maxAvailable - inCartQty);
                const isOutOfStock = maxAvailable <= 0;
                const isLowStock = !isOutOfStock && maxAvailable <= stockMin;
                const unitLabel = getReadableUnit(p);

                const posChannel = modalidadVenta === 'OFICINA' ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.MOSTRADOR;
                const precioUsd = resolveUnitPrice(p, selectedClient, posChannel);

                const stockConfig = isOutOfStock
                  ? { label: committedQty > 0 ? 'Comprometido' : 'Agotado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', dot: '#ef4444' }
                  : isLowStock
                  ? { label: 'Stock Crítico', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)', dot: '#f59e0b' }
                  : { label: 'Disponible', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', dot: '#10b981' };

                return (
                  <div
                    key={p.id}
                    className="bento-card"
                    style={{
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: isOutOfStock ? '1px solid rgba(255,23,68,0.35)' : '1px solid var(--border-glass)',
                      opacity: isOutOfStock ? 0.72 : 1,
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      minWidth: 0
                    }}
                  >
                    <div>
                      {/* Imagen Vectorial Oficial del Catálogo - Limpia, sin datos sobrepuestos */}
                      <div 
                        style={{
                          height: '130px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          marginBottom: '0.65rem',
                          position: 'relative',
                          background: '#ffffff',
                          border: '1px solid rgba(0,0,0,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedSpecProduct(p)}
                        title="Clic para ver Ficha Técnica ASTM y especificaciones de calidad"
                      >
                        <OilstoneProductImage product={p} productId={p.id} imagen={p.imagen} />

                        <button
                          type="button"
                          style={{ position: 'absolute', top: '7px', right: '7px', background: 'rgba(0,43,122,0.88)', border: 'none', color: '#fff', borderRadius: '50%', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedSpecProduct(p); }}
                          title="Ver Ficha Técnica ASTM"
                        >
                          <Info size={12} />
                        </button>
                      </div>

                      {/* Metadatos Superiores: Norma y Presentación */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                          {p.normaApi || 'API SL / CI-4'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {unitLabel}
                        </span>
                      </div>

                      {/* Nombre / Descripción del Producto con altura coherente */}
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          color: 'var(--text-heading)',
                          marginBottom: '6px',
                          lineHeight: 1.25,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: '2.15em'
                        }}
                        title={p.descripcion}
                      >
                        {p.descripcion}
                      </div>

                      {/* KPI UNIFICADO DE DISPONIBILIDAD & INVENTARIO */}
                      <div
                        style={{
                          marginTop: '0.35rem',
                          padding: '6px 8px',
                          borderRadius: '10px',
                          background: stockConfig.bg,
                          border: `1px solid ${stockConfig.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        {/* 1. Nivel Superior: Estado Semáforo + Disponibilidad Neta */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 6px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: stockConfig.dot,
                                boxShadow: `0 0 6px ${stockConfig.dot}`,
                                flexShrink: 0
                              }}
                            />
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: stockConfig.color, textTransform: 'uppercase', letterSpacing: '0.2px', whiteSpace: 'nowrap' }}>
                              {stockConfig.label}
                            </span>
                          </div>

                          <div style={{ textAlign: 'right', display: 'inline-flex', alignItems: 'baseline', gap: '4px', flexShrink: 0, marginLeft: 'auto' }}>
                            <strong style={{ fontSize: '0.8rem', color: isOutOfStock ? '#ef4444' : 'var(--text-main, #f8fafc)', fontFamily: 'var(--font-code)' }}>
                              {disponibleReal} {unitLabel}
                            </strong>
                            {p.litrosPorUnidad > 0 && disponibleReal > 0 && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--neon-cyan, #38bdf8)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                                ({(disponibleReal * p.litrosPorUnidad).toLocaleString('es-VE', { maximumFractionDigits: 0 })} L)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Nivel Inferior: Desglose Inteligente (Físico Alm 01/02 vs Comprometido vs En Carrito) */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '4px',
                            borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                            paddingTop: '4px',
                            fontSize: '0.64rem'
                          }}
                        >
                          <span
                            style={{
                              color: tipoDoc === 'NOTA_ENTREGA' ? '#38bdf8' : '#34d399',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 700
                            }}
                            title={`Existencia física en ${tipoDoc === 'NOTA_ENTREGA' ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturas Fiscales)'}`}
                          >
                            <Building2 size={10} /> {tipoDoc === 'NOTA_ENTREGA' ? 'Alm 02' : 'Alm 01'}: <strong style={{ color: 'var(--text-main)', marginLeft: '1px' }}>{rawStock}</strong>
                          </span>

                          {committedQty > 0 && (
                            <span
                              style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
                              title="Órdenes de preventa vigentes. Caducan y se liberan automáticamente a las 72 horas de su emisión"
                            >
                              <Clock size={10} /> O.C.: <strong>{committedQty}</strong>
                            </span>
                          )}

                          {inCartQty > 0 && (
                            <span
                              style={{ color: 'var(--neon-cyan, #38bdf8)', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}
                              title="Unidades en el carrito de venta actual"
                            >
                              <ShoppingCart size={10} /> Carrito: <strong>{inCartQty}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer: Precio Bimoneda y Botón de Acción Flexible */}
                    <div style={{ marginTop: '0.65rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.02rem', fontWeight: 900, color: 'var(--motorven-emerald)', lineHeight: 1.1 }}>
                          {formatUsd(precioUsd)}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--motorven-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatBs(precioUsd * config.tasaDolar)}
                        </div>
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => addToCart(p)}
                        disabled={disponibleReal <= 0 || isOrderLocked}
                        title={
                          isOrderLocked
                            ? 'Bloqueado: Pedido enviado a caja en modo NO MODIFICAR'
                            : undefined
                        }
                        style={{
                          opacity: disponibleReal <= 0 || isOrderLocked ? 0.5 : 1,
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          padding: '5px 10px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginLeft: 'auto',
                          cursor: disponibleReal <= 0 || isOrderLocked ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isOrderLocked ? (
                          <>
                            <Lock size={12} /> Orden en Caja
                          </>
                        ) : (
                          <>
                            <Plus size={14} />{' '}
                            {isOutOfStock
                              ? committedQty > 0
                                ? 'En O.C.'
                                : 'Agotado'
                              : disponibleReal <= 0
                              ? 'Sin Cupo'
                              : 'Añadir'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* LADO DERECHO: Carrito & Totales Bimoneda */}
        <div className="card pos-cart-col">
          {/* Selector de Modalidad de Venta (Mostrador vs Venta por Oficina) cuando no hay un pedido bloqueado */}
          {!isOrderLocked && (
            <div style={{
              marginBottom: '0.55rem',
              padding: '6px 8px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              flexShrink: 0
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModalidadVenta('MOSTRADOR');
                    if (tipoDoc === 'NOTA_ENTREGA') setTipoDoc('FACTURA');
                  }}
                  className="btn btn-sm"
                  style={{
                    background: modalidadVenta === 'MOSTRADOR' ? 'linear-gradient(135deg, var(--motorven-navy), #00205b)' : 'transparent',
                    color: modalidadVenta === 'MOSTRADOR' ? '#fff' : 'var(--text-muted)',
                    border: modalidadVenta === 'MOSTRADOR' ? '1px solid var(--neon-cyan)' : '1px solid transparent',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <ShoppingCart size={12} /> POS Mostrador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalidadVenta('OFICINA');
                    setTipoDoc('NOTA_ENTREGA');
                  }}
                  className="btn btn-sm"
                  style={{
                    background: modalidadVenta === 'OFICINA' ? 'linear-gradient(135deg, #1e40af, #0284c7)' : 'transparent',
                    color: modalidadVenta === 'OFICINA' ? '#fff' : 'var(--text-muted)',
                    border: modalidadVenta === 'OFICINA' ? '1px solid #38bdf8' : '1px solid transparent',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <Building2 size={12} /> Venta por Oficina
                </button>
              </div>
              {modalidadVenta === 'OFICINA' && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.66rem', color: '#38bdf8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    🏢 Ejecutivo Oficina:
                  </span>
                  <select
                    className="form-control form-control-sm"
                    value={officeSeller}
                    onChange={(e) => setOfficeSeller(e.target.value)}
                    style={{ fontSize: '0.72rem', padding: '2px 6px', height: '26px', flex: 1 }}
                  >
                    <option value={currentUser?.nombre || 'Oficina Principal Motorven'}>
                      {currentUser?.nombre || 'Oficina Principal Motorven'} (Oficina)
                    </option>
                    <option value="Oficina Comercial Planta Motorven">Oficina Comercial Planta Motorven</option>
                    {(profitSellers || []).map((s, idx) => {
                      const val = s.venDes || s.ven_des || s.nombre || s.coVen || s.co_ven || `Vendedor ${idx + 1}`;
                      return (
                        <option key={s.id || s.coVen || idx} value={val}>
                          {val}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* FICHA DE PEDIDO ENVIADO A CAJA CON RESTRICCIÓN DE NO MODIFICAR Y DATOS REQUERIDOS */}
          {activeOrderInPOS && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(30, 58, 138, 0.28))',
              border: '1.5px solid var(--motorven-gold)',
              borderRadius: '10px',
              padding: '8px 10px',
              marginBottom: '0.6rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{
                    background: 'rgba(239, 68, 68, 0.22)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    whiteSpace: 'nowrap'
                  }}>
                    <Lock size={10} /> NO MODIFICAR
                  </span>
                  <div style={{ fontWeight: 900, fontSize: '0.78rem', color: 'var(--motorven-gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeOrderInPOS.numeroDoc || activeOrderInPOS.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveOrderInPOS(null);
                    setCartItems([]);
                    notify.info('Nota de Pedido desvinculada de la caja.');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.64rem', padding: '2px 7px', flexShrink: 0 }}
                  title="Desvincular orden de caja"
                >
                  ✕ Desvincular
                </button>
              </div>

              {/* Datos Requeridos del Pedido enviado a Caja */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px 8px',
                fontSize: '0.67rem',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '6px 8px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Cliente: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{activeOrderInPOS.clienteNombre || selectedClient?.nombre}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>RIF: </span>
                  <strong style={{ color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)' }}>{activeOrderInPOS.clienteRif || selectedClient?.rif}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Vendedor: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{activeOrderInPOS.vendedorId || 'Asesor Comercial'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Zona / Canal: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {activeOrderInPOS.zonaVenta || 'General'}{activeOrderInPOS.modalidadVenta === 'OFICINA' ? ' (Oficina)' : ''}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Condición: </span>
                  <strong style={{ color: condicionPago === 'CONTADO' ? '#34d399' : '#fbbf24' }}>
                    {condicionPago === 'CONTADO' ? 'CONTADO (0 Días)' : `CRÉDITO (${diasCreditoActual} Días)`}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Volumen: </span>
                  <strong style={{ color: 'var(--neon-cyan)' }}>
                    {Number(activeOrderInPOS.totalLitros || totalLitrosCarrito || 0).toFixed(2)} Lts ({cartItems.length} ítem{cartItems.length === 1 ? '' : 's'})
                  </strong>
                </div>
                {(activeOrderInPOS.direccionEntrega || selectedClient?.domicilioFiscal) && (
                  <div style={{ gridColumn: '1 / -1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Entrega: </span>
                    <strong style={{ color: '#cbd5e1' }}>{activeOrderInPOS.direccionEntrega || selectedClient?.domicilioFiscal}</strong>
                  </div>
                )}
                {activeOrderInPOS.observaciones && (
                  <div style={{ gridColumn: '1 / -1', color: '#fde68a', fontSize: '0.65rem' }}>
                    📝 {activeOrderInPOS.observaciones}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selector de Cliente con Validación Fiscal SENIAT */}
          <div style={{ paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.6rem', minWidth: 0, width: '100%', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: 0, fontSize: '0.72rem' }}>
                <UserCheck size={14} color="var(--neon-cyan)" /> Cliente Seleccionado
                {isOrderLocked && (
                  <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 800 }}>
                    (🔒 Bloqueado por Pedido)
                  </span>
                )}
              </label>
              {selectedClient && (
                <span style={{
                  fontSize: '0.64rem',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: validateRif(selectedClient.rif).isValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: validateRif(selectedClient.rif).isValid ? 'var(--motorven-emerald)' : 'var(--motorven-red)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  {validateRif(selectedClient.rif).isValid ? '✓ RIF SENIAT Válido' : '⚠ RIF Inválido'}
                </span>
              )}
            </div>
            {/* Buscador de clientes por palabras clave */}
            {!isOrderLocked && (
              <div style={{ position: 'relative', width: '100%', marginBottom: '5px' }}>
                <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar cliente por nombre, RIF, tipo o palabra clave..."
                  value={clientSearch}
                  disabled={isOrderLocked}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientSearch(value);
                    // Si hay una sola coincidencia, se selecciona automáticamente
                    const kws = normalizeText(value).split(/\s+/).filter(Boolean);
                    if (kws.length > 0) {
                      const matches = (clients || []).filter(c => {
                        const h = normalizeText([c.nombre, c.rif, c.tipoCliente, c.domicilioFiscal, c.ciudad, c.estado, c.telefono, c.email].join(' '));
                        return kws.every(k => h.includes(k));
                      });
                      if (matches.length === 1) setSelectedClient(matches[0]);
                    }
                  }}
                  style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem 1.8rem 0.4rem 1.8rem' }}
                />
                {clientSearch && (
                  <button
                    type="button"
                    onClick={() => setClientSearch('')}
                    title="Limpiar búsqueda"
                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
            {clientSearch && !isOrderLocked && (
              <div style={{ fontSize: '0.64rem', color: filteredSortedClients.length ? 'var(--neon-cyan)' : 'var(--motorven-red)', marginBottom: '4px' }}>
                {filteredSortedClients.length
                  ? `${filteredSortedClients.length} cliente(s) encontrado(s)`
                  : 'Sin coincidencias para la búsqueda'}
              </div>
            )}
            <select
              className="form-control"
              disabled={isOrderLocked}
              style={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                fontSize: '0.8rem',
                padding: '0.45rem 2rem 0.45rem 0.7rem',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                opacity: isOrderLocked ? 0.85 : 1,
                cursor: isOrderLocked ? 'not-allowed' : 'pointer'
              }}
              value={selectedClient?.id || ''}
              onChange={(e) => {
                if (isOrderLocked) return;
                const c = clients.find(cl => cl.id === e.target.value);
                if (c) setSelectedClient(c);
              }}
            >
              {!selectedClient && <option value="">-- Seleccione un Cliente --</option>}
              {selectedClient && !filteredSortedClients.some(c => c.id === selectedClient.id) && (
                <option key={selectedClient.id} value={selectedClient.id}>
                  {selectedClient.nombre || selectedClient.razonSocial} ({selectedClient.rif}) - [{selectedClient.tipoCliente}]
                </option>
              )}
              {filteredSortedClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.rif}) - [{c.tipoCliente}]
                </option>
              ))}
            </select>
            {selectedClient?.domicilioFiscal && (
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                📍 {selectedClient.domicilioFiscal}
              </div>
            )}
            {selectedClient?.agenteRetencionIva && (
              <div style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', marginTop: '2px' }}>
                🏛️ Agente Retención IVA ({selectedClient.porcentajeRetencionIva || 75}%)
              </div>
            )}

            {/* BLOQUE DE FECHA DE EMISIÓN Y FECHA DE VENCIMIENTO (= EMISIÓN + DÍAS DE CRÉDITO) */}
            <div style={{
              marginTop: '6px',
              padding: '6px 8px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Calendar size={10} color="var(--neon-cyan)" /> Fecha de Emisión
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
                  {formatDateVe(fechaEmisionActual)}
                </div>
              </div>

              <div style={{
                padding: '2px 7px',
                borderRadius: '10px',
                background: diasCreditoActual > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                border: `1px solid ${diasCreditoActual > 0 ? 'var(--motorven-gold)' : 'var(--motorven-emerald)'}`,
                color: diasCreditoActual > 0 ? '#fbbf24' : '#34d399',
                fontSize: '0.64rem',
                fontWeight: 800,
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                {diasCreditoActual > 0 ? `+${diasCreditoActual} Días Crédito` : '0 Días (Contado)'}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Fecha de Vencimiento
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 900, color: diasCreditoActual > 0 ? 'var(--motorven-gold)' : 'var(--neon-cyan)', fontFamily: 'var(--font-code)' }}>
                  {formatDateVe(fechaVencimientoActual)}
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Ítems en Carrito */}
          <div style={{ flex: '1 1 auto', maxHeight: '220px', minHeight: '64px', overflowY: 'auto', marginBottom: '0.65rem', borderBottom: '1px solid var(--border-glass)', minWidth: 0 }}>
            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '0.9rem 0.75rem', color: '#64748b' }}>
                <ShoppingCart size={28} style={{ marginBottom: '0.35rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: 1.3 }}>Seleccione lubricantes del catálogo para la orden.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '4px', paddingBottom: '0.45rem' }}>
                {cartItems.map(item => {
                  const itemProd = products.find(p => p && (p.id === item.articuloId || p.codigo === item.codigo || p.codigo === item.articuloId));
                  return (
                  <div key={item.articuloId} style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    minWidth: 0
                  }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(255,255,255,0.18)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      <OilstoneProductImage
                        product={itemProd}
                        productId={itemProd?.id || item.articuloId}
                        imagen={itemProd?.imagen || item.imagen}
                        codigo={itemProd?.codigo || item.codigo || item.articuloId}
                        descripcion={item.descripcion}
                        width="100%"
                        height="100%"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '2px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.descripcion}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--motorven-emerald)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatUsd(item.precioUsd)} x {item.cantidad} = <strong>{formatUsd(item.subtotalUsd)}</strong> ({item.litros.toFixed(1)} L)
                      </div>
                    </div>
                    
                    {isOrderLocked ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: 'rgba(245, 158, 11, 0.14)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#fbbf24',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                        title="Cantidad bloqueada por Nota de Pedido en Caja (NO MODIFICAR)"
                      >
                        <Lock size={11} /> Cant: {item.cantidad}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '2px 7px', minHeight: '26px' }} onClick={() => updateQuantity(item.articuloId, item.cantidad - 1)}>-</button>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>{item.cantidad}</span>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '2px 7px', minHeight: '26px' }} onClick={() => updateQuantity(item.articuloId, item.cantidad + 1)}>+</button>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '4px', minHeight: '26px', color: 'var(--motorven-red)', marginLeft: '2px' }} onClick={() => removeItem(item.articuloId)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formas de Pago y Normas de Crédito */}
          <div style={{ marginBottom: '0.65rem', minWidth: 0, width: '100%', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.45rem' }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={isOrderLocked}
                onClick={() => {
                  if (isOrderLocked) return;
                  setCondicionPago('CONTADO');
                }}
                style={{
                  background: condicionPago === 'CONTADO' ? 'var(--motorven-emerald)' : 'var(--bg-btn-secondary)',
                  color: condicionPago === 'CONTADO' ? '#fff' : 'var(--text-primary)',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.76rem',
                  opacity: isOrderLocked && condicionPago !== 'CONTADO' ? 0.5 : 1,
                  cursor: isOrderLocked ? 'not-allowed' : 'pointer'
                }}
              >
                Pago Contado
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={isOrderLocked}
                onClick={() => {
                  if (isOrderLocked) return;
                  setCondicionPago('CREDITO');
                }}
                style={{
                  background: condicionPago === 'CREDITO' ? 'var(--motorven-gold)' : 'var(--bg-btn-secondary)',
                  color: condicionPago === 'CREDITO' ? '#fff' : 'var(--text-primary)',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.76rem',
                  opacity: isOrderLocked && condicionPago !== 'CREDITO' ? 0.5 : 1,
                  cursor: isOrderLocked ? 'not-allowed' : 'pointer'
                }}
              >
                Venta Crédito
              </button>
            </div>

            {condicionPago === 'CONTADO' && (
              <select
                className="form-control"
                style={{ width: '100%', maxWidth: '100%', minWidth: 0, fontSize: '0.78rem', padding: '0.42rem 2rem 0.42rem 0.7rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
              >
                <option value="EFECTIVO_USD">💵 Efectivo Divisas (USD) [+3% IGTF]</option>
                <option value="PAGO_MOVIL">📲 Pago Móvil (Bs. Oficial)</option>
                <option value="TRANSFERENCIA_BS">🏦 Transferencia Bancaria (Bs.)</option>
                <option value="PUNTO_DE_VENTA">💳 Punto de Venta (Débito/Crédito)</option>
                <option value="ZELLE">💲 Zelle / Transferencia USD [+3% IGTF]</option>
              </select>
            )}

            {/* Plazos y Evaluación de Normas de Crédito en POS Mostrador / Oficina */}
            {condicionPago === 'CREDITO' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {[
                    { key: '7_DIAS', label: '7 Días' },
                    { key: '15_DIAS', label: '15 Días' },
                    { key: '21_DIAS', label: '21 Días' },
                    { key: '30_DIAS', label: '30 Días', reqApproval: true }
                  ].map((t) => {
                    const active = creditTerm === t.key;
                    const isAgreed = clientAgreedInfo.termKey === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        disabled={isOrderLocked}
                        onClick={() => {
                          if (isOrderLocked) return;
                          if (t.key === '30_DIAS' && creditTerm !== '30_DIAS') {
                            setCreditOverrideApproved(false);
                          }
                          setCreditTerm(t.key);
                        }}
                        style={{
                          padding: '4px 4px',
                          borderRadius: '7px',
                          border: active
                            ? '1.5px solid var(--motorven-gold)'
                            : isAgreed
                            ? '1px dashed rgba(56, 189, 248, 0.5)'
                            : '1px solid var(--border-glass)',
                          background: active ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                          color: active ? '#fbbf24' : 'var(--text-primary)',
                          fontSize: '0.68rem',
                          fontWeight: active ? 800 : 600,
                          cursor: isOrderLocked ? 'not-allowed' : 'pointer',
                          opacity: isOrderLocked && !active ? 0.45 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          lineHeight: 1.15
                        }}
                      >
                        <span>{t.label}</span>
                        {t.reqApproval && (
                          <span style={{ fontSize: '0.54rem', color: '#fca5a5', fontWeight: 700 }}>
                            🔒 Gerencia
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tarjeta de Diagnóstico de Normas de Crédito */}
                <div style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: effectiveIsAprobado
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(239, 68, 68, 0.14)',
                  border: `1px solid ${effectiveIsAprobado ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.45)'}`,
                  fontSize: '0.67rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '3px' }}>
                    <span style={{
                      fontWeight: 900,
                      color: effectiveIsAprobado ? '#10b981' : '#f87171',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {effectiveIsAprobado ? '✓ CRÉDITO ' : '⚠ CRÉDITO '}
                      {effectiveStatusLabel}
                    </span>

                    {!isOrderLocked && (
                      <button
                        type="button"
                        onClick={() => setShowCreditApprovalModal(true)}
                        className="btn btn-sm"
                        style={{
                          padding: '2px 7px',
                          fontSize: '0.63rem',
                          fontWeight: 800,
                          background: creditOverrideApproved
                            ? 'rgba(16, 185, 129, 0.22)'
                            : 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: creditOverrideApproved ? '#34d399' : '#fff',
                          border: creditOverrideApproved ? '1px solid #10b981' : 'none',
                          borderRadius: '6px'
                        }}
                      >
                        {creditOverrideApproved ? '✓ Autorizado' : '🛡️ Aprobar Crédito'}
                      </button>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.25 }}>
                    {effectiveMotivo}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', fontSize: '0.62rem', color: '#94a3b8' }}>
                    <span>Fact. Abiertas: <strong style={{ color: clientCreditEvaluation.masDeDosFacturas ? '#f87171' : '#e2e8f0' }}>{clientCreditEvaluation.facturasPendientesCount}/2</strong></span>
                    <span>N.E. Abiertas: <strong style={{ color: clientCreditEvaluation.dosOMasNotasEntrega ? '#f87171' : '#e2e8f0' }}>{clientCreditEvaluation.notasEntregaPendientesCount}/1</strong></span>
                    <span>Vencidas: <strong style={{ color: clientCreditEvaluation.tieneVencidas ? '#f87171' : '#10b981' }}>{clientCreditEvaluation.vencidasCount}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panel de Totales Bimoneda */}
          <div style={{ background: 'var(--bg-card-glass)', border: '1px solid var(--border-glass)', padding: '0.7rem 0.85rem', borderRadius: '12px', marginBottom: '0.65rem', minWidth: 0, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>Litros Totales:</span>
              <strong style={{ color: 'var(--neon-cyan)' }}>{totalLitrosCarrito.toFixed(2)} L</strong>
            </div>

            {fiscalTaxes.baseExentaUsd > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                <span>Base Exenta (0%):</span>
                <span>{formatUsd(fiscalTaxes.baseExentaUsd)} ({formatBs(fiscalTaxes.baseExentaBs)})</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>{tipoDoc === 'NOTA_ENTREGA' ? 'Subtotal Neto (Sin IVA):' : 'Base General (16%):'}</span>
              <span>{formatUsd(fiscalTaxes.baseGeneralUsd)} ({formatBs(fiscalTaxes.baseGeneralBs)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>{tipoDoc === 'NOTA_ENTREGA' ? 'IVA (0% - Sin IVA):' : 'IVA General (16%):'}</span>
              <span>{formatUsd(fiscalTaxes.ivaGeneralUsd)} ({formatBs(fiscalTaxes.ivaGeneralBs)})</span>
            </div>

            {fiscalTaxes.baseReducidaUsd > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <span>Base Reducida (8%):</span>
                  <span>{formatUsd(fiscalTaxes.baseReducidaUsd)} ({formatBs(fiscalTaxes.baseReducidaBs)})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <span>IVA Reducido (8%):</span>
                  <span>{formatUsd(fiscalTaxes.ivaReducidoUsd)} ({formatBs(fiscalTaxes.ivaReducidoBs)})</span>
                </div>
              </>
            )}

            {fiscalTaxes.aplicaIgtf && (
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--motorven-gold)' }}>
                <span>IGTF Divisas (3%):</span>
                <span>{formatUsd(fiscalTaxes.igtfUsd)} ({formatBs(fiscalTaxes.igtfBs)})</span>
              </div>
            )}

            {fiscalTaxes.retencionIvaBs > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--neon-cyan)' }}>
                <span>Retención IVA ({fiscalTaxes.porcentajeRetencionIva}%):</span>
                <span>-{formatBs(fiscalTaxes.retencionIvaBs)}</span>
              </div>
            )}

            <div style={{ height: '1px', background: 'var(--border-glass)', margin: '0.4rem 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '4px 8px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total {tipoDoc.replace('_', ' ')}</div>
                <div style={{ fontSize: 'clamp(1.15rem, 1.6vw, 1.4rem)', fontWeight: 900, color: 'var(--motorven-emerald)', fontFamily: 'var(--font-tech)', lineHeight: 1.1 }}>
                  {formatUsd(totalUsd)}
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 0, marginLeft: 'auto' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Tasa BCV: {formatBs(tasaBcv)}</div>
                <div style={{ fontSize: 'clamp(0.9rem, 1.3vw, 1.05rem)', fontWeight: 700, color: 'var(--motorven-gold)', lineHeight: 1.15 }}>
                  {formatBs(totalBs)}
                </div>
              </div>
            </div>
          </div>

          <button
            className="btn btn-success"
            style={{ width: '100%', padding: '0.68rem 1rem', fontSize: '0.92rem', flexShrink: 0 }}
            onClick={handleFinalizeSale}
            disabled={cartItems.length === 0}
          >
            <CheckCircle size={18} /> REALIZAR FACTURA
          </button>
        </div>
      </div>

      {/* Modal Ficha Técnica ASTM del Lubricante con Imagen Oficial */}
      {selectedSpecProduct && (
        <div className="modal-overlay" onClick={() => setSelectedSpecProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', width: '92%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={18} /> Ficha Técnica & Envase - OILSTONE ®
              </h3>
              <button className="close-btn" onClick={() => setSelectedSpecProduct(null)}>×</button>
            </div>

            {/* SECCIÓN PRINCIPAL: IMAGEN OFICIAL + METADATOS COMERCIALES */}
            <div style={{
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'center',
              background: 'var(--bg-tertiary, rgba(255,255,255,0.02))',
              border: '1px solid var(--border-glass)',
              borderRadius: '14px',
              padding: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              {/* Imagen del Producto en Envase Oficial */}
              <div style={{
                width: '160px',
                height: '180px',
                minWidth: '140px',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                position: 'relative',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
              }}>
                <OilstoneProductImage product={selectedSpecProduct} productId={selectedSpecProduct.id} imagen={selectedSpecProduct.imagen} width="100%" height="100%" />
                <span className="badge badge-info" style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.65rem' }}>
                  {selectedSpecProduct.viscosidad || 'Lubricante'}
                </span>
              </div>

              {/* Datos Comerciales y Calidad */}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <span className="badge" style={{ background: 'rgba(0, 242, 254, 0.12)', color: 'var(--neon-cyan)', border: '1px solid rgba(0, 242, 254, 0.25)', fontSize: '0.7rem', marginBottom: '6px', display: 'inline-block' }}>
                  {selectedSpecProduct.codigo || selectedSpecProduct.id} • {selectedSpecProduct.marca || 'OILSTONE ®'}
                </span>
                <h4 style={{ color: 'var(--text-heading)', fontSize: '1.05rem', fontWeight: 800, margin: '2px 0 6px 0', lineHeight: 1.25 }}>
                  {selectedSpecProduct.descripcion}
                </h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--motorven-gold)', fontWeight: 600, marginBottom: '6px' }}>
                  Norma: {selectedSpecProduct.normaApi || 'API SL / CI-4'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Presentación: <strong style={{ color: 'var(--text-primary)' }}>{getReadableUnit(selectedSpecProduct)}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--motorven-emerald)', fontFamily: 'var(--font-tech)' }}>
                    {formatUsd(resolveUnitPrice(selectedSpecProduct, selectedClient, modalidadVenta === 'OFICINA' ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.MOSTRADOR))}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)' }}>
                    {formatBs(resolveUnitPrice(selectedSpecProduct, selectedClient, modalidadVenta === 'OFICINA' ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.MOSTRADOR) * (Number(safeConfig.tasaDolar) || 0))}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    ({modalidadVenta === 'OFICINA' ? 'Precio Mayorista / Oficina' : (isWholesaleClient(selectedClient) ? 'Precio Mayorista' : 'Precio Detal')})
                  </span>
                </div>

                {/* KPI de Disponibilidad en Bodega (ATP) */}
                {(() => {
                  const specStocks = getProductWarehouseStocks(selectedSpecProduct);
                  const specRaw = Number(tipoDoc === 'NOTA_ENTREGA' ? specStocks.stock02 : specStocks.stock01);
                  const specCommitted = getProductCommittedQty(selectedSpecProduct);
                  const specDisp = Math.max(0, specRaw - specCommitted);
                  const isZero = specDisp <= 0;
                  const unitLabel = getReadableUnit(selectedSpecProduct);
                  return (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: isZero ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${isZero ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Package size={15} color={isZero ? '#ef4444' : '#10b981'} />
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            Disponible ({tipoDoc === 'NOTA_ENTREGA' ? 'Alm 02: N/Entrega' : 'Alm 01: Fiscal'}):
                          </span>
                          <strong style={{ fontSize: '0.82rem', color: isZero ? '#ef4444' : '#10b981', fontFamily: 'var(--font-code)' }}>
                            {isZero ? (specCommitted > 0 ? 'COMPROMETIDO EN O.C.' : 'AGOTADO EN ALMACÉN') : `${specDisp} ${unitLabel}`}
                          </strong>
                        </div>
                        {(selectedSpecProduct.litrosPorUnidad || 0) > 0 && specDisp > 0 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                            {(specDisp * (selectedSpecProduct.litrosPorUnidad || 1)).toFixed(0)} Lts. Libres
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '4px', marginTop: '2px' }}>
                        <span>
                          Físico Alm 01 (Fiscal): <strong style={{ color: '#34d399' }}>{specStocks.stock01}</strong> | Alm 02 (N/Entrega): <strong style={{ color: '#38bdf8' }}>{specStocks.stock02}</strong> | Total: <strong>{specStocks.total}</strong>
                        </span>
                        {specCommitted > 0 && (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>O.C.: {specCommitted}</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* TABLA DE PARÁMETROS FÍSICO-QUÍMICOS ASTM */}
            {selectedSpecProduct.especificaciones ? (
              <div style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.03))', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-cyan)', marginBottom: '2px' }}>
                  🔬 Parámetros de Calidad ASTM (Laboratorio):
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Viscosidad a 40 °C:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedSpecProduct.especificaciones.viscosidad40C}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Viscosidad a 100 °C:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedSpecProduct.especificaciones.viscosidad100C}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Punto Inflamación:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedSpecProduct.especificaciones.puntoInflamacion}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Densidad Relativa:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedSpecProduct.especificaciones.densidad || '0.875 g/mL'}</strong>
                </div>
              </div>
            ) : null}

            <div style={{ textAlign: 'right', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedSpecProduct(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Oficial de Factura y Documentos Fiscales SENIAT */}
      {showSuccessModal && lastSaleDoc && (
        <SalesInvoiceModal
          sale={lastSaleDoc}
          config={safeConfig}
          currentUser={currentUser}
          onClose={() => setShowSuccessModal(false)}
          onNewSale={() => {
            setShowSuccessModal(false);
            setCartItems([]);
            setDocumentoAfectado('');
          }}
        />
      )}

      {/* Modal de Control de Devoluciones y Garantías de Clientes Supabase */}
      <CustomerReturnsModal
        isOpen={showReturnsModal}
        onClose={() => setShowReturnsModal(false)}
        profitReturns={profitReturns}
        config={safeConfig}
        currentUser={currentUser}
        onSyncProfit={onSyncProfit}
      />

      {/* Modal de Score de Crédito & Validación Pre-Despacho */}
      <CreditScoreEngineModal
        isOpen={showCreditScoreModal}
        onClose={() => setShowCreditScoreModal(false)}
        clients={clients}
        profitInvoices={profitInvoices}
        profitCollections={profitCollections}
        config={safeConfig}
        currentUser={currentUser}
        tasaBcv={tasaBcv}
        onSelectClientForSale={(client) => setSelectedClient(client)}
      />

      {/* Modal / Drawer: Bandeja de Pedidos de Vendedores */}
      {showOrdersDrawer && (
        <div className="clients-modal-backdrop" onClick={() => setShowOrdersDrawer(false)}>
          <div
            className="clients-modal-container"
            style={{ maxWidth: '840px', width: '95%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="clients-modal-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.18)',
                  border: '1.5px solid var(--motorven-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--motorven-gold)'
                }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Bandeja de Pedidos de Vendedores
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                      {pendingSellerOrders.length} Pendiente{pendingSellerOrders.length === 1 ? '' : 's'}
                    </span>
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Notas de pedido levantadas por asesores comerciales en campo, listas para cargar a caja y facturar.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowOrdersDrawer(false)} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            {/* Buscador de pedidos */}
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-glass)', background: 'rgba(255, 255, 255, 0.02)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por cliente, RIF, asesor comercial o número de pedido..."
                  value={ordersDrawerSearch}
                  onChange={(e) => setOrdersDrawerSearch(e.target.value)}
                  style={{ paddingLeft: '36px', fontSize: '0.82rem', width: '100%' }}
                />
              </div>
            </div>

            {/* Lista de Pedidos */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredDrawerOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Inbox size={46} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    No hay pedidos pendientes en cola
                  </div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    {ordersDrawerSearch ? 'No se encontraron resultados para la búsqueda.' : 'Todas las notas de pedido de preventa han sido facturadas o liberadas.'}
                  </div>
                </div>
              ) : (
                filteredDrawerOrders.map((ord) => {
                  const client = clients.find(c => c && (c.id === ord.clienteId || c.rif === ord.clienteRif));
                  const isCredit = ord.condicionPago && ord.condicionPago !== 'CONTADO';
                  const isExpired = (() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const todayLocal = `${year}-${month}-${day}`;
                    const todayIso = now.toISOString().slice(0, 10);
                    let orderDate = '';
                    if (ord.fechaEmision) orderDate = String(ord.fechaEmision).slice(0, 10);
                    else if (ord.fecha) orderDate = String(ord.fecha).slice(0, 10);
                    else if (ord.created_at) orderDate = String(ord.created_at).slice(0, 10);
                    if (orderDate && orderDate !== todayLocal && orderDate !== todayIso) return true;
                    return now.getHours() >= 17;
                  })();

                  return (
                    <div
                      key={ord.id}
                      style={{
                        background: 'var(--surface-input, rgba(255, 255, 255, 0.03))',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                              {ord.numeroDoc || ord.id}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 7px',
                              borderRadius: '10px',
                              fontWeight: 700,
                              background: isCredit ? 'rgba(37, 99, 235, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: isCredit ? '#60a5fa' : '#34d399',
                              border: `1px solid ${isCredit ? '#2563eb' : '#10b981'}`
                            }}>
                              {isCredit ? `CRÉDITO (${ord.condicionPago})` : 'CONTADO'}
                            </span>
                            {isExpired && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 6px',
                                  borderRadius: '8px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  border: '1px solid #ef4444',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title="Esta nota de pedido superó las 72 horas desde su emisión sin facturarse; su reserva de stock se liberó automáticamente."
                              >
                                <Clock size={10} /> Reserva Liberada (72h)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Emisión: {formatDateVe(ord.fechaEmision || ord.fecha || ord.created_at || new Date())}
                            {' • '}
                            Vencimiento: <strong style={{ color: 'var(--motorven-gold)' }}>
                              {formatDateVe(
                                ord.fechaVencimiento ||
                                calculateExpirationDate(
                                  ord.fechaEmision || ord.fecha || ord.created_at || new Date(),
                                  resolveCreditDaysFromTerm(ord.condicionPago, client?.diasCredito, ord.diasCredito)
                                )
                              )}
                            </strong>
                            {ord.vendedorId && ` • Asesor: ${ord.vendedorId}`}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                            {formatUsd(ord.totalNetoUsd || ord.totalUsd)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)', fontWeight: 700 }}>
                            {Number(ord.totalLitros || 0).toFixed(1)} Lts ({Number(ord.totalCajas || 0).toFixed(0)} cj)
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.15)', padding: '6px 10px', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ minWidth: '180px' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            👤 {ord.clienteNombre}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            RIF: {ord.clienteRif || 'S/R'} • Zona: {ord.zonaVenta || 'General'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => generateSellerOrderPDF({ order: ord, config: safeConfig, currentUser, client })}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Descargar Nota de Pedido en PDF"
                          >
                            <Printer size={12} /> PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => handleLoadOrderToCart(ord)}
                            className="btn btn-primary btn-sm"
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '5px 12px',
                              background: 'linear-gradient(135deg, var(--motorven-red), #b91c1c)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                            title="Cargar cliente y productos directamente al carrito del POS"
                          >
                            <Zap size={13} /> ⚡ Cargar a Caja
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.2)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} />
                <span>Las notas de pedido no facturadas liberan su stock automáticamente a las 72 horas de su emisión.</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowOrdersDrawer(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUDITORÍA & APROBACIÓN EXCEPCIONAL DE CRÉDITO EN POS / OFICINA */}
      {showCreditApprovalModal && selectedClient && (
        <div
          className="clients-modal-backdrop"
          style={{ zIndex: 2400 }}
          onClick={() => setShowCreditApprovalModal(false)}
        >
          <div
            className="clients-modal-container"
            style={{
              maxWidth: '580px',
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1.5px solid var(--motorven-gold)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clients-modal-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1.5px solid var(--motorven-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--motorven-gold)'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Auditoría & Aprobación de Crédito ({modalidadVenta === 'OFICINA' ? 'Venta por Oficina' : 'POS Mostrador'})
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Evaluación de normas crediticias para {selectedClient.nombre || selectedClient.razonSocial} ({selectedClient.rif})
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setShowCreditApprovalModal(false)} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Checklist de las 5 Normas de Crédito */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border-glass)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '0.76rem'
              }}>
                <div style={{ fontWeight: 800, color: 'var(--neon-cyan)', marginBottom: '2px' }}>
                  📋 Diagnóstico de Normas de Crédito Motorven:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>1. Documentos vencidos (Facturas o N.E.):</span>
                  <strong style={{ color: clientCreditEvaluation.tieneVencidas ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.tieneVencidas ? `✕ ${clientCreditEvaluation.vencidasCount} Vencido(s)` : '✓ 0 Vencidos'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>2. Máximo 2 Facturas pendientes:</span>
                  <strong style={{ color: clientCreditEvaluation.masDeDosFacturas ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.facturasPendientesCount} / 2 Factura(s)
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>3. Menos de 2 Notas de Entrega pendientes:</span>
                  <strong style={{ color: clientCreditEvaluation.dosOMasNotasEntrega ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.notasEntregaPendientesCount} / 1 N.E.
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>4. Sin documentos combinados (1 Fact + 1 N.E.):</span>
                  <strong style={{ color: clientCreditEvaluation.dosCombinadas ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.dosCombinadas ? '✕ Posee Combinados' : '✓ Cumple'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>5. Plazo solicitado ({diasCreditoActual} Días):</span>
                  <strong style={{ color: isTermRequiresMandatoryApproval ? '#f59e0b' : '#10b981' }}>
                    {isTermRequiresMandatoryApproval ? '🔒 30 Días (Req. Gerencia)' : `${diasCreditoActual} Días`}
                  </strong>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Directivo / Responsable Autorizado que Aprueba el Crédito:
                </label>
                <select
                  className="form-control"
                  value={creditOverrideAuthorizer}
                  onChange={(e) => setCreditOverrideAuthorizer(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                >
                  {approverGroups.map((grp) => (
                    <optgroup key={grp.department} label={grp.department}>
                      {grp.people.map((person) => (
                        <option key={person.id} value={person.id}>
                          ✓ {person.name} — {person.role}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Justificación / Observación de Auditoría:
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Ej: Autorizado por Gerencia bajo compromiso de pago..."
                  value={creditOverrideJustification}
                  onChange={(e) => setCreditOverrideJustification(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                {creditOverrideApproved && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setCreditOverrideApproved(false);
                      setShowCreditApprovalModal(false);
                      notify.info('Autorización excepcional de crédito revocada.');
                    }}
                  >
                    Revocar Aprobación
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCreditApprovalModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', fontWeight: 800 }}
                  onClick={() => {
                    if (!authorizedApproverIds.has(creditOverrideAuthorizer)) {
                      notify.error('Seleccione un aprobador autorizado en Configuración.');
                      return;
                    }
                    setCreditOverrideApproved(true);
                    setShowCreditApprovalModal(false);
                    notify.success(`Crédito aprobado por ${creditOverrideAuthorizer}.`);
                  }}
                >
                  ✓ Otorgar Aprobación de Crédito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
