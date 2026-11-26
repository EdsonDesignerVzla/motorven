import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Building,
  FileCheck,
  DollarSign,
  TrendingUp,
  Truck,
  CheckCircle,
  FileText,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Calendar,
  CreditCard,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Users,
  Warehouse,
  Edit3,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { formatUsd, formatBs, getProductWarehouseStocks } from '../services/formatService';
import { resolveRateMeta, resolveRecordRateType, resolveEffectiveRateNumber } from '../utils/rateClassificationUtils';
import {
  validateRif,
  generateVatRetentionVoucherNumber
} from '../services/fiscalService';
import ProfitPurchaseDetailModal from '../components/ProfitPurchaseDetailModal';
import ProfitSupplierDetailModal from '../components/ProfitSupplierDetailModal';
import IslrWithholdingModal from '../components/IslrWithholdingModal';
import SmartReorderMatrixModal from '../components/SmartReorderMatrixModal';
import { Sliders, Printer } from 'lucide-react';
import { isMasterOrGerencia } from '../services/authService';
import {
  generatePurchasesPDF,
  generatePurchaseRequisitionPDF,
  generatePurchaseOrderPDF,
  generateGoodsReceiptPDF,
  generatePaymentOrderPDF,
  generateSeniatRetentionVoucherPDF
} from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';
import DatePeriodFilter from '../components/DatePeriodFilter';
import { createDefaultDatePeriodFilter, isOnOrAfterDate, matchesDatePeriodFilter, SYSTEM_START_DATE } from '../utils/dateRangeFilterUtils';

const PURCHASES_START_DATE = SYSTEM_START_DATE;

export default function PurchasesView({
  products = [],
  suppliers = [],
  purchases = [],
  config,
  onSaveProduct,
  onRegisterPurchase,
  onUpdatePurchase,
  onDeletePurchase,
  purchaseRequisitions = [],
  purchaseOrders = [],
  goodsReceiptNotes = [],
  onSaveRequisition,
  onSavePurchaseOrder,
  onSaveGoodsReceipt,
  onSavePaymentOrder,
  onOpenCxpModule,
  currentUser,
  profitSuppliers = [],
  profitPurchases = [],
  profitAccountsPayable = [],
  profitSupplierPayments = [],
  profitIslrConcepts = [],
  profitBeneficiaries = [],
  profitPaymentOrders = [],
  profitIslrWithholdings = [],
  profitInvoices = [],
  sales = [],
  onSyncProfit,
  isSyncingProfit = false
}) {
  const notify = useNotification();
  const [activeSubTab, setActiveSubTab] = useState('facturas_profit');
  const [selectedProfitPurchase, setSelectedProfitPurchase] = useState(null);
  const [selectedProfitSupplier, setSelectedProfitSupplier] = useState(null);
  const [showIslrModal, setShowIslrModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [datePeriodFilter, setDatePeriodFilter] = useState(() => createDefaultDatePeriodFilter('EXACT'));
  const [syncing, setSyncing] = useState(false);

  // Estados para Requisiciones (REQ), Órdenes de Compra (OC), Recepciones (REC) y Órdenes de Pago (OP)
  const [reqSku, setReqSku] = useState('');
  const [reqQty, setReqQty] = useState(10);
  const [reqDept, setReqDept] = useState('Almacén / Ventas');
  const [reqPriority, setReqPriority] = useState('NORMAL');
  const [reqReason, setReqReason] = useState('Reposición de stock crítico');

  const [poSupplierCode, setPoSupplierCode] = useState('');
  const [poSku, setPoSku] = useState('');
  const [poQty, setPoQty] = useState(10);
  const [poUnitCostUsd, setPoUnitCostUsd] = useState(25);
  const [poPaymentTerm, setPoPaymentTerm] = useState('Contado / 15 días');
  const [poNotes, setPoNotes] = useState('');
  const [poReqRef, setPoReqRef] = useState('');

  const [recOrderNum, setRecOrderNum] = useState('');
  const [recInvoiceNum, setRecInvoiceNum] = useState('');
  const [recSupplierName, setRecSupplierName] = useState('');
  const [recSku, setRecSku] = useState('');
  const [recExpectedQty, setRecExpectedQty] = useState(10);
  const [recReceivedQty, setRecReceivedQty] = useState(10);
  const [recDamagedQty, setRecDamagedQty] = useState(0);
  const [recItems, setRecItems] = useState([]);
  const [recWarehouse, setRecWarehouse] = useState('01');
  const [recNotes, setRecNotes] = useState('');

  const [showNewOpForm, setShowNewOpForm] = useState(false);
  const [opBeneficiary, setOpBeneficiary] = useState('');
  const [opAmountBs, setOpAmountBs] = useState('');
  const [opRetBs, setOpRetBs] = useState('0');
  const [opFormaPag, setOpFormaPag] = useState('TRANSFERENCIA');
  const [opMotivo, setOpMotivo] = useState('');
  const [opCuenta, setOpCuenta] = useState('');

  // Catálogo unificado de proveedores (Profit + Signum local, sin duplicados por RIF/código)
  const unifiedSuppliers = useMemo(() => {
    const byKey = new Map();
    const pushSupplier = (raw, isProfit = false) => {
      if (!raw) return;
      const rifNorm = String(raw.rif || '').trim().toUpperCase();
      const codeNorm = String(raw.coProv || raw.co_prov || raw.codigo || raw.id || '').trim().toUpperCase();
      const dedupeKey = rifNorm || codeNorm;
      if (!dedupeKey) return;
      const normalized = {
        id: raw.id || raw.coProv || raw.co_prov || dedupeKey,
        codigo: raw.codigo || raw.coProv || raw.co_prov || raw.id || dedupeKey,
        coProv: raw.coProv || raw.co_prov || raw.codigo || raw.id || dedupeKey,
        nombre: raw.provDes || raw.prov_des || raw.nombre || 'Proveedor',
        provDes: raw.provDes || raw.prov_des || raw.nombre || 'Proveedor',
        rif: raw.rif || 'J-00000000-0',
        domicilioFiscal: raw.domicilioFiscal || raw.direccion || '',
        direccion: raw.direccion || raw.domicilioFiscal || '',
        diasCredito: Number(raw.diasCredito ?? raw.dias_credito ?? 30),
        saldoUsd: Number(raw.saldoUsd ?? raw.saldo_usd ?? raw.saldoPendienteUsd ?? 0),
        limiteCredito: Number(raw.limiteCredito ?? raw.limite_credito ?? 25000),
        inactivo: Boolean(raw.inactivo),
        source: isProfit ? 'PROFIT' : 'LOCAL'
      };
      const prev = byKey.get(dedupeKey);
      byKey.set(dedupeKey, prev ? { ...prev, ...normalized, saldoUsd: Math.max(prev.saldoUsd || 0, normalized.saldoUsd || 0) } : normalized);
    };
    (suppliers || []).forEach(s => pushSupplier(s, false));
    (profitSuppliers || []).forEach(s => pushSupplier(s, true));
    return Array.from(byKey.values());
  }, [suppliers, profitSuppliers]);

  // Form states for SENIAT purchase entry
  const [selectedSupplier, setSelectedSupplier] = useState(() => unifiedSuppliers[0] || suppliers[0] || null);
  const [numeroFacturaProv, setNumeroFacturaProv] = useState('');
  const [numeroControlProv, setNumeroControlProv] = useState('');
  const [tipoDoc, setTipoDoc] = useState('FACTURA');
  const [documentoAfectado, setDocumentoAfectado] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(products[0] || null);
  const [almacenDestino, setAlmacenDestino] = useState('01'); // '01' (Almacén 01 - Fiscal) | '02' (Almacén 02 - Bóveda / N.Entrega)
  const [tipoAlicuota, setTipoAlicuota] = useState('GENERAL_16');
  const [cantidadRecibida, setCantidadRecibida] = useState(5);
  const [nuevoCostoUsd, setNuevoCostoUsd] = useState(products[0]?.costoUsd || 28);
  const [fleteProrrateadoUsd, setFleteProrrateadoUsd] = useState(0);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [linkedReceiptId, setLinkedReceiptId] = useState('');
  const [porcentajeRetIva, setPorcentajeRetIva] = useState(75);
  const [porcentajeRetIslr, setPorcentajeRetIslr] = useState(2);
  const [condicionPago, setCondicionPago] = useState('CREDITO');
  const [diasCredito, setDiasCredito] = useState(() => Number(unifiedSuppliers[0]?.diasCredito ?? suppliers[0]?.diasCredito ?? 30));

  useEffect(() => {
    if (!selectedSupplier && unifiedSuppliers.length > 0) {
      setSelectedSupplier(unifiedSuppliers[0]);
      setDiasCredito(Number(unifiedSuppliers[0].diasCredito ?? 30));
    }
  }, [unifiedSuppliers, selectedSupplier]);

  useEffect(() => {
    if (!selectedProduct && Array.isArray(products) && products.length > 0) {
      setSelectedProduct(products[0]);
      setNuevoCostoUsd(Number(products[0]?.costoUsd || 0));
    }
  }, [products, selectedProduct]);

  const [localPurchases, setLocalPurchases] = useState(() => (purchases && purchases.length > 0 ? purchases : [
    {
      id: 'COMP-001',
      numeroFacturaProv: 'FAC-PROV-9921',
      numeroControl: '00-005821',
      tipoDoc: 'FACTURA',
      documentoAfectado: '',
      proveedorNombre: 'KEYSTONE, C.A. (Planta Barquisimeto)',
      proveedorRif: 'J-31115365-9',
      fecha: '2026-07-18T11:00:00.000Z',
      producto: 'Oilstone SAE 15W-40 API SL (Caja 12L)',
      cantidad: 10,
      costoUnitarioUsd: 28.00,
      subtotalUsd: 280.00,
      baseGeneralUsd: 280.00,
      ivaGeneralUsd: 44.80,
      totalUsd: 324.80,
      subtotalBs: 10220.00,
      baseGeneralBs: 10220.00,
      ivaGeneralBs: 1635.20,
      totalBs: 11855.20,
      retencionIvaUsd: 33.60,
      retencionIvaBs: 1226.40,
      retencionIslrUsd: 5.60,
      retencionIslrBs: 204.40,
      numeroComprobanteRetencionIva: '20260700000001',
      numeroComprobanteRetencionIslr: '20260700000001',
      codigoConceptoIslr: '055'
    }
  ]));

  useEffect(() => {
    if (Array.isArray(purchases)) {
      setLocalPurchases(purchases);
    }
  }, [purchases]);

  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [editingPurchaseOriginal, setEditingPurchaseOriginal] = useState(null);
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineEditDraft, setInlineEditDraft] = useState(null);

  const displayPurchases = (onRegisterPurchase || onUpdatePurchase || onDeletePurchase) && Array.isArray(purchases)
    ? purchases
    : localPurchases;

  // En este módulo partimos exclusivamente desde el 01/11/2026
  const scopedDisplayPurchases = useMemo(
    () => (displayPurchases || []).filter(p => p && isOnOrAfterDate(p.fecha || p.fechaEmision || p.fec_emis, PURCHASES_START_DATE)),
    [displayPurchases]
  );
  const scopedProfitPurchases = useMemo(
    () => (profitPurchases || []).filter(p => p && isOnOrAfterDate(p.fechaEmision || p.fec_emis || p.fecha, PURCHASES_START_DATE)),
    [profitPurchases]
  );
  const scopedAccountsPayable = useMemo(
    () => (profitAccountsPayable || []).filter(d => d && isOnOrAfterDate(d.fechaEmision || d.fec_emis || d.fecha, PURCHASES_START_DATE)),
    [profitAccountsPayable]
  );
  const scopedSupplierPayments = useMemo(
    () => (profitSupplierPayments || []).filter(p => p && isOnOrAfterDate(p.fecha || p.fec_cob || p.fechaPago || p.fec_pago, PURCHASES_START_DATE)),
    [profitSupplierPayments]
  );
  const scopedPaymentOrders = useMemo(
    () => (profitPaymentOrders || []).filter(o => o && isOnOrAfterDate(o.fecha || o.fec_emis || o.fec_pag, PURCHASES_START_DATE)),
    [profitPaymentOrders]
  );
  const scopedPurchaseRequisitions = useMemo(
    () => (purchaseRequisitions || []).filter(r => r && isOnOrAfterDate(r.fecha || r.fechaEmision, PURCHASES_START_DATE)),
    [purchaseRequisitions]
  );
  const scopedPurchaseOrders = useMemo(
    () => (purchaseOrders || []).filter(po => po && isOnOrAfterDate(po.fecha || po.fechaEmision, PURCHASES_START_DATE)),
    [purchaseOrders]
  );
  const scopedGoodsReceiptNotes = useMemo(
    () => (goodsReceiptNotes || []).filter(rec => rec && isOnOrAfterDate(rec.fec_emis || rec.fecha, PURCHASES_START_DATE)),
    [goodsReceiptNotes]
  );
  const scopedIslrWithholdings = useMemo(
    () => (profitIslrWithholdings || []).filter(w => w && isOnOrAfterDate(w.fecha || w.fec_emis || w.fechaEmision, PURCHASES_START_DATE)),
    [profitIslrWithholdings]
  );

  const rifValidation = selectedSupplier ? validateRif(selectedSupplier.rif) : { isValid: true };

  // Cálculos fiscales instantáneos en pantalla (soporta renglón activo o múltiples renglones)
  const qtyActiva = Math.max(0, Number(cantidadRecibida) || 0);
  const costoBaseActivo = Math.max(0, Number(nuevoCostoUsd) || 0);
  const fleteActivo = Math.max(0, Number(fleteProrrateadoUsd) || 0);
  const costoFinalConFlete = costoBaseActivo + (qtyActiva > 0 ? fleteActivo / qtyActiva : 0);
  const singleLineSubtotalUsd = costoFinalConFlete * qtyActiva;

  const taxSummary = useMemo(() => {
    const draftLines = purchaseItems.length > 0
      ? purchaseItems
      : [{
          cantidad: qtyActiva,
          costoUnitarioUsd: Number(costoFinalConFlete.toFixed(4)),
          fleteUsd: fleteActivo,
          subtotalUsd: Number(singleLineSubtotalUsd.toFixed(2)),
          tipoAlicuota
        }];

    let subUsd = 0;
    let baseExenta = 0;
    let baseGeneral = 0;
    let ivaGeneral = 0;
    let baseReducida = 0;
    let ivaReducida = 0;
    let islrBase = 0;

    draftLines.forEach((ln) => {
      const lSub = Number(ln.subtotalUsd || 0);
      subUsd += lSub;
      if (ln.tipoAlicuota === 'EXENTO_0') {
        baseExenta += lSub;
      } else if (ln.tipoAlicuota === 'REDUCIDA_8') {
        baseReducida += lSub;
        ivaReducida += lSub * 0.08;
        islrBase += lSub;
      } else {
        baseGeneral += lSub;
        ivaGeneral += lSub * 0.16;
        islrBase += lSub;
      }
    });

    const ivaCalc = ivaGeneral + ivaReducida;
    const retIva = ivaCalc * (porcentajeRetIva / 100);
    const retIslr = islrBase * (porcentajeRetIslr / 100);
    const totalFac = subUsd + ivaCalc;
    const neto = Math.max(0, totalFac - retIva - retIslr);

    return {
      subtotalUsd: Number(subUsd.toFixed(2)),
      baseExentaUsd: Number(baseExenta.toFixed(2)),
      baseGeneralUsd: Number(baseGeneral.toFixed(2)),
      ivaGeneralUsd: Number(ivaGeneral.toFixed(2)),
      baseReducidaUsd: Number(baseReducida.toFixed(2)),
      ivaReducidaUsd: Number(ivaReducida.toFixed(2)),
      ivaCalculadoUsd: Number(ivaCalc.toFixed(2)),
      retencionIvaCalculadaUsd: Number(retIva.toFixed(2)),
      retencionIslrCalculadaUsd: Number(retIslr.toFixed(2)),
      totalFacturaCalculadoUsd: Number(totalFac.toFixed(2)),
      netoPagarCalculadoUsd: Number(neto.toFixed(2))
    };
  }, [purchaseItems, qtyActiva, costoFinalConFlete, fleteActivo, singleLineSubtotalUsd, tipoAlicuota, porcentajeRetIva, porcentajeRetIslr]);

  const {
    subtotalUsd,
    baseExentaUsd,
    baseGeneralUsd,
    ivaGeneralUsd,
    baseReducidaUsd,
    ivaReducidaUsd,
    ivaCalculadoUsd,
    retencionIvaCalculadaUsd,
    retencionIslrCalculadaUsd,
    totalFacturaCalculadoUsd,
    netoPagarCalculadoUsd
  } = taxSummary;

  // Fusión unificada Profit + Compras locales Signum (evita ocultar compras locales o Notas de Entrega múltiples)
  const effectivePurchases = useMemo(() => {
    const byCanon = new Map();
    const normStr = (v) => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const isGenericDocLabel = (f) => {
      const clean = String(f || '').replace(/[^A-Z0-9]/g, '');
      return !clean || ['NOTADEENTREGA', 'NOTAENTREGA', 'NE', 'SN', 'SINNUMERO'].includes(clean);
    };

    const localList = Array.isArray(scopedDisplayPurchases) ? scopedDisplayPurchases.filter(Boolean) : [];
    const matchedLocalIds = new Set();

    const findMatchingLocal = (pp) => {
      const ppId = String(pp.id || '').trim();
      const ppCompraId = String(pp.compraId || pp.compra_id || '').trim();
      if (ppCompraId) {
        const byCompraId = localList.find(lp => String(lp.id || '').trim() === ppCompraId);
        if (byCompraId) return byCompraId;
      }
      const byExactId = localList.find(lp => String(lp.id || '').trim() === ppId);
      if (byExactId) return byExactId;

      const ppFac = normStr(pp.facturaProv || pp.factNum);
      const ppRif = normStr(pp.provRif || pp.coProv).replace(/[^A-Z0-9]/g, '');
      const ppCtrl = normStr(pp.nroControl || pp.numeroControl || pp.nro_control || pp.numero_control);
      const ppTotal = Number(pp.totNetoUsd ?? pp.totalUsd ?? 0);

      return localList.find(lp => {
        if (matchedLocalIds.has(lp.id)) return false;
        const lpFac = normStr(lp.numeroFacturaProv || lp.nroFactura);
        const lpRif = normStr(lp.proveedorRif || lp.proveedorId).replace(/[^A-Z0-9]/g, '');
        const lpCtrl = normStr(lp.numeroControl || lp.nroControl);
        const lpTotal = Number(lp.totalUsd ?? 0);
        if (ppFac && lpFac && ppFac !== lpFac) return false;
        if (ppRif && lpRif && ppRif !== lpRif) return false;
        if (ppCtrl && lpCtrl && ppCtrl === lpCtrl && Math.abs(ppTotal - lpTotal) < 0.05) return true;
        if (Math.abs(ppTotal - lpTotal) < 0.02) {
          const ppDate = String(pp.fechaEmision || pp.fec_emis || '').slice(0, 16);
          const lpDate = String(lp.fecha || lp.fechaEmision || '').slice(0, 16);
          if (ppDate && lpDate && ppDate === lpDate) return true;
          if (!isGenericDocLabel(ppFac)) return true;
        }
        return false;
      }) || null;
    };

    const buildKey = (facNum, ctrlNum, rif, totalUsd, fallbackId) => {
      const f = normStr(facNum);
      const c = normStr(ctrlNum);
      const r = normStr(rif).replace(/[^A-Z0-9]/g, '');
      const t = Number(totalUsd || 0).toFixed(2);
      if (!f || isGenericDocLabel(f)) {
        return `${f || 'DOC'}::${c || fallbackId}::${r}::${t}::${fallbackId || ''}`;
      }
      return c ? `${f}::${c}::${r}` : `${f}::${r}`;
    };

    (scopedProfitPurchases || []).forEach(p => {
      if (!p) return;
      const matchedLocal = findMatchingLocal(p);
      if (matchedLocal?.id) {
        matchedLocalIds.add(matchedLocal.id);
      }
      const ctrl = matchedLocal?.numeroControl || matchedLocal?.nroControl || p.nroControl || p.numeroControl || p.nro_control || p.numero_control || '';
      const localUpdatedTs = Date.parse(matchedLocal?.updatedAt || matchedLocal?.updated_at || 0) || 0;
      const profitUpdatedTs = Date.parse(p.updated_at || p.updatedAt || p.fechaSincronizacion || 0) || 0;
      const preferLocalFinancials = Boolean(
        matchedLocal &&
        Number(matchedLocal.totalUsd || 0) > 0 &&
        localUpdatedTs > 0 &&
        (profitUpdatedTs === 0 || localUpdatedTs > profitUpdatedTs)
      );

      let enriched = {
        ...p,
        compraId: p.compraId || p.compra_id || matchedLocal?.id || '',
        nroControl: ctrl,
        numeroControl: ctrl,
        almacen: matchedLocal?.almacen || p.almacen || '01',
        localRecord: matchedLocal || null
      };

      if (preferLocalFinancials) {
        const prevTotNeto = Number(p.totNetoUsd ?? p.totalUsd ?? 0);
        const prevSaldo = Number(p.saldoUsd ?? prevTotNeto);
        const abonosPrevios = Math.max(0, Number((prevTotNeto - prevSaldo).toFixed(2)));
        const nextTotalUsd = Number(matchedLocal.totalUsd || 0);
        const nextRate = Number(matchedLocal.tasaDolar || config?.tasaDolar || 1);
        const nextNetoPagar = matchedLocal.montoNetoPagarUsd !== undefined
          ? Number(matchedLocal.montoNetoPagarUsd)
          : nextTotalUsd;
        const nextSaldoUsd = (String(matchedLocal.tipoDoc || '').toUpperCase() === 'NOTA_CREDITO' || matchedLocal.condicionPago === 'CONTADO')
          ? 0
          : Math.max(0, Number((nextNetoPagar - abonosPrevios).toFixed(2)));
        const nextIvaUsd = Number(matchedLocal.ivaGeneralUsd || 0) + Number(matchedLocal.ivaReducidaUsd || 0);
        enriched = {
          ...enriched,
          factNum: matchedLocal.numeroFacturaProv || matchedLocal.nroFactura || enriched.factNum,
          facturaProv: matchedLocal.numeroFacturaProv || matchedLocal.nroFactura || enriched.facturaProv,
          provNombre: matchedLocal.proveedorNombre || enriched.provNombre,
          provRif: matchedLocal.proveedorRif || enriched.provRif,
          totBrutoUsd: Number(matchedLocal.subtotalUsd || 0),
          totBrutoBs: Number(matchedLocal.subtotalBs ?? Number((Number(matchedLocal.subtotalUsd || 0) * nextRate).toFixed(2))),
          ivaUsd: nextIvaUsd,
          ivaBs: Number((nextIvaUsd * nextRate).toFixed(2)),
          totNetoUsd: nextTotalUsd,
          totNetoBs: Number(matchedLocal.totalBs ?? Number((nextTotalUsd * nextRate).toFixed(2))),
          saldoUsd: nextSaldoUsd,
          saldoBs: Number((nextSaldoUsd * nextRate).toFixed(2)),
          status: (String(matchedLocal.tipoDoc || '').toUpperCase() === 'NOTA_CREDITO' || matchedLocal.condicionPago === 'CONTADO' || nextSaldoUsd <= 0.01)
            ? 'PAGADA'
            : 'SALDO_PENDIENTE',
          items: Array.isArray(matchedLocal.items) && matchedLocal.items.length > 0 ? matchedLocal.items : enriched.items
        };
      }

      const key = buildKey(enriched.facturaProv || enriched.factNum, ctrl, enriched.provRif || enriched.coProv, enriched.totNetoUsd, enriched.id);
      if (key && !byCanon.has(key)) {
        byCanon.set(key, enriched);
      }
    });

    localList.forEach(p => {
      if (!p || matchedLocalIds.has(p.id)) return;
      const ctrl = p.numeroControl || p.nroControl || '';
      const key = buildKey(p.numeroFacturaProv || p.nroFactura || p.id, ctrl, p.proveedorRif || p.proveedorId, p.totalUsd, p.id);
      if (!key || byCanon.has(key)) return;
      byCanon.set(key, {
        id: p.id,
        compraId: p.id,
        factNum: p.numeroFacturaProv || p.nroFactura || p.id,
        facturaProv: p.numeroFacturaProv || p.nroFactura || p.id,
        nroControl: ctrl,
        numeroControl: ctrl,
        provNombre: p.proveedorNombre || 'Proveedor',
        provRif: p.proveedorRif || 'J-00000000-0',
        coProv: p.proveedorId || 'P-0001',
        fechaEmision: p.fecha,
        fechaVencimiento: p.fecha,
        totBrutoUsd: Number(p.subtotalUsd || 0),
        totBrutoBs: Number(p.subtotalBs || 0),
        ivaUsd: Number((p.ivaGeneralUsd || 0) + (p.ivaReducidaUsd || 0)),
        totNetoUsd: Number(p.totalUsd || 0),
        totNetoBs: Number(p.totalBs || 0),
        saldoUsd: p.condicionPago === 'CONTADO' ? 0 : Number(p.montoNetoPagarUsd ?? p.totalUsd ?? 0),
        status: p.condicionPago === 'CONTADO' ? 'PAGADA' : 'SALDO_PENDIENTE',
        almacen: p.almacen || '01',
        anulada: Boolean(p.anulada || p.anulado),
        items: p.items || [],
        localRecord: p
      });
    });

    return Array.from(byCanon.values()).sort((a, b) => new Date(b.fechaEmision || 0) - new Date(a.fechaEmision || 0));
  }, [scopedProfitPurchases, scopedDisplayPurchases, config?.tasaDolar]);

  // KPIs Generales del Módulo de Compras y Proveedores
  const kpis = useMemo(() => {
    const activePurchases = effectivePurchases.filter(p => p && !p.anulada && !p.anulado);
    const activeCxP = (scopedAccountsPayable || []).filter(d => d && !d.anulado);
    const activePayments = (scopedSupplierPayments || []).filter(p => p && !p.anulado);

    const totalComprasUsd = activePurchases.reduce((acc, p) => acc + (p.totNetoUsd || 0), 0);
    const totalComprasBs = activePurchases.reduce((acc, p) => acc + (p.totNetoBs || 0), 0);
    const totalCxPUsd = activeCxP.reduce((acc, d) => acc + (d.saldoUsd || 0), 0);
    const totalCxPBs = activeCxP.reduce((acc, d) => acc + (d.saldoBs || 0), 0);
    const totalPagadoUsd = activePayments.reduce((acc, p) => acc + (p.montoUsd || 0), 0);
    const totalPagadoBs = activePayments.reduce((acc, p) => acc + (p.montoBs || 0), 0);

    const now = new Date();
    const cxpVencidaUsd = activeCxP
      .filter(d => d.fechaVencimiento && new Date(d.fechaVencimiento) < now && d.saldoUsd > 0.01)
      .reduce((acc, d) => acc + d.saldoUsd, 0);

    const cxpAlDiaUsd = Math.max(0, totalCxPUsd - cxpVencidaUsd);

    return {
      totalProveedores: unifiedSuppliers.length || 5,
      totalComprasCount: activePurchases.length,
      totalComprasUsd,
      totalComprasBs,
      totalCxPUsd,
      totalCxPBs,
      cxpAlDiaUsd,
      cxpVencidaUsd,
      totalPagadoUsd,
      totalPagadoBs,
      totalPagosCount: activePayments.length
    };
  }, [unifiedSuppliers, effectivePurchases, scopedAccountsPayable, scopedSupplierPayments]);

  const filteredPurchases = useMemo(() => {
    return effectivePurchases.filter(p => {
      if (!p) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        String(p.factNum || '').toLowerCase().includes(q) ||
        (p.facturaProv && String(p.facturaProv).toLowerCase().includes(q)) ||
        (p.nroControl && String(p.nroControl).toLowerCase().includes(q)) ||
        (p.numeroControl && String(p.numeroControl).toLowerCase().includes(q)) ||
        (p.provNombre && String(p.provNombre).toLowerCase().includes(q)) ||
        (p.provRif && String(p.provRif).toLowerCase().includes(q)) ||
        (p.coProv && String(p.coProv).toLowerCase().includes(q));

      const matchStatus = statusFilter === 'TODOS' || p.status === statusFilter;
      const matchDate = matchesDatePeriodFilter(p.fechaEmision || p.fec_emis || p.fecha, datePeriodFilter);
      return matchQuery && matchStatus && matchDate;
    });
  }, [effectivePurchases, searchQuery, statusFilter, datePeriodFilter]);

  // Filtrado de Proveedores Unificados
  const effectiveSuppliers = unifiedSuppliers;

  const filteredSuppliers = useMemo(() => {
    return effectiveSuppliers.filter(s => {
      if (!s) return false;
      const q = searchQuery.toLowerCase().trim();
      const pDes = s.provDes || s.prov_des || s.nombre || '';
      const r = s.rif || '';
      const c = s.coProv || s.co_prov || s.codigo || '';
      return !q ||
        pDes.toLowerCase().includes(q) ||
        r.toLowerCase().includes(q) ||
        c.toLowerCase().includes(q);
    });
  }, [effectiveSuppliers, searchQuery]);

  // Filtrado de Cuentas por Pagar (CxP)
  const filteredCxP = useMemo(() => {
    const now = new Date();
    return (scopedAccountsPayable || []).filter(d => {
      if (!d || d.anulado) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        String(d.nroDoc || '').toLowerCase().includes(q) ||
        (d.provNombre && String(d.provNombre).toLowerCase().includes(q)) ||
        (d.coProv && String(d.coProv).toLowerCase().includes(q)) ||
        (d.tipoDoc && String(d.tipoDoc).toLowerCase().includes(q));

      let matchStatus = true;
      if (statusFilter === 'VENCIDA') {
        matchStatus = d.fechaVencimiento && new Date(d.fechaVencimiento) < now && Number(d.saldoUsd || 0) > 0.01;
      } else if (statusFilter === 'AL_DIA') {
        matchStatus = !d.fechaVencimiento || (new Date(d.fechaVencimiento) >= now && Number(d.saldoUsd || 0) > 0.01);
      } else if (statusFilter === 'PAGADA') {
        matchStatus = Number(d.saldoUsd || 0) <= 0.01;
      }

      const matchDate = matchesDatePeriodFilter(d.fechaEmision || d.fec_emis || d.fecha, datePeriodFilter);
      return matchQuery && matchStatus && matchDate;
    });
  }, [scopedAccountsPayable, searchQuery, statusFilter, datePeriodFilter]);

  // Filtrado de Pagos a Proveedores
  const filteredPayments = useMemo(() => {
    return (scopedSupplierPayments || []).filter(p => {
      if (!p || p.anulado) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        String(p.pagoNum || '').toLowerCase().includes(q) ||
        (p.provNombre && String(p.provNombre).toLowerCase().includes(q)) ||
        (p.descrip && String(p.descrip).toLowerCase().includes(q)) ||
        (p.coProv && String(p.coProv).toLowerCase().includes(q));
      return matchQuery && matchesDatePeriodFilter(p.fecha || p.fec_cob || p.fechaPago, datePeriodFilter);
    });
  }, [scopedSupplierPayments, searchQuery, datePeriodFilter]);

  // Filtrado de Órdenes de Pago Profit
  const filteredPaymentOrders = useMemo(() => {
    return (scopedPaymentOrders || []).filter(o => {
      if (!o) return false;
      const q = searchQuery.toLowerCase().trim();
      const ben = String(o.benDes || o.benNombre || '').toLowerCase();
      const desc = String(o.descrip || o.motivo || '').toLowerCase();
      const ord = String(o.ordNum || o.ord_num || '').toLowerCase();
      const cod = String(o.codBen || o.cod_ben || '').toLowerCase();
      const matchQuery = !q || ord.includes(q) || ben.includes(q) || desc.includes(q) || cod.includes(q);
      return matchQuery && matchesDatePeriodFilter(o.fecha || o.fec_emis || o.fec_pag, datePeriodFilter);
    });
  }, [scopedPaymentOrders, searchQuery, datePeriodFilter]);

  // Filtrado de Beneficiarios Profit
  const filteredBeneficiaries = useMemo(() => {
    return (profitBeneficiaries || []).filter(b => {
      if (!b) return false;
      const q = searchQuery.toLowerCase().trim();
      const ben = String(b.benDes || b.ben_des || '').toLowerCase();
      const rif = String(b.rif || '').toLowerCase();
      const cod = String(b.codBen || b.cod_ben || '').toLowerCase();
      return !q || ben.includes(q) || rif.includes(q) || cod.includes(q);
    });
  }, [profitBeneficiaries, searchQuery]);

  const handleTriggerSync = async () => {
    setSyncing(true);
    if (onSyncProfit) {
      await onSyncProfit();
    }
    setTimeout(() => setSyncing(false), 800);
  };

  const handleAddPurchaseItem = () => {
    if (!selectedProduct) {
      notify.warning('Seleccione un lubricante o insumo para agregar.');
      return;
    }
    if (!(qtyActiva > 0)) {
      notify.warning('La cantidad debe ser mayor a 0.');
      return;
    }
    const newLine = {
      productoId: selectedProduct.id,
      codigo: selectedProduct.codigo || selectedProduct.id,
      producto: selectedProduct.descripcion,
      descripcion: selectedProduct.descripcion,
      cantidad: qtyActiva,
      costoUnitarioUsd: parseFloat(costoFinalConFlete.toFixed(2)),
      fleteUsd: parseFloat(fleteActivo.toFixed(2)),
      subtotalUsd: parseFloat(singleLineSubtotalUsd.toFixed(2)),
      tipoAlicuota,
      almacen: almacenDestino
    };
    setPurchaseItems((prev) => [...prev, newLine]);
    setFleteProrrateadoUsd(0);
  };

  const handleCancelEditPurchase = () => {
    setEditingPurchaseId(null);
    setEditingPurchaseOriginal(null);
    setInlineEditId(null);
    setInlineEditDraft(null);
    setNumeroFacturaProv('');
    setNumeroControlProv('');
    setDocumentoAfectado('');
    setPurchaseItems([]);
    setLinkedReceiptId('');
    setFleteProrrateadoUsd(0);
  };

  const handleStartEditPurchase = (rec) => {
    if (!rec) return;
    const recId = rec.id;
    setEditingPurchaseId(recId);
    setEditingPurchaseOriginal(rec);

    // Vincular proveedor en el formulario superior
    const matchedSupplier = unifiedSuppliers.find(
      (s) =>
        (rec.proveedorId && String(s.id) === String(rec.proveedorId)) ||
        (rec.proveedorRif && String(s.rif || '').trim().toUpperCase() === String(rec.proveedorRif || '').trim().toUpperCase()) ||
        (rec.proveedorNombre && String(s.nombre || s.provDes || '').trim().toUpperCase() === String(rec.proveedorNombre || '').trim().toUpperCase())
    ) || selectedSupplier || unifiedSuppliers[0] || null;

    if (matchedSupplier) {
      setSelectedSupplier(matchedSupplier);
    }
    setNumeroFacturaProv(String(rec.numeroFacturaProv || rec.facturaProv || rec.nroFactura || ''));
    setNumeroControlProv(String(rec.numeroControl || rec.nroControl || '00-005821'));
    setTipoDoc(rec.tipoDoc || 'FACTURA');
    setDocumentoAfectado(String(rec.documentoAfectado || ''));
    setAlmacenDestino(String(rec.almacen || '01').includes('02') ? '02' : '01');
    setCondicionPago(rec.condicionPago || 'CREDITO');
    setDiasCredito(Number(rec.diasCredito ?? matchedSupplier?.diasCredito ?? 30));
    setLinkedReceiptId(rec.recepcionId || '');

    const items = Array.isArray(rec.items) && rec.items.length > 0 ? rec.items : [];
    if (items.length > 1) {
      setPurchaseItems(items.map((it) => {
        const qty = Number(it.cantidad || 1);
        const unitCost = Number(it.costoUnitarioUsd ?? it.precioUnitario ?? 0);
        const itemFlete = Number(it.fleteUsd || 0);
        return {
          productoId: it.productoId || it.articuloId || it.codigo || '',
          codigo: it.codigo || it.articuloId || it.productoId || '',
          producto: it.producto || it.descripcion || '',
          descripcion: it.descripcion || it.producto || '',
          cantidad: qty,
          costoUnitarioUsd: unitCost,
          fleteUsd: itemFlete,
          subtotalUsd: Number(it.subtotalUsd ?? it.totalNeto ?? (qty * unitCost + itemFlete)),
          tipoAlicuota: it.tipoAlicuota || (Number(rec.ivaGeneralUsd || rec.ivaUsd || 0) === 0 && Number(rec.ivaReducidaUsd || 0) === 0 ? 'EXENTO_0' : 'GENERAL_16'),
          almacen: String(it.almacen || rec.almacen || '01').includes('02') ? '02' : '01'
        };
      }));
    } else {
      setPurchaseItems([]);
      const firstIt = items[0] || null;
      const prodMatch = products.find(
        (p) =>
          (firstIt && (String(p.id) === String(firstIt.productoId) || String(p.codigo) === String(firstIt.codigo))) ||
          (rec.productoId && String(p.id) === String(rec.productoId)) ||
          (rec.productoCodigo && String(p.codigo) === String(rec.productoCodigo)) ||
          (rec.producto && String(p.descripcion || '').toLowerCase() === String(rec.producto || '').toLowerCase())
      );
      if (prodMatch) setSelectedProduct(prodMatch);
      const qty = Number(firstIt?.cantidad ?? rec.cantidad ?? 1) || 1;
      const cost = Number(firstIt?.costoUnitarioUsd ?? rec.costoUnitarioUsd ?? rec.totalUsd ?? prodMatch?.costoUsd ?? 0);
      setCantidadRecibida(qty);
      setNuevoCostoUsd(cost);
      setFleteProrrateadoUsd(Number(firstIt?.fleteUsd ?? rec.fleteUsd ?? 0));
      if (firstIt?.tipoAlicuota) {
        setTipoAlicuota(firstIt.tipoAlicuota);
      } else if (Number(rec.ivaGeneralUsd || 0) === 0 && Number(rec.ivaReducidaUsd || 0) === 0) {
        setTipoAlicuota('EXENTO_0');
      } else if (Number(rec.ivaReducidaUsd || 0) > 0) {
        setTipoAlicuota('REDUCIDA_8');
      } else {
        setTipoAlicuota('GENERAL_16');
      }
    }

    const totalIvaOrig = Number(rec.ivaGeneralUsd || 0) + Number(rec.ivaReducidaUsd || 0);
    const retIvaOrig = Number(rec.retencionIvaUsd || 0);
    if (totalIvaOrig > 0 && retIvaOrig > 0) {
      const pctIva = Math.round((retIvaOrig / totalIvaOrig) * 100);
      setPorcentajeRetIva(pctIva >= 90 ? 100 : pctIva >= 50 ? 75 : 0);
    } else {
      setPorcentajeRetIva(0);
    }
    const baseImpOrig = Number(rec.baseGeneralUsd || 0) + Number(rec.baseReducidaUsd || 0);
    const retIslrOrig = Number(rec.retencionIslrUsd || 0);
    if (baseImpOrig > 0 && retIslrOrig > 0) {
      const pctIslr = Math.round((retIslrOrig / baseImpOrig) * 100);
      setPorcentajeRetIslr(pctIslr >= 4 ? 5 : pctIslr >= 1 ? 2 : 0);
    } else {
      setPorcentajeRetIslr(0);
    }

    const tasa = Number(rec.tasaDolar || config?.tasaDolar || 1);
    const rawDate = rec.fecha || rec.fechaCompra || rec.fechaEmision || new Date().toISOString();
    const dateInputVal = /^\d{4}-\d{2}-\d{2}/.test(String(rawDate))
      ? String(rawDate).slice(0, 10)
      : new Date(rawDate).toISOString().slice(0, 10);

    const retIvaUsdVal = Number(rec.retencionIvaUsd ?? ((Number(rec.retencionIvaBs || 0)) / (tasa || 1)));
    const retIslrUsdVal = Number(rec.retencionIslrUsd ?? ((Number(rec.retencionIslrBs || 0)) / (tasa || 1)));

    setInlineEditId(recId);
    setInlineEditDraft({
      id: recId,
      fecha: dateInputVal,
      numeroFacturaProv: String(rec.numeroFacturaProv || rec.facturaProv || rec.nroFactura || ''),
      numeroControl: String(rec.numeroControl || rec.nroControl || '00-005821'),
      tipoDoc: rec.tipoDoc || 'FACTURA',
      proveedorId: rec.proveedorId || matchedSupplier?.id || '',
      proveedorNombre: String(rec.proveedorNombre || rec.proveedor || matchedSupplier?.nombre || ''),
      proveedorRif: String(rec.proveedorRif || matchedSupplier?.rif || 'J-31115365-9'),
      totalUsd: Number(rec.totalUsd || 0),
      retencionIvaUsd: Number(retIvaUsdVal.toFixed(2)),
      retencionIslrUsd: Number(retIslrUsdVal.toFixed(2)),
      numeroComprobanteRetencionIva: String(rec.numeroComprobanteRetencionIva || '20260700000001')
    });
  };

  const handleSaveInlinePurchase = async (rec) => {
    if (!rec || !inlineEditDraft) return;
    const facNum = String(inlineEditDraft.numeroFacturaProv || '').trim().toUpperCase();
    const ctrlNum = String(inlineEditDraft.numeroControl || '').trim().toUpperCase();
    if (!facNum) {
      notify.warning('El N° de Factura del Proveedor no puede estar vacío.');
      return;
    }
    if (!ctrlNum) {
      notify.warning('El N° de Control no puede estar vacío.');
      return;
    }

    const tasa = Number(rec.tasaDolar || config?.tasaDolar || 1);
    const totalUsdVal = Math.max(0, Number(inlineEditDraft.totalUsd) || 0);
    const retIvaUsdVal = Math.max(0, Number(inlineEditDraft.retencionIvaUsd) || 0);
    const retIslrUsdVal = Math.max(0, Number(inlineEditDraft.retencionIslrUsd) || 0);
    const oldTotalUsd = Number(rec.totalUsd || 0);
    const scaleRatio = oldTotalUsd > 0 ? (totalUsdVal / oldTotalUsd) : 1;
    const nextSubtotalUsd = oldTotalUsd > 0 && Number(rec.subtotalUsd || 0) > 0
      ? Number((Number(rec.subtotalUsd) * scaleRatio).toFixed(2))
      : totalUsdVal;
    const nextIvaGeneralUsd = Math.max(0, Number((totalUsdVal - nextSubtotalUsd).toFixed(2)));
    const netoPagarUsd = Math.max(0, Number((totalUsdVal - retIvaUsdVal - retIslrUsdVal).toFixed(2)));

    const fechaIso = inlineEditDraft.fecha
      ? new Date(`${inlineEditDraft.fecha}T12:00:00.000Z`).toISOString()
      : (rec.fecha || new Date().toISOString());

    const updatedPayload = {
      ...rec,
      id: rec.id,
      fecha: fechaIso,
      numeroFacturaProv: facNum,
      numeroControl: ctrlNum,
      tipoDoc: inlineEditDraft.tipoDoc || rec.tipoDoc || 'FACTURA',
      proveedorId: inlineEditDraft.proveedorId || rec.proveedorId,
      proveedorNombre: String(inlineEditDraft.proveedorNombre || rec.proveedorNombre || 'Proveedor').trim(),
      proveedorRif: String(inlineEditDraft.proveedorRif || rec.proveedorRif || 'J-00000000-0').trim().toUpperCase(),
      tasaDolar: tasa,
      subtotalUsd: nextSubtotalUsd,
      subtotalBs: Number((nextSubtotalUsd * tasa).toFixed(2)),
      ivaGeneralUsd: nextIvaGeneralUsd,
      ivaGeneralBs: Number((nextIvaGeneralUsd * tasa).toFixed(2)),
      totalUsd: totalUsdVal,
      totalBs: Number((totalUsdVal * tasa).toFixed(2)),
      retencionIvaUsd: retIvaUsdVal,
      retencionIvaBs: Number((retIvaUsdVal * tasa).toFixed(2)),
      retencionIslrUsd: retIslrUsdVal,
      retencionIslrBs: Number((retIslrUsdVal * tasa).toFixed(2)),
      montoNetoPagarUsd: netoPagarUsd,
      numeroComprobanteRetencionIva: String(inlineEditDraft.numeroComprobanteRetencionIva || rec.numeroComprobanteRetencionIva || '').trim()
    };

    if (onUpdatePurchase) {
      const saved = await onUpdatePurchase(rec.id, updatedPayload);
      setLocalPurchases((prev) => prev.map((p) => (p && p.id === rec.id ? (saved || updatedPayload) : p)));
    } else {
      setLocalPurchases((prev) => prev.map((p) => (p && p.id === rec.id ? updatedPayload : p)));
      notify.success(`Carga SENIAT #${facNum} actualizada y guardada con éxito.`);
    }

    handleCancelEditPurchase();
  };

  const handleDeletePurchaseRecord = async (rec) => {
    if (!rec) return;
    const docLabel = rec.numeroFacturaProv || rec.facturaProv || rec.nroFactura || rec.id;
    const provLabel = rec.proveedorNombre || rec.proveedor || 'Proveedor';
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        `¿Está seguro de eliminar del Historial de Cargas SENIAT el documento "${docLabel}" de ${provLabel} (${formatUsd(rec.totalUsd)})?`
      );
      if (!confirmed) return;
    }

    if (onDeletePurchase) {
      await onDeletePurchase(rec);
    } else {
      notify.success(`Registro SENIAT "${docLabel}" eliminado con éxito.`);
    }
    setLocalPurchases((prev) => prev.filter((p) => p && String(p.id) !== String(rec.id)));
    if (editingPurchaseId === rec.id || inlineEditId === rec.id) {
      handleCancelEditPurchase();
    }
  };

  const handleRegisterPurchase = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) {
      notify.warning('Seleccione un proveedor válido.');
      return;
    }
    if (!rifValidation.isValid) {
      notify.warning(`El RIF "${selectedSupplier.rif}" del proveedor seleccionado es inválido según el patrón SENIAT.`);
      return;
    }
    if (!numeroFacturaProv.trim()) {
      notify.warning('Ingrese el Número de Factura del Proveedor.');
      return;
    }

    if (!numeroControlProv.trim()) {
      notify.warning('Según la Providencia SENIAT SNAT/2011/00071, es obligatorio ingresar el Número de Control del documento.');
      return;
    }

    if ((tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') && !documentoAfectado.trim()) {
      notify.warning('Para emitir o registrar una Nota de Crédito/Débito, es obligatorio ingresar el Número de Factura Afectada.');
      return;
    }

    const finalItems = purchaseItems.length > 0
      ? purchaseItems.map((it) => {
          const qty = Math.max(0.01, Number(it.cantidad || 1));
          const cost = Math.max(0, Number(it.costoUnitarioUsd || 0));
          const flete = Math.max(0, Number(it.fleteUsd || 0));
          return {
            ...it,
            cantidad: qty,
            costoUnitarioUsd: cost,
            fleteUsd: flete,
            subtotalUsd: Number((qty * cost + flete).toFixed(2))
          };
        })
      : (selectedProduct && qtyActiva > 0
          ? [{
              productoId: selectedProduct.id,
              codigo: selectedProduct.codigo || selectedProduct.id,
              producto: selectedProduct.descripcion,
              descripcion: selectedProduct.descripcion,
              cantidad: qtyActiva,
              costoUnitarioUsd: parseFloat(costoFinalConFlete.toFixed(2)),
              fleteUsd: parseFloat(fleteActivo.toFixed(2)),
              subtotalUsd: parseFloat(singleLineSubtotalUsd.toFixed(2)),
              tipoAlicuota,
              almacen: almacenDestino
            }]
          : []);

    if (finalItems.length === 0) {
      notify.warning('Debe incluir al menos un producto con cantidad mayor a 0.');
      return;
    }

    const totalQty = finalItems.reduce((s, it) => s + Number(it.cantidad || 0), 0);
    const totalFlete = finalItems.reduce((s, it) => s + Number(it.fleteUsd || 0), 0);
    const dateObj = new Date();
    const voucherSeq = displayPurchases.length + 1;
    const voucherNum = editingPurchaseOriginal?.numeroComprobanteRetencionIva
      || generateVatRetentionVoucherNumber(dateObj, voucherSeq);

    const tasaActiva = Number(config?.tasaDolar || editingPurchaseOriginal?.tasaDolar || 1);
    const nowIso = new Date().toISOString();
    const origBase = editingPurchaseOriginal ? { ...editingPurchaseOriginal } : {};
    delete origBase.totNetoUsd;
    delete origBase.totNetoBs;
    delete origBase.totBrutoUsd;
    delete origBase.totBrutoBs;
    delete origBase.saldoUsd;
    delete origBase.saldoBs;
    delete origBase.total_usd;
    delete origBase.subtotal_usd;
    delete origBase.total_bs;
    delete origBase.subtotal_bs;
    delete origBase.localRecord;

    const purchasePayload = {
      ...origBase,
      id: editingPurchaseId || undefined,
      profitPurchaseId: editingPurchaseOriginal?.profitPurchaseId || (String(editingPurchaseOriginal?.id || '').startsWith('COM-') ? editingPurchaseOriginal.id : undefined),
      _prevFacNum: editingPurchaseOriginal?.numeroFacturaProv || editingPurchaseOriginal?.facturaProv || editingPurchaseOriginal?.nroFactura || editingPurchaseOriginal?.factNum || '',
      _prevCtrlNum: editingPurchaseOriginal?.numeroControl || editingPurchaseOriginal?.nroControl || '',
      _prevRif: editingPurchaseOriginal?.proveedorRif || editingPurchaseOriginal?.provRif || editingPurchaseOriginal?.coProv || '',
      _prevTotalUsd: Number(editingPurchaseOriginal?.totalUsd ?? editingPurchaseOriginal?.totNetoUsd ?? 0),
      numeroFacturaProv: numeroFacturaProv.trim().toUpperCase(),
      numeroControl: numeroControlProv.trim().toUpperCase(),
      tipoDoc,
      documentoAfectado: (tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') ? documentoAfectado.trim().toUpperCase() : '',
      fecha: editingPurchaseOriginal?.fecha || dateObj.toISOString(),
      updatedAt: nowIso,
      proveedorId: selectedSupplier.id,
      proveedorNombre: selectedSupplier.nombre || selectedSupplier.provDes,
      proveedorRif: selectedSupplier.rif,
      proveedorDireccion: selectedSupplier.domicilioFiscal || selectedSupplier.direccion || '',
      tasaDolar: tasaActiva,
      condicionPago,
      diasCredito: condicionPago === 'CONTADO' ? 0 : Math.max(0, parseInt(diasCredito, 10) || 0),
      producto: finalItems.map(it => it.descripcion).filter(Boolean).join(' + '),
      productoId: finalItems[0]?.productoId || '',
      productoCodigo: finalItems[0]?.codigo || '',
      cantidad: totalQty,
      costoUnitarioUsd: finalItems[0]?.costoUnitarioUsd || 0,
      fleteUsd: parseFloat(totalFlete.toFixed(2)),
      fleteBs: Number((parseFloat(totalFlete.toFixed(2)) * tasaActiva).toFixed(2)),
      subtotalUsd,
      baseExentaUsd,
      baseGeneralUsd,
      ivaGeneralUsd,
      baseReducidaUsd,
      ivaReducidaUsd,
      totalUsd: totalFacturaCalculadoUsd,
      subtotalBs: Number((subtotalUsd * tasaActiva).toFixed(2)),
      baseExentaBs: Number((baseExentaUsd * tasaActiva).toFixed(2)),
      baseGeneralBs: Number((baseGeneralUsd * tasaActiva).toFixed(2)),
      ivaGeneralBs: Number((ivaGeneralUsd * tasaActiva).toFixed(2)),
      baseReducidaBs: Number((baseReducidaUsd * tasaActiva).toFixed(2)),
      ivaReducidaBs: Number((ivaReducidaUsd * tasaActiva).toFixed(2)),
      totalBs: Number((totalFacturaCalculadoUsd * tasaActiva).toFixed(2)),
      retencionIvaUsd: retencionIvaCalculadaUsd,
      retencionIvaBs: Number((retencionIvaCalculadaUsd * tasaActiva).toFixed(2)),
      retencionIslrUsd: retencionIslrCalculadaUsd,
      retencionIslrBs: Number((retencionIslrCalculadaUsd * tasaActiva).toFixed(2)),
      montoNetoPagarUsd: netoPagarCalculadoUsd,
      numeroComprobanteRetencionIva: voucherNum,
      numeroComprobanteRetencionIslr: editingPurchaseOriginal?.numeroComprobanteRetencionIslr || voucherNum,
      almacen: almacenDestino,
      almacenNombre: almacenDestino === '01' ? 'Almacén 01 (Fiscal / SENIAT)' : 'Almacén 02 (Central / Bóveda - Notas de Entrega)',
      receptor: currentUser?.nombre || 'Pedro Gómez',
      recepcionId: linkedReceiptId || '',
      items: finalItems
    };

    if (editingPurchaseId) {
      if (onUpdatePurchase) {
        const saved = await onUpdatePurchase(editingPurchaseId, purchasePayload);
        setLocalPurchases((prev) => prev.map((p) => (p && p.id === editingPurchaseId ? (saved || purchasePayload) : p)));
      } else {
        setLocalPurchases((prev) => prev.map((p) => (p && p.id === editingPurchaseId ? purchasePayload : p)));
        notify.success(`Carga fiscal SENIAT #${purchasePayload.numeroFacturaProv} actualizada y guardada.`);
      }
      handleCancelEditPurchase();
      return;
    }

    if (onRegisterPurchase) {
      await onRegisterPurchase(purchasePayload);
    } else {
      setLocalPurchases([purchasePayload, ...localPurchases]);
    }

    setNumeroFacturaProv('');
    setNumeroControlProv('');
    setDocumentoAfectado('');
    setPurchaseItems([]);
    setLinkedReceiptId('');
    setFleteProrrateadoUsd(0);
    notify.success(`Compra fiscal registrada con éxito. Comprobante IVA: ${voucherNum}`);
  };

  return (
    <div className="purchases-view-container">
      {/* CABECERA PRINCIPAL */}
      <div className="page-header-responsive" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(194, 65, 12, 0.3)'
              }}
            >
              <Truck size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Compras, Proveedores & Cuentas por Pagar (CxP)
              </h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Gestión integral de compras y proveedores conforme a SENIAT</span>
                <span className="badge badge-info" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                  Desde 01/11/2026
                </span>
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setActiveSubTab('registro_seniat');
              setStatusFilter('TODOS');
            }}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderColor: '#10b981',
              color: '#ffffff',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.84rem',
              boxShadow: '0 3px 10px rgba(16, 185, 129, 0.4)',
              padding: '0.5rem 1.1rem'
            }}
            title="Ingresar nueva compra con factura del proveedor y cargarla directamente al inventario (Alm 01 / Alm 02)"
          >
            <Plus size={17} strokeWidth={2.5} />
            Registrar Compra / Ingresar Mercancía
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowReorderModal(true)}
            style={{
              background: 'linear-gradient(135deg, rgba(230, 0, 18, 0.15), rgba(194, 65, 12, 0.25))',
              border: '1px solid rgba(230, 0, 18, 0.4)',
              color: '#f87171',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem'
            }}
          >
            <Sliders size={15} color="var(--motorven-red)" />
            Matriz Reorden ROP
          </button>
          <button
            className="btn"
            onClick={() => setShowIslrModal(true)}
            style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: '#fff',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              fontSize: '0.82rem',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)'
            }}
          >
            <FileText size={15} />
            Retenciones ISLR SENIAT
          </button>
          <button
            className="btn btn-print-report"
            onClick={() => generatePurchasesPDF({ purchases: filteredPurchases, suppliers: filteredSuppliers, config, currentUser })}
            style={{ marginLeft: 'auto' }}
            title="Descargar Reporte Oficial de Compras y Proveedores en PDF"
          >
            <Printer size={15} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Compras Registradas
            </span>
            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{kpis.totalComprasCount} Docs</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-tech)' }}>
            {formatUsd(kpis.totalComprasUsd)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
            {formatBs(kpis.totalComprasBs)}
          </div>
        </div>

        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Saldo Total CxP (Deuda)
            </span>
            <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Por Pagar</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--motorven-red)', fontFamily: 'var(--font-tech)' }}>
            {formatUsd(kpis.totalCxPUsd)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
            {formatBs(kpis.totalCxPBs)}
          </div>
        </div>

        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              CxP Al Día vs. Vencida
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Vencimientos</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)' }}>
                {formatUsd(kpis.cxpAlDiaUsd)}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Al Día</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--motorven-red)', fontFamily: 'var(--font-tech)' }}>
                {formatUsd(kpis.cxpVencidaUsd)}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Vencida</div>
            </div>
          </div>
        </div>

        <div className="kpi-card-modern" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '14px', padding: '1.15rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pagos & Abonos Emitidos
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{kpis.totalPagosCount} Pagos</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-tech)' }}>
            {formatUsd(kpis.totalPagadoUsd)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
            {formatBs(kpis.totalPagadoBs)}
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
          onClick={() => { setActiveSubTab('facturas_profit'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'facturas_profit' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'facturas_profit' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'facturas_profit' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <FileText size={16} /> Facturas de Compra ({effectivePurchases.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('proveedores_profit'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'proveedores_profit' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'proveedores_profit' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'proveedores_profit' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <Building size={16} /> Directorio Proveedores ({effectiveSuppliers.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('cuentas_por_pagar'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'cuentas_por_pagar' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'cuentas_por_pagar' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'cuentas_por_pagar' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <Calendar size={16} /> Cuentas por Pagar (CxP) ({(scopedAccountsPayable || []).filter(d => d && !d.anulado).length})
        </button>

        <button
          onClick={() => { setActiveSubTab('pagos_abonos'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'pagos_abonos' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'pagos_abonos' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'pagos_abonos' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <CreditCard size={16} /> Historial de Pagos ({scopedSupplierPayments.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('ordenes_pago'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'ordenes_pago' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'ordenes_pago' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'ordenes_pago' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <FileCheck size={16} /> Órdenes de Pago ({scopedPaymentOrders.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('beneficiarios'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'beneficiarios' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'beneficiarios' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'beneficiarios' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer'
          }}
        >
          <Users size={16} /> Beneficiarios ({profitBeneficiaries.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('requisiciones'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'requisiciones' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.05rem',
            background: activeSubTab === 'requisiciones' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'requisiciones' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          <FileText size={15} /> Requisiciones ({scopedPurchaseRequisitions.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('ordenes_compra'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'ordenes_compra' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.05rem',
            background: activeSubTab === 'ordenes_compra' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'ordenes_compra' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          <ShoppingBag size={15} /> Órdenes de Compra ({scopedPurchaseOrders.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('recepciones'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'recepciones' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.05rem',
            background: activeSubTab === 'recepciones' ? 'var(--motorven-navy)' : 'transparent',
            color: activeSubTab === 'recepciones' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          <Warehouse size={15} /> Recepciones ({scopedGoodsReceiptNotes.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('registro_seniat'); setStatusFilter('TODOS'); }}
          className={`tab-btn ${activeSubTab === 'registro_seniat' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.65rem 1.15rem',
            background: activeSubTab === 'registro_seniat' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'rgba(16, 185, 129, 0.15)',
            color: activeSubTab === 'registro_seniat' ? '#ffffff' : 'var(--motorven-emerald)',
            border: activeSubTab === 'registro_seniat' ? 'none' : '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '8px 8px 0 0',
            fontWeight: 800,
            fontSize: '0.84rem',
            cursor: 'pointer',
            boxShadow: activeSubTab === 'registro_seniat' ? '0 2px 8px rgba(5, 150, 105, 0.4)' : 'none'
          }}
        >
          <Plus size={16} strokeWidth={2.5} /> + Cargar Mercancía / SENIAT
        </button>
      </div>

      {/* FILTROS Y BÚSQUEDA (Para subtabs con listas) */}
      {activeSubTab !== 'registro_seniat' && (
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
          <div className="search-wrapper" style={{ flex: 1, minWidth: '240px', maxWidth: '400px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por número, proveedor o RIF..."
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.84rem', height: '36px' }}
            />
          </div>

          {activeSubTab !== 'proveedores' && (
            <DatePeriodFilter value={datePeriodFilter} onChange={setDatePeriodFilter} compact />
          )}

          {activeSubTab === 'facturas_profit' && (
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setActiveSubTab('registro_seniat');
                  setStatusFilter('TODOS');
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  height: '36px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                  border: 'none',
                  borderRadius: '8px'
                }}
                title="Cargar factura del proveedor e ingresar mercancía al inventario (Alm 01 / Alm 02)"
              >
                <Plus size={15} strokeWidth={2.5} /> + Nueva Compra
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Estado:</span>
              <select
                className="form-control filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ fontSize: '0.82rem', height: '36px', minWidth: '160px', width: 'auto' }}
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="PAGADA">Pagadas</option>
                <option value="SALDO_PENDIENTE">Saldo Pendiente</option>
                <option value="ANULADA">Anuladas</option>
              </select>
            </div>
          )}

          {activeSubTab === 'cuentas_por_pagar' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Vencimiento:</span>
              <select
                className="form-control filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ fontSize: '0.82rem', height: '36px', minWidth: '170px', width: 'auto' }}
              >
                <option value="TODOS">Todos los Documentos</option>
                <option value="VENCIDA">Vencidas (Expiradas)</option>
                <option value="AL_DIA">Al Día (Por Vencer)</option>
                <option value="PAGADA">Totalmente Solventes</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* 1. SUB-TAB: FACTURAS DE COMPRA PROFIT */}
      {activeSubTab === 'facturas_profit' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>N° FACTURA</th>
                  <th>PROVEEDOR</th>
                  <th>FECHA EMISIÓN</th>
                  <th>FECHA VENCIMIENTO</th>
                  <th style={{ textAlign: 'right' }}>TOTAL ($ USD)</th>
                  <th style={{ textAlign: 'right' }}>TOTAL (BS.)</th>
                  <th style={{ textAlign: 'right' }}>SALDO ($ USD)</th>
                  <th style={{ textAlign: 'center' }}>ESTADO</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length > 0 ? (
                  filteredPurchases.map((purchase) => {
                    const isPagada = purchase.status === 'PAGADA';
                    const isAnulada = purchase.status === 'ANULADA';
                    return (
                      <tr key={purchase.id} onClick={() => setSelectedProfitPurchase(purchase)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-code)' }}>
                            #{purchase.factNum}
                          </div>
                          {purchase.facturaProv && purchase.facturaProv !== purchase.factNum && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Prov: {purchase.facturaProv}
                            </div>
                          )}
                          {(purchase.nroControl || purchase.numeroControl) && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                              Ctrl: {purchase.nroControl || purchase.numeroControl}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            {purchase.provNombre}
                          </div>
                          <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                            RIF: {purchase.provRif || 'N/A'}
                          </div>
                        </td>
                        <td>{purchase.fechaEmision ? new Date(purchase.fechaEmision).toLocaleDateString('es-VE') : '-'}</td>
                        <td>{purchase.fechaVencimiento ? new Date(purchase.fechaVencimiento).toLocaleDateString('es-VE') : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)' }}>
                          {formatUsd(purchase.totNetoUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                          {formatBs(purchase.totNetoBs)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: purchase.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                          {formatUsd(purchase.saldoUsd)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${isPagada ? 'badge-success' : isAnulada ? 'badge-danger' : 'badge-warning'}`}
                            style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                          >
                            {purchase.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProfitPurchase(purchase);
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={13} /> Ver Detalle
                            </button>
                            {onUpdatePurchase && (purchase.localRecord || purchase.compraId || String(purchase.id || '').startsWith('COMP-')) && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const editTarget = purchase.localRecord
                                    ? { ...purchase.localRecord, profitPurchaseId: purchase.id }
                                    : {
                                        ...purchase,
                                        id: purchase.compraId || purchase.id,
                                        profitPurchaseId: purchase.id,
                                        numeroFacturaProv: purchase.facturaProv || purchase.factNum,
                                        numeroControl: purchase.nroControl || purchase.numeroControl || '',
                                        fecha: purchase.fechaEmision,
                                        proveedorId: purchase.coProv,
                                        proveedorNombre: purchase.provNombre,
                                        proveedorRif: purchase.provRif,
                                        subtotalUsd: purchase.totBrutoUsd,
                                        ivaGeneralUsd: purchase.ivaUsd,
                                        totalUsd: purchase.totNetoUsd,
                                        totalBs: purchase.totNetoBs
                                      };
                                  handleStartEditPurchase(editTarget);
                                  setActiveSubTab('registro_seniat');
                                  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.73rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  background: 'rgba(217, 119, 6, 0.15)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(217, 119, 6, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                                title="Editar factura, cantidades, costos o almacén (actualiza inventario y CxP)"
                              >
                                <Edit3 size={12} /> Editar
                              </button>
                            )}
                            {onDeletePurchase && (purchase.localRecord || purchase.compraId || String(purchase.id || '').startsWith('COMP-')) && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePurchaseRecord(
                                    purchase.localRecord
                                      ? { ...purchase.localRecord, profitPurchaseId: purchase.id }
                                      : {
                                          ...purchase,
                                          id: purchase.compraId || purchase.id,
                                          profitPurchaseId: purchase.id,
                                          numeroFacturaProv: purchase.facturaProv || purchase.factNum,
                                          numeroControl: purchase.nroControl || purchase.numeroControl || '',
                                          proveedorNombre: purchase.provNombre,
                                          proveedorRif: purchase.provRif,
                                          totalUsd: purchase.totNetoUsd
                                        }
                                  );
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.73rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                                title="Eliminar registro de compra y revertir inventario/CxP"
                              >
                                <Trash2 size={12} /> Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No se encontraron facturas de compra con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SUB-TAB: DIRECTORIO DE PROVEEDORES PROFIT */}
      {activeSubTab === 'proveedores_profit' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="card"
              onClick={() => setSelectedProfitSupplier(supplier)}
              style={{
                cursor: 'pointer',
                borderRadius: '14px',
                border: '1px solid var(--border-glass)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span
                    className={`badge ${supplier.inactivo ? 'badge-danger' : 'badge-success'}`}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {supplier.inactivo ? 'INACTIVO' : 'ACTIVO'}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                    Cód: {supplier.coProv}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                  {supplier.provDes}
                </h3>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  RIF: {supplier.rif}
                </div>

                <div style={{ background: 'var(--surface-input, rgba(0, 43, 122, 0.03))', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-glass)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Saldo Pendiente:</span>
                    <strong style={{ fontFamily: 'var(--font-tech)', color: supplier.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                      {formatUsd(supplier.saldoUsd)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Límite de Crédito:</span>
                    <span style={{ fontFamily: 'var(--font-tech)' }}>{formatUsd(supplier.limiteCredito)}</span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProfitSupplier(supplier);
                }}
              >
                <Eye size={14} /> Ver Perfil & Facturas
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 3. SUB-TAB: CUENTAS POR PAGAR (CxP) */}
      {activeSubTab === 'cuentas_por_pagar' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>TIPO</th>
                  <th>N° DOCUMENTO</th>
                  <th>PROVEEDOR</th>
                  <th>FECHA EMISIÓN</th>
                  <th>FECHA VENCIMIENTO</th>
                  <th style={{ textAlign: 'right' }}>MONTO NETO ($)</th>
                  <th style={{ textAlign: 'right' }}>SALDO PENDIENTE ($)</th>
                  <th style={{ textAlign: 'right' }}>SALDO (BS.)</th>
                  <th style={{ textAlign: 'center' }}>VENCIMIENTO</th>
                  {onOpenCxpModule && <th style={{ textAlign: 'center' }}>ACCIÓN</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCxP.length > 0 ? (
                  filteredCxP.map((doc) => {
                    const now = new Date();
                    const isVencido = doc.fechaVencimiento && new Date(doc.fechaVencimiento) < now && doc.saldoUsd > 0.01;
                    const isSolvente = doc.saldoUsd <= 0.01;

                    return (
                      <tr key={doc.id}>
                        <td><span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{doc.tipoDoc}</span></td>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)' }}>{doc.nroDoc}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{doc.provNombre}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RIF: {doc.provRif || doc.coProv}</div>
                        </td>
                        <td>{doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString('es-VE') : '-'}</td>
                        <td>{doc.fechaVencimiento ? new Date(doc.fechaVencimiento).toLocaleDateString('es-VE') : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-tech)' }}>{formatUsd(doc.montoNetUsd)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: doc.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                          {formatUsd(doc.saldoUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                          {formatBs(doc.saldoBs)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${isSolvente ? 'badge-success' : isVencido ? 'badge-danger' : 'badge-warning'}`}
                            style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                          >
                            {isSolvente ? 'SOLVENTE' : isVencido ? 'VENCIDA' : 'AL DÍA'}
                          </span>
                        </td>
                        {onOpenCxpModule && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`btn ${isSolvente ? 'btn-secondary' : 'btn-primary'}`}
                              style={{ padding: '0.28rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}
                              onClick={() => onOpenCxpModule(doc)}
                              title="Gestionar / Registrar pago en módulo CxP"
                            >
                              {isSolvente ? 'Ver en CxP' : 'Pagar en CxP'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={onOpenCxpModule ? 10 : 9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No se encontraron documentos CxP con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB: HISTORIAL DE PAGOS A PROVEEDORES */}
      {activeSubTab === 'pagos_abonos' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>N° RECIBO / PAGO</th>
                  <th>FECHA PAGO</th>
                  <th>PROVEEDOR</th>
                  <th>DESCRIPCIÓN / CONCEPTO</th>
                  <th style={{ textAlign: 'right' }}>MONTO ($ USD)</th>
                  <th style={{ textAlign: 'right' }}>MONTO (BS.)</th>
                  <th style={{ textAlign: 'center' }}>CLASIFICACIÓN TASA</th>
                  <th style={{ textAlign: 'right' }}>TASA DEL PAGO</th>
                  <th style={{ textAlign: 'center' }}>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((p) => {
                    const pRateType = resolveRecordRateType(p, 'BCV');
                    const pRateMeta = resolveRateMeta(pRateType, 'BCV');
                    const pTasa = resolveEffectiveRateNumber(p, 0);
                    return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-navy-light)' }}>
                        #{p.pagoNum}
                      </td>
                      <td>{p.fechaPago ? new Date(p.fechaPago).toLocaleDateString('es-VE') : '-'}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.provNombre}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RIF: {p.provRif || p.coProv}</div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
                        {p.descrip || 'Abono a Facturas de Compra'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                        {formatUsd(p.montoUsd)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                        {pRateType === 'USD' && !(Number(p.montoBs) > 0) ? 'Divisa USD' : formatBs(p.montoBs)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.16rem 0.48rem',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-code)',
                          background: pRateMeta.bg,
                          color: pRateMeta.color,
                          border: `1px solid ${pRateMeta.border}`
                        }}>
                          {pRateMeta.badgeText}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>
                        {pRateType === 'USD' ? 'Divisa USD' : (pTasa > 0 ? formatBs(pTasa) : '—')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${p.anulado ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.68rem' }}>
                          {p.anulado ? 'ANULADO' : 'PROCESADO'}
                        </span>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No hay registros de pagos y abonos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4b. SUB-TAB: ÓRDENES DE PAGO PROFIT */}
      {activeSubTab === 'ordenes_pago' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Emisión, autorización y comprobante PDF institucional de Órdenes de Pago.
            </span>
            {onSavePaymentOrder && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowNewOpForm((v) => !v)}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={14} /> {showNewOpForm ? 'Cerrar Formulario' : 'Nueva Orden de Pago'}
              </button>
            )}
          </div>

          {showNewOpForm && onSavePaymentOrder && (
            <form
              className="card"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!opBeneficiary.trim() || Number(opAmountBs) <= 0) return;
                const saved = await onSavePaymentOrder({
                  benDes: opBeneficiary.trim(),
                  codBen: opBeneficiary.trim().slice(0, 8).toUpperCase(),
                  descrip: opMotivo.trim() || 'Pago autorizado de obligaciones / servicios',
                  monto: Number(opAmountBs || 0),
                  montoRet: Number(opRetBs || 0),
                  formaPag: opFormaPag,
                  codCta: opCuenta.trim(),
                  tasa: Number(config?.tasaDolar || 1),
                  moneda: 'BS'
                });
                setShowNewOpForm(false);
                setOpBeneficiary('');
                setOpAmountBs('');
                setOpRetBs('0');
                setOpMotivo('');
                setOpCuenta('');
                generatePaymentOrderPDF({ paymentOrder: saved, config, currentUser });
              }}
              style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem', alignItems: 'end', borderRadius: '14px' }}
            >
              <div>
                <label className="form-label">Beneficiario</label>
                <input type="text" className="input-field" value={opBeneficiary} onChange={(e) => setOpBeneficiary(e.target.value)} required placeholder="Nombre / Razón social" list="op-ben-list" />
                <datalist id="op-ben-list">
                  {[...(profitBeneficiaries || []), ...(profitSuppliers || [])].slice(0, 80).map((b, i) => (
                    <option key={b.id || i} value={b.benDes || b.provDes || b.nombre || ''} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="form-label">Monto Total (Bs.)</label>
                <input type="number" step="0.01" min="0.01" className="input-field" value={opAmountBs} onChange={(e) => setOpAmountBs(e.target.value)} required placeholder="0.00" />
              </div>
              <div>
                <label className="form-label">Retención (Bs.)</label>
                <input type="number" step="0.01" min="0" className="input-field" value={opRetBs} onChange={(e) => setOpRetBs(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Forma de Pago / Cuenta</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <select className="input-field" value={opFormaPag} onChange={(e) => setOpFormaPag(e.target.value)} style={{ flex: 1 }}>
                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                    <option value="ZELLE">ZELLE</option>
                    <option value="EFECTIVO USD">EFECTIVO USD</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                  <input type="text" className="input-field" value={opCuenta} onChange={(e) => setOpCuenta(e.target.value)} placeholder="Cuenta" style={{ width: '90px' }} />
                </div>
              </div>
              <div>
                <label className="form-label">Concepto / Motivo</label>
                <input type="text" className="input-field" value={opMotivo} onChange={(e) => setOpMotivo(e.target.value)} placeholder="Factura / Servicio" />
              </div>
              <div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                  Emitir & PDF
                </button>
              </div>
            </form>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th>N° ORDEN</th>
                    <th>FECHA</th>
                    <th>BENEFICIARIO</th>
                    <th>CONCEPTO / MOTIVO</th>
                    <th>FORMA DE PAGO</th>
                    <th style={{ textAlign: 'right' }}>MONTO</th>
                    <th style={{ textAlign: 'right' }}>RETENCIÓN</th>
                    <th style={{ textAlign: 'center' }}>ESTADO / PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentOrders.length > 0 ? (
                    filteredPaymentOrders.map((o) => (
                      <tr key={o.id || o.ordNum}>
                        <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-navy-light)' }}>
                          #{o.ordNum}
                        </td>
                        <td>{o.fecha ? new Date(o.fecha).toLocaleDateString('es-VE') : '-'}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{o.benDes || o.benNombre || 'Beneficiario'}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cód: {o.codBen}</div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
                          {o.descrip || o.motivo || 'Orden de pago emitida'}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                            {o.formaPag || 'TRANSFERENCIA'}
                          </span>
                          {o.codCta && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Cta: {o.codCta}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                          {formatBs(o.monto)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                          {formatBs(o.montoRet)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`badge ${o.anulada ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.68rem' }}>
                              {o.anulada ? 'ANULADA' : 'EMITIDA'}
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 7px', fontSize: '0.7rem' }}
                              onClick={() => generatePaymentOrderPDF({ paymentOrder: o, config, currentUser })}
                              title="Imprimir Orden de Pago oficial PDF"
                            >
                              <Printer size={12} /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No hay órdenes de pago registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4d. SUB-TAB: REQUISICIONES INTERNAS DE COMPRA (REQ) */}
      {activeSubTab === 'requisiciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!onSaveRequisition || !reqSku || Number(reqQty) <= 0) return;
              const prod = products.find(p => String(p.codigo || p.id) === reqSku) || {};
              const estCost = Number(prod.costoUnitarioUsd || prod.costoUsd || prod.precioUsd || 0);
              const saved = await onSaveRequisition({
                solicitante: currentUser?.nombre || currentUser?.username || 'Gerencia',
                departamento: reqDept,
                prioridad: reqPriority,
                estado: 'APROBADA',
                observaciones: reqReason,
                items: [{
                  codigo: prod.codigo || reqSku,
                  descripcion: prod.descripcion || reqSku,
                  cantidad: Number(reqQty || 1),
                  unidad: prod.unidad || 'Caja',
                  costoEstimadoUsd: estCost
                }]
              });
              generatePurchaseRequisitionPDF({ requisition: saved, config, currentUser });
            }}
            style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem', alignItems: 'end', borderRadius: '14px' }}
          >
            <div>
              <label className="form-label">Artículo / SKU Solicitado</label>
              <select className="input-field" value={reqSku} onChange={(e) => setReqSku(e.target.value)} required>
                <option value="">-- Seleccionar producto --</option>
                {products.map((p) => (
                  <option key={p.id || p.codigo} value={p.codigo || p.id}>
                    {p.codigo} - {p.descripcion} (Stock: {p.stock || 0})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Cantidad</label>
              <input type="number" min="1" step="1" className="input-field" value={reqQty} onChange={(e) => setReqQty(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Departamento / Prioridad</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="text" className="input-field" value={reqDept} onChange={(e) => setReqDept(e.target.value)} style={{ flex: 1 }} />
                <select className="input-field" value={reqPriority} onChange={(e) => setReqPriority(e.target.value)} style={{ width: '95px' }}>
                  <option value="NORMAL">Normal</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Justificación</label>
              <input type="text" className="input-field" value={reqReason} onChange={(e) => setReqReason(e.target.value)} />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                Crear Requisición & PDF
              </button>
            </div>
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '14px' }}>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th>N° REQ</th>
                    <th>FECHA</th>
                    <th>DEPARTAMENTO</th>
                    <th>SOLICITANTE</th>
                    <th>ARTÍCULOS</th>
                    <th>PRIORIDAD</th>
                    <th style={{ textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedPurchaseRequisitions.length > 0 ? scopedPurchaseRequisitions.map((r) => (
                    <tr key={r.id || r.numeroDoc}>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-navy-light)' }}>{r.numeroDoc}</td>
                      <td>{r.fecha ? new Date(r.fecha).toLocaleDateString('es-VE') : '-'}</td>
                      <td>{r.departamento}</td>
                      <td>{r.solicitante}</td>
                      <td>{(r.items || []).map(it => `${it.codigo} (${it.cantidad})`).join(', ')}</td>
                      <td><span className={`badge ${r.prioridad === 'URGENTE' ? 'badge-danger' : 'badge-info'}`}>{r.prioridad || 'NORMAL'}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => generatePurchaseRequisitionPDF({ requisition: r, config, currentUser })}>
                            <Printer size={12} /> PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              const first = r.items?.[0];
                              if (first) {
                                setPoSku(first.codigo || '');
                                setPoQty(first.cantidad || 1);
                                setPoUnitCostUsd(first.costoEstimadoUsd || 25);
                              }
                              setPoReqRef(r.numeroDoc || '');
                              setActiveSubTab('ordenes_compra');
                            }}
                          >
                            Generar OC ➔
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay requisiciones registradas aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4e. SUB-TAB: ÓRDENES DE COMPRA A PROVEEDORES (OC) */}
      {activeSubTab === 'ordenes_compra' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!onSavePurchaseOrder || !poSku || Number(poQty) <= 0) return;
              const supList = profitSuppliers.length > 0 ? profitSuppliers : suppliers;
              const sup = supList.find(s => String(s.coProv || s.id || s.rif) === poSupplierCode) || supList[0] || {};
              const prod = products.find(p => String(p.codigo || p.id) === poSku) || {};
              const qty = Number(poQty || 1);
              const cost = Number(poUnitCostUsd || 0);
              const subUsd = Number((qty * cost).toFixed(2));
              const ivaUsd = Number((subUsd * 0.16).toFixed(2));
              const totUsd = Number((subUsd + ivaUsd).toFixed(2));
              const saved = await onSavePurchaseOrder({
                proveedorCodigo: sup.coProv || sup.id || '',
                proveedorNombre: sup.provDes || sup.nombre || 'Proveedor',
                proveedorRif: sup.rif || 'N/A',
                condicionPago: poPaymentTerm,
                requisicionOrigen: poReqRef,
                observaciones: poNotes,
                subtotalUsd: subUsd,
                ivaUsd,
                totalUsd: totUsd,
                tasaDolar: Number(config?.tasaDolar || 1),
                estado: 'EMITIDA',
                items: [{
                  codigo: prod.codigo || poSku,
                  descripcion: prod.descripcion || poSku,
                  cantidad: qty,
                  unidad: prod.unidad || 'Caja',
                  costoUnitUsd: cost,
                  totalUsd: subUsd
                }]
              });
              setPoReqRef('');
              generatePurchaseOrderPDF({ order: saved, supplier: sup, config, currentUser });
            }}
            style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '0.75rem', alignItems: 'end', borderRadius: '14px' }}
          >
            <div>
              <label className="form-label">Proveedor</label>
              <select className="input-field" value={poSupplierCode} onChange={(e) => setPoSupplierCode(e.target.value)}>
                <option value="">-- Seleccionar proveedor --</option>
                {(unifiedSuppliers).map((s) => (
                  <option key={s.id || s.coProv} value={String(s.coProv || s.id || s.rif)}>
                    {s.provDes || s.nombre} ({s.rif})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Producto / SKU</label>
              <select className="input-field" value={poSku} onChange={(e) => setPoSku(e.target.value)} required>
                <option value="">-- Seleccionar artículo --</option>
                {products.map((p) => (
                  <option key={p.id || p.codigo} value={p.codigo || p.id}>{p.codigo} - {p.descripcion}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Cant. / Costo Unit ($)</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" min="1" className="input-field" value={poQty} onChange={(e) => setPoQty(e.target.value)} required style={{ width: '75px' }} />
                <input type="number" min="0.01" step="0.01" className="input-field" value={poUnitCostUsd} onChange={(e) => setPoUnitCostUsd(e.target.value)} required style={{ flex: 1 }} />
              </div>
            </div>
            <div>
              <label className="form-label">Condición / Req Ref</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="text" className="input-field" value={poPaymentTerm} onChange={(e) => setPoPaymentTerm(e.target.value)} style={{ flex: 1 }} />
                <input type="text" className="input-field" value={poReqRef} onChange={(e) => setPoReqRef(e.target.value)} placeholder="REQ-..." style={{ width: '85px' }} />
              </div>
            </div>
            <div>
              <label className="form-label">Observaciones</label>
              <input type="text" className="input-field" value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="Entrega en planta" />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                Emitir OC & PDF
              </button>
            </div>
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '14px' }}>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th>N° OC</th>
                    <th>FECHA</th>
                    <th>PROVEEDOR</th>
                    <th>ARTÍCULOS</th>
                    <th style={{ textAlign: 'right' }}>TOTAL ($)</th>
                    <th style={{ textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedPurchaseOrders.length > 0 ? scopedPurchaseOrders.map((po) => (
                    <tr key={po.id || po.numeroDoc}>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-navy-light)' }}>{po.numeroDoc}</td>
                      <td>{po.fecha ? new Date(po.fecha).toLocaleDateString('es-VE') : '-'}</td>
                      <td>{po.proveedorNombre} <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{po.proveedorRif}</div></td>
                      <td>{(po.items || []).map(it => `${it.codigo} x${it.cantidad}`).join(', ')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatUsd(po.totalUsd)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => generatePurchaseOrderPDF({ order: po, config, currentUser })}>
                            <Printer size={12} /> OC PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              const items = Array.isArray(po.items) ? po.items : [];
                              const first = items[0];
                              setRecOrderNum(po.numeroDoc || '');
                              setRecSupplierName(po.proveedorNombre || '');
                              setRecItems(items.map((it) => ({
                                codigo: it.codigo || '',
                                descripcion: it.descripcion || it.codigo || '',
                                cantidadEsperada: Number(it.cantidad || 1),
                                cantidadRecibida: Number(it.cantidad || 1),
                                cantidadDanada: 0,
                                unidad: it.unidad || 'Caja'
                              })));
                              if (first) {
                                setRecSku(first.codigo || '');
                                setRecExpectedQty(first.cantidad || 1);
                                setRecReceivedQty(first.cantidad || 1);
                              }
                              setActiveSubTab('recepciones');
                            }}
                          >
                            Registrar Recepción ➔
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay órdenes de compra emitidas aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4f. SUB-TAB: NOTAS DE RECEPCIÓN DE MERCANCÍA (REC) */}
      {activeSubTab === 'recepciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!onSaveGoodsReceipt) return;
              const itemsPayload = recItems.length > 0
                ? recItems
                : (() => {
                    if (!recSku || Number(recReceivedQty) < 0) return [];
                    const prod = products.find(p => String(p.codigo || p.id) === recSku) || {};
                    return [{
                      codigo: prod.codigo || recSku,
                      descripcion: prod.descripcion || recSku,
                      cantidadEsperada: Number(recExpectedQty || 0),
                      cantidadRecibida: Number(recReceivedQty || 0),
                      cantidadDanada: Number(recDamagedQty || 0),
                      unidad: prod.unidad || 'Caja'
                    }];
                  })();
              if (itemsPayload.length === 0) return;

              const saved = await onSaveGoodsReceipt({
                ordenCompraRef: recOrderNum.trim(),
                nroFactura: recInvoiceNum.trim(),
                proveedorNombre: recSupplierName.trim() || 'Proveedor General',
                almacen: recWarehouse,
                observaciones: recNotes.trim(),
                applyStock: true,
                items: itemsPayload
              });
              setRecItems([]);
              generateGoodsReceiptPDF({ receipt: saved, config, currentUser });
            }}
            style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '0.75rem', alignItems: 'end', borderRadius: '14px' }}
          >
            <div>
              <label className="form-label">OC / Factura Prov.</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="text" className="input-field" value={recOrderNum} onChange={(e) => setRecOrderNum(e.target.value)} placeholder="OC-..." style={{ width: '50%' }} />
                <input type="text" className="input-field" value={recInvoiceNum} onChange={(e) => setRecInvoiceNum(e.target.value)} placeholder="FAC-..." style={{ width: '50%' }} />
              </div>
            </div>
            <div>
              <label className="form-label">Proveedor</label>
              <input type="text" className="input-field" value={recSupplierName} onChange={(e) => setRecSupplierName(e.target.value)} placeholder="Nombre proveedor" />
            </div>
            <div>
              <label className="form-label">Artículo Recibido {recItems.length > 1 ? `(${recItems.length} renglones)` : ''}</label>
              <select className="input-field" value={recSku} onChange={(e) => setRecSku(e.target.value)} required={recItems.length === 0}>
                <option value="">-- Seleccionar SKU --</option>
                {products.map((p) => (
                  <option key={p.id || p.codigo} value={p.codigo || p.id}>{p.codigo} - {p.descripcion}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Esp. / Rec. / Dañ.</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" min="0" className="input-field" value={recExpectedQty} onChange={(e) => setRecExpectedQty(e.target.value)} title="Esperado" style={{ width: '33%' }} />
                <input type="number" min="0" className="input-field" value={recReceivedQty} onChange={(e) => setRecReceivedQty(e.target.value)} required={recItems.length === 0} title="Recibido conforme" style={{ width: '34%' }} />
                <input type="number" min="0" className="input-field" value={recDamagedQty} onChange={(e) => setRecDamagedQty(e.target.value)} title="Dañado" style={{ width: '33%' }} />
              </div>
            </div>
            <div>
              <label className="form-label">Almacén / Notas</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select className="input-field" value={recWarehouse} onChange={(e) => setRecWarehouse(e.target.value)} style={{ width: '85px' }}>
                  <option value="01">Alm 01</option>
                  <option value="02">Alm 02</option>
                </select>
                <input type="text" className="input-field" value={recNotes} onChange={(e) => setRecNotes(e.target.value)} placeholder="Notas" style={{ flex: 1 }} />
              </div>
            </div>
            <div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                Recibir Stock & PDF
              </button>
            </div>
            {recItems.length > 0 && (
              <div style={{ gridColumn: '1 / -1', background: 'rgba(15, 23, 42, 0.04)', borderRadius: '10px', padding: '0.65rem', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                  <span>Renglones cargados desde Orden de Compra ({recItems.length}):</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRecItems([])}>Limpiar lista</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {recItems.map((rit, idx) => (
                    <div key={`${rit.codigo}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px', gap: '6px', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span><strong>{rit.codigo}</strong> - {rit.descripcion}</span>
                      <span style={{ color: 'var(--text-muted)' }}>Esp: {rit.cantidadEsperada}</span>
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        value={rit.cantidadRecibida}
                        onChange={(e) => setRecItems(prev => prev.map((x, i) => i === idx ? { ...x, cantidadRecibida: Number(e.target.value || 0) } : x))}
                        title="Recibido"
                      />
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        value={rit.cantidadDanada}
                        onChange={(e) => setRecItems(prev => prev.map((x, i) => i === idx ? { ...x, cantidadDanada: Number(e.target.value || 0) } : x))}
                        title="Dañado"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>

          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '14px' }}>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th>N° RECEPCIÓN</th>
                    <th>FECHA</th>
                    <th>PROVEEDOR / REF</th>
                    <th>ALMACÉN</th>
                    <th>RENGLONES</th>
                    <th style={{ textAlign: 'center' }}>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedGoodsReceiptNotes.length > 0 ? scopedGoodsReceiptNotes.map((rec) => (
                    <tr key={rec.id || rec.numeroDoc}>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-emerald)' }}>{rec.not_num || rec.numeroDoc}</td>
                      <td>{rec.fec_emis ? new Date(rec.fec_emis).toLocaleDateString('es-VE') : '-'}</td>
                      <td>{rec.prov_des || rec.proveedorNombre} <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fact: {rec.nro_fact || rec.ordenCompraRef || 'S/N'}</div></td>
                      <td><span className="badge badge-info">Alm {rec.almacen || '01'}</span></td>
                      <td>{rec.items?.length ? rec.items.map(it => `${it.codigo} (+${it.cantidadRecibida})`).join(', ') : `${rec.items_count || 1} items`}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => generateGoodsReceiptPDF({ receipt: rec, config, currentUser })}>
                          <Printer size={12} /> Recepción PDF
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay notas de recepción registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4c. SUB-TAB: DIRECTORIO DE BENEFICIARIOS */}
      {activeSubTab === 'beneficiarios' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-glass)', borderRadius: '14px' }}>
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>CÓDIGO</th>
                  <th>NOMBRE / RAZÓN SOCIAL</th>
                  <th>RIF / IDENTIFICACIÓN</th>
                  <th>TIPO PERSONA</th>
                  <th>TELÉFONO</th>
                  <th>DIRECCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeneficiaries.length > 0 ? (
                  filteredBeneficiaries.map((b) => (
                    <tr key={b.id || b.codBen}>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--accent-primary)' }}>
                        {b.codBen}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {b.benDes}
                      </td>
                      <td style={{ fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>
                        {b.rif || 'Sin RIF'}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          {b.tipoPer === 'J' ? 'Jurídica' : b.tipoPer === 'N' ? 'Natural' : (b.tipoPer || 'General')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {b.telefono || 'No registrado'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                        {b.direc1 || 'Sin dirección registrada'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No se encontraron beneficiarios con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB: CARGA SENIAT & RETENCIONES (ORIGINAL VIEW ENHANCED) */}
      {activeSubTab === 'registro_seniat' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
            {/* Formulario de Carga de Mercancía con Cumplimiento Fiscal */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="var(--accent-primary)" /> {editingPurchaseId ? 'Editar Carga Fiscal SENIAT' : 'Registrar Recepción de Mercancía'}
                </h3>
                {editingPurchaseId && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                      Editando: {editingPurchaseOriginal?.numeroFacturaProv || editingPurchaseId}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleCancelEditPurchase}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', padding: '3px 8px' }}
                    >
                      <X size={12} /> Cancelar Edición
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleRegisterPurchase}>
                {/* Proveedor */}
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Proveedor Seleccionado</label>
                    {selectedSupplier && (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: rifValidation.isValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: rifValidation.isValid ? 'var(--motorven-emerald)' : 'var(--motorven-red)',
                        fontWeight: 700
                      }}>
                        {rifValidation.isValid ? '✓ RIF SENIAT Válido' : '⚠ RIF Inválido'}
                      </span>
                    )}
                  </div>
                  <select
                    className="form-control"
                    value={selectedSupplier?.id || ''}
                    onChange={(e) => {
                      const sup = unifiedSuppliers.find(s => String(s.id) === String(e.target.value));
                      setSelectedSupplier(sup || null);
                      if (sup) {
                        setDiasCredito(Number(sup.diasCredito ?? 30));
                      }
                    }}
                  >
                    {unifiedSuppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre || s.provDes} ({s.rif})</option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Documento */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo de Documento</label>
                    <select
                      className="form-control"
                      value={tipoDoc}
                      onChange={(e) => {
                        const nextTipo = e.target.value;
                        setTipoDoc(nextTipo);
                        if (nextTipo === 'NOTA_ENTREGA') {
                          setTipoAlicuota('EXENTO_0');
                          setPorcentajeRetIva(0);
                          setPorcentajeRetIslr(0);
                          setAlmacenDestino('02');
                        }
                      }}
                    >
                      <option value="FACTURA">Factura de Compra</option>
                      <option value="NOTA_ENTREGA">Nota de Entrega (No Fiscal / Sin IVA)</option>
                      <option value="NOTA_CREDITO">Nota de Crédito (Devolución)</option>
                      <option value="NOTA_DEBITO">Nota de Débito</option>
                    </select>
                  </div>

                  {(tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') && (
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--motorven-red)' }}>Factura Afectada *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: FAC-PROV-9921"
                        value={documentoAfectado}
                        onChange={(e) => setDocumentoAfectado(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  )}
                </div>

                {/* N° Factura y Control */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">N° Factura Proveedor *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: FAC-PROV-9982"
                      value={numeroFacturaProv}
                      onChange={(e) => setNumeroFacturaProv(e.target.value.toUpperCase())}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">N° de Control (00-XXXXXX) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: 00-005822"
                      value={numeroControlProv}
                      onChange={(e) => setNumeroControlProv(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                </div>

                {/* Lubricante, Almacén y Alícuota */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: '1.4' }}>
                    <label className="form-label">Lubricante / Insumo</label>
                    <select
                      className="form-control"
                      value={selectedProduct?.id || ''}
                      onChange={(e) => {
                        const p = products.find(pr => pr.id === e.target.value);
                        if (p) {
                          setSelectedProduct(p);
                          setNuevoCostoUsd(p.costoUsd);
                        }
                      }}
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.codigo} - {p.descripcion}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: '1.2' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Warehouse size={13} color="var(--motorven-emerald)" /> Almacén Destino
                    </label>
                    <select
                      className="form-control"
                      value={almacenDestino}
                      onChange={(e) => setAlmacenDestino(e.target.value)}
                    >
                      <option value="01">Almacén 01 (Facturas Fiscales)</option>
                      <option value="02">Almacén 02 (Notas de Entrega)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: '1' }}>
                    <label className="form-label">Alícuota IVA</label>
                    <select
                      className="form-control"
                      value={tipoAlicuota}
                      onChange={(e) => setTipoAlicuota(e.target.value)}
                    >
                      <option value="GENERAL_16">General (16%)</option>
                      <option value="REDUCIDA_8">Reducida (8%)</option>
                      <option value="EXENTO_0">Exento / No Sujeto (0%)</option>
                    </select>
                  </div>
                </div>

                {/* Cantidad y Costos */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Cantidad</label>
                    <input
                      type="number"
                      min={purchaseItems.length === 0 ? '1' : '0'}
                      step="any"
                      className="form-control"
                      value={cantidadRecibida}
                      onChange={(e) => setCantidadRecibida(e.target.value)}
                      required={purchaseItems.length === 0}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Costo Unit. Factura ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-control"
                      value={nuevoCostoUsd}
                      onChange={(e) => setNuevoCostoUsd(parseFloat(e.target.value) || 0)}
                      required={purchaseItems.length === 0}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Flete Prorrateado ($)</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-control"
                        value={fleteProrrateadoUsd}
                        onChange={(e) => setFleteProrrateadoUsd(parseFloat(e.target.value) || 0)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddPurchaseItem}
                        title="Agregar este producto como renglón a una compra multi-producto"
                        style={{ whiteSpace: 'nowrap', fontWeight: 700 }}
                      >
                        + Renglón
                      </button>
                    </div>
                  </div>
                </div>

                {purchaseItems.length > 0 && (
                  <div style={{ background: 'rgba(15, 23, 42, 0.04)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '0.65rem', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
                      <span>Renglones en esta factura ({purchaseItems.length}):</span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPurchaseItems([])}>Limpiar</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {purchaseItems.map((it, idx) => (
                        <div key={`${it.codigo}-${idx}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1.5fr) 74px 86px 76px auto auto', gap: '6px', alignItems: 'center', fontSize: '0.74rem', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: '6px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.descripcion || it.producto}>
                            <strong>{it.codigo}</strong> <span style={{ color: 'var(--text-muted)' }}>{it.descripcion || it.producto}</span>
                          </div>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="form-control"
                            style={{ padding: '3px 6px', fontSize: '0.74rem', textAlign: 'right' }}
                            value={it.cantidad}
                            title="Cantidad"
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              const nextQty = rawVal === '' ? '' : Math.max(0.01, Number(rawVal) || 0);
                              setPurchaseItems(prev => prev.map((row, i) => {
                                if (i !== idx) return row;
                                const unit = Number(row.costoUnitarioUsd || 0);
                                const flete = Number(row.fleteUsd || 0);
                                const calcQty = Number(nextQty || 0);
                                return {
                                  ...row,
                                  cantidad: nextQty,
                                  subtotalUsd: Number((calcQty * unit + flete).toFixed(2))
                                };
                              }));
                            }}
                            onBlur={() => {
                              setPurchaseItems(prev => prev.map((row, i) => {
                                if (i !== idx) return row;
                                const safeQty = Math.max(1, Number(row.cantidad) || 1);
                                const unit = Number(row.costoUnitarioUsd || 0);
                                const flete = Number(row.fleteUsd || 0);
                                return {
                                  ...row,
                                  cantidad: safeQty,
                                  subtotalUsd: Number((safeQty * unit + flete).toFixed(2))
                                };
                              }));
                            }}
                          />
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="form-control"
                            style={{ padding: '3px 6px', fontSize: '0.74rem', textAlign: 'right' }}
                            value={it.costoUnitarioUsd}
                            title="Costo Unit. ($)"
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              const nextCost = rawVal === '' ? '' : Math.max(0, Number(rawVal) || 0);
                              setPurchaseItems(prev => prev.map((row, i) => {
                                if (i !== idx) return row;
                                const qty = Number(row.cantidad || 1);
                                const flete = Number(row.fleteUsd || 0);
                                const calcCost = Number(nextCost || 0);
                                return {
                                  ...row,
                                  costoUnitarioUsd: nextCost,
                                  subtotalUsd: Number((qty * calcCost + flete).toFixed(2))
                                };
                              }));
                            }}
                            onBlur={() => {
                              setPurchaseItems(prev => prev.map((row, i) => {
                                if (i !== idx) return row;
                                const safeCost = Math.max(0, Number(row.costoUnitarioUsd) || 0);
                                const qty = Number(row.cantidad || 1);
                                const flete = Number(row.fleteUsd || 0);
                                return {
                                  ...row,
                                  costoUnitarioUsd: safeCost,
                                  subtotalUsd: Number((qty * safeCost + flete).toFixed(2))
                                };
                              }));
                            }}
                          />
                          <select
                            className="form-control"
                            style={{ padding: '3px 4px', fontSize: '0.72rem' }}
                            value={String(it.almacen || '01').includes('02') ? '02' : '01'}
                            title="Almacén"
                            onChange={(e) => {
                              const nextAlm = e.target.value;
                              setPurchaseItems(prev => prev.map((row, i) => (i === idx ? { ...row, almacen: nextAlm } : row)));
                            }}
                          >
                            <option value="01">Alm 01</option>
                            <option value="02">Alm 02</option>
                          </select>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' }}>{formatUsd(it.subtotalUsd)}</span>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPurchaseItems(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(scopedGoodsReceiptNotes) && scopedGoodsReceiptNotes.length > 0 && (
                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label className="form-label">Nota de Recepción Vinculada (Opcional — evita duplicar entrada de stock)</label>
                    <select className="form-control" value={linkedReceiptId} onChange={(e) => setLinkedReceiptId(e.target.value)}>
                      <option value="">-- Ninguna (sumar stock directamente con esta factura) --</option>
                      {scopedGoodsReceiptNotes.map(rec => (
                        <option key={rec.id || rec.numeroDoc} value={rec.id || rec.numeroDoc}>
                          {rec.numeroDoc || rec.not_num} • {rec.prov_des || rec.proveedorNombre || ''} {rec.stock_aplicado ? '(Stock ya ingresado)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Porcentajes */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">% Retención IVA</label>
                    <select
                      className="form-control"
                      value={porcentajeRetIva}
                      onChange={(e) => setPorcentajeRetIva(Number(e.target.value))}
                    >
                      <option value="75">75% (Contribuyente Especial)</option>
                      <option value="100">100% (No inscritos / Especiales)</option>
                      <option value="0">0% (Sin retención)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">% Retención ISLR</label>
                    <select
                      className="form-control"
                      value={porcentajeRetIslr}
                      onChange={(e) => setPorcentajeRetIslr(Number(e.target.value))}
                    >
                      <option value="2">2% (Bienes Muebles - Cód 055)</option>
                      <option value="5">5% (Servicios)</option>
                      <option value="0">0% (Exento)</option>
                    </select>
                  </div>
                </div>

                {/* Condición de Pago y Días de Crédito para CxP */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Condición de Pago (CxP)</label>
                    <select
                      className="form-control"
                      value={condicionPago}
                      onChange={(e) => setCondicionPago(e.target.value)}
                    >
                      <option value="CREDITO">Crédito (Genera Cuenta por Pagar)</option>
                      <option value="CONTADO">Contado (Cancelada de Inmediato)</option>
                    </select>
                  </div>

                  {condicionPago === 'CREDITO' && (
                    <div className="form-group">
                      <label className="form-label">Días de Crédito</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        className="form-control"
                        value={diasCredito}
                        onChange={(e) => setDiasCredito(parseInt(e.target.value, 10) || 0)}
                        required
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '0.75rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: editingPurchaseId ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined,
                      borderColor: editingPurchaseId ? '#10b981' : undefined
                    }}
                  >
                    {editingPurchaseId ? (
                      <>
                        <Save size={18} /> Guardar Cambios en Carga SENIAT
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} /> Cargar a Inventario & Generar Retención SENIAT
                      </>
                    )}
                  </button>
                  {editingPurchaseId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEditPurchase}
                      style={{ padding: '0.75rem 1rem' }}
                    >
                      <X size={16} /> Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Resumen Fiscal */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck size={18} /> Comprobante Fiscal & Retenciones
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ background: 'var(--surface-input, rgba(0, 43, 122, 0.03))', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N° Comprobante Retención IVA (14 Dígitos SENIAT):</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--motorven-navy-light)', fontFamily: 'var(--font-code)' }}>
                    {editingPurchaseOriginal?.numeroComprobanteRetencionIva || generateVatRetentionVoucherNumber(new Date(), displayPurchases.length + 1)}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-input, rgba(0, 43, 122, 0.03))', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Subtotal Base Imponible:</span>
                    <span>{formatUsd(subtotalUsd)} ({formatBs(subtotalUsd * config.tasaDolar)})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>IVA Causado ({tipoAlicuota === 'EXENTO_0' ? '0%' : (tipoAlicuota === 'REDUCIDA_8' ? '8%' : '16%')}):</span>
                    <span>{formatUsd(ivaCalculadoUsd)} ({formatBs(ivaCalculadoUsd * config.tasaDolar)})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', borderTop: '1px dashed var(--border-glass)', paddingTop: '4px' }}>
                    <span>Total Factura Compra:</span>
                    <span style={{ color: 'var(--motorven-emerald)' }}>{formatUsd(totalFacturaCalculadoUsd)} ({formatBs(totalFacturaCalculadoUsd * config.tasaDolar)})</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--motorven-emerald)' }}>Retención de IVA ({porcentajeRetIva}% a Enterar al SENIAT):</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--motorven-emerald)' }}>
                    {formatUsd(retencionIvaCalculadaUsd)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatBs(retencionIvaCalculadaUsd * config.tasaDolar)} al tipo de cambio BCV ({formatBs(config.tasaDolar)})
                  </div>
                </div>

                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)' }}>Retención de ISLR ({porcentajeRetIslr}% Cód. 055):</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                    {formatUsd(retencionIslrCalculadaUsd)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatBs(retencionIslrCalculadaUsd * config.tasaDolar)} al tipo de cambio BCV
                  </div>
                </div>

                <div style={{ background: 'rgba(217, 119, 6, 0.08)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)' }}>Neto a Pagar Proveedor (CxP tras retenciones):</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                    {formatUsd(netoPagarCalculadoUsd)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatBs(netoPagarCalculadoUsd * config.tasaDolar)} • {condicionPago === 'CREDITO' ? `Crédito a ${diasCredito} días` : 'Contado'}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Historial Local de Compras SENIAT */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--accent-primary)" /> Historial de Cargas Locales SENIAT
            </h3>

            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>N° Factura Prov.</th>
                    <th>N° Control</th>
                    <th>Tipo Doc</th>
                    <th>Proveedor</th>
                    <th>RIF</th>
                    <th>Total ($ / Bs)</th>
                    <th>Ret. IVA 75% (Bs.)</th>
                    <th>Ret. ISLR 2% (Bs.)</th>
                    <th>N° Comprobante Ret. IVA / PDF</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedDisplayPurchases.length > 0 ? scopedDisplayPurchases.map((rec) => {
                    const isEditingRow = inlineEditId === rec.id && inlineEditDraft;
                    const rowRate = Number(rec.tasaDolar || config?.tasaDolar || 1);
                    return (
                      <tr
                        key={rec.id}
                        style={isEditingRow ? { background: 'rgba(16, 185, 129, 0.06)' } : undefined}
                      >
                        <td>
                          {isEditingRow ? (
                            <input
                              type="date"
                              className="form-control"
                              style={{ padding: '3px 6px', fontSize: '0.75rem', minWidth: '122px' }}
                              value={inlineEditDraft.fecha || ''}
                              onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, fecha: e.target.value }))}
                            />
                          ) : (
                            rec.fecha ? new Date(rec.fecha).toLocaleDateString() : '-'
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '3px 6px', fontSize: '0.75rem', minWidth: '115px', fontWeight: 700 }}
                              value={inlineEditDraft.numeroFacturaProv || ''}
                              onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, numeroFacturaProv: e.target.value.toUpperCase() }))}
                            />
                          ) : (
                            <strong style={{ color: 'var(--accent-primary)' }}>{rec.numeroFacturaProv || rec.facturaProv}</strong>
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '3px 6px', fontSize: '0.75rem', width: '95px', fontFamily: 'monospace' }}
                              value={inlineEditDraft.numeroControl || ''}
                              onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, numeroControl: e.target.value.toUpperCase() }))}
                            />
                          ) : (
                            <span style={{ fontFamily: 'monospace' }}>{rec.numeroControl || '00-005821'}</span>
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <select
                              className="form-control"
                              style={{ padding: '3px 6px', fontSize: '0.74rem', minWidth: '105px' }}
                              value={inlineEditDraft.tipoDoc || 'FACTURA'}
                              onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, tipoDoc: e.target.value }))}
                            >
                              <option value="FACTURA">FACTURA</option>
                              <option value="NOTA_CREDITO">NOTA_CREDITO</option>
                              <option value="NOTA_DEBITO">NOTA_DEBITO</option>
                            </select>
                          ) : (
                            <span className="badge" style={{
                              background: rec.tipoDoc === 'NOTA_CREDITO' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: rec.tipoDoc === 'NOTA_CREDITO' ? 'var(--motorven-red)' : 'var(--motorven-emerald)'
                            }}>
                              {rec.tipoDoc || 'FACTURA'}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <select
                              className="form-control"
                              style={{ padding: '3px 6px', fontSize: '0.74rem', minWidth: '150px' }}
                              value={inlineEditDraft.proveedorNombre || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const sup = unifiedSuppliers.find((s) => (s.nombre || s.provDes) === val);
                                setInlineEditDraft((prev) => ({
                                  ...prev,
                                  proveedorNombre: val,
                                  proveedorId: sup?.id || prev.proveedorId,
                                  proveedorRif: sup?.rif || prev.proveedorRif
                                }));
                              }}
                            >
                              {!unifiedSuppliers.some((s) => (s.nombre || s.provDes) === inlineEditDraft.proveedorNombre) && inlineEditDraft.proveedorNombre && (
                                <option value={inlineEditDraft.proveedorNombre}>{inlineEditDraft.proveedorNombre}</option>
                              )}
                              {unifiedSuppliers.map((s) => (
                                <option key={s.id} value={s.nombre || s.provDes}>
                                  {s.nombre || s.provDes}
                                </option>
                              ))}
                            </select>
                          ) : (
                            rec.proveedorNombre || rec.proveedor
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '3px 6px', fontSize: '0.75rem', width: '105px', fontFamily: 'monospace' }}
                              value={inlineEditDraft.proveedorRif || ''}
                              onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, proveedorRif: e.target.value.toUpperCase() }))}
                            />
                          ) : (
                            rec.proveedorRif || 'J-31115365-9'
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.75rem', width: '95px', fontWeight: 700 }}
                                value={inlineEditDraft.totalUsd ?? 0}
                                onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, totalUsd: e.target.value }))}
                              />
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {formatBs((Number(inlineEditDraft.totalUsd) || 0) * rowRate)}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div><strong>{formatUsd(rec.totalUsd)}</strong></div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatBs(rec.totalBs || (rec.totalUsd * config.tasaDolar))}</div>
                            </>
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.74rem', width: '85px' }}
                                value={inlineEditDraft.retencionIvaUsd ?? 0}
                                onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, retencionIvaUsd: e.target.value }))}
                                title="Retención IVA en USD ($)"
                              />
                              <div style={{ fontSize: '0.66rem', color: 'var(--motorven-emerald)' }}>
                                {formatBs((Number(inlineEditDraft.retencionIvaUsd) || 0) * rowRate)}
                              </div>
                            </div>
                          ) : (
                            <span className="badge badge-success">{formatBs(rec.retencionIvaBs || ((rec.retencionIvaUsd || 0) * config.tasaDolar))}</span>
                          )}
                        </td>
                        <td>
                          {isEditingRow ? (
                            <div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.74rem', width: '85px' }}
                                value={inlineEditDraft.retencionIslrUsd ?? 0}
                                onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, retencionIslrUsd: e.target.value }))}
                                title="Retención ISLR en USD ($)"
                              />
                              <div style={{ fontSize: '0.66rem', color: 'var(--neon-cyan)' }}>
                                {formatBs((Number(inlineEditDraft.retencionIslrUsd) || 0) * rowRate)}
                              </div>
                            </div>
                          ) : (
                            <span className="badge badge-info">{formatBs(rec.retencionIslrBs || ((rec.retencionIslrUsd || 0) * config.tasaDolar))}</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {isEditingRow ? (
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.73rem', width: '125px', fontFamily: 'monospace' }}
                                value={inlineEditDraft.numeroComprobanteRetencionIva || ''}
                                onChange={(e) => setInlineEditDraft((prev) => ({ ...prev, numeroComprobanteRetencionIva: e.target.value }))}
                              />
                            ) : (
                              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--neon-cyan)' }}>
                                {rec.numeroComprobanteRetencionIva || '20260700000001'}
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.68rem' }}
                              onClick={() => generateSeniatRetentionVoucherPDF({ type: 'IVA', record: rec, config, currentUser })}
                              title="Descargar Comprobante de Retención IVA SENIAT en PDF"
                            >
                              <Printer size={11} /> IVA PDF
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            {isEditingRow ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleSaveInlinePurchase(rec)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#ffffff',
                                    border: '1px solid #10b981',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer'
                                  }}
                                  title="Guardar cambios de este registro SENIAT"
                                >
                                  <Save size={12} /> Guardar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleCancelEditPurchase}
                                  style={{
                                    padding: '3px 7px',
                                    fontSize: '0.7rem',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    cursor: 'pointer'
                                  }}
                                  title="Cancelar edición"
                                >
                                  <X size={12} /> Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleStartEditPurchase(rec)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    background: 'rgba(217, 119, 6, 0.15)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(217, 119, 6, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer'
                                  }}
                                  title="Editar registro de carga SENIAT"
                                >
                                  <Edit3 size={12} /> Editar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleDeletePurchaseRecord(rec)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer'
                                  }}
                                  title="Eliminar registro del historial de carga SENIAT"
                                >
                                  <Trash2 size={12} /> Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '1.75rem', color: 'var(--text-muted)' }}>
                        No hay registros en el historial de cargas locales SENIAT.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE COMPRA PROFIT */}
      {selectedProfitPurchase && (
        <ProfitPurchaseDetailModal
          purchase={selectedProfitPurchase}
          onClose={() => setSelectedProfitPurchase(null)}
          config={config}
          currentUser={currentUser}
          tasaBcv={config?.tasaDolar || 827.73}
        />
      )}

      {/* MODAL PERFIL DE PROVEEDOR PROFIT */}
      {selectedProfitSupplier && (
        <ProfitSupplierDetailModal
          supplier={selectedProfitSupplier}
          onClose={() => setSelectedProfitSupplier(null)}
          purchases={scopedProfitPurchases}
          accountsPayable={scopedAccountsPayable}
          tasaBcv={config?.tasaDolar || 827.73}
        />
      )}

      {/* MODAL OFICIAL GENERADOR RETENCIONES ISLR SENIAT */}
      {showIslrModal && (
        <IslrWithholdingModal
          isOpen={showIslrModal}
          onClose={() => setShowIslrModal(false)}
          islrConcepts={profitIslrConcepts}
          beneficiaries={profitBeneficiaries}
          paymentOrders={scopedPaymentOrders}
          withholdings={scopedIslrWithholdings}
          accountsPayable={scopedAccountsPayable}
          purchases={scopedProfitPurchases}
          suppliers={profitSuppliers.length > 0 ? profitSuppliers : suppliers}
          onRefresh={onSyncProfit}
        />
      )}

      {/* MODAL MATRIZ DE REORDEN INTELIGENTE & PRONÓSTICO DE QUIEBRE */}
      <SmartReorderMatrixModal
        isOpen={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        products={products}
        profitInvoices={profitInvoices}
        sales={sales}
        profitPurchases={scopedProfitPurchases}
        profitSuppliers={profitSuppliers}
        config={config}
        tasaBcv={config?.tasaDolar || 827.73}
        onSaveProduct={onSaveProduct}
      />
    </div>
  );
}
