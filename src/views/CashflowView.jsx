import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  DollarSign,
  Users,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Percent,
  X,
  ShieldCheck,
  ShieldAlert,
  Receipt,
  LayoutGrid,
  Filter,
  UserCheck,
  Landmark,
  Copy,
  Check,
  Eye,
  Package,
  Droplet,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Send,
  Printer,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import ClientsDirectoryModal from '../components/ClientsDirectoryModal';
import ProfitReceiptModal from '../components/ProfitReceiptModal';
import ProfitInvoiceModal from '../components/ProfitInvoiceModal';
import DebtCollectionIntelligenceModal from '../components/DebtCollectionIntelligenceModal';
import CreditScoreEngineModal from '../components/CreditScoreEngineModal';
import { generateCashflowPDF, generateAccountsReceivablePDF, generateBankAccountsPDF } from '../services/pdfReportService';

export default function CashflowView({
  cashMovements = [],
  clients = [],
  suppliers = [],
  sales = [],
  profitBankAccounts = [],
  profitCashDesks = [],
  profitAccountsPayable = [],
  profitCollections = [],
  profitInvoices = [],
  profitSellers = [],
  onSyncProfit,
  config = {},
  onAddCashMovement,
  onSaveClient,
  currentUser,
  initialTab = 'SPLIT',
  onOpenCashBankModal,
  onOpenAccountsReceivableModal,
  onOpenAccountsPayableModal
}) {
  // Pestañas: 'SPLIT', 'ARQUEO', 'BANCOS', 'COBROS_PROFIT', 'FACTURAS_PROFIT', 'CXC', 'CXP'
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('TODOS'); // TODOS, INGRESO, EGRESO

  // Modales
  const [showMovModal, setShowMovModal] = useState(false);
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [showDebtCollectionModal, setShowDebtCollectionModal] = useState(false);
  const [showCreditScoreModal, setShowCreditScoreModal] = useState(false);
  const [selectedClientForCobro, setSelectedClientForCobro] = useState(null);
  const [selectedProfitReceipt, setSelectedProfitReceipt] = useState(null);
  const [selectedProfitInvoice, setSelectedProfitInvoice] = useState(null);
  const [copiedAccount, setCopiedAccount] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filtros de Cobranzas Profit
  const [cobrosSearch, setCobrosSearch] = useState('');
  const [cobrosMethodFilter, setCobrosMethodFilter] = useState('TODOS');
  const [cobrosSellerFilter, setCobrosSellerFilter] = useState('TODOS');

  // Filtros de Facturas Profit
  const [invoicesSearch, setInvoicesSearch] = useState('');
  const [invoicesStatusFilter, setInvoicesStatusFilter] = useState('TODAS');

  // Filtros de Cartera CxC & Aging
  const [cxcSearch, setCxcSearch] = useState('');
  const [cxcAgingFilter, setCxcAgingFilter] = useState('TODOS'); // 'TODOS' | 'VIGENTE' | '1_15' | '16_30' | 'OVER_30'
  const [cxcSellerFilter, setCxcSellerFilter] = useState('TODOS');

  // Formulario de Movimiento
  const [movTipo, setMovTipo] = useState('INGRESO');
  const [movConcepto, setMovConcepto] = useState('');
  const [movMontoUsd, setMovMontoUsd] = useState('');
  const [movMetodo, setMovMetodo] = useState('EFECTIVO_USD');

  // Formulario de Cobro CxC
  const [cobroMontoUsd, setCobroMontoUsd] = useState('');
  const [cobroMetodo, setCobroMetodo] = useState('PAGO_MOVIL');
  const [cobroReferencia, setCobroReferencia] = useState('');

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  // Sincronización Profit
  const handleTriggerSync = async () => {
    if (onSyncProfit) {
      setIsSyncing(true);
      try {
        await onSyncProfit();
      } finally {
        setTimeout(() => setIsSyncing(false), 800);
      }
    }
  };

  // Copiar número de cuenta
  const handleCopyAccount = (numCta) => {
    if (!numCta) return;
    navigator.clipboard.writeText(numCta);
    setCopiedAccount(numCta);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  // Cálculos de saldo de caja
  const totalIngresosUsd = useMemo(() => {
    return cashMovements
      .filter((m) => m.tipo === 'INGRESO')
      .reduce((acc, m) => acc + (Number(m.montoUsd) || 0), 0);
  }, [cashMovements]);

  const totalEgresosUsd = useMemo(() => {
    return cashMovements
      .filter((m) => m.tipo === 'EGRESO')
      .reduce((acc, m) => acc + (Number(m.montoUsd) || 0), 0);
  }, [cashMovements]);

  const saldoCajaUsd = totalIngresosUsd - totalEgresosUsd;
  const saldoCajaBs = saldoCajaUsd * tasaBcv;

  // Cartera CxC Consolidada (Clientes Locales + Facturas Pendientes Supabase)
  const clientesConDeuda = useMemo(() => {
    const map = new Map();
    const hoy = new Date();

    // 1. Integrar clientes locales con saldoDeudorUsd
    (clients || []).forEach(c => {
      const coCli = (c.id || c.codigo || c.co_cli || '').toString().trim();
      const rif = (c.rif || '').toString().trim().toUpperCase();
      const saldoLocal = Number(c.saldoDeudorUsd) || 0;
      if (saldoLocal > 0.01) {
        map.set(rif || coCli, {
          id: c.id || coCli,
          coCli,
          nombre: c.nombre || c.razonSocial || 'Cliente General',
          rif: c.rif || 'J-00000000-0',
          telefono: c.telefono || c.telefonos || '',
          ciudad: c.ciudad || '',
          asesor: c.vendedorAsignado || '01',
          saldoUsd: saldoLocal,
          facturasCount: 0,
          maxDiasMora: 0,
          tramo: 'VIGENTE'
        });
      }
    });

    // 2. Integrar facturas de Supabase con saldo pendiente
    (profitInvoices || []).forEach(inv => {
      if (inv.anulado || inv.status === 'ANULADA') return;
      const saldo = Number(inv.saldoUsd || (inv.saldoBs ? inv.saldoBs / (inv.tasa || tasaBcv) : inv.saldo || 0));
      if (saldo <= 0.01) return;

      const rif = (inv.clienteRif || '').toString().trim().toUpperCase();
      const coCli = (inv.coCli || inv.co_cli || inv.clienteCod || '').toString().trim();
      const key = rif || coCli;

      const fEmis = inv.fechaEmision || inv.fec_emis ? new Date(inv.fechaEmision || inv.fec_emis) : hoy;
      const fVenc = inv.fechaVencimiento || inv.fec_venc ? new Date(inv.fechaVencimiento || inv.fec_venc) : fEmis;
      const diffMs = hoy - fVenc;
      const diasVencido = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (!map.has(key)) {
        const clientProfile = (clients || []).find(c => (c.rif && c.rif.toString().trim().toUpperCase() === rif) || (c.id && c.id.toString().trim() === coCli)) || {};
        map.set(key, {
          id: clientProfile.id || coCli || key,
          coCli,
          nombre: inv.clienteNombre || clientProfile.nombre || clientProfile.razonSocial || 'Cliente General',
          rif: rif || clientProfile.rif || 'J-00000000-0',
          telefono: clientProfile.telefono || clientProfile.telefonos || '',
          ciudad: clientProfile.ciudad || '',
          asesor: inv.vendedorId || inv.co_ven || clientProfile.vendedorAsignado || '01',
          saldoUsd: saldo,
          facturasCount: 1,
          maxDiasMora: diasVencido,
          tramo: diasVencido > 30 ? 'OVER_30' : diasVencido > 15 ? '16_30' : diasVencido > 7 ? '8_15' : diasVencido > 0 ? '1_7' : 'VIGENTE'
        });
      } else {
        const existing = map.get(key);
        existing.saldoUsd = existing.facturasCount === 0 ? saldo : existing.saldoUsd + saldo;
        existing.facturasCount += 1;
        if (diasVencido > existing.maxDiasMora) {
          existing.maxDiasMora = diasVencido;
          existing.tramo = diasVencido > 30 ? 'OVER_30' : diasVencido > 15 ? '16_30' : diasVencido > 7 ? '8_15' : diasVencido > 0 ? '1_7' : 'VIGENTE';
        }
      }
    });

    return Array.from(map.values()).map(cli => {
      let rating = 'AAA';
      if (cli.maxDiasMora > 30) rating = 'D';
      else if (cli.maxDiasMora > 15) rating = 'C';
      else if (cli.maxDiasMora > 7) rating = 'B';
      else if (cli.maxDiasMora > 0) rating = 'A';
      else rating = 'AA';

      return {
        ...cli,
        rating,
        saldoBs: cli.saldoUsd * tasaBcv
      };
    }).sort((a, b) => b.saldoUsd - a.saldoUsd);
  }, [clients, profitInvoices, tasaBcv]);

  const totalDeudaUsd = useMemo(() => {
    return clientesConDeuda.reduce((acc, c) => acc + (Number(c.saldoUsd) || 0), 0);
  }, [clientesConDeuda]);

  const totalDeudaBs = totalDeudaUsd * tasaBcv;

  // KPIs de Aging por Tramos
  const agingKpis = useMemo(() => {
    let vigente = 0;
    let mora1_15 = 0;
    let mora16_30 = 0;
    let moraOver30 = 0;

    clientesConDeuda.forEach(c => {
      if (c.maxDiasMora === 0) vigente += c.saldoUsd;
      else if (c.maxDiasMora <= 15) mora1_15 += c.saldoUsd;
      else if (c.maxDiasMora <= 30) mora16_30 += c.saldoUsd;
      else moraOver30 += c.saldoUsd;
    });

    return {
      total: totalDeudaUsd,
      vigente,
      mora1_15,
      mora16_30,
      moraOver30,
      clientesConDeuda: clientesConDeuda.length
    };
  }, [clientesConDeuda, totalDeudaUsd]);

  // Filtrado de Cartera CxC
  const filteredConsolidatedCxc = useMemo(() => {
    return clientesConDeuda.filter(c => {
      const q = cxcSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.rif || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q) ||
        (c.coCli || '').toLowerCase().includes(q);

      let matchAging = true;
      if (cxcAgingFilter === 'VIGENTE') matchAging = c.maxDiasMora === 0;
      else if (cxcAgingFilter === '1_15') matchAging = c.maxDiasMora >= 1 && c.maxDiasMora <= 15;
      else if (cxcAgingFilter === '16_30') matchAging = c.maxDiasMora >= 16 && c.maxDiasMora <= 30;
      else if (cxcAgingFilter === 'OVER_30') matchAging = c.maxDiasMora > 30;

      const matchSeller =
        cxcSellerFilter === 'TODOS' ||
        (c.asesor || '').toLowerCase() === cxcSellerFilter.toLowerCase();

      return matchSearch && matchAging && matchSeller;
    });
  }, [clientesConDeuda, cxcSearch, cxcAgingFilter, cxcSellerFilter]);

  // Manejador directo de chat de WhatsApp
  const handleDirectWhatsAppChat = (cli) => {
    const rawPhone = cli.telefono || '';
    let clean = rawPhone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '58' + clean.slice(1);
    else if (clean.length === 10 && !clean.startsWith('58')) clean = '58' + clean;

    const fechaHoy = new Date().toLocaleDateString('es-VE');
    const msg = `Estimado(a) *${cli.nombre}* (RIF: ${cli.rif}), le saludamos cordialmente de *${config.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.'}*.\n\nLe compartimos su saldo pendiente al día de hoy *${fechaHoy}*: *$ ${cli.saldoUsd.toFixed(2)} USD* (Bs. ${cli.saldoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} a Tasa Oficial BCV Bs. ${tasaBcv.toFixed(2)}).\n\nAgradecemos enviarnos su comprobante de pago por este canal para procesar su recibo oficial de caja.\n\n¡Muchas gracias por su preferencia!`;
    const encoded = encodeURIComponent(msg);
    const url = clean ? `https://wa.me/${clean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Exportar Cartera CxC a CSV
  const handleExportCxcCsv = () => {
    const filename = `cartera_cxc_aging_signum_motorven_${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = [
      'Cliente',
      'RIF',
      'Telefono',
      'Asesor_Comercial',
      'Facturas_Pendientes',
      'Max_Dias_Mora',
      'Tramo_Aging',
      'Rating_Crediticio',
      'Saldo_USD',
      'Saldo_Bs'
    ];
    const rows = filteredConsolidatedCxc.map(c => [
      `"${c.nombre.replace(/"/g, '""')}"`,
      `"${c.rif}"`,
      `"${c.telefono}"`,
      `"${c.asesor}"`,
      c.facturasCount,
      c.maxDiasMora,
      `"${c.tramo}"`,
      `"${c.rating}"`,
      c.saldoUsd.toFixed(2),
      c.saldoBs.toFixed(2)
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

  // Imprimir reporte oficial de Cartera CxC & Aging
  const handlePrintAgingReport = () => {
    generateAccountsReceivablePDF({ cxcList: filteredConsolidatedCxc, clients, sellers: profitSellers, config, currentUser });
  };
  const totalCxPUsd = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + (Number(s.saldoPendienteUsd) || 0), 0);
  }, [suppliers]);

  const totalCxPBs = totalCxPUsd * tasaBcv;

  // Cuentas Bancarias Profit
  const totalBancosBs = useMemo(() => {
    return profitBankAccounts.reduce((acc, b) => acc + (Number(b.saldoBs) || 0), 0);
  }, [profitBankAccounts]);

  const totalBancosUsd = useMemo(() => {
    return tasaBcv > 0 ? totalBancosBs / tasaBcv : 0;
  }, [totalBancosBs, tasaBcv]);

  // Cobranzas Profit Filtradas
  const filteredProfitCollections = useMemo(() => {
    return profitCollections.filter((c) => {
      const q = cobrosSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.clienteNombre || '').toLowerCase().includes(q) ||
        (c.clienteRif || '').toLowerCase().includes(q) ||
        (c.cobNum ? String(c.cobNum).includes(q) : false) ||
        (c.descrip || '').toLowerCase().includes(q) ||
        (c.formasPago || []).some(fp => (fp.numDoc || '').toLowerCase().includes(q));

      const matchMethod =
        cobrosMethodFilter === 'TODOS' ||
        (c.formasPago || []).some(fp => fp.tipo === cobrosMethodFilter);

      const matchSeller =
        cobrosSellerFilter === 'TODOS' ||
        (c.vendedorId || '').toUpperCase() === cobrosSellerFilter.toUpperCase();

      return matchSearch && matchMethod && matchSeller;
    });
  }, [profitCollections, cobrosSearch, cobrosMethodFilter, cobrosSellerFilter]);

  // Facturas Profit Filtradas
  const filteredProfitInvoices = useMemo(() => {
    return profitInvoices.filter((f) => {
      const q = invoicesSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (f.clienteNombre || '').toLowerCase().includes(q) ||
        (f.clienteRif || '').toLowerCase().includes(q) ||
        (f.factNum ? String(f.factNum).includes(q) : false) ||
        (f.vendedorId || '').toLowerCase().includes(q);

      const matchStatus =
        invoicesStatusFilter === 'TODAS' || f.status === invoicesStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [profitInvoices, invoicesSearch, invoicesStatusFilter]);

  // Movimientos filtrados para Arqueo
  const filteredMovements = useMemo(() => {
    return cashMovements.filter((m) => {
      const matchSearch =
        (m.concepto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.metodo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.usuario || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filterTipo === 'TODOS' || m.tipo === filterTipo;
      return matchSearch && matchTipo;
    });
  }, [cashMovements, searchTerm, filterTipo]);

  // Manejador para registrar movimiento manual
  const handleRegisterMovement = (e) => {
    e.preventDefault();
    if (!movConcepto.trim() || !movMontoUsd || Number(movMontoUsd) <= 0) return;

    const montoVal = parseFloat(movMontoUsd);
    onAddCashMovement({
      tipo: movTipo,
      concepto: movConcepto.trim(),
      montoUsd: montoVal,
      montoBs: montoVal * tasaBcv,
      metodo: movMetodo,
      usuario: currentUser?.nombre || 'Administración'
    });

    setShowMovModal(false);
    setMovConcepto('');
    setMovMontoUsd('');
  };

  // Abrir modal de cobro
  const handleOpenCobroModal = (client) => {
    setSelectedClientForCobro(client);
    setCobroMontoUsd(String(client.saldoDeudorUsd || ''));
    setCobroReferencia('');
    setShowCobroModal(true);
  };

  // Confirmar cobro en modal
  const handleConfirmCobro = (e) => {
    e.preventDefault();
    if (!selectedClientForCobro || !cobroMontoUsd || Number(cobroMontoUsd) <= 0) return;

    const abonado = parseFloat(cobroMontoUsd);
    const nuevoSaldo = Math.max(0, Number(selectedClientForCobro.saldoDeudorUsd) - abonado);

    onSaveClient({ ...selectedClientForCobro, saldoDeudorUsd: nuevoSaldo });

    const refText = cobroReferencia ? ` [Ref: ${cobroReferencia.trim()}]` : '';
    onAddCashMovement({
      tipo: 'INGRESO',
      concepto: `Abono CxC - ${selectedClientForCobro.nombre}${refText}`,
      montoUsd: abonado,
      montoBs: abonado * tasaBcv,
      metodo: cobroMetodo,
      usuario: currentUser?.nombre || 'Caja Cobranzas'
    });

    setShowCobroModal(false);
    setSelectedClientForCobro(null);
    setCobroMontoUsd('');
    setCobroReferencia('');
  };

  // Exportar arqueo a CSV
  const exportArqueoCsv = () => {
    let csv = "Fecha;Hora;Tipo;Concepto;Metodo de Pago;Responsable;Monto ($ USD);Monto (Bs. BCV)\n";
    filteredMovements.forEach((m) => {
      const d = new Date(m.fecha || new Date());
      const fechaStr = d.toLocaleDateString('es-VE');
      const horaStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      csv += `${fechaStr};${horaStr};${m.tipo};"${(m.concepto || '').replace(/"/g, '""')}";${m.metodo};"${m.usuario || ''}";${m.montoUsd.toFixed(2)};${m.montoBs.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ARQUEO_CAJA_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Renderizador de Tabla de Arqueo
  const renderArqueoTable = (compactMode = false) => (
    <div className="bento-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="bento-card-header">
        <span className="bento-card-header-title">
          <Receipt size={18} color="var(--motorven-red)" />
          Arqueo Diario de Caja POS
        </span>
        <span className="badge badge-primary" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
          {filteredMovements.length} Movimientos
        </span>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: compactMode ? '220px' : '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar concepto o método..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
          />
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
          <button
            className="btn btn-sm"
            onClick={() => setFilterTipo('TODOS')}
            style={{
              background: filterTipo === 'TODOS' ? 'var(--motorven-red)' : 'transparent',
              color: filterTipo === 'TODOS' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.72rem',
              padding: '3px 9px'
            }}
          >
            Todos
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setFilterTipo('INGRESO')}
            style={{
              background: filterTipo === 'INGRESO' ? 'var(--semaforo-verde)' : 'transparent',
              color: filterTipo === 'INGRESO' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.72rem',
              padding: '3px 9px'
            }}
          >
            + Ingresos
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setFilterTipo('EGRESO')}
            style={{
              background: filterTipo === 'EGRESO' ? 'var(--motorven-red)' : 'transparent',
              color: filterTipo === 'EGRESO' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.72rem',
              padding: '3px 9px'
            }}
          >
            - Egresos
          </button>
        </div>
      </div>

      {/* Tabla Responsiva */}
      <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
        <table className="custom-table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>FECHA / HORA</th>
              {!compactMode && <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>TIPO</th>}
              <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CONCEPTO / MOTIVO</th>
              <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>MÉTODO</th>
              {!compactMode && <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>RESPONSABLE</th>}
              <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>MONTO ($ USD)</th>
              <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>MONTO (BS.)</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={compactMode ? 5 : 7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No se encontraron movimientos de caja registrados.
                </td>
              </tr>
            ) : (
              filteredMovements.map((mov) => {
                const isIngreso = mov.tipo === 'INGRESO';
                const fechaObj = new Date(mov.fecha || new Date());
                const horaFormatted = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={mov.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}>
                        {compactMode ? horaFormatted : fechaObj.toLocaleDateString('es-VE')}
                      </div>
                      {!compactMode && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                          {horaFormatted}
                        </div>
                      )}
                    </td>

                    {!compactMode && (
                      <td>
                        <span
                          className={`badge ${isIngreso ? 'badge-success' : 'badge-danger'}`}
                          style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          {isIngreso ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {mov.tipo}
                        </span>
                      </td>
                    )}

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {mov.concepto}
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
                        {(mov.metodo || 'EFECTIVO_USD').replace('_', ' ')}
                      </span>
                    </td>

                    {!compactMode && (
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {mov.usuario || 'Ana Rivas'}
                      </td>
                    )}

                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)' }}>
                      <span style={{ color: isIngreso ? 'var(--semaforo-verde)' : 'var(--motorven-red)' }}>
                        {isIngreso ? '+ ' : '- '}{formatUsd(mov.montoUsd || 0)}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                      {formatBs(mov.montoBs || ((mov.montoUsd || 0) * tasaBcv))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredMovements.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg-table-header)', fontWeight: 800, borderTop: '2px solid var(--border-glass)' }}>
                <td colSpan={compactMode ? 3 : 5} style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  SALDO NETO EN CAJA:
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontSize: '0.95rem', color: saldoCajaUsd >= 0 ? 'var(--semaforo-verde)' : 'var(--motorven-red)' }}>
                  {formatUsd(saldoCajaUsd)}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.9rem', color: 'var(--motorven-gold)' }}>
                  {formatBs(saldoCajaBs)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  // Renderizador de Cartera CxC Clientes con Aging y Recordatorios WhatsApp
  const renderCarteraCxC = (fullMode = false) => {
    const listToRender = fullMode ? filteredConsolidatedCxc : clientesConDeuda;

    // Helper de color según tramo de mora
    const getTramoBadge = (tramo, dias) => {
      switch (tramo) {
        case 'OVER_30':
          return (
            <span className="badge badge-danger" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <AlertTriangle size={11} /> +30 días ({dias}d)
            </span>
          );
        case '16_30':
          return (
            <span className="badge badge-warning" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)', background: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', borderColor: '#ea580c' }}>
              16-30 días ({dias}d)
            </span>
          );
        case '8_15':
        case '1_7':
          return (
            <span className="badge badge-warning" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
              1-15 días ({dias}d)
            </span>
          );
        case 'VIGENTE':
        default:
          return (
            <span className="badge badge-success" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
              Al Día (0d)
            </span>
          );
      }
    };

    // Helper de Score Crediticio
    const getRatingBadge = (rating) => {
      let bg = 'rgba(16, 185, 129, 0.12)';
      let color = 'var(--semaforo-verde)';
      let border = 'rgba(16, 185, 129, 0.3)';

      if (rating === 'D') {
        bg = 'rgba(239, 68, 68, 0.15)';
        color = 'var(--motorven-red)';
        border = 'rgba(239, 68, 68, 0.3)';
      } else if (rating === 'C') {
        bg = 'rgba(249, 115, 22, 0.15)';
        color = '#f97316';
        border = 'rgba(249, 115, 22, 0.3)';
      } else if (rating === 'B') {
        bg = 'rgba(234, 179, 8, 0.15)';
        color = 'var(--motorven-gold)';
        border = 'rgba(234, 179, 8, 0.3)';
      }

      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 7px',
            borderRadius: '6px',
            fontSize: '0.68rem',
            fontWeight: 800,
            fontFamily: 'var(--font-code)',
            background: bg,
            color: color,
            border: `1px solid ${border}`
          }}
          title={`Score Dinámico: ${rating}`}
        >
          {rating}
        </span>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* TRAMOS DE AGING EN MODO COMPLETO */}
        {fullMode && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            {/* Total Cartera */}
            <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-gold)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
                Total Cartera CxC
              </div>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '3px' }}>
                {formatUsd(agingKpis.total)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)' }}>
                {formatBs(agingKpis.total * tasaBcv)} ({agingKpis.clientesConDeuda} deudores)
              </div>
            </div>

            {/* Vigente */}
            <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--semaforo-verde)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
                🟢 Vigente (Al Día)
              </div>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '3px' }}>
                {formatUsd(agingKpis.vigente)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {agingKpis.total > 0 ? ((agingKpis.vigente / agingKpis.total) * 100).toFixed(1) : 0}% de la cartera
              </div>
            </div>

            {/* Mora 1-15 días */}
            <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-gold)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
                🟡 Mora 1 a 15 Días
              </div>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-gold)', marginTop: '3px' }}>
                {formatUsd(agingKpis.mora1_15)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {agingKpis.total > 0 ? ((agingKpis.mora1_15 / agingKpis.total) * 100).toFixed(1) : 0}% de la cartera
              </div>
            </div>

            {/* Mora 16-30 días */}
            <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
                🟠 Mora 16 a 30 Días
              </div>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: '#ea580c', marginTop: '3px' }}>
                {formatUsd(agingKpis.mora16_30)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {agingKpis.total > 0 ? ((agingKpis.mora16_30 / agingKpis.total) * 100).toFixed(1) : 0}% de la cartera
              </div>
            </div>

            {/* Mora >30 días */}
            <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-red)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
                🔴 Mora Crítica (+30d)
              </div>
              <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-red)', marginTop: '3px' }}>
                {formatUsd(agingKpis.moraOver30)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--motorven-red)', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                {agingKpis.total > 0 ? ((agingKpis.moraOver30 / agingKpis.total) * 100).toFixed(1) : 0}% en riesgo
              </div>
            </div>
          </div>
        )}

        {/* TABLA PRINCIPAL Y HERRAMIENTAS */}
        <div className="bento-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header con Buscador y Filtros */}
          <div className="bento-card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <span className="bento-card-header-title">
              <Users size={18} color="var(--motorven-gold)" />
              {fullMode ? 'Matriz Integral de Cartera CxC y Aging de Cobranzas' : 'Cartera de Clientes CxC'}
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-warning" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
                {listToRender.length} Clientes {fullMode && `(Total: ${formatUsd(listToRender.reduce((a, c) => a + c.saldoUsd, 0))})`}
              </span>

              {fullMode && (
                <>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowDebtCollectionModal(true)}
                    style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: 'var(--motorven-gold)', color: 'var(--motorven-gold)' }}
                  >
                    <Send size={13} /> Panel Cobranzas WhatsApp
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowCreditScoreModal(true)}
                    style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ShieldAlert size={13} /> Motor Credit Score
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={handleExportCxcCsv}
                    style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title="Exportar archivo CSV para hojas de cálculo"
                  >
                    <FileSpreadsheet size={13} /> CSV
                  </button>
                  <button
                    className="btn btn-sm btn-print-report"
                    onClick={handlePrintAgingReport}
                    style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
                    title="Imprimir listado oficial de Cartera en PDF"
                  >
                    <Printer size={13} color="#ffffff" /> Imprimir Reporte
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Barra de Filtros en Modo Completo */}
          {fullMode && (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-glass)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Buscador */}
              <div className="search-wrapper" style={{ flex: '1 1 240px' }}>
                <Search size={15} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por cliente, RIF, teléfono o código..."
                  value={cxcSearch}
                  onChange={(e) => setCxcSearch(e.target.value)}
                  style={{ fontSize: '0.8rem', height: '36px', width: '100%' }}
                />
              </div>

              {/* Filtro por Tramo de Aging */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>Aging:</span>
                <select
                  className="form-input filter-select"
                  value={cxcAgingFilter}
                  onChange={(e) => setCxcAgingFilter(e.target.value)}
                  style={{ fontSize: '0.78rem', height: '36px', minWidth: '145px' }}
                >
                  <option value="TODOS">Todos los tramos</option>
                  <option value="VIGENTE">🟢 Al Día (0d)</option>
                  <option value="1_15">🟡 1 a 15 Días</option>
                  <option value="16_30">🟠 16 a 30 Días</option>
                  <option value="OVER_30">🔴 +30 Días (Crítico)</option>
                </select>
              </div>

              {/* Filtro por Asesor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>Asesor:</span>
                <select
                  className="form-input filter-select"
                  value={cxcSellerFilter}
                  onChange={(e) => setCxcSellerFilter(e.target.value)}
                  style={{ fontSize: '0.78rem', height: '36px', minWidth: '140px' }}
                >
                  <option value="TODOS">Todos los asesores</option>
                  {Array.from(new Set(clientesConDeuda.map(c => c.asesor).filter(Boolean))).map(asesor => (
                    <option key={asesor} value={asesor}>Asesor {asesor}</option>
                  ))}
                </select>
              </div>

              {(cxcSearch || cxcAgingFilter !== 'TODOS' || cxcSellerFilter !== 'TODOS') && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setCxcSearch('');
                    setCxcAgingFilter('TODOS');
                    setCxcSellerFilter('TODOS');
                  }}
                  style={{ fontSize: '0.72rem', color: 'var(--motorven-red)', background: 'transparent' }}
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          )}

          {/* Tabla de Cartera */}
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="custom-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CLIENTE</th>
                  {fullMode && <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>RIF / TELÉFONO</th>}
                  {fullMode && <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ASESOR</th>}
                  {fullMode && <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>FACTURAS</th>}
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>MORA & AGING</th>
                  {fullMode && <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>SCORE</th>}
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>SALDO ($ USD)</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>SALDO (BS.)</th>
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>GESTIÓN / ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {listToRender.length === 0 ? (
                  <tr>
                    <td colSpan={fullMode ? 9 : 5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      {fullMode && (cxcSearch || cxcAgingFilter !== 'TODOS')
                        ? 'No se encontraron clientes bajo los filtros seleccionados.'
                        : '¡Excelente! No hay clientes con saldo deudor pendiente.'}
                    </td>
                  </tr>
                ) : (
                  listToRender.map((cli) => {
                    const saldoDeudor = Number(cli.saldoUsd) || 0;
                    return (
                      <tr key={cli.id || cli.rif}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {cli.nombre || cli.razonSocial}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {cli.coCli ? `Cód: ${cli.coCli} • ` : ''}{cli.ciudad || 'Cliente Registrado'}
                          </div>
                        </td>

                        {fullMode && (
                          <td>
                            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem', fontWeight: 600 }}>
                              {cli.rif}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                              {cli.telefono || 'Sin teléfono'}
                            </div>
                          </td>
                        )}

                        {fullMode && (
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-info" style={{ fontSize: '0.66rem', fontFamily: 'var(--font-code)' }}>
                              {cli.asesor || '01'}
                            </span>
                          </td>
                        )}

                        {fullMode && (
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 600 }}>
                            {cli.facturasCount > 0 ? (
                              <span title={`${cli.facturasCount} facturas pendientes registradas en Supabase`}>
                                {cli.facturasCount} fac.
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Cuenta corriente</span>
                            )}
                          </td>
                        )}

                        <td style={{ textAlign: 'center' }}>
                          {getTramoBadge(cli.tramo, cli.maxDiasMora)}
                        </td>

                        {fullMode && (
                          <td style={{ textAlign: 'center' }}>
                            {getRatingBadge(cli.rating)}
                          </td>
                        )}

                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)' }}>
                          {formatUsd(saldoDeudor)}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                          {formatBs(saldoDeudor * tasaBcv)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {/* Recordatorio WhatsApp Directo */}
                            <button
                              className="btn btn-sm"
                              onClick={() => handleDirectWhatsAppChat(cli)}
                              title={`Enviar recordatorio de cobro por WhatsApp a ${cli.nombre}`}
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                background: 'rgba(37, 211, 102, 0.15)',
                                color: '#25D366',
                                borderColor: 'rgba(37, 211, 102, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <MessageSquare size={12} />
                              {fullMode ? 'Recordar' : ''}
                            </button>

                            {/* Registrar Abono */}
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleOpenCobroModal(cli)}
                              style={{
                                fontSize: '0.72rem',
                                padding: '3px 9px',
                                background: 'var(--semaforo-verde)',
                                borderColor: 'var(--semaforo-verde)'
                              }}
                              title="Registrar abono oficial de caja"
                            >
                              Abonar
                            </button>
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
      </div>
    );
  };

  // =========================================================================
  // SUB-VISTA 1: 🏛️ CUENTAS BANCARIAS SUPABASE
  // =========================================================================
  const renderBankAccountsView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Tarjeta de Resumen Bancario */}
      <div
        className="bento-card"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 43, 122, 0.08) 0%, rgba(230, 0, 18, 0.04) 100%)',
          border: '1px solid var(--border-glass)',
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'var(--motorven-navy)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0, 43, 122, 0.35)'
            }}
          >
            <Landmark size={28} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Disponibilidad Bancaria Supabase
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Conciliación oficial de {profitBankAccounts.length} cuentas bancarias activas en Grupo Motorven
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Saldo Total Bancos (Bs.)
            </div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-gold)' }}>
              {formatBs(totalBancosBs)}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: '1.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Equivalente Tasa BCV ($ USD)
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.45rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
              {formatUsd(totalBancosUsd)}
            </div>
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Sincronizando...' : 'Actualizar Bancos'}
          </button>

          <button
            className="btn btn-print-report"
            onClick={() => generateBankAccountsPDF({ bankAccounts: profitBankAccounts, cashDesks: profitCashDesks, currentUser, config })}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            title="Descargar e Imprimir Esquema Oficial de Cuentas Bancarias en PDF"
          >
            <Printer size={15} color="#ffffff" />
            Imprimir PDF Cuentas
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Cuentas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.1rem'
        }}
      >
        {profitBankAccounts.length === 0 ? (
          <div className="bento-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No hay cuentas bancarias sincronizadas desde Supabase.
          </div>
        ) : (
          profitBankAccounts.map((account) => {
            const isCopied = copiedAccount === account.numCta;
            return (
              <div
                key={account.id}
                className="bento-card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  borderLeft: '4px solid var(--motorven-navy)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Landmark size={16} color="var(--motorven-navy-light)" />
                      {account.bancoNombre || 'Banco Nacional'}
                    </span>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem', fontFamily: 'var(--font-code)' }}>
                      Cta. {account.codCta}
                    </span>
                  </div>

                  {/* Número de cuenta con botón de copiado */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface-input, rgba(0, 43, 122, 0.04))',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)',
                      marginTop: '0.4rem'
                    }}
                  >
                    <code style={{ fontSize: '0.78rem', fontFamily: 'var(--font-code)', color: 'var(--text-main)', letterSpacing: '0.04em' }}>
                      {account.numCta || '00000000000000000000'}
                    </code>
                    <button
                      onClick={() => handleCopyAccount(account.numCta)}
                      style={{
                        background: isCopied ? 'var(--semaforo-verde)' : 'transparent',
                        color: isCopied ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        transition: 'all 0.2s'
                      }}
                      title="Copiar número de cuenta"
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      {isCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Saldos */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-glass)',
                    paddingTop: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Saldo en Cuenta
                    </div>
                    <div style={{ fontFamily: 'var(--font-code)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--motorven-gold)' }}>
                      {formatBs(account.saldoBs)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Equivalente USD
                    </div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.15rem', fontWeight: 900, color: 'var(--semaforo-verde)' }}>
                      {formatUsd(account.saldoUsd)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // =========================================================================
  // SUB-VISTA 2: 💰 AUDITORÍA DE COBRANZAS Y RECIBOS PROFIT
  // =========================================================================
  const renderProfitCollectionsView = () => {
    const totalCobradoUsd = profitCollections.reduce((acc, c) => acc + (c.montoUsd || 0), 0);
    const totalCobradoBs = profitCollections.reduce((acc, c) => acc + (c.montoBs || 0), 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Barra de 4 Métricas de Cobranza */}
        <div className="cashflow-stats-grid">
          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--semaforo-verde)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Cobranza Reciente
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '2px' }}>
              {formatUsd(totalCobradoUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(totalCobradoBs)}
            </div>
          </div>

          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Cobros Vía Zelle
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: '#8b5cf6', marginTop: '2px' }}>
              {profitCollections.filter(c => (c.formasPago || []).some(fp => fp.tipo === 'ZELLE')).length} Recibos
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Conciliación internacional
            </div>
          </div>

          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-navy-light)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Cobros Efectivo USD
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-navy-light)', marginTop: '2px' }}>
              {profitCollections.filter(c => (c.formasPago || []).some(fp => fp.tipo === 'EFECTIVO_USD')).length} Recibos
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Caja divisas física
            </div>
          </div>

          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-gold)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Depósitos / Transferencias Bs.
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-gold)', marginTop: '2px' }}>
              {profitCollections.filter(c => (c.formasPago || []).some(fp => fp.tipo === 'TRANSFERENCIA_BS' || fp.tipo === 'DEPOSITO_BS')).length} Recibos
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Conciliación bancaria nacional
            </div>
          </div>
        </div>

        {/* Tabla de Cobros */}
        <div className="bento-card">
          <div className="bento-card-header">
            <span className="bento-card-header-title">
              <Receipt size={18} color="var(--motorven-navy)" />
              Auditoría Oficial de Recibos de Cobranza Supabase
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
              {filteredProfitCollections.length} Recibos
            </span>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por cliente, RIF, N° recibo o ref..."
                value={cobrosSearch}
                onChange={(e) => setCobrosSearch(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="form-control"
                value={cobrosMethodFilter}
                onChange={(e) => setCobrosMethodFilter(e.target.value)}
                style={{ height: '34px', fontSize: '0.78rem', width: '160px' }}
              >
                <option value="TODOS">Todos los Métodos</option>
                <option value="ZELLE">Zelle ($)</option>
                <option value="EFECTIVO_USD">Efectivo ($)</option>
                <option value="TRANSFERENCIA_BS">Transferencia Bs.</option>
                <option value="DEPOSITO_BS">Depósito Bs.</option>
              </select>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                Sincronizar
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>N° RECIBO</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>FECHA</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CLIENTE / RAZÓN SOCIAL</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ASESOR</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>FORMAS DE PAGO</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>TOTAL ($ USD)</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>TOTAL (BS.)</th>
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfitCollections.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No se encontraron recibos de cobro con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredProfitCollections.map((cob) => {
                    const fechaObj = new Date(cob.fecha || new Date());
                    return (
                      <tr key={cob.id}>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--motorven-navy-light)' }}>
                            COB-{cob.cobNum}
                          </strong>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontFamily: 'var(--font-code)', fontSize: '0.78rem' }}>
                            {fechaObj.toLocaleDateString('es-VE')}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {cob.clienteNombre}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            RIF: {cob.clienteRif || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
                            {cob.vendedorId || 'VV'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(cob.formasPago || []).map((fp, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  background: fp.tipo === 'ZELLE' ? 'rgba(139, 92, 246, 0.15)' : fp.tipo === 'EFECTIVO_USD' ? 'var(--semaforo-verde-bg)' : 'rgba(37, 99, 235, 0.15)',
                                  color: fp.tipo === 'ZELLE' ? '#8b5cf6' : fp.tipo === 'EFECTIVO_USD' ? 'var(--semaforo-verde)' : 'var(--motorven-navy-light)'
                                }}
                              >
                                {fp.tipo === 'ZELLE' ? 'Zelle' : fp.tipo === 'EFECTIVO_USD' ? 'Efectivo $' : 'Transferencia'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                          {formatUsd(cob.montoUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                          {formatBs(cob.montoBs)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setSelectedProfitReceipt(cob)}
                            style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Ver detalles de recibo y pagos"
                          >
                            <Eye size={12} /> Ver Recibo
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // SUB-VISTA 3: 📑 HISTÓRICO Y CONTROL DE FACTURAS PROFIT
  // =========================================================================
  const renderProfitInvoicesView = () => {
    const totalFacturadoUsd = profitInvoices.reduce((acc, f) => acc + (f.totNetoUsd || 0), 0);
    const totalFacturadoBs = profitInvoices.reduce((acc, f) => acc + (f.totNetoBs || 0), 0);
    const totalLitros = profitInvoices.reduce((acc, f) => acc + (f.totalLitros || 0), 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Barra de 4 Métricas de Facturación */}
        <div className="cashflow-stats-grid">
          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-navy)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Facturado Reciente
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              {formatUsd(totalFacturadoUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(totalFacturadoBs)}
            </div>
          </div>

          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-navy-light)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Volumen de Lubricantes
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-navy-light)', marginTop: '2px' }}>
              {totalLitros?.toLocaleString('es-VE', { minimumFractionDigits: 1 })} L
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ≈ {(totalLitros / 11.35).toFixed(1)} Cajas Eq.
            </div>
          </div>

          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--semaforo-verde)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Facturas Cobradas
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '2px' }}>
              {profitInvoices.filter(f => f.status === 'COBRADA').length} Facturas
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Solventes
            </div>
          </div>

          <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-red)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Con Saldo Pendiente
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, color: 'var(--motorven-red)', marginTop: '2px' }}>
              {profitInvoices.filter(f => f.status === 'SALDO_PENDIENTE').length} Facturas
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Cuentas por cobrar
            </div>
          </div>
        </div>

        {/* Tabla de Facturas */}
        <div className="bento-card">
          <div className="bento-card-header">
            <span className="bento-card-header-title">
              <FileText size={18} color="var(--motorven-red)" />
              Libro y Control de Facturación Supabase
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
              {filteredProfitInvoices.length} Facturas
            </span>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por cliente, RIF o N° factura..."
                value={invoicesSearch}
                onChange={(e) => setInvoicesSearch(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="form-control"
                value={invoicesStatusFilter}
                onChange={(e) => setInvoicesStatusFilter(e.target.value)}
                style={{ height: '34px', fontSize: '0.78rem', width: '160px' }}
              >
                <option value="TODAS">Todos los Estados</option>
                <option value="COBRADA">Cobradas</option>
                <option value="SALDO_PENDIENTE">Saldo Pendiente</option>
                <option value="ANULADA">Anuladas</option>
              </select>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                Sincronizar
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>N° FACTURA</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>EMISIÓN</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CLIENTE / RAZÓN SOCIAL</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ASESOR</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>LITROS</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>TOTAL ($ USD)</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>SALDO ($ USD)</th>
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ESTADO</th>
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfitInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No se encontraron facturas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredProfitInvoices.map((fac) => {
                    const fechaEmisObj = new Date(fac.fechaEmision || new Date());
                    const isCobrada = fac.status === 'COBRADA';
                    const isAnulada = fac.status === 'ANULADA';

                    return (
                      <tr key={fac.id}>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-code)', color: 'var(--motorven-navy-light)' }}>
                            FACT-{fac.factNum}
                          </strong>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontFamily: 'var(--font-code)', fontSize: '0.78rem' }}>
                            {fechaEmisObj.toLocaleDateString('es-VE')}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {fac.clienteNombre}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            RIF: {fac.clienteRif || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
                            {fac.vendedorId || 'VV'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                          {fac.totalLitros ? `${fac.totalLitros.toFixed(1)} L` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-main)' }}>
                          {formatUsd(fac.totNetoUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: fac.saldoUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                          {formatUsd(fac.saldoUsd)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${isCobrada ? 'badge-success' : isAnulada ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                            {fac.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setSelectedProfitInvoice(fac)}
                            style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Ver desglose de lubricantes"
                          >
                            <Eye size={12} /> Detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="view-container">
      
      {/* 1. CABECERA PRINCIPAL */}
      <div className="view-header">
        <div>
          <h2 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeTab === 'CXC' ? (
              <>
                <DollarSign size={26} color="var(--motorven-gold)" />
                Cuentas por Cobrar (CxC) & Aging de Cartera
              </>
            ) : activeTab === 'CXP' ? (
              <>
                <Building2 size={26} color="var(--motorven-navy-light)" />
                Cuentas por Pagar (CxP) a Proveedores
              </>
            ) : (
              <>
                <Wallet size={26} color="var(--motorven-red)" />
                Caja Chica, Tesorería & Conciliación Bancaria
              </>
            )}
          </h2>
          <div className="view-subtitle">
            {activeTab === 'CXC'
              ? 'Control de antigüedad de saldos (Aging), estados de cuenta y cobranza automatizada vía WhatsApp'
              : activeTab === 'CXP'
              ? 'Auditoría de compromisos con proveedores de lubricantes, órdenes de pago y facturas pendientes'
              : 'Flujo de caja POS mostrador, disponibilidades bancarias y cobranzas auditadas de Supabase'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowCreditScoreModal(true)}
            style={{
              fontSize: '0.82rem',
              borderColor: 'rgba(2, 132, 199, 0.4)',
              background: 'rgba(2, 132, 199, 0.12)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={16} color="#38bdf8" /> Score de Crédito
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
            <Clock size={16} color="#25D366" /> Inteligencia Cobranzas & WhatsApp
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowClientsModal(true)}
            style={{
              fontSize: '0.82rem',
              borderColor: 'rgba(0, 43, 122, 0.4)',
              background: 'rgba(0, 43, 122, 0.15)',
              color: 'var(--text-primary)',
              fontWeight: 600
            }}
          >
            <Users size={16} color="var(--motorven-navy-light)" /> Directorio Clientes ({clients.length})
          </button>
          <button className="btn btn-secondary" onClick={exportArqueoCsv} style={{ fontSize: '0.82rem' }}>
            <Download size={16} /> Exportar Arqueo (CSV)
          </button>
          <button className="btn btn-primary" onClick={() => setShowMovModal(true)} style={{ fontSize: '0.82rem' }}>
            <Plus size={16} /> Registrar Movimiento de Caja
          </button>
          <button
            className="btn btn-print-report"
            onClick={() => generateCashflowPDF({ cashDesks: profitCashDesks, bankAccounts: profitBankAccounts, cashMovements, currentUser, config })}
            style={{ fontSize: '0.82rem', marginLeft: 'auto' }}
            title="Generar y descargar reporte oficial en PDF"
          >
            <Printer size={16} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* 2. BARRA DE 4 BENTO / KPI STAT CARDS SUPERIORES */}
      <div className="cashflow-stats-grid">
        
        {/* KPI 1: Saldo en Caja Chica */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--semaforo-verde)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--semaforo-verde-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--semaforo-verde)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Saldo en Caja Chica
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                Disponible
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--semaforo-verde)' }}>
              {formatUsd(saldoCajaUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(saldoCajaBs)}
            </div>
          </div>
        </div>

        {/* KPI 2: Disponibilidad Bancaria */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--motorven-navy-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)', color: 'var(--motorven-navy-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Landmark size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Bancos Supabase
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                {profitBankAccounts.length} Cuentas
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--text-primary)' }}>
              {formatUsd(totalBancosUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(totalBancosBs)}
            </div>
          </div>
        </div>

        {/* KPI 3: Total Ingresos Hoy */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--motorven-gold)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--semaforo-amarillo-bg)', border: '1px solid rgba(217, 119, 6, 0.3)', color: 'var(--motorven-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowDownLeft size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Total Ingresos Hoy
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                Entradas
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--text-primary)' }}>
              {formatUsd(totalIngresosUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(totalIngresosUsd * tasaBcv)}
            </div>
          </div>
        </div>

        {/* KPI 4: Cartera CxC Pendiente */}
        <div className="bento-card" style={{ padding: '1.15rem', borderLeft: '4px solid var(--motorven-red)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--semaforo-rojo-bg)', border: '1px solid rgba(230, 0, 18, 0.3)', color: 'var(--motorven-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                Cartera CxC Pendiente
              </span>
              <span className="badge badge-danger" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                {clientesConDeuda.length} Clientes
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 900, marginTop: '2px', color: 'var(--motorven-red)' }}>
              {formatUsd(totalDeudaUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(totalDeudaBs)}
            </div>
          </div>
        </div>

      </div>

      {/* 3. SUB-NAV / SELECTOR DE MODO DE VISTA */}
      <div className="bento-card" style={{ marginBottom: '1.25rem', padding: '0.65rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            
            {/* Modo Split */}
            <button
              className="btn btn-sm"
              onClick={() => setActiveTab('SPLIT')}
              style={{
                background: activeTab === 'SPLIT' ? 'var(--motorven-red)' : 'transparent',
                color: activeTab === 'SPLIT' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'SPLIT' ? 700 : 500,
                fontSize: '0.78rem'
              }}
            >
              <LayoutGrid size={14} style={{ marginRight: '5px' }} />
              Vista Dividida
            </button>

            {/* Solo Arqueo */}
            <button
              className="btn btn-sm"
              onClick={() => setActiveTab('ARQUEO')}
              style={{
                background: activeTab === 'ARQUEO' ? 'var(--motorven-navy-light)' : 'transparent',
                color: activeTab === 'ARQUEO' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'ARQUEO' ? 700 : 500,
                fontSize: '0.78rem'
              }}
            >
              <Receipt size={14} style={{ marginRight: '5px' }} />
              Arqueo POS ({cashMovements.length})
            </button>

            {/* Bancos Profit */}
            <button
              className="btn btn-sm"
              onClick={() => setActiveTab('BANCOS')}
              style={{
                background: activeTab === 'BANCOS' ? 'var(--motorven-navy)' : 'transparent',
                color: activeTab === 'BANCOS' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'BANCOS' ? 700 : 500,
                fontSize: '0.78rem'
              }}
            >
              <Landmark size={14} style={{ marginRight: '5px' }} />
              Bancos ({profitBankAccounts.length})
            </button>

            {/* Cobranzas Profit */}
            <button
              className="btn btn-sm"
              onClick={() => setActiveTab('COBROS_PROFIT')}
              style={{
                background: activeTab === 'COBROS_PROFIT' ? '#8b5cf6' : 'transparent',
                color: activeTab === 'COBROS_PROFIT' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'COBROS_PROFIT' ? 700 : 500,
                fontSize: '0.78rem'
              }}
            >
              <Receipt size={14} style={{ marginRight: '5px' }} />
              Cobranzas ({profitCollections.length})
            </button>

            {/* Facturas Profit */}
            <button
              className="btn btn-sm"
              onClick={() => setActiveTab('FACTURAS_PROFIT')}
              style={{
                background: activeTab === 'FACTURAS_PROFIT' ? 'var(--motorven-red)' : 'transparent',
                color: activeTab === 'FACTURAS_PROFIT' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'FACTURAS_PROFIT' ? 700 : 500,
                fontSize: '0.78rem'
              }}
            >
              <FileText size={14} style={{ marginRight: '5px' }} />
              Facturas ({profitInvoices.length})
            </button>

            {/* Solo CxC Clientes */}
            <button
              className="btn btn-sm"
              onClick={() => setActiveTab('CXC')}
              style={{
                background: activeTab === 'CXC' ? 'var(--motorven-gold)' : 'transparent',
                color: activeTab === 'CXC' ? '#000' : 'var(--text-muted)',
                fontWeight: activeTab === 'CXC' ? 700 : 500,
                fontSize: '0.78rem'
              }}
            >
              <Users size={14} style={{ marginRight: '5px' }} />
              Cartera CxC ({clientesConDeuda.length})
            </button>

            {/* Cuentas por Pagar CxP */}
            <button
              className="btn btn-sm"
              onClick={() => setActiveTab('CXP')}
              style={{
                background: activeTab === 'CXP' ? 'var(--motorven-navy-light)' : 'transparent',
                color: activeTab === 'CXP' ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === 'CXP' ? 700 : 500,
                fontSize: '0.78rem'
              }}
            >
              <Building2 size={14} style={{ marginRight: '5px' }} />
              CxP Proveedores ({suppliers.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onOpenCashBankModal && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenCashBankModal}
                title="Abrir Modal de Caja Chica & Bancos"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Wallet size={13} style={{ color: 'var(--brand-blue)' }} />
                <span>Modal Cajas & Bancos</span>
              </button>
            )}
            {onOpenAccountsReceivableModal && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenAccountsReceivableModal}
                title="Abrir Modal de Cuentas por Cobrar (CxC)"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <DollarSign size={13} style={{ color: '#059669' }} />
                <span>Modal CxC</span>
              </button>
            )}
            {onOpenAccountsPayableModal && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenAccountsPayableModal}
                title="Abrir Modal de Cuentas por Pagar (CxP)"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Building2 size={13} style={{ color: '#d97706' }} />
                <span>Modal CxP</span>
              </button>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>BCV:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--motorven-gold)', fontFamily: 'var(--font-tech)', background: 'var(--semaforo-amarillo-bg)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
              Bs. {tasaBcv.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CONTENIDO PRINCIPAL SEGÚN MODO SELECCIONADO */}
      {/* ========================================================================= */}

      {/* MODO 1: VISTA DIVIDIDA */}
      {activeTab === 'SPLIT' && (
        <div className="cashflow-split-layout">
          <div>{renderArqueoTable(true)}</div>
          <div>{renderCarteraCxC(false)}</div>
        </div>
      )}

      {/* MODO 2: SOLO ARQUEO */}
      {activeTab === 'ARQUEO' && (
        <div>{renderArqueoTable(false)}</div>
      )}

      {/* MODO 3: BANCOS PROFIT */}
      {activeTab === 'BANCOS' && renderBankAccountsView()}

      {/* MODO 4: COBRANZAS PROFIT */}
      {activeTab === 'COBROS_PROFIT' && renderProfitCollectionsView()}

      {/* MODO 5: FACTURAS PROFIT */}
      {activeTab === 'FACTURAS_PROFIT' && renderProfitInvoicesView()}

      {/* MODO 6: SOLO CARTERA CXC */}
      {activeTab === 'CXC' && (
        <div>{renderCarteraCxC(true)}</div>
      )}

      {/* MODO 7: CUENTAS POR PAGAR (CXP PROVEEDORES) */}
      {activeTab === 'CXP' && (
        <div className="bento-card">
          <div className="bento-card-header">
            <span className="bento-card-header-title">
              <Building2 size={18} color="var(--motorven-navy-light)" />
              Cuentas por Pagar a Proveedores (CxP)
            </span>
            <span className="badge badge-danger" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
              {formatUsd(totalCxPUsd)} Compromisos
            </span>
          </div>

          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CÓDIGO</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>PROVEEDOR / RAZÓN SOCIAL</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>RIF</th>
                  <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>DOMICILIO FISCAL</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>PENDIENTE ($ USD)</th>
                  <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>PENDIENTE (BS.)</th>
                  <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No existen proveedores registrados.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((sup) => {
                    const pendienteUsd = Number(sup.saldoPendienteUsd) || 0;
                    return (
                      <tr key={sup.id}>
                        <td><strong style={{ fontFamily: 'var(--font-code)' }}>{sup.codigo || 'PROV'}</strong></td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sup.nombre}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sup.email || sup.telefono}</div>
                        </td>
                        <td><code style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>{sup.rif}</code></td>
                        <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {sup.domicilioFiscal || sup.direccion}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: pendienteUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                          {formatUsd(pendienteUsd)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                          {formatBs(pendienteUsd * tasaBcv)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${pendienteUsd > 0 ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.68rem' }}>
                            {pendienteUsd > 0 ? 'Pendiente' : 'Solvente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-table-header)', fontWeight: 800, borderTop: '2px solid var(--border-glass)' }}>
                  <td colSpan="4" style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    TOTAL COMPROMISOS PROVEEDORES:
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)', fontSize: '0.95rem' }}>
                    {formatUsd(totalCxPUsd)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)', fontSize: '0.9rem' }}>
                    {formatBs(totalCxPBs)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALES */}
      {/* ========================================================================= */}

      {/* MODAL 1: REGISTRAR MOVIMIENTO MANUAL DE CAJA */}
      {showMovModal && (
        <div className="modal-overlay" onClick={() => setShowMovModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '490px', padding: '1.75rem' }}
          >
            <div className="modal-header" style={{ marginBottom: '1.25rem', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: movTipo === 'INGRESO' ? 'var(--semaforo-verde-bg)' : 'var(--semaforo-rojo-bg)',
                    border: `1px solid ${movTipo === 'INGRESO' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(230, 0, 18, 0.35)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: movTipo === 'INGRESO' ? 'var(--semaforo-verde)' : 'var(--motorven-red)'
                  }}
                >
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                    Registrar Movimiento de Caja
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Arqueo manual bimoneda con tasa oficial BCV
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowMovModal(false)}
                title="Cerrar modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRegisterMovement}>
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label">Tipo de Operación</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setMovTipo('INGRESO')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      border: movTipo === 'INGRESO' ? '1px solid var(--semaforo-verde)' : '1px solid var(--border-glass)',
                      background: movTipo === 'INGRESO' ? 'var(--semaforo-verde)' : 'var(--bg-tertiary)',
                      color: movTipo === 'INGRESO' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <TrendingUp size={16} /> + INGRESO
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovTipo('EGRESO')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      border: movTipo === 'EGRESO' ? '1px solid var(--motorven-red)' : '1px solid var(--border-glass)',
                      background: movTipo === 'EGRESO' ? 'var(--motorven-red)' : 'var(--bg-tertiary)',
                      color: movTipo === 'EGRESO' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <TrendingDown size={16} /> - EGRESO
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <label className="form-label">Concepto / Motivo *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Pago de flete local, reposición caja chica..."
                  value={movConcepto}
                  onChange={(e) => setMovConcepto(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Monto ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    placeholder="0.00"
                    value={movMontoUsd}
                    onChange={(e) => setMovMontoUsd(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Equivalente (Bs.)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={movMontoUsd ? formatBs(parseFloat(movMontoUsd || 0) * tasaBcv) : 'Bs. 0,00'}
                    readOnly
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--motorven-gold)', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Método de Pago</label>
                <select
                  className="form-control"
                  value={movMetodo}
                  onChange={(e) => setMovMetodo(e.target.value)}
                >
                  <option value="EFECTIVO_USD">Efectivo USD ($)</option>
                  <option value="EFECTIVO_BS">Efectivo Bolívares (Bs.)</option>
                  <option value="PAGO_MOVIL">Pago Móvil</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  <option value="PUNTO_DE_VENTA">Punto de Venta (Tarjeta)</option>
                  <option value="ZELLE">Zelle ($ USD)</option>
                  <option value="USDT">Binance USDT</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMovModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Registrar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ABONO CXC */}
      {showCobroModal && selectedClientForCobro && (
        <div className="modal-overlay" onClick={() => setShowCobroModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', padding: '1.75rem' }}
          >
            <div className="modal-header" style={{ marginBottom: '1.25rem', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'var(--semaforo-verde-bg)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--semaforo-verde)'
                  }}
                >
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                    Registrar Abono a Cuenta (CxC)
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {selectedClientForCobro.nombre || selectedClientForCobro.razonSocial}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCobroModal(false)}
                title="Cerrar modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmCobro}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Monto del Abono ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(selectedClientForCobro.saldoDeudorUsd) || 999999}
                    className="form-control"
                    placeholder="0.00"
                    value={cobroMontoUsd}
                    onChange={(e) => setCobroMontoUsd(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Equivalente (Bs.)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={cobroMontoUsd ? formatBs(parseFloat(cobroMontoUsd || 0) * tasaBcv) : 'Bs. 0,00'}
                    readOnly
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--motorven-gold)', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Método de Cobro</label>
                  <select
                    className="form-control"
                    value={cobroMetodo}
                    onChange={(e) => setCobroMetodo(e.target.value)}
                  >
                    <option value="PAGO_MOVIL">Pago Móvil (Bs.)</option>
                    <option value="TRANSFERENCIA_BS">Transferencia Bancaria (Bs.)</option>
                    <option value="PUNTO_DE_VENTA">Punto de Venta / Tarjeta</option>
                    <option value="EFECTIVO_USD">Efectivo USD</option>
                    <option value="ZELLE">Zelle ($ USD)</option>
                    <option value="USDT">Binance USDT</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">N° Referencia</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: 489201"
                    value={cobroReferencia}
                    onChange={(e) => setCobroReferencia(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCobroModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--semaforo-verde)', borderColor: 'var(--semaforo-verde)' }}>
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DIRECTORIO DE CLIENTES */}
      <ClientsDirectoryModal
        isOpen={showClientsModal}
        onClose={() => setShowClientsModal(false)}
        clients={clients}
        tasaBcv={tasaBcv}
        onSelectClientForPayment={(c) => {
          setSelectedClientForCobro(c);
          setCobroMontoUsd(c.saldoDeudorUsd || '');
          setShowClientsModal(false);
          setShowCobroModal(true);
        }}
      />

      {/* MODAL 4: RECIBO OFICIAL DE COBRANZA PROFIT */}
      {selectedProfitReceipt && (
        <ProfitReceiptModal
          receipt={selectedProfitReceipt}
          onClose={() => setSelectedProfitReceipt(null)}
          config={config}
          currentUser={currentUser}
          tasaBcv={tasaBcv}
        />
      )}

      {/* MODAL 5: DETALLE DE FACTURA PROFIT */}
      {selectedProfitInvoice && (
        <ProfitInvoiceModal
          invoice={selectedProfitInvoice}
          onClose={() => setSelectedProfitInvoice(null)}
          config={config}
          currentUser={currentUser}
          tasaBcv={tasaBcv}
          products={products}
        />
      )}

      {/* MODAL 6: INTELIGENCIA DE COBRANZAS, AGING DE CARTERA & WHATSAPP */}
      <DebtCollectionIntelligenceModal
        isOpen={showDebtCollectionModal}
        onClose={() => setShowDebtCollectionModal(false)}
        profitInvoices={profitInvoices}
        clients={clients}
        profitSellers={profitSellers}
        profitBankAccounts={profitBankAccounts}
        config={config}
        currentUser={currentUser}
        tasaBcv={tasaBcv}
      />

      {/* MODAL 7: SCORE DE CRÉDITO & LÍMITE DINÁMICO */}
      <CreditScoreEngineModal
        isOpen={showCreditScoreModal}
        onClose={() => setShowCreditScoreModal(false)}
        clients={clients}
        profitInvoices={profitInvoices}
        profitCollections={profitCollections}
        config={config}
        currentUser={currentUser}
        tasaBcv={tasaBcv}
      />

    </div>
  );
}
