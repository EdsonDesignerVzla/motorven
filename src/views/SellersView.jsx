import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Award,
  TrendingUp,
  DollarSign,
  Droplet,
  Package,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  Edit,
  Save,
  Filter,
  BarChart3,
  Percent,
  TrendingDown,
  Clock,
  FileSpreadsheet,
  Printer,
  Download,
  Receipt,
  Wallet,
  CreditCard,
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  MapPin,
  Navigation,
  Compass,
  Check,
  X
} from 'lucide-react';
import { formatUsd, formatBs, formatUnitVe } from '../services/formatService';
import SellerDetailModal from '../components/SellerDetailModal';
import SellerCommissionModal from '../components/SellerCommissionModal';
import DebtCollectionIntelligenceModal from '../components/DebtCollectionIntelligenceModal';
import SellerAvatar from '../components/SellerAvatar';
import { isMasterOrGerencia } from '../services/authService';
import { generateSellersPDF } from '../services/pdfReportService';
import { DEFAULT_PROFIT_SELLERS } from '../data/mockData';
import { getCommissionSettlements } from '../services/storageService';
import {
  getSupabaseCommissionSettlements,
  deleteSupabaseCommissionSettlement
} from '../services/supabaseService';
import {
  matchesSeller,
  isDocAnulada,
  resolveInvoiceLitros,
  resolveInvoiceCajas,
  normalizeProfitCollectionUsd,
  calculateSellerCommissionSummary,
  countDistinctActiveMonths,
  MOTORVEN_TIER_ORDER,
  MOTORVEN_COMMISSION_TIERS
} from '../services/commissionService';
import { useNotification } from '../context/NotificationContext';
import { dedupeCanonicalDocs } from '../services/fiscalService';

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
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
    const parts = str.split(/[\/\-]/);
    if (parts.length >= 2) {
      return parts[1].padStart(2, '0');
    }
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return String(d.getUTCMonth() + 1).padStart(2, '0');
    }
  } catch (_) {}
  return '';
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH_NUM = String(new Date().getMonth() + 1).padStart(2, '0');

const BASE_MONTH_NAMES = [
  ['01', 'Enero', 'Ene'],
  ['02', 'Febrero', 'Feb'],
  ['03', 'Marzo', 'Mar'],
  ['04', 'Abril', 'Abr'],
  ['05', 'Mayo', 'May'],
  ['06', 'Junio', 'Jun'],
  ['07', 'Julio', 'Jul'],
  ['08', 'Agosto', 'Ago'],
  ['09', 'Septiembre', 'Sep'],
  ['10', 'Octubre', 'Oct'],
  ['11', 'Noviembre', 'Nov'],
  ['12', 'Diciembre', 'Dic']
];

const MONTHS_LIST = [
  { id: 'ALL', label: `Cierre Anual ${CURRENT_YEAR} (Acumulado)`, short: `Año ${CURRENT_YEAR}` },
  ...BASE_MONTH_NAMES.map(([id, full, short]) => ({
    id,
    label: `${full} ${CURRENT_YEAR}${id === CURRENT_MONTH_NUM ? ' (Actual)' : ''}`,
    short
  }))
];

export default function SellersView({
  profitSellers = [],
  profitInvoices = [],
  profitCollections = [],
  profitBankAccounts = [],
  clients = [],
  orders = [],
  profitZones = [],
  config,
  onSyncProfit,
  onUpdateSellerTarget,
  onUpdateGlobalTarget,
  onUpdateSellerPhoto,
  onUpdateSellerZone,
  onAddCashMovement,
  onCommissionSettlementsChange,
  currentUser
}) {
  const notify = useNotification();
  const [activeSubTab, setActiveSubTab] = useState('ranking'); // 'ranking' | 'cobranzas' | 'comisiones' | 'historial_comisiones' | 'metas' | 'directorio'
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH_NUM);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [commissionSeller, setCommissionSeller] = useState(null);
  const [showDebtCollectionModal, setShowDebtCollectionModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [expandedCobranzasSeller, setExpandedCobranzasSeller] = useState(null);
  const [receiptModalSettlement, setReceiptModalSettlement] = useState(null);

  // States for target editing
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [editTargetValue, setEditTargetValue] = useState(3000);
  const [editCommissionValue, setEditCommissionValue] = useState(3.0);
  const [isEditingGlobalTarget, setIsEditingGlobalTarget] = useState(false);
  const [globalTargetInput, setGlobalTargetInput] = useState(30000);
  const [savingGlobalTarget, setSavingGlobalTarget] = useState(false);

  // States for zone editing modal
  const [editingZoneSeller, setEditingZoneSeller] = useState(null);
  const [modalZoneCoZon, setModalZoneCoZon] = useState('');
  const [modalCustomZone, setModalCustomZone] = useState('');
  const [savingZoneChange, setSavingZoneChange] = useState(false);

  // Cargar liquidaciones guardadas (Supabase + respaldo local)
  useEffect(() => {
    let active = true;
    setSettlements(getCommissionSettlements());
    getSupabaseCommissionSettlements()
      .then((list) => {
        if (active && Array.isArray(list)) setSettlements(list);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handlePhotoUpdated = (newPhotoUrl, coVen) => {
    const cleanTarget = String(coVen || '').trim().replace(/^usr-seller-/i, '').toLowerCase();
    if (onUpdateSellerPhoto) {
      onUpdateSellerPhoto(coVen, newPhotoUrl);
    }
    if (selectedSeller) {
      const selCode = String(selectedSeller.coVen || selectedSeller.co_ven || selectedSeller.id || '').trim().replace(/^usr-seller-/i, '').toLowerCase();
      if (selCode === cleanTarget) {
        setSelectedSeller(prev => prev ? ({ ...prev, foto: newPhotoUrl || '' }) : null);
      }
    }
  };

  // Lista activa de vendedores con respaldo automático y deduplicación preservando foto
  const effectiveSellers = useMemo(() => {
    if (Array.isArray(profitSellers) && profitSellers.length > 0) {
      const byName = new Map();
      profitSellers.forEach(s => {
        const name = (s.venDes || s.ven_des || s.nombre || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        const code = (s.coVen || s.co_ven || s.id || '').trim();
        const existing = byName.get(key);
        const preservedFoto = s.foto || existing?.foto || '';
        const preservedAvatar = s.avatar || existing?.avatar || '';
        if (!existing || (code.length <= 4 && (existing.coVen?.length || 0) > 4)) {
          byName.set(key, {
            ...(existing || {}),
            ...s,
            coVen: code,
            co_ven: code,
            venDes: name,
            ven_des: name,
            foto: preservedFoto,
            avatar: preservedAvatar,
            coZon: s.coZon || s.co_zon || existing?.coZon || '',
            zona: s.zona || existing?.zona || '',
            metaLitrosMes: Number(s.metaLitrosMes ?? s.meta_litros_mes ?? existing?.metaLitrosMes ?? 3000)
          });
        } else if (preservedFoto && !existing.foto) {
          byName.set(key, {
            ...existing,
            foto: preservedFoto,
            avatar: preservedAvatar || existing.avatar
          });
        }
      });
      return Array.from(byName.values());
    }
    return DEFAULT_PROFIT_SELLERS;
  }, [profitSellers]);

  // Todas las cobranzas válidas con montoUsd normalizado (evita Bs guardados como USD)
  const normalizedCollectionsAll = useMemo(() => {
    return (profitCollections || [])
      .filter(cob => !cob?.anulado)
      .map(cob => ({ ...cob, montoUsd: normalizeProfitCollectionUsd(cob) }));
  }, [profitCollections]);

  const activeMonthsCount = useMemo(
    () => countDistinctActiveMonths(profitInvoices, normalizedCollectionsAll),
    [profitInvoices, normalizedCollectionsAll]
  );

  // Filtrado de Facturas según el Mes Seleccionado (deduplicado por clave canónica, siempre excluyendo anuladas)
  const filteredProfitInvoices = useMemo(() => {
    const deduped = dedupeCanonicalDocs(profitInvoices || []).filter(inv => !isDocAnulada(inv));
    if (selectedMonth === 'ALL') return deduped;
    return deduped.filter(inv => {
      const raw = inv?.fechaEmision || inv?.fec_emis || inv?.fecha || '';
      if (!raw) return true;
      const m = extractMonthNumber(raw);
      return m === selectedMonth;
    });
  }, [profitInvoices, selectedMonth]);

  // Filtrado de Cobranzas según el Mes Seleccionado (siempre excluyendo anuladas y con USD normalizado)
  const filteredProfitCollections = useMemo(() => {
    if (selectedMonth === 'ALL') return normalizedCollectionsAll;
    return normalizedCollectionsAll.filter(cob => {
      const raw = cob?.fecha || cob?.fec_cob || '';
      if (!raw) return true;
      const m = extractMonthNumber(raw);
      return m === selectedMonth;
    });
  }, [normalizedCollectionsAll, selectedMonth]);

  // Consolidated seller performance metrics
  const sellersPerformance = useMemo(() => {
    const tasaBcv = Number(config?.tasaDolar) || 827.73;
    return (effectiveSellers || []).map(seller => {
      const coVen = (seller?.coVen || seller?.co_ven || seller?.codigo || seller?.id || '').toString().trim();
      const venDes = (seller?.venDes || seller?.ven_des || seller?.nombre || '').toString().trim();

      const sInvoices = (filteredProfitInvoices || []).filter(f => matchesSeller(seller, f));
      const sCollections = (filteredProfitCollections || []).filter(c => matchesSeller(seller, c));
      const sClients = (clients || []).filter(c => matchesSeller(seller, c?.vendedorAsignado || c?.co_ven || c?.vendedor || c));
      const sOrders = (orders || []).filter(o => matchesSeller(seller, o));

      const totalLitros = sInvoices.reduce((acc, f) => acc + resolveInvoiceLitros(f), 0);
      const totalCajas = sInvoices.reduce((acc, f) => acc + resolveInvoiceCajas(f), 0);
      const totalVentasUsd = sInvoices.reduce((acc, f) => acc + (Number(f?.totNetoUsd) || 0), 0);
      const totalVentasBs = sInvoices.reduce((acc, f) => acc + (Number(f?.totNetoBs) || 0), 0);
      const totalSaldoUsd = sInvoices.reduce((acc, f) => acc + (Number(f?.saldoUsd) || 0), 0);
      const totalCobradoUsd = sCollections.reduce((acc, c) => acc + normalizeProfitCollectionUsd(c), 0);
      const totalCobradoBs = sCollections.reduce((acc, c) => acc + (Number(c?.montoBs ?? c?.monto_bs) || 0), 0);

      const metaLitrosBase = Number(seller?.metaLitrosMes) || 3000;
      const metaLitros = selectedMonth === 'ALL' ? metaLitrosBase * Math.max(1, activeMonthsCount) : metaLitrosBase;
      const cumplimientoPct = metaLitros > 0 ? parseFloat(((totalLitros / metaLitros) * 100).toFixed(1)) : 0;
      const efectividadCobranzaPct = totalVentasUsd > 0 ? parseFloat(((totalCobradoUsd / totalVentasUsd) * 100).toFixed(1)) : (totalCobradoUsd > 0 ? 100 : 0);

      // Cálculo oficial MOTORVEN por días vencidos, sin IVA y solo documentos 100% pagados
      const commissionSummary = calculateSellerCommissionSummary(seller, {
        invoices: sInvoices,
        collections: normalizedCollectionsAll,
        tasaBcv
      });

      const sCoZon = seller?.coZon || seller?.co_zon || '';
      const sZona = seller?.zona || ((profitZones || []).find(z => (z.coZon || z.co_zon) === sCoZon)?.zonDes || '');

      return {
        ...seller,
        coVen: coVen || seller?.id || 'VEND',
        venDes: venDes || 'Cobrador',
        coZon: sCoZon,
        zona: sZona,
        facturasCount: sInvoices.length,
        collectionsCount: sCollections.length,
        clientesCount: sClients.length,
        pedidosCount: sOrders.length,
        totalLitros,
        totalCajas,
        totalVentasUsd,
        totalVentasBs,
        totalSaldoUsd,
        totalCobradoUsd,
        totalCobradoBs,
        sCollections,
        sInvoices,
        metaLitrosMes: metaLitros,
        cumplimientoPct,
        efectividadCobranzaPct,
        basePagadaSinIvaUsd: commissionSummary.basePagadaSinIvaUsd,
        documentosPagadosCount: commissionSummary.paidDocsCount,
        documentosPendientesCount: commissionSummary.pendingDocsCount,
        comisionTiers: commissionSummary.tiers,
        comisionSummary: commissionSummary,
        comisionEstimadaUsd: commissionSummary.totalComisionUsd,
        comisionEstimadaBs: commissionSummary.totalComisionBs
      };
    }).sort((a, b) => b.totalLitros - a.totalLitros);
  }, [effectiveSellers, filteredProfitInvoices, filteredProfitCollections, normalizedCollectionsAll, clients, orders, profitZones, selectedMonth, activeMonthsCount, config?.tasaDolar]);

  // KPIs Generales
  const kpis = useMemo(() => {
    const totalLitrosGlobal = sellersPerformance.reduce((acc, s) => acc + s.totalLitros, 0);
    const totalCajasGlobal = sellersPerformance.reduce((acc, s) => acc + s.totalCajas, 0);
    const totalVentasUsdGlobal = sellersPerformance.reduce((acc, s) => acc + s.totalVentasUsd, 0);
    const totalCobradoUsdGlobal = sellersPerformance.reduce((acc, s) => acc + s.totalCobradoUsd, 0);
    const totalCobradoBsGlobal = sellersPerformance.reduce((acc, s) => acc + s.totalCobradoBs, 0);
    const totalSaldoUsdGlobal = sellersPerformance.reduce((acc, s) => acc + s.totalSaldoUsd, 0);
    const totalMetaGlobal = sellersPerformance.reduce((acc, s) => acc + (Number(s.metaLitrosMes) || 0), 0);
    const cumplimientoGlobalPct = totalMetaGlobal > 0 ? parseFloat(((totalLitrosGlobal / totalMetaGlobal) * 100).toFixed(1)) : 0;
    const efectividadCobranzaGlobalPct = totalVentasUsdGlobal > 0 ? parseFloat(((totalCobradoUsdGlobal / totalVentasUsdGlobal) * 100).toFixed(1)) : 0;

    const topSeller = sellersPerformance[0] || null;

    return {
      totalVendedores: sellersPerformance.length,
      totalLitrosGlobal,
      totalCajasGlobal,
      totalVentasUsdGlobal,
      totalCobradoUsdGlobal,
      totalCobradoBsGlobal,
      totalSaldoUsdGlobal,
      totalMetaGlobal,
      cumplimientoGlobalPct,
      efectividadCobranzaGlobalPct,
      topSeller
    };
  }, [sellersPerformance]);

  const filteredSellers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sellersPerformance.filter(s => {
      if (!s) return false;
      const vDes = s.venDes || s.ven_des || s.nombre || '';
      const cVen = s.coVen || s.co_ven || s.codigo || '';
      const ced = s.cedula || s.rif || '';
      const sZona = s.zona || '';
      const sCoZon = s.coZon || '';

      const matchesSearch = !q ||
        vDes.toLowerCase().includes(q) ||
        cVen.toLowerCase().includes(q) ||
        ced.toLowerCase().includes(q) ||
        sZona.toLowerCase().includes(q);

      const matchesZone = selectedZoneFilter === 'ALL' ||
        sCoZon === selectedZoneFilter ||
        sZona.toLowerCase().includes(selectedZoneFilter.toLowerCase());

      return matchesSearch && matchesZone;
    });
  }, [sellersPerformance, searchQuery, selectedZoneFilter]);

  // Manejador para abrir modal de edición de zona
  const handleOpenEditZone = (seller, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditingZoneSeller(seller);
    const zCode = seller.coZon || '';
    setModalZoneCoZon(zCode || (seller.zona ? 'CUSTOM' : ''));
    setModalCustomZone(seller.zona || '');
  };

  // Guardar nueva zona de asesor
  const handleSaveSellerZoneModal = async () => {
    if (!editingZoneSeller) return;
    const coVen = (editingZoneSeller.coVen || editingZoneSeller.co_ven || editingZoneSeller.id || '').toString().trim();
    let targetCoZon = modalZoneCoZon;
    let targetZona = '';

    if (modalZoneCoZon === 'CUSTOM') {
      targetCoZon = 'CUSTOM';
      targetZona = modalCustomZone.trim() || 'Zona Especial';
    } else if (modalZoneCoZon) {
      targetCoZon = modalZoneCoZon;
      const matched = (profitZones || []).find(z => (z.coZon || z.co_zon) === modalZoneCoZon);
      targetZona = matched?.zonDes || matched?.zon_des || `Zona ${modalZoneCoZon}`;
    }

    setSavingZoneChange(true);
    try {
      if (onUpdateSellerZone) {
        await onUpdateSellerZone(coVen, { coZon: targetCoZon, zona: targetZona });
      }
      notify.success(`Zona de ${editingZoneSeller.venDes} actualizada a: ${targetZona || 'Sin Asignar'}`);
      if (selectedSeller && ((selectedSeller.coVen || selectedSeller.id || '').toString().trim() === coVen)) {
        setSelectedSeller(prev => prev ? ({ ...prev, coZon: targetCoZon, zona: targetZona }) : null);
      }
      setEditingZoneSeller(null);
    } catch (err) {
      notify.error('Error actualizando la zona del asesor');
      console.warn('Error saving zone from modal:', err);
    } finally {
      setSavingZoneChange(false);
    }
  };

  // Exportar reporte consolidado a CSV / Excel
  const handleExportCSV = () => {
    const periodLabel = selectedMonth === 'ALL' ? 'Cierre_Anual_2026' : `Mes_${selectedMonth}_2026`;
    const filename = `fuerza_ventas_signum_motorven_${periodLabel}.csv`;
    
    const headers = [
      'Codigo_Cobrador',
      'Nombre_Cobrador',
      'Cedula_RIF',
      'Periodo',
      'Litros_Vendidos',
      'Cajas_Equivalentes',
      'Meta_Litros',
      'Cumplimiento_Pct',
      'Ventas_USD',
      'Base_Pagada_Sin_IVA_USD',
      'Ventas_Bs',
      'Cobrado_USD',
      'Saldo_Pendiente_USD',
      'Efectividad_Cobranza_Pct',
      'Comision_Motorven_USD'
    ];

    const currentPeriodText = MONTHS_LIST.find(m => m.id === selectedMonth)?.label || selectedMonth;

    const rows = filteredSellers.map(s => [
      `"${s.coVen}"`,
      `"${s.venDes.replace(/"/g, '""')}"`,
      `"${s.cedula || ''}"`,
      `"${currentPeriodText}"`,
      s.totalLitros.toFixed(1),
      s.totalCajas.toFixed(1),
      s.metaLitrosMes,
      `${s.cumplimientoPct}%`,
      s.totalVentasUsd.toFixed(2),
      (s.basePagadaSinIvaUsd || 0).toFixed(2),
      s.totalVentasBs.toFixed(2),
      s.totalCobradoUsd.toFixed(2),
      s.totalSaldoUsd.toFixed(2),
      `${s.efectividadCobranzaPct}%`,
      s.comisionEstimadaUsd.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    if (onSyncProfit) await onSyncProfit();
    setTimeout(() => setSyncing(false), 800);
  };

  const handleSaveTarget = async (coVen) => {
    if (onUpdateSellerTarget) {
      await onUpdateSellerTarget(coVen, {
        metaLitrosMes: editTargetValue,
        comisionPct: editCommissionValue
      });
    }
    setEditingTargetId(null);
  };

  const handleSaveGlobalTarget = async () => {
    const total = Number(globalTargetInput);
    if (isNaN(total) || total <= 0) {
      notify.warning('Por favor ingrese una meta mensual en litros válida (mayor a 0).');
      return;
    }
    setSavingGlobalTarget(true);
    try {
      if (onUpdateGlobalTarget) {
        await onUpdateGlobalTarget(total);
      }
      setIsEditingGlobalTarget(false);
      notify.success(`Meta mensual distribuida guardada exitosamente: ${formatUnitVe(total, 0)} L`);
    } catch (err) {
      console.error(err);
      notify.error('Error guardando la meta mensual distribuida.');
    } finally {
      setSavingGlobalTarget(false);
    }
  };

  const handleDeleteSettlement = async (id) => {
    const confirmed = await notify.confirm({
      title: '¿Anular Liquidación de Comisiones?',
      message: `¿Desea anular la liquidación ${id}? Esta acción eliminará permanentemente el registro de pagos.`,
      confirmText: 'Sí, Anular Liquidación',
      cancelText: 'Cancelar',
      isDestructive: true
    });
    if (confirmed) {
      const updated = await deleteSupabaseCommissionSettlement(id);
      setSettlements(updated);
      if (onCommissionSettlementsChange) onCommissionSettlementsChange(updated);
      notify.success(`Liquidación ${id} anulada correctamente`);
    }
  };

  const handleSettlementSaved = async () => {
    try {
      const list = await getSupabaseCommissionSettlements();
      setSettlements(list);
      if (onCommissionSettlementsChange) onCommissionSettlementsChange(list);
    } catch {
      const localList = getCommissionSettlements();
      setSettlements(localList);
      if (onCommissionSettlementsChange) onCommissionSettlementsChange(localList);
    }
    notify.success('Liquidación de comisiones guardada exitosamente.');
  };

  const handlePrintReport = () => {
    try {
      const dataToPrint = (filteredSellers && filteredSellers.length > 0) ? filteredSellers : sellersPerformance;
      const globalQuotaVal = Number(kpis?.totalMetaGlobal) || 30000;
      generateSellersPDF({
        sellers: dataToPrint,
        config: config || {},
        currentUser: currentUser || null,
        globalQuota: globalQuotaVal
      });
      notify.success('Reporte de Fuerza de Ventas generado exitosamente');
    } catch (err) {
      console.error('[SellersView] Error al generar reporte PDF:', err);
      notify.error('Error generando reporte de Fuerza de Ventas: ' + (err?.message || err));
    }
  };

  return (
    <div className="sellers-view-container">
      {/* CABECERA PRINCIPAL */}
      <div className="page-header-responsive" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--motorven-navy) 0%, #0284c7 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0, 43, 122, 0.3)'
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Fuerza de Ventas & Inteligencia Comercial
              </h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Rendimiento por Asesor Comercial, Cobranzas Aplicadas, Liquidación de Comisiones y Reportes
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* SELECTOR DE PERÍODO / MES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--motorven-navy-light)" />
            <select
              className="form-control"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)'
              }}
            >
              {MONTHS_LIST.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* BOTÓN EXPORTAR CSV */}
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            title="Exportar métricas y liquidaciones del período a CSV / Excel"
            style={{
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(2, 132, 199, 0.4)',
              background: 'rgba(2, 132, 199, 0.1)',
              color: 'var(--text-primary)',
              fontWeight: 700
            }}
          >
            <FileSpreadsheet size={15} color="#0284c7" /> Exportar CSV
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowDebtCollectionModal(true)}
            style={{
              fontSize: '0.82rem',
              borderColor: 'rgba(37, 211, 102, 0.4)',
              background: 'rgba(37, 211, 102, 0.12)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={15} color="#25D366" /> Inteligencia Cobranzas & WhatsApp
          </button>

          {/* BOTÓN IMPRIMIR REPORTE */}
          <button
            className="btn btn-print-report"
            onClick={handlePrintReport}
            title="Descargar reporte oficial consolidado de ventas y comisiones en PDF"
            style={{ marginLeft: 'auto' }}
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}
      >
        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Meta Comercial {selectedMonth === 'ALL' ? 'Acumulada' : 'del Mes'}
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
              {MONTHS_LIST.find(m => m.id === selectedMonth)?.short}
            </span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
            {formatUnitVe(kpis.totalMetaGlobal, 0)} L
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: kpis.cumplimientoGlobalPct >= 100 ? 'var(--semaforo-verde)' : 'var(--motorven-gold)'
              }}
            >
              {kpis.cumplimientoGlobalPct}% Cumplido
            </span>
            <div style={{ flex: 1, height: '5px', background: 'var(--border-glass)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, kpis.cumplimientoGlobalPct)}%`,
                  height: '100%',
                  background: kpis.cumplimientoGlobalPct >= 100 ? 'var(--semaforo-verde)' : 'var(--motorven-navy)'
                }}
              />
            </div>
          </div>
        </div>

        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Volumen Total Vendido
            </span>
            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Oilstone ®</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)' }}>
            {formatUnitVe(kpis.totalLitrosGlobal, 2)} L
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
            ≈ {formatUnitVe(kpis.totalCajasGlobal, 2)} Cajas Totales
          </div>
        </div>

        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Facturación & Cobranzas
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Efectividad {kpis.efectividadCobranzaGlobalPct}%</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
            {formatUsd(kpis.totalVentasUsdGlobal)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--semaforo-verde)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
            Cobrado: <strong>{formatUsd(kpis.totalCobradoUsdGlobal)}</strong> (Saldo: {formatUsd(kpis.totalSaldoUsdGlobal)})
          </div>
        </div>

        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Líder de Ventas (Top 1)
            </span>
            <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>★ Destacado</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--semaforo-verde)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {kpis.topSeller ? kpis.topSeller.venDes : 'N/A'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-tech)', marginTop: '2px' }}>
            {kpis.topSeller ? `${formatUnitVe(kpis.topSeller.totalLitros, 2)} L (${kpis.topSeller.cumplimientoPct}% Meta)` : '-'}
          </div>
        </div>
      </div>

      {/* PESTAÑAS SUB-MÓDULO */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-glass)',
          marginBottom: '1.25rem',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}
      >
        <button
          onClick={() => setActiveSubTab('ranking')}
          className={`tab-btn ${activeSubTab === 'ranking' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'ranking' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'ranking' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <BarChart3 size={16} /> Ranking & Rendimiento ({filteredSellers.length})
        </button>

        <button
          onClick={() => setActiveSubTab('cobranzas')}
          className={`tab-btn ${activeSubTab === 'cobranzas' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'cobranzas' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'cobranzas' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <Wallet size={16} /> Cobranzas por Asesor
        </button>

        <button
          onClick={() => setActiveSubTab('comisiones')}
          className={`tab-btn ${activeSubTab === 'comisiones' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'comisiones' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'comisiones' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <DollarSign size={16} /> Cuadro de Comisiones & Liquidación
        </button>

        <button
          onClick={() => setActiveSubTab('historial_comisiones')}
          className={`tab-btn ${activeSubTab === 'historial_comisiones' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'historial_comisiones' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'historial_comisiones' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <Receipt size={16} /> Comisiones Liquidadas ({settlements.length})
        </button>

        <button
          onClick={() => setActiveSubTab('metas')}
          className={`tab-btn ${activeSubTab === 'metas' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'metas' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'metas' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <Percent size={16} /> Asignación de Metas & % Comisión
        </button>

        <button
          onClick={() => setActiveSubTab('directorio')}
          className={`tab-btn ${activeSubTab === 'directorio' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'directorio' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'directorio' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <Users size={16} /> Directorio de Asesores
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          background: 'var(--bg-card)',
          padding: '0.85rem 1.15rem',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)'
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar asesor por nombre, código o cédula..."
            className="form-control"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={15} color="var(--motorven-red)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Filtrar por Zona:</span>
            <select
              className="form-control"
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '4px 10px', minWidth: '180px' }}
            >
              <option value="ALL">Todas las Zonas ({sellersPerformance.length})</option>
              {(profitZones || []).map(z => {
                const cZon = z.coZon || z.co_zon;
                const dZon = z.zonDes || z.zon_des || `Zona ${cZon}`;
                const countInZone = sellersPerformance.filter(s => s.coZon === cZon || (s.zona && s.zona.toLowerCase().includes(dZon.toLowerCase()))).length;
                return (
                  <option key={cZon} value={cZon}>
                    Zona {cZon}: {dZon.length > 25 ? dZon.substring(0, 25) + '...' : dZon} ({countInZone})
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando datos de: <strong>{MONTHS_LIST.find(m => m.id === selectedMonth)?.label}</strong>
          </div>
        </div>
      </div>

      {/* 1. SUB-TAB: RANKING & RENDIMIENTO COMERCIAL */}
      {activeSubTab === 'ranking' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: '40px' }}>#</th>
                  <th>ASESOR COMERCIAL</th>
                  <th style={{ minWidth: '170px' }}>ZONA ASIGNADA</th>
                  <th style={{ textAlign: 'center' }}>CLIENTES</th>
                  <th style={{ textAlign: 'right' }}>VOLUMEN (LITROS)</th>
                  <th style={{ textAlign: 'right' }}>CAJAS EQ.</th>
                  <th style={{ textAlign: 'center', width: '160px' }}>CUMPLIMIENTO META</th>
                  <th style={{ textAlign: 'right' }}>VENTAS FACTURADAS</th>
                  <th style={{ textAlign: 'right' }}>COBRANZA EFECTIVA</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredSellers.length > 0 ? (
                  filteredSellers.map((seller, idx) => {
                    const isTop = idx === 0;
                    return (
                      <tr key={seller.id || seller.coVen} onClick={() => setSelectedSeller(seller)} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center', fontWeight: 800, fontFamily: 'var(--font-code)' }}>
                          {isTop ? '🏆 1' : idx + 1}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <SellerAvatar seller={seller} size={36} canEdit={true} onPhotoUpdated={handlePhotoUpdated} />
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                                {seller.venDes}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                Cód: {seller.coVen} | C.I.: {seller.cedula || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              className="badge badge-primary"
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                maxWidth: '170px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() => handleOpenEditZone(seller)}
                              title="Haga clic para editar o reasignar la zona de este asesor"
                            >
                              <MapPin size={11} color="var(--motorven-gold)" />
                              {seller.coZon ? `[Z-${seller.coZon}] ` : ''}{seller.zona || 'Sin Asignar'}
                            </span>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleOpenEditZone(seller)}
                              title="Editar / Reasignar Zona"
                              style={{ padding: '3px 6px', fontSize: '0.7rem', borderRadius: '5px' }}
                            >
                              <Edit size={11} />
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>
                          {seller.clientesCount}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-navy-light)', fontSize: '0.92rem' }}>
                          {formatUnitVe(seller.totalLitros, 2)} L
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                          {formatUnitVe(seller.totalCajas, 2)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Meta: {formatUnitVe(seller.metaLitrosMes || 0, 0)} L</span>
                            <strong style={{ color: seller.cumplimientoPct >= 100 ? 'var(--semaforo-verde)' : 'var(--motorven-navy-light)' }}>
                              {seller.cumplimientoPct}%
                            </strong>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--border-glass)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, seller.cumplimientoPct)}%`,
                                height: '100%',
                                background: seller.cumplimientoPct >= 100 ? 'var(--semaforo-verde)' : 'var(--motorven-navy)'
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>
                          {formatUsd(seller.totalVentasUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                          {formatUsd(seller.totalCobradoUsd)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSeller(seller);
                              }}
                              title="Ver ficha completa"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCommissionSeller(seller);
                              }}
                              title="Liquidar comisiones de este asesor"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <DollarSign size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No se encontraron asesores comerciales en el filtro seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SUB-TAB: COBRANZAS POR ASESOR COMERCIAL */}
      {activeSubTab === 'cobranzas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-glass)', background: 'var(--surface-input, rgba(0, 43, 122, 0.02))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Cobranzas Realizadas por Asesor Comercial
                </h3>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Monitoreo de ingresos recaudados, efectividad sobre facturación y gestión de cobranza ({MONTHS_LIST.find(m => m.id === selectedMonth)?.label})
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total Cobrado: <strong style={{ color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)' }}>{formatUsd(kpis.totalCobradoUsdGlobal)}</strong>
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Saldo en Calle: <strong style={{ color: 'var(--motorven-red)', fontFamily: 'var(--font-tech)' }}>{formatUsd(kpis.totalSaldoUsdGlobal)}</strong>
                </span>
              </div>
            </div>

            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th>ASESOR COMERCIAL</th>
                    <th style={{ textAlign: 'right' }}>VENTAS FACTURADAS</th>
                    <th style={{ textAlign: 'right' }}>TOTAL COBRADO ($ USD)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL COBRADO (BS.)</th>
                    <th style={{ textAlign: 'right' }}>SALDO EN CALLE ($)</th>
                    <th style={{ textAlign: 'center' }}>RECIBOS COBRO</th>
                    <th style={{ textAlign: 'center' }}>EFECTIVIDAD</th>
                    <th style={{ textAlign: 'center' }}>DETALLE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSellers.map((seller) => {
                    const isExpanded = expandedCobranzasSeller === seller.coVen;
                    return (
                      <React.Fragment key={seller.id || seller.coVen}>
                        <tr style={{ background: isExpanded ? 'rgba(2, 132, 199, 0.04)' : undefined }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <SellerAvatar seller={seller} size={32} canEdit={true} onPhotoUpdated={handlePhotoUpdated} />
                              <div>
                                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{seller.venDes}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cód: {seller.coVen}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontWeight: 700 }}>
                            {formatUsd(seller.totalVentasUsd)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                            {formatUsd(seller.totalCobradoUsd)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                            {formatBs(seller.totalCobradoBs || (seller.totalCobradoUsd * (config?.tasaDolar || 827.73)))}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: seller.totalSaldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                            {formatUsd(seller.totalSaldoUsd)}
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-tech)', fontWeight: 700 }}>
                            {seller.collectionsCount} recibos
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`badge ${seller.efectividadCobranzaPct >= 80 ? 'badge-success' : seller.efectividadCobranzaPct >= 50 ? 'badge-warning' : 'badge-danger'}`}
                              style={{ fontSize: '0.72rem', fontWeight: 800 }}
                            >
                              {seller.efectividadCobranzaPct}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setExpandedCobranzasSeller(isExpanded ? null : seller.coVen)}
                              style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              {isExpanded ? 'Ocultar' : 'Ver Cobros'}
                            </button>
                          </td>
                        </tr>

                        {/* DESGLOSE EXPANDIDO DE RECIBOS DE COBRANZA */}
                        {isExpanded && (
                          <tr>
                            <td colSpan="8" style={{ padding: '0.75rem 1.25rem', background: 'var(--surface-input, rgba(0, 43, 122, 0.02))' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Receipt size={14} color="var(--motorven-navy-light)" />
                                Recibos de Cobro Registrados de {seller.venDes} ({seller.sCollections?.length || 0})
                              </div>
                              {seller.sCollections && seller.sCollections.length > 0 ? (
                                <table className="custom-table" style={{ fontSize: '0.75rem', width: '100%', background: 'var(--bg-card)', borderRadius: '8px', overflow: 'hidden' }}>
                                  <thead>
                                    <tr>
                                      <th>NRO. COBRO</th>
                                      <th>FECHA</th>
                                      <th>CLIENTE</th>
                                      <th style={{ textAlign: 'right' }}>MONTO ($ USD)</th>
                                      <th style={{ textAlign: 'right' }}>MONTO (BS.)</th>
                                      <th>DESCRIPCIÓN / FORMAS DE PAGO</th>
                                      <th style={{ textAlign: 'center' }}>ESTADO</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {seller.sCollections.map((cob, cIdx) => (
                                      <tr key={cob.id || cob.cobNum || cIdx}>
                                        <td style={{ fontFamily: 'var(--font-code)', fontWeight: 800, color: 'var(--motorven-navy-light)' }}>
                                          #{cob.cobNum || cob.id}
                                        </td>
                                        <td>{cob.fecha ? new Date(cob.fecha).toLocaleDateString('es-VE') : '-'}</td>
                                        <td>
                                          <div style={{ fontWeight: 700 }}>{cob.clienteNombre || 'Cliente General'}</div>
                                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RIF: {cob.clienteRif || cob.clienteId}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                                          {formatUsd(Number(cob.montoUsd || 0))}
                                        </td>
                                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                                          {formatBs(Number(cob.montoBs || (Number(cob.montoUsd || 0) * (cob.tasa || config?.tasaDolar || 827.73))))}
                                        </td>
                                        <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {cob.descrip || 'Cobro aplicado en Supabase'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                          <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>APLICADO</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.75rem', textAlign: 'center' }}>
                                  No hay cobros aplicados registrados en Supabase para este período.
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUB-TAB: CUADRO DE COMISIONES & LIQUIDACIÓN */}
      {activeSubTab === 'comisiones' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-glass)', background: 'var(--surface-input, rgba(0, 43, 122, 0.02))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Liquidación de Comisiones MOTORVEN (Días Vencidos • Sin IVA)
              </h3>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Tabulador oficial sobre documentos 100% pagados sin IVA: 0–7d (4%) • 8–14d (3%) • 15–21d (1%) • &gt;21d (0%) ({MONTHS_LIST.find(m => m.id === selectedMonth)?.label})
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tasa Oficial BCV: <strong style={{ color: 'var(--motorven-gold)' }}>{formatBs(config?.tasaDolar || 827.73)}</strong>
              </span>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>COBRADOR</th>
                  <th style={{ textAlign: 'right' }}>BASE PAGADA (SIN IVA)</th>
                  <th style={{ textAlign: 'center' }}>TRAMOS (4% / 3% / 1% / 0%)</th>
                  <th style={{ textAlign: 'right' }}>COMISIÓN DEVENGADA ($)</th>
                  <th style={{ textAlign: 'right' }}>COMISIÓN DEVENGADA (BS)</th>
                  <th style={{ textAlign: 'right' }}>COBRADO EFECTIVO</th>
                  <th style={{ textAlign: 'right' }}>SALDO POR COBRAR</th>
                  <th style={{ textAlign: 'center' }}>LIQUIDACIÓN</th>
                </tr>
              </thead>
              <tbody>
                {filteredSellers.map((seller) => {
                  const tiers = seller.comisionTiers || {};
                  return (
                  <tr key={seller.id || seller.coVen}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SellerAvatar seller={seller} size={32} canEdit={true} onPhotoUpdated={handlePhotoUpdated} />
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{seller.venDes}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cód: {seller.coVen} • {seller.documentosPagadosCount || 0} pag.</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>
                      {formatUsd(seller.basePagadaSinIvaUsd || 0)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.7rem', fontFamily: 'var(--font-code)' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span className="badge badge-success">4%: {tiers.TIER_0_7?.docsCount || 0}</span>
                        <span className="badge badge-info">3%: {tiers.TIER_8_14?.docsCount || 0}</span>
                        <span className="badge badge-warning">1%: {tiers.TIER_15_21?.docsCount || 0}</span>
                        <span className="badge badge-secondary">0%: {tiers.TIER_GT_21?.docsCount || 0}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                      {formatUsd(seller.comisionEstimadaUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                      {formatBs(seller.comisionEstimadaBs ?? (seller.comisionEstimadaUsd * (config?.tasaDolar || 827.73)))}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--motorven-navy-light)' }}>
                      {formatUsd(seller.totalCobradoUsd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: seller.totalSaldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                      {formatUsd(seller.totalSaldoUsd)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => setCommissionSeller(seller)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <DollarSign size={13} /> Liquidar Período
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB: HISTORIAL DE COMISIONES LIQUIDADAS */}
      {activeSubTab === 'historial_comisiones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-glass)', background: 'var(--surface-input, rgba(0, 43, 122, 0.02))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Historial de Liquidaciones Registradas
                </h3>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Comprobantes oficiales de comisiones procesadas y pagadas a la fuerza de ventas ({settlements.length} registradas)
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Total Pagado: <strong style={{ color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)' }}>
                  {formatUsd(settlements.reduce((acc, s) => acc + (Number(s.totalComisionUsd) || 0), 0))}
                </strong>
              </div>
            </div>

            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th>NRO. COMPROBANTE</th>
                    <th>FECHA PAGO</th>
                    <th>COBRADOR</th>
                    <th>PERÍODO</th>
                    <th style={{ textAlign: 'right' }}>TOTAL ($ USD)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL (BS.)</th>
                    <th>MÉTODO / REF</th>
                    <th style={{ textAlign: 'center' }}>ESTADO</th>
                    <th style={{ textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.length > 0 ? (
                    settlements.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'var(--font-code)', fontWeight: 800, color: 'var(--motorven-navy-light)' }}>
                          {s.id}
                        </td>
                        <td>{s.fechaPago || (s.fechaRegistro ? new Date(s.fechaRegistro).toLocaleDateString('es-VE') : '-')}</td>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{s.venDes}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cód: {s.coVen}</div>
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{s.periodo}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                          {formatUsd(s.totalComisionUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                          {formatBs(s.totalComisionBs)}
                        </td>
                        <td style={{ fontSize: '0.74rem' }}>
                          <div style={{ fontWeight: 700 }}>{s.metodoPago}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{s.referenciaPago}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>PAGADA</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-print-report"
                              onClick={() => {
                                generateSellersPDF({ sellers: [s.seller || s], config, currentUser });
                                setReceiptModalSettlement(s);
                              }}
                              title="Imprimir Reporte y Ver Comprobante"
                              style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Printer size={13} color="#ffffff" /> Imprimir Reporte
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleDeleteSettlement(s.id)}
                              title="Anular Liquidación"
                              style={{ padding: '3px 8px', fontSize: '0.72rem', color: 'var(--motorven-red)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No hay liquidaciones de comisiones registradas todavía. Para generar una, ingresa en la pestaña "Cuadro de Comisiones & Liquidación" y haz clic en "Liquidar Período".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB: ASIGNACIÓN DE METAS Y CUOTAS */}
      {activeSubTab === 'metas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* BANNER DE CONFIGURACIÓN DE META MENSUAL GLOBAL EQUITATIVA */}
          <div
            className="card"
            style={{
              padding: '1.15rem 1.35rem',
              borderRadius: '14px',
              border: '1px solid var(--border-glass)',
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(2, 132, 199, 0.06) 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent size={18} color="var(--motorven-navy-light)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Meta Comercial Global Distribuida ({MONTHS_LIST.find(m => m.id === selectedMonth)?.label})
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Configura una meta mensual total en litros para repartirla equitativamente entre los {effectiveSellers.length} asesores.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isEditingGlobalTarget ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="500"
                    className="form-control"
                    value={globalTargetInput}
                    onChange={(e) => setGlobalTargetInput(e.target.value)}
                    style={{ width: '130px', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Litros</span>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveGlobalTarget}
                    disabled={savingGlobalTarget}
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    {savingGlobalTarget ? 'Guardando...' : 'Aplicar'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsEditingGlobalTarget(false)}
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-navy-light)' }}>
                      {formatUnitVe(kpis.totalMetaGlobal, 0)} L
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      ≈ {formatUnitVe(kpis.totalMetaGlobal / (effectiveSellers.length || 1), 0)} L por Asesor
                    </div>
                  </div>
                  {isMasterOrGerencia(currentUser) && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setGlobalTargetInput(kpis.totalMetaGlobal || 30000);
                        setIsEditingGlobalTarget(true);
                      }}
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit size={13} /> Ajustar Global
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* TABLA DE ASIGNACIÓN INDIVIDUAL */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th>ASESOR COMERCIAL</th>
                    <th style={{ textAlign: 'center' }}>CUOTA MENSUAL (LITROS)</th>
                    <th style={{ textAlign: 'center' }}>% COMISIÓN BASE</th>
                    <th style={{ textAlign: 'right' }}>VOLUMEN ACTUAL (LITROS)</th>
                    <th style={{ textAlign: 'center' }}>CUMPLIMIENTO</th>
                    <th style={{ textAlign: 'center' }}>AJUSTAR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSellers.map((seller) => {
                    const isEditing = editingTargetId === seller.coVen;
                    return (
                      <tr key={seller.id || seller.coVen}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <SellerAvatar seller={seller} size={32} canEdit={true} onPhotoUpdated={handlePhotoUpdated} />
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{seller.venDes}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cód: {seller.coVen}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isEditing ? (
                            <input
                              type="number"
                              step="100"
                              className="form-control"
                              value={editTargetValue}
                              onChange={(e) => setEditTargetValue(Number(e.target.value))}
                              style={{ width: '110px', margin: '0 auto', fontSize: '0.82rem', textAlign: 'center' }}
                            />
                          ) : (
                            <strong style={{ fontFamily: 'var(--font-tech)', fontSize: '0.92rem' }}>
                              {formatUnitVe(seller.metaLitrosMes || 3000, 0)} L
                            </strong>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.5"
                              className="form-control"
                              value={editCommissionValue}
                              onChange={(e) => setEditCommissionValue(Number(e.target.value))}
                              style={{ width: '80px', margin: '0 auto', fontSize: '0.82rem', textAlign: 'center' }}
                            />
                          ) : (
                            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                              {seller.comisionPct || 3.0}%
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-navy-light)' }}>
                          {formatUnitVe(seller.totalLitros, 2)} L
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${seller.cumplimientoPct >= 100 ? 'badge-success' : 'badge-warning'}`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {seller.cumplimientoPct}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-primary"
                                onClick={() => handleSaveTarget(seller.coVen)}
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              >
                                <Save size={13} /> Guardar
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => setEditingTargetId(null)}
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingTargetId(seller.coVen);
                                setEditTargetValue(seller.metaLitrosMes || 3000);
                                setEditCommissionValue(seller.comisionPct || 3.0);
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit size={13} /> Modificar Meta
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB: DIRECTORIO Y PERFILES DE ASESORES */}
      {activeSubTab === 'directorio' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem'
          }}
        >
          {filteredSellers.map((seller) => (
            <div
              key={seller.id || seller.coVen}
              className="card"
              style={{
                borderRadius: '14px',
                border: '1px solid var(--border-glass)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SellerAvatar
                      seller={seller}
                      size={48}
                      canEdit={true}
                      onPhotoUpdated={handlePhotoUpdated}
                    />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {seller.venDes}
                      </h3>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                        Cód: {seller.coVen} | C.I.: {seller.cedula || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                    {seller.comisionPct || 3}% Comisión
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-main)' }}>
                      <MapPin size={13} color="var(--motorven-red)" /> Zona Asignada:
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenEditZone(seller)}
                      title="Reasignar Zona Comercial"
                      style={{ padding: '2px 8px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}
                    >
                      <Edit size={10} /> Cambiar
                    </button>
                  </div>
                  <div style={{ padding: '5px 9px', background: 'var(--surface-input, rgba(0, 43, 122, 0.04))', borderRadius: '7px', border: '1px solid var(--border-glass)', fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                      {seller.coZon ? `Z-${seller.coZon}` : 'Territorio'}
                    </span>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {seller.zona || 'Sin Zona Asignada'}
                    </span>
                  </div>

                  <div>Teléfono: <strong style={{ color: 'var(--text-main)' }}>{seller.telefonos || 'N/A'}</strong></div>
                  <div>Clientes Asignados: <strong style={{ color: 'var(--text-main)' }}>{seller.clientesCount}</strong></div>
                  <div>Volumen del Período: <strong style={{ color: 'var(--motorven-navy-light)' }}>{formatUnitVe(seller.totalLitros, 2)} L</strong></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedSeller(seller)}
                  style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Eye size={13} /> Ver Perfil
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setCommissionSeller(seller)}
                  style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <DollarSign size={13} /> Liquidar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DETALLE DE ASESOR */}
      {selectedSeller && (
        <SellerDetailModal
          seller={selectedSeller}
          onClose={() => setSelectedSeller(null)}
          invoices={filteredProfitInvoices}
          clients={clients}
          orders={orders}
          collections={filteredProfitCollections}
          profitZones={profitZones}
          tasaBcv={config?.tasaDolar || 827.73}
          onOpenCommissionModal={(s) => setCommissionSeller(s)}
          onPhotoUpdated={handlePhotoUpdated}
          onUpdateSellerZone={onUpdateSellerZone}
        />
      )}

      {/* MODAL REASIGNACIÓN RÁPIDA DE ZONA */}
      {editingZoneSeller && (
        <div className="modal-overlay" onClick={() => setEditingZoneSeller(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              width: '95%',
              borderRadius: '16px',
              overflow: 'hidden',
              padding: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.08) 0%, rgba(202, 138, 4, 0.06) 100%)',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Navigation size={22} color="var(--motorven-navy-light)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Reasignar Zona Comercial
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Asesor: <strong>{editingZoneSeller.venDes}</strong> (Cód: {editingZoneSeller.coVen})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditingZoneSeller(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Seleccionar Zona o Territorio de Ventas:
                </label>
                <select
                  className="form-control"
                  value={modalZoneCoZon}
                  onChange={(e) => {
                    const val = e.target.value;
                    setModalZoneCoZon(val);
                    if (val !== 'CUSTOM') {
                      const matched = (profitZones || []).find(z => (z.coZon || z.co_zon) === val);
                      if (matched) setModalCustomZone(matched.zonDes || matched.zon_des || '');
                    }
                  }}
                  style={{ width: '100%', fontSize: '0.84rem' }}
                >
                  <option value="">-- Sin Zona Asignada --</option>
                  {(profitZones || []).map(z => {
                    const cZon = z.coZon || z.co_zon;
                    const dZon = z.zonDes || z.zon_des || `Zona ${cZon}`;
                    return (
                      <option key={cZon} value={cZon}>
                        Zona {cZon}: {dZon}
                      </option>
                    );
                  })}
                  <option value="CUSTOM">★ Zona Personalizada / Otro Territorio...</option>
                </select>
              </div>

              {modalZoneCoZon === 'CUSTOM' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                    Nombre del Territorio Personalizado:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: Gran Caracas / Altos Mirandinos"
                    value={modalCustomZone}
                    onChange={(e) => setModalCustomZone(e.target.value)}
                    style={{ width: '100%', fontSize: '0.84rem' }}
                  />
                </div>
              )}

              <div style={{ background: 'var(--surface-input, rgba(0, 43, 122, 0.03))', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-glass)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                ℹ La nueva zona se sincronizará automáticamente en tiempo real en la base de datos Supabase, los reportes en PDF y en Supabase.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingZoneSeller(null)}
                  style={{ fontSize: '0.82rem', padding: '7px 16px' }}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveSellerZoneModal}
                  disabled={savingZoneChange}
                  style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px' }}
                >
                  <Check size={15} /> {savingZoneChange ? 'Guardando...' : 'Confirmar y Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIQUIDACIÓN DE COMISIÓN */}
      {commissionSeller && (
        <SellerCommissionModal
          seller={commissionSeller}
          onClose={() => setCommissionSeller(null)}
          invoices={profitInvoices}
          collections={profitCollections}
          config={config}
          currentUser={currentUser}
          tasaBcv={config?.tasaDolar || 827.73}
          initialMonth={selectedMonth}
          onSettlementSaved={handleSettlementSaved}
          onAddCashMovement={onAddCashMovement}
        />
      )}

      {/* MODAL REIMPRESIÓN DE COMPROBANTE OFICIAL DE LIQUIDACIÓN */}
      {receiptModalSettlement && (
        <div className="modal-overlay" onClick={() => setReceiptModalSettlement(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '680px',
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '16px',
              background: '#ffffff',
              color: '#0f172a',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* MEMBRETE OFICIAL MOTORVEN */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #002b7a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#002b7a' }}>
                  DISTRIBUIDORA SIGNUM MOTORVEN C.A.
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  RIF: J-40892341-0 • Distribuidor Oficial Oilstone ®
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Caracas, Venezuela • Teléfono: (0212) 555-0199
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'inline-block', padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', fontWeight: 800, borderRadius: '6px', fontSize: '0.78rem' }}>
                  COMPROBANTE OFICIAL
                </span>
                <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginTop: '4px' }}>
                  {receiptModalSettlement.id}
                </div>
              </div>
            </div>

            {/* DATOS DEL COBRADOR Y LIQUIDACIÓN */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div>
                <div><strong>Cobrador:</strong> {receiptModalSettlement.venDes}</div>
                <div><strong>Cód. Cobrador:</strong> {receiptModalSettlement.coVen}</div>
                <div><strong>C.I. / RIF:</strong> {receiptModalSettlement.cedula || 'N/A'}</div>
              </div>
              <div>
                <div><strong>Período Liquidado:</strong> {receiptModalSettlement.periodo}</div>
                <div><strong>Fecha de Liquidación:</strong> {receiptModalSettlement.fechaPago}</div>
                <div><strong>Método de Pago:</strong> {receiptModalSettlement.metodoPago} (Ref: {receiptModalSettlement.referenciaPago})</div>
              </div>
            </div>

            {/* TABLA DE CONCEPTOS */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Concepto (Regla MOTORVEN • Sin IVA)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Base Pagada ($)</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>% / Docs</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Monto ($ USD)</th>
                </tr>
              </thead>
              <tbody>
                {receiptModalSettlement.motorvenTiers ? (
                  MOTORVEN_TIER_ORDER.map((tierKey) => {
                    const meta = MOTORVEN_COMMISSION_TIERS[tierKey];
                    const t = receiptModalSettlement.motorvenTiers?.[tierKey] || { docsCount: 0, baseSinIvaUsd: 0, comisionUsd: 0 };
                    const docsCnt = Number(t.docsCount ?? t.count ?? 0);
                    return (
                      <tr key={tierKey} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px' }}>{meta.label}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatUsd(t.baseSinIvaUsd)}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{meta.ratePct}% ({docsCnt})</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{formatUsd(t.comisionUsd)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>Comisión por Facturación Directa</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatUsd(receiptModalSettlement.totalFacturadoUsd)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{receiptModalSettlement.comisionVentaPct}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{formatUsd(receiptModalSettlement.comisionVentaMontoUsd)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>Comisión por Cobranza Efectiva</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatUsd(receiptModalSettlement.totalCobradoUsd)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{receiptModalSettlement.comisionCobroPct}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{formatUsd(receiptModalSettlement.comisionCobroMontoUsd)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>Bono Cumplimiento Volumen</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatUnitVe(receiptModalSettlement.litrosExcedentes || 0, 2)} L</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{formatUsd(receiptModalSettlement.bonoPorLitroUsd)} / L</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{formatUsd(receiptModalSettlement.bonoVolumenMontoUsd)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* TOTALES */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                  Total Comisión Neta Liquidada
                </div>
                <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
                  Tasa Oficial BCV: {formatBs(receiptModalSettlement.tasaBcv)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#15803d' }}>
                  {formatUsd(receiptModalSettlement.totalComisionUsd)}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ca8a04' }}>
                  {formatBs(receiptModalSettlement.totalComisionBs)}
                </div>
              </div>
            </div>

            {/* FIRMAS DE CONFORMIDAD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2.5rem', textAlign: 'center' }}>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                  Firma del Cobrador
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{receiptModalSettlement.venDes}</div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                  Firma y Sello Administración / Gerencia
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Distribuidora Signum Motorven C.A.</div>
              </div>
            </div>

            {/* BOTONES ACCIÓN */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setReceiptModalSettlement(null)}>
                Cerrar
              </button>
              <button
                className="btn btn-print-report"
                onClick={() => generateSellersPDF({ sellers: [receiptModalSettlement], config, currentUser })}
              >
                <Printer size={15} color="#ffffff" /> Imprimir Reporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTELIGENCIA DE COBRANZAS, AGING DE CARTERA & WHATSAPP */}
      <DebtCollectionIntelligenceModal
        isOpen={showDebtCollectionModal}
        onClose={() => setShowDebtCollectionModal(false)}
        invoices={filteredProfitInvoices}
        profitInvoices={filteredProfitInvoices}
        clients={clients}
        sellers={effectiveSellers}
        profitSellers={effectiveSellers}
        bankAccounts={profitBankAccounts}
        profitBankAccounts={profitBankAccounts}
        config={config}
        currentUser={currentUser}
        tasaBcv={config?.tasaDolar || 827.73}
      />
    </div>
  );
}
