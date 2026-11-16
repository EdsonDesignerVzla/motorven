import React, { useState, useMemo } from 'react';
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  Users,
  ChevronRight,
  ArrowRight,
  Printer,
  FileText,
  Building2,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  X,
  LayoutGrid,
  List,
  Layers,
  Send,
  Trash2,
  RefreshCw,
  ExternalLink,
  Lock
} from 'lucide-react';
import {
  formatUsd,
  formatBs,
  formatUnitVe,
  resolveProductUnit,
  resolveProductLitersPerUnit,
  getProductWarehouseStocks,
  validateWarehouseStockForDocument
} from '../services/formatService';
import { getProductWholesalePrice, lineSubtotal } from '../services/pricingService';
import {
  SENIAT_CONTRIBUTOR_TYPES,
  resolveClientContributorType,
  computeContributorTypeCounts
} from '../services/fiscalService';
import DispatchRouteModal from '../components/DispatchRouteModal';
import { isMasterOrGerencia, isClientApproved } from '../services/authService';
import { generateOrdersPDF, generateSellerOrderPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

const STATUS_CONFIG = {
  PENDIENTE: {
    label: '1. Nota de Pedido (Vendedor)',
    color: 'var(--motorven-gold)',
    bg: 'var(--semaforo-amarillo-bg)',
    badgeClass: 'badge-warning',
    step: 1
  },
  APROBADO: {
    label: '2. En Caja (Por Facturar)',
    color: 'var(--motorven-navy-light)',
    bg: 'rgba(37, 99, 235, 0.15)',
    badgeClass: 'badge-primary',
    step: 2
  },
  FACTURADO: {
    label: '3. Facturado (O.E. Generada)',
    color: 'var(--semaforo-verde)',
    bg: 'var(--semaforo-verde-bg)',
    badgeClass: 'badge-success',
    step: 3
  },
  EN_TRANSITO: {
    label: '4. En Tránsito / Despachado',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.15)',
    badgeClass: 'badge-info',
    step: 4
  },
  RETENIDO_CREDITO: {
    label: 'Retenido por Crédito',
    color: 'var(--motorven-red)',
    bg: 'var(--semaforo-rojo-bg)',
    badgeClass: 'badge-danger',
    step: 0
  },
  ANULADO: {
    label: 'Anulado',
    color: 'var(--text-muted)',
    bg: 'var(--bg-tertiary)',
    badgeClass: 'badge-neutral',
    step: 0
  }
};

export default function OrdersPipelineView({
  orders = [],
  clients = [],
  products = [],
  config = {},
  profitZones = [],
  profitTransports = [],
  onSaveOrder,
  onUpdateOrderStatus,
  onProceedToInvoice,
  onSyncProfit,
  onOpenOrdersSalesModal,
  currentUser
}) {
  const notify = useNotification();
  const safeOrders = useMemo(() => Array.isArray(orders) ? orders : [], [orders]);
  const safeClients = useMemo(() => Array.isArray(clients) ? clients : [], [clients]);
  const clientsByLookup = useMemo(() => {
    const map = new Map();
    for (const c of safeClients) {
      if (!c) continue;
      if (c.id) map.set(`ID:${String(c.id).trim()}`, c);
      if (c.codigo) map.set(`ID:${String(c.codigo).trim()}`, c);
      if (c.rif) map.set(`RIF:${String(c.rif).trim().toUpperCase()}`, c);
      if (c.nombre) map.set(`NOM:${String(c.nombre).trim().toLowerCase()}`, c);
    }
    return map;
  }, [safeClients]);
  const findOrderClient = (o) => {
    if (!o) return null;
    return (
      (o.clienteId && clientsByLookup.get(`ID:${String(o.clienteId).trim()}`)) ||
      (o.clienteRif && clientsByLookup.get(`RIF:${String(o.clienteRif).trim().toUpperCase()}`)) ||
      (o.clienteNombre && clientsByLookup.get(`NOM:${String(o.clienteNombre).trim().toLowerCase()}`)) ||
      null
    );
  };
  const approvedClients = useMemo(() => safeClients.filter(c => isClientApproved(c)), [safeClients]);
  const [newOrderClientTypeFilter, setNewOrderClientTypeFilter] = useState('ALL');
  const newOrderContributorCounts = useMemo(
    () => computeContributorTypeCounts(approvedClients),
    [approvedClients]
  );
  const filteredNewOrderClients = useMemo(() => {
    if (newOrderClientTypeFilter === 'ALL') return approvedClients;
    return approvedClients.filter(c => resolveClientContributorType(c) === newOrderClientTypeFilter);
  }, [approvedClients, newOrderClientTypeFilter]);
  const safeProducts = useMemo(() => Array.isArray(products) ? products : [], [products]);
  const safeProfitZones = useMemo(() => Array.isArray(profitZones) ? profitZones : [], [profitZones]);
  const safeProfitTransports = useMemo(() => Array.isArray(profitTransports) ? profitTransports : [], [profitTransports]);

  const [viewMode, setViewMode] = useState('KANBAN'); // 'KANBAN' | 'TABLE' | 'ROUTES'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');

  // Modales
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRouteData, setSelectedRouteData] = useState(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Formulario Nuevo Pedido
  const [newOrderClient, setNewOrderClient] = useState('');
  const [newOrderSeller, setNewOrderSeller] = useState(currentUser?.nombre || 'Vendedor Directo');
  const [newOrderDir, setNewOrderDir] = useState('');
  const [newOrderComments, setNewOrderComments] = useState('');
  const [newOrderModalidad, setNewOrderModalidad] = useState('PREVENTA');
  const [newOrderItems, setNewOrderItems] = useState([
    { articuloId: '', cantidad: 1, precioUsd: 0, unidad: 'Caja (12L)' }
  ]);

  const newOrderActiveWh = newOrderModalidad === 'OFICINA' ? '02' : '01';
  const newOrderWarehouseCheck = useMemo(() => {
    const selectedItems = newOrderItems.filter(it => it.articuloId);
    if (selectedItems.length === 0) {
      return {
        isValid: true,
        zeroStockItems: [],
        invalidQtyItems: [],
        warehouseCode: newOrderActiveWh,
        message: ''
      };
    }
    return validateWarehouseStockForDocument({
      items: selectedItems,
      products: safeProducts,
      tipoDoc: newOrderModalidad === 'OFICINA' ? 'NOTA_ENTREGA' : 'FACTURA',
      almacen: newOrderActiveWh,
      modalidadVenta: newOrderModalidad
    });
  }, [newOrderItems, safeProducts, newOrderModalidad, newOrderActiveWh]);

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  // Extraer Zonas y Vendedores disponibles
  const availableZones = useMemo(() => {
    const set = new Set();
    safeProfitZones.forEach(z => { if (z && (z.coZon || z.co_zon)) set.add(z.coZon || z.co_zon); });
    safeOrders.forEach(o => { if (o && o.zonaVenta) set.add(o.zonaVenta); });
    return Array.from(set).sort();
  }, [safeProfitZones, safeOrders]);

  // Planificador logístico de rutas por zona
  const zoneLogistics = useMemo(() => {
    const baseZones = safeProfitZones.length > 0 ? safeProfitZones : [
      { coZon: '01', zonDes: 'Valencia Norte (San José, Prebo, Trigal, Guaparo)' },
      { coZon: '02', zonDes: 'Isabelica - Pque Valencia - Flor Amarillo - Güigüe' },
      { coZon: '03', zonDes: 'San Diego - Naguanagua' },
      { coZon: '04', zonDes: 'Zona Sur de Valencia (Santa Rosa a Los Caobos)' },
      { coZon: '05', zonDes: 'Eje Occidental (Tocuyito, Bejuma, Montalbán)' },
      { coZon: '06', zonDes: 'Eje Oriental (Guacara, San Joaquín, Mariara)' },
      { coZon: '07', zonDes: 'Carabobo General' }
    ];

    return baseZones.map(z => {
      const zCode = ((z && (z.coZon || z.co_zon)) || '').trim();
      const zDesc = ((z && (z.zonDes || z.zon_des)) || '').trim();

      const matchingOrders = safeOrders.filter(o => {
        if (!o) return false;
        const oZone = (o.zonaVenta || '').trim();
        if (oZone && oZone === zCode) return true;
        const matchedCli = findOrderClient(o);
        if (matchedCli && ((matchedCli.zona_venta && matchedCli.zona_venta.trim() === zCode) || (matchedCli.zonaVenta && matchedCli.zonaVenta.trim() === zCode))) return true;
        return false;
      });

      const totalLts = matchingOrders.reduce((acc, o) => acc + Number(o?.totalLitros || 0), 0);
      const totalCjs = matchingOrders.reduce((acc, o) => acc + Number(o?.totalCajas || 0), 0);
      const totalUsd = matchingOrders.reduce((acc, o) => acc + Number(o?.totalNetoUsd || 0), 0);
      const pendingCount = matchingOrders.filter(o => o && (o.status === 'PENDIENTE' || o.status === 'APROBADO' || o.status === 'EN_TRANSITO')).length;

      return {
        coZon: zCode,
        zonDes: zDesc,
        orders: matchingOrders,
        pendingCount,
        totalOrders: matchingOrders.length,
        totalLitros: totalLts,
        totalCajas: totalCjs,
        totalUsd
      };
    });
  }, [safeProfitZones, safeOrders, safeClients]);

  const availableSellers = useMemo(() => {
    const set = new Set();
    safeOrders.forEach(o => { if (o && o.vendedorId) set.add(o.vendedorId); });
    return Array.from(set).sort();
  }, [safeOrders]);

  // Filtrado de pedidos
  const filteredOrders = useMemo(() => {
    return safeOrders.filter(o => {
      if (!o) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchNum = (o.numeroDoc || o.id || '').toLowerCase().includes(s);
        const matchCli = (o.clienteNombre || '').toLowerCase().includes(s);
        const matchRif = (o.clienteRif || '').toLowerCase().includes(s);
        const matchVen = (o.vendedorId || '').toLowerCase().includes(s);
        const matchZone = (o.zonaVenta || '').toLowerCase().includes(s);
        if (!matchNum && !matchCli && !matchRif && !matchVen && !matchZone) return false;
      }
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (sellerFilter !== 'ALL' && o.vendedorId !== sellerFilter) return false;
      if (zoneFilter !== 'ALL' && o.zonaVenta !== zoneFilter) return false;
      return true;
    });
  }, [safeOrders, searchTerm, statusFilter, sellerFilter, zoneFilter]);

  // Agrupación por columnas Kanban (Flujo: Orden Compra -> En Caja -> Facturado -> Despacho)
  const kanbanColumns = useMemo(() => {
    return {
      PENDIENTE: filteredOrders.filter(o => !o.status || o.status === 'PENDIENTE' || o.status === 'COTIZACION' || o.status === 'PREVENTA' || o.status === 'ORDEN_COMPRA'),
      APROBADO: filteredOrders.filter(o => o.status === 'APROBADO' || o.status === 'EN_CAJA'),
      FACTURADO: filteredOrders.filter(o => o.status === 'FACTURADO'),
      EN_TRANSITO: filteredOrders.filter(o => o.status === 'EN_TRANSITO' || o.status === 'ENTREGADO'),
      RETENIDO_CREDITO: filteredOrders.filter(o => o.status === 'RETENIDO_CREDITO' || o.status === 'ANULADO')
    };
  }, [filteredOrders]);

  // Métricas del Pipeline
  const totalOrdersCount = safeOrders.length;
  const activeOrders = safeOrders.filter(o => o && o.status !== 'FACTURADO' && o.status !== 'ANULADO');
  const totalLitrosEnCola = activeOrders.reduce((acc, o) => acc + (Number(o.totalLitros) || 0), 0);
  const totalCajasEnCola = activeOrders.reduce((acc, o) => acc + (Number(o.totalCajas) || (Number(o.totalLitros) / 11.35) || 0), 0);
  const totalMontoColaUsd = activeOrders.reduce((acc, o) => acc + (Number(o.totalNetoUsd) || 0), 0);
  const pedidosRiesgoCredito = activeOrders.filter(o => {
    const client = findOrderClient(o);
    return client && (client.sinCredito || (Number(client.saldoDeudorUsd) || 0) > (Number(client.limiteCreditoUsd) || 0));
  }).length;

  // Cambiar estado rápido
  const handleStatusChange = async (orderId, newStatus) => {
    if (onUpdateOrderStatus) {
      await onUpdateOrderStatus(orderId, newStatus);
    }
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus, estado: newStatus } : null);
    }
  };

  // Facturar en POS
  const handleFacturarEnPOS = (order) => {
    if (!order) return;
    if (['FACTURADO', 'ANULADO', 'ANULADA', 'RECHAZADO', 'CANCELADO', 'CADUCADO'].includes(String(order.status || '').toUpperCase().trim())) {
      notify.error(`El pedido ${order.numeroDoc || order.id} ya se encuentra ${order.status} y no puede enviarse a facturación.`);
      return;
    }
    if (onProceedToInvoice) {
      onProceedToInvoice(order);
    }
  };

  // Exportar CSV
  const exportPipelineCsv = () => {
    const headers = [
      'Numero_Documento',
      'Tipo_Documento',
      'Fecha_Emision',
      'Cliente_ID',
      'Cliente_Nombre',
      'Cliente_RIF',
      'Vendedor',
      'Zona_Venta',
      'Total_Litros',
      'Total_Cajas',
      'Total_Neto_USD',
      'Total_Neto_BS',
      'Estado',
      'Direccion_Entrega',
      'Comentarios'
    ];

    const rows = filteredOrders.map(o => [
      `"${o.numeroDoc || o.id}"`,
      `"${o.tipoDoc || 'COTIZACION'}"`,
      `"${o.fechaEmision ? new Date(o.fechaEmision).toLocaleDateString() : ''}"`,
      `"${o.clienteId || ''}"`,
      `"${(o.clienteNombre || '').replace(/"/g, '""')}"`,
      `"${o.clienteRif || ''}"`,
      `"${o.vendedorId || ''}"`,
      `"${o.zonaVenta || ''}"`,
      o.totalLitros || 0,
      o.totalCajas || 0,
      o.totalNetoUsd || 0,
      (Number(o.totalNetoUsd || 0) * tasaBcv).toFixed(2),
      `"${o.status || 'PENDIENTE'}"`,
      `"${(o.direccionEntrega || '').replace(/"/g, '""')}"`,
      `"${(o.comentarios || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pipeline_Pedidos_Preventa_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ paddingBottom: '3rem' }}>
      
      {/* ========================================================================= */}
      {/* 1. CABECERA PRINCIPAL */}
      {/* ========================================================================= */}
      <div className="page-header-responsive" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'clamp(1.2rem, 3vw, 1.55rem)', color: 'var(--text-primary)', margin: 0 }}>
              <Truck size={28} color="var(--motorven-red)" /> Pipeline de Pedidos & Preventa
            </h1>
            <span className="badge badge-primary" style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>
              SUPABASE SYNC
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Control logístico de despachos de lubricantes OILSTONE ®, preventa de campo y cola de facturación
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={exportPipelineCsv} style={{ fontSize: '0.82rem' }}>
            <Download size={15} /> Exportar Pipeline (CSV)
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (onOpenOrdersSalesModal) onOpenOrdersSalesModal('nuevo');
              else setShowNewOrderModal(true);
            }}
            style={{ fontSize: '0.82rem', gap: '6px' }}
          >
            <Plus size={16} /> Crear Pedido / Preventa
          </button>
          <button
            className="btn btn-print-report btn-sm"
            onClick={() => generateOrdersPDF({ orders: filteredOrders, currentUser, config })}
            style={{ marginLeft: 'auto' }}
            title="Generar y descargar reporte oficial de pedidos en PDF"
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BARRA DE 4 BENTO / KPI STAT CARDS SUPERIORES */}
      {/* ========================================================================= */}
      <div className="cashflow-stats-grid" style={{ marginBottom: '1.25rem' }}>
        
        {/* KPI 1: Pedidos en Cola */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--motorven-navy-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)', color: 'var(--motorven-navy-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Pedidos en Cola
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                En Proceso
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--text-primary)' }}>
              {activeOrders.length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>de {totalOrdersCount}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {kanbanColumns.PENDIENTE.length} Preventa • {kanbanColumns.EN_TRANSITO.length} En Ruta
            </div>
          </div>
        </div>

        {/* KPI 2: Litros Comprometidos */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--motorven-gold)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--semaforo-amarillo-bg)', border: '1px solid rgba(217, 119, 6, 0.3)', color: 'var(--motorven-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Litros en Carga
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                Comprometido
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--motorven-gold)' }}>
              {formatUnitVe(totalLitrosEnCola, 2)} L
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              ≈ {formatUnitVe(totalCajasEnCola, 0)} Cajas (12L) equivalentes
            </div>
          </div>
        </div>

        {/* KPI 3: Monto en Preventa */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--semaforo-verde)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--semaforo-verde-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--semaforo-verde)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarSign size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Monto en Preventa
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                Proyectado
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--semaforo-verde)' }}>
              {formatUsd(totalMontoColaUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(totalMontoColaUsd * tasaBcv)}
            </div>
          </div>
        </div>

        {/* KPI 4: Retención / Riesgo Crediticio */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--motorven-red)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--semaforo-rojo-bg)', border: '1px solid rgba(230, 0, 18, 0.3)', color: 'var(--motorven-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Alerta de Crédito
              </span>
              <span className="badge badge-danger" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                Riesgo CxC
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--motorven-red)' }}>
              {pedidosRiesgoCredito} Pedidos
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              Clientes con saldo deudor o sin crédito
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. BARRA DE FILTROS & SELECTOR DE MODO (KANBAN VS TABLA) */}
      {/* ========================================================================= */}
      <div className="bento-card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            {/* Input de Búsqueda */}
            <div className="search-wrapper" style={{ minWidth: '220px', flex: '1 1 240px' }}>
              <Search size={15} />
              <input
                type="text"
                placeholder="Buscar por documento, cliente, RIF, vendedor, zona..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input"
                style={{ width: '100%', fontSize: '0.8rem', height: '36px' }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 3 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtro Estado */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input filter-select"
              style={{ width: '160px', height: '36px', fontSize: '0.8rem' }}
            >
              <option value="ALL">Estado: Todos</option>
              <option value="PENDIENTE">1. Preventa / Cotiz</option>
              <option value="APROBADO">2. Aprobados</option>
              <option value="EN_TRANSITO">3. En Tránsito</option>
              <option value="FACTURADO">4. Facturados</option>
              <option value="RETENIDO_CREDITO">Retenido Crédito</option>
            </select>

            {/* Filtro Vendedor */}
            {availableSellers.length > 0 && (
              <select
                value={sellerFilter}
                onChange={e => setSellerFilter(e.target.value)}
                className="input filter-select"
                style={{ width: '150px', height: '36px', fontSize: '0.8rem' }}
              >
                <option value="ALL">Vendedor: Todos</option>
                {availableSellers.map(v => <option key={v} value={v}>Vend: {v}</option>)}
              </select>
            )}

            {/* Filtro Zona */}
            {availableZones.length > 0 && (
              <select
                value={zoneFilter}
                onChange={e => setZoneFilter(e.target.value)}
                className="input filter-select"
                style={{ width: '150px', height: '36px', fontSize: '0.8rem' }}
              >
                <option value="ALL">Zona: Todas</option>
                {availableZones.map(z => <option key={z} value={z}>Zona: {z}</option>)}
              </select>
            )}
          </div>

          {/* Selector de Modo Kanban vs Tabla */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
            <button
              className="btn btn-sm"
              onClick={() => setViewMode('KANBAN')}
              style={{
                background: viewMode === 'KANBAN' ? 'var(--motorven-navy)' : 'transparent',
                color: viewMode === 'KANBAN' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: viewMode === 'KANBAN' ? 700 : 500,
                fontSize: '0.78rem',
                gap: '5px'
              }}
            >
              <LayoutGrid size={14} /> Tablero Kanban
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setViewMode('TABLE')}
              style={{
                background: viewMode === 'TABLE' ? 'var(--motorven-navy)' : 'transparent',
                color: viewMode === 'TABLE' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: viewMode === 'TABLE' ? 700 : 500,
                fontSize: '0.78rem',
                gap: '5px'
              }}
            >
              <List size={14} /> Tabla Detallada ({filteredOrders.length})
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setViewMode('ROUTES')}
              style={{
                background: viewMode === 'ROUTES' ? 'var(--motorven-navy)' : 'transparent',
                color: viewMode === 'ROUTES' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: viewMode === 'ROUTES' ? 700 : 500,
                fontSize: '0.78rem',
                gap: '5px'
              }}
            >
              <Truck size={14} /> Rutas & Despacho ({profitZones.length || 7})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. VISTA 1: TABLERO KANBAN POR FASES LOGÍSTICAS */}
      {/* ========================================================================= */}
      {viewMode === 'KANBAN' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', alignItems: 'start' }}>
          
          {/* COLUMNA 1: NOTA DE PEDIDO (VENDEDOR) */}
          <div className="bento-card" style={{ padding: '0.85rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-card-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--motorven-gold)', paddingBottom: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--motorven-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🟡 1. Nota Pedido - Vendedor ({kanbanColumns.PENDIENTE.length})
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                {formatUsd(kanbanColumns.PENDIENTE.reduce((acc, o) => acc + (Number(o.totalNetoUsd) || 0), 0))}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
              {kanbanColumns.PENDIENTE.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Sin notas de pedido pendientes.
                </div>
              ) : (
                kanbanColumns.PENDIENTE.map(order => renderKanbanCard(order))
              )}
            </div>
          </div>

          {/* COLUMNA 2: EN CAJA (PENDIENTE POR FACTURAR) */}
          <div className="bento-card" style={{ padding: '0.85rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-card-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--motorven-navy-light)', paddingBottom: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--motorven-navy-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🔵 2. En Caja (Por Facturar) ({kanbanColumns.APROBADO.length})
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                {formatUsd(kanbanColumns.APROBADO.reduce((acc, o) => acc + (Number(o.totalNetoUsd) || 0), 0))}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
              {kanbanColumns.APROBADO.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Sin órdenes en cola de caja.
                </div>
              ) : (
                kanbanColumns.APROBADO.map(order => renderKanbanCard(order))
              )}
            </div>
          </div>

          {/* COLUMNA 3: FACTURADO (ORDEN DE ENTREGA GENERADA) */}
          <div className="bento-card" style={{ padding: '0.85rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-card-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--semaforo-verde)', paddingBottom: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--semaforo-verde)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🟢 3. Facturado ➔ O.E. Lista ({kanbanColumns.FACTURADO.length})
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                {formatUsd(kanbanColumns.FACTURADO.reduce((acc, o) => acc + (Number(o.totalNetoUsd) || 0), 0))}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
              {kanbanColumns.FACTURADO.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Sin órdenes facturadas listas para entrega.
                </div>
              ) : (
                kanbanColumns.FACTURADO.map(order => renderKanbanCard(order))
              )}
            </div>
          </div>

          {/* COLUMNA 4: DESPACHADO / EN RUTA */}
          <div className="bento-card" style={{ padding: '0.85rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-card-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #8b5cf6', paddingBottom: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🟣 4. Despachado / En Ruta ({kanbanColumns.EN_TRANSITO.length})
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)' }}>
                {formatUsd(kanbanColumns.EN_TRANSITO.reduce((acc, o) => acc + (Number(o.totalNetoUsd) || 0), 0))}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
              {kanbanColumns.EN_TRANSITO.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Sin órdenes despachadas en tránsito.
                </div>
              ) : (
                kanbanColumns.EN_TRANSITO.map(order => renderKanbanCard(order))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VISTA 2: TABLA DETALLADA CON ACCIONES */}
      {/* ========================================================================= */}
      {viewMode === 'TABLE' && (
        <div className="bento-card" style={{ padding: '0' }}>
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>DOCUMENTO</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>FECHA</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CLIENTE / RAZÓN SOCIAL</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>VENDEDOR & ZONA</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>LITROS</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>TOTAL USD</th>
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ESTADO</th>
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No se encontraron pedidos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => {
                    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDIENTE;
                    const client = clients.find(c => c.id === order.clienteId || c.codigo === order.clienteId || c.rif === order.clienteRif);
                    const isCreditRisk = client && (client.sinCredito || (Number(client.saldoDeudorUsd) || 0) > (Number(client.limiteCreditoUsd) || 0));

                    return (
                      <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(order)}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-code)', fontWeight: 800, color: 'var(--motorven-navy-light)' }}>
                            {order.numeroDoc || order.id}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {order.tipoDoc || 'COTIZACION'}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {order.fechaEmision ? new Date(order.fechaEmision).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {order.clienteNombre}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            <span>RIF: {order.clienteRif || 'S/R'}</span>
                            {isCreditRisk && (
                              <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '0 4px' }}>
                                Riesgo CxC
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                            👤 {order.vendedorId || 'No asignado'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            🗺️ {order.zonaVenta || 'Sin Zona'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontWeight: 700 }}>
                          {formatUnitVe(order.totalLitros || 0, 2)} L
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            {formatUnitVe(order.totalCajas || 0, 0)} Cajas
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-tech)', fontWeight: 800, color: 'var(--semaforo-verde)' }}>
                            {formatUsd(order.totalNetoUsd)}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            {formatBs((Number(order.totalNetoUsd) || 0) * tasaBcv)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${st.badgeClass}`} style={{ fontSize: '0.7rem' }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedOrder(order)}
                              title="Ver ficha de despacho completa"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              Ver Ficha
                            </button>
                            {!['FACTURADO', 'ANULADO', 'ANULADA', 'RECHAZADO', 'CANCELADO', 'CADUCADO'].includes(order.status) && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleFacturarEnPOS(order)}
                                title="Facturar directamente en POS"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--semaforo-verde)', borderColor: 'var(--semaforo-verde)' }}
                              >
                                Facturar
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VISTA 3: PLANIFICADOR DE RUTAS & CIRCUITOS LOGÍSTICOS */}
      {/* ========================================================================= */}
      {viewMode === 'ROUTES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Banner Resumen Rutas */}
          <div className="bento-card" style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(230, 0, 18, 0.05) 100%)', border: '1px solid rgba(37, 99, 235, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <Truck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Planificador de Rutas & Despacho Logístico
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Agrupación de pedidos por zona geográfica oficial de Supabase para carga y salida de camiones
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>FLOTA ASIGNADA</div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {profitTransports.length > 0 ? profitTransports[0].desTran : 'Flota Propia Motorven'}
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Circuitos / Zonas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {zoneLogistics.map((zone) => {
              const hasOrders = zone.orders.length > 0;
              return (
                <div
                  key={zone.coZon}
                  className="bento-card"
                  style={{
                    padding: '1.15rem',
                    margin: 0,
                    background: 'var(--bg-surface)',
                    borderLeft: hasOrders ? '4px solid #3b82f6' : '4px solid var(--border-glass)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    {/* Header Zona */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background: hasOrders ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-glass-accent)',
                          color: hasOrders ? '#3b82f6' : 'var(--text-muted)',
                          border: '1px solid var(--border-glass)'
                        }}>
                          Zona {zone.coZon}
                        </span>
                        <h4 style={{ margin: '0.35rem 0 0 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {zone.zonDes}
                        </h4>
                      </div>

                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        background: hasOrders ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                        color: hasOrders ? '#10b981' : 'var(--text-muted)'
                      }}>
                        {zone.totalOrders} {zone.totalOrders === 1 ? 'Pedido' : 'Pedidos'}
                      </span>
                    </div>

                    {/* Resumen Métricas Zona */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', margin: '0.75rem 0', background: 'var(--bg-glass-accent)', padding: '0.65rem', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>VOLUMEN</div>
                        <div style={{ fontWeight: 800, color: '#3b82f6', fontSize: '0.9rem' }}>{formatUnitVe(zone.totalLitros, 2)} L</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>BULTOS</div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatUnitVe(zone.totalCajas, 0)} Cajas</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>COBRO RUTA</div>
                        <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.9rem' }}>{formatUsd(zone.totalUsd)}</div>
                      </div>
                    </div>

                    {/* Lista rápida de clientes en ruta */}
                    {hasOrders && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PARADAS EN ESTE CIRCUITO:</div>
                        {zone.orders.slice(0, 3).map((ord, oIdx) => (
                          <div key={oIdx} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                              • {ord.clienteNombre || 'Cliente'}
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {ord.totalCajas || 0} cjs ({formatUsd(ord.totalNetoUsd)})
                            </span>
                          </div>
                        ))}
                        {zone.orders.length > 3 && (
                          <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontStyle: 'italic' }}>
                            + {zone.orders.length - 3} paradas adicionales
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Zona */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {zone.pendingCount} por despachar
                    </span>
                    <button
                      disabled={!hasOrders}
                      onClick={() => {
                        generateOrdersPDF({ orders: zone.orders || [], config, currentUser });
                        setSelectedRouteData({
                          zone,
                          orders: zone.orders,
                          transport: profitTransports[0]
                        });
                      }}
                      className="btn btn-print-report btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', marginLeft: 'auto' }}
                    >
                      <Printer size={13} color="#ffffff" />
                      <span>Imprimir Reporte</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL INTERACTIVO: HOJA DE RUTA / MANIFIESTO DE DESPACHO */}
      {/* ========================================================================= */}
      {selectedRouteData && (
        <DispatchRouteModal
          zone={selectedRouteData.zone}
          orders={selectedRouteData.orders}
          transport={selectedRouteData.transport}
          profitZones={profitZones}
          profitTransports={profitTransports}
          config={config}
          currentUser={currentUser}
          onClose={() => setSelectedRouteData(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL INTERACTIVO: FICHA DE DESPACHO & DETALLE DE PEDIDO */}
      {/* ========================================================================= */}
      {selectedOrder && (
        <div className="clients-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="clients-modal-container" style={{ maxWidth: '900px', height: 'auto', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            
            {/* Header del Modal */}
            <div className="clients-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-red))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Ficha de Despacho: {selectedOrder.numeroDoc || selectedOrder.id}
                    </h3>
                    <span className={`badge ${STATUS_CONFIG[selectedOrder.status]?.badgeClass || 'badge-primary'}`}>
                      {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Emisión: {selectedOrder.fechaEmision ? new Date(selectedOrder.fechaEmision).toLocaleString() : 'N/A'} • Origen: {selectedOrder.profitOrigen || 'Supabase'}
                  </div>
                </div>
              </div>

              <button onClick={() => setSelectedOrder(null)} className="btn btn-icon" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Contenido del Detalle */}
            <div className="clients-detail-panel" style={{ padding: '1.25rem', gap: '1rem', maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              
              {/* Tarjeta de Cliente y Crédito */}
              <div className="clients-client-banner">
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>CLIENTE / DESTINATARIO</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedOrder.clienteNombre}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    RIF: <strong>{selectedOrder.clienteRif || 'S/R'}</strong> • Código: <strong>{selectedOrder.clienteId}</strong>
                  </div>
                  {selectedOrder.direccionEntrega && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                      📍 Dirección de Entrega: {selectedOrder.direccionEntrega}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', minWidth: '160px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>VENDEDOR / RUTA</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    👤 {selectedOrder.vendedorId || 'Vendedor Directo'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--motorven-gold)' }}>
                    🗺️ {selectedOrder.zonaVenta || 'Zona Central'}
                  </div>
                </div>
              </div>

              {/* Renglones de Lubricantes */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📦 Detalle de Lubricantes Comprometidos</span>
                  <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {selectedOrder.items?.length || 0} Renglones
                  </span>
                </div>

                <div className="table-container" style={{ border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                  <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: '0.7rem' }}>CÓDIGO</th>
                        <th style={{ fontSize: '0.7rem' }}>LUBRICANTE / DESCRIPCIÓN</th>
                        <th style={{ fontSize: '0.7rem' }}>PRESENTACIÓN</th>
                        <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>CANTIDAD</th>
                        <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>LITROS</th>
                        <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>PRECIO ($)</th>
                        <th style={{ textAlign: 'right', fontSize: '0.7rem' }}>TOTAL ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                            Renglón general de cotización: Total {formatUsd(selectedOrder.totalNetoUsd)}
                          </td>
                        </tr>
                      ) : (
                        selectedOrder.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--motorven-gold)' }}>
                              {it.articuloId}
                            </td>
                            <td style={{ fontWeight: 600 }}>{it.articuloDescripcion}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{resolveProductUnit(it, 'Caja')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.cantidad}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)' }}>
                              {formatUnitVe(it.litrosTotales || (it.cantidad * (it.litrosUnitarios || 1)), 2)} L
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatUsd(it.precioUnitarioUsd)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--semaforo-verde)' }}>
                              {formatUsd(it.totalUsd)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales y Resumen Logístico */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div className="clients-info-card" style={{ borderLeft: '4px solid var(--motorven-gold)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TOTAL LITROS DESPACHO</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--motorven-gold)' }}>
                    {formatUnitVe(selectedOrder.totalLitros || 0, 2)} L
                  </div>
                </div>

                <div className="clients-info-card" style={{ borderLeft: '4px solid var(--motorven-navy-light)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CAJAS ESTIMADAS</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)' }}>
                    {formatUnitVe(selectedOrder.totalCajas || 0, 0)} Cajas
                  </div>
                </div>

                <div className="clients-info-card" style={{ borderLeft: '4px solid var(--semaforo-verde)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TOTAL FACTURA ($ USD)</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                    {formatUsd(selectedOrder.totalNetoUsd)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                    {formatBs((Number(selectedOrder.totalNetoUsd) || 0) * tasaBcv)}
                  </div>
                </div>
              </div>

              {/* Flujo de Estados / Pipeline Step Switcher */}
              <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                  Avance de Estado del Pedido:
                </span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleStatusChange(selectedOrder.id, 'PENDIENTE')}
                    style={{
                      fontSize: '0.75rem',
                      background: selectedOrder.status === 'PENDIENTE' ? 'var(--motorven-gold)' : 'var(--bg-primary)',
                      color: selectedOrder.status === 'PENDIENTE' ? '#000' : 'var(--text-muted)',
                      fontWeight: 700
                    }}
                  >
                    1. Orden Compra (Vendedor)
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleStatusChange(selectedOrder.id, 'APROBADO')}
                    style={{
                      fontSize: '0.75rem',
                      background: selectedOrder.status === 'APROBADO' ? 'var(--motorven-navy-light)' : 'var(--bg-primary)',
                      color: selectedOrder.status === 'APROBADO' ? '#fff' : 'var(--text-muted)',
                      fontWeight: 700
                    }}
                  >
                    2. En Caja (Por Facturar)
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleStatusChange(selectedOrder.id, 'FACTURADO')}
                    style={{
                      fontSize: '0.75rem',
                      background: selectedOrder.status === 'FACTURADO' ? 'var(--semaforo-verde)' : 'var(--bg-primary)',
                      color: selectedOrder.status === 'FACTURADO' ? '#fff' : 'var(--text-muted)',
                      fontWeight: 700
                    }}
                  >
                    3. Facturado (Genera O.E.)
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleStatusChange(selectedOrder.id, 'EN_TRANSITO')}
                    style={{
                      fontSize: '0.75rem',
                      background: selectedOrder.status === 'EN_TRANSITO' ? '#8b5cf6' : 'var(--bg-primary)',
                      color: selectedOrder.status === 'EN_TRANSITO' ? '#fff' : 'var(--text-muted)',
                      fontWeight: 700
                    }}
                  >
                    4. Despachado (Almacén)
                  </button>
                </div>
              </div>

            </div>

            {/* Footer de Acciones del Modal */}
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              {selectedOrder.status !== 'FACTURADO' ? (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled
                  style={{ fontSize: '0.78rem', gap: '5px', opacity: 0.6, cursor: 'not-allowed' }}
                  title="La Orden de Entrega se genera automáticamente una vez que la Cajera emite la Factura"
                >
                  <Lock size={14} color="var(--motorven-gold)" /> 🔒 Orden de Entrega (Requiere Factura de Caja)
                </button>
              ) : (
                <button
                  className="btn btn-print-report btn-sm"
                  onClick={() => generateOrdersPDF({ orders: [selectedOrder], currentUser, config })}
                  title="Descargar orden de entrega en PDF oficial"
                >
                  <Printer size={15} color="#ffffff" /> O.E. Entrega (PDF)
                </button>
              )}

              <button
                className="btn btn-print-report btn-sm"
                onClick={() => generateSellerOrderPDF({
                  order: selectedOrder,
                  currentUser,
                  config,
                  client: safeClients.find(c => c && (c.id === selectedOrder.clienteId || c.rif === selectedOrder.clienteRif))
                })}
                style={{ background: 'linear-gradient(135deg, #002b7a 0%, #1e40af 100%)', border: '1px solid rgba(59, 130, 246, 0.4)' }}
                title="Descargar Nota de Pedido / Preventa para el Vendedor (guarda en su dispositivo)"
              >
                <Printer size={15} color="#ffffff" /> 📄 Nota Pedido Vendedor (PDF)
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedOrder(null)}
                  style={{ fontSize: '0.78rem' }}
                >
                  Cerrar
                </button>
                {!['FACTURADO', 'ANULADO', 'ANULADA', 'RECHAZADO', 'CANCELADO', 'CADUCADO'].includes(selectedOrder.status) && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      handleFacturarEnPOS(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    style={{ fontSize: '0.78rem', background: 'var(--semaforo-verde)', borderColor: 'var(--semaforo-verde)', gap: '6px' }}
                  >
                    <CheckCircle2 size={16} /> 2. Facturar en Caja (Cajera)
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: CREAR NUEVO PEDIDO / PREVENTA */}
      {/* ========================================================================= */}
      {showNewOrderModal && (
        <div className="clients-modal-backdrop" onClick={() => setShowNewOrderModal(false)}>
          <div className="clients-modal-container" style={{ maxWidth: '750px', height: 'auto', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="clients-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={22} color="var(--motorven-red)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Emitir Nota de Pedido / Preventa (Vendedor)
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    El asesor comercial genera la preventa. La cajera la facturará en Caja para liberar la Orden de Entrega.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowNewOrderModal(false)} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const clientObj = safeClients.find(c => c && (c.id === newOrderClient || c.codigo === newOrderClient));
                const isNotaEntrega = newOrderModalidad === 'OFICINA';
                const targetWh = isNotaEntrega ? '02' : '01';
                const orderId = `OC-${Date.now().toString().slice(-6)}`;

                const validItems = newOrderItems.filter(it => it.articuloId && it.cantidad > 0);
                if (validItems.length === 0) {
                  notify.warning('Debe agregar al menos un lubricante con cantidad válida.');
                  return;
                }

                const stockCheck = validateWarehouseStockForDocument({
                  items: validItems,
                  products: safeProducts,
                  tipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
                  almacen: targetWh,
                  modalidadVenta: newOrderModalidad
                });
                if (!stockCheck.isValid) {
                  notify.error(stockCheck.message);
                  return;
                }

                const itemsToSave = validItems.map((it, idx) => {
                  const prod = safeProducts.find(p => p && (p.id === it.articuloId || p.codigo === it.articuloId));
                  const desc = prod?.descripcion || it.articuloId;
                  const uni = resolveProductUnit(prod || it, 'Caja');
                  const litUnit = prod ? resolveProductLitersPerUnit(prod) : 11.35;
                  const cant = Number(it.cantidad || 1);
                  const price = Number(it.precioUsd) > 0 ? Number(it.precioUsd) : getProductWholesalePrice(prod, newOrderActiveWh);

                  return {
                    id: `${orderId}-${idx + 1}`,
                    orderId: orderId,
                    rengNum: idx + 1,
                    articuloId: it.articuloId,
                    articuloDescripcion: desc,
                    unidadVenta: uni,
                    cantidad: cant,
                    litrosUnitarios: litUnit,
                    litrosTotales: cant * litUnit,
                    precioUnitarioUsd: price,
                    precioUsd: price,
                    totalUsd: lineSubtotal(cant, price)
                  };
                });

                const totalLit = itemsToSave.reduce((acc, it) => acc + it.litrosTotales, 0);
                const totalCaj = itemsToSave.reduce((acc, it) => acc + ((it.unidadVenta || '').toUpperCase().includes('CAJA') ? it.cantidad : 0), 0);
                const totalNet = itemsToSave.reduce((acc, it) => acc + it.totalUsd, 0);

                const newOrderObj = {
                  id: orderId,
                  numeroDoc: orderId,
                  prefijoDoc: isNotaEntrega ? 'PED-NE' : 'PED-FF',
                  tipoDoc: isNotaEntrega ? 'NOTA_ENTREGA' : 'FACTURA',
                  almacen: targetWh,
                  almacenId: targetWh,
                  modalidadVenta: newOrderModalidad,
                  fechaEmision: new Date().toISOString(),
                  clienteId: clientObj?.id || newOrderClient,
                  clienteNombre: clientObj?.nombre || 'Cliente General',
                  clienteRif: clientObj?.rif || '',
                  vendedorId: newOrderSeller,
                  zonaVenta: clientObj?.zonaVenta || 'Zona Central',
                  segmento: clientObj?.segmento || 'General',
                  totalBrutoUsd: totalNet,
                  ivaUsd: 0,
                  totalNetoUsd: totalNet,
                  totalLitros: totalLit,
                  totalCajas: totalCaj,
                  totalItems: itemsToSave.length,
                  status: 'APROBADO',
                  direccionEntrega: newOrderDir || clientObj?.direccion || '',
                  comentarios: newOrderComments,
                  profitOrigen: 'SIGNUM_POS',
                  items: itemsToSave
                };

                if (onSaveOrder) {
                  await onSaveOrder(newOrderObj);
                }
                setShowNewOrderModal(false);
              }}
              style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}
            >
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Modalidad y Almacén de Despacho</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setNewOrderModalidad('PREVENTA')}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      background: newOrderModalidad === 'PREVENTA' ? 'rgba(220, 38, 38, 0.2)' : 'var(--bg-industrial)',
                      border: newOrderModalidad === 'PREVENTA' ? '1.5px solid var(--motorven-red)' : '1px solid var(--border-glass)',
                      color: newOrderModalidad === 'PREVENTA' ? '#fca5a5' : 'var(--text-muted)'
                    }}
                  >
                    🧾 Factura Fiscal · Almacén 01
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewOrderModalidad('OFICINA')}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      background: newOrderModalidad === 'OFICINA' ? 'rgba(16, 185, 129, 0.18)' : 'var(--bg-industrial)',
                      border: newOrderModalidad === 'OFICINA' ? '1.5px solid #10b981' : '1px solid var(--border-glass)',
                      color: newOrderModalidad === 'OFICINA' ? '#34d399' : 'var(--text-muted)'
                    }}
                  >
                    📋 Nota de Entrega · Almacén 02
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Cliente Destinatario *</label>
                  <select
                    value={newOrderClientTypeFilter}
                    onChange={e => setNewOrderClientTypeFilter(e.target.value)}
                    className="input"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.78rem' }}
                    title="Filtrar por clasificación SENIAT (J, V, E, G, P)"
                  >
                    <option value="ALL">Todos los tipos ({approvedClients.length})</option>
                    {SENIAT_CONTRIBUTOR_TYPES.map(t => (
                      <option key={t.code} value={t.code} title={t.description}>
                        {t.label} ({newOrderContributorCounts[t.code] || 0})
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={newOrderClient}
                    onChange={e => {
                      setNewOrderClient(e.target.value);
                      const c = safeClients.find(cl => cl && (cl.id === e.target.value || cl.codigo === e.target.value));
                      if (c) {
                        setNewOrderDir(c.direccion2 || c.direccion || '');
                      }
                    }}
                    className="input"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.82rem' }}
                  >
                    <option value="">-- Seleccionar Cliente Aprobado ({filteredNewOrderClients.length}) --</option>
                    {filteredNewOrderClients.map(c => (
                      <option key={c.id || c.codigo} value={c.id || c.codigo}>
                        {c.codigo || c.id} • {c.nombre} ({c.rif}) · [{resolveClientContributorType(c)}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Vendedor Asignado</label>
                  <input
                    type="text"
                    value={newOrderSeller}
                    onChange={e => setNewOrderSeller(e.target.value)}
                    className="input"
                    style={{ width: '100%', marginTop: '4px', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Dirección de Entrega / Despacho</label>
                <input
                  type="text"
                  placeholder="Dirección del galpón / local para el chofer..."
                  value={newOrderDir}
                  onChange={e => setNewOrderDir(e.target.value)}
                  className="input"
                  style={{ width: '100%', marginTop: '4px', fontSize: '0.82rem' }}
                />
              </div>

              {/* Renglones */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Lubricantes Requeridos (Almacén {newOrderActiveWh})</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setNewOrderItems(prev => [...prev, { articuloId: '', cantidad: 1, precioUsd: 0, unidad: 'Caja' }])}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    + Agregar Renglón
                  </button>
                </div>

                {newOrderItems.map((item, idx) => {
                  const selectedProd = item.articuloId
                    ? safeProducts.find(prod => prod && (prod.id === item.articuloId || prod.codigo === item.articuloId))
                    : null;
                  const selectedStocks = selectedProd ? getProductWarehouseStocks(selectedProd) : null;
                  const selectedWhStock = selectedStocks ? (newOrderActiveWh === '02' ? selectedStocks.stock02 : selectedStocks.stock01) : null;

                  return (
                    <div key={idx} style={{ marginBottom: '6px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                        <select
                          required
                          value={item.articuloId}
                          onChange={e => {
                            const val = e.target.value;
                            const p = safeProducts.find(prod => prod && (prod.id === val || prod.codigo === val));
                            if (val && p) {
                              const pStocks = getProductWarehouseStocks(p);
                              const whStock = newOrderActiveWh === '02' ? pStocks.stock02 : pStocks.stock01;
                              if (!(whStock > 0)) {
                                notify.warning(`No se puede cargar ${p.codigo || p.descripcion}: existencia en 0 en Almacén ${newOrderActiveWh}.`);
                                return;
                              }
                            }
                            const updated = [...newOrderItems];
                            updated[idx].articuloId = val;
                            updated[idx].precioUsd = p ? getProductWholesalePrice(p, newOrderActiveWh) : 0;
                            updated[idx].unidad = p ? resolveProductUnit(p, 'Caja') : 'Caja';
                            setNewOrderItems(updated);
                          }}
                          className="input"
                          style={{ fontSize: '0.78rem' }}
                        >
                          <option value="">-- Seleccionar Lubricante --</option>
                          {safeProducts.map(p => {
                            const pStocks = getProductWarehouseStocks(p);
                            const whStock = newOrderActiveWh === '02' ? pStocks.stock02 : pStocks.stock01;
                            return (
                              <option key={p.id || p.codigo} value={p.id || p.codigo} disabled={whStock <= 0}>
                                {p.codigo} - {p.descripcion} ({formatUsd(getProductWholesalePrice(p, newOrderActiveWh))}) [Alm {newOrderActiveWh}: {whStock}{whStock <= 0 ? ' · AGOTADO' : ''}]
                              </option>
                            );
                          })}
                        </select>

                        <input
                          type="number"
                          min="1"
                          placeholder="Cant"
                          value={item.cantidad}
                          onChange={e => {
                            const updated = [...newOrderItems];
                            updated[idx].cantidad = Math.max(1, Number(e.target.value));
                            setNewOrderItems(updated);
                          }}
                          className="input"
                          style={{ fontSize: '0.78rem' }}
                        />

                        <input
                          type="number"
                          step="0.01"
                          placeholder="Precio $"
                          value={item.precioUsd}
                          onChange={e => {
                            const updated = [...newOrderItems];
                            updated[idx].precioUsd = Number(e.target.value);
                            setNewOrderItems(updated);
                          }}
                          className="input"
                          style={{ fontSize: '0.78rem' }}
                        />

                        {newOrderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewOrderItems(newOrderItems.filter((_, i) => i !== idx))}
                            className="btn btn-icon"
                            style={{ color: 'var(--motorven-red)', padding: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {selectedProd && !(selectedWhStock > 0) && (
                        <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700, marginTop: '3px' }}>
                          ⚠️ {selectedProd.codigo} tiene existencia 0 en Almacén {newOrderActiveWh} — retire este renglón para emitir.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!newOrderWarehouseCheck.isValid && (
                <div style={{
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
                  <span>{newOrderWarehouseCheck.message}</span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Comentarios / Observaciones</label>
                <textarea
                  rows="2"
                  placeholder="Instrucciones para el chofer o condiciones de pago..."
                  value={newOrderComments}
                  onChange={e => setNewOrderComments(e.target.value)}
                  className="input"
                  style={{ width: '100%', marginTop: '4px', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewOrderModal(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newOrderWarehouseCheck.isValid}
                  className="btn btn-primary"
                  style={{
                    gap: '6px',
                    background: !newOrderWarehouseCheck.isValid ? '#475569' : 'linear-gradient(135deg, var(--motorven-red), #b91c1c)',
                    borderColor: !newOrderWarehouseCheck.isValid ? '#64748b' : 'var(--motorven-red)',
                    fontWeight: 800,
                    opacity: !newOrderWarehouseCheck.isValid ? 0.6 : 1,
                    cursor: !newOrderWarehouseCheck.isValid ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Send size={16} /> 1. Emitir Nota de Pedido a Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );

  // Helper para renderizar cada tarjeta Kanban
  function renderKanbanCard(order) {
    if (!order) return null;
    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDIENTE;
    const client = findOrderClient(order);
    const isCreditRisk = client && (client.sinCredito || (Number(client.saldoDeudorUsd) || 0) > (Number(client.limiteCreditoUsd) || 0));

    return (
      <div
        key={order.id}
        onClick={() => setSelectedOrder(order)}
        className="clients-list-item"
        style={{
          padding: '0.85rem',
          borderRadius: '10px',
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem', fontWeight: 800, color: 'var(--motorven-navy-light)' }}>
              {order.numeroDoc || order.id}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '6px', fontFamily: 'var(--font-code)' }}>
              {order.fechaEmision ? new Date(order.fechaEmision).toLocaleDateString() : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isCreditRisk && (
              <span className="badge badge-danger" style={{ fontSize: '0.58rem', padding: '1px 4px' }} title="Cliente con saldo deudor o sin crédito">
                Riesgo
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                generateSellerOrderPDF({
                  order,
                  config,
                  currentUser,
                  client: safeClients.find(c => c && (c.id === order.clienteId || c.codigo === order.clienteId || c.rif === order.clienteRif))
                });
              }}
              className="btn btn-print-report btn-sm"
              style={{ padding: '2px 5px', fontSize: '0.62rem', display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--motorven-navy)', borderColor: 'rgba(59, 130, 246, 0.4)' }}
              title="Descargar Nota de Pedido Vendedor en PDF"
            >
              <Printer size={10} color="#ffffff" /> PDF
            </button>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '4px', lineHeight: '1.2' }}>
          {order.clienteNombre}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {order.vendedorId && <span>👤 {order.vendedorId}</span>}
          {order.zonaVenta && <span>🗺️ {order.zonaVenta}</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-glass)' }}>
          <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.75rem', color: 'var(--motorven-gold)', fontWeight: 700 }}>
            {formatUnitVe(order.totalLitros || 0, 2)} L
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '3px' }}>
              ({formatUnitVe(order.totalCajas || 0, 0)} cj)
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.9rem', fontWeight: 800, color: 'var(--semaforo-verde)' }}>
            {formatUsd(order.totalNetoUsd)}
          </div>
        </div>
      </div>
    );
  }
}
