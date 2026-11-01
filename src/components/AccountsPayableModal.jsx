import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Filter,
  Printer,
  X,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  CreditCard,
  FileText
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateAccountsPayablePDF } from '../services/pdfReportService';

export default function AccountsPayableModal({
  isOpen,
  onClose,
  accountsPayable = [],
  profitAccountsPayable = [],
  suppliers = [],
  profitSuppliers = [],
  config = {},
  currentUser = null
}) {
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VIGENTE' | 'VENCIDO' | 'VENCIDO_1_15' | 'VENCIDO_16_30' | 'VENCIDO_OVER_30'
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  const targetPayables = useMemo(() => {
    return (Array.isArray(profitAccountsPayable) && profitAccountsPayable.length > 0)
      ? profitAccountsPayable
      : (Array.isArray(accountsPayable) ? accountsPayable : []);
  }, [accountsPayable, profitAccountsPayable]);

  // Lista de tipos de documentos únicos
  const docTypes = useMemo(() => {
    const setTypes = new Set(targetPayables.map(p => (p.tipoDoc || p.tipo_doc || '').trim()).filter(Boolean));
    return Array.from(setTypes);
  }, [targetPayables]);

  // Procesamiento con días de vencimiento
  const processedPayables = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return targetPayables
      .filter(p => {
        if (p?.anulado) return false;
        const saldoBs = Number(p?.saldoBs || p?.saldo_bs || 0);
        const saldoUsd = Number(p?.saldoUsd || p?.saldo_usd || (tasaBcv > 0 ? saldoBs / tasaBcv : 0));
        return saldoBs > 0.01 || saldoUsd > 0.01;
      })
      .map(p => {
        const saldoBs = Number(p?.saldoBs || p?.saldo_bs || 0);
        const saldoUsd = Number(p?.saldoUsd || p?.saldo_usd || (tasaBcv > 0 ? saldoBs / tasaBcv : 0));
        const montoNetUsd = Number(p?.montoNetUsd || p?.monto_net_usd || (tasaBcv > 0 ? Number(p?.montoNetBs || p?.monto_net_bs || 0) / tasaBcv : 0));

        // Fechas
        const fecEmis = p?.fechaEmision || p?.fec_emis;
        const fecVenc = p?.fechaVencimiento || p?.fec_venc || fecEmis;
        const dueDate = fecVenc ? new Date(fecVenc) : today;
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isVencido = diffDays > 0;

        let tramo = 'VIGENTE';
        if (isVencido) {
          if (diffDays <= 15) tramo = '1_15';
          else if (diffDays <= 30) tramo = '16_30';
          else tramo = 'OVER_30';
        }

        return {
          id: p.id || `CXP-${p.tipoDoc || p.tipo_doc}-${p.nroDoc || p.nro_doc}`,
          tipoDoc: p.tipoDoc || p.tipo_doc || 'DOC',
          nroDoc: p.nroDoc || p.nro_doc || 'S/N',
          provNombre: p.provNombre || p.prov_nombre || 'Proveedor General',
          provRif: p.provRif || p.prov_rif || p.coProv || p.co_prov || 'J-00000000',
          fecEmis: fecEmis ? new Date(fecEmis).toLocaleDateString() : 'N/A',
          fecVenc: fecVenc ? new Date(fecVenc).toLocaleDateString() : 'N/A',
          montoNetUsd,
          saldoUsd,
          saldoBs,
          isVencido,
          diffDays,
          tramo
        };
      });
  }, [targetPayables, tasaBcv]);

  // Filtrado
  const filteredPayables = useMemo(() => {
    return processedPayables.filter(p => {
      // Búsqueda
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = p.provNombre.toLowerCase().includes(q);
        const matchRif = p.provRif.toLowerCase().includes(q);
        const matchDoc = p.nroDoc.toString().includes(q);
        if (!matchName && !matchRif && !matchDoc) return false;
      }

      // Tipo de documento
      if (docTypeFilter !== 'ALL' && p.tipoDoc !== docTypeFilter) {
        return false;
      }

      // Estado
      if (statusFilter === 'VIGENTE' && p.isVencido) return false;
      if (statusFilter === 'VENCIDO' && !p.isVencido) return false;
      if (statusFilter === 'VENCIDO_1_15' && p.tramo !== '1_15') return false;
      if (statusFilter === 'VENCIDO_16_30' && p.tramo !== '16_30') return false;
      if (statusFilter === 'VENCIDO_OVER_30' && p.tramo !== 'OVER_30') return false;

      return true;
    });
  }, [processedPayables, searchFilter, docTypeFilter, statusFilter]);

  // Métricas Consolidadas
  const totalCarteraUsd = useMemo(() => {
    return processedPayables.reduce((acc, p) => acc + p.saldoUsd, 0);
  }, [processedPayables]);

  const totalCarteraBs = useMemo(() => {
    return processedPayables.reduce((acc, p) => acc + p.saldoBs, 0);
  }, [processedPayables]);

  const totalVencidoUsd = useMemo(() => {
    return processedPayables.filter(p => p.isVencido).reduce((acc, p) => acc + p.saldoUsd, 0);
  }, [processedPayables]);

  const totalVigenteUsd = totalCarteraUsd - totalVencidoUsd;

  const countProveedoresConDeuda = useMemo(() => {
    const setProvs = new Set(processedPayables.map(p => p.provRif || p.provNombre));
    return setProvs.size;
  }, [processedPayables]);

  // Imprimir reporte PDF oficial
  const handlePrint = () => {
    generateAccountsPayablePDF({
      payables: filteredPayables,
      suppliers,
      config: { ...config, tasaDolar: tasaBcv },
      currentUser
    });
  };

  return (
    <section 
      className="accounts-payable-view card printable-document"
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
              background: 'linear-gradient(135deg, rgba(2,132,199,0.15), rgba(16,185,129,0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-blue)'
            }}>
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Cuentas por Pagar (CxP) & Proveedores Supabase
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Control de Pasivos y Facturas de Compra • Tasa BCV: {formatBs(tasaBcv)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <button
              onClick={() => generateAccountsPayablePDF({ payables: filteredPayables, suppliers, config: { ...config, tasaDolar: tasaBcv }, currentUser })}
              className="btn btn-print-report"
              title="Descargar Reporte Oficial de Cuentas por Pagar en PDF"
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
          {/* Total Cartera por Pagar */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid var(--brand-blue)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Pasivos CxP
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
                Deuda Vencida
              </span>
              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#dc2626' }}>
              {formatUsd(totalVencidoUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {processedPayables.filter(p => p.isVencido).length} documentos vencidos
            </div>
          </div>

          {/* Por Vencer */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Deuda por Vencer
              </span>
              <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669' }}>
              {formatUsd(totalVigenteUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {processedPayables.filter(p => !p.isVencido).length} documentos vigentes
            </div>
          </div>

          {/* Proveedores */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #f59e0b'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Proveedores Acreedores
              </span>
              <Building2 size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {countProveedoresConDeuda}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Total documentos: {processedPayables.length}
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
              placeholder="Buscar por proveedor, RIF o documento #..."
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
              <option value="ALL">Todos los Estados ({processedPayables.length})</option>
              <option value="VIGENTE">Solo Por Vencer (Al Día)</option>
              <option value="VENCIDO">Todas las Vencidas</option>
              <option value="VENCIDO_1_15">Vencidas 1 a 15 días</option>
              <option value="VENCIDO_16_30">Vencidas 16 a 30 días</option>
              <option value="VENCIDO_OVER_30">Vencidas más de 30 días</option>
            </select>

            <select
              className="filter-select"
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              style={{ minWidth: '160px' }}
            >
              <option value="ALL">Todos los Documentos</option>
              {docTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA DE CUENTAS POR PAGAR */}
        <div style={{ width: '100%', minWidth: 0, padding: '1.25rem 1.75rem' }}>
          {filteredPayables.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem', color: '#10b981', opacity: 0.8 }} />
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>No se encontraron obligaciones pendientes con los filtros seleccionados.</p>
              <span style={{ fontSize: '0.85rem' }}>Todos los pagos a proveedores están al día según los criterios.</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Documento</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Proveedor / RIF</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Emisión</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vencimiento</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Estatus / Vencimiento</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Monto Original</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Saldo Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayables.map((p, idx) => {
                    return (
                      <tr
                        key={p.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-glass)',
                          background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)'
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(0,43,122,0.1)',
                            color: 'var(--brand-blue)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            marginRight: '0.4rem'
                          }}>
                            {p.tipoDoc}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            #{p.nroDoc}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.provNombre}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.provRif}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {p.fecEmis}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {p.fecVenc}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {p.isVencido ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: p.diffDays > 30 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: p.diffDays > 30 ? '#dc2626' : '#d97706'
                            }}>
                              <Clock size={12} />
                              Vencida hace {p.diffDays}d
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
                              Por Vencer ({Math.abs(p.diffDays)}d)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {formatUsd(p.montoNetUsd)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: p.isVencido ? '#dc2626' : 'var(--text-primary)' }}>
                            {formatUsd(p.saldoUsd)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {formatBs(p.saldoBs)}
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
