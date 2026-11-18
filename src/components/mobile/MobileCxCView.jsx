import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { formatDateVe, parseInvoiceDateInfo } from '../../services/creditPolicyService';
import { formatBs, formatUsd, round2 } from '../../services/formatService';
import { generateThirdPartyStatementPDF } from '../../services/pdfReportService';
import { useNotification } from '../../context/NotificationContext';
import { consolidateClientReceivables, toCxcDateKey } from '../../utils/cxcUtils';
import { DEFAULT_PROFIT_SELLERS } from '../../data/mockData';

const DOC_TYPE_FILTERS = [
  { id: 'TODOS', label: 'Todos Docs' },
  { id: 'FAC', label: 'Fiscal (FAC)' },
  { id: 'NE', label: 'Nota Entrega (NE)' }
];

const STATUS_FILTERS = [
  { id: 'TODOS', label: 'Toda Cartera' },
  { id: 'MORA', label: 'En Mora' },
  { id: 'POR_VENCER', label: 'Por Vencer' },
  { id: 'VIGENTE', label: 'Vigente' }
];

const KNOWN_SELLER_NAMES = {
  VV: 'Victor Veloz',
  YC: 'Yheyson Calderón',
  CB: 'Carlos Becerra',
  CM: 'Carlos Machado',
  FS: 'Freddy Sepulveda',
  JR: 'Juan Rodríguez',
  VP: 'Vanessa Prieto',
  KB: 'Katherine Becerra',
  MS: 'Michael Santana',
  OF: 'Oficina / Mostrador'
};

function resolveClientSellerCode(cli, clientsList = []) {
  if (cli.asesor && String(cli.asesor).trim() && String(cli.asesor).trim().toUpperCase() !== 'OF') {
    return String(cli.asesor).trim().toUpperCase();
  }
  if (cli.vendedorAsignado && String(cli.vendedorAsignado).trim()) {
    return String(cli.vendedorAsignado).trim().toUpperCase();
  }
  if (Array.isArray(cli.pendingDocs) && cli.pendingDocs.length > 0) {
    for (const d of cli.pendingDocs) {
      const docVen = d.vendedorId || d.co_ven || d.coVen;
      if (docVen && String(docVen).trim()) {
        return String(docVen).trim().toUpperCase();
      }
    }
  }
  const prof = (clientsList || []).find(
    (c) =>
      String(c.id || '') === String(cli.id || '') ||
      (c.rif && cli.rif && String(c.rif).toUpperCase() === String(cli.rif).toUpperCase())
  );
  if (prof) {
    const v = prof.vendedorAsignado || prof.vendedor_asignado || prof.co_ven;
    if (v && String(v).trim()) return String(v).trim().toUpperCase();
  }
  return String(cli.asesor || 'OF').trim().toUpperCase();
}

function resolveSellerDisplayName(sellerCode, profitSellers = []) {
  const code = String(sellerCode || '').trim().toUpperCase();
  if (!code || code === 'TODOS') return 'Todos los Vendedores';

  const fromProfit = (profitSellers || []).find(
    (s) => String(s.co_ven || s.coVen || s.id || '').trim().toUpperCase() === code
  );
  if (fromProfit) {
    return fromProfit.ven_des || fromProfit.venDes || fromProfit.nombre || code;
  }
  return KNOWN_SELLER_NAMES[code] || code;
}

function clientMatchesSeller(cli, targetSellerCode, profitSellers = [], clientsList = []) {
  if (!targetSellerCode || targetSellerCode === 'TODOS') return true;
  const target = String(targetSellerCode).trim().toUpperCase();

  const code = resolveClientSellerCode(cli, clientsList);
  if (code === target) return true;

  if (String(cli.asesor || '').trim().toUpperCase() === target) return true;
  if (String(cli.vendedorAsignado || '').trim().toUpperCase() === target) return true;

  if (Array.isArray(cli.pendingDocs)) {
    const docMatch = cli.pendingDocs.some((d) => {
      const v = String(d.vendedorId || d.co_ven || d.coVen || '').trim().toUpperCase();
      return v === target;
    });
    if (docMatch) return true;
  }

  const sellerObj = (profitSellers || []).find(
    (s) => String(s.co_ven || s.coVen || s.id || '').trim().toUpperCase() === target
  );
  const sellerName = String(sellerObj?.ven_des || sellerObj?.venDes || sellerObj?.nombre || '').trim().toLowerCase();
  if (sellerName) {
    const cliSellerName = String(cli.vendedorNombre || '').trim().toLowerCase();
    if (cliSellerName && (cliSellerName.includes(sellerName) || sellerName.includes(cliSellerName))) {
      return true;
    }
  }

  return false;
}

function classifyDocDueStatus(pendingDoc) {
  if (!pendingDoc) return 'VIGENTE';
  if (Number(pendingDoc.diasVencido || 0) > 0) return 'MORA';
  if (pendingDoc.fechaVencimiento) {
    const parsed = parseInvoiceDateInfo(pendingDoc.fechaVencimiento)?.date;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const dueStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      const diffDays = Math.round((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 3) return 'POR_VENCER';
    }
  }
  return 'VIGENTE';
}

export default function MobileCxCView({
  clients = [],
  profitInvoices = [],
  profitCollections = [],
  sales = [],
  config,
  currentUser,
  profitSellers = [],
  onSyncProfit,
  onSelectClientForOrder
}) {
  const notify = useNotification();
  const tasaBcv = Number(config?.tasaDolar) > 0 ? Number(config.tasaDolar) : 827.73;

  const [query, setQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('TODOS');
  const [docTypeFilter, setDocTypeFilter] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [expandedKey, setExpandedKey] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Telemetría en vivo de recaudos del día (BR-CXC-003)
  const collectionsTelemetry = useMemo(() => {
    const todayKey = toCxcDateKey(new Date());
    const list = Array.isArray(profitCollections) ? profitCollections : [];
    let cobradoHoyUsd = 0;
    let recaudosHoyCount = 0;

    const sorted = [...list].sort((a, b) => {
      const da = new Date(a.fecha || a.fec_cob || a.createdAt || a.created_at || 0).getTime() || 0;
      const db = new Date(b.fecha || b.fec_cob || b.createdAt || b.created_at || 0).getTime() || 0;
      return db - da;
    });

    sorted.forEach((col) => {
      const rawDate = col.fecha || col.fec_cob || col.createdAt || col.created_at;
      const dateKey = toCxcDateKey(rawDate);
      if (dateKey === todayKey) {
        recaudosHoyCount += 1;
        const rate = Number(col.tasa || col.tasaCambio || tasaBcv) || tasaBcv;
        const amtUsd = Number(col.montoUsd ?? col.monto_usd ?? col.totalUsd ?? 0)
          || (Number(col.montoBs ?? col.monto_bs ?? 0) / rate);
        cobradoHoyUsd += amtUsd;
      }
    });

    const lastCol = sorted[0] || null;
    const lastAmount = lastCol
      ? (Number(lastCol.montoUsd ?? lastCol.monto_usd ?? lastCol.totalUsd ?? 0)
        || round2(Number(lastCol.montoBs ?? lastCol.monto_bs ?? 0) / (Number(lastCol.tasa || tasaBcv) || tasaBcv)))
      : 0;

    return {
      cobradoHoyUsd: round2(cobradoHoyUsd),
      recaudosHoyCount,
      lastCol,
      lastAmount: round2(lastAmount)
    };
  }, [profitCollections, tasaBcv]);

  const consolidatedClients = useMemo(() => {
    const baseList = consolidateClientReceivables({
      clients,
      profitInvoices,
      sales,
      tasaBcv,
      includePendingDocs: true
    });

    return baseList.map((cli) => {
      const docs = Array.isArray(cli.pendingDocs) ? cli.pendingDocs : [];
      const hasPorVencer = !cli.isMora && docs.some((d) => classifyDocDueStatus(d) === 'POR_VENCER');
      const healthStatus = cli.isMora ? 'MORA' : hasPorVencer ? 'POR_VENCER' : 'VIGENTE';
      return {
        ...cli,
        healthStatus
      };
    });
  }, [clients, profitInvoices, sales, tasaBcv]);

  const sellerOptions = useMemo(() => {
    const statsBySeller = {};

    const baseSellers =
      Array.isArray(profitSellers) && profitSellers.length > 0
        ? profitSellers
        : DEFAULT_PROFIT_SELLERS;

    baseSellers.forEach((s) => {
      const code = String(s.co_ven || s.coVen || s.id || '').trim().toUpperCase();
      const name = s.ven_des || s.venDes || s.nombre || code;
      if (code && !statsBySeller[code]) {
        statsBySeller[code] = {
          code,
          name,
          clientCount: 0,
          saldoUsd: 0,
          moraCount: 0,
          moraUsd: 0
        };
      }
    });

    consolidatedClients.forEach((cli) => {
      const code = resolveClientSellerCode(cli, clients);
      const saldo = Number(cli.saldoUsd || 0);
      const isMora = cli.healthStatus === 'MORA';

      if (!statsBySeller[code]) {
        const name = resolveSellerDisplayName(code, profitSellers);
        statsBySeller[code] = {
          code,
          name,
          clientCount: 0,
          saldoUsd: 0,
          moraCount: 0,
          moraUsd: 0
        };
      }

      statsBySeller[code].clientCount += 1;
      statsBySeller[code].saldoUsd = round2(statsBySeller[code].saldoUsd + saldo);
      if (isMora) {
        statsBySeller[code].moraCount += 1;
        statsBySeller[code].moraUsd = round2(statsBySeller[code].moraUsd + saldo);
      }
    });

    const list = Object.values(statsBySeller);
    list.sort((a, b) => {
      if (b.clientCount !== a.clientCount) return b.clientCount - a.clientCount;
      return a.code.localeCompare(b.code);
    });

    return list;
  }, [consolidatedClients, profitSellers, clients]);

  const sellerScopedClients = useMemo(() => {
    if (selectedSeller === 'TODOS') return consolidatedClients;
    return consolidatedClients.filter((cli) =>
      clientMatchesSeller(cli, selectedSeller, profitSellers, clients)
    );
  }, [consolidatedClients, selectedSeller, profitSellers, clients]);

  const selectedSellerMeta = useMemo(() => {
    if (selectedSeller === 'TODOS') return null;
    return sellerOptions.find((s) => s.code === selectedSeller) || {
      code: selectedSeller,
      name: resolveSellerDisplayName(selectedSeller, profitSellers),
      clientCount: sellerScopedClients.length
    };
  }, [selectedSeller, sellerOptions, profitSellers, sellerScopedClients.length]);

  const portfolioStats = useMemo(() => {
    let totalUsd = 0;
    let moraUsd = 0;
    let moraCount = 0;
    let porVencerUsd = 0;
    let porVencerCount = 0;
    let vigenteUsd = 0;
    let vigenteCount = 0;

    sellerScopedClients.forEach((cli) => {
      const bal = Number(cli.saldoUsd || 0);
      totalUsd += bal;
      if (cli.healthStatus === 'MORA') {
        moraUsd += bal;
        moraCount += 1;
      } else if (cli.healthStatus === 'POR_VENCER') {
        porVencerUsd += bal;
        porVencerCount += 1;
      } else {
        vigenteUsd += bal;
        vigenteCount += 1;
      }
    });

    return {
      totalUsd: round2(totalUsd),
      totalBs: round2(totalUsd * tasaBcv),
      moraUsd: round2(moraUsd),
      moraCount,
      porVencerUsd: round2(porVencerUsd),
      porVencerCount,
      vigenteUsd: round2(vigenteUsd),
      vigenteCount
    };
  }, [sellerScopedClients, tasaBcv]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sellerScopedClients.filter((cli) => {
      if (statusFilter !== 'TODOS' && cli.healthStatus !== statusFilter) return false;

      if (docTypeFilter === 'FAC' && Number(cli.fac?.restante || 0) <= 0.01) return false;
      if (docTypeFilter === 'NE' && Number(cli.ne?.restante || 0) <= 0.01) return false;

      if (!q) return true;
      const inHeader =
        String(cli.nombre || cli.cliente || '').toLowerCase().includes(q) ||
        String(cli.rif || '').toLowerCase().includes(q) ||
        String(cli.ciudad || '').toLowerCase().includes(q);
      const inSeller =
        String(cli.asesor || '').toLowerCase().includes(q) ||
        String(cli.vendedorNombre || '').toLowerCase().includes(q);
      const inDocs = (cli.pendingDocs || []).some((d) =>
        String(d.factNum || d.id || '').toLowerCase().includes(q)
      );
      return inHeader || inDocs || inSeller;
    });
  }, [sellerScopedClients, statusFilter, docTypeFilter, query]);

  const filteredTotals = useMemo(() => {
    const sumUsd = round2(filteredClients.reduce((acc, c) => acc + Number(c.saldoUsd || 0), 0));
    return {
      usd: sumUsd,
      bs: round2(sumUsd * tasaBcv)
    };
  }, [filteredClients, tasaBcv]);

  const handleSync = async () => {
    if (!onSyncProfit || syncing) return;
    setSyncing(true);
    try {
      await onSyncProfit({ silent: false });
    } catch {
      // Manejado globalmente
    } finally {
      setSyncing(false);
    }
  };

  const handleSendWhatsApp = (cli) => {
    const rawPhone = String(cli.telefono || '').replace(/[^0-9]/g, '');
    const phone = rawPhone.startsWith('0') ? `58${rawPhone.slice(1)}` : rawPhone;
    const docsText = (cli.pendingDocs || [])
      .slice(0, 4)
      .map((d) => `• ${d.factNum}: ${formatUsd(d.saldoUsd)}${d.diasVencido > 0 ? ` (${d.diasVencido}d mora)` : ''}`)
      .join('\n');
    const msg = [
      `*SIGNUM MOTORVEN • ESTADO DE CUENTA CXC*`,
      `Estimado(a): ${cli.nombre}`,
      `RIF: ${cli.rif}`,
      `Saldo Pendiente: *${formatUsd(cli.saldoUsd)}* (${formatBs(cli.saldoBs)})`,
      docsText ? `\nDocumentos:\n${docsText}` : '',
      `\nPor favor reportar comprobante de Pago Móvil o Transferencia al asesor.`
    ]
      .filter(Boolean)
      .join('\n');

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenStatementPdf = (cli) => {
    try {
      const docs = (cli.pendingDocs || []).map((d) => ({
        ...d,
        totNetoUsd: d.montoUsd,
        diasMora: d.diasVencido,
        isVencido: Number(d.diasVencido || 0) > 0
      }));
      generateThirdPartyStatementPDF({
        entity: cli,
        entityType: 'CLIENT',
        documents: docs,
        config,
        currentUser
      });
    } catch (err) {
      console.error('Error generando estado de cuenta PDF:', err);
      notify.error('No se pudo generar el Estado de Cuenta PDF.');
    }
  };

  const resolveClientProfile = (cli) =>
    clients.find(
      (c) =>
        String(c.id || '') === String(cli.id || '') ||
        String(c.rif || '').toUpperCase() === String(cli.rif || '').toUpperCase()
    ) || cli;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      {/* 1. Banner Live Telemetry Profit 2K8 (BR-CXC-003) */}
      <div
        className="mobile-card"
        style={{
          padding: '10px 12px',
          background: 'linear-gradient(135deg, var(--mob-navy-soft) 0%, var(--mob-surface) 100%)',
          borderColor: 'var(--mob-border-strong)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} color="var(--mob-green)" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
              {collectionsTelemetry.recaudosHoyCount > 0
                ? 'ABONOS EN VIVO REGISTRADOS'
                : 'CARTERA SINCRONIZADA PROFIT 2K8'}
            </span>
          </div>
          {onSyncProfit && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="mobile-chip"
              style={{ padding: '3px 9px', fontSize: '0.64rem' }}
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Actualizar'}
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', marginTop: '8px' }}>
          <div style={{ background: 'var(--mob-surface)', borderRadius: '10px', padding: '6px 8px', border: '1px solid var(--mob-border)' }}>
            <div style={{ fontSize: '0.56rem', fontWeight: 700, color: 'var(--mob-text-muted)' }}>COBRADO HOY</div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-green)' }}>
              {formatUsd(collectionsTelemetry.cobradoHoyUsd)}
            </div>
          </div>
          <div style={{ background: 'var(--mob-surface)', borderRadius: '10px', padding: '6px 8px', border: '1px solid var(--mob-border)' }}>
            <div style={{ fontSize: '0.56rem', fontWeight: 700, color: 'var(--mob-text-muted)' }}>RECAUDOS HOY</div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
              {collectionsTelemetry.recaudosHoyCount} recibos
            </div>
          </div>
          <div style={{ background: 'var(--mob-surface)', borderRadius: '10px', padding: '6px 8px', border: '1px solid var(--mob-border)' }}>
            <div style={{ fontSize: '0.56rem', fontWeight: 700, color: 'var(--mob-text-muted)' }}>ÚLTIMO ABONO</div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.74rem', fontWeight: 800, color: 'var(--mob-cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {collectionsTelemetry.lastCol ? formatUsd(collectionsTelemetry.lastAmount) : '$ 0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Saldo Total + Semáforo CxC (En Mora / Por Vencer / Solvente) */}
      <div className="mobile-card" style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="mobile-telemetry-label">
              Saldo Total por Cobrar {selectedSeller !== 'TODOS' ? `(${selectedSeller})` : ''}
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.35rem', fontWeight: 800, color: 'var(--mob-navy)', lineHeight: 1.15 }}>
              {formatUsd(portfolioStats.totalUsd)}
            </div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--mob-text-muted)' }}>
              {formatBs(portfolioStats.totalBs)} • {sellerScopedClients.length} cuentas abiertas
              {selectedSeller !== 'TODOS' && selectedSellerMeta ? ` • ${selectedSellerMeta.name}` : ' • Consolidado'}
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'var(--mob-navy-soft)',
              color: 'var(--mob-navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Wallet size={20} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => setStatusFilter((s) => (s === 'MORA' ? 'TODOS' : 'MORA'))}
            style={{
              textAlign: 'left',
              padding: '7px 8px',
              borderRadius: '10px',
              border: `1px solid ${statusFilter === 'MORA' ? 'var(--mob-red)' : 'var(--mob-border)'}`,
              background: 'var(--mob-red-soft)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', fontWeight: 800, color: 'var(--mob-red)' }}>
              <AlertCircle size={11} /> EN MORA ({portfolioStats.moraCount})
            </div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-red)', marginTop: '2px' }}>
              {formatUsd(portfolioStats.moraUsd)}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((s) => (s === 'POR_VENCER' ? 'TODOS' : 'POR_VENCER'))}
            style={{
              textAlign: 'left',
              padding: '7px 8px',
              borderRadius: '10px',
              border: `1px solid ${statusFilter === 'POR_VENCER' ? 'var(--mob-amber)' : 'var(--mob-border)'}`,
              background: 'var(--mob-amber-soft)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', fontWeight: 800, color: 'var(--mob-amber)' }}>
              <Clock size={11} /> VENCE ≤3D ({portfolioStats.porVencerCount})
            </div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-amber)', marginTop: '2px' }}>
              {formatUsd(portfolioStats.porVencerUsd)}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter((s) => (s === 'VIGENTE' ? 'TODOS' : 'VIGENTE'))}
            style={{
              textAlign: 'left',
              padding: '7px 8px',
              borderRadius: '10px',
              border: `1px solid ${statusFilter === 'VIGENTE' ? 'var(--mob-green)' : 'var(--mob-border)'}`,
              background: 'var(--mob-green-soft)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.58rem', fontWeight: 800, color: 'var(--mob-green)' }}>
              <CheckCircle2 size={11} /> AL DÍA ({portfolioStats.vigenteCount})
            </div>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-green)', marginTop: '2px' }}>
              {formatUsd(portfolioStats.vigenteUsd)}
            </div>
          </button>
        </div>
      </div>

      {/* 3. Filtro por Vendedor / Asesor Comercial */}
      <div
        className="mobile-card"
        style={{
          padding: '8px 10px',
          background: 'var(--mob-surface-low)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users size={13} color="var(--mob-cyan)" />
            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--mob-navy)', letterSpacing: '0.03em' }}>
              FILTRAR POR VENDEDOR
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '8px',
                border: '1px solid var(--mob-border)',
                background: 'var(--mob-surface)',
                color: 'var(--mob-navy)',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '160px'
              }}
            >
              <option value="TODOS">Todos ({consolidatedClients.length})</option>
              {sellerOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}: {s.name} ({s.clientCount})
                </option>
              ))}
            </select>

            {selectedSeller !== 'TODOS' && (
              <button
                type="button"
                onClick={() => setSelectedSeller('TODOS')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--mob-cyan)',
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  whiteSpace: 'nowrap'
                }}
              >
                Ver Todos
              </button>
            )}
          </div>
        </div>

        {/* Chips rápidos de vendedor con scroll horizontal */}
        <div className="mobile-chips-row" style={{ overflowX: 'auto', paddingBottom: '2px' }}>
          <button
            type="button"
            className={`mobile-chip ${selectedSeller === 'TODOS' ? 'active' : ''}`}
            onClick={() => setSelectedSeller('TODOS')}
            style={{ fontWeight: 800, fontSize: '0.66rem' }}
          >
            Todos ({consolidatedClients.length})
          </button>
          {sellerOptions.map((s) => {
            const isSelected = selectedSeller === s.code;
            const isMe = currentUser?.co_ven && String(currentUser.co_ven).toUpperCase() === s.code;
            return (
              <button
                key={s.code}
                type="button"
                className={`mobile-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedSeller(s.code)}
                style={{
                  fontSize: '0.66rem',
                  whiteSpace: 'nowrap',
                  fontWeight: isSelected ? 800 : 600,
                  border: isMe && !isSelected ? '1px dashed var(--mob-cyan)' : undefined
                }}
              >
                {isMe ? '★ ' : ''}{s.code}: {s.name.split(' ')[0]} ({s.clientCount})
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Buscador y Filtros Duales */}
      <div className="mobile-search-bar">
        <Search size={15} color="var(--mob-text-muted)" />
        <input
          className="mobile-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente, RIF o correlativo FAC- / NE-..."
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{ border: 'none', background: 'transparent', color: 'var(--mob-text-muted)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div className="mobile-chips-row">
          {DOC_TYPE_FILTERS.map((dt) => (
            <button
              key={dt.id}
              type="button"
              className={`mobile-chip ${docTypeFilter === dt.id ? 'active' : ''}`}
              onClick={() => setDocTypeFilter(dt.id)}
            >
              {dt.label}
            </button>
          ))}
        </div>
        <div className="mobile-chips-row">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`mobile-chip ${statusFilter === st.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(st.id)}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Tarjetas Auditadas de Clientes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {filteredClients.slice(0, 60).map((cli) => {
          const rowKey = cli.rif || cli.id || cli.nombre;
          const isExpanded = expandedKey === rowKey;
          const tone = cli.healthStatus === 'MORA' ? 'danger' : cli.healthStatus === 'POR_VENCER' ? 'warning' : 'success';
          const statusText = cli.healthStatus === 'MORA'
            ? `Mora ${cli.maxDiasMora}d`
            : cli.healthStatus === 'POR_VENCER'
              ? 'Por Vencer'
              : 'Al Día';

          return (
            <div key={rowKey} className="mobile-card" style={{ padding: '11px 12px' }}>
              <div
                onClick={() => setExpandedKey(isExpanded ? null : rowKey)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--mob-text)' }}>
                      {cli.nombre}
                    </span>
                    <span className={`mobile-pill-badge ${tone}`}>{statusText}</span>
                    <span
                      className="mobile-pill-badge info"
                      style={{ fontSize: '0.52rem', padding: '1px 6px', letterSpacing: '0.02em' }}
                    >
                      Asesor: {cli.asesor || 'OF'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
                    {cli.rif || 'Sin RIF'} • {cli.facturasCount || (cli.pendingDocs || []).length} doc(s)
                    {cli.fac?.count > 0 ? ` • ${cli.fac.count} FAC` : ''}
                    {cli.ne?.count > 0 ? ` • ${cli.ne.count} NE` : ''}
                    {cli.ciudad ? ` • ${cli.ciudad}` : ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.92rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
                    {formatUsd(cli.saldoUsd)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.64rem', color: 'var(--mob-text-muted)' }}>
                    {formatBs(cli.saldoBs)}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--mob-cyan)', fontWeight: 700, marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isExpanded ? 'Ocultar' : 'Documentos'}
                  </div>
                </div>
              </div>

              {isExpanded && Array.isArray(cli.pendingDocs) && cli.pendingDocs.length > 0 && (
                <div
                  style={{
                    marginTop: '9px',
                    paddingTop: '9px',
                    borderTop: '1px solid var(--mob-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  {cli.pendingDocs.map((doc) => {
                    const isNeDoc = String(doc.tipoDoc || '').toUpperCase().includes('NOTA');
                    return (
                      <div
                        key={doc.id || doc.factNum}
                        style={{
                          padding: '7px 9px',
                          borderRadius: '9px',
                          background: 'var(--mob-surface-low)',
                          border: '1px solid var(--mob-border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.74rem', fontWeight: 800, color: 'var(--mob-text)' }}>
                              {doc.factNum}
                            </span>
                            <span className={`mobile-pill-badge ${isNeDoc ? 'warning' : 'info'}`} style={{ fontSize: '0.52rem', padding: '1px 5px' }}>
                              {isNeDoc ? 'NE' : 'FAC'}
                            </span>
                            {doc.diasVencido > 0 && (
                              <span className="mobile-pill-badge danger" style={{ fontSize: '0.52rem', padding: '1px 5px' }}>
                                +{doc.diasVencido}d
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.64rem', color: 'var(--mob-text-muted)', marginTop: '2px' }}>
                            Emis: {doc.fechaEmision ? formatDateVe(doc.fechaEmision) : 'N/D'}
                            {doc.abonosUsd > 0 ? ` • Abonado: ${formatUsd(doc.abonosUsd)}` : ''}
                          </div>
                        </div>

                        <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.80rem', fontWeight: 800, color: doc.diasVencido > 0 ? 'var(--mob-red)' : 'var(--mob-navy)' }}>
                          {formatUsd(doc.saldoUsd)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Barra de acciones por cliente */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '9px' }}>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(cli)}
                  className="mobile-chip"
                  style={{ flex: 1, justifyContent: 'center', background: 'var(--mob-green-soft)', color: 'var(--mob-green)' }}
                >
                  <MessageCircle size={12} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenStatementPdf(cli)}
                  className="mobile-chip"
                  style={{ flex: 1, justifyContent: 'center', background: 'var(--mob-navy-soft)', color: 'var(--mob-navy)' }}
                >
                  <FileText size={12} /> Estado PDF
                </button>
                {onSelectClientForOrder && (
                  <button
                    type="button"
                    onClick={() => onSelectClientForOrder(resolveClientProfile(cli))}
                    className="mobile-chip"
                    style={{ background: 'var(--mob-red-soft)', color: 'var(--mob-red)' }}
                  >
                    <Plus size={12} /> Preventa
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredClients.length === 0 && (
          <div className="mobile-card" style={{ padding: '24px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--mob-text-muted)' }}>
            No hay cuentas por cobrar pendientes para {selectedSeller !== 'TODOS' ? `el vendedor ${selectedSeller}` : 'el criterio seleccionado'}.
            {selectedSeller !== 'TODOS' && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  className="mobile-chip active"
                  onClick={() => setSelectedSeller('TODOS')}
                  style={{ fontSize: '0.68rem', padding: '5px 12px', display: 'inline-flex', margin: '0 auto' }}
                >
                  Ver todos los vendedores
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Sticky Bottom Audit Summary Bar */}
      <div className="mobile-sticky-footer-bar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--mob-text-muted)' }}>
              TOTAL EN VISTA ({filteredClients.length} clientes{selectedSeller !== 'TODOS' ? ` • ${selectedSeller}` : ''})
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.02rem', fontWeight: 800, color: 'var(--mob-navy)' }}>
              {formatUsd(filteredTotals.usd)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', fontWeight: 800, color: 'var(--mob-text-secondary)' }}>
              {formatBs(filteredTotals.bs)}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--mob-text-muted)' }}>BCV {formatBs(tasaBcv)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
