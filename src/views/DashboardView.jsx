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
  Monitor
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
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
import { isMasterOrGerencia, isMasterAdmin } from '../services/authService';
import { DEFAULT_PROFIT_SELLERS } from '../data/mockData';
import { generateDashboardPDF, generateNotificationsPDF } from '../services/pdfReportService';
import { getSupabaseNotifications, seedInitialNotificationsIfEmpty } from '../services/supabaseService';

function formatAdvisorName(name) {
  if (!name) return 'Asesor';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function extractMonthNumber(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date && !isNaN(dateVal)) {
    return String(dateVal.getMonth() + 1).padStart(2, '0');
  }
  const str = String(dateVal).trim();
  if (!str) return '';
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return isoMatch[2].padStart(2, '0');
  }
  // Formato latinoamericano DD/MM/YYYY o DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
    const parts = str.split(/[\/\-]/);
    if (parts.length >= 2) {
      return parts[1].padStart(2, '0');
    }
  }
  // Formato ISO estándar YYYY-MM-DD
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return String(d.getUTCMonth() + 1).padStart(2, '0');
    }
  } catch (_) {}
  return '';
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
  config = {},
  currentUser,
  onNavigate,
  onSyncProfit,
  onSaveClient,
  onDeleteClient,
  onOpenOrdersSalesModal,
}) {
  // Estados de Modales
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [showCreditScoreModal, setShowCreditScoreModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filtros de Comparativa de Lubricantes (por Año y Mes, con 2026 predeterminado)
  const [comparativaYearFilter, setComparativaYearFilter] = useState('2026');
  const [comparativaMonthFilter, setComparativaMonthFilter] = useState('ALL');

  // Filtros de Salud del Inventario y Caducidad (por Años y Meses, con 2026 predeterminado)
  const [caducidadYearFilter, setCaducidadYearFilter] = useState('2026');
  const [caducidadMonthFilter, setCaducidadMonthFilter] = useState('ALL');

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

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  // Filtro mensual y anual de Metas Cumplidas (Año en curso)
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' = Cierre Anual Acumulado, '01'..'12' = Mes específico

  const anioActivo = config?.ejercicioFiscalActivo || 2026;
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

  // Filtrar facturas según el rango del ejercicio fiscal y el mes seleccionado
  const filteredProfitInvoices = useMemo(() => {
    if (!Array.isArray(profitInvoices)) return [];
    const valid = profitInvoices.filter(f => {
      if (f.anulada) return false;
      const dateStr = f?.fechaEmision || f?.fecEmis || f?.fec_emis || f?.fecha || '';
      if (!dateStr) return true;
      const d = dateStr.substring(0, 10);
      return d >= fechaInicioEfectiva && d <= fechaFinEfectiva;
    });

    if (selectedMonth === 'ALL') return valid;
    return valid.filter(f => {
      const dateStr = f?.fechaEmision || f?.fecEmis || f?.fec_emis || f?.fecha || '';
      const m = extractMonthNumber(dateStr);
      return m === selectedMonth;
    });
  }, [profitInvoices, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Cálculo dinámico de Litros Facturados locales
  const litrosRealesVendidos = useMemo(() => {
    return (sales || []).filter(s => {
      const d = (s.fecha || '').substring(0, 10);
      if (d && (d < fechaInicioEfectiva || d > fechaFinEfectiva)) return false;
      if (selectedMonth === 'ALL') return true;
      const m = extractMonthNumber(s.fecha);
      return m === selectedMonth;
    }).reduce((acc, s) => {
      const litrosVenta = s.items ? s.items.reduce((itemAcc, item) => itemAcc + (item.litros || (item.cantidad * (item.litrosPorUnidad || 0))), 0) : 0;
      return acc + litrosVenta;
    }, 0);
  }, [sales, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Litros Facturados reales en el período seleccionado (desde Supabase profit_invoices)
  const litrosFacturadosPeriodo = useMemo(() => {
    const fromInvoices = filteredProfitInvoices.reduce((acc, f) => acc + (Number(f?.totalLitros ?? f?.total_litros) || 0), 0);
    return parseFloat((fromInvoices + litrosRealesVendidos).toFixed(2));
  }, [filteredProfitInvoices, litrosRealesVendidos]);

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

      const matchesSeller = (fieldVal) => {
        if (!fieldVal) return false;
        const str = fieldVal.toString().trim().toLowerCase();
        const targetCo = coVen.toLowerCase();
        const targetDes = venDes.toLowerCase();
        if (targetCo && (str === targetCo || str.startsWith(targetCo) || str.includes(targetCo))) return true;
        if (targetDes && (str.includes(targetDes) || targetDes.includes(str))) return true;
        return false;
      };

      // Facturas Supabase asignadas
      const sInvoices = (filteredProfitInvoices || []).filter(f => matchesSeller(f?.vendedorId || f?.co_ven || f?.vendedor || f?.asesor));
      const sInvoicesLitros = sInvoices.reduce((acc, f) => acc + (Number(f?.totalLitros ?? f?.total_litros) || 0), 0);

      // Ventas locales POS asignadas al vendedor
      const sSales = (sales || []).filter(s => {
        if (selectedMonth !== 'ALL') {
          const m = extractMonthNumber(s.fecha);
          if (m !== selectedMonth) return false;
        }
        return matchesSeller(s?.vendedor || s?.vendedorId || s?.co_ven);
      });
      const sSalesLitros = sSales.reduce((acc, s) => {
        return acc + (s.items ? s.items.reduce((itemAcc, item) => itemAcc + (item.litros || (item.cantidad * (item.litrosPorUnidad || 0))), 0) : 0);
      }, 0);

      const sLitros = sInvoicesLitros + sSalesLitros;
      const sMetaBase = Number(seller?.metaLitrosMes ?? seller?.meta_litros_mes) || 3000;
      const sMeta = selectedMonth === 'ALL' ? sMetaBase * 10 : sMetaBase;

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
  }, [effectiveSellersList, filteredProfitInvoices, sales, metaLitros, selectedMonth]);

  // Histórico de Metas y Cumplimiento real de todos los meses de 2026 calculado de Supabase
  const monthlyHistoryData = useMemo(() => {
    const metaBaseMes = effectiveSellersList.reduce((acc, s) => acc + (Number(s?.metaLitrosMes ?? s?.meta_litros_mes) || 3000), 0) || 30000;
    
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
      const invLiters = (profitInvoices || []).filter(f => {
        if (f.anulada) return false;
        const d = f.fechaEmision || f.fecEmis || f.fec_emis || f.fecha || '';
        const monthNum = extractMonthNumber(d);
        return monthNum === m.num;
      }).reduce((acc, f) => acc + (Number(f.totalLitros ?? f.total_litros) || 0), 0);

      const salesLiters = (sales || []).filter(s => {
        const d = s.fecha || '';
        const monthNum = extractMonthNumber(d);
        return monthNum === m.num;
      }).reduce((acc, s) => {
        const litrosVenta = s.items ? s.items.reduce((itemAcc, item) => itemAcc + (item.litros || (item.cantidad * (item.litrosPorUnidad || 0))), 0) : 0;
        return acc + litrosVenta;
      }, 0);

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
  }, [effectiveSellersList, profitInvoices, sales]);

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

  // Pedidos pendientes por facturar calculados en tiempo real desde orders de Supabase
  const basePendiente = useMemo(() => {
    if (!Array.isArray(orders) || orders.length === 0) return 0;
    return orders
      .filter(o => {
        const st = (o.status || '').toUpperCase();
        return st === 'PENDIENTE' || st === 'APROBADO';
      })
      .reduce((sum, o) => sum + (Number(o.totalLitros ?? o.total_litros) || 0), 0);
  }, [orders]);

  const kpiData = {
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
  };

  // Cartera de Clientes calculada directamente de profit_invoices y ventas a crédito
  const { cxcDia, cxcVen } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let alDia = 0;
    let vencida = 0;

    // Facturas Supabase
    if (Array.isArray(profitInvoices)) {
      profitInvoices.forEach(f => {
        if (f.anulada) return;
        let saldo = Number(f.saldoUsd ?? f.saldo_usd ?? 0);
        if (saldo <= 0.01 && (f.saldoBs ?? f.saldo_bs) && tasaBcv > 0) {
          saldo = Number(f.saldoBs ?? f.saldo_bs) / tasaBcv;
        }
        if (saldo <= 0.01) return;
        const fVenc = f.fechaVencimiento || f.fecVenc || f.fec_venc || '';
        if (!fVenc || fVenc >= today) {
          alDia += saldo;
        } else {
          vencida += saldo;
        }
      });
    }

    // Ventas locales POS a crédito con saldo pendiente
    if (Array.isArray(sales)) {
      sales.forEach(s => {
        if (s.condicionPago === 'CREDITO' || s.aCredito) {
          const saldo = Number(s.saldoPendiente ?? s.saldoUsd ?? (s.totalUsd && !s.pagado ? s.totalUsd : 0));
          if (saldo > 0.01) {
            const fVenc = s.fechaVencimiento || s.fechaVenc || '';
            if (!fVenc || fVenc >= today) {
              alDia += saldo;
            } else {
              vencida += saldo;
            }
          }
        }
      });
    }

    return {
      cxcDia: parseFloat(alDia.toFixed(2)),
      cxcVen: parseFloat(vencida.toFixed(2))
    };
  }, [profitInvoices, sales, tasaBcv]);

  const cxcTot = cxcDia + cxcVen;
  const cxcDiaPct = cxcTot > 0 ? parseFloat(((cxcDia / cxcTot) * 100).toFixed(2)) : 0;
  const cxcVenPct = cxcTot > 0 ? parseFloat(((cxcVen / cxcTot) * 100).toFixed(2)) : 0;

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
      .filter(b => (Number(b.saldoUsd ?? b.saldo_usd ?? 0) > 0) || (Number(b.saldoBs ?? b.saldo_bs ?? 0) > 0))
      .map(b => {
        const usdDirect = Number(b.saldoUsd ?? b.saldo_usd ?? 0);
        const bsDirect = Number(b.saldoBs ?? b.saldo_bs ?? 0);
        const montoCalculado = usdDirect > 0 ? usdDirect : (bsDirect > 0 && tasaBcv > 0 ? bsDirect / tasaBcv : 0);
        return {
          banco: b.bancoNombre || b.banco_nombre || b.codCta || 'Banco',
          numCta: b.numCta || b.num_cta || '',
          monto: parseFloat(montoCalculado.toFixed(2)),
          montoBs: bsDirect
        };
      })
      .sort((a, b) => b.monto - a.monto);
  }, [profitBankAccounts, tasaBcv]);

  const totalDisponibilidad = useMemo(() => {
    return disponibilidadBancariaData.reduce((acc, b) => acc + (Number(b.monto) || 0), 0);
  }, [disponibilidadBancariaData]);

  // Gestión de Cobranzas calculada directamente de profit_collections en Supabase
  const cobranzasData = useMemo(() => {
    if (!Array.isArray(profitCollections) || profitCollections.length === 0) {
      return { acumulada: 0, enBs: 0, efectivoZelle: 0 };
    }
    const active = profitCollections.filter(c => !c.anulado);
    const sumUsd = active.reduce((sum, c) => sum + (Number(c.montoUsd ?? c.monto_usd ?? 0) || 0), 0);
    const sumBs = active.reduce((sum, c) => sum + (Number(c.montoBs ?? c.monto_bs ?? 0) || 0), 0);
    
    // Total de cobranzas en divisas (Efectivo USD / Zelle / Depósito USD)
    const efectivoZelle = active.reduce((sum, c) => {
      const metodo = (c.metodo || c.formaPago || c.forma_pago || c.tipo || '').toUpperCase();
      if (metodo.includes('EFECTIVO') || metodo.includes('ZELLE') || metodo.includes('DIVISA') || metodo.includes('CASH') || metodo.includes('USD')) {
        return sum + (Number(c.montoUsd ?? c.monto_usd ?? 0) || 0);
      }
      return sum;
    }, 0);

    return {
      acumulada: parseFloat(sumUsd.toFixed(2)),
      enBs: parseFloat(sumBs.toFixed(2)),
      efectivoZelle: parseFloat(efectivoZelle.toFixed(2))
    };
  }, [profitCollections]);

  // Objetivos Estratégicos (Abonos Proveedores y Saldo Pendiente CxP) desde Supabase
  const objetivosData = useMemo(() => {
    const totalAbonos = Array.isArray(profitSupplierPayments)
      ? profitSupplierPayments.filter(p => !p.anulado).reduce((sum, p) => {
          let val = Number(p.montoUsd ?? p.monto_usd ?? 0);
          if (p.moneda === 'BS' && val > 0 && tasaBcv > 1) {
            val = val / tasaBcv;
          }
          return sum + val;
        }, 0)
      : 0;

    const totalSaldoPendiente = Array.isArray(profitAccountsPayable)
      ? profitAccountsPayable.filter(d => !d.anulado).reduce((sum, d) => {
          let val = Number(d.saldoUsd ?? d.saldo_usd ?? 0);
          if (d.moneda === 'BS' && val > 0 && tasaBcv > 1) {
            val = val / tasaBcv;
          }
          return sum + val;
        }, 0)
      : 0;

    return {
      abonosProveedores: parseFloat(totalAbonos.toFixed(2)),
      saldoPendiente: parseFloat(totalSaldoPendiente.toFixed(2))
    };
  }, [profitSupplierPayments, profitAccountsPayable, tasaBcv]);

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
    const salesTotal = (sales || []).filter(s => {
      const d = (s.fecha || '').substring(0, 10);
      if (d && (d < fechaInicioEfectiva || d > fechaFinEfectiva)) return false;
      if (selectedMonth === 'ALL') return true;
      return extractMonthNumber(s.fecha) === selectedMonth;
    }).reduce((acc, s) => acc + (Number(s.totalUsd) || 0), 0);
    return parseFloat((invTotal + salesTotal).toFixed(2));
  }, [filteredProfitInvoices, sales, selectedMonth, fechaInicioEfectiva, fechaFinEfectiva]);

  // Precio Promedio por Litro ($ / L) en el período
  const precioPromedioLitro = useMemo(() => {
    if (totalLitros <= 0) return 0;
    return parseFloat((totalFacturadoUsd / totalLitros).toFixed(2));
  }, [totalFacturadoUsd, totalLitros]);

  // Efectividad de Cobranza (% recaudado vs facturado)
  const efectividadCobranzaPct = useMemo(() => {
    if (totalFacturadoUsd <= 0) return 100;
    const pct = (cobranzasData.acumulada / totalFacturadoUsd) * 100;
    return parseFloat(Math.min(pct, 100).toFixed(1));
  }, [cobranzasData.acumulada, totalFacturadoUsd]);

  // Métricas de Clientes, Ticket Promedio y Top 5 Clientes en el período
  const { ticketPromedioUsd, cantDocumentos, clientesActivosCount, topClientesData } = useMemo(() => {
    const cantDocs = (filteredProfitInvoices || []).length;
    const ticket = cantDocs > 0 ? parseFloat((totalFacturadoUsd / cantDocs).toFixed(2)) : 0;

    const clientMap = new Map();
    (filteredProfitInvoices || []).forEach(f => {
      const cid = f.clienteId || f.cliente_id || f.co_cli;
      if (!cid) return;
      const cname = f.clienteNombre || f.cliente_nombre || f.cli_des || cid;
      const crif = f.clienteRif || f.cliente_rif || f.rif || '';
      const current = clientMap.get(cid) || { id: cid, nombre: cname, rif: crif, totalUsd: 0, facturasCount: 0 };
      current.totalUsd += Number(f.totNetoUsd ?? f.tot_neto_usd ?? f.totalNetoUsd ?? 0);
      current.facturasCount += 1;
      clientMap.set(cid, current);
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
  }, [filteredProfitInvoices, totalFacturadoUsd]);

  // Métricas de Inventario, Valorización y Mix de Líneas de Producto
  const { stockTotalLitros, stockTotalCajas, stockValorizadoUsd, productosEnRopCount, mixLineasData } = useMemo(() => {
    let totalStockLts = 0;
    let valUsd = 0;
    let ropCount = 0;
    const linesMap = new Map();

    (products || []).forEach(p => {
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnidad = Number(p.litrosPorUnidad ?? p.litros_por_unidad ?? 12);
      const lts = cant * ltsUnidad;
      totalStockLts += lts;

      const costo = Number(p.costoUsd ?? p.costo ?? p.costo_unitario ?? 22.5);
      valUsd += cant * costo;

      const min = Number(p.puntoReorden ?? p.punto_reorden ?? p.stockMinimo ?? 10);
      if (cant <= min) ropCount++;

      const linea = (p.linea || p.categoria || p.categoria_nombre || 'Lubricantes General').trim();
      linesMap.set(linea, (linesMap.get(linea) || 0) + lts);
    });

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
      stockTotalLitros: parseFloat(totalStockLts.toFixed(1)),
      stockTotalCajas: parseFloat((totalStockLts / 11.35).toFixed(1)),
      stockValorizadoUsd: parseFloat(valUsd.toFixed(2)),
      productosEnRopCount: ropCount,
      mixLineasData: mixData
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

    // Mapear ventas por SKU desde profitInvoices (respetando período de filtrado)
    const salesMap = new Map();
    let totalLtsVendidosReal = 0;

    const sourceInvoices = filteredProfitInvoices.length > 0 ? filteredProfitInvoices : profitInvoices;
    (sourceInvoices || []).forEach(inv => {
      if (inv.anulada) return;
      (inv.items || []).forEach(it => {
        const sku = String(it.articuloId || it.codigo || '').trim();
        if (!sku) return;
        const lts = Number(it.litrosTotales || it.cantidad || 0);
        totalLtsVendidosReal += lts;
        const prev = salesMap.get(sku) || { litros: 0, count: 0, usd: 0 };
        prev.litros += lts;
        prev.count += 1;
        prev.usd += Number(it.totalNeto || 0) / (tasaBcv > 1 ? tasaBcv : 827.73);
        salesMap.set(sku, prev);
      });
    });

    // Mapear fechas de compra/recepción de lote por SKU
    const purchaseDatesBySku = new Map();
    (profitPurchases || []).forEach(pu => {
      if (pu.anulada) return;
      const f = pu.fechaEmision || pu.fec_emis;
      if (!f) return;
      (pu.items || []).forEach(it => {
        const sku = String(it.articuloId || it.codigo || '').trim();
        if (sku && (!purchaseDatesBySku.has(sku) || new Date(f) > new Date(purchaseDatesBySku.get(sku)))) {
          purchaseDatesBySku.set(sku, f);
        }
      });
    });

    const activeProducts = (products || []).filter(isLubricant);
    const analyzed = activeProducts.map(p => {
      const sku = String(p.codigo || p.id || '').trim();
      const s = salesMap.get(sku) || { litros: 0, count: 0, usd: 0 };
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnit = Number(p.litrosPorUnidad ?? p.litros_por_unidad ?? 12);
      const ltsStock = cant * ltsUnit;
      const costo = Number(p.costoUsd ?? p.costo ?? p.costo_unitario ?? 22.5);
      const valUsd = cant * costo;

      // Determinar año y mes de lote (desde compras reales o rotación histórica)
      let yearLote = '2026';
      let monthLote = '01';
      const fCompra = purchaseDatesBySku.get(sku);

      if (fCompra) {
        const d = new Date(fCompra);
        if (!isNaN(d.getTime())) {
          yearLote = String(d.getFullYear());
          monthLote = String(d.getMonth() + 1).padStart(2, '0');
        }
      } else {
        if (s.litros === 0 && cant > 0) {
          yearLote = '2024';
          monthLote = '04';
        } else if (s.litros < 100 && cant > 30) {
          yearLote = '2025';
          monthLote = '08';
        } else {
          yearLote = '2026';
          monthLote = '05';
        }
      }

      // Estatus de caducidad según antigüedad respecto a hoy (norma 3-5 años)
      let estatusCaducidad = 'OPTIMO'; // 'OPTIMO' (<12m) | 'ATENCION_FIFO' (12-24m) | 'RIESGO_VENCIDO' (>24m)
      let mesesBodega = 4;

      if (Number(yearLote) <= 2024) {
        estatusCaducidad = 'RIESGO_VENCIDO';
        mesesBodega = (2026 - Number(yearLote)) * 12 + (10 - Number(monthLote));
      } else if (yearLote === '2025') {
        estatusCaducidad = 'ATENCION_FIFO';
        mesesBodega = 12 + (10 - Number(monthLote));
      } else {
        estatusCaducidad = 'OPTIMO';
        mesesBodega = Math.max(1, 10 - Number(monthLote));
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

    // Mapear ventas específicas para la Comparativa de Lubricantes (filtrado dinámico por Año y Mes)
    const comparativaSalesMap = new Map();
    let comparativaTotalLts = 0;

    (profitInvoices || []).forEach(inv => {
      if (inv.anulada) return;
      const f = inv.fechaEmision || inv.fec_emis || '';
      if (!f) return;
      const d = new Date(f);
      if (isNaN(d.getTime())) return;
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, '0');

      const matchY = comparativaYearFilter === 'ALL' || y === comparativaYearFilter;
      const matchM = comparativaMonthFilter === 'ALL' || m === comparativaMonthFilter;
      if (!matchY || !matchM) return;

      (inv.items || []).forEach(it => {
        const sku = String(it.articuloId || it.codigo || '').trim();
        if (!sku) return;
        const lts = Number(it.litrosTotales || it.cantidad || 0);
        comparativaTotalLts += lts;
        const prev = comparativaSalesMap.get(sku) || { litros: 0, count: 0, usd: 0 };
        prev.litros += lts;
        prev.count += 1;
        prev.usd += Number(it.totalNeto || 0) / (tasaBcv > 1 ? tasaBcv : 827.73);
        comparativaSalesMap.set(sku, prev);
      });
    });

    // Todos los Más Vendidos según el filtro de período seleccionado (Año/Mes)
    const todosMasVendidos = activeProducts.map(p => {
      const sku = String(p.codigo || p.id || '').trim();
      const s = comparativaSalesMap.get(sku) || { litros: 0, count: 0, usd: 0 };
      const cant = Number(p.stock || p.existencia || 0);
      const ltsUnit = Number(p.litrosPorUnidad ?? p.litros_por_unidad ?? 12);
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
      const ltsUnit = Number(p.litrosPorUnidad ?? p.litros_por_unidad ?? 12);
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
        (caducidadYearFilter === '2026' && p.yearLote === '2026') ||
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

    const capitalHuesosUsd = filteredCaducidadList
      .filter(p => p.estatusCaducidad === 'RIESGO_VENCIDO')
      .reduce((acc, p) => acc + p.valUsd, 0);

    // Días de Cobertura de Inventario (DSI)
    const consumoDiarioLts = totalLtsVendidosReal > 0 ? (totalLtsVendidosReal / 300) : 500;
    const diasInventarioPromedio = consumoDiarioLts > 0 ? Math.round(totalStockLitros / consumoDiarioLts) : 48;

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
  }, [products, filteredProfitInvoices, profitInvoices, profitPurchases, tasaBcv, caducidadYearFilter, caducidadMonthFilter, comparativaYearFilter, comparativaMonthFilter]);

  // Mix de Medios de Pago en Cobranzas
  const mixMediosPagoData = useMemo(() => {
    const bsUsd = cobranzasData.enBs;
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

  // Pestaña de bloque activa para navegación rápida ('ALL' | 'comercial' | 'financiero' | 'clientes' | 'operaciones')
  const [activeBlock, setActiveBlock] = useState('ALL');

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

  const handlePrintReport = (block = 'ALL') => {
    try {
      const facturacionTotalUsd = Number(totalFacturadoUsd || 0);
      const preventaPendienteUsd = parseFloat((basePendiente * (precioPromedioLitro || 5.93)).toFixed(2));
      const cobradoTotalUsd = parseFloat(Number(cobranzasData?.acumulada || 0).toFixed(2));
      const porcentajeCobranza = efectividadCobranzaPct;
      const disponibilidadTotalUsd = parseFloat(Number(totalDisponibilidad || 0).toFixed(2));
      const totalCarteraUsd = parseFloat(Number(cxcTot || 0).toFixed(2));
      const indiceMorosidad = cxcVenPct;

      generateDashboardPDF({
        kpiData: {
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
          huesosCount: lubricantesAnalytics?.huesosMenosVendidos?.length || 0,
          diasInventarioPromedio: lubricantesAnalytics?.diasInventarioPromedio || 45
        },
        sales,
        products,
        orders,
        config,
        currentUser,
        block,
        sellers: (sellersCompliance && sellersCompliance.length > 0) ? sellersCompliance : effectiveSellersList,
        cobranzasData,
        disponibilidadBancariaData,
        carteraClientesData,
        topClientsData: topClientesData || [],
        lubricantesAnalytics,
        selectedMonth
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
            { id: 'operaciones', label: '🟣 4. Inventario & Proveedores', color: '#8b5cf6' }
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

        {/* BOTÓN IMPRIMIR REPORTE COMPLETO ALINEADO TOTALMENTE A LA DERECHA */}
        <button
          type="button"
          className="btn btn-print-report"
          onClick={() => handlePrintReport('ALL')}
          title="Descargar Informe Ejecutivo Consolidado en PDF con todos los bloques y KPIs"
          style={{
            marginLeft: 'auto',
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

              <div className="tacometro-wrapper" style={{ flex: 1, padding: '0.5rem 0' }}>
                <div style={{ position: 'relative', width: '220px', height: '125px', margin: '0 auto' }}>
                  <svg viewBox="0 0 200 125" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--bg-btn-secondary, rgba(255,255,255,0.1))" strokeWidth="22" strokeLinecap="round" />
                    <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#ef4444" strokeWidth="18" strokeLinecap="square" />
                    <path d="M 100 20 A 80 80 0 0 1 164 52" fill="none" stroke="#f59e0b" strokeWidth="18" strokeLinecap="square" />
                    <path d="M 164 52 A 80 80 0 0 1 180 100" fill="none" stroke="#10b981" strokeWidth="18" strokeLinecap="square" />

                    <text x="10" y="118" fill="var(--text-muted)" fontSize="10" fontWeight="700" fontFamily="var(--font-code)">0%</text>
                    <text x="92" y="12" fill="var(--text-muted)" fontSize="10" fontWeight="700" fontFamily="var(--font-code)">50%</text>
                    <text x="168" y="44" fill="var(--text-muted)" fontSize="10" fontWeight="700" fontFamily="var(--font-code)">80%</text>
                    <text x="178" y="118" fill="var(--text-muted)" fontSize="10" fontWeight="700" fontFamily="var(--font-code)">100%</text>

                    <g transform={`rotate(${Math.min(Math.max((kpiData.cumplimientoMetaPct / 100) * 180 - 90, -90), 90)}, 100, 100)`} style={{ transition: 'transform 0.8s ease-out' }}>
                      <line x1="100" y1="100" x2="100" y2="24" stroke="rgba(0,0,0,0.3)" strokeWidth="6" strokeLinecap="round" />
                      <polygon points="96,100 104,100 101.5,22 98.5,22" fill="var(--motorven-red)" stroke="var(--text-heading)" strokeWidth="1.5" />
                      <circle cx="100" cy="100" r="11" fill="var(--motorven-navy)" stroke="var(--text-heading)" strokeWidth="2.5" />
                      <circle cx="100" cy="100" r="4" fill="var(--motorven-gold)" />
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
                  style={{ fontSize: '0.72rem', padding: '4px 6px' }}
                >
                  <Users size={13} /> Clientes ({clients?.length || 0})
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
                      {stockTotalLitros.toLocaleString('es-VE')} L
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({stockTotalCajas} cajas disponibles)</div>
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
                      {lubricantesAnalytics.huesosMenosVendidos.length} SKUs con &gt;24m sin rotación
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

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('compras')}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: '0.75rem', gap: '4px' }}
                >
                  <ShoppingCart size={14} /> Cuentas por Pagar & Compras
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
                  <option value="2026">Año 2026 (En Curso)</option>
                  <option value="2025">Año 2025</option>
                  <option value="2024">Año 2024</option>
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
                {(comparativaYearFilter !== '2026' || comparativaMonthFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setComparativaYearFilter('2026');
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
                    ✕ Año 2026
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
                            {prod.litrosVendidos === 0 ? 'Sin Ventas 2026' : `${prod.litrosVendidos} L vend.`}
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
                  <option value="2026">Año 2026 (Año en curso)</option>
                  <option value="2025">Año 2025 (1 Año)</option>
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
                {(caducidadYearFilter !== '2026' || caducidadMonthFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setCaducidadYearFilter('2026');
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
                    ✕ Año 2026
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
        kpiData={kpiData}
        semMeta={semMeta}
        config={config}
        currentUser={currentUser}
        sales={sales}
        carteraClientesData={carteraClientesData}
        cobranzasData={cobranzasData}
        disponibilidadBancariaData={disponibilidadBancariaData}
        objetivosData={objetivosData}
      />

      {/* Modal 2: Directorio de 610+ Clientes de Supabase */}
      <ClientsDirectoryModal
        isOpen={showClientsModal}
        onClose={() => setShowClientsModal(false)}
        clients={clients}
        tasaBcv={tasaBcv}
        currentUser={currentUser}
        onSaveClient={onSaveClient}
        onDeleteClient={onDeleteClient}
        onSelectClientForPOS={(client) => {
          setShowClientsModal(false);
          if (onNavigate) onNavigate('ventas');
        }}
        onSelectClientForPayment={(client) => {
          setShowClientsModal(false);
          if (onNavigate) onNavigate('caja');
        }}
      />

      {/* Modal 3: Score Crediticio & Evaluación de Riesgo */}
      <CreditScoreEngineModal
        isOpen={showCreditScoreModal}
        onClose={() => setShowCreditScoreModal(false)}
        clients={clients}
        profitInvoices={profitInvoices}
        profitCollections={profitCollections}
        config={config}
        tasaBcv={tasaBcv}
        onSelectClientForSale={(client) => {
          setShowCreditScoreModal(false);
          if (onNavigate) onNavigate('ventas');
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
