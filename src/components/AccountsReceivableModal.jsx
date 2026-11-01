import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  Printer,
  X,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Building,
  TrendingDown,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Send,
  MessageSquare
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';

export default function AccountsReceivableModal({
  isOpen,
  onClose,
  invoices = [],
  profitInvoices = [],
  clients = [],
  sellers = [],
  profitSellers = [],
  config = {},
  currentUser,
  onOpenCollectionIntelligence
}) {
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VIGENTE' | 'VENCIDO' | 'VENCIDO_1_15' | 'VENCIDO_16_30' | 'VENCIDO_OVER_30'
  const [sellerFilter, setSellerFilter] = useState('ALL');

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  const targetInvoices = useMemo(() => {
    return (Array.isArray(profitInvoices) && profitInvoices.length > 0)
      ? profitInvoices
      : (Array.isArray(invoices) ? invoices : []);
  }, [invoices, profitInvoices]);

  const targetSellers = useMemo(() => {
    return (Array.isArray(profitSellers) && profitSellers.length > 0)
      ? profitSellers
      : (Array.isArray(sellers) ? sellers : []);
  }, [sellers, profitSellers]);

  // Procesamiento de Facturas con Antigüedad (Aging)
  const processedInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return targetInvoices
      .filter(inv => {
        if (inv?.anulado || inv?.status === 'ANULADA') return false;
        const saldo = Number(inv?.saldoUsd || (inv?.saldoBs ? inv.saldoBs / (inv.tasa || tasaBcv) : inv?.saldo || 0));
        return saldo > 0.01;
      })
      .map(inv => {
        const saldoUsd = Number(inv?.saldoUsd || (inv?.saldoBs ? inv.saldoBs / (inv.tasa || tasaBcv) : inv?.saldo || 0));
        const saldoBs = Number(inv?.saldoBs || (saldoUsd * (inv?.tasa || tasaBcv)));
        const totNetoUsd = Number(inv?.totNetoUsd || inv?.tot_neto_usd || inv?.totalUsd || saldoUsd);

        // Fechas
        const fecEmis = inv?.fechaEmision || inv?.fec_emis;
        const fecVenc = inv?.fechaVencimiento || inv?.fec_venc || fecEmis;
        const dueDate = fecVenc ? new Date(fecVenc) : today;
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isVencida = diffDays > 0;

        let tramo = 'VIGENTE';
        if (isVencida) {
          if (diffDays <= 15) tramo = '1_15';
          else if (diffDays <= 30) tramo = '16_30';
          else tramo = 'OVER_30';
        }

        return {
          id: inv.id || `FAC-${inv.factNum || inv.fact_num}`,
          factNum: inv.factNum || inv.fact_num || 'S/N',
          clienteNombre: inv.clienteNombre || inv.cliente_nombre || inv.cliente || 'Cliente General',
          clienteRif: inv.clienteRif || inv.cliente_rif || 'V-00000000',
          vendedorId: inv.vendedorId || inv.vendedor_id || inv.co_ven || '01',
          fecEmis: fecEmis ? new Date(fecEmis).toLocaleDateString() : 'N/A',
          fecVenc: fecVenc ? new Date(fecVenc).toLocaleDateString() : 'N/A',
          totNetoUsd,
          saldoUsd,
          saldoBs,
          isVencida,
          diffDays,
          tramo
        };
      });
  }, [targetInvoices, tasaBcv]);

  // Filtros aplicados
  const filteredInvoices = useMemo(() => {
    return processedInvoices.filter(inv => {
      // Búsqueda
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = inv.clienteNombre.toLowerCase().includes(q);
        const matchRif = inv.clienteRif.toLowerCase().includes(q);
        const matchNum = inv.factNum.toString().includes(q);
        if (!matchName && !matchRif && !matchNum) return false;
      }

      // Vendedor
      if (sellerFilter !== 'ALL' && inv.vendedorId !== sellerFilter) {
        return false;
      }

      // Estado / Tramo
      if (statusFilter === 'VIGENTE' && inv.isVencida) return false;
      if (statusFilter === 'VENCIDO' && !inv.isVencida) return false;
      if (statusFilter === 'VENCIDO_1_15' && inv.tramo !== '1_15') return false;
      if (statusFilter === 'VENCIDO_16_30' && inv.tramo !== '16_30') return false;
      if (statusFilter === 'VENCIDO_OVER_30' && inv.tramo !== 'OVER_30') return false;

      return true;
    });
  }, [processedInvoices, searchFilter, sellerFilter, statusFilter]);

  // Métricas Consolidadas
  const totalCarteraUsd = useMemo(() => {
    return processedInvoices.reduce((acc, i) => acc + i.saldoUsd, 0);
  }, [processedInvoices]);

  const totalCarteraBs = totalCarteraUsd * tasaBcv;

  const totalVencidoUsd = useMemo(() => {
    return processedInvoices.filter(i => i.isVencida).reduce((acc, i) => acc + i.saldoUsd, 0);
  }, [processedInvoices]);

  const totalVigenteUsd = totalCarteraUsd - totalVencidoUsd;

  const countClientesConDeuda = useMemo(() => {
    const setClis = new Set(processedInvoices.map(i => i.clienteRif || i.clienteNombre));
    return setClis.size;
  }, [processedInvoices]);

  // Imprimir universal
  const handlePrint = () => {
    generateAccountsReceivablePDF({
      receivables: filteredInvoices,
      clients,
      sellers,
      config: { ...config, tasaDolar: tasaBcv },
      currentUser
    });
  };

  return (
    <section 
      className="accounts-receivable-view card printable-document"
      style={{
        width: '100%',
        minWidth: 0,
        position: 'relative',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-main, #0f172a)',
        padding: 0,
        overflow: 'visible',
        borderRadius: '16px',
        border: '1px solid var(--border-glass)',
        boxShadow: 'none'
      }}
    >
        {/* ENCABEZADO */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-glass)',
          background: 'var(--bg-card-header)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(230,0,18,0.15), rgba(217,119,6,0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-red)'
            }}>
              <DollarSign size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Cuentas por Cobrar (CxC) & Facturas Supabase
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Gestión de Créditos, Cartera y Vencimientos • Tasa BCV: {formatBs(tasaBcv)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onOpenCollectionIntelligence && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCollectionIntelligence();
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
              >
                <MessageSquare size={16} />
                <span className="hide-on-mobile">Inteligencia WhatsApp</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="btn btn-print-report"
              title="Descargar Reporte Oficial de Cuentas por Cobrar en PDF"
            >
              <Printer size={16} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
          </div>
        </div>

        {/* RESUMEN KPIS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          padding: '1.25rem 1.75rem',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-glass)'
        }}>
          {/* Total Cartera */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid var(--brand-blue)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Cartera CxC
              </span>
              <DollarSign size={16} style={{ color: 'var(--brand-blue)' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatUsd(totalCarteraUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(totalCarteraBs)}
            </div>
          </div>

          {/* Vencido */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #ef4444'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Vencido
              </span>
              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#dc2626' }}>
              {formatUsd(totalVencidoUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {processedInvoices.filter(i => i.isVencida).length} facturas vencidas
            </div>
          </div>

          {/* Vigente */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Vigente
              </span>
              <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669' }}>
              {formatUsd(totalVigenteUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {processedInvoices.filter(i => !i.isVencida).length} facturas al día
            </div>
          </div>

          {/* Clientes Acreedores */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #8b5cf6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Clientes con Deuda
              </span>
              <Users size={16} style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {countClientesConDeuda}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Total facturas activas: {processedInvoices.length}
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          padding: '1rem 1.75rem',
          borderBottom: '1px solid var(--border-glass)',
          background: 'var(--bg-card-glass)',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div className="search-wrapper" style={{ flex: '1 1 280px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por cliente, RIF o factura #..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="input-modern"
              style={{ width: '100%', paddingLeft: '2.4rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              <option value="ALL">Todos los Estados ({processedInvoices.length})</option>
              <option value="VIGENTE">Solo Vigentes (Por Vencer)</option>
              <option value="VENCIDO">Todas las Vencidas</option>
              <option value="VENCIDO_1_15">Vencidas 1 a 15 días</option>
              <option value="VENCIDO_16_30">Vencidas 16 a 30 días</option>
              <option value="VENCIDO_OVER_30">Vencidas más de 30 días</option>
            </select>

            <select
              className="filter-select"
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              style={{ minWidth: '160px' }}
            >
              <option value="ALL">Todos los Vendedores</option>
              {targetSellers.map(s => (
                <option key={s.coVen || s.id} value={s.coVen || s.id}>
                  {s.venDes || s.nombre || s.coVen || s.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA DE FACTURAS */}
        <div style={{ width: '100%', minWidth: 0, padding: '1.25rem 1.75rem' }}>
          {filteredInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem', color: '#10b981', opacity: 0.8 }} />
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>No se encontraron facturas con los filtros seleccionados.</p>
              <span style={{ fontSize: '0.85rem' }}>No hay saldos pendientes en este criterio de búsqueda.</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>N° Factura</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cliente / RIF</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Emisión</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vencimiento</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Estatus / Aging</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Total Factura</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Saldo Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => {
                    return (
                      <tr
                        key={inv.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-glass)',
                          background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)'
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
                          #{inv.factNum}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.clienteNombre}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.clienteRif}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {inv.fecEmis}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {inv.fecVenc}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {inv.isVencida ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: inv.diffDays > 30 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: inv.diffDays > 30 ? '#dc2626' : '#d97706'
                            }}>
                              <Clock size={12} />
                              Vencida hace {inv.diffDays}d
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#059669'
                            }}>
                              <CheckCircle2 size={12} />
                              Vigente ({Math.abs(inv.diffDays)}d por vencer)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {formatUsd(inv.totNetoUsd)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: inv.isVencida ? '#dc2626' : 'var(--text-primary)' }}>
                            {formatUsd(inv.saldoUsd)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {formatBs(inv.saldoBs)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </section>
  );
}
