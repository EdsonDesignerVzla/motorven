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
  Search
} from 'lucide-react';
import { formatUsd, formatBs, resolveProductUnit, resolveProductLitersPerUnit } from '../services/formatService';
import { calculateFiscalTaxes, validateRif, validateCedula } from '../services/fiscalService';
import { resolveUnitPrice, getProductWholesalePrice, isWholesaleClient, lineSubtotal, PRICE_CHANNEL } from '../services/pricingService';
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
  const [metodoPago, setMetodoPago] = useState('EFECTIVO_USD');
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

  // Cargar una Nota de Pedido directamente al carrito del POS
  const handleLoadOrderToCart = (orderToLoad) => {
    if (!orderToLoad) return;
    // 1. Vincular cliente
    const matchedClient = clients.find(
      (c) => c.rif === orderToLoad.clienteRif || c.id === orderToLoad.clienteId || c.razonSocial?.toLowerCase() === orderToLoad.clienteNombre?.toLowerCase()
    );
    if (matchedClient) {
      setSelectedClient(matchedClient);
    } else {
      setSelectedClient({
        id: orderToLoad.clienteId || 'CLI-TEMP',
        razonSocial: orderToLoad.clienteNombre || 'Cliente',
        rif: orderToLoad.clienteRif || 'J-000000000',
        tipoCliente: 'Mayorista',
        direccion: orderToLoad.direccionEntrega || 'Venezuela',
        diasCredito: 15,
        limiteCreditoUsd: 5000,
        saldoPendienteUsd: 0
      });
    }

    // 2. Establecer condición de pago si viene del pedido
    if (orderToLoad.condicionPago) {
      setCondicionPago(orderToLoad.condicionPago === 'CONTADO' ? 'CONTADO' : 'CREDITO');
    }

    // 3. Cargar renglones al carrito
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

    setActiveOrderInPOS(orderToLoad);
    setShowOrdersDrawer(false);
    notify.success(`Nota de Pedido ${orderToLoad.numeroDoc || orderToLoad.id} cargada exitosamente a caja.`);
  };

  // Si se pasa un pedido desde el exterior (ej. Pipeline), cargarlo automáticamente
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
  // temporalmente y caducan el mismo día a las 5:00 PM (17:00:00).
  // El stock real de almacén no se debita hasta que se emite la factura formal.
  // -------------------------------------------------------------------------
  const committedStockMap = useMemo(() => {
    const map = {};
    const now = new Date();
    // Corte a las 17:00:00 (5:00 PM hora local)
    if (now.getHours() >= 17) {
      // Pasadas las 5:00 PM, todas las órdenes diarias no facturadas caducan su reserva
      return map;
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;
    const todayIso = now.toISOString().slice(0, 10);

    if (!Array.isArray(orders)) return map;

    orders.forEach((order) => {
      if (!order) return;
      const st = (order.status || '').toUpperCase();
      // Órdenes activas en pipeline que comprometen stock (no facturadas ni anuladas)
      if (st !== 'PENDIENTE' && st !== 'APROBADO' && st !== 'EN_PROCESO') return;

      // Verificar fecha de emisión
      let orderDate = '';
      if (order.fecha) {
        orderDate = String(order.fecha).slice(0, 10);
      } else if (order.created_at) {
        orderDate = String(order.created_at).slice(0, 10);
      }

      // Si tiene fecha y no es hoy, ya caducó a las 5:00 PM de su día
      if (orderDate && orderDate !== todayLocal && orderDate !== todayIso) {
        return;
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
    const rawStock = Number(product.stock ?? product.stockActual ?? product.existencia ?? 0);
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
        if (committedQty > 0) {
          notify.warning(`Disponibilidad libre alcanzada (${maxAvailable} un. disponibles. Físico: ${rawStock}, Comprometido en O.C.: ${committedQty} hasta 5:00 PM)`);
        } else {
          notify.warning(`Stock máximo alcanzado (${rawStock} unidades disponibles para este producto)`);
        }
      }
    } else {
      if (maxAvailable <= 0) {
        if (committedQty > 0) {
          notify.warning(`Este lubricante tiene existencia física (${rawStock} un.) pero está totalmente comprometido en órdenes de preventa activas hasta las 5:00 PM.`);
        } else {
          notify.warning('Este lubricante no tiene existencia disponible en planta actualmente.');
        }
        return;
      }
      const precioUsd = resolveUnitPrice(product, selectedClient, PRICE_CHANNEL.MOSTRADOR);
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
      const next = prev.map(item => {
        if (item.precioPactado) return item;
        const prod = products.find(p => p.id === item.articuloId);
        if (!prod) return item;
        const precio = resolveUnitPrice(prod, selectedClient, PRICE_CHANNEL.MOSTRADOR);
        if (!(precio > 0) || precio === item.precioUsd) return item;
        changed = true;
        return { ...item, precioUsd: precio, subtotalUsd: lineSubtotal(item.cantidad, precio) };
      });
      return changed ? next : prev;
    });
  }, [products, selectedClient]);

  const updateQuantity = (articuloId, newQty) => {
    if (newQty <= 0) {
      setCartItems(cartItems.filter(item => item.articuloId !== articuloId));
      return;
    }
    const product = products.find(p => p.id === articuloId);
    const rawStock = Number(product?.stock ?? product?.stockActual ?? product?.existencia ?? 0);
    const committedQty = getProductCommittedQty(product);
    const maxAvailable = Math.max(0, rawStock - committedQty);

    if (product && newQty > maxAvailable) {
      notify.warning(`Supera la disponibilidad para venta libre (${maxAvailable} un. Físico: ${rawStock}, Comprometido en O.C.: ${committedQty} hasta 5:00 PM)`);
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
    setCartItems(cartItems.filter(item => item.articuloId !== articuloId));
  };

  const totalLitrosCarrito = cartItems.reduce((acc, item) => acc + (item.litros || 0), 0);

  const tasaBcv = Number(safeConfig.tasaDolar) || 827.73;

  // Motor Fiscal SENIAT
  const fiscalTaxes = calculateFiscalTaxes({
    items: cartItems,
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

  const handleFinalizeSale = async () => {
    if (cartItems.length === 0) {
      notify.warning('El carrito de facturación está vacío. Agregue lubricantes para continuar.');
      return;
    }

    if ((tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') && !documentoAfectado.trim()) {
      notify.warning('Según la Providencia SENIAT SNAT/2011/00071, para emitir una Nota de Crédito o Débito es obligatorio ingresar el Número de Factura Afectada.');
      return;
    }

    if (condicionPago === 'CREDITO') {
      const limite = Number(selectedClient?.limiteCreditoUsd) || 5000;
      const deuda = Number(selectedClient?.saldoDeudorUsd) || 0;
      const creditoDisponible = limite - deuda;
      if (totalUsd > creditoDisponible) {
        notify.error(`Límite de crédito excedido. Crédito disponible del cliente: ${formatUsd(creditoDisponible)}`);
        return;
      }
    }

    const salePayload = {
      tipoDoc,
      documentoAfectado: (tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') ? documentoAfectado.trim() : '',
      pedidoOrigenId: activeOrderInPOS?.id || null,
      pedidoOrigenDoc: activeOrderInPOS?.numeroDoc || activeOrderInPOS?.id || null,
      clienteId: selectedClient?.id || 'CLI-003',
      clienteNombre: selectedClient?.nombre || 'CLIENTE CONTADO / MOSTRADOR OILSTONE',
      clienteRif: selectedClient?.rif || 'V-18456789-6',
      condicionPago,
      metodoPago: condicionPago === 'CREDITO' ? 'CREDITO' : metodoPago,
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
      vendedor: activeOrderInPOS?.vendedorId || currentUser?.nombre || 'Ricardo Sánchez'
    };

    try {
      const createdSale = await onProcessSale(salePayload);
      if (createdSale) {
        setLastSaleDoc({
          ...createdSale,
          pedidoOrigenDoc: activeOrderInPOS?.numeroDoc || activeOrderInPOS?.id || null,
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
    const rawStock = Number(p.stock ?? p.stockActual ?? p.existencia ?? 0);
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

            <div style={{ display: 'flex', background: 'var(--bg-industrial)', padding: '4px', borderRadius: '14px', border: '1px solid var(--border-glass)', flexWrap: 'wrap', gap: '2px' }}>
              {['FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'NOTA_ENTREGA', 'COTIZACION'].map((tipo) => (
                <button
                  key={tipo}
                  className="btn btn-sm"
                  onClick={() => setTipoDoc(tipo)}
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
                const rawStock = Number(p.stock ?? p.stockActual ?? p.existencia ?? 0);
                const committedQty = getProductCommittedQty(p);
                const stockMin = Number(p.stockMinimo ?? p.stock_minimo ?? 10);
                const cartItem = cartItems.find(item => item.articuloId === p.id);
                const inCartQty = cartItem?.cantidad || 0;
                const maxAvailable = Math.max(0, rawStock - committedQty);
                const disponibleReal = Math.max(0, maxAvailable - inCartQty);
                const isOutOfStock = maxAvailable <= 0;
                const isLowStock = !isOutOfStock && maxAvailable <= stockMin;
                const unitLabel = getReadableUnit(p);

                const precioUsd = resolveUnitPrice(p, selectedClient, PRICE_CHANNEL.MOSTRADOR);

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

                        {/* 2. Nivel Inferior: Desglose Inteligente (Físico vs Comprometido vs En Carrito) */}
                        {(committedQty > 0 || inCartQty > 0) && (
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
                            <span style={{ color: 'var(--text-muted)' }} title="Existencia física total en bodega">
                              Físico: <strong style={{ color: 'var(--text-main)' }}>{rawStock}</strong>
                            </span>

                            {committedQty > 0 && (
                              <span
                                style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
                                title="Órdenes de preventa vigentes hoy. Caducan y se liberan automáticamente a las 5:00 PM"
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
                        )}
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
                        disabled={disponibleReal <= 0}
                        style={{
                          opacity: disponibleReal <= 0 ? 0.5 : 1,
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          padding: '5px 10px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginLeft: 'auto'
                        }}
                      >
                        <Plus size={14} /> {isOutOfStock ? (committedQty > 0 ? 'En O.C.' : 'Agotado') : (disponibleReal <= 0 ? 'Sin Cupo' : 'Añadir')}
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
          {activeOrderInPOS && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(37, 99, 235, 0.15))',
              border: '1.5px solid var(--motorven-gold)',
              borderRadius: '10px',
              padding: '6px 10px',
              marginBottom: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexShrink: 0
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--motorven-gold)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FileText size={13} /> Facturando: {activeOrderInPOS.numeroDoc || activeOrderInPOS.id}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Asesor: <strong style={{ color: 'var(--text-primary)' }}>{activeOrderInPOS.vendedorId || 'Asesor'}</strong> • {Number(activeOrderInPOS.totalLitros || 0).toFixed(1)} Lts
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveOrderInPOS(null);
                  notify.info('Nota de Pedido desvinculada de la factura.');
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.65rem', padding: '3px 7px', flexShrink: 0 }}
                title="Desvincular orden origen"
              >
                ✕ Desvincular
              </button>
            </div>
          )}

          {/* Selector de Cliente con Validación Fiscal SENIAT */}
          <div style={{ paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.6rem', minWidth: 0, width: '100%', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: 0, fontSize: '0.72rem' }}>
                <UserCheck size={14} color="var(--neon-cyan)" /> Cliente Seleccionado
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
            <div style={{ position: 'relative', width: '100%', marginBottom: '5px' }}>
              <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Buscar cliente por nombre, RIF, tipo o palabra clave..."
                value={clientSearch}
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
            {clientSearch && (
              <div style={{ fontSize: '0.64rem', color: filteredSortedClients.length ? 'var(--neon-cyan)' : 'var(--motorven-red)', marginBottom: '4px' }}>
                {filteredSortedClients.length
                  ? `${filteredSortedClients.length} cliente(s) encontrado(s)`
                  : 'Sin coincidencias para la búsqueda'}
              </div>
            )}
            <select
              className="form-control"
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, fontSize: '0.8rem', padding: '0.45rem 2rem 0.45rem 0.7rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
              value={selectedClient?.id || ''}
              onChange={(e) => {
                const c = clients.find(cl => cl.id === e.target.value);
                if (c) setSelectedClient(c);
              }}
            >
              {!selectedClient && <option value="">-- Seleccione un Cliente --</option>}
              {selectedClient && !filteredSortedClients.some(c => c.id === selectedClient.id) && (
                <option key={selectedClient.id} value={selectedClient.id}>
                  {selectedClient.nombre} ({selectedClient.rif}) - [{selectedClient.tipoCliente}]
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
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 7px', minHeight: '26px' }} onClick={() => updateQuantity(item.articuloId, item.cantidad - 1)}>-</button>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>{item.cantidad}</span>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 7px', minHeight: '26px' }} onClick={() => updateQuantity(item.articuloId, item.cantidad + 1)}>+</button>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '4px', minHeight: '26px', color: 'var(--motorven-red)', marginLeft: '2px' }} onClick={() => removeItem(item.articuloId)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formas de Pago */}
          <div style={{ marginBottom: '0.65rem', minWidth: 0, width: '100%', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.45rem' }}>
              <button
                className="btn btn-sm"
                onClick={() => setCondicionPago('CONTADO')}
                style={{
                  background: condicionPago === 'CONTADO' ? 'var(--motorven-emerald)' : 'var(--bg-btn-secondary)',
                  color: condicionPago === 'CONTADO' ? '#fff' : 'var(--text-primary)',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.76rem'
                }}
              >
                Pago Contado
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setCondicionPago('CREDITO')}
                style={{
                  background: condicionPago === 'CREDITO' ? 'var(--motorven-gold)' : 'var(--bg-btn-secondary)',
                  color: condicionPago === 'CREDITO' ? '#fff' : 'var(--text-primary)',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.76rem'
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
              <span>Base General (16%):</span>
              <span>{formatUsd(fiscalTaxes.baseGeneralUsd)} ({formatBs(fiscalTaxes.baseGeneralBs)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>IVA General (16%):</span>
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
            <CheckCircle size={18} /> REALIZAR PEDIDO
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
                    {formatUsd(resolveUnitPrice(selectedSpecProduct, selectedClient, PRICE_CHANNEL.MOSTRADOR))}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)' }}>
                    {formatBs(resolveUnitPrice(selectedSpecProduct, selectedClient, PRICE_CHANNEL.MOSTRADOR) * (Number(safeConfig.tasaDolar) || 0))}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    ({isWholesaleClient(selectedClient) ? 'Precio Mayorista' : 'Precio Detal'})
                  </span>
                </div>

                {/* KPI de Disponibilidad en Bodega (ATP) */}
                {(() => {
                  const specRaw = Number(selectedSpecProduct.stock ?? selectedSpecProduct.stockActual ?? 0);
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
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Disponible Venta:</span>
                          <strong style={{ fontSize: '0.82rem', color: isZero ? '#ef4444' : '#10b981', fontFamily: 'var(--font-code)' }}>
                            {isZero ? (specCommitted > 0 ? 'COMPROMETIDO EN O.C.' : 'AGOTADO / SIN STOCK') : `${specDisp} ${unitLabel}`}
                          </strong>
                        </div>
                        {(selectedSpecProduct.litrosPorUnidad || 0) > 0 && specDisp > 0 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                            {(specDisp * (selectedSpecProduct.litrosPorUnidad || 1)).toFixed(0)} Lts. Libres
                          </span>
                        )}
                      </div>
                      {specCommitted > 0 && (
                        <div style={{ fontSize: '0.67rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', paddingTop: '4px', marginTop: '2px' }}>
                          <Clock size={11} color="#f59e0b" />
                          <span>Físico: <strong>{specRaw}</strong> | Comprometido en O.C.: <strong>{specCommitted}</strong> (vence 5:00 PM)</span>
                        </div>
                      )}
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
                                title="Esta nota de pedido superó las 5:00 PM sin facturarse; su reserva de stock se liberó automáticamente."
                              >
                                <Clock size={10} /> Reserva Liberada (5 PM)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Emisión: {ord.fechaEmision ? new Date(ord.fechaEmision).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
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
                <span>Las notas de pedido no facturadas liberan su stock automáticamente a las 5:00 PM.</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowOrdersDrawer(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
