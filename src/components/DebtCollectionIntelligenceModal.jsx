import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  DollarSign,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Search,
  Filter,
  Copy,
  Check,
  Send,
  Printer,
  FileText,
  X,
  Building,
  TrendingDown,
  ExternalLink,
  ChevronRight,
  Landmark,
  Phone,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';

export default function DebtCollectionIntelligenceModal({
  isOpen,
  onClose,
  invoices = [],
  profitInvoices = [],
  clients = [],
  sellers = [],
  profitSellers = [],
  bankAccounts = [],
  profitBankAccounts = [],
  config = {},
  currentUser = null,
  tasaBcv: propTasaBcv
}) {
  const [activeTab, setActiveTab] = useState('aging'); // 'aging' | 'whatsapp' | 'statement'
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [agingFilter, setAgingFilter] = useState('ALL'); // 'ALL' | 'VIGENTE' | '1_7' | '8_15' | '16_30' | 'OVER_30'
  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState('');

  const targetInvoices = useMemo(() => {
    return (Array.isArray(invoices) && invoices.length > 0) ? invoices : (profitInvoices || []);
  }, [invoices, profitInvoices]);

  const targetSellers = useMemo(() => {
    return (Array.isArray(sellers) && sellers.length > 0) ? sellers : (profitSellers || []);
  }, [sellers, profitSellers]);

  const targetBankAccounts = useMemo(() => {
    return (Array.isArray(bankAccounts) && bankAccounts.length > 0) ? bankAccounts : (profitBankAccounts || []);
  }, [bankAccounts, profitBankAccounts]);

  const tasaBcv = Number(propTasaBcv || config?.tasaDolar) || 827.73;

  // 1. Motor de Cálculo de Antigüedad de Saldos (Aging) por Factura y por Cliente
  // Consolidando clientes locales con deuda y facturas pendientes de Profit Plus
  const agingData = useMemo(() => {
    const hoy = new Date();
    const clientsMap = {};

    // A. Inicializar con clientes que posean saldo deudor registrado
    (clients || []).forEach(c => {
      const coCli = (c.id || c.codigo || c.co_cli || '').toString().trim();
      const rif = (c.rif || '').toString().trim().toUpperCase();
      const saldoLocal = Number(c.saldoDeudorUsd) || 0;
      if (saldoLocal > 0.01) {
        const key = coCli || rif;
        clientsMap[key] = {
          coCli: coCli || key,
          nombre: c.nombre || c.razonSocial || c.cli_des || 'Cliente General',
          rif: c.rif || 'J-00000000-0',
          telefono: c.telefono || c.telefonos || '',
          direccion: c.direccion || c.direc1 || '',
          limiteCredito: Number(c.limiteCredito || c.lim_cred || 0),
          coVen: c.vendedorAsignado || c.vendedorId || '01',
          invoices: [],
          totalSaldoUsd: saldoLocal,
          totalSaldoBs: saldoLocal * tasaBcv,
          totalVencidoUsd: 0,
          totalVigenteUsd: saldoLocal,
          maxDiasVencido: 0,
          tramoMayor: 'VIGENTE'
        };
      }
    });

    // B. Integrar facturas activas con saldo pendiente
    const activeInvoices = targetInvoices.filter(inv => {
      if (inv?.anulado || inv?.status === 'ANULADA') return false;
      const saldo = Number(inv?.saldoUsd || (inv?.saldoBs ? inv.saldoBs / (inv.tasa || tasaBcv) : inv?.saldo || 0));
      return saldo > 0.01;
    });

    activeInvoices.forEach(inv => {
      const coCli = (inv.coCli || inv.co_cli || inv.clienteCod || '').toString().trim();
      const rif = (inv.clienteRif || inv.rif || '').toString().trim().toUpperCase();
      const cliNombre = (inv.clienteNombre || inv.cli_des || '').trim();
      const fNum = inv.factNum || inv.nroDoc || inv.id;
      const fEmis = inv.fechaEmision || inv.fec_emis ? new Date(inv.fechaEmision || inv.fec_emis) : hoy;
      const fVenc = inv.fechaVencimiento || inv.fec_venc ? new Date(inv.fechaVencimiento || inv.fec_venc) : fEmis;

      const saldoUsd = Number(inv.saldoUsd || (inv.saldoBs ? inv.saldoBs / (inv.tasa || tasaBcv) : inv.saldo || 0));
      const saldoBs = Number(inv.saldoBs || saldoUsd * tasaBcv);
      const coVen = (inv.coVen || inv.co_ven || inv.vendedorId || '01').toString().trim();

      const diffMs = hoy - fVenc;
      const diasVencido = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      let tramo = 'VIGENTE';
      if (diasVencido > 30) tramo = 'OVER_30';
      else if (diasVencido > 15) tramo = '16_30';
      else if (diasVencido > 7) tramo = '8_15';
      else if (diasVencido > 0) tramo = '1_7';

      const invoiceItem = {
        id: inv.id || fNum,
        factNum: fNum,
        fechaEmision: fEmis.toISOString().slice(0, 10),
        fechaVencimiento: fVenc.toISOString().slice(0, 10),
        saldoUsd,
        saldoBs,
        diasVencido,
        tramo,
        coVen
      };

      const key = coCli || rif;
      if (!clientsMap[key]) {
        const clientProfile = (clients || []).find(c => {
          const cCode = (c.id || c.codigo || c.co_cli || '').toString().trim();
          const cRif = (c.rif || '').toString().trim().toUpperCase();
          return (coCli && cCode === coCli) || (rif && cRif === rif);
        }) || {};

        clientsMap[key] = {
          coCli: coCli || key,
          nombre: cliNombre || clientProfile.nombre || clientProfile.razonSocial || clientProfile.cli_des || 'Cliente General',
          rif: rif || clientProfile.rif || 'J-00000000-0',
          telefono: clientProfile.telefono || clientProfile.telefonos || '',
          direccion: clientProfile.direccion || clientProfile.direc1 || '',
          limiteCredito: Number(clientProfile.limiteCredito || clientProfile.lim_cred || 0),
          coVen: coVen || clientProfile.vendedorAsignado || '01',
          invoices: [invoiceItem],
          totalSaldoUsd: saldoUsd,
          totalSaldoBs: saldoBs,
          totalVencidoUsd: diasVencido > 0 ? saldoUsd : 0,
          totalVigenteUsd: diasVencido === 0 ? saldoUsd : 0,
          maxDiasVencido: diasVencido,
          tramoMayor: tramo
        };
      } else {
        const cliEntry = clientsMap[key];
        // Si el cliente ya existía solo por saldoLocal pero sin facturas, reemplazamos o acumulamos
        if (cliEntry.invoices.length === 0) {
          cliEntry.invoices.push(invoiceItem);
          cliEntry.totalSaldoUsd = saldoUsd;
          cliEntry.totalSaldoBs = saldoBs;
          cliEntry.totalVencidoUsd = diasVencido > 0 ? saldoUsd : 0;
          cliEntry.totalVigenteUsd = diasVencido === 0 ? saldoUsd : 0;
          cliEntry.maxDiasVencido = diasVencido;
          cliEntry.tramoMayor = tramo;
        } else {
          cliEntry.invoices.push(invoiceItem);
          cliEntry.totalSaldoUsd += saldoUsd;
          cliEntry.totalSaldoBs += saldoBs;
          if (diasVencido > 0) {
            cliEntry.totalVencidoUsd += saldoUsd;
          } else {
            cliEntry.totalVigenteUsd += saldoUsd;
          }
          if (diasVencido > cliEntry.maxDiasVencido) {
            cliEntry.maxDiasVencido = diasVencido;
            cliEntry.tramoMayor = tramo;
          }
        }
      }
    });

    const list = Object.values(clientsMap).sort((a, b) => b.totalSaldoUsd - a.totalSaldoUsd);

    const kpis = {
      totalCarteraUsd: list.reduce((sum, c) => sum + c.totalSaldoUsd, 0),
      totalVencidoUsd: list.reduce((sum, c) => sum + c.totalVencidoUsd, 0),
      totalVigenteUsd: list.reduce((sum, c) => sum + c.totalVigenteUsd, 0),
      clientesConDeuda: list.length,
      clientesCriticos: list.filter(c => c.maxDiasVencido > 30).length
    };

    return { clientsList: list, kpis };
  }, [targetInvoices, clients, tasaBcv]);

  // 2. Filtrado de la Matriz de Clientes
  const filteredClients = useMemo(() => {
    return agingData.clientsList.filter(c => {
      if (sellerFilter !== 'ALL' && c.coVen !== sellerFilter) return false;
      if (agingFilter !== 'ALL') {
        if (agingFilter === 'VIGENTE' && c.maxDiasVencido > 0) return false;
        if (agingFilter === '1_7' && (c.maxDiasVencido < 1 || c.maxDiasVencido > 7)) return false;
        if (agingFilter === '8_15' && (c.maxDiasVencido < 8 || c.maxDiasVencido > 15)) return false;
        if (agingFilter === '16_30' && (c.maxDiasVencido < 16 || c.maxDiasVencido > 30)) return false;
        if (agingFilter === 'OVER_30' && c.maxDiasVencido <= 30) return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const mCod = (c.coCli || '').toLowerCase().includes(q);
        const mNom = (c.nombre || '').toLowerCase().includes(q);
        const mRif = (c.rif || '').toLowerCase().includes(q);
        const mInv = c.invoices.some(i => (i.factNum || '').toString().includes(q));
        return mCod || mNom || mRif || mInv;
      }
      return true;
    });
  }, [agingData.clientsList, sellerFilter, agingFilter, searchFilter]);

  // 3. Normalizador de teléfonos para WhatsApp (Formato Internacional Venezuela: 58...)
  const normalizeWhatsAppPhone = (phoneStr) => {
    if (!phoneStr) return '';
    let clean = phoneStr.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '58' + clean.slice(1);
    } else if (!clean.startsWith('58') && clean.length === 10) {
      clean = '58' + clean;
    }
    return clean;
  };

  // 4. Generador del Mensaje de WhatsApp
  const generatedWhatsAppMessage = useMemo(() => {
    if (!selectedClient) return '';

    const nombre = selectedClient.nombre;
    const rif = selectedClient.rif;
    const totalUsd = selectedClient.totalSaldoUsd.toFixed(2);
    const totalBs = (selectedClient.totalSaldoUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 });
    const fechaHoy = new Date().toLocaleDateString('es-VE');

    let facturasTexto = '';
    if (selectedClient.invoices.length > 0) {
      selectedClient.invoices.forEach(inv => {
        const statusText = inv.diasVencido > 0
          ? `🔴 Vencida hace ${inv.diasVencido} día(s)`
          : `🟢 Vence el ${inv.fechaVencimiento}`;
        facturasTexto += `  • *FAC #${inv.factNum}*: $ ${inv.saldoUsd.toFixed(2)} USD (${statusText})\n`;
      });
    } else {
      facturasTexto = `  • *Saldo en Cuenta Corriente*: $ ${totalUsd} USD (Al día)\n`;
    }

    let bancosTexto = '';
    targetBankAccounts.slice(0, 3).forEach(b => {
      bancosTexto += `  • *${b.bancoDes || b.bancoNombre || 'Banco'}*: ${b.numCta || b.numeroCuenta || ''} (${b.moneda || 'BS'})\n`;
    });

    const defaultBancos = '  • Banesco / Mercantil / Provincial\n  • Pago Móvil Disponible\n';

    const msg = `Estimado(a) *${nombre}* (RIF: ${rif}), le saludamos cordialmente de *${config.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.'}*.\n\nLe compartimos su estado de cuenta y facturas pendientes al día de hoy *${fechaHoy}*:\n\n📄 *Detalle de Facturas:*\n${facturasTexto}\n💵 *Total por Pagar:* *$ ${totalUsd} USD*\n🇻🇪 *Equivalente en Bs. (Tasa BCV Bs. ${tasaBcv.toFixed(2)}):* *Bs. ${totalBs}*\n\n🏦 *Cuentas Bancarias para Transferencias / Pagos:*\n${bancosTexto || defaultBancos}\nAgradecemos nos envíe su comprobante de pago a este mismo número para procesar su recibo oficial de caja.\n\n¡Muchas gracias por su preferencia y confianza!`;

    return msg;
  }, [selectedClient, tasaBcv, targetBankAccounts, config.nombreEmpresa]);

  const handleCopyMessage = () => {
    if (!generatedWhatsAppMessage) return;
    navigator.clipboard.writeText(generatedWhatsAppMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!selectedClient) return;
    const targetPhone = customPhone || selectedClient.telefono;
    const cleanPhone = normalizeWhatsAppPhone(targetPhone);
    const encoded = encodeURIComponent(generatedWhatsAppMessage);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleSelectClient = (cli) => {
    setSelectedClient(cli);
    setCustomPhone(cli.telefono || '');
    setActiveTab('whatsapp');
  };

  if (!isOpen) return null;

  return (
    <div className="debt-modal-overlay" onClick={onClose}>
      <div className="debt-modal-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Cabecera Principal */}
        <div className="debt-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--semaforo-verde)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <MessageSquare size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
                  Inteligencia de Cobranzas & Aging de Cartera
                </h2>
                <span className="badge badge-success" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px' }}>
                  <Send size={12} /> WhatsApp Directo
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Monitoreo de vencimientos en tiempo real, cálculo de morosidad y cobro automatizado a clientes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: '10px', padding: '8px' }}
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pestañas de Navegación */}
        <div className="debt-modal-tabs">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('aging')}
              style={{
                padding: '0.75rem 1.1rem',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'aging' ? 700 : 500,
                borderBottom: activeTab === 'aging' ? '3px solid var(--semaforo-verde)' : '3px solid transparent',
                color: activeTab === 'aging' ? 'var(--semaforo-verde)' : 'var(--text-muted)',
                background: 'transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Clock size={16} />
              Matriz de Aging ({agingData.clientsList.length} Deudores)
            </button>
            <button
              onClick={() => {
                if (!selectedClient && agingData.clientsList.length > 0) {
                  setSelectedClient(agingData.clientsList[0]);
                  setCustomPhone(agingData.clientsList[0].telefono || '');
                }
                setActiveTab('whatsapp');
              }}
              style={{
                padding: '0.75rem 1.1rem',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'whatsapp' ? 700 : 500,
                borderBottom: activeTab === 'whatsapp' ? '3px solid var(--semaforo-verde)' : '3px solid transparent',
                color: activeTab === 'whatsapp' ? 'var(--semaforo-verde)' : 'var(--text-muted)',
                background: 'transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Send size={16} />
              Cobro por WhatsApp {selectedClient ? `(${selectedClient.nombre.slice(0, 16)}...)` : ''}
            </button>
            <button
              onClick={() => {
                if (!selectedClient && agingData.clientsList.length > 0) {
                  setSelectedClient(agingData.clientsList[0]);
                }
                setActiveTab('statement');
              }}
              style={{
                padding: '0.75rem 1.1rem',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'statement' ? 700 : 500,
                borderBottom: activeTab === 'statement' ? '3px solid var(--semaforo-verde)' : '3px solid transparent',
                color: activeTab === 'statement' ? 'var(--semaforo-verde)' : 'var(--text-muted)',
                background: 'transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Printer size={16} />
              Estado de Cuenta Oficial
            </button>
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', padding: '0.5rem 0' }}>
            Tasa BCV del Día: <strong style={{ color: 'var(--motorven-gold)', fontWeight: 800 }}>Bs. {tasaBcv.toFixed(2)}</strong>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* PESTAÑA 1: MATRIZ DE AGING & CARTERA POR COBRAR */}
          {activeTab === 'aging' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* KPIs de Cartera (4 Bento Cards superiores) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                
                {/* KPI 1: Cartera Total */}
                <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-gold)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Cartera Total por Cobrar
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {formatUsd(agingData.kpis.totalCarteraUsd)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    {formatBs(agingData.kpis.totalCarteraUsd * tasaBcv)}
                  </div>
                </div>

                {/* KPI 2: Saldo Vencido en Mora */}
                <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-red)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--motorven-red)', fontFamily: 'var(--font-code)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Saldo Vencido en Mora
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)', marginTop: '4px' }}>
                    {formatUsd(agingData.kpis.totalVencidoUsd)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    {agingData.kpis.totalCarteraUsd > 0
                      ? `(${((agingData.kpis.totalVencidoUsd / agingData.kpis.totalCarteraUsd) * 100).toFixed(1)}% de la cartera)`
                      : '0% de la cartera'}
                  </div>
                </div>

                {/* KPI 3: Saldo Vigente */}
                <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid var(--semaforo-verde)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--semaforo-verde)', fontFamily: 'var(--font-code)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Saldo Vigente (Al Día)
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)', marginTop: '4px' }}>
                    {formatUsd(agingData.kpis.totalVigenteUsd)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    Dentro del plazo de crédito
                  </div>
                </div>

                {/* KPI 4: Casos Críticos */}
                <div className="bento-card" style={{ padding: '1rem', borderLeft: '4px solid #ea580c' }}>
                  <span style={{ fontSize: '0.7rem', color: '#ea580c', fontFamily: 'var(--font-code)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Casos Críticos (+30 días)
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: '#ea580c', marginTop: '4px' }}>
                    {agingData.kpis.clientesCriticos} Clientes
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    Requieren gestión urgente
                  </div>
                </div>
              </div>

              {/* Barra de Filtros */}
              <div className="bento-card" style={{ padding: '0.85rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem', flex: 1 }}>
                  {/* Buscador */}
                  <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, RIF, código o factura..."
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', paddingLeft: '32px', fontSize: '0.78rem', height: '34px' }}
                    />
                  </div>

                  {/* Filtro Aging */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>Tramo:</span>
                    <select
                      value={agingFilter}
                      onChange={e => setAgingFilter(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.76rem', height: '34px', padding: '0 8px', minWidth: '150px' }}
                    >
                      <option value="ALL">Todos los Tramos</option>
                      <option value="VIGENTE">🟢 Vigentes (Sin Vencer)</option>
                      <option value="1_7">🟡 Vencido 1 a 7 Días</option>
                      <option value="8_15">🟠 Vencido 8 a 15 Días</option>
                      <option value="16_30">🔴 Vencido 16 a 30 Días</option>
                      <option value="OVER_30">⛔ Crítico (+30 Días)</option>
                    </select>
                  </div>

                  {/* Filtro Asesor */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>Asesor:</span>
                    <select
                      value={sellerFilter}
                      onChange={e => setSellerFilter(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.76rem', height: '34px', padding: '0 8px', minWidth: '150px' }}
                    >
                      <option value="ALL">Todos los Asesores</option>
                      {targetSellers.map(s => (
                        <option key={s.id || s.co_ven || s.coVen} value={s.co_ven || s.coVen}>
                          {s.ven_des || s.venDes || s.co_ven || s.coVen}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontWeight: 600 }}>
                  {filteredClients.length} deudores encontrados
                </span>
              </div>

              {/* Tabla de Aging por Cliente */}
              <div className="bento-card" style={{ padding: 0, overflow: 'hidden' }}>
                {filteredClients.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={40} color="var(--semaforo-verde)" style={{ margin: '0 auto 0.75rem', opacity: 0.7 }} />
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      ¡Excelente! No hay cuentas pendientes bajo estos filtros.
                    </p>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Todos los clientes están al día o no coinciden con la búsqueda ingresada.
                    </p>
                  </div>
                ) : (
                  <div className="table-container" style={{ margin: 0 }}>
                    <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CLIENTE / RIF</th>
                          <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>TELÉFONO</th>
                          <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>DOCS</th>
                          <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>SALDO ($ USD)</th>
                          <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>SALDO (BS.)</th>
                          <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>MORA MÁXIMA</th>
                          <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ESTADO AGING</th>
                          <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ACCIÓN INMEDIATA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map((cli, idx) => {
                          const isCritical = cli.maxDiasVencido > 30;

                          return (
                            <tr key={cli.coCli || idx}>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cli.nombre}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                                  RIF: {cli.rif} | Cód: {cli.coCli}
                                </div>
                              </td>

                              <td>
                                {cli.telefono ? (
                                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Phone size={12} color="var(--semaforo-verde)" />
                                    {cli.telefono}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.72rem' }}>Sin teléfono</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <span className="badge badge-info" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
                                  {cli.invoices.length > 0 ? `${cli.invoices.length} fac.` : 'Cta. Corr.'}
                                </span>
                              </td>

                              <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-red)' }}>
                                {formatUsd(cli.totalSaldoUsd)}
                              </td>

                              <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                                {formatBs(cli.totalSaldoBs)}
                              </td>

                              <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                                {cli.maxDiasVencido > 0 ? (
                                  <span style={{ color: isCritical ? 'var(--motorven-red)' : 'var(--motorven-gold)' }}>
                                    +{cli.maxDiasVencido} días
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--semaforo-verde)' }}>Al día (0d)</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                {cli.maxDiasVencido > 30 ? (
                                  <span className="badge badge-danger" style={{ fontSize: '0.66rem', fontFamily: 'var(--font-code)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <AlertTriangle size={11} /> CRÍTICO (+30D)
                                  </span>
                                ) : cli.maxDiasVencido > 15 ? (
                                  <span className="badge badge-warning" style={{ fontSize: '0.66rem', fontFamily: 'var(--font-code)', background: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', borderColor: '#ea580c' }}>
                                    16 - 30 DÍAS
                                  </span>
                                ) : cli.maxDiasVencido > 7 ? (
                                  <span className="badge badge-warning" style={{ fontSize: '0.66rem', fontFamily: 'var(--font-code)' }}>
                                    8 - 15 DÍAS
                                  </span>
                                ) : cli.maxDiasVencido > 0 ? (
                                  <span className="badge badge-warning" style={{ fontSize: '0.66rem', fontFamily: 'var(--font-code)' }}>
                                    1 - 7 DÍAS
                                  </span>
                                ) : (
                                  <span className="badge badge-success" style={{ fontSize: '0.66rem', fontFamily: 'var(--font-code)' }}>
                                    VIGENTE
                                  </span>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => handleSelectClient(cli)}
                                  className="btn btn-sm btn-primary"
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '4px 10px',
                                    background: 'var(--semaforo-verde)',
                                    borderColor: 'var(--semaforo-verde)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title={`Enviar recordatorio de cobro por WhatsApp a ${cli.nombre}`}
                                >
                                  <Send size={12} />
                                  Cobrar WhatsApp
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PESTAÑA 2: GENERADOR & ENVÍO DE COBRO POR WHATSAPP */}
          {activeTab === 'whatsapp' && (
            <div className="debt-whatsapp-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '1.25rem' }}>
              
              {/* Selector de Cliente en Columna Izquierda */}
              <div className="bento-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '560px' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)', margin: 0 }}>
                  1. Seleccionar Cliente Deudor
                </h4>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {agingData.clientsList.map(cli => {
                    const isSelected = selectedClient?.coCli === cli.coCli;
                    return (
                      <button
                        key={cli.coCli}
                        onClick={() => {
                          setSelectedClient(cli);
                          setCustomPhone(cli.telefono || '');
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid var(--semaforo-verde)' : '1px solid var(--border-glass)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-tertiary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: isSelected ? 'var(--semaforo-verde)' : 'var(--text-primary)' }}>
                            {cli.nombre}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                            RIF: {cli.rif}
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--motorven-red)', fontFamily: 'var(--font-tech)', marginTop: '3px' }}>
                            Saldo: {formatUsd(cli.totalSaldoUsd)}
                          </div>
                        </div>
                        <ChevronRight size={16} color={isSelected ? 'var(--semaforo-verde)' : 'var(--text-muted)'} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mensaje & Acción de Envío en Columna Derecha */}
              <div className="bento-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedClient ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', pb: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Send size={16} color="var(--semaforo-verde)" />
                          Cobranza Personalizada: {selectedClient.nombre}
                        </h3>
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '4px 0 0 0', fontFamily: 'var(--font-code)' }}>
                          RIF: {selectedClient.rif} | Deuda Total: <strong style={{ color: 'var(--motorven-red)' }}>{formatUsd(selectedClient.totalSaldoUsd)}</strong> ({formatBs(selectedClient.totalSaldoBs)})
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          generateAccountsReceivablePDF({
                            receivables: selectedClient ? (targetInvoices || []).filter(inv => (inv.clienteRif || inv.rif || inv.co_cli) === (selectedClient.rif || selectedClient.codigo)) : targetInvoices,
                            clients: selectedClient ? [selectedClient] : clients,
                            config: { ...config, tasaDolar: tasaBcv },
                            currentUser
                          });
                          setActiveTab('statement');
                        }}
                        className="btn btn-sm btn-print-report"
                        style={{ fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Printer size={13} color="#ffffff" />
                        Imprimir Reporte
                      </button>
                    </div>

                    {/* Teléfono de Destino */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                        Número de WhatsApp del Cliente (Venezuela):
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={customPhone}
                          onChange={e => setCustomPhone(e.target.value)}
                          placeholder="Ej. 04141234567 o +584141234567"
                          className="form-input"
                          style={{ flex: 1, height: '36px', fontSize: '0.8rem', fontFamily: 'var(--font-code)' }}
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', whiteSpace: 'nowrap' }}>
                          ➔ Formato Web: <strong style={{ color: 'var(--semaforo-verde)' }}>{normalizeWhatsAppPhone(customPhone) || 'Sin número'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Previsualizador del Mensaje WhatsApp */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Previsualización del Mensaje Estructurado:
                        </label>
                        <button
                          onClick={handleCopyMessage}
                          className="btn btn-sm"
                          style={{ background: 'transparent', color: 'var(--semaforo-verde)', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px' }}
                        >
                          {copied ? <Check size={13} /> : <Copy size={13} />}
                          {copied ? '¡Copiado!' : 'Copiar Texto'}
                        </button>
                      </div>

                      <textarea
                        readOnly
                        rows={11}
                        value={generatedWhatsAppMessage}
                        className="form-input"
                        style={{
                          width: '100%',
                          flex: 1,
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-code)',
                          lineHeight: '1.5',
                          background: 'var(--bg-deep)',
                          color: 'var(--semaforo-verde)',
                          padding: '12px',
                          borderRadius: '10px'
                        }}
                      />
                    </div>

                    {/* Botones de Acción */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '6px' }}>
                      <button
                        onClick={handleCopyMessage}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Copy size={14} />
                        Copiar Mensaje
                      </button>

                      <button
                        onClick={handleOpenWhatsApp}
                        className="btn btn-primary"
                        style={{
                          fontSize: '0.8rem',
                          background: 'var(--semaforo-verde)',
                          borderColor: 'var(--semaforo-verde)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 18px',
                          fontWeight: 700
                        }}
                      >
                        <Send size={15} />
                        Abrir Chat de WhatsApp Directo
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                    <MessageSquare size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                      Seleccione un cliente a la izquierda para generar su mensaje de cobro
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PESTAÑA 3: ESTADO DE CUENTA OFICIAL (IMPRIMIBLE / PDF) */}
          {activeTab === 'statement' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              {selectedClient ? (
                <div>
                  <div className="bento-card" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      Estado de cuenta oficial de <strong>{selectedClient.nombre}</strong>
                    </span>
                    <button
                      onClick={() => generateAccountsReceivablePDF({
                        receivables: selectedClient ? (targetInvoices || []).filter(inv => (inv.clienteRif || inv.rif || inv.co_cli) === (selectedClient.rif || selectedClient.codigo)) : targetInvoices,
                        clients: selectedClient ? [selectedClient] : clients,
                        config: { ...config, tasaDolar: tasaBcv },
                        currentUser
                      })}
                      className="btn btn-print-report"
                      style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={15} color="#ffffff" />
                      Imprimir Reporte
                    </button>
                  </div>

                  {/* Hoja de Estado de Cuenta Membretada (Fondo Blanco Formal para Impresión) */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    padding: '2.5rem',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }}>
                    {/* Header Membretado */}
                    <div style={{ borderBottom: '2px solid #002b7a', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h1 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#002b7a', margin: 0, textTransform: 'uppercase' }}>
                          {config.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.'}
                        </h1>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', margin: '3px 0 0 0' }}>
                          DISTRIBUIDOR OFICIAL DE LUBRICANTES & REPUESTOS AUTOMOTRICES
                        </p>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '3px 0 0 0' }}>
                          RIF: {config.rif || 'J-30401927-4'} | {config.direccionEmpresa || 'Zona Industrial Valencia, Carabobo'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', margin: 0, textTransform: 'uppercase' }}>ESTADO DE CUENTA COMERCIAL</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', margin: '3px 0 0 0' }}>FECHA: {new Date().toLocaleDateString('es-VE')}</p>
                        <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '2px 0 0 0', fontFamily: 'monospace' }}>TASA BCV: Bs. {tasaBcv.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Caja de Datos del Cliente */}
                    <div style={{ padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc', fontSize: '0.76rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <p style={{ margin: '2px 0' }}><strong>Cliente:</strong> {selectedClient.nombre}</p>
                        <p style={{ margin: '2px 0' }}><strong>R.I.F.:</strong> {selectedClient.rif}</p>
                        <p style={{ margin: '2px 0' }}><strong>Código:</strong> {selectedClient.coCli}</p>
                      </div>
                      <div>
                        <p style={{ margin: '2px 0' }}><strong>Teléfono:</strong> {selectedClient.telefono || 'N/A'}</p>
                        <p style={{ margin: '2px 0' }}><strong>Dirección:</strong> {selectedClient.direccion || 'Domicilio Fiscal Registrado'}</p>
                        <p style={{ margin: '2px 0' }}><strong>Asesor Comercial:</strong> {selectedClient.coVen}</p>
                      </div>
                    </div>

                    {/* Tabla de Facturas */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '1.25rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#002b7a', color: '#ffffff', fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          <tr>
                            <th style={{ padding: '8px 10px' }}>Documento</th>
                            <th style={{ padding: '8px 10px' }}>Fecha Emisión</th>
                            <th style={{ padding: '8px 10px' }}>Fecha Vencimiento</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center' }}>Días Mora</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saldo ($ USD)</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saldo (Bs. BCV)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClient.invoices.length > 0 ? (
                            selectedClient.invoices.map((inv, iIdx) => (
                              <tr key={inv.id || iIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 800, color: '#002b7a' }}>
                                  FACTURA #{inv.factNum}
                                </td>
                                <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{inv.fechaEmision}</td>
                                <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{inv.fechaVencimiento}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                                  {inv.diasVencido > 0 ? (
                                    <span style={{ color: '#dc2626' }}>+{inv.diasVencido} días</span>
                                  ) : (
                                    <span style={{ color: '#059669' }}>Al día</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                  $ {inv.saldoUsd.toFixed(2)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                                  Bs. {inv.saldoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 800, color: '#002b7a' }}>
                                CUENTA CORRIENTE
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{new Date().toISOString().slice(0, 10)}</td>
                              <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{new Date().toISOString().slice(0, 10)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                                Al día
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                $ {selectedClient.totalSaldoUsd.toFixed(2)}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                                Bs. {selectedClient.totalSaldoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot style={{ backgroundColor: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                          <tr>
                            <td colSpan={4} style={{ padding: '10px', textAlign: 'right', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                              Total Deuda al Día de Hoy:
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 900, color: '#b91c1c', backgroundColor: '#fee2e2' }}>
                              $ {selectedClient.totalSaldoUsd.toFixed(2)} USD
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 900, color: '#b91c1c', backgroundColor: '#fee2e2' }}>
                              Bs. {(selectedClient.totalSaldoUsd * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Cuentas Bancarias */}
                    <div style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', fontSize: '0.72rem', marginBottom: '1.5rem' }}>
                      <p style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Cuentas Bancarias de Recaudación:</p>
                      {targetBankAccounts.slice(0, 3).map((b, bIdx) => (
                        <p key={bIdx} style={{ margin: '2px 0', color: '#334155' }}>
                          • <strong>{b.bancoDes || b.bancoNombre || 'Banco'}:</strong> {b.numCta || b.numeroCuenta || ''} ({b.moneda || 'BS'})
                        </p>
                      ))}
                    </div>

                    {/* Firmas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', paddingTop: '2rem', borderTop: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.74rem' }}>
                      <div>
                        <div style={{ borderBottom: '1px solid #0f172a', width: '70%', margin: '0 auto 6px' }}></div>
                        <p style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>DEPARTAMENTO DE COBRANZAS</p>
                        <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '2px 0 0 0' }}>SIGNUM MOTORVEN, C.A.</p>
                      </div>
                      <div>
                        <div style={{ borderBottom: '1px solid #0f172a', width: '70%', margin: '0 auto 6px' }}></div>
                        <p style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>FIRMA CONFORME CLIENTE</p>
                        <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '2px 0 0 0' }}>FECHA: ____/____/________</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bento-card" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                  <Printer size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                    Seleccione un cliente en la pestaña de Aging para visualizar su estado de cuenta
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
