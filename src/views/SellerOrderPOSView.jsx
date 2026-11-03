import React, { useState, useMemo, useEffect } from 'react';
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
  Zap
} from 'lucide-react';
import { formatUsd, formatBs, resolveProductUnit, resolveProductLitersPerUnit } from '../services/formatService';
import { resolveUnitPrice, lineSubtotal, PRICE_CHANNEL } from '../services/pricingService';
import {
  resolveCreditDaysFromTerm,
  calculateExpirationDate,
  formatDateVe,
  evaluateClientCreditPolicy,
  getAuthorizedApproverGroups
} from '../services/creditPolicyService';
import { generateSellerOrderPDF } from '../services/pdfReportService';
import OilstoneProductImage from '../components/OilstoneProductImage';
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
  onProceedToPOS,
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
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [condicionPago, setCondicionPago] = useState('CONTADO');
  const [orderNotes, setOrderNotes] = useState('');
  const [cartItems, setCartItems] = useState([]); // [{ product, cantidad, precioUsd, subtotalUsd, litros }]
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [productSearch, setProductSearch] = useState('');
  const [selectedSpecProduct, setSelectedSpecProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [lastEmittedOrder, setLastEmittedOrder] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
  // Fórmula: D = max(0, Stock Físico - Comprometido Hoy - En Carrito)
  // -------------------------------------------------------------------------
  const committedStockMap = useMemo(() => {
    const map = {};
    const now = new Date();
    // Corte estricto a las 17:00:00 (5:00 PM)
    if (now.getHours() >= 17) {
      return map;
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;
    const todayIso = now.toISOString().slice(0, 10);

    if (!Array.isArray(orders)) return map;

    orders.forEach((ord) => {
      if (!ord) return;
      const st = (ord.status || '').toUpperCase();
      if (st !== 'PENDIENTE' && st !== 'APROBADO' && st !== 'EN_PROCESO') return;

      let orderDate = '';
      if (ord.fechaEmision) orderDate = String(ord.fechaEmision).slice(0, 10);
      else if (ord.fecha) orderDate = String(ord.fecha).slice(0, 10);
      else if (ord.created_at) orderDate = String(ord.created_at).slice(0, 10);

      if (orderDate && orderDate !== todayLocal && orderDate !== todayIso) return;

      const items = ord.items || ord.renglones || [];
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

  // Consulta de stock comprometido vigente
  const getProductCommittedQty = (p) => {
    if (!p) return 0;
    const keyId = p.id;
    const keyCode = p.codigo;
    return (committedStockMap[keyId] || 0) + (keyCode && keyCode !== keyId ? (committedStockMap[keyCode] || 0) : 0);
  };

  // Clientes asignados al vendedor o lista completa filtrable
  const filteredClients = useMemo(() => {
    if (!Array.isArray(clients)) return [];
    if (!clientSearchText.trim()) {
      // Priorizar clientes asignados a este asesor o mostrar los primeros 25
      return clients.slice(0, 30);
    }
    const q = clientSearchText.toLowerCase().trim();
    return clients.filter((c) => {
      const nom = (c.nombre || c.razonSocial || c.cli_des || '').toLowerCase();
      const rif = (c.rif || c.co_cli || '').toLowerCase();
      const cod = (c.id || c.codigo || '').toLowerCase();
      return nom.includes(q) || rif.includes(q) || cod.includes(q);
    });
  }, [clients, clientSearchText]);

  // Selección automática de dirección al cambiar cliente
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setCreditOverrideApproved(false);
    setCreditOverrideJustification('');
    setDeliveryAddress(client?.domicilioFiscal || client?.direccion || 'Zona Industrial Valencia, Edo. Carabobo');
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

  // Métodos del carrito
  const addToCart = (product, addQty = 1) => {
    const rawStock = Number(product.stock ?? product.stockActual ?? product.existencia ?? 0);
    const committed = getProductCommittedQty(product);
    const inCartItem = cartItems.find((it) => it.product.id === product.id);
    const currentInCart = inCartItem ? inCartItem.cantidad : 0;
    const atpLibre = Math.max(0, rawStock - committed - currentInCart);

    if (atpLibre <= 0) {
      notify.warning(`No hay disponibilidad libre para agregar más unidades de ${product.codigo}. (Físico: ${rawStock}, Comprometido hoy: ${committed})`);
      return;
    }

    const qtyToAdd = Math.min(addQty, atpLibre);
    const precio = resolveUnitPrice(product, selectedClient, PRICE_CHANNEL.PREVENTA);
    if (!(precio > 0)) {
      notify.warning(`El producto ${product.codigo || ''} no tiene precio de venta configurado en Inventario.`);
      return;
    }
    const litrosUnit = resolveProductLitersPerUnit(product);

    if (inCartItem) {
      setCartItems(
        cartItems.map((it) => {
          if (it.product.id === product.id) {
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

  // Sincronización automática: si el precio cambia en Inventario, el carrito de preventa se actualiza
  useEffect(() => {
    setCartItems(prev => {
      let changed = false;
      const next = prev.map(it => {
        const fresh = (products || []).find(p => p && p.id === it.product?.id);
        if (!fresh) return it;
        const precio = resolveUnitPrice(fresh, selectedClient, PRICE_CHANNEL.PREVENTA);
        if (!(precio > 0) || precio === it.precioUsd) return it;
        changed = true;
        return { ...it, product: fresh, precioUsd: precio, subtotalUsd: lineSubtotal(it.cantidad, precio) };
      });
      return changed ? next : prev;
    });
  }, [products, selectedClient]);

  const updateCartQty = (productId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const inCartItem = cartItems.find((it) => it.product.id === productId);
    if (!inCartItem) return;

    const product = inCartItem.product;
    const rawStock = Number(product.stock ?? product.stockActual ?? product.existencia ?? 0);
    const committed = getProductCommittedQty(product);
    const maxAvailable = Math.max(0, rawStock - committed);

    if (newQty > maxAvailable) {
      notify.warning(`La cantidad solicitada (${newQty}) excede la disponibilidad (${maxAvailable} disponibles).`);
      return;
    }

    const litrosUnit = resolveProductLitersPerUnit(product);
    setCartItems(
      cartItems.map((it) => {
        if (it.product.id === productId) {
          return {
            ...it,
            cantidad: newQty,
            subtotalUsd: lineSubtotal(newQty, it.precioUsd),
            litros: newQty * litrosUnit
          };
        }
        return it;
      })
    );
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

    setIsSubmitting(true);
    const orderCorrelativo = `PED-${Date.now().toString().slice(-6)}`;
    const effectiveStatus = isCreditDenied ? 'RETENIDO_CREDITO' : 'APROBADO';
    const nowIso = new Date().toISOString();
    const expIso = calculateExpirationDate(nowIso, diasCreditoActual).toISOString();

    const orderPayload = {
      id: orderCorrelativo,
      numeroDoc: orderCorrelativo,
      correlativo: orderCorrelativo,
      modalidadVenta,
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
      observaciones: orderNotes || (modalidadVenta === 'OFICINA' ? 'Venta por Oficina enviada a Caja.' : 'Preventa móvil levantada en campo por asesor comercial.'),
      notas: orderNotes || (modalidadVenta === 'OFICINA' ? 'Venta por Oficina enviada a Caja.' : 'Preventa móvil levantada en campo por asesor comercial.'),
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
        notify.success(`¡Nota de Pedido ${orderCorrelativo} enviada a Caja exitosamente!`);
      }
    } catch (err) {
      console.error('Error emitiendo pedido:', err);
      notify.error('Error al registrar la preventa: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pedidos del vendedor emitidos hoy
  const sellerTodayOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const nowStr = new Date().toISOString().slice(0, 10);
    return orders.filter((o) => {
      if (!o) return false;
      const isSeller =
        (o.vendedorId && o.vendedorId.toLowerCase().includes(sellerName.toLowerCase())) ||
        (o.vendedorCoVen && o.vendedorCoVen === sellerCode);
      const orderDate = (o.fechaEmision || o.fecha || o.created_at || '').slice(0, 10);
      return isSeller || orderDate === nowStr;
    });
  }, [orders, sellerName, sellerCode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* ========================================================================= */}
      {/* 1. ENCABEZADO SUPERIOR: TERMINAL DE PREVENTA MÓVIL (ESTILO NATIVO) */}
      {/* ========================================================================= */}
      <div className="page-header-responsive" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: 'clamp(1.15rem, 3.5vw, 1.55rem)' }}>
            <Smartphone size={28} color="var(--motorven-red)" /> Terminal de Preventa Móvil OILSTONE ®
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Toma ágil de pedidos en calle • Reserva ATP garantizada hasta 5:00 PM • Cero retipeo en Caja
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

      {/* ========================================================================= */}
      {/* 2. CUERPO PRINCIPAL: pos-grid-layout (Catálogo 1.6fr / Resumen 1fr) */}
      {/* ========================================================================= */}
      <div className="pos-grid-layout" style={{ alignItems: 'start' }}>
        
        {/* COLUMNA IZQUIERDA: CLIENTE + BUSCADOR + GRILLA DE PRODUCTOS */}
        <div className="pos-catalog-col" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* SELECCIÓN Y FICHA DEL CLIENTE */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', background: 'var(--bg-card-glass)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <User size={14} /> 1. Cliente Destinatario de la Preventa
              </label>
              {selectedClient && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setIsClientDropdownOpen(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.7rem', padding: '3px 10px', color: 'var(--neon-cyan)' }}
                >
                  Cambiar Cliente
                </button>
              )}
            </div>

            {!selectedClient ? (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Buscar cliente por nombre, RIF o código..."
                    value={clientSearchText}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    onChange={(e) => {
                      setClientSearchText(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    style={{ paddingLeft: '36px', fontSize: '0.85rem', width: '100%' }}
                  />
                </div>

                {isClientDropdownOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                      onClick={() => setIsClientDropdownOpen(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      maxHeight: '260px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-glass-highlight, rgba(56, 189, 248, 0.4))',
                      borderRadius: '10px',
                      background: 'var(--surface-card, #ffffff)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                      zIndex: 50
                    }}>
                      {filteredClients.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          No se encontraron clientes con "{clientSearchText}".
                        </div>
                      ) : (
                        filteredClients.map((cl) => (
                          <div
                            key={cl.id || cl.codigo || cl.rif}
                            onClick={() => {
                              handleSelectClient(cl);
                              setIsClientDropdownOpen(false);
                            }}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--border-glass)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover, rgba(0,43,122,0.06))')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {cl.nombre || cl.razonSocial || cl.cli_des}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                RIF: {cl.rif || cl.co_cli} • Zona: {cl.zona || 'General'}
                              </div>
                            </div>
                            <ChevronRight size={14} color="var(--text-muted)" />
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
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--semaforo-verde)', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: '0.74rem', fontWeight: 800, padding: '6px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Package size={14} /> {filteredProducts.length} Disponibles
              </span>
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
            {filteredProducts.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Package size={42} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>No se encontraron lubricantes</div>
                <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>Intente con otra viscosidad o categoría.</div>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const rawStock = Number(p.stock ?? p.stockActual ?? p.existencia ?? 0);
                const committed = getProductCommittedQty(p);
                const inCartItem = cartItems.find((it) => it.product.id === p.id);
                const currentInCart = inCartItem ? inCartItem.cantidad : 0;
                const atpLibre = Math.max(0, rawStock - committed - currentInCart);
                const isOutOfStock = atpLibre <= 0;
                const precioUsd = resolveUnitPrice(p, selectedClient, PRICE_CHANNEL.PREVENTA);
                const litrosUnit = Number(p.litrosPorUnidad || 0);

                return (
                  <div
                    key={p.id || p.codigo}
                    style={{
                      background: 'var(--bg-card-glass)',
                      border: currentInCart > 0 ? '1.5px solid var(--neon-cyan)' : '1px solid var(--border-glass)',
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

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.68rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{resolveProductUnit(p, 'Caja')}</span>
                        <span style={{
                          color: isOutOfStock ? 'var(--motorven-red)' : 'var(--semaforo-verde)',
                          fontWeight: 800
                        }}>
                          {isOutOfStock ? (committed > 0 ? 'Comprometido Hoy' : 'Agotado') : `Disp: ${atpLibre} un.`}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Precios y Botones Táctiles +/- */}
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                          {formatUsd(precioUsd)}
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
                          disabled={isOutOfStock}
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
                            opacity: isOutOfStock ? 0.4 : 1
                          }}
                        >
                          <Plus size={13} /> {currentInCart === 0 ? 'Añadir' : currentInCart}
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
            
            {/* Selector de Modalidad: Preventa Móvil vs Venta por Oficina */}
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
                <Smartphone size={13} /> Preventa Calle
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
                <Building2 size={13} /> Venta por Oficina
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
                  Total {modalidadVenta === 'OFICINA' ? 'Venta Oficina' : 'Preventa'}:
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

            {/* BOTONES DE ACCIÓN PRINCIPAL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                disabled={isSubmitting || cartItems.length === 0 || !selectedClient}
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
                    : 'linear-gradient(135deg, var(--motorven-red), #b91c1c)',
                  boxShadow: '0 4px 16px rgba(220, 38, 38, 0.4)',
                  opacity: cartItems.length === 0 || !selectedClient ? 0.5 : 1
                }}
              >
                <Send size={17} />
                <span>{isCreditDenied ? 'SOLICITAR APROBACIÓN A CAJA' : '🚀 EMITIR NOTA DE PEDIDO A CAJA'}</span>
              </button>

              {!isCreditDenied && onProceedToPOS && (
                <button
                  type="button"
                  disabled={isSubmitting || cartItems.length === 0 || !selectedClient}
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
                    opacity: cartItems.length === 0 || !selectedClient ? 0.5 : 1
                  }}
                >
                  <Zap size={15} /> Emitir y Abrir Directamente en POS de Caja
                </button>
              )}
            </div>

            {/* Aviso de Reserva */}
            <div style={{ fontSize: '0.68rem', color: 'var(--motorven-gold)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Clock size={11} />
              <span>Reserva stock automáticamente hasta las 5:00 PM de hoy.</span>
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
              ¡Nota de Pedido Emitida Exitosamente!
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
              <span>Plazo: <strong>{lastEmittedOrder.diasCredito || 0} Días</strong></span>
              <span>Vencimiento: <strong style={{ color: 'var(--motorven-gold)' }}>{formatDateVe(lastEmittedOrder.fechaVencimiento)}</strong></span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '8px 0 14px', lineHeight: '1.5' }}>
              La orden para <strong>{lastEmittedOrder.clienteNombre}</strong> ({lastEmittedOrder.totalLitros.toFixed(1)} Lts • {formatUsd(lastEmittedOrder.totalNetoUsd)}) ya se encuentra en la <strong>bandeja de entrada de la Cajera en planta</strong> con restricción de <strong>NO MODIFICAR</strong>.
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
                  const textMsg = `*SIGNUM MOTORVEN* - Nota de Pedido ${lastEmittedOrder.numeroDoc}\nCliente: ${lastEmittedOrder.clienteNombre}\nEmisión: ${formatDateVe(lastEmittedOrder.fechaEmision)} | Vencimiento: ${formatDateVe(lastEmittedOrder.fechaVencimiento)}\nVolumen: ${lastEmittedOrder.totalLitros.toFixed(1)} Litros\nTotal: ${formatUsd(lastEmittedOrder.totalNetoUsd)} (Bs. ${formatBs(lastEmittedOrder.totalBs)})\nAsesor: ${sellerName}\n_Reserva activa en almacén hasta las 5:00 PM._`;
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
                    {formatUsd(resolveUnitPrice(selectedSpecProduct, selectedClient, PRICE_CHANNEL.PREVENTA))}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)' }}>
                    {formatBs(resolveUnitPrice(selectedSpecProduct, selectedClient, PRICE_CHANNEL.PREVENTA) * tasaBcv)}
                  </span>
                </div>
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
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ background: 'linear-gradient(135deg, var(--motorven-red), #b91c1c)' }}
                onClick={() => {
                  addToCart(selectedSpecProduct, 1);
                  setSelectedSpecProduct(null);
                }}
              >
                <Plus size={14} style={{ marginRight: '4px' }} /> Agregar a Preventa
              </button>
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
                    Auditoría & Aprobación de Crédito ({modalidadVenta === 'OFICINA' ? 'Venta por Oficina' : 'Nota de Pedido'})
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

    </div>
  );
}
