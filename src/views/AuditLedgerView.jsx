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
  ArrowDownRight,
  BookOpen,
  TrendingUp
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import {
  CHART_OF_ACCOUNTS,
  generateAccountingEntries,
  buildTrialBalance,
  buildGeneralLedger,
  buildFinancialStatements
} from '../services/accountingService';
import AccountingEntryModal from '../components/AccountingEntryModal';
import MotorvenLogo from '../components/MotorvenLogo';
import {
  generateAuditLedgerPDF,
  generateTrialBalancePDF,
  generateGeneralLedgerPDF,
  generateFinancialStatementsPDF
} from '../services/pdfReportService';

export default function AuditLedgerView({
  profitInvoices = [],
  profitCollections = [],
  profitPurchases = [],
  profitSupplierPayments = [],
  profitBankAccounts = [],
  profitCashDesks = [],
  cashDesks = [],
  profitAuditTrails = [],
  cashMovements = [],
  usersList = [],
  config,
  onSyncProfit,
  currentUser
}) {
  const [activeSubTab, setActiveSubTab] = useState('diario'); // 'diario' | 'mayor' | 'balance' | 'estados' | 'plan' | 'audit' | 'export'
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Plan de Cuentas & Mayor General Filter States
  const [planSearch, setPlanSearch] = useState('');
  const [planGrupoFilter, setPlanGrupoFilter] = useState('ALL');
  const [planOnlyImputable, setPlanOnlyImputable] = useState(false);
  const [selectedMayorCode, setSelectedMayorCode] = useState('');

  // Forensic Audit Filter States
  const [auditSearch, setAuditSearch] = useState('');
  const [auditOpFilter, setAuditOpFilter] = useState('ALL');
  const [auditTableFilter, setAuditTableFilter] = useState('ALL');
  const [auditUserFilter, setAuditUserFilter] = useState('ALL');
  const [selectedAuditTrail, setSelectedAuditTrail] = useState(null);

  const tasa = config?.tasaDolar || 827.73;
  const resolvedDesks = profitCashDesks && profitCashDesks.length > 0 ? profitCashDesks : cashDesks;

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


  // Motor Contable Oficial (Asientos de Ventas, Cobranzas, Compras, Pagos y Caja Chica)
  const accountingEntries = useMemo(() => {
    return generateAccountingEntries({
      profitInvoices,
      profitCollections,
      profitPurchases,
      profitSupplierPayments,
      cashMovements,
      profitBankAccounts,
      desksList: resolvedDesks,
      tasa
    });
  }, [profitInvoices, profitCollections, profitPurchases, profitSupplierPayments, cashMovements, profitBankAccounts, resolvedDesks, tasa]);

  // Log de Auditoría Operacional (Timeline de eventos con trazabilidad de usuarios)
  const auditLogs = useMemo(() => {
    const logs = [];

    profitInvoices.forEach((fac) => {
      logs.push({
        id: `log-fac-${fac.factNum || fac.id}`,
        fecha: fac.fechaEmision || fac.fec_emis,
        tipo: 'FACTURA_VENTA',
        badge: 'bg-primary',
        titulo: `Emisión de Factura #${fac.factNum || fac.id}`,
        usuario: fac.coVen || fac.co_us_in || 'SISTEMA_VENTAS',
        descripcion: `Cliente: ${fac.clienteNombre || fac.cli_des || 'Cliente'} • Monto: ${formatUsd(fac.totNetoUsd)} (${formatBs(fac.totNetoBs)})`,
        estado: fac.anulado || fac.anulada ? 'ANULADA' : fac.saldoBs > 1 ? 'PENDIENTE' : 'COBRADA',
        anulada: Boolean(fac.anulado || fac.anulada)
      });
    });

    profitCollections.forEach((cob) => {
      logs.push({
        id: `log-cob-${cob.cobNum || cob.id}`,
        fecha: cob.fechaCobro || cob.fec_cob,
        tipo: 'COBRANZA_RECIBIDA',
        badge: 'bg-success',
        titulo: `Cobro Recibido #${cob.cobNum || cob.id}`,
        usuario: cob.coVen || cob.co_us_in || 'SISTEMA_CAJA',
        descripcion: `Cliente: ${cob.clienteNombre || 'Cliente'} • Monto: ${formatUsd(cob.montoUsd)} (${formatBs(cob.montoBs)})`,
        estado: cob.anulado || cob.anulada ? 'ANULADO' : 'CONCILIADO',
        anulada: Boolean(cob.anulado || cob.anulada)
      });
    });

    profitPurchases.forEach((pur) => {
      logs.push({
        id: `log-pur-${pur.factNum || pur.id}`,
        fecha: pur.fechaEmision || pur.fec_emis,
        tipo: 'RECEPCION_COMPRA',
        badge: 'bg-warning',
        titulo: `Recepción de Compra #${pur.factNum || pur.id}`,
        usuario: pur.co_us_in || 'DEPARTAMENTO_COMPRAS',
        descripcion: `Proveedor: ${pur.provNombre || 'Proveedor'} • Total: ${formatUsd(pur.totNetoUsd)}`,
        estado: pur.anulado || pur.anulada ? 'ANULADA' : pur.estado || 'REGISTRADA',
        anulada: Boolean(pur.anulado || pur.anulada)
      });
    });

    profitSupplierPayments.forEach((pay) => {
      logs.push({
        id: `log-pay-${pay.pagoNum || pay.id}`,
        fecha: pay.fechaPago || pay.fec_pago,
        tipo: 'PAGO_EMITIDO',
        badge: 'bg-info',
        titulo: `Pago a Proveedor #${pay.pagoNum || pay.id}`,
        usuario: pay.co_us_in || 'ADMINISTRACION_PAGOS',
        descripcion: `Proveedor: ${pay.provNombre || 'Proveedor'} • Monto: ${formatUsd(pay.montoUsd)}`,
        estado: pay.anulado || pay.anulada ? 'ANULADO' : 'EMITIDO',
        anulada: Boolean(pay.anulado || pay.anulada)
      });
    });

    cashMovements.forEach((mov, idx) => {
      const isEgreso = (mov.tipo || 'EGRESO').toUpperCase() === 'EGRESO';
      logs.push({
        id: `log-mov-${mov.id || idx}`,
        fecha: mov.fecha || mov.createdAt || new Date().toISOString(),
        tipo: isEgreso ? 'EGRESO_CAJA' : 'INGRESO_CAJA',
        badge: isEgreso ? 'bg-danger' : 'bg-success',
        titulo: `${isEgreso ? 'Egreso' : 'Ingreso'} Caja Chica #${mov.id || idx + 1}`,
        usuario: mov.usuario || 'ADMINISTRACIÓN',
        descripcion: `Concepto: ${mov.concepto || 'Movimiento'} • Monto: ${formatUsd(mov.montoUsd)} (${formatBs(mov.montoBs || mov.montoUsd * tasa)})`,
        estado: 'CONCILIADO',
        anulada: false
      });
    });

    return logs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  }, [profitInvoices, profitCollections, profitPurchases, profitSupplierPayments, cashMovements, tasa]);

  const trialBalance = useMemo(() => buildTrialBalance(accountingEntries), [accountingEntries]);
  const generalLedger = useMemo(() => buildGeneralLedger(accountingEntries), [accountingEntries]);
  const activeMayorAccount = useMemo(() => {
    const accounts = generalLedger.accounts || [];
    if (accounts.length === 0) return null;
    if (selectedMayorCode && generalLedger.accountsByCode[selectedMayorCode]) {
      return generalLedger.accountsByCode[selectedMayorCode];
    }
    return accounts.find(a => a.codigo === '1.01.03.001') || accounts[0];
  }, [generalLedger, selectedMayorCode]);
  const financialStatements = useMemo(() => buildFinancialStatements(trialBalance), [trialBalance]);

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

  const filteredPlanAccounts = useMemo(() => {
    return CHART_OF_ACCOUNTS.filter((acc) => {
      if (planGrupoFilter !== 'ALL' && acc.grupo !== planGrupoFilter) return false;
      if (planOnlyImputable && !acc.imputable) return false;
      if (planSearch.trim()) {
        const q = planSearch.toLowerCase();
        return (
          acc.codigo.toLowerCase().includes(q) ||
          acc.nombre.toLowerCase().includes(q) ||
          (acc.subgrupo || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [planGrupoFilter, planOnlyImputable, planSearch]);

  const accountBalanceMap = useMemo(() => {
    const map = {};
    (trialBalance.accounts || []).forEach(a => {
      map[a.codigo] = a;
    });
    return map;
  }, [trialBalance]);

  // Exportar Libro Diario / Balance / Mayor / Estados / Plan a CSV
  const handleExportCsv = (type) => {
    const rows = [];
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
    } else if (type === 'plan') {
      filename = `plan_de_cuentas_motorven_${new Date().toISOString().slice(0, 10)}.csv`;
      rows.push(['Codigo', 'Nombre Cuenta', 'Nivel', 'Naturaleza', 'Imputable', 'Grupo', 'Subgrupo']);
      CHART_OF_ACCOUNTS.forEach(a => {
        rows.push([`"${a.codigo}"`, `"${a.nombre}"`, a.nivel, a.naturaleza, a.imputable ? 'SI' : 'NO', a.grupo, `"${a.subgrupo || ''}"`]);
      });
    } else if (type === 'mayor') {
      const target = activeMayorAccount;
      filename = `mayor_general_${target ? target.codigo.replace(/\./g, '_') : 'motorven'}_${new Date().toISOString().slice(0, 10)}.csv`;
      rows.push(['Codigo', 'Cuenta', 'Fecha', 'Asiento', 'Referencia', 'Concepto', 'Debe USD', 'Haber USD', 'Saldo Acumulado USD']);
      (target ? [target] : generalLedger.accounts).forEach(acc => {
        acc.movements.forEach(m => {
          rows.push([
            acc.codigo,
            `"${acc.nombre}"`,
            m.fecha ? new Date(m.fecha).toLocaleDateString('es-VE') : '',
            m.asientoNum,
            `"${m.documentoReferencia}"`,
            `"${(m.concepto || '').replace(/"/g, '""')}"`,
            m.debeUsd.toFixed(2),
            m.haberUsd.toFixed(2),
            m.saldoAcumuladoUsd.toFixed(2)
          ]);
        });
      });
    } else if (type === 'estados') {
      filename = `estados_financieros_motorven_${new Date().toISOString().slice(0, 10)}.csv`;
      const { estadoResultados: er, balanceGeneral: bg } = financialStatements;
      rows.push(['Estado', 'Grupo', 'Codigo', 'Cuenta', 'Saldo USD', 'Saldo Bs']);
      er.ingresos.forEach(i => rows.push(['ESTADO RESULTADOS', 'INGRESOS', i.codigo, `"${i.nombre}"`, i.saldoUsd.toFixed(2), i.saldoBs.toFixed(2)]));
      er.costos.forEach(i => rows.push(['ESTADO RESULTADOS', 'COSTOS', i.codigo, `"${i.nombre}"`, i.saldoUsd.toFixed(2), i.saldoBs.toFixed(2)]));
      er.egresos.forEach(i => rows.push(['ESTADO RESULTADOS', 'EGRESOS', i.codigo, `"${i.nombre}"`, i.saldoUsd.toFixed(2), i.saldoBs.toFixed(2)]));
      rows.push(['ESTADO RESULTADOS', 'RESULTADO EJERCICIO', er.cuentaResultadoCodigo, `"${er.cuentaResultadoNombre}"`, er.resultadoEjercicioUsd.toFixed(2), er.resultadoEjercicioBs.toFixed(2)]);
      bg.activo.forEach(i => rows.push(['BALANCE GENERAL', 'ACTIVO', i.codigo, `"${i.nombre}"`, i.saldoUsd.toFixed(2), i.saldoBs.toFixed(2)]));
      bg.pasivo.forEach(i => rows.push(['BALANCE GENERAL', 'PASIVO', i.codigo, `"${i.nombre}"`, i.saldoUsd.toFixed(2), i.saldoBs.toFixed(2)]));
      bg.patrimonio.forEach(i => rows.push(['BALANCE GENERAL', 'PATRIMONIO', i.codigo, `"${i.nombre}"`, i.saldoUsd.toFixed(2), i.saldoBs.toFixed(2)]));
      rows.push(['BALANCE GENERAL', 'PATRIMONIO', er.cuentaResultadoCodigo, `"${er.cuentaResultadoNombre}"`, bg.resultadoEjercicioUsd.toFixed(2), bg.resultadoEjercicioBs.toFixed(2)]);
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
      trialBalance,
      generalLedger,
      activeMayorAccount,
      financialStatements,
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
            onClick={handlePrint}
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
          <span>Libro Diario ({filteredEntries.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('mayor')}
          className={`btn ${activeSubTab === 'mayor' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <BookOpen size={15} />
          <span>Mayor General ({generalLedger.accounts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('balance')}
          className={`btn ${activeSubTab === 'balance' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <Scale size={15} />
          <span>Balance Comprobación ({trialBalance.accounts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('estados')}
          className={`btn ${activeSubTab === 'estados' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <TrendingUp size={15} />
          <span>Estados Financieros (BA VEN-NIF 2)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('plan')}
          className={`btn ${activeSubTab === 'plan' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <Layers size={15} />
          <span>Plan de Cuentas ({CHART_OF_ACCOUNTS.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`btn ${activeSubTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <Clock size={15} />
          <span>Auditoría ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('export')}
          className={`btn ${activeSubTab === 'export' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <FileSpreadsheet size={15} />
          <span>Exportación Oficial</span>
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

      {/* SUB-TAB: MAYOR GENERAL ANALÍTICO */}
      {activeSubTab === 'mayor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1rem 1.25rem', margin: 0, background: 'var(--bg-surface)', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  SELECCIONE CUENTA CONTABLE PARA INSPECCIONAR SU MAYOR ANALÍTICO
                </label>
                <select
                  value={activeMayorAccount?.codigo || ''}
                  onChange={(e) => setSelectedMayorCode(e.target.value)}
                  className="input-field filter-select"
                  style={{ width: '100%', height: '40px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  {generalLedger.accounts.map((acc) => (
                    <option key={acc.codigo} value={acc.codigo}>
                      {acc.codigo} — {acc.nombre} ({acc.movements.length} movs | Saldo: {formatUsd(acc.saldoFinalUsd)})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <button
                  onClick={() => handleExportCsv('mayor')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '40px' }}
                >
                  <Download size={14} />
                  <span>Exportar Mayor CSV</span>
                </button>
                <button
                  onClick={() => generateGeneralLedgerPDF({ account: activeMayorAccount, generalLedger, entries: filteredEntries, config, currentUser })}
                  className="btn btn-print-report btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '40px' }}
                  title="Imprimir Libro Mayor General de la cuenta seleccionada en PDF"
                >
                  <Printer size={14} color="#ffffff" />
                  <span>Imprimir Mayor PDF</span>
                </button>
              </div>
            </div>

            {activeMayorAccount && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>NATURALEZA / GRUPO</span>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {activeMayorAccount.naturaleza} ({activeMayorAccount.grupo})
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL CARGOS (DEBE)</span>
                  <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>
                    {formatUsd(activeMayorAccount.totalDebeUsd)}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL ABONOS (HABER)</span>
                  <strong style={{ fontSize: '0.95rem', color: '#3b82f6' }}>
                    {formatUsd(activeMayorAccount.totalHaberUsd)}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>SALDO FINAL ACUMULADO</span>
                  <strong style={{ fontSize: '1rem', color: activeMayorAccount.saldoFinalUsd >= 0 ? 'var(--text-primary)' : '#f59e0b' }}>
                    {formatUsd(activeMayorAccount.saldoFinalUsd)}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {activeMayorAccount && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '0.7rem 1rem' }}>Fecha</th>
                      <th style={{ padding: '0.7rem' }}>Asiento / Ref.</th>
                      <th style={{ padding: '0.7rem' }}>Concepto / Glosa</th>
                      <th style={{ padding: '0.7rem', textAlign: 'right' }}>Debe ($)</th>
                      <th style={{ padding: '0.7rem', textAlign: 'right' }}>Haber ($)</th>
                      <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Saldo Acumulado ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMayorAccount.movements.slice(-200).map((mov, mIdx) => (
                      <tr key={mIdx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '0.55rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {mov.fecha ? new Date(mov.fecha).toLocaleDateString('es-VE') : 'N/A'}
                        </td>
                        <td style={{ padding: '0.55rem', fontWeight: 700, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
                          {mov.asientoNum} ({mov.documentoReferencia})
                        </td>
                        <td style={{ padding: '0.55rem', color: 'var(--text-primary)' }}>
                          {mov.concepto}
                        </td>
                        <td style={{ padding: '0.55rem', textAlign: 'right', fontWeight: 600, color: mov.debeUsd > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {mov.debeUsd > 0 ? formatUsd(mov.debeUsd) : '-'}
                        </td>
                        <td style={{ padding: '0.55rem', textAlign: 'right', fontWeight: 600, color: mov.haberUsd > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                          {mov.haberUsd > 0 ? formatUsd(mov.haberUsd) : '-'}
                        </td>
                        <td style={{ padding: '0.55rem 1rem', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatUsd(mov.saldoAcumuladoUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activeMayorAccount.movements.length > 200 && (
                <div style={{ padding: '0.65rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)' }}>
                  Mostrando los últimos 200 movimientos cronológicos de {activeMayorAccount.movements.length}. Use &quot;Exportar Mayor CSV&quot; para descargar el histórico completo.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: BALANCE DE COMPROBACIÓN */}
      {activeSubTab === 'balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    Balance de Comprobación de Sumas y Saldos
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: trialBalance.isBalanced ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: trialBalance.isBalanced ? '#10b981' : '#ef4444'
                  }}>
                    {trialBalance.isBalanced ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {trialBalance.isBalanced ? 'CUADRADO (DEBE = HABER)' : 'CON DESCUADRE'}
                  </span>
                </div>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Plan Oficial de Cuentas Contables • Haga clic en cualquier cuenta para ver su Mayor General
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleExportCsv('balance')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                >
                  <Download size={13} />
                  <span>Exportar Balance CSV</span>
                </button>
                <button
                  onClick={() => generateTrialBalancePDF({ trialBalance, entries: filteredEntries, config, currentUser })}
                  className="btn btn-print-report btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                  title="Imprimir Balance de Comprobación de Sumas y Saldos en PDF"
                >
                  <Printer size={13} color="#ffffff" />
                  <span>Imprimir Balance PDF</span>
                </button>
              </div>
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
                    <tr
                      key={acc.codigo}
                      onClick={() => {
                        setSelectedMayorCode(acc.codigo);
                        setActiveSubTab('mayor');
                      }}
                      style={{ borderBottom: '1px solid var(--border-glass)', cursor: 'pointer' }}
                      title="Clic para inspeccionar movimientos en el Libro Mayor General"
                    >
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

      {/* SUB-TAB: ESTADOS FINANCIEROS BÁSICOS (BA VEN-NIF 2) */}
      {activeSubTab === 'estados' && (() => {
        const { estadoResultados, balanceGeneral } = financialStatements;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card" style={{
              padding: '1rem 1.25rem',
              margin: 0,
              background: 'var(--bg-surface)',
              borderLeft: `4px solid ${balanceGeneral.ecuacionCuadrada ? '#10b981' : '#ef4444'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {balanceGeneral.ecuacionCuadrada
                    ? <CheckCircle2 size={18} color="#10b981" />
                    : <AlertTriangle size={18} color="#ef4444" />}
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    Ecuación Patrimonial BA VEN-NIF 2: Activo = Pasivo + Patrimonio + Resultado
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Activo: <strong>{formatUsd(balanceGeneral.totalActivoUsd)}</strong> | Pasivo + Patrimonio: <strong>{formatUsd(balanceGeneral.totalPasivoYPatrimonioUsd)}</strong> | Diferencia: <strong>{formatUsd(balanceGeneral.diferenciaEcuacionUsd)}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleExportCsv('estados')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Download size={14} />
                  <span>Exportar Estados CSV</span>
                </button>
                <button
                  onClick={() => generateFinancialStatementsPDF({ financialStatements, trialBalance, entries: filteredEntries, config, currentUser })}
                  className="btn btn-print-report btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Imprimir Estados Financieros Básicos BA VEN-NIF 2 en PDF"
                >
                  <Printer size={14} color="#ffffff" />
                  <span>Imprimir Estados PDF</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
              {/* Estado de Resultados Integral */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
                <div style={{ padding: '0.9rem 1.15rem', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Estado de Resultados Integral
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Grupos 4 (Ingresos), 5 (Costos) y 6 (Egresos Operativos)
                  </p>
                </div>
                <div style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.84rem' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#3b82f6', marginBottom: '0.4rem', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      4. Ingresos Operacionales y Otros
                    </div>
                    {estadoResultados.ingresos.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin movimientos registrados.</div>
                    ) : estadoResultados.ingresos.map((item) => (
                      <div key={item.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-glass)' }}>
                        <span><strong style={{ color: 'var(--accent-primary)' }}>{item.codigo}</strong> {item.nombre}</span>
                        <span style={{ fontWeight: 600 }}>{formatUsd(item.saldoUsd)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      <span>Total Ingresos Netos</span>
                      <span>{formatUsd(estadoResultados.totalIngresosUsd)}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, color: '#8b5cf6', marginBottom: '0.4rem', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      5. Costos de Ventas y Servicios
                    </div>
                    {estadoResultados.costos.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin costos registrados en el período.</div>
                    ) : estadoResultados.costos.map((item) => (
                      <div key={item.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-glass)' }}>
                        <span><strong style={{ color: 'var(--accent-primary)' }}>{item.codigo}</strong> {item.nombre}</span>
                        <span style={{ fontWeight: 600 }}>({formatUsd(item.saldoUsd)})</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', fontWeight: 800, color: 'var(--text-primary)', borderTop: '1px solid var(--border-glass)' }}>
                      <span>Utilidad Bruta</span>
                      <span>{formatUsd(estadoResultados.utilidadBrutaUsd)}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, color: '#ec4899', marginBottom: '0.4rem', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      6. Gastos Operativos / Egresos
                    </div>
                    {estadoResultados.egresos.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin egresos operativos en el período.</div>
                    ) : estadoResultados.egresos.map((item) => (
                      <div key={item.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-glass)' }}>
                        <span><strong style={{ color: 'var(--accent-primary)' }}>{item.codigo}</strong> {item.nombre}</span>
                        <span style={{ fontWeight: 600 }}>({formatUsd(item.saldoUsd)})</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      <span>Total Gastos Operativos</span>
                      <span>({formatUsd(estadoResultados.totalEgresosUsd)})</span>
                    </div>
                  </div>

                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: estadoResultados.resultadoEjercicioUsd >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${estadoResultados.resultadoEjercicioUsd >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 800,
                    fontSize: '0.95rem'
                  }}>
                    <span>{estadoResultados.cuentaResultadoCodigo} — {estadoResultados.cuentaResultadoNombre}</span>
                    <span style={{ color: estadoResultados.resultadoEjercicioUsd >= 0 ? '#10b981' : '#ef4444' }}>
                      {formatUsd(estadoResultados.resultadoEjercicioUsd)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance General */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
                <div style={{ padding: '0.9rem 1.15rem', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Balance General (Situación Financiera)
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Grupos 1 (Activo), 2 (Pasivo) y 3 (Patrimonio)
                  </p>
                </div>
                <div style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.84rem' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#10b981', marginBottom: '0.4rem', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      1. Activo
                    </div>
                    {balanceGeneral.activo.map((item) => (
                      <div key={item.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-glass)' }}>
                        <span><strong style={{ color: 'var(--accent-primary)' }}>{item.codigo}</strong> {item.nombre}</span>
                        <span style={{ fontWeight: 600 }}>{formatUsd(item.saldoUsd)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', fontWeight: 800, color: '#10b981', fontSize: '0.92rem' }}>
                      <span>TOTAL ACTIVO</span>
                      <span>{formatUsd(balanceGeneral.totalActivoUsd)}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, color: '#ef4444', marginBottom: '0.4rem', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      2. Pasivo
                    </div>
                    {balanceGeneral.pasivo.map((item) => (
                      <div key={item.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-glass)' }}>
                        <span><strong style={{ color: 'var(--accent-primary)' }}>{item.codigo}</strong> {item.nombre}</span>
                        <span style={{ fontWeight: 600 }}>{formatUsd(item.saldoUsd)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      <span>Total Pasivo</span>
                      <span>{formatUsd(balanceGeneral.totalPasivoUsd)}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: '0.4rem', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      3. Patrimonio Neto
                    </div>
                    {balanceGeneral.patrimonio.map((item) => (
                      <div key={item.codigo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-glass)' }}>
                        <span><strong style={{ color: 'var(--accent-primary)' }}>{item.codigo}</strong> {item.nombre}</span>
                        <span style={{ fontWeight: 600 }}>{formatUsd(item.saldoUsd)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-glass)' }}>
                      <span><strong style={{ color: 'var(--accent-primary)' }}>{estadoResultados.cuentaResultadoCodigo}</strong> {estadoResultados.cuentaResultadoNombre}</span>
                      <span style={{ fontWeight: 700 }}>{formatUsd(balanceGeneral.resultadoEjercicioUsd)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      <span>Total Patrimonio</span>
                      <span>{formatUsd(balanceGeneral.totalPatrimonioUsd)}</span>
                    </div>
                  </div>

                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'var(--bg-glass-accent)',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 800,
                    fontSize: '0.92rem'
                  }}>
                    <span>TOTAL PASIVO + PATRIMONIO</span>
                    <span style={{ color: '#3b82f6' }}>{formatUsd(balanceGeneral.totalPasivoYPatrimonioUsd)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUB-TAB: PLAN DE CUENTAS OFICIAL */}
      {activeSubTab === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1rem 1.25rem', margin: 0, background: 'var(--bg-surface)', borderLeft: '4px solid var(--motorven-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'var(--motorven-red)', color: '#fff' }}>
                    CATÁLOGO INSTITUCIONAL
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    RIF: <strong>J-50780548-4</strong> • Centro Costos: <strong>001</strong>
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                    Norma: BA VEN-NIF 2
                  </span>
                </div>
                <h3 style={{ margin: '0.5rem 0 0.2rem 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Plan de Cuentas Oficial — Pro Motorven C.A.
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Estructura jerárquica de 4 niveles para registro de transacciones comerciales, retenciones SENIAT y tesorería multi-moneda.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => handleExportCsv('plan')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Download size={14} />
                  <span>Exportar Plan CSV</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-glass)' }}>
              {[
                { key: 'ALL', label: 'Todos los Grupos', count: CHART_OF_ACCOUNTS.length },
                { key: 'ACTIVO', label: '1. Activos', count: CHART_OF_ACCOUNTS.filter(a => a.grupo === 'ACTIVO').length },
                { key: 'PASIVO', label: '2. Pasivos', count: CHART_OF_ACCOUNTS.filter(a => a.grupo === 'PASIVO').length },
                { key: 'PATRIMONIO', label: '3. Patrimonio', count: CHART_OF_ACCOUNTS.filter(a => a.grupo === 'PATRIMONIO').length },
                { key: 'INGRESOS', label: '4. Ingresos', count: CHART_OF_ACCOUNTS.filter(a => a.grupo === 'INGRESOS').length },
                { key: 'COSTOS', label: '5. Costos', count: CHART_OF_ACCOUNTS.filter(a => a.grupo === 'COSTOS').length },
                { key: 'EGRESOS', label: '6. Egresos', count: CHART_OF_ACCOUNTS.filter(a => a.grupo === 'EGRESOS').length }
              ].map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setPlanGrupoFilter(g.key)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: planGrupoFilter === g.key ? 'var(--accent-primary)' : 'var(--bg-glass-accent)',
                    color: planGrupoFilter === g.key ? '#fff' : 'var(--text-secondary)',
                    border: planGrupoFilter === g.key ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)'
                  }}
                >
                  {g.label} ({g.count})
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="search-wrapper" style={{ minWidth: '280px', flex: 1 }}>
              <Search size={15} />
              <input
                type="text"
                placeholder="Buscar por código de cuenta o nombre (ej. 1.01.01.001, Banco, Inventario, Retención)..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="input-field"
                style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={planOnlyImputable}
                onChange={(e) => setPlanOnlyImputable(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <span>Solo Cuentas Imputables (Nivel 4 / Registros Operativos)</span>
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mostrando <strong>{filteredPlanAccounts.length}</strong> de <strong>{CHART_OF_ACCOUNTS.length}</strong> cuentas
            </span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0, background: 'var(--bg-surface)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-glass-accent)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '140px' }}>Código</th>
                    <th style={{ padding: '0.75rem' }}>Descripción / Nombre de Cuenta</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Nivel</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>Naturaleza</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', width: '110px' }}>Imputable</th>
                    <th style={{ padding: '0.75rem', width: '130px' }}>Subgrupo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '140px' }}>Saldo Período</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlanAccounts.map((acc) => {
                    const bal = accountBalanceMap[acc.codigo];
                    const n1 = acc.nivel === 1;
                    const n2 = acc.nivel === 2;
                    const n3 = acc.nivel === 3;
                    const n4 = acc.nivel === 4;
                    const indent = n1 ? '0rem' : n2 ? '1rem' : n3 ? '2rem' : '3.25rem';
                    return (
                      <tr
                        key={acc.codigo}
                        style={{
                          borderBottom: '1px solid var(--border-glass)',
                          background: n1 ? 'rgba(255, 255, 255, 0.04)' : n2 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <td style={{
                          padding: '0.65rem 1rem',
                          fontWeight: n1 ? 900 : n2 ? 800 : n3 ? 700 : 600,
                          color: n1 ? 'var(--motorven-red)' : n4 ? 'var(--accent-primary)' : 'var(--text-primary)',
                          fontFamily: 'monospace',
                          fontSize: n1 ? '0.9rem' : '0.82rem'
                        }}>
                          {acc.codigo}
                        </td>
                        <td style={{
                          padding: '0.65rem',
                          paddingLeft: `calc(0.65rem + ${indent})`,
                          fontWeight: n1 ? 900 : n2 ? 700 : n3 ? 600 : 400,
                          color: n1 ? 'var(--text-heading)' : n4 ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: n1 ? '0.92rem' : n2 ? '0.86rem' : '0.82rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {n4 && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>↳</span>}
                            <span>{acc.nombre}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: n1 ? 'rgba(239, 68, 68, 0.15)' : n2 ? 'rgba(59, 130, 246, 0.15)' : n3 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: n1 ? '#ef4444' : n2 ? '#3b82f6' : n3 ? '#f59e0b' : '#10b981'
                          }}>
                            Nivel {acc.nivel}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: acc.naturaleza === 'DEUDORA' ? '#10b981' : '#3b82f6' }}>
                            {acc.naturaleza}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          {acc.imputable ? (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              ✓ Imputable
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)'
                            }}>
                              Mayor
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {acc.subgrupo || '—'}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                          {bal ? (
                            bal.saldoDeudorUsd > 0 ? (
                              <span style={{ color: '#10b981' }} title="Saldo Deudor">{formatUsd(bal.saldoDeudorUsd)} D</span>
                            ) : bal.saldoAcreedorUsd > 0 ? (
                              <span style={{ color: '#3b82f6' }} title="Saldo Acreedor">{formatUsd(bal.saldoAcreedorUsd)} H</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>$ 0.00</span>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
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
