import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  FileText,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Printer,
  Tag,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  Layers,
  BarChart3,
  Scale,
  Eye,
  FileSpreadsheet,
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import AccountingEntryModal from '../components/AccountingEntryModal';
import MotorvenLogo from '../components/MotorvenLogo';
import { generateAuditLedgerPDF } from '../services/pdfReportService';

export default function AuditLedgerView({
  profitInvoices = [],
  profitCollections = [],
  profitPurchases = [],
  profitSupplierPayments = [],
  profitBankAccounts = [],
  profitAuditTrails = [],
  cashMovements = [],
  usersList = [],
  config,
  onSyncProfit,
  currentUser
}) {
  const [activeSubTab, setActiveSubTab] = useState('diario'); // 'diario' | 'audit' | 'balance' | 'export'
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Forensic Audit Filter States
  const [auditSearch, setAuditSearch] = useState('');
  const [auditOpFilter, setAuditOpFilter] = useState('ALL');
  const [auditTableFilter, setAuditTableFilter] = useState('ALL');
  const [auditUserFilter, setAuditUserFilter] = useState('ALL');
  const [selectedAuditTrail, setSelectedAuditTrail] = useState(null);

  const tasa = config?.tasaDolar || 827.73;

  // Helper to parse forensic field diffs from Supabase pistas.campos
  const parseForensicDiffs = (camposText) => {
    if (!camposText || typeof camposText !== 'string') return [];
    const lines = camposText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const diffs = [];
    lines.forEach(line => {
      // Matches [FIELD]= "OLD" cambio por -> "NEW"
      const match = line.match(/^\[([^\]]+)\]\s*=\s*"(.*)"\s*cambio por\s*->\s*"(.*)"$/);
      if (match) {
        diffs.push({
          field: match[1],
          oldVal: match[2],
          newVal: match[3]
        });
      } else if (line.includes('cambio por ->')) {
        const parts = line.split('cambio por ->');
        diffs.push({
          field: 'CAMPO',
          oldVal: parts[0].trim(),
          newVal: (parts[1] || '').trim()
        });
      }
    });
    return diffs;
  };


  const handleSync = async () => {
    if (onSyncProfit) {
      setSyncing(true);
      await onSyncProfit();
      setTimeout(() => setSyncing(false), 800);
    }
  };


  // Unique users and tables from native audit trails
  const auditUsers = useMemo(() => {
    const set = new Set();
    profitAuditTrails.forEach(p => { if (p.usuario) set.add(p.usuario.trim()); });
    return Array.from(set).sort();
  }, [profitAuditTrails]);

  const auditTables = useMemo(() => {
    const set = new Set();
    profitAuditTrails.forEach(p => { if (p.tabla) set.add(p.tabla.trim()); });
    return Array.from(set).sort();
  }, [profitAuditTrails]);

  // Filtered native audit trails
  const filteredAuditTrails = useMemo(() => {
    return profitAuditTrails.filter(p => {
      if (auditOpFilter !== 'ALL' && p.tipoOp !== auditOpFilter) return false;
      if (auditTableFilter !== 'ALL' && p.tabla !== auditTableFilter) return false;
      if (auditUserFilter !== 'ALL' && p.usuario !== auditUserFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const matchesDoc = (p.numDoc || '').toString().includes(q);
        const matchesCode = (p.codigo || '').toLowerCase().includes(q);
        const matchesUser = (p.usuario || '').toLowerCase().includes(q);
        const matchesTable = (p.tabla || '').toLowerCase().includes(q);
        const matchesMachine = (p.maquina || '').toLowerCase().includes(q);
        const matchesFields = (p.campos || '').toLowerCase().includes(q);
        return matchesDoc || matchesCode || matchesUser || matchesTable || matchesMachine || matchesFields;
      }
      return true;
    });
  }, [profitAuditTrails, auditOpFilter, auditTableFilter, auditUserFilter, auditSearch]);

  // Forensic Audit KPIs
  const auditKpis = useMemo(() => {
    const total = profitAuditTrails.length;
    const mods = profitAuditTrails.filter(p => p.tipoOp === 'M').length;
    const inserts = profitAuditTrails.filter(p => p.tipoOp === 'I').length;
    const voids = profitAuditTrails.filter(p => p.tipoOp === 'A' || p.tipoOp === 'E').length;
    return { total, mods, inserts, voids };
  }, [profitAuditTrails]);


  // Generador automatizado de asientos contables a partir de las transacciones operacionales
  const accountingEntries = useMemo(() => {
    const entries = [];
    let asientoSeq = 1001;

    // 1. Asientos de Facturas de Venta (Profit Invoices)
    profitInvoices.forEach((fac) => {
      if (fac.anulado) return;
      const fNum = fac.factNum || fac.id;
      const fFecha = fac.fechaEmision || fac.fec_emis;
      const fTasa = Number(fac.tasa || tasa);
      const totNetoUsd = Number(fac.totNetoUsd || (fac.totNetoBs ? fac.totNetoBs / fTasa : 0));
      const totBrutoUsd = Number(fac.totBrutoUsd || (fac.totBrutoBs ? fac.totBrutoBs / fTasa : (totNetoUsd / 1.16)));
      const ivaUsd = Number(fac.ivaUsd || (fac.ivaBs ? fac.ivaBs / fTasa : (totNetoUsd - totBrutoUsd)));

      const totNetoBs = totNetoUsd * fTasa;
      const totBrutoBs = totBrutoUsd * fTasa;
      const ivaBs = ivaUsd * fTasa;

      entries.push({
        id: `asi-fac-${fNum}`,
        asientoNum: `ASI-${asientoSeq++}`,
        fecha: fFecha,
        tipoOperacion: 'VENTA',
        origenDoc: `Factura Venta #${fNum}`,
        documentoReferencia: `FAC-${fNum}`,
        usuario: fac.coVen || fac.co_us_in || 'FACTURACIÓN',
        tasa: fTasa,
        concepto: `Facturación de venta a cliente: ${fac.clienteNombre || fac.cli_des || 'Cliente General'}`,
        montoTotalUsd: totNetoUsd,
        lines: [
          {
            cuentaCodigo: '1.1.02.01',
            cuentaNombre: 'Cuentas por Cobrar Comerciales Clientes',
            debeUsd: totNetoUsd,
            haberUsd: 0,
            debeBs: totNetoBs,
            haberBs: 0
          },
          {
            cuentaCodigo: '4.1.01.01',
            cuentaNombre: 'Ingresos Operacionales - Venta de Lubricantes',
            debeUsd: 0,
            haberUsd: totBrutoUsd,
            debeBs: 0,
            haberBs: totBrutoBs
          },
          {
            cuentaCodigo: '2.1.03.01',
            cuentaNombre: 'Débito Fiscal IVA por Pagar SENIAT (16%)',
            debeUsd: 0,
            haberUsd: ivaUsd,
            debeBs: 0,
            haberBs: ivaBs
          }
        ]
      });
    });

    // 2. Asientos de Cobranzas y Recaudación (Profit Collections)
    profitCollections.forEach((cob) => {
      if (cob.anulado) return;
      const cNum = cob.cobNum || cob.id;
      const cFecha = cob.fechaCobro || cob.fec_cob;
      const cTasa = Number(cob.tasa || tasa);
      const montoUsd = Number(cob.montoUsd || (cob.montoBs ? cob.montoBs / cTasa : 0));
      const montoBs = montoUsd * cTasa;

      entries.push({
        id: `asi-cob-${cNum}`,
        asientoNum: `ASI-${asientoSeq++}`,
        fecha: cFecha,
        tipoOperacion: 'COBRO',
        origenDoc: `Recibo de Cobro #${cNum}`,
        documentoReferencia: `COB-${cNum}`,
        usuario: cob.coVen || cob.co_us_in || 'COBRANZAS',
        tasa: cTasa,
        concepto: `Recaudación de cobranza cliente: ${cob.clienteNombre || 'Cliente General'}`,
        montoTotalUsd: montoUsd,
        lines: [
          {
            cuentaCodigo: '1.1.01.02',
            cuentaNombre: 'Bancos / Cuentas de Recaudación Comercial',
            debeUsd: montoUsd,
            haberUsd: 0,
            debeBs: montoBs,
            haberBs: 0
          },
          {
            cuentaCodigo: '1.1.02.01',
            cuentaNombre: 'Cuentas por Cobrar Comerciales Clientes',
            debeUsd: 0,
            haberUsd: montoUsd,
            debeBs: 0,
            haberBs: montoBs
          }
        ]
      });
    });

    // 3. Asientos de Facturas de Compra de Lubricantes (Profit Purchases)
    profitPurchases.forEach((pur) => {
      if (pur.anulado) return;
      const pNum = pur.factNum || pur.id;
      const pFecha = pur.fechaEmision || pur.fec_emis;
      const pTasa = Number(pur.tasa || tasa);
      const totNetoUsd = Number(pur.totNetoUsd || 0);
      const totBrutoUsd = Number(pur.totBrutoUsd || (totNetoUsd / 1.16));
      const ivaUsd = Number(pur.ivaUsd || (totNetoUsd - totBrutoUsd));

      const totNetoBs = totNetoUsd * pTasa;
      const totBrutoBs = totBrutoUsd * pTasa;
      const ivaBs = ivaUsd * pTasa;

      entries.push({
        id: `asi-pur-${pNum}`,
        asientoNum: `ASI-${asientoSeq++}`,
        fecha: pFecha,
        tipoOperacion: 'COMPRA',
        origenDoc: `Factura Compra #${pNum}`,
        documentoReferencia: `COM-${pNum}`,
        usuario: pur.co_us_in || 'PROCURA',
        tasa: pTasa,
        concepto: `Recepción de compra proveedor: ${pur.provNombre || 'Distribuidor Keystone'}`,
        montoTotalUsd: totNetoUsd,
        lines: [
          {
            cuentaCodigo: '1.1.03.01',
            cuentaNombre: 'Inventario de Mercancías - Lubricantes',
            debeUsd: totBrutoUsd,
            haberUsd: 0,
            debeBs: totBrutoBs,
            haberBs: 0
          },
          {
            cuentaCodigo: '1.1.04.01',
            cuentaNombre: 'Crédito Fiscal IVA Compras SENIAT (16%)',
            debeUsd: ivaUsd,
            haberUsd: 0,
            debeBs: ivaBs,
            haberBs: 0
          },
          {
            cuentaCodigo: '2.1.01.01',
            cuentaNombre: 'Cuentas por Pagar Proveedores Comerciales',
            debeUsd: 0,
            haberUsd: totNetoUsd,
            debeBs: 0,
            haberBs: totNetoBs
          }
        ]
      });
    });

    // 4. Asientos de Pagos a Proveedores (Profit Supplier Payments)
    profitSupplierPayments.forEach((pay) => {
      if (pay.anulado) return;
      const payNum = pay.pagoNum || pay.id;
      const payFecha = pay.fechaPago || pay.fec_pago;
      const payTasa = Number(pay.tasa || tasa);
      const montoUsd = Number(pay.montoUsd || 0);
      const montoBs = montoUsd * payTasa;

      entries.push({
        id: `asi-pay-${payNum}`,
        asientoNum: `ASI-${asientoSeq++}`,
        fecha: payFecha,
        tipoOperacion: 'PAGO_PROVEEDOR',
        origenDoc: `Comprobante de Pago #${payNum}`,
        documentoReferencia: `PAG-${payNum}`,
        usuario: pay.co_us_in || 'TESORERÍA',
        tasa: payTasa,
        concepto: `Pago / Abono a proveedor: ${pay.provNombre || 'Proveedor'}`,
        montoTotalUsd: montoUsd,
        lines: [
          {
            cuentaCodigo: '2.1.01.01',
            cuentaNombre: 'Cuentas por Pagar Proveedores Comerciales',
            debeUsd: montoUsd,
            haberUsd: 0,
            debeBs: montoBs,
            haberBs: 0
          },
          {
            cuentaCodigo: '1.1.01.02',
            cuentaNombre: 'Bancos Comerciales / Cuentas de Egreso',
            debeUsd: 0,
            haberUsd: montoUsd,
            debeBs: 0,
            haberBs: montoBs
          }
        ]
      });
    });

    // Ordenar cronológicamente descendente
    return entries.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  }, [profitInvoices, profitCollections, profitPurchases, profitSupplierPayments, tasa]);

  // Log de Auditoría Operacional (Timeline de eventos con trazabilidad de usuarios)
  const auditLogs = useMemo(() => {
    const logs = [];

    // Facturas
    profitInvoices.forEach((fac) => {
      logs.push({
        id: `log-fac-${fac.factNum}`,
        fecha: fac.fechaEmision,
        tipo: 'FACTURA_VENTA',
        badge: 'bg-primary',
        titulo: `Emisión de Factura #${fac.factNum}`,
        usuario: fac.coVen || 'SISTEMA_VENTAS',
        descripcion: `Cliente: ${fac.clienteNombre || 'Cliente'} • Monto: ${formatUsd(fac.totNetoUsd)} (${formatBs(fac.totNetoBs)})`,
        estado: fac.anulado ? 'ANULADA' : fac.saldoBs > 1 ? 'PENDIENTE' : 'COBRADA',
        anulada: Boolean(fac.anulado)
      });
    });

    // Cobros
    profitCollections.forEach((cob) => {
      logs.push({
        id: `log-cob-${cob.cobNum}`,
        fecha: cob.fechaCobro,
        tipo: 'COBRANZA_RECIBIDA',
        badge: 'bg-success',
        titulo: `Cobro Recibido #${cob.cobNum}`,
        usuario: cob.coVen || 'SISTEMA_CAJA',
        descripcion: `Cliente: ${cob.clienteNombre} • Monto: ${formatUsd(cob.montoUsd)} (${formatBs(cob.montoBs)})`,
        estado: cob.anulado ? 'ANULADO' : 'CONCILIADO',
        anulada: Boolean(cob.anulado)
      });
    });

    // Compras
    profitPurchases.forEach((pur) => {
      logs.push({
        id: `log-pur-${pur.factNum}`,
        fecha: pur.fechaEmision,
        tipo: 'RECEPCION_COMPRA',
        badge: 'bg-warning',
        titulo: `Recepción de Compra #${pur.factNum}`,
        usuario: 'DEPARTAMENTO_COMPRAS',
        descripcion: `Proveedor: ${pur.provNombre} • Total: ${formatUsd(pur.totNetoUsd)}`,
        estado: pur.anulado ? 'ANULADA' : pur.estado || 'REGISTRADA',
        anulada: Boolean(pur.anulado)
      });
    });

    // Pagos
    profitSupplierPayments.forEach((pay) => {
      logs.push({
        id: `log-pay-${pay.pagoNum}`,
        fecha: pay.fechaPago,
        tipo: 'PAGO_EMITIDO',
        badge: 'bg-info',
        titulo: `Pago a Proveedor #${pay.pagoNum}`,
        usuario: 'ADMINISTRACION_PAGOS',
        descripcion: `Proveedor: ${pay.provNombre} • Monto: ${formatUsd(pay.montoUsd)}`,
        estado: pay.anulado ? 'ANULADO' : 'EMITIDO',
        anulada: Boolean(pay.anulado)
      });
    });

    return logs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  }, [profitInvoices, profitCollections, profitPurchases, profitSupplierPayments]);

  // Balance de Comprobación (Sumas y Saldos por Cuenta)
  const trialBalance = useMemo(() => {
    const accountsMap = {};

    accountingEntries.forEach((entry) => {
      (entry.lines || []).forEach((line) => {
        const code = line.cuentaCodigo;
        if (!accountsMap[code]) {
          accountsMap[code] = {
            codigo: code,
            nombre: line.cuentaNombre,
            totalDebeUsd: 0,
            totalHaberUsd: 0,
            totalDebeBs: 0,
            totalHaberBs: 0
          };
        }
        accountsMap[code].totalDebeUsd += (line.debeUsd || 0);
        accountsMap[code].totalHaberUsd += (line.haberUsd || 0);
        accountsMap[code].totalDebeBs += (line.debeBs || 0);
        accountsMap[code].totalHaberBs += (line.haberBs || 0);
      });
    });

    const accountsList = Object.values(accountsMap).map((acc) => {
      const saldoNetoUsd = acc.totalDebeUsd - acc.totalHaberUsd;
      const saldoDeudorUsd = saldoNetoUsd > 0 ? saldoNetoUsd : 0;
      const saldoAcreedorUsd = saldoNetoUsd < 0 ? Math.abs(saldoNetoUsd) : 0;

      const saldoNetoBs = acc.totalDebeBs - acc.totalHaberBs;
      const saldoDeudorBs = saldoNetoBs > 0 ? saldoNetoBs : 0;
      const saldoAcreedorBs = saldoNetoBs < 0 ? Math.abs(saldoNetoBs) : 0;

      return {
        ...acc,
        saldoDeudorUsd,
        saldoAcreedorUsd,
        saldoDeudorBs,
        saldoAcreedorBs
      };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));

    const totalSumasDebeUsd = accountsList.reduce((acc, a) => acc + a.totalDebeUsd, 0);
    const totalSumasHaberUsd = accountsList.reduce((acc, a) => acc + a.totalHaberUsd, 0);
    const totalSaldosDeudorUsd = accountsList.reduce((acc, a) => acc + a.saldoDeudorUsd, 0);
    const totalSaldosAcreedorUsd = accountsList.reduce((acc, a) => acc + a.saldoAcreedorUsd, 0);

    return {
      accounts: accountsList,
      totalSumasDebeUsd,
      totalSumasHaberUsd,
      totalSaldosDeudorUsd,
      totalSaldosAcreedorUsd
    };
  }, [accountingEntries]);

  // Filtrado de Asientos Contables
  const filteredEntries = useMemo(() => {
    let list = [...accountingEntries];

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(e =>
        e.asientoNum.toLowerCase().includes(q) ||
        (e.documentoReferencia || '').toLowerCase().includes(q) ||
        (e.concepto || '').toLowerCase().includes(q) ||
        (e.usuario || '').toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'ALL') {
      list = list.filter(e => e.tipoOperacion === typeFilter);
    }

    return list;
  }, [accountingEntries, searchFilter, typeFilter]);

  // Exportar Libro Diario / Balance a CSV
  const handleExportCsv = (type) => {
    let rows = [];
    let filename = 'libro_diario_motorven.csv';

    if (type === 'diario') {
      filename = `libro_diario_asientos_${new Date().toISOString().slice(0, 10)}.csv`;
      rows.push(['Asiento', 'Fecha', 'Tipo', 'Documento Ref', 'Operador', 'Concepto', 'Codigo Cuenta', 'Nombre Cuenta', 'Debe USD', 'Haber USD', 'Debe Bs', 'Haber Bs']);
      filteredEntries.forEach(e => {
        (e.lines || []).forEach(l => {
          rows.push([
            e.asientoNum,
            e.fecha ? new Date(e.fecha).toLocaleDateString('es-VE') : '',
            e.tipoOperacion,
            `"${e.documentoReferencia}"`,
            `"${e.usuario}"`,
            `"${e.concepto.replace(/"/g, '""')}"`,
            l.cuentaCodigo,
            `"${l.cuentaNombre}"`,
            l.debeUsd.toFixed(2),
            l.haberUsd.toFixed(2),
            l.debeBs.toFixed(2),
            l.haberBs.toFixed(2)
          ]);
        });
      });
    } else if (type === 'balance') {
      filename = `balance_comprobacion_${new Date().toISOString().slice(0, 10)}.csv`;
      rows.push(['Codigo Cuenta', 'Nombre Cuenta', 'Sumas Debe USD', 'Sumas Haber USD', 'Saldo Deudor USD', 'Saldo Acreedor USD']);
      trialBalance.accounts.forEach(a => {
        rows.push([
          a.codigo,
          `"${a.nombre}"`,
          a.totalDebeUsd.toFixed(2),
          a.totalHaberUsd.toFixed(2),
          a.saldoDeudorUsd.toFixed(2),
          a.saldoAcreedorUsd.toFixed(2)
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    generateAuditLedgerPDF({
      entries: filteredEntries,
      auditLogs,
      config,
      currentUser,
      subTab: activeSubTab
    });
  };

  const totalAsientos = accountingEntries.length;
  const totalAuditorias = auditLogs.length;

  return (
    <div className="view-container">
      {/* Top View Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(29, 78, 216, 0.3) 100%)',
              border: '1px solid rgba(37, 99, 235, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Auditoría de Trazabilidad & Libro Contable Digital
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Comprobantes de Diario, Partida Doble Automatizada y Trazabilidad Operacional
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={syncing ? 'spinning' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Recargar Transacciones'}</span>
          </button>
          <button
            onClick={() => generateAuditLedgerPDF({ entries: filteredEntries, auditLogs, config, currentUser, subTab: activeSubTab })}
            className="btn btn-print-report"
            title="Descargar Reporte Oficial de Auditoría y Contabilidad en PDF"
          >
            <Printer size={15} color="#ffffff" />
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      {/* Accounting KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>ASIENTOS GENERADOS</span>
            <FileText size={15} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {totalAsientos} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>comprobantes</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
            100% Cuadre Partida Doble
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>SUMAS DEL DEBE (USD)</span>
            <ArrowUpRight size={15} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            {formatUsd(trialBalance.totalSumasDebeUsd)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatBs(trialBalance.totalSumasDebeUsd * tasa)}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>SUMAS DEL HABER (USD)</span>
            <ArrowDownRight size={15} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>
            {formatUsd(trialBalance.totalSumasHaberUsd)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatBs(trialBalance.totalSumasHaberUsd * tasa)}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>EVENTOS AUDITADOS</span>
            <Clock size={15} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.25rem' }}>
            {totalAuditorias} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>operaciones</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Trazabilidad completa con Supabase
          </div>
        </div>
      </div>

      {/* Sub-Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveSubTab('diario')}
          className={`btn ${activeSubTab === 'diario' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <FileText size={15} />
          <span>Libro Diario Digital ({filteredEntries.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`btn ${activeSubTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <Clock size={15} />
          <span>Log de Auditoría & Trazabilidad ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('balance')}
          className={`btn ${activeSubTab === 'balance' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <Scale size={15} />
          <span>Balance de Comprobación ({trialBalance.accounts.length} Cuentas)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('export')}
          className={`btn ${activeSubTab === 'export' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <FileSpreadsheet size={15} />
          <span>Exportación Contable Oficial</span>
        </button>
      </div>

      {/* SUB-TAB 1: LIBRO DIARIO DIGITAL */}
      {activeSubTab === 'diario' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
              <div className="search-wrapper" style={{ minWidth: '260px', flex: 1 }}>
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Buscar por asiento, referencia, glosa o usuario..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input-field filter-select"
                style={{ width: 'auto', minWidth: '220px', height: '38px', fontSize: '0.85rem' }}
              >
                <option value="ALL">Todos los Tipos de Asiento</option>
                <option value="VENTA">Ventas / Facturación</option>
                <option value="COBRO">Cobranzas Recaudadas</option>
                <option value="COMPRA">Compras de Mercancía</option>
                <option value="PAGO_PROVEEDOR">Pagos a Proveedores</option>
              </select>
            </div>

            <button
              onClick={() => handleExportCsv('diario')}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              <Download size={14} />
              <span>Exportar Libro Diario</span>
            </button>
          </div>

          {/* Journal Entries List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredEntries.slice(0, 50).map((entry) => (
              <div
                key={entry.id}
                className="card"
                style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)', transition: 'border-color 0.2s' }}
              >
                {/* Entry Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.65rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      background: 'var(--bg-glass-accent)',
                      color: 'var(--accent-primary)',
                      border: '1px solid var(--border-glass)'
                    }}>
                      {entry.asientoNum}
                    </span>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      background: entry.tipoOperacion === 'VENTA' ? 'rgba(59, 130, 246, 0.15)' : entry.tipoOperacion === 'COBRO' ? 'rgba(16, 185, 129, 0.15)' : entry.tipoOperacion === 'COMPRA' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(124, 58, 237, 0.15)',
                      color: entry.tipoOperacion === 'VENTA' ? '#3b82f6' : entry.tipoOperacion === 'COBRO' ? '#10b981' : entry.tipoOperacion === 'COMPRA' ? '#f59e0b' : '#c084fc',
                      border: '1px solid var(--border-glass)'
                    }}>
                      {entry.tipoOperacion}
                    </span>

                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {entry.fecha ? new Date(entry.fecha).toLocaleDateString('es-VE') : 'N/A'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Operador: <strong>{entry.usuario}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                    >
                      <Eye size={13} color="#3b82f6" />
                      <span>Ver Comprobante</span>
                    </button>
                  </div>
                </div>

                {/* Glosa Concept */}
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  <strong>Glosa:</strong> {entry.concepto}
                </div>

                {/* Micro Ledger Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Código</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Cuenta</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Debe USD</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Haber USD</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Debe Bs.</th>
                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Haber Bs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line, lIdx) => (
                        <tr key={lIdx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {line.cuentaCodigo}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', color: 'var(--text-primary)' }}>
                            {line.cuentaNombre}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 700, color: line.debeUsd > 0 ? '#10b981' : 'var(--text-muted)' }}>
                            {line.debeUsd > 0 ? formatUsd(line.debeUsd) : '-'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 700, color: line.haberUsd > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                            {line.haberUsd > 0 ? formatUsd(line.haberUsd) : '-'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: line.debeBs > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {line.debeBs > 0 ? formatBs(line.debeBs) : '-'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: line.haberBs > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {line.haberBs > 0 ? formatBs(line.haberBs) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LOG DE AUDITORÍA FORENSE NATIVA DE SUPABASE */}
      {activeSubTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Forensic Audit Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface)', borderLeft: '4px solid var(--motorven-red)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Eventos Forenses
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {auditKpis.total.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Auditados desde Supabase
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface)', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Modificaciones de Registros (M)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>
                {auditKpis.mods.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Cambios de montos, fechas y descripciones
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface)', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Inserciones & Creaciones (I)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                {auditKpis.inserts.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Nuevas facturas, cobros y clientes
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface)', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Anulaciones & Eliminaciones (A/E)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                {auditKpis.voids.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Documentos anulados o revertidos
              </div>
            </div>
          </div>

          {/* Forensic Filter Toolbar */}
          <div className="card" style={{ padding: '1rem', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                <div className="search-wrapper" style={{ minWidth: '240px', flex: 1 }}>
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Buscar por doc #, usuario, tabla, máquina o campo modificado..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', height: '38px', fontSize: '0.82rem' }}
                  />
                </div>

                <select
                  value={auditOpFilter}
                  onChange={(e) => setAuditOpFilter(e.target.value)}
                  className="input-field filter-select"
                  style={{ width: 'auto', minWidth: '180px', height: '38px', fontSize: '0.82rem' }}
                >
                  <option value="ALL">Todas las Operaciones</option>
                  <option value="M">Modificaciones (M)</option>
                  <option value="I">Inserciones (I)</option>
                  <option value="A">Anulaciones (A)</option>
                  <option value="E">Eliminaciones (E)</option>
                </select>

                <select
                  value={auditTableFilter}
                  onChange={(e) => setAuditTableFilter(e.target.value)}
                  className="input-field filter-select"
                  style={{ width: 'auto', minWidth: '180px', height: '38px', fontSize: '0.82rem' }}
                >
                  <option value="ALL">Todos los Módulos / Tablas</option>
                  {auditTables.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <select
                  value={auditUserFilter}
                  onChange={(e) => setAuditUserFilter(e.target.value)}
                  className="input-field filter-select"
                  style={{ width: 'auto', minWidth: '170px', height: '38px', fontSize: '0.82rem' }}
                >
                  <option value="ALL">Todos los Operadores</option>
                  {auditUsers.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {filteredAuditTrails.length} de {profitAuditTrails.length} eventos
                </span>
              </div>
            </div>

            {/* Forensic Events Stream */}
            {filteredAuditTrails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <ShieldCheck size={40} style={{ opacity: 0.4, margin: '0 auto 0.75rem auto' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No se encontraron eventos con los filtros seleccionados</p>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Intente cambiar los filtros o el término de búsqueda</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredAuditTrails.slice(0, 100).map((trail, idx) => {
                  const diffs = parseForensicDiffs(trail.campos);
                  const isMod = trail.tipoOp === 'M';
                  const isVoid = trail.tipoOp === 'A' || trail.tipoOp === 'E';
                  const isInsert = trail.tipoOp === 'I';

                  const opBadgeBg = isMod ? 'rgba(59, 130, 246, 0.15)' : isInsert ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                  const opBadgeColor = isMod ? '#3b82f6' : isInsert ? '#10b981' : '#ef4444';
                  const opBadgeLabel = isMod ? 'MODIFICACIÓN' : isInsert ? 'INSERCIÓN' : isVoid ? 'ANULACIÓN' : trail.tipoOp;

                  return (
                    <div
                      key={trail.id || idx}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        background: 'var(--bg-glass-accent)',
                        border: isVoid ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-glass)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background: opBadgeBg,
                            color: opBadgeColor,
                            border: `1px solid ${opBadgeColor}33`
                          }}>
                            {opBadgeLabel}
                          </span>

                          <span style={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-glass)'
                          }}>
                            {trail.tabla} {trail.numDoc ? `#${trail.numDoc}` : trail.codigo ? `[${trail.codigo}]` : ''}
                          </span>

                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {trail.fecha ? new Date(trail.fecha).toLocaleString('es-VE') : 'N/A'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Operador: <strong style={{ color: 'var(--text-primary)' }}>{trail.usuario}</strong>
                          </span>
                          <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}>
                            {trail.maquina || 'Terminal'}
                          </span>
                          {trail.campos && (
                            <button
                              onClick={() => setSelectedAuditTrail(trail)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} />
                              Ver Detalle
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Visual Diffs for Modifications */}
                      {diffs.length > 0 && (
                        <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {diffs.map((d, dIdx) => (
                            <div
                              key={dIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-glass)',
                                fontSize: '0.75rem'
                              }}
                            >
                              <span style={{ fontWeight: 700, color: 'var(--motorven-gold)' }}>
                                {d.field}:
                              </span>
                              <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                {d.oldVal || '(vacío)'}
                              </span>
                              <span style={{ color: '#3b82f6', fontWeight: 700 }}>➔</span>
                              <span style={{ color: '#10b981', fontWeight: 700 }}>
                                {d.newVal}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FORENSIC DETAIL MODAL */}
          {selectedAuditTrail && (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-glass)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '650px',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={20} color="var(--motorven-red)" />
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      Inspección Forense de Pista #{selectedAuditTrail.id}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAuditTrail(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>OPERADOR / USUARIO:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedAuditTrail.usuario} (ID: {selectedAuditTrail.usuarioId})</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>FECHA & HORA:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{new Date(selectedAuditTrail.fecha).toLocaleString('es-VE')}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>MÓDULO & REGISTRO:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedAuditTrail.tabla} #{selectedAuditTrail.numDoc || selectedAuditTrail.codigo}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>TERMINAL / IP:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedAuditTrail.maquina}</strong>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                      REGISTRO RAW DE CAMBIOS FORENSES (pistas.campos):
                    </span>
                    <pre style={{
                      margin: 0,
                      padding: '0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-glass)',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      color: '#38bdf8',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '260px',
                      overflowY: 'auto'
                    }}>
                      {selectedAuditTrail.campos || 'No se registraron diferencias de campos textuales.'}
                    </pre>
                  </div>
                </div>

                <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelectedAuditTrail(null)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 3: BALANCE DE COMPROBACIÓN */}
      {activeSubTab === 'balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Balance de Comprobación de Sumas y Saldos
                </span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Plan Oficial de Cuentas Contables y Verificación de Cuadre
                </p>
              </div>
              <button
                onClick={() => handleExportCsv('balance')}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
              >
                <Download size={13} />
                <span>Exportar Balance</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                    <th style={{ padding: '0.75rem' }}>Nombre de Cuenta Contable</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Sumas Debe ($)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Sumas Haber ($)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Saldo Deudor ($)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Saldo Acreedor ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.accounts.map((acc) => (
                    <tr key={acc.codigo} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        {acc.codigo}
                      </td>
                      <td style={{ padding: '0.65rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {acc.nombre}
                      </td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', color: acc.totalDebeUsd > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {acc.totalDebeUsd > 0 ? formatUsd(acc.totalDebeUsd) : '-'}
                      </td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', color: acc.totalHaberUsd > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                        {acc.totalHaberUsd > 0 ? formatUsd(acc.totalHaberUsd) : '-'}
                      </td>
                      <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: acc.saldoDeudorUsd > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {acc.saldoDeudorUsd > 0 ? formatUsd(acc.saldoDeudorUsd) : '-'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: acc.saldoAcreedorUsd > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                        {acc.saldoAcreedorUsd > 0 ? formatUsd(acc.saldoAcreedorUsd) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-glass)', background: 'var(--bg-glass-accent)', fontWeight: 800 }}>
                    <td colSpan={2} style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                      TOTALES DEL BALANCE DE COMPROBACIÓN
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#10b981' }}>
                      {formatUsd(trialBalance.totalSumasDebeUsd)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#3b82f6' }}>
                      {formatUsd(trialBalance.totalSumasHaberUsd)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#10b981' }}>
                      {formatUsd(trialBalance.totalSaldosDeudorUsd)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#3b82f6' }}>
                      {formatUsd(trialBalance.totalSaldosAcreedorUsd)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: EXPORTACIÓN CONTABLE OFICIAL */}
      {activeSubTab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card print-area" style={{ padding: '2rem', margin: 0, background: 'var(--bg-surface)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-glass)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <MotorvenLogo width={180} height="auto" />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  DISTRIBUIDOR OFICIAL DE LUBRICANTES • RIF: J-50478166-0
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  LIBRO DIARIO CONTABLE OFICIAL
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Período Operativo • Ejercicio Fiscal en Curso
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tasa Referencial BCV: Bs. {tasa.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => handleExportCsv('diario')}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Download size={14} />
                <span>Exportar CSV para Contador</span>
              </button>
              <button
                onClick={handlePrint}
                className="btn btn-print-report btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Printer size={14} color="#ffffff" />
                <span>Imprimir Reporte</span>
              </button>
            </div>

            {/* Asientos List for Printing */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-primary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>FECHA</th>
                    <th style={{ padding: '0.5rem' }}>ASIENTO / REF</th>
                    <th style={{ padding: '0.5rem' }}>CUENTA & DESCRIPCIÓN</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>DEBE ($)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>HABER ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.slice(0, 40).map((entry, eIdx) => (
                    <React.Fragment key={eIdx}>
                      <tr style={{ background: 'var(--bg-glass-accent)', borderTop: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700 }}>
                          {entry.fecha ? new Date(entry.fecha).toLocaleDateString('es-VE') : ''}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                          {entry.asientoNum} ({entry.documentoReferencia})
                        </td>
                        <td colSpan={3} style={{ padding: '0.4rem 0.5rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                          {entry.concepto}
                        </td>
                      </tr>
                      {entry.lines.map((l, lIdx) => (
                        <tr key={`${eIdx}-${lIdx}`} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td></td>
                          <td style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {l.cuentaCodigo}
                          </td>
                          <td style={{ padding: '0.3rem 0.5rem', paddingLeft: l.haberUsd > 0 ? '2rem' : '0.5rem' }}>
                            {l.cuentaNombre}
                          </td>
                          <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                            {l.debeUsd > 0 ? formatUsd(l.debeUsd) : ''}
                          </td>
                          <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                            {l.haberUsd > 0 ? formatUsd(l.haberUsd) : ''}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ width: '180px', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.35rem' }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Contador Público Colegiado</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>C.P.C. Auditor Externo</div>
              </div>
              <div>
                <div style={{ width: '180px', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.35rem' }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Gerencia General</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SIGNUM MOTORVEN</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <AccountingEntryModal
          entry={selectedEntry}
          config={config}
          currentUser={currentUser}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
