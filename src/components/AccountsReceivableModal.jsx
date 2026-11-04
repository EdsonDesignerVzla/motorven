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
  MessageSquare,
  Trash2,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

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
  onOpenCollectionIntelligence,
  onDeleteSale
}) {
  const notify = useNotification();
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VIGENTE' | 'VENCIDO' | 'VENCIDO_1_15' | 'VENCIDO_16_30' | 'VENCIDO_OVER_30'
  const [sellerFilter, setSellerFilter] = useState('ALL');

  // Estados para Eliminación con Doble Seguridad (Exclusivo Administradores)
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [localDeletedKeys, setLocalDeletedKeys] = useState(new Set());

  // Validación estricta de privilegios de Administrador
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.rol || currentUser.role || '').toUpperCase();
    const uname = (currentUser.username || currentUser.name || '').toLowerCase();
    return (
      r.includes('ADMIN') ||
      r.includes('MASTER') ||
      r.includes('GERENCIA') ||
      r.includes('TECNOLOGÍA') ||
      r.includes('INFORMÁTICA') ||
      uname === 'edson designer' ||
      uname === 'admin' ||
      uname === 'gerencia' ||
      uname === 'manuel'
    );
  }, [currentUser]);

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  const targetInvoices = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Facturas locales / Supabase generadas en el sistema (sales)
    if (Array.isArray(invoices)) {
      for (const inv of invoices) {
        if (!inv) continue;
        const key = String(inv.numeroDoc || inv.numero_doc || inv.id || inv.factNum || inv.fact_num);
        if (localDeletedKeys.has(key) || localDeletedKeys.has(String(inv.id)) || localDeletedKeys.has(String(inv.numeroDoc))) continue;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(inv);
        }
      }
    }

    // 2. Facturas de Profit Plus ERP
    if (Array.isArray(profitInvoices)) {
      for (const pinv of profitInvoices) {
        if (!pinv) continue;
        const key = String(pinv.factNum || pinv.fact_num || pinv.numeroDoc || pinv.id);
        if (localDeletedKeys.has(key) || localDeletedKeys.has(String(pinv.id))) continue;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(pinv);
        }
      }
    }

    return list;
  }, [invoices, profitInvoices, localDeletedKeys]);

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
        if (!inv) return false;
        if (inv?.anulado || inv?.status === 'ANULADA') return false;
        const isCreditSale = (inv?.condicionPago && inv.condicionPago !== 'CONTADO') ||
                             (inv?.condicion_pago && inv.condicion_pago !== 'CONTADO') ||
                             inv?.metodoPago === 'CREDITO' || inv?.metodo_pago === 'CREDITO' ||
                             inv?.estado === 'PENDIENTE';
        let saldo = Number(inv?.saldoUsd ?? inv?.saldo_usd ?? 0);
        if (saldo <= 0.01 && (inv?.saldoBs || inv?.saldo_bs)) {
          saldo = Number(inv.saldoBs || inv.saldo_bs) / (inv.tasa || inv.tasaDolar || inv.tasa_dolar || tasaBcv);
        }
        if (saldo <= 0.01 && isCreditSale && inv?.estado !== 'PAGADO') {
          saldo = Number(inv.totalUsd || inv.total_usd || inv.totNetoUsd || inv.tot_neto_usd || 0);
        }
        return saldo > 0.01;
      })
      .map(inv => {
        const isCreditSale = (inv?.condicionPago && inv.condicionPago !== 'CONTADO') ||
                             (inv?.condicion_pago && inv.condicion_pago !== 'CONTADO') ||
                             inv?.metodoPago === 'CREDITO' || inv?.metodo_pago === 'CREDITO' ||
                             inv?.estado === 'PENDIENTE';

        let rawSaldoUsd = inv?.saldoUsd ?? inv?.saldo_usd;
        if (rawSaldoUsd === undefined || rawSaldoUsd === null || (isCreditSale && inv?.estado !== 'PAGADO' && Number(rawSaldoUsd) <= 0.01)) {
          if (inv?.saldoBs || inv?.saldo_bs) {
            rawSaldoUsd = Number(inv.saldoBs || inv.saldo_bs) / (inv.tasa || inv.tasaDolar || inv.tasa_dolar || tasaBcv);
          } else if (inv?.saldo !== undefined && inv?.saldo !== null) {
            rawSaldoUsd = Number(inv.saldo);
          } else if (isCreditSale) {
            rawSaldoUsd = Number(inv.totalUsd || inv.total_usd || inv.totNetoUsd || inv.tot_neto_usd || 0);
          } else {
            rawSaldoUsd = 0;
          }
        }
        const saldoUsd = Number(rawSaldoUsd) || 0;
        const saldoBs = Number(inv?.saldoBs || inv?.saldo_bs || (saldoUsd * (inv?.tasa || inv?.tasaDolar || inv?.tasa_dolar || tasaBcv)));
        const totNetoUsd = Number(inv?.totNetoUsd || inv?.tot_neto_usd || inv?.totalUsd || inv?.total_usd || saldoUsd);

        // Fechas
        const fecEmis = inv?.fechaEmision || inv?.fecha_emision || inv?.fec_emis || inv?.fecha;
        const fecVenc = inv?.fechaVencimiento || inv?.fecha_vencimiento || inv?.fec_venc || fecEmis;
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

        const resolvedFactNum = inv.factNum || inv.fact_num || inv.numeroDoc || inv.numero_doc || inv.id || 'S/N';

        return {
          id: inv.id || `FAC-${resolvedFactNum}`,
          factNum: resolvedFactNum,
          clienteNombre: inv.clienteNombre || inv.cliente_nombre || inv.cliente || 'Cliente General',
          clienteRif: inv.clienteRif || inv.cliente_rif || inv.rif || 'V-00000000',
          vendedorId: inv.vendedorId || inv.vendedor_id || inv.co_ven || inv.vendedor || '01',
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

  const isKeywordMatched = useMemo(() => {
    if (!invoiceToDelete) return false;
    const clean = confirmKeyword.trim().toUpperCase();
    const factNumClean = String(invoiceToDelete.factNum || '').trim().toUpperCase();
    return clean === 'ELIMINAR' || clean === factNumClean;
  }, [confirmKeyword, invoiceToDelete]);

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    const key = String(invoiceToDelete.id || invoiceToDelete.factNum || invoiceToDelete.numeroDoc);
    setIsDeleting(true);
    try {
      if (onDeleteSale) {
        await onDeleteSale(key);
      }
      setLocalDeletedKeys(prev => {
        const next = new Set(prev);
        next.add(key);
        next.add(String(invoiceToDelete.id));
        next.add(String(invoiceToDelete.factNum));
        next.add(String(invoiceToDelete.numeroDoc));
        return next;
      });
      notify.success(`Factura #${invoiceToDelete.factNum} eliminada con éxito de la base de datos.`);
      setInvoiceToDelete(null);
      setConfirmKeyword('');
    } catch (err) {
      console.error('Error al eliminar factura:', err);
      notify.error('Error al eliminar factura: ' + (err.message || 'Error del servidor'));
    } finally {
      setIsDeleting(false);
    }
  };

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
                    {isAdmin && (
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#ef4444', textAlign: 'center', width: '110px' }}>
                        Acciones
                      </th>
                    )}
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
                        {isAdmin && (
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setInvoiceToDelete(inv);
                                setConfirmKeyword('');
                              }}
                              className="btn btn-sm"
                              style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                borderRadius: '7px',
                                padding: '5px 11px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)'
                              }}
                              title="Eliminar factura de la base de datos (Requiere doble confirmación)"
                            >
                              <Trash2 size={13} />
                              <span>Eliminar</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL DE ELIMINACIÓN CON DOBLE SEGURIDAD (EXCLUSIVO ADMINISTRADORES) */}
        {invoiceToDelete && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '1rem'
            }}
            onClick={() => !isDeleting && setInvoiceToDelete(null)}
          >
            <div
              className="modal-content"
              style={{
                maxWidth: '520px',
                width: '100%',
                background: 'var(--bg-card, #111827)',
                borderRadius: '16px',
                border: '1.5px solid rgba(239, 68, 68, 0.5)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(239, 68, 68, 0.25)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ENCABEZADO MODAL */}
              <div style={{
                padding: '1.25rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.12) 100%)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444'
                  }}>
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ef4444', letterSpacing: '-0.01em' }}>
                      Eliminación con Doble Seguridad
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Privilegio de Administrador • Acción Permanente
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isDeleting && setInvoiceToDelete(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* CUERPO MODAL */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#ef4444', marginBottom: '0.35rem' }}>
                    <AlertTriangle size={16} /> ⚠️ ADVERTENCIA DE CONTROL FISCAL Y FINANCIERO
                  </div>
                  Esta acción eliminará de forma irreversible la <strong>Factura #{invoiceToDelete.factNum}</strong> de la base de datos de Ventas y revertirá su saldo en Cuentas por Cobrar.
                </div>

                {/* DETALLES DE LA FACTURA */}
                <div style={{
                  background: 'var(--bg-surface, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  padding: '0.9rem 1.1rem',
                  fontSize: '0.84rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>N° Factura:</span>
                    <strong style={{ color: 'var(--brand-blue)', fontSize: '0.98rem' }}>#{invoiceToDelete.factNum}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Cliente:</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>{invoiceToDelete.clienteNombre}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Total Facturado:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatUsd(invoiceToDelete.totNetoUsd)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Saldo en Deuda (CxC):</span>
                    <strong style={{ color: '#ef4444' }}>{formatUsd(invoiceToDelete.saldoUsd)}</strong>
                  </div>
                </div>

                {/* DOBLE SEGURIDAD: PALABRA O FACTURA DE VALIDACIÓN */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                    🔒 Segundo Factor de Seguridad: Escriba <span style={{ color: '#ef4444', fontWeight: 800 }}>ELIMINAR</span> o el número <span style={{ color: 'var(--brand-blue)', fontWeight: 800 }}>{invoiceToDelete.factNum}</span> para desbloquear:
                  </label>
                  <input
                    type="text"
                    className="input-modern"
                    placeholder={`Escriba ELIMINAR o ${invoiceToDelete.factNum}`}
                    value={confirmKeyword}
                    onChange={(e) => setConfirmKeyword(e.target.value)}
                    disabled={isDeleting}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textAlign: 'center',
                      borderRadius: '8px',
                      border: isKeywordMatched ? '2px solid #ef4444' : '1px solid var(--border-glass)'
                    }}
                    autoFocus
                  />
                  {isKeywordMatched && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} /> Doble seguridad verificada. Botón de eliminación desbloqueado.
                    </div>
                  )}
                </div>
              </div>

              {/* PIE DE PÁGINA */}
              <div style={{
                padding: '1rem 1.5rem',
                background: 'var(--bg-card-header, rgba(255, 255, 255, 0.02))',
                borderTop: '1px solid var(--border-glass)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setInvoiceToDelete(null)}
                  disabled={isDeleting}
                  style={{ padding: '0.6rem 1.15rem', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={!isKeywordMatched || isDeleting}
                  style={{
                    background: isKeywordMatched ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'rgba(255, 255, 255, 0.08)',
                    color: isKeywordMatched ? '#ffffff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.35rem',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: isKeywordMatched && !isDeleting ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isKeywordMatched ? '0 4px 14px rgba(239, 68, 68, 0.4)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Trash2 size={16} />
                  {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación Definitiva'}
                </button>
              </div>
            </div>
          </div>
        )}
    </section>
  );
}
