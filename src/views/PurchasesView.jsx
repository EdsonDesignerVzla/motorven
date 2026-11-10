import React, { useState, useMemo } from 'react';
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
  Warehouse
} from 'lucide-react';
import { formatUsd, formatBs, getProductWarehouseStocks } from '../services/formatService';
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
import { generatePurchasesPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

export default function PurchasesView({
  products = [],
  suppliers = [],
  purchases = [],
  config,
  onSaveProduct,
  onRegisterPurchase,
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
  const [syncing, setSyncing] = useState(false);

  // Form states for SENIAT purchase entry
  const [selectedSupplier, setSelectedSupplier] = useState(suppliers[0] || null);
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
  const [porcentajeRetIva, setPorcentajeRetIva] = useState(75);
  const [porcentajeRetIslr, setPorcentajeRetIslr] = useState(2);

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

  const displayPurchases = purchases && purchases.length > 0 ? purchases : localPurchases;
  const rifValidation = selectedSupplier ? validateRif(selectedSupplier.rif) : { isValid: true };

  // Cálculos fiscales instantáneos en pantalla
  const costoFinalConFlete = nuevoCostoUsd + (cantidadRecibida > 0 ? fleteProrrateadoUsd / cantidadRecibida : 0);
  const subtotalUsd = costoFinalConFlete * cantidadRecibida;
  
  let alicuotaPct = 0.16;
  if (tipoAlicuota === 'EXENTO_0') alicuotaPct = 0.00;
  if (tipoAlicuota === 'REDUCIDA_8') alicuotaPct = 0.08;

  const ivaCalculadoUsd = subtotalUsd * alicuotaPct;
  const retencionIvaCalculadaUsd = ivaCalculadoUsd * (porcentajeRetIva / 100);
  const retencionIslrCalculadaUsd = (tipoAlicuota !== 'EXENTO_0' ? subtotalUsd : 0) * (porcentajeRetIslr / 100);
  const totalFacturaCalculadoUsd = subtotalUsd + ivaCalculadoUsd;

  // KPIs Generales del Módulo de Compras y Proveedores
  const kpis = useMemo(() => {
    const totalComprasUsd = profitPurchases.reduce((acc, p) => acc + (p.totNetoUsd || 0), 0);
    const totalComprasBs = profitPurchases.reduce((acc, p) => acc + (p.totNetoBs || 0), 0);
    const totalCxPUsd = profitAccountsPayable.reduce((acc, d) => acc + (d.saldoUsd || 0), 0);
    const totalCxPBs = profitAccountsPayable.reduce((acc, d) => acc + (d.saldoBs || 0), 0);
    const totalPagadoUsd = profitSupplierPayments.reduce((acc, p) => acc + (p.montoUsd || 0), 0);
    const totalPagadoBs = profitSupplierPayments.reduce((acc, p) => acc + (p.montoBs || 0), 0);

    const now = new Date();
    const cxpVencidaUsd = profitAccountsPayable
      .filter(d => d.fechaVencimiento && new Date(d.fechaVencimiento) < now && d.saldoUsd > 0.01)
      .reduce((acc, d) => acc + d.saldoUsd, 0);

    const cxpAlDiaUsd = Math.max(0, totalCxPUsd - cxpVencidaUsd);

    return {
      totalProveedores: profitSuppliers.length || suppliers.length || 5,
      totalComprasCount: profitPurchases.length,
      totalComprasUsd,
      totalComprasBs,
      totalCxPUsd,
      totalCxPBs,
      cxpAlDiaUsd,
      cxpVencidaUsd,
      totalPagadoUsd,
      totalPagadoBs,
      totalPagosCount: profitSupplierPayments.length
    };
  }, [profitSuppliers, profitPurchases, profitAccountsPayable, profitSupplierPayments, suppliers]);

  // Filtrado de Facturas de Compra Profit
  const effectivePurchases = (profitPurchases && profitPurchases.length > 0) ? profitPurchases : displayPurchases.map(p => ({
    id: p.id,
    factNum: p.numeroFacturaProv || p.id,
    facturaProv: p.numeroFacturaProv || p.id,
    provNombre: p.proveedorNombre || 'Proveedor',
    provRif: p.proveedorRif || 'J-00000000-0',
    coProv: p.proveedorId || 'P-0001',
    fechaEmision: p.fecha,
    fechaVencimiento: p.fecha,
    totNetoUsd: Number(p.totalUsd || 0),
    totNetoBs: Number(p.totalBs || 0),
    saldoUsd: 0,
    status: 'PAGADA'
  }));

  const filteredPurchases = useMemo(() => {
    return effectivePurchases.filter(p => {
      if (!p) return false;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        String(p.factNum || '').toLowerCase().includes(q) ||
        (p.facturaProv && String(p.facturaProv).toLowerCase().includes(q)) ||
        (p.provNombre && String(p.provNombre).toLowerCase().includes(q)) ||
        (p.coProv && String(p.coProv).toLowerCase().includes(q));

      const matchStatus = statusFilter === 'TODOS' || p.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [effectivePurchases, searchQuery, statusFilter]);

  // Filtrado de Proveedores Profit
  const effectiveSuppliers = (profitSuppliers && profitSuppliers.length > 0) ? profitSuppliers : suppliers.map(s => ({
    id: s.id,
    coProv: s.codigo || s.id,
    provDes: s.nombre || 'Proveedor',
    rif: s.rif || 'J-00000000-0',
    saldoUsd: Number(s.saldoPendienteUsd || 0),
    limiteCredito: 25000,
    inactivo: false,
    direccion: s.direccion || s.domicilioFiscal || ''
  }));

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
    return (profitAccountsPayable || []).filter(d => {
      if (!d) return false;
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

      return matchQuery && matchStatus;
    });
  }, [profitAccountsPayable, searchQuery, statusFilter]);

  // Filtrado de Pagos a Proveedores
  const filteredPayments = useMemo(() => {
    return (profitSupplierPayments || []).filter(p => {
      if (!p) return false;
      const q = searchQuery.toLowerCase().trim();
      return !q ||
        String(p.pagoNum || '').includes(q) ||
        (p.provNombre && String(p.provNombre).toLowerCase().includes(q)) ||
        (p.descrip && String(p.descrip).toLowerCase().includes(q)) ||
        (p.coProv && String(p.coProv).toLowerCase().includes(q));
    });
  }, [profitSupplierPayments, searchQuery]);

  // Filtrado de Órdenes de Pago Profit
  const filteredPaymentOrders = useMemo(() => {
    return (profitPaymentOrders || []).filter(o => {
      if (!o) return false;
      const q = searchQuery.toLowerCase().trim();
      const ben = String(o.benDes || o.benNombre || '').toLowerCase();
      const desc = String(o.descrip || o.motivo || '').toLowerCase();
      const ord = String(o.ordNum || o.ord_num || '').toLowerCase();
      const cod = String(o.codBen || o.cod_ben || '').toLowerCase();
      return !q || ord.includes(q) || ben.includes(q) || desc.includes(q) || cod.includes(q);
    });
  }, [profitPaymentOrders, searchQuery]);

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

  const handleRegisterPurchase = async (e) => {
    e.preventDefault();
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

    const dateObj = new Date();
    const voucherSeq = displayPurchases.length + 1;
    const voucherNum = generateVatRetentionVoucherNumber(dateObj, voucherSeq);

    const purchasePayload = {
      numeroFacturaProv: numeroFacturaProv.trim().toUpperCase(),
      numeroControl: numeroControlProv.trim().toUpperCase(),
      tipoDoc,
      documentoAfectado: (tipoDoc === 'NOTA_CREDITO' || tipoDoc === 'NOTA_DEBITO') ? documentoAfectado.trim().toUpperCase() : '',
      fecha: dateObj.toISOString(),
      proveedorId: selectedSupplier.id,
      proveedorNombre: selectedSupplier.nombre,
      proveedorRif: selectedSupplier.rif,
      proveedorDireccion: selectedSupplier.domicilioFiscal || selectedSupplier.direccion || '',
      tasaDolar: config.tasaDolar,
      producto: selectedProduct.descripcion,
      cantidad: parseInt(cantidadRecibida),
      costoUnitarioUsd: parseFloat(costoFinalConFlete.toFixed(2)),
      subtotalUsd: parseFloat(subtotalUsd.toFixed(2)),
      baseExentaUsd: tipoAlicuota === 'EXENTO_0' ? parseFloat(subtotalUsd.toFixed(2)) : 0.00,
      baseGeneralUsd: tipoAlicuota === 'GENERAL_16' ? parseFloat(subtotalUsd.toFixed(2)) : 0.00,
      ivaGeneralUsd: tipoAlicuota === 'GENERAL_16' ? parseFloat(ivaCalculadoUsd.toFixed(2)) : 0.00,
      baseReducidaUsd: tipoAlicuota === 'REDUCIDA_8' ? parseFloat(subtotalUsd.toFixed(2)) : 0.00,
      ivaReducidaUsd: tipoAlicuota === 'REDUCIDA_8' ? parseFloat(ivaCalculadoUsd.toFixed(2)) : 0.00,
      totalUsd: parseFloat(totalFacturaCalculadoUsd.toFixed(2)),
      retencionIvaUsd: parseFloat(retencionIvaCalculadaUsd.toFixed(2)),
      retencionIslrUsd: parseFloat(retencionIslrCalculadaUsd.toFixed(2)),
      numeroComprobanteRetencionIva: voucherNum,
      numeroComprobanteRetencionIslr: voucherNum,
      almacen: almacenDestino,
      almacenNombre: almacenDestino === '01' ? 'Almacén 01 (Fiscal / SENIAT)' : 'Almacén 02 (Central / Bóveda - Notas de Entrega)',
      receptor: currentUser?.nombre || 'Pedro Gómez'
    };

    if (onSaveProduct && selectedProduct) {
      const wStocks = getProductWarehouseStocks(selectedProduct);
      const qtyNum = parseInt(cantidadRecibida, 10) || 0;
      const isNc = tipoDoc === 'NOTA_CREDITO';

      const newStock01 = almacenDestino === '01'
        ? (isNc ? Math.max(0, wStocks.stock01 - qtyNum) : wStocks.stock01 + qtyNum)
        : wStocks.stock01;
      const newStock02 = almacenDestino === '02'
        ? (isNc ? Math.max(0, wStocks.stock02 - qtyNum) : wStocks.stock02 + qtyNum)
        : wStocks.stock02;

      const updatedProd = {
        ...selectedProduct,
        stock: newStock01 + newStock02,
        stockAlmacen01: newStock01,
        stockAlmacen02: newStock02,
        costoUsd: parseFloat(costoFinalConFlete.toFixed(2))
      };
      onSaveProduct(updatedProd);
    }

    if (onRegisterPurchase) {
      await onRegisterPurchase(purchasePayload);
    } else {
      setLocalPurchases([purchasePayload, ...localPurchases]);
    }

    setNumeroFacturaProv('');
    setNumeroControlProv('');
    setDocumentoAfectado('');
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
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Gestión integral de compras y proveedores conforme a SENIAT
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
          <FileText size={16} /> Facturas de Compra ({profitPurchases.length})
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
          <Building size={16} /> Directorio Proveedores ({profitSuppliers.length || suppliers.length})
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
          <Calendar size={16} /> Cuentas por Pagar (CxP) ({profitAccountsPayable.length})
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
          <CreditCard size={16} /> Historial de Pagos ({profitSupplierPayments.length})
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
          <FileCheck size={16} /> Órdenes de Pago ({profitPaymentOrders.length})
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
                        <td style={{ textAlign: 'center' }}>
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
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
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
                  <th style={{ textAlign: 'right' }}>TASA BCV</th>
                  <th style={{ textAlign: 'center' }}>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((p) => (
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
                        {formatBs(p.montoBs)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>
                        Bs. {p.tasa?.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${p.anulado ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.68rem' }}>
                          {p.anulado ? 'ANULADO' : 'PROCESADO'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
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
                  <th style={{ textAlign: 'center' }}>ESTADO</th>
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
                        <span className={`badge ${o.anulada ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.68rem' }}>
                          {o.anulada ? 'ANULADA' : 'EMITIDA'}
                        </span>
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
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={18} color="var(--accent-primary)" /> Registrar Recepción de Mercancía
              </h3>

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
                    onChange={(e) => setSelectedSupplier(suppliers.find(s => s.id === e.target.value))}
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre} ({s.rif})</option>
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
                      onChange={(e) => setTipoDoc(e.target.value)}
                    >
                      <option value="FACTURA">Factura de Compra</option>
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
                      min="1"
                      className="form-control"
                      value={cantidadRecibida}
                      onChange={(e) => setCantidadRecibida(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Costo Unit. Factura ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={nuevoCostoUsd}
                      onChange={(e) => setNuevoCostoUsd(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Flete Prorrateado ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={fleteProrrateadoUsd}
                      onChange={(e) => setFleteProrrateadoUsd(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

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

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem' }}>
                  <CheckCircle size={18} /> Cargar a Inventario & Generar Retención SENIAT
                </button>
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
                    {generateVatRetentionVoucherNumber(new Date(), displayPurchases.length + 1)}
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
                    <th>N° Comprobante Ret. IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPurchases.map((rec) => (
                    <tr key={rec.id}>
                      <td>{new Date(rec.fecha).toLocaleDateString()}</td>
                      <td><strong style={{ color: 'var(--accent-primary)' }}>{rec.numeroFacturaProv || rec.facturaProv}</strong></td>
                      <td><span style={{ fontFamily: 'monospace' }}>{rec.numeroControl || '00-005821'}</span></td>
                      <td>
                        <span className="badge" style={{
                          background: rec.tipoDoc === 'NOTA_CREDITO' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: rec.tipoDoc === 'NOTA_CREDITO' ? 'var(--motorven-red)' : 'var(--motorven-emerald)'
                        }}>
                          {rec.tipoDoc || 'FACTURA'}
                        </span>
                      </td>
                      <td>{rec.proveedorNombre || rec.proveedor}</td>
                      <td>{rec.proveedorRif || 'J-31115365-9'}</td>
                      <td>
                        <div><strong>{formatUsd(rec.totalUsd)}</strong></div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatBs(rec.totalBs || (rec.totalUsd * config.tasaDolar))}</div>
                      </td>
                      <td>
                        <span className="badge badge-success">{formatBs(rec.retencionIvaBs || (rec.retencionIvaUsd * config.tasaDolar))}</span>
                      </td>
                      <td>
                        <span className="badge badge-info">{formatBs(rec.retencionIslrBs || (rec.retencionIslrUsd * config.tasaDolar))}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--neon-cyan)' }}>
                          {rec.numeroComprobanteRetencionIva || '20260700000001'}
                        </span>
                      </td>
                    </tr>
                  ))}
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
          purchases={profitPurchases}
          accountsPayable={profitAccountsPayable}
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
          paymentOrders={profitPaymentOrders}
          withholdings={profitIslrWithholdings}
          accountsPayable={profitAccountsPayable}
          purchases={profitPurchases}
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
        profitPurchases={profitPurchases}
        profitSuppliers={profitSuppliers}
        config={config}
        tasaBcv={config?.tasaDolar || 827.73}
        onSaveProduct={onSaveProduct}
      />
    </div>
  );
}
