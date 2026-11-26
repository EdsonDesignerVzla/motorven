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
  X,
  Plus
} from 'lucide-react';
import { formatUsd, formatBs, formatUnitVe } from '../services/formatService';
import SellerDetailModal from '../components/SellerDetailModal';
import SellerCommissionModal from '../components/SellerCommissionModal';
import SellerSkuLitrosModal from '../components/SellerSkuLitrosModal';
import DebtCollectionIntelligenceModal from '../components/DebtCollectionIntelligenceModal';
import SellerAvatar from '../components/SellerAvatar';
import { isMasterOrGerencia } from '../services/authService';
import { generateSellersPDF } from '../services/pdfReportService';
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
  buildSalesDepartmentSellers,
  MOTORVEN_TIER_ORDER,
  MOTORVEN_COMMISSION_TIERS
} from '../services/commissionService';
import { useNotification } from '../context/NotificationContext';
import { dedupeCanonicalDocs } from '../services/fiscalService';
import { filterRecordsFromSystemStart } from '../utils/dateRangeFilterUtils';

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
  {
    id: 'ALL',
    label: CURRENT_YEAR <= 2026 ? `Acumulado ${CURRENT_YEAR} (Desde 01/11)` : `Cierre Anual ${CURRENT_YEAR} (Acumulado)`,
    short: CURRENT_YEAR <= 2026 ? 'Desde Nov 2026' : `Año ${CURRENT_YEAR}`
  },
  ...BASE_MONTH_NAMES
    .filter(([id]) => (CURRENT_YEAR <= 2026 ? Number(id) >= 11 : true))
    .map(([id, full, short]) => ({
      id,
      label: `${full} ${CURRENT_YEAR}${id === CURRENT_MONTH_NUM ? ' (Actual)' : ''}`,
      short
    }))
];

export default function SellersView({
  profitSellers = [],
  usersList = [],
  products = [],
  profitInvoices = [],
  profitReturns = [],
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
  onSaveProfitZone,
  onDeleteProfitZone,
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
  const [skuLitrosSeller, setSkuLitrosSeller] = useState(null);
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
  const [savingZoneChange, setSavingZoneChange] = useState(false);
  const [inlineNewZoneOpen, setInlineNewZoneOpen] = useState(false);
  const [inlineNewZoneCode, setInlineNewZoneCode] = useState('');
  const [inlineNewZoneName, setInlineNewZoneName] = useState('');

  // States for CRUD Zonas de Venta modal
  const [showZonesManagerModal, setShowZonesManagerModal] = useState(false);
  const [zoneFormId, setZoneFormId] = useState(null);
  const [zoneFormCode, setZoneFormCode] = useState('');
  const [zoneFormName, setZoneFormName] = useState('');
  const [savingZoneRecord, setSavingZoneRecord] = useState(false);
  const [confirmDeleteZoneKey, setConfirmDeleteZoneKey] = useState(null);
  const [zoneManagerError, setZoneManagerError] = useState('');

  // Cargar liquidaciones guardadas (Supabase + respaldo local) desde el 01/11/2026
  useEffect(() => {
    let active = true;
    setSettlements(filterRecordsFromSystemStart(getCommissionSettlements()));
    getSupabaseCommissionSettlements()
      .then((list) => {
        if (active && Array.isArray(list)) setSettlements(filterRecordsFromSystemStart(list));
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

  // Lista oficial de Fuerza de Ventas: EXCLUSIVAMENTE usuarios activos configurados en el departamento Ventas (VEN),
  // enriquecidos con su metadata comercial (zona, meta, comisión) desde profitSellers.
  const effectiveSellers = useMemo(
    () => buildSalesDepartmentSellers(usersList, profitSellers),
    [usersList, profitSellers]
  );

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

  const productsBySku = useMemo(() => {
    const map = new Map();
    (products || []).forEach(p => {
      const sku = String(p?.codigo || p?.id || '').trim();
      if (sku) map.set(sku, p);
    });
    return map;
  }, [products]);

  // Consolidated seller performance metrics
  const sellersPerformance = useMemo(() => {
    const tasaBcv = Number(config?.tasaDolar) || 827.73;
    return (effectiveSellers || []).map(seller => {
      const coVen = (seller?.coVen || seller?.co_ven || seller?.codigo || seller?.id || '').toString().trim();
      const venDes = (seller?.venDes || seller?.ven_des || seller?.nombre || '').toString().trim();

      const sInvoices = (filteredProfitInvoices || []).filter(f => matchesSeller(seller, f));
      const sReturns = (profitReturns || []).filter(r => {
        if (!r || isDocAnulada(r) || !matchesSeller(seller, r)) return false;
        if (selectedMonth === 'ALL') return true;
        const raw = r?.fecEmis || r?.fec_emis || r?.fecha || '';
        return !raw || extractMonthNumber(raw) === selectedMonth;
      });
      const sCollections = (filteredProfitCollections || []).filter(c => matchesSeller(seller, c));
      const sClients = (clients || []).filter(c => matchesSeller(seller, c?.vendedorAsignado || c?.co_ven || c?.vendedor || c));
      const sOrders = (orders || []).filter(o => matchesSeller(seller, o));

      const retLitros = sReturns.reduce((acc, r) => acc + Math.abs(Number(r?.litrosTotales ?? r?.litros_totales ?? 0) || 0), 0);
      const retUsd = sReturns.reduce((acc, r) => acc + Math.abs(Number(r?.totNeto ?? r?.tot_neto ?? 0) || 0), 0);
      const retBs = sReturns.reduce((acc, r) => acc + Math.abs((Number(r?.totNeto ?? r?.tot_neto ?? 0) || 0) * (Number(r?.tasa) > 1 ? Number(r.tasa) : tasaBcv)), 0);

      const totalLitros = Math.max(0, Number((sInvoices.reduce((acc, f) => acc + resolveInvoiceLitros(f, productsBySku), 0) - retLitros).toFixed(2)));
      const totalCajas = Math.max(0, Number((sInvoices.reduce((acc, f) => acc + resolveInvoiceCajas(f, productsBySku), 0) - (retLitros / 11.35)).toFixed(1)));
      const totalVentasUsd = Math.max(0, Number((sInvoices.reduce((acc, f) => acc + (Number(f?.totNetoUsd) || 0), 0) - retUsd).toFixed(2)));
      const totalVentasBs = Math.max(0, Number((sInvoices.reduce((acc, f) => acc + (Number(f?.totNetoBs) || 0), 0) - retBs).toFixed(2)));
      const totalSaldoUsd = sInvoices.reduce((acc, f) => acc + (Number(f?.saldoUsd) || 0), 0);
      const totalCobradoUsd = sCollections.reduce((acc, c) => acc + normalizeProfitCollectionUsd(c), 0);
      const totalCobradoBs = sCollections.reduce((acc, c) => acc + (Number(c?.montoBs ?? c?.monto_bs) || 0), 0);

      const metaRaw = Number(seller?.metaLitrosMes ?? seller?.meta_litros_mes);
      const metaLitrosBase = Number.isFinite(metaRaw) && metaRaw >= 0 ? metaRaw : 3000;
      const metaLitros = selectedMonth === 'ALL' ? metaLitrosBase * Math.max(1, activeMonthsCount) : metaLitrosBase;
      const cumplimientoPct = metaLitros > 0 ? parseFloat(((totalLitros / metaLitros) * 100).toFixed(1)) : 0;
      const efectividadCobranzaPct = totalVentasUsd > 0 ? parseFloat(((totalCobradoUsd / totalVentasUsd) * 100).toFixed(1)) : (totalCobradoUsd > 0 ? 100 : 0);

      // Cálculo oficial MOTORVEN por días vencidos, sin IVA y solo documentos 100% pagados
      const commissionSummary = calculateSellerCommissionSummary(seller, {
        invoices: sInvoices,
        collections: normalizedCollectionsAll,
        returns: sReturns,
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
  }, [effectiveSellers, filteredProfitInvoices, filteredProfitCollections, profitReturns, normalizedCollectionsAll, clients, orders, profitZones, selectedMonth, activeMonthsCount, config?.tasaDolar, productsBySku]);

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

    // Documentos y cobros sin asesor activo asignado (para conciliación 100% con Resumen General)
    const unassignedInvs = (filteredProfitInvoices || []).filter(
      f => !(effectiveSellers || []).some(s => matchesSeller(s, f))
    );
    const unassignedCols = (filteredProfitCollections || []).filter(
      c => !(effectiveSellers || []).some(s => matchesSeller(s, c))
    );
    const unassignedInvsCount = unassignedInvs.length;
    const unassignedUsd = Number(unassignedInvs.reduce((acc, f) => acc + (Number(f?.totNetoUsd) || 0), 0).toFixed(2));
    const unassignedLitros = Number(unassignedInvs.reduce((acc, f) => acc + resolveInvoiceLitros(f, productsBySku), 0).toFixed(2));
    const unassignedCobradoUsd = Number(unassignedCols.reduce((acc, c) => acc + normalizeProfitCollectionUsd(c), 0).toFixed(2));

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
      unassignedInvsCount,
      unassignedUsd,
      unassignedLitros,
      unassignedColsCount: unassignedCols.length,
      unassignedCobradoUsd,
      topSeller
    };
  }, [sellersPerformance, filteredProfitInvoices, filteredProfitCollections, effectiveSellers, productsBySku]);

  const filteredSellers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sellersPerformance.filter(s => {
      if (!s) return false;
      const vDes = s.venDes || s.ven_des || s.nombre || '';
      const cVen = s.coVen || s.co_ven || s.codigo || '';
      const uName = s.username || '';
      const ced = s.cedula || s.rif || '';
      const sZona = s.zona || '';
      const sCoZon = s.coZon || '';

      const matchesSearch = !q ||
        vDes.toLowerCase().includes(q) ||
        cVen.toLowerCase().includes(q) ||
        uName.toLowerCase().includes(q) ||
        ced.toLowerCase().includes(q) ||
        sZona.toLowerCase().includes(q);

      const matchesZone = selectedZoneFilter === 'ALL' ||
        (selectedZoneFilter === 'UNASSIGNED'
          ? (!sCoZon && !sZona)
          : (sCoZon === selectedZoneFilter || sZona.toLowerCase().includes(selectedZoneFilter.toLowerCase())));

      return matchesSearch && matchesZone;
    });
  }, [sellersPerformance, searchQuery, selectedZoneFilter]);

  // Mapa de exclusividad 1-a-1: coZon -> lista de asesores asignados a esa zona
  const zoneOccupantsMap = useMemo(() => {
    const map = new Map();
    (effectiveSellers || []).forEach((s) => {
      if (!s || s.activo === false) return;
      const zCode = String(s.coZon || s.co_zon || '').trim().toUpperCase();
      if (!zCode || zCode === 'CUSTOM') return;
      if (!map.has(zCode)) map.set(zCode, []);
      map.get(zCode).push(s);
    });
    return map;
  }, [effectiveSellers]);

  const getNextSuggestedZoneCode = () => {
    const usedNums = new Set(
      (profitZones || [])
        .map((z) => parseInt(String(z?.coZon || z?.co_zon || '').replace(/\D/g, ''), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
    let candidate = 1;
    while (usedNums.has(candidate)) candidate++;
    return String(candidate).padStart(2, '0');
  };

  const resetZoneCrudForm = () => {
    setZoneFormId(null);
    setZoneFormCode(getNextSuggestedZoneCode());
    setZoneFormName('');
    setZoneManagerError('');
    setConfirmDeleteZoneKey(null);
  };

  const handleOpenZonesManager = () => {
    resetZoneCrudForm();
    setShowZonesManagerModal(true);
  };

  const handleSaveZoneCrud = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setZoneManagerError('');
    const cleanCode = String(zoneFormCode || '').trim().toUpperCase();
    const cleanName = String(zoneFormName || '').trim();
    if (!cleanCode) {
      setZoneManagerError('El código de zona es obligatorio (ej. 08).');
      return;
    }
    if (!cleanName) {
      setZoneManagerError('El nombre o descripción del territorio es obligatorio.');
      return;
    }
    if (!onSaveProfitZone) {
      setZoneManagerError('No hay controlador configurado para guardar zonas.');
      return;
    }

    setSavingZoneRecord(true);
    try {
      await onSaveProfitZone({
        ...(zoneFormId ? { id: zoneFormId } : {}),
        coZon: cleanCode,
        zonDes: cleanName
      });
      notify.success(zoneFormId ? `Zona ${cleanCode} actualizada correctamente.` : `Nueva Zona ${cleanCode} (${cleanName}) creada.`);
      setZoneFormId(null);
      setZoneFormCode(getNextSuggestedZoneCode());
      setZoneFormName('');
      setZoneManagerError('');
    } catch (err) {
      const msg = err?.message || 'Error guardando la zona de venta.';
      setZoneManagerError(msg);
      notify.error(msg);
    } finally {
      setSavingZoneRecord(false);
    }
  };

  const handleConfirmDeleteZone = async (zoneObj) => {
    if (!zoneObj || !onDeleteProfitZone) return;
    const zCode = String(zoneObj.coZon || zoneObj.co_zon || '').trim().toUpperCase();
    setSavingZoneRecord(true);
    try {
      await onDeleteProfitZone(zoneObj);
      if (selectedZoneFilter === zCode) setSelectedZoneFilter('ALL');
      if (zoneFormId && String(zoneFormId) === String(zoneObj.id)) {
        resetZoneCrudForm();
      }
      setConfirmDeleteZoneKey(null);
      notify.success(`Zona ${zCode} eliminada del catálogo.`);
    } catch (err) {
      notify.error(err?.message || 'Error eliminando la zona.');
    } finally {
      setSavingZoneRecord(false);
    }
  };

  // Manejador para abrir modal de edición de zona
  const handleOpenEditZone = (seller, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditingZoneSeller(seller);
    const zCode = String(seller.coZon || seller.co_zon || '').trim().toUpperCase();
    setModalZoneCoZon(zCode === 'CUSTOM' ? '' : zCode);
    setInlineNewZoneOpen(false);
    setInlineNewZoneCode(getNextSuggestedZoneCode());
    setInlineNewZoneName('');
  };

  // Liberar zona inmediatamente y guardar en tiempo real para permitir reasignación
  const handleReleaseSellerZone = async (targetSeller) => {
    const sellerObj = targetSeller || editingZoneSeller;
    if (!sellerObj) return;
    const coVen = (sellerObj.coVen || sellerObj.co_ven || sellerObj.id || '').toString().trim();
    const prevZoneCode = String(sellerObj.coZon || sellerObj.co_zon || '').trim().toUpperCase();
    const prevZoneName = sellerObj.zona || (prevZoneCode ? `Zona ${prevZoneCode}` : '');

    setModalZoneCoZon('');
    setInlineNewZoneOpen(false);
    setSavingZoneChange(true);
    try {
      if (onUpdateSellerZone) {
        await onUpdateSellerZone(coVen, { coZon: '', zona: '' });
      }
      setEditingZoneSeller(prev => (prev && ((prev.coVen || prev.id || '').toString().trim() === coVen)
        ? { ...prev, coZon: '', co_zon: '', zona: '' }
        : prev));
      if (selectedSeller && ((selectedSeller.coVen || selectedSeller.id || '').toString().trim() === coVen)) {
        setSelectedSeller(prev => prev ? ({ ...prev, coZon: '', co_zon: '', zona: '' }) : null);
      }
      notify.success(
        prevZoneCode
          ? `Zona [Z-${prevZoneCode}] ${prevZoneName ? `(${prevZoneName}) ` : ''}liberada y guardada. Ya está disponible para reasignar.`
          : `${sellerObj.venDes} quedó sin zona asignada.`
      );
    } catch (err) {
      notify.error(err?.message || 'Error liberando la zona del asesor');
      console.warn('Error releasing seller zone:', err);
    } finally {
      setSavingZoneChange(false);
    }
  };

  // Guardar nueva zona exclusiva de asesor
  const handleSaveSellerZoneModal = async () => {
    if (!editingZoneSeller) return;
    const coVen = (editingZoneSeller.coVen || editingZoneSeller.co_ven || editingZoneSeller.id || '').toString().trim();
    const cleanCoVenUpper = coVen.replace(/^usr-seller-/i, '').trim().toUpperCase();

    setSavingZoneChange(true);
    try {
      let targetCoZon = String(modalZoneCoZon || '').trim().toUpperCase();
      let targetZona = '';

      if (inlineNewZoneOpen) {
        const newCode = String(inlineNewZoneCode || '').trim().toUpperCase();
        const newName = String(inlineNewZoneName || '').trim();
        if (!newCode || !newName) {
          notify.warning('Ingresa el código y el nombre de la nueva zona.');
          setSavingZoneChange(false);
          return;
        }
        if (onSaveProfitZone) {
          const createdZone = await onSaveProfitZone({ coZon: newCode, zonDes: newName });
          targetCoZon = String(createdZone?.coZon || newCode).trim().toUpperCase();
          targetZona = String(createdZone?.zonDes || newName).trim();
        } else {
          targetCoZon = newCode;
          targetZona = newName;
        }
      } else if (targetCoZon) {
        const occupants = (zoneOccupantsMap.get(targetCoZon) || []).filter(
          (occ) => String(occ.coVen || occ.co_ven || occ.id || '').trim().replace(/^usr-seller-/i, '').toUpperCase() !== cleanCoVenUpper
        );
        if (occupants.length > 0) {
          const occNames = occupants.map((o) => o.venDes || o.coVen).join(', ');
          notify.error(`La Zona ${targetCoZon} es exclusiva y ya está asignada a: ${occNames}. Selecciona una zona disponible o crea una nueva.`);
          setSavingZoneChange(false);
          return;
        }
        const matched = (profitZones || []).find((z) => String(z.coZon || z.co_zon || '').trim().toUpperCase() === targetCoZon);
        targetZona = matched?.zonDes || matched?.zon_des || `Zona ${targetCoZon}`;
      }

      if (onUpdateSellerZone) {
        await onUpdateSellerZone(coVen, { coZon: targetCoZon, zona: targetZona });
      }
      notify.success(
        targetCoZon
          ? `Zona de ${editingZoneSeller.venDes} asignada exclusivamente a: [Z-${targetCoZon}] ${targetZona}`
          : `${editingZoneSeller.venDes} quedó marcado como: Aún no tiene Zona Asignada`
      );
      if (selectedSeller && ((selectedSeller.coVen || selectedSeller.id || '').toString().trim() === coVen)) {
        setSelectedSeller(prev => prev ? ({ ...prev, coZon: targetCoZon, zona: targetZona }) : null);
      }
      setEditingZoneSeller(null);
      setInlineNewZoneOpen(false);
    } catch (err) {
      notify.error(err?.message || 'Error actualizando la zona del asesor');
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
    const meta = Number(editTargetValue);
    if (editTargetValue === '' || !Number.isFinite(meta) || meta < 0) {
      notify.warning('La meta mensual debe ser un número igual o mayor a 0 litros.');
      return;
    }
    const comision = Number(editCommissionValue);
    if (!Number.isFinite(comision) || comision < 0) {
      notify.warning('El % de comisión debe ser igual o mayor a 0.');
      return;
    }
    const seller = (effectiveSellers || []).find(s => String(s.coVen) === String(coVen));
    try {
      if (onUpdateSellerTarget) {
        await onUpdateSellerTarget(coVen, {
          metaLitrosMes: meta,
          comisionPct: comision,
          venDes: seller?.venDes || seller?.ven_des || ''
        });
      }
      setEditingTargetId(null);
      notify.success(`Meta de ${seller?.venDes || coVen} actualizada: ${formatUnitVe(meta, 0)} L`);
    } catch (err) {
      console.error(err);
      notify.error(err?.message || 'Error guardando la meta del asesor.');
    }
  };

  const handleSaveGlobalTarget = async () => {
    const total = Number(globalTargetInput);
    if (globalTargetInput === '' || isNaN(total) || total < 0) {
      notify.warning('Por favor ingrese una meta mensual en litros válida (igual o mayor a 0).');
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
      const updated = filterRecordsFromSystemStart(await deleteSupabaseCommissionSettlement(id));
      setSettlements(updated);
      if (onCommissionSettlementsChange) onCommissionSettlementsChange(updated);
      notify.success(`Liquidación ${id} anulada correctamente`);
    }
  };

  const handleSettlementSaved = async () => {
    try {
      const list = filterRecordsFromSystemStart(await getSupabaseCommissionSettlements());
      setSettlements(list);
      if (onCommissionSettlementsChange) onCommissionSettlementsChange(list);
    } catch {
      const localList = filterRecordsFromSystemStart(getCommissionSettlements());
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
            {kpis.unassignedLitros > 0 && (
              <span title="Litros en documentos sin asesor activo asignado">
                {' '}• +{formatUnitVe(kpis.unassignedLitros, 2)} L sin asesor
              </span>
            )}
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
            {(kpis.unassignedUsd > 0 || kpis.unassignedCobradoUsd > 0) && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                Sin asesor activo: +{formatUsd(kpis.unassignedUsd)} ({kpis.unassignedInvsCount} docs) • Cobro +{formatUsd(kpis.unassignedCobradoUsd)}
              </div>
            )}
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
              {sellersPerformance.some(s => !s.coZon && !s.zona) && (
                <option value="UNASSIGNED">
                  Aún no tiene Zona Asignada ({sellersPerformance.filter(s => !s.coZon && !s.zona).length})
                </option>
              )}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenZonesManager}
            title="Crear, editar y eliminar zonas exclusivas de venta"
            style={{
              fontSize: '0.8rem',
              padding: '5px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(245, 158, 11, 0.45)',
              fontWeight: 700
            }}
          >
            <Navigation size={14} color="var(--motorven-gold, #f59e0b)" />
            Gestionar Zonas ({(profitZones || []).length})
          </button>

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
                                Cód: {seller.coVen}{seller.username ? ` | @${seller.username}` : ''} | C.I.: {seller.cedula || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {(() => {
                              const hasZone = Boolean(seller.coZon || seller.zona);
                              const zKey = String(seller.coZon || '').trim().toUpperCase();
                              const zOccupants = zKey ? (zoneOccupantsMap.get(zKey) || []) : [];
                              const isSharedLegacy = hasZone && zOccupants.length > 1;
                              return (
                                <span
                                  className={`badge ${!hasZone || isSharedLegacy ? 'badge-warning' : 'badge-primary'}`}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '3px 8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                    maxWidth: hasZone ? '185px' : '220px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onClick={() => handleOpenEditZone(seller)}
                                  title={
                                    !hasZone
                                      ? 'Aún no tiene Zona Asignada — Haga clic para asignar una zona'
                                      : isSharedLegacy
                                        ? `Zona compartida (${zOccupants.map((o) => o.venDes).join(', ')}) — Haga clic para asignar una zona exclusiva`
                                        : 'Haga clic para editar o reasignar la zona de este asesor'
                                  }
                                >
                                  <MapPin size={11} color="var(--motorven-gold)" />
                                  {hasZone
                                    ? `${isSharedLegacy ? '⚠️ ' : ''}${seller.coZon ? `[Z-${seller.coZon}] ` : ''}${seller.zona || `Zona ${seller.coZon}`}`
                                    : 'Aún no tiene Zona Asignada'}
                                </span>
                              );
                            })()}
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
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSkuLitrosSeller(seller);
                              }}
                              title="Ver ventas por SKU en litros, presentación y meta"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                color: 'var(--motorven-navy-light)',
                                borderColor: 'rgba(0, 43, 122, 0.25)'
                              }}
                            >
                              <Droplet size={13} />
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
                    min="0"
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
                        setGlobalTargetInput(kpis.totalMetaGlobal ?? 0);
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
                              min="0"
                              step="100"
                              className="form-control"
                              value={editTargetValue}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') { setEditTargetValue(''); return; }
                                const n = Number(v);
                                setEditTargetValue(Number.isFinite(n) ? Math.max(0, n) : 0);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e') e.preventDefault();
                                if (e.key === 'Enter') handleSaveTarget(seller.coVen);
                                if (e.key === 'Escape') setEditingTargetId(null);
                              }}
                              autoFocus
                              style={{ width: '110px', margin: '0 auto', fontSize: '0.82rem', textAlign: 'center' }}
                            />
                          ) : (
                            <strong style={{ fontFamily: 'var(--font-tech)', fontSize: '0.92rem' }}>
                              {formatUnitVe(seller.metaLitrosMes ?? 0, 0)} L
                            </strong>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="form-control"
                              value={editCommissionValue}
                              onChange={(e) => setEditCommissionValue(Math.max(0, Number(e.target.value) || 0))}
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
                                setEditTargetValue(seller.metaLitrosMes ?? 0);
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
                        Cód: {seller.coVen}{seller.username ? ` | @${seller.username}` : ''} | C.I.: {seller.cedula || 'N/A'}
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
                    {seller.coZon || seller.zona ? (
                      <>
                        <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                          {seller.coZon ? `Z-${seller.coZon}` : 'Territorio'}
                        </span>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {seller.zona || `Zona ${seller.coZon}`}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--motorven-gold, #f59e0b)', fontStyle: 'italic' }}>
                        Aún no tiene Zona Asignada
                      </span>
                    )}
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
          allSellers={effectiveSellers}
          tasaBcv={config?.tasaDolar || 827.73}
          onOpenCommissionModal={(s) => setCommissionSeller(s)}
          onPhotoUpdated={handlePhotoUpdated}
          onUpdateSellerZone={onUpdateSellerZone}
          onSaveProfitZone={onSaveProfitZone}
        />
      )}

      {/* MODAL VENTAS POR SKU EN LITROS, PRESENTACIÓN Y META */}
      {skuLitrosSeller && (
        <SellerSkuLitrosModal
          seller={skuLitrosSeller}
          onClose={() => setSkuLitrosSeller(null)}
          invoices={filteredProfitInvoices}
          returns={(profitReturns || []).filter((r) => {
            if (selectedMonth === 'ALL') return true;
            const raw = r?.fecEmis || r?.fec_emis || r?.fecha || '';
            return !raw || extractMonthNumber(raw) === selectedMonth;
          })}
          products={products}
          periodLabel={MONTHS_LIST.find((m) => m.id === selectedMonth)?.label || ''}
          config={config}
          currentUser={currentUser}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}

      {/* MODAL REASIGNACIÓN RÁPIDA DE ZONA EXCLUSIVA */}
      {editingZoneSeller && (
        <div className="modal-overlay" onClick={() => setEditingZoneSeller(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '560px',
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
                    Asignar Zona Exclusiva de Venta
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

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Seleccionar Zona Disponible (Exclusiva 1 a 1):
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setInlineNewZoneOpen((prev) => !prev);
                      setInlineNewZoneCode(getNextSuggestedZoneCode());
                      setInlineNewZoneName('');
                    }}
                    style={{ fontSize: '0.72rem', padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> {inlineNewZoneOpen ? 'Elegir Existente' : 'Crear Nueva Zona'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingZoneSeller(null);
                      handleOpenZonesManager();
                    }}
                    style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                  >
                    Administrar Catálogo
                  </button>
                </div>
              </div>

              {!inlineNewZoneOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <select
                    className="form-control"
                    value={modalZoneCoZon}
                    disabled={savingZoneChange}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setModalZoneCoZon(nextVal);
                      const currentlyHasZone = Boolean(
                        String(editingZoneSeller.coZon || editingZoneSeller.co_zon || editingZoneSeller.zona || '').trim()
                      );
                      if (nextVal === '' && currentlyHasZone) {
                        handleReleaseSellerZone(editingZoneSeller);
                      }
                    }}
                    style={{ width: '100%', fontSize: '0.84rem' }}
                  >
                    <option value="">-- Aún no tiene Zona Asignada (Liberar Zona) --</option>
                    {(profitZones || []).map((z) => {
                      const cZon = String(z.coZon || z.co_zon || '').trim().toUpperCase();
                      const dZon = z.zonDes || z.zon_des || `Zona ${cZon}`;
                      const selfCode = String(editingZoneSeller.coVen || editingZoneSeller.co_ven || editingZoneSeller.id || '')
                        .trim()
                        .replace(/^usr-seller-/i, '')
                        .toUpperCase();
                      const otherOccupants = (zoneOccupantsMap.get(cZon) || []).filter(
                        (o) => String(o.coVen || o.co_ven || o.id || '').trim().replace(/^usr-seller-/i, '').toUpperCase() !== selfCode
                      );
                      const isTakenByOther = otherOccupants.length > 0;
                      const statusSuffix = isTakenByOther
                        ? ` — [Ocupada por: ${otherOccupants.map((o) => o.venDes).join(', ')}]`
                        : (String(editingZoneSeller.coZon || '').trim().toUpperCase() === cZon ? ' — [Actual]' : ' — [Disponible]');
                      return (
                        <option key={cZon} value={cZon} disabled={isTakenByOther}>
                          Zona {cZon}: {dZon}{statusSuffix}
                        </option>
                      );
                    })}
                  </select>

                  {Boolean(String(editingZoneSeller.coZon || editingZoneSeller.co_zon || editingZoneSeller.zona || '').trim()) && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={savingZoneChange}
                      onClick={() => handleReleaseSellerZone(editingZoneSeller)}
                      style={{
                        width: '100%',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderColor: 'var(--motorven-red, #e60012)',
                        color: 'var(--motorven-red, #e60012)',
                        background: 'rgba(230, 0, 18, 0.06)'
                      }}
                    >
                      <X size={14} />
                      {savingZoneChange
                        ? 'Liberando zona...'
                        : `Aún no tiene Zona Asignada (Liberar Zona ${editingZoneSeller.coZon ? `Z-${editingZoneSeller.coZon}` : 'Actual'})`}
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--surface-input, rgba(0, 43, 122, 0.04))',
                    border: '1px dashed var(--motorven-navy-light, #3b82f6)',
                    borderRadius: '10px',
                    padding: '0.9rem',
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr',
                    gap: '0.65rem'
                  }}
                >
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Código *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={inlineNewZoneCode}
                      onChange={(e) => setInlineNewZoneCode(e.target.value.toUpperCase())}
                      placeholder="08"
                      maxLength={8}
                      style={{ fontSize: '0.84rem', fontFamily: 'var(--font-code)', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Nombre / Territorio de la Nueva Zona *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={inlineNewZoneName}
                      onChange={(e) => setInlineNewZoneName(e.target.value)}
                      placeholder="Ej: Valencia Norte - Prebo - Trigal"
                      style={{ fontSize: '0.84rem' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--surface-input, rgba(0, 43, 122, 0.03))', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-glass)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                ℹ Cada zona es exclusiva de un solo vendedor (1 a 1). Las zonas ocupadas por otro asesor aparecen bloqueadas para evitar duplicados.
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
                  <Check size={15} /> {savingZoneChange ? 'Guardando...' : (inlineNewZoneOpen ? 'Crear y Asignar Zona' : 'Confirmar y Guardar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRUD: GESTIÓN DE ZONAS DE VENTA */}
      {showZonesManagerModal && (
        <div className="modal-overlay" onClick={() => setShowZonesManagerModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '760px',
              width: '96%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              overflow: 'hidden',
              padding: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div
              style={{
                padding: '1.15rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.1) 0%, rgba(230, 0, 18, 0.06) 100%)',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={22} color="var(--motorven-red)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Gestión de Zonas de Venta (Exclusivas por Vendedor)
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Crea, edita, guarda o elimina territorios comerciales. Cada zona admite un único vendedor asignado.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowZonesManagerModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* FORMULARIO CREAR / EDITAR ZONA */}
              <form
                onSubmit={handleSaveZoneCrud}
                style={{
                  background: 'var(--surface-input, rgba(0, 43, 122, 0.04))',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {zoneFormId ? `✏️ Editando Zona [${zoneFormCode}]` : '➕ Crear Nueva Zona de Venta'}
                  </span>
                  {zoneFormId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetZoneCrudForm}
                      style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '0.65rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Código *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={zoneFormCode}
                      onChange={(e) => setZoneFormCode(e.target.value.toUpperCase())}
                      placeholder="08"
                      maxLength={8}
                      disabled={Boolean(zoneFormId)}
                      title={zoneFormId ? 'El código se mantiene para preservar el historial contable/clientes' : 'Código identificador (ej. 08)'}
                      style={{ fontSize: '0.84rem', fontFamily: 'var(--font-code)', fontWeight: 800 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Descripción / Territorio *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={zoneFormName}
                      onChange={(e) => setZoneFormName(e.target.value)}
                      placeholder="Ej: Aragua - Maracay / Cagua / Turmero"
                      style={{ fontSize: '0.84rem' }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingZoneRecord}
                    style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                  >
                    <Save size={14} /> {savingZoneRecord ? 'Guardando...' : (zoneFormId ? 'Guardar Cambios' : 'Crear Zona')}
                  </button>
                </div>

                {zoneManagerError && (
                  <div style={{ fontSize: '0.76rem', color: '#ef4444', fontWeight: 700 }}>
                    ⚠️ {zoneManagerError}
                  </div>
                )}
              </form>

              {/* LISTADO DE ZONAS REGISTRADAS */}
              <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="custom-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>CÓD.</th>
                      <th>TERRITORIO / DESCRIPCIÓN</th>
                      <th style={{ width: '230px' }}>VENDEDOR EXCLUSIVO</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profitZones || []).length > 0 ? (
                      (profitZones || []).map((z) => {
                        const cZon = String(z.coZon || z.co_zon || '').trim().toUpperCase();
                        const dZon = z.zonDes || z.zon_des || `Zona ${cZon}`;
                        const occupants = zoneOccupantsMap.get(cZon) || [];
                        const isConfirmingDel = confirmDeleteZoneKey === (z.id || cZon);

                        return (
                          <tr key={z.id || cZon}>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontWeight: 800 }}>
                              <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>Z-{cZon}</span>
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              {dZon}
                            </td>
                            <td>
                              {occupants.length === 0 ? (
                                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                  ✓ Disponible
                                </span>
                              ) : occupants.length === 1 ? (
                                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                  {occupants[0].venDes} ({occupants[0].coVen})
                                </span>
                              ) : (
                                <span
                                  className="badge badge-warning"
                                  style={{ fontSize: '0.7rem' }}
                                  title="Zona compartida heredada: reasigna o crea nuevas zonas para dejar 1 vendedor por zona"
                                >
                                  ⚠️ Compartida ({occupants.length}): {occupants.map((o) => o.coVen).join(', ')}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isConfirmingDel ? (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleConfirmDeleteZone(z)}
                                    disabled={savingZoneRecord}
                                    style={{ padding: '3px 8px', fontSize: '0.68rem', background: '#dc2626', borderColor: '#dc2626' }}
                                    title={occupants.length > 0 ? 'Eliminar y liberar al vendedor asignado' : 'Confirmar eliminación'}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setConfirmDeleteZoneKey(null)}
                                    style={{ padding: '3px 7px', fontSize: '0.68rem' }}
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                      setZoneFormId(z.id || `ZON-${cZon}`);
                                      setZoneFormCode(cZon);
                                      setZoneFormName(dZon);
                                      setZoneManagerError('');
                                      setConfirmDeleteZoneKey(null);
                                    }}
                                    title="Editar nombre de la zona"
                                    style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setConfirmDeleteZoneKey(z.id || cZon)}
                                    title={occupants.length > 0 ? `Eliminar zona (liberará a ${occupants.map((o) => o.venDes).join(', ')})` : 'Eliminar zona'}
                                    style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#ef4444' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                          No hay zonas registradas todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
