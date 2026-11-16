import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Printer,
  FileText,
  ArrowUpRight,
  DollarSign,
  Fuel,
  ClipboardList,
  BarChart2,
  PieChart as PieIcon,
  Target,
  Award,
  Landmark,
  CheckCircle2,
  Users,
  RefreshCw,
  Truck,
  Package,
  ShieldCheck,
  Calendar,
  Filter,
  Server,
  ExternalLink,
  Database,
  Table,
  Bell,
  BellRing,
  AlertOctagon,
  AlertTriangle,
  Layers,
  Percent,
  Briefcase,
  Clock,
  ChevronRight,
  Droplet,
  Flame,
  Archive,
  TrendingDown,
  Hourglass,
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Eye,
  Receipt
} from 'lucide-react';
import { formatUsd, formatBs, resolveProductUnit, resolveProductLitersPerUnit } from '../services/formatService';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import ExecutiveSummaryModal from '../components/ExecutiveSummaryModal';
import ClientsDirectoryModal from '../components/ClientsDirectoryModal';
import CreditScoreEngineModal from '../components/CreditScoreEngineModal';
import NotificationsCenterModal from '../components/NotificationsCenterModal';
import { isMasterOrGerencia, isMasterAdmin, getClientApprovalStatus } from '../services/authService';
import { DEFAULT_PROFIT_SELLERS } from '../data/mockData';
import { generateDashboardPDF, generateNotificationsPDF } from '../services/pdfReportService';
import { getSupabaseNotifications, seedInitialNotificationsIfEmpty } from '../services/supabaseService';
import { getCanonicalDocKey, dedupeCanonicalDocs } from '../services/fiscalService';
import { resolveExchangeRates, computeBankAccountValuation } from '../utils/treasuryAccountUtils';
import { matchesSeller } from '../services/commissionService';
import {
  extractMonthNumber,
  toDateKey,
  getUnduplicatedSales,
  summarizePendingOrders,
  summarizeReceivablesAging
} from '../services/dashboardMetricsService';
import {
  isCxcInvoiceCancelled,
  isCxcInvoiceSettled,
  normalizeClientRifKey,
  normalizeClientCodeKey,
  normalizeClientNameKey
} from '../utils/cxcUtils';

function isExcludedSaleDocType(doc) {
  const tipo = String(doc?.tipoDoc || doc?.tipo_doc || '').trim().toUpperCase();
  return tipo === 'NOTA_CREDITO' || tipo === 'COTIZACION';
}

function resolveDocumentLitros(doc, productsBySku, fallbackItems = null) {
  const headerLitros = Number(doc?.totalLitros ?? doc?.total_litros ?? 0) || 0;
  if (headerLitros > 0) return headerLitros;
  const rawItems = (Array.isArray(doc?.items) && doc.items.length > 0)
    ? doc.items
    : (Array.isArray(fallbackItems) ? fallbackItems : []);
  return rawItems.reduce((acc, item) => {
    const explicit = Number(item?.litrosTotales ?? item?.litros_totales ?? item?.litros ?? 0) || 0;
    if (explicit > 0) return acc + explicit;
    const sku = String(item?.articuloId || item?.codigo || item?.id || '').trim();
    const prod = productsBySku?.get(sku);
    const ltsUnit = Number(
      item?.litrosUnitarios ??
      item?.litrosPorUnidad ??
      (prod ? resolveProductLitersPerUnit(prod) : 0)
    ) || 0;
    return acc + ((Number(item?.cantidad || 0) || 0) * ltsUnit);
  }, 0);
}

function formatAdvisorName(name) {
  if (!name) return 'Asesor';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth = 'ALL') {
  if (!dateStr) return true;
  const d = toDateKey(dateStr) || String(dateStr).substring(0, 10);
  if (d && (d < fechaInicioEfectiva || d > fechaFinEfectiva)) return false;
  if (selectedMonth !== 'ALL') {
    return extractMonthNumber(dateStr) === selectedMonth;
  }
  return true;
}

function resolveAmountUsd(row, usdKeys, bsKeys, tasaBcv) {
  let rawUsd = 0;
  for (const k of usdKeys) {
    if (row?.[k] !== undefined && row?.[k] !== null && Number(row[k]) > 0) {
      rawUsd = Number(row[k]);
      break;
    }
  }
  if (rawUsd > 0) return rawUsd;
  let rawBs = 0;
  for (const k of bsKeys) {
    if (row?.[k] !== undefined && row?.[k] !== null && Number(row[k]) > 0) {
      rawBs = Number(row[k]);
      break;
    }
  }
  const t = Number(row?.tasa || 0) > 10 ? Number(row.tasa) : tasaBcv;
  return rawBs > 0 && t > 1 ? rawBs / t : 0;
}

function resolveCollectionNormalized(c, tasaBcv) {
  const rawUsd = Number(c?.montoUsd ?? c?.monto_usd ?? 0) || 0;
  const rawBs = Number(c?.montoBs ?? c?.monto_bs ?? 0) || 0;
  const cTasa = Number(c?.tasa || 0);
  const effectiveTasa = cTasa > 10 ? cTasa : (tasaBcv > 1 ? tasaBcv : 0);

  let usdVal = rawUsd;
  let bsVal = rawBs;
  if (cTasa > 10 && rawBs > 0 && Math.abs((rawUsd * cTasa) - rawBs) <= Math.max(2, rawBs * 0.05)) {
    usdVal = rawUsd;
    bsVal = rawBs;
  } else if (cTasa > 10 && rawUsd > 0 && (Math.abs(rawUsd - rawBs) < 1 || rawBs === 0)) {
    usdVal = rawUsd / cTasa;
    bsVal = rawBs > 0 ? rawBs : rawUsd;
  } else if (rawUsd <= 0 && rawBs > 0 && effectiveTasa > 0) {
    usdVal = rawBs / effectiveTasa;
    bsVal = rawBs;
  }
  return { rawUsd, rawBs, cTasa, effectiveTasa, usdVal, bsVal };
}

export default function DashboardView({
  products = [],
  sales = [],
  clients = [],
  orders = [],
  profitInvoices = [],
  profitCollections = [],
  profitBankAccounts = [],
  profitAccountsPayable = [],
  profitSupplierPayments = [],
  profitPurchases = [],
  profitSellers = [],
  profitZones = [],
  config = {},
  currentUser,
  onNavigate,
  onSyncProfit,
  onSaveClient,
  onDeleteClient,
  onApproveClient,
  onRejectClient,
  onOpenOrdersSalesModal,
  onSelectClientForModule
}) {
  const defaultFiscalYear = String(config?.ejercicioFiscalActivo || new Date().getFullYear());

  // Estados de Modales
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [showCreditScoreModal, setShowCreditScoreModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filtros de Comparativa de Lubricantes (por Año y Mes)
  const [comparativaYearFilter, setComparativaYearFilter] = useState(defaultFiscalYear);
  const [comparativaMonthFilter, setComparativaMonthFilter] = useState('ALL');

  // Filtros de Salud del Inventario y Caducidad (por Años y Meses)
  const [caducidadYearFilter, setCaducidadYearFilter] = useState(defaultFiscalYear);
  const [caducidadMonthFilter, setCaducidadMonthFilter] = useState('ALL');

  // Fecha local de hoy (se refresca cada minuto para cubrir el cambio de día con el dashboard abierto)
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const k = toDateKey(new Date());
      setTodayKey(prev => (prev === k ? prev : k));
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Cargar notificaciones para badges de alerta en tiempo real
  useEffect(() => {
    let isMounted = true;
    const loadNotifs = async () => {
      try {
        let data = await getSupabaseNotifications();
        if ((!data || data.length === 0) && isMounted) {
          data = await seedInitialNotificationsIfEmpty(products, clients, config);
        }
        if (isMounted) setNotificationsList(data || []);
      } catch (_) {}
    };
    loadNotifs();
    return () => { isMounted = false; };
  }, [products, clients, config]);

  const unreadNotifsCount = useMemo(() => {
    return (notificationsList || []).filter(n => !n.leida).length;
  }, [notificationsList]);

  const { tasaBcv } = useMemo(() => resolveExchangeRates(config), [config]);

  // Filtro mensual y anual de Metas Cumplidas (Año en curso)
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' = Cierre Anual Acumulado, '01'..'12' = Mes específico

  const anioActivo = config?.ejercicioFiscalActivo || new Date().getFullYear();
  const fechaInicioEfectiva = config?.periodoFiscalInicio || `${anioActivo}-01-01`;
  const fechaFinEfectiva = config?.periodoFiscalFin || `${anioActivo}-12-31`;

  const MONTHS_LIST = useMemo(() => [
    { id: 'ALL', label: `Año Fiscal ${anioActivo} Completo (${fechaInicioEfectiva} al ${fechaFinEfectiva})`, short: `Año ${anioActivo}` },
    { id: '01', label: `Enero ${anioActivo}`, short: 'Ene' },
    { id: '02', label: `Febrero ${anioActivo}`, short: 'Feb' },
    { id: '03', label: `Marzo ${anioActivo}`, short: 'Mar' },
    { id: '04', label: `Abril ${anioActivo}`, short: 'Abr' },
    { id: '05', label: `Mayo ${anioActivo}`, short: 'May' },
    { id: '06', label: `Junio ${anioActivo}`, short: 'Jun' },
    { id: '07', label: `Julio ${anioActivo}`, short: 'Jul' },
    { id: '08', label: `Agosto ${anioActivo}`, short: 'Ago' },
    { id: '09', label: `Septiembre ${anioActivo}`, short: 'Sep' },
    { id: '10', label: `Octubre ${anioActivo}`, short: 'Oct' },
    { id: '11', label: `Noviembre ${anioActivo}`, short: 'Nov' },
    { id: '12', label: `Diciembre ${anioActivo}`, short: 'Dic' }
  ], [anioActivo, fechaInicioEfectiva, fechaFinEfectiva]);

  // Lista efectiva de vendedores (de Supabase/Profit deduplicada priorizando códigos reales de Supabase)
  const effectiveSellersList = useMemo(() => {
    if (Array.isArray(profitSellers) && profitSellers.length > 0) {
      const byName = new Map();
      profitSellers.forEach(s => {
        const name = (s.venDes || s.ven_des || s.nombre || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const code = (s.coVen || s.co_ven || s.id || '').trim();
        if (!byName.has(key) || (code.length <= 4 && (byName.get(key).coVen?.length || 0) > 4)) {
          byName.set(key, {
            ...s,
            coVen: code,
            venDes: name,
            metaLitrosMes: Number(s.metaLitrosMes ?? s.meta_litros_mes ?? 3000)
          });
        }
      });
      return Array.from(byName.values());
    }
    return DEFAULT_PROFIT_SELLERS;
  }, [profitSellers]);

  // Índice SKU -> Producto para cálculo consistente de litros por documento e ítems
  const productsBySku = useMemo(() => {
    const map = new Map();
    (products || []).forEach(p => {
      const sku = String(p.codigo || p.id || '').trim();
      if (sku) map.set(sku, p);
    });
    return map;
  }, [products]);

  // Filtrar facturas según el rango del ejercicio fiscal y el mes seleccionado
  const filteredProfitInvoices = useMemo(() => {
    if (!Array.isArray(profitInvoices)) return [];
    const deduped = dedupeCanonicalDocs(profitInvoices);
    const valid = deduped.filter(f => {
      if (isCxcInvoiceCancelled(f) || isExcludedSaleDocType(f)) return false;
      const dateStr = f?.fechaEmision || f?.fecEmis || f?.fec_emis || f?.fecha || '';
      const d = toDateKey(dateStr) || String(dateStr).substring(0, 10);
      if (d && (d < fechaInicioEfectiva || d > fechaFinEfectiva)) return false;
      return true;
    });

    if (selectedMonth === 'ALL') return valid;
    return valid.filter(f => {
      const dateStr = f?.fechaEmision || f?.fecEmis || f?.fec_emis || f?.fecha || '';
      const m = extractMonthNumber(dateStr);
      return m === selectedMonth;
    });
  }, [profitInvoices, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Ventas locales POS deduplicadas contra profitInvoices para evitar doble conteo
  const unduplicatedSales = useMemo(
    () => getUnduplicatedSales(sales, profitInvoices).filter(s => !isCxcInvoiceCancelled(s) && !isExcludedSaleDocType(s)),
    [sales, profitInvoices]
  );

  // Cálculo dinámico de Litros Facturados locales no reflejados aún en profitInvoices
  const litrosRealesVendidos = useMemo(() => {
    return unduplicatedSales.filter(s => {
      const dateStr = s.fecha || s.fechaEmision || s.fecha_emision || '';
      return isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth);
    }).reduce((acc, s) => acc + resolveDocumentLitros(s, productsBySku), 0);
  }, [unduplicatedSales, productsBySku, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Litros Facturados reales en el período seleccionado (desde Supabase profit_invoices + fallback ítems)
  const litrosFacturadosPeriodo = useMemo(() => {
    const fromInvoices = filteredProfitInvoices.reduce(
      (acc, f) => acc + resolveDocumentLitros(f, productsBySku),
      0
    );
    return parseFloat((fromInvoices + litrosRealesVendidos).toFixed(2));
  }, [filteredProfitInvoices, productsBySku, litrosRealesVendidos]);

  const totalLitros = litrosFacturadosPeriodo;

  // Meta base mensual asignada a la fuerza de ventas (suma de metas individuales)
  const metaMensualBase = useMemo(() => {
    const sumMensual = effectiveSellersList.reduce((acc, s) => {
      const val = Number(s?.metaLitrosMes ?? s?.meta_litros_mes);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    return sumMensual > 0 ? sumMensual : (Number(config?.metaComercialLitros) || 20000.00);
  }, [effectiveSellersList, config?.metaComercialLitros]);

  // Meta calculada por período:
  // Si es Cierre Anual, la meta acumulada es la suma de los 12 meses del ejercicio
  const metaLitros = useMemo(() => {
    if (selectedMonth === 'ALL') {
      return metaMensualBase * 12;
    }
    return metaMensualBase;
  }, [metaMensualBase, selectedMonth]);

  // Rendimiento y sumatoria de porcentajes de cumplimiento de cada asesor sincronizado
  const sellersCompliance = useMemo(() => {
    const list = effectiveSellersList;
    const totalMetaGlobal = metaLitros > 0 ? metaLitros : 20000.00;

    const sellersWithDirectLiters = list.map(seller => {
      const coVen = (seller?.coVen || seller?.co_ven || seller?.codigo || seller?.id || '').toString().trim();
      const venDes = (seller?.venDes || seller?.ven_des || seller?.nombre || '').toString().trim();

      // Facturas Supabase asignadas (coincidencia exacta anti-colisión)
      const sInvoices = (filteredProfitInvoices || []).filter(f => matchesSeller(seller, f));
      const sInvoicesLitros = sInvoices.reduce((acc, f) => acc + resolveDocumentLitros(f, productsBySku), 0);

      // Ventas locales POS no duplicadas asignadas al vendedor dentro del período fiscal activo
      const sSales = unduplicatedSales.filter(s => {
        const dateStr = s.fecha || s.fechaEmision || s.fecha_emision || '';
        if (!isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth)) return false;
        return matchesSeller(seller, s);
      });
      const sSalesLitros = sSales.reduce((acc, s) => acc + resolveDocumentLitros(s, productsBySku), 0);

      const sLitros = sInvoicesLitros + sSalesLitros;
      const sMetaBase = Number(seller?.metaLitrosMes ?? seller?.meta_litros_mes) || 3000;
      const sMeta = selectedMonth === 'ALL' ? sMetaBase * 12 : sMetaBase;

      return {
        ...seller,
        coVen: coVen || seller?.id || 'VEND',
        venDes: venDes || 'Asesor Comercial',
        sLitros,
        sMeta
      };
    });

    return sellersWithDirectLiters.map((s) => {
      const litrosFinales = s.sLitros;
      const pctIndividual = s.sMeta > 0 ? (litrosFinales / s.sMeta) * 100 : 0;
      const pctAporteEmpresa = totalMetaGlobal > 0 ? (litrosFinales / totalMetaGlobal) * 100 : 0;

      return {
        ...s,
        litrosFinales: parseFloat(litrosFinales.toFixed(1)),
        pctIndividual: parseFloat(pctIndividual.toFixed(1)),
        pctAporteEmpresa: parseFloat(pctAporteEmpresa.toFixed(2))
      };
    }).sort((a, b) => b.litrosFinales - a.litrosFinales || b.pctAporteEmpresa - a.pctAporteEmpresa);
  }, [effectiveSellersList, filteredProfitInvoices, unduplicatedSales, productsBySku, metaLitros, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Histórico de Metas y Cumplimiento real de todos los meses del ejercicio activo (sin duplicar POS/Profit)
  const monthlyHistoryData = useMemo(() => {
    const metaBaseMes = effectiveSellersList.reduce((acc, s) => acc + (Number(s?.metaLitrosMes ?? s?.meta_litros_mes) || 3000), 0) || 30000;
    const dedupedInvoices = dedupeCanonicalDocs(profitInvoices || []);

    const months = [
      { mes: 'Ene', num: '01' },
      { mes: 'Feb', num: '02' },
      { mes: 'Mar', num: '03' },
      { mes: 'Abr', num: '04' },
      { mes: 'May', num: '05' },
      { mes: 'Jun', num: '06' },
      { mes: 'Jul', num: '07' },
      { mes: 'Ago', num: '08' },
      { mes: 'Sep', num: '09' },
      { mes: 'Oct', num: '10' },
      { mes: 'Nov', num: '11' },
      { mes: 'Dic', num: '12' }
    ];

    return months.map(m => {
      const invLiters = dedupedInvoices.filter(f => {
        if (!f || isCxcInvoiceCancelled(f) || isExcludedSaleDocType(f)) return false;
        const d = f.fechaEmision || f.fecEmis || f.fec_emis || f.fecha || '';
        const dk = toDateKey(d);
        if (dk && (dk < fechaInicioEfectiva || dk > fechaFinEfectiva)) return false;
        return extractMonthNumber(d) === m.num;
      }).reduce((acc, f) => acc + resolveDocumentLitros(f, productsBySku), 0);

      const salesLiters = unduplicatedSales.filter(s => {
        const d = s.fecha || s.fechaEmision || s.fecha_emision || '';
        const dk = toDateKey(d);
        if (dk && (dk < fechaInicioEfectiva || dk > fechaFinEfectiva)) return false;
        return extractMonthNumber(d) === m.num;
      }).reduce((acc, s) => acc + resolveDocumentLitros(s, productsBySku), 0);

      const facturado = parseFloat((invLiters + salesLiters).toFixed(1));
      const pct = metaBaseMes > 0 ? Math.round((facturado / metaBaseMes) * 100) : 0;
      return {
        mes: m.mes,
        num: m.num,
        meta: metaBaseMes,
        facturado,
        pct
      };
    });
  }, [effectiveSellersList, profitInvoices, unduplicatedSales, productsBySku, fechaInicioEfectiva, fechaFinEfectiva]);

  // Cumplimiento de la meta calculado por la sumatoria de los porcentajes de cumplimiento de cada asesor
  const cumplimientoPct = useMemo(() => {
    const sumAportes = sellersCompliance.reduce((acc, s) => acc + (Number(s.pctAporteEmpresa) || 0), 0);
    return parseFloat(sumAportes.toFixed(2));
  }, [sellersCompliance]);

  // Semáforo de Cumplimiento de Meta
  const getSemaforoMeta = (pct) => {
    if (pct < 50) return { level: 'rojo', text: 'Semáforo: Crítico (<50%)', color: 'var(--semaforo-rojo, #dc2626)' };
    if (pct < 80) return { level: 'amarillo', text: 'Semáforo: En Progreso (50-80%)', color: 'var(--semaforo-amarillo, #f59e0b)' };
    return { level: 'verde', text: 'Semáforo: Meta Alcanzada (>80%)', color: 'var(--semaforo-verde, #10b981)' };
  };

  const semMeta = getSemaforoMeta(cumplimientoPct);

  // Pedidos pendientes por facturar calculados en tiempo real desde orders (excluyendo SOLICITUD_CLIENTE)
  const { basePendiente, pendingOrdersUsd } = useMemo(
    () => summarizePendingOrders(orders),
    [orders]
  );

  const kpiData = useMemo(() => ({
    litrosFacturados: totalLitros,
    cajasFacturadas: parseFloat((totalLitros / 11.35).toFixed(2)),
    pendienteFacturar: parseFloat(basePendiente.toFixed(2)),
    cajasPendientes: parseFloat((basePendiente / 11.35).toFixed(2)),
    totalProyectado: parseFloat((totalLitros + basePendiente).toFixed(2)),
    cajasTotales: parseFloat(((totalLitros + basePendiente) / 11.35).toFixed(2)),
    metaComercial: metaLitros,
    cajasMeta: parseFloat((metaLitros / 11.35).toFixed(2)),
    metaMensualBase: metaMensualBase,
    cajasMetaMensual: parseFloat((metaMensualBase / 11.35).toFixed(2)),
    cumplimientoMetaPct: cumplimientoPct
  }), [totalLitros, basePendiente, metaLitros, metaMensualBase, cumplimientoPct]);

  // Cartera de Clientes calculada directamente de profit_invoices y ventas a crédito (fecha local VE + deduplicación)
  const { cxcDia, cxcVen, cxcTot, cxcDiaPct, cxcVenPct } = useMemo(
    () => summarizeReceivablesAging({ profitInvoices, sales, tasaBcv, todayKey }),
    [profitInvoices, sales, tasaBcv, todayKey]
  );

  const carteraClientesData = cxcTot > 0
    ? [
        { name: 'CxC AL DÍA', value: cxcDia, pct: cxcDiaPct, color: '#002b7a' },
        { name: 'CxC VENCIDAS', value: cxcVen, pct: cxcVenPct, color: '#e60012' }
      ]
    : [
        { name: 'CARTERA AL DÍA', value: 1, pct: 100, color: '#10b981' }
      ];

  // Disponibilidad Bancaria calculada directamente de profit_bank_accounts en Supabase
  const disponibilidadBancariaData = useMemo(() => {
    if (!Array.isArray(profitBankAccounts) || profitBankAccounts.length === 0) return [];
    return profitBankAccounts
      .map(b => {
        const val = computeBankAccountValuation(b, config);
        return {
          banco: b.bancoNombre || b.banco_nombre || b.codCta || 'Banco',
          numCta: b.numCta || b.num_cta || '',
          monto: val.usd,
          montoBs: val.bs
        };
      })
      .filter(b => b.monto > 0 || b.montoBs > 0)
      .sort((a, b) => b.monto - a.monto);
  }, [profitBankAccounts, config]);

  const totalDisponibilidad = useMemo(() => {
    return disponibilidadBancariaData.reduce((acc, b) => acc + (Number(b.monto) || 0), 0);
  }, [disponibilidadBancariaData]);

  // Gestión de Cobranzas calculada directamente de profit_collections en Supabase (con normalización Profit Bs/USD y filtro de período)
  const cobranzasData = useMemo(() => {
    if (!Array.isArray(profitCollections) || profitCollections.length === 0) {
      return { acumulada: 0, enBs: 0, enBsUsd: 0, efectivoZelle: 0 };
    }

    const active = profitCollections.filter(c => {
      if (!c || isCxcInvoiceCancelled(c)) return false;
      const dateStr = c.fecha || c.fechaEmision || c.fecEmis || c.fecCob || c.createdAt || '';
      return isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth);
    });

    const isForeignMethod = (label, codCaja = '') => {
      const m = String(label || '').toUpperCase();
      const caja = String(codCaja || '').toUpperCase();
      return (
        m.includes('ZELLE') ||
        m.includes('EFECTIVO_USD') ||
        m.includes('DIVISA') ||
        m.includes('CASH') ||
        m.includes('USD') ||
        m.includes('USDT') ||
        m === 'EFEC' ||
        caja.includes('USDT')
      );
    };

    let sumUsd = 0;
    let sumBs = 0;
    let sumBsUsd = 0;
    let efectivoZelle = 0;

    active.forEach(c => {
      const { rawUsd, cTasa, effectiveTasa, usdVal, bsVal } = resolveCollectionNormalized(c, tasaBcv);
      sumUsd += usdVal;

      const formas = Array.isArray(c.formasPago) ? c.formasPago : [];
      if (formas.length > 0 && usdVal > 0) {
        const totalFpMonto = formas.reduce((acc, fp) => acc + (Number(fp.montoUsd ?? fp.monto ?? 0) || 0), 0);
        let cobBsEnItem = false;

        formas.forEach(fp => {
          const fpLabel = fp.tipo || fp.formaPago || fp.forma_pago || '';
          const fpUsdExplicit = Number(fp.montoUsd ?? fp.monto_usd ?? 0) || 0;
          const fpUsd = (fpUsdExplicit > 0 && !(cTasa > 10 && Math.abs(fpUsdExplicit - rawUsd) < 1 && usdVal < rawUsd))
            ? fpUsdExplicit
            : (totalFpMonto > 0 ? ((Number(fp.montoUsd ?? fp.monto ?? 0) || 0) / totalFpMonto) * usdVal : 0);

          if (isForeignMethod(fpLabel, fp.codCaja)) {
            efectivoZelle += fpUsd;
          } else {
            const fpUpper = String(fpLabel).toUpperCase();
            const isBsForm = fpUpper.includes('BS') || fpUpper === 'DEPO' || fpUpper === 'TRAN' || fpUpper === 'PAGO_MOVIL' || String(c.moneda || '').toUpperCase().includes('BS') || bsVal > 0;
            if (isBsForm) {
              sumBsUsd += fpUsd;
              cobBsEnItem = true;
            }
          }
        });

        if (cobBsEnItem && bsVal > 0) {
          sumBs += bsVal;
        } else if (cobBsEnItem && effectiveTasa > 0) {
          sumBs += usdVal * effectiveTasa;
        }
      } else {
        const metodo = (c.metodo || c.formaPago || c.forma_pago || c.tipo || '').toUpperCase();
        const moneda = String(c.moneda || '').toUpperCase();
        if (isForeignMethod(metodo) || ((moneda === 'US$' || moneda === 'USD') && !metodo && bsVal <= 0)) {
          efectivoZelle += usdVal;
        } else if (moneda.includes('BS') || bsVal > 0 || metodo.includes('DEPO') || metodo.includes('TRAN') || metodo.includes('BS')) {
          sumBsUsd += usdVal;
          sumBs += bsVal > 0 ? bsVal : (effectiveTasa > 0 ? usdVal * effectiveTasa : 0);
        }
      }
    });

    return {
      acumulada: parseFloat(sumUsd.toFixed(2)),
      enBs: parseFloat(sumBs.toFixed(2)),
      enBsUsd: parseFloat(sumBsUsd.toFixed(2)),
      efectivoZelle: parseFloat(efectivoZelle.toFixed(2))
    };
  }, [profitCollections, tasaBcv, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Objetivos Estratégicos (Abonos Proveedores acumulados/período y Saldo Pendiente CxP) desde Supabase
  const objetivosData = useMemo(() => {
    const activePayments = Array.isArray(profitSupplierPayments)
      ? profitSupplierPayments.filter(p => p && !isCxcInvoiceCancelled(p))
      : [];

    const totalAbonos = activePayments.reduce(
      (sum, p) => sum + resolveAmountUsd(p, ['montoUsd', 'monto_usd'], ['montoBs', 'monto_bs'], tasaBcv),
      0
    );

    const abonosPeriodo = activePayments
      .filter(p => isWithinFiscalPeriod(p.fechaPago || p.fec_pago || p.fecha || p.createdAt, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth))
      .reduce((sum, p) => sum + resolveAmountUsd(p, ['montoUsd', 'monto_usd'], ['montoBs', 'monto_bs'], tasaBcv), 0);

    const totalSaldoPendiente = Array.isArray(profitAccountsPayable)
      ? profitAccountsPayable
          .filter(d => d && !isCxcInvoiceSettled(d))
          .reduce((sum, d) => sum + resolveAmountUsd(d, ['saldoUsd', 'saldo_usd'], ['saldoBs', 'saldo_bs'], tasaBcv), 0)
      : 0;

    return {
      abonosProveedores: parseFloat(totalAbonos.toFixed(2)),
      abonosPeriodo: parseFloat(abonosPeriodo.toFixed(2)),
      saldoPendiente: parseFloat(totalSaldoPendiente.toFixed(2)),
      flujoNetoPeriodo: parseFloat((cobranzasData.acumulada - abonosPeriodo).toFixed(2))
    };
  }, [profitSupplierPayments, profitAccountsPayable, tasaBcv, cobranzasData.acumulada, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  const comparativoMetaData = selectedMonth === 'ALL'
    ? [
        { name: 'Facturado', valor: kpiData.litrosFacturados, color: '#00f2fe' },
        { name: 'Pendiente', valor: kpiData.pendienteFacturar, color: '#ffb703' },
        { name: 'Meta Anual', valor: kpiData.metaComercial, color: '#e60012' }
      ]
    : [
        { name: 'Facturado', valor: kpiData.litrosFacturados, color: '#00f2fe' },
        { name: 'Pendiente', valor: kpiData.pendienteFacturar, color: '#ffb703' },
        { name: 'Meta Mes', valor: kpiData.metaComercial, color: '#e60012' }
      ];

  // ── Facturación Neta Total en USD y Bs en el período seleccionado ────────────────
  const totalFacturadoUsd = useMemo(() => {
    const invTotal = (filteredProfitInvoices || []).reduce((acc, f) => {
      return acc + (Number(f.totNetoUsd ?? f.tot_neto_usd ?? f.totalNetoUsd ?? 0) || 0);
    }, 0);
    const salesTotal = (unduplicatedSales || []).filter(s => {
      const dateStr = s.fecha || s.fechaEmision || s.fecha_emision || '';
      return isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth);
    }).reduce((acc, s) => acc + (Number(s.totalUsd ?? s.total_usd ?? 0) || 0), 0);
    return parseFloat((invTotal + salesTotal).toFixed(2));
  }, [filteredProfitInvoices, unduplicatedSales, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Precio Promedio por Litro ($ / L) en el período
  const precioPromedioLitro = useMemo(() => {
    if (totalLitros <= 0) return 0;
    return parseFloat((totalFacturadoUsd / totalLitros).toFixed(2));
  }, [totalFacturadoUsd, totalLitros]);

  // ── VENTAS DEL DÍA & ACUMULADO MENSUAL (Montos y Lubricantes) ─────────────────

  // Mes del acumulado (independiente del filtro de cumplimiento; por defecto el mes en curso)
  const [ventasMesFilter, setVentasMesFilter] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [ventasDetalleTab, setVentasDetalleTab] = useState('hoy'); // 'hoy' | 'mes'

  // Documentos de venta normalizados y deduplicados (Facturas/N.E. Profit + Ventas POS sin doble conteo)
  const ventasDocsNormalizados = useMemo(() => {
    const productsBySku = new Map();
    (products || []).forEach(p => {
      const sku = String(p.codigo || p.id || '').trim();
      if (sku) productsBySku.set(sku, p);
    });
    const isServiceItem = (desc) => {
      const d = (desc || '').toLowerCase();
      return d.includes('flete') || d.includes('servicio');
    };
    const getDocDedupKey = (tipoRaw, numRaw) => {
      const str = String(numRaw || '').trim().toUpperCase();
      if (!str) return '';
      const m = str.match(/(\d+)$/);
      const num = m ? String(Number(m[1])) : str;
      const tUpper = String(tipoRaw || '').toUpperCase();
      const prefix = (tUpper.includes('NOTA_ENTREGA') || str.startsWith('NE-') || str.startsWith('NDE-'))
        ? 'NE'
        : (tUpper.includes('NOTA_CREDITO') || str.startsWith('NC-'))
          ? 'NC'
          : (tUpper.includes('NOTA_DEBITO') || str.startsWith('ND-'))
            ? 'ND'
            : 'FAC';
      return `${prefix}|${num}`;
    };
    const normalizeDocItems = (rawItems = [], tasaDoc = tasaBcv, headerLitros = 0) => {
      const mapped = (rawItems || []).map(it => {
        const sku = String(it.articuloId || it.codigo || it.id || '').trim();
        const prod = productsBySku.get(sku);
        const desc = it.descripcion || it.nombre || prod?.descripcion || prod?.nombre || sku || 'Lubricante';
        const cantidad = Number(it.cantidad || 0);
        const ltsUnit = Number(
          it.litrosUnitarios ??
          it.litrosPorUnidad ??
          (prod ? resolveProductLitersPerUnit(prod) : 0)
        ) || 0;
        const litros = Number(it.litrosTotales ?? it.litros ?? (cantidad * ltsUnit)) || 0;
        const usdDirect = Number(it.totalUsd ?? it.subtotalUsd ?? 0);
        const usd = usdDirect > 0
          ? usdDirect
          : ((Number(it.totalNeto || 0) || 0) / (tasaDoc > 1 ? tasaDoc : 1)) || (Number(it.precioUsd || 0) * cantidad);
        return {
          sku,
          desc,
          cantidad,
          litros,
          usd,
          esServicio: isServiceItem(desc)
        };
      });
      if (mapped.length === 1 && mapped[0].sku === 'LUB-MANUAL' && mapped[0].litros === 0 && headerLitros > 0) {
        mapped[0].litros = headerLitros;
      }
      return mapped;
    };

    // Índice auxiliar de sales para recuperar items si profit_invoices los tiene vacíos
    const salesById = new Map();
    const salesByKey = new Map();
    (sales || []).forEach(s => {
      if (!s || s.anulada) return;
      if (s.id) salesById.set(String(s.id), s);
      const dk = getDocDedupKey(s.tipoDoc || s.tipo_doc, s.numeroDoc || s.numero_doc || s.id);
      if (dk && !salesByKey.has(dk)) salesByKey.set(dk, s);
    });

    const seenIds = new Set();
    const seenDocKeys = new Set();
    const docs = [];

    (dedupeCanonicalDocs(profitInvoices) || []).forEach(inv => {
      if (!inv || inv.anulada) return;
      const tipo = inv.tipoDoc || inv.tipo_doc || '';
      if (String(tipo).toUpperCase() === 'NOTA_CREDITO') return;
      const dateKey = toDateKey(inv.fechaEmision || inv.fecEmis || inv.fec_emis || inv.fecha);
      if (!dateKey) return;

      const idStr = inv.id ? String(inv.id) : '';
      const dk = getDocDedupKey(tipo, inv.factNum || inv.fact_num || inv.originalFactNum || inv.id);
      if ((idStr && seenIds.has(idStr)) || (dk && seenDocKeys.has(dk))) return;
      if (idStr) seenIds.add(idStr);
      if (dk) seenDocKeys.add(dk);

      const usd = Number(inv.totNetoUsd ?? inv.tot_neto_usd ?? inv.totalNetoUsd ?? 0) || 0;
      const bsRaw = Number(inv.totNetoBs ?? inv.tot_neto_bs ?? 0) || 0;
      const tasaDoc = Number(inv.tasa) > 1 ? Number(inv.tasa) : tasaBcv;
      const headerLitros = Number(inv.totalLitros ?? inv.total_litros ?? 0) || 0;

      const matchingSale = (idStr && salesById.get(idStr)) || (dk && salesByKey.get(dk));
      const rawItems = (Array.isArray(inv.items) && inv.items.length > 0)
        ? inv.items
        : (matchingSale?.items || []);
      const items = normalizeDocItems(rawItems, tasaDoc, headerLitros);
      const itemsLitros = items.reduce((acc, it) => acc + it.litros, 0);
      const docCategory = dk.startsWith('NE|') ? 'NE' : 'FISCAL';

      docs.push({
        dateKey,
        docCategory,
        usd,
        bs: bsRaw > 0 ? bsRaw : usd * tasaBcv,
        litros: headerLitros > 0 ? headerLitros : itemsLitros,
        cliente: inv.clienteNombre || inv.cliente_nombre || inv.cli_des || inv.clienteId || '',
        items
      });
    });

    (sales || []).forEach(s => {
      if (!s || s.anulada) return;
      const tipo = s.tipoDoc || s.tipo_doc || '';
      if (String(tipo).toUpperCase() === 'NOTA_CREDITO') return;

      const idStr = s.id ? String(s.id) : '';
      const dk = getDocDedupKey(tipo, s.numeroDoc || s.numero_doc || s.id);
      if ((idStr && seenIds.has(idStr)) || (dk && seenDocKeys.has(dk))) return;
      if (idStr) seenIds.add(idStr);
      if (dk) seenDocKeys.add(dk);

      const dateKey = toDateKey(s.fecha || s.fechaEmision || s.fecha_emision);
      if (!dateKey) return;
      const usd = Number(s.totalUsd ?? s.total_usd ?? 0) || 0;
      const bsRaw = Number(s.totalBs ?? s.total_bs ?? 0) || 0;
      const tasaDoc = Number(s.tasaDolar ?? s.tasa_dolar ?? 0) > 1 ? Number(s.tasaDolar ?? s.tasa_dolar) : tasaBcv;
      const headerLitros = Number(s.totalLitros ?? s.total_litros ?? 0) || 0;
      const items = normalizeDocItems(s.items || [], tasaDoc, headerLitros);
      const itemsLitros = items.reduce((acc, it) => acc + it.litros, 0);
      const docCategory = dk.startsWith('NE|') ? 'NE' : 'FISCAL';

      docs.push({
        dateKey,
        docCategory,
        usd,
        bs: bsRaw > 0 ? bsRaw : usd * tasaBcv,
        litros: headerLitros > 0 ? headerLitros : itemsLitros,
        cliente: s.clienteNombre || s.cliente_nombre || s.cliente || '',
        items
      });
    });

    return docs;
  }, [profitInvoices, sales, products, tasaBcv]);

  const resumirVentas = (docs) => {
    const prodMap = new Map();
    const clientes = new Set();
    let usd = 0, bs = 0, litros = 0;
    docs.forEach(d => {
      usd += d.usd;
      bs += d.bs;
      litros += d.litros;
      if (d.cliente) clientes.add(d.cliente);
      d.items.forEach(it => {
        if (it.esServicio || !it.sku) return;
        const prev = prodMap.get(it.sku) || { sku: it.sku, desc: it.desc, cantidad: 0, litros: 0, usd: 0 };
        prev.cantidad += it.cantidad;
        prev.litros += it.litros;
        prev.usd += it.usd;
        prodMap.set(it.sku, prev);
      });
    });
    const topProductos = Array.from(prodMap.values())
      .sort((a, b) => b.litros - a.litros || b.usd - a.usd)
      .slice(0, 8);
    return {
      usd: parseFloat(usd.toFixed(2)),
      bs: parseFloat(bs.toFixed(2)),
      litros: parseFloat(litros.toFixed(2)),
      cajas: parseFloat((litros / 11.35).toFixed(1)),
      documentos: docs.length,
      clientes: clientes.size,
      skus: prodMap.size,
      topProductos
    };
  };

  const ventasDelDia = useMemo(() => {
    const hoy = resumirVentas(ventasDocsNormalizados.filter(d => d.dateKey === todayKey));
    const ayerDate = new Date();
    ayerDate.setDate(ayerDate.getDate() - 1);
    const ayerKey = toDateKey(ayerDate);
    const ayer = ventasDocsNormalizados
      .filter(d => d.dateKey === ayerKey)
      .reduce((acc, d) => ({ usd: acc.usd + d.usd, litros: acc.litros + d.litros }), { usd: 0, litros: 0 });
    return { ...hoy, ayerUsd: parseFloat(ayer.usd.toFixed(2)), ayerLitros: parseFloat(ayer.litros.toFixed(2)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventasDocsNormalizados, todayKey]);

  const ventasAcumuladoMes = useMemo(() => {
    const prefix = `${anioActivo}-${ventasMesFilter}`;
    const resumen = resumirVentas(ventasDocsNormalizados.filter(d => d.dateKey.startsWith(prefix) && d.dateKey <= todayKey));
    const monthIdx = Number(ventasMesFilter);
    const diasDelMes = new Date(Number(anioActivo), monthIdx, 0).getDate();
    const currentPrefix = todayKey.substring(0, 7);
    let diasTranscurridos;
    if (prefix === currentPrefix) diasTranscurridos = Number(todayKey.substring(8, 10));
    else if (prefix < currentPrefix) diasTranscurridos = diasDelMes;
    else diasTranscurridos = 0;
    const esMesEnCurso = prefix === currentPrefix;
    const promedioDiarioUsd = diasTranscurridos > 0 ? resumen.usd / diasTranscurridos : 0;
    const promedioDiarioLitros = diasTranscurridos > 0 ? resumen.litros / diasTranscurridos : 0;
    const meta = Number(metaMensualBase) || 0;
    return {
      ...resumen,
      diasDelMes,
      diasTranscurridos,
      esMesEnCurso,
      esFuturo: prefix > currentPrefix,
      promedioDiarioUsd: parseFloat(promedioDiarioUsd.toFixed(2)),
      promedioDiarioLitros: parseFloat(promedioDiarioLitros.toFixed(1)),
      proyeccionLitros: esMesEnCurso ? parseFloat((promedioDiarioLitros * diasDelMes).toFixed(1)) : resumen.litros,
      proyeccionUsd: esMesEnCurso ? parseFloat((promedioDiarioUsd * diasDelMes).toFixed(2)) : resumen.usd,
      metaLitros: meta,
      pctMeta: meta > 0 ? parseFloat(((resumen.litros / meta) * 100).toFixed(1)) : 0
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventasDocsNormalizados, ventasMesFilter, anioActivo, todayKey, metaMensualBase]);

  const todayLabel = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number);
    if (!y) return '';
    return new Date(y, m - 1, d).toLocaleDateString('es-VE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }, [todayKey]);

  // Efectividad de Cobranza (% recaudado vs facturado)
  const efectividadCobranzaPct = useMemo(() => {
    if (totalFacturadoUsd <= 0) return 100;
    const pct = (cobranzasData.acumulada / totalFacturadoUsd) * 100;
    return parseFloat(Math.min(pct, 100).toFixed(1));
  }, [cobranzasData.acumulada, totalFacturadoUsd]);

  // Métricas de Clientes, Ticket Promedio y Top 5 Clientes en el período
  const { ticketPromedioUsd, cantDocumentos, clientesActivosCount, topClientesData } = useMemo(() => {
    const filteredSales = (unduplicatedSales || []).filter(s => {
      const dateStr = s.fecha || s.fechaEmision || s.fecha_emision || '';
      return isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth);
    });

    const cantDocs = (filteredProfitInvoices || []).length + filteredSales.length;
    const ticket = cantDocs > 0 ? parseFloat((totalFacturadoUsd / cantDocs).toFixed(2)) : 0;

    const clientByRif = new Map();
    const clientByCode = new Map();
    const clientByName = new Map();
    (clients || []).forEach(c => {
      if (!c) return;
      const rKey = normalizeClientRifKey(c.rif);
      if (rKey && !clientByRif.has(rKey)) clientByRif.set(rKey, c);
      const idKey = normalizeClientCodeKey(c.id);
      if (idKey && !clientByCode.has(idKey)) clientByCode.set(idKey, c);
      const coKey = normalizeClientCodeKey(c.codigo ?? c.co_cli);
      if (coKey && !clientByCode.has(coKey)) clientByCode.set(coKey, c);
      const nKey = normalizeClientNameKey(c.nombre || c.razonSocial);
      if (nKey && !clientByName.has(nKey)) clientByName.set(nKey, c);
    });

    const clientMap = new Map();
    const accumulateClient = (cid, cname, crif, montoUsd) => {
      const rawRifKey = normalizeClientRifKey(crif);
      const rawCodeKey = normalizeClientCodeKey(cid);
      const rawNameKey = normalizeClientNameKey(cname);
      const profile =
        (rawRifKey && clientByRif.get(rawRifKey)) ||
        (rawCodeKey && clientByCode.get(rawCodeKey)) ||
        (rawNameKey && clientByName.get(rawNameKey)) ||
        null;

      const resolvedRifKey = normalizeClientRifKey(profile?.rif || crif);
      const resolvedCodeKey = normalizeClientCodeKey(profile?.codigo || profile?.co_cli || profile?.id || cid);
      const resolvedNameKey = normalizeClientNameKey(profile?.nombre || profile?.razonSocial || cname);
      const key = resolvedRifKey
        ? `RIF:${resolvedRifKey}`
        : (resolvedCodeKey ? `CODE:${resolvedCodeKey}` : (resolvedNameKey ? `NAME:${resolvedNameKey}` : ''));
      if (!key) return;

      const current = clientMap.get(key) || {
        id: profile?.id || profile?.codigo || cid || key,
        nombre: profile?.nombre || profile?.razonSocial || cname || key,
        rif: profile?.rif || crif || '',
        totalUsd: 0,
        facturasCount: 0
      };
      current.totalUsd += montoUsd;
      current.facturasCount += 1;
      clientMap.set(key, current);
    };

    (filteredProfitInvoices || []).forEach(f => {
      const cid = f.clienteId || f.cliente_id || f.co_cli;
      const cname = f.clienteNombre || f.cliente_nombre || f.cli_des || cid;
      const crif = f.clienteRif || f.cliente_rif || f.rif || '';
      const monto = Number(f.totNetoUsd ?? f.tot_neto_usd ?? f.totalNetoUsd ?? 0) || 0;
      accumulateClient(cid, cname, crif, monto);
    });

    filteredSales.forEach(s => {
      const cid = s.clienteId || s.cliente_id || s.co_cli || s.cliente;
      const cname = s.clienteNombre || s.cliente_nombre || s.cliente || cid;
      const crif = s.clienteRif || s.cliente_rif || s.rif || '';
      const monto = Number(s.totalUsd ?? s.total_usd ?? 0) || 0;
      accumulateClient(cid, cname, crif, monto);
    });

    const activeCount = clientMap.size;
    const sortedTop = Array.from(clientMap.values())
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 5)
      .map(c => ({
        ...c,
        totalUsd: parseFloat(c.totalUsd.toFixed(2)),
        pctTotal: totalFacturadoUsd > 0 ? parseFloat(((c.totalUsd / totalFacturadoUsd) * 100).toFixed(1)) : 0
      }));

    return {
      ticketPromedioUsd: ticket,
      cantDocumentos: cantDocs,
      clientesActivosCount: activeCount,
      topClientesData: sortedTop
    };
  }, [filteredProfitInvoices, unduplicatedSales, clients, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva, totalFacturadoUsd]);

  // Desglose Fiscal vs. Notas de Entrega (N.E.) y Notas de Crédito en el período activo
  const docTypeBreakdown = useMemo(() => {
    let fiscalUsd = 0, fiscalLitros = 0, fiscalCount = 0;
    let neUsd = 0, neLitros = 0, neCount = 0;

    ventasDocsNormalizados.forEach(d => {
      if (!isWithinFiscalPeriod(d.dateKey, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth)) return;
      if (d.docCategory === 'NE') {
        neUsd += d.usd;
        neLitros += d.litros;
        neCount += 1;
      } else {
        fiscalUsd += d.usd;
        fiscalLitros += d.litros;
        fiscalCount += 1;
      }
    });

    let ncUsd = 0, ncCount = 0;
    dedupeCanonicalDocs(profitInvoices || []).forEach(inv => {
      if (!inv || isCxcInvoiceCancelled(inv)) return;
      const tipo = String(inv.tipoDoc || inv.tipo_doc || '').toUpperCase();
      if (tipo !== 'NOTA_CREDITO') return;
      const dateStr = inv.fechaEmision || inv.fecEmis || inv.fec_emis || inv.fecha || '';
      if (!isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth)) return;
      ncUsd += Number(inv.totNetoUsd ?? inv.tot_neto_usd ?? inv.totalNetoUsd ?? 0) || 0;
      ncCount += 1;
    });

    const totalCombined = fiscalUsd + neUsd;
    return {
      fiscalUsd: parseFloat(fiscalUsd.toFixed(2)),
      fiscalLitros: parseFloat(fiscalLitros.toFixed(2)),
      fiscalCount,
      fiscalPct: totalCombined > 0 ? parseFloat(((fiscalUsd / totalCombined) * 100).toFixed(1)) : 0,
      neUsd: parseFloat(neUsd.toFixed(2)),
      neLitros: parseFloat(neLitros.toFixed(2)),
      neCount,
      nePct: totalCombined > 0 ? parseFloat(((neUsd / totalCombined) * 100).toFixed(1)) : 0,
      ncUsd: parseFloat(ncUsd.toFixed(2)),
      ncCount
    };
  }, [ventasDocsNormalizados, profitInvoices, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth]);

  // Comparativo Mes vs. Mes Anterior (MoM) para Ventas USD, Litros y Cobranzas
  const momComparison = useMemo(() => {
    const activeMonthsInYear = Array.from(new Set(
      ventasDocsNormalizados
        .filter(d => d.dateKey && d.dateKey.startsWith(`${anioActivo}-`) && d.dateKey <= todayKey)
        .map(d => d.dateKey.substring(0, 7))
    )).sort();

    const targetPrefix = selectedMonth !== 'ALL'
      ? `${anioActivo}-${selectedMonth}`
      : (activeMonthsInYear[activeMonthsInYear.length - 1] || `${anioActivo}-${todayKey.substring(5, 7)}`);

    const [tYear, tMonth] = targetPrefix.split('-').map(Number);
    const prevDate = new Date(tYear, (tMonth || 1) - 2, 1);
    const prevPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const monthShort = (prefix) => {
      const mId = prefix.substring(5, 7);
      const found = MONTHS_LIST.find(m => m.id === mId);
      return found ? `${found.short} ${prefix.substring(0, 4)}` : prefix;
    };

    let facturadoCurr = 0, facturadoPrev = 0;
    let litrosCurr = 0, litrosPrev = 0;
    ventasDocsNormalizados.forEach(d => {
      if (!d.dateKey) return;
      if (d.dateKey.startsWith(targetPrefix)) {
        facturadoCurr += d.usd;
        litrosCurr += d.litros;
      } else if (d.dateKey.startsWith(prevPrefix)) {
        facturadoPrev += d.usd;
        litrosPrev += d.litros;
      }
    });

    let cobCurr = 0, cobPrev = 0;
    (profitCollections || []).forEach(c => {
      if (!c || isCxcInvoiceCancelled(c)) return;
      const dKey = toDateKey(c.fecha || c.fec_cob || c.fec_emis || c.createdAt);
      if (!dKey) return;
      const { usdVal } = resolveCollectionNormalized(c, tasaBcv);
      if (dKey.startsWith(targetPrefix)) cobCurr += usdVal;
      else if (dKey.startsWith(prevPrefix)) cobPrev += usdVal;
    });

    const calcDeltaPct = (curr, prev) => {
      if (prev <= 0) return null;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    };

    return {
      targetPrefix,
      prevPrefix,
      targetLabel: monthShort(targetPrefix),
      prevLabel: monthShort(prevPrefix),
      facturadoCurr: parseFloat(facturadoCurr.toFixed(2)),
      facturadoPrev: parseFloat(facturadoPrev.toFixed(2)),
      facturadoPct: calcDeltaPct(facturadoCurr, facturadoPrev),
      litrosCurr: parseFloat(litrosCurr.toFixed(2)),
      litrosPrev: parseFloat(litrosPrev.toFixed(2)),
      litrosPct: calcDeltaPct(litrosCurr, litrosPrev),
      cobCurr: parseFloat(cobCurr.toFixed(2)),
      cobPrev: parseFloat(cobPrev.toFixed(2)),
      cobPct: calcDeltaPct(cobCurr, cobPrev)
    };
  }, [ventasDocsNormalizados, profitCollections, tasaBcv, anioActivo, selectedMonth, todayKey, MONTHS_LIST]);

  // Analítica Completa Bloque 5: Cuentas por Pagar (CxP), Antigüedad, Proveedores y Flujo Compras vs. Abonos
  const cxpAnalytics = useMemo(() => {
    const todayDate = new Date(`${todayKey}T12:00:00`);
    const buckets = {
      VIGENTE: { montoUsd: 0, count: 0 },
      '1_15': { montoUsd: 0, count: 0 },
      '16_30': { montoUsd: 0, count: 0 },
      OVER_30: { montoUsd: 0, count: 0 }
    };

    let totalVigenteUsd = 0;
    let totalVencidoUsd = 0;
    let porVencer15Usd = 0;
    let porVencer15Count = 0;
    let openDocsCount = 0;
    let vencidosDocsCount = 0;
    let monedaUsd = 0;
    let monedaBsUsd = 0;

    const supplierMap = new Map();
    const docTypeMap = new Map();
    const openDocsList = [];

    (profitAccountsPayable || []).forEach(d => {
      if (!d || isCxcInvoiceSettled(d)) return;
      const saldoUsd = resolveAmountUsd(d, ['saldoUsd', 'saldo_usd'], ['saldoBs', 'saldo_bs'], tasaBcv);
      if (saldoUsd <= 0.01) return;

      openDocsCount += 1;
      const montoNetUsd = resolveAmountUsd(d, ['montoNetUsd', 'monto_net_usd', 'montoNetoUsd'], ['montoNetBs', 'monto_net_bs'], tasaBcv);
      const emisKey = toDateKey(d.fechaEmision || d.fec_emis || d.fecha) || '';
      const vencKey = toDateKey(d.fechaVencimiento || d.fec_venc || d.fechaEmision || d.fec_emis) || emisKey;

      let diffDays = 0;
      if (vencKey) {
        const vencDate = new Date(`${vencKey}T12:00:00`);
        if (!isNaN(vencDate.getTime())) {
          diffDays = Math.ceil((todayDate - vencDate) / 86400000);
        }
      }

      let bucketKey = 'VIGENTE';
      if (diffDays <= 0) {
        bucketKey = 'VIGENTE';
        totalVigenteUsd += saldoUsd;
        if (diffDays >= -15) {
          porVencer15Usd += saldoUsd;
          porVencer15Count += 1;
        }
      } else {
        totalVencidoUsd += saldoUsd;
        vencidosDocsCount += 1;
        if (diffDays <= 15) bucketKey = '1_15';
        else if (diffDays <= 30) bucketKey = '16_30';
        else bucketKey = 'OVER_30';
      }
      buckets[bucketKey].montoUsd += saldoUsd;
      buckets[bucketKey].count += 1;

      const monedaUpper = String(d.moneda || '').toUpperCase();
      if (monedaUpper.includes('BS')) monedaBsUsd += saldoUsd;
      else monedaUsd += saldoUsd;

      const tipoDocRaw = String(d.tipoDoc || d.tipo_doc || 'FACT').toUpperCase();
      const prevTipo = docTypeMap.get(tipoDocRaw) || { tipo: tipoDocRaw, montoUsd: 0, count: 0 };
      prevTipo.montoUsd += saldoUsd;
      prevTipo.count += 1;
      docTypeMap.set(tipoDocRaw, prevTipo);

      const provNombre = (d.provNombre || d.prov_nombre || d.coProv || d.co_prov || 'Proveedor S/N').trim();
      const provKey = String(d.coProv || d.co_prov || d.provRif || d.prov_rif || provNombre).trim().toUpperCase();
      const prevSup = supplierMap.get(provKey) || {
        key: provKey,
        nombre: provNombre,
        rif: d.provRif || d.prov_rif || '',
        coProv: d.coProv || d.co_prov || '',
        saldoUsd: 0,
        vencidoUsd: 0,
        vigenteUsd: 0,
        docsCount: 0,
        maxDiasMora: 0
      };
      prevSup.saldoUsd += saldoUsd;
      if (diffDays > 0) {
        prevSup.vencidoUsd += saldoUsd;
        if (diffDays > prevSup.maxDiasMora) prevSup.maxDiasMora = diffDays;
      } else {
        prevSup.vigenteUsd += saldoUsd;
      }
      prevSup.docsCount += 1;
      supplierMap.set(provKey, prevSup);

      openDocsList.push({
        id: d.id || `${tipoDocRaw}-${d.nroDoc || d.nro_doc || openDocsCount}`,
        tipoDoc: tipoDocRaw,
        nroDoc: d.nroDoc || d.nro_doc || 'S/N',
        provNombre,
        fechaEmision: emisKey,
        fechaVencimiento: vencKey,
        diasMora: diffDays > 0 ? diffDays : 0,
        diasRestantes: diffDays < 0 ? Math.abs(diffDays) : 0,
        bucket: bucketKey,
        moneda: monedaUpper || 'US$',
        montoNetUsd: parseFloat(montoNetUsd.toFixed(2)),
        saldoUsd: parseFloat(saldoUsd.toFixed(2))
      });
    });

    const totalSaldoUsd = parseFloat((totalVigenteUsd + totalVencidoUsd).toFixed(2));
    const morosidadPct = totalSaldoUsd > 0 ? parseFloat(((totalVencidoUsd / totalSaldoUsd) * 100).toFixed(1)) : 0;
    const urgenteUsd = totalVencidoUsd + porVencer15Usd;
    const coberturaRatio = urgenteUsd > 0
      ? parseFloat((totalDisponibilidad / urgenteUsd).toFixed(2))
      : (totalDisponibilidad > 0 ? 99 : 0);

    const agingChartData = [
      { label: 'Vigente', bucket: 'VIGENTE', montoUsd: parseFloat(buckets.VIGENTE.montoUsd.toFixed(2)), count: buckets.VIGENTE.count, color: '#10b981' },
      { label: '1-15 días', bucket: '1_15', montoUsd: parseFloat(buckets['1_15'].montoUsd.toFixed(2)), count: buckets['1_15'].count, color: '#f59e0b' },
      { label: '16-30 días', bucket: '16_30', montoUsd: parseFloat(buckets['16_30'].montoUsd.toFixed(2)), count: buckets['16_30'].count, color: '#f97316' },
      { label: '>30 días', bucket: 'OVER_30', montoUsd: parseFloat(buckets.OVER_30.montoUsd.toFixed(2)), count: buckets.OVER_30.count, color: '#ef4444' }
    ];

    const topProveedores = Array.from(supplierMap.values())
      .sort((a, b) => b.saldoUsd - a.saldoUsd)
      .slice(0, 6)
      .map(s => ({
        ...s,
        saldoUsd: parseFloat(s.saldoUsd.toFixed(2)),
        vencidoUsd: parseFloat(s.vencidoUsd.toFixed(2)),
        vigenteUsd: parseFloat(s.vigenteUsd.toFixed(2)),
        pctTotal: totalSaldoUsd > 0 ? parseFloat(((s.saldoUsd / totalSaldoUsd) * 100).toFixed(1)) : 0
      }));

    const criticalDocs = openDocsList
      .sort((a, b) => b.diasMora - a.diasMora || b.saldoUsd - a.saldoUsd)
      .slice(0, 6);

    const monthlyFlowMap = new Map(
      MONTHS_LIST.map(m => [m.id, { mesId: m.id, mes: m.short, comprasUsd: 0, abonosUsd: 0 }])
    );

    (profitPurchases || []).forEach(p => {
      if (!p || isCxcInvoiceCancelled(p)) return;
      const dKey = toDateKey(p.fechaEmision || p.fec_emis || p.fecha);
      if (!dKey || !dKey.startsWith(`${anioActivo}-`)) return;
      const mId = dKey.substring(5, 7);
      const entry = monthlyFlowMap.get(mId);
      if (entry) {
        entry.comprasUsd += resolveAmountUsd(p, ['totNetoUsd', 'tot_neto_usd'], ['totNetoBs', 'tot_neto_bs'], tasaBcv);
      }
    });

    (profitSupplierPayments || []).forEach(p => {
      if (!p || isCxcInvoiceCancelled(p)) return;
      const dKey = toDateKey(p.fechaPago || p.fec_pago || p.fecha || p.createdAt);
      if (!dKey || !dKey.startsWith(`${anioActivo}-`)) return;
      const mId = dKey.substring(5, 7);
      const entry = monthlyFlowMap.get(mId);
      if (entry) {
        entry.abonosUsd += resolveAmountUsd(p, ['montoUsd', 'monto_usd'], ['montoBs', 'monto_bs'], tasaBcv);
      }
    });

    const currentMonthId = todayKey.substring(5, 7);
    const comprasVsAbonosMensual = Array.from(monthlyFlowMap.values())
      .filter(m => m.comprasUsd > 0 || m.abonosUsd > 0 || m.mesId <= currentMonthId)
      .map(m => ({
        mes: m.mes,
        comprasUsd: parseFloat(m.comprasUsd.toFixed(2)),
        abonosUsd: parseFloat(m.abonosUsd.toFixed(2))
      }));

    return {
      totalSaldoUsd,
      totalVigenteUsd: parseFloat(totalVigenteUsd.toFixed(2)),
      totalVencidoUsd: parseFloat(totalVencidoUsd.toFixed(2)),
      porVencer15Usd: parseFloat(porVencer15Usd.toFixed(2)),
      porVencer15Count,
      morosidadPct,
      openDocsCount,
      vencidosDocsCount,
      suppliersWithDebtCount: supplierMap.size,
      urgenteUsd: parseFloat(urgenteUsd.toFixed(2)),
      coberturaRatio,
      agingChartData,
      topProveedores,
      criticalDocs,
      comprasVsAbonosMensual,
      currencyBreakdown: {
        usd: parseFloat(monedaUsd.toFixed(2)),
        bsUsd: parseFloat(monedaBsUsd.toFixed(2)),
        usdPct: totalSaldoUsd > 0 ? parseFloat(((monedaUsd / totalSaldoUsd) * 100).toFixed(1)) : 0,
        bsPct: totalSaldoUsd > 0 ? parseFloat(((monedaBsUsd / totalSaldoUsd) * 100).toFixed(1)) : 0
      },
      docTypeBreakdownCxp: Array.from(docTypeMap.values())
        .map(t => ({ ...t, montoUsd: parseFloat(t.montoUsd.toFixed(2)) }))
        .sort((a, b) => b.montoUsd - a.montoUsd)
    };
  }, [profitAccountsPayable, profitPurchases, profitSupplierPayments, tasaBcv, totalDisponibilidad, todayKey, anioActivo, MONTHS_LIST]);

  // Métricas de Inventario, Valorización y Mix de Líneas de Producto
  const { stockTotalLitros, stockTotalUnidades, stockTotalCajas, stockValorizadoUsd, productosEnRopCount, mixLineasData, breakdownByUnit, stockBreakdownLabel } = useMemo(() => {
    let totalStockLts = 0;
    let totalUnits = 0;
    let totalCajas = 0;
    let valUsd = 0;
    let ropCount = 0;
    const linesMap = new Map();
    const breakdown = { Caja: 0, Paila: 0, Tambor: 0, Totem: 0, Litros: 0 };

    (products || []).forEach(p => {
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnidad = resolveProductLitersPerUnit(p);
      const lts = cant * ltsUnidad;
      totalStockLts += lts;
      totalUnits += cant;

      const unit = resolveProductUnit(p, 'Caja');
      if (breakdown[unit] !== undefined) {
        breakdown[unit] += cant;
      }
      if (unit === 'Caja') {
        totalCajas += cant;
      }

      const costo = Number(p.costoUsd ?? p.costo ?? p.costo_unitario ?? 0);
      valUsd += cant * costo;

      const min = Number(p.puntoReorden ?? p.punto_reorden ?? p.stockMinimo ?? 5);
      if (cant <= min) ropCount++;

      const linea = (p.linea || p.categoria || p.categoria_nombre || 'Lubricantes General').trim();
      linesMap.set(linea, (linesMap.get(linea) || 0) + lts);
    });

    const breakdownItems = [
      breakdown.Caja > 0 ? `${breakdown.Caja.toLocaleString('es-VE')} Cajas` : null,
      breakdown.Paila > 0 ? `${breakdown.Paila.toLocaleString('es-VE')} Pailas` : null,
      breakdown.Tambor > 0 ? `${breakdown.Tambor.toLocaleString('es-VE')} Tambores` : null,
      breakdown.Totem > 0 ? `${breakdown.Totem.toLocaleString('es-VE')} Totem` : null,
      breakdown.Litros > 0 ? `${breakdown.Litros.toLocaleString('es-VE')} L Granel` : null
    ].filter(Boolean);

    const stockBreakdownLabel = breakdownItems.join(' • ') || '0 Unidades';

    const lineColors = ['#002b7a', '#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];
    const mixData = Array.from(linesMap.entries())
      .map(([name, litros], idx) => ({
        name,
        litros: Math.round(litros),
        color: lineColors[idx % lineColors.length]
      }))
      .filter(item => item.litros > 0)
      .sort((a, b) => b.litros - a.litros)
      .slice(0, 6);

    return {
      stockTotalLitros: parseFloat(totalStockLts.toFixed(2)),
      stockTotalUnidades: totalUnits,
      stockTotalCajas: totalCajas,
      stockValorizadoUsd: parseFloat(valUsd.toFixed(2)),
      productosEnRopCount: ropCount,
      mixLineasData: mixData,
      breakdownByUnit: breakdown,
      stockBreakdownLabel
    };
  }, [products]);

  // Análisis Especializado de Lubricantes: Rotación, Más/Menos Vendidos, Capital Inmovilizado y Caducidad
  const lubricantesAnalytics = useMemo(() => {
    const isLubricant = (p) => {
      const desc = (p.descripcion || p.nombre || '').toLowerCase();
      const cat = (p.categoria || '').toLowerCase();
      if (desc.includes('flete') || desc.includes('servicio') || cat.includes('servicio')) return false;
      return true;
    };

    const nowDate = new Date();
    const currentYearNum = nowDate.getFullYear();
    const currentMonthNum = nowDate.getMonth() + 1;

    const resolveItemLitros = (it, sku) => {
      const explicit = Number(it.litrosTotales ?? it.litros_totales ?? it.litros ?? 0);
      if (explicit > 0) return explicit;
      const prod = productsBySku.get(sku);
      const qty = Number(it.cantidad || 0);
      const ltsUnit = Number(it.litrosUnitarios ?? it.litrosPorUnidad ?? (prod ? resolveProductLitersPerUnit(prod) : 1)) || 0;
      return qty * ltsUnit;
    };

    const accumulateDocItemsToMap = (doc, targetMap) => {
      let docLitros = 0;
      const docRate = Number(doc?.tasa ?? doc?.tasaDolar ?? doc?.tasa_dolar ?? 0);
      const effectiveRate = docRate > 1 ? docRate : tasaBcv;
      (doc?.items || []).forEach(it => {
        const sku = String(it.articuloId || it.codigo || it.id || '').trim();
        if (!sku) return;
        const lts = resolveItemLitros(it, sku);
        docLitros += lts;
        const usdDirect = Number(it.totalUsd ?? it.subtotalUsd ?? 0);
        const usdVal = usdDirect > 0
          ? usdDirect
          : (effectiveRate > 1 ? (Number(it.totalNeto || 0) / effectiveRate) : (Number(it.precioUsd || 0) * Number(it.cantidad || 0)));
        const prev = targetMap.get(sku) || { litros: 0, count: 0, usd: 0 };
        prev.litros += lts;
        prev.count += 1;
        prev.usd += usdVal;
        targetMap.set(sku, prev);
      });
      return docLitros;
    };

    const filteredPeriodSales = (unduplicatedSales || []).filter(s => {
      const dateStr = s.fecha || s.fechaEmision || s.fecha_emision || '';
      return isWithinFiscalPeriod(dateStr, fechaInicioEfectiva, fechaFinEfectiva, selectedMonth);
    });

    // Mapear ventas por SKU desde profitInvoices + POS no duplicadas (respetando estrictamente el período filtrado)
    const salesMap = new Map();
    let totalLtsVendidosReal = 0;

    [...(filteredProfitInvoices || []), ...filteredPeriodSales].forEach(doc => {
      if (!doc || isCxcInvoiceCancelled(doc) || isExcludedSaleDocType(doc)) return;
      totalLtsVendidosReal += accumulateDocItemsToMap(doc, salesMap);
    });

    // Mapear fechas de compra/recepción de lote por SKU usando clave YYYY-MM-DD (sin desfase UTC)
    const purchaseDatesBySku = new Map();
    (profitPurchases || []).forEach(pu => {
      if (!pu || isCxcInvoiceCancelled(pu)) return;
      const dk = toDateKey(pu.fechaEmision || pu.fec_emis || pu.fecha);
      if (!dk) return;
      (pu.items || []).forEach(it => {
        const sku = String(it.articuloId || it.codigo || '').trim();
        if (sku && (!purchaseDatesBySku.has(sku) || dk > purchaseDatesBySku.get(sku))) {
          purchaseDatesBySku.set(sku, dk);
        }
      });
    });

    const activeProducts = (products || []).filter(isLubricant);
    const analyzed = activeProducts.map(p => {
      const sku = String(p.codigo || p.id || '').trim();
      const s = salesMap.get(sku) || { litros: 0, count: 0, usd: 0 };
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnit = resolveProductLitersPerUnit(p);
      const ltsStock = cant * ltsUnit;
      const costo = Number(p.costoUsd ?? p.costo ?? p.costo_unitario ?? 22.5);
      const valUsd = cant * costo;

      // Determinar año y mes de lote (desde compras reales o rotación histórica)
      let yearLote = String(currentYearNum);
      let monthLote = '01';
      const dkCompra = purchaseDatesBySku.get(sku);

      if (dkCompra && dkCompra.length >= 7) {
        yearLote = dkCompra.substring(0, 4);
        monthLote = dkCompra.substring(5, 7);
      } else {
        if (s.litros === 0 && cant > 0) {
          yearLote = String(currentYearNum - 2);
          monthLote = '04';
        } else if (s.litros < 100 && cant > 30) {
          yearLote = String(currentYearNum - 1);
          monthLote = '08';
        } else {
          yearLote = String(currentYearNum);
          monthLote = String(Math.max(1, currentMonthNum - 3)).padStart(2, '0');
        }
      }

      // Estatus de caducidad según antigüedad respecto a la fecha actual (norma 3-5 años)
      const mesesBodega = Math.max(1, (currentYearNum - Number(yearLote)) * 12 + (currentMonthNum - Number(monthLote)));
      let estatusCaducidad = 'OPTIMO'; // 'OPTIMO' (<12m) | 'ATENCION_FIFO' (12-24m) | 'RIESGO_VENCIDO' (>=24m)
      if (mesesBodega >= 24) {
        estatusCaducidad = 'RIESGO_VENCIDO';
      } else if (mesesBodega >= 12) {
        estatusCaducidad = 'ATENCION_FIFO';
      }

      return {
        id: p.id,
        codigo: sku,
        descripcion: p.descripcion || p.nombre || 'Lubricante Oilstone',
        categoria: p.categoria || 'Lubricantes',
        viscosidad: p.viscosidad || 'SAE',
        stock: cant,
        ltsStock: parseFloat(ltsStock.toFixed(1)),
        costoUsd: costo,
        valUsd: parseFloat(valUsd.toFixed(2)),
        litrosVendidos: parseFloat(s.litros.toFixed(1)),
        vecesFacturado: s.count,
        yearLote,
        monthLote,
        estatusCaducidad,
        mesesBodega
      };
    });

    // Mapear ventas específicas para la Comparativa de Lubricantes (deduplicado y filtrado por Año/Mes local)
    const comparativaSalesMap = new Map();
    let comparativaTotalLts = 0;

    [...(dedupeCanonicalDocs(profitInvoices || []) || []), ...(unduplicatedSales || [])].forEach(doc => {
      if (!doc || isCxcInvoiceCancelled(doc) || isExcludedSaleDocType(doc)) return;
      const dk = toDateKey(doc.fechaEmision || doc.fec_emis || doc.fecha);
      if (!dk || dk.length < 7) return;
      const y = dk.substring(0, 4);
      const m = dk.substring(5, 7);

      const matchY = comparativaYearFilter === 'ALL' || y === comparativaYearFilter;
      const matchM = comparativaMonthFilter === 'ALL' || m === comparativaMonthFilter;
      if (!matchY || !matchM) return;

      comparativaTotalLts += accumulateDocItemsToMap(doc, comparativaSalesMap);
    });

    // Todos los Más Vendidos según el filtro de período seleccionado (Año/Mes)
    const todosMasVendidos = activeProducts.map(p => {
      const sku = String(p.codigo || p.id || '').trim();
      const s = comparativaSalesMap.get(sku) || { litros: 0, count: 0, usd: 0 };
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnit = resolveProductLitersPerUnit(p);
      const ltsStock = cant * ltsUnit;
      const costo = Number(p.costoUsd ?? p.costo ?? p.costo_unitario ?? 22.5);
      const valUsd = cant * costo;
      return {
        id: p.id,
        codigo: sku,
        descripcion: p.descripcion || p.nombre || 'Lubricante Oilstone',
        categoria: p.categoria || 'Lubricantes',
        viscosidad: p.viscosidad || 'SAE',
        stock: cant,
        ltsStock: parseFloat(ltsStock.toFixed(1)),
        costoUsd: costo,
        valUsd: parseFloat(valUsd.toFixed(2)),
        litrosVendidos: parseFloat(s.litros.toFixed(1)),
        vecesFacturado: s.count
      };
    })
    .filter(p => p.litrosVendidos > 0)
    .sort((a, b) => b.litrosVendidos - a.litrosVendidos);

    // Todos los Menos Vendidos con Existencia Física en el período (Huesos / Lenta Rotación)
    const todosHuesosMenosVendidos = activeProducts.map(p => {
      const sku = String(p.codigo || p.id || '').trim();
      const s = comparativaSalesMap.get(sku) || { litros: 0, count: 0, usd: 0 };
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnit = resolveProductLitersPerUnit(p);
      const ltsStock = cant * ltsUnit;
      const costo = Number(p.costoUsd ?? p.costo ?? p.costo_unitario ?? 22.5);
      const valUsd = cant * costo;
      return {
        id: p.id,
        codigo: sku,
        descripcion: p.descripcion || p.nombre || 'Lubricante Oilstone',
        categoria: p.categoria || 'Lubricantes',
        viscosidad: p.viscosidad || 'SAE',
        stock: cant,
        ltsStock: parseFloat(ltsStock.toFixed(1)),
        costoUsd: costo,
        valUsd: parseFloat(valUsd.toFixed(2)),
        litrosVendidos: parseFloat(s.litros.toFixed(1)),
        vecesFacturado: s.count
      };
    })
    .filter(p => p.stock > 0)
    .sort((a, b) => a.litrosVendidos - b.litrosVendidos || b.valUsd - a.valUsd);

    // Aplicar Filtros de Año y Mes sobre Salud del Inventario y Caducidad
    const filteredCaducidadList = analyzed.filter(p => {
      const matchYear = caducidadYearFilter === 'ALL' ||
        (caducidadYearFilter === defaultFiscalYear && p.yearLote === defaultFiscalYear) ||
        (caducidadYearFilter === '2025' && p.yearLote === '2025') ||
        (caducidadYearFilter === '2024_ANT' && Number(p.yearLote) <= 2024);

      const matchMonth = caducidadMonthFilter === 'ALL' || p.monthLote === caducidadMonthFilter;
      return matchYear && matchMonth;
    });

    // Métricas de caducidad calculadas sobre el dataset filtrado
    const totalStockLitros = filteredCaducidadList.reduce((acc, p) => acc + p.ltsStock, 0);
    const ltsOptimos = filteredCaducidadList.filter(p => p.estatusCaducidad === 'OPTIMO').reduce((acc, p) => acc + p.ltsStock, 0);
    const ltsFifo = filteredCaducidadList.filter(p => p.estatusCaducidad === 'ATENCION_FIFO').reduce((acc, p) => acc + p.ltsStock, 0);
    const ltsRiesgo = filteredCaducidadList.filter(p => p.estatusCaducidad === 'RIESGO_VENCIDO').reduce((acc, p) => acc + p.ltsStock, 0);

    // 1. Desglose de Lotes Frescos: (< 12 Meses), (< 6 Meses) y (< 3 Meses) ordenados de mayor a menor por volumen
    const f3Lts = filteredCaducidadList.filter(p => p.mesesBodega < 3).reduce((acc, p) => acc + p.ltsStock, 0);
    const f6Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 3 && p.mesesBodega < 6).reduce((acc, p) => acc + p.ltsStock, 0);
    const f12Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 6 && p.mesesBodega < 12).reduce((acc, p) => acc + p.ltsStock, 0);
    const fTotal = f3Lts + f6Lts + f12Lts;

    const frescosTiers = [
      {
        id: 'frescos_12m',
        name: 'Lotes Frescos (< 12 Meses)',
        rango: '6 a 12 Meses en bodega',
        lts: parseFloat(f12Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((f12Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#059669',
        desc: 'Permanencia de 6 a 12 meses | Propiedades y aditivos vigentes'
      },
      {
        id: 'frescos_6m',
        name: 'Lotes Frescos (< 6 Meses)',
        rango: '3 a 6 Meses en bodega',
        lts: parseFloat(f6Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((f6Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#10b981',
        desc: 'Permanencia de 3 a 6 meses | Propiedades al 100%'
      },
      {
        id: 'frescos_3m',
        name: 'Lotes Frescos (< 3 Meses)',
        rango: '< 3 Meses en bodega',
        lts: parseFloat(f3Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((f3Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#34d399',
        desc: 'Permanencia menor a 3 meses | Ultra reciente'
      }
    ].sort((a, b) => b.lts - a.lts);

    // 2. Desglose Prioridad FIFO: 3 Meses, 6 Meses y 12 Meses ordenados de mayor a menor
    const fifo3Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 12 && p.mesesBodega < 15).reduce((acc, p) => acc + p.ltsStock, 0);
    const fifo6Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 15 && p.mesesBodega < 18).reduce((acc, p) => acc + p.ltsStock, 0);
    const fifo12Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 18 && p.mesesBodega < 24).reduce((acc, p) => acc + p.ltsStock, 0);
    const fifoTotal = fifo3Lts + fifo6Lts + fifo12Lts;

    const fifoTiers = [
      {
        id: 'fifo_3m',
        name: 'Prioridad FIFO (3 Meses)',
        rango: '12 a 15 Meses en bodega',
        lts: parseFloat(fifo3Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((fifo3Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#fbbf24',
        desc: 'Ventana corta de rotación prioritaria (3 meses)'
      },
      {
        id: 'fifo_6m',
        name: 'Prioridad FIFO (6 Meses)',
        rango: '15 a 18 Meses en bodega',
        lts: parseFloat(fifo6Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((fifo6Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#f59e0b',
        desc: 'Ventana media de rotación programada (6 meses)'
      },
      {
        id: 'fifo_12m',
        name: 'Prioridad FIFO (12 Meses)',
        rango: '18 a 24 Meses en bodega',
        lts: parseFloat(fifo12Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((fifo12Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#d97706',
        desc: 'Ventana anual de despacho prioritario (12 meses)'
      }
    ].sort((a, b) => b.lts - a.lts);

    // 3. Desglose Riesgo / Envejecido: 3 Meses, 6 Meses y 12 Meses ordenados de mayor a menor
    const r3Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 24 && p.mesesBodega < 27).reduce((acc, p) => acc + p.ltsStock, 0);
    const r6Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 27 && p.mesesBodega < 36).reduce((acc, p) => acc + p.ltsStock, 0);
    const r12Lts = filteredCaducidadList.filter(p => p.mesesBodega >= 36).reduce((acc, p) => acc + p.ltsStock, 0);
    const riesgoTotal = r3Lts + r6Lts + r12Lts;

    const riesgoTiers = [
      {
        id: 'riesgo_3m',
        name: 'Riesgo / Envejecido (3 Meses)',
        rango: '24 a 27 Meses en bodega',
        lts: parseFloat(r3Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((r3Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#f87171',
        desc: 'Envejecimiento incipiente (3 meses en umbral de riesgo)'
      },
      {
        id: 'riesgo_6m',
        name: 'Riesgo / Envejecido (6 Meses)',
        rango: '27 a 36 Meses en bodega',
        lts: parseFloat(r6Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((r6Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#ef4444',
        desc: 'Envejecimiento avanzado (6 meses en riesgo)'
      },
      {
        id: 'riesgo_12m',
        name: 'Riesgo / Envejecido (12 Meses)',
        rango: '≥ 36 Meses en bodega',
        lts: parseFloat(r12Lts.toFixed(1)),
        pct: totalStockLitros > 0 ? parseFloat(((r12Lts / totalStockLitros) * 100).toFixed(1)) : 0,
        color: '#b91c1c',
        desc: 'Lote crítico / inmovilizado (12+ meses en riesgo)'
      }
    ].sort((a, b) => b.lts - a.lts);

    const riesgoVencidoSkus = filteredCaducidadList.filter(p => p.estatusCaducidad === 'RIESGO_VENCIDO');
    const capitalHuesosUsd = riesgoVencidoSkus.reduce((acc, p) => acc + p.valUsd, 0);
    const riesgoVencidoCount = riesgoVencidoSkus.filter(p => p.stock > 0).length;

    // Días de Cobertura de Inventario (DSI) calculados sobre días transcurridos reales del período
    const startMs = new Date(`${fechaInicioEfectiva}T00:00:00`).getTime();
    const endCapDate = nowDate < new Date(`${fechaFinEfectiva}T23:59:59`) ? nowDate : new Date(`${fechaFinEfectiva}T23:59:59`);
    const periodDays = selectedMonth === 'ALL'
      ? Math.max(1, Math.ceil((endCapDate.getTime() - startMs) / (1000 * 60 * 60 * 24)))
      : new Date(Number(anioActivo), Number(selectedMonth), 0).getDate();
    const consumoDiarioLts = totalLtsVendidosReal > 0 ? (totalLtsVendidosReal / periodDays) : 0;
    const diasInventarioPromedio = consumoDiarioLts > 0 ? Math.round(totalStockLitros / consumoDiarioLts) : 0;

    return {
      todosMasVendidos,
      todosHuesosMenosVendidos,
      topMasVendidos: todosMasVendidos.slice(0, 5),
      huesosMenosVendidos: todosHuesosMenosVendidos.slice(0, 5),
      productoEstrella: todosMasVendidos[0] || null,
      comparativaTotalLitros: parseFloat(comparativaTotalLts.toFixed(1)),
      filteredCaducidadList,
      filteredLotesCount: filteredCaducidadList.length,
      capitalHuesosUsd: parseFloat(capitalHuesosUsd.toFixed(2)),
      riesgoVencidoCount,
      huesosTotalCount: todosHuesosMenosVendidos.length,
      diasInventarioPromedio,
      totalStockLitros: parseFloat(totalStockLitros.toFixed(1)),
      frescosTiers,
      fifoTiers,
      riesgoTiers,
      frescosTotalLitros: parseFloat(fTotal.toFixed(1)),
      fifoTotalLitros: parseFloat(fifoTotal.toFixed(1)),
      riesgoTotalLitros: parseFloat(riesgoTotal.toFixed(1)),
      ltsOptimos: parseFloat(ltsOptimos.toFixed(1)),
      ltsFifo: parseFloat(ltsFifo.toFixed(1)),
      ltsRiesgo: parseFloat(ltsRiesgo.toFixed(1)),
      pctOptimo: totalStockLitros > 0 ? parseFloat(((ltsOptimos / totalStockLitros) * 100).toFixed(1)) : 0,
      pctFifo: totalStockLitros > 0 ? parseFloat(((ltsFifo / totalStockLitros) * 100).toFixed(1)) : 0,
      pctRiesgo: totalStockLitros > 0 ? parseFloat(((ltsRiesgo / totalStockLitros) * 100).toFixed(1)) : 0
    };
  }, [products, productsBySku, filteredProfitInvoices, profitInvoices, unduplicatedSales, profitPurchases, tasaBcv, caducidadYearFilter, caducidadMonthFilter, comparativaYearFilter, comparativaMonthFilter, selectedMonth, anioActivo, fechaInicioEfectiva, fechaFinEfectiva]);

  // Mix de Medios de Pago en Cobranzas (en equivalente USD para consistencia en gráfico)
  const mixMediosPagoData = useMemo(() => {
    const bsUsd = cobranzasData.enBsUsd;
    const divUsd = cobranzasData.efectivoZelle;
    const otrosUsd = Math.max(0, cobranzasData.acumulada - (bsUsd + divUsd));

    const list = [
      { name: 'Divisas (Efectivo/Zelle)', value: divUsd, color: '#10b981' },
      { name: 'Bolívares (Tasa BCV)', value: bsUsd, color: '#0284c7' }
    ];
    if (otrosUsd > 1) {
      list.push({ name: 'Otras Formas de Pago', value: parseFloat(otrosUsd.toFixed(2)), color: '#f59e0b' });
    }
    return list.filter(item => item.value > 0);
  }, [cobranzasData]);

  // Pestaña de bloque activa para navegación rápida ('ALL' | 'comercial' | 'financiero' | 'clientes' | 'operaciones' | 'cxp')
  const [activeBlock, setActiveBlock] = useState('ALL');

  const periodoLabel = useMemo(() => {
    if (selectedMonth === 'ALL') return `Ejercicio Fiscal ${anioActivo} (Anual)`;
    return MONTHS_LIST.find(m => m.id === selectedMonth)?.label || `${selectedMonth}/${anioActivo}`;
  }, [selectedMonth, anioActivo, MONTHS_LIST]);

  const enrichedKpiData = useMemo(() => {
    const facturacionTotalUsd = Number(totalFacturadoUsd || 0);
    const preventaPendienteUsd = pendingOrdersUsd > 0
      ? pendingOrdersUsd
      : parseFloat((basePendiente * (precioPromedioLitro || 5.93)).toFixed(2));
    const cobradoTotalUsd = parseFloat(Number(cobranzasData?.acumulada || 0).toFixed(2));
    const porcentajeCobranza = efectividadCobranzaPct;
    const disponibilidadTotalUsd = parseFloat(Number(totalDisponibilidad || 0).toFixed(2));
    const totalCarteraUsd = parseFloat(Number(cxcTot || 0).toFixed(2));
    const indiceMorosidad = cxcVenPct;

    return {
      ...kpiData,
      litrosFacturados: kpiData.litrosFacturados,
      cajasFacturadas: kpiData.cajasFacturadas,
      preventaPendienteUsd,
      precioPromedioLitro,
      cumplimientoLitrosPct: kpiData.cumplimientoMetaPct,
      facturacionTotalUsd,
      cobradoTotalUsd,
      porcentajeCobranza,
      disponibilidadTotalUsd,
      totalCarteraUsd,
      indiceMorosidad,
      ticketPromedioUsd,
      clientesActivosCount,
      stockTotalLitros,
      stockTotalCajas,
      valorizacionInventarioUsd: stockValorizadoUsd,
      topLubricanteNombre: lubricantesAnalytics?.productoEstrella?.descripcion || 'Oilstone 20W-50',
      topLubricanteLitros: lubricantesAnalytics?.productoEstrella?.litrosVendidos || 0,
      capitalHuesosUsd: lubricantesAnalytics?.capitalHuesosUsd || 0,
      huesosCount: lubricantesAnalytics?.riesgoVencidoCount ?? 0,
      diasInventarioPromedio: lubricantesAnalytics?.diasInventarioPromedio || 0,
      abonosPeriodo: objetivosData?.abonosPeriodo || 0,
      flujoNetoPeriodo: objetivosData?.flujoNetoPeriodo || 0,
      saldoCxP: cxpAnalytics?.totalSaldoUsd || 0,
      cxpVencida: cxpAnalytics?.totalVencidoUsd || 0,
      cxpMorosidadPct: cxpAnalytics?.morosidadPct || 0
    };
  }, [
    kpiData,
    totalFacturadoUsd,
    pendingOrdersUsd,
    basePendiente,
    precioPromedioLitro,
    cobranzasData?.acumulada,
    efectividadCobranzaPct,
    totalDisponibilidad,
    cxcTot,
    cxcVenPct,
    ticketPromedioUsd,
    clientesActivosCount,
    stockTotalLitros,
    stockTotalCajas,
    stockValorizadoUsd,
    lubricantesAnalytics,
    objetivosData,
    cxpAnalytics
  ]);

  const renderMoMBadge = (pct, refLabel) => {
    if (pct === null || pct === undefined || isNaN(pct)) return null;
    const isUp = pct >= 0;
    const color = isUp ? '#10b981' : '#ef4444';
    const bg = isUp ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)';
    const sign = isUp ? '+' : '';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          marginTop: '4px',
          padding: '1px 6px',
          borderRadius: '8px',
          fontSize: '0.62rem',
          fontWeight: 800,
          background: bg,
          color
        }}
        title={`Variación mensual vs. ${refLabel}`}
      >
        {isUp ? '▲' : '▼'} {sign}{pct}% {refLabel}
      </span>
    );
  };

  const handleManualSync = async () => {
    if (!onSyncProfit) return;
    try {
      setIsSyncing(true);
      await onSyncProfit();
      setSyncFeedback('¡Sincronización con Supabase completada con éxito!');
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (err) {
      setSyncFeedback('Error sincronizando: ' + (err.message || 'Error de red'));
      setTimeout(() => setSyncFeedback(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrintReport = (block = 'ALL', customConfig = null) => {
    try {
      const targetBlock = typeof block === 'string' ? block : 'ALL';
      const effectiveConfig = (customConfig && typeof customConfig === 'object') ? { ...config, ...customConfig } : config;

      generateDashboardPDF({
        kpiData: enrichedKpiData,
        sales,
        products,
        orders,
        config: effectiveConfig,
        currentUser,
        block: targetBlock,
        sellers: (sellersCompliance && sellersCompliance.length > 0) ? sellersCompliance : effectiveSellersList,
        cobranzasData,
        disponibilidadBancariaData,
        carteraClientesData,
        topClientsData: topClientesData || [],
        lubricantesAnalytics,
        objetivosData,
        cxpAnalytics,
        selectedMonth,
        ventasDelDia,
        ventasAcumuladoMes,
        ventasMesLabel: MONTHS_LIST.find(m => m.id === ventasMesFilter)?.label || ventasMesFilter,
        todayLabel
      });
    } catch (err) {
      console.error('[DashboardView] Error generando PDF:', err);
      alert('Error generando el reporte PDF: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>



      {/* Toast Feedback de Sincronización */}
      {syncFeedback && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--semaforo-verde)',
            color: 'var(--semaforo-verde)',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={16} />
          <span>{syncFeedback}</span>
        </div>
      )}



      {/* ========================================================================= */}
      {/* 1.9 BARRA ACCESO DIRECTO: VISOR DE DISPOSITIVOS RESPONSIVE (SMARTPHONE, TABLET, PC) */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(2, 132, 199, 0.15) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)'
            }}
          >
            <Smartphone size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>VISOR DE DISPOSITIVOS RESPONSIVE (SMARTPHONE, TABLET, PC)</span>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 800 }}>
                100% ADAPTATIVO
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Abre el simulador interactivo para probar y visualizar todas las pantallas en iPhone, Android, iPads, Tablets y Laptops con marcos reales y multi-vista.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?view=device-simulator`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            title="Abrir el visor interactivo de dispositivos en una nueva ventana del navegador"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              padding: '0.55rem 1.15rem',
              background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
              cursor: 'pointer'
            }}
          >
            <ExternalLink size={15} /> ABRIR VISOR DE DISPOSITIVOS EN PANTALLA NUEVA
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2.1 BARRA DE FILTRO MENSUAL / CIERRE ANUAL DE METAS (2026) */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          padding: '0.8rem 1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(2, 132, 199, 0.05) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(2, 132, 199, 0.15)',
              color: 'var(--motorven-cyan, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>PERÍODO DE CUMPLIMIENTO:</span>
              <span style={{ color: 'var(--motorven-cyan, #0284c7)' }}>
                {MONTHS_LIST.find(m => m.id === selectedMonth)?.label}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Metas editadas en Fuerza de Ventas con consolidación mensual y proyección de cierre anual
            </div>
          </div>
        </div>

        {/* SELECTOR INTERACTIVO DE MESES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {MONTHS_LIST.map(m => {
            const isSelected = selectedMonth === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMonth(m.id)}
                className="btn"
                style={{
                  fontSize: '0.7rem',
                  fontWeight: isSelected ? 800 : 600,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: isSelected ? '1px solid var(--motorven-cyan, #0284c7)' : '1px solid var(--border-glass)',
                  background: isSelected ? 'var(--motorven-cyan, #0284c7)' : 'var(--surface-input, rgba(255, 255, 255, 0.04))',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={m.label}
              >
                {m.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* AVISO INFORMATIVO SI ENERO NO TIENE FACTURAS REGISTRADAS */}
      {selectedMonth === '01' && filteredProfitInvoices.length === 0 && (
        <div
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '10px',
            background: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            color: '#38bdf8',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Calendar size={16} />
          <span>
            <strong>Información de Ejercicio 2026:</strong> En Enero de 2026 no hubo facturación registrada en Supabase (las primeras ventas del ejercicio 2026 iniciaron el <strong>10 de Febrero de 2026</strong> con la Factura N° 12).
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2.2 SELECTOR RÁPIDO DE BLOQUES TEMÁTICOS */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
          paddingBottom: '4px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flex: '1 1 auto',
            minWidth: 0
          }}
        >
          {[
            { id: 'ALL', label: '📊 Todos los Bloques', color: 'var(--motorven-cyan, #0284c7)' },
            { id: 'comercial', label: '🔵 1. Ventas & Volumen', color: '#0284c7' },
            { id: 'financiero', label: '🟢 2. Finanzas & Cobranzas', color: '#10b981' },
            { id: 'clientes', label: '🟡 3. Clientes & Morosidad', color: '#f59e0b' },
            { id: 'operaciones', label: '🟣 4. Inventario & Proveedores', color: '#8b5cf6' },
            { id: 'cxp', label: '🧾 5. Cuentas por Pagar (CxP)', color: '#ef4444' }
          ].map(tab => {
            const isActive = activeBlock === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveBlock(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 800 : 600,
                  border: isActive ? `1.5px solid ${tab.color}` : '1px solid var(--border-glass)',
                  background: isActive ? 'rgba(2, 132, 199, 0.18)' : 'var(--surface-input, rgba(255, 255, 255, 0.04))',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ACCIONES GLOBALES DEL DASHBOARD ALINEADAS A LA DERECHA */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {typeof onSyncProfit === 'function' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Sincronizar datos financieros, cobranzas e inventario desde Profit / Supabase"
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={13} style={{ flexShrink: 0, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Profit'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowPrintModal(true)}
            title="Abrir vista previa interactiva del Resumen Ejecutivo Consolidado"
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={13} style={{ flexShrink: 0 }} />
            <span>Vista Previa Ejecutiva</span>
          </button>

          <button
            type="button"
            className="btn btn-print-report"
            onClick={() => handlePrintReport('ALL')}
            title="Descargar Informe Ejecutivo Consolidado en PDF con todos los bloques y KPIs"
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Printer size={13} style={{ flexShrink: 0 }} />
            <span>Imprimir Reporte Completo</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔵 BLOQUE 1: DIRECCIÓN COMERCIAL & VOLUMEN DE VENTAS (LUBRICANTES)        */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'comercial') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Header del Bloque */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.25rem', borderBottom: '1px solid rgba(2, 132, 199, 0.25)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.2)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. DIRECCIÓN COMERCIAL & VOLUMEN DE LUBRICANTES
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Litros facturados, cuotas comerciales y aportes individuales de la fuerza de ventas
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-print-report"
                onClick={() => handlePrintReport('comercial')}
                title="Imprimir informe exclusivo de Dirección Comercial y Lubricantes"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  gap: '4px'
                }}
              >
                <Printer size={12} style={{ flexShrink: 0 }} />
                <span>Imprimir</span>
              </button>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', fontWeight: 800 }}>
                VENTAS & POS
              </span>
            </div>
          </div>

          {/* VENTAS DEL DÍA & ACUMULADO MENSUAL (Montos y Lubricantes) */}
          <div className="bento-grid">
            {/* Tarjeta: Ventas del Día */}
            <div className="bento-card col-span-6" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span className="bento-card-header-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="#10b981" /> VENTAS DEL DÍA
                </span>
                <span style={{ fontSize: '0.66rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 800, textTransform: 'capitalize' }}>
                  {todayLabel}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-input, rgba(255,255,255,0.04))', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <DollarSign size={12} /> Monto Facturado
                  </div>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: '#10b981' }}>{formatUsd(ventasDelDia.usd)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatBs(ventasDelDia.bs)}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-input, rgba(255,255,255,0.04))', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Droplet size={12} /> Lubricantes Vendidos
                  </div>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--neon-cyan, #38bdf8)' }}>
                    {ventasDelDia.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)' }}>({ventasDelDia.cajas.toLocaleString('es-VE')} cajas)</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span><strong style={{ color: 'var(--text-heading)' }}>{ventasDelDia.documentos}</strong> documentos • <strong style={{ color: 'var(--text-heading)' }}>{ventasDelDia.clientes}</strong> clientes • <strong style={{ color: 'var(--text-heading)' }}>{ventasDelDia.skus}</strong> SKUs</span>
                <span title="Comparativo contra el día anterior">
                  Ayer: {formatUsd(ventasDelDia.ayerUsd)} / {ventasDelDia.ayerLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                </span>
              </div>
            </div>

            {/* Tarjeta: Acumulado Mensual (filtrable por mes) */}
            <div className="bento-card col-span-6" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid rgba(2, 132, 199, 0.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span className="bento-card-header-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} color="#38bdf8" /> ACUMULADO MENSUAL
                </span>
                <select
                  value={ventasMesFilter}
                  onChange={(e) => setVentasMesFilter(e.target.value)}
                  className="form-control"
                  title="Seleccione el mes a consultar"
                  style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.45)', width: 'auto', cursor: 'pointer' }}
                >
                  {MONTHS_LIST.filter(m => m.id !== 'ALL').map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-input, rgba(255,255,255,0.04))', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <DollarSign size={12} /> Monto Acumulado
                  </div>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: '#10b981' }}>{formatUsd(ventasAcumuladoMes.usd)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatBs(ventasAcumuladoMes.bs)}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px' }}>Prom. diario: {formatUsd(ventasAcumuladoMes.promedioDiarioUsd)}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-input, rgba(255,255,255,0.04))', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Droplet size={12} /> Lubricantes Acumulados
                  </div>
                  <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--neon-cyan, #38bdf8)' }}>
                    {ventasAcumuladoMes.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)' }}>({ventasAcumuladoMes.cajas.toLocaleString('es-VE')} cajas)</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px' }}>Prom. diario: {ventasAcumuladoMes.promedioDiarioLitros.toLocaleString('es-VE')} L</div>
                </div>
              </div>
              {/* Progreso contra la meta mensual */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '4px' }}>
                  <span>
                    Meta mes: <strong style={{ color: 'var(--text-heading)' }}>{ventasAcumuladoMes.metaLitros.toLocaleString('es-VE')} L</strong>
                    {' '}• <strong style={{ color: getSemaforoMeta(ventasAcumuladoMes.pctMeta).color }}>{ventasAcumuladoMes.pctMeta}%</strong>
                  </span>
                  <span>
                    {ventasAcumuladoMes.esFuturo
                      ? 'Mes aún no iniciado'
                      : ventasAcumuladoMes.esMesEnCurso
                        ? `Día ${ventasAcumuladoMes.diasTranscurridos}/${ventasAcumuladoMes.diasDelMes} • Proyección: ${ventasAcumuladoMes.proyeccionLitros.toLocaleString('es-VE')} L`
                        : `Mes cerrado • ${ventasAcumuladoMes.documentos} documentos`}
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(ventasAcumuladoMes.pctMeta, 100)}%`, height: '100%', background: getSemaforoMeta(ventasAcumuladoMes.pctMeta).color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>

            {/* Detalle: Lubricantes más vendidos (Hoy / Mes seleccionado) */}
            <div className="bento-card col-span-12" style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span className="bento-card-header-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={15} color="var(--motorven-gold)" /> DETALLE DE LUBRICANTES VENDIDOS
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { id: 'hoy', label: 'Hoy' },
                    { id: 'mes', label: MONTHS_LIST.find(m => m.id === ventasMesFilter)?.label || 'Mes' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setVentasDetalleTab(t.id)}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: ventasDetalleTab === t.id ? 800 : 600,
                        padding: '3px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: ventasDetalleTab === t.id ? '1px solid var(--motorven-cyan, #0284c7)' : '1px solid var(--border-glass)',
                        background: ventasDetalleTab === t.id ? 'var(--motorven-cyan, #0284c7)' : 'var(--surface-input, rgba(255,255,255,0.04))',
                        color: ventasDetalleTab === t.id ? '#fff' : 'var(--text-muted)'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                const lista = ventasDetalleTab === 'hoy' ? ventasDelDia.topProductos : ventasAcumuladoMes.topProductos;
                if (!lista || lista.length === 0) {
                  return (
                    <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {ventasDetalleTab === 'hoy' ? 'Aún no hay lubricantes facturados hoy.' : 'Sin lubricantes facturados en el mes seleccionado.'}
                    </div>
                  );
                }
                const maxLts = lista[0]?.litros || 1;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px' }}>
                    {lista.map((p, idx) => (
                      <div key={p.sku} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 8px', borderRadius: '6px', background: 'var(--surface-input, rgba(255,255,255,0.04))', border: '1px solid var(--border-glass)', fontSize: '0.72rem' }} title={`${p.sku} • ${p.desc}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontWeight: 700 }}>
                            {idx + 1}. {p.desc}
                          </span>
                          <span style={{ whiteSpace: 'nowrap', color: 'var(--neon-cyan, #38bdf8)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                            {p.litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.66rem' }}>
                          <span>{p.cantidad.toLocaleString('es-VE')} und.</span>
                          <span>{formatUsd(p.usd)}</span>
                        </div>
                        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min((p.litros / maxLts) * 100, 100)}%`, height: '100%', background: 'var(--motorven-gold, #ffb703)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 4 KPI Cards del Bloque 1 */}
          <div className="bento-grid">
            {/* KPI 1.1: Litros Facturados */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('ventas')}
              title="Clic para ir al Terminal de Ventas POS"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0, 43, 122, 0.3)', border: '1px solid var(--neon-cyan)', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Fuel size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Litros Facturados</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-heading)' }}>
                      {kpiData.litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--motorven-gold)' }}>({kpiData.cajasFacturadas} cajas)</div>
                    {renderMoMBadge(momComparison.litrosPct, `vs ${momComparison.prevLabel}`)}
                  </div>
                </div>
                <ArrowUpRight size={16} color="var(--neon-cyan)" />
              </div>
            </div>

            {/* KPI 1.2: Preventa Pendiente por Facturar */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => {
                if (onOpenOrdersSalesModal) onOpenOrdersSalesModal('pipeline');
                else if (onNavigate) onNavigate('pedidos');
              }}
              title="Clic para abrir el Pipeline de Pedidos y Preventas"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255, 183, 3, 0.15)', border: '1px solid var(--motorven-gold)', color: 'var(--motorven-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pendiente Facturar</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--motorven-gold)' }}>
                      {kpiData.pendienteFacturar.toLocaleString('es-VE')} L
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({kpiData.cajasPendientes} cajas)</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="var(--motorven-gold)" />
              </div>
            </div>

            {/* KPI 1.3: Precio Promedio por Litro */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('rentabilidad')}
              title="Clic para ir al Análisis de Rentabilidad & BI"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Precio Promedio / L</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>
                      {formatUsd(precioPromedioLitro)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Venta Total: {formatUsd(totalFacturadoUsd)}</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#38bdf8" />
              </div>
            </div>

            {/* KPI 1.4: Cumplimiento de la Meta */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer', border: `1px solid ${semMeta.color}` }}
              onClick={() => onNavigate && onNavigate('vendedores')}
              title="Clic para ir a Fuerza de Ventas"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(230, 0, 18, 0.15)', border: `1px solid ${semMeta.color}`, color: semMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Award size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cumplimiento Meta</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: semMeta.color }}>
                      {kpiData.cumplimientoMetaPct}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Meta Mes: {kpiData.metaMensualBase.toLocaleString('es-VE')} L</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color={semMeta.color} />
              </div>
            </div>
          </div>

          {/* 3 Widgets Grandes del Bloque 1 */}
          <div className="bento-grid">
            {/* Widget 1.1: Tacómetro de Cumplimiento Global de la Meta */}
            <div className="bento-card col-span-4" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Target size={16} color="var(--motorven-red)" /> CUMPLIMIENTO DE LA META
                </span>
                <span className={`semaforo-indicator ${semMeta.level}`}>
                  <span className="semaforo-dot"></span>
                  {kpiData.cumplimientoMetaPct}%
                </span>
              </div>

              <div className="tacometro-wrapper" style={{ flex: 1, padding: '0.4rem 0' }}>
                <div style={{ position: 'relative', width: '240px', maxWidth: '100%', height: '134px', margin: '0 auto' }}>
                  <svg viewBox="0 0 240 134" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Pista base del tacómetro */}
                    <path d="M 44 108 A 76 76 0 0 1 196 108" fill="none" stroke="var(--bg-btn-secondary, rgba(255,255,255,0.1))" strokeWidth="20" strokeLinecap="butt" />
                    {/* Tramo Crítico (0% - 50%) */}
                    <path d="M 44 108 A 76 76 0 0 1 120 32" fill="none" stroke="#ef4444" strokeWidth="18" strokeLinecap="butt" />
                    {/* Tramo Precaución (50% - 80%) */}
                    <path d="M 120 32 A 76 76 0 0 1 181.5 63.3" fill="none" stroke="#f59e0b" strokeWidth="18" strokeLinecap="butt" />
                    {/* Tramo Óptimo (80% - 100%) */}
                    <path d="M 181.5 63.3 A 76 76 0 0 1 196 108" fill="none" stroke="#10b981" strokeWidth="18" strokeLinecap="butt" />

                    {/* Marcas guía exteriores para cada umbral */}
                    <line x1="120" y1="21" x2="120" y2="16" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                    <line x1="190" y1="57" x2="195" y2="53.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

                    {/* Etiquetas numéricas separadas del arco sin solapamiento */}
                    <text x="44" y="126" textAnchor="middle" fill="var(--text-secondary, #cbd5e1)" fontSize="10.5" fontWeight="800" fontFamily="var(--font-code)">0%</text>
                    <text x="120" y="12" textAnchor="middle" fill="#fbbf24" fontSize="10.5" fontWeight="800" fontFamily="var(--font-code)">50%</text>
                    <text x="199" y="53" textAnchor="start" fill="#34d399" fontSize="10.5" fontWeight="800" fontFamily="var(--font-code)">80%</text>
                    <text x="196" y="126" textAnchor="middle" fill="var(--text-secondary, #cbd5e1)" fontSize="10.5" fontWeight="800" fontFamily="var(--font-code)">100%</text>

                    {/* Aguja indicadora */}
                    <g transform={`rotate(${Math.min(Math.max((kpiData.cumplimientoMetaPct / 100) * 180 - 90, -90), 90)}, 120, 108)`} style={{ transition: 'transform 0.8s ease-out' }}>
                      <line x1="120" y1="108" x2="120" y2="36" stroke="rgba(0,0,0,0.35)" strokeWidth="6" strokeLinecap="round" />
                      <polygon points="116,108 124,108 121.5,34 118.5,34" fill="var(--motorven-red)" stroke="var(--text-heading)" strokeWidth="1.5" />
                      <circle cx="120" cy="108" r="11" fill="var(--motorven-navy)" stroke="var(--text-heading)" strokeWidth="2.5" />
                      <circle cx="120" cy="108" r="4" fill="var(--motorven-gold)" />
                    </g>
                  </svg>
                </div>
                <div className="tacometro-value" style={{ marginTop: '0.15rem', fontSize: '2rem' }}>{kpiData.cumplimientoMetaPct}%</div>
                <div className="tacometro-label" style={{ fontSize: '0.7rem' }}>
                  {selectedMonth === 'ALL' ? 'CIERRE ANUAL 2026' : `META ${MONTHS_LIST.find(m => m.id === selectedMonth)?.short.toUpperCase() || 'DEL MES'}`}
                </div>

                {/* Métricas de Brecha y Resumen de la Meta Global */}
                <div style={{ marginTop: '0.75rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderRadius: '6px', background: 'var(--surface-input, rgba(255,255,255,0.04))', border: '1px solid var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Meta Comercial:</span>
                    <strong style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-tech)' }}>
                      {metaLitros.toLocaleString('es-VE')} L
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderRadius: '6px', background: 'var(--surface-input, rgba(255,255,255,0.04))', border: '1px solid var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Litros Facturados:</span>
                    <strong style={{ color: 'var(--motorven-cyan, #0284c7)', fontFamily: 'var(--font-tech)' }}>
                      {totalLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderRadius: '6px', background: totalLitros >= metaLitros ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${totalLitros >= metaLitros ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                    <span style={{ color: totalLitros >= metaLitros ? 'var(--semaforo-verde)' : 'var(--semaforo-rojo)' }}>
                      {totalLitros >= metaLitros ? 'Excedente Meta:' : 'Brecha Faltante:'}
                    </span>
                    <strong style={{ color: totalLitros >= metaLitros ? 'var(--semaforo-verde)' : 'var(--semaforo-rojo)', fontFamily: 'var(--font-tech)' }}>
                      {totalLitros >= metaLitros
                        ? `+${(totalLitros - metaLitros).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`
                        : `-${(metaLitros - totalLitros).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <FileText size={14} /> Ver Informe Completo
                </button>
              </div>
            </div>

            {/* Widget 1.2: SUMATORIA DE APORTES DE ASESORES (NUEVO KPI SEPARADO) */}
            <div className="bento-card col-span-4" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} color="var(--motorven-gold, #ffb703)" /> SUMATORIA DE APORTES DE ASESORES
                  </span>
                </span>
                <span className="badge-sumatoria-aportes" title={`${sellersCompliance.length} Asesores sincronizados en el período`}>
                  <Users size={12} /> {sellersCompliance.length} ASESORES
                </span>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Cabecera de Resumen de Aportes */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.12) 0%, rgba(2, 132, 199, 0.08) 100%)',
                    border: '1px solid rgba(255, 183, 3, 0.35)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Total Aportes Sumados
                    </div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-gold, #ffb703)' }}>
                      +{cumplimientoPct}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Litros Aportados
                    </div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {totalLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                    </div>
                  </div>
                </div>

                {/* Lista / Rejilla con Scroll de Todos los Asesores */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '195px',
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    paddingRight: '2px'
                  }}
                >
                  {sellersCompliance.map((s, idx) => {
                    const isHigh = s.pctIndividual >= 80;
                    const isMid = s.pctIndividual >= 50;
                    const barColor = isHigh ? 'var(--semaforo-verde, #10b981)' : isMid ? 'var(--semaforo-amarillo, #f59e0b)' : 'var(--semaforo-rojo, #ef4444)';

                    return (
                      <div
                        key={s.id || s.coVen || idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          background: 'var(--surface-input, rgba(255,255,255,0.04))',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-glass)',
                          fontSize: '0.72rem'
                        }}
                        title={`${s.venDes} (${s.coVen}): ${s.litrosFinales.toLocaleString('es-VE')} L facturados de ${s.sMeta.toLocaleString('es-VE')} L de cuota (${s.pctIndividual}%)`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(2, 132, 199, 0.18)', color: 'var(--neon-cyan, #38bdf8)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                              {s.coVen}
                            </span>
                            <span
                              style={{
                                color: 'var(--text-main)',
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '120px'
                              }}
                            >
                              {formatAdvisorName(s.venDes)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                              {s.litrosFinales.toLocaleString('es-VE', { maximumFractionDigits: 0 })} L
                            </span>
                            <span style={{ fontSize: '0.66rem', color: barColor, fontWeight: 700 }}>
                              {s.pctIndividual}%
                            </span>
                            <strong style={{ color: 'var(--motorven-gold, #ffb703)', fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>
                              +{s.pctAporteEmpresa}%
                            </strong>
                          </div>
                        </div>

                        {/* Barra de progreso de cumplimiento individual */}
                        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(s.pctIndividual, 100)}%`,
                              height: '100%',
                              background: barColor,
                              borderRadius: '2px',
                              transition: 'width 0.4s ease'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('vendedores')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Users size={14} /> Ir a Fuerza de Ventas
                </button>
              </div>
            </div>

            {/* Widget 1.3: Gráfico de Evolución Mensual 2026 / Ventas vs Meta */}
            <div className="bento-card col-span-4" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="bento-card-header-title">
                  <BarChart2 size={16} color="var(--neon-cyan)" /> {selectedMonth === 'ALL' ? 'EVOLUCIÓN MENSUAL 2026 (% CUMPLIMIENTO)' : 'VENTAS VS META COMERCIAL'}
                </span>
                <span className="badge badge-primary" style={{ fontSize: '0.62rem' }}>
                  {selectedMonth === 'ALL' ? 'Ene - Dic 2026' : MONTHS_LIST.find(m => m.id === selectedMonth)?.short}
                </span>
              </div>

              <div style={{ width: '100%', height: 180, flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {selectedMonth === 'ALL' ? (
                    <BarChart data={monthlyHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="mes" stroke="var(--text-muted)" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                      <YAxis stroke="var(--text-muted)" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} unit="%" />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-modal)', border: '1px solid var(--border-glass-highlight)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                        formatter={(val, name, props) => [`${val}% (${props.payload.facturado.toLocaleString('es-VE')} L / ${props.payload.meta.toLocaleString('es-VE')} L)`, 'Cumplimiento']}
                      />
                      <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                        {monthlyHistoryData.map((entry, index) => (
                          <Cell
                            key={`cell-month-${index}`}
                            fill={entry.pct >= 80 ? 'var(--semaforo-verde, #10b981)' : entry.pct >= 50 ? 'var(--semaforo-amarillo, #f59e0b)' : entry.pct > 0 ? 'var(--semaforo-rojo, #ef4444)' : 'rgba(255,255,255,0.1)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={comparativoMetaData}>
                      <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-modal)', border: '1px solid var(--border-glass-highlight)', borderRadius: '10px', color: 'var(--text-primary)' }} />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                        {comparativoMetaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('rentabilidad')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <TrendingUp size={14} /> Análisis BI & Rentabilidad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🟢 BLOQUE 2: SALUD FINANCIERA, TESORERÍA & COBRANZAS                       */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'financiero') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Header del Bloque */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.25rem', borderBottom: '1px solid rgba(16, 185, 129, 0.25)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  2. SALUD FINANCIERA, TESORERÍA & RECAUDACIÓN
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Facturación neta total, eficiencia de cobranza y liquidez disponible en cuentas bancarias
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-print-report"
                onClick={() => handlePrintReport('financiero')}
                title="Imprimir informe exclusivo de Salud Financiera, Tesorería y Cobranzas"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  gap: '4px'
                }}
              >
                <Printer size={12} style={{ flexShrink: 0 }} />
                <span>Imprimir</span>
              </button>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 800 }}>
                FINANZAS & TESORERÍA
              </span>
            </div>
          </div>

          {/* 4 KPI Cards del Bloque 2 */}
          <div className="bento-grid">
            {/* KPI 2.1: Facturación Neta Total */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('ventas')}
              title="Clic para ir a Facturación"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Facturación Neta Total</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-heading)' }}>
                      {formatUsd(totalFacturadoUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatBs(totalFacturadoUsd * tasaBcv)}</div>
                    {renderMoMBadge(momComparison.facturadoPct, `vs ${momComparison.prevLabel}`)}
                  </div>
                </div>
                <ArrowUpRight size={16} color="#10b981" />
              </div>
            </div>

            {/* KPI 2.2: Total Cobranza Recaudada */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('caja')}
              title="Clic para ir a Caja & Cobranzas"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.15)', border: '1px solid #0284c7', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cobrado</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#0284c7' }}>
                      {formatUsd(cobranzasData.acumulada)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Divisas: {formatUsd(cobranzasData.efectivoZelle)}</div>
                    {renderMoMBadge(momComparison.cobPct, `vs ${momComparison.prevLabel}`)}
                  </div>
                </div>
                <ArrowUpRight size={16} color="#0284c7" />
              </div>
            </div>

            {/* KPI 2.3: Efectividad de Cobranza (%) */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('cxc')}
              title="Clic para ir a Cuentas por Cobrar"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Percent size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Efectividad de Cobro</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b' }}>
                      {efectividadCobranzaPct}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cobrado vs Facturado</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#f59e0b" />
              </div>
            </div>

            {/* KPI 2.4: Disponibilidad en Bancos */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('caja')}
              title="Clic para ver cuentas bancarias"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Landmark size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disponibilidad Bancaria</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>
                      {formatUsd(totalDisponibilidad)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{disponibilidadBancariaData.length} cuentas activas</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#38bdf8" />
              </div>
            </div>
          </div>

          {/* 2 Widgets Grandes del Bloque 2 */}
          <div className="bento-grid">
            {/* Widget 2.1: Mix de Medios de Pago en Cobranzas */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <PieIcon size={16} color="var(--motorven-emerald)" /> MIX DE FORMAS DE COBRANZA
                </span>
                <span className="badge badge-success">Recaudación</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, padding: '0.5rem 0' }}>
                <div style={{ width: '130px', height: '130px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mixMediosPagoData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={54}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {mixMediosPagoData.map((entry, index) => (
                          <Cell key={`cell-pay-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ flex: 1, paddingLeft: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {mixMediosPagoData.map((entry, idx) => (
                    <div key={idx} style={{ background: 'var(--surface-input, rgba(255,255,255,0.04))', padding: '0.35rem 0.6rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: entry.color }}></span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{entry.name}</span>
                      </div>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-heading)' }}>{formatUsd(entry.value)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('caja')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <DollarSign size={14} /> Ir a Caja & Cuentas por Cobrar
                </button>
              </div>
            </div>

            {/* Widget 2.2: Disponibilidad Bancaria por Cuenta */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Landmark size={16} color="var(--neon-cyan)" /> CUENTAS BANCARIAS
                </span>
                <span className="badge badge-info">{formatUsd(totalDisponibilidad)}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, maxHeight: '150px', overflowY: 'auto' }}>
                {disponibilidadBancariaData.map((b, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.55rem', background: 'var(--surface-input, rgba(255,255,255,0.03))', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{b.banco}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{b.numCta || 'Cta Operativa'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--motorven-gold)' }}>{formatUsd(b.monto)}</strong>
                      {b.montoBs > 0 && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatBs(b.montoBs)}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('caja')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Landmark size={14} /> Conciliación Bancaria & Flujo
                </button>
              </div>
            </div>
          </div>

          {/* Fila Resumen Financiero Complementario: Flujo Neto Real & Naturaleza de Documentos */}
          <div className="bento-grid">
            <div className="bento-card col-span-6" style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={15} color={objetivosData.flujoNetoPeriodo >= 0 ? '#10b981' : '#ef4444'} />
                  FLUJO DE CAJA NETO DEL PERÍODO (COBRANZAS − ABONOS)
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-tech)',
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    color: objetivosData.flujoNetoPeriodo >= 0 ? '#10b981' : '#ef4444'
                  }}
                >
                  {objetivosData.flujoNetoPeriodo >= 0 ? '+' : ''}{formatUsd(objetivosData.flujoNetoPeriodo)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.72rem' }}>
                <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ingresos Cobrados</span>
                  <strong style={{ color: '#10b981' }}>{formatUsd(cobranzasData.acumulada)}</strong>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Abonos Proveedores</span>
                  <strong style={{ color: '#ef4444' }}>{formatUsd(objetivosData.abonosPeriodo)}</strong>
                </div>
              </div>
            </div>

            <div className="bento-card col-span-6" style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={15} color="#0284c7" />
                  DESGLOSE DE FACTURACIÓN: FISCAL vs. NOTAS DE ENTREGA
                </span>
                {docTypeBreakdown.ncCount > 0 && (
                  <span style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b', fontWeight: 700 }}>
                    {docTypeBreakdown.ncCount} N/C ({formatUsd(docTypeBreakdown.ncUsd)}) excl.
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.72rem' }}>
                <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#38bdf8' }}>Fiscal (FACT) · {docTypeBreakdown.fiscalPct}%</div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{docTypeBreakdown.fiscalCount} docs · {docTypeBreakdown.fiscalLitros.toLocaleString('es-VE', { maximumFractionDigits: 0 })} L</div>
                  </div>
                  <strong style={{ color: 'var(--text-heading)' }}>{formatUsd(docTypeBreakdown.fiscalUsd)}</strong>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#a78bfa' }}>Notas Entrega · {docTypeBreakdown.nePct}%</div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{docTypeBreakdown.neCount} docs · {docTypeBreakdown.neLitros.toLocaleString('es-VE', { maximumFractionDigits: 0 })} L</div>
                  </div>
                  <strong style={{ color: 'var(--text-heading)' }}>{formatUsd(docTypeBreakdown.neUsd)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🟡 BLOQUE 3: CARTERA DE CLIENTES, CRÉDITO & MOROSIDAD                      */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'clientes') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Header del Bloque */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.25rem', borderBottom: '1px solid rgba(245, 158, 11, 0.25)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  3. CARTERA DE CLIENTES, CRÉDITO & MOROSIDAD
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Envejecimiento de deuda, compradores activos, ticket promedio y concentración de cartera
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-print-report"
                onClick={() => handlePrintReport('clientes')}
                title="Imprimir informe exclusivo de Cartera de Clientes y Morosidad CxC"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  gap: '4px'
                }}
              >
                <Printer size={12} style={{ flexShrink: 0 }} />
                <span>Imprimir</span>
              </button>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 800 }}>
                CRÉDITO & COBRANZAS
              </span>
            </div>
          </div>

          {/* 4 KPI Cards del Bloque 3 */}
          <div className="bento-grid">
            {/* KPI 3.1: Cartera Total CxC */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => setShowClientsModal(true)}
              title="Clic para ver directorio de clientes"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0, 43, 122, 0.25)', border: '1px solid #002b7a', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cartera Total CxC</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-heading)' }}>
                      {formatUsd(cxcTot)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--semaforo-verde)' }}>Al Día: {formatUsd(cxcDia)}</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#38bdf8" />
              </div>
            </div>

            {/* KPI 3.2: Índice de Morosidad */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer', border: `1px solid ${cxcVenPct > 25 ? 'var(--semaforo-rojo)' : 'rgba(245, 158, 11, 0.5)'}` }}
              onClick={() => setShowCreditScoreModal(true)}
              title="Clic para ver Scoring Crediticio"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: cxcVenPct > 25 ? 'rgba(230, 0, 18, 0.15)' : 'rgba(245, 158, 11, 0.15)', border: `1px solid ${cxcVenPct > 25 ? '#ef4444' : '#f59e0b'}`, color: cxcVenPct > 25 ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Índice de Morosidad</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: cxcVenPct > 25 ? 'var(--semaforo-rojo)' : '#f59e0b' }}>
                      {cxcVenPct}%
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--semaforo-rojo)' }}>Vencida: {formatUsd(cxcVen)}</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color={cxcVenPct > 25 ? '#ef4444' : '#f59e0b'} />
              </div>
            </div>

            {/* KPI 3.3: Ticket Promedio por Factura */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('ventas')}
              title="Clic para ir a POS"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8b5cf6', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket Promedio</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#a78bfa' }}>
                      {formatUsd(ticketPromedioUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cantDocumentos} facturas emitidas</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#8b5cf6" />
              </div>
            </div>

            {/* KPI 3.4: Clientes Activos */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => setShowClientsModal(true)}
              title="Clic para ver directorio completo de clientes"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clientes Activos</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#34d399' }}>
                      {clientesActivosCount}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>de {clients?.length || 627} registrados</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#10b981" />
              </div>
            </div>
          </div>

          {/* 2 Widgets Grandes del Bloque 3 */}
          <div className="bento-grid">
            {/* Widget 3.1: Cartera de Clientes & Morosidad */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <PieIcon size={16} color="var(--motorven-gold)" /> ESTADO DE LA CARTERA CxC
                </span>
                <span className={`semaforo-indicator ${cxcVenPct > 30 ? 'rojo' : cxcVenPct > 15 ? 'amarillo' : 'verde'}`}>
                  <span className="semaforo-dot"></span>
                  Morosidad {cxcVenPct}%
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, padding: '0.5rem 0' }}>
                <div style={{ width: '130px', height: '130px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={carteraClientesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={54}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {carteraClientesData.map((entry, index) => (
                          <Cell key={`cell-cxc-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ flex: 1, paddingLeft: '0.85rem' }}>
                  <div style={{ marginBottom: '0.65rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--semaforo-verde)', marginRight: '4px' }}></span>
                      CxC AL DÍA ({cxcDiaPct}%)
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-heading)' }}>{formatUsd(cxcDia)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--semaforo-rojo)' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--semaforo-rojo)', marginRight: '4px' }}></span>
                      CxC VENCIDAS ({cxcVenPct}%)
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--semaforo-rojo)' }}>{formatUsd(cxcVen)}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setShowClientsModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '4px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Users size={13} /> Clientes ({clients?.length || 0})
                  {(clients || []).filter(c => getClientApprovalStatus(c) === 'PENDIENTE').length > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '0 5px' }}>
                      {(clients || []).filter(c => getClientApprovalStatus(c) === 'PENDIENTE').length} pend.
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreditScoreModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '4px 6px' }}
                >
                  <ShieldCheck size={13} /> Score Crédito
                </button>
              </div>
            </div>

            {/* Widget 3.2: Top 5 Clientes de Mayor Volumen */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Award size={16} color="var(--motorven-gold)" /> TOP 5 CLIENTES (CONCENTRACIÓN PARETO)
                </span>
                <span className="badge badge-warning">Mayor Volumen</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
                {topClientesData.map((cli, idx) => (
                  <div key={idx} style={{ padding: '0.35rem 0.55rem', background: 'var(--surface-input, rgba(255,255,255,0.03))', borderRadius: '6px', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idx + 1}. {cli.nombre}
                      </span>
                      <strong style={{ color: 'var(--motorven-cyan, #0284c7)' }}>{formatUsd(cli.totalUsd)}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, cli.pctTotal * 3)}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #38bdf8)' }}></div>
                      </div>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{cli.pctTotal}% del total</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setShowClientsModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Users size={14} /> Directorio Completo de Clientes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🟣 BLOQUE 4: OPERACIONES, INVENTARIO & PROVEEDORES (CxP)                   */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'operaciones') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Header del Bloque */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.25rem', borderBottom: '1px solid rgba(139, 92, 246, 0.25)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  4. OPERACIONES, INVENTARIO & ESTADÍSTICAS DE LUBRICANTES
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Rotación de producto (más y menos vendidos), stock inmovilizado, vida útil/caducidad y almacén
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-print-report"
                onClick={() => handlePrintReport('operaciones')}
                title="Imprimir informe exclusivo de Inventario, Rotación y Caducidad FIFO"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  gap: '4px'
                }}
              >
                <Printer size={12} style={{ flexShrink: 0 }} />
                <span>Imprimir</span>
              </button>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', fontWeight: 800 }}>
                STOCK & INTELIGENCIA DE LUBRICANTES
              </span>
            </div>
          </div>

          {/* 4 KPI Cards Especializadas del Bloque 4 */}
          <div className="bento-grid">
            {/* KPI 4.1: Stock Total de Lubricantes */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('inventario')}
              title="Clic para ir a Inventario"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8b5cf6', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stock en Almacén</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-heading)' }}>
                      {stockTotalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} title={stockBreakdownLabel}>
                      {stockBreakdownLabel}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#8b5cf6" />
              </div>
            </div>

            {/* KPI 4.2: Valorización del Inventario */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('inventario')}
              title="Clic para ver valoración de existencias"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valorización Stock</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#34d399' }}>
                      {formatUsd(stockValorizadoUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Costo reposición total</div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#10b981" />
              </div>
            </div>

            {/* KPI 4.3: Top Lubricante Más Vendido */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('inventario')}
              title="Clic para ver detalles del producto líder"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Flame size={20} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lubricante Estrella (Top)</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b' }}>
                      {lubricantesAnalytics.productoEstrella ? `${lubricantesAnalytics.productoEstrella.litrosVendidos.toLocaleString('es-VE')} L` : '0 L'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lubricantesAnalytics.productoEstrella?.descripcion}>
                      {lubricantesAnalytics.productoEstrella ? lubricantesAnalytics.productoEstrella.descripcion : 'Sin datos'}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
              </div>
            </div>

            {/* KPI 4.4: Stock Inmovilizado / Huesos */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer', border: lubricantesAnalytics.capitalHuesosUsd > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-glass)' }}
              onClick={() => onNavigate && onNavigate('inventario')}
              title="Clic para ver productos de baja rotación en almacén"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingDown size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Capital Inmovilizado ("Hueso")</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#ef4444' }}>
                      {formatUsd(lubricantesAnalytics.capitalHuesosUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#fca5a5' }}>
                      {lubricantesAnalytics.riesgoVencidoCount} SKUs con &ge;24m sin rotación
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#ef4444" />
              </div>
            </div>
          </div>

          {/* Fila 1 de Widgets: Líneas en Stock & Objetivos con Proveedores */}
          <div className="bento-grid">
            {/* Widget 4.1: Distribución de Stock por Línea de Producto */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Layers size={16} color="var(--neon-cyan)" /> LÍNEAS DE LUBRICANTES EN STOCK
                </span>
                <span className="badge badge-info">Almacén Principal</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {mixLineasData.map((item, idx) => (
                  <div key={idx} style={{ padding: '0.35rem 0.55rem', background: 'var(--surface-input, rgba(255,255,255,0.03))', borderRadius: '6px', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</span>
                      </div>
                      <strong style={{ color: 'var(--text-heading)' }}>{item.litros.toLocaleString('es-VE')} L</strong>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, stockTotalLitros > 0 ? (item.litros / stockTotalLitros) * 100 : 0)}%`, height: '100%', background: item.color }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('inventario')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Package size={14} /> Ver Catálogo & Kardex Completo
                </button>
              </div>
            </div>

            {/* Widget 4.2: Objetivos Estratégicos & Abonos a Proveedores */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Award size={16} color="var(--motorven-gold)" /> OBJETIVOS CON PROVEEDORES
                </span>
                <span className="badge badge-warning">Refinerías</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', flex: 1, alignItems: 'center' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--motorven-emerald)', fontWeight: 700 }}>ABONOS REALIZADOS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-heading)', margin: '4px 0' }}>
                    {formatUsd(objetivosData.abonosProveedores)}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pagos liquidados</span>
                </div>

                <div style={{ background: 'rgba(230, 0, 18, 0.1)', border: '1px solid rgba(230, 0, 18, 0.3)', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--motorven-red)', fontWeight: 700 }}>SALDO PENDIENTE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--motorven-red)', margin: '4px 0' }}>
                    {formatUsd(objetivosData.saldoPendiente)}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Compromisos CxP</span>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveBlock('cxp')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.72rem', gap: '4px', borderColor: 'rgba(239, 68, 68, 0.45)', color: '#f87171' }}
                >
                  <Receipt size={13} /> Ver Bloque 5 CxP
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('compras')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.72rem', gap: '4px' }}
                >
                  <ShoppingCart size={13} /> Compras & Órdenes
                </button>
              </div>
            </div>
          </div>

          {/* Fila 2 de Widgets: Estadísticas Avanzadas de Lubricantes (Top vs Huesos & Caducidad FIFO) */}
          <div className="bento-grid" style={{ marginTop: '0.75rem' }}>
            {/* Widget 4.3: Comparativo de Rotación de Lubricantes (Más vs Menos Vendidos) */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Flame size={16} color="#f59e0b" /> COMPARATIVA DE LUBRICANTES: MÁS VENDIDOS VS "HUESOS"
                </span>
                <span className="badge badge-warning">Rotación ({comparativaYearFilter === 'ALL' ? 'Histórico' : comparativaYearFilter})</span>
              </div>

              {/* Barra de Filtros: Selector por Años y Meses (con 2026 predeterminado) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem', padding: '0.45rem 0.65rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <Filter size={12} color="#f59e0b" />
                  <span style={{ fontWeight: 700 }}>Período Ventas:</span>
                </div>

                {/* Filtro por Año (Predeterminado 2026) */}
                <select
                  value={comparativaYearFilter}
                  onChange={(e) => setComparativaYearFilter(e.target.value)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 6px',
                    borderRadius: '5px',
                    background: 'var(--surface-input, #0f172a)',
                    color: 'var(--text-main, #f8fafc)',
                    border: '1px solid var(--border-glass, rgba(255,255,255,0.15))',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title="Filtrar ventas por año (predeterminado año en curso)"
                >
                  <option value={defaultFiscalYear}>Año {defaultFiscalYear} (En Curso)</option>
                  {defaultFiscalYear !== '2025' && <option value="2025">Año 2025</option>}
                  {defaultFiscalYear !== '2024' && <option value="2024">Año 2024</option>}
                  <option value="ALL">Histórico Completo</option>
                </select>

                {/* Filtro por Mes */}
                <select
                  value={comparativaMonthFilter}
                  onChange={(e) => setComparativaMonthFilter(e.target.value)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 6px',
                    borderRadius: '5px',
                    background: 'var(--surface-input, #0f172a)',
                    color: 'var(--text-main, #f8fafc)',
                    border: '1px solid var(--border-glass, rgba(255,255,255,0.15))',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title="Filtrar ventas por mes"
                >
                  <option value="ALL">Todos los Meses</option>
                  <option value="01">01 - Enero</option>
                  <option value="02">02 - Febrero</option>
                  <option value="03">03 - Marzo</option>
                  <option value="04">04 - Abril</option>
                  <option value="05">05 - Mayo</option>
                  <option value="06">06 - Junio</option>
                  <option value="07">07 - Julio</option>
                  <option value="08">08 - Agosto</option>
                  <option value="09">09 - Septiembre</option>
                  <option value="10">10 - Octubre</option>
                  <option value="11">11 - Noviembre</option>
                  <option value="12">12 - Diciembre</option>
                </select>

                {/* Botón Reset a año en curso */}
                {(comparativaYearFilter !== defaultFiscalYear || comparativaMonthFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setComparativaYearFilter(defaultFiscalYear);
                      setComparativaMonthFilter('ALL');
                    }}
                    style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      cursor: 'pointer'
                    }}
                    title="Restablecer al año en curso"
                  >
                    ✕ Año {defaultFiscalYear}
                  </button>
                )}

                <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  {lubricantesAnalytics.comparativaTotalLitros?.toLocaleString('es-VE') || 0} L facturados
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', flex: 1 }}>
                {/* Columna Izquierda: Los Más Vendidos (Líderes de Rotación) */}
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <TrendingUp size={12} /> MÁS VENDIDOS ({lubricantesAnalytics.todosMasVendidos?.length || 0})
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Litros Facturados</span>
                  </div>

                  {/* Contenedor con Scroll para navegar todos los más vendidos */}
                  <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '4px' }}>
                    {(lubricantesAnalytics.todosMasVendidos || []).map((prod, idx) => {
                      const maxLts = lubricantesAnalytics.todosMasVendidos[0]?.litrosVendidos || 1;
                      const pct = Math.min(100, Math.round((prod.litrosVendidos / maxLts) * 100));
                      return (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '5px', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={prod.descripcion}>
                              #{idx + 1} {prod.descripcion}
                            </span>
                            <span style={{ fontWeight: 800, color: '#34d399', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {prod.litrosVendidos.toLocaleString('es-VE')} L
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', margin: '2px 0' }}>
                            <span>Cód: {prod.codigo} ({prod.viscosidad})</span>
                            <span>{prod.vecesFacturado} facturas</span>
                          </div>
                          <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#10b981' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Columna Derecha: Los Menos Vendidos con Stock (Huesos / Lenta Rotación) */}
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <TrendingDown size={12} /> MENOS VENDIDOS / "HUESOS" ({lubricantesAnalytics.todosHuesosMenosVendidos?.length || 0})
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Capital Atrapado</span>
                  </div>

                  {/* Contenedor con Scroll para navegar todos los menos vendidos */}
                  <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '4px' }}>
                    {(lubricantesAnalytics.todosHuesosMenosVendidos || []).map((prod, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '5px', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={prod.descripcion}>
                            {prod.descripcion}
                          </span>
                          <span style={{ fontWeight: 800, color: '#ef4444', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {formatUsd(prod.valUsd)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>Cód: {prod.codigo} | Stock: {prod.stock} cajas</span>
                          <span style={{ padding: '1px 4px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontWeight: 700 }}>
                            {prod.litrosVendidos === 0 ? `Sin Ventas ${comparativaYearFilter === 'ALL' ? 'Hist.' : comparativaYearFilter}` : `${prod.litrosVendidos} L vend.`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  💡 <strong>Estrategia Comercial:</strong> Lanzar combos promocionales y prioridad FIFO a los SKUs sin rotación.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('inventario')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                >
                  Ver Inventario
                </button>
              </div>
            </div>

            {/* Widget 4.4: Semáforo de Antigüedad, Caducidad y Regla FIFO */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Hourglass size={16} color="var(--neon-cyan)" /> SALUD DEL INVENTARIO & CADUCIDAD
                </span>
                <span className="badge badge-info">Regla FIFO ({caducidadYearFilter === 'ALL' ? 'Todos los Años' : caducidadYearFilter})</span>
              </div>

              {/* Barra de Filtros: Selector por Años y Meses (con 2026 predeterminado) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem', padding: '0.45rem 0.65rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <Filter size={12} color="var(--neon-cyan)" />
                  <span style={{ fontWeight: 700 }}>Filtrar Lote:</span>
                </div>

                {/* Filtro por Año (Predeterminado 2026) */}
                <select
                  value={caducidadYearFilter}
                  onChange={(e) => setCaducidadYearFilter(e.target.value)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 6px',
                    borderRadius: '5px',
                    background: 'var(--surface-input, #0f172a)',
                    color: 'var(--text-main, #f8fafc)',
                    border: '1px solid var(--border-glass, rgba(255,255,255,0.15))',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title="Filtrar por año de producción/llegada del lote"
                >
                  <option value={defaultFiscalYear}>Año {defaultFiscalYear} (Año en curso)</option>
                  {defaultFiscalYear !== '2025' && <option value="2025">Año 2025 (1 Año)</option>}
                  <option value="2024_ANT">Año 2024 o Anterior (&ge; 2 Años)</option>
                  <option value="ALL">Todos los Años</option>
                </select>

                {/* Filtro por Mes */}
                <select
                  value={caducidadMonthFilter}
                  onChange={(e) => setCaducidadMonthFilter(e.target.value)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 6px',
                    borderRadius: '5px',
                    background: 'var(--surface-input, #0f172a)',
                    color: 'var(--text-main, #f8fafc)',
                    border: '1px solid var(--border-glass, rgba(255,255,255,0.15))',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title="Filtrar por mes de lote"
                >
                  <option value="ALL">Todos los Meses</option>
                  <option value="01">01 - Enero</option>
                  <option value="02">02 - Febrero</option>
                  <option value="03">03 - Marzo</option>
                  <option value="04">04 - Abril</option>
                  <option value="05">05 - Mayo</option>
                  <option value="06">06 - Junio</option>
                  <option value="07">07 - Julio</option>
                  <option value="08">08 - Agosto</option>
                  <option value="09">09 - Septiembre</option>
                  <option value="10">10 - Octubre</option>
                  <option value="11">11 - Noviembre</option>
                  <option value="12">12 - Diciembre</option>
                </select>

                {/* Botón Reset a año en curso */}
                {(caducidadYearFilter !== defaultFiscalYear || caducidadMonthFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setCaducidadYearFilter(defaultFiscalYear);
                      setCaducidadMonthFilter('ALL');
                    }}
                    style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0, 242, 254, 0.15)',
                      color: 'var(--neon-cyan, #00f2fe)',
                      border: '1px solid rgba(0, 242, 254, 0.3)',
                      cursor: 'pointer'
                    }}
                    title="Restablecer al año en curso"
                  >
                    ✕ Año {defaultFiscalYear}
                  </button>
                )}

                <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  {lubricantesAnalytics.filteredLotesCount} SKUs ({lubricantesAnalytics.totalStockLitros.toLocaleString('es-VE')} L)
                </span>
              </div>

              {/* Contenedor con Scroll para navegar los 3 bloques y todos sus sub-tramos */}
              <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '4px', flex: 1 }}>

                {/* 🟢 BLOQUE 1: LOTES FRESCOS (Ordenados de Mayor a Menor) */}
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '3px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} color="#10b981" /> LOTES FRESCOS ({lubricantesAnalytics.frescosTiers?.length || 0} Sub-tramos)
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {lubricantesAnalytics.frescosTotalLitros?.toLocaleString('es-VE')} L ({lubricantesAnalytics.totalStockLitros > 0 ? Math.round((lubricantesAnalytics.frescosTotalLitros / lubricantesAnalytics.totalStockLitros) * 100) : 0}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(lubricantesAnalytics.frescosTiers || []).map(tier => (
                      <div key={tier.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tier.name}</span>
                          <span style={{ fontWeight: 800, color: '#34d399' }}>
                            {tier.lts.toLocaleString('es-VE')} L ({tier.pct}%)
                          </span>
                        </div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', margin: '2px 0' }}>
                          <div style={{ width: `${tier.pct}%`, height: '100%', background: tier.color }}></div>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{tier.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 🟡 BLOQUE 2: PRIORIDAD FIFO (3 Meses, 6 Meses, 12 Meses - Ordenados de Mayor a Menor) */}
                <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', borderBottom: '1px solid rgba(245, 158, 11, 0.2)', paddingBottom: '3px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={13} color="#f59e0b" /> PRIORIDAD FIFO ({lubricantesAnalytics.fifoTiers?.length || 0} Sub-tramos)
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {lubricantesAnalytics.fifoTotalLitros?.toLocaleString('es-VE')} L ({lubricantesAnalytics.totalStockLitros > 0 ? Math.round((lubricantesAnalytics.fifoTotalLitros / lubricantesAnalytics.totalStockLitros) * 100) : 0}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(lubricantesAnalytics.fifoTiers || []).map(tier => (
                      <div key={tier.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tier.name}</span>
                          <span style={{ fontWeight: 800, color: '#fbbf24' }}>
                            {tier.lts.toLocaleString('es-VE')} L ({tier.pct}%)
                          </span>
                        </div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', margin: '2px 0' }}>
                          <div style={{ width: `${tier.pct}%`, height: '100%', background: tier.color }}></div>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{tier.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 🔴 BLOQUE 3: RIESGO / ENVEJECIDO (3 Meses, 6 Meses, 12 Meses - Ordenados de Mayor a Menor) */}
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '3px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={13} color="#ef4444" /> RIESGO / ENVEJECIDO ({lubricantesAnalytics.riesgoTiers?.length || 0} Sub-tramos)
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444' }}>
                      {lubricantesAnalytics.riesgoTotalLitros?.toLocaleString('es-VE')} L ({lubricantesAnalytics.totalStockLitros > 0 ? Math.round((lubricantesAnalytics.riesgoTotalLitros / lubricantesAnalytics.totalStockLitros) * 100) : 0}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(lubricantesAnalytics.riesgoTiers || []).map(tier => (
                      <div key={tier.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.35rem 0.5rem', fontSize: '0.72rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{tier.name}</span>
                          <span style={{ fontWeight: 800, color: '#f87171' }}>
                            {tier.lts.toLocaleString('es-VE')} L ({tier.pct}%)
                          </span>
                        </div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', margin: '2px 0' }}>
                          <div style={{ width: `${tier.pct}%`, height: '100%', background: tier.color }}></div>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#fca5a5' }}>{tier.desc}</div>
                      </div>
                    ))}
                  </div>

                  {lubricantesAnalytics.capitalHuesosUsd > 0 && (
                    <div style={{ marginTop: '0.4rem', padding: '0.3rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', fontSize: '0.62rem', color: '#fca5a5', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Capital inmovilizado en riesgo:</span>
                      <strong style={{ color: '#ef4444' }}>{formatUsd(lubricantesAnalytics.capitalHuesosUsd)}</strong>
                    </div>
                  )}
                </div>

              </div>

              {/* Pie con indicador de cobertura */}
              <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Cobertura estimada: <strong style={{ color: 'var(--text-heading)' }}>{lubricantesAnalytics.diasInventarioPromedio} días</strong> de ventas
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('inventario')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.7rem', padding: '3px 8px', gap: '4px' }}
                >
                  <Archive size={12} /> Kardex Lotes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🧾 BLOQUE 5: CUENTAS POR PAGAR (CXP), ANTIGÜEDAD & PROVEEDORES             */}
      {/* ========================================================================= */}
      {(activeBlock === 'ALL' || activeBlock === 'cxp') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.06em', color: 'var(--text-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🧾 BLOQUE 5: CUENTAS POR PAGAR (CXP) & PROVEEDORES</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handlePrintReport('cxp')}
                style={{ fontSize: '0.68rem', padding: '2px 8px', gap: '4px', display: 'flex', alignItems: 'center' }}
                title="Generar PDF exclusivo del Bloque 5: Cuentas por Pagar"
              >
                <Printer size={12} /> Imprimir
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate && onNavigate('cxp')}
                style={{ fontSize: '0.68rem', padding: '2px 8px', gap: '4px', display: 'flex', alignItems: 'center', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.45)' }}
                title="Abrir gestión operativa completa de Cuentas por Pagar"
              >
                <Receipt size={12} /> Gestionar CxP
              </button>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 800 }}>
                OBLIGACIONES & TESORERÍA
              </span>
            </div>
          </div>

          {/* 4 KPI Cards del Bloque 5 */}
          <div className="bento-grid">
            {/* KPI 5.1: Saldo Total CxP */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('cxp')}
              title="Clic para abrir el módulo de Cuentas por Pagar"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Saldo Total CxP</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-heading)' }}>
                      {formatUsd(cxpAnalytics.totalSaldoUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {cxpAnalytics.openDocsCount} docs · {cxpAnalytics.suppliersWithDebtCount} acreedores
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#ef4444" />
              </div>
            </div>

            {/* KPI 5.2: CxP Vencida & Morosidad */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('cxp')}
              title="Clic para revisar facturas de proveedores vencidas"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(230, 0, 18, 0.16)', border: '1px solid var(--motorven-red)', color: 'var(--motorven-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CxP Vencida</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: cxpAnalytics.totalVencidoUsd > 0 ? '#ef4444' : '#10b981' }}>
                      {formatUsd(cxpAnalytics.totalVencidoUsd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: cxpAnalytics.morosidadPct > 40 ? '#ef4444' : 'var(--motorven-gold)', fontWeight: 700 }}>
                      {cxpAnalytics.morosidadPct}% mora · {cxpAnalytics.vencidosDocsCount} docs
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#ef4444" />
              </div>
            </div>

            {/* KPI 5.3: Compromisos Próximos 15 Días */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('cxp')}
              title="Compromisos vigentes por vencer en los próximos 15 días"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vence Próx. 15 Días</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b' }}>
                      {formatUsd(cxpAnalytics.porVencer15Usd)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {cxpAnalytics.porVencer15Count} compromisos próximos
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} color="#f59e0b" />
              </div>
            </div>

            {/* KPI 5.4: Cobertura Caja vs. CxP Urgente */}
            <div
              className="bento-card col-span-3"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('caja')}
              title="Disponibilidad en Caja/Bancos dividida entre (Vencido + Próx. 15 días)"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: cxpAnalytics.coberturaRatio >= 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${cxpAnalytics.coberturaRatio >= 1 ? '#10b981' : '#ef4444'}`,
                      color: cxpAnalytics.coberturaRatio >= 1 ? '#10b981' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cobertura Caja / Urg.</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.25rem', fontWeight: 900, color: cxpAnalytics.coberturaRatio >= 1 ? '#10b981' : '#ef4444' }}>
                      {cxpAnalytics.coberturaRatio}x
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Abonos período: {formatUsd(objetivosData.abonosPeriodo)}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} color={cxpAnalytics.coberturaRatio >= 1 ? '#10b981' : '#ef4444'} />
              </div>
            </div>
          </div>

          {/* Fila 1 Bloque 5: Antigüedad de Saldos (Aging) & Top Proveedores Acreedores */}
          <div className="bento-grid">
            {/* Widget 5.1: Antigüedad de Saldos CxP */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <BarChart2 size={16} color="#ef4444" /> ANTIGÜEDAD DE SALDOS CXP (AGING)
                </span>
                <span className="badge badge-danger">{cxpAnalytics.morosidadPct}% Vencido</span>
              </div>

              <div style={{ width: '100%', height: 185 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cxpAnalytics.agingChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis width={58} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(2)}k` : `$${Number(v || 0).toFixed(2)}`)} />
                    <Tooltip
                      formatter={(value) => [formatUsd(value), 'Saldo']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="montoUsd" radius={[6, 6, 0, 0]} maxBarSize={52}>
                      {cxpAnalytics.agingChartData.map((entry, idx) => (
                        <Cell key={`aging-cell-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
                {cxpAnalytics.agingChartData.map((b) => (
                  <div key={b.bucket} style={{ padding: '6px 8px', borderRadius: '8px', background: 'var(--bg-subtle, rgba(255,255,255,0.03))', border: `1px solid ${b.color}40`, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: b.color, fontWeight: 800, textTransform: 'uppercase' }}>{b.label}</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-heading)' }}>{formatUsd(b.montoUsd)}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{b.count} docs</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 5.2: Top Proveedores Acreedores */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <Truck size={16} color="#f59e0b" /> TOP ACREEDORES / PROVEEDORES CXP
                </span>
                <span className="badge badge-warning">{cxpAnalytics.suppliersWithDebtCount} con saldo</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {cxpAnalytics.topProveedores.length > 0 ? (
                  cxpAnalytics.topProveedores.map((prov, idx) => (
                    <div key={prov.key || idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 8px', borderRadius: '8px', background: 'var(--bg-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {idx + 1}. {prov.nombre}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {prov.vencidoUsd > 0 && (
                            <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 700 }}>
                              Venc: {formatUsd(prov.vencidoUsd)} ({prov.maxDiasMora}d)
                            </span>
                          )}
                          <strong style={{ color: 'var(--text-heading)' }}>{formatUsd(prov.saldoUsd)}</strong>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({prov.pctTotal}%)</span>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '5px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, prov.pctTotal)}%`, height: '100%', background: prov.vencidoUsd > 0 ? '#ef4444' : '#10b981' }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Sin saldos pendientes con proveedores.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fila 2 Bloque 5: Compras vs. Abonos Mensuales & Documentos Críticos CxP */}
          <div className="bento-grid">
            {/* Widget 5.3: Flujo Compras vs. Abonos Mensuales */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <DollarSign size={16} color="#10b981" /> COMPRAS vs. ABONOS PROVEEDORES ({anioActivo})
                </span>
                <span className="badge badge-info">Mensual</span>
              </div>

              <div style={{ width: '100%', height: 195 }}>
                {cxpAnalytics.comprasVsAbonosMensual.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cxpAnalytics.comprasVsAbonosMensual} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis width={58} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(2)}k` : `$${Number(v || 0).toFixed(2)}`)} />
                      <Tooltip
                        formatter={(value, name) => [formatUsd(value), name === 'comprasUsd' ? 'Compras Netas' : 'Abonos / Pagos']}
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Bar dataKey="comprasUsd" name="Compras Netas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="abonosUsd" name="Abonos / Pagos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Sin registros de compras o pagos en {anioActivo}.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)', fontSize: '0.72rem' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>● Compras Netas</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>● Abonos Liquidados</span>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>
                  Histórico Abonos: <strong style={{ color: 'var(--text-heading)' }}>{formatUsd(objetivosData.abonosProveedores)}</strong>
                </span>
              </div>
            </div>

            {/* Widget 5.4: Exposición por Moneda & Documentos Críticos por Pagar */}
            <div className="bento-card col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="bento-card-header">
                <span className="bento-card-header-title">
                  <AlertOctagon size={16} color="#ef4444" /> DOCUMENTOS CRÍTICOS & MONEDA CXP
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('cxp')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.68rem', padding: '2px 8px', gap: '4px' }}
                >
                  <ExternalLink size={11} /> Ver Todos ({cxpAnalytics.openDocsCount})
                </button>
              </div>

              {/* Exposición USD vs Bs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.72rem' }}>
                <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Deuda en Divisas ({cxpAnalytics.currencyBreakdown.usdPct}%)</span>
                  <strong style={{ color: '#10b981' }}>{formatUsd(cxpAnalytics.currencyBreakdown.usd)}</strong>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Deuda en Bs eq. ({cxpAnalytics.currencyBreakdown.bsPct}%)</span>
                  <strong style={{ color: '#38bdf8' }}>{formatUsd(cxpAnalytics.currencyBreakdown.bsUsd)}</strong>
                </div>
              </div>

              {/* Top 5-6 Documentos Críticos */}
              <div style={{ overflowX: 'auto', flex: 1 }}>
                {cxpAnalytics.criticalDocs.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '4px 6px' }}>Proveedor</th>
                        <th style={{ padding: '4px 6px' }}>Documento</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' }}>Estatus</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Saldo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cxpAnalytics.criticalDocs.map((doc) => (
                        <tr key={doc.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                          <td style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--text-main)', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.provNombre}
                          </td>
                          <td style={{ padding: '5px 6px', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                            {doc.tipoDoc} #{doc.nroDoc}
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                            {doc.diasMora > 0 ? (
                              <span style={{ padding: '1px 6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.16)', color: '#f87171', fontWeight: 800, fontSize: '0.64rem' }}>
                                +{doc.diasMora}d mora
                              </span>
                            ) : (
                              <span style={{ padding: '1px 6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 700, fontSize: '0.64rem' }}>
                                {doc.diasRestantes}d vig.
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800, color: 'var(--text-heading)' }}>
                            {formatUsd(doc.saldoUsd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No hay documentos abiertos en Cuentas por Pagar.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. BANNER DESTACADO DEL CENTRO DE NOTIFICACIONES & ALERTAS OPERACIONALES  */}
      {/* ========================================================================= */}
      <div
        className="bento-card col-span-12 notif-widget-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          border: unreadNotifsCount > 0 ? '1.5px solid var(--semaforo-rojo, #e60012)' : '1px solid var(--border-glass)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: unreadNotifsCount > 0 ? 'rgba(230, 0, 18, 0.18)' : 'rgba(0, 43, 122, 0.25)',
              border: unreadNotifsCount > 0 ? '1px solid rgba(230, 0, 18, 0.5)' : '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: unreadNotifsCount > 0 ? '#ef4444' : 'var(--neon-cyan, #38bdf8)'
            }}
          >
            <BellRing size={22} className={unreadNotifsCount > 0 ? 'animate-bounce' : ''} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--neon-cyan, #0284c7)', letterSpacing: '0.08em' }}>
                CENTRO DE SUPERVISIÓN & CONTROL OPERACIONAL
              </span>
              {unreadNotifsCount > 0 ? (
                <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--semaforo-rojo)', color: '#ffffff', padding: '1px 8px', borderRadius: '10px' }}>
                  {unreadNotifsCount} ALERTAS ACTIVAS
                </span>
              ) : (
                <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.2)', color: '#059669', padding: '1px 8px', borderRadius: '10px' }}>
                  SISTEMA SIN ALERTAS PENDIENTES
                </span>
              )}
            </div>
            <h3 style={{ margin: '3px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading)' }}>
              Centro de Notificaciones & Alertas Operacionales
            </h3>
            <div className="notif-widget-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Monitoreo centralizado de inventario crítico ROP, mora de cobranzas CxC, libros SENIAT y conectividad Supabase.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              generateNotificationsPDF({
                notifications: notificationsList,
                filter: 'ALL',
                config,
                currentUser
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '0.55rem 0.95rem',
              borderRadius: '8px'
            }}
          >
            <Printer size={15} /> Imprimir Alertas PDF
          </button>

          <button
            type="button"
            onClick={() => setShowNotificationsModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #002b7a 0%, #1e3a8a 100%)',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(0, 43, 122, 0.45)',
              transition: 'filter 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1.0)')}
          >
            <Bell size={15} /> Abrir Notificaciones & Alertas
          </button>
        </div>
      </div>
      
      {/* Modal 1: Vista Previa e Impresión de Informe Ejecutivo */}
      <ExecutiveSummaryModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        kpiData={enrichedKpiData}
        semMeta={semMeta}
        config={config}
        currentUser={currentUser}
        sales={sales}
        products={products}
        orders={orders}
        carteraClientesData={carteraClientesData}
        cobranzasData={cobranzasData}
        disponibilidadBancariaData={disponibilidadBancariaData}
        objetivosData={objetivosData}
        topClientsData={topClientesData}
        lubricantesAnalytics={lubricantesAnalytics}
        cxpAnalytics={cxpAnalytics}
        ventasDelDia={ventasDelDia}
        ventasAcumuladoMes={ventasAcumuladoMes}
        ventasMesLabel={MONTHS_LIST.find(m => m.id === ventasMesFilter)?.label || ventasMesFilter}
        todayLabel={todayLabel}
        sellers={(sellersCompliance && sellersCompliance.length > 0) ? sellersCompliance : effectiveSellersList}
        selectedMonth={selectedMonth}
        periodoLabel={periodoLabel}
        onDownloadFullPdf={handlePrintReport}
      />

      {/* Modal 2: Directorio de 610+ Clientes de Supabase */}
      <ClientsDirectoryModal
        isOpen={showClientsModal}
        onClose={() => setShowClientsModal(false)}
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
        onSelectClientForPOS={(client) => {
          setShowClientsModal(false);
          if (onSelectClientForModule) onSelectClientForModule(client, 'ventas');
          else if (onNavigate) onNavigate('ventas');
        }}
        onSelectClientForPayment={(client) => {
          setShowClientsModal(false);
          if (onSelectClientForModule) onSelectClientForModule(client, 'cxc');
          else if (onNavigate) onNavigate('cxc');
        }}
      />

      {/* Modal 3: Score Crediticio & Evaluación de Riesgo */}
      <CreditScoreEngineModal
        isOpen={showCreditScoreModal}
        onClose={() => setShowCreditScoreModal(false)}
        clients={clients}
        profitInvoices={profitInvoices}
        sales={sales}
        profitCollections={profitCollections}
        config={config}
        tasaBcv={tasaBcv}
        onSelectClientForSale={(client) => {
          setShowCreditScoreModal(false);
          if (onSelectClientForModule) onSelectClientForModule(client, 'ventas');
          else if (onNavigate) onNavigate('ventas');
        }}
      />

      {/* Modal 4: Centro de Notificaciones & Alertas */}
      <NotificationsCenterModal
        isOpen={showNotificationsModal}
        onClose={() => {
          setShowNotificationsModal(false);
          // Recargar lista para refrescar badges
          getSupabaseNotifications().then(data => {
            if (data) setNotificationsList(data);
          }).catch(() => {});
        }}
        config={config}
        currentUser={currentUser}
        products={products}
        clients={clients}
        onNavigate={onNavigate}
      />


    </div>
  );
}
