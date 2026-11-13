import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Smartphone,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  Printer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  UserPlus,
  MapPin,
  FileText,
  DollarSign,
  Package,
  Droplet,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  X,
  Share2,
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  Info,
  Building2,
  Zap,
  Warehouse,
  Users,
  BellRing,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatUsd, formatBs, resolveProductUnit, resolveProductLitersPerUnit, getProductWarehouseStocks, validateWarehouseStockForDocument } from '../services/formatService';
import { resolveUnitPrice, lineSubtotal, PRICE_CHANNEL } from '../services/pricingService';
import {
  SENIAT_CONTRIBUTOR_TYPES,
  resolveClientContributorType,
  computeContributorTypeCounts
} from '../services/fiscalService';
import {
  resolveCreditDaysFromTerm,
  calculateExpirationDate,
  formatDateVe,
  evaluateClientCreditPolicy,
  evaluateClientCreditPortfolioSummary,
  isClientAssignedToSeller,
  encodeClientRequestMetadata,
  decodeClientRequestMetadata,
  getAuthorizedApproverGroups
} from '../services/creditPolicyService';
import { generateSellerOrderPDF, generateThirdPartyStatementPDF } from '../services/pdfReportService';
import { saveSupabaseNotification } from '../services/supabaseService';
import OilstoneProductImage from '../components/OilstoneProductImage';
import ClientRegistrationModal from '../components/ClientRegistrationModal';
import ClientApprovalsModal from '../components/ClientApprovalsModal';
import { canApproveClients, getClientApprovalStatus, isClientApproved } from '../services/authService';
import { useNotification } from '../context/NotificationContext';

export default function SellerOrderPOSView({
  products = [],
  clients = [],
  orders = [],
  profitInvoices = [],
  sales = [],
  profitSellers = [],
  config = {},
  profitZones = [],
  currentUser,
  onSaveOrder,
  onSaveClient,
  onApproveClient,
  onRejectClient,
  onProceedToPOS,
  onProcessSale,
  onSyncProfit
}) {
  const notify = useNotification();
  const safeConfig = config || {};
  const tasaBcv = Number(safeConfig.tasaDolar) || 827.73;

  // Asesor Comercial activo
  const sellerName = currentUser?.nombre || 'Asesor Comercial';
  const sellerCode = currentUser?.co_ven || currentUser?.coVen || currentUser?.username || 'V01';

  // Estados principales de la preventa / venta por oficina
  const [modalidadVenta, setModalidadVenta] = useState('PREVENTA'); // 'PREVENTA' | 'OFICINA'
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchText, setClientSearchText] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientSearchContainerRef = useRef(null);

  // Cerrar listview de clientes al hacer click fuera del buscador
  useEffect(() => {
    if (!isClientDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (clientSearchContainerRef.current && !clientSearchContainerRef.current.contains(e.target)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isClientDropdownOpen]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [condicionPago, setCondicionPago] = useState('CONTADO');
  const [orderNotes, setOrderNotes] = useState('');
  const [cartItems, setCartItems] = useState([]); // [{ product, cantidad, precioUsd, subtotalUsd, litros }]
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [productSearch, setProductSearch] = useState('');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [selectedSpecProduct, setSelectedSpecProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [lastEmittedOrder, setLastEmittedOrder] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showClientApprovalsModal, setShowClientApprovalsModal] = useState(false);
  const userCanApproveClients = canApproveClients(currentUser);

  // Estados de Cartera de Clientes del Vendedor y Alertas de Vencimiento
  const [showClientsPortfolioModal, setShowClientsPortfolioModal] = useState(false);
  const [portfolioTab, setPortfolioTab] = useState('CARTERA'); // 'CARTERA' | 'SOLICITUDES'
  const [portfolioScope, setPortfolioScope] = useState('MIS_CLIENTES'); // 'MIS_CLIENTES' | 'TODOS'
  const [portfolioStatusFilter, setPortfolioStatusFilter] = useState('ALL'); // 'ALL' | 'POR_VENCER' | 'EN_MORA' | 'SOLVENTES' | 'BLOQUEADO'
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [expandedPortfolioClientId, setExpandedPortfolioClientId] = useState(null);
  const creditAlertNotifiedRef = useRef(false);

  // Estados del Formulario de Nuevo Cliente (enviado a Flujo Comercial para aprobación)
  const [isSubmittingNewClient, setIsSubmittingNewClient] = useState(false);
  const createInitialNewClientForm = () => ({
    nombre: '',
    rif: '',
    responsable: '',
    telefono: '',
    email: '',
    ciudad: '',
    estado: '',
    zonaVenta: (Array.isArray(profitZones) && profitZones[0]?.coZon) || '01',
    direccion: '',
    tipoCliente: 'Mayorista',
    esContribuyenteEspecial: false,
    diasCredito: 15,
    limiteCreditoUsd: 500,
    notasVendedor: ''
  });
  const [newClientForm, setNewClientForm] = useState(createInitialNewClientForm);

  // Estados de Aprobación Excepcional de Crédito
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

  // Lista de categorías para filtros táctiles
  const categories = [
    'TODOS',
    'Gasolina',
    'Semisintético R500',
    'Diesel 4T',
    'Motos 2T/4T',
    'Transmisiones & ATF',
    'Hidráulicos AW68',
    'Fuera de Borda'
  ];

  // -------------------------------------------------------------------------
  // CÁLCULO DE DISPONIBILIDAD ATP (Available-To-Promise)
  // Fórmula: D = max(0, Stock Físico - Comprometido Vigente (72h) - En Carrito)
  // -------------------------------------------------------------------------
  const committedStockMap = useMemo(() => {
    const map01 = {};
    const map02 = {};
    const mapTotal = {};
    const now = Date.now();
    const HOURS_72_MS = 72 * 60 * 60 * 1000;

    if (!Array.isArray(orders)) return { map01, map02, mapTotal };

    orders.forEach((ord) => {
      if (!ord) return;
      if (String(ord.tipoDoc || ord.tipo_doc || '').toUpperCase() === 'SOLICITUD_CLIENTE') return;
      const st = (ord.status || '').toUpperCase();
      if (st !== 'PENDIENTE' && st !== 'APROBADO' && st !== 'EN_PROCESO' && st !== 'RETENIDO_CREDITO') return;

      const rawDate = ord.fechaEmision || ord.fecha || ord.created_at;
      if (rawDate) {
        const orderTime = new Date(rawDate).getTime();
        if (!isNaN(orderTime) && (now - orderTime) > HOURS_72_MS) return;
      }

      const alm = String(ord.almacen || ord.almacenId || ord.almacen_id || ord.co_alma || '').trim();
      const isAlm02 = alm === '02' || alm === '2' || ord.tipoDoc === 'NOTA_ENTREGA' || ord.modalidadVenta === 'OFICINA';
      const targetMap = isAlm02 ? map02 : map01;

      const items = ord.items || ord.renglones || [];
      if (Array.isArray(items)) {
        items.forEach((it) => {
          const key = it.articuloId || it.id || it.co_art || it.codigo;
          const qty = Number(it.cantidad || it.qty || 0);
          if (key && qty > 0) {
            targetMap[key] = (targetMap[key] || 0) + qty;
            mapTotal[key] = (mapTotal[key] || 0) + qty;
          }
        });
      }
    });

    return { map01, map02, mapTotal };
  }, [orders]);

  // Consulta de stock comprometido vigente por almacén (01 = Fiscal, 02 = Nota de Entrega)
  const getProductCommittedQty = (p, specificWarehouse = null) => {
    if (!p) return 0;
    const wh = specificWarehouse || (modalidadVenta === 'OFICINA' ? '02' : '01');
    const target = wh === '02' ? committedStockMap.map02 : committedStockMap.map01;
    const uniqueKeys = [...new Set([p.id, p.co_art, p.codigo].filter(Boolean))];
    return uniqueKeys.reduce((acc, k) => acc + (target[k] || 0), 0);
  };

  // Regla de Disponibilidad ATP unificada para Preventa Móvil (Alm 01 Fiscal / Alm 02 Nota de Entrega)
  const getProductAvailability = (product, specificWarehouse = null, overrideCartQty = null) => {
    const wh = specificWarehouse || (modalidadVenta === 'OFICINA' ? '02' : '01');
    const isNota = wh === '02';
    const whLabel = isNota ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)';
    const whShortLabel = isNota ? 'Alm 02' : 'Alm 01';
    const wStocks = getProductWarehouseStocks(product);
    const rawStock = Number(isNota ? wStocks.stock02 : wStocks.stock01);
    const committed = getProductCommittedQty(product, wh);
    const stockMin = Number(product?.stockMinimo ?? product?.stock_minimo ?? 10);
    const maxAvailable = Math.max(0, rawStock - committed);
    const inCartQty = overrideCartQty !== null
      ? Number(overrideCartQty || 0)
      : (cartItems.find((it) => it.product?.id === product?.id || it.product?.codigo === product?.codigo)?.cantidad || 0);
    const disponibleReal = Math.max(0, maxAvailable - inCartQty);
    const isOutOfStock = maxAvailable <= 0;
    const isLowStock = !isOutOfStock && maxAvailable <= stockMin;
    return {
      isNota,
      targetWh: wh,
      whLabel,
      whShortLabel,
      wStocks,
      rawStock,
      committed,
      stockMin,
      maxAvailable,
      inCartQty,
      disponibleReal,
      isOutOfStock,
      isLowStock
    };
  };

  // Clientes aprobados asignados al vendedor o lista completa filtrable
  // Regla: clientes PENDIENTE / RECHAZADO no pueden recibir pedidos hasta ser aprobados
  const approvedClients = useMemo(() => {
    if (!Array.isArray(clients)) return [];
    return clients.filter(c => isClientApproved(c));
  }, [clients]);

  const pendingClientsMatchingSearch = useMemo(() => {
    if (!Array.isArray(clients) || !clientSearchText.trim()) return [];
    const q = clientSearchText.toLowerCase().trim();
    return clients.filter((c) => {
      if (isClientApproved(c)) return false;
      const nom = (c.nombre || c.razonSocial || c.cli_des || '').toLowerCase();
      const rif = (c.rif || c.co_cli || '').toLowerCase();
      const cod = (c.id || c.codigo || '').toLowerCase();
      return nom.includes(q) || rif.includes(q) || cod.includes(q);
    });
  }, [clients, clientSearchText]);

  const pendingClientRequestsCount = useMemo(() => {
    if (!Array.isArray(clients)) return 0;
    if (userCanApproveClients) {
      return clients.filter(c => getClientApprovalStatus(c) === 'PENDIENTE').length;
    }
    const uname = String(currentUser?.username || '').trim().toLowerCase();
    const coVen = String(currentUser?.co_ven || currentUser?.coVen || '').trim().toUpperCase();
    return clients.filter(c => {
      if (getClientApprovalStatus(c) !== 'PENDIENTE') return false;
      const reqUname = String(c?.solicitadoPorUsername || c?.solicitado_por_username || '').trim().toLowerCase();
      const ven = String(c?.vendedorAsignado || c?.vendedor_asignado || '').trim().toUpperCase();
      return (uname && reqUname === uname) || (coVen && ven === coVen);
    }).length;
  }, [clients, userCanApproveClients, currentUser]);

  const [clientTypeFilter, setClientTypeFilter] = useState('ALL');
  const clientContributorCounts = useMemo(
    () => computeContributorTypeCounts(approvedClients),
    [approvedClients]
  );

  const filteredClients = useMemo(() => {
    const q = clientSearchText.toLowerCase().trim();
    const list = approvedClients.filter((c) => {
      if (clientTypeFilter !== 'ALL' && resolveClientContributorType(c) !== clientTypeFilter) {
        return false;
      }
      if (!q) return true;
      const nom = (c.nombre || c.razonSocial || c.cli_des || '').toLowerCase();
      const rif = (c.rif || c.co_cli || '').toLowerCase();
      const cod = (c.id || c.codigo || '').toLowerCase();
      return nom.includes(q) || rif.includes(q) || cod.includes(q);
    });
    return !q && clientTypeFilter === 'ALL' ? list.slice(0, 30) : list;
  }, [approvedClients, clientSearchText, clientTypeFilter]);

  // Selección automática de dirección al cambiar cliente
  const handleSelectClient = (client) => {
    if (!isClientApproved(client)) {
      notify.warning('Este cliente aún está pendiente de aprobación por Caja Principal (Vanessa).');
      return;
    }
    setSelectedClient(client);
    setCreditOverrideApproved(false);
    setCreditOverrideJustification('');
    setDeliveryAddress(client?.direccion || client?.domicilioFiscal || client?.direccion2 || '');
    if (client?.diasCredito && client.diasCredito > 0) {
      setCondicionPago(client.diasCredito >= 30 ? '30_DIAS' : (client.diasCredito >= 21 ? '21_DIAS' : (client.diasCredito >= 15 ? '15_DIAS' : '7_DIAS')));
    } else {
      setCondicionPago('CONTADO');
    }
    setClientSearchText('');
    setIsClientDropdownOpen(false);
  };

  // Catálogo de productos filtrado
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((p) => {
      const q = productSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
        (p.viscosidad && p.viscosidad.toLowerCase().includes(q)) ||
        (p.oem && p.oem.toLowerCase().includes(q));

      const matchesCat = selectedCategory === 'TODOS' || p.categoria === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, productSearch, selectedCategory]);

  // Contadores ATP en el almacén activo (Disponibles vs Agotados/Comprometidos)
  const availableCount = useMemo(() => {
    const isNota = modalidadVenta === 'OFICINA';
    const wh = isNota ? '02' : '01';
    return (filteredProducts || []).filter((p) => {
      const wStocks = getProductWarehouseStocks(p);
      const raw = Number(isNota ? wStocks.stock02 : wStocks.stock01);
      const committed = getProductCommittedQty(p, wh);
      return (raw - committed) > 0;
    }).length;
  }, [filteredProducts, modalidadVenta, committedStockMap]);
  const outOfStockCount = Math.max(0, filteredProducts.length - availableCount);

  const displayedProducts = useMemo(() => {
    if (!showOnlyAvailable) return filteredProducts;
    const isNota = modalidadVenta === 'OFICINA';
    const wh = isNota ? '02' : '01';
    return (filteredProducts || []).filter((p) => {
      const wStocks = getProductWarehouseStocks(p);
      const raw = Number(isNota ? wStocks.stock02 : wStocks.stock01);
      const committed = getProductCommittedQty(p, wh);
      return (raw - committed) > 0;
    });
  }, [filteredProducts, showOnlyAvailable, modalidadVenta, committedStockMap]);

  // Métodos del carrito con Regla de Disponibilidad ATP (Almacén + Reserva 72h)
  const addToCart = (product, addQty = 1) => {
    const {
      isNota,
      whLabel,
      rawStock,
      committed,
      maxAvailable,
      inCartQty,
      disponibleReal
    } = getProductAvailability(product);
    const inCartItem = cartItems.find((it) => it.product.id === product.id || it.product.codigo === product.codigo);

    if (disponibleReal <= 0) {
      if (inCartQty > 0 && maxAvailable > 0) {
        if (committed > 0) {
          notify.warning(`Disponibilidad libre alcanzada en ${whLabel} (${maxAvailable} un. disponibles. Físico: ${rawStock}, Comprometido en O.C.: ${committed} con reserva 72h).`);
        } else {
          notify.warning(`Stock máximo alcanzado en ${whLabel} (${rawStock} unidades disponibles para este producto).`);
        }
      } else if (committed > 0) {
        notify.warning(`Este lubricante (${product.codigo}) tiene existencia física (${rawStock} un. en ${whLabel}) pero está totalmente comprometido en órdenes vigentes (reserva 72h).`);
      } else {
        notify.warning(`Este lubricante (${product.codigo}) no tiene existencia disponible en ${whLabel} actualmente.`);
      }
      return;
    }

    const qtyToAdd = Math.min(addQty, disponibleReal);
    const currentChannel = isNota ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.PREVENTA;
    const precio = resolveUnitPrice(product, selectedClient, currentChannel);
    if (!(precio > 0)) {
      notify.warning(`El producto ${product.codigo || ''} no tiene precio de venta configurado en Inventario.`);
      return;
    }
    const litrosUnit = resolveProductLitersPerUnit(product);

    if (inCartItem) {
      setCartItems(
        cartItems.map((it) => {
          if (it.product.id === product.id || it.product.codigo === product.codigo) {
            const newQty = it.cantidad + qtyToAdd;
            return {
              ...it,
              product,
              cantidad: newQty,
              precioUsd: precio,
              subtotalUsd: lineSubtotal(newQty, precio),
              litros: newQty * litrosUnit
            };
          }
          return it;
        })
      );
    } else {
      setCartItems([
        ...cartItems,
        {
          product,
          cantidad: qtyToAdd,
          precioUsd: precio,
          subtotalUsd: lineSubtotal(qtyToAdd, precio),
          litros: qtyToAdd * litrosUnit
        }
      ]);
    }
  };

  // Sincronización automática: si el precio cambia en Inventario o cambia de almacén (Fiscal vs Nota de Entrega), el carrito se ajusta a la Regla de Disponibilidad
  useEffect(() => {
    setCartItems(prev => {
      let changed = false;
      const isNota = modalidadVenta === 'OFICINA';
      const targetWh = isNota ? '02' : '01';
      const currentChannel = isNota ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.PREVENTA;
      const next = prev.map(it => {
        const fresh = (products || []).find(p => p && (p.id === it.product?.id || p.codigo === it.product?.codigo));
        const prod = fresh || it.product;
        const precio = resolveUnitPrice(prod, selectedClient, currentChannel);
        const wStocks = getProductWarehouseStocks(prod);
        const rawStock = Number(targetWh === '02' ? wStocks.stock02 : wStocks.stock01);
        const committed = getProductCommittedQty(prod, targetWh);
        const maxAvail = Math.max(0, rawStock - committed);
        const newQty = Math.min(it.cantidad, maxAvail);

        const priceChanged = precio > 0 && precio !== it.precioUsd;
        const qtyChanged = newQty !== it.cantidad;

        if (priceChanged || qtyChanged) {
          changed = true;
          const finalPrice = precio > 0 ? precio : it.precioUsd;
          return {
            ...it,
            product: prod,
            cantidad: newQty,
            precioUsd: finalPrice,
            subtotalUsd: lineSubtotal(newQty, finalPrice),
            litros: newQty * resolveProductLitersPerUnit(prod)
          };
        }
        return it;
      }).filter(it => it.cantidad > 0);

      return changed ? next : prev;
    });
  }, [products, selectedClient, modalidadVenta, committedStockMap]);

  const updateCartQty = (productId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const inCartItem = cartItems.find((it) => it.product.id === productId || it.product.codigo === productId);
    if (!inCartItem) return;

    const freshProduct = (products || []).find(p => p && (p.id === inCartItem.product?.id || p.codigo === inCartItem.product?.codigo)) || inCartItem.product;
    const { whLabel, rawStock, committed, maxAvailable } = getProductAvailability(freshProduct);

    if (newQty > maxAvailable) {
      if (committed > 0) {
        notify.warning(`Supera la disponibilidad libre en ${whLabel} (${maxAvailable} un. Físico: ${rawStock}, Comprometido en O.C.: ${committed} con reserva 72h).`);
      } else {
        notify.warning(`La cantidad solicitada (${newQty}) excede la disponibilidad actual en ${whLabel} (${maxAvailable} un.).`);
      }
      return;
    }

    const litrosUnit = resolveProductLitersPerUnit(freshProduct);
    setCartItems(
      cartItems.map((it) => {
        if (it.product.id === productId || it.product.codigo === productId) {
          return {
            ...it,
            product: freshProduct,
            cantidad: newQty,
            subtotalUsd: lineSubtotal(newQty, it.precioUsd),
            litros: newQty * litrosUnit
          };
        }
        return it;
      })
    );
  };

  // Validación estricta ATP previa a emitir pedido o venta directa
  const validateCartAvailability = () => {
    const targetWh = modalidadVenta === 'OFICINA' ? '02' : '01';
    for (const item of cartItems) {
      const freshProduct = (products || []).find(
        p => p && (p.id === item.product?.id || p.codigo === item.product?.codigo)
      ) || item.product;
      const { whLabel, rawStock, committed, maxAvailable } = getProductAvailability(freshProduct, targetWh);
      if (item.cantidad > maxAvailable) {
        notify.warning(
          `Disponibilidad insuficiente para ${freshProduct?.codigo || freshProduct?.descripcion} en ${whLabel}: solicitado ${item.cantidad}, disponible ATP ${maxAvailable} (Físico: ${rawStock}, Comprometido 72h: ${committed}).`
        );
        return false;
      }
    }
    return true;
  };

  const removeFromCart = (productId) => {
    setCartItems(cartItems.filter((it) => it.product.id !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    setOrderNotes('');
  };

  // Totales de la preventa
  const totalLitros = cartItems.reduce((acc, it) => acc + (it.litros || 0), 0);
  const totalCajas = cartItems.reduce((acc, it) => acc + (it.cantidad || 0), 0);
  const totalUsd = cartItems.reduce((acc, it) => acc + (it.subtotalUsd || 0), 0);
  const totalBs = totalUsd * tasaBcv;

  // Cálculo de Fecha de Emisión y Fecha de Vencimiento (= Emisión + Días de Crédito)
  const diasCreditoActual = useMemo(
    () => resolveCreditDaysFromTerm(condicionPago, selectedClient?.diasCredito ?? 15),
    [condicionPago, selectedClient]
  );
  const fechaEmisionActual = useMemo(() => new Date(), [cartItems.length, condicionPago, selectedClient?.id]);
  const fechaVencimientoActual = useMemo(
    () => calculateExpirationDate(fechaEmisionActual, diasCreditoActual),
    [fechaEmisionActual, diasCreditoActual]
  );

  // Evaluación completa de las Normas de Crédito Comercial (idéntica en Preventa, Oficina y POS)
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

  const isTermRequiresMandatoryApproval = condicionPago === '30_DIAS';

  const effectiveIsAprobado =
    creditOverrideApproved ||
    (Boolean(clientCreditEvaluation.isAprobado) && !isTermRequiresMandatoryApproval);

  const effectiveStatusLabel = creditOverrideApproved
    ? 'APROBADO (AUTORIZADO)'
    : isTermRequiresMandatoryApproval
    ? 'NEGADO (REQUIERE APROBACIÓN 30D)'
    : clientCreditEvaluation.statusLabel;

  const isCreditDenied =
    condicionPago !== 'CONTADO' && (!clientCreditEvaluation.evaluado || !effectiveIsAprobado);

  const effectiveMotivo = creditOverrideApproved
    ? `Autorizado por: ${creditOverrideAuthorizer}. ${creditOverrideJustification || ''}`
    : isTermRequiresMandatoryApproval
    ? !clientCreditEvaluation.isAprobado
      ? `${clientCreditEvaluation.motivo} Además, el plazo a 30 Días siempre requiere aprobación obligatoria de Gerencia.`
      : 'Política Comercial Estricta: Todo crédito a 30 Días requiere obligatoriamente solicitar y obtener aprobación de Gerencia.'
    : clientCreditEvaluation.motivo;

  const creditLimit = clientCreditEvaluation.limiteCreditoUsd || Number(selectedClient?.limiteCreditoUsd) || 0;
  const currentDebt = clientCreditEvaluation.saldoDeudorUsd || Number(selectedClient?.saldoDeudorUsd) || 0;
  const availableCredit = Math.max(0, creditLimit - currentDebt);

  const cartWarehouseValidation = useMemo(
    () =>
      validateWarehouseStockForDocument({
        items: cartItems,
        products,
        tipoDoc: modalidadVenta === 'OFICINA' ? 'NOTA_ENTREGA' : 'FACTURA',
        almacen: modalidadVenta === 'OFICINA' ? '02' : '01',
        modalidadVenta
      }),
    [cartItems, products, modalidadVenta]
  );

  // Enviar preventa / venta por oficina a facturación (Paso a Caja)
  const handleSubmitOrder = async (openDirectlyInPOS = false) => {
    if (!selectedClient) {
      notify.error('Debe seleccionar el cliente destinatario de la orden.');
      return;
    }

    if (cartItems.length === 0) {
      notify.warning('El pedido está vacío. Seleccione al menos un lubricante del catálogo.');
      return;
    }

    if (!cartWarehouseValidation.isValid) {
      notify.error(cartWarehouseValidation.message);
      return;
    }
    if (!validateCartAvailability()) return;

    setIsSubmitting(true);
    const isNotaEntrega = modalidadVenta === 'OFICINA';
    const prefix = isNotaEntrega ? 'PED-NE' : 'PED-FF';
    const orderCorrelativo = `${prefix}-${Date.now().toString().slice(-6)}`;
    const effectiveStatus = isCreditDenied ? 'RETENIDO_CREDITO' : 'APROBADO';
    const nowIso = new Date().toISOString();
    const expIso = calculateExpirationDate(nowIso, diasCreditoActual).toISOString();

    const tipoDoc = isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA';
    const warehouseCode = isNotaEntrega ? '02' : '01';
    const warehouseName = isNotaEntrega ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)';

    const orderPayload = {
      id: orderCorrelativo,
      numeroDoc: orderCorrelativo,
      correlativo: orderCorrelativo,
      modalidadVenta,
      tipoDoc,
      tipo_doc: tipoDoc,
      almacen: warehouseCode,
      almacenId: warehouseCode,
      almacen_id: warehouseCode,
      co_alma: warehouseCode,
      almacenNombre: warehouseName,
      clienteId: selectedClient.id || selectedClient.codigo || 'CLI-TEMP',
      clienteNombre: selectedClient.nombre || selectedClient.razonSocial || 'Cliente',
      clienteRif: selectedClient.rif || 'J-000000000',
      direccionEntrega: deliveryAddress,
      zonaVenta: selectedClient.zona || '01 - Valencia',
      vendedorId: sellerName,
      vendedorCoVen: sellerCode,
      fechaEmision: nowIso,
      diasCredito: diasCreditoActual,
      fechaVencimiento: expIso,
      condicionPago,
      creditOverrideApproved,
      creditOverrideAuthorizer: creditOverrideApproved ? creditOverrideAuthorizer : null,
      creditOverrideJustification: creditOverrideApproved ? creditOverrideJustification : null,
      observaciones: orderNotes || (isNotaEntrega ? 'Nota de Entrega enviada a Caja (Almacén 02).' : 'Factura Fiscal enviada a Caja (Almacén 01).'),
      notas: orderNotes || (isNotaEntrega ? 'Nota de Entrega enviada a Caja (Almacén 02).' : 'Factura Fiscal enviada a Caja (Almacén 01).'),
      status: effectiveStatus,
      totalLitros,
      totalCajas,
      totalNetoUsd: totalUsd,
      totalUsd,
      totalBs,
      items: cartItems.map((it) => ({
        articuloId: it.product.id || it.product.codigo,
        codigo: it.product.codigo,
        articuloDescripcion: it.product.descripcion,
        cantidad: it.cantidad,
        precioUnitarioUsd: it.precioUsd,
        precioUsd: it.precioUsd,
        subtotalUsd: it.subtotalUsd,
        totalUsd: it.subtotalUsd,
        unidadVenta: resolveProductUnit(it.product, 'Caja'),
        litrosUnitarios: resolveProductLitersPerUnit(it.product),
        litrosTotales: it.litros
      }))
    };

    try {
      let savedOrder = orderPayload;
      if (onSaveOrder) {
        const res = await onSaveOrder(orderPayload);
        if (res && typeof res === 'object') {
          savedOrder = { ...orderPayload, ...res, items: orderPayload.items };
        }
      }
      setLastEmittedOrder(savedOrder);
      clearCart();
      if (openDirectlyInPOS && onProceedToPOS && effectiveStatus === 'APROBADO') {
        onProceedToPOS(savedOrder);
      } else {
        setShowSuccessModal(true);
        notify.success(`¡${isNotaEntrega ? 'Nota de Entrega' : 'Factura Fiscal'} ${orderCorrelativo} enviada a Caja exitosamente!`);
      }
    } catch (err) {
      console.error('Error emitiendo pedido:', err);
      notify.error('Error al registrar la preventa: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Procesar venta directa y descontar inventario del almacén correspondiente
  const handleDirectSale = async () => {
    if (!selectedClient) {
      notify.error('Debe seleccionar el cliente destinatario de la venta.');
      return;
    }
    if (cartItems.length === 0) {
      notify.warning('El pedido está vacío. Seleccione al menos un producto.');
      return;
    }
    if (!cartWarehouseValidation.isValid) {
      notify.error(cartWarehouseValidation.message);
      return;
    }
    if (isCreditDenied) {
      notify.error('Operación retenida por políticas de crédito. Solicite aprobación.');
      return;
    }
    if (!validateCartAvailability()) return;

    const isNotaEntrega = modalidadVenta === 'OFICINA';
    const tipoDoc = isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA';
    const warehouseCode = isNotaEntrega ? '02' : '01';
    const warehouseName = isNotaEntrega ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)';

    const confirmed = await notify.confirm({
      title: isNotaEntrega ? '¿Procesar Nota de Entrega Directa?' : '¿Emitir Factura Fiscal Directa?',
      message: `Esta acción descontará el inventario directamente de ${warehouseName}. Monto Total: ${formatUsd(totalUsd)} (${formatBs(totalBs)}).`,
      confirmText: isNotaEntrega ? 'Sí, Emitir Nota de Entrega' : 'Sí, Emitir Factura Fiscal',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const expIso = calculateExpirationDate(nowIso, diasCreditoActual).toISOString();

      const salePayload = {
        tipoDoc,
        almacen: warehouseCode,
        co_alma: warehouseCode,
        clienteId: selectedClient.id || selectedClient.codigo || 'CLI-TEMP',
        clienteNombre: selectedClient.nombre || selectedClient.razonSocial || 'Cliente',
        clienteRif: selectedClient.rif || 'J-000000000',
        clienteDireccion: deliveryAddress,
        condicionPago,
        diasCredito: diasCreditoActual,
        fechaEmision: nowIso,
        fechaVencimiento: expIso,
        metodoPago: condicionPago === 'CREDITO' ? 'CREDITO' : 'EFECTIVO_USD',
        vendedor: sellerName,
        observaciones: orderNotes || (isNotaEntrega ? 'Nota de Entrega procesada desde Preventa Móvil.' : 'Factura Fiscal procesada desde Preventa Móvil.'),
        items: cartItems.map((it) => ({
          articuloId: it.product.id || it.product.codigo,
          codigo: it.product.codigo,
          descripcion: it.product.descripcion,
          articuloDescripcion: it.product.descripcion,
          cantidad: it.cantidad,
          precioUsd: it.precioUsd,
          subtotalUsd: it.subtotalUsd,
          unidad: resolveProductUnit(it.product, 'Caja'),
          unidadVenta: resolveProductUnit(it.product, 'Caja'),
          litrosPorUnidad: resolveProductLitersPerUnit(it.product),
          litros: it.litros,
          tipoAlicuota: it.product.tipoAlicuota || 'GENERAL_16',
          aplicaIva: it.product.aplicaIva !== false
        })),
        totalUsd,
        totalBs
      };

      let completedSale = salePayload;
      if (onProcessSale) {
        completedSale = await onProcessSale(salePayload);
      }
      clearCart();
      notify.success(`¡${isNotaEntrega ? 'Nota de Entrega' : 'Factura Fiscal'} #${completedSale?.numeroDoc || ''} procesada y descontada con éxito!`);
      setLastEmittedOrder({
        ...salePayload,
        ...completedSale,
        numeroDoc: completedSale?.numeroDoc || salePayload.numeroDoc,
        status: 'FACTURADO',
        totalLitros,
        totalNetoUsd: totalUsd
      });
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error procesando venta directa:', err);
      notify.error('Error al procesar la venta: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pedidos del vendedor emitidos hoy (excluyendo solicitudes de creación de clientes)
  const sellerTodayOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const nowStr = new Date().toISOString().slice(0, 10);
    return orders.filter((o) => {
      if (!o) return false;
      const tDoc = String(o.tipoDoc || o.tipo_doc || '').toUpperCase();
      if (tDoc === 'SOLICITUD_CLIENTE') return false;
      const isSeller =
        (o.vendedorId && o.vendedorId.toLowerCase().includes(sellerName.toLowerCase())) ||
        (o.vendedorCoVen && o.vendedorCoVen === sellerCode);
      const orderDate = (o.fechaEmision || o.fecha || o.created_at || '').slice(0, 10);
      return isSeller || orderDate === nowStr;
    });
  }, [orders, sellerName, sellerCode]);

  // Solicitudes de nuevo cliente enviadas a Flujo Comercial
  const sellerClientRequests = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders
      .filter((o) => o && String(o.tipoDoc || o.tipo_doc || '').toUpperCase() === 'SOLICITUD_CLIENTE')
      .map((o) => decodeClientRequestMetadata(o))
      .sort((a, b) => String(b.fechaSolicitud || '').localeCompare(String(a.fechaSolicitud || '')));
  }, [orders]);

  // Cartera completa de clientes evaluada (mora, días por vencer <=3d, solvencia, saldo)
  const clientPortfolioEntries = useMemo(() => {
    if (!Array.isArray(clients)) return [];
    return clients
      .filter(Boolean)
      .map((client) => ({
        client,
        assignedToSeller: isClientAssignedToSeller(client, currentUser, profitSellers),
        summary: evaluateClientCreditPortfolioSummary({
          client,
          profitInvoices,
          sales,
          tasaBcv
        })
      }))
      .sort((a, b) => {
        // Prioridad visual: En Mora -> Por Vencer (<=3d) -> Crédito Vigente -> Bloqueado -> Solvente
        const rank = { EN_MORA: 0, POR_VENCER: 1, CREDITO_VIGENTE: 2, BLOQUEADO: 3, SOLVENTE: 4 };
        const ra = rank[a.summary.estadoPortfolio] ?? 5;
        const rb = rank[b.summary.estadoPortfolio] ?? 5;
        if (ra !== rb) return ra - rb;
        return String(a.client.nombre || '').localeCompare(String(b.client.nombre || ''));
      });
  }, [clients, currentUser, profitSellers, profitInvoices, sales, tasaBcv]);

  const assignedClientsCount = useMemo(
    () => clientPortfolioEntries.filter((e) => e.assignedToSeller).length,
    [clientPortfolioEntries]
  );

  // Si el usuario tiene clientes asignados usa su cartera; si es Gerencia/Master sin código de vendedor muestra toda la cartera
  const effectivePortfolioScope = assignedClientsCount > 0 ? portfolioScope : 'TODOS';

  const scopedPortfolioEntries = useMemo(() => {
    if (effectivePortfolioScope === 'MIS_CLIENTES' && assignedClientsCount > 0) {
      return clientPortfolioEntries.filter((e) => e.assignedToSeller);
    }
    return clientPortfolioEntries;
  }, [clientPortfolioEntries, effectivePortfolioScope, assignedClientsCount]);

  const portfolioKpis = useMemo(() => {
    let enMora = 0;
    let porVencer3d = 0;
    let solventes = 0;
    let bloqueados = 0;
    scopedPortfolioEntries.forEach((e) => {
      const st = e.summary.estadoPortfolio;
      if (st === 'EN_MORA') enMora++;
      else if (st === 'POR_VENCER') porVencer3d++;
      else if (st === 'BLOQUEADO') bloqueados++;
      else solventes++;
    });
    return { total: scopedPortfolioEntries.length, enMora, porVencer3d, solventes, bloqueados };
  }, [scopedPortfolioEntries]);

  const filteredPortfolioEntries = useMemo(() => {
    const q = portfolioSearch.toLowerCase().trim();
    return scopedPortfolioEntries.filter(({ client, summary }) => {
      if (portfolioStatusFilter === 'POR_VENCER' && summary.estadoPortfolio !== 'POR_VENCER') return false;
      if (portfolioStatusFilter === 'EN_MORA' && summary.estadoPortfolio !== 'EN_MORA') return false;
      if (portfolioStatusFilter === 'SOLVENTES' && summary.estadoPortfolio !== 'SOLVENTE' && summary.estadoPortfolio !== 'CREDITO_VIGENTE') return false;
      if (portfolioStatusFilter === 'BLOQUEADO' && summary.estadoPortfolio !== 'BLOQUEADO') return false;
      if (!q) return true;
      return [
        client.nombre,
        client.razonSocial,
        client.rif,
        client.codigo,
        client.id,
        client.zonaVenta,
        client.zona,
        client.ciudad
      ].some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [scopedPortfolioEntries, portfolioStatusFilter, portfolioSearch]);

  // Notificación automática para el vendedor cuando falten <= 3 días para vencer el crédito de algún cliente
  useEffect(() => {
    if (creditAlertNotifiedRef.current) return;
    const expiring = scopedPortfolioEntries.filter((e) => e.summary.alerta3Dias);
    if (expiring.length === 0) return;

    creditAlertNotifiedRef.current = true;
    const namesPreview = expiring
      .slice(0, 3)
      .map(({ client, summary }) => `${client.nombre || client.razonSocial} (${summary.diasRestantesMin === 0 ? 'HOY' : `${summary.diasRestantesMin}d`})`)
      .join(', ');
    notify.warning(
      `⏳ Atención Asesor: ${expiring.length} cliente(s) con crédito por finalizar en ≤ 3 días (${namesPreview}${expiring.length > 3 ? '...' : ''}). Revisa "Mis Clientes".`,
      { duration: 7500 }
    );

    const todayKey = new Date().toISOString().slice(0, 10);
    expiring.slice(0, 10).forEach(({ client, summary }) => {
      const safeKey = String(client.id || client.codigo || client.rif || 'cli').replace(/[^a-zA-Z0-9_-]/g, '');
      saveSupabaseNotification({
        id: `notif_vend_cred3d_${todayKey}_${safeKey}`,
        tipo: 'cxc',
        severidad: summary.diasRestantesMin === 0 ? 'critica' : 'advertencia',
        modulo: 'cxc',
        titulo: `Alerta Vendedor - Crédito vence en ${summary.diasRestantesMin === 0 ? 'HOY' : `${summary.diasRestantesMin} día(s)`}: ${client.nombre || client.rif}`,
        mensaje: `Asesor ${sellerName}: Al cliente ${client.nombre || ''} (${client.rif || ''}) le resta(n) ${summary.diasRestantesMin} día(s) para finalizar su crédito en ${summary.docProximoVencer || 'documento abierto'}.`,
        destinatario_rol: 'VENTAS',
        destinatario_usuario: sellerCode || sellerName,
        origen: 'PREVENTA_MOVIL',
        metadata: {
          clienteId: client.id || client.codigo,
          diasRestantes: summary.diasRestantesMin,
          documento: summary.docProximoVencer
        }
      }).catch(() => {});
    });
  }, [scopedPortfolioEntries, sellerName, sellerCode, notify]);

  // Enviar solicitud de Nuevo Cliente al Flujo Comercial para aprobación
  const handleSubmitNewClientRequest = async (e) => {
    e.preventDefault();
    const cleanName = (newClientForm.nombre || '').trim();
    const cleanRif = (newClientForm.rif || '').trim().toUpperCase();
    const cleanPhone = (newClientForm.telefono || '').trim();
    const cleanAddress = (newClientForm.direccion || '').trim();

    if (!cleanName) {
      notify.error('La razón social o nombre del cliente es obligatorio.');
      return;
    }
    if (!cleanRif || !/^[JVEGP]-?\d{5,10}/i.test(cleanRif)) {
      notify.error('Ingrese un RIF o Cédula válido (ej: J-123456789 o V-12345678).');
      return;
    }
    if (!cleanPhone) {
      notify.error('El teléfono / WhatsApp de contacto es obligatorio.');
      return;
    }
    if (!cleanAddress) {
      notify.error('La dirección fiscal o de despacho es obligatoria.');
      return;
    }

    const dupClient = (clients || []).find(
      (c) => c && String(c.rif || '').trim().toUpperCase() === cleanRif
    );
    if (dupClient) {
      notify.warning(`Ya existe un cliente registrado con el RIF ${cleanRif} (${dupClient.nombre}).`);
      return;
    }

    const zoneObj = (profitZones || []).find((z) => String(z.coZon || z.id || '') === String(newClientForm.zonaVenta));
    const zonaNombre = zoneObj?.zonDes || zoneObj?.nombre || newClientForm.zonaVenta || 'Valencia';
    const requestId = `SOL-CLI-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();
    const diasCred = Number(newClientForm.diasCredito || 0);
    const limiteUsd = Number(newClientForm.limiteCreditoUsd || 0);
    const metaEncoded = encodeClientRequestMetadata({
      ...newClientForm,
      zonaNombre,
      vendedorAsignado: sellerCode,
      diasCredito: diasCred,
      limiteCreditoUsd: limiteUsd
    });

    const requestPayload = {
      id: requestId,
      numeroDoc: requestId,
      numeroPedido: requestId,
      correlativo: requestId,
      tipoDoc: 'SOLICITUD_CLIENTE',
      tipo_doc: 'SOLICITUD_CLIENTE',
      modalidadVenta: 'SOLICITUD_CLIENTE',
      almacen: '01',
      almacenId: '01',
      clienteId: requestId,
      clienteNombre: cleanName,
      clienteRif: cleanRif,
      direccionEntrega: cleanAddress,
      zonaVenta: zonaNombre,
      segmento: newClientForm.tipoCliente || 'Mayorista',
      vendedorId: sellerName,
      vendedorCoVen: sellerCode,
      vendedorNombre: sellerName,
      creadoPor: sellerName,
      fechaEmision: nowIso,
      diasCredito: diasCred,
      condicionPago: diasCred > 0 ? `${diasCred}_DIAS` : 'CONTADO',
      status: 'PENDIENTE_APROBACION',
      estado: 'PENDIENTE_APROBACION',
      totalLitros: 0,
      totalCajas: 0,
      totalNetoUsd: limiteUsd,
      totalUsd: limiteUsd,
      totalBs: limiteUsd * tasaBcv,
      observaciones: metaEncoded,
      comentarios: metaEncoded,
      items: []
    };

    setIsSubmittingNewClient(true);
    try {
      if (onSaveOrder) {
        await onSaveOrder(requestPayload);
      }
      await saveSupabaseNotification({
        id: `notif_new_cli_${requestId}`,
        tipo: 'sistema',
        severidad: 'info',
        modulo: 'pedidos',
        titulo: `Nueva Solicitud de Cliente: ${cleanName} (${cleanRif})`,
        mensaje: `El asesor ${sellerName} (${sellerCode}) envió la solicitud ${requestId} para aprobar a "${cleanName}" en Flujo Comercial.`,
        destinatario_rol: 'GERENCIA',
        destinatario_usuario: 'ALL',
        origen: 'PREVENTA_MOVIL',
        metadata: {
          solicitudId: requestId,
          rif: cleanRif,
          vendedor: sellerName
        }
      }).catch(() => {});

      setShowNewClientModal(false);
      setNewClientForm(createInitialNewClientForm());
      setShowClientsPortfolioModal(true);
      setPortfolioTab('SOLICITUDES');
    } catch (err) {
      console.error('Error enviando solicitud de nuevo cliente:', err);
      notify.error('No se pudo enviar la solicitud de cliente: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSubmittingNewClient(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* ========================================================================= */}
      {/* 1. ENCABEZADO SUPERIOR: TERMINAL DE PREVENTA MÓVIL (ESTILO NATIVO) */}
      {/* ========================================================================= */}
      <div className="page-header-responsive" style={{ marginBottom: '0.25rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: 'clamp(1.15rem, 3.5vw, 1.55rem)' }}>
            <Smartphone size={28} color="var(--motorven-red)" /> Terminal de Preventa Móvil OILSTONE ®
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Toma ágil de pedidos en calle • Reserva ATP garantizada por 72 horas • Cero retipeo en Caja
            </span>
            <span className="badge" style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(0, 43, 122, 0.15)', color: 'var(--neon-cyan)', border: '1px solid var(--border-glass)' }}>
              Asesor: <strong>{sellerName}</strong> ({sellerCode})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Tasa BCV */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid var(--motorven-gold)',
            fontSize: '0.78rem',
            color: 'var(--motorven-gold)',
            fontWeight: 800
          }}>
            <DollarSign size={14} />
            <span>BCV: {formatBs(tasaBcv)}</span>
          </div>

          {/* Botón Cartera de Clientes y Morosidad */}
          <button
            type="button"
            onClick={() => {
              setPortfolioTab('CARTERA');
              setPortfolioStatusFilter('ALL');
              setShowClientsPortfolioModal(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              padding: '6px 12px',
              borderColor: (portfolioKpis.enMora + portfolioKpis.porVencer3d) > 0 ? 'var(--motorven-gold)' : undefined
            }}
          >
            <Users size={15} color="var(--neon-cyan)" />
            <span>Mis Clientes ({portfolioKpis.total})</span>
            {(portfolioKpis.enMora + portfolioKpis.porVencer3d) > 0 && (
              <span style={{
                background: portfolioKpis.enMora > 0 ? '#ef4444' : '#f59e0b',
                color: '#fff',
                borderRadius: '999px',
                padding: '1px 6px',
                fontSize: '0.68rem',
                fontWeight: 900
              }}>
                {portfolioKpis.enMora + portfolioKpis.porVencer3d}
              </span>
            )}
          </button>

          {/* Botón Nuevo Cliente -> Flujo Comercial */}
          <button
            type="button"
            onClick={() => setShowNewClientModal(true)}
            className="btn btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              padding: '6px 12px',
              background: 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              borderRadius: '8px'
            }}
          >
            <UserPlus size={15} />
            <span>+ Nuevo Cliente</span>
          </button>

          {/* Botón Historial de Pedidos */}
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '6px 12px' }}
          >
            <Clock size={15} color="var(--motorven-gold)" />
            <span>Mis Pedidos ({sellerTodayOrders.length})</span>
          </button>
        </div>
      </div>

      {/* BANNER AUTOMÁTICO DE ALERTA CREDITICIA: <= 3 DÍAS POR VENCER / EN MORA */}
      {(portfolioKpis.porVencer3d > 0 || portfolioKpis.enMora > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '10px',
          background: portfolioKpis.enMora > 0
            ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.16), rgba(245, 158, 11, 0.12))'
            : 'rgba(245, 158, 11, 0.14)',
          border: portfolioKpis.enMora > 0
            ? '1px solid rgba(239, 68, 68, 0.45)'
            : '1px solid rgba(245, 158, 11, 0.45)',
          fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <BellRing size={16} color={portfolioKpis.enMora > 0 ? '#f87171' : '#f59e0b'} />
            <strong style={{ color: 'var(--text-primary)' }}>Monitor de Crédito de Cartera:</strong>
            {portfolioKpis.porVencer3d > 0 && (
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                ⏳ {portfolioKpis.porVencer3d} cliente(s) por vencer en ≤ 3 días
              </span>
            )}
            {portfolioKpis.enMora > 0 && (
              <span style={{ color: '#f87171', fontWeight: 700 }}>
                • 🚨 {portfolioKpis.enMora} cliente(s) en mora
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {portfolioKpis.porVencer3d > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setPortfolioTab('CARTERA');
                  setPortfolioStatusFilter('POR_VENCER');
                  setShowClientsPortfolioModal(true);
                }}
                style={{
                  background: 'rgba(245, 158, 11, 0.22)',
                  color: '#fbbf24',
                  border: '1px solid #f59e0b',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 10px'
                }}
              >
                Ver Por Vencer ≤3d ({portfolioKpis.porVencer3d})
              </button>
            )}
            {portfolioKpis.enMora > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setPortfolioTab('CARTERA');
                  setPortfolioStatusFilter('EN_MORA');
                  setShowClientsPortfolioModal(true);
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.22)',
                  color: '#fca5a5',
                  border: '1px solid #ef4444',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 10px'
                }}
              >
                Ver En Mora ({portfolioKpis.enMora})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CUERPO PRINCIPAL: pos-grid-layout (Catálogo 1.6fr / Resumen 1fr) */}
      {/* ========================================================================= */}
      <div className="pos-grid-layout" style={{ alignItems: 'start' }}>
        
        {/* COLUMNA IZQUIERDA: CLIENTE + BUSCADOR + GRILLA DE PRODUCTOS */}
        <div className="pos-catalog-col" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* SELECCIÓN Y FICHA DEL CLIENTE */}
          <div
            className="bento-card"
            style={{
              padding: '0.9rem 1.1rem',
              background: 'var(--bg-card-glass)',
              position: 'relative',
              overflow: 'visible',
              zIndex: isClientDropdownOpen ? 1050 : 2
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <User size={14} /> 1. Cliente Destinatario de la Preventa
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {onSaveClient && (
                  <button
                    type="button"
                    onClick={() => setShowNewClientModal(true)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      color: '#34d399',
                      borderColor: 'rgba(16,185,129,0.45)',
                      background: 'rgba(16,185,129,0.1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 700
                    }}
                    title={userCanApproveClients ? 'Registrar nuevo cliente aprobado en oficina' : 'Enviar solicitud de nuevo cliente para aprobación en Caja Principal'}
                  >
                    <UserPlus size={13} /> {userCanApproveClients ? '+ Nuevo Cliente' : 'Solicitar Nuevo Cliente'}
                  </button>
                )}
                {(pendingClientRequestsCount > 0 || userCanApproveClients || onSaveClient) && (
                  <button
                    type="button"
                    onClick={() => setShowClientApprovalsModal(true)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      color: pendingClientRequestsCount > 0 ? '#fbbf24' : 'var(--text-secondary)',
                      borderColor: pendingClientRequestsCount > 0 ? 'rgba(245,158,11,0.5)' : 'var(--border-glass)',
                      background: pendingClientRequestsCount > 0 ? 'rgba(245,158,11,0.12)' : 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 700
                    }}
                    title={userCanApproveClients ? 'Revisar y aprobar solicitudes de clientes nuevos' : 'Consultar estado de mis solicitudes de clientes'}
                  >
                    <Clock size={13} />
                    {userCanApproveClients ? 'Aprobar Clientes' : 'Mis Solicitudes'}
                    {pendingClientRequestsCount > 0 && (
                      <span style={{
                        background: '#f59e0b',
                        color: '#000',
                        borderRadius: '999px',
                        padding: '0 6px',
                        fontSize: '0.66rem',
                        fontWeight: 900
                      }}>
                        {pendingClientRequestsCount}
                      </span>
                    )}
                  </button>
                )}
                {selectedClient && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setIsClientDropdownOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.7rem', padding: '4px 10px', color: 'var(--neon-cyan)' }}
                  >
                    Cambiar Cliente
                  </button>
                )}
              </div>
            </div>

            {!selectedClient ? (
              <div ref={clientSearchContainerRef} style={{ position: 'relative', zIndex: isClientDropdownOpen ? 1051 : 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <select
                    className="form-control"
                    value={clientTypeFilter}
                    onChange={(e) => {
                      setClientTypeFilter(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    style={{ flex: '1 1 210px', fontSize: '0.8rem', minWidth: 0 }}
                    title="Clasificar y filtrar clientes por tipo SENIAT (J, V, E, G, P)"
                  >
                    <option value="ALL">Todos los tipos ({approvedClients.length})</option>
                    {SENIAT_CONTRIBUTOR_TYPES.map(t => (
                      <option key={t.code} value={t.code} title={t.description}>
                        {t.label} ({clientContributorCounts[t.code] || 0})
                      </option>
                    ))}
                  </select>
                  <div style={{ position: 'relative', flex: '2 1 240px', minWidth: 0 }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="🔍 Buscar cliente por nombre, RIF o código..."
                      value={clientSearchText}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      onClick={() => setIsClientDropdownOpen(true)}
                      onChange={(e) => {
                        setClientSearchText(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      style={{ paddingLeft: '36px', paddingRight: clientSearchText ? '32px' : '12px', fontSize: '0.85rem', width: '100%' }}
                    />
                    {clientSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setClientSearchText('');
                          setIsClientDropdownOpen(true);
                        }}
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
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {isClientDropdownOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 1040 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsClientDropdownOpen(false);
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      maxHeight: '280px',
                      overflowY: 'auto',
                      border: '1.5px solid var(--border-glass-highlight, rgba(56, 189, 248, 0.45))',
                      borderRadius: '10px',
                      background: 'var(--surface-card, #0f172a)',
                      backgroundColor: 'var(--surface-card, #0f172a)',
                      boxShadow: '0 20px 45px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
                      zIndex: 1050
                    }}>
                      {filteredClients.length === 0 ? (
                        <div style={{ padding: '0.9rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                          {pendingClientsMatchingSearch.length > 0 ? (
                            <div style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              color: '#fbbf24',
                              textAlign: 'left',
                              fontSize: '0.75rem'
                            }}>
                              <strong>⏳ {pendingClientsMatchingSearch.length} cliente(s) coincidente(s) pendiente(s) o rechazado(s):</strong>
                              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                {pendingClientsMatchingSearch.slice(0, 3).map(pc => (
                                  <li key={pc.id || pc.rif}>
                                    {pc.nombre} ({pc.rif}) — <strong>{getClientApprovalStatus(pc)}</strong>
                                    {getClientApprovalStatus(pc) === 'PENDIENTE' ? ' (espera aprobación de Caja Principal / Vanessa)' : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div>No se encontraron clientes aprobados con "{clientSearchText}".</div>
                          )}
                          {onSaveClient && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsClientDropdownOpen(false);
                                setShowNewClientModal(true);
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.74rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            >
                              <UserPlus size={13} />
                              {userCanApproveClients ? 'Registrar Nuevo Cliente Directamente' : 'Enviar Solicitud de Nuevo Cliente'}
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredClients.map((cl) => (
                          <div
                            key={cl.id || cl.codigo || cl.rif}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectClient(cl);
                              setIsClientDropdownOpen(false);
                            }}
                            style={{
                              padding: '9px 12px',
                              borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.06))',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover, rgba(0, 240, 255, 0.08))')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {cl.nombre || cl.razonSocial || cl.cli_des}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                RIF/Cédula: <strong style={{ color: 'var(--text-primary)' }}>{cl.rif || cl.co_cli}</strong> · [{resolveClientContributorType(cl)}] • Zona: {cl.zona || 'General'}
                              </div>
                            </div>
                            <ChevronRight size={14} color="var(--neon-cyan)" />
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card, rgba(0, 0, 0, 0.05))', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedClient.nombre || selectedClient.razonSocial || selectedClient.cli_des}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      RIF: <strong>{selectedClient.rif || selectedClient.co_cli}</strong> • Zona: {selectedClient.zona || 'General'}
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    background: isCreditDenied ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                    color: isCreditDenied ? '#f87171' : 'var(--semaforo-verde)',
                    border: `1px solid ${isCreditDenied ? '#ef4444' : 'var(--semaforo-verde)'}`
                  }}>
                    {isCreditDenied ? '⛔ Retenido por Crédito' : (condicionPago === 'CONTADO' ? '✓ Contado' : '✓ Crédito OK')}
                  </span>
                </div>

                {/* Barra de Crédito */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-glass)', fontSize: '0.74rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Límite:</span>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{formatUsd(creditLimit)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Saldo Deudor:</span>
                    <strong style={{ display: 'block', color: currentDebt > 0 ? '#f87171' : 'var(--text-muted)' }}>{formatUsd(currentDebt)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Disponible:</span>
                    <strong style={{ display: 'block', color: 'var(--semaforo-verde)' }}>{formatUsd(availableCredit)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BUSCADOR Y CATEGORÍAS DEL CATÁLOGO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="🔍 Buscar por viscosidad (20W50, 15W40...), descripción o código..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ paddingLeft: '36px', fontSize: '0.85rem', width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  className="badge"
                  style={{
                    background: modalidadVenta === 'OFICINA' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: modalidadVenta === 'OFICINA' ? '#38bdf8' : 'var(--motorven-red)',
                    border: modalidadVenta === 'OFICINA' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title={modalidadVenta === 'OFICINA' ? 'Almacén 02: Bóveda Central (Notas de Entrega)' : 'Almacén 01: Principal (Facturación Fiscal)'}
                >
                  <Warehouse size={13} /> {modalidadVenta === 'OFICINA' ? 'Alm 02 (Nota de Entrega)' : 'Alm 01 (Factura Fiscal)'}
                </span>
                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--semaforo-verde)', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: '0.74rem', fontWeight: 800, padding: '6px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Package size={14} /> {availableCount} Disponibles
                </span>
                {outOfStockCount > 0 && (
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(239, 68, 68, 0.14)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '6px 12px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    title="Artículos sin disponibilidad ATP inmediata en el almacén seleccionado"
                  >
                    <AlertTriangle size={14} /> {outOfStockCount} Sin Disp.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowOnlyAvailable((prev) => !prev)}
                  className="btn btn-sm"
                  style={{
                    background: showOnlyAvailable ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                    color: showOnlyAvailable ? '#34d399' : 'var(--text-muted)',
                    border: showOnlyAvailable ? '1px solid rgba(16, 185, 129, 0.55)' : '1px solid var(--border-glass)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Activa para ocultar productos agotados o totalmente comprometidos en órdenes vigentes (72h)"
                >
                  <CheckCircle2 size={13} /> {showOnlyAvailable ? 'Solo Disponibles: ON' : 'Solo Disponibles'}
                </button>
              </div>
            </div>

            {/* Pastillas de Categorías */}
            <div className="horizontal-scroll-pills">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className="btn btn-sm"
                  style={{
                    background: selectedCategory === cat ? 'linear-gradient(135deg, var(--motorven-red), #b91c1c)' : 'rgba(255,255,255,0.04)',
                    color: selectedCategory === cat ? '#fff' : 'var(--text-muted)',
                    border: selectedCategory === cat ? '1px solid var(--motorven-red)' : '1px solid var(--border-glass)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* CUADRÍCULA TÁCTIL DE LUBRICANTES (GRID TIPO POS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
            {displayedProducts.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Package size={42} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                  {showOnlyAvailable ? 'No hay lubricantes con disponibilidad ATP en este filtro' : 'No se encontraron lubricantes'}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                  {showOnlyAvailable ? 'Desactiva "Solo Disponibles" o cambia de categoría/almacén.' : 'Intente con otra viscosidad o categoría.'}
                </div>
              </div>
            ) : (
              displayedProducts.map((p) => {
                const {
                  isNota,
                  rawStock,
                  committed,
                  inCartQty: currentInCart,
                  disponibleReal,
                  isOutOfStock,
                  isLowStock
                } = getProductAvailability(p);
                const unitLabel = resolveProductUnit(p, 'Caja');
                const currentChannel = isNota ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.PREVENTA;
                const precioUsd = resolveUnitPrice(p, selectedClient, currentChannel);
                const litrosUnit = Number(p.litrosPorUnidad || resolveProductLitersPerUnit(p) || 0);
                const stockConfig = isOutOfStock
                  ? { label: committed > 0 ? 'Comprometido' : 'Agotado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', dot: '#ef4444' }
                  : isLowStock
                  ? { label: 'Stock Crítico', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)', dot: '#f59e0b' }
                  : { label: 'Disponible', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', dot: '#10b981' };

                return (
                  <div
                    key={p.id || p.codigo}
                    style={{
                      background: 'var(--bg-card-glass)',
                      border: currentInCart > 0
                        ? '1.5px solid var(--neon-cyan)'
                        : isOutOfStock
                        ? '1px solid rgba(239, 68, 68, 0.35)'
                        : '1px solid var(--border-glass)',
                      opacity: isOutOfStock && currentInCart === 0 ? 0.72 : 1,
                      borderRadius: '12px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      boxShadow: currentInCart > 0 ? '0 0 12px rgba(0, 240, 255, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Badge de cantidad en carrito si ya se agregó */}
                    {currentInCart > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'var(--neon-cyan)',
                        color: '#000',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        padding: '2px 7px',
                        borderRadius: '12px',
                        zIndex: 2
                      }}>
                        {currentInCart} en orden
                      </div>
                    )}

                    {/* Imagen Vectorial Oficial del Catálogo OILSTONE - Idéntica a SalesPOSView */}
                    <div 
                      style={{
                        height: '135px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        marginBottom: '0.75rem',
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
                      title="Toca para ver Ficha Técnica ASTM y especificaciones oficiales"
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

                    {/* Metadatos */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                          {p.codigo}
                        </span>
                        {p.viscosidad && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '6px', color: 'var(--text-muted)' }}>
                            {p.viscosidad}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', lineHeight: '1.25', minHeight: '32px' }}>
                        {p.descripcion}
                      </div>

                      {/* KPI UNIFICADO DE DISPONIBILIDAD ATP (Alm 01 / Alm 02 - Comprometido 72h - Carrito) */}
                      <div
                        style={{
                          marginTop: '6px',
                          padding: '6px 8px',
                          borderRadius: '9px',
                          background: stockConfig.bg,
                          border: `1px solid ${stockConfig.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
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
                            <span style={{ fontSize: '0.67rem', fontWeight: 800, color: stockConfig.color, textTransform: 'uppercase', letterSpacing: '0.2px', whiteSpace: 'nowrap' }}>
                              {stockConfig.label}
                            </span>
                          </div>

                          <div style={{ textAlign: 'right', display: 'inline-flex', alignItems: 'baseline', gap: '4px', flexShrink: 0, marginLeft: 'auto' }}>
                            <strong style={{ fontSize: '0.76rem', color: disponibleReal <= 0 ? '#ef4444' : 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
                              {disponibleReal} {unitLabel}
                            </strong>
                            {litrosUnit > 0 && disponibleReal > 0 && (
                              <span style={{ fontSize: '0.62rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                                ({(disponibleReal * litrosUnit).toLocaleString('es-VE', { maximumFractionDigits: 0 })} L)
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '4px',
                            borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                            paddingTop: '4px',
                            fontSize: '0.62rem'
                          }}
                        >
                          <span
                            style={{
                              color: isNota ? '#38bdf8' : '#34d399',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 700
                            }}
                            title={`Existencia física en ${isNota ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)'}`}
                          >
                            <Building2 size={10} /> {isNota ? 'Alm 02' : 'Alm 01'}: <strong style={{ color: 'var(--text-primary)' }}>{rawStock}</strong>
                          </span>

                          {committed > 0 && (
                            <span
                              style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
                              title="Unidades comprometidas en órdenes vigentes (reserva 72 horas)"
                            >
                              <Clock size={10} /> O.C.: <strong>{committed}</strong>
                            </span>
                          )}

                          {currentInCart > 0 && (
                            <span
                              style={{ color: 'var(--neon-cyan)', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}
                              title="Unidades reservadas en el carrito actual"
                            >
                              <ShoppingCart size={10} /> Carrito: <strong>{currentInCart}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer: Precios y Botones Táctiles +/- */}
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontFamily: 'var(--font-tech)', fontSize: '1rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                            {formatUsd(precioUsd)}
                          </span>
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            background: modalidadVenta === 'OFICINA' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: modalidadVenta === 'OFICINA' ? '#38bdf8' : 'var(--motorven-red)',
                            border: modalidadVenta === 'OFICINA' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          }}>
                            {modalidadVenta === 'OFICINA' ? 'Mayor' : 'Minorista / Calle'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--motorven-gold)' }}>
                          {formatBs(precioUsd * tasaBcv)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {currentInCart > 0 && (
                          <button
                            type="button"
                            onClick={() => updateCartQty(p.id, currentInCart - 1)}
                            className="btn btn-secondary btn-sm"
                            style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={13} />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={disponibleReal <= 0}
                          onClick={() => addToCart(p, 1)}
                          className="btn btn-primary btn-sm"
                          style={{
                            minWidth: currentInCart > 0 ? '34px' : '65px',
                            height: '28px',
                            padding: '0 8px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            opacity: disponibleReal <= 0 ? 0.45 : 1,
                            cursor: disponibleReal <= 0 ? 'not-allowed' : 'pointer'
                          }}
                          title={disponibleReal <= 0 ? (isOutOfStock ? stockConfig.label : 'Toda la disponibilidad libre ya está en tu carrito') : `Agregar ${unitLabel} al carrito (${disponibleReal} disponibles)`}
                        >
                          <Plus size={13} /> {currentInCart === 0 ? (isOutOfStock ? (committed > 0 ? 'Comprometido' : 'Agotado') : 'Añadir') : currentInCart}
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* COLUMNA DERECHA: RESUMEN DEL PEDIDO & ACCIONES COMERCIALES */}
        {/* ========================================================================= */}
        <div className="pos-cart-col" style={{ position: 'sticky', top: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: 0 }}>
          
          <div className="bento-card" style={{ padding: '0.9rem', background: 'var(--bg-card-glass)', display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: 0 }}>
            
            {/* Selector de Modalidad: Factura Fiscal vs Nota de Entrega */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setModalidadVenta('PREVENTA')}
                className="btn btn-sm"
                style={{
                  background: modalidadVenta === 'PREVENTA' ? 'linear-gradient(135deg, var(--motorven-red), #b91c1c)' : 'rgba(255,255,255,0.03)',
                  color: modalidadVenta === 'PREVENTA' ? '#fff' : 'var(--text-muted)',
                  border: modalidadVenta === 'PREVENTA' ? '1px solid var(--motorven-red)' : '1px solid var(--border-glass)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <FileText size={13} /> Factura Fiscal
              </button>
              <button
                type="button"
                onClick={() => setModalidadVenta('OFICINA')}
                className="btn btn-sm"
                style={{
                  background: modalidadVenta === 'OFICINA' ? 'linear-gradient(135deg, #1e40af, #0284c7)' : 'rgba(255,255,255,0.03)',
                  color: modalidadVenta === 'OFICINA' ? '#fff' : 'var(--text-muted)',
                  border: modalidadVenta === 'OFICINA' ? '1px solid #38bdf8' : '1px solid var(--border-glass)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Package size={13} /> Nota de Entrega
              </button>
            </div>

            {/* Header del Carrito */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                <ShoppingCart size={17} color="var(--motorven-red)" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Resumen de Nota de Pedido ({cartItems.length})
                </span>
              </div>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.68rem', padding: '2px 8px', color: '#f87171', flexShrink: 0 }}
                >
                  <Trash2 size={12} style={{ marginRight: '3px' }} /> Vaciar
                </button>
              )}
            </div>

            {/* Lista de Renglones en el Carrito */}
            <div style={{ maxHeight: '210px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
              {cartItems.length === 0 ? (
                <div style={{ padding: '1rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ShoppingCart size={28} style={{ opacity: 0.3, margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>El pedido está vacío</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>Toca los lubricantes del catálogo para sumarlos.</div>
                </div>
              ) : (
                cartItems.map((it) => (
                  <div
                    key={it.product.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: '34px', height: '38px', minWidth: '34px', background: '#ffffff', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', border: '1px solid rgba(0,0,0,0.1)' }}>
                        <OilstoneProductImage product={it.product} productId={it.product.id} imagen={it.product.imagen} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '4px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.product.descripcion}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {it.product.codigo} • {resolveProductUnit(it.product, 'Caja')}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--semaforo-verde)' }}>
                        {formatUsd(it.subtotalUsd)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', fontWeight: 600 }}>
                        🛢️ {it.litros.toFixed(1)} Lts. ({formatUsd(it.precioUsd)} c/u)
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() => updateCartQty(it.product.id, it.cantidad - 1)}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={11} />
                        </button>
                        <span style={{ fontSize: '0.82rem', fontWeight: 900, minWidth: '22px', textAlign: 'center' }}>
                          {it.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => addToCart(it.product, 1)}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(it.product.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '24px', height: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}
                          title="Eliminar de la orden"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* CONDICIONES COMERCIALES, FECHAS Y NORMAS DE CRÉDITO */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>
                  Condición de Pago Acordada:
                </label>
                <select
                  className="form-control"
                  value={condicionPago}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    if (nextVal === '30_DIAS' && condicionPago !== '30_DIAS') {
                      setCreditOverrideApproved(false);
                    }
                    setCondicionPago(nextVal);
                  }}
                  style={{ fontSize: '0.82rem' }}
                >
                  <option value="CONTADO">Contado / Pago Inmediato en Caja (0 Días)</option>
                  <option value="7_DIAS">Crédito 7 Días</option>
                  <option value="15_DIAS">Crédito 15 Días</option>
                  <option value="21_DIAS">Crédito 21 Días</option>
                  <option value="30_DIAS">Crédito 30 Días (🔒 Requiere Aprobación Gerencia)</option>
                </select>
              </div>

              {/* TARJETA DE FECHA DE EMISIÓN Y FECHA DE VENCIMIENTO (= EMISIÓN + DÍAS CRÉDITO) */}
              <div style={{
                padding: '7px 10px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Calendar size={10} color="var(--neon-cyan)" /> Fecha de Emisión
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
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
                  <div style={{ fontSize: '0.78rem', fontWeight: 900, color: diasCreditoActual > 0 ? 'var(--motorven-gold)' : 'var(--neon-cyan)', fontFamily: 'var(--font-code)' }}>
                    {formatDateVe(fechaVencimientoActual)}
                  </div>
                </div>
              </div>

              {/* Diagnóstico de Normas de Crédito cuando se selecciona Crédito */}
              {condicionPago !== 'CONTADO' && selectedClient && (
                <div style={{
                  padding: '7px 9px',
                  borderRadius: '8px',
                  background: effectiveIsAprobado ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.14)',
                  border: `1px solid ${effectiveIsAprobado ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.45)'}`,
                  fontSize: '0.68rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <strong style={{ color: effectiveIsAprobado ? '#10b981' : '#f87171' }}>
                      {effectiveIsAprobado ? '✓ CRÉDITO ' : '⚠ CRÉDITO '}
                      {effectiveStatusLabel}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setShowCreditApprovalModal(true)}
                      className="btn btn-sm"
                      style={{
                        padding: '2px 7px',
                        fontSize: '0.63rem',
                        fontWeight: 800,
                        background: creditOverrideApproved ? 'rgba(16, 185, 129, 0.22)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: creditOverrideApproved ? '#34d399' : '#fff',
                        borderRadius: '6px'
                      }}
                    >
                      {creditOverrideApproved ? '✓ Autorizado' : '🛡️ Aprobar Crédito'}
                    </button>
                  </div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.25 }}>
                    {effectiveMotivo}
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>
                  Dirección o Instrucciones de Despacho:
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Galpón principal, recibir antes de las 11 AM..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  style={{ fontSize: '0.78rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>
                  Observaciones Comerciales (Opcional):
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Notas adicionales para facturación..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  style={{ fontSize: '0.78rem' }}
                />
              </div>
            </div>

            {/* CAJA DE TOTALES */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.25), rgba(220, 38, 38, 0.15))',
              border: '1px solid var(--border-glass)',
              borderRadius: '10px',
              padding: '10px 12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Volumen Físico:</span>
                <strong style={{ color: 'var(--motorven-gold)' }}>
                  {totalLitros.toFixed(1)} Litros ({totalCajas} bultos)
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Total {modalidadVenta === 'OFICINA' ? 'Nota de Entrega' : 'Factura Fiscal'}:
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--semaforo-verde)', lineHeight: 1 }}>
                    {formatUsd(totalUsd)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)', marginTop: '2px' }}>
                    {formatBs(totalBs)}
                  </div>
                </div>
              </div>
            </div>

            {cartItems.length > 0 && !cartWarehouseValidation.isValid && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.55)',
                  color: '#fca5a5',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  lineHeight: 1.3
                }}
              >
                <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{cartWarehouseValidation.message}</span>
              </div>
            )}

            {/* BOTONES DE ACCIÓN PRINCIPAL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                disabled={isSubmitting || cartItems.length === 0 || !selectedClient || !cartWarehouseValidation.isValid}
                onClick={() => handleSubmitOrder(false)}
                className="btn btn-primary"
                style={{
                  padding: '11px',
                  fontSize: '0.88rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: isCreditDenied
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : (modalidadVenta === 'OFICINA'
                        ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                        : 'linear-gradient(135deg, var(--motorven-red), #b91c1c)'),
                  boxShadow: modalidadVenta === 'OFICINA' ? '0 4px 16px rgba(2, 132, 199, 0.4)' : '0 4px 16px rgba(220, 38, 38, 0.4)',
                  opacity: cartItems.length === 0 || !selectedClient || !cartWarehouseValidation.isValid ? 0.5 : 1
                }}
              >
                <Send size={17} />
                <span>
                  {isCreditDenied
                    ? 'SOLICITAR APROBACIÓN A CAJA'
                    : (modalidadVenta === 'OFICINA' ? '🚀 EMITIR NOTA DE ENTREGA A CAJA' : '🚀 EMITIR FACTURA FISCAL A CAJA')}
                </span>
              </button>
              {onProcessSale && !isCreditDenied && (
                <button
                  type="button"
                  disabled={isSubmitting || cartItems.length === 0 || !selectedClient || !cartWarehouseValidation.isValid}
                  onClick={handleDirectSale}
                  className="btn btn-sm"
                  style={{
                    padding: '9px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: modalidadVenta === 'OFICINA' ? 'linear-gradient(135deg, #0369a1, #075985)' : 'linear-gradient(135deg, #059669, #047857)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
                    opacity: cartItems.length === 0 || !selectedClient || !cartWarehouseValidation.isValid ? 0.5 : 1
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>{modalidadVenta === 'OFICINA' ? 'Facturar Directo (Nota de Entrega - Alm 02)' : 'Facturar Directo (Factura Fiscal - Alm 01)'}</span>
                </button>
              )}

              {!isCreditDenied && onProceedToPOS && (
                <button
                  type="button"
                  disabled={isSubmitting || cartItems.length === 0 || !selectedClient || !cartWarehouseValidation.isValid}
                  onClick={() => handleSubmitOrder(true)}
                  className="btn btn-secondary"
                  style={{
                    padding: '9px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: '1px solid var(--neon-cyan)',
                    color: 'var(--neon-cyan)',
                    opacity: cartItems.length === 0 || !selectedClient || !cartWarehouseValidation.isValid ? 0.5 : 1
                  }}
                >
                  <Zap size={15} /> Emitir y Abrir Directamente en POS de Caja
                </button>
              )}
            </div>

            {/* Aviso de Reserva */}
            <div style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Clock size={11} />
              <span>Reserva stock automáticamente durante 72 horas desde su emisión.</span>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL DE ÉXITO: NOTA DE PEDIDO EMITIDA + DESCARGA PDF & WHATSAPP */}
      {/* ========================================================================= */}
      {showSuccessModal && lastEmittedOrder && (
        <div className="clients-modal-backdrop" onClick={() => setShowSuccessModal(false)}>
          <div
            className="clients-modal-container"
            style={{ maxWidth: '540px', width: '92%', textAlign: 'center', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid var(--semaforo-verde)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--semaforo-verde)',
              margin: '0 auto 12px'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {lastEmittedOrder.status === 'FACTURADO'
                ? (lastEmittedOrder.tipoDoc === 'NOTA_ENTREGA' ? '¡Nota de Entrega Facturada Directamente!' : '¡Factura Fiscal Emitida Directamente!')
                : (lastEmittedOrder.tipoDoc === 'NOTA_ENTREGA' ? '¡Nota de Entrega Enviada a Caja!' : '¡Factura Fiscal Enviada a Caja!')}
            </h3>

            <div style={{ fontFamily: 'var(--font-code)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--neon-cyan)', marginTop: '4px' }}>
              N° {lastEmittedOrder.numeroDoc || lastEmittedOrder.id}
            </div>

            <div style={{
              margin: '10px auto',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-glass)',
              fontSize: '0.76rem',
              display: 'flex',
              justifyContent: 'space-around',
              gap: '8px'
            }}>
              <span>Emisión: <strong>{formatDateVe(lastEmittedOrder.fechaEmision)}</strong></span>
              <span>Almacén: <strong style={{ color: lastEmittedOrder.tipoDoc === 'NOTA_ENTREGA' ? '#38bdf8' : 'var(--motorven-gold)' }}>{lastEmittedOrder.tipoDoc === 'NOTA_ENTREGA' ? '02: Bóveda Central' : '01: Principal Fiscal'}</strong></span>
              <span>Plazo: <strong>{lastEmittedOrder.diasCredito || 0} Días</strong></span>
              <span>Vencimiento: <strong style={{ color: 'var(--motorven-gold)' }}>{formatDateVe(lastEmittedOrder.fechaVencimiento)}</strong></span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '8px 0 14px', lineHeight: '1.5' }}>
              {lastEmittedOrder.status === 'FACTURADO'
                ? <>La venta para <strong>{lastEmittedOrder.clienteNombre}</strong> ({lastEmittedOrder.totalLitros ? Number(lastEmittedOrder.totalLitros).toFixed(1) : '0.0'} Lts • {formatUsd(lastEmittedOrder.totalNetoUsd || lastEmittedOrder.totalUsd)}) ha sido completada y el stock fue descontado de <strong>{lastEmittedOrder.tipoDoc === 'NOTA_ENTREGA' ? 'Almacén 02 (Notas de Entrega)' : 'Almacén 01 (Facturación Fiscal)'}</strong>.</>
                : <>La orden para <strong>{lastEmittedOrder.clienteNombre}</strong> ({lastEmittedOrder.totalLitros ? Number(lastEmittedOrder.totalLitros).toFixed(1) : '0.0'} Lts • {formatUsd(lastEmittedOrder.totalNetoUsd || lastEmittedOrder.totalUsd)}) ya se encuentra en la <strong>bandeja de entrada de la Cajera en planta</strong> ({lastEmittedOrder.tipoDoc === 'NOTA_ENTREGA' ? 'Almacén 02' : 'Almacén 01'}) con restricción de <strong>NO MODIFICAR</strong>.</>}
            </p>

            {/* Botones de Documento */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {onProceedToPOS && lastEmittedOrder.status !== 'RETENIDO_CREDITO' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    onProceedToPOS(lastEmittedOrder);
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '10px',
                    fontSize: '0.88rem',
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Zap size={16} /> Abrir en POS de Caja para Facturar (Modo No Modificar)
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  generateSellerOrderPDF({
                    order: lastEmittedOrder,
                    config: safeConfig,
                    currentUser,
                    client: selectedClient
                  });
                }}
                className="btn btn-print-report"
                style={{
                  padding: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Printer size={16} color="#ffffff" /> Descargar Nota de Pedido (PDF Oficial)
              </button>

              <button
                type="button"
                onClick={() => {
                  const textMsg = `*SIGNUM MOTORVEN* - Nota de Pedido ${lastEmittedOrder.numeroDoc}\nCliente: ${lastEmittedOrder.clienteNombre}\nEmisión: ${formatDateVe(lastEmittedOrder.fechaEmision)} | Vencimiento: ${formatDateVe(lastEmittedOrder.fechaVencimiento)}\nVolumen: ${lastEmittedOrder.totalLitros.toFixed(1)} Litros\nTotal: ${formatUsd(lastEmittedOrder.totalNetoUsd)} (Bs. ${formatBs(lastEmittedOrder.totalBs)})\nAsesor: ${sellerName}\n_Reserva activa en almacén durante 72 horas._`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(textMsg)}`, '_blank');
                }}
                className="btn btn-secondary"
                style={{
                  padding: '9px',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderColor: 'rgba(37, 211, 102, 0.4)',
                  color: '#25d366'
                }}
              >
                <Share2 size={16} /> Compartir Resumen por WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="btn btn-secondary"
                style={{ marginTop: '6px', fontSize: '0.8rem' }}
              >
                Cerrar y Montar Nuevo Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DRAWER: HISTORIAL DE PEDIDOS DEL ASESOR HOY */}
      {/* ========================================================================= */}
      {showHistoryDrawer && (
        <div className="clients-modal-backdrop" onClick={() => setShowHistoryDrawer(false)}>
          <div
            className="clients-modal-container"
            style={{ maxWidth: '780px', width: '95%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clients-modal-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color="var(--motorven-gold)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Mis Pedidos de Preventa ({sellerTodayOrders.length})
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Órdenes emitidas hoy por {sellerName}. Verifique el estatus de facturación en caja.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowHistoryDrawer(false)} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sellerTodayOrders.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Smartphone size={40} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Aún no has emitido pedidos hoy</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>Selecciona un cliente y agrega lubricantes para empezar.</div>
                </div>
              ) : (
                sellerTodayOrders.map((ord) => {
                  const isBilled = ord.status === 'FACTURADO';
                  return (
                    <div
                      key={ord.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                            {ord.numeroDoc || ord.id}
                          </span>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            background: isBilled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: isBilled ? 'var(--semaforo-verde)' : 'var(--motorven-gold)',
                            border: `1px solid ${isBilled ? 'var(--semaforo-verde)' : 'var(--motorven-gold)'}`
                          }}>
                            {isBilled ? '✅ FACTURADO EN CAJA' : '⏳ EN COLA DE CAJA'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '3px' }}>
                          {ord.clienteNombre}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {Number(ord.totalLitros || 0).toFixed(1)} Lts • {formatUsd(ord.totalNetoUsd || ord.totalUsd)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          generateSellerOrderPDF({
                            order: ord,
                            config: safeConfig,
                            currentUser,
                            client: clients.find((c) => c && (c.id === ord.clienteId || c.rif === ord.clienteRif))
                          });
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Printer size={13} /> PDF
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-glass)', textAlign: 'right' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowHistoryDrawer(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Presentación: <strong style={{ color: 'var(--text-primary)' }}>{resolveProductUnit(selectedSpecProduct, 'Caja')}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)' }}>
                    {formatUsd(resolveUnitPrice(selectedSpecProduct, selectedClient, modalidadVenta === 'OFICINA' ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.PREVENTA))}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)' }}>
                    {formatBs(resolveUnitPrice(selectedSpecProduct, selectedClient, modalidadVenta === 'OFICINA' ? PRICE_CHANNEL.OFICINA : PRICE_CHANNEL.PREVENTA) * tasaBcv)}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    ({modalidadVenta === 'OFICINA' ? 'Precio Mayorista' : 'Precio Minorista / Venta de Calle'})
                  </span>
                </div>

                {/* KPI de Disponibilidad ATP en Almacén Activo */}
                {(() => {
                  const {
                    isNota,
                    wStocks: specStocks,
                    committed: specCommitted,
                    disponibleReal: specDisp,
                    maxAvailable: specMaxAvail,
                    inCartQty: specInCart
                  } = getProductAvailability(selectedSpecProduct);
                  const isZero = specMaxAvail <= 0;
                  const unitLabel = resolveProductUnit(selectedSpecProduct, 'Caja');
                  const specLitersPerUnit = resolveProductLitersPerUnit(selectedSpecProduct);
                  return (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: isZero ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${isZero ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      fontSize: '0.73rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Warehouse size={14} color={isZero ? '#ef4444' : '#10b981'} />
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                            Disponible ({isNota ? 'Alm 02: N/Entrega' : 'Alm 01: Fiscal'}):
                          </span>
                          <strong style={{ color: isZero ? '#ef4444' : '#10b981', fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}>
                            {isZero ? (specCommitted > 0 ? 'COMPROMETIDO EN O.C.' : 'AGOTADO EN ALMACÉN') : `${specDisp} ${unitLabel}`}
                          </strong>
                        </div>
                        {specLitersPerUnit > 0 && specDisp > 0 && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                            {(specDisp * specLitersPerUnit).toFixed(0)} Lts. Libres
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '4px' }}>
                        <span>
                          Físico Alm 01 (Fiscal): <strong style={{ color: '#34d399' }}>{specStocks.stock01}</strong> | Alm 02 (N/Entrega): <strong style={{ color: '#38bdf8' }}>{specStocks.stock02}</strong> | Total: <strong>{specStocks.total}</strong>
                        </span>
                        <span style={{ display: 'inline-flex', gap: '8px' }}>
                          {specCommitted > 0 && (
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>O.C. 72h: {specCommitted}</span>
                          )}
                          {specInCart > 0 && (
                            <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>Carrito: {specInCart}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* TABLA DE PARÁMETROS TÉCNICOS ASTM */}
            <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Parámetro ASTM</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>Especificación Oficial</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>Grado SAE Viscosidad</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--neon-cyan)' }}>{selectedSpecProduct.viscosidad || 'SAE 15W-40'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>Clasificación de Servicio</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedSpecProduct.normaApi || 'API SL / CI-4'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>Categoría / Tipo de Base</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{selectedSpecProduct.categoria || 'Mineral Premium'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>Volumen Unitario Neto</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--motorven-gold)' }}>{(selectedSpecProduct.litrosPorUnidad || 1).toFixed(2)} Litros</td>
                  </tr>
                  {selectedSpecProduct.oem && (
                    <tr>
                      <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>Homologación / OEM</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>{selectedSpecProduct.oem}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedSpecProduct(null)}
              >
                Cerrar Ficha
              </button>
              {(() => {
                const isNota = modalidadVenta === 'OFICINA';
                const targetWh = isNota ? '02' : '01';
                const specStocks = getProductWarehouseStocks(selectedSpecProduct);
                const rawStock = Number(isNota ? specStocks.stock02 : specStocks.stock01);
                const committed = getProductCommittedQty(selectedSpecProduct, targetWh);
                const specInCart = cartItems.find((it) => it.product.id === selectedSpecProduct.id || it.product.codigo === selectedSpecProduct.codigo)?.cantidad || 0;
                const specAtp = Math.max(0, rawStock - committed - specInCart);
                return (
                  <button
                    type="button"
                    disabled={specAtp <= 0}
                    className="btn btn-primary btn-sm"
                    style={{
                      background: specAtp <= 0 ? '#475569' : 'linear-gradient(135deg, var(--motorven-red), #b91c1c)',
                      cursor: specAtp <= 0 ? 'not-allowed' : 'pointer',
                      opacity: specAtp <= 0 ? 0.65 : 1
                    }}
                    title={specAtp <= 0 ? `Sin existencia disponible en Almacén ${targetWh}` : 'Agregar producto al pedido'}
                    onClick={() => {
                      addToCart(selectedSpecProduct, 1);
                      setSelectedSpecProduct(null);
                    }}
                  >
                    <Plus size={14} style={{ marginRight: '4px' }} /> {specAtp <= 0 ? `Sin Stock Alm ${targetWh}` : 'Agregar a Preventa'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE APROBACIÓN EXCEPCIONAL DE CRÉDITO EN NOTA DE PEDIDO */}
      {showCreditApprovalModal && selectedClient && (
        <div
          className="clients-modal-backdrop"
          style={{ zIndex: 2400 }}
          onClick={() => setShowCreditApprovalModal(false)}
        >
          <div
            className="clients-modal-container"
            style={{
              maxWidth: '560px',
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1.5px solid var(--motorven-gold)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clients-modal-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="var(--motorven-gold)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Auditoría & Aprobación de Crédito ({modalidadVenta === 'OFICINA' ? 'Nota de Entrega' : 'Factura Fiscal'})
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Cliente: {selectedClient.nombre || selectedClient.razonSocial} ({selectedClient.rif})
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setShowCreditApprovalModal(false)} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border-glass)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '0.76rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}>
                <div style={{ fontWeight: 800, color: 'var(--neon-cyan)' }}>📋 Normas de Crédito Motorven:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>1. Documentos vencidos:</span>
                  <strong style={{ color: clientCreditEvaluation.tieneVencidas ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.tieneVencidas ? `✕ ${clientCreditEvaluation.vencidasCount} Vencido(s)` : '✓ 0 Vencidos'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>2. Facturas pendientes (máx. 2):</span>
                  <strong style={{ color: clientCreditEvaluation.masDeDosFacturas ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.facturasPendientesCount} / 2
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>3. Notas de Entrega pendientes (máx. 1):</span>
                  <strong style={{ color: clientCreditEvaluation.dosOMasNotasEntrega ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.notasEntregaPendientesCount} / 1
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>4. Sin documentos combinados (1 Fact + 1 N.E.):</span>
                  <strong style={{ color: clientCreditEvaluation.dosCombinadas ? '#ef4444' : '#10b981' }}>
                    {clientCreditEvaluation.dosCombinadas ? '✕ Posee Combinados' : '✓ Cumple'}
                  </strong>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Responsable Autorizado que Aprueba el Crédito:
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
                  Justificación de Aprobación:
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Ej: Autorizado por Gerencia..."
                  value={creditOverrideJustification}
                  onChange={(e) => setCreditOverrideJustification(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
                      notify.error('Seleccione un aprobador autorizado.');
                      return;
                    }
                    setCreditOverrideApproved(true);
                    setShowCreditApprovalModal(false);
                    notify.success(`Crédito aprobado por ${creditOverrideAuthorizer}.`);
                  }}
                >
                  ✓ Otorgar Aprobación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APROBACIÓN / ESTADO DE SOLICITUDES DE CLIENTES */}
      <ClientApprovalsModal
        isOpen={showClientApprovalsModal}
        onClose={() => setShowClientApprovalsModal(false)}
        clients={clients}
        currentUser={currentUser}
        onApproveClient={onApproveClient}
        onRejectClient={onRejectClient}
        onOpenNewClient={() => setShowNewClientModal(true)}
      />

      {/* ========================================================================= */}
      {/* 5. MODAL: CARTERA DE CLIENTES DEL VENDEDOR (MORA, POR VENCER <=3D, SOLVENTE) */}
      {/* ========================================================================= */}
      {showClientsPortfolioModal && (
        <div
          className="clients-modal-backdrop"
          style={{ zIndex: 2450 }}
          onClick={() => setShowClientsPortfolioModal(false)}
        >
          <div
            className="clients-modal-container"
            style={{
              maxWidth: '1080px',
              width: '96%',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera Modal Cartera */}
            <div className="clients-modal-header" style={{ borderBottom: '1px solid var(--border-glass)', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={22} color="var(--neon-cyan)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Cartera de Clientes & Monitor de Crédito — {sellerName}
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Control de solvencia, días restantes para finalizar crédito, alertas ≤ 3 días y morosidad en tiempo real
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowClientsPortfolioModal(false);
                    setShowNewClientModal(true);
                  }}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px'
                  }}
                >
                  <UserPlus size={14} /> + Solicitar Nuevo Cliente
                </button>
                <button type="button" onClick={() => setShowClientsPortfolioModal(false)} className="btn btn-icon">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Sub-tabs: Cartera vs Solicitudes Enviadas */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '0.65rem 1.25rem',
              borderBottom: '1px solid var(--border-glass)',
              background: 'rgba(0,0,0,0.12)'
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPortfolioTab('CARTERA')}
                  className="btn btn-sm"
                  style={{
                    background: portfolioTab === 'CARTERA' ? 'rgba(0, 240, 255, 0.16)' : 'transparent',
                    color: portfolioTab === 'CARTERA' ? 'var(--neon-cyan)' : 'var(--text-muted)',
                    border: `1px solid ${portfolioTab === 'CARTERA' ? 'var(--neon-cyan)' : 'var(--border-glass)'}`,
                    fontWeight: 800
                  }}
                >
                  📋 Cartera de Clientes ({portfolioKpis.total})
                </button>
                <button
                  type="button"
                  onClick={() => setPortfolioTab('SOLICITUDES')}
                  className="btn btn-sm"
                  style={{
                    background: portfolioTab === 'SOLICITUDES' ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                    color: portfolioTab === 'SOLICITUDES' ? '#34d399' : 'var(--text-muted)',
                    border: `1px solid ${portfolioTab === 'SOLICITUDES' ? '#10b981' : 'var(--border-glass)'}`,
                    fontWeight: 800
                  }}
                >
                  🆕 Solicitudes Enviadas a Flujo Comercial ({sellerClientRequests.length})
                </button>
              </div>

              {portfolioTab === 'CARTERA' && assignedClientsCount > 0 && (
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <button
                    type="button"
                    onClick={() => setPortfolioScope('MIS_CLIENTES')}
                    className="btn btn-sm"
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      background: effectivePortfolioScope === 'MIS_CLIENTES' ? 'var(--neon-cyan)' : 'transparent',
                      color: effectivePortfolioScope === 'MIS_CLIENTES' ? '#0f172a' : 'var(--text-muted)',
                      fontWeight: 800,
                      border: 'none'
                    }}
                  >
                    Mis Asignados ({assignedClientsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortfolioScope('TODOS')}
                    className="btn btn-sm"
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      background: effectivePortfolioScope === 'TODOS' ? 'var(--neon-cyan)' : 'transparent',
                      color: effectivePortfolioScope === 'TODOS' ? '#0f172a' : 'var(--text-muted)',
                      fontWeight: 800,
                      border: 'none'
                    }}
                  >
                    Todos ({clientPortfolioEntries.length})
                  </button>
                </div>
              )}
            </div>

            {portfolioTab === 'CARTERA' ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* KPIs y Filtros Rápidos */}
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                      { id: 'ALL', label: `Todos (${portfolioKpis.total})`, color: 'var(--neon-cyan)', bg: 'rgba(56, 189, 248, 0.14)' },
                      { id: 'POR_VENCER', label: `⏳ Por Vencer ≤3d (${portfolioKpis.porVencer3d})`, color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.16)' },
                      { id: 'EN_MORA', label: `🚨 En Mora (${portfolioKpis.enMora})`, color: '#f87171', bg: 'rgba(239, 68, 68, 0.16)' },
                      { id: 'SOLVENTES', label: `✅ Solventes / Al Día (${portfolioKpis.solventes})`, color: '#34d399', bg: 'rgba(16, 185, 129, 0.16)' },
                      { id: 'BLOQUEADO', label: `⛔ Bloqueados (${portfolioKpis.bloqueados})`, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.16)' }
                    ].map((pill) => {
                      const active = portfolioStatusFilter === pill.id;
                      return (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => setPortfolioStatusFilter(pill.id)}
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            padding: '5px 11px',
                            borderRadius: '8px',
                            background: active ? pill.bg : 'rgba(255,255,255,0.03)',
                            color: active ? pill.color : 'var(--text-muted)',
                            border: `1px solid ${active ? pill.color : 'var(--border-glass)'}`
                          }}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Filtrar cartera por razón social, RIF, código, ciudad o zona..."
                      value={portfolioSearch}
                      onChange={(e) => setPortfolioSearch(e.target.value)}
                      style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                {/* Lista Scrollable de Clientes */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredPortfolioEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No hay clientes que coincidan con el filtro seleccionado.
                    </div>
                  ) : (
                    filteredPortfolioEntries.map(({ client, assignedToSeller, summary }) => {
                      const cKey = client.id || client.codigo || client.rif;
                      const isExpanded = expandedPortfolioClientId === cKey;
                      const ev = summary.evalPolicy || {};
                      const toneColors = {
                        danger: { border: 'rgba(239, 68, 68, 0.45)', bg: 'rgba(239, 68, 68, 0.14)', text: '#f87171' },
                        warning: { border: 'rgba(245, 158, 11, 0.5)', bg: 'rgba(245, 158, 11, 0.16)', text: '#fbbf24' },
                        info: { border: 'rgba(56, 189, 248, 0.45)', bg: 'rgba(56, 189, 248, 0.14)', text: '#38bdf8' },
                        success: { border: 'rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.14)', text: '#34d399' },
                        neutral: { border: 'var(--border-glass)', bg: 'rgba(148,163,184,0.1)', text: 'var(--text-muted)' }
                      };
                      const tc = toneColors[summary.badgeTone] || toneColors.neutral;

                      return (
                        <div
                          key={cKey}
                          style={{
                            border: `1px solid ${summary.enMora || summary.alerta3Dias ? tc.border : 'var(--border-glass)'}`,
                            borderRadius: '10px',
                            background: 'rgba(255,255,255,0.02)',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ flex: '1 1 260px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                  {client.nombre || client.razonSocial}
                                </strong>
                                {assignedToSeller && (
                                  <span className="badge" style={{ fontSize: '0.64rem', padding: '1px 6px', background: 'rgba(56, 189, 248, 0.14)', color: 'var(--neon-cyan)' }}>
                                    Mi Cartera
                                  </span>
                                )}
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: tc.bg,
                                  color: tc.text,
                                  border: `1px solid ${tc.border}`
                                }}>
                                  {summary.estadoLabel}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                <span>RIF: <strong style={{ color: 'var(--text-primary)' }}>{client.rif || 'N/A'}</strong></span>
                                <span>Cód: {client.codigo || client.id}</span>
                                <span>Plazo ficha: <strong>{client.diasCredito || 0}d</strong></span>
                                {client.telefono && <span><Phone size={11} style={{ display: 'inline' }} /> {client.telefono}</span>}
                                <span>Zona: {client.zonaVenta || client.zona || 'General'}</span>
                              </div>
                            </div>

                            {/* Indicadores Financieros + Vencimiento */}
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.74rem' }}>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>Límite Crédito</div>
                                <strong style={{ color: 'var(--text-primary)' }}>{formatUsd(ev.limiteCreditoUsd || 0)}</strong>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>Deuda / Saldo</div>
                                <strong style={{ color: (ev.saldoDeudorUsd || 0) > 0 ? '#f87171' : '#34d399' }}>
                                  {formatUsd(ev.saldoDeudorUsd || 0)}
                                </strong>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>Crédito Disp.</div>
                                <strong style={{ color: 'var(--semaforo-verde)' }}>{formatUsd(ev.creditoDisponibleUsd || 0)}</strong>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>Próx. Vencimiento</div>
                                <strong style={{ color: tc.text }}>
                                  {summary.proximaFechaVencimiento
                                    ? `${formatDateVe(summary.proximaFechaVencimiento)} (${summary.docProximoVencer || 'Doc'})`
                                    : 'Sin docs pendientes'}
                                </strong>
                              </div>
                            </div>

                            {/* Acciones por Cliente */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '4px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => setExpandedPortfolioClientId(isExpanded ? null : cKey)}
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                <span>Docs ({summary.documentosAbiertos.length})</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '4px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => {
                                  generateThirdPartyStatementPDF({
                                    entity: client,
                                    entityType: 'CLIENT',
                                    documents: summary.documentosAbiertos.map((d) => ({
                                      ...d,
                                      factNum: d.numeroDoc,
                                      fecEmis: d.fechaEmision,
                                      fecVenc: d.expDateIso || d.fechaVencimiento,
                                      totNetoUsd: d.montoPendienteUsd,
                                      saldoUsd: d.montoPendienteUsd,
                                      isVencida: d.diasMora > 0
                                    })),
                                    config: safeConfig,
                                    currentUser
                                  });
                                }}
                                title="Descargar Estado de Cuenta PDF"
                              >
                                <Printer size={13} /> Edo. PDF
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '4px 10px', fontWeight: 800 }}
                                onClick={() => {
                                  handleSelectClient(client);
                                  setShowClientsPortfolioModal(false);
                                  notify.info(`Cliente "${client.nombre || client.razonSocial}" seleccionado para la preventa.`);
                                }}
                              >
                                Usar en Pedido →
                              </button>
                            </div>
                          </div>

                          {/* Detalle expandido de documentos abiertos y motivo */}
                          {isExpanded && (
                            <div style={{
                              marginTop: '4px',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              background: 'rgba(15, 23, 42, 0.55)',
                              border: '1px solid var(--border-glass)',
                              fontSize: '0.73rem'
                            }}>
                              <div style={{ marginBottom: '6px', color: 'var(--text-muted)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Evaluación de política comercial:</strong> {ev.motivo}
                              </div>
                              {summary.documentosAbiertos.length === 0 ? (
                                <div style={{ color: '#34d399', fontWeight: 700 }}>✓ Sin facturas ni notas de entrega pendientes de cobro.</div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                                      <th style={{ textAlign: 'left', padding: '4px' }}>Documento</th>
                                      <th style={{ textAlign: 'left', padding: '4px' }}>Tipo</th>
                                      <th style={{ textAlign: 'center', padding: '4px' }}>Emisión</th>
                                      <th style={{ textAlign: 'center', padding: '4px' }}>Vence</th>
                                      <th style={{ textAlign: 'center', padding: '4px' }}>Días</th>
                                      <th style={{ textAlign: 'right', padding: '4px' }}>Saldo USD</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {summary.documentosAbiertos.map((d) => {
                                      const dColor = d.diasMora > 0 ? '#f87171' : (d.diasRestantes !== null && d.diasRestantes <= 3 ? '#fbbf24' : '#34d399');
                                      return (
                                        <tr key={d.id || d.numeroDoc} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                          <td style={{ padding: '4px', fontWeight: 700 }}>{d.numeroDoc}</td>
                                          <td style={{ padding: '4px', color: 'var(--text-muted)' }}>{d.tipoDoc}</td>
                                          <td style={{ padding: '4px', textAlign: 'center' }}>{formatDateVe(d.fechaEmision)}</td>
                                          <td style={{ padding: '4px', textAlign: 'center' }}>{formatDateVe(d.expDateIso || d.fechaVencimiento)}</td>
                                          <td style={{ padding: '4px', textAlign: 'center', fontWeight: 800, color: dColor }}>
                                            {d.diasMora > 0
                                              ? `${d.diasMora}d mora`
                                              : (d.diasRestantes !== null ? `${d.diasRestantes}d rest.` : '—')}
                                          </td>
                                          <td style={{ padding: '4px', textAlign: 'right', fontWeight: 800 }}>{formatUsd(d.montoPendienteUsd)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* SUB-TAB: SOLICITUDES DE NUEVO CLIENTE ENVIADAS A FLUJO COMERCIAL */
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sellerClientRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No se han enviado solicitudes de nuevos clientes a Flujo Comercial todavía.
                  </div>
                ) : (
                  sellerClientRequests.map((req) => {
                    const isApproved = req.status === 'APROBADO';
                    const isRejected = req.status === 'RECHAZADO';
                    const stColor = isApproved ? '#34d399' : isRejected ? '#f87171' : '#fbbf24';
                    const stLabel = isApproved ? '✓ APROBADO Y REGISTRADO' : isRejected ? '✕ RECHAZADO' : '⏳ PENDIENTE EN FLUJO COMERCIAL';
                    return (
                      <div
                        key={req.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: `1px solid ${isApproved ? 'rgba(16,185,129,0.4)' : isRejected ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.45)'}`,
                          background: 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{req.nombre}</strong>
                            <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', fontWeight: 700 }}>{req.solicitudDoc}</span>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              border: `1px solid ${stColor}`,
                              color: stColor
                            }}>
                              {stLabel}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            RIF: <strong>{req.rif}</strong> • Tel: {req.telefono} • Zona: {req.zonaNombre || req.zonaVenta} • Solicita: {req.diasCredito}d / {formatUsd(req.limiteCreditoUsd)}
                          </div>
                          {req.motivoRechazo && (
                            <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '3px' }}>
                              Motivo rechazo: {req.motivoRechazo}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          <div>Enviado: {formatDateVe(req.fechaSolicitud)}</div>
                          {req.aprobadoPor && <div>Revisado por: <strong>{req.aprobadoPor}</strong></div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Las alertas de vencimiento ≤ 3 días se sincronizan automáticamente con el Centro de Notificaciones.
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowClientsPortfolioModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: FORMULARIO DE NUEVO CLIENTE -> ENVÍO A FLUJO COMERCIAL          */}
      {/* ========================================================================= */}
      {showNewClientModal && (
        <div
          className="clients-modal-backdrop"
          style={{ zIndex: 2500 }}
          onClick={() => !isSubmittingNewClient && setShowNewClientModal(false)}
        >
          <div
            className="clients-modal-container"
            style={{ maxWidth: '680px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clients-modal-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={22} color="#34d399" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Solicitud de Nuevo Cliente → Flujo Comercial
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Asesor: <strong>{sellerName}</strong> ({sellerCode}) • Se enviará para revisión y aprobación gerencial
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => !isSubmittingNewClient && setShowNewClientModal(false)} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewClientRequest} style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Razón Social / Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Ej: Inversiones Lubricar C.A."
                    value={newClientForm.nombre}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>RIF / Cédula *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Ej: J-401234567"
                    value={newClientForm.rif}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, rif: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Teléfono / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Ej: 0414-1234567"
                    value={newClientForm.telefono}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, telefono: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Persona de Contacto / Responsable</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nombre del comprador o dueño"
                    value={newClientForm.responsable}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, responsable: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="correo@empresa.com"
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Zona Comercial</label>
                  <select
                    className="form-control"
                    value={newClientForm.zonaVenta}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, zonaVenta: e.target.value }))}
                  >
                    {(Array.isArray(profitZones) && profitZones.length > 0 ? profitZones : [{ coZon: '01', zonDes: '01 - Valencia / Centro' }]).map((z) => {
                      const code = z.coZon || z.id || z.codigo || '01';
                      const label = z.zonDes || z.nombre || code;
                      return <option key={code} value={code}>{label}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Ciudad / Estado</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: Valencia, Carabobo"
                    value={newClientForm.ciudad}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, ciudad: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Tipo / Segmento de Cliente</label>
                  <select
                    className="form-control"
                    value={newClientForm.tipoCliente}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, tipoCliente: e.target.value }))}
                  >
                    <option value="Mayorista">Mayorista / Lubricentro</option>
                    <option value="Detal / Taller">Detal / Taller Mecánico</option>
                    <option value="Flota / Transporte">Flota / Transporte Pesado</option>
                    <option value="Distribuidor">Distribuidor Autorizado</option>
                    <option value="Industrial">Sector Industrial / Agro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Dirección Fiscal y de Despacho *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="Av. / Calle / Galpón / Punto de referencia completo"
                  value={newClientForm.direccion}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, direccion: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'center' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Plazo Crédito Solicitado</label>
                  <select
                    className="form-control"
                    value={newClientForm.diasCredito}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, diasCredito: Number(e.target.value) }))}
                  >
                    <option value={0}>Solo Contado (0 Días)</option>
                    <option value={7}>Crédito 7 Días</option>
                    <option value={15}>Crédito 15 Días</option>
                    <option value={21}>Crédito 21 Días</option>
                    <option value={30}>Crédito 30 Días</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Límite Crédito Sugerido (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className="form-control"
                    value={newClientForm.limiteCreditoUsd}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, limiteCreditoUsd: e.target.value }))}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', paddingTop: '16px' }}>
                  <input
                    type="checkbox"
                    checked={newClientForm.esContribuyenteEspecial}
                    onChange={(e) => setNewClientForm((p) => ({ ...p, esContribuyenteEspecial: e.target.checked }))}
                  />
                  Contribuyente Especial SENIAT
                </label>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>Observaciones / Referencias Comerciales</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Referencias comerciales, volumen mensual estimado, horario de recepción..."
                  value={newClientForm.notasVendedor}
                  onChange={(e) => setNewClientForm((p) => ({ ...p, notasVendedor: e.target.value }))}
                />
              </div>

              <div style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontSize: '0.73rem',
                color: '#34d399'
              }}>
                ℹ️ Al enviar esta solicitud aparecerá inmediatamente en <strong>Flujo Comercial & Pedidos → Solicitudes de Clientes</strong> para su aprobación y alta en la cartera oficial.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={isSubmittingNewClient}
                  onClick={() => setShowNewClientModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmittingNewClient}
                  style={{
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={14} />
                  {isSubmittingNewClient ? 'Enviando...' : 'Enviar Solicitud a Flujo Comercial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
